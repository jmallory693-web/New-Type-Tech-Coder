/** Stage 90: rule-based summary for Task Implementation Intake. */

import type { TaskImplementationReportParseResult } from "./parseTaskImplementationReport";
import type { TaskImplementationBuilderSource } from "./taskImplementationIntakeConstants";

export function recommendTaskImplementationNextStep(input: {
  parse: TaskImplementationReportParseResult;
  markedImplementationReturned: boolean;
  markedReviewed: boolean;
  hasImplementationReview: boolean;
  hasBlockers: boolean;
}): string {
  if (input.hasBlockers) {
    return "Do not proceed yet — report mentions blockers.";
  }
  if (!input.markedImplementationReturned) {
    return "Mark task Implementation Returned, then run Implementation Review.";
  }
  if (!input.hasImplementationReview) {
    return "Run Implementation Review.";
  }
  if (!input.markedReviewed) {
    return "Mark task Reviewed after Implementation Review.";
  }
  if (input.parse.missingExpectedSections.includes("Validation performed")) {
    return "Ask builder for missing validation.";
  }
  if (input.parse.detectedFilesChanged.length === 0) {
    return "Ask builder to clarify changed files.";
  }
  return "Move to the next phase task card.";
}

export function buildTaskImplementationIntakeSummary(input: {
  taskId: string;
  taskTitle: string;
  builderSource: TaskImplementationBuilderSource;
  savedAt: string;
  markedImplementationReturned: boolean;
  markedReviewed: boolean;
  stale: boolean;
  truncationFlag: boolean;
  parse: TaskImplementationReportParseResult;
  hasImplementationReview: boolean;
}): string {
  const reportStatus = input.stale
    ? "Stale — task card missing or regenerated."
    : input.markedReviewed
      ? "Reviewed"
      : input.markedImplementationReturned
        ? "Implementation returned"
        : "Saved — not marked returned yet";

  const recommended = recommendTaskImplementationNextStep({
    parse: input.parse,
    markedImplementationReturned: input.markedImplementationReturned,
    markedReviewed: input.markedReviewed,
    hasImplementationReview: input.hasImplementationReview,
    hasBlockers:
      input.parse.detectedRisksBlockers.some((r) =>
        /blocker|could not complete|unable to finish/i.test(r),
      ),
  });

  const lines = [
    "# NTTC Task Implementation Intake Summary",
    "",
    "## Task",
    `- **ID:** ${input.taskId}`,
    `- **Title:** ${input.taskTitle}`,
    "",
    "## Builder / Source",
    input.builderSource,
    "",
    "## Report Status",
    reportStatus,
    input.truncationFlag
      ? "_Report text was truncated for safe storage size._"
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
    "## Recommended Next Step",
    recommended,
    "",
    "## Safety Reminder",
    "This intake stores pasted text only. NTTC does not read changed source files, apply patches, run commands, or send this report to AI automatically.",
    "",
    `_Saved at ${input.savedAt}._`,
  ].filter((line) => line !== null);

  return lines.join("\n");
}

export function buildTaskImplementationPlanningNote(input: {
  reports: Array<{
    taskId: string;
    taskTitle: string;
    builderSource: string;
    savedAt: string;
    markedImplementationReturned: boolean;
    markedReviewed: boolean;
    stale: boolean;
    reportExcerpt: string;
  }>;
}): string | null {
  if (input.reports.length === 0) return null;
  const lines = [
    "## Task implementation reports (summary)",
    "",
    "_Latest saved implementation reports per task. Full bodies are not included here._",
    "",
  ];
  for (const r of input.reports) {
    lines.push(`### ${r.taskId} — ${r.taskTitle}`);
    lines.push(`- Builder: ${r.builderSource}`);
    lines.push(`- Saved: ${r.savedAt}`);
    lines.push(`- Status: ${r.stale ? "stale" : r.markedReviewed ? "reviewed" : r.markedImplementationReturned ? "implementation returned" : "saved"}`);
    if (r.reportExcerpt.trim()) {
      lines.push("", "```", r.reportExcerpt.trim(), "```", "");
    }
  }
  return lines.join("\n");
}
