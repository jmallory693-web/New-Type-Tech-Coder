import type {
  BacklogItem,
  BuilderPlanComparisonRecord,
  BuilderPlanComparisonRecommendation,
  BuilderPlanRecord,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointAvailabilityState,
  DecisionReport,
  ExternalReviewState,
  PatchReviewPack,
  SafeChecksState,
} from "../../shared/types";
import {
  getCompactPlanningGuidanceForSuggestedPrompt,
  getPlanningStyleReportLine,
  type PlanningStyleId,
} from "../../shared/planningStyle";
import { detectBuilderRiskyPhrases } from "./BuilderResultManager";
import {
  backlogOpenCriticalOrHighCount,
  backlogOpenCriticalSafetyCount,
} from "./BacklogManager";

const SECRET_SAFETY_NOTE =
  "This comparison uses pasted builder text and safe app metadata only. It does not include raw source code, full diffs, .env contents, secrets, keys, or certificates. Nothing was executed.";

const MAX_REPORT_CHARS = 40_000;
const MAX_PROMPT_CHARS = 6_000;

/** Stage 40 risk flags (keyword/rule-based). */
const COMPARISON_RISK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "enable edit mode", pattern: /\benable\s+edit\s+mode\b|\badd\s+edit\s+mode\b/i },
  { label: "direct file access", pattern: /\bdirect\s+(ai\s+)?file\s+access\b|\bai\s+file\s+access\b/i },
  { label: "run arbitrary commands", pattern: /\barbitrary\s+commands?\b|\brun\s+any\s+command\b/i },
  { label: "terminal", pattern: /\b(arbitrary\s+)?terminal\b|\bopen\s+a\s+shell\b/i },
  { label: "live Qwen", pattern: /\blive\s+qwen\b|\benable\s+live\s+qwen\b/i },
  { label: "install package", pattern: /\binstall\s+packages?\b|\bnpm\s+i(nstall)?\b/i },
  { label: "delete", pattern: /\bdelete\s+(files?|folders?|project)\b|\brm\s+-rf\b/i },
  { label: "reset", pattern: /\breset\s+--hard\b|\bgit\s+reset\b/i },
  { label: "clean", pattern: /\bclean\s+-fd\b|\bgit\s+clean\b/i },
  { label: "deploy", pattern: /\bdeploy\b/i },
  { label: "publish", pattern: /\bpublish\b/i },
  { label: "secrets", pattern: /\bsecrets?\b|\bapi\s+keys?\b|\bcredentials?\b/i },
  { label: ".env", pattern: /\.env\b/i },
  { label: "broad rewrite", pattern: /\bbroad\s+rewrite\b|\bfull\s+rewrite\b|\brewrite\s+everything\b/i },
  { label: "modify Safety Gate", pattern: /\b(modify|change|bypass|disable)\s+safety\s+gate\b/i },
  {
    label: "modify restore/checkpoint",
    pattern: /\b(modify|change|disable)\s+(restore|checkpoint|safety\s+backup)\b/i,
  },
  {
    label: "modify command runner",
    pattern: /\b(modify|change)\s+(safe\s+)?command\s+runner\b|\bsafecommandrunner\b/i,
  },
  {
    label: "modify provider security",
    pattern: /\b(modify|change|weaken)\s+provider\s+security\b|\ballow\s+cloud\s+api\b/i,
  },
];

const SAFETY_CRITICAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Safety Gate", pattern: /\bsafety\s+gate\b|\bsafetygate\b/i },
  { label: "command runner", pattern: /\bcommand\s+runner\b|\bsafecommandrunner\b|\bsafe\s+checks?\b/i },
  { label: "restore/checkpoint", pattern: /\b(restore|checkpoint|safety\s+backup)\b/i },
  { label: "provider adapter", pattern: /\bprovider\s+adapter\b|\bollama.*adapter\b|\bproviderregistry\b/i },
  { label: "preload", pattern: /\bpreload\b/i },
  { label: "main process", pattern: /\bmain\s+process\b|\bsrc\/main\b|\belectron\s+main\b/i },
  { label: "history store", pattern: /\bhistory\s+store\b|\bhistorystore\b|\bsession-history\b/i },
  { label: "package scripts", pattern: /\bpackage\.json\b|\bpackage\s+scripts?\b/i },
  { label: "electron main/preload", pattern: /\belectron\s+(main|preload)\b|\bdist-electron\b/i },
  { label: "role model mapping", pattern: /\brole\s+model\s+mapping\b|\brolemodelmapping\b/i },
  { label: "build/test runner", pattern: /\bbuild\/test\s+runner\b|\bsafe\s+command\s+runner\b/i },
];

const TEST_CHECK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "typecheck", pattern: /\btypecheck\b|\bnpm\s+run\s+typecheck\b/i },
  { label: "build", pattern: /\bnpm\s+run\s+build\b|\bbuild\s+the\s+app\b|\bvite\s+build\b/i },
  { label: "pack/dist", pattern: /\bnpm\s+run\s+(pack|dist)\b|\bpackaged?\s+app\b|\belectron-builder\b/i },
  { label: "manual smoke test", pattern: /\bsmoke\s+test\b|\bmanual\s+(test|smoke)\b/i },
  { label: "packaged app launch", pattern: /\blaunch\s+(the\s+)?packaged\b|\bwin-unpacked\b|\b\.exe\b/i },
  {
    label: "safety backup verification",
    pattern: /\b(verify|verification).{0,40}(backup|checkpoint|restore)\b|\bsafety\s+backup\b/i,
  },
  { label: "build/test checks", pattern: /\bbuild\/test\s+checks?\b|\bsafe\s+checks?\b/i },
  { label: "launcher test", pattern: /\blauncher\b|\b\.bat\b|\bOpen New Type Tech Coder\b/i },
];

const AGREEMENT_TOPIC_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "plan-only / wait for approval", pattern: /\bplan\s+only\b|\bwait\s+for\s+approval\b|\bno\s+code\s+yet\b/i },
  { label: "files likely to change", pattern: /\bfiles?\s+likely\s+to\s+change\b|\bimpacted\s+files?\b/i },
  { label: "tests / checks", pattern: /\b(test|check)\s+plan\b|\btypecheck\b|\bbuild\/test\b/i },
  { label: "safety risks", pattern: /\bsafety\s+risks?\b|\brisk\s+assessment\b|\bdo-?not-?do\b/i },
  { label: "small / reviewable steps", pattern: /\bsmall\s+(steps?|changes?)\b|\breviewable\b|\bminimal\s+change\b/i },
  { label: "Safety Backup", pattern: /\bsafety\s+backup\b|\bcheckpoint\b/i },
];

function makeId(): string {
  return `bpc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function matchLabels(
  text: string,
  rules: Array<{ label: string; pattern: RegExp }>,
): string[] {
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text) && !found.includes(rule.label)) {
      found.push(rule.label);
    }
  }
  return found;
}

function extractNttcPlanHints(plan: BuilderPlanRecord | null): string[] {
  if (!plan) return [];
  const text = plan.planText;
  const hints: string[] = [];
  if (/\btypecheck\b/i.test(text)) hints.push("typecheck");
  if (/\b(pack|dist|packaged)\b/i.test(text)) hints.push("pack/dist or packaged app");
  if (/\bsafety\s+backup\b|\bcheckpoint\b/i.test(text)) hints.push("Safety Backup");
  if (/\bdo-?not-?do\b|\bdo not\b/i.test(text)) hints.push("Do-Not-Do / forbidden changes");
  if (/\bfiles?\s+likely\s+to\s+change\b/i.test(text)) hints.push("Files Likely to Change");
  if (/\bquestions?\s+before\b/i.test(text)) hints.push("Questions Before Implementation");
  if (/\brecommendation\b/i.test(text)) hints.push("Recommendation section");
  if (plan.recommendation) hints.push(`NTTC recommendation: ${plan.recommendation}`);
  return hints;
}

function chooseRecommendation(input: {
  riskFlags: string[];
  safetyCriticalMentions: string[];
  missingItems: string[];
  testsChecksMissing: string[];
  weakComparison: boolean;
  backupRestorable: boolean;
  hasSafeCheckResult: boolean;
  backlogCriticalSafety: number;
  importedIsPlanType: boolean;
  appearsImplementationLike: boolean;
}): BuilderPlanComparisonRecommendation {
  const blockingRisks = input.riskFlags.filter((f) =>
    /edit mode|file access|arbitrary|terminal|live Qwen|Safety Gate|command runner|provider security|broad rewrite|secrets|\.env|delete|reset|clean|deploy|publish/i.test(
      f,
    ),
  );

  if (
    blockingRisks.length > 0 ||
    input.safetyCriticalMentions.length >= 2 ||
    input.appearsImplementationLike
  ) {
    return "Do not proceed yet";
  }

  if (!input.backupRestorable) {
    return "Create/verify Safety Backup first";
  }

  if (input.backlogCriticalSafety > 0) {
    return "Do not proceed yet";
  }

  if (!input.hasSafeCheckResult && input.testsChecksMissing.includes("build/test checks")) {
    return "Run Build/Test Checks first";
  }

  if (
    input.missingItems.length >= 3 ||
    input.testsChecksMissing.length >= 4 ||
    input.safetyCriticalMentions.length > 0
  ) {
    return "Ask builder to revise plan first";
  }

  if (input.weakComparison || input.missingItems.length > 0) {
    return "Safe to ask builder for a more detailed plan";
  }

  if (
    input.importedIsPlanType &&
    input.riskFlags.length === 0 &&
    input.safetyCriticalMentions.length === 0 &&
    input.testsChecksMissing.length <= 2
  ) {
    return "Ready for user-approved implementation in external builder";
  }

  return "Safe to ask builder for a more detailed plan";
}

function buildSuggestedNextPrompt(input: {
  recommendation: BuilderPlanComparisonRecommendation;
  userRequest: string;
  missingItems: string[];
  riskFlags: string[];
  safetyCriticalMentions: string[];
  testsChecksMissing: string[];
  importedSource: string;
  weakComparison: boolean;
  planningStyle?: PlanningStyleId;
}): string {
  const planOnly =
    input.recommendation !==
    "Ready for user-approved implementation in external builder";

  const lines = [
    "# New Type Tech Coder — Suggested Next Builder Prompt",
    "",
    "## Role",
    "",
    "You are an outside builder AI (Cursor, Codex, Grok Builder, Claude, ChatGPT).",
    "New Type Tech Coder itself does not edit files.",
    planOnly
      ? "Return a plan only. Do not implement until the user explicitly approves."
      : "The user may approve implementation in your tool after reviewing this prompt. Still keep changes small and report files changed.",
    "",
    "## Task",
    "",
    input.userRequest.trim() ||
      "Clarify the user goal, then produce a small safe plan.",
    "",
    `## Comparison recommendation from New Type Tech Coder`,
    "",
    `- **Recommendation:** ${input.recommendation}`,
    input.weakComparison
      ? "- **Note:** NTTC Builder Plan was missing — treat this as a weaker comparison."
      : "- Comparison used NTTC Builder Plan + safe metadata.",
    `- **Imported plan source:** ${input.importedSource}`,
    "",
    "## Missing requirements to address",
    "",
    ...(input.missingItems.length
      ? input.missingItems.map((m) => `- ${m}`)
      : ["- No major missing items detected by keyword rules."]),
    "",
    "## Safety warnings",
    "",
    ...(input.riskFlags.length
      ? input.riskFlags.map((r) => `- Risk flag: ${r}`)
      : ["- No high-risk keyword flags detected."]),
    ...(input.safetyCriticalMentions.length
      ? input.safetyCriticalMentions.map(
          (s) => `- Safety-critical mention: ${s} — justify carefully or avoid.`,
        )
      : []),
    "",
    "## Validation steps to include",
    "",
    ...(input.testsChecksMissing.length
      ? input.testsChecksMissing.map((t) => `- Include: ${t}`)
      : ["- Keep typecheck / build / pack or manual smoke coverage as appropriate."]),
    "",
    "## Required output",
    "",
    "1. Goal understanding",
    "2. Numbered small steps",
    "3. Files likely to change",
    "4. Safety risks and Do-Not-Do list",
    "5. Tests / checks plan",
    "6. Questions before implementation",
    planOnly
      ? "7. Wait for approval before writing code"
      : "7. If implementing after approval: report files changed and why",
    "",
    "## Hard boundaries",
    "",
    "- Do not enable live Qwen.",
    "- Do not add edit mode to New Type Tech Coder.",
    "- Do not add arbitrary terminal or custom command typing.",
    "- Do not bypass Safety Gate.",
    "- Do not edit secrets or .env.",
    "- Keep changes small and reviewable.",
  ];
  if ((input.planningStyle ?? "small-model-friendly") === "small-model-friendly") {
    lines.push(`- ${getCompactPlanningGuidanceForSuggestedPrompt()}`);
  }

  const text = lines.join("\n");
  return text.length > MAX_PROMPT_CHARS
    ? `${text.slice(0, MAX_PROMPT_CHARS - 1)}…`
    : text;
}

export interface BuilderPlanComparisonInput {
  userRequest: string;
  imported: BuilderResultRecord;
  nttcBuilderPlan: BuilderPlanRecord | null;
  decisionReport: DecisionReport | null;
  patchReviewPack: PatchReviewPack | null;
  externalReview: ExternalReviewState;
  backlogItems: BacklogItem[];
  checkpointAvailability: CheckpointAvailabilityState;
  safeChecks: SafeChecksState;
  changedFiles: ChangedFilesScanResult | null;
  planningStyle?: PlanningStyleId;
}

/**
 * Stage 40: rule/keyword-based Builder Plan Comparison.
 * Does not call Ollama. Does not edit files or run commands.
 */
export function buildBuilderPlanComparison(
  input: BuilderPlanComparisonInput,
): BuilderPlanComparisonRecord {
  const importedText = input.imported.responseText;
  const nttcText = input.nttcBuilderPlan?.planText ?? "";
  const weakComparison = !input.nttcBuilderPlan;

  const riskFromImport = detectBuilderRiskyPhrases(importedText);
  const riskFlags = [
    ...new Set([
      ...riskFromImport,
      ...matchLabels(importedText, COMPARISON_RISK_PATTERNS),
      ...(input.imported.hasRiskySuggestions ? input.imported.riskyPhrases : []),
    ]),
  ];

  const safetyCriticalMentions = matchLabels(
    importedText,
    SAFETY_CRITICAL_PATTERNS,
  );
  const testsChecksMentioned = matchLabels(importedText, TEST_CHECK_PATTERNS);
  const allTestLabels = TEST_CHECK_PATTERNS.map((r) => r.label);
  const testsChecksMissing = allTestLabels.filter(
    (label) => !testsChecksMentioned.includes(label),
  );

  const agreementItems: string[] = [];
  const differenceItems: string[] = [];
  const missingItems: string[] = [];

  if (weakComparison) {
    differenceItems.push(
      "No NTTC Builder Plan existed — comparison is weaker and based on Decision/Patch/Backlog metadata only.",
    );
  } else {
    for (const topic of AGREEMENT_TOPIC_PATTERNS) {
      const inNttc = topic.pattern.test(nttcText);
      const inImport = topic.pattern.test(importedText);
      if (inNttc && inImport) {
        agreementItems.push(`Both mention ${topic.label}.`);
      } else if (inNttc && !inImport) {
        missingItems.push(`Outside plan does not clearly mention: ${topic.label}.`);
        differenceItems.push(
          `NTTC Builder Plan covers “${topic.label}”; imported plan does not (keyword check).`,
        );
      } else if (!inNttc && inImport) {
        differenceItems.push(
          `Imported plan mentions “${topic.label}”; NTTC Builder Plan did not (keyword check).`,
        );
      }
    }

    for (const hint of extractNttcPlanHints(input.nttcBuilderPlan)) {
      const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(escaped.slice(0, Math.min(40, escaped.length)), "i").test(importedText)) {
        if (!missingItems.some((m) => m.includes(hint))) {
          missingItems.push(`NTTC plan hint not clearly echoed: ${hint}.`);
        }
      } else if (!agreementItems.some((a) => a.includes(hint))) {
        agreementItems.push(`Imported plan appears to cover NTTC hint: ${hint}.`);
      }
    }
  }

  if (input.decisionReport) {
    const rec = input.decisionReport.recommendedNextAction.label;
    if (!importedText.toLowerCase().includes(rec.toLowerCase().slice(0, 24))) {
      missingItems.push(
        `Decision Report recommendation (“${rec}”) is not clearly reflected in the imported plan.`,
      );
    } else {
      agreementItems.push(
        `Imported plan appears aligned with Decision Report recommendation (“${rec}”).`,
      );
    }
  }

  if (input.patchReviewPack && input.patchReviewPack.riskyCount > 0) {
    if (!/\brisky\b|\brisk\s+flag/i.test(importedText)) {
      missingItems.push(
        `Patch Review Pack noted ${input.patchReviewPack.riskyCount} risky changed file(s); imported plan does not clearly address risky files.`,
      );
    }
  }

  if (input.externalReview.comparison?.disagreementDetected) {
    differenceItems.push(
      "External review comparison already detected disagreement — imported plan should reconcile conflicting advice.",
    );
  }

  const backlogCritical = backlogOpenCriticalSafetyCount(input.backlogItems);
  const backlogHigh = backlogOpenCriticalOrHighCount(input.backlogItems);
  if (backlogCritical > 0 || backlogHigh > 0) {
    if (!/\bbacklog\b|\bsafety\s+concern\b/i.test(importedText)) {
      missingItems.push(
        `Open backlog warnings exist (critical safety: ${backlogCritical}, critical/high open: ${backlogHigh}); imported plan does not clearly address backlog.`,
      );
    }
  }

  if (input.imported.mismatchWarnings.length > 0) {
    for (const w of input.imported.mismatchWarnings.slice(0, 6)) {
      differenceItems.push(`Import mismatch warning: ${w}`);
    }
  }

  if (agreementItems.length === 0 && !weakComparison) {
    agreementItems.push(
      "No strong keyword overlaps detected — review both plans manually.",
    );
  }

  const importedIsPlanType =
    input.imported.responseType === "Builder plan" ||
    input.imported.responseType === "Revised builder plan" ||
    input.imported.responseType === "Plan only" ||
    input.imported.appearsAs === "plan-only";

  const recommendation = chooseRecommendation({
    riskFlags,
    safetyCriticalMentions,
    missingItems,
    testsChecksMissing,
    weakComparison,
    backupRestorable: Boolean(input.checkpointAvailability.restorable),
    hasSafeCheckResult: Boolean(input.safeChecks.lastResult),
    backlogCriticalSafety: backlogCritical,
    importedIsPlanType,
    appearsImplementationLike: input.imported.appearsAs === "implementation-like",
  });

  const summaryPlainEnglish = [
    weakComparison
      ? "Comparison is weaker because no NTTC Builder Plan was available."
      : "Compared the imported outside builder plan against NTTC’s Builder Plan and related safe reports.",
    riskFlags.length
      ? `Risk flags detected: ${riskFlags.slice(0, 5).join(", ")}.`
      : "No high-risk keyword flags were detected.",
    safetyCriticalMentions.length
      ? `Safety-critical areas mentioned: ${safetyCriticalMentions.join(", ")}.`
      : "No safety-critical file/area keywords were detected.",
    `Recommendation: ${recommendation}.`,
  ].join(" ");

  const suggestedNextBuilderPrompt = buildSuggestedNextPrompt({
    recommendation,
    userRequest: input.userRequest || input.imported.userRequestAtSave,
    missingItems,
    riskFlags,
    safetyCriticalMentions,
    testsChecksMissing,
    importedSource: `${input.imported.source} / ${input.imported.responseType}`,
    weakComparison,
    planningStyle: input.planningStyle,
  });

  const changed = input.changedFiles;
  const lines: string[] = [
    "# New Type Tech Coder - Builder Plan Comparison Report",
    "",
    "## Summary",
    "",
    summaryPlainEnglish,
    "",
    getPlanningStyleReportLine(input.planningStyle ?? "small-model-friendly"),
    "",
    `- **Imported source:** ${input.imported.source}`,
    `- **Imported response type:** ${input.imported.responseType}`,
    `- **Imported saved at:** ${input.imported.savedAt}`,
    `- **NTTC Builder Plan existed:** ${input.nttcBuilderPlan ? "Yes" : "No"}`,
    `- **Decision Report existed:** ${input.decisionReport ? "Yes" : "No"}`,
    `- **Patch Review Pack existed:** ${input.patchReviewPack ? "Yes" : "No"}`,
    `- **Backlog warnings considered:** ${backlogCritical + backlogHigh > 0 ? "Yes" : "No open critical/high"}`,
    `- **Safety Backup:** ${input.checkpointAvailability.label}`,
    `- **Safe Check:** ${
      input.safeChecks.lastResult
        ? `${input.safeChecks.lastResult.scriptName} → ${input.safeChecks.lastResult.status}`
        : "None yet"
    }`,
    `- **Changed files metadata:** ${
      changed
        ? `${changed.totalCount} file(s), ${changed.riskyCount} risky`
        : "Not scanned"
    }`,
    "",
    "## Agreement",
    "",
    ...(agreementItems.length
      ? agreementItems.map((a) => `- ${a}`)
      : ["- None detected by keyword rules."]),
    "",
    "## Differences",
    "",
    ...(differenceItems.length
      ? differenceItems.map((d) => `- ${d}`)
      : ["- No major keyword differences detected."]),
    "",
    "## Missing Items",
    "",
    ...(missingItems.length
      ? missingItems.map((m) => `- ${m}`)
      : ["- No major missing items detected by keyword rules."]),
    "",
    "## Risk Flags",
    "",
    ...(riskFlags.length
      ? riskFlags.map((r) => `- ${r}`)
      : ["- None detected."]),
    "",
    "## Safety-Critical File Mentions",
    "",
    ...(safetyCriticalMentions.length
      ? safetyCriticalMentions.map((s) => `- ${s}`)
      : ["- None detected."]),
    "",
    "## Tests / Checks Mentioned",
    "",
    `- **Mentioned:** ${testsChecksMentioned.join(", ") || "none"}`,
    `- **Not clearly mentioned:** ${testsChecksMissing.join(", ") || "none"}`,
    "",
    "## Recommendation",
    "",
    recommendation,
    "",
    "## Suggested Next Builder Prompt",
    "",
    suggestedNextBuilderPrompt,
    "",
    "## Secret Safety Reminder",
    "",
    SECRET_SAFETY_NOTE,
    "",
    "## App Note",
    "",
    "This report is rule/keyword-based. It does not call Ollama, edit files, run commands, or prove implementation happened.",
    "",
  ];

  let markdownReport = lines.join("\n");
  const truncated = markdownReport.length > MAX_REPORT_CHARS;
  if (truncated) {
    markdownReport = `${markdownReport.slice(0, MAX_REPORT_CHARS - 1)}…`;
  }

  return {
    id: makeId(),
    generatedAt: new Date().toISOString(),
    importedBuilderResultId: input.imported.id,
    importedSource: input.imported.source,
    importedResponseType: input.imported.responseType,
    importedSavedAt: input.imported.savedAt,
    nttcBuilderPlanExisted: Boolean(input.nttcBuilderPlan),
    decisionReportExisted: Boolean(input.decisionReport),
    patchReviewPackExisted: Boolean(input.patchReviewPack),
    backlogWarningsExisted: backlogCritical + backlogHigh > 0,
    agreementItems,
    differenceItems,
    missingItems,
    riskFlags,
    safetyCriticalMentions,
    testsChecksMentioned,
    testsChecksMissing,
    recommendation,
    summaryPlainEnglish,
    suggestedNextBuilderPrompt,
    markdownReport,
    previewExcerpt: markdownReport.split("\n").slice(0, 32).join("\n"),
    truncated,
    weakComparison,
    secretSafetyNote: SECRET_SAFETY_NOTE,
  };
}

export function isBuilderPlanResponseType(
  responseType: BuilderResultRecord["responseType"],
): boolean {
  return (
    responseType === "Builder plan" ||
    responseType === "Revised builder plan" ||
    responseType === "Plan only"
  );
}
