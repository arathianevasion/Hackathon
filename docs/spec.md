# DMI Assistant POC Spec

> Snapshot of the DMI Assistant POC Spec (rev 14, 2026-11-16) for agents working in this repo. Synthetic data only.

By the demo on Nov 17, 2026, an AI Assistant resolves ACA Data Matching Issues (DMIs) on an Agent's behalf, end to end, on synthetic data: it texts the Client, guides them to upload the right document, checks it, submits it to a mocked Marketplace, and hands the Agent only what needs a human.

## Goal and scope

The POC proves an AI Assistant can carry a DMI from notice to resolution with the Agent stepping in only when a human is required. It is a greenfield TypeScript app on the Claude API, with synthetic data and every external system mocked.

**Success criteria** (all must be visibly true in the demo)

1. The Assistant names the correct documents for that Client's DMI.
2. It flags an insufficient upload and says why.
3. The mocked Marketplace shows the DMI resolved.
4. The Agent view reflects everything with no extra Agent action.
5. The Assistant alerts the Agent when intervention is needed, with enough context to act.

**In scope:** ACA DMIs for the Client (primary Household member) on one ACA Enrollment; text conversation; the Portal link upload page; document checks; mocked Marketplace submission; the Agent view.

**Out of scope:** benefit activation, referrals, Medicare Advantage 2027 exits; all non-ACA lines; real data, real texting and real Marketplace integration; CRM record integration (placeholder link only); voice calls.

**Vocabulary** follows `GLOSSARY.md` in the repo: Agent (the licensed human), Assistant (the AI), Client, Household, Enrollment, DMI, Document, Consent record, Thread, Portal link, Escalation (Agent must act) and Notification (no action needed).

## Architecture

One Next.js (TypeScript) app with SQLite and polling; the Assistant is the Anthropic TypeScript SDK's Tool Runner (`betaZodTool`, `client.beta.messages.toolRunner`) on `claude-sonnet-5-5`, run once per Client event.

Screens and the cadence engine raise events; each event runs the Assistant once for that Client, and the Assistant reaches the document check, the mocked Marketplace and the database only through its tools. The model never decides timing or pass/fail. Conversation uses effort `low` for demo latency; extraction uses effort `medium` with structured outputs. Server-side refusal fallbacks (`fallbacks: "default"`) are on for the demo only.

## Tools and data model

The Assistant gets exactly ten tools, with guardrails enforced in tool code, and no tool can change an application.

| Tool | What it does | Guardrail in the tool |
| --- | --- | --- |
| `get_client` | Client record, minimized for the model | Only the fields the conversation needs |
| `list_open_dmis` | Open DMIs, ranked by deadline | — |
| `lookup_dmi_rules` | Deadline, documents that work, required fields per DMI type | — |
| `check_consent` | Confirms a Consent record covers the action | Runs before every action; result logged |
| `send_text` | Sends a text in the Thread | Refuses without consent or after opt-out; outbound filter blocks SSN-like numbers, income amounts and non-portal links |
| `create_portal_link` | Issues a new Portal link | Single-use, 72-hour expiry, max 3 per 24 hours |
| `precheck_document` | Runs the document check | Separate extraction call with no tools |
| `submit_documents` | Submits to the mocked Marketplace | Only after a sufficient result |
| `get_dmi_status` | Reads Marketplace status | — |
| `escalate_to_agent` | Raises an Escalation | Pauses the Assistant for that Client, except `client_asked_for_agent` |

**Not provided:** changing application data, requesting a special enrollment period, capturing consent, voice calls.

**Data model**

- **Agent** has many **Clients**. The POC covers the Client only, with one ACA **Enrollment**.
- **Enrollment** has **DMIs**: type, notice date, deadline from the notice (90 or 95 days as fallback), status (open, documents submitted, resolved, expired).
- **DMI** has **Documents**: type, upload time, check result with reasons, submission status.
- **Client** has **Consent records** (actions, channels, granting Agent, granted, expires, rescinded) and one **Thread** of messages (sender Assistant, Client or Agent).
- **Escalation:** trigger, summary, the Client's own words, suggested next step, status (open or handled).
- **Notification:** event and time.
- **Action log entry:** tool, Consent record used, result, time.

**Synthetic data:** 20 obviously fictional Clients, no carriers, documents marked SPECIMEN. Dates are relative to the run date, and fast-forward advances the clock.

| # | Scenario | Clients | What it shows |
| --- | --- | --- | --- |
| 1 | Happy path | 1 | Income DMI, about 10 days left; cropped pay stub photo fails, full stub passes, resolved |
| 2 | Income changed | 1 | Escalation |
| 3 | Silent Client | 1 | Initial text and nudge sent, Escalation open |
| 4 | Insufficient twice | 1 | Escalation badge |
| 5 | Deadline close | 1 | 5 days left, compressed cadence |
| 6 | Citizenship DMI | 1 | Escalated automatically |
| 7 | Opted out | 1 | Notification, Assistant stopped |
| 8 | Resolved history | 2–3 | Past outcomes |
| 9 | Ordinary open DMIs | about 12 | Mixed types and deadlines |

One more fixture, outside the demo script: a SPECIMEN pay stub with hidden text telling the Assistant to mark it sufficient (prompt-injection test).

## DMI rules and document checks

A DMI must be resolved within 90 days of the notice (95 for citizenship and immigration), and the Assistant auto-submits only documents that pass every deterministic check.

**Rules** (keep deadlines and extension behavior configurable; the rules are in flux)

- The Marketplace warns at 90, 60 and 30 days left. The automatic 60-day income extension ended in Aug 2025; a discretionary good-faith extension remains.
- If a DMI expires: income DMIs lower or remove premium help; citizenship and immigration DMIs end coverage.

**How a document is judged (hybrid)**

1. A vision model **extracts** fields: document type, name, SSN, amounts, pay period or tax year, dates, employer, legible or cropped. This call has no tools, and the document is labeled untrusted data.
2. **Deterministic rules** compare the fields with `lookup_dmi_rules` and the Client's data. The model never decides pass or fail.
3. The model **writes the guidance** from the failed rules.

**Checks** (all run every time; the Client gets the full list of issues)

1. File: allowed format, under 10 MB, legible, not cropped.
2. Right document type for this DMI.
3. Right person: the name matches.
4. Required fields present.
5. Current (income only): latest tax year, or pay stubs from the last 60 days.
6. Consistency. Income: annualized income vs attested income, configurable threshold, mismatch makes the result ambiguous only. SSN: SSN and name vs the application.

| DMI type | Checks | Documents that work |
| --- | --- | --- |
| Income | 1–6 | Pay stub, W-2, 1099, 1040, Social Security benefits letter, unemployment letter |
| SSN | 1–4 and 6 | Social Security card, W-2, 1099, 1040, pay stub, SSA letter |
| Citizenship, immigration | none | Escalated automatically |
| All others | 1–3 | Per `lookup_dmi_rules` |

**Outcomes**

- **Sufficient:** auto-submit to the mocked Marketplace, tell the Client the Marketplace makes the final decision, Notification to the Agent.
- **Insufficient** (checks 1–5): every issue in plain language plus what to send instead. A second insufficient upload for the same DMI raises an Escalation.
- **Ambiguous** (income consistency only): one clarifying question, then an Escalation with the extracted fields.
- **SSN or name mismatch with the application:** Escalation; the Client is not sent back for another document.

Extracted SSNs are masked to the last 4 digits everywhere: Thread, Agent view, action log.

## Autonomy and handover

The Assistant acts only under a checked Consent record, and hands the Agent anything that changes the application or needs judgment.

**Preconditions**

- Every action checks a Consent record first: it exists, covers this action, hasn't expired, hasn't been rescinded. Capturing consent is the Agent's job; in the POC the seed data carries it.
- Assumption to verify: the agency holds written CMS approval to automate document submission only (45 CFR 155.220(j)(2)(vi)). Marketplace submission stays mocked.

**Channels:** text for all conversation; the Portal link for uploads only; no voice. The Assistant says it is an AI working for the named Agent in its first text.

| Raises an Escalation (Agent must act; Assistant pauses) | Raises a Notification (no action) |
| --- | --- |
| Income, household or any application change | Documents submitted |
| Citizenship or immigration DMI | DMI resolved |
| Tax, immigration or legal advice request, or low confidence | Opt-out or consent rescinded (Assistant already stopped) |
| Document insufficient twice, or still ambiguous after one question | 3 Portal links sent in 24 hours |
| SSN or name mismatch with the application |  |
| Suspected fraud or inconsistent documents |  |
| Client silent through the nudge schedule |  |

Every Escalation carries the trigger, a summary, the Client's own words and a suggested next step.

An Escalation pauses the Assistant, except one: `client_asked_for_agent`. The Client said yes to having the Agent contact them about a topic unrelated to their DMI (see "Unrelated topics" below). The Agent must act on it, but nudges, the upload page and replies about the DMI carry on as before, the upload page does not switch to "Your agent will contact you", and "Mark handled" closes it and changes nothing else.

**Nudge schedule** (a deterministic cadence engine decides timing; the model never does)

| Days left on the DMI | Nudge (fresh Portal link) | Escalation and pause |
| --- | --- | --- |
| More than 14 | Day 3 after the last contact | Day 7 |
| 14 or fewer | Day 1 | Day 2 |

- A Client reply that they have the document ("ready") gets a fresh link and cancels the scheduled nudge.
- No nudges while an Escalation is open, except `client_asked_for_agent`.
- **A silence Escalation closes when the Client comes back before the DMI deadline.** If `silence` is the Client's only open pausing Escalation and the deadline has not been reached, a text from the Client (not STOP or START) or an upload closes it as handled, and the Assistant then handles that text or upload as usual. The Agent gets a Notification (no action needed) saying the Client came back by text or by upload and the Escalation is closed. The nudge schedule counts from that text or upload, so a later silence can escalate again. On or after the deadline, or with any other pausing Escalation open, nothing changes: the Escalation stays open, the Assistant stays paused and the upload page says "Your agent will contact you".
- When the Agent texts in the Thread, the Assistant holds its replies and nudges for that Client until the Agent hands back. If an Escalation is still open then, the Assistant stays paused until the Agent marks it handled.
- After an opt-out, nobody texts the Client from this number, the Agent included, until the Client replies START.
- If the Agent says "keep trying": one reminder before each of the Marketplace's 60-day and 30-day warnings.
- Texts go out only within consent and quiet hours.

## Client conversation

The Client never leaves their phone: short texts carry the conversation, and the Portal link opens a helpful upload page in the phone's browser (variant D, [prototype](https://claude.ai/artifact/RNhpgCiqRFQgdoRazFjBEb)).

**Texts**

- One or two lines each. The first text names the AI, the Agent, the DMI, the due date and the link, plus "Reply STOP to opt out".
- Answers to "why?" are a sentence or two and point to the page.
- No personal data in any text. If the Client texts an SSN, it is masked to the last 4 before storage or the model sees it, never repeated, and the Client is asked to use the link.
- The AI disclosure repeats after 7 or more quiet days, and whenever the Client asks.
- A topic unrelated to the DMI gets the unrelated-topic text (below); it raises no Escalation by itself.
- Texts the Agent sends from the Thread come from the same number and start with "Andrew here:" (the Agent's first name), so the Client knows a person is writing.

**Unrelated topics** (for example dental coverage, a billing question, a different policy). The model picks the fixed wording; it never writes its own (ADR 0001). After 7 quiet days it opens with the AI disclosure, like the other replies.

> Thanks for asking! I can only help with the document the Marketplace asked for, so I can't answer that here. Want Andrew, your licensed agent, to contact you about it? Just reply yes and I'll pass it on.

- A clear yes to that offer raises a `client_asked_for_agent` Escalation: the summary says what the Client asked about, the Client's own words are the unrelated message (not the "yes"), and the suggested next step is to call the Client about their question, which isn't about their DMI. It does not pause the Assistant. The Client then gets:

> Done. Andrew will contact you about it. Your document for the Marketplace is still due, and your link still works: {link}

- A question about the DMI after the unrelated-topic text gets the existing "why" or "ready" wording with a Portal link.
- A "no", or silence, raises nothing, and the DMI follow-up carries on.
- **Link reuse:** the link in the confirmation, and in a "why" or "ready" reply after the unrelated-topic text, is the Client's current Portal link for the DMI if it is still live (not used, not expired, not closed). Otherwise it is a fresh one, which counts toward the 3-per-24-hours limit.

**Upload page** (same page on every attempt)

- Shows only the first name, DMI type and due date.
- "Why am I being asked?", a choice of documents that work, and a SPECIMEN example with the required parts highlighted.
- "Take a photo" (primary) or "Choose a file".
- After a failed check: the list of fixes. Never shows the Client's photo back.
- "I'll come back later" before or after an upload.

**Coming back later**

1. The Client taps "I'll come back later", or says so by text.
2. The link closes (single-use) and the page says: reply "ready" for a new link; we'll check in if we don't hear from you.
3. The Assistant confirms by text and says when it will check in.
4. "ready" gets a fresh link and cancels the nudge. Silence follows the nudge schedule, each nudge carrying a fresh link.

**Link states:** an expired link shows "This link has expired. Reply to our text and we'll send you a new one." A paused DMI (a pausing Escalation open) shows "Your agent will contact you" and asks for no upload, except when `silence` is the only open Escalation and the DMI deadline has not been reached: then the page is the normal upload form.

In the demo app the phone is a simulator: a Messages view and an in-phone browser, with "Done" returning to Messages.

## Agent view

The Agent sees one ranked Client queue with a detail panel, so what needs them is at the top without opening anything (variant A, [prototype](https://claude.ai/artifact/RXTbFDbFct2rZc8KqEy6ha)).

- **Sign-in:** mocked single sign-on with a one-time code.
- **Page title:** "Your Enrollment Follow-ups".
- **Totals at the top** (for example Escalations open, due soon, submitted, resolved) filter the list when clicked.
- **Queue:** Clients ranked by urgency and deadline, with DMI type, days left and at-risk badges.
- **Detail panel** for the selected Client:
  - **Handoff card** for an open Escalation: trigger, summary, the Client's own words, suggested next step, and a way to mark it handled.
  - The **Thread**, with a message box under it. The Agent can text the Client from it at any time, whether or not an Escalation is open. The handoff card's "Reply in Thread" jumps to it.
  - While the Agent is in the Thread, a banner says the Assistant is holding its replies and nudges for this Client, with "Hand back to the Assistant". The queue shows "You're in the Thread" for that Client.
  - A Client who opted out gets no message box, only a note to call instead.
  - The **action log**: every tool call with the Consent record that authorized it.
  - Notifications for this Client.
  - "View CRM record" as a placeholder link.
- Styled with the Integrity design system: Lato for text, Inter for data, royal blue for action, navy chrome, light only.

## Security

The POC shows the real user flow, including every security step a Client or Agent would see; back-end controls that no one sees are written down as production requirements. The standard is 45 CFR 155.260 via the agent/broker agreement, with ARC-AMPE used as a checklist.

| Control | POC builds | Production needs |
| --- | --- | --- |
| Portal link | Single-use, 72-hour expiry (configurable), reissued with every text, opens a 30-minute upload session, max 3 per 24 hours then a Notification | Same |
| Upload page | Shows first name, DMI type and due date only; never shows a document back | Same |
| Texts | Outbound filter for SSN-like numbers, income amounts, non-portal links; inbound SSNs masked to last 4 | Same |
| AI disclosure | First text, after 7+ quiet days, on request | Same |
| Agent sign-in | Mocked SSO with a one-time code | Real SSO with MFA; Agents see only their own Clients |
| Model data | Minimized Client data; extraction is a separate call with no tools; Client text and documents labeled untrusted | Zero data retention; documents sent inline (Files and Batch APIs aren't eligible); no personal data in structured-output schemas; drop refusal `fallbacks` unless confirmed covered |
| Prompt injection | One SPECIMEN fixture with hidden instructions | Ongoing OWASP LLM01 / LLM06 testing |
| Vendors | — | Agreements with the AI, texting and hosting vendors (downstream entities) |
| Storage | Local SQLite, synthetic data | Encryption in transit and at rest |
| Incidents | — | 1-hour breach-reporting runbook |

**Auto-submit stays.** The Assistant remains a standalone agency tool, not part of an enhanced direct enrollment (EDE) platform.

## Demo and build plan

A live 10-minute demo for product peers and leadership, with a recorded backup, walks two scripted paths that hit all five success criteria.

**Demo script**

1. **Agent view:** Clients ranked by deadline, with at-risk badges.
2. **Happy path (Rosa, income DMI, about 10 days left):** first text; Rosa asks why; she uploads a cropped pay stub photo and the page lists both fixes; she taps "I'll come back later", texts "ready" that evening, uploads the full stub; it is auto-submitted; fast-forward; the mocked Marketplace shows resolved.
3. **Intervention path (Marcus):** Marcus says his pay dropped after a job change; the Assistant escalates and pauses; the handoff card appears on the Agent view.
4. **Back on the Agent view:** both outcomes, nothing done by hand except the intervention.

Other triggers (insufficient twice, silent Client, citizenship DMI, opt-out) show only as badges in the queue.

**Workstreams** (after the shared contract: TypeScript types for the data model, tool signatures, event names)

| Workstream | Builds |
| --- | --- |
| A. Assistant | Tool Runner loop, prompts, tools and guardrails, Escalations and Notifications, cadence engine |
| B. Data and documents | Seed generator (20 Clients, 9 scenario groups), SPECIMEN documents, extraction plus rules, mocked Marketplace, action log |
| C. UI | Agent view, phone simulator with in-phone upload page, demo controls (fast-forward, reset, scenario jump) |

**Cutline if behind, in order:** fast-forward, the ambiguous-document path, the opt-out scenario, the action-log view. The two scripted paths and the five success criteria are never cut.

## Open questions

None of these blocks the POC; they block a real rollout.

**For the team, before the build**

- [ ] Should the happy-path demo include "I'll come back later" and "ready", or keep the shorter upload-fails-then-passes script? (The spec above includes it; it adds about a minute.)

**For counsel** (research is not legal advice)

- [ ] The CMS agent/broker agreement text: breach-reporting deadline (sources conflict between 1 hour and 24/72 hours; plan for 1 hour), downstream-entity clause, offshore storage.
- [ ] Whether the data is PHI and needs a business associate agreement.
- [ ] State data-security and AI-disclosure laws.
- [ ] How long to keep uploaded documents.
- [ ] Whether reading data from an EDE partner counts as adding functionality.
- [ ] Whether the Claude Usage Policy's human-review rule for high-risk recommendations covers auto-submit.
- [ ] Confirm the agency's written CMS approval to automate document submission.

**Still unknown**

- How long the Marketplace takes to review submitted documents (texts promise no date until this is known).
- How the real platform would expose DMI and enrollment data.
- How to measure the retention impact after the POC.
- Consent and channel rules for real outreach.
- Extending the model beyond ACA.

## Sources

Each decision's full detail lives in its ticket on the [map](https://github.com/arathianevasion/Hackathon/issues/1).

| Decision | Ticket | Supporting material |
| --- | --- | --- |
| ACA DMI rules | [#2](https://github.com/arathianevasion/Hackathon/issues/2) | [research/aca-dmi-rules](https://github.com/arathianevasion/Hackathon/blob/research/aca-dmi-rules/research/aca-dmi-rules.md) |
| Compliance limits on AI outreach | [#3](https://github.com/arathianevasion/Hackathon/issues/3) | [research/ai-outreach-compliance](https://github.com/arathianevasion/Hackathon/blob/research/ai-outreach-compliance/research/ai-outreach-compliance.md) |
| Demo scenario and success criteria | [#4](https://github.com/arathianevasion/Hackathon/issues/4) | — |
| Synthetic data model and scenarios | [#5](https://github.com/arathianevasion/Hackathon/issues/5) | — |
| Document sufficiency | [#6](https://github.com/arathianevasion/Hackathon/issues/6) | — |
| Client conversation | [#7](https://github.com/arathianevasion/Hackathon/issues/7) | [prototype](https://claude.ai/artifact/RNhpgCiqRFQgdoRazFjBEb), branch `prototype/client-conversation` |
| Assistant autonomy and escalation | [#8](https://github.com/arathianevasion/Hackathon/issues/8) | — |
| Agent view | [#9](https://github.com/arathianevasion/Hackathon/issues/9) | [prototype](https://claude.ai/artifact/RXTbFDbFct2rZc8KqEy6ha), branch `prototype/agent-view` |
| Architecture and work split | [#10](https://github.com/arathianevasion/Hackathon/issues/10) | — |
| Security and risk | [#11](https://github.com/arathianevasion/Hackathon/issues/11) | — |
| Security standards | [#12](https://github.com/arathianevasion/Hackathon/issues/12) | [research/security-standards](https://github.com/arathianevasion/Hackathon/blob/research/security-standards/research/security-standards.md) |

Vocabulary: [GLOSSARY.md](https://github.com/arathianevasion/Hackathon/blob/main/GLOSSARY.md).
