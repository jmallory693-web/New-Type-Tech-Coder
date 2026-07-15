/**
 * Stage 121: Safe Scaffold File Tree Preview types (in-memory only).
 * No file writes. No file contents. No AI.
 */

import type { BlueprintProjectType } from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";

export type SafeScaffoldFileTreeUiStatus =
  | "not-ready"
  | "ready"
  | "generated"
  | "stale"
  | "blocked";

export const SAFE_SCAFFOLD_FILE_TREE_UI_LABELS: Record<
  SafeScaffoldFileTreeUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready to preview",
  generated: "Preview generated",
  stale: "Stale",
  blocked: "Blocked",
};

export const SAFE_SCAFFOLD_FILE_TREE_PREVIEW_ONLY =
  "Preview only. No files have been created." as const;

export const SAFE_SCAFFOLD_FILE_TREE_CAUTION_WARNING =
  "Target folder is Caution, not Safe. Future write stages should require stronger confirmation or an empty folder.";

export const SAFE_SCAFFOLD_FILE_TREE_NO_CONTENTS_YET =
  "Scaffold file contents are not generated in this stage. Paths only.";

/** Persistable preview metadata — relative paths + markdown only. */
export interface SafeScaffoldFileTreePreviewRecord {
  generatedAt: string;
  sourceBlueprintImported: boolean;
  sourceBlueprintProjectType: BlueprintProjectType | string;
  sourceTaskCardCount: number;
  sourceTaskCardsGeneratedAt: string | null;
  sourceTargetFolderPath: string;
  sourceTargetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  proposedRelativePaths: string[];
  markdown: string;
  warnings: string[];
  blockedReasons: string[];
  stale: boolean;
}

export interface SafeScaffoldFileTreePreviewState {
  saved: SafeScaffoldFileTreePreviewRecord | null;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: SafeScaffoldFileTreeUiStatus;
  /** Why generate is blocked when uiStatus is not-ready or blocked. */
  readinessBlockedReasons: string[];
}

export function emptySafeScaffoldFileTreePreviewState(): SafeScaffoldFileTreePreviewState {
  return {
    saved: null,
    busy: false,
    statusMessage:
      "Generate a Safe Scaffold File Tree Preview once Blueprint, task cards, and a Safe/Caution target folder are ready (paths only — no files are created).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
  };
}

export function isSafeScaffoldFileTreePreviewCurrent(
  state: SafeScaffoldFileTreePreviewState | null | undefined,
): boolean {
  return Boolean(state?.saved && !state.saved.stale);
}

/**
 * Validate a proposed relative path. Returns null if valid, else a block reason.
 */
export function validateProposedRelativePath(raw: string): string | null {
  const path = raw.trim().replace(/\\/g, "/");
  if (!path) return "Empty path.";
  if (path.includes("\0")) return "Path contains null bytes.";
  if (/^[a-zA-Z]:/.test(path) || /^[a-zA-Z]:/.test(raw.trim())) {
    return `Absolute/drive path not allowed: ${raw}`;
  }
  if (path.startsWith("/") || path.startsWith("\\") || raw.trim().startsWith("\\")) {
    return `Path must be relative (no leading slash): ${raw}`;
  }
  if (path.includes("~") || raw.includes("~")) {
    return `Home shortcut (~) not allowed: ${raw}`;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.some((s) => s === "..")) {
    return `Path traversal (..) not allowed: ${raw}`;
  }
  const lowerSegments = segments.map((s) => s.toLowerCase());
  const blockedSeg = new Set([
    "node_modules",
    ".git",
    "release",
    "dist",
    "build",
    "out",
    ".next",
    "coverage",
  ]);
  for (const seg of lowerSegments) {
    if (blockedSeg.has(seg)) {
      return `Blocked path segment (${seg}): ${raw}`;
    }
  }
  const base = segments[segments.length - 1]?.toLowerCase() ?? "";
  const secretNames = new Set([
    ".env",
    ".env.local",
    ".env.production",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "private.key",
    "private.pem",
    "secrets.json",
    "credentials.json",
  ]);
  if (secretNames.has(base) || base.endsWith(".pem") || base.endsWith(".key")) {
    return `Secret-like file not allowed: ${raw}`;
  }
  const systemish = new Set([
    "windows",
    "system32",
    "program files",
    "programdata",
  ]);
  for (const seg of lowerSegments) {
    if (systemish.has(seg)) {
      return `System-like path not allowed: ${raw}`;
    }
  }
  return null;
}

export function normalizeSafeScaffoldFileTreePreviewRecord(
  raw: SafeScaffoldFileTreePreviewRecord | null | undefined,
): SafeScaffoldFileTreePreviewRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;
  const paths = Array.isArray(raw.proposedRelativePaths)
    ? raw.proposedRelativePaths
        .filter((p) => typeof p === "string")
        .map((p) => p.trim().replace(/\\/g, "/"))
        .filter(Boolean)
        .slice(0, 200)
    : [];
  // Drop any historically invalid paths; keep preview if remaining.
  const safePaths = paths.filter((p) => validateProposedRelativePath(p) === null);
  if (safePaths.length === 0) return null;

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
    proposedRelativePaths: safePaths,
    markdown: raw.markdown.slice(0, 80_000),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w) => typeof w === "string").slice(0, 40)
      : [],
    blockedReasons: Array.isArray(raw.blockedReasons)
      ? raw.blockedReasons.filter((w) => typeof w === "string").slice(0, 40)
      : [],
    stale: Boolean(raw.stale),
  };
}

export function deriveSafeScaffoldFileTreeUiStatus(input: {
  saved: SafeScaffoldFileTreePreviewRecord | null;
  busy: boolean;
  canGenerate: boolean;
  hardBlocked: boolean;
}): SafeScaffoldFileTreeUiStatus {
  if (input.busy) return "not-ready";
  if (input.hardBlocked && !input.saved) return "blocked";
  if (input.saved?.stale) return "stale";
  if (input.saved) return "generated";
  if (input.hardBlocked) return "blocked";
  if (input.canGenerate) return "ready";
  return "not-ready";
}
