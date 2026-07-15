/**
 * Stage 133: Local Planner Response Import manager (in-memory / history only).
 * Paste → parse → safety review. No AI. No FS writes. No source reads.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveLocalPlannerResponseUiStatus,
  emptyLocalPlannerResponseImportState,
  emptyLocalPlannerResponseImportTombstone,
  normalizeLocalPlannerResponseImportRecord,
  type LocalPlannerResponseImportRecord,
  type LocalPlannerResponseImportState,
} from "../../shared/buildModeLocalPlannerResponseImport";
import {
  analyzeLocalPlannerResponse,
  evaluateLocalPlannerResponseImportPreconditions,
} from "../../shared/parseLocalPlannerResponse";
import type {
  LocalPlannerBuildBriefMode,
  LocalPlannerStrictness,
  LocalPlannerTargetModelType,
} from "../../shared/buildModeLocalPlannerBuildBrief";

export type LocalPlannerResponseImportAnalyzeContext = {
  briefExists: boolean;
  briefStale: boolean;
  sourceBriefGeneratedAt: string | null;
  sourceBriefMode: LocalPlannerBuildBriefMode | null;
  sourceBriefStrictness: LocalPlannerStrictness | null;
  sourceBriefTargetLocalModelType: LocalPlannerTargetModelType | null;
  sourceSelectedTaskId: string | null;
  sourceSelectedTaskTitle: string | null;
};

export class LocalPlannerResponseImportManager {
  private saved: LocalPlannerResponseImportRecord | null = null;
  private draftText = "";
  private busy = false;
  private statusMessage: string | null =
    emptyLocalPlannerResponseImportState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): LocalPlannerResponseImportRecord | null {
    return this.saved
      ? {
          ...this.saved,
          parsed: { ...this.saved.parsed },
          safetyWarnings: this.saved.safetyWarnings.map((w) => ({ ...w })),
        }
      : emptyLocalPlannerResponseImportTombstone();
  }

  getState(
    ctx?: LocalPlannerResponseImportAnalyzeContext | null,
  ): LocalPlannerResponseImportState {
    const readiness = ctx
      ? evaluateLocalPlannerResponseImportPreconditions({
          briefExists: ctx.briefExists,
          briefStale: ctx.briefStale,
        })
      : {
          canAnalyze: false,
          reasons: this.lastReadinessBlockedReasons,
        };

    if (ctx) {
      this.lastReadinessBlockedReasons = readiness.reasons;
    }

    const canAnalyze =
      readiness.canAnalyze &&
      !this.busy &&
      this.draftText.trim().length > 0;

    const canAccept = Boolean(
      this.saved &&
        !this.saved.stale &&
        (this.saved.status === "Good" || this.saved.status === "Caution") &&
        !this.busy,
    );

    return {
      saved: this.saved
        ? {
            ...this.saved,
            parsed: { ...this.saved.parsed },
            safetyWarnings: this.saved.safetyWarnings.map((w) => ({ ...w })),
          }
        : null,
      draftText: this.draftText,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveLocalPlannerResponseUiStatus({
        saved: this.saved,
        busy: this.busy,
        canAnalyze: readiness.canAnalyze,
      }),
      readinessBlockedReasons: readiness.reasons,
      canAnalyze,
      canAccept,
    };
  }

  restoreSaved(
    record: LocalPlannerResponseImportRecord | null | undefined,
  ): void {
    const normalized = normalizeLocalPlannerResponseImportRecord(record);
    if (!normalized) {
      this.clearInternal(
        "No Local Planner Response Import restored from history.",
      );
      return;
    }
    this.saved = {
      ...normalized,
      stale: true,
      acceptedForCoderPromptPrep: false,
      acceptedAt: null,
    };
    this.draftText = normalized.rawResponseText;
    this.busy = false;
    this.statusMessage =
      "Restored Local Planner Response Import (marked stale — re-analyze before accepting).";
    this.safetyGate.log(
      "info",
      "Local Planner Response Import restored",
      `${normalized.status} · ${normalized.decision}`,
    );
  }

  clearForProjectChange(): void {
    this.clearInternal(
      "Local Planner Response Import cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) {
      if (this.saved?.acceptedForCoderPromptPrep) {
        this.saved = {
          ...this.saved,
          acceptedForCoderPromptPrep: false,
          acceptedAt: null,
        };
      }
      return;
    }
    this.saved = {
      ...this.saved,
      stale: true,
      acceptedForCoderPromptPrep: false,
      acceptedAt: null,
    };
    this.statusMessage =
      "Local Planner Response Import is stale — re-analyze after Blueprint, brief, task, or scaffold changes.";
    this.safetyGate.log("info", "Local Planner Response Import stale", reason);
  }

  setDraftText(text: unknown): void {
    this.draftText = typeof text === "string" ? text.slice(0, 200_000) : "";
  }

  clear(): void {
    this.clearInternal("Local Planner Response Import cleared.");
    this.safetyGate.log(
      "info",
      "Local Planner Response Import cleared",
      "User cleared the response (history tombstone; no files deleted).",
    );
  }

  analyze(
    ctx: LocalPlannerResponseImportAnalyzeContext,
  ): LocalPlannerResponseImportState {
    const readiness = evaluateLocalPlannerResponseImportPreconditions({
      briefExists: ctx.briefExists,
      briefStale: ctx.briefStale,
    });
    this.lastReadinessBlockedReasons = readiness.reasons;

    if (!readiness.canAnalyze) {
      this.statusMessage = `Cannot analyze planner response: ${readiness.reasons.join(" ")}`;
      this.safetyGate.log(
        "warning",
        "Local Planner Response Import blocked",
        readiness.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage = "Analyzing Local Planner Response (deterministic parse — no AI)…";
    try {
      const result = analyzeLocalPlannerResponse({
        rawResponseText: this.draftText,
        sourceBriefGeneratedAt: ctx.sourceBriefGeneratedAt,
        sourceBriefMode: ctx.sourceBriefMode,
        sourceBriefStrictness: ctx.sourceBriefStrictness,
        sourceBriefTargetLocalModelType: ctx.sourceBriefTargetLocalModelType,
        sourceSelectedTaskId: ctx.sourceSelectedTaskId,
        sourceSelectedTaskTitle: ctx.sourceSelectedTaskTitle,
        briefExists: ctx.briefExists,
        briefStale: ctx.briefStale,
      });

      if (!result.record || result.blockedReasons.length > 0) {
        this.statusMessage = `Local Planner Response Import blocked: ${result.blockedReasons.join(" ")}`;
        this.lastReadinessBlockedReasons = result.blockedReasons;
        this.safetyGate.log(
          "warning",
          "Local Planner Response Import analysis failed",
          result.blockedReasons.join(" | "),
        );
        return this.getState(ctx);
      }

      this.saved = result.record;
      this.draftText = result.record.rawResponseText;
      this.statusMessage = `Planner response analyzed: ${result.record.status}. Untrusted claim review only — no AI call, no writes, no commands.`;
      this.safetyGate.log(
        "success",
        "Local Planner Response Import analyzed",
        `${result.record.status} · ${result.record.decision}`,
      );
    } finally {
      this.busy = false;
    }
    return this.getState(ctx);
  }

  markAcceptedForCoderPromptPrep(
    ctx?: LocalPlannerResponseImportAnalyzeContext | null,
  ): LocalPlannerResponseImportState {
    if (
      !this.saved ||
      this.saved.stale ||
      this.saved.status === "Blocked"
    ) {
      this.statusMessage =
        "Cannot mark accepted: response must be analyzed as Good or Caution (not Blocked/stale).";
      this.safetyGate.log(
        "warning",
        "Mark Local Planner Response accepted blocked",
        this.saved?.status ?? "no saved response",
      );
      return this.getState(ctx);
    }

    const acceptedAt = new Date().toISOString();
    this.saved = {
      ...this.saved,
      acceptedForCoderPromptPrep: true,
      acceptedAt,
    };
    this.statusMessage =
      "Accepted for coder prompt prep (metadata only). This stage does not generate a coder prompt.";
    this.safetyGate.log(
      "info",
      "Local Planner Response accepted for coder prompt prep",
      "Metadata only — no coder prompt generated.",
    );
    return this.getState(ctx);
  }

  recordCopySummary(): void {
    if (!this.saved?.summaryMarkdown) {
      this.safetyGate.log(
        "warning",
        "Copy Local Planner Response Summary blocked",
        "No summary to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Local Planner Response Summary copied",
      `${this.saved.status} · clipboard only`,
    );
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.draftText = "";
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}
