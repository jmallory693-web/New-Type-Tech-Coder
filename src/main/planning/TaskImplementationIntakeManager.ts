import { buildTaskImplementationIntakeSummary } from "../../shared/buildTaskImplementationIntakeSummary";
import { buildJoinKeyFromTaskCard } from "../../shared/buildTaskJoinKey";
import { findNextTaskCardId } from "../../shared/buildBlueprintPhaseTaskCards";
import { TASK_ARTIFACT_KINDS } from "../../shared/taskJoinKeyConstants";
import { parseTaskImplementationReportText } from "../../shared/parseTaskImplementationReport";
import {
  TASK_IMPLEMENTATION_BUILDER_SOURCES,
  TASK_IMPLEMENTATION_MAX_DRAFT_CHARS,
  TASK_IMPLEMENTATION_MAX_EXCERPT_CHARS,
  TASK_IMPLEMENTATION_MAX_SAVED_CHARS,
  TASK_IMPLEMENTATION_SUGGESTED_MARK_RETURNED,
  type TaskImplementationBuilderSource,
} from "../../shared/taskImplementationIntakeConstants";
import type {
  BlueprintPhaseTaskCardsRecord,
  TaskImplementationIntakeState,
  TaskImplementationReportRecord,
} from "../../shared/types";
import type { BlueprintTaskCardsManager } from "./BlueprintTaskCardsManager";
import type { SafetyGate } from "../safety/SafetyGate";
import type { ImplementationReviewManager } from "../review/ImplementationReviewManager";

function isBuilderSource(value: unknown): value is TaskImplementationBuilderSource {
  return (
    typeof value === "string" &&
    (TASK_IMPLEMENTATION_BUILDER_SOURCES as readonly string[]).includes(value)
  );
}

function makeId(): string {
  return `task-impl-${Date.now().toString(36)}`;
}

function normalizeRecord(raw: TaskImplementationReportRecord): TaskImplementationReportRecord {
  return {
    id: raw.id ?? makeId(),
    taskId: raw.taskId,
    taskTitle: raw.taskTitle ?? raw.taskId,
    builderSource: isBuilderSource(raw.builderSource) ? raw.builderSource : "Other",
    savedAt: raw.savedAt,
    reportText: raw.reportText ?? "",
    summaryMarkdown: raw.summaryMarkdown ?? "",
    detectedFilesChanged: Array.isArray(raw.detectedFilesChanged)
      ? raw.detectedFilesChanged
      : [],
    detectedValidationMentions: Array.isArray(raw.detectedValidationMentions)
      ? raw.detectedValidationMentions
      : [],
    detectedRisksBlockers: Array.isArray(raw.detectedRisksBlockers)
      ? raw.detectedRisksBlockers
      : [],
    detectedSafetyConfirmations: Array.isArray(raw.detectedSafetyConfirmations)
      ? raw.detectedSafetyConfirmations
      : [],
    missingExpectedSections: Array.isArray(raw.missingExpectedSections)
      ? raw.missingExpectedSections
      : [],
    possibleSecretPatterns: Array.isArray(raw.possibleSecretPatterns)
      ? raw.possibleSecretPatterns
      : [],
    savedWithSecretOverride: Boolean(raw.savedWithSecretOverride),
    truncationFlag: Boolean(raw.truncationFlag),
    markedImplementationReturned: Boolean(raw.markedImplementationReturned),
    markedReviewed: Boolean(raw.markedReviewed),
    stale: Boolean(raw.stale),
    reportExcerpt: raw.reportExcerpt ?? "",
    taskPhase: raw.taskPhase,
    taskArtifactKind: raw.taskArtifactKind,
    sourceTaskCardGeneratedAt: raw.sourceTaskCardGeneratedAt,
    sourceTaskCardHash: raw.sourceTaskCardHash,
    sourceHandoffId: raw.sourceHandoffId,
    sourceHandoffGeneratedAt: raw.sourceHandoffGeneratedAt,
  };
}

/** Stage 90: Task Implementation Intake manager (text-only; no AI; no source reads). */
export class TaskImplementationIntakeManager {
  private selectedTaskId: string | null = null;
  private builderSource: TaskImplementationBuilderSource = "Cursor";
  private draftText = "";
  private reportsByTaskId: Record<string, TaskImplementationReportRecord> = {};
  private statusMessage: string | null =
    "Paste a builder implementation report for a phase task. Text-only — nothing is executed or sent to AI automatically.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getReportsByTaskId(): Record<string, TaskImplementationReportRecord> {
    return { ...this.reportsByTaskId };
  }

  getReportForTask(taskId: string): TaskImplementationReportRecord | null {
    const record = this.reportsByTaskId[taskId];
    return record ? { ...record } : null;
  }

  getState(
    taskCards: BlueprintPhaseTaskCardsRecord | null,
    hasImplementationReview: boolean,
    handoffTaskId: string | null = null,
  ): TaskImplementationIntakeState {
    const selectedId = this.resolveSelectedTaskId(taskCards, handoffTaskId);
    const selectedReport = selectedId ? this.reportsByTaskId[selectedId] : null;
    const nextTaskId = taskCards ? findNextTaskCardId(taskCards) : null;
    const nextTaskSuggestion =
      selectedReport?.markedReviewed && nextTaskId
        ? `Next task appears to be ${nextTaskId}. Copy or generate a handoff for the next task.`
        : null;

    return {
      selectedTaskId: selectedId,
      builderSource: this.builderSource,
      draftText: this.draftText,
      reportsByTaskId: { ...this.reportsByTaskId },
      selectedReport: selectedReport ? { ...selectedReport } : null,
      statusMessage: this.statusMessage,
      suggestedMarkReturned:
        selectedReport && !selectedReport.stale && !selectedReport.markedImplementationReturned
          ? TASK_IMPLEMENTATION_SUGGESTED_MARK_RETURNED
          : null,
      nextTaskSuggestion,
      liveParse: this.draftText.trim()
        ? parseTaskImplementationReportText(this.draftText)
        : null,
      hasImplementationReview,
    };
  }

  private resolveSelectedTaskId(
    taskCards: BlueprintPhaseTaskCardsRecord | null,
    handoffTaskId: string | null,
  ): string | null {
    const cards = taskCards?.cards ?? [];
    if (cards.length === 0) return null;

    const candidates = [
      this.selectedTaskId,
      handoffTaskId,
      taskCards?.activeTaskId,
      cards[0]?.id,
    ].filter((id): id is string => Boolean(id));

    for (const id of candidates) {
      if (cards.some((c) => c.id === id)) return id;
    }
    return cards[0]?.id ?? null;
  }

  syncWithTaskCards(
    taskCards: BlueprintPhaseTaskCardsRecord | null,
    handoffTaskId: string | null,
  ): void {
    if (!taskCards) {
      for (const id of Object.keys(this.reportsByTaskId)) {
        this.reportsByTaskId[id] = { ...this.reportsByTaskId[id], stale: true };
      }
      this.selectedTaskId = null;
      this.statusMessage = "Task cards cleared — implementation reports marked stale.";
      return;
    }

    this.selectedTaskId = this.resolveSelectedTaskId(taskCards, handoffTaskId);

    let staleCount = 0;
    for (const [id, record] of Object.entries(this.reportsByTaskId)) {
      const exists = taskCards.cards.some((c) => c.id === id);
      if (!exists && !record.stale) {
        this.reportsByTaskId[id] = { ...record, stale: true };
        staleCount += 1;
      }
    }
    if (staleCount > 0) {
      this.statusMessage = `${staleCount} implementation report(s) marked stale — task ID no longer exists.`;
    }
  }

  setSelectedTaskId(taskId: string): void {
    this.selectedTaskId = taskId;
    this.safetyGate.log(
      "info",
      "Task implementation intake selected task changed",
      taskId,
    );
    this.statusMessage = `Selected task for implementation intake: ${taskId}.`;
  }

  setBuilderSource(source: unknown): void {
    if (!isBuilderSource(source)) return;
    this.builderSource = source;
    this.safetyGate.log(
      "info",
      "Task implementation intake builder source changed",
      source,
    );
    this.statusMessage = `Builder/source set to ${source}.`;
  }

  setDraftText(text: unknown): void {
    this.draftText =
      typeof text === "string"
        ? text.slice(0, TASK_IMPLEMENTATION_MAX_DRAFT_CHARS)
        : "";
  }

  saveReport(input: {
    taskCards: BlueprintPhaseTaskCardsRecord | null;
    implementationReviewManager: ImplementationReviewManager;
    allowSecretOverride?: boolean;
    taskCardHandoff?: import("../../shared/types").TaskCardBuilderHandoffRecord | null;
  }):
    | { ok: true; record: TaskImplementationReportRecord }
    | { ok: false; message: string } {
    if (!input.taskCards?.cards.length) {
      this.statusMessage = "Generate Blueprint Phase Task Cards first.";
      this.safetyGate.log(
        "warning",
        "Task implementation report save blocked",
        "No task cards.",
      );
      return { ok: false, message: this.statusMessage };
    }

    const taskId = this.resolveSelectedTaskId(input.taskCards, null);
    if (!taskId) {
      this.statusMessage = "Select a task before saving an implementation report.";
      return { ok: false, message: this.statusMessage };
    }

    const task = input.taskCards.cards.find((c) => c.id === taskId);
    if (!task) {
      this.statusMessage = "Select a task before saving an implementation report.";
      return { ok: false, message: this.statusMessage };
    }

    const trimmed = this.draftText.trim();
    if (!trimmed) {
      this.statusMessage = "Paste the builder's implementation report before saving.";
      this.safetyGate.log(
        "warning",
        "Task implementation report save blocked",
        "Empty paste area.",
      );
      return { ok: false, message: this.statusMessage };
    }

    const parse = parseTaskImplementationReportText(trimmed);
    if (parse.blockedBySecrets && !input.allowSecretOverride) {
      this.safetyGate.log(
        "blocked",
        "Implementation report possible secret detected",
        `${parse.possibleSecretPatterns.length} secret-like pattern(s).`,
      );
      this.statusMessage =
        "Possible secret detected. Redact secrets before saving, or explicitly confirm override if allowed.";
      return { ok: false, message: this.statusMessage };
    }

    if (parse.missingExpectedSections.length > 0) {
      this.safetyGate.log(
        "warning",
        "Implementation report missing sections detected",
        parse.missingExpectedSections.join(", "),
      );
    }

    const truncationFlag = trimmed.length > TASK_IMPLEMENTATION_MAX_SAVED_CHARS;
    const reportText = trimmed.slice(0, TASK_IMPLEMENTATION_MAX_SAVED_CHARS);
    const savedAt = new Date().toISOString();
    const hasImplementationReview = Boolean(input.implementationReviewManager.getSaved());

    const partialRecord = {
      taskId,
      taskTitle: task.title,
      builderSource: this.builderSource,
      savedAt,
      reportText,
      detectedFilesChanged: parse.detectedFilesChanged,
      detectedValidationMentions: parse.detectedValidationMentions,
      detectedRisksBlockers: parse.detectedRisksBlockers,
      detectedSafetyConfirmations: parse.detectedSafetyConfirmations,
      missingExpectedSections: parse.missingExpectedSections,
      possibleSecretPatterns: parse.possibleSecretPatterns,
      savedWithSecretOverride: Boolean(
        parse.blockedBySecrets && input.allowSecretOverride,
      ),
      truncationFlag,
      markedImplementationReturned: false,
      markedReviewed: false,
      stale: false,
      reportExcerpt:
        reportText.length > TASK_IMPLEMENTATION_MAX_EXCERPT_CHARS
          ? `${reportText.slice(0, TASK_IMPLEMENTATION_MAX_EXCERPT_CHARS - 1)}…`
          : reportText,
    };

    const summaryMarkdown = buildTaskImplementationIntakeSummary({
      ...partialRecord,
      parse,
      hasImplementationReview,
    });

    const joinKey = buildJoinKeyFromTaskCard(
      task,
      input.taskCards.generatedAt,
      TASK_ARTIFACT_KINDS.implementationReport,
    );

    const record: TaskImplementationReportRecord = {
      ...partialRecord,
      id: makeId(),
      summaryMarkdown,
      ...joinKey,
      sourceHandoffId:
        input.taskCardHandoff?.selectedTaskId === taskId
          ? input.taskCardHandoff.id
          : undefined,
      sourceHandoffGeneratedAt:
        input.taskCardHandoff?.selectedTaskId === taskId
          ? input.taskCardHandoff.generatedAt
          : undefined,
    };

    this.reportsByTaskId[taskId] = record;
    this.draftText = "";
    this.selectedTaskId = taskId;

    const warnings: string[] = [];
    if (truncationFlag) {
      warnings.push(`Report truncated to ${TASK_IMPLEMENTATION_MAX_SAVED_CHARS} characters.`);
    }
    if (parse.missingExpectedSections.length > 0) {
      warnings.push(
        `Missing sections: ${parse.missingExpectedSections.join(", ")}.`,
      );
    }
    if (parse.possibleSecretPatterns.length > 0) {
      warnings.push("Possible secret patterns were present at save.");
    }

    this.statusMessage = [
      `Saved implementation report for ${taskId} (text only — not executed).`,
      TASK_IMPLEMENTATION_SUGGESTED_MARK_RETURNED,
      ...warnings,
    ]
      .filter(Boolean)
      .join(" ");

    this.safetyGate.log(
      "success",
      "Task implementation report saved",
      `${taskId} · ${this.builderSource} · ${reportText.length} chars.`,
    );

    return { ok: true, record };
  }

  clearReport(taskId?: string): void {
    const id = taskId ?? this.selectedTaskId;
    if (!id || !this.reportsByTaskId[id]) {
      this.statusMessage = "No saved implementation report to clear for this task.";
      this.safetyGate.log(
        "warning",
        "Task implementation report clear blocked",
        "No saved report.",
      );
      return;
    }
    delete this.reportsByTaskId[id];
    this.draftText = "";
    this.statusMessage = `Cleared implementation report for ${id}.`;
    this.safetyGate.log(
      "info",
      "Task implementation report cleared",
      `Task ${id}.`,
    );
  }

  recordCopy(taskId?: string): string | null {
    const id = taskId ?? this.selectedTaskId;
    const record = id ? this.reportsByTaskId[id] : null;
    if (!record) {
      this.statusMessage = "Save a Task Implementation Report before copying.";
      this.safetyGate.log(
        "warning",
        "Task implementation report copy blocked",
        "No saved report.",
      );
      return null;
    }
    this.safetyGate.log(
      "info",
      "Task implementation report copied",
      `${record.taskId} · ${record.reportText.length} chars.`,
    );
    this.statusMessage = "Task Implementation Report copied to clipboard (text only).";
    return record.reportText;
  }

  markImplementationReturned(
    taskCardsManager: BlueprintTaskCardsManager,
    taskId?: string,
  ): { ok: boolean; message: string } {
    const id = taskId ?? this.selectedTaskId;
    const record = id ? this.reportsByTaskId[id] : null;
    if (!record) {
      this.statusMessage = "Save an implementation report before marking returned.";
      return { ok: false, message: this.statusMessage };
    }
    if (record.stale) {
      this.statusMessage = "Report is stale — regenerate task cards or clear this report.";
      return { ok: false, message: this.statusMessage };
    }

    const result = taskCardsManager.setTaskStatus(id!, "implementation-returned");
    if (!result.ok) {
      this.statusMessage = result.message;
      return result;
    }

    this.reportsByTaskId[id!] = {
      ...record,
      markedImplementationReturned: true,
    };
    this.statusMessage = `${id} marked Implementation Returned. Run Implementation Review next.`;
    this.safetyGate.log(
      "success",
      "Task marked implementation returned",
      id!,
    );
    return { ok: true, message: this.statusMessage };
  }

  markReviewed(input: {
    taskCardsManager: BlueprintTaskCardsManager;
    implementationReviewManager: ImplementationReviewManager;
    confirmWithoutReview?: boolean;
    taskId?: string;
  }): { ok: boolean; message: string; needsConfirm?: boolean } {
    const id = input.taskId ?? this.selectedTaskId;
    const record = id ? this.reportsByTaskId[id] : null;
    if (!record) {
      this.statusMessage = "Save an implementation report before marking reviewed.";
      return { ok: false, message: this.statusMessage };
    }
    if (record.stale) {
      this.statusMessage = "Report is stale — cannot mark reviewed.";
      return { ok: false, message: this.statusMessage };
    }

    const hasReview = Boolean(input.implementationReviewManager.getSaved());
    if (!hasReview && !input.confirmWithoutReview) {
      this.statusMessage =
        "No Implementation Review found. Mark reviewed anyway only after explicit confirmation.";
      return {
        ok: false,
        message: this.statusMessage,
        needsConfirm: true,
      };
    }

    const result = input.taskCardsManager.setTaskStatus(id!, "reviewed");
    if (!result.ok) {
      this.statusMessage = result.message;
      return result;
    }

    this.reportsByTaskId[id!] = {
      ...record,
      markedReviewed: true,
      markedImplementationReturned: true,
    };

    const taskCards = input.taskCardsManager.getSaved();
    const nextId = taskCards ? findNextTaskCardId(taskCards) : null;
    this.statusMessage = nextId
      ? `${id} marked Reviewed. Next task appears to be ${nextId}.`
      : `${id} marked Reviewed.`;

    this.safetyGate.log("success", "Task marked reviewed", id!);
    return { ok: true, message: this.statusMessage };
  }

  clearForProjectChange(): void {
    this.reportsByTaskId = {};
    this.selectedTaskId = null;
    this.builderSource = "Cursor";
    this.draftText = "";
    this.statusMessage =
      "Paste a builder implementation report for a phase task. Text-only — nothing is executed or sent to AI automatically.";
  }

  restoreFromHistory(input: {
    reportsByTaskId: Record<string, TaskImplementationReportRecord>;
    selectedTaskId: string | null;
    builderSource: TaskImplementationBuilderSource;
  }): void {
    this.reportsByTaskId = {};
    for (const [id, raw] of Object.entries(input.reportsByTaskId ?? {})) {
      this.reportsByTaskId[id] = normalizeRecord(raw);
    }
    this.selectedTaskId = input.selectedTaskId;
    if (isBuilderSource(input.builderSource)) {
      this.builderSource = input.builderSource;
    }
    const count = Object.keys(this.reportsByTaskId).length;
    if (count > 0) {
      this.statusMessage = `Restored ${count} task implementation report(s) from history.`;
    }
  }
}
