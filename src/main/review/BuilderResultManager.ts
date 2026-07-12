import type {
  BuilderPromptPack,
  BuilderResultAppearance,
  BuilderResultRecord,
  BuilderResultResponseType,
  BuilderResultSource,
  BuilderResultState,
  ProjectInfo,
  RecommendedNextAction,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

export const BUILDER_RESULT_SOURCES: BuilderResultSource[] = [
  "Cursor",
  "Codex",
  "Grok Builder",
  "Claude",
  "ChatGPT",
  "Other",
];

export const BUILDER_RESULT_RESPONSE_TYPES: BuilderResultResponseType[] = [
  "Plan only",
  "Implementation report",
  "Error report",
  "Builder plan",
  "Revised builder plan",
  "Unknown",
];

const MAX_DRAFT_CHARS = 80_000;
const MAX_SAVED_CHARS = 40_000;
const MAX_PACK_EXCERPT_CHARS = 4_000;
const MAX_PREVIEW_CHARS = 2_500;
const MAX_LABEL_CHARS = 120;
const MAX_REQUEST_CHARS = 4_000;

/** Phrase patterns that warrant a warning — never execute, only flag. */
const RISKY_PHRASE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "edit directly", pattern: /\bedit\s+directly\b/i },
  { label: "run command", pattern: /\brun\s+commands?\b/i },
  { label: "npm install", pattern: /\bnpm\s+i(nstall)?\b/i },
  { label: "install package", pattern: /\binstall\s+packages?\b/i },
  { label: "delete files", pattern: /\bdelete\s+files?\b/i },
  { label: "reset --hard", pattern: /\breset\s+--hard\b/i },
  { label: "clean -fd", pattern: /\bclean\s+-fd\b/i },
  { label: "deploy", pattern: /\bdeploy\b/i },
  { label: "publish", pattern: /\bpublish\b/i },
  { label: "push to GitHub", pattern: /\bpush\s+to\s+github\b/i },
  { label: "disable safety", pattern: /\bdisable\s+safety\b/i },
  { label: "bypass Safety Gate", pattern: /\bbypass\s+safety\s+gate\b/i },
  { label: "enable live Qwen", pattern: /\benable\s+live\s+qwen\b/i },
  { label: "add edit mode", pattern: /\badd\s+edit\s+mode\b/i },
  { label: "arbitrary terminal", pattern: /\barbitrary\s+terminal\b/i },
  { label: "custom command input", pattern: /\bcustom\s+command\s+(input|typing)\b/i },
];

const IMPLEMENTATION_LIKE_PATTERNS: RegExp[] = [
  /\bi\s+(have\s+)?(implemented|applied|edited|changed|updated|modified|created|deleted|wrote)\b/i,
  /\b(files?\s+changed|changes?\s+applied|patch\s+applied|implementation\s+complete)\b/i,
  /\b(committed|pushed|deployed|published)\b/i,
  /\bhere\s+is\s+the\s+(diff|patch|code\s+change)\b/i,
  /\b(done|finished)\s+(implementing|editing|applying)\b/i,
];

const PLAN_ONLY_PATTERNS: RegExp[] = [
  /\bplan\s+only\b/i,
  /\bno\s+code\s+yet\b/i,
  /\bwait\s+for\s+approval\b/i,
  /\bbefore\s+implementation\b/i,
  /\bproposed\s+plan\b/i,
  /\bfiles?\s+likely\s+to\s+change\b/i,
  /\btest\/?check\s+plan\b/i,
];

const TEST_PLAN_PATTERNS: RegExp[] = [
  /\btest\s*\/?\s*check\s+plan\b/i,
  /\b(test|check)\s+plan\b/i,
  /\bhow\s+to\s+(test|verify|validate)\b/i,
  /\b(manual\s+test|validation\s+steps|after\s+change)\b/i,
  /\bnpm\s+run\s+(test|typecheck|build)\b/i,
];

const FILES_LIKELY_PATTERNS: RegExp[] = [
  /\bfiles?\s+likely\s+to\s+change\b/i,
  /\b(will|would)\s+(likely\s+)?(change|touch|edit|modify)\b/i,
  /\bfiles?\s+to\s+(change|edit|modify|touch)\b/i,
  /\bimpacted\s+files?\b/i,
  /\b(src\/|package\.json|README)\b/i,
];

const SAFETY_FILE_PATTERNS: RegExp[] = [
  /\b(safetygate|safety\s+gate)\b/i,
  /\bv1-safety-rules\.md\b/i,
  /\bsafecommandrunner\b/i,
  /\bcheckpointmanager\b/i,
  /\blive_qwen_inspect_enabled\b/i,
  /\bwritesallowed\b/i,
  /\beditmodeavailable\b/i,
];

const ENABLE_DISABLED_PATTERNS: RegExp[] = [
  /\benable\s+live\s+qwen\b/i,
  /\badd\s+edit\s+mode\b/i,
  /\ballow\s+(writes|ai\s+file\s+access)\b/i,
  /\benable\s+(edit\s+mode|arbitrary\s+terminal|custom\s+commands?)\b/i,
  /\bturn\s+on\s+(live\s+qwen|edit\s+mode)\b/i,
];

const BROAD_REWRITE_PATTERNS: RegExp[] = [
  /\bbroad\s+rewrite\b/i,
  /\brewrite\s+(the\s+)?(entire|whole|whole\s+app|app)\b/i,
  /\bfull\s+rewrite\b/i,
  /\brearchitect\b/i,
  /\blarge\s+refactor\b/i,
  /\brewrite\s+everything\b/i,
];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function detectBuilderRiskyPhrases(text: string): string[] {
  const found: string[] = [];
  for (const rule of RISKY_PHRASE_PATTERNS) {
    if (rule.pattern.test(text) && !found.includes(rule.label)) {
      found.push(rule.label);
    }
  }
  return found;
}

export function detectBuilderAppearance(text: string): BuilderResultAppearance {
  const implHits = IMPLEMENTATION_LIKE_PATTERNS.filter((p) => p.test(text)).length;
  const planHits = PLAN_ONLY_PATTERNS.filter((p) => p.test(text)).length;
  if (implHits > 0 && implHits >= planHits) return "implementation-like";
  if (planHits > 0 && planHits > implHits) return "plan-only";
  if (implHits > 0) return "implementation-like";
  if (planHits > 0) return "plan-only";
  return "unclear";
}

export function detectBuilderMismatchWarnings(input: {
  text: string;
  responseType: BuilderResultResponseType;
  builderPromptExisted: boolean;
  builderPromptWasPlanOnly: boolean;
  appearsAs: BuilderResultAppearance;
}): string[] {
  const warnings: string[] = [];
  const { text } = input;

  if (
    input.builderPromptExisted &&
    input.builderPromptWasPlanOnly &&
    (input.appearsAs === "implementation-like" ||
      input.responseType === "Implementation report")
  ) {
    warnings.push(
      "Builder Prompt was plan-only, but response appears to claim implementation was done.",
    );
  }

  if (SAFETY_FILE_PATTERNS.some((p) => p.test(text))) {
    warnings.push("Builder proposes changing safety-related files.");
  }

  if (ENABLE_DISABLED_PATTERNS.some((p) => p.test(text))) {
    warnings.push("Builder proposes enabling disabled features.");
  }

  if (BROAD_REWRITE_PATTERNS.some((p) => p.test(text))) {
    warnings.push("Builder proposes broad rewrite.");
  }

  if (!TEST_PLAN_PATTERNS.some((p) => p.test(text))) {
    warnings.push("Builder omits test/check plan.");
  }

  if (!FILES_LIKELY_PATTERNS.some((p) => p.test(text))) {
    warnings.push("Builder omits files likely to change.");
  }

  return warnings;
}

export function truncateBuilderResultForPack(text: string): {
  text: string;
  truncated: boolean;
  included: boolean;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: "", truncated: false, included: false };
  }
  if (trimmed.length <= MAX_PACK_EXCERPT_CHARS) {
    return { text: trimmed, truncated: false, included: true };
  }
  return {
    text: `${trimmed.slice(0, MAX_PACK_EXCERPT_CHARS)}\n\n…(builder result truncated for pack size)`,
    truncated: true,
    included: true,
  };
}

export function previewBuilderResult(text: string): string {
  if (text.length <= MAX_PREVIEW_CHARS) return text;
  return `${text.slice(0, MAX_PREVIEW_CHARS)}\n…`;
}

export function builderResultNeedsReview(record: BuilderResultRecord | null): boolean {
  if (!record) return false;
  return (
    record.hasRiskySuggestions ||
    record.hasMismatchWarnings ||
    record.appearsAs === "implementation-like"
  );
}

function isBuilderSource(value: unknown): value is BuilderResultSource {
  return (
    typeof value === "string" &&
    (BUILDER_RESULT_SOURCES as string[]).includes(value)
  );
}

function isResponseType(value: unknown): value is BuilderResultResponseType {
  return (
    typeof value === "string" &&
    (BUILDER_RESULT_RESPONSE_TYPES as string[]).includes(value)
  );
}

function normalizeRecord(raw: BuilderResultRecord): BuilderResultRecord {
  const responseType = isResponseType(raw.responseType)
    ? raw.responseType
    : "Unknown";
  return {
    id: raw.id,
    source: raw.source,
    responseType,
    savedAt: raw.savedAt,
    label: raw.label ?? null,
    userRequestAtSave: raw.userRequestAtSave ?? "",
    projectName: raw.projectName ?? null,
    projectPath: raw.projectPath ?? null,
    recommendedNextActionAtSave: raw.recommendedNextActionAtSave ?? null,
    builderPromptExisted: Boolean(raw.builderPromptExisted),
    builderPromptWasPlanOnly: Boolean(raw.builderPromptWasPlanOnly),
    nttcBuilderPlanExistedAtImport: Boolean(raw.nttcBuilderPlanExistedAtImport),
    decisionReportExistedAtImport: Boolean(raw.decisionReportExistedAtImport),
    patchReviewPackExistedAtImport: Boolean(raw.patchReviewPackExistedAtImport),
    backlogWarningsExistedAtImport: Boolean(raw.backlogWarningsExistedAtImport),
    responseText: raw.responseText ?? "",
    riskyPhrases: Array.isArray(raw.riskyPhrases) ? raw.riskyPhrases : [],
    hasRiskySuggestions: Boolean(raw.hasRiskySuggestions),
    mismatchWarnings: Array.isArray(raw.mismatchWarnings)
      ? raw.mismatchWarnings
      : [],
    hasMismatchWarnings: Boolean(raw.hasMismatchWarnings),
    appearsAs: raw.appearsAs ?? "unclear",
    limitedContext: Boolean(raw.limitedContext),
    charCount: raw.charCount ?? (raw.responseText?.length ?? 0),
    truncated: Boolean(raw.truncated),
  };
}

function emptyState(): BuilderResultState {
  return {
    source: "Cursor",
    responseType: "Plan only",
    draftText: "",
    draftLabel: "",
    saved: null,
    statusMessage:
      "Paste a builder AI response here. Text only — nothing will be executed, edited, or run automatically.",
  };
}

/**
 * Stage 19: Builder Result Import.
 * Text-only storage. Never executes pasted instructions or triggers app actions.
 */
export class BuilderResultManager {
  private state: BuilderResultState = emptyState();

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BuilderResultState {
    return {
      ...this.state,
      saved: this.state.saved ? { ...this.state.saved } : null,
    };
  }

  getSaved(): BuilderResultRecord | null {
    return this.state.saved ? { ...this.state.saved } : null;
  }

  clearForProjectChange(): void {
    this.state = {
      ...this.state,
      saved: null,
      statusMessage:
        "Project changed. Previous saved Builder Result was cleared. Draft text was kept.",
    };
  }

  /** Restore latest builder result from app history (text-only; never executed). */
  restoreSaved(record: BuilderResultRecord | null | undefined): void {
    if (!record) {
      this.state = {
        ...this.state,
        saved: null,
      };
      return;
    }
    const normalized = normalizeRecord(record);
    this.state = {
      ...this.state,
      source: normalized.source,
      responseType: normalized.responseType,
      saved: normalized,
      statusMessage:
        "Restored Builder Result from history. Advice/reporting only — not executed.",
    };
  }

  setSource(source: unknown): BuilderResultState {
    if (!isBuilderSource(source)) {
      this.safetyGate.log(
        "warning",
        "Builder result source change blocked",
        "Unknown builder result source.",
      );
      return this.getState();
    }
    if (source === this.state.source) {
      return this.getState();
    }
    this.state = {
      ...this.state,
      source,
      statusMessage: `Builder result source set to ${source}.`,
    };
    this.safetyGate.log(
      "info",
      "Builder result source changed",
      `Source set to ${source}. Pasted text is advice only and will not be executed.`,
    );
    return this.getState();
  }

  setResponseType(responseType: unknown): BuilderResultState {
    if (!isResponseType(responseType)) {
      this.safetyGate.log(
        "warning",
        "Builder result response type change blocked",
        "Unknown builder result response type.",
      );
      return this.getState();
    }
    if (responseType === this.state.responseType) {
      return this.getState();
    }
    this.state = {
      ...this.state,
      responseType,
      statusMessage: `Builder result response type set to ${responseType}.`,
    };
    this.safetyGate.log(
      "info",
      "Builder result response type changed",
      `Response type set to ${responseType}.`,
    );
    return this.getState();
  }

  setDraft(text: unknown): BuilderResultState {
    const next =
      typeof text === "string" ? text.slice(0, MAX_DRAFT_CHARS) : "";
    const previous = this.state.draftText;
    this.state = {
      ...this.state,
      draftText: next,
    };

    const prevTrim = previous.trim();
    const nextTrim = next.trim();
    if (prevTrim.length === 0 && nextTrim.length > 0) {
      this.safetyGate.log(
        "info",
        "Builder result pasted/updated",
        `Draft now has ${nextTrim.length} characters. Not saved yet. Text only.`,
      );
    } else if (prevTrim.length > 0 && nextTrim.length === 0) {
      this.safetyGate.log(
        "info",
        "Builder result pasted/updated",
        "Draft cleared (not saved).",
      );
    } else if (prevTrim !== nextTrim && nextTrim.length > 0) {
      this.safetyGate.log(
        "info",
        "Builder result pasted/updated",
        `Draft updated (${nextTrim.length} characters). Not saved yet.`,
      );
    }

    return this.getState();
  }

  setLabel(label: unknown): BuilderResultState {
    const next =
      typeof label === "string" ? label.trim().slice(0, MAX_LABEL_CHARS) : "";
    this.state = {
      ...this.state,
      draftLabel: next,
    };
    return this.getState();
  }

  save(input: {
    userRequest: string;
    project: ProjectInfo | null;
    builderPrompt: BuilderPromptPack | null;
    recommendedNextAction: RecommendedNextAction | null;
    nttcBuilderPlanExisted?: boolean;
    decisionReportExisted?: boolean;
    patchReviewPackExisted?: boolean;
    backlogWarningsExisted?: boolean;
    builderPlanComparisonExisted?: boolean;
    safetyBackupVerified?: boolean;
  }): BuilderResultState {
    const trimmed = this.state.draftText.trim();
    if (!trimmed) {
      this.state = {
        ...this.state,
        statusMessage: "Paste a builder response before saving.",
      };
      this.safetyGate.log(
        "warning",
        "Builder result save blocked",
        "Paste area is empty.",
      );
      return this.getState();
    }

    const riskyPhrases = detectBuilderRiskyPhrases(trimmed);
    const appearsAs = detectBuilderAppearance(trimmed);
    const builderPromptExisted = Boolean(input.builderPrompt);
    const builderPromptWasPlanOnly = Boolean(input.builderPrompt?.planOnly);
    const mismatchWarnings = detectBuilderMismatchWarnings({
      text: trimmed,
      responseType: this.state.responseType,
      builderPromptExisted,
      builderPromptWasPlanOnly,
      appearsAs,
    });

    const limitedContext = !input.project;
    const truncated = trimmed.length > MAX_SAVED_CHARS;
    const responseText = trimmed.slice(0, MAX_SAVED_CHARS);
    const label =
      this.state.draftLabel.trim() ||
      `${this.state.source} ${this.state.responseType} ${new Date().toLocaleString()}`;

    const isPlanImport =
      this.state.responseType === "Builder plan" ||
      this.state.responseType === "Revised builder plan";
    const isImplementationImport =
      this.state.responseType === "Implementation report";

    const record: BuilderResultRecord = {
      id: makeId(),
      source: this.state.source,
      responseType: this.state.responseType,
      savedAt: new Date().toISOString(),
      label: label.slice(0, MAX_LABEL_CHARS),
      userRequestAtSave: input.userRequest.trim().slice(0, MAX_REQUEST_CHARS),
      projectName: input.project?.displayName ?? null,
      projectPath: input.project?.normalizedPath ?? null,
      recommendedNextActionAtSave: input.recommendedNextAction,
      builderPromptExisted,
      builderPromptWasPlanOnly,
      nttcBuilderPlanExistedAtImport: Boolean(input.nttcBuilderPlanExisted),
      decisionReportExistedAtImport: Boolean(input.decisionReportExisted),
      patchReviewPackExistedAtImport: Boolean(input.patchReviewPackExisted),
      backlogWarningsExistedAtImport: Boolean(input.backlogWarningsExisted),
      builderPlanComparisonExistedAtImport: Boolean(
        input.builderPlanComparisonExisted,
      ),
      safetyBackupVerifiedAtImport: Boolean(input.safetyBackupVerified),
      responseText,
      riskyPhrases,
      hasRiskySuggestions: riskyPhrases.length > 0,
      mismatchWarnings,
      hasMismatchWarnings: mismatchWarnings.length > 0,
      appearsAs,
      limitedContext,
      charCount: responseText.length,
      truncated,
    };

    const warningParts: string[] = [];
    if (isPlanImport) {
      warningParts.push(
        "Stored as a builder plan for comparison — not proof of implementation.",
      );
    }
    if (isImplementationImport) {
      warningParts.push(
        "Stored as a claimed implementation summary — not proof of correctness. Nothing was executed.",
      );
    }
    if (riskyPhrases.length > 0) {
      warningParts.push(`Risk warnings: ${riskyPhrases.join(", ")}`);
      this.safetyGate.log(
        "warning",
        "Risk warnings detected",
        `Builder result flagged risky phrases: ${riskyPhrases.join(", ")}. Not executed.`,
      );
    }
    if (mismatchWarnings.length > 0) {
      warningParts.push(`Mismatch warnings: ${mismatchWarnings.length}`);
      this.safetyGate.log(
        "warning",
        "Mismatch warnings detected",
        `Builder result mismatch warnings: ${mismatchWarnings.join(" | ")}. Not executed.`,
      );
    }

    this.state = {
      ...this.state,
      saved: record,
      draftText: "",
      draftLabel: "",
      statusMessage: [
        limitedContext
          ? "Saved Builder Result with limited context (no project selected)."
          : "Saved Builder Result (text only — not executed).",
        truncated
          ? `Stored text was truncated to ${MAX_SAVED_CHARS} characters.`
          : null,
        ...warningParts,
      ]
        .filter(Boolean)
        .join(" "),
    };

    this.safetyGate.log(
      "success",
      "Builder result saved",
      `Saved ${record.source} / ${record.responseType} (${record.charCount} chars). Appears as ${record.appearsAs}. Text only — not executed.`,
    );

    return this.getState();
  }

  clear(): BuilderResultState {
    const hadSaved = Boolean(this.state.saved);
    this.state = {
      ...this.state,
      saved: null,
      draftText: "",
      draftLabel: "",
      statusMessage: hadSaved
        ? "Builder Result cleared from app storage. Project files were not changed."
        : "Builder Result draft cleared.",
    };
    this.safetyGate.log(
      "info",
      "Builder result cleared",
      hadSaved
        ? "Saved Builder Result removed from app storage. Nothing executed; project files unchanged."
        : "Builder Result draft cleared.",
    );
    return this.getState();
  }

  recordCopied(): BuilderResultState {
    const saved = this.state.saved;
    if (!saved) {
      this.state = {
        ...this.state,
        statusMessage: "Nothing to copy — save a Builder Result first.",
      };
      this.safetyGate.log(
        "warning",
        "Builder result copy blocked",
        "No saved Builder Result.",
      );
      return this.getState();
    }
    this.safetyGate.log(
      "info",
      "Builder result copied",
      `Copied ${saved.source} / ${saved.responseType} Builder Result (${saved.charCount} chars).`,
    );
    this.state = {
      ...this.state,
      statusMessage: "Builder Result copied to clipboard (text only).",
    };
    return this.getState();
  }

  /** Stage 90/94: stage task implementation report for Implementation Review (text only). */
  importTaskImplementationReport(input: {
    taskId: string;
    taskTitle: string;
    builderSource: string;
    reportText: string;
    taskPhase?: string;
    taskArtifactKind?: string;
    sourceTaskCardGeneratedAt?: string;
    sourceTaskCardHash?: string;
    sourceHandoffId?: string;
    sourceHandoffGeneratedAt?: string;
  }): BuilderResultState {
    const sourceMap: Record<string, BuilderResultSource> = {
      Cursor: "Cursor",
      Codex: "Codex",
      Claude: "Claude",
      ChatGPT: "ChatGPT",
      Grok: "Grok Builder",
      Qwen: "Other",
      "Human programmer": "Other",
      Other: "Other",
    };
    const source = sourceMap[input.builderSource] ?? "Other";
    const trimmed = input.reportText.trim();
    if (!trimmed) {
      this.state = {
        ...this.state,
        statusMessage: "No implementation report text to stage for review.",
      };
      return this.getState();
    }

    const riskyPhrases = detectBuilderRiskyPhrases(trimmed);
    const appearsAs = detectBuilderAppearance(trimmed);
    const truncated = trimmed.length > MAX_SAVED_CHARS;
    const responseText = trimmed.slice(0, MAX_SAVED_CHARS);

    const record: BuilderResultRecord = {
      id: makeId(),
      source,
      responseType: "Implementation report",
      savedAt: new Date().toISOString(),
      label: `${input.taskId} implementation report`,
      userRequestAtSave: "",
      projectName: null,
      projectPath: null,
      recommendedNextActionAtSave: null,
      builderPromptExisted: false,
      builderPromptWasPlanOnly: false,
      nttcBuilderPlanExistedAtImport: false,
      decisionReportExistedAtImport: false,
      patchReviewPackExistedAtImport: false,
      backlogWarningsExistedAtImport: false,
      responseText,
      riskyPhrases,
      hasRiskySuggestions: riskyPhrases.length > 0,
      mismatchWarnings: [],
      hasMismatchWarnings: false,
      appearsAs,
      limitedContext: false,
      charCount: responseText.length,
      truncated,
      taskId: input.taskId,
      taskTitle: input.taskTitle,
      taskPhase: input.taskPhase,
      taskArtifactKind:
        input.taskArtifactKind ?? "Blueprint Task Implementation Report",
      sourceTaskCardGeneratedAt: input.sourceTaskCardGeneratedAt,
      sourceTaskCardHash: input.sourceTaskCardHash,
      sourceHandoffId: input.sourceHandoffId,
      sourceHandoffGeneratedAt: input.sourceHandoffGeneratedAt,
    };

    this.state = {
      ...this.state,
      source,
      responseType: "Implementation report",
      saved: record,
      statusMessage: `Staged ${input.taskId} task implementation report for Implementation Review (text only — not executed).`,
    };

    this.safetyGate.log(
      "info",
      "Task implementation report staged for review",
      `${input.taskId} · ${source} · ${responseText.length} chars.`,
    );
    return this.getState();
  }
}
