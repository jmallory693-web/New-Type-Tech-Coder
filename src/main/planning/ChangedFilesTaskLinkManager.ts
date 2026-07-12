import {
  buildChangedFileSummary,
  checkChangedFilesScopeDrift,
} from "../../shared/checkChangedFilesScopeDrift";
import { resolveTaskCardFingerprint } from "../../shared/computeTaskCardFingerprint";
import { suggestChangedFilesTaskLink } from "../../shared/suggestChangedFilesTaskLink";
import type {
  BlueprintPhaseTaskCardsRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
  ChangedFilesTaskLinkState,
  TaskImplementationReportRecord,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

const MAX_PATHS_STORED = 120;

function normalizeRecord(raw: ChangedFilesTaskLinkRecord): ChangedFilesTaskLinkRecord {
  return {
    taskId: raw.taskId,
    taskTitle: raw.taskTitle,
    taskPhase: raw.taskPhase,
    sourceTaskCardHash: raw.sourceTaskCardHash,
    linkedAt: raw.linkedAt,
    changedFilesGeneratedAt: raw.changedFilesGeneratedAt,
    changedFilesCount: raw.changedFilesCount ?? 0,
    changedFilePaths: raw.changedFilePaths ?? [],
    changedFileSummary: raw.changedFileSummary ?? "",
    linkSource: raw.linkSource ?? "manual-user-selection",
    stale: Boolean(raw.stale),
    warnings: raw.warnings ?? [],
  };
}

/** Stage 96: Changed Files → Blueprint Task Link manager (metadata only). */
export class ChangedFilesTaskLinkManager {
  private saved: ChangedFilesTaskLinkRecord | null = null;
  private selectedTaskId: string | null = null;
  private statusMessage: string | null =
    "Link changed-file metadata to a Blueprint task after scanning changed files.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): ChangedFilesTaskLinkRecord | null {
    return this.saved ? { ...this.saved } : null;
  }

  getSelectedTaskId(): string | null {
    return this.selectedTaskId;
  }

  getState(input: {
    taskCards: BlueprintPhaseTaskCardsRecord | null;
    handoffSelectedTaskId: string | null;
    selectedImplementationTaskId: string | null;
    implementationReports: Record<string, TaskImplementationReportRecord>;
  }): ChangedFilesTaskLinkState {
    const suggestion = suggestChangedFilesTaskLink({
      taskCards: input.taskCards,
      selectedImplementationTaskId: input.selectedImplementationTaskId,
      handoffSelectedTaskId: input.handoffSelectedTaskId,
      implementationReports: input.implementationReports,
    });

    if (!this.selectedTaskId && suggestion.taskId) {
      this.selectedTaskId = suggestion.taskId;
    }

    return {
      saved: this.saved ? { ...this.saved } : null,
      selectedTaskId: this.selectedTaskId,
      suggestedTaskId: suggestion.taskId,
      suggestedReason: suggestion.reason,
      statusMessage: this.statusMessage,
    };
  }

  setSelectedTaskId(taskId: string): void {
    this.selectedTaskId = taskId;
    this.statusMessage = `Selected task for changed-files link: ${taskId}.`;
    this.safetyGate.log("info", "Changed-files task link selection", taskId);
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Changed-files task link is stale — relink after metadata or task card changes.";
    this.safetyGate.log("info", "Changed-files task link stale", reason);
  }

  syncWithSources(input: {
    taskCards: BlueprintPhaseTaskCardsRecord | null;
    changedFilesScan: ChangedFilesScanResult | null;
  }): void {
    if (!this.saved || this.saved.stale) return;

    const card = input.taskCards?.cards.find((c) => c.id === this.saved!.taskId);
    if (!card) {
      this.markStale("Linked task no longer exists.");
      return;
    }

    const currentHash = resolveTaskCardFingerprint(card);
    if (
      this.saved.sourceTaskCardHash &&
      this.saved.sourceTaskCardHash !== currentHash
    ) {
      this.markStale("Task card fingerprint changed.");
      return;
    }

    if (
      this.saved.changedFilesGeneratedAt &&
      input.changedFilesScan?.scannedAt &&
      this.saved.changedFilesGeneratedAt !== input.changedFilesScan.scannedAt
    ) {
      this.markStale("Changed-files scan updated.");
    }
  }

  link(input: {
    taskCards: BlueprintPhaseTaskCardsRecord | null;
    changedFilesScan: ChangedFilesScanResult | null;
    taskId: string;
  }): ChangedFilesTaskLinkRecord | null {
    if (!input.taskCards?.cards.length) {
      this.statusMessage = "Generate Blueprint Phase Task Cards first.";
      this.safetyGate.log(
        "warning",
        "Changed-files task link blocked",
        "No task cards.",
      );
      return null;
    }

    if (!input.changedFilesScan || !input.changedFilesScan.isGitRepo) {
      this.statusMessage =
        "Generate a Changed Files / Patch Review Pack first.";
      this.safetyGate.log(
        "warning",
        "Changed-files task link blocked",
        "No changed-files scan.",
      );
      return null;
    }

    if (!input.taskId) {
      this.statusMessage = "Select a Blueprint task before linking changed-file metadata.";
      this.safetyGate.log(
        "warning",
        "Changed-files task link blocked",
        "No task selected.",
      );
      return null;
    }

    const card = input.taskCards.cards.find((c) => c.id === input.taskId);
    if (!card) {
      this.statusMessage =
        "Linked task no longer exists. Regenerate task cards or clear the link.";
      this.safetyGate.log(
        "warning",
        "Changed-files task link blocked",
        `Missing task ${input.taskId}.`,
      );
      return null;
    }

    const paths = input.changedFilesScan.files.map((f) => f.path);
    const warnings = checkChangedFilesScopeDrift(card, paths);
    const record: ChangedFilesTaskLinkRecord = {
      taskId: card.id,
      taskTitle: card.title,
      taskPhase: card.phase,
      sourceTaskCardHash: resolveTaskCardFingerprint(card),
      linkedAt: new Date().toISOString(),
      changedFilesGeneratedAt: input.changedFilesScan.scannedAt,
      changedFilesCount: input.changedFilesScan.totalCount,
      changedFilePaths: paths.slice(0, MAX_PATHS_STORED),
      changedFileSummary: buildChangedFileSummary(paths),
      linkSource: "manual-user-selection",
      stale: false,
      warnings,
    };

    this.saved = record;
    this.selectedTaskId = card.id;
    this.statusMessage = `Linked ${record.changedFilesCount ?? 0} changed file(s) to ${card.id}.${warnings.length ? ` ${warnings.length} scope warning(s).` : ""}`;

    this.safetyGate.log(
      "success",
      "Changed-files metadata linked to task",
      `${card.id} · ${record.changedFilesCount ?? 0} file(s)`,
    );

    if (warnings.length > 0) {
      this.safetyGate.log(
        "warning",
        "Changed-files scope warnings",
        `${warnings.length} warning(s) for ${card.id}.`,
      );
    }

    return record;
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Changed-files task link cleared.";
    this.safetyGate.log("info", "Changed-files task link cleared", "User cleared link.");
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.selectedTaskId = null;
    this.statusMessage =
      "Link changed-file metadata to a Blueprint task after scanning changed files.";
  }

  restoreSaved(
    record: ChangedFilesTaskLinkRecord | null | undefined,
    selectedTaskId: string | null | undefined,
  ): void {
    this.saved = record ? normalizeRecord(record) : null;
    this.selectedTaskId = selectedTaskId ?? this.saved?.taskId ?? null;
    if (this.saved) {
      this.statusMessage = `Changed-files link restored for ${this.saved.taskId}${this.saved.stale ? " (stale)" : ""}.`;
    }
  }
}
