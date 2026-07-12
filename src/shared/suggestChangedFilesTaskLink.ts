/**
 * Stage 96: suggest a Blueprint task for changed-files linking (never auto-link).
 */

import type {
  BlueprintPhaseTaskCardStatus,
} from "./blueprintTaskCardConstants";
import type {
  BlueprintPhaseTaskCardsRecord,
  TaskImplementationReportRecord,
} from "./types";

export interface ChangedFilesTaskLinkSuggestion {
  taskId: string | null;
  reason: string | null;
}

const REVIEWED_STATUSES: BlueprintPhaseTaskCardStatus[] = ["reviewed", "skipped"];

export function suggestChangedFilesTaskLink(input: {
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  selectedImplementationTaskId: string | null;
  handoffSelectedTaskId: string | null;
  implementationReports: Record<string, TaskImplementationReportRecord>;
}): ChangedFilesTaskLinkSuggestion {
  const cards = input.taskCards?.cards ?? [];
  if (!cards.length) {
    return { taskId: null, reason: null };
  }

  const activeId = input.taskCards?.activeTaskId ?? null;
  if (activeId && cards.some((c) => c.id === activeId)) {
    return { taskId: activeId, reason: "active task from Blueprint task cards" };
  }

  const reports = Object.values(input.implementationReports).filter((r) => !r.stale);
  if (
    input.selectedImplementationTaskId &&
    reports.some((r) => r.taskId === input.selectedImplementationTaskId)
  ) {
    return {
      taskId: input.selectedImplementationTaskId,
      reason: "latest implementation intake",
    };
  }
  if (reports.length > 0) {
    const latest = [...reports].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
    return { taskId: latest.taskId, reason: "latest implementation intake" };
  }

  if (
    input.handoffSelectedTaskId &&
    cards.some((c) => c.id === input.handoffSelectedTaskId)
  ) {
    return {
      taskId: input.handoffSelectedTaskId,
      reason: "latest Task Builder Handoff",
    };
  }

  const firstNonReviewed = cards.find(
    (c) => !REVIEWED_STATUSES.includes(c.status),
  );
  if (firstNonReviewed) {
    return { taskId: firstNonReviewed.id, reason: "first non-reviewed task" };
  }

  return { taskId: null, reason: null };
}

export function formatChangedFilesTaskSuggestion(
  suggestion: ChangedFilesTaskLinkSuggestion,
): string | null {
  if (!suggestion.taskId || !suggestion.reason) return null;
  return `Suggested task: ${suggestion.taskId} based on ${suggestion.reason}.`;
}
