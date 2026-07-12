import type {
  ExternalPatchDraftComparisonRecord,
  ExternalPatchDraftComparisonState,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

/** Stage 71: stores latest External Patch Draft Comparison (rule-based; app-owned). */
export class ExternalPatchDraftComparisonManager {
  private saved: ExternalPatchDraftComparisonRecord | null = null;
  private statusMessage: string | null =
    "Generate or import patch drafts, then run External Patch Draft Comparison. Rule-based only — does not call AI or edit files.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): ExternalPatchDraftComparisonState {
    return {
      saved: this.saved,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): ExternalPatchDraftComparisonRecord | null {
    return this.saved;
  }

  setStatus(message: string): void {
    this.statusMessage = message;
  }

  saveGenerated(
    record: ExternalPatchDraftComparisonRecord,
  ): ExternalPatchDraftComparisonRecord {
    this.saved = record;
    this.statusMessage = record.partialComparison
      ? `Partial comparison ready. Risk: ${record.riskLevel}. Recommendation: ${record.recommendation}`
      : `Comparison ready. Risk: ${record.riskLevel}. Recommendation: ${record.recommendation}`;
    return record;
  }

  restoreSaved(record: ExternalPatchDraftComparisonRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.statusMessage = `Previous External Patch Draft Comparison restored (${record.recommendation}).`;
  }

  clearSaved(): void {
    this.saved = null;
    this.statusMessage =
      "External Patch Draft Comparison cleared. Generate a new comparison when ready.";
    this.safetyGate.log(
      "info",
      "External patch draft comparison cleared",
      "Comparison report removed from session.",
    );
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.statusMessage =
      "Generate or import patch drafts, then run External Patch Draft Comparison. Rule-based only — does not call AI or edit files.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "External patch draft comparison copy blocked",
        "Generate an External Patch Draft Comparison first.",
      );
      this.statusMessage = "Generate a comparison report before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "External patch draft comparison copied",
      `Copied comparison (${this.saved.riskLevel} · ${this.saved.recommendation}).`,
    );
    this.statusMessage = "External Patch Draft Comparison copied to clipboard.";
  }
}
