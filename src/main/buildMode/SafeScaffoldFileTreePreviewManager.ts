/**
 * Stage 121: Safe Scaffold File Tree Preview manager (in-memory only).
 * No file writes. No file contents. No AI.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveSafeScaffoldFileTreeUiStatus,
  emptySafeScaffoldFileTreePreviewState,
  normalizeSafeScaffoldFileTreePreviewRecord,
  type SafeScaffoldFileTreePreviewRecord,
  type SafeScaffoldFileTreePreviewState,
} from "../../shared/buildModeFileTreePreview";
import {
  buildSafeScaffoldFileTreePreview,
  evaluateFileTreePreviewPreconditions,
  type BuildSafeScaffoldFileTreePreviewInput,
} from "../../shared/buildSafeScaffoldFileTreePreview";
import type { SafeScaffoldTargetState } from "../../shared/buildModeTargetSafety";

export type FileTreePreviewGenerateContext = {
  blueprintImported: boolean;
  blueprintProjectType: string;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  target: SafeScaffoldTargetState;
};

export class SafeScaffoldFileTreePreviewManager {
  private saved: SafeScaffoldFileTreePreviewRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    emptySafeScaffoldFileTreePreviewState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): SafeScaffoldFileTreePreviewRecord | null {
    // Always persist explicit record (null-object when cleared) so HistoryStore
    // does not re-merge a previous preview after clear.
    return this.saved
      ? { ...this.saved, proposedRelativePaths: [...this.saved.proposedRelativePaths] }
      : {
          generatedAt: "",
          sourceBlueprintImported: false,
          sourceBlueprintProjectType: "unknown",
          sourceTaskCardCount: 0,
          sourceTaskCardsGeneratedAt: null,
          sourceTargetFolderPath: "",
          sourceTargetSafetyStatus: "blocked",
          proposedRelativePaths: [],
          markdown: "",
          warnings: [],
          blockedReasons: [],
          stale: false,
        };
  }

  /** True when a real preview is present (not the empty clear sentinel). */
  hasPreview(): boolean {
    return Boolean(this.saved);
  }

  getState(ctx?: FileTreePreviewGenerateContext | null): SafeScaffoldFileTreePreviewState {
    const readiness = ctx
      ? evaluateFileTreePreviewPreconditions({
          blueprintImported: ctx.blueprintImported,
          taskCardCount: ctx.taskCardCount,
          targetFolderPath: ctx.target.selectedPath,
          targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
          targetStale: ctx.target.stale,
          targetBusy: ctx.target.busy,
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
          }
        : null,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveSafeScaffoldFileTreeUiStatus({
        saved: this.saved,
        busy: this.busy,
        canGenerate: readiness.canGenerate,
        hardBlocked: readiness.hardBlocked,
      }),
      readinessBlockedReasons: readiness.reasons,
    };
  }

  restoreSaved(record: SafeScaffoldFileTreePreviewRecord | null | undefined): void {
    const normalized = normalizeSafeScaffoldFileTreePreviewRecord(record);
    if (!normalized) {
      this.clearInternal("No Safe Scaffold file-tree preview restored from history.");
      return;
    }
    this.saved = { ...normalized, stale: true };
    this.busy = false;
    this.statusMessage =
      "Restored Safe Scaffold File Tree Preview (marked stale — regenerate before trusting).";
    this.safetyGate.log(
      "info",
      "Safe Scaffold file-tree preview restored",
      `${normalized.proposedRelativePaths.length} paths`,
    );
  }

  clearForProjectChange(): void {
    this.clearInternal(
      "Safe Scaffold file-tree preview cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Safe Scaffold File Tree Preview is stale — regenerate after Blueprint or target-folder changes.";
    this.safetyGate.log("info", "Safe Scaffold file-tree preview stale", reason);
  }

  clear(): void {
    this.clearInternal("Safe Scaffold file-tree preview cleared.");
    this.safetyGate.log(
      "info",
      "Safe Scaffold file-tree preview cleared",
      "User cleared the preview.",
    );
  }

  generate(ctx: FileTreePreviewGenerateContext): SafeScaffoldFileTreePreviewState {
    const readiness = evaluateFileTreePreviewPreconditions({
      blueprintImported: ctx.blueprintImported,
      taskCardCount: ctx.taskCardCount,
      targetFolderPath: ctx.target.selectedPath,
      targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
      targetStale: ctx.target.stale,
      targetBusy: ctx.target.busy,
    });
    this.lastReadinessBlockedReasons = readiness.reasons;

    if (!readiness.canGenerate) {
      this.statusMessage = `Cannot generate file-tree preview: ${readiness.reasons.join(" ")}`;
      this.safetyGate.log(
        "warning",
        "Safe Scaffold file-tree preview blocked",
        readiness.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage = "Generating Safe Scaffold File Tree Preview (paths only)…";
    try {
      const input: BuildSafeScaffoldFileTreePreviewInput = {
        blueprintImported: ctx.blueprintImported,
        blueprintProjectType: ctx.blueprintProjectType,
        taskCardCount: ctx.taskCardCount,
        taskCardsGeneratedAt: ctx.taskCardsGeneratedAt,
        targetFolderPath: ctx.target.selectedPath!,
        targetSafetyStatus: ctx.target.lastCheck!.status,
      };
      const built = buildSafeScaffoldFileTreePreview(input);
      if (!built.record || built.blockedReasons.length > 0) {
        this.statusMessage = `File-tree preview blocked: ${built.blockedReasons.join(" ")}`;
        this.lastReadinessBlockedReasons = built.blockedReasons;
        this.safetyGate.log(
          "warning",
          "Safe Scaffold file-tree preview generation failed",
          built.blockedReasons.join(" | "),
        );
        return this.getState(ctx);
      }
      this.saved = built.record;
      this.statusMessage = `File-tree preview generated (${built.record.proposedRelativePaths.length} paths). Preview only — no files created.`;
      this.safetyGate.log(
        "success",
        "Safe Scaffold file-tree preview generated",
        `${built.record.proposedRelativePaths.length} paths · ${built.record.sourceTargetSafetyStatus}`,
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
        "Copy Safe Scaffold file-tree preview blocked",
        "No preview to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Copied Safe Scaffold file-tree preview",
      `${this.saved.proposedRelativePaths.length} paths (clipboard only)`,
    );
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}

/** Persist helper: null when no real preview (so older history optional), or record. */
export function persistableFileTreePreview(
  manager: SafeScaffoldFileTreePreviewManager,
): SafeScaffoldFileTreePreviewRecord | null {
  if (!manager.hasPreview()) {
    // Explicit empty tombstone so HistoryStore will not re-merge previous.
    return {
      generatedAt: "",
      sourceBlueprintImported: false,
      sourceBlueprintProjectType: "unknown",
      sourceTaskCardCount: 0,
      sourceTaskCardsGeneratedAt: null,
      sourceTargetFolderPath: "",
      sourceTargetSafetyStatus: "blocked",
      proposedRelativePaths: [],
      markdown: "",
      warnings: [],
      blockedReasons: [],
      stale: false,
    };
  }
  return manager.getSaved();
}
