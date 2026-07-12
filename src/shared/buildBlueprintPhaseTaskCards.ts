/**
 * Stage 86: rule-based Blueprint Phase Task Cards from stored planning artifacts only.
 */

import type { BlueprintProjectType } from "./blueprintConstants";
import {
  labelForBlueprintBuildStyle,
  labelForBlueprintProjectType,
  labelForBlueprintTargetUser,
} from "./blueprintConstants";
import { extractBlueprintSections } from "./extractBlueprintSections";
import {
  isSmallModelFriendlyPlanning,
  SMALL_MODEL_FRIENDLY_CORE_RULE,
  type PlanningStyleId,
} from "./planningStyle";
import { assessBlueprintTaskCardQuality } from "./assessBlueprintTaskCardQuality";
import { computeTaskCardFingerprint } from "./computeTaskCardFingerprint";
import {
  BUILDER_PROMPT_SAFETY_REMINDERS,
  PLANNING_ONLY_BUILDER_NOTE,
  TASK_CARD_STATUS_LABELS,
  type BlueprintPhaseTaskCardStatus,
} from "./blueprintTaskCardConstants";
import type {
  BlueprintCompletenessReport,
  BlueprintImportedRecord,
  BlueprintIntake,
  BlueprintPhaseTaskCard,
  BlueprintPhaseTaskCardsRecord,
  Phase1BuilderHandoffRecord,
} from "./types";

const TASK_SUFFIXES = ["A", "B", "C", "D", "E", "F", "G", "H", "J"] as const;
const PREFERRED_MIN = 4;
const PREFERRED_MAX = 8;
const WARN_ABOVE = 10;

interface TaskTemplate {
  suffix: string;
  title: string;
  goal: string;
  whatToBuild: string;
  whatNotToBuildYet: string;
  likelyFilesModules: string;
  validationSteps: string;
  planningOnly: boolean;
}

function taskId(suffix: string): string {
  return `P1${suffix}`;
}

function parseExplicitPhases(buildPhasesText: string): TaskTemplate[] | null {
  const lines = buildPhasesText.split(/\r?\n/).filter((l) => l.trim());
  const templates: TaskTemplate[] = [];
  let numericIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const match =
      trimmed.match(
        /^(?:[-*]\s*)?(?:Phase\s*)?(?:1\s*)?([A-H]|\d+)[\s.:)\u2014\u2013-]+(.+)$/i,
      ) ??
      trimmed.match(/^(?:[-*]\s*)(.+)$/);
    if (!match) continue;

    let suffix: string;
    let title: string;
    if (match[2]) {
      suffix = /^\d+$/.test(match[1])
        ? TASK_SUFFIXES[numericIndex++] ?? `X${numericIndex}`
        : match[1].toUpperCase();
      title = match[2].trim();
    } else {
      suffix = TASK_SUFFIXES[numericIndex++] ?? `X${numericIndex}`;
      title = match[1].trim();
    }

    if (title.length < 4) continue;
    templates.push({
      suffix,
      title,
      goal: `Deliver a focused planning slice: ${title}`,
      whatToBuild: `Plan and scope only: ${title}. Keep the slice narrow enough for one builder session.`,
      whatNotToBuildYet:
        "Later build phases, unrelated screens, and features outside this slice.",
      likelyFilesModules:
        "Derive module names from the blueprint Suggested File / Module Plan.",
      validationSteps:
        "Confirm this slice is documented, bounded, and ready for builder handoff.",
      planningOnly: true,
    });
  }

  if (templates.length >= PREFERRED_MIN && templates.length <= WARN_ABOVE) {
    return templates.slice(0, WARN_ABOVE);
  }
  return null;
}

function defaultTemplatesForProjectType(
  projectType: BlueprintProjectType,
): TaskTemplate[] {
  switch (projectType) {
    case "game":
      return [
        {
          suffix: "A",
          title: "Game loop / prototype scope",
          goal: "Define the smallest playable loop and prototype boundaries.",
          whatToBuild:
            "Document core loop, win/lose conditions, and Phase 1 prototype scope.",
          whatNotToBuildYet:
            "Full content, polish, multiplayer, and advanced systems.",
          likelyFilesModules:
            "game loop module, scene/state manager, prototype config (planning names only).",
          validationSteps:
            "Review loop diagram and confirm scope fits one builder session.",
          planningOnly: true,
        },
        {
          suffix: "B",
          title: "Core entities / data model",
          goal: "Plan entities, stats, and relationships for the first playable build.",
          whatToBuild:
            "Entity list, data fields, and state transitions for core gameplay.",
          whatNotToBuildYet: "Full asset pipeline and advanced AI behaviors.",
          likelyFilesModules:
            "entities/types module, state store, sample data fixtures (planning).",
          validationSteps:
            "Walk through one entity lifecycle on paper or in planning notes.",
          planningOnly: true,
        },
        {
          suffix: "C",
          title: "First playable interaction",
          goal: "Plan the first interaction the player can complete.",
          whatToBuild:
            "Input → response → feedback loop for one core interaction.",
          whatNotToBuildYet: "Menus beyond essentials and extra levels.",
          likelyFilesModules:
            "input handler plan, interaction controller, UI feedback panel.",
          validationSteps: "Describe a 30-second playtest scenario.",
          planningOnly: true,
        },
        {
          suffix: "D",
          title: "Save/load or state persistence",
          goal: "Plan how run state is saved and restored locally.",
          whatToBuild: "Save format, load path, and failure handling notes.",
          whatNotToBuildYet: "Cloud sync and cross-platform saves.",
          likelyFilesModules: "persistence module, save schema, migration notes.",
          validationSteps: "List save/load smoke test steps.",
          planningOnly: true,
        },
        {
          suffix: "E",
          title: "UI / status display",
          goal: "Plan minimal HUD/status elements for the prototype.",
          whatToBuild: "Status fields, layout notes, and update rules.",
          whatNotToBuildYet: "Full menu systems and settings screens.",
          likelyFilesModules: "HUD component plan, status store bindings.",
          validationSteps: "Confirm required status fields are listed.",
          planningOnly: true,
        },
        {
          suffix: "F",
          title: "Validation / playtest checklist",
          goal: "Define manual playtest and smoke validation for Phase 1.",
          whatToBuild: "Checklist of playtest steps and pass/fail criteria.",
          whatNotToBuildYet: "Automated test suite and CI integration.",
          likelyFilesModules: "VALIDATION_PLAN notes, playtest log template.",
          validationSteps: "Run checklist on paper against planned features.",
          planningOnly: true,
        },
      ];
    case "automation-tool":
      return [
        {
          suffix: "A",
          title: "Input / output definition",
          goal: "Define inputs, outputs, and success criteria for the automation.",
          whatToBuild: "I/O contract, file formats, and trigger conditions.",
          whatNotToBuildYet: "Scheduling UI and multi-user features.",
          likelyFilesModules: "io schema module, config loader plan.",
          validationSteps: "Sample input/output pair documented.",
          planningOnly: true,
        },
        {
          suffix: "B",
          title: "Workflow steps",
          goal: "Break the automation into ordered, testable steps.",
          whatToBuild: "Step list with pre/post conditions per step.",
          whatNotToBuildYet: "Parallel workflows and orchestration UI.",
          likelyFilesModules: "workflow runner plan, step handlers.",
          validationSteps: "Dry-run each step on paper.",
          planningOnly: true,
        },
        {
          suffix: "C",
          title: "Data validation",
          goal: "Plan validation rules before processing.",
          whatToBuild: "Validation rules, error messages, and skip behavior.",
          whatNotToBuildYet: "ML-based validation and external APIs.",
          likelyFilesModules: "validators module, error types.",
          validationSteps: "List invalid input cases and expected errors.",
          planningOnly: true,
        },
        {
          suffix: "D",
          title: "Error handling",
          goal: "Plan recoverable vs fatal errors and user messaging.",
          whatToBuild: "Error taxonomy, retry policy, and safe fallbacks.",
          whatNotToBuildYet: "Auto-remediation and alerting integrations.",
          likelyFilesModules: "error handler, retry helper, user messages.",
          validationSteps: "Simulate one recoverable and one fatal error.",
          planningOnly: true,
        },
        {
          suffix: "E",
          title: "Local logging / reporting",
          goal: "Plan logs and summary reports for manual review.",
          whatToBuild: "Log fields, report format, and retention notes.",
          whatNotToBuildYet: "Remote telemetry and dashboards.",
          likelyFilesModules: "logger module, report builder.",
          validationSteps: "Review sample log and report outline.",
          planningOnly: true,
        },
        {
          suffix: "F",
          title: "Manual smoke test checklist",
          goal: "Define end-to-end manual validation for Phase 1 automation.",
          whatToBuild: "Smoke test script with expected outputs.",
          whatNotToBuildYet: "CI pipelines and load testing.",
          likelyFilesModules: "VALIDATION_PLAN section, test fixtures list.",
          validationSteps: "Execute checklist against sample data.",
          planningOnly: true,
        },
      ];
    default:
      return [
        {
          suffix: "A",
          title: "Project shell / app structure planning",
          goal: "Plan the minimal app shell and module layout for Phase 1.",
          whatToBuild:
            "Folder/module plan, entry points, and navigation shell (planning only).",
          whatNotToBuildYet:
            "Full feature set, advanced routing, and production deployment.",
          likelyFilesModules:
            "app entry, layout shell, shared types/constants (planning names).",
          validationSteps:
            "Confirm module list is small and each file has one responsibility.",
          planningOnly: true,
        },
        {
          suffix: "B",
          title: "Core data model",
          goal: "Define core entities, fields, and relationships.",
          whatToBuild: "Data model notes, sample records, and invariants.",
          whatNotToBuildYet: "Sync, migrations beyond v1, and analytics.",
          likelyFilesModules: "types/models module, sample fixtures.",
          validationSteps: "Walk through create/read/update on paper.",
          planningOnly: true,
        },
        {
          suffix: "C",
          title: "First usable screen / workflow",
          goal: "Plan the first screen or workflow a user can complete.",
          whatToBuild: "Screen flow, primary actions, and empty states.",
          whatNotToBuildYet: "Secondary screens and admin tools.",
          likelyFilesModules:
            "screen component plan, workflow hook/store, form fields.",
          validationSteps: "Describe happy-path user journey step by step.",
          planningOnly: true,
        },
        {
          suffix: "D",
          title: "Local save/load or persistence plan",
          goal: "Plan how data persists locally between sessions.",
          whatToBuild: "Storage format, load/save API, and corruption handling.",
          whatNotToBuildYet: "Cloud backup and multi-device sync.",
          likelyFilesModules: "persistence service, storage adapter.",
          validationSteps: "List save/load smoke steps and edge cases.",
          planningOnly: true,
        },
        {
          suffix: "E",
          title: "Validation and smoke testing",
          goal: "Define manual validation for Phase 1 scope.",
          whatToBuild: "Smoke checklist, pass/fail criteria, and test data.",
          whatNotToBuildYet: "Full automated test suite.",
          likelyFilesModules: "VALIDATION_PLAN notes, test checklist doc.",
          validationSteps: "Run checklist against planned features.",
          planningOnly: true,
        },
        {
          suffix: "F",
          title: "Documentation / handoff update",
          goal: "Update planning docs and handoff notes after Phase 1 planning.",
          whatToBuild:
            "CURRENT_STATUS, HANDOFF_NOTES, and open questions summary.",
          whatNotToBuildYet: "User manual and marketing copy.",
          likelyFilesModules: ".nttc/planning markdown updates only.",
          validationSteps: "Confirm handoff matches scoped Phase 1 tasks.",
          planningOnly: true,
        },
      ];
  }
}

function buildContractFields(
  tpl: TaskTemplate,
  index: number,
  priorTemplates: TaskTemplate[],
): {
  producesCreates: string;
  consumesDependsOn: string;
  interfacesContracts: string;
} {
  const moduleHints = tpl.likelyFilesModules
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && !/^reference/i.test(s))
    .slice(0, 4);

  const producesCreates = [
    `- ${tpl.title}`,
    `- ${tpl.whatToBuild.split(".")[0]?.trim() || tpl.whatToBuild}`,
    ...moduleHints.map((m) => `- ${m}`),
  ].join("\n");

  const consumesDependsOn =
    index === 0
      ? [
          "- Blueprint planning context",
          "- Project intake and constraints",
          "- Phase 1 scope boundaries",
        ].join("\n")
      : [
          ...priorTemplates.map((p) => `- Outputs from ${p.title}`),
          "- Shared types/constants from earlier cards",
          "- App shell / module layout (if established)",
        ].join("\n");

  const primaryModule = moduleHints[0] ?? tpl.title;
  const interfacesContracts = [
    `- ${tpl.title} planning contract`,
    `- Module boundary: ${primaryModule}`,
    `- Validation/report-back contract for task ${taskId(tpl.suffix)}`,
  ].join("\n");

  return { producesCreates, consumesDependsOn, interfacesContracts };
}

function buildSafetyBoundaries(
  constraints: string,
  incompleteBlueprint: boolean,
): string {
  const lines = [
    "- NTTC inspect-only: task cards are planning text — no automatic source edits.",
    "- No Live Qwen, no arbitrary terminal, no Apply Patch.",
    "- Human approves all code changes outside NTTC.",
    "- Create Safety Backup before risky work on an existing codebase.",
    "- Do not read or modify project source files unless explicitly assigned in a later implementation task.",
  ];
  if (incompleteBlueprint) {
    lines.push(
      "- Blueprint is incomplete: treat this as planning-only until missing sections are filled.",
    );
  }
  if (constraints.trim()) {
    lines.push(`- User constraints: ${constraints.trim()}`);
  }
  return lines.join("\n");
}

function buildBuilderPrompt(input: {
  taskId: string;
  title: string;
  planningOnly: boolean;
  incompleteBlueprint: boolean;
}): string {
  const lines = [
    `You are implementing **only** task ${input.taskId}: ${input.title}.`,
    "",
    ...BUILDER_PROMPT_SAFETY_REMINDERS.map((r) => `- ${r}`),
  ];
  if (input.planningOnly || input.incompleteBlueprint) {
    lines.push("", PLANNING_ONLY_BUILDER_NOTE);
  }
  return lines.join("\n");
}

function buildReportBackFormat(taskId: string): string {
  return [
    `Report back for task ${taskId}:`,
    "- Files/modules created or changed (or planned file list if planning-only)",
    "- What was deliberately not built",
    "- Validation performed (manual steps and results)",
    "- Risks, blockers, and safety confirmations",
    "- Open questions before the next task",
  ].join("\n");
}

function formatTaskCardMarkdown(card: {
  id: string;
  title: string;
  phase: string;
  goal: string;
  whyThisMatters: string;
  inputsContext: string;
  likelyFilesModules: string;
  producesCreates: string;
  consumesDependsOn: string;
  interfacesContracts: string;
  whatToBuild: string;
  whatNotToBuildYet: string;
  safetyBoundaries: string;
  smallModelGuidance: string;
  builderPrompt: string;
  validationSteps: string;
  reportBackFormat: string;
  openQuestions: string;
  status: BlueprintPhaseTaskCardStatus;
}): string {
  const statusLabel = TASK_CARD_STATUS_LABELS[card.status];
  return [
    "# NTTC Blueprint Task Card",
    "",
    "## Task ID",
    "",
    card.id,
    "",
    "## Task Title",
    "",
    card.title,
    "",
    "## Phase",
    "",
    card.phase,
    "",
    "## Goal",
    "",
    card.goal,
    "",
    "## Why This Matters",
    "",
    card.whyThisMatters,
    "",
    "## Inputs / Context",
    "",
    card.inputsContext,
    "",
    "## Likely Files / Modules",
    "",
    card.likelyFilesModules,
    "",
    "## Produces / Creates",
    "",
    card.producesCreates,
    "",
    "## Consumes / Depends On",
    "",
    card.consumesDependsOn,
    "",
    "## Interfaces / Contracts",
    "",
    card.interfacesContracts,
    "",
    "## What To Build",
    "",
    card.whatToBuild,
    "",
    "## What Not To Build Yet",
    "",
    card.whatNotToBuildYet,
    "",
    "## Safety Boundaries",
    "",
    card.safetyBoundaries,
    "",
    "## Small-Model Friendly Architecture",
    "",
    card.smallModelGuidance,
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
    "## Open Questions",
    "",
    card.openQuestions,
    "",
    "## Status",
    "",
    statusLabel,
  ].join("\n");
}

function buildInputsContext(input: {
  intake: BlueprintIntake;
  imported: BlueprintImportedRecord;
  completeness: BlueprintCompletenessReport | null;
  phase1Handoff: Phase1BuilderHandoffRecord | null;
  planningStyle: PlanningStyleId;
}): string {
  const { intake, imported, completeness, phase1Handoff, planningStyle } =
    input;
  const lines = [
    `- **Project type:** ${labelForBlueprintProjectType(intake.projectType)}`,
    `- **Target user:** ${labelForBlueprintTargetUser(intake.targetUser)}`,
    `- **Build style:** ${labelForBlueprintBuildStyle(intake.buildStyle)}`,
    `- **Planning style:** ${planningStyle}`,
    `- **Blueprint source:** ${imported.source}`,
    `- **Imported at:** ${imported.importedAt}`,
    `- **Completeness:** ${completeness?.readiness ?? "not checked"}`,
    `- **Phase 1 handoff:** ${phase1Handoff ? "generated" : "not generated yet"}`,
  ];
  if (intake.answersClarifications.trim()) {
    lines.push(
      "",
      "**User answers / clarifications:**",
      intake.answersClarifications.trim(),
    );
  }
  return lines.join("\n");
}

export function buildBlueprintPhaseTaskCards(input: {
  intake: BlueprintIntake;
  imported: BlueprintImportedRecord;
  completeness: BlueprintCompletenessReport | null;
  phase1Handoff: Phase1BuilderHandoffRecord | null;
  planningStyle: PlanningStyleId;
}): BlueprintPhaseTaskCardsRecord {
  const now = new Date().toISOString();
  const sections = extractBlueprintSections(input.imported.blueprintText);
  const buildPhasesText = sections["Build Phases"] ?? "";
  const filePlan =
    sections["Suggested File / Module Plan"] ??
    "Define small focused modules in the blueprint.";
  const openQs =
    sections["Risks / Open Questions"] ?? "(Resolve during planning reviews.)";
  const validationPlan =
    sections["Validation Plan"] ??
    "Add manual smoke steps before expanding scope.";

  const incompleteBlueprint =
    input.completeness != null &&
    input.completeness.readiness !== "ready-for-phase-1" &&
    input.completeness.readiness !== "ready-for-builder-planning-only";
  const missingPhase1Warning = !input.phase1Handoff;

  let templates =
    parseExplicitPhases(buildPhasesText) ??
    defaultTemplatesForProjectType(input.intake.projectType);

  if (templates.length > PREFERRED_MAX && templates.length <= WARN_ABOVE) {
    // keep as-is but warn
  } else if (templates.length > WARN_ABOVE) {
    templates = templates.slice(0, WARN_ABOVE);
  }

  const tooManyTasksWarning = templates.length > WARN_ABOVE;
  const smallModelFriendly =
    input.intake.buildStyle === "small-model-friendly" ||
    isSmallModelFriendlyPlanning(input.planningStyle);

  const smallModelGuidance = smallModelFriendly
    ? SMALL_MODEL_FRIENDLY_CORE_RULE
    : "Prefer small focused files and clear module boundaries where practical.";

  const safetyBoundaries = buildSafetyBoundaries(
    input.intake.constraints,
    incompleteBlueprint,
  );

  const sharedInputs = buildInputsContext(input);

  const cards: BlueprintPhaseTaskCard[] = templates.map((tpl, index) => {
    const id = taskId(tpl.suffix);
    const likelyFilesModules = tpl.likelyFilesModules.includes("blueprint")
      ? `${tpl.likelyFilesModules}\n\nReference: ${filePlan.slice(0, 800)}`
      : `${tpl.likelyFilesModules}\n\nReference blueprint module plan:\n${filePlan.slice(0, 600)}`;

    const validationSteps =
      tpl.suffix === "E" || tpl.suffix === "F"
        ? `${tpl.validationSteps}\n\nBlueprint validation notes:\n${validationPlan.slice(0, 500)}`
        : tpl.validationSteps;

    const builderPrompt = buildBuilderPrompt({
      taskId: id,
      title: tpl.title,
      planningOnly: tpl.planningOnly || incompleteBlueprint,
      incompleteBlueprint,
    });

    const reportBackFormat = buildReportBackFormat(id);
    const status: BlueprintPhaseTaskCardStatus = "drafted";
    const contractFields = buildContractFields(tpl, index, templates.slice(0, index));

    const cardFields = {
      id,
      title: tpl.title,
      phase: "Phase 1",
      goal: tpl.goal,
      whyThisMatters: `This slice keeps Phase 1 small and builder-safe: ${tpl.title}.`,
      inputsContext: sharedInputs,
      likelyFilesModules,
      producesCreates: contractFields.producesCreates,
      consumesDependsOn: contractFields.consumesDependsOn,
      interfacesContracts: contractFields.interfacesContracts,
      whatToBuild: tpl.whatToBuild,
      whatNotToBuildYet: tpl.whatNotToBuildYet,
      safetyBoundaries,
      smallModelGuidance,
      builderPrompt,
      validationSteps,
      reportBackFormat,
      openQuestions: openQs.slice(0, 600),
      status,
    };

    const qualityResult = assessBlueprintTaskCardQuality({
      ...cardFields,
      smallModelFriendly,
    });

    const markdown = formatTaskCardMarkdown(cardFields);
    const taskCardFingerprint = computeTaskCardFingerprint(cardFields);

    return {
      ...cardFields,
      quality: qualityResult.quality,
      qualityFlags: qualityResult.flags,
      createdAt: now,
      updatedAt: now,
      markdown,
      taskCardFingerprint,
    };
  });

  const allCardsMarkdown = cards
    .map((c, i) => `${c.markdown}${i < cards.length - 1 ? "\n\n---\n\n" : ""}`)
    .join("");

  return {
    generatedAt: now,
    sourceBlueprintImportedAt: input.imported.importedAt,
    planningStyle: input.planningStyle,
    buildStyle: input.intake.buildStyle,
    taskCount: cards.length,
    activeTaskId: cards[0]?.id ?? null,
    incompleteBlueprintWarning: incompleteBlueprint,
    missingPhase1Warning,
    tooManyTasksWarning,
    cards,
    allCardsMarkdown,
  };
}

export function buildTaskCardsPlanningSummary(
  record: BlueprintPhaseTaskCardsRecord,
): string {
  const lines = [
    "## Blueprint Phase Task Cards (summary)",
    "",
    `- Generated: ${record.generatedAt}`,
    `- Task count: ${record.taskCount}`,
    `- Active task: ${record.activeTaskId ?? "none"}`,
    "",
    "| Task ID | Title | Status | Quality |",
    "| --- | --- | --- | --- |",
  ];
  for (const card of record.cards) {
    lines.push(
      `| ${card.id} | ${card.title} | ${TASK_CARD_STATUS_LABELS[card.status]} | ${card.quality} |`,
    );
  }
  if (record.incompleteBlueprintWarning) {
    lines.push("", "_Blueprint was incomplete at generation — cards may be planning-only._");
  }
  return lines.join("\n");
}

export function findNextTaskCardId(
  record: BlueprintPhaseTaskCardsRecord,
): string | null {
  const order = record.cards.map((c) => c.id);
  const byId = new Map(record.cards.map((c) => [c.id, c]));
  for (const id of order) {
    const card = byId.get(id);
    if (!card) continue;
    if (
      card.status === "drafted" ||
      card.status === "planned" ||
      card.status === "sent-to-builder" ||
      card.status === "implementation-returned"
    ) {
      return id;
    }
  }
  return null;
}

export function countBlockedTaskCards(
  record: BlueprintPhaseTaskCardsRecord,
): number {
  return record.cards.filter((c) => c.status === "blocked").length;
}

export function countReadyToSendTaskCards(
  record: BlueprintPhaseTaskCardsRecord,
): number {
  return record.cards.filter(
    (c) => c.status === "drafted" || c.status === "planned",
  ).length;
}
