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


## Checks

- `npm run typecheck`: proven to fail on 2026-11-16, breaking: a string assigned to a `number` export in `src/queue/rank.ts`
- `npm run lint`: proven to fail on 2026-11-16, breaking: `var` and `debugger` added to `app/actions.ts`
- `npm test`: proven to fail on 2026-11-16, breaking: `rankByDeadline` sorting turned off in `src/queue/rank.ts`
