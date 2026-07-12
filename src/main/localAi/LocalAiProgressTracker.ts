import type {
  LocalAiProgressMode,
  LocalAiProgressState,
} from "../../shared/types";

/** Stage 63: in-progress metadata for long-running local AI requests. */
export class LocalAiProgressTracker {
  private state: LocalAiProgressState | null = null;

  start(
    mode: LocalAiProgressMode,
    label: string,
    modelName: string,
    baseUrl: string,
  ): LocalAiProgressState {
    this.state = {
      active: true,
      mode,
      label,
      modelName,
      baseUrl,
      startedAt: new Date().toISOString(),
    };
    return this.state;
  }

  getState(): LocalAiProgressState | null {
    return this.state;
  }

  isActive(): boolean {
    return Boolean(this.state?.active);
  }

  /** Clears progress and returns elapsed milliseconds. */
  stop(): number {
    if (!this.state?.startedAt) {
      this.state = null;
      return 0;
    }
    const elapsedMs = Date.now() - new Date(this.state.startedAt).getTime();
    this.state = null;
    return Math.max(0, elapsedMs);
  }
}
