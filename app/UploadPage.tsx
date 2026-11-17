"use client";

import { useRef, useState } from "react";
import type { UploadPageState } from "../src/portal/uploadPage";
import { comeBackLaterAction, uploadDocument } from "./actions";

/** The SPECIMEN pay stub example from variant D, with the parts a photo must show highlighted. */
function SpecimenStub() {
  return (
    <div className="stub" aria-label="SPECIMEN pay stub example">
      <div className="stub-row stub-hd">NORTHWIND FABRICATION LLC</div>
      <div className="stub-row"><span className="hl">Employee: Jordan Sample</span></div>
      <div className="stub-row"><span className="hl">Pay period: Oct 16 – Oct 31</span></div>
      <div className="stub-row"><span className="hl">Pay date: Nov 5</span><span>Biweekly</span></div>
      <div className="stub-row"><span>Hours 80.0</span><span>Rate 19.50</span></div>
      <div className="stub-row"><span className="hl">Gross pay</span><span className="hl">1,560.00</span></div>
      <div className="stub-row"><span>Net pay</span><span>1,347.84</span></div>
      <div className="stub-wm" aria-hidden="true">SPECIMEN</div>
    </div>
  );
}

/**
 * Variant D's upload page in the in-phone browser: first name, DMI type and
 * due date only. Picking a file uploads it at once; the page never shows it back.
 */
export function UploadPage({ token, state }: { token: string; state: UploadPageState }) {
  const form = useRef<HTMLFormElement>(null);
  const [choice, setChoice] = useState(state.kind === "expired" ? "" : state.copy.choices[0].label);
  // Sending lasts until the page's attempt count moves on, i.e. the upload has been checked.
  const [sendingAt, setSendingAt] = useState<number | null>(null);
  const attempt = state.kind === "expired" ? 0 : state.attempt;
  const sending = sendingAt === attempt;

  if (state.kind === "expired") {
    return (
      <div className="pg">
        <div className="status crit">
          <span className="t">This link has expired.</span>
          <span>Reply to our text and we&apos;ll send you a new one.</span>
        </div>
      </div>
    );
  }

  const { copy } = state;
  const head = (
    <>
      <div className="brand">Secure upload for Andrew&apos;s clients</div>
      <div>
        <h2 className="pg-title">{copy.title}</h2>
        <p className="due">For {state.firstName} · due <b>{state.due}</b></p>
      </div>
    </>
  );

  if (state.kind === "later") {
    return (
      <div className="pg">
        {head}
        <div className="status info">
          <span className="t">No problem. Come back any time before {state.due}</span>
          <span>When you have it, reply &quot;ready&quot; to our text and we&apos;ll send you a new link. If we don&apos;t hear from you, we&apos;ll check in.</span>
        </div>
        <p className="cap">For your security, this link is now closed. Nothing was sent to the Marketplace.</p>
      </div>
    );
  }

  if (state.kind === "submitted") {
    return (
      <div className="pg">
        {head}
        <div className="status info">
          <span className="t">Sent to the Marketplace</span>
          <span>Nothing else is needed from you. We&apos;ll text you when they&apos;re done.</span>
        </div>
      </div>
    );
  }

  const pick = () => {
    setSendingAt(attempt);
    form.current?.requestSubmit();
  };

  return (
    <div className="pg">
      {head}
      {state.fixes && !sending && (
        <div className="status warn" role="alert">
          <span className="t">{state.fixes.title}</span>
          <ul className="fixes">
            {state.fixes.fixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
          <span>{state.fixes.closing}</span>
        </div>
      )}
      <details>
        <summary>Why am I being asked?</summary>
        <p>
          {copy.why} If the Marketplace doesn&apos;t get it by {state.due}, your coverage or premium help could change.
        </p>
      </details>
      <fieldset className="doclist">
        <legend className="label">Choose one document</legend>
        {copy.choices.map((c) => (
          <label key={c.label} className={c.label === choice ? "docopt sel" : "docopt"}>
            <input type="radio" name="choice-view" value={c.label} checked={c.label === choice} onChange={() => setChoice(c.label)} />
            <span>
              <b>{c.label}</b>
              <br />
              <span className="muted">{c.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {state.dmiType === "income" ? (
        <>
          <SpecimenStub />
          <p className="cap">Example. Your photo must show the highlighted parts: {copy.must}.</p>
        </>
      ) : (
        <p className="cap">Your photo must show {copy.must}.</p>
      )}
      <form ref={form} action={uploadDocument} className="drop" aria-busy={sending}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="choice" value={choice} />
        <span className="big">Upload {copy.choices[0].label.toLowerCase()}</span>
        <span className="cap">Photo, JPG, PNG or PDF</span>
        {sending ? (
          <div className="status work" role="status">
            <span className="t">Checking your document…</span>
            <span>This takes a few seconds. You&apos;ll get a text with the result.</span>
          </div>
        ) : (
          <>
            <label className="button primary">
              Take a photo
              <input type="file" name="file" accept="image/*" capture="environment" onChange={pick} hidden />
            </label>
            <label className="button">
              Choose a file
              <input type="file" name="file" accept="image/jpeg,image/png,application/pdf" onChange={pick} hidden />
            </label>
          </>
        )}
      </form>
      {!sending && (
        <form action={comeBackLaterAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="button later">
            I&apos;ll come back later
          </button>
        </form>
      )}
    </div>
  );
}
