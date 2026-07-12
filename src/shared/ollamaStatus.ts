/** Stage 65: plain-English Ollama status bubble labels and helpers. */

import type { OllamaBubbleStatus } from "./types";

export const OLLAMA_STATUS_LABELS: Record<OllamaBubbleStatus, string> = {
  "not-checked": "Ollama: Not checked",
  checking: "Ollama: Checking…",
  active: "Ollama: Active",
  offline: "Ollama: Offline",
  error: "Ollama: Error",
};

export const OLLAMA_ACTIVE_LIVE_QWEN_NOTE =
  "Ollama Active means local models are reachable. Live Qwen inspect remains disabled.";

export function ollamaStatusTone(
  status: OllamaBubbleStatus,
): "neutral" | "warning" | "ok" | "danger" {
  if (status === "active") return "ok";
  if (status === "checking") return "warning";
  if (status === "offline" || status === "error") return "danger";
  return "neutral";
}

export function looksLikeOllamaUnreachable(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return /not reachable|unreachable|ECONNREFUSED|fetch failed|network|offline|connection refused|failed to connect/i.test(
    message,
  );
}

export function classifyOllamaFailure(
  message: string | null | undefined,
): "offline" | "error" {
  if (looksLikeOllamaUnreachable(message)) return "offline";
  return "error";
}

export function buildOllamaStatusTooltip(input: {
  status: OllamaBubbleStatus;
  baseUrl: string | null;
  modelName: string | null;
  lastCheckedAt: string | null;
  installedModelCount: number | null;
  errorMessage: string | null;
  formatCheckedAt: (iso: string | null) => string;
}): string {
  const parts: string[] = [];

  if (input.status === "active") {
    parts.push("Ollama Active");
    if (input.installedModelCount != null && input.installedModelCount >= 0) {
      parts.push(
        input.installedModelCount === 1
          ? "1 model found"
          : `${input.installedModelCount} models found`,
      );
    }
  } else if (input.status === "offline") {
    parts.push("Ollama Offline");
  } else if (input.status === "error") {
    parts.push("Ollama Error");
  } else if (input.status === "checking") {
    parts.push("Checking Ollama connection");
  } else {
    parts.push("Ollama not checked yet");
  }

  if (input.baseUrl?.trim()) parts.push(input.baseUrl.trim());
  if (input.modelName?.trim()) parts.push(`Model: ${input.modelName.trim()}`);
  if (input.lastCheckedAt) {
    parts.push(`last checked ${input.formatCheckedAt(input.lastCheckedAt)}`);
  }
  if (input.errorMessage?.trim() && input.status !== "active") {
    parts.push(input.errorMessage.trim());
  }
  parts.push(OLLAMA_ACTIVE_LIVE_QWEN_NOTE);

  return parts.join(" — ");
}
