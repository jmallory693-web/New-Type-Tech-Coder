import fs from "node:fs";
import path from "node:path";
import {
  MAX_SCAN_FILE_BYTES,
  MAX_TOP_LEVEL_ENTRIES,
  isConfigFileName,
  isDenyDirectoryName,
  isInterestingFolderName,
  isLockFileName,
  isSensitiveFileName,
} from "../../shared/denyList";
import type {
  PackageScriptEntry,
  ProjectScanResult,
  SkippedScanItem,
} from "../../shared/types";
import { ONEDRIVE_PROJECT_WARNING } from "../../shared/userFacingMessages";
import type { SafetyGate } from "../safety/SafetyGate";
import { inspectLinkSafety } from "../safety/linkSafety";

interface PackageJsonShape {
  name?: unknown;
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
}

function isProbablyBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) {
      return true;
    }
  }
  return false;
}

/** Windows editors often save package.json with a UTF-8 BOM; strip so JSON.parse works. */
function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function objectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>).sort((a, b) =>
    a.localeCompare(b),
  );
}

function scriptNames(value: unknown): string[] {
  return objectKeys(value);
}

function scriptEntries(value: unknown): PackageScriptEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      value: typeof record[name] === "string" ? (record[name] as string) : String(record[name] ?? ""),
    }));
}

/**
 * Shallow, Safety-Gate-routed project scanner (Stage 3).
 * Read-only. No AI. No commands. No deep recursion.
 */
export class ProjectScanner {
  constructor(private readonly safetyGate: SafetyGate) {}

  scan(): ProjectScanResult {
    const project = this.safetyGate.getProject();
    if (!project) {
      throw new Error("No project folder selected. Choose a project folder first.");
    }

    this.safetyGate.log(
      "info",
      "Scan started",
      `Shallow safe metadata scan for ${project.displayName}`,
    );

    const skippedItems: SkippedScanItem[] = [];
    const inspectedSafeFiles: string[] = [];
    const topLevelNames: string[] = [];
    const importantFolders: string[] = [];
    const importantFiles: string[] = [];
    const configFilesByName: string[] = [];
    const lockFilesPresent: string[] = [];
    const safetyNotes: string[] = [
      "Scan stayed shallow (project root only) for safety.",
      "No AI provider was used.",
      "No project files were edited.",
      "No project commands were run.",
      "Secrets, .env files, node_modules, .git internals, and build output folders were not read.",
    ];

    if (project.isOneDrive) {
      safetyNotes.push(ONEDRIVE_PROJECT_WARNING);
    }

    const rootCheck = this.safetyGate.checkScanAccess(project.normalizedPath, "list");
    if (!rootCheck.allowed) {
      skippedItems.push({
        path: project.normalizedPath,
        reason: rootCheck.denyReason ?? "Project root not accessible for listing",
      });
      this.safetyGate.log(
        "warning",
        "Blocked/skipped items",
        "Could not list project root safely.",
      );
      return this.buildResult({
        project,
        skippedItems,
        inspectedSafeFiles,
        topLevelNames,
        importantFolders,
        importantFiles,
        configFilesByName,
        lockFilesPresent,
        packageScripts: [],
        packageScriptEntries: [],
        dependencies: [],
        devDependencies: [],
        packageJsonValid: false,
        packageJsonWarning: "Could not list the project folder safely.",
        readmeTitleOrFirstLine: null,
        packageDisplayName: project.displayName,
        safetyNotes,
      });
    }

    let dirents: fs.Dirent[] = [];
    try {
      dirents = fs.readdirSync(project.normalizedPath, { withFileTypes: true });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Permission or I/O error listing folder";
      skippedItems.push({ path: project.normalizedPath, reason });
      this.safetyGate.log("warning", "Blocked/skipped items", reason);
      return this.buildResult({
        project,
        skippedItems,
        inspectedSafeFiles,
        topLevelNames,
        importantFolders,
        importantFiles,
        configFilesByName,
        lockFilesPresent,
        packageScripts: [],
        packageScriptEntries: [],
        dependencies: [],
        devDependencies: [],
        packageJsonValid: false,
        packageJsonWarning: "Could not read the project folder listing.",
        readmeTitleOrFirstLine: null,
        packageDisplayName: project.displayName,
        safetyNotes,
      });
    }

    if (dirents.length > MAX_TOP_LEVEL_ENTRIES) {
      safetyNotes.push(
        `Top-level listing is large (${dirents.length} entries). Only the first ${MAX_TOP_LEVEL_ENTRIES} names were considered.`,
      );
      dirents = dirents.slice(0, MAX_TOP_LEVEL_ENTRIES);
    }

    for (const dirent of dirents) {
      const name = dirent.name;
      const absolute = path.join(project.normalizedPath, name);
      topLevelNames.push(name);

      if (dirent.isSymbolicLink()) {
        skippedItems.push({
          path: this.relativeOrName(project.normalizedPath, absolute),
          reason: "Skipped symlink for safety (not followed, not read)",
        });
        continue;
      }

      // Catch Windows junctions / reparse points that Dirent may report as directories.
      const linkCheck = inspectLinkSafety(absolute);
      if (!linkCheck.safe) {
        skippedItems.push({
          path: this.relativeOrName(project.normalizedPath, absolute),
          reason: linkCheck.reason ?? "Skipped unsafe link for safety",
        });
        continue;
      }

      if (dirent.isDirectory()) {
        if (isDenyDirectoryName(name)) {
          skippedItems.push({
            path: this.relativeOrName(project.normalizedPath, absolute),
            reason: `Denied directory (not entered): ${name}`,
          });
          continue;
        }

        const listCheck = this.safetyGate.checkScanAccess(absolute, "list");
        if (!listCheck.allowed) {
          skippedItems.push({
            path: this.relativeOrName(project.normalizedPath, absolute),
            reason: listCheck.denyReason ?? "Directory blocked by Safety Gate",
          });
          continue;
        }

        if (isInterestingFolderName(name)) {
          importantFolders.push(name);
        }
        continue;
      }

      if (!dirent.isFile()) {
        skippedItems.push({
          path: this.relativeOrName(project.normalizedPath, absolute),
          reason: "Skipped non-file entry",
        });
        continue;
      }

      if (isSensitiveFileName(name)) {
        skippedItems.push({
          path: this.relativeOrName(project.normalizedPath, absolute),
          reason: `Sensitive file skipped (not read): ${name}`,
        });
        continue;
      }

      if (isLockFileName(name)) {
        const presence = this.safetyGate.checkScanAccess(absolute, "detect-presence");
        if (presence.allowed) {
          lockFilesPresent.push(name);
          importantFiles.push(`${name} (presence only)`);
        } else {
          skippedItems.push({
            path: this.relativeOrName(project.normalizedPath, absolute),
            reason: presence.denyReason ?? "Lockfile blocked",
          });
        }
        continue;
      }

      if (isConfigFileName(name)) {
        const presence = this.safetyGate.checkScanAccess(absolute, "detect-presence");
        if (!presence.allowed && name.toLowerCase() !== "package.json") {
          skippedItems.push({
            path: this.relativeOrName(project.normalizedPath, absolute),
            reason: presence.denyReason ?? "Config file blocked",
          });
        } else {
          configFilesByName.push(name);
          if (name.toLowerCase() !== "package.json") {
            importantFiles.push(`${name} (name only)`);
          }
        }
      }
    }

    topLevelNames.sort((a, b) => a.localeCompare(b));
    importantFolders.sort((a, b) => a.localeCompare(b));
    configFilesByName.sort((a, b) => a.localeCompare(b));
    lockFilesPresent.sort((a, b) => a.localeCompare(b));

    if (skippedItems.length > 0) {
      this.safetyGate.log(
        "info",
        "Blocked/skipped items",
        `${skippedItems.length} item(s) skipped during scan (deny list, permissions, or safety rules).`,
      );
    }

    const packageJsonPath = path.join(project.normalizedPath, "package.json");
    let packageScripts: string[] = [];
    let packageScriptEntries: PackageScriptEntry[] = [];
    let dependencies: string[] = [];
    let devDependencies: string[] = [];
    let packageJsonValid = false;
    let packageJsonWarning: string | null = null;
    let packageDisplayName = project.displayName;

    const packageRead = this.readAllowedTextFile(
      packageJsonPath,
      project.normalizedPath,
      skippedItems,
      inspectedSafeFiles,
    );

    if (packageRead) {
      importantFiles.unshift("package.json");
      try {
        const parsed = JSON.parse(stripUtf8Bom(packageRead)) as PackageJsonShape;
        packageJsonValid = true;
        if (typeof parsed.name === "string" && parsed.name.trim()) {
          packageDisplayName = parsed.name.trim();
        }
        packageScripts = scriptNames(parsed.scripts);
        packageScriptEntries = scriptEntries(parsed.scripts);
        dependencies = objectKeys(parsed.dependencies);
        devDependencies = objectKeys(parsed.devDependencies);
      } catch {
        packageJsonValid = false;
        packageJsonWarning =
          "package.json was found but could not be parsed. It may be invalid JSON.";
        safetyNotes.push(packageJsonWarning);
        this.safetyGate.log(
          "warning",
          "Safe files inspected",
          "package.json exists but is not valid JSON.",
        );
      }
    } else if (fs.existsSync(packageJsonPath)) {
      // exists but was not readable / blocked — already in skippedItems if gated
    }

    let readmeTitleOrFirstLine: string | null = null;
    const readmeCandidates = ["README.md", "README.txt", "README", "Readme.md"];
    for (const candidate of readmeCandidates) {
      const readmePath = path.join(project.normalizedPath, candidate);
      if (!fs.existsSync(readmePath)) {
        continue;
      }
      const content = this.readAllowedTextFile(
        readmePath,
        project.normalizedPath,
        skippedItems,
        inspectedSafeFiles,
      );
      if (content) {
        if (!importantFiles.includes(candidate)) {
          importantFiles.push(candidate);
        }
        readmeTitleOrFirstLine = this.firstUsefulReadmeLine(content);
        break;
      }
    }

    if (inspectedSafeFiles.length > 0) {
      this.safetyGate.log(
        "info",
        "Safe files inspected",
        inspectedSafeFiles.join(", "),
      );
    }

    const result = this.buildResult({
      project,
      skippedItems,
      inspectedSafeFiles,
      topLevelNames,
      importantFolders,
      importantFiles: Array.from(new Set(importantFiles)),
      configFilesByName,
      lockFilesPresent,
      packageScripts,
      packageScriptEntries,
      dependencies,
      devDependencies,
      packageJsonValid,
      packageJsonWarning,
      readmeTitleOrFirstLine,
      packageDisplayName,
      safetyNotes,
    });

    this.safetyGate.log(
      "success",
      "Summary generated",
      `Plain-English project summary ready (${result.skippedItems.length} skipped item(s)).`,
    );

    return result;
  }

  private relativeOrName(root: string, absolute: string): string {
    const rel = path.relative(root, absolute);
    return rel || path.basename(absolute);
  }

  private readAllowedTextFile(
    absolutePath: string,
    projectRoot: string,
    skippedItems: SkippedScanItem[],
    inspectedSafeFiles: string[],
  ): string | null {
    const rel = this.relativeOrName(projectRoot, absolutePath);

    // Stage 11B: lstat first — never follow symlinks/junctions for package.json/README.
    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const linkCheck = inspectLinkSafety(absolutePath);
    if (!linkCheck.safe) {
      skippedItems.push({
        path: rel,
        reason: linkCheck.reason ?? "Skipped unsafe link for safety",
      });
      return null;
    }

    const access = this.safetyGate.checkScanAccess(absolutePath, "read-content");
    if (!access.allowed) {
      skippedItems.push({
        path: rel,
        reason: access.denyReason ?? "Blocked by Safety Gate",
      });
      return null;
    }

    try {
      const lstat = fs.lstatSync(absolutePath);
      if (!lstat.isFile() || lstat.isSymbolicLink()) {
        skippedItems.push({
          path: rel,
          reason: lstat.isSymbolicLink()
            ? "Skipped symlink for safety (not followed, not read)"
            : "Not a regular file",
        });
        return null;
      }
      if (lstat.size > MAX_SCAN_FILE_BYTES) {
        skippedItems.push({
          path: rel,
          reason: `Skipped large file (>${MAX_SCAN_FILE_BYTES} bytes)`,
        });
        return null;
      }

      const buffer = fs.readFileSync(absolutePath);
      if (isProbablyBinary(buffer)) {
        skippedItems.push({ path: rel, reason: "Skipped binary file" });
        return null;
      }

      inspectedSafeFiles.push(rel);
      return buffer.toString("utf8");
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Permission or I/O error";
      skippedItems.push({ path: rel, reason: `Skipped (could not read): ${reason}` });
      return null;
    }
  }

  private firstUsefulReadmeLine(content: string): string | null {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const withoutHashes = trimmed.replace(/^#+\s*/, "").trim();
      if (withoutHashes) {
        return withoutHashes.slice(0, 200);
      }
    }
    return null;
  }

  private detectProjectTypes(input: {
    topLevelNames: string[];
    importantFolders: string[];
    configFilesByName: string[];
    dependencies: string[];
    devDependencies: string[];
    packageJsonValid: boolean;
    hasPackageJson: boolean;
  }): string[] {
    const types: string[] = [];
    const allDeps = new Set([
      ...input.dependencies.map((d) => d.toLowerCase()),
      ...input.devDependencies.map((d) => d.toLowerCase()),
    ]);
    const names = new Set(input.topLevelNames.map((n) => n.toLowerCase()));
    const configs = new Set(input.configFilesByName.map((n) => n.toLowerCase()));
    const folders = new Set(input.importantFolders.map((n) => n.toLowerCase()));

    if (configs.has("vite.config.ts") || configs.has("vite.config.js") || allDeps.has("vite")) {
      types.push("Vite app");
    }
    if (allDeps.has("react") || allDeps.has("react-dom")) {
      types.push("React app");
    }
    if (
      allDeps.has("electron") ||
      folders.has("electron") ||
      names.has("electron") ||
      [...configs].some((c) => c.includes("electron"))
    ) {
      types.push("Electron app");
    }
    if (
      configs.has("tsconfig.json") ||
      [...configs].some((c) => c.startsWith("tsconfig")) ||
      allDeps.has("typescript")
    ) {
      types.push("TypeScript project");
    }
    if (input.hasPackageJson) {
      types.push("Node app");
    }
    if (
      names.has("requirements.txt") ||
      names.has("pyproject.toml") ||
      names.has("pipfile") ||
      names.has("setup.py")
    ) {
      types.push("Python project");
    }

    if (types.length === 0) {
      types.push("Unknown project");
    }

    return types;
  }

  private detectTechStack(input: {
    likelyProjectTypes: string[];
    dependencies: string[];
    devDependencies: string[];
    configFilesByName: string[];
    importantFolders: string[];
  }): string[] {
    const stack = new Set<string>();
    for (const t of input.likelyProjectTypes) {
      if (t !== "Unknown project") {
        stack.add(t.replace(/ app$/i, "").replace(/ project$/i, ""));
      }
    }

    const depHints: Array<[string, string]> = [
      ["react", "React"],
      ["react-dom", "React DOM"],
      ["vite", "Vite"],
      ["electron", "Electron"],
      ["typescript", "TypeScript"],
      ["@types/node", "Node typings"],
      ["express", "Express"],
      ["next", "Next.js"],
    ];
    const all = new Set(
      [...input.dependencies, ...input.devDependencies].map((d) => d.toLowerCase()),
    );
    for (const [dep, label] of depHints) {
      if (all.has(dep)) {
        stack.add(label);
      }
    }

    if (input.configFilesByName.some((c) => /^tsconfig/i.test(c))) {
      stack.add("TypeScript");
    }
    if (input.importantFolders.includes("src")) {
      stack.add("src/ layout");
    }

    return Array.from(stack);
  }

  private buildPlainEnglish(input: {
    packageDisplayName: string;
    likelyProjectTypes: string[];
    techStack: string[];
    importantFolders: string[];
    importantFiles: string[];
    packageScripts: string[];
    readmeTitleOrFirstLine: string | null;
    packageJsonWarning: string | null;
  }): string {
    const typePhrase =
      input.likelyProjectTypes.length === 1
        ? `This appears to be a ${input.likelyProjectTypes[0].toLowerCase()}.`
        : `Detected signs of: ${input.likelyProjectTypes.join(", ")}.`;

    const stackPhrase =
      input.techStack.length > 0
        ? `Detected tech signals include ${input.techStack.join(", ")}.`
        : "Could not confirm a detailed tech stack from safe metadata alone.";

    const folderPhrase =
      input.importantFolders.length > 0
        ? `Important folders found: ${input.importantFolders.join(", ")}.`
        : "No common app folders (such as src, app, or components) were confirmed at the top level.";

    const filePhrase =
      input.importantFiles.length > 0
        ? `Important files noted: ${input.importantFiles.join(", ")}.`
        : "Few recognizable project files were found at the top level.";

    const scriptPhrase =
      input.packageScripts.length > 0
        ? `package.json lists scripts such as: ${input.packageScripts.slice(0, 12).join(", ")}${input.packageScripts.length > 12 ? ", …" : ""}.`
        : "No package scripts were confirmed.";

    const readmePhrase = input.readmeTitleOrFirstLine
      ? `README first useful line: “${input.readmeTitleOrFirstLine}”.`
      : "No README text was safely readable.";

    const caution = input.packageJsonWarning
      ? ` Warning: ${input.packageJsonWarning}`
      : " These conclusions are cautious and based only on safe local metadata.";

    return [
      `Project “${input.packageDisplayName}”: ${typePhrase}`,
      stackPhrase,
      folderPhrase,
      filePhrase,
      scriptPhrase,
      readmePhrase,
      `Could not confirm deeper behavior without reading more of the codebase.${caution}`,
    ].join(" ");
  }

  private buildMarkdown(result: Omit<ProjectScanResult, "markdownReport">): string {
    const lines: string[] = [
      "# New Type Tech Coder - Project Summary",
      "",
      "## Overview",
      "",
      `- **Project name:** ${result.projectName}`,
      `- **Project path:** ${result.projectPath}`,
      `- **Likely project type:** ${result.likelyProjectTypes.join("; ")}`,
      `- **Detected tech stack:** ${result.techStack.length ? result.techStack.join(", ") : "Could not confirm"}`,
      `- **Last scan:** ${result.scannedAt}`,
      "",
      "## Plain-English explanation",
      "",
      result.plainEnglishExplanation,
      "",
      "## Important folders found",
      "",
    ];

    if (result.importantFolders.length) {
      for (const folder of result.importantFolders) {
        lines.push(`- ${folder}`);
      }
    } else {
      lines.push("- None confirmed at top level");
    }

    lines.push("", "## Important files found", "");
    if (result.importantFiles.length) {
      for (const file of result.importantFiles) {
        lines.push(`- ${file}`);
      }
    } else {
      lines.push("- None confirmed");
    }

    lines.push("", "## Config files (by name only)", "");
    if (result.configFilesByName.length) {
      for (const file of result.configFilesByName) {
        lines.push(`- ${file}`);
      }
    } else {
      lines.push("- None detected");
    }

    lines.push("", "## Top-level names", "");
    if (result.topLevelNames.length) {
      for (const name of result.topLevelNames) {
        lines.push(`- ${name}`);
      }
    } else {
      lines.push("- (empty or unavailable)");
    }

    lines.push("", "## Package scripts", "");
    if (result.packageScripts.length) {
      for (const script of result.packageScripts) {
        lines.push(`- ${script}`);
      }
    } else {
      lines.push("- None found / package.json missing or unreadable");
    }

    lines.push("", "## Dependencies", "");
    if (result.dependencies.length) {
      for (const dep of result.dependencies) {
        lines.push(`- ${dep}`);
      }
    } else {
      lines.push("- None listed");
    }

    lines.push("", "## Dev dependencies", "");
    if (result.devDependencies.length) {
      for (const dep of result.devDependencies) {
        lines.push(`- ${dep}`);
      }
    } else {
      lines.push("- None listed");
    }

    if (result.lockFilesPresent.length) {
      lines.push("", "## Lock files (presence only)", "");
      for (const lock of result.lockFilesPresent) {
        lines.push(`- ${lock}`);
      }
    }

    lines.push("", "## Safety notes", "");
    for (const note of result.safetyNotes) {
      lines.push(`- ${note}`);
    }

    lines.push("", "## Skipped symlinks / junctions", "");
    lines.push(
      `- **Count:** ${result.skippedSymlinkOrJunctionCount}`,
    );
    if (result.skippedSymlinkOrJunctionNames.length > 0) {
      for (const name of result.skippedSymlinkOrJunctionNames) {
        lines.push(`- ${name}`);
      }
    } else {
      lines.push("- None");
    }

    lines.push("", "## Skipped / blocked items", "");
    if (result.skippedItems.length) {
      for (const item of result.skippedItems) {
        lines.push(`- ${item.path}: ${item.reason}`);
      }
    } else {
      lines.push("- None");
    }

    lines.push(
      "",
      "## Suggested review question for ChatGPT / Claude / Gemini / Grok",
      "",
      result.suggestedReviewQuestion,
      "",
    );

    return lines.join("\n");
  }

  private buildResult(input: {
    project: { displayName: string; normalizedPath: string };
    skippedItems: SkippedScanItem[];
    inspectedSafeFiles: string[];
    topLevelNames: string[];
    importantFolders: string[];
    importantFiles: string[];
    configFilesByName: string[];
    lockFilesPresent: string[];
    packageScripts: string[];
    packageScriptEntries: PackageScriptEntry[];
    dependencies: string[];
    devDependencies: string[];
    packageJsonValid: boolean;
    packageJsonWarning: string | null;
    readmeTitleOrFirstLine: string | null;
    packageDisplayName: string;
    safetyNotes: string[];
  }): ProjectScanResult {
    const hasPackageJson = input.importantFiles.some((f) =>
      f.toLowerCase().startsWith("package.json"),
    ) || input.configFilesByName.some((f) => f.toLowerCase() === "package.json");

    const likelyProjectTypes = this.detectProjectTypes({
      topLevelNames: input.topLevelNames,
      importantFolders: input.importantFolders,
      configFilesByName: input.configFilesByName,
      dependencies: input.dependencies,
      devDependencies: input.devDependencies,
      packageJsonValid: input.packageJsonValid,
      hasPackageJson,
    });

    const techStack = this.detectTechStack({
      likelyProjectTypes,
      dependencies: input.dependencies,
      devDependencies: input.devDependencies,
      configFilesByName: input.configFilesByName,
      importantFolders: input.importantFolders,
    });

    const plainEnglishExplanation = this.buildPlainEnglish({
      packageDisplayName: input.packageDisplayName,
      likelyProjectTypes,
      techStack,
      importantFolders: input.importantFolders,
      importantFiles: input.importantFiles,
      packageScripts: input.packageScripts,
      readmeTitleOrFirstLine: input.readmeTitleOrFirstLine,
      packageJsonWarning: input.packageJsonWarning,
    });

    const suggestedReviewQuestion =
      "Based on this safe project summary only: what kind of app is this, what should a non-coder be careful about, and what is the safest next step before letting any AI edit files?";

    const linkSkips = input.skippedItems.filter(
      (item) =>
        /symlink/i.test(item.reason) ||
        /junction/i.test(item.reason) ||
        /reparse/i.test(item.reason),
    );
    const skippedSymlinkOrJunctionNames = linkSkips
      .map((item) => item.path)
      .slice(0, 40);
    const skippedSymlinkOrJunctionCount = linkSkips.length;

    const safetyNotes = [...input.safetyNotes];
    if (skippedSymlinkOrJunctionCount > 0) {
      safetyNotes.push(
        `Skipped ${skippedSymlinkOrJunctionCount} symlink/junction item(s) for safety. Symlinks and junctions are not followed or read.`,
      );
    } else {
      safetyNotes.push(
        "No symlinks or junctions were followed during this scan.",
      );
    }

    const withoutMarkdown = {
      scannedAt: new Date().toISOString(),
      projectName: input.packageDisplayName,
      projectPath: input.project.normalizedPath,
      likelyProjectTypes,
      techStack,
      importantFolders: input.importantFolders,
      importantFiles: input.importantFiles,
      configFilesByName: input.configFilesByName,
      topLevelNames: input.topLevelNames,
      packageScripts: input.packageScripts,
      packageScriptEntries: input.packageScriptEntries,
      dependencies: input.dependencies,
      devDependencies: input.devDependencies,
      lockFilesPresent: input.lockFilesPresent,
      readmeTitleOrFirstLine: input.readmeTitleOrFirstLine,
      packageJsonValid: input.packageJsonValid,
      packageJsonWarning: input.packageJsonWarning,
      plainEnglishExplanation,
      safetyNotes,
      skippedItems: input.skippedItems,
      skippedSymlinkOrJunctionCount,
      skippedSymlinkOrJunctionNames,
      inspectedSafeFiles: input.inspectedSafeFiles,
      suggestedReviewQuestion,
    };

    return {
      ...withoutMarkdown,
      markdownReport: this.buildMarkdown(withoutMarkdown),
    };
  }
}
