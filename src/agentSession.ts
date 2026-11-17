/** The Agent view's mocked single sign-on: any session holding the demo's one-time code is signed in. */
export const DEMO_CODE = "246810";
export const SESSION_COOKIE = "agent-session";
export const SESSION_VALUE = "signed-in";

export function codeAccepted(entered: string): boolean {
  return entered.trim() === DEMO_CODE;
}
