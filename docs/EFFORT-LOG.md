# congress-trading-shared Effort Log — cross-agent board
Protocol: /Users/jay/apps/EFFORT-LOG-PROTOCOL.md (canonical). Live board:
`/Users/jay/apps/CONGRESS-SHARED-EFFORT-LOG.md` (mirror: this file). As of 2026-07-05
(next-wave cycle 2).

## Deployed
- **v1.3.0 — 2026-07-05 (MONET).** `TICKER_ALIASES` rename-vs-acquisition split shipped in
  **PR #53** (merged to `main` `4c35df2`) and tagged **`v1.3.0`** (→ `4c35df2`). Landed as the
  coordinated release train: MONET's split + CURSOR's previously-stranded stack (237-test suite,
  CHANGELOG.md/RELEASE.md, engines.node, publish.yml decommission) with CURSOR authorship intact,
  + a release-hygiene commit that dropped the dormant `publishConfig.registry` and stale
  `publish:dry` refs (flagged by the release audit). Verified: local tsc/263 tests/build green; CI
  `verify` green; 3-lens release-readiness workflow (install / correctness / compat) all pass;
  tokenless git-install from `#v1.3.0` builds `dist/` via `prepare` and imports correctly (CJS+ESM);
  clone-at-tag build OK. Consumers can now pin `#v1.3.0`. Remaining follow-ups (not part of this
  deploy): consumer pin bumps (Socratic.Trade exact-pin `#v1.2.0`→`#v1.3.0`, Congress.Trade lockfile
  refresh) + AG's consumer migration, both cross-repo/owner-gated. The stale In-Progress
  "DONE-local-unpushed" cursor rows below all landed via PR #53 — left for the next-wave
  board-owner to reconcile against their issue-key structure (#17/#18/#21/#22/#23/#39).
- (n/a for pre-1.3.0 — library package; "deployed" = version published/consumed by apps)

## Completed
- **Repair the stale Mac clone `main` (CLAUDE) — 2026-07-05.** Salvage-check verified all 7
  local-only commits SUBSUMED by `origin/main` before the move (2 independent lenses + adversarial
  verify, 4-agent workflow): all 5 non-merge commits patch-equivalent upstream (`git cherry`/
  `range-diff` all `=`), both PR merges byte-identical trees, and main's tip TREE OBJECT identical
  to origin-ancestor `5b2a6fa` — local main's entire tree already existed inside origin/main's
  history; v1.2.0 strictly supersedes the 1.1.1 line. Applied `git branch -f main origin/main`
  (main was not checked out in any worktree); now 0/0 divergence, tracking origin/main. Nothing
  salvaged because nothing was unique; pre-move tip `f06fd71` recoverable via reflog.
  _2026-07-05 (CLAUDE next-wave): re-verified independently this cycle — `git rev-parse main` and
  `git rev-parse origin/main` are identical (`071a17d`) and `main` is still not checked out in any
  worktree. Confirms this row is correctly Completed; no further action needed here._
- **CI standard adoption blocker check (CLAUDE) — 2026-07-05.** Verdict: blocker NOT cleared, and
  it MOVED: `claude/ci-actions-efficiency` DID land in the Socratic.Trade hub but produced only an
  in-repo docs-only fast path — no reusable `workflow_call` verify gate exists for consumers to
  call. Real dependency now: Socratic.Trade PR #372 (`claude/ci-hybrid-runner-verify`, open) +
  a not-yet-scoped follow-on to build the reusable entry point once #372 proves itself. Reserved
  caller-workflow row below updated accordingly; stays blocked.
  _2026-07-05 (CLAUDE next-wave): re-verified this cycle — the blocker check is now definitively
  answerable and this In Progress row can be CLOSED. Confirmed `claude/ci-hybrid-runner-verify`
  does not exist on Socratic.Trade's origin and no reusable verify-gate workflow is on its `main`
  (only the #370 docs-fast-path efficiency change landed there). Result: 'still blocked' — see the
  Planned/Reserved row below, corrected with this verified status and date._
- **Shared agent-sync WebSocket relay verification (CODEX, shared `/Users/jay/apps` infra) —
  2026-07-05.** Verified PM2 `agent-sync-push` is online, connected to Slack Socket Mode using
  `SLACK_SYNC_WEBSOCKET`, and fanning out to local consumers on `ws://127.0.0.1:8787`; verified
  PM2 `agent-sync-codex` is attached as this seat's private-cursor consumer. Stopped the temporary
  direct Socket Mode watcher and corrected the canonical protocol entrypoint from stale `run.sh`
  to installed `start.sh`. No package code changed.
- ~~**Test coverage for `schemas.ts` / `utils.ts` / `constants.ts` + SecurityRef subset-consistency guardrail (CURSOR) — 2026-07-05.** 237 tests across 5 files (4 new + 1 existing `usageTelemetry`), zero failures. Covers all 37 exported Zod schemas, 7 utility functions (`normalizeTicker`, `resolveTickerAlias`, `marketCapBucket`, `bracketMidpoint`, `isIsoDate`, `daysBetween`, `mergeRefs`), all constants (`TICKER_ALIASES`, `MKT_CAP_THRESHOLDS`, `API_PATHS`, `WINDOW_PRESETS`, `LAG_BUCKETS`), and `parseArray`/`parseSafe` helpers. SecurityRef guardrail verifies `SecurityRefInputSchema` keys are a true subset of `SecurityRefSchema`. Branch: `cursor` (not yet merged to origin/main at mirror time). Mid-tier subagent.~~
  _2026-07-05 (CLAUDE next-wave): stale — this is NOT Completed per protocol (Completed = merged
  to main). Commit `6300b89` exists only on the local `cursor` branch; `origin/cursor` is 5 commits
  behind and no PR is open, so `origin/main` has none of it. Moved to In Progress as
  DONE-local-unpushed below; needs push of the `cursor` branch + PR + merge. Issues #17/#18 stay
  open until it lands._
- **Global agent policy alignment and workspace sync (AG) — 2026-07-05.** Verified global config files (Gemini/Antigravity, Claude, Codex, and Cursor rules) are fully aligned with the latest efforts log, Slack WebSocket collab, and v4-pro model tiering protocols. Reset the local workspace `cursor` branch to `origin/main` to sync the latest `docs/EFFORT-LOG.md` and inter-agent coordination stanza.
- ~~**Mechanical repo maintenance batch (CURSOR, S) — 2026-07-05.** Completed on `cursor` branch:
  deleted stale origin branches (`codex/package-git-prepare-20260629`, `codex/package-prepare-and-ci`),
  decommissioned `.github/workflows/publish.yml` and `publish:dry` script, added `engines.node >=20.0.0`
  to `package.json`, created `CHANGELOG.md` and `docs/RELEASE.md`.~~
  _2026-07-05 (CLAUDE next-wave): stale/split — only the stale-branch deletion actually happened on
  origin (both `codex/*` branches are confirmed gone); that part stays Completed. The other four
  changes (publish.yml decommission `eaea090`, engines.node `4aad70f`, CHANGELOG.md + docs/RELEASE.md
  `13137be`) are local-only on `cursor` — `publish.yml` still exists on `origin/main` today. Moved
  those four to In Progress as DONE-local-unpushed, same landing train as the test-coverage row
  above. Issues #21/#22/#23 stay open until merge._
- **Effort-issues sync secondary-rate-limit hardening (CLAUDE) — PR #27, 2026-07-05.** Verbatim propagation of the fleet-standard `scripts/sync-effort-issues.py` hardening from Socratic.Trade: 2.5s creation throttle, Retry-After/exponential-backoff retries under a bounded 300s per-run budget, and exit-0 "PARTIAL SYNC — resume on next run" summary on budget exhaustion (bulk issue creation previously 403'd on GitHub's secondary rate limit and hard-failed the sync workflow; the sync is idempotent, so a partial pass resumes cleanly on the next run).
  Review refinements re-propagated via PR #29 (merged 2026-07-05): issue listing inside
  partial handling, server-sent Retry-After honored uncapped, 1s update throttle.
- (seeded empty — see repo git history for pre-protocol work)
- PR #3 (claude/agent-sync-stanza, CLAUDE) — AGENTS.md inter-agent coordination stanza; MERGED 2026-07-04.
- PR #4 (claude/effort-issues-mirror, CLAUDE) — GitHub Issues mirror of this board; MERGED 2026-07-04.
  Additive `scripts/sync-effort-issues.py` + `.github/workflows/effort-issues-sync.yml`, ported
  verbatim from Socratic.Trade (canonical pattern in `/Users/jay/apps/EFFORT-LOG-PROTOCOL.md`).
  Read-only mirror: this board stays the source of truth, only the workflow writes issues.
- PR #7 (claude/tokenless-git-dep-prep, CLAUDE) — tokenless git dependency policy: README/AGENTS.md
  publish-policy flip (owner made this repo public), tag `v1.2.0` pushed as the first stable consumer
  ref, and the `codex/package-git-prepare-20260629` / `codex/package-prepare-and-ci` stale-branch
  evaluation (both superseded/dead, both predate `usageTelemetry.ts`/vitest/CI on `main` — recommended
  for deletion but not deleted here; resolves backlog t167). MERGED 2026-07-04. Consumer-side follow-up:
  Socratic.Trade PR #439 and Congress.Trade PR #139 (both switch their `package.json` to
  `github:jaywedgeworth22/congress-trading-shared#semver:^1.2.x`). No code change needed beyond
  docs: `package.json` already had a working `prepare` script, proven with a clean tokenless
  `npm install github:...#main`. See `docs/rollouts/2026-07-04-tokenless-git-dependency.md`.
  _2026-07-05 (CLAUDE next-wave): CORRECTED — Socratic.Trade `main` actually pins the EXACT tag
  `git+https://...#v1.2.0`, not a semver range; only Congress.Trade uses `#semver:^1.2.x`. So:
  Socratic.Trade = exact `#v1.2.0` pin (requires an explicit pin-string bump each release);
  Congress.Trade = semver range (lockfile refresh only, no package.json edit needed). This changes
  the v1.3.0 release-train checklist — see new Planned row below._

## In Progress
- **Codex autofix storm guard (CODEX, workflow/fleet-infra) — DONE-local 2026-07-05; awaiting push/PR.**
  Scope: reduce caller `codex-autofix.yml` storm odds/frequency in Socratic.Trade and
  Congress.Trade; shared reusable workflow inspected/documented for compatibility. Preserve manual
  dispatch, round-cap behavior, and the shared reusable prompt/action infrastructure.

- **Split `TICKER_ALIASES` into rename-vs-acquisition classes — SHARED-LIBRARY PORTION (MONET,
  `monet/sad-hermann-671f4d`) — DONE-local 2026-07-05 (committed `03d33bd`; owner push/PR/tag
  pending).** Additive, backward-compatible API in THIS package only: `TICKER_RENAMES` (FB→META,
  SQ→XYZ, GEHCV→GEHC continuous entities) + `TICKER_ACQUISITIONS` (BRCM→AVGO, TWX→WBD, ATVI→MSFT,
  RHT→IBM delisted/successor); `TICKER_ALIASES` kept as their union (still 7 entries);
  `classifyTickerAlias()`/`TickerAliasClass`/`TickerAliasResolution` + PIT-safe
  `resolveContinuousTicker()`; +26 tests; design doc; v1.3.0 bump. Verified: tsc clean, 263 tests
  pass, build green (6 new symbols in dist .d.ts), npm audit 0 vulns, tokenless CJS+ESM install
  smoke, 3-lens adversarial review (no blockers). Consumer migration (Congress.Trade
  `normalizer.ts:492` + `tickerNormalize.ts:201` fold sites → renames-only, `pitScores.ts`
  delisting metadata; Socratic.Trade `ACQUISITION_SOURCES` guard) stays OWNER-GATED per AGENTS.md —
  remains AG's follow-up. Doc: `docs/rollouts/2026-07-05-ticker-alias-rename-vs-acquisition.md`.
  _Seat-attribution note (2026-07-05): row was flipped MONET→CLAUDE→MONET during the seat-identity
  confusion; owner settled the seat model (AGENT_SEAT env pin per app; no inference from local
  state). Row stands as MONET's; branch is `monet/sad-hermann-671f4d`._
  _2026-07-05 (CLAUDE next-wave): annotation — the row is accurate about being owner-gated but
  omits that `03d33bd` is stacked on the unpushed CURSOR tip (`6300b89`); it cannot be pushed/PR'd
  independently — a PR opened from this branch today would silently carry all 6 CURSOR commits
  too. Sequencing: `v1.3.0` landing is sequenced AFTER the cursor branch lands (or this commit is
  rebased onto `origin/main`); treat cursor-land -> monet-land -> tag v1.3.0 -> consumer bumps as
  one coordinated train (see new Planned row below)._
- ~~Tokenless git-install prep (claude/tokenless-git-dep-prep -> finish + tag; CLAUDE resumed worker; sync-26).~~
  _2026-07-04 (CLAUDE): stale row — this work merged as PR #7 (see Completed); corrected in place._
- Codex global coordination + fleet monitoring setup (Codex, shared `/Users/jay/apps`
  infra) — include this package in the standardized Codex bootstrap/audit path;
  no package code changes in this repo.

## Planned / Reserved
- CI standard adoption (cross-app, Claude) — RESERVED: 5-line caller workflow consuming the Socratic.Trade reusable verify gate + Mac runner registration. Blocked by: hub repo's reusable `workflow_call` verify gate not built yet — `claude/ci-actions-efficiency` landed WITHOUT producing it (docs-only fast path); current dependency is Socratic.Trade PR #372 (`claude/ci-hybrid-runner-verify`, open) + follow-on reusable entry point. _2026-07-05 (CLAUDE): blocker re-verified and updated._
  _2026-07-05 (CLAUDE next-wave): blocker check re-verified again this cycle — confirmed
  `claude/ci-hybrid-runner-verify` does not exist on Socratic.Trade's origin and no reusable
  verify-gate workflow is on its `main` (only the #370 docs-fast-path efficiency change landed).
  Still blocked; the companion Completed-section blocker-check row above is answerable and closed
  as of this pass — nothing further to do here except wait on the Socratic.Trade side._

_2026-07-04 backlog exhaustiveness pass (CLAUDE, owner-directed). Tags: CURSOR = Cursor background
agents (DeepSeek v4 Pro), AG = Antigravity/Gemini, CLAUDE = Claude Code. Assignments are
reservations, not locks — re-negotiate in #agent-sync._

- **Split `TICKER_ALIASES` into rename-vs-acquisition classes (AG, M, cross-app)** — ATVI→MSFT is
  undifferentiated from FB→META; Socratic.Trade guards locally (`ACQUISITION_SOURCES`),
  Congress.Trade has no guard. Design the shared API change, surface to owner, then update both
  consumers. Paired rows on both consumer boards.
  _2026-07-05: shared-library portion picked up — see In Progress (`monet/sad-hermann-671f4d`).
  Remaining AG scope after that lands = consumer migration only (Congress.Trade + Socratic.Trade)._
- **Scheduled dependency-vulnerability automation (AG, S)** — `npm audit` only runs on push; add
  Dependabot or a cron audit so transitive vulns surface between pushes.
- **LICENSE decision for the now-public repo (unassigned, S)** — `UNLICENSED` + public repo is
  implicit; owner to decide explicit proprietary notice vs a permissive license.
- ~~**Repair the stale Mac clone `main` (CLAUDE, S)**~~ _2026-07-05 (CLAUDE): done — see Completed._

_Moved to In Progress 2026-07-05 (CURSOR): test coverage (L), SecurityRef subset test (S),
stale branch deletion (S), publish.yml decommission (S), CHANGELOG.md (S), engines.node (S) —
all since Completed, see above._

### 2026-07-05 next-wave (cycle 2)
_Added by CLAUDE next-wave pass. Tags: CURSOR = Cursor background agents, AG = Antigravity/Gemini,
CLAUDE = Claude Code, CODEX = Codex, OWNER = owner-run step. Assignments are reservations, not
locks — re-negotiate in #agent-sync._

- **Add npm test to the CI verify job in ci.yml (CURSOR, S)** — Insert a 'npm test' (vitest run)
  step into `.github/workflows/ci.yml` between typecheck and build; today CI runs
  typecheck/build/audit/pack:dry only. _(why now: the just-written 237-263-test suite gates
  nothing — a change that breaks every schema test still merges green. Cheapest highest-value
  follow-up unlocked by the cursor branch landing; land it immediately after (or as a rider on)
  that PR.)_
- **Run the v1.3.0 release train: land cursor stack, land monet split, tag, bump consumers
  (OWNER, M)** — Push `cursor` (5 commits) -> PR -> merge; then push `monet/sad-hermann-671f4d`
  (`03d33bd`, stacked on cursor) -> PR -> merge; tag+push `v1.3.0`; then Socratic.Trade exact-pin
  edit `#v1.2.0` -> `#v1.3.0` + Congress.Trade lockfile refresh against `#semver:^1.2.x`; verify
  both consumers' builds. _(why now: all post-v1.2.0 work is stranded on one Mac clone with zero
  open PRs — a single point of failure. The monet commit is stacked on cursor's unpushed tip so
  the two must land in sequence; MONET's row already says owner push/PR/tag pending. This also
  lets the effort-issues sync close open issues #17-#23.)_
- **Enable a required-status-check ruleset on main gating on the CI verify job (CLAUDE, S)** —
  Repo has no rulesets (`[]`) and no classic branch protection (404) — add a ruleset requiring the
  ci.yml verify job (and requiring PRs) on main, mirroring the Socratic.Trade pattern. _(why now:
  verified this session — CI is purely advisory today; anyone can merge red or push directly to
  main. Becomes materially important the moment tests enter CI, and cheap to do now that the fleet
  already runs this pattern in the other two repos.)_
- **Add a tokenless git-install smoke job to CI (pack + install + CJS/ESM import) (CODEX, S)** —
  CI job that installs the package the way consumers do (`npm install <tarball or github:...>`)
  into a temp project and imports it via both `require()` and `import`, asserting a couple of
  exports exist. _(why now: both consumers install via tokenless git dependency relying on the
  prepare-script build and the exports map; MONET verified this manually for v1.3.0 — automating
  it catches prepare/exports-map regressions that typecheck/build/pack:dry cannot.)_
- **Add vitest coverage reporting with a minimum-threshold gate (CURSOR, S)** — Add
  `@vitest/coverage-v8`, a coverage config in `vitest.config.ts` with line/branch thresholds set
  just below current levels, and run it in CI. _(why now: now that near-complete coverage of
  schemas/utils/constants exists, a ratchet threshold prevents silent rot as new schemas are
  added; without it the new suite decays exactly like the pre-test era. Sequence after the
  npm-test CI step lands.)_
- **Prune merged claude/* branches on origin (CURSOR, S)** — Delete the 8 merged remote branches
  (`claude/agent-sync-stanza`, `claude/effort-issues-mirror`, `claude/tokenless-git-dep-prep`,
  `claude/board-backlog-pass`, `claude/board-effort-sync-refinements`,
  `claude/effort-sync-rate-limit-hardening`, `claude/effort-sync-review-refinements`,
  `claude/delegation-standard`) after confirming each is fully merged into origin/main. _(why now:
  the mechanical batch only deleted the two codex/* branches; the merged claude/* set still
  clutters origin and makes the branch list unreadable for the next agent triaging what is
  actually unlanded.)_
- **Re-verify the Socratic.Trade guard site cited by the consumer-migration row (AG, S)** — The
  board/rollout cite a local `ACQUISITION_SOURCES` guard in Socratic.Trade, but grep of its
  current `src/` finds no such symbol — locate where (or whether) Socratic.Trade still folds
  acquisition tickers before writing the migration plan. _(why now: the AG-reserved consumer
  migration for v1.3.0 is scoped against a symbol that no longer exists in-tree; migrating against
  a stale map wastes the reservation and risks missing the real fold site. Cheap re-scope before
  the pin bump lands.)_
- **Correct docs/RELEASE.md consumer list (api-usage-monitor is not a consumer) (CURSOR, S)** —
  `docs/RELEASE.md` (on the cursor branch) tells releasers to notify Congress.Trade, Agentic
  Trading, and api-usage-monitor, but API-usage-monitor's `package.json` has no dependency on this
  package; also document the exact-tag vs semver-range pin split between the two real consumers.
  _(why now: first tagged release using this new process is imminent (v1.3.0); a wrong consumer
  list and a missing pin-style note will misdirect the very train it was written for. Can be fixed
  before/while the cursor branch lands.)_

## Resolved backlog items
- t167 (stale prepare-script branches) — `codex/package-git-prepare-20260629` and
  `codex/package-prepare-and-ci` both diverged from `main` on 2026-06-29, before
  `usageTelemetry.ts`/vitest/CI workflows landed; the `prepare` script they intended to add
  is already present and working on `main`. **Deleted from origin 2026-07-05 (CURSOR).**
  Full verdict in `docs/rollouts/2026-07-04-tokenless-git-dependency.md`.

## Changelog of this log
- 2026-07-05 — MONET: **v1.3.0 DEPLOYED.** Ran the owner-directed release train — merged PR #53
  (MONET `TICKER_ALIASES` split + CURSOR's stranded stack + release-hygiene commit) to `main`
  `4c35df2` and tagged `v1.3.0`; verified tokenless git-install from the tag. Added the Deployed
  row above. Did NOT rewrite the next-wave-owned In-Progress/Completed cursor rows or their issue
  keys — flagged for the board-owner to reconcile.
- 2026-07-05 — CLAUDE: completed both reserved CLAUDE lanes: stale-main repair (salvage-verified
  SUBSUMED via 2-lens + adversarial-verify workflow, then `git branch -f main origin/main`, now
  0/0) and CI-adoption blocker check (blocker not cleared — moved to Socratic.Trade PR #372 +
  unbuilt reusable gate; Planned row updated). Reconciled this mirror to the live board (CURSOR/AG/
  CODEX/MONET 2026-07-05 rows were live-board-only until now).
- 2026-07-05 — seat-identity note: the sad-hermann row attribution was flipped MONET→CLAUDE→MONET
  during the seat confusion; owner settled the seat model (AGENT_SEAT env pin per app, no
  inference from local state). Row stands as MONET's.
- 2026-07-05 — CURSOR: completed mechanical repo maintenance batch (stale branch deletion,
  publish.yml decommission, engines.node, CHANGELOG.md + docs/RELEASE.md); moved t167 from
  "recommended for deletion" to "deleted".
- 2026-07-05 — CURSOR: moved 6 CURSOR-assigned tasks from Planned to In Progress, then Completed
  (tests lane + mechanical cleanup lane).
- 2026-07-05 — MONET: DONE-local the shared-library portion of the TICKER_ALIASES
  rename-vs-acquisition split (`monet/sad-hermann-671f4d`, commit `03d33bd`, additive v1.3.0).
  Owner push/PR/tag pending.
- 2026-07-04 — bootstrapped by CLAUDE (effort-log standardization).
- 2026-07-04 — CLAUDE: tokenless git dependency switch + stale-branch verdict (t167).
- 2026-07-04 — CLAUDE: backlog exhaustiveness + assignment pass (owner-directed); seeded Planned
  from a full package audit.
- 2026-07-04 — CLAUDE: reconciled repo mirror to live board — moved PR #4 and PR #7 to Completed,
  corrected the stale "Tokenless git-install prep" row in place, and mirrored the Planned/Reserved
  backlog section verbatim from the live board.
- 2026-07-05 — CLAUDE (next-wave, cycle 2): applied stale-row corrections — split the CURSOR test-
  coverage row and mechanical-maintenance row back to In Progress as DONE-local-unpushed (only
  `codex/*` branch deletion actually reached origin; test suite + publish.yml decommission +
  engines.node + CHANGELOG.md/RELEASE.md are still local-only on `cursor`, 5 commits behind
  `origin/cursor`, no PR open); annotated the MONET `sad-hermann` row with the cursor-stacking
  dependency; corrected the PR #7 row's pin-style claim (Socratic.Trade = exact `#v1.2.0` tag,
  Congress.Trade = `#semver:^1.2.x` range — not both semver); re-verified and re-confirmed both
  the CI-adoption blocker (still blocked on Socratic.Trade PR #372 not existing) and the stale-
  main-clone repair (already correctly Completed, `main`/`origin/main` confirmed identical at
  `071a17d`). Added 7 new Planned rows under "2026-07-05 next-wave (cycle 2)": CI verify-job npm
  test step, the v1.3.0 release-train sequencing row, a required-status-check ruleset, a tokenless
  install-smoke CI job, vitest coverage-threshold gating, pruning 8 merged `claude/*` branches, and
  two scoping fixes (Socratic.Trade `ACQUISITION_SOURCES` re-verify, docs/RELEASE.md consumer-list
  correction). No package code touched from this seat. Mirrored verbatim from the live board.
