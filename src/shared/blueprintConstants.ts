/** Stage 80: Project Blueprint Planner constants (planning documents only). */

export const BLUEPRINT_PLANNING_SUBFOLDER = "planning";

export const PLANNING_DOCUMENT_FILE_NAMES = [
  "PROJECT_BRIEF.md",
  "PRODUCT_REQUIREMENTS.md",
  "FEATURE_ROADMAP.md",
  "DATA_MODEL.md",
  "SCREEN_FLOW.md",
  "ARCHITECTURE_PLAN.md",
  "BUILD_PHASES.md",
  "VALIDATION_PLAN.md",
  "AI_TEAM_ROLES.md",
  "HANDOFF_NOTES.md",
  "CURRENT_STATUS.md",
  "DECISIONS_LOG.md",
] as const;

/** Stage 86: optional task cards export — only during confirmed planning save. */
export const TASK_CARDS_PLANNING_FILE_NAME = "TASK_CARDS.md" as const;

/** Stage 88: optional current task handoff export — only during confirmed planning save. */
export const CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME =
  "CURRENT_TASK_HANDOFF.md" as const;

/** Stage 90: optional implementation reports export — only during confirmed planning save. */
export const IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME =
  "IMPLEMENTATION_REPORTS.md" as const;

/** Stage 92: optional task reconciliation export — only during confirmed planning save. */
export const TASK_RECONCILIATION_PLANNING_FILE_NAME =
  "TASK_RECONCILIATION.md" as const;

/** Stage 94: optional task artifact index export — only during confirmed planning save. */
export const TASK_ARTIFACT_INDEX_PLANNING_FILE_NAME =
  "TASK_ARTIFACT_INDEX.md" as const;

/** Stage 96: optional changed-files task link export — only during confirmed planning save. */
export const CHANGED_FILES_TASK_LINKS_PLANNING_FILE_NAME =
  "CHANGED_FILES_TASK_LINKS.md" as const;

/** Stage 98: optional architecture health export — only during confirmed planning save. */
export const ARCHITECTURE_HEALTH_PLANNING_FILE_NAME =
  "ARCHITECTURE_HEALTH.md" as const;

/** Stage 102: optional architecture refactor task cards export — only during confirmed planning save. */
export const ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME =
  "ARCHITECTURE_REFACTOR_TASKS.md" as const;

/** Stage 104: optional architecture refactor handoff export — only during confirmed planning save. */
export const ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME =
  "ARCHITECTURE_REFACTOR_HANDOFF.md" as const;

/** Stage 106: optional architecture refactor implementation reports export — only during confirmed planning save. */
export const ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME =
  "ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS.md" as const;

export const ALL_PLANNING_DOCUMENT_FILE_NAMES = [
  ...PLANNING_DOCUMENT_FILE_NAMES,
  TASK_CARDS_PLANNING_FILE_NAME,
  CURRENT_TASK_HANDOFF_PLANNING_FILE_NAME,
  IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
  TASK_RECONCILIATION_PLANNING_FILE_NAME,
  TASK_ARTIFACT_INDEX_PLANNING_FILE_NAME,
  CHANGED_FILES_TASK_LINKS_PLANNING_FILE_NAME,
  ARCHITECTURE_HEALTH_PLANNING_FILE_NAME,
  ARCHITECTURE_REFACTOR_TASKS_PLANNING_FILE_NAME,
  ARCHITECTURE_REFACTOR_HANDOFF_PLANNING_FILE_NAME,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS_PLANNING_FILE_NAME,
] as const;

export type PlanningDocumentFileName =
  (typeof PLANNING_DOCUMENT_FILE_NAMES)[number];

export const BLUEPRINT_REQUIRED_SECTIONS = [
  "Project Brief",
  "Product Requirements",
  "User Stories",
  "Feature Roadmap",
  "Data Model",
  "Screen / Workflow Flow",
  "Architecture Plan",
  "Suggested File / Module Plan",
  "Build Phases",
  "Validation Plan",
  "Risks / Open Questions",
  "AI Team Roles",
  "Phase 1 Builder Handoff",
  "Current Status",
] as const;

export type BlueprintRequiredSection =
  (typeof BLUEPRINT_REQUIRED_SECTIONS)[number];

export const BLUEPRINT_PROJECT_TYPE_OPTIONS = [
  { id: "desktop-app", label: "Desktop app" },
  { id: "web-app", label: "Web app" },
  { id: "game", label: "Game" },
  { id: "automation-tool", label: "Automation tool" },
  { id: "data-tool", label: "Data tool" },
  { id: "writing-publishing", label: "Writing/publishing tool" },
  { id: "business-internal", label: "Business/internal tool" },
  { id: "unknown", label: "Unknown / decide later" },
] as const;

export const BLUEPRINT_TARGET_USER_OPTIONS = [
  { id: "just-me", label: "Just me" },
  { id: "small-team", label: "Small team" },
  { id: "public-users", label: "Public users" },
  { id: "client-customer", label: "Client/customer" },
  { id: "family-friend", label: "Family/friend" },
  { id: "unknown", label: "Unknown" },
] as const;

export const BLUEPRINT_TECHNICAL_COMFORT_OPTIONS = [
  { id: "non-coder", label: "Non-coder" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "developer", label: "Developer" },
] as const;

export const BLUEPRINT_BUILD_STYLE_OPTIONS = [
  { id: "safe-phased", label: "Safe phased build" },
  { id: "fast-prototype", label: "Fast prototype" },
  { id: "small-model-friendly", label: "Small-model friendly" },
  { id: "production-minded", label: "Production-minded" },
  { id: "unknown", label: "Unknown" },
] as const;

export const BLUEPRINT_SOURCE_OPTIONS = [
  { id: "local-planner-ai", label: "Local Planner AI" },
  { id: "ollama", label: "Ollama" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "grok", label: "Grok" },
  { id: "qwen", label: "Qwen" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex" },
  { id: "human", label: "Human" },
  { id: "other", label: "Other" },
] as const;

export type BlueprintProjectType =
  (typeof BLUEPRINT_PROJECT_TYPE_OPTIONS)[number]["id"];
export type BlueprintTargetUser =
  (typeof BLUEPRINT_TARGET_USER_OPTIONS)[number]["id"];
export type BlueprintTechnicalComfort =
  (typeof BLUEPRINT_TECHNICAL_COMFORT_OPTIONS)[number]["id"];
export type BlueprintBuildStyle =
  (typeof BLUEPRINT_BUILD_STYLE_OPTIONS)[number]["id"];
export type BlueprintSource =
  (typeof BLUEPRINT_SOURCE_OPTIONS)[number]["id"];

export const DEFAULT_BLUEPRINT_PROJECT_TYPE: BlueprintProjectType = "unknown";
export const DEFAULT_BLUEPRINT_TARGET_USER: BlueprintTargetUser = "unknown";
export const DEFAULT_BLUEPRINT_TECHNICAL_COMFORT: BlueprintTechnicalComfort =
  "non-coder";
export const DEFAULT_BLUEPRINT_BUILD_STYLE: BlueprintBuildStyle =
  "safe-phased";
export const DEFAULT_BLUEPRINT_SOURCE: BlueprintSource = "other";

export const BLUEPRINT_IDEA_PLACEHOLDER = `Describe the app, program, game, tool, or workflow you want to build.

Example:
I want to build a simple offline inventory tracker for a small warehouse.
It should track products, quantities, storage locations, low-stock warnings, search, import/export, and local saves.
I am a non-coder and want this built in small safe phases.`;

export const BLUEPRINT_CONSTRAINTS_PLACEHOLDER = `List anything the planner must respect:
offline only, no login, Windows app, no cloud, simple UI, local saves, no database, etc.`;

export const PLANNING_DOCS_SAFETY_WARNING =
  "This writes only `.nttc/planning/*.md` after explicit confirmation. It does not create source files.";

export const BLUEPRINT_NO_CODE_RULES = [
  "Do not write source code yet.",
  "Do not scaffold files yet.",
  "Do not install packages.",
  "Do not assume hidden file access.",
  "Create planning documents and a phase-by-phase build plan only.",
] as const;

export const PLANNER_QUESTION_SECTIONS = [
  "Purpose",
  "Users",
  "Core features",
  "Data/storage",
  "Screens/UI",
  "Offline/cloud/login needs",
  "Import/export",
  "Safety/privacy",
  "Tech stack assumptions",
  "MVP scope",
  "Future features",
  "What not to build yet",
] as const;

/** Maps blueprint section titles to planning document filenames. */
export const SECTION_TO_PLANNING_FILE: Record<string, PlanningDocumentFileName> =
  {
    "Project Brief": "PROJECT_BRIEF.md",
    "Product Requirements": "PRODUCT_REQUIREMENTS.md",
    "Feature Roadmap": "FEATURE_ROADMAP.md",
    "Data Model": "DATA_MODEL.md",
    "Screen / Workflow Flow": "SCREEN_FLOW.md",
    "Architecture Plan": "ARCHITECTURE_PLAN.md",
    "Build Phases": "BUILD_PHASES.md",
    "Validation Plan": "VALIDATION_PLAN.md",
    "AI Team Roles": "AI_TEAM_ROLES.md",
    "Phase 1 Builder Handoff": "HANDOFF_NOTES.md",
    "Current Status": "CURRENT_STATUS.md",
    "Risks / Open Questions": "DECISIONS_LOG.md",
  };

export function isPlanningDocumentFileName(
  value: string,
): value is PlanningDocumentFileName | typeof TASK_CARDS_PLANNING_FILE_NAME {
  return (ALL_PLANNING_DOCUMENT_FILE_NAMES as readonly string[]).includes(
    value,
  );
}

export function labelForBlueprintProjectType(id: BlueprintProjectType): string {
  return (
    BLUEPRINT_PROJECT_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id
  );
}

export function labelForBlueprintTargetUser(id: BlueprintTargetUser): string {
  return BLUEPRINT_TARGET_USER_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function labelForBlueprintBuildStyle(id: BlueprintBuildStyle): string {
  return BLUEPRINT_BUILD_STYLE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function labelForBlueprintSource(id: BlueprintSource): string {
  return BLUEPRINT_SOURCE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}
