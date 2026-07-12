/** Stage 86: Blueprint Phase Task Cards constants (planning only). */

export const BLUEPRINT_PHASE_TASK_CARD_STATUSES = [
  "drafted",
  "planned",
  "sent-to-builder",
  "implementation-returned",
  "reviewed",
  "blocked",
  "skipped",
] as const;

export type BlueprintPhaseTaskCardStatus =
  (typeof BLUEPRINT_PHASE_TASK_CARD_STATUSES)[number];

export const BLUEPRINT_PHASE_TASK_CARD_QUALITY_LEVELS = [
  "good",
  "needs-clarification",
  "too-broad",
  "blocked",
] as const;

export type BlueprintPhaseTaskCardQuality =
  (typeof BLUEPRINT_PHASE_TASK_CARD_QUALITY_LEVELS)[number];

export const TASK_CARD_STATUS_LABELS: Record<
  BlueprintPhaseTaskCardStatus,
  string
> = {
  drafted: "Drafted",
  planned: "Planned",
  "sent-to-builder": "Sent to builder",
  "implementation-returned": "Implementation returned",
  reviewed: "Reviewed",
  blocked: "Blocked",
  skipped: "Skipped",
};

export const TASK_CARD_QUALITY_LABELS: Record<
  BlueprintPhaseTaskCardQuality,
  string
> = {
  good: "Good",
  "needs-clarification": "Needs clarification",
  "too-broad": "Too broad",
  blocked: "Blocked",
};
export const BUILDER_PROMPT_SAFETY_REMINDERS = [
  "Implement only this task. Do not build later phases.",
  "Do not add unrelated features.",
  "Do not add Apply Patch.",
  "Do not add terminal/custom command features.",
  "Do not enable Live Qwen.",
  "Do not bypass safety confirmations.",
  "Keep files small and focused.",
  "Report back with files changed, validation performed, risks, and safety confirmations.",
] as const;

export const PLANNING_ONLY_BUILDER_NOTE =
  "Do not write code yet. Return a narrow implementation plan first.";
