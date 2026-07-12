import { spawn, type ChildProcess } from "node:child_process";
import {
  withMissingDependenciesHelper,
} from "../../shared/userFacingMessages";
import type {
  PackageManagerId,
  SafeCheckKind,
  SafeChecksState,
  SafeCommandResult,
  SafeCommandStatus,
  SafeScriptCandidate,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import {
  buildSafeArgv,
  detectSafeScripts,
  emptySafeChecksStateMessage,
  SAFE_CHECK_KINDS,
} from "./detectSafeScripts";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OUTPUT_CHARS = 40_000;
const MAX_PACK_OUTPUT_CHARS = 4_000;
const MAX_ADVISOR_OUTPUT_CHARS = 3_000;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncateOutput(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, max)}\n\n…(output truncated for safety; ${text.length - max} more characters omitted)`,
    truncated: true,
  };
}

function stopChildProcess(child: ChildProcess): void {
  if (child.killed || child.exitCode !== null) {
    return;
  }
  const pid = child.pid;
  if (process.platform === "win32" && typeof pid === "number") {
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }
  try {
    child.kill();
  } catch {
    // ignore
  }
  setTimeout(() => {
    if (child.exitCode === null && !child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  }, 1500);
}

function plainEnglishForStatus(
  kind: SafeCheckKind,
  status: SafeCommandStatus,
  blockedReason: string | null,
): string {
  if (status === "blocked") {
    return blockedReason
      ? blockedReason
      : "This script was blocked because it looks risky.";
  }
  if (status === "running") {
    return `Running ${kind}…`;
  }
  if (status === "timed-out") {
    return "Command timed out. It may be stuck or taking too long.";
  }
  if (status === "cancelled") {
    return "Command cancelled. The check was stopped before it finished.";
  }
  if (status === "passed") {
    if (kind === "build") return "Build passed. The project compiled successfully.";
    if (kind === "test") return "Tests passed. No failing tests were reported.";
    if (kind === "typecheck") return "Typecheck passed. TypeScript reported no errors.";
    if (kind === "lint") return "Lint passed. No lint errors were reported.";
    if (kind === "format:check") return "Format check passed.";
    if (kind === "validate") return "Validate check passed.";
    return "Check passed.";
  }
  if (status === "failed") {
    if (kind === "build") {
      return "Build failed. The project did not compile successfully. Dependencies may need to be installed manually.";
    }
    if (kind === "test") {
      return "Test failed. The project has failing tests or errors. Dependencies may need to be installed manually.";
    }
    if (kind === "typecheck") {
      return "Typecheck failed. TypeScript reported errors, or the tool could not run.";
    }
    if (kind === "lint") {
      return "Lint failed. Lint reported problems, or the tool could not run.";
    }
    return "Check failed. See the command output for details. Dependencies may need to be installed manually.";
  }
  return "Not run yet.";
}

export function createEmptySafeChecksState(hasProject: boolean): SafeChecksState {
  return {
    packageManager: "npm",
    packageManagerWarning: null,
    packageJsonFound: false,
    available: [],
    blocked: [],
    unavailable: SAFE_CHECK_KINDS.map((kind) => ({
      scriptName: kind,
      reason: emptySafeChecksStateMessage(hasProject),
    })),
    lastResult: null,
    running: false,
    statusMessage: emptySafeChecksStateMessage(hasProject),
  };
}

export function truncateCommandOutputForPack(output: string): {
  text: string;
  truncated: boolean;
  included: boolean;
} {
  const trimmed = output.trim();
  if (!trimmed) {
    return { text: "", truncated: false, included: false };
  }
  const cut = truncateOutput(trimmed, MAX_PACK_OUTPUT_CHARS);
  return { text: cut.text, truncated: cut.truncated, included: true };
}

export function truncateCommandOutputForAdvisor(output: string): {
  text: string;
  truncated: boolean;
} {
  return truncateOutput(output.trim(), MAX_ADVISOR_OUTPUT_CHARS);
}

/**
 * Allowlisted Safe Command Runner (Stage 7).
 * Not a terminal. Not AI-driven. Project-root only. One command at a time.
 */
export class SafeCommandRunner {
  private state: SafeChecksState = createEmptySafeChecksState(false);
  private child: ChildProcess | null = null;
  private cancelRequested = false;
  private runGeneration = 0;

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): SafeChecksState {
    return {
      ...this.state,
      available: this.state.available.map((item) => ({ ...item })),
      blocked: this.state.blocked.map((item) => ({ ...item })),
      unavailable: this.state.unavailable.map((item) => ({ ...item })),
      lastResult: this.state.lastResult ? { ...this.state.lastResult } : null,
    };
  }

  clear(): void {
    void this.cancelRunning("Project changed — stopping any running safe check.");
    this.state = createEmptySafeChecksState(Boolean(this.safetyGate.getProject()));
  }

  refreshFromSummary(summary: {
    packageScriptEntries: Array<{ name: string; value: string }>;
    lockFilesPresent: string[];
    packageJsonValid: boolean;
    importantFiles: string[];
    packageScripts: string[];
  } | null): SafeChecksState {
    const project = this.safetyGate.getProject();
    if (!project) {
      this.state = createEmptySafeChecksState(false);
      return this.getState();
    }

    if (!summary) {
      this.state = {
        ...createEmptySafeChecksState(true),
        lastResult: this.state.lastResult,
        running: this.state.running,
      };
      return this.getState();
    }

    const packageJsonFound =
      summary.importantFiles.includes("package.json") ||
      summary.packageScripts.length > 0 ||
      summary.packageScriptEntries.length > 0 ||
      summary.packageJsonValid;

    const detected = detectSafeScripts({
      packageScriptEntries: summary.packageScriptEntries,
      lockFilesPresent: summary.lockFilesPresent,
      packageJsonFound,
      packageJsonValid: summary.packageJsonValid,
    });

    const runnable = detected.available.filter((item) => item.available && !item.blocked);
    const blockedFromAllowlist = detected.available.filter((item) => item.blocked);

    this.safetyGate.log(
      "info",
      "Safe scripts detected",
      runnable.length > 0
        ? `Available: ${runnable.map((s) => s.scriptName).join(", ")}. Package manager: ${detected.packageManager}.`
        : `No runnable safe scripts. Package manager: ${detected.packageManager}.`,
    );

    const blockedSeen = new Set<string>();
    for (const item of [...blockedFromAllowlist, ...detected.blocked]) {
      const reason =
        "reason" in item && typeof item.reason === "string" ? item.reason : null;
      if (!reason || blockedSeen.has(item.scriptName)) continue;
      blockedSeen.add(item.scriptName);
      this.safetyGate.log(
        "blocked",
        "Script blocked with reason",
        `${item.scriptName}: ${reason}`,
      );
    }

    this.state = {
      packageManager: detected.packageManager,
      packageManagerWarning: detected.packageManagerWarning,
      packageJsonFound,
      available: detected.available,
      blocked: detected.blocked,
      unavailable: detected.unavailable,
      lastResult: this.state.lastResult,
      running: this.state.running,
      statusMessage: detected.packageManagerWarning
        ? detected.packageManagerWarning
        : runnable.length > 0
          ? `${runnable.length} safe check(s) available. Nothing runs until you click a button.`
          : packageJsonFound
            ? "No allowlisted safe scripts are available to run."
            : "No package.json found, so no JavaScript safe checks are available.",
    };

    return this.getState();
  }

  findCandidate(kind: SafeCheckKind): SafeScriptCandidate | null {
    return this.state.available.find((item) => item.kind === kind) ?? null;
  }

  async runAllowlistedCheck(kind: SafeCheckKind): Promise<SafeCommandResult> {
    if (this.state.running || this.child) {
      const blocked = this.makeBlockedResult(
        kind,
        kind,
        "Another safe check is already running. Wait for it to finish or cancel it.",
      );
      this.state.lastResult = blocked;
      this.state.statusMessage = blocked.plainEnglishSummary;
      this.safetyGate.log("blocked", "Command blocked", blocked.blockedReason ?? blocked.plainEnglishSummary);
      return blocked;
    }

    const project = this.safetyGate.getProject();
    if (!project) {
      const blocked = this.makeBlockedResult(
        kind,
        kind,
        "No project folder selected. Choose a project folder first.",
      );
      this.state.lastResult = blocked;
      this.state.statusMessage = blocked.plainEnglishSummary;
      this.safetyGate.log("blocked", "Command blocked", blocked.blockedReason ?? "");
      return blocked;
    }

    const gate = this.safetyGate.checkSafeCommand(kind, project.normalizedPath);
    if (!gate.allowed) {
      const blocked = this.makeBlockedResult(
        kind,
        kind,
        gate.denyReason ?? "Blocked by Safety Gate.",
      );
      this.state.lastResult = blocked;
      this.state.statusMessage = blocked.plainEnglishSummary;
      return blocked;
    }

    const candidate = this.findCandidate(kind);
    if (!candidate) {
      const blocked = this.makeBlockedResult(
        kind,
        kind,
        `No “${kind}” safe check is available. Summarize Project first, or the script is missing.`,
      );
      this.state.lastResult = blocked;
      this.state.statusMessage = blocked.plainEnglishSummary;
      this.safetyGate.log("blocked", "Command blocked", blocked.blockedReason ?? "");
      return blocked;
    }

    if (!candidate.available || candidate.blocked) {
      const blocked = this.makeBlockedResult(
        kind,
        candidate.scriptName,
        candidate.reason ?? "This script was blocked because it looks risky.",
      );
      this.state.lastResult = blocked;
      this.state.statusMessage = blocked.plainEnglishSummary;
      if ((candidate.lifecycleHooks ?? []).length > 0) {
        this.safetyGate.log(
          "blocked",
          "Lifecycle hook block",
          `Blocked “${candidate.scriptName}” because related lifecycle hooks exist: ${(candidate.lifecycleHooks ?? []).join(", ")}.`,
        );
      } else {
        this.safetyGate.log(
          "blocked",
          "Script blocked with reason",
          `${candidate.scriptName}: ${blocked.blockedReason}`,
        );
      }
      return blocked;
    }

    if (!(SAFE_CHECK_KINDS as string[]).includes(candidate.scriptName)) {
      const blocked = this.makeBlockedResult(
        kind,
        candidate.scriptName,
        "Command name is not on the Stage 7 allowlist.",
      );
      this.state.lastResult = blocked;
      this.state.statusMessage = blocked.plainEnglishSummary;
      this.safetyGate.log("blocked", "Command blocked", blocked.blockedReason ?? "");
      return blocked;
    }

    const argv = buildSafeArgv(this.state.packageManager, candidate.scriptName);
    const confirmDetail = `${candidate.plainEnglishCommand} (cwd: ${project.normalizedPath})`;
    this.safetyGate.log(
      "info",
      "Command confirmation shown",
      confirmDetail,
    );

    return this.execute(kind, candidate.scriptName, this.state.packageManager, argv, project.normalizedPath);
  }

  async cancelRunning(reason = "User cancelled the running safe check."): Promise<SafeChecksState> {
    if (!this.child && !this.state.running) {
      return this.getState();
    }

    this.cancelRequested = true;
    this.safetyGate.log("warning", "Command cancelled", reason);

    if (this.child) {
      stopChildProcess(this.child);
    }

    return this.getState();
  }

  private makeBlockedResult(
    kind: SafeCheckKind,
    scriptName: string,
    reason: string,
  ): SafeCommandResult {
    return {
      id: makeId(),
      kind,
      scriptName,
      packageManager: this.state.packageManager,
      argv: [],
      cwd: this.safetyGate.getProject()?.normalizedPath ?? "",
      status: "blocked",
      exitCode: null,
      startedAt: null,
      endedAt: new Date().toISOString(),
      durationMs: null,
      stdout: "",
      stderr: "",
      combinedOutput: "",
      outputTruncated: false,
      plainEnglishSummary: plainEnglishForStatus(kind, "blocked", reason),
      blockedReason: reason,
    };
  }

  private execute(
    kind: SafeCheckKind,
    scriptName: string,
    packageManager: PackageManagerId,
    argv: string[],
    cwd: string,
  ): Promise<SafeCommandResult> {
    const generation = ++this.runGeneration;
    this.cancelRequested = false;

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const [command, ...args] = argv;

    const runningResult: SafeCommandResult = {
      id: makeId(),
      kind,
      scriptName,
      packageManager,
      argv,
      cwd,
      status: "running",
      exitCode: null,
      startedAt,
      endedAt: null,
      durationMs: null,
      stdout: "",
      stderr: "",
      combinedOutput: "",
      outputTruncated: false,
      plainEnglishSummary: plainEnglishForStatus(kind, "running", null),
      blockedReason: null,
    };

    this.state.running = true;
    this.state.lastResult = runningResult;
    this.state.statusMessage = runningResult.plainEnglishSummary;

    this.safetyGate.log(
      "info",
      "Command started",
      `${argv.join(" ")} in ${cwd}`,
    );

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const resolveCommand = (name: string): string => name;

      const finish = (status: SafeCommandStatus, exitCode: number | null) => {
        if (settled || generation !== this.runGeneration) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.child = null;
        this.state.running = false;

        const combinedRaw = [stdout, stderr].filter(Boolean).join("\n").trim();
        const cut = truncateOutput(combinedRaw, MAX_OUTPUT_CHARS);
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startedMs;
        const finalStatus =
          this.cancelRequested && status !== "timed-out" ? "cancelled" : status;

        const result: SafeCommandResult = {
          ...runningResult,
          status: finalStatus,
          exitCode,
          endedAt,
          durationMs,
          stdout: truncateOutput(stdout, MAX_OUTPUT_CHARS).text,
          stderr: truncateOutput(stderr, MAX_OUTPUT_CHARS).text,
          combinedOutput: cut.text,
          outputTruncated: cut.truncated,
          plainEnglishSummary:
            finalStatus === "failed"
              ? withMissingDependenciesHelper(
                  plainEnglishForStatus(kind, finalStatus, null),
                  cut.text,
                )
              : plainEnglishForStatus(kind, finalStatus, null),
          blockedReason: null,
        };

        this.state.lastResult = result;
        this.state.statusMessage = result.plainEnglishSummary;

        if (finalStatus === "passed") {
          this.safetyGate.log(
            "success",
            "Command succeeded",
            `${argv.join(" ")} · exit ${exitCode ?? 0} · ${durationMs}ms`,
          );
        } else if (finalStatus === "timed-out") {
          this.safetyGate.log(
            "warning",
            "Command timed out",
            `${argv.join(" ")} · stopped after ${DEFAULT_TIMEOUT_MS}ms`,
          );
        } else if (finalStatus === "cancelled") {
          this.safetyGate.log(
            "warning",
            "Command cancelled",
            `${argv.join(" ")} · stopped by user`,
          );
        } else {
          this.safetyGate.log(
            "warning",
            "Command failed",
            `${argv.join(" ")} · exit ${exitCode ?? "unknown"} · ${durationMs}ms`,
          );
        }

        resolve(result);
      };

      let child: ChildProcess;
      try {
        child = spawn(resolveCommand(command), args, {
          cwd,
          windowsHide: true,
          // Windows needs shell to resolve npm/pnpm/yarn.cmd; argv is allowlisted only.
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            // Avoid interactive prompts hanging the runner.
            CI: process.env.CI ?? "true",
            FORCE_COLOR: "0",
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not start the command.";
        const failed: SafeCommandResult = {
          ...runningResult,
          status: "failed",
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startedMs,
          plainEnglishSummary: withMissingDependenciesHelper(
            `Check failed. Could not start the command. ${message} Dependencies may need to be installed manually.`,
            message,
          ),
          combinedOutput: message,
        };
        this.child = null;
        this.state.running = false;
        this.state.lastResult = failed;
        this.state.statusMessage = failed.plainEnglishSummary;
        this.safetyGate.log("warning", "Command failed", message);
        resolve(failed);
        return;
      }

      this.child = child;

      const timer = setTimeout(() => {
        if (settled) return;
        stopChildProcess(child);
        finish("timed-out", null);
      }, DEFAULT_TIMEOUT_MS);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (stdout.length > MAX_OUTPUT_CHARS * 2) {
          stdout = stdout.slice(-MAX_OUTPUT_CHARS);
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
        if (stderr.length > MAX_OUTPUT_CHARS * 2) {
          stderr = stderr.slice(-MAX_OUTPUT_CHARS);
        }
      });
      child.on("error", (error) => {
        stderr += `\n${error.message}`;
        finish("failed", null);
      });
      child.on("close", (code) => {
        if (this.cancelRequested) {
          finish("cancelled", code);
          return;
        }
        if (code === 0) {
          finish("passed", 0);
        } else {
          finish("failed", code ?? 1);
        }
      });
    });
  }
}
