import type {
  BuilderHandoffExportRecord,
  BuilderHandoffExportState,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
} from "../../shared/types";
import {
  DEFAULT_BUILDER_HANDOFF_STRICTNESS,
  DEFAULT_BUILDER_HANDOFF_TARGET,
} from "../../shared/builderHandoffExportConstants";
import type { SafetyGate } from "../safety/SafetyGate";

/** Stage 73: stores latest Builder Handoff Pack (rule-based; text-only). */
export class BuilderHandoffExportManager {
  private saved: BuilderHandoffExportRecord | null = null;
  private target: BuilderHandoffTarget = DEFAULT_BUILDER_HANDOFF_TARGET;
  private strictness: BuilderHandoffStrictness = DEFAULT_BUILDER_HANDOFF_STRICTNESS;
  private statusMessage: string | null =
    "Generate a handoff pack from reviewed patch-planning work. Rule-based only — does not call AI, read source files, or edit project files.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BuilderHandoffExportState {
    return {
      saved: this.saved,
      statusMessage: this.statusMessage,
      target: this.target,
      strictness: this.strictness,
    };
  }

  getSaved(): BuilderHandoffExportRecord | null {
    return this.saved;
  }

  getTarget(): BuilderHandoffTarget {
    return this.target;
  }

  getStrictness(): BuilderHandoffStrictness {
    return this.strictness;
  }

  setStatus(message: string): void {
    this.statusMessage = message;
  }

  setTarget(target: BuilderHandoffTarget): void {
    this.target = target;
    this.safetyGate.log(
      "info",
      "Builder handoff target selected",
      `Target: ${target}.`,
    );
    this.statusMessage = `Handoff target: ${target}.`;
  }

  setStrictness(strictness: BuilderHandoffStrictness): void {
    this.strictness = strictness;
    this.safetyGate.log(
      "info",
      "Builder handoff strictness selected",
      `Strictness: ${strictness}.`,
    );
    this.statusMessage = `Handoff strictness: ${strictness}.`;
  }

  saveGenerated(record: BuilderHandoffExportRecord): BuilderHandoffExportRecord {
    this.saved = record;
    this.target = record.target;
    this.strictness = record.strictness;
    this.statusMessage = `Builder Handoff Pack ready. Recommendation: ${record.recommendation}.`;
    return record;
  }

  restoreSaved(record: BuilderHandoffExportRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.target = record.target;
    this.strictness = record.strictness;
    this.statusMessage = `Previous Builder Handoff Pack restored (${record.recommendation}).`;
  }

  clearSaved(): void {
    this.saved = null;
    this.statusMessage =
      "Builder Handoff Pack cleared. Generate a new handoff when ready.";
    this.safetyGate.log(
      "info",
      "Builder handoff pack cleared",
      "Handoff report removed from session.",
    );
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.target = DEFAULT_BUILDER_HANDOFF_TARGET;
    this.strictness = DEFAULT_BUILDER_HANDOFF_STRICTNESS;
    this.statusMessage =
      "Generate a handoff pack from reviewed patch-planning work. Rule-based only — does not call AI, read source files, or edit project files.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Builder handoff pack copy blocked",
        "Generate a Builder Handoff Pack first.",
      );
      this.statusMessage = "Generate a handoff pack before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Builder handoff pack copied",
      `Copied handoff (${this.saved.target} · ${this.saved.recommendation}).`,
    );
    this.statusMessage = "Builder Handoff Pack copied to clipboard.";
  }
}
