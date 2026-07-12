/**
 * Stage 80: copyable planner AI prompt (no auto-send, no project reads).
 */

import type { BlueprintIntake } from "./types";
import {
  BLUEPRINT_NO_CODE_RULES,
  BLUEPRINT_REQUIRED_SECTIONS,
  labelForBlueprintBuildStyle,
  labelForBlueprintProjectType,
  labelForBlueprintTargetUser,
} from "./blueprintConstants";
import {
  isSmallModelFriendlyPlanning,
  SMALL_MODEL_FRIENDLY_CORE_RULE,
  type PlanningStyleId,
} from "./planningStyle";

export function buildPlannerAiPromptMarkdown(
  intake: BlueprintIntake,
  plannerQuestionsMarkdown: string | null,
  planningStyle: PlanningStyleId,
): string {
  const lines: string[] = [
    "# Planner AI Request — Project Blueprint",
    "",
    "You are a **planning assistant only**. Help define a new app/program before any code exists.",
    "",
    "## Hard rules",
    "",
    ...BLUEPRINT_NO_CODE_RULES.map((r) => `- ${r}`),
    "",
    "## Project idea",
    "",
    intake.projectIdea.trim() || "(not provided yet)",
    "",
    "## Project context",
    "",
    `- **Project type:** ${labelForBlueprintProjectType(intake.projectType)}`,
    `- **Target user:** ${labelForBlueprintTargetUser(intake.targetUser)}`,
    `- **Technical comfort:** ${intake.technicalComfort}`,
    `- **Build style:** ${labelForBlueprintBuildStyle(intake.buildStyle)}`,
    "",
  ];

  if (intake.constraints.trim()) {
    lines.push("## Constraints", "", intake.constraints.trim(), "");
  }

  if (plannerQuestionsMarkdown?.trim()) {
    lines.push("## Planner questions to address", "", plannerQuestionsMarkdown.trim(), "");
  }

  if (intake.answersClarifications.trim()) {
    lines.push(
      "## User answers / clarifications",
      "",
      intake.answersClarifications.trim(),
      "",
    );
  }

  const useSmallModel =
    intake.buildStyle === "small-model-friendly" ||
    isSmallModelFriendlyPlanning(planningStyle);

  if (useSmallModel) {
    lines.push("## Architecture guidance", "", SMALL_MODEL_FRIENDLY_CORE_RULE, "");
  }

  lines.push(
    "## Required output format",
    "",
    "Respond with markdown using exactly these sections:",
    "",
    ...BLUEPRINT_REQUIRED_SECTIONS.map((s) => `- ## ${s}`),
    "",
    "Start with:",
    "",
    "```md",
    "# Project Blueprint",
    "```",
    "",
    "Planning documents and phase-by-phase build plan only. **No source code.**",
  );

  return lines.join("\n").trim();
}
