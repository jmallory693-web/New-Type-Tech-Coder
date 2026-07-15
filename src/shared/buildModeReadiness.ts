/**
 * Stage 117/119/121: Build Mode readiness helpers.
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
  | "later-file-contents-preview";

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
        nextStepKind = "later-file-contents-preview";
        nextStepText =
          "Next Step: Review the Safe Scaffold file tree. Next stage will add file-content preview.";
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
      "file-contents-preview": false,
      "user-confirmed-write": false,
      "written-files-manifest": false,
    },
    nextStepKind,
    nextStepText,
  };
}
