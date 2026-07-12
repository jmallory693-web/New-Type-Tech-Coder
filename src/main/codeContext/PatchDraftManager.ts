import type {
  ActiveProviderKind,
  CodeContextPack,
  ModelSelectionSource,
  PatchDraftRecord,
  PatchDraftState,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import { extractPatchDraftRecommendation } from "./buildPatchDraftPrompt";

const MAX_DRAFT_CHARS = 40_000;
const MAX_PREVIEW_CHARS = 900;

export class PatchDraftManager {
  private includeCodeAiResponseExcerpt = false;
  private includeBuilderPlanDecisionExcerpt = false;
  private includeImplementationReviewExcerpt = false;
  private saved: PatchDraftRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    "Generate a Patch Draft from your approved Code Context Pack. NTTC will not edit files or apply patches.";
  private lastFailureMessage: string | null = null;
  private lastFailureAt: string | null = null;

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): PatchDraftState {
    return {
      includeCodeAiResponseExcerpt: this.includeCodeAiResponseExcerpt,
      includeBuilderPlanDecisionExcerpt: this.includeBuilderPlanDecisionExcerpt,
      includeImplementationReviewExcerpt: this.includeImplementationReviewExcerpt,
      saved: this.saved,
      busy: this.busy,
      statusMessage: this.statusMessage,
      lastFailureMessage: this.lastFailureMessage,
      lastFailureAt: this.lastFailureAt,
    };
  }

  getSaved(): PatchDraftRecord | null {
    return this.saved;
  }

  getOptions() {
    return {
      includeCodeAiResponseExcerpt: this.includeCodeAiResponseExcerpt,
      includeBuilderPlanDecisionExcerpt: this.includeBuilderPlanDecisionExcerpt,
      includeImplementationReviewExcerpt: this.includeImplementationReviewExcerpt,
    };
  }

  setIncludeCodeAi(include: unknown): void {
    this.includeCodeAiResponseExcerpt = Boolean(include);
  }

  setIncludeBuilderPlanDecision(include: unknown): void {
    this.includeBuilderPlanDecisionExcerpt = Boolean(include);
  }

  setIncludeImplementationReview(include: unknown): void {
    this.includeImplementationReviewExcerpt = Boolean(include);
  }

  setBusy(busy: boolean, statusMessage?: string): void {
    this.busy = busy;
    if (statusMessage !== undefined) {
      this.statusMessage = statusMessage;
    }
  }

  setStatus(statusMessage: string): void {
    this.statusMessage = statusMessage;
  }

  saveGenerated(input: {
    draftText: string;
    modelName: string;
    providerType: ActiveProviderKind;
    baseUrl: string;
    userQuestion: string;
    pack: CodeContextPack;
    promptCharCount: number;
    modelSelectionSource?: ModelSelectionSource;
    questionTemplateId?: string | null;
    questionTemplateLabel?: string | null;
    includeCodeAiResponseExcerpt: boolean;
    includeBuilderPlanDecisionExcerpt: boolean;
    includeImplementationReviewExcerpt: boolean;
  }): PatchDraftRecord {
    const original = input.draftText;
    const truncatedResponse = original.length > MAX_DRAFT_CHARS;
    const responseText = truncatedResponse
      ? `${original.slice(0, MAX_DRAFT_CHARS - 1)}…`
      : original;
    const previewExcerpt =
      responseText.length > MAX_PREVIEW_CHARS
        ? `${responseText.slice(0, MAX_PREVIEW_CHARS - 1)}…`
        : responseText;

    const record: PatchDraftRecord = {
      id: `patch-draft-${Date.now().toString(36)}`,
      generatedAt: new Date().toISOString(),
      modelName: input.modelName,
      providerType: input.providerType,
      baseUrl: input.baseUrl,
      roleMode: "Patch Draft",
      mappingKey: "patch-draft",
      userQuestion: input.userQuestion.trim().slice(0, 4000),
      contextPackGeneratedAt: input.pack.generatedAt,
      selectedFileCount: input.pack.selectedFileCount,
      warningCount: input.pack.warningCount,
      truncated: input.pack.truncated,
      draftText: responseText,
      previewExcerpt,
      recommendation: extractPatchDraftRecommendation(responseText),
      promptCharCount: input.promptCharCount,
      truncatedResponse,
      modelSelectionSource: input.modelSelectionSource,
      questionTemplateId: input.questionTemplateId ?? null,
      questionTemplateLabel: input.questionTemplateLabel ?? null,
      includeCodeAiResponseExcerpt: input.includeCodeAiResponseExcerpt,
      includeBuilderPlanDecisionExcerpt: input.includeBuilderPlanDecisionExcerpt,
      includeImplementationReviewExcerpt: input.includeImplementationReviewExcerpt,
    };
    this.saved = record;
    this.lastFailureMessage = null;
    this.lastFailureAt = null;
    this.statusMessage = `Patch Draft ready (${record.modelName}). Draft only — NTTC did not edit files.`;
    return record;
  }

  recordFailure(message: string): void {
    this.lastFailureMessage = message;
    this.lastFailureAt = new Date().toISOString();
    this.statusMessage = message;
  }

  restoreSaved(record: PatchDraftRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.includeCodeAiResponseExcerpt = Boolean(
      record.includeCodeAiResponseExcerpt,
    );
    this.includeBuilderPlanDecisionExcerpt = Boolean(
      record.includeBuilderPlanDecisionExcerpt,
    );
    this.includeImplementationReviewExcerpt = Boolean(
      record.includeImplementationReviewExcerpt,
    );
    this.statusMessage = `Previous Patch Draft restored (${record.modelName}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.busy = false;
    this.lastFailureMessage = null;
    this.lastFailureAt = null;
    this.statusMessage =
      "Generate a Patch Draft from your approved Code Context Pack. NTTC will not edit files or apply patches.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Patch draft copy blocked",
        "Generate a Patch Draft first.",
      );
      this.statusMessage = "Generate a Patch Draft before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Patch draft copied",
      `${this.saved.modelName} patch draft copied to clipboard.`,
    );
    this.statusMessage = "Patch Draft copied to clipboard.";
  }
}
