/**
 * Stage 127: Safe Scaffold Final Confirmation manager (in-memory only).
 * Records readiness metadata for a future write stage. No file writes. No AI. No source reads.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveSafeScaffoldFinalConfirmationUiStatus,
  emptyFinalConfirmationTombstone,
  emptySafeScaffoldFinalConfirmationState,
  normalizeSafeScaffoldFinalConfirmationRecord,
  type SafeScaffoldFinalConfirmationAcknowledgements,
  type SafeScaffoldFinalConfirmationRecord,
  type SafeScaffoldFinalConfirmationState,
} from "../../shared/buildModeFinalConfirmation";
import {
  acknowledgementsAreComplete,
  buildSafeScaffoldFinalConfirmation,
  evaluateFinalConfirmationPreconditions,
} from "../../shared/buildSafeScaffoldFinalConfirmation";
import type { SafeScaffoldTargetState } from "../../shared/buildModeTargetSafety";
import type { SafeScaffoldFileTreePreviewRecord } from "../../shared/buildModeFileTreePreview";
import type { SafeScaffoldFileContentPreviewRecord } from "../../shared/buildModeFileContentPreview";
import type { SafeScaffoldWriteManifestPreviewRecord } from "../../shared/buildModeWriteManifestPreview";

export type FinalConfirmationContext = {
  blueprintImported: boolean;
  blueprintProjectType: string;
  taskCardCount: number;
  target: SafeScaffoldTargetState;
  fileTree: SafeScaffoldFileTreePreviewRecord | null;
  fileContent: SafeScaffoldFileContentPreviewRecord | null;
  writeManifest: SafeScaffoldWriteManifestPreviewRecord | null;
};

export class SafeScaffoldFinalConfirmationManager {
  private saved: SafeScaffoldFinalConfirmationRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    emptySafeScaffoldFinalConfirmationState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): SafeScaffoldFinalConfirmationRecord | null {
    return this.saved
      ? {
          ...this.saved,
          acknowledgements: { ...this.saved.acknowledgements },
          warnings: [...this.saved.warnings],
        }
      : emptyFinalConfirmationTombstone();
  }

  hasConfirmation(): boolean {
    return Boolean(this.saved);
  }

  getState(ctx?: FinalConfirmationContext | null): SafeScaffoldFinalConfirmationState {
    const readiness = ctx
      ? evaluateFinalConfirmationPreconditions({
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
          writeManifestExists: Boolean(ctx.writeManifest),
          writeManifestStale: Boolean(ctx.writeManifest?.stale),
          proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
          readyToCreate: ctx.writeManifest?.readyToCreate ?? [],
          notReady: ctx.writeManifest?.notReady ?? [],
        })
      : {
          canConfirm: false,
          hardBlocked: false,
          reasons: this.lastReadinessBlockedReasons,
        };

    if (ctx) {
      this.lastReadinessBlockedReasons = readiness.reasons;
    }

    const requiresCautionAck = ctx?.target.lastCheck?.status === "caution";

    return {
      saved: this.saved
        ? {
            ...this.saved,
            acknowledgements: { ...this.saved.acknowledgements },
            warnings: [...this.saved.warnings],
          }
        : null,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveSafeScaffoldFinalConfirmationUiStatus({
        saved: this.saved,
        busy: this.busy,
        canConfirm: readiness.canConfirm,
        hardBlocked: readiness.hardBlocked,
      }),
      readinessBlockedReasons: readiness.reasons,
      requiresCautionAck,
    };
  }

  restoreSaved(
    record: SafeScaffoldFinalConfirmationRecord | null | undefined,
  ): void {
    const normalized = normalizeSafeScaffoldFinalConfirmationRecord(record);
    if (!normalized) {
      this.clearInternal(
        "No Safe Scaffold final confirmation restored from history.",
      );
      return;
    }
    this.saved = { ...normalized, stale: true };
    this.busy = false;
    this.statusMessage =
      "Restored Safe Scaffold Final Confirmation (marked stale — regenerate previews and confirm again before trusting).";
    this.safetyGate.log(
      "info",
      "Safe Scaffold final confirmation restored",
      `${normalized.readyToCreateCount} ready · ${normalized.sourceTargetSafetyStatus}`,
    );
  }

  clearForProjectChange(): void {
    this.clearInternal(
      "Safe Scaffold final confirmation cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Final confirmation is stale. Regenerate previews and confirm again before any future write stage.";
    this.safetyGate.log(
      "info",
      "Safe Scaffold final confirmation stale",
      reason,
    );
  }

  clear(): void {
    this.clearInternal("Safe Scaffold final confirmation cleared.");
    this.safetyGate.log(
      "info",
      "Safe Scaffold final confirmation cleared",
      "User cleared the confirmation.",
    );
  }

  confirm(
    ctx: FinalConfirmationContext,
    acknowledgements: SafeScaffoldFinalConfirmationAcknowledgements,
  ): SafeScaffoldFinalConfirmationState {
    const readiness = evaluateFinalConfirmationPreconditions({
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
      writeManifestExists: Boolean(ctx.writeManifest),
      writeManifestStale: Boolean(ctx.writeManifest?.stale),
      proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
      readyToCreate: ctx.writeManifest?.readyToCreate ?? [],
      notReady: ctx.writeManifest?.notReady ?? [],
    });
    this.lastReadinessBlockedReasons = readiness.reasons;

    if (
      !readiness.canConfirm ||
      !ctx.fileTree ||
      !ctx.fileContent ||
      !ctx.writeManifest
    ) {
      this.statusMessage = `Cannot record final confirmation: ${readiness.reasons.join(" ")}`;
      this.safetyGate.log(
        "warning",
        "Safe Scaffold final confirmation blocked",
        readiness.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    if (
      !acknowledgementsAreComplete({
        targetSafetyStatus: ctx.target.lastCheck!.status,
        acknowledgements,
      })
    ) {
      this.statusMessage =
        "Cannot record final confirmation: check all required acknowledgement boxes.";
      this.safetyGate.log(
        "warning",
        "Safe Scaffold final confirmation blocked",
        "Missing required acknowledgements.",
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage = "Recording Safe Scaffold Final Confirmation…";
    try {
      const built = buildSafeScaffoldFinalConfirmation({
        blueprintImported: ctx.blueprintImported,
        blueprintProjectType: ctx.blueprintProjectType,
        taskCardCount: ctx.taskCardCount,
        targetFolderPath: ctx.target.selectedPath!,
        targetSafetyStatus: ctx.target.lastCheck!.status,
        fileTreeGeneratedAt: ctx.fileTree.generatedAt,
        proposedRelativePaths: ctx.fileTree.proposedRelativePaths,
        fileContentGeneratedAt: ctx.fileContent.generatedAt,
        templatedRelativePaths: ctx.fileContent.templatedFiles.map(
          (f) => f.relativePath,
        ),
        filesWithoutContents: ctx.fileContent.filesWithoutContents,
        writeManifestGeneratedAt: ctx.writeManifest.generatedAt,
        readyToCreate: ctx.writeManifest.readyToCreate,
        notReady: ctx.writeManifest.notReady,
        acknowledgements,
      });
      if (!built.record || built.blockedReasons.length > 0) {
        this.statusMessage = `Final confirmation blocked: ${built.blockedReasons.join(" ")}`;
        this.lastReadinessBlockedReasons = built.blockedReasons;
        this.safetyGate.log(
          "warning",
          "Safe Scaffold final confirmation failed",
          built.blockedReasons.join(" | "),
        );
        return this.getState(ctx);
      }
      this.saved = built.record;
      this.statusMessage = `${built.record.markdown.includes("Final confirmation recorded") ? "Final confirmation recorded for future write stage. No files have been created." : "Final confirmation recorded."} Safe Scaffold writing is still disabled in this version.`;
      this.safetyGate.log(
        "success",
        "Safe Scaffold final confirmation recorded",
        `${built.record.readyToCreateCount} ready · ${built.record.sourceTargetSafetyStatus} · no files written`,
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
        "Copy Safe Scaffold final confirmation blocked",
        "No confirmation summary to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Copied Safe Scaffold final confirmation summary",
      `${this.saved.readyToCreateCount} ready paths (clipboard only)`,
    );
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}
