/** The Client's phone. Messages only, and empty until the Assistant texts. */
export function PhoneSimulator() {
  return (
    <section className="phone" aria-label="Client phone simulator">
      <div className="phone-screen">
        <header className="phone-header">Messages</header>
        <div className="phone-thread" role="log" aria-label="Messages">
          <p className="phone-empty">No messages</p>
        </div>
      </div>
    </section>
  );
}
