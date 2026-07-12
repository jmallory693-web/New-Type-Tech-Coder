import type {
  ActiveProviderKind,
  BuilderPlanRecord,
  BuilderPlanState,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import { extractBuilderPlanRecommendation } from "../providers/buildBuilderPlanPrompt";

const MAX_PLAN_CHARS = 40_000;
const MAX_PREVIEW_CHARS = 900;

export class BuilderPlanManager {
  private includeExternalReviewExcerpt = false;
  private includeBuilderResultExcerpt = false;
  private saved: BuilderPlanRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    "Generate a plan-only Builder Plan with your local AI. This does not edit files.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BuilderPlanState {
    return {
      includeExternalReviewExcerpt: this.includeExternalReviewExcerpt,
      includeBuilderResultExcerpt: this.includeBuilderResultExcerpt,
      saved: this.saved,
      statusMessage: this.statusMessage,
      busy: this.busy,
    };
  }

  getSaved(): BuilderPlanRecord | null {
    return this.saved;
  }

  getOptions() {
    return {
      includeExternalReviewExcerpt: this.includeExternalReviewExcerpt,
      includeBuilderResultExcerpt: this.includeBuilderResultExcerpt,
    };
  }

  setIncludeExternal(include: unknown): void {
    this.includeExternalReviewExcerpt = Boolean(include);
  }

  setIncludeBuilderResult(include: unknown): void {
    this.includeBuilderResultExcerpt = Boolean(include);
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
    planText: string;
    modelName: string;
    providerType: ActiveProviderKind;
    baseUrl: string;
    userRequest: string;
    projectName: string | null;
    projectPath: string | null;
    includeExternalReviewExcerpt: boolean;
    includeBuilderResultExcerpt: boolean;
    promptCharCount: number;
    limitedContext: boolean;
    modelSelectionSource?: import("../../shared/types").ModelSelectionSource;
  }): BuilderPlanRecord {
    const original = input.planText;
    const truncated = original.length > MAX_PLAN_CHARS;
    const planText = truncated
      ? `${original.slice(0, MAX_PLAN_CHARS - 1)}…`
      : original;
    const previewExcerpt =
      planText.length > MAX_PREVIEW_CHARS
        ? `${planText.slice(0, MAX_PREVIEW_CHARS - 1)}…`
        : planText;
    const record: BuilderPlanRecord = {
      id: `builder-plan-${Date.now().toString(36)}`,
      generatedAt: new Date().toISOString(),
      modelName: input.modelName,
      providerType: input.providerType,
      baseUrl: input.baseUrl,
      userRequest: input.userRequest.trim().slice(0, 4000),
      projectName: input.projectName,
      projectPath: input.projectPath,
      includeExternalReviewExcerpt: input.includeExternalReviewExcerpt,
      includeBuilderResultExcerpt: input.includeBuilderResultExcerpt,
      planText,
      previewExcerpt,
      recommendation: extractBuilderPlanRecommendation(planText),
      promptCharCount: input.promptCharCount,
      truncated,
      limitedContext: input.limitedContext,
      modelSelectionSource: input.modelSelectionSource,
    };
    this.saved = record;
    this.statusMessage = `Builder Plan ready (${record.modelName}). Plan-only — does not edit files.`;
    return record;
  }

  restoreSaved(record: BuilderPlanRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.includeExternalReviewExcerpt = Boolean(
      record.includeExternalReviewExcerpt,
    );
    this.includeBuilderResultExcerpt = Boolean(
      record.includeBuilderResultExcerpt,
    );
    this.statusMessage = `Previous Builder Plan restored (${record.modelName}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage =
      "Generate a plan-only Builder Plan with your local AI. This does not edit files.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Builder Plan copy blocked",
        "Generate a Builder Plan first.",
      );
      this.statusMessage = "Generate a Builder Plan before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Builder Plan copied",
      `${this.saved.modelName} plan copied to clipboard.`,
    );
    this.statusMessage = "Builder Plan copied to clipboard.";
  }
}
