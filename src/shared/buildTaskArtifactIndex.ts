/**
 * Stage 94: rule-based Task Artifact Index builder.
 * Metadata only — no AI, no source reads.
 */

import { fingerprintMatchesCard, resolveTaskCardFingerprint } from "./computeTaskCardFingerprint";
import {
  CHANGED_FILES_TASK_LINK_DEFERRED_NOTE,
  CHANGED_FILES_TASK_LINK_NO_SCAN_NOTE,
} from "./changedFilesTaskLinkConstants";
import {
  TASK_ARTIFACT_INDEX_PURPOSE,
  TASK_ARTIFACT_INDEX_REPORT_TITLE,
  type TaskArtifactIndexRecommendation,
} from "./taskJoinKeyConstants";
import type {
  BlueprintPhaseTaskCard,
  BlueprintPhaseTaskCardsRecord,
  BlueprintTaskReconciliationRecord,
  BuilderResultRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
  ImplementationReviewRecord,
  TaskCardBuilderHandoffRecord,
  TaskImplementationReportRecord,
} from "./types";
import { TASK_CARD_STATUS_LABELS } from "./blueprintTaskCardConstants";

export interface TaskArtifactIndexFlag {
  category: string;
  message: string;
  taskId?: string;
}

export interface TaskArtifactIndexInput {
  taskCards: BlueprintPhaseTaskCardsRecord;
  taskCardHandoff: TaskCardBuilderHandoffRecord | null;
  implementationReports: Record<string, TaskImplementationReportRecord>;
  builderResult: BuilderResultRecord | null;
  implementationReview: ImplementationReviewRecord | null;
  taskReconciliation: BlueprintTaskReconciliationRecord | null;
  changedFilesScan: ChangedFilesScanResult | null;
  changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  filterTaskId: string | null;
}

export interface TaskArtifactIndexResult {
  generatedAt: string;
  taskCount: number;
  linkedArtifactCount: number;
  unlinkedArtifactCount: number;
  staleArtifactCount: number;
  recommendation: TaskArtifactIndexRecommendation;
  flags: TaskArtifactIndexFlag[];
  markdown: string;
}

function cardFingerprint(card: BlueprintPhaseTaskCard): string {
  return resolveTaskCardFingerprint(card);
}

function isHashStale(
  card: BlueprintPhaseTaskCard | undefined,
  storedHash: string | undefined,
): boolean {
  if (!card || !storedHash) return false;
  return !fingerprintMatchesCard(card, storedHash);
}

function buildTaskDetailSection(input: {
  card: BlueprintPhaseTaskCard;
  handoff: TaskCardBuilderHandoffRecord | null;
  report: TaskImplementationReportRecord | null;
  builderResult: BuilderResultRecord | null;
  implementationReview: ImplementationReviewRecord | null;
  reconciliation: BlueprintTaskReconciliationRecord | null;
  changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  flags: TaskArtifactIndexFlag[];
}): string {
  const {
    card,
    handoff,
    report,
    builderResult,
    implementationReview,
    reconciliation,
    changedFilesTaskLink,
  } = input;
  const fp = cardFingerprint(card);
  let staleLinked = 0;

  const handoffForTask =
    handoff && handoff.selectedTaskId === card.id ? handoff : null;
  if (handoffForTask) {
    if (handoffForTask.stale || isHashStale(card, handoffForTask.sourceTaskCardHash)) {
      staleLinked += 1;
    }
  }
  if (report) {
    if (report.stale || isHashStale(card, report.sourceTaskCardHash)) {
      staleLinked += 1;
    }
  }
  if (
    builderResult?.taskId === card.id &&
    isHashStale(card, builderResult.sourceTaskCardHash)
  ) {
    staleLinked += 1;
  }

  const reconWarnings =
    reconciliation && !reconciliation.stale
      ? reconciliation.missingProducerCount +
        reconciliation.statusInconsistencyCount +
        reconciliation.implementationInconsistencyCount
      : 0;

  const lines: string[] = [
    `## Task ${card.id} — ${card.title}`,
    "",
    "### Card",
    `- status: ${TASK_CARD_STATUS_LABELS[card.status]}`,
    `- quality: ${card.quality}`,
    `- fingerprint: ${fp}`,
    `- stale linked artifacts count: ${staleLinked}`,
    "",
    "### Handoff",
    handoffForTask
      ? [
          `- exists: yes`,
          `- target: ${handoffForTask.target}`,
          `- strictness: ${handoffForTask.strictness}`,
          `- generated time: ${handoffForTask.generatedAt}`,
          `- stale: ${handoffForTask.stale || isHashStale(card, handoffForTask.sourceTaskCardHash) ? "yes" : "no"}`,
        ].join("\n")
      : "- exists: no",
    "",
    "### Implementation Report",
    report
      ? [
          `- exists: yes`,
          `- source: ${report.builderSource}`,
          `- saved time: ${report.savedAt}`,
          `- files mentioned: ${report.detectedFilesChanged.length}`,
          `- validation mentioned: ${report.detectedValidationMentions.length > 0 ? "yes" : "no"}`,
          `- risks/blockers: ${report.detectedRisksBlockers.length > 0 ? "yes" : "no"}`,
          `- stale: ${report.stale || isHashStale(card, report.sourceTaskCardHash) ? "yes" : "no"}`,
        ].join("\n")
      : "- exists: no",
    "",
    "### Implementation Review",
    implementationReview &&
    (implementationReview.taskId === card.id ||
      builderResult?.taskId === card.id)
      ? [
          `- exists: yes`,
          `- recommendation: ${implementationReview.recommendation}`,
          `- generated time: ${implementationReview.generatedAt}`,
          `- stale: ${isHashStale(card, implementationReview.sourceTaskCardHash) ? "yes" : "no"}`,
        ].join("\n")
      : "- exists: no",
    "",
    "### Reconciliation",
    `- latest warning count: ${reconWarnings}`,
    `- missing producer count: ${reconciliation?.missingProducerCount ?? 0}`,
    `- status consistency warnings: ${reconciliation?.statusInconsistencyCount ?? 0}`,
    "",
    "### Changed Files Link",
    changedFilesTaskLink?.taskId === card.id
      ? [
          `- Linked: yes`,
          `- Changed files count: ${changedFilesTaskLink.changedFilesCount ?? 0}`,
          `- Linked time: ${changedFilesTaskLink.linkedAt}`,
          `- Stale: ${changedFilesTaskLink.stale ? "yes" : "no"}`,
          `- Scope warnings: ${changedFilesTaskLink.warnings?.length ?? 0}`,
        ].join("\n")
      : "- Linked: no",
    "",
  ];
  return lines.join("\n");
}

export function buildTaskArtifactIndex(
  input: TaskArtifactIndexInput,
): TaskArtifactIndexResult {
  const generatedAt = new Date().toISOString();
  const flags: TaskArtifactIndexFlag[] = [];
  const cardById = new Map(input.taskCards.cards.map((c) => [c.id, c]));
  const cards = input.filterTaskId
    ? input.taskCards.cards.filter((c) => c.id === input.filterTaskId)
    : input.taskCards.cards;

  let linkedArtifactCount = 0;
  let staleArtifactCount = 0;

  for (const card of input.taskCards.cards) {
    const report = input.implementationReports[card.id];
    const handoffForTask =
      input.taskCardHandoff?.selectedTaskId === card.id
        ? input.taskCardHandoff
        : null;

    if (!handoffForTask) {
      flags.push({
        category: "missing-handoff",
        message: `Task card ${card.id} has no Task Builder Handoff.`,
        taskId: card.id,
      });
    } else {
      linkedArtifactCount += 1;
      if (
        handoffForTask.stale ||
        isHashStale(card, handoffForTask.sourceTaskCardHash)
      ) {
        staleArtifactCount += 1;
        flags.push({
          category: "stale-handoff",
          message: `Handoff for ${card.id} is stale or fingerprint mismatch.`,
          taskId: card.id,
        });
      }
      if (!handoffForTask.sourceTaskCardHash) {
        flags.push({
          category: "legacy-metadata",
          message: `Handoff for ${card.id} lacks task join keys (pre-Stage 94).`,
          taskId: card.id,
        });
      }
    }

    if (handoffForTask && !report) {
      flags.push({
        category: "missing-report",
        message: `Handoff exists for ${card.id} but no implementation report.`,
        taskId: card.id,
      });
    }

    if (report) {
      linkedArtifactCount += 1;
      if (report.stale || isHashStale(card, report.sourceTaskCardHash)) {
        staleArtifactCount += 1;
        flags.push({
          category: "stale-report",
          message: `Implementation report for ${card.id} is stale or fingerprint mismatch.`,
          taskId: card.id,
        });
      }
      if (
        card.status !== "implementation-returned" &&
        card.status !== "reviewed"
      ) {
        flags.push({
          category: "status-mismatch",
          message: `Implementation report exists for ${card.id} but task status is ${TASK_CARD_STATUS_LABELS[card.status]}.`,
          taskId: card.id,
        });
      }
      if (card.status === "reviewed" && report.detectedRisksBlockers.length > 0) {
        flags.push({
          category: "reviewed-with-risks",
          message: `Task ${card.id} marked Reviewed but report mentions risks/blockers.`,
          taskId: card.id,
        });
      }
      if (
        card.status === "reviewed" &&
        report.detectedValidationMentions.length === 0
      ) {
        flags.push({
          category: "reviewed-no-validation",
          message: `Task ${card.id} marked Reviewed but report lacks validation mentions.`,
          taskId: card.id,
        });
      }
      if (!report.sourceTaskCardHash) {
        flags.push({
          category: "legacy-metadata",
          message: `Implementation report for ${card.id} lacks task join keys (pre-Stage 94).`,
          taskId: card.id,
        });
      }
    }

    if (card.status === "reviewed" && !report) {
      flags.push({
        category: "reviewed-no-report",
        message: `Task ${card.id} marked Reviewed but no implementation report stored.`,
        taskId: card.id,
      });
    }
    if (card.status === "implementation-returned" && !report) {
      flags.push({
        category: "returned-no-report",
        message: `Task ${card.id} marked Implementation Returned but no report stored.`,
        taskId: card.id,
      });
    }
    if (card.status === "sent-to-builder" && !handoffForTask) {
      flags.push({
        category: "sent-no-handoff",
        message: `Task ${card.id} marked Sent to builder but no handoff stored.`,
        taskId: card.id,
      });
    }
  }

  if (input.taskCardHandoff && !cardById.has(input.taskCardHandoff.selectedTaskId)) {
    flags.push({
      category: "orphan-handoff",
      message: `Handoff references missing task ID ${input.taskCardHandoff.selectedTaskId}.`,
      taskId: input.taskCardHandoff.selectedTaskId,
    });
  }

  for (const [taskId, report] of Object.entries(input.implementationReports)) {
    if (!cardById.has(taskId)) {
      flags.push({
        category: "orphan-report",
        message: `Implementation report references missing task ID ${taskId}.`,
        taskId,
      });
      if (report.stale) staleArtifactCount += 1;
    }
  }

  if (
    input.taskCardHandoff &&
    Object.keys(input.implementationReports).length > 0
  ) {
    const handoffId = input.taskCardHandoff.selectedTaskId;
    for (const [reportTaskId] of Object.entries(input.implementationReports)) {
      if (reportTaskId !== handoffId && !input.filterTaskId) {
        flags.push({
          category: "handoff-report-mismatch",
          message: `Active handoff is for ${handoffId} but report exists for ${reportTaskId}.`,
          taskId: reportTaskId,
        });
      }
    }
  }

  const staged = input.builderResult;
  if (staged?.responseType === "Implementation report") {
    linkedArtifactCount += 1;
    if (!staged.taskId) {
      flags.push({
        category: "unlinked-builder-result",
        message: "Builder Result staged without task ID join key.",
      });
    } else {
      const card = cardById.get(staged.taskId);
      if (!card) {
        flags.push({
          category: "orphan-builder-result",
          message: `Staged Builder Result references missing task ID ${staged.taskId}.`,
          taskId: staged.taskId,
        });
      } else if (isHashStale(card, staged.sourceTaskCardHash)) {
        staleArtifactCount += 1;
        flags.push({
          category: "stale-builder-result",
          message: `Staged Builder Result fingerprint mismatch for ${staged.taskId}.`,
          taskId: staged.taskId,
        });
      }
    }
  }

  if (
    staged?.responseType === "Implementation report" &&
    input.implementationReview &&
    input.implementationReview.importedBuilderResultId === staged.id &&
    !input.implementationReview.taskId
  ) {
    flags.push({
      category: "review-missing-task",
      message: "Implementation Review exists but lacks task ID metadata.",
    });
  }

  if (
    staged?.responseType === "Implementation report" &&
    staged.taskId &&
    !input.implementationReview
  ) {
    flags.push({
      category: "review-not-run",
      message: `Implementation report staged for ${staged.taskId} but no Implementation Review run.`,
      taskId: staged.taskId,
    });
  }

  const link = input.changedFilesTaskLink;
  if (input.changedFilesScan?.scannedAt && input.changedFilesScan.totalCount > 0 && !link) {
    flags.push({
      category: "unlinked-changed-files",
      message: "Changed-files metadata exists but is not linked to a Blueprint task ID.",
    });
  }
  if (link) {
    linkedArtifactCount += 1;
    const linkCard = cardById.get(link.taskId);
    if (!linkCard) {
      flags.push({
        category: "orphan-changed-files-link",
        message: `Changed-files link references missing task ID ${link.taskId}.`,
        taskId: link.taskId,
      });
    } else if (link.stale || isHashStale(linkCard, link.sourceTaskCardHash)) {
      staleArtifactCount += 1;
      flags.push({
        category: "stale-changed-files-link",
        message: `Changed-files link for ${link.taskId} is stale or fingerprint mismatch.`,
        taskId: link.taskId,
      });
    } else if ((link.warnings?.length ?? 0) > 0) {
      flags.push({
        category: "changed-files-scope",
        message: `Changed-files link for ${link.taskId} has ${link.warnings!.length} scope warning(s).`,
        taskId: link.taskId,
      });
    }
    if (
      link.changedFilesGeneratedAt &&
      input.changedFilesScan?.scannedAt &&
      link.changedFilesGeneratedAt !== input.changedFilesScan.scannedAt
    ) {
      flags.push({
        category: "stale-changed-files-scan",
        message: "Changed-files scan is newer than the linked metadata snapshot.",
        taskId: link.taskId,
      });
    }
  }

  const unlinkedArtifactCount = flags.filter((f) =>
    /orphan|unlinked|legacy-metadata|missing-task|unlinked-changed-files/.test(f.category),
  ).length;

  let recommendation: TaskArtifactIndexRecommendation = "Deck traceable";
  if (flags.some((f) => f.category === "sent-no-handoff" && cardById.size > 0)) {
    recommendation = "Blocked";
  } else if (staleArtifactCount > 0) {
    recommendation = "Resolve stale artifacts";
  } else if (unlinkedArtifactCount > 0) {
    recommendation = "Needs relinking";
  } else if (
    flags.some((f) =>
      /status-mismatch|reviewed-no-report|returned-no-report|review-not-run/.test(
        f.category,
      ),
    )
  ) {
    recommendation = "Review implementation links";
  } else if (flags.length > 0) {
    recommendation = "Needs relinking";
  }

  const taskDetails = cards
    .map((card) =>
      buildTaskDetailSection({
        card,
        handoff: input.taskCardHandoff,
        report: input.implementationReports[card.id] ?? null,
        builderResult: input.builderResult,
        implementationReview: input.implementationReview,
        reconciliation: input.taskReconciliation,
        changedFilesTaskLink: input.changedFilesTaskLink,
        flags,
      }),
    )
    .join("\n");

  const recommendedFixes = flags.length
    ? flags.slice(0, 12).map((f) => `- ${f.message}`)
    : ["- No fixes required — artifact links look consistent."];

  const markdown = [
    TASK_ARTIFACT_INDEX_REPORT_TITLE,
    "",
    TASK_ARTIFACT_INDEX_PURPOSE,
    "",
    "## Summary",
    "",
    `- Tasks indexed: ${input.taskCards.cards.length}`,
    `- Linked artifacts: ${linkedArtifactCount}`,
    `- Unlinked artifact flags: ${unlinkedArtifactCount}`,
    `- Stale artifact flags: ${staleArtifactCount}`,
    `- Recommendation: **${recommendation}**`,
    input.filterTaskId ? `- Filter: ${input.filterTaskId} only` : "- Filter: all tasks",
    "",
    "## Task Coverage",
    "",
    ...input.taskCards.cards.map(
      (c) =>
        `- **${c.id}** (${c.title}) — handoff: ${input.taskCardHandoff?.selectedTaskId === c.id ? "yes" : "no"}, report: ${input.implementationReports[c.id] ? "yes" : "no"}`,
    ),
    "",
    "## Unlinked Artifacts",
    "",
    ...(flags.filter((f) => /orphan|unlinked|legacy/.test(f.category)).length
      ? flags
          .filter((f) => /orphan|unlinked|legacy/.test(f.category))
          .map((f) => `- ${f.message}`)
      : ["- None detected."]),
    "",
    "## Stale Artifacts",
    "",
    ...(flags.filter((f) => /stale/.test(f.category)).length
      ? flags.filter((f) => /stale/.test(f.category)).map((f) => `- ${f.message}`)
      : ["- None detected."]),
    "",
    "## Changed Files Link",
    "",
    ...(link
      ? [
          `- Linked task: **${link.taskId}**${link.taskTitle ? ` (${link.taskTitle})` : ""}`,
          `- Changed files count: ${link.changedFilesCount ?? 0}`,
          `- Linked time: ${link.linkedAt}`,
          `- Stale: ${link.stale ? "yes" : "no"}`,
          `- Scope warnings: ${link.warnings?.length ?? 0}`,
          ...(link.warnings?.length
            ? link.warnings.map((w) => `  - ${w}`)
            : ["- Scope warnings: none"]),
        ]
      : input.changedFilesScan?.scannedAt
        ? [
            `- ${CHANGED_FILES_TASK_LINK_DEFERRED_NOTE}`,
            `- Last changed-files scan: ${input.changedFilesScan.scannedAt} (${input.changedFilesScan.totalCount} file(s)).`,
          ]
        : [`- ${CHANGED_FILES_TASK_LINK_NO_SCAN_NOTE}`]),
    "",
    "## Task Details",
    "",
    taskDetails,
    "## Recommended Fixes",
    "",
    ...recommendedFixes,
    "",
    "## Recommendation",
    "",
    `**${recommendation}**`,
    "",
    "## Safety Reminder",
    "",
    "This index is rule-based metadata only. It does not call AI, read project source files, edit files, run commands, or send data automatically.",
    "",
  ].join("\n");

  return {
    generatedAt,
    taskCount: input.taskCards.cards.length,
    linkedArtifactCount,
    unlinkedArtifactCount,
    staleArtifactCount,
    recommendation,
    flags,
    markdown,
  };
}

export function buildTaskArtifactIndexPlanningNote(input: {
  recommendation: TaskArtifactIndexRecommendation;
  generatedAt: string;
  taskCount: number;
  unlinkedArtifactCount: number;
  staleArtifactCount: number;
  stale: boolean;
}): string {
  if (input.stale) {
    return "_Task Artifact Index is stale — regenerate on the Blueprint tab._";
  }
  return [
    "### Task Artifact Index",
    "",
    `- Generated: ${input.generatedAt}`,
    `- Tasks: ${input.taskCount}`,
    `- Recommendation: ${input.recommendation}`,
    `- Unlinked flags: ${input.unlinkedArtifactCount}`,
    `- Stale flags: ${input.staleArtifactCount}`,
  ].join("\n");
}
