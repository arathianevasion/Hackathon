"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { codeAccepted, SESSION_COOKIE, SESSION_VALUE } from "../src/agentSession";
import { receiveClientText } from "../src/assistant/inbound";
import { runAssistant } from "../src/assistant/run";
import { openUploadSession, PORTAL_LINK_BASE } from "../src/portal/portalLink";
import { comeBackLater } from "../src/portal/comeBackLater";
import { receiveUpload } from "../src/portal/upload";
import { handBackToAssistant, sendAgentText } from "../src/assistant/agentThread";
import { markEscalationHandled } from "../src/assistant/escalations";
import { createTools } from "../src/assistant/tools";
import { demoClock, resetDemoClock } from "../src/cadence/demo";
import { fastForward } from "../src/cadence/engine";
import { demoStore } from "../src/store/demo";

/** Reset demo: throw away everything and re-seed from today. */
export async function resetDemo() {
  resetDemoClock();
  demoStore().reset(demoClock().now());
  revalidatePath("/", "layout");
}

/** Demo control: advances the clock `days` days and fires the cadence steps that fall due. */
export async function fastForwardDemo(formData: FormData) {
  const days = Number(formData.get("days"));
  if (!Number.isInteger(days) || days < 1 || days > 30) return;
  const store = demoStore();
  const clock = demoClock();
  const extract = async () => {
    throw new Error("The cadence engine extracts nothing");
  };
  await fastForward({ store, clock, tools: createTools({ store, now: clock.now, extract }) }, days);
  revalidatePath("/", "layout");
}

/** Demo control: a DMI is opened for this Client, which runs the Assistant once. */
export async function openDmi(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const dmiId = String(formData.get("dmiId"));
  // The key comes from .env.local (git-ignored), which Next.js loads into the environment.
  await runAssistant({ name: "dmi.detected", clientId, dmiId }, { store: demoStore(), now: demoClock().now, model: new Anthropic() });
  revalidatePath("/", "layout");
}

/** The Client types a reply in the phone: it is masked and stored, then runs the Assistant once. */
export async function sendClientReply(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const typed = String(formData.get("text") ?? "").trim();
  if (typed === "") return;
  const deps = { store: demoStore(), now: demoClock().now, model: new Anthropic() };
  await runAssistant(receiveClientText(deps, clientId, typed), deps);
  revalidatePath("/", "layout");
}

/** The Client taps a Portal link in a text: the in-phone browser opens it, starting the upload session on first open. */
export async function openPortalLink(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const url = String(formData.get("url"));
  if (!url.startsWith(PORTAL_LINK_BASE)) return;
  openUploadSession(demoStore(), url, demoClock().now());
  redirect(`/?client=${encodeURIComponent(clientId)}&portal=${encodeURIComponent(url.slice(PORTAL_LINK_BASE.length))}`);
}

/** The Client uploads a file on the upload page: it is stored, then runs the Assistant once to check it. */
export async function uploadDocument(formData: FormData): Promise<{ taken: boolean }> {
  const url = `${PORTAL_LINK_BASE}${String(formData.get("token"))}`;
  // "Take a photo" and "Choose a file" are two inputs; only the one the Client used holds a file.
  const file = formData.getAll("file").find((f): f is File => f instanceof File && f.size > 0);
  if (!file) return { taken: false };
  const deps = { store: demoStore(), now: demoClock().now, model: new Anthropic() };
  const upload = { choice: String(formData.get("choice")), fileName: file.name, mediaType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
  // Outside its upload session the page already shows the link as expired; there is nothing to take.
  let event;
  try {
    event = receiveUpload(deps, url, upload);
  } catch {
    revalidatePath("/", "layout");
    return { taken: false };
  }
  await runAssistant(event, deps);
  revalidatePath("/", "layout");
  return { taken: true };
}

/** The Client taps "I'll come back later" on the upload page: the link closes and the Assistant texts the promise. */
export async function comeBackLaterAction(formData: FormData) {
  await comeBackLater({ store: demoStore(), now: demoClock().now }, String(formData.get("token")));
  revalidatePath("/", "layout");
}

/** The Agent taps "Mark handled" on the handoff card: the Escalation closes, and with none left open the Assistant resumes. */
export async function markHandled(formData: FormData) {
  markEscalationHandled(demoStore(), String(formData.get("escalationId")), demoClock().now());
  revalidatePath("/", "layout");
}

/** The Agent sends a text from the message box under the Thread; the Assistant then holds for that Client. */
export async function sendAgentTextAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const typed = String(formData.get("text") ?? "").trim();
  if (typed === "") return;
  const result = await sendAgentText({ store: demoStore(), now: demoClock().now }, clientId, typed);
  revalidatePath("/", "layout");
  // Nothing was posted: say why on the Agent view rather than failing silently.
  if (!result.sent) redirect(`/?client=${encodeURIComponent(clientId)}&notsent=${result.reason}`);
}

/** The Agent taps "Hand back to the Assistant": it resumes for this Client, unless an Escalation is still open. */
export async function handBack(formData: FormData) {
  handBackToAssistant({ store: demoStore(), now: demoClock().now }, String(formData.get("clientId")));
  revalidatePath("/", "layout");
}

/** Mocked single sign-on: the demo's one-time code starts the Agent's session. */
export async function signIn(formData: FormData) {
  if (!codeAccepted(String(formData.get("code") ?? ""))) redirect("/?signin=wrong");
  (await cookies()).set(SESSION_COOKIE, SESSION_VALUE, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
