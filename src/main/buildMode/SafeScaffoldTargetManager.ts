/**
 * Stage 119: Safe Scaffold target-folder readiness manager.
 * Metadata assessment only — no file creation, no recursive scans.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveSafeScaffoldTargetUiStatus,
  emptySafeScaffoldTargetState,
  normalizeSafeScaffoldTargetRecord,
  type SafeScaffoldTargetCheckResult,
  type SafeScaffoldTargetRecord,
  type SafeScaffoldTargetState,
} from "../../shared/buildModeTargetSafety";
import { assessSafeScaffoldTarget } from "./assessSafeScaffoldTarget";

export class SafeScaffoldTargetManager {
  private selectedPath: string | null = null;
  private lastCheck: SafeScaffoldTargetCheckResult | null = null;
  private stale = false;
  private busy = false;
  private statusMessage: string | null =
    emptySafeScaffoldTargetState().statusMessage;

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): SafeScaffoldTargetRecord | null {
    // Always persist an explicit record so HistoryStore does not re-merge a
    // previously saved target after the user clears (null would look like "missing").
    return {
      selectedPath: this.selectedPath,
      lastCheck: this.lastCheck ? { ...this.lastCheck } : null,
      stale: this.stale,
    };
  }

  getState(): SafeScaffoldTargetState {
    return {
      selectedPath: this.selectedPath,
      lastCheck: this.lastCheck ? { ...this.lastCheck } : null,
      stale: this.stale,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveSafeScaffoldTargetUiStatus({
        selectedPath: this.selectedPath,
        lastCheck: this.lastCheck,
        busy: this.busy,
      }),
    };
  }

  restoreSaved(record: SafeScaffoldTargetRecord | null | undefined): void {
    const normalized = normalizeSafeScaffoldTargetRecord(record);
    if (!normalized) {
      this.clearInternal(
        "No Safe Scaffold target folder restored from history.",
      );
      return;
    }
    this.selectedPath = normalized.selectedPath;
    this.lastCheck = normalized.lastCheck;
    // Always require an explicit refresh after history restore.
    this.stale = true;
    this.busy = false;
    this.statusMessage = this.selectedPath
      ? `Restored target folder (safety check marked stale — refresh before trusting). ${this.selectedPath}`
      : "Restored Safe Scaffold target metadata is incomplete.";
    this.safetyGate.log(
      "info",
      "Safe Scaffold target restored",
      this.selectedPath ?? "(none)",
    );
  }

  clearForProjectChange(): void {
    this.clearInternal(
      "Safe Scaffold target cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.selectedPath && !this.lastCheck) return;
    if (this.stale) return;
    this.stale = true;
    this.statusMessage =
      "Target folder safety is stale — refresh the folder safety check.";
    this.safetyGate.log("info", "Safe Scaffold target stale", reason);
  }

  clearTarget(): void {
    this.clearInternal("Safe Scaffold target folder cleared.");
    this.safetyGate.log(
      "info",
      "Safe Scaffold target cleared",
      "User cleared the target folder.",
    );
  }

  setTargetPath(
    folderPath: string,
    currentProjectRoot: string | null,
  ): SafeScaffoldTargetState {
    const next = folderPath.trim();
    if (!next) {
      this.clearTarget();
      return this.getState();
    }

    const pathChanged =
      !this.selectedPath ||
      this.selectedPath.toLowerCase() !== next.toLowerCase();

    this.selectedPath = next;
    if (pathChanged) {
      this.lastCheck = null;
      this.stale = true;
    }
    return this.refreshCheck(currentProjectRoot);
  }

  refreshCheck(currentProjectRoot: string | null): SafeScaffoldTargetState {
    if (!this.selectedPath) {
      this.statusMessage = "No target folder selected.";
      this.busy = false;
      return this.getState();
    }

    this.busy = true;
    this.statusMessage = "Checking target folder safety (metadata only)…";
    try {
      const result = assessSafeScaffoldTarget({
        selectedPath: this.selectedPath,
        currentProjectRoot,
      });
      this.lastCheck = result;
      this.selectedPath = result.resolvedPath || this.selectedPath;
      this.stale = false;
      this.statusMessage = `Folder safety: ${result.status}. Future write readiness: Not allowed yet.`;
      this.safetyGate.log(
        result.status === "blocked" ? "warning" : "info",
        "Safe Scaffold target assessed",
        `${result.status} · ${this.selectedPath}`,
      );
    } catch (err) {
      this.lastCheck = {
        status: "blocked",
        reasons: [
          `Assessment failed: ${err instanceof Error ? err.message : String(err)}`,
        ],
        entrySummary: {
          totalEntries: 0,
          truncated: false,
          entryNames: [],
          fileCount: 0,
          directoryCount: 0,
          otherCount: 0,
          harmlessCount: 0,
          unknownNonSourceCount: 0,
          sourceLikeCount: 0,
          projectMarkerNames: [],
          generatedMarkerNames: [],
        },
        checkedAt: new Date().toISOString(),
        selectedPath: this.selectedPath,
        resolvedPath: this.selectedPath,
        futureWriteReadiness: "Not allowed yet",
      };
      this.stale = false;
      this.statusMessage = "Folder safety check failed — treated as Blocked.";
      this.safetyGate.log(
        "warning",
        "Safe Scaffold target assessment failed",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      this.busy = false;
    }

    return this.getState();
  }

  private clearInternal(statusMessage: string): void {
    this.selectedPath = null;
    this.lastCheck = null;
    this.stale = false;
    this.busy = false;
    this.statusMessage = statusMessage;
  }
}
