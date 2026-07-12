import type {
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  BuilderPromptPack,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointRecord,
  DecisionReport,
  ExternalReviewState,
  ImplementationReviewRecord,
  OutsideReviewPack,
  PatchReviewPack,
  ProjectInfo,
  ProjectScanResult,
  ProviderStatus,
  SafeChecksState,
  SafetyGateStatus,
} from "../../shared/types";
import {
  builderResultNeedsReview,
  truncateBuilderResultForPack,
} from "./BuilderResultManager";
import { truncateExternalReviewForPack } from "./ExternalReviewManager";
import { formatModelSelectionSource } from "../../shared/roleModelMapping";

const SECRET_SAFETY_NOTE =
  "This Patch Review Pack does not include raw source code, full diffs, .env contents, secrets, keys, or certificates. It lists changed file names, change types, limited line-count stats, and risk flags only.";

const MAX_REQUEST_CHARS = 4000;
const MAX_FILES_IN_PACK = 60;

export interface PatchReviewPackInput {
  userRequest: string;
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  safety: SafetyGateStatus;
  provider: ProviderStatus;
  checkpoint: CheckpointRecord | null;
  safeChecks: SafeChecksState;
  changedFiles: ChangedFilesScanResult | null;
  reviewPack: OutsideReviewPack | null;
  externalReview: ExternalReviewState;
  decisionReport: DecisionReport | null;
  builderPrompt: BuilderPromptPack | null;
  builderResult: BuilderResultRecord | null;
  builderPlan?: BuilderPlanRecord | null;
  builderPlanComparison?: BuilderPlanComparisonRecord | null;
  implementationReview?: ImplementationReviewRecord | null;
}

function bulletList(items: string[], emptyLabel: string): string[] {
  if (items.length === 0) return [`- ${emptyLabel}`];
  return items.map((item) => `- ${item}`);
}

/**
 * Builds a Patch Review Pack from changed-file metadata only.
 * Never includes full diffs, raw source, or secrets.
 */
export function buildPatchReviewPack(input: PatchReviewPackInput): PatchReviewPack {
  const trimmedRequest = input.userRequest.trim().slice(0, MAX_REQUEST_CHARS);
  const userRequestIncluded = trimmedRequest.length > 0;
  const projectSelected = Boolean(input.project);
  const changed = input.changedFiles;
  const changedFilesAvailable = Boolean(changed?.isGitRepo && !changed.errorMessage);
  const limitedContext = !projectSelected || !changedFilesAvailable;

  const userRequestText = userRequestIncluded
    ? trimmedRequest
    : "No specific user request was entered.";

  const lines: string[] = [
    "# New Type Tech Coder - Patch Review Pack",
    "",
    "## Reviewer Role",
    "",
    "You are reviewing a patch that another builder tool (Cursor, Codex, Grok, Claude, etc.) may have applied to a local project.",
    "Focus on bugs, safety issues, architecture problems, missing tests, and risky changes.",
    "New Type Tech Coder did not edit these files — it only observed Git status metadata.",
    "Do not assume the app can edit files, run live Qwen, give AI file access, or run arbitrary terminals.",
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
      "- **Note:** Select a project folder and scan changed files for useful patch context.",
      "",
    );
  } else {
    lines.push(
      `- **Project name:** ${input.summary?.projectName ?? input.project?.displayName ?? "Unknown"}`,
      `- **Project path:** ${input.project?.normalizedPath ?? "Unknown"}`,
      `- **Likely project type:** ${input.summary?.likelyProjectTypes?.join("; ") || "Not confirmed (run Project Summary)"}`,
      `- **Detected tech stack:** ${input.summary?.techStack?.length ? input.summary.techStack.join(", ") : "Not confirmed"}`,
      `- **Project summary available:** ${input.summary ? "Yes" : "No"}`,
      `- **Normal Copy-Paste Review Report exists:** ${input.reviewPack ? "Yes" : "No"}`,
      "",
    );
  }

  lines.push("## Changed Files Summary", "");

  if (!changed) {
    lines.push(
      "- **Changed-files scan:** Not run yet",
      "- **Note:** Click Scan Changed Files first (Git required).",
      "",
    );
  } else if (!changed.isGitRepo || changed.errorMessage) {
    lines.push(
      `- **Git available:** ${changed.gitAvailable ? "Yes" : "No"}`,
      `- **Is Git repo:** ${changed.isGitRepo ? "Yes" : "No"}`,
      `- **Status:** ${changed.statusMessage}`,
      changed.errorMessage ? `- **Error:** ${changed.errorMessage}` : "",
      "",
    );
  } else {
    lines.push(
      `- **Scanned at:** ${changed.scannedAt}`,
      `- **Branch:** ${changed.branchName ?? "unknown"}`,
      `- **Total changed files:** ${changed.totalCount}`,
      `- **Modified:** ${changed.modifiedCount}`,
      `- **Added:** ${changed.addedCount}`,
      `- **Deleted:** ${changed.deletedCount}`,
      `- **Renamed:** ${changed.renamedCount}`,
      `- **Untracked:** ${changed.untrackedCount}`,
      `- **Files with risk flags:** ${changed.riskyCount}`,
      changed.manyFilesWarning ? `- **Warning:** ${changed.manyFilesWarning}` : "",
      changed.truncationNote ? `- **List note:** ${changed.truncationNote}` : "",
      "",
      "### Files",
      "",
    );

    const shown = changed.files.slice(0, MAX_FILES_IN_PACK);
    if (shown.length === 0) {
      lines.push("- None (working tree clean)");
    } else {
      for (const file of shown) {
        const stats =
          file.insertions != null || file.deletions != null
            ? ` (+${file.insertions ?? "?"}/-${file.deletions ?? "?"})`
            : "";
        const rename = file.previousPath ? ` (from ${file.previousPath})` : "";
        const risks =
          file.riskFlags.length > 0
            ? ` — risks: ${file.riskFlags.map((r) => r.label).join("; ")}`
            : "";
        const skip = file.skippedBySafety
          ? ` — safety note: ${file.skipReason ?? "name only"}`
          : "";
        lines.push(`- **${file.kind}:** \`${file.path}\`${rename}${stats}${risks}${skip}`);
      }
      if (changed.files.length > MAX_FILES_IN_PACK) {
        lines.push(
          `- …and ${changed.files.length - MAX_FILES_IN_PACK} more listed in the app UI (truncated here)`,
        );
      }
    }
    lines.push("");

    if (changed.skippedOutsideOrDenied.length > 0) {
      lines.push(
        "### Skipped / denied paths (names only)",
        "",
        ...bulletList(
          changed.skippedOutsideOrDenied
            .slice(0, 20)
            .map((s) => `${s.path}: ${s.reason}`),
          "None",
        ),
        "",
      );
    }
  }

  lines.push(
    "## Safety State",
    "",
    `- **Mode:** ${input.safety.mode} (Inspect-only: no edits allowed)`,
    `- **Edit mode available:** ${input.safety.editModeAvailable ? "Yes" : "No"}`,
    `- **File editing available:** ${input.safety.writesAllowed ? "Yes" : "No"}`,
    "- **Live Qwen execution:** Disabled for safety",
    "- **AI file access:** No",
    "- **Arbitrary terminal / custom commands:** No",
    `- **Safety Backup created:** ${input.safety.checkpointExists ? "Yes" : "No"}`,
    input.checkpoint
      ? `- **Latest Safety Backup:** ${input.checkpoint.methodLabel} at ${input.checkpoint.createdAt}`
      : "- **Latest Safety Backup:** None",
    input.safeChecks.lastResult
      ? `- **Last Build/Test Check:** ${input.safeChecks.lastResult.scriptName} — ${input.safeChecks.lastResult.status} (${input.safeChecks.lastResult.plainEnglishSummary})`
      : "- **Last Build/Test Check:** None yet",
    `- **Local AI reviewer:** ${input.provider.message}`,
    "",
    "## Risk Warnings",
    "",
  );

  const riskLines: string[] = [];
  if (changed?.globalRiskFlags?.length) {
    for (const flag of changed.globalRiskFlags) {
      riskLines.push(`- **${flag.label}:** ${flag.plainEnglish}`);
    }
  }
  if (changed?.files) {
    for (const file of changed.files) {
      for (const flag of file.riskFlags) {
        riskLines.push(`- \`${file.path}\` — ${flag.plainEnglish}`);
      }
    }
  }
  if (riskLines.length === 0) {
    lines.push("- No risk flags from the latest changed-files scan.", "");
  } else {
    // Deduplicate exact lines
    const unique = [...new Set(riskLines)].slice(0, 80);
    lines.push(...unique, "");
    if (riskLines.length > 80) {
      lines.push(`- …and ${riskLines.length - 80} more risk notes omitted for brevity.`, "");
    }
  }

  const ext = input.externalReview;
  lines.push(
    "## External Reviews / Comparison",
    "",
    `- **External review count:** ${ext.reviews.length}`,
    `- **Sources represented:** ${
      ext.reviews.length
        ? [...new Set(ext.reviews.map((r) => r.source))].join(", ")
        : "None"
    }`,
    `- **Reviews with risky phrase warnings:** ${
      ext.reviews.filter((r) => r.hasRiskySuggestions).length
    }`,
  );
  if (ext.comparison) {
    lines.push(
      `- **Comparison method:** ${ext.comparison.methodNote}`,
      `- **Comparison summary:** ${ext.comparison.plainEnglish}`,
      `- **Needs human decision:** ${ext.comparison.needsHumanDecision ? "Yes" : "No"}`,
      "",
    );
  } else {
    lines.push("", "");
  }
  if (ext.selected) {
    const excerpt = truncateExternalReviewForPack(ext.selected.reviewText);
    lines.push(
      `### Selected review (${ext.selected.source}${ext.selected.label ? ` · ${ext.selected.label}` : ""})`,
      "",
      excerpt.text || "(empty)",
      "",
    );
  } else {
    lines.push("- **Selected review excerpt:** None selected", "");
  }

  lines.push(
    "## Decision Report / Builder Prompt",
    "",
    `- **Decision Report exists:** ${input.decisionReport ? "Yes" : "No"}`,
    `- **Builder Prompt exists:** ${input.builderPrompt ? "Yes" : "No"}`,
    `- **Recommended next action:** ${
      input.decisionReport?.recommendedNextAction.label ??
      input.builderPrompt?.recommendedNextAction.label ??
      "Not calculated yet"
    }`,
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

  const builderResult = input.builderResult;
  lines.push(
    "## Builder Result Import",
    "",
    `- **Builder Result exists:** ${builderResult ? "Yes" : "No"}`,
  );
  if (!builderResult) {
    lines.push("- **Note:** No builder response pasted back yet.", "");
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
      "### Builder Result excerpt",
      "",
      excerpt.text || "(empty)",
      "",
    );
  }

  lines.push(
    "## Questions for Reviewer",
    "",
    "1. Do these changed files match the intended task?",
    "2. What files should be reviewed most carefully?",
    "3. Are any risky files touched?",
    "4. What tests/checks should be run?",
    "5. Should this patch be accepted, revised, or reverted?",
    "6. What should I ask the builder AI to fix next?",
    "",
    "## Requested Output",
    "",
    "Please return:",
    "",
    "- **Approve / revise / revert recommendation**",
    "- **Top risks**",
    "- **Missing tests**",
    "- **Next builder prompt** (what to ask Cursor/Codex/Grok/Claude next)",
    "",
    "## Secret Safety Reminder",
    "",
    SECRET_SAFETY_NOTE,
    "",
    "## App Note",
    "",
    "New Type Tech Coder does not edit these files. It only reports what changed.",
    "",
  );

  if (limitedContext) {
    lines.push(
      "## Limited Context Notice",
      "",
      !projectSelected
        ? "Generated without a selected project folder."
        : "Generated without a successful Git changed-files scan.",
      "",
    );
  }

  const markdownReport = lines.filter((l) => l !== undefined).join("\n");
  const previewExcerpt = markdownReport.split("\n").slice(0, 28).join("\n");

  return {
    generatedAt: new Date().toISOString(),
    userRequestIncluded,
    userRequestText,
    projectSelected,
    changedFilesAvailable,
    limitedContext,
    markdownReport,
    previewExcerpt,
    secretSafetyNote: SECRET_SAFETY_NOTE,
    changedFileCount: changed?.totalCount ?? 0,
    riskyCount: changed?.riskyCount ?? 0,
  };
}
