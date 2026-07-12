import type {
  BacklogItem,
  BuilderHandoffExportRecord,
  BuilderHandoffRecommendation,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
  BuilderPlanComparisonRecord,
  BuilderPlanRecord,
  CodeContextAiRecord,
  CodeContextPack,
  DecisionReport,
  ExternalPatchDraftComparisonRecord,
  ImplementationReviewRecord,
  ImportedPatchDraftRecord,
  PatchDraftRecord,
  PatchDraftSafetyReviewRecord,
  ProjectMemorySavedRecord,
  CheckpointAvailabilityState,
  SafeChecksState,
} from "../../shared/types";
import {
  BUILDER_HANDOFF_EXPORT_SAFETY_REMINDER,
  BUILDER_HANDOFF_EXPORT_TITLE,
} from "../../shared/builderHandoffExportConstants";
import {
  getBuilderHandoffTargetLabel,
  getBuilderHandoffTargetNotes,
} from "../../shared/builderHandoffTargetWording";
import {
  draftMentionsBroadCentralFiles,
  extractProposedFilesAreas,
} from "../../shared/extractPatchDraftAreas";
import {
  getCompactPlanningGuidanceForSuggestedPrompt,
  getPlanningStyleReportLine,
  isSmallModelFriendlyPlanning,
  type PlanningStyleId,
} from "../../shared/planningStyle";
import { backlogOpenCriticalSafetyCount } from "./BacklogManager";

const SECRET_PATTERN = /\bapi[_-]?key\s*=\s*\S+|\bsk-[a-z0-9]{10,}\b/i;
const MAX_REPORT_CHARS = 40_000;

const AVOID_AREAS_DEFAULT = [
  "preload",
  "provider security / ProviderRegistry",
  "Safety Gate",
  "backup/restore / checkpoint flows",
  "package.json scripts",
  "broad App.tsx rewrites",
  "broad main/index.ts IPC dumps",
];

export interface BuilderHandoffExportInput {
  userRequest: string;
  target: BuilderHandoffTarget;
  strictness: BuilderHandoffStrictness;
  planningStyle: PlanningStyleId;
  nttcPatchDraft: PatchDraftRecord | null;
  importedPatchDraft: ImportedPatchDraftRecord | null;
  patchDraftSafetyReview: PatchDraftSafetyReviewRecord | null;
  externalPatchDraftComparison: ExternalPatchDraftComparisonRecord | null;
  builderPlan: BuilderPlanRecord | null;
  builderPlanComparison: BuilderPlanComparisonRecord | null;
  decisionReport: DecisionReport | null;
  implementationReview: ImplementationReviewRecord | null;
  codeContextPreview: CodeContextPack | null;
  codeContextAiResponse: CodeContextAiRecord | null;
  projectMemoryLastSaved: ProjectMemorySavedRecord | null;
  backlogItems: BacklogItem[];
  checkpointAvailability: CheckpointAvailabilityState;
  safeChecks: SafeChecksState;
}

export type BuilderHandoffExportBuildResult =
  | { ok: true; record: BuilderHandoffExportRecord }
  | { ok: false; message: string };

function makeId(): string {
  return `bhe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function combinedDraftText(
  nttc: PatchDraftRecord | null,
  imported: ImportedPatchDraftRecord | null,
): string {
  return [nttc?.draftText ?? "", imported?.draftText ?? ""].filter(Boolean).join("\n\n");
}

function hasMinimumInputs(input: BuilderHandoffExportInput): boolean {
  return Boolean(
    input.nttcPatchDraft ||
      input.importedPatchDraft ||
      input.patchDraftSafetyReview ||
      input.externalPatchDraftComparison ||
      input.builderPlan ||
      input.decisionReport,
  );
}

function collectMissingContext(input: BuilderHandoffExportInput): string[] {
  const missing: string[] = [];
  if (!input.checkpointAvailability.restorable) {
    missing.push("Safety Backup not verified");
  }
  if (!input.patchDraftSafetyReview) {
    missing.push("Patch Draft Safety Review");
  }
  if (
    input.nttcPatchDraft &&
    input.importedPatchDraft &&
    !input.externalPatchDraftComparison
  ) {
    missing.push("External Patch Draft Comparison (both drafts exist)");
  }
  if (!input.safeChecks.lastResult) {
    missing.push("Build/Test Check run");
  }
  if (!input.codeContextAiResponse) {
    missing.push("Code AI Review");
  }
  if (!input.builderPlan) {
    missing.push("Builder Plan");
  }
  if (!input.nttcPatchDraft && !input.importedPatchDraft) {
    missing.push("Patch draft (NTTC or imported)");
  }
  return missing;
}

function detectSecretExposure(input: BuilderHandoffExportInput): boolean {
  const text = combinedDraftText(input.nttcPatchDraft, input.importedPatchDraft);
  return SECRET_PATTERN.test(text);
}

function chooseRecommendation(
  input: BuilderHandoffExportInput,
  missing: string[],
  broadCentral: boolean,
): BuilderHandoffRecommendation {
  const pdsr = input.patchDraftSafetyReview;
  const comparison = input.externalPatchDraftComparison;
  const hasDraft = Boolean(input.nttcPatchDraft || input.importedPatchDraft);
  const backupOk = input.checkpointAvailability.restorable;
  const secretRisk = detectSecretExposure(input);
  const backlogCritical = backlogOpenCriticalSafetyCount(input.backlogItems);

  if (!hasDraft && !comparison && !input.builderPlan && !pdsr) {
    return "Do not send yet";
  }
  if (pdsr?.recommendation === "Do not proceed yet") {
    return "Do not send yet";
  }
  if (comparison?.riskLevel === "Blocked / Do not proceed") {
    return "Do not send yet";
  }
  if (secretRisk || backlogCritical > 0) {
    return "Do not send yet";
  }
  if (!backupOk && (broadCentral || (comparison?.safetyFlags.length ?? 0) > 0)) {
    return "Do not send yet";
  }
  if (input.implementationReview) {
    if (input.implementationReview.recommendation === "Do not proceed yet") {
      return "Do not send yet";
    }
    return "Ready for human review, not apply";
  }

  if (
    !pdsr ||
    missing.includes("External Patch Draft Comparison (both drafts exist)")
  ) {
    return "Send only for planning";
  }
  if (comparison?.riskLevel === "High" || broadCentral) {
    return "Send only for planning";
  }
  if ((comparison?.conflictItems.length ?? 0) > 0) {
    return "Send to outside builder for review only";
  }
  if (
    comparison?.riskLevel === "Medium" ||
    (pdsr.recommendation && /caution/i.test(pdsr.recommendation))
  ) {
    return "Send to outside builder for review only";
  }
  if (
    pdsr &&
    comparison &&
    (comparison.riskLevel === "Low" || comparison.riskLevel === "Medium") &&
    backupOk &&
    !broadCentral &&
    missing.length <= 2
  ) {
    return "Send to builder for narrow implementation";
  }
  if (missing.length >= 3) {
    return "Send only for planning";
  }
  return "Send to outside builder for review only";
}

function strictnessIntro(strictness: BuilderHandoffStrictness): string {
  switch (strictness) {
    case "conservative":
      return "Use the strongest safety boundaries. Prefer planning and review before any implementation.";
    case "fast-small-patch":
      return "Keep the change as small and fast as possible, but still do not apply patches automatically and do not bypass safeguards.";
    default:
      return "Balance progress with the listed safety boundaries.";
  }
}

function buildApprovedDirection(input: BuilderHandoffExportInput): string[] {
  const lines: string[] = [];
  if (input.patchDraftSafetyReview) {
    lines.push(
      `- Patch Draft Safety Review (${input.patchDraftSafetyReview.reviewTargetLabel ?? "saved draft"}): ${input.patchDraftSafetyReview.recommendation}`,
    );
  }
  if (input.externalPatchDraftComparison) {
    lines.push(
      `- External Patch Draft Comparison: ${input.externalPatchDraftComparison.riskLevel} → ${input.externalPatchDraftComparison.recommendation}`,
    );
    if (input.externalPatchDraftComparison.strongestAgreement) {
      lines.push(
        `- Strongest agreement: ${input.externalPatchDraftComparison.strongestAgreement}`,
      );
    }
    if (input.externalPatchDraftComparison.biggestConflict) {
      lines.push(
        `- Biggest conflict: ${input.externalPatchDraftComparison.biggestConflict.slice(0, 220)}`,
      );
    }
  }
  if (input.decisionReport) {
    lines.push(
      `- Decision Report next action: ${input.decisionReport.recommendedNextAction.label}`,
    );
  }
  if (input.builderPlan) {
    lines.push(`- Builder Plan saved: ${input.builderPlan.generatedAt}`);
  }
  if (input.builderPlanComparison) {
    lines.push(
      `- Builder Plan Comparison: ${input.builderPlanComparison.recommendation ?? "saved"}`,
    );
  }
  if (lines.length === 0) {
    lines.push("- No approved direction artifacts yet. Treat this as planning-only.");
  }
  return lines;
}

function buildBuilderInstructions(
  input: BuilderHandoffExportInput,
  recommendation: BuilderHandoffRecommendation,
  likelyAreas: string[],
): string {
  const targetNotes = getBuilderHandoffTargetNotes(input.target);
  const planningCompact = isSmallModelFriendlyPlanning(input.planningStyle)
    ? getCompactPlanningGuidanceForSuggestedPrompt()
    : null;
  const scopeHint =
    likelyAreas.length > 0
      ? `Focus on: ${likelyAreas.slice(0, 8).join(", ")}.`
      : "Keep scope narrow and name the files you will touch before editing.";

  const lines = [
    `You are receiving an NTTC Builder Handoff Pack for ${getBuilderHandoffTargetLabel(input.target)}.`,
    "",
    strictnessIntro(input.strictness),
    "",
    "Implement only the requested narrow change.",
    "Do not apply unrelated refactors.",
    "Do not add terminal access, command runner, Apply Patch, live Qwen, TTS, or edit mode.",
    "Do not bypass confirmation gates or remove backup/restore safeguards.",
    "Do not send or store secrets.",
    scopeHint,
    "",
    `NTTC recommendation for this handoff: ${recommendation}.`,
    "",
    "Target-specific notes:",
    ...targetNotes.map((n) => `- ${n}`),
  ];
  if (planningCompact) {
    lines.push("", planningCompact);
  }
  if (input.userRequest.trim()) {
    lines.push("", `Original user request: ${input.userRequest.trim().slice(0, 500)}`);
  }
  return lines.join("\n");
}

export function buildBuilderHandoffExport(
  input: BuilderHandoffExportInput,
): BuilderHandoffExportBuildResult {
  if (!hasMinimumInputs(input)) {
    return {
      ok: false,
      message:
        "Create a patch draft, imported draft, safety review, or comparison before generating a handoff.",
    };
  }

  const draftText = combinedDraftText(input.nttcPatchDraft, input.importedPatchDraft);
  const likelyAreas = [
    ...extractProposedFilesAreas(draftText),
    ...(input.importedPatchDraft?.likelyFilesAreas ?? []),
    ...(input.externalPatchDraftComparison?.sharedAreas ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i);
  const avoidAreas = [
    ...AVOID_AREAS_DEFAULT,
    ...(input.externalPatchDraftComparison?.safetyFlags ?? []),
    ...(input.builderPlanComparison?.riskFlags ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i);
  const broadCentral = draftMentionsBroadCentralFiles(draftText);
  const missing = collectMissingContext(input);
  const recommendation = chooseRecommendation(input, missing, broadCentral);
  const buildTestStatus = input.safeChecks.lastResult
    ? `${input.safeChecks.lastResult.scriptName} (${input.safeChecks.lastResult.status})`
    : null;
  const safetyStatusSummary = [
    input.checkpointAvailability.restorable
      ? "Safety Backup verified"
      : "Safety Backup not verified",
    buildTestStatus ? `Build/Test: ${buildTestStatus}` : "Build/Test: not run",
    input.patchDraftSafetyReview
      ? `Safety Review: ${input.patchDraftSafetyReview.recommendation}`
      : "Safety Review: missing",
    input.externalPatchDraftComparison
      ? `Comparison: ${input.externalPatchDraftComparison.riskLevel}`
      : "Comparison: missing",
    getPlanningStyleReportLine(input.planningStyle),
  ].join(" · ");

  const smallModelSection = isSmallModelFriendlyPlanning(input.planningStyle)
    ? [
        "- Split logic into small focused files.",
        "- Keep `App.tsx` and `main/index.ts` light.",
        "- Use shared helpers, managers, components, and report builders.",
        "- Avoid giant file rewrites.",
        getCompactPlanningGuidanceForSuggestedPrompt(),
      ].filter(Boolean)
    : [getPlanningStyleReportLine(input.planningStyle)];

  const validationLines = [
    "- Run `npm run typecheck`.",
    "- Run `npm run build`.",
    "- Run packaged smoke tests if packaging changed.",
    "- Perform manual smoke steps listed in NTTC reports.",
    "- Verify Safety Backup before risky work.",
    "- Note rollback/restore steps if validation fails.",
  ];
  if (input.strictness === "fast-small-patch") {
    validationLines.push("- Keep validation focused on the touched files only.");
  } else if (input.strictness === "conservative") {
    validationLines.push("- Do not skip validation to save time.");
  }

  const lines = [
    `# ${BUILDER_HANDOFF_EXPORT_TITLE}`,
    "",
    "## Purpose",
    "This pack hands off reviewed patch-planning work to an outside builder or human reviewer.",
    "It summarizes approved direction, scope, safety boundaries, and validation requirements.",
    "NTTC generated this from stored text/metadata only — not from live source reads.",
    "",
    "## Builder Target",
    `- **Target:** ${getBuilderHandoffTargetLabel(input.target)}`,
    `- **Strictness:** ${input.strictness}`,
    `- **Generated:** ${new Date().toISOString()}`,
    "",
    "## Current Safety Status",
    `- **Safety Backup verified:** ${input.checkpointAvailability.restorable ? "yes" : "no"}`,
    `- **Build/Test status:** ${buildTestStatus ?? "unknown / not run"}`,
    `- **Patch Draft Safety Review:** ${input.patchDraftSafetyReview ? input.patchDraftSafetyReview.recommendation : "missing"}`,
    `- **External Patch Draft Comparison:** ${input.externalPatchDraftComparison ? `${input.externalPatchDraftComparison.riskLevel} / ${input.externalPatchDraftComparison.recommendation}` : "missing"}`,
    `- **${getPlanningStyleReportLine(input.planningStyle)}**`,
    "",
    "## Approved Direction",
    ...buildApprovedDirection(input),
    "",
    "## Scope",
    "### Likely files / areas to touch",
    ...(likelyAreas.length
      ? likelyAreas.map((a) => `- ${a}`)
      : ["- None detected from stored drafts — keep scope explicit in your plan."]),
    "",
    "### Files / areas to avoid or handle carefully",
    ...avoidAreas.map((a) => `- ${a}`),
    ...(broadCentral ? ["- Broad App.tsx / main/index.ts rewrite risk detected"] : []),
    "",
    "## Safety Boundaries",
    "- Do not add source editing unless explicitly requested in a later stage.",
    "- Do not add Apply Patch.",
    "- Do not add arbitrary terminal or custom command input.",
    "- Do not enable live Qwen.",
    "- Do not bypass confirmation gates.",
    "- Do not send secrets.",
    "- Do not remove backup/restore safeguards.",
    "- Keep changes narrow.",
    ...(input.strictness === "conservative"
      ? ["- Prefer review-only responses until safeguards are complete."]
      : []),
    "",
    "## Small-Model Friendly Architecture",
    ...smallModelSection.map((l) => (l.startsWith("-") ? l : `- ${l}`)),
    "",
    "## Validation Required",
    ...validationLines,
    "",
    "## Builder Instructions",
    buildBuilderInstructions(input, recommendation, likelyAreas),
    "",
    "## Report Back Format",
    "Require the builder to return:",
    "1. Analysis",
    "2. Plan",
    "3. Files changed",
    "4. Implementation summary",
    "5. Validation performed",
    "6. Risks",
    "7. Safety confirmations",
    "",
    "## Missing Context / Warnings",
    ...(missing.length
      ? missing.map((m) => `- ${m}`)
      : ["- No major missing context detected from stored metadata."]),
    ...(detectSecretExposure(input)
      ? ["- Possible secret exposure detected in stored draft text — do not send."]
      : []),
    "",
    "## Recommendation",
    recommendation,
    "",
    "## Safety Reminder",
    BUILDER_HANDOFF_EXPORT_SAFETY_REMINDER,
  ];

  let markdownReport = lines.join("\n");
  let truncated = false;
  if (markdownReport.length > MAX_REPORT_CHARS) {
    markdownReport = `${markdownReport.slice(0, MAX_REPORT_CHARS)}\n\n…(truncated for handoff pack size)`;
    truncated = true;
  }

  const record: BuilderHandoffExportRecord = {
    id: makeId(),
    generatedAt: new Date().toISOString(),
    target: input.target,
    strictness: input.strictness,
    planningStyle: input.planningStyle,
    recommendation,
    missingContextCount: missing.length,
    missingContextItems: missing,
    safetyStatusSummary,
    safetyBackupVerified: input.checkpointAvailability.restorable,
    buildTestStatus,
    nttcPatchDraftExisted: Boolean(input.nttcPatchDraft),
    importedPatchDraftExisted: Boolean(input.importedPatchDraft),
    patchDraftSafetyReviewExisted: Boolean(input.patchDraftSafetyReview),
    externalPatchDraftComparisonExisted: Boolean(input.externalPatchDraftComparison),
    builderPlanExisted: Boolean(input.builderPlan),
    builderPlanComparisonExisted: Boolean(input.builderPlanComparison),
    decisionReportExisted: Boolean(input.decisionReport),
    implementationReviewExisted: Boolean(input.implementationReview),
    codeContextPackExisted: Boolean(input.codeContextPreview?.markdownReport),
    codeContextAiExisted: Boolean(input.codeContextAiResponse),
    projectMemorySaved: Boolean(input.projectMemoryLastSaved),
    markdownReport,
    previewExcerpt: markdownReport.split("\n").slice(0, 28).join("\n"),
    truncated,
  };

  return { ok: true, record };
}
