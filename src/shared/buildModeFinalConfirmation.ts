/**
 * Stage 127: Safe Scaffold Final Confirmation Gate types (metadata only).
 * Records readiness for a future write stage. No file writes. No AI. No source reads.
 */

import type { BlueprintProjectType } from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";

export type SafeScaffoldFinalConfirmationUiStatus =
  | "not-ready"
  | "ready"
  | "confirmed"
  | "stale"
  | "blocked";

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_UI_LABELS: Record<
  SafeScaffoldFinalConfirmationUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready for confirmation",
  confirmed: "Confirmed for future write stage",
  stale: "Stale",
  blocked: "Blocked",
};

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_RECORDED =
  "Final confirmation recorded for future write stage. No files have been created." as const;

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_STILL_DISABLED =
  "Safe Scaffold writing is still disabled in this version." as const;

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_STALE_MESSAGE =
  "Final confirmation is stale. Regenerate previews and confirm again before any future write stage." as const;

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_BOUNDARIES =
  "I understand that a future Safe Scaffold write will create new files only in the selected target folder, will not overwrite existing files, will not edit existing files, will not run commands, will not install packages, and will not apply patches." as const;

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_STAGE127 =
  "I understand Stage 127 does not create files. It only records readiness for a future write stage." as const;

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_CAUTION =
  "I understand the selected target folder is Caution, not Safe, and a future write stage should require stronger confirmation or an empty folder." as const;

export const SAFE_SCAFFOLD_FINAL_CONFIRMATION_GUIDE_NOTE =
  "Safe Scaffold Final Confirmation records readiness for a future write stage. It still does not create files." as const;

export const SAFE_SCAFFOLD_WRITE_FILES_DISABLED_LABEL =
  "Write Files — Disabled until next stage" as const;

export interface SafeScaffoldFinalConfirmationAcknowledgements {
  futureWriteBoundaries: boolean;
  stage127NoWrite: boolean;
  cautionTarget: boolean;
}

/** Persistable confirmation metadata — no source file bodies. */
export interface SafeScaffoldFinalConfirmationRecord {
  confirmedAt: string;
  sourceBlueprintImported: boolean;
  sourceBlueprintProjectType: BlueprintProjectType | string;
  sourceTaskCardCount: number;
  sourceTargetFolderPath: string;
  sourceTargetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  sourceFileTreeGeneratedAt: string;
  sourceFileTreeFingerprint: string;
  sourceFileContentGeneratedAt: string;
  sourceFileContentFingerprint: string;
  sourceWriteManifestGeneratedAt: string;
  sourceWriteManifestFingerprint: string;
  readyToCreateCount: number;
  notReadyCount: number;
  acknowledgements: SafeScaffoldFinalConfirmationAcknowledgements;
  markdown: string;
  warnings: string[];
  stale: boolean;
}

export interface SafeScaffoldFinalConfirmationState {
  saved: SafeScaffoldFinalConfirmationRecord | null;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: SafeScaffoldFinalConfirmationUiStatus;
  readinessBlockedReasons: string[];
  requiresCautionAck: boolean;
}

export function emptySafeScaffoldFinalConfirmationState(): SafeScaffoldFinalConfirmationState {
  return {
    saved: null,
    busy: false,
    statusMessage:
      "Record Safe Scaffold Final Confirmation after a current Write Manifest Preview exists (readiness only — no files are created).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
    requiresCautionAck: false,
  };
}

export function isSafeScaffoldFinalConfirmationCurrent(
  state: SafeScaffoldFinalConfirmationState | null | undefined,
): boolean {
  return Boolean(state?.saved && !state.saved.stale);
}

export function fingerprintWriteManifestPreview(input: {
  generatedAt: string;
  readyRelativePaths: string[];
  notReadyRelativePaths: string[];
}): string {
  const ready = [...input.readyRelativePaths]
    .map((p) => p.replace(/\\/g, "/"))
    .sort()
    .join("|");
  const notReady = [...input.notReadyRelativePaths]
    .map((p) => p.replace(/\\/g, "/"))
    .sort()
    .join("|");
  return `${input.generatedAt}::${ready}::${notReady}`;
}

export function deriveSafeScaffoldFinalConfirmationUiStatus(input: {
  saved: SafeScaffoldFinalConfirmationRecord | null;
  busy: boolean;
  canConfirm: boolean;
  hardBlocked: boolean;
}): SafeScaffoldFinalConfirmationUiStatus {
  if (input.busy) return "not-ready";
  if (input.saved?.stale) return "stale";
  if (input.saved) return "confirmed";
  if (input.hardBlocked) return "blocked";
  if (input.canConfirm) return "ready";
  return "not-ready";
}

export function emptyFinalConfirmationTombstone(): SafeScaffoldFinalConfirmationRecord {
  return {
    confirmedAt: "",
    sourceBlueprintImported: false,
    sourceBlueprintProjectType: "unknown",
    sourceTaskCardCount: 0,
    sourceTargetFolderPath: "",
    sourceTargetSafetyStatus: "blocked",
    sourceFileTreeGeneratedAt: "",
    sourceFileTreeFingerprint: "",
    sourceFileContentGeneratedAt: "",
    sourceFileContentFingerprint: "",
    sourceWriteManifestGeneratedAt: "",
    sourceWriteManifestFingerprint: "",
    readyToCreateCount: 0,
    notReadyCount: 0,
    acknowledgements: {
      futureWriteBoundaries: false,
      stage127NoWrite: false,
      cautionTarget: false,
    },
    markdown: "",
    warnings: [],
    stale: false,
  };
}

export function normalizeSafeScaffoldFinalConfirmationRecord(
  raw: SafeScaffoldFinalConfirmationRecord | null | undefined,
): SafeScaffoldFinalConfirmationRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;
  if (typeof raw.confirmedAt !== "string" || !raw.confirmedAt.trim()) {
    return null;
  }

  const status = raw.sourceTargetSafetyStatus;
  if (status !== "safe" && status !== "caution" && status !== "blocked") {
    return null;
  }

  const acks = raw.acknowledgements;
  if (!acks || typeof acks !== "object") return null;

  return {
    confirmedAt: raw.confirmedAt,
    sourceBlueprintImported: Boolean(raw.sourceBlueprintImported),
    sourceBlueprintProjectType:
      typeof raw.sourceBlueprintProjectType === "string"
        ? raw.sourceBlueprintProjectType
        : "unknown",
    sourceTaskCardCount: raw.sourceTaskCardCount ?? 0,
    sourceTargetFolderPath:
      typeof raw.sourceTargetFolderPath === "string"
        ? raw.sourceTargetFolderPath
        : "",
    sourceTargetSafetyStatus: status,
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
    readyToCreateCount: raw.readyToCreateCount ?? 0,
    notReadyCount: raw.notReadyCount ?? 0,
    acknowledgements: {
      futureWriteBoundaries: Boolean(acks.futureWriteBoundaries),
      stage127NoWrite: Boolean(acks.stage127NoWrite),
      cautionTarget: Boolean(acks.cautionTarget),
    },
    markdown: raw.markdown.slice(0, 200_000),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w) => typeof w === "string").slice(0, 40)
      : [],
    stale: Boolean(raw.stale),
  };
}
