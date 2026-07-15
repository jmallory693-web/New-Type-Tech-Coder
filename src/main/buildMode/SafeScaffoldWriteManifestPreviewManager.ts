/**
 * Stage 125: Safe Scaffold Write Manifest Preview manager (in-memory only).
 * Deterministic future-write plan. No file writes. No AI. No source reads.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveSafeScaffoldWriteManifestUiStatus,
  emptySafeScaffoldWriteManifestPreviewState,
  emptyWriteManifestPreviewTombstone,
  normalizeSafeScaffoldWriteManifestPreviewRecord,
  type SafeScaffoldWriteManifestPreviewRecord,
  type SafeScaffoldWriteManifestPreviewState,
} from "../../shared/buildModeWriteManifestPreview";
import {
  buildSafeScaffoldWriteManifestPreview,
  evaluateWriteManifestPreviewPreconditions,
} from "../../shared/buildSafeScaffoldWriteManifestPreview";
import type { SafeScaffoldTargetState } from "../../shared/buildModeTargetSafety";
import type { SafeScaffoldFileTreePreviewRecord } from "../../shared/buildModeFileTreePreview";
import type { SafeScaffoldFileContentPreviewRecord } from "../../shared/buildModeFileContentPreview";

export type WriteManifestPreviewGenerateContext = {
  blueprintImported: boolean;
  blueprintProjectType: string;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  target: SafeScaffoldTargetState;
  fileTree: SafeScaffoldFileTreePreviewRecord | null;
  fileContent: SafeScaffoldFileContentPreviewRecord | null;
};

export class SafeScaffoldWriteManifestPreviewManager {
  private saved: SafeScaffoldWriteManifestPreviewRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    emptySafeScaffoldWriteManifestPreviewState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): SafeScaffoldWriteManifestPreviewRecord | null {
    return this.saved
      ? {
          ...this.saved,
          proposedRelativePaths: [...this.saved.proposedRelativePaths],
          readyToCreate: this.saved.readyToCreate.map((e) => ({ ...e })),
          notReady: this.saved.notReady.map((e) => ({ ...e })),
          warnings: [...this.saved.warnings],
          blockedReasons: [...this.saved.blockedReasons],
        }
      : emptyWriteManifestPreviewTombstone();
  }

  hasPreview(): boolean {
    return Boolean(this.saved);
  }

  getState(
    ctx?: WriteManifestPreviewGenerateContext | null,
  ): SafeScaffoldWriteManifestPreviewState {
    const readiness = ctx
      ? evaluateWriteManifestPreviewPreconditions({
          blueprintImported: ctx.blueprintImported,
          taskCardCount: ctx.taskCardCount,
          targetFolderPath: ctx.target.selectedPath,
          targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
          targetStale: ctx.target.stale,
          targetBusy: ctx.target.busy,
          fileTreeExists: Boolean(ctx.fileTree),
          fileTreeStale: Boolean(ctx.fileTree?.stale),
          fileContentExists: Boolean(ctx.fileContent),
          fileContentStale: Boolean(ctx.fileContent?.stale),
          proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
          templatedFiles: ctx.fileContent?.templatedFiles ?? [],
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
            readyToCreate: this.saved.readyToCreate.map((e) => ({ ...e })),
            notReady: this.saved.notReady.map((e) => ({ ...e })),
            warnings: [...this.saved.warnings],
            blockedReasons: [...this.saved.blockedReasons],
          }
        : null,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveSafeScaffoldWriteManifestUiStatus({
        saved: this.saved,
        busy: this.busy,
        canGenerate: readiness.canGenerate,
        hardBlocked: readiness.hardBlocked,
      }),
      readinessBlockedReasons: readiness.reasons,
    };
  }

  restoreSaved(
    record: SafeScaffoldWriteManifestPreviewRecord | null | undefined,
  ): void {
    const normalized = normalizeSafeScaffoldWriteManifestPreviewRecord(record);
    if (!normalized) {
      this.clearInternal(
        "No Safe Scaffold write-manifest preview restored from history.",
      );
      return;
    }
    this.saved = { ...normalized, stale: true };
    this.busy = false;
    this.statusMessage =
      "Restored Safe Scaffold Write Manifest Preview (marked stale — regenerate before trusting).";
    this.safetyGate.log(
      "info",
      "Safe Scaffold write-manifest preview restored",
      `${normalized.readyToCreate.length} ready · ${normalized.notReady.length} not ready`,
    );
  }

  clearForProjectChange(): void {
    this.clearInternal(
      "Safe Scaffold write-manifest preview cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Safe Scaffold Write Manifest Preview is stale — regenerate after Blueprint, target-folder, file-tree, or file-content changes.";
    this.safetyGate.log(
      "info",
      "Safe Scaffold write-manifest preview stale",
      reason,
    );
  }

  clear(): void {
    this.clearInternal("Safe Scaffold write-manifest preview cleared.");
    this.safetyGate.log(
      "info",
      "Safe Scaffold write-manifest preview cleared",
      "User cleared the preview.",
    );
  }

  generate(
    ctx: WriteManifestPreviewGenerateContext,
  ): SafeScaffoldWriteManifestPreviewState {
    const readiness = evaluateWriteManifestPreviewPreconditions({
      blueprintImported: ctx.blueprintImported,
      taskCardCount: ctx.taskCardCount,
      targetFolderPath: ctx.target.selectedPath,
      targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
      targetStale: ctx.target.stale,
      targetBusy: ctx.target.busy,
      fileTreeExists: Boolean(ctx.fileTree),
      fileTreeStale: Boolean(ctx.fileTree?.stale),
      fileContentExists: Boolean(ctx.fileContent),
      fileContentStale: Boolean(ctx.fileContent?.stale),
      proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
      templatedFiles: ctx.fileContent?.templatedFiles ?? [],
    });
    this.lastReadinessBlockedReasons = readiness.reasons;

    if (!readiness.canGenerate || !ctx.fileTree || !ctx.fileContent) {
      this.statusMessage = `Cannot generate write-manifest preview: ${readiness.reasons.join(" ")}`;
      this.safetyGate.log(
        "warning",
        "Safe Scaffold write-manifest preview blocked",
        readiness.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage =
      "Generating Safe Scaffold Write Manifest Preview (deterministic)…";
    try {
      const built = buildSafeScaffoldWriteManifestPreview({
        blueprintImported: ctx.blueprintImported,
        blueprintProjectType: ctx.blueprintProjectType,
        taskCardCount: ctx.taskCardCount,
        taskCardsGeneratedAt: ctx.taskCardsGeneratedAt,
        targetFolderPath: ctx.target.selectedPath!,
        targetSafetyStatus: ctx.target.lastCheck!.status,
        fileTreeGeneratedAt: ctx.fileTree.generatedAt,
        proposedRelativePaths: ctx.fileTree.proposedRelativePaths,
        fileContentGeneratedAt: ctx.fileContent.generatedAt,
        templatedFiles: ctx.fileContent.templatedFiles,
        filesWithoutContents: ctx.fileContent.filesWithoutContents,
      });
      if (!built.record || built.blockedReasons.length > 0) {
        this.statusMessage = `Write-manifest preview blocked: ${built.blockedReasons.join(" ")}`;
        this.lastReadinessBlockedReasons = built.blockedReasons;
        this.safetyGate.log(
          "warning",
          "Safe Scaffold write-manifest preview generation failed",
          built.blockedReasons.join(" | "),
        );
        return this.getState(ctx);
      }
      this.saved = built.record;
      this.statusMessage = `Write-manifest preview generated (${built.record.readyToCreate.length} ready to create, ${built.record.notReady.length} not ready). Preview only — no files created.`;
      this.safetyGate.log(
        "success",
        "Safe Scaffold write-manifest preview generated",
        `${built.record.readyToCreate.length} ready · ${built.record.sourceTargetSafetyStatus}`,
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
        "Copy Safe Scaffold write-manifest preview blocked",
        "No preview to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Copied Safe Scaffold write-manifest preview",
      `${this.saved.readyToCreate.length} ready paths (clipboard only)`,
    );
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}
