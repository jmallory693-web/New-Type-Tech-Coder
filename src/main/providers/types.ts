import type {
  InstalledOllamaModel,
  LocalAiAdvisorResponse,
  ProviderSettings,
  ProviderStatus,
} from "../../shared/types";

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  availableModels: string[];
  modelFound: boolean | null;
}

export interface ProviderChatResult {
  ok: boolean;
  message: string;
  responseText: string | null;
}

export interface ListInstalledModelsResult {
  ok: boolean;
  message: string;
  models: InstalledOllamaModel[];
}

/**
 * Future AI provider adapters plug in here.
 * Stage 6: Ollama-compatible inspect-only chat is live.
 * Qwen Code CLI and other agentic adapters remain placeholders.
 */
export interface AiProviderAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  getStatus(): ProviderStatus;
  updateSettings?(settings: Partial<ProviderSettings>): void;
  getSettings?(): ProviderSettings;
  testConnection?(): Promise<ProviderTestResult>;
  chatMetadataOnly?(prompt: string): Promise<ProviderChatResult>;
}

export abstract class BaseProviderAdapter implements AiProviderAdapter {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly description: string;

  getStatus(): ProviderStatus {
    return {
      connected: false,
      providerId: null,
      providerName: null,
      message: "No AI provider connected.",
      connectionState: "not-connected",
      baseUrl: null,
      modelName: null,
      lastTestMessage: null,
      lastTestAt: null,
    };
  }
}

export function defaultOllamaSettings(): ProviderSettings {
  return {
    providerType: "ollama-compatible",
    baseUrl: "http://127.0.0.1:11434",
    modelName: "qwen2.5-coder",
    qwenCommand: "qwen",
  };
}

export function truncateAdvisorForPack(
  response: LocalAiAdvisorResponse,
  maxChars = 6000,
): { text: string; truncated: boolean } {
  if (response.responseText.length <= maxChars) {
    return { text: response.responseText, truncated: false };
  }
  return {
    text: `${response.responseText.slice(0, maxChars)}\n\n…(truncated for Review Pack size)`,
    truncated: true,
  };
}

export function truncateQwenReportForPack(
  text: string,
  maxChars = 6000,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, maxChars)}\n\n…(truncated for Review Pack size)`,
    truncated: true,
  };
}
