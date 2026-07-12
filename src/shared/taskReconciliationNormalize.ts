/** Stage 92: deterministic text normalization for task reconciliation. */

export function normalizeContractItem(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/[`"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractContractItems(text: string | undefined | null): string[] {
  if (!text?.trim()) return [];
  const items: string[] = [];
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    const cleaned = trimmed.replace(/^[-*•]\s*/, "").trim();
    if (cleaned.length >= 3) items.push(cleaned);
  }
  return items;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeContractItem(text)
      .split(/[^a-z0-9/]+/)
      .filter((t) => t.length > 2),
  );
}

export function tokenOverlap(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const t of setA) {
    if (setB.has(t)) shared += 1;
  }
  return shared / Math.min(setA.size, setB.size);
}

const VAGUE_PATTERNS = [
  /^blueprint\b/i,
  /^project\b/i,
  /^phase\b/i,
  /^context\b/i,
  /^intake\b/i,
  /^constraints\b/i,
  /^scope\b/i,
  /^earlier\b/i,
  /^shared\b/i,
  /^outputs?\b/i,
  /^planning\b/i,
];

export function isVagueContractItem(item: string): boolean {
  const norm = normalizeContractItem(item);
  if (norm.length < 8) return true;
  return VAGUE_PATTERNS.some((p) => p.test(norm));
}

export function itemHasProducer(
  item: string,
  producedItems: string[],
): boolean {
  const norm = normalizeContractItem(item);
  if (isVagueContractItem(item)) return true;

  for (const prod of producedItems) {
    const pNorm = normalizeContractItem(prod);
    if (!pNorm) continue;
    if (pNorm.includes(norm) || norm.includes(pNorm)) return true;
    if (tokenOverlap(norm, pNorm) >= 0.45) return true;
  }
  return false;
}

export function itemsLikelyDuplicate(a: string, b: string): boolean {
  const na = normalizeContractItem(a);
  const nb = normalizeContractItem(b);
  if (na === nb) return true;
  if (na.length < 5 || nb.length < 5) return false;
  return tokenOverlap(na, nb) >= 0.7;
}
