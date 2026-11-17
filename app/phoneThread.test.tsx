import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PhoneThread } from "./PhoneMessages";

vi.mock("next/navigation", () => ({ redirect: () => {}, useRouter: () => ({ refresh: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const CLIENT = "client-01" as never;
const sent = [{ id: "a", clientId: CLIENT, sender: "assistant", text: "Hi Rosa", sentAt: "2026-01-01T00:00:00Z" }] as never;
const render = (pendingText: string | null, messages = sent) =>
  renderToStaticMarkup(<PhoneThread clientId={CLIENT} messages={messages} standalone={false} pendingText={pendingText} />);

describe("phone thread while the Assistant is responding", () => {
  it("shows the Client's text at once, then a 'Responding' typing bubble with three dots below it", () => {
    const html = render("Here is my pay stub");
    expect(html).toContain('<div class="bubble mine">Here is my pay stub</div>');
    expect(html).toMatch(/role="status"[^>]*aria-label="Responding"/);
    expect(html.match(/class="typing-dot"/g)).toHaveLength(3);
    expect(html.indexOf("Here is my pay stub")).toBeLessThan(html.indexOf("Responding"));
  });

  it("shows no typing bubble and no extra bubble once nothing is pending", () => {
    const html = render(null);
    expect(html).not.toContain("Responding");
    expect(html).not.toContain("bubble mine");
  });

  it("shows the typing bubble in an otherwise empty Thread, not 'No messages'", () => {
    const html = render("hello", [] as never);
    expect(html).toContain("hello");
    expect(html).not.toContain("No messages");
  });
});
