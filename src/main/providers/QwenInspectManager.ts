import { spawn } from "node:child_process";
import type {
  OutsideReviewPack,
  ProjectInfo,
  ProjectScanResult,
  QwenCliStatus,
  QwenInspectState,
  QwenPromptPack,
  SafetyGateStatus,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import { buildQwenInspectPromptPack } from "./buildQwenInspectPromptPack";

/**
 * Stage 8A safety decision:
 * Live Qwen inspect stays DISABLED until the installed CLI can be verified
 * locally with inspect-only flags and post-run file-change checks.
 * Prompt Pack + CLI detection remain available.
 */
export const LIVE_QWEN_INSPECT_ENABLED = false;

export const LIVE_QWEN_DISABLED_REASON =
  "Live Qwen is disabled for safety. Use Generate Qwen Inspect Prompt and paste it into Qwen Code yourself.";

const DEFAULT_QWEN_COMMAND = "qwen";
const TEST_TIMEOUT_MS = 12_000;
const MAX_TEST_OUTPUT = 4_000;

function emptyState(command = DEFAULT_QWEN_COMMAND): QwenInspectState {
  return {
    liveInspectEnabled: LIVE_QWEN_INSPECT_ENABLED,
    liveInspectDisabledReason: LIVE_QWEN_DISABLED_REASON,
    command,
    cliStatus: "not-tested",
    lastTestMessage: null,
    lastTestAt: null,
    promptPack: null,
    lastReport: null,
    fileChangeVerification: null,
    statusMessage: LIVE_QWEN_DISABLED_REASON,
    testing: false,
  };
}

function normalizeCommand(input: string | undefined | null): string {
  const trimmed = (input ?? "").trim();
  return trimmed || DEFAULT_QWEN_COMMAND;
}

function looksLikeMissingCommand(errorMessage: string, stderr: string): boolean {
  const text = `${errorMessage}\n${stderr}`.toLowerCase();
  return (
    text.includes("enoent") ||
    text.includes("not recognized") ||
    text.includes("not found") ||
    text.includes("no such file")
  );
}

/**
 * Qwen Code CLI inspect-only manager (Stage 8A).
 * Detection + Prompt Pack only. Live inspect remains disabled.
 */
export class QwenInspectManager {
  private state: QwenInspectState = emptyState();

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): QwenInspectState {
    return {
      ...this.state,
      promptPack: this.state.promptPack
        ? { ...this.state.promptPack }
        : null,
      lastReport: this.state.lastReport ? { ...this.state.lastReport } : null,
    };
  }

  getCommand(): string {
    return this.state.command;
  }

  setCommand(command: string): void {
    const next = normalizeCommand(command);
    if (next === this.state.command) {
      return;
    }
    this.state = {
      ...this.state,
      command: next,
      cliStatus: "not-tested",
      lastTestMessage: null,
      lastTestAt: null,
      statusMessage: `Qwen command set to “${next}”. Test the CLI before relying on it.`,
    };
    this.safetyGate.log(
      "info",
      "Qwen command updated",
      `Command/path set to “${next}”. Live inspect remains disabled in Stage 8A.`,
    );
  }

  clearForProjectChange(): void {
    this.state = {
      ...emptyState(this.state.command),
      statusMessage: LIVE_QWEN_DISABLED_REASON,
    };
  }

  /** Restore a previously saved Prompt Pack from app history (no live Qwen run). */
  restorePromptPack(pack: QwenPromptPack): void {
    this.state = {
      ...this.state,
      promptPack: { ...pack },
      statusMessage:
        "Previous saved Qwen Prompt Pack restored from history. Generate again to refresh.",
    };
  }

  async testCli(): Promise<QwenInspectState> {
    if (this.state.testing) {
      return this.getState();
    }

    const command = normalizeCommand(this.state.command);
    this.state = {
      ...this.state,
      command,
      testing: true,
      statusMessage: "Testing Qwen CLI…",
    };
    this.safetyGate.log(
      "info",
      "Qwen CLI test started",
      `Running harmless version/help probe for “${command}” (no project edits).`,
    );

    try {
      const probe = await this.runHarmlessProbe(command);
      const combined = `${probe.stdout}\n${probe.stderr}`.trim();
      const preview = combined.slice(0, 280);

      if (probe.started === false) {
        const missing = looksLikeMissingCommand(probe.errorMessage, probe.stderr);
        this.state = {
          ...this.state,
          testing: false,
          cliStatus: missing ? "missing" : "failed",
          lastTestAt: new Date().toISOString(),
          lastTestMessage: missing
            ? `Qwen CLI was not found (“${command}”). Install Qwen Code or set the correct command path, then use Qwen Prompt Pack.`
            : `Qwen CLI test failed: ${probe.errorMessage || "Could not start the command."}`,
          statusMessage: missing
            ? `Qwen CLI not found. ${LIVE_QWEN_DISABLED_REASON}`
            : `Qwen CLI test failed. ${LIVE_QWEN_DISABLED_REASON}`,
        };
        this.safetyGate.log(
          "warning",
          "Qwen CLI test failed",
          this.state.lastTestMessage ?? "Test failed",
        );
        return this.getState();
      }

      // Any successful process start with version/help output counts as available.
      // Non-zero exit can still mean the binary exists (some CLIs use --help exit 1).
      const available =
        combined.length > 0 || probe.exitCode === 0 || probe.exitCode === 1;

      if (!available) {
        this.state = {
          ...this.state,
          testing: false,
          cliStatus: "failed",
          lastTestAt: new Date().toISOString(),
          lastTestMessage:
            "Qwen CLI started but returned no recognizable version/help output.",
          statusMessage: `Qwen CLI response unclear. ${LIVE_QWEN_DISABLED_REASON}`,
        };
        this.safetyGate.log(
          "warning",
          "Qwen CLI test failed",
          this.state.lastTestMessage ?? "Unclear output",
        );
        return this.getState();
      }

      this.state = {
        ...this.state,
        testing: false,
        cliStatus: "available",
        lastTestAt: new Date().toISOString(),
        lastTestMessage: preview
          ? `Qwen CLI responded. Live inspect still disabled. Output preview: ${preview}`
          : "Qwen CLI appears available. Live inspect still disabled — use Prompt Pack.",
        statusMessage: LIVE_QWEN_DISABLED_REASON,
      };
      this.safetyGate.log(
        "success",
        "Qwen CLI test succeeded",
        `“${command}” responded to a harmless probe. Live Qwen inspect remains disabled in Stage 8A.`,
      );
      return this.getState();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Qwen CLI test failed.";
      this.state = {
        ...this.state,
        testing: false,
        cliStatus: looksLikeMissingCommand(message, "") ? "missing" : "failed",
        lastTestAt: new Date().toISOString(),
        lastTestMessage: message,
        statusMessage: `${message} ${LIVE_QWEN_DISABLED_REASON}`,
      };
      this.safetyGate.log("warning", "Qwen CLI test failed", message);
      return this.getState();
    }
  }

  generatePromptPack(input: {
    userRequest: string;
    project: ProjectInfo | null;
    summary: ProjectScanResult | null;
    reviewPack: OutsideReviewPack | null;
    safety: SafetyGateStatus;
  }): QwenPromptPack {
    const pack = buildQwenInspectPromptPack(input);
    this.state = {
      ...this.state,
      promptPack: pack,
      statusMessage: pack.limitedContext
        ? "Qwen Prompt Pack generated with limited context."
        : "Qwen Prompt Pack ready to copy.",
    };
    this.safetyGate.log(
      pack.limitedContext ? "warning" : "success",
      "Qwen Prompt Pack generated",
      [
        pack.projectSelected ? "project selected" : "no project",
        pack.summaryAvailable ? "summary included" : "no summary",
        pack.reviewPackAvailable ? "review pack included" : "no review pack",
        "live inspect disabled",
      ].join("; "),
    );
    return pack;
  }

  recordPromptPackCopied(): void {
    if (!this.state.promptPack) {
      this.safetyGate.log(
        "warning",
        "Qwen Prompt Pack copy blocked",
        "No Qwen Prompt Pack available yet.",
      );
      return;
    }
    this.safetyGate.log(
      "success",
      "Qwen Prompt Pack copied",
      "Qwen Inspect Prompt Pack copied to clipboard for a manual Qwen Code session.",
    );
  }

  recordReportCopied(): void {
    if (!this.state.lastReport) {
      this.safetyGate.log(
        "warning",
        "Qwen inspect report copy blocked",
        "No live Qwen inspect report exists. Live inspect is disabled in Stage 8A.",
      );
      return;
    }
    this.safetyGate.log(
      "success",
      "Qwen inspect report copied",
      "Qwen inspect report copied to clipboard.",
    );
  }

  /**
   * Live inspect entry point — intentionally blocked in Stage 8A.
   */
  blockLiveInspect(): void {
    this.safetyGate.log(
      "blocked",
      "Qwen inspect blocked",
      LIVE_QWEN_DISABLED_REASON,
    );
    this.state = {
      ...this.state,
      statusMessage: LIVE_QWEN_DISABLED_REASON,
    };
  }

  private runHarmlessProbe(command: string): Promise<{
    started: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    errorMessage: string;
  }> {
    return new Promise((resolve) => {
      // Prefer --version; fall back behavior is handled by interpreting output.
      // Never pass project paths or prompts here.
      const args = ["--version"];
      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = (
        started: boolean,
        exitCode: number | null,
        errorMessage = "",
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          started,
          exitCode,
          stdout: stdout.slice(0, MAX_TEST_OUTPUT),
          stderr: stderr.slice(0, MAX_TEST_OUTPUT),
          errorMessage,
        });
      };

      let child;
      try {
        child = spawn(command, args, {
          windowsHide: true,
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, FORCE_COLOR: "0", CI: "true" },
        });
      } catch (error) {
        finish(
          false,
          null,
          error instanceof Error ? error.message : "Could not start Qwen CLI.",
        );
        return;
      }

      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
        finish(true, null, "Qwen CLI version probe timed out.");
      }, TEST_TIMEOUT_MS);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        finish(false, null, error.message);
      });
      child.on("close", (code) => {
        // If --version failed oddly, try --help once more only when no output.
        if ((stdout + stderr).trim().length === 0 && code !== 0) {
          this.runHelpProbe(command).then((help) => {
            if (help.started) {
              resolve({
                started: true,
                exitCode: help.exitCode,
                stdout: help.stdout,
                stderr: help.stderr,
                errorMessage: help.errorMessage,
              });
            } else {
              finish(true, code, help.errorMessage);
            }
          });
          return;
        }
        finish(true, code);
      });
    });
  }

  private runHelpProbe(command: string): Promise<{
    started: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    errorMessage: string;
  }> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (
        started: boolean,
        exitCode: number | null,
        errorMessage = "",
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          started,
          exitCode,
          stdout: stdout.slice(0, MAX_TEST_OUTPUT),
          stderr: stderr.slice(0, MAX_TEST_OUTPUT),
          errorMessage,
        });
      };

      let child;
      try {
        child = spawn(command, ["--help"], {
          windowsHide: true,
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, FORCE_COLOR: "0", CI: "true" },
        });
      } catch (error) {
        finish(
          false,
          null,
          error instanceof Error ? error.message : "Could not start Qwen CLI help.",
        );
        return;
      }

      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
        finish(true, null, "Qwen CLI help probe timed out.");
      }, TEST_TIMEOUT_MS);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => finish(false, null, error.message));
      child.on("close", (code) => finish(true, code));
    });
  }
}

export function createDefaultQwenState(): QwenInspectState {
  return emptyState();
}
