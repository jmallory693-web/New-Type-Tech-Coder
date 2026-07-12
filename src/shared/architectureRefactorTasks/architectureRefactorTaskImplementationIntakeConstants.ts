/** Stage 106: Architecture Refactor Implementation Intake constants (text-only). */

export {
  TASK_IMPLEMENTATION_BUILDER_SOURCES as ARCHITECTURE_REFACTOR_IMPLEMENTATION_BUILDER_SOURCES,
  type TaskImplementationBuilderSource as ArchitectureRefactorImplementationBuilderSource,
} from "../taskImplementationIntakeConstants";

export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_INTAKE_PURPOSE =
  "Paste a builder's refactor implementation report for an Architecture Refactor Task Card. Text-only storage — NTTC does not read changed files, inspect diffs, apply patches, or send this to AI automatically.";

export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_FORMAT_REMINDER = [
  "1. Analysis",
  "2. Plan",
  "3. Files changed",
  "4. Implementation summary",
  "5. Validation performed",
  "6. Behavior preservation checks",
  "7. Risks",
  "8. Safety confirmations",
  "9. Questions / blockers",
] as const;

export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_EXPECTED_SECTIONS: Array<{
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
    ],
  },
  {
    label: "Validation performed",
    patterns: [
      /\bvalidation\s+performed\b/i,
      /^#+\s*5\.?\s*validation/im,
      /\btypecheck\b/i,
      /\bnpm\s+run\s+build\b/i,
    ],
  },
  {
    label: "Behavior preservation checks",
    patterns: [
      /\bbehavior\s+preservation\b/i,
      /^#+\s*6\.?\s*behavior/im,
      /\bpreserve\s+(existing\s+)?behavior\b/i,
      /\bno\s+new\s+features?\b/i,
    ],
  },
  {
    label: "Risks",
    patterns: [/\brisks?\b/i, /^#+\s*7\.?\s*risks?/im],
  },
  {
    label: "Safety confirmations",
    patterns: [
      /\bsafety\s+confirmations?\b/i,
      /^#+\s*8\.?\s*safety/im,
      /\bno\s+apply\s+patch\b/i,
    ],
  },
  {
    label: "Questions / blockers",
    patterns: [
      /\bquestions?\b/i,
      /\bblockers?\b/i,
      /^#+\s*9\.?\s*(questions?|blockers?)/im,
    ],
  },
];

export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_SUGGESTED_MARK_RETURNED = (
  taskId: string,
) => `Mark ${taskId} Implementation Returned after you review the pasted report.`;

export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME =
  "ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS.md" as const;

export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_DRAFT_CHARS = 80_000;
export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_SAVED_CHARS = 40_000;
export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_EXCERPT_CHARS = 900;

export const ARCHITECTURE_REFACTOR_BEHAVIOR_CHANGE_WARNING =
  "Report may indicate behavior change. Do not mark reviewed until inspected.";

/** Stage 106: task artifact kind label for Implementation Review staging. */
export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_KIND =
  "Architecture Refactor Implementation Report" as const;
