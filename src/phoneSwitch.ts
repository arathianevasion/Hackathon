/** The cookie that remembers, per browser, whether the Agent view shows the Client's phone. */
export const PHONE_COOKIE = "client-phone";

const ONE_YEAR_S = 365 * 24 * 60 * 60;

/** Whether the Agent view shows the Client's phone: `?phone=off` hides it, otherwise this browser's last choice, on by default. */
export function phoneShown(param: string | undefined, cookie: string | undefined): boolean {
  if (param === "off") return false;
  return cookie !== "off";
}

/** The `document.cookie` assignment that remembers the switch's position in this browser. */
export function phoneCookie(on: boolean): string {
  return `${PHONE_COOKIE}=${on ? "on" : "off"}; path=/; max-age=${ONE_YEAR_S}; samesite=lax`;
}
