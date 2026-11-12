# Handoff for Meagan: Synthetic data model (ticket #5)

Welcome. You are taking **#5 "Synthetic data model and scenario set"**: https://github.com/arathianevasion/Hackathon/issues/5

## Your question
What synthetic Clients, Members, DMIs, documents and contact history do we need, and which scenarios must the data cover?

## What a good answer looks like
- The **entities and their relationships** (Client, Member, DMI, document, consent record, contact/message, Agent), in the glossary's vocabulary. Keep it a model, not a database schema.
- A **scenario set** that covers the demo: the happy-path Client (an income DMI with days left, who first uploads an insufficient document), the income-change Client (triggers escalation), and a non-responding Client (initial sent, nudge sent, Agent notified) for the dashboard. Add enough extra Clients to make the Agent's ranked list look real, plus examples of the alert badges: a document insufficient twice, and a deadline within 7 days.
- How **consent records** appear in the data (existing, covering status checks and informational outreach, with an opt-out example).
- Realistic but fake: names, plan details and documents must be plainly synthetic, with no real carriers.

## Read first
- `GLOSSARY.md`, and both `research/` files (DMI types, deadlines, the consent object).
- Ticket #4's resolution comment for the exact demo script.

## Do not decide here
Whether the Assistant may act on a given case (ticket #8), how documents are judged (ticket #6), or the technology stack (ticket #10). Note the data they will need, and leave the decision to them.

## When you're done
Tickets #6, #7 and #10 depend on your model. Tell Andrew so the next person can start.
## The problem
Client value is won or lost after enrollment. Agents have no easy way to stay engaged with every Client all year. Our POC is **AI-first**: an AI **Assistant** works on the licensed **Agent's** behalf to resolve **ACA Data Matching Issues (DMIs)**, so Clients keep their coverage (retention).

Vocabulary lives in `GLOSSARY.md`: **Agent** (human licensed agent), **Assistant** (the AI), **Client** (person in the Agent's book), **Member** (a Client's enrollment in a plan), **DMI**. Please use these words exactly.

## Where we are
We are *wayfinding*: charting decisions on a shared map before anyone builds. The map is a GitHub issue; each open question is a child ticket.

- **Map:** https://github.com/arathianevasion/Hackathon/issues/1
- **Destination:** a spec detailed enough for three engineers to build a greenfield POC (TypeScript, Claude API, synthetic data, mocked Marketplace and channels) by **Tue 17 Nov 2026**. Map tickets should be resolved by about **Sat 14 Nov**.
- **Plan, don't build:** tickets produce decisions, not code. The one exception is a `prototype` ticket, which makes a cheap throwaway artifact.
- **Public repo, synthetic data only.** No real client data, carrier names or dollar figures in issues or files.

## Already decided (read the linked tickets for detail)
- **ACA DMI rules** (#2, closed): 90-day deadline (95 for citizenship/immigration); the automatic 60-day income extension ended Aug 2025; keep deadline and extension behavior configurable. Findings: branch `research/aca-dmi-rules`, file `research/aca-dmi-rules.md`.
- **Compliance limits** (#3, closed): the Assistant acts only under the Agent's documented Client consent; humans stay in the loop for consent capture, income figures and application changes; AI-disclose anyway. Research, not legal advice. Findings: branch `research/ai-outreach-compliance`, file `research/ai-outreach-compliance.md`.
- **Demo** (#4, closed): live 10 minutes for product peers and leadership. One happy path (insufficient document, then the right one, resolved in the mocked Marketplace) and one intervention path (the Client's income changed, so the Assistant alerts the Agent). A non-responding Client shows on the Agent's dashboard as a static example.
- **In progress, not final** (#8, Assistant autonomy): text-only outreach with a portal link for uploads; the Assistant has a fixed tool set (`get_client`, `list_open_dmis`, `lookup_dmi_rules`, `check_consent`, `send_text`, `create_portal_link`, `precheck_document`, `submit_documents`, `get_dmi_status`, `escalate_to_agent`) and cannot change applications. Treat these as proposals; do not take ticket #8.

To read a research file: `git fetch origin research/aca-dmi-rules` then `git show origin/research/aca-dmi-rules:research/aca-dmi-rules.md` (same pattern for the compliance branch). Never merge or open a PR from a `research/` branch.

## One-time setup (about 10 minutes, almost no terminal)

You do three things yourself, then paste one prompt and let Claude do the rest.

### 1. Do these yourself
1. **GitHub account and invitation.** Use an existing account or create one at https://github.com/signup. Send your **GitHub username** to Andrew. He adds you to the project, and GitHub emails you an invitation. Accept it at https://github.com/arathianevasion/Hackathon/invitations. Without it you can read the repo but cannot claim or edit tickets.
2. **Git.** Git is installed automatically the first time it is needed; if macOS asks to install the command line developer tools, click Install.
3. **Make an empty folder** called `Hackathon` anywhere you like, and open that folder in the Claude desktop app's Code tab.

### 2. Paste this setup prompt into Claude
> Set up this machine for the Hackathon project: check that git and the GitHub CLI (`gh`) are installed and install any that are missing (use Homebrew), walk me through signing in to GitHub in my browser as myself, then clone https://github.com/arathianevasion/Hackathon into this folder. Explain each step in plain language before you run it.

Claude asks your permission before each command; click Approve. When your browser opens for GitHub sign-in, sign in as **yourself**, so tickets are assigned to you. To finish, Claude should show `gh auth status` logged in as you and print the map issue (`gh issue view 1 --repo arathianevasion/Hackathon`). If either fails, stop and tell Andrew.

### 3. Open the cloned project
Open the cloned `Hackathon` folder in the Claude desktop app. The project asks to install the **mattpocock-skills** plugin; accept. If it does not ask, paste this prompt instead: "Install the mattpocock-skills plugin from the claude-plugins-official marketplace, then reload plugins." Check it worked by typing `/mattpocock-skills:` and seeing `wayfinder` appear.

### 4. Your handoff file
It is already in the clone at `handoffs/<yourname>.md`.

## How to work a ticket
Paste your prompt (given separately) into Claude Code. Claude will:
1. Claim your ticket by assigning it to you, before any other work.
2. Interview you ("grilling") in numbered questions with a recommended answer each. You answer; Claude does not answer for you. Answer "yes" to accept a recommendation.
3. Draft a resolution and show it to you **before** closing anything.
4. After you confirm: post the resolution as a comment on the ticket, close it, and add a one-line entry to the map's *Decisions so far*.

Rules:
- One ticket per session. When done, stop.
- The map is one shared issue. Before editing it, re-read it, since teammates may have changed it.
- If your answer unlocks or changes other tickets, say so; Claude will update the map. If your decision contradicts something already decided, flag it instead of overriding.
- Stuck or unsure? Park it in the ticket as a comment and tell Andrew.
