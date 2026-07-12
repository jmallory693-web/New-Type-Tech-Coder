/**
 * Stage 96: rule-based scope drift check for changed-file paths vs task card scope.
 * Uses stored planning metadata and safe changed-file paths only.
 */

import {
  CHANGED_FILES_BROAD_PATH_PATTERNS,
  CHANGED_FILES_SCOPE_COUNT_THRESHOLD,
  CHANGED_FILES_SCOPE_MULTIPLIER,
} from "./changedFilesTaskLinkConstants";
import type { BlueprintPhaseTaskCard } from "./types";

function extractLikelyPathTokens(likelyFilesModules: string): string[] {
  return likelyFilesModules
    .split(/[\n,;/]+/)
    .map((part) =>
      part
        .replace(/[`"'()]/g, "")
        .trim()
        .toLowerCase(),
    )
    .filter((part) => part.length >= 3 && !/^(and|the|for|only|module|plan)$/i.test(part));
}

function pathMatchesLikely(normalizedPath: string, tokens: string[]): boolean {
  return tokens.some(
    (token) =>
      normalizedPath.includes(token) ||
      token.includes(normalizedPath.split("/").pop() ?? ""),
  );
}

export function checkChangedFilesScopeDrift(
  card: BlueprintPhaseTaskCard,
  paths: string[],
): string[] {
  const warnings: string[] = [];
  if (!paths.length) return warnings;

  const scopeText = `${card.likelyFilesModules}\n${card.whatToBuild}\n${card.whatNotToBuildYet}`.toLowerCase();
  const planningOnly = /planning only|\.nttc\/planning|markdown only|planning docs only/i.test(
    scopeText,
  );

  if (planningOnly) {
    const nonPlanning = paths.filter(
      (p) => !/\.nttc[\\/]planning|[\\/]\.nttc[\\/]planning|\.md$/i.test(p),
    );
    if (nonPlanning.length > 0) {
      warnings.push(
        "Task is planning-only but changed files include paths outside `.nttc/planning`.",
      );
    }
  }

  for (const rawPath of paths) {
    const norm = rawPath.replace(/\\/g, "/");
    for (const pattern of CHANGED_FILES_BROAD_PATH_PATTERNS) {
      if (pattern.test(norm)) {
        warnings.push(`Broad core file changed: ${rawPath}`);
      }
    }
  }

  const expectedTokens = extractLikelyPathTokens(card.likelyFilesModules);
  if (expectedTokens.length > 0) {
    let unrelated = 0;
    for (const rawPath of paths) {
      const norm = rawPath.replace(/\\/g, "/").toLowerCase();
      if (!pathMatchesLikely(norm, expectedTokens)) {
        unrelated += 1;
      }
    }
    if (unrelated > 0 && unrelated >= Math.ceil(paths.length * 0.5)) {
      warnings.push(
        `${unrelated} changed file(s) appear unrelated to task likely files/modules.`,
      );
    }
  }

  const likelyCount = Math.max(1, expectedTokens.length || 3);
  if (
    paths.length >= CHANGED_FILES_SCOPE_COUNT_THRESHOLD &&
    paths.length > likelyCount * CHANGED_FILES_SCOPE_MULTIPLIER
  ) {
    warnings.push(
      `Changed files count (${paths.length}) is much larger than expected for this task.`,
    );
  }

  return [...new Set(warnings)];
}

export function buildChangedFileSummary(paths: string[], max = 12): string {
  if (!paths.length) return "No changed files in scan.";
  const shown = paths.slice(0, max);
  const tail = paths.length > max ? ` … +${paths.length - max} more` : "";
  return `${shown.join(", ")}${tail}`;
}
