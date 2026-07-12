import type {
  BuilderPlanComparisonRecord,
  BuilderPlanComparisonState,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

/**
 * Stage 40: stores the latest Builder Plan Comparison Report (app-owned).
 * Rule-based only — no Ollama, no file edits, no commands.
 */
export class BuilderPlanComparisonManager {
  private saved: BuilderPlanComparisonRecord | null = null;
  private statusMessage: string | null =
    "Paste and save a builder plan, then generate a Comparison Report. Rule-based only — does not call Ollama or edit files.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BuilderPlanComparisonState {
    return {
      saved: this.saved,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): BuilderPlanComparisonRecord | null {
    return this.saved;
  }

  setStatus(message: string): void {
    this.statusMessage = message;
  }

  saveGenerated(record: BuilderPlanComparisonRecord): BuilderPlanComparisonRecord {
    this.saved = record;
    this.statusMessage = record.weakComparison
      ? `Comparison ready (weaker — no NTTC Builder Plan). Recommendation: ${record.recommendation}`
      : `Comparison ready. Recommendation: ${record.recommendation}`;
    return record;
  }

  restoreSaved(record: BuilderPlanComparisonRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.statusMessage = `Previous Builder Plan Comparison restored (${record.recommendation}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.statusMessage =
      "Paste and save a builder plan, then generate a Comparison Report. Rule-based only — does not call Ollama or edit files.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Builder plan comparison copy blocked",
        "Generate a Builder Plan Comparison Report first.",
      );
      this.statusMessage = "Generate a Comparison Report before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Builder plan comparison copied",
      `Copied comparison (${this.saved.recommendation}).`,
    );
    this.statusMessage = "Builder Plan Comparison Report copied to clipboard.";
  }
}
