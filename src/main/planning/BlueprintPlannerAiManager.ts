import { buildBlueprintCompletenessReport } from "../../shared/buildBlueprintCompleteness";
import type { BlueprintSource } from "../../shared/blueprintConstants";
import { detectBlueprintSections } from "../../shared/extractBlueprintSections";
import type {
  ActiveProviderKind,
  BlueprintPlannerAiRecord,
  BlueprintPlannerAiState,
  ModelSelectionSource,
} from "../../shared/types";
import type { BlueprintManager } from "./BlueprintManager";
import type { SafetyGate } from "../safety/SafetyGate";

const MAX_RESPONSE_CHARS = 80_000;
const MAX_PREVIEW_CHARS = 900;

export class BlueprintPlannerAiManager {
  private saved: BlueprintPlannerAiRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    "Optional: ask Local Planner AI to draft a blueprint from idea fields only. It does not read project files or write code.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BlueprintPlannerAiState {
    return {
      saved: this.saved,
      busy: this.busy,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): BlueprintPlannerAiRecord | null {
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
    promptCharCount: number;
    plannerQuestionsGenerated: boolean;
    modelSelectionSource?: ModelSelectionSource;
    elapsedMs: number;
  }): BlueprintPlannerAiRecord {
    const original = input.responseText;
    const truncatedResponse = original.length > MAX_RESPONSE_CHARS;
    const responseText = truncatedResponse
      ? `${original.slice(0, MAX_RESPONSE_CHARS - 1)}…`
      : original;
    const previewExcerpt =
      responseText.length > MAX_PREVIEW_CHARS
        ? `${responseText.slice(0, MAX_PREVIEW_CHARS - 1)}…`
        : responseText;
    const detection = detectBlueprintSections(responseText);
    const completeness = buildBlueprintCompletenessReport(responseText);

    const record: BlueprintPlannerAiRecord = {
      id: `blueprint-planner-ai-${Date.now().toString(36)}`,
      generatedAt: new Date().toISOString(),
      modelName: input.modelName,
      providerType: input.providerType,
      baseUrl: input.baseUrl,
      roleMode: "Blueprint Planner",
      mappingKey: "blueprint-planner",
      responseText,
      previewExcerpt,
      promptCharCount: input.promptCharCount,
      truncatedResponse,
      modelSelectionSource: input.modelSelectionSource,
      elapsedMs: input.elapsedMs,
      sectionsPresent: detection.present,
      sectionsMissing: detection.missing,
      readinessEstimate: completeness.readiness,
      plannerQuestionsGenerated: input.plannerQuestionsGenerated,
      savedAsImportedBlueprint: false,
    };
    this.saved = record;
    this.statusMessage = `Local Planner Blueprint Draft ready (${record.modelName}). Review before saving as official blueprint.`;
    return record;
  }

  saveDraftAsImported(
    blueprintManager: BlueprintManager,
    source: BlueprintSource = "local-planner-ai",
  ): { ok: boolean; message: string } {
    if (!this.saved) {
      const message = "Ask Local Planner AI first.";
      this.statusMessage = message;
      this.safetyGate.log(
        "warning",
        "Local Planner Draft save blocked",
        message,
      );
      return { ok: false, message };
    }
    const result = blueprintManager.importBlueprintText(
      this.saved.responseText,
      source,
    );
    if (result.ok && this.saved) {
      this.saved = { ...this.saved, savedAsImportedBlueprint: true };
      this.statusMessage =
        "Local Planner Draft saved as imported blueprint. Run Blueprint Completeness next.";
      this.safetyGate.log(
        "success",
        "Local Planner Draft saved as Blueprint",
        `Source: ${source}; sections present: ${this.saved.sectionsPresent.length}.`,
      );
    }
    return result;
  }

  restoreSaved(record: BlueprintPlannerAiRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.statusMessage = `Local Planner Blueprint Draft restored (${record.modelName}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage =
      "Optional: ask Local Planner AI to draft a blueprint from idea fields only. It does not read project files or write code.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Local Planner Blueprint copy blocked",
        "Ask Local Planner AI first.",
      );
      this.statusMessage = "Generate a Local Planner Blueprint Draft before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Local Planner Blueprint copied",
      `${this.saved.modelName} draft copied to clipboard.`,
    );
    this.statusMessage = "Local Planner Blueprint Draft copied to clipboard.";
  }
}
