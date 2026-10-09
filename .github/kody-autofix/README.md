# Kody fix proposal workflow

This is separate infrastructure from the existing Codex autofix workflow.  It produces a draft proposal for a current, human-authored, same-repository PR after a verified successful Kody check.  It never merges the proposal or updates the source PR branch.  Keep both setup PRs and generated proposals in draft.  The existing shared-repository auto-merge workflow skips drafts and does not arm auto-merge.

## Disabled setup is the default

The caller generator is offline and writes only YAML to standard output.  It does not read repository inventory, contact GitHub, create an environment, install a credential, or change a variable.

Generate a caller with a reviewed repository ID, source profile, source scopes, and the exact commit containing the shared reusable workflow:

```sh
node .github/kody-autofix/generate-caller.mjs \
  --repository-id 123456789 \
  --profile web \
  --source-prefixes '["src/","server/"]' \
  --shared-sha "$VERIFIED_WORKFLOW_COMMIT" \
  > /tmp/kody-autofix.yml
```

Supported profiles are `web`, `swift`, `python`, `static`, and `blocked`.  Source scopes are a JSON array of up to eight normalized directory prefixes ending in `/` or exact source filenames.  Exact files must be eligible for the selected profile, for example `index.html` for `static` or `catalog.py` for `python`.  The `blocked` profile can use `[]` and cannot authorize paid attempts.  Configuration-only, policy, package-distribution, and unsupported repositories must stay blocked until separately reviewed.

A generated caller has `daily_attempt_limit: 0` and `budget_policy_id: pending`.  Both the caller and shared workflow require `SWU_KODY_AUTOFIX_ENABLED` to equal the string `true`; a missing variable is disabled.  The controller independently fails closed when the allocation is zero or pending.  Merging a disabled caller alone does not enable paid work.

Generating a positive allocation requires all of `--daily-attempt-limit` (1–5), `--budget-policy-id` (`approved-` followed by 1–64 letters, digits, underscores, or hyphens), and `--acknowledge-paid-attempts`.  These flags record an already approved allocation; they are not approval by themselves and still do not enable the repository variable.  Owner approval of budget allocations and activation remains necessary.

The quota is a real per-repository UTC-day attempt-slot limit, not an organization-wide or dollar-denominated cap.  Dollar cost can vary.  A fleet-wide dollar guarantee requires separately approved allocation and enforcement, and this setup does not claim one.

## Trust and secret boundaries

The shared workflow accepts only `workflow_call`, and generated callers accept only `check_run.completed`.  Both require app ID `413034`, sender bot ID `148880201`, sender login `kody-ai[bot]`, a successful conclusion, and one linked PR.  The controller re-fetches the check and PR and enforces identity, repository, exact head, and eligible unresolved findings.  Re-runs are rejected.

Every job checks out only the public shared helper repository at one immutable helper commit, with checkout credentials persistence disabled.  It never checks out or executes the target PR.  The helper revision is fixed independently when the reusable workflow is published.  The caller's shared-workflow pin and the reusable workflow's helper pin are distinct: publish the helper commit first, then pin it in the reusable workflow, then generate callers against the commit containing that workflow.

Jobs have separate privileges:

1. `prepare` has read-only contents, PR, and check access and creates a bounded snapshot.
2. `reserve` has contents write plus read access and creates durable attempt and daily-slot refs.  The controller only creates these refs; it does not update or delete reservations.
3. `generate` has read-only contents/artifact access and the protected `kody-autofix` environment.  A pinned scanner checks context before the provider key is injected into the generation step.  Generation runs the pinned tool-less CLI.  A separate key-free scanner step checks generated output before it is uploaded.
4. `publish` has contents and PR write plus read access, revalidates the snapshot and scanner proof, then creates a fresh branch and draft PR.

`KODY_DEEPSEEK_API_KEY` must be stored only in the protected `kody-autofix` environment of the calling repository.  Do not define a repository/organization secret with this name: GitHub secret-name fallback cannot prove an environment-only origin from workflow code.  Configure the environment's protection and reviewer policy separately before activation.  The workflow declares no callable secrets, uses no `secrets: inherit`, and uses no PAT.  The provider credential is present only on the generation step; GitHub credentials are not passed into that step or its model subprocess.

The 15-minute reservation lifetime and UTC day are checked before every upstream model request.  Environment approval delays can therefore consume a reservation without spending on generation.  Failed, cancelled, expired, or ambiguous attempts remain consumed; there is no automatic retry or reservation reclamation.

Artifacts are named for the workflow run and attempt, downloaded only by exact name into `runner.temp`, and retained for one day.  Source and finding snapshots may contain private code, so repository Actions access also controls access to this short-lived material.  No target repository inventory belongs in this public shared directory.

## Fixed dependencies and verification

Action commit pins are copied from the existing reviewed pilot.  Claude Code is pinned to `2.1.289`.  Gitleaks is pinned to `8.30.1`; the Linux x64 archive SHA-256 is `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`, verified against the [official release checksum file](https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt).  Archive verification happens before extraction.  Scanner configuration comes from the trusted helper rather than the target repository.

Run offline tests with stock Node.js:

```sh
node --test .github/kody-autofix/*.node-test.mjs
```

The generator tests cover default-off behavior, explicit allocation acknowledgement, profile/file scopes, hostile input rejection, action and helper pinning, event identity filters, privilege separation, scanner order, artifact handling, and distinct concurrency keys.  They make no GitHub or paid provider calls.  The dedicated `kody-autofix-validation.yml` runs only these offline tests on relevant pull-request and push path changes, using Node 24 and a read-only token.  It does not install or run the real Claude CLI or contact a model provider.  The separate `claude-cli-fixture.mjs` is a local synthetic fixture for checking a separately installed pinned CLI against a mock endpoint; it is intentionally excluded from hosted validation.

Generated proposals target the original feature branch.  In repositories whose PR checks use a `main` base-branch filter, those checks may not run for the generated child PR.  GitHub documents that a `GITHUB_TOKEN`-created PR can create approval-required workflow runs, while normal token pushes do not trigger workflows.  A human must approve those runs when requested.  Missing checks therefore do not mean validation passed; a human must arrange the repository's secret-free checks before adopting the patch.

A successful offline test run does not establish that protected environments, secret placement, repository Actions settings, live Kody event behavior, or paid generation are configured correctly.

## Operational Limits

Daily attempt allocations and activation settings remain unapproved in this draft.  No caller is deployed, no protected environment or credential was configured, and no provider request was made.  The CLI dollar estimate is not a verified provider spending cap.  Aggregate organization spending requires approved allocations and a separately verified budget mechanism before enabling any repository.

Source-name filters and secret scanners are defensive checks, not proof that arbitrary business logic contains no sensitive data.  Review exact repository scopes before activation.  Existing same-branch auto-fixers must be retired or kept excluded from activation to prevent competing writers.  New proposals remain draft and unverified; review-thread resolution is always left to a person.

Coordination state and existing effort records were not changed in this isolated implementation lane.  Required coordination remains an activation prerequisite.  The legacy reusable workflow and package runtime/build outputs are unchanged.
