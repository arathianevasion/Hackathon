# Security standards and data-handling facts (research for issue #12)

**Research input, not legal or compliance advice.** It feeds the grilling in #11. Items marked **[UNCERTAIN]** are conflicting, in flux, or unverified. The POC uses synthetic data only, so nothing here blocks the build. It shapes what the spec writes down as requirements for a real build.

Vocabulary (Agent, Assistant, Client, Document, Thread, Consent record, Escalation, Notification) follows `GLOSSARY.md`. Researched 14 Nov 2026 from primary sources only. Where a CMS PDF could only be read from a CMS-hosted copy, or a page carried no date, this file says so. Builds on `research/ai-outreach-compliance.md` (branch `research/ai-outreach-compliance`, #3), which this file does not repeat.

## Answers at a glance

| # | Question | Answer | Minimum-friction implication |
|---|---|---|---|
| 1 | Which CMS standard applies | An Agent signs the CMS agent/broker privacy and security agreement, which binds them to the 45 CFR 155.260 standards. CMS's control catalog is now **ARC-AMPE** (replaced MARS-E and the NEE GRC framework in March 2025; compliance date 4 Mar 2026). For an agent/broker entity, ARC-AMPE is **recommended, not mandatory**. It becomes **mandatory** when the entity hosts an EDE environment, or adds functionality to an EDE partner's environment ("Hybrid Non-Issuer Upstream EDE Entity"). The AI vendor, hosting and SMS providers are **downstream entities**: the Agent must bind them to the same privacy and security standards (155.260(b)(2)(v)). | Keep the Assistant a **standalone tool of the Agent's agency** that does not modify or plug into an EDE platform, and keep submission human-mediated or mocked. That keeps the build in the "recommended" tier. Use ARC-AMPE as the checklist, not a gate. Have a written vendor agreement (Anthropic DPA, SMS provider terms) that flows down the 155.260 obligations. |
| 2 | Claude API data terms | Commercial Terms: Anthropic "may not train models on Customer Content". Privacy center: API inputs and outputs are deleted within **30 days** by default. **ZDR** is available per organization through sales. Flagged content can be kept up to 2 years, and safety scores longer, under any arrangement. A self-serve **BAA / HIPAA-ready** mode exists for PHI. `claude-sonnet-5-5` is not a "Covered Model" (those need 30-day retention). The Usage Policy (effective 12 Nov 2026) **requires AI disclosure** for consumer-facing agents, and requires human review for "High-risk AI Recommendations", which include public-benefit eligibility. | Use the plain Messages API, with images and PDFs sent **inline** (not the Files API or Batch API, which store data). Ask for ZDR for production. Keep Client PII out of JSON schemas. Open every Thread with "I'm an AI assistant working for [Agent]". The extract-then-deterministic-rules design from #6 already keeps the model from making the eligibility decision. |
| 3 | Identity on the portal link | The closest CMS benchmark is EDE Change Request 109 (Aug 2026). To capture a Client's authorization of an agent, CMS accepts a **"one-time passcode or one-time confirmation link"** sent by text, email or automated call to the contact details on the application. Each link or code must be **single use and expire within 15 minutes**, with **no more than 3 notifications in 24 hours**. NIST SP 800-63-4 (final July 2025): SMS is a **"restricted"** authenticator, email **SHALL NOT** be used for out-of-band authentication, and knowledge-based verification **SHALL NOT** be used for identity verification. | A single-use, short-lived signed link sent to the Client's own number on file meets the same bar CMS accepts for something riskier (authorizing an agent). **Do not add a date-of-birth or last-4 question.** NIST disfavours it, it adds friction, and it means showing or collecting more PII. Make the portal **upload-only**: it shows no PII, so a forwarded link exposes little. Let the Client ask for a fresh link in the Thread. |
| 4 | PII in texts; breach timelines | No CMS or FTC source found that lists what may or may not go in a text. CMS training treats unencrypted transmission of client PII as an incident, and tells agents to encrypt PII in transit. CMS's own client tip sheet (Jul 2026) tells Clients not to give sensitive information in response to texts. Breach reporting goes to the **CMS IT Service Desk**, but CMS's own materials conflict on the deadline: **1 hour** from discovery (2016/2017 webinars, and a 2025 deck note), versus **24 hours for breaches and 72 hours for incidents** (2022 deck quoting the agreement; 2025 deck). The FTC Safeguards Rule (30-day FTC notice) and the Health Breach Notification Rule (60 days) **most likely do not apply** to an insurance agency. State insurance data-security laws are not covered here. | Texts carry **no PII beyond first name and Agent name**: no SSN, income, DMI details or document contents. Everything else goes behind the link. If a Client texts PII, the Assistant doesn't echo it back, the PII is masked in the Thread, and the Client is pointed to the portal. Design incident response for the **1-hour** reading until counsel confirms the signed agreement's text. |
| 5 | Prompt injection | OWASP Top 10 for LLM Applications **2025**, LLM01 (Prompt Injection) and LLM06 (Excessive Agency). Mitigations: constrain the model's role; validate output against a schema with deterministic code; filter input and output; give tools least privilege and enforce authorization **outside the model**; require human approval for high-risk actions; mark untrusted content as untrusted; red-team. OWASP names image-embedded instructions and malicious uploaded documents as indirect injection routes. | The #6/#8/#10 design already matches most of this: tools defined in Zod with guardrails in tool code, structured extraction checked by deterministic rules, timing set by code, and application changes human-led. To add: wrap extracted document text as data, not instructions; run extraction in a **separate call with no tools**; scan outbound messages for PII and links; one adversarial fixture (a pay stub with "ignore previous instructions" text). |

## 1. Applicable CMS standard

**Regulation.** 45 CFR 155.260, eCFR current text, last amended 81 FR 61581 (6 Sep 2016) (https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-C/section-155.260):

- (b)(1): a **non-Exchange entity** is anyone that gains access to PII submitted to an Exchange, or collects, uses or discloses PII gathered directly from applicants or enrollees while performing agreed functions. Agents and brokers fall under this definition.
- (b)(2): before that access, the Exchange must sign a contract with the entity. The contract must describe the entity's functions, bind it to the privacy and security standards, require it to "monitor, periodically assess, and update its security controls", require it to report material changes to its environment, and (b)(2)(v) bind its **downstream entities** "to the same privacy and security standards and obligations".
- (b)(3): the standards must be "at least as protective" as the Exchange's own, consistent with (a)(1)-(a)(6), and must take account of the entity's environment.
- (a)(3)-(a)(6): data minimization ("only to the extent ... necessary"), "reasonable operational, administrative, technical, and physical safeguards", secure destruction under retention schedules, ongoing monitoring of controls, and "secure electronic interfaces when sharing" PII. There is **no breach-reporting deadline in the regulation**. Deadlines live in the agreement (see section 4).

45 CFR 155.220 (eCFR, latest amendment 91 FR 60334, 23 Sep 2026) (https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-C/section-155.220):

- (d)(3): the Agent's Exchange agreement must require compliance with "the Exchange's privacy and security standards adopted consistent with § 155.260". (j)(2)(iv): protect PII per 155.260(b)(3) and the (b)(2) agreement.
- (k)(3): HHS "may immediately suspend the agent's or broker's ability to transact information with the Exchange" when it finds unacceptable risk, including under 155.260. (g)(5): temporary suspension of up to 90 days on a reasonable suspicion of fraud or abusive conduct involving PII.
- Web-brokers (155.220(c)(3)-(c)(6)) face audit trails kept 10 years, compliance with 155.221, reporting of material breaches to HHS and the state department of insurance, and operational-readiness reviews with penetration tests and system security and privacy plans. **An agency that only uses HealthCare.gov or an EDE partner's site is not a web-broker.**

**When the stricter requirements apply.** 45 CFR 155.221 (eCFR, amended through 89 FR 26420, Apr 2024) (https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-C/section-155.221): **direct enrollment entities** (QHP issuers and web-brokers that host the enrollment flow) must pass operational-readiness reviews ((b)(4)): interconnection security agreements, security and privacy control assessments, system security and privacy plans, incident response plans and vulnerability scans. They also need an independent **third-party auditor** for an initial and annual review ((f)-(g)), with audit records kept 10 years. Agents who merely use an EDE partner's site are not DEEs.

**The control catalog: ARC-AMPE, not MARS-E.** CMS/CCIIO, *Acceptable Risk Controls for ACA, Medicaid, and Partner Entities (ARC-AMPE), Volume I*, v1.02, 10 Apr 2025 (https://www.cms.gov/files/document/arc-ampe-vol-1-v102-508-5cr-04112025.pdf; listed on https://www.cms.gov/marketplace/resources/regulations-guidance with release date 4 Mar 2025 and **compliance date 4 Mar 2026**):

- "ARC-AMPE supersedes and replaces MARS-E and the NEE GRC Framework effective upon publication." It is based on NIST SP 800-53 Rev. 5.
- Table 2 (**mandatory**) includes the FFE, state agencies and SBEs, Classic DE entities, **Primary EDE Entities**, and **"Hybrid Non-Issuer Upstream EDE Entity"**. That last category is "agents, brokers, or web-brokers that use a primary EDE Entity's EDE environment" and add "functionality or systems that modify or add to the Primary EDE Entity's EDE environment beyond minor branding changes or otherwise change the EDE end-user experience". Service providers that enable ACA functions (such as income verification) are also mandatory.
- Table 3 (**non-mandatory, "strongly recommended"**) includes **"Agent/Broker Entity (ABE)"**, licensed and registered agents and brokers who assist consumers.
- So the trigger is **integration**: an Assistant that plugs into or changes an EDE partner's environment, or acts as an income-verification-style service provider, moves into the mandatory tier. That tier means the Volume II SSPP, evidence artifacts, and a CMS Request to Connect. **[UNCERTAIN]** Whether an agency-side tool that reads DMI status from an EDE partner by API counts as "adding functionality" is not answered by the text, so ask the EDE partner or CMS.
- Separately, 155.220(j)(2)(vi) bans "scripting and other automation of interactions with CMS Systems or the Direct Enrollment Pathways" without CMS's written approval (see #3 research). CMS's 2025 compliance deck (below, slide 46) repeats: "Use of scripts or automation tools to conduct person searches or to complete applications and submit enrollments is not allowed."

**The agreement itself.** The Individual Marketplace Privacy and Security Agreement is signed electronically in the CMS Enterprise Portal. Copies are on hhs.gov, which returned HTTP 403 to my fetches, so the **full text was not read**. CMS's own deck *AB Marketplace Compliance*, 28 Aug 2025 (https://www.cms.gov/files/document/marketplace-compliance-agents-and-brokers.pdf), slide 41, quotes the agreement:

- "ABE shall not release, publish, or disclose ... PII to unauthorized personnel".
- The ABE "agrees to comply with all federal laws and regulations regarding the handling of PII—regardless of where the organization is located or where the data are stored and accessed".
- "ABE's Rules of Behavior must be at least as stringent as the HHS Rules of Behavior".
- "all financial and legal liabilities arising from inappropriate disclosure or Breach ... shall be borne exclusively by ABE".
- The ABE must "train and monitor staff on ... sharing of PII with third parties".

Slide 42 adds best practices: MFA "whenever possible", encrypting PII on devices and over wireless networks, and deleting unnecessary PII.

**Authorized functions.** The 2016 CMS PII webinar (https://www.cms.gov/cciio/programs-and-initiatives/health-insurance-marketplaces/downloads/protection-and-pii-webinar_final_5-19-16_v2.pdf, slides 32-34) lists the agreement's Authorized Functions. They include "Assisting an enrollee's ability to report changes in eligibility status ... throughout the coverage year" and "Correcting errors in the application". Any use beyond them needs specific, plain-language, revocable consent, kept 10 years (slides 29-30). DMI document collection fits within these functions. **The document is 2016, so re-check against the current agreement.**

**Is the AI vendor a downstream party?** Yes on the regulation's logic. 155.260(b)(2)(v) makes the Agent bind downstream entities to the same standards, and the agreement makes the ABE solely liable for breaches "while such information is in the possession of ABE". No CMS source names AI or LLM vendors specifically. **[UNCERTAIN]** The exact downstream-entity clause wording, any flow-down form CMS expects, and whether offshore processing is restricted all depend on the agreement text, which I could not read.

## 2. Claude API data terms

- **No training.** Anthropic Commercial Terms of Service, effective 17 Jun 2025 (https://www.anthropic.com/legal/commercial-terms), §B: "Anthropic may not train models on Customer Content from Services". The customer retains rights to inputs and owns outputs. §C: data is processed under the Anthropic **Data Processing Addendum**, incorporated by reference. §E: Customer Content is the customer's Confidential Information, protected with "no less than reasonable care". §D.3: the customer must evaluate whether outputs suit its use, and must tell users that factual assertions in outputs should be checked.
- **Default retention.** Privacy center, "How long do you store my organization's data?", updated 1 Jul 2026 (https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data): "we automatically delete inputs and outputs on our backend within 30 days of receipt or generation". Exceptions: longer retention for services the customer controls (such as the Files API) or where a ZDR agreement applies. Usage-Policy-flagged content is kept up to 2 years, and trust and safety classification scores up to 7 years. Feedback is kept 5 years.
  - **[UNCERTAIN]** The API docs page (below) says "Conversation content ... is not retained by default; the exception is Covered Models". That reads as stricter than the privacy center's 30 days. Treat 30 days as the planning assumption until Anthropic confirms which applies.
- **ZDR and HIPAA readiness.** Claude Docs, "API and data retention", no date on page, read 14 Nov 2026 (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention):
  - Under ZDR, Anthropic "does not store customer prompts or responses at rest after the API response is returned". ZDR is requested through sales and enabled per organization. With ZDR, browser-side calls (CORS) are rejected, so calls must come from the back end.
  - Feature eligibility for ZDR and HIPAA: **Messages API, PDF support (inline), effort, prompt caching, thinking, data residency (`inference_geo`): Yes/Yes. Structured outputs: "Yes (qualified)"**. Only the JSON schema is cached, for up to 24 hours. "**Do not include PHI in JSON schema definitions**." **Files API: No** (kept until deleted). **Batch API: No** (29-day retention). **Message threads: No**. **Managed Agents: No**. **MCP connector: No**.
  - "Retention regardless of arrangement": content flagged by trust and safety systems may be kept up to 2 years, and data may be kept where law requires.
  - HIPAA readiness is self-serve: accept the standard BAA in the Console, and once enabled it is permanent. The API then returns a 400 error for non-eligible features. "Beta features are generally not covered under the BAA unless explicitly listed".
- **Covered Models.** Claude Fable 5.x and Mythos 5.x require 30-day retention and are not available under ZDR. Support article (https://support.claude.com/en/articles/15455031-covered-models-under-a-business-associate-agreement-baa), no date on page. **`claude-sonnet-5-5` is not on that list.**
- **Is a BAA needed?** Only if the data is PHI under HIPAA. #3 research found that Marketplace application data collected by an Agent is governed by 155.260, not obviously by HIPAA. **[UNCERTAIN, counsel]** ZDR alone may suffice; a BAA costs little extra if counsel says it is needed.
- **Usage Policy.** Anthropic Usage Policy, effective **12 Nov 2026** (https://www.anthropic.com/legal/aup):
  - "All consumer-facing chatbots or AI agents that communicate directly with external users ... must disclose to users that they are interacting with AI rather than a human", "at a minimum at the beginning of each chat session or in the product interface". The disclosure need not name Anthropic or Claude.
  - **High-risk Areas** include **insurance** (underwriting, claims, coverage determinations) and **public benefits and services** ("determining eligibility for, or the amount of, government benefits, assistance"). There, "A qualified person must meaningfully review a High-risk AI Recommendation" before use, and the affected individual must be told AI was involved.
  - The exclusions cover "General information or educational content" and "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered". Some wholly favourable decisions are also excluded.
  - **[UNCERTAIN]** Is "this document looks complete" plus automatic submission a High-risk AI Recommendation about benefit eligibility? It is arguably a pre-check, since the Marketplace decides. The policy took effect two days before this research, and no guidance on it exists yet.
- **Not verified:** whether the server-side refusal fallback (`fallbacks: "default"`, chosen in #10) is ZDR- or HIPAA-eligible. It is not in the eligibility table. The SDK's Tool Runner is a client-side helper that calls `/v1/messages`, so it should inherit Messages API eligibility, but no doc says so.

## 3. Identity verification norms

**CMS Marketplace practice (closest benchmark).** CMS/CCIIO, *EDE Change Request (CR) 109: Identity Proofing and Agent/Broker Authorization* FAQ, released **3 Aug 2026** (https://www.cms.gov/marketplace/agents-brokers/files/ede-identity-proofing-agent-broker-authorization-faqs.pdf):

- EDE partners must enforce consumer ID proofing for "high-risk" applications, and agent/broker (AB) authorization for **all** applications, in production by 12 Oct 2026 and ahead of OE 2027 (Q1-Q2).
- For low-risk cases, EDE partners "must require a lightweight mechanism (such as a one-time passcode or a one-time confirmation link) to capture AB authorization" (Q2).
- Channels: "text messages, emails, or automated phone calls ... using the contact information on the application" (Q3).
- Constraints (Q3): "links and/or passcodes ... are single use and are set to expire within 15 minutes of being generated", and "not more than three notifications within 24 hours" per AB and application.
- Identity proofing, when needed, uses Experian RIDP or "a CMS approved third-party ID proofing service that is compliant with NIST 800-63-4 standards at IAL2" (Q3).
- **Q9: AB authorization is required for an AB to upload DMI documents on the consumer's behalf.** It does not replace the 155.220(j)(2)(iii) consent (Q4).
- Q5: the phone number and email must be ones the consumer can access. The Agent must never use the Agent's own contact details or dummy ones.
- Scope: this governs **EDE partner platforms**, not an agency's own portal. It is a benchmark of what CMS treats as enough for a riskier action, not a rule that binds the POC. **[IN FLUX]**: brand new for OE 2027.

**NIST SP 800-63-4** (final 31 Jul 2025, supersedes 800-63-3; https://csrc.nist.gov/pubs/sp/800/63/4/final). Binding on federal systems. For an agency it is a reference, except where CMS imports it, as with IAL2 for third-party proofing above.

- 800-63B-4 (https://pages.nist.gov/800-63-4/sp800-63b.html):
  - §3.1.3.3: "Use of the PSTN for out-of-band verification is *restricted*". A verifier that accepts it must offer a non-restricted alternative, give "meaningful notice" of the risk, assess it, and keep a migration plan. It "SHOULD consider risk indicators (e.g., device swap, SIM change, number porting".
  - §3.1.3.1: "Email SHALL NOT be used for out-of-band authentication".
  - §3.1.3.2: out-of-band secrets must be single use, at least 6 digits or equivalent, and authentication is "invalid unless completed within 10 minutes".
  - Session limits: AAL1 overall timeout ≤ 30 days; AAL2 ≤ 24 hours, with an inactivity timeout ≤ 1 hour. Cookies must be HTTPS-only and should be opaque.
  - The guideline does not address "magic links" as an authenticator. Its threat table lists keys exposed "through a URL sent via email".
- 800-63A-4 (https://pages.nist.gov/800-63-4/sp800-63a.html):
  - §2.5.1: "Knowledge-based verification (KBV) or knowledge-based authentication **SHALL NOT** be used for identity verification". KBV is allowed only for fraud management.
  - §3.3.2: "Knowledge of an SSN is not sufficient to act as evidence of identity".
  - §3.8: confirmation codes sent to a validated phone number are valid "at most ... 10 minutes", and 24 hours by email. They are single use.

**What this means for the portal link.** The following is inference, not a quoted requirement:

- A link that is single use, signed, expires in 10-15 minutes and goes to the Client's own number on file matches what CMS accepts for AB authorization. It also approximates NIST's out-of-band pattern, with the "restricted" caveat for SMS.
- Asking for date of birth or last-4 adds friction. NIST does not credit it as an authenticator or for identity verification, and it requires handling more PII.
- The bigger lever is **limiting what the link unlocks**. An upload-only page that shows no application data means a forwarded link at worst lets someone submit a wrong document. The #6 checks (name match to the Household member) and Agent review catch that.
- A 10-15 minute expiry may be too short for a Client who needs to find a pay stub. A conservative pattern: the link's token is single use and short lived, and opening it starts an upload session limited in time (≤ 24 hours, ≤ 1 hour idle) bound to that one DMI. A fresh link is sent on request in the Thread.

## 4. PII over text and breach notification

**What may go in a text.**

- No CMS or FTC primary source found that lists permitted SMS content. Not checked: the full agreement text, agentbrokerfaq.cms.gov, and REGTAP.
- CMS treats this as an incident: "Email containing client information transmitted for official business is sent unencrypted" (2025 compliance deck, slide 40). The 2017 CMS deck *Marketplace Privacy & Security Requirements for Agents and Brokers* (https://www.cms.gov/CCIIO/Programs-and-Initiatives/Health-Insurance-Marketplaces/Downloads/Marketplace-Privacy-Security-AB.pdf) says to "Ensure communications are encrypted when exchanging PII or other sensitive data electronically". SMS is not end-to-end encrypted, so by analogy it should carry no PII.
- CMS tip sheet for agents to hand to Clients, *Protect Yourself Against Marketplace Scams*, 31 Jul 2026 (https://www.cms.gov/marketplace/agents-brokers/files/2026-07-31-ableavebehind.pdf): Clients should beware of a "Mail, email, or text notice about your health insurance" asking for personal information. They should "Only share information after you've confirmed who you're dealing with" and "Provide only the minimum information needed".
  - The sheet includes a "How we will contact you" table for the agency to fill in. It says the agency "may contact you during the year to ... resolve data mismatches".
  - **Low-friction implication:** pre-announce the Assistant's number and name to Clients through this sheet. Never ask for PII in the text body.
- 155.260(a)(3) data minimization supports "first name + Agent name + link" as the content ceiling.

**Breach and incident reporting timelines.** All CMS sources agree on where to report: the **CMS IT Service Desk**, (410) 786-2580 / 1-800-562-1963 / CMS_IT_Service_Desk@cms.hhs.gov. They conflict on when. **[UNCERTAIN: conflicting CMS statements]**

| Source | Deadline stated |
|---|---|
| 2016 CMS PII webinar, slide 36 | "Any incident that involves compromised PII/PHI must be reported within one (1) hour of detection." |
| 2017 CMS privacy and security deck, ~p. 32 | "within one hour of discovery" |
| CMS *Cybersecurity* deck, 18 May 2022 (https://www.cms.gov/files/document/marketplace-and-cybersecurity.pdf-0), p. 33, quoting the Individual Marketplace and SHOP agreements | Breach of PII "within 24 hours from knowledge of the Breach". Incidents "within 72 hours from knowledge of the Incident". |
| CMS *AB Marketplace Compliance* deck, 28 Aug 2025, slide 40 | "Suspected or confirmed loss of PII must be reported ... within one hour of discovery." |
| Same deck, slide 48 | "potential and confirmed breaches and incidents ... within 24 hours from knowledge of the breach" |

- The 2022 deck is the only one that says it quotes the agreement, so 24h for breaches and 72h for incidents is probably the current contractual text. The 1-hour figure matches CMS's internal incident policy. **Plan for 1 hour** (it costs only a runbook and an on-call contact) until counsel reads the signed agreement.
- CMS also says to report even when unsure, and not to wait for the internal investigation to finish. HHS can suspend Hub access for containment (155.220(k)(3)).
- **FTC Safeguards Rule.** 16 CFR 314 (https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314) has a 30-day FTC notice for 500 or more consumers (314.4(j)), plus encryption and MFA requirements. It applies only to financial institutions "over which the Federal Trade Commission" has jurisdiction (314.1(b)). Insurance is assigned to state insurance authorities under GLBA §505(a)(6) (15 U.S.C. 6805; statute not re-fetched). **Most likely not applicable to an insurance agency. [counsel]**
- **FTC Health Breach Notification Rule.** 16 CFR 318 (https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-318): 60-day notice, applies to vendors of personal health records. An Agent's DMI tool is not a PHR, so it most likely does not apply.
- **Not covered:** state insurance data-security laws, which typically set short notice-to-commissioner deadlines, and state breach statutes. These likely set the Client-notification duty. **[counsel]**

## 5. Prompt injection

OWASP Top 10 for LLM Applications 2025 (https://genai.owasp.org/llmrisk/llm01-prompt-injection/ and https://genai.owasp.org/llmrisk/llm062025-excessive-agency/).

**LLM01 Prompt Injection.** OWASP's mitigations, mapped to this design:

| OWASP mitigation | This design (#6, #8, #10) | Gap to add |
|---|---|---|
| Constrain model behavior in the system prompt | Assistant role and limits in prompts | State that Document content and Client messages are data, never instructions |
| Define and validate output formats with deterministic code | Extraction uses structured outputs; #6 rules decide pass or fail | Validate the schema again server-side, and reject out-of-range values |
| Input and output filtering | SSN masked to last 4 | Outbound filter for SSN-like or long numbers and non-portal URLs in texts |
| Least privilege; functions in code, not the model | Zod tools with guardrails (consent, opt-out, no application changes) | Run extraction as a **separate call with no tools**, so an injected Document cannot call `send_message` or `submit` |
| Human approval for high-risk actions | Application changes, citizenship and immigration, mismatches go to an Escalation | Treat real (non-mock) Marketplace submission as Agent-approved |
| Segregate and mark external content | — | Wrap OCR text and Client text in delimited, labelled blocks |
| Adversarial testing | — | One injection fixture in the seed set (a Document with embedded instructions; an image with hidden text) |

- OWASP names multimodal routes explicitly: "hiding instructions in images that accompany benign text". Scenario #6 is a résumé with split malicious prompts, which is directly analogous to an uploaded pay stub.
- **LLM06 Excessive Agency** adds:
  - Minimize the extensions available to the model and their functionality.
  - "Avoid open-ended extensions" (no shell or URL fetch for the Assistant).
  - Execute actions in the user's context.
  - **"Complete mediation"**: enforce authorization in downstream systems "instead of relying on the LLM's judgment". The consent check in tool code already does this.

## Open questions

1. **Agreement text.** The exact incident and breach deadline, the downstream-entity clause, and any offshore-storage restriction in the current Individual Marketplace Privacy and Security Agreement. hhs.gov copies returned 403. **Counsel or an Agent with a signed copy can settle this quickly.**
2. **ARC-AMPE tier.** Does a real build that reads DMI status from, or uploads to, an EDE partner become a "Hybrid Non-Issuer Upstream EDE Entity" (mandatory tier)? Ask the EDE partner.
3. **Anthropic retention conflict.** Privacy center says 30 days; the API docs say not retained by default. Also unconfirmed: ZDR and HIPAA eligibility of `fallbacks: "default"`.
4. **Usage Policy High-risk scope.** Does an automatic document submission after a "sufficient" pre-check count as a High-risk AI Recommendation about benefit eligibility? The policy is two days old. A conservative reading points to Agent approval before real submission.
5. **HIPAA status.** Whether the Agent's DMI data is PHI, and so whether a BAA is needed on top of ZDR (carried over from #3).
6. **State law.** State insurance data-security and breach-notification statutes, and state AI-disclosure laws. Not researched.
7. **CR 109 interaction.** From OE 2027, uploading DMI documents through an EDE platform needs AB authorization (Q9). A real build that uploads on the Client's behalf inherits that 15-minute OTP or link step on the EDE side.

## Sources

Read directly from first-party hosts unless noted.

- 45 CFR 155.220, 155.221, 155.260 (eCFR, current text, read 14 Nov 2026): links inline above.
- 16 CFR 314; 16 CFR 318 (eCFR, current).
- CMS ARC-AMPE Volume I v1.02 (10 Apr 2025), and the CMS regulations and guidance index page.
- CMS EDE CR 109 FAQ (3 Aug 2026).
- CMS *AB Marketplace Compliance* deck (28 Aug 2025); CMS *Cybersecurity* deck (18 May 2022); CMS *Marketplace Privacy & Security Requirements for Agents and Brokers* (2017); CMS PII webinar (19 May 2016); CMS *Protect Yourself Against Marketplace Scams* tip sheet (31 Jul 2026). PDFs downloaded from cms.gov and text-extracted locally.
- NIST SP 800-63-4 (final 31 Jul 2025), 800-63A-4, 800-63B-4 (pages.nist.gov).
- Anthropic: Commercial Terms (17 Jun 2025); Usage Policy (12 Nov 2026); privacy center retention article (1 Jul 2026); ZDR article (undated); Claude Docs "API and data retention" (undated, read 14 Nov 2026); Covered Models BAA article (undated).
- OWASP Top 10 for LLM Applications 2025: LLM01, LLM06.
- Not read (HTTP 403): hhs.gov copies of the agent/broker Individual Marketplace Privacy and Security Agreement and the web-broker PII breach FAQ.
