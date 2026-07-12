import type {
  PatchDraftSafetyReviewRecord,
  PatchDraftSafetyReviewState,
  PatchDraftSafetyReviewTargetKind,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

/** Stage 60/67: latest Patch Draft Safety Review (rule-based; app-owned). */
export class PatchDraftSafetyReviewManager {
  private saved: PatchDraftSafetyReviewRecord | null = null;
  private reviewTarget: PatchDraftSafetyReviewTargetKind = "nttc-patch-draft";
  private statusMessage: string | null =
    "Generate a Patch Draft first, then run a rule-based Patch Draft Safety Review. No Ollama — review only.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): PatchDraftSafetyReviewState {
    return {
      saved: this.saved,
      statusMessage: this.statusMessage,
      reviewTarget: this.reviewTarget,
    };
  }

  getSaved(): PatchDraftSafetyReviewRecord | null {
    return this.saved;
  }

  getReviewTarget(): PatchDraftSafetyReviewTargetKind {
    return this.reviewTarget;
  }

  setReviewTarget(target: unknown): void {
    if (target === "imported-patch-draft" || target === "nttc-patch-draft") {
      this.reviewTarget = target;
      this.safetyGate.log(
        "info",
        "Patch draft safety review target selected",
        target === "imported-patch-draft"
          ? "Imported Patch Draft"
          : "NTTC Patch Draft",
      );
    }
  }

  setStatus(message: string): void {
    this.statusMessage = message;
  }

  saveGenerated(
    record: PatchDraftSafetyReviewRecord,
  ): PatchDraftSafetyReviewRecord {
    this.saved = record;
    this.reviewTarget = record.reviewTargetKind;
    this.statusMessage = `Patch Draft Safety Review ready (${record.reviewTargetLabel}). Recommendation: ${record.recommendation}`;
    return record;
  }

  restoreSaved(record: PatchDraftSafetyReviewRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.reviewTarget =
      record.reviewTargetKind === "imported-patch-draft"
        ? "imported-patch-draft"
        : "nttc-patch-draft";
    this.statusMessage = `Previous Patch Draft Safety Review restored (${record.recommendation}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.reviewTarget = "nttc-patch-draft";
    this.statusMessage =
      "Generate a Patch Draft first, then run a rule-based Patch Draft Safety Review. No Ollama — review only.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Patch draft safety review copy blocked",
        "Generate a Patch Draft Safety Review first.",
      );
      this.statusMessage = "Generate a Patch Draft Safety Review before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Patch draft safety review copied",
      `Copied safety review (${this.saved.recommendation}).`,
    );
    this.statusMessage = "Patch Draft Safety Review copied to clipboard.";
  }
}
