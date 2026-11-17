import { describe, expect, it, vi } from "vitest";
import { scrollFeedbackIntoView } from "./scrollToTop";

describe("scrollFeedbackIntoView", () => {
  it("scrolls the browser body that holds the page back to the top, and the window too", () => {
    const body = { scrollTo: vi.fn() };
    const page = { closest: vi.fn(() => body) };
    const win = { scrollTo: vi.fn() };
    scrollFeedbackIntoView(page as never, win as never);
    expect(page.closest).toHaveBeenCalledWith(".br-body");
    expect(body.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("still scrolls the window when the page is not inside a browser body", () => {
    const win = { scrollTo: vi.fn() };
    scrollFeedbackIntoView({ closest: () => null } as never, win as never);
    expect(win.scrollTo).toHaveBeenCalled();
  });
});
