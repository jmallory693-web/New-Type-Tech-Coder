/**
 * Stage 102: rule-based quality checks for architecture refactor task cards (no AI).
 */

import type { ArchitectureRefactorTaskCardQuality } from "./architectureRefactorTaskConstants";

export interface ArchitectureRefactorTaskQualityInput {
  id: string;
  title: string;
  refactorTarget: string;
  goal: string;
  whatToChange: string;
  whatNotToChange: string;
  safetyBoundaries: string;
  smallModelFriendlyArchitecture: string;
  validationSteps: string;
  reportBackFormat: string;
  filesLikelyInvolved: string;
  builderPrompt: string;
  currentRisk: string;
}

export interface ArchitectureRefactorTaskQualityResult {
  quality: ArchitectureRefactorTaskCardQuality;
  flags: string[];
}

const BROAD_REWRITE_PATTERNS = [
  /\b(?:rewrite|rebuild|redesign|overhaul|entire app|full app|everything at once|complete refactor)\b/i,
  /\b(?:all at once|whole codebase|massive)\b/i,
];

const BEHAVIOR_CHANGE_PATTERNS = [
  /\b(?:change behavior|new feature|add feature|enable edit mode|apply patch|live qwen|terminal access)\b/i,
];

const APP_ONLY_PATTERN =
  /(?:^|\/)App\.tsx$/i;

const MAIN_ONLY_PATTERN = /(?:^|\/)main\/index\.ts$/i;

export function assessArchitectureRefactorTaskQuality(
  input: ArchitectureRefactorTaskQualityInput,
): ArchitectureRefactorTaskQualityResult {
  const flags: string[] = [];
  const combined =
    `${input.title} ${input.goal} ${input.whatToChange} ${input.filesLikelyInvolved}`.toLowerCase();

  if (BROAD_REWRITE_PATTERNS.some((p) => p.test(combined))) {
    flags.push("broad rewrite language");
  }
  if (BEHAVIOR_CHANGE_PATTERNS.some((p) => p.test(combined))) {
    flags.push("behavior change instead of structure");
  }
  if (!input.validationSteps.trim() || input.validationSteps.length < 40) {
    flags.push("missing validation");
  }
  if (!input.safetyBoundaries.trim() || input.safetyBoundaries.length < 40) {
    flags.push("missing safety boundaries");
  }
  if (!input.reportBackFormat.trim() || input.reportBackFormat.length < 30) {
    flags.push("missing report-back format");
  }

  const target = input.refactorTarget.replace(/\\/g, "/");
  const files = input.filesLikelyInvolved.replace(/\\/g, "/");
  const hasExtractionHint =
    /components?|modules?|helpers?|registerIpc|Panel|Container|shared\//i.test(
      `${input.whatToChange} ${files}`,
    );

  if (APP_ONLY_PATTERN.test(target) && !hasExtractionHint) {
    flags.push("targets only App.tsx without extraction target");
  }
  if (MAIN_ONLY_PATTERN.test(target) && !/registerIpc|ipc|module split|helpers?/i.test(combined)) {
    flags.push("targets only main/index.ts without IPC/module split plan");
  }

  const highRiskTouches = (files.match(/App\.tsx|main\/index\.ts|Manager\.ts/gi) ?? [])
    .length;
  if (highRiskTouches >= 3) {
    flags.push("touches too many high-risk files at once");
  }

  const uniqueFlags = [...new Set(flags)];

  let quality: ArchitectureRefactorTaskCardQuality = "good";
  if (uniqueFlags.includes("missing safety boundaries")) {
    quality = "blocked";
  } else if (
    uniqueFlags.includes("broad rewrite language") ||
    uniqueFlags.includes("touches too many high-risk files at once")
  ) {
    quality = "too-broad";
  } else if (uniqueFlags.length >= 2) {
    quality = "too-broad";
  } else if (uniqueFlags.length >= 1) {
    quality = "needs-clarification";
  }

  return { quality, flags: uniqueFlags };
}

export function labelForArchitectureRefactorTaskQuality(
  quality: ArchitectureRefactorTaskCardQuality,
): string {
  switch (quality) {
    case "good":
      return "Good";
    case "needs-clarification":
      return "Needs clarification";
    case "too-broad":
      return "Too broad";
    case "blocked":
      return "Blocked";
    default:
      return quality;
  }
}
