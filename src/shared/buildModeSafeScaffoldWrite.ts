/**
 * Stage 129: Safe Scaffold Write types (guarded create-only).
 * Creates ready-to-create files only inside a Safe target folder.
 * No overwrite. No AI. No commands. No package install.
 */

import type { BlueprintProjectType } from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";

export type SafeScaffoldWriteUiStatus =
  | "not-ready"
  | "ready"
  | "written"
  | "blocked"
  | "stale"
  | "failed";

export const SAFE_SCAFFOLD_WRITE_UI_LABELS: Record<
  SafeScaffoldWriteUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready to write",
  written: "Files written",
  blocked: "Blocked",
  stale: "Stale",
  failed: "Write failed / blocked",
};

export const SAFE_SCAFFOLD_WRITE_BUTTON_LABEL =
  "Write Safe Scaffold Files" as const;

export const SAFE_SCAFFOLD_WRITE_ROLLBACK_NOTE =
  "NTTC did not run commands or install packages. To manually roll back this scaffold, review and delete the files listed above from the target folder." as const;

export const SAFE_SCAFFOLD_WRITE_CLEAR_NOTE =
  "Clear Write Result only clears this app record. It does not delete files from disk." as const;

export const SAFE_SCAFFOLD_WRITE_GUIDE_NOTE =
  "Safe Scaffold Write creates new files only after final confirmation and an immediate safety re-check. It never overwrites files, runs commands, installs packages, or applies patches." as const;

export const SAFE_SCAFFOLD_WRITE_DIALOG_MESSAGE =
  "NTTC will create new scaffold files in the selected target folder." as const;

export const SAFE_SCAFFOLD_WRITE_DIALOG_DETAIL = [
  "NTTC will not overwrite files.",
  "NTTC will not edit existing files.",
  "NTTC will not run commands.",
  "NTTC will not install packages.",
  "NTTC will not apply patches.",
  "",
  "Proceed with creating these new files?",
].join("\n");

export interface SafeScaffoldWriteSkippedEntry {
  relativePath: string;
  reason: string;
}

export interface SafeScaffoldWriteFailedEntry {
  relativePath: string;
  reason: string;
}

export interface SafeScaffoldWriteRecheckSummary {
  checkedAt: string;
  targetStatus: SafeScaffoldTargetSafetyStatus | "unknown";
  targetPathMatched: boolean;
  readyPathCount: number;
  existingPathConflicts: number;
  pathValidationFailures: number;
  contentSafetyFailures: number;
  passed: boolean;
  reasons: string[];
}

/** Persistable write result metadata — no source project file bodies. */
export interface SafeScaffoldWriteResultRecord {
  writtenAt: string;
  targetFolderPath: string;
  createdRelativePaths: string[];
  createdDirectories: string[];
  skipped: SafeScaffoldWriteSkippedEntry[];
  failed: SafeScaffoldWriteFailedEntry[];
  sourceBlueprintImported: boolean;
  sourceBlueprintProjectType: BlueprintProjectType | string;
  sourceTaskCardCount: number;
  sourceFileTreeGeneratedAt: string;
  sourceFileTreeFingerprint: string;
  sourceFileContentGeneratedAt: string;
  sourceFileContentFingerprint: string;
  sourceWriteManifestGeneratedAt: string;
  sourceWriteManifestFingerprint: string;
  sourceFinalConfirmationConfirmedAt: string;
  sourceFinalConfirmationFingerprint: string;
  safetyRecheck: SafeScaffoldWriteRecheckSummary;
  rollbackNote: string;
  markdown: string;
  warnings: string[];
  stale: boolean;
}

export interface SafeScaffoldWriteState {
  saved: SafeScaffoldWriteResultRecord | null;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: SafeScaffoldWriteUiStatus;
  readinessBlockedReasons: string[];
  canWrite: boolean;
}

export function emptySafeScaffoldWriteState(): SafeScaffoldWriteState {
  return {
    saved: null,
    busy: false,
    statusMessage:
      "Write Safe Scaffold Files only after a current Safe target, previews, and Final Confirmation. Stage 129 requires Safe (not Caution).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
    canWrite: false,
  };
}

export function isSafeScaffoldWriteResultCurrent(
  state: SafeScaffoldWriteState | null | undefined,
): boolean {
  return Boolean(
    state?.saved &&
      !state.saved.stale &&
      state.saved.createdRelativePaths.length > 0,
  );
}

export function fingerprintFinalConfirmationForWrite(input: {
  confirmedAt: string;
  targetFolderPath: string;
  readyToCreateCount: number;
  notReadyCount: number;
}): string {
  return `${input.confirmedAt}::${input.targetFolderPath}::${input.readyToCreateCount}::${input.notReadyCount}`;
}

export function deriveSafeScaffoldWriteUiStatus(input: {
  saved: SafeScaffoldWriteResultRecord | null;
  busy: boolean;
  canWrite: boolean;
  hardBlocked: boolean;
}): SafeScaffoldWriteUiStatus {
  if (input.busy) return "not-ready";
  if (input.saved?.stale) return "stale";
  if (input.saved && input.saved.createdRelativePaths.length > 0) {
    return "written";
  }
  if (input.saved && input.saved.failed.length > 0) return "failed";
  if (input.hardBlocked) return "blocked";
  if (input.canWrite) return "ready";
  return "not-ready";
}

export function emptySafeScaffoldWriteResultTombstone(): SafeScaffoldWriteResultRecord {
  return {
    writtenAt: "",
    targetFolderPath: "",
    createdRelativePaths: [],
    createdDirectories: [],
    skipped: [],
    failed: [],
    sourceBlueprintImported: false,
    sourceBlueprintProjectType: "unknown",
    sourceTaskCardCount: 0,
    sourceFileTreeGeneratedAt: "",
    sourceFileTreeFingerprint: "",
    sourceFileContentGeneratedAt: "",
    sourceFileContentFingerprint: "",
    sourceWriteManifestGeneratedAt: "",
    sourceWriteManifestFingerprint: "",
    sourceFinalConfirmationConfirmedAt: "",
    sourceFinalConfirmationFingerprint: "",
    safetyRecheck: {
      checkedAt: "",
      targetStatus: "unknown",
      targetPathMatched: false,
      readyPathCount: 0,
      existingPathConflicts: 0,
      pathValidationFailures: 0,
      contentSafetyFailures: 0,
      passed: false,
      reasons: [],
    },
    rollbackNote: "",
    markdown: "",
    warnings: [],
    stale: false,
  };
}

export function normalizeSafeScaffoldWriteResultRecord(
  raw: SafeScaffoldWriteResultRecord | null | undefined,
): SafeScaffoldWriteResultRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;
  if (typeof raw.writtenAt !== "string" || !raw.writtenAt.trim()) return null;

  return {
    writtenAt: raw.writtenAt,
    targetFolderPath:
      typeof raw.targetFolderPath === "string" ? raw.targetFolderPath : "",
    createdRelativePaths: Array.isArray(raw.createdRelativePaths)
      ? raw.createdRelativePaths
          .filter((p) => typeof p === "string")
          .map((p) => p.replace(/\\/g, "/"))
          .slice(0, 200)
      : [],
    createdDirectories: Array.isArray(raw.createdDirectories)
      ? raw.createdDirectories
          .filter((p) => typeof p === "string")
          .map((p) => p.replace(/\\/g, "/"))
          .slice(0, 200)
      : [],
    skipped: Array.isArray(raw.skipped)
      ? raw.skipped
          .filter(
            (e) =>
              e &&
              typeof e.relativePath === "string" &&
              typeof e.reason === "string",
          )
          .map((e) => ({
            relativePath: e.relativePath.replace(/\\/g, "/"),
            reason: e.reason.slice(0, 500),
          }))
          .slice(0, 200)
      : [],
    failed: Array.isArray(raw.failed)
      ? raw.failed
          .filter(
            (e) =>
              e &&
              typeof e.relativePath === "string" &&
              typeof e.reason === "string",
          )
          .map((e) => ({
            relativePath: e.relativePath.replace(/\\/g, "/"),
            reason: e.reason.slice(0, 500),
          }))
          .slice(0, 200)
      : [],
    sourceBlueprintImported: Boolean(raw.sourceBlueprintImported),
    sourceBlueprintProjectType:
      typeof raw.sourceBlueprintProjectType === "string"
        ? raw.sourceBlueprintProjectType
        : "unknown",
    sourceTaskCardCount: raw.sourceTaskCardCount ?? 0,
    sourceFileTreeGeneratedAt:
      typeof raw.sourceFileTreeGeneratedAt === "string"
        ? raw.sourceFileTreeGeneratedAt
        : "",
    sourceFileTreeFingerprint:
      typeof raw.sourceFileTreeFingerprint === "string"
        ? raw.sourceFileTreeFingerprint
        : "",
    sourceFileContentGeneratedAt:
      typeof raw.sourceFileContentGeneratedAt === "string"
        ? raw.sourceFileContentGeneratedAt
        : "",
    sourceFileContentFingerprint:
      typeof raw.sourceFileContentFingerprint === "string"
        ? raw.sourceFileContentFingerprint
        : "",
    sourceWriteManifestGeneratedAt:
      typeof raw.sourceWriteManifestGeneratedAt === "string"
        ? raw.sourceWriteManifestGeneratedAt
        : "",
    sourceWriteManifestFingerprint:
      typeof raw.sourceWriteManifestFingerprint === "string"
        ? raw.sourceWriteManifestFingerprint
        : "",
    sourceFinalConfirmationConfirmedAt:
      typeof raw.sourceFinalConfirmationConfirmedAt === "string"
        ? raw.sourceFinalConfirmationConfirmedAt
        : "",
    sourceFinalConfirmationFingerprint:
      typeof raw.sourceFinalConfirmationFingerprint === "string"
        ? raw.sourceFinalConfirmationFingerprint
        : "",
    safetyRecheck: {
      checkedAt:
        typeof raw.safetyRecheck?.checkedAt === "string"
          ? raw.safetyRecheck.checkedAt
          : "",
      targetStatus:
        raw.safetyRecheck?.targetStatus === "safe" ||
        raw.safetyRecheck?.targetStatus === "caution" ||
        raw.safetyRecheck?.targetStatus === "blocked"
          ? raw.safetyRecheck.targetStatus
          : "unknown",
      targetPathMatched: Boolean(raw.safetyRecheck?.targetPathMatched),
      readyPathCount: raw.safetyRecheck?.readyPathCount ?? 0,
      existingPathConflicts: raw.safetyRecheck?.existingPathConflicts ?? 0,
      pathValidationFailures: raw.safetyRecheck?.pathValidationFailures ?? 0,
      contentSafetyFailures: raw.safetyRecheck?.contentSafetyFailures ?? 0,
      passed: Boolean(raw.safetyRecheck?.passed),
      reasons: Array.isArray(raw.safetyRecheck?.reasons)
        ? raw.safetyRecheck.reasons
            .filter((r) => typeof r === "string")
            .slice(0, 40)
        : [],
    },
    rollbackNote:
      typeof raw.rollbackNote === "string"
        ? raw.rollbackNote.slice(0, 2000)
        : SAFE_SCAFFOLD_WRITE_ROLLBACK_NOTE,
    markdown: raw.markdown.slice(0, 200_000),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w) => typeof w === "string").slice(0, 40)
      : [],
    stale: Boolean(raw.stale),
  };
}
