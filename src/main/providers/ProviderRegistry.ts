import type {
  InstalledOllamaModel,
  ProviderSettings,
  ProviderStatus,
} from "../../shared/types";
import type { AiProviderAdapter, ListInstalledModelsResult } from "./types";
import {
  GenericLocalModelAdapter,
  OllamaProviderAdapter,
  QwenCodeProviderAdapter,
} from "./adapters";
import { defaultOllamaSettings } from "./types";

/**
 * Registry of provider adapters.
 * Stage 8A: Ollama metadata advisor remains live.
 * Qwen Code CLI is selectable for Prompt Pack / CLI detection;
 * live Qwen inspect stays disabled in QwenInspectManager.
 */
export class ProviderRegistry {
  private readonly adapters: AiProviderAdapter[];
  private readonly ollama: OllamaProviderAdapter;

  constructor() {
    this.ollama = new OllamaProviderAdapter();
    this.adapters = [
      this.ollama,
      new QwenCodeProviderAdapter(),
      new GenericLocalModelAdapter(),
    ];
  }

  listAdapters(): Array<{ id: string; displayName: string; description: string }> {
    return this.adapters.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      description: a.description,
    }));
  }

  getSettings(): ProviderSettings {
    return this.ollama.getSettings();
  }

  updateSettings(partial: Partial<ProviderSettings>): ProviderSettings {
    this.ollama.updateSettings(partial);
    return this.ollama.getSettings();
  }

  getStatus(): ProviderStatus {
    const settings = this.ollama.getSettings();
    const ollamaStatus = this.ollama.getStatus();

    if (settings.providerType === "qwen-code-inspect") {
      return {
        connected: false,
        providerId: "qwen-code",
        providerName: "Qwen Code CLI Inspect-Only",
        message:
          "Qwen Code CLI Inspect-Only selected. Live inspect is disabled — use Prompt Pack / Test Qwen CLI. Ollama advisor remains available when you switch back.",
        // Preserve Ollama readiness in connectionState so Ask Local AI keeps working.
        connectionState: ollamaStatus.connectionState,
        baseUrl: ollamaStatus.baseUrl,
        modelName: ollamaStatus.modelName,
        lastTestMessage: ollamaStatus.lastTestMessage,
        lastTestAt: ollamaStatus.lastTestAt,
      };
    }

    return ollamaStatus;
  }

  /** Ollama connection status regardless of which provider panel is selected. */
  getOllamaStatus(): ProviderStatus {
    return this.ollama.getStatus();
  }

  async testConnection() {
    return this.ollama.testConnection();
  }

  async listInstalledModels(): Promise<ListInstalledModelsResult> {
    return this.ollama.listInstalledModels();
  }

  async chatMetadataOnly(prompt: string, modelOverride?: string) {
    return this.ollama.chatMetadataOnly(prompt, modelOverride);
  }

  /** Helper for callers that only need installed model names. */
  async listInstalledModelNames(): Promise<string[]> {
    const result = await this.ollama.listInstalledModels();
    return result.ok ? result.models.map((m: InstalledOllamaModel) => m.name) : [];
  }

  resetToDefaults(): ProviderSettings {
    this.ollama.updateSettings(defaultOllamaSettings());
    return this.ollama.getSettings();
  }
}
