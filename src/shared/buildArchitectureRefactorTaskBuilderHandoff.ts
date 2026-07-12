/**
 * Stage 104: build Architecture Refactor Builder Handoff markdown (planning only).
 */

import { assessArchitectureRefactorTaskBuilderHandoffReadiness } from "./assessArchitectureRefactorTaskBuilderHandoffReadiness";
import {
  getBuilderHandoffTargetLabel,
  getBuilderHandoffTargetNotes,
} from "./builderHandoffTargetWording";
import {
  ARCHITECTURE_REFACTOR_HANDOFF_APP_TSX_NOTE,
  ARCHITECTURE_REFACTOR_HANDOFF_BEHAVIOR_PRESERVATION,
  ARCHITECTURE_REFACTOR_HANDOFF_BUILDER_INSTRUCTIONS,
  ARCHITECTURE_REFACTOR_HANDOFF_MAIN_INDEX_NOTE,
  ARCHITECTURE_REFACTOR_HANDOFF_SAFETY_REMINDER,
  ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TITLE,
  type ArchitectureRefactorTaskBuilderHandoffReadiness,
} from "./architectureRefactorTasks/architectureRefactorTaskBuilderHandoffConstants";
import { TASK_CARD_STATUS_LABELS } from "./architectureRefactorTasks/architectureRefactorTaskConstants";
import { labelForArchitectureRefactorTaskQuality } from "./architectureRefactorTasks/assessArchitectureRefactorTaskQuality";
import type { PlanningStyleId } from "./planningStyle";
import type {
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskCard,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
} from "./types";

const APP_TSX_PATTERN = /(?:^|\/)App\.tsx$/i;
const MAIN_INDEX_PATTERN = /(?:^|\/)main\/index\.ts$/i;

function strictnessBlock(strictness: BuilderHandoffStrictness): string[] {
  switch (strictness) {
    case "conservative":
      return [
        "**Conservative strictness:** Use the strongest safety boundaries.",
        "Prefer planning and human review before any implementation.",
        "Do not broaden scope beyond this refactor task.",
        "Ask questions before touching code.",
      ];
    case "fast-small-patch":
      return [
        "**Fast small patch:** Keep the change as small and fast as possible.",
        "Still do not bypass safeguards, add terminal access, or apply patches automatically.",
        "One narrow slice only — no drive-by refactors.",
      ];
    default:
      return [
        "**Normal strictness:** Balance progress with the safety boundaries below.",
      ];
  }
}

function targetSpecificBlock(target: BuilderHandoffTarget): string[] {
  const notes = getBuilderHandoffTargetNotes(target);
  const extra: string[] = [];
  switch (target) {
    case "cursor":
      extra.push(
        "Make changes file-by-file.",
        "Avoid broad autocomplete/refactor.",
        "Keep implementation scoped to this refactor task.",
      );
      break;
    case "codex":
      extra.push(
        "Return implementation summary and validation details.",
        "Avoid unrelated cleanup.",
      );
      break;
    case "claude":
    case "chatgpt":
    case "grok":
    case "qwen":
      extra.push(
        "Do not assume hidden file access.",
        "Ask for missing context before proposing broad changes.",
        "If you cannot implement directly, return a narrow patch plan.",
      );
      break;
    case "human-programmer":
      extra.push(
        "Use this as a checklist.",
        "Mark anything unclear before coding.",
      );
      break;
    default:
      break;
  }
  return [...extra, ...notes].filter(
    (line, i, arr) => arr.indexOf(line) === i,
  );
}

function buildChangedFilesPressureSummary(input: {
  changedFilesScan: ChangedFilesScanResult | null;
  changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
}): string {
  const lines: string[] = [];
  const scan = input.changedFilesScan;
  if (scan?.scannedAt && scan.isGitRepo) {
    lines.push(
      `- Changed-files scan: ${scan.totalCount} file(s) at ${scan.scannedAt}.`,
    );
    const paths = scan.files.map((f) => f.path.replace(/\\/g, "/"));
    const monolithChanged = paths.some(
      (p) => APP_TSX_PATTERN.test(p) || MAIN_INDEX_PATTERN.test(p),
    );
    if (monolithChanged) {
      lines.push(
        "- **Pressure:** App.tsx or main/index.ts appears in current changed files.",
      );
    }
  } else {
    lines.push("- Changed-files scan: not available or not a git repo.");
  }

  const link = input.changedFilesTaskLink;
  if (link && !link.stale) {
    const linkedPaths = link.changedFilePaths ?? [];
    lines.push(
      `- Changed-files task link: ${link.taskId} (${linkedPaths.length} path(s)).`,
    );
    if (link.warnings?.length) {
      lines.push(
        `- Scope warnings: ${link.warnings.length} (review before trusting scope).`,
      );
    }
  }

  return lines.length ? lines.join("\n") : "- No changed-files pressure metadata available.";
}

function buildMonolithRiskSummary(health: ArchitectureHealthRecord): string {
  return [
    `- Recommendation: ${health.recommendation}`,
    `- Files scanned: ${health.fileCountScanned}`,
    `- Critical monolith files: ${health.criticalCount}`,
    `- Warning-level files: ${health.warningCount}`,
    `- Largest file: ${health.largestFilePath ?? "n/a"} (${health.largestFileLineCount} lines)`,
  ].join("\n");
}

function targetSpecificRefactorNotes(task: ArchitectureRefactorTaskCard): string[] {
  const target = task.refactorTarget.replace(/\\/g, "/");
  const files = task.filesLikelyInvolved.replace(/\\/g, "/");
  const notes: string[] = [];
  if (APP_TSX_PATTERN.test(target) || /App\.tsx/i.test(files)) {
    notes.push(ARCHITECTURE_REFACTOR_HANDOFF_APP_TSX_NOTE);
  }
  if (MAIN_INDEX_PATTERN.test(target) || /main\/index\.ts/i.test(files)) {
    notes.push(ARCHITECTURE_REFACTOR_HANDOFF_MAIN_INDEX_NOTE);
  }
  return notes;
}

export function buildArchitectureRefactorTaskBuilderHandoffMarkdown(input: {
  architectureHealth: ArchitectureHealthRecord;
  task: ArchitectureRefactorTaskCard;
  planningStyle: PlanningStyleId;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  readiness: ArchitectureRefactorTaskBuilderHandoffReadiness;
  recommendation: string;
  tooBroadWarning: boolean;
  changedFilesScan: ChangedFilesScanResult | null;
  changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  generatedAt: string;
}): string {
  const {
    architectureHealth,
    task,
    planningStyle,
    target,
    strictness,
    readiness,
    recommendation,
    tooBroadWarning,
    changedFilesScan,
    changedFilesTaskLink,
    generatedAt,
  } = input;

  const planningOnly =
    readiness === "planning-only" ||
    readiness === "not-ready" ||
    tooBroadWarning;

  const lines = [
    `# ${ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TITLE}`,
    "",
    "## Builder Target",
    "",
    `- **Target:** ${getBuilderHandoffTargetLabel(target)}`,
    `- **Strictness:** ${strictness}`,
    `- **Generated time:** ${generatedAt}`,
    `- **Readiness:** ${readiness}`,
    `- **Recommendation:** ${recommendation}`,
    "",
    "## Selected Refactor Task",
    "",
    `- **Task ID:** ${task.id}`,
    `- **Task title:** ${task.title}`,
    `- **Refactor target:** ${task.refactorTarget}`,
    `- **Current status:** ${TASK_CARD_STATUS_LABELS[task.status]}`,
    `- **Quality:** ${labelForArchitectureRefactorTaskQuality(task.quality)}`,
    "",
    "## Refactor Goal",
    "",
    task.goal,
    "",
    task.whyThisMatters ? `_${task.whyThisMatters}_` : "",
    "",
    "## Current Architecture Risk",
    "",
    buildMonolithRiskSummary(architectureHealth),
    "",
    task.currentRisk,
    "",
    "### Changed-Files Pressure",
    "",
    buildChangedFilesPressureSummary({ changedFilesScan, changedFilesTaskLink }),
    "",
    `- **Planning style:** ${planningStyle}`,
    "",
    "## What To Change",
    "",
    task.whatToChange,
    "",
    "## What Not To Change",
    "",
    task.whatNotToChange,
    "",
    "## Files Likely Involved",
    "",
    "_Planning text only — not a command to read or edit project files._",
    "",
    task.filesLikelyInvolved,
    "",
    "## Behavior Preservation Requirements",
    "",
    ...ARCHITECTURE_REFACTOR_HANDOFF_BEHAVIOR_PRESERVATION.map((line) => `- ${line}`),
    "",
    "## Safety Boundaries",
    "",
    task.safetyBoundaries,
    "",
    ...strictnessBlock(strictness).map((l) => `- ${l.replace(/^\*\*|\*\*$/g, "")}`),
    "",
    "## Small-Model Friendly Architecture",
    "",
    task.smallModelFriendlyArchitecture,
    "",
    "## Builder Instructions",
    "",
    ...targetSpecificBlock(target).map((n) => `- ${n}`),
    "",
    ...ARCHITECTURE_REFACTOR_HANDOFF_BUILDER_INSTRUCTIONS.map((line) => `- ${line}`),
    "",
    ...targetSpecificRefactorNotes(task).map((note) => `- ${note}`),
    "",
    planningOnly
      ? "- **Planning-only mode:** Do not write code yet. Return a narrow refactor plan first."
      : "",
    tooBroadWarning
      ? "- **Warning:** This refactor task is too broad for safe implementation. Return a narrower plan first."
      : "",
    "",
    "## Validation Required",
    "",
    task.validationSteps,
    "",
    "- Typecheck if the project supports it.",
    "- Build if the project supports it.",
    "- Manual smoke test for this refactor scope.",
    "- No source-wide refactor.",
    "- Confirm no unrelated files changed.",
    "",
    "## Report Back Format",
    "",
    "When done, report:",
    "",
    "1. Analysis",
    "2. Plan",
    "3. Files changed",
    "4. Implementation summary",
    "5. Validation performed",
    "6. Risks",
    "7. Safety confirmations",
    "8. Questions / blockers",
    "",
    task.reportBackFormat,
    "",
    "## After Builder Returns",
    "",
    "- Paste the implementation summary into NTTC for Implementation Review.",
    "- Do not assume work is safe until reviewed.",
    "- Run checks before trusting it.",
    "- Mark the refactor task Implementation Returned, then Reviewed after review.",
    "",
    "## Recommendation",
    "",
    recommendation,
    "",
    "## Safety Reminder",
    "",
    ARCHITECTURE_REFACTOR_HANDOFF_SAFETY_REMINDER,
  ];

  return lines.filter((l) => l !== undefined).join("\n").trim();
}

export function buildArchitectureRefactorHandoffPlanningNote(input: {
  selectedTaskId: string;
  taskTitle: string;
  target: BuilderHandoffTarget;
  readiness: ArchitectureRefactorTaskBuilderHandoffReadiness;
  stale: boolean;
}): string {
  if (input.stale) {
    return `_Architecture Refactor Builder Handoff for ${input.selectedTaskId} is stale — regenerate after refactor card or Architecture Health changes._`;
  }
  return `Architecture refactor handoff exists for **${input.selectedTaskId}** (${input.taskTitle} · ${getBuilderHandoffTargetLabel(input.target)} · ${input.readiness}). Full handoff is session-only unless exported via ARCHITECTURE_REFACTOR_HANDOFF.md.`;
}

export { assessArchitectureRefactorTaskBuilderHandoffReadiness };
