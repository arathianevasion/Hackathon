# ACA DMI rules: deadlines, DMI types, acceptable documents

Research for issue #2. Scope: Federally-facilitated Marketplace (HealthCare.gov) and State-based Marketplaces on the Federal Platform. Primary sources only (45 CFR, CMS, HealthCare.gov). Researched 2026-11-12.

## Short answer

- Resolution deadline: 90 days from the date of the eligibility determination notice (EDN) for most DMIs; 95 days for citizenship and immigration DMIs.
- Extension: the automatic 60-day extension for income DMIs was eliminated effective 25 Aug 2025. A consumer can still ask for more time by calling the Marketplace Call Center and showing a good-faith effort to obtain documents. The regulation makes this discretionary ("may extend").
- Types: most common are income, citizenship, immigration. Others: SSN, American Indian/Alaska Native status, job-based coverage, Medicaid/CHIP, TRICARE, VA, Medicare, Peace Corps (and, in 2014 material, incarceration status).
- Documents differ per type (tables below). One DMI may need more than one document.
- Insufficient documents: the consumer gets a notice and a phone call and must submit more. Typical causes: wrong document type for the DMI, required fields missing from the document, income not matching the application, bad file or upload mechanics.

## Deadlines

| Fact | Source |
|---|---|
| 90 days from the date the eligibility notice is sent; for SSN and citizenship/lawful-presence inconsistencies the notice is deemed received 5 days after its date | 45 CFR 155.315(f)(2), (b), (c) |
| Citizenship/immigration DMIs: 95 days from the date of the EDN; all other DMIs: 90 days | CMS job aid (Feb 2026); CMS Agent/Broker DMI office hour (Feb 2024) |
| The EDN says "Your eligibility is temporary" and gives the timeframe | CMS job aid (Feb 2026) |
| Warning notices at 90, 60, 30 days remaining plus a phone call (per communication preference). Citizenship/immigration: warnings about 65 and 35 days after the EDN | CMS job aid (Feb 2026) |
| Even if the deadline is near or passed, the consumer should still submit documents | CMS CCIIO tips (Aug 2014) |
| Marketplace typically sends a result notice about one month after receiving income documents | CMS income DMI deck (Feb 2026) |

### Extensions

- Regulation: the Exchange "may extend the 90-day period if the applicant demonstrates that a good faith effort has been made to obtain the required documentation" (45 CFR 155.315(f)(3)).
- Current CMS guidance: consumers "may request more time to submit documents if they can't obtain the required documents within the 90-day DMI window by calling the Marketplace Call Center and demonstrating that a good faith effort has been made" (CMS, How to Resolve Income DMIs, Feb 2026).
- The previous automatic 60-day extension for income DMIs "has been eliminated", effective 25 Aug 2025 (same deck). Older CMS material (2024) describing an extra 60 days is outdated for this point.
- Not found in primary sources: a maximum length for a good-faith extension. Treat as unknown; model as "request via call center, outcome uncertain".

### During and after the period

- During the period the consumer remains eligible and can enroll, per the temporary eligibility; APTC use requires acknowledging that it is subject to reconciliation (45 CFR 155.315(f)(4); CMS job aid).
- Expiry impact (CMS DMI office hour, Feb 2024):
  - Income: financial assistance is adjusted, possibly to nothing, to match income in trusted data sources; possible repayment at tax time.
  - Citizenship/immigration: loses Marketplace eligibility and is terminated if enrolled. If documents are later submitted, the consumer may regain coverage via a Special Enrollment Period (60 days from SEP start, prospective or retroactive start).
  - AI/AN status: loses tribe-specific financial assistance.
  - Non-employer-sponsored MEC: loses financial assistance.
- After expiry the Marketplace redetermines eligibility from trusted data and sends a new EDN (CMS job aid).
- Regulatory fallbacks: 45 CFR 155.315(f)(5) (decide using available data); 155.320(c)(3)(iii)(E)-(F) (income: use tax-data income, or discontinue APTC/CSR if none).

## DMI types and triggers

Sources: CMS job aid (Feb 2026), CMS DMI office hour (Feb 2024), 45 CFR 155.315 and 155.320.

- Most common: income, citizenship, immigration.
- Other: SSN, AI/AN status, minimum essential coverage through employer, Medicaid/CHIP, TRICARE, Veterans Health Care Program, Medicare, Peace Corps. A 2014 CMS deck also lists incarceration status and non-employer MEC.
- Generic triggers: data does not match trusted sources; a source has no data for the person; application missing or wrong info, namely no SSN, not all household income (including non-applicants), name not exactly as on the citizenship or other document, missing immigration document or ID numbers.
- Income trigger: attested income outside the threshold versus data sources (the CMS Feb 2026 deck says attested income is not "within the acceptable threshold of 50 percent or $12,000, whichever is greater") or Marketplace cannot query records, often from missing SSNs. Note: the CMS 2024 deck's cheat sheet states a different threshold (25%) than its own body text (50%), so confirm the threshold against current CMS text before encoding it; the regulation uses "reasonable threshold" and a 10% rule for the alternate-data process (155.320(c)(3)).
- Court stay: per City of Columbus v. Kennedy (D. Md.), the Integrity and Affordability rule provision opening income DMIs when IRS data shows income under 100% FPL (or no IRS data) is stayed; those DMIs are not opened while the stay stands (CMS job aid, Feb 2026).
- Who generates DMIs: CMS says most DMIs from agent/broker enrollments are immigration-related and avoidable by complete, exact applications (CMS DMI office hour).

## Acceptable documents per type

Primary list: HealthCare.gov "How do I resolve a data matching issue?" https://www.healthcare.gov/help/how-do-i-resolve-an-inconsistency/. The EDN and the 90-day warning notice also list acceptable documents for that consumer's DMI. Photocopies only, never originals.

### Income
Documents must show an annual income closely matching the application. If the job changed, send recent pay stubs from the new job rather than last year's return or W-2.
- Federal or state 1040: first and last name, income amount, tax year; include Schedule 1 if filed.
- W-2 and/or 1099: name, income, tax year, employer name if applicable.
- Pay stub: name, income, pay period or frequency, payment date; state average overtime per paycheck if included.
- Self-employment ledger (Schedule C, recent quarterly or YTD profit and loss, or ledger): name, business name, income; a ledger must also list covered dates and net profit or loss. Include estimates for the rest of the year if income will differ.
- Social Security benefits letter: name, benefit amount, payment frequency.
- Unemployment letter: name, agency, amount, duration.
- Other: employer letter, lease for rental income, copy of check, bank statement, alimony records, pension/annuity, workers' comp, settlements, gig work statement and more (CMS Feb 2026 deck, slides 27-28; HealthCare.gov page).
- Fallback: Annual Income Letter of Explanation form (English/Spanish) when no other document is available or multiple documents have failed, including special circumstances like fire or flood. Include name, application number, date of birth, current date, expected annual household income (CMS Feb 2026 deck). Reg basis for no-documentation cases: 155.315(g) special-circumstances attestation exception, which excludes citizenship and immigration.

### Citizenship
- Option 1, one of: U.S. passport; Certificate of Naturalization (N-550/N-570); Certificate of Citizenship (N-560/N-561); enhanced driver's license (the four states named on the HealthCare.gov page); federally recognized tribe document.
- Option 2, if none: proof of U.S. birth (U.S. birth certificate, CRBA FS-240, DS-1350, FS-545, I-197/I-179 citizen ID card, adoption decree, medical or school record) PLUS a document with photo or identifying details (state or federal ID, school ID, military card or dependent ID, voter registration card, and others).
- Or two documents with consistent identity information (HealthCare.gov page).

### Immigration status
I-551 permanent resident card; I-327 reentry permit; I-571 refugee travel document; I-766 employment authorization card; temporary I-551 stamp; machine-readable immigrant visa; unexpired foreign passport; I-94/I-94A; I-20; DS-2019; I-797 and I-797C notices; tribal documents (Canada-born AI); ORR certification letter (under 18); withholding of removal documents. See HealthCare.gov page for the full list.

### Social Security number
Document must show first name, last name and SSN: Social Security card, SSA documentation (Form 4029), military records or ID; 1040, W-2, 1099, W-4; 1095 forms; pay stubs; unemployment letter; name-change court order showing original name, new name and SSN; divorce decree.

### Other types
- AI/AN: tribal enrollment card; BIA document; authentic tribal document declaring membership; CDIB (with tribal enrollment info); I-872 card (certain Kickapoo); IHS eligibility document; shareholder documentation; Marketplace tribal exemption letter.
- Job-based coverage: completed Employer Coverage Tool with a cover letter signed by the employer; or an employer letter stating no offer or non-qualifying coverage plus the employee share of the lowest-cost qualifying self-only plan; or a letter confirming outside coverage and its end date.
- Medicaid/CHIP: agency letter showing not enrolled or eligible; letter showing enrollment in non-qualifying program (pregnancy-only, family-planning-only, emergency-only, spend-down and similar); or a letter describing recent coverage and end date.
- TRICARE, VA, Peace Corps: agency letter with end date or ineligibility; if none, signed letter of explanation (templates on HealthCare.gov).
- Medicare: SSA or Medicare letter on Part A status. A document showing no premium for "Medical Insurance" is Part B and does not verify Part A.

## Why submitted documents are judged insufficient

CMS does not publish a formal list of rejection reasons. The following are drawn from stated requirements and are inferences from them where marked.

Stated by sources:
- The Marketplace decides sufficiency; if insufficient the consumer receives a notice and a phone call and must send additional documents (CMS job aid, income deck, office hour scenario).
- One DMI may need multiple documents, for example birth proof plus photo ID for citizenship (HealthCare.gov; CMS office hour: "Confirm that any submitted documents are the correct type for the DMI").
- Income documents must closely match the application and show required fields (name, amount, tax year, pay period, employer, dates covered).
- Stale documents: a changed job needs current pay stubs, not last year's W-2 (HealthCare.gov).
- Part B Social Security paper used for Part A (HealthCare.gov).
- Name-change order not showing both names and SSN (HealthCare.gov).
- Wrong member: the notice may be addressed to the household contact while the DMI concerns another household member (CMS 2014 tips).
- Upload mechanics: formats .pdf, .jpeg, .jpg, .gif, .xml, .png, .tiff, .bmp; under 10 MB; no special characters in file name; legible scan or clear photo; correct application ID; separate document per DMI; confirm the checkmark that upload finished. Email and fax are not accepted. Mail copies with barcode page or name and application ID (HealthCare.gov verify-information and uploading tips).
- Application data errors can keep the DMI open even with good documents: typo in an immigration document number should first be corrected in the application (CMS office hour scenario 3). Name mismatch with the source document is a named trigger.
- Reminder: if a warning notice arrives after submission, resubmit (CMS 2014 tips).

Inferences (not stated as rejection reasons by CMS): illegible or cropped images, expired documents where the list says "unexpired", and documents for the wrong person or tax year are likely rejections.

## Open items and conflicts for the spec

- Good-faith extension length and criteria are unspecified.
- Income threshold wording conflicts between CMS decks (see above); the 90/95 split comes from the 2024 and 2026 CMS decks, while the regulation text only states 90 days.
- HealthCare.gov help page says "at least 90 days" in some places and defers to the notice; the notice date is authoritative. Model deadline as a per-DMI date taken from the notice rather than computed, with 90/95 as a fallback.
- State-based Marketplaces that do not use the federal platform have their own rules and are out of scope.
- Rules are in flux (litigation stay, Aug 2025 extension change); the mock should make deadline length and extension behavior configurable.

## Sources

- 45 CFR 155.315 (verification of other eligibility criteria; (f) inconsistencies): https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-D/section-155.315
- 45 CFR 155.320 (verifying eligibility for APTC/CSR; income, ESI): https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-D/section-155.320
- HealthCare.gov, How do I resolve a data matching issue?: https://www.healthcare.gov/help/how-do-i-resolve-an-inconsistency/
- HealthCare.gov, When the Marketplace needs more information: https://www.healthcare.gov/verify-information/
- HealthCare.gov, Uploading documents tips: https://www.healthcare.gov/tips-and-troubleshooting/uploading-documents/
- HealthCare.gov glossary, Data matching issue: https://www.healthcare.gov/glossary/data-matching-issue/
- CMS, Resolving Data Matching Issues (DMIs) job aid, v2.0 Feb 2026: https://www.cms.gov/files/document/resolving-data-matching-issues-dmis.pdf
- CMS, How to Resolve Income DMIs, Feb 2026: https://www.cms.gov/files/document/how-resolve-data-matching-issues-dmis.pdf
- CMS CCIIO, Data Matching Issue (DMI) Office Hour for agents and brokers, 15 Feb 2024: https://cms.gov/files/document/data-matching-issues-dmi.pdf
- CMS CCIIO, Tips to Resolve Outstanding Data Matching Issues, Aug 2014: https://www.cms.gov/CCIIO/Programs-and-Initiatives/Health-Insurance-Marketplaces/Downloads/Data_Matching_Issues_09102014_508.pdf
