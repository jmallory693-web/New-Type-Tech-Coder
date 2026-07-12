import type {
  BacklogItem,
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  BuilderPromptPack,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointAvailabilityState,
  CheckpointRecord,
  DecisionReport,
  ExternalReviewState,
  HistoryUiState,
  ImplementationReviewRecord,
  InstalledOllamaModelsState,
  LocalAiAdvisorResponse,
  OutsideReviewPack,
  PatchReviewPack,
  ProjectInfo,
  ProjectMemoryPreview,
  ProjectMemorySavedRecord,
  ProjectScanResult,
  CodeContextPack,
  CodeContextAiRecord,
  CodeQuestionTemplateSelection,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecord,
  ImportedPatchDraftRecord,
  ExternalPatchDraftComparisonRecord,
  BuilderHandoffExportRecord,
  ProviderStatus,
  QwenInspectState,
  RoleModelMappingState,
  SafeChecksState,
  SafetyGateStatus,
  SpeakerScriptRecord,
} from "../../shared/types";
import { truncateAdvisorForPack, truncateQwenReportForPack } from "../providers/types";
import { truncateCommandOutputForPack } from "../commands/SafeCommandRunner";
import {
  backlogOpenCount,
  backlogOpenCriticalOrHighCount,
  backlogOpenCriticalSafetyCount,
} from "./BacklogManager";
import {
  builderResultNeedsReview,
  truncateBuilderResultForPack,
} from "./BuilderResultManager";
import { truncateExternalReviewForPack } from "./ExternalReviewManager";
import { HISTORY_PRIVACY_NOTE } from "../history/HistoryStore";
import { calculateDailyNextAction } from "../../shared/dailyNextAction";
import { getPlanningStyleReportLine } from "../../shared/planningStyle";
import type { PlanningStyleId } from "../../shared/planningStyle";
import {
  countMappedRoles,
  formatModelSelectionSource,
} from "../../shared/roleModelMapping";

const SECRET_SAFETY_NOTE =
  "This pack does not include .env contents, secrets, keys, certificates, raw source code, or deep file listings. It uses safe local metadata and your typed request only.";

const MAX_TOP_LEVEL_IN_PACK = 40;
const MAX_SKIPPED_IN_PACK = 20;
const MAX_DEPS_IN_PACK = 40;
const MAX_REQUEST_CHARS = 4000;

export interface ReviewPackInput {
  userRequest: string;
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  summaryIsFromHistory?: boolean;
  safety: SafetyGateStatus;
  provider: ProviderStatus;
  checkpoint: CheckpointRecord | null;
  checkpointAvailability?: CheckpointAvailabilityState | null;
  advisorResponse: LocalAiAdvisorResponse | null;
  safeChecks: SafeChecksState;
  qwen: QwenInspectState;
  externalReview: ExternalReviewState;
  history: HistoryUiState;
  changedFiles: ChangedFilesScanResult | null;
  patchReviewPack: PatchReviewPack | null;
  decisionReport: DecisionReport | null;
  builderPrompt: BuilderPromptPack | null;
  builderResult: BuilderResultRecord | null;
  speakerScript?: SpeakerScriptRecord | null;
  builderPlan?: BuilderPlanRecord | null;
  builderPlanComparison?: BuilderPlanComparisonRecord | null;
  implementationReview?: ImplementationReviewRecord | null;
  roleModelMapping?: RoleModelMappingState | null;
  installedModels?: InstalledOllamaModelsState | null;
  backlogItems: BacklogItem[];
  projectMemoryPreview?: ProjectMemoryPreview | null;
  projectMemoryLastSaved?: ProjectMemorySavedRecord | null;
  codeContextPreview?: CodeContextPack | null;
  codeContextAiResponse?: CodeContextAiRecord | null;
  codeContextQuestionTemplate?: CodeQuestionTemplateSelection | null;
  patchDraftResponse?: PatchDraftRecord | null;
  patchDraftSafetyReview?: PatchDraftSafetyReviewRecord | null;
  importedPatchDraft?: ImportedPatchDraftRecord | null;
  externalPatchDraftComparison?: ExternalPatchDraftComparisonRecord | null;
  builderHandoffExport?: BuilderHandoffExportRecord | null;
  planningStyle?: PlanningStyleId;
}

function bulletList(items: string[], emptyLabel: string): string[] {
  if (items.length === 0) {
    return [`- ${emptyLabel}`];
  }
  return items.map((item) => `- ${item}`);
}

function truncateList(items: string[], max: number): { shown: string[]; more: number } {
  if (items.length <= max) {
    return { shown: items, more: 0 };
  }
  return { shown: items.slice(0, max), more: items.length - max };
}

/**
 * Builds an Outside Review Pack from safe local metadata + typed request.
 * Does not call AI, read secrets, or include raw source code.
 */
export function buildOutsideReviewPack(input: ReviewPackInput): OutsideReviewPack {
  const trimmedRequest = input.userRequest.trim().slice(0, MAX_REQUEST_CHARS);
  const userRequestIncluded = trimmedRequest.length > 0;
  const projectSelected = Boolean(input.project);
  const summaryAvailable = Boolean(input.summary);
  const limitedContext = !projectSelected || !summaryAvailable;

  const userRequestText = userRequestIncluded
    ? trimmedRequest
    : "No specific user request was entered.";

  const lines: string[] = [
    "# New Type Tech Coder - Copy-Paste Review Report",
    "",
    "## Reviewer Role",
    "",
    "You are reviewing a local non-coder AI development workbench called New Type Tech Coder.",
    "Focus on safety, missing risks, unclear assumptions, and next-step planning.",
    "Do not assume the app can edit files, run arbitrary terminals, or enable Qwen live file edits yet.",
    "Build/Test Checks (allowlisted Safe Checks) may run package scripts only when the user clicks a button.",
    "Qwen Code CLI supports Inspect Prompt generation + CLI detection only; live Qwen is disabled for safety.",
    "External reviews are pasted advice only and must never be executed by the app.",
    "Treat all conclusions as based on shallow safe metadata / summary-only context (no raw source code).",
    "",
    "## User Request",
    "",
    userRequestText,
    "",
    "## Project Context",
    "",
  ];

  if (!projectSelected) {
    lines.push(
      "- **Project selected:** No",
      "- **Note:** No project folder is selected. Context below is limited.",
      "",
    );
  } else if (!summaryAvailable) {
    lines.push(
      `- **Project name:** ${input.project?.displayName ?? "Unknown"}`,
      `- **Project path:** ${input.project?.normalizedPath ?? "Unknown"}`,
      "- **Project summary data:** Unavailable (scan has not been run or failed).",
      "- **Likely project type:** Could not confirm from summary data.",
      "- **Detected tech stack:** Could not confirm from summary data.",
      "",
    );
  } else if (input.summary) {
    const summary = input.summary;
    const top = truncateList(summary.topLevelNames, MAX_TOP_LEVEL_IN_PACK);
    const deps = truncateList(summary.dependencies, MAX_DEPS_IN_PACK);
    const devDeps = truncateList(summary.devDependencies, MAX_DEPS_IN_PACK);

    lines.push(
      `- **Project name:** ${summary.projectName}`,
      `- **Project path:** ${summary.projectPath}`,
      `- **Likely project type:** ${summary.likelyProjectTypes.join("; ")}`,
      `- **Detected tech stack:** ${summary.techStack.length ? summary.techStack.join(", ") : "Could not confirm"}`,
      "",
      "### Important folders",
      "",
      ...bulletList(summary.importantFolders, "None confirmed at top level"),
      "",
      "### Important files",
      "",
      ...bulletList(summary.importantFiles, "None confirmed"),
      "",
      "### Available package scripts",
      "",
      ...bulletList(summary.packageScripts, "None found / package.json missing or unreadable"),
      "",
      "### Dependency names",
      "",
      ...bulletList(deps.shown, "None listed"),
    );
    if (deps.more > 0) {
      lines.push(`- …and ${deps.more} more dependency names omitted for brevity`);
    }
    lines.push("", "### Dev dependency names", "", ...bulletList(devDeps.shown, "None listed"));
    if (devDeps.more > 0) {
      lines.push(`- …and ${devDeps.more} more devDependency names omitted for brevity`);
    }
    lines.push("", "### Top-level names (truncated)", "", ...bulletList(top.shown, "Unavailable"));
    if (top.more > 0) {
      lines.push(`- …and ${top.more} more top-level names omitted for brevity`);
    }
    lines.push("");
  }

  lines.push(
    ...[
      "## Current App Safety State",
      "",
      `- **Mode:** ${input.safety.mode} (Inspect-only: no edits allowed)`,
      `- **Local AI reviewer status:** ${input.provider.message}`,
      `- **Local AI reviewer type:** ${input.provider.providerName ?? "None"}`,
      `- **Local AI reviewer connection state:** ${input.provider.connectionState}`,
      `- **Local AI reviewer model:** ${input.provider.modelName ?? "None"}`,
      `- **Local AI reviewer base URL:** ${input.provider.baseUrl ?? "None"}`,
      `- **Safety backup created:** ${
        input.checkpointAvailability?.hasPreviousRecord ||
        input.checkpoint ||
        input.safety.checkpointExists
          ? "Yes"
          : "No"
      }`,
      input.checkpointAvailability
        ? `- **Safety backup status:** ${input.checkpointAvailability.label}`
        : null,
      input.checkpointAvailability
        ? `- **Restore verified:** ${input.checkpointAvailability.restorable ? "Yes" : "No"}`
        : null,
      `- **Edit mode available:** ${input.safety.editModeAvailable ? "Yes" : "No"}`,
      `- **File editing available:** ${input.safety.writesAllowed ? "Yes" : "No"}`,
      "- **Project commands available:** Allowlisted Build/Test Checks only (no arbitrary terminal)",
      `- **Safety Gate initialized:** ${input.safety.initialized ? "Yes" : "No"}`,
      "",
      "### Local AI reviewer (summary-only)",
      "",
    ].filter((line): line is string => line !== null),
  );

  if (!input.advisorResponse) {
    lines.push(
      "- **Local AI role response exists:** No",
      "- **Note:** Ask Local AI Role has not produced a response yet, or the local reviewer is not ready.",
      "",
    );
  } else {
    const truncated = truncateAdvisorForPack(input.advisorResponse);
    lines.push(
      "- **Local AI role response exists:** Yes",
      `- **Local AI role selected:** ${input.advisorResponse.roleLabel || "General Reviewer"}`,
      `- **Role id:** ${input.advisorResponse.roleId || "general-reviewer"}`,
      `- **Reviewer model:** ${input.advisorResponse.modelName}`,
      `- **Model selection:** ${formatModelSelectionSource(input.advisorResponse.modelSelectionSource)}`,
      `- **Reviewer response time:** ${input.advisorResponse.createdAt}`,
      `- **Prompt size (chars):** ${input.advisorResponse.promptCharCount}`,
      "- **Label:** Local AI role response (optional advice — not official app safety status)",
      "",
      "### Local AI Role Response (short excerpt)",
      "",
      truncated.text,
      "",
    );
    if (truncated.truncated) {
      lines.push(
        "- **Note:** Local AI role response was truncated for Review Report size.",
        "",
      );
    }
  }

  lines.push(
    "### Safety Backup status",
    "",
  );

  const availability = input.checkpointAvailability;
  if (availability && availability.status !== "none") {
    lines.push(
      `- **Safety backup status:** ${availability.label}`,
      `- **Last safety backup time:** ${availability.createdAt ?? "Not available"}`,
      `- **Safety backup method:** ${availability.methodLabel ?? "Not available"}`,
      `- **Restore verified:** ${availability.restorable ? "Yes" : "No"}`,
      `- **Restore status:** ${
        availability.restorable
          ? "Available (verified restorable)"
          : availability.hasPreviousRecord
            ? "Unavailable until verification succeeds"
            : "Unavailable"
      }`,
      availability.verificationMessage
        ? `- **Verification result:** ${availability.verificationMessage}`
        : `- **Verification result:** ${availability.detail}`,
      "",
    );
  } else if (!input.checkpoint) {
    lines.push(
      "- **Safety backup status:** No safety backup yet",
      "- **Last safety backup time:** Not available",
      "- **Safety backup method:** Not available",
      "- **Restore status:** Unavailable (no safety backup)",
      "- **Safety backup warnings:** None",
      "",
    );
  } else {
    const linkSkips = input.checkpoint.skippedItems.filter(
      (item) =>
        /symlink/i.test(item.reason) ||
        /junction/i.test(item.reason) ||
        /reparse/i.test(item.reason),
    );
    lines.push(
      "- **Safety backup status:** Safety Backup verified — restore available.",
      `- **Last safety backup time:** ${input.checkpoint.createdAt}`,
      `- **Safety backup method:** ${input.checkpoint.methodLabel}`,
      `- **Restore status:** Available (verified restorable)`,
      `- **Plain English:** ${input.checkpoint.plainEnglish}`,
      `- **Skipped during safety backup:** ${input.checkpoint.skippedCount}`,
      `- **Symlinks/junctions excluded from backup:** ${linkSkips.length}`,
      `- **Backup excluded unsafe links:** ${linkSkips.length > 0 ? "Yes" : "No (none found or Git method)"}`,
    );
    if (input.checkpoint.warnings.length > 0) {
      lines.push("", "### Safety backup warnings", "");
      for (const warning of input.checkpoint.warnings) {
        lines.push(`- ${warning}`);
      }
    }
    lines.push("");
  }

  const lifecycleBlocked = input.safeChecks.blocked.filter(
    (item) => item.lifecycleHooks && item.lifecycleHooks.length > 0,
  );

  lines.push(
    "### Build/Test Checks status (allowlisted Safe Checks)",
    "",
    `- **Package manager:** ${input.safeChecks.packageManager}`,
    input.safeChecks.packageManagerWarning
      ? `- **Package manager warning:** ${input.safeChecks.packageManagerWarning}`
      : "- **Package manager warning:** None",
    `- **package.json found:** ${input.safeChecks.packageJsonFound ? "Yes" : "No"}`,
    `- **Lifecycle-hook blocks:** ${lifecycleBlocked.length > 0 ? "Yes (conservative block)" : "None detected"}`,
    "",
    "#### Available build/test checks",
    "",
  );

  const runnable = input.safeChecks.available.filter((item) => item.available && !item.blocked);
  if (runnable.length === 0) {
    lines.push("- None available");
  } else {
    for (const item of runnable) {
      lines.push(`- **${item.scriptName}** → \`${item.argvPreview}\``);
    }
  }

  lines.push("", "#### Lifecycle hook blocks (Stage 11B)", "");
  if (lifecycleBlocked.length === 0) {
    lines.push("- None");
  } else {
    for (const item of lifecycleBlocked) {
      lines.push(
        `- **${item.scriptName}** blocked by hooks: ${(item.lifecycleHooks ?? []).join(", ")}`,
      );
      lines.push(`  - ${item.reason}`);
    }
  }

  lines.push("", "#### Blocked scripts / reasons", "");
  if (input.safeChecks.blocked.length === 0) {
    lines.push("- None blocked");
  } else {
    for (const item of input.safeChecks.blocked.slice(0, 30)) {
      lines.push(`- **${item.scriptName}:** ${item.reason}`);
    }
  }

  lines.push("", "#### Unavailable allowlisted names", "");
  if (input.safeChecks.unavailable.length === 0) {
    lines.push("- None");
  } else {
    for (const item of input.safeChecks.unavailable.slice(0, 20)) {
      lines.push(`- **${item.scriptName}:** ${item.reason}`);
    }
  }

  const last = input.safeChecks.lastResult;
  lines.push("", "#### Last command result", "");
  if (!last) {
    lines.push(
      "- **Last command run:** None",
      "- **Last command result:** Not run",
      "- **Exit code:** Not available",
      "- **Plain-English summary:** No safe check has been run yet.",
      "- **Raw output included:** No",
      "",
    );
  } else {
    const outputPack = truncateCommandOutputForPack(last.combinedOutput);
    lines.push(
      `- **Last command run:** ${last.argv.join(" ") || last.scriptName}`,
      `- **Status:** ${last.status}`,
      `- **Exit code:** ${last.exitCode === null ? "Not available" : String(last.exitCode)}`,
      `- **Started:** ${last.startedAt ?? "Not available"}`,
      `- **Ended:** ${last.endedAt ?? "Not available"}`,
      `- **Duration (ms):** ${last.durationMs === null ? "Not available" : String(last.durationMs)}`,
      `- **Plain-English summary:** ${last.plainEnglishSummary}`,
      `- **Raw output included:** ${outputPack.included ? (outputPack.truncated ? "Yes (truncated)" : "Yes") : "No"}`,
      "",
    );
    if (outputPack.included) {
      lines.push("##### Truncated command output", "", "```", outputPack.text, "```", "");
    }
  }

  lines.push(
    "### Qwen Inspect Prompt status",
    "",
    `- **Selected provider panel:** ${input.provider.providerName ?? "Unknown"}`,
    `- **Qwen CLI command:** ${input.qwen.command}`,
    `- **Qwen CLI status:** ${input.qwen.cliStatus}`,
    input.qwen.lastTestMessage
      ? `- **Last Qwen CLI test:** ${input.qwen.lastTestMessage}`
      : "- **Last Qwen CLI test:** Not run yet",
    `- **Live Qwen inspect enabled:** ${input.qwen.liveInspectEnabled ? "Yes" : "No — Live Qwen is disabled for safety"}`,
    `- **Live Qwen inspect note:** ${input.qwen.liveInspectDisabledReason}`,
    `- **Qwen Inspect Prompt available:** ${input.qwen.promptPack ? "Yes" : "No"}`,
    input.qwen.promptPack
      ? `- **Qwen Inspect Prompt generated at:** ${input.qwen.promptPack.generatedAt}`
      : "- **Qwen Inspect Prompt generated at:** Not available",
    input.qwen.lastReport
      ? `- **Last Qwen inspect report:** Yes (${input.qwen.lastReport.createdAt})`
      : "- **Last Qwen inspect report:** None (live Qwen is disabled for safety)",
    input.qwen.fileChangeVerification
      ? `- **File-change verification:** ${input.qwen.fileChangeVerification}`
      : "- **File-change verification:** Not applicable (no live Qwen run)",
    "",
  );

  if (input.qwen.lastReport) {
    const truncated = truncateQwenReportForPack(input.qwen.lastReport.reportText);
    lines.push(
      "#### Last Qwen inspect report (truncated)",
      "",
      truncated.text,
      "",
    );
    if (truncated.truncated) {
      lines.push("- **Note:** Qwen report was truncated for Review Pack size.", "");
    }
  }

  lines.push(
    "### External Review Import status",
    "",
    `- **External review source (current draft):** ${input.externalReview.source}`,
    `- **External review count:** ${input.externalReview.reviews.length}`,
    `- **Sources represented:** ${
      input.externalReview.reviews.length
        ? [...new Set(input.externalReview.reviews.map((r) => r.source))].join(", ")
        : "None"
    }`,
    `- **Reviews with risky phrase warnings:** ${
      input.externalReview.reviews.filter((r) => r.hasRiskySuggestions).length
    }`,
  );

  if (input.externalReview.comparison) {
    const c = input.externalReview.comparison;
    lines.push(
      "",
      "#### Review comparison (keyword-based only)",
      "",
      `- **Method:** ${c.methodNote}`,
      `- **Plain English:** ${c.plainEnglish}`,
      `- **Appears to mention approve:** ${c.appearsToMentionApprove ? "Yes" : "No"}`,
      `- **Appears to mention revise:** ${c.appearsToMentionRevise ? "Yes" : "No"}`,
      `- **Appears to mention revert:** ${c.appearsToMentionRevert ? "Yes" : "No"}`,
      `- **Disagreement indicator:** ${c.disagreementDetected ? "Yes — needs human decision" : "No"}`,
      `- **Common concern keywords:** ${
        c.commonConcernKeywords.length
          ? c.commonConcernKeywords.join(", ")
          : "None"
      }`,
      "",
    );
  }

  if (!input.externalReview.selected) {
    lines.push(
      "- **Selected review excerpt:** None selected",
      "",
    );
  } else {
    const saved = input.externalReview.selected;
    const excerpt = truncateExternalReviewForPack(saved.reviewText);
    lines.push(
      `- **Selected source:** ${saved.source}`,
      `- **Selected label:** ${saved.label ?? "(none)"}`,
      `- **Selected saved at:** ${saved.savedAt}`,
      `- **Selected context basis:** ${saved.contextBasis.join(", ")}`,
      `- **Selected risky warnings:** ${
        saved.hasRiskySuggestions ? saved.riskyPhrases.join(", ") : "None flagged"
      }`,
      `- **Selected review text included:** ${
        excerpt.included
          ? excerpt.truncated
            ? "Yes (truncated)"
            : "Yes"
          : "No"
      }`,
      "",
      "#### Selected External Review excerpt",
      "",
      excerpt.text || "(empty)",
      "",
    );
  }

  const hist = input.history;
  const currentHist = hist.currentProjectHistory;
  const histReviews =
    currentHist?.externalReviews ??
    (currentHist?.externalReview ? [currentHist.externalReview] : []);
  lines.push(
    "### Saved History status (app-owned)",
    "",
    `- **Saved history exists for this project:** ${currentHist ? "Yes" : "No"}`,
    currentHist
      ? `- **Last history update:** ${currentHist.updatedAt}`
      : "- **Last history update:** Not available",
    currentHist?.projectSummary
      ? `- **Last saved summary time:** ${currentHist.projectSummary.scannedAt}`
      : "- **Last saved summary time:** Not available",
    currentHist?.advisorResponse
      ? `- **Last saved local AI reviewer time:** ${currentHist.advisorResponse.createdAt}`
      : "- **Last saved local AI reviewer time:** Not available",
    histReviews.length > 0
      ? `- **Saved external reviews:** ${histReviews.length} (latest ${histReviews[0].source} at ${histReviews[0].savedAt})`
      : "- **Saved external reviews:** None",
    currentHist?.lastSafeCheck
      ? `- **Last build/test check time:** ${currentHist.lastSafeCheck.savedAt} (${currentHist.lastSafeCheck.scriptName} · ${currentHist.lastSafeCheck.status})`
      : "- **Last build/test check time:** Not available",
    `- **History safety note:** ${HISTORY_PRIVACY_NOTE}`,
    "- **Note:** Full history text is not dumped here by default — only status timestamps.",
    "",
  );

  lines.push(
    "### Safety Gate deny-list summary",
    "",
    ...bulletList(input.safety.denyListSummary, "None listed"),
    "",
    "## Scan Summary",
    "",
  );

  if (!summaryAvailable || !input.summary) {
    lines.push(
      "- **Last scan time:** Not available",
      "- **Inspected files:** Summary data unavailable",
      "- **Skipped/blocked count:** Not available",
      "- **Note:** Generate or re-run Summarize Project after selecting a folder for full scan details.",
      "",
    );
  } else {
    const skipped = truncateList(
      input.summary.skippedItems.map((item) => `${item.path}: ${item.reason}`),
      MAX_SKIPPED_IN_PACK,
    );
    lines.push(
      `- **Last scan time:** ${input.summary.scannedAt}`,
      `- **Safe files inspected:** ${input.summary.inspectedSafeFiles.length ? input.summary.inspectedSafeFiles.join(", ") : "None"}`,
      `- **Skipped/blocked count:** ${input.summary.skippedItems.length}`,
      `- **Skipped symlink/junction count:** ${input.summary.skippedSymlinkOrJunctionCount}`,
      "",
      "### Skipped symlinks / junctions",
      "",
      ...bulletList(
        input.summary.skippedSymlinkOrJunctionNames,
        "None",
      ),
      "",
      "### Skipped / blocked reasons",
      "",
      ...bulletList(skipped.shown, "None"),
    );
    if (skipped.more > 0) {
      lines.push(`- …and ${skipped.more} more skipped items omitted for brevity`);
    }
    lines.push("", "### Safety notes", "", ...bulletList(input.summary.safetyNotes, "None"));
    if (input.summary.packageJsonWarning) {
      lines.push("", `### Package warning`, "", input.summary.packageJsonWarning);
    }
    lines.push("");
  }

  lines.push("## Changed Files / Patch Review", "");
  if (!input.changedFiles) {
    lines.push(
      "- **Changed-files scan:** Not run yet",
      "- **Changed-file count:** n/a",
      "- **Risk flags:** n/a",
      "- **Patch Review Pack:** Not generated yet",
      "",
    );
  } else {
    const cf = input.changedFiles;
    const riskLabels = [
      ...new Set([
        ...cf.globalRiskFlags.map((f) => f.label),
        ...cf.files.flatMap((f) => f.riskFlags.map((r) => r.label)),
      ]),
    ].slice(0, 20);
    lines.push(
      `- **Changed-files detected:** ${cf.isGitRepo && !cf.errorMessage ? "Yes" : "No / unavailable"}`,
      `- **Changed-file count:** ${cf.totalCount}`,
      `- **Modified / added / deleted / untracked:** ${cf.modifiedCount} / ${cf.addedCount} / ${cf.deletedCount} / ${cf.untrackedCount}`,
      `- **Files with risk flags:** ${cf.riskyCount}`,
      `- **Risk flags:** ${riskLabels.length ? riskLabels.join("; ") : "None"}`,
      `- **Patch Review Pack exists:** ${input.patchReviewPack ? "Yes" : "No"}`,
      cf.statusMessage ? `- **Scan status:** ${cf.statusMessage}` : "",
      "",
    );
  }

  lines.push(
    "## Decision Report / Builder Prompt",
    "",
    `- **Planning style:** ${getPlanningStyleReportLine(input.planningStyle ?? "small-model-friendly")}`,
    `- **Decision Report exists:** ${input.decisionReport ? "Yes" : "No"}`,
    `- **Builder Prompt exists:** ${input.builderPrompt ? "Yes" : "No"}`,
    `- **Recommended next action:** ${
      input.decisionReport?.recommendedNextAction.label ??
      input.builderPrompt?.recommendedNextAction.label ??
      "Not calculated yet"
    }`,
    input.decisionReport
      ? `- **Decision Report detail:** ${input.decisionReport.recommendedNextAction.plainEnglish}`
      : "",
    "",
  );

  const dailyNext = calculateDailyNextAction({
    project: input.project,
    summary: input.summary,
    summaryIsFromHistory: Boolean(input.summaryIsFromHistory),
    checkpointAvailability: input.checkpointAvailability ?? {
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
    safeChecks: input.safeChecks,
    changedFilesScan: input.changedFiles,
    patchReviewPack: input.patchReviewPack,
    // Treat this pack as present so Daily Use advances past "generate review report".
    reviewPack: {
      generatedAt: new Date().toISOString(),
      userRequestIncluded,
      userRequestText,
      projectSelected,
      summaryAvailable,
      limitedContext,
      markdownReport: "",
      previewExcerpt: "",
      secretSafetyNote: SECRET_SAFETY_NOTE,
    },
    externalReviews: input.externalReview.reviews,
    decisionReport: input.decisionReport,
    builderPromptGeneratedAt: input.builderPrompt?.generatedAt ?? null,
    builderResult: input.builderResult,
    implementationReview: input.implementationReview ?? null,
    backlogCriticalSafetyOpen: backlogOpenCriticalSafetyCount(
      input.backlogItems ?? [],
    ),
    projectMemoryLastSaved: input.projectMemoryLastSaved ?? null,
    builderPlanGeneratedAt: input.builderPlan?.generatedAt ?? null,
    builderPlanComparisonGeneratedAt:
      input.builderPlanComparison?.generatedAt ?? null,
    codeContextPreview: input.codeContextPreview ?? null,
    codeContextAiResponse: input.codeContextAiResponse ?? null,
    patchDraftResponse: input.patchDraftResponse ?? null,
    patchDraftSafetyReview: input.patchDraftSafetyReview ?? null,
    importedPatchDraft: input.importedPatchDraft ?? null,
    externalPatchDraftComparison: input.externalPatchDraftComparison ?? null,
    builderHandoffExport: input.builderHandoffExport ?? null,
    planningStyle: input.planningStyle,
  });
  lines.push(
    "## Daily Use Next Action",
    "",
    `- **What should I do next?:** ${dailyNext.title}`,
    `- **Why:** ${dailyNext.reason}`,
    dailyNext.freshnessHints.length
      ? `- **Freshness:** ${dailyNext.freshnessHints.slice(0, 4).join(" | ")}`
      : "- **Freshness:** No extra freshness notes.",
    "",
  );

  lines.push(
    "## Speaker Script",
    "",
    input.speakerScript
      ? [
          `- **Speaker Script exists:** Yes`,
          `- **Role:** ${input.speakerScript.roleLabel}`,
          `- **Tone:** ${input.speakerScript.toneLabel}`,
          `- **Generated:** ${input.speakerScript.generatedAt}`,
          `- **Short excerpt:**`,
          input.speakerScript.previewExcerpt.slice(0, 600),
        ].join("\n")
      : "- **Speaker Script exists:** No",
    "",
  );

  lines.push(
    "## Builder Plan Mode",
    "",
    input.builderPlan
      ? [
          `- **Builder Plan exists:** Yes`,
          `- **Model:** ${input.builderPlan.modelName}`,
          `- **Model selection:** ${formatModelSelectionSource(input.builderPlan.modelSelectionSource)}`,
          `- **Generated:** ${input.builderPlan.generatedAt}`,
          `- **Recommendation:** ${input.builderPlan.recommendation ?? "Not detected"}`,
          `- **Short excerpt:**`,
          input.builderPlan.previewExcerpt.slice(0, 600),
        ].join("\n")
      : "- **Builder Plan exists:** No",
    "",
  );

  lines.push(
    "## Builder Plan Comparison",
    "",
    input.builderPlanComparison
      ? [
          `- **Comparison exists:** Yes`,
          `- **Imported source/type:** ${input.builderPlanComparison.importedSource} / ${input.builderPlanComparison.importedResponseType}`,
          `- **Generated:** ${input.builderPlanComparison.generatedAt}`,
          `- **Recommendation:** ${input.builderPlanComparison.recommendation}`,
          `- **Short excerpt:**`,
          input.builderPlanComparison.previewExcerpt.slice(0, 600),
        ].join("\n")
      : "- **Comparison exists:** No",
    "",
  );

  lines.push(
    "## Implementation Review",
    "",
    input.implementationReview
      ? [
          `- **Implementation Review exists:** Yes`,
          `- **Imported source/type:** ${input.implementationReview.importedSource} / ${input.implementationReview.importedResponseType}`,
          `- **Generated:** ${input.implementationReview.generatedAt}`,
          `- **Recommendation:** ${input.implementationReview.recommendation}`,
          `- **Short excerpt:**`,
          input.implementationReview.previewExcerpt.slice(0, 600),
        ].join("\n")
      : "- **Implementation Review exists:** No",
    "",
  );

  const mapping = input.roleModelMapping;
  const installed = input.installedModels;
  const mappedCount = mapping ? countMappedRoles(mapping.mappings) : 0;
  lines.push(
    "## Role Model Mapping",
    "",
    `- **Role model mappings set:** ${mappedCount}`,
    `- **Installed models cached:** ${installed?.models.length ?? 0}`,
    installed?.lastRefreshAt
      ? `- **Last model refresh:** ${installed.lastRefreshAt}`
      : "- **Last model refresh:** Not yet",
    `- **Global fallback model:** ${input.provider.modelName ?? "None"}`,
    "",
  );

  const builderResult = input.builderResult;
  lines.push(
    "## Builder Result Import",
    "",
    `- **Builder Result exists:** ${builderResult ? "Yes" : "No"}`,
  );
  if (!builderResult) {
    lines.push(
      "- **Note:** No builder response has been pasted back yet.",
      "",
    );
  } else {
    const excerpt = truncateBuilderResultForPack(builderResult.responseText);
    lines.push(
      `- **Builder source:** ${builderResult.source}`,
      `- **Response type:** ${builderResult.responseType}`,
      `- **Saved at:** ${builderResult.savedAt}`,
      `- **Appears as:** ${builderResult.appearsAs}`,
      `- **Needs review:** ${builderResultNeedsReview(builderResult) ? "Yes" : "No"}`,
      `- **Risk warnings:** ${
        builderResult.hasRiskySuggestions
          ? builderResult.riskyPhrases.join(", ")
          : "None"
      }`,
      `- **Mismatch warnings:** ${
        builderResult.hasMismatchWarnings
          ? builderResult.mismatchWarnings.join("; ")
          : "None"
      }`,
      "",
      "#### Builder Result excerpt",
      "",
      excerpt.text || "(empty)",
      "",
    );
  }

  const backlogItems = input.backlogItems ?? [];
  const backlogOpen = backlogOpenCount(backlogItems);
  const backlogCriticalHigh = backlogOpenCriticalOrHighCount(backlogItems);
  const backlogSafety = backlogItems.filter(
    (i) =>
      i.type === "Safety concern" &&
      (i.status === "Open" || i.status === "In review"),
  ).length;
  const backlogCriticalSafety = backlogOpenCriticalSafetyCount(backlogItems);
  lines.push(
    "## Bug Log / Improvement Backlog",
    "",
    `- **Backlog status:** ${backlogItems.length} item(s) stored in app history`,
    `- **Open / in-review:** ${backlogOpen}`,
    `- **Open Critical/High:** ${backlogCriticalHigh}`,
    `- **Open Safety concerns:** ${backlogSafety}`,
    backlogCriticalSafety > 0
      ? `- **Critical Safety concerns open:** ${backlogCriticalSafety} — do not proceed until resolved`
      : "- **Critical Safety concerns open:** 0",
    "",
  );

  lines.push(
    "## Project Memory / `.nttc/` Handoff",
    "",
    `- **Project Memory preview exists:** ${input.projectMemoryPreview ? "Yes" : "No"}`,
    `- **Project Memory files saved to \`.nttc/\`:** ${input.projectMemoryLastSaved ? "Yes" : "No"}`,
    input.projectMemoryLastSaved
      ? `- **Last saved:** ${input.projectMemoryLastSaved.savedAt}`
      : "- **Last saved:** Never",
    input.projectMemoryLastSaved
      ? `- **Files saved:** ${input.projectMemoryLastSaved.filesWritten.join(", ")}`
      : "- **Files saved:** None",
    "- **Warning:** `.nttc/` files are documentation-only markdown. NTTC does not edit source code through Project Memory.",
    input.projectMemoryPreview?.truncationFlags.length
      ? `- **Truncation flags:** ${input.projectMemoryPreview.truncationFlags.join("; ")}`
      : "",
    "",
    "## Code Context Pack (Preview Only)",
    "",
    `- **Code Context Pack exists:** ${input.codeContextPreview ? "Yes" : "No"}`,
    input.codeContextPreview
      ? `- **Generated:** ${input.codeContextPreview.generatedAt}`
      : "- **Generated:** Never",
    input.codeContextPreview
      ? `- **Selected files:** ${input.codeContextPreview.selectedFileCount}`
      : "- **Selected files:** 0",
    input.codeContextPreview
      ? `- **Warnings:** ${input.codeContextPreview.warningCount}`
      : "- **Warnings:** 0",
    input.codeContextPreview
      ? `- **Truncated:** ${input.codeContextPreview.truncated ? "Yes" : "No"}`
      : "- **Truncated:** No",
    "- **Note:** Code Context Pack is preview/copy only — send to Local AI only after explicit user confirmation (Stage 54).",
    "",
    "## Local AI Code Review (Approved Pack Only)",
    "",
    `- **Code AI response exists:** ${input.codeContextAiResponse ? "Yes" : "No"}`,
    input.codeContextAiResponse
      ? `- **Model used:** ${input.codeContextAiResponse.modelName}`
      : "- **Model used:** N/A",
    input.codeContextAiResponse
      ? `- **Generated:** ${input.codeContextAiResponse.generatedAt}`
      : "- **Generated:** Never",
    input.codeContextAiResponse
      ? `- **Context pack time:** ${input.codeContextAiResponse.contextPackGeneratedAt}`
      : "- **Context pack time:** N/A",
    input.codeContextAiResponse
      ? `- **Selected files:** ${input.codeContextAiResponse.selectedFileCount}`
      : "- **Selected files:** N/A",
    input.codeContextAiResponse
      ? `- **Warnings at send time:** ${input.codeContextAiResponse.warningCount}`
      : "- **Warnings at send time:** N/A",
    input.codeContextAiResponse
      ? `- **Excerpt:** ${input.codeContextAiResponse.previewExcerpt.split("\n").slice(0, 4).join(" ").slice(0, 280)}`
      : "- **Excerpt:** N/A",
    "- **Note:** Local AI received only the approved Code Context Pack — no invisible file browsing.",
    "",
    "## Code Question Templates",
    "",
    `- **Template used:** ${input.codeContextQuestionTemplate ? "Yes" : "No"}`,
    input.codeContextQuestionTemplate
      ? `- **Template label:** ${input.codeContextQuestionTemplate.templateLabel}`
      : "- **Template label:** None",
    input.codeContextQuestionTemplate
      ? `- **Template selected:** ${input.codeContextQuestionTemplate.selectedAt}`
      : "- **Template selected:** Never",
    input.codeContextAiResponse?.questionTemplateLabel
      ? `- **Template at Code AI ask:** ${input.codeContextAiResponse.questionTemplateLabel}`
      : "- **Template at Code AI ask:** N/A",
    "",
    "## Patch Draft Mode (No Apply)",
    "",
    `- **Patch Draft exists:** ${input.patchDraftResponse ? "Yes" : "No"}`,
    input.patchDraftResponse
      ? `- **Model used:** ${input.patchDraftResponse.modelName}`
      : "- **Model used:** N/A",
    input.patchDraftResponse
      ? `- **Generated:** ${input.patchDraftResponse.generatedAt}`
      : "- **Generated:** Never",
    input.patchDraftResponse
      ? `- **Context pack time:** ${input.patchDraftResponse.contextPackGeneratedAt}`
      : "- **Context pack time:** N/A",
    input.patchDraftResponse
      ? `- **Selected files:** ${input.patchDraftResponse.selectedFileCount}`
      : "- **Selected files:** N/A",
    input.patchDraftResponse
      ? `- **Warnings at send time:** ${input.patchDraftResponse.warningCount}`
      : "- **Warnings at send time:** N/A",
    input.patchDraftResponse?.recommendation
      ? `- **Recommendation:** ${input.patchDraftResponse.recommendation}`
      : "- **Recommendation:** N/A",
    input.patchDraftResponse
      ? `- **Excerpt:** ${input.patchDraftResponse.previewExcerpt.split("\n").slice(0, 4).join(" ").slice(0, 280)}`
      : "- **Excerpt:** N/A",
    "- **Note:** Patch Draft is output-only. NTTC did not edit source files or apply patches.",
    "",
    "## Patch Draft Safety Review",
    "",
    `- **Safety Review exists:** ${input.patchDraftSafetyReview ? "Yes" : "No"}`,
    input.patchDraftSafetyReview
      ? `- **Generated:** ${input.patchDraftSafetyReview.generatedAt}`
      : "- **Generated:** Never",
    input.patchDraftSafetyReview
      ? `- **Source Patch Draft:** ${input.patchDraftSafetyReview.sourcePatchDraftGeneratedAt}`
      : "- **Source Patch Draft:** N/A",
    input.patchDraftSafetyReview
      ? `- **Recommendation:** ${input.patchDraftSafetyReview.recommendation}`
      : "- **Recommendation:** N/A",
    input.patchDraftSafetyReview
      ? `- **Safety flags / missing safeguards:** ${input.patchDraftSafetyReview.safetyFlagCount} / ${input.patchDraftSafetyReview.missingSafeguardCount}`
      : "- **Safety flags / missing safeguards:** N/A",
    input.patchDraftSafetyReview
      ? `- **Excerpt:** ${input.patchDraftSafetyReview.previewExcerpt.split("\n").slice(0, 4).join(" ").slice(0, 280)}`
      : "- **Excerpt:** N/A",
    "- **Note:** Rule-based review only. NTTC did not apply the patch.",
    input.patchDraftSafetyReview?.reviewTargetLabel
      ? `- **Review target:** ${input.patchDraftSafetyReview.reviewTargetLabel}`
      : "- **Review target:** N/A",
    "",
    "## Manual Imported Patch Draft",
    "",
    `- **Imported Patch Draft exists:** ${input.importedPatchDraft ? "Yes" : "No"}`,
    input.importedPatchDraft
      ? `- **Source:** ${input.importedPatchDraft.source}`
      : "- **Source:** N/A",
    input.importedPatchDraft
      ? `- **Draft type:** ${input.importedPatchDraft.draftType}`
      : "- **Draft type:** N/A",
    input.importedPatchDraft
      ? `- **Imported:** ${input.importedPatchDraft.importedAt}`
      : "- **Imported:** Never",
    input.importedPatchDraft
      ? `- **Risk phrase count:** ${input.importedPatchDraft.riskPhraseCount}`
      : "- **Risk phrase count:** N/A",
    input.importedPatchDraft?.likelyFilesAreas.length
      ? `- **Likely files/areas:** ${input.importedPatchDraft.likelyFilesAreas.slice(0, 10).join(", ")}`
      : "- **Likely files/areas:** None detected",
    input.importedPatchDraft
      ? `- **Preview excerpt:** ${input.importedPatchDraft.previewExcerpt.split("\n").slice(0, 4).join(" ").slice(0, 280)}`
      : "- **Preview excerpt:** N/A",
    "- **Note:** Imported draft is text-only. NTTC did not apply it and does not auto-send to AI.",
    "",
    "## External Patch Draft Comparison",
    "",
    `- **Comparison exists:** ${input.externalPatchDraftComparison ? "Yes" : "No"}`,
    input.externalPatchDraftComparison
      ? `- **Risk level:** ${input.externalPatchDraftComparison.riskLevel}`
      : "- **Risk level:** N/A",
    input.externalPatchDraftComparison
      ? `- **Recommendation:** ${input.externalPatchDraftComparison.recommendation}`
      : "- **Recommendation:** N/A",
    input.externalPatchDraftComparison
      ? `- **Biggest conflict:** ${input.externalPatchDraftComparison.biggestConflict.slice(0, 220)}`
      : "- **Biggest conflict:** N/A",
    input.externalPatchDraftComparison
      ? `- **Safest next step:** ${input.externalPatchDraftComparison.recommendation}`
      : "- **Safest next step:** Generate comparison when both drafts exist.",
    "",
    "## Builder Handoff Export",
    "",
    `- **Handoff exists:** ${input.builderHandoffExport ? "Yes" : "No"}`,
    input.builderHandoffExport
      ? `- **Target:** ${input.builderHandoffExport.target}`
      : "- **Target:** N/A",
    input.builderHandoffExport
      ? `- **Strictness:** ${input.builderHandoffExport.strictness}`
      : "- **Strictness:** N/A",
    input.builderHandoffExport
      ? `- **Recommendation:** ${input.builderHandoffExport.recommendation}`
      : "- **Recommendation:** N/A",
    input.builderHandoffExport
      ? `- **Missing context count:** ${input.builderHandoffExport.missingContextCount}`
      : "- **Missing context count:** N/A",
    input.builderHandoffExport
      ? `- **Generated:** ${input.builderHandoffExport.generatedAt}`
      : "- **Generated:** N/A",
    "- **Note:** Handoff is text-only. NTTC did not send or apply anything.",
    "",
    "## Known Limitations",
    "",
    "- Local AI reviewer is inspect-only and summary-only (no raw source code).",
    "- Local AI does not receive raw source code, secrets, or direct folder access.",
    "- Local AI cannot run commands or control a terminal.",
    "- Qwen supports Inspect Prompt + CLI detection; live Qwen is disabled for safety.",
    "- Qwen is not allowed to edit files, create/delete files, or run project commands from this app.",
    "- External Review Import stores pasted advice as text only and never executes it.",
    "- Builder Result Import stores pasted builder responses as text only and never executes them.",
    "- Safety backup / restore foundation exists, but no AI editing is enabled yet.",
    "- Build/Test Checks are allowlisted package scripts only; no arbitrary terminal or custom command typing.",
    "- No edit mode yet; general writes remain blocked by the Safety Gate.",
    "- Scanner is shallow by design (project root metadata only).",
    "- Project summary and this copy-paste review report are based only on safe local metadata plus the typed user request.",
    "- Generate Copy-Paste Review Report does not send data to any cloud service.",
    "",
    "## Questions for Reviewer",
    "",
    "1. Does this app design seem safe for a non-coder?",
    "2. What risks are missing?",
    "3. What should be improved before allowing AI file access or edits?",
    "4. What should be improved before allowing edits?",
    "5. Is the next stage plan reasonable?",
    "",
    "## Requested Output",
    "",
    "Please return:",
    "",
    "- **Safety concerns**",
    "- **Missing requirements**",
    "- **Suggested next stage**",
    "- **Do-not-build-yet warnings**",
    "",
    "## Secret Safety Reminder",
    "",
    SECRET_SAFETY_NOTE,
    "",
  );

  if (limitedContext) {
    lines.push(
      "## Limited Context Notice",
      "",
      !projectSelected
        ? "This copy-paste review report was generated without a selected project folder."
        : "This copy-paste review report was generated without a completed project summary scan.",
      "",
    );
  }

  const markdownReport = lines.join("\n");
  const previewExcerpt = markdownReport.split("\n").slice(0, 28).join("\n");

  return {
    generatedAt: new Date().toISOString(),
    userRequestIncluded,
    userRequestText,
    projectSelected,
    summaryAvailable,
    limitedContext,
    markdownReport,
    previewExcerpt,
    secretSafetyNote: SECRET_SAFETY_NOTE,
  };
}
