import fs from "node:fs";
import path from "node:path";
import type {
  ActionLogEntry,
  BacklogItem,
  BacklogReviewReport,
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  BuilderPromptPack,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointRecord,
  CodeContextPack,
  CodeContextAiRecord,
  ExternalPatchDraftComparisonRecord,
  BuilderHandoffExportRecord,
  BlueprintCompletenessReport,
  BlueprintImportedRecord,
  BlueprintIntake,
  BlueprintPlannerPrompt,
  BlueprintPlannerQuestions,
  BlueprintPlannerAiRecord,
  BlueprintPhaseTaskCardsRecord,
  BlueprintTaskReconciliationRecord,
  TaskArtifactIndexRecord,
  ChangedFilesTaskLinkRecord,
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskCardsRecord,
  ArchitectureRefactorTaskBuilderHandoffRecord,
  ArchitectureRefactorTaskImplementationReportRecord,
  TaskCardBuilderHandoffRecord,
  TaskImplementationReportRecord,
  BuilderHandoffTarget,
  BuilderHandoffStrictness,
  Phase1BuilderHandoffRecord,
  PlanningDocumentsPreview,
  PlanningDocumentsSavedRecord,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecord,
  ImportedPatchDraftRecord,
  CodeQuestionTemplateSelection,
  DecisionReport,
  ExternalReviewRecord,
  HistoryUiState,
  ImplementationReviewRecord,
  InstalledOllamaModel,
  LocalAiAdvisorResponse,
  OutsideReviewPack,
  PatchReviewPack,
  ProjectHistoryRecord,
  ProjectInfo,
  ProjectMemoryPreview,
  ProjectMemorySavedRecord,
  ProjectScanResult,
  ProviderSettings,
  QwenPromptPack,
  RecentProjectEntry,
  RecommendedNextAction,
  RoleModelMappingKey,
  SafeChecksState,
  SavedCheckpointMeta,
  SavedSafeCheckSummary,
  SpeakerScriptRecord,
  LocalAiRoleId,
} from "../../shared/types";
import type { SafeScaffoldTargetRecord } from "../../shared/buildModeTargetSafety";
import type { SafeScaffoldFileTreePreviewRecord } from "../../shared/buildModeFileTreePreview";
import type { SafeScaffoldFileContentPreviewRecord } from "../../shared/buildModeFileContentPreview";
import type { SafeScaffoldWriteManifestPreviewRecord } from "../../shared/buildModeWriteManifestPreview";
import type { SafeScaffoldFinalConfirmationRecord } from "../../shared/buildModeFinalConfirmation";
import type { TaskImplementationBuilderSource } from "../../shared/taskImplementationIntakeConstants";
import type { ArchitectureRefactorImplementationBuilderSource } from "../../shared/architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants";
import type { SafetyGate } from "../safety/SafetyGate";
import { DEFAULT_LOCAL_AI_ROLE, isLocalAiRoleId } from "../../shared/localAiRoles";
import { normalizePlanningStyle } from "../../shared/planningStyle";
import type { PlanningStyleId } from "../../shared/types";
import { normalizeRoleModelMappings } from "../../shared/roleModelMapping";
import { DEFAULT_BLUEPRINT_SOURCE } from "../../shared/blueprintConstants";
import type { BlueprintSource } from "../../shared/blueprintConstants";

const HISTORY_VERSION = 1;
const MAX_RECENT_PROJECTS = 12;
const MAX_PROJECT_RECORDS = 30;
const MAX_ACTION_LOG_ENTRIES = 80;
const MAX_BACKLOG_ITEMS = 80;
const MAX_MARKDOWN_CHARS = 40_000;
const MAX_ADVISOR_CHARS = 20_000;
const MAX_EXTERNAL_CHARS = 20_000;
const MAX_BUILDER_RESULT_CHARS = 20_000;
const MAX_SPEAKER_SCRIPT_CHARS = 12_000;
const MAX_BUILDER_PLAN_CHARS = 40_000;
const MAX_BUILDER_PLAN_COMPARISON_CHARS = 40_000;
const MAX_EXTERNAL_PATCH_DRAFT_COMPARISON_CHARS = 40_000;
const MAX_BUILDER_HANDOFF_EXPORT_CHARS = 40_000;
const MAX_BLUEPRINT_IMPORTED_CHARS = 40_000;
const MAX_BLUEPRINT_PROMPT_CHARS = 20_000;
const MAX_BLUEPRINT_PLANNER_AI_CHARS = 40_000;
const MAX_PHASE1_HANDOFF_CHARS = 20_000;
const MAX_IMPLEMENTATION_REVIEW_CHARS = 40_000;
const MAX_PATCH_DRAFT_SAFETY_REVIEW_CHARS = 40_000;
const MAX_PROJECT_MEMORY_FILE_CHARS = 12_000;
const MAX_PROJECT_MEMORY_BUNDLE_CHARS = 24_000;
const MAX_CODE_CONTEXT_PACK_CHARS = 24_000;
const MAX_CODE_CONTEXT_AI_CHARS = 20_000;
const MAX_PATCH_DRAFT_CHARS = 20_000;
const MAX_IMPORTED_PATCH_DRAFT_CHARS = 20_000;
const MAX_CODE_CONTEXT_SELECTED_PATHS = 20;
const MAX_BACKLOG_NOTES_CHARS = 20_000;
const MAX_SAFE_CHECK_OUTPUT_CHARS = 4_000;
const MAX_USER_REQUEST_CHARS = 4_000;

export const HISTORY_PRIVACY_NOTE =
  "History is stored locally on this computer in app data. It does not upload to cloud services. History stores summaries and reports only, not raw source code or secrets.";

interface HistoryFileShape {
  version: number;
  updatedAt: string;
  recentProjects: RecentProjectEntry[];
  providerSettings: ProviderSettings | null;
  /** Stage 38A: cached installed Ollama models (app-owned, no credentials). */
  installedModels: InstalledOllamaModel[];
  installedModelsLastRefreshAt: string | null;
  installedModelsLastRefreshMessage: string | null;
  installedModelsLastRefreshOk: boolean | null;
  /** Stage 38A: role → model mappings. */
  roleModelMappings: Record<RoleModelMappingKey, string> | null;
  /** Stage 69: planning style preset. */
  planningStyle: PlanningStyleId | null;
  /** Stage 76: Reports tab workflow panel collapse preferences. */
  reportsPanelCollapse: Record<string, boolean> | null;
  actionLog: ActionLogEntry[];
  /** Stage 21: global app-owned backlog (optional project association). */
  backlogItems: BacklogItem[];
  backlogSelectedId: string | null;
  backlogLastReport: BacklogReviewReport | null;
  projects: Record<string, ProjectHistoryRecord>;
}

function emptyFile(): HistoryFileShape {
  return {
    version: HISTORY_VERSION,
    updatedAt: new Date().toISOString(),
    recentProjects: [],
    providerSettings: null,
    installedModels: [],
    installedModelsLastRefreshAt: null,
    installedModelsLastRefreshMessage: null,
    installedModelsLastRefreshOk: null,
    roleModelMappings: null,
    planningStyle: null,
    reportsPanelCollapse: null,
    actionLog: [],
    backlogItems: [],
    backlogSelectedId: null,
    backlogLastReport: null,
    projects: {},
  };
}

function normalizeKey(projectPath: string): string {
  return path.resolve(projectPath).replace(/\//g, "\\").toLowerCase();
}

function truncateText(
  text: string,
  max: number,
  label: string,
  notes: string[],
): string {
  if (text.length <= max) return text;
  notes.push(`${label} was truncated before saving (${text.length} → ${max} characters).`);
  return `${text.slice(0, max)}\n\n…(truncated for local history size)`;
}

function pathExists(projectPath: string): boolean {
  try {
    return fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
  } catch {
    return false;
  }
}

/** Stage 17: upgrade older single externalReview history into externalReviews[]. */
function migrateProjectRecords(
  projects: Record<string, ProjectHistoryRecord>,
): Record<string, ProjectHistoryRecord> {
  const next: Record<string, ProjectHistoryRecord> = {};
  for (const [key, record] of Object.entries(projects)) {
    if (!record || typeof record !== "object") continue;
    let externalReviews = Array.isArray(record.externalReviews)
      ? record.externalReviews
      : [];
    if (externalReviews.length === 0 && record.externalReview) {
      externalReviews = [record.externalReview];
    }
    externalReviews = externalReviews
      .slice()
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
      .slice(0, 20)
      .map((review) => ({
        ...review,
        label: review.label ?? null,
        truncated: Boolean(review.truncated),
        associatedChangedFilesScanAt:
          review.associatedChangedFilesScanAt ?? null,
        associatedPatchPackAt: review.associatedPatchPackAt ?? null,
      }));
    next[key] = {
      ...record,
      externalReviews,
      externalReview: externalReviews[0] ?? record.externalReview ?? null,
      speakerScript: record.speakerScript ?? null,
      builderPlan: record.builderPlan ?? null,
      builderPlanComparison: record.builderPlanComparison ?? null,
      implementationReview: record.implementationReview ?? null,
      localAiRole: isLocalAiRoleId(record.localAiRole)
        ? record.localAiRole
        : record.advisorResponse && isLocalAiRoleId(record.advisorResponse.roleId)
          ? record.advisorResponse.roleId
          : null,
      projectMemoryPreview: record.projectMemoryPreview ?? null,
      projectMemoryLastSaved: record.projectMemoryLastSaved ?? null,
      codeContextSelectedPaths: record.codeContextSelectedPaths ?? [],
      codeContextQuestion: record.codeContextQuestion ?? "",
      codeContextQuestionTemplate: record.codeContextQuestionTemplate ?? null,
      codeContextMaxLinesPerFile: record.codeContextMaxLinesPerFile ?? null,
      codeContextMaxTotalChars: record.codeContextMaxTotalChars ?? null,
      codeContextPreview: record.codeContextPreview ?? null,
      codeContextAiResponse: record.codeContextAiResponse ?? null,
      patchDraftResponse: record.patchDraftResponse ?? null,
      patchDraftSafetyReview: record.patchDraftSafetyReview ?? null,
      importedPatchDraft: record.importedPatchDraft ?? null,
      externalPatchDraftComparison: record.externalPatchDraftComparison ?? null,
      builderHandoffExport: record.builderHandoffExport ?? null,
      blueprintIntake: record.blueprintIntake ?? null,
      blueprintPlannerQuestions: record.blueprintPlannerQuestions ?? null,
      blueprintPlannerPrompt: record.blueprintPlannerPrompt ?? null,
      blueprintImported: record.blueprintImported ?? null,
      blueprintCompletenessReport: record.blueprintCompletenessReport ?? null,
      blueprintPlanningDocsPreview: record.blueprintPlanningDocsPreview ?? null,
      blueprintPlanningDocsLastSaved: record.blueprintPlanningDocsLastSaved ?? null,
      blueprintPhase1Handoff: record.blueprintPhase1Handoff ?? null,
      blueprintDraftText: record.blueprintDraftText ?? "",
      blueprintDraftSource: record.blueprintDraftSource ?? DEFAULT_BLUEPRINT_SOURCE,
      blueprintSelectedPreviewFile: record.blueprintSelectedPreviewFile ?? null,
      blueprintPlannerAiDraft: record.blueprintPlannerAiDraft ?? null,
      blueprintPhaseTaskCards: record.blueprintPhaseTaskCards ?? null,
      blueprintTaskCardBuilderHandoff: record.blueprintTaskCardBuilderHandoff ?? null,
      blueprintTaskCardBuilderHandoffSelectedTaskId:
        record.blueprintTaskCardBuilderHandoffSelectedTaskId ?? null,
      blueprintTaskCardBuilderHandoffTarget:
        record.blueprintTaskCardBuilderHandoffTarget ?? null,
      blueprintTaskCardBuilderHandoffStrictness:
        record.blueprintTaskCardBuilderHandoffStrictness ?? null,
      blueprintTaskImplementationReports:
        record.blueprintTaskImplementationReports ?? null,
      blueprintTaskImplementationSelectedTaskId:
        record.blueprintTaskImplementationSelectedTaskId ?? null,
      blueprintTaskImplementationBuilderSource:
        record.blueprintTaskImplementationBuilderSource ?? null,
      blueprintTaskReconciliation: record.blueprintTaskReconciliation ?? null,
      blueprintTaskArtifactIndex: record.blueprintTaskArtifactIndex ?? null,
      changedFilesTaskLink: record.changedFilesTaskLink ?? null,
      changedFilesTaskLinkSelectedTaskId:
        record.changedFilesTaskLinkSelectedTaskId ?? null,
      architectureHealth: record.architectureHealth ?? null,
      safeScaffoldTarget: record.safeScaffoldTarget ?? null,
      safeScaffoldFileTreePreview: record.safeScaffoldFileTreePreview ?? null,
      safeScaffoldFileContentPreview:
        record.safeScaffoldFileContentPreview ?? null,
      safeScaffoldWriteManifestPreview:
        record.safeScaffoldWriteManifestPreview ?? null,
      safeScaffoldFinalConfirmation:
        record.safeScaffoldFinalConfirmation ?? null,
      architectureRefactorTaskCards: record.architectureRefactorTaskCards ?? null,
      architectureRefactorTaskBuilderHandoff:
        record.architectureRefactorTaskBuilderHandoff ?? null,
      architectureRefactorTaskBuilderHandoffSelectedTaskId:
        record.architectureRefactorTaskBuilderHandoffSelectedTaskId ?? null,
      architectureRefactorTaskBuilderHandoffTarget:
        record.architectureRefactorTaskBuilderHandoffTarget ?? null,
      architectureRefactorTaskBuilderHandoffStrictness:
        record.architectureRefactorTaskBuilderHandoffStrictness ?? null,
      architectureRefactorTaskImplementationReports:
        record.architectureRefactorTaskImplementationReports ?? null,
      architectureRefactorTaskImplementationSelectedTaskId:
        record.architectureRefactorTaskImplementationSelectedTaskId ?? null,
      architectureRefactorTaskImplementationBuilderSource:
        record.architectureRefactorTaskImplementationBuilderSource ?? null,
    };
  }
  return next;
}

/**
 * Stage 9: App-owned JSON history under Electron userData.
 * Never writes into the selected project folder.
 * Never stores raw source trees, secrets, or full checkpoint snapshots.
 */
export class HistoryStore {
  private data: HistoryFileShape = emptyFile();
  private loaded = false;
  private statusMessage: string | null = null;
  private warning: string | null = null;
  private readonly filePath: string;

  constructor(
    private readonly safetyGate: SafetyGate,
    userDataRoot: string,
  ) {
    const dir = path.join(userDataRoot, "history");
    this.filePath = path.join(dir, "session-history.json");
  }

  getUiState(currentProjectPath: string | null): HistoryUiState {
    const recent = this.data.recentProjects.map((entry) => ({
      ...entry,
      pathMissing: !pathExists(entry.projectPath),
    }));

    let current: ProjectHistoryRecord | null = null;
    if (currentProjectPath) {
      current = this.data.projects[normalizeKey(currentProjectPath)] ?? null;
    }

    return {
      loaded: this.loaded,
      recentProjects: recent,
      currentProjectHistory: current,
      statusMessage: this.statusMessage,
      warning: this.warning,
      privacyNote: HISTORY_PRIVACY_NOTE,
    };
  }

  getSavedProviderSettings(): ProviderSettings | null {
    return this.data.providerSettings ? { ...this.data.providerSettings } : null;
  }

  getRoleModelMappingSnapshot(): {
    installedModels: InstalledOllamaModel[];
    installedModelsLastRefreshAt: string | null;
    installedModelsLastRefreshMessage: string | null;
    installedModelsLastRefreshOk: boolean | null;
    roleModelMappings: Record<RoleModelMappingKey, string> | null;
  } {
    return {
      installedModels: (this.data.installedModels ?? []).map((m) => ({ ...m })),
      installedModelsLastRefreshAt:
        this.data.installedModelsLastRefreshAt ?? null,
      installedModelsLastRefreshMessage:
        this.data.installedModelsLastRefreshMessage ?? null,
      installedModelsLastRefreshOk:
        this.data.installedModelsLastRefreshOk ?? null,
      roleModelMappings: this.data.roleModelMappings
        ? normalizeRoleModelMappings(this.data.roleModelMappings)
        : null,
    };
  }

  getPlanningStyleSnapshot(): PlanningStyleId | null {
    return this.data.planningStyle
      ? normalizePlanningStyle(this.data.planningStyle)
      : null;
  }

  getReportsPanelCollapseSnapshot(): Record<string, boolean> | null {
    return this.data.reportsPanelCollapse
      ? { ...this.data.reportsPanelCollapse }
      : null;
  }

  getBacklogSnapshot(): {
    items: BacklogItem[];
    selectedId: string | null;
    lastReport: BacklogReviewReport | null;
  } {
    return {
      items: this.data.backlogItems.map((i) => ({ ...i })),
      selectedId: this.data.backlogSelectedId,
      lastReport: this.data.backlogLastReport
        ? { ...this.data.backlogLastReport }
        : null,
    };
  }

  load(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    } catch {
      // continue; write may still fail later
    }

    if (!fs.existsSync(this.filePath)) {
      this.data = emptyFile();
      this.loaded = true;
      this.statusMessage = "No previous history found. Starting fresh.";
      this.warning = null;
      this.safetyGate.log(
        "info",
        "History loaded",
        "No session-history.json yet. Empty history ready in app data.",
      );
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<HistoryFileShape>;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("History file root is not an object.");
      }
      this.data = {
        version: HISTORY_VERSION,
        updatedAt:
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : new Date().toISOString(),
        recentProjects: Array.isArray(parsed.recentProjects)
          ? parsed.recentProjects.filter(isRecentEntry)
          : [],
        providerSettings:
          parsed.providerSettings && typeof parsed.providerSettings === "object"
            ? (parsed.providerSettings as ProviderSettings)
            : null,
        installedModels: Array.isArray(parsed.installedModels)
          ? (parsed.installedModels as InstalledOllamaModel[])
              .filter((m) => m && typeof m.name === "string" && m.name.trim())
              .slice(0, 80)
              .map((m) => ({
                name: m.name.trim(),
                modifiedAt: m.modifiedAt ?? null,
                sizeBytes: typeof m.sizeBytes === "number" ? m.sizeBytes : null,
                family: m.family ?? null,
                parameterSize: m.parameterSize ?? null,
                quantization: m.quantization ?? null,
              }))
          : [],
        installedModelsLastRefreshAt:
          typeof parsed.installedModelsLastRefreshAt === "string"
            ? parsed.installedModelsLastRefreshAt
            : null,
        installedModelsLastRefreshMessage:
          typeof parsed.installedModelsLastRefreshMessage === "string"
            ? parsed.installedModelsLastRefreshMessage
            : null,
        installedModelsLastRefreshOk:
          typeof parsed.installedModelsLastRefreshOk === "boolean"
            ? parsed.installedModelsLastRefreshOk
            : null,
        roleModelMappings:
          parsed.roleModelMappings &&
          typeof parsed.roleModelMappings === "object"
            ? normalizeRoleModelMappings(
                parsed.roleModelMappings as Partial<
                  Record<RoleModelMappingKey, string>
                >,
              )
            : null,
        planningStyle:
          parsed.planningStyle === "default" ||
          parsed.planningStyle === "small-model-friendly"
            ? parsed.planningStyle
            : null,
        reportsPanelCollapse:
          parsed.reportsPanelCollapse &&
          typeof parsed.reportsPanelCollapse === "object"
            ? (parsed.reportsPanelCollapse as Record<string, boolean>)
            : null,
        actionLog: Array.isArray(parsed.actionLog)
          ? parsed.actionLog.slice(0, MAX_ACTION_LOG_ENTRIES)
          : [],
        backlogItems: Array.isArray(parsed.backlogItems)
          ? (parsed.backlogItems as BacklogItem[])
              .slice()
              .sort((a, b) =>
                String(b.updatedAt).localeCompare(String(a.updatedAt)),
              )
              .slice(0, MAX_BACKLOG_ITEMS)
          : [],
        backlogSelectedId:
          typeof parsed.backlogSelectedId === "string"
            ? parsed.backlogSelectedId
            : null,
        backlogLastReport:
          parsed.backlogLastReport &&
          typeof parsed.backlogLastReport === "object"
            ? (parsed.backlogLastReport as BacklogReviewReport)
            : null,
        projects:
          parsed.projects && typeof parsed.projects === "object"
            ? migrateProjectRecords(
                parsed.projects as Record<string, ProjectHistoryRecord>,
              )
            : {},
      };
      if (
        this.data.backlogSelectedId &&
        !this.data.backlogItems.some((i) => i.id === this.data.backlogSelectedId)
      ) {
        this.data.backlogSelectedId = this.data.backlogItems[0]?.id ?? null;
      }
      this.loaded = true;
      this.warning = null;
      this.statusMessage = `History loaded (${this.data.recentProjects.length} recent project(s)).`;
      this.safetyGate.log(
        "info",
        "History loaded",
        `Loaded local history from app data (${this.data.recentProjects.length} recent, ${Object.keys(this.data.projects).length} project record(s)).`,
      );
      if (this.data.providerSettings) {
        this.safetyGate.log(
          "info",
          "Provider settings loaded",
          `Restored provider type “${this.data.providerSettings.providerType}” from local history (no credentials).`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown history parse error";
      this.quarantineCorruptFile(message);
      this.data = emptyFile();
      this.loaded = true;
      this.warning =
        "Saved history looked damaged, so it was set aside. Starting with empty history.";
      this.statusMessage = this.warning;
      this.safetyGate.log(
        "warning",
        "History loaded",
        `Corrupted history ignored: ${message}`,
      );
    }
  }

  saveCurrentSession(input: {
    project: ProjectInfo | null;
    userRequest: string;
    projectSummary: ProjectScanResult | null;
    reviewPack: OutsideReviewPack | null;
    patchReviewPack: PatchReviewPack | null;
    changedFilesScan: ChangedFilesScanResult | null;
    qwenPromptPack: QwenPromptPack | null;
    advisorResponse: LocalAiAdvisorResponse | null;
    externalReview: ExternalReviewRecord[];
    decisionReport: DecisionReport | null;
    builderPrompt: BuilderPromptPack | null;
    builderResult: BuilderResultRecord | null;
    speakerScript: SpeakerScriptRecord | null;
    builderPlan: BuilderPlanRecord | null;
    builderPlanComparison: BuilderPlanComparisonRecord | null;
    implementationReview: ImplementationReviewRecord | null;
    projectMemoryPreview: ProjectMemoryPreview | null;
    projectMemoryLastSaved: ProjectMemorySavedRecord | null;
    codeContextSelectedPaths: string[];
    codeContextQuestion: string;
    codeContextQuestionTemplate: CodeQuestionTemplateSelection | null;
    codeContextMaxLinesPerFile: number | null;
    codeContextMaxTotalChars: number | null;
    codeContextPreview: CodeContextPack | null;
    codeContextAiResponse: CodeContextAiRecord | null;
    patchDraftResponse: PatchDraftRecord | null;
    patchDraftSafetyReview: PatchDraftSafetyReviewRecord | null;
    importedPatchDraft: ImportedPatchDraftRecord | null;
    externalPatchDraftComparison: ExternalPatchDraftComparisonRecord | null;
    builderHandoffExport: BuilderHandoffExportRecord | null;
    blueprintIntake: BlueprintIntake | null;
    blueprintPlannerQuestions: BlueprintPlannerQuestions | null;
    blueprintPlannerPrompt: BlueprintPlannerPrompt | null;
    blueprintImported: BlueprintImportedRecord | null;
    blueprintCompletenessReport: BlueprintCompletenessReport | null;
    blueprintPlanningDocsPreview: PlanningDocumentsPreview | null;
    blueprintPlanningDocsLastSaved: PlanningDocumentsSavedRecord | null;
    blueprintPhase1Handoff: Phase1BuilderHandoffRecord | null;
    blueprintDraftText: string;
    blueprintDraftSource: BlueprintSource;
    blueprintSelectedPreviewFile: string | null;
    blueprintPlannerAiDraft: BlueprintPlannerAiRecord | null;
    blueprintPhaseTaskCards: BlueprintPhaseTaskCardsRecord | null;
    blueprintTaskCardBuilderHandoff: TaskCardBuilderHandoffRecord | null;
    blueprintTaskCardBuilderHandoffSelectedTaskId: string | null;
    blueprintTaskCardBuilderHandoffTarget: BuilderHandoffTarget | null;
    blueprintTaskCardBuilderHandoffStrictness: BuilderHandoffStrictness | null;
    blueprintTaskImplementationReports: Record<
      string,
      TaskImplementationReportRecord
    > | null;
    blueprintTaskImplementationSelectedTaskId: string | null;
    blueprintTaskImplementationBuilderSource: TaskImplementationBuilderSource | null;
    blueprintTaskReconciliation: BlueprintTaskReconciliationRecord | null;
    blueprintTaskArtifactIndex: TaskArtifactIndexRecord | null;
    changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
    changedFilesTaskLinkSelectedTaskId: string | null;
    architectureHealth: ArchitectureHealthRecord | null;
    safeScaffoldTarget: SafeScaffoldTargetRecord | null;
    safeScaffoldFileTreePreview: SafeScaffoldFileTreePreviewRecord | null;
    safeScaffoldFileContentPreview: SafeScaffoldFileContentPreviewRecord | null;
    safeScaffoldWriteManifestPreview: SafeScaffoldWriteManifestPreviewRecord | null;
    safeScaffoldFinalConfirmation: SafeScaffoldFinalConfirmationRecord | null;
    architectureRefactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
    architectureRefactorTaskBuilderHandoff: ArchitectureRefactorTaskBuilderHandoffRecord | null;
    architectureRefactorTaskBuilderHandoffSelectedTaskId: string | null;
    architectureRefactorTaskBuilderHandoffTarget: BuilderHandoffTarget | null;
    architectureRefactorTaskBuilderHandoffStrictness: BuilderHandoffStrictness | null;
    architectureRefactorTaskImplementationReports: Record<
      string,
      ArchitectureRefactorTaskImplementationReportRecord
    > | null;
    architectureRefactorTaskImplementationSelectedTaskId: string | null;
    architectureRefactorTaskImplementationBuilderSource: ArchitectureRefactorImplementationBuilderSource | null;
    localAiRole: LocalAiRoleId | null;
    lastRecommendedNextAction: RecommendedNextAction | null;
    backlogItems: BacklogItem[];
    backlogSelectedId: string | null;
    backlogLastReport: BacklogReviewReport | null;
    safeChecks: SafeChecksState;
    latestCheckpoint: CheckpointRecord | null;
    pendingCheckpointMeta?: SavedCheckpointMeta | null;
    providerSettings: ProviderSettings;
    installedModels?: InstalledOllamaModel[];
    installedModelsLastRefreshAt?: string | null;
    installedModelsLastRefreshMessage?: string | null;
    installedModelsLastRefreshOk?: boolean | null;
    roleModelMappings?: Record<RoleModelMappingKey, string> | null;
    planningStyle?: PlanningStyleId | null;
    reportsPanelCollapse?: Record<string, boolean> | null;
    actionLog: ActionLogEntry[];
  }): boolean {
    const notes: string[] = [];
    const now = new Date().toISOString();

    // Always persist safe provider settings + truncated action log + global backlog.
    this.data.providerSettings = {
      providerType: input.providerSettings.providerType,
      baseUrl: input.providerSettings.baseUrl,
      modelName: input.providerSettings.modelName,
      qwenCommand: input.providerSettings.qwenCommand,
    };
    if (input.installedModels) {
      this.data.installedModels = input.installedModels.slice(0, 80).map((m) => ({
        name: m.name,
        modifiedAt: m.modifiedAt ?? null,
        sizeBytes: m.sizeBytes ?? null,
        family: m.family ?? null,
        parameterSize: m.parameterSize ?? null,
        quantization: m.quantization ?? null,
      }));
    }
    if (input.installedModelsLastRefreshAt !== undefined) {
      this.data.installedModelsLastRefreshAt =
        input.installedModelsLastRefreshAt;
    }
    if (input.installedModelsLastRefreshMessage !== undefined) {
      this.data.installedModelsLastRefreshMessage =
        input.installedModelsLastRefreshMessage;
    }
    if (input.installedModelsLastRefreshOk !== undefined) {
      this.data.installedModelsLastRefreshOk =
        input.installedModelsLastRefreshOk;
    }
    if (input.roleModelMappings) {
      this.data.roleModelMappings = normalizeRoleModelMappings(
        input.roleModelMappings,
      );
    }
    if (input.planningStyle !== undefined) {
      this.data.planningStyle = normalizePlanningStyle(input.planningStyle);
    }
    if (input.reportsPanelCollapse !== undefined) {
      this.data.reportsPanelCollapse = input.reportsPanelCollapse
        ? { ...input.reportsPanelCollapse }
        : null;
    }
    this.data.actionLog = input.actionLog.slice(0, MAX_ACTION_LOG_ENTRIES);
    this.data.backlogItems = this.truncateBacklogItems(
      input.backlogItems,
      notes,
    );
    this.data.backlogSelectedId =
      input.backlogSelectedId &&
      this.data.backlogItems.some((i) => i.id === input.backlogSelectedId)
        ? input.backlogSelectedId
        : this.data.backlogItems[0]?.id ?? null;
    this.data.backlogLastReport = input.backlogLastReport
      ? this.truncateBacklogReport(input.backlogLastReport, notes)
      : null;

    if (input.project) {
      this.touchRecentProject({
        projectName: input.project.displayName,
        projectPath: input.project.normalizedPath,
        lastScanAt: input.projectSummary?.scannedAt ?? null,
        lastCheckpointStatus: input.latestCheckpoint
          ? input.latestCheckpoint.methodLabel
          : input.pendingCheckpointMeta
            ? `${input.pendingCheckpointMeta.methodLabel} (verify before restore)`
            : null,
      });

      const previous =
        this.data.projects[normalizeKey(input.project.normalizedPath)] ?? null;
      const record = this.buildProjectRecord({
        project: input.project,
        userRequest: input.userRequest,
        projectSummary: input.projectSummary,
        reviewPack: input.reviewPack,
        patchReviewPack: input.patchReviewPack,
        changedFilesScan: input.changedFilesScan,
        qwenPromptPack: input.qwenPromptPack,
        advisorResponse: input.advisorResponse,
        externalReviews: input.externalReview,
        decisionReport: input.decisionReport,
        builderPrompt: input.builderPrompt,
        builderResult: input.builderResult,
        speakerScript: input.speakerScript,
        builderPlan: input.builderPlan,
        builderPlanComparison: input.builderPlanComparison,
        implementationReview: input.implementationReview,
        projectMemoryPreview: input.projectMemoryPreview,
        projectMemoryLastSaved: input.projectMemoryLastSaved,
        codeContextSelectedPaths: input.codeContextSelectedPaths,
        codeContextQuestion: input.codeContextQuestion,
        codeContextQuestionTemplate: input.codeContextQuestionTemplate,
        codeContextMaxLinesPerFile: input.codeContextMaxLinesPerFile,
        codeContextMaxTotalChars: input.codeContextMaxTotalChars,
        codeContextPreview: input.codeContextPreview,
        codeContextAiResponse: input.codeContextAiResponse,
        patchDraftResponse: input.patchDraftResponse,
        patchDraftSafetyReview: input.patchDraftSafetyReview,
        importedPatchDraft: input.importedPatchDraft,
        externalPatchDraftComparison: input.externalPatchDraftComparison,
        builderHandoffExport: input.builderHandoffExport,
        blueprintIntake: input.blueprintIntake,
        blueprintPlannerQuestions: input.blueprintPlannerQuestions,
        blueprintPlannerPrompt: input.blueprintPlannerPrompt,
        blueprintImported: input.blueprintImported,
        blueprintCompletenessReport: input.blueprintCompletenessReport,
        blueprintPlanningDocsPreview: input.blueprintPlanningDocsPreview,
        blueprintPlanningDocsLastSaved: input.blueprintPlanningDocsLastSaved,
        blueprintPhase1Handoff: input.blueprintPhase1Handoff,
        blueprintDraftText: input.blueprintDraftText,
        blueprintDraftSource: input.blueprintDraftSource,
        blueprintSelectedPreviewFile: input.blueprintSelectedPreviewFile,
        blueprintPlannerAiDraft: input.blueprintPlannerAiDraft,
        blueprintPhaseTaskCards: input.blueprintPhaseTaskCards,
        blueprintTaskCardBuilderHandoff: input.blueprintTaskCardBuilderHandoff,
        blueprintTaskCardBuilderHandoffSelectedTaskId:
          input.blueprintTaskCardBuilderHandoffSelectedTaskId,
        blueprintTaskCardBuilderHandoffTarget:
          input.blueprintTaskCardBuilderHandoffTarget,
        blueprintTaskCardBuilderHandoffStrictness:
          input.blueprintTaskCardBuilderHandoffStrictness,
        blueprintTaskImplementationReports: input.blueprintTaskImplementationReports,
        blueprintTaskImplementationSelectedTaskId:
          input.blueprintTaskImplementationSelectedTaskId,
        blueprintTaskImplementationBuilderSource:
          input.blueprintTaskImplementationBuilderSource,
        blueprintTaskReconciliation: input.blueprintTaskReconciliation,
        blueprintTaskArtifactIndex: input.blueprintTaskArtifactIndex,
        changedFilesTaskLink: input.changedFilesTaskLink,
        changedFilesTaskLinkSelectedTaskId:
          input.changedFilesTaskLinkSelectedTaskId,
        architectureHealth: input.architectureHealth,
        safeScaffoldTarget: input.safeScaffoldTarget,
        safeScaffoldFileTreePreview: input.safeScaffoldFileTreePreview,
        safeScaffoldFileContentPreview: input.safeScaffoldFileContentPreview,
        safeScaffoldWriteManifestPreview: input.safeScaffoldWriteManifestPreview,
        safeScaffoldFinalConfirmation: input.safeScaffoldFinalConfirmation,
        architectureRefactorTaskCards: input.architectureRefactorTaskCards,
        architectureRefactorTaskBuilderHandoff:
          input.architectureRefactorTaskBuilderHandoff,
        architectureRefactorTaskBuilderHandoffSelectedTaskId:
          input.architectureRefactorTaskBuilderHandoffSelectedTaskId,
        architectureRefactorTaskBuilderHandoffTarget:
          input.architectureRefactorTaskBuilderHandoffTarget,
        architectureRefactorTaskBuilderHandoffStrictness:
          input.architectureRefactorTaskBuilderHandoffStrictness,
        architectureRefactorTaskImplementationReports:
          input.architectureRefactorTaskImplementationReports,
        architectureRefactorTaskImplementationSelectedTaskId:
          input.architectureRefactorTaskImplementationSelectedTaskId,
        architectureRefactorTaskImplementationBuilderSource:
          input.architectureRefactorTaskImplementationBuilderSource,
        localAiRole: input.localAiRole,
        lastRecommendedNextAction: input.lastRecommendedNextAction,
        safeChecks: input.safeChecks,
        latestCheckpoint: input.latestCheckpoint,
        pendingCheckpointMeta: input.pendingCheckpointMeta ?? null,
        notes,
        now,
      });

      // Keep prior meta-only fields when the live session has none yet
      // (e.g. reopening a recent project restores reports but not live checkpoint/runner state).
      if (!record.lastSafeCheck && previous?.lastSafeCheck) {
        record.lastSafeCheck = previous.lastSafeCheck;
      }
      if (!record.lastCheckpointMeta && previous?.lastCheckpointMeta) {
        record.lastCheckpointMeta = previous.lastCheckpointMeta;
      }
      if (!record.patchReviewPack && previous?.patchReviewPack) {
        record.patchReviewPack = previous.patchReviewPack;
      }
      if (!record.changedFilesScan && previous?.changedFilesScan) {
        record.changedFilesScan = previous.changedFilesScan;
      }
      if (
        (!record.externalReviews || record.externalReviews.length === 0) &&
        previous?.externalReviews &&
        previous.externalReviews.length > 0
      ) {
        record.externalReviews = previous.externalReviews;
        record.externalReview = previous.externalReviews[0] ?? null;
      } else       if (
        (!record.externalReviews || record.externalReviews.length === 0) &&
        previous?.externalReview
      ) {
        record.externalReviews = [previous.externalReview];
        record.externalReview = previous.externalReview;
      }
      if (!record.decisionReport && previous?.decisionReport) {
        record.decisionReport = previous.decisionReport;
      }
      if (!record.builderPrompt && previous?.builderPrompt) {
        record.builderPrompt = previous.builderPrompt;
      }
      if (!record.lastRecommendedNextAction && previous?.lastRecommendedNextAction) {
        record.lastRecommendedNextAction = previous.lastRecommendedNextAction;
      }
      if (!record.builderResult && previous?.builderResult) {
        record.builderResult = previous.builderResult;
      }
      if (!record.speakerScript && previous?.speakerScript) {
        record.speakerScript = previous.speakerScript;
      }
      if (!record.builderPlan && previous?.builderPlan) {
        record.builderPlan = previous.builderPlan;
      }
      if (!record.builderPlanComparison && previous?.builderPlanComparison) {
        record.builderPlanComparison = previous.builderPlanComparison;
      }
      if (!record.implementationReview && previous?.implementationReview) {
        record.implementationReview = previous.implementationReview;
      }
      if (!record.projectMemoryPreview && previous?.projectMemoryPreview) {
        record.projectMemoryPreview = previous.projectMemoryPreview;
      }
      if (!record.projectMemoryLastSaved && previous?.projectMemoryLastSaved) {
        record.projectMemoryLastSaved = previous.projectMemoryLastSaved;
      }
      if (!record.codeContextPreview && previous?.codeContextPreview) {
        record.codeContextPreview = previous.codeContextPreview;
      }
      if (!record.codeContextAiResponse && previous?.codeContextAiResponse) {
        record.codeContextAiResponse = previous.codeContextAiResponse;
      }
      if (!record.patchDraftResponse && previous?.patchDraftResponse) {
        record.patchDraftResponse = previous.patchDraftResponse;
      }
      if (!record.patchDraftSafetyReview && previous?.patchDraftSafetyReview) {
        record.patchDraftSafetyReview = previous.patchDraftSafetyReview;
      }
      if (!record.importedPatchDraft && previous?.importedPatchDraft) {
        record.importedPatchDraft = previous.importedPatchDraft;
      }
      if (
        !record.externalPatchDraftComparison &&
        previous?.externalPatchDraftComparison
      ) {
        record.externalPatchDraftComparison = previous.externalPatchDraftComparison;
      }
      if (!record.builderHandoffExport && previous?.builderHandoffExport) {
        record.builderHandoffExport = previous.builderHandoffExport;
      }
      if (!record.blueprintIntake && previous?.blueprintIntake) {
        record.blueprintIntake = previous.blueprintIntake;
      }
      if (!record.blueprintPlannerQuestions && previous?.blueprintPlannerQuestions) {
        record.blueprintPlannerQuestions = previous.blueprintPlannerQuestions;
      }
      if (!record.blueprintPlannerPrompt && previous?.blueprintPlannerPrompt) {
        record.blueprintPlannerPrompt = previous.blueprintPlannerPrompt;
      }
      if (!record.blueprintImported && previous?.blueprintImported) {
        record.blueprintImported = previous.blueprintImported;
      }
      if (!record.blueprintCompletenessReport && previous?.blueprintCompletenessReport) {
        record.blueprintCompletenessReport = previous.blueprintCompletenessReport;
      }
      if (!record.blueprintPlanningDocsPreview && previous?.blueprintPlanningDocsPreview) {
        record.blueprintPlanningDocsPreview = previous.blueprintPlanningDocsPreview;
      }
      if (!record.blueprintPlanningDocsLastSaved && previous?.blueprintPlanningDocsLastSaved) {
        record.blueprintPlanningDocsLastSaved = previous.blueprintPlanningDocsLastSaved;
      }
      if (!record.blueprintPhase1Handoff && previous?.blueprintPhase1Handoff) {
        record.blueprintPhase1Handoff = previous.blueprintPhase1Handoff;
      }
      if (!record.blueprintDraftText && previous?.blueprintDraftText) {
        record.blueprintDraftText = previous.blueprintDraftText;
      }
      if (!record.blueprintPlannerAiDraft && previous?.blueprintPlannerAiDraft) {
        record.blueprintPlannerAiDraft = previous.blueprintPlannerAiDraft;
      }
      if (!record.blueprintPhaseTaskCards && previous?.blueprintPhaseTaskCards) {
        record.blueprintPhaseTaskCards = previous.blueprintPhaseTaskCards;
      }
      if (
        !record.blueprintTaskCardBuilderHandoff &&
        previous?.blueprintTaskCardBuilderHandoff
      ) {
        record.blueprintTaskCardBuilderHandoff =
          previous.blueprintTaskCardBuilderHandoff;
      }
      if (
        !record.blueprintTaskCardBuilderHandoffSelectedTaskId &&
        previous?.blueprintTaskCardBuilderHandoffSelectedTaskId
      ) {
        record.blueprintTaskCardBuilderHandoffSelectedTaskId =
          previous.blueprintTaskCardBuilderHandoffSelectedTaskId;
      }
      if (
        (!record.blueprintTaskImplementationReports ||
          Object.keys(record.blueprintTaskImplementationReports).length === 0) &&
        previous?.blueprintTaskImplementationReports
      ) {
        record.blueprintTaskImplementationReports =
          previous.blueprintTaskImplementationReports;
      }
      if (
        !record.blueprintTaskImplementationSelectedTaskId &&
        previous?.blueprintTaskImplementationSelectedTaskId
      ) {
        record.blueprintTaskImplementationSelectedTaskId =
          previous.blueprintTaskImplementationSelectedTaskId;
      }
      if (!record.blueprintTaskReconciliation && previous?.blueprintTaskReconciliation) {
        record.blueprintTaskReconciliation = previous.blueprintTaskReconciliation;
      }
      if (!record.blueprintTaskArtifactIndex && previous?.blueprintTaskArtifactIndex) {
        record.blueprintTaskArtifactIndex = previous.blueprintTaskArtifactIndex;
      }
      if (!record.changedFilesTaskLink && previous?.changedFilesTaskLink) {
        record.changedFilesTaskLink = previous.changedFilesTaskLink;
      }
      if (
        !record.changedFilesTaskLinkSelectedTaskId &&
        previous?.changedFilesTaskLinkSelectedTaskId
      ) {
        record.changedFilesTaskLinkSelectedTaskId =
          previous.changedFilesTaskLinkSelectedTaskId;
      }
      if (!record.architectureHealth && previous?.architectureHealth) {
        record.architectureHealth = previous.architectureHealth;
      }
      if (!record.safeScaffoldTarget && previous?.safeScaffoldTarget) {
        record.safeScaffoldTarget = previous.safeScaffoldTarget;
      }
      if (
        !record.safeScaffoldFileTreePreview &&
        previous?.safeScaffoldFileTreePreview
      ) {
        record.safeScaffoldFileTreePreview = previous.safeScaffoldFileTreePreview;
      }
      if (
        !record.safeScaffoldFileContentPreview &&
        previous?.safeScaffoldFileContentPreview
      ) {
        record.safeScaffoldFileContentPreview =
          previous.safeScaffoldFileContentPreview;
      }
      if (
        !record.safeScaffoldWriteManifestPreview &&
        previous?.safeScaffoldWriteManifestPreview
      ) {
        record.safeScaffoldWriteManifestPreview =
          previous.safeScaffoldWriteManifestPreview;
      }
      if (
        !record.safeScaffoldFinalConfirmation &&
        previous?.safeScaffoldFinalConfirmation
      ) {
        record.safeScaffoldFinalConfirmation =
          previous.safeScaffoldFinalConfirmation;
      }
      if (
        !record.architectureRefactorTaskCards &&
        previous?.architectureRefactorTaskCards
      ) {
        record.architectureRefactorTaskCards = previous.architectureRefactorTaskCards;
      }
      if (
        !record.architectureRefactorTaskBuilderHandoff &&
        previous?.architectureRefactorTaskBuilderHandoff
      ) {
        record.architectureRefactorTaskBuilderHandoff =
          previous.architectureRefactorTaskBuilderHandoff;
      }
      if (
        !record.architectureRefactorTaskBuilderHandoffSelectedTaskId &&
        previous?.architectureRefactorTaskBuilderHandoffSelectedTaskId
      ) {
        record.architectureRefactorTaskBuilderHandoffSelectedTaskId =
          previous.architectureRefactorTaskBuilderHandoffSelectedTaskId;
      }
      if (
        (!record.architectureRefactorTaskImplementationReports ||
          Object.keys(record.architectureRefactorTaskImplementationReports).length ===
            0) &&
        previous?.architectureRefactorTaskImplementationReports
      ) {
        record.architectureRefactorTaskImplementationReports =
          previous.architectureRefactorTaskImplementationReports;
      }
      if (
        !record.architectureRefactorTaskImplementationSelectedTaskId &&
        previous?.architectureRefactorTaskImplementationSelectedTaskId
      ) {
        record.architectureRefactorTaskImplementationSelectedTaskId =
          previous.architectureRefactorTaskImplementationSelectedTaskId;
      }
      if (
        (!record.codeContextSelectedPaths ||
          record.codeContextSelectedPaths.length === 0) &&
        previous?.codeContextSelectedPaths?.length
      ) {
        record.codeContextSelectedPaths = previous.codeContextSelectedPaths;
      }
      if (!record.codeContextQuestionTemplate && previous?.codeContextQuestionTemplate) {
        record.codeContextQuestionTemplate = previous.codeContextQuestionTemplate;
      }
      if (!record.localAiRole && previous?.localAiRole) {
        record.localAiRole = previous.localAiRole;
      }
      if (!record.advisorResponse && previous?.advisorResponse) {
        record.advisorResponse = previous.advisorResponse;
      }

      this.data.projects[normalizeKey(input.project.normalizedPath)] = record;
      this.pruneProjectRecords();

      if (notes.length > 0) {
        for (const note of notes) {
          this.safetyGate.log("warning", "Text truncated before saving", note);
        }
      }
    }

    this.data.updatedAt = now;
    const ok = this.persistToDisk();
    if (ok) {
      this.statusMessage = input.project
        ? "Session history saved for this project."
        : "Provider settings and action log saved (no project selected).";
      this.warning = null;
      this.safetyGate.log(
        "success",
        "History saved",
        input.project
          ? `Saved safe history for ${input.project.displayName} in app data.`
          : "Saved provider settings / action log in app data.",
      );
    }
    return ok;
  }

  openRecentMetadata(projectPath: string): ProjectHistoryRecord | null {
    return this.data.projects[normalizeKey(projectPath)] ?? null;
  }

  clearRecentProjects(): void {
    this.data.recentProjects = [];
    this.data.updatedAt = new Date().toISOString();
    const ok = this.persistToDisk();
    this.statusMessage = ok
      ? "Recent projects list cleared."
      : "Could not clear recent projects on disk.";
    this.safetyGate.log(
      ok ? "success" : "warning",
      "History cleared",
      "Recent projects list cleared from local history.",
    );
  }

  clearProjectHistory(projectPath: string | null): void {
    if (!projectPath) {
      this.statusMessage = "No project selected to clear history for.";
      this.safetyGate.log(
        "warning",
        "History cleared",
        "Clear project history blocked — no project selected.",
      );
      return;
    }
    const key = normalizeKey(projectPath);
    delete this.data.projects[key];
    this.data.recentProjects = this.data.recentProjects.filter(
      (entry) => normalizeKey(entry.projectPath) !== key,
    );
    this.data.updatedAt = new Date().toISOString();
    const ok = this.persistToDisk();
    this.statusMessage = ok
      ? "History for this project cleared."
      : "Could not clear project history on disk.";
    this.safetyGate.log(
      ok ? "success" : "warning",
      "History cleared",
      `Cleared local history for ${projectPath}.`,
    );
  }

  private buildProjectRecord(input: {
    project: ProjectInfo;
    userRequest: string;
    projectSummary: ProjectScanResult | null;
    reviewPack: OutsideReviewPack | null;
    patchReviewPack: PatchReviewPack | null;
    changedFilesScan: ChangedFilesScanResult | null;
    qwenPromptPack: QwenPromptPack | null;
    advisorResponse: LocalAiAdvisorResponse | null;
    externalReviews: ExternalReviewRecord[];
    decisionReport: DecisionReport | null;
    builderPrompt: BuilderPromptPack | null;
    builderResult: BuilderResultRecord | null;
    speakerScript: SpeakerScriptRecord | null;
    builderPlan: BuilderPlanRecord | null;
    builderPlanComparison: BuilderPlanComparisonRecord | null;
    implementationReview: ImplementationReviewRecord | null;
    projectMemoryPreview: ProjectMemoryPreview | null;
    projectMemoryLastSaved: ProjectMemorySavedRecord | null;
    codeContextSelectedPaths: string[];
    codeContextQuestion: string;
    codeContextQuestionTemplate: CodeQuestionTemplateSelection | null;
    codeContextMaxLinesPerFile: number | null;
    codeContextMaxTotalChars: number | null;
    codeContextPreview: CodeContextPack | null;
    codeContextAiResponse: CodeContextAiRecord | null;
    patchDraftResponse: PatchDraftRecord | null;
    patchDraftSafetyReview: PatchDraftSafetyReviewRecord | null;
    importedPatchDraft: ImportedPatchDraftRecord | null;
    externalPatchDraftComparison: ExternalPatchDraftComparisonRecord | null;
    builderHandoffExport: BuilderHandoffExportRecord | null;
    blueprintIntake: BlueprintIntake | null;
    blueprintPlannerQuestions: BlueprintPlannerQuestions | null;
    blueprintPlannerPrompt: BlueprintPlannerPrompt | null;
    blueprintImported: BlueprintImportedRecord | null;
    blueprintCompletenessReport: BlueprintCompletenessReport | null;
    blueprintPlanningDocsPreview: PlanningDocumentsPreview | null;
    blueprintPlanningDocsLastSaved: PlanningDocumentsSavedRecord | null;
    blueprintPhase1Handoff: Phase1BuilderHandoffRecord | null;
    blueprintDraftText: string;
    blueprintDraftSource: BlueprintSource;
    blueprintSelectedPreviewFile: string | null;
    blueprintPlannerAiDraft: BlueprintPlannerAiRecord | null;
    blueprintPhaseTaskCards: BlueprintPhaseTaskCardsRecord | null;
    blueprintTaskCardBuilderHandoff: TaskCardBuilderHandoffRecord | null;
    blueprintTaskCardBuilderHandoffSelectedTaskId: string | null;
    blueprintTaskCardBuilderHandoffTarget: BuilderHandoffTarget | null;
    blueprintTaskCardBuilderHandoffStrictness: BuilderHandoffStrictness | null;
    blueprintTaskImplementationReports: Record<
      string,
      TaskImplementationReportRecord
    > | null;
    blueprintTaskImplementationSelectedTaskId: string | null;
    blueprintTaskImplementationBuilderSource: TaskImplementationBuilderSource | null;
    blueprintTaskReconciliation: BlueprintTaskReconciliationRecord | null;
    blueprintTaskArtifactIndex: TaskArtifactIndexRecord | null;
    changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
    changedFilesTaskLinkSelectedTaskId: string | null;
    architectureHealth: ArchitectureHealthRecord | null;
    safeScaffoldTarget: SafeScaffoldTargetRecord | null;
    safeScaffoldFileTreePreview: SafeScaffoldFileTreePreviewRecord | null;
    safeScaffoldFileContentPreview: SafeScaffoldFileContentPreviewRecord | null;
    safeScaffoldWriteManifestPreview: SafeScaffoldWriteManifestPreviewRecord | null;
    safeScaffoldFinalConfirmation: SafeScaffoldFinalConfirmationRecord | null;
    architectureRefactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
    architectureRefactorTaskBuilderHandoff: ArchitectureRefactorTaskBuilderHandoffRecord | null;
    architectureRefactorTaskBuilderHandoffSelectedTaskId: string | null;
    architectureRefactorTaskBuilderHandoffTarget: BuilderHandoffTarget | null;
    architectureRefactorTaskBuilderHandoffStrictness: BuilderHandoffStrictness | null;
    architectureRefactorTaskImplementationReports: Record<
      string,
      ArchitectureRefactorTaskImplementationReportRecord
    > | null;
    architectureRefactorTaskImplementationSelectedTaskId: string | null;
    architectureRefactorTaskImplementationBuilderSource: ArchitectureRefactorImplementationBuilderSource | null;
    localAiRole: LocalAiRoleId | null;
    lastRecommendedNextAction: RecommendedNextAction | null;
    safeChecks: SafeChecksState;
    latestCheckpoint: CheckpointRecord | null;
    pendingCheckpointMeta?: SavedCheckpointMeta | null;
    notes: string[];
    now: string;
  }): ProjectHistoryRecord {
    let summary = input.projectSummary;
    if (summary) {
      const md = truncateText(
        summary.markdownReport,
        MAX_MARKDOWN_CHARS,
        "Project Summary",
        input.notes,
      );
      summary = { ...summary, markdownReport: md };
    }

    let pack = input.reviewPack;
    if (pack) {
      const md = truncateText(
        pack.markdownReport,
        MAX_MARKDOWN_CHARS,
        "Outside Review Pack",
        input.notes,
      );
      pack = {
        ...pack,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
      };
    }

    let patchPack = input.patchReviewPack;
    if (patchPack) {
      const md = truncateText(
        patchPack.markdownReport,
        MAX_MARKDOWN_CHARS,
        "Patch Review Pack",
        input.notes,
      );
      patchPack = {
        ...patchPack,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
      };
    }

    let changedScan = input.changedFilesScan;
    if (changedScan && changedScan.files.length > 80) {
      changedScan = {
        ...changedScan,
        files: changedScan.files.slice(0, 80),
        truncated: true,
        truncationNote:
          changedScan.truncationNote ??
          `History kept first 80 of ${changedScan.totalCount} changed files.`,
      };
    }

    let qwenPack = input.qwenPromptPack;
    if (qwenPack) {
      const md = truncateText(
        qwenPack.markdownReport,
        MAX_MARKDOWN_CHARS,
        "Qwen Prompt Pack",
        input.notes,
      );
      qwenPack = {
        ...qwenPack,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
      };
    }

    let advisor = input.advisorResponse;
    if (advisor) {
      const original = advisor.responseText;
      const text = truncateText(
        original,
        MAX_ADVISOR_CHARS,
        "Local AI role response",
        input.notes,
      );
      const roleId = isLocalAiRoleId(advisor.roleId)
        ? advisor.roleId
        : DEFAULT_LOCAL_AI_ROLE;
      advisor = {
        ...advisor,
        responseText: text,
        truncatedForPack:
          advisor.truncatedForPack || text.length < original.length,
        roleId,
        roleLabel: advisor.roleLabel || roleId,
        roleCategory: advisor.roleCategory || "general",
      };
    }

    const MAX_REVIEWS = 20;
    let externalReviews = (input.externalReviews ?? [])
      .slice()
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, MAX_REVIEWS)
      .map((review) => {
        const text = truncateText(
          review.reviewText,
          MAX_EXTERNAL_CHARS,
          "External Review",
          input.notes,
        );
        return {
          ...review,
          label: review.label ?? null,
          truncated: review.truncated || text.length < review.reviewText.length,
          reviewText: text,
          charCount: text.length,
          associatedChangedFilesScanAt:
            review.associatedChangedFilesScanAt ?? null,
          associatedPatchPackAt: review.associatedPatchPackAt ?? null,
        };
      });

    let decision = input.decisionReport;
    if (decision) {
      const md = truncateText(
        decision.markdownReport,
        MAX_MARKDOWN_CHARS,
        "Decision Report",
        input.notes,
      );
      decision = {
        ...decision,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
      };
    }

    let builder = input.builderPrompt;
    if (builder) {
      const md = truncateText(
        builder.markdownReport,
        MAX_MARKDOWN_CHARS,
        "Builder Prompt",
        input.notes,
      );
      builder = {
        ...builder,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
      };
    }

    let builderResult = input.builderResult;
    if (builderResult) {
      const originalText = builderResult.responseText;
      const text = truncateText(
        originalText,
        MAX_BUILDER_RESULT_CHARS,
        "Builder Result",
        input.notes,
      );
      builderResult = {
        ...builderResult,
        responseText: text,
        charCount: text.length,
        truncated: builderResult.truncated || text.length < originalText.length,
      };
    }

    let speakerScript = input.speakerScript;
    if (speakerScript) {
      const md = truncateText(
        speakerScript.markdownReport,
        MAX_SPEAKER_SCRIPT_CHARS,
        "Speaker Script",
        input.notes,
      );
      const voice = truncateText(
        speakerScript.voiceFriendlyScript,
        1_800,
        "Speaker Script voice",
        input.notes,
      );
      speakerScript = {
        ...speakerScript,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 24).join("\n"),
        voiceFriendlyScript: voice,
        truncated:
          speakerScript.truncated ||
          md.length < speakerScript.markdownReport.length ||
          voice.length < speakerScript.voiceFriendlyScript.length,
      };
    }

    let builderPlan = input.builderPlan;
    if (builderPlan) {
      const original = builderPlan.planText;
      const text = truncateText(
        original,
        MAX_BUILDER_PLAN_CHARS,
        "Builder Plan",
        input.notes,
      );
      builderPlan = {
        ...builderPlan,
        planText: text,
        previewExcerpt:
          text.length > 900 ? `${text.slice(0, 899)}…` : text,
        truncated: builderPlan.truncated || text.length < original.length,
      };
    }

    let builderPlanComparison = input.builderPlanComparison;
    if (builderPlanComparison) {
      const original = builderPlanComparison.markdownReport;
      const md = truncateText(
        original,
        MAX_BUILDER_PLAN_COMPARISON_CHARS,
        "Builder Plan Comparison",
        input.notes,
      );
      const prompt = truncateText(
        builderPlanComparison.suggestedNextBuilderPrompt,
        6_000,
        "Suggested Next Builder Prompt",
        input.notes,
      );
      builderPlanComparison = {
        ...builderPlanComparison,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 32).join("\n"),
        suggestedNextBuilderPrompt: prompt,
        truncated:
          builderPlanComparison.truncated ||
          md.length < original.length ||
          prompt.length < builderPlanComparison.suggestedNextBuilderPrompt.length,
      };
    }

    let implementationReview = input.implementationReview;
    if (implementationReview) {
      const original = implementationReview.markdownReport;
      const md = truncateText(
        original,
        MAX_IMPLEMENTATION_REVIEW_CHARS,
        "Implementation Review",
        input.notes,
      );
      const prompt = truncateText(
        implementationReview.suggestedNextBuilderPrompt,
        6_000,
        "Suggested Next Builder Prompt",
        input.notes,
      );
      implementationReview = {
        ...implementationReview,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 32).join("\n"),
        suggestedNextBuilderPrompt: prompt,
        truncated:
          implementationReview.truncated ||
          md.length < original.length ||
          prompt.length < implementationReview.suggestedNextBuilderPrompt.length,
      };
    }

    let projectMemoryPreview = input.projectMemoryPreview;
    if (projectMemoryPreview) {
      const files = projectMemoryPreview.files.map((file) => {
        const content = truncateText(
          file.content,
          MAX_PROJECT_MEMORY_FILE_CHARS,
          `Project Memory ${file.fileName}`,
          input.notes,
        );
        return {
          ...file,
          content,
          truncated: file.truncated || content.length < file.content.length,
          charCount: content.length,
        };
      });
      const bundleMarkdown = truncateText(
        projectMemoryPreview.bundleMarkdown,
        MAX_PROJECT_MEMORY_BUNDLE_CHARS,
        "Project Memory bundle",
        input.notes,
      );
      projectMemoryPreview = {
        ...projectMemoryPreview,
        files,
        bundleMarkdown,
        truncationFlags: [
          ...projectMemoryPreview.truncationFlags,
          ...input.notes.filter((n) => n.includes("Project Memory")),
        ],
      };
    }

    const projectMemoryLastSaved = input.projectMemoryLastSaved;

    let codeContextPreview = input.codeContextPreview;
    if (codeContextPreview) {
      const md = truncateText(
        codeContextPreview.markdownReport,
        MAX_CODE_CONTEXT_PACK_CHARS,
        "Code Context Pack",
        input.notes,
      );
      codeContextPreview = {
        ...codeContextPreview,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 32).join("\n"),
        truncated: codeContextPreview.truncated || md.length < codeContextPreview.markdownReport.length,
      };
    }

    const codeContextSelectedPaths = (input.codeContextSelectedPaths ?? []).slice(
      0,
      MAX_CODE_CONTEXT_SELECTED_PATHS,
    );

    let codeContextAiResponse = input.codeContextAiResponse;
    if (codeContextAiResponse) {
      const original = codeContextAiResponse.responseText;
      const text = truncateText(
        original,
        MAX_CODE_CONTEXT_AI_CHARS,
        "Code AI response",
        input.notes,
      );
      codeContextAiResponse = {
        ...codeContextAiResponse,
        responseText: text,
        previewExcerpt: text.split("\n").slice(0, 24).join("\n"),
        truncatedResponse:
          codeContextAiResponse.truncatedResponse || text.length < original.length,
      };
    }

    let patchDraftResponse = input.patchDraftResponse;
    if (patchDraftResponse) {
      const original = patchDraftResponse.draftText;
      const text = truncateText(
        original,
        MAX_PATCH_DRAFT_CHARS,
        "Patch Draft",
        input.notes,
      );
      patchDraftResponse = {
        ...patchDraftResponse,
        draftText: text,
        previewExcerpt: text.split("\n").slice(0, 24).join("\n"),
        truncatedResponse:
          patchDraftResponse.truncatedResponse || text.length < original.length,
      };
    }

    let patchDraftSafetyReview = input.patchDraftSafetyReview;
    if (patchDraftSafetyReview) {
      const original = patchDraftSafetyReview.markdownReport;
      const md = truncateText(
        original,
        MAX_PATCH_DRAFT_SAFETY_REVIEW_CHARS,
        "Patch Draft Safety Review",
        input.notes,
      );
      const prompt = truncateText(
        patchDraftSafetyReview.suggestedNextPrompt,
        6_000,
        "Suggested Next Prompt",
        input.notes,
      );
      patchDraftSafetyReview = {
        ...patchDraftSafetyReview,
        reviewTargetKind:
          patchDraftSafetyReview.reviewTargetKind ?? "nttc-patch-draft",
        reviewTargetLabel:
          patchDraftSafetyReview.reviewTargetLabel ?? "NTTC Patch Draft",
        importedSource: patchDraftSafetyReview.importedSource ?? null,
        importedDraftType: patchDraftSafetyReview.importedDraftType ?? null,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
        suggestedNextPrompt: prompt,
        truncatedReview:
          patchDraftSafetyReview.truncatedReview ||
          md.length < original.length ||
          prompt.length < patchDraftSafetyReview.suggestedNextPrompt.length,
      };
    }

    let importedPatchDraft = input.importedPatchDraft;
    if (importedPatchDraft) {
      const original = importedPatchDraft.draftText;
      const text = truncateText(
        original,
        MAX_IMPORTED_PATCH_DRAFT_CHARS,
        "Imported Patch Draft",
        input.notes,
      );
      importedPatchDraft = {
        ...importedPatchDraft,
        draftText: text,
        previewExcerpt: text.split("\n").slice(0, 24).join("\n"),
        truncatedImport:
          importedPatchDraft.truncatedImport || text.length < original.length,
      };
    }

    let externalPatchDraftComparison = input.externalPatchDraftComparison;
    if (externalPatchDraftComparison) {
      const original = externalPatchDraftComparison.markdownReport;
      const md = truncateText(
        original,
        MAX_EXTERNAL_PATCH_DRAFT_COMPARISON_CHARS,
        "External Patch Draft Comparison",
        input.notes,
      );
      const prompt = truncateText(
        externalPatchDraftComparison.suggestedNextBuilderPrompt,
        6_000,
        "Suggested Next Builder Prompt",
        input.notes,
      );
      externalPatchDraftComparison = {
        ...externalPatchDraftComparison,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
        suggestedNextBuilderPrompt: prompt,
        truncated:
          externalPatchDraftComparison.truncated ||
          md.length < original.length ||
          prompt.length <
            externalPatchDraftComparison.suggestedNextBuilderPrompt.length,
      };
    }

    let builderHandoffExport = input.builderHandoffExport;
    if (builderHandoffExport) {
      const original = builderHandoffExport.markdownReport;
      const md = truncateText(
        original,
        MAX_BUILDER_HANDOFF_EXPORT_CHARS,
        "Builder Handoff Pack",
        input.notes,
      );
      builderHandoffExport = {
        ...builderHandoffExport,
        markdownReport: md,
        previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
        truncated: builderHandoffExport.truncated || md.length < original.length,
      };
    }

    let blueprintImported = input.blueprintImported;
    if (blueprintImported) {
      const original = blueprintImported.blueprintText;
      const text = truncateText(
        original,
        MAX_BLUEPRINT_IMPORTED_CHARS,
        "Imported Blueprint",
        input.notes,
      );
      blueprintImported = {
        ...blueprintImported,
        blueprintText: text,
        truncationFlag:
          blueprintImported.truncationFlag || text.length < original.length,
      };
    }

    let blueprintPlannerQuestions = input.blueprintPlannerQuestions;
    if (blueprintPlannerQuestions) {
      const original = blueprintPlannerQuestions.markdown;
      blueprintPlannerQuestions = {
        ...blueprintPlannerQuestions,
        markdown: truncateText(
          original,
          MAX_BLUEPRINT_PROMPT_CHARS,
          "Planner Questions",
          input.notes,
        ),
      };
    }

    let blueprintPlannerPrompt = input.blueprintPlannerPrompt;
    if (blueprintPlannerPrompt) {
      const original = blueprintPlannerPrompt.markdown;
      blueprintPlannerPrompt = {
        ...blueprintPlannerPrompt,
        markdown: truncateText(
          original,
          MAX_BLUEPRINT_PROMPT_CHARS,
          "Planner AI Prompt",
          input.notes,
        ),
      };
    }

    let blueprintPhase1Handoff = input.blueprintPhase1Handoff;
    if (blueprintPhase1Handoff) {
      const original = blueprintPhase1Handoff.markdown;
      blueprintPhase1Handoff = {
        ...blueprintPhase1Handoff,
        markdown: truncateText(
          original,
          MAX_PHASE1_HANDOFF_CHARS,
          "Phase 1 Builder Handoff",
          input.notes,
        ),
      };
    }

    let blueprintPlannerAiDraft = input.blueprintPlannerAiDraft;
    if (blueprintPlannerAiDraft) {
      const original = blueprintPlannerAiDraft.responseText;
      const text = truncateText(
        original,
        MAX_BLUEPRINT_PLANNER_AI_CHARS,
        "Local Planner Blueprint Draft",
        input.notes,
      );
      blueprintPlannerAiDraft = {
        ...blueprintPlannerAiDraft,
        responseText: text,
        previewExcerpt: text.split("\n").slice(0, 24).join("\n"),
        truncatedResponse:
          blueprintPlannerAiDraft.truncatedResponse || text.length < original.length,
      };
    }

    return {
      projectName: input.project.displayName,
      projectPath: input.project.normalizedPath,
      updatedAt: input.now,
      userRequest: input.userRequest.trim().slice(0, MAX_USER_REQUEST_CHARS),
      projectSummary: summary,
      reviewPack: pack,
      patchReviewPack: patchPack,
      changedFilesScan: changedScan,
      qwenPromptPack: qwenPack,
      advisorResponse: advisor,
      externalReviews,
      externalReview: externalReviews[0] ?? null,
      lastSafeCheck: this.buildSafeCheckSummary(input.safeChecks, input.notes),
      lastCheckpointMeta:
        this.buildCheckpointMeta(input.latestCheckpoint) ??
        (input.pendingCheckpointMeta && !input.pendingCheckpointMeta.isPreUndo
          ? input.pendingCheckpointMeta
          : null),
      decisionReport: decision,
      builderPrompt: builder,
      builderResult,
      speakerScript,
      builderPlan,
      builderPlanComparison,
      implementationReview,
      projectMemoryPreview,
      projectMemoryLastSaved,
      codeContextSelectedPaths,
      codeContextQuestion: (input.codeContextQuestion ?? "").slice(0, 4000),
      codeContextQuestionTemplate: input.codeContextQuestionTemplate ?? null,
      codeContextMaxLinesPerFile: input.codeContextMaxLinesPerFile,
      codeContextMaxTotalChars: input.codeContextMaxTotalChars,
      codeContextPreview,
      codeContextAiResponse,
      patchDraftResponse,
      patchDraftSafetyReview,
      importedPatchDraft,
      externalPatchDraftComparison,
      builderHandoffExport,
      blueprintIntake: input.blueprintIntake,
      blueprintPlannerQuestions,
      blueprintPlannerPrompt,
      blueprintImported,
      blueprintCompletenessReport: input.blueprintCompletenessReport,
      blueprintPlanningDocsPreview: input.blueprintPlanningDocsPreview,
      blueprintPlanningDocsLastSaved: input.blueprintPlanningDocsLastSaved,
      blueprintPhase1Handoff,
      blueprintDraftText: (input.blueprintDraftText ?? "").slice(0, MAX_BLUEPRINT_IMPORTED_CHARS),
      blueprintDraftSource: input.blueprintDraftSource ?? DEFAULT_BLUEPRINT_SOURCE,
      blueprintSelectedPreviewFile: input.blueprintSelectedPreviewFile,
      blueprintPlannerAiDraft,
      blueprintPhaseTaskCards: input.blueprintPhaseTaskCards,
      blueprintTaskCardBuilderHandoff: input.blueprintTaskCardBuilderHandoff,
      blueprintTaskCardBuilderHandoffSelectedTaskId:
        input.blueprintTaskCardBuilderHandoffSelectedTaskId,
      blueprintTaskCardBuilderHandoffTarget:
        input.blueprintTaskCardBuilderHandoffTarget,
      blueprintTaskCardBuilderHandoffStrictness:
        input.blueprintTaskCardBuilderHandoffStrictness,
      blueprintTaskImplementationReports: input.blueprintTaskImplementationReports,
      blueprintTaskImplementationSelectedTaskId:
        input.blueprintTaskImplementationSelectedTaskId,
      blueprintTaskImplementationBuilderSource:
        input.blueprintTaskImplementationBuilderSource,
      blueprintTaskReconciliation: input.blueprintTaskReconciliation,
      blueprintTaskArtifactIndex: input.blueprintTaskArtifactIndex,
      changedFilesTaskLink: input.changedFilesTaskLink,
      changedFilesTaskLinkSelectedTaskId: input.changedFilesTaskLinkSelectedTaskId,
      architectureHealth: input.architectureHealth,
      safeScaffoldTarget: input.safeScaffoldTarget,
      safeScaffoldFileTreePreview: input.safeScaffoldFileTreePreview,
      safeScaffoldFileContentPreview: input.safeScaffoldFileContentPreview,
      safeScaffoldWriteManifestPreview: input.safeScaffoldWriteManifestPreview,
      safeScaffoldFinalConfirmation: input.safeScaffoldFinalConfirmation,
      architectureRefactorTaskCards: input.architectureRefactorTaskCards,
      architectureRefactorTaskBuilderHandoff:
        input.architectureRefactorTaskBuilderHandoff,
      architectureRefactorTaskBuilderHandoffSelectedTaskId:
        input.architectureRefactorTaskBuilderHandoffSelectedTaskId,
      architectureRefactorTaskBuilderHandoffTarget:
        input.architectureRefactorTaskBuilderHandoffTarget,
      architectureRefactorTaskBuilderHandoffStrictness:
        input.architectureRefactorTaskBuilderHandoffStrictness,
      architectureRefactorTaskImplementationReports:
        input.architectureRefactorTaskImplementationReports,
      architectureRefactorTaskImplementationSelectedTaskId:
        input.architectureRefactorTaskImplementationSelectedTaskId,
      architectureRefactorTaskImplementationBuilderSource:
        input.architectureRefactorTaskImplementationBuilderSource,
      localAiRole:
        input.localAiRole ??
        (advisor && isLocalAiRoleId(advisor.roleId) ? advisor.roleId : null),
      lastRecommendedNextAction:
        input.lastRecommendedNextAction ??
        decision?.recommendedNextAction ??
        builder?.recommendedNextAction ??
        null,
      truncationNotes: [...input.notes],
    };
  }

  private buildSafeCheckSummary(
    safeChecks: SafeChecksState,
    notes: string[],
  ): SavedSafeCheckSummary | null {
    const last = safeChecks.lastResult;
    if (!last) return null;
    const preview = truncateText(
      last.combinedOutput,
      MAX_SAFE_CHECK_OUTPUT_CHARS,
      "Safe Check output",
      notes,
    );
    return {
      savedAt: new Date().toISOString(),
      kind: last.kind,
      scriptName: last.scriptName,
      status: last.status,
      exitCode: last.exitCode,
      plainEnglishSummary: last.plainEnglishSummary,
      argv: last.argv,
      durationMs: last.durationMs,
      outputTruncated: last.outputTruncated || preview.length < last.combinedOutput.length,
      combinedOutputPreview: preview,
    };
  }

  private buildCheckpointMeta(
    checkpoint: CheckpointRecord | null,
  ): SavedCheckpointMeta | null {
    if (!checkpoint) return null;
    return {
      savedAt: new Date().toISOString(),
      methodLabel: checkpoint.methodLabel,
      plainEnglish: checkpoint.plainEnglish,
      createdAt: checkpoint.createdAt,
      skippedCount: checkpoint.skippedCount,
      isPreUndo: checkpoint.isPreUndo,
      id: checkpoint.id,
      method: checkpoint.method,
      projectName: checkpoint.projectName,
      projectPath: checkpoint.projectPath,
      branchName: checkpoint.branchName,
      commitSha: checkpoint.commitSha,
      snapshotDir: checkpoint.snapshotDir,
      warnings: checkpoint.warnings.slice(0, 20),
      sizeBytes: checkpoint.sizeBytes,
      hadUncommittedChanges: checkpoint.hadUncommittedChanges,
    };
  }

  private truncateBacklogItems(
    items: BacklogItem[],
    notes: string[],
  ): BacklogItem[] {
    return (items ?? [])
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, MAX_BACKLOG_ITEMS)
      .map((item) => {
        const original = item.notes ?? "";
        const text = truncateText(
          original,
          MAX_BACKLOG_NOTES_CHARS,
          "Backlog notes",
          notes,
        );
        return {
          ...item,
          notes: text,
          charCount: text.length,
          truncated: Boolean(item.truncated) || text.length < original.length,
          riskyPhrases: Array.isArray(item.riskyPhrases) ? item.riskyPhrases : [],
          hasRiskySuggestions: Boolean(item.hasRiskySuggestions),
          projectName: item.projectName ?? null,
          projectPath: item.projectPath ?? null,
          relatedStage: item.relatedStage ?? null,
        };
      });
  }

  private truncateBacklogReport(
    report: BacklogReviewReport,
    notes: string[],
  ): BacklogReviewReport {
    const md = truncateText(
      report.markdownReport,
      MAX_MARKDOWN_CHARS,
      "Backlog Review Report",
      notes,
    );
    return {
      ...report,
      markdownReport: md,
      previewExcerpt: md.split("\n").slice(0, 28).join("\n"),
    };
  }

  private touchRecentProject(input: {
    projectName: string;
    projectPath: string;
    lastScanAt: string | null;
    lastCheckpointStatus: string | null;
  }): void {
    const key = normalizeKey(input.projectPath);
    const filtered = this.data.recentProjects.filter(
      (entry) => normalizeKey(entry.projectPath) !== key,
    );
    filtered.unshift({
      projectName: input.projectName,
      projectPath: input.projectPath,
      lastOpenedAt: new Date().toISOString(),
      lastScanAt: input.lastScanAt,
      lastCheckpointStatus: input.lastCheckpointStatus,
      pathMissing: false,
    });
    this.data.recentProjects = filtered.slice(0, MAX_RECENT_PROJECTS);
  }

  private pruneProjectRecords(): void {
    const keys = Object.keys(this.data.projects);
    if (keys.length <= MAX_PROJECT_RECORDS) return;
    const sorted = keys
      .map((key) => ({
        key,
        updatedAt: this.data.projects[key]?.updatedAt ?? "",
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const item of sorted.slice(MAX_PROJECT_RECORDS)) {
      delete this.data.projects[item.key];
    }
  }

  private persistToDisk(): boolean {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tmp, this.filePath);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not write history file.";
      this.warning = `History could not be saved: ${message}`;
      this.statusMessage = this.warning;
      this.safetyGate.log("warning", "History saved", this.warning);
      return false;
    }
  }

  private quarantineCorruptFile(reason: string): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dest = `${this.filePath}.corrupt-${stamp}`;
      fs.renameSync(this.filePath, dest);
      this.safetyGate.log(
        "warning",
        "History loaded",
        `Moved damaged history aside (${reason}).`,
      );
    } catch {
      // ignore quarantine failure
    }
  }
}

function isRecentEntry(value: unknown): value is RecentProjectEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as RecentProjectEntry;
  return (
    typeof entry.projectName === "string" &&
    typeof entry.projectPath === "string" &&
    typeof entry.lastOpenedAt === "string"
  );
}
