import type {
  ImplementationReviewRecord,
  ImplementationReviewState,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

/**
 * Stage 42: stores the latest Implementation Review Report (app-owned).
 * Rule-based only — no Ollama, no file edits, no commands.
 */
export class ImplementationReviewManager {
  private saved: ImplementationReviewRecord | null = null;
  private statusMessage: string | null =
    "Paste and save an Implementation report, then generate an Implementation Review. Rule-based only — does not call Ollama or edit files.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): ImplementationReviewState {
    return {
      saved: this.saved,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): ImplementationReviewRecord | null {
    return this.saved;
  }

  setStatus(message: string): void {
    this.statusMessage = message;
  }

  saveGenerated(record: ImplementationReviewRecord): ImplementationReviewRecord {
    this.saved = record;
    this.statusMessage = record.weakAlignment
      ? `Implementation Review ready (weaker — no approved plan/comparison). Recommendation: ${record.recommendation}`
      : `Implementation Review ready. Recommendation: ${record.recommendation}`;
    return record;
  }

  restoreSaved(record: ImplementationReviewRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.statusMessage = `Previous Implementation Review restored (${record.recommendation}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.statusMessage =
      "Paste and save an Implementation report, then generate an Implementation Review. Rule-based only — does not call Ollama or edit files.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Implementation review copy blocked",
        "Generate an Implementation Review Report first.",
      );
      this.statusMessage = "Generate an Implementation Review before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Implementation review copied",
      `Copied implementation review (${this.saved.recommendation}).`,
    );
    this.statusMessage = "Implementation Review Report copied to clipboard.";
  }
}
