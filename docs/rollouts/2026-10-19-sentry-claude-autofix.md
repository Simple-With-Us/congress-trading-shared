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
- `npm run typecheck` (the package's `tsc --noEmit` script): not run locally; passed in hosted CI for the workflow-identical revision `a75c00d3d9cfa92aa57ffaca69496dd33aed2e53`.
- `npm run build`: not run locally; passed in that hosted run.
- `npm run lint:package`: not run locally; passed in that hosted run.  This package has no `npm run lint` script.
- `npm test`: not run locally; passed in that hosted run.
- `npm audit`: not run locally; passed in that hosted run.
- `npm run pack:dry`: not run locally; passed in that hosted run.
- Receipt: [CI run 39190320779](https://github.com/Simple-With-Us/congress-trading-shared/actions/runs/39190320779).  Dependency-signature verification and the clean tokenless Git install smoke also passed.  The final documentation revision still requires its own [current-head PR checks](https://github.com/Simple-With-Us/congress-trading-shared/pull/387/checks).
- No live paid autofix dispatch performed.

## Next Steps And Blockers

Review the draft PR and current-head checks before merge, then observe a genuine Sentry review run.  This lane does not merge, arm auto-merge or deploy.
