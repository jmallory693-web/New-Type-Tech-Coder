/**
 * Stage 117/119/121/123/125/127/129: Build Mode readiness helpers.
 * No IPC. No file writes.
 */

import type { BlueprintState } from "./types";
import type { FutureSafeScaffoldRequirementId } from "./buildModeSafetyCharter";
import {
  isSafeScaffoldTargetAllowingPreview,
  isSafeScaffoldTargetConfirmedSafe,
  isSafeScaffoldTargetSelected,
  type SafeScaffoldTargetState,
} from "./buildModeTargetSafety";
import {
  isSafeScaffoldFileTreePreviewCurrent,
  type SafeScaffoldFileTreePreviewState,
} from "./buildModeFileTreePreview";
import {
  isSafeScaffoldFileContentPreviewCurrent,
  type SafeScaffoldFileContentPreviewState,
} from "./buildModeFileContentPreview";
import {
  isSafeScaffoldWriteManifestPreviewCurrent,
  type SafeScaffoldWriteManifestPreviewState,
} from "./buildModeWriteManifestPreview";
import {
  isSafeScaffoldFinalConfirmationCurrent,
  type SafeScaffoldFinalConfirmationState,
} from "./buildModeFinalConfirmation";
import {
  isSafeScaffoldWriteResultCurrent,
  type SafeScaffoldWriteState,
} from "./buildModeSafeScaffoldWrite";

export type BuildModeBlueprintPresence = "ready" | "missing" | "incomplete";

export type BuildModeCompletenessLabel =
  | "ready-for-phase-1"
  | "incomplete"
  | "not run";

export type BuildModeNextStepKind =
  | "create-blueprint"
  | "generate-task-cards"
  | "select-target-folder"
  | "fix-target-folder"
  | "generate-file-tree-preview"
  | "regenerate-file-tree-preview"
  | "generate-file-contents-preview"
  | "regenerate-file-contents-preview"
  | "generate-write-manifest-preview"
  | "regenerate-write-manifest-preview"
  | "record-final-confirmation"
  | "rerecord-final-confirmation"
  | "run-safe-scaffold-write"
  | "review-written-scaffold"
  | "resolve-write-blockers";

export type BuildModeReadiness = {
  blueprintPresence: BuildModeBlueprintPresence;
  completenessLabel: BuildModeCompletenessLabel;
  taskCardCount: number;
  taskCardsLabel: string;
  checklistSatisfied: Partial<
    Record<FutureSafeScaffoldRequirementId, boolean>
  >;
  nextStepKind: BuildModeNextStepKind;
  nextStepText: string;
};

export function deriveBuildModeReadiness(
  blueprint: BlueprintState | null | undefined,
  target?: SafeScaffoldTargetState | null,
  fileTree?: SafeScaffoldFileTreePreviewState | null,
  fileContent?: SafeScaffoldFileContentPreviewState | null,
  writeManifest?: SafeScaffoldWriteManifestPreviewState | null,
  finalConfirmation?: SafeScaffoldFinalConfirmationState | null,
  scaffoldWrite?: SafeScaffoldWriteState | null,
): BuildModeReadiness {
  const status = blueprint?.status;
  const imported = Boolean(status?.blueprintImported);
  const taskCardCount = blueprint?.phaseTaskCards?.saved?.cards?.length ?? 0;
  const taskCardsExist = Boolean(status?.taskCardsExist) || taskCardCount > 0;
  const readinessStatus = status?.readinessStatus ?? null;
  const completenessRan = Boolean(status?.completenessCheckExists);

  const targetSelected = isSafeScaffoldTargetSelected(target);
  const targetConfirmedSafe = isSafeScaffoldTargetConfirmedSafe(target);
  const targetAllowsPreview = isSafeScaffoldTargetAllowingPreview(target);
  const targetBlocked =
    Boolean(target?.selectedPath) &&
    !target?.stale &&
    !target?.busy &&
    target?.lastCheck?.status === "blocked";
  const fileTreeCurrent = isSafeScaffoldFileTreePreviewCurrent(fileTree);
  const fileTreeStale = Boolean(fileTree?.saved?.stale);
  const fileContentCurrent = isSafeScaffoldFileContentPreviewCurrent(fileContent);
  const fileContentStale = Boolean(fileContent?.saved?.stale);
  const writeManifestCurrent =
    isSafeScaffoldWriteManifestPreviewCurrent(writeManifest);
  const writeManifestStale = Boolean(writeManifest?.saved?.stale);
  const finalConfirmationCurrent =
    isSafeScaffoldFinalConfirmationCurrent(finalConfirmation);
  const finalConfirmationStale = Boolean(finalConfirmation?.saved?.stale);
  const writeResultCurrent = isSafeScaffoldWriteResultCurrent(scaffoldWrite);
  const writeBlocked =
    (scaffoldWrite?.readinessBlockedReasons?.length ?? 0) > 0 &&
    finalConfirmationCurrent &&
    !writeResultCurrent;

  let blueprintPresence: BuildModeBlueprintPresence = "missing";
  if (imported) {
    blueprintPresence =
      readinessStatus === "ready-for-phase-1" ||
      readinessStatus === "ready-for-builder-planning-only" ||
      taskCardsExist
        ? "ready"
        : "incomplete";
  }

  let completenessLabel: BuildModeCompletenessLabel = "not run";
  if (completenessRan) {
    completenessLabel =
      readinessStatus === "ready-for-phase-1" ||
      readinessStatus === "ready-for-builder-planning-only"
        ? "ready-for-phase-1"
        : "incomplete";
  }

  const completenessReady =
    readinessStatus === "ready-for-phase-1" ||
    readinessStatus === "ready-for-builder-planning-only";

  let nextStepKind: BuildModeNextStepKind = "create-blueprint";
  let nextStepText =
    "Next Step: Go to Blueprint and create/import a project blueprint.";
  if (imported && !taskCardsExist) {
    nextStepKind = "generate-task-cards";
    nextStepText = "Next Step: Generate Blueprint Phase Task Cards.";
  } else if (imported && taskCardsExist) {
    if (!targetSelected || target?.stale || !target?.lastCheck) {
      nextStepKind = "select-target-folder";
      nextStepText =
        "Next Step: Select a Safe Scaffold target folder and refresh the safety check.";
    } else if (targetBlocked) {
      nextStepKind = "fix-target-folder";
      nextStepText =
        "Next Step: Choose an empty folder outside the current project.";
    } else if (targetAllowsPreview) {
      if (!fileTree?.saved) {
        nextStepKind = "generate-file-tree-preview";
        nextStepText =
          "Next Step: Generate Safe Scaffold File Tree Preview (paths only — no files created).";
      } else if (fileTreeStale) {
        nextStepKind = "regenerate-file-tree-preview";
        nextStepText =
          "Next Step: Regenerate Safe Scaffold File Tree Preview (preview is stale).";
      } else if (fileTreeCurrent) {
        if (!fileContent?.saved) {
          nextStepKind = "generate-file-contents-preview";
          nextStepText =
            "Next Step: Generate Safe Scaffold File Content Preview (deterministic templates in memory — no files created).";
        } else if (fileContentStale) {
          nextStepKind = "regenerate-file-contents-preview";
          nextStepText =
            "Next Step: Regenerate Safe Scaffold File Content Preview (preview is stale).";
        } else if (fileContentCurrent) {
          if (!writeManifest?.saved) {
            nextStepKind = "generate-write-manifest-preview";
            nextStepText =
              "Next Step: Generate Safe Scaffold Write Manifest Preview (preview only — no files created).";
          } else if (writeManifestStale) {
            nextStepKind = "regenerate-write-manifest-preview";
            nextStepText =
              "Next Step: Regenerate Safe Scaffold Write Manifest Preview (preview is stale).";
          } else if (writeManifestCurrent) {
            if (!finalConfirmation?.saved) {
              nextStepKind = "record-final-confirmation";
              nextStepText =
                "Next Step: Review and record Safe Scaffold final confirmation (readiness only — no files created).";
            } else if (finalConfirmationStale) {
              nextStepKind = "rerecord-final-confirmation";
              nextStepText =
                "Next Step: Regenerate previews and record Safe Scaffold final confirmation again (confirmation is stale).";
            } else if (finalConfirmationCurrent) {
              if (writeResultCurrent) {
                nextStepKind = "review-written-scaffold";
                nextStepText =
                  "Next Step: Review the written Safe Scaffold files in the target folder. NTTC did not run commands or install packages.";
              } else if (writeBlocked) {
                nextStepKind = "resolve-write-blockers";
                nextStepText =
                  "Next Step: Resolve Safe Scaffold write blockers before writing files.";
              } else {
                nextStepKind = "run-safe-scaffold-write";
                nextStepText =
                  "Next Step: Run Safe Scaffold Write (creates new files only after an immediate safety re-check — no overwrite, commands, or installs).";
              }
            } else {
              nextStepKind = "record-final-confirmation";
              nextStepText =
                "Next Step: Review and record Safe Scaffold final confirmation (readiness only — no files created).";
            }
          } else {
            nextStepKind = "generate-write-manifest-preview";
            nextStepText =
              "Next Step: Generate Safe Scaffold Write Manifest Preview (preview only — no files created).";
          }
        } else {
          nextStepKind = "generate-file-contents-preview";
          nextStepText =
            "Next Step: Generate Safe Scaffold File Content Preview (deterministic templates in memory — no files created).";
        }
      } else {
        nextStepKind = "generate-file-tree-preview";
        nextStepText =
          "Next Step: Generate Safe Scaffold File Tree Preview (paths only — no files created).";
      }
    } else if (!targetConfirmedSafe) {
      nextStepKind = "fix-target-folder";
      nextStepText =
        "Next Step: Prefer an empty Safe folder (writes still not allowed).";
    } else {
      nextStepKind = "select-target-folder";
      nextStepText =
        "Next Step: Select a Safe Scaffold target folder and refresh the safety check.";
    }
  }

  return {
    blueprintPresence,
    completenessLabel,
    taskCardCount,
    taskCardsLabel:
      taskCardCount > 0 ? `${taskCardCount} cards` : "none",
    checklistSatisfied: {
      "blueprint-exists": imported,
      "completeness-ready": completenessReady,
      "task-cards-exist": taskCardsExist,
      "target-folder-selected": targetSelected,
      "target-folder-empty": targetConfirmedSafe,
      "file-tree-preview": fileTreeCurrent,
      "file-contents-preview": fileContentCurrent,
      "written-files-manifest": writeManifestCurrent,
      "user-confirmed-write": finalConfirmationCurrent,
      "actual-files-written": writeResultCurrent,
      "written-files-manifest-after-write": Boolean(scaffoldWrite?.saved),
    },
    nextStepKind,
    nextStepText,
  };
}
