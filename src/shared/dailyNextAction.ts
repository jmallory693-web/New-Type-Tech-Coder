import type {
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointAvailabilityState,
  CodeContextAiRecord,
  CodeContextPack,
  CodeQuestionTemplateSelection,
  DecisionReport,
  ExternalReviewRecord,
  ImplementationReviewRecord,
  OutsideReviewPack,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecord,
  ImportedPatchDraftRecord,
  ExternalPatchDraftComparisonRecord,
  BuilderHandoffExportRecord,
  PatchReviewPack,
  ProjectInfo,
  ProjectMemorySavedRecord,
  ProjectScanResult,
  SafeChecksState,
} from "./types";
import {
  draftImpliesBroadFileChanges,
  isSmallModelFriendlyPlanning,
  type PlanningStyleId,
} from "./planningStyle";

/** Stage 31: Dashboard daily-use next action (rule-based, not AI). */
export type DailyNextActionKind =
  | "select-project"
  | "summarize"
  | "verify-backup"
  | "create-backup"
  | "go-safety-checks"
  | "generate-patch-pack"
  | "generate-review-pack"
  | "generate-decision"
  | "review-warnings"
  | "generate-builder-prompt"
  | "paste-builder-result"
  | "review-builder-result"
  | "generate-implementation-review"
  | "open-external-review"
  | "export-project-memory"
  | "ask-code-context-ai"
  | "refresh-code-context"
  | "generate-patch-draft"
  | "generate-patch-draft-safety-review"
  | "generate-external-patch-draft-comparison"
  | "generate-builder-handoff-export"
  | "manual-patch-draft-import"
  | "open-blueprint"
  | "import-blueprint"
  | "check-blueprint-completeness"
  | "export-planning-documents"
  | "generate-phase1-handoff"
  | "generate-blueprint-phase-task-cards"
  | "copy-blueprint-phase-task-card"
  | "generate-task-card-builder-handoff"
  | "copy-task-card-builder-handoff"
  | "paste-task-implementation-report"
  | "mark-task-implementation-returned"
  | "generate-blueprint-task-reconciliation"
  | "resolve-missing-task-producers"
  | "fix-task-status-inconsistency"
  | "generate-task-artifact-index"
  | "resolve-unlinked-task-artifacts"
  | "resolve-stale-task-artifacts"
  | "link-changed-files-to-task"
  | "review-changed-files-scope-warnings"
  | "generate-architecture-health-report"
  | "regenerate-architecture-health-report"
  | "review-monolith-risk-changed-files"
  | "create-refactor-task-for-monolith"
  | "generate-architecture-refactor-task-cards"
  | "review-architecture-refactor-task-card"
  | "regenerate-architecture-refactor-task-cards"
  | "generate-architecture-refactor-task-builder-handoff"
  | "copy-architecture-refactor-task-builder-handoff"
  | "paste-architecture-refactor-implementation-report"
  | "mark-architecture-refactor-implementation-returned"
  | "wait-for-refactor-builder-report"
  | "open-build-mode"
  | "create-blueprint-before-scaffold"
  | "build-mode-planning-only"
  | "select-safe-scaffold-target-folder"
  | "choose-empty-scaffold-target-folder"
  | "safe-scaffold-target-ready"
  | "generate-safe-scaffold-file-tree-preview"
  | "review-safe-scaffold-file-tree-preview"
  | "regenerate-safe-scaffold-file-tree-preview"
  | "generate-safe-scaffold-file-content-preview"
  | "review-safe-scaffold-file-content-preview"
  | "regenerate-safe-scaffold-file-content-preview"
  | "generate-safe-scaffold-write-manifest-preview"
  | "review-safe-scaffold-write-manifest-preview"
  | "regenerate-safe-scaffold-write-manifest-preview"
  | "record-safe-scaffold-final-confirmation"
  | "rerecord-safe-scaffold-final-confirmation"
  | "safe-scaffold-final-confirmation-recorded"
  | "run-safe-scaffold-write"
  | "resolve-safe-scaffold-write-blockers"
  | "review-written-safe-scaffold-files"
  | "generate-local-planner-build-brief"
  | "regenerate-local-planner-build-brief"
  | "copy-local-planner-build-brief"
  | "paste-local-planner-response"
  | "revise-local-planner-response"
  | "local-planner-response-accepted"
  | "generate-local-coder-task-prompt"
  | "regenerate-local-coder-task-prompt"
  | "copy-local-coder-task-prompt"
  | "ready-continue";

export type DailyNextActionMode = "run" | "navigate";

export interface DailyNextActionButton {
  label: string;
  kind: DailyNextActionKind;
  mode: DailyNextActionMode;
}

export interface DailyNextAction {
  id: DailyNextActionKind;
  title: string;
  reason: string;
  /** Stage 76: plain-English outcome of the recommended step. */
  expectedResult: string;
  freshnessHints: string[];
  primary: DailyNextActionButton;
  secondary: DailyNextActionButton | null;
}

export interface DailyNextActionInput {
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  summaryIsFromHistory: boolean;
  checkpointAvailability: CheckpointAvailabilityState;
  safeChecks: SafeChecksState;
  changedFilesScan: ChangedFilesScanResult | null;
  patchReviewPack: PatchReviewPack | null;
  reviewPack: OutsideReviewPack | null;
  externalReviews: ExternalReviewRecord[];
  decisionReport: DecisionReport | null;
  builderPromptGeneratedAt: string | null;
  builderResult: BuilderResultRecord | null;
  implementationReview: ImplementationReviewRecord | null;
  backlogCriticalSafetyOpen: number;
  projectMemoryLastSaved: ProjectMemorySavedRecord | null;
  builderPlanGeneratedAt: string | null;
  builderPlanComparisonGeneratedAt: string | null;
  codeContextPreview?: CodeContextPack | null;
  codeContextAiResponse?: CodeContextAiRecord | null;
  codeContextQuestionTemplate?: CodeQuestionTemplateSelection | null;
  patchDraftResponse?: PatchDraftRecord | null;
  patchDraftSafetyReview?: PatchDraftSafetyReviewRecord | null;
  importedPatchDraft?: ImportedPatchDraftRecord | null;
  externalPatchDraftComparison?: ExternalPatchDraftComparisonRecord | null;
  builderHandoffExport?: BuilderHandoffExportRecord | null;
  planningStyle?: PlanningStyleId;
  userRequest?: string;
  blueprintStatus?: {
    ideaExists: boolean;
    blueprintImported: boolean;
    completenessCheckExists: boolean;
    planningDocsPreviewExists: boolean;
    planningDocsExported: boolean;
    phase1HandoffExists: boolean;
    readinessStatus: string | null;
    localPlannerDraftExists?: boolean;
    localPlannerDraftSavedAsBlueprint?: boolean;
    localPlannerAiStatus?: string;
    taskCardsExist?: boolean;
    activeTaskId?: string | null;
    nextTaskId?: string | null;
    blockedTaskCount?: number;
    readyToSendTaskCount?: number;
    implementationReturnedTaskCount?: number;
    taskBuilderHandoffExists?: boolean;
    taskBuilderHandoffSelectedTaskId?: string | null;
    taskBuilderHandoffReadiness?: string | null;
    taskBuilderHandoffStale?: boolean;
    taskBuilderHandoffCopied?: boolean;
    activeTaskStatus?: string | null;
    taskImplementationReportCount?: number;
    activeTaskHasImplementationReport?: boolean;
    activeTaskImplementationReportStale?: boolean;
    pendingMarkImplementationReturned?: boolean;
    taskReconciliationExists?: boolean;
    taskReconciliationStale?: boolean;
    taskReconciliationRecommendation?: string | null;
    taskReconciliationMissingProducers?: number;
    taskReconciliationStatusInconsistencyCount?: number;
    taskArtifactIndexExists?: boolean;
    taskArtifactIndexStale?: boolean;
    taskArtifactIndexRecommendation?: string | null;
    taskArtifactIndexUnlinkedCount?: number;
    taskArtifactIndexStaleCount?: number;
    changedFilesScanExists?: boolean;
    changedFilesTaskLinkExists?: boolean;
    changedFilesTaskLinkStale?: boolean;
    changedFilesTaskLinkTaskId?: string | null;
    changedFilesTaskLinkScopeWarningCount?: number;
    changedFilesUnlinked?: boolean;
  } | null;
  /** Stage 119: Safe Scaffold target-folder readiness (low priority). */
  safeScaffoldTargetSelected?: boolean;
  safeScaffoldTargetStale?: boolean;
  safeScaffoldTargetStatus?: "safe" | "caution" | "blocked" | null;
  /** Stage 121: Safe Scaffold file-tree preview (low priority). */
  safeScaffoldFileTreePreviewExists?: boolean;
  safeScaffoldFileTreePreviewStale?: boolean;
  /** Stage 123: Safe Scaffold file-content preview (low priority). */
  safeScaffoldFileContentPreviewExists?: boolean;
  safeScaffoldFileContentPreviewStale?: boolean;
  /** Stage 125: Safe Scaffold write-manifest preview (low priority). */
  safeScaffoldWriteManifestPreviewExists?: boolean;
  safeScaffoldWriteManifestPreviewStale?: boolean;
  /** Stage 127: Safe Scaffold final confirmation (low priority). */
  safeScaffoldFinalConfirmationExists?: boolean;
  safeScaffoldFinalConfirmationStale?: boolean;
  /** Stage 129: Safe Scaffold write result (low priority). */
  safeScaffoldWriteResultExists?: boolean;
  safeScaffoldWriteCanWrite?: boolean;
  safeScaffoldWriteBlocked?: boolean;
  /** Stage 131: Local Planner Build Brief (low priority). */
  localPlannerBuildBriefExists?: boolean;
  localPlannerBuildBriefStale?: boolean;
  /** Stage 133: Local Planner Response Import (low priority). */
  localPlannerResponseImportExists?: boolean;
  localPlannerResponseImportStale?: boolean;
  localPlannerResponseImportStatus?: "Good" | "Caution" | "Blocked" | null;
  localPlannerResponseImportAccepted?: boolean;
  /** Stage 135: Local Coder Task Prompt (low priority). */
  localCoderTaskPromptExists?: boolean;
  localCoderTaskPromptStale?: boolean;
  architectureHealthExists?: boolean;
  architectureHealthStale?: boolean;
  architectureHealthCriticalCount?: number;
  architectureHealthRecommendation?: string | null;
  architectureHealthMonolithInChangedFiles?: boolean;
  architectureRefactorTaskCardsExist?: boolean;
  architectureRefactorTaskCardsStale?: boolean;
  architectureRefactorActiveTaskId?: string | null;
  architectureRefactorDraftedTaskId?: string | null;
  architectureRefactorImplementationReturnedTaskId?: string | null;
  architectureRefactorTaskBuilderHandoffExists?: boolean;
  architectureRefactorTaskBuilderHandoffStale?: boolean;
  architectureRefactorTaskBuilderHandoffSelectedTaskId?: string | null;
  architectureRefactorSentToBuilderTaskId?: string | null;
  architectureRefactorImplementationReportCount?: number;
  architectureRefactorPendingMarkImplementationReturned?: boolean;
  architectureRefactorImplementationReportTaskId?: string | null;
  architectureRefactorReviewedTaskId?: string | null;
  architectureRefactorNextTaskId?: string | null;
}

function button(
  label: string,
  kind: DailyNextActionKind,
  mode: DailyNextActionMode,
): DailyNextActionButton {
  return { label, kind, mode };
}

const DAILY_NEXT_EXPECTED_RESULTS: Record<DailyNextActionKind, string> = {
  "select-project":
    "Opens the folder picker so NTTC can inspect a project safely.",
  summarize:
    "Creates a plain-English Project Summary from safe metadata only.",
  "verify-backup":
    "Confirms the existing Safety Backup is still restorable before risky work.",
  "create-backup":
    "Creates a labeled local Safety Backup you can restore later.",
  "go-safety-checks":
    "Opens allowlisted Build/Test Checks — nothing runs until you confirm.",
  "generate-patch-pack":
    "Builds a Patch Review Pack for changed files without editing source.",
  "generate-review-pack":
    "Creates a Copy-Paste Review Report for outside AI review.",
  "generate-decision":
    "Produces a Decision Report with a rule-based recommended next action.",
  "review-warnings":
    "Opens the relevant report section so you can resolve warnings first.",
  "generate-builder-prompt":
    "Creates a plan-only Builder Prompt for Cursor, Claude, or similar.",
  "paste-builder-result":
    "Opens Builder Result import so you can paste outside builder output.",
  "review-builder-result":
    "Opens saved Builder Result for human review — nothing executes.",
  "generate-implementation-review":
    "Creates an Implementation Review report from stored builder output.",
  "open-external-review":
    "Opens External Review to paste advice from outside AIs.",
  "export-project-memory":
    "Previews or saves `.nttc/` markdown handoff files only.",
  "ask-code-context-ai":
    "Sends the approved Code Context Pack to Local AI after confirmation.",
  "refresh-code-context":
    "Refreshes the selectable file list for the Code Context Pack builder.",
  "generate-patch-draft":
    "Creates an NTTC Patch Draft (text only — no apply, no file edits).",
  "generate-patch-draft-safety-review":
    "Runs a rule-based Patch Draft Safety Review on stored draft text.",
  "generate-external-patch-draft-comparison":
    "Compares NTTC and imported patch drafts using rule-based checks.",
  "generate-builder-handoff-export":
    "Creates a safe builder package for Cursor, Claude, or a human programmer.",
  "manual-patch-draft-import":
    "Opens Manual Patch Draft Import to paste an outside builder draft.",
  "open-blueprint":
    "Opens the Blueprint tab to plan a new app before code exists.",
  "import-blueprint":
    "Paste and save a planner blueprint, or save a Local Planner AI draft after review.",
  "check-blueprint-completeness":
    "Runs a rule-based check for missing blueprint sections.",
  "export-planning-documents":
    "Previews then saves `.nttc/planning/` markdown after confirmation.",
  "generate-phase1-handoff":
    "Creates a text-only Phase 1 builder handoff from the blueprint.",
  "generate-blueprint-phase-task-cards":
    "Breaks the saved blueprint into small builder-ready phase task cards.",
  "copy-blueprint-phase-task-card":
    "Copies one phase task card markdown for a builder or planner session.",
  "generate-task-card-builder-handoff":
    "Creates a focused Task Builder Handoff for the selected phase task card.",
  "copy-task-card-builder-handoff":
    "Copies the Task Builder Handoff markdown to send to your chosen builder.",
  "paste-task-implementation-report":
    "Opens Task Implementation Intake on the Blueprint tab to paste a builder report.",
  "mark-task-implementation-returned":
    "Marks the phase task Implementation Returned after reviewing the pasted report.",
  "generate-blueprint-task-reconciliation":
    "Creates a rule-based cross-card reconciliation report on the Blueprint tab.",
  "resolve-missing-task-producers":
    "Opens Task Reconciliation to resolve consumed items with no earlier producer.",
  "fix-task-status-inconsistency":
    "Opens Task Reconciliation to fix task status vs handoff/report mismatches.",
  "generate-task-artifact-index":
    "Creates a rule-based Task Artifact Index on the Blueprint tab.",
  "resolve-unlinked-task-artifacts":
    "Opens Task Artifact Index to resolve artifacts missing task join keys.",
  "resolve-stale-task-artifacts":
    "Opens Task Artifact Index to regenerate handoff/report for changed task cards.",
  "link-changed-files-to-task":
    "Opens Changed Files to link scan metadata to the active Blueprint task.",
  "review-changed-files-scope-warnings":
    "Opens Changed Files task link to review scope drift warnings.",
  "generate-architecture-health-report":
    "Builds a metadata-only Architecture Health / Monolith Risk Report.",
  "regenerate-architecture-health-report":
    "Regenerates the Architecture Health Report after scan or metadata changes.",
  "review-monolith-risk-changed-files":
    "Opens Architecture Health to review monolith risk before continuing.",
  "create-refactor-task-for-monolith":
    "Generate Architecture Refactor Task Cards for critical monolith files.",
  "generate-architecture-refactor-task-cards":
    "Builds planning-only refactor task cards from Architecture Health metadata.",
  "review-architecture-refactor-task-card":
    "Opens refactor task cards to copy a narrow planning card to an outside builder.",
  "regenerate-architecture-refactor-task-cards":
    "Regenerates refactor task cards after Architecture Health updates.",
  "generate-architecture-refactor-task-builder-handoff":
    "Creates a focused builder handoff prompt for one selected refactor task card.",
  "copy-architecture-refactor-task-builder-handoff":
    "Copies the refactor builder handoff markdown so you can send it to an outside builder.",
  "paste-architecture-refactor-implementation-report":
    "Opens Architecture Refactor Implementation Intake to paste the builder's returned refactor report.",
  "mark-architecture-refactor-implementation-returned":
    "Marks the refactor task Implementation Returned after reviewing the pasted report.",
  "wait-for-refactor-builder-report":
    "Waits for the outside builder to return an implementation report for review.",
  "open-build-mode":
    "Opens the Build tab Safety Charter (planning-only — no file writes).",
  "create-blueprint-before-scaffold":
    "Opens Blueprint so you can create or import a plan before any future Safe Scaffold work.",
  "build-mode-planning-only":
    "Opens Build Mode to review the planning-only charter.",
  "select-safe-scaffold-target-folder":
    "Opens Build Mode to select a Safe Scaffold target folder (safety check only).",
  "choose-empty-scaffold-target-folder":
    "Opens Build Mode so you can choose an empty folder outside the current project.",
  "safe-scaffold-target-ready":
    "Opens Build Mode to generate a Safe Scaffold File Tree Preview.",
  "generate-safe-scaffold-file-tree-preview":
    "Opens Build Mode to generate a Safe Scaffold File Tree Preview (paths only).",
  "review-safe-scaffold-file-tree-preview":
    "Opens Build Mode so you can review the file-tree preview before generating contents.",
  "regenerate-safe-scaffold-file-tree-preview":
    "Opens Build Mode to regenerate a stale Safe Scaffold File Tree Preview.",
  "generate-safe-scaffold-file-content-preview":
    "Opens Build Mode to generate Safe Scaffold File Content Preview (templates in memory only).",
  "review-safe-scaffold-file-content-preview":
    "Opens Build Mode so you can review Safe Scaffold file contents before the write-manifest preview.",
  "regenerate-safe-scaffold-file-content-preview":
    "Opens Build Mode to regenerate a stale Safe Scaffold File Content Preview.",
  "generate-safe-scaffold-write-manifest-preview":
    "Opens Build Mode to generate Safe Scaffold Write Manifest Preview (preview only).",
  "review-safe-scaffold-write-manifest-preview":
    "Opens Build Mode so you can review the write manifest, then record final confirmation.",
  "regenerate-safe-scaffold-write-manifest-preview":
    "Opens Build Mode to regenerate a stale Safe Scaffold Write Manifest Preview.",
  "record-safe-scaffold-final-confirmation":
    "Opens Build Mode to review and record Safe Scaffold final confirmation (readiness only).",
  "rerecord-safe-scaffold-final-confirmation":
    "Opens Build Mode to regenerate previews and record Safe Scaffold final confirmation again.",
  "safe-scaffold-final-confirmation-recorded":
    "Opens Build Mode so you can run the guarded Safe Scaffold write when the target is still Safe.",
  "run-safe-scaffold-write":
    "Opens Build Mode to run Write Safe Scaffold Files after an immediate safety re-check.",
  "resolve-safe-scaffold-write-blockers":
    "Opens Build Mode to resolve Safe Scaffold write blockers.",
  "review-written-safe-scaffold-files":
    "Opens Build Mode to review the written scaffold result. NTTC did not run commands or install packages.",
  "generate-local-planner-build-brief":
    "Opens Build Mode to generate a Local Planner Build Brief (copy/paste only — no AI call).",
  "regenerate-local-planner-build-brief":
    "Opens Build Mode to regenerate a stale Local Planner Build Brief.",
  "copy-local-planner-build-brief":
    "Opens Build Mode so you can copy the Local Planner Build Brief into a local model.",
  "paste-local-planner-response":
    "Opens Build Mode to paste a local planner response into NTTC for review.",
  "revise-local-planner-response":
    "Opens Build Mode to revise the local planner response before preparing a coder prompt.",
  "local-planner-response-accepted":
    "Planner response is accepted. Next stage can generate a local coder task prompt.",
  "generate-local-coder-task-prompt":
    "Opens Build Mode to generate a Local Coder Task Prompt (copy/paste only — no AI call).",
  "regenerate-local-coder-task-prompt":
    "Opens Build Mode to regenerate a stale Local Coder Task Prompt.",
  "copy-local-coder-task-prompt":
    "Opens Build Mode so you can copy the Local Coder Task Prompt into a local coder model.",
  "ready-continue":
    "Continue reviewing reports or export Project Memory when ready.",
};

export function expectedResultForDailyNext(kind: DailyNextActionKind): string {
  return (
    DAILY_NEXT_EXPECTED_RESULTS[kind] ??
    "Opens the related safe NTTC workflow step."
  );
}

function make(
  id: DailyNextActionKind,
  title: string,
  reason: string,
  primary: DailyNextActionButton,
  secondary: DailyNextActionButton | null,
  freshnessHints: string[],
): DailyNextAction {
  return {
    id,
    title,
    reason,
    expectedResult: expectedResultForDailyNext(id),
    primary,
    secondary,
    freshnessHints,
  };
}

function decisionBlocksProceed(report: DecisionReport | null): boolean {
  if (!report) return false;
  const id = report.recommendedNextAction.id;
  return (
    id.startsWith("do-not-proceed") ||
    id === "revert-or-restore-before-continuing" ||
    id === "ask-builder-to-revise"
  );
}

function latestExternalReviewAt(reviews: ExternalReviewRecord[]): string | null {
  if (!reviews.length) return null;
  return reviews
    .map((r) => r.savedAt)
    .sort((a, b) => String(b).localeCompare(String(a)))[0] ?? null;
}

function codeAiRecommendsMoreContext(response: CodeContextAiRecord | null): boolean {
  if (!response?.recommendedNextStep) return false;
  return /select more code context|more context|additional.*excerpt/i.test(
    response.recommendedNextStep,
  );
}

function codeAiRecommendsChecks(response: CodeContextAiRecord | null): boolean {
  if (!response?.recommendedNextStep) return false;
  return /run build\/test checks|build\/test checks/i.test(
    response.recommendedNextStep,
  );
}

function codeAiSaysDoNotProceed(response: CodeContextAiRecord | null): boolean {
  if (!response?.recommendedNextStep) return false;
  return /do not proceed/i.test(response.recommendedNextStep);
}

function patchDraftRecommendsMoreContext(response: PatchDraftRecord | null): boolean {
  if (!response?.recommendation) return false;
  return /select more code context/i.test(response.recommendation);
}

function patchDraftReadyForBuilder(response: PatchDraftRecord | null): boolean {
  if (!response?.recommendation) return false;
  return /ready for outside builder implementation/i.test(response.recommendation);
}

function patchDraftSaysDoNotProceed(response: PatchDraftRecord | null): boolean {
  if (!response?.recommendation) return false;
  return /do not proceed/i.test(response.recommendation);
}

function patchDraftRecommendsChecks(response: PatchDraftRecord | null): boolean {
  if (!response?.recommendation) return false;
  return /run build\/test checks/i.test(response.recommendation);
}

function builderPromptDailyReason(
  base: string,
  style: PlanningStyleId | undefined,
): string {
  if (isSmallModelFriendlyPlanning(style ?? "small-model-friendly")) {
    return `${base} Generate Builder Prompt with Small-model friendly architecture guidance.`;
  }
  return base;
}

function importedReviewCoversDraft(
  imported: ImportedPatchDraftRecord | null | undefined,
  review: PatchDraftSafetyReviewRecord | null | undefined,
): boolean {
  if (!imported || !review) return false;
  return (
    review.reviewTargetKind === "imported-patch-draft" &&
    review.sourcePatchDraftId === imported.id
  );
}

function pdsrSaysDoNotProceed(
  review: PatchDraftSafetyReviewRecord | null,
): boolean {
  return review?.recommendation === "Do not proceed yet";
}

function pdsrRecommendsMoreContext(
  review: PatchDraftSafetyReviewRecord | null,
): boolean {
  return review?.recommendation === "Select more code context first";
}

function pdsrRecommendsBackup(
  review: PatchDraftSafetyReviewRecord | null,
): boolean {
  return review?.recommendation === "Create/verify Safety Backup first";
}

function pdsrRecommendsChecks(
  review: PatchDraftSafetyReviewRecord | null,
): boolean {
  return review?.recommendation === "Run Build/Test Checks first";
}

function pdsrSafeForOutsideBuilder(
  review: PatchDraftSafetyReviewRecord | null,
): boolean {
  return review?.recommendation === "Safe to send to outside builder for review";
}

function userRequestImpliesPatchWork(request: string | undefined): boolean {
  if (!request?.trim()) return false;
  return /\b(fix|build|patch|implement|change|add|update|refactor|repair|correct|modify|create|remove|delete)\b/i.test(
    request,
  );
}

/**
 * Conservative daily-use recommendation for the Dashboard.
 * Rule-based only — not AI.
 */
export function calculateDailyNextAction(
  input: DailyNextActionInput,
): DailyNextAction {
  const freshness: string[] = [];
  if (input.summary) {
    freshness.push(
      input.summaryIsFromHistory
        ? "Project Summary: restored from history (not scanned this session)."
        : "Project Summary: generated this session.",
    );
  }
  if (input.reviewPack) {
    freshness.push(
      `Copy-Paste Review Report: last generated ${input.reviewPack.generatedAt}.`,
    );
  }
  if (input.decisionReport) {
    const latestReviewAt = latestExternalReviewAt(input.externalReviews);
    if (latestReviewAt) {
      const afterReviews =
        String(input.decisionReport.generatedAt) >= String(latestReviewAt);
      freshness.push(
        afterReviews
          ? "Decision Report: generated after latest external review."
          : "Decision Report: may be older than latest external review.",
      );
    } else {
      freshness.push(
        `Decision Report: last generated ${input.decisionReport.generatedAt}.`,
      );
    }
  }
  if (input.builderResult && input.decisionReport) {
    const afterBuilder =
      String(input.decisionReport.generatedAt) >=
      String(input.builderResult.savedAt);
    freshness.push(
      afterBuilder
        ? "Decision Report: generated after latest Builder Result."
        : "Decision Report: may be older than latest Builder Result.",
    );
  }
  if (input.checkpointAvailability.status !== "none") {
    freshness.push(
      input.checkpointAvailability.restorable
        ? "Safety Backup: verified and restorable."
        : input.checkpointAvailability.hasPreviousRecord
          ? "Safety Backup: previous record only — not verified for restore."
          : `Safety Backup: ${input.checkpointAvailability.label}`,
    );
  }
  if (input.safeChecks.lastResult) {
    freshness.push(
      `Build/Test Check: last run ${input.safeChecks.lastResult.scriptName} (${input.safeChecks.lastResult.status}).`,
    );
  }
  if (input.projectMemoryLastSaved) {
    freshness.push(
      `Project Memory: last saved ${input.projectMemoryLastSaved.savedAt}.`,
    );
  } else {
    freshness.push("Project Memory: not saved to `.nttc/` yet.");
  }
  if (input.codeContextPreview) {
    freshness.push(
      `Code Context Pack: generated ${input.codeContextPreview.generatedAt}.`,
    );
  }
  if (input.codeContextAiResponse) {
    freshness.push(
      `Code AI response: ${input.codeContextAiResponse.generatedAt} (${input.codeContextAiResponse.modelName}).`,
    );
  }
  if (input.patchDraftResponse) {
    freshness.push(
      `Patch Draft: ${input.patchDraftResponse.generatedAt} (${input.patchDraftResponse.modelName}).`,
    );
  }
  if (input.patchDraftSafetyReview) {
    freshness.push(
      `Patch Draft Safety Review: ${input.patchDraftSafetyReview.generatedAt} → ${input.patchDraftSafetyReview.recommendation}.`,
    );
  }
  if (input.importedPatchDraft) {
    freshness.push(
      `Imported Patch Draft: ${input.importedPatchDraft.importedAt} (${input.importedPatchDraft.source} · ${input.importedPatchDraft.draftType}).`,
    );
  }
  if (input.externalPatchDraftComparison) {
    freshness.push(
      `External Patch Draft Comparison: ${input.externalPatchDraftComparison.generatedAt} → ${input.externalPatchDraftComparison.riskLevel} / ${input.externalPatchDraftComparison.recommendation}.`,
    );
  }
  if (input.builderHandoffExport) {
    freshness.push(
      `Builder Handoff Pack: ${input.builderHandoffExport.generatedAt} → ${input.builderHandoffExport.recommendation} (${input.builderHandoffExport.target}).`,
    );
  }

  if (!input.project) {
    return make(
      "select-project",
      "Select a project folder",
      "A project must be selected before NTTC can inspect anything.",
      button("Select Project Folder", "select-project", "run"),
      button("Open Blueprint Tab", "open-blueprint", "navigate"),
      freshness,
    );
  }

  const bp = input.blueprintStatus;
  const blueprintPathActive =
    Boolean(bp?.ideaExists) &&
    !input.codeContextPreview &&
    !input.patchDraftResponse &&
    !input.importedPatchDraft;

  if (blueprintPathActive && bp) {
    if (!bp.blueprintImported) {
      return make(
        "import-blueprint",
        "Import Project Blueprint",
        "You captured a build-from-idea plan. Ask Local Planner AI (optional) or import/save a planner blueprint when ready.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        button("Summarize Project", "summarize", "run"),
        freshness,
      );
    }
    if (!bp.completenessCheckExists) {
      return make(
        "check-blueprint-completeness",
        "Check Blueprint Completeness",
        "Verify required sections before Phase 1 handoff or planning doc export.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (
      !bp.planningDocsExported &&
      (bp.readinessStatus === "ready-for-phase-1" ||
        bp.readinessStatus === "ready-for-builder-planning-only")
    ) {
      return make(
        "export-planning-documents",
        "Save Planning Documents",
        "Preview then explicitly save `.nttc/planning/` markdown files.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (!bp.phase1HandoffExists) {
      return make(
        "generate-phase1-handoff",
        "Generate Phase 1 Builder Handoff",
        "Create a text-only handoff for the first build phase.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (!bp.taskCardsExist) {
      return make(
        "generate-blueprint-phase-task-cards",
        "Generate Phase Task Cards",
        "Break the saved blueprint into small focused builder-ready work packets.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if ((bp.blockedTaskCount ?? 0) > 0) {
      return make(
        "copy-blueprint-phase-task-card",
        "Resolve Blocked Task",
        "A phase task card is blocked — resolve it before continuing.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (!bp.taskReconciliationExists) {
      return make(
        "generate-blueprint-task-reconciliation",
        "Generate Task Reconciliation Report",
        "Task cards exist — generate a rule-based reconciliation report to verify the deck fits together.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (bp.taskReconciliationStale) {
      return make(
        "generate-blueprint-task-reconciliation",
        "Regenerate Task Reconciliation Report",
        "Task cards changed after the last reconciliation report — regenerate the report.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if ((bp.taskReconciliationMissingProducers ?? 0) > 0) {
      return make(
        "resolve-missing-task-producers",
        "Resolve Missing Producers",
        "Resolve missing producers before sending more task handoffs.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if ((bp.taskReconciliationStatusInconsistencyCount ?? 0) > 0) {
      return make(
        "fix-task-status-inconsistency",
        "Fix Task Status Inconsistency",
        "Fix task status inconsistency before continuing.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (bp.changedFilesUnlinked && bp.taskCardsExist) {
      return make(
        "link-changed-files-to-task",
        "Link Changed Files to Task",
        "Link Changed Files metadata to the active Blueprint task.",
        button("Open Changed Files", "link-changed-files-to-task", "navigate"),
        null,
        freshness,
      );
    }
    if ((bp.changedFilesTaskLinkScopeWarningCount ?? 0) > 0) {
      return make(
        "review-changed-files-scope-warnings",
        "Review Changed-File Scope Warnings",
        "Review changed-file scope warnings before marking task Reviewed.",
        button("Open Changed Files", "review-changed-files-scope-warnings", "navigate"),
        null,
        freshness,
      );
    }
    if (bp.changedFilesTaskLinkExists && bp.taskReconciliationStale) {
      return make(
        "generate-blueprint-task-reconciliation",
        "Regenerate Task Reconciliation Report",
        "Changed-files task link updated — regenerate Task Reconciliation Report.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (bp.changedFilesTaskLinkExists && !bp.taskArtifactIndexExists) {
      return make(
        "generate-task-artifact-index",
        "Generate Task Artifact Index",
        "Changed-files linked — regenerate Task Artifact Index for full trace.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (!bp.taskArtifactIndexExists) {
      return make(
        "generate-task-artifact-index",
        "Generate Task Artifact Index",
        "Task cards exist — generate a rule-based artifact index to trace task-linked metadata.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (bp.taskArtifactIndexStale) {
      return make(
        "generate-task-artifact-index",
        "Regenerate Task Artifact Index",
        "Task artifacts changed after the last index — regenerate the Task Artifact Index.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if ((bp.taskArtifactIndexUnlinkedCount ?? 0) > 0) {
      return make(
        "resolve-unlinked-task-artifacts",
        "Resolve Unlinked Task Artifacts",
        "Link or regenerate task artifacts before continuing.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if ((bp.taskArtifactIndexStaleCount ?? 0) > 0) {
      return make(
        "resolve-stale-task-artifacts",
        "Resolve Stale Task Artifacts",
        "Regenerate handoff/report for changed task card content.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    const activeId = bp.activeTaskId;
    if (
      activeId &&
      bp.activeTaskStatus === "sent-to-builder" &&
      !bp.activeTaskHasImplementationReport
    ) {
      return make(
        "paste-task-implementation-report",
        `Paste Builder Report for ${activeId}`,
        `Paste the builder's implementation report for ${activeId}.`,
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (activeId && bp.pendingMarkImplementationReturned) {
      return make(
        "mark-task-implementation-returned",
        `Mark ${activeId} Implementation Returned`,
        `An implementation report exists for ${activeId} — mark Implementation Returned when ready.`,
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (
      (bp.implementationReturnedTaskCount ?? 0) > 0 ||
      bp.activeTaskStatus === "implementation-returned"
    ) {
      const label = activeId ?? "task";
      return make(
        "generate-implementation-review",
        `Run Implementation Review for ${label}`,
        "Run Implementation Review against the saved task implementation report.",
        button("Open Reports", "generate-implementation-review", "navigate"),
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        freshness,
      );
    }
    if (bp.activeTaskStatus === "reviewed" && bp.nextTaskId) {
      return make(
        "generate-task-card-builder-handoff",
        `Move to Next Task ${bp.nextTaskId}`,
        `Copy or generate a Task Builder Handoff for the next task ${bp.nextTaskId}.`,
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (bp.activeTaskStatus === "sent-to-builder") {
      return make(
        "paste-task-implementation-report",
        "Paste Builder Implementation Report",
        "Task was sent to builder — paste the returned implementation report on the Blueprint tab.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    const handoffReady =
      bp.taskBuilderHandoffExists && !bp.taskBuilderHandoffStale;
    if (
      !handoffReady &&
      bp.taskReconciliationRecommendation === "Deck ready" &&
      (bp.readyToSendTaskCount ?? 0) > 0
    ) {
      const firstId = bp.activeTaskId ?? bp.nextTaskId ?? "first task";
      return make(
        "generate-task-card-builder-handoff",
        `Generate Task Builder Handoff for ${firstId}`,
        `Deck is ready — generate or copy a Task Builder Handoff for ${firstId}.`,
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (!handoffReady) {
      return make(
        "generate-task-card-builder-handoff",
        "Generate Task Builder Handoff",
        "Create a focused builder handoff for the active phase task card.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    if (handoffReady && (bp.readyToSendTaskCount ?? 0) > 0) {
      return make(
        "copy-task-card-builder-handoff",
        "Copy Task Builder Handoff",
        "Copy the Task Builder Handoff and send it to your chosen builder.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
    const nextActiveId = bp.activeTaskId ?? bp.nextTaskId;
    const activeCard = nextActiveId;
    if (activeCard && (bp.readyToSendTaskCount ?? 0) > 0) {
      return make(
        "copy-blueprint-phase-task-card",
        `Copy ${activeCard} Task Card`,
        "Copy the active phase task card and send it to a builder for planning.",
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        null,
        freshness,
      );
    }
  }

  if (!input.summary) {
    return make(
      "summarize",
      "Generate Project Summary",
      "The summary is the safe project context used by reports and AI reviewers.",
      button("Summarize Project", "summarize", "run"),
      button("Open Project Setup", "select-project", "navigate"),
      freshness,
    );
  }

  if (input.summaryIsFromHistory) {
    return make(
      "summarize",
      "Re-scan / Summarize Project",
      "A previous saved summary is showing. Re-summarize this session so reports use fresh local metadata.",
      button("Summarize Project", "summarize", "run"),
      button("Open Reports", "generate-review-pack", "navigate"),
      freshness,
    );
  }

  if (!input.checkpointAvailability.restorable) {
    if (input.checkpointAvailability.hasPreviousRecord) {
      return make(
        "verify-backup",
        "Verify Safety Backup",
        "A verified Safety Backup protects you before reviewing or testing changes. A history record alone is not enough to restore.",
        button("Verify Safety Backup", "verify-backup", "navigate"),
        button("Create New Safety Backup", "create-backup", "navigate"),
        freshness,
      );
    }
    return make(
      "create-backup",
      "Create Safety Backup",
      "A verified Safety Backup protects you before reviewing or testing changes.",
      button("Create Safety Backup", "create-backup", "navigate"),
      button("Open Safety", "go-safety-checks", "navigate"),
      freshness,
    );
  }

  const hasRunnableChecks =
    input.safeChecks.packageJsonFound &&
    input.safeChecks.available.some((item) => item.available && !item.blocked);
  if (hasRunnableChecks && !input.safeChecks.lastResult) {
    return make(
      "go-safety-checks",
      "Run Build/Test Checks",
      "Allowlisted Build/Test Checks appear available, but none have been run this session.",
      button("Run Build/Test Checks", "go-safety-checks", "navigate"),
      button("Open Safety", "create-backup", "navigate"),
      freshness,
    );
  }

  if (input.architectureHealthMonolithInChangedFiles) {
    return make(
      "review-monolith-risk-changed-files",
      "Review Monolith Risk Before Continuing",
      "Changed files include App.tsx or main/index.ts while monolith risk is present.",
      button("Open Architecture Health", "review-monolith-risk-changed-files", "navigate"),
      null,
      freshness,
    );
  }

  if (input.architectureRefactorImplementationReturnedTaskId) {
    return make(
      "generate-implementation-review",
      `Run Implementation Review for ${input.architectureRefactorImplementationReturnedTaskId} Refactor`,
      `Run Implementation Review for ${input.architectureRefactorImplementationReturnedTaskId} refactor before marking reviewed.`,
      button("Open Refactor Implementation Intake", "paste-architecture-refactor-implementation-report", "navigate"),
      button("Open Implementation Review", "generate-implementation-review", "navigate"),
      freshness,
    );
  }

  if (
    input.architectureRefactorPendingMarkImplementationReturned &&
    input.architectureRefactorImplementationReportTaskId
  ) {
    return make(
      "mark-architecture-refactor-implementation-returned",
      `Mark ${input.architectureRefactorImplementationReportTaskId} Refactor Implementation Returned`,
      `An implementation report exists for ${input.architectureRefactorImplementationReportTaskId} — mark Implementation Returned when ready.`,
      button("Open Refactor Implementation Intake", "mark-architecture-refactor-implementation-returned", "navigate"),
      null,
      freshness,
    );
  }

  if (
    input.architectureRefactorSentToBuilderTaskId &&
    input.architectureRefactorTaskCardsExist &&
    !input.architectureRefactorTaskCardsStale &&
    (input.architectureRefactorImplementationReportCount ?? 0) === 0
  ) {
    return make(
      "paste-architecture-refactor-implementation-report",
      `Paste Builder Refactor Report for ${input.architectureRefactorSentToBuilderTaskId}`,
      `Paste the builder's refactor implementation report for ${input.architectureRefactorSentToBuilderTaskId}.`,
      button("Open Refactor Implementation Intake", "paste-architecture-refactor-implementation-report", "navigate"),
      null,
      freshness,
    );
  }

  if (
    input.architectureRefactorReviewedTaskId &&
    input.architectureRefactorNextTaskId
  ) {
    return make(
      "generate-architecture-refactor-task-builder-handoff",
      `Move to Next Architecture Refactor Task ${input.architectureRefactorNextTaskId}`,
      `Generate or copy handoff for the next refactor task ${input.architectureRefactorNextTaskId}.`,
      button("Open Refactor Builder Handoff", "generate-architecture-refactor-task-builder-handoff", "navigate"),
      null,
      freshness,
    );
  }

  if (input.architectureRefactorTaskCardsStale && input.architectureHealthExists) {
    return make(
      "regenerate-architecture-refactor-task-cards",
      "Regenerate Architecture Refactor Task Cards",
      "Architecture Health changed — regenerate refactor planning cards.",
      button("Generate Refactor Task Cards", "regenerate-architecture-refactor-task-cards", "run"),
      button("Open Refactor Task Cards", "regenerate-architecture-refactor-task-cards", "navigate"),
      freshness,
    );
  }

  if (
    input.architectureRefactorSentToBuilderTaskId &&
    input.architectureRefactorTaskCardsExist &&
    !input.architectureRefactorTaskCardsStale
  ) {
    return make(
      "wait-for-refactor-builder-report",
      "Wait for Refactor Builder Report",
      `Wait for builder report for ${input.architectureRefactorSentToBuilderTaskId}, then import it for review.`,
      button("Open Refactor Task Cards", "wait-for-refactor-builder-report", "navigate"),
      button("Open Implementation Review", "generate-implementation-review", "navigate"),
      freshness,
    );
  }

  const refactorHandoffReady =
    input.architectureRefactorTaskBuilderHandoffExists &&
    !input.architectureRefactorTaskBuilderHandoffStale;
  const firstRefactorId =
    input.architectureRefactorTaskBuilderHandoffSelectedTaskId ??
    input.architectureRefactorDraftedTaskId ??
    input.architectureRefactorActiveTaskId ??
    "ARCH-1";

  if (
    refactorHandoffReady &&
    input.architectureRefactorTaskCardsExist &&
    !input.architectureRefactorTaskCardsStale
  ) {
    return make(
      "copy-architecture-refactor-task-builder-handoff",
      "Copy Architecture Refactor Handoff",
      "Copy the Architecture Refactor Builder Handoff and send it to your chosen builder.",
      button("Open Refactor Builder Handoff", "copy-architecture-refactor-task-builder-handoff", "navigate"),
      null,
      freshness,
    );
  }

  if (
    input.architectureRefactorTaskCardsExist &&
    !input.architectureRefactorTaskCardsStale &&
    !refactorHandoffReady
  ) {
    return make(
      "generate-architecture-refactor-task-builder-handoff",
      `Generate Architecture Refactor Builder Handoff for ${firstRefactorId}`,
      "Create a focused builder handoff from the selected refactor task card.",
      button("Generate Refactor Builder Handoff", "generate-architecture-refactor-task-builder-handoff", "run"),
      button("Open Refactor Builder Handoff", "generate-architecture-refactor-task-builder-handoff", "navigate"),
      freshness,
    );
  }

  if (
    input.architectureRefactorDraftedTaskId &&
    input.architectureRefactorTaskCardsExist &&
    !input.architectureRefactorTaskCardsStale
  ) {
    return make(
      "review-architecture-refactor-task-card",
      `Copy ${input.architectureRefactorDraftedTaskId} for a Narrow Refactor Plan`,
      "Copy the first drafted refactor task card and send it to a builder for a narrow refactor plan.",
      button("Open Refactor Task Cards", "review-architecture-refactor-task-card", "navigate"),
      null,
      freshness,
    );
  }

  if ((input.architectureHealthCriticalCount ?? 0) > 0) {
    if (!input.architectureRefactorTaskCardsExist) {
      return make(
        "generate-architecture-refactor-task-cards",
        "Generate Architecture Refactor Task Cards",
        "Create planning-only refactor cards for App.tsx/main/index.ts before adding more features.",
        button("Generate Refactor Task Cards", "generate-architecture-refactor-task-cards", "run"),
        button("Open Architecture Health", "create-refactor-task-for-monolith", "navigate"),
        freshness,
      );
    }
    return make(
      "create-refactor-task-for-monolith",
      "Plan Refactors for Critical Monolith Files",
      "Review Architecture Refactor Task Cards before adding more features.",
      button("Open Refactor Task Cards", "create-refactor-task-for-monolith", "navigate"),
      button("Open Blueprint Tab", "open-blueprint", "navigate"),
      freshness,
    );
  }

  if (input.architectureHealthStale) {
    return make(
      "regenerate-architecture-health-report",
      "Regenerate Architecture Health Report",
      "Project scan or changed-files metadata changed — regenerate the architecture report.",
      button("Generate Architecture Health Report", "regenerate-architecture-health-report", "run"),
      button("Open Architecture Health", "regenerate-architecture-health-report", "navigate"),
      freshness,
    );
  }

  if (!input.architectureHealthExists && input.summary) {
    return make(
      "generate-architecture-health-report",
      "Generate Architecture Health Report",
      "Scan safe file metadata to flag oversized files and monolith risk.",
      button("Generate Architecture Health Report", "generate-architecture-health-report", "run"),
      button("Open Architecture Health", "generate-architecture-health-report", "navigate"),
      freshness,
    );
  }

  const changed = input.changedFilesScan;
  const hasChangedFiles = Boolean(
    changed &&
      changed.isGitRepo &&
      !changed.errorMessage &&
      (changed.totalCount ?? 0) > 0,
  );
  if (hasChangedFiles && !input.patchReviewPack) {
    return make(
      "generate-patch-pack",
      "Generate Patch Review Pack",
      "Changed files were detected, so a Patch Review Pack is the safest next report.",
      button("Generate Patch Review Pack", "generate-patch-pack", "run"),
      button("Open Changed Files", "generate-patch-pack", "navigate"),
      freshness,
    );
  }

  if (!input.reviewPack) {
    return make(
      "generate-review-pack",
      "Generate Copy-Paste Review Report",
      "A Copy-Paste Review Report is the main document to paste into outside AIs.",
      button("Generate Review Report", "generate-review-pack", "run"),
      button("Open Reports", "generate-review-pack", "navigate"),
      freshness,
    );
  }

  const latestReviewAt = latestExternalReviewAt(input.externalReviews);
  const decisionAfterReviews =
    input.decisionReport &&
    latestReviewAt &&
    String(input.decisionReport.generatedAt) >= String(latestReviewAt);
  if (
    input.externalReviews.length > 0 &&
    (!input.decisionReport || !decisionAfterReviews)
  ) {
    return make(
      "generate-decision",
      "Generate Decision Report",
      "External reviews were saved. A Decision Report helps decide the safest next step from that evidence.",
      button("Generate Decision Report", "generate-decision", "run"),
      button("Open External Reviews", "open-external-review", "navigate"),
      freshness,
    );
  }

  if (
    decisionBlocksProceed(input.decisionReport) ||
    input.backlogCriticalSafetyOpen > 0
  ) {
    const why =
      input.backlogCriticalSafetyOpen > 0
        ? "Open Critical Safety backlog item(s) should be reviewed before continuing."
        : `Decision Report recommends caution: ${input.decisionReport?.recommendedNextAction.label ?? "review warnings"}.`;
    return make(
      "review-warnings",
      "Review warnings / backlog / risky reviews",
      why,
      button("Review Backlog", "review-warnings", "navigate"),
      button("Open Decision Report", "generate-decision", "navigate"),
      freshness,
    );
  }

  if (input.decisionReport && !input.builderPromptGeneratedAt) {
    return make(
      "generate-builder-prompt",
      "Generate Builder Prompt",
      builderPromptDailyReason(
        "The Decision Report looks clear enough to copy a plan-only Builder Prompt for an outside builder.",
        input.planningStyle,
      ),
      button("Generate Builder Prompt", "generate-builder-prompt", "run"),
      button("Open Decision Report", "generate-decision", "navigate"),
      freshness,
    );
  }

  if (input.builderPromptGeneratedAt && !input.builderResult) {
    return make(
      "paste-builder-result",
      "Paste Builder Result",
      "A Builder Prompt exists. After using an outside builder, paste the result back as text only.",
      button("Open Builder Result", "paste-builder-result", "navigate"),
      button("Open Builder Prompt", "generate-builder-prompt", "navigate"),
      freshness,
    );
  }

  if (
    input.builderResult &&
    (input.builderResult.hasRiskySuggestions ||
      input.builderResult.hasMismatchWarnings)
  ) {
    return make(
      "review-builder-result",
      "Review Builder Result warnings",
      "The pasted Builder Result has warnings. Review them carefully — NTTC did not execute anything.",
      button("Open Builder Result", "review-builder-result", "navigate"),
      button("Open Decision Report", "generate-decision", "navigate"),
      freshness,
    );
  }

  const implReport =
    input.builderResult?.responseType === "Implementation report";
  if (implReport && !input.implementationReview) {
    return make(
      "generate-implementation-review",
      "Generate Implementation Review",
      "An Implementation report was imported. Generate a rule-based Implementation Review before trusting claimed changes.",
      button("Generate Implementation Review", "generate-implementation-review", "run"),
      button("Open Builder Result", "paste-builder-result", "navigate"),
      freshness,
    );
  }

  if (input.implementationReview) {
    const rec = input.implementationReview.recommendation;
    if (rec === "Restore from Safety Backup" || rec === "Do not proceed yet") {
      return make(
        "review-warnings",
        "Implementation Review warns — do not proceed",
        `Implementation Review recommends: ${rec}. Review warnings before continuing.`,
        button("Open Builder Result", "review-builder-result", "navigate"),
        button("Open Safety", "go-safety-checks", "navigate"),
        freshness,
      );
    }
    if (rec === "Run Build/Test Checks") {
      return make(
        "go-safety-checks",
        "Run Build/Test Checks",
        "Implementation Review recommends running allowlisted Build/Test Checks before trusting implementation claims.",
        button("Run Build/Test Checks", "go-safety-checks", "navigate"),
        button("Open Builder Result", "paste-builder-result", "navigate"),
        freshness,
      );
    }
    if (rec === "Generate Patch Review Pack") {
      return make(
        "generate-patch-pack",
        "Generate Patch Review Pack",
        "Implementation Review recommends a Patch Review Pack to review changed-file metadata.",
        button("Generate Patch Review Pack", "generate-patch-pack", "run"),
        button("Open Changed Files", "generate-patch-pack", "navigate"),
        freshness,
      );
    }
  }

  if (
    input.patchDraftResponse &&
    input.importedPatchDraft &&
    !input.externalPatchDraftComparison
  ) {
    return make(
      "generate-external-patch-draft-comparison",
      "Compare NTTC vs imported patch drafts",
      "Both patch drafts exist. Run External Patch Draft Comparison before builder work.",
      button(
        "Generate External Patch Draft Comparison",
        "generate-external-patch-draft-comparison",
        "run",
      ),
      button("Open Manual Patch Draft Import", "manual-patch-draft-import", "navigate"),
      freshness,
    );
  }

  if (input.externalPatchDraftComparison) {
    const risk = input.externalPatchDraftComparison.riskLevel;
    if (
      risk === "Blocked / Do not proceed" ||
      risk === "High"
    ) {
      const narrowReason =
        risk === "Blocked / Do not proceed"
          ? `Comparison risk is ${risk}. Narrow the plan before builder work.`
          : `Comparison risk is High (${input.externalPatchDraftComparison.biggestConflict.slice(0, 120)}). Narrow the plan before builder work.`;
      return make(
        "generate-patch-draft",
        "Narrow plan before builder work",
        isSmallModelFriendlyPlanning(input.planningStyle ?? "small-model-friendly")
          ? `${narrowReason} Use Small-model friendly architecture guidance.`
          : narrowReason,
        button("Open Patch Draft", "generate-patch-draft", "navigate"),
        button(
          "Open External Patch Draft Comparison",
          "generate-external-patch-draft-comparison",
          "navigate",
        ),
        freshness,
      );
    }
    if (
      input.externalPatchDraftComparison.recommendation ===
        "Safe to send to outside builder for review only" ||
      input.externalPatchDraftComparison.recommendation ===
        "Generate Builder Prompt with constraints"
    ) {
      return make(
        "generate-builder-prompt",
        "Generate Builder Prompt",
        builderPromptDailyReason(
          `External Patch Draft Comparison recommends: ${input.externalPatchDraftComparison.recommendation}.`,
          input.planningStyle,
        ),
        button("Generate Builder Prompt", "generate-builder-prompt", "run"),
        button(
          "Open External Patch Draft Comparison",
          "generate-external-patch-draft-comparison",
          "navigate",
        ),
        freshness,
      );
    }

    if (
      input.patchDraftSafetyReview &&
      !input.builderHandoffExport
    ) {
      return make(
        "generate-builder-handoff-export",
        "Generate Builder Handoff Pack",
        "Safety review and comparison are ready. Create a text-only handoff before outside builder work.",
        button(
          "Generate Builder Handoff Pack",
          "generate-builder-handoff-export",
          "run",
        ),
        button(
          "Open External Patch Draft Comparison",
          "generate-external-patch-draft-comparison",
          "navigate",
        ),
        freshness,
      );
    }
  }

  if (input.builderHandoffExport?.recommendation === "Do not send yet") {
    return make(
      "review-warnings",
      "Resolve handoff safeguards first",
      "Builder Handoff Pack recommends: Do not send yet. Resolve missing safeguards before outside builder work.",
      button("Open Builder Handoff Export", "generate-builder-handoff-export", "navigate"),
      button("Open Safety", "go-safety-checks", "navigate"),
      freshness,
    );
  }

  if (
    input.builderHandoffExport?.recommendation ===
    "Send to builder for narrow implementation"
  ) {
    return make(
      "generate-builder-handoff-export",
      "Copy Builder Handoff Pack",
      "Handoff is ready for narrow implementation. Copy and send it to your outside builder manually.",
      button("Open Builder Handoff Export", "generate-builder-handoff-export", "navigate"),
      button("Open Reports", "generate-review-pack", "navigate"),
      freshness,
    );
  }

  if (
    draftImpliesBroadFileChanges(
      input.patchDraftResponse?.draftText,
      input.importedPatchDraft?.draftText,
    )
  ) {
    return make(
      "generate-builder-prompt",
      "Split broad draft into focused files",
      "Use Small-model friendly planning: split the change into focused files before sending to a builder.",
      button("Generate Builder Prompt", "generate-builder-prompt", "run"),
      button("Open Patch Draft", "generate-patch-draft", "navigate"),
      freshness,
    );
  }

  if (
    input.importedPatchDraft &&
    !importedReviewCoversDraft(input.importedPatchDraft, input.patchDraftSafetyReview)
  ) {
    const highRisk = input.importedPatchDraft.riskPhraseCount >= 2;
    return make(
      "generate-patch-draft-safety-review",
      highRisk
        ? "Review imported patch draft — risk phrases detected"
        : "Generate Patch Draft Safety Review for imported draft",
      highRisk
        ? `Imported draft from ${input.importedPatchDraft.source} has ${input.importedPatchDraft.riskPhraseCount} risk phrase(s). Run a rule-based safety review before any builder work.`
        : `An imported outside patch draft exists (${input.importedPatchDraft.source}). Run safety review before trusting it.`,
      button("Generate Patch Draft Safety Review", "generate-patch-draft-safety-review", "run"),
      button("Open Manual Patch Draft Import", "manual-patch-draft-import", "navigate"),
      freshness,
    );
  }

  if (input.patchDraftResponse && !input.patchDraftSafetyReview) {
    return make(
      "generate-patch-draft-safety-review",
      "Generate Patch Draft Safety Review",
      "A Patch Draft exists. Run a rule-based safety review before sending it to an outside builder.",
      button("Generate Patch Draft Safety Review", "generate-patch-draft-safety-review", "run"),
      button("Open Patch Draft", "generate-patch-draft", "navigate"),
      freshness,
    );
  }

  if (input.patchDraftSafetyReview && pdsrSaysDoNotProceed(input.patchDraftSafetyReview)) {
    return make(
      "review-warnings",
      "Patch Draft Safety Review warns — do not proceed yet",
      `Safety review recommends: ${input.patchDraftSafetyReview.recommendation}.`,
      button("Open Patch Draft Safety Review", "generate-patch-draft-safety-review", "navigate"),
      button("Review Backlog", "review-warnings", "navigate"),
      freshness,
    );
  }

  if (input.patchDraftSafetyReview && pdsrRecommendsMoreContext(input.patchDraftSafetyReview)) {
    return make(
      "refresh-code-context",
      "Select more code context",
      "Patch Draft Safety Review suggests additional specific files/excerpts would help.",
      button("Refresh Code Context", "refresh-code-context", "navigate"),
      button("Open Patch Draft Safety Review", "generate-patch-draft-safety-review", "navigate"),
      freshness,
    );
  }

  if (input.patchDraftSafetyReview && pdsrRecommendsBackup(input.patchDraftSafetyReview)) {
    return make(
      "verify-backup",
      "Create/verify Safety Backup",
      "Patch Draft Safety Review recommends a verified Safety Backup before proceeding.",
      button("Verify Safety Backup", "verify-backup", "navigate"),
      button("Open Patch Draft Safety Review", "generate-patch-draft-safety-review", "navigate"),
      freshness,
    );
  }

  if (input.patchDraftSafetyReview && pdsrRecommendsChecks(input.patchDraftSafetyReview)) {
    return make(
      "go-safety-checks",
      "Run Build/Test Checks",
      "Patch Draft Safety Review recommends running allowlisted Build/Test Checks first.",
      button("Run Build/Test Checks", "go-safety-checks", "navigate"),
      button("Open Patch Draft Safety Review", "generate-patch-draft-safety-review", "navigate"),
      freshness,
    );
  }

  if (input.patchDraftSafetyReview && pdsrSafeForOutsideBuilder(input.patchDraftSafetyReview)) {
    return make(
      "generate-builder-prompt",
      "Ready for outside builder review",
      builderPromptDailyReason(
        "Patch Draft Safety Review indicates the draft may be ready to send to an outside builder for plan review.",
        input.planningStyle,
      ),
      button("Generate Builder Prompt", "generate-builder-prompt", "run"),
      button("Open Patch Draft Safety Review", "generate-patch-draft-safety-review", "navigate"),
      freshness,
    );
  }

  if (input.patchDraftResponse && patchDraftSaysDoNotProceed(input.patchDraftResponse)) {
    return make(
      "review-warnings",
      "Patch Draft warns — do not proceed yet",
      `Patch Draft recommends: ${input.patchDraftResponse.recommendation}. Review before continuing.`,
      button("Open Patch Draft", "generate-patch-draft", "navigate"),
      button("Review Backlog", "review-warnings", "navigate"),
      freshness,
    );
  }

  if (
    input.patchDraftResponse &&
    patchDraftRecommendsMoreContext(input.patchDraftResponse)
  ) {
    return make(
      "refresh-code-context",
      "Select more code context",
      "Patch Draft suggests additional specific files/excerpts would help.",
      button("Refresh Code Context", "refresh-code-context", "navigate"),
      button("Open Patch Draft", "generate-patch-draft", "navigate"),
      freshness,
    );
  }

  if (
    input.patchDraftResponse &&
    patchDraftReadyForBuilder(input.patchDraftResponse)
  ) {
    return make(
      "generate-builder-prompt",
      "Ready for outside builder review",
      builderPromptDailyReason(
        "Patch Draft indicates the proposal may be ready to paste into an outside builder after your review.",
        input.planningStyle,
      ),
      button("Generate Builder Prompt", "generate-builder-prompt", "run"),
      button("Open Patch Draft", "generate-patch-draft", "navigate"),
      freshness,
    );
  }

  if (
    input.patchDraftResponse &&
    patchDraftRecommendsChecks(input.patchDraftResponse)
  ) {
    return make(
      "go-safety-checks",
      "Run Build/Test Checks",
      "Patch Draft recommends running allowlisted Build/Test Checks before implementation.",
      button("Run Build/Test Checks", "go-safety-checks", "navigate"),
      button("Open Patch Draft", "generate-patch-draft", "navigate"),
      freshness,
    );
  }

  if (input.codeContextAiResponse && codeAiSaysDoNotProceed(input.codeContextAiResponse)) {
    return make(
      "review-warnings",
      "Code AI review warns — do not proceed yet",
      `Local AI Code Review recommends: ${input.codeContextAiResponse.recommendedNextStep}. Review before continuing.`,
      button("Open Code Context", "refresh-code-context", "navigate"),
      button("Review Backlog", "review-warnings", "navigate"),
      freshness,
    );
  }

  if (
    input.codeContextAiResponse &&
    codeAiRecommendsChecks(input.codeContextAiResponse)
  ) {
    return make(
      "go-safety-checks",
      "Run Build/Test Checks",
      "Local AI Code Review recommends running allowlisted Build/Test Checks.",
      button("Run Build/Test Checks", "go-safety-checks", "navigate"),
      button("Open Code Context", "refresh-code-context", "navigate"),
      freshness,
    );
  }

  if (
    input.codeContextAiResponse &&
    codeAiRecommendsMoreContext(input.codeContextAiResponse)
  ) {
    return make(
      "refresh-code-context",
      "Select more code context",
      "Local AI Code Review suggests additional specific files/excerpts would help.",
      button("Refresh Code Context", "refresh-code-context", "navigate"),
      button("Ask Local AI Again", "ask-code-context-ai", "navigate"),
      freshness,
    );
  }

  if (
    input.codeContextAiResponse &&
    !input.patchDraftResponse &&
    userRequestImpliesPatchWork(input.userRequest) &&
    input.codeContextPreview
  ) {
    return make(
      "generate-patch-draft",
      "Generate Patch Draft (no apply)",
      "Local AI Code Review exists and your request implies a change. Draft a patch proposal from the approved Code Context Pack (confirmation required).",
      button("Generate Patch Draft", "generate-patch-draft", "navigate"),
      button("Open Code Context Pack", "refresh-code-context", "navigate"),
      freshness,
    );
  }

  if (input.codeContextPreview && !input.codeContextAiResponse) {
    return make(
      "ask-code-context-ai",
      "Ask Local AI About Selected Code",
      "A Code Context Pack preview exists. Ask your local Ollama reviewer about the approved excerpts (confirmation required).",
      button("Ask Local AI About Code", "ask-code-context-ai", "navigate"),
      button("Open Code Context Pack", "refresh-code-context", "navigate"),
      freshness,
    );
  }

  const needsProjectMemory =
    Boolean(input.decisionReport || input.builderPromptGeneratedAt) &&
    !input.projectMemoryLastSaved;
  const memoryStale = (() => {
    if (!input.projectMemoryLastSaved) return false;
    const savedAt = input.projectMemoryLastSaved.savedAt;
    const newerSources = [
      input.decisionReport?.generatedAt,
      input.builderPromptGeneratedAt,
      input.builderPlanGeneratedAt,
      input.builderPlanComparisonGeneratedAt,
      input.implementationReview?.generatedAt,
    ].filter(Boolean) as string[];
    return newerSources.some((stamp) => String(stamp) > String(savedAt));
  })();
  const preparingExternalShare =
    Boolean(input.reviewPack && input.decisionReport) &&
    (!input.projectMemoryLastSaved || memoryStale);

  if (needsProjectMemory || memoryStale || preparingExternalShare) {
    const why = needsProjectMemory
      ? "You have planning/decision evidence but no Project Memory saved in `.nttc/` yet."
      : memoryStale
        ? "Builder plan, comparison, implementation review, or decision evidence is newer than the last Project Memory save."
        : "You are preparing to share project context — export Project Memory markdown for reviewers.";
    return make(
      "export-project-memory",
      "Export Project Memory to `.nttc/`",
      `${why} Generate a preview, review it, then save documentation-only markdown files.`,
      button("Export Project Memory", "export-project-memory", "navigate"),
      button("Open Reports", "generate-review-pack", "navigate"),
      freshness,
    );
  }

  // Stage 117/119: low-priority Build Mode readiness hints (never override safety/review paths above).
  if (!bp?.blueprintImported) {
    return make(
      "create-blueprint-before-scaffold",
      "Create or import a Blueprint before Safe Scaffold Mode",
      "Build Mode is planning-only. Create or import a Blueprint before any future Safe Scaffold work.",
      button("Open Blueprint Tab", "open-blueprint", "navigate"),
      button("Open Build Tab", "open-build-mode", "navigate"),
      freshness,
    );
  }
  if (bp.blueprintImported && bp.taskCardsExist) {
    const targetSelected = Boolean(input.safeScaffoldTargetSelected);
    const targetStale = Boolean(input.safeScaffoldTargetStale);
    const targetStatus = input.safeScaffoldTargetStatus ?? null;

    if (!targetSelected || targetStale || !targetStatus) {
      return make(
        "select-safe-scaffold-target-folder",
        "Select a Safe Scaffold target folder",
        "Blueprint and task cards exist. Select a Safe Scaffold target folder.",
        button("Open Build Tab", "select-safe-scaffold-target-folder", "navigate"),
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        freshness,
      );
    }
    if (targetStatus === "blocked") {
      return make(
        "choose-empty-scaffold-target-folder",
        "Choose an empty folder outside the current project",
        "The selected Safe Scaffold target folder is blocked. Choose an empty folder outside the current project.",
        button(
          "Open Build Tab",
          "choose-empty-scaffold-target-folder",
          "navigate",
        ),
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        freshness,
      );
    }
    if (targetStatus === "caution" || targetStatus === "safe") {
      const previewExists = Boolean(input.safeScaffoldFileTreePreviewExists);
      const previewStale = Boolean(input.safeScaffoldFileTreePreviewStale);
      const contentExists = Boolean(input.safeScaffoldFileContentPreviewExists);
      const contentStale = Boolean(input.safeScaffoldFileContentPreviewStale);
      if (previewStale) {
        return make(
          "regenerate-safe-scaffold-file-tree-preview",
          "Regenerate Safe Scaffold File Tree Preview",
          "Safe Scaffold File Tree Preview is stale. Regenerate after Blueprint or target-folder changes.",
          button(
            "Open Build Tab",
            "regenerate-safe-scaffold-file-tree-preview",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      if (!previewExists) {
        return make(
          "generate-safe-scaffold-file-tree-preview",
          "Generate Safe Scaffold File Tree Preview",
          targetStatus === "safe"
            ? "Target folder is safe. Generate Safe Scaffold File Tree Preview."
            : "Target folder is Caution. You may generate a File Tree Preview with a caution warning (writes still not allowed).",
          button(
            "Open Build Tab",
            "generate-safe-scaffold-file-tree-preview",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      if (contentStale) {
        return make(
          "regenerate-safe-scaffold-file-content-preview",
          "Regenerate Safe Scaffold File Content Preview",
          "Safe Scaffold File Content Preview is stale. Regenerate after Blueprint, target-folder, or file-tree changes.",
          button(
            "Open Build Tab",
            "regenerate-safe-scaffold-file-content-preview",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      if (!contentExists) {
        return make(
          "generate-safe-scaffold-file-content-preview",
          "Generate Safe Scaffold File Content Preview",
          "Generate Safe Scaffold File Content Preview.",
          button(
            "Open Build Tab",
            "generate-safe-scaffold-file-content-preview",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      const manifestExists = Boolean(
        input.safeScaffoldWriteManifestPreviewExists,
      );
      const manifestStale = Boolean(
        input.safeScaffoldWriteManifestPreviewStale,
      );
      if (manifestStale) {
        return make(
          "regenerate-safe-scaffold-write-manifest-preview",
          "Regenerate Safe Scaffold Write Manifest Preview",
          "Safe Scaffold Write Manifest Preview is stale. Regenerate after Blueprint, target-folder, file-tree, or file-content changes.",
          button(
            "Open Build Tab",
            "regenerate-safe-scaffold-write-manifest-preview",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      if (!manifestExists) {
        return make(
          "generate-safe-scaffold-write-manifest-preview",
          "Generate Safe Scaffold Write Manifest Preview",
          "Generate Safe Scaffold Write Manifest Preview.",
          button(
            "Open Build Tab",
            "generate-safe-scaffold-write-manifest-preview",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      const confirmationExists = Boolean(
        input.safeScaffoldFinalConfirmationExists,
      );
      const confirmationStale = Boolean(
        input.safeScaffoldFinalConfirmationStale,
      );
      if (confirmationStale) {
        return make(
          "rerecord-safe-scaffold-final-confirmation",
          "Regenerate previews and record Safe Scaffold final confirmation again",
          "Regenerate previews and record Safe Scaffold final confirmation again.",
          button(
            "Open Build Tab",
            "rerecord-safe-scaffold-final-confirmation",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      if (!confirmationExists) {
        return make(
          "record-safe-scaffold-final-confirmation",
          "Review and record Safe Scaffold final confirmation",
          "Review and record Safe Scaffold final confirmation.",
          button(
            "Open Build Tab",
            "record-safe-scaffold-final-confirmation",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      const writeResultExists = Boolean(input.safeScaffoldWriteResultExists);
      const writeCanWrite = Boolean(input.safeScaffoldWriteCanWrite);
      const writeBlocked = Boolean(input.safeScaffoldWriteBlocked);
      const plannerBriefExists = Boolean(input.localPlannerBuildBriefExists);
      const plannerBriefStale = Boolean(input.localPlannerBuildBriefStale);
      const responseExists = Boolean(input.localPlannerResponseImportExists);
      const responseStale = Boolean(input.localPlannerResponseImportStale);
      const responseAccepted = Boolean(input.localPlannerResponseImportAccepted);
      const responseStatus = input.localPlannerResponseImportStatus ?? null;
      if (writeResultExists) {
        if (plannerBriefStale) {
          return make(
            "regenerate-local-planner-build-brief",
            "Regenerate the Local Planner Build Brief before using it",
            "Regenerate the Local Planner Build Brief before using it.",
            button(
              "Open Build Tab",
              "regenerate-local-planner-build-brief",
              "navigate",
            ),
            button("Open Blueprint Tab", "open-blueprint", "navigate"),
            freshness,
          );
        }
        if (!plannerBriefExists) {
          return make(
            "generate-local-planner-build-brief",
            "Generate a Local Planner Build Brief to choose the next build step",
            "Generate a Local Planner Build Brief to choose the next build step.",
            button(
              "Open Build Tab",
              "generate-local-planner-build-brief",
              "navigate",
            ),
            button("Open Blueprint Tab", "open-blueprint", "navigate"),
            freshness,
          );
        }
        if (!responseExists || responseStale) {
          return make(
            "paste-local-planner-response",
            "Paste a local planner response into NTTC for review",
            "Paste a local planner response into NTTC for review.",
            button(
              "Open Build Tab",
              "paste-local-planner-response",
              "navigate",
            ),
            button(
              "Open Build Tab",
              "copy-local-planner-build-brief",
              "navigate",
            ),
            freshness,
          );
        }
        if (responseAccepted) {
          const coderExists = Boolean(input.localCoderTaskPromptExists);
          const coderStale = Boolean(input.localCoderTaskPromptStale);
          if (coderStale) {
            return make(
              "regenerate-local-coder-task-prompt",
              "Regenerate the Local Coder Task Prompt before using it",
              "Regenerate the Local Coder Task Prompt before using it.",
              button(
                "Open Build Tab",
                "regenerate-local-coder-task-prompt",
                "navigate",
              ),
              button(
                "Open Build Tab",
                "local-planner-response-accepted",
                "navigate",
              ),
              freshness,
            );
          }
          if (!coderExists) {
            return make(
              "generate-local-coder-task-prompt",
              "Generate a Local Coder Task Prompt for the accepted planner response",
              "Generate a Local Coder Task Prompt for the accepted planner response.",
              button(
                "Open Build Tab",
                "generate-local-coder-task-prompt",
                "navigate",
              ),
              button(
                "Open Build Tab",
                "local-planner-response-accepted",
                "navigate",
              ),
              freshness,
            );
          }
          return make(
            "copy-local-coder-task-prompt",
            "Copy the Local Coder Task Prompt into a local coder model and import the response in a later stage",
            "Copy the Local Coder Task Prompt into a local coder model and import the response in a later stage.",
            button(
              "Open Build Tab",
              "copy-local-coder-task-prompt",
              "navigate",
            ),
            button(
              "Open Build Tab",
              "review-written-safe-scaffold-files",
              "navigate",
            ),
            freshness,
          );
        }
        if (
          responseStatus === "Blocked" ||
          responseStatus === "Caution" ||
          (responseExists && !responseAccepted)
        ) {
          return make(
            "revise-local-planner-response",
            "Revise the local planner response before preparing a coder prompt",
            "Revise the local planner response before preparing a coder prompt.",
            button(
              "Open Build Tab",
              "revise-local-planner-response",
              "navigate",
            ),
            button(
              "Open Build Tab",
              "copy-local-planner-build-brief",
              "navigate",
            ),
            freshness,
          );
        }
        return make(
          "copy-local-planner-build-brief",
          "Copy the Local Planner Build Brief into a local model and import the response",
          "Copy the Local Planner Build Brief into a local model and import the response.",
          button(
            "Open Build Tab",
            "copy-local-planner-build-brief",
            "navigate",
          ),
          button(
            "Open Build Tab",
            "review-written-safe-scaffold-files",
            "navigate",
          ),
          freshness,
        );
      }
      if (writeBlocked && !writeCanWrite) {
        return make(
          "resolve-safe-scaffold-write-blockers",
          "Resolve the Safe Scaffold write blockers before trying again",
          "Resolve the Safe Scaffold write blockers before trying again.",
          button(
            "Open Build Tab",
            "resolve-safe-scaffold-write-blockers",
            "navigate",
          ),
          button("Open Blueprint Tab", "open-blueprint", "navigate"),
          freshness,
        );
      }
      return make(
        "run-safe-scaffold-write",
        "Run the final Safe Scaffold write only if the target folder is still Safe",
        "Run the final Safe Scaffold write only if the target folder is still Safe.",
        button("Open Build Tab", "run-safe-scaffold-write", "navigate"),
        button("Open Blueprint Tab", "open-blueprint", "navigate"),
        freshness,
      );
    }
    return make(
      "build-mode-planning-only",
      "Build Mode is planning-only",
      "Build Mode remains planning-only. Review target folder readiness on the Build tab.",
      button("Open Build Tab", "open-build-mode", "navigate"),
      button("Open Blueprint Tab", "open-blueprint", "navigate"),
      freshness,
    );
  }

  return make(
    "ready-continue",
    "Ready for outside builder review",
    "Core inspect/review evidence looks current. Continue with reports or paste results from outside tools as needed.",
    button("Open Reports", "generate-review-pack", "navigate"),
    button("Open Request / Output", "paste-builder-result", "navigate"),
    freshness,
  );
}
