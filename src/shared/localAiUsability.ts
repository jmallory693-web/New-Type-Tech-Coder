/** Stage 63: live Ollama usability helpers (messages/rules only). */

export const CONTEXT_SLOW_WARNING =
  "This context may be slow for local models. For faster results, try 1 file, 25–50 lines, and optional excerpts off.";

export const LOCAL_AI_SLOW_REMINDER =
  "Large local models can take 1–2+ minutes.";

export const FAST_DRAFT_SETUP_MESSAGE =
  "Fast Draft Setup reduces context size. Select one focused file, regenerate the Code Context Pack, then try Patch Draft again.";

export const PATCH_DRAFT_FAILURE_SAFETY_REVIEW_NOTE =
  "Patch Draft did not complete, so Patch Draft Safety Review is not available yet. Try a smaller context pack or faster model, then generate Patch Draft again.";

export function isCodeContextLikelySlow(input: {
  selectedFileCount: number;
  maxLinesPerFile: number;
  packCharCount: number;
  patchDraftOptionalExcerpts?: boolean;
}): boolean {
  return (
    input.selectedFileCount > 1 ||
    input.maxLinesPerFile > 100 ||
    input.packCharCount > 20_000 ||
    Boolean(input.patchDraftOptionalExcerpts)
  );
}

export function isPatchDraftFailureMessage(
  message: string | null | undefined,
): boolean {
  if (!message?.trim()) return false;
  if (/ready|succeeded|copied to clipboard/i.test(message)) return false;
  return /timed out|timeout|failed|did not complete|not ready|blocked/i.test(
    message,
  );
}

export function formatLocalAiProgressMessage(input: {
  label: string;
  modelName: string;
  baseUrl: string;
  elapsedSeconds: number;
}): string {
  const baseUrl =
    input.baseUrl.trim().length > 0 ? ` at ${input.baseUrl.trim()}` : "";
  return `${input.label} is working with ${input.modelName}${baseUrl}… ${input.elapsedSeconds}s elapsed. ${LOCAL_AI_SLOW_REMINDER}`;
}

export function elapsedSecondsSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}
