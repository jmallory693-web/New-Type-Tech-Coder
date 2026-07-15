/**
 * Stage 131: Local Planner Build Brief builder (deterministic markdown).
 * No AI. No FS. No source reads. Metadata + options only.
 */

import {
  LOCAL_PLANNER_STRICTNESS_LABELS,
  LOCAL_PLANNER_TARGET_MODEL_LABELS,
  type LocalPlannerBuildBriefMode,
  type LocalPlannerBuildBriefRecord,
  type LocalPlannerStrictness,
  type LocalPlannerTargetModelType,
} from "./buildModeLocalPlannerBuildBrief";

export type LocalPlannerTaskCardSummary = {
  id: string;
  title: string;
  phase?: string;
  goal?: string;
};

export type EvaluateLocalPlannerBuildBriefInput = {
  blueprintImported: boolean;
  taskCardCount: number;
  fileTreeExists: boolean;
  fileContentExists: boolean;
  writeResultExists: boolean;
  writeCreatedCount: number;
};

export type BuildLocalPlannerBuildBriefInput = {
  blueprintImported: boolean;
  blueprintProjectType: string;
  blueprintCompletenessLabel: string | null;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  taskCards: LocalPlannerTaskCardSummary[];
  selectedTaskId: string | null;
  targetFolderPath: string | null;
  targetSafetyStatus: string | null;
  fileTreeGeneratedAt: string | null;
  fileTreeProposedPaths: string[];
  fileContentGeneratedAt: string | null;
  writeManifestGeneratedAt: string | null;
  finalConfirmationConfirmedAt: string | null;
  writeResultWrittenAt: string | null;
  writeCreatedRelativePaths: string[];
  strictness: LocalPlannerStrictness;
  targetLocalModelType: LocalPlannerTargetModelType;
};

function evaluateMode(
  input: EvaluateLocalPlannerBuildBriefInput,
): {
  canGenerate: boolean;
  mode: LocalPlannerBuildBriefMode | null;
  reasons: string[];
} {
  const reasons: string[] = [];

  const postWrite =
    input.writeResultExists && input.writeCreatedCount > 0;
  const preWrite =
    input.blueprintImported &&
    input.taskCardCount > 0 &&
    (input.fileTreeExists || input.fileContentExists);

  if (postWrite) {
    return { canGenerate: true, mode: "post-write", reasons: [] };
  }

  if (preWrite) {
    return { canGenerate: true, mode: "pre-write", reasons: [] };
  }

  if (!input.blueprintImported) {
    reasons.push("Import or save a Blueprint first.");
  }
  if (input.blueprintImported && input.taskCardCount <= 0) {
    reasons.push("Generate Blueprint Phase Task Cards first.");
  }
  if (
    input.blueprintImported &&
    input.taskCardCount > 0 &&
    !input.fileTreeExists &&
    !input.fileContentExists &&
    !(input.writeResultExists && input.writeCreatedCount > 0)
  ) {
    reasons.push(
      "Generate a Safe Scaffold File Tree or File Content Preview, or complete a Safe Scaffold Write first.",
    );
  }
  if (
    input.writeResultExists &&
    input.writeCreatedCount <= 0 &&
    !preWrite
  ) {
    reasons.push(
      "Safe Scaffold Write result has no created files — generate a preview-backed brief or write scaffold files first.",
    );
  }

  return { canGenerate: false, mode: null, reasons };
}

export function evaluateLocalPlannerBuildBriefPreconditions(
  input: EvaluateLocalPlannerBuildBriefInput,
): {
  canGenerate: boolean;
  mode: LocalPlannerBuildBriefMode | null;
  reasons: string[];
} {
  return evaluateMode(input);
}

function bulletList(paths: string[], emptyLabel: string): string {
  if (paths.length === 0) return `- ${emptyLabel}`;
  return paths
    .slice(0, 80)
    .map((p) => `- \`${p.replace(/\\/g, "/")}\``)
    .join("\n");
}

function buildDesiredOutputFormat(
  targetLocalModelType: LocalPlannerTargetModelType,
): string {
  if (targetLocalModelType === "small-slm") {
    return [
      "### Return only these short bullets",
      "1. Next task (one line)",
      "2. Why first (one line)",
      "3. Files involve (3 bullets max)",
      "4. Do not touch (3 bullets max)",
      "5. Risks (3 bullets max)",
      "6. Acceptance checks (3 bullets max)",
      "7. Coder prompt outline (5 bullets max)",
      "8. Critic questions (3 bullets max)",
      "9. Manual commands for the human outside NTTC (or `none`)",
      "10. Stop conditions (2 bullets max)",
      "",
      "Keep the whole reply under ~40 lines. Prefer bullets over paragraphs.",
    ].join("\n");
  }

  if (targetLocalModelType === "coder-as-planner") {
    return [
      "### Return this structure",
      "1. **Recommended next task** — one concrete, local-coder-sized task",
      "2. **Why this task first**",
      "3. **Files likely involved** — paths/interfaces only (no file bodies)",
      "4. **Files that should not be touched**",
      "5. **Interfaces / contracts to respect**",
      "6. **Risks**",
      "7. **Acceptance checks** — observable, reviewable",
      "8. **Coder-model prompt outline** — paste-ready outline for a local coder model",
      "9. **Critic-model review questions**",
      "10. **Commands the human may run manually outside NTTC** (never ask NTTC to run them)",
      "11. **Stop conditions**",
      "",
      "Emphasize files, interfaces, and acceptance checks. Planning only — do not emit patches or full file rewrites.",
    ].join("\n");
  }

  return [
    "### Return this structure",
    "1. Recommended next task",
    "2. Why this task first",
    "3. Files likely involved",
    "4. Files that should not be touched",
    "5. Risks",
    "6. Acceptance checks",
    "7. Coder-model prompt outline",
    "8. Critic-model review questions",
    "9. Commands the human may need to run manually outside NTTC, if any",
    "10. Stop conditions",
    "",
    "Keep the plan bounded for a local coder model. Do not produce patches or file edits in this response.",
  ].join("\n");
}

function strictnessInstructions(strictness: LocalPlannerStrictness): string {
  if (strictness === "smallest-safe") {
    return "Prefer the **smallest safe next step** that a local coder model can finish and review without broad rewrites.";
  }
  if (strictness === "ambitious-bounded") {
    return "You may propose an **ambitious but still bounded** next step — still one task, still reviewable, still local-model sized.";
  }
  return "Propose a **normal next step** — one focused task, not a multi-phase rewrite.";
}

function modelRoleWording(target: LocalPlannerTargetModelType): string {
  if (target === "small-slm") {
    return "You are a small local SLM acting as a planner. Stay extremely concise. Plan only — do not edit files.";
  }
  if (target === "coder-as-planner") {
    return "You are a local coder model acting temporarily as a planner. Focus on files, interfaces, and acceptance checks. You are not editing files in this response.";
  }
  return "You are a local planning model. You are not editing files. You are planning the next small implementation task for a coder model.";
}

export function buildLocalPlannerBuildBrief(
  input: BuildLocalPlannerBuildBriefInput,
): {
  record: LocalPlannerBuildBriefRecord | null;
  blockedReasons: string[];
} {
  const readiness = evaluateLocalPlannerBuildBriefPreconditions({
    blueprintImported: input.blueprintImported,
    taskCardCount: input.taskCardCount,
    fileTreeExists: Boolean(input.fileTreeGeneratedAt),
    fileContentExists: Boolean(input.fileContentGeneratedAt),
    writeResultExists: Boolean(input.writeResultWrittenAt),
    writeCreatedCount: input.writeCreatedRelativePaths.length,
  });

  if (!readiness.canGenerate || !readiness.mode) {
    return { record: null, blockedReasons: readiness.reasons };
  }

  const selected =
    input.selectedTaskId == null
      ? null
      : input.taskCards.find((c) => c.id === input.selectedTaskId) ?? null;

  const availablePaths =
    readiness.mode === "post-write" &&
    input.writeCreatedRelativePaths.length > 0
      ? input.writeCreatedRelativePaths
      : input.fileTreeProposedPaths;

  const warnings: string[] = [];
  if (input.selectedTaskId && !selected) {
    warnings.push(
      "Selected task ID was not found in current task cards — brief asks the planner to choose.",
    );
  }
  if (readiness.mode === "pre-write") {
    warnings.push(
      "Pre-write mode: scaffold may not exist on disk yet. Plan the next step assuming scaffold write has completed or is about to.",
    );
  }

  const focusBlock =
    selected != null
      ? [
          "## Focus Task",
          `- ID: \`${selected.id}\``,
          `- Title: ${selected.title}`,
          selected.phase ? `- Phase: ${selected.phase}` : null,
          selected.goal ? `- Goal: ${selected.goal}` : null,
          "",
          "Prioritize this focus task unless it is unsafe or too large; then explain a smaller substitute.",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          "## Focus Task",
          "No task card is selected.",
          "Choose the first best small task from the task cards / scaffold state above.",
        ].join("\n");

  const goalBlock =
    readiness.mode === "post-write"
      ? "Choose one small next implementation task **inside the already scaffolded project** that can be implemented and reviewed safely."
      : "Choose one small next task that should be built **once the scaffold is written** (or is being written) and can be implemented and reviewed safely.";

  const markdown = [
    "# NTTC Local Planner Build Brief",
    "",
    "## Purpose",
    "Use a local planner model to choose the next small build step.",
    "This brief is for local LLM / SLM / coder-as-planner testing. NTTC did not send this prompt to any model.",
    "",
    "## Model Role",
    modelRoleWording(input.targetLocalModelType),
    "",
    `## Planning Strictness`,
    `- Selected: **${LOCAL_PLANNER_STRICTNESS_LABELS[input.strictness]}**`,
    strictnessInstructions(input.strictness),
    "",
    `## Target Local Model Type`,
    `- Selected: **${LOCAL_PLANNER_TARGET_MODEL_LABELS[input.targetLocalModelType]}**`,
    "",
    "## Current Project State",
    `- Brief mode: **${readiness.mode}**`,
    `- Blueprint status: ${input.blueprintImported ? "imported/saved" : "missing"}`,
    `- Project type: ${input.blueprintProjectType || "unknown"}`,
    input.blueprintCompletenessLabel
      ? `- Completeness: ${input.blueprintCompletenessLabel}`
      : null,
    `- Task cards: ${input.taskCardCount}`,
    input.taskCardsGeneratedAt
      ? `- Task cards generated at: ${input.taskCardsGeneratedAt}`
      : null,
    `- Scaffold status: ${
      readiness.mode === "post-write"
        ? `write result present (${input.writeCreatedRelativePaths.length} files created)`
        : "preview-only / pre-write planning"
    }`,
    `- Target folder: ${input.targetFolderPath ?? "(not selected)"}`,
    input.targetSafetyStatus
      ? `- Target safety: ${input.targetSafetyStatus}`
      : null,
    `- Files created, if any: ${input.writeCreatedRelativePaths.length}`,
    input.writeResultWrittenAt
      ? `- Write result at: ${input.writeResultWrittenAt}`
      : null,
    input.fileTreeGeneratedAt
      ? `- File Tree Preview at: ${input.fileTreeGeneratedAt}`
      : null,
    input.fileContentGeneratedAt
      ? `- File Content Preview at: ${input.fileContentGeneratedAt}`
      : null,
    input.writeManifestGeneratedAt
      ? `- Write Manifest Preview at: ${input.writeManifestGeneratedAt}`
      : null,
    input.finalConfirmationConfirmedAt
      ? `- Final Confirmation at: ${input.finalConfirmationConfirmedAt}`
      : null,
    "",
    "## Task Cards (titles only)",
    input.taskCards.length === 0
      ? "- (none)"
      : input.taskCards
          .slice(0, 40)
          .map(
            (c, i) =>
              `${i + 1}. \`${c.id}\` — ${c.title}${c.phase ? ` (${c.phase})` : ""}`,
          )
          .join("\n"),
    "",
    focusBlock,
    "",
    "## Available Scaffold Files",
    readiness.mode === "post-write"
      ? "Paths from Safe Scaffold Write result (created paths only — no file bodies):"
      : "Proposed paths from File Tree Preview (no file bodies; may not exist on disk yet):",
    bulletList(availablePaths, "(none listed)"),
    "",
    "## Current Build Goal",
    goalBlock,
    "",
    "## Planner Instructions",
    "Return:",
    "1. Recommended next task",
    "2. Why this task first",
    "3. Files likely involved",
    "4. Files that should not be touched",
    "5. Risks",
    "6. Acceptance checks",
    "7. Coder-model prompt outline",
    "8. Critic-model review questions",
    "9. Commands the human may need to run manually outside NTTC, if any",
    "10. Stop conditions",
    "",
    "## Hard Boundaries",
    "- Do not ask NTTC to run commands.",
    "- Do not ask NTTC to install packages.",
    "- Do not ask NTTC to apply patches.",
    "- Do not assume invisible project access.",
    "- Do not edit existing files in this response.",
    "- Do not invent recursive source scans or hidden file reads.",
    "- Keep the task small enough for a local coder model.",
    "- Prefer one task, not a broad rewrite.",
    "- Frame every answer as planning for a human/coder workflow outside automatic NTTC execution.",
    "",
    "## Desired Output Format",
    buildDesiredOutputFormat(input.targetLocalModelType),
    "",
    "## Reminder",
    "Planning only. No code execution. No patches. No Apply. Copy this answer back into NTTC only in a later import stage (not this stage).",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const record: LocalPlannerBuildBriefRecord = {
    generatedAt: new Date().toISOString(),
    mode: readiness.mode,
    strictness: input.strictness,
    targetLocalModelType: input.targetLocalModelType,
    selectedTaskId: selected?.id ?? null,
    selectedTaskTitle: selected?.title ?? null,
    sourceBlueprintImported: input.blueprintImported,
    sourceBlueprintProjectType: input.blueprintProjectType || "unknown",
    sourceTaskCardCount: input.taskCardCount,
    sourceTaskCardsGeneratedAt: input.taskCardsGeneratedAt,
    sourceTargetFolderPath: input.targetFolderPath,
    sourceTargetSafetyStatus: input.targetSafetyStatus,
    sourceFileTreeGeneratedAt: input.fileTreeGeneratedAt,
    sourceFileContentGeneratedAt: input.fileContentGeneratedAt,
    sourceWriteManifestGeneratedAt: input.writeManifestGeneratedAt,
    sourceFinalConfirmationConfirmedAt: input.finalConfirmationConfirmedAt,
    sourceWriteResultWrittenAt: input.writeResultWrittenAt,
    sourceCreatedRelativePaths: input.writeCreatedRelativePaths.map((p) =>
      p.replace(/\\/g, "/"),
    ),
    sourceProposedRelativePaths: input.fileTreeProposedPaths.map((p) =>
      p.replace(/\\/g, "/"),
    ),
    markdown,
    warnings,
    stale: false,
  };

  return { record, blockedReasons: [] };
}
