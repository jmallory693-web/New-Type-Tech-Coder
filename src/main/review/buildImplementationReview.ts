import type {
  BacklogItem,
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointAvailabilityState,
  DecisionReport,
  ExternalReviewState,
  ImplementationReviewRecord,
  ImplementationReviewRecommendation,
  PatchReviewPack,
  SafeChecksState,
} from "../../shared/types";
import { detectBuilderRiskyPhrases } from "./BuilderResultManager";
import {
  backlogOpenCriticalOrHighCount,
  backlogOpenCriticalSafetyCount,
} from "./BacklogManager";

const SECRET_SAFETY_NOTE =
  "This review uses pasted implementation text and safe app metadata only. It does not include raw source code, full diffs, .env contents, secrets, keys, or certificates. Nothing was executed.";

const MAX_REPORT_CHARS = 40_000;
const MAX_PROMPT_CHARS = 6_000;

const RISK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "enabled edit mode", pattern: /\benable(d)?\s+edit\s+mode\b|\badd(ed)?\s+edit\s+mode\b/i },
  { label: "direct file access", pattern: /\bdirect\s+(ai\s+)?file\s+access\b|\bai\s+file\s+access\b/i },
  { label: "terminal", pattern: /\b(arbitrary\s+)?terminal\b|\bopen(ed)?\s+a\s+shell\b/i },
  { label: "arbitrary commands", pattern: /\barbitrary\s+commands?\b|\brun\s+any\s+command\b/i },
  { label: "custom commands", pattern: /\bcustom\s+command\s+(input|typing)\b/i },
  { label: "live Qwen", pattern: /\blive\s+qwen\b|\benable(d)?\s+live\s+qwen\b/i },
  { label: "install package", pattern: /\binstall(ed)?\s+packages?\b|\bnpm\s+i(nstall)?\b/i },
  { label: "deploy", pattern: /\bdeploy(ed)?\b/i },
  { label: "publish", pattern: /\bpublish(ed)?\b/i },
  { label: "reset", pattern: /\breset\s+--hard\b|\bgit\s+reset\b/i },
  { label: "clean", pattern: /\bclean\s+-fd\b|\bgit\s+clean\b/i },
  { label: "delete/remove", pattern: /\b(delete|remove)(d|s)?\s+(files?|folders?|project)\b|\brm\s+-rf\b/i },
  { label: "broad rewrite", pattern: /\bbroad\s+rewrite\b|\bfull\s+rewrite\b|\brewrite\s+everything\b/i },
  { label: "secrets", pattern: /\bsecrets?\b|\bapi\s+keys?\b/i },
  { label: ".env", pattern: /\.env\b/i },
  { label: "keys", pattern: /\b(private\s+)?keys?\b/i },
  { label: "credentials", pattern: /\bcredentials?\b/i },
  { label: "disabled safety", pattern: /\bdisable(d)?\s+safety\b/i },
  { label: "bypassed guard", pattern: /\bbypass(ed)?\s+(safety\s+gate|guard)\b/i },
  { label: "modified Safety Gate", pattern: /\b(modify|change|bypass|disable)(d|ing)?\s+safety\s+gate\b/i },
  { label: "modified command runner", pattern: /\b(modify|change)(d|ing)?\s+(safe\s+)?command\s+runner\b/i },
  { label: "modified restore/checkpoint", pattern: /\b(modify|change|disable)(d|ing)?\s+(restore|checkpoint|safety\s+backup)\b/i },
  { label: "modified provider security", pattern: /\b(modify|change|weaken)(d|ing)?\s+provider\s+security\b/i },
  { label: "modified preload/main process", pattern: /\b(modify|change)(d|ing)?\s+(preload|main\s+process)\b/i },
  { label: "modified package scripts", pattern: /\b(modify|change)(d|ing)?\s+package\s+scripts?\b/i },
];

const SAFETY_CRITICAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Safety Gate", pattern: /\bsafety\s+gate\b|\bsafetygate\b/i },
  { label: "command runner", pattern: /\bcommand\s+runner\b|\bsafecommandrunner\b/i },
  { label: "restore/checkpoint", pattern: /\b(restore|checkpoint|safety\s+backup)\b/i },
  { label: "provider adapter", pattern: /\bprovider\s+adapter\b|\bproviderregistry\b/i },
  { label: "preload", pattern: /\bpreload\b/i },
  { label: "main process", pattern: /\bmain\s+process\b|\bsrc\/main\b/i },
  { label: "history store", pattern: /\bhistory\s+store\b|\bhistorystore\b/i },
  { label: "package scripts", pattern: /\bpackage\.json\b|\bpackage\s+scripts?\b/i },
  { label: "electron main/preload", pattern: /\belectron\s+(main|preload)\b|\bdist-electron\b/i },
  { label: "role model mapping", pattern: /\brole\s+model\s+mapping\b/i },
  { label: "build/test runner", pattern: /\bbuild\/test\s+runner\b|\bsafe\s+command\s+runner\b/i },
  { label: "checkpoint manager", pattern: /\bcheckpointmanager\b|\bcheckpoint\s+manager\b/i },
  { label: "backup/restore manager", pattern: /\bbackup\/restore\s+manager\b|\brestore\s+manager\b/i },
];

const TEST_CHECK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "typecheck", pattern: /\btypecheck\b|\bnpm\s+run\s+typecheck\b/i },
  { label: "build", pattern: /\bnpm\s+run\s+build\b|\bbuild\s+(the\s+)?app\b|\bvite\s+build\b/i },
  { label: "test", pattern: /\bnpm\s+run\s+test\b|\bunit\s+test\b|\btests?\s+pass(ed)?\b/i },
  { label: "lint", pattern: /\blint\b|\bnpm\s+run\s+lint\b/i },
  { label: "pack", pattern: /\bnpm\s+run\s+pack\b|\belectron-builder\s+--dir\b/i },
  { label: "dist", pattern: /\bnpm\s+run\s+dist\b|\binstaller\b/i },
  { label: "smoke test", pattern: /\bsmoke\s+test\b/i },
  { label: "packaged launch", pattern: /\bpackaged\s+(app\s+)?launch\b|\bwin-unpacked\b|\b\.exe\b/i },
  { label: "launcher test", pattern: /\blauncher\s+test\b|\bOpen New Type Tech Coder\.bat\b/i },
  { label: "manual test", pattern: /\bmanual\s+test\b/i },
  { label: "CDP smoke", pattern: /\bCDP\s+smoke\b|\bremote-debugging-port\b/i },
  { label: "safety backup verification", pattern: /\b(verify|verification).{0,40}(backup|checkpoint|restore)\b/i },
];

const CLAIMED_CHANGE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "implemented feature", pattern: /\b(implemented|applied|added|created|updated|modified|changed|wrote|edited)\b/i },
  { label: "files changed", pattern: /\bfiles?\s+changed\b|\bchanges?\s+applied\b/i },
  { label: "patch applied", pattern: /\bpatch\s+applied\b|\bdiff\s+applied\b/i },
  { label: "implementation complete", pattern: /\bimplementation\s+complete\b|\bdone\s+implementing\b/i },
  { label: "refactored", pattern: /\brefactor(ed|ing)?\b/i },
  { label: "fixed bug", pattern: /\bfix(ed|ing)?\s+(bug|issue|error)\b/i },
];

const FILE_AREA_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "src/ path", pattern: /\bsrc\/[\w./-]+/i },
  { label: "package.json", pattern: /\bpackage\.json\b/i },
  { label: "README", pattern: /\bREADME\.md\b/i },
  { label: "electron main", pattern: /\bsrc\/main\b|\bdist-electron\b/i },
  { label: "preload", pattern: /\bsrc\/preload\b|\bpreload\b/i },
  { label: "renderer", pattern: /\bsrc\/renderer\b/i },
  { label: "shared types", pattern: /\bsrc\/shared\b/i },
  { label: "scripts folder", pattern: /\bscripts\/[\w.-]+/i },
  { label: "release folder", pattern: /\brelease\/[\w.-]+/i },
];

const ERROR_FAILURE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "error mentioned", pattern: /\berror(s)?\b|\bfailed\b|\bfailure\b/i },
  { label: "warning mentioned", pattern: /\bwarning(s)?\b/i },
  { label: "tests failed", pattern: /\btests?\s+fail(ed|ure)?\b/i },
  { label: "typecheck failed", pattern: /\btypecheck\s+fail(ed|ure)?\b/i },
  { label: "build failed", pattern: /\bbuild\s+fail(ed|ure)?\b/i },
];

function makeId(): string {
  return `ir-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

function extractClaimedFilesFromText(text: string): string[] {
  const paths = new Set<string>();
  const pathRe = /(?:^|\s)([\w./-]+\.(?:ts|tsx|js|jsx|json|md|mjs|css|bat|exe))\b/gim;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(text)) !== null) {
    const p = m[1]?.trim();
    if (p && p.length < 120) paths.add(p);
  }
  return [...paths].slice(0, 20);
}

function chooseRecommendation(input: {
  riskFlags: string[];
  safetyCriticalMentions: string[];
  planAlignmentWarnings: string[];
  missingVerification: string[];
  weakAlignment: boolean;
  backupRestorable: boolean;
  hasSafeCheckAfterImpl: boolean;
  hasPatchPack: boolean;
  hasChangedFiles: boolean;
  claimedFilesAreas: string[];
  claimedTestsChecks: string[];
  backlogCriticalSafety: number;
  comparisonDoNotProceed: boolean;
  mentionsRestore: boolean;
  vagueClaims: boolean;
}): ImplementationReviewRecommendation {
  const blockingRisks = input.riskFlags.filter((f) =>
    /edit mode|file access|arbitrary|terminal|live Qwen|custom command|Safety Gate|command runner|provider security|broad rewrite|secrets|\.env|delete|reset|clean|deploy|publish|disabled safety|bypass/i.test(
      f,
    ),
  );

  if (
    blockingRisks.length > 0 ||
    input.comparisonDoNotProceed ||
    input.backlogCriticalSafety > 0 ||
    (input.safetyCriticalMentions.length >= 2 && blockingRisks.length > 0)
  ) {
    return "Do not proceed yet";
  }

  if (input.mentionsRestore && input.safetyCriticalMentions.length > 0) {
    return "Restore from Safety Backup";
  }

  if (!input.backupRestorable) {
    return "Create/verify Safety Backup first";
  }

  const strongMisalignment = input.planAlignmentWarnings.some((w) =>
    /implemented when plan-only|ignored revision|skipped.*safeguard|scope|not in approved plan/i.test(
      w,
    ),
  );
  if (strongMisalignment) {
    return "Ask builder to revise implementation";
  }

  if (
    input.vagueClaims ||
    (input.claimedFilesAreas.length === 0 && input.claimedTestsChecks.length === 0)
  ) {
    return "Ask builder for clarification";
  }

  if (!input.hasSafeCheckAfterImpl && input.missingVerification.some((m) => /build\/test/i.test(m))) {
    return "Run Build/Test Checks";
  }

  if (
    (input.hasChangedFiles || input.claimedFilesAreas.length > 0) &&
    !input.hasPatchPack
  ) {
    return "Generate Patch Review Pack";
  }

  if (input.missingVerification.length >= 3) {
    return "Run Build/Test Checks";
  }

  return "Safe to continue review";
}

function buildSuggestedNextPrompt(input: {
  recommendation: ImplementationReviewRecommendation;
  userRequest: string;
  missingVerification: string[];
  planAlignmentWarnings: string[];
  riskFlags: string[];
  safetyCriticalMentions: string[];
  claimedTestsChecks: string[];
  importedSource: string;
  weakAlignment: boolean;
}): string {
  const lines = [
    "# New Type Tech Coder — Suggested Next Builder Prompt",
    "",
    "## Role",
    "",
    "You are an outside builder AI (Cursor, Codex, Grok Builder, Claude, ChatGPT).",
    "New Type Tech Coder itself does not edit files.",
    "Provide a concise, honest implementation summary — not proof that work is correct.",
    "",
    "## Task",
    "",
    input.userRequest.trim() ||
      "Clarify what you changed and how it was validated.",
    "",
    "## Implementation Review recommendation from New Type Tech Coder",
    "",
    `- **Recommendation:** ${input.recommendation}`,
    input.weakAlignment
      ? "- **Note:** No approved NTTC Builder Plan or Comparison existed — alignment review was weaker."
      : "- Review used NTTC Builder Plan + Comparison + safe metadata.",
    `- **Imported implementation source:** ${input.importedSource}`,
    "",
    "## Please clarify or provide",
    "",
    ...(input.missingVerification.length
      ? input.missingVerification.map((m) => `- ${m}`)
      : ["- List files changed and why."]),
    "- Exact validation output (typecheck, build, test, pack, smoke, launcher).",
    "- Any errors or warnings honestly.",
    "- Whether safety-critical areas were touched and why.",
    "",
    "## Plan alignment concerns",
    "",
    ...(input.planAlignmentWarnings.length
      ? input.planAlignmentWarnings.map((w) => `- ${w}`)
      : ["- No major alignment warnings detected by keyword rules."]),
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
    "## Tests / checks claimed",
    "",
    ...(input.claimedTestsChecks.length
      ? input.claimedTestsChecks.map((t) => `- Mentioned: ${t}`)
      : ["- No tests/checks clearly mentioned — please list what you ran."]),
    "",
    "## Hard boundaries",
    "",
    "- Do not enable live Qwen.",
    "- Do not add edit mode to New Type Tech Coder.",
    "- Do not add arbitrary terminal or custom command typing.",
    "- Do not bypass Safety Gate.",
    "- Do not edit secrets or .env.",
    "- Keep changes small and reviewable.",
    "- Return a concise implementation summary with files changed and validation output.",
  ];

  const text = lines.join("\n");
  return text.length > MAX_PROMPT_CHARS
    ? `${text.slice(0, MAX_PROMPT_CHARS - 1)}…`
    : text;
}

export interface ImplementationReviewInput {
  userRequest: string;
  imported: BuilderResultRecord;
  nttcBuilderPlan: BuilderPlanRecord | null;
  builderPlanComparison: BuilderPlanComparisonRecord | null;
  decisionReport: DecisionReport | null;
  patchReviewPack: PatchReviewPack | null;
  externalReview: ExternalReviewState;
  backlogItems: BacklogItem[];
  checkpointAvailability: CheckpointAvailabilityState;
  safeChecks: SafeChecksState;
  changedFiles: ChangedFilesScanResult | null;
}

/**
 * Stage 42: rule/keyword-based Implementation Review.
 * Does not call Ollama. Does not edit files or run commands.
 */
export function buildImplementationReview(
  input: ImplementationReviewInput,
): ImplementationReviewRecord {
  const text = input.imported.responseText;
  const weakAlignment =
    !input.nttcBuilderPlan && !input.builderPlanComparison;

  const riskFromImport = detectBuilderRiskyPhrases(text);
  const riskFlags = [
    ...new Set([
      ...riskFromImport,
      ...matchLabels(text, RISK_PATTERNS),
      ...(input.imported.hasRiskySuggestions ? input.imported.riskyPhrases : []),
    ]),
  ];

  const safetyCriticalMentions = matchLabels(text, SAFETY_CRITICAL_PATTERNS);
  const claimedChanges = matchLabels(text, CLAIMED_CHANGE_PATTERNS);
  const claimedFilesAreas = [
    ...new Set([
      ...matchLabels(text, FILE_AREA_PATTERNS),
      ...extractClaimedFilesFromText(text),
    ]),
  ];
  const claimedTestsChecks = matchLabels(text, TEST_CHECK_PATTERNS);
  const claimedErrorsFailures = matchLabels(text, ERROR_FAILURE_PATTERNS);

  const missingVerification: string[] = [];
  const planAlignmentWarnings: string[] = [];

  const implSavedAt = input.imported.savedAt;
  const hasSafeCheckAfterImpl =
    Boolean(input.safeChecks.lastResult) &&
    String(input.safeChecks.lastResult?.endedAt ?? "") >= String(implSavedAt);
  const hasPatchPackAfterImpl =
    Boolean(input.patchReviewPack) &&
    String(input.patchReviewPack?.generatedAt ?? "") >= String(implSavedAt);

  if (!hasSafeCheckAfterImpl) {
    missingVerification.push(
      "No Build/Test Checks result recorded after this implementation report was saved.",
    );
  }
  if (!hasPatchPackAfterImpl && !input.patchReviewPack) {
    missingVerification.push("No Patch Review Pack after implementation.");
  }
  if (!claimedTestsChecks.length) {
    missingVerification.push("No tests/checks mentioned in the implementation report.");
  }
  if (!claimedFilesAreas.length) {
    missingVerification.push("No files or areas clearly mentioned in the implementation report.");
  }
  if (!input.changedFiles?.isGitRepo) {
    missingVerification.push("No changed files scan available.");
  } else if ((input.changedFiles.totalCount ?? 0) === 0) {
    missingVerification.push(
      "Changed files scan shows no changes — implementation report may not match repo metadata.",
    );
  }
  if (!/\bsmoke\s+test\b|\bpackaged\s+launch\b|\blauncher\b/i.test(text)) {
    missingVerification.push("No packaged smoke test or launcher test mentioned.");
  }
  if (!input.checkpointAvailability.restorable) {
    missingVerification.push("Safety Backup is not verified/restorable.");
  }

  if (weakAlignment) {
    planAlignmentWarnings.push(
      "No approved NTTC Builder Plan or Builder Plan Comparison existed — alignment review is weaker.",
    );
  }

  if (input.imported.builderPromptWasPlanOnly) {
    planAlignmentWarnings.push(
      "Builder Prompt was plan-only at import, but an Implementation report was pasted — builder may have implemented before approval.",
    );
  }

  if (
    input.builderPlanComparison?.recommendation === "Ask builder to revise plan first" ||
    input.builderPlanComparison?.recommendation === "Do not proceed yet"
  ) {
    planAlignmentWarnings.push(
      `Builder Plan Comparison recommended “${input.builderPlanComparison.recommendation}” — implementation may have ignored revision request.`,
    );
  }

  if (input.nttcBuilderPlan) {
    const planText = input.nttcBuilderPlan.planText;
    if (/\bplan\s+only\b|\bwait\s+for\s+approval\b/i.test(planText)) {
      planAlignmentWarnings.push(
        "NTTC Builder Plan emphasized plan-only / wait for approval — verify implementation was user-approved.",
      );
    }
    if (/\btypecheck\b/i.test(planText) && !claimedTestsChecks.includes("typecheck")) {
      planAlignmentWarnings.push(
        "NTTC Builder Plan mentioned typecheck; implementation report does not clearly mention it.",
      );
    }
    if (
      /\b(pack|dist|smoke)\b/i.test(planText) &&
      !claimedTestsChecks.some((t) => /pack|dist|smoke/i.test(t))
    ) {
      planAlignmentWarnings.push(
        "NTTC Builder Plan mentioned pack/dist/smoke validation; implementation report does not clearly mention it.",
      );
    }
    if (/\bsafety\s+backup\b/i.test(planText) && !input.checkpointAvailability.restorable) {
      planAlignmentWarnings.push(
        "NTTC Builder Plan mentioned Safety Backup; backup is not verified/restorable.",
      );
    }
  }

  if (input.decisionReport) {
    const rec = input.decisionReport.recommendedNextAction.label;
    if (/do not proceed|revert|restore|revise/i.test(rec)) {
      planAlignmentWarnings.push(
        `Decision Report recommended caution (“${rec}”) — implementation may have proceeded anyway.`,
      );
    }
  }

  if (input.imported.mismatchWarnings.length > 0) {
    for (const w of input.imported.mismatchWarnings.slice(0, 4)) {
      planAlignmentWarnings.push(`Import mismatch: ${w}`);
    }
  }

  const backlogCritical = backlogOpenCriticalSafetyCount(input.backlogItems);
  const backlogHigh = backlogOpenCriticalOrHighCount(input.backlogItems);
  if (backlogCritical > 0 || backlogHigh > 0) {
    if (!/\bbacklog\b|\bsafety\s+concern\b/i.test(text)) {
      planAlignmentWarnings.push(
        `Open backlog warnings exist (critical safety: ${backlogCritical}) — implementation report does not address backlog.`,
      );
    }
  }

  const comparisonDoNotProceed =
    input.builderPlanComparison?.recommendation === "Do not proceed yet";

  const mentionsRestore = /\brestore\b|\brevert\b|\bundo\b|\brollback\b/i.test(text);

  const vagueClaims =
    claimedChanges.length === 0 ||
    (claimedFilesAreas.length === 0 && claimedTestsChecks.length === 0);

  const hasChangedFiles = Boolean(
    input.changedFiles?.isGitRepo &&
      !input.changedFiles.errorMessage &&
      (input.changedFiles.totalCount ?? 0) > 0,
  );

  const recommendation = chooseRecommendation({
    riskFlags,
    safetyCriticalMentions,
    planAlignmentWarnings,
    missingVerification,
    weakAlignment,
    backupRestorable: Boolean(input.checkpointAvailability.restorable),
    hasSafeCheckAfterImpl,
    hasPatchPack: Boolean(input.patchReviewPack),
    hasChangedFiles,
    claimedFilesAreas,
    claimedTestsChecks,
    backlogCriticalSafety: backlogCritical,
    comparisonDoNotProceed,
    mentionsRestore,
    vagueClaims,
  });

  const summaryPlainEnglish = [
    "Reviewed the pasted implementation report against NTTC plans, comparisons, and safe metadata.",
    weakAlignment
      ? "Alignment review is weaker because no approved plan/comparison existed."
      : "Compared against NTTC Builder Plan and/or Builder Plan Comparison.",
    claimedChanges.length
      ? `Builder claims: ${claimedChanges.slice(0, 4).join(", ")}.`
      : "No clear claimed changes detected by keyword rules.",
    riskFlags.length
      ? `Risk flags: ${riskFlags.slice(0, 4).join(", ")}.`
      : "No high-risk keyword flags detected.",
    `Recommendation: ${recommendation}.`,
  ].join(" ");

  const suggestedNextBuilderPrompt = buildSuggestedNextPrompt({
    recommendation,
    userRequest: input.userRequest || input.imported.userRequestAtSave,
    missingVerification,
    planAlignmentWarnings,
    riskFlags,
    safetyCriticalMentions,
    claimedTestsChecks,
    importedSource: `${input.imported.source} / ${input.imported.responseType}`,
    weakAlignment,
  });

  const changed = input.changedFiles;
  const lines: string[] = [
    "# New Type Tech Coder - Implementation Review Report",
    "",
    "## Summary",
    "",
    summaryPlainEnglish,
    "",
    `- **Imported source:** ${input.imported.source}`,
    `- **Imported response type:** ${input.imported.responseType}`,
    `- **Imported saved at:** ${input.imported.savedAt}`,
    ...(input.imported.taskId
      ? [`- **Blueprint task ID:** ${input.imported.taskId}`]
      : []),
    ...(input.imported.taskTitle
      ? [`- **Blueprint task title:** ${input.imported.taskTitle}`]
      : []),
    ...(input.imported.taskArtifactKind
      ? [`- **Task artifact kind:** ${input.imported.taskArtifactKind}`]
      : []),
    `- **NTTC Builder Plan existed:** ${input.nttcBuilderPlan ? "Yes" : "No"}`,
    `- **Builder Plan Comparison existed:** ${input.builderPlanComparison ? "Yes" : "No"}`,
    `- **Decision Report existed:** ${input.decisionReport ? "Yes" : "No"}`,
    `- **Patch Review Pack existed:** ${input.patchReviewPack ? "Yes" : "No"}`,
    `- **Safety Backup verified:** ${input.checkpointAvailability.restorable ? "Yes" : "No"}`,
    `- **Backlog warnings at import:** ${input.imported.backlogWarningsExistedAtImport ? "Yes" : "No"}`,
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
    "## Claimed Changes",
    "",
    ...(claimedChanges.length
      ? claimedChanges.map((c) => `- ${c}`)
      : ["- No clear claimed changes detected by keyword rules."]),
    "",
    "## Claimed Files / Areas",
    "",
    ...(claimedFilesAreas.length
      ? claimedFilesAreas.map((f) => `- ${f}`)
      : ["- None clearly mentioned."]),
    "",
    "## Claimed Tests / Checks",
    "",
    ...(claimedTestsChecks.length
      ? claimedTestsChecks.map((t) => `- ${t}`)
      : ["- None clearly mentioned."]),
    ...(claimedErrorsFailures.length
      ? ["", "### Claimed errors / failures", "", ...claimedErrorsFailures.map((e) => `- ${e}`)]
      : []),
    "",
    "## Missing Verification",
    "",
    ...(missingVerification.length
      ? missingVerification.map((m) => `- ${m}`)
      : ["- No major missing verification detected by keyword rules."]),
    "",
    "## Plan Alignment",
    "",
    ...(planAlignmentWarnings.length
      ? planAlignmentWarnings.map((w) => `- ${w}`)
      : ["- No major plan alignment warnings detected."]),
    "",
    "## Risk Flags",
    "",
    ...(riskFlags.length ? riskFlags.map((r) => `- ${r}`) : ["- None detected."]),
    "",
    "## Safety-Critical File Mentions",
    "",
    ...(safetyCriticalMentions.length
      ? safetyCriticalMentions.map((s) => `- ${s}`)
      : ["- None detected."]),
    "",
    "## Recommended Next Action",
    "",
    recommendation,
    "",
    "## Suggested Next Prompt",
    "",
    suggestedNextBuilderPrompt,
    "",
    "## Secret Safety Reminder",
    "",
    SECRET_SAFETY_NOTE,
    "",
    "## App Note",
    "",
    "This report is rule/keyword-based. It does not call Ollama, edit files, run commands, inspect raw project files, or prove implementation is correct.",
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
    builderPlanComparisonExisted: Boolean(input.builderPlanComparison),
    decisionReportExisted: Boolean(input.decisionReport),
    patchReviewPackExisted: Boolean(input.patchReviewPack),
    safetyBackupVerified: Boolean(input.checkpointAvailability.restorable),
    backlogWarningsExisted: Boolean(
      input.imported.backlogWarningsExistedAtImport ??
        backlogCritical + backlogHigh > 0,
    ),
    claimedChanges,
    claimedFilesAreas,
    claimedTestsChecks,
    claimedErrorsFailures,
    missingVerification,
    planAlignmentWarnings,
    riskFlags,
    safetyCriticalMentions,
    recommendation,
    summaryPlainEnglish,
    suggestedNextBuilderPrompt,
    markdownReport,
    previewExcerpt: markdownReport.split("\n").slice(0, 32).join("\n"),
    truncated,
    weakAlignment,
    secretSafetyNote: SECRET_SAFETY_NOTE,
    taskId: input.imported.taskId,
    taskTitle: input.imported.taskTitle,
    taskArtifactKind: input.imported.taskArtifactKind,
    sourceTaskCardHash: input.imported.sourceTaskCardHash,
  };
}

export function isImplementationReportResponseType(
  responseType: BuilderResultRecord["responseType"],
): boolean {
  return responseType === "Implementation report";
}
