/**
 * Stage 135: Local Coder Task Prompt builder (deterministic markdown).
 * No AI. No FS. No source reads. Metadata + accepted planner response only.
 */

import {
  LOCAL_CODER_PROMPT_STYLE_LABELS,
  type LocalCoderPromptStyle,
  type LocalCoderTaskPromptRecord,
} from "./buildModeLocalCoderTaskPrompt";
import type { LocalPlannerResponseStatus } from "./buildModeLocalPlannerResponseImport";

export type EvaluateLocalCoderTaskPromptInput = {
  plannerResponseExists: boolean;
  plannerResponseStale: boolean;
  plannerResponseStatus: LocalPlannerResponseStatus | null;
  acceptedForCoderPromptPrep: boolean;
  recommendedNextTask: string | null;
  likelyFilesCount: number;
  scaffoldFilesCount: number;
};

export type BuildLocalCoderTaskPromptInput = {
  promptStyle: LocalCoderPromptStyle;
  plannerResponseStatus: LocalPlannerResponseStatus;
  plannerResponseAcceptedAt: string | null;
  plannerResponseAnalyzedAt: string | null;
  recommendedNextTask: string;
  whyThisTask: string | null;
  likelyFiles: string[];
  filesNotToTouch: string[];
  risks: string[];
  acceptanceChecks: string[];
  coderPromptOutline: string | null;
  stopConditions: string[];
  blueprintProjectType: string;
  targetFolderPath: string | null;
  targetSafetyStatus: string | null;
  scaffoldWriteWrittenAt: string | null;
  scaffoldCreatedRelativePaths: string[];
  fileTreeGeneratedAt: string | null;
  fileTreeProposedPaths: string[];
  selectedTaskTitle: string | null;
};

function bulletList(items: string[], emptyLabel: string): string {
  if (items.length === 0) return `- ${emptyLabel}`;
  return items
    .slice(0, 80)
    .map((p) => `- ${p}`)
    .join("\n");
}

function pathBulletList(paths: string[], emptyLabel: string): string {
  if (paths.length === 0) return `- ${emptyLabel}`;
  return paths
    .slice(0, 80)
    .map((p) => `- \`${p.replace(/\\/g, "/")}\``)
    .join("\n");
}

export function evaluateLocalCoderTaskPromptPreconditions(
  input: EvaluateLocalCoderTaskPromptInput,
): { canGenerate: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!input.plannerResponseExists) {
    reasons.push("missing planner response");
  } else if (input.plannerResponseStale) {
    reasons.push("accepted marker stale");
  } else if (input.plannerResponseStatus === "Blocked") {
    reasons.push("planner response blocked");
  } else if (
    input.plannerResponseStatus !== "Good" &&
    input.plannerResponseStatus !== "Caution"
  ) {
    reasons.push("planner response blocked");
  } else if (!input.acceptedForCoderPromptPrep) {
    reasons.push("planner response not accepted");
  }

  if (input.plannerResponseExists && !input.recommendedNextTask?.trim()) {
    reasons.push("missing recommended task");
  }

  if (
    input.plannerResponseExists &&
    input.acceptedForCoderPromptPrep &&
    !input.plannerResponseStale &&
    input.likelyFilesCount <= 0 &&
    input.scaffoldFilesCount <= 0
  ) {
    reasons.push("missing likely files / scaffold files");
  }

  return { canGenerate: reasons.length === 0, reasons };
}

function styleGuidance(style: LocalCoderPromptStyle): string[] {
  if (style === "small-local-coder") {
    return [
      "Prefer **one file** or a very small change set.",
      "Keep the proposal short and strict.",
      "If more than two files seem required, stop and say so.",
      "Do not expand scope beyond the stated task.",
    ];
  }
  if (style === "strict-patch-planning-coder") {
    return [
      "Use exact file paths.",
      "Provide before/after descriptions for every existing-file edit.",
      "Separate **new files** from **edits** clearly.",
      "Do not invent dependencies.",
      "Do not propose broad rewrites.",
      "Include an explicit uncertainty list for anything you cannot verify from this prompt.",
    ];
  }
  return [
    "Provide balanced detail for a careful human review.",
    "Keep the change bounded to the likely-files list when possible.",
    "Call out uncertainty when the prompt does not contain enough context.",
  ];
}

const HARD_SAFETY = [
  "Do not include secrets.",
  "Do not include .env files.",
  "Do not include API keys.",
  "Do not include private keys.",
  "Do not include install scripts that run automatically.",
  "Do not use postinstall/preinstall scripts.",
  "Do not include destructive commands.",
  "Do not assume the human has run npm install.",
  "Do not claim code was tested unless you actually ran tests outside NTTC and say so.",
];

export function buildLocalCoderTaskPrompt(
  input: BuildLocalCoderTaskPromptInput,
): { record: LocalCoderTaskPromptRecord | null; blockedReasons: string[] } {
  const readiness = evaluateLocalCoderTaskPromptPreconditions({
    plannerResponseExists: true,
    plannerResponseStale: false,
    plannerResponseStatus: input.plannerResponseStatus,
    acceptedForCoderPromptPrep: true,
    recommendedNextTask: input.recommendedNextTask,
    likelyFilesCount: input.likelyFiles.length,
    scaffoldFilesCount:
      input.scaffoldCreatedRelativePaths.length +
      input.fileTreeProposedPaths.length,
  });
  if (!readiness.canGenerate) {
    return { record: null, blockedReasons: readiness.reasons };
  }

  const knownScaffold = [
    ...input.scaffoldCreatedRelativePaths,
    ...input.fileTreeProposedPaths,
  ].slice(0, 80);

  const scaffoldStatus = input.scaffoldWriteWrittenAt
    ? `Safe Scaffold Write completed at ${input.scaffoldWriteWrittenAt}`
    : input.fileTreeGeneratedAt
      ? `File-tree preview available (generated at ${input.fileTreeGeneratedAt})`
      : "Scaffold preview/write metadata limited";

  const warnings: string[] = [];
  if (input.plannerResponseStatus === "Caution") {
    warnings.push(
      "Source planner response status is Caution — keep the coder proposal especially bounded.",
    );
  }
  if (input.likelyFiles.length === 0 && knownScaffold.length > 0) {
    warnings.push(
      "Planner listed no likely files; using scaffold path metadata as context only.",
    );
  }

  const styleLabel = LOCAL_CODER_PROMPT_STYLE_LABELS[input.promptStyle];
  const styleLines = styleGuidance(input.promptStyle)
    .map((l) => `- ${l}`)
    .join("\n");

  const desiredOutput =
    input.promptStyle === "strict-patch-planning-coder"
      ? [
          "Return:",
          "1. Summary of proposed implementation",
          "2. Files to create (exact paths)",
          "3. Files to edit (exact paths)",
          "4. Exact proposed content for new files, if any",
          "5. Before/after patch-style description for existing-file edits, if any",
          "6. Explicit uncertainty list",
          "7. Manual commands the human may choose to run outside NTTC, if any (human-only notes — NTTC will not run them)",
          "8. How to verify manually",
          "9. Stop conditions",
        ].join("\n")
      : input.promptStyle === "small-local-coder"
        ? [
            "Return (keep short):",
            "1. One-sentence summary",
            "2. Single preferred file to create or edit",
            "3. Exact proposed content or tiny edit description",
            "4. Manual human-only verification steps",
            "5. Stop conditions",
            "",
            "Commands, if any, are human-only notes. NTTC will not run commands.",
          ].join("\n")
        : [
            "Return:",
            "1. Summary of proposed implementation",
            "2. Files to create",
            "3. Files to edit",
            "4. Exact proposed content for new files, if any",
            "5. Patch-style description for existing-file edits, if any",
            "6. Manual commands the human may choose to run outside NTTC, if any",
            "7. How to verify manually",
            "8. Stop conditions",
            "",
            "Commands are human-only notes. NTTC will not run commands.",
          ].join("\n");

  const markdown = [
    "# NTTC Local Coder Task Prompt",
    "",
    "## Purpose",
    "Use a local coder model to propose implementation for one small task.",
    "",
    "## Model Role",
    "You are a local coder model. You are not running commands. You are not editing files directly. You are producing a bounded implementation proposal for the human to review.",
    "",
    "## Prompt Style",
    styleLabel,
    styleLines,
    "",
    "## Current Task",
    input.recommendedNextTask,
    ...(input.whyThisTask ? ["", `Why: ${input.whyThisTask}`] : []),
    ...(input.selectedTaskTitle
      ? ["", `Planner focus task title: ${input.selectedTaskTitle}`]
      : []),
    ...(input.coderPromptOutline
      ? ["", "Planner coder outline:", input.coderPromptOutline]
      : []),
    "",
    "## Project Context",
    `- Project type: ${input.blueprintProjectType || "unknown"}`,
    `- Scaffold status: ${scaffoldStatus}`,
    `- Target folder: ${input.targetFolderPath ?? "(none selected)"}`,
    `- Target safety: ${input.targetSafetyStatus ?? "(unknown)"}`,
    "- Known scaffold files:",
    pathBulletList(knownScaffold, "(none listed)"),
    `- Accepted planner response: ${input.plannerResponseStatus} (accepted at ${input.plannerResponseAcceptedAt ?? "unknown"}; analyzed at ${input.plannerResponseAnalyzedAt ?? "unknown"})`,
    "",
    "## Files Likely Involved",
    pathBulletList(input.likelyFiles, "(none listed by planner)"),
    "",
    "## Files Not To Touch",
    pathBulletList(
      input.filesNotToTouch,
      "(none listed — be extra conservative)",
    ),
    "",
    "## Implementation Boundaries",
    "- Keep the change small.",
    "- Do not rewrite the whole app.",
    "- Do not invent hidden project access.",
    "- Do not ask NTTC to run commands.",
    "- Do not ask NTTC to install packages.",
    "- Do not ask NTTC to apply patches.",
    "- Do not modify files outside the likely-files list unless you explain why.",
    "- Prefer new-file proposals or small explicit edits.",
    "- Return changes as a reviewable proposal, not as instructions NTTC should auto-apply.",
    "- NTTC will not auto-apply your proposal.",
    "",
    "## Acceptance Checks",
    bulletList(input.acceptanceChecks, "(none listed)"),
    "",
    "## Risks To Avoid",
    bulletList(input.risks, "(none listed)"),
    "",
    "## Stop Conditions From Planner",
    bulletList(input.stopConditions, "(none listed)"),
    "",
    "## Safety Warnings",
    ...HARD_SAFETY.map((s) => `- ${s}`),
    "",
    "## Desired Output Format",
    desiredOutput,
    "",
    "## Reminder",
    "This prompt is copy/paste only. NTTC did not call a model, write files, install packages, apply patches, or run commands.",
  ].join("\n");

  const generatedAt = new Date().toISOString();
  const record: LocalCoderTaskPromptRecord = {
    generatedAt,
    promptStyle: input.promptStyle,
    sourcePlannerResponseAcceptedAt: input.plannerResponseAcceptedAt,
    sourcePlannerResponseStatus: input.plannerResponseStatus,
    sourcePlannerResponseAnalyzedAt: input.plannerResponseAnalyzedAt,
    recommendedTask: input.recommendedNextTask,
    likelyFiles: [...input.likelyFiles],
    filesNotToTouch: [...input.filesNotToTouch],
    sourceScaffoldWriteWrittenAt: input.scaffoldWriteWrittenAt,
    sourceScaffoldCreatedRelativePaths: [
      ...input.scaffoldCreatedRelativePaths,
    ],
    sourceFileTreeGeneratedAt: input.fileTreeGeneratedAt,
    sourceFileTreeProposedPaths: [...input.fileTreeProposedPaths],
    sourceBlueprintProjectType: input.blueprintProjectType || "unknown",
    sourceTargetFolderPath: input.targetFolderPath,
    markdown,
    warnings,
    stale: false,
  };

  return { record, blockedReasons: [] };
}
