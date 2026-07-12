import type {
  CodeContextBlockedEntry,
  CodeContextIncludedFile,
  CodeContextPack,
  DecisionReport,
  ImplementationReviewRecord,
  OutsideReviewPack,
  ProjectInfo,
  ProjectMemorySavedRecord,
  ProjectScanResult,
} from "../../shared/types";
import {
  CODE_CONTEXT_MAX_INCLUDED_FILES,
  CODE_CONTEXT_PREVIEW_NOTE,
  DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS,
} from "../../shared/codeContextConstants";

export interface BuildCodeContextPackInput {
  userQuestion: string;
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  decisionReport: DecisionReport | null;
  builderPlanExcerpt: string | null;
  implementationReview: ImplementationReviewRecord | null;
  projectMemoryLastSaved: ProjectMemorySavedRecord | null;
  includedFiles: CodeContextIncludedFile[];
  blockedFiles: CodeContextBlockedEntry[];
  selectedCount: number;
  blockedCount: number;
  maxTotalChars: number;
  truncationFlags: string[];
}

function excerpt(text: string | null | undefined, max: number): string {
  if (!text?.trim()) return "_Not available._";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n…(excerpt truncated)`;
}

export function buildCodeContextPack(input: BuildCodeContextPackInput): CodeContextPack {
  const generatedAt = new Date().toISOString();
  const maxTotal = input.maxTotalChars || DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS;

  let included = input.includedFiles.slice(0, CODE_CONTEXT_MAX_INCLUDED_FILES);
  let totalChars = included.reduce((sum, f) => sum + f.content.length, 0);
  const flags = [...input.truncationFlags];

  if (totalChars > maxTotal) {
    const trimmed: CodeContextIncludedFile[] = [];
    let used = 0;
    for (const file of included) {
      const remaining = maxTotal - used;
      if (remaining <= 0) break;
      if (file.content.length <= remaining) {
        trimmed.push(file);
        used += file.content.length;
      } else {
        trimmed.push({
          ...file,
          content: `${file.content.slice(0, remaining)}\n\nTRUNCATED: pack total character limit reached`,
          truncated: true,
          warnings: [...file.warnings, "Pack total character limit reached"],
        });
        used = maxTotal;
        flags.push(`Pack truncated at ${maxTotal} total characters.`);
        break;
      }
    }
    included = trimmed;
    totalChars = used;
  }

  const lines: string[] = [
    "# NTTC Code Context Pack",
    "",
    `> ${CODE_CONTEXT_PREVIEW_NOTE}`,
    "",
    "## User Question",
    "",
    input.userQuestion.trim() || "_No question entered yet._",
    "",
    "## Pack Status",
    "",
    `- **Generated:** ${generatedAt}`,
    `- **Project:** ${input.project?.displayName ?? "No project selected"}`,
    `- **Selected files:** ${input.selectedCount}`,
    `- **Included files:** ${included.length}`,
    `- **Blocked files (count):** ${input.blockedCount}`,
    `- **Estimated characters:** ${totalChars}`,
    `- **Truncation:** ${flags.length ? flags.join("; ") : "None"}`,
    "",
    "## Safety Boundaries",
    "",
    "- This is selected-code context only",
    "- No secrets should be included",
    "- AI should not assume it has the whole project",
    "- AI should not ask NTTC to edit files",
    "- AI should not ask NTTC to run arbitrary commands",
    "- AI should answer based only on included excerpts",
    "",
    "## Project Context",
    "",
    "### Project Summary (excerpt)",
    excerpt(input.summary?.markdownReport, 1200),
    "",
    "### Decision Report (excerpt)",
    excerpt(input.decisionReport?.previewExcerpt, 800),
    "",
    "### Builder Plan (excerpt)",
    excerpt(input.builderPlanExcerpt, 800),
    "",
    "### Implementation Review (excerpt)",
    excerpt(input.implementationReview?.previewExcerpt, 800),
    "",
    "### Project Memory status",
    input.projectMemoryLastSaved
      ? `Saved to \`.nttc/\` at ${input.projectMemoryLastSaved.savedAt} (${input.projectMemoryLastSaved.filesWritten.join(", ")}).`
      : "No Project Memory saved to `.nttc/` yet.",
    "",
    "## Included Files",
    "",
  ];

  if (included.length === 0) {
    lines.push(
      "_No code files were included. Select safe files and generate again._",
      "",
    );
  } else {
    for (const file of included) {
      lines.push(
        `### ${file.relativePath}`,
        "",
        "Metadata:",
        `- lines included: ${file.linesIncluded}`,
        `- truncated: ${file.truncated ? "yes" : "no"}`,
        file.warnings.length ? `- warnings: ${file.warnings.join("; ")}` : "- warnings: none",
        "",
        "```text",
        file.content,
        "```",
        "",
      );
    }
  }

  lines.push("## Blocked / Excluded Files", "");
  if (input.blockedFiles.length === 0) {
    lines.push("_No blocked files recorded for this preview._", "");
  } else {
    for (const blocked of input.blockedFiles.slice(0, 40)) {
      lines.push(`- \`${blocked.relativePath}\` — ${blocked.reason}`);
    }
    if (input.blockedCount > input.blockedFiles.length) {
      lines.push(`- …and ${input.blockedCount - input.blockedFiles.length} more blocked/skipped.`);
    }
    lines.push("");
  }

  const suggestedQuestion =
    input.userQuestion.trim() ||
    "Review the included code excerpts and explain the safest next step without editing files or running commands.";

  lines.push(
    "## Suggested Question For AI",
    "",
    suggestedQuestion,
    "",
  );

  const markdownReport = lines.join("\n");
  const previewExcerpt = markdownReport.split("\n").slice(0, 36).join("\n");

  return {
    generatedAt,
    userQuestion: input.userQuestion,
    projectSelected: Boolean(input.project),
    selectedFileCount: input.selectedCount,
    includedFileCount: included.length,
    blockedFileCount: input.blockedCount,
    estimatedCharacters: totalChars,
    truncated: flags.length > 0 || included.some((f) => f.truncated),
    truncationFlags: flags,
    warningCount: included.reduce((n, f) => n + f.warnings.length, 0),
    includedFiles: included.map((f) => f.relativePath),
    markdownReport,
    previewExcerpt,
    previewOnlyNote: CODE_CONTEXT_PREVIEW_NOTE,
  };
}
