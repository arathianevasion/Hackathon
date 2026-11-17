"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { phoneCookie } from "../src/phoneSwitch";

type PhoneState = { on: boolean; toggle: () => void };

const PhoneContext = createContext<PhoneState>({ on: true, toggle: () => {} });

/**
 * Holds whether the Client's phone shows, for the header's switch and the desk.
 * The choice is remembered in this browser's cookie, so the server renders it the same way after a reload.
 * With `?phone=off` the server leaves the simulator out, so switching on drops that parameter to bring it back.
 */
export function PhoneSwitchProvider({ initialOn, forcedOff, children }: { initialOn: boolean; forcedOff: boolean; children: ReactNode }) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const toggle = () => {
    const next = !on;
    setOn(next);
    document.cookie = phoneCookie(next);
    if (next && forcedOff) {
      const url = new URL(window.location.href);
      url.searchParams.delete("phone");
      router.replace(url.pathname + url.search);
    }
  };
  return <PhoneContext.Provider value={{ on, toggle }}>{children}</PhoneContext.Provider>;
}

/** The header's "Client's phone" switch. */
export function PhoneSwitch() {
  const { on, toggle } = useContext(PhoneContext);
  return (
    <button type="button" className="toggle" role="switch" aria-checked={on} onClick={toggle}>
      <span className="track" aria-hidden="true" />
      Client&rsquo;s phone
    </button>
  );
}

/** The queue, the case file and the phone column; the phone column takes no width while the switch is off. */
export function Desk({ children }: { children: ReactNode }) {
  const { on } = useContext(PhoneContext);
  return (
    <main id="desk" className={on ? "desk phone-on" : "desk"}>
      {children}
    </main>
  );
}
