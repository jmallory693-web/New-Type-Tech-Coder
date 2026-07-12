/** Stage 92: Blueprint Task Reconciliation constants (rule-based; no AI). */

export const TASK_RECONCILIATION_REPORT_TITLE =
  "# NTTC Blueprint Task Reconciliation Report";

export const TASK_RECONCILIATION_PURPOSE =
  "Rule-based cross-card reconciliation from stored task cards, handoffs, and implementation reports only. No AI, no source reads.";

export const TASK_RECONCILIATION_RECOMMENDATIONS = [
  "Deck ready",
  "Needs clarification",
  "Split broad cards",
  "Resolve missing producers",
  "Review implementation status",
  "Blocked",
] as const;

export type TaskReconciliationRecommendation =
  (typeof TASK_RECONCILIATION_RECOMMENDATIONS)[number];

export const MISSING_PRODUCER_SEVERITIES = [
  "Low",
  "Medium",
  "High",
  "Blocked",
] as const;

export type MissingProducerSeverity = (typeof MISSING_PRODUCER_SEVERITIES)[number];

export const SAFETY_HEADER_CONCEPTS: Array<{ label: string; pattern: RegExp }> = [
  { label: "implement only this task", pattern: /implement\s+only\s+this\s+task/i },
  { label: "do not build later phases", pattern: /do\s+not\s+build\s+later\s+phases/i },
  { label: "no Apply Patch", pattern: /no\s+apply\s+patch|apply\s+patch/i },
  { label: "no terminal/custom commands", pattern: /terminal|custom\s+command/i },
  { label: "no Live Qwen", pattern: /live\s+qwen/i },
  { label: "safety confirmations", pattern: /safety\s+confirm/i },
  { label: "small focused files", pattern: /small\s+(focused\s+)?files|focused\s+modules/i },
  { label: "report changed files", pattern: /report\s+(changed\s+)?files|files\s+changed/i },
  { label: "report validation", pattern: /report\s+validation|validation\s+performed/i },
  { label: "report risks", pattern: /report\s+risks|\brisks?\b/i },
];

export const SMALL_MODEL_CONCEPTS: Array<{ label: string; pattern: RegExp }> = [
  { label: "small files", pattern: /small\s+files|focused\s+files/i },
  { label: "focused modules", pattern: /focused\s+modules|module\s+boundaries/i },
  { label: "split constants/types/helpers", pattern: /constants|types|helpers|shared\//i },
  { label: "avoid App.tsx dump", pattern: /avoid.*App\.tsx|do\s+not\s+dump.*App\.tsx/i },
  { label: "avoid main/index dump", pattern: /avoid.*main\/index|do\s+not\s+dump.*main/i },
];

export const MONOLITH_FILE_PATTERNS = [
  /\bApp\.tsx\b/i,
  /\bmain\/index\.ts\b/i,
  /\bsrc\/main\/index\.ts\b/i,
];

export const QUALITY_SEVERITY_RULES_DOC =
  "0 flags → Good; 1–2 flags → Needs clarification; 3+ flags → Too broad; missing safety boundaries → Blocked; explicit too-broad flag → Too broad.";
