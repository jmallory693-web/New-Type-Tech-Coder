import type { LocalAiRoleId } from "./types";
import { LOCAL_AI_ROLE_IDS, LOCAL_AI_ROLES } from "./localAiRoles";

/** Stage 38A: roles that can have a dedicated Ollama model mapping. */
export type RoleModelMappingKey =
  | LocalAiRoleId
  | "builder-plan-mode"
  | "blueprint-planner"
  | "code-context-review"
  | "patch-draft";

export const ROLE_MODEL_MAPPING_KEYS: RoleModelMappingKey[] = [
  ...LOCAL_AI_ROLE_IDS,
  "builder-plan-mode",
  "blueprint-planner",
  "code-context-review",
  "patch-draft",
];

export const BUILDER_PLAN_MAPPING_KEY: RoleModelMappingKey = "builder-plan-mode";

export const BLUEPRINT_PLANNER_MAPPING_KEY: RoleModelMappingKey =
  "blueprint-planner";

export const CODE_CONTEXT_REVIEW_MAPPING_KEY: RoleModelMappingKey =
  "code-context-review";

export const PATCH_DRAFT_MAPPING_KEY: RoleModelMappingKey = "patch-draft";

export type RoleModelCategory = "general" | "coder" | "speaker" | "safety" | "builder-plan";

export type ModelSelectionSource =
  | "role-specific"
  | "patch-planner-fallback"
  | "bug-risk-reviewer-fallback"
  | "code-context-review-fallback"
  | "architect-planner-fallback"
  | "project-foreman-fallback"
  | "general-reviewer-fallback"
  | "global-fallback";

export interface ResolvedModelSelection {
  ok: boolean;
  modelName: string | null;
  source: ModelSelectionSource | null;
  message: string;
  /** True when an installed-models cache exists and the chosen name is not in it. */
  missingFromCache: boolean;
}

const CODER_KEYWORDS = [
  "coder",
  "code",
  "deepseek",
  "codellama",
  "starcoder",
  "wizardcoder",
  "qwen2.5-coder",
  "qwen-coder",
];

const GENERAL_KEYWORDS = [
  "qwen2.5",
  "qwen3",
  "llama3",
  "llama3.1",
  "llama3.2",
  "mistral",
  "gemma",
  "phi",
  "neural-chat",
];

/** Stage 85: avoid large/slow models for Blueprint Planner suggestions. */
const LARGE_SLOW_MODEL_MARKERS = ["30b", "32b", "40b", "65b", "70b", "a3b"];

const BLUEPRINT_PLANNER_PREFERRED_KEYWORDS = [
  "qwen2.5:7b",
  "llama3.1:8b",
  "qwen3:8b",
  "deepseek-r1:7b",
  "qwen2.5-coder:7b",
  "codellama:7b",
  "deepseek-coder:6.7b",
  "qwen2.5",
  "llama3.1",
  "mistral",
  "gemma",
  "phi",
];

function looksLikeLargeSlowModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return LARGE_SLOW_MODEL_MARKERS.some((marker) => lower.includes(marker));
}

function looksLikeSmallPlanningModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return /:7b|:8b|:6\.7b|:1\.5b|7b|8b/.test(lower);
}

/**
 * Stage 85: suggest a smaller/faster planning-capable model for Blueprint Planner.
 * Does not download models or change saved mappings by itself.
 */
export function suggestBlueprintPlannerModel(
  installedNames: string[],
): string | null {
  const names = installedNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return null;

  const planningPool = names.filter((name) => !looksLikeLargeSlowModel(name));
  const pool = planningPool.length > 0 ? planningPool : names;

  for (const kw of BLUEPRINT_PLANNER_PREFERRED_KEYWORDS) {
    const hit = pool.find((name) =>
      name.toLowerCase().includes(kw.toLowerCase()),
    );
    if (hit && !looksLikeLargeSlowModel(hit)) return hit;
  }

  const smallHit = pool.find((name) => looksLikeSmallPlanningModel(name));
  if (smallHit) return smallHit;

  return pool[0] ?? null;
}

export function emptyRoleModelMappings(): Record<RoleModelMappingKey, string> {
  const mappings = {} as Record<RoleModelMappingKey, string>;
  for (const key of ROLE_MODEL_MAPPING_KEYS) {
    mappings[key] = "";
  }
  return mappings;
}

export function normalizeRoleModelMappings(
  input: Partial<Record<RoleModelMappingKey, string>> | null | undefined,
): Record<RoleModelMappingKey, string> {
  const next = emptyRoleModelMappings();
  if (!input || typeof input !== "object") return next;
  for (const key of ROLE_MODEL_MAPPING_KEYS) {
    const value = input[key];
    if (typeof value === "string") {
      next[key] = value.trim();
    }
  }
  return next;
}

export function isRoleModelMappingKey(value: unknown): value is RoleModelMappingKey {
  return (
    typeof value === "string" &&
    ROLE_MODEL_MAPPING_KEYS.includes(value as RoleModelMappingKey)
  );
}

export function getRoleModelMappingLabel(key: RoleModelMappingKey): string {
  if (key === "builder-plan-mode") return "Builder Plan Mode";
  if (key === "blueprint-planner") return "Blueprint Planner";
  if (key === "code-context-review") return "Code Reviewer";
  if (key === "patch-draft") return "Patch Draft";
  return LOCAL_AI_ROLES[key]?.label ?? key;
}

export function getRoleModelCategory(key: RoleModelMappingKey): RoleModelCategory {
  if (key === "builder-plan-mode") return "builder-plan";
  if (key === "blueprint-planner") return "general";
  if (key === "code-context-review") return "coder";
  if (key === "patch-draft") return "coder";
  if (key === "safety-reviewer" || key === "safety-officer") return "safety";
  if (key === "patch-planner" || key === "bug-risk-reviewer") return "coder";
  if (key === "architect-planner" || key === "test-planner") return "coder";
  const role = LOCAL_AI_ROLES[key];
  if (role?.category === "speaker-style") return "speaker";
  return "general";
}

function pickBestModel(
  installedNames: string[],
  preferredKeywords: string[],
  fallbackKeywords: string[],
): string | null {
  if (installedNames.length === 0) return null;
  for (const kw of preferredKeywords) {
    const hit = installedNames.find((name) =>
      name.toLowerCase().includes(kw.toLowerCase()),
    );
    if (hit) return hit;
  }
  for (const kw of fallbackKeywords) {
    const hit = installedNames.find((name) =>
      name.toLowerCase().includes(kw.toLowerCase()),
    );
    if (hit) return hit;
  }
  return installedNames[0] ?? null;
}

/**
 * Suggest role→model defaults from installed names using simple keyword matching.
 * Does not download or pull models.
 */
export function suggestRoleModelDefaults(
  installedNames: string[],
): Record<RoleModelMappingKey, string> {
  const names = installedNames.map((n) => n.trim()).filter(Boolean);
  const suggestions = emptyRoleModelMappings();
  if (names.length === 0) return suggestions;

  const coderPick = pickBestModel(names, CODER_KEYWORDS, GENERAL_KEYWORDS);
  const generalPick = pickBestModel(names, GENERAL_KEYWORDS, CODER_KEYWORDS);
  const blueprintPlannerPick = suggestBlueprintPlannerModel(names);
  const speakerPick = generalPick;
  const safetyPick = generalPick;

  for (const key of ROLE_MODEL_MAPPING_KEYS) {
    if (key === "blueprint-planner") {
      suggestions[key] = blueprintPlannerPick ?? generalPick ?? "";
      continue;
    }
    const category = getRoleModelCategory(key);
    if (category === "coder" || category === "builder-plan") {
      suggestions[key] = coderPick ?? generalPick ?? "";
    } else if (category === "speaker") {
      suggestions[key] = speakerPick ?? "";
    } else if (category === "safety") {
      suggestions[key] = safetyPick ?? "";
    } else {
      suggestions[key] = generalPick ?? coderPick ?? "";
    }
  }
  return suggestions;
}

export function modelNameInInstalledList(
  modelName: string,
  installedNames: string[],
): boolean {
  const target = modelName.trim();
  if (!target || installedNames.length === 0) return false;
  return installedNames.some(
    (name) =>
      name === target ||
      name.startsWith(`${target}:`) ||
      target.startsWith(`${name}:`),
  );
}

/**
 * Resolve which model to use for Ask Local AI Role.
 * Role mapping → global fallback.
 */
export function resolveLocalAiRoleModel(input: {
  roleId: LocalAiRoleId;
  mappings: Record<RoleModelMappingKey, string>;
  globalFallbackModel: string;
  installedNames: string[];
}): ResolvedModelSelection {
  const roleMapped = input.mappings[input.roleId]?.trim() ?? "";
  if (roleMapped) {
    return finalizeSelection({
      modelName: roleMapped,
      source: "role-specific",
      installedNames: input.installedNames,
      label: getRoleModelMappingLabel(input.roleId),
    });
  }
  const global = input.globalFallbackModel.trim();
  if (global) {
    return finalizeSelection({
      modelName: global,
      source: "global-fallback",
      installedNames: input.installedNames,
      label: "global fallback",
    });
  }
  return {
    ok: false,
    modelName: null,
    source: null,
    message:
      "No model selected. Set a role model mapping or the global fallback model in Settings / Advanced.",
    missingFromCache: false,
  };
}

/**
 * Resolve which model to use for Builder Plan Mode.
 * Builder Plan mapping → Patch Planner mapping → global fallback.
 */
export function resolveBuilderPlanModel(input: {
  mappings: Record<RoleModelMappingKey, string>;
  globalFallbackModel: string;
  installedNames: string[];
}): ResolvedModelSelection {
  const builderMapped = input.mappings["builder-plan-mode"]?.trim() ?? "";
  if (builderMapped) {
    return finalizeSelection({
      modelName: builderMapped,
      source: "role-specific",
      installedNames: input.installedNames,
      label: "Builder Plan Mode",
    });
  }
  const patchMapped = input.mappings["patch-planner"]?.trim() ?? "";
  if (patchMapped) {
    return finalizeSelection({
      modelName: patchMapped,
      source: "patch-planner-fallback",
      installedNames: input.installedNames,
      label: "Patch Planner",
    });
  }
  const global = input.globalFallbackModel.trim();
  if (global) {
    return finalizeSelection({
      modelName: global,
      source: "global-fallback",
      installedNames: input.installedNames,
      label: "global fallback",
    });
  }
  return {
    ok: false,
    modelName: null,
    source: null,
    message:
      "No model selected for Builder Plan Mode. Map Builder Plan Mode, Patch Planner, or set the global fallback model.",
    missingFromCache: false,
  };
}

/**
 * Resolve which model to use for Local Planner AI (Stage 82).
 * Blueprint Planner → Architect Planner → Project Foreman → General Reviewer → global.
 */
export function resolveBlueprintPlannerModel(input: {
  mappings: Record<RoleModelMappingKey, string>;
  globalFallbackModel: string;
  installedNames: string[];
}): ResolvedModelSelection {
  const blueprintMapped = input.mappings["blueprint-planner"]?.trim() ?? "";
  if (blueprintMapped) {
    return finalizeSelection({
      modelName: blueprintMapped,
      source: "role-specific",
      installedNames: input.installedNames,
      label: "Blueprint Planner",
    });
  }
  const architectMapped = input.mappings["architect-planner"]?.trim() ?? "";
  if (architectMapped) {
    return finalizeSelection({
      modelName: architectMapped,
      source: "architect-planner-fallback",
      installedNames: input.installedNames,
      label: "Architect Planner",
    });
  }
  const foremanMapped = input.mappings["project-foreman"]?.trim() ?? "";
  if (foremanMapped) {
    return finalizeSelection({
      modelName: foremanMapped,
      source: "project-foreman-fallback",
      installedNames: input.installedNames,
      label: "Project Foreman",
    });
  }
  const reviewerMapped = input.mappings["general-reviewer"]?.trim() ?? "";
  if (reviewerMapped) {
    return finalizeSelection({
      modelName: reviewerMapped,
      source: "general-reviewer-fallback",
      installedNames: input.installedNames,
      label: "General Reviewer",
    });
  }
  const global = input.globalFallbackModel.trim();
  if (global) {
    return finalizeSelection({
      modelName: global,
      source: "global-fallback",
      installedNames: input.installedNames,
      label: "global fallback",
    });
  }
  return {
    ok: false,
    modelName: null,
    source: null,
    message:
      "No model selected for Blueprint Planner. Map Blueprint Planner, Architect Planner, Project Foreman, General Reviewer, or set the global fallback model in Settings / Advanced.",
    missingFromCache: false,
  };
}

/**
 * Resolve which model to use for Ask Local AI About Selected Code (Stage 54).
 * Code Reviewer mapping → Bug Risk Reviewer → Patch Planner → global fallback.
 */
export function resolveCodeContextReviewModel(input: {
  mappings: Record<RoleModelMappingKey, string>;
  globalFallbackModel: string;
  installedNames: string[];
}): ResolvedModelSelection {
  const codeMapped = input.mappings["code-context-review"]?.trim() ?? "";
  if (codeMapped) {
    return finalizeSelection({
      modelName: codeMapped,
      source: "role-specific",
      installedNames: input.installedNames,
      label: "Code Reviewer",
    });
  }
  const bugMapped = input.mappings["bug-risk-reviewer"]?.trim() ?? "";
  if (bugMapped) {
    return finalizeSelection({
      modelName: bugMapped,
      source: "bug-risk-reviewer-fallback",
      installedNames: input.installedNames,
      label: "Bug Risk Reviewer",
    });
  }
  const patchMapped = input.mappings["patch-planner"]?.trim() ?? "";
  if (patchMapped) {
    return finalizeSelection({
      modelName: patchMapped,
      source: "patch-planner-fallback",
      installedNames: input.installedNames,
      label: "Patch Planner",
    });
  }
  const global = input.globalFallbackModel.trim();
  if (global) {
    return finalizeSelection({
      modelName: global,
      source: "global-fallback",
      installedNames: input.installedNames,
      label: "global fallback",
    });
  }
  return {
    ok: false,
    modelName: null,
    source: null,
    message:
      "No model selected for Code Reviewer. Map Code Reviewer, Bug Risk Reviewer, Patch Planner, or set the global fallback model.",
    missingFromCache: false,
  };
}

/**
 * Resolve which model to use for Patch Draft Mode (Stage 58).
 * Patch Draft mapping → Patch Planner → Code Reviewer → global fallback.
 */
export function resolvePatchDraftModel(input: {
  mappings: Record<RoleModelMappingKey, string>;
  globalFallbackModel: string;
  installedNames: string[];
}): ResolvedModelSelection {
  const patchDraftMapped = input.mappings["patch-draft"]?.trim() ?? "";
  if (patchDraftMapped) {
    return finalizeSelection({
      modelName: patchDraftMapped,
      source: "role-specific",
      installedNames: input.installedNames,
      label: "Patch Draft",
    });
  }
  const patchMapped = input.mappings["patch-planner"]?.trim() ?? "";
  if (patchMapped) {
    return finalizeSelection({
      modelName: patchMapped,
      source: "patch-planner-fallback",
      installedNames: input.installedNames,
      label: "Patch Planner",
    });
  }
  const codeMapped = input.mappings["code-context-review"]?.trim() ?? "";
  if (codeMapped) {
    return finalizeSelection({
      modelName: codeMapped,
      source: "code-context-review-fallback",
      installedNames: input.installedNames,
      label: "Code Reviewer",
    });
  }
  const global = input.globalFallbackModel.trim();
  if (global) {
    return finalizeSelection({
      modelName: global,
      source: "global-fallback",
      installedNames: input.installedNames,
      label: "global fallback",
    });
  }
  return {
    ok: false,
    modelName: null,
    source: null,
    message:
      "No model selected for Patch Draft Mode. Map Patch Draft, Patch Planner, Code Reviewer, or set the global fallback model.",
    missingFromCache: false,
  };
}

function finalizeSelection(input: {
  modelName: string;
  source: ModelSelectionSource;
  installedNames: string[];
  label: string;
}): ResolvedModelSelection {
  const missingFromCache =
    input.installedNames.length > 0 &&
    !modelNameInInstalledList(input.modelName, input.installedNames);

  if (missingFromCache) {
    return {
      ok: false,
      modelName: input.modelName,
      source: input.source,
      message: `Mapped model “${input.modelName}” (${input.label}) was not found in the installed models list. Refresh Installed Models or pick a model that is installed.`,
      missingFromCache: true,
    };
  }

  const sourceLabel =
    input.source === "role-specific"
      ? "role-specific mapping"
      : input.source === "patch-planner-fallback"
        ? "Patch Planner mapping"
        : input.source === "bug-risk-reviewer-fallback"
          ? "Bug Risk Reviewer mapping"
          : input.source === "code-context-review-fallback"
            ? "Code Reviewer mapping"
            : input.source === "architect-planner-fallback"
              ? "Architect Planner mapping"
              : input.source === "project-foreman-fallback"
                ? "Project Foreman mapping"
                : input.source === "general-reviewer-fallback"
                  ? "General Reviewer mapping"
                  : "global fallback model";

  return {
    ok: true,
    modelName: input.modelName,
    source: input.source,
    message: `Using ${sourceLabel}: ${input.modelName}`,
    missingFromCache: false,
  };
}

export function formatModelSelectionSource(
  source: ModelSelectionSource | null | undefined,
): string {
  if (source === "role-specific") return "Role-specific mapping";
  if (source === "patch-planner-fallback") return "Patch Planner fallback";
  if (source === "bug-risk-reviewer-fallback") return "Bug Risk Reviewer fallback";
  if (source === "code-context-review-fallback") return "Code Reviewer fallback";
  if (source === "architect-planner-fallback") return "Architect Planner fallback";
  if (source === "project-foreman-fallback") return "Project Foreman fallback";
  if (source === "general-reviewer-fallback") return "General Reviewer fallback";
  if (source === "global-fallback") return "Global fallback model";
  return "Unknown";
}

export function countMappedRoles(
  mappings: Record<RoleModelMappingKey, string>,
): number {
  return ROLE_MODEL_MAPPING_KEYS.filter((key) => mappings[key]?.trim()).length;
}
