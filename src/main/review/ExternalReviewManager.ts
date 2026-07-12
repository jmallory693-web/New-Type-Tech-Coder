import type {
  ChangedFilesScanResult,
  ExternalReviewComparison,
  ExternalReviewContextBasis,
  ExternalReviewKeywordHit,
  ExternalReviewRecord,
  ExternalReviewSource,
  ExternalReviewState,
  LocalAiAdvisorResponse,
  PatchReviewPack,
  ProjectInfo,
  ProjectScanResult,
  QwenInspectState,
  SafeChecksState,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

export const EXTERNAL_REVIEW_SOURCES: ExternalReviewSource[] = [
  "Qwen Code",
  "ChatGPT",
  "Claude",
  "Gemini",
  "Grok",
  "Other",
];

export const MAX_EXTERNAL_REVIEWS_PER_PROJECT = 20;
const MAX_DRAFT_CHARS = 80_000;
const MAX_SAVED_REVIEW_CHARS = 40_000;
const MAX_PACK_EXCERPT_CHARS = 4_000;
const MAX_PREVIEW_CHARS = 2_500;
const MAX_LABEL_CHARS = 120;

/** Phrase patterns that warrant a warning — never execute, only flag. */
const RISKY_PHRASE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "delete files", pattern: /\bdelete\s+files?\b/i },
  { label: "remove folder", pattern: /\bremove\s+folders?\b/i },
  { label: "rm -rf", pattern: /\brm\s+-rf\b/i },
  { label: "reset --hard", pattern: /\breset\s+--hard\b/i },
  { label: "clean -fd", pattern: /\bclean\s+-fd\b/i },
  { label: "install package", pattern: /\binstall\s+packages?\b/i },
  { label: "npm install", pattern: /\bnpm\s+i(nstall)?\b/i },
  { label: "deploy", pattern: /\bdeploy\b/i },
  { label: "publish", pattern: /\bpublish\b/i },
  { label: "push to GitHub", pattern: /\bpush\s+to\s+github\b/i },
  { label: "disable safety", pattern: /\bdisable\s+safety\b/i },
  { label: "ignore checkpoint", pattern: /\bignore\s+checkpoints?\b/i },
  { label: "edit directly", pattern: /\bedit\s+directly\b/i },
  { label: "run command", pattern: /\brun\s+commands?\b/i },
];

/** Keyword-only comparison themes (not semantic AI understanding). */
const COMPARISON_KEYWORDS: Array<{ keyword: string; pattern: RegExp }> = [
  { keyword: "approve", pattern: /\bapprov(e|ed|al|ing)\b/i },
  { keyword: "revise", pattern: /\brevis(e|ed|ion|ing)\b/i },
  { keyword: "revert", pattern: /\brevert(ed|ing)?\b/i },
  { keyword: "tests", pattern: /\btests?\b/i },
  { keyword: "build", pattern: /\bbuild(s|ing)?\b/i },
  { keyword: "security", pattern: /\bsecurit(y|ies)\b/i },
  { keyword: "package.json", pattern: /\bpackage\.json\b/i },
  { keyword: "secrets", pattern: /\bsecrets?\b|\.env\b/i },
  { keyword: "command", pattern: /\bcommands?\b/i },
  { keyword: "backup", pattern: /\bbackups?\b/i },
  { keyword: "undo", pattern: /\bundo\b/i },
];

const METHOD_NOTE =
  "Keyword match only — not semantic AI understanding. Review manually.";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function detectRiskyPhrases(text: string): string[] {
  const found: string[] = [];
  for (const rule of RISKY_PHRASE_PATTERNS) {
    if (rule.pattern.test(text) && !found.includes(rule.label)) {
      found.push(rule.label);
    }
  }
  return found;
}

export function truncateExternalReviewForPack(text: string): {
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
    text: `${trimmed.slice(0, MAX_PACK_EXCERPT_CHARS)}\n\n…(external review truncated for Review Pack size)`,
    truncated: true,
    included: true,
  };
}

export function previewExternalReview(text: string): string {
  if (text.length <= MAX_PREVIEW_CHARS) return text;
  return `${text.slice(0, MAX_PREVIEW_CHARS)}\n…`;
}

function isExternalSource(value: unknown): value is ExternalReviewSource {
  return (
    typeof value === "string" &&
    (EXTERNAL_REVIEW_SOURCES as string[]).includes(value)
  );
}

function normalizeRecord(raw: ExternalReviewRecord): ExternalReviewRecord {
  return {
    id: raw.id,
    source: raw.source,
    savedAt: raw.savedAt,
    label: raw.label ?? null,
    userRequestAtSave: raw.userRequestAtSave ?? "",
    projectName: raw.projectName ?? null,
    projectPath: raw.projectPath ?? null,
    contextBasis: Array.isArray(raw.contextBasis) ? raw.contextBasis : ["unknown"],
    reviewText: raw.reviewText ?? "",
    riskyPhrases: Array.isArray(raw.riskyPhrases) ? raw.riskyPhrases : [],
    hasRiskySuggestions: Boolean(raw.hasRiskySuggestions),
    limitedContext: Boolean(raw.limitedContext),
    charCount: raw.charCount ?? (raw.reviewText?.length ?? 0),
    truncated: Boolean(raw.truncated),
    associatedChangedFilesScanAt: raw.associatedChangedFilesScanAt ?? null,
    associatedPatchPackAt: raw.associatedPatchPackAt ?? null,
  };
}

function emptyComparison(): ExternalReviewComparison {
  return {
    reviewCount: 0,
    sourcesRepresented: [],
    reviewsWithRiskyPhrases: 0,
    localAdvisorExists: false,
    safeChecksResultExists: false,
    keywordHits: [],
    commonConcernKeywords: [],
    appearsToMentionApprove: false,
    appearsToMentionRevise: false,
    appearsToMentionRevert: false,
    disagreementDetected: false,
    needsHumanDecision: false,
    plainEnglish: "No external reviews saved yet.",
    methodNote: METHOD_NOTE,
  };
}

export function buildMultiReviewComparison(input: {
  reviews: ExternalReviewRecord[];
  advisor: LocalAiAdvisorResponse | null;
  safeChecks: SafeChecksState;
}): ExternalReviewComparison {
  const reviews = input.reviews;
  const reviewCount = reviews.length;
  const sourcesRepresented = [
    ...new Set(reviews.map((r) => r.source)),
  ] as ExternalReviewSource[];
  const reviewsWithRiskyPhrases = reviews.filter((r) => r.hasRiskySuggestions).length;
  const localAdvisorExists = Boolean(input.advisor?.responseText.trim());
  const safeChecksResultExists = Boolean(input.safeChecks.lastResult);

  const keywordHits: ExternalReviewKeywordHit[] = [];
  for (const rule of COMPARISON_KEYWORDS) {
    const matching = reviews.filter((r) => rule.pattern.test(r.reviewText));
    if (matching.length === 0) continue;
    keywordHits.push({
      keyword: rule.keyword,
      reviewIds: matching.map((r) => r.id),
      sources: [...new Set(matching.map((r) => r.source))],
      count: matching.length,
    });
  }

  const commonConcernKeywords = keywordHits
    .filter((h) => h.count >= 2)
    .map((h) => h.keyword);

  const appearsToMentionApprove = keywordHits.some((h) => h.keyword === "approve");
  const appearsToMentionRevise = keywordHits.some((h) => h.keyword === "revise");
  const appearsToMentionRevert = keywordHits.some((h) => h.keyword === "revert");
  const disagreementDetected =
    appearsToMentionApprove &&
    (appearsToMentionRevise || appearsToMentionRevert);
  const needsHumanDecision = disagreementDetected || reviewsWithRiskyPhrases > 0;

  const parts: string[] = [];
  if (reviewCount === 0) {
    parts.push("No external reviews saved yet.");
  } else {
    parts.push(
      `${reviewCount} external review(s) saved from: ${sourcesRepresented.join(", ")}.`,
    );
    parts.push(
      reviewsWithRiskyPhrases > 0
        ? `${reviewsWithRiskyPhrases} review(s) appear to mention risky action phrases (keyword match only).`
        : "No risky action phrases flagged across saved reviews.",
    );
    if (commonConcernKeywords.length > 0) {
      parts.push(
        `Common concern keywords across reviews: ${commonConcernKeywords.join(", ")}.`,
      );
    }
    if (disagreementDetected) {
      parts.push(
        "Disagreement indicator: at least one review appears to mention approve while another appears to mention revise or revert. Needs human decision.",
      );
    } else {
      parts.push("No approve-vs-revise/revert disagreement keyword pattern detected.");
    }
  }
  parts.push(
    localAdvisorExists
      ? "Local AI Advisor response exists."
      : "No Local AI Advisor response yet.",
  );
  parts.push(
    safeChecksResultExists
      ? `Safe Checks last result: ${input.safeChecks.lastResult!.status}.`
      : "No Safe Checks result yet.",
  );
  parts.push(METHOD_NOTE);

  return {
    reviewCount,
    sourcesRepresented,
    reviewsWithRiskyPhrases,
    localAdvisorExists,
    safeChecksResultExists,
    keywordHits,
    commonConcernKeywords,
    appearsToMentionApprove,
    appearsToMentionRevise,
    appearsToMentionRevert,
    disagreementDetected,
    needsHumanDecision,
    plainEnglish: parts.join(" "),
    methodNote: METHOD_NOTE,
  };
}

function emptyState(): ExternalReviewState {
  return {
    source: "Qwen Code",
    draftText: "",
    draftLabel: "",
    reviews: [],
    selectedId: null,
    selected: null,
    statusMessage:
      "Paste an external review response here. Advice only — nothing will be executed. Saving adds a new review (does not replace others).",
    comparison: emptyComparison(),
    capNote: null,
  };
}

function withSelected(
  state: ExternalReviewState,
  selectedId: string | null,
): ExternalReviewState {
  const selected =
    selectedId == null
      ? null
      : state.reviews.find((r) => r.id === selectedId) ?? null;
  return {
    ...state,
    selectedId: selected?.id ?? null,
    selected: selected ? { ...selected } : null,
  };
}

/**
 * Stage 8B / Stage 17: External Review Import (multi-review).
 * Text-only storage. Never executes pasted instructions.
 */
export class ExternalReviewManager {
  private state: ExternalReviewState = emptyState();

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): ExternalReviewState {
    return {
      ...this.state,
      reviews: this.state.reviews.map((r) => ({ ...r })),
      selected: this.state.selected ? { ...this.state.selected } : null,
      comparison: this.state.comparison ? { ...this.state.comparison } : null,
    };
  }

  clearForProjectChange(): void {
    this.state = {
      ...this.state,
      reviews: [],
      selectedId: null,
      selected: null,
      comparison: emptyComparison(),
      capNote: null,
      statusMessage:
        "Project changed. Previous saved External Reviews were cleared. Draft text was kept.",
    };
  }

  /** Restore multiple reviews from app history (text-only; never executed). */
  restoreReviews(records: ExternalReviewRecord[]): void {
    const normalized = records
      .map(normalizeRecord)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, MAX_EXTERNAL_REVIEWS_PER_PROJECT);
    const selectedId = normalized[0]?.id ?? null;
    this.state = withSelected(
      {
        ...this.state,
        reviews: normalized,
        comparison: emptyComparison(),
        capNote:
          records.length > MAX_EXTERNAL_REVIEWS_PER_PROJECT
            ? `History restored the newest ${MAX_EXTERNAL_REVIEWS_PER_PROJECT} reviews.`
            : null,
        statusMessage:
          normalized.length > 0
            ? `Restored ${normalized.length} External Review(s) from history. Advice only — not executed.`
            : this.state.statusMessage,
      },
      selectedId,
    );
  }

  /** @deprecated Prefer restoreReviews. Keeps older single-record history working. */
  restoreSaved(record: ExternalReviewRecord): void {
    this.restoreReviews([record]);
  }

  setSource(source: unknown): ExternalReviewState {
    if (!isExternalSource(source)) {
      this.safetyGate.log(
        "warning",
        "External review source change blocked",
        "Unknown external review source.",
      );
      return this.getState();
    }
    if (source === this.state.source) {
      return this.getState();
    }
    this.state = {
      ...this.state,
      source,
      statusMessage: `External review source set to ${source}.`,
    };
    this.safetyGate.log(
      "info",
      "External review source changed",
      `Source set to ${source}. Pasted text is advice only and will not be executed.`,
    );
    return this.getState();
  }

  setDraft(text: unknown): ExternalReviewState {
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
        "External review pasted/updated",
        `Draft now has ${nextTrim.length} characters. Not saved yet. Advice only.`,
      );
    } else if (prevTrim.length > 0 && nextTrim.length === 0) {
      this.safetyGate.log(
        "info",
        "External review pasted/updated",
        "Draft cleared (not saved).",
      );
    }

    return this.getState();
  }

  setLabel(label: unknown): ExternalReviewState {
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
    summary: ProjectScanResult | null;
    reviewPackExists: boolean;
    qwen: QwenInspectState;
    advisor: LocalAiAdvisorResponse | null;
    safeChecks: SafeChecksState;
    changedFiles: ChangedFilesScanResult | null;
    patchReviewPack: PatchReviewPack | null;
  }): ExternalReviewState {
    const trimmed = this.state.draftText.trim();
    if (!trimmed) {
      this.state = {
        ...this.state,
        statusMessage: "Paste an external review response before saving.",
      };
      this.safetyGate.log(
        "warning",
        "External review save blocked",
        "Paste area is empty.",
      );
      return this.getState();
    }

    const riskyPhrases = detectRiskyPhrases(trimmed);
    const contextBasis: ExternalReviewContextBasis[] = [];
    if (input.summary) contextBasis.push("project-summary");
    if (input.reviewPackExists) contextBasis.push("review-pack");
    if (input.qwen.promptPack) contextBasis.push("qwen-prompt-pack");
    if (input.patchReviewPack) contextBasis.push("patch-review-pack");
    if (contextBasis.length === 0) contextBasis.push("unknown");

    const limitedContext = !input.project;
    const truncated = trimmed.length > MAX_SAVED_REVIEW_CHARS;
    const reviewText = trimmed.slice(0, MAX_SAVED_REVIEW_CHARS);
    const label =
      this.state.draftLabel.trim() ||
      `${this.state.source} review ${new Date().toLocaleString()}`;

    const record: ExternalReviewRecord = {
      id: makeId(),
      source: this.state.source,
      savedAt: new Date().toISOString(),
      label: label.slice(0, MAX_LABEL_CHARS),
      userRequestAtSave: input.userRequest.trim().slice(0, 4000),
      projectName: input.project?.displayName ?? null,
      projectPath: input.project?.normalizedPath ?? null,
      contextBasis,
      reviewText,
      riskyPhrases,
      hasRiskySuggestions: riskyPhrases.length > 0,
      limitedContext,
      charCount: reviewText.length,
      truncated,
      associatedChangedFilesScanAt: input.changedFiles?.scannedAt ?? null,
      associatedPatchPackAt: input.patchReviewPack?.generatedAt ?? null,
    };

    let reviews = [record, ...this.state.reviews];
    let capNote: string | null = null;
    if (reviews.length > MAX_EXTERNAL_REVIEWS_PER_PROJECT) {
      reviews = reviews.slice(0, MAX_EXTERNAL_REVIEWS_PER_PROJECT);
      capNote = `Kept the newest ${MAX_EXTERNAL_REVIEWS_PER_PROJECT} reviews (older ones dropped).`;
    }

    const comparison = buildMultiReviewComparison({
      reviews,
      advisor: input.advisor,
      safeChecks: input.safeChecks,
    });

    this.state = withSelected(
      {
        ...this.state,
        reviews,
        draftText: "",
        draftLabel: "",
        comparison,
        capNote,
        statusMessage: limitedContext
          ? "External Review saved with limited context (no project selected). Advice only — nothing will be executed."
          : riskyPhrases.length > 0
            ? "External Review saved with risk warnings. Treat it as advice only."
            : truncated
              ? "External Review saved (text truncated for size). Advice only — nothing will be executed."
              : "External Review saved. Advice only — nothing will be executed.",
      },
      record.id,
    );

    this.safetyGate.log(
      limitedContext || riskyPhrases.length > 0 ? "warning" : "success",
      "External review saved",
      [
        `Source: ${record.source}`,
        `Label: ${record.label}`,
        `${record.charCount} characters`,
        `Context: ${contextBasis.join(", ")}`,
        `Total saved: ${reviews.length}`,
        limitedContext ? "no project selected" : "project selected",
        "text-only; will not execute",
      ].join("; "),
    );

    if (riskyPhrases.length > 0) {
      this.safetyGate.log(
        "warning",
        "Risky phrases detected",
        `External review mentions: ${riskyPhrases.join(", ")}. Treat as advice only.`,
      );
    }

    this.safetyGate.log(
      comparison.needsHumanDecision ? "warning" : "info",
      "Review comparison updated",
      comparison.plainEnglish,
    );

    return this.getState();
  }

  select(reviewId: unknown): ExternalReviewState {
    if (typeof reviewId !== "string" || !reviewId.trim()) {
      this.safetyGate.log(
        "warning",
        "External review select blocked",
        "Missing review id.",
      );
      return this.getState();
    }
    const found = this.state.reviews.find((r) => r.id === reviewId);
    if (!found) {
      this.safetyGate.log(
        "warning",
        "External review select blocked",
        "Review not found.",
      );
      return this.getState();
    }
    this.state = withSelected(this.state, found.id);
    this.state = {
      ...this.state,
      statusMessage: `Selected External Review from ${found.source}${found.label ? ` (${found.label})` : ""}.`,
    };
    this.safetyGate.log(
      "info",
      "External review selected",
      `Selected ${found.source} review saved at ${found.savedAt}.`,
    );
    return this.getState();
  }

  delete(reviewId: unknown): ExternalReviewState {
    if (typeof reviewId !== "string" || !reviewId.trim()) {
      this.safetyGate.log(
        "warning",
        "External review delete blocked",
        "Missing review id.",
      );
      return this.getState();
    }
    const before = this.state.reviews.length;
    const reviews = this.state.reviews.filter((r) => r.id !== reviewId);
    if (reviews.length === before) {
      this.safetyGate.log(
        "warning",
        "External review delete blocked",
        "Review not found.",
      );
      return this.getState();
    }

    const nextSelected =
      this.state.selectedId === reviewId
        ? reviews[0]?.id ?? null
        : this.state.selectedId;

    this.state = withSelected(
      {
        ...this.state,
        reviews,
        statusMessage: "External Review deleted from app storage. Project files were not changed.",
      },
      nextSelected,
    );

    this.safetyGate.log(
      "success",
      "External review deleted",
      `Deleted review ${reviewId}. ${reviews.length} remain.`,
    );
    return this.getState();
  }

  /** Clears paste draft/label only. Saved reviews stay until deleted individually. */
  clear(): ExternalReviewState {
    const hadDraft =
      Boolean(this.state.draftText.trim()) || Boolean(this.state.draftLabel.trim());
    const selectedId = this.state.selectedId;
    this.state = withSelected(
      {
        ...this.state,
        draftText: "",
        draftLabel: "",
        statusMessage: "Draft cleared. Saved reviews were kept.",
      },
      selectedId,
    );
    this.safetyGate.log(
      "info",
      "External review cleared",
      hadDraft
        ? this.state.reviews.length > 0
          ? "Draft cleared; saved reviews kept."
          : "Draft cleared."
        : "Nothing to clear in draft.",
    );
    return this.getState();
  }

  recordCopied(reviewId?: string | null): void {
    const target =
      (reviewId
        ? this.state.reviews.find((r) => r.id === reviewId)
        : null) ?? this.state.selected;
    if (!target) {
      this.safetyGate.log(
        "warning",
        "External review copy blocked",
        "No External Review selected to copy yet.",
      );
      return;
    }
    this.safetyGate.log(
      "success",
      "External review copied",
      `Copied External Review from ${target.source}.`,
    );
  }

  /**
   * Refresh keyword comparison when advisor/safe-check/review list changes.
   */
  refreshComparison(input: {
    advisor: LocalAiAdvisorResponse | null;
    safeChecks: SafeChecksState;
  }): void {
    const comparison = buildMultiReviewComparison({
      reviews: this.state.reviews,
      advisor: input.advisor,
      safeChecks: input.safeChecks,
    });
    this.state = {
      ...this.state,
      comparison,
    };
  }
}
