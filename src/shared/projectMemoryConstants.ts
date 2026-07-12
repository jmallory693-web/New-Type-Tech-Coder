/** Stage 50: controlled project documentation folder inside the selected project. */
export const NTTC_MEMORY_FOLDER = ".nttc";

export const PROJECT_MEMORY_FILE_NAMES = [
  "NTTC_PLAN.md",
  "NTTC_DONE.md",
  "NTTC_CONTEXT.md",
  "NTTC_REVIEW_HANDOFF.md",
  "NTTC_THREAD_EXPORT.md",
] as const;

export type ProjectMemoryFileName = (typeof PROJECT_MEMORY_FILE_NAMES)[number];

export const CURRENT_NTTC_STAGE_LABEL =
  "Stage 50 — NTTC Project Memory Folder / Markdown Export";

export const PROJECT_MEMORY_SAFETY_NOTE =
  "These are markdown planning files only. NTTC will not edit source code.";

export const PROJECT_MEMORY_DO_NOT_DO = [
  "Do not enable live Qwen execution.",
  "Do not add edit mode unless specifically staged later.",
  "Do not add arbitrary terminal access or custom command typing.",
  "Do not bypass Safety Backup before risky changes.",
  "Do not edit source code without an approved future stage.",
  "Do not install packages automatically from NTTC.",
  "Do not write outside the `.nttc/` documentation folder.",
];

export function isProjectMemoryFileName(
  value: string,
): value is ProjectMemoryFileName {
  return (PROJECT_MEMORY_FILE_NAMES as readonly string[]).includes(value);
}
