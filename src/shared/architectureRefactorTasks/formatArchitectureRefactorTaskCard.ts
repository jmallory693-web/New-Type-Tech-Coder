import {
  ARCHITECTURE_REFACTOR_TASK_CARD_TITLE,
  TASK_CARD_STATUS_LABELS,
  type ArchitectureRefactorTaskCardStatus,
} from "./architectureRefactorTaskConstants";

export function formatArchitectureRefactorTaskCardMarkdown(card: {
  id: string;
  title: string;
  refactorTarget: string;
  goal: string;
  whyThisMatters: string;
  currentRisk: string;
  filesLikelyInvolved: string;
  whatToChange: string;
  whatNotToChange: string;
  safetyBoundaries: string;
  smallModelFriendlyArchitecture: string;
  builderPrompt: string;
  validationSteps: string;
  reportBackFormat: string;
  status: ArchitectureRefactorTaskCardStatus;
}): string {
  const statusLabel = TASK_CARD_STATUS_LABELS[card.status];
  return [
    ARCHITECTURE_REFACTOR_TASK_CARD_TITLE,
    "",
    "## Task ID",
    "",
    card.id,
    "",
    "## Task Title",
    "",
    card.title,
    "",
    "## Refactor Target",
    "",
    card.refactorTarget,
    "",
    "## Goal",
    "",
    card.goal,
    "",
    "## Why This Matters",
    "",
    card.whyThisMatters,
    "",
    "## Current Risk",
    "",
    card.currentRisk,
    "",
    "## Files Likely Involved",
    "",
    card.filesLikelyInvolved,
    "",
    "## What To Change",
    "",
    card.whatToChange,
    "",
    "## What Not To Change",
    "",
    card.whatNotToChange,
    "",
    "## Safety Boundaries",
    "",
    card.safetyBoundaries,
    "",
    "## Small-Model Friendly Architecture",
    "",
    card.smallModelFriendlyArchitecture,
    "",
    "## Builder Prompt",
    "",
    card.builderPrompt,
    "",
    "## Validation Steps",
    "",
    card.validationSteps,
    "",
    "## Report Back Format",
    "",
    card.reportBackFormat,
    "",
    "## Status",
    "",
    statusLabel,
  ].join("\n");
}
