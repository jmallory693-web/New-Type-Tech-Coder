import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ActionLogEntry,
  ActiveProviderKind,
  AppSnapshot,
  BacklogFilters,
  BacklogItemType,
  BacklogPriority,
  BacklogState,
  BacklogStatus,
  BuilderResultResponseType,
  BuilderResultSource,
  BuilderResultState,
  BuilderPlanComparisonState,
  BuilderPlanState,
  ImplementationReviewState,
  CheckpointAvailabilityState,
  CheckpointRecord,
  DecisionState,
  ProjectMemoryState,
  CodeContextState,
  CodeContextAiState,
  PatchDraftState,
  PatchDraftSafetyReviewState,
  PatchDraftSafetyReviewTargetKind,
  ExternalPatchDraftComparisonState,
  BuilderHandoffExportState,
  BlueprintState,
  ImportedPatchDraftState,
  ImportedPatchDraftSource,
  ImportedPatchDraftType,
  PlanningStyleState,
  PlanningStyleId,
  OllamaStatusState,
  ExternalReviewSource,
  ExternalReviewState,
  InstalledOllamaModelsState,
  LocalAiAdvisorResponse,
  LocalAiRoleId,
  LocalAiProgressMode,
  LocalAiProgressState,
  OutsideReviewPack,
  ProjectScanResult,
  QwenInspectState,
  RoleModelMappingKey,
  RoleModelMappingState,
  SafeCheckKind,
  SafeChecksState,
  SafeCommandResult,
  SafeCommandStatus,
  SpeakerScriptRole,
  SpeakerScriptState,
  SpeakerScriptTone,
} from "../shared/types";
import {
  DEFAULT_CODE_CONTEXT_MAX_LINES_PER_FILE,
  DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS,
} from "../shared/codeContextConstants";
import {
  PlanningStyleControl,
  PlanningStyleStatusLine,
} from "./components/PlanningStyleControl";
import { scanImportedPatchDraftText } from "../shared/scanImportedPatchDraft";
import { parseTaskImplementationReportText } from "../shared/parseTaskImplementationReport";
import {
  PROJECT_MEMORY_FILE_NAMES,
  PROJECT_MEMORY_SAFETY_NOTE,
} from "../shared/projectMemoryConstants";
import {
  calculateDailyNextAction,
  type DailyNextActionButton,
} from "../shared/dailyNextAction";
import {
  buildBlockedReasons,
  buildHandoffReadiness,
  buildWorkflowHealth,
  buildWorkflowProgress,
  defaultPanelCollapsed,
  groupActionLogEntries,
  type WorkflowPanelId,
} from "../shared/workflowGuidance";
import { WorkflowGuidancePanel } from "./components/WorkflowGuidancePanel";
import { ReportsWorkflowSection } from "./components/ReportsWorkflowSection";
import { QuickStartGuidePanel } from "./components/QuickStartGuidePanel";
import { BlueprintTabSection } from "./components/BlueprintTabSection";
import { buildBlueprintTabSectionProps } from "./components/blueprintTabSectionProps";
import { BuildModeTab } from "./components/BuildModeTab";
import { ReportsArchitectureSection } from "./components/ReportsArchitectureSection";
import { buildReportsArchitectureSectionProps } from "./components/reportsArchitectureSectionProps";
import { ReportsAuditPatchSection } from "./components/ReportsAuditPatchSection";
import { buildReportsAuditPatchSectionProps } from "./components/reportsAuditPatchSectionProps";
import { parseArchitectureRefactorTaskImplementationReportText } from "../shared/architectureRefactorTasks/parseArchitectureRefactorTaskImplementationReport";
import { buildQuickStartGuideMarkdown } from "../shared/quickStartGuide";
import {
  SPEAKER_ROLE_LABELS,
  SPEAKER_SCRIPT_ROLES,
  SPEAKER_SCRIPT_TONES,
  SPEAKER_TONE_LABELS,
} from "../shared/buildSpeakerScript";
import {
  DEFAULT_LOCAL_AI_ROLE,
  getLocalAiRole,
  getRoleHelp,
  LOCAL_AI_ROLE_IDS,
  LOCAL_AI_ROLES,
  ROLE_HELP_SAFETY_REMINDER,
  type RoleHelpKey,
} from "../shared/localAiRoles";
import {
  formatModelSelectionSource,
  getRoleModelMappingLabel,
  modelNameInInstalledList,
  resolveBuilderPlanModel,
  resolveCodeContextReviewModel,
  resolveLocalAiRoleModel,
  resolvePatchDraftModel,
  ROLE_MODEL_MAPPING_KEYS,
  BUILDER_PLAN_MAPPING_KEY,
  BLUEPRINT_PLANNER_MAPPING_KEY,
  PATCH_DRAFT_MAPPING_KEY,
} from "../shared/roleModelMapping";
import {
  looksLikeMissingDependencies,
  MISSING_DEPENDENCIES_HELPER,
  ONEDRIVE_PROJECT_WARNING,
} from "../shared/userFacingMessages";
import {
  CONTEXT_SLOW_WARNING,
  elapsedSecondsSince,
  formatLocalAiProgressMessage,
  isCodeContextLikelySlow,
  isPatchDraftFailureMessage,
} from "../shared/localAiUsability";
import {
  OLLAMA_STATUS_LABELS,
  ollamaStatusTone,
} from "../shared/ollamaStatus";

const EXTERNAL_REVIEW_SOURCES: ExternalReviewSource[] = [
  "Qwen Code",
  "ChatGPT",
  "Claude",
  "Gemini",
  "Grok",
  "Other",
];

const BUILDER_RESULT_SOURCES: BuilderResultSource[] = [
  "Cursor",
  "Codex",
  "Grok Builder",
  "Claude",
  "ChatGPT",
  "Other",
];

const BUILDER_RESULT_RESPONSE_TYPES: BuilderResultResponseType[] = [
  "Plan only",
  "Implementation report",
  "Error report",
  "Builder plan",
  "Revised builder plan",
  "Unknown",
];

const BACKLOG_ITEM_TYPES: BacklogItemType[] = [
  "Bug",
  "UX issue",
  "Safety concern",
  "Feature idea",
  "Packaging issue",
  "Documentation issue",
  "Other",
];

const BACKLOG_PRIORITIES: BacklogPriority[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const BACKLOG_STATUSES: BacklogStatus[] = [
  "Open",
  "In review",
  "Fixed",
  "Won’t fix",
  "Later",
];

type AppTabId =
  | "dashboard"
  | "guide"
  | "blueprint"
  | "build"
  | "project-setup"
  | "request-output"
  | "reports"
  | "safety"
  | "ai-review"
  | "history-backlog"
  | "settings";

type TabAttentionLevel = "info" | "warning" | "danger";

interface TabAttention {
  level: TabAttentionLevel;
  pulsing: boolean;
}

const APP_TABS: Array<{ id: AppTabId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "guide", label: "Guide" },
  { id: "blueprint", label: "Blueprint" },
  { id: "build", label: "Build" },
  { id: "project-setup", label: "Project Setup" },
  { id: "request-output", label: "Request / Output" },
  { id: "reports", label: "Reports" },
  { id: "safety", label: "Safety" },
  { id: "ai-review", label: "AI Review" },
  { id: "history-backlog", label: "History / Backlog" },
  { id: "settings", label: "Settings / Advanced" },
];

const emptySafeChecks: SafeChecksState = {
  packageManager: "npm",
  packageManagerWarning: null,
  packageJsonFound: false,
  available: [],
  blocked: [],
  unavailable: [],
  lastResult: null,
  running: false,
  statusMessage: "Select a project folder, then Summarize Project to detect build/test checks.",
};

const emptyQwen: QwenInspectState = {
  liveInspectEnabled: false,
  liveInspectDisabledReason:
    "Live Qwen is disabled for safety. Use Generate Qwen Inspect Prompt and paste it into Qwen Code yourself.",
  command: "qwen",
  cliStatus: "not-tested",
  lastTestMessage: null,
  lastTestAt: null,
  promptPack: null,
  lastReport: null,
  fileChangeVerification: null,
  statusMessage:
    "Live Qwen is disabled for safety. Use Generate Qwen Inspect Prompt and paste it into Qwen Code yourself.",
  testing: false,
};

const emptyExternalReview: ExternalReviewState = {
  source: "Qwen Code",
  draftText: "",
  draftLabel: "",
  reviews: [],
  selectedId: null,
  selected: null,
  statusMessage:
    "Paste an external review response here. Advice only — nothing will be executed. Saving adds a new review (does not replace others).",
  comparison: null,
  capNote: null,
};

const emptyBuilderResult: BuilderResultState = {
  source: "Cursor",
  responseType: "Plan only",
  draftText: "",
  draftLabel: "",
  saved: null,
  statusMessage:
    "Paste a builder AI response here. Text only — nothing will be executed, edited, or run automatically.",
};

const emptySpeakerScript: SpeakerScriptState = {
  role: "project-foreman",
  tone: "plain",
  saved: null,
  statusMessage:
    "Choose a Speaker role and tone, then Generate Speaker Script (text-only). No audio.",
};

const emptyBuilderPlan: BuilderPlanState = {
  includeExternalReviewExcerpt: false,
  includeBuilderResultExcerpt: false,
  saved: null,
  statusMessage:
    "Generate a plan-only Builder Plan with your local AI. This does not edit files.",
  busy: false,
};

const emptyBuilderPlanComparison: BuilderPlanComparisonState = {
  saved: null,
  statusMessage:
    "Paste and save a builder plan, then generate a Comparison Report. Rule-based only — does not call Ollama or edit files.",
};

const emptyImplementationReview: ImplementationReviewState = {
  saved: null,
  statusMessage:
    "Paste and save an Implementation report, then generate an Implementation Review. Rule-based only — does not call Ollama or edit files.",
};

const emptyInstalledModels: InstalledOllamaModelsState = {
  models: [],
  lastRefreshAt: null,
  lastRefreshMessage:
    "Refresh Installed Models to see what Ollama has locally.",
  lastRefreshOk: null,
  busy: false,
};

const emptyRoleModelMapping: RoleModelMappingState = {
  mappings: Object.fromEntries(
    ROLE_MODEL_MAPPING_KEYS.map((key) => [key, ""]),
  ) as Record<RoleModelMappingKey, string>,
  statusMessage:
    "Refresh Installed Models to fill dropdowns. Most users should select from the dropdown — manual names are for advanced/offline use only.",
};

const emptyBacklog: BacklogState = {
  draftTitle: "",
  draftType: "Bug",
  draftPriority: "Medium",
  draftStatus: "Open",
  draftNotes: "",
  draftRelatedStage: "Stage 21",
  items: [],
  selectedId: null,
  selected: null,
  filters: {
    status: "All",
    priority: "All",
    type: "All",
    projectPath: "All",
  },
  filteredItems: [],
  lastReport: null,
  statusMessage:
    "Track bugs, UX issues, safety concerns, and feature ideas here. Text only — nothing will be executed.",
  capNote: null,
};

const emptyDecision: DecisionState = {
  decisionReport: null,
  builderPrompt: null,
  lastRecommendedNextAction: null,
  statusMessage:
    "Generate a Decision Report after gathering summary/review evidence. Builder Prompt is plan-only.",
};

const emptyProjectMemory: ProjectMemoryState = {
  preview: null,
  lastSaved: null,
  statusMessage:
    "Generate a Project Memory preview, review it, then save markdown files to `.nttc/` only.",
  busy: false,
  pendingOverwriteFiles: [],
  saveBlockedReason: null,
};

const emptyCodeContext: CodeContextState = {
  candidates: [],
  filterQuery: "",
  codeQuestion: "",
  selectedTemplate: null,
  maxLinesPerFile: DEFAULT_CODE_CONTEXT_MAX_LINES_PER_FILE,
  maxTotalChars: DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS,
  selectedCount: 0,
  blockedCount: 0,
  blockedSamples: [],
  listingTruncated: false,
  preview: null,
  busy: false,
  statusMessage:
    "Select a project, refresh the safe file list, choose files, then generate a preview.",
};

const emptyCodeContextAi: CodeContextAiState = {
  saved: null,
  busy: false,
  statusMessage:
    "Generate a Code Context Pack preview first, then ask Local AI about the approved excerpts.",
};

const emptyPatchDraft: PatchDraftState = {
  includeCodeAiResponseExcerpt: false,
  includeBuilderPlanDecisionExcerpt: false,
  includeImplementationReviewExcerpt: false,
  saved: null,
  busy: false,
  statusMessage:
    "Generate a Patch Draft from your approved Code Context Pack. NTTC will not edit files or apply patches.",
  lastFailureMessage: null,
  lastFailureAt: null,
};

const emptyPatchDraftSafetyReview: PatchDraftSafetyReviewState = {
  saved: null,
  statusMessage:
    "Generate a Patch Draft or save an Imported Patch Draft, then run a rule-based Patch Draft Safety Review. No Ollama — review only.",
  reviewTarget: "nttc-patch-draft",
};

const emptyImportedPatchDraft: ImportedPatchDraftState = {
  source: "Cursor",
  draftType: "Patch draft",
  draftText: "",
  saved: null,
  statusMessage:
    "Paste an outside patch draft here. NTTC will not apply it.",
};

const emptyExternalPatchDraftComparison: ExternalPatchDraftComparisonState = {
  saved: null,
  statusMessage:
    "Generate or import patch drafts, then run External Patch Draft Comparison. Rule-based only — does not call AI or edit files.",
};

const emptyBuilderHandoffExport: BuilderHandoffExportState = {
  saved: null,
  statusMessage:
    "Generate a handoff pack from reviewed patch-planning work. Rule-based only — does not call AI or read source files.",
  target: "generic-builder",
  strictness: "conservative",
};

const emptyBlueprint: BlueprintState = {
  intake: {
    projectIdea: "",
    projectType: "unknown",
    targetUser: "unknown",
    technicalComfort: "non-coder",
    buildStyle: "safe-phased",
    constraints: "",
    answersClarifications: "",
  },
  plannerQuestions: null,
  plannerPrompt: null,
  importedBlueprint: null,
  completenessReport: null,
  planningDocsPreview: null,
  planningDocsLastSaved: null,
  phase1Handoff: null,
  phaseTaskCards: {
    saved: null,
    statusMessage:
      "Generate phase task cards from your saved blueprint — rule-based, no AI, no source reads.",
  },
  taskCardBuilderHandoff: {
    saved: null,
    selectedTaskId: null,
    target: "generic-builder",
    strictness: "conservative",
    statusMessage:
      "Select a phase task card and generate a focused builder handoff. Text-only — no automatic send.",
    suggestedNextStatus: null,
  },
  taskImplementationIntake: {
    selectedTaskId: null,
    builderSource: "Cursor",
    draftText: "",
    reportsByTaskId: {},
    selectedReport: null,
    statusMessage:
      "Paste a builder implementation report for a phase task. Text-only — nothing is executed or sent to AI automatically.",
    suggestedMarkReturned: null,
    nextTaskSuggestion: null,
    liveParse: null,
    hasImplementationReview: false,
  },
  taskReconciliation: {
    saved: null,
    statusMessage:
      "Generate a rule-based reconciliation report to check whether phase task cards fit together.",
  },
  taskArtifactIndex: {
    saved: null,
    filterTaskId: null,
    statusMessage:
      "Generate a rule-based Task Artifact Index to trace task cards, handoffs, and reports by task ID.",
  },
  plannerAi: { saved: null, busy: false, statusMessage: null },
  status: {
    ideaExists: false,
    blueprintImported: false,
    completenessCheckExists: false,
    planningDocsPreviewExists: false,
    planningDocsExported: false,
    phase1HandoffExists: false,
    readinessStatus: null,
    localPlannerDraftExists: false,
    localPlannerDraftSavedAsBlueprint: false,
    localPlannerAiStatus: "idle",
    taskCardsExist: false,
    activeTaskId: null,
    nextTaskId: null,
    blockedTaskCount: 0,
    readyToSendTaskCount: 0,
    implementationReturnedTaskCount: 0,
    taskBuilderHandoffExists: false,
    taskBuilderHandoffSelectedTaskId: null,
    taskBuilderHandoffReadiness: null,
    taskBuilderHandoffStale: false,
    taskBuilderHandoffCopied: false,
    activeTaskStatus: null,
    taskImplementationReportCount: 0,
    activeTaskHasImplementationReport: false,
    activeTaskImplementationReportStale: false,
    pendingMarkImplementationReturned: false,
    taskReconciliationExists: false,
    taskReconciliationStale: false,
    taskReconciliationRecommendation: null,
    taskReconciliationMissingProducers: 0,
    taskReconciliationStatusInconsistencyCount: 0,
    taskArtifactIndexExists: false,
    taskArtifactIndexStale: false,
    taskArtifactIndexRecommendation: null,
    taskArtifactIndexUnlinkedCount: 0,
    taskArtifactIndexStaleCount: 0,
    changedFilesScanExists: false,
    changedFilesTaskLinkExists: false,
    changedFilesTaskLinkStale: false,
    changedFilesTaskLinkTaskId: null,
    changedFilesTaskLinkScopeWarningCount: 0,
    changedFilesUnlinked: false,
  },
  statusMessage:
    "Describe your app idea, generate planner questions, then import a blueprint from outside AI. Planning documents only — no source code.",
  busy: false,
  draftBlueprintText: "",
  draftBlueprintSource: "other",
  pendingOverwriteFiles: [],
  saveBlockedReason: null,
  selectedPreviewFileName: null,
};

const emptyPlanningStyle: PlanningStyleState = {
  style: "small-model-friendly",
  statusMessage: null,
};

const emptyReportsUi = {
  panelCollapse: {} as Record<string, boolean>,
};

const emptyArchitectureHealth = {
  saved: null,
  includeTestFiles: false,
  includeMarkdownDocs: true,
  busy: false,
  statusMessage:
    "Generate an Architecture Health Report to flag oversized files and monolith risk (metadata only).",
};

const emptySafeScaffoldTarget = {
  selectedPath: null,
  lastCheck: null,
  stale: false,
  busy: false,
  statusMessage:
    "Select an empty target folder to assess future Safe Scaffold readiness (metadata only — no files are created).",
  uiStatus: "none" as const,
};

const emptySafeScaffoldFileTreePreview = {
  saved: null,
  busy: false,
  statusMessage:
    "Generate a Safe Scaffold File Tree Preview once Blueprint, task cards, and a Safe/Caution target folder are ready (paths only — no files are created).",
  uiStatus: "not-ready" as const,
  readinessBlockedReasons: [] as string[],
};

const emptyArchitectureRefactorTaskCards = {
  saved: null,
  statusMessage:
    "Generate Architecture Refactor Task Cards from a current Architecture Health Report (planning text only).",
};

const emptyArchitectureRefactorTaskBuilderHandoff = {
  saved: null,
  selectedTaskId: null,
  target: "generic-builder" as const,
  strictness: "conservative" as const,
  statusMessage:
    "Select an Architecture Refactor Task Card and generate a focused builder handoff. Text-only — no automatic send.",
  suggestedNextStatus: null,
};

const emptyArchitectureRefactorTaskImplementationIntake = {
  selectedTaskId: null,
  builderSource: "Cursor" as const,
  draftText: "",
  reportsByTaskId: {},
  selectedReport: null,
  statusMessage:
    "Paste a builder refactor implementation report for an architecture refactor task. Text-only — nothing is executed or sent to AI automatically.",
  suggestedMarkReturned: null,
  nextTaskSuggestion: null,
  liveParse: null,
  hasImplementationReview: false,
};

const emptyOllamaStatus: OllamaStatusState = {
  status: "not-checked",
  baseUrl: "http://127.0.0.1:11434",
  modelName: null,
  lastCheckedAt: null,
  installedModelCount: 0,
  errorMessage: null,
  tooltip:
    "Ollama not checked yet — click to check connection. Live Qwen inspect remains disabled.",
  busy: false,
};

const emptySnapshot: AppSnapshot = {
  safety: {
    initialized: false,
    mode: "inspect-only",
    project: null,
    writesAllowed: false,
    editModeAvailable: false,
    checkpointExists: false,
    denyListSummary: [],
  },
  provider: {
    connected: false,
    providerId: null,
    providerName: null,
    message: "No AI provider connected.",
    connectionState: "not-connected",
    baseUrl: null,
    modelName: null,
    lastTestMessage: null,
    lastTestAt: null,
  },
  providerSettings: {
    providerType: "ollama-compatible",
    baseUrl: "http://127.0.0.1:11434",
    modelName: "qwen2.5-coder",
    qwenCommand: "qwen",
  },
  actionLog: [],
  projectSummary: null,
  summaryIsFromHistory: false,
  userRequest: "",
  reviewPack: null,
  changedFiles: {
    busy: false,
    lastScan: null,
    statusMessage: "Select a project folder, then Scan Changed Files (Git required).",
    patchReviewPack: null,
    taskLink: {
      saved: null,
      selectedTaskId: null,
      suggestedTaskId: null,
      suggestedReason: null,
      statusMessage:
        "Link changed-file metadata to a Blueprint task after scanning changed files.",
    },
  },
  latestCheckpoint: null,
  checkpointBusy: false,
  checkpointStatusMessage: null,
  checkpointAvailability: {
    status: "none",
    label: "No Safety Backup",
    detail: "Create a Safety Backup before risky work.",
    method: null,
    methodLabel: null,
    createdAt: null,
    verified: false,
    restorable: false,
    verificationMessage: null,
    verifiedAt: null,
    hasPreviousRecord: false,
  },
  advisorResponse: null,
  advisorBusy: false,
  advisorStatusMessage: null,
  localAiRole: DEFAULT_LOCAL_AI_ROLE,
  safeChecks: emptySafeChecks,
  qwen: emptyQwen,
  externalReview: emptyExternalReview,
  builderResult: emptyBuilderResult,
  speakerScript: emptySpeakerScript,
  builderPlan: emptyBuilderPlan,
  builderPlanComparison: emptyBuilderPlanComparison,
  implementationReview: emptyImplementationReview,
  installedModels: emptyInstalledModels,
  roleModelMapping: emptyRoleModelMapping,
  backlog: emptyBacklog,
  decision: emptyDecision,
  projectMemory: emptyProjectMemory,
  codeContext: emptyCodeContext,
  codeContextAi: emptyCodeContextAi,
  patchDraft: emptyPatchDraft,
  patchDraftSafetyReview: emptyPatchDraftSafetyReview,
  importedPatchDraft: emptyImportedPatchDraft,
  externalPatchDraftComparison: emptyExternalPatchDraftComparison,
  builderHandoffExport: emptyBuilderHandoffExport,
  blueprint: emptyBlueprint,
  planningStyle: emptyPlanningStyle,
  reportsUi: emptyReportsUi,
  architectureHealth: emptyArchitectureHealth,
  safeScaffoldTarget: emptySafeScaffoldTarget,
  safeScaffoldFileTreePreview: emptySafeScaffoldFileTreePreview,
  architectureRefactorTaskCards: emptyArchitectureRefactorTaskCards,
  architectureRefactorTaskBuilderHandoff: emptyArchitectureRefactorTaskBuilderHandoff,
  architectureRefactorTaskImplementationIntake:
    emptyArchitectureRefactorTaskImplementationIntake,
  localAiProgress: null,
  ollamaStatus: emptyOllamaStatus,
  history: {
    loaded: false,
    recentProjects: [],
    currentProjectHistory: null,
    statusMessage: null,
    warning: null,
    privacyNote:
      "History is stored locally on this computer in app data. It does not upload to cloud services. History stores summaries and reports only, not raw source code or secrets.",
  },
};

function HelpNote({ children }: { children: ReactNode }) {
  return (
    <div className="help-note" role="note">
      {children}
    </div>
  );
}

function LocalAiProgressBanner({
  progress,
  mode,
}: {
  progress: LocalAiProgressState | null;
  mode: LocalAiProgressMode;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!progress?.active || progress.mode !== mode) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [progress?.active, progress?.mode, progress?.startedAt, mode]);

  if (!progress?.active || progress.mode !== mode) return null;

  const elapsedSeconds = elapsedSecondsSince(progress.startedAt);
  const message = formatLocalAiProgressMessage({
    label: progress.label,
    modelName: progress.modelName,
    baseUrl: progress.baseUrl,
    elapsedSeconds,
  });

  return (
    <div className="onedrive-warning" role="status" aria-live="polite">
      <strong>Working…</strong> {message}
    </div>
  );
}

function ClickableRoleName({
  roleKey,
  label,
  onOpen,
}: {
  roleKey: RoleHelpKey;
  label?: string;
  onOpen: (key: RoleHelpKey) => void;
}) {
  const displayLabel = label ?? getRoleHelp(roleKey).title;
  return (
    <button
      type="button"
      className="role-help-link"
      onClick={() => onOpen(roleKey)}
      aria-label={`Learn what ${displayLabel} does`}
    >
      {displayLabel}
      <span className="role-help-icon" aria-hidden="true">
        ?
      </span>
    </button>
  );
}

function RoleHelpModal({
  roleKey,
  onClose,
}: {
  roleKey: RoleHelpKey;
  onClose: () => void;
}) {
  const help = getRoleHelp(roleKey);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="role-help-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="role-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="role-help-header">
          <h3 id="role-help-title" className="role-help-title">
            {help.title}
          </h3>
          <button type="button" className="role-help-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="role-help-section">
          <div className="role-help-section-label">Purpose</div>
          <p>{help.purpose}</p>
        </div>
        <div className="role-help-section">
          <div className="role-help-section-label">Best used when</div>
          <p>{help.bestUsedWhen}</p>
        </div>
        <div className="role-help-section">
          <div className="role-help-section-label">What it produces</div>
          <p>{help.produces}</p>
        </div>
        <div className="role-help-section">
          <div className="role-help-section-label">What it does not do</div>
          <p>{help.doesNotDo}</p>
        </div>
        <div className="role-help-section">
          <div className="role-help-section-label">Recommended model type</div>
          <p>{help.recommendedModel}</p>
        </div>

        <div className="role-help-reminder" role="note">
          {ROLE_HELP_SAFETY_REMINDER}
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({
  step,
  label,
  detail,
  state,
  hint,
  onActivate,
}: {
  step: number;
  label: string;
  detail: string;
  state: "done" | "ready" | "unavailable" | "optional";
  hint: string;
  onActivate: () => void;
}) {
  const badge =
    state === "done"
      ? "Done"
      : state === "ready"
        ? "Next"
        : state === "optional"
          ? "Optional"
          : "Not yet";
  const tone =
    state === "done"
      ? "ok"
      : state === "ready"
        ? "info"
        : state === "optional"
          ? "neutral"
          : "warning";
  return (
    <li>
      <button
        type="button"
        className={`workflow-step workflow-${state}`}
        onClick={onActivate}
        aria-label={`Workflow step ${step}: ${label}. ${hint}`}
      >
        <div className="workflow-step-head">
          <span className="workflow-num">{step}</span>
          <span className="workflow-label">{label}</span>
          <StatusBadge label={badge} tone={tone} />
        </div>
        <div className="workflow-detail">{detail}</div>
        <div className="workflow-hint">{hint}</div>
      </button>
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "info" | "ok" | "warning" | "danger";
}) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

function OllamaStatusBubble({
  status,
  onCheck,
}: {
  status: OllamaStatusState;
  onCheck: () => void;
}) {
  const tone = ollamaStatusTone(status.status);
  const label = OLLAMA_STATUS_LABELS[status.status];
  return (
    <button
      type="button"
      className={`ollama-status-bubble badge badge-${tone}`}
      title={status.tooltip}
      aria-label={`${label}. ${status.tooltip}`}
      disabled={status.busy}
      onClick={onCheck}
    >
      {label}
    </button>
  );
}

function ActionButton({
  label,
  hint,
  disabled = true,
  primary = false,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn ${primary ? "btn-primary" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="btn-label">{label}</span>
      <span className="btn-hint">{hint}</span>
    </button>
  );
}

function ActionLogPanel({ entries }: { entries: ActionLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="field-value muted">No actions logged yet.</p>;
  }

  const grouped = groupActionLogEntries(entries);

  return (
    <ul className="log-list">
      {grouped.map((entry) => (
        <li
          key={`${entry.key}-${entry.timestamp}`}
          className={`log-item log-level-${entry.level}`}
        >
          <div className="log-meta">
            <span>{entry.level.toUpperCase()}</span>
            <span>{formatClock(entry.timestamp)}</span>
          </div>
          <div className="log-message">
            {entry.message}
            {entry.count > 1 ? ` (${entry.count})` : ""}
          </div>
          {entry.detail ? <div className="log-detail">{entry.detail}</div> : null}
        </li>
      ))}
    </ul>
  );
}

function ProjectSummaryPanel({
  summary,
  fromHistory,
  onCopy,
  copyState,
}: {
  summary: ProjectScanResult | null;
  fromHistory: boolean;
  onCopy: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  return (
    <div className="stack">
      <div>
        <div className="field-label">Project Summary</div>
        <HelpNote>
          What it does: scans safe project info and writes a plain-English
          overview. What it does not do: edit files or read secrets. Why it is
          safe: summary-only metadata — no raw source code.
        </HelpNote>
      </div>

      {!summary ? (
        <div className="placeholder-box">
          No project summary yet. Select a project folder, then click{" "}
          <strong>Summarize Project</strong> to create one.
        </div>
      ) : (
        <>
          {fromHistory ? (
            <div className="onedrive-warning" role="status">
              This is a previous saved summary from local history — not a fresh
              scan. Click <strong>Summarize Project</strong> to refresh it.
            </div>
          ) : null}

          <div>
            <div className="field-value">{summary.projectName}</div>
            <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
              {summary.projectPath}
            </div>
          </div>

          <div>
            <div className="field-label">Last scan time</div>
            <div className="field-value">{formatTime(summary.scannedAt)}</div>
          </div>

          <div>
            <div className="field-label">Likely project type</div>
            <div className="field-value">
              {summary.likelyProjectTypes.join("; ")}
            </div>
          </div>

          <div className="summary-box">{summary.plainEnglishExplanation}</div>

          <div>
            <div className="field-label">Skipped / blocked items</div>
            <div className="field-value">{summary.skippedItems.length}</div>
          </div>

          <div>
            <div className="field-label">Skipped symlinks / junctions</div>
            <div className="field-value">
              {summary.skippedSymlinkOrJunctionCount ?? 0}
            </div>
            {(summary.skippedSymlinkOrJunctionCount ?? 0) > 0 ? (
              <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                {(summary.skippedSymlinkOrJunctionNames ?? []).slice(0, 12).join(", ") ||
                  "Names recorded in summary"}
                . Symlinks and junctions are not followed or read.
              </div>
            ) : (
              <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                No symlinks or junctions were followed during this scan.
              </div>
            )}
          </div>

          <ActionButton
            label="Copy Project Summary"
            hint={
              copyState === "copied"
                ? "Copied Project Summary"
                : copyState === "failed"
                  ? "Copy failed — try again"
                  : "Copy the plain-English summary (markdown)"
            }
            disabled={false}
            onClick={onCopy}
          />
        </>
      )}
    </div>
  );
}

function HistoryPanel({
  history,
  hasProject,
  onCopySummary,
  onCopyReviewPack,
  onCopyQwenPack,
  onCopyAdvisor,
  onCopyExternal,
  onClearProjectHistory,
  copyHints,
}: {
  history: AppSnapshot["history"];
  hasProject: boolean;
  onCopySummary: () => void;
  onCopyReviewPack: () => void;
  onCopyQwenPack: () => void;
  onCopyAdvisor: () => void;
  onCopyExternal: () => void;
  onClearProjectHistory: () => void;
  copyHints: {
    summary: string;
    reviewPack: string;
    qwenPack: string;
    advisor: string;
    external: string;
  };
}) {
  const current = history.currentProjectHistory;

  return (
    <div className="stack">
      <div>
        <div className="field-label">History</div>
        <HelpNote>
          What it does: remembers summaries and reports between launches. What
          it does not do: upload to the cloud or store raw source code. Why it
          is safe: app-owned local storage only — summaries and reports, not
          secrets.
        </HelpNote>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          History is stored locally on this computer in app data. It does not
          upload to cloud services.
        </div>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          History stores summaries and reports only, not raw source code or
          secrets.
        </div>
      </div>

      {history.warning ? (
        <div className="onedrive-warning" role="alert">
          {history.warning} You can keep working — start fresh, then save new
          records when you summarize or generate reports.
        </div>
      ) : null}

      {history.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {history.statusMessage}
        </div>
      ) : null}

      {!hasProject ? (
        <div className="placeholder-box">
          No project selected. Select a folder or reopen a recent project to
          view its saved history.
        </div>
      ) : !current ? (
        <div className="placeholder-box">
          No history for this project yet. Next: summarize the project, create a
          safety backup, or generate a review report — those records save
          automatically on this computer.
        </div>
      ) : (
        <>
          <div>
            <div className="field-label">Last summary time</div>
            <div className="field-value">
              {current.projectSummary
                ? formatTime(current.projectSummary.scannedAt)
                : "Not saved yet"}
            </div>
          </div>
          <div>
            <div className="field-label">Last copy-paste review report time</div>
            <div className="field-value">
              {current.reviewPack
                ? formatTime(current.reviewPack.generatedAt)
                : "Not saved yet"}
            </div>
          </div>
          <div>
            <div className="field-label">Last local AI reviewer response</div>
            <div className="field-value">
              {current.advisorResponse
                ? formatTime(current.advisorResponse.createdAt)
                : "Not saved yet"}
            </div>
          </div>
          <div>
            <div className="field-label">External reviews saved</div>
            <div className="field-value">
              {(() => {
                const list =
                  current.externalReviews ??
                  (current.externalReview ? [current.externalReview] : []);
                if (list.length === 0) return "Not saved yet";
                return `${list.length} · latest ${list[0].source} · ${formatTime(list[0].savedAt)}`;
              })()}
            </div>
          </div>
          <div>
            <div className="field-label">Last build/test check result</div>
            <div className="field-value">
              {current.lastSafeCheck
                ? `${current.lastSafeCheck.scriptName} · ${current.lastSafeCheck.status} · ${formatTime(current.lastSafeCheck.savedAt)}`
                : "Not saved yet"}
            </div>
          </div>
          <div>
            <div className="field-label">Last safety backup time / method</div>
            <div className="field-value">
              {current.lastCheckpointMeta
                ? `${formatTime(current.lastCheckpointMeta.createdAt)} · ${current.lastCheckpointMeta.methodLabel} (history record — verify on Safety tab before restore)`
                : "Not saved yet"}
            </div>
          </div>

          <ActionButton
            label="Copy last summary"
            hint={copyHints.summary}
            disabled={!current.projectSummary}
            onClick={onCopySummary}
          />
          <ActionButton
            label="Copy last review report"
            hint={copyHints.reviewPack}
            disabled={!current.reviewPack}
            onClick={onCopyReviewPack}
          />
          <ActionButton
            label="Copy last Qwen inspect prompt"
            hint={copyHints.qwenPack}
            disabled={!current.qwenPromptPack}
            onClick={onCopyQwenPack}
          />
          <ActionButton
            label="Copy last local AI response"
            hint={copyHints.advisor}
            disabled={!current.advisorResponse}
            onClick={onCopyAdvisor}
          />
          <ActionButton
            label="Copy last external review"
            hint={copyHints.external}
            disabled={
              !(
                (current.externalReviews && current.externalReviews.length > 0) ||
                current.externalReview
              )
            }
            onClick={onCopyExternal}
          />
          <ActionButton
            label="Clear history for this project"
            hint="Removes saved records for this project from app data (not your project files)"
            disabled={false}
            onClick={onClearProjectHistory}
          />
        </>
      )}
    </div>
  );
}

function AdvisorResponsePanel({
  response,
  statusMessage,
  busy,
  selectedRoleId,
  onCopy,
  copyState,
}: {
  response: LocalAiAdvisorResponse | null;
  statusMessage: string | null;
  busy: boolean;
  selectedRoleId: LocalAiRoleId;
  onCopy: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const unreachable =
    Boolean(statusMessage) &&
    /not reachable|not ready|connection failed|failed/i.test(statusMessage ?? "");
  const selectedRole = getLocalAiRole(selectedRoleId);
  const responseRoleLabel = response?.roleLabel || selectedRole.label;

  return (
    <div className="stack">
      <div>
        <div className="field-label">Local AI Role Response</div>
        <HelpNote>
          What it does: asks your local Ollama-compatible model using a named
          role prompt and safe metadata only. What it does not do: read source
          files, edit code, run commands, or play audio. Why it is safe:
          metadata-only — role changes framing, not capabilities. Speaker-style
          roles are optional advice, not official app safety status.
        </HelpNote>
        <div className="field-value">
          {busy
            ? `Asking Local AI Role (${selectedRole.label})…`
            : response
              ? `Ready · ${responseRoleLabel} · ${response.modelName}`
              : "No Local AI role response yet"}
        </div>
      </div>

      {statusMessage ? (
        <div
          className={unreachable ? "onedrive-warning" : "field-value muted"}
          style={unreachable ? undefined : { fontSize: "0.85rem" }}
          role={unreachable ? "alert" : undefined}
        >
          {unreachable
            ? `${statusMessage} Next: start Ollama (or your local server), check the Base URL, then click Test Connection.`
            : statusMessage}
        </div>
      ) : null}

      {response ? (
        <>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Role: {responseRoleLabel} · Model: {response.modelName} ·{" "}
            {formatTime(response.createdAt)} · metadata-only
            {response.truncatedForPack ? " · truncated" : ""}
          </div>
          {response.roleCategory === "speaker-style" ? (
            <div className="onedrive-warning" role="status">
              Local AI role response (speaker-style) — optional advice, not
              official app safety status. Prefer Stage 34 Speaker Scripts for
              rule-based briefings.
            </div>
          ) : null}
          <div className="review-preview" aria-label="Local AI role response">
            {response.responseText.slice(0, 2500)}
            {response.responseText.length > 2500 ? "\n…" : ""}
          </div>
          <ActionButton
            label="Copy Local AI Role Response"
            hint={
              copyState === "copied"
                ? "Copied Local AI Role Response"
                : copyState === "failed"
                  ? "Copy failed — try again"
                  : "Copy the full Local AI role response"
            }
            disabled={false}
            onClick={onCopy}
          />
        </>
      ) : (
        <div className="placeholder-box">
          No Local AI role response yet. Next: choose{" "}
          <strong>Ollama-compatible Local Advisor</strong> on Settings /
          Advanced, set Base URL and model, click{" "}
          <strong>Test Connection</strong>, pick a Local AI Role, then{" "}
          <strong>Ask Local AI Role</strong>. The AI only receives safe
          summary / review-report text — never raw source or secrets.
        </div>
      )}
    </div>
  );
}

function formatModelSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "size unknown";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function RoleModelMappingPanel({
  installedModels,
  roleModelMapping,
  globalFallbackModel,
  refreshing,
  onRefresh,
  onSuggestDefaults,
  onMappingChange,
  onGlobalFallbackChange,
  onOpenRoleHelp,
}: {
  installedModels: InstalledOllamaModelsState;
  roleModelMapping: RoleModelMappingState;
  globalFallbackModel: string;
  refreshing: boolean;
  onRefresh: () => void;
  onSuggestDefaults: () => void;
  onMappingChange: (roleKey: RoleModelMappingKey, modelName: string) => void;
  onGlobalFallbackChange: (modelName: string) => void;
  onOpenRoleHelp: (key: RoleHelpKey) => void;
}) {
  const installedNames = installedModels.models.map((m) => m.name);
  const canUseDropdowns =
    installedModels.lastRefreshOk === true && installedNames.length > 0;

  const [manualByKey, setManualByKey] = useState<
    Partial<Record<RoleModelMappingKey, boolean>>
  >({});
  const [globalManual, setGlobalManual] = useState(!canUseDropdowns);

  useEffect(() => {
    if (!canUseDropdowns) {
      setGlobalManual(true);
      return;
    }
    setManualByKey((prev) => {
      const next = { ...prev };
      for (const key of ROLE_MODEL_MAPPING_KEYS) {
        const value = roleModelMapping.mappings[key] ?? "";
        if (value && !modelNameInInstalledList(value, installedNames)) {
          next[key] = true;
        }
      }
      return next;
    });
    if (
      globalFallbackModel &&
      !modelNameInInstalledList(globalFallbackModel, installedNames)
    ) {
      setGlobalManual(true);
    }
  }, [
    canUseDropdowns,
    globalFallbackModel,
    installedNames,
    roleModelMapping.mappings,
  ]);

  const renderStaleWarning = (modelName: string) => {
    if (!modelName.trim() || !canUseDropdowns) return null;
    if (modelNameInInstalledList(modelName, installedNames)) return null;
    return (
      <div className="onedrive-warning" role="status" style={{ marginTop: "0.35rem" }}>
        Saved model <strong>{modelName}</strong> is not in the installed models
        cache. Click <strong>Refresh Installed Models</strong> or use manual model
        name for advanced/offline use.
      </div>
    );
  };

  return (
    <div className="stack" data-focus-id="role-model-mapping">
      <div>
        <div className="field-label">Installed Ollama Models</div>
        <HelpNote>
          Refresh Installed Models to fill the dropdowns below. Most users should
          select from the dropdown. Manual model names are only for
          advanced/offline use. Coder models can be selected for patch planning or
          Builder Plan Mode, but they still do not get file access or command
          access.
        </HelpNote>
      </div>

      <ActionButton
        label="Refresh Installed Models"
        hint={
          refreshing || installedModels.busy
            ? "Refreshing installed models…"
            : installedModels.lastRefreshMessage ??
              "List models from the local Ollama-compatible endpoint"
        }
        disabled={refreshing || installedModels.busy}
        onClick={onRefresh}
      />

      {installedModels.lastRefreshAt ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          Last refresh {formatTime(installedModels.lastRefreshAt)}
          {installedModels.lastRefreshOk === false ? " · failed" : ""}
          {installedModels.lastRefreshOk === true ? " · dropdowns ready" : ""}
        </div>
      ) : null}

      {canUseDropdowns ? (
        <div className="review-preview" aria-label="Installed Ollama models">
          {installedModels.models.map((model) => (
            <div key={model.name} style={{ marginBottom: "0.35rem" }}>
              <strong>{model.name}</strong>
              {" · "}
              {formatModelSize(model.sizeBytes)}
              {model.modifiedAt ? ` · modified ${formatTime(model.modifiedAt)}` : ""}
              {model.family ? ` · ${model.family}` : ""}
              {model.parameterSize ? ` · ${model.parameterSize}` : ""}
              {model.quantization ? ` · ${model.quantization}` : ""}
            </div>
          ))}
        </div>
      ) : (
        <div className="placeholder-box">
          No installed models listed yet. Click{" "}
          <strong>Refresh Installed Models</strong> to populate dropdowns. Until
          refresh succeeds, use manual model names (advanced/offline only).
        </div>
      )}

      <div className="section-divider" />

      <div>
        <div className="field-label">Role Model Mapping</div>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {canUseDropdowns
            ? "Select models from the dropdowns. Empty role rows use the global fallback model."
            : "Refresh Installed Models to fill dropdowns. Manual entry is for advanced/offline use only."}
        </div>
      </div>

      <ActionButton
        label="Suggest Role Model Defaults"
        hint={
          canUseDropdowns
            ? "Pick suggested models from installed names (keyword match only)"
            : "Refresh installed models first — suggestions need an installed model list"
        }
        disabled={refreshing || installedModels.busy}
        onClick={onSuggestDefaults}
      />

      {roleModelMapping.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {roleModelMapping.statusMessage}
        </div>
      ) : null}

      <div>
        <label className="field-label" htmlFor="global-fallback-model">
          Global Fallback Model
        </label>
        <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
          Used when a role has no mapping. Ask Local AI and Builder Plan Mode use
          this after role-specific fallbacks.
        </div>
        {canUseDropdowns && !globalManual ? (
          <select
            id="global-fallback-model"
            className="settings-input"
            value={
              globalFallbackModel &&
              modelNameInInstalledList(globalFallbackModel, installedNames)
                ? globalFallbackModel
                : globalFallbackModel
                  ? "__stale__"
                  : installedNames[0] ?? ""
            }
            onChange={(e) => {
              const next = e.target.value;
              if (next === "__stale__") return;
              onGlobalFallbackChange(next);
            }}
          >
            {globalFallbackModel &&
            !modelNameInInstalledList(globalFallbackModel, installedNames) ? (
              <option value="__stale__">{globalFallbackModel} (not in list)</option>
            ) : null}
            {installedModels.models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="global-fallback-model"
            className="settings-input"
            value={globalFallbackModel}
            onChange={(e) => onGlobalFallbackChange(e.target.value)}
            placeholder="qwen2.5-coder"
            aria-label="Global fallback model manual"
          />
        )}
        {canUseDropdowns ? (
          <label
            className="field-value"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.35rem",
              fontSize: "0.82rem",
            }}
          >
            <input
              type="checkbox"
              checked={globalManual}
              onChange={(e) => setGlobalManual(e.target.checked)}
            />
            Use manual model name (advanced/offline)
          </label>
        ) : null}
        {renderStaleWarning(globalFallbackModel)}
      </div>

      <div className="stack" style={{ gap: "0.75rem" }}>
        {ROLE_MODEL_MAPPING_KEYS.map((key) => {
          const value = roleModelMapping.mappings[key] ?? "";
          const label = getRoleModelMappingLabel(key);
          const useManual = !canUseDropdowns || Boolean(manualByKey[key]);
          const unsetLabel =
            key === BUILDER_PLAN_MAPPING_KEY
              ? "Unset / use Patch Planner or fallback"
              : key === BLUEPRINT_PLANNER_MAPPING_KEY
                ? "Unset / use Architect Planner or fallback"
              : key === PATCH_DRAFT_MAPPING_KEY
                ? "Unset / use Patch Planner or Code Reviewer fallback"
                : "Unset / use fallback";
          const inList =
            value && modelNameInInstalledList(value, installedNames);

          return (
            <div key={key}>
              <div
                className="field-label"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  flexWrap: "wrap",
                }}
              >
                <ClickableRoleName
                  roleKey={key}
                  label={label}
                  onOpen={onOpenRoleHelp}
                />
              </div>
              {canUseDropdowns && !useManual ? (
                <select
                  id={`role-model-${key}`}
                  className="settings-input"
                  aria-label={label}
                  value={inList ? value : ""}
                  onChange={(e) => onMappingChange(key, e.target.value)}
                >
                  <option value="">{unsetLabel}</option>
                  {installedModels.models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`role-model-${key}`}
                  className="settings-input"
                  value={value}
                  onChange={(e) => onMappingChange(key, e.target.value)}
                  placeholder="Type model name (advanced/offline)"
                  aria-label={`${label} model manual`}
                />
              )}
              {canUseDropdowns ? (
                <label
                  className="field-value"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: "0.35rem",
                    fontSize: "0.82rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useManual}
                    onChange={(e) =>
                      setManualByKey((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  Use manual model name (advanced/offline)
                </label>
              ) : null}
              {value && !inList ? renderStaleWarning(value) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuilderPlanPanel({
  builderPlan,
  providerReady,
  hasSafeContext,
  modelLabel,
  modelSourceLabel,
  copyState,
  onToggleExternal,
  onToggleBuilderResult,
  onGenerate,
  onCopy,
  onOpenRoleHelp,
  localAiProgress,
  planningStyle,
}: {
  builderPlan: BuilderPlanState;
  providerReady: boolean;
  hasSafeContext: boolean;
  modelLabel: string;
  modelSourceLabel: string;
  copyState: "idle" | "copied" | "failed";
  onToggleExternal: (include: boolean) => void;
  onToggleBuilderResult: (include: boolean) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onOpenRoleHelp: (key: RoleHelpKey) => void;
  localAiProgress: LocalAiProgressState | null;
  planningStyle: PlanningStyleId;
}) {
  const saved = builderPlan.saved;
  const canGenerate = providerReady && hasSafeContext && !builderPlan.busy;
  return (
    <div className="stack" data-focus-id="builder-plan-mode">
      <div>
        <div
          className="field-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            flexWrap: "wrap",
          }}
        >
          <ClickableRoleName
            roleKey="builder-plan-mode"
            label="Builder Plan Mode — Plan Only"
            onOpen={onOpenRoleHelp}
          />
        </div>
        <HelpNote>
          This creates a plan for another builder. It does not edit files. Uses
          your local Ollama-compatible reviewer with safe metadata only — no raw
          source, no commands, no patches.
        </HelpNote>
      </div>

      <PlanningStyleStatusLine style={planningStyle} />

      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
        Model for Builder Plan Mode: <strong>{modelLabel}</strong>
        {modelSourceLabel ? ` · ${modelSourceLabel}` : ""}
      </div>

      <label
        className="field-value"
        htmlFor="builder-plan-external"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <input
          id="builder-plan-external"
          type="checkbox"
          checked={builderPlan.includeExternalReviewExcerpt}
          disabled={builderPlan.busy}
          onChange={(e) => onToggleExternal(e.target.checked)}
        />
        Use selected external review excerpt
      </label>

      <label
        className="field-value"
        htmlFor="builder-plan-builder-result"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <input
          id="builder-plan-builder-result"
          type="checkbox"
          checked={builderPlan.includeBuilderResultExcerpt}
          disabled={builderPlan.busy}
          onChange={(e) => onToggleBuilderResult(e.target.checked)}
        />
        Use latest Builder Result excerpt
      </label>

      <LocalAiProgressBanner progress={localAiProgress} mode="builder-plan-mode" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <ActionButton
          label="Generate Builder Plan with Local AI"
          hint={
            !providerReady
              ? "Connect a local AI reviewer first."
              : !hasSafeContext
                ? "Generate a Project Summary or Review Report first."
                : builderPlan.busy
                  ? "Generating plan-only Builder Plan…"
                  : "Ask local AI for a plan for Cursor/Codex/Grok/Claude (no edits)"
          }
          disabled={!canGenerate}
          primary={canGenerate}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Builder Plan"
          hint={
            copyState === "copied"
              ? "Copied Builder Plan"
              : copyState === "failed"
                ? "Copy failed — try selecting the text manually"
                : saved
                  ? "Copy the full Builder Plan markdown"
                  : "Generate a Builder Plan first"
          }
          disabled={!saved || builderPlan.busy}
          onClick={onCopy}
        />
      </div>

      {builderPlan.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {builderPlan.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Last generated {formatTime(saved.generatedAt)} · {saved.modelName} ·{" "}
            {saved.providerType}
            {saved.limitedContext ? " · limited context" : ""}
            {saved.truncated ? " · truncated for safety" : ""}
            {saved.recommendation ? ` · ${saved.recommendation}` : ""}
          </div>
          <div className="review-preview" aria-label="Builder Plan preview">
            {saved.planText.slice(0, 4000)}
            {saved.planText.length > 4000 ? "\n…" : ""}
          </div>
        </>
      ) : (
        <div className="placeholder-box">
          No Builder Plan yet. Next: connect a local AI reviewer, generate a
          Project Summary or Review Report, then click{" "}
          <strong>Generate Builder Plan with Local AI</strong>.
        </div>
      )}
    </div>
  );
}

function SpeakerScriptPanel({
  speakerScript,
  generating,
  copyState,
  onRoleChange,
  onToneChange,
  onGenerate,
  onCopy,
}: {
  speakerScript: SpeakerScriptState;
  generating: boolean;
  copyState: "idle" | "copied" | "failed";
  onRoleChange: (role: SpeakerScriptRole) => void;
  onToneChange: (tone: SpeakerScriptTone) => void;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  const saved = speakerScript.saved;
  return (
    <div className="stack" data-focus-id="speaker-scripts">
      <div>
        <div className="field-label">Speaker Scripts</div>
        <HelpNote>
          What it does: builds a plain-English briefing from safe app metadata.
          What it does not do: call Ollama, play audio, edit files, or run
          commands. Why it is safe: rule/template-based text only — no TTS yet.
        </HelpNote>
      </div>

      <label className="field-label" htmlFor="speaker-role">
        Speaker role
      </label>
      <select
        id="speaker-role"
        className="settings-input"
        value={speakerScript.role}
        onChange={(e) => onRoleChange(e.target.value as SpeakerScriptRole)}
      >
        {SPEAKER_SCRIPT_ROLES.map((role) => (
          <option key={role} value={role}>
            {SPEAKER_ROLE_LABELS[role]}
          </option>
        ))}
      </select>

      <label className="field-label" htmlFor="speaker-tone">
        Tone
      </label>
      <select
        id="speaker-tone"
        className="settings-input"
        value={speakerScript.tone}
        onChange={(e) => onToneChange(e.target.value as SpeakerScriptTone)}
      >
        {SPEAKER_SCRIPT_TONES.map((tone) => (
          <option key={tone} value={tone}>
            {SPEAKER_TONE_LABELS[tone]}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <ActionButton
          label="Generate Speaker Script"
          hint={
            generating
              ? "Building text-only script…"
              : "Rule/template-based — no AI call, no audio"
          }
          disabled={generating}
          primary
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Speaker Script"
          hint={
            copyState === "copied"
              ? "Copied Speaker Script"
              : copyState === "failed"
                ? "Copy failed — try selecting the text manually"
                : saved
                  ? "Copy the full Speaker Script markdown"
                  : "Generate a Speaker Script first"
          }
          disabled={!saved || generating}
          onClick={onCopy}
        />
      </div>

      {speakerScript.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {speakerScript.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Last generated {formatTime(saved.generatedAt)} · {saved.roleLabel} ·{" "}
            {saved.toneLabel}
            {saved.limitedContext ? " · limited context" : ""}
            {saved.truncated ? " · truncated for safety" : ""}
          </div>
          <div className="review-preview" aria-label="Speaker Script preview">
            {saved.markdownReport.slice(0, 3500)}
            {saved.markdownReport.length > 3500 ? "\n…" : ""}
          </div>
          <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
            {saved.secretSafetyNote}
          </div>
        </>
      ) : (
        <div className="placeholder-box">
          No Speaker Script yet. Next: pick a role and tone, then click{" "}
          <strong>Generate Speaker Script</strong>. Works with limited context
          even if no project is selected.
        </div>
      )}
    </div>
  );
}

function CheckpointPanel({
  checkpoint,
  availability,
  statusMessage,
  busy,
  onVerify,
}: {
  checkpoint: CheckpointRecord | null;
  availability: CheckpointAvailabilityState;
  statusMessage: string | null;
  busy: boolean;
  onVerify: () => void;
}) {
  const showRecord =
    availability.hasPreviousRecord ||
    availability.status !== "none" ||
    Boolean(checkpoint);

  return (
    <div className="stack">
      <div>
        <div className="field-label">Safety Backup</div>
        <HelpNote>
          What it does: saves a restore point before risky work. What it does
          not do: edit your project or push to GitHub. Why it is safe: local
          backup only — you choose when to restore. After reopen, verify a
          previous backup record before Restore is enabled.
        </HelpNote>
        <div className="field-value">
          {busy ? "Working…" : availability.label}
        </div>
      </div>

      {!showRecord && !busy ? (
        <div className="onedrive-warning" role="status">
          No safety backup yet. Create one before running checks or trying
          anything that might change files later.
        </div>
      ) : null}

      {availability.status === "record-unverified" ? (
        <div className="onedrive-warning" role="status">
          Previous backup record found — verify before restore. A history
          record is not the same as a verified restorable backup.
        </div>
      ) : null}

      {availability.status === "record-missing-target" ||
      availability.status === "unavailable" ? (
        <div className="onedrive-warning" role="alert">
          {availability.verificationMessage ?? availability.detail}
        </div>
      ) : null}

      {statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {statusMessage}
        </div>
      ) : null}

      {showRecord ? (
        <>
          <div>
            <div className="field-label">Backup method</div>
            <div className="field-value">
              {availability.methodLabel ??
                checkpoint?.methodLabel ??
                "Not available"}
            </div>
            <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
              {checkpoint?.plainEnglish ?? availability.detail}
            </div>
          </div>
          <div>
            <div className="field-label">Last safety backup time</div>
            <div className="field-value">
              {availability.createdAt
                ? formatTime(availability.createdAt)
                : checkpoint
                  ? formatTime(checkpoint.createdAt)
                  : "Not available"}
            </div>
          </div>
          <div>
            <div className="field-label">Restore verified</div>
            <div className="field-value">
              {availability.restorable ? "Yes" : "No"}
            </div>
          </div>
          <div>
            <div className="field-label">Restore availability</div>
            <div className="field-value">
              {availability.restorable
                ? "Available (verified restorable)"
                : availability.hasPreviousRecord
                  ? "Verify Safety Backup before restore."
                  : "Unavailable"}
            </div>
          </div>
          {availability.verificationMessage ? (
            <div>
              <div className="field-label">Verification result</div>
              <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
                {availability.verificationMessage}
              </div>
            </div>
          ) : null}
          {checkpoint ? (
            <>
              <div>
                <div className="field-label">Skipped files/folders</div>
                <div className="field-value">{checkpoint.skippedCount}</div>
              </div>
              {(() => {
                const linkSkips = checkpoint.skippedItems.filter(
                  (item) =>
                    /symlink/i.test(item.reason) ||
                    /junction/i.test(item.reason) ||
                    /reparse/i.test(item.reason),
                );
                return (
                  <div>
                    <div className="field-label">Skipped symlinks / junctions</div>
                    <div className="field-value">{linkSkips.length}</div>
                    <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                      {linkSkips.length > 0
                        ? "Unsafe links were not copied into this safety backup."
                        : "No symlinks or junctions were copied into this safety backup."}
                    </div>
                  </div>
                );
              })()}
              {checkpoint.warnings.length > 0 ? (
                <div>
                  <div className="field-label">Warnings</div>
                  <ul className="deny-list">
                    {checkpoint.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
          {!availability.restorable && availability.hasPreviousRecord ? (
            <ActionButton
              label="Verify Safety Backup"
              hint={
                busy
                  ? "Verifying (read-only)…"
                  : "Read-only check — does not restore or change project files"
              }
              disabled={busy}
              primary
              onClick={onVerify}
            />
          ) : null}
        </>
      ) : (
        <div className="placeholder-box">
          No safety backup yet. Next: click{" "}
          <strong>Create Safety Backup</strong> after selecting a project. This
          only saves a restore point — it does not edit your project by itself.
        </div>
      )}
    </div>
  );
}

function statusLabel(status: SafeCommandStatus): string {
  switch (status) {
    case "not-run":
      return "Not run";
    case "running":
      return "Running";
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "timed-out":
      return "Timed out — check may need dependencies or more time";
    case "cancelled":
      return "Cancelled";
    case "blocked":
      return "Blocked for safety";
    default:
      return status;
  }
}

function statusTone(
  status: SafeCommandStatus,
): "neutral" | "info" | "ok" | "warning" | "danger" {
  if (status === "passed") return "ok";
  if (status === "running") return "info";
  if (status === "failed" || status === "blocked") return "danger";
  if (status === "timed-out" || status === "cancelled") return "warning";
  return "neutral";
}

function qwenCliStatusLabel(status: QwenInspectState["cliStatus"]): string {
  switch (status) {
    case "available":
      return "Qwen CLI available";
    case "missing":
      return "Qwen CLI missing";
    case "failed":
      return "Qwen CLI test failed";
    default:
      return "Qwen CLI not tested";
  }
}

function ExternalReviewPanel({
  externalReview,
  hasProject,
  reviewPackExists,
  draftText,
  draftLabel,
  onSourceChange,
  onDraftChange,
  onLabelChange,
  onSave,
  onClearDraft,
  onSelect,
  onDelete,
  onCopy,
  copyState,
}: {
  externalReview: ExternalReviewState;
  hasProject: boolean;
  reviewPackExists: boolean;
  draftText: string;
  draftLabel: string;
  onSourceChange: (source: ExternalReviewSource) => void;
  onDraftChange: (text: string) => void;
  onLabelChange: (label: string) => void;
  onSave: () => void;
  onClearDraft: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (id?: string) => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const reviews = externalReview.reviews ?? [];
  const selected = externalReview.selected;
  const comparison = externalReview.comparison;
  const canSave = draftText.trim().length > 0;

  return (
    <div className="stack">
      <div>
        <div className="field-label">External Reviews (multi-import)</div>
        <HelpNote>
          What it does: paste advice from ChatGPT, Claude, Gemini, Grok, or
          Qwen and save multiple reviews per project. What it does not do: run
          those instructions. Why it is safe: text storage only — advice is
          never executed. Saving adds a new review; it does not replace others.
        </HelpNote>
      </div>

      <div className="onedrive-warning" role="status">
        External reviews are advice only. New Type Tech Coder will not execute
        pasted instructions. Read carefully before you act on anything.
      </div>

      {!hasProject ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          No project selected — you can still save a limited-context External
          Review. Selecting a project first gives better context.
        </div>
      ) : null}

      <div>
        <div className="field-label">Review source</div>
        <select
          className="settings-input"
          value={externalReview.source}
          onChange={(event) =>
            onSourceChange(event.target.value as ExternalReviewSource)
          }
        >
          {EXTERNAL_REVIEW_SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Optional short label</div>
        <input
          className="settings-input"
          value={draftLabel}
          maxLength={120}
          placeholder="e.g. Claude patch review #1"
          onChange={(event) => onLabelChange(event.target.value)}
        />
      </div>

      <div>
        <div className="field-label">Paste external review response</div>
        <textarea
          className="request-box"
          value={draftText}
          maxLength={80000}
          placeholder="Paste the external reviewer’s response here…"
          onChange={(event) => onDraftChange(event.target.value)}
        />
      </div>

      <div className="stack">
        <ActionButton
          label="Save External Review"
          hint={
            !canSave
              ? "Paste a review response first"
              : "Adds a new saved review — nothing will run"
          }
          disabled={!canSave}
          primary={canSave}
          onClick={onSave}
        />
        <ActionButton
          label="Clear Draft"
          hint="Clear paste box only — saved reviews stay"
          disabled={!draftText.trim() && !draftLabel.trim()}
          onClick={onClearDraft}
        />
      </div>

      {externalReview.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {externalReview.statusMessage}
        </div>
      ) : null}
      {externalReview.capNote ? (
        <div className="onedrive-warning" role="status">
          {externalReview.capNote}
        </div>
      ) : null}

      <div>
        <div className="field-label">
          Saved reviews ({reviews.length})
          {reviewPackExists
            ? " · included when you regenerate review packs"
            : ""}
        </div>
        {reviews.length === 0 ? (
          <div className="placeholder-box">
            No external reviews saved yet. Next: paste a response, then click{" "}
            <strong>Save External Review</strong>.
          </div>
        ) : (
          <div className="stack">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="summary-box"
                style={{
                  border:
                    selected?.id === review.id
                      ? "1px solid #8a6a3a"
                      : undefined,
                }}
              >
                <div className="field-value">
                  <strong>{review.source}</strong>
                  {review.label ? ` · ${review.label}` : ""} ·{" "}
                  {formatTime(review.savedAt)}
                </div>
                <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                  Context: {review.contextBasis.join(", ")} · Risks:{" "}
                  {review.hasRiskySuggestions
                    ? `${review.riskyPhrases.length} (${review.riskyPhrases.join(", ")})`
                    : "0"}
                </div>
                <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                  {review.reviewText.slice(0, 180)}
                  {review.reviewText.length > 180 ? "…" : ""}
                </div>
                <div className="stack" style={{ marginTop: "0.4rem" }}>
                  <ActionButton
                    label={selected?.id === review.id ? "Selected" : "View"}
                    hint="Select this review for preview and packs"
                    disabled={selected?.id === review.id}
                    onClick={() => onSelect(review.id)}
                  />
                  <ActionButton
                    label="Copy"
                    hint={
                      copyState === "copied"
                        ? "Copied External Review"
                        : copyState === "failed"
                          ? "Copy failed — try again"
                          : "Copy this review text"
                    }
                    onClick={() => onCopy(review.id)}
                  />
                  <ActionButton
                    label="Delete"
                    hint="Remove from app storage only"
                    onClick={() => onDelete(review.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div>
          <div className="field-label">Selected review preview</div>
          <div className="field-value">
            {selected.source}
            {selected.label ? ` · ${selected.label}` : ""} ·{" "}
            {formatTime(selected.savedAt)}
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Context: {selected.contextBasis.join(", ")}
            {selected.truncated ? " · text truncated for size" : ""}
          </div>
          {selected.hasRiskySuggestions ? (
            <div className="onedrive-warning" role="alert">
              Caution: this review appears to mention risky actions (
              {selected.riskyPhrases.join(", ")}). Keyword match only — treat as
              advice; do not execute.
            </div>
          ) : null}
          <div className="review-preview" aria-label="Selected External Review">
            {selected.reviewText.slice(0, 4000)}
            {selected.reviewText.length > 4000 ? "\n…" : ""}
          </div>
          <ActionButton
            label="Copy Selected Review"
            hint={
              copyState === "copied"
                ? "Copied External Review"
                : copyState === "failed"
                  ? "Copy failed — try again"
                  : "Copy selected review text"
            }
            primary
            onClick={() => onCopy(selected.id)}
          />
        </div>
      ) : null}

      {comparison ? (
        <div>
          <div className="field-label">Review Comparison (keyword-based only)</div>
          <div className="onedrive-warning" role="status">
            {comparison.methodNote} Review manually.
          </div>
          <div className="summary-box">{comparison.plainEnglish}</div>
          <ul className="deny-list">
            <li>Reviews saved: {comparison.reviewCount}</li>
            <li>
              Sources:{" "}
              {comparison.sourcesRepresented.length
                ? comparison.sourcesRepresented.join(", ")
                : "None"}
            </li>
            <li>
              Reviews with risky phrase warnings:{" "}
              {comparison.reviewsWithRiskyPhrases}
            </li>
            <li>
              Appears to mention approve:{" "}
              {comparison.appearsToMentionApprove ? "Yes" : "No"}
            </li>
            <li>
              Appears to mention revise:{" "}
              {comparison.appearsToMentionRevise ? "Yes" : "No"}
            </li>
            <li>
              Appears to mention revert:{" "}
              {comparison.appearsToMentionRevert ? "Yes" : "No"}
            </li>
            <li>
              Common concern keywords:{" "}
              {comparison.commonConcernKeywords.length
                ? comparison.commonConcernKeywords.join(", ")
                : "None"}
            </li>
            <li>
              Disagreement indicator:{" "}
              {comparison.disagreementDetected
                ? "Yes — needs human decision"
                : "No"}
            </li>
            <li>
              Local AI Reviewer exists:{" "}
              {comparison.localAdvisorExists ? "Yes" : "No"}
            </li>
            <li>
              Build/Test Checks result:{" "}
              {comparison.safeChecksResultExists ? "Yes" : "No"}
            </li>
          </ul>
          {comparison.needsHumanDecision ? (
            <div className="onedrive-warning" role="alert">
              Needs human decision — disagreement and/or risky phrases were
              flagged by keyword matching only.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BuilderResultPanel({
  builderResult,
  hasProject,
  draftText,
  draftLabel,
  onSourceChange,
  onResponseTypeChange,
  onDraftChange,
  onLabelChange,
  onSave,
  onClear,
  onCopy,
  copyState,
}: {
  builderResult: BuilderResultState;
  hasProject: boolean;
  draftText: string;
  draftLabel: string;
  onSourceChange: (source: BuilderResultSource) => void;
  onResponseTypeChange: (responseType: BuilderResultResponseType) => void;
  onDraftChange: (text: string) => void;
  onLabelChange: (label: string) => void;
  onSave: () => void;
  onClear: () => void;
  onCopy: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const saved = builderResult.saved;
  const canSave = draftText.trim().length > 0;

  return (
    <div className="stack">
      <div>
        <div className="field-label">Builder Result / Builder Response</div>
        <HelpNote>
          What it does: paste a builder AI’s plan or implementation report back
          into New Type Tech Coder for storage, warnings, and plan comparison.
          Use response type “Builder plan” or “Revised builder plan” when pasting
          an outside plan. What it does not do: run commands, edit files, trigger
          Safe Checks, restore, or call AI. Why it is safe: text-only
          advice/reporting — never executed.
        </HelpNote>
      </div>

      <div className="onedrive-warning" role="status">
        Builder results are text only. New Type Tech Coder will not execute
        pasted instructions, edit project files, or run checks automatically.
      </div>

      {!hasProject ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          No project selected — you can still save a limited-context Builder
          Result. Selecting a project first gives better context.
        </div>
      ) : null}

      <div>
        <div className="field-label">Builder source</div>
        <select
          className="settings-input"
          value={builderResult.source}
          onChange={(event) =>
            onSourceChange(event.target.value as BuilderResultSource)
          }
        >
          {BUILDER_RESULT_SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Response type</div>
        <select
          className="settings-input"
          value={builderResult.responseType}
          onChange={(event) =>
            onResponseTypeChange(event.target.value as BuilderResultResponseType)
          }
        >
          {BUILDER_RESULT_RESPONSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Optional short label</div>
        <input
          className="settings-input"
          value={draftLabel}
          maxLength={120}
          placeholder="e.g. Cursor plan for Stage 19"
          onChange={(event) => onLabelChange(event.target.value)}
        />
      </div>

      <div>
        <div className="field-label">Paste builder response</div>
        <textarea
          className="request-box"
          value={draftText}
          maxLength={80000}
          placeholder="Paste the builder AI’s plan or implementation report here…"
          onChange={(event) => onDraftChange(event.target.value)}
        />
      </div>

      <div className="stack">
        <ActionButton
          label="Save Builder Result"
          hint={
            !canSave
              ? "Paste a builder response first"
              : "Stores text only — nothing will run"
          }
          disabled={!canSave}
          primary={canSave}
          onClick={onSave}
        />
        <ActionButton
          label="Clear Builder Result"
          hint="Clear saved result and draft from app storage"
          disabled={!saved && !draftText.trim() && !draftLabel.trim()}
          onClick={onClear}
        />
        <ActionButton
          label="Copy Builder Result"
          hint={
            copyState === "copied"
              ? "Copied Builder Result"
              : copyState === "failed"
                ? "Copy failed — try again"
                : saved
                  ? "Copy saved builder response text"
                  : "Save a Builder Result first"
          }
          disabled={!saved}
          onClick={onCopy}
        />
      </div>

      {builderResult.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {builderResult.statusMessage}
        </div>
      ) : null}

      <div>
        <div className="field-label">Builder Result preview</div>
        {!saved ? (
          <div className="placeholder-box">
            No Builder Result saved yet. Next: paste a response, then click{" "}
            <strong>Save Builder Result</strong>.
          </div>
        ) : (
          <div className="summary-box">
            <div className="field-value">
              <strong>{saved.source}</strong> · {saved.responseType}
              {saved.label ? ` · ${saved.label}` : ""} · Last saved{" "}
              {formatTime(saved.savedAt)}
            </div>
            <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
              Appears as: {saved.appearsAs}
              {saved.truncated ? " · truncated" : ""}
              {saved.limitedContext ? " · limited context" : ""}
            </div>
            {saved.hasRiskySuggestions ? (
              <div className="onedrive-warning" role="status">
                Risk warnings: {saved.riskyPhrases.join(", ")}
              </div>
            ) : (
              <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                Risk warnings: none flagged
              </div>
            )}
            {saved.hasMismatchWarnings ? (
              <div className="onedrive-warning" role="status">
                Mismatch warnings: {saved.mismatchWarnings.join("; ")}
              </div>
            ) : (
              <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                Mismatch warnings: none flagged
              </div>
            )}
            <div className="review-preview" aria-label="Builder Result preview">
              {saved.responseText.slice(0, 2500)}
              {saved.responseText.length > 2500 ? "\n…" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BuilderPlanComparisonPanel({
  comparison,
  hasImportedPlan,
  hasNttcBuilderPlan,
  generating,
  copyState,
  onGenerate,
  onCopy,
  planningStyle,
}: {
  comparison: BuilderPlanComparisonState;
  hasImportedPlan: boolean;
  hasNttcBuilderPlan: boolean;
  generating: boolean;
  copyState: "idle" | "copied" | "failed";
  onGenerate: () => void;
  onCopy: () => void;
  planningStyle: PlanningStyleId;
}) {
  const saved = comparison.saved;
  return (
    <div className="stack" data-focus-id="builder-plan-comparison">
      <div>
        <div className="field-label">Builder Plan Comparison</div>
        <HelpNote>
          What it does: compares an imported outside builder plan against NTTC’s
          Builder Plan and related safe reports using keyword rules. What it does
          not do: call Ollama, edit files, run commands, or prove implementation
          happened.
        </HelpNote>
        <PlanningStyleStatusLine style={planningStyle} />
      </div>

      {!hasImportedPlan ? (
        <div className="onedrive-warning" role="status">
          Paste a builder plan first. Save a Builder Result with type Builder
          plan, Revised builder plan, or Plan only.
        </div>
      ) : null}

      {hasImportedPlan && !hasNttcBuilderPlan ? (
        <div className="onedrive-warning" role="status">
          No NTTC Builder Plan exists yet. Comparison will be weaker.
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <ActionButton
          label="Generate Comparison Report"
          hint={
            !hasImportedPlan
              ? "Paste a builder plan first."
              : generating
                ? "Building rule-based comparison…"
                : "Compare imported plan vs NTTC reports (no Ollama)"
          }
          disabled={!hasImportedPlan || generating}
          primary={hasImportedPlan && !generating}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Comparison Report"
          hint={
            copyState === "copied"
              ? "Copied Comparison Report"
              : copyState === "failed"
                ? "Copy failed — try again"
                : saved
                  ? "Copy the full Comparison Report markdown"
                  : "Generate a Comparison Report first"
          }
          disabled={!saved || generating}
          onClick={onCopy}
        />
      </div>

      {comparison.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {comparison.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-value" style={{ fontSize: "0.9rem" }}>
            Recommendation badge: <strong>{saved.recommendation}</strong>
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            {saved.importedSource} / {saved.importedResponseType} ·{" "}
            {formatTime(saved.generatedAt)}
            {saved.weakComparison ? " · weaker comparison" : ""}
            {saved.truncated ? " · truncated" : ""}
          </div>
          <div
            className="review-preview"
            aria-label="Builder Plan Comparison preview"
          >
            {saved.previewExcerpt}
          </div>
        </>
      ) : (
        <div className="placeholder-box">
          No Comparison Report yet. Next: save an imported builder plan, then
          click <strong>Generate Comparison Report</strong>.
        </div>
      )}
    </div>
  );
}

function ImplementationReviewPanel({
  review,
  hasImplementationReport,
  hasApprovedPlanOrComparison,
  generating,
  copyState,
  onGenerate,
  onCopy,
}: {
  review: ImplementationReviewState;
  hasImplementationReport: boolean;
  hasApprovedPlanOrComparison: boolean;
  generating: boolean;
  copyState: "idle" | "copied" | "failed";
  onGenerate: () => void;
  onCopy: () => void;
}) {
  const saved = review.saved;
  return (
    <div className="stack" data-focus-id="implementation-review">
      <div>
        <div className="field-label">Implementation Review</div>
        <HelpNote>
          What it does: reviews a pasted outside builder Implementation report
          against NTTC plans, comparisons, and safe metadata using keyword
          rules. What it does not do: call Ollama, edit files, run commands,
          inspect raw project files, or prove implementation is correct.
        </HelpNote>
      </div>

      {!hasImplementationReport ? (
        <div className="onedrive-warning" role="status">
          Paste an implementation report first. Save a Builder Result with type
          Implementation report.
        </div>
      ) : null}

      {hasImplementationReport && !hasApprovedPlanOrComparison ? (
        <div className="onedrive-warning" role="status">
          No approved plan/comparison exists. Alignment review will be weaker.
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <ActionButton
          label="Generate Implementation Review"
          hint={
            !hasImplementationReport
              ? "Paste an implementation report first."
              : generating
                ? "Building rule-based implementation review…"
                : "Review claimed implementation vs NTTC reports (no Ollama)"
          }
          disabled={!hasImplementationReport || generating}
          primary={hasImplementationReport && !generating}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Implementation Review"
          hint={
            copyState === "copied"
              ? "Copied Implementation Review"
              : copyState === "failed"
                ? "Copy failed — try again"
                : saved
                  ? "Copy the full Implementation Review markdown"
                  : "Generate an Implementation Review first"
          }
          disabled={!saved || generating}
          onClick={onCopy}
        />
      </div>

      {review.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {review.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-value" style={{ fontSize: "0.9rem" }}>
            Recommendation badge: <strong>{saved.recommendation}</strong>
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            {saved.importedSource} / {saved.importedResponseType} ·{" "}
            {formatTime(saved.generatedAt)}
            {saved.weakAlignment ? " · weaker alignment" : ""}
            {saved.truncated ? " · truncated" : ""}
          </div>
          <div
            className="review-preview"
            aria-label="Implementation Review preview"
          >
            {saved.previewExcerpt}
          </div>
        </>
      ) : (
        <div className="placeholder-box">
          No Implementation Review yet. Next: save an Implementation report, then
          click <strong>Generate Implementation Review</strong>.
        </div>
      )}
    </div>
  );
}

function BacklogPanel({
  backlog,
  hasProject,
  projectName,
  projectPath,
  draftTitle,
  draftNotes,
  draftRelatedStage,
  onTitleChange,
  onTypeChange,
  onPriorityChange,
  onStatusChange,
  onNotesChange,
  onStageChange,
  onFilterChange,
  onSave,
  onUpdate,
  onSelect,
  onDelete,
  onCopy,
  onGenerateReport,
  onCopyReport,
  itemCopyState,
  reportCopyState,
}: {
  backlog: BacklogState;
  hasProject: boolean;
  projectName: string | null;
  projectPath: string | null;
  draftTitle: string;
  draftNotes: string;
  draftRelatedStage: string;
  onTitleChange: (title: string) => void;
  onTypeChange: (type: BacklogItemType) => void;
  onPriorityChange: (priority: BacklogPriority) => void;
  onStatusChange: (status: BacklogStatus) => void;
  onNotesChange: (notes: string) => void;
  onStageChange: (stage: string) => void;
  onFilterChange: (filters: Partial<BacklogFilters>) => void;
  onSave: () => void;
  onUpdate: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (id?: string) => void;
  onGenerateReport: () => void;
  onCopyReport: () => void;
  itemCopyState: "idle" | "copied" | "failed";
  reportCopyState: "idle" | "copied" | "failed";
}) {
  const canSave = draftTitle.trim().length > 0;
  const selected = backlog.selected;
  const filtered = backlog.filteredItems ?? [];
  const projectOptions = [
    ...new Set(
      backlog.items
        .map((i) => i.projectPath)
        .filter((p): p is string => Boolean(p)),
    ),
  ];

  return (
    <div className="stack">
      <div>
        <div className="field-label">Bug Log / Improvement Backlog</div>
        <HelpNote>
          What it does: track bugs, UX issues, safety concerns, packaging notes,
          and feature ideas in app-owned storage. What it does not do: edit
          project files, run commands, or call AI. Why it is safe: text notes
          only — never executed.
        </HelpNote>
      </div>

      <div className="onedrive-warning" role="status">
        Backlog notes are text only. New Type Tech Coder will not execute them
        or modify selected project files.
      </div>

      {!hasProject ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          No project selected — new items can still be saved without a project
          link.
        </div>
      ) : (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          Related project for new items: {projectName}
        </div>
      )}

      <div>
        <div className="field-label">Title</div>
        <input
          className="settings-input"
          value={draftTitle}
          maxLength={200}
          placeholder="Short backlog title"
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </div>

      <div>
        <div className="field-label">Type</div>
        <select
          className="settings-input"
          value={backlog.draftType}
          onChange={(event) =>
            onTypeChange(event.target.value as BacklogItemType)
          }
        >
          {BACKLOG_ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Priority</div>
        <select
          className="settings-input"
          value={backlog.draftPriority}
          onChange={(event) =>
            onPriorityChange(event.target.value as BacklogPriority)
          }
        >
          {BACKLOG_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Status</div>
        <select
          className="settings-input"
          value={backlog.draftStatus}
          onChange={(event) =>
            onStatusChange(event.target.value as BacklogStatus)
          }
        >
          {BACKLOG_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Related stage / version</div>
        <input
          className="settings-input"
          value={draftRelatedStage}
          maxLength={80}
          placeholder="e.g. Stage 21"
          onChange={(event) => onStageChange(event.target.value)}
        />
      </div>

      <div>
        <div className="field-label">Notes</div>
        <textarea
          className="request-box"
          value={draftNotes}
          maxLength={80000}
          placeholder="Describe the bug, UX issue, safety concern, or idea…"
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </div>

      <div className="stack">
        <ActionButton
          label="Save Backlog Item"
          hint={
            !canSave
              ? "Enter a title first"
              : "Creates a new backlog item (text only)"
          }
          disabled={!canSave}
          primary={canSave}
          onClick={onSave}
        />
        <ActionButton
          label="Update Backlog Item"
          hint={
            !selected
              ? "Select an item first"
              : !canSave
                ? "Enter a title first"
                : "Updates the selected item"
          }
          disabled={!selected || !canSave}
          onClick={onUpdate}
        />
        <ActionButton
          label="Copy Backlog Item"
          hint={
            itemCopyState === "copied"
              ? "Copied backlog item"
              : itemCopyState === "failed"
                ? "Copy failed — try again"
                : selected
                  ? "Copy selected item text"
                  : "Select an item first"
          }
          disabled={!selected}
          onClick={() => onCopy(selected?.id)}
        />
        <ActionButton
          label="Generate Backlog Review Report"
          hint="Builds a copyable backlog summary report"
          onClick={onGenerateReport}
        />
        <ActionButton
          label="Copy Backlog Review Report"
          hint={
            reportCopyState === "copied"
              ? "Copied backlog report"
              : reportCopyState === "failed"
                ? "Copy failed — try again"
                : backlog.lastReport
                  ? "Copy backlog report markdown"
                  : "Generate a report first"
          }
          disabled={!backlog.lastReport}
          onClick={onCopyReport}
        />
      </div>

      {backlog.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {backlog.statusMessage}
        </div>
      ) : null}
      {backlog.capNote ? (
        <div className="onedrive-warning" role="status">
          {backlog.capNote}
        </div>
      ) : null}

      {selected?.hasRiskySuggestions ? (
        <div className="onedrive-warning" role="status">
          Risk warnings on selected item: {selected.riskyPhrases.join(", ")}
        </div>
      ) : null}

      <div>
        <div className="field-label">Filters</div>
        <div className="stack">
          <select
            className="settings-input"
            value={backlog.filters.status}
            onChange={(event) =>
              onFilterChange({
                status: event.target.value as BacklogFilters["status"],
              })
            }
          >
            <option value="All">Status: All</option>
            {BACKLOG_STATUSES.map((status) => (
              <option key={status} value={status}>
                Status: {status}
              </option>
            ))}
          </select>
          <select
            className="settings-input"
            value={backlog.filters.priority}
            onChange={(event) =>
              onFilterChange({
                priority: event.target.value as BacklogFilters["priority"],
              })
            }
          >
            <option value="All">Priority: All</option>
            {BACKLOG_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                Priority: {priority}
              </option>
            ))}
          </select>
          <select
            className="settings-input"
            value={backlog.filters.type}
            onChange={(event) =>
              onFilterChange({
                type: event.target.value as BacklogFilters["type"],
              })
            }
          >
            <option value="All">Type: All</option>
            {BACKLOG_ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                Type: {type}
              </option>
            ))}
          </select>
          <select
            className="settings-input"
            value={backlog.filters.projectPath}
            onChange={(event) =>
              onFilterChange({
                projectPath: event.target.value as BacklogFilters["projectPath"],
              })
            }
          >
            <option value="All">Project: All</option>
            <option value="Unassigned">Project: Unassigned</option>
            {projectPath ? (
              <option value={projectPath}>
                Project: Current ({projectName})
              </option>
            ) : null}
            {projectOptions
              .filter((p) => p !== projectPath)
              .map((p) => (
                <option key={p} value={p}>
                  Project: {p}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div>
        <div className="field-label">
          Saved backlog items ({filtered.length}
          {filtered.length !== backlog.items.length
            ? ` of ${backlog.items.length}`
            : ""}
          )
        </div>
        {filtered.length === 0 ? (
          <div className="placeholder-box">
            No backlog items match these filters. Next: enter a title and click{" "}
            <strong>Save Backlog Item</strong>.
          </div>
        ) : (
          <div className="stack">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="summary-box"
                style={{
                  border:
                    selected?.id === item.id
                      ? "1px solid #8a6a3a"
                      : undefined,
                }}
              >
                <div className="field-value">
                  <strong>{item.title}</strong> · {item.type} · {item.priority}{" "}
                  · {item.status}
                </div>
                <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                  {item.projectName ?? "No project"} · Created{" "}
                  {formatTime(item.createdAt)} · Updated{" "}
                  {formatTime(item.updatedAt)}
                  {item.relatedStage ? ` · ${item.relatedStage}` : ""}
                </div>
                <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                  {item.notes.slice(0, 180)}
                  {item.notes.length > 180 ? "…" : ""}
                </div>
                {item.hasRiskySuggestions ? (
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Risk warnings: {item.riskyPhrases.join(", ")}
                  </div>
                ) : null}
                <div className="stack" style={{ marginTop: "0.4rem" }}>
                  <ActionButton
                    label={selected?.id === item.id ? "Selected" : "View"}
                    hint="Load this item into the editor"
                    disabled={selected?.id === item.id}
                    onClick={() => onSelect(item.id)}
                  />
                  <ActionButton
                    label="Copy"
                    hint="Copy this backlog item"
                    onClick={() => onCopy(item.id)}
                  />
                  <ActionButton
                    label="Delete"
                    hint="Remove from app storage only"
                    onClick={() => onDelete(item.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {backlog.lastReport ? (
        <div>
          <div className="field-label">
            Backlog Review Report · {formatTime(backlog.lastReport.generatedAt)}
          </div>
          <div className="review-preview" aria-label="Backlog report preview">
            {backlog.lastReport.previewExcerpt}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QwenInspectPanel({
  qwen,
  hasProject,
  hasSummaryOrPack,
  onTestCli,
  onGeneratePack,
  onCopyPack,
  onCopyReport,
  packCopyState,
  reportCopyState,
}: {
  qwen: QwenInspectState;
  hasProject: boolean;
  hasSummaryOrPack: boolean;
  onTestCli: () => void;
  onGeneratePack: () => void;
  onCopyPack: () => void;
  onCopyReport: () => void;
  packCopyState: "idle" | "copied" | "failed";
  reportCopyState: "idle" | "copied" | "failed";
}) {
  return (
    <div className="stack">
      <div>
        <div className="field-label">Qwen Inspect Prompt</div>
        <HelpNote>
          What it does: builds a copy-paste prompt for a manual Qwen Code
          session. What it does not do: run Qwen against your files from this
          app. Why it is safe: live Qwen is disabled for safety — Prompt Pack
          only.
        </HelpNote>
      </div>

      <div className="onedrive-warning" role="status">
        Live Qwen is disabled for safety. Use Generate Qwen Inspect Prompt, then
        paste it into Qwen Code yourself. This app will not edit files via Qwen.
      </div>

      <div>
        <div className="field-label">Qwen CLI status</div>
        <div className="field-value">
          <StatusBadge
            label={qwenCliStatusLabel(qwen.cliStatus)}
            tone={
              qwen.cliStatus === "available"
                ? "ok"
                : qwen.cliStatus === "missing" || qwen.cliStatus === "failed"
                  ? "danger"
                  : "neutral"
            }
          />
        </div>
        {qwen.lastTestMessage ? (
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            {qwen.lastTestMessage}
          </div>
        ) : null}
      </div>

      <div>
        <div className="field-label">File-change verification</div>
        <div className="field-value muted">
          {qwen.fileChangeVerification ??
            "Not applicable — live Qwen is disabled for safety."}
        </div>
      </div>

      <ActionButton
        label="Test Qwen CLI"
        hint={
          qwen.testing
            ? "Testing harmless --version/--help…"
            : `Probe “${qwen.command}” only (no project edits)`
        }
        disabled={qwen.testing}
        onClick={onTestCli}
      />

      <ActionButton
        label="Generate Qwen Inspect Prompt"
        hint={
          !hasProject && !hasSummaryOrPack
            ? "Works with limited context; better after Summarize / Review Report"
            : "Builds a copy-paste inspect-only prompt for a manual Qwen session"
        }
        disabled={false}
        primary
        onClick={onGeneratePack}
      />

      <ActionButton
        label="Copy Qwen Inspect Prompt"
        hint={
          packCopyState === "copied"
            ? "Copied Qwen Prompt"
            : packCopyState === "failed"
              ? "Copy failed — try again"
              : qwen.promptPack
                ? "Copy the full Qwen Inspect Prompt markdown"
                : "Generate a Qwen Inspect Prompt first"
        }
        disabled={!qwen.promptPack}
        onClick={onCopyPack}
      />

      <ActionButton
        label="Run Qwen Inspect"
        hint="Live Qwen is disabled for safety"
        disabled
      />

      {qwen.promptPack ? (
        <>
          <div className="field-label">Qwen Inspect Prompt preview</div>
          <div className="review-preview" aria-label="Qwen Inspect Prompt preview">
            {qwen.promptPack.previewExcerpt}
            {"\n…"}
          </div>
        </>
      ) : (
        <div className="placeholder-box">
          No Qwen inspect prompt yet. Next: click{" "}
          <strong>Generate Qwen Inspect Prompt</strong>, then copy it into a
          manual Qwen Code session. Live Run stays disabled for safety.
        </div>
      )}

      <div>
        <div className="field-label">Qwen Inspect Report</div>
        {qwen.lastReport ? (
          <>
            <div className="review-preview">{qwen.lastReport.reportText.slice(0, 2500)}</div>
            <ActionButton
              label="Copy Qwen Inspect Report"
              hint={
                reportCopyState === "copied"
                  ? "Copied Qwen Inspect Report"
                  : reportCopyState === "failed"
                    ? "Copy failed"
                    : "Copy report"
              }
              disabled={false}
              onClick={onCopyReport}
            />
          </>
        ) : (
          <div className="placeholder-box">
            No live Qwen inspect report. Live Qwen is disabled for safety, so
            this app does not run Qwen against your project.
          </div>
        )}
      </div>
    </div>
  );
}

function SafeChecksPanel({
  safeChecks,
  hasProject,
  hasSummary,
  disabledExtra,
  onRun,
  onCancel,
  onCopyOutput,
  copyState,
}: {
  safeChecks: SafeChecksState;
  hasProject: boolean;
  hasSummary: boolean;
  disabledExtra: boolean;
  onRun: (kind: SafeCheckKind) => void;
  onCancel: () => void;
  onCopyOutput: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const last: SafeCommandResult | null = safeChecks.lastResult;
  const runnable = safeChecks.available.filter((item) => item.available && !item.blocked);
  const lifecycleBlocked = safeChecks.blocked.filter(
    (item) => item.lifecycleHooks && item.lifecycleHooks.length > 0,
  );
  const primaryKinds: SafeCheckKind[] = ["build", "test", "typecheck", "lint"];
  const extraKinds: SafeCheckKind[] = ["check", "format:check", "validate"];

  function candidateFor(kind: SafeCheckKind) {
    return safeChecks.available.find((item) => item.kind === kind) ?? null;
  }

  function canRun(kind: SafeCheckKind): boolean {
    if (!hasProject || !hasSummary || safeChecks.running || disabledExtra) return false;
    const candidate = candidateFor(kind);
    return Boolean(candidate?.available && !candidate.blocked);
  }

  return (
    <div className="stack">
      <div>
        <div className="field-label">Build/Test Checks</div>
        <HelpNote>
          What it does: runs only allowlisted build/test scripts from your
          project. What it does not do: open a terminal or accept custom
          commands. Why it is safe: you click and confirm each check — nothing
          runs automatically. Package-manager pre/post scripts block the run
          when present.
        </HelpNote>
      </div>

      <div className="onedrive-warning" role="status">
        Package managers can automatically run pre/post scripts (for example
        prebuild/postbuild). If those hooks exist, Build/Test Checks stay
        blocked until a non-coder reviews them.
      </div>

      {!hasProject ? (
        <div className="placeholder-box">
          No project selected. Next: select a project folder. Build/Test Checks
          stay disabled until then.
        </div>
      ) : !hasSummary ? (
        <div className="placeholder-box">
          No summary yet, so checks are not detected. Next: click{" "}
          <strong>Summarize Project</strong> so the app can find safe scripts
          from package.json.
        </div>
      ) : !safeChecks.packageJsonFound ? (
        <div className="placeholder-box">
          No package.json found, so no JavaScript build/test checks are
          available for this project. You can still use summaries and review
          reports.
        </div>
      ) : runnable.length === 0 && lifecycleBlocked.length === 0 ? (
        <div className="placeholder-box">
          No safe build/test checks available. Scripts may be missing, blocked
          as risky, or need dependencies installed manually outside this app.
        </div>
      ) : (
        <>
          <div>
            <div className="field-label">Detected package manager</div>
            <div className="field-value">{safeChecks.packageManager}</div>
            {safeChecks.packageManagerWarning ? (
              <div className="onedrive-warning" role="status">
                {safeChecks.packageManagerWarning} If checks fail, install
                dependencies manually outside this app, then try again.
              </div>
            ) : null}
          </div>

          {lifecycleBlocked.length > 0 ? (
            <div className="onedrive-warning" role="alert">
              <div className="field-label">Lifecycle-hook blocked</div>
              <div>
                This check was blocked because package managers can automatically
                run pre/post scripts. A non-coder should review these hooks before
                running the check outside this app.
              </div>
              <ul className="deny-list">
                {lifecycleBlocked.map((item) => (
                  <li key={`life-${item.scriptName}`}>
                    <strong>{item.scriptName}</strong> blocked by:{" "}
                    {(item.lifecycleHooks ?? []).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <div className="field-label">Available build/test checks</div>
            {runnable.length === 0 ? (
              <div className="field-value muted">
                None available (missing, risky, or lifecycle-hook blocked).
              </div>
            ) : (
              <ul className="deny-list">
                {runnable.map((item) => (
                  <li key={item.scriptName}>
                    {item.scriptName} → {item.argvPreview}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(safeChecks.blocked.length > 0 || safeChecks.unavailable.length > 0) && (
            <div>
              <div className="field-label">Unavailable / blocked</div>
              <ul className="deny-list">
                {safeChecks.blocked.slice(0, 12).map((item) => (
                  <li key={`b-${item.scriptName}`}>
                    {item.scriptName}: {item.reason}
                  </li>
                ))}
                {safeChecks.unavailable.slice(0, 8).map((item) => (
                  <li key={`u-${item.scriptName}`}>
                    {item.scriptName}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="stack">
            {primaryKinds.map((kind) => {
              const candidate = candidateFor(kind);
              const label =
                kind === "build"
                  ? "Run Build"
                  : kind === "test"
                    ? "Run Test"
                    : kind === "typecheck"
                      ? "Run Typecheck"
                      : "Run Lint";
              return (
                <ActionButton
                  key={kind}
                  label={label}
                  hint={
                    !candidate
                      ? `No “${kind}” script detected`
                      : candidate.blocked
                        ? candidate.reason ?? "Blocked as risky"
                        : !candidate.available
                          ? "Unavailable"
                          : safeChecks.running
                            ? "Another check is running…"
                            : candidate.plainEnglishCommand
                  }
                  disabled={!canRun(kind)}
                  onClick={() => onRun(kind)}
                />
              );
            })}
            {extraKinds.map((kind) => {
              const candidate = candidateFor(kind);
              if (!candidate?.available || candidate.blocked) return null;
              return (
                <ActionButton
                  key={kind}
                  label={candidate.displayLabel}
                  hint={candidate.plainEnglishCommand}
                  disabled={!canRun(kind)}
                  onClick={() => onRun(kind)}
                />
              );
            })}
            <ActionButton
              label="Cancel Running Check"
              hint={
                safeChecks.running
                  ? "Stop the current build/test check if possible"
                  : "No check is running"
              }
              disabled={!safeChecks.running}
              onClick={onCancel}
            />
          </div>
        </>
      )}

      <div>
        <div className="field-label">Check status</div>
        <div className="field-value">
          {last ? (
            <StatusBadge label={statusLabel(last.status)} tone={statusTone(last.status)} />
          ) : (
            <StatusBadge label="Not run" tone="neutral" />
          )}
        </div>
      </div>

      {last?.status === "failed" &&
      looksLikeMissingDependencies(last.combinedOutput) &&
      !last.plainEnglishSummary.includes(MISSING_DEPENDENCIES_HELPER) ? (
        <div className="onedrive-warning" role="status">
          {MISSING_DEPENDENCIES_HELPER}
        </div>
      ) : null}

      {last?.status === "timed-out" ? (
        <div className="onedrive-warning" role="alert">
          This check timed out. Next: make sure dependencies are installed,
          close other heavy programs, or run the same script outside this app if
          you need a longer timeout.
        </div>
      ) : null}

      {safeChecks.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {safeChecks.statusMessage}
        </div>
      ) : null}

      {last ? (
        <>
          <div className="summary-box">{last.plainEnglishSummary}</div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            {last.argv.length ? last.argv.join(" ") : last.scriptName}
            {last.exitCode !== null ? ` · exit ${last.exitCode}` : ""}
            {last.durationMs !== null ? ` · ${last.durationMs}ms` : ""}
            {last.outputTruncated ? " · output truncated" : ""}
          </div>
          {last.combinedOutput.trim() ? (
            <details className="command-output-details">
              <summary>Show check output</summary>
              <pre className="command-output">{last.combinedOutput}</pre>
              <ActionButton
                label="Copy Check Output"
                hint={
                  copyState === "copied"
                    ? "Copied Check Output"
                    : copyState === "failed"
                      ? "Copy failed — try again"
                      : "Copy truncated check output"
                }
                disabled={false}
                onClick={onCopyOutput}
              />
            </details>
          ) : null}
        </>
      ) : hasProject && hasSummary && safeChecks.packageJsonFound && runnable.length > 0 ? (
        <div className="placeholder-box">
          No build/test check has been run yet. Next: click a Run button above
          and confirm. Dependencies are not installed automatically.
        </div>
      ) : null}
    </div>
  );
}

function DecisionReportPanel({
  decision,
  hasProject,
  generatingDecision,
  generatingBuilder,
  onGenerateDecision,
  onCopyDecision,
  onGenerateBuilder,
  onCopyBuilder,
  decisionCopyState,
  builderCopyState,
  planningStyle,
}: {
  decision: DecisionState;
  hasProject: boolean;
  generatingDecision: boolean;
  generatingBuilder: boolean;
  onGenerateDecision: () => void;
  onCopyDecision: () => void;
  onGenerateBuilder: () => void;
  onCopyBuilder: () => void;
  decisionCopyState: "idle" | "copied" | "failed";
  builderCopyState: "idle" | "copied" | "failed";
  planningStyle: PlanningStyleId;
}) {
  const report = decision.decisionReport;
  const prompt = decision.builderPrompt;
  const recommendation =
    decision.lastRecommendedNextAction ??
    report?.recommendedNextAction ??
    prompt?.recommendedNextAction ??
    null;

  return (
    <div className="stack">
      <div>
        <div className="field-label">Decision Report / Builder Prompt</div>
        <HelpNote>
          What it does: turns your gathered evidence into a Decision Report and
          a plan-only Builder Prompt you can paste into Cursor, Codex, Grok, or
          Claude. What it does not do: edit files or tell a builder to code
          immediately. Why it is safe: rule-based metadata only — no raw
          source, no live Qwen, no automatic implementation.
        </HelpNote>
        <PlanningStyleStatusLine style={planningStyle} />
      </div>

      {!hasProject ? (
        <div className="placeholder-box">
          No project selected. You can still generate a limited Decision Report,
          but selecting a project first is better.
        </div>
      ) : null}

      {recommendation ? (
        <div className="onedrive-warning" role="status">
          Recommended next action (metadata rules): {recommendation.label}.{" "}
          {recommendation.plainEnglish}
        </div>
      ) : (
        <div className="placeholder-box">
          No recommendation yet. Next: click{" "}
          <strong>Generate Decision Report</strong>.
        </div>
      )}

      {decision.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {decision.statusMessage}
        </div>
      ) : null}

      <div className="stack">
        <ActionButton
          label="Generate Decision Report"
          hint={
            generatingDecision
              ? "Building Decision Report…"
              : "Rule-based report from available metadata"
          }
          disabled={generatingDecision}
          onClick={onGenerateDecision}
        />
        <ActionButton
          label="Copy Decision Report"
          hint={
            decisionCopyState === "copied"
              ? "Copied Decision Report"
              : decisionCopyState === "failed"
                ? "Copy failed — try again"
                : report
                  ? "Copy Decision Report markdown"
                  : "Generate a Decision Report first"
          }
          disabled={!report}
          primary={Boolean(report)}
          onClick={onCopyDecision}
        />
        <div data-focus-id="builder-prompt" className="stack">
          <ActionButton
            label="Generate Builder Prompt"
            hint={
              generatingBuilder
                ? "Building plan-only Builder Prompt…"
                : "Plan-only prompt for outside builder AIs"
            }
            disabled={generatingBuilder}
            onClick={onGenerateBuilder}
          />
          <ActionButton
            label="Copy Builder Prompt"
            hint={
              builderCopyState === "copied"
                ? "Copied Builder Prompt"
                : builderCopyState === "failed"
                  ? "Copy failed — try again"
                  : prompt
                    ? "Copy plan-only Builder Prompt"
                    : "Generate a Builder Prompt first"
            }
            disabled={!prompt}
            primary={Boolean(prompt)}
            onClick={onCopyBuilder}
          />
        </div>
      </div>

      {report ? (
        <>
          <div className="field-value">
            Decision Report · {formatTime(report.generatedAt)} ·{" "}
            {report.recommendedNextAction.label}
          </div>
          <div className="review-preview" aria-label="Decision Report preview">
            {report.previewExcerpt}
            {"\n"}…
          </div>
        </>
      ) : null}

      {prompt ? (
        <>
          <div className="field-value">
            Builder Prompt · {formatTime(prompt.generatedAt)} · plan-only
          </div>
          <div className="review-preview" aria-label="Builder Prompt preview">
            {prompt.previewExcerpt}
            {"\n"}…
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            {prompt.secretSafetyNote}
          </div>
        </>
      ) : null}
    </div>
  );
}


function ProjectMemoryPanel({
  projectMemory,
  hasProject,
  generating,
  onGenerate,
  onCopyBundle,
  onCopyActive,
  copyBundleState,
  copyActiveState,
  activeFile,
  onActiveFileChange,
  saveDialogOpen,
  saveDialogMode,
  onOpenSaveDialog,
  onCancelSaveDialog,
  onConfirmSave,
  planningStyle,
}: {
  projectMemory: ProjectMemoryState;
  hasProject: boolean;
  generating: boolean;
  onGenerate: () => void;
  onCopyBundle: () => void;
  onCopyActive: () => void;
  copyBundleState: "idle" | "copied" | "failed";
  copyActiveState: "idle" | "copied" | "failed";
  activeFile: string;
  onActiveFileChange: (fileName: string) => void;
  saveDialogOpen: boolean;
  saveDialogMode: "first" | "overwrite";
  onOpenSaveDialog: () => void;
  onCancelSaveDialog: () => void;
  onConfirmSave: () => void;
  planningStyle: PlanningStyleId;
}) {
  const preview = projectMemory.preview;
  const activePreview = preview?.files.find((f) => f.fileName === activeFile);

  return (
    <div className="stack" data-focus-id="project-memory">
      <div>
        <div className="field-label">Project Memory / Handoff Files</div>
        <HelpNote>
          What it does: generates markdown planning/handoff files for planners,
          builders, reviewers, or human programmers. What it does not do: edit
          source code, install packages, or write outside <code>.nttc/</code>.
          Why it is safe: documentation-only writes inside{" "}
          <code>.nttc/</code> after you review and confirm.
        </HelpNote>
        <PlanningStyleStatusLine style={planningStyle} />
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {PROJECT_MEMORY_SAFETY_NOTE}
        </div>
      </div>

      <ActionButton
        label="Generate Project Memory Preview"
        hint={
          generating
            ? "Building markdown handoff preview…"
            : "Uses safe NTTC reports/metadata only — no raw source"
        }
        disabled={generating || projectMemory.busy}
        onClick={onGenerate}
      />

      {!preview ? (
        <div className="placeholder-box">
          No Project Memory preview yet. Generate a preview, review the five
          markdown files, then save to <strong>.nttc/</strong> inside the selected
          project.
        </div>
      ) : (
        <>
          <div className="field-value">
            Preview generated {formatTime(preview.generatedAt)}
          </div>
          {preview.truncationFlags.length > 0 ? (
            <div className="onedrive-warning" role="status">
              Some content was truncated for safe export size:{" "}
              {preview.truncationFlags.join(" ")}
            </div>
          ) : null}
          <div>
            <div className="field-label">Files that will be written</div>
            <ul className="plain-list">
              {PROJECT_MEMORY_FILE_NAMES.map((name) => (
                <li key={name}>
                  <code>.nttc/{name}</code>
                  {projectMemory.pendingOverwriteFiles.includes(name)
                    ? " (exists — overwrite confirmation required)"
                    : ""}
                </li>
              ))}
            </ul>
          </div>
          <div className="memory-file-tabs" role="tablist" aria-label="Project Memory preview files">
            {PROJECT_MEMORY_FILE_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                className={activeFile === name ? "memory-file-tab active" : "memory-file-tab"}
                aria-selected={activeFile === name}
                onClick={() => onActiveFileChange(name)}
              >
                {name.replace(".md", "")}
              </button>
            ))}
          </div>
          <textarea
            className="review-preview memory-preview-textarea"
            readOnly
            aria-label={`Preview ${activeFile}`}
            value={activePreview?.content ?? ""}
          />
          <ActionButton
            label={`Copy ${activeFile}`}
            hint={
              copyActiveState === "copied"
                ? "Copied preview text"
                : "Copy the visible preview file text"
            }
            disabled={!activePreview}
            onClick={onCopyActive}
          />
          <ActionButton
            label="Copy Project Memory Bundle"
            hint={
              copyBundleState === "copied"
                ? "Copied full bundle"
                : "Copy all five files as one markdown bundle"
            }
            disabled={!preview.bundleMarkdown}
            onClick={onCopyBundle}
          />
        </>
      )}

      {projectMemory.lastSaved ? (
        <div className="field-value">
          Last saved {formatTime(projectMemory.lastSaved.savedAt)} —{" "}
          {projectMemory.lastSaved.filesWritten.join(", ")}
        </div>
      ) : (
        <div className="field-value muted">Not saved to `.nttc/` yet.</div>
      )}

      {projectMemory.saveBlockedReason ? (
        <div className="onedrive-warning" role="status">
          {projectMemory.saveBlockedReason}
        </div>
      ) : null}

      {saveDialogOpen ? (
        <div className="memory-save-dialog" role="dialog" aria-label="Confirm Project Memory save">
          <p>
            {saveDialogMode === "overwrite"
              ? "Some `.nttc/` files already exist. Overwrite them with this preview?"
              : "Save these markdown files to `.nttc/`?"}
          </p>
          <p className="field-value muted">
            This will not edit source code. Only approved markdown files inside{" "}
            <code>.nttc/</code> are written.
          </p>
          {saveDialogMode === "overwrite" ? (
            <p className="field-value">
              Files to overwrite: {projectMemory.pendingOverwriteFiles.join(", ")}
            </p>
          ) : null}
          <div className="row gap">
            <ActionButton
              label="Cancel"
              hint="Close without saving"
              onClick={onCancelSaveDialog}
            />
            <ActionButton
              label="Confirm Save"
              hint="Write markdown files to `.nttc/`"
              primary
              disabled={!hasProject || projectMemory.busy}
              onClick={onConfirmSave}
            />
          </div>
        </div>
      ) : (
        <ActionButton
          label="Save Project Memory Files"
          hint={
            !hasProject
              ? "Select a project folder first"
              : !preview
                ? "Generate a preview first"
                : projectMemory.busy
                  ? "Saving…"
                  : "Requires confirmation — writes `.nttc/` markdown only"
          }
          disabled={!hasProject || !preview || projectMemory.busy}
          primary
          onClick={onOpenSaveDialog}
        />
      )}

      {projectMemory.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {projectMemory.statusMessage}
        </div>
      ) : null}
    </div>
  );
}

function ReviewPackPanel({
  pack,
  onCopy,
  copyState,
}: {
  pack: OutsideReviewPack | null;
  onCopy: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  return (
    <div className="stack">
      <div>
        <div className="field-label">Copy-Paste Review Report</div>
        <HelpNote>
          What it does: builds a markdown report you can paste into ChatGPT,
          Claude, Gemini, or Grok. What it does not do: send anything to the
          cloud by itself. Why it is safe: uses summaries and status only — no
          secrets or raw source code.
        </HelpNote>
      </div>

      {!pack ? (
        <div className="placeholder-box">
          No copy-paste review report yet. Next: type a request (optional), then
          click <strong>Generate Copy-Paste Review Report</strong>. This does
          not send anything to an AI by itself.
        </div>
      ) : (
        <>
          <div className="field-value">
            Generated {formatTime(pack.generatedAt)}
          </div>

          <div>
            <div className="field-label">Request text included</div>
            <div className="field-value">
              {pack.userRequestIncluded
                ? "Yes"
                : "No — report notes that no request was entered"}
            </div>
          </div>

          {pack.limitedContext ? (
            <div className="onedrive-warning" role="status">
              Limited context:{" "}
              {!pack.projectSelected
                ? "no project selected. Select a folder and summarize for a fuller report."
                : "project summary data was unavailable. Click Summarize Project, then generate again."}
            </div>
          ) : null}

          <div className="review-preview" aria-label="Copy-Paste Review Report preview">
            {pack.previewExcerpt}
            {"\n"}…
          </div>

          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            {pack.secretSafetyNote}
          </div>

          <ActionButton
            label="Copy Review Report"
            hint={
              copyState === "copied"
                ? "Copied Review Report"
                : copyState === "failed"
                  ? "Copy failed — try again"
                  : "Does not auto-copy on generate — use this button"
            }
            disabled={false}
            primary
            onClick={onCopy}
          />
        </>
      )}
    </div>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestDraft, setRequestDraft] = useState("");
  const [summaryCopyState, setSummaryCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [packCopyState, setPackCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [patchCopyState, setPatchCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [decisionCopyState, setDecisionCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [builderCopyState, setBuilderCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [advisorCopyState, setAdvisorCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [speakerCopyState, setSpeakerCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [builderPlanCopyState, setBuilderPlanCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [builderPlanComparisonCopyState, setBuilderPlanComparisonCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [implementationReviewCopyState, setImplementationReviewCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [generatingComparison, setGeneratingComparison] = useState(false);
  const [generatingImplementationReview, setGeneratingImplementationReview] =
    useState(false);
  const [commandCopyState, setCommandCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [qwenPackCopyState, setQwenPackCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [qwenReportCopyState, setQwenReportCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [externalCopyState, setExternalCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [builderResultCopyState, setBuilderResultCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [backlogItemCopyState, setBacklogItemCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [backlogReportCopyState, setBacklogReportCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [guideCopyState, setGuideCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [blueprintQuestionsCopyState, setBlueprintQuestionsCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [blueprintPromptCopyState, setBlueprintPromptCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [blueprintImportedCopyState, setBlueprintImportedCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [blueprintPhase1CopyState, setBlueprintPhase1CopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [blueprintLocalPlannerCopyState, setBlueprintLocalPlannerCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [blueprintPhaseTaskCardsCopyAllState, setBlueprintPhaseTaskCardsCopyAllState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [blueprintPhaseTaskCardCopyState, setBlueprintPhaseTaskCardCopyState] =
    useState<Record<string, "idle" | "copied" | "failed">>({});
  const [taskBuilderHandoffCopyState, setTaskBuilderHandoffCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [taskImplementationIntakeCopyState, setTaskImplementationIntakeCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [taskReconciliationCopyState, setTaskReconciliationCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [taskArtifactIndexCopyState, setTaskArtifactIndexCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [architectureHealthCopyState, setArchitectureHealthCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [architectureRefactorCopyAllState, setArchitectureRefactorCopyAllState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [architectureRefactorCopyTaskState, setArchitectureRefactorCopyTaskState] =
    useState<Record<string, "idle" | "copied" | "failed">>({});
  const [architectureRefactorHandoffCopyState, setArchitectureRefactorHandoffCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [architectureRefactorImplIntakeCopyState, setArchitectureRefactorImplIntakeCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [architectureRefactorImplIntakeDraft, setArchitectureRefactorImplIntakeDraft] =
    useState("");
  const skipNextRefactorImplDraftSync = useRef(true);
  const [taskImplementationIntakeDraft, setTaskImplementationIntakeDraft] =
    useState("");
  const skipNextTaskImplDraftSync = useRef(true);
  const [externalDraft, setExternalDraft] = useState("");
  const [externalLabel, setExternalLabel] = useState("");
  const [builderResultDraft, setBuilderResultDraft] = useState("");
  const [builderResultLabel, setBuilderResultLabel] = useState("");
  const [backlogTitleDraft, setBacklogTitleDraft] = useState("");
  const [backlogNotesDraft, setBacklogNotesDraft] = useState("");
  const [backlogStageDraft, setBacklogStageDraft] = useState("Stage 21");
  const [activeTab, setActiveTab] = useState<AppTabId>("dashboard");
  const [roleHelpKey, setRoleHelpKey] = useState<RoleHelpKey | null>(null);
  const openRoleHelp = useCallback((key: RoleHelpKey) => {
    setRoleHelpKey(key);
  }, []);
  const closeRoleHelp = useCallback(() => {
    setRoleHelpKey(null);
  }, []);
  const [tabAttention, setTabAttention] = useState<
    Partial<Record<AppTabId, TabAttention>>
  >({});
  const prevSignalsRef = useRef<{
    projectPath: string | null;
    summaryAt: string | null;
    reviewPackAt: string | null;
    patchPackAt: string | null;
    decisionAt: string | null;
    builderPromptAt: string | null;
    builderResultAt: string | null;
    advisorAt: string | null;
    externalCount: number;
    checkpointAt: string | null;
    checkStatus: string | null;
    backlogCount: number;
    backlogCriticalSafety: number;
    qwenPackAt: string | null;
  } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [scanningChangedFiles, setScanningChangedFiles] = useState(false);
  const [generatingPatchPack, setGeneratingPatchPack] = useState(false);
  const [generatingDecision, setGeneratingDecision] = useState(false);
  const [generatingBuilder, setGeneratingBuilder] = useState(false);
  const [generatingSpeaker, setGeneratingSpeaker] = useState(false);
  const [generatingProjectMemory, setGeneratingProjectMemory] = useState(false);
  const [refreshingCodeContext, setRefreshingCodeContext] = useState(false);
  const [generatingCodeContext, setGeneratingCodeContext] = useState(false);
  const [codeContextCopyState, setCodeContextCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [codeContextAiCopyState, setCodeContextAiCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [patchDraftCopyState, setPatchDraftCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [patchDraftSafetyReviewCopyState, setPatchDraftSafetyReviewCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [importedPatchDraftCopyState, setImportedPatchDraftCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [importedPatchDraftDraft, setImportedPatchDraftDraft] = useState("");
  const [generatingPatchDraftSafetyReview, setGeneratingPatchDraftSafetyReview] =
    useState(false);
  const [
    generatingExternalPatchDraftComparison,
    setGeneratingExternalPatchDraftComparison,
  ] = useState(false);
  const [
    externalPatchDraftComparisonCopyState,
    setExternalPatchDraftComparisonCopyState,
  ] = useState<"idle" | "copied" | "failed">("idle");
  const [generatingBuilderHandoffExport, setGeneratingBuilderHandoffExport] =
    useState(false);
  const [builderHandoffExportCopyState, setBuilderHandoffExportCopyState] =
    useState<"idle" | "copied" | "failed">("idle");
  const [codeContextFilterDraft, setCodeContextFilterDraft] = useState("");
  const [codeContextQuestionDraft, setCodeContextQuestionDraft] = useState("");
  const [codeContextMaxLinesDraft, setCodeContextMaxLinesDraft] = useState(
    DEFAULT_CODE_CONTEXT_MAX_LINES_PER_FILE,
  );
  const [codeContextMaxCharsDraft, setCodeContextMaxCharsDraft] = useState(
    DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS,
  );
  const codeContextFilterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeContextQuestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [projectMemoryCopyBundleState, setProjectMemoryCopyBundleState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [projectMemoryCopyActiveState, setProjectMemoryCopyActiveState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [projectMemoryActiveFile, setProjectMemoryActiveFile] = useState<string>(
    PROJECT_MEMORY_FILE_NAMES[0],
  );
  const [projectMemorySaveDialogOpen, setProjectMemorySaveDialogOpen] =
    useState(false);
  const [projectMemorySaveDialogMode, setProjectMemorySaveDialogMode] = useState<
    "first" | "overwrite"
  >("first");
  const [testingProvider, setTestingProvider] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [testingQwen, setTestingQwen] = useState(false);
  const [baseUrlDraft, setBaseUrlDraft] = useState("http://127.0.0.1:11434");
  const [modelDraft, setModelDraft] = useState("qwen2.5-coder");
  const [qwenCommandDraft, setQwenCommandDraft] = useState("qwen");
  const [providerTypeDraft, setProviderTypeDraft] =
    useState<ActiveProviderKind>("ollama-compatible");
  const requestSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const externalDraftSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importedPatchDraftSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const taskImplDraftSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refactorImplDraftSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const builderResultDraftSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const backlogNotesSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRequestSync = useRef(false);
  const skipNextSettingsSync = useRef(true);
  const skipNextExternalDraftSync = useRef(true);
  const skipNextImportedPatchDraftSync = useRef(true);
  const skipNextBuilderResultDraftSync = useRef(true);
  const skipNextBacklogDraftSync = useRef(true);

  const applySnapshot = useCallback((next: AppSnapshot) => {
    setSnapshot(next);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function boot() {
      try {
        if (!window.nttc) {
          setLoadError("Desktop bridge is not available. Launch with Electron (npm run dev).");
          return;
        }
        const initial = await window.nttc.getSnapshot();
        skipNextRequestSync.current = true;
        skipNextSettingsSync.current = true;
        setRequestDraft(initial.userRequest);
        setBaseUrlDraft(initial.providerSettings.baseUrl);
        setModelDraft(initial.providerSettings.modelName);
        setQwenCommandDraft(initial.providerSettings.qwenCommand || "qwen");
        setProviderTypeDraft(initial.providerSettings.providerType);
        skipNextExternalDraftSync.current = true;
        setExternalDraft(initial.externalReview?.draftText ?? "");
        setExternalLabel(initial.externalReview?.draftLabel ?? "");
        skipNextImportedPatchDraftSync.current = true;
        setImportedPatchDraftDraft(initial.importedPatchDraft?.draftText ?? "");
        skipNextBuilderResultDraftSync.current = true;
        setBuilderResultDraft(initial.builderResult?.draftText ?? "");
        setBuilderResultLabel(initial.builderResult?.draftLabel ?? "");
        skipNextBacklogDraftSync.current = true;
        setBacklogTitleDraft(initial.backlog?.draftTitle ?? "");
        setBacklogNotesDraft(initial.backlog?.draftNotes ?? "");
        setBacklogStageDraft(initial.backlog?.draftRelatedStage ?? "Stage 21");
        applySnapshot(initial);
        setCodeContextFilterDraft(initial.codeContext?.filterQuery ?? "");
        setCodeContextQuestionDraft(initial.codeContext?.codeQuestion ?? "");
        setCodeContextMaxLinesDraft(
          initial.codeContext?.maxLinesPerFile ?? DEFAULT_CODE_CONTEXT_MAX_LINES_PER_FILE,
        );
        setCodeContextMaxCharsDraft(
          initial.codeContext?.maxTotalChars ?? DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS,
        );
        unsubscribe = window.nttc.onSnapshotUpdated((next) => {
          applySnapshot(next);
        });
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load app state.",
        );
      }
    }

    void boot();
    return () => {
      unsubscribe?.();
      if (requestSyncTimer.current) {
        clearTimeout(requestSyncTimer.current);
      }
      if (settingsSyncTimer.current) {
        clearTimeout(settingsSyncTimer.current);
      }
      if (externalDraftSyncTimer.current) {
        clearTimeout(externalDraftSyncTimer.current);
      }
      if (importedPatchDraftSyncTimer.current) {
        clearTimeout(importedPatchDraftSyncTimer.current);
      }
      if (builderResultDraftSyncTimer.current) {
        clearTimeout(builderResultDraftSyncTimer.current);
      }
      if (backlogNotesSyncTimer.current) {
        clearTimeout(backlogNotesSyncTimer.current);
      }
    };
  }, [applySnapshot]);

  useEffect(() => {
    if (!window.nttc) return;
    if (skipNextRequestSync.current) {
      skipNextRequestSync.current = false;
      return;
    }
    if (requestSyncTimer.current) {
      clearTimeout(requestSyncTimer.current);
    }
    requestSyncTimer.current = setTimeout(() => {
      void window.nttc.setUserRequest(requestDraft).then(applySnapshot);
    }, 450);
    return () => {
      if (requestSyncTimer.current) {
        clearTimeout(requestSyncTimer.current);
      }
    };
  }, [requestDraft, applySnapshot]);

  useEffect(() => {
    if (!window.nttc) return;
    if (skipNextSettingsSync.current) {
      skipNextSettingsSync.current = false;
      return;
    }
    if (settingsSyncTimer.current) {
      clearTimeout(settingsSyncTimer.current);
    }
    settingsSyncTimer.current = setTimeout(() => {
      void window.nttc
        .updateProviderSettings({
          providerType: providerTypeDraft,
          baseUrl: baseUrlDraft,
          modelName: modelDraft,
          qwenCommand: qwenCommandDraft,
        })
        .then(applySnapshot);
    }, 500);
    return () => {
      if (settingsSyncTimer.current) {
        clearTimeout(settingsSyncTimer.current);
      }
    };
  }, [providerTypeDraft, baseUrlDraft, modelDraft, qwenCommandDraft, applySnapshot]);

  useEffect(() => {
    if (!window.nttc) return;
    if (skipNextExternalDraftSync.current) {
      skipNextExternalDraftSync.current = false;
      return;
    }
    if (externalDraftSyncTimer.current) {
      clearTimeout(externalDraftSyncTimer.current);
    }
    externalDraftSyncTimer.current = setTimeout(() => {
      void window.nttc.setExternalReviewDraft(externalDraft).then(applySnapshot);
    }, 450);
    return () => {
      if (externalDraftSyncTimer.current) {
        clearTimeout(externalDraftSyncTimer.current);
      }
    };
  }, [externalDraft, applySnapshot]);

  useEffect(() => {
    if (!window.nttc) return;
    if (skipNextImportedPatchDraftSync.current) {
      skipNextImportedPatchDraftSync.current = false;
      return;
    }
    if (importedPatchDraftSyncTimer.current) {
      clearTimeout(importedPatchDraftSyncTimer.current);
    }
    importedPatchDraftSyncTimer.current = setTimeout(() => {
      void window.nttc
        .setImportedPatchDraftDraft(importedPatchDraftDraft)
        .then(applySnapshot);
    }, 450);
    return () => {
      if (importedPatchDraftSyncTimer.current) {
        clearTimeout(importedPatchDraftSyncTimer.current);
      }
    };
  }, [importedPatchDraftDraft, applySnapshot]);

  useEffect(() => {
    if (skipNextTaskImplDraftSync.current) {
      skipNextTaskImplDraftSync.current = false;
      return;
    }
    setTaskImplementationIntakeDraft(
      (snapshot.blueprint ?? emptyBlueprint).taskImplementationIntake.draftText,
    );
  }, [snapshot.blueprint?.taskImplementationIntake.draftText]);

  useEffect(() => {
    if (!window.nttc) return;
    if (taskImplDraftSyncTimer.current) {
      clearTimeout(taskImplDraftSyncTimer.current);
    }
    taskImplDraftSyncTimer.current = setTimeout(() => {
      void window.nttc
        .setTaskImplementationIntakeDraftText(taskImplementationIntakeDraft)
        .then(applySnapshot);
    }, 450);
    return () => {
      if (taskImplDraftSyncTimer.current) {
        clearTimeout(taskImplDraftSyncTimer.current);
      }
    };
  }, [taskImplementationIntakeDraft, applySnapshot]);

  useEffect(() => {
    if (skipNextRefactorImplDraftSync.current) {
      skipNextRefactorImplDraftSync.current = false;
      return;
    }
    setArchitectureRefactorImplIntakeDraft(
      (snapshot.architectureRefactorTaskImplementationIntake ??
        emptyArchitectureRefactorTaskImplementationIntake).draftText,
    );
  }, [snapshot.architectureRefactorTaskImplementationIntake?.draftText]);

  useEffect(() => {
    if (!window.nttc) return;
    if (refactorImplDraftSyncTimer.current) {
      clearTimeout(refactorImplDraftSyncTimer.current);
    }
    refactorImplDraftSyncTimer.current = setTimeout(() => {
      void window.nttc
        ?.setArchitectureRefactorTaskImplementationIntakeDraftText(
          architectureRefactorImplIntakeDraft,
        )
        .then(applySnapshot);
    }, 450);
    return () => {
      if (refactorImplDraftSyncTimer.current) {
        clearTimeout(refactorImplDraftSyncTimer.current);
      }
    };
  }, [architectureRefactorImplIntakeDraft, applySnapshot]);

  useEffect(() => {
    if (!window.nttc) return;
    if (skipNextBuilderResultDraftSync.current) {
      skipNextBuilderResultDraftSync.current = false;
      return;
    }
    if (builderResultDraftSyncTimer.current) {
      clearTimeout(builderResultDraftSyncTimer.current);
    }
    builderResultDraftSyncTimer.current = setTimeout(() => {
      void window.nttc.setBuilderResultDraft(builderResultDraft).then(applySnapshot);
    }, 450);
    return () => {
      if (builderResultDraftSyncTimer.current) {
        clearTimeout(builderResultDraftSyncTimer.current);
      }
    };
  }, [builderResultDraft, applySnapshot]);

  useEffect(() => {
    if (!window.nttc) return;
    if (skipNextBacklogDraftSync.current) {
      skipNextBacklogDraftSync.current = false;
      return;
    }
    if (backlogNotesSyncTimer.current) {
      clearTimeout(backlogNotesSyncTimer.current);
    }
    backlogNotesSyncTimer.current = setTimeout(() => {
      void window.nttc.setBacklogDraftNotes(backlogNotesDraft).then(applySnapshot);
    }, 450);
    return () => {
      if (backlogNotesSyncTimer.current) {
        clearTimeout(backlogNotesSyncTimer.current);
      }
    };
  }, [backlogNotesDraft, applySnapshot]);

  const project = snapshot.safety.project;
  const hasProject = Boolean(project);
  const summary = snapshot.projectSummary;
  const summaryIsFromHistory = snapshot.summaryIsFromHistory;
  const reviewPack = snapshot.reviewPack;
  const changedFiles = snapshot.changedFiles ?? emptySnapshot.changedFiles;
  const patchReviewPack = changedFiles.patchReviewPack;
  const latestCheckpoint = snapshot.latestCheckpoint;
  const checkpointAvailability =
    snapshot.checkpointAvailability ?? emptySnapshot.checkpointAvailability;
  const checkpointBusy = snapshot.checkpointBusy;
  const advisorResponse = snapshot.advisorResponse;
  const advisorBusy = snapshot.advisorBusy;
  const localAiRole = snapshot.localAiRole ?? DEFAULT_LOCAL_AI_ROLE;
  const selectedLocalAiRole = getLocalAiRole(localAiRole);
  const safeChecks = snapshot.safeChecks ?? emptySafeChecks;
  const qwen = snapshot.qwen ?? emptyQwen;
  const externalReview = snapshot.externalReview ?? emptyExternalReview;
  const builderResult = snapshot.builderResult ?? emptyBuilderResult;
  const speakerScript = snapshot.speakerScript ?? emptySpeakerScript;
  const builderPlan = snapshot.builderPlan ?? emptyBuilderPlan;
  const builderPlanComparison =
    snapshot.builderPlanComparison ?? emptyBuilderPlanComparison;
  const implementationReview =
    snapshot.implementationReview ?? emptyImplementationReview;
  const installedModels = snapshot.installedModels ?? emptyInstalledModels;
  const roleModelMapping = snapshot.roleModelMapping ?? emptyRoleModelMapping;
  const backlog = snapshot.backlog ?? emptyBacklog;
  const decision = snapshot.decision ?? emptyDecision;
  const projectMemory = snapshot.projectMemory ?? emptyProjectMemory;
  const architectureHealth = snapshot.architectureHealth ?? emptyArchitectureHealth;
  const safeScaffoldTarget =
    snapshot.safeScaffoldTarget ?? emptySafeScaffoldTarget;
  const safeScaffoldFileTreePreview =
    snapshot.safeScaffoldFileTreePreview ?? emptySafeScaffoldFileTreePreview;
  const architectureRefactorTaskCards =
    snapshot.architectureRefactorTaskCards ?? emptyArchitectureRefactorTaskCards;
  const architectureRefactorTaskBuilderHandoff =
    snapshot.architectureRefactorTaskBuilderHandoff ??
    emptyArchitectureRefactorTaskBuilderHandoff;
  const architectureRefactorTaskImplementationIntake =
    snapshot.architectureRefactorTaskImplementationIntake ??
    emptyArchitectureRefactorTaskImplementationIntake;
  const architectureRefactorSaved = architectureRefactorTaskCards.saved;
  const architectureRefactorDraftedTaskId =
    architectureRefactorSaved?.cards.find((c) => c.status === "drafted")?.id ??
    architectureRefactorSaved?.activeTaskId ??
    null;
  const architectureRefactorImplementationReturnedTaskId =
    architectureRefactorSaved?.cards.find(
      (c) => c.status === "implementation-returned",
    )?.id ?? null;
  const architectureRefactorSentToBuilderTaskId =
    architectureRefactorSaved?.cards.find(
      (c) => c.status === "sent-to-builder",
    )?.id ?? null;
  const architectureRefactorImplementationReports = Object.values(
    architectureRefactorTaskImplementationIntake.reportsByTaskId,
  );
  const architectureRefactorImplementationReportCount =
    architectureRefactorImplementationReports.filter((r) => !r.stale).length;
  const architectureRefactorPendingMarkReturnedReport =
    architectureRefactorImplementationReports.find(
      (r) => !r.stale && !r.markedImplementationReturned,
    ) ?? null;
  const architectureRefactorReviewedTaskId =
    architectureRefactorSaved?.cards.find((c) => c.status === "reviewed")?.id ??
    null;
  const architectureRefactorNextTaskId =
    architectureRefactorTaskImplementationIntake.nextTaskSuggestion?.match(
      /ARCH-\d+/,
    )?.[0] ?? null;
  const codeContext = snapshot.codeContext ?? emptyCodeContext;
  const codeContextAi = snapshot.codeContextAi ?? emptyCodeContextAi;
  const patchDraft = snapshot.patchDraft ?? emptyPatchDraft;
  const patchDraftSafetyReview =
    snapshot.patchDraftSafetyReview ?? emptyPatchDraftSafetyReview;
  const importedPatchDraft =
    snapshot.importedPatchDraft ?? emptyImportedPatchDraft;
  const externalPatchDraftComparison =
    snapshot.externalPatchDraftComparison ?? emptyExternalPatchDraftComparison;
  const builderHandoffExport =
    snapshot.builderHandoffExport ?? emptyBuilderHandoffExport;
  const blueprint = snapshot.blueprint ?? emptyBlueprint;
  const planningStyle = snapshot.planningStyle ?? emptyPlanningStyle;
  const localAiProgress = snapshot.localAiProgress ?? null;
  const history = snapshot.history ?? emptySnapshot.history;
  const providerReady = snapshot.provider.connectionState === "ready";
  const hasSafeAiContext = Boolean(
    summary ||
      reviewPack ||
      patchReviewPack ||
      decision.decisionReport,
  );
  const canAskLocalAi =
    providerReady &&
    hasSafeAiContext &&
    !advisorBusy;
  const canGenerateBuilderPlan =
    providerReady && hasSafeAiContext && !builderPlan.busy;
  const hasCodeContextPack = Boolean(codeContext.preview?.markdownReport?.trim());
  const canAskCodeContextAi =
    providerReady && hasCodeContextPack && !codeContextAi.busy && !codeContext.busy;
  const canGeneratePatchDraft =
    providerReady && hasCodeContextPack && !patchDraft.busy && !codeContext.busy;
  const resolvedRoleModel = resolveLocalAiRoleModel({
    roleId: localAiRole,
    mappings: roleModelMapping.mappings,
    globalFallbackModel: snapshot.providerSettings.modelName,
    installedNames: installedModels.models.map((m) => m.name),
  });
  const resolvedBuilderPlanModel = resolveBuilderPlanModel({
    mappings: roleModelMapping.mappings,
    globalFallbackModel: snapshot.providerSettings.modelName,
    installedNames: installedModels.models.map((m) => m.name),
  });
  const resolvedCodeContextReviewModel = resolveCodeContextReviewModel({
    mappings: roleModelMapping.mappings,
    globalFallbackModel: snapshot.providerSettings.modelName,
    installedNames: installedModels.models.map((m) => m.name),
  });
  const resolvedPatchDraftModel = resolvePatchDraftModel({
    mappings: roleModelMapping.mappings,
    globalFallbackModel: snapshot.providerSettings.modelName,
    installedNames: installedModels.models.map((m) => m.name),
  });

  const hasRunnableChecks =
    hasProject &&
    Boolean(summary) &&
    safeChecks.packageJsonFound &&
    safeChecks.available.some((item) => item.available && !item.blocked);

  const workflowSteps: Array<{
    step: number;
    label: string;
    detail: string;
    state: "done" | "ready" | "unavailable" | "optional";
    hint: string;
  }> = [
    {
      step: 1,
      label: "Select a project folder",
      detail: hasProject
        ? `Selected: ${project?.displayName}`
        : "Use Select Project Folder on the Project Setup tab.",
      state: hasProject ? "done" : "ready",
      hint: hasProject
        ? "Click to choose a different folder"
        : "Click to open folder picker",
    },
    {
      step: 2,
      label: "Summarize the project",
      detail: summary
        ? summaryIsFromHistory
          ? "Previous saved summary is showing — re-summarize to refresh."
          : "Summary is ready."
        : "Click Summarize Project after selecting a folder.",
      state: !hasProject
        ? "unavailable"
        : summary && !summaryIsFromHistory
          ? "done"
          : "ready",
      hint: !hasProject
        ? "Click to select a project first"
        : "Click to run Summarize Project",
    },
    {
      step: 3,
      label: "Create a safety backup",
      detail: checkpointAvailability.restorable
        ? "Safety Backup verified — restore available."
        : checkpointAvailability.hasPreviousRecord
          ? checkpointAvailability.label
          : "Click Create Safety Backup before risky work.",
      state: !hasProject
        ? "unavailable"
        : checkpointAvailability.restorable
          ? "done"
          : checkpointAvailability.hasPreviousRecord
            ? "ready"
            : "ready",
      hint: !hasProject
        ? "Click to select a project first"
        : checkpointAvailability.hasPreviousRecord &&
            !checkpointAvailability.restorable
          ? "Click to go to Safety and verify"
          : "Click to go to Safety",
    },
    {
      step: 4,
      label: "Run build/test checks if available",
      detail: !hasProject
        ? "Select a project first."
        : !summary
          ? "Summarize first so checks can be detected."
          : !hasRunnableChecks
            ? "No allowlisted checks available for this project."
            : safeChecks.lastResult
              ? `Last check: ${safeChecks.lastResult.scriptName} (${safeChecks.lastResult.status}).`
              : "Optional: run an allowlisted build/test check.",
      state: !hasProject || !summary
        ? "unavailable"
        : !hasRunnableChecks
          ? "unavailable"
          : safeChecks.lastResult
            ? "done"
            : "optional",
      hint: "Click to go to Safety (does not auto-run)",
    },
    {
      step: 5,
      label: "Scan changed files / patch review if needed",
      detail: !hasProject
        ? "Select a project first."
        : patchReviewPack
          ? "Patch Review Pack is ready."
          : changedFiles.lastScan
            ? `Last scan: ${changedFiles.lastScan.totalCount} changed file(s).`
            : "Optional after another tool edits code: Scan Changed Files (Git).",
      state: !hasProject
        ? "unavailable"
        : patchReviewPack
          ? "done"
          : changedFiles.lastScan
            ? "done"
            : "optional",
      hint: !hasProject
        ? "Click to select a project first"
        : "Click to scan changed files",
    },
    {
      step: 6,
      label: "Generate a copy-paste review report",
      detail: reviewPack
        ? "Review report is ready to copy."
        : "Builds a report for ChatGPT / Claude / Gemini / Grok.",
      state: reviewPack ? "done" : "ready",
      hint: !summary
        ? "Click to summarize first"
        : "Click to generate review report",
    },
    {
      step: 7,
      label: "Ask a local AI reviewer if configured",
      detail: advisorResponse
        ? "Local AI reviewer response is ready."
        : !providerReady
          ? "Configure and test the local AI reviewer first."
          : !summary && !reviewPack && !patchReviewPack
            ? "Need a summary, review report, or patch pack first."
            : "Optional: Ask Local AI Role (metadata-only).",
      state: advisorResponse
        ? "done"
        : !providerReady || (!summary && !reviewPack && !patchReviewPack)
          ? "unavailable"
          : "optional",
      hint: "Click to go to AI Review",
    },
    {
      step: 8,
      label: "Generate a Qwen inspect prompt if needed",
      detail: qwen.promptPack
        ? "Qwen inspect prompt is ready to copy."
        : "Optional: copy-paste prompt for a manual Qwen session. Live Qwen stays disabled.",
      state: qwen.promptPack ? "done" : "optional",
      hint: "Click to go to Qwen Inspect Prompt",
    },
    {
      step: 9,
      label: "Paste outside reviews into External Review",
      detail:
        externalReview.reviews.length > 0
          ? `${externalReview.reviews.length} saved · latest ${externalReview.reviews[0].source}.`
          : "Optional: paste advice from outside AIs (never executed).",
      state: externalReview.reviews.length > 0 ? "done" : "optional",
      hint: "Click to go to External Review",
    },
    {
      step: 10,
      label: "Generate Decision Report / Builder Prompt",
      detail: decision.builderPrompt
        ? "Plan-only Builder Prompt is ready to copy."
        : decision.decisionReport
          ? `Decision ready: ${decision.decisionReport.recommendedNextAction.label}`
          : "Optional: decide next action, then copy a plan-only Builder Prompt.",
      state: decision.builderPrompt || decision.decisionReport ? "done" : "optional",
      hint: "Click to open Decision Report",
    },
    {
      step: 11,
      label: "Generate a plan-only Builder Prompt",
      detail: decision.builderPrompt
        ? "Plan-only Builder Prompt is ready to copy."
        : "Optional: generate a plan-only Builder Prompt for Cursor / Codex / Grok / Claude.",
      state: decision.builderPrompt ? "done" : "optional",
      hint: "Click to go to Builder Prompt",
    },
    {
      step: 12,
      label: "Use Restore only if something went wrong",
      detail: checkpointAvailability.restorable
        ? "Restore Last Safety Backup is available if needed."
        : checkpointAvailability.hasPreviousRecord
          ? "Verify Safety Backup before restore."
          : "Create a safety backup first so restore is available later.",
      state: checkpointAvailability.restorable
        ? "optional"
        : checkpointAvailability.hasPreviousRecord
          ? "ready"
          : "unavailable",
      hint: checkpointAvailability.restorable
        ? "Click to go to Restore (does not auto-restore)"
        : checkpointAvailability.hasPreviousRecord
          ? "Click to go to Safety and verify first"
          : "Click to go to Restore (does not auto-restore)",
    },
  ];

  const backlogCriticalSafetyOpen = backlog.items.filter(
    (item) =>
      item.status === "Open" &&
      item.priority === "Critical" &&
      item.type === "Safety concern",
  ).length;

  const dailyNext = calculateDailyNextAction({
    project,
    summary,
    summaryIsFromHistory,
    checkpointAvailability,
    safeChecks,
    changedFilesScan: changedFiles.lastScan,
    patchReviewPack,
    reviewPack,
    externalReviews: externalReview.reviews,
    decisionReport: decision.decisionReport,
    builderPromptGeneratedAt: decision.builderPrompt?.generatedAt ?? null,
    builderResult: builderResult.saved,
    implementationReview: implementationReview.saved,
    backlogCriticalSafetyOpen,
    projectMemoryLastSaved: projectMemory.lastSaved,
    builderPlanGeneratedAt: builderPlan.saved?.generatedAt ?? null,
    builderPlanComparisonGeneratedAt:
      builderPlanComparison.saved?.generatedAt ?? null,
    codeContextPreview: codeContext.preview,
    codeContextAiResponse: codeContextAi.saved,
    patchDraftResponse: patchDraft.saved,
    patchDraftSafetyReview: patchDraftSafetyReview.saved,
    importedPatchDraft: importedPatchDraft.saved,
    externalPatchDraftComparison: externalPatchDraftComparison.saved,
    builderHandoffExport: builderHandoffExport.saved,
    planningStyle: planningStyle.style,
    userRequest: snapshot.userRequest,
    blueprintStatus: blueprint.status,
    safeScaffoldTargetSelected: Boolean(safeScaffoldTarget.selectedPath),
    safeScaffoldTargetStale: Boolean(safeScaffoldTarget.stale),
    safeScaffoldTargetStatus: safeScaffoldTarget.lastCheck?.status ?? null,
    safeScaffoldFileTreePreviewExists: Boolean(
      safeScaffoldFileTreePreview.saved &&
        !safeScaffoldFileTreePreview.saved.stale,
    ),
    safeScaffoldFileTreePreviewStale: Boolean(
      safeScaffoldFileTreePreview.saved?.stale,
    ),
    architectureHealthExists: Boolean(
      architectureHealth.saved && !architectureHealth.saved.stale,
    ),
    architectureHealthStale: Boolean(architectureHealth.saved?.stale),
    architectureHealthCriticalCount: architectureHealth.saved?.criticalCount ?? 0,
    architectureHealthRecommendation:
      architectureHealth.saved?.recommendation ?? null,
    architectureHealthMonolithInChangedFiles: Boolean(
      architectureHealth.saved &&
        !architectureHealth.saved.stale &&
        changedFiles.lastScan &&
        [...(changedFiles.lastScan.files.map((f) => f.path) ?? [])].some(
          (p) =>
            /(?:^|\/)App\.tsx$/i.test(p.replace(/\\/g, "/")) ||
            /(?:^|\/)main\/index\.ts$/i.test(p.replace(/\\/g, "/")),
        ),
    ),
    architectureRefactorTaskCardsExist: Boolean(
      architectureRefactorSaved && !architectureRefactorSaved.stale,
    ),
    architectureRefactorTaskCardsStale: Boolean(architectureRefactorSaved?.stale),
    architectureRefactorActiveTaskId: architectureRefactorSaved?.activeTaskId ?? null,
    architectureRefactorDraftedTaskId,
    architectureRefactorImplementationReturnedTaskId,
    architectureRefactorTaskBuilderHandoffExists: Boolean(
      architectureRefactorTaskBuilderHandoff.saved &&
        !architectureRefactorTaskBuilderHandoff.saved.stale,
    ),
    architectureRefactorTaskBuilderHandoffStale: Boolean(
      architectureRefactorTaskBuilderHandoff.saved?.stale,
    ),
    architectureRefactorTaskBuilderHandoffSelectedTaskId:
      architectureRefactorTaskBuilderHandoff.saved?.selectedTaskId ??
      architectureRefactorTaskBuilderHandoff.selectedTaskId ??
      null,
    architectureRefactorSentToBuilderTaskId,
    architectureRefactorImplementationReportCount,
    architectureRefactorPendingMarkImplementationReturned: Boolean(
      architectureRefactorPendingMarkReturnedReport,
    ),
    architectureRefactorImplementationReportTaskId:
      architectureRefactorPendingMarkReturnedReport?.taskId ?? null,
    architectureRefactorReviewedTaskId,
    architectureRefactorNextTaskId,
  });
  const recommendedLabel = dailyNext.title;
  const workflowGuidanceInput = {
    project,
    checkpointAvailability,
    codeContextPreview: codeContext.preview,
    codeContextAiResponse: codeContextAi.saved,
    patchDraftResponse: patchDraft.saved,
    importedPatchDraft: importedPatchDraft.saved,
    patchDraftSafetyReview: patchDraftSafetyReview.saved,
    externalPatchDraftComparison: externalPatchDraftComparison.saved,
    builderHandoffExport: builderHandoffExport.saved,
    projectMemoryLastSaved: projectMemory.lastSaved,
    backlogCriticalSafetyOpen,
    dailyNext,
    patchDraftLastFailureMessage: patchDraft.lastFailureMessage,
    blueprintStatus: blueprint.status,
    safeScaffoldTargetSelected: Boolean(safeScaffoldTarget.selectedPath),
    safeScaffoldTargetStale: Boolean(safeScaffoldTarget.stale),
    safeScaffoldTargetStatus: safeScaffoldTarget.lastCheck?.status ?? null,
    safeScaffoldFileTreePreviewExists: Boolean(
      safeScaffoldFileTreePreview.saved &&
        !safeScaffoldFileTreePreview.saved.stale,
    ),
    safeScaffoldFileTreePreviewStale: Boolean(
      safeScaffoldFileTreePreview.saved?.stale,
    ),
    architectureHealthExists: Boolean(
      architectureHealth.saved && !architectureHealth.saved.stale,
    ),
    architectureHealthStale: Boolean(architectureHealth.saved?.stale),
    architectureHealthCriticalCount: architectureHealth.saved?.criticalCount ?? 0,
    architectureHealthRecommendation:
      architectureHealth.saved?.recommendation ?? null,
    architectureHealthMonolithInChangedFiles: Boolean(
      architectureHealth.saved &&
        !architectureHealth.saved.stale &&
        changedFiles.lastScan &&
        changedFiles.lastScan.files.some(
          (f) =>
            /(?:^|\/)App\.tsx$/i.test(f.path.replace(/\\/g, "/")) ||
            /(?:^|\/)main\/index\.ts$/i.test(f.path.replace(/\\/g, "/")),
        ),
    ),
    architectureRefactorTaskCardsExist: Boolean(
      architectureRefactorSaved && !architectureRefactorSaved.stale,
    ),
    architectureRefactorTaskCardsStale: Boolean(architectureRefactorSaved?.stale),
    architectureRefactorActiveTaskId: architectureRefactorSaved?.activeTaskId ?? null,
    architectureRefactorDraftedTaskId,
    architectureRefactorImplementationReturnedTaskId,
    architectureRefactorTaskBuilderHandoffExists: Boolean(
      architectureRefactorTaskBuilderHandoff.saved &&
        !architectureRefactorTaskBuilderHandoff.saved.stale,
    ),
    architectureRefactorTaskBuilderHandoffStale: Boolean(
      architectureRefactorTaskBuilderHandoff.saved?.stale,
    ),
    architectureRefactorTaskBuilderHandoffSelectedTaskId:
      architectureRefactorTaskBuilderHandoff.saved?.selectedTaskId ??
      architectureRefactorTaskBuilderHandoff.selectedTaskId ??
      null,
    architectureRefactorTaskBuilderHandoffReadiness:
      architectureRefactorTaskBuilderHandoff.saved?.readiness ?? null,
    architectureRefactorSentToBuilderTaskId,
    architectureRefactorImplementationReportCount,
    architectureRefactorPendingMarkImplementationReturned: Boolean(
      architectureRefactorPendingMarkReturnedReport,
    ),
    architectureRefactorImplementationReportTaskId:
      architectureRefactorPendingMarkReturnedReport?.taskId ?? null,
    architectureRefactorReviewedTaskId,
    architectureRefactorNextTaskId,
  };
  const workflowProgress = buildWorkflowProgress(workflowGuidanceInput);
  const workflowHealth = buildWorkflowHealth(workflowGuidanceInput);
  const handoffReadiness = buildHandoffReadiness(workflowGuidanceInput);
  const workflowBlockedReasons = buildBlockedReasons(workflowGuidanceInput);
  const reportsUi = snapshot.reportsUi ?? emptyReportsUi;
  const isReportsPanelCollapsed = (panelId: WorkflowPanelId) =>
    defaultPanelCollapsed(
      panelId,
      workflowProgress,
      reportsUi.panelCollapse[panelId],
    );
  const prevDailyNextIdRef = useRef<string | null>(null);
  const prevActiveTabRef = useRef<AppTabId>("dashboard");

  const markTabs = useCallback(
    (ids: AppTabId[], level: TabAttentionLevel = "info") => {
      setTabAttention((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (id === activeTab) {
            delete next[id];
            continue;
          }
          const existing = next[id];
          const rank = { info: 1, warning: 2, danger: 3 } as const;
          const nextLevel =
            existing && rank[existing.level] > rank[level]
              ? existing.level
              : level;
          next[id] = { level: nextLevel, pulsing: true };
        }
        return next;
      });
      window.setTimeout(() => {
        setTabAttention((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            if (next[id]?.pulsing) {
              next[id] = { ...next[id]!, pulsing: false };
            }
          }
          return next;
        });
      }, 1200);
    },
    [activeTab],
  );

  const selectTab = useCallback((id: AppTabId) => {
    setActiveTab(id);
    setTabAttention((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const [workflowGuidance, setWorkflowGuidance] = useState<string | null>(null);

  const logUiAction = useCallback(
    async (
      level: "info" | "warning" | "blocked" | "success",
      message: string,
      detail?: string,
    ) => {
      if (!window.nttc) return;
      const next = await window.nttc.logUiAction(level, message, detail);
      applySnapshot(next);
    },
    [applySnapshot],
  );

  useEffect(() => {
    if (prevDailyNextIdRef.current === dailyNext.id) return;
    prevDailyNextIdRef.current = dailyNext.id;
    void logUiAction(
      "info",
      "Recommended action calculated",
      `${dailyNext.title} — ${dailyNext.reason}`,
    );
  }, [dailyNext.id, dailyNext.title, dailyNext.reason, logUiAction]);

  useEffect(() => {
    if (activeTab === "guide" && prevActiveTabRef.current !== "guide") {
      void logUiAction("info", "Quick Start Guide opened");
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, logUiAction]);

  const focusSection = useCallback((focusId: string) => {
    window.setTimeout(() => {
      const el = document.querySelector(
        `[data-focus-id="${focusId}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("focus-flash");
      // Force restart animation
      void el.offsetWidth;
      el.classList.add("focus-flash");
      const focusable = el.matches("button, [href], input, select, textarea")
        ? el
        : (el.querySelector(
            "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
          ) as HTMLElement | null);
      focusable?.focus({ preventScroll: true });
      window.setTimeout(() => el.classList.remove("focus-flash"), 1600);
    }, 80);
  }, []);

  const goToTabAndFocus = useCallback(
    (tab: AppTabId, focusId: string, guidance?: string) => {
      selectTab(tab);
      if (guidance) setWorkflowGuidance(guidance);
      window.setTimeout(() => focusSection(focusId), 160);
    },
    [selectTab, focusSection],
  );

  useEffect(() => {
    const signals = {
      projectPath: project?.normalizedPath ?? null,
      summaryAt: summary?.scannedAt ?? null,
      reviewPackAt: reviewPack?.generatedAt ?? null,
      patchPackAt: patchReviewPack?.generatedAt ?? null,
      decisionAt: decision.decisionReport?.generatedAt ?? null,
      builderPromptAt: decision.builderPrompt?.generatedAt ?? null,
      builderResultAt: builderResult.saved?.savedAt ?? null,
      advisorAt: advisorResponse?.createdAt ?? null,
      externalCount: externalReview.reviews.length,
      checkpointAt: latestCheckpoint?.createdAt ?? null,
      checkStatus: safeChecks.lastResult
        ? `${safeChecks.lastResult.scriptName}:${safeChecks.lastResult.status}`
        : null,
      backlogCount: backlog.items.length,
      backlogCriticalSafety: backlogCriticalSafetyOpen,
      qwenPackAt: qwen.promptPack?.generatedAt ?? null,
    };
    const prev = prevSignalsRef.current;
    prevSignalsRef.current = signals;
    if (!prev) return;

    if (signals.projectPath !== prev.projectPath) {
      markTabs(["dashboard", "project-setup"]);
    }
    if (signals.summaryAt !== prev.summaryAt && signals.summaryAt) {
      markTabs(["reports", "dashboard"]);
    }
    if (signals.reviewPackAt !== prev.reviewPackAt && signals.reviewPackAt) {
      markTabs(["reports"]);
    }
    if (signals.patchPackAt !== prev.patchPackAt && signals.patchPackAt) {
      markTabs(["reports"]);
    }
    if (signals.decisionAt !== prev.decisionAt && signals.decisionAt) {
      markTabs(["reports", "dashboard"]);
    }
    if (
      signals.builderPromptAt !== prev.builderPromptAt &&
      signals.builderPromptAt
    ) {
      markTabs(["reports"]);
    }
    if (
      signals.builderResultAt !== prev.builderResultAt &&
      signals.builderResultAt
    ) {
      markTabs(["request-output", "reports"]);
    }
    if (signals.advisorAt !== prev.advisorAt && signals.advisorAt) {
      markTabs(["request-output", "ai-review"]);
    }
    if (signals.externalCount !== prev.externalCount) {
      markTabs(["request-output", "reports"]);
    }
    if (signals.checkpointAt !== prev.checkpointAt && signals.checkpointAt) {
      markTabs(["safety", "dashboard"]);
    }
    if (signals.checkStatus !== prev.checkStatus && signals.checkStatus) {
      const failed = /fail|error|blocked/i.test(signals.checkStatus);
      markTabs(["safety"], failed ? "warning" : "info");
    }
    if (signals.qwenPackAt !== prev.qwenPackAt && signals.qwenPackAt) {
      markTabs(["ai-review"]);
    }
    if (signals.backlogCount !== prev.backlogCount) {
      markTabs(
        ["history-backlog", "dashboard"],
        signals.backlogCriticalSafety > prev.backlogCriticalSafety
          ? "danger"
          : "info",
      );
    } else if (signals.backlogCriticalSafety > prev.backlogCriticalSafety) {
      markTabs(["history-backlog", "dashboard"], "danger");
    }
  }, [
    project?.normalizedPath,
    summary?.scannedAt,
    reviewPack?.generatedAt,
    patchReviewPack?.generatedAt,
    decision.decisionReport?.generatedAt,
    decision.builderPrompt?.generatedAt,
    builderResult.saved?.savedAt,
    advisorResponse?.createdAt,
    externalReview.reviews.length,
    latestCheckpoint?.createdAt,
    safeChecks.lastResult,
    backlog.items.length,
    backlogCriticalSafetyOpen,
    qwen.promptPack?.generatedAt,
    markTabs,
  ]);

  async function handleSelectProject() {
    if (!window.nttc) return;
    setSummaryCopyState("idle");
    setPackCopyState("idle");
    setPatchCopyState("idle");
    setDecisionCopyState("idle");
    setBuilderCopyState("idle");
    const next = await window.nttc.selectProjectFolder();
    applySnapshot(next);
  }

  async function handleClearProject() {
    if (!window.nttc) return;
    setSummaryCopyState("idle");
    setPackCopyState("idle");
    setPatchCopyState("idle");
    setDecisionCopyState("idle");
    setBuilderCopyState("idle");
    const next = await window.nttc.clearProject();
    applySnapshot(next);
  }

  async function handleOpenRecentProject(projectPath: string) {
    if (!window.nttc) return;
    setSummaryCopyState("idle");
    setPackCopyState("idle");
    setPatchCopyState("idle");
    setDecisionCopyState("idle");
    setBuilderCopyState("idle");
    const next = await window.nttc.openRecentProject(projectPath);
    applySnapshot(next);
  }

  async function handleClearRecentProjects() {
    if (!window.nttc) return;
    const next = await window.nttc.clearRecentProjects();
    applySnapshot(next);
  }

  async function handleClearProjectHistory() {
    if (!window.nttc || !hasProject) return;
    const confirmed = window.confirm(
      "Clear saved history for this project from app data? This does not change your project files.",
    );
    if (!confirmed) return;
    const next = await window.nttc.clearProjectHistory();
    applySnapshot(next);
  }

  async function handleCopyHistorySummary() {
    const text = history.currentProjectHistory?.projectSummary?.markdownReport;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setSummaryCopyState("copied");
    } catch {
      setSummaryCopyState("failed");
    }
  }

  async function handleCopyHistoryReviewPack() {
    const text = history.currentProjectHistory?.reviewPack?.markdownReport;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setPackCopyState("copied");
    } catch {
      setPackCopyState("failed");
    }
  }

  async function handleCopyHistoryQwenPack() {
    const text = history.currentProjectHistory?.qwenPromptPack?.markdownReport;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setQwenPackCopyState("copied");
    } catch {
      setQwenPackCopyState("failed");
    }
  }

  async function handleCopyHistoryAdvisor() {
    const text = history.currentProjectHistory?.advisorResponse?.responseText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setAdvisorCopyState("copied");
    } catch {
      setAdvisorCopyState("failed");
    }
  }

  async function handleCopyHistoryExternal() {
    const hist = history.currentProjectHistory;
    const text =
      hist?.externalReviews?.[0]?.reviewText ??
      hist?.externalReview?.reviewText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setExternalCopyState("copied");
    } catch {
      setExternalCopyState("failed");
    }
  }

  async function handleSummarize() {
    if (!window.nttc || !hasProject || summarizing) return;
    setSummarizing(true);
    setSummaryCopyState("idle");
    try {
      const next = await window.nttc.summarizeProject();
      applySnapshot(next);
    } finally {
      setSummarizing(false);
    }
  }

  async function handleCopySummary() {
    if (!window.nttc || !summary) return;
    try {
      await navigator.clipboard.writeText(summary.markdownReport);
      setSummaryCopyState("copied");
      const next = await window.nttc.recordCopySummary();
      applySnapshot(next);
    } catch {
      setSummaryCopyState("failed");
    }
  }

  async function handleGenerateReviewPack() {
    if (!window.nttc || generatingPack) return;
    setGeneratingPack(true);
    setPackCopyState("idle");
    try {
      // Flush latest request text before generating.
      await window.nttc.setUserRequest(requestDraft);
      const next = await window.nttc.generateReviewPack();
      applySnapshot(next);
    } finally {
      setGeneratingPack(false);
    }
  }

  async function handleScanChangedFiles() {
    if (!window.nttc || !hasProject || scanningChangedFiles) return;
    setScanningChangedFiles(true);
    try {
      const next = await window.nttc.scanChangedFiles();
      applySnapshot(next);
    } finally {
      setScanningChangedFiles(false);
    }
  }

  async function handleGeneratePatchReviewPack() {
    if (!window.nttc || !hasProject || generatingPatchPack) return;
    setGeneratingPatchPack(true);
    setPatchCopyState("idle");
    try {
      await window.nttc.setUserRequest(requestDraft);
      const next = await window.nttc.generatePatchReviewPack();
      applySnapshot(next);
    } finally {
      setGeneratingPatchPack(false);
    }
  }

  async function handleCopyPatchReviewPack() {
    if (!window.nttc || !patchReviewPack) return;
    try {
      await navigator.clipboard.writeText(patchReviewPack.markdownReport);
      setPatchCopyState("copied");
      const next = await window.nttc.recordCopyPatchReviewPack();
      applySnapshot(next);
    } catch {
      setPatchCopyState("failed");
    }
  }

  async function handleGenerateDecisionReport() {
    if (!window.nttc || generatingDecision) return;
    setGeneratingDecision(true);
    setDecisionCopyState("idle");
    try {
      await window.nttc.setUserRequest(requestDraft);
      const next = await window.nttc.generateDecisionReport();
      applySnapshot(next);
    } finally {
      setGeneratingDecision(false);
    }
  }

  async function handleCopyDecisionReport() {
    if (!window.nttc || !decision.decisionReport) return;
    try {
      await navigator.clipboard.writeText(decision.decisionReport.markdownReport);
      setDecisionCopyState("copied");
      const next = await window.nttc.recordCopyDecisionReport();
      applySnapshot(next);
    } catch {
      setDecisionCopyState("failed");
    }
  }

  async function handleGenerateBuilderPrompt() {
    if (!window.nttc || generatingBuilder) return;
    setGeneratingBuilder(true);
    setBuilderCopyState("idle");
    try {
      await window.nttc.setUserRequest(requestDraft);
      const next = await window.nttc.generateBuilderPrompt();
      applySnapshot(next);
    } finally {
      setGeneratingBuilder(false);
    }
  }

  async function handleCopyBuilderPrompt() {
    if (!window.nttc || !decision.builderPrompt) return;
    try {
      await navigator.clipboard.writeText(decision.builderPrompt.markdownReport);
      setBuilderCopyState("copied");
      const next = await window.nttc.recordCopyBuilderPrompt();
      applySnapshot(next);
    } catch {
      setBuilderCopyState("failed");
    }
  }

  async function handleCopyReviewPack() {
    if (!window.nttc || !reviewPack) return;
    try {
      await navigator.clipboard.writeText(reviewPack.markdownReport);
      setPackCopyState("copied");
      const next = await window.nttc.recordCopyReviewPack();
      applySnapshot(next);
    } catch {
      setPackCopyState("failed");
    }
  }

  async function handleCreateCheckpoint() {
    if (!window.nttc || !hasProject || checkpointBusy) return;
    const next = await window.nttc.createCheckpoint();
    applySnapshot(next);
  }

  async function handleVerifyCheckpoint() {
    if (!window.nttc || !hasProject || checkpointBusy) return;
    const next = await window.nttc.verifyCheckpoint();
    applySnapshot(next);
  }

  async function handleUndoLastChange() {
    if (
      !window.nttc ||
      !checkpointAvailability.restorable ||
      !latestCheckpoint ||
      checkpointBusy
    ) {
      return;
    }
    const isGit = latestCheckpoint.method === "git-commit";
    const methodWarning = isGit
      ? "For Git backups this uses a hard reset and may delete untracked files (git reset --hard + git clean -fd).\n"
      : "For folder backups this replaces restorable project files with the snapshot and can remove newer files.\n";
    const confirmed = window.confirm(
      "Restore the selected project to the latest safety backup?\n\n" +
        "WARNING: This can overwrite or remove current project files.\n" +
        methodWarning +
        "An emergency snapshot will be created first when possible.\n\n" +
        "Only use this if something went wrong.\n" +
        "This does not contact AI and does not push to GitHub.",
    );
    if (!confirmed) {
      return;
    }
    const next = await window.nttc.undoLastCheckpoint();
    applySnapshot(next);
  }

  async function handleTestProvider() {
    if (!window.nttc || testingProvider) return;
    setTestingProvider(true);
    try {
      await window.nttc.updateProviderSettings({
        baseUrl: baseUrlDraft,
        modelName: modelDraft,
      });
      const next = await window.nttc.testProviderConnection();
      applySnapshot(next);
    } finally {
      setTestingProvider(false);
    }
  }

  async function handleCheckOllamaStatus() {
    if (!window.nttc || snapshot.ollamaStatus?.busy) return;
    const next = await window.nttc.checkOllamaStatus();
    applySnapshot(next);
  }

  async function handleRefreshInstalledModels() {
    if (!window.nttc || refreshingModels) return;
    setRefreshingModels(true);
    try {
      await window.nttc.updateProviderSettings({
        baseUrl: baseUrlDraft,
        modelName: modelDraft,
      });
      const next = await window.nttc.refreshInstalledModels();
      applySnapshot(next);
    } finally {
      setRefreshingModels(false);
    }
  }

  async function handleSuggestRoleModelDefaults() {
    if (!window.nttc) return;
    const next = await window.nttc.suggestRoleModelDefaults();
    applySnapshot(next);
  }

  async function handleSetPlanningStyle(style: PlanningStyleId) {
    if (!window.nttc) return;
    const next = await window.nttc.setPlanningStyle(style);
    applySnapshot(next);
  }

  async function handleSetReportsPanelCollapsed(
    panelId: string,
    collapsed: boolean,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setReportsPanelCollapsed(panelId, collapsed);
    applySnapshot(next);
  }

  async function handleCopyQuickStartGuide() {
    try {
      await navigator.clipboard.writeText(buildQuickStartGuideMarkdown());
      setGuideCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.logUiAction(
          "info",
          "Quick Start Guide copied",
        );
        applySnapshot(next);
      }
    } catch {
      setGuideCopyState("failed");
    }
  }

  function handleOpenQuickStartGuide() {
    selectTab("guide");
  }

  async function handleBlueprintIntakeChange(
    patch: Partial<BlueprintState["intake"]>,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setBlueprintIntake(patch);
    applySnapshot(next);
  }

  async function handleGenerateBlueprintPlannerQuestions() {
    if (!window.nttc) return;
    const next = await window.nttc.generateBlueprintPlannerQuestions();
    applySnapshot(next);
  }

  async function handleCopyBlueprintPlannerQuestions() {
    if (!blueprint.plannerQuestions?.markdown) return;
    try {
      await navigator.clipboard.writeText(blueprint.plannerQuestions.markdown);
      setBlueprintQuestionsCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyBlueprintPlannerQuestions();
        applySnapshot(next);
      }
    } catch {
      setBlueprintQuestionsCopyState("failed");
    }
  }

  async function handleGenerateBlueprintPlannerPrompt() {
    if (!window.nttc) return;
    const next = await window.nttc.generateBlueprintPlannerPrompt();
    applySnapshot(next);
  }

  async function handleCopyBlueprintPlannerPrompt() {
    if (!blueprint.plannerPrompt?.markdown) return;
    try {
      await navigator.clipboard.writeText(blueprint.plannerPrompt.markdown);
      setBlueprintPromptCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyBlueprintPlannerPrompt();
        applySnapshot(next);
      }
    } catch {
      setBlueprintPromptCopyState("failed");
    }
  }

  async function handleAskLocalPlannerAi() {
    if (!window.nttc) return;
    if (!blueprint.status.ideaExists || blueprint.plannerAi.busy) return;

    const questionsWarning = !blueprint.plannerQuestions
      ? "\n\nNote: planner questions were not generated yet. Generating them first is recommended."
      : "";

    const confirmed = window.confirm(
      "This will send only your Blueprint idea fields, generated planner questions, and clarification answers to your local Ollama model.\n\n" +
        "It will not read project source files.\n" +
        "It will not send Code Context Pack.\n" +
        "It will not write source code.\n" +
        "It will not scaffold app files.\n" +
        "It will not install packages.\n" +
        "It will not run commands.\n" +
        "It will not save planning documents automatically.\n\n" +
        "Continue?" +
        questionsWarning,
    );
    if (!confirmed) {
      await logUiAction("info", "Local Planner AI cancelled", "User cancelled confirmation.");
      return;
    }
    await logUiAction(
      "info",
      "Local Planner AI confirmation shown",
      "User confirmed Local Planner AI request.",
    );
    setBlueprintLocalPlannerCopyState("idle");
    const next = await window.nttc.askLocalPlannerAi();
    applySnapshot(next);
  }

  async function handleCopyBlueprintPlannerAiDraft() {
    if (!blueprint.plannerAi.saved?.responseText) return;
    try {
      await navigator.clipboard.writeText(blueprint.plannerAi.saved.responseText);
      setBlueprintLocalPlannerCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyBlueprintPlannerAiDraft();
        applySnapshot(next);
      }
    } catch {
      setBlueprintLocalPlannerCopyState("failed");
    }
  }

  async function handleSaveBlueprintPlannerDraftAsImported() {
    if (!window.nttc || !blueprint.plannerAi.saved) return;
    const next = await window.nttc.saveBlueprintPlannerDraftAsImported();
    applySnapshot(next);
  }

  async function handleBlueprintDraftSourceChange(
    source: import("../shared/blueprintConstants").BlueprintSource,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setBlueprintDraftSource(source);
    applySnapshot(next);
  }

  async function handleBlueprintDraftTextChange(text: string) {
    if (!window.nttc) return;
    const next = await window.nttc.setBlueprintDraftText(text);
    applySnapshot(next);
  }

  async function handleSaveImportedBlueprint() {
    if (!window.nttc) return;
    const next = await window.nttc.saveImportedBlueprint();
    applySnapshot(next);
  }

  async function handleClearImportedBlueprint() {
    if (!window.nttc) return;
    const next = await window.nttc.clearImportedBlueprint();
    applySnapshot(next);
  }

  async function handleCopyImportedBlueprint() {
    if (!blueprint.importedBlueprint?.blueprintText) return;
    try {
      await navigator.clipboard.writeText(
        blueprint.importedBlueprint.blueprintText,
      );
      setBlueprintImportedCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyImportedBlueprint();
        applySnapshot(next);
      }
    } catch {
      setBlueprintImportedCopyState("failed");
    }
  }

  async function handleCheckBlueprintCompleteness() {
    if (!window.nttc) return;
    const next = await window.nttc.checkBlueprintCompleteness();
    applySnapshot(next);
  }

  async function handlePreviewBlueprintPlanningDocuments() {
    if (!window.nttc) return;
    const next = await window.nttc.previewBlueprintPlanningDocuments();
    applySnapshot(next);
  }

  async function handleSaveBlueprintPlanningDocuments(confirmOverwrite: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.saveBlueprintPlanningDocuments(
      confirmOverwrite,
    );
    applySnapshot(next);
  }

  async function handleGenerateBlueprintPhase1Handoff() {
    if (!window.nttc) return;
    const next = await window.nttc.generateBlueprintPhase1Handoff();
    applySnapshot(next);
  }

  async function handleCopyBlueprintPhase1Handoff() {
    if (!blueprint.phase1Handoff?.markdown) return;
    try {
      await navigator.clipboard.writeText(blueprint.phase1Handoff.markdown);
      setBlueprintPhase1CopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyBlueprintPhase1Handoff();
        applySnapshot(next);
      }
    } catch {
      setBlueprintPhase1CopyState("failed");
    }
  }

  async function handleGenerateBlueprintPhaseTaskCards() {
    if (!window.nttc) return;
    const next = await window.nttc.generateBlueprintPhaseTaskCards();
    applySnapshot(next);
  }

  async function handleClearBlueprintPhaseTaskCards() {
    if (!window.nttc) return;
    const next = await window.nttc.clearBlueprintPhaseTaskCards();
    applySnapshot(next);
  }

  async function handleCopyAllBlueprintPhaseTaskCards() {
    const markdown = blueprint.phaseTaskCards.saved?.allCardsMarkdown;
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setBlueprintPhaseTaskCardsCopyAllState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyAllBlueprintPhaseTaskCards();
        applySnapshot(next);
      }
    } catch {
      setBlueprintPhaseTaskCardsCopyAllState("failed");
    }
  }

  async function handleCopyBlueprintPhaseTaskCard(taskId: string) {
    const card = blueprint.phaseTaskCards.saved?.cards.find(
      (c) => c.id === taskId,
    );
    if (!card?.markdown) return;
    try {
      await navigator.clipboard.writeText(card.markdown);
      setBlueprintPhaseTaskCardCopyState((prev) => ({
        ...prev,
        [taskId]: "copied",
      }));
      if (window.nttc) {
        const next = await window.nttc.recordCopyBlueprintPhaseTaskCard(taskId);
        applySnapshot(next);
      }
    } catch {
      setBlueprintPhaseTaskCardCopyState((prev) => ({
        ...prev,
        [taskId]: "failed",
      }));
    }
  }

  async function handleSetBlueprintPhaseTaskCardStatus(
    taskId: string,
    status: import("../shared/blueprintTaskCardConstants").BlueprintPhaseTaskCardStatus,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setBlueprintPhaseTaskCardStatus(
      taskId,
      status,
    );
    applySnapshot(next);
  }

  async function handleResetBlueprintPhaseTaskCardStatus(taskId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.resetBlueprintPhaseTaskCardStatus(taskId);
    applySnapshot(next);
  }

  async function handleSetActiveBlueprintPhaseTaskCard(taskId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.setBlueprintActivePhaseTaskCard(taskId);
    applySnapshot(next);
  }

  async function handleTaskHandoffSelectedTaskChange(taskId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.setTaskCardBuilderHandoffSelectedTask(taskId);
    applySnapshot(next);
  }

  async function handleTaskHandoffTargetChange(
    target: import("../shared/types").BuilderHandoffTarget,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setTaskCardBuilderHandoffTarget(target);
    applySnapshot(next);
  }

  async function handleTaskHandoffStrictnessChange(
    strictness: import("../shared/types").BuilderHandoffStrictness,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setTaskCardBuilderHandoffStrictness(strictness);
    applySnapshot(next);
  }

  async function handleGenerateTaskCardBuilderHandoff() {
    if (!window.nttc) return;
    const next = await window.nttc.generateTaskCardBuilderHandoff();
    applySnapshot(next);
  }

  async function handleCopyTaskCardBuilderHandoff() {
    const markdown = blueprint.taskCardBuilderHandoff.saved?.markdown;
    if (!markdown || blueprint.taskCardBuilderHandoff.saved?.stale) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setTaskBuilderHandoffCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyTaskCardBuilderHandoff();
        applySnapshot(next);
      }
    } catch {
      setTaskBuilderHandoffCopyState("failed");
    }
  }

  async function handleClearTaskCardBuilderHandoff() {
    if (!window.nttc) return;
    const next = await window.nttc.clearTaskCardBuilderHandoff();
    applySnapshot(next);
  }

  async function handleTaskImplSelectedTaskChange(taskId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.setTaskImplementationIntakeSelectedTask(taskId);
    applySnapshot(next);
  }

  async function handleTaskImplBuilderSourceChange(
    source: import("../shared/taskImplementationIntakeConstants").TaskImplementationBuilderSource,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setTaskImplementationIntakeBuilderSource(source);
    applySnapshot(next);
  }

  function handleTaskImplDraftChange(text: string) {
    setTaskImplementationIntakeDraft(text);
  }

  async function handleSaveTaskImplementationReport() {
    if (!window.nttc || !taskImplementationIntakeDraft.trim()) return;
    const scan = parseTaskImplementationReportText(taskImplementationIntakeDraft.trim());
    let allowSecretOverride = false;
    if (scan.blockedBySecrets) {
      const confirmed = window.confirm(
        "Possible secret-like content was detected in the pasted report. NTTC will not send this text to AI automatically. Save anyway only if you have removed actual secret values. Continue saving?",
      );
      if (!confirmed) return;
      allowSecretOverride = true;
    }
    setTaskImplementationIntakeCopyState("idle");
    skipNextTaskImplDraftSync.current = true;
    await window.nttc.setTaskImplementationIntakeDraftText(taskImplementationIntakeDraft);
    const next = await window.nttc.saveTaskImplementationReport(allowSecretOverride);
    applySnapshot(next);
    setTaskImplementationIntakeDraft("");
    markTabs(["blueprint"], scan.missingExpectedSections.length > 0 ? "warning" : "info");
  }

  async function handleCopyTaskImplementationReport() {
    const report = blueprint.taskImplementationIntake.selectedReport;
    if (!report || report.stale) return;
    try {
      await navigator.clipboard.writeText(report.reportText);
      setTaskImplementationIntakeCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyTaskImplementationReport();
        applySnapshot(next);
      }
    } catch {
      setTaskImplementationIntakeCopyState("failed");
    }
  }

  async function handleClearTaskImplementationReport() {
    if (!window.nttc) return;
    setTaskImplementationIntakeCopyState("idle");
    skipNextTaskImplDraftSync.current = true;
    setTaskImplementationIntakeDraft("");
    const next = await window.nttc.clearTaskImplementationReport();
    applySnapshot(next);
  }

  async function handleMarkTaskImplementationReturned() {
    if (!window.nttc) return;
    const next = await window.nttc.markTaskImplementationReturned();
    applySnapshot(next);
  }

  async function handleMarkTaskReviewed() {
    if (!window.nttc) return;
    if (!blueprint.taskImplementationIntake.hasImplementationReview) {
      const confirmed = window.confirm(
        "No Implementation Review found. Mark reviewed anyway?",
      );
      if (!confirmed) return;
      const next = await window.nttc.markTaskImplementationReviewed(true);
      applySnapshot(next);
      return;
    }
    const next = await window.nttc.markTaskImplementationReviewed(false);
    applySnapshot(next);
  }

  async function handleStageTaskImplementationReportForReview() {
    if (!window.nttc) return;
    const next = await window.nttc.stageTaskImplementationReportForReview();
    applySnapshot(next);
    markTabs(["reports"], "info");
  }

  async function handleGenerateBlueprintTaskReconciliation() {
    if (!window.nttc) return;
    setTaskReconciliationCopyState("idle");
    const next = await window.nttc.generateBlueprintTaskReconciliation();
    applySnapshot(next);
    markTabs(["blueprint"], "info");
  }

  async function handleCopyBlueprintTaskReconciliation() {
    const report = blueprint.taskReconciliation.saved;
    if (!report || report.stale) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setTaskReconciliationCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyBlueprintTaskReconciliation();
        applySnapshot(next);
      }
    } catch {
      setTaskReconciliationCopyState("failed");
    }
  }

  async function handleClearBlueprintTaskReconciliation() {
    if (!window.nttc) return;
    setTaskReconciliationCopyState("idle");
    const next = await window.nttc.clearBlueprintTaskReconciliation();
    applySnapshot(next);
  }

  async function handleGenerateTaskArtifactIndex() {
    if (!window.nttc) return;
    setTaskArtifactIndexCopyState("idle");
    const next = await window.nttc.generateTaskArtifactIndex();
    applySnapshot(next);
    markTabs(["blueprint"], "info");
  }

  async function handleCopyTaskArtifactIndex() {
    const index = blueprint.taskArtifactIndex.saved;
    if (!index || index.stale) return;
    try {
      await navigator.clipboard.writeText(index.markdown);
      setTaskArtifactIndexCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyTaskArtifactIndex();
        applySnapshot(next);
      }
    } catch {
      setTaskArtifactIndexCopyState("failed");
    }
  }

  async function handleClearTaskArtifactIndex() {
    if (!window.nttc) return;
    setTaskArtifactIndexCopyState("idle");
    const next = await window.nttc.clearTaskArtifactIndex();
    applySnapshot(next);
  }

  async function handleTaskArtifactIndexFilterChange(taskId: string | null) {
    if (!window.nttc) return;
    const next = await window.nttc.setTaskArtifactIndexFilter(taskId);
    applySnapshot(next);
  }

  async function handleChangedFilesTaskLinkSelect(taskId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.setChangedFilesTaskLinkSelectedTask(taskId);
    applySnapshot(next);
  }

  async function handleLinkChangedFilesToTask() {
    if (!window.nttc) return;
    const next = await window.nttc.linkChangedFilesToTask();
    applySnapshot(next);
    markTabs(["reports"], "info");
  }

  async function handleClearChangedFilesTaskLink() {
    if (!window.nttc) return;
    const next = await window.nttc.clearChangedFilesTaskLink();
    applySnapshot(next);
  }

  async function handleGenerateArchitectureHealthReport() {
    if (!window.nttc) return;
    setArchitectureHealthCopyState("idle");
    const next = await window.nttc.generateArchitectureHealthReport();
    applySnapshot(next);
    markTabs(["reports"], "info");
  }

  async function handleCopyArchitectureHealthReport() {
    const report = architectureHealth.saved;
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setArchitectureHealthCopyState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyArchitectureHealthReport();
        applySnapshot(next);
      }
    } catch {
      setArchitectureHealthCopyState("failed");
    }
  }

  async function handleClearArchitectureHealthReport() {
    if (!window.nttc) return;
    setArchitectureHealthCopyState("idle");
    const next = await window.nttc.clearArchitectureHealthReport();
    applySnapshot(next);
  }

  async function handleArchitectureHealthIncludeTestFiles(include: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.setArchitectureHealthIncludeTestFiles(include);
    applySnapshot(next);
  }

  async function handleArchitectureHealthIncludeMarkdownDocs(include: boolean) {
    if (!window.nttc) return;
    const next =
      await window.nttc.setArchitectureHealthIncludeMarkdownDocs(include);
    applySnapshot(next);
  }

  async function handleGenerateArchitectureRefactorTaskCards() {
    if (!window.nttc) return;
    setArchitectureRefactorCopyAllState("idle");
    setArchitectureRefactorCopyTaskState({});
    const next = await window.nttc.generateArchitectureRefactorTaskCards();
    applySnapshot(next);
    markTabs(["reports"], "info");
  }

  async function handleCopyArchitectureRefactorTaskCard(taskId: string) {
    const card = architectureRefactorSaved?.cards.find((c) => c.id === taskId);
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.markdown);
      setArchitectureRefactorCopyTaskState((prev) => ({
        ...prev,
        [taskId]: "copied",
      }));
      if (window.nttc) {
        const next = await window.nttc.recordCopyArchitectureRefactorTaskCard(taskId);
        applySnapshot(next);
      }
    } catch {
      setArchitectureRefactorCopyTaskState((prev) => ({
        ...prev,
        [taskId]: "failed",
      }));
    }
  }

  async function handleCopyAllArchitectureRefactorTaskCards() {
    const markdown = architectureRefactorSaved?.allCardsMarkdown;
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setArchitectureRefactorCopyAllState("copied");
      if (window.nttc) {
        const next = await window.nttc.recordCopyAllArchitectureRefactorTaskCards();
        applySnapshot(next);
      }
    } catch {
      setArchitectureRefactorCopyAllState("failed");
    }
  }

  async function handleClearArchitectureRefactorTaskCards() {
    if (!window.nttc) return;
    setArchitectureRefactorCopyAllState("idle");
    setArchitectureRefactorCopyTaskState({});
    const next = await window.nttc.clearArchitectureRefactorTaskCards();
    applySnapshot(next);
  }

  async function handleArchitectureRefactorTaskStatus(
    taskId: string,
    status: import("../shared/architectureRefactorTasks/architectureRefactorTaskConstants").ArchitectureRefactorTaskCardStatus,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setArchitectureRefactorTaskCardStatus(
      taskId,
      status,
    );
    applySnapshot(next);
  }

  async function handleResetArchitectureRefactorTaskStatus(taskId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.resetArchitectureRefactorTaskCardStatus(taskId);
    applySnapshot(next);
  }

  async function handleArchitectureRefactorHandoffSelectedTask(taskId: string) {
    if (!window.nttc) return;
    const next =
      await window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask(taskId);
    applySnapshot(next);
  }

  async function handleArchitectureRefactorHandoffTarget(
    target: import("../shared/types").BuilderHandoffTarget,
  ) {
    if (!window.nttc) return;
    const next =
      await window.nttc.setArchitectureRefactorTaskBuilderHandoffTarget(target);
    applySnapshot(next);
  }

  async function handleArchitectureRefactorHandoffStrictness(
    strictness: import("../shared/types").BuilderHandoffStrictness,
  ) {
    if (!window.nttc) return;
    const next =
      await window.nttc.setArchitectureRefactorTaskBuilderHandoffStrictness(
        strictness,
      );
    applySnapshot(next);
  }

  async function handleGenerateArchitectureRefactorTaskBuilderHandoff() {
    if (!window.nttc) return;
    setArchitectureRefactorHandoffCopyState("idle");
    const next = await window.nttc.generateArchitectureRefactorTaskBuilderHandoff();
    applySnapshot(next);
  }

  async function handleCopyArchitectureRefactorTaskBuilderHandoff() {
    const markdown = architectureRefactorTaskBuilderHandoff.saved?.markdown;
    if (!markdown || architectureRefactorTaskBuilderHandoff.saved?.stale) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setArchitectureRefactorHandoffCopyState("copied");
      if (window.nttc) {
        const next =
          await window.nttc.recordCopyArchitectureRefactorTaskBuilderHandoff();
        applySnapshot(next);
      }
    } catch {
      setArchitectureRefactorHandoffCopyState("failed");
    }
  }

  async function handleClearArchitectureRefactorTaskBuilderHandoff() {
    if (!window.nttc) return;
    setArchitectureRefactorHandoffCopyState("idle");
    const next = await window.nttc.clearArchitectureRefactorTaskBuilderHandoff();
    applySnapshot(next);
  }

  async function handleArchitectureRefactorImplSelectedTaskChange(taskId: string) {
    if (!window.nttc) return;
    const next =
      await window.nttc.setArchitectureRefactorTaskImplementationIntakeSelectedTask(
        taskId,
      );
    applySnapshot(next);
  }

  async function handleArchitectureRefactorImplBuilderSourceChange(
    source: import("../shared/architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants").ArchitectureRefactorImplementationBuilderSource,
  ) {
    if (!window.nttc) return;
    const next =
      await window.nttc.setArchitectureRefactorTaskImplementationIntakeBuilderSource(
        source,
      );
    applySnapshot(next);
  }

  function handleArchitectureRefactorImplDraftChange(text: string) {
    setArchitectureRefactorImplIntakeDraft(text);
  }

  async function handleSaveArchitectureRefactorImplementationReport() {
    if (!window.nttc || !architectureRefactorImplIntakeDraft.trim()) return;
    const scan = parseArchitectureRefactorTaskImplementationReportText(
      architectureRefactorImplIntakeDraft.trim(),
    );
    let allowSecretOverride = false;
    if (scan.blockedBySecrets) {
      const confirmed = window.confirm(
        "Possible secret-like content was detected in the pasted refactor report. NTTC will not send this text to AI automatically. Save anyway only if you have removed actual secret values. Continue saving?",
      );
      if (!confirmed) return;
      allowSecretOverride = true;
    }
    setArchitectureRefactorImplIntakeCopyState("idle");
    skipNextRefactorImplDraftSync.current = true;
    await window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(
      architectureRefactorImplIntakeDraft,
    );
    const next = await window.nttc.saveArchitectureRefactorTaskImplementationReport(
      allowSecretOverride,
    );
    applySnapshot(next);
    setArchitectureRefactorImplIntakeDraft("");
    markTabs(
      ["reports"],
      scan.missingExpectedSections.length > 0 || scan.behaviorChangeWarning
        ? "warning"
        : "info",
    );
  }

  async function handleCopyArchitectureRefactorImplementationReport() {
    const report = architectureRefactorTaskImplementationIntake.selectedReport;
    if (!report || report.stale) return;
    try {
      await navigator.clipboard.writeText(report.reportText);
      setArchitectureRefactorImplIntakeCopyState("copied");
      if (window.nttc) {
        const next =
          await window.nttc.recordCopyArchitectureRefactorTaskImplementationReport();
        applySnapshot(next);
      }
    } catch {
      setArchitectureRefactorImplIntakeCopyState("failed");
    }
  }

  async function handleClearArchitectureRefactorImplementationReport() {
    if (!window.nttc) return;
    setArchitectureRefactorImplIntakeCopyState("idle");
    skipNextRefactorImplDraftSync.current = true;
    setArchitectureRefactorImplIntakeDraft("");
    const next = await window.nttc.clearArchitectureRefactorTaskImplementationReport();
    applySnapshot(next);
  }

  async function handleMarkArchitectureRefactorImplementationReturned() {
    if (!window.nttc) return;
    const next = await window.nttc.markArchitectureRefactorTaskImplementationReturned();
    applySnapshot(next);
  }

  async function handleMarkArchitectureRefactorReviewed() {
    if (!window.nttc) return;
    if (!architectureRefactorTaskImplementationIntake.hasImplementationReview) {
      const confirmed = window.confirm(
        "No Implementation Review found. Mark reviewed anyway?",
      );
      if (!confirmed) return;
      const next =
        await window.nttc.markArchitectureRefactorTaskImplementationReviewed(true);
      applySnapshot(next);
      return;
    }
    const next = await window.nttc.markArchitectureRefactorTaskImplementationReviewed(false);
    applySnapshot(next);
  }

  async function handleStageArchitectureRefactorReportForReview() {
    if (!window.nttc) return;
    const next =
      await window.nttc.stageArchitectureRefactorTaskImplementationReportForReview();
    applySnapshot(next);
  }

  async function handleBlueprintPreviewFileSelect(fileName: string) {
    if (!window.nttc) return;
    const next = await window.nttc.setBlueprintPreviewFile(fileName);
    applySnapshot(next);
  }

  async function handleRoleModelMappingChange(
    roleKey: RoleModelMappingKey,
    modelName: string,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setRoleModelMapping(roleKey, modelName);
    applySnapshot(next);
  }

  async function handleAskLocalAi() {
    if (!window.nttc || !canAskLocalAi) return;
    setAdvisorCopyState("idle");
    await window.nttc.setUserRequest(requestDraft);
    const next = await window.nttc.askLocalAi();
    applySnapshot(next);
  }

  async function handleLocalAiRoleChange(role: LocalAiRoleId) {
    if (!window.nttc) return;
    const next = await window.nttc.setLocalAiRole(role);
    applySnapshot(next);
  }

  async function handleCopyAdvisorResponse() {
    if (!window.nttc || !advisorResponse) return;
    try {
      await navigator.clipboard.writeText(advisorResponse.responseText);
      setAdvisorCopyState("copied");
      const next = await window.nttc.recordCopyAdvisorResponse();
      applySnapshot(next);
    } catch {
      setAdvisorCopyState("failed");
    }
  }

  async function handleBuilderPlanIncludeExternal(include: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.setBuilderPlanIncludeExternal(include);
    applySnapshot(next);
  }

  async function handleBuilderPlanIncludeBuilderResult(include: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.setBuilderPlanIncludeBuilderResult(include);
    applySnapshot(next);
  }

  async function handleGenerateBuilderPlan() {
    if (!window.nttc || !canGenerateBuilderPlan) return;
    setBuilderPlanCopyState("idle");
    await window.nttc.setUserRequest(requestDraft);
    const next = await window.nttc.generateBuilderPlan();
    applySnapshot(next);
    markTabs(["ai-review", "reports"], "info");
  }

  async function handleCopyBuilderPlan() {
    if (!window.nttc || !builderPlan.saved) return;
    try {
      await navigator.clipboard.writeText(builderPlan.saved.planText);
      setBuilderPlanCopyState("copied");
      const next = await window.nttc.recordCopyBuilderPlan();
      applySnapshot(next);
    } catch {
      setBuilderPlanCopyState("failed");
    }
  }

  async function handleSpeakerRoleChange(role: SpeakerScriptRole) {
    if (!window.nttc) return;
    const next = await window.nttc.setSpeakerScriptRole(role);
    applySnapshot(next);
  }

  async function handleSpeakerToneChange(tone: SpeakerScriptTone) {
    if (!window.nttc) return;
    const next = await window.nttc.setSpeakerScriptTone(tone);
    applySnapshot(next);
  }

  async function handleGenerateSpeakerScript() {
    if (!window.nttc || generatingSpeaker) return;
    setGeneratingSpeaker(true);
    setSpeakerCopyState("idle");
    try {
      const next = await window.nttc.generateSpeakerScript();
      applySnapshot(next);
      markTabs(["ai-review", "reports"], "info");
    } finally {
      setGeneratingSpeaker(false);
    }
  }

  async function handleCopySpeakerScript() {
    if (!window.nttc || !speakerScript.saved) return;
    try {
      await navigator.clipboard.writeText(speakerScript.saved.markdownReport);
      setSpeakerCopyState("copied");
      const next = await window.nttc.recordCopySpeakerScript();
      applySnapshot(next);
    } catch {
      setSpeakerCopyState("failed");
    }
  }

  async function handleGenerateProjectMemoryPreview() {
    if (!window.nttc || generatingProjectMemory) return;
    setGeneratingProjectMemory(true);
    setProjectMemoryCopyBundleState("idle");
    setProjectMemoryCopyActiveState("idle");
    try {
      const next = await window.nttc.generateProjectMemoryPreview();
      applySnapshot(next);
      markTabs(["reports", "project-setup"], "info");
    } finally {
      setGeneratingProjectMemory(false);
    }
  }

  function handleOpenProjectMemorySaveDialog() {
    const mode =
      projectMemory.pendingOverwriteFiles.length > 0 ? "overwrite" : "first";
    setProjectMemorySaveDialogMode(mode);
    setProjectMemorySaveDialogOpen(true);
  }

  async function handleConfirmProjectMemorySave() {
    if (!window.nttc) return;
    setProjectMemorySaveDialogOpen(false);
    const confirmOverwrite = projectMemorySaveDialogMode === "overwrite";
    const next = await window.nttc.saveProjectMemoryFiles(confirmOverwrite);
    applySnapshot(next);
  }

  async function handleCopyProjectMemoryBundle() {
    if (!window.nttc || !projectMemory.preview?.bundleMarkdown) return;
    try {
      await navigator.clipboard.writeText(projectMemory.preview.bundleMarkdown);
      setProjectMemoryCopyBundleState("copied");
      const next = await window.nttc.recordCopyProjectMemoryBundle();
      applySnapshot(next);
    } catch {
      setProjectMemoryCopyBundleState("failed");
    }
  }

  async function handleCopyProjectMemoryActiveFile() {
    const file = projectMemory.preview?.files.find(
      (item) => item.fileName === projectMemoryActiveFile,
    );
    if (!file?.content) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setProjectMemoryCopyActiveState("copied");
    } catch {
      setProjectMemoryCopyActiveState("failed");
    }
  }

  function handleCodeContextFilterChange(value: string) {
    setCodeContextFilterDraft(value);
    if (codeContextFilterTimer.current) clearTimeout(codeContextFilterTimer.current);
    codeContextFilterTimer.current = setTimeout(() => {
      void window.nttc?.setCodeContextFilter(value).then(applySnapshot);
    }, 300);
  }

  function handleCodeContextQuestionChange(value: string) {
    setCodeContextQuestionDraft(value);
    if (codeContextQuestionTimer.current) clearTimeout(codeContextQuestionTimer.current);
    codeContextQuestionTimer.current = setTimeout(() => {
      void window.nttc?.setCodeContextQuestion(value).then(applySnapshot);
    }, 400);
  }

  async function handleApplyCodeQuestionTemplate(
    templateId: string,
    mode?: "append" | "replace",
  ) {
    if (!window.nttc) return;
    let applyMode = mode;
    if (!applyMode && codeContextQuestionDraft.trim()) {
      const append = window.confirm(
        "Append this template below your current Code Question?\n\nOK = Append\nCancel = Replace",
      );
      applyMode = append ? "append" : "replace";
    }
    const next = await window.nttc.applyCodeQuestionTemplate(
      templateId,
      applyMode ?? "replace",
    );
    applySnapshot(next);
    setCodeContextQuestionDraft(next.codeContext?.codeQuestion ?? "");
  }

  async function handleClearCodeContextQuestion() {
    if (!window.nttc) return;
    const next = await window.nttc.clearCodeContextQuestion();
    applySnapshot(next);
    setCodeContextQuestionDraft("");
  }

  async function handleRefreshCodeContextFileList() {
    if (!window.nttc || refreshingCodeContext) return;
    setRefreshingCodeContext(true);
    try {
      const next = await window.nttc.refreshCodeContextFileList();
      applySnapshot(next);
    } finally {
      setRefreshingCodeContext(false);
    }
  }

  async function handleGenerateCodeContextPreview() {
    if (!window.nttc || generatingCodeContext) return;
    setGeneratingCodeContext(true);
    setCodeContextCopyState("idle");
    try {
      const next = await window.nttc.generateCodeContextPreview();
      applySnapshot(next);
      markTabs(["reports", "ai-review"], "info");
    } finally {
      setGeneratingCodeContext(false);
    }
  }

  async function handleCopyCodeContextPack() {
    if (!window.nttc || !codeContext.preview?.markdownReport) return;
    try {
      await navigator.clipboard.writeText(codeContext.preview.markdownReport);
      setCodeContextCopyState("copied");
      const next = await window.nttc.recordCopyCodeContextPack();
      applySnapshot(next);
    } catch {
      setCodeContextCopyState("failed");
    }
  }

  async function handleAskLocalAiAboutCodeContext() {
    if (!window.nttc || !canAskCodeContextAi) return;
    const pack = codeContext.preview;
    let warningExtra = "";
    if (pack && ((pack.warningCount ?? 0) > 0 || pack.truncated)) {
      warningExtra = `\n\nWarning: this pack has ${pack.warningCount} warning(s)${
        pack.truncated ? " and truncation" : ""
      }.`;
    }
    const packCharCount =
      pack?.estimatedCharacters ?? pack?.markdownReport?.length ?? 0;
    if (
      isCodeContextLikelySlow({
        selectedFileCount: pack?.selectedFileCount ?? codeContext.selectedCount,
        maxLinesPerFile: codeContext.maxLinesPerFile,
        packCharCount,
      })
    ) {
      warningExtra += `\n\n${CONTEXT_SLOW_WARNING}`;
      await logUiAction(
        "info",
        "Context-size warning shown",
        `Code AI: ${pack?.selectedFileCount ?? codeContext.selectedCount} files, ${codeContext.maxLinesPerFile} max lines/file, ~${packCharCount} chars.`,
      );
    }
    const confirmed = window.confirm(
      `Send this approved Code Context Pack to Local AI?\n\n` +
        "• Only selected excerpts are sent\n" +
        "• No source files are edited\n" +
        "• No commands are run\n" +
        "• No hidden file access is granted\n" +
        "• Model response is advice/review only" +
        warningExtra,
    );
    if (!confirmed) return;
    await logUiAction(
      "info",
      "Code AI request confirmation shown",
      "User confirmed send to Local AI.",
    );
    setCodeContextAiCopyState("idle");
    const next = await window.nttc.askLocalAiAboutCodeContext();
    applySnapshot(next);
    markTabs(["reports"], "info");
  }

  async function handleCopyCodeContextAiResponse() {
    if (!window.nttc || !codeContextAi.saved) return;
    try {
      await navigator.clipboard.writeText(codeContextAi.saved.responseText);
      setCodeContextAiCopyState("copied");
      const next = await window.nttc.recordCopyCodeContextAiResponse();
      applySnapshot(next);
    } catch {
      setCodeContextAiCopyState("failed");
    }
  }

  async function handleTogglePatchDraftIncludeCodeAi(include: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.setPatchDraftIncludeCodeAi(include);
    applySnapshot(next);
  }

  async function handleTogglePatchDraftIncludeBuilderPlanDecision(include: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.setPatchDraftIncludeBuilderPlanDecision(include);
    applySnapshot(next);
  }

  async function handleTogglePatchDraftIncludeImplementationReview(include: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.setPatchDraftIncludeImplementationReview(include);
    applySnapshot(next);
  }

  async function handleGeneratePatchDraft() {
    if (!window.nttc || !canGeneratePatchDraft) return;
    const pack = codeContext.preview;
    let warningExtra = "";
    if (pack && ((pack.warningCount ?? 0) > 0 || pack.truncated)) {
      warningExtra = `\n\nWarning: this pack has ${pack.warningCount} warning(s)${
        pack.truncated ? " and truncation" : ""
      }.`;
    }
    const optionalExcerpts =
      patchDraft.includeCodeAiResponseExcerpt ||
      patchDraft.includeBuilderPlanDecisionExcerpt ||
      patchDraft.includeImplementationReviewExcerpt;
    const packCharCount =
      pack?.estimatedCharacters ?? pack?.markdownReport?.length ?? 0;
    if (
      isCodeContextLikelySlow({
        selectedFileCount: pack?.selectedFileCount ?? codeContext.selectedCount,
        maxLinesPerFile: codeContext.maxLinesPerFile,
        packCharCount,
        patchDraftOptionalExcerpts: optionalExcerpts,
      })
    ) {
      warningExtra += `\n\n${CONTEXT_SLOW_WARNING}`;
      await logUiAction(
        "info",
        "Context-size warning shown",
        `Patch Draft: ${pack?.selectedFileCount ?? codeContext.selectedCount} files, ${codeContext.maxLinesPerFile} max lines/file, ~${packCharCount} chars, optional excerpts=${optionalExcerpts}.`,
      );
    }
    const confirmed = window.confirm(
      `Send this approved Code Context Pack to Local AI for a patch draft?\n\n` +
        "• Only selected excerpts are sent\n" +
        "• No source files will be edited\n" +
        "• No commands will be run\n" +
        "• No hidden file access is granted\n" +
        "• Output is a draft only\n" +
        "• NTTC will not apply the patch" +
        warningExtra,
    );
    if (!confirmed) return;
    await logUiAction(
      "info",
      "Patch draft confirmation shown",
      "User confirmed Patch Draft generation.",
    );
    setPatchDraftCopyState("idle");
    const next = await window.nttc.generatePatchDraft();
    applySnapshot(next);
    markTabs(["reports"], "info");
  }

  async function handleCopyPatchDraft() {
    if (!window.nttc || !patchDraft.saved) return;
    try {
      await navigator.clipboard.writeText(patchDraft.saved.draftText);
      setPatchDraftCopyState("copied");
      const next = await window.nttc.recordCopyPatchDraft();
      applySnapshot(next);
    } catch {
      setPatchDraftCopyState("failed");
    }
  }

  async function handleApplyFastDraftSetup() {
    if (!window.nttc) return;
    const next = await window.nttc.applyFastDraftSetup();
    setCodeContextMaxLinesDraft(25);
    applySnapshot(next);
    markTabs(["reports"], "info");
  }

  async function handleGeneratePatchDraftSafetyReview() {
    if (!window.nttc) return;
    setGeneratingPatchDraftSafetyReview(true);
    setPatchDraftSafetyReviewCopyState("idle");
    try {
      const next = await window.nttc.generatePatchDraftSafetyReview();
      applySnapshot(next);
      markTabs(["request-output", "reports"], "info");
    } finally {
      setGeneratingPatchDraftSafetyReview(false);
    }
  }

  async function handleCopyPatchDraftSafetyReview() {
    if (!window.nttc || !patchDraftSafetyReview.saved) return;
    try {
      await navigator.clipboard.writeText(
        patchDraftSafetyReview.saved.markdownReport,
      );
      setPatchDraftSafetyReviewCopyState("copied");
      const next = await window.nttc.recordCopyPatchDraftSafetyReview();
      applySnapshot(next);
    } catch {
      setPatchDraftSafetyReviewCopyState("failed");
    }
  }

  async function handleGenerateExternalPatchDraftComparison() {
    if (!window.nttc) return;
    setGeneratingExternalPatchDraftComparison(true);
    setExternalPatchDraftComparisonCopyState("idle");
    try {
      const next = await window.nttc.generateExternalPatchDraftComparison();
      applySnapshot(next);
      markTabs(["reports"], "info");
    } finally {
      setGeneratingExternalPatchDraftComparison(false);
    }
  }

  async function handleCopyExternalPatchDraftComparison() {
    if (!window.nttc || !externalPatchDraftComparison.saved) return;
    try {
      await navigator.clipboard.writeText(
        externalPatchDraftComparison.saved.markdownReport,
      );
      setExternalPatchDraftComparisonCopyState("copied");
      const next = await window.nttc.recordCopyExternalPatchDraftComparison();
      applySnapshot(next);
    } catch {
      setExternalPatchDraftComparisonCopyState("failed");
    }
  }

  async function handleClearExternalPatchDraftComparison() {
    if (!window.nttc) return;
    setExternalPatchDraftComparisonCopyState("idle");
    const next = await window.nttc.clearExternalPatchDraftComparison();
    applySnapshot(next);
  }

  async function handleBuilderHandoffTargetChange(
    target: import("../shared/types").BuilderHandoffTarget,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setBuilderHandoffTarget(target);
    applySnapshot(next);
  }

  async function handleBuilderHandoffStrictnessChange(
    strictness: import("../shared/types").BuilderHandoffStrictness,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setBuilderHandoffStrictness(strictness);
    applySnapshot(next);
  }

  async function handleGenerateBuilderHandoffExport() {
    if (!window.nttc) return;
    setGeneratingBuilderHandoffExport(true);
    setBuilderHandoffExportCopyState("idle");
    try {
      const next = await window.nttc.generateBuilderHandoffExport();
      applySnapshot(next);
      markTabs(["reports"], "info");
    } finally {
      setGeneratingBuilderHandoffExport(false);
    }
  }

  async function handleCopyBuilderHandoffExport() {
    if (!window.nttc || !builderHandoffExport.saved) return;
    try {
      await navigator.clipboard.writeText(
        builderHandoffExport.saved.markdownReport,
      );
      setBuilderHandoffExportCopyState("copied");
      const next = await window.nttc.recordCopyBuilderHandoffExport();
      applySnapshot(next);
    } catch {
      setBuilderHandoffExportCopyState("failed");
    }
  }

  async function handleClearBuilderHandoffExport() {
    if (!window.nttc) return;
    setBuilderHandoffExportCopyState("idle");
    const next = await window.nttc.clearBuilderHandoffExport();
    applySnapshot(next);
  }

  async function handleImportedPatchDraftSourceChange(
    source: ImportedPatchDraftSource,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setImportedPatchDraftSource(source);
    applySnapshot(next);
  }

  async function handleImportedPatchDraftTypeChange(
    draftType: ImportedPatchDraftType,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setImportedPatchDraftType(draftType);
    applySnapshot(next);
  }

  async function handleSaveImportedPatchDraft() {
    if (!window.nttc || !importedPatchDraftDraft.trim()) return;
    const scan = scanImportedPatchDraftText(importedPatchDraftDraft.trim());
    let allowSecretOverride = false;
    if (scan.blockedBySecrets) {
      const confirmed = window.confirm(
        "Possible secret-like content was detected in the pasted draft. NTTC will not send this text to AI automatically. Save anyway only if you have removed actual secret values. Continue saving?",
      );
      if (!confirmed) return;
      allowSecretOverride = true;
    }
    setImportedPatchDraftCopyState("idle");
    skipNextImportedPatchDraftSync.current = true;
    await window.nttc.setImportedPatchDraftDraft(importedPatchDraftDraft);
    const next = await window.nttc.saveImportedPatchDraft(allowSecretOverride);
    applySnapshot(next);
    markTabs(["reports"], scan.riskPhrases.length > 0 ? "warning" : "info");
  }

  async function handleClearImportedPatchDraft() {
    if (!window.nttc) return;
    setImportedPatchDraftCopyState("idle");
    const next = await window.nttc.clearImportedPatchDraft();
    applySnapshot(next);
  }

  async function handleCopyImportedPatchDraft() {
    if (!window.nttc || !importedPatchDraft.saved) return;
    try {
      await navigator.clipboard.writeText(importedPatchDraft.saved.draftText);
      setImportedPatchDraftCopyState("copied");
      const next = await window.nttc.recordCopyImportedPatchDraft();
      applySnapshot(next);
    } catch {
      setImportedPatchDraftCopyState("failed");
    }
  }

  async function handlePatchDraftSafetyReviewTargetChange(
    target: PatchDraftSafetyReviewTargetKind,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setPatchDraftSafetyReviewTarget(target);
    applySnapshot(next);
  }

  async function handleToggleCodeContextFile(path: string, selected: boolean) {
    if (!window.nttc) return;
    const next = await window.nttc.setCodeContextFileSelected(path, selected);
    applySnapshot(next);
  }

  async function handleClearCodeContextSelection() {
    if (!window.nttc) return;
    const next = await window.nttc.clearCodeContextSelection();
    applySnapshot(next);
  }

  async function handleCodeContextMaxLinesChange(value: number) {
    setCodeContextMaxLinesDraft(value);
    if (!window.nttc) return;
    const next = await window.nttc.setCodeContextMaxLinesPerFile(value);
    applySnapshot(next);
  }

  async function handleCodeContextMaxCharsChange(value: number) {
    setCodeContextMaxCharsDraft(value);
    if (!window.nttc) return;
    const next = await window.nttc.setCodeContextMaxTotalChars(value);
    applySnapshot(next);
  }

  async function handleRunSafeCheck(kind: SafeCheckKind) {
    if (!window.nttc || safeChecks.running || checkpointBusy || advisorBusy) return;
    const candidate = safeChecks.available.find((item) => item.kind === kind);
    if (!candidate?.available || candidate.blocked) return;

    const confirmed = window.confirm(
      `Run this build/test check?\n\n${candidate.plainEnglishCommand}\n\n` +
        "This is not a terminal. Only this allowlisted script will run inside your selected project folder.\n" +
        "Dependencies are not installed automatically — install them outside this app if needed.",
    );
    if (!confirmed) return;

    setCommandCopyState("idle");
    const next = await window.nttc.runSafeCheck(kind);
    applySnapshot(next);
  }

  async function handleCancelSafeCheck() {
    if (!window.nttc || !safeChecks.running) return;
    const next = await window.nttc.cancelSafeCheck();
    applySnapshot(next);
  }

  async function handleCopyCommandOutput() {
    if (!window.nttc || !safeChecks.lastResult?.combinedOutput) return;
    try {
      await navigator.clipboard.writeText(safeChecks.lastResult.combinedOutput);
      setCommandCopyState("copied");
      const next = await window.nttc.recordCopyCommandOutput();
      applySnapshot(next);
    } catch {
      setCommandCopyState("failed");
    }
  }

  async function handleTestQwenCli() {
    if (!window.nttc || testingQwen || qwen.testing) return;
    setTestingQwen(true);
    try {
      await window.nttc.updateProviderSettings({
        providerType: providerTypeDraft,
        qwenCommand: qwenCommandDraft,
      });
      const next = await window.nttc.testQwenCli();
      applySnapshot(next);
    } finally {
      setTestingQwen(false);
    }
  }

  async function handleGenerateQwenPromptPack() {
    if (!window.nttc) return;
    setQwenPackCopyState("idle");
    await window.nttc.setUserRequest(requestDraft);
    const next = await window.nttc.generateQwenPromptPack();
    applySnapshot(next);
  }

  async function handleCopyQwenPromptPack() {
    if (!window.nttc || !qwen.promptPack) return;
    try {
      await navigator.clipboard.writeText(qwen.promptPack.markdownReport);
      setQwenPackCopyState("copied");
      const next = await window.nttc.recordCopyQwenPromptPack();
      applySnapshot(next);
    } catch {
      setQwenPackCopyState("failed");
    }
  }

  async function handleCopyQwenReport() {
    if (!window.nttc || !qwen.lastReport) return;
    try {
      await navigator.clipboard.writeText(qwen.lastReport.reportText);
      setQwenReportCopyState("copied");
      const next = await window.nttc.recordCopyQwenReport();
      applySnapshot(next);
    } catch {
      setQwenReportCopyState("failed");
    }
  }

  async function handleExternalSourceChange(source: ExternalReviewSource) {
    if (!window.nttc) return;
    const next = await window.nttc.setExternalReviewSource(source);
    applySnapshot(next);
  }

  async function handleSaveExternalReview() {
    if (!window.nttc || !externalDraft.trim()) return;
    setExternalCopyState("idle");
    await window.nttc.setExternalReviewLabel(externalLabel);
    await window.nttc.setExternalReviewDraft(externalDraft);
    const next = await window.nttc.saveExternalReview();
    skipNextExternalDraftSync.current = true;
    setExternalDraft("");
    setExternalLabel("");
    applySnapshot(next);
  }

  async function handleClearExternalDraft() {
    if (!window.nttc) return;
    setExternalCopyState("idle");
    skipNextExternalDraftSync.current = true;
    setExternalDraft("");
    setExternalLabel("");
    const next = await window.nttc.clearExternalReview();
    applySnapshot(next);
  }

  async function handleSelectExternalReview(reviewId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.selectExternalReview(reviewId);
    applySnapshot(next);
  }

  async function handleDeleteExternalReview(reviewId: string) {
    if (!window.nttc) return;
    const confirmed = window.confirm(
      "Delete this External Review from app storage?\n\nThis does not change your project files. Advice was never executed.",
    );
    if (!confirmed) return;
    const next = await window.nttc.deleteExternalReview(reviewId);
    applySnapshot(next);
  }

  async function handleCopyExternalReview(reviewId?: string) {
    if (!window.nttc) return;
    const target =
      (reviewId
        ? externalReview.reviews.find((r) => r.id === reviewId)
        : null) ?? externalReview.selected;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.reviewText);
      setExternalCopyState("copied");
      const next = await window.nttc.recordCopyExternalReview(target.id);
      applySnapshot(next);
    } catch {
      setExternalCopyState("failed");
    }
  }

  async function handleBuilderResultSourceChange(source: BuilderResultSource) {
    if (!window.nttc) return;
    const next = await window.nttc.setBuilderResultSource(source);
    applySnapshot(next);
  }

  async function handleBuilderResultResponseTypeChange(
    responseType: BuilderResultResponseType,
  ) {
    if (!window.nttc) return;
    const next = await window.nttc.setBuilderResultResponseType(responseType);
    applySnapshot(next);
  }

  async function handleSaveBuilderResult() {
    if (!window.nttc || !builderResultDraft.trim()) return;
    setBuilderResultCopyState("idle");
    await window.nttc.setBuilderResultLabel(builderResultLabel);
    await window.nttc.setBuilderResultDraft(builderResultDraft);
    const next = await window.nttc.saveBuilderResult();
    skipNextBuilderResultDraftSync.current = true;
    setBuilderResultDraft("");
    setBuilderResultLabel("");
    applySnapshot(next);
  }

  async function handleClearBuilderResult() {
    if (!window.nttc) return;
    setBuilderResultCopyState("idle");
    skipNextBuilderResultDraftSync.current = true;
    setBuilderResultDraft("");
    setBuilderResultLabel("");
    const next = await window.nttc.clearBuilderResult();
    applySnapshot(next);
  }

  async function handleCopyBuilderResult() {
    if (!window.nttc) return;
    const saved = builderResult.saved;
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.responseText);
      setBuilderResultCopyState("copied");
      const next = await window.nttc.recordCopyBuilderResult();
      applySnapshot(next);
    } catch {
      setBuilderResultCopyState("failed");
    }
  }

  async function handleGenerateBuilderPlanComparison() {
    if (!window.nttc || generatingComparison) return;
    setGeneratingComparison(true);
    setBuilderPlanComparisonCopyState("idle");
    try {
      const next = await window.nttc.generateBuilderPlanComparison();
      applySnapshot(next);
      markTabs(["request-output", "reports"], "info");
    } finally {
      setGeneratingComparison(false);
    }
  }

  async function handleCopyBuilderPlanComparison() {
    if (!window.nttc || !builderPlanComparison.saved) return;
    try {
      await navigator.clipboard.writeText(
        builderPlanComparison.saved.markdownReport,
      );
      setBuilderPlanComparisonCopyState("copied");
      const next = await window.nttc.recordCopyBuilderPlanComparison();
      applySnapshot(next);
    } catch {
      setBuilderPlanComparisonCopyState("failed");
    }
  }

  async function handleGenerateImplementationReview() {
    if (!window.nttc) return;
    setGeneratingImplementationReview(true);
    setImplementationReviewCopyState("idle");
    try {
      const next = await window.nttc.generateImplementationReview();
      applySnapshot(next);
      markTabs(["request-output", "reports"], "info");
    } finally {
      setGeneratingImplementationReview(false);
    }
  }

  async function handleCopyImplementationReview() {
    if (!window.nttc || !implementationReview.saved) return;
    try {
      await navigator.clipboard.writeText(
        implementationReview.saved.markdownReport,
      );
      setImplementationReviewCopyState("copied");
      const next = await window.nttc.recordCopyImplementationReview();
      applySnapshot(next);
    } catch {
      setImplementationReviewCopyState("failed");
    }
  }

  async function syncBacklogDraftFields() {
    if (!window.nttc) return;
    await window.nttc.setBacklogDraftTitle(backlogTitleDraft);
    await window.nttc.setBacklogDraftNotes(backlogNotesDraft);
    await window.nttc.setBacklogDraftRelatedStage(backlogStageDraft);
  }

  async function handleSaveBacklogItem() {
    if (!window.nttc || !backlogTitleDraft.trim()) return;
    setBacklogItemCopyState("idle");
    await syncBacklogDraftFields();
    const next = await window.nttc.saveBacklogItem();
    skipNextBacklogDraftSync.current = true;
    setBacklogTitleDraft(next.backlog?.draftTitle ?? "");
    setBacklogNotesDraft(next.backlog?.draftNotes ?? "");
    setBacklogStageDraft(next.backlog?.draftRelatedStage ?? "Stage 21");
    applySnapshot(next);
  }

  async function handleUpdateBacklogItem() {
    if (!window.nttc || !backlog.selected || !backlogTitleDraft.trim()) return;
    setBacklogItemCopyState("idle");
    await syncBacklogDraftFields();
    const next = await window.nttc.updateBacklogItem();
    skipNextBacklogDraftSync.current = true;
    setBacklogTitleDraft(next.backlog?.draftTitle ?? backlogTitleDraft);
    setBacklogNotesDraft(next.backlog?.draftNotes ?? backlogNotesDraft);
    setBacklogStageDraft(next.backlog?.draftRelatedStage ?? backlogStageDraft);
    applySnapshot(next);
  }

  async function handleSelectBacklogItem(itemId: string) {
    if (!window.nttc) return;
    const next = await window.nttc.selectBacklogItem(itemId);
    skipNextBacklogDraftSync.current = true;
    setBacklogTitleDraft(next.backlog?.draftTitle ?? "");
    setBacklogNotesDraft(next.backlog?.draftNotes ?? "");
    setBacklogStageDraft(next.backlog?.draftRelatedStage ?? "");
    applySnapshot(next);
  }

  async function handleDeleteBacklogItem(itemId: string) {
    if (!window.nttc) return;
    const confirmed = window.confirm(
      "Delete this backlog item from app storage?\n\nThis does not change your project files. Notes were never executed.",
    );
    if (!confirmed) return;
    const next = await window.nttc.deleteBacklogItem(itemId);
    skipNextBacklogDraftSync.current = true;
    setBacklogTitleDraft(next.backlog?.draftTitle ?? "");
    setBacklogNotesDraft(next.backlog?.draftNotes ?? "");
    setBacklogStageDraft(next.backlog?.draftRelatedStage ?? "Stage 21");
    applySnapshot(next);
  }

  async function handleCopyBacklogItem(itemId?: string) {
    if (!window.nttc) return;
    const target =
      (itemId ? backlog.items.find((i) => i.id === itemId) : null) ??
      backlog.selected;
    if (!target) return;
    const text = [
      `# ${target.title}`,
      "",
      `- Type: ${target.type}`,
      `- Priority: ${target.priority}`,
      `- Status: ${target.status}`,
      `- Project: ${target.projectName ?? "(none)"}`,
      `- Stage/version: ${target.relatedStage ?? "(none)"}`,
      `- Created: ${target.createdAt}`,
      `- Updated: ${target.updatedAt}`,
      target.hasRiskySuggestions
        ? `- Risk warnings: ${target.riskyPhrases.join(", ")}`
        : "- Risk warnings: none",
      "",
      "## Notes",
      "",
      target.notes || "(empty)",
      "",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setBacklogItemCopyState("copied");
      const next = await window.nttc.recordCopyBacklogItem(target.id);
      applySnapshot(next);
    } catch {
      setBacklogItemCopyState("failed");
    }
  }

  async function handleGenerateBacklogReport() {
    if (!window.nttc) return;
    setBacklogReportCopyState("idle");
    const next = await window.nttc.generateBacklogReport();
    applySnapshot(next);
  }

  async function handleCopyBacklogReport() {
    if (!window.nttc || !backlog.lastReport) return;
    try {
      await navigator.clipboard.writeText(backlog.lastReport.markdownReport);
      setBacklogReportCopyState("copied");
      const next = await window.nttc.recordCopyBacklogReport();
      applySnapshot(next);
    } catch {
      setBacklogReportCopyState("failed");
    }
  }

  async function handleBacklogTypeChange(type: BacklogItemType) {
    if (!window.nttc) return;
    const next = await window.nttc.setBacklogDraftType(type);
    applySnapshot(next);
  }

  async function handleBacklogPriorityChange(priority: BacklogPriority) {
    if (!window.nttc) return;
    const next = await window.nttc.setBacklogDraftPriority(priority);
    applySnapshot(next);
  }

  async function handleBacklogStatusChange(status: BacklogStatus) {
    if (!window.nttc) return;
    const next = await window.nttc.setBacklogDraftStatus(status);
    applySnapshot(next);
  }

  async function handleBacklogFilterChange(filters: Partial<BacklogFilters>) {
    if (!window.nttc) return;
    const next = await window.nttc.setBacklogFilters(filters);
    applySnapshot(next);
  }

  async function handleWorkflowCardClick(step: number) {
    const item = workflowSteps.find((entry) => entry.step === step);
    const label = item?.label ?? `Step ${step}`;
    await logUiAction("info", "Workflow card clicked", `Step ${step}: ${label}`);

    switch (step) {
      case 1: {
        setWorkflowGuidance(null);
        await logUiAction(
          "info",
          "Workflow card triggered safe action",
          "Opening project folder picker.",
        );
        await handleSelectProject();
        selectTab("project-setup");
        window.setTimeout(() => focusSection("select-project"), 160);
        return;
      }
      case 2: {
        if (!hasProject) {
          setWorkflowGuidance(
            "Select a project folder first. Then come back to Summarize Project.",
          );
          await logUiAction(
            "warning",
            "Workflow card blocked due to missing prerequisite",
            "Select a project folder first.",
          );
          goToTabAndFocus(
            "project-setup",
            "select-project",
            "Select a project folder first.",
          );
          return;
        }
        setWorkflowGuidance(null);
        await logUiAction(
          "info",
          "Workflow card triggered safe action",
          "Running Summarize Project.",
        );
        selectTab("reports");
        window.setTimeout(() => focusSection("project-summary"), 160);
        await handleSummarize();
        return;
      }
      case 3: {
        if (!hasProject) {
          await logUiAction(
            "warning",
            "Workflow card blocked due to missing prerequisite",
            "Select a project folder first.",
          );
          goToTabAndFocus(
            "project-setup",
            "select-project",
            "Select a project folder first.",
          );
          return;
        }
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened Safety and focused Create Safety Backup. Backup is not created until you click the button.",
        );
        goToTabAndFocus(
          "safety",
          "create-safety-backup",
          "Use Create Safety Backup on the Safety tab when you are ready.",
        );
        return;
      }
      case 4: {
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened Safety and focused Build/Test Checks. Checks are not auto-run.",
        );
        goToTabAndFocus(
          "safety",
          "build-test-checks",
          !hasProject
            ? "Select a project folder first, then summarize so checks can be detected."
            : !summary
              ? "Generate a project summary before Build/Test Checks can be detected."
              : "Open the Safety tab to run build/test checks. Confirmation is still required.",
        );
        return;
      }
      case 5: {
        if (!hasProject) {
          await logUiAction(
            "warning",
            "Workflow card blocked due to missing prerequisite",
            "Select a project folder first.",
          );
          goToTabAndFocus(
            "project-setup",
            "select-project",
            "Select a project folder first.",
          );
          return;
        }
        await logUiAction(
          "info",
          "Workflow card triggered safe action",
          "Running Scan Changed Files (read-only Git status).",
        );
        selectTab("reports");
        window.setTimeout(() => focusSection("changed-files"), 160);
        await handleScanChangedFiles();
        return;
      }
      case 6: {
        if (!summary) {
          await logUiAction(
            "warning",
            "Workflow card blocked due to missing prerequisite",
            "Generate a project summary before creating this report.",
          );
          if (!hasProject) {
            goToTabAndFocus(
              "project-setup",
              "select-project",
              "Select a project folder first.",
            );
          } else {
            goToTabAndFocus(
              "reports",
              "project-summary",
              "Generate a project summary before creating this report.",
            );
          }
          return;
        }
        await logUiAction(
          "info",
          "Workflow card triggered safe action",
          "Generating Copy-Paste Review Report.",
        );
        selectTab("reports");
        window.setTimeout(() => focusSection("review-report"), 160);
        await handleGenerateReviewPack();
        return;
      }
      case 7: {
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened AI Review. Ask Local AI Role is not auto-sent.",
        );
        goToTabAndFocus(
          "ai-review",
          "ask-local-ai",
          !providerReady
            ? "Test the local AI reviewer connection, then click Ask Local AI Role."
            : "Click Ask Local AI Role when you are ready. Advice stays metadata-only.",
        );
        return;
      }
      case 8: {
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened AI Review and focused Qwen Inspect Prompt. Live Qwen stays disabled.",
        );
        goToTabAndFocus(
          "ai-review",
          "qwen-inspect",
          "Generate a Qwen Inspect Prompt here. Live Qwen remains disabled for safety.",
        );
        return;
      }
      case 9: {
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened Request / Output and focused External Review.",
        );
        goToTabAndFocus(
          "request-output",
          "external-review",
          "Paste an outside review here. Advice is never executed.",
        );
        return;
      }
      case 10: {
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened Reports and focused Decision Report.",
        );
        goToTabAndFocus(
          "reports",
          "decision-report",
          "Generate a Decision Report here when you are ready.",
        );
        if (hasProject && !generatingDecision) {
          await logUiAction(
            "info",
            "Workflow card triggered safe action",
            "Generating Decision Report.",
          );
          await handleGenerateDecisionReport();
        }
        return;
      }
      case 11: {
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened Reports and focused Builder Prompt. Prompt stays plan-only.",
        );
        goToTabAndFocus(
          "reports",
          "builder-prompt",
          "Generate a plan-only Builder Prompt here. It does not edit files.",
        );
        return;
      }
      case 12: {
        await logUiAction(
          "info",
          "Workflow card navigated to tab",
          "Opened Safety and focused Restore. Restore is not automatic.",
        );
        goToTabAndFocus(
          "safety",
          "restore-safety-backup",
          latestCheckpoint
            ? "Restore still requires confirmation. Use only if something went wrong."
            : "Create a safety backup first so restore is available later.",
        );
        return;
      }
      default:
        return;
    }
  }

  async function handleDashboardSelectProject() {
    setWorkflowGuidance(null);
    await logUiAction(
      "info",
      "Dashboard shortcut triggered safe action",
      "Opening project folder picker.",
    );
    await handleSelectProject();
    selectTab("project-setup");
    window.setTimeout(() => focusSection("select-project"), 160);
  }

  async function handleDashboardSummarize() {
    if (!hasProject) {
      await logUiAction(
        "warning",
        "Dashboard shortcut blocked due to missing prerequisite",
        "Select a project folder first.",
      );
      goToTabAndFocus(
        "project-setup",
        "select-project",
        "Select a project folder first.",
      );
      return;
    }
    await logUiAction(
      "info",
      "Dashboard shortcut triggered safe action",
      "Running Summarize Project.",
    );
    selectTab("reports");
    window.setTimeout(() => focusSection("project-summary"), 160);
    await handleSummarize();
  }

  async function handleDashboardReviewReport() {
    if (!summary) {
      await logUiAction(
        "warning",
        "Dashboard shortcut blocked due to missing prerequisite",
        "Generate a project summary before creating this report.",
      );
      if (!hasProject) {
        goToTabAndFocus(
          "project-setup",
          "select-project",
          "Select a project folder first.",
        );
      } else {
        goToTabAndFocus(
          "reports",
          "project-summary",
          "Generate a project summary before creating this report.",
        );
      }
      return;
    }
    await logUiAction(
      "info",
      "Dashboard shortcut triggered safe action",
      "Generating Copy-Paste Review Report.",
    );
    selectTab("reports");
    window.setTimeout(() => focusSection("review-report"), 160);
    await handleGenerateReviewPack();
  }

  async function handleDashboardDecisionReport() {
    await logUiAction(
      "info",
      "Dashboard shortcut navigated to tab",
      "Opened Reports and focused Decision Report.",
    );
    goToTabAndFocus(
      "reports",
      "decision-report",
      "Generate a Decision Report here when you are ready.",
    );
    if (hasProject && !generatingDecision) {
      await handleGenerateDecisionReport();
    }
  }

  async function handleDailyNextActionClick(button: DailyNextActionButton) {
    const kind = button.kind;
    await logUiAction(
      "info",
      "Recommended action clicked",
      `${button.label} (${button.mode}).`,
    );

    const navigateOnly = async (
      tab: AppTabId,
      focusId: string,
      guidance: string,
    ) => {
      await logUiAction(
        "info",
        "Recommended action navigated to tab",
        `${button.label} → ${tab}.`,
      );
      goToTabAndFocus(tab, focusId, guidance);
    };

    const blocked = async (message: string, tab: AppTabId, focusId: string) => {
      await logUiAction(
        "warning",
        "Recommended action blocked due to missing prerequisite",
        message,
      );
      goToTabAndFocus(tab, focusId, message);
    };

    switch (kind) {
      case "select-project": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "project-setup",
            "select-project",
            "Select a project folder when you are ready.",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Opening project folder picker.",
        );
        await handleDashboardSelectProject();
        return;
      }
      case "summarize": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "project-summary",
            "Summarize Project when you are ready.",
          );
          return;
        }
        if (!hasProject) {
          await blocked(
            "Select a project folder first.",
            "project-setup",
            "select-project",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Running Summarize Project.",
        );
        await handleDashboardSummarize();
        return;
      }
      case "verify-backup": {
        if (!hasProject) {
          await blocked(
            "Select a project folder first.",
            "project-setup",
            "select-project",
          );
          return;
        }
        await navigateOnly(
          "safety",
          "create-safety-backup",
          "Verify Safety Backup before restore. Verification is read-only.",
        );
        return;
      }
      case "create-backup": {
        if (!hasProject) {
          await blocked(
            "Select a project folder first.",
            "project-setup",
            "select-project",
          );
          return;
        }
        await navigateOnly(
          "safety",
          "create-safety-backup",
          "Use Create Safety Backup on the Safety tab when you are ready.",
        );
        return;
      }
      case "go-safety-checks": {
        await navigateOnly(
          "safety",
          "build-test-checks",
          "Open the Safety tab to run build/test checks. Confirmation is still required.",
        );
        return;
      }
      case "generate-patch-pack": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "changed-files",
            "Scan Changed Files or generate a Patch Review Pack here.",
          );
          return;
        }
        if (!hasProject) {
          await blocked(
            "Select a project folder first.",
            "project-setup",
            "select-project",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating Patch Review Pack.",
        );
        selectTab("reports");
        window.setTimeout(() => focusSection("changed-files"), 160);
        await handleGeneratePatchReviewPack();
        return;
      }
      case "generate-review-pack": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "review-report",
            "Generate or copy a Copy-Paste Review Report here.",
          );
          return;
        }
        if (!summary) {
          await blocked(
            "Generate a project summary before creating this report.",
            hasProject ? "reports" : "project-setup",
            hasProject ? "project-summary" : "select-project",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating Copy-Paste Review Report.",
        );
        await handleDashboardReviewReport();
        return;
      }
      case "generate-decision": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "decision-report",
            "Generate or review the Decision Report here.",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating Decision Report.",
        );
        await handleDashboardDecisionReport();
        return;
      }
      case "review-warnings": {
        await logUiAction(
          "info",
          "Recommended action navigated to tab",
          "Opened History / Backlog for warning review.",
        );
        selectTab("history-backlog");
        setWorkflowGuidance(
          "Review backlog and warning items before continuing.",
        );
        return;
      }
      case "generate-builder-prompt": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "builder-prompt",
            "Generate a plan-only Builder Prompt here.",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating plan-only Builder Prompt.",
        );
        selectTab("reports");
        window.setTimeout(() => focusSection("builder-prompt"), 160);
        await handleGenerateBuilderPrompt();
        return;
      }
      case "paste-builder-result":
      case "review-builder-result": {
        await navigateOnly(
          "request-output",
          "builder-result",
          "Paste or review the Builder Result here as text only. Nothing is executed.",
        );
        return;
      }
      case "generate-implementation-review": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "request-output",
            "implementation-review",
            "Generate an Implementation Review after saving an Implementation report.",
          );
          return;
        }
        if (
          !builderResult.saved ||
          builderResult.saved.responseType !== "Implementation report"
        ) {
          await blocked(
            "Save an Implementation report first.",
            "request-output",
            "builder-result",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating rule-based Implementation Review.",
        );
        selectTab("request-output");
        window.setTimeout(() => focusSection("implementation-review"), 160);
        await handleGenerateImplementationReview();
        return;
      }
      case "open-external-review": {
        await navigateOnly(
          "request-output",
          "external-review",
          "Paste or review outside reviews here. Advice is never executed.",
        );
        return;
      }
      case "export-project-memory": {
        await navigateOnly(
          "reports",
          "project-memory",
          "Generate a Project Memory preview, review it, then save markdown files to `.nttc/` only.",
        );
        return;
      }
      case "ask-code-context-ai": {
        await navigateOnly(
          "reports",
          "code-context-ai",
          "Generate a Code Context Pack if needed, confirm, then ask Local AI about the approved excerpts.",
        );
        return;
      }
      case "refresh-code-context": {
        await navigateOnly(
          "reports",
          "code-context-pack",
          "Refresh the safe file list, select more excerpts, and regenerate the Code Context Pack preview.",
        );
        return;
      }
      case "generate-patch-draft": {
        await navigateOnly(
          "reports",
          "patch-draft-mode",
          "Generate a Patch Draft from the approved Code Context Pack (confirmation required; no apply).",
        );
        return;
      }
      case "manual-patch-draft-import": {
        await navigateOnly(
          "reports",
          "manual-patch-draft-import",
          "Paste an outside patch draft and save it for rule-based safety review.",
        );
        return;
      }
      case "generate-patch-draft-safety-review": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "patch-draft-safety-review",
            "Generate a rule-based Patch Draft Safety Review after creating or importing a Patch Draft.",
          );
          return;
        }
        const target = patchDraftSafetyReview.reviewTarget ?? "nttc-patch-draft";
        const hasDraftForTarget =
          target === "imported-patch-draft"
            ? Boolean(importedPatchDraft.saved)
            : Boolean(patchDraft.saved);
        if (!hasDraftForTarget) {
          await blocked(
            target === "imported-patch-draft"
              ? "Paste an imported patch draft first."
              : "Generate a Patch Draft first.",
            "reports",
            target === "imported-patch-draft"
              ? "manual-patch-draft-import"
              : "patch-draft-mode",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating rule-based Patch Draft Safety Review.",
        );
        selectTab("reports");
        window.setTimeout(() => focusSection("patch-draft-safety-review"), 160);
        await handleGeneratePatchDraftSafetyReview();
        return;
      }
      case "generate-external-patch-draft-comparison": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "external-patch-draft-comparison",
            "Compare NTTC and imported patch drafts with a rule-based report.",
          );
          return;
        }
        if (!patchDraft.saved && !importedPatchDraft.saved) {
          await blocked(
            "Generate or import at least one patch draft before comparing.",
            "reports",
            patchDraft.saved ? "manual-patch-draft-import" : "patch-draft-mode",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating External Patch Draft Comparison.",
        );
        selectTab("reports");
        window.setTimeout(
          () => focusSection("external-patch-draft-comparison"),
          160,
        );
        await handleGenerateExternalPatchDraftComparison();
        return;
      }
      case "generate-builder-handoff-export": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "builder-handoff-export",
            "Open Builder Handoff Export to copy a text-only handoff pack.",
          );
          return;
        }
        await logUiAction(
          "info",
          "Recommended action triggered safe report action",
          "Generating Builder Handoff Pack.",
        );
        selectTab("reports");
        window.setTimeout(() => focusSection("builder-handoff-export"), 160);
        await handleGenerateBuilderHandoffExport();
        return;
      }
      case "open-blueprint":
      case "import-blueprint":
      case "check-blueprint-completeness":
      case "export-planning-documents":
      case "generate-phase1-handoff":
      case "generate-blueprint-phase-task-cards":
      case "copy-blueprint-phase-task-card":
      case "generate-task-card-builder-handoff":
      case "copy-task-card-builder-handoff":
      case "paste-task-implementation-report":
      case "mark-task-implementation-returned":
      case "generate-blueprint-task-reconciliation":
      case "resolve-missing-task-producers":
      case "fix-task-status-inconsistency":
      case "generate-task-artifact-index":
      case "resolve-unlinked-task-artifacts":
      case "resolve-stale-task-artifacts": {
        await navigateOnly(
          "blueprint",
          "blueprint-planner",
          "Use the Blueprint tab to plan a new app before code exists.",
        );
        return;
      }
      case "open-build-mode":
      case "create-blueprint-before-scaffold":
      case "build-mode-planning-only":
      case "select-safe-scaffold-target-folder":
      case "choose-empty-scaffold-target-folder":
      case "safe-scaffold-target-ready":
      case "generate-safe-scaffold-file-tree-preview":
      case "review-safe-scaffold-file-tree-preview":
      case "regenerate-safe-scaffold-file-tree-preview": {
        if (kind === "create-blueprint-before-scaffold") {
          await navigateOnly(
            "blueprint",
            "blueprint-planner",
            "Create or import a Blueprint before Safe Scaffold Mode.",
          );
          return;
        }
        const focusId =
          kind === "open-build-mode" || kind === "build-mode-planning-only"
            ? "build-mode-safety-charter"
            : kind === "generate-safe-scaffold-file-tree-preview" ||
                kind === "review-safe-scaffold-file-tree-preview" ||
                kind === "regenerate-safe-scaffold-file-tree-preview" ||
                kind === "safe-scaffold-target-ready"
              ? "build-mode-file-tree-preview"
              : "build-mode-target-folder";
        await navigateOnly(
          "build",
          focusId,
          kind === "review-safe-scaffold-file-tree-preview"
            ? "Review the Safe Scaffold file tree. Next stage will add file-content preview."
            : kind === "regenerate-safe-scaffold-file-tree-preview"
              ? "Regenerate Safe Scaffold File Tree Preview."
              : kind === "generate-safe-scaffold-file-tree-preview" ||
                  kind === "safe-scaffold-target-ready"
                ? "Generate Safe Scaffold File Tree Preview."
                : "Select or review the Safe Scaffold target folder (readiness only).",
        );
        return;
      }
      case "link-changed-files-to-task":
      case "review-changed-files-scope-warnings": {
        await navigateOnly(
          "reports",
          "changed-files",
          "Link changed-file metadata to a Blueprint task on the Audit tab.",
        );
        return;
      }
      case "generate-architecture-health-report":
      case "regenerate-architecture-health-report": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "architecture-health",
            "Generate Architecture Health Report when ready.",
          );
          return;
        }
        if (!hasProject) {
          await blocked(
            "Select a project folder first.",
            "project-setup",
            "select-project",
          );
          return;
        }
        selectTab("reports");
        window.setTimeout(() => focusSection("architecture-health"), 160);
        await handleGenerateArchitectureHealthReport();
        return;
      }
      case "review-monolith-risk-changed-files":
      case "create-refactor-task-for-monolith": {
        await navigateOnly(
          "reports",
          "architecture-refactor-task-cards",
          "Review Architecture Refactor Task Cards before continuing.",
        );
        return;
      }
      case "generate-architecture-refactor-task-cards":
      case "regenerate-architecture-refactor-task-cards": {
        if (button.mode === "navigate") {
          await navigateOnly(
            "reports",
            "architecture-refactor-task-cards",
            "Generate Architecture Refactor Task Cards when ready.",
          );
          return;
        }
        if (!hasProject) {
          await blocked(
            "Select a project folder first.",
            "project-setup",
            "select-project",
          );
          return;
        }
        selectTab("reports");
        window.setTimeout(
          () => focusSection("architecture-refactor-task-cards"),
          160,
        );
        await handleGenerateArchitectureRefactorTaskCards();
        return;
      }
      case "review-architecture-refactor-task-card": {
        await navigateOnly(
          "reports",
          "architecture-refactor-task-cards",
          "Copy a narrow refactor task card for outside builder review.",
        );
        return;
      }
      case "generate-architecture-refactor-task-builder-handoff":
      case "copy-architecture-refactor-task-builder-handoff": {
        if (
          kind === "generate-architecture-refactor-task-builder-handoff" &&
          button.mode === "run"
        ) {
          if (!hasProject) {
            await blocked(
              "Select a project folder first.",
              "project-setup",
              "select-project",
            );
            return;
          }
          selectTab("reports");
          window.setTimeout(
            () => focusSection("architecture-refactor-task-builder-handoff"),
            160,
          );
          await handleGenerateArchitectureRefactorTaskBuilderHandoff();
          return;
        }
        await navigateOnly(
          "reports",
          "architecture-refactor-task-builder-handoff",
          "Generate or copy the Architecture Refactor Builder Handoff when ready.",
        );
        return;
      }
      case "paste-architecture-refactor-implementation-report":
      case "mark-architecture-refactor-implementation-returned":
      case "wait-for-refactor-builder-report": {
        await navigateOnly(
          "reports",
          "architecture-refactor-task-implementation-intake",
          "Paste the builder refactor implementation report when ready.",
        );
        return;
      }
      case "ready-continue": {
        await navigateOnly(
          "reports",
          "review-report",
          "Continue with reports or paste results from outside tools as needed.",
        );
        return;
      }
      default: {
        const _exhaustive: never = kind;
        void _exhaustive;
        return;
      }
    }
  }

  const dashboardAlerts: string[] = [];
  if (project?.isOneDrive) {
    dashboardAlerts.push(ONEDRIVE_PROJECT_WARNING);
  }
  if (backlogCriticalSafetyOpen > 0) {
    dashboardAlerts.push(
      `${backlogCriticalSafetyOpen} open Critical Safety backlog item(s). Review History / Backlog before proceeding.`,
    );
  }
  if (
    safeChecks.lastResult &&
    /fail|error|blocked/i.test(safeChecks.lastResult.status)
  ) {
    dashboardAlerts.push(
      `Last Build/Test Check failed: ${safeChecks.lastResult.scriptName} (${safeChecks.lastResult.status}).`,
    );
  }
  if (builderResult.saved?.hasRiskySuggestions) {
    dashboardAlerts.push(
      "Saved Builder Result includes risky suggestions — review text only; nothing was executed.",
    );
  }
  if (
    implementationReview.saved &&
    (implementationReview.saved.recommendation === "Restore from Safety Backup" ||
      implementationReview.saved.recommendation === "Do not proceed yet")
  ) {
    dashboardAlerts.push(
      `Implementation Review recommends: ${implementationReview.saved.recommendation}. Review before continuing.`,
    );
  }
  if (loadError) {
    dashboardAlerts.push(loadError);
  }

  const shortWorkflow = workflowSteps.slice(0, 5);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-name">New Type Tech Coder</div>
          <div className="brand-tag">
            Plain-English control panel for local AI coding agents
          </div>
          <div className="version-label">
            New Type Tech Coder v0.1.0 — Inspect-only: no edits allowed
          </div>
        </div>
        <div className="badge-row">
          <StatusBadge
            label={hasProject ? `Project: ${project?.displayName}` : "No project selected"}
            tone={hasProject ? "ok" : "neutral"}
          />
          <StatusBadge label="Inspect-only: no edits allowed" tone="info" />
          <StatusBadge label="Live Qwen disabled for safety" tone="warning" />
          <OllamaStatusBubble
            status={snapshot.ollamaStatus ?? emptyOllamaStatus}
            onCheck={() => void handleCheckOllamaStatus()}
          />
          <StatusBadge
            label={
              checkpointAvailability.restorable
                ? "Safety backup verified"
                : checkpointAvailability.hasPreviousRecord
                  ? "Backup record — verify first"
                  : "No safety backup yet"
            }
            tone={
              checkpointAvailability.restorable
                ? "ok"
                : checkpointAvailability.hasPreviousRecord
                  ? "warning"
                  : "neutral"
            }
          />
          <StatusBadge label="Edit mode unavailable" tone="danger" />
        </div>
      </header>

      <div className="status-strip" aria-live="polite">
        <span>
          <strong>Project:</strong>{" "}
          {hasProject ? project?.displayName : "No project selected"}
        </span>
        <span>
          <strong>Safety Backup:</strong>{" "}
          {checkpointAvailability.restorable
            ? "Verified — restore available"
            : checkpointAvailability.hasPreviousRecord
              ? "Record found — verify before restore"
              : "None yet"}
        </span>
        <span>
          <strong>Ollama:</strong>{" "}
          {OLLAMA_STATUS_LABELS[snapshot.ollamaStatus?.status ?? "not-checked"]}
        </span>
        <span>
          <strong>Next:</strong> {recommendedLabel}
        </span>
      </div>

      {loadError ? (
        <div className="onedrive-warning" style={{ margin: 12 }}>
          {loadError}
        </div>
      ) : null}

      {workflowGuidance ? (
        <div className="onedrive-warning" style={{ margin: "8px 12px 0" }} role="status">
          {workflowGuidance}
          <button
            type="button"
            className="btn"
            style={{ marginTop: 8, maxWidth: 220 }}
            onClick={() => setWorkflowGuidance(null)}
          >
            <span className="btn-label">Dismiss</span>
            <span className="btn-hint">Hide this guidance</span>
          </button>
        </div>
      ) : null}

      <main className="main-grid">
        <nav className="tab-bar" aria-label="Main sections">
          {APP_TABS.map((tab) => {
            const attention = tabAttention[tab.id];
            const classes = [
              "tab-button",
              activeTab === tab.id ? "active" : "",
              attention?.pulsing ? "pulse" : "",
              attention && !attention.pulsing
                ? `attention-${attention.level}`
                : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={tab.id}
                type="button"
                className={classes}
                onClick={() => selectTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                {tab.label}
                {attention && activeTab !== tab.id ? (
                  <span
                    className={`tab-dot ${attention.level !== "info" ? attention.level : ""}`}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        {activeTab === "dashboard" ? (
          <div className="tab-panel" role="tabpanel" aria-label="Dashboard">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Dashboard</h2>
                <p className="panel-subtitle">
                  Calm starting point — a few next steps, not every control.
                </p>
              </div>
              <div className="panel-body stack">
                <div className="dashboard-grid">
                  <div className="dashboard-card dashboard-next">
                    <h3>Recommended Next Step</h3>
                    <div className="dashboard-next-label">Recommended</div>
                    <div className="dashboard-next-title">{dailyNext.title}</div>
                    <div className="dashboard-next-label">Reason</div>
                    <div className="dashboard-next-reason">{dailyNext.reason}</div>
                    <div className="dashboard-next-label">Expected Result</div>
                    <div className="dashboard-next-expected">
                      {dailyNext.expectedResult}
                    </div>
                    {workflowBlockedReasons.length > 0 ? (
                      <div className="dashboard-blocked-reasons">
                        <div className="dashboard-next-label">Blocked</div>
                        <ul>
                          {workflowBlockedReasons.slice(0, 3).map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {dailyNext.freshnessHints.length > 0 ? (
                      <ul className="dashboard-freshness">
                        {dailyNext.freshnessHints.slice(0, 4).map((hint) => (
                          <li key={hint}>{hint}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="dashboard-next-actions">
                      <ActionButton
                        label={dailyNext.primary.label}
                        hint={
                          dailyNext.primary.mode === "navigate"
                            ? "Opens the right tab — nothing risky auto-runs"
                            : "Uses the existing safe action"
                        }
                        disabled={false}
                        primary
                        onClick={() =>
                          void handleDailyNextActionClick(dailyNext.primary)
                        }
                      />
                      {dailyNext.secondary ? (
                        <ActionButton
                          label={dailyNext.secondary.label}
                          hint={
                            dailyNext.secondary.mode === "navigate"
                              ? "Optional: open the related section"
                              : "Optional safe action"
                          }
                          disabled={false}
                          onClick={() =>
                            void handleDailyNextActionClick(dailyNext.secondary!)
                          }
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Current project</h3>
                    {hasProject ? (
                      <>
                        <div className="field-value">
                          <strong>{project?.displayName}</strong>
                        </div>
                        <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                          {project?.normalizedPath}
                        </div>
                        <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                          Mode: Inspect-only: no edits allowed
                        </div>
                      </>
                    ) : (
                      <div className="placeholder-box">
                        No project selected. Next: use the recommended action
                        above or open Project Setup.
                      </div>
                    )}
                  </div>

                  <div className="dashboard-card">
                    <h3>Safety state</h3>
                    <div className="field-value">
                      Status: {checkpointAvailability.label}
                    </div>
                    <div className="field-value">
                      Restore verified:{" "}
                      {checkpointAvailability.restorable ? "Yes" : "No"}
                    </div>
                    <div className="field-value">
                      File edits allowed:{" "}
                      {snapshot.safety.writesAllowed ? "Yes" : "No"}
                    </div>
                    <div className="field-value">
                      Live Qwen: disabled for safety
                    </div>
                    <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                      Full restore and checks live on the Safety tab.
                    </div>
                  </div>

                  <div className="dashboard-card dashboard-new-here">
                    <h3>New here?</h3>
                    <p className="field-value">
                      Start with a disposable copy, create a Safety Backup, then
                      follow Workflow Progress.
                    </p>
                    <div className="dashboard-next-actions">
                      <ActionButton
                        label="Open Quick Start Guide"
                        hint="Opens the Guide tab — readable help, no AI"
                        primary
                        disabled={false}
                        onClick={handleOpenQuickStartGuide}
                      />
                      <ActionButton
                        label="Copy Quick Start Guide"
                        hint="Copies markdown to clipboard — no project data"
                        disabled={false}
                        onClick={() => void handleCopyQuickStartGuide()}
                      />
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Recent important warnings</h3>
                    {dashboardAlerts.length === 0 ? (
                      <div className="field-value muted">
                        No important alerts right now.
                      </div>
                    ) : (
                      <ul className="deny-list">
                        {dashboardAlerts.map((alert) => (
                          <li key={alert}>{alert}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div>
                  <div className="field-label">Compact workflow progress</div>
                  <ol className="workflow-list">
                    {shortWorkflow.map((item) => (
                      <WorkflowStep
                        key={item.step}
                        step={item.step}
                        label={item.label}
                        detail={item.detail}
                        state={item.state}
                        hint={item.hint}
                        onActivate={() => void handleWorkflowCardClick(item.step)}
                      />
                    ))}
                  </ol>
                  <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                    Full 12-step list is on Project Setup. Cards stay clickable;
                    the recommended action above is the main next step.
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "guide" ? (
          <div className="tab-panel" role="tabpanel" aria-label="Guide">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Quick Start Guide</h2>
                <p className="panel-subtitle">
                  How to use NTTC safely — inspect-only, no automatic edits.
                </p>
              </div>
              <div className="panel-body">
                <QuickStartGuidePanel
                  onCopy={() => void handleCopyQuickStartGuide()}
                  copyState={guideCopyState}
                />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "blueprint" ? (
          <BlueprintTabSection
            {...buildBlueprintTabSectionProps({
              blueprint,
              hasProject,
              localAiProgressBanner: (
                <LocalAiProgressBanner
                  progress={localAiProgress}
                  mode="blueprint-planner"
                />
              ),
              blueprintQuestionsCopyState,
              blueprintPromptCopyState,
              blueprintLocalPlannerCopyState,
              blueprintImportedCopyState,
              blueprintPhase1CopyState,
              blueprintPhaseTaskCardsCopyAllState,
              blueprintPhaseTaskCardCopyState,
              taskBuilderHandoffCopyState,
              taskImplementationIntakeCopyState,
              taskImplementationIntakeDraft,
              taskReconciliationCopyState,
              taskArtifactIndexCopyState,
              handlers: {
                blueprintIntakeChange: handleBlueprintIntakeChange,
                generateBlueprintPlannerQuestions:
                  handleGenerateBlueprintPlannerQuestions,
                copyBlueprintPlannerQuestions: handleCopyBlueprintPlannerQuestions,
                generateBlueprintPlannerPrompt: handleGenerateBlueprintPlannerPrompt,
                copyBlueprintPlannerPrompt: handleCopyBlueprintPlannerPrompt,
                askLocalPlannerAi: handleAskLocalPlannerAi,
                copyBlueprintPlannerAiDraft: handleCopyBlueprintPlannerAiDraft,
                saveBlueprintPlannerDraftAsImported:
                  handleSaveBlueprintPlannerDraftAsImported,
                blueprintDraftSourceChange: handleBlueprintDraftSourceChange,
                blueprintDraftTextChange: handleBlueprintDraftTextChange,
                saveImportedBlueprint: handleSaveImportedBlueprint,
                clearImportedBlueprint: handleClearImportedBlueprint,
                copyImportedBlueprint: handleCopyImportedBlueprint,
                checkBlueprintCompleteness: handleCheckBlueprintCompleteness,
                previewBlueprintPlanningDocuments:
                  handlePreviewBlueprintPlanningDocuments,
                saveBlueprintPlanningDocuments: handleSaveBlueprintPlanningDocuments,
                generateBlueprintPhase1Handoff: handleGenerateBlueprintPhase1Handoff,
                copyBlueprintPhase1Handoff: handleCopyBlueprintPhase1Handoff,
                generateBlueprintPhaseTaskCards:
                  handleGenerateBlueprintPhaseTaskCards,
                copyAllBlueprintPhaseTaskCards: handleCopyAllBlueprintPhaseTaskCards,
                clearBlueprintPhaseTaskCards: handleClearBlueprintPhaseTaskCards,
                copyBlueprintPhaseTaskCard: handleCopyBlueprintPhaseTaskCard,
                setBlueprintPhaseTaskCardStatus:
                  handleSetBlueprintPhaseTaskCardStatus,
                resetBlueprintPhaseTaskCardStatus:
                  handleResetBlueprintPhaseTaskCardStatus,
                setActiveBlueprintPhaseTaskCard:
                  handleSetActiveBlueprintPhaseTaskCard,
                taskHandoffSelectedTaskChange: handleTaskHandoffSelectedTaskChange,
                taskHandoffTargetChange: handleTaskHandoffTargetChange,
                taskHandoffStrictnessChange: handleTaskHandoffStrictnessChange,
                generateTaskCardBuilderHandoff: handleGenerateTaskCardBuilderHandoff,
                copyTaskCardBuilderHandoff: handleCopyTaskCardBuilderHandoff,
                clearTaskCardBuilderHandoff: handleClearTaskCardBuilderHandoff,
                taskImplSelectedTaskChange: handleTaskImplSelectedTaskChange,
                taskImplBuilderSourceChange: handleTaskImplBuilderSourceChange,
                taskImplDraftChange: handleTaskImplDraftChange,
                saveTaskImplementationReport: handleSaveTaskImplementationReport,
                copyTaskImplementationReport: handleCopyTaskImplementationReport,
                clearTaskImplementationReport: handleClearTaskImplementationReport,
                markTaskImplementationReturned: handleMarkTaskImplementationReturned,
                markTaskReviewed: handleMarkTaskReviewed,
                stageTaskImplementationReportForReview:
                  handleStageTaskImplementationReportForReview,
                generateBlueprintTaskReconciliation:
                  handleGenerateBlueprintTaskReconciliation,
                copyBlueprintTaskReconciliation:
                  handleCopyBlueprintTaskReconciliation,
                clearBlueprintTaskReconciliation:
                  handleClearBlueprintTaskReconciliation,
                generateTaskArtifactIndex: handleGenerateTaskArtifactIndex,
                copyTaskArtifactIndex: handleCopyTaskArtifactIndex,
                clearTaskArtifactIndex: handleClearTaskArtifactIndex,
                taskArtifactIndexFilterChange: handleTaskArtifactIndexFilterChange,
                blueprintPreviewFileSelect: handleBlueprintPreviewFileSelect,
              },
            })}
          />
        ) : null}

        {activeTab === "build" ? (
          <BuildModeTab
            blueprint={blueprint}
            safeScaffoldTarget={safeScaffoldTarget}
            safeScaffoldFileTreePreview={safeScaffoldFileTreePreview}
            onOpenBlueprint={() => selectTab("blueprint")}
            onSelectTargetFolder={async () => {
              const next = await window.nttc.selectSafeScaffoldTargetFolder();
              setSnapshot(next);
            }}
            onClearTargetFolder={async () => {
              const next = await window.nttc.clearSafeScaffoldTargetFolder();
              setSnapshot(next);
            }}
            onRefreshTargetSafety={async () => {
              const next = await window.nttc.refreshSafeScaffoldTargetSafety();
              setSnapshot(next);
            }}
            onGenerateFileTreePreview={async () => {
              const next =
                await window.nttc.generateSafeScaffoldFileTreePreview();
              setSnapshot(next);
            }}
            onClearFileTreePreview={async () => {
              const next = await window.nttc.clearSafeScaffoldFileTreePreview();
              setSnapshot(next);
            }}
            onCopyFileTreePreview={async () => {
              const md = safeScaffoldFileTreePreview.saved?.markdown;
              if (!md) return;
              try {
                await navigator.clipboard.writeText(md);
                const next =
                  await window.nttc.recordCopySafeScaffoldFileTreePreview();
                setSnapshot(next);
              } catch {
                await window.nttc.logUiAction(
                  "warning",
                  "Copy Safe Scaffold file-tree preview failed",
                  "Clipboard write failed.",
                );
              }
            }}
          />
        ) : null}

        {activeTab === "project-setup" ? (
          <div className="tab-panel" role="tabpanel" aria-label="Project Setup">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Project Setup</h2>
                <p className="panel-subtitle">
                  Choose a folder and follow the recommended workflow. No code
                  editing here — inspect-only.
                </p>
              </div>
              <div className="panel-body stack">
                <div>
                  <div className="field-label">Recommended Workflow</div>
                  <HelpNote>
                    Follow these steps in order when you can. Optional steps stay
                    optional. Nothing risky runs until you click and confirm.
                  </HelpNote>
                  <ol className="workflow-list">
                    {workflowSteps.map((item) => (
                      <WorkflowStep
                        key={item.step}
                        step={item.step}
                        label={item.label}
                        detail={item.detail}
                        state={item.state}
                        hint={item.hint}
                        onActivate={() => void handleWorkflowCardClick(item.step)}
                      />
                    ))}
                  </ol>
                </div>

                <div className="section-divider" />

                <div>
                  <div className="field-label">Project name</div>
                  <div className={`field-value ${hasProject ? "" : "muted"}`}>
                    {project?.displayName ?? "None selected"}
                  </div>
                </div>
                <div>
                  <div className="field-label">Full path</div>
                  <div className={`field-value ${hasProject ? "" : "muted"}`}>
                    {project?.normalizedPath ??
                      "No project selected. Next: click Select Project Folder."}
                  </div>
                </div>
                <div>
                  <div className="field-label">Mode</div>
                  <div className="field-value">Inspect-only: no edits allowed</div>
                </div>
                <div>
                  <div className="field-label">Local AI reviewer (status)</div>
                  <div className="field-value muted">{snapshot.provider.message}</div>
                  <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                    Full Base URL / model settings are on Settings / Advanced and
                    AI Review.
                  </div>
                </div>
                <div>
                  <div className="field-label">Qwen CLI (status)</div>
                  <div className="field-value muted">
                    {qwenCliStatusLabel(qwen.cliStatus)}
                    {qwen.lastTestMessage ? ` — ${qwen.lastTestMessage}` : ""}
                  </div>
                  <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                    Live Qwen is disabled for safety. Prompt tools are on AI Review.
                  </div>
                </div>

                {project?.isOneDrive ? (
                  <div className="onedrive-warning" role="alert">
                    {ONEDRIVE_PROJECT_WARNING}
                  </div>
                ) : null}

                <div data-focus-id="select-project">
                  <ActionButton
                    label="Select Project Folder"
                    hint="Choose a local project directory"
                    disabled={false}
                    primary
                    onClick={() => void handleSelectProject()}
                  />
                </div>

                <ActionButton
                  label="Clear Project"
                  hint={
                    hasProject
                      ? "Remove the selected folder from this session"
                      : "No project to clear"
                  }
                  disabled={!hasProject}
                  onClick={() => void handleClearProject()}
                />

                <ActionButton
                  label="Inspect Only"
                  hint="Already active — no edits allowed"
                  disabled
                />

                <div className="section-divider" />

                <div>
                  <div className="field-label">Recent projects</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Reopen a previous folder. Restores saved summaries only — does not
                    auto-run scans, AI, or commands.
                  </div>
                </div>

                {history.recentProjects.length === 0 ? (
                  <div className="placeholder-box">
                    No recent projects yet. Next: select a project folder to start.
                  </div>
                ) : (
                  <ul className="deny-list">
                    {history.recentProjects.map((entry) => (
                      <li key={entry.projectPath}>
                        <div className="stack" style={{ gap: 4 }}>
                          <div>
                            <strong>{entry.projectName}</strong>
                            {entry.pathMissing ? " (folder missing)" : ""}
                          </div>
                          <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                            {entry.projectPath}
                          </div>
                          <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                            Last opened: {formatTime(entry.lastOpenedAt)}
                            {entry.lastScanAt
                              ? ` · Last scan: ${formatTime(entry.lastScanAt)}`
                              : ""}
                            {entry.lastCheckpointStatus
                              ? ` · Safety backup: ${entry.lastCheckpointStatus}`
                              : ""}
                          </div>
                          <ActionButton
                            label={entry.pathMissing ? "Folder missing" : "Open recent"}
                            hint={
                              entry.pathMissing
                                ? "This folder no longer exists on disk"
                                : "Open and restore previous saved summary/history"
                            }
                            disabled={entry.pathMissing}
                            onClick={() => void handleOpenRecentProject(entry.projectPath)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <ActionButton
                  label="Clear recent projects"
                  hint={
                    history.recentProjects.length === 0
                      ? "No recent projects to clear"
                      : "Clear the recent projects list from app data"
                  }
                  disabled={history.recentProjects.length === 0}
                  onClick={() => void handleClearRecentProjects()}
                />

                <div className="section-divider" />

                <div>
                  <div className="field-label">Project setup notes</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    After the workflow list, keep project details here. Use Request /
                    Output for working text, Reports for documents, Safety for
                    backup/restore, and Settings / Advanced for technical options.
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "request-output" ? (
          <div className="tab-panel" role="tabpanel" aria-label="Request / Output">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Request / Output</h2>
                <p className="panel-subtitle">
                  Working text and responses — type a request, preview local AI
                  advice, and paste external / builder results.
                </p>
              </div>
              <div className="panel-body stack">
                <div>
                  <div className="field-label">Your request (plain English)</div>
                  <textarea
                    className="request-box"
                    value={requestDraft}
                    maxLength={4000}
                    placeholder='Example: "Review this project structure and tell me what is risky."'
                    onChange={(event) => setRequestDraft(event.target.value)}
                  />
                  <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                    Stored locally. Sent to the Local AI Role only when you click Ask
                    Local AI Role, and only as part of safe summary/review text.
                  </div>
                </div>

                <div className="output-area" aria-live="polite">
                  {advisorResponse ? (
                    <>
                      Local AI role response ready ({advisorResponse.roleLabel}) from{" "}
                      <strong>{advisorResponse.modelName}</strong>.
                      <br />
                      Preview and copy below. Full Ask controls are also on AI Review.
                    </>
                  ) : reviewPack ? (
                    <>
                      Copy-paste review report ready
                      {reviewPack.limitedContext ? " (limited context)" : ""}.
                      <br />
                      Request included: {reviewPack.userRequestIncluded ? "Yes" : "No"}.
                      <br />
                      {providerReady
                        ? "Local AI reviewer is ready — you can Ask Local AI Role on AI Review."
                        : "Test the local AI reviewer connection on AI Review / Settings first."}
                    </>
                  ) : hasProject ? (
                    summary ? (
                      <>
                        Project summary ready for <strong>{summary.projectName}</strong>
                        {summaryIsFromHistory ? " (previous saved summary)" : ""}.
                        <br />
                        Next: create a safety backup, generate a review report, or ask
                        a Local AI Role.
                      </>
                    ) : (
                      <>
                        Project selected. Next: click{" "}
                        <strong>Summarize Project</strong> on Dashboard or Reports.
                      </>
                    )
                  ) : (
                    <>
                      No project selected. Next: select a project folder on Project Setup.
                      <br />
                      Ask Local AI Role needs a Project Summary or Review Report first.
                    </>
                  )}
                </div>

                <AdvisorResponsePanel
                  response={advisorResponse}
                  statusMessage={snapshot.advisorStatusMessage}
                  busy={advisorBusy}
                  selectedRoleId={localAiRole}
                  copyState={advisorCopyState}
                  onCopy={() => void handleCopyAdvisorResponse()}
                />

                <div className="section-divider" />

                <div data-focus-id="external-review">
                  <ExternalReviewPanel
                    externalReview={externalReview}
                    hasProject={hasProject}
                    reviewPackExists={Boolean(reviewPack)}
                    draftText={externalDraft}
                    draftLabel={externalLabel}
                    onSourceChange={(source) => void handleExternalSourceChange(source)}
                    onDraftChange={setExternalDraft}
                    onLabelChange={setExternalLabel}
                    onSave={() => void handleSaveExternalReview()}
                    onClearDraft={() => void handleClearExternalDraft()}
                    onSelect={(id) => void handleSelectExternalReview(id)}
                    onDelete={(id) => void handleDeleteExternalReview(id)}
                    onCopy={(id) => void handleCopyExternalReview(id)}
                    copyState={externalCopyState}
                  />
                </div>

                <div className="section-divider" />

                <div data-focus-id="builder-result">
                  <BuilderResultPanel
                    builderResult={builderResult}
                    hasProject={hasProject}
                    draftText={builderResultDraft}
                    draftLabel={builderResultLabel}
                    onSourceChange={(source) => void handleBuilderResultSourceChange(source)}
                    onResponseTypeChange={(type) =>
                      void handleBuilderResultResponseTypeChange(type)
                    }
                    onDraftChange={setBuilderResultDraft}
                    onLabelChange={setBuilderResultLabel}
                    onSave={() => void handleSaveBuilderResult()}
                    onClear={() => void handleClearBuilderResult()}
                    onCopy={() => void handleCopyBuilderResult()}
                    copyState={builderResultCopyState}
                  />
                </div>

                <div className="section-divider" />

                <BuilderPlanComparisonPanel
                  comparison={builderPlanComparison}
                  hasImportedPlan={Boolean(builderResult.saved)}
                  hasNttcBuilderPlan={Boolean(builderPlan.saved)}
                  generating={generatingComparison}
                  copyState={builderPlanComparisonCopyState}
                  onGenerate={() => void handleGenerateBuilderPlanComparison()}
                  onCopy={() => void handleCopyBuilderPlanComparison()}
                  planningStyle={planningStyle.style}
                />

                <div className="section-divider" />

                <ImplementationReviewPanel
                  review={implementationReview}
                  hasImplementationReport={
                    builderResult.saved?.responseType === "Implementation report"
                  }
                  hasApprovedPlanOrComparison={
                    Boolean(builderPlan.saved) ||
                    Boolean(builderPlanComparison.saved)
                  }
                  generating={generatingImplementationReview}
                  copyState={implementationReviewCopyState}
                  onGenerate={() => void handleGenerateImplementationReview()}
                  onCopy={() => void handleCopyImplementationReview()}
                />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "reports" ? (
          <div className="tab-panel" role="tabpanel" aria-label="Reports">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Reports</h2>
                <p className="panel-subtitle">
                  Generate documents to paste into other AIs — summaries, review
                  packs, decision and builder prompts.
                </p>
              </div>
              <div className="panel-body stack">
                <WorkflowGuidancePanel
                  progress={workflowProgress}
                  health={workflowHealth}
                  handoffReadiness={handoffReadiness}
                  blockedReasons={workflowBlockedReasons}
                  onNavigate={(focusId) =>
                    goToTabAndFocus(
                      focusId.startsWith("build-mode")
                        ? "build"
                        : focusId.startsWith("blueprint")
                          ? "blueprint"
                          : "reports",
                      focusId,
                    )
                  }
                />

                <p className="workflow-guide-hint field-value muted">
                  Confused?{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={handleOpenQuickStartGuide}
                  >
                    Open the Quick Start Guide
                  </button>{" "}
                  for the safe workflow.
                </p>

                <div className="section-divider" />

                <ActionButton
                  label="Summarize Project"
                  hint={
                    !hasProject
                      ? "Select a project folder first"
                      : summarizing
                        ? "Scanning safe project info…"
                        : "Scan safe project info and build a plain-English summary"
                  }
                  disabled={!hasProject || summarizing}
                  onClick={() => void handleSummarize()}
                />

                <div data-focus-id="project-summary">
                  <ProjectSummaryPanel
                    summary={summary}
                    fromHistory={summaryIsFromHistory}
                    copyState={summaryCopyState}
                    onCopy={() => void handleCopySummary()}
                  />
                </div>

                <div className="section-divider" />

                <ReportsArchitectureSection
                  {...buildReportsArchitectureSectionProps({
                    hasProject,
                    architectureHealth,
                    architectureRefactorTaskCards,
                    architectureRefactorTaskBuilderHandoff,
                    architectureRefactorTaskImplementationIntake,
                    architectureRefactorImplIntakeDraft,
                    architectureHealthCopyState,
                    architectureRefactorCopyAllState,
                    architectureRefactorCopyTaskState,
                    architectureRefactorHandoffCopyState,
                    architectureRefactorImplIntakeCopyState,
                    handlers: {
                      generateArchitectureHealthReport:
                        handleGenerateArchitectureHealthReport,
                      copyArchitectureHealthReport: handleCopyArchitectureHealthReport,
                      clearArchitectureHealthReport: handleClearArchitectureHealthReport,
                      architectureHealthIncludeTestFiles:
                        handleArchitectureHealthIncludeTestFiles,
                      architectureHealthIncludeMarkdownDocs:
                        handleArchitectureHealthIncludeMarkdownDocs,
                      generateArchitectureRefactorTaskCards:
                        handleGenerateArchitectureRefactorTaskCards,
                      copyAllArchitectureRefactorTaskCards:
                        handleCopyAllArchitectureRefactorTaskCards,
                      clearArchitectureRefactorTaskCards:
                        handleClearArchitectureRefactorTaskCards,
                      copyArchitectureRefactorTaskCard:
                        handleCopyArchitectureRefactorTaskCard,
                      architectureRefactorTaskStatus: handleArchitectureRefactorTaskStatus,
                      resetArchitectureRefactorTaskStatus:
                        handleResetArchitectureRefactorTaskStatus,
                      architectureRefactorHandoffSelectedTask:
                        handleArchitectureRefactorHandoffSelectedTask,
                      architectureRefactorHandoffTarget:
                        handleArchitectureRefactorHandoffTarget,
                      architectureRefactorHandoffStrictness:
                        handleArchitectureRefactorHandoffStrictness,
                      generateArchitectureRefactorTaskBuilderHandoff:
                        handleGenerateArchitectureRefactorTaskBuilderHandoff,
                      copyArchitectureRefactorTaskBuilderHandoff:
                        handleCopyArchitectureRefactorTaskBuilderHandoff,
                      clearArchitectureRefactorTaskBuilderHandoff:
                        handleClearArchitectureRefactorTaskBuilderHandoff,
                      architectureRefactorImplSelectedTaskChange:
                        handleArchitectureRefactorImplSelectedTaskChange,
                      architectureRefactorImplBuilderSourceChange:
                        handleArchitectureRefactorImplBuilderSourceChange,
                      architectureRefactorImplDraftChange:
                        handleArchitectureRefactorImplDraftChange,
                      saveArchitectureRefactorImplementationReport:
                        handleSaveArchitectureRefactorImplementationReport,
                      copyArchitectureRefactorImplementationReport:
                        handleCopyArchitectureRefactorImplementationReport,
                      clearArchitectureRefactorImplementationReport:
                        handleClearArchitectureRefactorImplementationReport,
                      markArchitectureRefactorImplementationReturned:
                        handleMarkArchitectureRefactorImplementationReturned,
                      markArchitectureRefactorReviewed:
                        handleMarkArchitectureRefactorReviewed,
                      stageArchitectureRefactorReportForReview:
                        handleStageArchitectureRefactorReportForReview,
                    },
                  })}
                />

                <div className="section-divider" />

                <div data-focus-id="review-report">
                  <ActionButton
                    label="Generate Copy-Paste Review Report"
                    hint={
                      generatingPack
                        ? "Building markdown report…"
                        : "Builds report only — does not auto-copy or send to AI"
                    }
                    disabled={generatingPack}
                    onClick={() => void handleGenerateReviewPack()}
                  />

                  <ReviewPackPanel
                    pack={reviewPack}
                    copyState={packCopyState}
                    onCopy={() => void handleCopyReviewPack()}
                  />
                </div>

                <div className="section-divider" />

                <ReportsWorkflowSection
                  panelId="project-memory"
                  title="Project Memory / Handoff Files"
                  collapsed={isReportsPanelCollapsed("project-memory")}
                  onToggle={(collapsed) =>
                    void handleSetReportsPanelCollapsed("project-memory", collapsed)
                  }
                >
                  <ProjectMemoryPanel
                    projectMemory={projectMemory}
                    hasProject={hasProject}
                    generating={generatingProjectMemory}
                    onGenerate={() => void handleGenerateProjectMemoryPreview()}
                    onCopyBundle={() => void handleCopyProjectMemoryBundle()}
                    onCopyActive={() => void handleCopyProjectMemoryActiveFile()}
                    copyBundleState={projectMemoryCopyBundleState}
                    copyActiveState={projectMemoryCopyActiveState}
                    activeFile={projectMemoryActiveFile}
                    onActiveFileChange={setProjectMemoryActiveFile}
                    saveDialogOpen={projectMemorySaveDialogOpen}
                    saveDialogMode={projectMemorySaveDialogMode}
                    onOpenSaveDialog={handleOpenProjectMemorySaveDialog}
                    onCancelSaveDialog={() => setProjectMemorySaveDialogOpen(false)}
                    onConfirmSave={() => void handleConfirmProjectMemorySave()}
                    planningStyle={planningStyle.style}
                  />
                </ReportsWorkflowSection>

                <div className="section-divider" />

                <ReportsAuditPatchSection
                  {...buildReportsAuditPatchSectionProps({
                    hasProject,
                    providerReady,
                    planningStyle: planningStyle.style,
                    localAiProgress,
                    codeContext,
                    codeContextAi,
                    patchDraft,
                    patchDraftSafetyReview,
                    importedPatchDraft,
                    externalPatchDraftComparison,
                    builderHandoffExport,
                    changedFiles,
                    phaseTaskCardsSaved: blueprint.phaseTaskCards.saved,
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
                    codeContextReviewModelLabel:
                      resolvedCodeContextReviewModel.modelName ?? "Not configured",
                    codeContextReviewModelSourceLabel: formatModelSelectionSource(
                      resolvedCodeContextReviewModel.source,
                    ),
                    patchDraftModelLabel:
                      resolvedPatchDraftModel.modelName ?? "Not configured",
                    patchDraftModelSourceLabel: formatModelSelectionSource(
                      resolvedPatchDraftModel.source,
                    ),
                    hasCodeAiResponse: Boolean(codeContextAi.saved),
                    hasBuilderPlanOrDecision: Boolean(
                      builderPlan.saved || decision.decisionReport,
                    ),
                    hasImplementationReview: Boolean(implementationReview.saved),
                    recentPatchDraftFailure: isPatchDraftFailureMessage(
                      patchDraft.lastFailureMessage,
                    ),
                    safetyBackupVerified: checkpointAvailability.restorable,
                    isPanelCollapsed: isReportsPanelCollapsed,
                    handlers: {
                      setReportsPanelCollapsed: handleSetReportsPanelCollapsed,
                      codeContextFilterChange: handleCodeContextFilterChange,
                      codeContextQuestionChange: handleCodeContextQuestionChange,
                      applyCodeQuestionTemplate: handleApplyCodeQuestionTemplate,
                      clearCodeContextQuestion: handleClearCodeContextQuestion,
                      codeContextMaxLinesChange: handleCodeContextMaxLinesChange,
                      codeContextMaxCharsChange: handleCodeContextMaxCharsChange,
                      refreshCodeContextFileList: handleRefreshCodeContextFileList,
                      generateCodeContextPreview: handleGenerateCodeContextPreview,
                      clearCodeContextSelection: handleClearCodeContextSelection,
                      toggleCodeContextFile: handleToggleCodeContextFile,
                      copyCodeContextPack: handleCopyCodeContextPack,
                      askLocalAiAboutCodeContext: handleAskLocalAiAboutCodeContext,
                      copyCodeContextAiResponse: handleCopyCodeContextAiResponse,
                      openRoleHelp: openRoleHelp,
                      togglePatchDraftIncludeCodeAi: handleTogglePatchDraftIncludeCodeAi,
                      togglePatchDraftIncludeBuilderPlanDecision:
                        handleTogglePatchDraftIncludeBuilderPlanDecision,
                      togglePatchDraftIncludeImplementationReview:
                        handleTogglePatchDraftIncludeImplementationReview,
                      generatePatchDraft: handleGeneratePatchDraft,
                      copyPatchDraft: handleCopyPatchDraft,
                      applyFastDraftSetup: handleApplyFastDraftSetup,
                      importedPatchDraftSourceChange: handleImportedPatchDraftSourceChange,
                      importedPatchDraftTypeChange: handleImportedPatchDraftTypeChange,
                      importedPatchDraftDraftChange: setImportedPatchDraftDraft,
                      saveImportedPatchDraft: handleSaveImportedPatchDraft,
                      clearImportedPatchDraft: handleClearImportedPatchDraft,
                      copyImportedPatchDraft: handleCopyImportedPatchDraft,
                      patchDraftSafetyReviewTargetChange:
                        handlePatchDraftSafetyReviewTargetChange,
                      generatePatchDraftSafetyReview:
                        handleGeneratePatchDraftSafetyReview,
                      copyPatchDraftSafetyReview: handleCopyPatchDraftSafetyReview,
                      generateExternalPatchDraftComparison:
                        handleGenerateExternalPatchDraftComparison,
                      copyExternalPatchDraftComparison:
                        handleCopyExternalPatchDraftComparison,
                      clearExternalPatchDraftComparison:
                        handleClearExternalPatchDraftComparison,
                      builderHandoffTargetChange: handleBuilderHandoffTargetChange,
                      builderHandoffStrictnessChange:
                        handleBuilderHandoffStrictnessChange,
                      generateBuilderHandoffExport: handleGenerateBuilderHandoffExport,
                      copyBuilderHandoffExport: handleCopyBuilderHandoffExport,
                      clearBuilderHandoffExport: handleClearBuilderHandoffExport,
                      scanChangedFiles: handleScanChangedFiles,
                      generatePatchReviewPack: handleGeneratePatchReviewPack,
                      copyPatchReviewPack: handleCopyPatchReviewPack,
                      changedFilesTaskLinkSelect: handleChangedFilesTaskLinkSelect,
                      linkChangedFilesToTask: handleLinkChangedFilesToTask,
                      clearChangedFilesTaskLink: handleClearChangedFilesTaskLink,
                    },
                  })}
                />

                <div className="section-divider" />

                <div data-focus-id="decision-report">
                  <DecisionReportPanel
                    decision={decision}
                    hasProject={hasProject}
                    generatingDecision={generatingDecision}
                    generatingBuilder={generatingBuilder}
                    onGenerateDecision={() => void handleGenerateDecisionReport()}
                    onCopyDecision={() => void handleCopyDecisionReport()}
                    onGenerateBuilder={() => void handleGenerateBuilderPrompt()}
                    onCopyBuilder={() => void handleCopyBuilderPrompt()}
                    decisionCopyState={decisionCopyState}
                    builderCopyState={builderCopyState}
                    planningStyle={planningStyle.style}
                  />
                </div>

                <div className="section-divider" />

                <div data-focus-id="builder-plan-report">
                  <div className="field-label">Latest Builder Plan</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Generate Builder Plan Mode on AI Review. Copy the latest plan
                    here for an outside builder. Plan-only — does not edit files.
                  </div>
                  {builderPlan.saved ? (
                    <>
                      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                        {builderPlan.saved.modelName} ·{" "}
                        {formatTime(builderPlan.saved.generatedAt)}
                        {builderPlan.saved.recommendation
                          ? ` · ${builderPlan.saved.recommendation}`
                          : ""}
                      </div>
                      <div className="review-preview" aria-label="Latest Builder Plan excerpt">
                        {builderPlan.saved.previewExcerpt}
                      </div>
                      <ActionButton
                        label="Copy Builder Plan"
                        hint={
                          builderPlanCopyState === "copied"
                            ? "Copied Builder Plan"
                            : builderPlanCopyState === "failed"
                              ? "Copy failed — try again"
                              : "Copy the full Builder Plan markdown"
                        }
                        disabled={false}
                        onClick={() => void handleCopyBuilderPlan()}
                      />
                    </>
                  ) : (
                    <div className="placeholder-box">
                      No Builder Plan yet. Next: open{" "}
                      <strong>AI Review</strong> and click{" "}
                      <strong>Generate Builder Plan with Local AI</strong>.
                    </div>
                  )}
                </div>

                <div className="section-divider" />

                <div data-focus-id="builder-plan-comparison-report">
                  <div className="field-label">Latest Builder Plan Comparison</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Generate on Request / Output after importing a builder plan.
                    Rule-based only — does not call Ollama.
                  </div>
                  {builderPlanComparison.saved ? (
                    <>
                      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                        {builderPlanComparison.saved.recommendation} ·{" "}
                        {formatTime(builderPlanComparison.saved.generatedAt)}
                      </div>
                      <div
                        className="review-preview"
                        aria-label="Latest Builder Plan Comparison excerpt"
                      >
                        {builderPlanComparison.saved.previewExcerpt}
                      </div>
                      <ActionButton
                        label="Copy Comparison Report"
                        hint={
                          builderPlanComparisonCopyState === "copied"
                            ? "Copied Comparison Report"
                            : builderPlanComparisonCopyState === "failed"
                              ? "Copy failed — try again"
                              : "Copy the full Comparison Report"
                        }
                        disabled={false}
                        onClick={() => void handleCopyBuilderPlanComparison()}
                      />
                    </>
                  ) : (
                    <div className="placeholder-box">
                      No Comparison Report yet. Next: open{" "}
                      <strong>Request / Output</strong>, save an imported builder
                      plan, then generate the comparison.
                    </div>
                  )}
                </div>

                <div className="section-divider" />

                <div data-focus-id="implementation-review-report">
                  <div className="field-label">Latest Implementation Review</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Generate on Request / Output after importing an Implementation
                    report. Rule-based only — does not call Ollama.
                  </div>
                  {implementationReview.saved ? (
                    <>
                      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                        {implementationReview.saved.recommendation} ·{" "}
                        {formatTime(implementationReview.saved.generatedAt)}
                      </div>
                      <div
                        className="review-preview"
                        aria-label="Latest Implementation Review excerpt"
                      >
                        {implementationReview.saved.previewExcerpt}
                      </div>
                      <ActionButton
                        label="Copy Implementation Review"
                        hint={
                          implementationReviewCopyState === "copied"
                            ? "Copied Implementation Review"
                            : implementationReviewCopyState === "failed"
                              ? "Copy failed — try again"
                              : "Copy the full Implementation Review"
                        }
                        disabled={false}
                        onClick={() => void handleCopyImplementationReview()}
                      />
                    </>
                  ) : (
                    <div className="placeholder-box">
                      No Implementation Review yet. Next: open{" "}
                      <strong>Request / Output</strong>, save an Implementation
                      report, then generate the review.
                    </div>
                  )}
                </div>

                <div className="section-divider" />

                <div data-focus-id="speaker-script-report">
                  <div className="field-label">Latest Speaker Script</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Generate Speaker Scripts on AI Review. Copy the latest one here
                    when you need a pasteable briefing.
                  </div>
                  {speakerScript.saved ? (
                    <>
                      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                        {speakerScript.saved.roleLabel} · {speakerScript.saved.toneLabel} ·{" "}
                        {formatTime(speakerScript.saved.generatedAt)}
                      </div>
                      <div className="review-preview" aria-label="Latest Speaker Script excerpt">
                        {speakerScript.saved.previewExcerpt}
                      </div>
                      <ActionButton
                        label="Copy Speaker Script"
                        hint={
                          speakerCopyState === "copied"
                            ? "Copied Speaker Script"
                            : speakerCopyState === "failed"
                              ? "Copy failed — try again"
                              : "Copy the full Speaker Script markdown"
                        }
                        disabled={false}
                        onClick={() => void handleCopySpeakerScript()}
                      />
                    </>
                  ) : (
                    <div className="placeholder-box">
                      No Speaker Script yet. Next: open{" "}
                      <strong>AI Review</strong> and click{" "}
                      <strong>Generate Speaker Script</strong>.
                    </div>
                  )}
                </div>

                <div className="section-divider" />

                <div>
                  <div className="field-label">Backlog Review Report</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Create and manage backlog items on History / Backlog. Generate or
                    copy the backlog report here when you need a pasteable document.
                  </div>
                  <ActionButton
                    label="Generate Backlog Review Report"
                    hint={
                      backlog.items.length === 0
                        ? "No backlog items yet — add one on History / Backlog"
                        : "Build a pasteable backlog review report"
                    }
                    disabled={backlog.items.length === 0}
                    onClick={() => void handleGenerateBacklogReport()}
                  />
                  <ActionButton
                    label="Copy Backlog Review Report"
                    hint={
                      !backlog.lastReport
                        ? "Generate a backlog report first"
                        : backlogReportCopyState === "copied"
                          ? "Copied Backlog Review Report"
                          : backlogReportCopyState === "failed"
                            ? "Copy failed — try again"
                            : "Copy the last backlog review report"
                    }
                    disabled={!backlog.lastReport}
                    onClick={() => void handleCopyBacklogReport()}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "safety" ? (
          <div className="tab-panel" role="tabpanel" aria-label="Safety">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Safety</h2>
                <p className="panel-subtitle">
                  Safety Backup / Restore and allowlisted Build/Test Checks. Restore
                  is deliberately separated and confirmed.
                </p>
              </div>
              <div className="panel-body stack">
                <CheckpointPanel
                  checkpoint={latestCheckpoint}
                  availability={checkpointAvailability}
                  statusMessage={snapshot.checkpointStatusMessage}
                  busy={checkpointBusy}
                  onVerify={() => void handleVerifyCheckpoint()}
                />

                <div data-focus-id="create-safety-backup">
                  <ActionButton
                    label="Create Safety Backup"
                    hint={
                      !hasProject
                        ? "Select a project folder first"
                        : checkpointBusy
                          ? "Safety backup in progress…"
                          : "Save a restore point (Git preferred, folder snapshot fallback)"
                    }
                    disabled={!hasProject || checkpointBusy}
                    primary={Boolean(
                      hasProject && !checkpointAvailability.restorable,
                    )}
                    onClick={() => void handleCreateCheckpoint()}
                  />
                </div>

                <div className="onedrive-warning" role="note">
                  Restore warning: Restore Last Safety Backup can change files in the
                  selected project folder. Use only on disposable copies when
                  testing. You will be asked to confirm. Restore stays disabled
                  until a Safety Backup is verified.
                </div>

                <div data-focus-id="restore-safety-backup">
                  <ActionButton
                    label="Restore Last Safety Backup"
                    hint={
                      !checkpointAvailability.restorable
                        ? checkpointAvailability.hasPreviousRecord
                          ? "Verify Safety Backup before restore."
                          : "Create and verify a safety backup first"
                        : checkpointBusy
                          ? "Restore in progress…"
                          : "Restore latest safety backup (asks for confirmation)"
                    }
                    disabled={!checkpointAvailability.restorable || checkpointBusy}
                    onClick={() => void handleUndoLastChange()}
                  />
                </div>

                <div className="section-divider" />

                <div data-focus-id="build-test-checks">
                  <SafeChecksPanel
                    safeChecks={safeChecks}
                    hasProject={hasProject}
                    hasSummary={Boolean(summary)}
                    disabledExtra={checkpointBusy || advisorBusy}
                    onRun={(kind) => void handleRunSafeCheck(kind)}
                    onCancel={() => void handleCancelSafeCheck()}
                    onCopyOutput={() => void handleCopyCommandOutput()}
                    copyState={commandCopyState}
                  />
                </div>

                <div className="section-divider" />

                <div>
                  <div className="field-label">Safety status</div>
                  <div className="field-value">
                    File edits allowed: {snapshot.safety.writesAllowed ? "Yes" : "No"}
                  </div>
                  <div className="field-value">
                    Edit mode available:{" "}
                    {snapshot.safety.editModeAvailable ? "Yes" : "No"}
                  </div>
                  <div className="field-value">
                    Safety backup exists:{" "}
                    {snapshot.safety.checkpointExists ? "Yes" : "No"}
                  </div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Lifecycle hooks that could mutate the project remain blocked.
                    Symlink/junction paths are skipped during scans where noted in
                    check output.
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "ai-review" ? (
          <div className="tab-panel" role="tabpanel" aria-label="AI Review">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">AI Review</h2>
                <p className="panel-subtitle">
                  Local AI reviewer and Qwen Inspect Prompt tools. Live Qwen stays
                  disabled. No file edits.
                </p>
              </div>
              <div className="panel-body stack">
                <div className="onedrive-warning" role="status">
                  Live Qwen is disabled for safety. Use Generate Qwen Inspect Prompt
                  and paste it into Qwen Code yourself.
                </div>

                <div>
                  <div className="field-label">Local AI Reviewer</div>
                  <div className="field-value muted">{snapshot.provider.message}</div>
                  <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                    Reviewer type: {providerTypeDraft}. Change Base URL / model on
                    Settings / Advanced if needed.
                  </div>
                </div>

                <label className="field-label" htmlFor="local-ai-role">
                  Local AI Role
                </label>
                <select
                  id="local-ai-role"
                  className="settings-input"
                  value={localAiRole}
                  onChange={(e) =>
                    void handleLocalAiRoleChange(e.target.value as LocalAiRoleId)
                  }
                >
                  {LOCAL_AI_ROLE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {LOCAL_AI_ROLES[id].label}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    flexWrap: "wrap",
                    marginTop: "0.25rem",
                  }}
                >
                  <span className="field-value muted" style={{ fontSize: "0.78rem" }}>
                    Selected role:
                  </span>
                  <ClickableRoleName
                    roleKey={localAiRole}
                    onOpen={openRoleHelp}
                  />
                </div>
                <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                  {selectedLocalAiRole.shortDescription}
                </div>
                <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                  Model for this role:{" "}
                  <strong>
                    {resolvedRoleModel.modelName ?? "(none selected)"}
                  </strong>
                  {resolvedRoleModel.source
                    ? ` · ${formatModelSelectionSource(resolvedRoleModel.source)}`
                    : ""}
                  {resolvedRoleModel.missingFromCache
                    ? " · not found in installed list"
                    : ""}
                </div>
                {selectedLocalAiRole.disclaimer ? (
                  <div className="onedrive-warning" role="status">
                    {selectedLocalAiRole.disclaimer}
                  </div>
                ) : null}

                {providerTypeDraft === "ollama-compatible" ? (
                  <ActionButton
                    label="Test Connection"
                    hint={
                      testingProvider
                        ? "Testing local AI reviewer…"
                        : snapshot.provider.lastTestMessage ??
                          "Check whether the local AI reviewer responds"
                    }
                    disabled={testingProvider}
                    onClick={() => void handleTestProvider()}
                  />
                ) : (
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Qwen Inspect Prompt mode is selected. Use Test CLI below. Live
                    Qwen remains disabled.
                  </div>
                )}

                <div data-focus-id="ask-local-ai">
                  <LocalAiProgressBanner
                    progress={localAiProgress}
                    mode="local-ai-role"
                  />
                  <ActionButton
                    label="Ask Local AI Role"
                    hint={
                      !providerReady
                        ? "Test Connection first"
                        : !(
                              summary ||
                              reviewPack ||
                              patchReviewPack ||
                              decision.decisionReport
                            )
                          ? "Generate a Summary, Review Report, Patch Pack, or Decision Report first"
                          : advisorBusy
                            ? `Waiting for ${selectedLocalAiRole.label}…`
                            : `Ask as ${selectedLocalAiRole.label} (metadata-only; no file access, no edits)`
                    }
                    disabled={!canAskLocalAi}
                    primary={canAskLocalAi}
                    onClick={() => void handleAskLocalAi()}
                  />
                </div>

                <AdvisorResponsePanel
                  response={advisorResponse}
                  statusMessage={snapshot.advisorStatusMessage}
                  busy={advisorBusy}
                  selectedRoleId={localAiRole}
                  copyState={advisorCopyState}
                  onCopy={() => void handleCopyAdvisorResponse()}
                />

                <div className="section-divider" />

                <BuilderPlanPanel
                  builderPlan={builderPlan}
                  providerReady={providerReady}
                  hasSafeContext={hasSafeAiContext}
                  modelLabel={
                    resolvedBuilderPlanModel.modelName ?? "(none selected)"
                  }
                  modelSourceLabel={
                    resolvedBuilderPlanModel.source
                      ? formatModelSelectionSource(
                          resolvedBuilderPlanModel.source,
                        )
                      : resolvedBuilderPlanModel.message
                  }
                  copyState={builderPlanCopyState}
                  onToggleExternal={(include) =>
                    void handleBuilderPlanIncludeExternal(include)
                  }
                  onToggleBuilderResult={(include) =>
                    void handleBuilderPlanIncludeBuilderResult(include)
                  }
                  onGenerate={() => void handleGenerateBuilderPlan()}
                  onCopy={() => void handleCopyBuilderPlan()}
                  onOpenRoleHelp={openRoleHelp}
                  localAiProgress={localAiProgress}
                  planningStyle={planningStyle.style}
                />

                <div className="section-divider" />

                <SpeakerScriptPanel
                  speakerScript={speakerScript}
                  generating={generatingSpeaker}
                  copyState={speakerCopyState}
                  onRoleChange={(role) => void handleSpeakerRoleChange(role)}
                  onToneChange={(tone) => void handleSpeakerToneChange(tone)}
                  onGenerate={() => void handleGenerateSpeakerScript()}
                  onCopy={() => void handleCopySpeakerScript()}
                />

                <div className="section-divider" />

                <div data-focus-id="qwen-inspect">
                  <QwenInspectPanel
                    qwen={qwen}
                    hasProject={hasProject}
                    hasSummaryOrPack={Boolean(summary || reviewPack)}
                    onTestCli={() => void handleTestQwenCli()}
                    onGeneratePack={() => void handleGenerateQwenPromptPack()}
                    onCopyPack={() => void handleCopyQwenPromptPack()}
                    onCopyReport={() => void handleCopyQwenReport()}
                    packCopyState={qwenPackCopyState}
                    reportCopyState={qwenReportCopyState}
                  />
                </div>

                <div className="section-divider" />

                <details>
                  <summary className="field-label">Advanced — AI safety notes</summary>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Local AI receives safe summary / review-report text only — never
                    raw source or secrets. Qwen CLI test detects the command only;
                    it does not run live inspect. Technical Base URL, model, and
                    Qwen command fields are on Settings / Advanced.
                  </div>
                </details>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "history-backlog" ? (
          <div className="tab-panel" role="tabpanel" aria-label="History / Backlog">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">History / Backlog</h2>
                <p className="panel-subtitle">
                  Saved project history and the Bug Log / Improvement Backlog.
                </p>
              </div>
              <div className="panel-body stack">
                <HistoryPanel
                  history={history}
                  hasProject={hasProject}
                  onCopySummary={() => void handleCopyHistorySummary()}
                  onCopyReviewPack={() => void handleCopyHistoryReviewPack()}
                  onCopyQwenPack={() => void handleCopyHistoryQwenPack()}
                  onCopyAdvisor={() => void handleCopyHistoryAdvisor()}
                  onCopyExternal={() => void handleCopyHistoryExternal()}
                  onClearProjectHistory={() => void handleClearProjectHistory()}
                  copyHints={{
                    summary:
                      summaryCopyState === "copied"
                        ? "Copied Project Summary"
                        : summaryCopyState === "failed"
                          ? "Copy failed — try again"
                          : "Copy last saved project summary",
                    reviewPack:
                      packCopyState === "copied"
                        ? "Copied Review Report"
                        : packCopyState === "failed"
                          ? "Copy failed — try again"
                          : "Copy last saved copy-paste review report",
                    qwenPack:
                      qwenPackCopyState === "copied"
                        ? "Copied Qwen Prompt"
                        : qwenPackCopyState === "failed"
                          ? "Copy failed — try again"
                          : "Copy last saved Qwen Inspect Prompt",
                    advisor:
                      advisorCopyState === "copied"
                        ? "Copied Local AI Response"
                        : advisorCopyState === "failed"
                          ? "Copy failed — try again"
                          : "Copy last saved Local AI response",
                    external:
                      externalCopyState === "copied"
                        ? "Copied External Review"
                        : externalCopyState === "failed"
                          ? "Copy failed — try again"
                          : "Copy last saved External Review",
                  }}
                />

                <div className="section-divider" />

                <BacklogPanel
                  backlog={backlog}
                  hasProject={hasProject}
                  projectName={project?.displayName ?? null}
                  projectPath={project?.normalizedPath ?? null}
                  draftTitle={backlogTitleDraft}
                  draftNotes={backlogNotesDraft}
                  draftRelatedStage={backlogStageDraft}
                  onTitleChange={setBacklogTitleDraft}
                  onTypeChange={(type) => void handleBacklogTypeChange(type)}
                  onPriorityChange={(priority) =>
                    void handleBacklogPriorityChange(priority)
                  }
                  onStatusChange={(status) => void handleBacklogStatusChange(status)}
                  onNotesChange={setBacklogNotesDraft}
                  onStageChange={setBacklogStageDraft}
                  onFilterChange={(filters) => void handleBacklogFilterChange(filters)}
                  onSave={() => void handleSaveBacklogItem()}
                  onUpdate={() => void handleUpdateBacklogItem()}
                  onSelect={(id) => void handleSelectBacklogItem(id)}
                  onDelete={(id) => void handleDeleteBacklogItem(id)}
                  onCopy={(id) => void handleCopyBacklogItem(id)}
                  onGenerateReport={() => void handleGenerateBacklogReport()}
                  onCopyReport={() => void handleCopyBacklogReport()}
                  itemCopyState={backlogItemCopyState}
                  reportCopyState={backlogReportCopyState}
                />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "settings" ? (
          <div className="tab-panel" role="tabpanel" aria-label="Settings / Advanced">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Settings / Advanced</h2>
                <p className="panel-subtitle">
                  Technical options, deny-list notes, and the raw action log. No
                  code editor and no terminal.
                </p>
              </div>
              <div className="panel-body stack">
                <div>
                  <div className="field-label">Local AI Reviewer Settings</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    Choose a local AI reviewer (Ollama) or Qwen Inspect Prompt mode.
                    No cloud credentials. No edit mode. Summary-only advice when
                    using Ollama.
                  </div>
                </div>

                <div>
                  <div className="field-label">Reviewer type</div>
                  <select
                    className="settings-input"
                    value={providerTypeDraft}
                    onChange={(event) =>
                      setProviderTypeDraft(event.target.value as ActiveProviderKind)
                    }
                  >
                    <option value="ollama-compatible">
                      Local AI Reviewer (Ollama-compatible)
                    </option>
                    <option value="qwen-code-inspect">
                      Qwen Inspect Prompt (CLI detect only)
                    </option>
                  </select>
                </div>

                {providerTypeDraft === "ollama-compatible" ? (
                  <>
                    <div>
                      <div className="field-label">Base URL</div>
                      <input
                        className="settings-input"
                        value={baseUrlDraft}
                        onChange={(event) => setBaseUrlDraft(event.target.value)}
                        placeholder="http://127.0.0.1:11434"
                      />
                    </div>

                    <ActionButton
                      label="Test Connection"
                      hint={
                        testingProvider
                          ? "Testing local AI reviewer…"
                          : snapshot.provider.lastTestMessage ??
                            "Check whether the local AI reviewer responds"
                      }
                      disabled={testingProvider}
                      onClick={() => void handleTestProvider()}
                    />

                    <div className="section-divider" />

                    <PlanningStyleControl
                      planningStyle={planningStyle}
                      onStyleChange={(style) => void handleSetPlanningStyle(style)}
                    />

                    <div className="section-divider" />

                    <RoleModelMappingPanel
                      installedModels={installedModels}
                      roleModelMapping={roleModelMapping}
                      globalFallbackModel={modelDraft}
                      refreshing={refreshingModels}
                      onRefresh={() => void handleRefreshInstalledModels()}
                      onSuggestDefaults={() =>
                        void handleSuggestRoleModelDefaults()
                      }
                      onMappingChange={(roleKey, modelName) =>
                        void handleRoleModelMappingChange(roleKey, modelName)
                      }
                      onGlobalFallbackChange={setModelDraft}
                      onOpenRoleHelp={openRoleHelp}
                    />
                  </>
                ) : (
                  <>
                    <div>
                      <div className="field-label">Qwen command / path</div>
                      <input
                        className="settings-input"
                        value={qwenCommandDraft}
                        onChange={(event) => setQwenCommandDraft(event.target.value)}
                        placeholder="qwen"
                      />
                      <div className="field-value muted" style={{ fontSize: "0.78rem" }}>
                        Examples: qwen, qwen-code, or a full path to the CLI
                      </div>
                    </div>

                    <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                      Use the AI Review tab to Test CLI and generate a copy-paste
                      prompt. Live Qwen is disabled for safety.
                    </div>
                  </>
                )}

                <div className="section-divider" />

                <div>
                  <div className="field-label">Safety deny list (prepared)</div>
                  <ul className="deny-list">
                    {snapshot.safety.denyListSummary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="field-label">Storage / history notes</div>
                  <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
                    History is stored locally in app data on this computer. It stores
                    summaries and reports only — not raw source code or secrets.
                  </div>
                </div>

                <div>
                  <div className="field-label">Action log</div>
                  <ActionLogPanel entries={snapshot.actionLog} />
                </div>

                <details className="about-safety-details">
                  <summary>About / Safety Status</summary>
                  <ul className="about-safety-list">
                    <li>Local inspection and review workbench</li>
                    <li>Live Qwen disabled</li>
                    <li>No edit mode</li>
                    <li>No arbitrary terminal</li>
                    <li>Build/Test Checks are allowlisted</li>
                    <li>History stored locally</li>
                  </ul>
                </details>
              </div>
            </section>
          </div>
        ) : null}
      </main>

      <div className="footer-note">
        <div>
          New Type Tech Coder v0.1.0 — Inspect-only: no edits allowed
        </div>
        <details className="about-safety-details">
          <summary>About / Safety Status</summary>
          <ul className="about-safety-list">
            <li>Local inspection and review workbench</li>
            <li>Live Qwen disabled</li>
            <li>No edit mode</li>
            <li>No arbitrary terminal</li>
            <li>Build/Test Checks are allowlisted</li>
            <li>History stored locally</li>
          </ul>
        </details>
      </div>

      {roleHelpKey ? (
        <RoleHelpModal roleKey={roleHelpKey} onClose={closeRoleHelp} />
      ) : null}
    </div>
  );
}
