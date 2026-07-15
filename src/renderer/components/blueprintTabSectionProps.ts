import type { ReactNode } from "react";
import type { BlueprintPlannerPanelProps } from "./BlueprintPlannerPanel";
import type { BlueprintSource } from "../../shared/blueprintConstants";
import type { BlueprintPhaseTaskCardStatus } from "../../shared/blueprintTaskCardConstants";
import type { TaskImplementationBuilderSource } from "../../shared/taskImplementationIntakeConstants";
import type {
  BlueprintState,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
} from "../../shared/types";

export type BlueprintTabSectionCopyState = "idle" | "copied" | "failed";

export type BlueprintTabSectionProps = BlueprintPlannerPanelProps & {
  localAiProgressBanner: ReactNode;
};

export type BlueprintTabSectionHandlers = {
  blueprintIntakeChange: (
    patch: Partial<BlueprintState["intake"]>,
  ) => void | Promise<void>;
  generateBlueprintPlannerQuestions: () => void | Promise<void>;
  copyBlueprintPlannerQuestions: () => void | Promise<void>;
  generateBlueprintPlannerPrompt: () => void | Promise<void>;
  copyBlueprintPlannerPrompt: () => void | Promise<void>;
  askLocalPlannerAi: () => void | Promise<void>;
  copyBlueprintPlannerAiDraft: () => void | Promise<void>;
  saveBlueprintPlannerDraftAsImported: () => void | Promise<void>;
  blueprintDraftSourceChange: (source: BlueprintSource) => void | Promise<void>;
  blueprintDraftTextChange: (text: string) => void | Promise<void>;
  saveImportedBlueprint: () => void | Promise<void>;
  clearImportedBlueprint: () => void | Promise<void>;
  copyImportedBlueprint: () => void | Promise<void>;
  checkBlueprintCompleteness: () => void | Promise<void>;
  previewBlueprintPlanningDocuments: () => void | Promise<void>;
  saveBlueprintPlanningDocuments: (
    confirmOverwrite: boolean,
  ) => void | Promise<void>;
  generateBlueprintPhase1Handoff: () => void | Promise<void>;
  copyBlueprintPhase1Handoff: () => void | Promise<void>;
  generateBlueprintPhaseTaskCards: () => void | Promise<void>;
  copyAllBlueprintPhaseTaskCards: () => void | Promise<void>;
  clearBlueprintPhaseTaskCards: () => void | Promise<void>;
  copyBlueprintPhaseTaskCard: (taskId: string) => void | Promise<void>;
  setBlueprintPhaseTaskCardStatus: (
    taskId: string,
    status: BlueprintPhaseTaskCardStatus,
  ) => void | Promise<void>;
  resetBlueprintPhaseTaskCardStatus: (taskId: string) => void | Promise<void>;
  setActiveBlueprintPhaseTaskCard: (taskId: string) => void | Promise<void>;
  taskHandoffSelectedTaskChange: (taskId: string) => void | Promise<void>;
  taskHandoffTargetChange: (
    target: BuilderHandoffTarget,
  ) => void | Promise<void>;
  taskHandoffStrictnessChange: (
    strictness: BuilderHandoffStrictness,
  ) => void | Promise<void>;
  generateTaskCardBuilderHandoff: () => void | Promise<void>;
  copyTaskCardBuilderHandoff: () => void | Promise<void>;
  clearTaskCardBuilderHandoff: () => void | Promise<void>;
  taskImplSelectedTaskChange: (taskId: string) => void | Promise<void>;
  taskImplBuilderSourceChange: (
    source: TaskImplementationBuilderSource,
  ) => void | Promise<void>;
  taskImplDraftChange: (text: string) => void;
  saveTaskImplementationReport: () => void | Promise<void>;
  copyTaskImplementationReport: () => void | Promise<void>;
  clearTaskImplementationReport: () => void | Promise<void>;
  markTaskImplementationReturned: () => void | Promise<void>;
  markTaskReviewed: () => void | Promise<void>;
  stageTaskImplementationReportForReview: () => void | Promise<void>;
  generateBlueprintTaskReconciliation: () => void | Promise<void>;
  copyBlueprintTaskReconciliation: () => void | Promise<void>;
  clearBlueprintTaskReconciliation: () => void | Promise<void>;
  generateTaskArtifactIndex: () => void | Promise<void>;
  copyTaskArtifactIndex: () => void | Promise<void>;
  clearTaskArtifactIndex: () => void | Promise<void>;
  taskArtifactIndexFilterChange: (
    taskId: string | null,
  ) => void | Promise<void>;
  blueprintPreviewFileSelect: (fileName: string) => void | Promise<void>;
};

export type BuildBlueprintTabSectionPropsInput = {
  blueprint: BlueprintState;
  hasProject: boolean;
  localAiProgressBanner: ReactNode;
  blueprintQuestionsCopyState: BlueprintTabSectionCopyState;
  blueprintPromptCopyState: BlueprintTabSectionCopyState;
  blueprintLocalPlannerCopyState: BlueprintTabSectionCopyState;
  blueprintImportedCopyState: BlueprintTabSectionCopyState;
  blueprintPhase1CopyState: BlueprintTabSectionCopyState;
  blueprintPhaseTaskCardsCopyAllState: BlueprintTabSectionCopyState;
  blueprintPhaseTaskCardCopyState: Record<string, BlueprintTabSectionCopyState>;
  taskBuilderHandoffCopyState: BlueprintTabSectionCopyState;
  taskImplementationIntakeCopyState: BlueprintTabSectionCopyState;
  taskImplementationIntakeDraft: string;
  taskReconciliationCopyState: BlueprintTabSectionCopyState;
  taskArtifactIndexCopyState: BlueprintTabSectionCopyState;
  handlers: BlueprintTabSectionHandlers;
};

/** Stage 113: pure prop assembly for BlueprintTabSection (no IPC, no React state). */
export function buildBlueprintTabSectionProps(
  input: BuildBlueprintTabSectionPropsInput,
): BlueprintTabSectionProps {
  const handlers = input.handlers;

  return {
    localAiProgressBanner: input.localAiProgressBanner,
    blueprint: input.blueprint,
    projectSelected: input.hasProject,
    onIntakeChange: (patch) => void handlers.blueprintIntakeChange(patch),
    onGenerateQuestions: () =>
      void handlers.generateBlueprintPlannerQuestions(),
    onCopyQuestions: () => void handlers.copyBlueprintPlannerQuestions(),
    onGeneratePrompt: () => void handlers.generateBlueprintPlannerPrompt(),
    onCopyPrompt: () => void handlers.copyBlueprintPlannerPrompt(),
    onAskLocalPlannerAi: () => void handlers.askLocalPlannerAi(),
    onCopyLocalPlannerDraft: () => void handlers.copyBlueprintPlannerAiDraft(),
    onSaveLocalDraftAsBlueprint: () =>
      void handlers.saveBlueprintPlannerDraftAsImported(),
    onDraftSourceChange: (source) =>
      void handlers.blueprintDraftSourceChange(source),
    onDraftTextChange: (text) => void handlers.blueprintDraftTextChange(text),
    onSaveImported: () => void handlers.saveImportedBlueprint(),
    onClearImported: () => void handlers.clearImportedBlueprint(),
    onCopyImported: () => void handlers.copyImportedBlueprint(),
    onCheckCompleteness: () => void handlers.checkBlueprintCompleteness(),
    onPreviewPlanningDocs: () =>
      void handlers.previewBlueprintPlanningDocuments(),
    onSavePlanningDocs: () =>
      void handlers.saveBlueprintPlanningDocuments(false),
    onConfirmOverwritePlanningDocs: () =>
      void handlers.saveBlueprintPlanningDocuments(true),
    onGeneratePhase1Handoff: () =>
      void handlers.generateBlueprintPhase1Handoff(),
    onCopyPhase1Handoff: () => void handlers.copyBlueprintPhase1Handoff(),
    onGeneratePhaseTaskCards: () =>
      void handlers.generateBlueprintPhaseTaskCards(),
    onCopyAllPhaseTaskCards: () =>
      void handlers.copyAllBlueprintPhaseTaskCards(),
    onClearPhaseTaskCards: () => void handlers.clearBlueprintPhaseTaskCards(),
    onCopyPhaseTaskCard: (taskId) =>
      void handlers.copyBlueprintPhaseTaskCard(taskId),
    onSetPhaseTaskCardStatus: (taskId, status) =>
      void handlers.setBlueprintPhaseTaskCardStatus(taskId, status),
    onResetPhaseTaskCardStatus: (taskId) =>
      void handlers.resetBlueprintPhaseTaskCardStatus(taskId),
    onSetActivePhaseTaskCard: (taskId) =>
      void handlers.setActiveBlueprintPhaseTaskCard(taskId),
    onTaskHandoffSelectedTaskChange: (taskId) =>
      void handlers.taskHandoffSelectedTaskChange(taskId),
    onTaskHandoffTargetChange: (target) =>
      void handlers.taskHandoffTargetChange(target),
    onTaskHandoffStrictnessChange: (strictness) =>
      void handlers.taskHandoffStrictnessChange(strictness),
    onGenerateTaskBuilderHandoff: () =>
      void handlers.generateTaskCardBuilderHandoff(),
    onCopyTaskBuilderHandoff: () => void handlers.copyTaskCardBuilderHandoff(),
    onClearTaskBuilderHandoff: () =>
      void handlers.clearTaskCardBuilderHandoff(),
    onTaskImplSelectedTaskChange: (taskId) =>
      void handlers.taskImplSelectedTaskChange(taskId),
    onTaskImplBuilderSourceChange: (source) =>
      void handlers.taskImplBuilderSourceChange(source),
    onTaskImplDraftChange: handlers.taskImplDraftChange,
    onSaveTaskImplementationReport: () =>
      void handlers.saveTaskImplementationReport(),
    onCopyTaskImplementationReport: () =>
      void handlers.copyTaskImplementationReport(),
    onClearTaskImplementationReport: () =>
      void handlers.clearTaskImplementationReport(),
    onMarkTaskImplementationReturned: () =>
      void handlers.markTaskImplementationReturned(),
    onMarkTaskReviewed: () => void handlers.markTaskReviewed(),
    onStageTaskImplementationReportForReview: () =>
      void handlers.stageTaskImplementationReportForReview(),
    onGenerateBlueprintTaskReconciliation: () =>
      void handlers.generateBlueprintTaskReconciliation(),
    onCopyBlueprintTaskReconciliation: () =>
      void handlers.copyBlueprintTaskReconciliation(),
    onClearBlueprintTaskReconciliation: () =>
      void handlers.clearBlueprintTaskReconciliation(),
    onGenerateTaskArtifactIndex: () =>
      void handlers.generateTaskArtifactIndex(),
    onCopyTaskArtifactIndex: () => void handlers.copyTaskArtifactIndex(),
    onClearTaskArtifactIndex: () => void handlers.clearTaskArtifactIndex(),
    onTaskArtifactIndexFilterChange: (taskId) =>
      void handlers.taskArtifactIndexFilterChange(taskId),
    onSelectPreviewFile: (fileName) =>
      void handlers.blueprintPreviewFileSelect(fileName),
    questionsCopyState: input.blueprintQuestionsCopyState,
    promptCopyState: input.blueprintPromptCopyState,
    localPlannerCopyState: input.blueprintLocalPlannerCopyState,
    importedCopyState: input.blueprintImportedCopyState,
    phase1CopyState: input.blueprintPhase1CopyState,
    phaseTaskCardsCopyAllState: input.blueprintPhaseTaskCardsCopyAllState,
    phaseTaskCardCopyState: input.blueprintPhaseTaskCardCopyState,
    taskBuilderHandoffCopyState: input.taskBuilderHandoffCopyState,
    taskImplementationIntakeCopyState: input.taskImplementationIntakeCopyState,
    taskImplementationIntakeDraft: input.taskImplementationIntakeDraft,
    taskReconciliationCopyState: input.taskReconciliationCopyState,
    taskArtifactIndexCopyState: input.taskArtifactIndexCopyState,
  };
}
