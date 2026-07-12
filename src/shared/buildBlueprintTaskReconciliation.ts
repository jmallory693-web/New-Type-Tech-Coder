/**
 * Stage 92: rule-based Blueprint Task Reconciliation report builder.
 * Uses stored planning artifacts only — no AI, no source reads.
 */

import type { PlanningStyleId } from "./planningStyle";
import { isSmallModelFriendlyPlanning } from "./planningStyle";
import {
  MONOLITH_FILE_PATTERNS,
  SAFETY_HEADER_CONCEPTS,
  SMALL_MODEL_CONCEPTS,
  TASK_RECONCILIATION_REPORT_TITLE,
  type MissingProducerSeverity,
  type TaskReconciliationRecommendation,
} from "./taskReconciliationConstants";
import {
  extractContractItems,
  itemHasProducer,
  itemsLikelyDuplicate,
  isVagueContractItem,
  normalizeContractItem,
} from "./taskReconciliationNormalize";
import { fingerprintMatchesCard } from "./computeTaskCardFingerprint";
import { checkChangedFilesScopeDrift } from "./checkChangedFilesScopeDrift";
import type {
  BlueprintCompletenessReport,
  BlueprintPhaseTaskCard,
  BlueprintPhaseTaskCardsRecord,
  BuilderResultRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
  TaskCardBuilderHandoffRecord,
  TaskImplementationReportRecord,
} from "./types";
import { TASK_CARD_STATUS_LABELS } from "./blueprintTaskCardConstants";

export interface ReconciliationFlag {
  category: string;
  message: string;
  taskId?: string;
  severity?: MissingProducerSeverity | "info" | "warning";
}

export interface BlueprintTaskReconciliationInput {
  taskCards: BlueprintPhaseTaskCardsRecord;
  taskCardHandoff: TaskCardBuilderHandoffRecord | null;
  implementationReports: Record<string, TaskImplementationReportRecord>;
  builderResult?: BuilderResultRecord | null;
  changedFilesScan?: ChangedFilesScanResult | null;
  changedFilesTaskLink?: ChangedFilesTaskLinkRecord | null;
  completeness: BlueprintCompletenessReport | null;
  planningStyle: PlanningStyleId;
  sourceTaskCardsGeneratedAt: string | null;
}

export interface BlueprintTaskReconciliationResult {
  generatedAt: string;
  taskCardCount: number;
  contractFieldsMissing: boolean;
  missingProducerCount: number;
  duplicateOverlapCount: number;
  monolithRiskCount: number;
  statusInconsistencyCount: number;
  implementationInconsistencyCount: number;
  safetyGapCount: number;
  smallModelGapCount: number;
  recommendation: TaskReconciliationRecommendation;
  flags: ReconciliationFlag[];
  markdown: string;
}

function hasContractFields(card: BlueprintPhaseTaskCard): boolean {
  return Boolean(
    card.producesCreates?.trim() &&
      card.consumesDependsOn?.trim() &&
      card.interfacesContracts?.trim(),
  );
}

function classifyMissingProducer(
  item: string,
  cardIndex: number,
  totalCards: number,
): MissingProducerSeverity {
  if (isVagueContractItem(item)) return "Low";
  if (cardIndex === 0) return "High";
  if (cardIndex <= 1 && totalCards > 3) return "High";
  if (/data\s+model|app\s+shell|storage|save|load|types?|core/i.test(item)) {
    return "Medium";
  }
  return cardIndex < Math.ceil(totalCards / 2) ? "Medium" : "Low";
}

function checkSafetyHeaders(card: BlueprintPhaseTaskCard): string[] {
  const combined = [
    card.safetyBoundaries,
    card.builderPrompt,
    card.reportBackFormat,
    card.whatNotToBuildYet,
  ].join("\n");
  const missing: string[] = [];
  for (const concept of SAFETY_HEADER_CONCEPTS) {
    if (!concept.pattern.test(combined)) {
      missing.push(concept.label);
    }
  }
  return missing;
}

function checkSmallModelFriendly(
  card: BlueprintPhaseTaskCard,
  planningStyle: PlanningStyleId,
): string[] {
  if (!isSmallModelFriendlyPlanning(planningStyle)) return [];
  const combined = [card.smallModelGuidance, card.likelyFilesModules, card.whatToBuild].join(
    "\n",
  );
  const missing: string[] = [];
  for (const concept of SMALL_MODEL_CONCEPTS) {
    if (!concept.pattern.test(combined)) {
      missing.push(concept.label);
    }
  }
  const likely = card.likelyFilesModules.toLowerCase();
  const onlyMonolith =
    (likely.includes("app.tsx") || likely.includes("main/index")) &&
    !likely.includes("components") &&
    !likely.includes("modules") &&
    !likely.includes("shared") &&
    !likely.includes("manager");
  if (onlyMonolith) {
    missing.push("likely files target only App.tsx/main without modules");
  }
  return missing;
}

function checkMonolithRisk(card: BlueprintPhaseTaskCard): string[] {
  const risks: string[] = [];
  const likely = card.likelyFilesModules;
  const hits = MONOLITH_FILE_PATTERNS.filter((p) => p.test(likely));
  if (hits.length > 0) {
    const hasSplit =
      /components?|modules?|shared\/|manager|helpers?/i.test(likely);
    if (!hasSplit) {
      risks.push(
        `Likely files/modules mention ${hits.map((p) => p.source).join(", ")} without split module guidance.`,
      );
    }
  }
  if (/only\s+App\.tsx|only\s+main\/index/i.test(likely)) {
    risks.push("Card scopes work to App.tsx or main/index.ts only.");
  }
  return risks;
}

function deriveRecommendation(flags: ReconciliationFlag[]): TaskReconciliationRecommendation {
  const missingHigh = flags.filter(
    (f) =>
      f.category === "missing-producer" &&
      (f.severity === "High" || f.severity === "Blocked"),
  ).length;
  const missingBlocked = flags.filter(
    (f) => f.category === "missing-producer" && f.severity === "Blocked",
  ).length;
  const statusIssues = flags.filter((f) => f.category === "status-consistency").length;
  const implIssues = flags.filter((f) => f.category === "implementation-consistency").length;
  const tooBroad = flags.filter((f) => f.category === "deck-quality" && /too broad/i.test(f.message)).length;

  if (missingBlocked >= 1 || missingHigh >= 3) return "Blocked";
  if (statusIssues >= 2 || implIssues >= 2) return "Review implementation status";
  if (flags.some((f) => f.category === "missing-producer" && f.severity !== "Low")) {
    return "Resolve missing producers";
  }
  if (tooBroad >= 2) return "Split broad cards";
  if (flags.length > 0) return "Needs clarification";
  return "Deck ready";
}

function buildRecommendedFixes(flags: ReconciliationFlag[]): string[] {
  const fixes: string[] = [];
  if (flags.some((f) => f.category === "contract-fields")) {
    fixes.push("Regenerate task cards to include Produces/Consumes/Interfaces contract fields.");
  }
  if (flags.some((f) => f.category === "missing-producer")) {
    fixes.push("Add producer cards earlier in the deck or narrow consumer dependencies.");
  }
  if (flags.some((f) => f.category === "duplicate-overlap")) {
    fixes.push("Merge or narrow overlapping cards to reduce duplicate work.");
  }
  if (flags.some((f) => f.category === "status-consistency")) {
    fixes.push("Align task statuses with handoffs and implementation reports.");
  }
  if (flags.some((f) => f.category === "implementation-consistency")) {
    fixes.push("Review implementation reports before marking tasks Reviewed.");
  }
  if (flags.some((f) => f.category === "monolith-risk")) {
    fixes.push("Split likely files into components/modules/managers instead of App.tsx/main only.");
  }
  if (flags.some((f) => f.category === "safety-header")) {
    fixes.push("Ensure each card includes full safety boundary and report-back requirements.");
  }
  if (fixes.length === 0) {
    fixes.push("Deck looks coherent — proceed with Task Builder Handoff for the active task.");
  }
  return fixes;
}

export function buildBlueprintTaskReconciliation(
  input: BlueprintTaskReconciliationInput,
): BlueprintTaskReconciliationResult {
  const flags: ReconciliationFlag[] = [];
  const cards = input.taskCards.cards;
  const generatedAt = new Date().toISOString();

  const contractFieldsMissing = cards.some((c) => !hasContractFields(c));
  if (contractFieldsMissing) {
    flags.push({
      category: "contract-fields",
      message:
        "Task cards are missing contract fields. Reconciliation can still check safety/status, but producer/consumer checks are limited.",
      severity: "warning",
    });
  }

  const producedByTask: Array<{ taskId: string; items: string[] }> = [];
  const allProduced: string[] = [];
  const producedItemsList: string[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const items = extractContractItems(card.producesCreates);
    producedByTask.push({ taskId: card.id, items });
    for (const item of items) {
      allProduced.push(item);
      producedItemsList.push(`- **${card.id}:** ${item}`);
    }
  }

  const consumedItemsList: string[] = [];
  const missingProducers: string[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const consumed = extractContractItems(card.consumesDependsOn);
    const earlierItems = cards
      .slice(0, i)
      .flatMap((c) => extractContractItems(c.producesCreates));

    for (const item of consumed) {
      consumedItemsList.push(`- **${card.id}:** ${item}`);
      if (!itemHasProducer(item, earlierItems)) {
        const severity = classifyMissingProducer(item, i, cards.length);
        const line = `**${card.id}** consumes "${item}" — no earlier producer found. (${severity})`;
        missingProducers.push(`- ${line}`);
        flags.push({
          category: "missing-producer",
          message: `Consumed item has no earlier producer: ${card.id} → ${item}`,
          taskId: card.id,
          severity,
        });
      }
    }
  }

  const duplicateOverlaps: string[] = [];
  for (let i = 0; i < allProduced.length; i++) {
    for (let j = i + 1; j < allProduced.length; j++) {
      if (itemsLikelyDuplicate(allProduced[i], allProduced[j])) {
        const line = `- Possible overlap: "${allProduced[i]}" and "${allProduced[j]}"`;
        if (!duplicateOverlaps.includes(line)) {
          duplicateOverlaps.push(line);
          flags.push({
            category: "duplicate-overlap",
            message: `Duplicate/overlapping work: ${allProduced[i]} / ${allProduced[j]}`,
            severity: "info",
          });
        }
      }
    }
  }

  const contractDrift: string[] = [];
  const handoffTaskId = input.taskCardHandoff?.selectedTaskId ?? null;
  if (input.taskCardHandoff && !input.taskCardHandoff.stale && handoffTaskId) {
    for (const [reportTaskId, report] of Object.entries(input.implementationReports)) {
      if (report.stale) continue;
      if (reportTaskId !== handoffTaskId) {
        contractDrift.push(
          `- Handoff targets **${handoffTaskId}** but implementation report saved for **${reportTaskId}**.`,
        );
        flags.push({
          category: "contract-drift",
          message: `Handoff/report task mismatch: handoff ${handoffTaskId}, report ${reportTaskId}`,
          severity: "warning",
        });
      }
    }
  }

  for (const card of cards) {
    const report = input.implementationReports[card.id];
    if (!report || report.stale) continue;
    const likelyTokens = extractContractItems(card.likelyFilesModules).map(normalizeContractItem);
    const detected = report.detectedFilesChanged.map((f) => normalizeContractItem(f));
    if (detected.length > 0 && likelyTokens.length > 0) {
      const overlap = detected.some((d) =>
        likelyTokens.some((l) => d.includes(l) || l.includes(d) || d.split("/").pop() === l.split("/").pop()),
      );
      if (!overlap) {
        contractDrift.push(
          `- **${card.id}:** implementation report files do not clearly match likely files/modules.`,
        );
        flags.push({
          category: "contract-drift",
          message: `${card.id}: implementation files drift from likely modules`,
          taskId: card.id,
          severity: "warning",
        });
      }
    }
  }

  for (const card of cards) {
    const report = input.implementationReports[card.id];
    if (!report || report.stale) continue;
    if (
      report.sourceTaskCardHash &&
      !fingerprintMatchesCard(card, report.sourceTaskCardHash)
    ) {
      contractDrift.push(
        `- **${card.id}:** implementation report fingerprint does not match current task card.`,
      );
      flags.push({
        category: "contract-drift",
        message: `${card.id}: implementation report task fingerprint mismatch`,
        taskId: card.id,
        severity: "warning",
      });
    }
    if (card.status === "reviewed" && report.stale) {
      contractDrift.push(
        `- **${card.id}:** task marked Reviewed but implementation report is stale.`,
      );
      flags.push({
        category: "contract-drift",
        message: `${card.id}: reviewed with stale implementation report`,
        taskId: card.id,
        severity: "warning",
      });
    }
  }

  if (input.taskCardHandoff && !input.taskCardHandoff.stale) {
    const handoffCard = cards.find((c) => c.id === input.taskCardHandoff?.selectedTaskId);
    if (
      handoffCard &&
      input.taskCardHandoff.sourceTaskCardHash &&
      !fingerprintMatchesCard(handoffCard, input.taskCardHandoff.sourceTaskCardHash)
    ) {
      contractDrift.push(
        `- Handoff fingerprint does not match current task card for **${handoffCard.id}**.`,
      );
      flags.push({
        category: "contract-drift",
        message: `Handoff fingerprint mismatch for ${handoffCard.id}`,
        taskId: handoffCard.id,
        severity: "warning",
      });
    }
  }

  const staged = input.builderResult;
  if (staged?.responseType === "Implementation report" && !staged.taskId) {
    contractDrift.push("- Staged Builder Result has no task ID join key.");
    flags.push({
      category: "contract-drift",
      message: "Builder result staged without task ID",
      severity: "warning",
    });
  }

  const changedFilesLinkLines: string[] = [];
  const scan = input.changedFilesScan;
  const cfLink = input.changedFilesTaskLink;
  if (scan?.scannedAt && scan.totalCount > 0 && !cfLink) {
    changedFilesLinkLines.push(
      "- Changed-files metadata exists but no Blueprint task link is stored.",
    );
    flags.push({
      category: "changed-files-link",
      message: "Changed-files metadata not linked to a task ID",
      severity: "warning",
    });
  }
  if (cfLink) {
    const linkCard = cards.find((c) => c.id === cfLink.taskId);
    if (!linkCard) {
      changedFilesLinkLines.push(
        `- Changed-files link references missing task **${cfLink.taskId}**.`,
      );
      flags.push({
        category: "changed-files-link",
        message: `Changed-files link references missing task ${cfLink.taskId}`,
        taskId: cfLink.taskId,
        severity: "warning",
      });
    } else {
      if (
        cfLink.sourceTaskCardHash &&
        !fingerprintMatchesCard(linkCard, cfLink.sourceTaskCardHash)
      ) {
        changedFilesLinkLines.push(
          `- Changed-files link fingerprint does not match current task card for **${cfLink.taskId}**.`,
        );
        flags.push({
          category: "changed-files-link",
          message: `Changed-files link stale fingerprint for ${cfLink.taskId}`,
          taskId: cfLink.taskId,
          severity: "warning",
        });
      }
      const paths = cfLink.changedFilePaths ?? [];
      const scopeWarnings = checkChangedFilesScopeDrift(linkCard, paths);
      for (const w of scopeWarnings) {
        changedFilesLinkLines.push(`- **${cfLink.taskId}:** ${w}`);
      }
      if (scopeWarnings.length > 0) {
        flags.push({
          category: "changed-files-link",
          message: `${cfLink.taskId} changed-files scope warnings (${scopeWarnings.length})`,
          taskId: cfLink.taskId,
          severity: "warning",
        });
      }
      if (linkCard.status === "reviewed" && (cfLink.warnings?.length ?? scopeWarnings.length) > 0) {
        changedFilesLinkLines.push(
          `- **${cfLink.taskId}:** Reviewed but changed-files link has scope warnings.`,
        );
        flags.push({
          category: "changed-files-link",
          message: `${cfLink.taskId} reviewed with changed-files scope warnings`,
          taskId: cfLink.taskId,
          severity: "warning",
        });
      }
    }
    if (cfLink.stale) {
      changedFilesLinkLines.push(`- Changed-files link for **${cfLink.taskId}** is marked stale.`);
      flags.push({
        category: "changed-files-link",
        message: `Changed-files link stale for ${cfLink.taskId}`,
        taskId: cfLink.taskId,
        severity: "warning",
      });
    }
  }

  const safetyGaps: string[] = [];
  for (const card of cards) {
    const missing = checkSafetyHeaders(card);
    if (missing.length > 0) {
      safetyGaps.push(`- **${card.id}:** missing safety concepts: ${missing.join(", ")}`);
      flags.push({
        category: "safety-header",
        message: `${card.id} missing safety headers: ${missing.join(", ")}`,
        taskId: card.id,
        severity: "warning",
      });
    }
  }

  const smallModelGaps: string[] = [];
  if (isSmallModelFriendlyPlanning(input.planningStyle)) {
    for (const card of cards) {
      const missing = checkSmallModelFriendly(card, input.planningStyle);
      if (missing.length > 0) {
        smallModelGaps.push(`- **${card.id}:** ${missing.join("; ")}`);
        flags.push({
          category: "small-model",
          message: `${card.id} small-model gaps: ${missing.join(", ")}`,
          taskId: card.id,
          severity: "warning",
        });
      }
    }
  }

  const monolithRisks: string[] = [];
  for (const card of cards) {
    const risks = checkMonolithRisk(card);
    for (const r of risks) {
      monolithRisks.push(`- **${card.id}:** ${r}`);
      flags.push({
        category: "monolith-risk",
        message: `${card.id}: ${r}`,
        taskId: card.id,
        severity: "warning",
      });
    }
  }

  const statusLines: string[] = [];
  for (const card of cards) {
    const report = input.implementationReports[card.id];
    const hasReport = Boolean(report && !report.stale);

    if (card.status === "reviewed" && !hasReport) {
      statusLines.push(`- **${card.id}:** Reviewed but no implementation report stored.`);
      flags.push({
        category: "status-consistency",
        message: `${card.id} reviewed without implementation report`,
        taskId: card.id,
        severity: "warning",
      });
    }
    if (card.status === "implementation-returned" && !hasReport) {
      statusLines.push(`- **${card.id}:** Implementation Returned but no report stored.`);
      flags.push({
        category: "status-consistency",
        message: `${card.id} implementation-returned without report`,
        taskId: card.id,
        severity: "warning",
      });
    }
    if (card.status === "sent-to-builder" && (!input.taskCardHandoff || input.taskCardHandoff.stale)) {
      statusLines.push(`- **${card.id}:** Sent to builder but no active task handoff.`);
      flags.push({
        category: "status-consistency",
        message: `${card.id} sent-to-builder without handoff`,
        taskId: card.id,
        severity: "warning",
      });
    }
    if (
      input.taskCardHandoff &&
      !input.taskCardHandoff.stale &&
      input.taskCardHandoff.selectedTaskId === card.id &&
      card.status === "drafted"
    ) {
      statusLines.push(`- **${card.id}:** Handoff exists but task still Drafted.`);
      flags.push({
        category: "status-consistency",
        message: `${card.id} handoff exists while still drafted`,
        taskId: card.id,
        severity: "info",
      });
    }
    if (
      hasReport &&
      card.status !== "implementation-returned" &&
      card.status !== "reviewed"
    ) {
      statusLines.push(
        `- **${card.id}:** Implementation report exists but status is ${TASK_CARD_STATUS_LABELS[card.status]}.`,
      );
      flags.push({
        category: "status-consistency",
        message: `${card.id} has report but status not returned/reviewed`,
        taskId: card.id,
        severity: "info",
      });
    }
    if (card.quality === "too-broad") {
      flags.push({
        category: "deck-quality",
        message: `${card.id} marked too broad`,
        taskId: card.id,
        severity: "warning",
      });
    }
  }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.status !== "skipped") continue;
    const later = cards.slice(i + 1);
    const deps = extractContractItems(card.consumesDependsOn);
    for (const laterCard of later) {
      const laterConsumes = extractContractItems(laterCard.consumesDependsOn);
      for (const dep of deps) {
        if (laterConsumes.some((c) => itemsLikelyDuplicate(c, dep))) {
          statusLines.push(
            `- **${laterCard.id}** may depend on skipped task **${card.id}**.`,
          );
          flags.push({
            category: "status-consistency",
            message: `Skipped ${card.id} may block ${laterCard.id}`,
            severity: "warning",
          });
        }
      }
    }
  }

  const implConsistency: string[] = [];
  for (const card of cards) {
    const report = input.implementationReports[card.id];
    if (!report || report.stale) continue;

    if (card.status === "reviewed") {
      if (report.detectedRisksBlockers.length > 0) {
        implConsistency.push(`- **${card.id}:** Reviewed but report mentions risks/blockers.`);
        flags.push({
          category: "implementation-consistency",
          message: `${card.id} reviewed with risks in report`,
          taskId: card.id,
          severity: "warning",
        });
      }
      if (report.missingExpectedSections.includes("Validation performed")) {
        implConsistency.push(`- **${card.id}:** Reviewed but validation missing in report.`);
        flags.push({
          category: "implementation-consistency",
          message: `${card.id} reviewed without validation in report`,
          taskId: card.id,
          severity: "warning",
        });
      }
      if (report.detectedSafetyConfirmations.length === 0) {
        implConsistency.push(`- **${card.id}:** Reviewed but no safety confirmations detected.`);
        flags.push({
          category: "implementation-consistency",
          message: `${card.id} reviewed without safety confirmations`,
          taskId: card.id,
          severity: "info",
        });
      }
      if (report.savedWithSecretOverride) {
        implConsistency.push(`- **${card.id}:** Reviewed after secret override on report.`);
        flags.push({
          category: "implementation-consistency",
          message: `${card.id} reviewed with secret override`,
          taskId: card.id,
          severity: "warning",
        });
      }
    }
  }

  const taskSequence = cards.map(
    (c) =>
      `- **${c.id}** — ${c.title} (${TASK_CARD_STATUS_LABELS[c.status]}, quality: ${c.quality})`,
  );

  const recommendation = deriveRecommendation(flags);
  const recommendedFixes = buildRecommendedFixes(flags);

  const completenessNote = input.completeness
    ? `Blueprint completeness: ${input.completeness.readiness}`
    : "Blueprint completeness: not checked";

  const lines = [
    TASK_RECONCILIATION_REPORT_TITLE,
    "",
    "## Deck Summary",
    "",
    `- Task cards: ${cards.length}`,
    `- Planning style: ${input.planningStyle}`,
    `- ${completenessNote}`,
    `- Contract fields on all cards: ${contractFieldsMissing ? "no (limited checks)" : "yes"}`,
    `- Flags: ${flags.length}`,
    "",
    "## Task Sequence",
    "",
    ...(taskSequence.length ? taskSequence : ["- No tasks."]),
    "",
    "## Produced Items",
    "",
    ...(producedItemsList.length ? producedItemsList : ["- None listed."]),
    "",
    "## Consumed Items",
    "",
    ...(consumedItemsList.length ? consumedItemsList : ["- None listed."]),
    "",
    "## Missing Producers",
    "",
    ...(missingProducers.length
      ? missingProducers
      : ["- No missing producers detected by deterministic rules."]),
    "",
    "## Duplicate / Overlapping Work",
    "",
    ...(duplicateOverlaps.length ? duplicateOverlaps : ["- None flagged."]),
    "",
    "## Contract Drift",
    "",
    ...(contractDrift.length ? contractDrift : ["- None detected."]),
    "",
    "## Safety Header Consistency",
    "",
    ...(safetyGaps.length ? safetyGaps : ["- All checked cards include core safety concepts."]),
    "",
    "## Small-Model Friendly Consistency",
    "",
    isSmallModelFriendlyPlanning(input.planningStyle)
      ? smallModelGaps.length
        ? smallModelGaps
        : ["- Small-model friendly guidance looks consistent."]
      : ["- Planning style is not Small-model friendly — checks skipped."],
    "",
    "## Monolith Risk",
    "",
    ...(monolithRisks.length ? monolithRisks : ["- No App.tsx/main-only monolith risk flagged."]),
    "",
    "## Status Consistency",
    "",
    ...(statusLines.length ? statusLines : ["- No status inconsistencies detected."]),
    "",
    "## Implementation Intake Consistency",
    "",
    ...(implConsistency.length ? implConsistency : ["- No implementation intake inconsistencies detected."]),
    "",
    "## Changed Files Link Consistency",
    "",
    ...(changedFilesLinkLines.length
      ? changedFilesLinkLines
      : ["- No changed-files link inconsistencies detected."]),
    "",
    "## Recommended Fixes",
    "",
    ...recommendedFixes.map((f) => `- ${f}`),
    "",
    "## Recommendation",
    "",
    recommendation,
    "",
    "## Safety Reminder",
    "",
    "This reconciliation uses stored task cards, handoffs, and implementation report text only. It does not call AI, read project source files, or modify files.",
    "",
    `_Generated at ${generatedAt}._`,
  ];

  return {
    generatedAt,
    taskCardCount: cards.length,
    contractFieldsMissing,
    missingProducerCount: flags.filter((f) => f.category === "missing-producer").length,
    duplicateOverlapCount: flags.filter((f) => f.category === "duplicate-overlap").length,
    monolithRiskCount: flags.filter((f) => f.category === "monolith-risk").length,
    statusInconsistencyCount: flags.filter((f) => f.category === "status-consistency").length,
    implementationInconsistencyCount: flags.filter(
      (f) => f.category === "implementation-consistency",
    ).length,
    safetyGapCount: flags.filter((f) => f.category === "safety-header").length,
    smallModelGapCount: flags.filter((f) => f.category === "small-model").length,
    recommendation,
    flags,
    markdown: lines.join("\n"),
  };
}

export function buildTaskReconciliationPlanningNote(input: {
  recommendation: TaskReconciliationRecommendation;
  generatedAt: string;
  taskCardCount: number;
  missingProducerCount: number;
  statusInconsistencyCount: number;
  stale: boolean;
}): string {
  if (input.stale) {
    return "## Task reconciliation (stale)\n\nPrevious reconciliation report is stale — regenerate after task card changes.";
  }
  return [
    "## Task reconciliation (summary)",
    "",
    `- Generated: ${input.generatedAt}`,
    `- Task cards: ${input.taskCardCount}`,
    `- Recommendation: **${input.recommendation}**`,
    `- Missing producers flagged: ${input.missingProducerCount}`,
    `- Status inconsistencies: ${input.statusInconsistencyCount}`,
  ].join("\n");
}
