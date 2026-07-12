import { buildRefactorReportStatusMap } from "./ArchitectureRefactorTaskImplementationIntakePanel";
import type { ArchitectureRefactorImplementationBuilderSource } from "../../shared/architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants";
import type { ArchitectureRefactorTaskCardStatus } from "../../shared/architectureRefactorTasks/architectureRefactorTaskConstants";
import type {
  ArchitectureHealthState,
  ArchitectureRefactorTaskBuilderHandoffState,
  ArchitectureRefactorTaskCardsRecord,
  ArchitectureRefactorTaskCardsState,
  ArchitectureRefactorTaskImplementationIntakeState,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
} from "../../shared/types";

export type ReportsArchitectureSectionCopyState = "idle" | "copied" | "failed";

export type ReportsArchitectureSectionProps = {
  hasProject: boolean;
  architectureHealth: ArchitectureHealthState;
  architectureRefactorTaskCards: ArchitectureRefactorTaskCardsState;
  architectureRefactorTaskCardsSaved: ArchitectureRefactorTaskCardsRecord | null;
  architectureRefactorTaskBuilderHandoff: ArchitectureRefactorTaskBuilderHandoffState;
  architectureRefactorTaskImplementationIntake: ArchitectureRefactorTaskImplementationIntakeState;
  architectureRefactorReportStatusByTaskId: Record<string, string>;
  architectureRefactorImplIntakeDraft: string;
  architectureHealthCopyState: ReportsArchitectureSectionCopyState;
  architectureRefactorCopyAllState: ReportsArchitectureSectionCopyState;
  architectureRefactorCopyTaskState: Record<string, ReportsArchitectureSectionCopyState>;
  architectureRefactorHandoffCopyState: ReportsArchitectureSectionCopyState;
  architectureRefactorImplIntakeCopyState: ReportsArchitectureSectionCopyState;
  onGenerateArchitectureHealthReport: () => void;
  onCopyArchitectureHealthReport: () => void;
  onClearArchitectureHealthReport: () => void;
  onArchitectureHealthIncludeTestFiles: (include: boolean) => void;
  onArchitectureHealthIncludeMarkdownDocs: (include: boolean) => void;
  onGenerateArchitectureRefactorTaskCards: () => void;
  onCopyAllArchitectureRefactorTaskCards: () => void;
  onClearArchitectureRefactorTaskCards: () => void;
  onCopyArchitectureRefactorTaskCard: (taskId: string) => void;
  onArchitectureRefactorTaskStatus: (
    taskId: string,
    status: ArchitectureRefactorTaskCardStatus,
  ) => void;
  onResetArchitectureRefactorTaskStatus: (taskId: string) => void;
  onArchitectureRefactorHandoffSelectedTask: (taskId: string) => void;
  onArchitectureRefactorHandoffTarget: (target: BuilderHandoffTarget) => void;
  onArchitectureRefactorHandoffStrictness: (strictness: BuilderHandoffStrictness) => void;
  onGenerateArchitectureRefactorTaskBuilderHandoff: () => void;
  onCopyArchitectureRefactorTaskBuilderHandoff: () => void;
  onClearArchitectureRefactorTaskBuilderHandoff: () => void;
  onArchitectureRefactorImplSelectedTaskChange: (taskId: string) => void;
  onArchitectureRefactorImplBuilderSourceChange: (
    source: ArchitectureRefactorImplementationBuilderSource,
  ) => void;
  onArchitectureRefactorImplDraftChange: (text: string) => void;
  onSaveArchitectureRefactorImplementationReport: () => void;
  onCopyArchitectureRefactorImplementationReport: () => void;
  onClearArchitectureRefactorImplementationReport: () => void;
  onMarkArchitectureRefactorImplementationReturned: () => void;
  onMarkArchitectureRefactorReviewed: () => void;
  onStageArchitectureRefactorReportForReview: () => void;
};

export type ReportsArchitectureSectionHandlers = {
  generateArchitectureHealthReport: () => void | Promise<void>;
  copyArchitectureHealthReport: () => void | Promise<void>;
  clearArchitectureHealthReport: () => void | Promise<void>;
  architectureHealthIncludeTestFiles: (include: boolean) => void | Promise<void>;
  architectureHealthIncludeMarkdownDocs: (include: boolean) => void | Promise<void>;
  generateArchitectureRefactorTaskCards: () => void | Promise<void>;
  copyAllArchitectureRefactorTaskCards: () => void | Promise<void>;
  clearArchitectureRefactorTaskCards: () => void | Promise<void>;
  copyArchitectureRefactorTaskCard: (taskId: string) => void | Promise<void>;
  architectureRefactorTaskStatus: (
    taskId: string,
    status: ArchitectureRefactorTaskCardStatus,
  ) => void | Promise<void>;
  resetArchitectureRefactorTaskStatus: (taskId: string) => void | Promise<void>;
  architectureRefactorHandoffSelectedTask: (taskId: string) => void | Promise<void>;
  architectureRefactorHandoffTarget: (target: BuilderHandoffTarget) => void | Promise<void>;
  architectureRefactorHandoffStrictness: (
    strictness: BuilderHandoffStrictness,
  ) => void | Promise<void>;
  generateArchitectureRefactorTaskBuilderHandoff: () => void | Promise<void>;
  copyArchitectureRefactorTaskBuilderHandoff: () => void | Promise<void>;
  clearArchitectureRefactorTaskBuilderHandoff: () => void | Promise<void>;
  architectureRefactorImplSelectedTaskChange: (taskId: string) => void | Promise<void>;
  architectureRefactorImplBuilderSourceChange: (
    source: ArchitectureRefactorImplementationBuilderSource,
  ) => void | Promise<void>;
  architectureRefactorImplDraftChange: (text: string) => void;
  saveArchitectureRefactorImplementationReport: () => void | Promise<void>;
  copyArchitectureRefactorImplementationReport: () => void | Promise<void>;
  clearArchitectureRefactorImplementationReport: () => void | Promise<void>;
  markArchitectureRefactorImplementationReturned: () => void | Promise<void>;
  markArchitectureRefactorReviewed: () => void | Promise<void>;
  stageArchitectureRefactorReportForReview: () => void | Promise<void>;
};

export type BuildReportsArchitectureSectionPropsInput = {
  hasProject: boolean;
  architectureHealth: ArchitectureHealthState;
  architectureRefactorTaskCards: ArchitectureRefactorTaskCardsState;
  architectureRefactorTaskBuilderHandoff: ArchitectureRefactorTaskBuilderHandoffState;
  architectureRefactorTaskImplementationIntake: ArchitectureRefactorTaskImplementationIntakeState;
  architectureRefactorImplIntakeDraft: string;
  architectureHealthCopyState: ReportsArchitectureSectionCopyState;
  architectureRefactorCopyAllState: ReportsArchitectureSectionCopyState;
  architectureRefactorCopyTaskState: Record<string, ReportsArchitectureSectionCopyState>;
  architectureRefactorHandoffCopyState: ReportsArchitectureSectionCopyState;
  architectureRefactorImplIntakeCopyState: ReportsArchitectureSectionCopyState;
  handlers: ReportsArchitectureSectionHandlers;
};

/** Stage 110: pure prop assembly for ReportsArchitectureSection (no IPC, no React state). */
export function buildReportsArchitectureSectionProps(
  input: BuildReportsArchitectureSectionPropsInput,
): ReportsArchitectureSectionProps {
  const handlers = input.handlers;
  const architectureRefactorTaskCardsSaved = input.architectureRefactorTaskCards.saved;
  const architectureRefactorReportStatusByTaskId = buildRefactorReportStatusMap(
    input.architectureRefactorTaskImplementationIntake.reportsByTaskId,
  );

  return {
    hasProject: input.hasProject,
    architectureHealth: input.architectureHealth,
    architectureRefactorTaskCards: input.architectureRefactorTaskCards,
    architectureRefactorTaskCardsSaved,
    architectureRefactorTaskBuilderHandoff: input.architectureRefactorTaskBuilderHandoff,
    architectureRefactorTaskImplementationIntake:
      input.architectureRefactorTaskImplementationIntake,
    architectureRefactorReportStatusByTaskId,
    architectureRefactorImplIntakeDraft: input.architectureRefactorImplIntakeDraft,
    architectureHealthCopyState: input.architectureHealthCopyState,
    architectureRefactorCopyAllState: input.architectureRefactorCopyAllState,
    architectureRefactorCopyTaskState: input.architectureRefactorCopyTaskState,
    architectureRefactorHandoffCopyState: input.architectureRefactorHandoffCopyState,
    architectureRefactorImplIntakeCopyState: input.architectureRefactorImplIntakeCopyState,
    onGenerateArchitectureHealthReport: () =>
      void handlers.generateArchitectureHealthReport(),
    onCopyArchitectureHealthReport: () => void handlers.copyArchitectureHealthReport(),
    onClearArchitectureHealthReport: () => void handlers.clearArchitectureHealthReport(),
    onArchitectureHealthIncludeTestFiles: (include) =>
      void handlers.architectureHealthIncludeTestFiles(include),
    onArchitectureHealthIncludeMarkdownDocs: (include) =>
      void handlers.architectureHealthIncludeMarkdownDocs(include),
    onGenerateArchitectureRefactorTaskCards: () =>
      void handlers.generateArchitectureRefactorTaskCards(),
    onCopyAllArchitectureRefactorTaskCards: () =>
      void handlers.copyAllArchitectureRefactorTaskCards(),
    onClearArchitectureRefactorTaskCards: () =>
      void handlers.clearArchitectureRefactorTaskCards(),
    onCopyArchitectureRefactorTaskCard: (taskId) =>
      void handlers.copyArchitectureRefactorTaskCard(taskId),
    onArchitectureRefactorTaskStatus: (taskId, status) =>
      void handlers.architectureRefactorTaskStatus(taskId, status),
    onResetArchitectureRefactorTaskStatus: (taskId) =>
      void handlers.resetArchitectureRefactorTaskStatus(taskId),
    onArchitectureRefactorHandoffSelectedTask: (taskId) =>
      void handlers.architectureRefactorHandoffSelectedTask(taskId),
    onArchitectureRefactorHandoffTarget: (target) =>
      void handlers.architectureRefactorHandoffTarget(target),
    onArchitectureRefactorHandoffStrictness: (strictness) =>
      void handlers.architectureRefactorHandoffStrictness(strictness),
    onGenerateArchitectureRefactorTaskBuilderHandoff: () =>
      void handlers.generateArchitectureRefactorTaskBuilderHandoff(),
    onCopyArchitectureRefactorTaskBuilderHandoff: () =>
      void handlers.copyArchitectureRefactorTaskBuilderHandoff(),
    onClearArchitectureRefactorTaskBuilderHandoff: () =>
      void handlers.clearArchitectureRefactorTaskBuilderHandoff(),
    onArchitectureRefactorImplSelectedTaskChange: (taskId) =>
      void handlers.architectureRefactorImplSelectedTaskChange(taskId),
    onArchitectureRefactorImplBuilderSourceChange: (source) =>
      void handlers.architectureRefactorImplBuilderSourceChange(source),
    onArchitectureRefactorImplDraftChange: handlers.architectureRefactorImplDraftChange,
    onSaveArchitectureRefactorImplementationReport: () =>
      void handlers.saveArchitectureRefactorImplementationReport(),
    onCopyArchitectureRefactorImplementationReport: () =>
      void handlers.copyArchitectureRefactorImplementationReport(),
    onClearArchitectureRefactorImplementationReport: () =>
      void handlers.clearArchitectureRefactorImplementationReport(),
    onMarkArchitectureRefactorImplementationReturned: () =>
      void handlers.markArchitectureRefactorImplementationReturned(),
    onMarkArchitectureRefactorReviewed: () =>
      void handlers.markArchitectureRefactorReviewed(),
    onStageArchitectureRefactorReportForReview: () =>
      void handlers.stageArchitectureRefactorReportForReview(),
  };
}
