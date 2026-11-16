import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaToolRunnerParams } from "@anthropic-ai/sdk/resources/beta/messages";
import { z } from "zod";
import type { ClientId, DomainEvent } from "../contract";
import type { Store } from "../store/store";
import { assistantTextsAbout, firstText, PORTAL_LINK_SLOT } from "./firstText";
import { createTools } from "./tools";

/** The model the spec names for the Assistant. */
export const ASSISTANT_MODEL = "claude-sonnet-5-5";

export type RunnerParams = BetaToolRunnerParams;

/** The slice of the Anthropic client the Assistant uses; tests pass a scripted stand-in. */
export interface ModelClient {
  beta: { messages: { toolRunner(params: RunnerParams): PromiseLike<unknown> } };
}

export interface RunDeps {
  store: Store;
  now: () => Date;
  model: ModelClient;
}

const SYSTEM = [
  "You are the AI assistant working for a licensed insurance agent. You help the agent's clients resolve ACA Marketplace data matching issues (DMIs) by text.",
  "You act only through your tools. The tools enforce consent, opt-out and the outbound filter; if a tool refuses, stop and do not try to work around it.",
  "Never put personal data in a text: no Social Security numbers, no income amounts, and no links other than the Portal link you created.",
].join("\n");

/**
 * Runs the Assistant once for one event about one Client (Tool Runner on
 * `claude-sonnet-5-5`). The model only sees minimized data and acts through
 * tools bound to that Client.
 */
export async function runAssistant(event: DomainEvent, deps: RunDeps): Promise<void> {
  if (event.name !== "dmi.detected") throw new Error(`The Assistant does not handle ${event.name} yet`);

  const { store } = deps;
  const dmi = store.list("dmis").find((d) => d.id === event.dmiId && d.clientId === event.clientId);
  const client = store.list("clients").find((c) => c.id === event.clientId);
  const agent = store.agent();
  if (!dmi || !client || !agent) throw new Error(`No DMI ${event.dmiId} for Client ${event.clientId}`);
  if (dmi.status !== "open" || !assistantTextsAbout(dmi.type)) return;

  const text = firstText({ clientFirstName: client.firstName, agentFirstName: agent.firstName, dmiType: dmi.type, deadline: dmi.deadline });
  const prompt = [
    "A DMI was just opened for this client. Send them the first text.",
    `dmi_id: ${dmi.id}`,
    "Steps:",
    "1. check_consent for text_outreach.",
    "2. create_portal_link for this dmi_id.",
    `3. send_text with exactly the text in <first_text>, with ${PORTAL_LINK_SLOT} replaced by the Portal link's url. Change nothing else.`,
    `<first_text>${text}</first_text>`,
  ].join("\n");

  await deps.model.beta.messages.toolRunner({
    model: ASSISTANT_MODEL,
    max_tokens: 1024,
    max_iterations: 6,
    output_config: { effort: "low" },
    fallbacks: "default",
    system: SYSTEM,
    tools: modelTools(event.clientId, deps),
    messages: [{ role: "user", content: prompt }],
  });
}

/** The tools as the model sees them, bound to one Client so it cannot act for anyone else. */
function modelTools(clientId: ClientId, { store, now }: RunDeps) {
  const tools = createTools({ store, now });
  const json = (value: unknown) => JSON.stringify(value);
  return [
    betaZodTool({
      name: "check_consent",
      description: "Checks that a Consent record covers an action for this client. Run it before every action.",
      inputSchema: z.object({ action: z.enum(["text_outreach", "portal_link", "document_submission"]) }),
      run: async ({ action }) => json(await tools.check_consent({ clientId, action })),
    }),
    betaZodTool({
      name: "create_portal_link",
      description: "Issues a new single-use Portal link for one of this client's DMIs, open for 72 hours. Returns its url.",
      inputSchema: z.object({ dmiId: z.string() }),
      run: async ({ dmiId }) => json(await tools.create_portal_link({ clientId, dmiId })),
    }),
    betaZodTool({
      name: "send_text",
      description: "Sends a text to this client in their Thread. Refuses without consent or after opt-out, and blocks texts the outbound filter catches.",
      inputSchema: z.object({ text: z.string() }),
      run: async ({ text }) => json(await tools.send_text({ clientId, text })),
    }),
  ];
}
