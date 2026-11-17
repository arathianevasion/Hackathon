import { describe, expect, it } from "vitest";
import { codeAccepted, DEMO_CODE, SESSION_COOKIE, SESSION_VALUE } from "./agentSession";

describe("the mocked one-time code", () => {
  it("accepts the demo code, with stray spaces", () => {
    expect(codeAccepted(DEMO_CODE)).toBe(true);
    expect(codeAccepted(` ${DEMO_CODE} `)).toBe(true);
  });
  it("rejects anything else", () => {
    expect(codeAccepted("000000")).toBe(false);
    expect(codeAccepted("")).toBe(false);
  });
  it("names the session cookie", () => {
    expect(SESSION_COOKIE).toBeTruthy();
    expect(SESSION_VALUE).toBeTruthy();
  });
});
