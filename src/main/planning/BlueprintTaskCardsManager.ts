import { buildBlueprintPhaseTaskCards } from "../../shared/buildBlueprintPhaseTaskCards";
import type { BlueprintPhaseTaskCardStatus } from "../../shared/blueprintTaskCardConstants";
import { TASK_CARD_STATUS_LABELS } from "../../shared/blueprintTaskCardConstants";
import type {
  BlueprintPhaseTaskCardsRecord,
  BlueprintPhaseTaskCardsState,
} from "../../shared/types";
import type { BlueprintManager } from "./BlueprintManager";
import type { SafetyGate } from "../safety/SafetyGate";
import type { PlanningStyleId } from "../../shared/planningStyle";

/** Stage 86: Blueprint Phase Task Cards manager (planning only, no AI). */
export class BlueprintTaskCardsManager {
  private saved: BlueprintPhaseTaskCardsRecord | null = null;
  private statusMessage: string | null =
    "Generate phase task cards from your saved blueprint — rule-based, no AI, no source reads.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BlueprintPhaseTaskCardsState {
    return {
      saved: this.saved,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): BlueprintPhaseTaskCardsRecord | null {
    return this.saved;
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Phase task cards cleared.";
    this.safetyGate.log("info", "Blueprint task cards cleared", "User cleared task cards.");
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.statusMessage =
      "Generate phase task cards from your saved blueprint — rule-based, no AI, no source reads.";
  }

  restoreSaved(record: BlueprintPhaseTaskCardsRecord | null): void {
    this.saved = record;
    if (record) {
      this.statusMessage = `${record.taskCount} phase task cards restored. Active: ${record.activeTaskId ?? "none"}.`;
    }
  }

  generate(
    blueprintManager: BlueprintManager,
    planningStyle: PlanningStyleId,
  ): BlueprintPhaseTaskCardsRecord | null {
    const bp = blueprintManager.getState();
    if (!bp.importedBlueprint) {
      this.statusMessage =
        "Save or import a Project Blueprint before generating task cards.";
      this.safetyGate.log(
        "warning",
        "Task cards generation blocked",
        "No imported blueprint.",
      );
      return null;
    }

    const record = buildBlueprintPhaseTaskCards({
      intake: bp.intake,
      imported: bp.importedBlueprint,
      completeness: bp.completenessReport,
      phase1Handoff: bp.phase1Handoff,
      planningStyle,
    });

    this.saved = record;

    const warnings: string[] = [];
    if (record.incompleteBlueprintWarning) {
      warnings.push(
        "Blueprint is incomplete. Task cards may be planning-only until missing sections are filled.",
      );
    }
    if (record.missingPhase1Warning) {
      warnings.push("Phase 1 Builder Handoff not generated yet — cards use blueprint context only.");
    }
    if (record.tooManyTasksWarning) {
      warnings.push("More than 10 tasks would be needed — list was capped. Consider splitting phases in the blueprint.");
    }

    const base = `Generated ${record.taskCount} phase task cards (${record.activeTaskId ?? "none"} active).`;
    this.statusMessage =
      warnings.length > 0 ? `${base} ${warnings.join(" ")}` : base;

    this.safetyGate.log(
      "success",
      "Blueprint phase task cards generated",
      `${record.taskCount} cards; planning only; no AI.`,
    );
    return record;
  }

  setTaskStatus(
    taskId: string,
    status: BlueprintPhaseTaskCardStatus,
  ): { ok: boolean; message: string } {
    if (!this.saved) {
      const message = "Generate phase task cards first.";
      this.statusMessage = message;
      return { ok: false, message };
    }
    const card = this.saved.cards.find((c) => c.id === taskId);
    if (!card) {
      const message = `Task ${taskId} not found.`;
      this.statusMessage = message;
      return { ok: false, message };
    }

    const now = new Date().toISOString();
    const updatedCards = this.saved.cards.map((c) =>
      c.id === taskId
        ? {
            ...c,
            status,
            updatedAt: now,
            markdown: c.markdown.replace(
              /## Status\s*\n\s*\n[^\n#]+/,
              `## Status\n\n${TASK_CARD_STATUS_LABELS[status]}`,
            ),
          }
        : c,
    );

    this.saved = {
      ...this.saved,
      cards: updatedCards,
      allCardsMarkdown: updatedCards
        .map((c, i) =>
          `${c.markdown}${i < updatedCards.length - 1 ? "\n\n---\n\n" : ""}`,
        )
        .join(""),
    };

    this.statusMessage = `Task ${taskId} marked ${TASK_CARD_STATUS_LABELS[status]}.`;
    this.safetyGate.log(
      "info",
      "Blueprint task card status changed",
      `${taskId} → ${status}`,
    );
    return { ok: true, message: this.statusMessage };
  }

  resetTaskStatus(taskId: string): { ok: boolean; message: string } {
    return this.setTaskStatus(taskId, "drafted");
  }

  setActiveTaskId(taskId: string): { ok: boolean; message: string } {
    if (!this.saved) {
      const message = "Generate phase task cards first.";
      this.statusMessage = message;
      return { ok: false, message };
    }
    if (!this.saved.cards.some((c) => c.id === taskId)) {
      const message = `Task ${taskId} not found.`;
      this.statusMessage = message;
      return { ok: false, message };
    }
    this.saved = { ...this.saved, activeTaskId: taskId };
    this.statusMessage = `Active task set to ${taskId}.`;
    this.safetyGate.log("info", "Blueprint active task changed", taskId);
    return { ok: true, message: this.statusMessage };
  }

  recordCopy(taskId?: string): void {
    if (taskId) {
      this.safetyGate.log(
        "info",
        "Blueprint task card copied",
        `Task ${taskId} copied to clipboard (markdown).`,
      );
    } else {
      this.safetyGate.log(
        "info",
        "All blueprint task cards copied",
        "All task cards copied to clipboard (markdown).",
      );
    }
  }
}
