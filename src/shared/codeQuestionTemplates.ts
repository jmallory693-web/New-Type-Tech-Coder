/** Stage 56: guided Code Question templates (wording only; no auto AI send). */

export type CodeQuestionTemplateId =
  | "explain-selected-code"
  | "find-likely-bugs"
  | "check-against-plan"
  | "suggest-missing-tests"
  | "find-missing-context"
  | "small-patch-plan"
  | "safety-boundary-risks"
  | "explain-check-errors"
  | "summarize-non-coder"
  | "outside-builder-question";

export interface CodeQuestionTemplateDefinition {
  id: CodeQuestionTemplateId;
  label: string;
  question: string;
}

export const CODE_QUESTION_TEMPLATE_IDS: CodeQuestionTemplateId[] = [
  "explain-selected-code",
  "find-likely-bugs",
  "check-against-plan",
  "suggest-missing-tests",
  "find-missing-context",
  "small-patch-plan",
  "safety-boundary-risks",
  "explain-check-errors",
  "summarize-non-coder",
  "outside-builder-question",
];

export const CODE_QUESTION_TEMPLATES: Record<
  CodeQuestionTemplateId,
  CodeQuestionTemplateDefinition
> = {
  "explain-selected-code": {
    id: "explain-selected-code",
    label: "Explain selected code",
    question:
      "Explain what the selected code does in plain English. Focus on purpose, major functions, and how the pieces connect.",
  },
  "find-likely-bugs": {
    id: "find-likely-bugs",
    label: "Find likely bugs",
    question:
      "Review the selected code for likely bugs, fragile logic, edge cases, or missing validation. Do not suggest broad rewrites.",
  },
  "check-against-plan": {
    id: "check-against-plan",
    label: "Check against current plan",
    question:
      "Compare the selected code against the current NTTC plan, Decision Report, Builder Plan, and Implementation Review context included in the pack. Does it appear aligned?",
  },
  "suggest-missing-tests": {
    id: "suggest-missing-tests",
    label: "Suggest missing tests",
    question:
      "Based on the selected code, what tests or manual checks should be added or run? Prioritize typecheck, build, focused unit tests, and packaged smoke tests where relevant.",
  },
  "find-missing-context": {
    id: "find-missing-context",
    label: "Find missing context",
    question:
      "What additional files or excerpts should I select next to answer this question better? Give specific file/area suggestions and explain why.",
  },
  "small-patch-plan": {
    id: "small-patch-plan",
    label: "Ask for small patch plan",
    question:
      "Create a small plan for a future patch based only on this selected code. Do not write code yet. Do not output a full patch. Include likely files, risks, and validation steps.",
  },
  "safety-boundary-risks": {
    id: "safety-boundary-risks",
    label: "Review for safety boundary risks",
    question:
      "Review the selected code for risks related to NTTC safety boundaries: edit mode, AI file access, command running, terminal/custom commands, live Qwen, provider security, backup/restore, and project writes.",
  },
  "explain-check-errors": {
    id: "explain-check-errors",
    label: "Explain errors from checks",
    question:
      "Using the selected code and any safe check summary included in the pack, explain what the error likely means and what a builder should inspect next.",
  },
  "summarize-non-coder": {
    id: "summarize-non-coder",
    label: "Summarize for a non-coder",
    question:
      "Summarize the selected code for a non-coder. Avoid jargon. Explain what matters, what looks risky, and what the next safe action should be.",
  },
  "outside-builder-question": {
    id: "outside-builder-question",
    label: "Prepare question for outside builder",
    question:
      "Turn this into a concise prompt I can paste into Cursor/Codex/Grok/Claude. Ask for a plan or clarification first, not immediate implementation.",
  },
};

export function isCodeQuestionTemplateId(
  value: unknown,
): value is CodeQuestionTemplateId {
  return (
    typeof value === "string" &&
    CODE_QUESTION_TEMPLATE_IDS.includes(value as CodeQuestionTemplateId)
  );
}

export function getCodeQuestionTemplate(
  id: CodeQuestionTemplateId,
): CodeQuestionTemplateDefinition {
  return CODE_QUESTION_TEMPLATES[id] ?? CODE_QUESTION_TEMPLATES["explain-selected-code"];
}
