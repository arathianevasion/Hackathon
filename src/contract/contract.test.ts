import { describe, expect, it } from "vitest";
import { EVENT_NAMES, TOOL_NAMES } from ".";

describe("contract", () => {
  it("declares the ten Assistant tools from the autonomy decision (#8)", () => {
    expect([...TOOL_NAMES].sort()).toEqual(
      [
        "get_client",
        "list_open_dmis",
        "lookup_dmi_rules",
        "check_consent",
        "send_text",
        "create_portal_link",
        "precheck_document",
        "submit_documents",
        "get_dmi_status",
        "escalate_to_agent",
      ].sort(),
    );
  });

  it("names one event per Assistant trigger from the architecture decision (#10)", () => {
    expect([...EVENT_NAMES]).toEqual([
      "dmi.detected",
      "client.message",
      "document.uploaded",
      "cadence.step_due",
      "agent.action",
    ]);
  });
});
