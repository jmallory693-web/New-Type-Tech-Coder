import type {
  BacklogItem,
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  CodeContextAiRecord,
  DecisionReport,
  ExternalPatchDraftComparisonRecord,
  ExternalPatchDraftComparisonRecommendation,
  ExternalPatchDraftComparisonRiskLevel,
  ImplementationReviewRecord,
  ImportedPatchDraftRecord,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecord,
  CheckpointAvailabilityState,
} from "../../shared/types";
import {
  EXTERNAL_PATCH_DRAFT_COMPARISON_PARTIAL_NOTE,
  EXTERNAL_PATCH_DRAFT_COMPARISON_SAFETY_REMINDER,
  EXTERNAL_PATCH_DRAFT_COMPARISON_TITLE,
} from "../../shared/externalPatchDraftComparisonConstants";
import {
  draftMentionsBroadCentralFiles,
  draftMentionsModularSplit,
  extractProposedFilesAreas,
  intersectAreas,
  onlyInFirst,
} from "../../shared/extractPatchDraftAreas";
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
  "This comparison uses stored patch draft text and safe app metadata only. It does not read project source files, unselected files, secrets, or .env contents. Nothing was executed or applied.";

const MAX_INPUT_CHARS = 35_000;
const MAX_REPORT_CHARS = 40_000;
const MAX_PROMPT_CHARS = 6_000;

const BLOCKING_RISK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "apply patch", pattern: /\bapply\s+(the\s+)?patch\b|\bauto-?apply\b/i },
  { label: "edit mode", pattern: /\benable\s+edit\s+mode\b|\badd\s+edit\s+mode\b/i },
  {
    label: "AI file access",
    pattern: /\bai\s+file\s+access\b|\binvisible\s+file\s+access\b|\bbrowse\s+project\b/i,
  },
  {
    label: "arbitrary terminal",
    pattern: /\barbitrary\s+terminal\b|\bcustom\s+command\b|\btype\s+a\s+command\b/i,
  },
  { label: "command runner", pattern: /\bcommand\s+runner\b|\brun\s+commands?\b/i },
  { label: "live Qwen", pattern: /\blive\s+qwen\b|\benable\s+live\s+qwen\b/i },
  {
    label: "broad rewrite",
    pattern: /\bbroad\s+rewrite\b|\bfull\s+rewrite\b|\brewrite\s+everything\b|\bsource-wide\s+refactor\b/i,
  },
  {
    label: "secrets exposure",
    pattern: /\bapi[_-]?key\s*=\s*\S+|\bsk-[a-z0-9]{10,}\b/i,
  },
  {
    label: "disable checks",
    pattern: /\bdisable\s+(typecheck|lint|test|check)\b|\bskip\s+tests?\b/i,
  },
  {
    label: "bypass confirmation",
    pattern: /\bbypass\s+confirm\b|\bwithout\s+confirm\b/i,
  },
];

const SAFETY_CRITICAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "main/index.ts", pattern: /\bmain\/index\.ts\b|\bmain\s+process\b|\bsrc\/main\/index\b/i },
  { label: "preload", pattern: /\bpreload\b/i },
  { label: "provider security", pattern: /\bprovider\s+security\b|\bproviderregistry\b/i },
  { label: "Safety Gate", pattern: /\bsafety\s+gate\b|\bsafetygate\b/i },
  { label: "backup/restore", pattern: /\bbackup\b|\brestore\b|\bcheckpoint\b/i },
  { label: "package scripts", pattern: /\bpackage\.json\b|\bpackage\s+scripts?\b/i },
  { label: "install/deploy/publish", pattern: /\binstall\s+packages?\b|\bdeploy\b|\bpublish\b/i },
  { label: "App.tsx broad work", pattern: /\bApp\.tsx\b.*\b(refactor|rewrite|dump)\b/i },
];

const MISSING_SAFEGUARD_CHECKS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Safety Backup", pattern: /\bsafety\s+backup\b|\bcheckpoint\b|\brestore\b/i },
  { label: "rollback plan", pattern: /\brollback\b|\brecover(y)?\b/i },
  { label: "typecheck", pattern: /\btypecheck\b/i },
  { label: "build", pattern: /\bnpm\s+run\s+build\b|\bbuild\b/i },
  { label: "manual smoke test", pattern: /\bsmoke\s+test\b|\bmanual\s+test\b/i },
  { label: "limited file scope", pattern: /\blimited\s+scope\b|\bsmall\s+change\b|\bfocused\s+module\b/i },
  { label: "no-apply reminder", pattern: /\bno\s+apply\b|\bdoes\s+not\s+apply\b|\bplan\s+only\b/i },
  { label: "secret handling", pattern: /\bsecret\b|\.env\b|\bapi\s+key\b/i },
  { label: "small-model friendly modularity", pattern: /\bfocused\s+module\b|\bsmall\s+readable\b|\bmodule\s+boundar/i },
];

const AGREEMENT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "no apply / no edit", pattern: /\bno\s+apply\b|\bdoes\s+not\s+edit\b|\bplan\s+only\b/i },
  { label: "tests/typecheck/build", pattern: /\btypecheck\b|\bnpm\s+run\s+build\b|\bbuild\/test\b/i },
  { label: "Safety Backup", pattern: /\bsafety\s+backup\b|\bcheckpoint\b/i },
  { label: "validation steps", pattern: /\bvalidation\b|\bverify\b|\bsmoke\s+test\b/i },
  { label: "safety constraints", pattern: /\bsafety\s+boundar|\bdo-?not-?do\b|\binspect-only\b/i },
];

function makeId(): string {
  return `epdc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function truncateInput(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_INPUT_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_INPUT_CHARS), truncated: true };
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

function combinedDraftText(
  nttc: PatchDraftRecord | null,
  imported: ImportedPatchDraftRecord | null,
): string {
  return [nttc?.draftText ?? "", imported?.draftText ?? ""].filter(Boolean).join("\n\n");
}

function chooseRiskLevel(input: {
  blockingFlags: string[];
  safetyCriticalMentions: string[];
  missingSafeguards: string[];
  backupRestorable: boolean;
  broadCentralMention: boolean;
  backlogCriticalSafety: number;
}): ExternalPatchDraftComparisonRiskLevel {
  if (input.blockingFlags.length > 0 || input.backlogCriticalSafety > 0) {
    return "Blocked / Do not proceed";
  }
  if (
    input.safetyCriticalMentions.length >= 2 ||
    (input.broadCentralMention && input.missingSafeguards.length >= 4) ||
    (!input.backupRestorable && input.safetyCriticalMentions.length > 0)
  ) {
    return "High";
  }
  if (
    input.safetyCriticalMentions.length > 0 ||
    input.missingSafeguards.length >= 3 ||
    input.broadCentralMention
  ) {
    return "Medium";
  }
  return "Low";
}

function chooseRecommendation(input: {
  riskLevel: ExternalPatchDraftComparisonRiskLevel;
  partialComparison: boolean;
  blockingFlags: string[];
  missingSafeguards: string[];
  broadCentralMention: boolean;
  agreementCount: number;
  pdsrRecommendation: string | null;
}): ExternalPatchDraftComparisonRecommendation {
  if (input.riskLevel === "Blocked / Do not proceed") {
    return "Do not proceed yet";
  }
  if (input.riskLevel === "High" || input.broadCentralMention) {
    if (/narrow|more\s+context|smaller/i.test(input.pdsrRecommendation ?? "")) {
      return "Ask local AI for a narrower patch draft";
    }
    return "Ask outside builder for a narrower plan";
  }
  if (input.partialComparison) {
    return "Generate Builder Prompt with constraints";
  }
  if (input.missingSafeguards.length >= 3) {
    return "Generate Builder Prompt with constraints";
  }
  if (input.riskLevel === "Medium") {
    return "Safe to send to outside builder for review only";
  }
  if (input.agreementCount >= 2 && input.blockingFlags.length === 0) {
    return "Ready for manual implementation review, not apply";
  }
  return "Safe to send to outside builder for review only";
}

function buildSuggestedNextPrompt(input: {
  recommendation: ExternalPatchDraftComparisonRecommendation;
  userRequest: string;
  mergedDirection: string[];
  avoidAreas: string[];
  missingSafeguards: string[];
  riskFlags: string[];
  planningStyle: PlanningStyleId;
  partialComparison: boolean;
}): string {
  const lines = [
    "# Suggested Next Builder Prompt (from External Patch Draft Comparison)",
    "",
    "## Role",
    "",
    "You are an outside builder AI. New Type Tech Coder does not edit files, apply patches, or run commands.",
    "Return a plan only unless the user explicitly approves implementation elsewhere.",
    "",
    "## Task",
    "",
    input.userRequest.trim() || "Clarify the smallest safe change set before planning.",
    "",
    `## Comparison recommendation`,
    "",
    `- **Recommendation:** ${input.recommendation}`,
    input.partialComparison
      ? `- **Note:** ${EXTERNAL_PATCH_DRAFT_COMPARISON_PARTIAL_NOTE}`
      : "- Compared NTTC Patch Draft and Imported Patch Draft using stored text only.",
    "",
    "## Safest merged direction",
    "",
    ...(input.mergedDirection.length
      ? input.mergedDirection.map((d) => `- ${d}`)
      : ["- Keep changes small, modular, and reviewable."]),
    "",
    "## Files/areas to avoid or handle carefully",
    "",
    ...(input.avoidAreas.length
      ? input.avoidAreas.map((a) => `- ${a}`)
      : ["- No specific avoid list detected — still avoid broad App.tsx/main/index.ts dumps."]),
    "",
    "## Missing safeguards to include",
    "",
    ...(input.missingSafeguards.length
      ? input.missingSafeguards.map((m) => `- ${m}`)
      : ["- Include typecheck/build/manual smoke and Safety Backup reminder."]),
    "",
    "## Hard boundaries",
    "",
    "- No apply patch / no auto-apply.",
    "- No edit mode, live Qwen, arbitrary terminal, or custom commands.",
    "- No invisible AI file access or project browsing.",
    "- Verify Safety Backup before risky work.",
    "- Run typecheck/build and a manual smoke test after changes.",
    "",
    "## Risk flags from comparison",
    "",
    ...(input.riskFlags.length
      ? input.riskFlags.map((r) => `- ${r}`)
      : ["- None detected by keyword rules."]),
  ];

  if (input.planningStyle === "small-model-friendly") {
    lines.push("", `- ${getCompactPlanningGuidanceForSuggestedPrompt()}`);
  }

  const text = lines.join("\n");
  return text.length > MAX_PROMPT_CHARS ? `${text.slice(0, MAX_PROMPT_CHARS - 1)}…` : text;
}

export interface ExternalPatchDraftComparisonInput {
  userRequest: string;
  nttcPatchDraft: PatchDraftRecord | null;
  importedPatchDraft: ImportedPatchDraftRecord | null;
  codeContextAiResponse: CodeContextAiRecord | null;
  patchDraftSafetyReview: PatchDraftSafetyReviewRecord | null;
  builderPlan: BuilderPlanRecord | null;
  builderPlanComparison: BuilderPlanComparisonRecord | null;
  decisionReport: DecisionReport | null;
  implementationReview: ImplementationReviewRecord | null;
  backlogItems: BacklogItem[];
  checkpointAvailability: CheckpointAvailabilityState;
  planningStyle: PlanningStyleId;
}

export type ExternalPatchDraftComparisonBuildResult =
  | { ok: true; record: ExternalPatchDraftComparisonRecord }
  | { ok: false; message: string };

/**
 * Stage 71: rule-based External Patch Draft Comparison.
 * Does not call AI, read source files, apply patches, or run commands.
 */
export function buildExternalPatchDraftComparison(
  input: ExternalPatchDraftComparisonInput,
): ExternalPatchDraftComparisonBuildResult {
  const hasNttc = Boolean(input.nttcPatchDraft);
  const hasImported = Boolean(input.importedPatchDraft);
  if (!hasNttc && !hasImported) {
    return {
      ok: false,
      message:
        "Generate or import at least one patch draft before comparing.",
    };
  }

  const nttcText = truncateInput(input.nttcPatchDraft?.draftText ?? "");
  const importedText = truncateInput(input.importedPatchDraft?.draftText ?? "");
  const partialComparison = !hasNttc || !hasImported;

  const nttcAreas = hasNttc ? extractProposedFilesAreas(nttcText.text) : [];
  const importedAreas = hasImported
    ? [
        ...extractProposedFilesAreas(importedText.text),
        ...(input.importedPatchDraft?.likelyFilesAreas ?? []),
      ]
    : [];

  const sharedAreas = intersectAreas(nttcAreas, importedAreas);
  const nttcOnlyAreas = onlyInFirst(nttcAreas, importedAreas);
  const importedOnlyAreas = onlyInFirst(importedAreas, nttcAreas);

  const combined = combinedDraftText(input.nttcPatchDraft, input.importedPatchDraft);
  const nttcBlocking = matchLabels(nttcText.text, BLOCKING_RISK_PATTERNS);
  const importedBlocking = matchLabels(importedText.text, BLOCKING_RISK_PATTERNS);
  const blockingFlags = [...new Set([...nttcBlocking, ...importedBlocking])];

  const safetyFlags = [
    ...new Set([
      ...blockingFlags,
      ...matchLabels(combined, SAFETY_CRITICAL_PATTERNS),
      ...(input.importedPatchDraft?.riskPhrases ?? []),
    ]),
  ];

  const safetyCriticalMentions = matchLabels(combined, SAFETY_CRITICAL_PATTERNS);

  const missingSafeguards = MISSING_SAFEGUARD_CHECKS.map((c) => c.label).filter(
    (label) => {
      const rule = MISSING_SAFEGUARD_CHECKS.find((r) => r.label === label);
      return rule ? !rule.pattern.test(combined) : false;
    },
  );

  const agreementItems: string[] = [];
  const conflictItems: string[] = [];

  if (partialComparison) {
    agreementItems.push(EXTERNAL_PATCH_DRAFT_COMPARISON_PARTIAL_NOTE);
  }

  if (hasNttc && hasImported) {
    for (const topic of AGREEMENT_PATTERNS) {
      const inNttc = topic.pattern.test(nttcText.text);
      const inImported = topic.pattern.test(importedText.text);
      if (inNttc && inImported) {
        agreementItems.push(`Both drafts mention ${topic.label}.`);
      } else if (inNttc !== inImported) {
        conflictItems.push(
          `Drafts differ on ${topic.label} (NTTC: ${inNttc ? "yes" : "no"}, imported: ${inImported ? "yes" : "no"}).`,
        );
      }
    }

    if (sharedAreas.length) {
      agreementItems.push(
        `Shared proposed files/areas: ${sharedAreas.slice(0, 8).join(", ")}.`,
      );
    }
    if (nttcOnlyAreas.length) {
      conflictItems.push(
        `NTTC draft only mentions: ${nttcOnlyAreas.slice(0, 6).join(", ")}.`,
      );
    }
    if (importedOnlyAreas.length) {
      conflictItems.push(
        `Imported draft only mentions: ${importedOnlyAreas.slice(0, 6).join(", ")}.`,
      );
    }

    const nttcBroad = draftMentionsBroadCentralFiles(nttcText.text);
    const importedBroad = draftMentionsBroadCentralFiles(importedText.text);
    if (nttcBroad !== importedBroad) {
      conflictItems.push(
        `Modularity mismatch: NTTC ${nttcBroad ? "mentions" : "avoids"} broad App.tsx/main/index.ts work; imported draft ${importedBroad ? "mentions" : "avoids"} it.`,
      );
    }
  }

  const broadCentralMention =
    draftMentionsBroadCentralFiles(nttcText.text) ||
    draftMentionsBroadCentralFiles(importedText.text);

  const modularNttc = draftMentionsModularSplit(nttcText.text);
  const modularImported = draftMentionsModularSplit(importedText.text);

  const backlogCritical = backlogOpenCriticalSafetyCount(input.backlogItems);
  const backlogHigh = backlogOpenCriticalOrHighCount(input.backlogItems);

  if (backlogCritical > 0 || backlogHigh > 0) {
    if (!/\bbacklog\b|\bsafety\s+concern\b/i.test(combined)) {
      conflictItems.push(
        `Open backlog warnings exist (critical safety: ${backlogCritical}, critical/high: ${backlogHigh}) but drafts do not clearly address backlog.`,
      );
      if (!missingSafeguards.includes("Safety Backup")) {
        missingSafeguards.push("backlog warning acknowledgment");
      }
    }
  }

  if (input.patchDraftSafetyReview?.recommendation === "Do not proceed yet") {
    conflictItems.push(
      `Patch Draft Safety Review recommends: ${input.patchDraftSafetyReview.recommendation}.`,
    );
  }

  if (input.builderPlanComparison?.recommendation === "Do not proceed yet") {
    conflictItems.push(
      `Builder Plan Comparison recommends: ${input.builderPlanComparison.recommendation}.`,
    );
  }

  const biggestConflict =
    conflictItems[0] ??
    blockingFlags[0] ??
    (partialComparison ? "Only one patch draft available for comparison." : "No major conflicts detected.");

  const strongestAgreement =
    agreementItems[0] ??
    (sharedAreas[0] ? `Shared area: ${sharedAreas[0]}` : "No strong agreement detected by keyword rules.");

  const riskLevel = chooseRiskLevel({
    blockingFlags,
    safetyCriticalMentions,
    missingSafeguards,
    backupRestorable: Boolean(input.checkpointAvailability.restorable),
    broadCentralMention,
    backlogCriticalSafety: backlogCritical,
  });

  const recommendation = chooseRecommendation({
    riskLevel,
    partialComparison,
    blockingFlags,
    missingSafeguards,
    broadCentralMention,
    agreementCount: agreementItems.length,
    pdsrRecommendation: input.patchDraftSafetyReview?.recommendation ?? null,
  });

  const comparisonStatus = partialComparison
    ? "Partial comparison (one draft missing)"
    : "Full comparison (both drafts present)";

  const mergedDirection = [
    strongestAgreement,
    sharedAreas.length
      ? `Prefer changes in shared areas: ${sharedAreas.slice(0, 5).join(", ")}.`
      : null,
    recommendation === "Ask outside builder for a narrower plan"
      ? "Ask for a narrower plan with explicit file boundaries."
      : null,
  ].filter((v): v is string => Boolean(v));

  const suggestedNextBuilderPrompt = buildSuggestedNextPrompt({
    recommendation,
    userRequest: input.userRequest,
    mergedDirection,
    avoidAreas: [
      ...safetyCriticalMentions,
      ...(broadCentralMention ? ["Broad App.tsx / main/index.ts rewrites"] : []),
    ],
    missingSafeguards,
    riskFlags: safetyFlags,
    planningStyle: input.planningStyle,
    partialComparison,
  });

  const summaryPlainEnglish = [
    comparisonStatus,
    `Strongest agreement: ${strongestAgreement}`,
    `Biggest conflict: ${biggestConflict}`,
    `Risk level: ${riskLevel}.`,
    `Recommendation: ${recommendation}.`,
  ].join(" ");

  const lines: string[] = [
    `# ${EXTERNAL_PATCH_DRAFT_COMPARISON_TITLE}`,
    "",
    "## Summary",
    "",
    `- **Comparison status:** ${comparisonStatus}`,
    `- **Strongest agreement:** ${strongestAgreement}`,
    `- **Biggest conflict:** ${biggestConflict}`,
    `- **Risk level:** ${riskLevel}`,
    `- **Recommendation:** ${recommendation}`,
    "",
    summaryPlainEnglish,
    "",
    "## Inputs Compared",
    "",
    `- **NTTC Patch Draft:** ${hasNttc ? "present" : "missing"}`,
    hasNttc
      ? `- **NTTC generated:** ${input.nttcPatchDraft?.generatedAt} (${input.nttcPatchDraft?.modelName})`
      : "",
    `- **Imported Patch Draft:** ${hasImported ? "present" : "missing"}`,
    hasImported
      ? `- **Imported source/type/time:** ${input.importedPatchDraft?.source} / ${input.importedPatchDraft?.draftType} / ${input.importedPatchDraft?.importedAt}`
      : "",
    `- **Code AI Review:** ${input.codeContextAiResponse ? "present" : "missing"}`,
    `- **Patch Draft Safety Review:** ${input.patchDraftSafetyReview ? "present" : "missing"}`,
    input.patchDraftSafetyReview
      ? `- **Safety review recommendation:** ${input.patchDraftSafetyReview.recommendation}`
      : "",
    `- **Builder Plan:** ${input.builderPlan ? "present" : "missing"}`,
    `- **Builder Plan Comparison:** ${input.builderPlanComparison ? "present" : "missing"}`,
    `- **Decision Report:** ${input.decisionReport ? "present" : "missing"}`,
    `- **Implementation Review:** ${input.implementationReview ? "present" : "missing"}`,
    `- **Safety Backup:** ${input.checkpointAvailability.restorable ? "verified" : "not verified"}`,
  ]
    .filter((line) => line !== "")
    .concat([
      `- **Planning style:** ${getPlanningStyleReportLine(input.planningStyle)}`,
      nttcText.truncated || importedText.truncated
        ? "- **Truncation:** One or more draft texts were truncated for safe comparison size."
        : "",
      "",
      "## Agreement",
      "",
      ...(agreementItems.length
        ? agreementItems.map((a) => `- ${a}`)
        : ["- None detected by keyword rules."]),
      "",
      "## Conflicts / Differences",
      "",
      ...(conflictItems.length
        ? conflictItems.map((c) => `- ${c}`)
        : ["- No major keyword conflicts detected."]),
      "",
      "## Proposed Files / Areas",
      "",
      "### Shared by both drafts",
      "",
      ...(sharedAreas.length
        ? sharedAreas.map((a) => `- ${a}`)
        : ["- None detected (or only one draft available)."]),
      "",
      "### NTTC draft only",
      "",
      ...(nttcOnlyAreas.length
        ? nttcOnlyAreas.map((a) => `- ${a}`)
        : ["- None detected."]),
      "",
      "### Imported draft only",
      "",
      ...(importedOnlyAreas.length
        ? importedOnlyAreas.map((a) => `- ${a}`)
        : ["- None detected."]),
      "",
      "## Safety Flags",
      "",
      ...(safetyFlags.length
        ? safetyFlags.map((f) => `- ${f}`)
        : ["- None detected."]),
      "",
      "## Missing Safeguards",
      "",
      ...(missingSafeguards.length
        ? missingSafeguards.map((m) => `- ${m}`)
        : ["- No major missing safeguards detected by keyword rules."]),
      "",
      "## Small-Model Friendly Architecture Check",
      "",
      `- **Pushes too much into App.tsx/main/index.ts:** ${broadCentralMention ? "Yes — review for giant-file risk" : "No broad central-file dump detected"}`,
      `- **Mentions modular split:** NTTC ${modularNttc ? "yes" : "no"}, imported ${modularImported ? "yes" : "no"}`,
      `- **Next prompt needs stronger modularity:** ${broadCentralMention && input.planningStyle === "small-model-friendly" ? "Yes" : "Maybe — keep files small if planning style is Small-model friendly"}`,
      "",
      "## Recommendation",
      "",
      recommendation,
      "",
      "## Suggested Next Builder Prompt",
      "",
      suggestedNextBuilderPrompt,
      "",
      "## Safety Reminder",
      "",
      EXTERNAL_PATCH_DRAFT_COMPARISON_SAFETY_REMINDER,
      "",
      SECRET_SAFETY_NOTE,
      "",
    ]);

  let markdownReport = lines.filter((line) => line !== "").join("\n");
  const truncated = markdownReport.length > MAX_REPORT_CHARS;
  if (truncated) {
    markdownReport = `${markdownReport.slice(0, MAX_REPORT_CHARS - 1)}…`;
  }

  const missingInputs: string[] = [];
  if (!hasNttc) missingInputs.push("NTTC Patch Draft");
  if (!hasImported) missingInputs.push("Imported Patch Draft");
  if (!input.codeContextAiResponse) missingInputs.push("Code AI Review");
  if (!input.patchDraftSafetyReview) missingInputs.push("Patch Draft Safety Review");
  if (!input.builderPlan) missingInputs.push("Builder Plan");
  if (!input.decisionReport) missingInputs.push("Decision Report");

  return {
    ok: true,
    record: {
      id: makeId(),
      generatedAt: new Date().toISOString(),
      planningStyle: input.planningStyle,
      nttcPatchDraftExisted: hasNttc,
      importedPatchDraftExisted: hasImported,
      importedSource: input.importedPatchDraft?.source ?? null,
      importedDraftType: input.importedPatchDraft?.draftType ?? null,
      importedImportedAt: input.importedPatchDraft?.importedAt ?? null,
      codeContextAiExisted: Boolean(input.codeContextAiResponse),
      patchDraftSafetyReviewExisted: Boolean(input.patchDraftSafetyReview),
      builderPlanExisted: Boolean(input.builderPlan),
      builderPlanComparisonExisted: Boolean(input.builderPlanComparison),
      decisionReportExisted: Boolean(input.decisionReport),
      implementationReviewExisted: Boolean(input.implementationReview),
      safetyBackupVerified: Boolean(input.checkpointAvailability.restorable),
      partialComparison,
      comparisonStatus,
      strongestAgreement,
      biggestConflict,
      riskLevel,
      recommendation,
      agreementItems,
      conflictItems,
      missingSafeguards,
      sharedAreas,
      nttcOnlyAreas,
      importedOnlyAreas,
      safetyFlags,
      missingInputs,
      summaryPlainEnglish,
      suggestedNextBuilderPrompt,
      markdownReport,
      previewExcerpt: markdownReport.split("\n").slice(0, 32).join("\n"),
      truncated,
      draftTextTruncated: nttcText.truncated || importedText.truncated,
      secretSafetyNote: SECRET_SAFETY_NOTE,
    },
  };
}
