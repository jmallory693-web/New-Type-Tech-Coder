/**
 * Stage 106: rule-based parsing of pasted architecture refactor implementation reports.
 */

import { CODE_CONTEXT_SECRET_PATTERNS } from "../codeContextConstants";
import { parseTaskImplementationReportText } from "../parseTaskImplementationReport";
import { ARCHITECTURE_REFACTOR_IMPLEMENTATION_EXPECTED_SECTIONS } from "./architectureRefactorTaskImplementationIntakeConstants";

export interface ArchitectureRefactorImplementationReportParseResult {
  detectedFilesChanged: string[];
  detectedValidationMentions: string[];
  detectedBehaviorPreservationMentions: string[];
  detectedRisksBlockers: string[];
  detectedSafetyConfirmations: string[];
  missingExpectedSections: string[];
  missingBehaviorPreservationChecks: string[];
  possibleSecretPatterns: string[];
  blockedBySecrets: boolean;
  behaviorChangeWarning: boolean;
  behaviorChangeWarnings: string[];
}

const BEHAVIOR_PRESERVATION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "preserve behavior", pattern: /\bpreserve\s+(existing\s+)?behavior\b/i },
  { label: "no new features", pattern: /\bno\s+new\s+features?\b/i },
  { label: "no safety boundary changes", pattern: /\bno\s+safety\s+boundary\s+changes?\b/i },
  { label: "no apply patch", pattern: /\bno\s+apply\s+patch\b/i },
  { label: "live qwen unchanged", pattern: /\blive\s+qwen\s+(unchanged|disabled|remains)\b/i },
  { label: "no terminal", pattern: /\bno\s+terminal\b|\bno\s+custom\s+command\b/i },
  { label: "validation performed", pattern: /\bvalidation\s+performed\b/i },
  { label: "files changed listed", pattern: /\bfiles?\s+changed\b/i },
];

const BEHAVIOR_CHANGE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "behavior changed", pattern: /\b(behavior|behaviour)\s+changed\b/i },
  { label: "added feature", pattern: /\badded\s+(a\s+)?new\s+feature\b|\bnew\s+feature\s+added\b/i },
  { label: "enable edit mode", pattern: /\benable\s+edit\s+mode\b/i },
  { label: "apply patch added", pattern: /\badded\s+apply\s+patch\b|\benable\s+apply\s+patch\b/i },
  { label: "live qwen enabled", pattern: /\benabled\s+live\s+qwen\b|\blive\s+qwen\s+enabled\b/i },
  { label: "terminal access", pattern: /\badded\s+terminal\b|\bterminal\s+access\s+added\b/i },
];

const REQUIRED_BEHAVIOR_CHECKS = [
  "preserve behavior",
  "no new features",
  "no apply patch",
  "validation performed",
  "files changed listed",
];

function matchLabels(
  text: string,
  rules: Array<{ label: string; pattern: RegExp }>,
): string[] {
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text) && !found.includes(rule.label)) {
      found.push(rule.label);
    }
  }
  return found;
}

function detectMissingSections(text: string): string[] {
  const missing: string[] = [];
  for (const section of ARCHITECTURE_REFACTOR_IMPLEMENTATION_EXPECTED_SECTIONS) {
    if (!section.patterns.some((p) => p.test(text))) {
      missing.push(section.label);
    }
  }
  return missing;
}

function detectPossibleSecrets(text: string): string[] {
  const found: string[] = [];
  for (const pattern of CODE_CONTEXT_SECRET_PATTERNS) {
    if (pattern.test(text)) {
      found.push(pattern.source.slice(0, 40));
    }
  }
  return [...new Set(found)];
}

/** Parse pasted refactor implementation report (rule-based; never executed). */
export function parseArchitectureRefactorTaskImplementationReportText(
  text: string,
): ArchitectureRefactorImplementationReportParseResult {
  const trimmed = text.trim();
  const base = parseTaskImplementationReportText(trimmed);
  const behaviorPreservation = matchLabels(trimmed, BEHAVIOR_PRESERVATION_PATTERNS);
  const behaviorChangeWarnings = matchLabels(trimmed, BEHAVIOR_CHANGE_PATTERNS);
  const missingBehaviorPreservationChecks = REQUIRED_BEHAVIOR_CHECKS.filter(
    (check) => !behaviorPreservation.includes(check),
  );
  const possibleSecretPatterns =
    base.possibleSecretPatterns.length > 0
      ? base.possibleSecretPatterns
      : detectPossibleSecrets(trimmed);
  const missingExpectedSections =
    base.missingExpectedSections.length > 0
      ? base.missingExpectedSections
      : detectMissingSections(trimmed);

  return {
    detectedFilesChanged: base.detectedFilesChanged,
    detectedValidationMentions: base.detectedValidationMentions,
    detectedBehaviorPreservationMentions: behaviorPreservation,
    detectedRisksBlockers: base.detectedRisksBlockers,
    detectedSafetyConfirmations: base.detectedSafetyConfirmations,
    missingExpectedSections,
    missingBehaviorPreservationChecks,
    possibleSecretPatterns,
    blockedBySecrets: possibleSecretPatterns.length > 0,
    behaviorChangeWarning: behaviorChangeWarnings.length > 0,
    behaviorChangeWarnings,
  };
}
