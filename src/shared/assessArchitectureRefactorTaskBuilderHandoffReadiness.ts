/**
 * Stage 104: rule-based readiness for Architecture Refactor Builder Handoff (no AI).
 */

import type {
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskCard,
  ArchitectureRefactorTaskCardsRecord,
} from "./types";
import {
  ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS,
  type ArchitectureRefactorTaskBuilderHandoffReadiness,
} from "./architectureRefactorTasks/architectureRefactorTaskBuilderHandoffConstants";

export interface ArchitectureRefactorHandoffReadinessInput {
  architectureHealth: ArchitectureHealthRecord | null;
  refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
  selectedTask: ArchitectureRefactorTaskCard | null;
  selectedTaskId: string | null;
}

export interface ArchitectureRefactorHandoffReadinessResult {
  readiness: ArchitectureRefactorTaskBuilderHandoffReadiness;
  recommendation: string;
  tooBroadWarning: boolean;
}

const APP_TSX_PATTERN = /(?:^|\/)App\.tsx$/i;
const MAIN_INDEX_PATTERN = /(?:^|\/)main\/index\.ts$/i;

export function assessArchitectureRefactorTaskBuilderHandoffReadiness(
  input: ArchitectureRefactorHandoffReadinessInput,
): ArchitectureRefactorHandoffReadinessResult {
  const { architectureHealth, refactorTaskCards, selectedTask, selectedTaskId } =
    input;

  if (
    !architectureHealth ||
    architectureHealth.stale ||
    !selectedTaskId ||
    !selectedTask
  ) {
    return {
      readiness: "not-ready",
      recommendation:
        ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS["not-ready"],
      tooBroadWarning: false,
    };
  }

  if (selectedTask.quality === "blocked") {
    return {
      readiness: "not-ready",
      recommendation:
        ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS["not-ready"],
      tooBroadWarning: false,
    };
  }

  const cardsStale = Boolean(refactorTaskCards?.stale);
  const tooBroad =
    selectedTask.quality === "too-broad" ||
    selectedTask.qualityFlags.includes("too broad") ||
    selectedTask.qualityFlags.includes("broad rewrite language") ||
    selectedTask.qualityFlags.includes("touches too many high-risk files at once");

  if (
    cardsStale ||
    tooBroad ||
    !selectedTask.validationSteps.trim() ||
    !selectedTask.safetyBoundaries.trim()
  ) {
    if (tooBroad) {
      return {
        readiness: "planning-only",
        recommendation:
          "This refactor task is too broad for safe implementation. Ask the builder for a narrower plan first.",
        tooBroadWarning: true,
      };
    }
    if (cardsStale || !selectedTask.safetyBoundaries.trim()) {
      return {
        readiness: "planning-only",
        recommendation:
          ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS["planning-only"],
        tooBroadWarning: tooBroad,
      };
    }
  }

  const target = selectedTask.refactorTarget.replace(/\\/g, "/");
  const files = selectedTask.filesLikelyInvolved.replace(/\\/g, "/");
  const touchesCritical =
    APP_TSX_PATTERN.test(target) ||
    MAIN_INDEX_PATTERN.test(target) ||
    /App\.tsx|main\/index\.ts/i.test(files);

  if (
    selectedTask.quality === "needs-clarification" ||
    touchesCritical
  ) {
    return {
      readiness: "ready-for-narrow-refactor-plan",
      recommendation:
        ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS[
          "ready-for-narrow-refactor-plan"
        ],
      tooBroadWarning: tooBroad,
    };
  }

  if (
    selectedTask.quality === "good" &&
    selectedTask.whatNotToChange.trim().length >= 20 &&
    selectedTask.validationSteps.trim().length >= 40 &&
    selectedTask.safetyBoundaries.trim().length >= 40
  ) {
    return {
      readiness: "ready-for-narrow-implementation",
      recommendation:
        ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS[
          "ready-for-narrow-implementation"
        ],
      tooBroadWarning: false,
    };
  }

  return {
    readiness: "ready-for-narrow-refactor-plan",
    recommendation:
      ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS[
        "ready-for-narrow-refactor-plan"
      ],
    tooBroadWarning: tooBroad,
  };
}
