import { ArchitectureHealthPanel } from "./ArchitectureHealthPanel";
import { ArchitectureRefactorTaskBuilderHandoffPanel } from "./ArchitectureRefactorTaskBuilderHandoffPanel";
import { ArchitectureRefactorTaskCardsPanel } from "./ArchitectureRefactorTaskCardsPanel";
import { ArchitectureRefactorTaskImplementationIntakePanel } from "./ArchitectureRefactorTaskImplementationIntakePanel";
import type { ReportsArchitectureSectionProps } from "./reportsArchitectureSectionProps";

export type { ReportsArchitectureSectionProps } from "./reportsArchitectureSectionProps";

export function ReportsArchitectureSection(props: ReportsArchitectureSectionProps) {
  const {
    hasProject,
    architectureHealth,
    architectureRefactorTaskCards,
    architectureRefactorTaskCardsSaved,
    architectureRefactorTaskBuilderHandoff,
    architectureRefactorTaskImplementationIntake,
    architectureRefactorReportStatusByTaskId,
    architectureRefactorImplIntakeDraft,
    architectureHealthCopyState,
    architectureRefactorCopyAllState,
    architectureRefactorCopyTaskState,
    architectureRefactorHandoffCopyState,
    architectureRefactorImplIntakeCopyState,
    onGenerateArchitectureHealthReport,
    onCopyArchitectureHealthReport,
    onClearArchitectureHealthReport,
    onArchitectureHealthIncludeTestFiles,
    onArchitectureHealthIncludeMarkdownDocs,
    onGenerateArchitectureRefactorTaskCards,
    onCopyAllArchitectureRefactorTaskCards,
    onClearArchitectureRefactorTaskCards,
    onCopyArchitectureRefactorTaskCard,
    onArchitectureRefactorTaskStatus,
    onResetArchitectureRefactorTaskStatus,
    onArchitectureRefactorHandoffSelectedTask,
    onArchitectureRefactorHandoffTarget,
    onArchitectureRefactorHandoffStrictness,
    onGenerateArchitectureRefactorTaskBuilderHandoff,
    onCopyArchitectureRefactorTaskBuilderHandoff,
    onClearArchitectureRefactorTaskBuilderHandoff,
    onArchitectureRefactorImplSelectedTaskChange,
    onArchitectureRefactorImplBuilderSourceChange,
    onArchitectureRefactorImplDraftChange,
    onSaveArchitectureRefactorImplementationReport,
    onCopyArchitectureRefactorImplementationReport,
    onClearArchitectureRefactorImplementationReport,
    onMarkArchitectureRefactorImplementationReturned,
    onMarkArchitectureRefactorReviewed,
    onStageArchitectureRefactorReportForReview,
  } = props;

  const architectureHealthReady = Boolean(
    architectureHealth.saved && !architectureHealth.saved.stale,
  );

  return (
    <>
      <ArchitectureHealthPanel
        architectureHealth={architectureHealth}
        hasProject={hasProject}
        onGenerate={onGenerateArchitectureHealthReport}
        onCopy={onCopyArchitectureHealthReport}
        onClear={onClearArchitectureHealthReport}
        onIncludeTestFilesChange={onArchitectureHealthIncludeTestFiles}
        onIncludeMarkdownDocsChange={onArchitectureHealthIncludeMarkdownDocs}
        copyState={architectureHealthCopyState}
      />

      <ArchitectureRefactorTaskCardsPanel
        refactorTaskCards={architectureRefactorTaskCards}
        architectureHealthReady={architectureHealthReady}
        architectureHealthStale={Boolean(architectureHealth.saved?.stale)}
        reportStatusByTaskId={architectureRefactorReportStatusByTaskId}
        onGenerate={onGenerateArchitectureRefactorTaskCards}
        onCopyAll={onCopyAllArchitectureRefactorTaskCards}
        onClear={onClearArchitectureRefactorTaskCards}
        onCopyTask={onCopyArchitectureRefactorTaskCard}
        onSetStatus={onArchitectureRefactorTaskStatus}
        onResetStatus={onResetArchitectureRefactorTaskStatus}
        copyAllState={architectureRefactorCopyAllState}
        copyTaskState={architectureRefactorCopyTaskState}
      />

      <ArchitectureRefactorTaskBuilderHandoffPanel
        refactorTaskCards={architectureRefactorTaskCardsSaved}
        handoff={architectureRefactorTaskBuilderHandoff}
        architectureHealthReady={architectureHealthReady}
        onSelectedTaskChange={onArchitectureRefactorHandoffSelectedTask}
        onTargetChange={onArchitectureRefactorHandoffTarget}
        onStrictnessChange={onArchitectureRefactorHandoffStrictness}
        onGenerate={onGenerateArchitectureRefactorTaskBuilderHandoff}
        onCopy={onCopyArchitectureRefactorTaskBuilderHandoff}
        onClear={onClearArchitectureRefactorTaskBuilderHandoff}
        copyState={architectureRefactorHandoffCopyState}
      />

      <ArchitectureRefactorTaskImplementationIntakePanel
        refactorTaskCards={architectureRefactorTaskCardsSaved}
        handoff={architectureRefactorTaskBuilderHandoff}
        intake={architectureRefactorTaskImplementationIntake}
        reportStatusByTaskId={architectureRefactorReportStatusByTaskId}
        draftText={architectureRefactorImplIntakeDraft}
        onSelectedTaskChange={onArchitectureRefactorImplSelectedTaskChange}
        onBuilderSourceChange={onArchitectureRefactorImplBuilderSourceChange}
        onDraftChange={onArchitectureRefactorImplDraftChange}
        onSave={onSaveArchitectureRefactorImplementationReport}
        onCopy={onCopyArchitectureRefactorImplementationReport}
        onClear={onClearArchitectureRefactorImplementationReport}
        onMarkReturned={onMarkArchitectureRefactorImplementationReturned}
        onMarkReviewed={onMarkArchitectureRefactorReviewed}
        onStageForReview={onStageArchitectureRefactorReportForReview}
        copyState={architectureRefactorImplIntakeCopyState}
      />
    </>
  );
}
