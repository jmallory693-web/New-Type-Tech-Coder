import {
  buildArchitectureRefactorTaskImplementationIntakeSummary,
  compareRefactorReportToChangedFilesMetadata,
  findNextRefactorTaskId,
} from "../../shared/architectureRefactorTasks/buildArchitectureRefactorTaskImplementationIntakeSummary";
import {
  buildJoinKeyFromRefactorTaskCard,
} from "../../shared/architectureRefactorTasks/buildRefactorTaskJoinKey";
import { parseArchitectureRefactorTaskImplementationReportText } from "../../shared/architectureRefactorTasks/parseArchitectureRefactorTaskImplementationReport";
import {
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_BUILDER_SOURCES,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_DRAFT_CHARS,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_EXCERPT_CHARS,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_SAVED_CHARS,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_KIND,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_SUGGESTED_MARK_RETURNED,
  type ArchitectureRefactorImplementationBuilderSource,
} from "../../shared/architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants";
import type {
  ArchitectureRefactorTaskCardsRecord,
  ArchitectureRefactorTaskImplementationIntakeState,
  ArchitectureRefactorTaskImplementationReportRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
} from "../../shared/types";
import type { ArchitectureRefactorTaskCardsManager } from "./ArchitectureRefactorTaskCardsManager";
import type { SafetyGate } from "../safety/SafetyGate";
import type { ImplementationReviewManager } from "../review/ImplementationReviewManager";

function isBuilderSource(
  value: unknown,
): value is ArchitectureRefactorImplementationBuilderSource {
  return (
    typeof value === "string" &&
    (ARCHITECTURE_REFACTOR_IMPLEMENTATION_BUILDER_SOURCES as readonly string[]).includes(
      value,
    )
  );
}

function makeId(): string {
  return `arch-refactor-impl-${Date.now().toString(36)}`;
}

function normalizeRecord(
  raw: ArchitectureRefactorTaskImplementationReportRecord,
): ArchitectureRefactorTaskImplementationReportRecord {
  return {
    id: raw.id ?? makeId(),
    taskId: raw.taskId,
    taskTitle: raw.taskTitle ?? raw.taskId,
    refactorTarget: raw.refactorTarget ?? "",
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
    detectedBehaviorPreservationMentions: Array.isArray(
      raw.detectedBehaviorPreservationMentions,
    )
      ? raw.detectedBehaviorPreservationMentions
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
    missingBehaviorPreservationChecks: Array.isArray(
      raw.missingBehaviorPreservationChecks,
    )
      ? raw.missingBehaviorPreservationChecks
      : [],
    possibleSecretPatterns: Array.isArray(raw.possibleSecretPatterns)
      ? raw.possibleSecretPatterns
      : [],
    changedFilesScopeWarnings: Array.isArray(raw.changedFilesScopeWarnings)
      ? raw.changedFilesScopeWarnings
      : [],
    behaviorChangeWarning: Boolean(raw.behaviorChangeWarning),
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

/** Stage 106: Architecture Refactor Implementation Intake manager (text-only). */
export class ArchitectureRefactorTaskImplementationIntakeManager {
  private selectedTaskId: string | null = null;
  private builderSource: ArchitectureRefactorImplementationBuilderSource = "Cursor";
  private draftText = "";
  private reportsByTaskId: Record<string, ArchitectureRefactorTaskImplementationReportRecord> =
    {};
  private statusMessage: string | null =
    "Paste a builder refactor implementation report for an architecture refactor task. Text-only — nothing is executed or sent to AI automatically.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getReportsByTaskId(): Record<string, ArchitectureRefactorTaskImplementationReportRecord> {
    return { ...this.reportsByTaskId };
  }

  getReportForTask(
    taskId: string,
  ): ArchitectureRefactorTaskImplementationReportRecord | null {
    const record = this.reportsByTaskId[taskId];
    return record ? { ...record } : null;
  }

  getState(input: {
    refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
    hasImplementationReview: boolean;
    handoffTaskId: string | null;
  }): ArchitectureRefactorTaskImplementationIntakeState {
    const selectedId = this.resolveSelectedTaskId(
      input.refactorTaskCards,
      input.handoffTaskId,
    );
    const selectedReport = selectedId ? this.reportsByTaskId[selectedId] : null;
    const cards = input.refactorTaskCards?.cards ?? [];
    const nextTaskId = selectedId
      ? findNextRefactorTaskId(cards, selectedId)
      : null;
    const nextTaskSuggestion =
      selectedReport?.markedReviewed && nextTaskId
        ? `Next refactor task appears to be ${nextTaskId}. Generate or copy handoff for the next refactor task.`
        : null;

    return {
      selectedTaskId: selectedId,
      builderSource: this.builderSource,
      draftText: this.draftText,
      reportsByTaskId: { ...this.reportsByTaskId },
      selectedReport: selectedReport ? { ...selectedReport } : null,
      statusMessage: this.statusMessage,
      suggestedMarkReturned:
        selectedReport &&
        !selectedReport.stale &&
        !selectedReport.markedImplementationReturned &&
        selectedId
          ? ARCHITECTURE_REFACTOR_IMPLEMENTATION_SUGGESTED_MARK_RETURNED(selectedId)
          : null,
      nextTaskSuggestion,
      liveParse: this.draftText.trim()
        ? parseArchitectureRefactorTaskImplementationReportText(this.draftText)
        : null,
      hasImplementationReview: input.hasImplementationReview,
    };
  }

  private resolveSelectedTaskId(
    refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null,
    handoffTaskId: string | null,
  ): string | null {
    const cards = refactorTaskCards?.cards ?? [];
    if (cards.length === 0) return null;

    const candidates = [
      this.selectedTaskId,
      handoffTaskId,
      refactorTaskCards?.activeTaskId,
      cards[0]?.id,
    ].filter((id): id is string => Boolean(id));

    for (const id of candidates) {
      if (cards.some((c) => c.id === id)) return id;
    }
    return cards[0]?.id ?? null;
  }

  markStale(reason: string): void {
    let count = 0;
    for (const [id, record] of Object.entries(this.reportsByTaskId)) {
      if (!record.stale) {
        this.reportsByTaskId[id] = { ...record, stale: true };
        count += 1;
      }
    }
    if (count > 0) {
      this.statusMessage =
        "Architecture refactor implementation reports marked stale — regenerate cards or Architecture Health.";
      this.safetyGate.log(
        "info",
        "Architecture refactor implementation reports stale",
        reason,
      );
    }
  }

  syncWithRefactorCards(
    refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null,
    handoffTaskId: string | null,
  ): void {
    if (!refactorTaskCards) {
      this.markStale("Refactor task cards cleared.");
      this.selectedTaskId = null;
      return;
    }

    if (refactorTaskCards.stale) {
      this.markStale("Architecture Refactor Task Cards are stale.");
    }

    this.selectedTaskId = this.resolveSelectedTaskId(refactorTaskCards, handoffTaskId);

    let staleCount = 0;
    for (const [id, record] of Object.entries(this.reportsByTaskId)) {
      const exists = refactorTaskCards.cards.some((c) => c.id === id);
      if (!exists && !record.stale) {
        this.reportsByTaskId[id] = { ...record, stale: true };
        staleCount += 1;
      }
    }
    if (staleCount > 0) {
      this.statusMessage = `${staleCount} refactor implementation report(s) marked stale — task ID no longer exists.`;
    }
  }

  setSelectedTaskId(taskId: string): void {
    this.selectedTaskId = taskId;
    this.safetyGate.log(
      "info",
      "Architecture refactor implementation intake selected task changed",
      taskId,
    );
    this.statusMessage = `Selected refactor task for implementation intake: ${taskId}.`;
  }

  setBuilderSource(source: unknown): void {
    if (!isBuilderSource(source)) return;
    this.builderSource = source;
    this.safetyGate.log(
      "info",
      "Architecture refactor implementation intake builder source changed",
      source,
    );
    this.statusMessage = `Builder/source set to ${source}.`;
  }

  setDraftText(text: unknown): void {
    this.draftText =
      typeof text === "string"
        ? text.slice(0, ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_DRAFT_CHARS)
        : "";
  }

  saveReport(input: {
    refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
    implementationReviewManager: ImplementationReviewManager;
    allowSecretOverride?: boolean;
    refactorHandoff?: import("../../shared/types").ArchitectureRefactorTaskBuilderHandoffRecord | null;
    changedFilesScan: ChangedFilesScanResult | null;
    changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  }):
    | { ok: true; record: ArchitectureRefactorTaskImplementationReportRecord }
    | { ok: false; message: string } {
    if (!input.refactorTaskCards?.cards.length || input.refactorTaskCards.stale) {
      this.statusMessage = "Generate current Architecture Refactor Task Cards first.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor implementation report save blocked",
        "No current refactor task cards.",
      );
      return { ok: false, message: this.statusMessage };
    }

    const taskId = this.resolveSelectedTaskId(input.refactorTaskCards, null);
    if (!taskId) {
      this.statusMessage =
        "Select a refactor task before saving an implementation report.";
      return { ok: false, message: this.statusMessage };
    }

    const task = input.refactorTaskCards.cards.find((c) => c.id === taskId);
    if (!task) {
      this.statusMessage =
        "Select a refactor task before saving an implementation report.";
      return { ok: false, message: this.statusMessage };
    }

    const trimmed = this.draftText.trim();
    if (!trimmed) {
      this.statusMessage =
        "Paste the builder's refactor implementation report before saving.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor implementation report save blocked",
        "Empty paste area.",
      );
      return { ok: false, message: this.statusMessage };
    }

    const parse = parseArchitectureRefactorTaskImplementationReportText(trimmed);
    if (parse.blockedBySecrets && !input.allowSecretOverride) {
      this.safetyGate.log(
        "blocked",
        "Refactor implementation report possible secret detected",
        `${parse.possibleSecretPatterns.length} secret-like pattern(s).`,
      );
      this.statusMessage =
        "Possible secret detected. Redact secrets before saving, or explicitly confirm override if allowed.";
      return { ok: false, message: this.statusMessage };
    }

    if (parse.missingExpectedSections.length > 0) {
      this.safetyGate.log(
        "warning",
        "Refactor implementation report missing sections detected",
        parse.missingExpectedSections.join(", "),
      );
    }
    if (parse.behaviorChangeWarning) {
      this.safetyGate.log(
        "warning",
        "Refactor implementation behavior preservation warning detected",
        parse.behaviorChangeWarnings.join(", "),
      );
    }

    const changedFilesScopeWarnings = compareRefactorReportToChangedFilesMetadata({
      detectedFilesChanged: parse.detectedFilesChanged,
      changedFilesScan: input.changedFilesScan,
      changedFilesTaskLink: input.changedFilesTaskLink,
    });

    const truncationFlag =
      trimmed.length > ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_SAVED_CHARS;
    const reportText = trimmed.slice(
      0,
      ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_SAVED_CHARS,
    );
    const savedAt = new Date().toISOString();
    const hasImplementationReview = Boolean(
      input.implementationReviewManager.getSaved(),
    );

    const partialRecord = {
      taskId,
      taskTitle: task.title,
      refactorTarget: task.refactorTarget,
      builderSource: this.builderSource,
      savedAt,
      reportText,
      detectedFilesChanged: parse.detectedFilesChanged,
      detectedValidationMentions: parse.detectedValidationMentions,
      detectedBehaviorPreservationMentions: parse.detectedBehaviorPreservationMentions,
      detectedRisksBlockers: parse.detectedRisksBlockers,
      detectedSafetyConfirmations: parse.detectedSafetyConfirmations,
      missingExpectedSections: parse.missingExpectedSections,
      missingBehaviorPreservationChecks: parse.missingBehaviorPreservationChecks,
      possibleSecretPatterns: parse.possibleSecretPatterns,
      changedFilesScopeWarnings,
      behaviorChangeWarning: parse.behaviorChangeWarning,
      savedWithSecretOverride: Boolean(
        parse.blockedBySecrets && input.allowSecretOverride,
      ),
      truncationFlag,
      markedImplementationReturned: false,
      markedReviewed: false,
      stale: false,
      reportExcerpt:
        reportText.length > ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_EXCERPT_CHARS
          ? `${reportText.slice(0, ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_EXCERPT_CHARS - 1)}…`
          : reportText,
    };

    const summaryMarkdown = buildArchitectureRefactorTaskImplementationIntakeSummary({
      ...partialRecord,
      parse,
      hasImplementationReview,
    });

    const joinKey = buildJoinKeyFromRefactorTaskCard(
      task,
      input.refactorTaskCards.generatedAt,
      ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_KIND,
    );

    const record: ArchitectureRefactorTaskImplementationReportRecord = {
      ...partialRecord,
      id: makeId(),
      summaryMarkdown,
      ...joinKey,
      sourceHandoffId:
        input.refactorHandoff?.selectedTaskId === taskId
          ? input.refactorHandoff.id
          : undefined,
      sourceHandoffGeneratedAt:
        input.refactorHandoff?.selectedTaskId === taskId
          ? input.refactorHandoff.generatedAt
          : undefined,
    };

    this.reportsByTaskId[taskId] = record;
    this.draftText = "";
    this.selectedTaskId = taskId;

    const warnings: string[] = [];
    if (truncationFlag) {
      warnings.push(
        `Report truncated to ${ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_SAVED_CHARS} characters.`,
      );
    }
    if (parse.missingExpectedSections.length > 0) {
      warnings.push(
        `Missing sections: ${parse.missingExpectedSections.join(", ")}.`,
      );
    }
    if (parse.behaviorChangeWarning) {
      warnings.push("Behavior change language detected in report.");
    }
    if (changedFilesScopeWarnings.length > 0) {
      warnings.push(`${changedFilesScopeWarnings.length} changed-files scope warning(s).`);
    }

    this.statusMessage = [
      `Saved refactor implementation report for ${taskId} (text only — not executed).`,
      ARCHITECTURE_REFACTOR_IMPLEMENTATION_SUGGESTED_MARK_RETURNED(taskId),
      ...warnings,
    ]
      .filter(Boolean)
      .join(" ");

    this.safetyGate.log(
      "success",
      "Architecture refactor implementation report saved",
      `${taskId} · ${this.builderSource} · ${reportText.length} chars.`,
    );

    return { ok: true, record };
  }

  clearReport(taskId?: string): void {
    const id = taskId ?? this.selectedTaskId;
    if (!id || !this.reportsByTaskId[id]) {
      this.statusMessage =
        "No saved refactor implementation report to clear for this task.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor implementation report clear blocked",
        "No saved report.",
      );
      return;
    }
    delete this.reportsByTaskId[id];
    this.draftText = "";
    this.statusMessage = `Cleared refactor implementation report for ${id}.`;
    this.safetyGate.log(
      "info",
      "Architecture refactor implementation report cleared",
      `Task ${id}.`,
    );
  }

  recordCopy(taskId?: string): string | null {
    const id = taskId ?? this.selectedTaskId;
    const record = id ? this.reportsByTaskId[id] : null;
    if (!record) {
      this.statusMessage =
        "Save a Refactor Implementation Report before copying.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor implementation report copy blocked",
        "No saved report.",
      );
      return null;
    }
    this.safetyGate.log(
      "info",
      "Architecture refactor implementation report copied",
      `${record.taskId} · ${record.reportText.length} chars.`,
    );
    this.statusMessage =
      "Architecture Refactor Implementation Report copied to clipboard (text only).";
    return record.reportText;
  }

  markImplementationReturned(
    refactorCardsManager: ArchitectureRefactorTaskCardsManager,
    taskId?: string,
  ): { ok: boolean; message: string } {
    const id = taskId ?? this.selectedTaskId;
    const record = id ? this.reportsByTaskId[id] : null;
    if (!record) {
      this.statusMessage =
        "Save a refactor implementation report before marking returned.";
      return { ok: false, message: this.statusMessage };
    }
    if (record.stale) {
      this.statusMessage =
        "Report is stale — regenerate refactor cards or clear this report.";
      return { ok: false, message: this.statusMessage };
    }

    const result = refactorCardsManager.setTaskStatus(id!, "implementation-returned");
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
      "Architecture refactor marked implementation returned",
      id!,
    );
    return { ok: true, message: this.statusMessage };
  }

  markReviewed(input: {
    refactorCardsManager: ArchitectureRefactorTaskCardsManager;
    implementationReviewManager: ImplementationReviewManager;
    confirmWithoutReview?: boolean;
    taskId?: string;
  }): { ok: boolean; message: string; needsConfirm?: boolean } {
    const id = input.taskId ?? this.selectedTaskId;
    const record = id ? this.reportsByTaskId[id] : null;
    if (!record) {
      this.statusMessage =
        "Save a refactor implementation report before marking reviewed.";
      return { ok: false, message: this.statusMessage };
    }
    if (record.stale) {
      this.statusMessage = "Report is stale — cannot mark reviewed.";
      return { ok: false, message: this.statusMessage };
    }
    if (record.behaviorChangeWarning) {
      this.statusMessage =
        "Report may indicate behavior change. Do not mark reviewed until inspected.";
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

    const result = input.refactorCardsManager.setTaskStatus(id!, "reviewed");
    if (!result.ok) {
      this.statusMessage = result.message;
      return result;
    }

    this.reportsByTaskId[id!] = {
      ...record,
      markedReviewed: true,
      markedImplementationReturned: true,
    };

    const cards = input.refactorCardsManager.getSaved()?.cards ?? [];
    const nextId = findNextRefactorTaskId(cards, id!);
    this.statusMessage = nextId
      ? `${id} marked Reviewed. Next refactor task appears to be ${nextId}.`
      : `${id} marked Reviewed.`;

    this.safetyGate.log(
      "success",
      "Architecture refactor marked reviewed",
      id!,
    );
    return { ok: true, message: this.statusMessage };
  }

  clearForProjectChange(): void {
    this.reportsByTaskId = {};
    this.selectedTaskId = null;
    this.builderSource = "Cursor";
    this.draftText = "";
    this.statusMessage =
      "Paste a builder refactor implementation report for an architecture refactor task. Text-only — nothing is executed or sent to AI automatically.";
  }

  restoreFromHistory(input: {
    reportsByTaskId: Record<string, ArchitectureRefactorTaskImplementationReportRecord>;
    selectedTaskId: string | null;
    builderSource: ArchitectureRefactorImplementationBuilderSource;
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
      this.statusMessage = `Restored ${count} architecture refactor implementation report(s) from history.`;
    }
  }
}
