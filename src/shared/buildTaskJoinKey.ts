/**
 * Stage 94: helpers to build task artifact join-key metadata.
 */

import { resolveTaskCardFingerprint } from "./computeTaskCardFingerprint";
import { TASK_ARTIFACT_KINDS, type TaskArtifactKind } from "./taskJoinKeyConstants";
import type { BlueprintPhaseTaskCard } from "./types";

export interface TaskArtifactJoinKey {
  taskId?: string;
  taskTitle?: string;
  taskPhase?: string;
  taskArtifactKind?: string;
  sourceTaskCardGeneratedAt?: string;
  sourceTaskCardHash?: string;
}

export function buildJoinKeyFromTaskCard(
  card: BlueprintPhaseTaskCard,
  sourceTaskCardsGeneratedAt: string | null,
  taskArtifactKind: TaskArtifactKind,
): TaskArtifactJoinKey {
  const hash = resolveTaskCardFingerprint(card);
  return {
    taskId: card.id,
    taskTitle: card.title,
    taskPhase: card.phase,
    taskArtifactKind,
    sourceTaskCardGeneratedAt: sourceTaskCardsGeneratedAt ?? undefined,
    sourceTaskCardHash: hash,
  };
}

export { computeTaskCardFingerprint } from "./computeTaskCardFingerprint";
export { TASK_ARTIFACT_KINDS };
