/**
 * Best-effort usage logging for Codex text generation into Al's LLM ledger.
 *
 * Runs are `codex exec --ephemeral` with an isolated CODEX_HOME, so no session
 * file exists for Witness to pick up; this is the only place they are counted.
 * Row format mirrors ~/dev/utils/llm-ledger/llm-log.ts (logLlmUsage).
 * Log: ~/dev/utils/logs/llm-usage.jsonl (override with $LLM_USAGE_LOG).
 * Never throws.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export interface CodexExecUsage {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningOutputTokens: number;
}

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;

/** Sum `turn.completed` usage events from `codex exec --json` stdout. */
export function parseCodexExecUsage(stdout: string): CodexExecUsage | null {
  let seen = false;
  const total = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 };
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!event || typeof event !== "object") continue;
    const record = event as { type?: unknown; usage?: unknown };
    if (record.type !== "turn.completed" || !record.usage || typeof record.usage !== "object") {
      continue;
    }
    const usage = record.usage as Record<string, unknown>;
    seen = true;
    total.inputTokens += num(usage.input_tokens);
    total.cachedInputTokens += num(usage.cached_input_tokens);
    total.outputTokens += num(usage.output_tokens);
    total.reasoningOutputTokens += num(usage.reasoning_output_tokens);
  }
  return seen ? total : null;
}

export interface CodexTextLedgerInput {
  readonly operation: string;
  readonly model: string;
  readonly stdout: string;
  readonly durationMs: number;
  /** Codex model provider id from the prepared config ("openai" by default). */
  readonly providerId: string;
  /** True when the provider authenticates via an env API key (metered). */
  readonly usesApiKeyEnv: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly now?: Date;
}

export function buildCodexTextLedgerRow(
  input: CodexTextLedgerInput,
): Record<string, unknown> | null {
  const usage = parseCodexExecUsage(input.stdout);
  if (!usage) return null;
  const provider = (input.providerId || "openai").toLowerCase();
  // ChatGPT-login Codex runs on the subscription (transport cli); env-key or
  // custom providers bill per token.
  const subscription = provider === "openai" && !input.usesApiKeyEnv;
  return {
    ts: (input.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
    project: "synara",
    job: input.operation,
    provider,
    model: input.model,
    transport: "cli",
    billing: subscription ? "subscription" : "metered",
    input_tokens: Math.max(usage.inputTokens - usage.cachedInputTokens, 0),
    output_tokens: usage.outputTokens,
    cache_read_tokens: usage.cachedInputTokens,
    cache_write_tokens: 0,
    reasoning_tokens: usage.reasoningOutputTokens,
    cost_usd: null,
    rate_version: null,
    duration_ms: Math.trunc(input.durationMs),
    status: "ok",
    error: null,
    ref: null,
    extra: { via: "synara-codex-text" },
  };
}

export function logCodexTextUsage(input: CodexTextLedgerInput): void {
  try {
    const row = buildCodexTextLedgerRow(input);
    if (!row) return;
    const env = input.env ?? process.env;
    const file =
      env.LLM_USAGE_LOG || path.join(env.HOME || "", "dev", "utils", "logs", "llm-usage.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(row) + "\n", "utf8");
    fs.chmodSync(file, 0o600);
  } catch {
    // Logging must never affect text generation.
  }
}
