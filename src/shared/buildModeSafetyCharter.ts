/**
 * Stage 117: Safe Scaffold Mode / Build Mode safety charter (text only).
 * No file writes. No scaffold. No commands.
 */

export const BUILD_MODE_STATUS_LABEL = "Planning Only";

export const BUILD_MODE_STATUS_EXPLAIN =
  "Safe Scaffold Mode is being prepared. This version does not create files, edit files, run commands, install packages, or apply patches.";

export const BUILD_MODE_INACTIVE_BANNER = [
  "Safe Scaffold Mode is not active yet.",
  "NTTC will not create files in this stage.",
  "NTTC will not edit existing source files.",
  "NTTC will not run install/build commands.",
  "NTTC will not apply patches.",
] as const;

export const BUILD_MODE_SAFETY_CHARTER_RULES = [
  "Create files only in a confirmed empty target folder.",
  "Never edit existing source files in Build Mode V1.",
  "Never overwrite files.",
  "Never run npm install, npm build, or arbitrary commands.",
  "Never apply patches.",
  "Never let AI browse files invisibly.",
  "Always preview the file tree before writing.",
  "Always preview generated file contents before writing.",
  "Always require explicit confirmation before writing.",
  "Always create a written-files manifest and rollback note.",
] as const;

export const BUILD_MODE_WILL_NOT_DO = [
  "create source files",
  "edit source files",
  "modify package.json",
  "install dependencies",
  "run commands",
  "apply patches",
  "call AI automatically",
  "send project data automatically",
] as const;

export const FUTURE_SAFE_SCAFFOLD_REQUIREMENTS = [
  {
    id: "blueprint-exists",
    label: "Blueprint exists",
  },
  {
    id: "completeness-ready",
    label: "Blueprint completeness is ready for Phase 1",
  },
  {
    id: "task-cards-exist",
    label: "Phase Task Cards exist",
  },
  {
    id: "target-folder-selected",
    label: "Target folder selected",
  },
  {
    id: "target-folder-empty",
    label: "Target folder confirmed empty/safe",
  },
  {
    id: "file-tree-preview",
    label: "Scaffold file tree preview generated",
  },
  {
    id: "file-contents-preview",
    label: "Scaffold file contents preview generated",
  },
  {
    id: "written-files-manifest",
    label: "Write manifest preview prepared",
  },
  {
    id: "user-confirmed-write",
    label: "User confirmed write",
  },
  {
    id: "actual-files-written",
    label: "Actual files written",
  },
  {
    id: "written-files-manifest-after-write",
    label: "Written-files manifest after write",
  },
] as const;

export type FutureSafeScaffoldRequirementId =
  (typeof FUTURE_SAFE_SCAFFOLD_REQUIREMENTS)[number]["id"];
