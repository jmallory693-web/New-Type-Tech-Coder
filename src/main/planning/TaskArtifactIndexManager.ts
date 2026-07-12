import { buildTaskArtifactIndex } from "../../shared/buildTaskArtifactIndex";
import type {
  BlueprintPhaseTaskCardsRecord,
  BlueprintTaskReconciliationRecord,
  BuilderResultRecord,
  ChangedFilesScanResult,
  ImplementationReviewRecord,
  TaskArtifactIndexRecord,
  TaskArtifactIndexState,
  TaskCardBuilderHandoffRecord,
  ChangedFilesTaskLinkRecord,
  TaskImplementationReportRecord,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

const MAX_PREVIEW = 1200;

function normalizeRecord(raw: TaskArtifactIndexRecord): TaskArtifactIndexRecord {
  return {
    id: raw.id,
    generatedAt: raw.generatedAt,
    sourceTaskCardsGeneratedAt: raw.sourceTaskCardsGeneratedAt ?? null,
    sourceHandoffGeneratedAt: raw.sourceHandoffGeneratedAt ?? null,
    sourceImplementationReportCount: raw.sourceImplementationReportCount ?? 0,
    sourceReconciliationGeneratedAt: raw.sourceReconciliationGeneratedAt ?? null,
    sourceBuilderResultSavedAt: raw.sourceBuilderResultSavedAt ?? null,
    taskCount: raw.taskCount ?? 0,
    linkedArtifactCount: raw.linkedArtifactCount ?? 0,
    unlinkedArtifactCount: raw.unlinkedArtifactCount ?? 0,
    staleArtifactCount: raw.staleArtifactCount ?? 0,
    recommendation: raw.recommendation ?? "Needs relinking",
    filterTaskId: raw.filterTaskId ?? null,
    stale: Boolean(raw.stale),
    markdown: raw.markdown ?? "",
    previewExcerpt: raw.previewExcerpt ?? "",
  };
}

export interface TaskArtifactIndexSnapshotSources {
  taskCardsGeneratedAt: string | null;
  handoffGeneratedAt: string | null;
  implementationReportCount: number;
  reconciliationGeneratedAt: string | null;
  builderResultSavedAt: string | null;
}

/** Stage 94: Task Artifact Index manager (metadata only; no AI). */
export class TaskArtifactIndexManager {
  private saved: TaskArtifactIndexRecord | null = null;
  private filterTaskId: string | null = null;
  private statusMessage: string | null =
    "Generate a rule-based Task Artifact Index to trace task cards, handoffs, and reports by task ID.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): TaskArtifactIndexRecord | null {
    return this.saved ? { ...this.saved } : null;
  }

  getState(): TaskArtifactIndexState {
    return {
      saved: this.saved ? { ...this.saved } : null,
      filterTaskId: this.filterTaskId,
      statusMessage: this.statusMessage,
    };
  }

  setFilterTaskId(taskId: string | null): void {
    this.filterTaskId = taskId;
    this.statusMessage = taskId
      ? `Artifact index filter: ${taskId} only.`
      : "Artifact index filter: all tasks.";
    this.safetyGate.log(
      "info",
      "Task artifact index filter changed",
      taskId ?? "all tasks",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Task artifacts changed after this index was generated. Regenerate Task Artifact Index.";
    this.safetyGate.log("info", "Task artifact index stale", reason);
  }

  syncWithArtifacts(sources: TaskArtifactIndexSnapshotSources): void {
    if (!this.saved || this.saved.stale) return;

    const stale =
      (this.saved.sourceTaskCardsGeneratedAt &&
        this.saved.sourceTaskCardsGeneratedAt !== sources.taskCardsGeneratedAt) ||
      (this.saved.sourceHandoffGeneratedAt &&
        this.saved.sourceHandoffGeneratedAt !== sources.handoffGeneratedAt) ||
      this.saved.sourceImplementationReportCount !==
        sources.implementationReportCount ||
      (this.saved.sourceReconciliationGeneratedAt &&
        this.saved.sourceReconciliationGeneratedAt !==
          sources.reconciliationGeneratedAt) ||
      (this.saved.sourceBuilderResultSavedAt &&
        this.saved.sourceBuilderResultSavedAt !== sources.builderResultSavedAt);

    if (stale) {
      this.markStale("Linked task artifacts changed.");
    }
  }

  generate(input: {
    taskCards: BlueprintPhaseTaskCardsRecord | null;
    taskCardHandoff: TaskCardBuilderHandoffRecord | null;
    implementationReports: Record<string, TaskImplementationReportRecord>;
    builderResult: BuilderResultRecord | null;
    implementationReview: ImplementationReviewRecord | null;
    taskReconciliation: BlueprintTaskReconciliationRecord | null;
    changedFilesScan: ChangedFilesScanResult | null;
    changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  }): TaskArtifactIndexRecord | null {
    if (!input.taskCards?.cards.length) {
      this.statusMessage = "Generate Blueprint Phase Task Cards first.";
      this.safetyGate.log(
        "warning",
        "Task artifact index blocked",
        "No task cards.",
      );
      return null;
    }

    const legacyCount = [
      input.taskCardHandoff && !input.taskCardHandoff.sourceTaskCardHash,
      ...Object.values(input.implementationReports).filter(
        (r) => !r.sourceTaskCardHash,
      ),
    ].filter(Boolean).length;

    const result = buildTaskArtifactIndex({
      taskCards: input.taskCards,
      taskCardHandoff: input.taskCardHandoff,
      implementationReports: input.implementationReports,
      builderResult: input.builderResult,
      implementationReview: input.implementationReview,
      taskReconciliation: input.taskReconciliation,
      changedFilesScan: input.changedFilesScan,
      changedFilesTaskLink: input.changedFilesTaskLink,
      filterTaskId: this.filterTaskId,
    });

    const record: TaskArtifactIndexRecord = {
      id: `task-artifact-index-${Date.now().toString(36)}`,
      generatedAt: result.generatedAt,
      sourceTaskCardsGeneratedAt: input.taskCards.generatedAt,
      sourceHandoffGeneratedAt: input.taskCardHandoff?.generatedAt ?? null,
      sourceImplementationReportCount: Object.keys(input.implementationReports)
        .length,
      sourceReconciliationGeneratedAt: input.taskReconciliation?.generatedAt ?? null,
      sourceBuilderResultSavedAt: input.builderResult?.savedAt ?? null,
      taskCount: result.taskCount,
      linkedArtifactCount: result.linkedArtifactCount,
      unlinkedArtifactCount: result.unlinkedArtifactCount,
      staleArtifactCount: result.staleArtifactCount,
      recommendation: result.recommendation,
      filterTaskId: this.filterTaskId,
      stale: false,
      markdown: result.markdown,
      previewExcerpt:
        result.markdown.length > MAX_PREVIEW
          ? `${result.markdown.slice(0, MAX_PREVIEW - 1)}…`
          : result.markdown,
    };

    this.saved = record;
    this.statusMessage = `Task Artifact Index ready — **${result.recommendation}** (${result.flags.length} flag(s)).`;
    if (legacyCount > 0) {
      this.statusMessage += ` Some artifacts were created before task join keys existed.`;
    }

    this.safetyGate.log(
      "success",
      "Task artifact index generated",
      `${result.taskCount} tasks · ${result.recommendation}`,
    );

    if (result.unlinkedArtifactCount > 0) {
      this.safetyGate.log(
        "warning",
        "Unlinked task artifacts detected",
        `${result.unlinkedArtifactCount} unlinked flag(s).`,
      );
    }
    if (result.staleArtifactCount > 0) {
      this.safetyGate.log(
        "warning",
        "Stale task artifacts detected",
        `${result.staleArtifactCount} stale flag(s).`,
      );
    }

    return record;
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Task Artifact Index cleared.";
    this.safetyGate.log("info", "Task artifact index cleared", "User cleared index.");
  }

  recordCopy(): string | null {
    if (!this.saved) {
      this.statusMessage = "Generate a Task Artifact Index before copying.";
      this.safetyGate.log(
        "warning",
        "Task artifact index copy blocked",
        "No saved index.",
      );
      return null;
    }
    this.safetyGate.log(
      "info",
      "Task artifact index copied",
      `Recommendation: ${this.saved.recommendation}.`,
    );
    this.statusMessage = "Task Artifact Index copied to clipboard (text only).";
    return this.saved.markdown;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.filterTaskId = null;
    this.statusMessage =
      "Generate a rule-based Task Artifact Index to trace task cards, handoffs, and reports by task ID.";
  }

  restoreSaved(record: TaskArtifactIndexRecord | null | undefined): void {
    this.saved = record ? normalizeRecord(record) : null;
    if (this.saved) {
      this.filterTaskId = this.saved.filterTaskId;
      this.statusMessage = `Task Artifact Index restored (${this.saved.recommendation}${this.saved.stale ? ", stale" : ""}).`;
    }
  }
}
