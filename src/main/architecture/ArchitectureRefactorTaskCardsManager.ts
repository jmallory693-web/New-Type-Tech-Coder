import { buildArchitectureRefactorTaskCards } from "../../shared/architectureRefactorTasks/buildArchitectureRefactorTaskCards";
import {
  TASK_CARD_STATUS_LABELS,
  type ArchitectureRefactorTaskCardStatus,
} from "../../shared/architectureRefactorTasks/architectureRefactorTaskConstants";
import { formatArchitectureRefactorTaskCardMarkdown } from "../../shared/architectureRefactorTasks/formatArchitectureRefactorTaskCard";
import type {
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskCardsRecord,
  ArchitectureRefactorTaskCardsState,
} from "../../shared/types";
import type { PlanningStyleId } from "../../shared/planningStyle";
import type { SafetyGate } from "../safety/SafetyGate";

function normalizeRecord(
  raw: ArchitectureRefactorTaskCardsRecord,
): ArchitectureRefactorTaskCardsRecord {
  return {
    id: raw.id,
    generatedAt: raw.generatedAt,
    sourceArchitectureHealthGeneratedAt:
      raw.sourceArchitectureHealthGeneratedAt ?? null,
    sourceArchitectureHealthId: raw.sourceArchitectureHealthId ?? null,
    sourceReportHash: raw.sourceReportHash ?? null,
    taskCount: raw.taskCount ?? raw.cards?.length ?? 0,
    activeTaskId: raw.activeTaskId ?? null,
    stale: Boolean(raw.stale),
    cards: raw.cards ?? [],
    allCardsMarkdown: raw.allCardsMarkdown ?? "",
  };
}

/** Stage 102: Architecture Refactor Task Cards manager (planning only; no AI). */
export class ArchitectureRefactorTaskCardsManager {
  private saved: ArchitectureRefactorTaskCardsRecord | null = null;
  private statusMessage: string | null =
    "Generate Architecture Refactor Task Cards from a current Architecture Health Report (planning text only).";

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): ArchitectureRefactorTaskCardsRecord | null {
    return this.saved ? { ...this.saved, cards: [...this.saved.cards] } : null;
  }

  getState(): ArchitectureRefactorTaskCardsState {
    return {
      saved: this.saved ? { ...this.saved, cards: [...this.saved.cards] } : null,
      statusMessage: this.statusMessage,
    };
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Architecture Refactor Task Cards are stale — regenerate after Architecture Health updates.";
    this.safetyGate.log("info", "Architecture refactor task cards stale", reason);
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
    planningStyle: PlanningStyleId;
  }): ArchitectureRefactorTaskCardsRecord | null {
    const health = input.architectureHealth;
    if (!health) {
      this.statusMessage =
        "Generate an Architecture Health Report before creating refactor task cards.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor task cards blocked",
        "No architecture health report.",
      );
      return null;
    }
    if (health.stale) {
      this.statusMessage =
        "Architecture Health Report is stale — regenerate it first.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor task cards blocked",
        "Stale architecture health report.",
      );
      return null;
    }
    if (!health.refactorSuggestions?.length) {
      this.statusMessage =
        "Architecture Health Report has no refactor suggestions — regenerate the report.";
      this.safetyGate.log(
        "warning",
        "Architecture refactor task cards blocked",
        "No refactor suggestions stored.",
      );
      return null;
    }

    const record = buildArchitectureRefactorTaskCards({
      architectureHealth: health,
      planningStyle: input.planningStyle,
      sourceReportHash: health.id,
    });

    if (!record) {
      this.statusMessage =
        "Could not build refactor task cards from Architecture Health metadata.";
      return null;
    }

    this.saved = record;
    this.statusMessage = `Generated ${record.taskCount} architecture refactor task cards (${record.activeTaskId ?? "none"} active). Planning only — no code changes.`;
    this.safetyGate.log(
      "success",
      "Architecture refactor task cards generated",
      `${record.taskCount} cards from architecture health metadata.`,
    );
    return record;
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Architecture Refactor Task Cards cleared.";
    this.safetyGate.log(
      "info",
      "Architecture refactor task cards cleared",
      "User cleared refactor task cards.",
    );
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.statusMessage =
      "Generate Architecture Refactor Task Cards from a current Architecture Health Report (planning text only).";
  }

  restoreSaved(record: ArchitectureRefactorTaskCardsRecord | null | undefined): void {
    this.saved = record ? normalizeRecord(record) : null;
    if (this.saved) {
      this.statusMessage = `${this.saved.taskCount} architecture refactor task cards restored${this.saved.stale ? " (stale)" : ""}.`;
    }
  }

  setTaskStatus(
    taskId: string,
    status: ArchitectureRefactorTaskCardStatus,
  ): { ok: boolean; message: string } {
    if (!this.saved) {
      const message = "Generate refactor task cards first.";
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
    const updatedCards = this.saved.cards.map((c) => {
      if (c.id !== taskId) return c;
      const updatedFields = { ...c, status, updatedAt: now };
      return {
        ...updatedFields,
        markdown: formatArchitectureRefactorTaskCardMarkdown({
          id: c.id,
          title: c.title,
          refactorTarget: c.refactorTarget,
          goal: c.goal,
          whyThisMatters: c.whyThisMatters,
          currentRisk: c.currentRisk,
          filesLikelyInvolved: c.filesLikelyInvolved,
          whatToChange: c.whatToChange,
          whatNotToChange: c.whatNotToChange,
          safetyBoundaries: c.safetyBoundaries,
          smallModelFriendlyArchitecture: c.smallModelFriendlyArchitecture,
          builderPrompt: c.builderPrompt,
          validationSteps: c.validationSteps,
          reportBackFormat: c.reportBackFormat,
          status,
        }),
      };
    });

    this.saved = {
      ...this.saved,
      cards: updatedCards,
      allCardsMarkdown: updatedCards
        .map((c, i) =>
          `${c.markdown}${i < updatedCards.length - 1 ? "\n\n---\n\n" : ""}`,
        )
        .join(""),
    };

    this.statusMessage = `Refactor task ${taskId} marked ${TASK_CARD_STATUS_LABELS[status]}.`;
    this.safetyGate.log(
      "info",
      "Architecture refactor task card status changed",
      `${taskId} → ${status}`,
    );
    return { ok: true, message: this.statusMessage };
  }

  resetTaskStatus(taskId: string): { ok: boolean; message: string } {
    return this.setTaskStatus(taskId, "drafted");
  }

  recordCopy(taskId?: string): string | null {
    if (!this.saved) {
      this.statusMessage = "Generate refactor task cards before copying.";
      return null;
    }
    if (taskId) {
      const card = this.saved.cards.find((c) => c.id === taskId);
      if (!card) return null;
      this.safetyGate.log(
        "info",
        "Architecture refactor task card copied",
        `${taskId} copied to clipboard (markdown).`,
      );
      this.statusMessage = `Refactor task ${taskId} copied (planning text only).`;
      return card.markdown;
    }
    this.safetyGate.log(
      "info",
      "All architecture refactor task cards copied",
      "All refactor task cards copied to clipboard (markdown).",
    );
    this.statusMessage = "All architecture refactor task cards copied.";
    return this.saved.allCardsMarkdown;
  }
}
