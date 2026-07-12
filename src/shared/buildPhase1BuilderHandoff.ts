/**
 * Stage 80: Phase 1 Builder Handoff from saved blueprint (text-only, no AI).
 */

import type { BlueprintCompletenessReport } from "./types";
import type { BlueprintImportedRecord, BlueprintIntake } from "./types";
import {
  labelForBlueprintBuildStyle,
  labelForBlueprintProjectType,
} from "./blueprintConstants";
import { extractBlueprintSections } from "./extractBlueprintSections";
import {
  isSmallModelFriendlyPlanning,
  SMALL_MODEL_FRIENDLY_CORE_RULE,
  type PlanningStyleId,
} from "./planningStyle";

export function buildPhase1BuilderHandoffMarkdown(input: {
  intake: BlueprintIntake;
  imported: BlueprintImportedRecord;
  completeness: BlueprintCompletenessReport | null;
  planningStyle: PlanningStyleId;
}): string {
  const { intake, imported, completeness, planningStyle } = input;
  const sections = extractBlueprintSections(imported.blueprintText);
  const phase1 =
    sections["Phase 1 Builder Handoff"] ??
    sections["Build Phases"]?.slice(0, 2000) ??
    "(See imported blueprint for Phase 1 scope.)";
  const filePlan =
    sections["Suggested File / Module Plan"] ??
    "(Define small focused modules in the blueprint.)";
  const validation =
    sections["Validation Plan"] ?? "(Add validation steps before expanding scope.)";
  const openQs =
    sections["Risks / Open Questions"] ?? "(List unresolved questions.)";

  const smallModel =
    intake.buildStyle === "small-model-friendly" ||
    isSmallModelFriendlyPlanning(planningStyle);

  const lines = [
    "# NTTC Phase 1 Builder Handoff",
    "",
    "_Text-only handoff from Project Blueprint — no source files created._",
    "",
    "## Goal",
    "",
    sections["Project Brief"]?.slice(0, 1500) ??
      imported.ideaSummary ??
      intake.projectIdea.trim().slice(0, 1500) ??
      "Build Phase 1 only from the approved blueprint.",
    "",
    "## Context",
    "",
    `- **Project type:** ${labelForBlueprintProjectType(intake.projectType)}`,
    `- **Build style:** ${labelForBlueprintBuildStyle(intake.buildStyle)}`,
    `- **Blueprint source:** ${imported.source}`,
    `- **Completeness:** ${completeness?.readiness ?? "not checked"}`,
    "",
    "## What to Build First",
    "",
    phase1,
    "",
    "## What Not to Build Yet",
    "",
    "- Do not build everything at once.",
    "- Do not add unrelated features beyond Phase 1.",
    "- Defer future phases until Phase 1 is validated.",
    intake.constraints.trim()
      ? `\n**User constraints:**\n${intake.constraints.trim()}`
      : "",
    "",
    "## Suggested Files / Modules",
    "",
    filePlan,
    "",
    "## Safety Boundaries",
    "",
    "- NTTC inspect-only: no automatic source edits from this handoff.",
    "- No Live Qwen, no arbitrary terminal, no Apply Patch.",
    "- Human approves all code changes outside NTTC.",
    "- Create Safety Backup before risky work on an existing codebase.",
    "",
    "## Small-Model Friendly Architecture",
    "",
    smallModel
      ? SMALL_MODEL_FRIENDLY_CORE_RULE
      : "Prefer small focused files where practical.",
    "",
    "## Validation Required",
    "",
    validation,
    "",
    "## Report Back Format",
    "",
    "When Phase 1 is done, report:",
    "- Files/modules created or changed",
    "- What was deliberately not built",
    "- Validation performed (manual or automated)",
    "- Open questions blocking Phase 2",
    "",
    "## Open Questions",
    "",
    openQs,
    "",
    "---",
    "",
    "**Builder reminders:**",
    "- Do not build everything at once.",
    "- Do not add unrelated features.",
    "- Keep files small and focused.",
    "- Ask for missing context before guessing.",
    "- Report changed files and validation performed.",
  ];

  return lines.join("\n").trim();
}
