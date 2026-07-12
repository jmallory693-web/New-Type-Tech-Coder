/** Stage 67: Manual Patch Draft Import — labels and UI copy only. */

import type {
  ImportedPatchDraftSource,
  ImportedPatchDraftType,
} from "./types";

export const IMPORTED_PATCH_DRAFT_SOURCES: ImportedPatchDraftSource[] = [
  "Cursor",
  "Codex",
  "Claude",
  "ChatGPT",
  "Grok",
  "Qwen",
  "Human programmer",
  "Other",
];

export const IMPORTED_PATCH_DRAFT_TYPES: ImportedPatchDraftType[] = [
  "Patch draft",
  "Diff-like draft",
  "Code snippet proposal",
  "Implementation plan",
  "Revision request",
  "Unknown",
];

export const IMPORTED_PATCH_DRAFT_NOTE =
  "Paste an outside patch draft here. NTTC will not apply it. Use Patch Draft Safety Review before trusting it.";

export const IMPORTED_PATCH_DRAFT_NO_APPLY_WARNING =
  "Imported drafts are proposals only. NTTC has not verified the code and did not apply the patch.";

export const PATCH_DRAFT_SAFETY_REVIEW_TARGETS = [
  { id: "nttc-patch-draft" as const, label: "NTTC Patch Draft" },
  { id: "imported-patch-draft" as const, label: "Imported Patch Draft" },
];
