import type { CodeContextPack } from "../../shared/types";
import { PATCH_DRAFT_SEND_NOTE } from "../../shared/codeContextConstants";
import {
  appendExpandedPlanningGuidance,
  type PlanningStyleId,
} from "../../shared/planningStyle";

const MAX_PACK_CHARS = 45_000;
const MAX_QUESTION_CHARS = 4_000;
const MAX_OPTIONAL_EXCERPT_CHARS = 1_500;

export interface BuildPatchDraftPromptInput {
  pack: CodeContextPack;
  userQuestion: string;
  templateLabel?: string | null;
  codeAiExcerpt?: string | null;
  builderPlanExcerpt?: string | null;
  decisionReportExcerpt?: string | null;
  implementationReviewExcerpt?: string | null;
  planningStyle?: PlanningStyleId;
}

function capExcerpt(text: string | null | undefined, label: string): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (trimmed.length <= MAX_OPTIONAL_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_OPTIONAL_EXCERPT_CHARS - 1)}…\n\n(TRUNCATED: ${label} excerpt capped for AI prompt)`;
}

/**
 * Builds the Ollama prompt for Stage 58 Patch Draft Mode (no apply).
 * Sends ONLY the approved Code Context Pack markdown plus optional safe excerpts.
 */
export function buildPatchDraftPrompt(
  input: BuildPatchDraftPromptInput,
): { ok: boolean; message: string; prompt: string | null } {
  if (!input.pack?.markdownReport?.trim()) {
    return {
      ok: false,
      message: "Generate a Code Context Pack preview first.",
      prompt: null,
    };
  }

  const question =
    input.userQuestion.trim() ||
    input.pack.userQuestion.trim() ||
    "Draft a small, safe patch proposal for the selected code excerpts.";

  let packBody = input.pack.markdownReport.trim();
  if (packBody.length > MAX_PACK_CHARS) {
    packBody = `${packBody.slice(0, MAX_PACK_CHARS - 1)}…\n\n(TRUNCATED: pack markdown capped for AI prompt)`;
  }

  const codeAi = capExcerpt(input.codeAiExcerpt, "Code AI response");
  const builderPlan = capExcerpt(input.builderPlanExcerpt, "Builder Plan");
  const decision = capExcerpt(input.decisionReportExcerpt, "Decision Report");
  const implReview = capExcerpt(
    input.implementationReviewExcerpt,
    "Implementation Review",
  );

  const lines = appendExpandedPlanningGuidance(
    [
    "You are drafting a patch proposal only inside New Type Tech Coder (NTTC).",
    "",
    "## Hard safety rules (mandatory)",
    "",
    "- You are drafting ONLY from the included Code Context Pack below (and any optional safe excerpts).",
    "- Do NOT claim the patch was applied.",
    "- Do NOT ask NTTC to edit files.",
    "- Do NOT ask NTTC to run commands.",
    "- Do NOT assume hidden files exist.",
    "- Do NOT invent APIs not shown in the context.",
    "- Do NOT propose enabling live Qwen, edit mode, arbitrary terminal, or custom commands.",
    "- Do NOT propose bypassing Safety Backup.",
    "- Package installs must be marked external/manual and not performed by NTTC.",
    "- Prefer a small, focused, safe patch — avoid broad rewrites.",
    "- If context is insufficient, list exact files/excerpts to select next.",
    "- Output is a draft for review/copy only — NTTC will not apply it.",
    "",
    `> ${PATCH_DRAFT_SEND_NOTE}`,
    "",
    "## Code question template",
    "",
    input.templateLabel?.trim()
      ? `Template used: ${input.templateLabel.trim()}`
      : "Template used: None (custom question)",
    "",
    "## User question / goal",
    "",
    question.slice(0, MAX_QUESTION_CHARS),
    "",
  ],
    input.planningStyle ?? "small-model-friendly",
  );

  if (codeAi) {
    lines.push(
      "## Optional excerpt: latest Local AI Code Review (approved pack only)",
      "",
      codeAi,
      "",
    );
  }
  if (builderPlan) {
    lines.push("## Optional excerpt: Builder Plan (plan-only)", "", builderPlan, "");
  }
  if (decision) {
    lines.push(
      "## Optional excerpt: Decision Report (metadata)",
      "",
      decision,
      "",
    );
  }
  if (implReview) {
    lines.push(
      "## Optional excerpt: Implementation Review (rule-based)",
      "",
      implReview,
      "",
    );
  }

  lines.push(
    "## Approved Code Context Pack (only source material)",
    "",
    packBody,
    "",
    "## Required response format",
    "",
    "Respond using exactly these markdown sections:",
    "",
    "# NTTC Patch Draft",
    "",
    "## Goal",
    "What this patch is trying to accomplish.",
    "",
    "## Context Used",
    "Files/excerpts from the Code Context Pack used.",
    "",
    "## Proposed Files / Areas",
    "Likely files or areas to change.",
    "",
    "## Draft Changes",
    "Detailed patch-style explanation. If code snippets are included, label them clearly with file path and do not imply they were applied.",
    "",
    "## Risks",
    "Likely breakage or safety risks.",
    "",
    "## Safety Boundary Review",
    "Whether the draft touches edit mode, AI file access, command runner, terminal/custom commands, live Qwen, provider security, backup/restore, project writes, or package scripts.",
    "",
    "## Validation Steps",
    "Checks/manual tests an outside builder should run.",
    "",
    "## Rollback Notes",
    "How to recover if outside implementation fails.",
    "",
    "## Missing Context",
    "Specific files/excerpts needed before implementation if context is insufficient.",
    "",
    "## Suggested Builder Prompt",
    "A prompt the user can paste into Cursor/Codex/Grok/Claude.",
    "",
    "## Recommendation",
    "Choose exactly one: Select more code context first | Ask builder for a plan first | Ready for outside builder implementation | Run Build/Test Checks before implementation | Do not proceed yet",
    "",
    "## Safety Reminder",
    "This is a draft only. NTTC did not edit source files.",
  );

  return {
    ok: true,
    message: "Patch Draft prompt ready.",
    prompt: lines.join("\n"),
  };
}

export function extractPatchDraftRecommendation(
  responseText: string,
): string | null {
  const match = responseText.match(
    /##\s*Recommendation\s*\n+([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
  );
  if (!match?.[1]) return null;
  const line = match[1]
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .find((l) => l.length > 0);
  return line ?? null;
}
