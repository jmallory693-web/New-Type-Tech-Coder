/**
 * Stage 86: rule-based quality checks for blueprint phase task cards (no AI).
 */

import type {
  BlueprintPhaseTaskCardQuality,
  BlueprintPhaseTaskCardStatus,
} from "./blueprintTaskCardConstants";

export interface TaskCardQualityInput {
  id: string;
  title: string;
  goal: string;
  whatToBuild: string;
  whatNotToBuildYet: string;
  safetyBoundaries: string;
  smallModelGuidance: string;
  validationSteps: string;
  reportBackFormat: string;
  likelyFilesModules: string;
  builderPrompt: string;
  smallModelFriendly: boolean;
}

export interface TaskCardQualityResult {
  quality: BlueprintPhaseTaskCardQuality;
  flags: string[];
}

const BROAD_TITLE_PATTERNS = [
  /\beverything\b/i,
  /\bfull app\b/i,
  /\bcomplete\b/i,
  /\ball features\b/i,
  /\bentire\b/i,
];

const GIANT_FILE_RISK =
  /\b(?:only|just)\s+(?:edit|change|modify)\s+(?:App\.tsx|main\/index\.ts)\b/i;

export function assessBlueprintTaskCardQuality(
  input: TaskCardQualityInput,
): TaskCardQualityResult {
  const flags: string[] = [];

  const combinedLength =
    input.whatToBuild.length + input.goal.length + input.title.length;
  if (combinedLength > 2200 || input.whatToBuild.length > 900) {
    flags.push("too broad");
  }
  if (BROAD_TITLE_PATTERNS.some((p) => p.test(input.title))) {
    flags.push("too broad");
  }
  if (!input.validationSteps.trim() || input.validationSteps.length < 40) {
    flags.push("missing validation steps");
  }
  if (!input.reportBackFormat.trim() || input.reportBackFormat.length < 40) {
    flags.push("missing report-back format");
  }
  if (!input.safetyBoundaries.trim() || input.safetyBoundaries.length < 40) {
    flags.push("missing safety boundaries");
  }
  if (
    !input.whatNotToBuildYet.trim() ||
    input.whatNotToBuildYet.length < 30
  ) {
    flags.push("missing what-not-to-build-yet");
  }
  const likely = input.likelyFilesModules.toLowerCase();
  if (
    GIANT_FILE_RISK.test(input.likelyFilesModules) ||
    (likely.includes("app.tsx") &&
      !likely.includes("components") &&
      !likely.includes("modules") &&
      !likely.includes("shared"))
  ) {
    flags.push("broad App.tsx/main/index.ts risk");
  }
  if (
    input.smallModelFriendly &&
    (!input.smallModelGuidance.trim() || input.smallModelGuidance.length < 40)
  ) {
    flags.push("not small-model friendly");
  }
  if (!input.goal.trim() || input.goal.length < 20) {
    flags.push("no clear output");
  }

  const uniqueFlags = [...new Set(flags)];

  const SAFETY_CRITICAL_FLAGS = ["missing safety boundaries"];

  let quality: BlueprintPhaseTaskCardQuality = "good";
  if (uniqueFlags.some((f) => SAFETY_CRITICAL_FLAGS.includes(f))) {
    quality = "blocked";
  } else if (uniqueFlags.includes("too broad")) {
    quality = "too-broad";
  } else if (uniqueFlags.length >= 3) {
    quality = "too-broad";
  } else if (uniqueFlags.length >= 1) {
    quality = "needs-clarification";
  }

  return { quality, flags: uniqueFlags };
}

export function labelForTaskCardQuality(
  quality: BlueprintPhaseTaskCardQuality,
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

export function isTaskCardTerminalStatus(
  status: BlueprintPhaseTaskCardStatus,
): boolean {
  return status === "reviewed" || status === "skipped";
}

export function isTaskCardReadyToSend(
  status: BlueprintPhaseTaskCardStatus,
): boolean {
  return status === "drafted" || status === "planned";
}
