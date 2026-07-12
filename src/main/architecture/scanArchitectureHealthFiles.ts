import fs from "node:fs";
import path from "node:path";
import {
  CODE_CONTEXT_BINARY_PROBE_BYTES,
} from "../../shared/codeContextConstants";
import {
  ARCHITECTURE_HEALTH_MAX_FILE_BYTES,
  ARCHITECTURE_HEALTH_MAX_FILES,
} from "../../shared/architectureHealth/architectureHealthConstants";
import {
  enrichArchitectureHealthFile,
  type ArchitectureHealthFileEntry,
} from "../../shared/architectureHealth/buildArchitectureHealthReport";
import {
  isArchitectureHealthDenyDirectory,
  isMarkdownDocPath,
  isTestFilePath,
} from "../../shared/architectureHealth/architectureHealthHelpers";
import { assessArchitectureHealthPath } from "./assessArchitectureHealthPath";
import { inspectLinkSafety } from "../safety/linkSafety";
import type { SafetyGate } from "../safety/SafetyGate";

export interface ScanArchitectureHealthOptions {
  includeTestFiles: boolean;
  includeMarkdownDocs: boolean;
}

export interface ScanArchitectureHealthResult {
  files: ArchitectureHealthFileEntry[];
  fileCountScanned: number;
  filesTruncated: boolean;
  blockedCount: number;
}

function looksBinary(buffer: Buffer): boolean {
  const probe = buffer.subarray(0, Math.min(buffer.length, CODE_CONTEXT_BINARY_PROBE_BYTES));
  return probe.includes(0);
}

function countLinesAndChars(buffer: Buffer): { lineCount: number; charCount: number } {
  const text = buffer.toString("utf8");
  const lineCount = text.length === 0 ? 0 : text.split(/\r?\n/).length;
  return { lineCount, charCount: text.length };
}

function shouldIncludeFile(
  relativePath: string,
  options: ScanArchitectureHealthOptions,
): boolean {
  if (!options.includeTestFiles && isTestFilePath(relativePath)) {
    return false;
  }
  if (!options.includeMarkdownDocs && isMarkdownDocPath(relativePath)) {
    return false;
  }
  return true;
}

/** Stage 98: safe metadata scan — line/char counts only; content not stored. */
export function scanArchitectureHealthFiles(
  safetyGate: SafetyGate,
  projectRoot: string,
  options: ScanArchitectureHealthOptions,
): ScanArchitectureHealthResult {
  const files: ArchitectureHealthFileEntry[] = [];
  let blockedCount = 0;
  let filesTruncated = false;

  safetyGate.log(
    "info",
    "Architecture health scan started",
    projectRoot,
  );

  const queue: string[] = [projectRoot];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      blockedCount += 1;
      continue;
    }

    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        blockedCount += 1;
        continue;
      }

      const linkCheck = inspectLinkSafety(absolute);
      if (!linkCheck.safe) {
        blockedCount += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (isArchitectureHealthDenyDirectory(entry.name)) {
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

      const assessment = assessArchitectureHealthPath(
        safetyGate,
        projectRoot,
        absolute,
      );
      if (!assessment.allowed) {
        blockedCount += 1;
        continue;
      }

      if (!shouldIncludeFile(assessment.relativePath, options)) {
        continue;
      }

      if (files.length >= ARCHITECTURE_HEALTH_MAX_FILES) {
        filesTruncated = true;
        continue;
      }

      let buffer: Buffer;
      try {
        const stat = fs.statSync(absolute);
        if (!stat.isFile() || stat.size > ARCHITECTURE_HEALTH_MAX_FILE_BYTES) {
          blockedCount += 1;
          continue;
        }
        buffer = fs.readFileSync(absolute);
      } catch {
        blockedCount += 1;
        continue;
      }

      if (looksBinary(buffer)) {
        blockedCount += 1;
        continue;
      }

      const { lineCount, charCount } = countLinesAndChars(buffer);
      files.push(
        enrichArchitectureHealthFile({
          relativePath: assessment.relativePath,
          extension: path.extname(assessment.relativePath).toLowerCase(),
          lineCount,
          charCount,
        }),
      );
    }
  }

  safetyGate.log(
    "success",
    "Architecture health scan completed",
    `${files.length} files; ${blockedCount} blocked/skipped.`,
  );

  return {
    files,
    fileCountScanned: files.length,
    filesTruncated,
    blockedCount,
  };
}
