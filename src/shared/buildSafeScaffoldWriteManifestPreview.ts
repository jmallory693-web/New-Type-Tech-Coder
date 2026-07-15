/**
 * Stage 125: deterministic Safe Scaffold write-manifest preview builder.
 * In-memory future-write plan only. No AI. No source reads. No writes. No commands.
 */

import {
  labelForBlueprintProjectType,
  type BlueprintProjectType,
} from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";
import { fingerprintFileTreePreview } from "./buildModeFileContentPreview";
import {
  SAFE_SCAFFOLD_WRITE_MANIFEST_CAUTION_WARNING,
  SAFE_SCAFFOLD_WRITE_MANIFEST_PREVIEW_ONLY,
  SAFE_SCAFFOLD_WRITE_MANIFEST_REQUIRED_CONFIRMATION,
  fingerprintFileContentPreview,
  type SafeScaffoldWriteManifestNotReadyEntry,
  type SafeScaffoldWriteManifestPreviewRecord,
  type SafeScaffoldWriteManifestReadyEntry,
} from "./buildModeWriteManifestPreview";
import { validateProposedRelativePath } from "./buildModeFileTreePreview";

export type BuildSafeScaffoldWriteManifestPreviewInput = {
  blueprintImported: boolean;
  blueprintProjectType: BlueprintProjectType | string;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  targetFolderPath: string;
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  fileTreeGeneratedAt: string;
  proposedRelativePaths: string[];
  fileContentGeneratedAt: string;
  templatedFiles: Array<{ relativePath: string; content: string }>;
  filesWithoutContents: string[];
};

function normalizeRel(p: string): string {
  return p.trim().replace(/\\/g, "/");
}

function isDirectoryPath(p: string): boolean {
  return p.endsWith("/");
}

function contentLooksUnsafe(content: string): string | null {
  const lower = content.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\.env\b/, "Generated content references .env."],
    [/begin (rsa|openssh) private key/, "Generated content looks like a private key."],
    [/api[_-]?key\s*[:=]\s*['\"]?[a-z0-9_\-]{16,}/i, "Generated content looks like an API key."],
    [/password\s*[:=]\s*['\"][^'\"]{4,}/i, "Generated content looks like a password."],
    [/token\s*[:=]\s*['\"][a-z0-9_\-\.]{16,}/i, "Generated content looks like a token."],
    [/postinstall/, "Generated content includes postinstall."],
    [/preinstall/, "Generated content includes preinstall."],
    [/curl[^\n]*\|\s*bash/, "Generated content includes curl|bash."],
    [/\beval\s*\(/, "Generated content includes eval("],
    [/rm\s+-rf\s+\//, "Generated content includes dangerous deletion."],
  ];
  for (const [re, reason] of patterns) {
    if (re.test(lower) || re.test(content)) return reason;
  }
  return null;
}

export function evaluateWriteManifestPreviewPreconditions(input: {
  blueprintImported: boolean;
  taskCardCount: number;
  targetFolderPath: string | null;
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus | null;
  targetStale: boolean;
  targetBusy: boolean;
  fileTreeExists: boolean;
  fileTreeStale: boolean;
  fileContentExists: boolean;
  fileContentStale: boolean;
  proposedRelativePaths: string[];
  templatedFiles: Array<{ relativePath: string; content: string }>;
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
  if (!input.fileTreeExists) {
    reasons.push("Generate a Safe Scaffold File Tree Preview first.");
  }
  if (input.fileTreeStale) {
    reasons.push("File Tree Preview is stale — regenerate it first.");
  }
  if (!input.fileContentExists) {
    reasons.push("Generate a Safe Scaffold File Content Preview first.");
  }
  if (input.fileContentStale) {
    reasons.push("File Content Preview is stale — regenerate it first.");
  }
  if (
    input.fileTreeExists &&
    !input.fileTreeStale &&
    input.proposedRelativePaths.length === 0
  ) {
    reasons.push("File Tree Preview has no proposed paths.");
  }

  const pathErrors: string[] = [];
  for (const p of input.proposedRelativePaths) {
    const err = validateProposedRelativePath(p);
    if (err) pathErrors.push(err);
  }
  if (pathErrors.length > 0) {
    reasons.push(
      `File Tree Preview paths failed safety validation (${pathErrors.length}).`,
    );
  }

  const contentErrors: string[] = [];
  for (const f of input.templatedFiles) {
    const unsafe = contentLooksUnsafe(f.content);
    if (unsafe) contentErrors.push(`${f.relativePath}: ${unsafe}`);
  }
  if (contentErrors.length > 0) {
    reasons.push(
      `File Content Preview failed content safety validation (${contentErrors.length}).`,
    );
  }

  const hardBlocked =
    input.targetSafetyStatus === "blocked" ||
    pathErrors.length > 0 ||
    contentErrors.length > 0;

  const canGenerate =
    input.blueprintImported &&
    input.taskCardCount > 0 &&
    Boolean(input.targetFolderPath) &&
    !input.targetStale &&
    !input.targetBusy &&
    (input.targetSafetyStatus === "safe" ||
      input.targetSafetyStatus === "caution") &&
    input.fileTreeExists &&
    !input.fileTreeStale &&
    input.fileContentExists &&
    !input.fileContentStale &&
    pathErrors.length === 0 &&
    contentErrors.length === 0 &&
    input.proposedRelativePaths.length > 0;

  return { canGenerate, hardBlocked, reasons: canGenerate ? [] : reasons };
}

export function buildSafeScaffoldWriteManifestPreview(
  input: BuildSafeScaffoldWriteManifestPreviewInput,
): {
  record: SafeScaffoldWriteManifestPreviewRecord | null;
  blockedReasons: string[];
} {
  const pre = evaluateWriteManifestPreviewPreconditions({
    blueprintImported: input.blueprintImported,
    taskCardCount: input.taskCardCount,
    targetFolderPath: input.targetFolderPath,
    targetSafetyStatus: input.targetSafetyStatus,
    targetStale: false,
    targetBusy: false,
    fileTreeExists: true,
    fileTreeStale: false,
    fileContentExists: true,
    fileContentStale: false,
    proposedRelativePaths: input.proposedRelativePaths,
    templatedFiles: input.templatedFiles,
  });
  if (!pre.canGenerate) {
    return { record: null, blockedReasons: pre.reasons };
  }

  const warnings: string[] = [];
  if (input.targetSafetyStatus === "caution") {
    warnings.push(SAFE_SCAFFOLD_WRITE_MANIFEST_CAUTION_WARNING);
  }

  const projectType = String(input.blueprintProjectType || "unknown");
  const projectTypeLabel =
    labelForBlueprintProjectType(projectType as BlueprintProjectType) ||
    projectType;

  const proposedRelativePaths = input.proposedRelativePaths.map(normalizeRel);
  const templatedByPath = new Map(
    input.templatedFiles.map((f) => [normalizeRel(f.relativePath), f]),
  );
  const withoutSet = new Set(
    input.filesWithoutContents.map((p) => normalizeRel(p)),
  );

  const readyToCreate: SafeScaffoldWriteManifestReadyEntry[] = [];
  const notReady: SafeScaffoldWriteManifestNotReadyEntry[] = [];

  for (const rel of proposedRelativePaths) {
    const pathErr = validateProposedRelativePath(rel);
    if (pathErr) {
      notReady.push({
        relativePath: rel,
        reason: pathErr,
        pathStatus: "blocked-path",
      });
      continue;
    }
    if (isDirectoryPath(rel)) {
      notReady.push({
        relativePath: rel,
        reason: "Directory path only — no file body to write in this stage.",
        pathStatus: "directory-only",
      });
      continue;
    }
    const entry = templatedByPath.get(rel);
    if (!entry) {
      // Prefer exact match; also try case-insensitive for README-style paths.
      const lower = rel.toLowerCase();
      const alt = [...templatedByPath.entries()].find(
        ([k]) => k.toLowerCase() === lower,
      );
      if (!alt) {
        notReady.push({
          relativePath: rel,
          reason: withoutSet.has(rel)
            ? "No content template yet for this path."
            : "Path was proposed but has no generated content template.",
          pathStatus: "missing-content",
        });
        continue;
      }
      const unsafe = contentLooksUnsafe(alt[1].content);
      if (unsafe) {
        notReady.push({
          relativePath: rel,
          reason: unsafe,
          pathStatus: "blocked-content",
        });
        continue;
      }
      readyToCreate.push({
        relativePath: rel,
        contentStatus: "templated",
        safety: "passed",
        pathStatus: "ready-to-create",
      });
      continue;
    }
    const unsafe = contentLooksUnsafe(entry.content);
    if (unsafe) {
      notReady.push({
        relativePath: rel,
        reason: unsafe,
        pathStatus: "blocked-content",
      });
      continue;
    }
    readyToCreate.push({
      relativePath: rel,
      contentStatus: "templated",
      safety: "passed",
      pathStatus: "ready-to-create",
    });
  }

  // Catch template paths that somehow exist only on the content side.
  for (const [rel] of templatedByPath) {
    if (proposedRelativePaths.includes(rel)) continue;
    const pathErr = validateProposedRelativePath(rel);
    if (pathErr) {
      notReady.push({
        relativePath: rel,
        reason: pathErr,
        pathStatus: "blocked-path",
      });
      continue;
    }
    notReady.push({
      relativePath: rel,
      reason:
        "Templated path is not present in the current File Tree Preview — deferred.",
      pathStatus: "later-stage",
    });
  }

  if (readyToCreate.length === 0 && notReady.length === 0) {
    return {
      record: null,
      blockedReasons: ["No proposed paths were available to classify."],
    };
  }

  const generatedAt = new Date().toISOString();
  const treeFingerprint = fingerprintFileTreePreview({
    generatedAt: input.fileTreeGeneratedAt,
    proposedRelativePaths,
  });
  const contentFingerprint = fingerprintFileContentPreview({
    generatedAt: input.fileContentGeneratedAt,
    proposedRelativePaths,
    templatedRelativePaths: input.templatedFiles.map((f) => f.relativePath),
    filesWithoutContents: input.filesWithoutContents,
  });

  const createdRows =
    readyToCreate.length > 0
      ? readyToCreate
          .map(
            (e) =>
              `| \`${e.relativePath}\` | ${e.contentStatus} | ${e.safety} |`,
          )
          .join("\n")
      : "| (none) | — | — |";

  const notReadyRows =
    notReady.length > 0
      ? notReady
          .map((e) => `| \`${e.relativePath}\` | ${e.reason} |`)
          .join("\n")
      : "| (none) | — |";

  const markdown = [
    "# NTTC Safe Scaffold Write Manifest Preview",
    "",
    "## Status",
    SAFE_SCAFFOLD_WRITE_MANIFEST_PREVIEW_ONLY,
    "",
    "## Source Inputs",
    `- Blueprint status: ${input.blueprintImported ? "imported" : "missing"}`,
    `- Blueprint project type: ${projectTypeLabel} (\`${projectType}\`)`,
    `- Task cards: ${input.taskCardCount}`,
    `- Target folder: ${input.targetFolderPath}`,
    `- Target folder safety: ${input.targetSafetyStatus}`,
    `- File tree preview: ${input.fileTreeGeneratedAt}`,
    `- File content preview: ${input.fileContentGeneratedAt}`,
    "",
    "## Future Write Plan",
    "NTTC would create new files only in the selected target folder.",
    "NTTC would not overwrite existing files.",
    "NTTC would not edit existing files.",
    "NTTC would not run commands.",
    "NTTC would not install packages.",
    "NTTC would not apply patches.",
    "",
    "## Files That Would Be Created",
    "| Relative Path | Content Status | Safety |",
    "|---|---|---|",
    createdRows,
    "",
    "## Files Not Ready For Write",
    "| Relative Path | Reason |",
    "|---|---|",
    notReadyRows,
    "",
    "## Required Final Confirmation",
    "Before any future write stage, the user must explicitly confirm:",
    SAFE_SCAFFOLD_WRITE_MANIFEST_REQUIRED_CONFIRMATION,
    "",
    "## Rollback Note",
    "Because Stage 125 does not write files, no rollback is needed yet.",
    "In a future write stage, NTTC should generate a written-files manifest so the user can manually review/delete created files if needed.",
    "",
    "## Safety Boundaries",
    "- This manifest is deterministic metadata only.",
    "- No existing project source files were read.",
    "- No files are created, edited, or overwritten in this stage.",
    "- No commands, package installs, or patches are executed.",
    "- Future write confirmation is not enabled yet.",
    ...(warnings.length > 0
      ? ["", "### Warnings", ...warnings.map((w) => `- ${w}`)]
      : []),
    "",
    "## Next Step",
    "Review this write manifest, then record Safe Scaffold Final Confirmation (still no file writes).",
    "",
  ].join("\n");

  const record: SafeScaffoldWriteManifestPreviewRecord = {
    generatedAt,
    sourceBlueprintImported: true,
    sourceBlueprintProjectType: projectType,
    sourceTaskCardCount: input.taskCardCount,
    sourceTaskCardsGeneratedAt: input.taskCardsGeneratedAt,
    sourceTargetFolderPath: input.targetFolderPath,
    sourceTargetSafetyStatus: input.targetSafetyStatus,
    sourceFileTreeGeneratedAt: input.fileTreeGeneratedAt,
    sourceFileTreeFingerprint: treeFingerprint,
    sourceFileContentGeneratedAt: input.fileContentGeneratedAt,
    sourceFileContentFingerprint: contentFingerprint,
    proposedRelativePaths,
    readyToCreate,
    notReady,
    markdown,
    warnings,
    blockedReasons: [],
    stale: false,
  };

  return { record, blockedReasons: [] };
}
