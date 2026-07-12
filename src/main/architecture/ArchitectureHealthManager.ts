import { buildArchitectureHealthReport } from "../../shared/architectureHealth/buildArchitectureHealthReport";
import {
  ARCHITECTURE_HEALTH_PREVIEW_MAX,
  type ArchitectureHealthRecommendation,
} from "../../shared/architectureHealth/architectureHealthConstants";
import type {
  ArchitectureHealthRecord,
  ArchitectureHealthState,
  BlueprintPhaseTaskCardsRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkRecord,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";
import {
  scanArchitectureHealthFiles,
  type ScanArchitectureHealthOptions,
} from "./scanArchitectureHealthFiles";

function normalizeRecord(raw: ArchitectureHealthRecord): ArchitectureHealthRecord {
  return {
    id: raw.id,
    generatedAt: raw.generatedAt,
    sourceProjectSummaryScannedAt: raw.sourceProjectSummaryScannedAt ?? null,
    sourceChangedFilesScannedAt: raw.sourceChangedFilesScannedAt ?? null,
    sourceTaskCardsGeneratedAt: raw.sourceTaskCardsGeneratedAt ?? null,
    includeTestFiles: Boolean(raw.includeTestFiles),
    includeMarkdownDocs: raw.includeMarkdownDocs !== false,
    fileCountScanned: raw.fileCountScanned ?? 0,
    filesTruncated: Boolean(raw.filesTruncated),
    blockedCount: raw.blockedCount ?? 0,
    largestFilePath: raw.largestFilePath ?? null,
    largestFileLineCount: raw.largestFileLineCount ?? 0,
    criticalCount: raw.criticalCount ?? 0,
    warningCount: raw.warningCount ?? 0,
    recommendation: raw.recommendation ?? "Watch large files",
    stale: Boolean(raw.stale),
    markdown: raw.markdown ?? "",
    previewExcerpt: raw.previewExcerpt ?? "",
    refactorSuggestions: raw.refactorSuggestions ?? [],
  };
}

/** Stage 98: Architecture Health manager (metadata only; no AI). */
export class ArchitectureHealthManager {
  private saved: ArchitectureHealthRecord | null = null;
  private includeTestFiles = false;
  private includeMarkdownDocs = true;
  private busy = false;
  private statusMessage: string | null =
    "Generate an Architecture Health Report to flag oversized files and monolith risk (metadata only).";

  constructor(private readonly safetyGate: SafetyGate) {}

  getSaved(): ArchitectureHealthRecord | null {
    return this.saved ? { ...this.saved } : null;
  }

  getState(): ArchitectureHealthState {
    return {
      saved: this.saved ? { ...this.saved } : null,
      includeTestFiles: this.includeTestFiles,
      includeMarkdownDocs: this.includeMarkdownDocs,
      busy: this.busy,
      statusMessage: this.statusMessage,
    };
  }

  setIncludeTestFiles(include: boolean): void {
    this.includeTestFiles = include;
    this.statusMessage = include
      ? "Architecture scan will include test files."
      : "Architecture scan will exclude test files.";
    this.safetyGate.log(
      "info",
      "Architecture health scan option",
      `includeTestFiles=${include}`,
    );
  }

  setIncludeMarkdownDocs(include: boolean): void {
    this.includeMarkdownDocs = include;
    this.statusMessage = include
      ? "Architecture scan will include markdown/docs."
      : "Architecture scan will exclude markdown/docs.";
    this.safetyGate.log(
      "info",
      "Architecture health scan option",
      `includeMarkdownDocs=${include}`,
    );
  }

  markStale(reason: string): void {
    if (!this.saved || this.saved.stale) return;
    this.saved = { ...this.saved, stale: true };
    this.statusMessage =
      "Architecture Health Report is stale — regenerate after project scan or changed-files updates.";
    this.safetyGate.log("info", "Architecture health stale", reason);
  }

  syncWithSources(input: {
    projectSummaryScannedAt: string | null;
    changedFilesScannedAt: string | null;
    taskCardsGeneratedAt: string | null;
  }): void {
    if (!this.saved || this.saved.stale) return;

    const stale =
      (this.saved.sourceProjectSummaryScannedAt &&
        input.projectSummaryScannedAt &&
        this.saved.sourceProjectSummaryScannedAt !==
          input.projectSummaryScannedAt) ||
      (this.saved.sourceChangedFilesScannedAt &&
        input.changedFilesScannedAt &&
        this.saved.sourceChangedFilesScannedAt !== input.changedFilesScannedAt) ||
      (this.saved.sourceTaskCardsGeneratedAt &&
        input.taskCardsGeneratedAt &&
        this.saved.sourceTaskCardsGeneratedAt !== input.taskCardsGeneratedAt);

    if (stale) {
      this.markStale("Project scan or task metadata changed.");
    }
  }

  generate(input: {
    projectName: string | null;
    projectSummaryScannedAt: string | null;
    changedFilesScan: ChangedFilesScanResult | null;
    changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
    taskCards: BlueprintPhaseTaskCardsRecord | null;
  }): ArchitectureHealthRecord | null {
    const project = this.safetyGate.getProject();
    if (!project) {
      this.statusMessage = "Select a project folder first.";
      this.safetyGate.log(
        "warning",
        "Architecture health blocked",
        "No project.",
      );
      return null;
    }

    this.busy = true;
    const options: ScanArchitectureHealthOptions = {
      includeTestFiles: this.includeTestFiles,
      includeMarkdownDocs: this.includeMarkdownDocs,
    };

    try {
      const scan = scanArchitectureHealthFiles(
        this.safetyGate,
        project.normalizedPath,
        options,
      );

      const generatedAt = new Date().toISOString();
      const report = buildArchitectureHealthReport({
        generatedAt,
        projectName: input.projectName,
        files: scan.files,
        scanMeta: {
          fileCountScanned: scan.fileCountScanned,
          filesTruncated: scan.filesTruncated,
          blockedCount: scan.blockedCount,
          includeTestFiles: options.includeTestFiles,
          includeMarkdownDocs: options.includeMarkdownDocs,
        },
        taskCards: input.taskCards,
        changedFilesScan: input.changedFilesScan,
        changedFilesTaskLink: input.changedFilesTaskLink,
      });

      const record: ArchitectureHealthRecord = {
        id: `architecture-health-${Date.now().toString(36)}`,
        generatedAt: report.generatedAt,
        sourceProjectSummaryScannedAt: input.projectSummaryScannedAt,
        sourceChangedFilesScannedAt: input.changedFilesScan?.scannedAt ?? null,
        sourceTaskCardsGeneratedAt: input.taskCards?.generatedAt ?? null,
        includeTestFiles: options.includeTestFiles,
        includeMarkdownDocs: options.includeMarkdownDocs,
        fileCountScanned: report.fileCountScanned,
        filesTruncated: scan.filesTruncated,
        blockedCount: scan.blockedCount,
        largestFilePath: report.largestFilePath,
        largestFileLineCount: report.largestFileLineCount,
        criticalCount: report.criticalCount,
        warningCount: report.warningCount,
        recommendation: report.recommendation,
        stale: false,
        markdown: report.markdown,
        previewExcerpt:
          report.markdown.length > ARCHITECTURE_HEALTH_PREVIEW_MAX
            ? `${report.markdown.slice(0, ARCHITECTURE_HEALTH_PREVIEW_MAX - 1)}…`
            : report.markdown,
        refactorSuggestions: report.refactorSuggestions,
      };

      this.saved = record;
      this.statusMessage = `Architecture Health Report ready — **${report.recommendation}** (${report.criticalCount} critical, ${report.warningCount} warning-level).`;

      this.safetyGate.log(
        "success",
        "Architecture health report generated",
        `${report.fileCountScanned} files · ${report.recommendation}`,
      );

      if (report.criticalCount > 0) {
        this.safetyGate.log(
          "warning",
          "Critical monolith files detected",
          `${report.criticalCount} file(s) at critical size.`,
        );
      }

      return record;
    } finally {
      this.busy = false;
    }
  }

  clear(): void {
    this.saved = null;
    this.statusMessage = "Architecture Health Report cleared.";
    this.safetyGate.log("info", "Architecture health cleared", "User cleared report.");
  }

  recordCopy(): string | null {
    if (!this.saved) {
      this.statusMessage = "Generate an Architecture Health Report before copying.";
      this.safetyGate.log(
        "warning",
        "Architecture health copy blocked",
        "No saved report.",
      );
      return null;
    }
    this.safetyGate.log(
      "info",
      "Architecture health report copied",
      `Recommendation: ${this.saved.recommendation}.`,
    );
    this.statusMessage =
      "Architecture Health Report copied to clipboard (metadata only).";
    return this.saved.markdown;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.busy = false;
    this.statusMessage =
      "Generate an Architecture Health Report to flag oversized files and monolith risk (metadata only).";
  }

  restoreSaved(record: ArchitectureHealthRecord | null | undefined): void {
    this.saved = record ? normalizeRecord(record) : null;
    if (this.saved) {
      this.includeTestFiles = this.saved.includeTestFiles;
      this.includeMarkdownDocs = this.saved.includeMarkdownDocs;
      this.statusMessage = `Architecture Health Report restored (${this.saved.recommendation}${this.saved.stale ? ", stale" : ""}).`;
    }
  }

  getRecommendation(): ArchitectureHealthRecommendation | null {
    return this.saved?.recommendation ?? null;
  }

  monolithInChangedFiles(input: {
    changedFilesScan: ChangedFilesScanResult | null;
    changedFilesTaskLink: ChangedFilesTaskLinkRecord | null;
  }): boolean {
    if (!this.saved || this.saved.stale) return false;

    const criticalPaths = new Set<string>();
    if (this.saved.largestFilePath && this.saved.criticalCount > 0) {
      criticalPaths.add(this.saved.largestFilePath.replace(/\\/g, "/"));
    }

    const changed = [
      ...(input.changedFilesScan?.files.map((f) => f.path) ?? []),
      ...(input.changedFilesTaskLink?.changedFilePaths ?? []),
    ].map((p) => p.replace(/\\/g, "/"));

    return changed.some(
      (p) =>
        /(?:^|\/)App\.tsx$/i.test(p) ||
        /(?:^|\/)main\/index\.ts$/i.test(p) ||
        criticalPaths.has(p),
    );
  }
}
