import type {
  BacklogItem,
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  BuilderPromptPack,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointAvailabilityState,
  CheckpointRecord,
  DecisionReport,
  ExternalReviewRecord,
  ImplementationReviewRecord,
  InstalledOllamaModelsState,
  LocalAiAdvisorResponse,
  OutsideReviewPack,
  PatchReviewPack,
  ProjectInfo,
  ProjectMemoryFilePreview,
  ProjectMemoryPreview,
  ProjectMemorySavedRecord,
  CodeContextPack,
  CodeContextAiRecord,
  CodeQuestionTemplateSelection,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecord,
  ImportedPatchDraftRecord,
  ExternalPatchDraftComparisonRecord,
  BuilderHandoffExportRecord,
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskCardsRecord,
  ArchitectureRefactorTaskCard,
  ArchitectureRefactorTaskBuilderHandoffRecord,
  ArchitectureRefactorTaskImplementationReportRecord,
  PlanningStyleId,
  ProjectScanResult,
  RoleModelMappingState,
  SafeChecksState,
  SafetyGateStatus,
  SpeakerScriptRecord,
} from "../../shared/types";
import { calculateDailyNextAction } from "../../shared/dailyNextAction";
import { getPlanningStyleReportLine } from "../../shared/planningStyle";
import {
  CURRENT_NTTC_STAGE_LABEL,
  PROJECT_MEMORY_DO_NOT_DO,
  PROJECT_MEMORY_FILE_NAMES,
  PROJECT_MEMORY_SAFETY_NOTE,
} from "../../shared/projectMemoryConstants";
import { countMappedRoles } from "../../shared/roleModelMapping";
import {
  backlogOpenCount,
  backlogOpenCriticalSafetyCount,
} from "../review/BacklogManager";

const MAX_FILE_CHARS = 48_000;
const MAX_EXCERPT_CHARS = 2_500;
const MAX_LIST_ITEMS = 30;

export interface ProjectMemoryInput {
  userRequest: string;
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  summaryIsFromHistory: boolean;
  safety: SafetyGateStatus;
  checkpoint: CheckpointRecord | null;
  checkpointAvailability: CheckpointAvailabilityState;
  safeChecks: SafeChecksState;
  changedFiles: ChangedFilesScanResult | null;
  reviewPack: OutsideReviewPack | null;
  patchReviewPack: PatchReviewPack | null;
  decisionReport: DecisionReport | null;
  builderPrompt: BuilderPromptPack | null;
  builderResult: BuilderResultRecord | null;
  advisorResponse: LocalAiAdvisorResponse | null;
  externalReviews: ExternalReviewRecord[];
  speakerScript: SpeakerScriptRecord | null;
  builderPlan: BuilderPlanRecord | null;
  builderPlanComparison: BuilderPlanComparisonRecord | null;
  implementationReview: ImplementationReviewRecord | null;
  roleModelMapping: RoleModelMappingState | null;
  installedModels: InstalledOllamaModelsState | null;
  backlogItems: BacklogItem[];
  backlogCriticalSafetyOpen: number;
  projectMemoryLastSaved: ProjectMemorySavedRecord | null;
  codeContextPreview?: CodeContextPack | null;
  codeContextAiResponse?: CodeContextAiRecord | null;
  codeContextQuestionTemplate?: CodeQuestionTemplateSelection | null;
  patchDraftResponse?: PatchDraftRecord | null;
  patchDraftSafetyReview?: PatchDraftSafetyReviewRecord | null;
  importedPatchDraft?: ImportedPatchDraftRecord | null;
  externalPatchDraftComparison?: ExternalPatchDraftComparisonRecord | null;
  builderHandoffExport?: BuilderHandoffExportRecord | null;
  architectureHealth?: ArchitectureHealthRecord | null;
  architectureRefactorTaskCards?: ArchitectureRefactorTaskCardsRecord | null;
  architectureRefactorTaskBuilderHandoff?: ArchitectureRefactorTaskBuilderHandoffRecord | null;
  architectureRefactorTaskImplementationReports?: Record<
    string,
    ArchitectureRefactorTaskImplementationReportRecord
  > | null;
  planningStyle?: PlanningStyleId;
}

function bullets(items: string[], empty = "None recorded yet."): string {
  if (!items.length) return `- ${empty}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function excerpt(text: string | null | undefined, label: string): string {
  if (!text?.trim()) return `_No ${label} available._`;
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_EXCERPT_CHARS)}\n\n…(truncated excerpt)`;
}

function truncateFile(
  content: string,
  fileName: string,
  flags: string[],
): { content: string; truncated: boolean } {
  if (content.length <= MAX_FILE_CHARS) {
    return { content, truncated: false };
  }
  flags.push(
    `${fileName} truncated (${content.length} → ${MAX_FILE_CHARS} characters).`,
  );
  return {
    content: `${content.slice(0, MAX_FILE_CHARS)}\n\n…(truncated for safe export size)`,
    truncated: true,
  };
}

function reportYesNo(value: unknown): string {
  return value ? "Yes" : "No";
}

function buildPlanMd(input: ProjectMemoryInput): string {
  const daily = calculateDailyNextAction({
    project: input.project,
    summary: input.summary,
    summaryIsFromHistory: input.summaryIsFromHistory,
    checkpointAvailability: input.checkpointAvailability,
    safeChecks: input.safeChecks,
    changedFilesScan: input.changedFiles,
    patchReviewPack: input.patchReviewPack,
    reviewPack: input.reviewPack,
    externalReviews: input.externalReviews,
    decisionReport: input.decisionReport,
    builderPromptGeneratedAt: input.builderPrompt?.generatedAt ?? null,
    builderResult: input.builderResult,
    implementationReview: input.implementationReview,
    backlogCriticalSafetyOpen: input.backlogCriticalSafetyOpen,
    projectMemoryLastSaved: input.projectMemoryLastSaved,
    builderPlanGeneratedAt: input.builderPlan?.generatedAt ?? null,
    builderPlanComparisonGeneratedAt:
      input.builderPlanComparison?.generatedAt ?? null,
    codeContextPreview: input.codeContextPreview ?? null,
    codeContextAiResponse: input.codeContextAiResponse ?? null,
    codeContextQuestionTemplate: input.codeContextQuestionTemplate ?? null,
    patchDraftResponse: input.patchDraftResponse ?? null,
    patchDraftSafetyReview: input.patchDraftSafetyReview ?? null,
    importedPatchDraft: input.importedPatchDraft ?? null,
    externalPatchDraftComparison: input.externalPatchDraftComparison ?? null,
    builderHandoffExport: input.builderHandoffExport ?? null,
    userRequest: input.userRequest,
    planningStyle: input.planningStyle ?? "small-model-friendly",
  });

  const backlogTasks = input.backlogItems
    .filter((item) => item.status === "Open" || item.status === "In review")
    .slice(0, MAX_LIST_ITEMS)
    .map((item, index) => {
      const status =
        item.status === "In review"
          ? "In progress"
          : item.status === "Later"
            ? "Planned"
            : "Planned";
      return `${index + 1}. **${item.title}** (${item.type}, ${item.priority})\n   - Goal: ${item.title}\n   - Why it matters: ${item.notes?.split("\n")[0] || "Tracked in NTTC backlog."}\n   - Likely files/areas: metadata only — see Project Summary / Patch Review Pack\n   - Required safety boundaries: ${PROJECT_MEMORY_SAFETY_NOTE}\n   - Validation steps: re-run Build/Test Checks and review reports after outside builder work\n   - Status: ${status}`;
    });

  const decisionNext =
    input.decisionReport?.recommendedNextAction.label ??
    daily.title;

  return `# NTTC Plan

> ${PROJECT_MEMORY_SAFETY_NOTE}

## Project

- **Name:** ${input.project?.displayName ?? "No project selected"}
- **Path:** ${input.project?.normalizedPath ?? "—"}
- **OneDrive:** ${input.safety.project?.isOneDrive ? "Yes — sync may lock files" : "No"}

## Current Goal

${excerpt(input.userRequest, "user request")}

## Current Stage

- **NTTC stage:** ${CURRENT_NTTC_STAGE_LABEL}
- **App mode:** ${input.safety.mode} (general source edits still disabled)
- **Project memory:** documentation export to \`.nttc/\` only

## Planned Work

${backlogTasks.length ? backlogTasks.join("\n\n") : "_No open backlog items. Use NTTC backlog or outside planning to add tasks._"}

## Next Recommended Action

- **Dashboard:** ${daily.title} — ${daily.reason}
- **Decision report:** ${decisionNext}

## Do-Not-Do List

${bullets(PROJECT_MEMORY_DO_NOT_DO)}

## Planning Style

${getPlanningStyleReportLine(input.planningStyle ?? "small-model-friendly")}

When planning outside-builder work, prefer small focused modules and clear file boundaries instead of one giant file.
`;
}

function buildDoneMd(input: ProjectMemoryInput): string {
  const check = input.safeChecks.lastResult;
  const features = [
    "Inspect-only supervisor console with Safety Gate",
    "Project Summary (metadata-only scan)",
    "Changed-files metadata + Patch Review Pack",
    "Copy-Paste Review Report, Decision Report, Builder Prompt",
    "Safety Backup create/verify/restore",
    "Allowlisted Build/Test Checks",
    "Local AI roles (metadata-only Ollama prompts)",
    "Builder Plan Mode (plan-only)",
    "Builder Plan Comparison (rule-based)",
    "Implementation Review (rule-based)",
    "Speaker Scripts (template text-only)",
    "Role Model Mapping",
    "Project Memory export to `.nttc/` (markdown docs only)",
    "Code Context Pack builder (preview/copy; optional Local AI review after confirmation)",
  ];

  const limitations = [
    "No source-code editing in NTTC yet",
    "Local AI is metadata-only — no direct file access",
    "Builder Plan Comparison is rule-based, not AI",
    "Implementation Review is rule-based, not AI",
    "Speaker Scripts are template-based text only",
    "Live Qwen execution is disabled",
    "No arbitrary terminal or custom command typing",
    "NTTC does not install packages automatically",
  ];

  return `# NTTC Done Log

> ${PROJECT_MEMORY_SAFETY_NOTE}

## Completed Stages

NTTC has progressed through staged inspect/review features through **${CURRENT_NTTC_STAGE_LABEL}**. Major completed areas include safety backup, reports, builder planning/review imports, role mapping, clickable role help, message polish, packaged Windows app rebuilds, and controlled \`.nttc/\` documentation export.

## Validation Evidence

- **Safety Backup:** ${input.checkpointAvailability.restorable ? "Verified restorable" : input.checkpointAvailability.label}
- **Latest checkpoint:** ${input.checkpoint?.methodLabel ?? "None this session"}
- **Build/Test Checks:** ${
    check
      ? `${check.scriptName} — ${check.status} (${check.plainEnglishSummary})`
      : "No allowlisted check run this session"
  }
- **Packaged app:** Windows packaged build supported via \`npm run pack\` / installer (see repo release folder when developing NTTC itself)
- **Project Summary:** ${input.summary ? `Generated ${input.summary.scannedAt}` : "Not generated"}

## Known Working Features

${bullets(features)}

## Known Limitations

${bullets(limitations)}
`;
}

function buildContextMd(input: ProjectMemoryInput): string {
  const daily = calculateDailyNextAction({
    project: input.project,
    summary: input.summary,
    summaryIsFromHistory: input.summaryIsFromHistory,
    checkpointAvailability: input.checkpointAvailability,
    safeChecks: input.safeChecks,
    changedFilesScan: input.changedFiles,
    patchReviewPack: input.patchReviewPack,
    reviewPack: input.reviewPack,
    externalReviews: input.externalReviews,
    decisionReport: input.decisionReport,
    builderPromptGeneratedAt: input.builderPrompt?.generatedAt ?? null,
    builderResult: input.builderResult,
    implementationReview: input.implementationReview,
    backlogCriticalSafetyOpen: input.backlogCriticalSafetyOpen,
    projectMemoryLastSaved: input.projectMemoryLastSaved,
    builderPlanGeneratedAt: input.builderPlan?.generatedAt ?? null,
    builderPlanComparisonGeneratedAt:
      input.builderPlanComparison?.generatedAt ?? null,
    codeContextPreview: input.codeContextPreview ?? null,
    codeContextAiResponse: input.codeContextAiResponse ?? null,
    codeContextQuestionTemplate: input.codeContextQuestionTemplate ?? null,
    patchDraftResponse: input.patchDraftResponse ?? null,
    patchDraftSafetyReview: input.patchDraftSafetyReview ?? null,
    importedPatchDraft: input.importedPatchDraft ?? null,
    externalPatchDraftComparison: input.externalPatchDraftComparison ?? null,
    builderHandoffExport: input.builderHandoffExport ?? null,
    userRequest: input.userRequest,
    planningStyle: input.planningStyle ?? "small-model-friendly",
  });

  const archLines: string[] = [];
  if (input.summary) {
    archLines.push(
      `Likely project types: ${input.summary.likelyProjectTypes.join(", ") || "unknown"}`,
    );
    archLines.push(
      `Tech stack (metadata): ${input.summary.techStack.join(", ") || "unknown"}`,
    );
    archLines.push(
      `Important folders (names only): ${input.summary.importantFolders.slice(0, 12).join(", ") || "none listed"}`,
    );
  } else {
    archLines.push("No Project Summary yet — summarize in NTTC first.");
  }

  if (input.architectureHealth && !input.architectureHealth.stale) {
    archLines.push(
      `Architecture Health (${input.architectureHealth.generatedAt}): ${input.architectureHealth.recommendation}`,
    );
    archLines.push(
      `Largest file: ${input.architectureHealth.largestFilePath ?? "n/a"} (${input.architectureHealth.largestFileLineCount} lines)`,
    );
    archLines.push(
      `Critical monolith files: ${input.architectureHealth.criticalCount}; warning-level: ${input.architectureHealth.warningCount}`,
    );
  } else if (input.architectureHealth?.stale) {
    archLines.push("Architecture Health report exists but is stale — regenerate on Reports tab.");
  }

  if (input.architectureRefactorTaskCards && !input.architectureRefactorTaskCards.stale) {
    const reviewed = input.architectureRefactorTaskCards.cards.filter(
      (c: ArchitectureRefactorTaskCard) => c.status === "reviewed",
    ).length;
    archLines.push(
      `Architecture refactor task cards exist: ${input.architectureRefactorTaskCards.taskCount} cards, ${reviewed} reviewed.`,
    );
  } else if (input.architectureRefactorTaskCards?.stale) {
    archLines.push(
      "Architecture refactor task cards exist but are stale — regenerate after Architecture Health updates.",
    );
  }

  if (
    input.architectureRefactorTaskBuilderHandoff &&
    !input.architectureRefactorTaskBuilderHandoff.stale
  ) {
    archLines.push(
      `Architecture refactor handoff exists for ${input.architectureRefactorTaskBuilderHandoff.selectedTaskId}.`,
    );
  } else if (input.architectureRefactorTaskBuilderHandoff?.stale) {
    archLines.push(
      "Architecture refactor handoff exists but is stale — regenerate after refactor card or Architecture Health changes.",
    );
  }

  if (input.architectureRefactorTaskImplementationReports) {
    const reports = Object.values(input.architectureRefactorTaskImplementationReports);
    const reviewed = reports.filter((r) => r.markedReviewed && !r.stale).length;
    const stale = reports.filter((r) => r.stale).length;
    if (reports.length > 0) {
      archLines.push(
        `Architecture refactor implementation reports exist: ${reports.length} reports, ${reviewed} reviewed, ${stale} stale.`,
      );
    }
  }

  return `# NTTC Context

## What NTTC Is

New Type Tech Coder (NTTC) is a non-terminal AI coding **supervisor console** for non-coders. It helps inspect a project safely, gather reports, and coordinate outside AI builders/reviewers without giving AI direct file access or command execution.

## Product Goal

The long-term goal is to let a user have AI build software in a safe non-terminal setting. The current app is the inspect/review foundation.

## Current Safety Model

- **Mode:** ${input.safety.mode}
- **General writes:** disabled (source code is not edited by NTTC)
- **Project memory writes:** approved markdown files inside \`.nttc/\` only, after user confirmation
- **Commands:** allowlisted Build/Test Checks only at project root
- **AI:** metadata-only prompts/responses; no live Qwen; no AI command running

## Architecture Summary

${bullets(archLines, "No summary metadata.")}

## Current Workflow

1. Select project
2. Summarize (metadata scan)
3. Create / verify Safety Backup
4. Run Build/Test Checks (optional)
5. Builder Plan / outside builder plan import
6. Comparison / implementation report import
7. Implementation Review
8. Decision Report + Builder Prompt
9. Project Memory export to \`.nttc/\`
10. Code Context Pack preview (selected excerpts)
11. Ask Local AI About Selected Code (approved pack only; user confirmation required)
12. Patch Draft Mode (draft only; no apply)
13. Patch Draft Safety Review (rule-based; no apply)
14. Manual Imported Patch Draft (paste only; no apply)

## Code Context / Local AI Status

- **Code Context Pack:** ${input.codeContextPreview ? `generated ${input.codeContextPreview.generatedAt}` : "not generated"}
- **Code Question Template:** ${input.codeContextQuestionTemplate?.templateLabel ?? "none selected"}
- **Local AI Code Review:** ${input.codeContextAiResponse ? `${input.codeContextAiResponse.modelName} at ${input.codeContextAiResponse.generatedAt}` : "not requested"}
${input.codeContextAiResponse ? `- **Excerpt:** ${excerpt(input.codeContextAiResponse.previewExcerpt, "code AI response")}` : ""}
- **Patch Draft:** ${input.patchDraftResponse ? `${input.patchDraftResponse.modelName} at ${input.patchDraftResponse.generatedAt}` : "not generated"}
${input.patchDraftResponse ? `- **Patch Draft recommendation:** ${input.patchDraftResponse.recommendation ?? "not detected"}` : ""}
${input.patchDraftResponse ? `- **Patch Draft excerpt:** ${excerpt(input.patchDraftResponse.previewExcerpt, "patch draft")}` : ""}
- **Patch Draft warning:** draft only — NTTC did not edit source files or apply patches.
- **Patch Draft Safety Review:** ${input.patchDraftSafetyReview ? `${input.patchDraftSafetyReview.recommendation} at ${input.patchDraftSafetyReview.generatedAt}` : "not generated"}
${input.patchDraftSafetyReview ? `- **Safety review excerpt:** ${excerpt(input.patchDraftSafetyReview.previewExcerpt, "patch draft safety review")}` : ""}
- **Safety review warning:** rule-based review only — NTTC did not apply the patch.
${input.patchDraftSafetyReview?.reviewTargetLabel ? `- **Safety review target:** ${input.patchDraftSafetyReview.reviewTargetLabel}` : ""}
- **Imported Patch Draft:** ${input.importedPatchDraft ? `${input.importedPatchDraft.source} · ${input.importedPatchDraft.draftType} at ${input.importedPatchDraft.importedAt}` : "not imported"}
${input.importedPatchDraft ? `- **Imported risk summary:** ${input.importedPatchDraft.riskPhraseCount} risk phrase(s)` : ""}
${input.importedPatchDraft && input.patchDraftSafetyReview?.reviewTargetKind === "imported-patch-draft" ? `- **Imported draft safety review recommendation:** ${input.patchDraftSafetyReview.recommendation}` : ""}
- **External Patch Draft Comparison:** ${input.externalPatchDraftComparison ? `${input.externalPatchDraftComparison.riskLevel} · ${input.externalPatchDraftComparison.recommendation}` : "not generated"}
${input.externalPatchDraftComparison ? `- **Compared drafts:** NTTC ${input.externalPatchDraftComparison.nttcPatchDraftExisted ? "yes" : "no"} / imported ${input.externalPatchDraftComparison.importedPatchDraftExisted ? "yes" : "no"}` : ""}
${input.externalPatchDraftComparison ? `- **Biggest conflict:** ${input.externalPatchDraftComparison.biggestConflict.slice(0, 220)}` : ""}
${input.externalPatchDraftComparison?.riskLevel === "High" || input.externalPatchDraftComparison?.riskLevel === "Blocked / Do not proceed" ? "- **Small-model friendly note:** Narrow the plan into focused modules before builder work." : ""}
- **Builder Handoff Pack:** ${input.builderHandoffExport ? `${input.builderHandoffExport.target} · ${input.builderHandoffExport.strictness} · ${input.builderHandoffExport.recommendation}` : "not generated"}
${input.builderHandoffExport ? `- **Handoff generated:** ${input.builderHandoffExport.generatedAt}` : ""}
${input.builderHandoffExport ? `- **Handoff missing context:** ${input.builderHandoffExport.missingContextCount} item(s) — ${input.builderHandoffExport.missingContextItems.slice(0, 4).join("; ")}` : ""}
- **Imported draft warning:** proposal only — NTTC did not apply the patch and does not auto-save full draft text to \`.nttc/\`.
- **${getPlanningStyleReportLine(input.planningStyle ?? "small-model-friendly")}**

## Current Next Step

**${daily.title}** — ${daily.reason}
`;
}

function buildReviewHandoffMd(input: ProjectMemoryInput): string {
  const changedMeta = input.changedFiles;
  const areas: string[] = [];
  if (input.summary?.importantFolders?.length) {
    areas.push(
      ...input.summary.importantFolders.slice(0, 15).map((f) => `Folder: ${f}`),
    );
  }
  if (changedMeta?.files?.length) {
    areas.push(
      ...changedMeta.files.slice(0, 20).map((f) => `Changed: ${f.path} (${f.kind})`),
    );
  }

  const tried: string[] = [];
  if (input.builderPlan) tried.push(`Builder Plan (${input.builderPlan.generatedAt})`);
  if (input.builderPlanComparison) {
    tried.push(
      `Builder Plan Comparison (${input.builderPlanComparison.generatedAt})`,
    );
  }
  if (input.implementationReview) {
    tried.push(
      `Implementation Review (${input.implementationReview.generatedAt}) — ${input.implementationReview.recommendation}`,
    );
  }
  if (input.externalReviews.length) {
    tried.push(
      `${input.externalReviews.length} external review(s) saved in NTTC`,
    );
  }
  if (input.safeChecks.lastResult) {
    tried.push(`Build/Test Check: ${input.safeChecks.lastResult.scriptName}`);
  }

  const questions = [
    "Does the current plan respect NTTC safety boundaries (no casual edit mode / terminal bypass)?",
    "What is the smallest next builder patch that can be validated with Build/Test Checks?",
    "Are there risks in changed-file metadata or implementation claims that need human review?",
    "Should the user refresh Safety Backup before proceeding?",
    input.decisionReport
      ? `Decision Report recommends: ${input.decisionReport.recommendedNextAction.label} — agree or revise?`
      : "Should a Decision Report be generated before builder work continues?",
  ];

  return `# NTTC Review Handoff

> ${PROJECT_MEMORY_SAFETY_NOTE}

## What I Need Reviewed

${excerpt(input.userRequest, "user request")}

## Current Project Status

- **Project:** ${input.project?.displayName ?? "—"}
- **Summary:** ${input.summary ? "available" : "missing"}
- **Safety Backup:** ${input.checkpointAvailability.label}
- **Open backlog (critical safety):** ${input.backlogCriticalSafetyOpen}
- **Open backlog (total open):** ${backlogOpenCount(input.backlogItems)}

## What Has Already Been Tried

${bullets(tried, "No builder/review artifacts recorded yet.")}

## Safety Rules For Reviewer

- Do not suggest enabling edit mode casually
- Do not suggest arbitrary terminal access or custom command typing
- Do not suggest bypassing Safety Backup
- Flag any source-editing plan clearly and recommend checks/tests
- Treat NTTC reports as metadata — not full source context

## Questions For Reviewer

${bullets(questions)}

## Files / Areas Likely Relevant

${bullets(areas, "Use Project Summary + Patch Review Pack metadata in NTTC.")}

## Reports Available

| Report | Available |
| --- | --- |
| Project Summary | ${reportYesNo(input.summary)} |
| Copy-Paste Review Report | ${reportYesNo(input.reviewPack)} |
| Patch Review Pack | ${reportYesNo(input.patchReviewPack)} |
| Decision Report | ${reportYesNo(input.decisionReport)} |
| Builder Prompt | ${reportYesNo(input.builderPrompt)} |
| Builder Plan | ${reportYesNo(input.builderPlan)} |
| Builder Plan Comparison | ${reportYesNo(input.builderPlanComparison)} |
| Implementation Review | ${reportYesNo(input.implementationReview)} |
| Speaker Script | ${reportYesNo(input.speakerScript)} |
| Local AI role response | ${reportYesNo(input.advisorResponse)} |
| External reviews | ${input.externalReviews.length > 0 ? `Yes (${input.externalReviews.length})` : "No"} |
| Project Memory (this export) | Yes (markdown docs in \`.nttc/\`) |
`;
}

function buildThreadExportMd(input: ProjectMemoryInput): string {
  const daily = calculateDailyNextAction({
    project: input.project,
    summary: input.summary,
    summaryIsFromHistory: input.summaryIsFromHistory,
    checkpointAvailability: input.checkpointAvailability,
    safeChecks: input.safeChecks,
    changedFilesScan: input.changedFiles,
    patchReviewPack: input.patchReviewPack,
    reviewPack: input.reviewPack,
    externalReviews: input.externalReviews,
    decisionReport: input.decisionReport,
    builderPromptGeneratedAt: input.builderPrompt?.generatedAt ?? null,
    builderResult: input.builderResult,
    implementationReview: input.implementationReview,
    backlogCriticalSafetyOpen: input.backlogCriticalSafetyOpen,
    projectMemoryLastSaved: input.projectMemoryLastSaved,
    builderPlanGeneratedAt: input.builderPlan?.generatedAt ?? null,
    builderPlanComparisonGeneratedAt:
      input.builderPlanComparison?.generatedAt ?? null,
    codeContextPreview: input.codeContextPreview ?? null,
    codeContextAiResponse: input.codeContextAiResponse ?? null,
    codeContextQuestionTemplate: input.codeContextQuestionTemplate ?? null,
    patchDraftResponse: input.patchDraftResponse ?? null,
    patchDraftSafetyReview: input.patchDraftSafetyReview ?? null,
    importedPatchDraft: input.importedPatchDraft ?? null,
    externalPatchDraftComparison: input.externalPatchDraftComparison ?? null,
    builderHandoffExport: input.builderHandoffExport ?? null,
    userRequest: input.userRequest,
    planningStyle: input.planningStyle ?? "small-model-friendly",
  });

  const mapped = input.roleModelMapping
    ? countMappedRoles(input.roleModelMapping.mappings)
    : 0;

  return `# NTTC Thread Export

## User Current Request

${excerpt(input.userRequest, "user request")}

## Important Conversation Summary

- NTTC goal: AI-assisted coding in a safe non-terminal supervisor console
- Current app: inspect/review only; source editing is a later controlled stage
- Bridge features: project memory (this stage), future code context, future patch draft
- Safety: backups, allowlisted checks, metadata-only AI, no command execution

## Latest Reports

### Decision Report
${excerpt(input.decisionReport?.previewExcerpt, "decision report")}

### Builder Plan
${excerpt(input.builderPlan?.previewExcerpt, "builder plan")}

### Builder Plan Comparison
${excerpt(input.builderPlanComparison?.previewExcerpt, "builder plan comparison")}

### Implementation Review
${excerpt(input.implementationReview?.previewExcerpt, "implementation review")}

### Backlog
- Open items: ${backlogOpenCount(input.backlogItems)}
- Critical safety open: ${backlogOpenCriticalSafetyCount(input.backlogItems)}

### Daily Next Action
- **${daily.title}** — ${daily.reason}

### Role Model Mapping
- Mapped roles: ${mapped}
- Installed models cached: ${input.installedModels?.models?.length ?? 0}

## Next Prompt To AI Builder

${excerpt(
    input.builderPrompt?.previewExcerpt ?? input.builderPrompt?.markdownReport,
    "builder prompt",
  )}
`;
}

export function buildProjectMemoryPreview(
  input: ProjectMemoryInput,
): ProjectMemoryPreview {
  const truncationFlags: string[] = [];
  const generatedAt = new Date().toISOString();

  const rawFiles: Array<{ fileName: string; content: string }> = [
    { fileName: "NTTC_PLAN.md", content: buildPlanMd(input) },
    { fileName: "NTTC_DONE.md", content: buildDoneMd(input) },
    { fileName: "NTTC_CONTEXT.md", content: buildContextMd(input) },
    { fileName: "NTTC_REVIEW_HANDOFF.md", content: buildReviewHandoffMd(input) },
    { fileName: "NTTC_THREAD_EXPORT.md", content: buildThreadExportMd(input) },
  ];

  const files: ProjectMemoryFilePreview[] = rawFiles.map(({ fileName, content }) => {
    const truncated = truncateFile(content, fileName, truncationFlags);
    return {
      fileName,
      content: truncated.content,
      truncated: truncated.truncated,
      charCount: truncated.content.length,
    };
  });

  const bundleMarkdown = files
    .map(
      (file) =>
        `---\n\n# File: ${file.fileName}\n\n${file.content}`,
    )
    .join("\n\n");

  return {
    generatedAt,
    files,
    bundleMarkdown,
    truncationFlags,
    projectSelected: Boolean(input.project),
  };
}

export function projectMemoryFileNames(): readonly string[] {
  return PROJECT_MEMORY_FILE_NAMES;
}
