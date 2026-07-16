/**
 * Stage 135: Local Coder Task Prompt types (prompt/export only).
 * Copy/paste into a local coder model. No AI calls. No file writes. No source reads.
 */

export type LocalCoderPromptStyle =
  | "small-local-coder"
  | "general-coder"
  | "strict-patch-planning-coder";

export type LocalCoderTaskPromptUiStatus =
  | "not-ready"
  | "ready"
  | "generated"
  | "stale"
  | "blocked";

export const LOCAL_CODER_PROMPT_STYLE_LABELS: Record<
  LocalCoderPromptStyle,
  string
> = {
  "small-local-coder": "Small local coder",
  "general-coder": "General coder",
  "strict-patch-planning-coder": "Strict patch-planning coder",
};

export const LOCAL_CODER_TASK_PROMPT_UI_LABELS: Record<
  LocalCoderTaskPromptUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready to generate coder prompt",
  generated: "Coder prompt generated",
  stale: "Stale",
  blocked: "Blocked",
};

export const LOCAL_CODER_TASK_PROMPT_COPY_PASTE_NOTE =
  "This prompt is for copy/paste into a local coder model. NTTC does not send it automatically." as const;

export const LOCAL_CODER_TASK_PROMPT_GUIDE_NOTE =
  "Local Coder Task Prompts turn an accepted local planner response into a bounded copy/paste prompt for a local coder model. NTTC does not send it automatically." as const;

export const LOCAL_CODER_TASK_PROMPT_NO_AI_NOTE =
  "NTTC does not call a model when you generate this prompt. Copy it into your local coder yourself." as const;

/** Persistable coder prompt metadata — no source file bodies. */
export interface LocalCoderTaskPromptRecord {
  generatedAt: string;
  promptStyle: LocalCoderPromptStyle;
  sourcePlannerResponseAcceptedAt: string | null;
  sourcePlannerResponseStatus: "Good" | "Caution" | "Blocked" | null;
  sourcePlannerResponseAnalyzedAt: string | null;
  recommendedTask: string | null;
  likelyFiles: string[];
  filesNotToTouch: string[];
  sourceScaffoldWriteWrittenAt: string | null;
  sourceScaffoldCreatedRelativePaths: string[];
  sourceFileTreeGeneratedAt: string | null;
  sourceFileTreeProposedPaths: string[];
  sourceBlueprintProjectType: string;
  sourceTargetFolderPath: string | null;
  markdown: string;
  warnings: string[];
  stale: boolean;
}

export interface LocalCoderTaskPromptOptions {
  promptStyle: LocalCoderPromptStyle;
}

export interface LocalCoderTaskPromptState {
  saved: LocalCoderTaskPromptRecord | null;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: LocalCoderTaskPromptUiStatus;
  readinessBlockedReasons: string[];
  canGenerate: boolean;
  options: LocalCoderTaskPromptOptions;
}

export function emptyLocalCoderTaskPromptOptions(): LocalCoderTaskPromptOptions {
  return { promptStyle: "general-coder" };
}

export function emptyLocalCoderTaskPromptState(): LocalCoderTaskPromptState {
  return {
    saved: null,
    busy: false,
    statusMessage:
      "Generate a Local Coder Task Prompt after accepting a Local Planner Response Import (copy/paste only — no AI call).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
    canGenerate: false,
    options: emptyLocalCoderTaskPromptOptions(),
  };
}

export function emptyLocalCoderTaskPromptTombstone(): LocalCoderTaskPromptRecord {
  return {
    generatedAt: "",
    promptStyle: "general-coder",
    sourcePlannerResponseAcceptedAt: null,
    sourcePlannerResponseStatus: null,
    sourcePlannerResponseAnalyzedAt: null,
    recommendedTask: null,
    likelyFiles: [],
    filesNotToTouch: [],
    sourceScaffoldWriteWrittenAt: null,
    sourceScaffoldCreatedRelativePaths: [],
    sourceFileTreeGeneratedAt: null,
    sourceFileTreeProposedPaths: [],
    sourceBlueprintProjectType: "unknown",
    sourceTargetFolderPath: null,
    markdown: "",
    warnings: [],
    stale: false,
  };
}

export function isLocalCoderTaskPromptCurrent(
  state: LocalCoderTaskPromptState | null | undefined,
): boolean {
  return Boolean(state?.saved && !state.saved.stale);
}

export function deriveLocalCoderTaskPromptUiStatus(input: {
  saved: LocalCoderTaskPromptRecord | null;
  busy: boolean;
  canGenerate: boolean;
}): LocalCoderTaskPromptUiStatus {
  if (input.busy) return "not-ready";
  if (input.saved?.stale) return "stale";
  if (input.saved) return "generated";
  if (input.canGenerate) return "ready";
  return "not-ready";
}

export function normalizeLocalCoderPromptStyle(
  raw: unknown,
): LocalCoderPromptStyle {
  if (
    raw === "small-local-coder" ||
    raw === "general-coder" ||
    raw === "strict-patch-planning-coder"
  ) {
    return raw;
  }
  return "general-coder";
}

function sliceStringList(raw: unknown, max = 80): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    .map((x) => x.trim().slice(0, 500))
    .slice(0, max);
}

export function normalizeLocalCoderTaskPromptRecord(
  raw: LocalCoderTaskPromptRecord | null | undefined,
): LocalCoderTaskPromptRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.markdown !== "string" || !raw.markdown.trim()) return null;
  if (typeof raw.generatedAt !== "string" || !raw.generatedAt.trim()) return null;

  const status =
    raw.sourcePlannerResponseStatus === "Good" ||
    raw.sourcePlannerResponseStatus === "Caution" ||
    raw.sourcePlannerResponseStatus === "Blocked"
      ? raw.sourcePlannerResponseStatus
      : null;

  return {
    generatedAt: raw.generatedAt,
    promptStyle: normalizeLocalCoderPromptStyle(raw.promptStyle),
    sourcePlannerResponseAcceptedAt:
      typeof raw.sourcePlannerResponseAcceptedAt === "string" &&
      raw.sourcePlannerResponseAcceptedAt.trim()
        ? raw.sourcePlannerResponseAcceptedAt
        : null,
    sourcePlannerResponseStatus: status,
    sourcePlannerResponseAnalyzedAt:
      typeof raw.sourcePlannerResponseAnalyzedAt === "string" &&
      raw.sourcePlannerResponseAnalyzedAt.trim()
        ? raw.sourcePlannerResponseAnalyzedAt
        : null,
    recommendedTask:
      typeof raw.recommendedTask === "string" && raw.recommendedTask.trim()
        ? raw.recommendedTask.trim().slice(0, 1000)
        : null,
    likelyFiles: sliceStringList(raw.likelyFiles),
    filesNotToTouch: sliceStringList(raw.filesNotToTouch),
    sourceScaffoldWriteWrittenAt:
      typeof raw.sourceScaffoldWriteWrittenAt === "string"
        ? raw.sourceScaffoldWriteWrittenAt
        : null,
    sourceScaffoldCreatedRelativePaths: sliceStringList(
      raw.sourceScaffoldCreatedRelativePaths,
    ),
    sourceFileTreeGeneratedAt:
      typeof raw.sourceFileTreeGeneratedAt === "string"
        ? raw.sourceFileTreeGeneratedAt
        : null,
    sourceFileTreeProposedPaths: sliceStringList(
      raw.sourceFileTreeProposedPaths,
    ),
    sourceBlueprintProjectType:
      typeof raw.sourceBlueprintProjectType === "string" &&
      raw.sourceBlueprintProjectType.trim()
        ? raw.sourceBlueprintProjectType.trim().slice(0, 120)
        : "unknown",
    sourceTargetFolderPath:
      typeof raw.sourceTargetFolderPath === "string"
        ? raw.sourceTargetFolderPath
        : null,
    markdown: raw.markdown.slice(0, 200_000),
    warnings: sliceStringList(raw.warnings, 40),
    stale: Boolean(raw.stale),
  };
}
