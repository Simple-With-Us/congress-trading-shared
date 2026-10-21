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
test('the local caller forwards only secrets the vendored reusable declares', () => {
  const caller = readFileSync(new URL('./workflows/claude-code-autofix.yml', import.meta.url), 'utf8');
  const declared = workflow.slice(workflow.indexOf('    secrets:'), workflow.indexOf('\npermissions:'));
  const passed = caller.slice(caller.indexOf('    secrets:'), caller.indexOf('\n    with:'));
  const declaredNames = new Set([...declared.matchAll(/^ {6}([A-Z][A-Z0-9_]*):$/gm)].map(match => match[1]));
  const passedNames = [...passed.matchAll(/^ {6}([A-Z][A-Z0-9_]*): \$\{\{ secrets\./gm)].map(match => match[1]);
  assert.ok(passedNames.length > 0);
  for (const name of passedNames) {
    assert.ok(declaredNames.has(name), `the caller passes ${name}, which the reusable does not declare`);
  }
  // The org model switch needs the Meta token declared and forwarded.
  assert.match(declared, /META_MODEL_API_TOKEN:\n {8}required: false/);
  assert.match(passed, /META_MODEL_API_TOKEN: \$\{\{ secrets\.META_MODEL_API_TOKEN \}\}/);
  // The switch itself:  the endpoint and the model id come from the org
  // variables, and the credential keeps both branches.  The expressions are
  // not pinned literally, so an endpoint preset can replace the free-form URL.
  assert.match(model, /ANTHROPIC_BASE_URL: .*vars\.SWU_AUTOFIX_MODEL/);
  assert.match(model, /ANTHROPIC_AUTH_TOKEN: .*secrets\.META_MODEL_API_TOKEN.*secrets\.MINIMAX_API_KEY/);
  assert.match(model, /ANTHROPIC_MODEL: .*vars\.SWU_AUTOFIX_MODEL.*inputs\.model/);
  assert.match(model, /ANTHROPIC_SMALL_FAST_MODEL: .*vars\.SWU_AUTOFIX_MODEL.*inputs\.model/);
});
