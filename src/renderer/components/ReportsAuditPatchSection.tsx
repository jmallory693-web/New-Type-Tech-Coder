import { ManualPatchDraftImportPanel } from "./ManualPatchDraftImportPanel";
import { ExternalPatchDraftComparisonPanel } from "./ExternalPatchDraftComparisonPanel";
import { BuilderHandoffExportPanel } from "./BuilderHandoffExportPanel";
import { ReportsWorkflowSection } from "./ReportsWorkflowSection";
import {
  ChangedFilesPanel,
  CodeContextAiPanel,
  CodeContextPanel,
  PatchDraftPanel,
  PatchDraftSafetyReviewPanel,
} from "./reportsAuditPatchPanels";
import type { ReportsAuditPatchSectionProps } from "./reportsAuditPatchSectionProps";

/** Stage 115: audit/patch Reports shell extracted from App.tsx (rendering/container wiring only). */
export function ReportsAuditPatchSection(props: ReportsAuditPatchSectionProps) {
  const {
    hasProject,
    providerReady,
    planningStyle,
    localAiProgress,
    codeContext,
    codeContextAi,
    patchDraft,
    patchDraftSafetyReview,
    importedPatchDraft,
    externalPatchDraftComparison,
    builderHandoffExport,
    changedFiles,
    phaseTaskCardsSaved,
    codeContextFilterDraft,
    codeContextQuestionDraft,
    codeContextMaxLinesDraft,
    codeContextMaxCharsDraft,
    importedPatchDraftDraft,
    refreshingCodeContext,
    generatingCodeContext,
    generatingPatchDraftSafetyReview,
    generatingExternalPatchDraftComparison,
    generatingBuilderHandoffExport,
    scanningChangedFiles,
    generatingPatchPack,
    codeContextCopyState,
    codeContextAiCopyState,
    patchDraftCopyState,
    importedPatchDraftCopyState,
    patchDraftSafetyReviewCopyState,
    externalPatchDraftComparisonCopyState,
    builderHandoffExportCopyState,
    patchCopyState,
    codeContextReviewModelLabel,
    codeContextReviewModelSourceLabel,
    patchDraftModelLabel,
    patchDraftModelSourceLabel,
    hasCodeAiResponse,
    hasBuilderPlanOrDecision,
    hasImplementationReview,
    recentPatchDraftFailure,
    safetyBackupVerified,
    isPanelCollapsed,
    onTogglePanel,
    onCodeContextFilterChange,
    onCodeContextQuestionChange,
    onApplyCodeQuestionTemplate,
    onClearCodeContextQuestion,
    onCodeContextMaxLinesChange,
    onCodeContextMaxCharsChange,
    onRefreshCodeContextFileList,
    onGenerateCodeContextPreview,
    onClearCodeContextSelection,
    onToggleCodeContextFile,
    onCopyCodeContextPack,
    onAskLocalAiAboutCodeContext,
    onCopyCodeContextAiResponse,
    onOpenRoleHelp,
    onTogglePatchDraftIncludeCodeAi,
    onTogglePatchDraftIncludeBuilderPlanDecision,
    onTogglePatchDraftIncludeImplementationReview,
    onGeneratePatchDraft,
    onCopyPatchDraft,
    onApplyFastDraftSetup,
    onImportedPatchDraftSourceChange,
    onImportedPatchDraftTypeChange,
    onImportedPatchDraftDraftChange,
    onSaveImportedPatchDraft,
    onClearImportedPatchDraft,
    onCopyImportedPatchDraft,
    onPatchDraftSafetyReviewTargetChange,
    onGeneratePatchDraftSafetyReview,
    onCopyPatchDraftSafetyReview,
    onGenerateExternalPatchDraftComparison,
    onCopyExternalPatchDraftComparison,
    onClearExternalPatchDraftComparison,
    onBuilderHandoffTargetChange,
    onBuilderHandoffStrictnessChange,
    onGenerateBuilderHandoffExport,
    onCopyBuilderHandoffExport,
    onClearBuilderHandoffExport,
    onScanChangedFiles,
    onGeneratePatchReviewPack,
    onCopyPatchReviewPack,
    onChangedFilesTaskLinkSelect,
    onLinkChangedFilesToTask,
    onClearChangedFilesTaskLink,
  } = props;

  return (
    <>
      <ReportsWorkflowSection
        panelId="code-context-pack"
        title="Code Context Pack — Preview Only"
        collapsed={isPanelCollapsed("code-context-pack")}
        onToggle={(collapsed) => onTogglePanel("code-context-pack", collapsed)}
      >
        <CodeContextPanel
          codeContext={codeContext}
          hasProject={hasProject}
          filterDraft={codeContextFilterDraft}
          onFilterChange={onCodeContextFilterChange}
          questionDraft={codeContextQuestionDraft}
          onQuestionChange={onCodeContextQuestionChange}
          onApplyTemplate={onApplyCodeQuestionTemplate}
          onClearQuestion={onClearCodeContextQuestion}
          maxLinesDraft={codeContextMaxLinesDraft}
          onMaxLinesChange={onCodeContextMaxLinesChange}
          maxCharsDraft={codeContextMaxCharsDraft}
          onMaxCharsChange={onCodeContextMaxCharsChange}
          refreshing={refreshingCodeContext}
          generating={generatingCodeContext}
          onRefresh={onRefreshCodeContextFileList}
          onGenerate={onGenerateCodeContextPreview}
          onClearSelection={onClearCodeContextSelection}
          onToggleFile={onToggleCodeContextFile}
          onCopy={onCopyCodeContextPack}
          copyState={codeContextCopyState}
        />
      </ReportsWorkflowSection>

      <div className="section-divider" />

      <ReportsWorkflowSection
        panelId="code-context-ai"
        title="Ask Local AI About Selected Code"
        collapsed={isPanelCollapsed("code-context-ai")}
        onToggle={(collapsed) => onTogglePanel("code-context-ai", collapsed)}
      >
        <CodeContextAiPanel
          codeContext={codeContext}
          codeContextAi={codeContextAi}
          providerReady={providerReady}
          modelLabel={codeContextReviewModelLabel}
          modelSourceLabel={codeContextReviewModelSourceLabel}
          copyState={codeContextAiCopyState}
          onAsk={onAskLocalAiAboutCodeContext}
          onCopy={onCopyCodeContextAiResponse}
          onOpenRoleHelp={onOpenRoleHelp}
          localAiProgress={localAiProgress}
        />
      </ReportsWorkflowSection>

      <div className="section-divider" />

      <ReportsWorkflowSection
        panelId="patch-draft-mode"
        title="Patch Draft Mode — No Apply"
        collapsed={isPanelCollapsed("patch-draft-mode")}
        onToggle={(collapsed) => onTogglePanel("patch-draft-mode", collapsed)}
      >
        <PatchDraftPanel
          codeContext={codeContext}
          patchDraft={patchDraft}
          providerReady={providerReady}
          modelLabel={patchDraftModelLabel}
          modelSourceLabel={patchDraftModelSourceLabel}
          copyState={patchDraftCopyState}
          hasCodeAiResponse={hasCodeAiResponse}
          hasBuilderPlanOrDecision={hasBuilderPlanOrDecision}
          hasImplementationReview={hasImplementationReview}
          onToggleCodeAi={onTogglePatchDraftIncludeCodeAi}
          onToggleBuilderPlanDecision={onTogglePatchDraftIncludeBuilderPlanDecision}
          onToggleImplementationReview={
            onTogglePatchDraftIncludeImplementationReview
          }
          onGenerate={onGeneratePatchDraft}
          onCopy={onCopyPatchDraft}
          onOpenRoleHelp={onOpenRoleHelp}
          onFastDraftSetup={onApplyFastDraftSetup}
          localAiProgress={localAiProgress}
          planningStyle={planningStyle}
        />
      </ReportsWorkflowSection>

      <div className="section-divider" />

      <ReportsWorkflowSection
        panelId="manual-patch-draft-import"
        title="Manual Patch Draft Import"
        collapsed={isPanelCollapsed("manual-patch-draft-import")}
        onToggle={(collapsed) =>
          onTogglePanel("manual-patch-draft-import", collapsed)
        }
      >
        <ManualPatchDraftImportPanel
          importedPatchDraft={{
            ...importedPatchDraft,
            draftText: importedPatchDraftDraft,
          }}
          copyState={importedPatchDraftCopyState}
          onSourceChange={onImportedPatchDraftSourceChange}
          onDraftTypeChange={onImportedPatchDraftTypeChange}
          onDraftChange={onImportedPatchDraftDraftChange}
          onSave={onSaveImportedPatchDraft}
          onClearSaved={onClearImportedPatchDraft}
          onCopy={onCopyImportedPatchDraft}
        />
      </ReportsWorkflowSection>

      <div className="section-divider" />

      <ReportsWorkflowSection
        panelId="patch-draft-safety-review"
        title="Patch Draft Safety Review"
        collapsed={isPanelCollapsed("patch-draft-safety-review")}
        onToggle={(collapsed) =>
          onTogglePanel("patch-draft-safety-review", collapsed)
        }
      >
        <PatchDraftSafetyReviewPanel
          review={patchDraftSafetyReview}
          hasNttcPatchDraft={Boolean(patchDraft.saved)}
          hasImportedPatchDraft={Boolean(importedPatchDraft.saved)}
          recentPatchDraftFailure={recentPatchDraftFailure}
          generating={generatingPatchDraftSafetyReview}
          copyState={patchDraftSafetyReviewCopyState}
          onReviewTargetChange={onPatchDraftSafetyReviewTargetChange}
          onGenerate={onGeneratePatchDraftSafetyReview}
          onCopy={onCopyPatchDraftSafetyReview}
          planningStyle={planningStyle}
        />
      </ReportsWorkflowSection>

      <div className="section-divider" />

      <ReportsWorkflowSection
        panelId="external-patch-draft-comparison"
        title="External Patch Draft Comparison"
        collapsed={isPanelCollapsed("external-patch-draft-comparison")}
        onToggle={(collapsed) =>
          onTogglePanel("external-patch-draft-comparison", collapsed)
        }
      >
        <ExternalPatchDraftComparisonPanel
          comparison={externalPatchDraftComparison}
          patchDraft={patchDraft}
          importedPatchDraft={importedPatchDraft}
          safetyBackupVerified={safetyBackupVerified}
          patchDraftSafetyReviewExists={Boolean(patchDraftSafetyReview.saved)}
          generating={generatingExternalPatchDraftComparison}
          copyState={externalPatchDraftComparisonCopyState}
          onGenerate={onGenerateExternalPatchDraftComparison}
          onCopy={onCopyExternalPatchDraftComparison}
          onClear={onClearExternalPatchDraftComparison}
          planningStyle={planningStyle}
        />
      </ReportsWorkflowSection>

      <div className="section-divider" />

      <ReportsWorkflowSection
        panelId="builder-handoff-export"
        title="Builder Handoff Export"
        collapsed={isPanelCollapsed("builder-handoff-export")}
        onToggle={(collapsed) =>
          onTogglePanel("builder-handoff-export", collapsed)
        }
      >
        <BuilderHandoffExportPanel
          handoff={builderHandoffExport}
          patchDraft={patchDraft}
          importedPatchDraft={importedPatchDraft}
          patchDraftSafetyReview={patchDraftSafetyReview}
          externalPatchDraftComparison={externalPatchDraftComparison}
          safetyBackupVerified={safetyBackupVerified}
          generating={generatingBuilderHandoffExport}
          copyState={builderHandoffExportCopyState}
          onTargetChange={onBuilderHandoffTargetChange}
          onStrictnessChange={onBuilderHandoffStrictnessChange}
          onGenerate={onGenerateBuilderHandoffExport}
          onCopy={onCopyBuilderHandoffExport}
          onClear={onClearBuilderHandoffExport}
          planningStyle={planningStyle}
        />
      </ReportsWorkflowSection>

      <div className="section-divider" />

      <div data-focus-id="changed-files">
        <ChangedFilesPanel
          changedFiles={changedFiles}
          taskCards={phaseTaskCardsSaved}
          hasProject={hasProject}
          scanning={scanningChangedFiles || changedFiles.busy}
          generatingPack={generatingPatchPack}
          onScan={onScanChangedFiles}
          onGeneratePack={onGeneratePatchReviewPack}
          onCopyPack={onCopyPatchReviewPack}
          onSelectTaskLink={onChangedFilesTaskLinkSelect}
          onLinkTask={onLinkChangedFilesToTask}
          onClearTaskLink={onClearChangedFilesTaskLink}
          copyState={patchCopyState}
        />
      </div>
    </>
  );
}
