import fs from "node:fs";
import path from "node:path";

export type UnsafeLinkKind = "symlink" | "junction-or-reparse";

export interface LinkSafetyResult {
  safe: boolean;
  kind: UnsafeLinkKind | null;
  reason: string | null;
}

function normalizeCompare(p: string): string {
  return path.resolve(p).replace(/\//g, "\\").toLowerCase();
}

/**
 * Stage 11B: Refuse symlinks and Windows junctions/reparse points.
 * Uses lstat (does not follow). Never reads through the link.
 */
export function inspectLinkSafety(absolutePath: string): LinkSafetyResult {
  let lstat: fs.Stats;
  try {
    lstat = fs.lstatSync(absolutePath);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : "";
    if (code === "ENOENT") {
      // Path does not exist yet — safe to create (not a symlink/junction).
      return { safe: true, kind: null, reason: null };
    }
    const message =
      error instanceof Error ? error.message : "Could not inspect path";
    return {
      safe: false,
      kind: null,
      reason: `Skipped (could not inspect link safety): ${message}`,
    };
  }

  if (lstat.isSymbolicLink()) {
    return {
      safe: false,
      kind: "symlink",
      reason: "Skipped symlink for safety (not followed, not read)",
    };
  }

  // Windows junctions / mount points often appear as directories, not symlinks.
  if (process.platform === "win32" && lstat.isDirectory()) {
    try {
      const resolved = normalizeCompare(absolutePath);
      const real = normalizeCompare(fs.realpathSync.native(absolutePath));
      if (resolved !== real) {
        return {
          safe: false,
          kind: "junction-or-reparse",
          reason:
            "Skipped junction/reparse point for safety (not followed, not copied)",
        };
      }
    } catch {
      // If realpath fails on a directory, refuse rather than follow blindly.
      return {
        safe: false,
        kind: "junction-or-reparse",
        reason:
          "Skipped possible junction/reparse point for safety (realpath failed)",
      };
    }
  }

  return { safe: true, kind: null, reason: null };
}

export function isDirentSymbolicLink(dirent: fs.Dirent): boolean {
  return dirent.isSymbolicLink();
}
