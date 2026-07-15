/**
 * Stage 131: Local Planner Build Brief types (prompt/export only).
 * Copy/paste into a local planner model. No AI calls. No file writes. No source reads.
 */

export type LocalPlannerBuildBriefMode = "pre-write" | "post-write";

export type LocalPlannerStrictness =
  | "smallest-safe"
  | "normal"
  | "ambitious-bounded";

export type LocalPlannerTargetModelType =
  | "small-slm"
  | "general-local-llm"
  | "coder-as-planner";

export type LocalPlannerBuildBriefUiStatus =
  | "not-ready"
  | "ready"
  | "generated"
  | "stale"
  | "blocked";

export const LOCAL_PLANNER_STRICTNESS_LABELS: Record<
  LocalPlannerStrictness,
  string
> = {
  "smallest-safe": "Smallest safe next step",
  normal: "Normal next step",
  "ambitious-bounded": "Ambitious but still bounded",
};

export const LOCAL_PLANNER_TARGET_MODEL_LABELS: Record<
  LocalPlannerTargetModelType,
  string
> = {
  "small-slm": "Small SLM",
  "general-local-llm": "General local LLM",
  "coder-as-planner": "Coder model acting as planner",
};

export const LOCAL_PLANNER_BUILD_BRIEF_UI_LABELS: Record<
  LocalPlannerBuildBriefUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready to generate brief",
  generated: "Planner brief generated",
  stale: "Stale",
  blocked: "Blocked",
};

export const LOCAL_PLANNER_BUILD_BRIEF_COPY_PASTE_NOTE =
  "This brief is for copy/paste into a local planner model. NTTC does not send it automatically." as const;

export const LOCAL_PLANNER_BUILD_BRIEF_GUIDE_NOTE =
  "Local Planner Build Briefs help test local LLM/SLM planning. NTTC generates a copy/paste prompt but does not send project data to a model automatically." as const;

export const LOCAL_PLANNER_BUILD_BRIEF_NO_AI_NOTE =
  "NTTC does not call a model when you generate this brief. Copy it into your local planner yourself." as const;

/** Persistable brief metadata — no source file bodies. */
export interface LocalPlannerBuildBriefRecord {
  generatedAt: string;
  mode: LocalPlannerBuildBriefMode;
  strictness: LocalPlannerStrictness;
  targetLocalModelType: LocalPlannerTargetModelType;
  selectedTaskId: string | null;
  selectedTaskTitle: string | null;
  sourceBlueprintImported: boolean;
  sourceBlueprintProjectType: string;
  sourceTaskCardCount: number;
  sourceTaskCardsGeneratedAt: string | null;
  sourceTargetFolderPath: string | null;
  sourceTargetSafetyStatus: string | null;
  sourceFileTreeGeneratedAt: string | null;
  sourceFileContentGeneratedAt: string | null;
  sourceWriteManifestGeneratedAt: string | null;
  sourceFinalConfirmationConfirmedAt: string | null;
  sourceWriteResultWrittenAt: string | null;
  sourceCreatedRelativePaths: string[];
  sourceProposedRelativePaths: string[];
  markdown: string;
  warnings: string[];
  stale: boolean;
}

export interface LocalPlannerBuildBriefOptions {
  strictness: LocalPlannerStrictness;
  targetLocalModelType: LocalPlannerTargetModelType;
  selectedTaskId: string | null;
}

export interface LocalPlannerBuildBriefState {
  saved: LocalPlannerBuildBriefRecord | null;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: LocalPlannerBuildBriefUiStatus;
  readinessBlockedReasons: string[];
  canGenerate: boolean;
  options: LocalPlannerBuildBriefOptions;
  availableMode: LocalPlannerBuildBriefMode | null;
}

export function emptyLocalPlannerBuildBriefOptions(): LocalPlannerBuildBriefOptions {
  return {
    strictness: "smallest-safe",
    targetLocalModelType: "general-local-llm",
    selectedTaskId: null,
  };
}

export function emptyLocalPlannerBuildBriefState(): LocalPlannerBuildBriefState {
  return {
    saved: null,
    busy: false,
    statusMessage:
      "Generate a Local Planner Build Brief from Blueprint, task cards, and scaffold preview/write metadata (copy/paste only — no AI call).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
    canGenerate: false,
    options: emptyLocalPlannerBuildBriefOptions(),
    availableMode: null,
  };
}

export function emptyLocalPlannerBuildBriefTombstone(): LocalPlannerBuildBriefRecord {
  return {
    generatedAt: "",
    mode: "pre-write",
    strictness: "smallest-safe",
    targetLocalModelType: "general-local-llm",
    selectedTaskId: null,
    selectedTaskTitle: null,
    sourceBlueprintImported: false,
    sourceBlueprintProjectType: "unknown",
    sourceTaskCardCount: 0,
    sourceTaskCardsGeneratedAt: null,
    sourceTargetFolderPath: null,
    sourceTargetSafetyStatus: null,
    sourceFileTreeGeneratedAt: null,
    sourceFileContentGeneratedAt: null,
    sourceWriteManifestGeneratedAt: null,
    sourceFinalConfirmationConfirmedAt: null,
    sourceWriteResultWrittenAt: null,
    sourceCreatedRelativePaths: [],
    sourceProposedRelativePaths: [],
    markdown: "",
    warnings: [],
    stale: false,
  };
}

export function isLocalPlannerBuildBriefCurrent(
  state: LocalPlannerBuildBriefState | null | undefined,
): boolean {
  return Boolean(state?.saved && !state.saved.stale);
}

export function deriveLocalPlannerBuildBriefUiStatus(input: {
  saved: LocalPlannerBuildBriefRecord | null;
  busy: boolean;
  canGenerate: boolean;
}): LocalPlannerBuildBriefUiStatus {
  if (input.busy) return "not-ready";
  if (input.saved?.stale) return "stale";
  if (input.saved) return "generated";
  if (input.canGenerate) return "ready";
  return "not-ready";
}

export function normalizeLocalPlannerStrictness(
  raw: unknown,
): LocalPlannerStrictness {
  if (raw === "smallest-safe" || raw === "normal" || raw === "ambitious-bounded") {
    return raw;
  }
  return "smallest-safe";
}

export function normalizeLocalPlannerTargetModelType(
  raw: unknown,
): LocalPlannerTargetModelType {
  if (
    raw === "small-slm" ||
    raw === "general-local-llm" ||
    raw === "coder-as-planner"
  ) {
    return raw;
  }
  return "general-local-llm";
}

export function normalizeLocalPlannerBuildBriefRecord(
  raw: LocalPlannerBuildBriefRecord | null | undefined,
): LocalPlannerBuildBriefRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;
  if (typeof raw.generatedAt !== "string" || !raw.generatedAt.trim()) {
    return null;
  }
  const mode: LocalPlannerBuildBriefMode =
    raw.mode === "post-write" ? "post-write" : "pre-write";

  return {
    generatedAt: raw.generatedAt,
    mode,
    strictness: normalizeLocalPlannerStrictness(raw.strictness),
    targetLocalModelType: normalizeLocalPlannerTargetModelType(
      raw.targetLocalModelType,
    ),
    selectedTaskId:
      typeof raw.selectedTaskId === "string" && raw.selectedTaskId.trim()
        ? raw.selectedTaskId.trim()
        : null,
    selectedTaskTitle:
      typeof raw.selectedTaskTitle === "string" && raw.selectedTaskTitle.trim()
        ? raw.selectedTaskTitle.trim().slice(0, 300)
        : null,
    sourceBlueprintImported: Boolean(raw.sourceBlueprintImported),
    sourceBlueprintProjectType:
      typeof raw.sourceBlueprintProjectType === "string" &&
      raw.sourceBlueprintProjectType.trim()
        ? raw.sourceBlueprintProjectType.trim().slice(0, 120)
        : "unknown",
    sourceTaskCardCount: Math.max(
      0,
      Math.min(500, Number(raw.sourceTaskCardCount) || 0),
    ),
    sourceTaskCardsGeneratedAt:
      typeof raw.sourceTaskCardsGeneratedAt === "string"
        ? raw.sourceTaskCardsGeneratedAt
        : null,
    sourceTargetFolderPath:
      typeof raw.sourceTargetFolderPath === "string"
        ? raw.sourceTargetFolderPath
        : null,
    sourceTargetSafetyStatus:
      typeof raw.sourceTargetSafetyStatus === "string"
        ? raw.sourceTargetSafetyStatus
        : null,
    sourceFileTreeGeneratedAt:
      typeof raw.sourceFileTreeGeneratedAt === "string"
        ? raw.sourceFileTreeGeneratedAt
        : null,
    sourceFileContentGeneratedAt:
      typeof raw.sourceFileContentGeneratedAt === "string"
        ? raw.sourceFileContentGeneratedAt
        : null,
    sourceWriteManifestGeneratedAt:
      typeof raw.sourceWriteManifestGeneratedAt === "string"
        ? raw.sourceWriteManifestGeneratedAt
        : null,
    sourceFinalConfirmationConfirmedAt:
      typeof raw.sourceFinalConfirmationConfirmedAt === "string"
        ? raw.sourceFinalConfirmationConfirmedAt
        : null,
    sourceWriteResultWrittenAt:
      typeof raw.sourceWriteResultWrittenAt === "string"
        ? raw.sourceWriteResultWrittenAt
        : null,
    sourceCreatedRelativePaths: Array.isArray(raw.sourceCreatedRelativePaths)
      ? raw.sourceCreatedRelativePaths
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.replace(/\\/g, "/"))
          .slice(0, 500)
      : [],
    sourceProposedRelativePaths: Array.isArray(raw.sourceProposedRelativePaths)
      ? raw.sourceProposedRelativePaths
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.replace(/\\/g, "/"))
          .slice(0, 500)
      : [],
    markdown: raw.markdown.slice(0, 200_000),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings
          .filter((w): w is string => typeof w === "string")
          .slice(0, 50)
      : [],
    stale: Boolean(raw.stale),
  };
}
