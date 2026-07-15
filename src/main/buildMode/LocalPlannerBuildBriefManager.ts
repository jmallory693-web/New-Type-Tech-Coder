/**
 * Stage 131: Local Planner Build Brief manager (in-memory / history only).
 * Copy/paste prompt generation. No AI. No FS writes. No source reads.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveLocalPlannerBuildBriefUiStatus,
  emptyLocalPlannerBuildBriefOptions,
  emptyLocalPlannerBuildBriefState,
  emptyLocalPlannerBuildBriefTombstone,
  normalizeLocalPlannerBuildBriefRecord,
  normalizeLocalPlannerStrictness,
  normalizeLocalPlannerTargetModelType,
  type LocalPlannerBuildBriefOptions,
  type LocalPlannerBuildBriefRecord,
  type LocalPlannerBuildBriefState,
  type LocalPlannerStrictness,
  type LocalPlannerTargetModelType,
} from "../../shared/buildModeLocalPlannerBuildBrief";
import {
  buildLocalPlannerBuildBrief,
  evaluateLocalPlannerBuildBriefPreconditions,
  type LocalPlannerTaskCardSummary,
} from "../../shared/buildLocalPlannerBuildBrief";

export type LocalPlannerBuildBriefGenerateContext = {
  blueprintImported: boolean;
  blueprintProjectType: string;
  blueprintCompletenessLabel: string | null;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  taskCards: LocalPlannerTaskCardSummary[];
  targetFolderPath: string | null;
  targetSafetyStatus: string | null;
  fileTreeGeneratedAt: string | null;
  fileTreeProposedPaths: string[];
  fileContentGeneratedAt: string | null;
  writeManifestGeneratedAt: string | null;
  finalConfirmationConfirmedAt: string | null;
  writeResultWrittenAt: string | null;
  writeCreatedRelativePaths: string[];
};

export class LocalPlannerBuildBriefManager {
  private saved: LocalPlannerBuildBriefRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    emptyLocalPlannerBuildBriefState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];
  private options: LocalPlannerBuildBriefOptions =
    emptyLocalPlannerBuildBriefOptions();

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): LocalPlannerBuildBriefRecord | null {
    return this.saved
      ? {
          ...this.saved,
          sourceCreatedRelativePaths: [...this.saved.sourceCreatedRelativePaths],
          sourceProposedRelativePaths: [
            ...this.saved.sourceProposedRelativePaths,
          ],
          warnings: [...this.saved.warnings],
        }
      : emptyLocalPlannerBuildBriefTombstone();
  }

  getOptions(): LocalPlannerBuildBriefOptions {
    return { ...this.options };
  }

  setOptions(partial: Partial<LocalPlannerBuildBriefOptions>): void {
    if (partial.strictness !== undefined) {
      this.options.strictness = normalizeLocalPlannerStrictness(
        partial.strictness,
      );
    }
    if (partial.targetLocalModelType !== undefined) {
      this.options.targetLocalModelType = normalizeLocalPlannerTargetModelType(
        partial.targetLocalModelType,
      );
    }
    if (partial.selectedTaskId !== undefined) {
      const next =
        typeof partial.selectedTaskId === "string" &&
        partial.selectedTaskId.trim()
          ? partial.selectedTaskId.trim()
          : null;
      if (next !== this.options.selectedTaskId && this.saved && !this.saved.stale) {
        this.markStale("Focus task selection changed.");
      }
      this.options.selectedTaskId = next;
    }
  }

  getState(
    ctx?: LocalPlannerBuildBriefGenerateContext | null,
  ): LocalPlannerBuildBriefState {
    const readiness = ctx
      ? evaluateLocalPlannerBuildBriefPreconditions({
          blueprintImported: ctx.blueprintImported,
          taskCardCount: ctx.taskCardCount,
          fileTreeExists: Boolean(ctx.fileTreeGeneratedAt),
          fileContentExists: Boolean(ctx.fileContentGeneratedAt),
          writeResultExists: Boolean(ctx.writeResultWrittenAt),
          writeCreatedCount: ctx.writeCreatedRelativePaths.length,
        })
      : {
          canGenerate: false,
          mode: null,
          reasons: this.lastReadinessBlockedReasons,
        };

    if (ctx) {
      this.lastReadinessBlockedReasons = readiness.reasons;
    }

    return {
      saved: this.saved
        ? {
            ...this.saved,
            sourceCreatedRelativePaths: [
              ...this.saved.sourceCreatedRelativePaths,
            ],
            sourceProposedRelativePaths: [
              ...this.saved.sourceProposedRelativePaths,
            ],
            warnings: [...this.saved.warnings],
          }
        : null,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveLocalPlannerBuildBriefUiStatus({
        saved: this.saved,
        busy: this.busy,
        canGenerate: readiness.canGenerate,
      }),
      readinessBlockedReasons: readiness.reasons,
      canGenerate: readiness.canGenerate && !this.busy,
      options: { ...this.options },
      availableMode: readiness.mode,
    };
  }

  restoreSaved(
    record: LocalPlannerBuildBriefRecord | null | undefined,
  ): void {
    const normalized = normalizeLocalPlannerBuildBriefRecord(record);
    if (!normalized) {
      this.clearInternal(
        "No Local Planner Build Brief restored from history.",
      );
      return;
    }
    this.saved = { ...normalized, stale: true };
    this.options = {
      strictness: normalized.strictness,
      targetLocalModelType: normalized.targetLocalModelType,
      selectedTaskId: normalized.selectedTaskId,
    };
    this.busy = false;
    this.statusMessage =
      "Restored Local Planner Build Brief (marked stale — regenerate before trusting).";
    this.safetyGate.log(
      "info",
      "Local Planner Build Brief restored",
      `${normalized.mode} · ${normalized.strictness}`,
    );
  }

  clearForProjectChange(): void {
    this.options = emptyLocalPlannerBuildBriefOptions();
    this.clearInternal(
      "Local Planner Build Brief cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Local Planner Build Brief is stale — regenerate after Blueprint, task-card, scaffold preview, or write-result changes.";
    this.safetyGate.log("info", "Local Planner Build Brief stale", reason);
  }

  clear(): void {
    this.clearInternal("Local Planner Build Brief cleared.");
    this.safetyGate.log(
      "info",
      "Local Planner Build Brief cleared",
      "User cleared the brief (history tombstone; no files deleted).",
    );
  }

  generate(
    ctx: LocalPlannerBuildBriefGenerateContext,
    optionsOverride?: Partial<LocalPlannerBuildBriefOptions>,
  ): LocalPlannerBuildBriefState {
    if (optionsOverride) {
      this.setOptions(optionsOverride);
    }

    const readiness = evaluateLocalPlannerBuildBriefPreconditions({
      blueprintImported: ctx.blueprintImported,
      taskCardCount: ctx.taskCardCount,
      fileTreeExists: Boolean(ctx.fileTreeGeneratedAt),
      fileContentExists: Boolean(ctx.fileContentGeneratedAt),
      writeResultExists: Boolean(ctx.writeResultWrittenAt),
      writeCreatedCount: ctx.writeCreatedRelativePaths.length,
    });
    this.lastReadinessBlockedReasons = readiness.reasons;

    if (!readiness.canGenerate) {
      this.statusMessage = `Cannot generate Local Planner Build Brief: ${readiness.reasons.join(" ")}`;
      this.safetyGate.log(
        "warning",
        "Local Planner Build Brief blocked",
        readiness.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage = "Generating Local Planner Build Brief…";
    try {
      const built = buildLocalPlannerBuildBrief({
        blueprintImported: ctx.blueprintImported,
        blueprintProjectType: ctx.blueprintProjectType,
        blueprintCompletenessLabel: ctx.blueprintCompletenessLabel,
        taskCardCount: ctx.taskCardCount,
        taskCardsGeneratedAt: ctx.taskCardsGeneratedAt,
        taskCards: ctx.taskCards,
        selectedTaskId: this.options.selectedTaskId,
        targetFolderPath: ctx.targetFolderPath,
        targetSafetyStatus: ctx.targetSafetyStatus,
        fileTreeGeneratedAt: ctx.fileTreeGeneratedAt,
        fileTreeProposedPaths: ctx.fileTreeProposedPaths,
        fileContentGeneratedAt: ctx.fileContentGeneratedAt,
        writeManifestGeneratedAt: ctx.writeManifestGeneratedAt,
        finalConfirmationConfirmedAt: ctx.finalConfirmationConfirmedAt,
        writeResultWrittenAt: ctx.writeResultWrittenAt,
        writeCreatedRelativePaths: ctx.writeCreatedRelativePaths,
        strictness: this.options.strictness,
        targetLocalModelType: this.options.targetLocalModelType,
      });

      if (!built.record || built.blockedReasons.length > 0) {
        this.statusMessage = `Local Planner Build Brief blocked: ${built.blockedReasons.join(" ")}`;
        this.lastReadinessBlockedReasons = built.blockedReasons;
        this.safetyGate.log(
          "warning",
          "Local Planner Build Brief generation failed",
          built.blockedReasons.join(" | "),
        );
        return this.getState(ctx);
      }

      this.saved = built.record;
      this.statusMessage = `Local Planner Build Brief generated (${built.record.mode}). Copy/paste only — NTTC did not call a model.`;
      this.safetyGate.log(
        "success",
        "Local Planner Build Brief generated",
        `${built.record.mode} · ${built.record.targetLocalModelType} · ${built.record.strictness}`,
      );
    } finally {
      this.busy = false;
    }
    return this.getState(ctx);
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Copy Local Planner Build Brief blocked",
        "No brief to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Local Planner Build Brief copied",
      `${this.saved.mode} · clipboard only`,
    );
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}

/** Type re-exports for callers that set options without importing shared twice. */
export type {
  LocalPlannerStrictness,
  LocalPlannerTargetModelType,
};
