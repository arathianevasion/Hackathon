# Coding standards

Product level: how code is written in this repo, changed by PR. Read by workers and verifiers at the point of use.

## Always ask

Things that must always come back to the Artisan. Only the Artisan changes this list (setup or a retro lesson).
- Contract changes: data model types, tool signatures, event names
- New dependencies
- Model or effort changes, including refusal fallbacks
- Tool guardrail changes: consent check, opt-out, outbound filter, Portal link limits

## Guardrails

- `pr-boundaries`: one PR per slice (set at setup).

