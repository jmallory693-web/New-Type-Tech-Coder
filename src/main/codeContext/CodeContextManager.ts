import type {
  CodeContextBlockedEntry,
  CodeContextFileCandidate,
  CodeContextPack,
  CodeContextState,
  CodeQuestionTemplateSelection,
} from "../../shared/types";
import {
  DEFAULT_CODE_CONTEXT_MAX_LINES_PER_FILE,
  DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS,
} from "../../shared/codeContextConstants";
import {
  getCodeQuestionTemplate,
  isCodeQuestionTemplateId,
} from "../../shared/codeQuestionTemplates";
import type { SafetyGate } from "../safety/SafetyGate";
import { buildCodeContextPack, type BuildCodeContextPackInput } from "./buildCodeContextPack";
import {
  listSafeCodeContextFiles,
  readCodeContextExcerpt,
} from "./codeContextSafety";

export class CodeContextManager {
  private candidates: Array<{
    relativePath: string;
    extension: string;
    sizeBytes: number;
  }> = [];
  private selectedPaths = new Set<string>();
  private blockedSamples: CodeContextBlockedEntry[] = [];
  private blockedCount = 0;
  private listingTruncated = false;
  private filterQuery = "";
  private codeQuestion = "";
  private selectedTemplate: CodeQuestionTemplateSelection | null = null;
  private maxLinesPerFile = DEFAULT_CODE_CONTEXT_MAX_LINES_PER_FILE;
  private maxTotalChars = DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS;
  private preview: CodeContextPack | null = null;
  private busy = false;
  private statusMessage: string | null =
    "Select a project, refresh the safe file list, choose files, then generate a preview. Nothing is sent to AI in this stage.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): CodeContextState {
    return {
      candidates: this.candidates.map((c) => ({
        ...c,
        selected: this.selectedPaths.has(c.relativePath),
      })),
      filterQuery: this.filterQuery,
      codeQuestion: this.codeQuestion,
      selectedTemplate: this.selectedTemplate,
      maxLinesPerFile: this.maxLinesPerFile,
      maxTotalChars: this.maxTotalChars,
      selectedCount: this.selectedPaths.size,
      blockedCount: this.blockedCount,
      blockedSamples: this.blockedSamples,
      listingTruncated: this.listingTruncated,
      preview: this.preview,
      busy: this.busy,
      statusMessage: this.statusMessage,
    };
  }

  getPreview(): CodeContextPack | null {
    return this.preview;
  }

  getSelectedPaths(): string[] {
    return [...this.selectedPaths];
  }

  setFilterQuery(query: unknown): void {
    this.filterQuery = typeof query === "string" ? query : "";
  }

  getSelectedTemplate(): CodeQuestionTemplateSelection | null {
    return this.selectedTemplate;
  }

  setCodeQuestion(question: unknown): void {
    this.codeQuestion = typeof question === "string" ? question.slice(0, 4000) : "";
  }

  applyQuestionTemplate(
    templateId: unknown,
    mode: unknown,
  ): void {
    if (!isCodeQuestionTemplateId(templateId)) {
      this.safetyGate.log(
        "warning",
        "Code question template blocked",
        "Unknown template id.",
      );
      return;
    }
    const template = getCodeQuestionTemplate(templateId);
    const existing = this.codeQuestion.trim();
    const replace = mode === "replace";
    const append = mode === "append" || (!replace && existing.length > 0);
    const nextQuestion = append
      ? existing
        ? `${this.codeQuestion.trimEnd()}\n\n---\n\n${template.question}`
        : template.question
      : template.question;
    this.codeQuestion = nextQuestion.slice(0, 4000);
    this.selectedTemplate = {
      templateId: template.id,
      templateLabel: template.label,
      questionText: template.question,
      selectedAt: new Date().toISOString(),
    };
    this.safetyGate.log(
      "info",
      append && existing
        ? "Code question template appended"
        : replace
          ? "Code question template replaced"
          : "Code question template selected",
      template.label,
    );
  }

  clearCodeQuestion(): void {
    this.codeQuestion = "";
    this.safetyGate.log("info", "Code question cleared", "Code question field cleared.");
  }

  setMaxLinesPerFile(value: unknown): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this.maxLinesPerFile = Math.min(500, Math.max(20, Math.floor(n)));
    this.safetyGate.log(
      "info",
      "Code context max lines changed",
      String(this.maxLinesPerFile),
    );
  }

  setMaxTotalChars(value: unknown): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this.maxTotalChars = Math.min(80_000, Math.max(5_000, Math.floor(n)));
    this.safetyGate.log(
      "info",
      "Code context max total chars changed",
      String(this.maxTotalChars),
    );
  }

  setFileSelected(relativePath: unknown, selected: unknown): void {
    if (typeof relativePath !== "string") return;
    const exists = this.candidates.some((c) => c.relativePath === relativePath);
    if (!exists) {
      this.safetyGate.log(
        "warning",
        "Code context selection blocked",
        `Unknown file: ${relativePath}`,
      );
      return;
    }
    if (selected === true) {
      this.selectedPaths.add(relativePath);
      this.safetyGate.log("info", "Code context file selected", relativePath);
    } else {
      this.selectedPaths.delete(relativePath);
      this.safetyGate.log("info", "Code context file deselected", relativePath);
    }
  }

  clearSelection(): void {
    this.selectedPaths.clear();
    this.safetyGate.log("info", "Code context selection cleared", "All files deselected.");
  }

  refreshFileList(): void {
    const project = this.safetyGate.getProject();
    if (!project) {
      this.candidates = [];
      this.blockedSamples = [];
      this.blockedCount = 0;
      this.statusMessage = "Select a project folder before refreshing the safe file list.";
      this.safetyGate.log(
        "warning",
        "Code context file list refresh failed",
        "No project selected.",
      );
      return;
    }

    this.busy = true;
    try {
      const result = listSafeCodeContextFiles(this.safetyGate, project.normalizedPath);
      this.candidates = result.candidates;
      this.blockedSamples = result.blocked;
      this.blockedCount = result.blockedCount;
      this.listingTruncated = result.truncatedListing;
      const valid = new Set(this.candidates.map((c) => c.relativePath));
      for (const p of [...this.selectedPaths]) {
        if (!valid.has(p)) this.selectedPaths.delete(p);
      }
      this.statusMessage = `Safe file list refreshed: ${result.listedCount} candidates, ${result.blockedCount} blocked/skipped.${
        result.truncatedListing ? " Listing capped at safe limit." : ""
      }`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refresh failed";
      this.statusMessage = message;
      this.safetyGate.log(
        "warning",
        "Code context file list refresh failed",
        message,
      );
    } finally {
      this.busy = false;
    }
  }

  generatePreview(input: {
    summary: BuildCodeContextPackInput["summary"];
    decisionReport: BuildCodeContextPackInput["decisionReport"];
    builderPlanExcerpt: string | null;
    implementationReview: BuildCodeContextPackInput["implementationReview"];
    projectMemoryLastSaved: BuildCodeContextPackInput["projectMemoryLastSaved"];
    fallbackQuestion: string;
  }): CodeContextPack {
    const project = this.safetyGate.getProject();
    const truncationFlags: string[] = [];
    const includedFiles: BuildCodeContextPackInput["includedFiles"] = [];
    const blockedAtPreview: CodeContextBlockedEntry[] = [...this.blockedSamples];

    const question =
      this.codeQuestion.trim() || input.fallbackQuestion.trim() || "";

    if (!project) {
      this.preview = buildCodeContextPack({
        userQuestion: question,
        project: null,
        summary: input.summary,
        decisionReport: input.decisionReport,
        builderPlanExcerpt: input.builderPlanExcerpt,
        implementationReview: input.implementationReview,
        projectMemoryLastSaved: input.projectMemoryLastSaved,
        includedFiles: [],
        blockedFiles: blockedAtPreview,
        selectedCount: this.selectedPaths.size,
        blockedCount: this.blockedCount,
        maxTotalChars: this.maxTotalChars,
        truncationFlags: ["No project selected"],
      });
      this.statusMessage = "Select a project before generating a Code Context Pack preview.";
      return this.preview;
    }

    const selected = [...this.selectedPaths];
    if (selected.length === 0) {
      this.preview = buildCodeContextPack({
        userQuestion: question,
        project,
        summary: input.summary,
        decisionReport: input.decisionReport,
        builderPlanExcerpt: input.builderPlanExcerpt,
        implementationReview: input.implementationReview,
        projectMemoryLastSaved: input.projectMemoryLastSaved,
        includedFiles: [],
        blockedFiles: blockedAtPreview,
        selectedCount: 0,
        blockedCount: this.blockedCount,
        maxTotalChars: this.maxTotalChars,
        truncationFlags: ["No files selected"],
      });
      this.statusMessage =
        "No files selected. Choose safe files from the list, then generate preview again.";
      this.safetyGate.log(
        "info",
        "Code context preview generated",
        "No files selected.",
      );
      return this.preview;
    }

    this.busy = true;
    try {
      for (const relativePath of selected) {
        const read = readCodeContextExcerpt(
          this.safetyGate,
          project.normalizedPath,
          relativePath,
          this.maxLinesPerFile,
        );
        if (!read.ok) {
          blockedAtPreview.push({
            relativePath,
            reason: read.blockReason ?? "Blocked at preview read",
          });
          this.safetyGate.log(
            "blocked",
            "Code context file blocked",
            `${relativePath}: ${read.blockReason}`,
          );
          continue;
        }
        includedFiles.push({
          relativePath,
          linesIncluded: read.linesIncluded,
          truncated: read.truncated,
          warnings: read.warnings,
          content: read.content,
        });
      }

      if (this.listingTruncated) {
        truncationFlags.push("Safe file listing was capped.");
      }

      this.preview = buildCodeContextPack({
        userQuestion: question,
        project,
        summary: input.summary,
        decisionReport: input.decisionReport,
        builderPlanExcerpt: input.builderPlanExcerpt,
        implementationReview: input.implementationReview,
        projectMemoryLastSaved: input.projectMemoryLastSaved,
        includedFiles,
        blockedFiles: blockedAtPreview,
        selectedCount: selected.length,
        blockedCount: this.blockedCount + (selected.length - includedFiles.length),
        maxTotalChars: this.maxTotalChars,
        truncationFlags,
      });

      if (this.preview.truncated) {
        this.safetyGate.log(
          "warning",
          "Code context pack truncated",
          this.preview.truncationFlags.join("; "),
        );
      }

      this.statusMessage = `Code Context Pack preview generated (${this.preview.includedFileCount} included, ${this.preview.blockedFileCount} blocked). Preview/copy only — no AI call.`;
      this.safetyGate.log(
        "success",
        "Code context preview generated",
        `${this.preview.includedFileCount} files; ${this.preview.estimatedCharacters} chars.`,
      );
      return this.preview;
    } finally {
      this.busy = false;
    }
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
  }

  setStatus(statusMessage: string): void {
    this.statusMessage = statusMessage;
  }

  recordCopy(): void {
    if (!this.preview) {
      this.safetyGate.log(
        "warning",
        "Code context copy blocked",
        "Generate a Code Context Pack preview first.",
      );
      return;
    }
    this.safetyGate.log("success", "Code context preview copied", "Copy recorded from UI.");
  }

  restoreFromHistory(state: {
    selectedPaths?: string[];
    codeQuestion?: string;
    selectedTemplate?: CodeQuestionTemplateSelection | null;
    maxLinesPerFile?: number;
    maxTotalChars?: number;
    preview?: CodeContextPack | null;
  }): void {
    if (state.codeQuestion) this.codeQuestion = state.codeQuestion;
    if (state.selectedTemplate) this.selectedTemplate = state.selectedTemplate;
    if (typeof state.maxLinesPerFile === "number") {
      this.maxLinesPerFile = state.maxLinesPerFile;
    }
    if (typeof state.maxTotalChars === "number") {
      this.maxTotalChars = state.maxTotalChars;
    }
    if (Array.isArray(state.selectedPaths)) {
      this.selectedPaths = new Set(state.selectedPaths);
    }
    if (state.preview) {
      this.preview = state.preview;
      this.statusMessage = `Previous Code Context Pack preview restored (${state.preview.generatedAt}).`;
    }
  }

  clearForProjectChange(): void {
    this.candidates = [];
    this.selectedPaths.clear();
    this.blockedSamples = [];
    this.blockedCount = 0;
    this.listingTruncated = false;
    this.filterQuery = "";
    this.codeQuestion = "";
    this.selectedTemplate = null;
    this.preview = null;
    this.busy = false;
    this.statusMessage =
      "Select a project, refresh the safe file list, choose files, then generate a preview. Nothing is sent to AI in this stage.";
  }
}