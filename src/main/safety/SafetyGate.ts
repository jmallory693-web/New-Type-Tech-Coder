import path from "node:path";
import {
  DENY_DIRECTORY_NAMES,
  DENY_FILE_NAME_PATTERNS,
  READ_ONLY_FILE_NAMES,
  SYSTEM_PATH_PREFIXES_WIN,
  getDenyListSummary,
  isAllowedReadableTextFile,
  isLockFileName,
} from "../../shared/denyList";
import {
  isProjectMemoryFileName,
  NTTC_MEMORY_FOLDER,
} from "../../shared/projectMemoryConstants";
import {
  BLUEPRINT_PLANNING_SUBFOLDER,
  isPlanningDocumentFileName,
} from "../../shared/blueprintConstants";
import { ONEDRIVE_PROJECT_WARNING } from "../../shared/userFacingMessages";
import { inspectLinkSafety } from "./linkSafety";
import type {
  ActionLogEntry,
  ActionLogLevel,
  AppMode,
  PathCheckResult,
  ProjectInfo,
  SafetyGateStatus,
  ScanAccessIntent,
} from "../../shared/types";

/**
 * Safety Gate (Stage 2–7).
 * Tracks project root, normalizes paths, enforces sandbox/deny checks,
 * locks Inspect-only mode, gates scan reads / restore writes / allowlisted
 * safe checks, and records an action log.
 * Does NOT enable edit mode, AI editing, arbitrary terminals, or AI-run commands.
 */
export class SafetyGate {
  private mode: AppMode = "inspect-only";
  private project: ProjectInfo | null = null;
  private initialized = false;
  private checkpointExists = false;
  private readonly actionLog: ActionLogEntry[] = [];
  private logListeners: Array<(entry: ActionLogEntry) => void> = [];

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.log("success", "Safety Gate initialized", "Inspect-only mode locked. Writes are disabled.");
  }

  onLog(listener: (entry: ActionLogEntry) => void): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== listener);
    };
  }

  log(level: ActionLogLevel, message: string, detail?: string): ActionLogEntry {
    const entry: ActionLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      detail,
    };
    this.actionLog.unshift(entry);
    if (this.actionLog.length > 200) {
      this.actionLog.length = 200;
    }
    for (const listener of this.logListeners) {
      listener(entry);
    }
    return entry;
  }

  getActionLog(): ActionLogEntry[] {
    return [...this.actionLog];
  }

  getProject(): ProjectInfo | null {
    return this.project;
  }

  getStatus(): SafetyGateStatus {
    return {
      initialized: this.initialized,
      mode: this.mode,
      project: this.project,
      writesAllowed: false,
      editModeAvailable: false,
      checkpointExists: this.checkpointExists,
      denyListSummary: getDenyListSummary(),
    };
  }

  setCheckpointExists(exists: boolean): void {
    this.checkpointExists = exists;
  }

  normalizePath(inputPath: string): string {
    const trimmed = inputPath.trim().replace(/^["']|["']$/g, "");
    return path.resolve(trimmed);
  }

  private toCompareKey(absolutePath: string): string {
    return this.normalizePath(absolutePath).replace(/\//g, "\\").toLowerCase();
  }

  detectOneDrive(absolutePath: string): boolean {
    const key = this.toCompareKey(absolutePath);
    return key.includes("\\onedrive\\") || key.includes("\\onedrive -");
  }

  setProjectRoot(folderPath: string): ProjectInfo {
    const normalizedPath = this.normalizePath(folderPath);
    const displayName = path.basename(normalizedPath) || normalizedPath;
    const isOneDrive = this.detectOneDrive(normalizedPath);

    this.project = {
      rootPath: normalizedPath,
      displayName,
      normalizedPath,
      isOneDrive,
    };

    this.log(
      "success",
      "Project folder selected",
      `${displayName} — ${normalizedPath}`,
    );

    if (isOneDrive) {
      this.log(
        "warning",
        "OneDrive path detected",
        ONEDRIVE_PROJECT_WARNING,
      );
    }

    return this.project;
  }

  clearProject(): void {
    this.project = null;
    this.checkpointExists = false;
    this.log("info", "Project cleared", "No project selected.");
  }

  isInsideProjectRoot(candidatePath: string): boolean {
    if (!this.project) {
      return false;
    }
    const rootKey = this.toCompareKey(this.project.normalizedPath);
    const candidateKey = this.toCompareKey(candidatePath);

    if (candidateKey === rootKey) {
      return true;
    }

    const rootWithSep = rootKey.endsWith("\\") ? rootKey : `${rootKey}\\`;
    return candidateKey.startsWith(rootWithSep);
  }

  private matchDenyReason(absolutePath: string): string | undefined {
    const compareKey = this.toCompareKey(absolutePath);
    const parts = compareKey.split("\\").filter(Boolean);
    const baseName = parts[parts.length - 1] ?? "";

    for (const prefix of SYSTEM_PATH_PREFIXES_WIN) {
      if (compareKey === prefix || compareKey.startsWith(`${prefix}\\`)) {
        return `System directory is blocked (${prefix})`;
      }
    }

    for (const dirName of DENY_DIRECTORY_NAMES) {
      const needle = dirName.toLowerCase();
      if (parts.includes(needle)) {
        return `Denied directory segment: ${dirName}`;
      }
    }

    for (const pattern of DENY_FILE_NAME_PATTERNS) {
      if (pattern.test(baseName)) {
        return `Denied sensitive file pattern: ${baseName}`;
      }
    }

    for (const lockName of READ_ONLY_FILE_NAMES) {
      if (baseName === lockName.toLowerCase()) {
        return `Lockfile contents are not read in Stage 3: ${lockName}`;
      }
    }

    return undefined;
  }

  checkPath(candidatePath: string, options?: { quiet?: boolean }): PathCheckResult {
    const normalizedPath = this.normalizePath(candidatePath);
    const quiet = options?.quiet === true;

    if (!this.project) {
      const result: PathCheckResult = {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "No project root selected",
        allowed: false,
      };
      if (!quiet) {
        this.log("blocked", "Path check blocked", result.denyReason);
      }
      return result;
    }

    const insideProjectRoot = this.isInsideProjectRoot(normalizedPath);
    if (!insideProjectRoot) {
      const result: PathCheckResult = {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "Path is outside the selected project root",
        allowed: false,
      };
      if (!quiet) {
        this.log("blocked", "Blocked path outside project root", normalizedPath);
      }
      return result;
    }

    const denyReason = this.matchDenyReason(normalizedPath);
    if (denyReason) {
      const result: PathCheckResult = {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: true,
        denied: true,
        denyReason,
        allowed: false,
      };
      if (!quiet) {
        this.log("blocked", "Blocked by deny list", denyReason);
      }
      return result;
    }

    return {
      requestedPath: candidatePath,
      normalizedPath,
      insideProjectRoot: true,
      denied: false,
      allowed: true,
    };
  }

  /**
   * Scan-oriented access check.
   * - detect-presence: lockfiles may be noted by name without reading contents
   * - list: directory listing if not deny-listed
   * - read-content: only allowlisted text files; never secrets/lockfile bodies
   */
  checkScanAccess(
    candidatePath: string,
    intent: ScanAccessIntent,
  ): PathCheckResult {
    const normalizedPath = this.normalizePath(candidatePath);
    const baseName = path.basename(normalizedPath);

    if (!this.project) {
      return {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "No project root selected",
        allowed: false,
      };
    }

    if (!this.isInsideProjectRoot(normalizedPath)) {
      return {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "Path is outside the selected project root",
        allowed: false,
      };
    }

    if (intent === "detect-presence" && isLockFileName(baseName)) {
      return {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: true,
        denied: false,
        allowed: true,
        presenceOnly: true,
      };
    }

    if (intent === "read-content") {
      if (isLockFileName(baseName)) {
        return {
          requestedPath: candidatePath,
          normalizedPath,
          insideProjectRoot: true,
          denied: true,
          denyReason: `Lockfile contents are not read (presence only): ${baseName}`,
          allowed: false,
          presenceOnly: true,
        };
      }

      if (!isAllowedReadableTextFile(baseName)) {
        // Config and other files may be detected by name via listing, not content read.
        const deny = this.matchDenyReason(normalizedPath);
        return {
          requestedPath: candidatePath,
          normalizedPath,
          insideProjectRoot: true,
          denied: true,
          denyReason:
            deny ??
            `Content read not allowed for this file in Stage 3: ${baseName}`,
          allowed: false,
        };
      }
    }

    const denyReason = this.matchDenyReason(normalizedPath);
    if (denyReason) {
      return {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: true,
        denied: true,
        denyReason,
        allowed: false,
      };
    }

    return {
      requestedPath: candidatePath,
      normalizedPath,
      insideProjectRoot: true,
      denied: false,
      allowed: true,
    };
  }

  assertWriteAllowed(actionLabel: string): never {
    this.log(
      "blocked",
      "Write action blocked",
      `${actionLabel} — app is locked to Inspect-only; general edits are not available.`,
    );
    throw new Error(
      `Safety Gate blocked write: ${actionLabel}. Inspect-only mode; writes are disabled.`,
    );
  }

  /**
   * Checkpoint restore may write only inside the selected project root.
   * Denied/sensitive paths are still blocked so excluded secrets are not restored.
   */
  checkRestoreWrite(candidatePath: string): PathCheckResult {
    const normalizedPath = this.normalizePath(candidatePath);

    if (!this.project) {
      return {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "No project root selected",
        allowed: false,
      };
    }

    if (!this.isInsideProjectRoot(normalizedPath)) {
      this.log(
        "blocked",
        "Restore write blocked",
        `Path is outside the selected project root: ${normalizedPath}`,
      );
      return {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "Restore cannot write outside the selected project root",
        allowed: false,
      };
    }

    const denyReason = this.matchDenyReason(normalizedPath);
    if (denyReason) {
      return {
        requestedPath: candidatePath,
        normalizedPath,
        insideProjectRoot: true,
        denied: true,
        denyReason: `Restore skipped denied path: ${denyReason}`,
        allowed: false,
      };
    }

    return {
      requestedPath: candidatePath,
      normalizedPath,
      insideProjectRoot: true,
      denied: false,
      allowed: true,
    };
  }

  /**
   * Gate for Stage 7 allowlisted safe checks only.
   * Does not accept free-typed commands. cwd must be the project root.
   */
  checkSafeCommand(
    scriptKind: string,
    cwdPath: string,
  ): { allowed: boolean; denyReason?: string } {
    if (!this.project) {
      this.log(
        "blocked",
        "Command blocked",
        "No project folder selected for safe check.",
      );
      return { allowed: false, denyReason: "No project folder selected" };
    }

    const normalizedCwd = this.normalizePath(cwdPath);
    if (!this.isInsideProjectRoot(normalizedCwd)) {
      this.log(
        "blocked",
        "Command blocked",
        `Working directory is outside the selected project root: ${normalizedCwd}`,
      );
      return {
        allowed: false,
        denyReason: "Commands cannot run outside the selected project root",
      };
    }

    const rootKey = this.toCompareKey(this.project.normalizedPath);
    const cwdKey = this.toCompareKey(normalizedCwd);
    if (cwdKey !== rootKey) {
      this.log(
        "blocked",
        "Command blocked",
        `Working directory must be the project root (got ${normalizedCwd}).`,
      );
      return {
        allowed: false,
        denyReason: "Safe checks must run in the selected project root only",
      };
    }

    const allowlist = new Set([
      "build",
      "test",
      "typecheck",
      "lint",
      "check",
      "format:check",
      "validate",
    ]);
    if (!allowlist.has(scriptKind)) {
      this.log(
        "blocked",
        "Command blocked",
        `Script kind “${scriptKind}” is not on the Stage 7 allowlist.`,
      );
      return {
        allowed: false,
        denyReason: `“${scriptKind}” is not an allowlisted safe check`,
      };
    }

    return { allowed: true };
  }

  /**
   * Stage 50: Resolve the `.nttc/` folder inside the selected project root.
   * Refuses paths that would resolve outside the project or through unsafe links.
   */
  resolveProjectMemoryDirectory(): {
    allowed: boolean;
    dirPath?: string;
    denyReason?: string;
  } {
    if (!this.project) {
      return {
        allowed: false,
        denyReason: "No project folder selected",
      };
    }

    const rootPath = this.normalizePath(this.project.normalizedPath);
    const memoryDir = this.normalizePath(
      path.join(rootPath, NTTC_MEMORY_FOLDER),
    );

    if (!this.isInsideProjectRoot(memoryDir)) {
      this.log(
        "blocked",
        "Project memory path refused",
        `“.nttc” path resolves outside the selected project root: ${memoryDir}`,
      );
      return {
        allowed: false,
        denyReason:
          "Project memory folder must stay inside the selected project root",
      };
    }

    const rootKey = this.toCompareKey(rootPath);
    const memoryKey = this.toCompareKey(memoryDir);
    const memoryPrefix = memoryKey.startsWith(`${rootKey}\\${NTTC_MEMORY_FOLDER.toLowerCase()}`)
      ? true
      : memoryKey === `${rootKey}\\${NTTC_MEMORY_FOLDER.toLowerCase()}`;
    if (!memoryPrefix) {
      return {
        allowed: false,
        denyReason: "Project memory folder path is invalid",
      };
    }

    if (process.platform === "win32") {
      try {
        const rootReal = this.toCompareKey(path.resolve(rootPath));
        const memoryReal = this.toCompareKey(path.resolve(memoryDir));
        if (!memoryReal.startsWith(`${rootReal}\\`)) {
          this.log(
            "blocked",
            "Project memory path refused",
            `Resolved “.nttc” path is outside project root: ${memoryDir}`,
          );
          return {
            allowed: false,
            denyReason:
              "“.nttc” path resolves outside the selected project root",
          };
        }
      } catch {
        return {
          allowed: false,
          denyReason: "Could not verify project memory folder path safety",
        };
      }
    }

    const linkCheck = inspectLinkSafety(memoryDir);
    if (!linkCheck.safe) {
      this.log(
        "blocked",
        "Project memory refused symlink/junction path",
        linkCheck.reason ?? "Unsafe link at .nttc path",
      );
      return {
        allowed: false,
        denyReason:
          linkCheck.reason ??
          "Project memory folder path is an unsafe symlink or junction",
      };
    }

    return { allowed: true, dirPath: memoryDir };
  }

  /**
   * Stage 50: Gate for approved markdown files inside `<project>/.nttc/` only.
   */
  checkProjectMemoryWrite(fileName: string): PathCheckResult {
    if (!isProjectMemoryFileName(fileName)) {
      this.log(
        "blocked",
        "Project memory write refused",
        `File is not on the approved list: ${fileName}`,
      );
      return {
        requestedPath: fileName,
        normalizedPath: fileName,
        insideProjectRoot: false,
        denied: true,
        denyReason: "Only approved NTTC markdown files may be written",
        allowed: false,
      };
    }

    const dirResult = this.resolveProjectMemoryDirectory();
    if (!dirResult.allowed || !dirResult.dirPath) {
      return {
        requestedPath: fileName,
        normalizedPath: fileName,
        insideProjectRoot: false,
        denied: true,
        denyReason: dirResult.denyReason ?? "Project memory folder unavailable",
        allowed: false,
      };
    }

    const filePath = this.normalizePath(path.join(dirResult.dirPath, fileName));
    if (!this.isInsideProjectRoot(filePath)) {
      this.log(
        "blocked",
        "Project memory write refused path outside project",
        filePath,
      );
      return {
        requestedPath: fileName,
        normalizedPath: filePath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "Project memory cannot write outside the selected project root",
        allowed: false,
      };
    }

    const memoryKey = this.toCompareKey(dirResult.dirPath);
    const fileKey = this.toCompareKey(filePath);
    if (!fileKey.startsWith(`${memoryKey}\\`)) {
      return {
        requestedPath: fileName,
        normalizedPath: filePath,
        insideProjectRoot: true,
        denied: true,
        denyReason: "Project memory files must stay inside `.nttc/`",
        allowed: false,
      };
    }

    const linkCheck = inspectLinkSafety(filePath);
    if (!linkCheck.safe) {
      this.log(
        "blocked",
        "Project memory refused symlink/junction path",
        linkCheck.reason ?? filePath,
      );
      return {
        requestedPath: fileName,
        normalizedPath: filePath,
        insideProjectRoot: true,
        denied: true,
        denyReason:
          linkCheck.reason ??
          "Target path is an unsafe symlink or junction",
        allowed: false,
      };
    }

    return {
      requestedPath: fileName,
      normalizedPath: filePath,
      insideProjectRoot: true,
      denied: false,
      allowed: true,
    };
  }

  /**
   * Stage 80: Resolve `.nttc/planning/` inside the selected project root.
   */
  resolvePlanningDocumentsDirectory(): {
    allowed: boolean;
    dirPath?: string;
    denyReason?: string;
  } {
    const memoryDir = this.resolveProjectMemoryDirectory();
    if (!memoryDir.allowed || !memoryDir.dirPath) {
      return memoryDir;
    }
    const planningDir = this.normalizePath(
      path.join(memoryDir.dirPath, BLUEPRINT_PLANNING_SUBFOLDER),
    );
    if (!this.isInsideProjectRoot(planningDir)) {
      return {
        allowed: false,
        denyReason: "Planning folder must stay inside the selected project root",
      };
    }
    const linkCheck = inspectLinkSafety(planningDir);
    if (!linkCheck.safe) {
      return {
        allowed: false,
        denyReason: linkCheck.reason ?? "Unsafe link at planning path",
      };
    }
    return { allowed: true, dirPath: planningDir };
  }

  /**
   * Stage 80: Gate for approved planning markdown files in `.nttc/planning/` only.
   */
  checkPlanningDocumentWrite(fileName: string): PathCheckResult {
    if (!isPlanningDocumentFileName(fileName)) {
      this.log(
        "blocked",
        "Planning docs write refused",
        `File is not on the approved planning list: ${fileName}`,
      );
      return {
        requestedPath: fileName,
        normalizedPath: fileName,
        insideProjectRoot: false,
        denied: true,
        denyReason: "Only approved planning markdown files may be written",
        allowed: false,
      };
    }

    const dirResult = this.resolvePlanningDocumentsDirectory();
    if (!dirResult.allowed || !dirResult.dirPath) {
      return {
        requestedPath: fileName,
        normalizedPath: fileName,
        insideProjectRoot: false,
        denied: true,
        denyReason: dirResult.denyReason ?? "Planning folder unavailable",
        allowed: false,
      };
    }

    const filePath = this.normalizePath(path.join(dirResult.dirPath, fileName));
    if (!this.isInsideProjectRoot(filePath)) {
      return {
        requestedPath: fileName,
        normalizedPath: filePath,
        insideProjectRoot: false,
        denied: true,
        denyReason: "Planning files cannot write outside the project root",
        allowed: false,
      };
    }

    const planningKey = this.toCompareKey(dirResult.dirPath);
    const fileKey = this.toCompareKey(filePath);
    if (!fileKey.startsWith(`${planningKey}\\`)) {
      return {
        requestedPath: fileName,
        normalizedPath: filePath,
        insideProjectRoot: true,
        denied: true,
        denyReason: "Planning files must stay inside `.nttc/planning/`",
        allowed: false,
      };
    }

    const linkCheck = inspectLinkSafety(filePath);
    if (!linkCheck.safe) {
      return {
        requestedPath: fileName,
        normalizedPath: filePath,
        insideProjectRoot: true,
        denied: true,
        denyReason: linkCheck.reason ?? "Unsafe symlink or junction",
        allowed: false,
      };
    }

    return {
      requestedPath: fileName,
      normalizedPath: filePath,
      insideProjectRoot: true,
      denied: false,
      allowed: true,
    };
  }

  recordPlaceholderClick(buttonLabel: string): void {
    this.log(
      "info",
      "Placeholder button clicked",
      `${buttonLabel} — Coming later.`,
    );
  }
}
