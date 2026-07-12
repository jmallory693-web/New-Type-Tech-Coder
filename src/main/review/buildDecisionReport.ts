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
  PlanningStyleId,
  QwenInspectState,
  RecommendedNextAction,
  RecommendedNextActionId,
  RoleModelMappingState,
  SafeChecksState,
  SafetyGateStatus,
  SpeakerScriptRecord,
} from "../../shared/types";
import { calculateDailyNextAction } from "../../shared/dailyNextAction";
import {
  appendExpandedPlanningGuidance,
  getPlanningStyleReportLine,
} from "../../shared/planningStyle";
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
import {
  countMappedRoles,
  formatModelSelectionSource,
} from "../../shared/roleModelMapping";

const SECRET_SAFETY_NOTE =
  "This report uses safe local metadata only. It does not include raw source code, full diffs, .env contents, secrets, keys, or certificates.";

const MAX_REQUEST_CHARS = 4000;
const MAX_ADVISOR_EXCERPT = 2500;

export interface DecisionBuilderInput {
  userRequest: string;
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  summaryIsFromHistory?: boolean;
  safety: SafetyGateStatus;
  checkpoint: CheckpointRecord | null;
  checkpointAvailability?: CheckpointAvailabilityState | null;
  safeChecks: SafeChecksState;
  changedFiles: ChangedFilesScanResult | null;
  reviewPack: OutsideReviewPack | null;
  patchReviewPack: PatchReviewPack | null;
  advisorResponse: LocalAiAdvisorResponse | null;
  qwen: QwenInspectState;
  externalReview: ExternalReviewState;
  builderResult: BuilderResultRecord | null;
  builderPrompt?: BuilderPromptPack | null;
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

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/**
 * Rule-based next-action recommendation from available metadata only.
 * Not AI. Uses "appears" / "recommended based on available metadata" language.
 */
export function calculateRecommendedNextAction(
  input: DecisionBuilderInput,
): RecommendedNextAction {
  const reasons: string[] = [];
  const hasProject = Boolean(input.project);
  const hasRequest = Boolean(input.userRequest.trim());
  const hasSummary = Boolean(input.summary);
  const availability = input.checkpointAvailability;
  const hasVerifiedBackup = Boolean(
    availability?.restorable ||
      ((availability == null || availability.status === "none") &&
        (input.checkpoint || input.safety.checkpointExists)),
  );
  const hasUnverifiedRecord = Boolean(
    availability &&
      !availability.restorable &&
      (availability.hasPreviousRecord ||
        availability.status === "record-unverified" ||
        availability.status === "record-missing-target" ||
        availability.status === "unavailable"),
  );
  const hasSafeCheck = Boolean(input.safeChecks.lastResult);
  const comparison = input.externalReview.comparison;
  const reviewCount = input.externalReview.reviews.length;
  const riskyReviews =
    comparison?.reviewsWithRiskyPhrases ??
    input.externalReview.reviews.filter((r) => r.hasRiskySuggestions).length;
  const disagreement = Boolean(comparison?.disagreementDetected);
  const needsHuman = Boolean(comparison?.needsHumanDecision);
  const changed = input.changedFiles;
  const changedOk = Boolean(changed?.isGitRepo && !changed.errorMessage);
  const highRiskChanges = Boolean(
    changedOk && ((changed?.riskyCount ?? 0) > 0 || (changed?.deletedCount ?? 0) > 0),
  );
  const appearsToMentionRevert = Boolean(comparison?.appearsToMentionRevert);
  const builder = input.builderResult;
  const builderRisky = Boolean(builder?.hasRiskySuggestions);
  const builderMismatch = Boolean(builder?.hasMismatchWarnings);
  const builderNeedsReview = builderResultNeedsReview(builder);
  const builderAskRevise = Boolean(
    builder &&
      (builder.mismatchWarnings.some(
        (w) =>
          w.includes("omits test/check plan") ||
          w.includes("omits files likely to change"),
      ) ||
        (builder.builderPromptWasPlanOnly &&
          builder.appearsAs === "implementation-like")),
  );

  const make = (
    id: RecommendedNextActionId,
    label: string,
    plainEnglish: string,
  ): RecommendedNextAction => ({
    id,
    label,
    plainEnglish,
    reasons,
  });

  if (!hasProject) {
    reasons.push("No project folder is selected.");
    return make(
      "need-more-review-first",
      "Need more review first",
      "Recommended based on available metadata: select a project and gather summary/review evidence before asking a builder.",
    );
  }

  const criticalSafetyOpen = backlogOpenCriticalSafetyCount(
    input.backlogItems ?? [],
  );
  if (criticalSafetyOpen > 0) {
    reasons.push(
      `${criticalSafetyOpen} open Critical Safety concern(s) are recorded in the Bug Log / Improvement Backlog.`,
    );
    return make(
      "do-not-proceed-critical-backlog-safety",
      "Do not proceed until critical backlog safety concern is resolved",
      "Recommended based on available metadata: resolve open Critical Safety concern(s) in the backlog before continuing with builder work.",
    );
  }

  if (builderRisky) {
    reasons.push(
      `Builder Result appears to mention risky phrases: ${builder!.riskyPhrases.join(", ")} (keyword match only).`,
    );
    if (builderMismatch) {
      reasons.push(
        `Builder Result mismatch warnings: ${builder!.mismatchWarnings.join("; ")}`,
      );
    }
    return make(
      "do-not-proceed-risky-builder-result",
      "Do not proceed until Builder Result is reviewed",
      "Recommended based on available metadata: review the pasted Builder Result carefully before continuing. NTTC did not execute it.",
    );
  }

  if (
    builder &&
    builder.builderPromptWasPlanOnly &&
    builder.appearsAs === "implementation-like"
  ) {
    reasons.push(
      "Builder Prompt was plan-only, but the Builder Result appears implementation-like.",
    );
    return make(
      "do-not-proceed-risky-builder-result",
      "Do not proceed until Builder Result is reviewed",
      "Recommended based on available metadata: the builder response appears to violate the plan-only expectation. Review before continuing.",
    );
  }

  if (builderAskRevise) {
    reasons.push(
      `Builder Result appears incomplete: ${builder!.mismatchWarnings
        .filter(
          (w) =>
            w.includes("omits test/check plan") ||
            w.includes("omits files likely to change"),
        )
        .join("; ")}`,
    );
    return make(
      "ask-builder-to-revise",
      "Ask builder to revise",
      "Recommended based on available metadata: ask the builder to revise the plan so it includes a test/check plan and files likely to change.",
    );
  }

  if (builderNeedsReview && builderMismatch) {
    reasons.push(
      `Builder Result has mismatch warnings: ${builder!.mismatchWarnings.join("; ")}`,
    );
    return make(
      "do-not-proceed-risky-builder-result",
      "Do not proceed until Builder Result is reviewed",
      "Recommended based on available metadata: resolve Builder Result mismatch warnings before continuing.",
    );
  }

  if (riskyReviews > 0 && needsHuman) {
    reasons.push(
      `${riskyReviews} external review(s) appear to mention risky action phrases (keyword match only).`,
    );
    if (disagreement) {
      reasons.push(
        "External reviews appear to disagree (approve vs revise/revert keyword pattern).",
      );
    }
    return make(
      "do-not-proceed-risky-reviews",
      "Do not proceed until risky review suggestions are resolved",
      "Recommended based on available metadata: resolve risky external-review suggestions manually before asking a builder to implement changes.",
    );
  }

  if (appearsToMentionRevert && highRiskChanges) {
    reasons.push(
      "At least one external review appears to mention revert, and changed-file risk flags/deletes are present.",
    );
    return make(
      "revert-or-restore-before-continuing",
      "Revert or restore before continuing",
      "Recommended based on available metadata: consider Restore Last Safety Backup or a careful revert review before continuing with new builder work.",
    );
  }

  if (!hasVerifiedBackup) {
    if (hasUnverifiedRecord) {
      reasons.push(
        availability?.detail ||
          "A previous Safety Backup record appears to exist, but restore is not verified yet.",
      );
      return make(
        "verify-safety-backup-first",
        "Verify Safety Backup first",
        "Recommended based on available metadata: verify the previous Safety Backup before relying on Restore or asking a builder to change code.",
      );
    }
    reasons.push("No Safety Backup appears to exist yet for this project session.");
    return make(
      "create-safety-backup-first",
      "Create Safety Backup first",
      "Recommended based on available metadata: create a Safety Backup before asking a builder to change code.",
    );
  }

  if (
    hasSummary &&
    input.safeChecks.packageJsonFound &&
    input.safeChecks.available.some((c) => c.available && !c.blocked) &&
    !hasSafeCheck
  ) {
    reasons.push(
      "Allowlisted Build/Test Checks appear available, but none have been run yet.",
    );
    return make(
      "run-build-test-checks-first",
      "Run Build/Test Checks first",
      "Recommended based on available metadata: run an allowlisted Build/Test Check before asking a builder for a patch.",
    );
  }

  if (!hasRequest) {
    reasons.push("No specific user request/goal text was entered.");
    return make(
      "no-clear-builder-task",
      "No clear builder task has been defined yet",
      "Recommended based on available metadata: type a clear goal/request before generating a Builder Prompt.",
    );
  }

  if (!hasSummary && !input.reviewPack && !input.patchReviewPack) {
    reasons.push(
      "No Project Summary, Copy-Paste Review Report, or Patch Review Pack appears available yet.",
    );
    return make(
      "need-more-review-first",
      "Need more review first",
      "Recommended based on available metadata: generate a Project Summary and/or review packs before asking a builder.",
    );
  }

  if (disagreement) {
    reasons.push(
      "External reviews appear to disagree (approve vs revise/revert). Review manually first.",
    );
    return make(
      "need-more-review-first",
      "Need more review first",
      "Recommended based on available metadata: resolve review disagreement manually before builder work.",
    );
  }

  reasons.push("A typed goal exists and core safety/review metadata appears available.");
  if (hasVerifiedBackup) reasons.push("A verified restorable Safety Backup appears to exist.");
  if (hasSafeCheck) {
    reasons.push(
      `Last Build/Test Check: ${input.safeChecks.lastResult!.scriptName} (${input.safeChecks.lastResult!.status}).`,
    );
  }
  if (reviewCount > 0) {
    reasons.push(`${reviewCount} external review(s) are saved for comparison.`);
  }

  return make(
    "ready-for-small-builder-patch",
    "Ready to ask builder for a small patch",
    "Recommended based on available metadata: you appear ready to ask a builder AI for a small, plan-first change. Review the Decision Report and Builder Prompt manually before pasting.",
  );
}

function builderTaskSummary(
  input: DecisionBuilderInput,
  action: RecommendedNextAction,
): string {
  const request = input.userRequest.trim();
  if (!request) {
    return "No clear builder task has been defined yet.";
  }
  if (action.id === "ready-for-small-builder-patch") {
    return `Based on available metadata, the next builder task appears to be: ${request.slice(0, 800)}`;
  }
  return `A user goal was entered (“${request.slice(0, 240)}${request.length > 240 ? "…" : ""}”), but the recommended next action is “${action.label}” first — not immediate implementation.`;
}

/**
 * Builds the Decision Report from safe metadata only (no AI, no raw source).
 */
export function buildDecisionReport(input: DecisionBuilderInput): DecisionReport {
  const trimmedRequest = input.userRequest.trim().slice(0, MAX_REQUEST_CHARS);
  const userRequestIncluded = trimmedRequest.length > 0;
  const projectSelected = Boolean(input.project);
  const limitedContext = !projectSelected || !input.summary;
  const recommended = calculateRecommendedNextAction(input);
  const userRequestText = userRequestIncluded
    ? trimmedRequest
    : "No specific goal was entered.";

  const ext = input.externalReview;
  const comparison = ext.comparison;
  const changed = input.changedFiles;

  const lines: string[] = [
    "# New Type Tech Coder - Decision Report",
    "",
    "## Current Goal",
    "",
    userRequestText,
    "",
    "## Project Context",
    "",
  ];

  if (!projectSelected) {
    lines.push(
      "- **Project selected:** No",
      "- **Note:** Limited Decision Report — select a project for fuller context.",
      "",
    );
  } else {
    lines.push(
      `- **Project name:** ${input.summary?.projectName ?? input.project?.displayName ?? "Unknown"}`,
      `- **Project path:** ${input.project?.normalizedPath ?? "Unknown"}`,
      `- **Likely project type:** ${input.summary?.likelyProjectTypes?.join("; ") || "Not confirmed"}`,
      `- **Detected tech stack:** ${input.summary?.techStack?.length ? input.summary.techStack.join(", ") : "Not confirmed"}`,
      `- **Project Summary available:** ${yesNo(Boolean(input.summary))}`,
      "",
    );
  }

  lines.push(
    ...[
    "## Current Safety State",
    "",
    `- **Mode:** ${input.safety.mode} (Inspect-only)`,
    "- **Live Qwen execution:** Disabled for safety",
    `- **Edit mode available:** ${yesNo(input.safety.editModeAvailable)}`,
    `- **AI file access / writes allowed:** ${yesNo(input.safety.writesAllowed)}`,
    "- **Arbitrary terminal / custom commands:** No",
    `- **Safety Backup created:** ${yesNo(
      Boolean(
        input.checkpointAvailability?.hasPreviousRecord ||
          input.checkpoint ||
          input.safety.checkpointExists,
      ),
    )}`,
    input.checkpointAvailability
      ? `- **Safety Backup status:** ${input.checkpointAvailability.label}`
      : input.checkpoint
        ? `- **Latest Safety Backup:** ${input.checkpoint.methodLabel} at ${input.checkpoint.createdAt}`
        : "- **Latest Safety Backup:** None",
    input.checkpointAvailability
      ? `- **Restore verified:** ${yesNo(input.checkpointAvailability.restorable)}`
      : input.checkpoint
        ? "- **Restore verified:** Yes (current session backup)"
        : "- **Restore verified:** No",
    input.checkpointAvailability?.verificationMessage
      ? `- **Verification result:** ${input.checkpointAvailability.verificationMessage}`
      : null,
    input.safeChecks.lastResult
      ? `- **Last Build/Test Check:** ${input.safeChecks.lastResult.scriptName} — ${input.safeChecks.lastResult.status} (${input.safeChecks.lastResult.plainEnglishSummary})`
      : "- **Last Build/Test Check:** None yet",
    changed
      ? `- **Changed-file status:** ${changed.statusMessage} (total ${changed.totalCount}; risky ${changed.riskyCount})`
      : "- **Changed-file status:** Unavailable (scan not run)",
    "",
    "## Evidence Collected",
    "",
    `- **Project Summary:** ${yesNo(Boolean(input.summary))}`,
    `- **Copy-Paste Review Report:** ${yesNo(Boolean(input.reviewPack))}`,
    `- **Patch Review Pack:** ${yesNo(Boolean(input.patchReviewPack))}`,
    `- **Local AI role response:** ${yesNo(Boolean(input.advisorResponse))}`,
    input.advisorResponse
      ? `- **Local AI role used:** ${input.advisorResponse.roleLabel} (${input.advisorResponse.roleId}) at ${input.advisorResponse.createdAt}`
      : null,
    input.advisorResponse
      ? `- **Local AI role excerpt:** ${input.advisorResponse.responseText
          .slice(0, 400)
          .replace(/\s+/g, " ")
          .trim()}${input.advisorResponse.responseText.length > 400 ? "…" : ""}`
      : null,
    `- **Qwen Prompt Pack:** ${yesNo(Boolean(input.qwen.promptPack))}`,
    `- **External reviews:** ${ext.reviews.length > 0 ? `Yes (${ext.reviews.length})` : "No"}`,
    `- **Safe Check result:** ${yesNo(Boolean(input.safeChecks.lastResult))}`,
    `- **Changed-file scan:** ${yesNo(Boolean(changed))}`,
    `- **Safety Backup verified restorable:** ${yesNo(
      Boolean(input.checkpointAvailability?.restorable || input.checkpoint),
    )}`,
    `- **Project Memory preview exists:** ${yesNo(Boolean(input.projectMemoryPreview))}`,
    `- **Project Memory saved to \`.nttc/\`:** ${yesNo(Boolean(input.projectMemoryLastSaved))}`,
    input.projectMemoryLastSaved
      ? `- **Project Memory last saved:** ${input.projectMemoryLastSaved.savedAt}`
      : "- **Project Memory last saved:** Never",
    input.projectMemoryLastSaved
      ? `- **Project Memory files:** ${input.projectMemoryLastSaved.filesWritten.join(", ")}`
      : null,
    "- **Project Memory note:** `.nttc/` markdown is documentation-only; source code is not edited.",
    `- **Code Context Pack exists:** ${yesNo(Boolean(input.codeContextPreview))}`,
    input.codeContextPreview
      ? `- **Code Context Pack generated:** ${input.codeContextPreview.generatedAt}`
      : "- **Code Context Pack generated:** Never",
    input.codeContextPreview
      ? `- **Code Context selected files:** ${input.codeContextPreview.selectedFileCount}`
      : null,
    input.codeContextPreview
      ? `- **Code Context warnings:** ${input.codeContextPreview.warningCount}`
      : null,
    input.codeContextPreview
      ? `- **Code Context truncated:** ${yesNo(input.codeContextPreview.truncated)}`
      : null,
    "- **Code Context note:** preview/copy to pack; Local AI send requires user confirmation.",
    `- **Code AI response exists:** ${yesNo(Boolean(input.codeContextAiResponse))}`,
    input.codeContextAiResponse
      ? `- **Code AI model:** ${input.codeContextAiResponse.modelName}`
      : "- **Code AI model:** N/A",
    input.codeContextAiResponse
      ? `- **Code AI generated:** ${input.codeContextAiResponse.generatedAt}`
      : "- **Code AI generated:** Never",
    input.codeContextAiResponse
      ? `- **Code AI selected files:** ${input.codeContextAiResponse.selectedFileCount}`
      : null,
    input.codeContextAiResponse
      ? `- **Code AI warnings:** ${input.codeContextAiResponse.warningCount}`
      : null,
    input.codeContextAiResponse
      ? `- **Code AI excerpt:** ${input.codeContextAiResponse.previewExcerpt.split("\n").slice(0, 3).join(" ").slice(0, 220)}`
      : null,
    "- **Code AI note:** used approved Code Context Pack only — no invisible file access.",
    `- **Code Question Template used:** ${yesNo(Boolean(input.codeContextQuestionTemplate))}`,
    input.codeContextQuestionTemplate
      ? `- **Template label:** ${input.codeContextQuestionTemplate.templateLabel}`
      : "- **Template label:** None",
    input.codeContextQuestionTemplate
      ? `- **Template selected:** ${input.codeContextQuestionTemplate.selectedAt}`
      : "- **Template selected:** Never",
    `- **Patch Draft exists:** ${yesNo(Boolean(input.patchDraftResponse))}`,
    input.patchDraftResponse
      ? `- **Patch Draft model:** ${input.patchDraftResponse.modelName}`
      : "- **Patch Draft model:** N/A",
    input.patchDraftResponse
      ? `- **Patch Draft generated:** ${input.patchDraftResponse.generatedAt}`
      : "- **Patch Draft generated:** Never",
    input.patchDraftResponse
      ? `- **Patch Draft selected files:** ${input.patchDraftResponse.selectedFileCount}`
      : null,
    input.patchDraftResponse?.recommendation
      ? `- **Patch Draft recommendation:** ${input.patchDraftResponse.recommendation}`
      : "- **Patch Draft recommendation:** N/A",
    input.patchDraftResponse
      ? `- **Patch Draft excerpt:** ${input.patchDraftResponse.previewExcerpt.split("\n").slice(0, 3).join(" ").slice(0, 220)}`
      : null,
    "- **Patch Draft note:** draft only — NTTC did not edit source files or apply patches.",
    `- **Patch Draft Safety Review exists:** ${yesNo(Boolean(input.patchDraftSafetyReview))}`,
    input.patchDraftSafetyReview
      ? `- **Patch Draft Safety Review generated:** ${input.patchDraftSafetyReview.generatedAt}`
      : "- **Patch Draft Safety Review generated:** Never",
    input.patchDraftSafetyReview
      ? `- **Patch Draft Safety Review recommendation:** ${input.patchDraftSafetyReview.recommendation}`
      : "- **Patch Draft Safety Review recommendation:** N/A",
    input.patchDraftSafetyReview
      ? `- **Patch Draft Safety Review excerpt:** ${input.patchDraftSafetyReview.previewExcerpt.split("\n").slice(0, 3).join(" ").slice(0, 220)}`
      : null,
    "- **Patch Draft Safety Review note:** rule-based review only — NTTC did not apply the patch.",
    `- **Imported Patch Draft exists:** ${yesNo(Boolean(input.importedPatchDraft))}`,
    input.importedPatchDraft
      ? `- **Imported source:** ${input.importedPatchDraft.source}`
      : "- **Imported source:** N/A",
    input.importedPatchDraft
      ? `- **Imported draft type:** ${input.importedPatchDraft.draftType}`
      : "- **Imported draft type:** N/A",
    input.importedPatchDraft
      ? `- **Imported at:** ${input.importedPatchDraft.importedAt}`
      : "- **Imported at:** Never",
    input.importedPatchDraft
      ? `- **Imported risk phrase count:** ${input.importedPatchDraft.riskPhraseCount}`
      : "- **Imported risk phrase count:** N/A",
    input.importedPatchDraft?.likelyFilesAreas.length
      ? `- **Imported likely files/areas:** ${input.importedPatchDraft.likelyFilesAreas.slice(0, 8).join(", ")}`
      : "- **Imported likely files/areas:** None detected",
    input.patchDraftSafetyReview?.reviewTargetKind
      ? `- **Safety review target:** ${input.patchDraftSafetyReview.reviewTargetLabel ?? input.patchDraftSafetyReview.reviewTargetKind}`
      : "- **Safety review target:** N/A",
    "- **Imported Patch Draft note:** text-only import — NTTC did not apply it and does not auto-send to AI.",
    `- **External Patch Draft Comparison exists:** ${yesNo(Boolean(input.externalPatchDraftComparison))}`,
    input.externalPatchDraftComparison
      ? `- **Comparison risk level:** ${input.externalPatchDraftComparison.riskLevel}`
      : "- **Comparison risk level:** N/A",
    input.externalPatchDraftComparison
      ? `- **Comparison recommendation:** ${input.externalPatchDraftComparison.recommendation}`
      : "- **Comparison recommendation:** N/A",
    input.externalPatchDraftComparison
      ? `- **Biggest conflict:** ${input.externalPatchDraftComparison.biggestConflict.slice(0, 220)}`
      : "- **Biggest conflict:** N/A",
    `- **Builder Handoff Pack exists:** ${yesNo(Boolean(input.builderHandoffExport))}`,
    input.builderHandoffExport
      ? `- **Handoff target:** ${input.builderHandoffExport.target}`
      : "- **Handoff target:** N/A",
    input.builderHandoffExport
      ? `- **Handoff strictness:** ${input.builderHandoffExport.strictness}`
      : "- **Handoff strictness:** N/A",
    input.builderHandoffExport
      ? `- **Handoff recommendation:** ${input.builderHandoffExport.recommendation}`
      : "- **Handoff recommendation:** N/A",
    input.builderHandoffExport
      ? `- **Handoff missing context count:** ${input.builderHandoffExport.missingContextCount}`
      : "- **Handoff missing context count:** N/A",
    getPlanningStyleReportLine(input.planningStyle ?? "small-model-friendly"),
    "",
    "## Review Consensus",
    "",
    "This is keyword-based only and should be reviewed manually.",
    "",
  ].filter((line): line is string => line !== null),
  );

  if (ext.reviews.length === 0) {
    lines.push("- **External reviews:** None saved yet.", "");
  } else if (comparison) {
    lines.push(
      `- **External review count:** ${comparison.reviewCount}`,
      `- **Sources represented:** ${comparison.sourcesRepresented.join(", ") || "None"}`,
      `- **Common concern keywords:** ${
        comparison.commonConcernKeywords.length
          ? comparison.commonConcernKeywords.join(", ")
          : "None"
      }`,
      `- **Disagreement indicator:** ${yesNo(comparison.disagreementDetected)}`,
      `- **Risky phrase warnings:** ${comparison.reviewsWithRiskyPhrases}`,
      `- **Needs human decision:** ${yesNo(comparison.needsHumanDecision)}`,
      `- **Summary:** ${comparison.plainEnglish}`,
      "",
    );
  } else {
    lines.push(
      `- **External review count:** ${ext.reviews.length}`,
      "- **Comparison:** Not calculated yet.",
      "",
    );
  }

  const builder = input.builderResult;
  const builderExcerpt = builder
    ? truncateBuilderResultForPack(builder.responseText)
    : null;
  lines.push(
    "## Builder Result",
    "",
    `- **Builder Result exists:** ${yesNo(Boolean(builder))}`,
  );
  if (!builder) {
    lines.push(
      "- **Note:** No builder response has been pasted back yet.",
      "",
    );
  } else {
    lines.push(
      `- **Builder source:** ${builder.source}`,
      `- **Response type:** ${builder.responseType}`,
      `- **Timestamp:** ${builder.savedAt}`,
      `- **Appears as:** ${builder.appearsAs}`,
      `- **Needs review:** ${yesNo(builderResultNeedsReview(builder))}`,
      `- **Risk warnings:** ${
        builder.hasRiskySuggestions
          ? builder.riskyPhrases.join(", ")
          : "None"
      }`,
      `- **Mismatch warnings:** ${
        builder.hasMismatchWarnings
          ? builder.mismatchWarnings.join("; ")
          : "None"
      }`,
      `- **Short excerpt:**`,
      builderExcerpt?.included ? builderExcerpt.text : "(empty)",
      "",
    );
  }

  const backlogItems = input.backlogItems ?? [];
  const backlogOpen = backlogOpenCount(backlogItems);
  const backlogCriticalHigh = backlogOpenCriticalOrHighCount(backlogItems);
  const backlogCriticalSafety = backlogOpenCriticalSafetyCount(backlogItems);
  lines.push(
    "## Bug Log / Improvement Backlog",
    "",
    `- **Open / in-review backlog items:** ${backlogOpen}`,
    `- **Open Critical/High items:** ${backlogCriticalHigh}`,
    `- **Open Critical Safety concerns:** ${backlogCriticalSafety}`,
    backlogCriticalSafety > 0
      ? "- **Note:** Backlog suggests not proceeding until Critical Safety concern(s) are resolved."
      : "- **Note:** No open Critical Safety concerns in the backlog.",
    "",
  );

  const provisionalDecision: DecisionReport = {
    generatedAt: new Date().toISOString(),
    userRequestIncluded,
    userRequestText,
    projectSelected,
    limitedContext,
    recommendedNextAction: recommended,
    markdownReport: "",
    previewExcerpt: "",
    secretSafetyNote: SECRET_SAFETY_NOTE,
  };
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
    reviewPack: input.reviewPack,
    externalReviews: input.externalReview.reviews,
    decisionReport: provisionalDecision,
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
    "## Recommended Next Action",
    "",
    `- **Recommendation:** ${recommended.label}`,
    `- **Plain English:** ${recommended.plainEnglish}`,
    "- **Why (metadata rules):**",
    ...recommended.reasons.map((r) => `  - ${r}`),
    "",
    "## Daily Use Next Action",
    "",
    `- **What should I do next?:** ${dailyNext.title}`,
    `- **Why:** ${dailyNext.reason}`,
    dailyNext.freshnessHints.length
      ? `- **Freshness:** ${dailyNext.freshnessHints.slice(0, 4).join(" | ")}`
      : "- **Freshness:** No extra freshness notes.",
    "",
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
    "## Role Model Mapping",
    "",
    (() => {
      const mapping = input.roleModelMapping;
      const installed = input.installedModels;
      const mappedCount = mapping ? countMappedRoles(mapping.mappings) : 0;
      return [
        `- **Role model mappings set:** ${mappedCount}`,
        `- **Installed models cached:** ${installed?.models.length ?? 0}`,
        installed?.lastRefreshAt
          ? `- **Last model refresh:** ${installed.lastRefreshAt}`
          : "- **Last model refresh:** Not yet",
        input.advisorResponse
          ? `- **Latest Local AI Role model:** ${input.advisorResponse.modelName} (${formatModelSelectionSource(input.advisorResponse.modelSelectionSource)})`
          : "- **Latest Local AI Role model:** None yet",
        input.builderPlan
          ? `- **Latest Builder Plan model:** ${input.builderPlan.modelName} (${formatModelSelectionSource(input.builderPlan.modelSelectionSource)})`
          : "- **Latest Builder Plan model:** None yet",
      ].join("\n");
    })(),
    "",
    "## Builder Task Summary",
    "",
    builderTaskSummary(input, recommended),
    "",
    "## Safety Instructions for Builder",
    "",
    "- Do not rewrite unrelated parts of the app.",
    "- Do not bypass Safety Gate.",
    "- Do not enable live Qwen unless explicitly requested in a future audited stage.",
    "- Do not add edit mode unless explicitly requested in a future audited stage.",
    "- Do not add arbitrary terminal access.",
    "- Do not add custom command typing.",
    "- Keep changes small and reviewable.",
    "- Return a report of files changed and why.",
    "",
    "## Questions Before Building",
    "",
    "1. What exact user problem is being fixed?",
    "2. What files will likely change?",
    "3. What tests/checks should run after?",
    "4. What could break?",
    "5. Should this be reviewed before implementation?",
    "",
    "## Secret Safety Reminder",
    "",
    SECRET_SAFETY_NOTE,
    "",
    "## App Note",
    "",
    "New Type Tech Coder does not edit project files. This Decision Report is guidance for outside tools only.",
    "",
  );

  const markdownReport = lines.join("\n");
  return {
    generatedAt: new Date().toISOString(),
    userRequestIncluded,
    userRequestText,
    projectSelected,
    limitedContext,
    recommendedNextAction: recommended,
    markdownReport,
    previewExcerpt: markdownReport.split("\n").slice(0, 28).join("\n"),
    secretSafetyNote: SECRET_SAFETY_NOTE,
  };
}

/**
 * Builds a plan-only Builder Prompt for pasting into Cursor/Codex/Grok/Claude.
 * Defaults to plan first — not “go code it now.”
 */
export function buildBuilderPromptPack(
  input: DecisionBuilderInput,
  decisionReport?: DecisionReport | null,
): BuilderPromptPack {
  const decision = decisionReport ?? buildDecisionReport(input);
  const recommended = decision.recommendedNextAction;
  const trimmedRequest = input.userRequest.trim().slice(0, MAX_REQUEST_CHARS);
  const userRequestIncluded = trimmedRequest.length > 0;
  const projectSelected = Boolean(input.project);
  const limitedContext = !projectSelected || !input.summary;
  const userRequestText = userRequestIncluded
    ? trimmedRequest
    : "No specific goal was entered.";

  const ext = input.externalReview;
  const changed = input.changedFiles;
  const selectedExcerpt = ext.selected
    ? truncateExternalReviewForPack(ext.selected.reviewText)
    : null;
  const advisorExcerpt = input.advisorResponse
    ? input.advisorResponse.responseText.slice(0, MAX_ADVISOR_EXCERPT)
    : null;

  const lines: string[] = [
    "# New Type Tech Coder - Builder Prompt",
    "",
    getPlanningStyleReportLine(input.planningStyle ?? "small-model-friendly"),
    "",
    "## Role",
    "",
    "You are the builder AI. Plan first — do not implement until the user explicitly approves.",
    "New Type Tech Coder itself does not edit files — you are an outside builder tool (Cursor, Codex, Grok Builder, Claude, etc.).",
    "Default to plan-only output. Wait for approval before writing code.",
    "",
    "## Task",
    "",
    userRequestIncluded
      ? trimmedRequest
      : "No clear builder task has been defined yet. Ask the user to clarify the goal before planning code changes.",
    "",
    `- **Decision Report recommendation:** ${recommended.label}`,
    `- **Recommendation detail:** ${recommended.plainEnglish}`,
    "",
    "## Context (safe metadata only)",
    "",
    "### Project summary",
    input.summary
      ? [
          `- Name: ${input.summary.projectName}`,
          `- Types: ${input.summary.likelyProjectTypes.join("; ") || "unknown"}`,
          `- Tech: ${input.summary.techStack.join(", ") || "unknown"}`,
          `- Important files: ${input.summary.importantFiles.slice(0, 20).join(", ") || "none"}`,
          `- Important folders: ${input.summary.importantFolders.slice(0, 20).join(", ") || "none"}`,
        ].join("\n")
      : "- Project Summary unavailable.",
    "",
    "### Changed-file summary",
    changed
      ? [
          `- Status: ${changed.statusMessage}`,
          `- Total/modified/added/deleted/untracked: ${changed.totalCount}/${changed.modifiedCount}/${changed.addedCount}/${changed.deletedCount}/${changed.untrackedCount}`,
          `- Risky file count: ${changed.riskyCount}`,
          `- Names (truncated): ${
            changed.files
              .slice(0, 30)
              .map((f) => `${f.kind}:${f.path}`)
              .join(", ") || "none"
          }`,
        ].join("\n")
      : "- Changed-file scan unavailable.",
    "",
    "### Safe check result",
    input.safeChecks.lastResult
      ? `- ${input.safeChecks.lastResult.scriptName}: ${input.safeChecks.lastResult.status} — ${input.safeChecks.lastResult.plainEnglishSummary}`
      : "- No Build/Test Check result yet.",
    "",
    "### Review consensus (keyword-based only — review manually)",
    ext.comparison
      ? [
          `- Count: ${ext.comparison.reviewCount}`,
          `- Sources: ${ext.comparison.sourcesRepresented.join(", ") || "none"}`,
          `- Common keywords: ${ext.comparison.commonConcernKeywords.join(", ") || "none"}`,
          `- Disagreement: ${yesNo(ext.comparison.disagreementDetected)}`,
          `- Risky-phrase reviews: ${ext.comparison.reviewsWithRiskyPhrases}`,
          `- Summary: ${ext.comparison.plainEnglish}`,
        ].join("\n")
      : ext.reviews.length === 0
        ? "- No external reviews yet."
        : `- ${ext.reviews.length} external review(s) saved; comparison not calculated.`,
    "",
    "### Selected external review excerpt",
    selectedExcerpt?.included
      ? selectedExcerpt.text
      : "- None selected.",
    "",
    "### Local AI advisor summary",
    advisorExcerpt
      ? `${advisorExcerpt}${input.advisorResponse && input.advisorResponse.responseText.length > MAX_ADVISOR_EXCERPT ? "\n…" : ""}`
      : "- No Local AI Reviewer response yet.",
    "",
    "### Builder Plan Mode (plan-only excerpt — optional)",
    input.builderPlan
      ? [
          `- Generated: ${input.builderPlan.generatedAt}`,
          `- Model: ${input.builderPlan.modelName}`,
          `- Recommendation: ${input.builderPlan.recommendation ?? "Not detected"}`,
          "- Instruction: Use this as planning context only. Do not implement until the user approves.",
          "- Excerpt:",
          input.builderPlan.previewExcerpt.slice(0, 1200),
        ].join("\n")
      : "- No Builder Plan generated yet.",
    "",
    "### Builder Plan Comparison (rule-based — optional)",
    input.builderPlanComparison
      ? [
          `- Recommendation: ${input.builderPlanComparison.recommendation}`,
          `- Imported: ${input.builderPlanComparison.importedSource} / ${input.builderPlanComparison.importedResponseType}`,
          `- Generated: ${input.builderPlanComparison.generatedAt}`,
          input.builderPlanComparison.recommendation ===
            "Ask builder to revise plan first" ||
          input.builderPlanComparison.recommendation === "Do not proceed yet"
            ? "- Instruction: Ask for revision / do not implement yet."
            : input.builderPlanComparison.recommendation ===
                "Ready for user-approved implementation in external builder"
              ? "- Instruction: User may approve implementation externally. NTTC still does not edit files."
              : "- Instruction: Follow the comparison recommendation; default remains plan-only until approval.",
          "- Excerpt:",
          input.builderPlanComparison.previewExcerpt.slice(0, 900),
        ].join("\n")
      : "- No Builder Plan Comparison yet.",
    "",
    "### Implementation Review (rule-based — optional)",
    input.implementationReview
      ? [
          `- Recommendation: ${input.implementationReview.recommendation}`,
          `- Imported: ${input.implementationReview.importedSource} / ${input.implementationReview.importedResponseType}`,
          `- Generated: ${input.implementationReview.generatedAt}`,
          input.implementationReview.recommendation === "Do not proceed yet" ||
          input.implementationReview.recommendation === "Restore from Safety Backup"
            ? "- Instruction: Do not proceed / consider restore before continuing."
            : input.implementationReview.recommendation === "Run Build/Test Checks"
              ? "- Instruction: Run allowlisted Build/Test Checks before trusting implementation claims."
              : input.implementationReview.recommendation === "Generate Patch Review Pack"
                ? "- Instruction: Generate a Patch Review Pack to review changed-file metadata."
                : "- Instruction: Follow the implementation review recommendation; NTTC still does not edit files.",
          "- Excerpt:",
          input.implementationReview.previewExcerpt.slice(0, 900),
        ].join("\n")
      : "- No Implementation Review yet.",
    "",
    "### Patch Draft Mode (draft only — no apply)",
    input.patchDraftResponse
      ? [
          `- Generated: ${input.patchDraftResponse.generatedAt}`,
          `- Model: ${input.patchDraftResponse.modelName}`,
          `- Recommendation: ${input.patchDraftResponse.recommendation ?? "Not detected"}`,
          "- Instruction: Draft only. NTTC did not edit files or apply patches. Use outside builder after review.",
          "- Excerpt:",
          input.patchDraftResponse.previewExcerpt.slice(0, 1200),
        ].join("\n")
      : "- No Patch Draft generated yet.",
    "",
    "### Patch Draft Safety Review (rule-based; no apply)",
    input.patchDraftSafetyReview
      ? [
          `- Generated: ${input.patchDraftSafetyReview.generatedAt}`,
          `- Review target: ${input.patchDraftSafetyReview.reviewTargetLabel ?? input.patchDraftSafetyReview.reviewTargetKind}`,
          `- Source Patch Draft: ${input.patchDraftSafetyReview.sourcePatchDraftGeneratedAt}`,
          `- Recommendation: ${input.patchDraftSafetyReview.recommendation}`,
          "- Instruction: Review only. NTTC did not apply the patch.",
          "- Excerpt:",
          input.patchDraftSafetyReview.previewExcerpt.slice(0, 1200),
        ].join("\n")
      : "- No Patch Draft Safety Review generated yet.",
    "",
    "### Manual Imported Patch Draft (no apply)",
    input.importedPatchDraft
      ? [
          `- Source: ${input.importedPatchDraft.source}`,
          `- Draft type: ${input.importedPatchDraft.draftType}`,
          `- Imported: ${input.importedPatchDraft.importedAt}`,
          `- Risk phrase count: ${input.importedPatchDraft.riskPhraseCount}`,
          `- Likely files/areas: ${
            input.importedPatchDraft.likelyFilesAreas.length
              ? input.importedPatchDraft.likelyFilesAreas.slice(0, 10).join(", ")
              : "None detected"
          }`,
          "- Instruction: Outside proposal only. Run Patch Draft Safety Review before trusting.",
          "- Excerpt:",
          input.importedPatchDraft.previewExcerpt.slice(0, 1200),
        ].join("\n")
      : "- No Manual Imported Patch Draft saved yet.",
    "",
    "### External Patch Draft Comparison (rule-based; no apply)",
    input.externalPatchDraftComparison
      ? [
          `- Generated: ${input.externalPatchDraftComparison.generatedAt}`,
          `- Risk level: ${input.externalPatchDraftComparison.riskLevel}`,
          `- Recommendation: ${input.externalPatchDraftComparison.recommendation}`,
          `- Biggest conflict: ${input.externalPatchDraftComparison.biggestConflict.slice(0, 220)}`,
          `- NTTC draft present: ${input.externalPatchDraftComparison.nttcPatchDraftExisted ? "Yes" : "No"}`,
          `- Imported draft present: ${input.externalPatchDraftComparison.importedPatchDraftExisted ? "Yes" : "No"}`,
          "- Instruction: Comparison only — NTTC did not apply any patch.",
          "- Excerpt:",
          input.externalPatchDraftComparison.previewExcerpt.slice(0, 1200),
        ].join("\n")
      : "- No External Patch Draft Comparison generated yet.",
    "",
    "### Builder Handoff Export (text-only; no apply)",
    input.builderHandoffExport
      ? [
          `- Generated: ${input.builderHandoffExport.generatedAt}`,
          `- Target: ${input.builderHandoffExport.target}`,
          `- Strictness: ${input.builderHandoffExport.strictness}`,
          `- Recommendation: ${input.builderHandoffExport.recommendation}`,
          `- Missing context count: ${input.builderHandoffExport.missingContextCount}`,
          "- Instruction: Handoff only — NTTC did not send or apply anything.",
          "- Excerpt:",
          input.builderHandoffExport.previewExcerpt.slice(0, 1200),
        ].join("\n")
      : "- No Builder Handoff Pack generated yet.",
    "",
    "### Previous Builder Result (summary only — not full paste)",
  ];

  const prevBuilder = input.builderResult;
  if (!prevBuilder) {
    lines.push("- No previous Builder Result saved.", "");
  } else {
    const prevExcerpt = truncateBuilderResultForPack(prevBuilder.responseText);
    lines.push(
      `- Source: ${prevBuilder.source}`,
      `- Response type: ${prevBuilder.responseType}`,
      `- Saved at: ${prevBuilder.savedAt}`,
      `- Appears as: ${prevBuilder.appearsAs}`,
      `- Risk warnings: ${
        prevBuilder.hasRiskySuggestions
          ? prevBuilder.riskyPhrases.join(", ")
          : "None"
      }`,
      `- Mismatch warnings: ${
        prevBuilder.hasMismatchWarnings
          ? prevBuilder.mismatchWarnings.join("; ")
          : "None"
      }`,
      "- Instruction: Address any unresolved warnings from the previous result before proposing a new plan.",
      "- Previous excerpt:",
      prevExcerpt.included ? prevExcerpt.text : "(empty)",
      "",
    );
  }

  lines.push(
    "## Strict Boundaries",
    "",
    "- Do not make broad rewrites.",
    "- Do not touch unrelated files.",
    "- Do not disable safety features.",
    "- Do not add live Qwen execution.",
    "- Do not add edit mode.",
    "- Do not add arbitrary terminal/custom command features.",
    "- Do not install packages unless explicitly approved.",
    "- Do not edit secrets or .env.",
    "- Do not change packaged safety defaults.",
    "",
    "## Required Output",
    "",
    "Return:",
    "",
    "1. **Plan first, no code yet.**",
    "2. **Files likely to change.**",
    "3. **Risk assessment.**",
    "4. **Test/check plan.**",
    "5. **Wait for approval before implementation.**",
    "",
    "## Secret Safety Reminder",
    "",
    SECRET_SAFETY_NOTE,
    "",
  );

  const markdownLines = appendExpandedPlanningGuidance(
    lines,
    input.planningStyle ?? "small-model-friendly",
  );
  const markdownReport = markdownLines.join("\n");
  return {
    generatedAt: new Date().toISOString(),
    userRequestIncluded,
    userRequestText,
    projectSelected,
    limitedContext,
    planOnly: true,
    recommendedNextAction: recommended,
    markdownReport,
    previewExcerpt: markdownReport.split("\n").slice(0, 28).join("\n"),
    secretSafetyNote: SECRET_SAFETY_NOTE,
  };
}
