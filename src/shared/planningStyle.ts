/** Stage 69: Small-Model Friendly Architecture planning preset (guidance text only). */

import type { CodeQuestionTemplateId } from "./codeQuestionTemplates";

export type PlanningStyleId = "default" | "small-model-friendly";

export const DEFAULT_PLANNING_STYLE: PlanningStyleId = "small-model-friendly";

export const PLANNING_STYLE_OPTIONS: Array<{
  id: PlanningStyleId;
  label: string;
}> = [
  { id: "default", label: "Default" },
  { id: "small-model-friendly", label: "Small-model friendly" },
];

export const SMALL_MODEL_FRIENDLY_PRESET_NAME =
  "Small-Model Friendly Architecture";

export const SMALL_MODEL_FRIENDLY_SHORT_LABEL = "Small-model friendly";

export const SMALL_MODEL_FRIENDLY_DESCRIPTION =
  "Plans changes as small, readable, focused modules so local/smaller AI models can find, edit, review, and test one concern at a time.";

export const SMALL_MODEL_FRIENDLY_HELPER_NOTE =
  "Helps smaller local models by asking planners to split logic into small readable files instead of one giant file.";

export const SMALL_MODEL_FRIENDLY_CORE_RULE =
  "Prefer small, focused files and clear module boundaries. Do not put broad feature logic into one giant file. Keep files readable for smaller/local AI models. Split plausible logic into named modules so another AI can find, edit, review, and test one concern at a time.";

const EXPANDED_GUIDANCE_LINES = [
  "## Small-Model Friendly Architecture",
  "",
  SMALL_MODEL_FRIENDLY_CORE_RULE,
  "",
  "Expanded guidance:",
  "- Prefer small focused modules over giant files.",
  "- Do not dump broad feature logic into `App.tsx`.",
  "- Do not dump broad main-process logic into `main/index.ts`.",
  "- Keep `App.tsx` mostly UI wiring where practical.",
  "- Keep `main/index.ts` mostly IPC/snapshot orchestration where practical.",
  "- Put shared constants/types/helpers in `src/shared/`.",
  "- Put main-process feature managers in focused `src/main/<feature>/` folders.",
  "- Put report-building logic in focused review/report builder files.",
  "- Put renderer UI in named components where practical.",
  "- Prefer named helpers over large inline blocks.",
  "- Prefer readable code over clever code.",
  "- Prefer narrow changes that smaller AI models can inspect safely.",
  "- If a feature requires many concerns, split them by concern:",
  "  - types/constants",
  "  - scanning/parsing",
  "  - manager/state",
  "  - report builder",
  "  - UI component",
  "  - IPC wiring",
  "  - tests/smoke notes",
];

const PLANNING_GUIDANCE_TEMPLATE_IDS: CodeQuestionTemplateId[] = [
  "check-against-plan",
  "suggest-missing-tests",
  "small-patch-plan",
  "safety-boundary-risks",
  "outside-builder-question",
];

export function normalizePlanningStyle(value: unknown): PlanningStyleId {
  if (value === "default" || value === "small-model-friendly") {
    return value;
  }
  return DEFAULT_PLANNING_STYLE;
}

export function isSmallModelFriendlyPlanning(style: PlanningStyleId): boolean {
  return style === "small-model-friendly";
}

export function getPlanningStyleStatusLine(style: PlanningStyleId): string | null {
  if (!isSmallModelFriendlyPlanning(style)) return null;
  return `Planning style: ${SMALL_MODEL_FRIENDLY_SHORT_LABEL}`;
}

export function getPlanningStyleReportLine(style: PlanningStyleId): string {
  if (isSmallModelFriendlyPlanning(style)) {
    return `Planning style: ${SMALL_MODEL_FRIENDLY_SHORT_LABEL} — prefer small focused modules and clear file boundaries.`;
  }
  return "Planning style: Default";
}

export function getExpandedPlanningGuidanceBlocks(): string[] {
  return [...EXPANDED_GUIDANCE_LINES];
}

export function getCompactPlanningGuidanceForSuggestedPrompt(): string {
  return "Use small-model friendly architecture: split changes into small focused modules with clear file boundaries. Avoid giant files and broad rewrites.";
}

export function templateNeedsPlanningGuidance(
  templateId: CodeQuestionTemplateId | null | undefined,
): boolean {
  if (!templateId) return false;
  return PLANNING_GUIDANCE_TEMPLATE_IDS.includes(templateId);
}

export function appendExpandedPlanningGuidance(
  lines: string[],
  style: PlanningStyleId,
): string[] {
  if (!isSmallModelFriendlyPlanning(style)) return lines;
  return [...lines, "", ...EXPANDED_GUIDANCE_LINES];
}

export function planningGuidanceLogMessage(
  target:
    | "builder-plan"
    | "patch-draft"
    | "builder-prompt"
    | "project-memory",
): string {
  switch (target) {
    case "builder-plan":
      return "Small-model friendly guidance included in Builder Plan prompt";
    case "patch-draft":
      return "Small-model friendly guidance included in Patch Draft prompt";
    case "builder-prompt":
      return "Small-model friendly guidance included in Builder Prompt";
    case "project-memory":
      return "Small-model friendly guidance included in Project Memory";
    default:
      return "Small-model friendly guidance included";
  }
}

export function draftImpliesBroadFileChanges(
  ...texts: Array<string | null | undefined>
): boolean {
  const combined = texts.filter(Boolean).join("\n");
  if (!combined.trim()) return false;
  return /\bApp\.tsx\b|\bmain\/index\.ts\b|giant file|one giant|broad rewrite|source-wide refactor|rewrite everything|dump all logic/i.test(
    combined,
  );
}
