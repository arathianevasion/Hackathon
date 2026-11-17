import Link from "next/link";
import type { ClientId, Message } from "../src/contract";
import { PORTAL_LINK_BASE } from "../src/portal/portalLink";
import type { UploadPageState } from "../src/portal/uploadPage";
import { openPortalLink, sendClientReply } from "./actions";
import { UploadPage } from "./UploadPage";

const PORTAL_LINK = new RegExp(`(${PORTAL_LINK_BASE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[A-Z0-9]+)`);

/** A text, with any Portal link in it tappable: it opens in the in-phone browser. */
function Bubble({ clientId, message, standalone }: { clientId: ClientId; message: Message; standalone: boolean }) {
  return (
    <div className={message.sender === "client" ? "bubble mine" : "bubble"}>
      {message.text.split(PORTAL_LINK).map((part, i) =>
        i % 2 === 1 && standalone ? (
          // On a real phone the link is a plain link to the upload page's URL on this server.
          <a key={i} className="bubble-link" href={`/r/${part.slice(PORTAL_LINK_BASE.length)}?client=${encodeURIComponent(clientId)}`}>
            {part}
          </a>
        ) : i % 2 === 1 ? (
          <form key={i} action={openPortalLink} className="bubble-link">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="url" value={part} />
            <button type="submit">{part}</button>
          </form>
        ) : (
          part
        ),
      )}
    </div>
  );
}

/**
 * The Client's phone: the Messages view of their Thread, or the in-phone
 * browser on a Portal link's upload page, with "Done" back to Messages.
 */
export function PhoneSimulator({
  clientId,
  messages,
  browser,
  standalone = false,
}: {
  clientId: ClientId | null;
  messages: Message[];
  browser: { token: string; state: UploadPageState } | null;
  /** On the Client's real phone (`/phone`): full-screen, no frame, Portal links are real links. */
  standalone?: boolean;
}) {
  if (clientId && browser) {
    return (
      <section className="phone" aria-label="Client phone simulator">
        <div className="phone-screen">
          <div className="br-bar">
            <Link href={`/?client=${clientId}`} className="br-done">
              Done
            </Link>
            <span className="br-url">
              <svg className="lock" width="9" height="11" viewBox="0 0 9 11" aria-hidden="true">
                <rect x="0.5" y="4.5" width="8" height="6" rx="1.2" />
                <path d="M2.3 4.5V3a2.2 2.2 0 0 1 4.4 0v1.5" />
              </svg>
              portal.example/r/{browser.token}
            </span>
          </div>
          <div className="br-body">
            <UploadPage token={browser.token} state={browser.state} />
          </div>
          <div className="br-foot">Secure upload · this page shows no personal information</div>
        </div>
      </section>
    );
  }
  return (
    <section className={standalone ? "phone standalone" : "phone"} aria-label="Client phone simulator">
      <div className="phone-screen">
        <header className="phone-header">Messages</header>
        <div className={messages.length === 0 ? "phone-thread empty" : "phone-thread"} role="log" aria-label="Messages">
          {messages.length === 0 ? (
            <p className="phone-empty">No messages</p>
          ) : (
            clientId && messages.map((m) => <Bubble key={m.id} clientId={clientId} message={m} standalone={standalone} />)
          )}
        </div>
        {clientId && (
          <form action={sendClientReply} className="phone-compose">
            <input type="hidden" name="clientId" value={clientId} />
            <input name="text" aria-label="Text message" placeholder="Text message" autoComplete="off" required />
            <button type="submit" className="primary">Send</button>
          </form>
        )}
      </div>
    </section>
  );
}
