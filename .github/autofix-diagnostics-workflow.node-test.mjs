import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

// Every workflow file this test inspects is parsed and validated before any
// value is read out of it (Kody on cts #394):  raw-text navigation of a
// disk-loaded workflow can be silently satisfied by a shape the assertions
// never intended, so the structure below is the only way steps, jobs and
// secret mappings are located.  Value-level regexes still run, but only
// against fields of a validated step or job.
const StepSchema = z.object({
  name: z.string().optional(),
  id: z.string().optional(),
  if: z.union([z.string(), z.boolean()]).optional(),
  uses: z.string().optional(),
  run: z.string().optional(),
  env: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  with: z.record(z.string(), z.unknown()).optional(),
  'continue-on-error': z.union([z.boolean(), z.string()]).optional(),
}).passthrough();
const JobSchema = z.object({
  'runs-on': z.union([z.string(), z.array(z.string())]).optional(),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  // Widened past the shapes this test asserts on (Kody on cts #394):  a
  // valid upstream Actions shape must never make the schema itself throw.
  if: z.unknown().optional(),
  uses: z.string().optional(),
  secrets: z.record(z.string(), z.string()).optional(),
  permissions: z.union([z.record(z.string(), z.string()), z.string()]).optional(),
  outputs: z.record(z.string(), z.string()).optional(),
  steps: z.array(StepSchema).optional(),
}).passthrough();
const CallableSecretSchema = z.object({
  required: z.boolean().optional(),
}).passthrough();
const WorkflowSchema = z.object({
  name: z.string(),
  // The on.workflow_call.secrets contract is validated too (Kody on cts
  // #394):  the secret-name assertions below must come from parsed YAML,
  // never from raw text a malformed file could satisfy by accident.
  on: z.object({
    workflow_call: z.object({
      secrets: z.record(z.string(), CallableSecretSchema).optional(),
    }).passthrough().optional(),
  }).passthrough().optional(),
  jobs: z.record(z.string(), JobSchema),
}).passthrough();
function parseOrAssert(yaml, label) {
  // A schema violation is a contract failure with the offending shape in the
  // message, never an unhandled module abort (Kody on cts #394).
  try {
    return WorkflowSchema.parse(parseYaml(yaml));
  } catch (err) {
    assert.fail(`${label} is not a valid callable workflow shape: ${err.message.slice(0, 400)}`);
  }
}
const WatchSchema = z.object({
  on: z.object({
    pull_request: z.object({ paths: z.array(z.string()) }).passthrough(),
    push: z.object({ paths: z.array(z.string()) }).passthrough(),
  }).passthrough(),
}).passthrough();

const workflow = readFileSync(new URL('./workflows/codex-autofix-reusable.yml', import.meta.url), 'utf8');
const parsed = WorkflowSchema.parse(parseYaml(workflow));
const autofixJob = parsed.jobs.autofix;
assert(autofixJob && Array.isArray(autofixJob.steps), 'jobs.autofix.steps must be a validated step list');
const stepsParsed = autofixJob.steps;
const modelStep = stepsParsed.find(step => typeof step.uses === 'string' && step.uses.startsWith('anthropics/claude-code-action@'));
const reducerStep = stepsParsed.find(step => step.id === 'diagnostics');
const uploadStep = stepsParsed.find(step => typeof step.uses === 'string' && step.uses.startsWith('actions/upload-artifact@'));
// Raw step text for value-level regexes:  located by the validated structure,
// never by a whole-file slice.
const stepText = step => JSON.stringify(step);

test('failed model steps remain failed and diagnostics run afterward without raw logs', () => {
  assert(modelStep && reducerStep && uploadStep);
  assert(!modelStep['continue-on-error']);
  assert.equal(modelStep.with?.show_full_output, 'false');
  assert.match(workflow, /--max-turns 120\n/);
  assert(stepsParsed.indexOf(modelStep) < stepsParsed.indexOf(reducerStep));
  assert(stepsParsed.indexOf(reducerStep) < stepsParsed.indexOf(uploadStep));
  assert.equal(reducerStep.if, '${{ always() }}');
  assert.match(reducerStep.uses ?? '', /^Simple-With-Us\/congress-trading-shared\/\.github\/actions\/autofix-diagnostics@[a-f0-9]{40}$/);
});

test('failure artifacts contain only the reducer output and expire after seven days', () => {
  assert.equal(uploadStep.if, "${{ always() && steps.diagnostics.outputs.summary-path != '' }}");
  assert.equal(uploadStep.with?.path, '${{ steps.diagnostics.outputs.summary-path }}');
  assert(!stepText(uploadStep).includes('claude-execution-output'));
  assert(!stepText(uploadStep).includes('runner.temp'));
  assert.equal(uploadStep.with?.['if-no-files-found'], 'error');
  assert.equal(uploadStep.with?.['retention-days'], 7);
});

test('usage metering happens in a separate job so the ingest credential never sits beside the model', () => {
  const meterJob = parsed.jobs.meter;
  assert(meterJob && Array.isArray(meterJob.steps), 'jobs.meter.steps must be a validated step list');
  const extractStep = stepsParsed.find(step => step.name === 'Extract Usage Counts');
  // The model job extracts counters only and holds no credential.
  assert(extractStep);
  assert.match(extractStep.run ?? '', /select\(\.type == "result"\)/);
  assert.equal(extractStep.if, '${{ always() }}');
  assert(!stepText(extractStep).includes('USAGE_INGEST_TOKEN'));
  assert(stepsParsed.indexOf(modelStep) < stepsParsed.indexOf(extractStep));
  const jobs = workflow.slice(workflow.indexOf('\njobs:'));
  assert.equal((jobs.match(/secrets\.USAGE_INGEST_TOKEN/g) ?? []).length, 1);
  assert(jobs.indexOf('secrets.USAGE_INGEST_TOKEN') > jobs.indexOf('\n  meter:'));
  assert.equal(autofixJob.outputs?.usage, '${{ steps.usage.outputs.json }}');
  // The meter job cannot push or call the GitHub API, and its report step cannot fail the run.
  assert.deepEqual(meterJob.needs, 'autofix');
  assert.equal(meterJob.if, "${{ always() && needs.autofix.result != 'skipped' }}");
  assert.deepEqual(meterJob.permissions, {});
  assert(!stepText(meterJob).includes('MINIMAX_API_KEY'));
  const reportStep = meterJob.steps.find(step => typeof step.uses === 'string' && step.uses.startsWith('Simple-With-Us/congress-trading-shared/.github/actions/ci-usage-report@'));
  assert(reportStep, 'the meter job must report usage through the pinned ci-usage-report action');
  assert.match(reportStep.uses, /@[a-f0-9]{40}$/);
  assert.equal(reportStep['continue-on-error'], true);
  assert.equal(reportStep.with?.harness, 'claude-code-ci');
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
  // green and the autofix loop disabled.  The watch lists are read from the
  // parsed workflow, not a line match, so a reshaped triggers block is a
  // validation error instead of a skipped assertion (Kody on cts #394).
  const validation = WatchSchema.parse(
    parseYaml(readFileSync(new URL('./workflows/autofix-diagnostics-validation.yml', import.meta.url), 'utf8')),
  );
  for (const watched of ['.github/workflows/claude-code-autofix.yml', '.github/workflows/autofix.yml']) {
    assert.ok(validation.on.pull_request.paths.includes(watched), `pull_request paths must watch ${watched}`);
    assert.ok(validation.on.push.paths.includes(watched), `push paths must watch ${watched}`);
  }
  // The secret contract is derived from the parsed caller and callee, never
  // from raw text (Kody on cts #394):  malformed or unknown YAML shapes fail
  // the parse instead of satisfying a regex by accident.  A mapping written
  // in another shape cannot parse into the expected record, and a name wired
  // to the wrong secret is caught by the value comparison.
  const callerParsed = parseOrAssert(caller, 'the local caller');
  const callerJob = Object.values(callerParsed.jobs).find(job => typeof job.uses === 'string' && job.uses.includes('codex-autofix-reusable.yml'));
  assert(callerJob, 'the local caller must have a job using the vendored reusable');
  const passedSecrets = callerJob.secrets ?? {};
  const declaredSecrets = parsed.on?.workflow_call?.secrets ?? {};
  const declaredNames = new Set(Object.keys(declaredSecrets));
  const passedNames = Object.keys(passedSecrets);
  assert.ok(passedNames.length > 0);
  for (const [name, expr] of Object.entries(passedSecrets)) {
    assert.ok(declaredNames.has(name), `the caller passes ${name}, which the reusable does not declare`);
    assert.equal(expr, '${{ secrets.' + name + ' }}', `${name} is forwarded from a different secret`);
  }
  // The other direction matters too:  a secret the reusable marks required must
  // be forwarded, because GitHub refuses to run the reusable when a required
  // secret is missing.
  const requiredNames = Object.entries(declaredSecrets).filter(([, def]) => def.required === true).map(([name]) => name);
  assert.ok(requiredNames.length > 0);
  for (const name of requiredNames) {
    assert.ok(passedNames.includes(name), `the caller must forward ${name}, which the reusable requires`);
  }
  // The org model switch needs the Meta token declared and forwarded.
  assert.equal(declaredSecrets.META_MODEL_API_TOKEN?.required, false, 'the reusable must declare META_MODEL_API_TOKEN as optional');
  assert.equal(passedSecrets.META_MODEL_API_TOKEN, '${{ secrets.META_MODEL_API_TOKEN }}');
  // The switch itself:  the endpoint and the model id come from the org
  // variables, and the credential keeps both branches.  The model id reads
  // loosely here because the Validate Model Switch step below enforces the
  // endpoint/model pairing before the action runs.
  const modelEnv = modelStep.env ?? {};
  assert.match(String(modelEnv.ANTHROPIC_MODEL ?? ''), /vars\.SWU_AUTOFIX_MODEL.*inputs\.model/);
  assert.match(String(modelEnv.ANTHROPIC_SMALL_FAST_MODEL ?? ''), /vars\.SWU_AUTOFIX_MODEL.*inputs\.model/);
  // Request gate allowlist (Kody on cts #394):  a disallowed actor must be
  // skipped before any marker lookup or write,  and only the normalized
  // allowlisted requester may reach the marker.  Located through the
  // validated structure like every other step assertion here.
  const gateStep = stepsParsed.find(step => step.id === 'request_gate');
  assert.ok(gateStep, 'the reusable must have a request gate');
  assert.equal(gateStep.env?.ALLOWED_BOTS, '${{ inputs.allowed_bots }}');
  const gateRun = gateStep.run ?? '';
  assert.match(gateRun, /is not in allowed_bots, skipping before any marker write/, 'a disallowed actor must skip before marker work');
  assert.match(gateRun, /tr 'A-Z' 'a-z'.*\\\[bot\\\]\$/, 'the allowlist is normalized as the action normalizes');
  const allowIdx = gateRun.indexOf('allowed_bots, skipping');
  const lookupIdx = gateRun.indexOf('prior_markers.txt');
  assert.ok(allowIdx > -1 && lookupIdx > -1 && allowIdx < lookupIdx, 'the allowlist check must precede the marker lookup');
  // The marker is keyed only by the normalized requester.
  assert.match(gateRun, /marker="swu-autofix-run: bot=\$requester"/, 'the marker persists only the normalized requester');

  // Pair guard:  the switch is validated as one pair before the action runs,
  // so an endpoint override without SWU_AUTOFIX_MODEL fails the run instead of
  // pairing the Meta host with the default MiniMax model id.  Located through
  // the validated job/step structure, not a regex slice (Kody on cts #394).
  const guardStep = stepsParsed.find(step => step.name === 'Validate Model Switch');
  assert.ok(guardStep, 'the reusable must validate the model switch before running the action');
  assert.ok(stepsParsed.indexOf(guardStep) < stepsParsed.indexOf(modelStep), 'the guard must run before the action step');
  const guard = guardStep.run ?? '';
  // The guard has to be able to stop the run:  a step carrying
  // continue-on-error satisfies every text assertion above while exit 1 no
  // longer fails the job.  The only permitted `if:` is the request gate's
  // skip output - a deliberately skipped request has no model config to
  // validate (Kody on cts #394).
  assert.ok(!guardStep['continue-on-error'], 'the guard must be able to fail the run');
  assert.ok(
    guardStep.if === undefined || guardStep.if === "${{ steps.request_gate.outputs.skip != 'true' }}",
    'only the request gate may skip the guard',
  );
  // Routing must derive from the base variable, and every route needs a
  // success exit:  without an exit 0 per route the guard aborts every run,
  // and without the $VAR_BASE case the Meta host would pair with the default
  // MiniMax model (Kody on cts #394).
  assert.match(guard, /case "\$VAR_BASE" in/, 'routing must derive from $VAR_BASE');
  assert.match(guard, /"" \| https:\/\/api\.minimax\.io\/anthropic\) route=minimax ;;/, 'an unset base or the canonical MiniMax host must stay on MiniMax');
  assert.equal((guard.match(/\bexit 0\b/g) ?? []).length, 2, 'both the MiniMax and Meta routes need a success exit');
  assert.match(guard, /\[ "\$route" = "meta" \] && \[ -n "\$VAR_MODEL" \] && \[ -n "\$META_TOKEN" \] && \[ "\$model_minimax" = "no" \]/, 'the Meta host must require an explicit non-MiniMax model id and a provisioned Meta token');
  assert.match(guard, /\[Mm\]\[Ii\]\[Nn\]\[Ii\]\[Mm\]\[Aa\]\[Xx\]\*\) model_minimax=yes ;;/, 'a MiniMax model id must be detected case-insensitively');
  assert.match(guard, /names a non-MiniMax model id while SWU_AUTOFIX_MODEL_BASE_URL selects the MiniMax host/, 'the MiniMax route must reject a non-MiniMax model id');
  assert.match(guard, /META_MODEL_API_TOKEN provisioned/, 'the failure message must name META_MODEL_API_TOKEN');
  // Caller-controlled values must never reach the workflow command in any
  // quoting style:  after stripping $(...) substitutions (which only emit
  // yes/no flags), no ::error:: line may reference the raw variables at all
  // (Kody on cts #394).
  for (const line of guard.split('\n').filter(l => l.includes('::error::'))) {
    const stripped = line.replace(/\$\([^)]*\)/g, '');
    assert.doesNotMatch(stripped, /\$VAR_(BASE|MODEL)\b|\$\{VAR_(BASE|MODEL)[}]/, 'the failure must not echo raw caller-controlled values');
  }
  assert.match(guard, /exit 1/, 'any other base/model combination must fail fast');
  // The endpoint and the credential are a closed pair:  the only hosts the
  // switch can name are the two presets,  and the credential follows the host
  // instead of falling back to the MiniMax key.  A free-form URL or a
  // contains() host test would let a repository-level variable point the run
  // at an arbitrary host and hand it an org secret,  so the preset is pinned.
  const baseUrl = String(modelEnv.ANTHROPIC_BASE_URL ?? '');
  const authToken = String(modelEnv.ANTHROPIC_AUTH_TOKEN ?? '');
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
  const apiKey = String(modelStep.with?.anthropic_api_key ?? '');
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
  // expectation was updated with them.  The caller job is located through the
  // validated structure (Kody on cts #394).
  const externalWf = WorkflowSchema.parse(
    parseYaml(readFileSync(new URL('./workflows/autofix.yml', import.meta.url), 'utf8')),
  );
  const externalJob = Object.values(externalWf.jobs).find(job => typeof job.uses === 'string' && job.uses.includes('pr-autofix-reusable.yml@'));
  assert(externalJob, 'the external caller job must use the pinned fleet reusable');
  const externalPin = externalJob.uses.match(/pr-autofix-reusable\.yml@([a-f0-9]{40})/);
  assert.ok(externalPin, 'the external fleet reusable must stay pinned by SHA');
  assert.equal(
    externalPin[1],
    'c97a2dae96762eb9ffc122c753f0dfb0a7840650',
    'the external reusable pin changed:  re-check that it still declares every secret this caller forwards, then update this expectation',
  );
  assert.deepEqual(
    Object.keys(externalJob.secrets ?? {}).sort(),
    ['AUTOFIX_GITHUB_APP_PRIVATE_KEY', 'META_MODEL_API_TOKEN', 'MINIMAX_API_KEY', 'USAGE_INGEST_TOKEN'],
    'the secrets forwarded to the external reusable changed:  re-check the external declarations, then update this expectation',
  );
  assert.equal(externalJob.secrets?.META_MODEL_API_TOKEN, '${{ secrets.META_MODEL_API_TOKEN }}');
  // The pinned revision is the file the other caller actually runs,  and it now
  // receives the organization Meta secret,  so it must carry the same closed
  // endpoint preset and fail-closed credential as the vendored copy:  a
  // free-form base URL would let a repository-level variable name any host and
  // receive the org secret as the bearer token.  A pinned revision never
  // changes,  so the check reads the exact file the caller uses.
  const externalReusable = await fetch(
    `https://raw.githubusercontent.com/Simple-With-Us/AI-Fleet-Coordinator/${externalPin[1]}/.github/workflows/pr-autofix-reusable.yml`,
    // A stalled request would hang the run to the job limit,  so the read
    // fails fast instead.
    { signal: AbortSignal.timeout(15_000) },
  );
  assert.ok(externalReusable.ok, 'the pinned external reusable must be readable');
  const externalReusableText = await externalReusable.text();
  // A 200 does not prove the body is the workflow,  so it is parsed and
  // validated before any value is read out of it (Kody on cts #394).
  const externalParsed = parseOrAssert(externalReusableText, 'the pinned external reusable');
  // The live env values come from the step that actually carries them,  found
  // through the validated structure:  the pinned file documents caller
  // snippets inline,  so an unanchored whole-file match could be satisfied by
  // a commented copy while the live env still used the free-form endpoint.
  // The env may sit on the job (current layout) or on a step:  both are live
  // configuration, so the search covers job env first, then every step env.
  const externalJobEnv = Object.values(externalParsed.jobs)
    .find(job => job.env && typeof job.env.ANTHROPIC_BASE_URL === 'string');
  const externalStep = Object.values(externalParsed.jobs)
    .flatMap(job => job.steps ?? [])
    .find(step => step.env && typeof step.env.ANTHROPIC_BASE_URL === 'string');
  const externalEnv = (externalJobEnv ?? {}).env ?? (externalStep ?? {}).env;
  assert(externalEnv, 'the pinned external reusable must set ANTHROPIC_BASE_URL on a real job or step');
  assert.equal(
    externalEnv.ANTHROPIC_BASE_URL,
    "${{ vars.SWU_AUTOFIX_MODEL_BASE_URL == 'https://api.meta.ai' && 'https://api.meta.ai' || 'https://api.minimax.io/anthropic' }}",
    'the external reusable must use the closed endpoint preset, never the free-form variable',
  );
  assert.equal(
    externalEnv.ANTHROPIC_AUTH_TOKEN,
    "${{ vars.SWU_AUTOFIX_MODEL_BASE_URL == 'https://api.meta.ai' && (secrets.META_MODEL_API_TOKEN || 'MISSING-META-MODEL-API-TOKEN') || secrets.MINIMAX_API_KEY }}",
    'the external reusable must fail closed when the Meta credential is absent',
  );
});
