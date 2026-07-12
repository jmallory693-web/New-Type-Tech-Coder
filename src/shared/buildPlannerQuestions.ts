/**
 * Stage 80: rule-based planner questions from idea intake (no AI).
 */

import type { BlueprintIntake } from "./types";
import {
  labelForBlueprintBuildStyle,
  labelForBlueprintProjectType,
  labelForBlueprintTargetUser,
  PLANNER_QUESTION_SECTIONS,
} from "./blueprintConstants";

function questionsForSection(
  section: string,
  intake: BlueprintIntake,
): string[] {
  const idea = intake.projectIdea.trim();
  const constraints = intake.constraints.trim();

  switch (section) {
    case "Purpose":
      return [
        "What problem does this project solve?",
        "What does success look like for the first version?",
        idea
          ? `Does this idea stay focused on one main purpose: “${idea.slice(0, 120)}…”?`
          : "What is the single main purpose?",
      ];
    case "Users":
      return [
        `Who will use it? (Target: ${labelForBlueprintTargetUser(intake.targetUser)})`,
        "What is their technical comfort level?",
        "What do they need most on day one?",
      ];
    case "Core features":
      return [
        "List the must-have features for MVP.",
        "Which features are nice-to-have later?",
        "What is explicitly out of scope for MVP?",
      ];
    case "Data/storage":
      return [
        "What data needs to be stored?",
        "Local only, cloud, or hybrid?",
        constraints.includes("offline")
          ? "Constraints mention offline — confirm all data stays local."
          : "Should data work offline?",
        "Import/export needed?",
      ];
    case "Screens/UI":
      return [
        `Project type is ${labelForBlueprintProjectType(intake.projectType)} — what screens or views are needed?`,
        "What is the simplest UI that still works?",
        "Any accessibility or mobile needs?",
      ];
    case "Offline/cloud/login needs":
      return [
        "Must it work fully offline?",
        "Is login or accounts required?",
        "Any cloud sync or backup?",
      ];
    case "Import/export":
      return [
        "What file formats for import/export?",
        "Who receives exported data?",
        "Any privacy rules for exports?",
      ];
    case "Safety/privacy":
      return [
        "What data is sensitive?",
        "Who should never see certain data?",
        "Any compliance or family-safety concerns?",
      ];
    case "Tech stack assumptions":
      return [
        `Technical comfort: ${intake.technicalComfort}.`,
        "Preferred platform (Windows, web, cross-platform)?",
        "Any banned technologies?",
        constraints ? `Respect constraints: ${constraints.slice(0, 200)}` : "List hard constraints.",
      ];
    case "MVP scope":
      return [
        `Build style: ${labelForBlueprintBuildStyle(intake.buildStyle)}.`,
        "What is the smallest useful first release?",
        "What can wait until Phase 2?",
      ];
    case "Future features":
      return [
        "What features belong after MVP?",
        "What dependencies block later features?",
      ];
    case "What not to build yet":
      return [
        "List features to defer deliberately.",
        "List integrations to avoid in Phase 1.",
        "What would make the project too large too fast?",
      ];
    default:
      return ["Clarify this area before coding."];
  }
}

export function buildPlannerQuestionsMarkdown(
  intake: BlueprintIntake,
): string {
  const lines: string[] = [
    "# Planner Questions",
    "",
    "Use these questions to clarify the project before any coding.",
    "Rule-based checklist — NTTC did not call AI.",
    "",
    `**Project type:** ${labelForBlueprintProjectType(intake.projectType)}`,
    `**Target user:** ${labelForBlueprintTargetUser(intake.targetUser)}`,
    `**Technical comfort:** ${intake.technicalComfort}`,
    `**Build style:** ${labelForBlueprintBuildStyle(intake.buildStyle)}`,
    "",
  ];

  if (intake.projectIdea.trim()) {
    lines.push("## Idea summary", "", intake.projectIdea.trim(), "");
  }
  if (intake.constraints.trim()) {
    lines.push("## Constraints", "", intake.constraints.trim(), "");
  }

  for (const section of PLANNER_QUESTION_SECTIONS) {
    lines.push(`## ${section}`, "");
    const qs = questionsForSection(section, intake);
    qs.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push("");
  }

  return lines.join("\n").trim();
}
