/**
 * Stage 133: Local Planner Response Import types (import/parse/review only).
 * Treats local planner output as an untrusted claim. No AI. No FS writes. No source reads.
 */

import type {
  LocalPlannerBuildBriefMode,
  LocalPlannerStrictness,
  LocalPlannerTargetModelType,
} from "./buildModeLocalPlannerBuildBrief";

export type LocalPlannerResponseStatus = "Good" | "Caution" | "Blocked";

export type LocalPlannerResponseDecision =
  | "Ready for coder prompt prep"
  | "Needs revision"
  | "Blocked until corrected";

export type LocalPlannerResponseUiStatus =
  | "not-ready"
  | "ready"
  | "analyzed"
  | "stale"
  | "blocked";

export const LOCAL_PLANNER_RESPONSE_UI_LABELS: Record<
  LocalPlannerResponseUiStatus,
  string
> = {
  "not-ready": "Not ready",
  ready: "Ready to analyze response",
  analyzed: "Response analyzed",
  stale: "Stale",
  blocked: "Blocked / not ready for coder prep",
};

export const LOCAL_PLANNER_RESPONSE_IMPORT_GUIDE_NOTE =
  "Local Planner Response Import lets you paste a local model's planning answer back into NTTC. NTTC parses it as an untrusted claim and checks for scope/safety issues." as const;

export const LOCAL_PLANNER_RESPONSE_UNTRUSTED_NOTE =
  "NTTC treats the pasted planner response as an untrusted claim. Nothing is executed, written, or sent to AI automatically." as const;

export const LOCAL_PLANNER_RESPONSE_ACCEPT_NOTE =
  "Accepted for coder prompt prep is metadata only. This stage does not generate a coder prompt, write files, call AI, or run commands." as const;

export interface LocalPlannerResponseParsedFields {
  recommendedNextTask: string | null;
  whyThisTask: string | null;
  likelyFiles: string[];
  filesNotToTouch: string[];
  risks: string[];
  acceptanceChecks: string[];
  coderPromptOutline: string | null;
  criticQuestions: string[];
  requestedCommands: string[];
  stopConditions: string[];
  unknowns: string[];
}

export interface LocalPlannerResponseSafetyWarning {
  id: string;
  message: string;
  severity: "caution" | "blocked";
}

/** Persistable analyzed response — raw text + parsed metadata only. */
export interface LocalPlannerResponseImportRecord {
  importedAt: string;
  analyzedAt: string;
  rawResponseText: string;
  parsed: LocalPlannerResponseParsedFields;
  safetyWarnings: LocalPlannerResponseSafetyWarning[];
  status: LocalPlannerResponseStatus;
  decision: LocalPlannerResponseDecision;
  summaryMarkdown: string;
  acceptedForCoderPromptPrep: boolean;
  acceptedAt: string | null;
  sourceBriefGeneratedAt: string | null;
  sourceBriefMode: LocalPlannerBuildBriefMode | null;
  sourceBriefStrictness: LocalPlannerStrictness | null;
  sourceBriefTargetLocalModelType: LocalPlannerTargetModelType | null;
  sourceSelectedTaskId: string | null;
  sourceSelectedTaskTitle: string | null;
  stale: boolean;
}

export interface LocalPlannerResponseImportState {
  saved: LocalPlannerResponseImportRecord | null;
  draftText: string;
  busy: boolean;
  statusMessage: string | null;
  uiStatus: LocalPlannerResponseUiStatus;
  readinessBlockedReasons: string[];
  canAnalyze: boolean;
  canAccept: boolean;
}

export function emptyLocalPlannerResponseParsedFields(): LocalPlannerResponseParsedFields {
  return {
    recommendedNextTask: null,
    whyThisTask: null,
    likelyFiles: [],
    filesNotToTouch: [],
    risks: [],
    acceptanceChecks: [],
    coderPromptOutline: null,
    criticQuestions: [],
    requestedCommands: [],
    stopConditions: [],
    unknowns: [],
  };
}

export function emptyLocalPlannerResponseImportState(): LocalPlannerResponseImportState {
  return {
    saved: null,
    draftText: "",
    busy: false,
    statusMessage:
      "Paste a local planner response after generating a Local Planner Build Brief. NTTC will parse it as an untrusted claim (no AI call).",
    uiStatus: "not-ready",
    readinessBlockedReasons: [],
    canAnalyze: false,
    canAccept: false,
  };
}

export function emptyLocalPlannerResponseImportTombstone(): LocalPlannerResponseImportRecord {
  return {
    importedAt: "",
    analyzedAt: "",
    rawResponseText: "",
    parsed: emptyLocalPlannerResponseParsedFields(),
    safetyWarnings: [],
    status: "Blocked",
    decision: "Blocked until corrected",
    summaryMarkdown: "",
    acceptedForCoderPromptPrep: false,
    acceptedAt: null,
    sourceBriefGeneratedAt: null,
    sourceBriefMode: null,
    sourceBriefStrictness: null,
    sourceBriefTargetLocalModelType: null,
    sourceSelectedTaskId: null,
    sourceSelectedTaskTitle: null,
    stale: false,
  };
}

export function isLocalPlannerResponseImportCurrent(
  state: LocalPlannerResponseImportState | null | undefined,
): boolean {
  return Boolean(state?.saved && !state.saved.stale);
}

export function deriveLocalPlannerResponseUiStatus(input: {
  saved: LocalPlannerResponseImportRecord | null;
  busy: boolean;
  canAnalyze: boolean;
}): LocalPlannerResponseUiStatus {
  if (input.busy) return "not-ready";
  if (input.saved?.stale) return "stale";
  if (input.saved) {
    if (input.saved.status === "Blocked") return "blocked";
    return "analyzed";
  }
  if (input.canAnalyze) return "ready";
  return "not-ready";
}

function sliceStringList(raw: unknown, max = 80): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    .map((x) => x.trim().slice(0, 500))
    .slice(0, max);
}

export function normalizeLocalPlannerResponseImportRecord(
  raw: LocalPlannerResponseImportRecord | null | undefined,
): LocalPlannerResponseImportRecord | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.summaryMarkdown !== "string" || !raw.summaryMarkdown.trim()) {
    return null;
  }
  if (typeof raw.analyzedAt !== "string" || !raw.analyzedAt.trim()) return null;
  if (typeof raw.rawResponseText !== "string" || !raw.rawResponseText.trim()) {
    return null;
  }

  const status: LocalPlannerResponseStatus =
    raw.status === "Good" || raw.status === "Caution" || raw.status === "Blocked"
      ? raw.status
      : "Blocked";

  const decision: LocalPlannerResponseDecision =
    raw.decision === "Ready for coder prompt prep" ||
    raw.decision === "Needs revision" ||
    raw.decision === "Blocked until corrected"
      ? raw.decision
      : "Blocked until corrected";

  const parsedRaw = raw.parsed ?? emptyLocalPlannerResponseParsedFields();
  const parsed: LocalPlannerResponseParsedFields = {
    recommendedNextTask:
      typeof parsedRaw.recommendedNextTask === "string" &&
      parsedRaw.recommendedNextTask.trim()
        ? parsedRaw.recommendedNextTask.trim().slice(0, 1000)
        : null,
    whyThisTask:
      typeof parsedRaw.whyThisTask === "string" && parsedRaw.whyThisTask.trim()
        ? parsedRaw.whyThisTask.trim().slice(0, 2000)
        : null,
    likelyFiles: sliceStringList(parsedRaw.likelyFiles),
    filesNotToTouch: sliceStringList(parsedRaw.filesNotToTouch),
    risks: sliceStringList(parsedRaw.risks),
    acceptanceChecks: sliceStringList(parsedRaw.acceptanceChecks),
    coderPromptOutline:
      typeof parsedRaw.coderPromptOutline === "string" &&
      parsedRaw.coderPromptOutline.trim()
        ? parsedRaw.coderPromptOutline.trim().slice(0, 8000)
        : null,
    criticQuestions: sliceStringList(parsedRaw.criticQuestions),
    requestedCommands: sliceStringList(parsedRaw.requestedCommands),
    stopConditions: sliceStringList(parsedRaw.stopConditions),
    unknowns: sliceStringList(parsedRaw.unknowns, 40),
  };

  const warnings = Array.isArray(raw.safetyWarnings)
    ? raw.safetyWarnings
        .filter(
          (w): w is LocalPlannerResponseSafetyWarning =>
            Boolean(w) &&
            typeof w === "object" &&
            typeof (w as LocalPlannerResponseSafetyWarning).id === "string" &&
            typeof (w as LocalPlannerResponseSafetyWarning).message ===
              "string",
        )
        .map((w) => ({
          id: w.id.slice(0, 80),
          message: w.message.slice(0, 500),
          severity: w.severity === "blocked" ? ("blocked" as const) : ("caution" as const),
        }))
        .slice(0, 40)
    : [];

  const mode =
    raw.sourceBriefMode === "post-write" || raw.sourceBriefMode === "pre-write"
      ? raw.sourceBriefMode
      : null;

  return {
    importedAt:
      typeof raw.importedAt === "string" && raw.importedAt.trim()
        ? raw.importedAt
        : raw.analyzedAt,
    analyzedAt: raw.analyzedAt,
    rawResponseText: raw.rawResponseText.slice(0, 200_000),
    parsed,
    safetyWarnings: warnings,
    status,
    decision,
    summaryMarkdown: raw.summaryMarkdown.slice(0, 200_000),
    acceptedForCoderPromptPrep:
      Boolean(raw.acceptedForCoderPromptPrep) && status !== "Blocked",
    acceptedAt:
      typeof raw.acceptedAt === "string" && raw.acceptedAt.trim()
        ? raw.acceptedAt
        : null,
    sourceBriefGeneratedAt:
      typeof raw.sourceBriefGeneratedAt === "string"
        ? raw.sourceBriefGeneratedAt
        : null,
    sourceBriefMode: mode,
    sourceBriefStrictness:
      raw.sourceBriefStrictness === "smallest-safe" ||
      raw.sourceBriefStrictness === "normal" ||
      raw.sourceBriefStrictness === "ambitious-bounded"
        ? raw.sourceBriefStrictness
        : null,
    sourceBriefTargetLocalModelType:
      raw.sourceBriefTargetLocalModelType === "small-slm" ||
      raw.sourceBriefTargetLocalModelType === "general-local-llm" ||
      raw.sourceBriefTargetLocalModelType === "coder-as-planner"
        ? raw.sourceBriefTargetLocalModelType
        : null,
    sourceSelectedTaskId:
      typeof raw.sourceSelectedTaskId === "string" &&
      raw.sourceSelectedTaskId.trim()
        ? raw.sourceSelectedTaskId.trim()
        : null,
    sourceSelectedTaskTitle:
      typeof raw.sourceSelectedTaskTitle === "string" &&
      raw.sourceSelectedTaskTitle.trim()
        ? raw.sourceSelectedTaskTitle.trim().slice(0, 300)
        : null,
    stale: Boolean(raw.stale),
  };
}
