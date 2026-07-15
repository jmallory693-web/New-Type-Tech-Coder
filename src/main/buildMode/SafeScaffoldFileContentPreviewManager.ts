/**
 * Stage 123: Safe Scaffold File Content Preview manager (in-memory only).
 * Deterministic templates. No file writes. No AI. No source reads.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveSafeScaffoldFileContentUiStatus,
  emptyContentPreviewTombstone,
  emptySafeScaffoldFileContentPreviewState,
  normalizeSafeScaffoldFileContentPreviewRecord,
  type SafeScaffoldFileContentPreviewRecord,
  type SafeScaffoldFileContentPreviewState,
} from "../../shared/buildModeFileContentPreview";
import {
  buildSafeScaffoldFileContentPreview,
  evaluateFileContentPreviewPreconditions,
} from "../../shared/buildSafeScaffoldFileContentPreview";
import type { SafeScaffoldTargetState } from "../../shared/buildModeTargetSafety";
import type { SafeScaffoldFileTreePreviewRecord } from "../../shared/buildModeFileTreePreview";

export type FileContentPreviewGenerateContext = {
  blueprintImported: boolean;
  blueprintProjectType: string;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  target: SafeScaffoldTargetState;
  fileTree: SafeScaffoldFileTreePreviewRecord | null;
};

export class SafeScaffoldFileContentPreviewManager {
  private saved: SafeScaffoldFileContentPreviewRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    emptySafeScaffoldFileContentPreviewState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): SafeScaffoldFileContentPreviewRecord | null {
    return this.saved
      ? {
          ...this.saved,
          proposedRelativePaths: [...this.saved.proposedRelativePaths],
          templatedFiles: this.saved.templatedFiles.map((f) => ({ ...f })),
          filesWithoutContents: [...this.saved.filesWithoutContents],
          warnings: [...this.saved.warnings],
          blockedReasons: [...this.saved.blockedReasons],
        }
      : emptyContentPreviewTombstone();
  }

  hasPreview(): boolean {
    return Boolean(this.saved);
  }

  getState(
    ctx?: FileContentPreviewGenerateContext | null,
  ): SafeScaffoldFileContentPreviewState {
    const readiness = ctx
      ? evaluateFileContentPreviewPreconditions({
          blueprintImported: ctx.blueprintImported,
          taskCardCount: ctx.taskCardCount,
          targetFolderPath: ctx.target.selectedPath,
          targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
          targetStale: ctx.target.stale,
          targetBusy: ctx.target.busy,
          fileTreeExists: Boolean(ctx.fileTree),
          fileTreeStale: Boolean(ctx.fileTree?.stale),
          proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
        })
      : {
          canGenerate: false,
          hardBlocked: false,
          reasons: this.lastReadinessBlockedReasons,
        };

    if (ctx) {
      this.lastReadinessBlockedReasons = readiness.reasons;
    }

    return {
      saved: this.saved
        ? {
            ...this.saved,
            proposedRelativePaths: [...this.saved.proposedRelativePaths],
            templatedFiles: this.saved.templatedFiles.map((f) => ({ ...f })),
            filesWithoutContents: [...this.saved.filesWithoutContents],
            warnings: [...this.saved.warnings],
            blockedReasons: [...this.saved.blockedReasons],
          }
        : null,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveSafeScaffoldFileContentUiStatus({
        saved: this.saved,
        busy: this.busy,
        canGenerate: readiness.canGenerate,
        hardBlocked: readiness.hardBlocked,
      }),
      readinessBlockedReasons: readiness.reasons,
    };
  }

  restoreSaved(
    record: SafeScaffoldFileContentPreviewRecord | null | undefined,
  ): void {
    const normalized = normalizeSafeScaffoldFileContentPreviewRecord(record);
    if (!normalized) {
      this.clearInternal(
        "No Safe Scaffold file-content preview restored from history.",
      );
      return;
    }
    this.saved = { ...normalized, stale: true };
    this.busy = false;
    this.statusMessage =
      "Restored Safe Scaffold File Content Preview (marked stale — regenerate before trusting).";
    this.safetyGate.log(
      "info",
      "Safe Scaffold file-content preview restored",
      `${normalized.templatedFiles.length} templated files`,
    );
  }

  clearForProjectChange(): void {
    this.clearInternal(
      "Safe Scaffold file-content preview cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Safe Scaffold File Content Preview is stale — regenerate after Blueprint, target-folder, or file-tree changes.";
    this.safetyGate.log(
      "info",
      "Safe Scaffold file-content preview stale",
      reason,
    );
  }

  clear(): void {
    this.clearInternal("Safe Scaffold file-content preview cleared.");
    this.safetyGate.log(
      "info",
      "Safe Scaffold file-content preview cleared",
      "User cleared the preview.",
    );
  }

  generate(
    ctx: FileContentPreviewGenerateContext,
  ): SafeScaffoldFileContentPreviewState {
    const readiness = evaluateFileContentPreviewPreconditions({
      blueprintImported: ctx.blueprintImported,
      taskCardCount: ctx.taskCardCount,
      targetFolderPath: ctx.target.selectedPath,
      targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
      targetStale: ctx.target.stale,
      targetBusy: ctx.target.busy,
      fileTreeExists: Boolean(ctx.fileTree),
      fileTreeStale: Boolean(ctx.fileTree?.stale),
      proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
    });
    this.lastReadinessBlockedReasons = readiness.reasons;

    if (!readiness.canGenerate || !ctx.fileTree) {
      this.statusMessage = `Cannot generate file-content preview: ${readiness.reasons.join(" ")}`;
      this.safetyGate.log(
        "warning",
        "Safe Scaffold file-content preview blocked",
        readiness.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage =
      "Generating Safe Scaffold File Content Preview (deterministic templates)…";
    try {
      const built = buildSafeScaffoldFileContentPreview({
        blueprintImported: ctx.blueprintImported,
        blueprintProjectType: ctx.blueprintProjectType,
        taskCardCount: ctx.taskCardCount,
        taskCardsGeneratedAt: ctx.taskCardsGeneratedAt,
        targetFolderPath: ctx.target.selectedPath!,
        targetSafetyStatus: ctx.target.lastCheck!.status,
        fileTreeGeneratedAt: ctx.fileTree.generatedAt,
        proposedRelativePaths: ctx.fileTree.proposedRelativePaths,
      });
      if (!built.record || built.blockedReasons.length > 0) {
        this.statusMessage = `File-content preview blocked: ${built.blockedReasons.join(" ")}`;
        this.lastReadinessBlockedReasons = built.blockedReasons;
        this.safetyGate.log(
          "warning",
          "Safe Scaffold file-content preview generation failed",
          built.blockedReasons.join(" | "),
        );
        return this.getState(ctx);
      }
      this.saved = built.record;
      this.statusMessage = `File-content preview generated (${built.record.templatedFiles.length} templated files, ${built.record.filesWithoutContents.length} without contents). Preview only — no files created.`;
      this.safetyGate.log(
        "success",
        "Safe Scaffold file-content preview generated",
        `${built.record.templatedFiles.length} templates · ${built.record.sourceTargetSafetyStatus}`,
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
        "Copy Safe Scaffold file-content preview blocked",
        "No preview to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Copied Safe Scaffold file-content preview",
      `${this.saved.templatedFiles.length} templates (clipboard only)`,
    );
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}
