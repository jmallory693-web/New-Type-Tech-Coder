/**
 * Stage 106: join-key metadata for architecture refactor task artifacts.
 */

import { TASK_ARTIFACT_KINDS, type TaskArtifactKind } from "../taskJoinKeyConstants";
import type { ArchitectureRefactorTaskCard } from "../types";

export interface RefactorTaskArtifactJoinKey {
  taskId?: string;
  taskTitle?: string;
  taskPhase?: string;
  taskArtifactKind?: string;
  sourceTaskCardGeneratedAt?: string;
  sourceTaskCardHash?: string;
}

export function buildJoinKeyFromRefactorTaskCard(
  card: ArchitectureRefactorTaskCard,
  sourceRefactorCardsGeneratedAt: string | null,
  taskArtifactKind: TaskArtifactKind | string,
): RefactorTaskArtifactJoinKey {
  const hash = `${card.id}:${card.updatedAt}:${card.refactorTarget}`.slice(0, 120);
  return {
    taskId: card.id,
    taskTitle: card.title,
    taskPhase: "architecture-refactor",
    taskArtifactKind,
    sourceTaskCardGeneratedAt: sourceRefactorCardsGeneratedAt ?? undefined,
    sourceTaskCardHash: hash,
  };
}

export { TASK_ARTIFACT_KINDS };
