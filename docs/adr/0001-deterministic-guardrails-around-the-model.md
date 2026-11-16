# Deterministic guardrails around the model

The Assistant touches documents, the mocked Marketplace and the database only
through its ten tools, and every rule that protects a Client lives in tool or
engine code, never in the model: deterministic rules decide whether a Document
passes, the cadence engine decides when to nudge or escalate, `check_consent`
gates every action, and `send_text`'s outbound filter and the Portal link limits
are enforced in code. The model only extracts fields (in a separate call with no
tools, on data labeled untrusted) and writes the words. We chose this over
letting the model judge sufficiency or timing because a wrong judgement there
submits a bad document, texts a Client who opted out, or misses a deadline, and
a prompt-injected document must not be able to talk its way to `submit_documents`.

## Consequences

- A change to any of these rules is a code change with a test, and a change to
  the guardrails themselves always comes back to Andrew (`CODING_STANDARDS.md`).
- Prompts may explain the rules to the model, but the code never trusts the
  model's answer for pass or fail, timing or consent.
