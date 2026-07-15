import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  ActionLogLevel,
  AppSnapshot,
  BacklogFilters,
  BacklogItemType,
  BacklogPriority,
  BacklogStatus,
  BuilderResultResponseType,
  BuilderResultSource,
  ExternalReviewSource,
  NttcApi,
  PathCheckResult,
  ProviderSettings,
  SafeCheckKind,
  SpeakerScriptRole,
  SpeakerScriptTone,
  LocalAiRoleId,
  RoleModelMappingKey,
} from "../shared/types";

/**
 * Sandboxed preload cannot require relative CommonJS modules.
 * Keep these channel strings in sync with IPC_CHANNELS in src/shared/types.ts.
 */
const IPC_CHANNELS = {
  getSnapshot: "nttc:get-snapshot",
  selectProjectFolder: "nttc:select-project-folder",
  clearProject: "nttc:clear-project",
  checkPath: "nttc:check-path",
  logPlaceholderAction: "nttc:log-placeholder-action",
  logUiAction: "nttc:log-ui-action",
  summarizeProject: "nttc:summarize-project",
  recordCopySummary: "nttc:record-copy-summary",
  setUserRequest: "nttc:set-user-request",
  generateReviewPack: "nttc:generate-review-pack",
  recordCopyReviewPack: "nttc:record-copy-review-pack",
  scanChangedFiles: "nttc:scan-changed-files",
  generatePatchReviewPack: "nttc:generate-patch-review-pack",
  recordCopyPatchReviewPack: "nttc:record-copy-patch-review-pack",
  generateDecisionReport: "nttc:generate-decision-report",
  recordCopyDecisionReport: "nttc:record-copy-decision-report",
  generateBuilderPrompt: "nttc:generate-builder-prompt",
  recordCopyBuilderPrompt: "nttc:record-copy-builder-prompt",
  createCheckpoint: "nttc:create-checkpoint",
  undoLastCheckpoint: "nttc:undo-last-checkpoint",
  verifyCheckpoint: "nttc:verify-checkpoint",
  updateProviderSettings: "nttc:update-provider-settings",
  testProviderConnection: "nttc:test-provider-connection",
  checkOllamaStatus: "nttc:check-ollama-status",
  refreshInstalledModels: "nttc:refresh-installed-models",
  setRoleModelMapping: "nttc:set-role-model-mapping",
  suggestRoleModelDefaults: "nttc:suggest-role-model-defaults",
  askLocalAi: "nttc:ask-local-ai",
  setLocalAiRole: "nttc:set-local-ai-role",
  setBuilderPlanIncludeExternal: "nttc:set-builder-plan-include-external",
  setBuilderPlanIncludeBuilderResult:
    "nttc:set-builder-plan-include-builder-result",
  generateBuilderPlan: "nttc:generate-builder-plan",
  recordCopyBuilderPlan: "nttc:record-copy-builder-plan",
  recordCopyAdvisorResponse: "nttc:record-copy-advisor-response",
  runSafeCheck: "nttc:run-safe-check",
  cancelSafeCheck: "nttc:cancel-safe-check",
  recordCopyCommandOutput: "nttc:record-copy-command-output",
  testQwenCli: "nttc:test-qwen-cli",
  generateQwenPromptPack: "nttc:generate-qwen-prompt-pack",
  recordCopyQwenPromptPack: "nttc:record-copy-qwen-prompt-pack",
  recordCopyQwenReport: "nttc:record-copy-qwen-report",
  setExternalReviewSource: "nttc:set-external-review-source",
  setExternalReviewDraft: "nttc:set-external-review-draft",
  setExternalReviewLabel: "nttc:set-external-review-label",
  saveExternalReview: "nttc:save-external-review",
  selectExternalReview: "nttc:select-external-review",
  deleteExternalReview: "nttc:delete-external-review",
  clearExternalReview: "nttc:clear-external-review",
  recordCopyExternalReview: "nttc:record-copy-external-review",
  setBuilderResultSource: "nttc:set-builder-result-source",
  setBuilderResultResponseType: "nttc:set-builder-result-response-type",
  setBuilderResultDraft: "nttc:set-builder-result-draft",
  setBuilderResultLabel: "nttc:set-builder-result-label",
  saveBuilderResult: "nttc:save-builder-result",
  clearBuilderResult: "nttc:clear-builder-result",
  recordCopyBuilderResult: "nttc:record-copy-builder-result",
  generateBuilderPlanComparison: "nttc:generate-builder-plan-comparison",
  recordCopyBuilderPlanComparison: "nttc:record-copy-builder-plan-comparison",
  generateImplementationReview: "nttc:generate-implementation-review",
  recordCopyImplementationReview: "nttc:record-copy-implementation-review",
  setSpeakerScriptRole: "nttc:set-speaker-script-role",
  setSpeakerScriptTone: "nttc:set-speaker-script-tone",
  generateSpeakerScript: "nttc:generate-speaker-script",
  recordCopySpeakerScript: "nttc:record-copy-speaker-script",
  setBacklogDraftTitle: "nttc:set-backlog-draft-title",
  setBacklogDraftType: "nttc:set-backlog-draft-type",
  setBacklogDraftPriority: "nttc:set-backlog-draft-priority",
  setBacklogDraftStatus: "nttc:set-backlog-draft-status",
  setBacklogDraftNotes: "nttc:set-backlog-draft-notes",
  setBacklogDraftRelatedStage: "nttc:set-backlog-draft-related-stage",
  setBacklogFilters: "nttc:set-backlog-filters",
  saveBacklogItem: "nttc:save-backlog-item",
  updateBacklogItem: "nttc:update-backlog-item",
  selectBacklogItem: "nttc:select-backlog-item",
  deleteBacklogItem: "nttc:delete-backlog-item",
  recordCopyBacklogItem: "nttc:record-copy-backlog-item",
  generateBacklogReport: "nttc:generate-backlog-report",
  recordCopyBacklogReport: "nttc:record-copy-backlog-report",
  openRecentProject: "nttc:open-recent-project",
  clearRecentProjects: "nttc:clear-recent-projects",
  clearProjectHistory: "nttc:clear-project-history",
  saveSessionHistory: "nttc:save-session-history",
  generateProjectMemoryPreview: "nttc:generate-project-memory-preview",
  saveProjectMemoryFiles: "nttc:save-project-memory-files",
  recordCopyProjectMemoryBundle: "nttc:record-copy-project-memory-bundle",
  refreshCodeContextFileList: "nttc:refresh-code-context-file-list",
  setCodeContextFilter: "nttc:set-code-context-filter",
  setCodeContextFileSelected: "nttc:set-code-context-file-selected",
  setCodeContextQuestion: "nttc:set-code-context-question",
  applyCodeQuestionTemplate: "nttc:apply-code-question-template",
  clearCodeContextQuestion: "nttc:clear-code-context-question",
  setCodeContextMaxLinesPerFile: "nttc:set-code-context-max-lines-per-file",
  setCodeContextMaxTotalChars: "nttc:set-code-context-max-total-chars",
  clearCodeContextSelection: "nttc:clear-code-context-selection",
  generateCodeContextPreview: "nttc:generate-code-context-preview",
  recordCopyCodeContextPack: "nttc:record-copy-code-context-pack",
  askLocalAiAboutCodeContext: "nttc:ask-local-ai-about-code-context",
  recordCopyCodeContextAiResponse: "nttc:record-copy-code-context-ai-response",
  setPatchDraftIncludeCodeAi: "nttc:set-patch-draft-include-code-ai",
  setPatchDraftIncludeBuilderPlanDecision:
    "nttc:set-patch-draft-include-builder-plan-decision",
  setPatchDraftIncludeImplementationReview:
    "nttc:set-patch-draft-include-implementation-review",
  generatePatchDraft: "nttc:generate-patch-draft",
  recordCopyPatchDraft: "nttc:record-copy-patch-draft",
  generatePatchDraftSafetyReview: "nttc:generate-patch-draft-safety-review",
  recordCopyPatchDraftSafetyReview: "nttc:record-copy-patch-draft-safety-review",
  setPatchDraftSafetyReviewTarget: "nttc:set-patch-draft-safety-review-target",
  setImportedPatchDraftSource: "nttc:set-imported-patch-draft-source",
  setImportedPatchDraftType: "nttc:set-imported-patch-draft-type",
  setImportedPatchDraftDraft: "nttc:set-imported-patch-draft-draft",
  saveImportedPatchDraft: "nttc:save-imported-patch-draft",
  clearImportedPatchDraft: "nttc:clear-imported-patch-draft",
  recordCopyImportedPatchDraft: "nttc:record-copy-imported-patch-draft",
  generateExternalPatchDraftComparison:
    "nttc:generate-external-patch-draft-comparison",
  recordCopyExternalPatchDraftComparison:
    "nttc:record-copy-external-patch-draft-comparison",
  clearExternalPatchDraftComparison:
    "nttc:clear-external-patch-draft-comparison",
  setBuilderHandoffTarget: "nttc:set-builder-handoff-target",
  setBuilderHandoffStrictness: "nttc:set-builder-handoff-strictness",
  generateBuilderHandoffExport: "nttc:generate-builder-handoff-export",
  recordCopyBuilderHandoffExport: "nttc:record-copy-builder-handoff-export",
  clearBuilderHandoffExport: "nttc:clear-builder-handoff-export",
  setBlueprintIntake: "nttc:set-blueprint-intake",
  generateBlueprintPlannerQuestions: "nttc:generate-blueprint-planner-questions",
  generateBlueprintPlannerPrompt: "nttc:generate-blueprint-planner-prompt",
  setBlueprintDraftSource: "nttc:set-blueprint-draft-source",
  setBlueprintDraftText: "nttc:set-blueprint-draft-text",
  saveImportedBlueprint: "nttc:save-imported-blueprint",
  clearImportedBlueprint: "nttc:clear-imported-blueprint",
  checkBlueprintCompleteness: "nttc:check-blueprint-completeness",
  previewBlueprintPlanningDocuments: "nttc:preview-blueprint-planning-documents",
  saveBlueprintPlanningDocuments: "nttc:save-blueprint-planning-documents",
  generateBlueprintPhase1Handoff: "nttc:generate-blueprint-phase1-handoff",
  setBlueprintPreviewFile: "nttc:set-blueprint-preview-file",
  recordCopyBlueprintPlannerQuestions: "nttc:record-copy-blueprint-planner-questions",
  recordCopyBlueprintPlannerPrompt: "nttc:record-copy-blueprint-planner-prompt",
  recordCopyImportedBlueprint: "nttc:record-copy-imported-blueprint",
  recordCopyBlueprintPhase1Handoff: "nttc:record-copy-blueprint-phase1-handoff",
  askLocalPlannerAi: "nttc:ask-local-planner-ai",
  recordCopyBlueprintPlannerAiDraft: "nttc:record-copy-blueprint-planner-ai-draft",
  saveBlueprintPlannerDraftAsImported: "nttc:save-blueprint-planner-draft-as-imported",
  generateBlueprintPhaseTaskCards: "nttc:generate-blueprint-phase-task-cards",
  clearBlueprintPhaseTaskCards: "nttc:clear-blueprint-phase-task-cards",
  setBlueprintPhaseTaskCardStatus: "nttc:set-blueprint-phase-task-card-status",
  resetBlueprintPhaseTaskCardStatus: "nttc:reset-blueprint-phase-task-card-status",
  setBlueprintActivePhaseTaskCard: "nttc:set-blueprint-active-phase-task-card",
  recordCopyBlueprintPhaseTaskCard: "nttc:record-copy-blueprint-phase-task-card",
  recordCopyAllBlueprintPhaseTaskCards: "nttc:record-copy-all-blueprint-phase-task-cards",
  setTaskCardBuilderHandoffSelectedTask: "nttc:set-task-card-builder-handoff-selected-task",
  setTaskCardBuilderHandoffTarget: "nttc:set-task-card-builder-handoff-target",
  setTaskCardBuilderHandoffStrictness: "nttc:set-task-card-builder-handoff-strictness",
  generateTaskCardBuilderHandoff: "nttc:generate-task-card-builder-handoff",
  clearTaskCardBuilderHandoff: "nttc:clear-task-card-builder-handoff",
  recordCopyTaskCardBuilderHandoff: "nttc:record-copy-task-card-builder-handoff",
  setTaskImplementationIntakeSelectedTask: "nttc:set-task-implementation-intake-selected-task",
  setTaskImplementationIntakeBuilderSource: "nttc:set-task-implementation-intake-builder-source",
  setTaskImplementationIntakeDraftText: "nttc:set-task-implementation-intake-draft-text",
  saveTaskImplementationReport: "nttc:save-task-implementation-report",
  clearTaskImplementationReport: "nttc:clear-task-implementation-report",
  recordCopyTaskImplementationReport: "nttc:record-copy-task-implementation-report",
  markTaskImplementationReturned: "nttc:mark-task-implementation-returned",
  markTaskImplementationReviewed: "nttc:mark-task-implementation-reviewed",
  stageTaskImplementationReportForReview: "nttc:stage-task-implementation-report-for-review",
  generateBlueprintTaskReconciliation: "nttc:generate-blueprint-task-reconciliation",
  clearBlueprintTaskReconciliation: "nttc:clear-blueprint-task-reconciliation",
  recordCopyBlueprintTaskReconciliation: "nttc:record-copy-blueprint-task-reconciliation",
  generateTaskArtifactIndex: "nttc:generate-task-artifact-index",
  clearTaskArtifactIndex: "nttc:clear-task-artifact-index",
  recordCopyTaskArtifactIndex: "nttc:record-copy-task-artifact-index",
  setTaskArtifactIndexFilter: "nttc:set-task-artifact-index-filter",
  setChangedFilesTaskLinkSelectedTask: "nttc:set-changed-files-task-link-selected-task",
  linkChangedFilesToTask: "nttc:link-changed-files-to-task",
  clearChangedFilesTaskLink: "nttc:clear-changed-files-task-link",
  generateArchitectureHealthReport: "nttc:generate-architecture-health-report",
  clearArchitectureHealthReport: "nttc:clear-architecture-health-report",
  recordCopyArchitectureHealthReport: "nttc:record-copy-architecture-health-report",
  setArchitectureHealthIncludeTestFiles: "nttc:set-architecture-health-include-test-files",
  setArchitectureHealthIncludeMarkdownDocs:
    "nttc:set-architecture-health-include-markdown-docs",
  generateArchitectureRefactorTaskCards:
    "nttc:generate-architecture-refactor-task-cards",
  clearArchitectureRefactorTaskCards: "nttc:clear-architecture-refactor-task-cards",
  setArchitectureRefactorTaskCardStatus:
    "nttc:set-architecture-refactor-task-card-status",
  resetArchitectureRefactorTaskCardStatus:
    "nttc:reset-architecture-refactor-task-card-status",
  recordCopyArchitectureRefactorTaskCard:
    "nttc:record-copy-architecture-refactor-task-card",
  recordCopyAllArchitectureRefactorTaskCards:
    "nttc:record-copy-all-architecture-refactor-task-cards",
  setArchitectureRefactorTaskBuilderHandoffSelectedTask:
    "nttc:set-architecture-refactor-task-builder-handoff-selected-task",
  setArchitectureRefactorTaskBuilderHandoffTarget:
    "nttc:set-architecture-refactor-task-builder-handoff-target",
  setArchitectureRefactorTaskBuilderHandoffStrictness:
    "nttc:set-architecture-refactor-task-builder-handoff-strictness",
  generateArchitectureRefactorTaskBuilderHandoff:
    "nttc:generate-architecture-refactor-task-builder-handoff",
  clearArchitectureRefactorTaskBuilderHandoff:
    "nttc:clear-architecture-refactor-task-builder-handoff",
  recordCopyArchitectureRefactorTaskBuilderHandoff:
    "nttc:record-copy-architecture-refactor-task-builder-handoff",
  setArchitectureRefactorTaskImplementationIntakeSelectedTask:
    "nttc:set-architecture-refactor-task-implementation-intake-selected-task",
  setArchitectureRefactorTaskImplementationIntakeBuilderSource:
    "nttc:set-architecture-refactor-task-implementation-intake-builder-source",
  setArchitectureRefactorTaskImplementationIntakeDraftText:
    "nttc:set-architecture-refactor-task-implementation-intake-draft-text",
  saveArchitectureRefactorTaskImplementationReport:
    "nttc:save-architecture-refactor-task-implementation-report",
  clearArchitectureRefactorTaskImplementationReport:
    "nttc:clear-architecture-refactor-task-implementation-report",
  recordCopyArchitectureRefactorTaskImplementationReport:
    "nttc:record-copy-architecture-refactor-task-implementation-report",
  markArchitectureRefactorTaskImplementationReturned:
    "nttc:mark-architecture-refactor-task-implementation-returned",
  markArchitectureRefactorTaskImplementationReviewed:
    "nttc:mark-architecture-refactor-task-implementation-reviewed",
  stageArchitectureRefactorTaskImplementationReportForReview:
    "nttc:stage-architecture-refactor-task-implementation-report-for-review",
  selectSafeScaffoldTargetFolder: "nttc:select-safe-scaffold-target-folder",
  clearSafeScaffoldTargetFolder: "nttc:clear-safe-scaffold-target-folder",
  refreshSafeScaffoldTargetSafety: "nttc:refresh-safe-scaffold-target-safety",
  generateSafeScaffoldFileTreePreview:
    "nttc:generate-safe-scaffold-file-tree-preview",
  clearSafeScaffoldFileTreePreview: "nttc:clear-safe-scaffold-file-tree-preview",
  recordCopySafeScaffoldFileTreePreview:
    "nttc:record-copy-safe-scaffold-file-tree-preview",
  generateSafeScaffoldFileContentPreview:
    "nttc:generate-safe-scaffold-file-content-preview",
  clearSafeScaffoldFileContentPreview:
    "nttc:clear-safe-scaffold-file-content-preview",
  recordCopySafeScaffoldFileContentPreview:
    "nttc:record-copy-safe-scaffold-file-content-preview",
  generateSafeScaffoldWriteManifestPreview:
    "nttc:generate-safe-scaffold-write-manifest-preview",
  clearSafeScaffoldWriteManifestPreview:
    "nttc:clear-safe-scaffold-write-manifest-preview",
  recordCopySafeScaffoldWriteManifestPreview:
    "nttc:record-copy-safe-scaffold-write-manifest-preview",
  setPlanningStyle: "nttc:set-planning-style",
  setReportsPanelCollapsed: "nttc:set-reports-panel-collapsed",
  applyFastDraftSetup: "nttc:apply-fast-draft-setup",
  subscribeSnapshot: "nttc:snapshot-updated",
} as const;

const api: NttcApi = {
  getSnapshot: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.getSnapshot),

  selectProjectFolder: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectProjectFolder),

  clearProject: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearProject),

  checkPath: (candidatePath: string): Promise<PathCheckResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.checkPath, candidatePath),

  logPlaceholderAction: (buttonLabel: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.logPlaceholderAction, buttonLabel),

  logUiAction: (
    level: ActionLogLevel,
    message: string,
    detail?: string,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.logUiAction, level, message, detail),

  summarizeProject: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.summarizeProject),

  recordCopySummary: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopySummary),

  setUserRequest: (text: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setUserRequest, text),

  generateReviewPack: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateReviewPack),

  recordCopyReviewPack: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyReviewPack),

  scanChangedFiles: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.scanChangedFiles),

  generatePatchReviewPack: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generatePatchReviewPack),

  recordCopyPatchReviewPack: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyPatchReviewPack),

  generateDecisionReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateDecisionReport),

  recordCopyDecisionReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyDecisionReport),

  generateBuilderPrompt: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBuilderPrompt),

  recordCopyBuilderPrompt: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBuilderPrompt),

  createCheckpoint: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.createCheckpoint),

  undoLastCheckpoint: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.undoLastCheckpoint),

  verifyCheckpoint: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.verifyCheckpoint),

  updateProviderSettings: (settings: Partial<ProviderSettings>): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateProviderSettings, settings),

  testProviderConnection: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.testProviderConnection),

  checkOllamaStatus: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.checkOllamaStatus),

  refreshInstalledModels: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.refreshInstalledModels),

  setRoleModelMapping: (
    roleKey: RoleModelMappingKey,
    modelName: string,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setRoleModelMapping, roleKey, modelName),

  suggestRoleModelDefaults: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.suggestRoleModelDefaults),

  askLocalAi: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.askLocalAi),

  setLocalAiRole: (role: LocalAiRoleId): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setLocalAiRole, role),

  setBuilderPlanIncludeExternal: (include: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBuilderPlanIncludeExternal, include),

  setBuilderPlanIncludeBuilderResult: (
    include: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setBuilderPlanIncludeBuilderResult,
      include,
    ),

  generateBuilderPlan: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBuilderPlan),

  recordCopyBuilderPlan: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBuilderPlan),

  recordCopyAdvisorResponse: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyAdvisorResponse),

  runSafeCheck: (kind: SafeCheckKind): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.runSafeCheck, kind),

  cancelSafeCheck: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelSafeCheck),

  recordCopyCommandOutput: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyCommandOutput),

  testQwenCli: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.testQwenCli),

  generateQwenPromptPack: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateQwenPromptPack),

  recordCopyQwenPromptPack: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyQwenPromptPack),

  recordCopyQwenReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyQwenReport),

  setExternalReviewSource: (source: ExternalReviewSource): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setExternalReviewSource, source),

  setExternalReviewDraft: (text: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setExternalReviewDraft, text),

  setExternalReviewLabel: (label: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setExternalReviewLabel, label),

  saveExternalReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveExternalReview),

  selectExternalReview: (reviewId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectExternalReview, reviewId),

  deleteExternalReview: (reviewId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteExternalReview, reviewId),

  clearExternalReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearExternalReview),

  recordCopyExternalReview: (reviewId?: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyExternalReview, reviewId),

  setBuilderResultSource: (source: BuilderResultSource): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBuilderResultSource, source),

  setBuilderResultResponseType: (
    responseType: BuilderResultResponseType,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBuilderResultResponseType, responseType),

  setBuilderResultDraft: (text: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBuilderResultDraft, text),

  setBuilderResultLabel: (label: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBuilderResultLabel, label),

  saveBuilderResult: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveBuilderResult),

  clearBuilderResult: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearBuilderResult),

  recordCopyBuilderResult: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBuilderResult),

  generateBuilderPlanComparison: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBuilderPlanComparison),

  recordCopyBuilderPlanComparison: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBuilderPlanComparison),

  generateImplementationReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateImplementationReview),

  recordCopyImplementationReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyImplementationReview),

  setSpeakerScriptRole: (role: SpeakerScriptRole): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setSpeakerScriptRole, role),

  setSpeakerScriptTone: (tone: SpeakerScriptTone): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setSpeakerScriptTone, tone),

  generateSpeakerScript: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateSpeakerScript),

  recordCopySpeakerScript: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopySpeakerScript),

  setBacklogDraftTitle: (title: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBacklogDraftTitle, title),

  setBacklogDraftType: (type: BacklogItemType): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBacklogDraftType, type),

  setBacklogDraftPriority: (priority: BacklogPriority): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBacklogDraftPriority, priority),

  setBacklogDraftStatus: (status: BacklogStatus): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBacklogDraftStatus, status),

  setBacklogDraftNotes: (notes: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBacklogDraftNotes, notes),

  setBacklogDraftRelatedStage: (stage: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBacklogDraftRelatedStage, stage),

  setBacklogFilters: (filters: Partial<BacklogFilters>): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBacklogFilters, filters),

  saveBacklogItem: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveBacklogItem),

  updateBacklogItem: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateBacklogItem),

  selectBacklogItem: (itemId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectBacklogItem, itemId),

  deleteBacklogItem: (itemId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteBacklogItem, itemId),

  recordCopyBacklogItem: (itemId?: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBacklogItem, itemId),

  generateBacklogReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBacklogReport),

  recordCopyBacklogReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBacklogReport),

  openRecentProject: (projectPath: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.openRecentProject, projectPath),

  clearRecentProjects: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearRecentProjects),

  clearProjectHistory: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearProjectHistory),

  saveSessionHistory: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveSessionHistory),

  generateProjectMemoryPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateProjectMemoryPreview),

  saveProjectMemoryFiles: (confirmOverwrite: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveProjectMemoryFiles, confirmOverwrite),

  recordCopyProjectMemoryBundle: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyProjectMemoryBundle),

  refreshCodeContextFileList: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.refreshCodeContextFileList),

  setCodeContextFilter: (query: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setCodeContextFilter, query),

  setCodeContextFileSelected: (
    relativePath: string,
    selected: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setCodeContextFileSelected, relativePath, selected),

  setCodeContextQuestion: (question: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setCodeContextQuestion, question),

  applyCodeQuestionTemplate: (
    templateId: string,
    mode?: "append" | "replace",
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.applyCodeQuestionTemplate, templateId, mode),

  clearCodeContextQuestion: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearCodeContextQuestion),

  setCodeContextMaxLinesPerFile: (maxLines: number): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setCodeContextMaxLinesPerFile, maxLines),

  setCodeContextMaxTotalChars: (maxChars: number): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setCodeContextMaxTotalChars, maxChars),

  clearCodeContextSelection: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearCodeContextSelection),

  generateCodeContextPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateCodeContextPreview),

  recordCopyCodeContextPack: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyCodeContextPack),

  askLocalAiAboutCodeContext: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.askLocalAiAboutCodeContext),

  recordCopyCodeContextAiResponse: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyCodeContextAiResponse),

  setPatchDraftIncludeCodeAi: (include: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setPatchDraftIncludeCodeAi, include),

  setPatchDraftIncludeBuilderPlanDecision: (include: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setPatchDraftIncludeBuilderPlanDecision,
      include,
    ),

  setPatchDraftIncludeImplementationReview: (include: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setPatchDraftIncludeImplementationReview,
      include,
    ),

  generatePatchDraft: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generatePatchDraft),

  recordCopyPatchDraft: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyPatchDraft),

  generatePatchDraftSafetyReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generatePatchDraftSafetyReview),

  recordCopyPatchDraftSafetyReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyPatchDraftSafetyReview),

  setPatchDraftSafetyReviewTarget: (
    target: import("../shared/types").PatchDraftSafetyReviewTargetKind,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setPatchDraftSafetyReviewTarget, target),

  setImportedPatchDraftSource: (
    source: import("../shared/types").ImportedPatchDraftSource,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setImportedPatchDraftSource, source),

  setImportedPatchDraftType: (
    draftType: import("../shared/types").ImportedPatchDraftType,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setImportedPatchDraftType, draftType),

  setImportedPatchDraftDraft: (draftText: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setImportedPatchDraftDraft, draftText),

  saveImportedPatchDraft: (allowSecretOverride?: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveImportedPatchDraft, allowSecretOverride),

  clearImportedPatchDraft: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearImportedPatchDraft),

  recordCopyImportedPatchDraft: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyImportedPatchDraft),

  generateExternalPatchDraftComparison: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateExternalPatchDraftComparison),

  recordCopyExternalPatchDraftComparison: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyExternalPatchDraftComparison),

  clearExternalPatchDraftComparison: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearExternalPatchDraftComparison),

  setBuilderHandoffTarget: (
    target: import("../shared/types").BuilderHandoffTarget,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBuilderHandoffTarget, target),

  setBuilderHandoffStrictness: (
    strictness: import("../shared/types").BuilderHandoffStrictness,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBuilderHandoffStrictness, strictness),

  generateBuilderHandoffExport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBuilderHandoffExport),

  recordCopyBuilderHandoffExport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBuilderHandoffExport),

  clearBuilderHandoffExport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearBuilderHandoffExport),

  setBlueprintIntake: (
    patch: Partial<import("../shared/types").BlueprintIntake>,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBlueprintIntake, patch),

  generateBlueprintPlannerQuestions: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBlueprintPlannerQuestions),

  generateBlueprintPlannerPrompt: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBlueprintPlannerPrompt),

  setBlueprintDraftSource: (
    source: import("../shared/blueprintConstants").BlueprintSource,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBlueprintDraftSource, source),

  setBlueprintDraftText: (text: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBlueprintDraftText, text),

  saveImportedBlueprint: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveImportedBlueprint),

  clearImportedBlueprint: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearImportedBlueprint),

  checkBlueprintCompleteness: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.checkBlueprintCompleteness),

  previewBlueprintPlanningDocuments: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.previewBlueprintPlanningDocuments),

  saveBlueprintPlanningDocuments: (
    confirmOverwrite: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.saveBlueprintPlanningDocuments,
      confirmOverwrite,
    ),

  generateBlueprintPhase1Handoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBlueprintPhase1Handoff),

  setBlueprintPreviewFile: (fileName: string | null): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBlueprintPreviewFile, fileName),

  recordCopyBlueprintPlannerQuestions: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBlueprintPlannerQuestions),

  recordCopyBlueprintPlannerPrompt: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBlueprintPlannerPrompt),

  recordCopyImportedBlueprint: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyImportedBlueprint),

  recordCopyBlueprintPhase1Handoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBlueprintPhase1Handoff),

  askLocalPlannerAi: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.askLocalPlannerAi),

  recordCopyBlueprintPlannerAiDraft: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBlueprintPlannerAiDraft),

  saveBlueprintPlannerDraftAsImported: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveBlueprintPlannerDraftAsImported),

  generateBlueprintPhaseTaskCards: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBlueprintPhaseTaskCards),

  clearBlueprintPhaseTaskCards: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearBlueprintPhaseTaskCards),

  setBlueprintPhaseTaskCardStatus: (
    taskId: string,
    status: import("../shared/blueprintTaskCardConstants").BlueprintPhaseTaskCardStatus,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setBlueprintPhaseTaskCardStatus,
      taskId,
      status,
    ),

  resetBlueprintPhaseTaskCardStatus: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.resetBlueprintPhaseTaskCardStatus, taskId),

  setBlueprintActivePhaseTaskCard: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setBlueprintActivePhaseTaskCard, taskId),

  recordCopyBlueprintPhaseTaskCard: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBlueprintPhaseTaskCard, taskId),

  recordCopyAllBlueprintPhaseTaskCards: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyAllBlueprintPhaseTaskCards),

  setTaskCardBuilderHandoffSelectedTask: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setTaskCardBuilderHandoffSelectedTask,
      taskId,
    ),

  setTaskCardBuilderHandoffTarget: (
    target: import("../shared/types").BuilderHandoffTarget,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setTaskCardBuilderHandoffTarget, target),

  setTaskCardBuilderHandoffStrictness: (
    strictness: import("../shared/types").BuilderHandoffStrictness,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setTaskCardBuilderHandoffStrictness,
      strictness,
    ),

  generateTaskCardBuilderHandoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateTaskCardBuilderHandoff),

  clearTaskCardBuilderHandoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearTaskCardBuilderHandoff),

  recordCopyTaskCardBuilderHandoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyTaskCardBuilderHandoff),

  setTaskImplementationIntakeSelectedTask: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setTaskImplementationIntakeSelectedTask, taskId),

  setTaskImplementationIntakeBuilderSource: (
    source: import("../shared/taskImplementationIntakeConstants").TaskImplementationBuilderSource,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setTaskImplementationIntakeBuilderSource, source),

  setTaskImplementationIntakeDraftText: (text: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setTaskImplementationIntakeDraftText, text),

  saveTaskImplementationReport: (allowSecretOverride?: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveTaskImplementationReport, allowSecretOverride),

  clearTaskImplementationReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearTaskImplementationReport),

  recordCopyTaskImplementationReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyTaskImplementationReport),

  markTaskImplementationReturned: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.markTaskImplementationReturned),

  markTaskImplementationReviewed: (
    confirmWithoutReview?: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.markTaskImplementationReviewed,
      confirmWithoutReview,
    ),

  stageTaskImplementationReportForReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.stageTaskImplementationReportForReview),

  generateBlueprintTaskReconciliation: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateBlueprintTaskReconciliation),

  clearBlueprintTaskReconciliation: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearBlueprintTaskReconciliation),

  recordCopyBlueprintTaskReconciliation: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyBlueprintTaskReconciliation),

  generateTaskArtifactIndex: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateTaskArtifactIndex),

  clearTaskArtifactIndex: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearTaskArtifactIndex),

  recordCopyTaskArtifactIndex: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyTaskArtifactIndex),

  setTaskArtifactIndexFilter: (taskId: string | null): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setTaskArtifactIndexFilter, taskId),

  setChangedFilesTaskLinkSelectedTask: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setChangedFilesTaskLinkSelectedTask, taskId),

  linkChangedFilesToTask: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.linkChangedFilesToTask),

  clearChangedFilesTaskLink: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearChangedFilesTaskLink),

  generateArchitectureHealthReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateArchitectureHealthReport),

  clearArchitectureHealthReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearArchitectureHealthReport),

  recordCopyArchitectureHealthReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyArchitectureHealthReport),

  setArchitectureHealthIncludeTestFiles: (include: boolean): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setArchitectureHealthIncludeTestFiles, include),

  setArchitectureHealthIncludeMarkdownDocs: (
    include: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureHealthIncludeMarkdownDocs,
      include,
    ),

  generateArchitectureRefactorTaskCards: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateArchitectureRefactorTaskCards),

  clearArchitectureRefactorTaskCards: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearArchitectureRefactorTaskCards),

  setArchitectureRefactorTaskCardStatus: (
    taskId: string,
    status: import("../shared/architectureRefactorTasks/architectureRefactorTaskConstants").ArchitectureRefactorTaskCardStatus,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureRefactorTaskCardStatus,
      taskId,
      status,
    ),

  resetArchitectureRefactorTaskCardStatus: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.resetArchitectureRefactorTaskCardStatus, taskId),

  recordCopyArchitectureRefactorTaskCard: (taskId: string): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyArchitectureRefactorTaskCard, taskId),

  recordCopyAllArchitectureRefactorTaskCards: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopyAllArchitectureRefactorTaskCards),

  setArchitectureRefactorTaskBuilderHandoffSelectedTask: (
    taskId: string,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureRefactorTaskBuilderHandoffSelectedTask,
      taskId,
    ),

  setArchitectureRefactorTaskBuilderHandoffTarget: (
    target: import("../shared/types").BuilderHandoffTarget,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureRefactorTaskBuilderHandoffTarget,
      target,
    ),

  setArchitectureRefactorTaskBuilderHandoffStrictness: (
    strictness: import("../shared/types").BuilderHandoffStrictness,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureRefactorTaskBuilderHandoffStrictness,
      strictness,
    ),

  generateArchitectureRefactorTaskBuilderHandoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateArchitectureRefactorTaskBuilderHandoff),

  clearArchitectureRefactorTaskBuilderHandoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearArchitectureRefactorTaskBuilderHandoff),

  recordCopyArchitectureRefactorTaskBuilderHandoff: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.recordCopyArchitectureRefactorTaskBuilderHandoff,
    ),

  setArchitectureRefactorTaskImplementationIntakeSelectedTask: (
    taskId: string,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureRefactorTaskImplementationIntakeSelectedTask,
      taskId,
    ),

  setArchitectureRefactorTaskImplementationIntakeBuilderSource: (
    source: import("../shared/architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants").ArchitectureRefactorImplementationBuilderSource,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureRefactorTaskImplementationIntakeBuilderSource,
      source,
    ),

  setArchitectureRefactorTaskImplementationIntakeDraftText: (
    text: string,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setArchitectureRefactorTaskImplementationIntakeDraftText,
      text,
    ),

  saveArchitectureRefactorTaskImplementationReport: (
    allowSecretOverride?: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.saveArchitectureRefactorTaskImplementationReport,
      allowSecretOverride,
    ),

  clearArchitectureRefactorTaskImplementationReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.clearArchitectureRefactorTaskImplementationReport,
    ),

  recordCopyArchitectureRefactorTaskImplementationReport: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.recordCopyArchitectureRefactorTaskImplementationReport,
    ),

  markArchitectureRefactorTaskImplementationReturned: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.markArchitectureRefactorTaskImplementationReturned,
    ),

  markArchitectureRefactorTaskImplementationReviewed: (
    confirmWithoutReview?: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.markArchitectureRefactorTaskImplementationReviewed,
      confirmWithoutReview,
    ),

  stageArchitectureRefactorTaskImplementationReportForReview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.stageArchitectureRefactorTaskImplementationReportForReview,
    ),

  selectSafeScaffoldTargetFolder: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectSafeScaffoldTargetFolder),

  clearSafeScaffoldTargetFolder: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearSafeScaffoldTargetFolder),

  refreshSafeScaffoldTargetSafety: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.refreshSafeScaffoldTargetSafety),

  generateSafeScaffoldFileTreePreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateSafeScaffoldFileTreePreview),

  clearSafeScaffoldFileTreePreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearSafeScaffoldFileTreePreview),

  recordCopySafeScaffoldFileTreePreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopySafeScaffoldFileTreePreview),

  generateSafeScaffoldFileContentPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateSafeScaffoldFileContentPreview),

  clearSafeScaffoldFileContentPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearSafeScaffoldFileContentPreview),

  recordCopySafeScaffoldFileContentPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopySafeScaffoldFileContentPreview),

  generateSafeScaffoldWriteManifestPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.generateSafeScaffoldWriteManifestPreview),

  clearSafeScaffoldWriteManifestPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.clearSafeScaffoldWriteManifestPreview),

  recordCopySafeScaffoldWriteManifestPreview: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.recordCopySafeScaffoldWriteManifestPreview),

  setPlanningStyle: (
    style: import("../shared/types").PlanningStyleId,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.setPlanningStyle, style),

  setReportsPanelCollapsed: (
    panelId: string,
    collapsed: boolean,
  ): Promise<AppSnapshot> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setReportsPanelCollapsed,
      panelId,
      collapsed,
    ),

  applyFastDraftSetup: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.applyFastDraftSetup),

  onSnapshotUpdated: (callback: (snapshot: AppSnapshot) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, snapshot: AppSnapshot) => {
      callback(snapshot);
    };
    ipcRenderer.on(IPC_CHANNELS.subscribeSnapshot, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.subscribeSnapshot, listener);
    };
  },
};

contextBridge.exposeInMainWorld("nttc", api);
