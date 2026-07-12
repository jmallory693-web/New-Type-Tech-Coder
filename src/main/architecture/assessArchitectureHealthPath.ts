import fs from "node:fs";
import path from "node:path";
import {
  isCodeContextAllowedExtension,
  isCodeContextBlockedExtension,
} from "../../shared/codeContextConstants";
import {
  ARCHITECTURE_HEALTH_MAX_FILE_BYTES,
} from "../../shared/architectureHealth/architectureHealthConstants";
import { isArchitectureHealthDenyDirectory } from "../../shared/architectureHealth/architectureHealthHelpers";
import { inspectLinkSafety } from "../safety/linkSafety";
import type { SafetyGate } from "../safety/SafetyGate";

function relativePosix(root: string, absolute: string): string {
  return path.relative(root, absolute).replace(/\\/g, "/");
}

/** Stage 100: path assessment for Architecture Health (separate byte cap + deny dirs). */
export function assessArchitectureHealthPath(
  safetyGate: SafetyGate,
  projectRoot: string,
  absolutePath: string,
): { allowed: boolean; reason: string | null; relativePath: string } {
  const relativePath = relativePosix(projectRoot, absolutePath);
  const normalized = safetyGate.normalizePath(absolutePath);

  if (!safetyGate.isInsideProjectRoot(normalized)) {
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
    return {
      allowed: false,
      reason: linkCheck.reason ?? "Symlink/junction refused",
      relativePath,
    };
  }

  const segments = relativePath.split("/").filter(Boolean);
  for (const segment of segments.slice(0, -1)) {
    if (isArchitectureHealthDenyDirectory(segment)) {
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
      reason: `Extension not allowed: ${ext || "(none)"}`,
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

  if (stat.size > ARCHITECTURE_HEALTH_MAX_FILE_BYTES) {
    return {
      allowed: false,
      reason: `Too large (>${ARCHITECTURE_HEALTH_MAX_FILE_BYTES} bytes)`,
      relativePath,
    };
  }

  return { allowed: true, reason: null, relativePath };
}
