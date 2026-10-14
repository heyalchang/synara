import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildCodexTextLedgerRow,
  logCodexTextUsage,
  parseCodexExecUsage,
} from "./codexTextGenerationLedger.ts";

const STDOUT = [
  '{"type":"thread.started","thread_id":"t"}',
  "not json",
  '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}',
  '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":400,"output_tokens":20,"reasoning_output_tokens":5}}',
].join("\n");

describe("codexTextGenerationLedger", () => {
  it("parses turn.completed usage", () => {
    expect(parseCodexExecUsage(STDOUT)).toEqual({
      inputTokens: 1000,
      cachedInputTokens: 400,
      outputTokens: 20,
      reasoningOutputTokens: 5,
    });
    expect(parseCodexExecUsage("")).toBeNull();
  });

  it("builds a ledger row", () => {
    const row = buildCodexTextLedgerRow({
      operation: "generateThreadTitle",
      model: "gpt-5.4-mini",
      stdout: STDOUT,
      durationMs: 12.7,
      providerId: "openai",
      usesApiKeyEnv: false,
      now: new Date("2026-10-14T00:00:00.123Z"),
    });
    expect(row).toMatchObject({
      ts: "2026-10-14T00:00:00Z",
      project: "synara",
      job: "generateThreadTitle",
      provider: "openai",
      billing: "subscription",
      input_tokens: 600,
      cache_read_tokens: 400,
      output_tokens: 20,
      reasoning_tokens: 5,
      duration_ms: 12,
      extra: { via: "synara-codex-text" },
    });
    expect(
      buildCodexTextLedgerRow({
        operation: "x", model: "m", stdout: STDOUT, durationMs: 1,
        providerId: "openai", usesApiKeyEnv: true,
      })?.billing,
    ).toBe("metered");
  });

  it("appends to LLM_USAGE_LOG and never throws", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "synara-ledger-"));
    const file = path.join(dir, "llm.jsonl");
    const base = { operation: "op", model: "m", durationMs: 1, providerId: "openai", usesApiKeyEnv: false };
    logCodexTextUsage({ ...base, stdout: STDOUT, env: { LLM_USAGE_LOG: file } });
    logCodexTextUsage({ ...base, stdout: "", env: { LLM_USAGE_LOG: file } });
    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(() =>
      logCodexTextUsage({ ...base, stdout: STDOUT, env: { LLM_USAGE_LOG: "/dev/null/x/y" } }),
    ).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
