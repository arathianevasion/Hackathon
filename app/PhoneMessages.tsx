"use client";

import { useEffect, useOptimistic, useRef } from "react";
import type { ClientId, Message } from "../src/contract";
import { PORTAL_LINK_BASE } from "../src/portal/portalLink";
import { openPortalLink, sendClientReply } from "./actions";

const PORTAL_LINK = new RegExp(`(${PORTAL_LINK_BASE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[A-Z0-9]+)`);

/** A text, with any Portal link in it tappable: it opens in the in-phone browser. */
function Bubble({ clientId, text, mine, standalone }: { clientId: ClientId; text: string; mine: boolean; standalone: boolean }) {
  return (
    <div className={mine ? "bubble mine" : "bubble"}>
      {text.split(PORTAL_LINK).map((part, i) =>
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

/** The Thread; with `pendingText` set, the Client's just-sent text and the Assistant's "Responding" typing bubble follow it. */
export function PhoneThread({
  clientId,
  messages,
  standalone,
  pendingText,
}: {
  clientId: ClientId | null;
  messages: Message[];
  standalone: boolean;
  pendingText: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const empty = messages.length === 0 && pendingText === null;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pendingText]);
  return (
    <div ref={ref} className={empty ? "phone-thread empty" : "phone-thread"} role="log" aria-label="Messages">
      {empty ? (
        <p className="phone-empty">No messages</p>
      ) : (
        clientId && (
          <>
            {messages.map((m) => (
              <Bubble key={m.id} clientId={clientId} text={m.text} mine={m.sender === "client"} standalone={standalone} />
            ))}
            {pendingText !== null && <Bubble clientId={clientId} text={pendingText} mine standalone={standalone} />}
            {pendingText !== null && (
              <div className="bubble typing" role="status" aria-label="Responding">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

/**
 * The Messages view: the Thread and the compose box. Send shows the text and
 * the typing bubble until the action resolves (and the refreshed Thread
 * arrives with the real messages), so a slow run never looks frozen.
 */
export function PhoneMessages({ clientId, messages, standalone }: { clientId: ClientId | null; messages: Message[]; standalone: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingText, setPendingText] = useOptimistic<string | null, string | null>(null, (_, next) => next);
  async function send(formData: FormData) {
    const typed = String(formData.get("text") ?? "").trim();
    if (typed === "") return;
    setPendingText(typed);
    formRef.current?.reset();
    await sendClientReply(formData);
  }
  return (
    <>
      <PhoneThread clientId={clientId} messages={messages} standalone={standalone} pendingText={pendingText} />
      {clientId && (
        <form ref={formRef} action={send} className="phone-compose" aria-busy={pendingText !== null}>
          <input type="hidden" name="clientId" value={clientId} />
          <input name="text" aria-label="Text message" placeholder="Text message" autoComplete="off" required />
          <button type="submit" className="primary">Send</button>
        </form>
      )}
    </>
  );
}
