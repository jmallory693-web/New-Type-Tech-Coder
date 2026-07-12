/** Stage 90: Task Implementation Intake constants (text-only; no AI). */

export const TASK_IMPLEMENTATION_BUILDER_SOURCES = [
  "Cursor",
  "Codex",
  "Claude",
  "ChatGPT",
  "Grok",
  "Qwen",
  "Human programmer",
  "Other",
] as const;

export type TaskImplementationBuilderSource =
  (typeof TASK_IMPLEMENTATION_BUILDER_SOURCES)[number];

export const TASK_IMPLEMENTATION_INTAKE_PURPOSE =
  "Paste a builder's implementation report for a phase task card. Text-only storage — NTTC does not read changed files, apply patches, or send this to AI automatically.";

export const TASK_IMPLEMENTATION_REPORT_FORMAT_REMINDER = [
  "1. Analysis",
  "2. Plan",
  "3. Files changed",
  "4. Implementation summary",
  "5. Validation performed",
  "6. Risks",
  "7. Safety confirmations",
  "8. Questions / blockers",
] as const;

export const TASK_IMPLEMENTATION_EXPECTED_SECTIONS: Array<{
  label: string;
  patterns: RegExp[];
}> = [
  {
    label: "Analysis",
    patterns: [/\banalysis\b/i, /^#+\s*1\.?\s*analysis/im],
  },
  {
    label: "Plan",
    patterns: [/\bplan\b/i, /^#+\s*2\.?\s*plan/im],
  },
  {
    label: "Files changed",
    patterns: [
      /\bfiles?\s+changed\b/i,
      /^#+\s*3\.?\s*files?\s+changed/im,
      /\bchanged\s+files?\b/i,
    ],
  },
  {
    label: "Implementation summary",
    patterns: [
      /\bimplementation\s+summary\b/i,
      /^#+\s*4\.?\s*implementation/im,
      /\bsummary\s+of\s+implementation\b/i,
    ],
  },
  {
    label: "Validation performed",
    patterns: [
      /\bvalidation\s+performed\b/i,
      /^#+\s*5\.?\s*validation/im,
      /\b(tests?|checks?)\s+run\b/i,
      /\bmanual\s+test\b/i,
    ],
  },
  {
    label: "Risks",
    patterns: [/\brisks?\b/i, /^#+\s*6\.?\s*risks?/im],
  },
  {
    label: "Safety confirmations",
    patterns: [
      /\bsafety\s+confirmations?\b/i,
      /^#+\s*7\.?\s*safety/im,
      /\bno\s+source\s+edit/i,
      /\bdid\s+not\s+(modify|edit|apply)\b/i,
    ],
  },
  {
    label: "Questions / blockers",
    patterns: [
      /\bquestions?\b/i,
      /\bblockers?\b/i,
      /^#+\s*8\.?\s*(questions?|blockers?)/im,
      /\bcould\s+not\s+complete\b/i,
    ],
  },
];

export const TASK_IMPLEMENTATION_SUGGESTED_MARK_RETURNED =
  "Mark this task Implementation Returned after you review the pasted report.";

export const TASK_IMPLEMENTATION_MAX_DRAFT_CHARS = 80_000;
export const TASK_IMPLEMENTATION_MAX_SAVED_CHARS = 40_000;
export const TASK_IMPLEMENTATION_MAX_PREVIEW_CHARS = 2_500;
export const TASK_IMPLEMENTATION_MAX_EXCERPT_CHARS = 900;
