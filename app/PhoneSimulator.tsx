import Link from "next/link";
import type { ClientId, Message } from "../src/contract";
import type { UploadPageState } from "../src/portal/uploadPage";
import { PhoneMessages } from "./PhoneMessages";
import { UploadPage } from "./UploadPage";

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
        <PhoneMessages clientId={clientId} messages={messages} standalone={standalone} />
      </div>
    </section>
  );
}
