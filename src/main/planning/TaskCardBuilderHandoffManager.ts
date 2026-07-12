import { assessTaskCardBuilderHandoffReadiness } from "../../shared/assessTaskCardBuilderHandoffReadiness";
import { buildTaskCardBuilderHandoffMarkdown } from "../../shared/buildTaskCardBuilderHandoff";
import { buildJoinKeyFromTaskCard } from "../../shared/buildTaskJoinKey";
import { TASK_ARTIFACT_KINDS } from "../../shared/taskJoinKeyConstants";
import {
  DEFAULT_TASK_CARD_BUILDER_HANDOFF_STRICTNESS,
  DEFAULT_TASK_CARD_BUILDER_HANDOFF_TARGET,
  TASK_CARD_HANDOFF_SUGGESTED_STATUS_HINT,
} from "../../shared/taskCardBuilderHandoffConstants";
import type {
  BlueprintPhaseTaskCardsRecord,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
  TaskCardBuilderHandoffRecord,
  TaskCardBuilderHandoffState,
} from "../../shared/types";
import type { BlueprintManager } from "./BlueprintManager";
import type { BlueprintTaskCardsManager } from "./BlueprintTaskCardsManager";
import type { SafetyGate } from "../safety/SafetyGate";
import type { PlanningStyleId } from "../../shared/planningStyle";

const MAX_PREVIEW = 900;

/** Stage 88: Task Card Builder Handoff manager (text-only; no AI). */
export class TaskCardBuilderHandoffManager {
  private saved: TaskCardBuilderHandoffRecord | null = null;
  private selectedTaskId: string | null = null;
  private target: BuilderHandoffTarget = DEFAULT_TASK_CARD_BUILDER_HANDOFF_TARGET;
  private strictness: BuilderHandoffStrictness =
    DEFAULT_TASK_CARD_BUILDER_HANDOFF_STRICTNESS;
  private statusMessage: string | null =
    "Select a phase task card and generate a focused builder handoff. Text-only — no automatic send.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): TaskCardBuilderHandoffState {
    return {
      saved: this.saved,
      selectedTaskId: this.selectedTaskId,
      target: this.target,
      strictness: this.strictness,
      statusMessage: this.statusMessage,
      suggestedNextStatus: this.saved ? TASK_CARD_HANDOFF_SUGGESTED_STATUS_HINT : null,
    };
  }

  getSaved(): TaskCardBuilderHandoffRecord | null {
    return this.saved;
  }

  setSelectedTaskId(taskId: string): { ok: boolean; message: string } {
    this.selectedTaskId = taskId;
    this.safetyGate.log(
      "info",
      "Task builder handoff selected task changed",
      taskId,
    );
    this.statusMessage = `Selected task: ${taskId}.`;
    return { ok: true, message: this.statusMessage };
  }

  setTarget(target: BuilderHandoffTarget): void {
    this.target = target;
    this.safetyGate.log(
      "info",
      "Task builder handoff target changed",
      `Target: ${target}.`,
    );
    this.statusMessage = `Handoff target: ${target}.`;
  }

  setStrictness(strictness: BuilderHandoffStrictness): void {
    this.strictness = strictness;
    this.safetyGate.log(
      "info",
      "Task builder handoff strictness changed",
      `Strictness: ${strictness}.`,
    );
    this.statusMessage = `Handoff strictness: ${strictness}.`;
  }

  syncWithTaskCards(record: BlueprintPhaseTaskCardsRecord | null): void {
    if (!record) {
      if (this.saved) {
        this.saved = { ...this.saved, stale: true };
        this.statusMessage = "Task cards cleared — previous handoff is stale.";
      }
      this.selectedTaskId = null;
      return;
    }

    if (!this.selectedTaskId) {
      this.selectedTaskId = record.activeTaskId ?? record.cards[0]?.id ?? null;
    }

    const taskExists = record.cards.some((c) => c.id === this.selectedTaskId);
    if (!taskExists) {
      this.selectedTaskId = record.activeTaskId ?? record.cards[0]?.id ?? null;
      if (this.saved) {
        this.saved = { ...this.saved, stale: true };
        this.statusMessage =
          "Selected task no longer exists — handoff marked stale. Regenerate.";
      }
    }
  }

  generate(
    blueprintManager: BlueprintManager,
    taskCardsManager: BlueprintTaskCardsManager,
    planningStyle: PlanningStyleId,
  ): TaskCardBuilderHandoffRecord | null {
    const bp = blueprintManager.getState();
    const taskCards = taskCardsManager.getSaved();

    if (!bp.importedBlueprint) {
      this.statusMessage =
        "Save or import a Project Blueprint before generating task handoff.";
      this.safetyGate.log(
        "warning",
        "Task builder handoff blocked",
        "No imported blueprint.",
      );
      return null;
    }

    if (!taskCards?.cards.length) {
      this.statusMessage = "Generate Blueprint Phase Task Cards first.";
      this.safetyGate.log(
        "warning",
        "Task builder handoff blocked",
        "No task cards.",
      );
      return null;
    }

    const taskId =
      this.selectedTaskId ??
      taskCards.activeTaskId ??
      taskCards.cards[0]?.id ??
      null;

    if (!taskId) {
      this.statusMessage = "Select a task card before generating a handoff.";
      return null;
    }

    const task = taskCards.cards.find((c) => c.id === taskId);
    if (!task) {
      this.statusMessage = "Select a task card before generating a handoff.";
      return null;
    }

    this.selectedTaskId = taskId;

    const readinessResult = assessTaskCardBuilderHandoffReadiness({
      blueprintImported: bp.importedBlueprint,
      completeness: bp.completenessReport,
      selectedTask: task,
      selectedTaskId: taskId,
    });

    const generatedAt = new Date().toISOString();
    const markdown = buildTaskCardBuilderHandoffMarkdown({
      intake: bp.intake,
      imported: bp.importedBlueprint,
      completeness: bp.completenessReport,
      phase1Handoff: bp.phase1Handoff,
      planningStyle,
      target: this.target,
      strictness: this.strictness,
      task,
      readiness: readinessResult.readiness,
      tooBroadWarning: readinessResult.tooBroadWarning,
      generatedAt,
    });

    const joinKey = buildJoinKeyFromTaskCard(
      task,
      taskCards.generatedAt,
      TASK_ARTIFACT_KINDS.builderHandoff,
    );

    const record: TaskCardBuilderHandoffRecord = {
      id: `task-handoff-${Date.now().toString(36)}`,
      generatedAt,
      selectedTaskId: taskId,
      target: this.target,
      strictness: this.strictness,
      readiness: readinessResult.readiness,
      recommendation: readinessResult.recommendation,
      stale: false,
      copiedAt: null,
      tooBroadWarning: readinessResult.tooBroadWarning,
      sourceBlueprintImportedAt: bp.importedBlueprint.importedAt,
      sourceTaskCardUpdatedAt: task.updatedAt,
      markdown,
      previewExcerpt:
        markdown.length > MAX_PREVIEW
          ? `${markdown.slice(0, MAX_PREVIEW - 1)}…`
          : markdown,
      ...joinKey,
    };

    this.saved = record;

    const warnings: string[] = [];
    if (readinessResult.tooBroadWarning) {
      warnings.push(
        "This task is too broad for safe implementation. Ask the builder for a narrower plan first.",
      );
    }
    if (readinessResult.readiness === "planning-only") {
      warnings.push("Handoff is planning-only until blueprint/task gaps are resolved.");
    }

    const base = `Task Builder Handoff ready for ${taskId} (${readinessResult.recommendation}).`;
    this.statusMessage =
      warnings.length > 0 ? `${base} ${warnings.join(" ")}` : base;

    this.safetyGate.log(
      "success",
      "Task builder handoff generated",
      `${taskId} · ${readinessResult.readiness} · ${this.target}`,
    );
    return record;
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Task Builder Handoff cleared.";
    this.safetyGate.log("info", "Task builder handoff cleared", "User cleared handoff.");
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.selectedTaskId = null;
    this.target = DEFAULT_TASK_CARD_BUILDER_HANDOFF_TARGET;
    this.strictness = DEFAULT_TASK_CARD_BUILDER_HANDOFF_STRICTNESS;
    this.statusMessage =
      "Select a phase task card and generate a focused builder handoff. Text-only — no automatic send.";
  }

  restoreFromHistory(input: {
    saved: TaskCardBuilderHandoffRecord | null;
    selectedTaskId: string | null;
    target: BuilderHandoffTarget;
    strictness: BuilderHandoffStrictness;
  }): void {
    this.saved = input.saved;
    this.selectedTaskId = input.selectedTaskId;
    this.target = input.target;
    this.strictness = input.strictness;
    if (input.saved) {
      this.statusMessage = `Task Builder Handoff restored (${input.saved.selectedTaskId} · ${input.saved.readiness}).`;
    }
  }

  recordCopy(): void {
    if (!this.saved) {
      this.statusMessage = "Generate a Task Builder Handoff before copying.";
      this.safetyGate.log(
        "warning",
        "Task builder handoff copy blocked",
        "No handoff generated.",
      );
      return;
    }
    const copiedAt = new Date().toISOString();
    this.saved = { ...this.saved, copiedAt };
    this.safetyGate.log(
      "success",
      "Task builder handoff copied",
      `Task ${this.saved.selectedTaskId} handoff copied (markdown).`,
    );
    this.statusMessage = "Task Builder Handoff copied to clipboard.";
  }
}
