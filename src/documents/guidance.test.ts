import { describe, expect, it } from "vitest";
import { guidanceFor, guidanceText, isMismatch } from "./guidance";

describe("guidanceFor", () => {
  it("lists a fix for each missing part and explains the crop once, in the closing line", () => {
    expect(guidanceFor(["The document is cropped", "Name is missing", "Pay period is missing"])).toEqual({
      title: "2 things to fix",
      fixes: ["Your name: the top of the stub is cut off", "Pay period: the dates are cut off"],
      closing: "Retake the photo with the whole stub in the frame, flat and in good light.",
    });
  });

  it("lists a crop on its own when nothing else says what is missing", () => {
    expect(guidanceFor(["The document is cropped"])).toMatchObject({ title: "1 thing to fix", fixes: ["The document is cropped"] });
  });

  it("points to the documents on the page when the document itself is wrong or old", () => {
    expect(guidanceFor(["Not a document that works for this DMI"])).toMatchObject({
      closing: "Choose one of the documents listed on the page.",
    });
  });

  it("gives the mismatch fix for a name or SSN that does not match the application, naming nobody", () => {
    const expected = {
      title: "1 thing to fix",
      fixes: ["This document doesn't appear to be yours: the name or Social Security number doesn't match your application."],
      closing: "Upload one of the documents listed below that shows your name.",
    };
    expect(guidanceFor(["The name does not match the Client"])).toMatchObject(expected);
    expect(guidanceFor(["The SSN ending 1234 does not match the application"])).toMatchObject(expected);
    expect(JSON.stringify(guidanceFor(["The SSN ending 1234 does not match the application", "Pay is missing"]))).not.toContain("1234");
    expect(guidanceFor(["The name does not match the Client", "Pay is missing"])).toMatchObject(expected);
  });

  it("flags a mismatch so the follow-up can count it", () => {
    expect(isMismatch(["The name does not match the Client"])).toBe(true);
    expect(isMismatch(["Name is missing"])).toBe(false);
  });

  it("words the mismatch as a text, word for word", () => {
    expect(guidanceText(guidanceFor(["The name does not match the Client"])!)).toBe(
      "I checked your document. 1 thing to fix:\n1. This document doesn't appear to be yours: the name or Social Security number doesn't match your application.\n\nUpload one of the documents listed below that shows your name. Same link.",
    );
  });

  it("words the same fixes as a text", () => {
    const guidance = guidanceFor(["Name is missing"])!;
    expect(guidanceText(guidance)).toBe(
      "I checked your photo. 1 thing to fix:\n1. Your name: it isn't visible\n\nRetake the photo with the whole stub in the frame, flat and in good light. Same link.",
    );
  });
});
