import type { CodeContextPack } from "../../shared/types";
import { CODE_CONTEXT_AI_SEND_NOTE } from "../../shared/codeContextConstants";
import {
  appendExpandedPlanningGuidance,
  templateNeedsPlanningGuidance,
  type PlanningStyleId,
} from "../../shared/planningStyle";
import type { CodeQuestionTemplateId } from "../../shared/codeQuestionTemplates";
import { isCodeQuestionTemplateId } from "../../shared/codeQuestionTemplates";

const MAX_PACK_CHARS = 45_000;
const MAX_QUESTION_CHARS = 4_000;

export interface BuildCodeContextAiPromptInput {
  pack: CodeContextPack;
  userQuestion: string;
  templateLabel?: string | null;
  templateId?: CodeQuestionTemplateId | null;
  planningStyle?: PlanningStyleId;
}

/**
 * Builds the Ollama prompt for Stage 54 Code Context AI review.
 * Sends ONLY the approved Code Context Pack markdown — no disk reads, no extra files.
 */
export function buildCodeContextAiPrompt(
  input: BuildCodeContextAiPromptInput,
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
    "Review the selected code excerpts and explain what you see.";

  let packBody = input.pack.markdownReport.trim();
  if (packBody.length > MAX_PACK_CHARS) {
    packBody = `${packBody.slice(0, MAX_PACK_CHARS - 1)}…\n\n(TRUNCATED: pack markdown capped for AI prompt)`;
  }

  const includePlanning = templateNeedsPlanningGuidance(
    isCodeQuestionTemplateId(input.templateId) ? input.templateId : null,
  );

  const baseLines = [
    "You are a local code reviewer inside New Type Tech Coder (NTTC).",
    "",
    "## Hard safety rules (mandatory)",
    "",
    "- You are reviewing ONLY the included Code Context Pack below.",
    "- Do NOT assume you have the full project.",
    "- Do NOT ask NTTC to read unselected files.",
    "- Do NOT ask NTTC to edit files.",
    "- Do NOT ask NTTC to run arbitrary commands.",
    "- Do NOT output a full patch unless the user explicitly asks in a later patch-draft stage.",
    "- You may explain code, find risks, suggest tests, and recommend next steps.",
    "- If context is insufficient, say what additional specific files/excerpts should be selected next.",
    "",
    `> ${CODE_CONTEXT_AI_SEND_NOTE}`,
    "",
    "## Code question template",
    "",
    input.templateLabel?.trim()
      ? `Template used: ${input.templateLabel.trim()}`
      : "Template used: None (custom question)",
    "",
    "## User question",
    "",
    question.slice(0, MAX_QUESTION_CHARS),
    "",
    "## Approved Code Context Pack (only source material)",
    "",
    packBody,
    "",
    "## Required response format",
    "",
    "Respond using exactly these markdown sections:",
    "",
    "# Local AI Code Review",
    "",
    "## Answer",
    "Direct answer to the user question.",
    "",
    "## What I Can See",
    "List selected files/excerpts you are basing the answer on.",
    "",
    "## Findings",
    "Important observations.",
    "",
    "## Risks / Bugs",
    "Likely issues or fragile areas.",
    "",
    "## Missing Context",
    "Specific files/excerpts that would help.",
    "",
    "## Recommended Next Step",
    "Choose one: Select more code context | Ask builder for a plan | Generate Builder Plan | Generate Patch Draft later | Run Build/Test Checks | Generate Patch Review Pack | Safe to continue review | Do not proceed yet",
    "",
    "## Suggested Next Question",
    "A useful follow-up question for the user to ask.",
    "",
    "## Safety Reminder",
    "No source edits were made. This is review/advice only.",
  ];

  const lines =
    includePlanning &&
    (input.planningStyle ?? "small-model-friendly") === "small-model-friendly"
      ? appendExpandedPlanningGuidance(
          baseLines,
          input.planningStyle ?? "small-model-friendly",
        )
      : baseLines;

  return {
    ok: true,
    message: "Code Context AI prompt ready.",
    prompt: lines.join("\n"),
  };
}

export function extractCodeContextAiRecommendation(
  responseText: string,
): string | null {
  const match = responseText.match(
    /##\s*Recommended Next Step\s*\n+([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
  );
  if (!match?.[1]) return null;
  const line = match[1]
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .find((l) => l.length > 0);
  return line ?? null;
}
