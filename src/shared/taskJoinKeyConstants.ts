/** Stage 94: Task artifact join-key constants (metadata only; no AI). */

export const TASK_ARTIFACT_INDEX_REPORT_TITLE = "# NTTC Task Artifact Index";

export const TASK_ARTIFACT_INDEX_PURPOSE =
  "Rule-based task artifact index from stored planning metadata only. No AI, no source reads.";

export const TASK_ARTIFACT_KINDS = {
  phaseTaskCard: "blueprint-phase-task-card",
  builderHandoff: "task-card-builder-handoff",
  implementationReport: "task-implementation-report",
  architectureRefactorImplementationReport:
    "architecture-refactor-implementation-report",
  builderResultStaged: "builder-result-staged",
  implementationReview: "implementation-review",
} as const;

export type TaskArtifactKind =
  (typeof TASK_ARTIFACT_KINDS)[keyof typeof TASK_ARTIFACT_KINDS];

export const TASK_ARTIFACT_INDEX_RECOMMENDATIONS = [
  "Deck traceable",
  "Needs relinking",
  "Resolve stale artifacts",
  "Review implementation links",
  "Blocked",
] as const;

export type TaskArtifactIndexRecommendation =
  (typeof TASK_ARTIFACT_INDEX_RECOMMENDATIONS)[number];

export { CHANGED_FILES_TASK_LINK_DEFERRED_NOTE } from "./changedFilesTaskLinkConstants";
