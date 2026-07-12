/**
 * Stage 88: build Task Card Builder Handoff markdown (planning artifacts only).
 */

import { assessTaskCardBuilderHandoffReadiness } from "./assessTaskCardBuilderHandoffReadiness";
import {
  getBuilderHandoffTargetLabel,
  getBuilderHandoffTargetNotes,
} from "./builderHandoffTargetWording";
import {
  labelForBlueprintBuildStyle,
  labelForBlueprintProjectType,
  labelForBlueprintTargetUser,
} from "./blueprintConstants";
import { labelForTaskCardQuality } from "./assessBlueprintTaskCardQuality";
import { TASK_CARD_STATUS_LABELS } from "./blueprintTaskCardConstants";
import {
  isSmallModelFriendlyPlanning,
  SMALL_MODEL_FRIENDLY_CORE_RULE,
  type PlanningStyleId,
} from "./planningStyle";
import {
  TASK_CARD_BUILDER_HANDOFF_TITLE,
  TASK_CARD_HANDOFF_SAFETY_REMINDER,
  type TaskCardBuilderHandoffReadiness,
} from "./taskCardBuilderHandoffConstants";
import type {
  BlueprintCompletenessReport,
  BlueprintImportedRecord,
  BlueprintIntake,
  BlueprintPhaseTaskCard,
  Phase1BuilderHandoffRecord,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
} from "./types";

function strictnessBlock(strictness: BuilderHandoffStrictness): string[] {
  switch (strictness) {
    case "conservative":
      return [
        "**Conservative strictness:** Use the strongest safety boundaries.",
        "Prefer planning and human review before any implementation.",
        "Do not broaden scope beyond this task card.",
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
        "Keep implementation scoped to this task.",
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

export function buildTaskCardBuilderHandoffMarkdown(input: {
  intake: BlueprintIntake;
  imported: BlueprintImportedRecord;
  completeness: BlueprintCompletenessReport | null;
  phase1Handoff: Phase1BuilderHandoffRecord | null;
  planningStyle: PlanningStyleId;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  task: BlueprintPhaseTaskCard;
  readiness: TaskCardBuilderHandoffReadiness;
  tooBroadWarning: boolean;
  generatedAt: string;
}): string {
  const {
    intake,
    imported,
    completeness,
    phase1Handoff,
    planningStyle,
    target,
    strictness,
    task,
    readiness,
    tooBroadWarning,
    generatedAt,
  } = input;

  const smallModel =
    intake.buildStyle === "small-model-friendly" ||
    isSmallModelFriendlyPlanning(planningStyle);

  const planningOnly =
    readiness === "planning-only" || readiness === "not-ready" || tooBroadWarning;

  const lines = [
    `# ${TASK_CARD_BUILDER_HANDOFF_TITLE}`,
    "",
    "## Builder Target",
    "",
    `- **Target:** ${getBuilderHandoffTargetLabel(target)}`,
    `- **Strictness:** ${strictness}`,
    `- **Generated time:** ${generatedAt}`,
    `- **Readiness:** ${readiness}`,
    "",
    "## Selected Task",
    "",
    `- **Task ID:** ${task.id}`,
    `- **Task title:** ${task.title}`,
    `- **Phase:** ${task.phase}`,
    `- **Current status:** ${TASK_CARD_STATUS_LABELS[task.status]}`,
    `- **Quality status:** ${labelForTaskCardQuality(task.quality)}`,
    "",
    "## Goal",
    "",
    task.goal,
    "",
    task.whyThisMatters ? `_${task.whyThisMatters}_` : "",
    "",
    "## Context",
    "",
    `- **Project type:** ${labelForBlueprintProjectType(intake.projectType)}`,
    `- **Target user:** ${labelForBlueprintTargetUser(intake.targetUser)}`,
    `- **Build style:** ${labelForBlueprintBuildStyle(intake.buildStyle)}`,
    `- **Planning style:** ${planningStyle}`,
    `- **Blueprint source:** ${imported.source}`,
    `- **Completeness:** ${completeness?.readiness ?? "not checked"}`,
    `- **Phase 1 handoff:** ${phase1Handoff ? "available in blueprint session" : "not generated"}`,
    "",
    task.inputsContext.trim(),
    "",
    "## What To Build",
    "",
    task.whatToBuild,
    "",
    "## What Not To Build Yet",
    "",
    task.whatNotToBuildYet,
    "",
    "## Likely Files / Modules",
    "",
    "_Planning text only — not a command to read or edit project files._",
    "",
    task.likelyFilesModules,
    "",
    "## Safety Boundaries",
    "",
    task.safetyBoundaries,
    "",
    "- Do not add Apply Patch.",
    "- Do not add terminal/custom command features.",
    "- Do not enable Live Qwen.",
    "- Do not bypass safety confirmations.",
    "- Do not add unrelated features.",
    "- Do not perform broad rewrites.",
    "- Keep changes narrow.",
    "- Do not handle secrets insecurely.",
    "",
    ...strictnessBlock(strictness).map((l) => `- ${l.replace(/^\*\*|\*\*$/g, "")}`),
    "",
    "## Small-Model Friendly Architecture",
    "",
    smallModel
      ? SMALL_MODEL_FRIENDLY_CORE_RULE
      : "Prefer clear module boundaries where practical.",
    "",
    "- Keep files small and focused.",
    "- Split constants/types/helpers/components/managers.",
    "- Avoid dumping everything into App.tsx/main/index.ts.",
    "",
    "## Builder Instructions",
    "",
    ...targetSpecificBlock(target).map((n) => `- ${n}`),
    "",
    "- Implement only this task.",
    "- Do not build later phases.",
    "- If missing context, ask questions first.",
    "- Report changed files.",
    "- Report validation performed.",
    "- Report risks and safety confirmations.",
    planningOnly
      ? "- **Planning-only mode:** Do not write code yet. Return a narrow implementation plan first."
      : "",
    tooBroadWarning
      ? "- **Warning:** This task is too broad for safe implementation. Return a narrower plan first."
      : "",
    "",
    "## Validation Required",
    "",
    task.validationSteps,
    "",
    "- Typecheck if the project supports it.",
    "- Build if the project supports it.",
    "- Manual smoke test for this task scope.",
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
    "- Paste the implementation summary into NTTC Builder Result / Implementation Review.",
    "- Do not assume work is safe until reviewed.",
    "- Run checks before trusting it.",
    "",
    "## Open Questions",
    "",
    task.openQuestions || "(None listed on task card.)",
    "",
    "## Safety Reminder",
    "",
    TASK_CARD_HANDOFF_SAFETY_REMINDER,
  ];

  return lines.filter((l) => l !== undefined).join("\n").trim();
}

export function buildTaskCardHandoffPlanningNote(input: {
  selectedTaskId: string;
  target: BuilderHandoffTarget;
  readiness: TaskCardBuilderHandoffReadiness;
  stale: boolean;
}): string {
  if (input.stale) {
    return `_Task Builder Handoff for ${input.selectedTaskId} is stale — regenerate after task card changes._`;
  }
  return `Task Builder Handoff exists for **${input.selectedTaskId}** (${getBuilderHandoffTargetLabel(input.target)} · ${input.readiness}). Full handoff is session-only unless exported via CURRENT_TASK_HANDOFF.md.`;
}

export { assessTaskCardBuilderHandoffReadiness };
