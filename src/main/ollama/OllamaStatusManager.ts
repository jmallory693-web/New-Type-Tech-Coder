import type {
  InstalledOllamaModelsState,
  OllamaBubbleStatus,
  OllamaStatusState,
  ProviderStatus,
} from "../../shared/types";
import {
  buildOllamaStatusTooltip,
  classifyOllamaFailure,
  looksLikeOllamaUnreachable,
} from "../../shared/ollamaStatus";
import type { ProviderTestResult } from "../providers/types";
import type { ListInstalledModelsResult } from "../providers/types";
import type { SafetyGate } from "../safety/SafetyGate";

/** Stage 65: persistent Ollama reachability bubble (status only; no AI chat). */
export class OllamaStatusManager {
  private bubbleStatus: OllamaBubbleStatus = "not-checked";
  private checking = false;
  private lastCheckedAt: string | null = null;
  private errorMessage: string | null = null;

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(
    provider: ProviderStatus,
    installedModels: InstalledOllamaModelsState,
  ): OllamaStatusState {
    const status: OllamaBubbleStatus = this.checking ? "checking" : this.bubbleStatus;
    const modelCount = installedModels.models.length;

    const tooltip = buildOllamaStatusTooltip({
      status,
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      lastCheckedAt: this.lastCheckedAt,
      installedModelCount: modelCount,
      errorMessage: this.errorMessage,
      formatCheckedAt: (iso) => {
        if (!iso) return "never";
        try {
          return new Date(iso).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
        } catch {
          return iso;
        }
      },
    });

    return {
      status,
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      lastCheckedAt: this.lastCheckedAt,
      installedModelCount: modelCount,
      errorMessage: this.errorMessage,
      tooltip,
      busy: this.checking,
    };
  }

  beginCheck(source: "test-connection" | "refresh-models" | "bubble-click"): void {
    this.checking = true;
    this.errorMessage = null;
    const detail =
      source === "refresh-models"
        ? "Refreshing installed models via GET /api/tags (no project data sent)."
        : "Testing local Ollama-compatible endpoint (no project data sent).";
    this.safetyGate.log("info", "Ollama status check started", detail);
  }

  applyTestResult(
    result: ProviderTestResult,
    provider: ProviderStatus,
    installedModelCount: number,
  ): void {
    this.checking = false;
    this.lastCheckedAt = new Date().toISOString();

    if (result.ok) {
      this.bubbleStatus = "active";
      this.errorMessage = null;
      this.safetyGate.log(
        "success",
        "Ollama status active",
        `${provider.baseUrl ?? "local"} · ${installedModelCount} model(s) · ${provider.modelName ?? "model"}.`,
      );
      return;
    }

    const failureStatus = classifyOllamaFailure(result.message);
    this.bubbleStatus = failureStatus;
    this.errorMessage = result.message;
    this.safetyGate.log(
      "warning",
      failureStatus === "offline" ? "Ollama status offline" : "Ollama status offline/error",
      result.message,
    );
  }

  applyRefreshResult(
    result: ListInstalledModelsResult,
    provider: ProviderStatus,
  ): void {
    this.checking = false;
    this.lastCheckedAt = new Date().toISOString();

    if (result.ok) {
      this.bubbleStatus = "active";
      this.errorMessage = null;
      this.safetyGate.log(
        "info",
        "Ollama status updated from model refresh",
        `${provider.baseUrl ?? "local"} · ${result.models.length} model(s).`,
      );
      return;
    }

    const failureStatus = classifyOllamaFailure(result.message);
    this.bubbleStatus = failureStatus;
    this.errorMessage = result.message;
    this.safetyGate.log(
      "warning",
      failureStatus === "offline" ? "Ollama status offline" : "Ollama status offline/error",
      result.message,
    );
  }

  applyTestFailure(message: string, provider: ProviderStatus): void {
    this.checking = false;
    this.lastCheckedAt = new Date().toISOString();
    const failureStatus = classifyOllamaFailure(message);
    this.bubbleStatus = failureStatus;
    this.errorMessage = message;
    this.safetyGate.log(
      "warning",
      failureStatus === "offline" ? "Ollama status offline" : "Ollama status offline/error",
      message,
    );
  }

  resetNotChecked(reason: string): void {
    if (this.checking) return;
    this.bubbleStatus = "not-checked";
    this.lastCheckedAt = null;
    this.errorMessage = null;
    this.safetyGate.log("info", "Ollama status reset", reason);
  }

  applyLocalAiOutcome(success: boolean, detail: string): void {
    if (this.checking) return;
    this.lastCheckedAt = new Date().toISOString();
    if (success) {
      this.bubbleStatus = "active";
      this.errorMessage = null;
      return;
    }
    if (looksLikeOllamaUnreachable(detail)) {
      const failureStatus = classifyOllamaFailure(detail);
      this.bubbleStatus = failureStatus;
      this.errorMessage = detail;
      this.safetyGate.log(
        "warning",
        failureStatus === "offline" ? "Ollama status offline" : "Ollama status offline/error",
        detail,
      );
    }
  }

  logBubbleClicked(): void {
    this.safetyGate.log(
      "info",
      "Ollama status bubble clicked",
      "Running existing provider connection test (no project data sent).",
    );
  }
}
