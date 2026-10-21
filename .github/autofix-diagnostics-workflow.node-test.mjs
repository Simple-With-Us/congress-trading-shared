import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('./workflows/codex-autofix-reusable.yml', import.meta.url), 'utf8');
// The model job's steps only:  the `meter` job after it is covered by its own test below.
const steps = workflow.slice(workflow.indexOf('    steps:'), workflow.indexOf('\n  # Best-effort metering')).split(/\n      - /).slice(1);
const model = steps.find(step => step.includes('uses: anthropics/claude-code-action@'));
const reducer = steps.find(step => step.includes('id: diagnostics'));
const upload = steps.find(step => step.includes('uses: actions/upload-artifact@'));

test('failed model steps remain failed and diagnostics run afterward without raw logs', () => {
  assert(model && reducer && upload);
  assert(!model.includes('continue-on-error'));
  assert.match(model, /show_full_output: "false"/);
  assert.match(workflow, /--max-turns 120\n/);
  assert(steps.indexOf(model) < steps.indexOf(reducer));
  assert(steps.indexOf(reducer) < steps.indexOf(upload));
  assert.match(reducer, /if: \$\{\{ always\(\) \}\}/);
  assert.match(reducer, /uses: Simple-With-Us\/congress-trading-shared\/\.github\/actions\/autofix-diagnostics@[a-f0-9]{40}\s/);
});

test('failure artifacts contain only the reducer output and expire after seven days', () => {
  assert.match(upload, /if: \$\{\{ always\(\) && steps\.diagnostics\.outputs\.summary-path != '' \}\}/);
  assert.match(upload, /path: \$\{\{ steps\.diagnostics\.outputs\.summary-path \}\}\n/);
  assert.equal((upload.match(/\n\s+path:/g) || []).length, 1);
  assert(!upload.includes('claude-execution-output'));
  assert(!upload.includes('runner.temp'));
  assert.match(upload, /if-no-files-found: error/);
  assert.match(upload, /retention-days: 7\s*$/);
});

test('usage metering happens in a separate job so the ingest credential never sits beside the model', () => {
  const meter = workflow.slice(workflow.indexOf('\n  meter:'));
  const extract = steps.find(step => step.includes('name: Extract Usage Counts'));
  // The model job extracts counters only and holds no credential.
  assert(extract);
  assert.match(extract, /select\(\.type == "result"\)/);
  assert.match(extract, /if: \$\{\{ always\(\) \}\}/);
  assert(!extract.includes('USAGE_INGEST_TOKEN'));
  assert(steps.indexOf(model) < steps.indexOf(extract));
  const jobs = workflow.slice(workflow.indexOf('\njobs:'));
  assert.equal((jobs.match(/secrets\.USAGE_INGEST_TOKEN/g) ?? []).length, 1);
  assert(jobs.indexOf('secrets.USAGE_INGEST_TOKEN') > jobs.indexOf('\n  meter:'));
  assert.match(workflow, /outputs:\n      usage: \$\{\{ steps\.usage\.outputs\.json \}\}/);
  // The meter job cannot push or call the GitHub API, and its report step cannot fail the run.
  assert.match(meter, /needs: autofix/);
  assert.match(meter, /if: \$\{\{ always\(\) && needs\.autofix\.result != 'skipped' \}\}/);
  assert.match(meter, /permissions: \{\}/);
  assert(!meter.includes('MINIMAX_API_KEY'));
  assert.match(meter, /continue-on-error: true\n        uses: Simple-With-Us\/congress-trading-shared\/\.github\/actions\/ci-usage-report@[a-f0-9]{40}\n/);
  assert.match(meter, /harness: claude-code-ci/);
  assert.match(workflow, /USAGE_INGEST_TOKEN:\n        required: false/);
});

// A caller that forwards a secret the callee does not declare fails static
// validation ("Invalid secret, X is not defined"), which disables the whole
// autofix loop, so the contract is asserted here.
test('the local caller forwards only secrets the vendored reusable declares', async () => {
  const caller = readFileSync(new URL('./workflows/claude-code-autofix.yml', import.meta.url), 'utf8');
  // This test only runs when the diagnostics validation workflow watches the
  // files it covers,  so the caller must stay on that watch list:  a change to
  // the caller alone would otherwise ship an invalid secret mapping with CI
  // green and the autofix loop disabled.
  const validation = readFileSync(new URL('./workflows/autofix-diagnostics-validation.yml', import.meta.url), 'utf8');
  assert.equal(
    (validation.match(/^ {6}- '\.github\/workflows\/claude-code-autofix\.yml'$/gm) ?? []).length,
    2,
    'the diagnostics validation workflow must watch the caller in both its pull_request and push path lists',
  );
  const declared = workflow.slice(workflow.indexOf('    secrets:'), workflow.indexOf('\npermissions:'));
  const passed = caller.slice(caller.indexOf('    secrets:'), caller.indexOf('\n    with:'));
  const declaredNames = new Set([...declared.matchAll(/^ {6}([A-Z][A-Z0-9_]*):$/gm)].map(match => match[1]));
  // Both the forwarded name and the secret it maps to are captured, so a
  // mapping written in another shape is counted as unparsed instead of being
  // skipped, and a name wired to the wrong secret is caught here.
  const passedEntries = [...passed.matchAll(/^ {6}([A-Z][A-Z0-9_]*): \$\{\{ secrets\.([A-Z][A-Z0-9_]*) \}\}$/gm)];
  const passedNames = passedEntries.map(match => match[1]);
  assert.ok(passedNames.length > 0);
  assert.equal(
    passedNames.length,
    (passed.match(/^ {6}[A-Z][A-Z0-9_]*:/gm) ?? []).length,
    'a forwarded secret mapping was not parsed',
  );
  for (const [, name, secret] of passedEntries) {
    assert.ok(declaredNames.has(name), `the caller passes ${name}, which the reusable does not declare`);
    assert.equal(name, secret, `${name} is forwarded from secrets.${secret}`);
  }
  // The other direction matters too:  a secret the reusable marks required must
  // be forwarded, because GitHub refuses to run the reusable when a required
  // secret is missing.
  const requiredNames = [...declared.matchAll(/^ {6}([A-Z][A-Z0-9_]*):\n {8}required: true$/gm)].map(match => match[1]);
  assert.ok(requiredNames.length > 0);
  for (const name of requiredNames) {
    assert.ok(passedNames.includes(name), `the caller must forward ${name}, which the reusable requires`);
  }
  // The org model switch needs the Meta token declared and forwarded.
  assert.match(declared, /META_MODEL_API_TOKEN:\n {8}required: false/);
  assert.match(passed, /META_MODEL_API_TOKEN: \$\{\{ secrets\.META_MODEL_API_TOKEN \}\}/);
  // The switch itself:  the endpoint and the model id come from the org
  // variables, and the credential keeps both branches.  The model id reads
  // loosely here because the Validate Model Switch step below enforces the
  // endpoint/model pairing before the action runs.
  assert.match(model, /ANTHROPIC_MODEL: .*vars\.SWU_AUTOFIX_MODEL.*inputs\.model/);
  assert.match(model, /ANTHROPIC_SMALL_FAST_MODEL: .*vars\.SWU_AUTOFIX_MODEL.*inputs\.model/);
  // Pair guard:  the switch is validated as one pair before the action runs,
  // so an endpoint override without SWU_AUTOFIX_MODEL fails the run instead of
  // pairing the Meta host with the default MiniMax model id.
  const guard = workflow.match(/- name: Validate Model Switch[\s\S]*?(?=\n      - name:)/)?.[0] ?? '';
  assert.ok(guard, 'the reusable must validate the model switch before running the action');
  assert.ok(guard.indexOf('Run Claude Autofix') === -1, 'guard slice must stop before the action step');
  assert.match(guard, /if \[ -z "\$VAR_BASE" \]; then exit 0; fi/, 'an unset base must stay on MiniMax');
  assert.match(guard, /"\$VAR_BASE" = "https:\/\/api\.meta\.ai" \] && \[ -n "\$VAR_MODEL"/, 'the Meta host must require an explicit Meta model id');
  assert.match(guard, /exit 1/, 'any other base/model combination must fail fast');
  // The endpoint and the credential are a closed pair:  the only hosts the
  // switch can name are the two presets,  and the credential follows the host
  // instead of falling back to the MiniMax key.  A free-form URL or a
  // contains() host test would let a repository-level variable point the run
  // at an arbitrary host and hand it an org secret,  so the preset is pinned.
  const baseUrl = model.match(/^ *ANTHROPIC_BASE_URL:.*$/m)?.[0] ?? '';
  const authToken = model.match(/^ *ANTHROPIC_AUTH_TOKEN:.*$/m)?.[0] ?? '';
  const metaHost = "vars.SWU_AUTOFIX_MODEL_BASE_URL == 'https://api.meta.ai'";
  assert.ok(baseUrl.includes(metaHost), 'the endpoint must be a closed preset, never a free-form URL');
  assert.ok(authToken.includes(metaHost), 'the credential must follow the same host preset as the endpoint');
  assert.deepEqual(
    [...new Set([...baseUrl.matchAll(/https?:\/\/[^\s'"}]+/g)].map(match => match[0]))],
    ['https://api.meta.ai', 'https://api.minimax.io/anthropic'],
    'the endpoint may name only the two preset hosts',
  );
  // Fail closed:  a Meta run without META_MODEL_API_TOKEN must not reach the
  // Meta host carrying the MiniMax credential.  The whole credential expression
  // is matched, so the MiniMax key can only appear after the Meta group
  // closes:  a term inside that group would let a missing Meta token fall back
  // to the MiniMax credential on the Meta host.
  const metaBranch = authToken.slice(authToken.indexOf(metaHost) + metaHost.length);
  assert.match(
    metaBranch,
    /^\s*&&\s*\(secrets\.META_MODEL_API_TOKEN \|\| 'MISSING-[A-Z-]+'\)\s*\|\|\s*secrets\.MINIMAX_API_KEY/,
    'the MiniMax credential must be the fallback of the whole expression, not a term inside the Meta branch',
  );
  // anthropic_api_key feeds claude-code-action directly (its inline-comment
  // classifier ignores ANTHROPIC_BASE_URL),  so it must follow the same host
  // preset as ANTHROPIC_AUTH_TOKEN instead of always sending the MiniMax key.
  const apiKey = model.match(/^ *anthropic_api_key:.*$/m)?.[0] ?? '';
  assert.ok(apiKey.includes(metaHost), 'anthropic_api_key must follow the same host preset as the endpoint');
  assert.match(
    apiKey.slice(apiKey.indexOf(metaHost) + metaHost.length),
    /^\s*&&\s*\(secrets\.META_MODEL_API_TOKEN \|\| 'MISSING-[A-Z-]+'\)\s*\|\|\s*secrets\.MINIMAX_API_KEY/,
    'anthropic_api_key must fall back to the MiniMax key only outside the Meta branch',
  );
  // The other caller of the fleet's reusable workflow is external and pinned by
  // SHA, so its declarations cannot be read from this repo.  The pin and the
  // forwarded secret names are therefore expected together here:  a pin bump
  // fails this test until the external declarations were re-checked and this
  // expectation was updated with them.
  const external = readFileSync(new URL('./workflows/autofix.yml', import.meta.url), 'utf8');
  const externalPin = external.match(/pr-autofix-reusable\.yml@([a-f0-9]{40})/);
  assert.ok(externalPin, 'the external fleet reusable must stay pinned by SHA');
  assert.equal(
    externalPin[1],
    'a652e46755412be2201a2f406e50a422c1376b4c',
    'the external reusable pin changed:  re-check that it still declares every secret this caller forwards, then update this expectation',
  );
  assert.deepEqual(
    [...external.matchAll(/^ {6}([A-Z][A-Z0-9_]*): \$\{\{ secrets\./gm)].map(match => match[1]).sort(),
    ['AUTOFIX_GITHUB_APP_PRIVATE_KEY', 'META_MODEL_API_TOKEN', 'MINIMAX_API_KEY', 'USAGE_INGEST_TOKEN'],
    'the secrets forwarded to the external reusable changed:  re-check the external declarations, then update this expectation',
  );
  assert.match(external, /META_MODEL_API_TOKEN: \$\{\{ secrets\.META_MODEL_API_TOKEN \}\}/);
  // The pinned revision is the file the other caller actually runs,  and it now
  // receives the organization Meta secret,  so it must carry the same closed
  // endpoint preset and fail-closed credential as the vendored copy:  a
  // free-form base URL would let a repository-level variable name any host and
  // receive the org secret as the bearer token.  A pinned revision never
  // changes,  so the check reads the exact file the caller uses.
  const externalReusable = await fetch(
    `https://raw.githubusercontent.com/Simple-With-Us/AI-Fleet-Coordinator/${externalPin[1]}/.github/workflows/pr-autofix-reusable.yml`,
  );
  assert.ok(externalReusable.ok, 'the pinned external reusable must be readable');
  const externalReusableText = await externalReusable.text();
  assert.match(
    externalReusableText,
    /ANTHROPIC_BASE_URL: \$\{\{ vars\.SWU_AUTOFIX_MODEL_BASE_URL == 'https:\/\/api\.meta\.ai' && 'https:\/\/api\.meta\.ai'/,
    'the external reusable must use the closed endpoint preset, never the free-form variable',
  );
  assert.match(
    externalReusableText,
    /ANTHROPIC_AUTH_TOKEN: \$\{\{ vars\.SWU_AUTOFIX_MODEL_BASE_URL == 'https:\/\/api\.meta\.ai' && \(secrets\.META_MODEL_API_TOKEN \|\| 'MISSING-[A-Z-]+'\)/,
    'the external reusable must fail closed when the Meta credential is absent',
  );
});
