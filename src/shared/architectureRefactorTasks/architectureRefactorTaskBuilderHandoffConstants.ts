/** Stage 104: Architecture Refactor Builder Handoff constants (text-only). */

import {
  BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  BUILDER_HANDOFF_TARGET_OPTIONS,
  DEFAULT_BUILDER_HANDOFF_STRICTNESS,
  DEFAULT_BUILDER_HANDOFF_TARGET,
} from "../builderHandoffExportConstants";

export const ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TITLE =
  "NTTC Architecture Refactor Builder Handoff";

export const ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_PURPOSE =
  "Turn one selected Architecture Refactor Task Card into a focused builder prompt. Text-only — no AI, no source reads, no automatic send.";

export const ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME =
  "ARCHITECTURE_REFACTOR_HANDOFF.md" as const;

export const ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_READINESS_LEVELS = [
  "not-ready",
  "planning-only",
  "ready-for-narrow-refactor-plan",
  "ready-for-narrow-implementation",
] as const;

export type ArchitectureRefactorTaskBuilderHandoffReadiness =
  (typeof ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_READINESS_LEVELS)[number];

export const ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS: Record<
  ArchitectureRefactorTaskBuilderHandoffReadiness,
  string
> = {
  "not-ready": "Not ready",
  "planning-only": "Planning only",
  "ready-for-narrow-refactor-plan": "Ready for narrow refactor plan",
  "ready-for-narrow-implementation": "Ready for narrow implementation",
};

export {
  BUILDER_HANDOFF_TARGET_OPTIONS as ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TARGET_OPTIONS,
  BUILDER_HANDOFF_STRICTNESS_OPTIONS as ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  DEFAULT_BUILDER_HANDOFF_TARGET as DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TARGET,
  DEFAULT_BUILDER_HANDOFF_STRICTNESS as DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_STRICTNESS,
};

export const ARCHITECTURE_REFACTOR_HANDOFF_BEHAVIOR_PRESERVATION = [
  "Preserve existing behavior.",
  "Do not add new features.",
  "Do not remove safety checks.",
  "Do not weaken confirmations.",
  "Do not change Live Qwen disabled behavior.",
  "Do not add Apply Patch.",
  "Do not add terminal/custom command features.",
  "Do not change source-reading rules.",
  "Do not change secret-detection rules.",
  "Keep the refactor small and reversible.",
] as const;

export const ARCHITECTURE_REFACTOR_HANDOFF_BUILDER_INSTRUCTIONS = [
  "Implement only this refactor task.",
  "Do not perform a broad rewrite.",
  "Do not refactor unrelated areas.",
  "If the task is too broad, return a narrower plan first.",
  "Prefer extracting focused components/managers/helpers.",
  "Keep module boundaries clear.",
  "Report every file changed.",
  "Report validation performed.",
  "Report behavior-preservation checks.",
  "Report safety confirmations.",
] as const;

export const ARCHITECTURE_REFACTOR_HANDOFF_APP_TSX_NOTE =
  "Do not keep adding logic to App.tsx. Move focused rendering/handler clusters into named components or helpers. Keep App.tsx as wiring/shell where practical.";

export const ARCHITECTURE_REFACTOR_HANDOFF_MAIN_INDEX_NOTE =
  "Do not keep adding logic to main/index.ts. Move focused IPC registration or manager wiring into named helper modules where practical. Keep main/index.ts as orchestration where practical.";

export const ARCHITECTURE_REFACTOR_HANDOFF_SAFETY_REMINDER =
  "NTTC has not modified files. This is a text-only refactor handoff.";

export function architectureRefactorHandoffSuggestedStatusHint(
  taskId: string,
): string {
  return `After copying this handoff, mark ${taskId} Sent to Builder.`;
}
