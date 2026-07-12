/**
 * Stage 94: deterministic task-card fingerprint from planning text only.
 * Lightweight internal fingerprint — not a security hash.
 */

export interface TaskCardFingerprintInput {
  id: string;
  title: string;
  phase: string;
  goal: string;
  whatToBuild: string;
  whatNotToBuildYet: string;
  likelyFilesModules: string;
  producesCreates?: string;
  consumesDependsOn?: string;
  interfacesContracts?: string;
}

function normalizePart(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Deterministic djb2-style fingerprint prefixed with `tc-`. */
export function computeTaskCardFingerprint(input: TaskCardFingerprintInput): string {
  const payload = [
    normalizePart(input.id),
    normalizePart(input.title),
    normalizePart(input.phase),
    normalizePart(input.goal),
    normalizePart(input.whatToBuild),
    normalizePart(input.whatNotToBuildYet),
    normalizePart(input.likelyFilesModules),
    normalizePart(input.producesCreates),
    normalizePart(input.consumesDependsOn),
    normalizePart(input.interfacesContracts),
  ].join("\x1f");

  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  return `tc-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function resolveTaskCardFingerprint(
  card: TaskCardFingerprintInput & { taskCardFingerprint?: string },
): string {
  return card.taskCardFingerprint ?? computeTaskCardFingerprint(card);
}

export function fingerprintMatchesCard(
  card: TaskCardFingerprintInput & { taskCardFingerprint?: string },
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash) return false;
  return resolveTaskCardFingerprint(card) === storedHash;
}
