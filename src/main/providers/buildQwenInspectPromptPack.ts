import type {
  OutsideReviewPack,
  ProjectInfo,
  ProjectScanResult,
  QwenPromptPack,
  SafetyGateStatus,
} from "../../shared/types";

const MAX_SUMMARY_CHARS = 12_000;
const MAX_PACK_CHARS = 16_000;
const MAX_REQUEST_CHARS = 4_000;

export interface QwenPromptPackInput {
  userRequest: string;
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  reviewPack: OutsideReviewPack | null;
  safety: SafetyGateStatus;
}

/**
 * Builds a copy-paste Qwen Inspect Prompt Pack.
 * Does not run Qwen. Does not include secrets or raw source trees.
 */
export function buildQwenInspectPromptPack(
  input: QwenPromptPackInput,
): QwenPromptPack {
  const projectSelected = Boolean(input.project);
  const summaryAvailable = Boolean(input.summary);
  const reviewPackAvailable = Boolean(input.reviewPack);
  const limitedContext = !projectSelected || !summaryAvailable;

  const requestText = input.userRequest.trim()
    ? input.userRequest.trim().slice(0, MAX_REQUEST_CHARS)
    : "No specific user request was entered.";

  const summaryMarkdown = input.summary
    ? input.summary.markdownReport.slice(0, MAX_SUMMARY_CHARS)
    : "Project Summary is unavailable. Select a project and click Summarize Project first.";

  const packMarkdown = input.reviewPack
    ? input.reviewPack.markdownReport.slice(0, MAX_PACK_CHARS)
    : "Outside Review Pack is unavailable. Generate a Review Pack first for fuller context.";

  const lines: string[] = [
    "# New Type Tech Coder - Qwen Inspect Prompt Pack",
    "",
    "## Purpose",
    "",
    "You are helping a non-coder inspect a local project safely.",
    "This pack was prepared by New Type Tech Coder for an inspect-only Qwen Code session.",
    "",
    "## Hard rules (must follow)",
    "",
    "- Inspect only.",
    "- Do NOT edit files.",
    "- Do NOT create files.",
    "- Do NOT delete files.",
    "- Do NOT modify files.",
    "- Do NOT run project commands.",
    "- Do NOT install packages.",
    "- Do NOT use secrets, .env files, keys, or certificates.",
    "- Do NOT open or request credential stores.",
    "- Return a report only.",
    "- If you cannot inspect safely without edits or commands, say so and stop.",
    "",
    "## Safety warnings",
    "",
    `- App mode: ${input.safety.mode} (Inspect-only)`,
    `- Writes allowed in app: ${input.safety.writesAllowed ? "Yes" : "No"}`,
    `- Edit mode available in app: ${input.safety.editModeAvailable ? "Yes" : "No"}`,
    `- Checkpoint exists: ${input.safety.checkpointExists ? "Yes" : "No"}`,
    "- Live Qwen execution inside New Type Tech Coder is disabled in Stage 8A until inspect-only safety can be guaranteed.",
    "- This Prompt Pack is for a manual Qwen Code session controlled by the user.",
    "- Prefer read-only / plan / approval-mode plan behavior if your Qwen Code build supports it.",
    "- Suggested CLI shape (manual, user-run only): `qwen --approval-mode plan --exclude-tools shell,write,edit -p \"...\"`",
    "",
    "## Project context",
    "",
    projectSelected
      ? [
          `- Project name: ${input.project?.displayName}`,
          `- Project path: ${input.project?.normalizedPath}`,
          `- OneDrive path: ${input.project?.isOneDrive ? "Yes (sync risk)" : "No"}`,
        ].join("\n")
      : "- No project folder is selected. Context is limited.",
    "",
    "## User request",
    "",
    requestText,
    "",
    "## Project Summary (safe metadata)",
    "",
    summaryMarkdown,
    "",
    "## Outside Review Pack (safe metadata)",
    "",
    packMarkdown,
    "",
    "## Requested output format",
    "",
    "Return a markdown report with these sections only:",
    "",
    "1. **Executive summary** (plain English for a non-coder)",
    "2. **What this project appears to be**",
    "3. **Safety concerns**",
    "4. **Missing requirements / unclear areas**",
    "5. **Suggested next stage**",
    "6. **Do-not-build-yet warnings**",
    "7. **Questions the user should answer before any edits**",
    "",
    "Do not include raw source dumps.",
    "Do not include secrets.",
    "Do not propose that you already edited or ran commands.",
    "",
    "## Secret safety reminder",
    "",
    "This pack does not include .env contents, secrets, keys, certificates, or deep raw source trees.",
    "",
  ];

  if (limitedContext) {
    lines.push(
      "## Limited context notice",
      "",
      !projectSelected
        ? "Generated without a selected project folder."
        : "Generated without a completed Project Summary.",
      "",
    );
  }

  const markdownReport = lines.join("\n");
  const previewExcerpt = markdownReport.split("\n").slice(0, 28).join("\n");

  return {
    generatedAt: new Date().toISOString(),
    projectSelected,
    summaryAvailable,
    reviewPackAvailable,
    limitedContext,
    markdownReport,
    previewExcerpt,
  };
}
