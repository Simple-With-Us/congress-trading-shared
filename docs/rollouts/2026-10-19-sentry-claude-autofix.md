# Local Sentry Claude Autofix Admission

## Context And Objective

CTS-331 follows the owner's request to enable Sentry autofix across the fleet.  The local caller's reusable default did not admit Sentry/Seer.

## Changes Made

- `.github/workflows/claude-code-autofix.yml`: explicitly pass the six existing actor spellings plus `sentry` and `sentry[bot]`, and include Sentry/Seer in the prompt's reviewer description.
- Add this rollout note with the exact scope and verification limits.

## Decisions And Trade-offs

Keep the local reusable path and its default unchanged.  Preserve the Bot/same-repository event gate, submitted-review/dispatch triggers, concurrency, token permissions, explicit secrets, model budget and verify command.  Other autofix loops remain unchanged.

## Verification State

- Isolated YAML parsing and before/after caller contract assertions: passed.
- Actual caller-expression evaluation: 13 cases passed, including the eight admitted actor spellings, both Sentry fork cases, unsupported event rejection, human rejection and manual dispatch.
- Reusable `allowed_bots` passthrough and pinned diagnostics dependency: fetched and verified.
- Package tests and build were not run locally in the connector-backed fixture lane; current-head hosted checks remain required.
- No live paid autofix dispatch performed.

## Next Steps And Blockers

Review the draft PR and current-head checks before merge, then observe a genuine Sentry review run.  This lane does not merge, arm auto-merge or deploy.
