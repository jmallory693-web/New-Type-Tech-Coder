import type {
  BacklogItem,
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointAvailabilityState,
  CodeContextAiRecord,
  CodeContextPack,
  CodeQuestionTemplateSelection,
  DecisionReport,
  ImplementationReviewRecord,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecommendation,
  PatchDraftSafetyReviewRecord,
  PatchDraftSafetyReviewTargetKind,
  ImportedPatchDraftSource,
  ImportedPatchDraftType,
  ProjectMemorySavedRecord,
  RoleModelMappingState,
  SafeChecksState,
} from "../../shared/types";
import {
  getCompactPlanningGuidanceForSuggestedPrompt,
  getPlanningStyleReportLine,
  type PlanningStyleId,
} from "../../shared/planningStyle";
import {
  backlogOpenCriticalOrHighCount,
  backlogOpenCriticalSafetyCount,
} from "./BacklogManager";

const SECRET_SAFETY_NOTE =
  "This review uses Patch Draft text and safe app metadata only. It does not read source files, unselected files, secrets, or .env contents. Nothing was executed.";

const MAX_INPUT_CHARS = 35_000;
const MAX_REPORT_CHARS = 40_000;
const MAX_PROMPT_CHARS = 6_000;

const SAFETY_FLAG_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "edit mode", pattern: /\benable\s+edit\s+mode\b|\badd\s+edit\s+mode\b|\bedit\s+mode\b/i },
  { label: "AI file access", pattern: /\bai\s+file\s+access\b|\bdirect\s+file\s+access\b|\binvisible\s+file\s+access\b/i },
  { label: "command runner", pattern: /\bcommand\s+runner\b|\brun\s+commands?\b|\bexecute\s+commands?\b/i },
  { label: "arbitrary terminal", pattern: /\barbitrary\s+terminal\b|\bopen\s+a\s+shell\b|\bcustom\s+command\b/i },
  { label: "custom commands", pattern: /\bcustom\s+commands?\b|\btype\s+a\s+command\b/i },
  { label: "live Qwen", pattern: /\blive\s+qwen\b|\benable\s+live\s+qwen\b/i },
  { label: "provider security", pattern: /\bweaken\s+provider\b|\ballow\s+cloud\s+api\b|\bprovider\s+security\b/i },
  { label: "preload/main process", pattern: /\bpreload\b|\bmain\s+process\b|\bsrc\/main\b|\bdist-electron\b/i },
  { label: "backup/restore", pattern: /\b(bypass|disable|skip)\s+(backup|restore|checkpoint)\b/i },
  { label: "Safety Gate", pattern: /\b(bypass|disable|modify)\s+safety\s+gate\b|\bsafetygate\b/i },
  { label: "package scripts", pattern: /\bpackage\.json\b|\bpackage\s+scripts?\b|\bpostinstall\b|\bpreinstall\b/i },
  { label: "install packages", pattern: /\binstall\s+packages?\b|\bnpm\s+i(nstall)?\b/i },
  { label: "deploy/publish", pattern: /\bdeploy\b|\bpublish\b/i },
  { label: "reset/clean/delete", pattern: /\breset\s+--hard\b|\bgit\s+clean\b|\brm\s+-rf\b|\bdelete\s+(files?|folders?)\b/i },
  { label: "secrets/.env/keys", pattern: /\.env\b|\bapi\s+keys?\b|\bsecrets?\b|\btokens?\b|\bcredentials?\b/i },
  { label: "broad rewrite", pattern: /\bbroad\s+rewrite\b|\bfull\s+rewrite\b|\brewrite\s+everything\b|\bsource-wide\s+refactor\b/i },
  { label: "disabling checks", pattern: /\bdisable\s+(typecheck|lint|test|check)\b|\bskip\s+tests?\b/i },
  { label: "bypassing confirmation", pattern: /\bbypass\s+confirm\b|\bwithout\s+confirm\b|\bauto-?apply\b/i },
  { label: "apply patch", pattern: /\bapply\s+(the\s+)?patch\b|\bauto-?apply\b|\bwrite\s+to\s+disk\b/i },
];

const MISSING_SAFEGUARD_CHECKS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Safety Backup", pattern: /\bsafety\s+backup\b|\bcheckpoint\b|\brestore\b/i },
  { label: "validation checks", pattern: /\bvalidation\s+(steps?|checks?)\b|\bverify\b/i },
  { label: "typecheck/build", pattern: /\btypecheck\b|\bnpm\s+run\s+build\b|\bbuild\/test\b/i },
  { label: "manual smoke test", pattern: /\bsmoke\s+test\b|\bmanual\s+test\b/i },
  { label: "rollback plan", pattern: /\brollback\b|\brecover(y)?\b/i },
  { label: "files likely to change", pattern: /\bfiles?\s+(to\s+change|likely|affected)\b|\bproposed\s+files\b/i },
  { label: "risk controls", pattern: /\brisk\b|\bsafety\s+boundar/i },
  { label: "user approval", pattern: /\buser\s+approval\b|\bwait\s+for\s+approval\b|\boutside\s+builder\b/i },
];

const TEST_CHECK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "typecheck", pattern: /\btypecheck\b/i },
  { label: "build", pattern: /\bnpm\s+run\s+build\b|\bbuild\b/i },
  { label: "pack/dist", pattern: /\bnpm\s+run\s+(pack|dist)\b|\bpackaged?\b/i },
  { label: "smoke test", pattern: /\bsmoke\s+test\b/i },
];

function makeId(): string {
  return `pdsr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

function extractSection(text: string, heading: string): string {
  const re = new RegExp(
    `##\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s|\\n#\\s|$)`,
    "i",
  );
  const m = text.match(re);
  return m?.[1]?.trim() ?? "";
}

function extractFileMentions(text: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /`([^`]+\.(?:ts|tsx|js|jsx|json|md|css|mjs|cjs))`/gi,
    /\b(?:src|dist|dist-electron|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md)\b/gi,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const p = m[1] ?? m[0];
      if (p && p.length < 120) paths.add(p.replace(/\\/g, "/"));
    }
  }
  return [...paths].slice(0, 25);
}

function summarizeDraftScope(draftText: string): string {
  const goal = extractSection(draftText, "Goal");
  const proposed = extractSection(draftText, "Proposed Files / Areas");
  const changes = extractSection(draftText, "Draft Changes");
  const parts = [
    goal ? `Goal excerpt: ${goal.split("\n").slice(0, 3).join(" ").slice(0, 280)}` : null,
    proposed
      ? `Proposed areas: ${proposed.split("\n").slice(0, 4).join(" ").slice(0, 280)}`
      : null,
    changes
      ? `Draft changes excerpt: ${changes.split("\n").slice(0, 4).join(" ").slice(0, 280)}`
      : null,
  ].filter(Boolean);
  return parts.length
    ? parts.join(" ")
    : "Draft scope could not be parsed into clear sections — review manually.";
}

function chooseRecommendation(input: {
  safetyFlags: string[];
  missingSafeguards: string[];
  alignmentWarnings: string[];
  backupRestorable: boolean;
  hasSafeCheckResult: boolean;
  backlogCriticalSafety: number;
  contradictsNoApply: boolean;
  draftTruncated: boolean;
  packWarnings: number;
}): PatchDraftSafetyReviewRecommendation {
  const blocking = input.safetyFlags.filter((f) =>
    /edit mode|AI file access|command runner|arbitrary terminal|custom commands|live Qwen|apply patch|broad rewrite|secrets|Safety Gate|bypassing confirmation/i.test(
      f,
    ),
  );

  if (input.contradictsNoApply || blocking.length > 0) {
    return "Do not proceed yet";
  }

  if (!input.backupRestorable) {
    return "Create/verify Safety Backup first";
  }

  if (input.backlogCriticalSafety > 0) {
    return "Do not proceed yet";
  }

  if (!input.hasSafeCheckResult && input.missingSafeguards.includes("typecheck/build")) {
    return "Run Build/Test Checks first";
  }

  if (
    input.alignmentWarnings.some((w) =>
      /missing context|more context|insufficient/i.test(w),
    ) ||
    input.draftTruncated ||
    input.packWarnings > 0
  ) {
    if (input.missingSafeguards.length >= 4) {
      return "Select more code context first";
    }
  }

  if (input.missingSafeguards.length >= 5 || input.alignmentWarnings.length >= 3) {
    return "Ask outside builder for a plan first";
  }

  if (blocking.length === 0 && input.safetyFlags.length <= 1 && input.missingSafeguards.length <= 2) {
    return "Safe to send to outside builder for review";
  }

  if (input.safetyFlags.length >= 2 || input.missingSafeguards.length >= 3) {
    return "Ask local AI for a narrower patch draft";
  }

  return "Ask outside builder for a plan first";
}

function buildSuggestedNextPrompt(input: {
  recommendation: PatchDraftSafetyReviewRecommendation;
  userRequest: string;
  safetyFlags: string[];
  missingSafeguards: string[];
  alignmentWarnings: string[];
  planningStyle?: PlanningStyleId;
}): string {
  const highRisk =
    input.recommendation === "Do not proceed yet" ||
    input.safetyFlags.length >= 2;

  const lines = [
    "# Outside builder prompt (from NTTC Patch Draft Safety Review)",
    "",
    highRisk
      ? "Please review this patch draft and provide a **revised plan or clarification only**. Do not implement yet."
      : "Please review this patch draft and provide an **implementation plan first**. Wait for explicit approval before writing code.",
    "",
    `NTTC recommendation: ${input.recommendation}`,
    "",
    input.userRequest.trim()
      ? `User goal: ${input.userRequest.trim().slice(0, 500)}`
      : "User goal: (not specified in NTTC)",
    "",
  ];

  if (input.safetyFlags.length) {
    lines.push("Safety flags to address:", ...input.safetyFlags.map((f) => `- ${f}`), "");
  }
  if (input.missingSafeguards.length) {
    lines.push(
      "Missing safeguards to add:",
      ...input.missingSafeguards.map((m) => `- ${m}`),
      "",
    );
  }
  if (input.alignmentWarnings.length) {
    lines.push(
      "Alignment warnings:",
      ...input.alignmentWarnings.slice(0, 6).map((w) => `- ${w}`),
      "",
    );
  }

  lines.push(
    "Constraints:",
    "- NTTC is inspect-only and did not apply this patch.",
    "- Do not enable edit mode, live Qwen, arbitrary terminal, or AI file browsing.",
    "- Prefer a small, reviewable change with validation steps and rollback notes.",
  );
  if ((input.planningStyle ?? "small-model-friendly") === "small-model-friendly") {
    lines.push(`- ${getCompactPlanningGuidanceForSuggestedPrompt()}`);
  }

  const text = lines.join("\n");
  return text.length > MAX_PROMPT_CHARS ? `${text.slice(0, MAX_PROMPT_CHARS - 1)}…` : text;
}

export interface PatchDraftSafetyReviewTargetMeta {
  targetKind: PatchDraftSafetyReviewTargetKind;
  targetLabel: string;
  importedSource: ImportedPatchDraftSource | null;
  importedDraftType: ImportedPatchDraftType | null;
  isImported: boolean;
}

export interface PatchDraftSafetyReviewInput {
  userRequest: string;
  patchDraft: PatchDraftRecord;
  reviewTarget?: PatchDraftSafetyReviewTargetMeta;
  codeContextPreview: CodeContextPack | null;
  codeContextAiResponse: CodeContextAiRecord | null;
  codeContextQuestionTemplate: CodeQuestionTemplateSelection | null;
  codeQuestion: string;
  decisionReport: DecisionReport | null;
  builderPlan: BuilderPlanRecord | null;
  implementationReview: ImplementationReviewRecord | null;
  builderPlanComparison: BuilderPlanComparisonRecord | null;
  projectMemoryLastSaved: ProjectMemorySavedRecord | null;
  checkpointAvailability: CheckpointAvailabilityState;
  safeChecks: SafeChecksState;
  backlogItems: BacklogItem[];
  roleModelMapping: RoleModelMappingState | null;
  changedFiles: ChangedFilesScanResult | null;
  planningStyle?: PlanningStyleId;
}

/**
 * Stage 60: rule/keyword-based Patch Draft Safety Review.
 * Does not call Ollama. Does not read source files or run commands.
 */
export function buildPatchDraftSafetyReview(
  input: PatchDraftSafetyReviewInput,
): PatchDraftSafetyReviewRecord {
  const originalDraft = input.patchDraft.draftText;
  const truncatedInput = originalDraft.length > MAX_INPUT_CHARS;
  const draftText = truncatedInput
    ? `${originalDraft.slice(0, MAX_INPUT_CHARS - 1)}…`
    : originalDraft;

  const safetyFlags = matchLabels(draftText, SAFETY_FLAG_PATTERNS);
  const missingSafeguards = MISSING_SAFEGUARD_CHECKS.filter(
    (check) => !check.pattern.test(draftText),
  ).map((c) => c.label);

  const testsMentioned = matchLabels(draftText, TEST_CHECK_PATTERNS);
  if (!testsMentioned.includes("typecheck") && !testsMentioned.includes("build")) {
    if (!missingSafeguards.includes("typecheck/build")) {
      missingSafeguards.push("typecheck/build");
    }
  }

  const alignmentWarnings: string[] = [];
  const contradictsNoApply =
    /\bapply\s+(the\s+)?patch\b|\bwrite\s+(the\s+)?changes?\s+to\s+disk\b|\bnttc\s+should\s+edit\b|\bauto-?apply\b/i.test(
      draftText,
    );
  if (contradictsNoApply) {
    alignmentWarnings.push(
      "Draft language may contradict NTTC no-apply model (mentions apply/write/auto-apply).",
    );
  }

  const question =
    input.codeQuestion.trim() ||
    input.patchDraft.userQuestion ||
    input.codeContextQuestionTemplate?.questionText ||
    "";
  if (question && !new RegExp(question.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(draftText)) {
    alignmentWarnings.push(
      "Draft may have shifted away from the original Code Question / template focus.",
    );
  }

  if (input.codeContextAiResponse?.recommendedNextStep) {
    const step = input.codeContextAiResponse.recommendedNextStep;
    if (/do not proceed|more context/i.test(step) && !/more context|select more/i.test(draftText)) {
      alignmentWarnings.push(
        `Code AI recommended “${step}” but the draft may not reflect that caution.`,
      );
    }
  }

  if (input.decisionReport) {
    const rec = input.decisionReport.recommendedNextAction.label;
    if (/do not proceed|backup|checks/i.test(rec) && !new RegExp(rec.slice(0, 20), "i").test(draftText)) {
      alignmentWarnings.push(
        `Decision Report recommends “${rec}” but the draft does not clearly echo it.`,
      );
    }
  }

  if (input.implementationReview?.recommendation === "Do not proceed yet") {
    alignmentWarnings.push(
      "Implementation Review previously recommended Do not proceed yet — draft should be reviewed carefully.",
    );
  }

  if (input.builderPlanComparison?.recommendation === "Do not proceed yet") {
    alignmentWarnings.push(
      "Builder Plan Comparison previously recommended Do not proceed yet.",
    );
  }

  const backlogCritical = backlogOpenCriticalSafetyCount(input.backlogItems);
  const backlogHigh = backlogOpenCriticalOrHighCount(input.backlogItems);
  if ((backlogCritical > 0 || backlogHigh > 0) && !/\bbacklog\b|\bsafety\s+concern\b/i.test(draftText)) {
    alignmentWarnings.push(
      `Open backlog warnings exist (critical safety: ${backlogCritical}); draft does not clearly address backlog.`,
    );
  }

  if (input.patchDraft.recommendation?.toLowerCase().includes("more context")) {
    alignmentWarnings.push(
      "Patch Draft itself recommended more code context — safety review agrees more excerpts may be needed.",
    );
  }

  const proposedFiles = extractFileMentions(draftText);
  const draftScope = summarizeDraftScope(draftText);

  const recommendation = chooseRecommendation({
    safetyFlags,
    missingSafeguards,
    alignmentWarnings,
    backupRestorable: Boolean(input.checkpointAvailability.restorable),
    hasSafeCheckResult: Boolean(input.safeChecks.lastResult),
    backlogCriticalSafety: backlogCritical,
    contradictsNoApply,
    draftTruncated: truncatedInput || input.patchDraft.truncatedResponse,
    packWarnings: input.patchDraft.warningCount,
  });

  const summaryPlainEnglish = [
    input.reviewTarget?.isImported
      ? "Rule-based review of a manually imported outside patch draft before sending to an outside builder."
      : "Rule-based review of the latest Patch Draft before sending to an outside builder.",
    safetyFlags.length
      ? `Safety flags: ${safetyFlags.slice(0, 6).join(", ")}.`
      : "No major safety keyword flags detected.",
    missingSafeguards.length
      ? `Missing safeguards: ${missingSafeguards.slice(0, 5).join(", ")}.`
      : "Core safeguards appear mentioned.",
    `Recommendation: ${recommendation}.`,
  ].join(" ");

  const targetMeta = input.reviewTarget ?? {
    targetKind: "nttc-patch-draft" as const,
    targetLabel: `NTTC Patch Draft (${input.patchDraft.modelName})`,
    importedSource: null,
    importedDraftType: null,
    isImported: false,
  };

  const suggestedNextPrompt = buildSuggestedNextPrompt({
    recommendation,
    userRequest: input.userRequest,
    safetyFlags,
    missingSafeguards,
    alignmentWarnings,
    planningStyle: input.planningStyle,
  });

  const lines: string[] = [
    "# NTTC Patch Draft Safety Review",
    "",
    "## Review Target",
    "",
    `- **Review target:** ${targetMeta.targetLabel}`,
    `- **Target type:** ${targetMeta.isImported ? "Imported Patch Draft" : "NTTC Patch Draft"}`,
    ...(targetMeta.importedSource
      ? [`- **Outside source:** ${targetMeta.importedSource}`]
      : []),
    ...(targetMeta.importedDraftType
      ? [`- **Draft type:** ${targetMeta.importedDraftType}`]
      : []),
    `- **Draft timestamp:** ${input.patchDraft.generatedAt}`,
    ...(targetMeta.isImported
      ? [
          "",
          "This draft came from outside NTTC. NTTC has not verified the code. NTTC did not apply the patch. Treat the draft as a proposal only.",
        ]
      : []),
    "",
    "## Summary",
    "",
    summaryPlainEnglish,
    "",
    `- **Source Patch Draft:** ${input.patchDraft.generatedAt} (${input.patchDraft.modelName})`,
    `- **Source Code Context Pack:** ${input.patchDraft.contextPackGeneratedAt}`,
    `- **Selected files at draft time:** ${input.patchDraft.selectedFileCount}`,
    `- **Pack warnings at draft time:** ${input.patchDraft.warningCount}`,
    `- **Safety Backup:** ${input.checkpointAvailability.label}`,
    `- **Project Memory saved:** ${input.projectMemoryLastSaved ? "Yes" : "No"}`,
    `- **Rule-based only:** No Ollama call; no source file reads.`,
    getPlanningStyleReportLine(input.planningStyle ?? "small-model-friendly"),
    "",
    "## Draft Scope",
    "",
    draftScope,
    "",
    "## Proposed Files / Areas",
    "",
    ...(proposedFiles.length
      ? proposedFiles.map((p) => `- ${p}`)
      : ["- No explicit file paths detected — review Draft Changes manually."]),
    "",
    "## Safety Flags",
    "",
    ...(safetyFlags.length
      ? safetyFlags.map((f) => `- ${f}`)
      : ["- None detected by keyword rules."]),
    "",
    "## Missing Safeguards",
    "",
    ...(missingSafeguards.length
      ? missingSafeguards.map((m) => `- ${m}`)
      : ["- None detected by keyword rules."]),
    "",
    "## Alignment Check",
    "",
    ...(alignmentWarnings.length
      ? alignmentWarnings.map((w) => `- ${w}`)
      : ["- No major alignment warnings detected."]),
    `- **Code Question / template considered:** ${question ? "Yes" : "No"}`,
    `- **Code AI response considered:** ${input.codeContextAiResponse ? "Yes (metadata/excerpt)" : "No"}`,
    `- **Builder Plan considered:** ${input.builderPlan ? "Yes (metadata)" : "No"}`,
    `- **Decision Report considered:** ${input.decisionReport ? "Yes" : "No"}`,
    `- **Implementation Review considered:** ${input.implementationReview ? "Yes" : "No"}`,
    "",
    "## Recommendation",
    "",
    recommendation,
    "",
    "## Suggested Next Prompt",
    "",
    suggestedNextPrompt,
    "",
    "## Safety Reminder",
    "",
    "NTTC did not apply this patch. This is a draft review only.",
    targetMeta.isImported
      ? "Imported drafts are proposals only — verify with your own checks before any outside builder work."
      : null,
    "",
    SECRET_SAFETY_NOTE,
  ].filter((line): line is string => line !== null);

  let markdownReport = lines.join("\n");
  const truncatedReview = markdownReport.length > MAX_REPORT_CHARS;
  if (truncatedReview) {
    markdownReport = `${markdownReport.slice(0, MAX_REPORT_CHARS - 1)}…`;
  }

  return {
    id: makeId(),
    generatedAt: new Date().toISOString(),
    sourcePatchDraftGeneratedAt: input.patchDraft.generatedAt,
    sourcePatchDraftId: input.patchDraft.id,
    reviewTargetKind: targetMeta.targetKind,
    reviewTargetLabel: targetMeta.targetLabel,
    importedSource: targetMeta.importedSource,
    importedDraftType: targetMeta.importedDraftType,
    markdownReport,
    previewExcerpt: markdownReport.split("\n").slice(0, 28).join("\n"),
    recommendation,
    summaryPlainEnglish,
    suggestedNextPrompt,
    safetyFlagCount: safetyFlags.length,
    missingSafeguardCount: missingSafeguards.length,
    alignmentWarningCount: alignmentWarnings.length,
    truncatedInput,
    truncatedReview,
    secretSafetyNote: SECRET_SAFETY_NOTE,
  };
}

export function extractPatchDraftSafetyReviewRecommendation(
  text: string,
): PatchDraftSafetyReviewRecommendation | null {
  const match = text.match(/##\s*Recommendation\s*\n+([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
  if (!match?.[1]) return null;
  const line = match[1]
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .find((l) => l.length > 0);
  return (line as PatchDraftSafetyReviewRecommendation) ?? null;
}
