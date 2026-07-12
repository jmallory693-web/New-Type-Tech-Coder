/**
 * Stage 88: rule-based readiness for Task Card Builder Handoff (no AI).
 */

import type { BlueprintCompletenessReport } from "./types";
import type { BlueprintPhaseTaskCard } from "./types";
import type { BlueprintImportedRecord } from "./types";
import type { TaskCardBuilderHandoffReadiness } from "./taskCardBuilderHandoffConstants";
import { TASK_CARD_HANDOFF_READINESS_LABELS } from "./taskCardBuilderHandoffConstants";

export interface TaskCardHandoffReadinessInput {
  blueprintImported: BlueprintImportedRecord | null;
  completeness: BlueprintCompletenessReport | null;
  selectedTask: BlueprintPhaseTaskCard | null;
  selectedTaskId: string | null;
}

export interface TaskCardHandoffReadinessResult {
  readiness: TaskCardBuilderHandoffReadiness;
  recommendation: string;
  tooBroadWarning: boolean;
}

function blueprintReadyForImplementation(
  completeness: BlueprintCompletenessReport | null,
): boolean {
  if (!completeness) return false;
  return (
    completeness.readiness === "ready-for-phase-1" ||
    completeness.readiness === "ready-for-builder-planning-only"
  );
}

export function assessTaskCardBuilderHandoffReadiness(
  input: TaskCardHandoffReadinessInput,
): TaskCardHandoffReadinessResult {
  const { blueprintImported, completeness, selectedTask, selectedTaskId } =
    input;

  if (!blueprintImported || !selectedTaskId || !selectedTask) {
    return {
      readiness: "not-ready",
      recommendation: TASK_CARD_HANDOFF_READINESS_LABELS["not-ready"],
      tooBroadWarning: false,
    };
  }

  const tooBroad =
    selectedTask.quality === "too-broad" ||
    selectedTask.quality === "blocked" ||
    selectedTask.qualityFlags.includes("too broad");

  if (
    selectedTask.quality === "blocked" ||
    tooBroad ||
    !selectedTask.validationSteps.trim() ||
    !selectedTask.safetyBoundaries.trim()
  ) {
    if (selectedTask.quality === "blocked" || !selectedTask.safetyBoundaries.trim()) {
      return {
        readiness: "not-ready",
        recommendation: TASK_CARD_HANDOFF_READINESS_LABELS["not-ready"],
        tooBroadWarning: tooBroad,
      };
    }
    if (tooBroad) {
      return {
        readiness: "planning-only",
        recommendation:
          "This task is too broad for safe implementation. Ask the builder for a narrower plan first.",
        tooBroadWarning: true,
      };
    }
  }

  const blueprintReady = blueprintReadyForImplementation(completeness);
  const hasOpenQuestions =
    selectedTask.openQuestions.trim().length > 20 &&
    !selectedTask.openQuestions.includes("(Resolve during planning");

  if (!blueprintReady || hasOpenQuestions || selectedTask.quality === "needs-clarification") {
    return {
      readiness: "planning-only",
      recommendation: TASK_CARD_HANDOFF_READINESS_LABELS["planning-only"],
      tooBroadWarning: tooBroad,
    };
  }

  if (
    selectedTask.quality === "good" &&
    selectedTask.whatNotToBuildYet.trim().length >= 30 &&
    selectedTask.validationSteps.trim().length >= 40 &&
    blueprintReady
  ) {
    return {
      readiness: "ready-for-narrow-implementation",
      recommendation: TASK_CARD_HANDOFF_READINESS_LABELS["ready-for-narrow-implementation"],
      tooBroadWarning: false,
    };
  }

  if (
    selectedTask.status === "drafted" &&
    selectedTask.quality !== "good"
  ) {
    return {
      readiness: "ready-for-builder-planning",
      recommendation: TASK_CARD_HANDOFF_READINESS_LABELS["ready-for-builder-planning"],
      tooBroadWarning: tooBroad,
    };
  }

  return {
    readiness: "ready-for-builder-planning",
    recommendation: TASK_CARD_HANDOFF_READINESS_LABELS["ready-for-builder-planning"],
    tooBroadWarning: tooBroad,
  };
}
