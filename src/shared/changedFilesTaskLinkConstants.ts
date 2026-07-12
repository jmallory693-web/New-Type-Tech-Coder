/** Stage 96: Changed Files → Blueprint Task Link constants (metadata only). */

export const CHANGED_FILES_BROAD_PATH_PATTERNS = [
  /\bApp\.tsx\b/i,
  /\bmain\/index\.ts\b/i,
  /\bsrc\/main\/index\.ts\b/i,
  /\bpackage\.json\b/i,
  /\bpackage-lock\.json\b/i,
  /\bvite\.config/i,
  /\belectron-builder/i,
  /\btsconfig\.[^/\\]+$/i,
] as const;

export const CHANGED_FILES_SCOPE_COUNT_THRESHOLD = 8;
export const CHANGED_FILES_SCOPE_MULTIPLIER = 2;

export const CHANGED_FILES_TASK_LINK_DEFERRED_NOTE =
  "Changed-files metadata exists but is not linked to a Blueprint task ID.";

export const CHANGED_FILES_TASK_LINK_NO_SCAN_NOTE =
  "No changed-files scan available.";

export const CHANGED_FILES_TASK_LINK_SOURCES = [
  "manual-user-selection",
  "active-task-suggestion",
] as const;

export type ChangedFilesTaskLinkSource =
  (typeof CHANGED_FILES_TASK_LINK_SOURCES)[number];
