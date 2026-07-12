import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  isDenyDirectoryName,
  isLockFileName,
  isSensitiveFileName,
  MAX_SCAN_FILE_BYTES,
} from "../../shared/denyList";
import type {
  CheckpointAvailabilityState,
  CheckpointAvailabilityStatus,
  CheckpointOperationResult,
  CheckpointRecord,
  SavedCheckpointMeta,
  SkippedScanItem,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import { inspectLinkSafety } from "../safety/linkSafety";

const MAX_SNAPSHOT_FILE_BYTES = MAX_SCAN_FILE_BYTES * 4; // 1MB soft cap per file in folder snapshots
const MAX_WALK_FILES = 5000;

function emptyAvailability(): CheckpointAvailabilityState {
  return {
    status: "none",
    label: "No Safety Backup",
    detail: "Create a Safety Backup before risky work.",
    method: null,
    methodLabel: null,
    createdAt: null,
    verified: false,
    restorable: false,
    verificationMessage: null,
    verifiedAt: null,
    hasPreviousRecord: false,
  };
}

function availabilityFor(
  status: CheckpointAvailabilityStatus,
  partial: Partial<CheckpointAvailabilityState> = {},
): CheckpointAvailabilityState {
  const labels: Record<CheckpointAvailabilityStatus, string> = {
    none: "No Safety Backup",
    "record-unverified": "Previous backup record found — verify before restore.",
    "verified-restorable": "Safety Backup verified — restore available.",
    "record-missing-target":
      "Backup record found, but the restore data was not found.",
    unavailable: "Safety Backup restore unavailable",
  };
  return {
    ...emptyAvailability(),
    ...partial,
    status,
    label: partial.label ?? labels[status],
  };
}

function runGit(
  cwd: string,
  args: string[],
  timeoutMs = 45_000,
  options?: { keepRawStdout?: boolean },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_EDITOR: "true",
        GIT_ASKPASS: "echo",
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Git command timed out: git ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: options?.keepRawStdout ? stdout : stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dirSizeBytes(root: string): number {
  let total = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          total += fs.statSync(full).size;
        }
      } catch {
        // ignore
      }
    }
  }
  return total;
}

/**
 * Stage 5 Checkpoint Manager.
 *
 * Git method (preferred):
 * - Local-only labeled commit: "[NTTC Checkpoint] ..."
 * - No push, no remote changes, no branch delete, no history rewrite beyond that commit
 * - Restore: git reset --hard <sha> (after pre-undo snapshot)
 *
 * Fallback:
 * - App-managed folder snapshot under userData/checkpoints
 * - Excludes deny-list dirs/files, secrets, large/binary files
 */
export class CheckpointManager {
  private latest: CheckpointRecord | null = null;
  /** Stage 29: history metadata awaiting read-only verification. */
  private pendingRecord: SavedCheckpointMeta | null = null;
  private availability: CheckpointAvailabilityState = emptyAvailability();

  constructor(
    private readonly safetyGate: SafetyGate,
    private readonly storageRoot: string,
  ) {
    fs.mkdirSync(this.storageRoot, { recursive: true });
  }

  getLatest(): CheckpointRecord | null {
    return this.latest;
  }

  getAvailability(): CheckpointAvailabilityState {
    return { ...this.availability };
  }

  getPendingRecord(): SavedCheckpointMeta | null {
    return this.pendingRecord;
  }

  clearForProjectChange(): void {
    this.latest = null;
    this.pendingRecord = null;
    this.availability = emptyAvailability();
    this.safetyGate.setCheckpointExists(false);
  }

  /**
   * Stage 29: load a previous history backup record without assuming it is restorable.
   * Does not modify the project. Does not enable Restore until verify succeeds.
   */
  loadPreviousRecord(meta: SavedCheckpointMeta | null): void {
    this.latest = null;
    this.safetyGate.setCheckpointExists(false);
    if (!meta || meta.isPreUndo) {
      this.pendingRecord = null;
      this.availability = emptyAvailability();
      return;
    }
    this.pendingRecord = meta;
    this.availability = availabilityFor("record-unverified", {
      detail:
        "A previous Safety Backup record was restored from history. Verify it before Restore is available.",
      method: meta.method ?? null,
      methodLabel: meta.methodLabel,
      createdAt: meta.createdAt,
      verified: false,
      restorable: false,
      verificationMessage: "Verify Safety Backup before restore.",
      hasPreviousRecord: true,
    });
    this.safetyGate.log(
      "info",
      "Previous backup record restored from history",
      `${meta.methodLabel} from ${meta.createdAt}. Restore stays disabled until verification succeeds.`,
    );
  }

  /**
   * Stage 29: read-only verification of the live or pending Safety Backup.
   * Never restores, resets, checks out, or cleans the project.
   */
  async verifyAvailability(options?: {
    auto?: boolean;
  }): Promise<CheckpointAvailabilityState> {
    const auto = options?.auto === true;
    const project = this.safetyGate.getProject();
    this.safetyGate.log(
      "info",
      "Backup verification started",
      auto
        ? "Checking whether a previous Safety Backup is still restorable (read-only)."
        : "Checking whether the Safety Backup is still restorable (read-only).",
    );

    if (!project) {
      this.availability = availabilityFor("unavailable", {
        detail: "Select a project folder before verifying a Safety Backup.",
        verificationMessage: "No project selected.",
        hasPreviousRecord: Boolean(this.pendingRecord),
      });
      this.safetyGate.log(
        "warning",
        "Backup verification failed",
        "No project folder selected.",
      );
      return this.getAvailability();
    }

    const candidate = this.latest
      ? this.recordToMeta(this.latest)
      : this.pendingRecord;

    if (!candidate) {
      this.availability = emptyAvailability();
      this.safetyGate.log(
        "info",
        "Backup verification failed",
        "No Safety Backup record is available to verify.",
      );
      return this.getAvailability();
    }

    try {
      const result = await this.verifyCandidate(project.normalizedPath, candidate);
      if (result.ok && result.checkpoint) {
        this.latest = result.checkpoint;
        this.pendingRecord = this.recordToMeta(result.checkpoint);
        this.safetyGate.setCheckpointExists(true);
        this.availability = availabilityFor("verified-restorable", {
          detail: result.message,
          method: result.checkpoint.method,
          methodLabel: result.checkpoint.methodLabel,
          createdAt: result.checkpoint.createdAt,
          verified: true,
          restorable: true,
          verificationMessage: result.message,
          verifiedAt: new Date().toISOString(),
          hasPreviousRecord: true,
        });
        this.safetyGate.log(
          "success",
          "Backup verification succeeded",
          result.message,
        );
      } else {
        this.latest = null;
        this.safetyGate.setCheckpointExists(false);
        const missing = /not found|missing|does not exist|moved/i.test(
          result.message,
        );
        this.availability = availabilityFor(
          missing ? "record-missing-target" : "unavailable",
          {
            detail: result.message,
            method: candidate.method ?? null,
            methodLabel: candidate.methodLabel,
            createdAt: candidate.createdAt,
            verified: true,
            restorable: false,
            verificationMessage: result.message,
            verifiedAt: new Date().toISOString(),
            hasPreviousRecord: true,
          },
        );
        this.safetyGate.log(
          "warning",
          "Backup verification failed",
          result.message,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Backup verification failed unexpectedly.";
      this.latest = null;
      this.safetyGate.setCheckpointExists(false);
      this.availability = availabilityFor("unavailable", {
        detail: message,
        method: candidate.method ?? null,
        methodLabel: candidate.methodLabel,
        createdAt: candidate.createdAt,
        verified: true,
        restorable: false,
        verificationMessage: message,
        verifiedAt: new Date().toISOString(),
        hasPreviousRecord: true,
      });
      this.safetyGate.log("warning", "Backup verification failed", message);
    }

    return this.getAvailability();
  }

  private recordToMeta(checkpoint: CheckpointRecord): SavedCheckpointMeta {
    return {
      savedAt: new Date().toISOString(),
      methodLabel: checkpoint.methodLabel,
      plainEnglish: checkpoint.plainEnglish,
      createdAt: checkpoint.createdAt,
      skippedCount: checkpoint.skippedCount,
      isPreUndo: checkpoint.isPreUndo,
      id: checkpoint.id,
      method: checkpoint.method,
      projectName: checkpoint.projectName,
      projectPath: checkpoint.projectPath,
      branchName: checkpoint.branchName,
      commitSha: checkpoint.commitSha,
      snapshotDir: checkpoint.snapshotDir,
      warnings: checkpoint.warnings,
      sizeBytes: checkpoint.sizeBytes,
      hadUncommittedChanges: checkpoint.hadUncommittedChanges,
    };
  }

  private async verifyCandidate(
    projectPath: string,
    meta: SavedCheckpointMeta,
  ): Promise<{ ok: boolean; message: string; checkpoint: CheckpointRecord | null }> {
    const normalizedProject = this.safetyGate.normalizePath(projectPath);
    if (meta.projectPath) {
      const savedPath = this.safetyGate.normalizePath(meta.projectPath);
      if (savedPath.toLowerCase() !== normalizedProject.toLowerCase()) {
        return {
          ok: false,
          message:
            "Backup verification failed because the project path changed or moved. Create a new Safety Backup for this folder.",
          checkpoint: null,
        };
      }
    }

    if (!fs.existsSync(normalizedProject)) {
      return {
        ok: false,
        message:
          "Backup verification failed because the project folder is missing or moved.",
        checkpoint: null,
      };
    }

    const method = meta.method;
    if (method === "git-commit" || (!method && meta.commitSha)) {
      return this.verifyGitCandidate(normalizedProject, meta);
    }
    if (method === "folder-snapshot" || (!method && meta.snapshotDir)) {
      return this.verifyFolderCandidate(normalizedProject, meta);
    }

    // Older history records may only have methodLabel.
    if (/git/i.test(meta.methodLabel)) {
      return {
        ok: false,
        message:
          "Previous backup record found, but it is missing the Git commit reference needed to verify restore. Create a new Safety Backup.",
        checkpoint: null,
      };
    }
    if (/folder|snapshot/i.test(meta.methodLabel)) {
      return {
        ok: false,
        message:
          "Previous backup record found, but it is missing the snapshot folder path needed to verify restore. Create a new Safety Backup.",
        checkpoint: null,
      };
    }

    return {
      ok: false,
      message:
        "Previous backup record found, but restore availability could not be verified from the saved metadata.",
      checkpoint: null,
    };
  }

  private async verifyGitCandidate(
    projectPath: string,
    meta: SavedCheckpointMeta,
  ): Promise<{ ok: boolean; message: string; checkpoint: CheckpointRecord | null }> {
    const sha = meta.commitSha?.trim();
    if (!sha) {
      return {
        ok: false,
        message:
          "Backup record found, but the Git commit hash is missing. Create a new Safety Backup.",
        checkpoint: null,
      };
    }
    if (!fs.existsSync(path.join(projectPath, ".git"))) {
      return {
        ok: false,
        message:
          "Backup record is a Git checkpoint, but this folder is no longer a Git repository.",
        checkpoint: null,
      };
    }

    const inside = await runGit(
      projectPath,
      ["rev-parse", "--is-inside-work-tree"],
      15_000,
    );
    if (inside.code !== 0 || inside.stdout !== "true") {
      return {
        ok: false,
        message:
          "Backup verification failed: Git work tree check did not succeed.",
        checkpoint: null,
      };
    }

    const top = await runGit(projectPath, ["rev-parse", "--show-toplevel"], 15_000);
    if (top.code === 0) {
      const topLevel = this.safetyGate.normalizePath(top.stdout);
      if (topLevel.toLowerCase() !== projectPath.toLowerCase()) {
        return {
          ok: false,
          message:
            "Backup verification warning: this folder is not the Git repository top-level used for the saved checkpoint.",
          checkpoint: null,
        };
      }
    }

    const verify = await runGit(
      projectPath,
      ["rev-parse", "--verify", `${sha}^{commit}`],
      15_000,
    );
    if (verify.code !== 0) {
      return {
        ok: false,
        message:
          "Backup record found, but the saved Git checkpoint commit was not found in this repository.",
        checkpoint: null,
      };
    }

    const resolvedSha = verify.stdout.trim() || sha;
    const checkpoint = this.metaToRecord(meta, {
      method: "git-commit",
      methodLabel: meta.methodLabel || "Git checkpoint",
      commitSha: resolvedSha,
      snapshotDir: null,
      projectPath,
    });
    return {
      ok: true,
      message: `Git Safety Backup verified. Commit ${resolvedSha.slice(0, 8)} is present. Restore is available.`,
      checkpoint,
    };
  }

  private async verifyFolderCandidate(
    projectPath: string,
    meta: SavedCheckpointMeta,
  ): Promise<{ ok: boolean; message: string; checkpoint: CheckpointRecord | null }> {
    const snapshotDir = meta.snapshotDir?.trim();
    if (!snapshotDir) {
      return {
        ok: false,
        message:
          "Backup record found, but the folder snapshot path is missing. Create a new Safety Backup.",
        checkpoint: null,
      };
    }
    if (!fs.existsSync(snapshotDir)) {
      return {
        ok: false,
        message:
          "Backup record found, but the restore snapshot folder was not found. It may have been deleted.",
        checkpoint: null,
      };
    }
    const metaPath = path.join(snapshotDir, "meta.json");
    const filesDir = path.join(snapshotDir, "files");
    if (!fs.existsSync(metaPath)) {
      return {
        ok: false,
        message:
          "Backup record found, but snapshot metadata (meta.json) is missing.",
        checkpoint: null,
      };
    }
    if (!fs.existsSync(filesDir)) {
      return {
        ok: false,
        message:
          "Backup record found, but the snapshot files folder is missing.",
        checkpoint: null,
      };
    }

    const checkpoint = this.metaToRecord(meta, {
      method: "folder-snapshot",
      methodLabel: meta.methodLabel || "Folder snapshot",
      snapshotDir,
      commitSha: null,
      projectPath,
    });
    return {
      ok: true,
      message:
        "Folder snapshot Safety Backup verified. Snapshot files are present. Restore is available.",
      checkpoint,
    };
  }

  private metaToRecord(
    meta: SavedCheckpointMeta,
    overrides: Partial<CheckpointRecord> & {
      method: CheckpointRecord["method"];
      methodLabel: string;
      projectPath: string;
    },
  ): CheckpointRecord {
    return {
      id: meta.id || `restored-${makeId()}`,
      createdAt: meta.createdAt,
      projectName: meta.projectName || path.basename(overrides.projectPath),
      projectPath: overrides.projectPath,
      method: overrides.method,
      methodLabel: overrides.methodLabel,
      plainEnglish: meta.plainEnglish,
      branchName: meta.branchName ?? null,
      commitSha: overrides.commitSha ?? meta.commitSha ?? null,
      hadUncommittedChanges: meta.hadUncommittedChanges ?? null,
      snapshotDir: overrides.snapshotDir ?? meta.snapshotDir ?? null,
      skippedItems: [],
      skippedCount: meta.skippedCount,
      sizeBytes: meta.sizeBytes ?? null,
      warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
      isPreUndo: Boolean(meta.isPreUndo),
    };
  }

  private markLiveVerified(checkpoint: CheckpointRecord): void {
    this.latest = checkpoint;
    this.pendingRecord = this.recordToMeta(checkpoint);
    this.safetyGate.setCheckpointExists(true);
    this.availability = availabilityFor("verified-restorable", {
      detail: "Safety Backup created in this session and is ready to restore.",
      method: checkpoint.method,
      methodLabel: checkpoint.methodLabel,
      createdAt: checkpoint.createdAt,
      verified: true,
      restorable: true,
      verificationMessage: "Verified from this session’s Safety Backup.",
      verifiedAt: new Date().toISOString(),
      hasPreviousRecord: false,
    });
  }

  async createCheckpoint(options?: {
    isPreUndo?: boolean;
    label?: string;
  }): Promise<CheckpointOperationResult> {
    const project = this.safetyGate.getProject();
    if (!project) {
      this.safetyGate.log(
        "warning",
        "Checkpoint failed",
        "No project folder selected.",
      );
      return {
        ok: false,
        message: "Select a project folder before creating a checkpoint.",
        checkpoint: null,
      };
    }

    const isPreUndo = options?.isPreUndo === true;
    this.safetyGate.log(
      "info",
      "Checkpoint started",
      isPreUndo
        ? "Creating a pre-undo emergency snapshot first."
        : `Creating a safety checkpoint for ${project.displayName}.`,
    );

    const gitDir = path.join(project.normalizedPath, ".git");
    const canTryGit = fs.existsSync(gitDir);

    if (canTryGit) {
      const gitResult = await this.tryGitCheckpoint(
        project.normalizedPath,
        project.displayName,
        isPreUndo,
        options?.label,
      );
      if (gitResult.ok && gitResult.checkpoint) {
        if (!isPreUndo) {
          this.markLiveVerified(gitResult.checkpoint);
        }
        this.safetyGate.log(
          "success",
          "Checkpoint succeeded",
          `${gitResult.checkpoint.methodLabel}. ${gitResult.checkpoint.plainEnglish}`,
        );
        if (gitResult.checkpoint.skippedCount > 0) {
          this.safetyGate.log(
            "info",
            "Files/folders skipped",
            `${gitResult.checkpoint.skippedCount} item(s) skipped during checkpoint.`,
          );
        }
        return gitResult;
      }

      this.safetyGate.log(
        "warning",
        "Checkpoint failed",
        `Git checkpoint unavailable (${gitResult.message}). Trying folder snapshot fallback.`,
      );

      const folderResult = this.createFolderSnapshot(
        project.normalizedPath,
        project.displayName,
        isPreUndo,
        options?.label,
        gitResult.message ? [`Git unavailable: ${gitResult.message}`] : [],
      );

      if (folderResult.ok && folderResult.checkpoint) {
        if (!isPreUndo) {
          this.markLiveVerified(folderResult.checkpoint);
        }
        this.safetyGate.log(
          "success",
          "Checkpoint succeeded",
          `${folderResult.checkpoint.methodLabel}. ${folderResult.checkpoint.plainEnglish}`,
        );
        if (folderResult.checkpoint.skippedCount > 0) {
          this.safetyGate.log(
            "info",
            "Files/folders skipped",
            `${folderResult.checkpoint.skippedCount} item(s) skipped during snapshot.`,
          );
        }
        return folderResult;
      }

      this.safetyGate.log(
        "warning",
        "Checkpoint failed",
        folderResult.message || "Could not create a checkpoint.",
      );
      return folderResult;
    }

    const folderOnly = this.createFolderSnapshot(
      project.normalizedPath,
      project.displayName,
      isPreUndo,
      options?.label,
      ["Selected folder is not a Git repository, so a folder snapshot was used."],
    );

    if (folderOnly.ok && folderOnly.checkpoint) {
      if (!isPreUndo) {
        this.markLiveVerified(folderOnly.checkpoint);
      }
      this.safetyGate.log(
        "success",
        "Checkpoint succeeded",
        `${folderOnly.checkpoint.methodLabel}. ${folderOnly.checkpoint.plainEnglish}`,
      );
      if (folderOnly.checkpoint.skippedCount > 0) {
        this.safetyGate.log(
          "info",
          "Files/folders skipped",
          `${folderOnly.checkpoint.skippedCount} item(s) skipped during snapshot.`,
        );
      }
      return folderOnly;
    }

    this.safetyGate.log(
      "warning",
      "Checkpoint failed",
      folderOnly.message || "Could not create a checkpoint.",
    );
    return folderOnly;
  }

  async undoLatest(): Promise<CheckpointOperationResult> {
    const project = this.safetyGate.getProject();
    if (!project) {
      this.safetyGate.log("warning", "Undo failed", "No project folder selected.");
      return {
        ok: false,
        message: "Select a project folder before using Undo.",
        checkpoint: null,
      };
    }

    if (!this.availability.restorable || !this.latest) {
      const reason = this.pendingRecord
        ? "Verify Safety Backup before restore."
        : "No verified Safety Backup is available to restore.";
      this.safetyGate.log(
        "warning",
        "Restore disabled due to unverified backup",
        reason,
      );
      return {
        ok: false,
        message: reason,
        checkpoint: null,
      };
    }

    if (this.latest.projectPath !== project.normalizedPath) {
      this.safetyGate.log(
        "warning",
        "Undo failed",
        "No checkpoint is available for the selected project.",
      );
      return {
        ok: false,
        message: "No checkpoint is available to restore.",
        checkpoint: null,
      };
    }

    this.safetyGate.log(
      "info",
      "Undo confirmed",
      `Restoring latest checkpoint (${this.latest.methodLabel}).`,
    );

    const preUndo = await this.createCheckpoint({
      isPreUndo: true,
      label: "Pre-undo emergency snapshot",
    });
    if (!preUndo.ok) {
      this.safetyGate.log(
        "warning",
        "Undo failed",
        "Could not create a pre-undo emergency snapshot, so restore was cancelled.",
      );
      return {
        ok: false,
        message:
          "Undo cancelled: could not create a pre-undo emergency snapshot first.",
        checkpoint: null,
      };
    }

    try {
      if (this.latest.method === "git-commit" && this.latest.commitSha) {
        await this.restoreGitCheckpoint(project.normalizedPath, this.latest.commitSha);
      } else if (this.latest.method === "folder-snapshot" && this.latest.snapshotDir) {
        await this.restoreFolderSnapshot(project.normalizedPath, this.latest.snapshotDir);
      } else {
        throw new Error("Checkpoint metadata is incomplete.");
      }

      this.safetyGate.log(
        "success",
        "Undo succeeded",
        `Project restored to checkpoint from ${this.latest.createdAt}.`,
      );
      return {
        ok: true,
        message: `Restored project to checkpoint from ${new Date(this.latest.createdAt).toLocaleString()}.`,
        checkpoint: this.latest,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restore failed";
      this.safetyGate.log("warning", "Undo failed", message);
      return {
        ok: false,
        message: `Undo failed: ${message}. A pre-undo emergency snapshot was created when possible.`,
        checkpoint: this.latest,
      };
    }
  }

  private async tryGitCheckpoint(
    projectPath: string,
    projectName: string,
    isPreUndo: boolean,
    label?: string,
  ): Promise<CheckpointOperationResult> {
    try {
      // Fast local check before spawning Git (avoids hangs when Git is missing/misconfigured).
      if (!fs.existsSync(path.join(projectPath, ".git"))) {
        return {
          ok: false,
          message: "Selected folder is not a Git repository",
          checkpoint: null,
        };
      }

      const inside = await runGit(projectPath, ["rev-parse", "--is-inside-work-tree"], 15_000);
      if (inside.code !== 0 || inside.stdout !== "true") {
        return { ok: false, message: "Selected folder is not a Git repository", checkpoint: null };
      }

      const top = await runGit(projectPath, ["rev-parse", "--show-toplevel"]);
      if (top.code !== 0) {
        return { ok: false, message: "Could not resolve Git top-level path", checkpoint: null };
      }
      let topLevel = this.safetyGate.normalizePath(top.stdout);
      let projectKey = this.safetyGate.normalizePath(projectPath);
      try {
        topLevel = this.safetyGate.normalizePath(fs.realpathSync.native(topLevel));
        projectKey = this.safetyGate.normalizePath(fs.realpathSync.native(projectKey));
      } catch {
        // Fall back to normalized paths if realpath is unavailable.
      }
      if (topLevel.toLowerCase() !== projectKey.toLowerCase()) {
        return {
          ok: false,
          message: "Project folder is not the Git repository root (refusing nested Git checkpoint)",
          checkpoint: null,
        };
      }

      const branch = await runGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
      const branchName = branch.code === 0 ? branch.stdout : "unknown";

      const status = await runGit(
        projectPath,
        ["status", "--porcelain", "-z"],
        45_000,
        { keepRawStdout: true },
      );
      if (status.code !== 0) {
        return { ok: false, message: status.stderr || "git status failed", checkpoint: null };
      }

      const hadUncommittedChanges = status.stdout.length > 0;
      const skippedItems: SkippedScanItem[] = [];

      if (hadUncommittedChanges) {
        const staged = await this.stageSafeGitPaths(projectPath, status.stdout, skippedItems);
        if (!staged) {
          return {
            ok: false,
            message: "No safe files were available to include in a Git checkpoint",
            checkpoint: null,
          };
        }

        const message = `[NTTC Checkpoint] ${label ?? "Safety snapshot"} — ${new Date().toISOString()}`;
        const commit = await runGit(projectPath, [
          "-c",
          "user.email=checkpoint@newtypetech.local",
          "-c",
          "user.name=New Type Tech Coder",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "-m",
          message,
          "--no-verify",
          "--no-gpg-sign",
        ]);
        // Local-only commit. --no-verify/--no-gpg-sign avoid hooks and signing prompts.
        // This is not a project command runner and does not push.
        if (commit.code !== 0) {
          return {
            ok: false,
            message: commit.stderr || commit.stdout || "git commit failed",
            checkpoint: null,
          };
        }
      }

      const sha = await runGit(projectPath, ["rev-parse", "HEAD"]);
      if (sha.code !== 0 || !sha.stdout) {
        return { ok: false, message: "Could not read checkpoint commit SHA", checkpoint: null };
      }

      const warnings: string[] = [];
      if (!hadUncommittedChanges) {
        warnings.push(
          "There were no uncommitted changes, so this checkpoint points at the current Git commit.",
        );
      }
      warnings.push("This checkpoint is local only. Nothing was pushed to GitHub or any remote.");

      const checkpoint: CheckpointRecord = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        projectName,
        projectPath,
        method: "git-commit",
        methodLabel: "Git local checkpoint commit",
        plainEnglish: hadUncommittedChanges
          ? `Saved a clearly labeled local Git commit on branch “${branchName}”. Nothing was pushed.`
          : `Marked the current Git commit on branch “${branchName}” as the checkpoint. Nothing was pushed.`,
        branchName,
        commitSha: sha.stdout,
        hadUncommittedChanges,
        snapshotDir: null,
        skippedItems,
        skippedCount: skippedItems.length,
        sizeBytes: null,
        warnings,
        isPreUndo,
      };

      return { ok: true, message: checkpoint.plainEnglish, checkpoint };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Git checkpoint failed";
      return { ok: false, message, checkpoint: null };
    }
  }

  private async stageSafeGitPaths(
    projectPath: string,
    porcelainZ: string,
    skippedItems: SkippedScanItem[],
  ): Promise<boolean> {
    // --porcelain -z: records separated by NUL. Rename records include an extra NUL path.
    const records = porcelainZ.split("\0").filter(Boolean);
    const toAdd: string[] = [];

    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      if (record.length < 4) {
        continue;
      }
      const xy = record.slice(0, 2);
      let filePath = record.slice(3);
      // Rename/copy entries are followed by the original path in the next NUL field.
      if (xy.includes("R") || xy.includes("C")) {
        i += 1; // skip original path field
      }

      filePath = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
      if (!filePath) {
        continue;
      }

      const absolute = path.join(projectPath, filePath.split("/").join(path.sep));
      const base = path.basename(filePath);

      if (
        isSensitiveFileName(base) ||
        filePath.split("/").some((p) => isDenyDirectoryName(p))
      ) {
        skippedItems.push({
          path: filePath,
          reason: "Excluded from Git checkpoint by Safety Gate deny rules",
        });
        continue;
      }

      const access = this.safetyGate.checkPath(absolute, { quiet: true });
      if (!access.allowed && !isLockFileName(base)) {
        skippedItems.push({
          path: filePath,
          reason: access.denyReason ?? "Blocked by Safety Gate",
        });
        continue;
      }

      // Prefix ./ so paths never look like Git CLI flags.
      toAdd.push(`./${filePath}`);
    }

    if (toAdd.length === 0) {
      return false;
    }

    for (let i = 0; i < toAdd.length; i += 40) {
      const chunk = toAdd.slice(i, i + 40);
      const add = await runGit(projectPath, ["add", "--", ...chunk]);
      if (add.code !== 0) {
        throw new Error(add.stderr || "git add failed");
      }
    }
    return true;
  }

  private async restoreGitCheckpoint(projectPath: string, sha: string): Promise<void> {
    // Conservative restore: hard reset to checkpoint commit, then clean untracked non-ignored files.
    const reset = await runGit(projectPath, ["reset", "--hard", sha]);
    if (reset.code !== 0) {
      throw new Error(reset.stderr || "git reset --hard failed");
    }
    const clean = await runGit(projectPath, ["clean", "-fd"]);
    if (clean.code !== 0) {
      throw new Error(clean.stderr || "git clean failed");
    }
  }

  private createFolderSnapshot(
    projectPath: string,
    projectName: string,
    isPreUndo: boolean,
    label?: string,
    extraWarnings: string[] = [],
  ): CheckpointOperationResult {
    const id = makeId();
    const snapshotDir = path.join(this.storageRoot, id);
    const filesDir = path.join(snapshotDir, "files");
    const skippedItems: SkippedScanItem[] = [];

    try {
      fs.mkdirSync(filesDir, { recursive: true });
      let copied = 0;
      copied = this.copyProjectShallowSafe(projectPath, filesDir, skippedItems, 0);

      if (copied === 0) {
        fs.rmSync(snapshotDir, { recursive: true, force: true });
        return {
          ok: false,
          message: "Folder snapshot failed: no safe files could be copied.",
          checkpoint: null,
        };
      }

      const sizeBytes = dirSizeBytes(filesDir);
      const meta = {
        id,
        createdAt: new Date().toISOString(),
        projectName,
        projectPath,
        method: "folder-snapshot" as const,
        label: label ?? "Safety snapshot",
        skippedItems,
        sizeBytes,
      };
      fs.writeFileSync(path.join(snapshotDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

      const linkSkipCount = skippedItems.filter(
        (item) =>
          /symlink/i.test(item.reason) ||
          /junction/i.test(item.reason) ||
          /reparse/i.test(item.reason),
      ).length;

      const warnings = [
        ...extraWarnings,
        "Used an app-managed folder snapshot because Git checkpointing was unavailable or refused.",
        "Denied/secret/build folders were excluded from the snapshot.",
        "Symlinks and junctions were not followed or copied.",
      ];
      if (linkSkipCount > 0) {
        warnings.push(
          `Skipped ${linkSkipCount} symlink/junction item(s) during safety backup (not copied).`,
        );
      }

      const checkpoint: CheckpointRecord = {
        id,
        createdAt: meta.createdAt,
        projectName,
        projectPath,
        method: "folder-snapshot",
        methodLabel: "App-managed folder snapshot",
        plainEnglish:
          "Saved a local backup copy of safe project files in New Type Tech Coder’s app storage. This is not a Git commit and was not uploaded anywhere.",
        branchName: null,
        commitSha: null,
        hadUncommittedChanges: null,
        snapshotDir,
        skippedItems,
        skippedCount: skippedItems.length,
        sizeBytes,
        warnings,
        isPreUndo,
      };

      return { ok: true, message: checkpoint.plainEnglish, checkpoint };
    } catch (error) {
      try {
        fs.rmSync(snapshotDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup failure
      }
      const message = error instanceof Error ? error.message : "Folder snapshot failed";
      return { ok: false, message, checkpoint: null };
    }
  }

  private copyProjectShallowSafe(
    sourceRoot: string,
    destRoot: string,
    skippedItems: SkippedScanItem[],
    startCount: number,
  ): number {
    let copied = startCount;
    const stack: Array<{ src: string; dest: string; rel: string }> = [
      { src: sourceRoot, dest: destRoot, rel: "" },
    ];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(current.src, { withFileTypes: true });
      } catch (error) {
        skippedItems.push({
          path: current.rel || ".",
          reason:
            error instanceof Error
              ? `Could not list folder: ${error.message}`
              : "Could not list folder",
        });
        continue;
      }

      for (const entry of entries) {
        if (copied >= MAX_WALK_FILES) {
          skippedItems.push({
            path: current.rel || ".",
            reason: `Stopped after ${MAX_WALK_FILES} files to keep the snapshot shallow/safe`,
          });
          return copied;
        }

        const rel = current.rel ? path.join(current.rel, entry.name) : entry.name;
        const srcPath = path.join(current.src, entry.name);
        const destPath = path.join(current.dest, entry.name);

        if (entry.isSymbolicLink()) {
          skippedItems.push({
            path: rel,
            reason: "Skipped symlink for safety (not followed, not copied)",
          });
          continue;
        }

        const linkCheck = inspectLinkSafety(srcPath);
        if (!linkCheck.safe) {
          skippedItems.push({
            path: rel,
            reason: linkCheck.reason ?? "Skipped unsafe link for safety",
          });
          continue;
        }

        if (entry.isDirectory()) {
          if (isDenyDirectoryName(entry.name)) {
            skippedItems.push({
              path: rel,
              reason: `Excluded directory: ${entry.name}`,
            });
            continue;
          }
          // Never snapshot the app checkpoint store if it lives under the project.
          const absDir = path.join(current.src, entry.name);
          const storeKey = this.safetyGate.normalizePath(this.storageRoot).toLowerCase();
          const absKey = this.safetyGate.normalizePath(absDir).toLowerCase();
          if (absKey === storeKey || absKey.startsWith(`${storeKey}\\`) || absKey.startsWith(`${storeKey}/`)) {
            skippedItems.push({
              path: rel,
              reason: "Excluded app checkpoint storage folder",
            });
            continue;
          }
          const listCheck = this.safetyGate.checkScanAccess(srcPath, "list");
          if (!listCheck.allowed) {
            skippedItems.push({
              path: rel,
              reason: listCheck.denyReason ?? "Directory blocked by Safety Gate",
            });
            continue;
          }
          fs.mkdirSync(destPath, { recursive: true });
          stack.push({ src: srcPath, dest: destPath, rel });
          continue;
        }

        if (!entry.isFile()) {
          skippedItems.push({ path: rel, reason: "Skipped non-file entry" });
          continue;
        }

        if (isSensitiveFileName(entry.name)) {
          skippedItems.push({
            path: rel,
            reason: "Excluded sensitive file",
          });
          continue;
        }

        // Deny-list segments anywhere in relative path.
        if (rel.split(/[/\\]/).some((part) => isDenyDirectoryName(part))) {
          skippedItems.push({
            path: rel,
            reason: "Excluded by deny-list path segment",
          });
          continue;
        }

        // Lockfiles may be copied for restore fidelity.
        if (!isLockFileName(entry.name)) {
          const restoreCheck = this.safetyGate.checkRestoreWrite(
            path.join(sourceRoot, rel),
          );
          if (!restoreCheck.allowed) {
            skippedItems.push({
              path: rel,
              reason: restoreCheck.denyReason ?? "Blocked by Safety Gate",
            });
            continue;
          }
        }

        try {
          const stat = fs.statSync(srcPath);
          if (stat.size > MAX_SNAPSHOT_FILE_BYTES) {
            skippedItems.push({
              path: rel,
              reason: `Skipped large file (>${MAX_SNAPSHOT_FILE_BYTES} bytes)`,
            });
            continue;
          }
          const buf = fs.readFileSync(srcPath);
          if (buf.includes(0)) {
            skippedItems.push({ path: rel, reason: "Skipped binary file" });
            continue;
          }
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, buf);
          copied += 1;
        } catch (error) {
          skippedItems.push({
            path: rel,
            reason:
              error instanceof Error
                ? `Could not copy: ${error.message}`
                : "Could not copy file",
          });
        }
      }
    }

    return copied;
  }

  private async restoreFolderSnapshot(
    projectPath: string,
    snapshotDir: string,
  ): Promise<void> {
    const filesDir = path.join(snapshotDir, "files");
    if (!fs.existsSync(filesDir)) {
      throw new Error("Snapshot files are missing.");
    }

    // Remove safe tracked project files that are not denied, then copy snapshot back.
    // We only delete files that would be allowed restore writes (never secrets/deny dirs).
    this.clearRestorableProjectFiles(projectPath);
    this.copySnapshotIntoProject(filesDir, projectPath);
  }

  private clearRestorableProjectFiles(projectPath: string): void {
    const stack = [projectPath];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isSymbolicLink()) {
          continue;
        }
        const linkCheck = inspectLinkSafety(full);
        if (!linkCheck.safe) {
          continue;
        }
        if (entry.isDirectory()) {
          if (isDenyDirectoryName(entry.name)) {
            continue;
          }
          stack.push(full);
          continue;
        }
        if (!entry.isFile()) continue;
        if (isSensitiveFileName(entry.name)) continue;
        const check = this.safetyGate.checkRestoreWrite(full);
        if (!check.allowed && !isLockFileName(entry.name)) continue;
        try {
          fs.unlinkSync(full);
        } catch {
          this.safetyGate.log(
            "warning",
            "Files/folders skipped",
            `Could not clear ${path.relative(projectPath, full)} before restore.`,
          );
        }
      }
    }
  }

  private copySnapshotIntoProject(sourceRoot: string, projectRoot: string): void {
    const stack: Array<{ src: string; rel: string }> = [{ src: sourceRoot, rel: "" }];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(current.src, { withFileTypes: true });
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `Could not read snapshot: ${error.message}`
            : "Could not read snapshot",
        );
      }
      for (const entry of entries) {
        const rel = current.rel ? path.join(current.rel, entry.name) : entry.name;
        const srcPath = path.join(current.src, entry.name);
        const destPath = path.join(projectRoot, rel);

        // Stage 11B: never restore symlinks/junctions.
        if (entry.isSymbolicLink()) {
          this.safetyGate.log(
            "info",
            "Files/folders skipped",
            `Restore skipped symlink ${rel} (not recreated).`,
          );
          continue;
        }
        const linkCheck = inspectLinkSafety(srcPath);
        if (!linkCheck.safe) {
          this.safetyGate.log(
            "info",
            "Files/folders skipped",
            `Restore skipped unsafe link ${rel}: ${linkCheck.reason ?? "blocked"}`,
          );
          continue;
        }

        if (entry.isDirectory()) {
          if (isDenyDirectoryName(entry.name)) continue;
          const check = this.safetyGate.checkRestoreWrite(destPath);
          if (!check.allowed) continue;
          fs.mkdirSync(destPath, { recursive: true });
          stack.push({ src: srcPath, rel });
          continue;
        }

        if (!entry.isFile()) continue;
        if (isSensitiveFileName(entry.name)) continue;

        const check = this.safetyGate.checkRestoreWrite(destPath);
        if (!check.allowed && !isLockFileName(entry.name)) {
          this.safetyGate.log(
            "info",
            "Files/folders skipped",
            `Restore skipped ${rel}: ${check.denyReason ?? "blocked"}`,
          );
          continue;
        }

        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
