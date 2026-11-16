import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openStore, type Store } from "../store/store";
import { runAssistant, type ModelClient, type RunnerParams } from "./run";

const NOW = new Date("2026-11-16T15:00:00Z");
const ROSA = "client-01"; // income DMI dmi-01, due 2026-11-26, CR-1041
const LENA = "client-05"; // SSN DMI dmi-05, due 2026-11-21, CR-1022

/** Plays the model: follows the prompt's steps by calling the tools it was given. */
function scriptedModel() {
  const calls: RunnerParams[] = [];
  const client: ModelClient = {
    beta: {
      messages: {
        toolRunner: vi.fn((params: RunnerParams) => {
          calls.push(params);
          return (async () => {
            const tool = (name: string) => params.tools.find((t) => "name" in t && t.name === name) as { run: (input: unknown) => Promise<string> };
            const prompt = String(params.messages[0].content);
            const template = prompt.slice(prompt.lastIndexOf("<first_text>") + 12, prompt.indexOf("</first_text>"));
            const dmiId = /dmi_id: (\S+)/.exec(prompt)![1];
            await tool("check_consent").run({ action: "text_outreach" });
            const link = JSON.parse(await tool("create_portal_link").run({ dmiId })) as { url: string };
            await tool("send_text").run({ text: template.replace("{portal_link}", link.url) });
          })();
        }),
      },
    },
  };
  return { client, calls };
}

describe("runAssistant on dmi.detected", () => {
  let store: Store;
  let seededLog: number;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
    seededLog = store.list("actionLog").length;
  });
  afterEach(() => store.close());

  const thread = (clientId: string) => store.list("messages").filter((m) => m.clientId === clientId);
  const linkOf = (clientId: string) => store.list("portalLinks").find((l) => l.clientId === clientId)!.url;

  it("runs the Tool Runner once, on claude-sonnet-5-5 at low effort", async () => {
    const model = scriptedModel();
    await runAssistant({ name: "dmi.detected", clientId: ROSA, dmiId: "dmi-01" }, { store, now: () => NOW, model: model.client });
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]).toMatchObject({ model: "claude-sonnet-5-5", output_config: { effort: "low" } });
    expect(model.calls[0].tools.map((t) => ("name" in t ? t.name : ""))).toEqual(["check_consent", "create_portal_link", "send_text"]);
  });

  it("sends Rosa the first text: the AI, the Agent, the DMI, the due date, the link and STOP", async () => {
    const model = scriptedModel();
    await runAssistant({ name: "dmi.detected", clientId: ROSA, dmiId: "dmi-01" }, { store, now: () => NOW, model: model.client });
    expect(thread(ROSA).map((m) => [m.sender, m.text])).toEqual([
      [
        "assistant",
        `Hi Rosa, I'm the AI assistant for your insurance agent, Andrew. The Marketplace needs proof of your income by Nov 26. Everything you need is here: ${linkOf(ROSA)}\nReply with any questions. Reply STOP to opt out.`,
      ],
    ]);
  });

  it("names the SSN document for an SSN DMI", async () => {
    const model = scriptedModel();
    await runAssistant({ name: "dmi.detected", clientId: LENA, dmiId: "dmi-05" }, { store, now: () => NOW, model: model.client });
    expect(thread(LENA)[0].text).toBe(
      `Hi Lena, I'm the AI assistant for your insurance agent, Andrew. The Marketplace needs a document showing your Social Security number by Nov 21. Everything you need is here: ${linkOf(LENA)}\nReply with any questions. Reply STOP to opt out.`,
    );
  });

  it("gives the model no personal data beyond first names, the DMI type and the due date", async () => {
    const model = scriptedModel();
    await runAssistant({ name: "dmi.detected", clientId: ROSA, dmiId: "dmi-01" }, { store, now: () => NOW, model: model.client });
    const sent = JSON.stringify([model.calls[0].system, model.calls[0].messages]);
    for (const secret of ["Delgado-Finch", "202-555", "DEMO-APP", "CR-1041", "Demo Silver"]) expect(sent).not.toContain(secret);
  });

  it("logs each tool call with the Consent record used", async () => {
    const model = scriptedModel();
    await runAssistant({ name: "dmi.detected", clientId: ROSA, dmiId: "dmi-01" }, { store, now: () => NOW, model: model.client });
    expect(store.list("actionLog").slice(seededLog).map((e) => [e.tool, e.consentRecordId, e.result])).toEqual([
      ["check_consent", "CR-1041", "Allowed: text_outreach"],
      ["check_consent", "CR-1041", "Allowed: portal_link"],
      ["create_portal_link", "CR-1041", "Portal link issued, expires in 72 hours"],
      ["check_consent", "CR-1041", "Allowed: text_outreach"],
      ["send_text", "CR-1041", "Text sent"],
    ]);
  });

  it("does not run for a citizenship DMI, which goes to the Agent instead", async () => {
    const model = scriptedModel();
    await runAssistant({ name: "dmi.detected", clientId: "client-06", dmiId: "dmi-06" }, { store, now: () => NOW, model: model.client });
    expect(model.calls).toEqual([]);
    expect(thread("client-06")).toEqual([]);
  });
});
