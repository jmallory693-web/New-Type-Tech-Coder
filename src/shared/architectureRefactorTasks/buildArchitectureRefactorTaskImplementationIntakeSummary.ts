/** Stage 106: rule-based summary for Architecture Refactor Implementation Intake. */

import type { ArchitectureRefactorImplementationReportParseResult } from "./parseArchitectureRefactorTaskImplementationReport";
import type { ArchitectureRefactorImplementationBuilderSource } from "./architectureRefactorTaskImplementationIntakeConstants";
import { ARCHITECTURE_REFACTOR_BEHAVIOR_CHANGE_WARNING } from "./architectureRefactorTaskImplementationIntakeConstants";
import type { ChangedFilesScanResult, ChangedFilesTaskLinkRecord } from "../types";

export function compareRefactorReportToChangedFilesMetadata(input: {
  detectedFilesChanged: string[];
  changedFilesScan: ChangedFilesScanResult | null;
  changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
}): string[] {
  const warnings: string[] = [];
  const scanPaths = new Set(
    (input.changedFilesScan?.files ?? []).map((f) =>
      f.path.replace(/\\/g, "/").toLowerCase(),
    ),
  );
  const linkPaths = new Set(
    (input.changedFilesTaskLink?.changedFilePaths ?? []).map((p) =>
      p.replace(/\\/g, "/").toLowerCase(),
    ),
  );
  const metadataPaths = new Set([...scanPaths, ...linkPaths]);

  const reported = input.detectedFilesChanged.map((p) =>
    p.replace(/\\/g, "/").toLowerCase(),
  );

  if (metadataPaths.size > 0 && reported.length === 0) {
    warnings.push(
      "Changed-files metadata exists but report lists no changed files.",
    );
  }

  for (const path of reported) {
    if (metadataPaths.size > 0 && !metadataPaths.has(path)) {
      warnings.push(
        `Report claims changed file not in changed-files metadata: ${path}`,
      );
    }
    if (/App\.tsx|main\/index\.ts/i.test(path) && metadataPaths.size === 0) {
      warnings.push(
        `Report mentions high-risk file ${path} — verify against your changed-files scan.`,
      );
    }
  }

  for (const path of metadataPaths) {
    if (/App\.tsx|main\/index\.ts/i.test(path) && !reported.some((r) => r.includes(path.split("/").pop() ?? path))) {
      warnings.push(
        `Changed-files metadata includes high-risk ${path} not mentioned in report.`,
      );
    }
  }

  return [...new Set(warnings)].slice(0, 8);
}

export function recommendArchitectureRefactorImplementationNextStep(input: {
  parse: ArchitectureRefactorImplementationReportParseResult;
  markedImplementationReturned: boolean;
  markedReviewed: boolean;
  hasImplementationReview: boolean;
  behaviorChangeWarning: boolean;
}): string {
  if (input.behaviorChangeWarning) {
    return ARCHITECTURE_REFACTOR_BEHAVIOR_CHANGE_WARNING;
  }
  if (
    input.parse.detectedRisksBlockers.some((r) =>
      /blocker|could not complete|unable to finish/i.test(r),
    )
  ) {
    return "Do not proceed yet — report mentions blockers.";
  }
  if (!input.markedImplementationReturned) {
    return "Mark refactor task Implementation Returned, then run Implementation Review.";
  }
  if (!input.hasImplementationReview) {
    return "Run Implementation Review.";
  }
  if (!input.markedReviewed) {
    return "Mark refactor reviewed only after Implementation Review and behavior preservation confirmed.";
  }
  if (input.parse.missingExpectedSections.includes("Validation performed")) {
    return "Ask builder for missing validation.";
  }
  if (input.parse.detectedFilesChanged.length === 0) {
    return "Ask builder to clarify changed files.";
  }
  if (input.parse.missingBehaviorPreservationChecks.length > 0) {
    return "Do not mark reviewed until behavior preservation is confirmed.";
  }
  return "Move to the next architecture refactor task.";
}

export function findNextRefactorTaskId(
  cards: Array<{ id: string; status: string }>,
  currentId: string,
): string | null {
  const idx = cards.findIndex((c) => c.id === currentId);
  if (idx < 0) return cards.find((c) => c.status !== "reviewed")?.id ?? null;
  for (let i = idx + 1; i < cards.length; i += 1) {
    if (cards[i]!.status !== "reviewed") return cards[i]!.id;
  }
  return cards.find((c) => c.id !== currentId && c.status !== "reviewed")?.id ?? null;
}

export function buildArchitectureRefactorTaskImplementationIntakeSummary(input: {
  taskId: string;
  taskTitle: string;
  refactorTarget: string;
  builderSource: ArchitectureRefactorImplementationBuilderSource;
  savedAt: string;
  markedImplementationReturned: boolean;
  markedReviewed: boolean;
  stale: boolean;
  truncationFlag: boolean;
  parse: ArchitectureRefactorImplementationReportParseResult;
  hasImplementationReview: boolean;
  changedFilesScopeWarnings: string[];
}): string {
  const reportStatus = input.stale
    ? "Stale — refactor task missing or cards regenerated."
    : input.markedReviewed
      ? "Reviewed"
      : input.markedImplementationReturned
        ? "Implementation returned"
        : "Saved — not marked returned yet";

  const recommended = recommendArchitectureRefactorImplementationNextStep({
    parse: input.parse,
    markedImplementationReturned: input.markedImplementationReturned,
    markedReviewed: input.markedReviewed,
    hasImplementationReview: input.hasImplementationReview,
    behaviorChangeWarning: input.parse.behaviorChangeWarning,
  });

  const lines = [
    "# NTTC Architecture Refactor Implementation Intake Summary",
    "",
    "## Refactor Task",
    `- **ID:** ${input.taskId}`,
    `- **Title:** ${input.taskTitle}`,
    `- **Refactor target:** ${input.refactorTarget}`,
    "",
    "## Builder / Source",
    input.builderSource,
    "",
    "## Report Status",
    reportStatus,
    input.truncationFlag
      ? "_Report text was truncated for safe storage size._"
      : null,
    input.parse.behaviorChangeWarning
      ? `_Warning: ${ARCHITECTURE_REFACTOR_BEHAVIOR_CHANGE_WARNING}_`
      : null,
    "",
    "## Detected Files Changed",
    ...(input.parse.detectedFilesChanged.length
      ? input.parse.detectedFilesChanged.map((f) => `- ${f}`)
      : ["- None clearly detected by keyword rules."]),
    "",
    "## Validation Mentioned",
    ...(input.parse.detectedValidationMentions.length
      ? input.parse.detectedValidationMentions.map((v) => `- ${v}`)
      : ["- None clearly mentioned."]),
    "",
    "## Behavior Preservation Mentioned",
    ...(input.parse.detectedBehaviorPreservationMentions.length
      ? input.parse.detectedBehaviorPreservationMentions.map((b) => `- ${b}`)
      : ["- None clearly mentioned."]),
    input.parse.missingBehaviorPreservationChecks.length > 0
      ? [
          "",
          "### Missing behavior-preservation checks",
          ...input.parse.missingBehaviorPreservationChecks.map((m) => `- ${m}`),
        ].join("\n")
      : null,
    "",
    "## Risks / Blockers",
    ...(input.parse.detectedRisksBlockers.length
      ? input.parse.detectedRisksBlockers.map((r) => `- ${r}`)
      : ["- None clearly mentioned."]),
    "",
    "## Safety Confirmations",
    ...(input.parse.detectedSafetyConfirmations.length
      ? input.parse.detectedSafetyConfirmations.map((s) => `- ${s}`)
      : ["- None clearly mentioned."]),
    "",
    "## Missing Report Sections",
    ...(input.parse.missingExpectedSections.length
      ? input.parse.missingExpectedSections.map((m) => `- ${m}`)
      : ["- None — all expected sections appear present."]),
    "",
    input.changedFilesScopeWarnings.length > 0
      ? [
          "## Changed-Files Metadata Comparison",
          ...input.changedFilesScopeWarnings.map((w) => `- ${w}`),
          "",
        ].join("\n")
      : null,
    "## Recommended Next Step",
    recommended,
    "",
    "## Safety Reminder",
    "This intake stores pasted text only. NTTC does not read changed source files, inspect diffs, apply patches, run commands, or send this report to AI automatically.",
    "",
    `_Saved at ${input.savedAt}._`,
  ].filter((line) => line !== null);

  return lines.join("\n");
}

export function buildArchitectureRefactorImplementationPlanningNote(input: {
  reports: Array<{
    taskId: string;
    taskTitle: string;
    refactorTarget: string;
    builderSource: string;
    savedAt: string;
    markedImplementationReturned: boolean;
    markedReviewed: boolean;
    stale: boolean;
    reportExcerpt: string;
  }>;
}): string | null {
  if (input.reports.length === 0) return null;
  const reviewed = input.reports.filter((r) => r.markedReviewed && !r.stale).length;
  const stale = input.reports.filter((r) => r.stale).length;
  const lines = [
    "## Architecture refactor implementation reports (summary)",
    "",
    `Architecture refactor implementation reports exist: ${input.reports.length} reports, ${reviewed} reviewed, ${stale} stale.`,
    "",
    "_Latest saved refactor implementation reports. Full bodies are not included here._",
    "",
  ];
  for (const r of input.reports) {
    lines.push(`### ${r.taskId} — ${r.taskTitle}`);
    lines.push(`- Refactor target: ${r.refactorTarget}`);
    lines.push(`- Builder: ${r.builderSource}`);
    lines.push(`- Saved: ${r.savedAt}`);
    lines.push(
      `- Status: ${r.stale ? "stale" : r.markedReviewed ? "reviewed" : r.markedImplementationReturned ? "implementation returned" : "saved"}`,
    );
    if (r.reportExcerpt.trim()) {
      lines.push("", "```", r.reportExcerpt.trim(), "```", "");
    }
  }
  return lines.join("\n");
}

export function refactorReportStatusLabel(input: {
  hasReport: boolean;
  stale: boolean;
  markedImplementationReturned: boolean;
  markedReviewed: boolean;
}): string {
  if (!input.hasReport) return "no report";
  if (input.stale) return "report stale";
  if (input.markedReviewed) return "reviewed";
  if (input.markedImplementationReturned) return "implementation returned";
  return "report saved";
}
