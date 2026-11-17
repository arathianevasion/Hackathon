/**
 * Brings the top of the upload page into view. In the in-phone browser the page
 * sits in a scrolling `.br-body`; on the real phone's `/r/<token>` page the
 * window scrolls as well.
 */
export function scrollFeedbackIntoView(page: Pick<Element, "closest">, win: Pick<Window, "scrollTo">): void {
  page.closest(".br-body")?.scrollTo({ top: 0, behavior: "smooth" });
  win.scrollTo({ top: 0, behavior: "smooth" });
}
