/**
 * Stage 119: Safe Scaffold target-folder readiness types (metadata only).
 * No file writes. No scaffold. No recursive source scan.
 */

export type SafeScaffoldTargetSafetyStatus =
  | "safe"
  | "caution"
  | "blocked";

/** UI card / status-line labels for the Build tab. */
export type SafeScaffoldTargetUiStatus =
  | "none"
  | "checking"
  | "safe"
  | "caution"
  | "blocked";

export const SAFE_SCAFFOLD_TARGET_UI_LABELS: Record<
  SafeScaffoldTargetUiStatus,
  string
> = {
  none: "No folder selected",
  checking: "Checking",
  safe: "Safe empty folder",
  caution: "Caution",
  blocked: "Blocked",
};

export const SAFE_SCAFFOLD_TARGET_FOLDER_SAFETY_LABELS: Record<
  SafeScaffoldTargetSafetyStatus | "not-checked",
  string
> = {
  safe: "Safe",
  caution: "Caution",
  blocked: "Blocked",
  "not-checked": "Not checked",
};

export const SAFE_SCAFFOLD_FUTURE_WRITE_READINESS =
  "Not allowed yet" as const;

export const SAFE_SCAFFOLD_FILE_CREATION_NOT_ENABLED_YET =
  "Safe Scaffold file creation is not enabled yet. Future stages will add preview-only scaffold planning before any write capability.";

export const SAFE_SCAFFOLD_TARGET_MAX_ENTRIES = 100;

/** Persistable metadata only — no file contents. */
export interface SafeScaffoldTargetEntrySummary {
  totalEntries: number;
  truncated: boolean;
  entryNames: string[];
  fileCount: number;
  directoryCount: number;
  otherCount: number;
  harmlessCount: number;
  unknownNonSourceCount: number;
  sourceLikeCount: number;
  projectMarkerNames: string[];
  generatedMarkerNames: string[];
}

export interface SafeScaffoldTargetCheckResult {
  status: SafeScaffoldTargetSafetyStatus;
  reasons: string[];
  entrySummary: SafeScaffoldTargetEntrySummary;
  checkedAt: string;
  selectedPath: string;
  resolvedPath: string;
  futureWriteReadiness: typeof SAFE_SCAFFOLD_FUTURE_WRITE_READINESS;
}

/** Saved under project history (metadata only). */
export interface SafeScaffoldTargetRecord {
  selectedPath: string | null;
  lastCheck: SafeScaffoldTargetCheckResult | null;
  stale: boolean;
}

export interface SafeScaffoldTargetState {
  selectedPath: string | null;
  lastCheck: SafeScaffoldTargetCheckResult | null;
  stale: boolean;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: SafeScaffoldTargetUiStatus;
}

export function emptySafeScaffoldTargetState(): SafeScaffoldTargetState {
  return {
    selectedPath: null,
    lastCheck: null,
    stale: false,
    busy: false,
    statusMessage:
      "Select an empty target folder to assess future Safe Scaffold readiness (metadata only — no files are created).",
    uiStatus: "none",
  };
}

export function deriveSafeScaffoldTargetUiStatus(input: {
  selectedPath: string | null;
  lastCheck: SafeScaffoldTargetCheckResult | null;
  busy: boolean;
}): SafeScaffoldTargetUiStatus {
  if (input.busy) return "checking";
  if (!input.selectedPath) return "none";
  if (!input.lastCheck) return "none";
  return input.lastCheck.status;
}

export function folderSafetyLabel(input: {
  selectedPath: string | null;
  lastCheck: SafeScaffoldTargetCheckResult | null;
  stale: boolean;
  busy: boolean;
}): string {
  if (input.busy) return SAFE_SCAFFOLD_TARGET_UI_LABELS.checking;
  if (!input.selectedPath) return SAFE_SCAFFOLD_TARGET_FOLDER_SAFETY_LABELS["not-checked"];
  if (!input.lastCheck || input.stale) {
    return SAFE_SCAFFOLD_TARGET_FOLDER_SAFETY_LABELS["not-checked"];
  }
  return SAFE_SCAFFOLD_TARGET_FOLDER_SAFETY_LABELS[input.lastCheck.status];
}

/** Checklist: folder selected (path present). */
export function isSafeScaffoldTargetSelected(
  state: SafeScaffoldTargetState | null | undefined,
): boolean {
  return Boolean(state?.selectedPath);
}

/**
 * Checklist: confirmed empty/safe.
 * Only a non-stale Safe result counts (Caution does not unlock write readiness).
 */
export function isSafeScaffoldTargetConfirmedSafe(
  state: SafeScaffoldTargetState | null | undefined,
): boolean {
  if (!state?.selectedPath || !state.lastCheck || state.stale || state.busy) {
    return false;
  }
  return state.lastCheck.status === "safe";
}

/**
 * Stage 121: target allows file-tree preview (Safe or Caution, non-stale).
 * Blocked / stale / unchecked do not allow preview.
 */
export function isSafeScaffoldTargetAllowingPreview(
  state: SafeScaffoldTargetState | null | undefined,
): boolean {
  if (!state?.selectedPath || !state.lastCheck || state.stale || state.busy) {
    return false;
  }
  return (
    state.lastCheck.status === "safe" || state.lastCheck.status === "caution"
  );
}

export function normalizeSafeScaffoldTargetRecord(
  raw: SafeScaffoldTargetRecord | null | undefined,
): SafeScaffoldTargetRecord | null {
  if (!raw) return null;
  const selectedPath =
    typeof raw.selectedPath === "string" && raw.selectedPath.trim()
      ? raw.selectedPath.trim()
      : null;
  const lastCheck = normalizeCheckResult(raw.lastCheck);
  if (!selectedPath && !lastCheck) return null;
  return {
    selectedPath,
    lastCheck,
    stale: Boolean(raw.stale),
  };
}

function normalizeCheckResult(
  raw: SafeScaffoldTargetCheckResult | null | undefined,
): SafeScaffoldTargetCheckResult | null {
  if (!raw || typeof raw !== "object") return null;
  const status = raw.status;
  if (status !== "safe" && status !== "caution" && status !== "blocked") {
    return null;
  }
  const summary = raw.entrySummary;
  return {
    status,
    reasons: Array.isArray(raw.reasons)
      ? raw.reasons.filter((r) => typeof r === "string").slice(0, 40)
      : [],
    entrySummary: {
      totalEntries: summary?.totalEntries ?? 0,
      truncated: Boolean(summary?.truncated),
      entryNames: Array.isArray(summary?.entryNames)
        ? summary.entryNames.filter((n) => typeof n === "string").slice(0, 100)
        : [],
      fileCount: summary?.fileCount ?? 0,
      directoryCount: summary?.directoryCount ?? 0,
      otherCount: summary?.otherCount ?? 0,
      harmlessCount: summary?.harmlessCount ?? 0,
      unknownNonSourceCount: summary?.unknownNonSourceCount ?? 0,
      sourceLikeCount: summary?.sourceLikeCount ?? 0,
      projectMarkerNames: Array.isArray(summary?.projectMarkerNames)
        ? summary.projectMarkerNames.filter((n) => typeof n === "string")
        : [],
      generatedMarkerNames: Array.isArray(summary?.generatedMarkerNames)
        ? summary.generatedMarkerNames.filter((n) => typeof n === "string")
        : [],
    },
    checkedAt:
      typeof raw.checkedAt === "string" ? raw.checkedAt : new Date(0).toISOString(),
    selectedPath:
      typeof raw.selectedPath === "string" ? raw.selectedPath : "",
    resolvedPath:
      typeof raw.resolvedPath === "string" ? raw.resolvedPath : "",
    futureWriteReadiness: SAFE_SCAFFOLD_FUTURE_WRITE_READINESS,
  };
}
