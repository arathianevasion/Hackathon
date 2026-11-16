import type { ClientId, Message } from "../src/contract";
import { sendClientReply } from "./actions";

/** The Client's phone: the Messages view of their Thread. Empty until someone texts. */
export function PhoneSimulator({ clientId, messages }: { clientId: ClientId | null; messages: Message[] }) {
  return (
    <section className="phone" aria-label="Client phone simulator">
      <div className="phone-screen">
        <header className="phone-header">Messages</header>
        <div className={messages.length === 0 ? "phone-thread empty" : "phone-thread"} role="log" aria-label="Messages">
          {messages.length === 0 ? (
            <p className="phone-empty">No messages</p>
          ) : (
            messages.map((m) => (
              <p key={m.id} className={m.sender === "client" ? "bubble mine" : "bubble"}>
                {m.text}
              </p>
            ))
          )}
        </div>
        {clientId && (
          <form action={sendClientReply} className="phone-compose">
            <input type="hidden" name="clientId" value={clientId} />
            <input name="text" aria-label="Text message" placeholder="Text message" autoComplete="off" required />
            <button type="submit">Send</button>
          </form>
        )}
      </div>
    </section>
  );
}
