/**
 * Stage 80/86: preview-only planning document files from imported blueprint.
 */

import {
  PLANNING_DOCUMENT_FILE_NAMES,
  SECTION_TO_PLANNING_FILE,
  CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME,
  IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
  TASK_RECONCILIATION_PLANNING_FILE_NAME,
  TASK_ARTIFACT_INDEX_PLANNING_FILE_NAME,
  TASK_CARDS_PLANNING_FILE_NAME,
  CHANGED_FILES_TASK_LINKS_PLANNING_FILE_NAME,
  ARCHITECTURE_HEALTH_PLANNING_FILE_NAME,
  ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
  ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME,
  type PlanningDocumentFileName,
} from "../../shared/blueprintConstants";
import { buildArchitectureHealthPlanningNote } from "../../shared/architectureHealth/architectureHealthHelpers";
import { buildArchitectureRefactorTaskPlanningSummary } from "../../shared/architectureRefactorTasks/buildArchitectureRefactorTaskCards";
import { buildArchitectureRefactorHandoffPlanningNote } from "../../shared/buildArchitectureRefactorTaskBuilderHandoff";
import { buildTaskCardsPlanningSummary } from "../../shared/buildBlueprintPhaseTaskCards";
import { buildTaskCardHandoffPlanningNote } from "../../shared/buildTaskCardBuilderHandoff";
import { buildChangedFilesTaskLinkPlanningNote } from "../../shared/buildChangedFilesTaskLinkSummary";
import { buildTaskImplementationPlanningNote } from "../../shared/buildTaskImplementationIntakeSummary";
import { buildArchitectureRefactorImplementationPlanningNote } from "../../shared/architectureRefactorTasks/buildArchitectureRefactorTaskImplementationIntakeSummary";
import { buildTaskReconciliationPlanningNote } from "../../shared/buildBlueprintTaskReconciliation";
import { buildTaskArtifactIndexPlanningNote } from "../../shared/buildTaskArtifactIndex";
import { extractBlueprintSections } from "../../shared/extractBlueprintSections";
import type {
  BlueprintPhaseTaskCardsRecord,
  PlanningDocumentPreviewFile,
  PlanningDocumentsPreview,
  TaskCardBuilderHandoffRecord,
  TaskImplementationReportRecord,
  BlueprintTaskReconciliationRecord,
  TaskArtifactIndexRecord,
  ChangedFilesTaskLinkRecord,
  ArchitectureHealthRecord,
  ArchitectureRefactorTaskBuilderHandoffRecord,
  ArchitectureRefactorTaskCardsRecord,
  ArchitectureRefactorTaskImplementationReportRecord,
} from "../../shared/types";

const MAX_FILE_CHARS = 12_000;

function truncateContent(
  content: string,
  fileName: string,
  flags: string[],
): string {
  if (content.length <= MAX_FILE_CHARS) return content;
  flags.push(`${fileName} truncated in preview (${content.length} chars).`);
  return `${content.slice(0, MAX_FILE_CHARS)}\n\n…(truncated for preview size)`;
}

function appendTaskCardSummary(content: string, summary: string | null): string {
  if (!summary?.trim()) return content;
  return `${content.trim()}\n\n${summary.trim()}\n`;
}

function appendImplementationStatusNote(
  content: string,
  note: string | null,
): string {
  if (!note?.trim()) return content;
  return `${content.trim()}\n\n${note.trim()}\n`;
}

function buildFileContent(
  fileName: PlanningDocumentFileName,
  sections: Record<string, string>,
  blueprintText: string,
  taskCardsSummary: string | null,
  planningNotes: string | null,
): string {
  const header = `# ${fileName.replace(/\.md$/, "").replace(/_/g, " ")}\n\n`;
  const reverseEntry = Object.entries(SECTION_TO_PLANNING_FILE).find(
    ([, f]) => f === fileName,
  );
  if (reverseEntry) {
    const [sectionTitle] = reverseEntry;
    const body = sections[sectionTitle];
    if (body?.trim()) {
      let content = `${header}${body.trim()}\n`;
      if (fileName === "BUILD_PHASES.md" && taskCardsSummary) {
        content = appendTaskCardSummary(content, taskCardsSummary);
      }
      return content;
    }
  }

  if (fileName === "PRODUCT_REQUIREMENTS.md") {
    const pr = sections["Product Requirements"];
    const us = sections["User Stories"];
    if (pr || us) {
      return `${header}${[pr, us ? `## User Stories\n\n${us}` : ""].filter(Boolean).join("\n\n")}\n`;
    }
  }

  if (fileName === "FEATURE_ROADMAP.md") {
    const fr = sections["Feature Roadmap"];
    if (fr?.trim()) return `${header}${fr.trim()}\n`;
  }

  if (fileName === "ARCHITECTURE_PLAN.md") {
    const arch = sections["Architecture Plan"];
    const mod = sections["Suggested File / Module Plan"];
    if (arch || mod) {
      return `${header}${[arch, mod ? `## Suggested File / Module Plan\n\n${mod}` : ""].filter(Boolean).join("\n\n")}\n`;
    }
  }

  if (fileName === "DECISIONS_LOG.md") {
    const risks = sections["Risks / Open Questions"];
    if (risks?.trim()) {
      return `${header}${risks.trim()}\n`;
    }
    return `${header}_No decisions logged yet. Add notes as the project evolves._\n`;
  }

  if (fileName === "HANDOFF_NOTES.md") {
    const h = sections["Phase 1 Builder Handoff"];
    if (h?.trim()) {
      return appendTaskCardSummary(`${header}${h.trim()}\n`, taskCardsSummary);
    }
    if (taskCardsSummary) {
      return `${header}${taskCardsSummary}\n`;
    }
  }

  if (fileName === "CURRENT_STATUS.md") {
    const st = sections["Current Status"];
    const base = st?.trim()
      ? `${header}${st.trim()}\n`
      : `${header}**Status:** Blueprint imported — planning phase.\n`;
    return appendImplementationStatusNote(
      appendTaskCardSummary(base, taskCardsSummary),
      planningNotes,
    );
  }

  if (fileName === "BUILD_PHASES.md" && taskCardsSummary) {
    return `${header}${taskCardsSummary}\n`;
  }

  return `${header}_Section not found in blueprint. Review imported blueprint or regenerate._\n`;
}

export function buildPlanningDocumentsPreview(input: {
  blueprintText: string;
  projectSelected: boolean;
  taskCards?: BlueprintPhaseTaskCardsRecord | null;
  taskCardHandoff?: TaskCardBuilderHandoffRecord | null;
  taskImplementationReports?: Record<string, TaskImplementationReportRecord> | null;
  taskReconciliation?: BlueprintTaskReconciliationRecord | null;
  taskArtifactIndex?: TaskArtifactIndexRecord | null;
  changedFilesTaskLink?: ChangedFilesTaskLinkRecord | null;
  architectureHealth?: ArchitectureHealthRecord | null;
  architectureRefactorTaskCards?: ArchitectureRefactorTaskCardsRecord | null;
  architectureRefactorTaskHandoff?: ArchitectureRefactorTaskBuilderHandoffRecord | null;
  architectureRefactorImplementationReports?: Record<
    string,
    ArchitectureRefactorTaskImplementationReportRecord
  > | null;
}): PlanningDocumentsPreview {
  const sections = extractBlueprintSections(input.blueprintText);
  const truncationFlags: string[] = [];
  const taskCardsSummary = input.taskCards
    ? buildTaskCardsPlanningSummary(input.taskCards)
    : null;
  const handoffNote =
    input.taskCardHandoff && !input.taskCardHandoff.stale
      ? buildTaskCardHandoffPlanningNote({
          selectedTaskId: input.taskCardHandoff.selectedTaskId,
          target: input.taskCardHandoff.target,
          readiness: input.taskCardHandoff.readiness,
          stale: input.taskCardHandoff.stale,
        })
      : null;

  const implementationReports = input.taskImplementationReports
    ? Object.values(input.taskImplementationReports).filter((r) => !r.stale)
    : [];
  const implementationStatusNote = buildTaskImplementationPlanningNote({
    reports: implementationReports.map((r) => ({
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      builderSource: r.builderSource,
      savedAt: r.savedAt,
      markedImplementationReturned: r.markedImplementationReturned,
      markedReviewed: r.markedReviewed,
      stale: r.stale,
      reportExcerpt: r.reportExcerpt,
    })),
  });

  const reconciliationNote = input.taskReconciliation
    ? buildTaskReconciliationPlanningNote({
        recommendation: input.taskReconciliation.recommendation,
        generatedAt: input.taskReconciliation.generatedAt,
        taskCardCount: input.taskReconciliation.taskCardCount,
        missingProducerCount: input.taskReconciliation.missingProducerCount,
        statusInconsistencyCount: input.taskReconciliation.statusInconsistencyCount,
        stale: input.taskReconciliation.stale,
      })
    : null;

  const artifactIndexNote = input.taskArtifactIndex
    ? buildTaskArtifactIndexPlanningNote({
        recommendation: input.taskArtifactIndex.recommendation,
        generatedAt: input.taskArtifactIndex.generatedAt,
        taskCount: input.taskArtifactIndex.taskCount,
        unlinkedArtifactCount: input.taskArtifactIndex.unlinkedArtifactCount,
        staleArtifactCount: input.taskArtifactIndex.staleArtifactCount,
        stale: input.taskArtifactIndex.stale,
      })
    : null;

  const changedFilesLinkNote = input.changedFilesTaskLink
    ? buildChangedFilesTaskLinkPlanningNote(input.changedFilesTaskLink)
    : null;

  const architectureHealthNote = input.architectureHealth
    ? buildArchitectureHealthPlanningNote({
        recommendation: input.architectureHealth.recommendation,
        generatedAt: input.architectureHealth.generatedAt,
        fileCountScanned: input.architectureHealth.fileCountScanned,
        largestFilePath: input.architectureHealth.largestFilePath,
        largestFileLineCount: input.architectureHealth.largestFileLineCount,
        criticalCount: input.architectureHealth.criticalCount,
        warningCount: input.architectureHealth.warningCount,
        stale: input.architectureHealth.stale,
      })
    : null;

  const architectureRefactorTasksNote = buildArchitectureRefactorTaskPlanningSummary({
    record: input.architectureRefactorTaskCards ?? null,
  });

  const architectureRefactorHandoffNote =
    input.architectureRefactorTaskHandoff &&
    !input.architectureRefactorTaskHandoff.stale
      ? buildArchitectureRefactorHandoffPlanningNote({
          selectedTaskId: input.architectureRefactorTaskHandoff.selectedTaskId,
          taskTitle: input.architectureRefactorTaskHandoff.taskTitle,
          target: input.architectureRefactorTaskHandoff.target,
          readiness: input.architectureRefactorTaskHandoff.readiness,
          stale: input.architectureRefactorTaskHandoff.stale,
        })
      : null;

  const planningNotes = [
    implementationStatusNote,
    reconciliationNote,
    artifactIndexNote,
    changedFilesLinkNote,
    architectureHealthNote,
    architectureRefactorTasksNote !==
    "Architecture refactor task cards: not generated."
      ? architectureRefactorTasksNote
      : null,
    architectureRefactorHandoffNote,
  ]
    .filter(Boolean)
    .join("\n\n");

  const files: PlanningDocumentPreviewFile[] = PLANNING_DOCUMENT_FILE_NAMES.map(
    (fileName) => {
      const raw = buildFileContent(
        fileName,
        sections,
        input.blueprintText,
        taskCardsSummary,
        planningNotes || null,
      );
      const content = truncateContent(raw, fileName, truncationFlags);
      return {
        fileName,
        relativePath: `.nttc/planning/${fileName}`,
        content,
        truncationFlag: truncationFlags.some((f) => f.startsWith(fileName)),
      };
    },
  );

  if (input.taskCards?.allCardsMarkdown) {
    let raw = `# Task Cards\n\n${input.taskCards.allCardsMarkdown}\n`;
    if (handoffNote) {
      raw += `\n---\n\n${handoffNote}\n`;
    }
    if (implementationStatusNote) {
      raw += `\n---\n\n${implementationStatusNote}\n`;
    }
    if (reconciliationNote) {
      raw += `\n---\n\n${reconciliationNote}\n`;
    }
    if (artifactIndexNote) {
      raw += `\n---\n\n${artifactIndexNote}\n`;
    }
    const content = truncateContent(
      raw,
      TASK_CARDS_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: TASK_CARDS_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${TASK_CARDS_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(TASK_CARDS_PLANNING_FILE_NAME),
      ),
    });
  }

  if (
    input.taskCardHandoff &&
    !input.taskCardHandoff.stale &&
    input.taskCardHandoff.markdown
  ) {
    const raw = `# Current Task Handoff\n\n${input.taskCardHandoff.markdown}\n`;
    const content = truncateContent(
      raw,
      CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME),
      ),
    });
  }

  if (implementationReports.length > 0) {
    const body = buildTaskImplementationPlanningNote({
      reports: implementationReports.map((r) => ({
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        builderSource: r.builderSource,
        savedAt: r.savedAt,
        markedImplementationReturned: r.markedImplementationReturned,
        markedReviewed: r.markedReviewed,
        stale: r.stale,
        reportExcerpt: r.reportExcerpt,
      })),
    });
    if (body) {
      const raw = `# Implementation Reports\n\n${body}\n`;
      const content = truncateContent(
        raw,
        IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
        truncationFlags,
      );
      files.push({
        fileName: IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
        relativePath: `.nttc/planning/${IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME}`,
        content,
        truncationFlag: truncationFlags.some((f) =>
          f.startsWith(IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME),
        ),
      });
    }
  }

  if (input.taskReconciliation && !input.taskReconciliation.stale) {
    const summary = buildTaskReconciliationPlanningNote({
      recommendation: input.taskReconciliation.recommendation,
      generatedAt: input.taskReconciliation.generatedAt,
      taskCardCount: input.taskReconciliation.taskCardCount,
      missingProducerCount: input.taskReconciliation.missingProducerCount,
      statusInconsistencyCount: input.taskReconciliation.statusInconsistencyCount,
      stale: false,
    });
    const excerpt = input.taskReconciliation.previewExcerpt || input.taskReconciliation.markdown.slice(0, 1500);
    const raw = `# Task Reconciliation\n\n${summary}\n\n## Report excerpt\n\n${excerpt}\n`;
    const content = truncateContent(
      raw,
      TASK_RECONCILIATION_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: TASK_RECONCILIATION_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${TASK_RECONCILIATION_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(TASK_RECONCILIATION_PLANNING_FILE_NAME),
      ),
    });
  }

  if (input.taskArtifactIndex && !input.taskArtifactIndex.stale) {
    const summary = buildTaskArtifactIndexPlanningNote({
      recommendation: input.taskArtifactIndex.recommendation,
      generatedAt: input.taskArtifactIndex.generatedAt,
      taskCount: input.taskArtifactIndex.taskCount,
      unlinkedArtifactCount: input.taskArtifactIndex.unlinkedArtifactCount,
      staleArtifactCount: input.taskArtifactIndex.staleArtifactCount,
      stale: false,
    });
    const excerpt =
      input.taskArtifactIndex.previewExcerpt ||
      input.taskArtifactIndex.markdown.slice(0, 1500);
    const raw = `# Task Artifact Index\n\n${summary}\n\n## Report excerpt\n\n${excerpt}\n`;
    const content = truncateContent(
      raw,
      TASK_ARTIFACT_INDEX_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: TASK_ARTIFACT_INDEX_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${TASK_ARTIFACT_INDEX_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(TASK_ARTIFACT_INDEX_PLANNING_FILE_NAME),
      ),
    });
  }

  if (input.changedFilesTaskLink && !input.changedFilesTaskLink.stale) {
    const summary = buildChangedFilesTaskLinkPlanningNote(input.changedFilesTaskLink);
    const paths = input.changedFilesTaskLink.changedFilePaths ?? [];
    const pathLines = paths.slice(0, 40).map((p) => `- ${p}`);
    const raw = [
      "# Changed Files Task Links",
      "",
      summary ?? "",
      "",
      "## Linked paths (metadata only)",
      "",
      ...(pathLines.length ? pathLines : ["- None stored."]),
      input.changedFilesTaskLink.warnings?.length
        ? `\n## Scope warnings\n\n${input.changedFilesTaskLink.warnings.map((w) => `- ${w}`).join("\n")}\n`
        : "",
    ].join("\n");
    const content = truncateContent(
      raw,
      CHANGED_FILES_TASK_LINKS_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: CHANGED_FILES_TASK_LINKS_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${CHANGED_FILES_TASK_LINKS_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(CHANGED_FILES_TASK_LINKS_PLANNING_FILE_NAME),
      ),
    });
  }

  if (input.architectureHealth && !input.architectureHealth.stale) {
    const summary = buildArchitectureHealthPlanningNote({
      recommendation: input.architectureHealth.recommendation,
      generatedAt: input.architectureHealth.generatedAt,
      fileCountScanned: input.architectureHealth.fileCountScanned,
      largestFilePath: input.architectureHealth.largestFilePath,
      largestFileLineCount: input.architectureHealth.largestFileLineCount,
      criticalCount: input.architectureHealth.criticalCount,
      warningCount: input.architectureHealth.warningCount,
      stale: false,
    });
    const excerpt =
      input.architectureHealth.previewExcerpt ||
      input.architectureHealth.markdown.slice(0, 1500);
    const raw = `# Architecture Health\n\n${summary}\n\n## Report excerpt\n\n${excerpt}\n`;
    const content = truncateContent(
      raw,
      ARCHITECTURE_HEALTH_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: ARCHITECTURE_HEALTH_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${ARCHITECTURE_HEALTH_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(ARCHITECTURE_HEALTH_PLANNING_FILE_NAME),
      ),
    });
  }

  if (input.architectureRefactorTaskCards && !input.architectureRefactorTaskCards.stale) {
    const summary = buildArchitectureRefactorTaskPlanningSummary({
      record: input.architectureRefactorTaskCards,
    });
    const raw = `# Architecture Refactor Task Cards\n\n${summary}\n\n${input.architectureRefactorTaskCards.allCardsMarkdown}\n`;
    const content = truncateContent(
      raw,
      ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME),
      ),
    });
  }

  if (
    input.architectureRefactorTaskHandoff &&
    !input.architectureRefactorTaskHandoff.stale &&
    input.architectureRefactorTaskHandoff.markdown
  ) {
    const raw = `# Architecture Refactor Builder Handoff\n\n${input.architectureRefactorTaskHandoff.markdown}\n`;
    const content = truncateContent(
      raw,
      ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME,
      truncationFlags,
    );
    files.push({
      fileName: ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME,
      relativePath: `.nttc/planning/${ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME}`,
      content,
      truncationFlag: truncationFlags.some((f) =>
        f.startsWith(ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME),
      ),
    });
  }

  const refactorImplementationReports = input.architectureRefactorImplementationReports
    ? Object.values(input.architectureRefactorImplementationReports).filter((r) => !r.stale)
    : [];
  if (refactorImplementationReports.length > 0) {
    const body = buildArchitectureRefactorImplementationPlanningNote({
      reports: refactorImplementationReports.map((r) => ({
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        refactorTarget: r.refactorTarget,
        builderSource: r.builderSource,
        savedAt: r.savedAt,
        markedImplementationReturned: r.markedImplementationReturned,
        markedReviewed: r.markedReviewed,
        stale: r.stale,
        reportExcerpt: r.reportExcerpt,
      })),
    });
    if (body) {
      const raw = `# Architecture Refactor Implementation Reports\n\n${body}\n`;
      const content = truncateContent(
        raw,
        ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
        truncationFlags,
      );
      files.push({
        fileName: ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
        relativePath: `.nttc/planning/${ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME}`,
        content,
        truncationFlag: truncationFlags.some((f) =>
          f.startsWith(ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME),
        ),
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    files,
    truncationFlags,
    projectSelected: input.projectSelected,
  };
}
