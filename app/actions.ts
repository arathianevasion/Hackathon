"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { receiveClientText } from "../src/assistant/inbound";
import { runAssistant } from "../src/assistant/run";
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
