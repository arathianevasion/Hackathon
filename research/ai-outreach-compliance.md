# Compliance limits on AI-assisted Client outreach (research for issue #3)

Research, not legal advice. Everything marked **[LEGAL REVIEW]** is uncertain or interpretive and needs counsel before any real (non-POC) deployment. The POC uses synthetic data and mocked channels, so none of this blocks the build; it shapes the spec.

Vocabulary: Agent, Assistant, Client, Member, DMI per `GLOSSARY.md`.

Method: primary sources only (eCFR text, CMS guidance PDFs, FCC order). Regulatory text was re-pulled from eCFR (current as of 2026-11); CMS PDFs were read from the CMS site. Sources that could not be fetched are listed at the end. CMS FAQs and slides are guidance, not law: the CMS slide deck itself says it "does not have the force and effect of law" unless incorporated into a contract.

## Short answer

1. **No source bans an Assistant from contacting Clients, but the Assistant works under the Agent's licence and the Agent carries the compliance duty.** The Agent must hold documented, unrescinded consumer consent that covers the action (scope, purpose, duration, rescission process), kept 10 years.
2. **Consent for DMI work can be set up once.** CMS says an Agent may rely on consent given at enrollment that allows checking application status "throughout the year to help resolve data matching issues", while unexpired and unrescinded. Anything that changes the application or plan needs consent that covers it, plus a documented Client review and confirmation before submission.
3. **Hard prohibition on automating CMS systems.** 45 CFR 155.220(j)(2)(vi): no "scripting and other automation of interactions with CMS Systems or the Direct Enrollment Pathways" without advance written CMS approval. An Assistant submitting to the real Marketplace programmatically hits this. Mocked in the POC, but it is the main real-world blocker. **[LEGAL REVIEW]** on how it applies to an approved EDE partner's own API flow versus the Agent's use of the Assistant.
4. **Voice is the high-risk channel.** FCC 24-17 holds that AI-generated voices are an "artificial voice" under the TCPA, so voice calls need prior express consent (written if telemarketing). Text/email/portal messages are lower risk but still need consent and opt-out handling. No source found requires telling the Client "you are talking to an AI" for these messages, but identification rules apply to artificial-voice calls, and misleading the Client is barred by the standards of conduct. Recommend disclosing anyway.
5. **Human Agent in the loop** for: obtaining/confirming consent, anything the Client must attest (income projections, application review and confirmation), submitting changes to the Marketplace, and giving advice that goes beyond explaining requirements. The Assistant can autonomously: rank DMIs, send consented reminders, explain what documents are needed, receive and pre-check documents, and report/escalate. Details in the matrix below.

## 1. Who is regulated, and what binds the Assistant

The Assistant is not a licensed party. The rules in 45 CFR 155.220(j) bind the agent, broker or web-broker, so the Assistant's acts are the Agent's acts for compliance. Design consequence: the Assistant must be able to prove, for every outreach and submission, which consent record authorised it.

Relevant standards of conduct (45 CFR 155.220(j)(2), eCFR: https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-C/section-155.220):

- (i) provide correct information, without omission of material fact; no misleading or coercive conduct.
- (iii) obtain and document consumer consent before assisting with enrollment or APTC/CSR applications (see section 2).
- (iv) protect consumer PII per 155.260(b)(3) and the 155.260(b)(2) agreement (see section 4).
- (v) comply with all applicable Federal and State laws (this is how TCPA and state rules ride in).
- (vi) no scripting or other automation of interactions with CMS Systems or Direct Enrollment Pathways without advance written CMS approval.
- (ii)(B)-(D): the phone number, email and mailing address on the application must belong to the consumer, not the Agent or agency. An Assistant's own phone number, shared inbox or agency address cannot be entered as Client contact details.
- (ii)(E): household income projections "must be calculated and attested to by the consumer". The Agent "may answer questions posed by the consumer related to household income projection, such as helping the consumer determine what qualifies as income".

## 2. Consent requirements

### 2a. CMS/Marketplace consent (agent-to-Client relationship)

Source: 45 CFR 155.220(j)(2)(iii); CMS "Frequently Asked Questions: Consumer Consent & Application Review Requirements", published June 2024 (https://cms.gov/files/document/frequently-asked-questions-consumer-consent-application-review-requirements.pdf).

- Consent must come from an action by the consumer that "produces a record that can be maintained and produced" (155.220(j)(2)(iii)(A)).
- The record must state the **scope, purpose and duration** of the consent, the date, the consumer's name, the name of the agent/agency granted consent, and a **process to rescind** (155.220(j)(2)(iii)(B); FAQ 15).
- Retention: at least **10 years**, produced to CMS on request (155.220(j)(2)(iii)(D)).
- Acceptable forms before 2028: signature (electronic or not), audio-recorded verbal confirmation, or a consumer reply to an electronic communication (155.220(j)(2)(iii)(A)). FAQ 15 adds that recorded calls, text messages, emails or a signed e-consent form can work, and unrecorded verbal consent does not.
- **Plan years beginning 1 Jan 2028 onward:** documentation must be collected on an HHS-approved/created consent form, an email from the consumer or a recorded verbal conversation, and "a signature that is simply typed on the documentation or a filled-in check box does not properly indicate consent" (155.220(j)(2)(iii)(C)). I only read the start of (C) and the closing sentence of the following clause in the eCFR text; **verify the exact wording of (C)**. Relevant to a 2027 POC spec only as a forward note.
- No fixed duration: the Agent and Client choose it (FAQ 5). The Client can rescind at any time.
- Actions needing documented consent (FAQ 2): collecting PII for quotes, person search in Classic DE/EDE, helping with an application, enrolling, **making updates to an application**, and **checking application or coverage status**.
- **Key enabler for DMI outreach (FAQ 2 and 3):** a consent agreed at enrollment that allows checking application status throughout the year to help resolve DMIs can be relied on, as long as unexpired and unrescinded, without a new consent per check. Checking status is not the same as changing the application. FAQ 2: "Agents, brokers, and web-brokers must never change a consumer's eligibility application information or plan selection without documenting that the consumer consented to the change."
- Application review (155.220(j)(2)(ii); FAQ 1 and 14): before submitting a new application or an update, the Agent must document that the Client reviewed and confirmed accuracy and that the attestations were explained. Recorded call, written reply, or signed document qualify; a bare unrecorded verbal confirmation does not.

Spec implication: the consent record is a first-class object the Assistant checks before every action (exists, covers this action, not expired, not rescinded). Collecting it, and the review/confirmation record, should be a human-Agent-led step or a Client-initiated step the Assistant only records. **[LEGAL REVIEW]**: CMS guidance does not address whether an AI can present the consent request; the rule only requires that the Client takes an action that produces a record. A Client replying "yes" to an Assistant-sent message is the kind of electronic response CMS names, but whether the Agent's agency may delegate the *explanation* of attestations to an AI is not addressed in the sources I found.

### 2b. TCPA (outbound calls and texts)

Sources: 47 CFR 64.1200 (https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200); FCC 24-17 Declaratory Ruling, 2 Feb 2024 (https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf).

- **Voice (AI voice):** FCC 24-17 paras 1-2 and 9: "the TCPA's restrictions on the use of 'artificial or prerecorded voice' encompass current AI technologies that generate human voices", so such calls "require the prior express consent of the called party ... absent an emergency purpose or exemption". Voice cloning is included. Artificial/prerecorded-voice messages must also identify the responsible entity and give a callback number (64.1200(b)(1)-(2)); marketing or certain exempt calls also need an automated opt-out (64.1200(b)(3)).
- **Prior express written consent** is needed where the call "includes or introduces an advertisement or constitutes telemarketing" (64.1200(a)(2), (a)(3)); definition in 64.1200(f). **Open question: is a DMI reminder telemarketing?** A message that only tells an existing Client what documents the Marketplace needs is likely informational, but a message that mixes in plan, upsell or retention-marketing content could be treated as telemarketing. **[LEGAL REVIEW]**. Keep DMI messages strictly informational.
- **Texts:** the TCPA "call" covers text messages (64.1200(a)(9) text as read by my extraction; confirm paragraph cite). Revocation: any reasonable method, honoured within 10 business days; replies such as "stop", "quit", "revoke", "opt out", "cancel", "unsubscribe" are reasonable per se; a sender "may not designate an exclusive means" of revocation (64.1200(a)(10)). A DNC request must be honoured for 5 years and within 10 business days (64.1200(d)).
- **Calling hours:** telephone solicitations only 8 a.m. to 9 p.m. local time (64.1200(c)(1)). Applies to solicitations; apply as a conservative default for all outreach.
- **Healthcare exemption (64.1200(a)(9)(iv))** covers messages "by, or on behalf of, healthcare providers" with strict content/length/frequency caps (one message per day, three per week; texts of 160 characters or fewer). Insurance Agents are not obviously "healthcare providers". **Do not rely on this exemption. [LEGAL REVIEW]**
- **One-to-one consent rule is gone.** The FCC's 2023 rule tightening written consent was vacated by the Eleventh Circuit in *Insurance Marketing Coalition v. FCC*, No. 24-10277 (11th Cir. 24 Jan 2025). I read this only through law-firm summaries of the opinion (search results), not the opinion itself. Verify before relying. Practical effect: the older "prior express (written) consent" standard stands. State "mini-TCPA" laws can be stricter and I have not covered them. **[LEGAL REVIEW]**
- Consent scope: the Agent's CMS consent (2a) is not automatically TCPA consent. Capture phone/text/email channel consent explicitly, per channel, in the same consent record. Recommendation, not a quoted requirement.

## 3. AI/automation disclosure

What the primary sources actually say:

- **No CMS or HHS rule found that requires telling the Client "this message is from an AI."** I found no CMS guidance on AI at all (the CMS agent/broker general-resources page had nothing on AI or automation).
- **Artificial-voice calls must identify the entity responsible** (64.1200(b)(1)) and FCC 24-17 para 9 reiterates that. That is entity identification, not an AI-label requirement, but an AI voice call is by definition an artificial-voice call, so it is effectively disclosed as automated, and it needs consent first.
- **155.220(j)(2)(i)** (no misleading conduct, no omission of material fact) means an Assistant that poses as a human Agent risks a violation. **[LEGAL REVIEW]** on whether "material fact" covers AI-ness.
- **State laws** on AI/chatbot disclosure and on insurance-producer communications exist and vary; I did not survey them. **[LEGAL REVIEW]** before real use.
- **Design recommendation (not a legal requirement found):** every Assistant message names the Assistant, states it is an AI working for the named licensed Agent, gives the Agent's contact route, and offers "talk to a person" and opt-out. Cheap to build, defends against the misleading-conduct risk.

## 4. PII handling for uploaded documents

Sources: 45 CFR 155.260 (https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-C/section-155.260); 155.220(j)(2)(iv); 45 CFR 160.103.

- Agents must "protect consumer personally identifiable information according to § 155.260(b)(3) and the agreement described in § 155.260(b)(2)" (155.220(j)(2)(iv)). That agreement is the Agent's contract with the Exchange (the CMS agent/broker agreement; I could not retrieve its text, see gaps).
- 155.260(a)(3)-(4): principles include collection and use limited to "only to the extent necessary to accomplish a specified purpose", safeguards against unauthorised access, and secure destruction per retention schedules. 155.260(b)(3): non-Exchange-entity standards must be "at least as protective" as the Exchange's own. 155.260(b)(2)(v): the contract must bind downstream entities to the same standards. Consequence: **the Assistant's model provider, storage and OCR vendors are downstream entities**, so the Agent must flow these terms to them. **[LEGAL REVIEW]**
- 155.260 has no breach-notification deadline of its own in the text I read; the closest is the principle that means "should be in place to report and mitigate non-adherence and breaches" (155.260(a)(3)(viii)). The real deadlines will be in the CMS agreement and state breach laws. **[LEGAL REVIEW]**
- Documents the Assistant receives (ID, immigration documents, pay stubs, tax returns) are sensitive PII. Minimum design stance: use only to resolve the DMI, collect nothing beyond what the DMI needs, encrypt, limit access, delete on a retention schedule (but keep consent records 10 years), do not use for model training, no PII in logs.
- **HIPAA:** The covered-entity and business-associate definitions are in 45 CFR 160.103. Health insurance issuers are health plans (covered entities). The text I read does not say whether an agent/broker is a covered entity (it neither includes nor excludes them). An Agent handling carrier data on a carrier's behalf could be a business associate, which would make the Assistant's AI provider a subcontractor needing a business associate agreement. Marketplace application data collected directly by the Agent is governed by 155.260, not obviously by HIPAA. **Uncertain. [LEGAL REVIEW]** I could not fetch the HHS HIPAA pages (HTTP 403), so no HHS guidance on cloud/AI vendors is cited.
- **Identity:** an Agent may "only use an identity that belongs to the consumer when identity proofing the consumer's account on HealthCare.gov" (155.220(j)(2)(vii)). The Assistant must never use or fabricate a Client identity to act in the Marketplace account.

## 5. DMI process facts that bound what the Assistant can promise

- Client has 90 days from the date of the eligibility notice to resolve a DMI; 95 days for citizenship/immigration DMIs (CMS Assister job aid "Resolving Data Matching Issues", v2.0 Feb 2026; exact URL not retained, find it on cms.gov). Regulation: 45 CFR 155.315(f)(2)(ii) (90 days from notice date); (f)(3) gives the Exchange discretion to extend if the applicant shows good-faith effort; 155.315(g) allows a case-by-case exception when documents do not exist (not for citizenship or immigration). This job aid is written for Navigators and CACs; the deadlines are Marketplace facts, but **the job aid is not agent-specific guidance**.
- The Marketplace itself sends 90/60/30-day reminders and phone calls and decides document sufficiency. The Assistant can check sufficiency only as a pre-check; the Marketplace's decision governs. Do not tell the Client a document "will be accepted".
- CMS/CCIIO DMI Office Hour slides, 15 Feb 2024 (https://www.cms.gov/files/document/data-matching-issues-dmi.pdf): "When possible, agents and brokers should upload documents directly on behalf of consumers"; otherwise explain how the Client uploads, or mails them. This supports the Assistant (for the Agent) uploading documents, subject to consent and the 155.220(j)(2)(vi) automation ban for the *mechanism*.
- Consequence of expiry: income DMI adjusts or removes financial assistance; citizenship or immigration DMI leads to loss of eligibility (same slide deck).
- Statement-of-income rule: the Client, not the Agent or Assistant, calculates and attests income (155.220(j)(2)(ii)(E)). A DMI whose fix is a changed income figure needs a human-supervised, Client-confirmed update.

## 6. Human-in-the-loop matrix

Basis: sections 1-5. "Autonomous" means the Assistant acts without a per-action Agent approval, but within consent that an Agent obtained, with an audit log. Items marked ? are my inference from the rules, not stated in any source. **[LEGAL REVIEW]** all rows before production.

| Action | Autonomous OK? | Why / condition |
|---|---|---|
| Rank DMIs by deadline from data the Agent is authorised to view | Yes | Internal, no Client contact. Needs consent for status checks (FAQ 2-3). |
| Check application/DMI status | Yes, if consent covers it | FAQ 2-3: pre-existing unexpired, unrescinded consent suffices. |
| Send informational DMI reminder (text/email/portal) | Yes, if channel consent exists | Informational only, no marketing; honour opt-out within 10 business days; sender and AI identified (recommendation). |
| AI voice call to Client | Only with documented prior express consent for voice | FCC 24-17; treat as highest risk. Suggest excluded from POC scope or human-gated. |
| Answer "what is needed / why / which documents suffice" | Yes, factual | Must be correct and not omit material facts (155.220(j)(2)(i)). Say the Marketplace decides sufficiency. No tax or immigration advice (?). |
| Help work out an income figure | No: assist only | Client must calculate and attest (155.220(j)(2)(ii)(E)); Agent may answer what counts as income. Assistant may explain what counts; Client states the number. |
| Receive documents | Yes | Subject to PII controls (section 4). |
| Pre-check a document (right type, legible, name matches) | Yes | Advisory only; never promise acceptance. |
| Obtain or renew consent, rescission handling | Human-led, or Client-initiated and recorded | Record must come from a Client action (155.220(j)(2)(iii)(A)). Rescission and DNC requests must be honoured automatically and immediately (Assistant should stop). |
| Submit documents to the real Marketplace | Needs Agent approval; real submission blocked unless CMS-approved automation | 155.220(j)(2)(vi). POC mocks this. In production, Agent-in-the-loop or approved EDE path. |
| Change application data or plan selection | No | Needs consent covering the change and documented Client review and confirmation before submission (FAQ 2, 14). |
| Special enrollment period request | No | Requires consumer authorization (155.220(j)(2)(viii)). |
| Escalate to Agent, report outcomes | Yes | Always available. Also on: opt-out, Client confusion, immigration or citizenship issues, deadline close, legal questions, suspected fraud (?). |

## 7. Sources

Primary, read directly:
- 45 CFR 155.220 (agent/broker standards of conduct): https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-C/section-155.220 (retrieved current text via eCFR API)
- 45 CFR 155.260 (privacy and security): https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-C/section-155.260
- 45 CFR 155.315 (verification, inconsistencies): https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-D/section-155.315
- 45 CFR 160.103 (HIPAA definitions): https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/subpart-A/section-160.103
- 47 CFR 64.1200 (TCPA rules): https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200
- FCC 24-17, Declaratory Ruling on AI voices under the TCPA, 2 Feb 2024: https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf
- CMS FAQ, Consumer Consent & Application Review Requirements, June 2024: https://cms.gov/files/document/frequently-asked-questions-consumer-consent-application-review-requirements.pdf
- CMS/CCIIO, DMI Office Hour slides, 15 Feb 2024: https://www.cms.gov/files/document/data-matching-issues-dmi.pdf
- CMS, Resolving Data Matching Issues (Assister job aid for Navigators/CACs), v2.0 Feb 2026 (exact URL not retained)
- CMS agent/broker resources page (to find the Model Consent Form, 2025-07, and Consumer Consent & Application Review Guide, 2024-01): https://www.cms.gov/marketplace/agents-brokers/general-resources

Secondary, used only to locate an event (verify against the primary):
- *Insurance Marketing Coalition v. FCC*, 11th Cir., Jan 2025: reported by many law-firm alerts; I did not read the opinion.

## 8. Gaps and what I could not verify

- Text of the CMS agent/broker **Marketplace agreement / privacy and security agreement** (the 155.260(b)(2) contract). Not found on the CMS resources page. This likely holds the breach reporting, subcontractor and offshore-storage terms that matter most for an AI vendor. Priority item for legal review.
- Any CMS or HHS guidance specifically on **AI, chatbots or automation by agents** beyond the 155.220(j)(2)(vi) ban. None found; absence of evidence, not confirmation that it is permitted.
- **HHS HIPAA guidance** (cloud/AI vendors, business associate status of agents): hhs.gov returned 403 to my fetch tool.
- **State law**: state insurance producer rules, state mini-TCPA, AI-disclosure and privacy statutes. Not covered.
- The CMS agent/broker FAQ site (agentbrokerfaq.cms.gov) may hold newer Q&As; not checked.
- Paragraph-level cites for 64.1200(a)(9)/(a)(10)/(d) and the 2028 consent text in 155.220(j)(2)(iii)(C) were taken from fetch summaries and a partial read; verify exact paragraph numbers.
- The FCC 24-17 file was read locally (paras 1-3, 8-9). Treat other paragraph references as approximate.
