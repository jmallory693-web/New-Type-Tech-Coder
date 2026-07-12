import fs from "node:fs";
import path from "node:path";
import {
  CODE_CONTEXT_BINARY_PROBE_BYTES,
  CODE_CONTEXT_MAX_FILE_BYTES,
  CODE_CONTEXT_MAX_LISTED_FILES,
  CODE_CONTEXT_SECRET_PATTERNS,
  isCodeContextAllowedExtension,
  isCodeContextBlockedExtension,
  isCodeContextDenyDirectory,
} from "../../shared/codeContextConstants";
import type { CodeContextBlockedEntry } from "../../shared/types";
import { inspectLinkSafety } from "../safety/linkSafety";
import type { SafetyGate } from "../safety/SafetyGate";

export interface SafeFileListResult {
  candidates: Array<{
    relativePath: string;
    extension: string;
    sizeBytes: number;
  }>;
  blocked: CodeContextBlockedEntry[];
  blockedCount: number;
  listedCount: number;
  truncatedListing: boolean;
}

function relativePosix(root: string, absolute: string): string {
  return path.relative(root, absolute).replace(/\\/g, "/");
}

function hasSecretPattern(text: string): string | null {
  for (const pattern of CODE_CONTEXT_SECRET_PATTERNS) {
    if (pattern.test(text)) {
      return pattern.source;
    }
  }
  return null;
}

function looksBinary(buffer: Buffer): boolean {
  const probe = buffer.subarray(0, Math.min(buffer.length, CODE_CONTEXT_BINARY_PROBE_BYTES));
  return probe.includes(0);
}

export function assessCodeContextPath(
  safetyGate: SafetyGate,
  projectRoot: string,
  absolutePath: string,
): { allowed: boolean; reason: string | null; relativePath: string } {
  const relativePath = relativePosix(projectRoot, absolutePath);
  const normalized = safetyGate.normalizePath(absolutePath);

  if (!safetyGate.isInsideProjectRoot(normalized)) {
    safetyGate.log(
      "blocked",
      "Code context file blocked",
      `Outside project root: ${relativePath}`,
    );
    return {
      allowed: false,
      reason: "Outside project root",
      relativePath,
    };
  }

  const gate = safetyGate.checkPath(normalized, { quiet: true });
  if (!gate.allowed) {
    return {
      allowed: false,
      reason: gate.denyReason ?? "Blocked by Safety Gate",
      relativePath,
    };
  }

  const linkCheck = inspectLinkSafety(normalized);
  if (!linkCheck.safe) {
    safetyGate.log(
      "blocked",
      "Code context file blocked",
      linkCheck.reason ?? `Unsafe link: ${relativePath}`,
    );
    return {
      allowed: false,
      reason: linkCheck.reason ?? "Symlink/junction refused",
      relativePath,
    };
  }

  const segments = relativePath.split("/").filter(Boolean);
  for (const segment of segments.slice(0, -1)) {
    if (isCodeContextDenyDirectory(segment)) {
      return {
        allowed: false,
        reason: `Blocked directory: ${segment}`,
        relativePath,
      };
    }
  }

  const ext = path.extname(relativePath).toLowerCase();
  if (isCodeContextBlockedExtension(ext)) {
    return {
      allowed: false,
      reason: `Blocked extension: ${ext || "(none)"}`,
      relativePath,
    };
  }
  if (!isCodeContextAllowedExtension(ext)) {
    return {
      allowed: false,
      reason: `Extension not allowed for code context: ${ext || "(none)"}`,
      relativePath,
    };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not stat file";
    return { allowed: false, reason: message, relativePath };
  }

  if (!stat.isFile()) {
    return { allowed: false, reason: "Not a regular file", relativePath };
  }

  if (stat.size > CODE_CONTEXT_MAX_FILE_BYTES) {
    return {
      allowed: false,
      reason: `Too large (>${CODE_CONTEXT_MAX_FILE_BYTES} bytes)`,
      relativePath,
    };
  }

  return { allowed: true, reason: null, relativePath };
}

export interface ReadExcerptResult {
  ok: boolean;
  content: string;
  linesIncluded: number;
  truncated: boolean;
  warnings: string[];
  blockReason: string | null;
}

export function readCodeContextExcerpt(
  safetyGate: SafetyGate,
  projectRoot: string,
  relativePath: string,
  maxLines: number,
): ReadExcerptResult {
  const absolutePath = path.join(projectRoot, relativePath);
  const assessment = assessCodeContextPath(safetyGate, projectRoot, absolutePath);
  if (!assessment.allowed) {
    return {
      ok: false,
      content: "",
      linesIncluded: 0,
      truncated: false,
      warnings: [],
      blockReason: assessment.reason,
    };
  }

  let raw: Buffer;
  try {
    raw = fs.readFileSync(absolutePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read file";
    return {
      ok: false,
      content: "",
      linesIncluded: 0,
      truncated: false,
      warnings: [],
      blockReason: message,
    };
  }

  if (looksBinary(raw)) {
    safetyGate.log(
      "blocked",
      "Code context file blocked",
      `Binary-looking file: ${relativePath}`,
    );
    return {
      ok: false,
      content: "",
      linesIncluded: 0,
      truncated: false,
      warnings: [],
      blockReason: "Binary-looking file",
    };
  }

  const text = raw.toString("utf8");
  const secretHit = hasSecretPattern(text);
  if (secretHit) {
    safetyGate.log(
      "blocked",
      "Code context file blocked",
      `Possible secret pattern in ${relativePath}`,
    );
    return {
      ok: false,
      content: "",
      linesIncluded: 0,
      truncated: false,
      warnings: [`Possible secret pattern (${secretHit})`],
      blockReason: "Possible secret pattern detected",
    };
  }

  const lines = text.split(/\r?\n/);
  const truncated = lines.length > maxLines;
  const included = truncated ? lines.slice(0, maxLines) : lines;
  let content = included.join("\n");
  if (truncated) {
    content += `\n\nTRUNCATED: first ${maxLines} lines only`;
  }

  return {
    ok: true,
    content,
    linesIncluded: included.length,
    truncated,
    warnings: truncated ? [`First ${maxLines} lines only`] : [],
    blockReason: null,
  };
}

export function listSafeCodeContextFiles(
  safetyGate: SafetyGate,
  projectRoot: string,
): SafeFileListResult {
  const candidates: SafeFileListResult["candidates"] = [];
  const blocked: CodeContextBlockedEntry[] = [];
  let blockedCount = 0;
  let truncatedListing = false;

  safetyGate.log("info", "Code context file list refresh started", projectRoot);

  const queue: string[] = [projectRoot];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        blockedCount += 1;
        if (blocked.length < 30) {
          blocked.push({
            relativePath: relativePosix(projectRoot, absolute),
            reason: "Symlink/junction refused",
          });
        }
        continue;
      }

      const linkCheck = inspectLinkSafety(absolute);
      if (!linkCheck.safe) {
        blockedCount += 1;
        if (blocked.length < 30) {
          blocked.push({
            relativePath: relativePosix(projectRoot, absolute),
            reason: linkCheck.reason ?? "Symlink/junction refused",
          });
        }
        continue;
      }

      if (entry.isDirectory()) {
        if (isCodeContextDenyDirectory(entry.name)) {
          blockedCount += 1;
          continue;
        }
        const listGate = safetyGate.checkScanAccess(absolute, "list");
        if (!listGate.allowed) {
          blockedCount += 1;
          continue;
        }
        queue.push(absolute);
        continue;
      }

      if (!entry.isFile()) continue;

      const assessment = assessCodeContextPath(safetyGate, projectRoot, absolute);
      if (!assessment.allowed) {
        blockedCount += 1;
        if (blocked.length < 30) {
          blocked.push({
            relativePath: assessment.relativePath,
            reason: assessment.reason ?? "Blocked",
          });
        }
        continue;
      }

      let sizeBytes = 0;
      try {
        sizeBytes = fs.statSync(absolute).size;
      } catch {
        blockedCount += 1;
        continue;
      }

      if (candidates.length >= CODE_CONTEXT_MAX_LISTED_FILES) {
        truncatedListing = true;
        continue;
      }

      candidates.push({
        relativePath: assessment.relativePath,
        extension: path.extname(assessment.relativePath).toLowerCase(),
        sizeBytes,
      });
    }
  }

  safetyGate.log(
    "success",
    "Code context file list refresh succeeded",
    `${candidates.length} candidates; ${blockedCount} blocked/skipped.`,
  );

  return {
    candidates,
    blocked,
    blockedCount,
    listedCount: candidates.length,
    truncatedListing,
  };
}
