/**
 * Stage 82: Ollama prompt for Local Planner AI (idea fields only — no project reads).
 */

import { buildPlannerAiPromptMarkdown } from "../../shared/buildPlannerAiPrompt";
import { BLUEPRINT_REQUIRED_SECTIONS } from "../../shared/blueprintConstants";
import type { PlanningStyleId } from "../../shared/planningStyle";
import type { BlueprintIntake } from "../../shared/types";

const PLANNER_ROLE_RULES = [
  "You are acting as a project planner, not a coder.",
  "Do not write source code.",
  "Do not scaffold app files.",
  "Do not install packages.",
  "Do not run commands.",
  "Do not assume hidden file access.",
  "Do not claim you inspected files.",
  "Create planning documents and a phase-by-phase build plan only.",
  "Keep the plan small-model friendly.",
  "Prefer small focused modules over giant files.",
  "Ask for missing context instead of inventing risky requirements.",
] as const;

const OUTPUT_REQUIREMENTS = [
  "Include a plain-English explanation for non-coders.",
  "MVP first — separate future features.",
  "Label assumptions clearly.",
  "State what not to build yet.",
  "Include validation steps for Phase 1.",
  "Include a report-back format for builder AI.",
] as const;

export interface BlueprintPlannerAiPromptBuild {
  ok: boolean;
  prompt: string;
  message: string;
  plannerQuestionsGenerated: boolean;
  promptCharCount: number;
}

export function buildBlueprintPlannerAiOllamaPrompt(input: {
  intake: BlueprintIntake;
  plannerQuestionsMarkdown: string | null;
  planningStyle: PlanningStyleId;
}): BlueprintPlannerAiPromptBuild {
  if (!input.intake.projectIdea.trim()) {
    return {
      ok: false,
      prompt: "",
      message: "Describe the project idea before asking Local Planner AI.",
      plannerQuestionsGenerated: false,
      promptCharCount: 0,
    };
  }

  const plannerQuestionsGenerated = Boolean(
    input.plannerQuestionsMarkdown?.trim(),
  );

  const base = buildPlannerAiPromptMarkdown(
    input.intake,
    input.plannerQuestionsMarkdown,
    input.planningStyle,
  );

  const lines: string[] = [
    base,
    "",
    "## Local Planner AI role (mandatory)",
    "",
    ...PLANNER_ROLE_RULES.map((rule) => `- ${rule}`),
    "",
    "## Additional output requirements",
    "",
    ...OUTPUT_REQUIREMENTS.map((rule) => `- ${rule}`),
    "",
    "## Required markdown sections",
    "",
    "Respond with markdown using exactly these sections:",
    "",
    ...BLUEPRINT_REQUIRED_SECTIONS.map((section) => `- ## ${section}`),
    "",
    "Start with:",
    "",
    "```md",
    "# Project Blueprint",
    "```",
  ];

  if (!plannerQuestionsGenerated) {
    lines.push(
      "",
      "## Note",
      "",
      "Planner questions were not generated yet in NTTC. Ask clarifying questions in your response instead of inventing risky requirements.",
    );
  }

  const prompt = lines.join("\n").trim();
  return {
    ok: true,
    prompt,
    message: "Local Planner AI prompt ready.",
    plannerQuestionsGenerated,
    promptCharCount: prompt.length,
  };
}
