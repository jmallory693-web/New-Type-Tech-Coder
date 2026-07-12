/** Shared types for New Type Tech Coder. */

import type {
  BlueprintBuildStyle,
  BlueprintProjectType,
  BlueprintSource,
  BlueprintTargetUser,
  BlueprintTechnicalComfort,
} from "./blueprintConstants";
import type {
  BlueprintPhaseTaskCardQuality,
  BlueprintPhaseTaskCardStatus,
} from "./blueprintTaskCardConstants";
import type { TaskCardBuilderHandoffReadiness } from "./taskCardBuilderHandoffConstants";
import type { TaskImplementationBuilderSource } from "./taskImplementationIntakeConstants";
import type { ArchitectureRefactorImplementationBuilderSource } from "./architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants";
import type { ArchitectureRefactorImplementationReportParseResult } from "./architectureRefactorTasks/parseArchitectureRefactorTaskImplementationReport";
import type { TaskReconciliationRecommendation } from "./taskReconciliationConstants";
import type { TaskImplementationReportParseResult } from "./parseTaskImplementationReport";

export type AppMode = "inspect-only";

export type ActionLogLevel = "info" | "warning" | "blocked" | "success";

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  level: ActionLogLevel;
  message: string;
  detail?: string;
}

export interface ProjectInfo {
  rootPath: string;
  displayName: string;
  normalizedPath: string;
  isOneDrive: boolean;
}

export interface SafetyGateStatus {
  initialized: boolean;
  mode: AppMode;
  project: ProjectInfo | null;
  writesAllowed: boolean;
  editModeAvailable: boolean;
  checkpointExists: boolean;
  denyListSummary: string[];
}

export interface PathCheckResult {
  requestedPath: string;
  normalizedPath: string;
  insideProjectRoot: boolean;
  denied: boolean;
  denyReason?: string;
  allowed: boolean;
  presenceOnly?: boolean;
}

export type ScanAccessIntent = "list" | "read-content" | "detect-presence";

export type ProviderConnectionState =
  | "not-connected"
  | "configured"
  | "connection-failed"
  | "ready";

/** Stage 65: persistent header Ollama status bubble. */
export type OllamaBubbleStatus =
  | "not-checked"
  | "checking"
  | "active"
  | "offline"
  | "error";

export interface OllamaStatusState {
  status: OllamaBubbleStatus;
  baseUrl: string | null;
  modelName: string | null;
  lastCheckedAt: string | null;
  installedModelCount: number;
  errorMessage: string | null;
  tooltip: string;
  busy: boolean;
}

export interface ProviderStatus {
  connected: boolean;
  providerId: string | null;
  providerName: string | null;
  message: string;
  connectionState: ProviderConnectionState;
  baseUrl: string | null;
  modelName: string | null;
  lastTestMessage: string | null;
  lastTestAt: string | null;
}

export type ActiveProviderKind = "ollama-compatible" | "qwen-code-inspect";

export interface ProviderSettings {
  /** Which advisor/provider panel is active. Ollama and Qwen settings are kept separately. */
  providerType: ActiveProviderKind;
  baseUrl: string;
  /** Global fallback model when a role has no mapping. */
  modelName: string;
  /** Configurable Qwen Code CLI command name or absolute path (e.g. qwen). */
  qwenCommand: string;
}

/** Stage 38A: one installed Ollama model from GET /api/tags. */
export interface InstalledOllamaModel {
  name: string;
  modifiedAt: string | null;
  sizeBytes: number | null;
  family: string | null;
  parameterSize: string | null;
  quantization: string | null;
}

export interface InstalledOllamaModelsState {
  models: InstalledOllamaModel[];
  lastRefreshAt: string | null;
  lastRefreshMessage: string | null;
  lastRefreshOk: boolean | null;
  busy: boolean;
}

export type ModelSelectionSource =
  | "role-specific"
  | "patch-planner-fallback"
  | "bug-risk-reviewer-fallback"
  | "code-context-review-fallback"
  | "architect-planner-fallback"
  | "project-foreman-fallback"
  | "general-reviewer-fallback"
  | "global-fallback";

export type QwenCliStatus =
  | "not-tested"
  | "available"
  | "missing"
  | "failed";

export interface QwenPromptPack {
  generatedAt: string;
  projectSelected: boolean;
  summaryAvailable: boolean;
  reviewPackAvailable: boolean;
  limitedContext: boolean;
  markdownReport: string;
  previewExcerpt: string;
}

export interface QwenInspectReport {
  createdAt: string;
  command: string;
  argv: string[];
  exitCode: number | null;
  durationMs: number | null;
  reportText: string;
  truncatedForPack: boolean;
  fileChangesDetected: boolean;
  fileChangeSummary: string | null;
}

export interface QwenInspectState {
  /** Stage 8A: live execution stays disabled until inspect-only safety is verified locally. */
  liveInspectEnabled: boolean;
  liveInspectDisabledReason: string;
  command: string;
  cliStatus: QwenCliStatus;
  lastTestMessage: string | null;
  lastTestAt: string | null;
  promptPack: QwenPromptPack | null;
  lastReport: QwenInspectReport | null;
  fileChangeVerification: string | null;
  statusMessage: string | null;
  testing: boolean;
}

export interface SkippedScanItem {
  path: string;
  reason: string;
}

export interface PackageScriptEntry {
  name: string;
  value: string;
}

export interface ProjectScanResult {
  scannedAt: string;
  projectName: string;
  projectPath: string;
  likelyProjectTypes: string[];
  techStack: string[];
  importantFolders: string[];
  importantFiles: string[];
  configFilesByName: string[];
  topLevelNames: string[];
  packageScripts: string[];
  /** Script name + command string from package.json (for safe-check analysis). */
  packageScriptEntries: PackageScriptEntry[];
  dependencies: string[];
  devDependencies: string[];
  lockFilesPresent: string[];
  readmeTitleOrFirstLine: string | null;
  packageJsonValid: boolean;
  packageJsonWarning: string | null;
  plainEnglishExplanation: string;
  safetyNotes: string[];
  skippedItems: SkippedScanItem[];
  /** Symlinks / junctions refused during scan (Stage 11B). */
  skippedSymlinkOrJunctionCount: number;
  skippedSymlinkOrJunctionNames: string[];
  inspectedSafeFiles: string[];
  suggestedReviewQuestion: string;
  markdownReport: string;
}

export type PackageManagerId = "npm" | "pnpm" | "yarn";

export type SafeCheckKind =
  | "build"
  | "test"
  | "typecheck"
  | "lint"
  | "check"
  | "format:check"
  | "validate";

export type SafeCommandStatus =
  | "not-run"
  | "running"
  | "passed"
  | "failed"
  | "timed-out"
  | "cancelled"
  | "blocked";

export interface SafeScriptCandidate {
  kind: SafeCheckKind;
  scriptName: string;
  scriptValue: string;
  available: boolean;
  blocked: boolean;
  reason: string | null;
  displayLabel: string;
  plainEnglishCommand: string;
  argvPreview: string;
  /** Related npm/yarn/pnpm lifecycle hooks that would auto-run (Stage 11B). */
  lifecycleHooks: string[];
}

export interface BlockedScriptInfo {
  scriptName: string;
  reason: string;
  /** When blocked for lifecycle hooks, the hook script names. */
  lifecycleHooks?: string[];
}

export interface SafeCommandResult {
  id: string;
  kind: SafeCheckKind;
  scriptName: string;
  packageManager: PackageManagerId;
  argv: string[];
  cwd: string;
  status: SafeCommandStatus;
  exitCode: number | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  outputTruncated: boolean;
  plainEnglishSummary: string;
  blockedReason: string | null;
}

export interface SafeChecksState {
  packageManager: PackageManagerId;
  packageManagerWarning: string | null;
  packageJsonFound: boolean;
  available: SafeScriptCandidate[];
  blocked: BlockedScriptInfo[];
  unavailable: BlockedScriptInfo[];
  lastResult: SafeCommandResult | null;
  running: boolean;
  statusMessage: string | null;
}

export type CheckpointMethod = "git-commit" | "folder-snapshot";

/** Stage 29: plain-English restore availability for Safety Backup. */
export type CheckpointAvailabilityStatus =
  | "none"
  | "record-unverified"
  | "verified-restorable"
  | "record-missing-target"
  | "unavailable";

export interface CheckpointAvailabilityState {
  status: CheckpointAvailabilityStatus;
  label: string;
  detail: string;
  method: CheckpointMethod | null;
  methodLabel: string | null;
  createdAt: string | null;
  verified: boolean;
  restorable: boolean;
  verificationMessage: string | null;
  verifiedAt: string | null;
  /** True when a previous history record exists but live restore is not yet verified. */
  hasPreviousRecord: boolean;
}

export interface CheckpointRecord {
  id: string;
  createdAt: string;
  projectName: string;
  projectPath: string;
  method: CheckpointMethod;
  methodLabel: string;
  plainEnglish: string;
  branchName: string | null;
  commitSha: string | null;
  hadUncommittedChanges: boolean | null;
  snapshotDir: string | null;
  skippedItems: SkippedScanItem[];
  skippedCount: number;
  sizeBytes: number | null;
  warnings: string[];
  isPreUndo: boolean;
}

export interface CheckpointOperationResult {
  ok: boolean;
  message: string;
  checkpoint: CheckpointRecord | null;
}

export interface OutsideReviewPack {
  generatedAt: string;
  userRequestIncluded: boolean;
  userRequestText: string;
  projectSelected: boolean;
  summaryAvailable: boolean;
  limitedContext: boolean;
  markdownReport: string;
  previewExcerpt: string;
  secretSafetyNote: string;
}

/** Stage 16: Git change kinds (read-only detection). */
export type ChangedFileKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "other";

export interface ChangedFileRiskFlag {
  id: string;
  label: string;
  plainEnglish: string;
}

export interface ChangedFileEntry {
  path: string;
  previousPath: string | null;
  kind: ChangedFileKind;
  /** Insertions from git --numstat when available (null for untracked / unavailable). */
  insertions: number | null;
  /** Deletions from git --numstat when available. */
  deletions: number | null;
  riskFlags: ChangedFileRiskFlag[];
  skippedBySafety: boolean;
  skipReason: string | null;
}

export interface ChangedFilesScanResult {
  scannedAt: string;
  projectPath: string;
  isGitRepo: boolean;
  gitAvailable: boolean;
  statusMessage: string;
  errorMessage: string | null;
  branchName: string | null;
  totalCount: number;
  modifiedCount: number;
  addedCount: number;
  deletedCount: number;
  renamedCount: number;
  untrackedCount: number;
  otherCount: number;
  riskyCount: number;
  truncated: boolean;
  truncationNote: string | null;
  manyFilesWarning: string | null;
  globalRiskFlags: ChangedFileRiskFlag[];
  files: ChangedFileEntry[];
  skippedOutsideOrDenied: SkippedScanItem[];
}

export interface PatchReviewPack {
  generatedAt: string;
  userRequestIncluded: boolean;
  userRequestText: string;
  projectSelected: boolean;
  changedFilesAvailable: boolean;
  limitedContext: boolean;
  markdownReport: string;
  previewExcerpt: string;
  secretSafetyNote: string;
  changedFileCount: number;
  riskyCount: number;
}

/** Stage 96: changed-files metadata linked to a Blueprint task (metadata only). */
export interface ChangedFilesTaskLinkRecord {
  taskId: string;
  taskTitle?: string;
  taskPhase?: string;
  sourceTaskCardHash?: string;
  linkedAt: string;
  changedFilesGeneratedAt?: string;
  changedFilesCount?: number;
  changedFilePaths?: string[];
  changedFileSummary?: string;
  linkSource: import("./changedFilesTaskLinkConstants").ChangedFilesTaskLinkSource;
  stale?: boolean;
  warnings?: string[];
}

/** Stage 96: live session state for changed-files task link. */
export interface ChangedFilesTaskLinkState {
  saved: ChangedFilesTaskLinkRecord | null;
  selectedTaskId: string | null;
  suggestedTaskId: string | null;
  suggestedReason: string | null;
  statusMessage: string | null;
}

export interface ChangedFilesState {
  busy: boolean;
  lastScan: ChangedFilesScanResult | null;
  statusMessage: string | null;
  patchReviewPack: PatchReviewPack | null;
  taskLink: ChangedFilesTaskLinkState;
}

/** Stage 18: rule-based next-action recommendation (not AI). */
export type RecommendedNextActionId =
  | "create-safety-backup-first"
  | "verify-safety-backup-first"
  | "run-build-test-checks-first"
  | "need-more-review-first"
  | "do-not-proceed-risky-reviews"
  | "do-not-proceed-risky-builder-result"
  | "do-not-proceed-critical-backlog-safety"
  | "ask-builder-to-revise"
  | "revert-or-restore-before-continuing"
  | "ready-for-small-builder-patch"
  | "no-clear-builder-task";

export interface RecommendedNextAction {
  id: RecommendedNextActionId;
  label: string;
  plainEnglish: string;
  reasons: string[];
}

export interface DecisionReport {
  generatedAt: string;
  userRequestIncluded: boolean;
  userRequestText: string;
  projectSelected: boolean;
  limitedContext: boolean;
  recommendedNextAction: RecommendedNextAction;
  markdownReport: string;
  previewExcerpt: string;
  secretSafetyNote: string;
}

export interface BuilderPromptPack {
  generatedAt: string;
  userRequestIncluded: boolean;
  userRequestText: string;
  projectSelected: boolean;
  limitedContext: boolean;
  planOnly: true;
  recommendedNextAction: RecommendedNextAction;
  markdownReport: string;
  previewExcerpt: string;
  secretSafetyNote: string;
}

export interface DecisionState {
  decisionReport: DecisionReport | null;
  builderPrompt: BuilderPromptPack | null;
  lastRecommendedNextAction: RecommendedNextAction | null;
  statusMessage: string | null;
}

/** Stage 19: pasted builder AI response (text-only; never executed). */
export type BuilderResultSource =
  | "Cursor"
  | "Codex"
  | "Grok Builder"
  | "Claude"
  | "ChatGPT"
  | "Other";

export type BuilderResultResponseType =
  | "Plan only"
  | "Implementation report"
  | "Error report"
  | "Builder plan"
  | "Revised builder plan"
  | "Unknown";

export type BuilderResultAppearance = "plan-only" | "implementation-like" | "unclear";

export interface BuilderResultRecord {
  id: string;
  source: BuilderResultSource;
  responseType: BuilderResultResponseType;
  savedAt: string;
  label: string | null;
  userRequestAtSave: string;
  projectName: string | null;
  projectPath: string | null;
  recommendedNextActionAtSave: RecommendedNextAction | null;
  builderPromptExisted: boolean;
  builderPromptWasPlanOnly: boolean;
  /** Stage 40: context flags at import time. */
  nttcBuilderPlanExistedAtImport?: boolean;
  decisionReportExistedAtImport?: boolean;
  patchReviewPackExistedAtImport?: boolean;
  backlogWarningsExistedAtImport?: boolean;
  /** Stage 42: context flags at import time. */
  builderPlanComparisonExistedAtImport?: boolean;
  safetyBackupVerifiedAtImport?: boolean;
  responseText: string;
  riskyPhrases: string[];
  hasRiskySuggestions: boolean;
  mismatchWarnings: string[];
  hasMismatchWarnings: boolean;
  appearsAs: BuilderResultAppearance;
  limitedContext: boolean;
  charCount: number;
  truncated: boolean;
  /** Stage 94: task join metadata when staged from Task Implementation Intake */
  taskId?: string;
  taskTitle?: string;
  taskPhase?: string;
  taskArtifactKind?: string;
  sourceTaskCardGeneratedAt?: string;
  sourceTaskCardHash?: string;
  sourceHandoffId?: string;
  sourceHandoffGeneratedAt?: string;
}
export type BuilderPlanComparisonRecommendation =
  | "Safe to ask builder for a more detailed plan"
  | "Ask builder to revise plan first"
  | "Create/verify Safety Backup first"
  | "Run Build/Test Checks first"
  | "Do not proceed yet"
  | "Ready for user-approved implementation in external builder";

export interface BuilderPlanComparisonRecord {
  id: string;
  generatedAt: string;
  importedBuilderResultId: string;
  importedSource: BuilderResultSource;
  importedResponseType: BuilderResultResponseType;
  importedSavedAt: string;
  nttcBuilderPlanExisted: boolean;
  decisionReportExisted: boolean;
  patchReviewPackExisted: boolean;
  backlogWarningsExisted: boolean;
  agreementItems: string[];
  differenceItems: string[];
  missingItems: string[];
  riskFlags: string[];
  safetyCriticalMentions: string[];
  testsChecksMentioned: string[];
  testsChecksMissing: string[];
  recommendation: BuilderPlanComparisonRecommendation;
  summaryPlainEnglish: string;
  suggestedNextBuilderPrompt: string;
  markdownReport: string;
  previewExcerpt: string;
  truncated: boolean;
  weakComparison: boolean;
  secretSafetyNote: string;
}

export interface BuilderPlanComparisonState {
  saved: BuilderPlanComparisonRecord | null;
  statusMessage: string | null;
}

/** Stage 42: rule-based Implementation Review (no Ollama). */
export type ImplementationReviewRecommendation =
  | "Run Build/Test Checks"
  | "Generate Patch Review Pack"
  | "Ask builder for clarification"
  | "Ask builder to revise implementation"
  | "Create/verify Safety Backup first"
  | "Restore from Safety Backup"
  | "Safe to continue review"
  | "Do not proceed yet";

export interface ImplementationReviewRecord {
  id: string;
  generatedAt: string;
  importedBuilderResultId: string;
  importedSource: BuilderResultSource;
  importedResponseType: BuilderResultResponseType;
  importedSavedAt: string;
  nttcBuilderPlanExisted: boolean;
  builderPlanComparisonExisted: boolean;
  decisionReportExisted: boolean;
  patchReviewPackExisted: boolean;
  safetyBackupVerified: boolean;
  backlogWarningsExisted: boolean;
  claimedChanges: string[];
  claimedFilesAreas: string[];
  claimedTestsChecks: string[];
  claimedErrorsFailures: string[];
  missingVerification: string[];
  planAlignmentWarnings: string[];
  riskFlags: string[];
  safetyCriticalMentions: string[];
  recommendation: ImplementationReviewRecommendation;
  summaryPlainEnglish: string;
  suggestedNextBuilderPrompt: string;
  markdownReport: string;
  previewExcerpt: string;
  truncated: boolean;
  weakAlignment: boolean;
  secretSafetyNote: string;
  /** Stage 94: task join metadata when linked from staged Builder Result */
  taskId?: string;
  taskTitle?: string;
  taskArtifactKind?: string;
  sourceTaskCardHash?: string;
}

export interface ImplementationReviewState {
  saved: ImplementationReviewRecord | null;
  statusMessage: string | null;
}

export interface BuilderResultState {
  source: BuilderResultSource;
  responseType: BuilderResultResponseType;
  draftText: string;
  draftLabel: string;
  saved: BuilderResultRecord | null;
  statusMessage: string | null;
}

/** Stage 38: Ollama Builder Plan Mode (plan-only; metadata-only). */
export interface BuilderPlanPromptOptions {
  includeExternalReviewExcerpt: boolean;
  includeBuilderResultExcerpt: boolean;
}

export interface BuilderPlanRecord {
  id: string;
  generatedAt: string;
  modelName: string;
  providerType: ActiveProviderKind;
  baseUrl: string;
  userRequest: string;
  projectName: string | null;
  projectPath: string | null;
  includeExternalReviewExcerpt: boolean;
  includeBuilderResultExcerpt: boolean;
  planText: string;
  previewExcerpt: string;
  recommendation: string | null;
  promptCharCount: number;
  truncated: boolean;
  limitedContext: boolean;
  /** Stage 38A: how the model was chosen. */
  modelSelectionSource?: ModelSelectionSource;
}

export interface BuilderPlanState {
  includeExternalReviewExcerpt: boolean;
  includeBuilderResultExcerpt: boolean;
  saved: BuilderPlanRecord | null;
  statusMessage: string | null;
  busy: boolean;
}

/** Stage 34: text-only Speaker Scripts (rule/template-based; no TTS, no Ollama). */
export type SpeakerScriptRole =
  | "project-foreman"
  | "safety-officer"
  | "review-narrator"
  | "builder-liaison"
  | "release-announcer";

export type SpeakerScriptTone =
  | "plain"
  | "brief"
  | "detailed"
  | "youtube-style"
  | "safety-focused";

export interface SpeakerScriptRecord {
  id: string;
  generatedAt: string;
  role: SpeakerScriptRole;
  roleLabel: string;
  tone: SpeakerScriptTone;
  toneLabel: string;
  projectName: string | null;
  projectPath: string | null;
  limitedContext: boolean;
  markdownReport: string;
  previewExcerpt: string;
  voiceFriendlyScript: string;
  truncated: boolean;
  secretSafetyNote: string;
}

export interface SpeakerScriptState {
  role: SpeakerScriptRole;
  tone: SpeakerScriptTone;
  saved: SpeakerScriptRecord | null;
  statusMessage: string | null;
}

/** Stage 21: app-owned bug / improvement backlog (text-only). */
export type BacklogItemType =
  | "Bug"
  | "UX issue"
  | "Safety concern"
  | "Feature idea"
  | "Packaging issue"
  | "Documentation issue"
  | "Other";

export type BacklogPriority = "Low" | "Medium" | "High" | "Critical";

export type BacklogStatus =
  | "Open"
  | "In review"
  | "Fixed"
  | "Won’t fix"
  | "Later";

export interface BacklogItem {
  id: string;
  title: string;
  type: BacklogItemType;
  priority: BacklogPriority;
  status: BacklogStatus;
  notes: string;
  projectName: string | null;
  projectPath: string | null;
  relatedStage: string | null;
  createdAt: string;
  updatedAt: string;
  riskyPhrases: string[];
  hasRiskySuggestions: boolean;
  charCount: number;
  truncated: boolean;
}

export interface BacklogFilters {
  status: BacklogStatus | "All";
  priority: BacklogPriority | "All";
  type: BacklogItemType | "All";
  projectPath: string | "All" | "Unassigned";
}

export interface BacklogReviewReport {
  generatedAt: string;
  markdownReport: string;
  previewExcerpt: string;
  openCount: number;
  criticalHighCount: number;
  safetyConcernCount: number;
  packagingIssueCount: number;
  suggestedFocus: string;
}

export interface BacklogState {
  draftTitle: string;
  draftType: BacklogItemType;
  draftPriority: BacklogPriority;
  draftStatus: BacklogStatus;
  draftNotes: string;
  draftRelatedStage: string;
  items: BacklogItem[];
  selectedId: string | null;
  selected: BacklogItem | null;
  filters: BacklogFilters;
  filteredItems: BacklogItem[];
  lastReport: BacklogReviewReport | null;
  statusMessage: string | null;
  capNote: string | null;
}

/** Stage 36: Ollama Local AI role selector (metadata-only prompt framing). */
export type LocalAiRoleId =
  | "general-reviewer"
  | "architect-planner"
  | "bug-risk-reviewer"
  | "patch-planner"
  | "test-planner"
  | "ux-reviewer"
  | "safety-reviewer"
  | "project-foreman"
  | "safety-officer"
  | "review-narrator"
  | "builder-liaison"
  | "release-announcer";

/**
 * Stage 38A: role → model mapping keys.
 * Includes all Local AI roles plus Builder Plan Mode, Blueprint Planner, Code Reviewer, and Patch Draft.
 */
export type RoleModelMappingKey =
  | LocalAiRoleId
  | "builder-plan-mode"
  | "blueprint-planner"
  | "code-context-review"
  | "patch-draft";

export interface RoleModelMappingState {
  mappings: Record<RoleModelMappingKey, string>;
  statusMessage: string | null;
}

export interface LocalAiAdvisorResponse {
  createdAt: string;
  modelName: string;
  baseUrl: string;
  promptCharCount: number;
  responseText: string;
  truncatedForPack: boolean;
  /** Stage 36: role used for this response. */
  roleId: LocalAiRoleId;
  roleLabel: string;
  roleCategory: "reviewer-builder" | "speaker-style" | "general";
  /** Stage 38A: how the model was chosen. */
  modelSelectionSource?: ModelSelectionSource;
}

export type ExternalReviewSource =
  | "Qwen Code"
  | "ChatGPT"
  | "Claude"
  | "Gemini"
  | "Grok"
  | "Other";

export type ExternalReviewContextBasis =
  | "project-summary"
  | "review-pack"
  | "qwen-prompt-pack"
  | "patch-review-pack"
  | "unknown";

export interface ExternalReviewRecord {
  id: string;
  source: ExternalReviewSource;
  savedAt: string;
  label: string | null;
  userRequestAtSave: string;
  projectName: string | null;
  projectPath: string | null;
  contextBasis: ExternalReviewContextBasis[];
  reviewText: string;
  riskyPhrases: string[];
  hasRiskySuggestions: boolean;
  limitedContext: boolean;
  charCount: number;
  truncated: boolean;
  /** ISO timestamp of changed-files scan associated at save time, if any. */
  associatedChangedFilesScanAt: string | null;
  /** ISO timestamp of patch review pack associated at save time, if any. */
  associatedPatchPackAt: string | null;
}

export interface ExternalReviewKeywordHit {
  keyword: string;
  reviewIds: string[];
  sources: ExternalReviewSource[];
  count: number;
}

export interface ExternalReviewComparison {
  reviewCount: number;
  sourcesRepresented: ExternalReviewSource[];
  reviewsWithRiskyPhrases: number;
  localAdvisorExists: boolean;
  safeChecksResultExists: boolean;
  keywordHits: ExternalReviewKeywordHit[];
  commonConcernKeywords: string[];
  appearsToMentionApprove: boolean;
  appearsToMentionRevise: boolean;
  appearsToMentionRevert: boolean;
  disagreementDetected: boolean;
  needsHumanDecision: boolean;
  plainEnglish: string;
  methodNote: string;
}

export interface ExternalReviewState {
  source: ExternalReviewSource;
  draftText: string;
  draftLabel: string;
  /** All saved reviews for the current project session (newest first). */
  reviews: ExternalReviewRecord[];
  selectedId: string | null;
  /** Convenience: currently selected review, or null. */
  selected: ExternalReviewRecord | null;
  statusMessage: string | null;
  comparison: ExternalReviewComparison | null;
  capNote: string | null;
}

export interface RecentProjectEntry {
  projectName: string;
  projectPath: string;
  lastOpenedAt: string;
  lastScanAt: string | null;
  lastCheckpointStatus: string | null;
  pathMissing: boolean;
}

export interface SavedSafeCheckSummary {
  savedAt: string;
  kind: string;
  scriptName: string;
  status: SafeCommandStatus;
  exitCode: number | null;
  plainEnglishSummary: string;
  argv: string[];
  durationMs: number | null;
  outputTruncated: boolean;
  combinedOutputPreview: string;
}

export interface SavedCheckpointMeta {
  savedAt: string;
  methodLabel: string;
  plainEnglish: string;
  createdAt: string;
  skippedCount: number;
  isPreUndo: boolean;
  /** Stage 29: enough metadata to verify restore availability (not raw files). */
  id?: string | null;
  method?: CheckpointMethod | null;
  projectName?: string | null;
  projectPath?: string | null;
  branchName?: string | null;
  commitSha?: string | null;
  snapshotDir?: string | null;
  warnings?: string[];
  sizeBytes?: number | null;
  hadUncommittedChanges?: boolean | null;
}

/** Stage 50: one generated markdown handoff file preview. */
export interface ProjectMemoryFilePreview {
  fileName: string;
  content: string;
  truncated: boolean;
  charCount: number;
}

/** Stage 50: generated preview bundle (not yet saved to `.nttc/`). */
export interface ProjectMemoryPreview {
  generatedAt: string;
  files: ProjectMemoryFilePreview[];
  bundleMarkdown: string;
  truncationFlags: string[];
  projectSelected: boolean;
}

/** Stage 80: Project Blueprint Planner — idea intake (planning only). */
export interface BlueprintIntake {
  projectIdea: string;
  projectType: BlueprintProjectType;
  targetUser: BlueprintTargetUser;
  technicalComfort: BlueprintTechnicalComfort;
  buildStyle: BlueprintBuildStyle;
  constraints: string;
  answersClarifications: string;
}

export interface BlueprintPlannerQuestions {
  generatedAt: string;
  markdown: string;
}

export interface BlueprintPlannerPrompt {
  generatedAt: string;
  markdown: string;
}

export interface BlueprintImportedRecord {
  importedAt: string;
  source: BlueprintSource;
  blueprintText: string;
  ideaSummary: string;
  projectType: BlueprintProjectType;
  targetUser: BlueprintTargetUser;
  technicalComfort: BlueprintTechnicalComfort;
  buildStyle: BlueprintBuildStyle;
  sectionsPresent: string[];
  sectionsMissing: string[];
  openQuestionCount: number | null;
  phaseCount: number | null;
  hasPhase1Handoff: boolean;
  hasSuggestedFilePlan: boolean;
  hasValidationPlan: boolean;
  hasSmallModelGuidance: boolean;
  truncationFlag: boolean;
}

export interface BlueprintCompletenessReport {
  generatedAt: string;
  presentSections: string[];
  missingSections: string[];
  weakAreas: string[];
  readiness:
    | "not-ready"
    | "needs-clarification"
    | "ready-for-phase-1"
    | "ready-for-builder-planning-only";
  recommendedNextStep: string;
  markdownReport: string;
}

export interface PlanningDocumentPreviewFile {
  fileName: string;
  relativePath: string;
  content: string;
  truncationFlag: boolean;
}

export interface PlanningDocumentsPreview {
  generatedAt: string;
  files: PlanningDocumentPreviewFile[];
  truncationFlags: string[];
  projectSelected: boolean;
}

export interface PlanningDocumentsSavedRecord {
  savedAt: string;
  filesWritten: string[];
  overwriteConfirmed: boolean;
  truncationFlags: string[];
  generatedAt: string;
}

export interface Phase1BuilderHandoffRecord {
  generatedAt: string;
  markdown: string;
}

/** Stage 86: single blueprint phase task card (planning text only). */
export interface BlueprintPhaseTaskCard {
  id: string;
  title: string;
  phase: string;
  goal: string;
  whyThisMatters: string;
  inputsContext: string;
  likelyFilesModules: string;
  /** Stage 92: planning contract fields (text only). */
  producesCreates?: string;
  consumesDependsOn?: string;
  interfacesContracts?: string;
  whatToBuild: string;
  whatNotToBuildYet: string;
  safetyBoundaries: string;
  smallModelGuidance: string;
  builderPrompt: string;
  validationSteps: string;
  reportBackFormat: string;
  openQuestions: string;
  status: BlueprintPhaseTaskCardStatus;
  quality: BlueprintPhaseTaskCardQuality;
  qualityFlags: string[];
  createdAt: string;
  updatedAt: string;
  markdown: string;
  /** Stage 94: deterministic planning-text fingerprint. */
  taskCardFingerprint?: string;
}

/** Stage 86: generated task card set from saved blueprint. */
export interface BlueprintPhaseTaskCardsRecord {
  generatedAt: string;
  sourceBlueprintImportedAt: string | null;
  planningStyle: PlanningStyleId;
  buildStyle: BlueprintBuildStyle;
  taskCount: number;
  activeTaskId: string | null;
  incompleteBlueprintWarning: boolean;
  missingPhase1Warning: boolean;
  tooManyTasksWarning: boolean;
  cards: BlueprintPhaseTaskCard[];
  allCardsMarkdown: string;
}

/** Stage 86: live session state for blueprint phase task cards. */
export interface BlueprintPhaseTaskCardsState {
  saved: BlueprintPhaseTaskCardsRecord | null;
  statusMessage: string | null;
}

/** Stage 88: Task Card Builder Handoff record (text-only). */
export interface TaskCardBuilderHandoffRecord {
  id: string;
  generatedAt: string;
  selectedTaskId: string;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  readiness: TaskCardBuilderHandoffReadiness;
  recommendation: string;
  stale: boolean;
  copiedAt: string | null;
  tooBroadWarning: boolean;
  sourceBlueprintImportedAt: string | null;
  sourceTaskCardUpdatedAt: string | null;
  markdown: string;
  previewExcerpt: string;
  /** Stage 94: task join-key metadata */
  taskId?: string;
  taskTitle?: string;
  taskPhase?: string;
  taskArtifactKind?: string;
  sourceTaskCardGeneratedAt?: string;
  sourceTaskCardHash?: string;
}
export interface TaskCardBuilderHandoffState {
  saved: TaskCardBuilderHandoffRecord | null;
  selectedTaskId: string | null;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  statusMessage: string | null;
  suggestedNextStatus: string | null;
}

/** Stage 90: saved task implementation report (text-only). */
export interface TaskImplementationReportRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  builderSource: TaskImplementationBuilderSource;
  savedAt: string;
  reportText: string;
  summaryMarkdown: string;
  detectedFilesChanged: string[];
  detectedValidationMentions: string[];
  detectedRisksBlockers: string[];
  detectedSafetyConfirmations: string[];
  missingExpectedSections: string[];
  possibleSecretPatterns: string[];
  savedWithSecretOverride: boolean;
  truncationFlag: boolean;
  markedImplementationReturned: boolean;
  markedReviewed: boolean;
  stale: boolean;
  reportExcerpt: string;
  /** Stage 94: task join-key metadata */
  taskPhase?: string;
  taskArtifactKind?: string;
  sourceTaskCardGeneratedAt?: string;
  sourceTaskCardHash?: string;
  sourceHandoffId?: string;
  sourceHandoffGeneratedAt?: string;
}
export interface TaskImplementationIntakeState {
  selectedTaskId: string | null;
  builderSource: TaskImplementationBuilderSource;
  draftText: string;
  reportsByTaskId: Record<string, TaskImplementationReportRecord>;
  selectedReport: TaskImplementationReportRecord | null;
  statusMessage: string | null;
  suggestedMarkReturned: string | null;
  nextTaskSuggestion: string | null;
  liveParse: TaskImplementationReportParseResult | null;
  hasImplementationReview: boolean;
}

/** Stage 92: saved Blueprint Task Reconciliation report (text-only). */
export interface BlueprintTaskReconciliationRecord {
  id: string;
  generatedAt: string;
  sourceTaskCardsGeneratedAt: string | null;
  taskCardCount: number;
  contractFieldsMissing: boolean;
  missingProducerCount: number;
  duplicateOverlapCount: number;
  monolithRiskCount: number;
  statusInconsistencyCount: number;
  implementationInconsistencyCount: number;
  safetyGapCount: number;
  smallModelGapCount: number;
  recommendation: TaskReconciliationRecommendation;
  stale: boolean;
  markdown: string;
  previewExcerpt: string;
}

/** Stage 92: live session state for Blueprint Task Reconciliation. */
export interface BlueprintTaskReconciliationState {
  saved: BlueprintTaskReconciliationRecord | null;
  statusMessage: string | null;
}

/** Stage 94: saved Task Artifact Index (metadata only). */
export interface TaskArtifactIndexRecord {
  id: string;
  generatedAt: string;
  sourceTaskCardsGeneratedAt: string | null;
  sourceHandoffGeneratedAt: string | null;
  sourceImplementationReportCount: number;
  sourceReconciliationGeneratedAt: string | null;
  sourceBuilderResultSavedAt: string | null;
  taskCount: number;
  linkedArtifactCount: number;
  unlinkedArtifactCount: number;
  staleArtifactCount: number;
  recommendation: import("./taskJoinKeyConstants").TaskArtifactIndexRecommendation;
  filterTaskId: string | null;
  stale: boolean;
  markdown: string;
  previewExcerpt: string;
}

/** Stage 94: live session state for Task Artifact Index. */
export interface TaskArtifactIndexState {
  saved: TaskArtifactIndexRecord | null;
  filterTaskId: string | null;
  statusMessage: string | null;
}

/** Stage 98: saved Architecture Health Report (metadata only). */
export interface ArchitectureHealthRecord {
  id: string;
  generatedAt: string;
  sourceProjectSummaryScannedAt: string | null;
  sourceChangedFilesScannedAt: string | null;
  sourceTaskCardsGeneratedAt: string | null;
  includeTestFiles: boolean;
  includeMarkdownDocs: boolean;
  fileCountScanned: number;
  filesTruncated: boolean;
  blockedCount: number;
  largestFilePath: string | null;
  largestFileLineCount: number;
  criticalCount: number;
  warningCount: number;
  recommendation: import("./architectureHealth/architectureHealthConstants").ArchitectureHealthRecommendation;
  stale: boolean;
  markdown: string;
  previewExcerpt: string;
  refactorSuggestions?: import("./architectureRefactorTasks/buildArchitectureRefactorTaskSuggestions").RefactorTaskCardSuggestion[];
}

/** Stage 102: single architecture refactor task card (planning only). */
export interface ArchitectureRefactorTaskCard {
  id: string;
  title: string;
  refactorTarget: string;
  goal: string;
  whyThisMatters: string;
  currentRisk: string;
  filesLikelyInvolved: string;
  whatToChange: string;
  whatNotToChange: string;
  safetyBoundaries: string;
  smallModelFriendlyArchitecture: string;
  builderPrompt: string;
  validationSteps: string;
  reportBackFormat: string;
  status: import("./architectureRefactorTasks/architectureRefactorTaskConstants").ArchitectureRefactorTaskCardStatus;
  quality: import("./architectureRefactorTasks/architectureRefactorTaskConstants").ArchitectureRefactorTaskCardQuality;
  qualityFlags: string[];
  updatedAt: string;
  markdown: string;
}

/** Stage 102: saved architecture refactor task cards record. */
export interface ArchitectureRefactorTaskCardsRecord {
  id: string;
  generatedAt: string;
  sourceArchitectureHealthGeneratedAt: string | null;
  sourceArchitectureHealthId: string | null;
  sourceReportHash: string | null;
  taskCount: number;
  activeTaskId: string | null;
  stale: boolean;
  cards: ArchitectureRefactorTaskCard[];
  allCardsMarkdown: string;
}

/** Stage 102: live session state for architecture refactor task cards. */
export interface ArchitectureRefactorTaskCardsState {
  saved: ArchitectureRefactorTaskCardsRecord | null;
  statusMessage: string | null;
}

/** Stage 104: Architecture Refactor Builder Handoff record (text-only). */
export interface ArchitectureRefactorTaskBuilderHandoffRecord {
  id: string;
  generatedAt: string;
  selectedTaskId: string;
  taskTitle: string;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  readiness: import("./architectureRefactorTasks/architectureRefactorTaskBuilderHandoffConstants").ArchitectureRefactorTaskBuilderHandoffReadiness;
  recommendation: string;
  stale: boolean;
  copiedAt: string | null;
  tooBroadWarning: boolean;
  sourceArchitectureHealthGeneratedAt: string | null;
  sourceArchitectureHealthId: string | null;
  sourceRefactorTaskUpdatedAt: string | null;
  sourceRefactorCardsGeneratedAt: string | null;
  markdown: string;
  previewExcerpt: string;
}

/** Stage 104: live session state for Architecture Refactor Builder Handoff. */
export interface ArchitectureRefactorTaskBuilderHandoffState {
  saved: ArchitectureRefactorTaskBuilderHandoffRecord | null;
  selectedTaskId: string | null;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  statusMessage: string | null;
  suggestedNextStatus: string | null;
}

/** Stage 106: saved architecture refactor implementation report (text-only). */
export interface ArchitectureRefactorTaskImplementationReportRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  refactorTarget: string;
  builderSource: ArchitectureRefactorImplementationBuilderSource;
  savedAt: string;
  reportText: string;
  summaryMarkdown: string;
  detectedFilesChanged: string[];
  detectedValidationMentions: string[];
  detectedBehaviorPreservationMentions: string[];
  detectedRisksBlockers: string[];
  detectedSafetyConfirmations: string[];
  missingExpectedSections: string[];
  missingBehaviorPreservationChecks: string[];
  possibleSecretPatterns: string[];
  changedFilesScopeWarnings: string[];
  behaviorChangeWarning: boolean;
  savedWithSecretOverride: boolean;
  truncationFlag: boolean;
  markedImplementationReturned: boolean;
  markedReviewed: boolean;
  stale: boolean;
  reportExcerpt: string;
  /** Stage 106: task join-key metadata */
  taskPhase?: string;
  taskArtifactKind?: string;
  sourceTaskCardGeneratedAt?: string;
  sourceTaskCardHash?: string;
  sourceHandoffId?: string;
  sourceHandoffGeneratedAt?: string;
}

/** Stage 106: live session state for Architecture Refactor Implementation Intake. */
export interface ArchitectureRefactorTaskImplementationIntakeState {
  selectedTaskId: string | null;
  builderSource: ArchitectureRefactorImplementationBuilderSource;
  draftText: string;
  reportsByTaskId: Record<string, ArchitectureRefactorTaskImplementationReportRecord>;
  selectedReport: ArchitectureRefactorTaskImplementationReportRecord | null;
  statusMessage: string | null;
  suggestedMarkReturned: string | null;
  nextTaskSuggestion: string | null;
  liveParse: ArchitectureRefactorImplementationReportParseResult | null;
  hasImplementationReview: boolean;
}

/** Stage 98: live session state for Architecture Health Report. */
export interface ArchitectureHealthState {
  saved: ArchitectureHealthRecord | null;
  includeTestFiles: boolean;
  includeMarkdownDocs: boolean;
  busy: boolean;
  statusMessage: string | null;
}

/** Stage 82: Local Planner AI blueprint draft (idea fields only). */
export interface BlueprintPlannerAiRecord {
  id: string;
  generatedAt: string;
  modelName: string;
  providerType: ActiveProviderKind;
  baseUrl: string;
  roleMode: "Blueprint Planner";
  mappingKey: "blueprint-planner";
  responseText: string;
  previewExcerpt: string;
  promptCharCount: number;
  truncatedResponse: boolean;
  modelSelectionSource?: ModelSelectionSource;
  elapsedMs: number;
  sectionsPresent: string[];
  sectionsMissing: string[];
  readinessEstimate: BlueprintCompletenessReport["readiness"] | null;
  plannerQuestionsGenerated: boolean;
  savedAsImportedBlueprint: boolean;
}

export interface BlueprintPlannerAiState {
  saved: BlueprintPlannerAiRecord | null;
  busy: boolean;
  statusMessage: string | null;
}

export interface BlueprintStatusSummary {
  ideaExists: boolean;
  blueprintImported: boolean;
  completenessCheckExists: boolean;
  planningDocsPreviewExists: boolean;
  planningDocsExported: boolean;
  phase1HandoffExists: boolean;
  readinessStatus: string | null;
  localPlannerDraftExists: boolean;
  localPlannerDraftSavedAsBlueprint: boolean;
  localPlannerAiStatus: "idle" | "running" | "ready";
  /** Stage 86 */
  taskCardsExist: boolean;
  activeTaskId: string | null;
  nextTaskId: string | null;
  blockedTaskCount: number;
  readyToSendTaskCount: number;
  implementationReturnedTaskCount: number;
  /** Stage 88 */
  taskBuilderHandoffExists: boolean;
  taskBuilderHandoffSelectedTaskId: string | null;
  taskBuilderHandoffReadiness: TaskCardBuilderHandoffReadiness | null;
  taskBuilderHandoffStale: boolean;
  taskBuilderHandoffCopied: boolean;
  activeTaskStatus: BlueprintPhaseTaskCardStatus | null;
  /** Stage 90 */
  taskImplementationReportCount: number;
  activeTaskHasImplementationReport: boolean;
  activeTaskImplementationReportStale: boolean;
  pendingMarkImplementationReturned: boolean;
  /** Stage 92 */
  taskReconciliationExists: boolean;
  taskReconciliationStale: boolean;
  taskReconciliationRecommendation: TaskReconciliationRecommendation | null;
  taskReconciliationMissingProducers: number;
  taskReconciliationStatusInconsistencyCount: number;
  /** Stage 94 */
  taskArtifactIndexExists: boolean;
  taskArtifactIndexStale: boolean;
  taskArtifactIndexRecommendation: import("./taskJoinKeyConstants").TaskArtifactIndexRecommendation | null;
  taskArtifactIndexUnlinkedCount: number;
  taskArtifactIndexStaleCount: number;
  /** Stage 96 */
  changedFilesScanExists: boolean;
  changedFilesTaskLinkExists: boolean;
  changedFilesTaskLinkStale: boolean;
  changedFilesTaskLinkTaskId: string | null;
  changedFilesTaskLinkScopeWarningCount: number;
  changedFilesUnlinked: boolean;
}

/** Stage 80: live session state for Project Blueprint Planner. */
export interface BlueprintState {
  intake: BlueprintIntake;
  plannerQuestions: BlueprintPlannerQuestions | null;
  plannerPrompt: BlueprintPlannerPrompt | null;
  importedBlueprint: BlueprintImportedRecord | null;
  completenessReport: BlueprintCompletenessReport | null;
  planningDocsPreview: PlanningDocumentsPreview | null;
  planningDocsLastSaved: PlanningDocumentsSavedRecord | null;
  phase1Handoff: Phase1BuilderHandoffRecord | null;
  phaseTaskCards: BlueprintPhaseTaskCardsState;
  taskCardBuilderHandoff: TaskCardBuilderHandoffState;
  taskImplementationIntake: TaskImplementationIntakeState;
  taskReconciliation: BlueprintTaskReconciliationState;
  taskArtifactIndex: TaskArtifactIndexState;
  plannerAi: BlueprintPlannerAiState;
  status: BlueprintStatusSummary;
  statusMessage: string | null;
  busy: boolean;
  draftBlueprintText: string;
  draftBlueprintSource: BlueprintSource;
  pendingOverwriteFiles: string[];
  saveBlockedReason: string | null;
  selectedPreviewFileName: string | null;
}

/** Stage 50: metadata after a confirmed save to `.nttc/`. */
export interface ProjectMemorySavedRecord {
  savedAt: string;
  filesWritten: string[];
  overwriteConfirmed: boolean;
  truncationFlags: string[];
  generatedAt: string;
}

/** Stage 50: live session state for Project Memory export. */
export interface ProjectMemoryState {
  preview: ProjectMemoryPreview | null;
  lastSaved: ProjectMemorySavedRecord | null;
  statusMessage: string | null;
  busy: boolean;
  /** Files that already exist on disk and need overwrite confirmation. */
  pendingOverwriteFiles: string[];
  saveBlockedReason: string | null;
}

/** Stage 52: blocked file during code context listing/preview. */
export interface CodeContextBlockedEntry {
  relativePath: string;
  reason: string;
}

/** Stage 52: selectable safe file candidate. */
export interface CodeContextFileCandidate {
  relativePath: string;
  extension: string;
  sizeBytes: number;
  selected: boolean;
}

/** Stage 52: included file excerpt in generated pack. */
export interface CodeContextIncludedFile {
  relativePath: string;
  linesIncluded: number;
  truncated: boolean;
  warnings: string[];
  content: string;
}

/** Stage 52: generated Code Context Pack (preview/copy only). */
export interface CodeContextPack {
  generatedAt: string;
  userQuestion: string;
  projectSelected: boolean;
  selectedFileCount: number;
  includedFileCount: number;
  blockedFileCount: number;
  estimatedCharacters: number;
  truncated: boolean;
  truncationFlags: string[];
  warningCount: number;
  includedFiles: string[];
  markdownReport: string;
  previewExcerpt: string;
  previewOnlyNote: string;
}

/** Stage 56: last selected Code Question template metadata. */
export interface CodeQuestionTemplateSelection {
  templateId: string;
  templateLabel: string;
  questionText: string;
  selectedAt: string;
}

/** Stage 52: live Code Context Pack builder state. */
export interface CodeContextState {
  candidates: CodeContextFileCandidate[];
  filterQuery: string;
  codeQuestion: string;
  selectedTemplate: CodeQuestionTemplateSelection | null;
  maxLinesPerFile: number;
  maxTotalChars: number;
  selectedCount: number;
  blockedCount: number;
  blockedSamples: CodeContextBlockedEntry[];
  listingTruncated: boolean;
  preview: CodeContextPack | null;
  busy: boolean;
  statusMessage: string | null;
}

/** Stage 54: Local AI response about approved Code Context Pack only. */
export interface CodeContextAiRecord {
  id: string;
  generatedAt: string;
  modelName: string;
  providerType: ActiveProviderKind;
  baseUrl: string;
  roleMode: string;
  mappingKey: "code-context-review";
  userQuestion: string;
  contextPackGeneratedAt: string;
  selectedFileCount: number;
  warningCount: number;
  truncated: boolean;
  responseText: string;
  previewExcerpt: string;
  recommendedNextStep: string | null;
  promptCharCount: number;
  truncatedResponse: boolean;
  modelSelectionSource?: ModelSelectionSource;
  questionTemplateId?: string | null;
  questionTemplateLabel?: string | null;
}

export interface CodeContextAiState {
  saved: CodeContextAiRecord | null;
  busy: boolean;
  statusMessage: string | null;
}

/** Stage 69: planning style preset (generated guidance only). */
export type PlanningStyleId = "default" | "small-model-friendly";

export interface PlanningStyleState {
  style: PlanningStyleId;
  statusMessage: string | null;
}

/** Stage 76: Reports tab UI preferences (collapse state). */
export interface ReportsUiState {
  panelCollapse: Record<string, boolean>;
}

/** Stage 67: manually imported outside patch draft (text only; no apply). */
export type ImportedPatchDraftSource =
  | "Cursor"
  | "Codex"
  | "Claude"
  | "ChatGPT"
  | "Grok"
  | "Qwen"
  | "Human programmer"
  | "Other";

export type ImportedPatchDraftType =
  | "Patch draft"
  | "Diff-like draft"
  | "Code snippet proposal"
  | "Implementation plan"
  | "Revision request"
  | "Unknown";

export interface ImportedPatchDraftContextSnapshot {
  codeContextPackExisted: boolean;
  codeAiResponseExisted: boolean;
  nttcPatchDraftExisted: boolean;
  patchDraftSafetyReviewExisted: boolean;
  safetyBackupVerified: boolean;
  decisionReportExisted: boolean;
  implementationReviewExisted: boolean;
  backlogWarningsExisted: boolean;
}

export interface ImportedPatchDraftRecord {
  id: string;
  importedAt: string;
  source: ImportedPatchDraftSource;
  draftType: ImportedPatchDraftType;
  userQuestion: string;
  draftText: string;
  previewExcerpt: string;
  riskPhrases: string[];
  likelyFilesAreas: string[];
  riskPhraseCount: number;
  truncatedImport: boolean;
  contextAtImport: ImportedPatchDraftContextSnapshot;
}

export interface ImportedPatchDraftState {
  source: ImportedPatchDraftSource;
  draftType: ImportedPatchDraftType;
  draftText: string;
  saved: ImportedPatchDraftRecord | null;
  statusMessage: string | null;
}

export type PatchDraftSafetyReviewTargetKind =
  | "nttc-patch-draft"
  | "imported-patch-draft";

/** Stage 58: Local AI patch draft from approved Code Context Pack only (no apply). */
export interface PatchDraftRecord {
  id: string;
  generatedAt: string;
  modelName: string;
  providerType: ActiveProviderKind;
  baseUrl: string;
  roleMode: string;
  mappingKey: "patch-draft";
  userQuestion: string;
  contextPackGeneratedAt: string;
  selectedFileCount: number;
  warningCount: number;
  truncated: boolean;
  draftText: string;
  previewExcerpt: string;
  recommendation: string | null;
  promptCharCount: number;
  truncatedResponse: boolean;
  modelSelectionSource?: ModelSelectionSource;
  questionTemplateId?: string | null;
  questionTemplateLabel?: string | null;
  includeCodeAiResponseExcerpt: boolean;
  includeBuilderPlanDecisionExcerpt: boolean;
  includeImplementationReviewExcerpt: boolean;
}

export interface PatchDraftState {
  includeCodeAiResponseExcerpt: boolean;
  includeBuilderPlanDecisionExcerpt: boolean;
  includeImplementationReviewExcerpt: boolean;
  saved: PatchDraftRecord | null;
  busy: boolean;
  statusMessage: string | null;
  /** Stage 63: last Patch Draft failure (timeout/error) for Safety Review follow-up. */
  lastFailureMessage: string | null;
  lastFailureAt: string | null;
}

/** Stage 63: long-running local AI request progress (metadata only). */
export type LocalAiProgressMode =
  | "local-ai-role"
  | "builder-plan-mode"
  | "blueprint-planner"
  | "code-context-review"
  | "patch-draft-mode";

export interface LocalAiProgressState {
  active: boolean;
  mode: LocalAiProgressMode;
  label: string;
  modelName: string;
  baseUrl: string;
  startedAt: string;
}

/** Stage 60: rule-based Patch Draft Safety Review (no Ollama; no apply). */
export type PatchDraftSafetyReviewRecommendation =
  | "Safe to send to outside builder for review"
  | "Ask local AI for a narrower patch draft"
  | "Select more code context first"
  | "Ask outside builder for a plan first"
  | "Run Build/Test Checks first"
  | "Create/verify Safety Backup first"
  | "Do not proceed yet";

export interface PatchDraftSafetyReviewRecord {
  id: string;
  generatedAt: string;
  sourcePatchDraftGeneratedAt: string;
  sourcePatchDraftId: string;
  /** Stage 67: which draft was reviewed. */
  reviewTargetKind: PatchDraftSafetyReviewTargetKind;
  reviewTargetLabel: string;
  importedSource: ImportedPatchDraftSource | null;
  importedDraftType: ImportedPatchDraftType | null;
  markdownReport: string;
  previewExcerpt: string;
  recommendation: PatchDraftSafetyReviewRecommendation;
  summaryPlainEnglish: string;
  suggestedNextPrompt: string;
  safetyFlagCount: number;
  missingSafeguardCount: number;
  alignmentWarningCount: number;
  truncatedInput: boolean;
  truncatedReview: boolean;
  secretSafetyNote: string;
}

export interface PatchDraftSafetyReviewState {
  saved: PatchDraftSafetyReviewRecord | null;
  statusMessage: string | null;
  /** Stage 67: user-selected review target when both drafts may exist. */
  reviewTarget: PatchDraftSafetyReviewTargetKind;
}

/** Stage 71: rule-based External Patch Draft Comparison (no AI; no apply). */
export type ExternalPatchDraftComparisonRiskLevel =
  | "Low"
  | "Medium"
  | "High"
  | "Blocked / Do not proceed";

export type ExternalPatchDraftComparisonRecommendation =
  | "Do not proceed yet"
  | "Ask outside builder for a narrower plan"
  | "Ask local AI for a narrower patch draft"
  | "Generate Builder Prompt with constraints"
  | "Safe to send to outside builder for review only"
  | "Ready for manual implementation review, not apply";

export interface ExternalPatchDraftComparisonRecord {
  id: string;
  generatedAt: string;
  planningStyle: PlanningStyleId;
  nttcPatchDraftExisted: boolean;
  importedPatchDraftExisted: boolean;
  importedSource: ImportedPatchDraftSource | null;
  importedDraftType: ImportedPatchDraftType | null;
  importedImportedAt: string | null;
  codeContextAiExisted: boolean;
  patchDraftSafetyReviewExisted: boolean;
  builderPlanExisted: boolean;
  builderPlanComparisonExisted: boolean;
  decisionReportExisted: boolean;
  implementationReviewExisted: boolean;
  safetyBackupVerified: boolean;
  partialComparison: boolean;
  comparisonStatus: string;
  strongestAgreement: string;
  biggestConflict: string;
  riskLevel: ExternalPatchDraftComparisonRiskLevel;
  recommendation: ExternalPatchDraftComparisonRecommendation;
  agreementItems: string[];
  conflictItems: string[];
  missingSafeguards: string[];
  sharedAreas: string[];
  nttcOnlyAreas: string[];
  importedOnlyAreas: string[];
  safetyFlags: string[];
  missingInputs: string[];
  summaryPlainEnglish: string;
  suggestedNextBuilderPrompt: string;
  markdownReport: string;
  previewExcerpt: string;
  truncated: boolean;
  draftTextTruncated: boolean;
  secretSafetyNote: string;
}

export interface ExternalPatchDraftComparisonState {
  saved: ExternalPatchDraftComparisonRecord | null;
  statusMessage: string | null;
}

/** Stage 73: rule-based Builder Handoff Export (text-only; no apply). */
export type BuilderHandoffTarget =
  | "cursor"
  | "codex"
  | "claude"
  | "chatgpt"
  | "grok"
  | "qwen"
  | "human-programmer"
  | "generic-builder";

export type BuilderHandoffStrictness =
  | "conservative"
  | "normal"
  | "fast-small-patch";

export type BuilderHandoffRecommendation =
  | "Do not send yet"
  | "Send only for planning"
  | "Send to outside builder for review only"
  | "Send to builder for narrow implementation"
  | "Ready for human review, not apply";

export interface BuilderHandoffExportRecord {
  id: string;
  generatedAt: string;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  planningStyle: PlanningStyleId;
  recommendation: BuilderHandoffRecommendation;
  missingContextCount: number;
  missingContextItems: string[];
  safetyStatusSummary: string;
  safetyBackupVerified: boolean;
  buildTestStatus: string | null;
  nttcPatchDraftExisted: boolean;
  importedPatchDraftExisted: boolean;
  patchDraftSafetyReviewExisted: boolean;
  externalPatchDraftComparisonExisted: boolean;
  builderPlanExisted: boolean;
  builderPlanComparisonExisted: boolean;
  decisionReportExisted: boolean;
  implementationReviewExisted: boolean;
  codeContextPackExisted: boolean;
  codeContextAiExisted: boolean;
  projectMemorySaved: boolean;
  markdownReport: string;
  previewExcerpt: string;
  truncated: boolean;
}

export interface BuilderHandoffExportState {
  saved: BuilderHandoffExportRecord | null;
  statusMessage: string | null;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
}

export interface ProjectHistoryRecord {
  projectName: string;
  projectPath: string;
  updatedAt: string;
  userRequest: string;
  projectSummary: ProjectScanResult | null;
  reviewPack: OutsideReviewPack | null;
  patchReviewPack: PatchReviewPack | null;
  changedFilesScan: ChangedFilesScanResult | null;
  qwenPromptPack: QwenPromptPack | null;
  advisorResponse: LocalAiAdvisorResponse | null;
  /** Stage 17: multiple external reviews (newest first). */
  externalReviews: ExternalReviewRecord[];
  /** @deprecated Prefer externalReviews; kept for older history files during load. */
  externalReview?: ExternalReviewRecord | null;
  lastSafeCheck: SavedSafeCheckSummary | null;
  lastCheckpointMeta: SavedCheckpointMeta | null;
  decisionReport: DecisionReport | null;
  builderPrompt: BuilderPromptPack | null;
  lastRecommendedNextAction: RecommendedNextAction | null;
  /** Stage 19: latest pasted builder result (text-only). */
  builderResult: BuilderResultRecord | null;
  /** Stage 34: latest text-only Speaker Script. */
  speakerScript: SpeakerScriptRecord | null;
  /** Stage 36: last selected Local AI role for this project. */
  localAiRole: LocalAiRoleId | null;
  /** Stage 38: latest Ollama Builder Plan (plan-only). */
  builderPlan: BuilderPlanRecord | null;
  /** Stage 40: latest Builder Plan Comparison Report. */
  builderPlanComparison: BuilderPlanComparisonRecord | null;
  /** Stage 42: latest Implementation Review Report. */
  implementationReview: ImplementationReviewRecord | null;
  truncationNotes: string[];
  /** Stage 50: last Project Memory preview + save metadata (truncated; no raw source). */
  projectMemoryPreview: ProjectMemoryPreview | null;
  projectMemoryLastSaved: ProjectMemorySavedRecord | null;
  /** Stage 52: Code Context Pack preview state (truncated; no blocked secret bodies). */
  codeContextSelectedPaths: string[];
  codeContextQuestion: string;
  codeContextQuestionTemplate: CodeQuestionTemplateSelection | null;
  codeContextMaxLinesPerFile: number | null;
  codeContextMaxTotalChars: number | null;
  codeContextPreview: CodeContextPack | null;
  /** Stage 54: latest Local AI code review response (approved pack only). */
  codeContextAiResponse: CodeContextAiRecord | null;
  /** Stage 58: latest Patch Draft (no apply). */
  patchDraftResponse: PatchDraftRecord | null;
  /** Stage 60: latest Patch Draft Safety Review (rule-based). */
  patchDraftSafetyReview: PatchDraftSafetyReviewRecord | null;
  /** Stage 67: latest manually imported patch draft. */
  importedPatchDraft: ImportedPatchDraftRecord | null;
  /** Stage 71: latest External Patch Draft Comparison. */
  externalPatchDraftComparison: ExternalPatchDraftComparisonRecord | null;
  /** Stage 73: latest Builder Handoff Pack. */
  builderHandoffExport: BuilderHandoffExportRecord | null;
  /** Stage 80: Project Blueprint Planner state (planning docs only). */
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
  blueprintTaskImplementationReports: Record<string, TaskImplementationReportRecord> | null;
  blueprintTaskImplementationSelectedTaskId: string | null;
  blueprintTaskImplementationBuilderSource: TaskImplementationBuilderSource | null;
  blueprintTaskReconciliation: BlueprintTaskReconciliationRecord | null;
  blueprintTaskArtifactIndex: TaskArtifactIndexRecord | null;
  changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  changedFilesTaskLinkSelectedTaskId: string | null;
  architectureHealth: ArchitectureHealthRecord | null;
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
}

export interface HistoryUiState {
  loaded: boolean;
  recentProjects: RecentProjectEntry[];
  currentProjectHistory: ProjectHistoryRecord | null;
  statusMessage: string | null;
  warning: string | null;
  privacyNote: string;
}

export interface AppSnapshot {
  safety: SafetyGateStatus;
  provider: ProviderStatus;
  providerSettings: ProviderSettings;
  actionLog: ActionLogEntry[];
  projectSummary: ProjectScanResult | null;
  /** True when the visible summary was restored from app history, not a fresh scan. */
  summaryIsFromHistory: boolean;
  userRequest: string;
  reviewPack: OutsideReviewPack | null;
  changedFiles: ChangedFilesState;
  latestCheckpoint: CheckpointRecord | null;
  checkpointBusy: boolean;
  checkpointStatusMessage: string | null;
  /** Stage 29: distinguishes history record vs verified restorable backup. */
  checkpointAvailability: CheckpointAvailabilityState;
  advisorResponse: LocalAiAdvisorResponse | null;
  advisorBusy: boolean;
  advisorStatusMessage: string | null;
  /** Stage 36: selected Local AI role (prompt framing only). */
  localAiRole: LocalAiRoleId;
  safeChecks: SafeChecksState;
  qwen: QwenInspectState;
  externalReview: ExternalReviewState;
  builderResult: BuilderResultState;
  speakerScript: SpeakerScriptState;
  builderPlan: BuilderPlanState;
  /** Stage 40: Builder Plan Comparison (rule-based). */
  builderPlanComparison: BuilderPlanComparisonState;
  /** Stage 42: Implementation Review (rule-based). */
  implementationReview: ImplementationReviewState;
  /** Stage 38A: cached installed Ollama models from /api/tags. */
  installedModels: InstalledOllamaModelsState;
  /** Stage 38A: role → model mappings. */
  roleModelMapping: RoleModelMappingState;
  backlog: BacklogState;
  decision: DecisionState;
  /** Stage 50: controlled `.nttc/` markdown handoff export. */
  projectMemory: ProjectMemoryState;
  /** Stage 52: Code Context Pack builder (preview/copy only). */
  codeContext: CodeContextState;
  /** Stage 54: Ask Local AI About Selected Code. */
  codeContextAi: CodeContextAiState;
  /** Stage 58: Patch Draft Mode — No Apply. */
  patchDraft: PatchDraftState;
  /** Stage 60: Patch Draft Safety Review (rule-based). */
  patchDraftSafetyReview: PatchDraftSafetyReviewState;
  /** Stage 67: manual outside patch draft import. */
  importedPatchDraft: ImportedPatchDraftState;
  /** Stage 71: External Patch Draft Comparison (rule-based). */
  externalPatchDraftComparison: ExternalPatchDraftComparisonState;
  /** Stage 73: Builder Handoff Export (text-only). */
  builderHandoffExport: BuilderHandoffExportState;
  /** Stage 80: Project Blueprint Planner (planning documents only). */
  blueprint: BlueprintState;
  /** Stage 69: Small-Model Friendly Architecture planning preset. */
  planningStyle: PlanningStyleState;
  /** Stage 76: Reports tab collapse preferences. */
  reportsUi: ReportsUiState;
  /** Stage 98: Architecture Health / Monolith Risk Report (metadata only). */
  architectureHealth: ArchitectureHealthState;
  /** Stage 102: Architecture Refactor Task Cards (planning only). */
  architectureRefactorTaskCards: ArchitectureRefactorTaskCardsState;
  /** Stage 104: Architecture Refactor Builder Handoff (text-only). */
  architectureRefactorTaskBuilderHandoff: ArchitectureRefactorTaskBuilderHandoffState;
  /** Stage 106: Architecture Refactor Implementation Intake (text-only). */
  architectureRefactorTaskImplementationIntake: ArchitectureRefactorTaskImplementationIntakeState;
  /** Stage 63: elapsed-time progress for long-running local AI requests. */
  localAiProgress: LocalAiProgressState | null;
  /** Stage 65: persistent Ollama status bubble (reachability only). */
  ollamaStatus: OllamaStatusState;
  history: HistoryUiState;
}

export const IPC_CHANNELS = {
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
  setPlanningStyle: "nttc:set-planning-style",
  setReportsPanelCollapsed: "nttc:set-reports-panel-collapsed",
  applyFastDraftSetup: "nttc:apply-fast-draft-setup",
  subscribeLog: "nttc:log-updated",
  subscribeSnapshot: "nttc:snapshot-updated",
} as const;

export interface NttcApi {
  getSnapshot: () => Promise<AppSnapshot>;
  selectProjectFolder: () => Promise<AppSnapshot>;
  clearProject: () => Promise<AppSnapshot>;
  checkPath: (candidatePath: string) => Promise<PathCheckResult>;
  logPlaceholderAction: (buttonLabel: string) => Promise<AppSnapshot>;
  logUiAction: (
    level: ActionLogLevel,
    message: string,
    detail?: string,
  ) => Promise<AppSnapshot>;
  summarizeProject: () => Promise<AppSnapshot>;
  recordCopySummary: () => Promise<AppSnapshot>;
  setUserRequest: (text: string) => Promise<AppSnapshot>;
  generateReviewPack: () => Promise<AppSnapshot>;
  recordCopyReviewPack: () => Promise<AppSnapshot>;
  scanChangedFiles: () => Promise<AppSnapshot>;
  generatePatchReviewPack: () => Promise<AppSnapshot>;
  recordCopyPatchReviewPack: () => Promise<AppSnapshot>;
  generateDecisionReport: () => Promise<AppSnapshot>;
  recordCopyDecisionReport: () => Promise<AppSnapshot>;
  generateBuilderPrompt: () => Promise<AppSnapshot>;
  recordCopyBuilderPrompt: () => Promise<AppSnapshot>;
  createCheckpoint: () => Promise<AppSnapshot>;
  undoLastCheckpoint: () => Promise<AppSnapshot>;
  verifyCheckpoint: () => Promise<AppSnapshot>;
  updateProviderSettings: (settings: Partial<ProviderSettings>) => Promise<AppSnapshot>;
  testProviderConnection: () => Promise<AppSnapshot>;
  checkOllamaStatus: () => Promise<AppSnapshot>;
  refreshInstalledModels: () => Promise<AppSnapshot>;
  setRoleModelMapping: (
    roleKey: RoleModelMappingKey,
    modelName: string,
  ) => Promise<AppSnapshot>;
  suggestRoleModelDefaults: () => Promise<AppSnapshot>;
  askLocalAi: () => Promise<AppSnapshot>;
  setLocalAiRole: (role: LocalAiRoleId) => Promise<AppSnapshot>;
  setBuilderPlanIncludeExternal: (include: boolean) => Promise<AppSnapshot>;
  setBuilderPlanIncludeBuilderResult: (include: boolean) => Promise<AppSnapshot>;
  generateBuilderPlan: () => Promise<AppSnapshot>;
  recordCopyBuilderPlan: () => Promise<AppSnapshot>;
  recordCopyAdvisorResponse: () => Promise<AppSnapshot>;
  runSafeCheck: (kind: SafeCheckKind) => Promise<AppSnapshot>;
  cancelSafeCheck: () => Promise<AppSnapshot>;
  recordCopyCommandOutput: () => Promise<AppSnapshot>;
  testQwenCli: () => Promise<AppSnapshot>;
  generateQwenPromptPack: () => Promise<AppSnapshot>;
  recordCopyQwenPromptPack: () => Promise<AppSnapshot>;
  recordCopyQwenReport: () => Promise<AppSnapshot>;
  setExternalReviewSource: (source: ExternalReviewSource) => Promise<AppSnapshot>;
  setExternalReviewDraft: (text: string) => Promise<AppSnapshot>;
  setExternalReviewLabel: (label: string) => Promise<AppSnapshot>;
  saveExternalReview: () => Promise<AppSnapshot>;
  selectExternalReview: (reviewId: string) => Promise<AppSnapshot>;
  deleteExternalReview: (reviewId: string) => Promise<AppSnapshot>;
  clearExternalReview: () => Promise<AppSnapshot>;
  recordCopyExternalReview: (reviewId?: string) => Promise<AppSnapshot>;
  setBuilderResultSource: (source: BuilderResultSource) => Promise<AppSnapshot>;
  setBuilderResultResponseType: (
    responseType: BuilderResultResponseType,
  ) => Promise<AppSnapshot>;
  setBuilderResultDraft: (text: string) => Promise<AppSnapshot>;
  setBuilderResultLabel: (label: string) => Promise<AppSnapshot>;
  saveBuilderResult: () => Promise<AppSnapshot>;
  clearBuilderResult: () => Promise<AppSnapshot>;
  recordCopyBuilderResult: () => Promise<AppSnapshot>;
  generateBuilderPlanComparison: () => Promise<AppSnapshot>;
  recordCopyBuilderPlanComparison: () => Promise<AppSnapshot>;
  generateImplementationReview: () => Promise<AppSnapshot>;
  recordCopyImplementationReview: () => Promise<AppSnapshot>;
  setSpeakerScriptRole: (role: SpeakerScriptRole) => Promise<AppSnapshot>;
  setSpeakerScriptTone: (tone: SpeakerScriptTone) => Promise<AppSnapshot>;
  generateSpeakerScript: () => Promise<AppSnapshot>;
  recordCopySpeakerScript: () => Promise<AppSnapshot>;
  setBacklogDraftTitle: (title: string) => Promise<AppSnapshot>;
  setBacklogDraftType: (type: BacklogItemType) => Promise<AppSnapshot>;
  setBacklogDraftPriority: (priority: BacklogPriority) => Promise<AppSnapshot>;
  setBacklogDraftStatus: (status: BacklogStatus) => Promise<AppSnapshot>;
  setBacklogDraftNotes: (notes: string) => Promise<AppSnapshot>;
  setBacklogDraftRelatedStage: (stage: string) => Promise<AppSnapshot>;
  setBacklogFilters: (filters: Partial<BacklogFilters>) => Promise<AppSnapshot>;
  saveBacklogItem: () => Promise<AppSnapshot>;
  updateBacklogItem: () => Promise<AppSnapshot>;
  selectBacklogItem: (itemId: string) => Promise<AppSnapshot>;
  deleteBacklogItem: (itemId: string) => Promise<AppSnapshot>;
  recordCopyBacklogItem: (itemId?: string) => Promise<AppSnapshot>;
  generateBacklogReport: () => Promise<AppSnapshot>;
  recordCopyBacklogReport: () => Promise<AppSnapshot>;
  openRecentProject: (projectPath: string) => Promise<AppSnapshot>;
  clearRecentProjects: () => Promise<AppSnapshot>;
  clearProjectHistory: () => Promise<AppSnapshot>;
  saveSessionHistory: () => Promise<AppSnapshot>;
  generateProjectMemoryPreview: () => Promise<AppSnapshot>;
  saveProjectMemoryFiles: (confirmOverwrite: boolean) => Promise<AppSnapshot>;
  recordCopyProjectMemoryBundle: () => Promise<AppSnapshot>;
  refreshCodeContextFileList: () => Promise<AppSnapshot>;
  setCodeContextFilter: (query: string) => Promise<AppSnapshot>;
  setCodeContextFileSelected: (
    relativePath: string,
    selected: boolean,
  ) => Promise<AppSnapshot>;
  setCodeContextQuestion: (question: string) => Promise<AppSnapshot>;
  applyCodeQuestionTemplate: (
    templateId: string,
    mode?: "append" | "replace",
  ) => Promise<AppSnapshot>;
  clearCodeContextQuestion: () => Promise<AppSnapshot>;
  setCodeContextMaxLinesPerFile: (maxLines: number) => Promise<AppSnapshot>;
  setCodeContextMaxTotalChars: (maxChars: number) => Promise<AppSnapshot>;
  clearCodeContextSelection: () => Promise<AppSnapshot>;
  generateCodeContextPreview: () => Promise<AppSnapshot>;
  recordCopyCodeContextPack: () => Promise<AppSnapshot>;
  askLocalAiAboutCodeContext: () => Promise<AppSnapshot>;
  recordCopyCodeContextAiResponse: () => Promise<AppSnapshot>;
  setPatchDraftIncludeCodeAi: (include: boolean) => Promise<AppSnapshot>;
  setPatchDraftIncludeBuilderPlanDecision: (include: boolean) => Promise<AppSnapshot>;
  setPatchDraftIncludeImplementationReview: (include: boolean) => Promise<AppSnapshot>;
  generatePatchDraft: () => Promise<AppSnapshot>;
  recordCopyPatchDraft: () => Promise<AppSnapshot>;
  generatePatchDraftSafetyReview: () => Promise<AppSnapshot>;
  recordCopyPatchDraftSafetyReview: () => Promise<AppSnapshot>;
  setPatchDraftSafetyReviewTarget: (
    target: PatchDraftSafetyReviewTargetKind,
  ) => Promise<AppSnapshot>;
  setImportedPatchDraftSource: (
    source: ImportedPatchDraftSource,
  ) => Promise<AppSnapshot>;
  setImportedPatchDraftType: (
    draftType: ImportedPatchDraftType,
  ) => Promise<AppSnapshot>;
  setImportedPatchDraftDraft: (draftText: string) => Promise<AppSnapshot>;
  saveImportedPatchDraft: (allowSecretOverride?: boolean) => Promise<AppSnapshot>;
  clearImportedPatchDraft: () => Promise<AppSnapshot>;
  recordCopyImportedPatchDraft: () => Promise<AppSnapshot>;
  generateExternalPatchDraftComparison: () => Promise<AppSnapshot>;
  recordCopyExternalPatchDraftComparison: () => Promise<AppSnapshot>;
  clearExternalPatchDraftComparison: () => Promise<AppSnapshot>;
  setBuilderHandoffTarget: (target: BuilderHandoffTarget) => Promise<AppSnapshot>;
  setBuilderHandoffStrictness: (
    strictness: BuilderHandoffStrictness,
  ) => Promise<AppSnapshot>;
  generateBuilderHandoffExport: () => Promise<AppSnapshot>;
  recordCopyBuilderHandoffExport: () => Promise<AppSnapshot>;
  clearBuilderHandoffExport: () => Promise<AppSnapshot>;
  setBlueprintIntake: (patch: Partial<BlueprintIntake>) => Promise<AppSnapshot>;
  generateBlueprintPlannerQuestions: () => Promise<AppSnapshot>;
  generateBlueprintPlannerPrompt: () => Promise<AppSnapshot>;
  setBlueprintDraftSource: (source: BlueprintSource) => Promise<AppSnapshot>;
  setBlueprintDraftText: (text: string) => Promise<AppSnapshot>;
  saveImportedBlueprint: () => Promise<AppSnapshot>;
  clearImportedBlueprint: () => Promise<AppSnapshot>;
  checkBlueprintCompleteness: () => Promise<AppSnapshot>;
  previewBlueprintPlanningDocuments: () => Promise<AppSnapshot>;
  saveBlueprintPlanningDocuments: (confirmOverwrite: boolean) => Promise<AppSnapshot>;
  generateBlueprintPhase1Handoff: () => Promise<AppSnapshot>;
  setBlueprintPreviewFile: (fileName: string | null) => Promise<AppSnapshot>;
  recordCopyBlueprintPlannerQuestions: () => Promise<AppSnapshot>;
  recordCopyBlueprintPlannerPrompt: () => Promise<AppSnapshot>;
  recordCopyImportedBlueprint: () => Promise<AppSnapshot>;
  recordCopyBlueprintPhase1Handoff: () => Promise<AppSnapshot>;
  askLocalPlannerAi: () => Promise<AppSnapshot>;
  recordCopyBlueprintPlannerAiDraft: () => Promise<AppSnapshot>;
  saveBlueprintPlannerDraftAsImported: () => Promise<AppSnapshot>;
  generateBlueprintPhaseTaskCards: () => Promise<AppSnapshot>;
  clearBlueprintPhaseTaskCards: () => Promise<AppSnapshot>;
  setBlueprintPhaseTaskCardStatus: (
    taskId: string,
    status: BlueprintPhaseTaskCardStatus,
  ) => Promise<AppSnapshot>;
  resetBlueprintPhaseTaskCardStatus: (taskId: string) => Promise<AppSnapshot>;
  setBlueprintActivePhaseTaskCard: (taskId: string) => Promise<AppSnapshot>;
  recordCopyBlueprintPhaseTaskCard: (taskId: string) => Promise<AppSnapshot>;
  recordCopyAllBlueprintPhaseTaskCards: () => Promise<AppSnapshot>;
  setTaskCardBuilderHandoffSelectedTask: (taskId: string) => Promise<AppSnapshot>;
  setTaskCardBuilderHandoffTarget: (
    target: BuilderHandoffTarget,
  ) => Promise<AppSnapshot>;
  setTaskCardBuilderHandoffStrictness: (
    strictness: BuilderHandoffStrictness,
  ) => Promise<AppSnapshot>;
  generateTaskCardBuilderHandoff: () => Promise<AppSnapshot>;
  clearTaskCardBuilderHandoff: () => Promise<AppSnapshot>;
  recordCopyTaskCardBuilderHandoff: () => Promise<AppSnapshot>;
  setTaskImplementationIntakeSelectedTask: (taskId: string) => Promise<AppSnapshot>;
  setTaskImplementationIntakeBuilderSource: (
    source: TaskImplementationBuilderSource,
  ) => Promise<AppSnapshot>;
  setTaskImplementationIntakeDraftText: (text: string) => Promise<AppSnapshot>;
  saveTaskImplementationReport: (allowSecretOverride?: boolean) => Promise<AppSnapshot>;
  clearTaskImplementationReport: () => Promise<AppSnapshot>;
  recordCopyTaskImplementationReport: () => Promise<AppSnapshot>;
  markTaskImplementationReturned: () => Promise<AppSnapshot>;
  markTaskImplementationReviewed: (
    confirmWithoutReview?: boolean,
  ) => Promise<AppSnapshot>;
  stageTaskImplementationReportForReview: () => Promise<AppSnapshot>;
  generateBlueprintTaskReconciliation: () => Promise<AppSnapshot>;
  clearBlueprintTaskReconciliation: () => Promise<AppSnapshot>;
  recordCopyBlueprintTaskReconciliation: () => Promise<AppSnapshot>;
  generateTaskArtifactIndex: () => Promise<AppSnapshot>;
  clearTaskArtifactIndex: () => Promise<AppSnapshot>;
  recordCopyTaskArtifactIndex: () => Promise<AppSnapshot>;
  setTaskArtifactIndexFilter: (taskId: string | null) => Promise<AppSnapshot>;
  setChangedFilesTaskLinkSelectedTask: (taskId: string) => Promise<AppSnapshot>;
  linkChangedFilesToTask: () => Promise<AppSnapshot>;
  clearChangedFilesTaskLink: () => Promise<AppSnapshot>;
  generateArchitectureHealthReport: () => Promise<AppSnapshot>;
  clearArchitectureHealthReport: () => Promise<AppSnapshot>;
  recordCopyArchitectureHealthReport: () => Promise<AppSnapshot>;
  setArchitectureHealthIncludeTestFiles: (include: boolean) => Promise<AppSnapshot>;
  setArchitectureHealthIncludeMarkdownDocs: (include: boolean) => Promise<AppSnapshot>;
  generateArchitectureRefactorTaskCards: () => Promise<AppSnapshot>;
  clearArchitectureRefactorTaskCards: () => Promise<AppSnapshot>;
  setArchitectureRefactorTaskCardStatus: (
    taskId: string,
    status: import("./architectureRefactorTasks/architectureRefactorTaskConstants").ArchitectureRefactorTaskCardStatus,
  ) => Promise<AppSnapshot>;
  resetArchitectureRefactorTaskCardStatus: (taskId: string) => Promise<AppSnapshot>;
  recordCopyArchitectureRefactorTaskCard: (taskId: string) => Promise<AppSnapshot>;
  recordCopyAllArchitectureRefactorTaskCards: () => Promise<AppSnapshot>;
  setArchitectureRefactorTaskBuilderHandoffSelectedTask: (
    taskId: string,
  ) => Promise<AppSnapshot>;
  setArchitectureRefactorTaskBuilderHandoffTarget: (
    target: BuilderHandoffTarget,
  ) => Promise<AppSnapshot>;
  setArchitectureRefactorTaskBuilderHandoffStrictness: (
    strictness: BuilderHandoffStrictness,
  ) => Promise<AppSnapshot>;
  generateArchitectureRefactorTaskBuilderHandoff: () => Promise<AppSnapshot>;
  clearArchitectureRefactorTaskBuilderHandoff: () => Promise<AppSnapshot>;
  recordCopyArchitectureRefactorTaskBuilderHandoff: () => Promise<AppSnapshot>;
  setArchitectureRefactorTaskImplementationIntakeSelectedTask: (
    taskId: string,
  ) => Promise<AppSnapshot>;
  setArchitectureRefactorTaskImplementationIntakeBuilderSource: (
    source: import("./architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants").ArchitectureRefactorImplementationBuilderSource,
  ) => Promise<AppSnapshot>;
  setArchitectureRefactorTaskImplementationIntakeDraftText: (
    text: string,
  ) => Promise<AppSnapshot>;
  saveArchitectureRefactorTaskImplementationReport: (
    allowSecretOverride?: boolean,
  ) => Promise<AppSnapshot>;
  clearArchitectureRefactorTaskImplementationReport: () => Promise<AppSnapshot>;
  recordCopyArchitectureRefactorTaskImplementationReport: () => Promise<AppSnapshot>;
  markArchitectureRefactorTaskImplementationReturned: () => Promise<AppSnapshot>;
  markArchitectureRefactorTaskImplementationReviewed: (
    confirmWithoutReview?: boolean,
  ) => Promise<AppSnapshot>;
  stageArchitectureRefactorTaskImplementationReportForReview: () => Promise<AppSnapshot>;
  setPlanningStyle: (style: PlanningStyleId) => Promise<AppSnapshot>;
  setReportsPanelCollapsed: (
    panelId: string,
    collapsed: boolean,
  ) => Promise<AppSnapshot>;
  applyFastDraftSetup: () => Promise<AppSnapshot>;
  onSnapshotUpdated: (callback: (snapshot: AppSnapshot) => void) => () => void;
}
