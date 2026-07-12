/** Stage 96: planning-doc summary for changed-files task link (metadata only). */

import type { ChangedFilesTaskLinkRecord } from "./types";

export function buildChangedFilesTaskLinkPlanningNote(
  link: ChangedFilesTaskLinkRecord | null,
): string | null {
  if (!link) return null;
  if (link.stale) {
    return "_Changed-files task link is stale — relink on the Audit tab._";
  }
  const warningLine =
    link.warnings && link.warnings.length > 0
      ? `- Scope warnings: ${link.warnings.length}`
      : "- Scope warnings: 0";
  return [
    "### Changed Files Task Link",
    "",
    `- Task: ${link.taskId}${link.taskTitle ? ` — ${link.taskTitle}` : ""}`,
    `- Linked: ${link.linkedAt}`,
    `- Changed files: ${link.changedFilesCount ?? 0}`,
    warningLine,
  ].join("\n");
}
