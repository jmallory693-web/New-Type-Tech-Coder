import type {
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskCard,
  ArchitectureRefactorTaskCardsRecord,
} from "../types";
import type { PlanningStyleId } from "../planningStyle";
import {
  ARCHITECTURE_REFACTOR_BUILDER_PROMPT_CORE,
  ARCHITECTURE_REFACTOR_PLANNING_ONLY_NOTE,
  ARCHITECTURE_REFACTOR_REPORT_BACK_FORMAT,
  ARCHITECTURE_REFACTOR_SAFETY_BOUNDARIES,
  ARCHITECTURE_REFACTOR_TASK_ID_PREFIX,
  DEFAULT_ARCHITECTURE_REFACTOR_CARD_HINTS,
} from "./architectureRefactorTaskConstants";
import {
  assessArchitectureRefactorTaskQuality,
} from "./assessArchitectureRefactorTaskQuality";
import { formatArchitectureRefactorTaskCardMarkdown } from "./formatArchitectureRefactorTaskCard";
import type { RefactorTaskCardSuggestion } from "./buildArchitectureRefactorTaskSuggestions";

function assignStableTaskId(
  suggestion: RefactorTaskCardSuggestion,
  index: number,
  usedIds: Set<string>,
): string {
  for (const hint of DEFAULT_ARCHITECTURE_REFACTOR_CARD_HINTS) {
    if (
      hint.titlePattern.test(suggestion.title) &&
      !usedIds.has(hint.id)
    ) {
      usedIds.add(hint.id);
      return hint.id;
    }
  }
  let n = index + 1;
  while (usedIds.has(`${ARCHITECTURE_REFACTOR_TASK_ID_PREFIX}${n}`)) {
    n += 1;
  }
  const id = `${ARCHITECTURE_REFACTOR_TASK_ID_PREFIX}${n}`;
  usedIds.add(id);
  return id;
}

function buildBuilderPrompt(input: {
  taskSpecific: string;
  risky: boolean;
}): string {
  const lines = [
    input.taskSpecific.trim(),
    "",
    ...ARCHITECTURE_REFACTOR_BUILDER_PROMPT_CORE,
  ];
  if (input.risky) {
    lines.push("", ARCHITECTURE_REFACTOR_PLANNING_ONLY_NOTE);
  }
  return lines.join("\n");
}

function inferRefactorTarget(suggestion: RefactorTaskCardSuggestion): string {
  if (suggestion.refactorTarget) return suggestion.refactorTarget;
  const match = suggestion.filesLikelyInvolved.match(
    /(?:^|[;\s])(src\/[^\s;]+)/,
  );
  return match?.[1] ?? "See files likely involved";
}

function buildWhyThisMatters(
  health: ArchitectureHealthRecord,
  target: string,
): string {
  const parts = [
    `Architecture Health (${health.generatedAt}) recommends: ${health.recommendation}.`,
  ];
  if (health.largestFilePath) {
    parts.push(
      `Largest file: ${health.largestFilePath} (${health.largestFileLineCount} lines).`,
    );
  }
  if (health.criticalCount > 0) {
    parts.push(`${health.criticalCount} critical monolith file(s) detected.`);
  }
  if (/(?:^|\/)App\.tsx$/i.test(target.replace(/\\/g, "/"))) {
    parts.push(
      "App.tsx is renderer root wiring — incremental extraction reduces monolith risk without behavior changes.",
    );
  }
  if (/(?:^|\/)main\/index\.ts$/i.test(target.replace(/\\/g, "/"))) {
    parts.push(
      "main/index.ts concentrates IPC/bootstrap — domain registration helpers improve maintainability.",
    );
  }
  return parts.join(" ");
}

function smallModelGuidance(planningStyle: PlanningStyleId | undefined): string {
  const base =
    "Keep each refactor narrow (one subsection, one IPC group, or one helper extraction). Prefer components/managers/helpers over growing App.tsx or main/index.ts.";
  if (planningStyle === "small-model-friendly") {
    return `${base} Favor files under ~300 lines and explicit prop contracts.`;
  }
  return base;
}

export interface BuildArchitectureRefactorTaskCardsInput {
  architectureHealth: ArchitectureHealthRecord;
  planningStyle?: PlanningStyleId;
  sourceReportHash?: string | null;
}

export function buildArchitectureRefactorTaskCards(
  input: BuildArchitectureRefactorTaskCardsInput,
): ArchitectureRefactorTaskCardsRecord | null {
  const health = input.architectureHealth;
  const suggestions = health.refactorSuggestions ?? [];

  if (health.stale) return null;
  if (!suggestions.length) return null;

  const generatedAt = new Date().toISOString();
  const usedIds = new Set<string>();
  const cards: ArchitectureRefactorTaskCard[] = [];

  for (let i = 0; i < suggestions.length; i += 1) {
    const suggestion = suggestions[i]!;
    const id = assignStableTaskId(suggestion, i, usedIds);
    const refactorTarget = inferRefactorTarget(suggestion);
    const whyThisMatters = buildWhyThisMatters(health, refactorTarget);
    const safetyBoundaries = ARCHITECTURE_REFACTOR_SAFETY_BOUNDARIES.join("\n");
    const validationSteps = suggestion.validationRequired;
    const reportBackFormat = ARCHITECTURE_REFACTOR_REPORT_BACK_FORMAT;
    const whatToChange =
      suggestion.whatToChange ??
      "Extract one focused unit (component, helper, or IPC registration group) per this card.";
    const risky =
      /Medium-high|high|critical|App\.tsx|main\/index/i.test(
        `${suggestion.risk} ${refactorTarget}`,
      );
    const builderPrompt = buildBuilderPrompt({
      taskSpecific: suggestion.suggestedBuilderPrompt,
      risky,
    });

    const qualityInput = {
      id,
      title: suggestion.title,
      refactorTarget,
      goal: suggestion.goal,
      whatToChange,
      whatNotToChange: suggestion.whatNotToChange,
      safetyBoundaries,
      smallModelFriendlyArchitecture: smallModelGuidance(input.planningStyle),
      validationSteps,
      reportBackFormat,
      filesLikelyInvolved: suggestion.filesLikelyInvolved,
      builderPrompt,
      currentRisk: suggestion.risk,
    };
    const { quality, flags } = assessArchitectureRefactorTaskQuality(qualityInput);

    const cardFields = {
      id,
      title: suggestion.title,
      refactorTarget,
      goal: suggestion.goal,
      whyThisMatters,
      currentRisk: suggestion.risk,
      filesLikelyInvolved: suggestion.filesLikelyInvolved,
      whatToChange,
      whatNotToChange: suggestion.whatNotToChange,
      safetyBoundaries,
      smallModelFriendlyArchitecture: smallModelGuidance(input.planningStyle),
      builderPrompt,
      validationSteps,
      reportBackFormat,
      status: "drafted" as const,
    };

    cards.push({
      ...cardFields,
      quality,
      qualityFlags: flags,
      updatedAt: generatedAt,
      markdown: formatArchitectureRefactorTaskCardMarkdown(cardFields),
    });
  }

  if (cards.length < 3) return null;

  const activeTaskId = cards[0]?.id ?? null;

  return {
    id: `architecture-refactor-tasks-${Date.now().toString(36)}`,
    generatedAt,
    sourceArchitectureHealthGeneratedAt: health.generatedAt,
    sourceArchitectureHealthId: health.id,
    sourceReportHash: input.sourceReportHash ?? null,
    taskCount: cards.length,
    activeTaskId,
    stale: false,
    cards,
    allCardsMarkdown: cards
      .map((c, i) =>
        `${c.markdown}${i < cards.length - 1 ? "\n\n---\n\n" : ""}`,
      )
      .join(""),
  };
}

export function buildArchitectureRefactorTaskPlanningSummary(input: {
  record: ArchitectureRefactorTaskCardsRecord | null;
}): string {
  const record = input.record;
  if (!record) {
    return "Architecture refactor task cards: not generated.";
  }
  const reviewed = record.cards.filter((c) => c.status === "reviewed").length;
  const staleNote = record.stale ? " (stale — regenerate after Architecture Health update)" : "";
  return `Architecture refactor task cards exist: ${record.taskCount} cards, ${reviewed} reviewed${staleNote}.`;
}
