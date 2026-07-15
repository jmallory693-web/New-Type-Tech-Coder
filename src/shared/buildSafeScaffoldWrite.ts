/**
 * Stage 129: Safe Scaffold Write readiness evaluation (no filesystem writes).
 * Stage 129 requires Safe target only (Caution remains blocked).
 * Disk existence and symlink checks run in the main-process writer.
 */

import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";
import type {
  SafeScaffoldWriteManifestNotReadyEntry,
  SafeScaffoldWriteManifestReadyEntry,
} from "./buildModeWriteManifestPreview";
import type { SafeScaffoldFinalConfirmationAcknowledgements } from "./buildModeFinalConfirmation";
import { acknowledgementsAreComplete } from "./buildSafeScaffoldFinalConfirmation";

export function evaluateSafeScaffoldWritePreconditions(input: {
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
  finalConfirmationExists: boolean;
  finalConfirmationStale: boolean;
  finalConfirmationAcks: SafeScaffoldFinalConfirmationAcknowledgements | null;
  proposedRelativePaths: string[];
  readyToCreate: SafeScaffoldWriteManifestReadyEntry[];
  notReady: SafeScaffoldWriteManifestNotReadyEntry[];
}): { canWrite: boolean; hardBlocked: boolean; reasons: string[] } {
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
  if (input.targetSafetyStatus === "caution") {
    reasons.push(
      "Stage 129 requires a Safe target folder. Caution targets are blocked until a later stage.",
    );
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
  if (!input.finalConfirmationExists) {
    reasons.push("Record Safe Scaffold Final Confirmation first.");
  }
  if (input.finalConfirmationStale) {
    reasons.push(
      "Final Confirmation is stale — regenerate previews and confirm again.",
    );
  }
  if (
    input.finalConfirmationExists &&
    !input.finalConfirmationStale &&
    input.targetSafetyStatus === "safe" &&
    (!input.finalConfirmationAcks ||
      !acknowledgementsAreComplete({
        targetSafetyStatus: "safe",
        acknowledgements: input.finalConfirmationAcks,
      }))
  ) {
    reasons.push("Final Confirmation acknowledgements are incomplete.");
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
    input.targetSafetyStatus === "caution" ||
    blockedPath.length > 0 ||
    blockedContent.length > 0 ||
    unclassified.length > 0;

  const canWrite =
    input.blueprintImported &&
    input.taskCardCount > 0 &&
    Boolean(input.targetFolderPath) &&
    !input.targetStale &&
    !input.targetBusy &&
    input.targetSafetyStatus === "safe" &&
    input.fileTreeExists &&
    !input.fileTreeStale &&
    input.fileContentExists &&
    !input.fileContentStale &&
    input.writeManifestExists &&
    !input.writeManifestStale &&
    input.finalConfirmationExists &&
    !input.finalConfirmationStale &&
    Boolean(input.finalConfirmationAcks) &&
    acknowledgementsAreComplete({
      targetSafetyStatus: "safe",
      acknowledgements: input.finalConfirmationAcks!,
    }) &&
    unclassified.length === 0 &&
    blockedPath.length === 0 &&
    blockedContent.length === 0 &&
    input.readyToCreate.length > 0;

  return { canWrite, hardBlocked, reasons: canWrite ? [] : reasons };
}

/** Shared content-safety patterns (must match write-manifest builder). */
export function scaffoldContentLooksUnsafe(content: string): string | null {
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
