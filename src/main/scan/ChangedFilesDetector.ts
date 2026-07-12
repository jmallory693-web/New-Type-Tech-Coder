import { spawn } from "node:child_process";
import path from "node:path";
import {
  isConfigFileName,
  isDenyDirectoryName,
  isLockFileName,
  isSensitiveFileName,
} from "../../shared/denyList";
import type {
  ChangedFileEntry,
  ChangedFileKind,
  ChangedFileRiskFlag,
  ChangedFilesScanResult,
  SkippedScanItem,
} from "../../shared/types";
import { NO_GIT_CHANGED_FILES_NOTE } from "../../shared/userFacingMessages";
import type { SafetyGate } from "../safety/SafetyGate";
import { inspectLinkSafety } from "../safety/linkSafety";

const MAX_DISPLAY_FILES = 80;
const MANY_FILES_THRESHOLD = 40;
const GIT_TIMEOUT_MS = 45_000;

function runGit(
  cwd: string,
  args: string[],
  timeoutMs = GIT_TIMEOUT_MS,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_EDITOR: "true",
        GIT_ASKPASS: "echo",
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Git command timed out: git ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout,
        stderr: stderr.trim(),
      });
    });
  });
}

function normalizeRelPath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function pathHasDeniedSegment(relPath: string): boolean {
  const parts = normalizeRelPath(relPath).split("/").filter(Boolean);
  return parts.some((part) => isDenyDirectoryName(part));
}

function basenameOf(relPath: string): string {
  const normalized = normalizeRelPath(relPath);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function mapStatusCode(code: string): ChangedFileKind {
  const c = code.trim().toUpperCase();
  if (c === "??" || c === "A" || c === "AM") return "added";
  if (c === "D" || c === "AD") return "deleted";
  if (c.startsWith("R") || c.startsWith("C")) return "renamed";
  if (c === "M" || c === "MM" || c === "MD" || c === "RM") return "modified";
  if (c === "U" || c === "UU" || c === "AA" || c === "DD") return "other";
  if (c.includes("M")) return "modified";
  if (c.includes("A")) return "added";
  if (c.includes("D")) return "deleted";
  return "other";
}

function parsePorcelainZ(stdout: string): Array<{
  code: string;
  path: string;
  previousPath: string | null;
}> {
  const entries: Array<{
    code: string;
    path: string;
    previousPath: string | null;
  }> = [];
  if (!stdout) return entries;

  // Match CheckpointManager: --porcelain -z records separated by NUL.
  // Normal: "XY PATH\0"  Rename/copy: "XY PATH\0ORIG_PATH\0"
  const records = stdout.split("\0").filter(Boolean);
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (record.length < 4) continue;
    const code = record.slice(0, 2);
    let filePath = record.slice(3);
    let previousPath: string | null = null;
    if (code.includes("R") || code.includes("C")) {
      const orig = records[i + 1];
      if (orig) {
        previousPath = normalizeRelPath(orig);
        i += 1;
      }
    }
    filePath = normalizeRelPath(filePath);
    if (!filePath) continue;
    entries.push({ code, path: filePath, previousPath });
  }
  return entries;
}

function parseNumstat(
  stdout: string,
): Map<string, { insertions: number | null; deletions: number | null }> {
  const map = new Map<
    string,
    { insertions: number | null; deletions: number | null }
  >();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [insRaw, delRaw, ...pathParts] = parts;
    let filePath = pathParts.join("\t");
    // renames: old => new
    if (filePath.includes(" => ")) {
      const arrow = filePath.split(" => ");
      filePath = arrow[arrow.length - 1] ?? filePath;
    }
    const insertions = insRaw === "-" ? null : Number.parseInt(insRaw, 10);
    const deletions = delRaw === "-" ? null : Number.parseInt(delRaw, 10);
    map.set(normalizeRelPath(filePath), {
      insertions: Number.isFinite(insertions) ? insertions : null,
      deletions: Number.isFinite(deletions) ? deletions : null,
    });
  }
  return map;
}

function riskForPath(
  relPath: string,
  kind: ChangedFileKind,
): ChangedFileRiskFlag[] {
  const flags: ChangedFileRiskFlag[] = [];
  const base = basenameOf(relPath);
  const lower = normalizeRelPath(relPath).toLowerCase();

  if (base.toLowerCase() === "package.json") {
    flags.push({
      id: "package-json",
      label: "package.json changed",
      plainEnglish:
        "package.json changed — dependency or script changes can affect installs and builds.",
    });
  }
  if (isLockFileName(base)) {
    flags.push({
      id: "lockfile",
      label: "Lockfile changed",
      plainEnglish:
        "A package lockfile changed — dependency versions may have shifted.",
    });
  }
  if (isSensitiveFileName(base) || lower.includes(".env")) {
    flags.push({
      id: "secret-like",
      label: "Secret-like file",
      plainEnglish:
        "A secret-like or .env-related file appears in the change list. Do not paste its contents into AI tools.",
    });
  }
  if (isConfigFileName(base)) {
    flags.push({
      id: "config",
      label: "Config file",
      plainEnglish: `Config file changed (${base}). Review carefully before accepting.`,
    });
  }

  const safetyHotspots = [
    /safetygate/i,
    /denylist/i,
    /checkpoint/i,
    /safecommand/i,
    /historystore/i,
    /providerregistry/i,
    /qweninspect/i,
    /linksafety/i,
    /v1-safety-rules/i,
  ];
  if (
    safetyHotspots.some((re) => re.test(lower)) ||
    /\/safety\//i.test(lower) ||
    /\/checkpoint\//i.test(lower) ||
    /\/commands\//i.test(lower) ||
    /\/providers\//i.test(lower) ||
    /\/history\//i.test(lower)
  ) {
    flags.push({
      id: "safety-related",
      label: "Safety-related path",
      plainEnglish:
        "A safety, backup, command-runner, provider, or history-related file changed. Review with extra care.",
    });
  }

  if (
    /preload/i.test(lower) ||
    /\/main\//i.test(lower) ||
    /electron/i.test(lower) ||
    /dist-electron/i.test(lower)
  ) {
    flags.push({
      id: "electron-core",
      label: "Electron / main / preload",
      plainEnglish:
        "Electron main, preload, or related core files changed — this can affect app security boundaries.",
    });
  }

  if (kind === "deleted") {
    flags.push({
      id: "deleted",
      label: "Deleted file",
      plainEnglish: "A file was deleted. Confirm this was intentional.",
    });
  }

  const expectedRoots = [
    "src/",
    "docs/",
    "readme",
    "test/",
    "tests/",
    "__tests__/",
    "public/",
    "scripts/",
  ];
  const inExpected = expectedRoots.some(
    (root) => lower.startsWith(root) || lower === root.replace(/\/$/, ""),
  );
  const isRootMeta =
    !lower.includes("/") &&
    (isConfigFileName(base) ||
      /^readme/i.test(base) ||
      base.toLowerCase() === "package.json" ||
      isLockFileName(base));
  if (!inExpected && !isRootMeta && kind !== "deleted") {
    // Only flag when clearly outside common source/docs areas and not root metadata
    if (
      lower.startsWith("release/") ||
      lower.startsWith("node_modules/") ||
      lower.startsWith("dist/") ||
      lower.startsWith("build/") ||
      lower.startsWith(".cursor/") ||
      lower.startsWith("coverage/")
    ) {
      flags.push({
        id: "outside-expected",
        label: "Outside common source/docs areas",
        plainEnglish: `Changed path looks outside typical source/docs areas: ${relPath}`,
      });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return flags.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

function emptyResult(
  projectPath: string,
  partial: Partial<ChangedFilesScanResult>,
): ChangedFilesScanResult {
  return {
    scannedAt: new Date().toISOString(),
    projectPath,
    isGitRepo: false,
    gitAvailable: false,
    statusMessage: "Changed-file detection currently requires Git.",
    errorMessage: null,
    branchName: null,
    totalCount: 0,
    modifiedCount: 0,
    addedCount: 0,
    deletedCount: 0,
    renamedCount: 0,
    untrackedCount: 0,
    otherCount: 0,
    riskyCount: 0,
    truncated: false,
    truncationNote: null,
    manyFilesWarning: null,
    globalRiskFlags: [],
    files: [],
    skippedOutsideOrDenied: [],
    ...partial,
  };
}

/**
 * Read-only Git changed-file detector.
 * Never stages, commits, resets, cleans, or modifies the project.
 */
export class ChangedFilesDetector {
  constructor(private readonly safetyGate: SafetyGate) {}

  async scan(): Promise<ChangedFilesScanResult> {
    const project = this.safetyGate.getProject();
    if (!project) {
      return emptyResult("", {
        statusMessage: "Select a project folder before scanning changed files.",
        errorMessage: "No project folder selected.",
      });
    }

    const root = project.normalizedPath;
    this.safetyGate.log(
      "info",
      "Changed-files scan started",
      `Read-only Git status for ${project.displayName}. No stage/commit/reset/clean.`,
    );

    let gitAvailable = true;
    try {
      const version = await runGit(root, ["--version"]);
      if (version.code !== 0) {
        gitAvailable = false;
      }
    } catch {
      gitAvailable = false;
    }

    if (!gitAvailable) {
      const result = emptyResult(root, {
        gitAvailable: false,
        isGitRepo: false,
        statusMessage:
          "Git was not found on this computer. Changed-file detection currently requires Git.",
        errorMessage: "Git is not available.",
      });
      this.safetyGate.log(
        "warning",
        "Changed-files scan failed",
        result.statusMessage,
      );
      return result;
    }

    try {
      const inside = await runGit(root, ["rev-parse", "--is-inside-work-tree"]);
      if (inside.code !== 0 || inside.stdout.trim() !== "true") {
        const result = emptyResult(root, {
          gitAvailable: true,
          isGitRepo: false,
          statusMessage: NO_GIT_CHANGED_FILES_NOTE,
          errorMessage: "Selected folder is not a Git repository.",
        });
        this.safetyGate.log(
          "warning",
          "Changed-files scan failed",
          result.statusMessage,
        );
        return result;
      }

      const toplevel = await runGit(root, ["rev-parse", "--show-toplevel"]);
      const top = path.resolve(toplevel.stdout.trim());
      if (path.resolve(root).toLowerCase() !== top.toLowerCase()) {
        const result = emptyResult(root, {
          gitAvailable: true,
          isGitRepo: true,
          statusMessage:
            "Changed-file detection works when the selected folder is the Git repository root.",
          errorMessage: `Git root is ${top}, but selected folder is ${root}.`,
        });
        this.safetyGate.log(
          "warning",
          "Changed-files scan failed",
          result.errorMessage ?? result.statusMessage,
        );
        return result;
      }

      let branchName: string | null = null;
      try {
        const branch = await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
        if (branch.code === 0) {
          branchName = branch.stdout.trim() || null;
        }
      } catch {
        branchName = null;
      }

      // Read-only: name-status + untracked via porcelain -z
      const status = await runGit(root, [
        "status",
        "--porcelain",
        "-z",
        "--untracked-files=all",
      ]);
      if (status.code !== 0) {
        throw new Error(status.stderr || "git status failed");
      }

      const numstat = await runGit(root, [
        "diff",
        "--numstat",
        "HEAD",
      ]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
      // Also include staged numstat without mutating
      const numstatCached = await runGit(root, [
        "diff",
        "--cached",
        "--numstat",
      ]).catch(() => ({ code: 1, stdout: "", stderr: "" }));

      const stats = parseNumstat(
        `${numstat.stdout}\n${numstatCached.stdout}`,
      );
      const rawEntries = parsePorcelainZ(status.stdout);

      const skippedOutsideOrDenied: SkippedScanItem[] = [];
      const files: ChangedFileEntry[] = [];

      for (const raw of rawEntries) {
        const rel = raw.path;
        if (!rel) continue;

        if (pathHasDeniedSegment(rel)) {
          skippedOutsideOrDenied.push({
            path: rel,
            reason: "Denied folder segment — listed as skipped, contents not inspected",
          });
          continue;
        }

        const absolute = path.resolve(root, rel);
        const rootResolved = path.resolve(root);
        if (
          absolute !== rootResolved &&
          !absolute.toLowerCase().startsWith(rootResolved.toLowerCase() + path.sep)
        ) {
          skippedOutsideOrDenied.push({
            path: rel,
            reason: "Path resolves outside the selected project root",
          });
          continue;
        }

        const linkCheck = inspectLinkSafety(absolute);
        if (!linkCheck.safe) {
          skippedOutsideOrDenied.push({
            path: rel,
            reason: linkCheck.reason ?? "Symlink/junction skipped for safety",
          });
          continue;
        }

        const access = this.safetyGate.checkPath(absolute);
        const kind = mapStatusCode(raw.code);
        const base = basenameOf(rel);
        const sensitive = isSensitiveFileName(base);
        const denied = !access.allowed && !isLockFileName(base);

        // Still report the name for review, but mark skipped and never attach content.
        const riskFlags = riskForPath(rel, kind);
        const stat = stats.get(normalizeRelPath(rel));

        files.push({
          path: rel,
          previousPath: raw.previousPath,
          kind,
          insertions: sensitive || denied ? null : (stat?.insertions ?? null),
          deletions: sensitive || denied ? null : (stat?.deletions ?? null),
          riskFlags,
          skippedBySafety: Boolean(sensitive || denied),
          skipReason: sensitive
            ? "Secret-like filename — name listed only; contents not read"
            : denied
              ? access.denyReason ?? "Blocked by Safety Gate"
              : null,
        });
      }

      for (const f of files) {
        const match = rawEntries.find(
          (e) => normalizeRelPath(e.path) === f.path || normalizeRelPath(e.path) === f.previousPath,
        );
        if (match?.code.trim() === "??") {
          f.kind = "untracked";
        }
      }

      const finalUntracked = files.filter((f) => f.kind === "untracked").length;
      const finalAdded = files.filter((f) => f.kind === "added").length;
      const finalModified = files.filter((f) => f.kind === "modified").length;
      const finalDeleted = files.filter((f) => f.kind === "deleted").length;
      const finalRenamed = files.filter((f) => f.kind === "renamed").length;
      const finalOther = files.filter((f) => f.kind === "other").length;

      const globalRiskFlags: ChangedFileRiskFlag[] = [];
      const riskyFiles = files.filter((f) => f.riskFlags.length > 0);
      if (files.length >= MANY_FILES_THRESHOLD) {
        globalRiskFlags.push({
          id: "many-files",
          label: "Many files changed",
          plainEnglish: `${files.length} files changed — review in smaller chunks if possible.`,
        });
      }
      if (finalDeleted > 0) {
        globalRiskFlags.push({
          id: "has-deletes",
          label: "Deleted files present",
          plainEnglish: `${finalDeleted} deleted file(s) detected. Confirm deletions were intentional.`,
        });
      }
      if (riskyFiles.length > 0) {
        globalRiskFlags.push({
          id: "risky-files",
          label: "Risky files touched",
          plainEnglish: `${riskyFiles.length} changed file(s) have risk flags (config, secrets, safety, Electron, etc.).`,
        });
      }

      const truncated = files.length > MAX_DISPLAY_FILES;
      const displayed = truncated ? files.slice(0, MAX_DISPLAY_FILES) : files;
      const truncationNote = truncated
        ? `Showing first ${MAX_DISPLAY_FILES} of ${files.length} changed files.`
        : null;
      const manyFilesWarning =
        files.length >= MANY_FILES_THRESHOLD
          ? `Large change set (${files.length} files). Prefer reviewing high-risk files first.`
          : null;

      const result: ChangedFilesScanResult = {
        scannedAt: new Date().toISOString(),
        projectPath: root,
        isGitRepo: true,
        gitAvailable: true,
        statusMessage:
          files.length === 0
            ? "No changed files detected (working tree clean)."
            : `Found ${files.length} changed file(s) via read-only Git status.`,
        errorMessage: null,
        branchName,
        totalCount: files.length,
        modifiedCount: finalModified,
        addedCount: finalAdded,
        deletedCount: finalDeleted,
        renamedCount: finalRenamed,
        untrackedCount: finalUntracked,
        otherCount: finalOther,
        riskyCount: riskyFiles.length,
        truncated,
        truncationNote,
        manyFilesWarning,
        globalRiskFlags,
        files: displayed,
        skippedOutsideOrDenied,
      };

      this.safetyGate.log(
        "success",
        "Changed-files scan succeeded",
        `${result.totalCount} file(s); ${result.riskyCount} with risk flags.`,
      );
      if (result.riskyCount > 0) {
        this.safetyGate.log(
          "warning",
          "Risk flags detected",
          result.globalRiskFlags.map((f) => f.plainEnglish).join(" "),
        );
      }
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Changed-file scan failed for an unknown reason.";
      const result = emptyResult(root, {
        gitAvailable: true,
        isGitRepo: true,
        statusMessage: "Changed-file scan failed.",
        errorMessage: message,
      });
      this.safetyGate.log("warning", "Changed-files scan failed", message);
      return result;
    }
  }
}
