/**
 * Stage 76: rule-based workflow progress, health, handoff readiness, and blocked reasons.
 * Uses stored metadata only — never infers completion from file reads or AI.
 */

import type { DailyNextAction, DailyNextActionKind } from "./dailyNextAction";
import type {
  BuilderHandoffExportRecord,
  BuilderHandoffRecommendation,
  CheckpointAvailabilityState,
  CodeContextAiRecord,
  CodeContextPack,
  ExternalPatchDraftComparisonRecord,
  ImportedPatchDraftRecord,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecord,
  ProjectInfo,
  ProjectMemorySavedRecord,
} from "./types";

export type WorkflowStepStatus =
  | "completed"
  | "current"
  | "recommended-next"
  | "blocked"
  | "pending";

export type WorkflowHealthLevel = "green" | "yellow" | "red";

export type HandoffReadinessLevel =
  | "not-ready"
  | "planning-only"
  | "review-ready"
  | "implementation-ready";

export interface WorkflowProgressItem {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  detail: string;
  focusId: string | null;
}

export interface WorkflowHealthSummary {
  level: WorkflowHealthLevel;
  label: string;
  items: string[];
}

export interface WorkflowGuidanceInput {
  project: ProjectInfo | null;
  checkpointAvailability: CheckpointAvailabilityState;
  codeContextPreview: CodeContextPack | null;
  codeContextAiResponse: CodeContextAiRecord | null;
  patchDraftResponse: PatchDraftRecord | null;
  importedPatchDraft: ImportedPatchDraftRecord | null;
  patchDraftSafetyReview: PatchDraftSafetyReviewRecord | null;
  externalPatchDraftComparison: ExternalPatchDraftComparisonRecord | null;
  builderHandoffExport: BuilderHandoffExportRecord | null;
  projectMemoryLastSaved: ProjectMemorySavedRecord | null;
  backlogCriticalSafetyOpen: number;
  dailyNext: DailyNextAction;
  patchDraftLastFailureMessage?: string | null;
  /** Stage 80: build-from-idea path status */
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
    activeTaskStatus?: string | null;
    taskImplementationReportCount?: number;
    activeTaskHasImplementationReport?: boolean;
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
  /** Stage 119: Safe Scaffold target-folder readiness. */
  safeScaffoldTargetSelected?: boolean;
  safeScaffoldTargetStale?: boolean;
  safeScaffoldTargetStatus?: "safe" | "caution" | "blocked" | null;
  /** Stage 121: Safe Scaffold file-tree preview. */
  safeScaffoldFileTreePreviewExists?: boolean;
  safeScaffoldFileTreePreviewStale?: boolean;
  /** Stage 123: Safe Scaffold file-content preview. */
  safeScaffoldFileContentPreviewExists?: boolean;
  safeScaffoldFileContentPreviewStale?: boolean;
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
  architectureRefactorTaskBuilderHandoffReadiness?: string | null;
  architectureRefactorSentToBuilderTaskId?: string | null;
  architectureRefactorImplementationReportCount?: number;
  architectureRefactorPendingMarkImplementationReturned?: boolean;
  architectureRefactorImplementationReportTaskId?: string | null;
  architectureRefactorReviewedTaskId?: string | null;
  architectureRefactorNextTaskId?: string | null;
}

export const WORKFLOW_NAV_TARGETS = [
  { label: "Go to Code Context", focusId: "code-context-pack" },
  { label: "Go to Patch Draft", focusId: "patch-draft-mode" },
  { label: "Go to Safety Review", focusId: "patch-draft-safety-review" },
  { label: "Go to Builder Handoff", focusId: "builder-handoff-export" },
  { label: "Go to Project Memory", focusId: "project-memory" },
  { label: "Go to Blueprint", focusId: "blueprint-planner" },
] as const;

export const WORKFLOW_PANEL_IDS = [
  "project-memory",
  "code-context-pack",
  "code-context-ai",
  "patch-draft-mode",
  "manual-patch-draft-import",
  "patch-draft-safety-review",
  "external-patch-draft-comparison",
  "builder-handoff-export",
] as const;

export type WorkflowPanelId = (typeof WORKFLOW_PANEL_IDS)[number];

function isCompleted(
  id: string,
  input: WorkflowGuidanceInput,
): boolean {
  switch (id) {
    case "project-opened":
      return Boolean(input.project);
    case "architecture-health":
      return Boolean(
        input.architectureHealthExists && !input.architectureHealthStale,
      );
    case "architecture-refactor-task-cards":
      return Boolean(
        input.architectureRefactorTaskCardsExist &&
          !input.architectureRefactorTaskCardsStale,
      );
    case "architecture-refactor-task-builder-handoff":
      return Boolean(
        input.architectureRefactorTaskBuilderHandoffExists &&
          !input.architectureRefactorTaskBuilderHandoffStale,
      );
    case "architecture-refactor-task-implementation-intake":
      return (input.architectureRefactorImplementationReportCount ?? 0) > 0;
    case "safety-backup":
      return input.checkpointAvailability.restorable;
    case "code-context-pack":
      return Boolean(input.codeContextPreview?.markdownReport);
    case "local-ai-review":
      return Boolean(input.codeContextAiResponse?.responseText);
    case "patch-draft":
      return Boolean(input.patchDraftResponse?.draftText);
    case "manual-patch-import":
      return Boolean(input.importedPatchDraft?.draftText);
    case "patch-draft-safety-review":
      return Boolean(input.patchDraftSafetyReview?.markdownReport);
    case "external-patch-comparison":
      return Boolean(input.externalPatchDraftComparison?.markdownReport);
    case "builder-handoff":
      return Boolean(input.builderHandoffExport?.markdownReport);
    case "project-memory-export":
      return Boolean(input.projectMemoryLastSaved?.savedAt);
    case "blueprint-idea":
      return Boolean(input.blueprintStatus?.ideaExists);
    case "blueprint-imported":
      return Boolean(input.blueprintStatus?.blueprintImported);
    case "blueprint-local-planner":
      return Boolean(input.blueprintStatus?.localPlannerDraftExists);
    case "blueprint-completeness":
      return Boolean(input.blueprintStatus?.completenessCheckExists);
    case "blueprint-planning-export":
      return Boolean(input.blueprintStatus?.planningDocsExported);
    case "blueprint-phase1-handoff":
      return Boolean(input.blueprintStatus?.phase1HandoffExists);
    case "blueprint-phase-task-cards":
      return Boolean(input.blueprintStatus?.taskCardsExist);
    case "blueprint-task-builder-handoff":
      return Boolean(
        input.blueprintStatus?.taskBuilderHandoffExists &&
          !input.blueprintStatus?.taskBuilderHandoffStale,
      );
    case "blueprint-task-implementation-intake":
      return Boolean(
        (input.blueprintStatus?.taskImplementationReportCount ?? 0) > 0 ||
          input.blueprintStatus?.activeTaskHasImplementationReport,
      );
    case "blueprint-task-reconciliation":
      return Boolean(
        input.blueprintStatus?.taskReconciliationExists &&
          !input.blueprintStatus?.taskReconciliationStale,
      );
    case "blueprint-task-artifact-index":
      return Boolean(
        input.blueprintStatus?.taskArtifactIndexExists &&
          !input.blueprintStatus?.taskArtifactIndexStale,
      );
    case "changed-files-task-link":
      return Boolean(
        input.blueprintStatus?.changedFilesTaskLinkExists &&
          !input.blueprintStatus?.changedFilesTaskLinkStale &&
          (input.blueprintStatus.changedFilesTaskLinkScopeWarningCount ?? 0) === 0,
      );
    case "build-mode-safety-charter":
      // Stage 117: charter always present as planning-only UI (no write capability).
      return true;
    case "build-mode-target-folder":
      return Boolean(
        input.safeScaffoldTargetSelected &&
          !input.safeScaffoldTargetStale &&
          (input.safeScaffoldTargetStatus === "safe" ||
            input.safeScaffoldTargetStatus === "caution"),
      );
    case "build-mode-file-tree-preview":
      return Boolean(
        input.safeScaffoldFileTreePreviewExists &&
          !input.safeScaffoldFileTreePreviewStale,
      );
    case "build-mode-file-content-preview":
      return Boolean(
        input.safeScaffoldFileContentPreviewExists &&
          !input.safeScaffoldFileContentPreviewStale,
      );
    default:
      return false;
  }
}

function recommendedStepId(dailyNext: DailyNextAction): string | null {
  const map: Partial<Record<DailyNextActionKind, string>> = {
    "create-backup": "safety-backup",
    "verify-backup": "safety-backup",
    "refresh-code-context": "code-context-pack",
    "ask-code-context-ai": "local-ai-review",
    "generate-patch-draft": "patch-draft",
    "manual-patch-draft-import": "manual-patch-import",
    "generate-patch-draft-safety-review": "patch-draft-safety-review",
    "generate-external-patch-draft-comparison": "external-patch-comparison",
    "generate-builder-handoff-export": "builder-handoff",
    "export-project-memory": "project-memory-export",
    "open-blueprint": "blueprint-idea",
    "import-blueprint": "blueprint-imported",
    "check-blueprint-completeness": "blueprint-completeness",
    "export-planning-documents": "blueprint-planning-export",
    "generate-phase1-handoff": "blueprint-phase1-handoff",
    "generate-blueprint-phase-task-cards": "blueprint-phase-task-cards",
    "copy-blueprint-phase-task-card": "blueprint-phase-task-cards",
    "generate-task-card-builder-handoff": "blueprint-task-builder-handoff",
    "copy-task-card-builder-handoff": "blueprint-task-builder-handoff",
    "paste-task-implementation-report": "blueprint-task-implementation-intake",
    "mark-task-implementation-returned": "blueprint-task-implementation-intake",
    "generate-blueprint-task-reconciliation": "blueprint-task-reconciliation",
    "resolve-missing-task-producers": "blueprint-task-reconciliation",
    "fix-task-status-inconsistency": "blueprint-task-reconciliation",
    "generate-task-artifact-index": "blueprint-task-artifact-index",
    "resolve-unlinked-task-artifacts": "blueprint-task-artifact-index",
    "resolve-stale-task-artifacts": "blueprint-task-artifact-index",
    "link-changed-files-to-task": "changed-files-task-link",
    "review-changed-files-scope-warnings": "changed-files-task-link",
    "open-build-mode": "build-mode-safety-charter",
    "create-blueprint-before-scaffold": "blueprint-idea",
    "build-mode-planning-only": "build-mode-safety-charter",
    "select-safe-scaffold-target-folder": "build-mode-target-folder",
    "choose-empty-scaffold-target-folder": "build-mode-target-folder",
    "safe-scaffold-target-ready": "build-mode-file-tree-preview",
    "generate-safe-scaffold-file-tree-preview": "build-mode-file-tree-preview",
    "review-safe-scaffold-file-tree-preview": "build-mode-file-tree-preview",
    "regenerate-safe-scaffold-file-tree-preview": "build-mode-file-tree-preview",
    "generate-safe-scaffold-file-content-preview":
      "build-mode-file-content-preview",
    "review-safe-scaffold-file-content-preview":
      "build-mode-file-content-preview",
    "regenerate-safe-scaffold-file-content-preview":
      "build-mode-file-content-preview",
    "generate-architecture-health-report": "architecture-health",
    "regenerate-architecture-health-report": "architecture-health",
    "review-monolith-risk-changed-files": "architecture-health",
    "create-refactor-task-for-monolith": "architecture-refactor-task-cards",
    "generate-architecture-refactor-task-cards": "architecture-refactor-task-cards",
    "review-architecture-refactor-task-card": "architecture-refactor-task-cards",
    "regenerate-architecture-refactor-task-cards": "architecture-refactor-task-cards",
    "generate-architecture-refactor-task-builder-handoff":
      "architecture-refactor-task-builder-handoff",
    "copy-architecture-refactor-task-builder-handoff":
      "architecture-refactor-task-builder-handoff",
    "paste-architecture-refactor-implementation-report":
      "architecture-refactor-task-implementation-intake",
    "mark-architecture-refactor-implementation-returned":
      "architecture-refactor-task-implementation-intake",
    "wait-for-refactor-builder-report": "architecture-refactor-task-implementation-intake",
    summarize: "project-summary",
  };
  return map[dailyNext.id] ?? null;
}

function isBlocked(id: string, input: WorkflowGuidanceInput): boolean {
  if (id === "builder-handoff") {
    const rec = input.builderHandoffExport?.recommendation;
    if (rec === "Do not send yet") return true;
  }
  if (id === "patch-draft-safety-review") {
    if (input.patchDraftSafetyReview?.recommendation === "Do not proceed yet") {
      return true;
    }
  }
  if (id === "external-patch-comparison") {
    if (
      input.externalPatchDraftComparison?.riskLevel ===
      "Blocked / Do not proceed"
    ) {
      return true;
    }
  }
  if (id === "manual-patch-import" && input.importedPatchDraft) {
    if (
      (input.importedPatchDraft.riskPhraseCount ?? 0) > 0 &&
      input.importedPatchDraft.riskPhrases.some((p) =>
        /apply patch|edit mode|command runner/i.test(p),
      )
    ) {
      return true;
    }
  }
  if (id === "safety-backup" && !input.checkpointAvailability.restorable) {
    return input.checkpointAvailability.hasPreviousRecord;
  }
  return false;
}

function stepDetail(id: string, input: WorkflowGuidanceInput): string {
  switch (id) {
    case "project-opened":
      return input.project
        ? `Opened: ${input.project.displayName}`
        : "Select a project folder first.";
    case "architecture-health":
      if (!input.architectureHealthExists) {
        return "Generate a metadata-only Architecture Health Report.";
      }
      if (input.architectureHealthStale) {
        return "Architecture Health Report is stale — regenerate.";
      }
      return `Recommendation: ${input.architectureHealthRecommendation ?? "checked"}${(input.architectureHealthCriticalCount ?? 0) > 0 ? ` · ${input.architectureHealthCriticalCount} critical` : ""}.`;
    case "architecture-refactor-task-cards":
      if (!input.architectureRefactorTaskCardsExist) {
        return "Generate Architecture Refactor Task Cards from Architecture Health metadata.";
      }
      if (input.architectureRefactorTaskCardsStale) {
        return "Refactor task cards are stale — regenerate after Architecture Health updates.";
      }
      return input.architectureRefactorActiveTaskId
        ? `Active refactor task: ${input.architectureRefactorActiveTaskId}.`
        : "Refactor task cards ready.";
    case "architecture-refactor-task-builder-handoff":
      if (!input.architectureRefactorTaskBuilderHandoffExists) {
        return "Generate Architecture Refactor Builder Handoff for a selected refactor task.";
      }
      if (input.architectureRefactorTaskBuilderHandoffStale) {
        return "Refactor builder handoff is stale — regenerate after refactor card or Architecture Health updates.";
      }
      return `Handoff for ${input.architectureRefactorTaskBuilderHandoffSelectedTaskId ?? "task"} · ${input.architectureRefactorTaskBuilderHandoffReadiness ?? "ready"}.`;
    case "architecture-refactor-task-implementation-intake": {
      const count = input.architectureRefactorImplementationReportCount ?? 0;
      if (count === 0) {
        return "Paste a builder refactor implementation report after sending a refactor handoff.";
      }
      if (input.architectureRefactorPendingMarkImplementationReturned) {
        return "Mark refactor Implementation Returned after reviewing the pasted report.";
      }
      if (input.architectureRefactorImplementationReturnedTaskId) {
        return "Run Implementation Review for the returned refactor report.";
      }
      return `${count} refactor implementation report(s) saved.`;
    }
    case "safety-backup":
      return input.checkpointAvailability.restorable
        ? "Safety Backup verified — restore available."
        : input.checkpointAvailability.label;
    case "code-context-pack":
      return input.codeContextPreview
        ? `${input.codeContextPreview.selectedFileCount} file(s) in preview pack.`
        : "Build a preview-only Code Context Pack.";
    case "local-ai-review":
      return input.codeContextAiResponse
        ? `Review stored (${input.codeContextAiResponse.modelName}).`
        : "Optional: ask Local AI about the approved pack.";
    case "patch-draft":
      return input.patchDraftResponse
        ? "NTTC Patch Draft stored (draft only)."
        : "Generate a Patch Draft from the approved pack.";
    case "manual-patch-import":
      return input.importedPatchDraft
        ? `Imported from ${input.importedPatchDraft.source}.`
        : "Paste an outside builder draft manually.";
    case "patch-draft-safety-review":
      return input.patchDraftSafetyReview
        ? `Recommendation: ${input.patchDraftSafetyReview.recommendation}`
        : "Run a rule-based safety review on a stored draft.";
    case "external-patch-comparison":
      return input.externalPatchDraftComparison
        ? `Risk: ${input.externalPatchDraftComparison.riskLevel}`
        : "Compare NTTC and imported drafts.";
    case "builder-handoff":
      return input.builderHandoffExport
        ? `Handoff: ${input.builderHandoffExport.recommendation}`
        : "Generate a text-only Builder Handoff Pack.";
    case "project-memory-export":
      return input.projectMemoryLastSaved
        ? `Saved ${input.projectMemoryLastSaved.savedAt}.`
        : "Explicitly save `.nttc/` markdown when ready.";
    case "build-mode-safety-charter":
      return "Planning Only — Safe Scaffold Mode is not active; no file writes.";
    case "build-mode-target-folder":
      if (!input.safeScaffoldTargetSelected) {
        return "Select a Safe Scaffold target folder (metadata check only).";
      }
      if (input.safeScaffoldTargetStale || !input.safeScaffoldTargetStatus) {
        return "Target folder selected — refresh safety check.";
      }
      return `Folder safety: ${input.safeScaffoldTargetStatus} — writes still not allowed.`;
    case "build-mode-file-tree-preview":
      if (input.safeScaffoldFileTreePreviewStale) {
        return "File-tree preview is stale — regenerate.";
      }
      if (input.safeScaffoldFileTreePreviewExists) {
        return "File-tree preview ready (paths only — no contents, no writes).";
      }
      return "Generate Safe Scaffold File Tree Preview (paths only).";
    case "build-mode-file-content-preview":
      if (input.safeScaffoldFileContentPreviewStale) {
        return "File-content preview is stale — regenerate.";
      }
      if (input.safeScaffoldFileContentPreviewExists) {
        return "File-content preview ready (templates in memory — no writes).";
      }
      return "Generate Safe Scaffold File Content Preview (deterministic templates).";
    case "blueprint-idea":
      return input.blueprintStatus?.ideaExists
        ? "Project idea captured on Blueprint tab."
        : "Describe your app idea on the Blueprint tab.";
    case "blueprint-imported":
      return input.blueprintStatus?.blueprintImported
        ? "Planner blueprint imported."
        : "Paste and save a planner blueprint, or save a Local Planner AI draft.";
    case "blueprint-local-planner":
      return input.blueprintStatus?.localPlannerDraftExists
        ? "Local Planner Blueprint Draft exists — review before saving as official blueprint."
        : "Optional: Ask Local Planner AI on the Blueprint tab.";
    case "blueprint-completeness":
      return input.blueprintStatus?.completenessCheckExists
        ? `Readiness: ${input.blueprintStatus.readinessStatus ?? "checked"}`
        : "Run a rule-based completeness check.";
    case "blueprint-planning-export":
      return input.blueprintStatus?.planningDocsExported
        ? "Planning docs saved to `.nttc/planning/`."
        : "Preview then explicitly save planning markdown.";
    case "blueprint-phase1-handoff":
      return input.blueprintStatus?.phase1HandoffExists
        ? "Phase 1 Builder Handoff ready."
        : "Generate text-only Phase 1 handoff.";
    case "blueprint-phase-task-cards":
      if (!input.blueprintStatus?.taskCardsExist) {
        return "Generate Phase Task Cards from the saved blueprint.";
      }
      return `Active: ${input.blueprintStatus.activeTaskId ?? "none"}; next: ${input.blueprintStatus.nextTaskId ?? "none"}; blocked: ${input.blueprintStatus.blockedTaskCount ?? 0}.`;
    case "blueprint-task-builder-handoff":
      if (!input.blueprintStatus?.taskBuilderHandoffExists) {
        return "Generate Task Builder Handoff for the selected phase task.";
      }
      if (input.blueprintStatus.taskBuilderHandoffStale) {
        return "Task Builder Handoff is stale — regenerate.";
      }
      return `Handoff for ${input.blueprintStatus.taskBuilderHandoffSelectedTaskId ?? "task"} · ${input.blueprintStatus.taskBuilderHandoffReadiness ?? "ready"}.`;
    case "blueprint-task-implementation-intake": {
      const count = input.blueprintStatus?.taskImplementationReportCount ?? 0;
      if (count === 0) {
        return "Paste builder implementation reports per phase task on the Blueprint tab.";
      }
      const active = input.blueprintStatus?.activeTaskId ?? "task";
      if (input.blueprintStatus?.pendingMarkImplementationReturned) {
        return `Report saved for ${active} — mark Implementation Returned when ready.`;
      }
      return `${count} task implementation report(s) saved (text only).`;
    }
    case "blueprint-task-reconciliation": {
      if (!input.blueprintStatus?.taskReconciliationExists) {
        return "Generate a rule-based reconciliation report for phase task cards.";
      }
      if (input.blueprintStatus.taskReconciliationStale) {
        return "Reconciliation report is stale — regenerate after task card changes.";
      }
      const rec = input.blueprintStatus.taskReconciliationRecommendation ?? "checked";
      const missing = input.blueprintStatus.taskReconciliationMissingProducers ?? 0;
      return `Recommendation: ${rec}${missing > 0 ? ` · ${missing} missing producer(s)` : ""}.`;
    }
    case "blueprint-task-artifact-index": {
      if (!input.blueprintStatus?.taskArtifactIndexExists) {
        return "Generate a rule-based Task Artifact Index by task ID.";
      }
      if (input.blueprintStatus.taskArtifactIndexStale) {
        return "Task Artifact Index is stale — regenerate after artifact changes.";
      }
      const rec = input.blueprintStatus.taskArtifactIndexRecommendation ?? "checked";
      const unlinked = input.blueprintStatus.taskArtifactIndexUnlinkedCount ?? 0;
      const stale = input.blueprintStatus.taskArtifactIndexStaleCount ?? 0;
      return `Recommendation: ${rec}${unlinked > 0 ? ` · ${unlinked} unlinked` : ""}${stale > 0 ? ` · ${stale} stale` : ""}.`;
    }
    case "changed-files-task-link": {
      if (input.blueprintStatus?.changedFilesUnlinked) {
        return "Link changed-file metadata to a Blueprint task ID.";
      }
      if (input.blueprintStatus?.changedFilesTaskLinkStale) {
        return "Changed-files task link is stale — relink after scan or task card changes.";
      }
      const warnings =
        input.blueprintStatus?.changedFilesTaskLinkScopeWarningCount ?? 0;
      const taskId = input.blueprintStatus?.changedFilesTaskLinkTaskId ?? "none";
      return warnings > 0
        ? `Linked to ${taskId} with ${warnings} scope warning(s).`
        : `Linked to ${taskId}.`;
    }
    default:
      return "";
  }
}

export function buildWorkflowProgress(
  input: WorkflowGuidanceInput,
): WorkflowProgressItem[] {
  const steps: Array<{
    id: string;
    label: string;
    focusId: string | null;
  }> = [
    { id: "project-opened", label: "Project opened", focusId: "project-summary" },
    {
      id: "architecture-health",
      label: "Architecture Health",
      focusId: "architecture-health",
    },
    {
      id: "architecture-refactor-task-cards",
      label: "Architecture Refactor Task Cards",
      focusId: "architecture-refactor-task-cards",
    },
    {
      id: "architecture-refactor-task-builder-handoff",
      label: "Architecture Refactor Builder Handoff",
      focusId: "architecture-refactor-task-builder-handoff",
    },
    {
      id: "architecture-refactor-task-implementation-intake",
      label: "Architecture Refactor Implementation Intake",
      focusId: "architecture-refactor-task-implementation-intake",
    },
    { id: "safety-backup", label: "Safety Backup", focusId: "create-safety-backup" },
    {
      id: "code-context-pack",
      label: "Code Context Pack",
      focusId: "code-context-pack",
    },
    {
      id: "local-ai-review",
      label: "Local AI Review",
      focusId: "code-context-ai",
    },
    { id: "patch-draft", label: "Patch Draft", focusId: "patch-draft-mode" },
    {
      id: "manual-patch-import",
      label: "Manual Patch Import",
      focusId: "manual-patch-draft-import",
    },
    {
      id: "patch-draft-safety-review",
      label: "Patch Draft Safety Review",
      focusId: "patch-draft-safety-review",
    },
    {
      id: "external-patch-comparison",
      label: "External Patch Comparison",
      focusId: "external-patch-draft-comparison",
    },
    {
      id: "builder-handoff",
      label: "Builder Handoff",
      focusId: "builder-handoff-export",
    },
    {
      id: "project-memory-export",
      label: "Project Memory Export",
      focusId: "project-memory",
    },
    {
      id: "build-mode-safety-charter",
      label: "Build Mode Safety Charter",
      focusId: "build-mode-safety-charter",
    },
    {
      id: "build-mode-target-folder",
      label: "Safe Scaffold Target Folder",
      focusId: "build-mode-target-folder",
    },
    {
      id: "build-mode-file-tree-preview",
      label: "Safe Scaffold File Tree Preview",
      focusId: "build-mode-file-tree-preview",
    },
    {
      id: "build-mode-file-content-preview",
      label: "Safe Scaffold File Content Preview",
      focusId: "build-mode-file-content-preview",
    },
  ];

  const blueprintSteps: Array<{
    id: string;
    label: string;
    focusId: string | null;
  }> = input.blueprintStatus?.ideaExists
    ? [
        { id: "blueprint-idea", label: "Blueprint Idea", focusId: "blueprint-planner" },
        {
          id: "blueprint-local-planner",
          label: "Local Planner Draft",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-imported",
          label: "Blueprint Imported",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-completeness",
          label: "Blueprint Checked",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-planning-export",
          label: "Planning Docs Saved",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-phase1-handoff",
          label: "Phase 1 Handoff",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-phase-task-cards",
          label: "Phase Task Cards",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-task-builder-handoff",
          label: "Task Builder Handoff",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-task-implementation-intake",
          label: "Task Implementation Intake",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-task-reconciliation",
          label: "Task Reconciliation",
          focusId: "blueprint-planner",
        },
        {
          id: "blueprint-task-artifact-index",
          label: "Task Artifact Index",
          focusId: "blueprint-planner",
        },
        {
          id: "changed-files-task-link",
          label: "Changed Files Task Link",
          focusId: "changed-files",
        },
      ]
    : [];

  const allSteps = [...steps, ...blueprintSteps];

  const recommendedId = recommendedStepId(input.dailyNext);
  let currentAssigned = false;

  return allSteps.map((step) => {
    const completed = isCompleted(step.id, input);
    const blocked = isBlocked(step.id, input);
    let status: WorkflowStepStatus;

    if (blocked) {
      status = "blocked";
    } else if (completed) {
      status = "completed";
    } else if (step.id === recommendedId) {
      status = "recommended-next";
    } else if (!currentAssigned && !completed) {
      status = "current";
      currentAssigned = true;
    } else {
      status = "pending";
    }

    return {
      id: step.id,
      label: step.label,
      status,
      detail: stepDetail(step.id, input),
      focusId: step.focusId,
    };
  });
}

export function buildBlockedReasons(input: WorkflowGuidanceInput): string[] {
  const reasons: string[] = [];

  if (!input.project) {
    reasons.push("Select a project folder first.");
    return reasons;
  }

  if (!input.checkpointAvailability.restorable) {
    if (input.checkpointAvailability.hasPreviousRecord) {
      reasons.push(
        "Verify Safety Backup before continuing — a history record alone is not restorable.",
      );
    } else {
      reasons.push("Create a Safety Backup before risky patch-planning work.");
    }
  }

  if (
    input.dailyNext.id === "ask-code-context-ai" &&
    !input.codeContextPreview?.markdownReport
  ) {
    reasons.push("Generate a Code Context Pack preview first.");
  }

  if (
    input.dailyNext.id === "generate-patch-draft" &&
    !input.codeContextPreview?.markdownReport
  ) {
    reasons.push("Generate a Code Context Pack preview before a Patch Draft.");
  }

  if (input.patchDraftLastFailureMessage?.match(/timeout|timed out/i)) {
    reasons.push("Patch Draft timed out — try Fast Draft Setup with one small file.");
  }

  if (
    input.dailyNext.id === "generate-patch-draft-safety-review" &&
    !input.patchDraftResponse?.draftText &&
    !input.importedPatchDraft?.draftText
  ) {
    reasons.push("Patch Draft Safety Review requires a stored NTTC or imported draft.");
  }

  if (
    input.dailyNext.id === "generate-builder-handoff-export" &&
    !input.patchDraftSafetyReview
  ) {
    reasons.push("Builder Handoff is safer after a Patch Draft Safety Review.");
  }

  if (input.builderHandoffExport?.recommendation === "Do not send yet") {
    reasons.push(
      "Builder Handoff is blocked — resolve Safety Review, comparison, or high-risk draft warnings first.",
    );
  }

  if (
    input.blueprintStatus?.taskCardsExist &&
    (!input.blueprintStatus.taskReconciliationExists ||
      input.blueprintStatus.taskReconciliationStale)
  ) {
    reasons.push(
      "Generate a Task Reconciliation report before sending more task handoffs.",
    );
  }

  if ((input.blueprintStatus?.taskReconciliationMissingProducers ?? 0) > 0) {
    reasons.push(
      "Task reconciliation found missing producers — resolve before continuing.",
    );
  }

  if ((input.blueprintStatus?.taskReconciliationStatusInconsistencyCount ?? 0) > 0) {
    reasons.push("Task status inconsistency detected — review task statuses.");
  }

  if (
    input.blueprintStatus?.taskCardsExist &&
    input.blueprintStatus.changedFilesUnlinked
  ) {
    reasons.push("Link changed-file metadata to a Blueprint task ID.");
  }
  if ((input.blueprintStatus?.changedFilesTaskLinkScopeWarningCount ?? 0) > 0) {
    reasons.push("Review changed-file scope warnings on the Audit tab.");
  }

  if (
    input.blueprintStatus?.taskCardsExist &&
    !input.blueprintStatus.taskArtifactIndexExists
  ) {
    reasons.push("Generate a Task Artifact Index to trace task-linked metadata.");
  }

  if ((input.blueprintStatus?.taskArtifactIndexUnlinkedCount ?? 0) > 0) {
    reasons.push("Unlinked task artifacts detected — review Task Artifact Index.");
  }

  if (!input.architectureHealthExists && input.project) {
    reasons.push("Generate an Architecture Health Report to assess monolith risk.");
  }
  if (input.architectureHealthStale) {
    reasons.push("Architecture Health Report is stale — regenerate.");
  }
  if ((input.architectureHealthCriticalCount ?? 0) > 0) {
    reasons.push(
      "Critical monolith risk detected — plan refactors before adding features.",
    );
  }
  if (input.architectureHealthMonolithInChangedFiles) {
    reasons.push("Review monolith risk — changed files include App.tsx or main/index.ts.");
  }

  if (input.patchDraftSafetyReview?.recommendation === "Do not proceed yet") {
    reasons.push("Patch Draft Safety Review says do not proceed yet.");
  }

  if (
    input.externalPatchDraftComparison?.riskLevel === "Blocked / Do not proceed"
  ) {
    reasons.push("External Patch Draft Comparison is blocked — resolve conflicts first.");
  }

  if (
    input.importedPatchDraft &&
    input.importedPatchDraft.riskPhrases.some((p) =>
      /secret|api.?key|password|token/i.test(p),
    )
  ) {
    reasons.push(
      "Imported draft may contain secret-like patterns — remove secrets before handoff.",
    );
  } else if (
    input.importedPatchDraft &&
    (input.importedPatchDraft.riskPhraseCount ?? 0) >= 3
  ) {
    reasons.push("Imported draft contains multiple high-risk phrases.");
  }

  if (input.backlogCriticalSafetyOpen > 0) {
    reasons.push(
      `${input.backlogCriticalSafetyOpen} critical safety backlog item(s) need review.`,
    );
  }

  return [...new Set(reasons)];
}

export function buildWorkflowHealth(
  input: WorkflowGuidanceInput,
): WorkflowHealthSummary {
  const items: string[] = [];
  let red = 0;
  let yellow = 0;

  if (!input.checkpointAvailability.restorable) {
    items.push("No verified Safety Backup");
    red += 1;
  } else {
    items.push("Safety Backup verified");
  }

  if (input.patchDraftSafetyReview) {
    if (input.patchDraftSafetyReview.recommendation === "Do not proceed yet") {
      items.push("Safety Review blocked");
      red += 1;
    } else {
      items.push("Patch Draft reviewed");
    }
  } else if (input.patchDraftResponse || input.importedPatchDraft) {
    items.push("Safety Review missing");
    yellow += 1;
  }

  if (input.externalPatchDraftComparison) {
    if (
      input.externalPatchDraftComparison.riskLevel === "Blocked / Do not proceed"
    ) {
      items.push("Comparison blocked");
      red += 1;
    } else {
      items.push("Comparison complete");
    }
  } else if (input.patchDraftResponse && input.importedPatchDraft) {
    items.push("Comparison missing");
    yellow += 1;
  }

  if (input.builderHandoffExport) {
    if (input.builderHandoffExport.recommendation === "Do not send yet") {
      items.push("Handoff blocked");
      red += 1;
    } else {
      items.push("Builder handoff ready");
    }
  } else if (input.patchDraftSafetyReview) {
    items.push("Builder handoff not generated");
    yellow += 1;
  }

  if (input.blueprintStatus?.taskCardsExist) {
    if (!input.blueprintStatus.taskReconciliationExists) {
      items.push("Task reconciliation missing");
      yellow += 1;
    } else if (input.blueprintStatus.taskReconciliationStale) {
      items.push("Task reconciliation stale");
      yellow += 1;
    } else if (input.blueprintStatus.taskReconciliationRecommendation === "Blocked") {
      items.push("Task deck blocked");
      red += 1;
    } else if (
      (input.blueprintStatus.taskReconciliationMissingProducers ?? 0) > 0 ||
      (input.blueprintStatus.taskReconciliationStatusInconsistencyCount ?? 0) > 0
    ) {
      items.push("Task reconciliation warnings");
      yellow += 1;
    } else {
      items.push("Task reconciliation ready");
    }
  }

  if (input.blueprintStatus?.taskCardsExist) {
    if (input.blueprintStatus.changedFilesUnlinked) {
      items.push("Changed-files not linked to task");
      yellow += 1;
    } else if (input.blueprintStatus.changedFilesTaskLinkStale) {
      items.push("Changed-files task link stale");
      yellow += 1;
    } else if (
      (input.blueprintStatus.changedFilesTaskLinkScopeWarningCount ?? 0) > 0
    ) {
      items.push("Changed-files scope warnings");
      yellow += 1;
    } else if (input.blueprintStatus.changedFilesTaskLinkExists) {
      items.push("Changed-files task link ready");
    }
  }

  if (input.blueprintStatus?.taskCardsExist) {
    if (!input.blueprintStatus.taskArtifactIndexExists) {
      items.push("Task artifact index missing");
      yellow += 1;
    } else if (input.blueprintStatus.taskArtifactIndexStale) {
      items.push("Task artifact index stale");
      yellow += 1;
    } else if (
      (input.blueprintStatus.taskArtifactIndexUnlinkedCount ?? 0) > 0 ||
      (input.blueprintStatus.taskArtifactIndexStaleCount ?? 0) > 0
    ) {
      items.push("Task artifact index warnings");
      yellow += 1;
    } else {
      items.push("Task artifact index ready");
    }
  }

  if (input.project) {
    if (!input.architectureHealthExists) {
      items.push("Architecture health missing");
      yellow += 1;
    } else if (input.architectureHealthStale) {
      items.push("Architecture health stale");
      yellow += 1;
    } else if ((input.architectureHealthCriticalCount ?? 0) > 0) {
      items.push("Critical monolith risk");
      red += 1;
    } else if (
      input.architectureHealthRecommendation?.includes("Monolith risk")
    ) {
      items.push("Monolith risk warnings");
      yellow += 1;
    } else {
      items.push("Architecture health ready");
    }

    if (
      input.architectureHealthExists &&
      !input.architectureHealthStale &&
      (input.architectureHealthCriticalCount ?? 0) > 0
    ) {
      if (!input.architectureRefactorTaskCardsExist) {
        items.push("Architecture refactor task cards missing");
        yellow += 1;
      } else if (input.architectureRefactorTaskCardsStale) {
        items.push("Architecture refactor task cards stale");
        yellow += 1;
      } else {
        items.push("Architecture refactor task cards ready");
        if (
          !input.architectureRefactorTaskBuilderHandoffExists ||
          input.architectureRefactorTaskBuilderHandoffStale
        ) {
          items.push("Architecture refactor builder handoff missing or stale");
          yellow += 1;
        }
      }
    }
  }

  if (
    input.importedPatchDraft &&
    (input.importedPatchDraft.riskPhraseCount ?? 0) > 0 &&
    !input.patchDraftSafetyReview
  ) {
    items.push("Imported draft has risk phrase warnings");
    yellow += 1;
  }

  let level: WorkflowHealthLevel = "green";
  if (red > 0) level = "red";
  else if (yellow > 0) level = "yellow";

  const label =
    level === "green" ? "Green" : level === "yellow" ? "Yellow" : "Red";

  return { level, label, items };
}

function readinessFromRecommendation(
  rec: BuilderHandoffRecommendation | null | undefined,
): HandoffReadinessLevel {
  switch (rec) {
    case "Send to builder for narrow implementation":
      return "implementation-ready";
    case "Send to outside builder for review only":
    case "Ready for human review, not apply":
      return "review-ready";
    case "Send only for planning":
      return "planning-only";
  }
  return "not-ready";
}

export function buildHandoffReadiness(
  input: WorkflowGuidanceInput,
): { level: HandoffReadinessLevel; label: string; detail: string } {
  const rec = input.builderHandoffExport?.recommendation;
  if (rec) {
    const level = readinessFromRecommendation(rec);
    const labels: Record<HandoffReadinessLevel, string> = {
      "not-ready": "Not Ready",
      "planning-only": "Planning Only",
      "review-ready": "Review Ready",
      "implementation-ready": "Implementation Ready",
    };
    return {
      level,
      label: labels[level],
      detail: `Based on stored handoff recommendation: ${rec}`,
    };
  }

  if (
    input.patchDraftSafetyReview?.recommendation === "Do not proceed yet" ||
    input.externalPatchDraftComparison?.riskLevel === "Blocked / Do not proceed"
  ) {
    return {
      level: "not-ready",
      label: "Not Ready",
      detail: "Safety Review or comparison blocked handoff.",
    };
  }

  if (input.patchDraftSafetyReview && input.externalPatchDraftComparison) {
    return {
      level: "planning-only",
      label: "Planning Only",
      detail: "Safety Review and comparison exist — generate Builder Handoff next.",
    };
  }

  if (input.patchDraftResponse || input.importedPatchDraft) {
    return {
      level: "planning-only",
      label: "Planning Only",
      detail: "Draft exists — complete Safety Review and comparison before handoff.",
    };
  }

  return {
    level: "not-ready",
    label: "Not Ready",
    detail: "Build Code Context and patch drafts before handoff.",
  };
}

export function defaultPanelCollapsed(
  panelId: WorkflowPanelId,
  progress: WorkflowProgressItem[],
  userPreference: boolean | undefined,
): boolean {
  if (userPreference !== undefined) return userPreference;
  const item = progress.find((p) => p.focusId === panelId);
  if (!item) return false;
  return item.status === "completed";
}

export function groupActionLogEntries(
  entries: Array<{ id: string; level: string; timestamp: string; message: string; detail?: string }>,
): Array<{
  key: string;
  level: string;
  timestamp: string;
  message: string;
  detail?: string;
  count: number;
}> {
  const groups: Array<{
    key: string;
    level: string;
    timestamp: string;
    message: string;
    detail?: string;
    count: number;
  }> = [];

  for (const entry of entries) {
    const sig = `${entry.level}|${entry.message}|${entry.detail ?? ""}`;
    const last = groups[groups.length - 1];
    if (last && last.key === sig) {
      last.count += 1;
      last.timestamp = entry.timestamp;
      continue;
    }
    groups.push({
      key: sig,
      level: entry.level,
      timestamp: entry.timestamp,
      message: entry.message,
      detail: entry.detail,
      count: 1,
    });
  }

  return groups;
}
