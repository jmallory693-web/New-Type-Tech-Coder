/**
 * Stage 80: detect blueprint sections and metadata from pasted markdown.
 * Rule-based only — no AI, no file reads.
 */

import {
  BLUEPRINT_REQUIRED_SECTIONS,
  type BlueprintRequiredSection,
} from "./blueprintConstants";

export interface BlueprintSectionDetection {
  present: BlueprintRequiredSection[];
  missing: BlueprintRequiredSection[];
  sections: Record<string, string>;
  openQuestionCount: number | null;
  phaseCount: number | null;
  hasPhase1Handoff: boolean;
  hasSuggestedFilePlan: boolean;
  hasValidationPlan: boolean;
  hasSmallModelGuidance: boolean;
}

function normalizeHeader(line: string): string {
  return line.replace(/^#+\s*/, "").trim();
}

function headerMatchesSection(header: string, section: string): boolean {
  const h = header.toLowerCase().replace(/\s+/g, " ");
  const s = section.toLowerCase().replace(/\s+/g, " ");
  if (h === s) return true;
  if (h.includes(s) || s.includes(h)) return true;
  if (section === "Screen / Workflow Flow") {
    return /screen|workflow flow|ui flow/i.test(h);
  }
  if (section === "Suggested File / Module Plan") {
    return /suggested file|module plan|file plan/i.test(h);
  }
  if (section === "Phase 1 Builder Handoff") {
    return /phase 1 builder handoff|phase one builder/i.test(h);
  }
  if (section === "Risks / Open Questions") {
    return /risks|open questions/i.test(h);
  }
  return false;
}

/** Split blueprint markdown into section bodies keyed by canonical section title. */
export function extractBlueprintSections(
  blueprintText: string,
): Record<string, string> {
  const lines = blueprintText.split(/\r?\n/);
  const sections: Record<string, string> = {};
  let currentSection: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentSection && buffer.length) {
      sections[currentSection] = buffer.join("\n").trim();
    }
    buffer = [];
  };

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headerMatch) {
      const header = normalizeHeader(headerMatch[1] ?? "");
      const matched = BLUEPRINT_REQUIRED_SECTIONS.find((s) =>
        headerMatchesSection(header, s),
      );
      if (matched) {
        flush();
        currentSection = matched;
        continue;
      }
    }
    if (currentSection) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

export function detectBlueprintSections(
  blueprintText: string,
): BlueprintSectionDetection {
  const sections = extractBlueprintSections(blueprintText);
  const present = BLUEPRINT_REQUIRED_SECTIONS.filter(
    (s) => Boolean(sections[s]?.trim()),
  );
  const missing = BLUEPRINT_REQUIRED_SECTIONS.filter(
    (s) => !sections[s]?.trim(),
  );

  const risksText = sections["Risks / Open Questions"] ?? "";
  const openQuestionCount = risksText
    ? (risksText.match(/\?/g) ?? []).length || null
    : null;

  const phasesText =
    sections["Build Phases"] ?? sections["Feature Roadmap"] ?? "";
  const phaseMatches = phasesText.match(/phase\s*\d+/gi) ?? [];
  const phaseCount = phaseMatches.length > 0 ? phaseMatches.length : null;

  const hasSmallModelGuidance =
    /small[- ]model|focused modules|small readable files|one giant file/i.test(
      blueprintText,
    );

  return {
    present,
    missing,
    sections,
    openQuestionCount,
    phaseCount,
    hasPhase1Handoff: present.includes("Phase 1 Builder Handoff"),
    hasSuggestedFilePlan: present.includes("Suggested File / Module Plan"),
    hasValidationPlan: present.includes("Validation Plan"),
    hasSmallModelGuidance,
  };
}

export function summarizeBlueprintIdea(idea: string, maxLen = 200): string {
  const trimmed = idea.trim().replace(/\s+/g, " ");
  if (!trimmed) return "(no idea summary)";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}
