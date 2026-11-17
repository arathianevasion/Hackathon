import { DEMO_CODE } from "../src/agentSession";
import { signIn } from "./actions";

/** The mocked single sign-on screen: the Agent enters the one-time code. */
export function SignIn({ wrong }: { wrong: boolean }) {
  return (
    <main className="page signin">
      <form action={signIn} className="signin-card">
        <h1>Sign in</h1>
        <p className="muted">Single sign-on, mocked for the demo. Enter your one-time code.</p>
        <label>
          <span className="label">One-time code</span>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus />
        </label>
        {wrong && <p className="error" role="alert">That code didn&rsquo;t match. Try again.</p>}
        <button type="submit" className="primary">Sign in</button>
        <p className="muted">Demo code: <span className="data">{DEMO_CODE}</span></p>
      </form>
    </main>
  );
}
