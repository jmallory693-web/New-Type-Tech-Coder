/** Stage 48: shared plain-English user-facing copy (messages only — no behavior changes). */

export const MISSING_DEPENDENCIES_HELPER =
  "Dependencies may not be installed in this project folder. NTTC does not install packages. Run `npm install` outside NTTC in a disposable project copy, then retry Build/Test Checks.";

export const NO_GIT_CHANGED_FILES_NOTE =
  "No Git repo was found in this folder. Changed-files scan is limited. Use a Git project copy for fuller patch review.";

export const ONEDRIVE_PROJECT_WARNING =
  "This project is inside OneDrive. Sync tools can sometimes lock files or slow packaging. A local disposable copy outside OneDrive is safer for testing.";

const MISSING_DEPENDENCY_PATTERNS: RegExp[] = [
  /cannot find module/i,
  /cannot find package/i,
  /ENOENT.*node_modules/i,
  /missing.*node_modules/i,
  /node_modules.*not found/i,
  /'tsc' is not recognized/i,
  /tsc: command not found/i,
  /tsc: not found/i,
  /'vite' is not recognized/i,
  /vite: command not found/i,
  /vitest.*not found/i,
  /electron-builder.*not found/i,
  /typescript.*not found/i,
  /npm ERR! code ENOENT/i,
  /Error: Cannot find module/i,
  /is not recognized as an internal or external command/i,
  /command not found/i,
];

export function looksLikeMissingDependencies(output: string): boolean {
  const text = output.trim();
  if (!text) return false;
  return MISSING_DEPENDENCY_PATTERNS.some((pattern) => pattern.test(text));
}

export function withMissingDependenciesHelper(
  summary: string,
  output: string,
): string {
  if (!looksLikeMissingDependencies(output)) return summary;
  if (summary.includes(MISSING_DEPENDENCIES_HELPER)) return summary;
  return `${summary} ${MISSING_DEPENDENCIES_HELPER}`;
}

export function formatLocalAiFailureMessage(input: {
  mode:
    | "local-ai-role"
    | "builder-plan-mode"
    | "blueprint-planner"
    | "code-context-review"
    | "patch-draft-mode";
  roleOrModeLabel: string;
  modelName: string;
  baseUrl: string;
  underlyingMessage: string;
}): string {
  const timedOut = /timed out|timeout|aborted/i.test(input.underlyingMessage);
  const suggestion =
    input.mode === "blueprint-planner"
      ? "Try copying the Planner AI Prompt to another AI, or use a smaller/faster installed model."
      : "Try a smaller installed model, reduce context, or generate fewer reports before asking.";
  const base = timedOut
    ? `Local AI timed out while using ${input.roleOrModeLabel} with model ${input.modelName} at ${input.baseUrl}.`
    : `Local AI failed while using ${input.roleOrModeLabel} with model ${input.modelName} at ${input.baseUrl}. ${input.underlyingMessage}`;
  return `${base} ${suggestion}`;
}
