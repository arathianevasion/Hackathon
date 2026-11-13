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

## One-time setup (about 15 minutes, no admin rights needed)

Each step says exactly what to paste into Claude. Claude asks before running each command: read its explanation, then click **Approve**.

### 1. GitHub account and invitation (on your own)
1. Use an existing GitHub account or create one at https://github.com/signup.
2. Send your **GitHub username** to Andrew. He adds you to the project and GitHub emails you an invitation.
3. Accept it at https://github.com/arathianevasion/Hackathon/invitations. Without it you can read the repo but cannot claim or edit tickets.

### 2. Open an empty folder in Claude
Make an empty folder called `Hackathon` anywhere you like (for example in Documents) and open it in the Claude desktop app's **Code** tab.

### 3. Check what is installed
Paste:

> Check my setup for the Hackathon project. Run `git --version`, `gh --version`, and `id -Gn`, then tell me in plain language which tools are installed and whether I appear to have admin rights. Don't install or change anything.

### 4. Install anything missing
- **Both installed:** skip to the next step.
- **Git missing:** macOS may pop up an offer to install "command line developer tools". If it asks for an admin password you don't have, click Cancel and install Git from **Self Service** (or ask IT). Then paste the check prompt again.
- **`gh` missing:** paste:

> Install the GitHub CLI (`gh`) for my user only, without admin rights and without Homebrew: download the latest macOS zip for this Mac's chip from https://github.com/cli/cli/releases, put the `gh` program in `~/bin`, add `~/bin` to my PATH in `~/.zshrc`, and confirm `gh --version` works. Explain each step in plain language before you run it.

### 5. Sign in to GitHub and get the project
Paste:

> Sign me in to GitHub with the GitHub CLI using my browser: run `gh auth login --hostname github.com --git-protocol https --web`. If it shows a one-time code, give me the code and the link https://github.com/login/device so I can enter it there. Then run `gh auth setup-git`, and confirm `gh auth status` shows my own username. If my git name and email aren't set, ask me for them and set them. Then clone the project into this folder with `git clone https://github.com/arathianevasion/Hackathon .` and run `gh issue view 1 --repo arathianevasion/Hackathon` to prove I can see the map.

In the browser, sign in as **yourself**, so tickets are assigned to you. If `gh auth status` or the last command fails, stop and tell Andrew.

### 6. Turn on the skills
Start a **new** Claude session in the same `Hackathon` folder. The project should ask to install the **mattpocock-skills** plugin: accept. If it doesn't ask, paste:

> Install the mattpocock-skills plugin from the claude-plugins-official marketplace (GitHub repo anthropics/claude-plugins-official) for my user, then tell me how to reload so the skills appear.

Check it worked: type `/mattpocock-skills:` and you should see `wayfinder` in the list.

### 7. Start your ticket
Paste your wayfinder prompt from **How to work a ticket** below.

## How to work a ticket
Paste this into Claude Code, in a session opened on the cloned `Hackathon` folder:

```
/mattpocock-skills:wayfinder https://github.com/arathianevasion/Hackathon/issues/1 Work ticket #5 (Synthetic data model and scenario set). Read handoffs/meagan.md first for context and what a good answer looks like. Claim the ticket before doing anything, grill me one round at a time, and show me the draft resolution before you close it.
```

Claude will:
1. Claim your ticket by assigning it to you, before any other work.
2. Interview you ("grilling") in numbered questions with a recommended answer each. You answer; Claude does not answer for you. Answer "yes" to accept a recommendation.
3. Draft a resolution and show it to you **before** closing anything.
4. After you confirm: post the resolution as a comment on the ticket, close it, and add a one-line entry to the map's *Decisions so far*.

Rules:
- One ticket per session. When done, stop.
- The map is one shared issue. Before editing it, re-read it, since teammates may have changed it.
- If your answer unlocks or changes other tickets, say so; Claude will update the map. If your decision contradicts something already decided, flag it instead of overriding.
- Stuck or unsure? Park it in the ticket as a comment and tell Andrew.
