/**
 * Stage 80: rule-based blueprint completeness check (no AI).
 */

import type { BlueprintCompletenessReport } from "./types";
import { detectBlueprintSections } from "./extractBlueprintSections";

export type BlueprintReadiness = BlueprintCompletenessReport["readiness"];

function assessReadiness(
  present: string[],
  missing: string[],
  detection: ReturnType<typeof detectBlueprintSections>,
): BlueprintReadiness {
  const critical = [
    "Project Brief",
    "Product Requirements",
    "Build Phases",
    "Phase 1 Builder Handoff",
  ] as const;
  const missingCritical = critical.filter((s) => missing.includes(s));
  if (missingCritical.length >= 3 || !present.length) return "not-ready";
  if (missingCritical.length > 0) return "needs-clarification";
  if (
    detection.hasPhase1Handoff &&
    detection.hasValidationPlan &&
    detection.hasSuggestedFilePlan
  ) {
    return "ready-for-phase-1";
  }
  if (present.length >= 8) return "ready-for-builder-planning-only";
  return "needs-clarification";
}

function recommendedNextStep(readiness: BlueprintReadiness): string {
  switch (readiness) {
    case "not-ready":
      return "Add a Project Brief, Product Requirements, and Build Phases before handoff.";
    case "needs-clarification":
      return "Fill missing sections or run Create Planner AI Prompt again with your answers.";
    case "ready-for-phase-1":
      return "Generate Phase 1 Builder Handoff and preview planning documents.";
    case "ready-for-builder-planning-only":
      return "Complete Phase 1 Builder Handoff and Validation Plan before coding.";
    default:
      return "Review the blueprint and import an updated version.";
  }
}

export function buildBlueprintCompletenessReport(
  blueprintText: string,
): BlueprintCompletenessReport {
  const detection = detectBlueprintSections(blueprintText);
  const present = detection.present;
  const missing = detection.missing;
  const weakAreas: string[] = [];

  if (!detection.hasPhase1Handoff) {
    weakAreas.push("Phase 1 Builder Handoff section is missing or empty.");
  }
  if (!detection.hasSuggestedFilePlan) {
    weakAreas.push("Suggested File / Module Plan is missing.");
  }
  if (!detection.hasValidationPlan) {
    weakAreas.push("Validation Plan is missing.");
  }
  if (!detection.hasSmallModelGuidance) {
    weakAreas.push("No small-model friendly architecture guidance detected.");
  }
  if ((detection.openQuestionCount ?? 0) > 5) {
    weakAreas.push("Many open questions remain — clarify before Phase 1.");
  }

  const readiness = assessReadiness(present, missing, detection);
  const next = recommendedNextStep(readiness);

  const markdownReport = [
    "# Blueprint Completeness Report",
    "",
    `**Readiness:** ${readiness.replace(/-/g, " ")}`,
    "",
    "## Present sections",
    "",
    present.length ? present.map((s) => `- ${s}`).join("\n") : "- (none)",
    "",
    "## Missing sections",
    "",
    missing.length ? missing.map((s) => `- ${s}`).join("\n") : "- (none)",
    "",
    "## Weak areas",
    "",
    weakAreas.length ? weakAreas.map((w) => `- ${w}`).join("\n") : "- None flagged.",
    "",
    "## Recommended next step",
    "",
    next,
    "",
    "_Rule-based check only — NTTC did not call AI._",
  ].join("\n");

  return {
    generatedAt: new Date().toISOString(),
    presentSections: present,
    missingSections: missing,
    weakAreas,
    readiness,
    recommendedNextStep: next,
    markdownReport,
  };
}
