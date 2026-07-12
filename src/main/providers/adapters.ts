import type {
  InstalledOllamaModel,
  ProviderConnectionState,
  ProviderSettings,
  ProviderStatus,
} from "../../shared/types";
import {
  BaseProviderAdapter,
  defaultOllamaSettings,
  type ListInstalledModelsResult,
  type ProviderChatResult,
  type ProviderTestResult,
} from "./types";

const UNREACHABLE_MESSAGE =
  "Local provider is not reachable. Make sure Ollama or a compatible local server is running.";

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "http://127.0.0.1:11434";
  }
  return trimmed;
}

function isLocalBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (host === "127.0.0.1" || host === "localhost" || host === "::1")
    );
  } catch {
    return false;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseInstalledModels(raw: unknown): InstalledOllamaModel[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as {
    models?: Array<{
      name?: string;
      model?: string;
      modified_at?: string;
      size?: number;
      details?: {
        family?: string;
        parameter_size?: string;
        quantization_level?: string;
      };
    }>;
  };
  return (data.models ?? [])
    .map((m) => {
      const name = (m.name || m.model || "").trim();
      if (!name) return null;
      return {
        name,
        modifiedAt: typeof m.modified_at === "string" ? m.modified_at : null,
        sizeBytes: typeof m.size === "number" ? m.size : null,
        family: m.details?.family ?? null,
        parameterSize: m.details?.parameter_size ?? null,
        quantization: m.details?.quantization_level ?? null,
      } satisfies InstalledOllamaModel;
    })
    .filter((m): m is InstalledOllamaModel => m !== null);
}

/** Live Ollama-compatible local chat adapter (inspect-only / metadata-only). */
export class OllamaProviderAdapter extends BaseProviderAdapter {
  readonly id = "ollama";
  readonly displayName = "Ollama-compatible local model";
  readonly description =
    "Local Ollama-compatible HTTP API. Stage 6: metadata-only advisor chat.";

  private settings: ProviderSettings = defaultOllamaSettings();
  private connectionState: ProviderConnectionState = "not-connected";
  private lastTestMessage: string | null = null;
  private lastTestAt: string | null = null;

  getSettings(): ProviderSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<ProviderSettings>): void {
    const nextBase = normalizeBaseUrl(
      typeof partial.baseUrl === "string" ? partial.baseUrl : this.settings.baseUrl,
    );
    const nextModel =
      typeof partial.modelName === "string"
        ? partial.modelName.trim()
        : this.settings.modelName;
    const nextQwenCommand =
      typeof partial.qwenCommand === "string"
        ? partial.qwenCommand.trim() || this.settings.qwenCommand
        : this.settings.qwenCommand;
    const nextProviderType =
      partial.providerType === "ollama-compatible" ||
      partial.providerType === "qwen-code-inspect"
        ? partial.providerType
        : this.settings.providerType;

    const ollamaEndpointChanged =
      nextBase !== this.settings.baseUrl ||
      (nextModel || this.settings.modelName) !== this.settings.modelName;

    this.settings = {
      providerType: nextProviderType,
      baseUrl: nextBase,
      modelName: nextModel || this.settings.modelName,
      qwenCommand: nextQwenCommand || "qwen",
    };

    // Only invalidate Ollama readiness when Ollama endpoint/model changes.
    if (ollamaEndpointChanged) {
      if (this.settings.baseUrl && this.settings.modelName) {
        this.connectionState = "configured";
      } else {
        this.connectionState = "not-connected";
      }
    }
  }

  getStatus(): ProviderStatus {
    const configured = Boolean(this.settings.baseUrl && this.settings.modelName);
    let message = "No AI provider connected.";
    if (this.connectionState === "ready") {
      message = `Provider ready (${this.settings.modelName}).`;
    } else if (this.connectionState === "connection-failed") {
      message = this.lastTestMessage ?? "Connection failed.";
    } else if (this.connectionState === "configured" || configured) {
      message = "Provider configured — test connection to make it ready.";
    }

    return {
      connected: this.connectionState === "ready",
      providerId: this.id,
      providerName: this.displayName,
      message,
      connectionState: configured
        ? this.connectionState === "not-connected"
          ? "configured"
          : this.connectionState
        : "not-connected",
      baseUrl: this.settings.baseUrl,
      modelName: this.settings.modelName,
      lastTestMessage: this.lastTestMessage,
      lastTestAt: this.lastTestAt,
    };
  }

  /**
   * Stage 38A: list installed models via GET /api/tags.
   * Does not change connection readiness by itself.
   */
  async listInstalledModels(): Promise<ListInstalledModelsResult> {
    const baseUrl = normalizeBaseUrl(this.settings.baseUrl);
    this.settings.baseUrl = baseUrl;

    if (!isLocalBaseUrl(baseUrl)) {
      return {
        ok: false,
        message:
          "Only local addresses are allowed (127.0.0.1 / localhost). Cloud APIs are blocked.",
        models: [],
      };
    }

    try {
      const tagsUrl = `${baseUrl}/api/tags`;
      const response = await fetchWithTimeout(
        tagsUrl,
        { method: "GET", headers: { Accept: "application/json" } },
        8_000,
      );

      if (!response.ok) {
        return {
          ok: false,
          message: `Local provider responded with HTTP ${response.status} while listing models.`,
          models: [],
        };
      }

      const data = await response.json();
      const models = parseInstalledModels(data);
      return {
        ok: true,
        message:
          models.length === 0
            ? `Local provider is reachable at ${baseUrl}, but no installed models were listed.`
            : `Found ${models.length} installed model(s) at ${baseUrl}.`,
        models,
      };
    } catch {
      return {
        ok: false,
        message: UNREACHABLE_MESSAGE,
        models: [],
      };
    }
  }

  async testConnection(): Promise<ProviderTestResult> {
    const baseUrl = normalizeBaseUrl(this.settings.baseUrl);
    const modelName = this.settings.modelName.trim();
    this.settings.baseUrl = baseUrl;

    if (!isLocalBaseUrl(baseUrl)) {
      this.connectionState = "connection-failed";
      this.lastTestAt = new Date().toISOString();
      this.lastTestMessage =
        "Only local addresses are allowed (127.0.0.1 / localhost). Cloud APIs are blocked.";
      return {
        ok: false,
        message: this.lastTestMessage,
        availableModels: [],
        modelFound: null,
      };
    }

    if (!modelName) {
      this.connectionState = "connection-failed";
      this.lastTestAt = new Date().toISOString();
      this.lastTestMessage = "Enter a model name before testing the connection.";
      return {
        ok: false,
        message: this.lastTestMessage,
        availableModels: [],
        modelFound: null,
      };
    }

    try {
      const listResult = await this.listInstalledModels();
      if (!listResult.ok) {
        this.connectionState = "connection-failed";
        this.lastTestAt = new Date().toISOString();
        this.lastTestMessage = listResult.message;
        return {
          ok: false,
          message: listResult.message,
          availableModels: [],
          modelFound: null,
        };
      }

      const availableModels = listResult.models.map((m) => m.name);
      const modelFound =
        availableModels.length === 0
          ? null
          : availableModels.some(
              (name) =>
                name === modelName ||
                name.startsWith(`${modelName}:`) ||
                modelName.startsWith(`${name}:`),
            );

      if (modelFound === false) {
        this.connectionState = "connection-failed";
        this.lastTestAt = new Date().toISOString();
        this.lastTestMessage = `Local provider is reachable, but model “${modelName}” was not found. Check the model name (examples: qwen2.5-coder, deepseek-coder, llama3.1, codellama).`;
        return {
          ok: false,
          message: this.lastTestMessage,
          availableModels,
          modelFound: false,
        };
      }

      this.connectionState = "ready";
      this.lastTestAt = new Date().toISOString();
      this.lastTestMessage =
        modelFound === null
          ? `Local provider is reachable at ${baseUrl}. Model list was empty/unavailable, so model “${modelName}” could not be confirmed yet.`
          : `Local provider is ready. Model “${modelName}” is available.`;
      return {
        ok: true,
        message: this.lastTestMessage,
        availableModels,
        modelFound,
      };
    } catch {
      this.connectionState = "connection-failed";
      this.lastTestAt = new Date().toISOString();
      this.lastTestMessage = UNREACHABLE_MESSAGE;
      return {
        ok: false,
        message: UNREACHABLE_MESSAGE,
        availableModels: [],
        modelFound: null,
      };
    }
  }

  /**
   * Metadata-only chat. Optional modelOverride uses a role-mapped model
   * without changing the global fallback setting.
   */
  async chatMetadataOnly(
    prompt: string,
    modelOverride?: string,
  ): Promise<ProviderChatResult> {
    if (this.connectionState !== "ready") {
      return {
        ok: false,
        message: "Provider is not ready. Use Test Connection first.",
        responseText: null,
      };
    }

    const baseUrl = normalizeBaseUrl(this.settings.baseUrl);
    if (!isLocalBaseUrl(baseUrl)) {
      return {
        ok: false,
        message: "Only local provider URLs are allowed.",
        responseText: null,
      };
    }

    const model =
      (typeof modelOverride === "string" ? modelOverride.trim() : "") ||
      this.settings.modelName.trim();
    if (!model) {
      return {
        ok: false,
        message:
          "No model selected. Set a role model mapping or the global fallback model.",
        responseText: null,
      };
    }

    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            model,
            stream: false,
            messages: [
              {
                role: "system",
                content:
                  "You are a cautious local advisor for a non-coder. You receive only safe metadata summaries. You cannot access files, edit projects, or run commands.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        },
        120_000,
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          ok: false,
          message: `Local AI request failed with HTTP ${response.status}.${body ? ` ${body.slice(0, 200)}` : ""}`,
          responseText: null,
        };
      }

      const data = (await response.json()) as {
        message?: { content?: string };
        error?: string;
      };

      if (data.error) {
        return {
          ok: false,
          message: `Local AI error: ${data.error}`,
          responseText: null,
        };
      }

      const text = data.message?.content?.trim() ?? "";
      if (!text) {
        return {
          ok: false,
          message: "Local AI returned an empty response.",
          responseText: null,
        };
      }

      return {
        ok: true,
        message: "Local AI review completed.",
        responseText: text,
      };
    } catch (error) {
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || /aborted/i.test(error.message));
      return {
        ok: false,
        message: aborted
          ? "Local AI request timed out. Try again or use a smaller model."
          : UNREACHABLE_MESSAGE,
        responseText: null,
      };
    }
  }
}

/** Placeholder live runner — Stage 8A uses QwenInspectManager + Prompt Pack instead. */
export class QwenCodeProviderAdapter extends BaseProviderAdapter {
  readonly id = "qwen-code";
  readonly displayName = "Qwen Code CLI Inspect-Only";
  readonly description =
    "Qwen Code CLI inspect-only option. Stage 8A: Prompt Pack + CLI detection; live inspect disabled until safety is guaranteed.";
}

/** Placeholder for other local models via future adapters. */
export class GenericLocalModelAdapter extends BaseProviderAdapter {
  readonly id = "generic-local";
  readonly displayName = "Generic local model";
  readonly description =
    "DeepSeek / Llama / other local models via future adapters. Use Ollama-compatible settings in Stage 6.";
}
