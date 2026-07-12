/** Stage 88: Task Card Builder Handoff constants (text-only handoff). */

import {
  BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  BUILDER_HANDOFF_TARGET_OPTIONS,
  DEFAULT_BUILDER_HANDOFF_STRICTNESS,
  DEFAULT_BUILDER_HANDOFF_TARGET,
} from "./builderHandoffExportConstants";

export const TASK_CARD_BUILDER_HANDOFF_TITLE = "NTTC Task Builder Handoff";

export const TASK_CARD_BUILDER_HANDOFF_PURPOSE =
  "Turn one selected Blueprint Phase Task Card into a focused builder prompt. Text-only — no AI, no source reads, no automatic send.";

export { CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME } from "./blueprintConstants";

export const TASK_CARD_BUILDER_HANDOFF_READINESS_LEVELS = [
  "not-ready",
  "planning-only",
  "ready-for-builder-planning",
  "ready-for-narrow-implementation",
] as const;

export type TaskCardBuilderHandoffReadiness =
  (typeof TASK_CARD_BUILDER_HANDOFF_READINESS_LEVELS)[number];

export const TASK_CARD_HANDOFF_READINESS_LABELS: Record<
  TaskCardBuilderHandoffReadiness,
  string
> = {
  "not-ready": "Not ready",
  "planning-only": "Planning only",
  "ready-for-builder-planning": "Ready for builder planning",
  "ready-for-narrow-implementation": "Ready for narrow implementation",
};

export {
  BUILDER_HANDOFF_TARGET_OPTIONS as TASK_CARD_BUILDER_HANDOFF_TARGET_OPTIONS,
  BUILDER_HANDOFF_STRICTNESS_OPTIONS as TASK_CARD_BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  DEFAULT_BUILDER_HANDOFF_TARGET as DEFAULT_TASK_CARD_BUILDER_HANDOFF_TARGET,
  DEFAULT_BUILDER_HANDOFF_STRICTNESS as DEFAULT_TASK_CARD_BUILDER_HANDOFF_STRICTNESS,
};

export const TASK_CARD_HANDOFF_SAFETY_REMINDER =
  "NTTC has not modified files. This is a text-only handoff.";

export const TASK_CARD_HANDOFF_SUGGESTED_STATUS_HINT =
  "After copying this handoff, mark task Sent to builder.";
