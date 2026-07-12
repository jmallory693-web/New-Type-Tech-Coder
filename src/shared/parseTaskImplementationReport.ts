/** Stage 90: rule-based parsing of pasted task implementation reports. */

import { CODE_CONTEXT_SECRET_PATTERNS } from "./codeContextConstants";
import { TASK_IMPLEMENTATION_EXPECTED_SECTIONS } from "./taskImplementationIntakeConstants";

export interface TaskImplementationReportParseResult {
  detectedFilesChanged: string[];
  detectedValidationMentions: string[];
  detectedRisksBlockers: string[];
  detectedSafetyConfirmations: string[];
  missingExpectedSections: string[];
  possibleSecretPatterns: string[];
  blockedBySecrets: boolean;
}

const VALIDATION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "typecheck", pattern: /\btypecheck\b|\bnpm\s+run\s+typecheck\b/i },
  { label: "build", pattern: /\bnpm\s+run\s+build\b|\bbuild\s+pass(ed)?\b/i },
  { label: "test", pattern: /\bnpm\s+run\s+test\b|\btests?\s+pass(ed)?\b/i },
  { label: "lint", pattern: /\blint\b|\bnpm\s+run\s+lint\b/i },
  { label: "pack", pattern: /\bnpm\s+run\s+pack\b/i },
  { label: "dist", pattern: /\bnpm\s+run\s+dist\b/i },
  { label: "smoke test", pattern: /\bsmoke\s+test\b/i },
  { label: "manual test", pattern: /\bmanual\s+test\b/i },
  { label: "CDP smoke", pattern: /\bCDP\s+smoke\b/i },
];

const RISK_BLOCKER_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "blocker", pattern: /\bblocker(s)?\b/i },
  { label: "could not complete", pattern: /\bcould\s+not\s+complete\b/i },
  { label: "unable to finish", pattern: /\bunable\s+to\s+finish\b/i },
  { label: "needs clarification", pattern: /\bneeds?\s+clarification\b/i },
  { label: "open question", pattern: /\bopen\s+questions?\b/i },
  { label: "risk", pattern: /\brisks?\b/i },
  { label: "side effect", pattern: /\bside\s+effects?\b/i },
  { label: "regression", pattern: /\bregression\b/i },
  { label: "breaking change", pattern: /\bbreaking\s+change\b/i },
];

const SAFETY_CONFIRMATION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "no source editing", pattern: /\bno\s+source\s+edit/i },
  { label: "did not modify source", pattern: /\bdid\s+not\s+(modify|edit)\s+(source|files?)\b/i },
  { label: "no apply patch", pattern: /\bno\s+apply\s+patch\b|\bdid\s+not\s+apply\b/i },
  { label: "no AI file access", pattern: /\bno\s+(ai\s+)?file\s+access\b/i },
  { label: "no commands run", pattern: /\bno\s+commands?\s+run\b|\bdid\s+not\s+run\s+commands?\b/i },
  { label: "planning docs only", pattern: /\.nttc\/planning\b/i },
  { label: "text only", pattern: /\btext\s+only\b/i },
  { label: "safety boundary", pattern: /\bsafety\s+boundar/i },
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

function extractFilePaths(text: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /`([^`]+\.(?:ts|tsx|js|jsx|json|md|css|mjs|cjs))`/gi,
    /\b(?:src|dist|dist-electron|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md)\b/gi,
    /\b[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx)\b/g,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const p = (m[1] ?? m[0]).replace(/\\/g, "/");
      if (p.length > 2 && p.length < 120) paths.add(p);
    }
  }
  return [...paths].slice(0, 25);
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

function detectMissingSections(text: string): string[] {
  const missing: string[] = [];
  for (const section of TASK_IMPLEMENTATION_EXPECTED_SECTIONS) {
    if (!section.patterns.some((p) => p.test(text))) {
      missing.push(section.label);
    }
  }
  return missing;
}

/** Parse pasted implementation report text (rule-based; never executed). */
export function parseTaskImplementationReportText(
  text: string,
): TaskImplementationReportParseResult {
  const trimmed = text.trim();
  const possibleSecretPatterns = detectPossibleSecrets(trimmed);
  return {
    detectedFilesChanged: extractFilePaths(trimmed),
    detectedValidationMentions: matchLabels(trimmed, VALIDATION_PATTERNS),
    detectedRisksBlockers: matchLabels(trimmed, RISK_BLOCKER_PATTERNS),
    detectedSafetyConfirmations: matchLabels(trimmed, SAFETY_CONFIRMATION_PATTERNS),
    missingExpectedSections: detectMissingSections(trimmed),
    possibleSecretPatterns,
    blockedBySecrets: possibleSecretPatterns.length > 0,
  };
}
