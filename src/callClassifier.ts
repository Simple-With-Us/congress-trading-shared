// =============================================================================
// congress-trading-shared — call classifier metadata
// =============================================================================
// One shared context describes "who/what/where" made an outbound provider
// call. Two pure builders project it into the two shapes producers need:
//   - `openrouterRequestEnrichment` — fields to merge into an OpenRouter
//     completions request body (`trace.metadata` + top-level `user`/
//     `session_id`). NOTE: OpenRouter's documented field is `trace.metadata`,
//     NOT a bare top-level `metadata` — do not "flatten" this.
//   - `telemetryEventClassifier` — the same classifier keys, shaped as a flat
//     string map suitable for a pushed `UsageTelemetryEvent`'s `metadata`
//     field (see `usageTelemetry.ts`).
// `buildCallClassifier` is a convenience wrapper that returns both shapes at
// once for call sites that need to both enrich a request and push telemetry
// from the same context.
//
// All three functions are pure: no I/O, no side effects, deterministic for a
// given `ctx`. Undefined optional fields are omitted from the outputs rather
// than serialized as `undefined`/`null`.
// =============================================================================

import { z } from "zod";

/**
 * Shared identity/classification context for a single outbound provider call.
 * `sourceApp` is required; every other field is optional and simply omitted
 * from the builder outputs when absent.
 */
export const CallClassifierContextSchema = z.object({
  /** Producer app identifier, e.g. "congress-trade" or "socratic-trade". */
  sourceApp: z.string().trim().min(1).max(80),
  /** Deploy environment, e.g. "production" | "staging" | "development". */
  environment: z.string().trim().min(1).max(80).optional(),
  /** Logical service/subsystem within the app, e.g. "extraction-worker". */
  service: z.string().trim().min(1).max(120).optional(),
  /** Finer-grained feature/call-site tag, e.g. "openrouter-vision-extract". */
  feature: z.string().trim().min(1).max(120).optional(),
  /** Reference to the API key used (name/alias, never the raw secret). */
  keyRef: z.string().trim().min(1).max(160).optional(),
  /** Deployed commit SHA or version tag for the calling build. */
  gitSha: z.string().trim().min(1).max(80).optional(),
  /** Deterministic per-caller/end-user identifier (OpenRouter `user`). */
  user: z.string().trim().min(1).max(160).optional(),
  /** Run/session identifier grouping related calls (OpenRouter `session_id`). */
  sessionId: z.string().trim().min(1).max(160).optional(),
});

export type CallClassifierContext = z.infer<typeof CallClassifierContextSchema>;

/** The `trace.metadata` object merged into an OpenRouter request body. */
export interface CallClassifierTraceMetadata {
  sourceApp: string;
  environment?: string;
  service?: string;
  feature?: string;
  keyRef?: string;
  gitSha?: string;
}

/**
 * Fields to merge into an OpenRouter completions request body. Spread this
 * into the request body — do NOT rename `trace` or hoist `metadata` to the
 * top level; OpenRouter's documented field is `trace.metadata`.
 */
export interface OpenRouterRequestEnrichment {
  user?: string;
  session_id?: string;
  trace: {
    metadata: CallClassifierTraceMetadata;
  };
}

/**
 * Flat string map of classifier fields, safe to merge into a pushed
 * `UsageTelemetryEvent`'s `metadata` field (see `UsageTelemetryMetadataSchema`
 * in `usageTelemetry.ts`, which accepts `Record<string, string | number |
 * boolean | null>`).
 */
export type CallClassifierTelemetryMetadata = Record<string, string>;

/** Combined output of applying both classifier builders to the same context. */
export interface CallClassifierOutputs {
  openrouterRequestEnrichment: OpenRouterRequestEnrichment;
  telemetryMetadata: CallClassifierTelemetryMetadata;
}

/**
 * Builds the fields to merge into an OpenRouter completions request body:
 * top-level `user`/`session_id` plus `trace: { metadata: {...} }`. Throws if
 * `ctx` fails `CallClassifierContextSchema` validation (e.g. missing/blank
 * `sourceApp`).
 */
export function openrouterRequestEnrichment(
  ctx: CallClassifierContext,
): OpenRouterRequestEnrichment {
  const parsed = CallClassifierContextSchema.parse(ctx);

  const metadata: CallClassifierTraceMetadata = { sourceApp: parsed.sourceApp };
  if (parsed.environment !== undefined) metadata.environment = parsed.environment;
  if (parsed.service !== undefined) metadata.service = parsed.service;
  if (parsed.feature !== undefined) metadata.feature = parsed.feature;
  if (parsed.keyRef !== undefined) metadata.keyRef = parsed.keyRef;
  if (parsed.gitSha !== undefined) metadata.gitSha = parsed.gitSha;

  const result: OpenRouterRequestEnrichment = { trace: { metadata } };
  if (parsed.user !== undefined) result.user = parsed.user;
  if (parsed.sessionId !== undefined) result.session_id = parsed.sessionId;
  return result;
}

/**
 * Builds the classifier fields to attach to a pushed usage-telemetry event's
 * `metadata` map. Throws if `ctx` fails `CallClassifierContextSchema`
 * validation (e.g. missing/blank `sourceApp`).
 */
export function telemetryEventClassifier(
  ctx: CallClassifierContext,
): CallClassifierTelemetryMetadata {
  const parsed = CallClassifierContextSchema.parse(ctx);

  const metadata: CallClassifierTelemetryMetadata = { sourceApp: parsed.sourceApp };
  if (parsed.environment !== undefined) metadata.environment = parsed.environment;
  if (parsed.service !== undefined) metadata.service = parsed.service;
  if (parsed.feature !== undefined) metadata.feature = parsed.feature;
  if (parsed.keyRef !== undefined) metadata.keyRef = parsed.keyRef;
  if (parsed.gitSha !== undefined) metadata.gitSha = parsed.gitSha;
  if (parsed.user !== undefined) metadata.user = parsed.user;
  if (parsed.sessionId !== undefined) metadata.sessionId = parsed.sessionId;
  return metadata;
}

/**
 * Convenience wrapper returning both classifier shapes for the same context
 * in one call. Equivalent to calling `openrouterRequestEnrichment(ctx)` and
 * `telemetryEventClassifier(ctx)` separately.
 */
export function buildCallClassifier(ctx: CallClassifierContext): CallClassifierOutputs {
  return {
    openrouterRequestEnrichment: openrouterRequestEnrichment(ctx),
    telemetryMetadata: telemetryEventClassifier(ctx),
  };
}
