import { buildBlueprintTaskReconciliation } from "../../shared/buildBlueprintTaskReconciliation";
import type {
  BlueprintCompletenessReport,
  BlueprintPhaseTaskCardsRecord,
  BlueprintTaskReconciliationRecord,
  BlueprintTaskReconciliationState,
  BuilderResultRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
  TaskCardBuilderHandoffRecord,
  TaskImplementationReportRecord,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import type { PlanningStyleId } from "../../shared/planningStyle";

const MAX_PREVIEW = 1200;

function normalizeRecord(
  raw: BlueprintTaskReconciliationRecord,
): BlueprintTaskReconciliationRecord {
  return {
    id: raw.id,
    generatedAt: raw.generatedAt,
    sourceTaskCardsGeneratedAt: raw.sourceTaskCardsGeneratedAt ?? null,
    taskCardCount: raw.taskCardCount ?? 0,
    contractFieldsMissing: Boolean(raw.contractFieldsMissing),
    missingProducerCount: raw.missingProducerCount ?? 0,
    duplicateOverlapCount: raw.duplicateOverlapCount ?? 0,
    monolithRiskCount: raw.monolithRiskCount ?? 0,
    statusInconsistencyCount: raw.statusInconsistencyCount ?? 0,
    implementationInconsistencyCount: raw.implementationInconsistencyCount ?? 0,
    safetyGapCount: raw.safetyGapCount ?? 0,
    smallModelGapCount: raw.smallModelGapCount ?? 0,
    recommendation: raw.recommendation ?? "Needs clarification",
    stale: Boolean(raw.stale),
    markdown: raw.markdown ?? "",
    previewExcerpt: raw.previewExcerpt ?? "",
  };
}

/** Stage 92: Blueprint Task Reconciliation manager (text-only; no AI). */
export class BlueprintTaskReconciliationManager {
  private saved: BlueprintTaskReconciliationRecord | null = null;
  private statusMessage: string | null =
    "Generate a rule-based reconciliation report to check whether phase task cards fit together.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): BlueprintTaskReconciliationRecord | null {
    return this.saved ? { ...this.saved } : null;
  }

  getState(): BlueprintTaskReconciliationState {
    return {
      saved: this.saved ? { ...this.saved } : null,
      statusMessage: this.statusMessage,
    };
  }

  syncWithTaskCards(taskCards: BlueprintPhaseTaskCardsRecord | null): void {
    if (!this.saved) return;
    if (!taskCards) {
      this.saved = { ...this.saved, stale: true };
      this.statusMessage = "Task cards cleared — reconciliation report marked stale.";
      this.safetyGate.log(
        "info",
        "Reconciliation report stale",
        "Task cards cleared.",
      );
      return;
    }
    if (
      this.saved.sourceTaskCardsGeneratedAt &&
      this.saved.sourceTaskCardsGeneratedAt !== taskCards.generatedAt
    ) {
      this.saved = { ...this.saved, stale: true };
      this.statusMessage =
        "Task cards changed after this reconciliation report. Regenerate report.";
      this.safetyGate.log(
        "info",
        "Reconciliation report stale",
        "Task cards regenerated.",
      );
    }
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Linked artifacts changed after this reconciliation report. Regenerate report.";
    this.safetyGate.log("info", "Reconciliation report stale", reason);
  }

  generate(input: {
    taskCards: BlueprintPhaseTaskCardsRecord | null;
    taskCardHandoff: TaskCardBuilderHandoffRecord | null;
    implementationReports: Record<string, TaskImplementationReportRecord>;
    completeness: BlueprintCompletenessReport | null;
    planningStyle: PlanningStyleId;
    builderResult?: BuilderResultRecord | null;
    changedFilesScan?: ChangedFilesScanResult | null;
    changedFilesTaskLink?: ChangedFilesTaskLinkRecord | null;
  }): BlueprintTaskReconciliationRecord | null {
    if (!input.taskCards?.cards.length) {
      this.statusMessage = "Generate Blueprint Phase Task Cards first.";
      this.safetyGate.log(
        "warning",
        "Task reconciliation blocked",
        "No task cards.",
      );
      return null;
    }

    const result = buildBlueprintTaskReconciliation({
      taskCards: input.taskCards,
      taskCardHandoff: input.taskCardHandoff,
      implementationReports: input.implementationReports,
      builderResult: input.builderResult ?? null,
      changedFilesScan: input.changedFilesScan ?? null,
      changedFilesTaskLink: input.changedFilesTaskLink ?? null,
      completeness: input.completeness,
      planningStyle: input.planningStyle,
      sourceTaskCardsGeneratedAt: input.taskCards.generatedAt,
    });

    const record: BlueprintTaskReconciliationRecord = {
      id: `task-recon-${Date.now().toString(36)}`,
      generatedAt: result.generatedAt,
      sourceTaskCardsGeneratedAt: input.taskCards.generatedAt,
      taskCardCount: result.taskCardCount,
      contractFieldsMissing: result.contractFieldsMissing,
      missingProducerCount: result.missingProducerCount,
      duplicateOverlapCount: result.duplicateOverlapCount,
      monolithRiskCount: result.monolithRiskCount,
      statusInconsistencyCount: result.statusInconsistencyCount,
      implementationInconsistencyCount: result.implementationInconsistencyCount,
      safetyGapCount: result.safetyGapCount,
      smallModelGapCount: result.smallModelGapCount,
      recommendation: result.recommendation,
      stale: false,
      markdown: result.markdown,
      previewExcerpt:
        result.markdown.length > MAX_PREVIEW
          ? `${result.markdown.slice(0, MAX_PREVIEW - 1)}…`
          : result.markdown,
    };

    this.saved = record;
    this.statusMessage = `Reconciliation report ready — **${result.recommendation}** (${result.flags.length} flag(s)).`;

    this.safetyGate.log(
      "success",
      "Reconciliation report generated",
      `${result.taskCardCount} cards · ${result.recommendation}`,
    );

    if (result.missingProducerCount > 0) {
      this.safetyGate.log(
        "warning",
        "Missing producers detected",
        `${result.missingProducerCount} missing producer flag(s).`,
      );
    }
    if (result.monolithRiskCount > 0) {
      this.safetyGate.log(
        "warning",
        "Monolith risk detected",
        `${result.monolithRiskCount} monolith risk flag(s).`,
      );
    }
    if (result.statusInconsistencyCount > 0) {
      this.safetyGate.log(
        "warning",
        "Status inconsistency detected",
        `${result.statusInconsistencyCount} status flag(s).`,
      );
    }

    return record;
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Reconciliation report cleared.";
    this.safetyGate.log("info", "Reconciliation report cleared", "User cleared report.");
  }

  recordCopy(): string | null {
    if (!this.saved) {
      this.statusMessage = "Generate a Reconciliation Report before copying.";
      this.safetyGate.log(
        "warning",
        "Reconciliation report copy blocked",
        "No saved report.",
      );
      return null;
    }
    this.safetyGate.log(
      "info",
      "Reconciliation report copied",
      `Recommendation: ${this.saved.recommendation}.`,
    );
    this.statusMessage = "Reconciliation report copied to clipboard (text only).";
    return this.saved.markdown;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.statusMessage =
      "Generate a rule-based reconciliation report to check whether phase task cards fit together.";
  }

  restoreSaved(record: BlueprintTaskReconciliationRecord | null | undefined): void {
    this.saved = record ? normalizeRecord(record) : null;
    if (this.saved) {
      this.statusMessage = `Reconciliation report restored (${this.saved.recommendation}${this.saved.stale ? ", stale" : ""}).`;
    }
  }
}
