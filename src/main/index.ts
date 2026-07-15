import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { SafetyGate } from "./safety/SafetyGate";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { buildMetadataOnlyAdvisorPrompt } from "./providers/buildMetadataOnlyAdvisorPrompt";
import { QwenInspectManager } from "./providers/QwenInspectManager";
import { ProjectScanner } from "./scan/ProjectScanner";
import { CheckpointManager } from "./checkpoint/CheckpointManager";
import {
  SafeCommandRunner,
} from "./commands/SafeCommandRunner";
import { buildOutsideReviewPack } from "./review/buildOutsideReviewPack";
import { buildPatchReviewPack } from "./review/buildPatchReviewPack";
import {
  buildBuilderPromptPack,
  buildDecisionReport,
} from "./review/buildDecisionReport";
import { ExternalReviewManager } from "./review/ExternalReviewManager";
import { BuilderResultManager } from "./review/BuilderResultManager";
import { BuilderPlanManager } from "./review/BuilderPlanManager";
import { BuilderPlanComparisonManager } from "./review/BuilderPlanComparisonManager";
import { buildBuilderPlanComparison } from "./review/buildBuilderPlanComparison";
import { ImplementationReviewManager } from "./review/ImplementationReviewManager";
import { buildImplementationReview } from "./review/buildImplementationReview";
import {
  BacklogManager,
  backlogOpenCriticalSafetyCount,
} from "./review/BacklogManager";
import { SpeakerScriptManager } from "./review/SpeakerScriptManager";
import { HistoryStore } from "./history/HistoryStore";
import { ProjectMemoryManager } from "./projectMemory/ProjectMemoryManager";
import { CodeContextManager } from "./codeContext/CodeContextManager";
import { CodeContextAiManager } from "./codeContext/CodeContextAiManager";
import { buildCodeContextAiPrompt } from "./codeContext/buildCodeContextAiPrompt";
import { PatchDraftManager } from "./codeContext/PatchDraftManager";
import { ImportedPatchDraftManager } from "./codeContext/ImportedPatchDraftManager";
import { buildPatchDraftPrompt } from "./codeContext/buildPatchDraftPrompt";
import { PatchDraftSafetyReviewManager } from "./review/PatchDraftSafetyReviewManager";
import { buildPatchDraftSafetyReview } from "./review/buildPatchDraftSafetyReview";
import { ExternalPatchDraftComparisonManager } from "./review/ExternalPatchDraftComparisonManager";
import { buildExternalPatchDraftComparison } from "./review/buildExternalPatchDraftComparison";
import { BuilderHandoffExportManager } from "./review/BuilderHandoffExportManager";
import { BlueprintManager } from "./planning/BlueprintManager";
import { BlueprintPlannerAiManager } from "./planning/BlueprintPlannerAiManager";
import { BlueprintTaskCardsManager } from "./planning/BlueprintTaskCardsManager";
import { TaskCardBuilderHandoffManager } from "./planning/TaskCardBuilderHandoffManager";
import { TaskImplementationIntakeManager } from "./planning/TaskImplementationIntakeManager";
import { BlueprintTaskReconciliationManager } from "./planning/BlueprintTaskReconciliationManager";
import {
  TaskArtifactIndexManager,
  type TaskArtifactIndexSnapshotSources,
} from "./planning/TaskArtifactIndexManager";
import { ChangedFilesTaskLinkManager } from "./planning/ChangedFilesTaskLinkManager";
import { ArchitectureHealthManager } from "./architecture/ArchitectureHealthManager";
import { SafeScaffoldTargetManager } from "./buildMode/SafeScaffoldTargetManager";
import { SafeScaffoldFileTreePreviewManager } from "./buildMode/SafeScaffoldFileTreePreviewManager";
import { SafeScaffoldFileContentPreviewManager } from "./buildMode/SafeScaffoldFileContentPreviewManager";
import { SafeScaffoldWriteManifestPreviewManager } from "./buildMode/SafeScaffoldWriteManifestPreviewManager";
import { SafeScaffoldFinalConfirmationManager } from "./buildMode/SafeScaffoldFinalConfirmationManager";
import { SafeScaffoldWriteManager } from "./buildMode/SafeScaffoldWriteManager";
import {
  SAFE_SCAFFOLD_WRITE_DIALOG_DETAIL,
  SAFE_SCAFFOLD_WRITE_DIALOG_MESSAGE,
} from "../shared/buildModeSafeScaffoldWrite";
import { DEFAULT_BLUEPRINT_PROJECT_TYPE } from "../shared/blueprintConstants";
import { ArchitectureRefactorTaskCardsManager } from "./architecture/ArchitectureRefactorTaskCardsManager";
import { ArchitectureRefactorTaskBuilderHandoffManager } from "./architecture/ArchitectureRefactorTaskBuilderHandoffManager";
import { ArchitectureRefactorTaskImplementationIntakeManager } from "./architecture/ArchitectureRefactorTaskImplementationIntakeManager";
import { buildBlueprintPlannerAiOllamaPrompt } from "./planning/buildBlueprintPlannerAiPrompt";
import { buildBuilderHandoffExport } from "./review/buildBuilderHandoffExport";
import {
  buildReviewTargetLabel,
  importedRecordToPatchDraftRecord,
} from "./review/patchDraftReviewAdapter";
import { LocalAiProgressTracker } from "./localAi/LocalAiProgressTracker";
import { OllamaStatusManager } from "./ollama/OllamaStatusManager";
import { PlanningStyleManager } from "./planning/PlanningStyleManager";
import { ReportsUiManager } from "./reports/ReportsUiManager";
import { isCodeQuestionTemplateId } from "../shared/codeQuestionTemplates";
import {
  isSmallModelFriendlyPlanning,
  planningGuidanceLogMessage,
} from "../shared/planningStyle";
import {
  FAST_DRAFT_SETUP_MESSAGE,
  PATCH_DRAFT_FAILURE_SAFETY_REVIEW_NOTE,
} from "../shared/localAiUsability";
import { ChangedFilesDetector } from "./scan/ChangedFilesDetector";
import { buildSpeakerScript } from "../shared/buildSpeakerScript";
import { buildBuilderPlanPrompt } from "./providers/buildBuilderPlanPrompt";
import { RoleModelMappingManager } from "./providers/RoleModelMappingManager";
import {
  DEFAULT_LOCAL_AI_ROLE,
  getLocalAiRole,
  isLocalAiRoleId,
} from "../shared/localAiRoles";
import {
  formatModelSelectionSource,
  resolveBlueprintPlannerModel,
  resolveBuilderPlanModel,
  resolveCodeContextReviewModel,
  resolveLocalAiRoleModel,
  resolvePatchDraftModel,
} from "../shared/roleModelMapping";
import {
  formatLocalAiFailureMessage,
  NO_GIT_CHANGED_FILES_NOTE,
} from "../shared/userFacingMessages";
import { IPC_CHANNELS } from "../shared/types";
import type {
  ActionLogLevel,
  AppSnapshot,
  BacklogFilters,
  BacklogItemType,
  BacklogPriority,
  BacklogStatus,
  BuilderPromptPack,
  BuilderResultResponseType,
  BuilderResultSource,
  ChangedFilesScanResult,
  ChangedFilesState,
  DecisionReport,
  DecisionState,
  ExternalReviewSource,
  LocalAiAdvisorResponse,
  LocalAiRoleId,
  OutsideReviewPack,
  PatchReviewPack,
  ProjectScanResult,
  ProviderSettings,
  SafeCheckKind,
  SpeakerScriptRole,
  SpeakerScriptTone,
  BlueprintIntake,
  BlueprintState,
} from "../shared/types";
import type { BlueprintSource } from "../shared/blueprintConstants";
import { BLUEPRINT_PHASE_TASK_CARD_STATUSES } from "../shared/blueprintTaskCardConstants";
import {
  BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  BUILDER_HANDOFF_TARGET_OPTIONS,
} from "../shared/builderHandoffExportConstants";
import {
  countBlockedTaskCards,
  countReadyToSendTaskCards,
  findNextTaskCardId,
} from "../shared/buildBlueprintPhaseTaskCards";

/** Dev uses Vite only when launched with `--dev` (see npm run dev). Packaged and `npm start` load built files. */
const isDev = !app.isPackaged && process.argv.includes("--dev");

let mainWindow: BrowserWindow | null = null;
const safetyGate = new SafetyGate();
const providerRegistry = new ProviderRegistry();
const projectScanner = new ProjectScanner(safetyGate);
const changedFilesDetector = new ChangedFilesDetector(safetyGate);
const checkpointManager = new CheckpointManager(
  safetyGate,
  path.join(app.getPath("userData"), "checkpoints"),
);
const safeCommandRunner = new SafeCommandRunner(safetyGate);
const qwenInspectManager = new QwenInspectManager(safetyGate);
const externalReviewManager = new ExternalReviewManager(safetyGate);
const builderResultManager = new BuilderResultManager(safetyGate);
const builderPlanManager = new BuilderPlanManager(safetyGate);
const builderPlanComparisonManager = new BuilderPlanComparisonManager(safetyGate);
const implementationReviewManager = new ImplementationReviewManager(safetyGate);
const roleModelMappingManager = new RoleModelMappingManager(safetyGate);
const backlogManager = new BacklogManager(safetyGate);
const speakerScriptManager = new SpeakerScriptManager(safetyGate);
const projectMemoryManager = new ProjectMemoryManager(safetyGate);
const codeContextManager = new CodeContextManager(safetyGate);
const codeContextAiManager = new CodeContextAiManager(safetyGate);
const patchDraftManager = new PatchDraftManager(safetyGate);
const importedPatchDraftManager = new ImportedPatchDraftManager(safetyGate);
const patchDraftSafetyReviewManager = new PatchDraftSafetyReviewManager(safetyGate);
const externalPatchDraftComparisonManager =
  new ExternalPatchDraftComparisonManager(safetyGate);
const builderHandoffExportManager = new BuilderHandoffExportManager(safetyGate);
const blueprintManager = new BlueprintManager(safetyGate);
const blueprintPlannerAiManager = new BlueprintPlannerAiManager(safetyGate);
const blueprintTaskCardsManager = new BlueprintTaskCardsManager(safetyGate);
const taskCardBuilderHandoffManager = new TaskCardBuilderHandoffManager(safetyGate);
const taskImplementationIntakeManager = new TaskImplementationIntakeManager(safetyGate);
const blueprintTaskReconciliationManager = new BlueprintTaskReconciliationManager(safetyGate);
const taskArtifactIndexManager = new TaskArtifactIndexManager(safetyGate);
const changedFilesTaskLinkManager = new ChangedFilesTaskLinkManager(safetyGate);
const architectureHealthManager = new ArchitectureHealthManager(safetyGate);
const safeScaffoldTargetManager = new SafeScaffoldTargetManager(safetyGate);
const safeScaffoldFileTreePreviewManager =
  new SafeScaffoldFileTreePreviewManager(safetyGate);
const safeScaffoldFileContentPreviewManager =
  new SafeScaffoldFileContentPreviewManager(safetyGate);
const safeScaffoldWriteManifestPreviewManager =
  new SafeScaffoldWriteManifestPreviewManager(safetyGate);
const safeScaffoldFinalConfirmationManager =
  new SafeScaffoldFinalConfirmationManager(safetyGate);
const safeScaffoldWriteManager = new SafeScaffoldWriteManager(safetyGate);
const architectureRefactorTaskCardsManager =
  new ArchitectureRefactorTaskCardsManager(safetyGate);
const architectureRefactorTaskBuilderHandoffManager =
  new ArchitectureRefactorTaskBuilderHandoffManager(safetyGate);
const architectureRefactorTaskImplementationIntakeManager =
  new ArchitectureRefactorTaskImplementationIntakeManager(safetyGate);
const localAiProgressTracker = new LocalAiProgressTracker();
const ollamaStatusManager = new OllamaStatusManager(safetyGate);
const planningStyleManager = new PlanningStyleManager(safetyGate);
const reportsUiManager = new ReportsUiManager();
let historyStore: HistoryStore | null = null;

let projectSummary: ProjectScanResult | null = null;
let summaryIsFromHistory = false;
let userRequest = "";
let lastLoggedRequest = "";
let reviewPack: OutsideReviewPack | null = null;
let changedFilesBusy = false;
let changedFilesLastScan: ChangedFilesScanResult | null = null;
let changedFilesStatusMessage: string | null = null;
let patchReviewPack: PatchReviewPack | null = null;
let decisionReport: DecisionReport | null = null;
let builderPrompt: BuilderPromptPack | null = null;
let decisionStatusMessage: string | null = null;
let checkpointBusy = false;
let checkpointStatusMessage: string | null = null;
let advisorResponse: LocalAiAdvisorResponse | null = null;
let advisorBusy = false;
let advisorStatusMessage: string | null = null;
let localAiRole: LocalAiRoleId = DEFAULT_LOCAL_AI_ROLE;

function normalizeCompare(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

/** Upgrade older history advisor responses that lack Stage 36 role fields. */
function normalizeAdvisorResponse(
  raw: LocalAiAdvisorResponse | null | undefined,
): LocalAiAdvisorResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const roleId = isLocalAiRoleId(raw.roleId)
    ? raw.roleId
    : DEFAULT_LOCAL_AI_ROLE;
  const role = getLocalAiRole(roleId);
  return {
    createdAt: raw.createdAt,
    modelName: raw.modelName,
    baseUrl: raw.baseUrl,
    promptCharCount: raw.promptCharCount,
    responseText: raw.responseText,
    truncatedForPack: Boolean(raw.truncatedForPack),
    roleId,
    roleLabel: raw.roleLabel || role.label,
    roleCategory: raw.roleCategory || role.category,
  };
}

function getHistoryStore(): HistoryStore {
  if (!historyStore) {
    historyStore = new HistoryStore(safetyGate, app.getPath("userData"));
  }
  return historyStore;
}

function getChangedFilesTaskLinkInputs() {
  const taskCards = blueprintTaskCardsManager.getSaved();
  const handoffTaskId =
    taskCardBuilderHandoffManager.getState().selectedTaskId ??
    taskCardBuilderHandoffManager.getSaved()?.selectedTaskId ??
    null;
  return {
    taskCards,
    handoffSelectedTaskId: handoffTaskId,
    selectedImplementationTaskId:
      taskImplementationIntakeManager.getState(
        taskCards,
        Boolean(implementationReviewManager.getSaved()),
        handoffTaskId,
      ).selectedTaskId,
    implementationReports: taskImplementationIntakeManager.getReportsByTaskId(),
  };
}

function getChangedFilesState(): ChangedFilesState {
  return {
    busy: changedFilesBusy,
    lastScan: changedFilesLastScan,
    statusMessage: changedFilesStatusMessage,
    patchReviewPack,
    taskLink: changedFilesTaskLinkManager.getState(getChangedFilesTaskLinkInputs()),
  };
}

function syncChangedFilesTaskLinkWithSources(): void {
  changedFilesTaskLinkManager.syncWithSources({
    taskCards: blueprintTaskCardsManager.getSaved(),
    changedFilesScan: changedFilesLastScan,
  });
}

function syncArchitectureRefactorImplementationIntake(): void {
  architectureRefactorTaskImplementationIntakeManager.syncWithRefactorCards(
    architectureRefactorTaskCardsManager.getSaved(),
    architectureRefactorTaskBuilderHandoffManager.getState().selectedTaskId ??
      architectureRefactorTaskBuilderHandoffManager.getSaved()?.selectedTaskId ??
      null,
  );
}

function getArchitectureRefactorImplementationIntakeState() {
  return architectureRefactorTaskImplementationIntakeManager.getState({
    refactorTaskCards: architectureRefactorTaskCardsManager.getSaved(),
    hasImplementationReview: Boolean(implementationReviewManager.getSaved()),
    handoffTaskId:
      architectureRefactorTaskBuilderHandoffManager.getState().selectedTaskId ??
      architectureRefactorTaskBuilderHandoffManager.getSaved()?.selectedTaskId ??
      null,
  });
}

function syncArchitectureHealthWithSources(): void {
  const taskCards = blueprintTaskCardsManager.getSaved();
  architectureHealthManager.syncWithSources({
    projectSummaryScannedAt: projectSummary?.scannedAt ?? null,
    changedFilesScannedAt: changedFilesLastScan?.scannedAt ?? null,
    taskCardsGeneratedAt: taskCards?.generatedAt ?? null,
  });
  architectureRefactorTaskCardsManager.syncWithArchitectureHealth(
    architectureHealthManager.getSaved(),
  );
  architectureRefactorTaskBuilderHandoffManager.syncWithArchitectureHealth(
    architectureHealthManager.getSaved(),
  );
  architectureRefactorTaskBuilderHandoffManager.syncWithRefactorCards(
    architectureRefactorTaskCardsManager.getSaved(),
  );
  syncArchitectureRefactorImplementationIntake();
}

function getDecisionState(): DecisionState {
  return {
    decisionReport,
    builderPrompt,
    lastRecommendedNextAction:
      decisionReport?.recommendedNextAction ??
      builderPrompt?.recommendedNextAction ??
      null,
    statusMessage: decisionStatusMessage,
  };
}

function startLocalAiProgress(
  mode: import("../shared/types").LocalAiProgressMode,
  label: string,
  modelName: string,
  baseUrl: string,
): void {
  localAiProgressTracker.start(mode, label, modelName, baseUrl);
  safetyGate.log(
    "info",
    "Local AI request progress started",
    `${label} · ${modelName} · ${baseUrl}`,
  );
}

function finishLocalAiProgress(
  success: boolean,
  label: string,
  detail: string,
): void {
  const elapsedMs = localAiProgressTracker.stop();
  const elapsedSec = Math.round(elapsedMs / 1000);
  safetyGate.log(
    success ? "success" : "warning",
    success
      ? "Local AI request completed with elapsed time"
      : "Local AI request failed with elapsed time",
    `${label}: ${detail} (${elapsedSec}s).`,
  );
  ollamaStatusManager.applyLocalAiOutcome(success, detail);
}

function logPlanningGuidanceIfEnabled(
  target: "builder-plan" | "patch-draft" | "builder-prompt" | "project-memory",
): void {
  if (!isSmallModelFriendlyPlanning(planningStyleManager.getStyle())) return;
  safetyGate.log("info", planningGuidanceLogMessage(target), "Planning style preset only — no AI auto-send.");
}

function getDecisionBuilderInput() {
  return {
    userRequest,
    project: safetyGate.getProject(),
    summary: projectSummary,
    summaryIsFromHistory,
    safety: safetyGate.getStatus(),
    checkpoint: checkpointManager.getLatest(),
    checkpointAvailability: checkpointManager.getAvailability(),
    safeChecks: safeCommandRunner.getState(),
    changedFiles: changedFilesLastScan,
    reviewPack,
    patchReviewPack,
    advisorResponse,
    qwen: qwenInspectManager.getState(),
    externalReview: externalReviewManager.getState(),
    builderResult: builderResultManager.getSaved(),
    builderPrompt,
    backlogItems: backlogManager.getItems(),
    speakerScript: speakerScriptManager.getSaved(),
    builderPlan: builderPlanManager.getSaved(),
    builderPlanComparison: builderPlanComparisonManager.getSaved(),
    implementationReview: implementationReviewManager.getSaved(),
    roleModelMapping: roleModelMappingManager.getRoleModelMappingState(),
    installedModels: roleModelMappingManager.getInstalledModelsState(),
    projectMemoryPreview: projectMemoryManager.getPreview(),
    projectMemoryLastSaved: projectMemoryManager.getLastSaved(),
    codeContextPreview: codeContextManager.getPreview(),
    codeContextAiResponse: codeContextAiManager.getSaved(),
    patchDraftResponse: patchDraftManager.getSaved(),
    patchDraftSafetyReview: patchDraftSafetyReviewManager.getSaved(),
    importedPatchDraft: importedPatchDraftManager.getSaved(),
    externalPatchDraftComparison:
      externalPatchDraftComparisonManager.getSaved(),
    builderHandoffExport: builderHandoffExportManager.getSaved(),
    planningStyle: planningStyleManager.getStyle(),
    codeContextQuestionTemplate: codeContextManager.getSelectedTemplate(),
  };
}

function buildImportedPatchDraftContextSnapshot() {
  return {
    codeContextPackExisted: Boolean(codeContextManager.getPreview()?.markdownReport),
    codeAiResponseExisted: Boolean(codeContextAiManager.getSaved()),
    nttcPatchDraftExisted: Boolean(patchDraftManager.getSaved()),
    patchDraftSafetyReviewExisted: Boolean(patchDraftSafetyReviewManager.getSaved()),
    safetyBackupVerified: Boolean(checkpointManager.getAvailability().restorable),
    decisionReportExisted: Boolean(decisionReport),
    implementationReviewExisted: Boolean(implementationReviewManager.getSaved()),
    backlogWarningsExisted: backlogOpenCriticalSafetyCount(backlogManager.getItems()) > 0,
  };
}

function getProjectMemoryInput() {
  return {
    userRequest,
    project: safetyGate.getProject(),
    summary: projectSummary,
    summaryIsFromHistory,
    safety: safetyGate.getStatus(),
    checkpoint: checkpointManager.getLatest(),
    checkpointAvailability: checkpointManager.getAvailability(),
    safeChecks: safeCommandRunner.getState(),
    changedFiles: changedFilesLastScan,
    reviewPack,
    patchReviewPack,
    decisionReport,
    builderPrompt,
    builderResult: builderResultManager.getSaved(),
    advisorResponse,
    externalReviews: externalReviewManager.getState().reviews,
    speakerScript: speakerScriptManager.getSaved(),
    builderPlan: builderPlanManager.getSaved(),
    builderPlanComparison: builderPlanComparisonManager.getSaved(),
    implementationReview: implementationReviewManager.getSaved(),
    roleModelMapping: roleModelMappingManager.getRoleModelMappingState(),
    installedModels: roleModelMappingManager.getInstalledModelsState(),
    backlogItems: backlogManager.getItems(),
    backlogCriticalSafetyOpen: backlogOpenCriticalSafetyCount(
      backlogManager.getItems(),
    ),
    projectMemoryLastSaved: projectMemoryManager.getLastSaved(),
    codeContextPreview: codeContextManager.getPreview(),
    codeContextAiResponse: codeContextAiManager.getSaved(),
    patchDraftResponse: patchDraftManager.getSaved(),
    patchDraftSafetyReview: patchDraftSafetyReviewManager.getSaved(),
    importedPatchDraft: importedPatchDraftManager.getSaved(),
    externalPatchDraftComparison:
      externalPatchDraftComparisonManager.getSaved(),
    builderHandoffExport: builderHandoffExportManager.getSaved(),
    architectureHealth: architectureHealthManager.getSaved(),
    safeScaffoldTarget: safeScaffoldTargetManager.getSaved(),
    safeScaffoldFileTreePreview: safeScaffoldFileTreePreviewManager.getSaved(),
    safeScaffoldFileContentPreview:
      safeScaffoldFileContentPreviewManager.getSaved(),
    safeScaffoldWriteManifestPreview:
      safeScaffoldWriteManifestPreviewManager.getSaved(),
    safeScaffoldFinalConfirmation:
      safeScaffoldFinalConfirmationManager.getSaved(),
    safeScaffoldWriteResult: safeScaffoldWriteManager.getSaved(),
    architectureRefactorTaskCards: architectureRefactorTaskCardsManager.getSaved(),
    architectureRefactorTaskBuilderHandoff:
      architectureRefactorTaskBuilderHandoffManager.getSaved(),
    architectureRefactorTaskImplementationReports:
      architectureRefactorTaskImplementationIntakeManager.getReportsByTaskId(),
    planningStyle: planningStyleManager.getStyle(),
    codeContextQuestionTemplate: codeContextManager.getSelectedTemplate(),
  };
}

function getCodeContextPreviewInput() {
  const builderPlan = builderPlanManager.getSaved();
  return {
    summary: projectSummary,
    decisionReport,
    builderPlanExcerpt:
      builderPlan?.previewExcerpt ?? builderPlan?.planText?.slice(0, 800) ?? null,
    implementationReview: implementationReviewManager.getSaved(),
    projectMemoryLastSaved: projectMemoryManager.getLastSaved(),
    fallbackQuestion: userRequest,
  };
}

function getBlueprintPersistenceFields() {
  const state = blueprintManager.getState();
  return {
    blueprintIntake: state.intake,
    blueprintPlannerQuestions: state.plannerQuestions,
    blueprintPlannerPrompt: state.plannerPrompt,
    blueprintImported: state.importedBlueprint,
    blueprintCompletenessReport: state.completenessReport,
    blueprintPlanningDocsPreview: state.planningDocsPreview,
    blueprintPlanningDocsLastSaved: state.planningDocsLastSaved,
    blueprintPhase1Handoff: state.phase1Handoff,
    blueprintDraftText: state.draftBlueprintText,
    blueprintDraftSource: state.draftBlueprintSource,
    blueprintSelectedPreviewFile: state.selectedPreviewFileName,
    blueprintPlannerAiDraft: blueprintPlannerAiManager.getSaved(),
    blueprintPhaseTaskCards: blueprintTaskCardsManager.getSaved(),
    blueprintTaskCardBuilderHandoff: taskCardBuilderHandoffManager.getSaved(),
    blueprintTaskCardBuilderHandoffSelectedTaskId:
      taskCardBuilderHandoffManager.getState().selectedTaskId,
    blueprintTaskCardBuilderHandoffTarget:
      taskCardBuilderHandoffManager.getState().target,
    blueprintTaskCardBuilderHandoffStrictness:
      taskCardBuilderHandoffManager.getState().strictness,
    blueprintTaskImplementationReports:
      taskImplementationIntakeManager.getReportsByTaskId(),
    blueprintTaskImplementationSelectedTaskId:
      taskImplementationIntakeManager.getState(
        blueprintTaskCardsManager.getSaved(),
        Boolean(implementationReviewManager.getSaved()),
        taskCardBuilderHandoffManager.getState().selectedTaskId,
      ).selectedTaskId,
    blueprintTaskImplementationBuilderSource:
      taskImplementationIntakeManager.getState(
        blueprintTaskCardsManager.getSaved(),
        Boolean(implementationReviewManager.getSaved()),
        taskCardBuilderHandoffManager.getState().selectedTaskId,
      ).builderSource,
    blueprintTaskReconciliation: blueprintTaskReconciliationManager.getSaved(),
    blueprintTaskArtifactIndex: taskArtifactIndexManager.getSaved(),
    changedFilesTaskLink: changedFilesTaskLinkManager.getSaved(),
    changedFilesTaskLinkSelectedTaskId:
      changedFilesTaskLinkManager.getSelectedTaskId(),
    architectureHealth: architectureHealthManager.getSaved(),
    safeScaffoldTarget: safeScaffoldTargetManager.getSaved(),
    safeScaffoldFileTreePreview: safeScaffoldFileTreePreviewManager.getSaved(),
    safeScaffoldFileContentPreview:
      safeScaffoldFileContentPreviewManager.getSaved(),
    safeScaffoldWriteManifestPreview:
      safeScaffoldWriteManifestPreviewManager.getSaved(),
    safeScaffoldFinalConfirmation:
      safeScaffoldFinalConfirmationManager.getSaved(),
    safeScaffoldWriteResult: safeScaffoldWriteManager.getSaved(),
    architectureRefactorTaskCards: architectureRefactorTaskCardsManager.getSaved(),
    architectureRefactorTaskBuilderHandoff:
      architectureRefactorTaskBuilderHandoffManager.getSaved(),
    architectureRefactorTaskBuilderHandoffSelectedTaskId:
      architectureRefactorTaskBuilderHandoffManager.getState().selectedTaskId,
    architectureRefactorTaskBuilderHandoffTarget:
      architectureRefactorTaskBuilderHandoffManager.getState().target,
    architectureRefactorTaskBuilderHandoffStrictness:
      architectureRefactorTaskBuilderHandoffManager.getState().strictness,
    architectureRefactorTaskImplementationReports:
      architectureRefactorTaskImplementationIntakeManager.getReportsByTaskId(),
    architectureRefactorTaskImplementationSelectedTaskId:
      getArchitectureRefactorImplementationIntakeState().selectedTaskId,
    architectureRefactorTaskImplementationBuilderSource:
      getArchitectureRefactorImplementationIntakeState().builderSource,
  };
}

function getArtifactIndexSnapshotSources(): TaskArtifactIndexSnapshotSources {
  const taskCards = blueprintTaskCardsManager.getSaved();
  const handoff = taskCardBuilderHandoffManager.getSaved();
  const reports = taskImplementationIntakeManager.getReportsByTaskId();
  const recon = blueprintTaskReconciliationManager.getSaved();
  const builder = builderResultManager.getSaved();
  return {
    taskCardsGeneratedAt: taskCards?.generatedAt ?? null,
    handoffGeneratedAt: handoff?.generatedAt ?? null,
    implementationReportCount: Object.keys(reports).length,
    reconciliationGeneratedAt: recon?.generatedAt ?? null,
    builderResultSavedAt: builder?.savedAt ?? null,
  };
}

function syncArtifactIndexWithArtifacts(): void {
  taskArtifactIndexManager.syncWithArtifacts(getArtifactIndexSnapshotSources());
}

function syncTaskCardBuilderHandoffWithCards(): void {
  taskCardBuilderHandoffManager.syncWithTaskCards(
    blueprintTaskCardsManager.getSaved(),
  );
  const handoffTaskId =
    taskCardBuilderHandoffManager.getState().selectedTaskId ??
    taskCardBuilderHandoffManager.getSaved()?.selectedTaskId ??
    null;
  taskImplementationIntakeManager.syncWithTaskCards(
    blueprintTaskCardsManager.getSaved(),
    handoffTaskId,
  );
  blueprintTaskReconciliationManager.syncWithTaskCards(
    blueprintTaskCardsManager.getSaved(),
  );
  syncChangedFilesTaskLinkWithSources();
  syncArchitectureHealthWithSources();
  syncArtifactIndexWithArtifacts();
}

function buildBlueprintState(): BlueprintState {
  const base = blueprintManager.getState();
  const plannerAi = blueprintPlannerAiManager.getState();
  const phaseTaskCards = blueprintTaskCardsManager.getState();
  const taskCardBuilderHandoff = taskCardBuilderHandoffManager.getState();
  const taskCards = phaseTaskCards.saved;
  const handoff = taskCardBuilderHandoff.saved;
  const handoffTaskId =
    taskCardBuilderHandoff.selectedTaskId ?? handoff?.selectedTaskId ?? null;
  const hasImplementationReview = Boolean(implementationReviewManager.getSaved());
  const taskImplementationIntake = taskImplementationIntakeManager.getState(
    taskCards,
    hasImplementationReview,
    handoffTaskId,
  );
  const activeId = taskCards?.activeTaskId ?? null;
  const activeCard = activeId
    ? taskCards?.cards.find((c) => c.id === activeId)
    : null;
  const activeReport = activeId
    ? taskImplementationIntake.reportsByTaskId[activeId]
    : null;
  const reportCount = Object.keys(taskImplementationIntake.reportsByTaskId).length;
  const taskReconciliation = blueprintTaskReconciliationManager.getState();
  const recon = taskReconciliation.saved;
  const taskArtifactIndex = taskArtifactIndexManager.getState();
  const artifactIndex = taskArtifactIndex.saved;
  const cfLink = changedFilesTaskLinkManager.getSaved();
  const cfScan = changedFilesLastScan;
  return {
    ...base,
    plannerAi,
    phaseTaskCards,
    taskCardBuilderHandoff,
    taskImplementationIntake,
    taskReconciliation,
    taskArtifactIndex,
    status: {
      ...base.status,
      localPlannerDraftExists: Boolean(plannerAi.saved),
      localPlannerDraftSavedAsBlueprint:
        plannerAi.saved?.savedAsImportedBlueprint ?? false,
      localPlannerAiStatus: plannerAi.busy
        ? "running"
        : plannerAi.saved
          ? "ready"
          : "idle",
      taskCardsExist: Boolean(taskCards),
      activeTaskId: activeId,
      nextTaskId: taskCards ? findNextTaskCardId(taskCards) : null,
      blockedTaskCount: taskCards ? countBlockedTaskCards(taskCards) : 0,
      readyToSendTaskCount: taskCards
        ? countReadyToSendTaskCards(taskCards)
        : 0,
      implementationReturnedTaskCount: taskCards
        ? taskCards.cards.filter((c) => c.status === "implementation-returned")
            .length
        : 0,
      taskBuilderHandoffExists: Boolean(handoff && !handoff.stale),
      taskBuilderHandoffSelectedTaskId:
        taskCardBuilderHandoff.selectedTaskId ?? handoff?.selectedTaskId ?? null,
      taskBuilderHandoffReadiness: handoff?.readiness ?? null,
      taskBuilderHandoffStale: Boolean(handoff?.stale),
      taskBuilderHandoffCopied: Boolean(handoff?.copiedAt),
      activeTaskStatus: activeCard?.status ?? null,
      taskImplementationReportCount: reportCount,
      activeTaskHasImplementationReport: Boolean(
        activeReport && !activeReport.stale,
      ),
      activeTaskImplementationReportStale: Boolean(activeReport?.stale),
      pendingMarkImplementationReturned: Boolean(
        activeReport &&
          !activeReport.stale &&
          !activeReport.markedImplementationReturned,
      ),
      taskReconciliationExists: Boolean(recon && !recon.stale),
      taskReconciliationStale: Boolean(recon?.stale),
      taskReconciliationRecommendation: recon?.recommendation ?? null,
      taskReconciliationMissingProducers: recon?.missingProducerCount ?? 0,
      taskReconciliationStatusInconsistencyCount:
        recon?.statusInconsistencyCount ?? 0,
      taskArtifactIndexExists: Boolean(artifactIndex && !artifactIndex.stale),
      taskArtifactIndexStale: Boolean(artifactIndex?.stale),
      taskArtifactIndexRecommendation: artifactIndex?.recommendation ?? null,
      taskArtifactIndexUnlinkedCount: artifactIndex?.unlinkedArtifactCount ?? 0,
      taskArtifactIndexStaleCount: artifactIndex?.staleArtifactCount ?? 0,
      changedFilesScanExists: Boolean(cfScan?.scannedAt && cfScan.isGitRepo),
      changedFilesTaskLinkExists: Boolean(cfLink && !cfLink.stale),
      changedFilesTaskLinkStale: Boolean(cfLink?.stale),
      changedFilesTaskLinkTaskId: cfLink?.taskId ?? null,
      changedFilesTaskLinkScopeWarningCount: cfLink?.warnings?.length ?? 0,
      changedFilesUnlinked: Boolean(
        cfScan?.scannedAt && cfScan.totalCount > 0 && !cfLink,
      ),
    },
  };
}

function persistSessionHistory(): void {
  getHistoryStore().saveCurrentSession({
    project: safetyGate.getProject(),
    userRequest,
    projectSummary,
    reviewPack,
    patchReviewPack,
    changedFilesScan: changedFilesLastScan,
    qwenPromptPack: qwenInspectManager.getState().promptPack,
    advisorResponse,
    externalReview: externalReviewManager.getState().reviews,
    decisionReport,
    builderPrompt,
    builderResult: builderResultManager.getSaved(),
    speakerScript: speakerScriptManager.getSaved(),
    localAiRole,
    builderPlan: builderPlanManager.getSaved(),
    builderPlanComparison: builderPlanComparisonManager.getSaved(),
    implementationReview: implementationReviewManager.getSaved(),
    projectMemoryPreview: projectMemoryManager.getPreview(),
    projectMemoryLastSaved: projectMemoryManager.getLastSaved(),
    codeContextSelectedPaths: codeContextManager.getSelectedPaths(),
    codeContextQuestion: codeContextManager.getState().codeQuestion,
    codeContextQuestionTemplate: codeContextManager.getSelectedTemplate(),
    codeContextMaxLinesPerFile: codeContextManager.getState().maxLinesPerFile,
    codeContextMaxTotalChars: codeContextManager.getState().maxTotalChars,
    codeContextPreview: codeContextManager.getPreview(),
    codeContextAiResponse: codeContextAiManager.getSaved(),
    patchDraftResponse: patchDraftManager.getSaved(),
    patchDraftSafetyReview: patchDraftSafetyReviewManager.getSaved(),
    importedPatchDraft: importedPatchDraftManager.getSaved(),
    externalPatchDraftComparison:
      externalPatchDraftComparisonManager.getSaved(),
    builderHandoffExport: builderHandoffExportManager.getSaved(),
    ...getBlueprintPersistenceFields(),
    lastRecommendedNextAction: getDecisionState().lastRecommendedNextAction,
    backlogItems: backlogManager.getItems(),
    backlogSelectedId: backlogManager.getState().selectedId,
    backlogLastReport: backlogManager.getLastReport(),
    safeChecks: safeCommandRunner.getState(),
    latestCheckpoint: checkpointManager.getLatest(),
    pendingCheckpointMeta: checkpointManager.getPendingRecord(),
    providerSettings: providerRegistry.getSettings(),
    ...(() => {
      const payload = roleModelMappingManager.getPersistencePayload();
      return {
        installedModels: payload.installedModels,
        installedModelsLastRefreshAt: payload.installedModelsLastRefreshAt,
        installedModelsLastRefreshMessage:
          payload.installedModelsLastRefreshMessage,
        installedModelsLastRefreshOk: payload.installedModelsLastRefreshOk,
        roleModelMappings: payload.roleModelMappings,
      };
    })(),
    planningStyle: planningStyleManager.getStyle(),
    reportsPanelCollapse: reportsUiManager.getPersistencePayload(),
    actionLog: safetyGate.getActionLog(),
  });
}

function getFileTreePreviewGenerateContext() {
  const bp = blueprintManager.getState();
  const cards = blueprintTaskCardsManager.getSaved();
  return {
    blueprintImported: Boolean(bp.importedBlueprint),
    blueprintProjectType:
      bp.intake?.projectType ?? DEFAULT_BLUEPRINT_PROJECT_TYPE,
    taskCardCount: cards?.cards?.length ?? 0,
    taskCardsGeneratedAt: cards?.generatedAt ?? null,
    target: safeScaffoldTargetManager.getState(),
  };
}

function getFileContentPreviewGenerateContext() {
  const treeCtx = getFileTreePreviewGenerateContext();
  const treeState = safeScaffoldFileTreePreviewManager.getState(treeCtx);
  return {
    ...treeCtx,
    fileTree: treeState.saved,
  };
}

function getWriteManifestPreviewGenerateContext() {
  const contentCtx = getFileContentPreviewGenerateContext();
  const contentState =
    safeScaffoldFileContentPreviewManager.getState(contentCtx);
  return {
    ...contentCtx,
    fileContent: contentState.saved,
  };
}

function getFinalConfirmationContext() {
  const writeCtx = getWriteManifestPreviewGenerateContext();
  const writeState =
    safeScaffoldWriteManifestPreviewManager.getState(writeCtx);
  return {
    ...writeCtx,
    writeManifest: writeState.saved,
  };
}

function getSafeScaffoldWriteContext() {
  const finalCtx = getFinalConfirmationContext();
  const finalState =
    safeScaffoldFinalConfirmationManager.getState(finalCtx);
  return {
    ...finalCtx,
    finalConfirmation: finalState.saved,
    projectRoot: safetyGate.getProject()?.normalizedPath ?? null,
  };
}

function buildSnapshot(): AppSnapshot {
  const project = safetyGate.getProject();
  return {
    safety: safetyGate.getStatus(),
    provider: providerRegistry.getStatus(),
    providerSettings: providerRegistry.getSettings(),
    actionLog: safetyGate.getActionLog(),
    projectSummary,
    summaryIsFromHistory,
    userRequest,
    reviewPack,
    changedFiles: getChangedFilesState(),
    latestCheckpoint: checkpointManager.getLatest(),
    checkpointBusy,
    checkpointStatusMessage,
    checkpointAvailability: checkpointManager.getAvailability(),
    advisorResponse,
    advisorBusy,
    advisorStatusMessage,
    localAiRole,
    safeChecks: safeCommandRunner.getState(),
    qwen: qwenInspectManager.getState(),
    externalReview: externalReviewManager.getState(),
    builderResult: builderResultManager.getState(),
    speakerScript: speakerScriptManager.getState(),
    builderPlan: builderPlanManager.getState(),
    builderPlanComparison: builderPlanComparisonManager.getState(),
    implementationReview: implementationReviewManager.getState(),
    installedModels: roleModelMappingManager.getInstalledModelsState(),
    roleModelMapping: roleModelMappingManager.getRoleModelMappingState(),
    backlog: backlogManager.getState(),
    decision: getDecisionState(),
    projectMemory: projectMemoryManager.getState(),
    codeContext: codeContextManager.getState(),
    codeContextAi: codeContextAiManager.getState(),
    patchDraft: patchDraftManager.getState(),
    patchDraftSafetyReview: patchDraftSafetyReviewManager.getState(),
    importedPatchDraft: importedPatchDraftManager.getState(),
    externalPatchDraftComparison:
      externalPatchDraftComparisonManager.getState(),
    builderHandoffExport: builderHandoffExportManager.getState(),
    blueprint: buildBlueprintState(),
    planningStyle: planningStyleManager.getState(),
    reportsUi: { panelCollapse: reportsUiManager.getPanelCollapse() },
    architectureHealth: architectureHealthManager.getState(),
    safeScaffoldTarget: safeScaffoldTargetManager.getState(),
    safeScaffoldFileTreePreview: safeScaffoldFileTreePreviewManager.getState(
      getFileTreePreviewGenerateContext(),
    ),
    safeScaffoldFileContentPreview:
      safeScaffoldFileContentPreviewManager.getState(
        getFileContentPreviewGenerateContext(),
      ),
    safeScaffoldWriteManifestPreview:
      safeScaffoldWriteManifestPreviewManager.getState(
        getWriteManifestPreviewGenerateContext(),
      ),
    safeScaffoldFinalConfirmation:
      safeScaffoldFinalConfirmationManager.getState(
        getFinalConfirmationContext(),
      ),
    safeScaffoldWrite: safeScaffoldWriteManager.getState(
      getSafeScaffoldWriteContext(),
    ),
    architectureRefactorTaskCards: architectureRefactorTaskCardsManager.getState(),
    architectureRefactorTaskBuilderHandoff:
      architectureRefactorTaskBuilderHandoffManager.getState(),
    architectureRefactorTaskImplementationIntake:
      getArchitectureRefactorImplementationIntakeState(),
    localAiProgress: localAiProgressTracker.getState(),
    ollamaStatus: ollamaStatusManager.getState(
      providerRegistry.getOllamaStatus(),
      roleModelMappingManager.getInstalledModelsState(),
    ),
    history: getHistoryStore().getUiState(project?.normalizedPath ?? null),
  };
}

function broadcastSnapshot(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.subscribeSnapshot, buildSnapshot());
  }
}

function runProjectSummary(): AppSnapshot {
  if (!safetyGate.getProject()) {
    safetyGate.log(
      "warning",
      "Summarize Project blocked",
      "No project folder selected. Choose a project folder first.",
    );
    return buildSnapshot();
  }

  try {
    projectSummary = projectScanner.scan();
    summaryIsFromHistory = false;
    architectureHealthManager.markStale("Project summary re-scanned.");
    architectureRefactorTaskCardsManager.markStale("Project summary re-scanned.");
    safeScaffoldTargetManager.markStale("Project summary re-scanned.");
    safeScaffoldFileTreePreviewManager.markStale("Project summary re-scanned.");
    safeScaffoldFileContentPreviewManager.markStale(
      "Project summary re-scanned.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Project summary re-scanned.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Project summary re-scanned.",
    );
    safeScaffoldWriteManager.markStale("Project summary re-scanned.");
    architectureRefactorTaskBuilderHandoffManager.markStale(
      "Project summary re-scanned.",
    );
    architectureRefactorTaskImplementationIntakeManager.markStale(
      "Project summary re-scanned.",
    );
    safeCommandRunner.refreshFromSummary(projectSummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    safetyGate.log("warning", "Scan failed", message);
    safeCommandRunner.refreshFromSummary(null);
  }

  persistSessionHistory();
  return buildSnapshot();
}

function runReviewPackGeneration(): AppSnapshot {
  externalReviewManager.refreshComparison({
    advisor: advisorResponse,
    safeChecks: safeCommandRunner.getState(),
  });

  reviewPack = buildOutsideReviewPack({
    userRequest,
    project: safetyGate.getProject(),
    summary: projectSummary,
    summaryIsFromHistory,
    safety: safetyGate.getStatus(),
    provider: providerRegistry.getStatus(),
    checkpoint: checkpointManager.getLatest(),
    checkpointAvailability: checkpointManager.getAvailability(),
    advisorResponse,
    safeChecks: safeCommandRunner.getState(),
    qwen: qwenInspectManager.getState(),
    externalReview: externalReviewManager.getState(),
    history: getHistoryStore().getUiState(
      safetyGate.getProject()?.normalizedPath ?? null,
    ),
    changedFiles: changedFilesLastScan,
    patchReviewPack,
    decisionReport,
    builderPrompt,
    builderResult: builderResultManager.getSaved(),
    backlogItems: backlogManager.getItems(),
    speakerScript: speakerScriptManager.getSaved(),
    builderPlan: builderPlanManager.getSaved(),
    builderPlanComparison: builderPlanComparisonManager.getSaved(),
    implementationReview: implementationReviewManager.getSaved(),
    roleModelMapping: roleModelMappingManager.getRoleModelMappingState(),
    installedModels: roleModelMappingManager.getInstalledModelsState(),
    projectMemoryPreview: projectMemoryManager.getPreview(),
    projectMemoryLastSaved: projectMemoryManager.getLastSaved(),
    codeContextPreview: codeContextManager.getPreview(),
    codeContextAiResponse: codeContextAiManager.getSaved(),
    patchDraftResponse: patchDraftManager.getSaved(),
    patchDraftSafetyReview: patchDraftSafetyReviewManager.getSaved(),
    importedPatchDraft: importedPatchDraftManager.getSaved(),
    externalPatchDraftComparison:
      externalPatchDraftComparisonManager.getSaved(),
    builderHandoffExport: builderHandoffExportManager.getSaved(),
    planningStyle: planningStyleManager.getStyle(),
    codeContextQuestionTemplate: codeContextManager.getSelectedTemplate(),
  });

  const detailParts = [
    reviewPack.projectSelected ? "project selected" : "no project selected",
    reviewPack.summaryAvailable ? "summary included" : "summary unavailable",
    reviewPack.userRequestIncluded ? "request included" : "no request text",
    checkpointManager.getLatest() ? "checkpoint included" : "no checkpoint",
    advisorResponse ? "local AI response included" : "no local AI response",
    safeCommandRunner.getState().lastResult
      ? "safe check result included"
      : "no safe check result",
    qwenInspectManager.getState().promptPack
      ? "qwen prompt pack noted"
      : "no qwen prompt pack",
    externalReviewManager.getState().reviews.length > 0
      ? "external reviews included"
      : "no external reviews",
    builderResultManager.getSaved()
      ? "builder result included"
      : "no builder result",
  ];

  safetyGate.log(
    reviewPack.limitedContext ? "warning" : "success",
    "Review Pack generated",
    detailParts.join("; "),
  );

  if (externalReviewManager.getState().reviews.length > 0) {
    safetyGate.log(
      "info",
      "Review Pack updated with external review",
      `Included ${externalReviewManager.getState().reviews.length} External Review(s) (truncated excerpts).`,
    );
  }

  if (builderResultManager.getSaved()) {
    safetyGate.log(
      "info",
      "Review Pack updated with builder result",
      "Included Builder Result metadata and truncated excerpt (text only).",
    );
  }

  persistSessionHistory();
  return buildSnapshot();
}

function resetSessionForProjectChange(): void {
  projectSummary = null;
  summaryIsFromHistory = false;
  reviewPack = null;
  changedFilesLastScan = null;
  changedFilesStatusMessage = null;
  patchReviewPack = null;
  decisionReport = null;
  builderPrompt = null;
  decisionStatusMessage = null;
  advisorResponse = null;
  advisorStatusMessage = null;
  localAiRole = DEFAULT_LOCAL_AI_ROLE;
  checkpointManager.clearForProjectChange();
  checkpointStatusMessage = null;
  safeCommandRunner.clear();
  qwenInspectManager.clearForProjectChange();
  externalReviewManager.clearForProjectChange();
  builderResultManager.clearForProjectChange();
  builderPlanManager.clearForProjectChange();
  builderPlanComparisonManager.clearForProjectChange();
  implementationReviewManager.clearForProjectChange();
  speakerScriptManager.clearForProjectChange();
  projectMemoryManager.clearForProjectChange();
  codeContextManager.clearForProjectChange();
  codeContextAiManager.clearForProjectChange();
  patchDraftManager.clearForProjectChange();
  importedPatchDraftManager.clearForProjectChange();
  patchDraftSafetyReviewManager.clearForProjectChange();
  externalPatchDraftComparisonManager.clearForProjectChange();
  builderHandoffExportManager.clearForProjectChange();
  blueprintManager.clearForProjectChange();
  blueprintPlannerAiManager.clearForProjectChange();
  blueprintTaskCardsManager.clearForProjectChange();
  taskCardBuilderHandoffManager.clearForProjectChange();
  taskImplementationIntakeManager.clearForProjectChange();
  blueprintTaskReconciliationManager.clearForProjectChange();
  taskArtifactIndexManager.clearForProjectChange();
  changedFilesTaskLinkManager.clearForProjectChange();
  architectureHealthManager.clearForProjectChange();
  safeScaffoldTargetManager.clearForProjectChange();
  safeScaffoldFileTreePreviewManager.clearForProjectChange();
  safeScaffoldFileContentPreviewManager.clearForProjectChange();
  safeScaffoldWriteManifestPreviewManager.clearForProjectChange();
  safeScaffoldFinalConfirmationManager.clearForProjectChange();
  safeScaffoldWriteManager.clearForProjectChange();
  architectureRefactorTaskCardsManager.clearForProjectChange();
  architectureRefactorTaskBuilderHandoffManager.clearForProjectChange();
  architectureRefactorTaskImplementationIntakeManager.clearForProjectChange();
}

function openProjectPath(
  folderPath: string,
  options?: { restoreHistory?: boolean; autoScan?: boolean },
): AppSnapshot {
  const restoreHistory = options?.restoreHistory === true;
  const autoScan = options?.autoScan !== false;

  safetyGate.setProjectRoot(folderPath);
  resetSessionForProjectChange();

  if (restoreHistory) {
    const saved = getHistoryStore().openRecentMetadata(
      safetyGate.getProject()?.normalizedPath ?? folderPath,
    );
    if (saved) {
      userRequest = saved.userRequest || userRequest;
      lastLoggedRequest = userRequest;
      if (saved.projectSummary) {
        projectSummary = saved.projectSummary;
        summaryIsFromHistory = true;
        safeCommandRunner.refreshFromSummary(projectSummary);
      }
      if (saved.reviewPack) {
        reviewPack = saved.reviewPack;
      }
      if (saved.patchReviewPack) {
        patchReviewPack = saved.patchReviewPack;
      }
      if (saved.changedFilesScan) {
        changedFilesLastScan = saved.changedFilesScan;
        changedFilesStatusMessage =
          "Previous changed-files scan restored from history. Re-scan to refresh.";
      }
      if (saved.decisionReport) {
        decisionReport = saved.decisionReport;
      }
      if (saved.builderPrompt) {
        builderPrompt = saved.builderPrompt;
      }
      if (saved.decisionReport || saved.builderPrompt) {
        decisionStatusMessage =
          "Previous Decision Report / Builder Prompt restored from history.";
      }
      if (saved.qwenPromptPack) {
        qwenInspectManager.restorePromptPack(saved.qwenPromptPack);
      }
      if (saved.advisorResponse) {
        advisorResponse = normalizeAdvisorResponse(saved.advisorResponse);
        advisorStatusMessage =
          "Previous saved Local AI role response restored from history.";
      }
      if (isLocalAiRoleId(saved.localAiRole)) {
        localAiRole = saved.localAiRole;
      } else if (advisorResponse?.roleId) {
        localAiRole = advisorResponse.roleId;
      }
      if (saved.externalReviews && saved.externalReviews.length > 0) {
        externalReviewManager.restoreReviews(saved.externalReviews);
      } else if (saved.externalReview) {
        externalReviewManager.restoreSaved(saved.externalReview);
      }
      externalReviewManager.refreshComparison({
        advisor: advisorResponse,
        safeChecks: safeCommandRunner.getState(),
      });
      if (saved.builderResult) {
        builderResultManager.restoreSaved(saved.builderResult);
      }
      if (saved.speakerScript) {
        speakerScriptManager.restoreSaved(saved.speakerScript);
      }
      if (saved.builderPlan) {
        builderPlanManager.restoreSaved(saved.builderPlan);
      }
      if (saved.builderPlanComparison) {
        builderPlanComparisonManager.restoreSaved(saved.builderPlanComparison);
      }
      if (saved.implementationReview) {
        implementationReviewManager.restoreSaved(saved.implementationReview);
      }
      if (saved.projectMemoryPreview || saved.projectMemoryLastSaved) {
        projectMemoryManager.restoreFromHistory(
          saved.projectMemoryPreview,
          saved.projectMemoryLastSaved,
        );
      }
      if (
        saved.codeContextPreview ||
        (saved.codeContextSelectedPaths && saved.codeContextSelectedPaths.length > 0)
      ) {
        codeContextManager.restoreFromHistory({
          selectedPaths: saved.codeContextSelectedPaths ?? [],
          codeQuestion: saved.codeContextQuestion ?? "",
          selectedTemplate: saved.codeContextQuestionTemplate ?? null,
          maxLinesPerFile: saved.codeContextMaxLinesPerFile ?? undefined,
          maxTotalChars: saved.codeContextMaxTotalChars ?? undefined,
          preview: saved.codeContextPreview,
        });
      }
      if (saved.codeContextAiResponse) {
        codeContextAiManager.restoreSaved(saved.codeContextAiResponse);
      }
      if (saved.patchDraftResponse) {
        patchDraftManager.restoreSaved(saved.patchDraftResponse);
      }
      if (saved.patchDraftSafetyReview) {
        patchDraftSafetyReviewManager.restoreSaved(saved.patchDraftSafetyReview);
      }
      if (saved.importedPatchDraft) {
        importedPatchDraftManager.restoreSaved(saved.importedPatchDraft);
      }
      if (saved.externalPatchDraftComparison) {
        externalPatchDraftComparisonManager.restoreSaved(
          saved.externalPatchDraftComparison,
        );
      }
      if (saved.builderHandoffExport) {
        builderHandoffExportManager.restoreSaved(saved.builderHandoffExport);
      }
      blueprintManager.restoreFromHistory({
        intake: saved.blueprintIntake,
        plannerQuestions: saved.blueprintPlannerQuestions,
        plannerPrompt: saved.blueprintPlannerPrompt,
        imported: saved.blueprintImported,
        completeness: saved.blueprintCompletenessReport,
        preview: saved.blueprintPlanningDocsPreview,
        lastSaved: saved.blueprintPlanningDocsLastSaved,
        phase1: saved.blueprintPhase1Handoff,
        draftText: saved.blueprintDraftText ?? "",
        draftSource: saved.blueprintDraftSource ?? "other",
        selectedFile: saved.blueprintSelectedPreviewFile,
      });
      if (saved.blueprintPlannerAiDraft) {
        blueprintPlannerAiManager.restoreSaved(saved.blueprintPlannerAiDraft);
      }
      if (saved.blueprintPhaseTaskCards) {
        blueprintTaskCardsManager.restoreSaved(saved.blueprintPhaseTaskCards);
      }
      taskCardBuilderHandoffManager.restoreFromHistory({
        saved: saved.blueprintTaskCardBuilderHandoff ?? null,
        selectedTaskId: saved.blueprintTaskCardBuilderHandoffSelectedTaskId ?? null,
        target:
          saved.blueprintTaskCardBuilderHandoffTarget ?? "generic-builder",
        strictness:
          saved.blueprintTaskCardBuilderHandoffStrictness ?? "conservative",
      });
      taskImplementationIntakeManager.restoreFromHistory({
        reportsByTaskId: saved.blueprintTaskImplementationReports ?? {},
        selectedTaskId: saved.blueprintTaskImplementationSelectedTaskId ?? null,
        builderSource: saved.blueprintTaskImplementationBuilderSource ?? "Cursor",
      });
      blueprintTaskReconciliationManager.restoreSaved(
        saved.blueprintTaskReconciliation ?? null,
      );
      taskArtifactIndexManager.restoreSaved(saved.blueprintTaskArtifactIndex ?? null);
      changedFilesTaskLinkManager.restoreSaved(
        saved.changedFilesTaskLink ?? null,
        saved.changedFilesTaskLinkSelectedTaskId ?? null,
      );
      architectureHealthManager.restoreSaved(saved.architectureHealth ?? null);
      safeScaffoldTargetManager.restoreSaved(saved.safeScaffoldTarget ?? null);
      safeScaffoldFileTreePreviewManager.restoreSaved(
        saved.safeScaffoldFileTreePreview ?? null,
      );
      safeScaffoldFileContentPreviewManager.restoreSaved(
        saved.safeScaffoldFileContentPreview ?? null,
      );
      safeScaffoldWriteManifestPreviewManager.restoreSaved(
        saved.safeScaffoldWriteManifestPreview ?? null,
      );
      safeScaffoldFinalConfirmationManager.restoreSaved(
        saved.safeScaffoldFinalConfirmation ?? null,
      );
      safeScaffoldWriteManager.restoreSaved(
        saved.safeScaffoldWriteResult ?? null,
      );
      architectureRefactorTaskCardsManager.restoreSaved(
        saved.architectureRefactorTaskCards ?? null,
      );
      architectureRefactorTaskBuilderHandoffManager.restoreFromHistory({
        saved: saved.architectureRefactorTaskBuilderHandoff ?? null,
        selectedTaskId:
          saved.architectureRefactorTaskBuilderHandoffSelectedTaskId ?? null,
        target:
          saved.architectureRefactorTaskBuilderHandoffTarget ?? "generic-builder",
        strictness:
          saved.architectureRefactorTaskBuilderHandoffStrictness ?? "conservative",
      });
      architectureRefactorTaskImplementationIntakeManager.restoreFromHistory({
        reportsByTaskId: saved.architectureRefactorTaskImplementationReports ?? {},
        selectedTaskId:
          saved.architectureRefactorTaskImplementationSelectedTaskId ?? null,
        builderSource: saved.architectureRefactorTaskImplementationBuilderSource ?? "Cursor",
      });
      syncArchitectureHealthWithSources();
      syncTaskCardBuilderHandoffWithCards();
      if (saved.lastCheckpointMeta && !saved.lastCheckpointMeta.isPreUndo) {
        checkpointManager.loadPreviousRecord(saved.lastCheckpointMeta);
      }
      safetyGate.log(
        "success",
        "Recent project opened",
        `Restored previous saved records for ${saved.projectName}. Re-scan to refresh.`,
      );
    } else {
      safetyGate.log(
        "info",
        "Recent project opened",
        "No previous saved records for this project. Summarize Project when ready.",
      );
    }
    persistSessionHistory();
    return buildSnapshot();
  }

  if (autoScan) {
    return runProjectSummary();
  }

  persistSessionHistory();
  return buildSnapshot();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 980,
    minHeight: 680,
    title: "New Type Tech Coder",
    backgroundColor: "#f4f1ea",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    // Packaged: asar root. Unpacked `electron .`: project root. Both contain dist/.
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.getSnapshot, () => buildSnapshot());

  ipcMain.handle(IPC_CHANNELS.selectProjectFolder, async () => {
    if (!mainWindow) {
      return buildSnapshot();
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select Project Folder",
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      safetyGate.log("info", "Folder picker canceled", "No project folder was selected.");
      broadcastSnapshot();
      return buildSnapshot();
    }

    const snapshot = openProjectPath(result.filePaths[0], {
      restoreHistory: false,
      autoScan: true,
    });
    broadcastSnapshot();
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.clearProject, () => {
    safetyGate.clearProject();
    resetSessionForProjectChange();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.openRecentProject, async (_event, projectPath: unknown) => {
    if (typeof projectPath !== "string" || !projectPath.trim()) {
      safetyGate.log(
        "warning",
        "Recent project opened",
        "Open recent blocked — missing project path.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const trimmed = projectPath.trim();
    try {
      if (!fs.existsSync(trimmed) || !fs.statSync(trimmed).isDirectory()) {
        safetyGate.log(
          "warning",
          "Recent project opened",
          `Folder is missing or not a directory: ${trimmed}`,
        );
        broadcastSnapshot();
        return buildSnapshot();
      }
    } catch {
      safetyGate.log(
        "warning",
        "Recent project opened",
        `Could not open recent project path: ${trimmed}`,
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    openProjectPath(trimmed, {
      restoreHistory: true,
      autoScan: false,
    });

    // Stage 29: auto read-only verify when a previous backup record was restored.
    if (
      checkpointManager.getPendingRecord() &&
      !checkpointManager.getAvailability().restorable
    ) {
      checkpointBusy = true;
      checkpointStatusMessage = "Verifying previous Safety Backup (read-only)…";
      broadcastSnapshot();
      try {
        const availability = await checkpointManager.verifyAvailability({
          auto: true,
        });
        checkpointStatusMessage =
          availability.verificationMessage ?? availability.detail;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Backup verification failed.";
        safetyGate.log("warning", "Backup verification failed", message);
        checkpointStatusMessage = message;
      } finally {
        checkpointBusy = false;
        persistSessionHistory();
        broadcastSnapshot();
      }
      return buildSnapshot();
    }

    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearRecentProjects, () => {
    getHistoryStore().clearRecentProjects();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearProjectHistory, () => {
    const project = safetyGate.getProject();
    getHistoryStore().clearProjectHistory(project?.normalizedPath ?? null);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.saveSessionHistory, () => {
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.checkPath, (_event, candidatePath: string) => {
    return safetyGate.checkPath(candidatePath);
  });

  ipcMain.handle(IPC_CHANNELS.logPlaceholderAction, (_event, buttonLabel: string) => {
    safetyGate.recordPlaceholderClick(buttonLabel);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.logUiAction,
    (
      _event,
      level: unknown,
      message: unknown,
      detail?: unknown,
    ) => {
      const allowed: ActionLogLevel[] = ["info", "warning", "blocked", "success"];
      const safeLevel = allowed.includes(level as ActionLogLevel)
        ? (level as ActionLogLevel)
        : "info";
      const safeMessage =
        typeof message === "string" && message.trim()
          ? message.trim().slice(0, 200)
          : "UI action";
      const safeDetail =
        typeof detail === "string" && detail.trim()
          ? detail.trim().slice(0, 500)
          : undefined;
      safetyGate.log(safeLevel, safeMessage, safeDetail);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.summarizeProject, () => {
    const snapshot = runProjectSummary();
    broadcastSnapshot();
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.recordCopySummary, () => {
    if (!projectSummary) {
      safetyGate.log(
        "warning",
        "Copy action blocked",
        "No project summary available to copy yet.",
      );
    } else {
      safetyGate.log(
        "success",
        "Copy action used",
        "Project summary copied for outside review (ChatGPT / Claude / Gemini / Grok).",
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setUserRequest, (_event, text: unknown) => {
    const next = typeof text === "string" ? text.slice(0, 4000) : "";
    userRequest = next;
    const trimmed = next.trim();
    if (trimmed !== lastLoggedRequest.trim()) {
      lastLoggedRequest = next;
      safetyGate.log(
        "info",
        "User request updated",
        trimmed
          ? `Request stored locally (${trimmed.length} characters). Not sent until Ask Local AI.`
          : "Request cleared.",
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateReviewPack, () => {
    const snapshot = runReviewPackGeneration();
    broadcastSnapshot();
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyReviewPack, () => {
    if (!reviewPack) {
      safetyGate.log(
        "warning",
        "Review Pack copy blocked",
        "Generate a Review Pack first.",
      );
    } else {
      safetyGate.log(
        "success",
        "Review Pack copied",
        "Outside Review Pack copied for ChatGPT / Claude / Gemini / Grok.",
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.scanChangedFiles, async () => {
    if (changedFilesBusy) {
      return buildSnapshot();
    }
    if (!safetyGate.getProject()) {
      changedFilesStatusMessage =
        "Select a project folder before scanning changed files.";
      safetyGate.log(
        "warning",
        "Changed-files scan failed",
        changedFilesStatusMessage,
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    changedFilesBusy = true;
    changedFilesStatusMessage = "Scanning changed files (read-only Git)…";
    broadcastSnapshot();

    try {
      const result = await changedFilesDetector.scan();
      changedFilesLastScan = result;
      changedFilesStatusMessage = result.errorMessage
        ? result.errorMessage
        : result.statusMessage;
      syncChangedFilesTaskLinkWithSources();
      architectureHealthManager.markStale("Changed-files scan updated.");
      architectureRefactorTaskCardsManager.markStale("Changed-files scan updated.");
      architectureRefactorTaskBuilderHandoffManager.markStale(
        "Changed-files scan updated.",
      );
      if (changedFilesTaskLinkManager.getSaved()?.stale) {
        taskArtifactIndexManager.markStale("Changed-files scan updated.");
        blueprintTaskReconciliationManager.markStale("Changed-files scan updated.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Changed-file scan failed.";
      changedFilesStatusMessage = message;
      safetyGate.log("warning", "Changed-files scan failed", message);
    } finally {
      changedFilesBusy = false;
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generatePatchReviewPack, () => {
    if (!safetyGate.getProject()) {
      safetyGate.log(
        "warning",
        "Patch Review Pack blocked",
        "Select a project folder first.",
      );
      changedFilesStatusMessage = "Select a project folder first.";
      broadcastSnapshot();
      return buildSnapshot();
    }

    patchReviewPack = buildPatchReviewPack({
      userRequest,
      project: safetyGate.getProject(),
      summary: projectSummary,
      safety: safetyGate.getStatus(),
      provider: providerRegistry.getStatus(),
      checkpoint: checkpointManager.getLatest(),
      safeChecks: safeCommandRunner.getState(),
      changedFiles: changedFilesLastScan,
      reviewPack,
      externalReview: externalReviewManager.getState(),
      decisionReport,
      builderPrompt,
      builderResult: builderResultManager.getSaved(),
      builderPlan: builderPlanManager.getSaved(),
      builderPlanComparison: builderPlanComparisonManager.getSaved(),
      implementationReview: implementationReviewManager.getSaved(),
    });

    safetyGate.log(
      patchReviewPack.limitedContext ? "warning" : "success",
      "Patch Review Pack generated",
      `${patchReviewPack.changedFileCount} changed file(s); ${patchReviewPack.riskyCount} with risk flags.`,
    );
    changedFilesStatusMessage = !changedFilesLastScan?.isGitRepo
      ? NO_GIT_CHANGED_FILES_NOTE
      : patchReviewPack.limitedContext
        ? "Patch Review Pack generated with limited context. Scan changed files (Git) for a fuller report."
        : "Patch Review Pack ready to copy.";
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyPatchReviewPack, () => {
    if (!patchReviewPack) {
      safetyGate.log(
        "warning",
        "Patch Review Pack copy blocked",
        "Generate a Patch Review Pack first.",
      );
    } else {
      safetyGate.log(
        "success",
        "Patch Review Pack copied",
        "Patch Review Pack copied for outside AI review.",
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateDecisionReport, () => {
    externalReviewManager.refreshComparison({
      advisor: advisorResponse,
      safeChecks: safeCommandRunner.getState(),
    });
    decisionReport = buildDecisionReport(getDecisionBuilderInput());
    decisionStatusMessage = decisionReport.limitedContext
      ? "Decision Report generated with limited context."
      : "Decision Report ready to copy.";
    safetyGate.log(
      decisionReport.limitedContext ? "warning" : "success",
      "Decision Report generated",
      `Recommended next action: ${decisionReport.recommendedNextAction.label}`,
    );
    safetyGate.log(
      "info",
      "Recommended next action calculated",
      decisionReport.recommendedNextAction.plainEnglish,
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyDecisionReport, () => {
    if (!decisionReport) {
      safetyGate.log(
        "warning",
        "Decision Report copy blocked",
        "Generate a Decision Report first.",
      );
    } else {
      safetyGate.log(
        "success",
        "Decision Report copied",
        "Decision Report copied for outside review / planning.",
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBuilderPrompt, () => {
    externalReviewManager.refreshComparison({
      advisor: advisorResponse,
      safeChecks: safeCommandRunner.getState(),
    });
    const input = getDecisionBuilderInput();
    if (!decisionReport) {
      decisionReport = buildDecisionReport(input);
      safetyGate.log(
        "info",
        "Decision Report generated",
        "Auto-generated Decision Report before Builder Prompt.",
      );
      safetyGate.log(
        "info",
        "Recommended next action calculated",
        decisionReport.recommendedNextAction.plainEnglish,
      );
    }
    builderPrompt = buildBuilderPromptPack(input, decisionReport);
    logPlanningGuidanceIfEnabled("builder-prompt");
    decisionStatusMessage =
      "Builder Prompt ready (plan-only). Copy and paste into an outside builder AI.";
    safetyGate.log(
      builderPrompt.limitedContext ? "warning" : "success",
      "Builder Prompt generated",
      `Plan-only prompt; recommendation: ${builderPrompt.recommendedNextAction.label}`,
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBuilderPrompt, () => {
    if (!builderPrompt) {
      safetyGate.log(
        "warning",
        "Builder Prompt copy blocked",
        "Generate a Builder Prompt first.",
      );
    } else {
      safetyGate.log(
        "success",
        "Builder Prompt copied",
        "Plan-only Builder Prompt copied for Cursor / Codex / Grok / Claude.",
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.createCheckpoint, async () => {
    if (checkpointBusy) {
      return buildSnapshot();
    }
    if (!safetyGate.getProject()) {
      safetyGate.log(
        "warning",
        "Checkpoint failed",
        "No project folder selected.",
      );
      checkpointStatusMessage = "Select a project folder first.";
      broadcastSnapshot();
      return buildSnapshot();
    }

    checkpointBusy = true;
    checkpointStatusMessage = "Creating checkpoint…";
    broadcastSnapshot();

    try {
      const result = await checkpointManager.createCheckpoint();
      checkpointStatusMessage = result.ok
        ? result.message
        : `Checkpoint failed: ${result.message}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkpoint failed";
      safetyGate.log("warning", "Checkpoint failed", message);
      checkpointStatusMessage = `Checkpoint failed: ${message}`;
    } finally {
      checkpointBusy = false;
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.verifyCheckpoint, async () => {
    if (checkpointBusy) {
      return buildSnapshot();
    }
    if (!safetyGate.getProject()) {
      safetyGate.log(
        "warning",
        "Backup verification failed",
        "No project folder selected.",
      );
      checkpointStatusMessage = "Select a project folder first.";
      broadcastSnapshot();
      return buildSnapshot();
    }

    checkpointBusy = true;
    checkpointStatusMessage = "Verifying Safety Backup (read-only)…";
    broadcastSnapshot();

    try {
      const availability = await checkpointManager.verifyAvailability({
        auto: false,
      });
      checkpointStatusMessage =
        availability.verificationMessage ?? availability.detail;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Backup verification failed.";
      safetyGate.log("warning", "Backup verification failed", message);
      checkpointStatusMessage = message;
    } finally {
      checkpointBusy = false;
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.undoLastCheckpoint, async () => {
    if (checkpointBusy) {
      return buildSnapshot();
    }

    safetyGate.log(
      "info",
      "Undo requested",
      "User confirmed restore to the latest checkpoint.",
    );

    checkpointBusy = true;
    checkpointStatusMessage = "Restoring latest checkpoint…";
    broadcastSnapshot();

    try {
      const result = await checkpointManager.undoLatest();
      checkpointStatusMessage = result.ok
        ? result.message
        : `Undo failed: ${result.message}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo failed";
      safetyGate.log("warning", "Undo failed", message);
      checkpointStatusMessage = `Undo failed: ${message}`;
    } finally {
      checkpointBusy = false;
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.updateProviderSettings,
    (_event, partial: Partial<ProviderSettings>) => {
      const previous = providerRegistry.getSettings();
      const settings = providerRegistry.updateSettings(partial ?? {});

      if (
        typeof partial?.qwenCommand === "string" &&
        normalizeCompare(partial.qwenCommand) !== normalizeCompare(previous.qwenCommand)
      ) {
        qwenInspectManager.setCommand(settings.qwenCommand);
      } else if (settings.qwenCommand !== qwenInspectManager.getCommand()) {
        qwenInspectManager.setCommand(settings.qwenCommand);
      }

      if (partial?.providerType && partial.providerType !== previous.providerType) {
        safetyGate.log(
          "info",
          "Provider settings updated",
          partial.providerType === "qwen-code-inspect"
            ? "Switched to Qwen Code CLI Inspect-Only (Prompt Pack mode; live inspect disabled)."
            : `Switched to Ollama-compatible local advisor · ${settings.baseUrl} · model “${settings.modelName}”.`,
        );
      } else if (
        partial?.baseUrl !== undefined ||
        partial?.modelName !== undefined
      ) {
        safetyGate.log(
          "info",
          "Provider settings updated",
          `Ollama-compatible local model · ${settings.baseUrl} · model “${settings.modelName}”. No credentials stored.`,
        );
      }

      if (
        partial?.baseUrl !== undefined ||
        partial?.modelName !== undefined
      ) {
        ollamaStatusManager.resetNotChecked(
          "Provider base URL or model changed — check Ollama again.",
        );
      }

      persistSessionHistory();
      safetyGate.log(
        "info",
        "Provider settings saved",
        `Saved provider settings locally (no credentials): ${settings.providerType}.`,
      );
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  async function runProviderConnectionTest(
    source: "test-connection" | "bubble-click",
  ): Promise<AppSnapshot> {
    ollamaStatusManager.beginCheck(source);
    broadcastSnapshot();

    try {
      const result = await providerRegistry.testConnection();
      const provider = providerRegistry.getOllamaStatus();
      let modelCount =
        roleModelMappingManager.getInstalledModelsState().models.length;
      if (result.ok || result.availableModels.length > 0) {
        const listResult = await providerRegistry.listInstalledModels();
        roleModelMappingManager.applyRefreshResult(listResult);
        if (listResult.ok) {
          modelCount = listResult.models.length;
          safetyGate.log(
            "success",
            "Installed models refresh succeeded",
            listResult.message,
          );
        }
      }
      ollamaStatusManager.applyTestResult(result, provider, modelCount);
      safetyGate.log(
        result.ok ? "success" : "warning",
        result.ok
          ? "Provider connection test succeeded"
          : "Provider connection test failed",
        result.message,
      );
      advisorStatusMessage = result.message;
      persistSessionHistory();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Local provider is not reachable. Make sure Ollama or a compatible local server is running.";
      ollamaStatusManager.applyTestFailure(
        message,
        providerRegistry.getOllamaStatus(),
      );
      safetyGate.log("warning", "Provider connection test failed", message);
      advisorStatusMessage = message;
    }

    broadcastSnapshot();
    return buildSnapshot();
  }

  ipcMain.handle(IPC_CHANNELS.testProviderConnection, async () => {
    safetyGate.log(
      "info",
      "Provider connection test started",
      "Checking local Ollama-compatible endpoint (no cloud calls).",
    );
    return runProviderConnectionTest("test-connection");
  });

  ipcMain.handle(IPC_CHANNELS.checkOllamaStatus, async () => {
    ollamaStatusManager.logBubbleClicked();
    return runProviderConnectionTest("bubble-click");
  });

  ipcMain.handle(IPC_CHANNELS.refreshInstalledModels, async () => {
    if (roleModelMappingManager.getInstalledModelsState().busy) {
      return buildSnapshot();
    }
    roleModelMappingManager.setBusy(true, "Refreshing installed models…");
    ollamaStatusManager.beginCheck("refresh-models");
    safetyGate.log(
      "info",
      "Installed models refresh started",
      "Listing models from local Ollama-compatible GET /api/tags.",
    );
    broadcastSnapshot();

    try {
      const result = await providerRegistry.listInstalledModels();
      roleModelMappingManager.applyRefreshResult(result);
      ollamaStatusManager.applyRefreshResult(
        result,
        providerRegistry.getOllamaStatus(),
      );
      safetyGate.log(
        result.ok ? "success" : "warning",
        result.ok
          ? "Installed models refresh succeeded"
          : "Installed models refresh failed",
        result.message,
      );
      persistSessionHistory();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Local provider is not reachable. Make sure Ollama or a compatible local server is running.";
      roleModelMappingManager.applyRefreshResult({
        ok: false,
        message,
        models: [],
      });
      ollamaStatusManager.applyRefreshResult(
        { ok: false, message, models: [] },
        providerRegistry.getOllamaStatus(),
      );
      safetyGate.log("warning", "Installed models refresh failed", message);
    }

    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setRoleModelMapping,
    (_event, roleKey: unknown, modelName: unknown) => {
      const ok = roleModelMappingManager.setRoleMapping(roleKey, modelName);
      if (!ok) {
        safetyGate.log(
          "warning",
          "Role model mapping changed",
          "Unknown role mapping key.",
        );
      }
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.suggestRoleModelDefaults, () => {
    roleModelMappingManager.applySuggestedDefaults();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.askLocalAi, async () => {
    if (advisorBusy) {
      return buildSnapshot();
    }

    const role = getLocalAiRole(localAiRole);
    const provider = providerRegistry.getOllamaStatus();
    if (!provider.connected || provider.connectionState !== "ready") {
      safetyGate.log(
        "warning",
        "Local AI role request failed",
        "Ollama-compatible provider is not ready. Configure settings and use Test Connection first.",
      );
      advisorStatusMessage =
        "Ollama-compatible provider is not ready. Configure settings and use Test Connection first.";
      broadcastSnapshot();
      return buildSnapshot();
    }

    if (!projectSummary && !reviewPack && !patchReviewPack && !decisionReport) {
      safetyGate.log(
        "warning",
        "Local AI role request failed",
        "Generate a Project Summary, Review Report, Patch Review Pack, or Decision Report first.",
      );
      advisorStatusMessage =
        "Generate a Project Summary, Review Report, Patch Review Pack, or Decision Report first. Ask Local AI Role only uses those safe reports.";
      broadcastSnapshot();
      return buildSnapshot();
    }

    const settings = providerRegistry.getSettings();
    const modelSelection = resolveLocalAiRoleModel({
      roleId: localAiRole,
      mappings: roleModelMappingManager.getMappings(),
      globalFallbackModel: settings.modelName,
      installedNames: roleModelMappingManager.getInstalledNames(),
    });
    if (!modelSelection.ok || !modelSelection.modelName) {
      safetyGate.log(
        "warning",
        "Local AI role request failed",
        modelSelection.message,
      );
      advisorStatusMessage = modelSelection.message;
      broadcastSnapshot();
      return buildSnapshot();
    }

    const promptBuild = buildMetadataOnlyAdvisorPrompt({
      userRequest,
      summary: projectSummary,
      reviewPack,
      safety: safetyGate.getStatus(),
      provider,
      checkpoint: checkpointManager.getLatest(),
      safeChecks: safeCommandRunner.getState(),
      changedFiles: changedFilesLastScan,
      patchReviewPack,
      externalReview: externalReviewManager.getState(),
      decisionReport,
      builderPrompt,
      builderResult: builderResultManager.getSaved(),
      speakerScript: speakerScriptManager.getSaved(),
      speakerRoleSelected: speakerScriptManager.getRole(),
      localAiRole,
    });

    if (!promptBuild.ok || !promptBuild.prompt) {
      safetyGate.log(
        "warning",
        "Local AI role request failed",
        promptBuild.message,
      );
      advisorStatusMessage = promptBuild.message;
      broadcastSnapshot();
      return buildSnapshot();
    }

    advisorBusy = true;
    advisorStatusMessage = `Asking Local AI Role (${role.label}, model ${modelSelection.modelName}, metadata-only)…`;
    startLocalAiProgress(
      "local-ai-role",
      role.label,
      modelSelection.modelName,
      settings.baseUrl,
    );
    safetyGate.log(
      "info",
      "Local AI role request started",
      `${role.label}: sending metadata-only prompt (${promptBuild.prompt.length} chars). No raw source, secrets, file access, edits, or commands.`,
    );
    safetyGate.log(
      "info",
      modelSelection.source === "role-specific"
        ? "Role-specific model used"
        : "Fallback model used",
      `${role.label}: ${formatModelSelectionSource(modelSelection.source)} → “${modelSelection.modelName}”.`,
    );
    broadcastSnapshot();

    try {
      const result = await providerRegistry.chatMetadataOnly(
        promptBuild.prompt,
        modelSelection.modelName,
      );
      if (!result.ok || !result.responseText) {
        safetyGate.log(
          "warning",
          "Local AI role request failed",
          result.message,
        );
        advisorStatusMessage = formatLocalAiFailureMessage({
          mode: "local-ai-role",
          roleOrModeLabel: role.label,
          modelName: modelSelection.modelName,
          baseUrl: settings.baseUrl,
          underlyingMessage: result.message,
        });
        finishLocalAiProgress(false, role.label, "request failed");
      } else {
        const MAX_RESPONSE = 40_000;
        const text =
          result.responseText.length > MAX_RESPONSE
            ? `${result.responseText.slice(0, MAX_RESPONSE - 1)}…`
            : result.responseText;
        advisorResponse = {
          createdAt: new Date().toISOString(),
          modelName: modelSelection.modelName,
          baseUrl: settings.baseUrl,
          promptCharCount: promptBuild.prompt.length,
          responseText: text,
          truncatedForPack: text.length < result.responseText.length,
          roleId: role.id,
          roleLabel: role.label,
          roleCategory: role.category,
          modelSelectionSource: modelSelection.source ?? undefined,
        };
        const savedAdvisor = advisorResponse;
        safetyGate.log(
          "success",
          "Local AI role request succeeded",
          `${role.label}: received response from “${modelSelection.modelName}” (${text.length} chars)${
            savedAdvisor.truncatedForPack ? " (truncated)" : ""
          }.`,
        );
        advisorStatusMessage = `Local AI role response ready (${role.label} · ${modelSelection.modelName}). This is optional advice — not official app safety status.`;
        finishLocalAiProgress(
          true,
          role.label,
          `response from ${modelSelection.modelName}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Local provider is not reachable. Make sure Ollama or a compatible local server is running.";
      safetyGate.log("warning", "Local AI role request failed", message);
      advisorStatusMessage = formatLocalAiFailureMessage({
        mode: "local-ai-role",
        roleOrModeLabel: role.label,
        modelName: modelSelection.modelName,
        baseUrl: settings.baseUrl,
        underlyingMessage: message,
      });
      finishLocalAiProgress(false, role.label, message);
    } finally {
      advisorBusy = false;
      if (localAiProgressTracker.isActive()) {
        localAiProgressTracker.stop();
      }
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setLocalAiRole,
    (_event, role: unknown) => {
      if (!isLocalAiRoleId(role)) {
        safetyGate.log(
          "warning",
          "Local AI role change blocked",
          "Unknown Local AI role.",
        );
        broadcastSnapshot();
        return buildSnapshot();
      }
      localAiRole = role;
      const def = getLocalAiRole(role);
      safetyGate.log("info", "Local AI role changed", def.label);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setBuilderPlanIncludeExternal,
    (_event, include: unknown) => {
      builderPlanManager.setIncludeExternal(include);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setBuilderPlanIncludeBuilderResult,
    (_event, include: unknown) => {
      builderPlanManager.setIncludeBuilderResult(include);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.generateBuilderPlan, async () => {
    if (builderPlanManager.getState().busy) {
      return buildSnapshot();
    }

    const provider = providerRegistry.getOllamaStatus();
    if (!provider.connected || provider.connectionState !== "ready") {
      safetyGate.log(
        "warning",
        "Builder Plan context missing / provider not ready",
        "Connect a local AI reviewer first.",
      );
      builderPlanManager.setStatus("Connect a local AI reviewer first.");
      broadcastSnapshot();
      return buildSnapshot();
    }

    if (!projectSummary && !reviewPack && !patchReviewPack && !decisionReport) {
      safetyGate.log(
        "warning",
        "Builder Plan context missing / provider not ready",
        "Generate a Project Summary or Review Report first.",
      );
      builderPlanManager.setStatus(
        "Generate a Project Summary or Review Report first.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const options = builderPlanManager.getOptions();
    const promptBuild = buildBuilderPlanPrompt({
      userRequest,
      project: safetyGate.getProject(),
      summary: projectSummary,
      summaryIsFromHistory,
      reviewPack,
      patchReviewPack,
      decisionReport,
      builderPrompt,
      builderResult: builderResultManager.getSaved(),
      externalReview: externalReviewManager.getState(),
      safeChecks: safeCommandRunner.getState(),
      changedFiles: changedFilesLastScan,
      checkpointAvailability: checkpointManager.getAvailability(),
      backlogItems: backlogManager.getItems(),
      speakerScript: speakerScriptManager.getSaved(),
      safety: safetyGate.getStatus(),
      provider,
      options,
      planningStyle: planningStyleManager.getStyle(),
    });

    if (!promptBuild.ok || !promptBuild.prompt) {
      safetyGate.log(
        "warning",
        "Builder Plan context missing / provider not ready",
        promptBuild.message,
      );
      builderPlanManager.setStatus(promptBuild.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    logPlanningGuidanceIfEnabled("builder-plan");

    const settings = providerRegistry.getSettings();
    const modelSelection = resolveBuilderPlanModel({
      mappings: roleModelMappingManager.getMappings(),
      globalFallbackModel: settings.modelName,
      installedNames: roleModelMappingManager.getInstalledNames(),
    });
    if (!modelSelection.ok || !modelSelection.modelName) {
      safetyGate.log(
        "warning",
        "Builder Plan generation failed",
        modelSelection.message,
      );
      builderPlanManager.setStatus(modelSelection.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    builderPlanManager.setBusy(
      true,
      `Generating Builder Plan with “${modelSelection.modelName}” (plan-only)…`,
    );
    startLocalAiProgress(
      "builder-plan-mode",
      "Builder Plan Mode",
      modelSelection.modelName,
      settings.baseUrl,
    );
    safetyGate.log(
      "info",
      "Builder Plan generation started",
      `Sending plan-only metadata prompt (${promptBuild.prompt.length} chars). No raw source, secrets, file access, edits, or commands.`,
    );
    safetyGate.log(
      "info",
      modelSelection.source === "role-specific"
        ? "Role-specific model used"
        : "Fallback model used",
      `Builder Plan Mode: ${formatModelSelectionSource(modelSelection.source)} → “${modelSelection.modelName}”.`,
    );
    broadcastSnapshot();

    try {
      const result = await providerRegistry.chatMetadataOnly(
        promptBuild.prompt,
        modelSelection.modelName,
      );
      if (!result.ok || !result.responseText) {
        safetyGate.log(
          "warning",
          "Builder Plan generation failed",
          result.message,
        );
        builderPlanManager.setStatus(
          formatLocalAiFailureMessage({
            mode: "builder-plan-mode",
            roleOrModeLabel: "Builder Plan Mode",
            modelName: modelSelection.modelName,
            baseUrl: settings.baseUrl,
            underlyingMessage: result.message,
          }),
        );
        finishLocalAiProgress(false, "Builder Plan Mode", "generation failed");
      } else {
        const project = safetyGate.getProject();
        const limitedContext =
          !project ||
          !projectSummary ||
          (!reviewPack && !patchReviewPack && !decisionReport);
        builderPlanManager.saveGenerated({
          planText: result.responseText,
          modelName: modelSelection.modelName,
          providerType: settings.providerType,
          baseUrl: settings.baseUrl,
          userRequest,
          projectName: project?.displayName ?? null,
          projectPath: project?.normalizedPath ?? null,
          includeExternalReviewExcerpt: options.includeExternalReviewExcerpt,
          includeBuilderResultExcerpt: options.includeBuilderResultExcerpt,
          promptCharCount: promptBuild.prompt.length,
          limitedContext,
          modelSelectionSource: modelSelection.source ?? undefined,
        });
        const saved = builderPlanManager.getSaved();
        safetyGate.log(
          "success",
          "Builder Plan generation succeeded",
          `${modelSelection.modelName}: plan ready (${saved?.planText.length ?? 0} chars)${
            saved?.truncated ? " (truncated)" : ""
          }. Plan-only — does not edit files.`,
        );
        finishLocalAiProgress(
          true,
          "Builder Plan Mode",
          `plan ready from ${modelSelection.modelName}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Local provider is not reachable. Make sure Ollama or a compatible local server is running.";
      safetyGate.log("warning", "Builder Plan generation failed", message);
      builderPlanManager.setStatus(
        formatLocalAiFailureMessage({
          mode: "builder-plan-mode",
          roleOrModeLabel: "Builder Plan Mode",
          modelName: modelSelection.modelName,
          baseUrl: settings.baseUrl,
          underlyingMessage: message,
        }),
      );
      finishLocalAiProgress(false, "Builder Plan Mode", message);
    } finally {
      builderPlanManager.setBusy(false);
      if (localAiProgressTracker.isActive()) {
        localAiProgressTracker.stop();
      }
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBuilderPlan, () => {
    builderPlanManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyAdvisorResponse, () => {
    if (!advisorResponse) {
      safetyGate.log(
        "warning",
        "Local AI role response copy blocked",
        "No Local AI role response available yet.",
      );
    } else {
      safetyGate.log(
        "success",
        "Local AI role response copied",
        `${advisorResponse.roleLabel} response copied to clipboard.`,
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.runSafeCheck, async (_event, kind: SafeCheckKind) => {
    const allowedKinds = new Set([
      "build",
      "test",
      "typecheck",
      "lint",
      "check",
      "format:check",
      "validate",
    ]);
    if (typeof kind !== "string" || !allowedKinds.has(kind)) {
      safetyGate.log(
        "blocked",
        "Command blocked",
        "Only allowlisted Safe Check buttons can run commands.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    if (checkpointBusy || advisorBusy) {
      safetyGate.log(
        "blocked",
        "Command blocked",
        "Wait for the current checkpoint or local AI action to finish.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const runPromise = safeCommandRunner.runAllowlistedCheck(kind);
    broadcastSnapshot();
    await runPromise;
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.cancelSafeCheck, async () => {
    await safeCommandRunner.cancelRunning();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyCommandOutput, () => {
    const last = safeCommandRunner.getState().lastResult;
    if (!last || !last.combinedOutput.trim()) {
      safetyGate.log(
        "warning",
        "Command output copy blocked",
        "No safe-check command output available to copy yet.",
      );
    } else {
      safetyGate.log(
        "success",
        "Command output copied",
        `Copied output from “${last.scriptName}” (${last.status}).`,
      );
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.testQwenCli, async () => {
    const settings = providerRegistry.getSettings();
    qwenInspectManager.setCommand(settings.qwenCommand);
    broadcastSnapshot();
    await qwenInspectManager.testCli();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateQwenPromptPack, () => {
    qwenInspectManager.generatePromptPack({
      userRequest,
      project: safetyGate.getProject(),
      summary: projectSummary,
      reviewPack,
      safety: safetyGate.getStatus(),
    });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyQwenPromptPack, () => {
    qwenInspectManager.recordPromptPackCopied();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyQwenReport, () => {
    // Live reports do not exist in Stage 8A; still record the blocked/copy attempt clearly.
    qwenInspectManager.recordReportCopied();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setExternalReviewSource,
    (_event, source: ExternalReviewSource) => {
      externalReviewManager.setSource(source);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.setExternalReviewDraft, (_event, text: unknown) => {
    externalReviewManager.setDraft(text);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setExternalReviewLabel, (_event, label: unknown) => {
    externalReviewManager.setLabel(label);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.saveExternalReview, () => {
    externalReviewManager.save({
      userRequest,
      project: safetyGate.getProject(),
      summary: projectSummary,
      reviewPackExists: Boolean(reviewPack),
      qwen: qwenInspectManager.getState(),
      advisor: advisorResponse,
      safeChecks: safeCommandRunner.getState(),
      changedFiles: changedFilesLastScan,
      patchReviewPack,
    });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.selectExternalReview, (_event, reviewId: unknown) => {
    externalReviewManager.select(reviewId);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.deleteExternalReview, (_event, reviewId: unknown) => {
    externalReviewManager.delete(reviewId);
    externalReviewManager.refreshComparison({
      advisor: advisorResponse,
      safeChecks: safeCommandRunner.getState(),
    });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearExternalReview, () => {
    externalReviewManager.clear();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyExternalReview, (_event, reviewId?: unknown) => {
    externalReviewManager.recordCopied(
      typeof reviewId === "string" ? reviewId : null,
    );
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setBuilderResultSource,
    (_event, source: BuilderResultSource) => {
      builderResultManager.setSource(source);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setBuilderResultResponseType,
    (_event, responseType: BuilderResultResponseType) => {
      builderResultManager.setResponseType(responseType);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.setBuilderResultDraft, (_event, text: unknown) => {
    builderResultManager.setDraft(text);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBuilderResultLabel, (_event, label: unknown) => {
    builderResultManager.setLabel(label);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.saveBuilderResult, () => {
    const backlogItems = backlogManager.getItems();
    const backlogWarningsExisted =
      backlogItems.some(
        (i) =>
          (i.status === "Open" || i.status === "In review") &&
          (i.priority === "Critical" || i.priority === "High"),
      );
    builderResultManager.save({
      userRequest,
      project: safetyGate.getProject(),
      builderPrompt,
      recommendedNextAction: getDecisionState().lastRecommendedNextAction,
      nttcBuilderPlanExisted: Boolean(builderPlanManager.getSaved()),
      decisionReportExisted: Boolean(decisionReport),
      patchReviewPackExisted: Boolean(patchReviewPack),
      backlogWarningsExisted,
      builderPlanComparisonExisted: Boolean(
        builderPlanComparisonManager.getSaved(),
      ),
      safetyBackupVerified: Boolean(
        checkpointManager.getAvailability().restorable,
      ),
    });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearBuilderResult, () => {
    builderResultManager.clear();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBuilderResult, () => {
    builderResultManager.recordCopied();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBuilderPlanComparison, () => {
    const imported = builderResultManager.getSaved();
    if (!imported) {
      safetyGate.log(
        "warning",
        "Comparison missing imported plan",
        "Paste and save a builder plan first.",
      );
      builderPlanComparisonManager.setStatus(
        "Paste a builder plan first. Save a Builder Result with type Builder plan or Revised builder plan (or Plan only).",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    safetyGate.log(
      "info",
      "Builder plan comparison generation started",
      `Comparing imported ${imported.source} / ${imported.responseType} against NTTC reports (rule-based; no Ollama).`,
    );

    const nttcPlan = builderPlanManager.getSaved();
    if (!nttcPlan) {
      safetyGate.log(
        "warning",
        "Comparison generated without NTTC Builder Plan",
        "No NTTC Builder Plan exists yet. Comparison will be weaker.",
      );
    }

    try {
      const record = buildBuilderPlanComparison({
        userRequest,
        imported,
        nttcBuilderPlan: nttcPlan,
        decisionReport,
        patchReviewPack,
        externalReview: externalReviewManager.getState(),
        backlogItems: backlogManager.getItems(),
        checkpointAvailability: checkpointManager.getAvailability(),
        safeChecks: safeCommandRunner.getState(),
        changedFiles: changedFilesLastScan,
        planningStyle: planningStyleManager.getStyle(),
      });
      builderPlanComparisonManager.saveGenerated(record);
      safetyGate.log(
        "success",
        "Builder plan comparison succeeded",
        `Recommendation: ${record.recommendation}${record.weakComparison ? " (weaker — no NTTC Builder Plan)" : ""}.`,
      );
      persistSessionHistory();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Builder Plan Comparison failed unexpectedly.";
      safetyGate.log("warning", "Builder plan comparison failed", message);
      builderPlanComparisonManager.setStatus(message);
    }

    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBuilderPlanComparison, () => {
    builderPlanComparisonManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateImplementationReview, () => {
    const imported = builderResultManager.getSaved();
    if (!imported || imported.responseType !== "Implementation report") {
      safetyGate.log(
        "warning",
        "Implementation review missing implementation report",
        "Paste and save an Implementation report first.",
      );
      implementationReviewManager.setStatus(
        "Paste an implementation report first. Save a Builder Result with type Implementation report.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    safetyGate.log(
      "info",
      "Implementation review generation started",
      `Reviewing imported ${imported.source} / ${imported.responseType} against NTTC reports (rule-based; no Ollama).`,
    );

    const nttcPlan = builderPlanManager.getSaved();
    const comparison = builderPlanComparisonManager.getSaved();
    if (!nttcPlan && !comparison) {
      safetyGate.log(
        "warning",
        "Implementation review generated without approved plan/comparison",
        "No approved plan/comparison exists. Alignment review will be weaker.",
      );
    }

    try {
      const record = buildImplementationReview({
        userRequest,
        imported,
        nttcBuilderPlan: nttcPlan,
        builderPlanComparison: comparison,
        decisionReport,
        patchReviewPack,
        externalReview: externalReviewManager.getState(),
        backlogItems: backlogManager.getItems(),
        checkpointAvailability: checkpointManager.getAvailability(),
        safeChecks: safeCommandRunner.getState(),
        changedFiles: changedFilesLastScan,
      });
      implementationReviewManager.saveGenerated(record);
      taskArtifactIndexManager.markStale("Implementation review generated.");

      const recDetail = record.recommendation;
      if (
        recDetail === "Run Build/Test Checks" ||
        recDetail === "Generate Patch Review Pack" ||
        recDetail === "Restore from Safety Backup" ||
        recDetail === "Do not proceed yet"
      ) {
        safetyGate.log(
          "warning",
          "Implementation review recommends checks/patch/restore/do-not-proceed",
          `Recommendation: ${recDetail}.`,
        );
      }

      safetyGate.log(
        "success",
        "Implementation review succeeded",
        `Recommendation: ${record.recommendation}${record.weakAlignment ? " (weaker — no approved plan/comparison)" : ""}.`,
      );
      persistSessionHistory();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Implementation Review failed unexpectedly.";
      safetyGate.log("warning", "Implementation review failed", message);
      implementationReviewManager.setStatus(message);
    }

    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyImplementationReview, () => {
    implementationReviewManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setSpeakerScriptRole,
    (_event, role: SpeakerScriptRole) => {
      speakerScriptManager.setRole(role);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setSpeakerScriptTone,
    (_event, tone: SpeakerScriptTone) => {
      speakerScriptManager.setTone(tone);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.generateSpeakerScript, () => {
    const record = buildSpeakerScript({
      appVersion: app.getVersion(),
      userRequest,
      project: safetyGate.getProject(),
      summary: projectSummary,
      summaryIsFromHistory,
      reviewPack,
      patchReviewPack,
      decisionReport,
      builderPrompt,
      builderResult: builderResultManager.getSaved(),
      externalReview: externalReviewManager.getState(),
      safeChecks: safeCommandRunner.getState(),
      changedFiles: changedFilesLastScan,
      checkpointAvailability: checkpointManager.getAvailability(),
      backlogItems: backlogManager.getItems(),
      role: speakerScriptManager.getRole(),
      tone: speakerScriptManager.getTone(),
    });
    speakerScriptManager.setSaved(
      record,
      `Speaker Script generated (${record.roleLabel}, ${record.toneLabel}). Text-only — no audio.`,
    );
    safetyGate.log(
      "success",
      "Speaker script generated",
      `${record.roleLabel} / ${record.toneLabel}${
        record.limitedContext ? " (limited context)" : ""
      }.`,
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopySpeakerScript, () => {
    speakerScriptManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateProjectMemoryPreview, () => {
    projectMemoryManager.generatePreview(getProjectMemoryInput());
    logPlanningGuidanceIfEnabled("project-memory");
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.saveProjectMemoryFiles,
    (_event, confirmOverwrite: unknown) => {
      projectMemoryManager.saveFiles(confirmOverwrite === true);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.recordCopyProjectMemoryBundle, () => {
    projectMemoryManager.recordCopyBundle();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.refreshCodeContextFileList, () => {
    codeContextManager.refreshFileList();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setCodeContextFilter, (_event, query: unknown) => {
    codeContextManager.setFilterQuery(query);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setCodeContextFileSelected,
    (_event, relativePath: unknown, selected: unknown) => {
      codeContextManager.setFileSelected(relativePath, selected);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.setCodeContextQuestion, (_event, question: unknown) => {
    codeContextManager.setCodeQuestion(question);
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.applyCodeQuestionTemplate,
    (_event, templateId: unknown, mode: unknown) => {
      codeContextManager.applyQuestionTemplate(templateId, mode);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.clearCodeContextQuestion, () => {
    codeContextManager.clearCodeQuestion();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setCodeContextMaxLinesPerFile,
    (_event, maxLines: unknown) => {
      codeContextManager.setMaxLinesPerFile(maxLines);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setCodeContextMaxTotalChars,
    (_event, maxChars: unknown) => {
      codeContextManager.setMaxTotalChars(maxChars);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.clearCodeContextSelection, () => {
    codeContextManager.clearSelection();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateCodeContextPreview, () => {
    codeContextManager.generatePreview(getCodeContextPreviewInput());
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyCodeContextPack, () => {
    codeContextManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.askLocalAiAboutCodeContext, async () => {
    if (codeContextAiManager.getState().busy) {
      return buildSnapshot();
    }

    const pack = codeContextManager.getPreview();
    if (!pack?.markdownReport?.trim()) {
      safetyGate.log(
        "blocked",
        "Code AI blocked because no context pack exists",
        "Generate a Code Context Pack preview first.",
      );
      codeContextAiManager.setStatus(
        "Generate a Code Context Pack preview first.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const provider = providerRegistry.getOllamaStatus();
    if (!provider.connected || provider.connectionState !== "ready") {
      safetyGate.log(
        "blocked",
        "Code AI blocked because provider/model not ready",
        "Ollama-compatible provider is not ready.",
      );
      codeContextAiManager.setStatus(
        "Ollama-compatible provider is not ready. Configure settings and use Test Connection first.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const settings = providerRegistry.getSettings();
    const modelSelection = resolveCodeContextReviewModel({
      mappings: roleModelMappingManager.getMappings(),
      globalFallbackModel: settings.modelName,
      installedNames: roleModelMappingManager.getInstalledNames(),
    });
    if (!modelSelection.ok || !modelSelection.modelName) {
      safetyGate.log(
        "blocked",
        "Code AI blocked because provider/model not ready",
        modelSelection.message,
      );
      codeContextAiManager.setStatus(modelSelection.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    const templateSelection = codeContextManager.getSelectedTemplate();
    const question =
      codeContextManager.getState().codeQuestion.trim() ||
      userRequest.trim() ||
      pack.userQuestion ||
      templateSelection?.questionText?.trim() ||
      "";

    if (!question.trim()) {
      codeContextAiManager.setStatus(
        "Enter a Code Question or choose a template before asking Local AI.",
      );
      safetyGate.log(
        "warning",
        "Code AI request failed",
        "No code question or template text available.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const promptBuild = buildCodeContextAiPrompt({
      pack,
      userQuestion: question,
      templateLabel: templateSelection?.templateLabel ?? null,
      templateId:
        templateSelection &&
        isCodeQuestionTemplateId(templateSelection.templateId)
          ? templateSelection.templateId
          : null,
      planningStyle: planningStyleManager.getStyle(),
    });
    if (!promptBuild.ok || !promptBuild.prompt) {
      safetyGate.log(
        "warning",
        "Code AI request failed",
        promptBuild.message,
      );
      codeContextAiManager.setStatus(promptBuild.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    codeContextAiManager.setBusy(
      true,
      `Asking Local AI Code Reviewer (model ${modelSelection.modelName})…`,
    );
    startLocalAiProgress(
      "code-context-review",
      "Code Reviewer",
      modelSelection.modelName,
      settings.baseUrl,
    );
    safetyGate.log(
      "info",
      "Code AI request started",
      `Sending approved Code Context Pack only (${promptBuild.prompt.length} chars). No disk reads, edits, or commands.`,
    );
    safetyGate.log(
      "info",
      modelSelection.source === "role-specific"
        ? "Code AI used role-specific model"
        : "Code AI used fallback model",
      `Code Reviewer: ${formatModelSelectionSource(modelSelection.source)} → “${modelSelection.modelName}”.`,
    );
    broadcastSnapshot();

    try {
      const result = await providerRegistry.chatMetadataOnly(
        promptBuild.prompt,
        modelSelection.modelName,
      );
      if (!result.ok || !result.responseText) {
        safetyGate.log(
          "warning",
          "Code AI request failed",
          result.message,
        );
        codeContextAiManager.setStatus(
          formatLocalAiFailureMessage({
            mode: "code-context-review",
            roleOrModeLabel: "Code Reviewer",
            modelName: modelSelection.modelName,
            baseUrl: settings.baseUrl,
            underlyingMessage: result.message,
          }),
        );
        finishLocalAiProgress(false, "Code Reviewer", "request failed");
      } else {
        codeContextAiManager.saveGenerated({
          responseText: result.responseText,
          modelName: modelSelection.modelName,
          providerType: settings.providerType,
          baseUrl: settings.baseUrl,
          userQuestion: question,
          pack,
          promptCharCount: promptBuild.prompt.length,
          modelSelectionSource: modelSelection.source ?? undefined,
          questionTemplateId: templateSelection?.templateId ?? null,
          questionTemplateLabel: templateSelection?.templateLabel ?? null,
        });
        safetyGate.log(
          "success",
          "Code AI request succeeded",
          `Code Reviewer: received response from “${modelSelection.modelName}”. Review/advice only.`,
        );
        finishLocalAiProgress(
          true,
          "Code Reviewer",
          `response from ${modelSelection.modelName}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Local provider is not reachable.";
      safetyGate.log("warning", "Code AI request failed", message);
      codeContextAiManager.setStatus(
        formatLocalAiFailureMessage({
          mode: "code-context-review",
          roleOrModeLabel: "Code Reviewer",
          modelName: modelSelection.modelName,
          baseUrl: settings.baseUrl,
          underlyingMessage: message,
        }),
      );
      finishLocalAiProgress(false, "Code Reviewer", message);
    } finally {
      codeContextAiManager.setBusy(false);
      if (localAiProgressTracker.isActive()) {
        localAiProgressTracker.stop();
      }
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyCodeContextAiResponse, () => {
    codeContextAiManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setPatchDraftIncludeCodeAi,
    (_event, include: unknown) => {
      patchDraftManager.setIncludeCodeAi(include);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setPatchDraftIncludeBuilderPlanDecision,
    (_event, include: unknown) => {
      patchDraftManager.setIncludeBuilderPlanDecision(include);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setPatchDraftIncludeImplementationReview,
    (_event, include: unknown) => {
      patchDraftManager.setIncludeImplementationReview(include);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.generatePatchDraft, async () => {
    if (patchDraftManager.getState().busy) {
      return buildSnapshot();
    }

    const pack = codeContextManager.getPreview();
    if (!pack?.markdownReport?.trim()) {
      safetyGate.log(
        "blocked",
        "Patch draft blocked because no Code Context Pack exists",
        "Generate a Code Context Pack preview first.",
      );
      patchDraftManager.setStatus(
        "Generate a Code Context Pack preview first.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const provider = providerRegistry.getOllamaStatus();
    if (!provider.connected || provider.connectionState !== "ready") {
      safetyGate.log(
        "blocked",
        "Patch draft blocked because provider/model not ready",
        "Ollama-compatible provider is not ready.",
      );
      patchDraftManager.setStatus(
        "Ollama-compatible provider is not ready. Configure settings and use Test Connection first.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const settings = providerRegistry.getSettings();
    const modelSelection = resolvePatchDraftModel({
      mappings: roleModelMappingManager.getMappings(),
      globalFallbackModel: settings.modelName,
      installedNames: roleModelMappingManager.getInstalledNames(),
    });
    if (!modelSelection.ok || !modelSelection.modelName) {
      safetyGate.log(
        "blocked",
        "Patch draft blocked because provider/model not ready",
        modelSelection.message,
      );
      patchDraftManager.setStatus(modelSelection.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    const templateSelection = codeContextManager.getSelectedTemplate();
    const question =
      codeContextManager.getState().codeQuestion.trim() ||
      userRequest.trim() ||
      pack.userQuestion ||
      templateSelection?.questionText?.trim() ||
      "";

    const options = patchDraftManager.getOptions();
    const codeAi = codeContextAiManager.getSaved();
    const builderPlan = builderPlanManager.getSaved();
    const implReview = implementationReviewManager.getSaved();

    const promptBuild = buildPatchDraftPrompt({
      pack,
      userQuestion: question,
      templateLabel: templateSelection?.templateLabel ?? null,
      codeAiExcerpt: options.includeCodeAiResponseExcerpt
        ? codeAi?.previewExcerpt ?? null
        : null,
      builderPlanExcerpt: options.includeBuilderPlanDecisionExcerpt
        ? builderPlan?.previewExcerpt ?? null
        : null,
      decisionReportExcerpt: options.includeBuilderPlanDecisionExcerpt
        ? decisionReport?.previewExcerpt ?? null
        : null,
      implementationReviewExcerpt: options.includeImplementationReviewExcerpt
        ? implReview?.previewExcerpt ?? null
        : null,
      planningStyle: planningStyleManager.getStyle(),
    });
    if (!promptBuild.ok || !promptBuild.prompt) {
      safetyGate.log(
        "warning",
        "Patch draft request failed",
        promptBuild.message,
      );
      patchDraftManager.setStatus(promptBuild.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    logPlanningGuidanceIfEnabled("patch-draft");

    patchDraftManager.setBusy(
      true,
      `Generating Patch Draft with Local AI (model ${modelSelection.modelName})…`,
    );
    startLocalAiProgress(
      "patch-draft-mode",
      "Patch Draft",
      modelSelection.modelName,
      settings.baseUrl,
    );
    safetyGate.log(
      "info",
      "Patch draft request started",
      `Sending approved Code Context Pack only (${promptBuild.prompt.length} chars). Draft only — no edits, commands, or apply.`,
    );
    safetyGate.log(
      "info",
      modelSelection.source === "role-specific"
        ? "Patch draft used role-specific model"
        : "Patch draft used fallback model",
      `Patch Draft: ${formatModelSelectionSource(modelSelection.source)} → “${modelSelection.modelName}”. Optional context: code AI=${options.includeCodeAiResponseExcerpt}, plan/decision=${options.includeBuilderPlanDecisionExcerpt}, implementation=${options.includeImplementationReviewExcerpt}.`,
    );
    broadcastSnapshot();

    try {
      const result = await providerRegistry.chatMetadataOnly(
        promptBuild.prompt,
        modelSelection.modelName,
      );
      if (!result.ok || !result.responseText) {
        safetyGate.log(
          "warning",
          "Patch draft request failed",
          result.message,
        );
        const failMessage = formatLocalAiFailureMessage({
          mode: "patch-draft-mode",
          roleOrModeLabel: "Patch Draft",
          modelName: modelSelection.modelName,
          baseUrl: settings.baseUrl,
          underlyingMessage: result.message,
        });
        patchDraftManager.recordFailure(failMessage);
        finishLocalAiProgress(false, "Patch Draft", "request failed");
      } else {
        patchDraftManager.saveGenerated({
          draftText: result.responseText,
          modelName: modelSelection.modelName,
          providerType: settings.providerType,
          baseUrl: settings.baseUrl,
          userQuestion: question,
          pack,
          promptCharCount: promptBuild.prompt.length,
          modelSelectionSource: modelSelection.source ?? undefined,
          questionTemplateId: templateSelection?.templateId ?? null,
          questionTemplateLabel: templateSelection?.templateLabel ?? null,
          includeCodeAiResponseExcerpt: options.includeCodeAiResponseExcerpt,
          includeBuilderPlanDecisionExcerpt:
            options.includeBuilderPlanDecisionExcerpt,
          includeImplementationReviewExcerpt:
            options.includeImplementationReviewExcerpt,
        });
        safetyGate.log(
          "success",
          "Patch draft request succeeded",
          `Patch Draft: received draft from “${modelSelection.modelName}”. No apply — draft only.`,
        );
        finishLocalAiProgress(
          true,
          "Patch Draft",
          `draft from ${modelSelection.modelName}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Local provider is not reachable.";
      safetyGate.log("warning", "Patch draft request failed", message);
      const failMessage = formatLocalAiFailureMessage({
        mode: "patch-draft-mode",
        roleOrModeLabel: "Patch Draft",
        modelName: modelSelection.modelName,
        baseUrl: settings.baseUrl,
        underlyingMessage: message,
      });
      patchDraftManager.recordFailure(failMessage);
      finishLocalAiProgress(false, "Patch Draft", message);
    } finally {
      patchDraftManager.setBusy(false);
      if (localAiProgressTracker.isActive()) {
        localAiProgressTracker.stop();
      }
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyPatchDraft, () => {
    patchDraftManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generatePatchDraftSafetyReview, () => {
    const target = patchDraftSafetyReviewManager.getReviewTarget();
    const nttcDraft = patchDraftManager.getSaved();
    const importedDraft = importedPatchDraftManager.getSaved();

    let draftForReview = null as import("../shared/types").PatchDraftRecord | null;
    let reviewTargetMeta: import("./review/buildPatchDraftSafetyReview").PatchDraftSafetyReviewTargetMeta | undefined;

    if (target === "imported-patch-draft") {
      if (!importedDraft) {
        safetyGate.log(
          "warning",
          "Patch draft safety review blocked because no imported draft exists",
          "Paste an imported patch draft first.",
        );
        patchDraftSafetyReviewManager.setStatus(
          "Paste an imported patch draft first, then run Patch Draft Safety Review.",
        );
        broadcastSnapshot();
        return buildSnapshot();
      }
      draftForReview = importedRecordToPatchDraftRecord(importedDraft);
      reviewTargetMeta = {
        targetKind: "imported-patch-draft",
        targetLabel: buildReviewTargetLabel("imported-patch-draft", importedDraft),
        importedSource: importedDraft.source,
        importedDraftType: importedDraft.draftType,
        isImported: true,
      };
    } else if (nttcDraft) {
      draftForReview = nttcDraft;
      reviewTargetMeta = {
        targetKind: "nttc-patch-draft",
        targetLabel: buildReviewTargetLabel(
          "nttc-patch-draft",
          null,
          nttcDraft.modelName,
        ),
        importedSource: null,
        importedDraftType: null,
        isImported: false,
      };
    } else {
      safetyGate.log(
        "warning",
        "Patch draft safety review blocked because no Patch Draft exists",
        "Generate a Patch Draft first.",
      );
      const patchState = patchDraftManager.getState();
      patchDraftSafetyReviewManager.setStatus(
        patchState.lastFailureMessage
          ? PATCH_DRAFT_FAILURE_SAFETY_REVIEW_NOTE
          : "Generate a Patch Draft first, then run Patch Draft Safety Review.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    safetyGate.log(
      "info",
      "Patch draft safety review generation started",
      target === "imported-patch-draft"
        ? "Analyzing imported Patch Draft text and safe metadata (rule-based; no Ollama)."
        : "Analyzing Patch Draft text and safe metadata (rule-based; no Ollama).",
    );

    try {
      const record = buildPatchDraftSafetyReview({
        userRequest,
        patchDraft: draftForReview,
        reviewTarget: reviewTargetMeta,
        codeContextPreview: codeContextManager.getPreview(),
        codeContextAiResponse: codeContextAiManager.getSaved(),
        codeContextQuestionTemplate: codeContextManager.getSelectedTemplate(),
        codeQuestion: codeContextManager.getState().codeQuestion,
        decisionReport,
        builderPlan: builderPlanManager.getSaved(),
        implementationReview: implementationReviewManager.getSaved(),
        builderPlanComparison: builderPlanComparisonManager.getSaved(),
        projectMemoryLastSaved: projectMemoryManager.getLastSaved(),
        checkpointAvailability: checkpointManager.getAvailability(),
        safeChecks: safeCommandRunner.getState(),
        backlogItems: backlogManager.getItems(),
        roleModelMapping: roleModelMappingManager.getRoleModelMappingState(),
        changedFiles: changedFilesLastScan,
        planningStyle: planningStyleManager.getStyle(),
      });
      patchDraftSafetyReviewManager.saveGenerated(record);

      if (target === "imported-patch-draft") {
        safetyGate.log(
          "success",
          "Patch draft safety review generated for imported draft",
          `Recommendation: ${record.recommendation}.`,
        );
      }

      const rec = record.recommendation;
      if (rec === "Do not proceed yet") {
        safetyGate.log(
          "warning",
          "Patch draft safety review recommends do-not-proceed",
          record.summaryPlainEnglish,
        );
      } else if (rec === "Select more code context first") {
        safetyGate.log(
          "warning",
          "Patch draft safety review recommends more-context",
          record.summaryPlainEnglish,
        );
      } else if (rec === "Create/verify Safety Backup first") {
        safetyGate.log(
          "warning",
          "Patch draft safety review recommends backup",
          record.summaryPlainEnglish,
        );
      } else if (rec === "Safe to send to outside builder for review") {
        safetyGate.log(
          "info",
          "Patch draft safety review recommends outside-builder-review",
          record.summaryPlainEnglish,
        );
      }

      safetyGate.log(
        "success",
        "Patch draft safety review succeeded",
        `Recommendation: ${record.recommendation}. Flags: ${record.safetyFlagCount}; missing safeguards: ${record.missingSafeguardCount}.`,
      );
      persistSessionHistory();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Patch Draft Safety Review failed unexpectedly.";
      safetyGate.log("warning", "Patch draft safety review failed", message);
      patchDraftSafetyReviewManager.setStatus(message);
    }

    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyPatchDraftSafetyReview, () => {
    patchDraftSafetyReviewManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateExternalPatchDraftComparison, () => {
    const nttcDraft = patchDraftManager.getSaved();
    const importedDraft = importedPatchDraftManager.getSaved();

    if (!nttcDraft && !importedDraft) {
      safetyGate.log(
        "warning",
        "External patch draft comparison missing drafts",
        "Generate or import at least one patch draft before comparing.",
      );
      externalPatchDraftComparisonManager.setStatus(
        "Generate or import at least one patch draft before comparing.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    safetyGate.log(
      "info",
      "External patch draft comparison generation started",
      `NTTC draft: ${nttcDraft ? "yes" : "no"}; imported draft: ${importedDraft ? "yes" : "no"} (rule-based; no AI).`,
    );

    try {
      const result = buildExternalPatchDraftComparison({
        userRequest,
        nttcPatchDraft: nttcDraft,
        importedPatchDraft: importedDraft,
        codeContextAiResponse: codeContextAiManager.getSaved(),
        patchDraftSafetyReview: patchDraftSafetyReviewManager.getSaved(),
        builderPlan: builderPlanManager.getSaved(),
        builderPlanComparison: builderPlanComparisonManager.getSaved(),
        decisionReport,
        implementationReview: implementationReviewManager.getSaved(),
        backlogItems: backlogManager.getItems(),
        checkpointAvailability: checkpointManager.getAvailability(),
        planningStyle: planningStyleManager.getStyle(),
      });

      if (!result.ok) {
        externalPatchDraftComparisonManager.setStatus(result.message);
        safetyGate.log(
          "warning",
          "External patch draft comparison blocked",
          result.message,
        );
        broadcastSnapshot();
        return buildSnapshot();
      }

      const record = result.record;
      externalPatchDraftComparisonManager.saveGenerated(record);
      safetyGate.log(
        "success",
        "External patch draft comparison generated",
        `Risk: ${record.riskLevel}; recommendation: ${record.recommendation}.`,
      );
      if (record.missingInputs.length) {
        safetyGate.log(
          "info",
          "External patch draft comparison missing inputs",
          record.missingInputs.slice(0, 8).join("; "),
        );
      }
      if (record.biggestConflict) {
        safetyGate.log(
          "info",
          "External patch draft comparison biggest conflict",
          record.biggestConflict.slice(0, 240),
        );
      }
      persistSessionHistory();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "External Patch Draft Comparison failed unexpectedly.";
      safetyGate.log(
        "warning",
        "External patch draft comparison failed",
        message,
      );
      externalPatchDraftComparisonManager.setStatus(message);
    }

    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyExternalPatchDraftComparison, () => {
    externalPatchDraftComparisonManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearExternalPatchDraftComparison, () => {
    externalPatchDraftComparisonManager.clearSaved();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBuilderHandoffTarget, (_event, target) => {
    builderHandoffExportManager.setTarget(target);
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBuilderHandoffStrictness, (_event, strictness) => {
    builderHandoffExportManager.setStrictness(strictness);
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBuilderHandoffExport, () => {
    const result = buildBuilderHandoffExport({
      userRequest,
      target: builderHandoffExportManager.getTarget(),
      strictness: builderHandoffExportManager.getStrictness(),
      planningStyle: planningStyleManager.getStyle(),
      nttcPatchDraft: patchDraftManager.getSaved(),
      importedPatchDraft: importedPatchDraftManager.getSaved(),
      patchDraftSafetyReview: patchDraftSafetyReviewManager.getSaved(),
      externalPatchDraftComparison:
        externalPatchDraftComparisonManager.getSaved(),
      builderPlan: builderPlanManager.getSaved(),
      builderPlanComparison: builderPlanComparisonManager.getSaved(),
      decisionReport,
      implementationReview: implementationReviewManager.getSaved(),
      codeContextPreview: codeContextManager.getPreview(),
      codeContextAiResponse: codeContextAiManager.getSaved(),
      projectMemoryLastSaved: projectMemoryManager.getLastSaved(),
      backlogItems: backlogManager.getItems(),
      checkpointAvailability: checkpointManager.getAvailability(),
      safeChecks: safeCommandRunner.getState(),
    });

    if (!result.ok) {
      builderHandoffExportManager.setStatus(result.message);
      safetyGate.log(
        "warning",
        "Builder handoff pack blocked",
        result.message,
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const record = result.record;
    builderHandoffExportManager.saveGenerated(record);
    safetyGate.log(
      "success",
      "Builder handoff pack generated",
      `Target: ${record.target}; recommendation: ${record.recommendation}; missing context: ${record.missingContextCount}.`,
    );
    if (record.missingContextCount > 0) {
      safetyGate.log(
        "info",
        "Builder handoff pack missing context",
        record.missingContextItems.slice(0, 8).join("; "),
      );
    }
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBuilderHandoffExport, () => {
    builderHandoffExportManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearBuilderHandoffExport, () => {
    builderHandoffExportManager.clearSaved();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBlueprintIntake, (_event, patch: unknown) => {
    if (patch && typeof patch === "object") {
      blueprintManager.setIntake(patch as Partial<BlueprintIntake>);
      persistSessionHistory();
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBlueprintPlannerQuestions, () => {
    blueprintManager.generatePlannerQuestions();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBlueprintPlannerPrompt, () => {
    blueprintManager.generatePlannerPrompt(planningStyleManager.getStyle());
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBlueprintDraftSource, (_event, source: unknown) => {
    if (typeof source === "string") {
      blueprintManager.setDraftSource(source as BlueprintSource);
      persistSessionHistory();
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBlueprintDraftText, (_event, text: unknown) => {
    if (typeof text === "string") {
      blueprintManager.setDraftText(text);
      persistSessionHistory();
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.saveImportedBlueprint, () => {
    blueprintManager.saveImportedBlueprint();
    blueprintTaskCardsManager.clear();
    taskCardBuilderHandoffManager.clear();
    safeScaffoldFileTreePreviewManager.markStale("Blueprint imported/saved.");
    safeScaffoldFileContentPreviewManager.markStale("Blueprint imported/saved.");
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Blueprint imported/saved.",
    );
    safeScaffoldFinalConfirmationManager.markStale("Blueprint imported/saved.");
    safeScaffoldWriteManager.markStale("Blueprint imported/saved.");
    syncTaskCardBuilderHandoffWithCards();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearImportedBlueprint, () => {
    blueprintManager.clearImportedBlueprint();
    blueprintTaskCardsManager.clear();
    taskCardBuilderHandoffManager.clear();
    safeScaffoldFileTreePreviewManager.markStale("Blueprint cleared.");
    safeScaffoldFileContentPreviewManager.markStale("Blueprint cleared.");
    safeScaffoldWriteManifestPreviewManager.markStale("Blueprint cleared.");
    safeScaffoldFinalConfirmationManager.markStale("Blueprint cleared.");
    safeScaffoldWriteManager.markStale("Blueprint cleared.");
    syncTaskCardBuilderHandoffWithCards();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.checkBlueprintCompleteness, () => {
    blueprintManager.checkCompleteness();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.previewBlueprintPlanningDocuments, () => {
    blueprintManager.previewPlanningDocuments(
      blueprintTaskCardsManager.getSaved(),
      taskCardBuilderHandoffManager.getSaved(),
      taskImplementationIntakeManager.getReportsByTaskId(),
      blueprintTaskReconciliationManager.getSaved(),
      taskArtifactIndexManager.getSaved(),
      changedFilesTaskLinkManager.getSaved(),
      architectureHealthManager.getSaved(),
      architectureRefactorTaskCardsManager.getSaved(),
      architectureRefactorTaskBuilderHandoffManager.getSaved(),
      architectureRefactorTaskImplementationIntakeManager.getReportsByTaskId(),
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.saveBlueprintPlanningDocuments,
    (_event, confirmOverwrite: unknown) => {
      const result = blueprintManager.savePlanningDocuments(
        confirmOverwrite === true,
      );
      if (result.needsOverwriteConfirmation) {
        broadcastSnapshot();
        return buildSnapshot();
      }
      if (result.ok) {
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.generateBlueprintPhase1Handoff, () => {
    blueprintManager.generatePhase1Handoff(planningStyleManager.getStyle());
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBlueprintPreviewFile, (_event, fileName: unknown) => {
    blueprintManager.setPreviewFile(
      typeof fileName === "string" ? fileName : null,
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBlueprintPlannerQuestions, () => {
    blueprintManager.recordCopyPlannerQuestions();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBlueprintPlannerPrompt, () => {
    blueprintManager.recordCopyPlannerPrompt();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyImportedBlueprint, () => {
    blueprintManager.recordCopyImportedBlueprint();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBlueprintPhase1Handoff, () => {
    blueprintManager.recordCopyPhase1Handoff();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.askLocalPlannerAi, async () => {
    if (blueprintPlannerAiManager.getState().busy) {
      return buildSnapshot();
    }

    const intake = blueprintManager.getState().intake;
    if (!intake.projectIdea.trim()) {
      blueprintPlannerAiManager.setStatus(
        "Describe the project idea before asking Local Planner AI.",
      );
      safetyGate.log(
        "blocked",
        "Local Planner AI blocked",
        "Project idea is empty.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const provider = providerRegistry.getOllamaStatus();
    if (!provider.connected || provider.connectionState !== "ready") {
      safetyGate.log(
        "blocked",
        "Local Planner AI blocked because provider/model not ready",
        "Ollama-compatible provider is not ready.",
      );
      blueprintPlannerAiManager.setStatus(
        "Ollama-compatible provider is not ready. Configure settings and use Test Connection first.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const settings = providerRegistry.getSettings();
    const modelSelection = resolveBlueprintPlannerModel({
      mappings: roleModelMappingManager.getMappings(),
      globalFallbackModel: settings.modelName,
      installedNames: roleModelMappingManager.getInstalledNames(),
    });
    if (!modelSelection.ok || !modelSelection.modelName) {
      safetyGate.log(
        "blocked",
        "Local Planner AI blocked because provider/model not ready",
        modelSelection.message,
      );
      blueprintPlannerAiManager.setStatus(modelSelection.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    const blueprintState = blueprintManager.getState();
    const promptBuild = buildBlueprintPlannerAiOllamaPrompt({
      intake,
      plannerQuestionsMarkdown:
        blueprintState.plannerQuestions?.markdown ?? null,
      planningStyle: planningStyleManager.getStyle(),
    });
    if (!promptBuild.ok || !promptBuild.prompt) {
      blueprintPlannerAiManager.setStatus(promptBuild.message);
      safetyGate.log("warning", "Local Planner AI request failed", promptBuild.message);
      broadcastSnapshot();
      return buildSnapshot();
    }

    if (!promptBuild.plannerQuestionsGenerated) {
      safetyGate.log(
        "info",
        "Local Planner AI warning",
        "Planner questions not generated yet — proceeding with idea fields only.",
      );
    }

    blueprintPlannerAiManager.setBusy(
      true,
      `Asking Local Planner AI (model ${modelSelection.modelName})…`,
    );
    startLocalAiProgress(
      "blueprint-planner",
      "Blueprint Planner",
      modelSelection.modelName,
      settings.baseUrl,
    );
    safetyGate.log(
      "info",
      "Local Planner AI started",
      `Sending idea/planning fields only (${promptBuild.promptCharCount} chars). No project files, Code Context Pack, or commands.`,
    );
    safetyGate.log(
      "info",
      modelSelection.source === "role-specific"
        ? "Local Planner AI used role-specific model"
        : "Local Planner AI used fallback model",
      `Blueprint Planner: ${formatModelSelectionSource(modelSelection.source)} → “${modelSelection.modelName}”.`,
    );
    broadcastSnapshot();

    try {
      const result = await providerRegistry.chatMetadataOnly(
        promptBuild.prompt,
        modelSelection.modelName,
      );
      if (!result.ok || !result.responseText?.trim()) {
        const underlying =
          result.message?.trim() || "Local Planner AI returned an empty response.";
        safetyGate.log("warning", "Local Planner AI failed", underlying);
        blueprintPlannerAiManager.setStatus(
          formatLocalAiFailureMessage({
            mode: "blueprint-planner",
            roleOrModeLabel: "Blueprint Planner",
            modelName: modelSelection.modelName,
            baseUrl: settings.baseUrl,
            underlyingMessage: underlying,
          }),
        );
        finishLocalAiProgress(false, "Blueprint Planner", "request failed");
      } else {
        const progress = localAiProgressTracker.getState();
        const elapsedMs = progress?.startedAt
          ? Math.max(0, Date.now() - new Date(progress.startedAt).getTime())
          : 0;
        blueprintPlannerAiManager.saveGenerated({
          responseText: result.responseText,
          modelName: modelSelection.modelName,
          providerType: settings.providerType,
          baseUrl: settings.baseUrl,
          promptCharCount: promptBuild.promptCharCount,
          plannerQuestionsGenerated: promptBuild.plannerQuestionsGenerated,
          modelSelectionSource: modelSelection.source ?? undefined,
          elapsedMs,
        });
        safetyGate.log(
          "success",
          "Local Planner AI completed",
          `Blueprint Planner: received response from “${modelSelection.modelName}”. Planning text only — review before saving as official blueprint.`,
        );
        finishLocalAiProgress(
          true,
          "Blueprint Planner",
          `response from ${modelSelection.modelName}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Local provider is not reachable.";
      safetyGate.log("warning", "Local Planner AI failed", message);
      blueprintPlannerAiManager.setStatus(
        formatLocalAiFailureMessage({
          mode: "blueprint-planner",
          roleOrModeLabel: "Blueprint Planner",
          modelName: modelSelection.modelName,
          baseUrl: settings.baseUrl,
          underlyingMessage: message,
        }),
      );
      finishLocalAiProgress(false, "Blueprint Planner", message);
    } finally {
      blueprintPlannerAiManager.setBusy(false);
      if (localAiProgressTracker.isActive()) {
        localAiProgressTracker.stop();
      }
      persistSessionHistory();
      broadcastSnapshot();
    }

    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBlueprintPlannerAiDraft, () => {
    blueprintPlannerAiManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.saveBlueprintPlannerDraftAsImported, () => {
    blueprintPlannerAiManager.saveDraftAsImported(blueprintManager);
    blueprintTaskCardsManager.clear();
    taskCardBuilderHandoffManager.clear();
    safeScaffoldFileTreePreviewManager.markStale(
      "Blueprint planner draft saved as imported.",
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Blueprint planner draft saved as imported.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Blueprint planner draft saved as imported.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Blueprint planner draft saved as imported.",
    );
    safeScaffoldWriteManager.markStale(
      "Blueprint planner draft saved as imported.",
    );
    syncTaskCardBuilderHandoffWithCards();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBlueprintPhaseTaskCards, () => {
    blueprintTaskCardsManager.generate(
      blueprintManager,
      planningStyleManager.getStyle(),
    );
    architectureHealthManager.markStale("Blueprint task cards regenerated.");
    safeScaffoldFileTreePreviewManager.markStale(
      "Blueprint task cards regenerated.",
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Blueprint task cards regenerated.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Blueprint task cards regenerated.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Blueprint task cards regenerated.",
    );
    safeScaffoldWriteManager.markStale("Blueprint task cards regenerated.");
    syncTaskCardBuilderHandoffWithCards();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearBlueprintPhaseTaskCards, () => {
    blueprintTaskCardsManager.clear();
    safeScaffoldFileTreePreviewManager.markStale(
      "Blueprint task cards cleared.",
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Blueprint task cards cleared.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Blueprint task cards cleared.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Blueprint task cards cleared.",
    );
    safeScaffoldWriteManager.markStale("Blueprint task cards cleared.");
    syncTaskCardBuilderHandoffWithCards();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setBlueprintPhaseTaskCardStatus,
    (_event, taskId: unknown, status: unknown) => {
      if (
        typeof taskId === "string" &&
        typeof status === "string" &&
        (BLUEPRINT_PHASE_TASK_CARD_STATUSES as readonly string[]).includes(
          status,
        )
      ) {
        blueprintTaskCardsManager.setTaskStatus(
          taskId,
          status as (typeof BLUEPRINT_PHASE_TASK_CARD_STATUSES)[number],
        );
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.resetBlueprintPhaseTaskCardStatus,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string") {
        blueprintTaskCardsManager.resetTaskStatus(taskId);
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setBlueprintActivePhaseTaskCard,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string") {
        blueprintTaskCardsManager.setActiveTaskId(taskId);
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.recordCopyBlueprintPhaseTaskCard,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string") {
        blueprintTaskCardsManager.recordCopy(taskId);
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.recordCopyAllBlueprintPhaseTaskCards, () => {
    blueprintTaskCardsManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setTaskCardBuilderHandoffSelectedTask,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string") {
        taskCardBuilderHandoffManager.setSelectedTaskId(taskId);
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setTaskCardBuilderHandoffTarget,
    (_event, target: unknown) => {
      if (
        typeof target === "string" &&
        BUILDER_HANDOFF_TARGET_OPTIONS.some((o) => o.id === target)
      ) {
        taskCardBuilderHandoffManager.setTarget(
          target as (typeof BUILDER_HANDOFF_TARGET_OPTIONS)[number]["id"],
        );
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setTaskCardBuilderHandoffStrictness,
    (_event, strictness: unknown) => {
      if (
        typeof strictness === "string" &&
        BUILDER_HANDOFF_STRICTNESS_OPTIONS.some((o) => o.id === strictness)
      ) {
        taskCardBuilderHandoffManager.setStrictness(
          strictness as (typeof BUILDER_HANDOFF_STRICTNESS_OPTIONS)[number]["id"],
        );
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.generateTaskCardBuilderHandoff, () => {
    taskCardBuilderHandoffManager.generate(
      blueprintManager,
      blueprintTaskCardsManager,
      planningStyleManager.getStyle(),
    );
    taskArtifactIndexManager.markStale("Task builder handoff generated.");
    syncTaskCardBuilderHandoffWithCards();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearTaskCardBuilderHandoff, () => {
    taskCardBuilderHandoffManager.clear();
    taskArtifactIndexManager.markStale("Task builder handoff cleared.");
    syncTaskCardBuilderHandoffWithCards();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyTaskCardBuilderHandoff, () => {
    taskCardBuilderHandoffManager.recordCopy();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setTaskImplementationIntakeSelectedTask,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string") {
        taskImplementationIntakeManager.setSelectedTaskId(taskId);
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setTaskImplementationIntakeBuilderSource,
    (_event, source: unknown) => {
      taskImplementationIntakeManager.setBuilderSource(source);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setTaskImplementationIntakeDraftText,
    (_event, text: unknown) => {
      taskImplementationIntakeManager.setDraftText(text);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.saveTaskImplementationReport,
    (_event, allowSecretOverride: unknown) => {
      taskImplementationIntakeManager.saveReport({
        taskCards: blueprintTaskCardsManager.getSaved(),
        implementationReviewManager,
        allowSecretOverride: Boolean(allowSecretOverride),
        taskCardHandoff: taskCardBuilderHandoffManager.getSaved(),
      });
      taskArtifactIndexManager.markStale("Implementation report saved.");
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.clearTaskImplementationReport, () => {
    taskImplementationIntakeManager.clearReport();
    taskArtifactIndexManager.markStale("Implementation report cleared.");
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyTaskImplementationReport, () => {
    taskImplementationIntakeManager.recordCopy();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.markTaskImplementationReturned, () => {
    taskImplementationIntakeManager.markImplementationReturned(
      blueprintTaskCardsManager,
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.markTaskImplementationReviewed,
    (_event, confirmWithoutReview: unknown) => {
      taskImplementationIntakeManager.markReviewed({
        taskCardsManager: blueprintTaskCardsManager,
        implementationReviewManager,
        confirmWithoutReview: Boolean(confirmWithoutReview),
      });
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.stageTaskImplementationReportForReview, () => {
    const selectedId =
      taskImplementationIntakeManager.getState(
        blueprintTaskCardsManager.getSaved(),
        Boolean(implementationReviewManager.getSaved()),
        taskCardBuilderHandoffManager.getState().selectedTaskId,
      ).selectedTaskId;
    const record = selectedId
      ? taskImplementationIntakeManager.getReportForTask(selectedId)
      : null;
    if (record && !record.stale) {
      builderResultManager.importTaskImplementationReport({
        taskId: record.taskId,
        taskTitle: record.taskTitle,
        builderSource: record.builderSource,
        reportText: record.reportText,
        taskPhase: record.taskPhase,
        taskArtifactKind: record.taskArtifactKind,
        sourceTaskCardGeneratedAt: record.sourceTaskCardGeneratedAt,
        sourceTaskCardHash: record.sourceTaskCardHash,
        sourceHandoffId: record.sourceHandoffId,
        sourceHandoffGeneratedAt: record.sourceHandoffGeneratedAt,
      });
      taskArtifactIndexManager.markStale("Builder result staged from task report.");
      safetyGate.log(
        "info",
        "Task implementation report staged for Implementation Review",
        record.taskId,
      );
    } else {
      safetyGate.log(
        "warning",
        "Task implementation report stage for review blocked",
        "No saved report for selected task.",
      );
    }
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBlueprintTaskReconciliation, () => {
    const bp = blueprintManager.getState();
    blueprintTaskReconciliationManager.generate({
      taskCards: blueprintTaskCardsManager.getSaved(),
      taskCardHandoff: taskCardBuilderHandoffManager.getSaved(),
      implementationReports: taskImplementationIntakeManager.getReportsByTaskId(),
      completeness: bp.completenessReport,
      planningStyle: planningStyleManager.getStyle(),
      builderResult: builderResultManager.getSaved(),
      changedFilesScan: changedFilesLastScan,
      changedFilesTaskLink: changedFilesTaskLinkManager.getSaved(),
    });
    taskArtifactIndexManager.markStale("Reconciliation report generated.");
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearBlueprintTaskReconciliation, () => {
    blueprintTaskReconciliationManager.clear();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBlueprintTaskReconciliation, () => {
    blueprintTaskReconciliationManager.recordCopy();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateTaskArtifactIndex, () => {
    const bp = blueprintManager.getState();
    taskArtifactIndexManager.generate({
      taskCards: blueprintTaskCardsManager.getSaved(),
      taskCardHandoff: taskCardBuilderHandoffManager.getSaved(),
      implementationReports: taskImplementationIntakeManager.getReportsByTaskId(),
      builderResult: builderResultManager.getSaved(),
      implementationReview: implementationReviewManager.getSaved(),
      taskReconciliation: blueprintTaskReconciliationManager.getSaved(),
      changedFilesScan: changedFilesLastScan,
      changedFilesTaskLink: changedFilesTaskLinkManager.getSaved(),
    });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearTaskArtifactIndex, () => {
    taskArtifactIndexManager.clear();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyTaskArtifactIndex, () => {
    taskArtifactIndexManager.recordCopy();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setTaskArtifactIndexFilter, (_event, taskId) => {
    taskArtifactIndexManager.setFilterTaskId(
      typeof taskId === "string" && taskId.trim() ? taskId.trim() : null,
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setChangedFilesTaskLinkSelectedTask,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string" && taskId.trim()) {
        changedFilesTaskLinkManager.setSelectedTaskId(taskId.trim());
      }
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.linkChangedFilesToTask, () => {
    const taskId =
      changedFilesTaskLinkManager.getSelectedTaskId() ??
      changedFilesTaskLinkManager.getState(getChangedFilesTaskLinkInputs())
        .suggestedTaskId;
    const linked = changedFilesTaskLinkManager.link({
      taskCards: blueprintTaskCardsManager.getSaved(),
      changedFilesScan: changedFilesLastScan,
      taskId: taskId ?? "",
    });
    if (linked) {
      taskArtifactIndexManager.markStale("Changed-files task link created.");
      blueprintTaskReconciliationManager.markStale("Changed-files task link created.");
    }
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearChangedFilesTaskLink, () => {
    changedFilesTaskLinkManager.clear();
    taskArtifactIndexManager.markStale("Changed-files task link cleared.");
    blueprintTaskReconciliationManager.markStale("Changed-files task link cleared.");
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateArchitectureHealthReport, () => {
    const project = safetyGate.getProject();
    architectureRefactorTaskCardsManager.markStale(
      "Architecture Health report regenerating.",
    );
    architectureRefactorTaskBuilderHandoffManager.markStale(
      "Architecture Health report regenerating.",
    );
    architectureRefactorTaskImplementationIntakeManager.markStale(
      "Architecture Health report regenerating.",
    );
    syncArchitectureRefactorImplementationIntake();
    architectureHealthManager.generate({
      projectName: projectSummary?.projectName ?? project?.displayName ?? null,
      projectSummaryScannedAt: projectSummary?.scannedAt ?? null,
      changedFilesScan: changedFilesLastScan,
      changedFilesTaskLink: changedFilesTaskLinkManager.getSaved(),
      taskCards: blueprintTaskCardsManager.getSaved(),
    });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearArchitectureHealthReport, () => {
    architectureHealthManager.clear();
    architectureRefactorTaskCardsManager.markStale(
      "Architecture Health report cleared.",
    );
    architectureRefactorTaskBuilderHandoffManager.markStale(
      "Architecture Health report cleared.",
    );
    architectureRefactorTaskImplementationIntakeManager.markStale(
      "Architecture Health report cleared.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyArchitectureHealthReport, () => {
    architectureHealthManager.recordCopy();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureHealthIncludeTestFiles,
    (_event, include: unknown) => {
      architectureHealthManager.setIncludeTestFiles(include === true);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureHealthIncludeMarkdownDocs,
    (_event, include: unknown) => {
      architectureHealthManager.setIncludeMarkdownDocs(include !== false);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.generateArchitectureRefactorTaskCards, () => {
    architectureRefactorTaskCardsManager.generate({
      architectureHealth: architectureHealthManager.getSaved(),
      planningStyle: planningStyleManager.getStyle(),
    });
    architectureRefactorTaskBuilderHandoffManager.markStale(
      "Architecture Refactor Task Cards regenerated.",
    );
    architectureRefactorTaskImplementationIntakeManager.markStale(
      "Architecture Refactor Task Cards regenerated.",
    );
    architectureRefactorTaskBuilderHandoffManager.syncWithRefactorCards(
      architectureRefactorTaskCardsManager.getSaved(),
    );
    syncArchitectureRefactorImplementationIntake();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearArchitectureRefactorTaskCards, () => {
    architectureRefactorTaskCardsManager.clear();
    architectureRefactorTaskBuilderHandoffManager.syncWithRefactorCards(null);
    syncArchitectureRefactorImplementationIntake();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureRefactorTaskCardStatus,
    (_event, taskId: unknown, status: unknown) => {
      if (typeof taskId !== "string" || typeof status !== "string") {
        return buildSnapshot();
      }
      architectureRefactorTaskCardsManager.setTaskStatus(
        taskId,
        status as import("../shared/architectureRefactorTasks/architectureRefactorTaskConstants").ArchitectureRefactorTaskCardStatus,
      );
      architectureRefactorTaskBuilderHandoffManager.syncWithRefactorCards(
        architectureRefactorTaskCardsManager.getSaved(),
      );
      syncArchitectureRefactorImplementationIntake();
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.resetArchitectureRefactorTaskCardStatus,
    (_event, taskId: unknown) => {
      if (typeof taskId !== "string") return buildSnapshot();
      architectureRefactorTaskCardsManager.resetTaskStatus(taskId);
      architectureRefactorTaskBuilderHandoffManager.syncWithRefactorCards(
        architectureRefactorTaskCardsManager.getSaved(),
      );
      syncArchitectureRefactorImplementationIntake();
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.recordCopyArchitectureRefactorTaskCard,
    (_event, taskId: unknown) => {
      if (typeof taskId !== "string") return buildSnapshot();
      architectureRefactorTaskCardsManager.recordCopy(taskId);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.recordCopyAllArchitectureRefactorTaskCards, () => {
    architectureRefactorTaskCardsManager.recordCopy();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureRefactorTaskBuilderHandoffSelectedTask,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string") {
        architectureRefactorTaskBuilderHandoffManager.setSelectedTaskId(taskId);
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureRefactorTaskBuilderHandoffTarget,
    (_event, target: unknown) => {
      if (typeof target === "string") {
        architectureRefactorTaskBuilderHandoffManager.setTarget(
          target as import("../shared/types").BuilderHandoffTarget,
        );
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureRefactorTaskBuilderHandoffStrictness,
    (_event, strictness: unknown) => {
      if (typeof strictness === "string") {
        architectureRefactorTaskBuilderHandoffManager.setStrictness(
          strictness as import("../shared/types").BuilderHandoffStrictness,
        );
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.generateArchitectureRefactorTaskBuilderHandoff, () => {
    architectureRefactorTaskBuilderHandoffManager.generate({
      architectureHealth: architectureHealthManager.getSaved(),
      refactorTaskCards: architectureRefactorTaskCardsManager.getSaved(),
      planningStyle: planningStyleManager.getStyle(),
      changedFilesScan: changedFilesLastScan,
      changedFilesTaskLink: changedFilesTaskLinkManager.getSaved(),
    });
    architectureRefactorTaskImplementationIntakeManager.markStale(
      "Architecture Refactor Builder Handoff regenerated.",
    );
    syncArchitectureRefactorImplementationIntake();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearArchitectureRefactorTaskBuilderHandoff, () => {
    architectureRefactorTaskBuilderHandoffManager.clear();
    architectureRefactorTaskImplementationIntakeManager.markStale(
      "Architecture Refactor Builder Handoff cleared.",
    );
    syncArchitectureRefactorImplementationIntake();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.recordCopyArchitectureRefactorTaskBuilderHandoff,
    () => {
      architectureRefactorTaskBuilderHandoffManager.recordCopy();
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureRefactorTaskImplementationIntakeSelectedTask,
    (_event, taskId: unknown) => {
      if (typeof taskId === "string") {
        architectureRefactorTaskImplementationIntakeManager.setSelectedTaskId(taskId);
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureRefactorTaskImplementationIntakeBuilderSource,
    (_event, source: unknown) => {
      architectureRefactorTaskImplementationIntakeManager.setBuilderSource(source);
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setArchitectureRefactorTaskImplementationIntakeDraftText,
    (_event, text: unknown) => {
      architectureRefactorTaskImplementationIntakeManager.setDraftText(text);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.saveArchitectureRefactorTaskImplementationReport,
    (_event, allowSecretOverride: unknown) => {
      architectureRefactorTaskImplementationIntakeManager.saveReport({
        refactorTaskCards: architectureRefactorTaskCardsManager.getSaved(),
        implementationReviewManager,
        allowSecretOverride: Boolean(allowSecretOverride),
        refactorHandoff: architectureRefactorTaskBuilderHandoffManager.getSaved(),
        changedFilesScan: changedFilesLastScan,
        changedFilesTaskLink: changedFilesTaskLinkManager.getSaved(),
      });
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.clearArchitectureRefactorTaskImplementationReport, () => {
    architectureRefactorTaskImplementationIntakeManager.clearReport();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.recordCopyArchitectureRefactorTaskImplementationReport,
    () => {
      architectureRefactorTaskImplementationIntakeManager.recordCopy();
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.markArchitectureRefactorTaskImplementationReturned,
    () => {
      architectureRefactorTaskImplementationIntakeManager.markImplementationReturned(
        architectureRefactorTaskCardsManager,
      );
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.markArchitectureRefactorTaskImplementationReviewed,
    (_event, confirmWithoutReview: unknown) => {
      architectureRefactorTaskImplementationIntakeManager.markReviewed({
        refactorCardsManager: architectureRefactorTaskCardsManager,
        implementationReviewManager,
        confirmWithoutReview: Boolean(confirmWithoutReview),
      });
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.stageArchitectureRefactorTaskImplementationReportForReview,
    () => {
      const selectedId = getArchitectureRefactorImplementationIntakeState().selectedTaskId;
      const record = selectedId
        ? architectureRefactorTaskImplementationIntakeManager.getReportForTask(selectedId)
        : null;
      if (record && !record.stale) {
        builderResultManager.importTaskImplementationReport({
          taskId: record.taskId,
          taskTitle: record.taskTitle,
          builderSource: record.builderSource,
          reportText: record.reportText,
          taskPhase: record.taskPhase ?? "architecture-refactor",
          taskArtifactKind: record.taskArtifactKind ?? "Architecture Refactor Implementation Report",
          sourceTaskCardGeneratedAt: record.sourceTaskCardGeneratedAt,
          sourceTaskCardHash: record.sourceTaskCardHash,
          sourceHandoffId: record.sourceHandoffId,
          sourceHandoffGeneratedAt: record.sourceHandoffGeneratedAt,
        });
        safetyGate.log(
          "info",
          "Architecture refactor implementation report staged for Implementation Review",
          record.taskId,
        );
      } else {
        safetyGate.log(
          "warning",
          "Architecture refactor implementation report stage for review blocked",
          "No saved report for selected refactor task.",
        );
      }
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.selectSafeScaffoldTargetFolder, async () => {
    if (!mainWindow) {
      return buildSnapshot();
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select Safe Scaffold Target Folder",
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      safetyGate.log(
        "info",
        "Safe Scaffold target folder picker canceled",
        "No target folder was selected.",
      );
      broadcastSnapshot();
      return buildSnapshot();
    }

    const projectRoot = safetyGate.getProject()?.normalizedPath ?? null;
    safeScaffoldTargetManager.setTargetPath(result.filePaths[0], projectRoot);
    safeScaffoldFileTreePreviewManager.markStale(
      "Safe Scaffold target folder changed.",
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Safe Scaffold target folder changed.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold target folder changed.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold target folder changed.",
    );
    safeScaffoldWriteManager.markStale("Safe Scaffold target folder changed.");
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearSafeScaffoldTargetFolder, () => {
    safeScaffoldTargetManager.clearTarget();
    safeScaffoldFileTreePreviewManager.markStale(
      "Safe Scaffold target folder cleared.",
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Safe Scaffold target folder cleared.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold target folder cleared.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold target folder cleared.",
    );
    safeScaffoldWriteManager.markStale("Safe Scaffold target folder cleared.");
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.refreshSafeScaffoldTargetSafety, () => {
    const projectRoot = safetyGate.getProject()?.normalizedPath ?? null;
    safeScaffoldTargetManager.refreshCheck(projectRoot);
    safeScaffoldFileTreePreviewManager.markStale(
      "Safe Scaffold target folder safety refreshed.",
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Safe Scaffold target folder safety refreshed.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold target folder safety refreshed.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold target folder safety refreshed.",
    );
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold target folder safety refreshed.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateSafeScaffoldFileTreePreview, () => {
    safeScaffoldFileTreePreviewManager.generate(
      getFileTreePreviewGenerateContext(),
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Safe Scaffold file-tree preview regenerated.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold file-tree preview regenerated.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold file-tree preview regenerated.",
    );
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold file-tree preview regenerated.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearSafeScaffoldFileTreePreview, () => {
    safeScaffoldFileTreePreviewManager.clear();
    safeScaffoldFileContentPreviewManager.markStale(
      "Safe Scaffold file-tree preview cleared.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold file-tree preview cleared.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold file-tree preview cleared.",
    );
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold file-tree preview cleared.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopySafeScaffoldFileTreePreview, () => {
    safeScaffoldFileTreePreviewManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateSafeScaffoldFileContentPreview, () => {
    safeScaffoldFileContentPreviewManager.generate(
      getFileContentPreviewGenerateContext(),
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold file-content preview regenerated.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold file-content preview regenerated.",
    );
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold file-content preview regenerated.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearSafeScaffoldFileContentPreview, () => {
    safeScaffoldFileContentPreviewManager.clear();
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold file-content preview cleared.",
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold file-content preview cleared.",
    );
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold file-content preview cleared.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopySafeScaffoldFileContentPreview, () => {
    safeScaffoldFileContentPreviewManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateSafeScaffoldWriteManifestPreview, () => {
    safeScaffoldWriteManifestPreviewManager.generate(
      getWriteManifestPreviewGenerateContext(),
    );
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold write-manifest preview regenerated.",
    );
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold write-manifest preview regenerated.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearSafeScaffoldWriteManifestPreview, () => {
    safeScaffoldWriteManifestPreviewManager.clear();
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold write-manifest preview cleared.",
    );
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold write-manifest preview cleared.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopySafeScaffoldWriteManifestPreview, () => {
    safeScaffoldWriteManifestPreviewManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.recordSafeScaffoldFinalConfirmation,
    (_event, acknowledgements: unknown) => {
      const acks =
        acknowledgements && typeof acknowledgements === "object"
          ? (acknowledgements as Record<string, unknown>)
          : {};
      safeScaffoldFinalConfirmationManager.confirm(
        getFinalConfirmationContext(),
        {
          futureWriteBoundaries: acks.futureWriteBoundaries === true,
          stage127NoWrite: acks.stage127NoWrite === true,
          cautionTarget: acks.cautionTarget === true,
        },
      );
      safeScaffoldWriteManager.markStale(
        "Safe Scaffold final confirmation recorded.",
      );
      persistSessionHistory();
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.clearSafeScaffoldFinalConfirmation, () => {
    safeScaffoldFinalConfirmationManager.clear();
    safeScaffoldWriteManager.markStale(
      "Safe Scaffold final confirmation cleared.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopySafeScaffoldFinalConfirmation, () => {
    safeScaffoldFinalConfirmationManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recheckSafeScaffoldWriteReadiness, () => {
    safeScaffoldWriteManager.recheck(getSafeScaffoldWriteContext());
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.writeSafeScaffoldFiles, async () => {
    if (!mainWindow) {
      return buildSnapshot();
    }

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Cancel", "Create Files"],
      defaultId: 0,
      cancelId: 0,
      title: "Safe Scaffold Write",
      message: SAFE_SCAFFOLD_WRITE_DIALOG_MESSAGE,
      detail: SAFE_SCAFFOLD_WRITE_DIALOG_DETAIL,
    });

    if (response !== 1) {
      safetyGate.log(
        "info",
        "Safe Scaffold write canceled",
        "User declined the write confirmation dialog.",
      );
      return buildSnapshot();
    }

    safeScaffoldWriteManager.write(getSafeScaffoldWriteContext());
    const projectRoot = safetyGate.getProject()?.normalizedPath ?? null;
    safeScaffoldTargetManager.refreshCheck(projectRoot);
    safeScaffoldFinalConfirmationManager.markStale(
      "Safe Scaffold files were written.",
    );
    safeScaffoldFileTreePreviewManager.markStale(
      "Safe Scaffold files were written.",
    );
    safeScaffoldFileContentPreviewManager.markStale(
      "Safe Scaffold files were written.",
    );
    safeScaffoldWriteManifestPreviewManager.markStale(
      "Safe Scaffold files were written.",
    );
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearSafeScaffoldWriteResult, () => {
    safeScaffoldWriteManager.clear();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopySafeScaffoldWriteResult, () => {
    safeScaffoldWriteManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setPlanningStyle, (_event, style) => {
    planningStyleManager.setStyle(style);
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setReportsPanelCollapsed,
    (_event, panelId: unknown, collapsed: unknown) => {
      if (typeof panelId === "string") {
        reportsUiManager.setPanelCollapsed(panelId, collapsed === true);
        persistSessionHistory();
      }
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.applyFastDraftSetup, () => {
    codeContextManager.setMaxLinesPerFile(25);
    patchDraftManager.setIncludeCodeAi(false);
    patchDraftManager.setIncludeBuilderPlanDecision(false);
    patchDraftManager.setIncludeImplementationReview(false);
    codeContextManager.setStatus(FAST_DRAFT_SETUP_MESSAGE);
    safetyGate.log("info", "Fast Draft Setup clicked", FAST_DRAFT_SETUP_MESSAGE);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setPatchDraftSafetyReviewTarget, (_event, target) => {
    patchDraftSafetyReviewManager.setReviewTarget(target);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setImportedPatchDraftSource, (_event, source) => {
    importedPatchDraftManager.setSource(source);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setImportedPatchDraftType, (_event, draftType) => {
    importedPatchDraftManager.setDraftType(draftType);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setImportedPatchDraftDraft, (_event, draftText) => {
    importedPatchDraftManager.setDraft(draftText);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.saveImportedPatchDraft, (_event, allowSecretOverride) => {
    const result = importedPatchDraftManager.saveImported({
      userQuestion: codeContextManager.getState().codeQuestion || userRequest,
      contextAtImport: buildImportedPatchDraftContextSnapshot(),
      allowSecretOverride: Boolean(allowSecretOverride),
    });
    if (result.ok) {
      patchDraftSafetyReviewManager.setReviewTarget("imported-patch-draft");
      persistSessionHistory();
    }
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.clearImportedPatchDraft, () => {
    importedPatchDraftManager.clearImported();
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyImportedPatchDraft, () => {
    importedPatchDraftManager.recordCopy();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBacklogDraftTitle, (_event, title: unknown) => {
    backlogManager.setDraftTitle(title);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.setBacklogDraftType, (_event, type: BacklogItemType) => {
    backlogManager.setDraftType(type);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setBacklogDraftPriority,
    (_event, priority: BacklogPriority) => {
      backlogManager.setDraftPriority(priority);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setBacklogDraftStatus,
    (_event, status: BacklogStatus) => {
      backlogManager.setDraftStatus(status);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.setBacklogDraftNotes, (_event, notes: unknown) => {
    backlogManager.setDraftNotes(notes);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setBacklogDraftRelatedStage,
    (_event, stage: unknown) => {
      backlogManager.setDraftRelatedStage(stage);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setBacklogFilters,
    (_event, filters: Partial<BacklogFilters>) => {
      backlogManager.setFilters(filters);
      broadcastSnapshot();
      return buildSnapshot();
    },
  );

  ipcMain.handle(IPC_CHANNELS.saveBacklogItem, () => {
    backlogManager.saveNew({ project: safetyGate.getProject() });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.updateBacklogItem, () => {
    backlogManager.updateSelected({ project: safetyGate.getProject() });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.selectBacklogItem, (_event, itemId: unknown) => {
    backlogManager.select(itemId);
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.deleteBacklogItem, (_event, itemId: unknown) => {
    backlogManager.delete(itemId);
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBacklogItem, (_event, itemId?: unknown) => {
    backlogManager.recordCopied(typeof itemId === "string" ? itemId : null);
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.generateBacklogReport, () => {
    backlogManager.generateReport({ project: safetyGate.getProject() });
    persistSessionHistory();
    broadcastSnapshot();
    return buildSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.recordCopyBacklogReport, () => {
    backlogManager.recordReportCopied();
    broadcastSnapshot();
    return buildSnapshot();
  });
}

app.whenReady().then(() => {
  safetyGate.initialize();
  getHistoryStore().load();
  const savedSettings = getHistoryStore().getSavedProviderSettings();
  if (savedSettings) {
    providerRegistry.updateSettings(savedSettings);
    qwenInspectManager.setCommand(savedSettings.qwenCommand);
  }
  const savedRoleModels = getHistoryStore().getRoleModelMappingSnapshot();
  roleModelMappingManager.restoreFromHistory({
    models: savedRoleModels.installedModels,
    lastRefreshAt: savedRoleModels.installedModelsLastRefreshAt,
    lastRefreshMessage: savedRoleModels.installedModelsLastRefreshMessage,
    lastRefreshOk: savedRoleModels.installedModelsLastRefreshOk,
    mappings: savedRoleModels.roleModelMappings,
  });
  const savedBacklog = getHistoryStore().getBacklogSnapshot();
  backlogManager.restoreFromHistory(savedBacklog);
  planningStyleManager.restoreSaved(getHistoryStore().getPlanningStyleSnapshot());
  reportsUiManager.loadFromHistory(
    getHistoryStore().getReportsPanelCollapseSnapshot(),
  );
  safetyGate.log(
    "info",
    "App started",
    "New Type Tech Coder — Stage 40 Builder Plan Import / Comparison Upgrade (live Qwen still disabled). Inspect-only. No project auto-opened.",
  );
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
