/**
 * Stage 127: deterministic Safe Scaffold Final Confirmation builder.
 * Metadata/readiness only. No AI. No source reads. No writes. No commands.
 */

import {
  labelForBlueprintProjectType,
  type BlueprintProjectType,
} from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";
import { fingerprintFileTreePreview } from "./buildModeFileContentPreview";
import { fingerprintFileContentPreview } from "./buildModeWriteManifestPreview";
import type {
  SafeScaffoldWriteManifestNotReadyEntry,
  SafeScaffoldWriteManifestReadyEntry,
} from "./buildModeWriteManifestPreview";
import {
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_BOUNDARIES,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_CAUTION,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_STAGE127,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_RECORDED,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_STILL_DISABLED,
  fingerprintWriteManifestPreview,
  type SafeScaffoldFinalConfirmationAcknowledgements,
  type SafeScaffoldFinalConfirmationRecord,
} from "./buildModeFinalConfirmation";
import { SAFE_SCAFFOLD_WRITE_MANIFEST_CAUTION_WARNING } from "./buildModeWriteManifestPreview";

export type BuildSafeScaffoldFinalConfirmationInput = {
  blueprintImported: boolean;
  blueprintProjectType: BlueprintProjectType | string;
  taskCardCount: number;
  targetFolderPath: string;
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  fileTreeGeneratedAt: string;
  proposedRelativePaths: string[];
  fileContentGeneratedAt: string;
  templatedRelativePaths: string[];
  filesWithoutContents: string[];
  writeManifestGeneratedAt: string;
  readyToCreate: SafeScaffoldWriteManifestReadyEntry[];
  notReady: SafeScaffoldWriteManifestNotReadyEntry[];
  acknowledgements: SafeScaffoldFinalConfirmationAcknowledgements;
};

export function evaluateFinalConfirmationPreconditions(input: {
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
  writeManifestExists: boolean;
  writeManifestStale: boolean;
  proposedRelativePaths: string[];
  readyToCreate: SafeScaffoldWriteManifestReadyEntry[];
  notReady: SafeScaffoldWriteManifestNotReadyEntry[];
}): { canConfirm: boolean; hardBlocked: boolean; reasons: string[] } {
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
  if (!input.writeManifestExists) {
    reasons.push("Generate a Safe Scaffold Write Manifest Preview first.");
  }
  if (input.writeManifestStale) {
    reasons.push("Write Manifest Preview is stale — regenerate it first.");
  }

  const proposed = new Set(
    input.proposedRelativePaths.map((p) => p.replace(/\\/g, "/")),
  );
  const classified = new Set([
    ...input.readyToCreate.map((e) => e.relativePath.replace(/\\/g, "/")),
    ...input.notReady.map((e) => e.relativePath.replace(/\\/g, "/")),
  ]);
  const unclassified = [...proposed].filter((p) => !classified.has(p));
  if (
    input.writeManifestExists &&
    !input.writeManifestStale &&
    unclassified.length > 0
  ) {
    reasons.push(
      `Write Manifest Preview has unclassified paths (${unclassified.length}).`,
    );
  }

  const blockedPath = input.notReady.filter((e) => e.pathStatus === "blocked-path");
  const blockedContent = input.notReady.filter(
    (e) => e.pathStatus === "blocked-content",
  );
  if (blockedPath.length > 0) {
    reasons.push(
      `Write Manifest Preview has blocked-path entries (${blockedPath.length}).`,
    );
  }
  if (blockedContent.length > 0) {
    reasons.push(
      `Write Manifest Preview has blocked-content entries (${blockedContent.length}).`,
    );
  }
  if (
    input.writeManifestExists &&
    !input.writeManifestStale &&
    input.readyToCreate.length === 0
  ) {
    reasons.push("Write Manifest Preview has no ready-to-create files.");
  }

  const hardBlocked =
    input.targetSafetyStatus === "blocked" ||
    blockedPath.length > 0 ||
    blockedContent.length > 0 ||
    unclassified.length > 0;

  const canConfirm =
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
    input.writeManifestExists &&
    !input.writeManifestStale &&
    unclassified.length === 0 &&
    blockedPath.length === 0 &&
    blockedContent.length === 0 &&
    input.readyToCreate.length > 0;

  return { canConfirm, hardBlocked, reasons: canConfirm ? [] : reasons };
}

export function acknowledgementsAreComplete(input: {
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  acknowledgements: SafeScaffoldFinalConfirmationAcknowledgements;
}): boolean {
  if (!input.acknowledgements.futureWriteBoundaries) return false;
  if (!input.acknowledgements.stage127NoWrite) return false;
  if (
    input.targetSafetyStatus === "caution" &&
    !input.acknowledgements.cautionTarget
  ) {
    return false;
  }
  return true;
}

export function buildSafeScaffoldFinalConfirmation(
  input: BuildSafeScaffoldFinalConfirmationInput,
): {
  record: SafeScaffoldFinalConfirmationRecord | null;
  blockedReasons: string[];
} {
  const pre = evaluateFinalConfirmationPreconditions({
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
    writeManifestExists: true,
    writeManifestStale: false,
    proposedRelativePaths: input.proposedRelativePaths,
    readyToCreate: input.readyToCreate,
    notReady: input.notReady,
  });
  if (!pre.canConfirm) {
    return { record: null, blockedReasons: pre.reasons };
  }

  if (
    !acknowledgementsAreComplete({
      targetSafetyStatus: input.targetSafetyStatus,
      acknowledgements: input.acknowledgements,
    })
  ) {
    const blockedReasons = [
      "Check all required acknowledgement boxes before recording final confirmation.",
    ];
    if (
      input.targetSafetyStatus === "caution" &&
      !input.acknowledgements.cautionTarget
    ) {
      blockedReasons.push(
        "Caution target requires the extra caution acknowledgement.",
      );
    }
    return { record: null, blockedReasons };
  }

  const warnings: string[] = [];
  if (input.targetSafetyStatus === "caution") {
    warnings.push(SAFE_SCAFFOLD_WRITE_MANIFEST_CAUTION_WARNING);
  }

  const projectType = String(input.blueprintProjectType || "unknown");
  const projectTypeLabel =
    labelForBlueprintProjectType(projectType as BlueprintProjectType) ||
    projectType;

  const readyPaths = input.readyToCreate.map((e) => e.relativePath);
  const notReadyPaths = input.notReady.map((e) => e.relativePath);

  const treeFingerprint = fingerprintFileTreePreview({
    generatedAt: input.fileTreeGeneratedAt,
    proposedRelativePaths: input.proposedRelativePaths,
  });
  const contentFingerprint = fingerprintFileContentPreview({
    generatedAt: input.fileContentGeneratedAt,
    proposedRelativePaths: input.proposedRelativePaths,
    templatedRelativePaths: input.templatedRelativePaths,
    filesWithoutContents: input.filesWithoutContents,
  });
  const manifestFingerprint = fingerprintWriteManifestPreview({
    generatedAt: input.writeManifestGeneratedAt,
    readyRelativePaths: readyPaths,
    notReadyRelativePaths: notReadyPaths,
  });

  const readyRows =
    readyPaths.length > 0
      ? readyPaths.map((p) => `- \`${p}\``).join("\n")
      : "- (none)";
  const notReadyRows =
    input.notReady.length > 0
      ? input.notReady
          .map((e) => `- \`${e.relativePath}\` — ${e.reason}`)
          .join("\n")
      : "- (none)";

  const markdown = [
    "# NTTC Safe Scaffold Final Confirmation Summary",
    "",
    "## Status",
    SAFE_SCAFFOLD_FINAL_CONFIRMATION_RECORDED,
    "",
    SAFE_SCAFFOLD_FINAL_CONFIRMATION_STILL_DISABLED,
    "",
    "## Target Folder",
    `- Path: ${input.targetFolderPath}`,
    `- Safety: ${input.targetSafetyStatus}`,
    `- Blueprint: ${input.blueprintImported ? "imported" : "missing"}`,
    `- Project type: ${projectTypeLabel} (\`${projectType}\`)`,
    `- Task cards: ${input.taskCardCount}`,
    "",
    "## Ready-To-Create Files",
    readyRows,
    "",
    "## Not-Ready Files",
    notReadyRows,
    "",
    "## Acknowledgements",
    `- Future write boundaries: ${input.acknowledgements.futureWriteBoundaries ? "yes" : "no"}`,
    `- Stage 127 no-write understanding: ${input.acknowledgements.stage127NoWrite ? "yes" : "no"}`,
    `- Caution acknowledgement: ${
      input.targetSafetyStatus === "caution"
        ? input.acknowledgements.cautionTarget
          ? "yes"
          : "no"
        : "not required (Safe target)"
    }`,
    "",
    "### Acknowledgement text recorded",
    `- ${SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_BOUNDARIES}`,
    `- ${SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_STAGE127}`,
    ...(input.targetSafetyStatus === "caution"
      ? [`- ${SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_CAUTION}`]
      : []),
    "",
    "## Safety Boundaries",
    "- NTTC will not overwrite existing files.",
    "- NTTC will not edit existing files.",
    "- NTTC will not run commands.",
    "- NTTC will not install packages.",
    "- NTTC will not apply patches.",
    "- NTTC will not call AI automatically.",
    ...(warnings.length > 0
      ? ["", "### Warnings", ...warnings.map((w) => `- ${w}`)]
      : []),
    "",
    "## Next Step",
    "A later stage may add the first actual scaffold write, guarded by this confirmation and a final immediate re-check.",
    "",
  ].join("\n");

  const record: SafeScaffoldFinalConfirmationRecord = {
    confirmedAt: new Date().toISOString(),
    sourceBlueprintImported: true,
    sourceBlueprintProjectType: projectType,
    sourceTaskCardCount: input.taskCardCount,
    sourceTargetFolderPath: input.targetFolderPath,
    sourceTargetSafetyStatus: input.targetSafetyStatus,
    sourceFileTreeGeneratedAt: input.fileTreeGeneratedAt,
    sourceFileTreeFingerprint: treeFingerprint,
    sourceFileContentGeneratedAt: input.fileContentGeneratedAt,
    sourceFileContentFingerprint: contentFingerprint,
    sourceWriteManifestGeneratedAt: input.writeManifestGeneratedAt,
    sourceWriteManifestFingerprint: manifestFingerprint,
    readyToCreateCount: input.readyToCreate.length,
    notReadyCount: input.notReady.length,
    acknowledgements: {
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget:
        input.targetSafetyStatus === "caution"
          ? Boolean(input.acknowledgements.cautionTarget)
          : false,
    },
    markdown,
    warnings,
    stale: false,
  };

  return { record, blockedReasons: [] };
}
