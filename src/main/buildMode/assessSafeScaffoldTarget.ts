/**
 * Stage 119: shallow metadata-only Safe Scaffold target assessment.
 * Does not read file contents. Does not recurse. Does not create files.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SAFE_SCAFFOLD_FUTURE_WRITE_READINESS,
  SAFE_SCAFFOLD_TARGET_MAX_ENTRIES,
  type SafeScaffoldTargetCheckResult,
  type SafeScaffoldTargetEntrySummary,
  type SafeScaffoldTargetSafetyStatus,
} from "../../shared/buildModeTargetSafety";

const HARMLESS_NAMES = new Set([
  "readme",
  "readme.md",
  "readme.txt",
  ".gitkeep",
  ".gitignore",
  "license",
  "license.md",
  "license.txt",
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
]);

const PROJECT_MARKERS = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "src",
  ".git",
  "node_modules",
  "tsconfig.json",
  "cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "composer.json",
  "gemfile",
  "pom.xml",
  "build.gradle",
  "cmakelists.txt",
]);

const GENERATED_MARKERS = new Set([
  "release",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  ".turbo",
  ".cache",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".cs",
  ".go",
  ".rs",
  ".cpp",
  ".cc",
  ".cxx",
  ".c",
  ".h",
  ".hpp",
  ".vue",
  ".svelte",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".kts",
  ".scala",
  ".m",
  ".mm",
]);

const BLOCKED_PATH_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "release",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
]);

const SYSTEM_DIR_NAMES = new Set([
  "windows",
  "system32",
  "program files",
  "program files (x86)",
  "programdata",
  "$recycle.bin",
  "recovery",
]);

function normalizeComparable(p: string): string {
  return path.normalize(p).replace(/[/\\]+$/, "").toLowerCase();
}

function isPathInside(child: string, parent: string): boolean {
  const c = normalizeComparable(child);
  const p = normalizeComparable(parent);
  if (!p || c === p) return false;
  const prefix = p.endsWith(path.sep) ? p : p + path.sep;
  return c.startsWith(prefix.toLowerCase()) || c.startsWith(p + "/");
}

function isSamePath(a: string, b: string): boolean {
  return normalizeComparable(a) === normalizeComparable(b);
}

function emptySummary(): SafeScaffoldTargetEntrySummary {
  return {
    totalEntries: 0,
    truncated: false,
    entryNames: [],
    fileCount: 0,
    directoryCount: 0,
    otherCount: 0,
    harmlessCount: 0,
    unknownNonSourceCount: 0,
    sourceLikeCount: 0,
    projectMarkerNames: [],
    generatedMarkerNames: [],
  };
}

function classifyEntryName(name: string): {
  kind: "harmless" | "source" | "project-marker" | "generated-marker" | "unknown";
} {
  const lower = name.toLowerCase();
  if (HARMLESS_NAMES.has(lower)) return { kind: "harmless" };
  if (PROJECT_MARKERS.has(lower)) return { kind: "project-marker" };
  if (GENERATED_MARKERS.has(lower)) return { kind: "generated-marker" };
  const ext = path.extname(lower);
  if (SOURCE_EXTENSIONS.has(ext)) return { kind: "source" };
  return { kind: "unknown" };
}

function pathHasBlockedSegment(resolvedPath: string): string | null {
  const parts = resolvedPath.split(/[/\\]+/).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (BLOCKED_PATH_SEGMENTS.has(lower)) return part;
  }
  return null;
}

function isDriveRoot(resolvedPath: string): boolean {
  const parsed = path.parse(resolvedPath);
  const root = path.normalize(parsed.root).replace(/[/\\]+$/, "");
  const resolved = path.normalize(resolvedPath).replace(/[/\\]+$/, "");
  return normalizeComparable(root) === normalizeComparable(resolved);
}

function isUserHome(resolvedPath: string): boolean {
  try {
    return isSamePath(resolvedPath, os.homedir());
  } catch {
    return false;
  }
}

function looksLikeSystemPath(resolvedPath: string): boolean {
  const parts = resolvedPath.split(/[/\\]+/).filter(Boolean);
  for (const part of parts) {
    if (SYSTEM_DIR_NAMES.has(part.toLowerCase())) return true;
  }
  // Unix-like system roots
  const n = normalizeComparable(resolvedPath);
  if (
    n === "/" ||
    n === "/usr" ||
    n === "/bin" ||
    n === "/etc" ||
    n === "/var" ||
    n === "/sys" ||
    n === "/proc" ||
    n === "/dev"
  ) {
    return true;
  }
  return false;
}

function isOneDriveOrDesktopContext(resolvedPath: string): boolean {
  const lower = resolvedPath.toLowerCase().replace(/\\/g, "/");
  return (
    lower.includes("/onedrive/") ||
    lower.includes("/desktop/") ||
    /(?:^|\/)desktop(?:\/|$)/i.test(lower) ||
    /onedrive/i.test(lower)
  );
}

function hasSuspiciousTraversal(selectedPath: string): boolean {
  const raw = selectedPath.replace(/\\/g, "/");
  if (raw.includes("\0")) return true;
  // Unresolved ".." segments in the input are treated as suspicious.
  const segments = raw.split("/").filter(Boolean);
  return segments.some((s) => s === "..");
}

export type AssessSafeScaffoldTargetInput = {
  selectedPath: string;
  /** Current NTTC project root (normalized), if any. */
  currentProjectRoot: string | null;
};

/**
 * Shallow directory metadata check only.
 * Never reads file contents. Never creates files. Never recurses into children.
 */
export function assessSafeScaffoldTarget(
  input: AssessSafeScaffoldTargetInput,
): SafeScaffoldTargetCheckResult {
  const selectedPath = input.selectedPath.trim();
  const checkedAt = new Date().toISOString();
  const reasons: string[] = [];
  const state: { status: SafeScaffoldTargetSafetyStatus } = { status: "safe" };
  const summary = emptySummary();

  const block = (reason: string) => {
    state.status = "blocked";
    reasons.push(reason);
  };
  const caution = (reason: string) => {
    if (state.status === "safe") state.status = "caution";
    reasons.push(reason);
  };

  const finish = (
    resolvedPath: string,
  ): SafeScaffoldTargetCheckResult => ({
    status: state.status,
    reasons:
      reasons.length > 0
        ? reasons
        : state.status === "safe"
          ? ["Folder exists, is readable, and appears empty."]
          : [],
    entrySummary: summary,
    checkedAt,
    selectedPath,
    resolvedPath,
    futureWriteReadiness: SAFE_SCAFFOLD_FUTURE_WRITE_READINESS,
  });

  if (!selectedPath) {
    block("No folder path provided.");
    return finish("");
  }

  if (hasSuspiciousTraversal(selectedPath)) {
    block("Folder path uses suspicious traversal segments.");
    return finish(selectedPath);
  }

  let resolvedPath = "";
  try {
    resolvedPath = path.resolve(selectedPath);
  } catch {
    block("Folder path could not be resolved.");
    return finish(selectedPath);
  }

  if (isDriveRoot(resolvedPath)) {
    block("Folder is a drive root.");
    return finish(resolvedPath);
  }

  if (isUserHome(resolvedPath)) {
    block("Folder is the user home directory.");
    return finish(resolvedPath);
  }

  if (looksLikeSystemPath(resolvedPath)) {
    block("Folder appears to be a system or protected path.");
    return finish(resolvedPath);
  }

  const blockedSeg = pathHasBlockedSegment(resolvedPath);
  if (blockedSeg) {
    block(
      `Folder is inside or named a blocked path segment (${blockedSeg}).`,
    );
    return finish(resolvedPath);
  }

  const projectRoot = input.currentProjectRoot?.trim() || null;
  if (projectRoot) {
    let projectResolved = projectRoot;
    try {
      projectResolved = path.resolve(projectRoot);
    } catch {
      // keep as-is
    }
    if (isSamePath(resolvedPath, projectResolved)) {
      block("Folder is the current project root.");
      return finish(resolvedPath);
    }
    if (isPathInside(resolvedPath, projectResolved)) {
      block("Folder is inside the current project root.");
      return finish(resolvedPath);
    }
    if (isPathInside(projectResolved, resolvedPath)) {
      block("Folder is a parent of the current project root.");
      return finish(resolvedPath);
    }
  }

  let lstat: fs.Stats;
  try {
    lstat = fs.lstatSync(resolvedPath);
  } catch {
    block("Folder does not exist or is not readable.");
    return finish(resolvedPath);
  }

  if (lstat.isSymbolicLink()) {
    // Conservative: any symlink/junction target folder is blocked (escape risk).
    block("Folder is a symlink/junction (blocked to prevent path escape).");
    return finish(resolvedPath);
  }

  if (!lstat.isDirectory()) {
    block("Selected path is not a directory.");
    return finish(resolvedPath);
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(resolvedPath);
  } catch {
    block("Folder is not readable.");
    return finish(resolvedPath);
  }

  summary.truncated = entries.length > SAFE_SCAFFOLD_TARGET_MAX_ENTRIES;
  const visible = entries.slice(0, SAFE_SCAFFOLD_TARGET_MAX_ENTRIES);
  summary.totalEntries = entries.length;
  summary.entryNames = visible;

  if (summary.truncated) {
    block(
      `Folder has more than ${SAFE_SCAFFOLD_TARGET_MAX_ENTRIES} entries (shallow check truncated — treat as blocked).`,
    );
  }

  for (const name of visible) {
    let entryStat: fs.Stats | null = null;
    try {
      entryStat = fs.lstatSync(path.join(resolvedPath, name));
    } catch {
      summary.otherCount += 1;
      continue;
    }

    if (entryStat.isSymbolicLink()) {
      block(`Folder contains a symlink/junction entry (${name}).`);
      continue;
    }

    if (entryStat.isDirectory()) {
      summary.directoryCount += 1;
    } else if (entryStat.isFile()) {
      summary.fileCount += 1;
    } else {
      summary.otherCount += 1;
    }

    const classified = classifyEntryName(name);
    if (classified.kind === "harmless") {
      summary.harmlessCount += 1;
    } else if (classified.kind === "source") {
      summary.sourceLikeCount += 1;
    } else if (classified.kind === "project-marker") {
      summary.projectMarkerNames.push(name);
    } else if (classified.kind === "generated-marker") {
      summary.generatedMarkerNames.push(name);
    } else {
      summary.unknownNonSourceCount += 1;
    }
  }

  if (summary.projectMarkerNames.length > 0) {
    const markers = summary.projectMarkerNames.join(", ");
    if (
      summary.projectMarkerNames.some((n) => n.toLowerCase() === "package.json")
    ) {
      block("Folder contains package.json.");
    }
    if (summary.projectMarkerNames.some((n) => n.toLowerCase() === "src")) {
      block("Folder contains src/.");
    }
    if (summary.projectMarkerNames.some((n) => n.toLowerCase() === ".git")) {
      block("Folder contains .git/.");
    }
    if (
      summary.projectMarkerNames.some((n) => n.toLowerCase() === "node_modules")
    ) {
      block("Folder contains node_modules/.");
    }
    if (state.status !== "blocked") {
      block(`Folder contains project marker(s): ${markers}.`);
    }
  }

  if (summary.generatedMarkerNames.length > 0) {
    block(
      `Folder contains generated-output marker(s): ${summary.generatedMarkerNames.join(", ")}.`,
    );
  }

  if (summary.sourceLikeCount > 0) {
    block("Folder contains existing source-like files.");
  }

  // "Many files" — conservative threshold.
  if (summary.totalEntries > 12) {
    block("Folder contains many files (conservative block).");
  }

  if (state.status === "blocked") {
    return finish(resolvedPath);
  }

  if (summary.totalEntries === 0) {
    reasons.push("Folder exists, is readable, and appears empty.");
  } else if (
    summary.harmlessCount === summary.totalEntries &&
    summary.harmlessCount > 0
  ) {
    caution(
      "Folder contains only harmless placeholder files (for example README.md or .gitkeep).",
    );
  } else if (summary.unknownNonSourceCount > 0 && summary.unknownNonSourceCount <= 3) {
    caution(
      "Folder has a small number of unknown non-source files.",
    );
  } else if (summary.totalEntries > 0) {
    // Unknown mix and not already blocked — block when unsure.
    block("Folder contents are not clearly empty/harmless (blocked when unsure).");
    return finish(resolvedPath);
  }

  if (isOneDriveOrDesktopContext(resolvedPath)) {
    caution(
      "Folder is inside OneDrive/Desktop but otherwise appears acceptable.",
    );
  }

  return finish(resolvedPath);
}
