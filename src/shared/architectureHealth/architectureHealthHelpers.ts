import type { BlueprintPhaseTaskCardsRecord } from "../types";
import {
  ARCHITECTURE_HEALTH_CONFIG_CHANGED_PATTERNS,
  ARCHITECTURE_HEALTH_DENY_DIRECTORY_NAMES,
  HIGH_RISK_COORDINATION_PATTERNS,
  TASK_CARD_EXTRACTION_HINTS,
} from "./architectureHealthConstants";
import type { ArchitectureHealthFileEntry } from "./buildArchitectureHealthReport";

export function isTestFilePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(normalized)) return true;
  if (/(?:^|\/)(?:__tests__|tests?)(?:\/|$)/i.test(normalized)) return true;
  return false;
}

export function isMarkdownDocPath(relativePath: string): boolean {
  return /\.md$/i.test(relativePath.replace(/\\/g, "/"));
}

export function isArchitectureHealthDenyDirectory(name: string): boolean {
  const lower = name.toLowerCase();
  return ARCHITECTURE_HEALTH_DENY_DIRECTORY_NAMES.some(
    (deny) => deny.toLowerCase() === lower,
  );
}

export function classifyConfigChangedPath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const entry of ARCHITECTURE_HEALTH_CONFIG_CHANGED_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.label;
    }
  }
  return null;
}

export function taskCardTargetsOnlyMonolithFiles(
  likelyFilesModules: string,
): boolean {
  const text = likelyFilesModules.trim();
  if (!text) return false;

  const lower = text.toLowerCase();
  const mentionsApp =
    lower.includes("app.tsx") || /\bapp\.tsx\b/i.test(text);
  const mentionsMain =
    lower.includes("main/index.ts") || lower.includes("src/main/index.ts");

  if (!mentionsApp && !mentionsMain) return false;

  const hasExtractionHint = TASK_CARD_EXTRACTION_HINTS.some((hint) =>
    lower.includes(hint),
  );
  return !hasExtractionHint;
}

export function collectTaskCardAlignmentWarnings(
  taskCards: BlueprintPhaseTaskCardsRecord | null,
): string[] {
  if (!taskCards?.cards.length) return [];

  const warnings: string[] = [];
  for (const card of taskCards.cards) {
    const likely = card.likelyFilesModules ?? "";
    if (taskCardTargetsOnlyMonolithFiles(likely)) {
      warnings.push(
        `Task **${card.id}** (${card.title}) likely files/modules mention only App.tsx or main/index.ts without component/manager/helper/constants/IPC guidance.`,
      );
    }
  }
  return warnings;
}

export function collectChangedFilesPressure(input: {
  changedFilePaths: string[];
  files: ArchitectureHealthFileEntry[];
}): string[] {
  const byPath = new Map(
    input.files.map((file) => [file.relativePath.replace(/\\/g, "/"), file]),
  );
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const rawPath of input.changedFilePaths) {
    const path = rawPath.replace(/\\/g, "/");
    if (seen.has(path)) continue;

    const configLabel = classifyConfigChangedPath(path);
    if (configLabel) {
      seen.add(path);
      lines.push(
        `${path} appears in current changed files as a **${configLabel}** file (package/config context — review dependency/tooling impact; not a source monolith).`,
      );
      continue;
    }

    const meta = byPath.get(path);
    if (meta) {
      if (
        meta.riskLevel === "Critical monolith risk" ||
        meta.riskLevel === "Monolith risk"
      ) {
        seen.add(path);
        lines.push(
          `${path} appears in current changed files and is already **${meta.riskLevel.toLowerCase()}** (${meta.lineCount} lines).`,
        );
        continue;
      }
    }

    if (HIGH_RISK_COORDINATION_PATTERNS.some((p) => p.pattern.test(path))) {
      seen.add(path);
      lines.push(
        `${path} appears in current changed files and is high-risk coordination code.`,
      );
    }
  }

  return lines;
}

export function buildArchitectureHealthPlanningNote(input: {
  recommendation: string;
  generatedAt: string;
  fileCountScanned: number;
  largestFilePath: string | null;
  largestFileLineCount: number;
  criticalCount: number;
  warningCount: number;
  stale: boolean;
}): string {
  return [
    `- Generated: ${input.generatedAt}`,
    `- Recommendation: ${input.recommendation}`,
    `- Files scanned: ${input.fileCountScanned}`,
    `- Largest file: ${input.largestFilePath ?? "n/a"} (${input.largestFileLineCount} lines)`,
    `- Critical monolith files: ${input.criticalCount}`,
    `- Warning-level files: ${input.warningCount}`,
    `- Stale: ${input.stale ? "yes" : "no"}`,
  ].join("\n");
}
