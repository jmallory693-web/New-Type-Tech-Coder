import type {
  BlueprintPhaseTaskCardsRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
} from "../types";
import {
  assessLineCountRisk,
  deriveArchitectureRecommendation,
  inferFileRoleHint,
  isHighRiskCoordinationFile,
  riskSeverityRank,
  suggestArchitectureAction,
} from "./assessArchitectureFileRisk";
import {
  ARCHITECTURE_HEALTH_PURPOSE,
  ARCHITECTURE_HEALTH_REPORT_TITLE,
  ARCHITECTURE_HEALTH_SAFETY_REMINDER,
  HIGH_RISK_COORDINATION_PATTERNS,
  type ArchitectureHealthRecommendation,
  type ArchitectureHealthRiskLevel,
  type ArchitectureHealthSuggestedAction,
} from "./architectureHealthConstants";
import {
  collectChangedFilesPressure,
  collectTaskCardAlignmentWarnings,
} from "./architectureHealthHelpers";
import {
  buildArchitectureRefactorTaskSuggestions,
  type RefactorTaskCardSuggestion,
} from "../architectureRefactorTasks/buildArchitectureRefactorTaskSuggestions";

export type { RefactorTaskCardSuggestion };

export interface ArchitectureHealthFileEntry {
  relativePath: string;
  extension: string;
  directory: string;
  lineCount: number;
  charCount: number;
  riskLevel: ArchitectureHealthRiskLevel;
  roleHint: string;
  suggestedAction: ArchitectureHealthSuggestedAction;
  isHighRiskCoordinationFile: boolean;
}

export interface ArchitectureHealthScanMeta {
  fileCountScanned: number;
  filesTruncated: boolean;
  blockedCount: number;
  includeTestFiles: boolean;
  includeMarkdownDocs: boolean;
}

export interface BuildArchitectureHealthReportInput {
  generatedAt: string;
  projectName: string | null;
  files: ArchitectureHealthFileEntry[];
  scanMeta: ArchitectureHealthScanMeta;
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  changedFilesScan: ChangedFilesScanResult | null;
  changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
}

export interface ArchitectureHealthReportResult {
  generatedAt: string;
  fileCountScanned: number;
  largestFilePath: string | null;
  largestFileLineCount: number;
  criticalCount: number;
  warningCount: number;
  recommendation: ArchitectureHealthRecommendation;
  markdown: string;
  refactorSuggestions: RefactorTaskCardSuggestion[];
}

function dirnamePosix(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : ".";
}

function countByRisk(files: ArchitectureHealthFileEntry[]): {
  criticalCount: number;
  monolithCount: number;
  largeCount: number;
  warningCount: number;
} {
  let criticalCount = 0;
  let monolithCount = 0;
  let largeCount = 0;
  let warningCount = 0;

  for (const file of files) {
    switch (file.riskLevel) {
      case "Critical monolith risk":
        criticalCount += 1;
        warningCount += 1;
        break;
      case "Monolith risk":
        monolithCount += 1;
        warningCount += 1;
        break;
      case "Large":
        largeCount += 1;
        warningCount += 1;
        break;
      case "Watch":
        warningCount += 1;
        break;
      default:
        break;
    }
  }

  return { criticalCount, monolithCount, largeCount, warningCount };
}

function buildSmallModelSection(
  files: ArchitectureHealthFileEntry[],
  taskWarnings: string[],
): string {
  const huge = files.filter((f) => riskSeverityRank(f.riskLevel) >= 3);
  const broadManagers = files.filter(
    (f) => /Manager\.ts$/i.test(f.relativePath) && f.lineCount > 500,
  );
  const lines: string[] = [];

  if (huge.length === 0 && taskWarnings.length === 0) {
    lines.push(
      "- Project file sizes look reasonably friendly for smaller local models based on metadata.",
    );
  } else {
    if (huge.length) {
      lines.push(
        `- **${huge.length}** file(s) at monolith risk or critical size — smaller models struggle with huge single-file context.`,
      );
    }
    if (broadManagers.length) {
      lines.push(
        `- **${broadManagers.length}** manager file(s) exceed 500 lines — consider narrower managers/helpers.`,
      );
    }
    if (taskWarnings.length) {
      lines.push(
        `- **${taskWarnings.length}** Blueprint task card(s) target only App.tsx/main/index.ts without extraction guidance.`,
      );
    }
  }

  lines.push("", "**Recommendations:**");
  lines.push("- Prefer focused components, managers, shared helpers, and constants.");
  lines.push("- Split IPC wiring by domain when practical.");
  lines.push("- Avoid broad rewrite tasks; use incremental extraction task cards.");

  return lines.join("\n");
}

function buildExtractionAreas(files: ArchitectureHealthFileEntry[]): string[] {
  const areas: string[] = [];
  const appTsx = files.find((f) => /(?:^|\/)App\.tsx$/i.test(f.relativePath));
  const mainIndex = files.find((f) =>
    /(?:^|\/)main\/index\.ts$/i.test(f.relativePath),
  );

  if (appTsx && appTsx.lineCount > 700) {
    areas.push(
      "Move Blueprint UI wiring from App.tsx into focused container/component.",
    );
    areas.push(
      "Move architecture-health panel into its own component (already preferred pattern).",
    );
    areas.push(
      "Move repeated report-status rendering into reusable components.",
    );
  }
  if (mainIndex && mainIndex.lineCount > 700) {
    areas.push(
      "Move IPC handler groups into focused registration helpers under src/main/.",
    );
  }

  const largePanels = files.filter(
    (f) =>
      /Panel\.tsx$/i.test(f.relativePath) &&
      f.lineCount > 500 &&
      !/(?:^|\/)App\.tsx$/i.test(f.relativePath),
  );
  for (const panel of largePanels.slice(0, 3)) {
    areas.push(`Consider splitting ${panel.relativePath} into sub-section components.`);
  }

  const typesFile = files.find((f) =>
    /(?:^|\/)shared\/types\.ts$/i.test(f.relativePath),
  );
  if (typesFile && typesFile.lineCount > 700) {
    areas.push(
      "Move large type groups into domain-specific type files only if safe (with re-exports).",
    );
  }

  if (!areas.length) {
    areas.push("No urgent extraction areas detected from line-count metadata alone.");
  }

  return areas;
}

export function enrichArchitectureHealthFile(input: {
  relativePath: string;
  extension: string;
  lineCount: number;
  charCount: number;
}): ArchitectureHealthFileEntry {
  const riskLevel = assessLineCountRisk(input.lineCount, input.relativePath);
  const roleHint = inferFileRoleHint(input.relativePath);
  return {
    relativePath: input.relativePath,
    extension: input.extension,
    directory: dirnamePosix(input.relativePath),
    lineCount: input.lineCount,
    charCount: input.charCount,
    riskLevel,
    roleHint,
    suggestedAction: suggestArchitectureAction({
      relativePath: input.relativePath,
      lineCount: input.lineCount,
      riskLevel,
      roleHint,
    }),
    isHighRiskCoordinationFile: isHighRiskCoordinationFile(input.relativePath),
  };
}

export function buildArchitectureHealthReport(
  input: BuildArchitectureHealthReportInput,
): ArchitectureHealthReportResult {
  const files = [...input.files].sort((a, b) => b.lineCount - a.lineCount);
  const largest = files[0] ?? null;
  const { criticalCount, monolithCount, largeCount, warningCount } =
    countByRisk(files);
  const recommendation = deriveArchitectureRecommendation({
    criticalCount,
    monolithCount,
    largeCount,
  });

  const taskWarnings = collectTaskCardAlignmentWarnings(input.taskCards);

  const changedPaths = [
    ...(input.changedFilesScan?.files.map((f) => f.path) ?? []),
    ...(input.changedFilesTaskLink?.changedFilePaths ?? []),
  ];
  const uniqueChangedPaths = [...new Set(changedPaths.map((p) => p.replace(/\\/g, "/")))];
  const changedPressure = collectChangedFilesPressure({
    changedFilePaths: uniqueChangedPaths,
    files,
  });

  const monolithFiles = files.filter((f) => riskSeverityRank(f.riskLevel) >= 3);
  const highRiskCoordination = files.filter((f) => f.isHighRiskCoordinationFile);
  const top20 = files.slice(0, 20);
  const refactorSuggestions = buildArchitectureRefactorTaskSuggestions(files);

  const lines: string[] = [
    ARCHITECTURE_HEALTH_REPORT_TITLE,
    "",
    "## Summary",
    "",
    `- **Generated:** ${input.generatedAt}`,
    `- **Project:** ${input.projectName ?? "Unknown"}`,
    `- **Purpose:** ${ARCHITECTURE_HEALTH_PURPOSE}`,
    `- **Files scanned:** ${input.scanMeta.fileCountScanned}${input.scanMeta.filesTruncated ? " (listing truncated at safe cap)" : ""}`,
    `- **Include test files:** ${input.scanMeta.includeTestFiles ? "yes" : "no"}`,
    `- **Include markdown/docs:** ${input.scanMeta.includeMarkdownDocs ? "yes" : "no"}`,
    `- **Blocked/skipped entries:** ${input.scanMeta.blockedCount}`,
    `- **Largest file:** ${largest ? `${largest.relativePath} (${largest.lineCount} lines)` : "n/a"}`,
    `- **Critical monolith files:** ${criticalCount}`,
    `- **Warning-level files (Watch+):** ${warningCount}`,
    `- **Recommendation:** ${recommendation}`,
    "",
    "## Largest Files",
    "",
  ];

  if (top20.length) {
    for (const file of top20) {
      lines.push(`- \`${file.relativePath}\``);
      lines.push(`  - lines: ${file.lineCount}`);
      lines.push(`  - chars: ${file.charCount}`);
      lines.push(`  - risk level: ${file.riskLevel}`);
      lines.push(`  - role hint: ${file.roleHint}`);
      lines.push(`  - suggested action: ${file.suggestedAction}`);
    }
  } else {
    lines.push("- No qualifying safe files found.");
  }

  lines.push("", "## Monolith Risk", "");
  if (monolithFiles.length) {
    for (const file of monolithFiles.slice(0, 30)) {
      lines.push(
        `- \`${file.relativePath}\` — **${file.riskLevel}** (${file.lineCount} lines) · ${file.suggestedAction}`,
      );
    }
  } else {
    lines.push("- No files exceeded monolith-risk line thresholds.");
  }

  lines.push("", "## Small-Model Friendliness", "");
  lines.push(buildSmallModelSection(files, taskWarnings));

  lines.push("", "## High-Risk Coordination Files", "");
  if (highRiskCoordination.length) {
    for (const file of highRiskCoordination.slice(0, 25)) {
      const pattern = HIGH_RISK_COORDINATION_PATTERNS.find((p) =>
        p.pattern.test(file.relativePath),
      );
      lines.push(
        `- \`${file.relativePath}\` — ${pattern?.label ?? "coordination file"} · ${file.lineCount} lines · ${file.riskLevel}`,
      );
    }
  } else {
    lines.push("- No known high-risk coordination filenames detected in scan.");
  }

  lines.push("", "## Suggested Extraction Areas", "");
  for (const area of buildExtractionAreas(files)) {
    lines.push(`- ${area}`);
  }

  lines.push("", "## Task-Card Alignment", "");
  if (taskWarnings.length) {
    for (const warning of taskWarnings) {
      lines.push(`- ${warning}`);
    }
  } else if (input.taskCards?.cards.length) {
    lines.push("- No task cards flagged for App.tsx/main/index.ts-only targeting.");
  } else {
    lines.push("- No Blueprint Phase Task Cards stored — alignment check skipped.");
  }

  lines.push("", "## Changed-Files Pressure", "");
  if (changedPressure.length) {
    for (const line of changedPressure) {
      lines.push(`- ${line}`);
    }
  } else if (uniqueChangedPaths.length) {
    lines.push("- Changed-file metadata exists; no overlap with critical monolith files detected.");
  } else {
    lines.push("- No changed-file metadata available.");
  }

  lines.push("", "## Recommended Refactor Task Cards", "");
  lines.push(
    "_Planning-only suggestions — not auto-added to Blueprint. Copy manually if desired._",
    "",
  );
  for (const task of refactorSuggestions) {
    lines.push(`### Refactor Task: ${task.title}`, "");
    lines.push(`**Goal:** ${task.goal}`, "");
    lines.push(`**Files likely involved:** ${task.filesLikelyInvolved}`, "");
    lines.push(`**What not to change:** ${task.whatNotToChange}`, "");
    lines.push(`**Validation required:** ${task.validationRequired}`, "");
    lines.push(`**Risk:** ${task.risk}`, "");
    lines.push(`**Suggested builder prompt:** ${task.suggestedBuilderPrompt}`, "");
  }

  lines.push("", "## Recommendation", "");
  lines.push(`**${recommendation}**`);
  if (criticalCount > 0) {
    lines.push(
      "",
      "Create refactor task cards for critical files before adding more features to App.tsx/main/index.ts.",
    );
  } else if (monolithCount > 0) {
    lines.push("", "Extract focused modules before expanding monolith-risk files.");
  } else if (largeCount > 0) {
    lines.push("", "Watch large files and avoid adding unrelated responsibilities.");
  } else {
    lines.push("", "Continue using focused modules for new work.");
  }

  lines.push("", "## Safety Reminder", "");
  lines.push(ARCHITECTURE_HEALTH_SAFETY_REMINDER);

  return {
    generatedAt: input.generatedAt,
    fileCountScanned: input.scanMeta.fileCountScanned,
    largestFilePath: largest?.relativePath ?? null,
    largestFileLineCount: largest?.lineCount ?? 0,
    criticalCount,
    warningCount,
    recommendation,
    markdown: lines.join("\n"),
    refactorSuggestions,
  };
}
