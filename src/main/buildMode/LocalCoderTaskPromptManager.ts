/**
 * Stage 135: Local Coder Task Prompt manager (in-memory / history only).
 * Copy/paste prompt generation. No AI. No FS writes. No source reads.
 */

import type { SafetyGate } from "../safety/SafetyGate";
import {
  deriveLocalCoderTaskPromptUiStatus,
  emptyLocalCoderTaskPromptOptions,
  emptyLocalCoderTaskPromptState,
  emptyLocalCoderTaskPromptTombstone,
  normalizeLocalCoderPromptStyle,
  normalizeLocalCoderTaskPromptRecord,
  type LocalCoderPromptStyle,
  type LocalCoderTaskPromptOptions,
  type LocalCoderTaskPromptRecord,
  type LocalCoderTaskPromptState,
} from "../../shared/buildModeLocalCoderTaskPrompt";
import {
  buildLocalCoderTaskPrompt,
  evaluateLocalCoderTaskPromptPreconditions,
} from "../../shared/buildLocalCoderTaskPrompt";
import type { LocalPlannerResponseStatus } from "../../shared/buildModeLocalPlannerResponseImport";

export type LocalCoderTaskPromptGenerateContext = {
  plannerResponseExists: boolean;
  plannerResponseStale: boolean;
  plannerResponseStatus: LocalPlannerResponseStatus | null;
  acceptedForCoderPromptPrep: boolean;
  plannerResponseAcceptedAt: string | null;
  plannerResponseAnalyzedAt: string | null;
  recommendedNextTask: string | null;
  whyThisTask: string | null;
  likelyFiles: string[];
  filesNotToTouch: string[];
  risks: string[];
  acceptanceChecks: string[];
  coderPromptOutline: string | null;
  stopConditions: string[];
  blueprintProjectType: string;
  targetFolderPath: string | null;
  targetSafetyStatus: string | null;
  scaffoldWriteWrittenAt: string | null;
  scaffoldCreatedRelativePaths: string[];
  fileTreeGeneratedAt: string | null;
  fileTreeProposedPaths: string[];
  selectedTaskTitle: string | null;
};

export class LocalCoderTaskPromptManager {
  private saved: LocalCoderTaskPromptRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    emptyLocalCoderTaskPromptState().statusMessage;
  private lastReadinessBlockedReasons: string[] = [];
  private options: LocalCoderTaskPromptOptions =
    emptyLocalCoderTaskPromptOptions();

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): LocalCoderTaskPromptRecord | null {
    return this.saved
      ? {
          ...this.saved,
          likelyFiles: [...this.saved.likelyFiles],
          filesNotToTouch: [...this.saved.filesNotToTouch],
          sourceScaffoldCreatedRelativePaths: [
            ...this.saved.sourceScaffoldCreatedRelativePaths,
          ],
          sourceFileTreeProposedPaths: [
            ...this.saved.sourceFileTreeProposedPaths,
          ],
          warnings: [...this.saved.warnings],
        }
      : emptyLocalCoderTaskPromptTombstone();
  }

  getOptions(): LocalCoderTaskPromptOptions {
    return { ...this.options };
  }

  setOptions(partial: Partial<LocalCoderTaskPromptOptions>): void {
    if (partial.promptStyle !== undefined) {
      const next = normalizeLocalCoderPromptStyle(partial.promptStyle);
      if (next !== this.options.promptStyle && this.saved && !this.saved.stale) {
        this.markStale("Coder prompt style changed.");
      }
      this.options.promptStyle = next;
    }
  }

  getState(
    ctx?: LocalCoderTaskPromptGenerateContext | null,
  ): LocalCoderTaskPromptState {
    const readiness = ctx
      ? evaluateLocalCoderTaskPromptPreconditions({
          plannerResponseExists: ctx.plannerResponseExists,
          plannerResponseStale: ctx.plannerResponseStale,
          plannerResponseStatus: ctx.plannerResponseStatus,
          acceptedForCoderPromptPrep: ctx.acceptedForCoderPromptPrep,
          recommendedNextTask: ctx.recommendedNextTask,
          likelyFilesCount: ctx.likelyFiles.length,
          scaffoldFilesCount:
            ctx.scaffoldCreatedRelativePaths.length +
            ctx.fileTreeProposedPaths.length,
        })
      : {
          canGenerate: false,
          reasons: this.lastReadinessBlockedReasons,
        };

    if (ctx) {
      this.lastReadinessBlockedReasons = readiness.reasons;
    }

    return {
      saved: this.saved
        ? {
            ...this.saved,
            likelyFiles: [...this.saved.likelyFiles],
            filesNotToTouch: [...this.saved.filesNotToTouch],
            sourceScaffoldCreatedRelativePaths: [
              ...this.saved.sourceScaffoldCreatedRelativePaths,
            ],
            sourceFileTreeProposedPaths: [
              ...this.saved.sourceFileTreeProposedPaths,
            ],
            warnings: [...this.saved.warnings],
          }
        : null,
      busy: this.busy,
      statusMessage: this.statusMessage,
      uiStatus: deriveLocalCoderTaskPromptUiStatus({
        saved: this.saved,
        busy: this.busy,
        canGenerate: readiness.canGenerate,
      }),
      readinessBlockedReasons: readiness.reasons,
      canGenerate: readiness.canGenerate && !this.busy,
      options: { ...this.options },
    };
  }

  restoreSaved(
    record: LocalCoderTaskPromptRecord | null | undefined,
  ): void {
    const normalized = normalizeLocalCoderTaskPromptRecord(record);
    if (!normalized) {
      this.clearInternal(
        "No Local Coder Task Prompt restored from history.",
      );
      return;
    }
    this.saved = { ...normalized, stale: true };
    this.options = { promptStyle: normalized.promptStyle };
    this.busy = false;
    this.statusMessage =
      "Restored Local Coder Task Prompt (marked stale — regenerate before trusting).";
    this.safetyGate.log(
      "info",
      "Local Coder Task Prompt restored",
      `${normalized.promptStyle}`,
    );
  }

  clearForProjectChange(): void {
    this.options = emptyLocalCoderTaskPromptOptions();
    this.clearInternal(
      "Local Coder Task Prompt cleared because the project folder changed.",
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Local Coder Task Prompt is stale — regenerate after planner response, accepted marker, brief, task-card, or scaffold changes.";
    this.safetyGate.log("info", "Local Coder Task Prompt stale", reason);
  }

  clear(): void {
    this.clearInternal("Local Coder Task Prompt cleared.");
    this.safetyGate.log(
      "info",
      "Local Coder Task Prompt cleared",
      "User cleared the coder prompt (history tombstone; no files deleted).",
    );
  }

  generate(
    ctx: LocalCoderTaskPromptGenerateContext,
    optionsOverride?: Partial<LocalCoderTaskPromptOptions>,
  ): LocalCoderTaskPromptState {
    if (optionsOverride) {
      this.setOptions(optionsOverride);
    }

    const readiness = evaluateLocalCoderTaskPromptPreconditions({
      plannerResponseExists: ctx.plannerResponseExists,
      plannerResponseStale: ctx.plannerResponseStale,
      plannerResponseStatus: ctx.plannerResponseStatus,
      acceptedForCoderPromptPrep: ctx.acceptedForCoderPromptPrep,
      recommendedNextTask: ctx.recommendedNextTask,
      likelyFilesCount: ctx.likelyFiles.length,
      scaffoldFilesCount:
        ctx.scaffoldCreatedRelativePaths.length +
        ctx.fileTreeProposedPaths.length,
    });
    this.lastReadinessBlockedReasons = readiness.reasons;

    if (!readiness.canGenerate) {
      this.statusMessage = `Cannot generate Local Coder Task Prompt: ${readiness.reasons.join("; ")}`;
      this.safetyGate.log(
        "warning",
        "Local Coder Task Prompt blocked",
        readiness.reasons.join(" | "),
      );
      return this.getState(ctx);
    }

    this.busy = true;
    this.statusMessage = "Generating Local Coder Task Prompt…";
    try {
      const built = buildLocalCoderTaskPrompt({
        promptStyle: this.options.promptStyle,
        plannerResponseStatus: ctx.plannerResponseStatus as
          | "Good"
          | "Caution",
        plannerResponseAcceptedAt: ctx.plannerResponseAcceptedAt,
        plannerResponseAnalyzedAt: ctx.plannerResponseAnalyzedAt,
        recommendedNextTask: ctx.recommendedNextTask!.trim(),
        whyThisTask: ctx.whyThisTask,
        likelyFiles: ctx.likelyFiles,
        filesNotToTouch: ctx.filesNotToTouch,
        risks: ctx.risks,
        acceptanceChecks: ctx.acceptanceChecks,
        coderPromptOutline: ctx.coderPromptOutline,
        stopConditions: ctx.stopConditions,
        blueprintProjectType: ctx.blueprintProjectType,
        targetFolderPath: ctx.targetFolderPath,
        targetSafetyStatus: ctx.targetSafetyStatus,
        scaffoldWriteWrittenAt: ctx.scaffoldWriteWrittenAt,
        scaffoldCreatedRelativePaths: ctx.scaffoldCreatedRelativePaths,
        fileTreeGeneratedAt: ctx.fileTreeGeneratedAt,
        fileTreeProposedPaths: ctx.fileTreeProposedPaths,
        selectedTaskTitle: ctx.selectedTaskTitle,
      });

      if (!built.record || built.blockedReasons.length > 0) {
        this.statusMessage = `Local Coder Task Prompt blocked: ${built.blockedReasons.join("; ")}`;
        this.lastReadinessBlockedReasons = built.blockedReasons;
        this.safetyGate.log(
          "warning",
          "Local Coder Task Prompt generation failed",
          built.blockedReasons.join(" | "),
        );
        return this.getState(ctx);
      }

      this.saved = built.record;
      this.statusMessage = `Local Coder Task Prompt generated (${LOCAL_CODER_STYLE_LABEL(built.record.promptStyle)}). Copy/paste only — NTTC did not call a model.`;
      this.safetyGate.log(
        "success",
        "Local Coder Task Prompt generated",
        built.record.promptStyle,
      );
    } finally {
      this.busy = false;
    }
    return this.getState(ctx);
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Copy Local Coder Task Prompt blocked",
        "No prompt to copy.",
      );
      return;
    }
    this.safetyGate.log(
      "info",
      "Local Coder Task Prompt copied",
      `${this.saved.promptStyle} · clipboard only`,
    );
  }

  private clearInternal(statusMessage: string): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage = statusMessage;
    this.lastReadinessBlockedReasons = [];
  }
}

function LOCAL_CODER_STYLE_LABEL(style: LocalCoderPromptStyle): string {
  if (style === "small-local-coder") return "Small local coder";
  if (style === "strict-patch-planning-coder")
    return "Strict patch-planning coder";
  return "General coder";
}

export type { LocalCoderPromptStyle };
