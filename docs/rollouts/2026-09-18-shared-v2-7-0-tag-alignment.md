# 2026-09-18 — Shared `v2.7.0` local tag alignment

## Context & Objective

The local annotated tag `v2.7.0` in `/Users/jay/Code/congress-trading-shared`
had been moved to the local-only commit `af11d706f8fa332fc70402999a9cc954cf419408`
("chore(release): bump to 2.7.0 for cross-app adoption"), while the immutable
remote `refs/tags/v2.7.0` on `origin` peels to
`5748e53d209908fa76dfee5a1834c0c15d03cff3`.  The two commits have identical
trees, so the local ref pointed at a stale-but-equivalent mark and risked
misleading future `git describe` output, `git diff v2.7.0 origin/v2.7.0` checks,
and any tool that inspects the local `v2.7.0` tag in this checkout.

This rollout realigns the local `v2.7.0` tag with the published peeled commit
so the working copy reflects the immutable release that consumers actually
install.  No remote ref, branch, or commit is touched; this is a local-only
tag edit on the Mac checkout.

## Changes Made

- Local-only `git tag -d v2.7.0` (deleted the local annotated tag object
  `01c010c1daeafeb9080be807095a4e8e92e95da7`).
- Local-only `git tag v2.7.0 5748e53d209908fa76dfee5a1834c0c15d03cff3` (creates a
  new lightweight tag at the published peeled commit).
- Live effort board `/Users/jay/apps/CONGRESS-SHARED-EFFORT-LOG.md` — added a
  Completed row documenting the retag.
- Repo mirror `docs/EFFORT-LOG.md` — same row mirrored.
- This rollout note.

No branch, no commit, no `package.json` bump, no remote push, no force-push,
no remote tag delete or recreate, no `scripts/` changes.

## Verification

Executed in `/Users/jay/Code/congress-trading-shared`:

```bash
git fetch --tags origin
git ls-remote --tags origin | grep 'refs/tags/v2.7.0'
# 000c8115873bf779122c574f3ed60f25841b5df5  refs/tags/v2.7.0
# 5748e53d209908fa76dfee5a1834c0c15d03cff3  refs/tags/v2.7.0^{}

git rev-parse v2.7.0                 # pre:  01c010c1daeafeb9080be807095a4e8e92e95da7
git log -1 --format='%H %s' v2.7.0   # pre:  af11d706f8fa332fc70402999a9cc954cf419408 chore(release): bump to 2.7.0 for cross-app adoption

git tag -d v2.7.0
git tag v2.7.0 5748e53d209908fa76dfee5a1834c0c15d03cff3

git rev-parse v2.7.0                 # post: 5748e53d209908fa76dfee5a1834c0c15d03cff3
git rev-parse v2.7.0^{}              # post: 5748e53d209908fa76dfee5a1834c0c15d03cff3
git cat-file -t v2.7.0               # post: commit (lightweight tag)
git ls-remote --tags origin | grep 'refs/tags/v2.7.0^{}'
# 5748e53d209908fa76dfee5a1834c0c15d03cff3  refs/tags/v2.7.0^{}
```

Pre-retag tree-identity check (executed against a temporary snapshot of the
remote tag, deleted after):

```bash
git fetch origin 'refs/tags/v2.7.0:refs/tags/v2.7.0-remote-snapshot'
git diff v2.7.0 v2.7.0-remote-snapshot   # empty
git tag -d v2.7.0-remote-snapshot       # cleanup
```

Post-retag tree-identity check against local `main`:

```bash
git diff v2.7.0 main                    # empty
```

Both diffs empty — the local and remote v2.7.0 commits have identical trees,
so the retag is a pure bookkeeping change with zero behavioural effect on
`npm install github:Simple-With-Us/congress-trading-shared#v2.7.0` consumers.

## Decisions & Trade-offs

- **Tag surgery vs delete-and-refetch.**  `git fetch --tags origin` rejected
  the remote `v2.7.0` with "would clobber existing tag" (correct — the local
  tag object differs from the remote one).  Force-fetching with
  `git fetch --tags -f origin` would have rewritten the local tag without an
  audit trail; the chosen `git tag -d` + `git tag` sequence is explicit,
  local-only, and leaves the remote ref alone.  No force-push to any ref.
- **Lightweight tag (post) vs annotated tag (pre).**  `git tag <name> <sha>`
  creates a lightweight tag; the pre-existing `v2.7.0` was annotated (with a
  Tagger field and the "chore(release)" message).  We deliberately do not
  recreate the annotation — the message described the local-only release-bump
  commit that was never published, and re-tagging with that annotation on the
  published commit would misattribute the release.  A future proper annotated
  tag pointing at `5748e53d` can be cut deliberately by the owning agent if
  the team wants the Tagger/message on the public mark.
- **Companion CT `VENDOR-PROVENANCE.md` edit was a no-op.**  AG's
  `chore(deps): reconcile shared v2.7.0 commit with immutable GitHub tag [AG]`
  (PR #2499, commit `4d493149`) already corrected the line on `main`; the
  file currently reads `Commit: 5748e53d209908fa76dfee5a1834c0c15d03cff3`
  (verified, see "Companion CT check" below).  No second CT PR was opened —
  that would have been a redundant no-op PR against a file AG already
  corrected.

### Companion CT check

```bash
cd /Users/jay/Code/Congress.Trade
git log --oneline -- app/vendor/congress-trading-shared/VENDOR-PROVENANCE.md
# 4d493149 chore(deps): reconcile shared v2.7.0 commit with immutable GitHub tag [AG] (#2499)
# b0429e8f chore(deps): bump congress-trading-shared to v2.7.0 [AG] (#2481)
grep -n '5748e53\|v2.7.0' app/vendor/congress-trading-shared/VENDOR-PROVENANCE.md
# 4:- Immutable release: `v2.7.0`
# 5:- Commit: `5748e53d209908fa76dfee5a1834c0c15d03cff3`
```

CT `origin/main` HEAD: `9e12e9b69e226856e86511df06be95b7357c9696`
(`Patch os.hostname before agentless dd-trace init.` — PR #2513).

## Next Steps & Blockers

None.  No follow-up PRs, no CI to watch, no consumers to update
(Socratic.Trade already pinned to `github:Simple-With-Us/congress-trading-shared#v2.7.0`
per the 2026-09-18 CURSOR PR #305 row).

If a future agent wants the pre-existing annotated tag's Tagger/message
attached to the published commit, they should cut a deliberate annotated tag
(`git tag -a -m "..." v2.7.0 5748e53d`) — that is an authoring decision, not
a fix for this retag, and was deliberately out of scope here.