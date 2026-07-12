/** Stage 102: Architecture Refactor Task Cards (planning only; no AI). */

import {
  BLUEPRINT_PHASE_TASK_CARD_QUALITY_LEVELS,
  BLUEPRINT_PHASE_TASK_CARD_STATUSES,
  BUILDER_PROMPT_SAFETY_REMINDERS,
  PLANNING_ONLY_BUILDER_NOTE,
  TASK_CARD_QUALITY_LABELS,
  TASK_CARD_STATUS_LABELS,
} from "../blueprintTaskCardConstants";

export const ARCHITECTURE_REFACTOR_TASK_CARD_TITLE =
  "# NTTC Architecture Refactor Task Card";

export const ARCHITECTURE_REFACTOR_TASK_ID_PREFIX = "ARCH-" as const;

export const ARCHITECTURE_REFACTOR_TASK_CARD_STATUSES =
  BLUEPRINT_PHASE_TASK_CARD_STATUSES;

export type ArchitectureRefactorTaskCardStatus =
  (typeof ARCHITECTURE_REFACTOR_TASK_CARD_STATUSES)[number];

export const ARCHITECTURE_REFACTOR_TASK_CARD_QUALITY_LEVELS =
  BLUEPRINT_PHASE_TASK_CARD_QUALITY_LEVELS;

export type ArchitectureRefactorTaskCardQuality =
  (typeof ARCHITECTURE_REFACTOR_TASK_CARD_QUALITY_LEVELS)[number];

export { TASK_CARD_STATUS_LABELS, TASK_CARD_QUALITY_LABELS };

export const ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME =
  "ARCHITECTURE_REFACTOR_TASKS.md" as const;

export const ARCHITECTURE_REFACTOR_BUILDER_PROMPT_CORE = [
  "Implement only this refactor task.",
  "Preserve behavior.",
  "Do not add new features.",
  "Do not change safety boundaries.",
  "Do not add Apply Patch.",
  "Do not enable Live Qwen.",
  "Do not add terminal/custom command features.",
  "Do not bypass confirmations.",
  "Keep changes small and reversible.",
  "Report changed files, validation, risks, and safety confirmations.",
] as const;

export const ARCHITECTURE_REFACTOR_SAFETY_BOUNDARIES = [
  "NTTC must remain inspect-only.",
  "No source editing from NTTC.",
  "No AI file access or automatic sends.",
  "No Apply Patch, Live Qwen, terminal, or custom commands.",
  "Planning docs export writes only .nttc/planning/*.md after confirmation.",
  ...BUILDER_PROMPT_SAFETY_REMINDERS.slice(0, 4),
] as const;

export const ARCHITECTURE_REFACTOR_REPORT_BACK_FORMAT = [
  "Files changed (list paths only).",
  "Validation performed (typecheck/build/smoke).",
  "Risks or follow-ups.",
  "Safety confirmations (no Apply Patch, no Live Qwen, no terminal, no bypass).",
].join("\n");

export const ARCHITECTURE_REFACTOR_PLANNING_ONLY_NOTE = PLANNING_ONLY_BUILDER_NOTE;

/** Stable ARCH-N assignment hints for default cards. */
export const DEFAULT_ARCHITECTURE_REFACTOR_CARD_HINTS: Array<{
  id: string;
  titlePattern: RegExp;
}> = [
  {
    id: "ARCH-1",
    titlePattern: /Reports tab section rendering from App\.tsx/i,
  },
  {
    id: "ARCH-2",
    titlePattern: /Blueprint tab container wiring from App\.tsx/i,
  },
  {
    id: "ARCH-3",
    titlePattern: /IPC registration groups from main\/index\.ts/i,
  },
  {
    id: "ARCH-4",
    titlePattern: /reusable ReportPanel shell component/i,
  },
  {
    id: "ARCH-5",
    titlePattern: /dashboard|workflow rendering|ReportPanel shell/i,
  },
];
