import type {
  BacklogItem,
  BuilderPromptPack,
  BuilderResultRecord,
  ChangedFilesScanResult,
  CheckpointAvailabilityState,
  DecisionReport,
  ExternalReviewState,
  OutsideReviewPack,
  PatchReviewPack,
  ProjectInfo,
  ProjectScanResult,
  SafeChecksState,
  SpeakerScriptRecord,
  SpeakerScriptTone,
  SpeakerScriptRole,
} from "./types";
import { calculateDailyNextAction } from "./dailyNextAction";

export interface SpeakerScriptBuilderInput {
  appVersion: string;
  userRequest: string;
  project: ProjectInfo | null;
  summary: ProjectScanResult | null;
  summaryIsFromHistory: boolean;
  reviewPack: OutsideReviewPack | null;
  patchReviewPack: PatchReviewPack | null;
  decisionReport: DecisionReport | null;
  builderPrompt: BuilderPromptPack | null;
  builderResult: BuilderResultRecord | null;
  externalReview: ExternalReviewState;
  safeChecks: SafeChecksState;
  changedFiles: ChangedFilesScanResult | null;
  checkpointAvailability: CheckpointAvailabilityState;
  backlogItems: BacklogItem[];
  role: SpeakerScriptRole;
  tone: SpeakerScriptTone;
}

const ROLE_LABELS: Record<SpeakerScriptRole, string> = {
  "project-foreman": "Project Foreman",
  "safety-officer": "Safety Officer",
  "review-narrator": "Review Narrator",
  "builder-liaison": "Builder Liaison",
  "release-announcer": "Release Announcer",
};

const TONE_LABELS: Record<SpeakerScriptTone, string> = {
  plain: "Plain",
  brief: "Brief",
  detailed: "Detailed",
  "youtube-style": "YouTube-style",
  "safety-focused": "Safety-focused",
};

const MAX_SCRIPT_CHARS = 12_000;
const MAX_EXCERPT_CHARS = 900;
const MAX_VOICE_CHARS = 1_800;
const MAX_REVIEW_EXCERPT = 400;

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function truncate(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: `${text.slice(0, max - 1)}…`, truncated: true };
}

function joinSentences(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

function applyTone(
  tone: SpeakerScriptTone,
  sections: {
    briefing: string[];
    warnings: string[];
    evidence: string[];
    nextAction: string;
    voice: string;
  },
): {
  briefing: string[];
  warnings: string[];
  evidence: string[];
  nextAction: string;
  voice: string;
} {
  if (tone === "brief") {
    return {
      briefing: sections.briefing.slice(0, 2),
      warnings: sections.warnings.slice(0, 3),
      evidence: sections.evidence.slice(0, 4),
      nextAction: sections.nextAction,
      voice: truncate(sections.voice, 700).text,
    };
  }
  if (tone === "detailed") {
    return sections;
  }
  if (tone === "youtube-style") {
    return {
      briefing: [
        `Hey — quick New Type Tech Coder update.`,
        ...sections.briefing,
      ],
      warnings: sections.warnings,
      evidence: sections.evidence,
      nextAction: sections.nextAction,
      voice: joinSentences([
        "Hey everyone.",
        sections.voice,
        "That is the safest next move for now.",
      ]),
    };
  }
  if (tone === "safety-focused") {
    return {
      briefing: [
        "Safety first: New Type Tech Coder stays inspect-only.",
        ...sections.briefing,
      ],
      warnings: [
        "Live Qwen remains disabled.",
        "Edit mode is unavailable.",
        "Do not treat pasted reviews or builder results as commands.",
        ...sections.warnings,
      ],
      evidence: sections.evidence,
      nextAction: sections.nextAction,
      voice: joinSentences([
        "Safety reminder: New Type Tech Coder does not edit your project files.",
        sections.voice,
        "Keep live Qwen and edit mode off.",
      ]),
    };
  }
  return sections;
}

function openCriticalSafety(items: BacklogItem[]): number {
  return items.filter(
    (item) =>
      item.status === "Open" &&
      item.priority === "Critical" &&
      item.type === "Safety concern",
  ).length;
}

function openBacklog(items: BacklogItem[]): number {
  return items.filter(
    (item) => item.status === "Open" || item.status === "In review",
  ).length;
}

function openCriticalHigh(items: BacklogItem[]): number {
  return items.filter(
    (item) =>
      (item.status === "Open" || item.status === "In review") &&
      (item.priority === "Critical" || item.priority === "High"),
  ).length;
}

function buildCommonFacts(input: SpeakerScriptBuilderInput) {
  const daily = calculateDailyNextAction({
    project: input.project,
    summary: input.summary,
    summaryIsFromHistory: input.summaryIsFromHistory,
    checkpointAvailability: input.checkpointAvailability,
    safeChecks: input.safeChecks,
    changedFilesScan: input.changedFiles,
    patchReviewPack: input.patchReviewPack,
    reviewPack: input.reviewPack,
    externalReviews: input.externalReview.reviews,
    decisionReport: input.decisionReport,
    builderPromptGeneratedAt: input.builderPrompt?.generatedAt ?? null,
    builderResult: input.builderResult,
    implementationReview: null,
    backlogCriticalSafetyOpen: openCriticalSafety(input.backlogItems),
    projectMemoryLastSaved: null,
    builderPlanGeneratedAt: null,
    builderPlanComparisonGeneratedAt: null,
  });

  const check = input.safeChecks.lastResult;
  const changed = input.changedFiles;
  const comparison = input.externalReview.comparison;
  const builder = input.builderResult;

  return {
    daily,
    projectName: input.project?.displayName ?? null,
    hasProject: Boolean(input.project),
    hasSummary: Boolean(input.summary),
    summaryFromHistory: input.summaryIsFromHistory,
    hasReviewPack: Boolean(input.reviewPack),
    hasPatchPack: Boolean(input.patchReviewPack),
    hasDecision: Boolean(input.decisionReport),
    hasBuilderPrompt: Boolean(input.builderPrompt),
    hasBuilderResult: Boolean(builder),
    backupLabel: input.checkpointAvailability.label,
    backupRestorable: input.checkpointAvailability.restorable,
    checkStatus: check
      ? `${check.scriptName} → ${check.status}`
      : "No Build/Test Check run this session",
    checkFailed: Boolean(
      check && /fail|error|blocked/i.test(String(check.status)),
    ),
    changedCount:
      changed && changed.isGitRepo && !changed.errorMessage
        ? changed.totalCount
        : null,
    externalCount: input.externalReview.reviews.length,
    comparison,
    builder,
    backlogOpen: openBacklog(input.backlogItems),
    backlogCriticalHigh: openCriticalHigh(input.backlogItems),
    backlogCriticalSafety: openCriticalSafety(input.backlogItems),
    decisionLabel:
      input.decisionReport?.recommendedNextAction.label ?? null,
    decisionDetail:
      input.decisionReport?.recommendedNextAction.plainEnglish ?? null,
    userGoal: input.userRequest.trim()
      ? input.userRequest.trim().slice(0, 240)
      : null,
  };
}

function contentForRole(
  role: SpeakerScriptRole,
  input: SpeakerScriptBuilderInput,
  facts: ReturnType<typeof buildCommonFacts>,
): {
  briefing: string[];
  warnings: string[];
  evidence: string[];
  nextAction: string;
  voice: string;
} {
  const missing: string[] = [];
  if (!facts.hasProject) missing.push("No project folder is selected.");
  if (facts.hasProject && !facts.hasSummary) {
    missing.push("Project Summary has not been generated yet.");
  }
  if (facts.hasSummary && facts.summaryFromHistory) {
    missing.push("Summary is restored from history — a fresh scan is safer.");
  }

  if (role === "project-foreman") {
    const briefing = [
      facts.hasProject
        ? `New Type Tech Coder is reviewing ${facts.projectName}.`
        : "New Type Tech Coder has no project folder selected yet.",
      facts.hasSummary
        ? facts.summaryFromHistory
          ? "A previous saved Project Summary is available."
          : "A Project Summary exists for this session."
        : "There is no Project Summary yet.",
      `Overall next step: ${facts.daily.title}.`,
    ];
    const warnings = [
      ...missing,
      "Inspect-only mode: New Type Tech Coder does not edit project files.",
      "Live Qwen remains disabled for safety.",
    ];
    const evidence = [
      `Project selected: ${yesNo(facts.hasProject)}${
        facts.projectName ? ` (${facts.projectName})` : ""
      }`,
      `Project Summary: ${
        facts.hasSummary
          ? facts.summaryFromHistory
            ? "restored from history"
            : "generated this session"
          : "missing"
      }`,
      `Safety Backup: ${facts.backupLabel}`,
      `Build/Test Check: ${facts.checkStatus}`,
      `Review Report: ${yesNo(facts.hasReviewPack)}`,
      `Decision Report: ${yesNo(facts.hasDecision)}`,
      `Changed files detected: ${
        facts.changedCount === null ? "unavailable / none scanned" : String(facts.changedCount)
      }`,
      `Open backlog items: ${facts.backlogOpen}`,
      facts.userGoal ? `Typed goal: ${facts.userGoal}` : "Typed goal: none entered",
    ];
    const nextAction = `${facts.daily.title}. ${facts.daily.reason}`;
    const voice = joinSentences([
      facts.hasProject
        ? `New Type Tech Coder is currently reviewing ${facts.projectName}.`
        : "New Type Tech Coder is open, but no project folder is selected yet.",
      facts.hasSummary
        ? "A project summary is available."
        : "A project summary is still missing.",
      `Safety backup status: ${facts.backupLabel}.`,
      `The safest next step is: ${facts.daily.title}.`,
    ]);
    return { briefing, warnings, evidence, nextAction, voice };
  }

  if (role === "safety-officer") {
    const warnings = [
      "Live Qwen execution is disabled.",
      "Edit mode is unavailable.",
      "Do not restore a Safety Backup unless you understand the warning and have another backup.",
      "External reviews and Builder Results are text advice only — never executed.",
      "Do not add arbitrary terminal access or custom command typing.",
    ];
    if (facts.checkFailed) {
      warnings.push(`Build/Test Check needs attention: ${facts.checkStatus}.`);
    }
    if (facts.builder?.hasRiskySuggestions) {
      warnings.push(
        `Builder Result risky phrases: ${facts.builder.riskyPhrases.join(", ")}.`,
      );
    }
    if (facts.builder?.hasMismatchWarnings) {
      warnings.push(
        `Builder Result mismatch warnings: ${facts.builder.mismatchWarnings.join("; ")}.`,
      );
    }
    const riskyReviews = input.externalReview.reviews.filter(
      (r) => r.hasRiskySuggestions,
    );
    if (riskyReviews.length > 0) {
      warnings.push(
        `${riskyReviews.length} external review(s) contain risky phrases.`,
      );
    }
    if (facts.backlogCriticalSafety > 0) {
      warnings.push(
        `${facts.backlogCriticalSafety} open Critical Safety backlog concern(s).`,
      );
    }
    if (!facts.backupRestorable) {
      warnings.push(
        input.checkpointAvailability.hasPreviousRecord
          ? "A previous backup record exists but is not verified for restore."
          : "No verified Safety Backup is available yet.",
      );
    }

    const briefing = [
      "Safety Officer briefing: New Type Tech Coder remains inspect-only.",
      `Current backup status: ${facts.backupLabel}.`,
      `Recommended caution step: ${facts.daily.title}.`,
    ];
    const evidence = [
      `Writes allowed: No (inspect-only)`,
      `Live Qwen: disabled`,
      `Edit mode: unavailable`,
      `Safety Backup: ${facts.backupLabel}`,
      `Restore verified: ${yesNo(facts.backupRestorable)}`,
      `Build/Test Check: ${facts.checkStatus}`,
      `Critical Safety backlog open: ${facts.backlogCriticalSafety}`,
      `Builder Result risk warnings: ${
        facts.builder?.hasRiskySuggestions ? "Yes" : "No"
      }`,
      `External reviews with risky phrases: ${
        facts.comparison?.reviewsWithRiskyPhrases ?? riskyReviews.length
      }`,
    ];
    const nextAction = facts.backupRestorable
      ? `${facts.daily.title}. Keep restore manual and confirmed.`
      : "Create or verify a Safety Backup before risky review or testing work.";
    const voice = joinSentences([
      "Safety Officer update.",
      "New Type Tech Coder does not edit files, does not run live Qwen, and does not offer edit mode.",
      `Backup status: ${facts.backupLabel}.`,
      facts.backlogCriticalSafety > 0
        ? "There are open Critical Safety backlog concerns that need review."
        : "No open Critical Safety backlog concerns were counted.",
      `What not to do next: do not bypass Safety Gate, do not treat pasted AI text as commands, and do not restore without understanding the warning.`,
      `Safest next action: ${facts.daily.title}.`,
    ]);
    return { briefing, warnings, evidence, nextAction, voice };
  }

  if (role === "review-narrator") {
    const comparison = facts.comparison;
    const briefing = [
      facts.externalCount === 0
        ? "No external reviews have been saved yet."
        : `${facts.externalCount} external review(s) are saved for this project session.`,
      comparison?.plainEnglish ??
        "Comparison summary is unavailable until reviews are saved.",
    ];
    const warnings = [
      "External reviews are pasted advice only and are never executed by the app.",
      ...(comparison?.disagreementDetected
        ? ["Disagreement flags suggest a human decision is needed."]
        : []),
      ...(comparison?.needsHumanDecision
        ? ["Comparison marks this as needing a human decision."]
        : []),
      ...missing,
    ];
    const selected = input.externalReview.selected;
    const selectedExcerpt = selected
      ? truncate(selected.reviewText, MAX_REVIEW_EXCERPT)
      : null;
    const evidence = [
      `External reviews saved: ${facts.externalCount}`,
      `Sources represented: ${
        comparison?.sourcesRepresented?.join(", ") ||
        (facts.externalCount
          ? input.externalReview.reviews.map((r) => r.source).join(", ")
          : "none")
      }`,
      `Common concern keywords: ${
        comparison?.commonConcernKeywords?.length
          ? comparison.commonConcernKeywords.join(", ")
          : "none detected"
      }`,
      `Disagreement detected: ${yesNo(Boolean(comparison?.disagreementDetected))}`,
      `Reviews with risky phrases: ${
        comparison?.reviewsWithRiskyPhrases ?? 0
      }`,
      `Approve / revise / revert mentions: ${yesNo(
        Boolean(comparison?.appearsToMentionApprove),
      )} / ${yesNo(Boolean(comparison?.appearsToMentionRevise))} / ${yesNo(
        Boolean(comparison?.appearsToMentionRevert),
      )}`,
      selectedExcerpt
        ? `Selected review excerpt (${selected!.source}): ${selectedExcerpt.text}`
        : "Selected review excerpt: none",
    ];
    const nextAction =
      facts.externalCount > 0 && !facts.hasDecision
        ? "Generate a Decision Report from the saved external reviews."
        : `${facts.daily.title}. ${facts.daily.reason}`;
    const voice = joinSentences([
      "Review Narrator update.",
      facts.externalCount === 0
        ? "There are no pasted external reviews yet."
        : `There are ${facts.externalCount} external reviews on file.`,
      comparison?.commonConcernKeywords?.length
        ? `Common concerns include: ${comparison.commonConcernKeywords
            .slice(0, 6)
            .join(", ")}.`
        : "No strong common-concern keywords were detected yet.",
      comparison?.disagreementDetected
        ? "The reviews appear to disagree, so a human decision is important."
        : "No clear disagreement flag was raised.",
      `Recommended next action: ${nextAction}`,
    ]);
    return { briefing, warnings, evidence, nextAction, voice };
  }

  if (role === "builder-liaison") {
    const briefing = [
      facts.hasDecision
        ? `Decision Report recommendation: ${facts.decisionLabel}.`
        : "No Decision Report exists yet.",
      facts.hasBuilderPrompt
        ? "A plan-only Builder Prompt is ready to copy into an outside builder."
        : "No Builder Prompt has been generated yet.",
      facts.hasBuilderResult
        ? "A Builder Result was pasted back as text only."
        : "No Builder Result has been pasted back yet.",
    ];
    const warnings = [
      "Builder work stays outside New Type Tech Coder.",
      "Builder Prompts are plan-only by default — do not ask the builder to rewrite unrelated files.",
      "Pasted Builder Results are never executed by this app.",
      ...(facts.builder?.hasRiskySuggestions
        ? [
            `Builder Result has risky suggestions: ${facts.builder.riskyPhrases.join(
              ", ",
            )}.`,
          ]
        : []),
      ...(facts.builder?.hasMismatchWarnings
        ? [
            `Builder Result mismatch warnings: ${facts.builder.mismatchWarnings.join(
              "; ",
            )}.`,
          ]
        : []),
      ...missing,
    ];
    const evidence = [
      `Decision Report: ${yesNo(facts.hasDecision)}${
        facts.decisionLabel ? ` — ${facts.decisionLabel}` : ""
      }`,
      facts.decisionDetail ? `Decision detail: ${facts.decisionDetail}` : "",
      `Builder Prompt: ${yesNo(facts.hasBuilderPrompt)} (plan-only)`,
      `Builder Result: ${
        facts.hasBuilderResult
          ? `${facts.builder?.source} / ${facts.builder?.responseType}`
          : "none"
      }`,
      `Daily Next Action: ${facts.daily.title}`,
      facts.userGoal ? `Typed goal: ${facts.userGoal}` : "Typed goal: none",
    ].filter(Boolean);
    let askNext = facts.daily.title;
    if (!facts.hasDecision) {
      askNext =
        "Generate a Decision Report first, then create a plan-only Builder Prompt.";
    } else if (!facts.hasBuilderPrompt) {
      askNext =
        "Generate a plan-only Builder Prompt, then paste it into Cursor, Codex, Grok, or Claude.";
    } else if (!facts.hasBuilderResult) {
      askNext =
        "Paste the Builder Prompt into your outside builder, then paste the Builder Result back here as text only.";
    } else if (
      facts.builder?.hasRiskySuggestions ||
      facts.builder?.hasMismatchWarnings
    ) {
      askNext =
        "Review Builder Result warnings before asking the builder for another plan.";
    }
    const nextAction = askNext;
    const voice = joinSentences([
      "Builder Liaison update.",
      facts.hasDecision
        ? `The Decision Report currently points to: ${facts.decisionLabel}.`
        : "There is no Decision Report yet.",
      facts.hasBuilderPrompt
        ? "A plan-only Builder Prompt is available to copy."
        : "You still need a plan-only Builder Prompt.",
      "Reminder: New Type Tech Coder does not implement the change — your outside builder does.",
      `What to do next: ${askNext}`,
    ]);
    return { briefing, warnings, evidence, nextAction, voice };
  }

  // release-announcer
  const briefing = [
    `New Type Tech Coder version ${input.appVersion}.`,
    "This is an inspect-only local workbench for summaries, review packs, safety backups, and plan-only builder prompts.",
    facts.hasProject
      ? `Current project context: ${facts.projectName}.`
      : "No project is selected in this session.",
  ];
  const warnings = [
    "Live Qwen remains disabled.",
    "Edit mode is unavailable.",
    "No arbitrary terminal or custom command typing.",
    "Speaker Scripts are text-only — no automatic audio in this stage.",
    ...missing,
  ];
  const evidence = [
    `App version: ${input.appVersion}`,
    `Mode: Inspect-only`,
    `Packaged daily use: Open New Type Tech Coder.bat / release installer`,
    `Safety Backup: ${facts.backupLabel}`,
    `Build/Test Check: ${facts.checkStatus}`,
    `Major features available: Project Summary, Review Report, Patch Review Pack, Decision Report, Builder Prompt, External Reviews, Builder Result import, Backlog, Daily Next Action, Speaker Scripts (text-only)`,
    `Known limitations: no AI file edits, no live Qwen, no direct AI file access, no arbitrary terminal`,
  ];
  const nextAction = `${facts.daily.title}. ${facts.daily.reason}`;
  const voice = joinSentences([
    `Release note style update for New Type Tech Coder ${input.appVersion}.`,
    "The app remains inspect-only.",
    "You can summarize projects, create review packs, verify safety backups, run allowlisted build checks, and prepare plan-only prompts for outside builders.",
    "Live Qwen and edit mode stay off.",
    `Current recommended next action: ${facts.daily.title}.`,
  ]);
  return { briefing, warnings, evidence, nextAction, voice };
}

/**
 * Rule/template-based Speaker Script generator.
 * No AI calls, no audio, no file access, no commands.
 */
export function buildSpeakerScript(
  input: SpeakerScriptBuilderInput,
): SpeakerScriptRecord {
  const generatedAt = new Date().toISOString();
  const facts = buildCommonFacts(input);
  const raw = contentForRole(input.role, input, facts);
  const toned = applyTone(input.tone, raw);

  const roleLabel = ROLE_LABELS[input.role];
  const toneLabel = TONE_LABELS[input.tone];
  const limitedContext = !input.project || !input.summary;

  const lines: string[] = [
    "# New Type Tech Coder - Speaker Script",
    "",
    `- **Speaker role:** ${roleLabel}`,
    `- **Tone:** ${toneLabel}`,
    `- **Generated:** ${generatedAt}`,
    `- **Limited context:** ${yesNo(limitedContext)}`,
    "",
    "## Short briefing",
    "",
    ...toned.briefing.map((b) => `- ${b}`),
    "",
    "## Important warnings",
    "",
    ...(toned.warnings.length
      ? toned.warnings.map((w) => `- ${w}`)
      : ["- None noted."]),
    "",
    "## What changed / what evidence exists",
    "",
    ...toned.evidence.map((e) => `- ${e}`),
    "",
    "## Recommended next action",
    "",
    toned.nextAction,
    "",
    "## Voice-friendly script",
    "",
    truncate(toned.voice, MAX_VOICE_CHARS).text,
    "",
    "## App note",
    "",
    "This Speaker Script is text-only. New Type Tech Coder does not play audio, edit project files, run commands, enable live Qwen, or enable edit mode.",
    "",
  ];

  let markdown = lines.join("\n");
  let truncated = false;
  if (markdown.length > MAX_SCRIPT_CHARS) {
    markdown = `${markdown.slice(0, MAX_SCRIPT_CHARS - 1)}…`;
    truncated = true;
  }

  const previewExcerpt = truncate(markdown, MAX_EXCERPT_CHARS).text;
  const voiceFriendlyScript = truncate(toned.voice, MAX_VOICE_CHARS).text;

  return {
    id: `speaker-${Date.now().toString(36)}`,
    generatedAt,
    role: input.role,
    roleLabel,
    tone: input.tone,
    toneLabel,
    projectName: input.project?.displayName ?? null,
    projectPath: input.project?.normalizedPath ?? null,
    limitedContext,
    markdownReport: markdown,
    previewExcerpt,
    voiceFriendlyScript,
    truncated,
    secretSafetyNote:
      "Speaker Scripts use safe local metadata only. They do not include raw source code, full diffs, .env contents, secrets, keys, or certificates. No audio is generated.",
  };
}

export const SPEAKER_SCRIPT_ROLES: SpeakerScriptRole[] = [
  "project-foreman",
  "safety-officer",
  "review-narrator",
  "builder-liaison",
  "release-announcer",
];

export const SPEAKER_SCRIPT_TONES: SpeakerScriptTone[] = [
  "plain",
  "brief",
  "detailed",
  "youtube-style",
  "safety-focused",
];

export { ROLE_LABELS as SPEAKER_ROLE_LABELS, TONE_LABELS as SPEAKER_TONE_LABELS };
