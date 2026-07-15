/**
 * Stage 125: Safe Scaffold Write Manifest Preview types (in-memory only).
 * Deterministic future-write plan. No file writes. No AI. No source reads.
 */

import type { BlueprintProjectType } from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";

export type SafeScaffoldWriteManifestUiStatus =
  | "not-ready"
  | "ready"
  | "generated"
  | "stale"
  | "blocked";

export type SafeScaffoldWriteManifestPathStatus =
  | "ready-to-create"
  | "missing-content"
  | "blocked-path"
  | "blocked-content"
  | "directory-only"
  | "later-stage";

export const SAFE_SCAFFOLD_WRITE_MANIFEST_UI_LABELS: Record<
  SafeScaffoldWriteManifestUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready to preview manifest",
  generated: "Manifest preview generated",
  stale: "Stale",
  blocked: "Blocked",
};

export const SAFE_SCAFFOLD_WRITE_MANIFEST_PREVIEW_ONLY =
  "Preview only. No files have been created." as const;

export const SAFE_SCAFFOLD_WRITE_MANIFEST_CAUTION_WARNING =
  "Target folder is Caution, not Safe. Future write stages should require stronger confirmation or an empty folder.";

export const SAFE_SCAFFOLD_WRITE_MANIFEST_FUTURE_CONFIRMATION =
  "Future write confirmation is not enabled yet. A later stage will require explicit user confirmation before any file is created.";

export const SAFE_SCAFFOLD_WRITE_MANIFEST_REQUIRED_CONFIRMATION =
  "I understand NTTC will create new scaffold files in the selected empty/safe target folder and will not run commands or install packages.";

export const SAFE_SCAFFOLD_WRITE_MANIFEST_GUIDE_NOTE =
  "Safe Scaffold Write Manifest Preview lists exactly which files a future write stage would create. It is preview-only and does not create files.";

export interface SafeScaffoldWriteManifestReadyEntry {
  relativePath: string;
  contentStatus: "templated";
  safety: "passed";
  pathStatus: "ready-to-create";
}

export interface SafeScaffoldWriteManifestNotReadyEntry {
  relativePath: string;
  reason: string;
  pathStatus: Exclude<
    SafeScaffoldWriteManifestPathStatus,
    "ready-to-create"
  >;
}

/** Persistable manifest preview metadata — no source file bodies. */
export interface SafeScaffoldWriteManifestPreviewRecord {
  generatedAt: string;
  sourceBlueprintImported: boolean;
  sourceBlueprintProjectType: BlueprintProjectType | string;
  sourceTaskCardCount: number;
  sourceTaskCardsGeneratedAt: string | null;
  sourceTargetFolderPath: string;
  sourceTargetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  sourceFileTreeGeneratedAt: string;
  sourceFileTreeFingerprint: string;
  sourceFileContentGeneratedAt: string;
  sourceFileContentFingerprint: string;
  proposedRelativePaths: string[];
  readyToCreate: SafeScaffoldWriteManifestReadyEntry[];
  notReady: SafeScaffoldWriteManifestNotReadyEntry[];
  markdown: string;
  warnings: string[];
  blockedReasons: string[];
  stale: boolean;
}

export interface SafeScaffoldWriteManifestPreviewState {
  saved: SafeScaffoldWriteManifestPreviewRecord | null;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: SafeScaffoldWriteManifestUiStatus;
  readinessBlockedReasons: string[];
}

export function emptySafeScaffoldWriteManifestPreviewState(): SafeScaffoldWriteManifestPreviewState {
  return {
    saved: null,
    busy: false,
    statusMessage:
      "Generate a Safe Scaffold Write Manifest Preview after current File Tree and File Content previews exist (preview only — no files are created).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
  };
}

export function isSafeScaffoldWriteManifestPreviewCurrent(
  state: SafeScaffoldWriteManifestPreviewState | null | undefined,
): boolean {
  return Boolean(state?.saved && !state.saved.stale);
}

export function fingerprintFileContentPreview(input: {
  generatedAt: string;
  proposedRelativePaths: string[];
  templatedRelativePaths: string[];
  filesWithoutContents: string[];
}): string {
  const proposed = [...input.proposedRelativePaths]
    .map((p) => p.replace(/\\/g, "/"))
    .sort()
    .join("|");
  const templated = [...input.templatedRelativePaths]
    .map((p) => p.replace(/\\/g, "/"))
    .sort()
    .join("|");
  const without = [...input.filesWithoutContents]
    .map((p) => p.replace(/\\/g, "/"))
    .sort()
    .join("|");
  return `${input.generatedAt}::${proposed}::${templated}::${without}`;
}

export function deriveSafeScaffoldWriteManifestUiStatus(input: {
  saved: SafeScaffoldWriteManifestPreviewRecord | null;
  busy: boolean;
  canGenerate: boolean;
  hardBlocked: boolean;
}): SafeScaffoldWriteManifestUiStatus {
  if (input.busy) return "not-ready";
  if (input.hardBlocked && !input.saved) return "blocked";
  if (input.saved?.stale) return "stale";
  if (input.saved) return "generated";
  if (input.hardBlocked) return "blocked";
  if (input.canGenerate) return "ready";
  return "not-ready";
}

export function emptyWriteManifestPreviewTombstone(): SafeScaffoldWriteManifestPreviewRecord {
  return {
    generatedAt: "",
    sourceBlueprintImported: false,
    sourceBlueprintProjectType: "unknown",
    sourceTaskCardCount: 0,
    sourceTaskCardsGeneratedAt: null,
    sourceTargetFolderPath: "",
    sourceTargetSafetyStatus: "blocked",
    sourceFileTreeGeneratedAt: "",
    sourceFileTreeFingerprint: "",
    sourceFileContentGeneratedAt: "",
    sourceFileContentFingerprint: "",
    proposedRelativePaths: [],
    readyToCreate: [],
    notReady: [],
    markdown: "",
    warnings: [],
    blockedReasons: [],
    stale: false,
  };
}

export function normalizeSafeScaffoldWriteManifestPreviewRecord(
  raw: SafeScaffoldWriteManifestPreviewRecord | null | undefined,
): SafeScaffoldWriteManifestPreviewRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;

  const status = raw.sourceTargetSafetyStatus;
  if (status !== "safe" && status !== "caution" && status !== "blocked") {
    return null;
  }

  const readyToCreate = Array.isArray(raw.readyToCreate)
    ? raw.readyToCreate
        .filter(
          (e) =>
            e &&
            typeof e.relativePath === "string" &&
            e.relativePath.trim().length > 0,
        )
        .map((e) => ({
          relativePath: e.relativePath.trim().replace(/\\/g, "/"),
          contentStatus: "templated" as const,
          safety: "passed" as const,
          pathStatus: "ready-to-create" as const,
        }))
        .slice(0, 200)
    : [];

  const notReady = Array.isArray(raw.notReady)
    ? raw.notReady
        .filter(
          (e) =>
            e &&
            typeof e.relativePath === "string" &&
            typeof e.reason === "string",
        )
        .map((e) => {
          const pathStatus =
            e.pathStatus === "missing-content" ||
            e.pathStatus === "blocked-path" ||
            e.pathStatus === "blocked-content" ||
            e.pathStatus === "directory-only" ||
            e.pathStatus === "later-stage"
              ? e.pathStatus
              : ("later-stage" as const);
          return {
            relativePath: e.relativePath.trim().replace(/\\/g, "/"),
            reason: e.reason.slice(0, 500),
            pathStatus,
          };
        })
        .slice(0, 200)
    : [];

  if (readyToCreate.length === 0 && notReady.length === 0) return null;

  return {
    generatedAt:
      typeof raw.generatedAt === "string"
        ? raw.generatedAt
        : new Date(0).toISOString(),
    sourceBlueprintImported: Boolean(raw.sourceBlueprintImported),
    sourceBlueprintProjectType:
      typeof raw.sourceBlueprintProjectType === "string"
        ? raw.sourceBlueprintProjectType
        : "unknown",
    sourceTaskCardCount: raw.sourceTaskCardCount ?? 0,
    sourceTaskCardsGeneratedAt:
      typeof raw.sourceTaskCardsGeneratedAt === "string"
        ? raw.sourceTaskCardsGeneratedAt
        : null,
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
    proposedRelativePaths: Array.isArray(raw.proposedRelativePaths)
      ? raw.proposedRelativePaths
          .filter((p) => typeof p === "string")
          .map((p) => p.replace(/\\/g, "/"))
          .slice(0, 200)
      : [],
    readyToCreate,
    notReady,
    markdown: raw.markdown.slice(0, 200_000),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w) => typeof w === "string").slice(0, 40)
      : [],
    blockedReasons: Array.isArray(raw.blockedReasons)
      ? raw.blockedReasons.filter((w) => typeof w === "string").slice(0, 40)
      : [],
    stale: Boolean(raw.stale),
  };
}
