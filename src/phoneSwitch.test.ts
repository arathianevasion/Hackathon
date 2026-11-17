import { describe, expect, it } from "vitest";
import { phoneCookie, phoneShown } from "./phoneSwitch";

describe("phoneShown", () => {
  it("shows the Client's phone by default", () => {
    expect(phoneShown(undefined, undefined)).toBe(true);
  });
  it("hides it when this browser switched it off, and shows it again once switched on", () => {
    expect(phoneShown(undefined, "off")).toBe(false);
    expect(phoneShown(undefined, "on")).toBe(true);
  });
  it("?phone=off hides it whatever the browser chose", () => {
    expect(phoneShown("off", undefined)).toBe(false);
    expect(phoneShown("off", "on")).toBe(false);
  });
});

describe("phoneCookie", () => {
  it("remembers the choice for a year across the whole site", () => {
    expect(phoneCookie(false)).toBe("client-phone=off; path=/; max-age=31536000; samesite=lax");
    expect(phoneCookie(true)).toBe("client-phone=on; path=/; max-age=31536000; samesite=lax");
  });
});
