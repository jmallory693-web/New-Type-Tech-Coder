import { assessArchitectureRefactorTaskBuilderHandoffReadiness } from "../../shared/assessArchitectureRefactorTaskBuilderHandoffReadiness";
import { buildArchitectureRefactorTaskBuilderHandoffMarkdown } from "../../shared/buildArchitectureRefactorTaskBuilderHandoff";
import {
  DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_STRICTNESS,
  DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TARGET,
  architectureRefactorHandoffSuggestedStatusHint,
} from "../../shared/architectureRefactorTasks/architectureRefactorTaskBuilderHandoffConstants";
import type {
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskBuilderHandoffRecord,
  ArchitectureRefactorTaskBuilderHandoffState,
  ArchitectureRefactorTaskCardsRecord,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
} from "../../shared/types";
import type { PlanningStyleId } from "../../shared/planningStyle";
import type { SafetyGate } from "../safety/SafetyGate";

const MAX_PREVIEW = 900;

/** Stage 104: Architecture Refactor Builder Handoff manager (text-only; no AI). */
export class ArchitectureRefactorTaskBuilderHandoffManager {
  private saved: ArchitectureRefactorTaskBuilderHandoffRecord | null = null;
  private selectedTaskId: string | null = null;
  private target: BuilderHandoffTarget =
    DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TARGET;
  private strictness: BuilderHandoffStrictness =
    DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_STRICTNESS;
  private statusMessage: string | null =
    "Select an Architecture Refactor Task Card and generate a focused builder handoff. Text-only — no automatic send.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): ArchitectureRefactorTaskBuilderHandoffState {
    return {
      saved: this.saved,
      selectedTaskId: this.selectedTaskId,
      target: this.target,
      strictness: this.strictness,
      statusMessage: this.statusMessage,
      suggestedNextStatus: this.saved
        ? architectureRefactorHandoffSuggestedStatusHint(this.saved.selectedTaskId)
        : null,
    };
  }

  getSaved(): ArchitectureRefactorTaskBuilderHandoffRecord | null {
    return this.saved;
  }

  setSelectedTaskId(taskId: string): { ok: boolean; message: string } {
    this.selectedTaskId = taskId;
    if (
      this.saved &&
      !this.saved.stale &&
      this.saved.selectedTaskId !== taskId
    ) {
      this.saved = { ...this.saved, stale: true };
      this.statusMessage =
        "Selected refactor task changed — previous handoff is stale. Regenerate.";
    }
    this.safetyGate.log(
      "info",
      "Architecture refactor builder handoff selected task changed",
      taskId,
    );
    this.statusMessage = `Selected refactor task: ${taskId}.`;
    return { ok: true, message: this.statusMessage };
  }

  setTarget(target: BuilderHandoffTarget): void {
    this.target = target;
    this.safetyGate.log(
      "info",
      "Architecture refactor builder handoff target changed",
      `Target: ${target}.`,
    );
    this.statusMessage = `Handoff target: ${target}.`;
  }

  setStrictness(strictness: BuilderHandoffStrictness): void {
    this.strictness = strictness;
    this.safetyGate.log(
      "info",
      "Architecture refactor builder handoff strictness changed",
      `Strictness: ${strictness}.`,
    );
    this.statusMessage = `Handoff strictness: ${strictness}.`;
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Architecture Refactor Builder Handoff is stale — regenerate after refactor cards or Architecture Health updates.";
    this.safetyGate.log(
      "info",
      "Architecture refactor builder handoff stale",
      reason,
    );
  }

  syncWithRefactorCards(record: ArchitectureRefactorTaskCardsRecord | null): void {
    if (!record) {
      if (this.saved) {
        this.saved = { ...this.saved, stale: true };
        this.statusMessage =
          "Refactor task cards cleared — previous handoff is stale.";
      }
      this.selectedTaskId = null;
      return;
    }

    if (record.stale && this.saved && !this.saved.stale) {
      this.markStale("Architecture Refactor Task Cards are stale.");
    }

    if (!this.selectedTaskId) {
      this.selectedTaskId =
        record.activeTaskId ?? record.cards[0]?.id ?? null;
    }

    const taskExists = record.cards.some((c) => c.id === this.selectedTaskId);
    if (!taskExists) {
      this.selectedTaskId = record.activeTaskId ?? record.cards[0]?.id ?? null;
      if (this.saved) {
        this.saved = { ...this.saved, stale: true };
        this.statusMessage =
          "Selected refactor task no longer exists — handoff marked stale. Regenerate.";
      }
      return;
    }

    if (this.saved && !this.saved.stale) {
      const card = record.cards.find((c) => c.id === this.saved!.selectedTaskId);
      if (
        card &&
        this.saved.sourceRefactorTaskUpdatedAt &&
        card.updatedAt !== this.saved.sourceRefactorTaskUpdatedAt
      ) {
        this.markStale("Selected refactor task status or content changed.");
      }
    }
  }

  syncWithArchitectureHealth(health: ArchitectureHealthRecord | null): void {
    if (!this.saved || this.saved.stale || !health) return;
    const stale =
      this.saved.sourceArchitectureHealthGeneratedAt !== health.generatedAt ||
      this.saved.sourceArchitectureHealthId !== health.id ||
      health.stale;
    if (stale) {
      this.markStale("Architecture Health report changed.");
    }
  }

  generate(input: {
    architectureHealth: ArchitectureHealthRecord | null;
    refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
    planningStyle: PlanningStyleId;
    changedFilesScan: ChangedFilesScanResult | null;
    changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  }): ArchitectureRefactorTaskBuilderHandoffRecord | null {
    const health = input.architectureHealth;
    const cards = input.refactorTaskCards;

    if (!health || health.stale) {
      this.statusMessage =
        "Generate a current Architecture Health Report before creating a refactor handoff.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor builder handoff blocked",
        "No current architecture health report.",
      );
      return null;
    }

    if (!cards?.cards.length || cards.stale) {
      this.statusMessage =
        "Generate current Architecture Refactor Task Cards first.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor builder handoff blocked",
        "No current refactor task cards.",
      );
      return null;
    }

    const taskId =
      this.selectedTaskId ??
      cards.activeTaskId ??
      cards.cards[0]?.id ??
      null;

    if (!taskId) {
      this.statusMessage =
        "Select a refactor task card before generating a handoff.";
      return null;
    }

    const task = cards.cards.find((c) => c.id === taskId);
    if (!task) {
      this.statusMessage =
        "Select a refactor task card before generating a handoff.";
      return null;
    }

    this.selectedTaskId = taskId;

    const readinessResult = assessArchitectureRefactorTaskBuilderHandoffReadiness({
      architectureHealth: health,
      refactorTaskCards: cards,
      selectedTask: task,
      selectedTaskId: taskId,
    });

    const generatedAt = new Date().toISOString();
    const markdown = buildArchitectureRefactorTaskBuilderHandoffMarkdown({
      architectureHealth: health,
      task,
      planningStyle: input.planningStyle,
      target: this.target,
      strictness: this.strictness,
      readiness: readinessResult.readiness,
      recommendation: readinessResult.recommendation,
      tooBroadWarning: readinessResult.tooBroadWarning,
      changedFilesScan: input.changedFilesScan,
      changedFilesTaskLink: input.changedFilesTaskLink,
      generatedAt,
    });

    const record: ArchitectureRefactorTaskBuilderHandoffRecord = {
      id: `arch-refactor-handoff-${Date.now().toString(36)}`,
      generatedAt,
      selectedTaskId: taskId,
      taskTitle: task.title,
      target: this.target,
      strictness: this.strictness,
      readiness: readinessResult.readiness,
      recommendation: readinessResult.recommendation,
      stale: false,
      copiedAt: null,
      tooBroadWarning: readinessResult.tooBroadWarning,
      sourceArchitectureHealthGeneratedAt: health.generatedAt,
      sourceArchitectureHealthId: health.id,
      sourceRefactorTaskUpdatedAt: task.updatedAt,
      sourceRefactorCardsGeneratedAt: cards.generatedAt,
      markdown,
      previewExcerpt:
        markdown.length > MAX_PREVIEW
          ? `${markdown.slice(0, MAX_PREVIEW - 1)}…`
          : markdown,
    };

    this.saved = record;

    const warnings: string[] = [];
    if (readinessResult.tooBroadWarning) {
      warnings.push(
        "This refactor task is too broad for safe implementation. Ask the builder for a narrower plan first.",
      );
    }
    if (readinessResult.readiness === "planning-only") {
      warnings.push("Handoff is planning-only until refactor card gaps are resolved.");
    }

    const base = `Architecture Refactor Builder Handoff ready for ${taskId} (${readinessResult.recommendation}).`;
    this.statusMessage =
      warnings.length > 0 ? `${base} ${warnings.join(" ")}` : base;

    this.safetyGate.log(
      "success",
      "Architecture refactor builder handoff generated",
      `${taskId} · ${readinessResult.readiness} · ${this.target}`,
    );
    return record;
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Architecture Refactor Builder Handoff cleared.";
    this.safetyGate.log(
      "info",
      "Architecture refactor builder handoff cleared",
      "User cleared handoff.",
    );
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.selectedTaskId = null;
    this.target = DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TARGET;
    this.strictness = DEFAULT_ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_STRICTNESS;
    this.statusMessage =
      "Select an Architecture Refactor Task Card and generate a focused builder handoff. Text-only — no automatic send.";
  }

  restoreFromHistory(input: {
    saved: ArchitectureRefactorTaskBuilderHandoffRecord | null;
    selectedTaskId: string | null;
    target: BuilderHandoffTarget;
    strictness: BuilderHandoffStrictness;
  }): void {
    this.saved = input.saved;
    this.selectedTaskId = input.selectedTaskId;
    this.target = input.target;
    this.strictness = input.strictness;
    if (input.saved) {
      this.statusMessage = `Architecture Refactor Builder Handoff restored (${input.saved.selectedTaskId} · ${input.saved.readiness}).`;
    }
  }

  recordCopy(): void {
    if (!this.saved) {
      this.statusMessage =
        "Generate an Architecture Refactor Builder Handoff before copying.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor builder handoff copy blocked",
        "No handoff generated.",
      );
      return;
    }
    const copiedAt = new Date().toISOString();
    this.saved = { ...this.saved, copiedAt };
    this.safetyGate.log(
      "success",
      "Architecture refactor builder handoff copied",
      `Task ${this.saved.selectedTaskId} handoff copied (markdown).`,
    );
    this.statusMessage = "Architecture Refactor Builder Handoff copied to clipboard.";
  }
}
