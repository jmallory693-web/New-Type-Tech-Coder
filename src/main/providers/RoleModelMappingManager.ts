import type {
  InstalledOllamaModel,
  InstalledOllamaModelsState,
  RoleModelMappingKey,
  RoleModelMappingState,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import {
  emptyRoleModelMappings,
  normalizeRoleModelMappings,
  suggestRoleModelDefaults,
  getRoleModelMappingLabel,
  isRoleModelMappingKey,
  countMappedRoles,
} from "../../shared/roleModelMapping";

/**
 * Stage 38A: caches installed Ollama models and role→model mappings.
 * Model selection only — no new AI powers.
 */
export class RoleModelMappingManager {
  private models: InstalledOllamaModel[] = [];
  private lastRefreshAt: string | null = null;
  private lastRefreshMessage: string | null =
    "Refresh Installed Models to see what Ollama has locally.";
  private lastRefreshOk: boolean | null = null;
  private busy = false;
  private mappings: Record<RoleModelMappingKey, string> =
    emptyRoleModelMappings();
  private mappingStatusMessage: string | null =
    "Different jobs can use different local models. Coder models are useful for patch planning, but they still do not get file access.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getInstalledModelsState(): InstalledOllamaModelsState {
    return {
      models: this.models.map((m) => ({ ...m })),
      lastRefreshAt: this.lastRefreshAt,
      lastRefreshMessage: this.lastRefreshMessage,
      lastRefreshOk: this.lastRefreshOk,
      busy: this.busy,
    };
  }

  getRoleModelMappingState(): RoleModelMappingState {
    return {
      mappings: { ...this.mappings },
      statusMessage: this.mappingStatusMessage,
    };
  }

  getMappings(): Record<RoleModelMappingKey, string> {
    return { ...this.mappings };
  }

  getInstalledNames(): string[] {
    return this.models.map((m) => m.name);
  }

  setBusy(busy: boolean, message?: string): void {
    this.busy = busy;
    if (message !== undefined) {
      this.lastRefreshMessage = message;
    }
  }

  applyRefreshResult(input: {
    ok: boolean;
    message: string;
    models: InstalledOllamaModel[];
  }): void {
    this.busy = false;
    this.lastRefreshAt = new Date().toISOString();
    this.lastRefreshOk = input.ok;
    this.lastRefreshMessage = input.message;
    if (input.ok) {
      this.models = input.models.map((m) => ({ ...m }));
    }
  }

  setRoleMapping(roleKey: unknown, modelName: unknown): boolean {
    if (!isRoleModelMappingKey(roleKey)) return false;
    const next =
      typeof modelName === "string" ? modelName.trim() : "";
    this.mappings[roleKey] = next;
    const label = getRoleModelMappingLabel(roleKey);
    this.mappingStatusMessage = next
      ? `${label} → ${next}`
      : `${label} cleared (will use fallback).`;
    this.safetyGate.log(
      "info",
      "Role model mapping changed",
      next
        ? `${label} mapped to “${next}”.`
        : `${label} mapping cleared.`,
    );
    return true;
  }

  applySuggestedDefaults(installedNames?: string[]): number {
    const names = installedNames ?? this.getInstalledNames();
    if (names.length === 0) {
      this.mappingStatusMessage =
        "No installed model cache yet. Refresh Installed Models first — Suggested Defaults only fills dropdown selections from installed models.";
      this.safetyGate.log(
        "warning",
        "Suggested defaults skipped",
        this.mappingStatusMessage,
      );
      return 0;
    }
    const suggestions = suggestRoleModelDefaults(names);
    let applied = 0;
    for (const [key, value] of Object.entries(suggestions) as Array<
      [RoleModelMappingKey, string]
    >) {
      if (value) {
        this.mappings[key] = value;
        applied += 1;
      }
    }
    this.mappingStatusMessage =
      applied > 0
        ? `Suggested defaults applied for ${applied} role(s) from installed model names. Review dropdown selections and adjust as needed.`
        : "No matching installed models found for suggestions. Refresh Installed Models or pick models from the dropdowns manually.";
    this.safetyGate.log(
      applied > 0 ? "success" : "warning",
      "Suggested defaults applied",
      this.mappingStatusMessage,
    );
    return applied;
  }

  restoreFromHistory(input: {
    models?: InstalledOllamaModel[] | null;
    lastRefreshAt?: string | null;
    lastRefreshMessage?: string | null;
    lastRefreshOk?: boolean | null;
    mappings?: Partial<Record<RoleModelMappingKey, string>> | null;
  }): void {
    if (Array.isArray(input.models)) {
      this.models = input.models
        .filter((m) => m && typeof m.name === "string" && m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          modifiedAt: m.modifiedAt ?? null,
          sizeBytes: typeof m.sizeBytes === "number" ? m.sizeBytes : null,
          family: m.family ?? null,
          parameterSize: m.parameterSize ?? null,
          quantization: m.quantization ?? null,
        }));
    }
    if (typeof input.lastRefreshAt === "string") {
      this.lastRefreshAt = input.lastRefreshAt;
    }
    if (typeof input.lastRefreshMessage === "string") {
      this.lastRefreshMessage = input.lastRefreshMessage;
    }
    if (typeof input.lastRefreshOk === "boolean") {
      this.lastRefreshOk = input.lastRefreshOk;
    }
    if (input.mappings) {
      this.mappings = normalizeRoleModelMappings(input.mappings);
      const count = countMappedRoles(this.mappings);
      this.mappingStatusMessage =
        count > 0
          ? `Restored ${count} role model mapping(s) from app history.`
          : this.mappingStatusMessage;
    }
  }

  getPersistencePayload() {
    return {
      installedModels: this.models.map((m) => ({ ...m })),
      installedModelsLastRefreshAt: this.lastRefreshAt,
      installedModelsLastRefreshMessage: this.lastRefreshMessage,
      installedModelsLastRefreshOk: this.lastRefreshOk,
      roleModelMappings: { ...this.mappings },
    };
  }
}
