"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { receiveClientText } from "../src/assistant/inbound";
import { runAssistant } from "../src/assistant/run";
import { openUploadSession, PORTAL_LINK_BASE } from "../src/portal/portalLink";
import { receiveUpload } from "../src/portal/upload";
import { demoStore } from "../src/store/demo";

/** Reset demo: throw away everything and re-seed from today. */
export async function resetDemo() {
  demoStore().reset(new Date());
  revalidatePath("/");
}

/** Demo control: a DMI is opened for this Client, which runs the Assistant once. */
export async function openDmi(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const dmiId = String(formData.get("dmiId"));
  // The key comes from .env.local (git-ignored), which Next.js loads into the environment.
  await runAssistant({ name: "dmi.detected", clientId, dmiId }, { store: demoStore(), now: () => new Date(), model: new Anthropic() });
  revalidatePath("/");
}

/** The Client types a reply in the phone: it is masked and stored, then runs the Assistant once. */
export async function sendClientReply(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const typed = String(formData.get("text") ?? "").trim();
  if (typed === "") return;
  const deps = { store: demoStore(), now: () => new Date(), model: new Anthropic() };
  await runAssistant(receiveClientText(deps, clientId, typed), deps);
  revalidatePath("/");
}

/** The Client taps a Portal link in a text: the in-phone browser opens it, starting the upload session on first open. */
export async function openPortalLink(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const url = String(formData.get("url"));
  if (!url.startsWith(PORTAL_LINK_BASE)) return;
  openUploadSession(demoStore(), url, new Date());
  redirect(`/?client=${encodeURIComponent(clientId)}&portal=${encodeURIComponent(url.slice(PORTAL_LINK_BASE.length))}`);
}

/** The Client uploads a file on the upload page: it is stored, then runs the Assistant once to check it. */
export async function uploadDocument(formData: FormData) {
  const url = `${PORTAL_LINK_BASE}${String(formData.get("token"))}`;
  // "Take a photo" and "Choose a file" are two inputs; only the one the Client used holds a file.
  const file = formData.getAll("file").find((f): f is File => f instanceof File && f.size > 0);
  if (!file) return;
  const deps = { store: demoStore(), now: () => new Date(), model: new Anthropic() };
  const upload = { choice: String(formData.get("choice")), fileName: file.name, mediaType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
  // Outside its upload session the page already shows the link as expired; there is nothing to take.
  let event;
  try {
    event = receiveUpload(deps, url, upload);
  } catch {
    revalidatePath("/");
    return;
  }
  await runAssistant(event, deps);
  revalidatePath("/");
}
