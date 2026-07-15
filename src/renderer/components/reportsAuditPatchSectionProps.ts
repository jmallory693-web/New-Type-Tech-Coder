import type {
  BlueprintPhaseTaskCardsRecord,
  BuilderHandoffExportState,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
  ChangedFilesState,
  CodeContextAiState,
  CodeContextState,
  ExternalPatchDraftComparisonState,
  ImportedPatchDraftSource,
  ImportedPatchDraftState,
  ImportedPatchDraftType,
  LocalAiProgressState,
  PatchDraftSafetyReviewState,
  PatchDraftSafetyReviewTargetKind,
  PatchDraftState,
  PlanningStyleId,
} from "../../shared/types";
import type { RoleHelpKey } from "../../shared/localAiRoles";
import type { WorkflowPanelId } from "../../shared/workflowGuidance";

export type ReportsAuditPatchCopyState = "idle" | "copied" | "failed";

export type ReportsAuditPatchSectionProps = {
  hasProject: boolean;
  providerReady: boolean;
  planningStyle: PlanningStyleId;
  localAiProgress: LocalAiProgressState | null;
  codeContext: CodeContextState;
  codeContextAi: CodeContextAiState;
  patchDraft: PatchDraftState;
  patchDraftSafetyReview: PatchDraftSafetyReviewState;
  importedPatchDraft: ImportedPatchDraftState;
  externalPatchDraftComparison: ExternalPatchDraftComparisonState;
  builderHandoffExport: BuilderHandoffExportState;
  changedFiles: ChangedFilesState;
  phaseTaskCardsSaved: BlueprintPhaseTaskCardsRecord | null;
  codeContextFilterDraft: string;
  codeContextQuestionDraft: string;
  codeContextMaxLinesDraft: number;
  codeContextMaxCharsDraft: number;
  importedPatchDraftDraft: string;
  refreshingCodeContext: boolean;
  generatingCodeContext: boolean;
  generatingPatchDraftSafetyReview: boolean;
  generatingExternalPatchDraftComparison: boolean;
  generatingBuilderHandoffExport: boolean;
  scanningChangedFiles: boolean;
  generatingPatchPack: boolean;
  codeContextCopyState: ReportsAuditPatchCopyState;
  codeContextAiCopyState: ReportsAuditPatchCopyState;
  patchDraftCopyState: ReportsAuditPatchCopyState;
  importedPatchDraftCopyState: ReportsAuditPatchCopyState;
  patchDraftSafetyReviewCopyState: ReportsAuditPatchCopyState;
  externalPatchDraftComparisonCopyState: ReportsAuditPatchCopyState;
  builderHandoffExportCopyState: ReportsAuditPatchCopyState;
  patchCopyState: ReportsAuditPatchCopyState;
  codeContextReviewModelLabel: string;
  codeContextReviewModelSourceLabel: string;
  patchDraftModelLabel: string;
  patchDraftModelSourceLabel: string;
  hasCodeAiResponse: boolean;
  hasBuilderPlanOrDecision: boolean;
  hasImplementationReview: boolean;
  recentPatchDraftFailure: boolean;
  safetyBackupVerified: boolean;
  isPanelCollapsed: (panelId: WorkflowPanelId) => boolean;
  onTogglePanel: (panelId: WorkflowPanelId, collapsed: boolean) => void;
  onCodeContextFilterChange: (value: string) => void;
  onCodeContextQuestionChange: (value: string) => void;
  onApplyCodeQuestionTemplate: (
    templateId: string,
    mode?: "append" | "replace",
  ) => void;
  onClearCodeContextQuestion: () => void;
  onCodeContextMaxLinesChange: (value: number) => void;
  onCodeContextMaxCharsChange: (value: number) => void;
  onRefreshCodeContextFileList: () => void;
  onGenerateCodeContextPreview: () => void;
  onClearCodeContextSelection: () => void;
  onToggleCodeContextFile: (path: string, selected: boolean) => void;
  onCopyCodeContextPack: () => void;
  onAskLocalAiAboutCodeContext: () => void;
  onCopyCodeContextAiResponse: () => void;
  onOpenRoleHelp: (key: RoleHelpKey) => void;
  onTogglePatchDraftIncludeCodeAi: (include: boolean) => void;
  onTogglePatchDraftIncludeBuilderPlanDecision: (include: boolean) => void;
  onTogglePatchDraftIncludeImplementationReview: (include: boolean) => void;
  onGeneratePatchDraft: () => void;
  onCopyPatchDraft: () => void;
  onApplyFastDraftSetup: () => void;
  onImportedPatchDraftSourceChange: (source: ImportedPatchDraftSource) => void;
  onImportedPatchDraftTypeChange: (draftType: ImportedPatchDraftType) => void;
  onImportedPatchDraftDraftChange: (text: string) => void;
  onSaveImportedPatchDraft: () => void;
  onClearImportedPatchDraft: () => void;
  onCopyImportedPatchDraft: () => void;
  onPatchDraftSafetyReviewTargetChange: (
    target: PatchDraftSafetyReviewTargetKind,
  ) => void;
  onGeneratePatchDraftSafetyReview: () => void;
  onCopyPatchDraftSafetyReview: () => void;
  onGenerateExternalPatchDraftComparison: () => void;
  onCopyExternalPatchDraftComparison: () => void;
  onClearExternalPatchDraftComparison: () => void;
  onBuilderHandoffTargetChange: (target: BuilderHandoffTarget) => void;
  onBuilderHandoffStrictnessChange: (strictness: BuilderHandoffStrictness) => void;
  onGenerateBuilderHandoffExport: () => void;
  onCopyBuilderHandoffExport: () => void;
  onClearBuilderHandoffExport: () => void;
  onScanChangedFiles: () => void;
  onGeneratePatchReviewPack: () => void;
  onCopyPatchReviewPack: () => void;
  onChangedFilesTaskLinkSelect: (taskId: string) => void;
  onLinkChangedFilesToTask: () => void;
  onClearChangedFilesTaskLink: () => void;
};

export type ReportsAuditPatchSectionHandlers = {
  setReportsPanelCollapsed: (
    panelId: WorkflowPanelId,
    collapsed: boolean,
  ) => void | Promise<void>;
  codeContextFilterChange: (value: string) => void;
  codeContextQuestionChange: (value: string) => void;
  applyCodeQuestionTemplate: (
    templateId: string,
    mode?: "append" | "replace",
  ) => void | Promise<void>;
  clearCodeContextQuestion: () => void | Promise<void>;
  codeContextMaxLinesChange: (value: number) => void | Promise<void>;
  codeContextMaxCharsChange: (value: number) => void | Promise<void>;
  refreshCodeContextFileList: () => void | Promise<void>;
  generateCodeContextPreview: () => void | Promise<void>;
  clearCodeContextSelection: () => void | Promise<void>;
  toggleCodeContextFile: (path: string, selected: boolean) => void | Promise<void>;
  copyCodeContextPack: () => void | Promise<void>;
  askLocalAiAboutCodeContext: () => void | Promise<void>;
  copyCodeContextAiResponse: () => void | Promise<void>;
  openRoleHelp: (key: RoleHelpKey) => void;
  togglePatchDraftIncludeCodeAi: (include: boolean) => void | Promise<void>;
  togglePatchDraftIncludeBuilderPlanDecision: (
    include: boolean,
  ) => void | Promise<void>;
  togglePatchDraftIncludeImplementationReview: (
    include: boolean,
  ) => void | Promise<void>;
  generatePatchDraft: () => void | Promise<void>;
  copyPatchDraft: () => void | Promise<void>;
  applyFastDraftSetup: () => void | Promise<void>;
  importedPatchDraftSourceChange: (
    source: ImportedPatchDraftSource,
  ) => void | Promise<void>;
  importedPatchDraftTypeChange: (
    draftType: ImportedPatchDraftType,
  ) => void | Promise<void>;
  importedPatchDraftDraftChange: (text: string) => void;
  saveImportedPatchDraft: () => void | Promise<void>;
  clearImportedPatchDraft: () => void | Promise<void>;
  copyImportedPatchDraft: () => void | Promise<void>;
  patchDraftSafetyReviewTargetChange: (
    target: PatchDraftSafetyReviewTargetKind,
  ) => void | Promise<void>;
  generatePatchDraftSafetyReview: () => void | Promise<void>;
  copyPatchDraftSafetyReview: () => void | Promise<void>;
  generateExternalPatchDraftComparison: () => void | Promise<void>;
  copyExternalPatchDraftComparison: () => void | Promise<void>;
  clearExternalPatchDraftComparison: () => void | Promise<void>;
  builderHandoffTargetChange: (target: BuilderHandoffTarget) => void | Promise<void>;
  builderHandoffStrictnessChange: (
    strictness: BuilderHandoffStrictness,
  ) => void | Promise<void>;
  generateBuilderHandoffExport: () => void | Promise<void>;
  copyBuilderHandoffExport: () => void | Promise<void>;
  clearBuilderHandoffExport: () => void | Promise<void>;
  scanChangedFiles: () => void | Promise<void>;
  generatePatchReviewPack: () => void | Promise<void>;
  copyPatchReviewPack: () => void | Promise<void>;
  changedFilesTaskLinkSelect: (taskId: string) => void | Promise<void>;
  linkChangedFilesToTask: () => void | Promise<void>;
  clearChangedFilesTaskLink: () => void | Promise<void>;
};

export type BuildReportsAuditPatchSectionPropsInput = {
  hasProject: boolean;
  providerReady: boolean;
  planningStyle: PlanningStyleId;
  localAiProgress: LocalAiProgressState | null;
  codeContext: CodeContextState;
  codeContextAi: CodeContextAiState;
  patchDraft: PatchDraftState;
  patchDraftSafetyReview: PatchDraftSafetyReviewState;
  importedPatchDraft: ImportedPatchDraftState;
  externalPatchDraftComparison: ExternalPatchDraftComparisonState;
  builderHandoffExport: BuilderHandoffExportState;
  changedFiles: ChangedFilesState;
  phaseTaskCardsSaved: BlueprintPhaseTaskCardsRecord | null;
  codeContextFilterDraft: string;
  codeContextQuestionDraft: string;
  codeContextMaxLinesDraft: number;
  codeContextMaxCharsDraft: number;
  importedPatchDraftDraft: string;
  refreshingCodeContext: boolean;
  generatingCodeContext: boolean;
  generatingPatchDraftSafetyReview: boolean;
  generatingExternalPatchDraftComparison: boolean;
  generatingBuilderHandoffExport: boolean;
  scanningChangedFiles: boolean;
  generatingPatchPack: boolean;
  codeContextCopyState: ReportsAuditPatchCopyState;
  codeContextAiCopyState: ReportsAuditPatchCopyState;
  patchDraftCopyState: ReportsAuditPatchCopyState;
  importedPatchDraftCopyState: ReportsAuditPatchCopyState;
  patchDraftSafetyReviewCopyState: ReportsAuditPatchCopyState;
  externalPatchDraftComparisonCopyState: ReportsAuditPatchCopyState;
  builderHandoffExportCopyState: ReportsAuditPatchCopyState;
  patchCopyState: ReportsAuditPatchCopyState;
  codeContextReviewModelLabel: string;
  codeContextReviewModelSourceLabel: string;
  patchDraftModelLabel: string;
  patchDraftModelSourceLabel: string;
  hasCodeAiResponse: boolean;
  hasBuilderPlanOrDecision: boolean;
  hasImplementationReview: boolean;
  recentPatchDraftFailure: boolean;
  safetyBackupVerified: boolean;
  isPanelCollapsed: (panelId: WorkflowPanelId) => boolean;
  handlers: ReportsAuditPatchSectionHandlers;
};

/** Stage 115: pure prop assembly for ReportsAuditPatchSection (no IPC, no React state). */
export function buildReportsAuditPatchSectionProps(
  input: BuildReportsAuditPatchSectionPropsInput,
): ReportsAuditPatchSectionProps {
  const handlers = input.handlers;

  return {
    hasProject: input.hasProject,
    providerReady: input.providerReady,
    planningStyle: input.planningStyle,
    localAiProgress: input.localAiProgress,
    codeContext: input.codeContext,
    codeContextAi: input.codeContextAi,
    patchDraft: input.patchDraft,
    patchDraftSafetyReview: input.patchDraftSafetyReview,
    importedPatchDraft: input.importedPatchDraft,
    externalPatchDraftComparison: input.externalPatchDraftComparison,
    builderHandoffExport: input.builderHandoffExport,
    changedFiles: input.changedFiles,
    phaseTaskCardsSaved: input.phaseTaskCardsSaved,
    codeContextFilterDraft: input.codeContextFilterDraft,
    codeContextQuestionDraft: input.codeContextQuestionDraft,
    codeContextMaxLinesDraft: input.codeContextMaxLinesDraft,
    codeContextMaxCharsDraft: input.codeContextMaxCharsDraft,
    importedPatchDraftDraft: input.importedPatchDraftDraft,
    refreshingCodeContext: input.refreshingCodeContext,
    generatingCodeContext: input.generatingCodeContext,
    generatingPatchDraftSafetyReview: input.generatingPatchDraftSafetyReview,
    generatingExternalPatchDraftComparison:
      input.generatingExternalPatchDraftComparison,
    generatingBuilderHandoffExport: input.generatingBuilderHandoffExport,
    scanningChangedFiles: input.scanningChangedFiles,
    generatingPatchPack: input.generatingPatchPack,
    codeContextCopyState: input.codeContextCopyState,
    codeContextAiCopyState: input.codeContextAiCopyState,
    patchDraftCopyState: input.patchDraftCopyState,
    importedPatchDraftCopyState: input.importedPatchDraftCopyState,
    patchDraftSafetyReviewCopyState: input.patchDraftSafetyReviewCopyState,
    externalPatchDraftComparisonCopyState:
      input.externalPatchDraftComparisonCopyState,
    builderHandoffExportCopyState: input.builderHandoffExportCopyState,
    patchCopyState: input.patchCopyState,
    codeContextReviewModelLabel: input.codeContextReviewModelLabel,
    codeContextReviewModelSourceLabel: input.codeContextReviewModelSourceLabel,
    patchDraftModelLabel: input.patchDraftModelLabel,
    patchDraftModelSourceLabel: input.patchDraftModelSourceLabel,
    hasCodeAiResponse: input.hasCodeAiResponse,
    hasBuilderPlanOrDecision: input.hasBuilderPlanOrDecision,
    hasImplementationReview: input.hasImplementationReview,
    recentPatchDraftFailure: input.recentPatchDraftFailure,
    safetyBackupVerified: input.safetyBackupVerified,
    isPanelCollapsed: input.isPanelCollapsed,
    onTogglePanel: (panelId, collapsed) =>
      void handlers.setReportsPanelCollapsed(panelId, collapsed),
    onCodeContextFilterChange: handlers.codeContextFilterChange,
    onCodeContextQuestionChange: handlers.codeContextQuestionChange,
    onApplyCodeQuestionTemplate: (templateId, mode) =>
      void handlers.applyCodeQuestionTemplate(templateId, mode),
    onClearCodeContextQuestion: () => void handlers.clearCodeContextQuestion(),
    onCodeContextMaxLinesChange: (value) =>
      void handlers.codeContextMaxLinesChange(value),
    onCodeContextMaxCharsChange: (value) =>
      void handlers.codeContextMaxCharsChange(value),
    onRefreshCodeContextFileList: () => void handlers.refreshCodeContextFileList(),
    onGenerateCodeContextPreview: () => void handlers.generateCodeContextPreview(),
    onClearCodeContextSelection: () => void handlers.clearCodeContextSelection(),
    onToggleCodeContextFile: (path, selected) =>
      void handlers.toggleCodeContextFile(path, selected),
    onCopyCodeContextPack: () => void handlers.copyCodeContextPack(),
    onAskLocalAiAboutCodeContext: () =>
      void handlers.askLocalAiAboutCodeContext(),
    onCopyCodeContextAiResponse: () => void handlers.copyCodeContextAiResponse(),
    onOpenRoleHelp: handlers.openRoleHelp,
    onTogglePatchDraftIncludeCodeAi: (include) =>
      void handlers.togglePatchDraftIncludeCodeAi(include),
    onTogglePatchDraftIncludeBuilderPlanDecision: (include) =>
      void handlers.togglePatchDraftIncludeBuilderPlanDecision(include),
    onTogglePatchDraftIncludeImplementationReview: (include) =>
      void handlers.togglePatchDraftIncludeImplementationReview(include),
    onGeneratePatchDraft: () => void handlers.generatePatchDraft(),
    onCopyPatchDraft: () => void handlers.copyPatchDraft(),
    onApplyFastDraftSetup: () => void handlers.applyFastDraftSetup(),
    onImportedPatchDraftSourceChange: (source) =>
      void handlers.importedPatchDraftSourceChange(source),
    onImportedPatchDraftTypeChange: (draftType) =>
      void handlers.importedPatchDraftTypeChange(draftType),
    onImportedPatchDraftDraftChange: handlers.importedPatchDraftDraftChange,
    onSaveImportedPatchDraft: () => void handlers.saveImportedPatchDraft(),
    onClearImportedPatchDraft: () => void handlers.clearImportedPatchDraft(),
    onCopyImportedPatchDraft: () => void handlers.copyImportedPatchDraft(),
    onPatchDraftSafetyReviewTargetChange: (target) =>
      void handlers.patchDraftSafetyReviewTargetChange(target),
    onGeneratePatchDraftSafetyReview: () =>
      void handlers.generatePatchDraftSafetyReview(),
    onCopyPatchDraftSafetyReview: () => void handlers.copyPatchDraftSafetyReview(),
    onGenerateExternalPatchDraftComparison: () =>
      void handlers.generateExternalPatchDraftComparison(),
    onCopyExternalPatchDraftComparison: () =>
      void handlers.copyExternalPatchDraftComparison(),
    onClearExternalPatchDraftComparison: () =>
      void handlers.clearExternalPatchDraftComparison(),
    onBuilderHandoffTargetChange: (target) =>
      void handlers.builderHandoffTargetChange(target),
    onBuilderHandoffStrictnessChange: (strictness) =>
      void handlers.builderHandoffStrictnessChange(strictness),
    onGenerateBuilderHandoffExport: () =>
      void handlers.generateBuilderHandoffExport(),
    onCopyBuilderHandoffExport: () => void handlers.copyBuilderHandoffExport(),
    onClearBuilderHandoffExport: () => void handlers.clearBuilderHandoffExport(),
    onScanChangedFiles: () => void handlers.scanChangedFiles(),
    onGeneratePatchReviewPack: () => void handlers.generatePatchReviewPack(),
    onCopyPatchReviewPack: () => void handlers.copyPatchReviewPack(),
    onChangedFilesTaskLinkSelect: (taskId) =>
      void handlers.changedFilesTaskLinkSelect(taskId),
    onLinkChangedFilesToTask: () => void handlers.linkChangedFilesToTask(),
    onClearChangedFilesTaskLink: () => void handlers.clearChangedFilesTaskLink(),
  };
}
