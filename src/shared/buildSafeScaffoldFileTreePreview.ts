/**
 * Stage 121: deterministic Safe Scaffold file-tree preview builder.
 * Paths only. No AI. No file contents. No writes.
 */

import {
  labelForBlueprintProjectType,
  type BlueprintProjectType,
} from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";
import {
  SAFE_SCAFFOLD_FILE_TREE_CAUTION_WARNING,
  SAFE_SCAFFOLD_FILE_TREE_NO_CONTENTS_YET,
  SAFE_SCAFFOLD_FILE_TREE_PREVIEW_ONLY,
  validateProposedRelativePath,
  type SafeScaffoldFileTreePreviewRecord,
} from "./buildModeFileTreePreview";

export type BuildSafeScaffoldFileTreePreviewInput = {
  blueprintImported: boolean;
  blueprintProjectType: BlueprintProjectType | string;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  targetFolderPath: string;
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus;
};

const BASE_WEB_TREE = [
  "package.json",
  "README.md",
  "index.html",
  "src/",
  "src/main.tsx",
  "src/App.tsx",
  "src/styles.css",
  "docs/",
  "docs/PROJECT_NOTES.md",
  ".nttc/",
  ".nttc/planning/",
] as const;

const DESKTOP_EXTRA = ["electron.manifest.md", "src/preload.notes.md"] as const;
const GAME_EXTRA = ["assets/", "assets/README.md"] as const;
const DATA_EXTRA = ["data/", "data/.gitkeep"] as const;
const AUTOMATION_EXTRA = ["scripts/", "scripts/README.md"] as const;

function templatePathsForProjectType(
  projectType: string,
): string[] {
  const paths: string[] = [...BASE_WEB_TREE];
  switch (projectType) {
    case "desktop-app":
      paths.push(...DESKTOP_EXTRA);
      break;
    case "game":
      paths.push(...GAME_EXTRA);
      break;
    case "data-tool":
      paths.push(...DATA_EXTRA);
      break;
    case "automation-tool":
      paths.push(...AUTOMATION_EXTRA);
      break;
    case "web-app":
    case "writing-publishing":
    case "business-internal":
    case "unknown":
    default:
      break;
  }
  // Stable deterministic order
  return Array.from(new Set(paths));
}

function whyTheseFiles(projectType: string): string[] {
  const lines = [
    "Conservative TypeScript/web-style starter paths for planning only.",
    "`.nttc/planning/` is reserved for future documentation handoffs (not written here).",
    SAFE_SCAFFOLD_FILE_TREE_NO_CONTENTS_YET,
  ];
  if (projectType === "desktop-app") {
    lines.push("Desktop app adds light Electron/planning placeholders (paths only).");
  } else if (projectType === "game") {
    lines.push("Game type adds a simple assets/ placeholder folder.");
  } else if (projectType === "data-tool") {
    lines.push("Data tool type adds a data/ placeholder folder.");
  } else if (projectType === "automation-tool") {
    lines.push("Automation tool type adds a scripts/ placeholder folder.");
  }
  return lines;
}

/**
 * Build a preview record. Throws never — returns blocked reasons via result shape.
 * When blockedReasons is non-empty, caller should not save as generated.
 */
export function buildSafeScaffoldFileTreePreview(
  input: BuildSafeScaffoldFileTreePreviewInput,
): {
  record: SafeScaffoldFileTreePreviewRecord | null;
  blockedReasons: string[];
} {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  if (!input.blueprintImported) {
    blockedReasons.push("Blueprint is not imported/generated.");
  }
  if (!input.blueprintProjectType) {
    blockedReasons.push("Blueprint project type is missing.");
  }
  if (input.taskCardCount <= 0) {
    blockedReasons.push("Blueprint Phase Task Cards do not exist.");
  }
  if (!input.targetFolderPath?.trim()) {
    blockedReasons.push("Safe Scaffold target folder is not selected.");
  }
  if (input.targetSafetyStatus === "blocked") {
    blockedReasons.push("Target folder safety is Blocked.");
  }
  if (
    input.targetSafetyStatus !== "safe" &&
    input.targetSafetyStatus !== "caution" &&
    input.targetSafetyStatus !== "blocked"
  ) {
    blockedReasons.push("Target folder safety has not been checked.");
  }

  if (blockedReasons.length > 0) {
    return { record: null, blockedReasons };
  }

  if (input.targetSafetyStatus === "caution") {
    warnings.push(SAFE_SCAFFOLD_FILE_TREE_CAUTION_WARNING);
  }

  const projectType = String(input.blueprintProjectType || "unknown");
  const projectTypeLabel =
    labelForBlueprintProjectType(projectType as BlueprintProjectType) ||
    projectType;

  const candidates = templatePathsForProjectType(projectType);
  const proposedRelativePaths: string[] = [];
  for (const candidate of candidates) {
    const err = validateProposedRelativePath(candidate);
    if (err) {
      blockedReasons.push(err);
      continue;
    }
    proposedRelativePaths.push(candidate.replace(/\\/g, "/"));
  }

  if (proposedRelativePaths.length === 0) {
    blockedReasons.push("No valid relative paths remained after safety filtering.");
    return { record: null, blockedReasons };
  }

  if (blockedReasons.length > 0) {
    // Path-filter failures are hard blocks for this generation.
    return { record: null, blockedReasons };
  }

  const generatedAt = new Date().toISOString();
  const why = whyTheseFiles(projectType);
  const treeLines = proposedRelativePaths.map((p) => `- ${p}`).join("\n");

  const markdown = [
    "# NTTC Safe Scaffold File Tree Preview",
    "",
    "## Status",
    SAFE_SCAFFOLD_FILE_TREE_PREVIEW_ONLY,
    "",
    "## Source Inputs",
    `- Blueprint status: ${input.blueprintImported ? "imported" : "missing"}`,
    `- Blueprint project type: ${projectTypeLabel} (\`${projectType}\`)`,
    `- Task cards: ${input.taskCardCount}`,
    `- Target folder: ${input.targetFolderPath}`,
    `- Target folder safety: ${input.targetSafetyStatus}`,
    "",
    "## Proposed File Tree",
    treeLines,
    "",
    "## Why These Files",
    ...why.map((l) => `- ${l}`),
    "",
    "## Files Not Included Yet",
    "- No source/file contents (Preview Contents stage is later).",
    "- No node_modules, lockfiles, secrets, release/dist/build outputs.",
    "- No `.env` or private key files.",
    "",
    "## Safety Boundaries",
    "- Paths are relative to the selected target folder only.",
    "- Absolute paths, `..`, `~`, drive letters, and leading slashes are rejected.",
    "- This stage does not create files, edit files, run commands, or call AI.",
    ...(warnings.length > 0
      ? ["", "### Warnings", ...warnings.map((w) => `- ${w}`)]
      : []),
    "",
    "## Next Step",
    "Review this file tree. The next Safe Scaffold stage will add file-content preview (still no writes).",
    "",
  ].join("\n");

  const record: SafeScaffoldFileTreePreviewRecord = {
    generatedAt,
    sourceBlueprintImported: true,
    sourceBlueprintProjectType: projectType,
    sourceTaskCardCount: input.taskCardCount,
    sourceTaskCardsGeneratedAt: input.taskCardsGeneratedAt,
    sourceTargetFolderPath: input.targetFolderPath,
    sourceTargetSafetyStatus: input.targetSafetyStatus,
    proposedRelativePaths,
    markdown,
    warnings,
    blockedReasons: [],
    stale: false,
  };

  return { record, blockedReasons: [] };
}

/** Preconditions check without building markdown (for UI readiness). */
export function evaluateFileTreePreviewPreconditions(input: {
  blueprintImported: boolean;
  taskCardCount: number;
  targetFolderPath: string | null;
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus | null;
  targetStale: boolean;
  targetBusy: boolean;
}): { canGenerate: boolean; hardBlocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.blueprintImported) {
    reasons.push("Import or generate a Blueprint first.");
  }
  if (input.taskCardCount <= 0) {
    reasons.push("Generate Blueprint Phase Task Cards first.");
  }
  if (!input.targetFolderPath) {
    reasons.push("Select a Safe Scaffold target folder.");
  }
  if (input.targetBusy) {
    reasons.push("Target folder safety check is still running.");
  }
  if (input.targetStale) {
    reasons.push("Target folder safety is stale — refresh the folder safety check.");
  }
  if (!input.targetSafetyStatus) {
    reasons.push("Run a target folder safety check.");
  }
  if (input.targetSafetyStatus === "blocked") {
    reasons.push("Target folder is Blocked — choose a different empty folder.");
  }

  const hardBlocked = input.targetSafetyStatus === "blocked";
  const canGenerate =
    input.blueprintImported &&
    input.taskCardCount > 0 &&
    Boolean(input.targetFolderPath) &&
    !input.targetStale &&
    !input.targetBusy &&
    (input.targetSafetyStatus === "safe" ||
      input.targetSafetyStatus === "caution");

  return { canGenerate, hardBlocked, reasons: canGenerate ? [] : reasons };
}
