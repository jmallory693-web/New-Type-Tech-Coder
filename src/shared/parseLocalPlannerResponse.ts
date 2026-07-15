/**
 * Stage 133: Deterministic Local Planner Response parser + safety analysis.
 * No AI. No FS. No source reads. Heading/bullet heuristics only.
 */

import {
  LOCAL_PLANNER_STRICTNESS_LABELS,
  LOCAL_PLANNER_TARGET_MODEL_LABELS,
  type LocalPlannerBuildBriefMode,
  type LocalPlannerStrictness,
  type LocalPlannerTargetModelType,
} from "./buildModeLocalPlannerBuildBrief";
import {
  emptyLocalPlannerResponseParsedFields,
  type LocalPlannerResponseDecision,
  type LocalPlannerResponseImportRecord,
  type LocalPlannerResponseParsedFields,
  type LocalPlannerResponseSafetyWarning,
  type LocalPlannerResponseStatus,
} from "./buildModeLocalPlannerResponseImport";

export type AnalyzeLocalPlannerResponseInput = {
  rawResponseText: string;
  sourceBriefGeneratedAt: string | null;
  sourceBriefMode: LocalPlannerBuildBriefMode | null;
  sourceBriefStrictness: LocalPlannerStrictness | null;
  sourceBriefTargetLocalModelType: LocalPlannerTargetModelType | null;
  sourceSelectedTaskId: string | null;
  sourceSelectedTaskTitle: string | null;
  briefExists: boolean;
  briefStale: boolean;
};

export type AnalyzeLocalPlannerResponseResult = {
  record: LocalPlannerResponseImportRecord | null;
  blockedReasons: string[];
};

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripBulletPrefix(line: string): string {
  return line
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/^\*\*(.+?)\*\*:?\s*/, "$1")
    .trim();
}

type SectionKey =
  | "recommendedNextTask"
  | "whyThisTask"
  | "likelyFiles"
  | "filesNotToTouch"
  | "risks"
  | "acceptanceChecks"
  | "coderPromptOutline"
  | "criticQuestions"
  | "requestedCommands"
  | "stopConditions"
  | "unknowns";

const SECTION_MATCHERS: Array<{ key: SectionKey; patterns: RegExp[] }> = [
  {
    key: "recommendedNextTask",
    patterns: [
      /^#{1,4}\s*recommended\s+next\s+task\b/i,
      /^#{1,4}\s*next\s+task\b/i,
      /^\**\s*1[.)]?\s*\**\s*recommended\s+next\s+task\b/i,
      /^\**\s*1[.)]?\s*\**\s*next\s+task\b/i,
    ],
  },
  {
    key: "whyThisTask",
    patterns: [
      /^#{1,4}\s*why\s+this\s+task\b/i,
      /^#{1,4}\s*why\s+first\b/i,
      /^\**\s*2[.)]?\s*\**\s*why\s+(this\s+)?task\b/i,
      /^\**\s*2[.)]?\s*\**\s*why\s+first\b/i,
    ],
  },
  {
    key: "likelyFiles",
    patterns: [
      /^#{1,4}\s*likely\s+files\b/i,
      /^#{1,4}\s*files\s+likely\b/i,
      /^#{1,4}\s*files\s+involve\b/i,
      /^\**\s*3[.)]?\s*\**\s*files\s+(likely|involve)\b/i,
    ],
  },
  {
    key: "filesNotToTouch",
    patterns: [
      /^#{1,4}\s*files\s+(?:that\s+)?(?:should\s+)?not\s+(?:(?:be|to)\s+)?touch/i,
      /^#{1,4}\s*do\s+not\s+touch\b/i,
      /^\**\s*4[.)]?\s*\**\s*(?:files\s+)?(?:that\s+)?(?:should\s+)?not\s+(?:(?:be|to)\s+)?touch/i,
      /^\**\s*4[.)]?\s*\**\s*do\s+not\s+touch\b/i,
    ],
  },
  {
    key: "risks",
    patterns: [/^#{1,4}\s*risks?\b/i, /^\**\s*5[.)]?\s*\**\s*risks?\b/i],
  },
  {
    key: "acceptanceChecks",
    patterns: [
      /^#{1,4}\s*acceptance\s+checks?\b/i,
      /^\**\s*6[.)]?\s*\**\s*acceptance\s+checks?\b/i,
    ],
  },
  {
    key: "coderPromptOutline",
    patterns: [
      /^#{1,4}\s*coder[- ]?model\s+prompt\s+outline\b/i,
      /^#{1,4}\s*coder\s+prompt\s+outline\b/i,
      /^\**\s*7[.)]?\s*\**\s*coder[- ]?(?:model\s+)?prompt\s+outline\b/i,
    ],
  },
  {
    key: "criticQuestions",
    patterns: [
      /^#{1,4}\s*critic(?:-model)?\s+(?:review\s+)?questions?\b/i,
      /^\**\s*8[.)]?\s*\**\s*critic(?:-model)?\s+(?:review\s+)?questions?\b/i,
    ],
  },
  {
    key: "requestedCommands",
    patterns: [
      /^#{1,4}\s*(?:requested\s+)?commands?\b/i,
      /^#{1,4}\s*manual\s+commands?\b/i,
      /^\**\s*9[.)]?\s*\**\s*(?:commands?|manual\s+commands?)\b/i,
    ],
  },
  {
    key: "stopConditions",
    patterns: [
      /^#{1,4}\s*stop\s+conditions?\b/i,
      /^\**\s*10[.)]?\s*\**\s*stop\s+conditions?\b/i,
      /^\**\s*11[.)]?\s*\**\s*stop\s+conditions?\b/i,
    ],
  },
];

function matchSectionKey(line: string): SectionKey | null {
  const trimmed = line.trim();
  for (const entry of SECTION_MATCHERS) {
    if (entry.patterns.some((re) => re.test(trimmed))) return entry.key;
  }
  return null;
}

function collectLinesAsList(body: string): string[] {
  const lines = body
    .split("\n")
    .map((l) => stripBulletPrefix(l))
    .filter((l) => l.length > 0 && !/^#+\s/.test(l));
  return lines.slice(0, 40);
}

function collectLinesAsText(body: string): string | null {
  const text = body
    .split("\n")
    .map((l) => stripBulletPrefix(l))
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
  return text ? text.slice(0, 4000) : null;
}

export function parseLocalPlannerResponseText(
  rawResponseText: string,
): LocalPlannerResponseParsedFields {
  const text = normalizeNewlines(rawResponseText).trim();
  const parsed = emptyLocalPlannerResponseParsedFields();
  if (!text) {
    parsed.unknowns.push("Empty response.");
    return parsed;
  }

  const lines = text.split("\n");
  const sections: Partial<Record<SectionKey, string[]>> = {};
  let current: SectionKey | null = null;

  for (const line of lines) {
    const key = matchSectionKey(line);
    if (key) {
      current = key;
      if (!sections[current]) sections[current] = [];
      // Keep trailing text after heading on same line (e.g. "1. Next task: Foo")
      const after = line.replace(/^#{1,4}\s*/, "").replace(/^\**\s*\d+[.)]?\s*\**\s*/, "");
      const colon = after.indexOf(":");
      if (colon >= 0) {
        const rest = after.slice(colon + 1).trim();
        if (rest) sections[current]!.push(rest);
      }
      continue;
    }
    if (current) {
      sections[current]!.push(line);
    }
  }

  const join = (key: SectionKey) =>
    sections[key] ? sections[key]!.join("\n").trim() : "";

  parsed.recommendedNextTask = collectLinesAsText(join("recommendedNextTask"));
  parsed.whyThisTask = collectLinesAsText(join("whyThisTask"));
  parsed.likelyFiles = collectLinesAsList(join("likelyFiles"));
  parsed.filesNotToTouch = collectLinesAsList(join("filesNotToTouch"));
  parsed.risks = collectLinesAsList(join("risks"));
  parsed.acceptanceChecks = collectLinesAsList(join("acceptanceChecks"));
  parsed.coderPromptOutline = collectLinesAsText(join("coderPromptOutline"));
  parsed.criticQuestions = collectLinesAsList(join("criticQuestions"));
  parsed.requestedCommands = collectLinesAsList(join("requestedCommands")).filter(
    (c) => !/^(none|n\/a|no commands?\.?)$/i.test(c),
  );
  parsed.stopConditions = collectLinesAsList(join("stopConditions"));

  const missing: string[] = [];
  if (!parsed.recommendedNextTask) missing.push("recommended next task");
  if (parsed.likelyFiles.length === 0) missing.push("likely files");
  if (parsed.filesNotToTouch.length === 0) missing.push("files not to touch");
  if (parsed.risks.length === 0) missing.push("risks");
  if (parsed.acceptanceChecks.length === 0) missing.push("acceptance checks");
  if (!parsed.coderPromptOutline) missing.push("coder prompt outline");
  if (parsed.criticQuestions.length === 0) missing.push("critic questions");
  if (parsed.stopConditions.length === 0) missing.push("stop conditions");
  parsed.unknowns = missing.map((m) => `Missing field: ${m}`);

  return parsed;
}

export function analyzeLocalPlannerResponseSafety(
  rawResponseText: string,
  parsed: LocalPlannerResponseParsedFields,
): LocalPlannerResponseSafetyWarning[] {
  const text = normalizeNewlines(rawResponseText);
  const lower = text.toLowerCase();
  const warnings: LocalPlannerResponseSafetyWarning[] = [];

  const add = (
    id: string,
    message: string,
    severity: "caution" | "blocked",
  ) => {
    if (!warnings.some((w) => w.id === id)) {
      warnings.push({ id, message, severity });
    }
  };

  if (
    /\b(?:nttc|new type tech coder)\b.{0,40}\b(?:run|execute|invoke)\b.{0,40}\bcommands?\b/i.test(
      text,
    ) ||
    /\bask(?:s|ing)?\s+nttc\s+to\s+run\b/i.test(text) ||
    /\bnttc\s+should\s+run\b/i.test(text)
  ) {
    add(
      "asks-nttc-run-commands",
      "asks NTTC to run commands",
      "blocked",
    );
  }

  if (
    /\bask(?:s|ing)?\s+nttc\s+to\s+install\b/i.test(text) ||
    /\bnttc\s+(?:should|must)\s+install\b/i.test(text) ||
    /\b(?:run|execute)\s+npm\s+install\b/i.test(text)
  ) {
    add(
      "asks-nttc-install",
      "asks NTTC to install packages",
      "blocked",
    );
  }

  if (
    /\bask(?:s|ing)?\s+nttc\s+to\s+apply\b.{0,20}\bpatch/i.test(text) ||
    /\bapply\s+patch\b/i.test(text) ||
    /\bnttc\s+(?:should|must)\s+apply\b.{0,20}\bpatch/i.test(text)
  ) {
    add(
      "asks-nttc-apply-patch",
      "asks NTTC to apply patches",
      "blocked",
    );
  }

  if (
    /\bbroad\s+rewrite\b/i.test(text) ||
    /\brewrite\s+(?:the\s+)?(?:entire|whole)\s+(?:app|project|codebase)\b/i.test(
      text,
    ) ||
    /\brefactor\s+(?:the\s+)?entire\b/i.test(text)
  ) {
    add("asks-broad-rewrite", "asks for broad rewrite", "blocked");
  }

  if (
    /\b(?:edit|touch|modify|change)\s+(?:\d{2,}|many|dozens|all)\s+files\b/i.test(
      text,
    ) ||
    parsed.likelyFiles.length >= 12
  ) {
    add("asks-edit-many-files", "asks to edit many files", "blocked");
  }

  if (
    /\binvisible\s+(?:project\s+)?access\b/i.test(text) ||
    /\bhidden\s+(?:project\s+)?access\b/i.test(text) ||
    /\bbrowse\s+(?:the\s+)?project\s+directly\b/i.test(text)
  ) {
    add(
      "mentions-hidden-access",
      "mentions hidden/invisible project access",
      "blocked",
    );
  }

  if (
    /\bread(?:ing)?\s+(?:the\s+)?entire\s+repo\b/i.test(text) ||
    /\brecursive(?:ly)?\s+scan\b/i.test(text) ||
    /\bautomatically\s+read\s+(?:all|every)\s+files?\b/i.test(text)
  ) {
    add(
      "mentions-read-entire-repo",
      "mentions reading entire repo automatically",
      "blocked",
    );
  }

  if (
    /\b(?:api[_ -]?keys?|secrets?|\.env\b|password|credential)/i.test(text) &&
    /\b(?:read|exfil|extract|leak|include)\b/i.test(text)
  ) {
    add(
      "mentions-secrets",
      "mentions secrets/env/API keys",
      "blocked",
    );
  }

  if (/\boverwrit(?:e|ing)\b/i.test(text)) {
    add("mentions-overwrite", "mentions overwriting files", "blocked");
  }

  if (/\bdelet(?:e|ing)\s+files?\b/i.test(text) || /\brm\s+-rf\b/i.test(text)) {
    add("mentions-delete", "mentions deleting files", "blocked");
  }

  if (
    /\bmodify(?:ing)?\s+package\.json\s+scripts?\b/i.test(text) ||
    /\bunsafe(?:ly)?\s+(?:modify|change).{0,30}scripts?\b/i.test(text)
  ) {
    add(
      "mentions-unsafe-scripts",
      "mentions modifying package scripts unsafely",
      "blocked",
    );
  }

  if (parsed.acceptanceChecks.length === 0) {
    add("missing-acceptance-checks", "missing acceptance checks", "caution");
  }
  if (parsed.stopConditions.length === 0) {
    add("missing-stop-conditions", "missing stop conditions", "caution");
  }
  if (parsed.filesNotToTouch.length === 0) {
    add("missing-files-not-to-touch", "missing files-not-to-touch", "caution");
  }

  if (
    !parsed.recommendedNextTask ||
    parsed.recommendedNextTask.length < 12 ||
    /^(todo|tbd|something|whatever)\b/i.test(parsed.recommendedNextTask)
  ) {
    add("too-vague", "too vague for coder model", "caution");
  }

  if (
    parsed.likelyFiles.length >= 8 ||
    (parsed.coderPromptOutline && parsed.coderPromptOutline.length > 2500) ||
    text.length > 12000
  ) {
    add(
      "too-large-for-slm",
      "too large for small local model",
      "caution",
    );
  }

  if (parsed.requestedCommands.length > 0) {
    add(
      "lists-commands",
      "lists requested commands (human-only notes — NTTC will not run them)",
      "caution",
    );
  }

  // Soft detect "NTTC run" without earlier match
  if (
    lower.includes("have nttc run") ||
    lower.includes("let nttc install") ||
    lower.includes("nttc apply patch")
  ) {
    if (!warnings.some((w) => w.id.startsWith("asks-nttc"))) {
      add(
        "asks-nttc-action",
        "asks NTTC to run commands",
        "blocked",
      );
    }
  }

  return warnings;
}

export function deriveLocalPlannerResponseStatus(
  warnings: LocalPlannerResponseSafetyWarning[],
  parsed: LocalPlannerResponseParsedFields,
): LocalPlannerResponseStatus {
  if (warnings.some((w) => w.severity === "blocked")) return "Blocked";
  if (!parsed.recommendedNextTask) return "Blocked";
  if (warnings.some((w) => w.severity === "caution")) return "Caution";
  return "Good";
}

export function deriveLocalPlannerResponseDecision(
  status: LocalPlannerResponseStatus,
): LocalPlannerResponseDecision {
  if (status === "Good") return "Ready for coder prompt prep";
  if (status === "Caution") return "Needs revision";
  return "Blocked until corrected";
}

function bulletOrMissing(items: string[], missingLabel: string): string {
  if (items.length === 0) return `- (${missingLabel})`;
  return items.map((i) => `- ${i}`).join("\n");
}

export function buildLocalPlannerResponseSummaryMarkdown(input: {
  status: LocalPlannerResponseStatus;
  decision: LocalPlannerResponseDecision;
  parsed: LocalPlannerResponseParsedFields;
  warnings: LocalPlannerResponseSafetyWarning[];
  sourceBriefGeneratedAt: string | null;
  sourceBriefMode: LocalPlannerBuildBriefMode | null;
  sourceBriefStrictness: LocalPlannerStrictness | null;
  sourceBriefTargetLocalModelType: LocalPlannerTargetModelType | null;
  sourceSelectedTaskTitle: string | null;
}): string {
  const warningsBlock =
    input.warnings.length === 0
      ? "- (none)"
      : input.warnings
          .map((w) => `- **${w.severity}**: ${w.message}`)
          .join("\n");

  return [
    "# NTTC Local Planner Response Summary",
    "",
    "## Status",
    input.status,
    "",
    "## Source",
    `- Planner brief generated at: ${input.sourceBriefGeneratedAt ?? "(unknown)"}`,
    `- Mode: ${input.sourceBriefMode ?? "(unknown)"}`,
    `- Selected task: ${input.sourceSelectedTaskTitle ?? "(planner chose / none)"}`,
    `- Target local model type: ${
      input.sourceBriefTargetLocalModelType
        ? LOCAL_PLANNER_TARGET_MODEL_LABELS[input.sourceBriefTargetLocalModelType]
        : "(unknown)"
    }`,
    `- Strictness: ${
      input.sourceBriefStrictness
        ? LOCAL_PLANNER_STRICTNESS_LABELS[input.sourceBriefStrictness]
        : "(unknown)"
    }`,
    "",
    "## Recommended Next Task",
    input.parsed.recommendedNextTask ?? "(missing)",
    "",
    "## Why This Task",
    input.parsed.whyThisTask ?? "(missing)",
    "",
    "## Likely Files",
    bulletOrMissing(input.parsed.likelyFiles, "missing"),
    "",
    "## Files Not To Touch",
    bulletOrMissing(input.parsed.filesNotToTouch, "missing"),
    "",
    "## Risks",
    bulletOrMissing(input.parsed.risks, "missing"),
    "",
    "## Acceptance Checks",
    bulletOrMissing(input.parsed.acceptanceChecks, "missing"),
    "",
    "## Coder Prompt Outline",
    input.parsed.coderPromptOutline ?? "(missing)",
    "",
    "## Critic Review Questions",
    bulletOrMissing(input.parsed.criticQuestions, "missing"),
    "",
    "## Requested Commands",
    "These are human-only notes. NTTC will not run commands.",
    bulletOrMissing(input.parsed.requestedCommands, "none listed"),
    "",
    "## Stop Conditions",
    bulletOrMissing(input.parsed.stopConditions, "missing"),
    "",
    "## Missing / Unclear Items",
    bulletOrMissing(input.parsed.unknowns, "none"),
    "",
    "## Safety Warnings",
    warningsBlock,
    "",
    "## NTTC Decision",
    input.decision,
    "",
    "## Reminder",
    "This summary is an untrusted claim review. NTTC did not call AI, write files, install packages, apply patches, or run commands.",
  ].join("\n");
}

export function evaluateLocalPlannerResponseImportPreconditions(input: {
  briefExists: boolean;
  briefStale: boolean;
}): { canAnalyze: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.briefExists) {
    reasons.push("Generate a Local Planner Build Brief first.");
  } else if (input.briefStale) {
    reasons.push(
      "Local Planner Build Brief is stale — regenerate it before analyzing a response.",
    );
  }
  return { canAnalyze: reasons.length === 0, reasons };
}

export function analyzeLocalPlannerResponse(
  input: AnalyzeLocalPlannerResponseInput,
): AnalyzeLocalPlannerResponseResult {
  const readiness = evaluateLocalPlannerResponseImportPreconditions({
    briefExists: input.briefExists,
    briefStale: input.briefStale,
  });
  if (!readiness.canAnalyze) {
    return { record: null, blockedReasons: readiness.reasons };
  }

  const raw = normalizeNewlines(input.rawResponseText).trim();
  if (!raw) {
    return {
      record: null,
      blockedReasons: ["Paste a non-empty local planner response first."],
    };
  }

  const parsed = parseLocalPlannerResponseText(raw);
  const safetyWarnings = analyzeLocalPlannerResponseSafety(raw, parsed);
  const status = deriveLocalPlannerResponseStatus(safetyWarnings, parsed);
  const decision = deriveLocalPlannerResponseDecision(status);
  const analyzedAt = new Date().toISOString();
  const summaryMarkdown = buildLocalPlannerResponseSummaryMarkdown({
    status,
    decision,
    parsed,
    warnings: safetyWarnings,
    sourceBriefGeneratedAt: input.sourceBriefGeneratedAt,
    sourceBriefMode: input.sourceBriefMode,
    sourceBriefStrictness: input.sourceBriefStrictness,
    sourceBriefTargetLocalModelType: input.sourceBriefTargetLocalModelType,
    sourceSelectedTaskTitle: input.sourceSelectedTaskTitle,
  });

  const record: LocalPlannerResponseImportRecord = {
    importedAt: analyzedAt,
    analyzedAt,
    rawResponseText: raw.slice(0, 200_000),
    parsed,
    safetyWarnings,
    status,
    decision,
    summaryMarkdown,
    acceptedForCoderPromptPrep: false,
    acceptedAt: null,
    sourceBriefGeneratedAt: input.sourceBriefGeneratedAt,
    sourceBriefMode: input.sourceBriefMode,
    sourceBriefStrictness: input.sourceBriefStrictness,
    sourceBriefTargetLocalModelType: input.sourceBriefTargetLocalModelType,
    sourceSelectedTaskId: input.sourceSelectedTaskId,
    sourceSelectedTaskTitle: input.sourceSelectedTaskTitle,
    stale: false,
  };

  return { record, blockedReasons: [] };
}
