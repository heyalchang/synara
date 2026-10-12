import { ProjectTaskId } from "@synara/contracts";
import { describe, expect, it } from "vitest";

import {
  detectProjectTaskDependencyCycle,
  INITIAL_PROJECT_DIGEST_SUMMARY,
  canWriteMemoryDocument,
  isMemoryDocumentPath,
  isMemoryThreadDocumentPath,
  isProjectContextPreviewPath,
  MEMORY_AUTO_DOCUMENT_PATH,
  MEMORY_DOCUMENT_PREFIX,
  memoryThreadDocumentPath,
  normalizeProjectDocumentPath,
  projectDecisionContext,
  projectWorkerReportContext,
  PROJECT_CONTEXT_PREVIEW_DOCUMENTS,
  ProjectAgentPathError,
  sanitizeProjectDigestFocusTitle,
  sanitizeProjectDigestSummary,
  truncateToContextBudget,
} from "./projectAgent";

describe("normalizeProjectDocumentPath", () => {
  it("normalizes relative document paths", () => {
    expect(normalizeProjectDocumentPath("docs/foo.md")).toBe("docs/foo.md");
    expect(normalizeProjectDocumentPath("./notes.md")).toBe("notes.md");
  });

  it("rejects traversal and absolute paths", () => {
    expect(() => normalizeProjectDocumentPath("../secret.md")).toThrow(ProjectAgentPathError);
    expect(() => normalizeProjectDocumentPath("/etc/passwd")).toThrow(ProjectAgentPathError);
    expect(() => normalizeProjectDocumentPath("docs/../../escape.md")).toThrow(
      ProjectAgentPathError,
    );
  });
});

describe("isMemoryDocumentPath", () => {
  it("recognizes already-normalized memory paths without re-normalizing", () => {
    expect(isMemoryDocumentPath(MEMORY_AUTO_DOCUMENT_PATH)).toBe(true);
    expect(isMemoryDocumentPath("memory/threads/thread-1.md")).toBe(true);
    expect(isMemoryDocumentPath("./memory/note.md")).toBe(false);
    expect(isMemoryDocumentPath("instructions.md")).toBe(false);
    expect(MEMORY_DOCUMENT_PREFIX).toBe("memory/");
    expect(memoryThreadDocumentPath("thread-1")).toBe("memory/threads/thread-1.md");
    expect(isMemoryThreadDocumentPath("memory/threads/thread-1.md")).toBe(true);
    expect(isMemoryThreadDocumentPath("memory/MEMORY.md")).toBe(false);
    expect(
      canWriteMemoryDocument({
        logicalPath: MEMORY_AUTO_DOCUMENT_PATH,
        principalKind: "user",
      }),
    ).toBe(true);
    expect(
      canWriteMemoryDocument({
        logicalPath: MEMORY_AUTO_DOCUMENT_PATH,
        principalKind: "worker",
        principalThreadId: "thread-1",
      }),
    ).toBe(false);
    expect(
      canWriteMemoryDocument({
        logicalPath: memoryThreadDocumentPath("thread-1"),
        principalKind: "worker",
        principalThreadId: "thread-1",
      }),
    ).toBe(true);
    expect(
      canWriteMemoryDocument({
        logicalPath: memoryThreadDocumentPath("thread-2"),
        principalKind: "worker",
        principalThreadId: "thread-1",
      }),
    ).toBe(false);
  });
});

describe("detectProjectTaskDependencyCycle", () => {
  const a = ProjectTaskId.makeUnsafe("task-a");
  const b = ProjectTaskId.makeUnsafe("task-b");
  const c = ProjectTaskId.makeUnsafe("task-c");

  it("accepts acyclic graphs and rejects cycles", () => {
    expect(
      detectProjectTaskDependencyCycle({
        taskId: c,
        dependsOnTaskIds: [b],
        edges: new Map([
          [a, []],
          [b, [a]],
        ]),
      }),
    ).toBe(false);
    expect(
      detectProjectTaskDependencyCycle({
        taskId: a,
        dependsOnTaskIds: [c],
        edges: new Map([
          [b, [a]],
          [c, [b]],
        ]),
      }),
    ).toBe(true);
  });
});

describe("project context preview", () => {
  it("shows only the shared files a person would open", () => {
    expect(PROJECT_CONTEXT_PREVIEW_DOCUMENTS.map((document) => document.logicalPath)).toEqual([
      "instructions.md",
      "notes.md",
      "decisions.md",
      "docs/project-bot.md",
    ]);
    expect(isProjectContextPreviewPath("instructions.md")).toBe(true);
    expect(isProjectContextPreviewPath("internal/manifest.json")).toBe(false);
    expect(isProjectContextPreviewPath("archived.md")).toBe(false);
    expect(isProjectContextPreviewPath("artifacts/index.md")).toBe(false);
  });
});

describe("sanitizeProjectDigestSummary", () => {
  it("drops leftover start-a-goal copy from Focus", () => {
    expect(
      sanitizeProjectDigestSummary(
        "Coordinator is configured. Start a goal to begin bounded coordination.",
      ),
    ).toBe(INITIAL_PROJECT_DIGEST_SUMMARY);
    expect(sanitizeProjectDigestSummary("Assigned work starts only after a goal is started.")).toBe(
      INITIAL_PROJECT_DIGEST_SUMMARY,
    );
    expect(sanitizeProjectDigestSummary("Sample workers are running.")).toBe(
      "Sample workers are running.",
    );
    expect(
      sanitizeProjectDigestSummary(
        "Coordinator continuation runs are queued. Sample playbook maintenance and Sample local worker both reported failure, while decisions.md was written. No worker completion is confirmed.",
      ),
    ).toBe("Coordinator continuation runs are queued.");
    expect(sanitizeProjectDigestFocusTitle("Sample playbook maintenance reported failed")).toBe(
      "Sample playbook maintenance",
    );
  });
});

describe("truncateToContextBudget", () => {
  it("caps injected project context", () => {
    const result = truncateToContextBudget(
      [
        { label: "Goal", text: "x".repeat(20) },
        { label: "Notes", text: "y".repeat(40) },
      ],
      40,
    );
    expect(result.characterCount).toBeLessThanOrEqual(40);
    expect(result.truncated).toBe(true);
  });

  it("keeps required constraints and late identities when optional context overflows", () => {
    const result = truncateToContextBudget(
      [
        { label: "Instructions", text: "Do not publish.", required: true },
        { label: "Memory", text: "history ".repeat(100) },
        { label: "Report", text: "failed; revision 7; head abc123", required: true },
      ],
      100,
    );
    expect(result.packet).toContain("Do not publish.");
    expect(result.packet).toContain("failed; revision 7; head abc123");
    expect(result.packet).not.toContain("history");
    expect(result.characterCount).toBe(result.packet.length);
  });

  it("never silently clips required context even when it alone exceeds the budget", () => {
    const instructions = "User instructions ".repeat(100);
    const result = truncateToContextBudget(
      [{ label: "Instructions", text: instructions, required: true }],
      100,
    );
    expect(result.packet).toContain(instructions);
    expect(result.characterCount).toBeGreaterThan(100);
    expect(result.characterCount).toBe(result.packet.length);
    expect(result.truncated).toBe(false);
  });
});

describe("document context previews", () => {
  const document = {
    logicalPath: "decisions.md",
    revision: 7,
    contentHash: "exact-document-hash",
  };

  it("keeps short decisions verbatim and identifies their exact revision", () => {
    const content = "Do not merge. Acceptance failed on commit abc123.";
    const result = projectDecisionContext({ ...document, content });
    expect(result).toContain(content);
    expect(result).toContain("revision 7, hash exact-document-hash");
  });

  it("labels long decision previews as partial and requires the full record before acting", () => {
    const content = `# Decisions\nDo not deploy.\n${"Old outcome. ".repeat(900)}\n## Current blocker\nAcceptance failed at head abc123.`;
    const result = projectDecisionContext({ ...document, content });
    expect(result).toContain("Current blocker\nAcceptance failed at head abc123.");
    expect(result).toContain("Partial preview only");
    expect(result).toContain("before planning, dispatching, or accepting work");
    expect(result).toContain(
      "earlier authorization boundaries, blockers and artifact revisions still apply",
    );
    expect(result.length).toBeLessThan(1_600);
    // Unstructured documents do not pretend a clipped paragraph is a current summary.
    expect(projectDecisionContext({ ...document, content: "history ".repeat(900) })).not.toContain(
      "Last entry preview",
    );
  });

  it("keeps the entire worker error and identity while abbreviating the reply", () => {
    const error = `${"Quota exhausted. ".repeat(100)}\n## Last reply\nThis heading is part of the error.`;
    const report = {
      ...document,
      logicalPath: "inbox/worker-1/report.md",
      content: `# Worker report\n- Thread id: worker-1\n- Status: error\n- Outcome: failed\n\n## Error\n\n${error}\n\n## Last reply\n\n${"Investigation details. ".repeat(400)}\nArtifact commit: abc123`,
    };
    const result = projectWorkerReportContext(report);
    expect(result).toContain(error.trim());
    expect(result).toContain("Thread id: worker-1");
    expect(result).toContain("Outcome: failed");
    expect(result).toContain("inbox/worker-1/report.md (revision 7, hash exact-document-hash)");
    expect(result).toContain("before reporting its outcome or accepting work");
    expect(result).toContain("exact artifact revisions");
    expect(result.length).toBeLessThan(report.content.length / 2);
  });

  it.each([1, 3])("reduces representative watch packets with %i worker reports", (workers) => {
    const memory = "- User preference: local work only; do not publish.\n".repeat(35);
    const decisions = {
      ...document,
      content: `# Decisions\n${"Historical acceptance investigation. ".repeat(270)}\n## Current\nBlocked at head 0123456789abcdef; do not merge.`,
    };
    const reports = Array.from({ length: workers }, (_, index) => ({
      ...document,
      logicalPath: `inbox/worker-${index}/report.md`,
      content: `# Worker report\n- Thread id: worker-${index}\n- Outcome: failed\n\n## Error\n\nAccount unavailable.\n\n## Last reply\n\n${"Detailed acceptance evidence. ".repeat(110)}\nArtifact head: fedcba9876543210.`,
    }));
    const common = [
      { label: "Instructions", text: "Local patch only. Do not deploy or submit upstream." },
      { label: "Hub memory index", text: memory },
      { label: "Playbook", text: "Standing coordinator routing and safety rules.\n".repeat(160) },
      { label: "Workers", text: "worker-0: failed; request exact-dispatch; batch exact-batch" },
    ];
    const before = truncateToContextBudget([
      ...common,
      { label: "Worker reports", text: reports.map((report) => report.content).join("\n\n") },
      { label: "Memory", text: `### memory/MEMORY.md\n${memory}` },
      { label: "Decisions", text: decisions.content },
    ]);
    const after = truncateToContextBudget([
      ...common,
      { label: "Worker reports", text: reports.map(projectWorkerReportContext).join("\n\n") },
      { label: "Decisions", text: projectDecisionContext(decisions) },
    ]);
    expect(before.truncated).toBe(false);
    expect(after.truncated).toBe(false);
    expect(after.characterCount).toBeLessThan(before.characterCount * 0.55);
    expect(after.packet).toContain(common[0]!.text);
    expect(after.packet).toContain("exact-dispatch; batch exact-batch");
    expect(after.packet).toContain("Blocked at head 0123456789abcdef; do not merge.");
    expect(after.packet.split(memory).length - 1).toBe(1);
    console.info(
      `Hub packet fixture (${workers} workers): ${before.characterCount} -> ${after.characterCount} characters; ${Buffer.byteLength(before.packet)} -> ${Buffer.byteLength(after.packet)} UTF-8 bytes`,
    );
  });
});
