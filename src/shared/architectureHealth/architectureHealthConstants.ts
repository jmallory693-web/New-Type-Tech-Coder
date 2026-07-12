/** Stage 98: Architecture Health / Monolith Risk Report (metadata only; no AI). */

export const ARCHITECTURE_HEALTH_REPORT_TITLE =
  "# NTTC Architecture Health Report";

export const ARCHITECTURE_HEALTH_PURPOSE =
  "Deterministic architecture-health report from safe file metadata and line counts only. No source bodies in the report. No AI. No refactors.";

export const ARCHITECTURE_HEALTH_SAFETY_REMINDER =
  "This report is metadata only. NTTC did not edit files, generate code, call AI, or send project data. Copy manually if you want outside review.";

export const ARCHITECTURE_HEALTH_MAX_FILES = 2500;

/** Stage 100: higher than Code Context cap so large renderer shells (e.g. App.tsx) can be line-counted. */
export const ARCHITECTURE_HEALTH_MAX_FILE_BYTES = 1024 * 1024;

export const ARCHITECTURE_HEALTH_PREVIEW_MAX = 1200;

export const ARCHITECTURE_HEALTH_PLANNING_FILE_NAME =
  "ARCHITECTURE_HEALTH.md" as const;

export const ARCHITECTURE_HEALTH_LINE_THRESHOLDS = {
  okMax: 300,
  watchMax: 700,
  largeMax: 1500,
  monolithMax: 3000,
} as const;

export const ARCHITECTURE_HEALTH_RECOMMENDATIONS = [
  "Healthy",
  "Watch large files",
  "Monolith risk — extract before adding features",
  "Critical monolith risk — plan refactors first",
] as const;

export type ArchitectureHealthRecommendation =
  (typeof ARCHITECTURE_HEALTH_RECOMMENDATIONS)[number];

export type ArchitectureHealthRiskLevel =
  | "OK"
  | "Watch"
  | "Large"
  | "Monolith risk"
  | "Critical monolith risk";

export const ARCHITECTURE_HEALTH_SUGGESTED_ACTIONS = [
  "OK",
  "Watch",
  "Extract components",
  "Extract manager",
  "Extract constants/types",
  "Split renderer wiring",
  "Split IPC wiring",
  "Create refactor task card",
  "Avoid adding new logic here",
] as const;

export type ArchitectureHealthSuggestedAction =
  (typeof ARCHITECTURE_HEALTH_SUGGESTED_ACTIONS)[number];

/** High-risk coordination files (path/name hints). */
export const HIGH_RISK_COORDINATION_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
}> = [
  { label: "renderer root App.tsx", pattern: /(?:^|\/)App\.tsx$/i },
  { label: "main entry index.ts", pattern: /(?:^|\/)main\/index\.ts$/i },
  { label: "electron preload", pattern: /preload\.(?:ts|js|mjs|cjs)$/i },
  { label: "electron main", pattern: /electron\/main\./i },
  { label: "manager module", pattern: /Manager\.ts$/i },
  { label: "shared types aggregator", pattern: /(?:^|\/)shared\/types\.ts$/i },
  { label: "constants aggregator", pattern: /Constants\.ts$/i },
];

/** Stage 100: deny generated/build output from Architecture Health scans only. */
export const ARCHITECTURE_HEALTH_DENY_DIRECTORY_NAMES = [
  "node_modules",
  ".git",
  "dist",
  "dist-electron",
  "build",
  "release",
  "out",
  ".next",
  ".vite",
  "coverage",
  ".cache",
  ".nttc",
] as const;

/** Stage 100: package/config changed-file patterns (context warnings, not monolith). */
export const ARCHITECTURE_HEALTH_CONFIG_CHANGED_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
}> = [
  { label: "package manifest", pattern: /(?:^|\/)package\.json$/i },
  { label: "package lockfile", pattern: /(?:^|\/)package-lock\.json$/i },
  { label: "pnpm lockfile", pattern: /(?:^|\/)pnpm-lock\.yaml$/i },
  { label: "yarn lockfile", pattern: /(?:^|\/)yarn\.lock$/i },
  { label: "TypeScript config", pattern: /tsconfig(?:\..+)?\.json$/i },
  { label: "Vite config", pattern: /vite\.config\.[cm]?[jt]s$/i },
  { label: "Electron Builder config", pattern: /electron-builder|electron\.builder/i },
  { label: "ESLint config", pattern: /eslint\.config\.[cm]?[jt]s$|\.eslintrc/i },
  { label: "Prettier config", pattern: /prettier\.config\.[cm]?[jt]s$|\.prettierrc/i },
  { label: "JS/TS project config", pattern: /(?:^|\/)jsconfig\.json$/i },
];

export const TASK_CARD_EXTRACTION_HINTS = [
  "components",
  "component",
  "modules",
  "module",
  "manager",
  "managers",
  "helper",
  "helpers",
  "constants",
  "shared/",
  "ipc",
  "registration",
] as const;
