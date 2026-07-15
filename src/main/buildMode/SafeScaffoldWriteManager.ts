/**
 * Stage 129: Safe Scaffold Write manager.
 * Creates ready-to-create files only after final confirmation + immediate re-check.
 * No overwrite. No AI. No commands. No package install. Safe target only.
 */

import fs from "node:fs";
import path from "node:path";
import type { SafetyGate } from "../safety/SafetyGate";
import { inspectLinkSafety } from "../safety/linkSafety";
import { assessSafeScaffoldTarget } from "./assessSafeScaffoldTarget";
import { validateProposedRelativePath } from "../../shared/buildModeFileTreePreview";
import { fingerprintFileTreePreview } from "../../shared/buildModeFileContentPreview";
import { fingerprintFileContentPreview } from "../../shared/buildModeWriteManifestPreview";
import { fingerprintWriteManifestPreview } from "../../shared/buildModeFinalConfirmation";
import {
  deriveSafeScaffoldWriteUiStatus,
  emptySafeScaffoldWriteResultTombstone,
  emptySafeScaffoldWriteState,
  fingerprintFinalConfirmationForWrite,
  normalizeSafeScaffoldWriteResultRecord,
  SAFE_SCAFFOLD_WRITE_ROLLBACK_NOTE,
  type SafeScaffoldWriteFailedEntry,
  type SafeScaffoldWriteRecheckSummary,
  type SafeScaffoldWriteResultRecord,
  type SafeScaffoldWriteSkippedEntry,
  type SafeScaffoldWriteState,
} from "../../shared/buildModeSafeScaffoldWrite";
import {
  evaluateSafeScaffoldWritePreconditions,
  scaffoldContentLooksUnsafe,
} from "../../shared/buildSafeScaffoldWrite";
import type { SafeScaffoldTargetState } from "../../shared/buildModeTargetSafety";
import type { SafeScaffoldFileTreePreviewRecord } from "../../shared/buildModeFileTreePreview";
import type { SafeScaffoldFileContentPreviewRecord } from "../../shared/buildModeFileContentPreview";
import type { SafeScaffoldWriteManifestPreviewRecord } from "../../shared/buildModeWriteManifestPreview";
import type { SafeScaffoldFinalConfirmationRecord } from "../../shared/buildModeFinalConfirmation";

export type SafeScaffoldWriteContext = {
  blueprintImported: boolean;
  blueprintProjectType: string;
  taskCardCount: number;
  target: SafeScaffoldTargetState;
  fileTree: SafeScaffoldFileTreePreviewRecord | null;
  fileContent: SafeScaffoldFileContentPreviewRecord | null;
  writeManifest: SafeScaffoldWriteManifestPreviewRecord | null;
  finalConfirmation: SafeScaffoldFinalConfirmationRecord | null;
  projectRoot: string | null;
};

function normalizeRel(p: string): string {
  return p.trim().replace(/\\/g, "/");
}

function isPathInside(child: string, parent: string): boolean {
  const c = path.resolve(child).replace(/\//g, "\\").toLowerCase();
  const p = path.resolve(parent).replace(/\//g, "\\").toLowerCase();
  if (c === p) return true;
  const prefix = p.endsWith("\\") ? p : `${p}\\`;
  return c.startsWith(prefix);
}

function resolveUnderTarget(
  targetRoot: string,
  relativePath: string,
): { abs: string; error: string | null } {
  const rel = normalizeRel(relativePath);
  const pathErr = validateProposedRelativePath(rel);
  if (pathErr) return { abs: "", error: pathErr };
  if (rel.endsWith("/")) {
    return { abs: "", error: "Directory-only paths are not written as files." };
  }
  const abs = path.resolve(targetRoot, ...rel.split("/"));
  if (!isPathInside(abs, targetRoot)) {
    return {
      abs: "",
      error: "Resolved path escapes the selected target folder.",
    };
  }
  return { abs, error: null };
}

export class SafeScaffoldWriteManager {
  private saved: SafeScaffoldWriteResultRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    emptySafeScaffoldWriteState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): SafeScaffoldWriteResultRecord | null {
    return this.saved
      ? {
          ...this.saved,
          createdRelativePaths: [...this.saved.createdRelativePaths],
          createdDirectories: [...this.saved.createdDirectories],
          skipped: this.saved.skipped.map((e) => ({ ...e })),
          failed: this.saved.failed.map((e) => ({ ...e })),
          warnings: [...this.saved.warnings],
          safetyRecheck: {
            ...this.saved.safetyRecheck,
            reasons: [...this.saved.safetyRecheck.reasons],
          },
        }
      : emptySafeScaffoldWriteResultTombstone();
  }

  getState(ctx?: SafeScaffoldWriteContext | null): SafeScaffoldWriteState {
    const readiness = ctx
      ? this.evaluateWithOptionalDiskCheck(ctx)
      : {
          canWrite: false,
          hardBlocked: false,
          reasons: this.lastReadinessBlockedReasons,
        };

    if (ctx) {
      this.lastReadinessBlockedReasons = readiness.reasons;
    }

    return {
      saved: this.saved
        ? {
            ...this.saved,
            createdRelativePaths: [...this.saved.createdRelativePaths],
            createdDirectories: [...this.saved.createdDirectories],
            skipped: this.saved.skipped.map((e) => ({ ...e })),
            failed: this.saved.failed.map((e) => ({ ...e })),
            warnings: [...this.saved.warnings],
            safetyRecheck: {
              ...this.saved.safetyRecheck,
              reasons: [...this.saved.safetyRecheck.reasons],
            },
          }
        : null,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveSafeScaffoldWriteUiStatus({
        saved: this.saved,
        busy: this.busy,
        canWrite: readiness.canWrite,
        hardBlocked: readiness.hardBlocked,
      }),
      readinessBlockedReasons: readiness.reasons,
      canWrite: readiness.canWrite && !this.busy,
    };
  }

  restoreSaved(record: SafeScaffoldWriteResultRecord | null | undefined): void {
    const normalized = normalizeSafeScaffoldWriteResultRecord(record);
    if (!normalized) {
      this.clearInternal("No Safe Scaffold write result restored from history.");
      return;
    }
    this.saved = { ...normalized, stale: true };
    this.busy = false;
    this.statusMessage =
      "Restored Safe Scaffold write result (marked stale). Files on disk were not changed.";
    this.safetyGate.log(
      "info",
      "Safe Scaffold write result restored",
      `${normalized.createdRelativePaths.length} created paths`,
    );
  }

  clearForProjectChange(): void {
    this.clearInternal(
      "Safe Scaffold write result cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Safe Scaffold write result is stale relative to current inputs. Files on disk were not changed.";
    this.safetyGate.log("info", "Safe Scaffold write result stale", reason);
  }

  clear(): void {
    this.clearInternal(
      "Safe Scaffold write result cleared from app history. Files on disk were not deleted.",
    );
    this.safetyGate.log(
      "info",
      "Safe Scaffold write result cleared",
      "UI/history only — no disk delete.",
    );
  }

  recheck(ctx: SafeScaffoldWriteContext): SafeScaffoldWriteState {
    const readiness = this.evaluateWithOptionalDiskCheck(ctx);
    this.lastReadinessBlockedReasons = readiness.reasons;
    this.statusMessage = readiness.canWrite
      ? "Write readiness re-check passed (Safe target + current previews + confirmation). Disk write still requires explicit confirmation."
      : `Write not ready: ${readiness.reasons.join(" ")}`;
    this.safetyGate.log(
      readiness.canWrite ? "info" : "warning",
      "Safe Scaffold write readiness re-check",
      readiness.canWrite ? "passed" : readiness.reasons.join(" | "),
    );
    return this.getState(ctx);
  }

  /**
   * Perform immediate re-check then exclusive create of ready-to-create files.
   * Caller must obtain user dialog confirmation first.
   */
  write(ctx: SafeScaffoldWriteContext): SafeScaffoldWriteState {
    const logical = evaluateSafeScaffoldWritePreconditions({
      blueprintImported: ctx.blueprintImported,
      taskCardCount: ctx.taskCardCount,
      targetFolderPath: ctx.target.selectedPath,
      targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
      targetStale: ctx.target.stale,
      targetBusy: ctx.target.busy,
      fileTreeExists: Boolean(ctx.fileTree),
      fileTreeStale: Boolean(ctx.fileTree?.stale),
      fileContentExists: Boolean(ctx.fileContent),
      fileContentStale: Boolean(ctx.fileContent?.stale),
      writeManifestExists: Boolean(ctx.writeManifest),
      writeManifestStale: Boolean(ctx.writeManifest?.stale),
      finalConfirmationExists: Boolean(ctx.finalConfirmation),
      finalConfirmationStale: Boolean(ctx.finalConfirmation?.stale),
      finalConfirmationAcks: ctx.finalConfirmation?.acknowledgements ?? null,
      proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
      readyToCreate: ctx.writeManifest?.readyToCreate ?? [],
      notReady: ctx.writeManifest?.notReady ?? [],
    });
    this.lastReadinessBlockedReasons = logical.reasons;

    if (
      !logical.canWrite ||
      !ctx.fileTree ||
      !ctx.fileContent ||
      !ctx.writeManifest ||
      !ctx.finalConfirmation ||
      !ctx.target.selectedPath
    ) {
      this.statusMessage = `Write blocked: ${logical.reasons.join(" ")}`;
      this.safetyGate.log(
        "warning",
        "Safe Scaffold write blocked",
        logical.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage = "Running immediate Safe Scaffold write re-check…";
    try {
      const preflight = this.preflightImmediate(ctx);
      if (!preflight.ok || !preflight.plan) {
        this.statusMessage = `Write blocked by final re-check: ${preflight.recheck.reasons.join(" ")}`;
        this.safetyGate.log(
          "warning",
          "Safe Scaffold write final re-check failed",
          preflight.recheck.reasons.join(" | "),
        );
        return this.getState(ctx);
      }

      const createdRelativePaths: string[] = [];
      const createdDirectories: string[] = [];
      const failed: SafeScaffoldWriteFailedEntry[] = [];
      const createdDirSet = new Set<string>();

      for (const item of preflight.plan) {
        try {
          const parent = path.dirname(item.abs);
          if (!fs.existsSync(parent)) {
            fs.mkdirSync(parent, { recursive: true });
            const relParent = normalizeRel(
              path.relative(preflight.targetRoot, parent),
            );
            if (relParent && !createdDirSet.has(relParent)) {
              createdDirSet.add(relParent);
              createdDirectories.push(relParent.endsWith("/") ? relParent : `${relParent}/`);
            }
          }
          fs.writeFileSync(item.abs, item.content, {
            encoding: "utf8",
            flag: "wx",
          });
          createdRelativePaths.push(item.relativePath);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Write failed";
          failed.push({ relativePath: item.relativePath, reason: message });
          // Stop further writes after first failure (report partial).
          break;
        }
      }

      const skipped: SafeScaffoldWriteSkippedEntry[] = (
        ctx.writeManifest.notReady ?? []
      ).map((e) => ({
        relativePath: e.relativePath,
        reason: `${e.pathStatus}: ${e.reason}`,
      }));

      const treeFingerprint = fingerprintFileTreePreview({
        generatedAt: ctx.fileTree.generatedAt,
        proposedRelativePaths: ctx.fileTree.proposedRelativePaths,
      });
      const contentFingerprint = fingerprintFileContentPreview({
        generatedAt: ctx.fileContent.generatedAt,
        proposedRelativePaths: ctx.fileTree.proposedRelativePaths,
        templatedRelativePaths: ctx.fileContent.templatedFiles.map(
          (f) => f.relativePath,
        ),
        filesWithoutContents: ctx.fileContent.filesWithoutContents,
      });
      const manifestFingerprint = fingerprintWriteManifestPreview({
        generatedAt: ctx.writeManifest.generatedAt,
        readyRelativePaths: ctx.writeManifest.readyToCreate.map(
          (e) => e.relativePath,
        ),
        notReadyRelativePaths: ctx.writeManifest.notReady.map(
          (e) => e.relativePath,
        ),
      });
      const confirmFingerprint = fingerprintFinalConfirmationForWrite({
        confirmedAt: ctx.finalConfirmation.confirmedAt,
        targetFolderPath: ctx.finalConfirmation.sourceTargetFolderPath,
        readyToCreateCount: ctx.finalConfirmation.readyToCreateCount,
        notReadyCount: ctx.finalConfirmation.notReadyCount,
      });

      const writtenAt = new Date().toISOString();
      const warnings: string[] = [];
      if (failed.length > 0) {
        warnings.push(
          "Partial write failure occurred. Review created paths and failed paths below. No automatic rollback was performed.",
        );
      }

      const markdown = this.buildResultMarkdown({
        writtenAt,
        targetFolderPath: preflight.targetRoot,
        createdRelativePaths,
        createdDirectories,
        skipped,
        failed,
        recheck: preflight.recheck,
      });

      this.saved = {
        writtenAt,
        targetFolderPath: preflight.targetRoot,
        createdRelativePaths,
        createdDirectories,
        skipped,
        failed,
        sourceBlueprintImported: true,
        sourceBlueprintProjectType: ctx.blueprintProjectType,
        sourceTaskCardCount: ctx.taskCardCount,
        sourceFileTreeGeneratedAt: ctx.fileTree.generatedAt,
        sourceFileTreeFingerprint: treeFingerprint,
        sourceFileContentGeneratedAt: ctx.fileContent.generatedAt,
        sourceFileContentFingerprint: contentFingerprint,
        sourceWriteManifestGeneratedAt: ctx.writeManifest.generatedAt,
        sourceWriteManifestFingerprint: manifestFingerprint,
        sourceFinalConfirmationConfirmedAt: ctx.finalConfirmation.confirmedAt,
        sourceFinalConfirmationFingerprint: confirmFingerprint,
        safetyRecheck: preflight.recheck,
        rollbackNote: SAFE_SCAFFOLD_WRITE_ROLLBACK_NOTE,
        markdown,
        warnings,
        stale: false,
      };

      this.statusMessage =
        failed.length > 0
          ? `Write finished with failures (${createdRelativePaths.length} created, ${failed.length} failed). No commands or installs were run.`
          : `Wrote ${createdRelativePaths.length} scaffold file(s). No overwrite. No commands or package installs.`;

      this.safetyGate.log(
        failed.length > 0 ? "warning" : "success",
        "Safe Scaffold write completed",
        `${createdRelativePaths.length} created · ${failed.length} failed · target ${preflight.targetRoot}`,
      );
    } finally {
      this.busy = false;
    }
    return this.getState(ctx);
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Copy Safe Scaffold write result blocked",
        "No write result to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Copied Safe Scaffold write result",
      `${this.saved.createdRelativePaths.length} created paths (clipboard only)`,
    );
  }

  private evaluateWithOptionalDiskCheck(ctx: SafeScaffoldWriteContext): {
    canWrite: boolean;
    hardBlocked: boolean;
    reasons: string[];
  } {
    const logical = evaluateSafeScaffoldWritePreconditions({
      blueprintImported: ctx.blueprintImported,
      taskCardCount: ctx.taskCardCount,
      targetFolderPath: ctx.target.selectedPath,
      targetSafetyStatus: ctx.target.lastCheck?.status ?? null,
      targetStale: ctx.target.stale,
      targetBusy: ctx.target.busy,
      fileTreeExists: Boolean(ctx.fileTree),
      fileTreeStale: Boolean(ctx.fileTree?.stale),
      fileContentExists: Boolean(ctx.fileContent),
      fileContentStale: Boolean(ctx.fileContent?.stale),
      writeManifestExists: Boolean(ctx.writeManifest),
      writeManifestStale: Boolean(ctx.writeManifest?.stale),
      finalConfirmationExists: Boolean(ctx.finalConfirmation),
      finalConfirmationStale: Boolean(ctx.finalConfirmation?.stale),
      finalConfirmationAcks: ctx.finalConfirmation?.acknowledgements ?? null,
      proposedRelativePaths: ctx.fileTree?.proposedRelativePaths ?? [],
      readyToCreate: ctx.writeManifest?.readyToCreate ?? [],
      notReady: ctx.writeManifest?.notReady ?? [],
    });

    if (!logical.canWrite || !ctx.target.selectedPath || !ctx.writeManifest) {
      return logical;
    }

    // After a successful write into this folder, block another write.
    if (
      this.saved &&
      !this.saved.stale &&
      this.saved.createdRelativePaths.length > 0 &&
      normalizeRel(this.saved.targetFolderPath).toLowerCase() ===
        normalizeRel(ctx.target.selectedPath).toLowerCase()
    ) {
      return {
        canWrite: false,
        hardBlocked: true,
        reasons: [
          "Scaffold files were already written to this target folder. Select a new empty Safe folder for another write.",
        ],
      };
    }

    const targetRoot = path.resolve(ctx.target.selectedPath);
    const conflicts: string[] = [];
    for (const entry of ctx.writeManifest.readyToCreate) {
      const resolved = resolveUnderTarget(targetRoot, entry.relativePath);
      if (resolved.error) {
        return {
          canWrite: false,
          hardBlocked: true,
          reasons: [`${entry.relativePath}: ${resolved.error}`],
        };
      }
      if (fs.existsSync(resolved.abs)) {
        conflicts.push(entry.relativePath);
      }
    }
    if (conflicts.length > 0) {
      return {
        canWrite: false,
        hardBlocked: true,
        reasons: [
          `Ready-to-create path(s) already exist on disk (${conflicts.length}): ${conflicts.slice(0, 5).join(", ")}${conflicts.length > 5 ? "…" : ""}`,
        ],
      };
    }

    return logical;
  }

  private preflightImmediate(ctx: SafeScaffoldWriteContext): {
    ok: boolean;
    targetRoot: string;
    recheck: SafeScaffoldWriteRecheckSummary;
    plan: Array<{ relativePath: string; abs: string; content: string }> | null;
  } {
    const selected = ctx.target.selectedPath!;
    const confirmedPath = ctx.finalConfirmation!.sourceTargetFolderPath;
    const checkedAt = new Date().toISOString();
    const reasons: string[] = [];

    const assessment = assessSafeScaffoldTarget({
      selectedPath: selected,
      currentProjectRoot: ctx.projectRoot,
    });

    const targetRoot = assessment.resolvedPath || path.resolve(selected);
    const pathMatched =
      path.resolve(selected).toLowerCase() ===
        path.resolve(confirmedPath).toLowerCase() ||
      targetRoot.toLowerCase() === path.resolve(confirmedPath).toLowerCase();

    if (!pathMatched) {
      reasons.push(
        "Target folder path no longer matches the path recorded in Final Confirmation.",
      );
    }
    if (assessment.status !== "safe") {
      reasons.push(
        `Final re-check target safety is ${assessment.status} (Stage 129 requires Safe).`,
      );
    }
    if (ctx.finalConfirmation!.stale) {
      reasons.push("Final Confirmation became stale.");
    }
    if (ctx.writeManifest!.stale) {
      reasons.push("Write Manifest Preview became stale.");
    }
    if (ctx.fileTree!.stale || ctx.fileContent!.stale) {
      reasons.push("File Tree or File Content Preview became stale.");
    }

    const targetLink = inspectLinkSafety(targetRoot);
    if (!targetLink.safe) {
      reasons.push(targetLink.reason || "Target folder failed link safety.");
    }

    const templatedByPath = new Map(
      ctx.fileContent!.templatedFiles.map((f) => [
        normalizeRel(f.relativePath),
        f.content,
      ]),
    );

    let existingPathConflicts = 0;
    let pathValidationFailures = 0;
    let contentSafetyFailures = 0;
    const plan: Array<{ relativePath: string; abs: string; content: string }> =
      [];

    for (const entry of ctx.writeManifest!.readyToCreate) {
      const rel = normalizeRel(entry.relativePath);
      const resolved = resolveUnderTarget(targetRoot, rel);
      if (resolved.error) {
        pathValidationFailures += 1;
        reasons.push(`${rel}: ${resolved.error}`);
        continue;
      }

      // Parent link safety
      let parent = path.dirname(resolved.abs);
      while (isPathInside(parent, targetRoot) && parent !== targetRoot) {
        const parentLink = inspectLinkSafety(parent);
        if (!parentLink.safe && fs.existsSync(parent)) {
          pathValidationFailures += 1;
          reasons.push(
            `${rel}: parent path failed link safety (${parentLink.reason})`,
          );
          break;
        }
        const next = path.dirname(parent);
        if (next === parent) break;
        parent = next;
      }

      const destLink = inspectLinkSafety(resolved.abs);
      if (!destLink.safe && fs.existsSync(resolved.abs)) {
        pathValidationFailures += 1;
        reasons.push(`${rel}: ${destLink.reason}`);
        continue;
      }

      if (fs.existsSync(resolved.abs)) {
        existingPathConflicts += 1;
        reasons.push(`${rel}: already exists on disk (no overwrite).`);
        continue;
      }

      const content = templatedByPath.get(rel);
      if (typeof content !== "string") {
        // case-insensitive fallback
        const alt = [...templatedByPath.entries()].find(
          ([k]) => k.toLowerCase() === rel.toLowerCase(),
        );
        if (!alt) {
          pathValidationFailures += 1;
          reasons.push(`${rel}: missing templated content for write.`);
          continue;
        }
        const unsafe = scaffoldContentLooksUnsafe(alt[1]);
        if (unsafe) {
          contentSafetyFailures += 1;
          reasons.push(`${rel}: ${unsafe}`);
          continue;
        }
        plan.push({ relativePath: rel, abs: resolved.abs, content: alt[1] });
        continue;
      }

      const unsafe = scaffoldContentLooksUnsafe(content);
      if (unsafe) {
        contentSafetyFailures += 1;
        reasons.push(`${rel}: ${unsafe}`);
        continue;
      }
      plan.push({ relativePath: rel, abs: resolved.abs, content });
    }

    if (plan.length === 0 && reasons.length === 0) {
      reasons.push("No ready-to-create files remained after final re-check.");
    }

    // Fail entire write if any conflict/validation issue (all-or-nothing preflight).
    const passed =
      reasons.length === 0 &&
      plan.length > 0 &&
      assessment.status === "safe" &&
      pathMatched &&
      existingPathConflicts === 0 &&
      pathValidationFailures === 0 &&
      contentSafetyFailures === 0;

    const recheck: SafeScaffoldWriteRecheckSummary = {
      checkedAt,
      targetStatus: assessment.status,
      targetPathMatched: pathMatched,
      readyPathCount: ctx.writeManifest!.readyToCreate.length,
      existingPathConflicts,
      pathValidationFailures,
      contentSafetyFailures,
      passed,
      reasons: passed ? [] : reasons,
    };

    return {
      ok: passed,
      targetRoot,
      recheck,
      plan: passed ? plan : null,
    };
  }

  private buildResultMarkdown(input: {
    writtenAt: string;
    targetFolderPath: string;
    createdRelativePaths: string[];
    createdDirectories: string[];
    skipped: SafeScaffoldWriteSkippedEntry[];
    failed: SafeScaffoldWriteFailedEntry[];
    recheck: SafeScaffoldWriteRecheckSummary;
  }): string {
    const created =
      input.createdRelativePaths.length > 0
        ? input.createdRelativePaths.map((p) => `- \`${p}\``).join("\n")
        : "- (none)";
    const dirs =
      input.createdDirectories.length > 0
        ? input.createdDirectories.map((p) => `- \`${p}\``).join("\n")
        : "- (none beyond parents of created files)";
    const skipped =
      input.skipped.length > 0
        ? input.skipped.map((e) => `- \`${e.relativePath}\` — ${e.reason}`).join("\n")
        : "- (none)";
    const failed =
      input.failed.length > 0
        ? input.failed.map((e) => `- \`${e.relativePath}\` — ${e.reason}`).join("\n")
        : "- (none)";

    return [
      "# NTTC Safe Scaffold Write Result",
      "",
      "## Status",
      input.failed.length > 0
        ? "Write completed with failures. Review created and failed paths."
        : "Safe Scaffold files were created. No files were overwritten.",
      "",
      `Written at: ${input.writtenAt}`,
      "",
      "## Target Folder",
      input.targetFolderPath,
      "",
      "## Safety Re-check",
      `- Passed: ${input.recheck.passed ? "yes" : "no"}`,
      `- Target status: ${input.recheck.targetStatus}`,
      `- Path matched confirmation: ${input.recheck.targetPathMatched ? "yes" : "no"}`,
      `- Checked at: ${input.recheck.checkedAt}`,
      "",
      "## Files Created",
      created,
      "",
      "## Directories Created",
      dirs,
      "",
      "## Skipped / Not Written",
      skipped,
      "",
      "## Failed",
      failed,
      "",
      "## Manual Rollback Note",
      SAFE_SCAFFOLD_WRITE_ROLLBACK_NOTE,
      "",
      "## Safety Boundaries",
      "- NTTC did not overwrite existing files.",
      "- NTTC did not edit existing files.",
      "- NTTC did not run commands.",
      "- NTTC did not install packages.",
      "- NTTC did not apply patches.",
      "- NTTC did not call AI.",
      "",
    ].join("\n");
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}
