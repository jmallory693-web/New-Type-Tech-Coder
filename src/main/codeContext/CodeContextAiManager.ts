import type {
  ActiveProviderKind,
  CodeContextAiRecord,
  CodeContextAiState,
  CodeContextPack,
  ModelSelectionSource,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import { extractCodeContextAiRecommendation } from "./buildCodeContextAiPrompt";

const MAX_RESPONSE_CHARS = 40_000;
const MAX_PREVIEW_CHARS = 900;

export class CodeContextAiManager {
  private saved: CodeContextAiRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    "Generate a Code Context Pack preview first, then ask Local AI about the approved excerpts.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): CodeContextAiState {
    return {
      saved: this.saved,
      busy: this.busy,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): CodeContextAiRecord | null {
    return this.saved;
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
    responseText: string;
    modelName: string;
    providerType: ActiveProviderKind;
    baseUrl: string;
    userQuestion: string;
    pack: CodeContextPack;
    promptCharCount: number;
    modelSelectionSource?: ModelSelectionSource;
    questionTemplateId?: string | null;
    questionTemplateLabel?: string | null;
  }): CodeContextAiRecord {
    const original = input.responseText;
    const truncatedResponse = original.length > MAX_RESPONSE_CHARS;
    const responseText = truncatedResponse
      ? `${original.slice(0, MAX_RESPONSE_CHARS - 1)}…`
      : original;
    const previewExcerpt =
      responseText.length > MAX_PREVIEW_CHARS
        ? `${responseText.slice(0, MAX_PREVIEW_CHARS - 1)}…`
        : responseText;

    const record: CodeContextAiRecord = {
      id: `code-ai-${Date.now().toString(36)}`,
      generatedAt: new Date().toISOString(),
      modelName: input.modelName,
      providerType: input.providerType,
      baseUrl: input.baseUrl,
      roleMode: "Code Reviewer",
      mappingKey: "code-context-review",
      userQuestion: input.userQuestion.trim().slice(0, 4000),
      contextPackGeneratedAt: input.pack.generatedAt,
      selectedFileCount: input.pack.selectedFileCount,
      warningCount: input.pack.warningCount,
      truncated: input.pack.truncated,
      responseText,
      previewExcerpt,
      recommendedNextStep: extractCodeContextAiRecommendation(responseText),
      promptCharCount: input.promptCharCount,
      truncatedResponse,
      modelSelectionSource: input.modelSelectionSource,
      questionTemplateId: input.questionTemplateId ?? null,
      questionTemplateLabel: input.questionTemplateLabel ?? null,
    };
    this.saved = record;
    this.statusMessage = `Code AI response ready (${record.modelName}). Review/advice only — no files edited.`;
    return record;
  }

  restoreSaved(record: CodeContextAiRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.statusMessage = `Previous Code AI response restored (${record.modelName}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage =
      "Generate a Code Context Pack preview first, then ask Local AI about the approved excerpts.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Code AI response copy blocked",
        "Ask Local AI About Selected Code first.",
      );
      this.statusMessage = "Generate a Code AI response before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Code AI response copied",
      `${this.saved.modelName} response copied to clipboard.`,
    );
    this.statusMessage = "Code AI response copied to clipboard.";
  }
}
