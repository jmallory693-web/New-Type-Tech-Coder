/**
 * Stage 123: Safe Scaffold File Content Preview types (in-memory only).
 * Deterministic template contents. No file writes. No AI. No source reads.
 */

import type { BlueprintProjectType } from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";

export type SafeScaffoldFileContentUiStatus =
  | "not-ready"
  | "ready"
  | "generated"
  | "stale"
  | "blocked";

export const SAFE_SCAFFOLD_FILE_CONTENT_UI_LABELS: Record<
  SafeScaffoldFileContentUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready to preview contents",
  generated: "Content preview generated",
  stale: "Stale",
  blocked: "Blocked",
};

export const SAFE_SCAFFOLD_FILE_CONTENT_PREVIEW_ONLY =
  "Preview only. No files have been created." as const;

export const SAFE_SCAFFOLD_FILE_CONTENT_CAUTION_WARNING =
  "Target folder is Caution, not Safe. Future write stages should require stronger confirmation or an empty folder.";

export const SAFE_SCAFFOLD_FILE_CONTENT_NO_RUN =
  "NTTC will not run these scripts automatically." as const;

export const SAFE_SCAFFOLD_FILE_CONTENT_GUIDE_NOTE =
  "Safe Scaffold File Content Preview shows deterministic starter contents in memory only. It does not create files or run package scripts.";

export interface SafeScaffoldFileContentFileEntry {
  relativePath: string;
  language: string;
  content: string;
}

/** Persistable preview metadata — generated template contents only. */
export interface SafeScaffoldFileContentPreviewRecord {
  generatedAt: string;
  sourceBlueprintImported: boolean;
  sourceBlueprintProjectType: BlueprintProjectType | string;
  sourceTaskCardCount: number;
  sourceTaskCardsGeneratedAt: string | null;
  sourceTargetFolderPath: string;
  sourceTargetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  sourceFileTreeGeneratedAt: string;
  sourceFileTreeFingerprint: string;
  proposedRelativePaths: string[];
  templatedFiles: SafeScaffoldFileContentFileEntry[];
  filesWithoutContents: string[];
  markdown: string;
  warnings: string[];
  blockedReasons: string[];
  stale: boolean;
}

export interface SafeScaffoldFileContentPreviewState {
  saved: SafeScaffoldFileContentPreviewRecord | null;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: SafeScaffoldFileContentUiStatus;
  readinessBlockedReasons: string[];
}

export function emptySafeScaffoldFileContentPreviewState(): SafeScaffoldFileContentPreviewState {
  return {
    saved: null,
    busy: false,
    statusMessage:
      "Generate a Safe Scaffold File Content Preview after a current File Tree Preview exists (deterministic templates in memory only — no files are created).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
  };
}

export function isSafeScaffoldFileContentPreviewCurrent(
  state: SafeScaffoldFileContentPreviewState | null | undefined,
): boolean {
  return Boolean(state?.saved && !state.saved.stale);
}

export function fingerprintFileTreePreview(input: {
  generatedAt: string;
  proposedRelativePaths: string[];
}): string {
  const paths = [...input.proposedRelativePaths]
    .map((p) => p.replace(/\\/g, "/"))
    .sort()
    .join("|");
  return `${input.generatedAt}::${paths}`;
}

export function deriveSafeScaffoldFileContentUiStatus(input: {
  saved: SafeScaffoldFileContentPreviewRecord | null;
  busy: boolean;
  canGenerate: boolean;
  hardBlocked: boolean;
}): SafeScaffoldFileContentUiStatus {
  if (input.busy) return "not-ready";
  if (input.hardBlocked && !input.saved) return "blocked";
  if (input.saved?.stale) return "stale";
  if (input.saved) return "generated";
  if (input.hardBlocked) return "blocked";
  if (input.canGenerate) return "ready";
  return "not-ready";
}

export function emptyContentPreviewTombstone(): SafeScaffoldFileContentPreviewRecord {
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
    proposedRelativePaths: [],
    templatedFiles: [],
    filesWithoutContents: [],
    markdown: "",
    warnings: [],
    blockedReasons: [],
    stale: false,
  };
}

export function normalizeSafeScaffoldFileContentPreviewRecord(
  raw: SafeScaffoldFileContentPreviewRecord | null | undefined,
): SafeScaffoldFileContentPreviewRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;
  const templatedFiles = Array.isArray(raw.templatedFiles)
    ? raw.templatedFiles
        .filter(
          (f) =>
            f &&
            typeof f.relativePath === "string" &&
            typeof f.content === "string",
        )
        .map((f) => ({
          relativePath: f.relativePath.trim().replace(/\\/g, "/"),
          language: typeof f.language === "string" ? f.language : "text",
          content: f.content.slice(0, 40_000),
        }))
        .slice(0, 80)
    : [];
  if (templatedFiles.length === 0 && !(raw.filesWithoutContents?.length > 0)) {
    return null;
  }

  const status = raw.sourceTargetSafetyStatus;
  if (status !== "safe" && status !== "caution" && status !== "blocked") {
    return null;
  }

  return {
    generatedAt:
      typeof raw.generatedAt === "string" ? raw.generatedAt : new Date(0).toISOString(),
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
    proposedRelativePaths: Array.isArray(raw.proposedRelativePaths)
      ? raw.proposedRelativePaths
          .filter((p) => typeof p === "string")
          .map((p) => p.replace(/\\/g, "/"))
          .slice(0, 200)
      : [],
    templatedFiles,
    filesWithoutContents: Array.isArray(raw.filesWithoutContents)
      ? raw.filesWithoutContents
          .filter((p) => typeof p === "string")
          .map((p) => p.replace(/\\/g, "/"))
          .slice(0, 200)
      : [],
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
