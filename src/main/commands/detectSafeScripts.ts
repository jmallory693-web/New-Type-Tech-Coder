import type {
  BlockedScriptInfo,
  PackageManagerId,
  PackageScriptEntry,
  SafeCheckKind,
  SafeScriptCandidate,
} from "../../shared/types";

/** Exact script names considered for Safe Checks (Stage 7). */
export const SAFE_CHECK_KINDS: SafeCheckKind[] = [
  "build",
  "test",
  "typecheck",
  "lint",
  "check",
  "format:check",
  "validate",
];

const DANGEROUS_NAME_TOKENS = [
  "deploy",
  "publish",
  "release",
  "upload",
  "push",
  "migrate",
  "seed",
  "reset",
  "clean",
  "delete",
  "remove",
  "rm",
  "install",
  "postinstall",
  "preinstall",
] as const;

/** Conservative patterns in script command strings. */
const DANGEROUS_VALUE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(rm\s+-rf|rmdir\s+\/s|del\s+\/[sfq]|Remove-Item\b)/i,
    reason: "Script value looks like a destructive delete command.",
  },
  {
    pattern: /\b(deploy|publish|release|upload)\b/i,
    reason: "Script value looks like deploy/publish/upload behavior.",
  },
  {
    pattern: /\b(git\s+push|gh\s+release|npm\s+publish|pnpm\s+publish|yarn\s+publish)\b/i,
    reason: "Script value looks like publish/push behavior.",
  },
  {
    pattern: /\b(migrate|seed|drop\s+database|prisma\s+migrate\s+reset)\b/i,
    reason: "Script value looks like database migrate/seed/reset behavior.",
  },
  {
    pattern: /\b(curl\s+.+\|\s*(ba)?sh|wget\s+.+\|\s*(ba)?sh)\b/i,
    reason: "Script value looks like downloading and executing remote code.",
  },
  {
    pattern: /\b(npm\s+i(nstall)?|pnpm\s+i(nstall)?|yarn\s+add|yarn\s+install)\b/i,
    reason: "Script value looks like dependency install (not auto-run in Stage 7).",
  },
  {
    pattern: /(^|[;&|]\s*)(sudo|runas)\b/i,
    reason: "Script value requests elevated privileges.",
  },
  {
    pattern: /\$\{[^}]+\}|`[^`]+`/,
    reason: "Script value uses shell expansion that is hard to review safely.",
  },
];

/**
 * Block unsafe shell operators in script values.
 * Allows common npm patterns like `cmd1 && cmd2` and `cmd1 || cmd2`.
 * Blocks `;`, pipes, background `&`, backticks, and redirects.
 */
function hasUnsafeShellChaining(scriptValue: string): boolean {
  const withoutSafeLogic = scriptValue
    .replace(/&&/g, " ")
    .replace(/\|\|/g, " ");
  return /[;&|`<>]/.test(withoutSafeLogic);
}

const DISPLAY_LABELS: Record<SafeCheckKind, string> = {
  build: "Run Build",
  test: "Run Test",
  typecheck: "Run Typecheck",
  lint: "Run Lint",
  check: "Run Check",
  "format:check": "Run Format Check",
  validate: "Run Validate",
};

export interface PackageManagerDetection {
  packageManager: PackageManagerId;
  warning: string | null;
  evidence: string;
}

export function detectPackageManager(
  lockFilesPresent: string[],
): PackageManagerDetection {
  const locks = new Set(lockFilesPresent.map((n) => n.toLowerCase()));
  const hasNpm = locks.has("package-lock.json");
  const hasPnpm = locks.has("pnpm-lock.yaml");
  const hasYarn = locks.has("yarn.lock");
  const count = Number(hasNpm) + Number(hasPnpm) + Number(hasYarn);

  if (count > 1) {
    if (hasNpm) {
      return {
        packageManager: "npm",
        warning:
          "Multiple lockfiles found. Using npm because package-lock.json is present.",
        evidence: "multiple-lockfiles",
      };
    }
    if (hasPnpm) {
      return {
        packageManager: "pnpm",
        warning:
          "Multiple lockfiles found. Using pnpm because pnpm-lock.yaml is present.",
        evidence: "multiple-lockfiles",
      };
    }
  }

  if (hasNpm) {
    return {
      packageManager: "npm",
      warning: null,
      evidence: "package-lock.json",
    };
  }
  if (hasPnpm) {
    return {
      packageManager: "pnpm",
      warning: null,
      evidence: "pnpm-lock.yaml",
    };
  }
  if (hasYarn) {
    return {
      packageManager: "yarn",
      warning: null,
      evidence: "yarn.lock",
    };
  }

  return {
    packageManager: "npm",
    warning:
      "No lockfile found. Defaulting to npm. Dependencies may need to be installed manually.",
    evidence: "default-npm",
  };
}

function nameLooksDangerous(scriptName: string): string | null {
  const lower = scriptName.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  for (const bad of DANGEROUS_NAME_TOKENS) {
    if (tokens.includes(bad) || lower === bad) {
      return `Script name “${scriptName}” looks risky (“${bad}”).`;
    }
  }
  return null;
}

function valueLooksDangerous(scriptValue: string): string | null {
  const trimmed = scriptValue.trim();
  if (!trimmed) {
    return "Script command is empty.";
  }
  if (hasUnsafeShellChaining(trimmed)) {
    return "Script value uses shell chaining (;, |, &, or backticks) that is blocked in Stage 7.";
  }
  for (const rule of DANGEROUS_VALUE_PATTERNS) {
    if (rule.pattern.test(trimmed)) {
      return rule.reason;
    }
  }
  return null;
}

/** Build argv for an allowlisted script. Never accepts free-typed commands. */
export function buildSafeArgv(
  packageManager: PackageManagerId,
  scriptName: string,
): string[] {
  if (packageManager === "yarn") {
    return ["yarn", "run", scriptName];
  }
  if (packageManager === "pnpm") {
    return ["pnpm", "run", scriptName];
  }
  if (scriptName === "test") {
    return ["npm", "test"];
  }
  return ["npm", "run", scriptName];
}

function plainEnglishFor(
  kind: SafeCheckKind,
  packageManager: PackageManagerId,
  scriptName: string,
): string {
  const argv = buildSafeArgv(packageManager, scriptName).join(" ");
  const action =
    kind === "build"
      ? "build/compile check"
      : kind === "test"
        ? "test check"
        : kind === "typecheck"
          ? "TypeScript typecheck"
          : kind === "lint"
            ? "lint check"
            : kind === "format:check"
              ? "format check"
              : kind === "validate"
                ? "validate check"
                : "project check";
  return `Run the project’s “${scriptName}” ${action} with: ${argv}`;
}

/**
 * Stage 11B: package managers auto-run pre/post lifecycle scripts.
 * Return related hook names that exist in package.json for this allowlisted kind.
 */
export function relatedLifecycleHookNames(
  kind: SafeCheckKind,
  scriptNames: Set<string>,
): string[] {
  const candidates = new Set<string>([`pre${kind}`, `post${kind}`]);

  // Conservative extras for format:check (colon scripts + bare format hooks).
  if (kind === "format:check") {
    candidates.add("preformat");
    candidates.add("postformat");
    candidates.add("preformat:check");
    candidates.add("postformat:check");
  }

  const found: string[] = [];
  for (const name of candidates) {
    if (scriptNames.has(name)) {
      found.push(name);
    }
  }
  return found.sort((a, b) => a.localeCompare(b));
}

export function lifecycleHookBlockReason(hooks: string[]): string {
  const list = hooks.join(", ");
  return (
    `This check was blocked because package managers can automatically run pre/post scripts. ` +
    `The project contains ${list}. A non-coder should review this before running it.`
  );
}

export interface SafeScriptDetectionResult {
  packageManager: PackageManagerId;
  packageManagerWarning: string | null;
  available: SafeScriptCandidate[];
  blocked: BlockedScriptInfo[];
  unavailable: BlockedScriptInfo[];
}

/**
 * Detect allowlisted safe scripts from package.json script entries.
 * Does not execute anything.
 */
export function detectSafeScripts(input: {
  packageScriptEntries: PackageScriptEntry[];
  lockFilesPresent: string[];
  packageJsonFound: boolean;
  packageJsonValid: boolean;
}): SafeScriptDetectionResult {
  const pm = detectPackageManager(input.lockFilesPresent);
  const available: SafeScriptCandidate[] = [];
  const blocked: BlockedScriptInfo[] = [];
  const unavailable: BlockedScriptInfo[] = [];

  if (!input.packageJsonFound) {
    for (const kind of SAFE_CHECK_KINDS) {
      unavailable.push({
        scriptName: kind,
        reason: "No package.json found, so no JavaScript safe checks are available.",
      });
    }
    return {
      packageManager: pm.packageManager,
      packageManagerWarning: pm.warning,
      available,
      blocked,
      unavailable,
    };
  }

  if (!input.packageJsonValid) {
    for (const kind of SAFE_CHECK_KINDS) {
      unavailable.push({
        scriptName: kind,
        reason: "package.json could not be parsed, so scripts cannot be reviewed safely.",
      });
    }
    return {
      packageManager: pm.packageManager,
      packageManagerWarning: pm.warning,
      available,
      blocked,
      unavailable,
    };
  }

  const byName = new Map(
    input.packageScriptEntries.map((entry) => [entry.name, entry] as const),
  );
  const allScriptNames = new Set(input.packageScriptEntries.map((e) => e.name));

  // Also note non-allowlisted scripts that look dangerous (for Review Pack transparency).
  for (const entry of input.packageScriptEntries) {
    if ((SAFE_CHECK_KINDS as string[]).includes(entry.name)) {
      continue;
    }
    const nameRisk = nameLooksDangerous(entry.name);
    if (nameRisk) {
      blocked.push({ scriptName: entry.name, reason: nameRisk });
    }
  }

  for (const kind of SAFE_CHECK_KINDS) {
    const entry = byName.get(kind);
    if (!entry) {
      unavailable.push({
        scriptName: kind,
        reason: `No “${kind}” script was found in package.json.`,
      });
      continue;
    }

    const lifecycleHooks = relatedLifecycleHookNames(kind, allScriptNames);
    const baseCandidate = {
      kind,
      scriptName: entry.name,
      scriptValue: entry.value,
      displayLabel: DISPLAY_LABELS[kind],
      plainEnglishCommand: plainEnglishFor(kind, pm.packageManager, entry.name),
      argvPreview: buildSafeArgv(pm.packageManager, entry.name).join(" "),
      lifecycleHooks,
    };

    const nameRisk = nameLooksDangerous(entry.name);
    if (nameRisk) {
      blocked.push({ scriptName: entry.name, reason: nameRisk });
      available.push({
        ...baseCandidate,
        available: false,
        blocked: true,
        reason: nameRisk,
      });
      continue;
    }

    const valueRisk = valueLooksDangerous(entry.value);
    if (valueRisk) {
      blocked.push({ scriptName: entry.name, reason: valueRisk });
      available.push({
        ...baseCandidate,
        available: false,
        blocked: true,
        reason: valueRisk,
      });
      continue;
    }

    if (lifecycleHooks.length > 0) {
      const reason = lifecycleHookBlockReason(lifecycleHooks);
      blocked.push({
        scriptName: entry.name,
        reason,
        lifecycleHooks: [...lifecycleHooks],
      });
      available.push({
        ...baseCandidate,
        available: false,
        blocked: true,
        reason,
      });
      continue;
    }

    // Exact allowlist match only — unclear aliases are unavailable.
    available.push({
      ...baseCandidate,
      available: true,
      blocked: false,
      reason: null,
    });
  }

  return {
    packageManager: pm.packageManager,
    packageManagerWarning: pm.warning,
    available,
    blocked,
    unavailable,
  };
}

export function emptySafeChecksStateMessage(hasProject: boolean): string {
  if (!hasProject) {
    return "Select a project folder, then Summarize Project to detect build/test checks.";
  }
  return "Summarize Project to detect safe package scripts.";
}
