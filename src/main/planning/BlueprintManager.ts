import fs from "node:fs";
import path from "node:path";
import { buildBlueprintCompletenessReport } from "../../shared/buildBlueprintCompleteness";
import { buildPhase1BuilderHandoffMarkdown } from "../../shared/buildPhase1BuilderHandoff";
import { buildPlannerAiPromptMarkdown } from "../../shared/buildPlannerAiPrompt";
import { buildPlannerQuestionsMarkdown } from "../../shared/buildPlannerQuestions";
import {
  BLUEPRINT_PLANNING_SUBFOLDER,
  DEFAULT_BLUEPRINT_BUILD_STYLE,
  DEFAULT_BLUEPRINT_PROJECT_TYPE,
  DEFAULT_BLUEPRINT_SOURCE,
  DEFAULT_BLUEPRINT_TARGET_USER,
  DEFAULT_BLUEPRINT_TECHNICAL_COMFORT,
  isPlanningDocumentFileName,
  type BlueprintSource,
} from "../../shared/blueprintConstants";
import {
  detectBlueprintSections,
  summarizeBlueprintIdea,
} from "../../shared/extractBlueprintSections";
import type {
  BlueprintCompletenessReport,
  BlueprintImportedRecord,
  BlueprintIntake,
  BlueprintPlannerPrompt,
  BlueprintPlannerQuestions,
  BlueprintState,
  BlueprintStatusSummary,
  Phase1BuilderHandoffRecord,
  PlanningDocumentsPreview,
  PlanningDocumentsSavedRecord,
} from "../../shared/types";
import type { PlanningStyleId } from "../../shared/planningStyle";
import type { SafetyGate } from "../safety/SafetyGate";
import { buildPlanningDocumentsPreview } from "./buildPlanningDocuments";

const MAX_BLUEPRINT_TEXT = 80_000;

function defaultIntake(): BlueprintIntake {
  return {
    projectIdea: "",
    projectType: DEFAULT_BLUEPRINT_PROJECT_TYPE,
    targetUser: DEFAULT_BLUEPRINT_TARGET_USER,
    technicalComfort: DEFAULT_BLUEPRINT_TECHNICAL_COMFORT,
    buildStyle: DEFAULT_BLUEPRINT_BUILD_STYLE,
    constraints: "",
    answersClarifications: "",
  };
}

function buildStatus(input: {
  intake: BlueprintIntake;
  imported: BlueprintImportedRecord | null;
  completeness: BlueprintCompletenessReport | null;
  preview: PlanningDocumentsPreview | null;
  lastSaved: PlanningDocumentsSavedRecord | null;
  phase1: Phase1BuilderHandoffRecord | null;
}): BlueprintStatusSummary {
  return {
    ideaExists: Boolean(input.intake.projectIdea.trim()),
    blueprintImported: Boolean(input.imported),
    completenessCheckExists: Boolean(input.completeness),
    planningDocsPreviewExists: Boolean(input.preview),
    planningDocsExported: Boolean(input.lastSaved),
    phase1HandoffExists: Boolean(input.phase1),
    readinessStatus: input.completeness?.readiness ?? null,
    localPlannerDraftExists: false,
    localPlannerDraftSavedAsBlueprint: false,
    localPlannerAiStatus: "idle",
    taskCardsExist: false,
    activeTaskId: null,
    nextTaskId: null,
    blockedTaskCount: 0,
    readyToSendTaskCount: 0,
    implementationReturnedTaskCount: 0,
    taskBuilderHandoffExists: false,
    taskBuilderHandoffSelectedTaskId: null,
    taskBuilderHandoffReadiness: null,
    taskBuilderHandoffStale: false,
    taskBuilderHandoffCopied: false,
    activeTaskStatus: null,
    taskImplementationReportCount: 0,
    activeTaskHasImplementationReport: false,
    activeTaskImplementationReportStale: false,
    pendingMarkImplementationReturned: false,
    taskReconciliationExists: false,
    taskReconciliationStale: false,
    taskReconciliationRecommendation: null,
    taskReconciliationMissingProducers: 0,
    taskReconciliationStatusInconsistencyCount: 0,
    taskArtifactIndexExists: false,
    taskArtifactIndexStale: false,
    taskArtifactIndexRecommendation: null,
    taskArtifactIndexUnlinkedCount: 0,
    taskArtifactIndexStaleCount: 0,
    changedFilesScanExists: false,
    changedFilesTaskLinkExists: false,
    changedFilesTaskLinkStale: false,
    changedFilesTaskLinkTaskId: null,
    changedFilesTaskLinkScopeWarningCount: 0,
    changedFilesUnlinked: false,
  };
}

/** Stage 80: Project Blueprint Planner state (planning documents only). */
export class BlueprintManager {
  private intake: BlueprintIntake = defaultIntake();
  private plannerQuestions: BlueprintPlannerQuestions | null = null;
  private plannerPrompt: BlueprintPlannerPrompt | null = null;
  private importedBlueprint: BlueprintImportedRecord | null = null;
  private completenessReport: BlueprintCompletenessReport | null = null;
  private planningDocsPreview: PlanningDocumentsPreview | null = null;
  private planningDocsLastSaved: PlanningDocumentsSavedRecord | null = null;
  private phase1Handoff: Phase1BuilderHandoffRecord | null = null;
  private draftBlueprintText = "";
  private draftBlueprintSource: BlueprintSource = DEFAULT_BLUEPRINT_SOURCE;
  private selectedPreviewFileName: string | null = null;
  private busy = false;
  private pendingOverwriteFiles: string[] = [];
  private saveBlockedReason: string | null = null;
  private statusMessage: string | null =
    "Describe your app idea, generate planner questions, then import a blueprint from outside AI. Planning documents only — no source code.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BlueprintState {
    return {
      intake: { ...this.intake },
      plannerQuestions: this.plannerQuestions,
      plannerPrompt: this.plannerPrompt,
      importedBlueprint: this.importedBlueprint,
      completenessReport: this.completenessReport,
      planningDocsPreview: this.planningDocsPreview,
      planningDocsLastSaved: this.planningDocsLastSaved,
      phase1Handoff: this.phase1Handoff,
      phaseTaskCards: { saved: null, statusMessage: null },
      taskCardBuilderHandoff: {
        saved: null,
        selectedTaskId: null,
        target: "generic-builder",
        strictness: "conservative",
        statusMessage: null,
        suggestedNextStatus: null,
      },
      taskImplementationIntake: {
        selectedTaskId: null,
        builderSource: "Cursor",
        draftText: "",
        reportsByTaskId: {},
        selectedReport: null,
        statusMessage: null,
        suggestedMarkReturned: null,
        nextTaskSuggestion: null,
        liveParse: null,
        hasImplementationReview: false,
      },
      taskReconciliation: {
        saved: null,
        statusMessage:
          "Generate a rule-based reconciliation report to check whether phase task cards fit together.",
      },
      taskArtifactIndex: {
        saved: null,
        filterTaskId: null,
        statusMessage:
          "Generate a rule-based Task Artifact Index to trace task cards, handoffs, and reports by task ID.",
      },
      plannerAi: { saved: null, busy: false, statusMessage: null },
      status: buildStatus({
        intake: this.intake,
        imported: this.importedBlueprint,
        completeness: this.completenessReport,
        preview: this.planningDocsPreview,
        lastSaved: this.planningDocsLastSaved,
        phase1: this.phase1Handoff,
      }),
      statusMessage: this.statusMessage,
      busy: this.busy,
      draftBlueprintText: this.draftBlueprintText,
      draftBlueprintSource: this.draftBlueprintSource,
      pendingOverwriteFiles: [...this.pendingOverwriteFiles],
      saveBlockedReason: this.saveBlockedReason,
      selectedPreviewFileName: this.selectedPreviewFileName,
    };
  }

  setIntake(patch: Partial<BlueprintIntake>): void {
    this.intake = { ...this.intake, ...patch };
  }

  getIntake(): BlueprintIntake {
    return { ...this.intake };
  }

  setDraftSource(source: BlueprintSource): void {
    this.draftBlueprintSource = source;
  }

  setDraftText(text: string): void {
    this.draftBlueprintText = text.slice(0, MAX_BLUEPRINT_TEXT);
  }

  setPreviewFile(fileName: string | null): void {
    this.selectedPreviewFileName = fileName;
  }

  generatePlannerQuestions(): BlueprintPlannerQuestions {
    const markdown = buildPlannerQuestionsMarkdown(this.intake);
    this.plannerQuestions = {
      generatedAt: new Date().toISOString(),
      markdown,
    };
    this.statusMessage =
      "Planner questions generated (rule-based). Copy or answer them before creating the planner AI prompt.";
    this.safetyGate.log(
      "success",
      "Blueprint planner questions generated",
      "Rule-based checklist — no AI called.",
    );
    return this.plannerQuestions;
  }

  generatePlannerPrompt(planningStyle: PlanningStyleId): BlueprintPlannerPrompt {
    const markdown = buildPlannerAiPromptMarkdown(
      this.intake,
      this.plannerQuestions?.markdown ?? null,
      planningStyle,
    );
    this.plannerPrompt = {
      generatedAt: new Date().toISOString(),
      markdown,
    };
    this.statusMessage =
      "Planner AI prompt ready to copy. Send manually to outside or local planner AI.";
    this.safetyGate.log(
      "success",
      "Blueprint planner AI prompt created",
      "Copy-only — not sent automatically.",
    );
    return this.plannerPrompt;
  }

  saveImportedBlueprint(): { ok: boolean; message: string } {
    return this.importBlueprintText(
      this.draftBlueprintText,
      this.draftBlueprintSource,
    );
  }

  importBlueprintText(
    text: string,
    source: BlueprintSource,
  ): { ok: boolean; message: string } {
    const trimmed = text.trim();
    if (!trimmed) {
      const message = "Paste a blueprint before saving.";
      this.statusMessage = message;
      this.safetyGate.log("warning", "Blueprint import blocked", message);
      return { ok: false, message };
    }

    const truncated = trimmed.length > MAX_BLUEPRINT_TEXT;
    const blueprintText = truncated ? trimmed.slice(0, MAX_BLUEPRINT_TEXT) : trimmed;
    const detection = detectBlueprintSections(blueprintText);

    this.draftBlueprintText = blueprintText;
    this.draftBlueprintSource = source;
    this.importedBlueprint = {
      importedAt: new Date().toISOString(),
      source,
      blueprintText,
      ideaSummary: summarizeBlueprintIdea(this.intake.projectIdea),
      projectType: this.intake.projectType,
      targetUser: this.intake.targetUser,
      technicalComfort: this.intake.technicalComfort,
      buildStyle: this.intake.buildStyle,
      sectionsPresent: detection.present,
      sectionsMissing: detection.missing,
      openQuestionCount: detection.openQuestionCount,
      phaseCount: detection.phaseCount,
      hasPhase1Handoff: detection.hasPhase1Handoff,
      hasSuggestedFilePlan: detection.hasSuggestedFilePlan,
      hasValidationPlan: detection.hasValidationPlan,
      hasSmallModelGuidance: detection.hasSmallModelGuidance,
      truncationFlag: truncated,
    };
    this.completenessReport = null;
    this.planningDocsPreview = null;
    this.phase1Handoff = null;
    this.pendingOverwriteFiles = [];
    this.statusMessage = `Blueprint imported from ${source}. Run completeness check next.`;
    this.safetyGate.log(
      "success",
      "Blueprint imported",
      `Source: ${source}; sections present: ${detection.present.length}.`,
    );
    return { ok: true, message: this.statusMessage };
  }

  clearImportedBlueprint(): void {
    this.importedBlueprint = null;
    this.completenessReport = null;
    this.planningDocsPreview = null;
    this.planningDocsLastSaved = null;
    this.phase1Handoff = null;
    this.draftBlueprintText = "";
    this.pendingOverwriteFiles = [];
    this.saveBlockedReason = null;
    this.selectedPreviewFileName = null;
    this.statusMessage = "Imported blueprint cleared.";
    this.safetyGate.log("info", "Blueprint cleared", "Imported blueprint removed.");
  }

  checkCompleteness(): BlueprintCompletenessReport | null {
    if (!this.importedBlueprint) {
      this.statusMessage = "Import a blueprint before running completeness check.";
      this.safetyGate.log(
        "warning",
        "Blueprint completeness blocked",
        "No imported blueprint.",
      );
      return null;
    }
    this.completenessReport = buildBlueprintCompletenessReport(
      this.importedBlueprint.blueprintText,
    );
    this.statusMessage = `Completeness: ${this.completenessReport.readiness}. ${this.completenessReport.recommendedNextStep}`;
    this.safetyGate.log(
      "success",
      "Blueprint completeness checked",
      `Readiness: ${this.completenessReport.readiness}.`,
    );
    return this.completenessReport;
  }

  previewPlanningDocuments(
    taskCards?: import("../../shared/types").BlueprintPhaseTaskCardsRecord | null,
    taskCardHandoff?: import("../../shared/types").TaskCardBuilderHandoffRecord | null,
    taskImplementationReports?: Record<
      string,
      import("../../shared/types").TaskImplementationReportRecord
    > | null,
    taskReconciliation?: import("../../shared/types").BlueprintTaskReconciliationRecord | null,
    taskArtifactIndex?: import("../../shared/types").TaskArtifactIndexRecord | null,
    changedFilesTaskLink?: import("../../shared/types").ChangedFilesTaskLinkRecord | null,
    architectureHealth?: import("../../shared/types").ArchitectureHealthRecord | null,
    architectureRefactorTaskCards?: import("../../shared/types").ArchitectureRefactorTaskCardsRecord | null,
    architectureRefactorTaskHandoff?: import("../../shared/types").ArchitectureRefactorTaskBuilderHandoffRecord | null,
    architectureRefactorImplementationReports?: Record<
      string,
      import("../../shared/types").ArchitectureRefactorTaskImplementationReportRecord
    > | null,
  ): PlanningDocumentsPreview | null {
    if (!this.importedBlueprint) {
      this.statusMessage = "Import a blueprint before previewing planning documents.";
      this.safetyGate.log(
        "warning",
        "Planning docs preview blocked",
        "No imported blueprint.",
      );
      return null;
    }
    const projectSelected = Boolean(this.safetyGate.getProject());
    this.planningDocsPreview = buildPlanningDocumentsPreview({
      blueprintText: this.importedBlueprint.blueprintText,
      projectSelected,
      taskCards,
      taskCardHandoff,
      taskImplementationReports,
      taskReconciliation,
      taskArtifactIndex,
      changedFilesTaskLink,
      architectureHealth,
      architectureRefactorTaskCards,
      architectureRefactorTaskHandoff,
      architectureRefactorImplementationReports,
    });
    this.selectedPreviewFileName =
      this.planningDocsPreview.files[0]?.fileName ?? null;
    this.pendingOverwriteFiles = this.listExistingPlanningFiles();
    this.saveBlockedReason = projectSelected
      ? null
      : "Select a project folder before exporting planning documents.";
    this.statusMessage = projectSelected
      ? `Planning documents preview generated (${this.planningDocsPreview.files.length} files). No files written yet.`
      : "Preview generated. Select a project before saving to `.nttc/planning/`.";
    this.safetyGate.log(
      "success",
      "Planning docs preview generated",
      `${this.planningDocsPreview.files.length} markdown files; no disk write.`,
    );
    return this.planningDocsPreview;
  }

  savePlanningDocuments(confirmOverwrite: boolean): {
    ok: boolean;
    message: string;
    needsOverwriteConfirmation?: boolean;
    filesWritten?: string[];
  } {
    if (!this.planningDocsPreview) {
      const message = "Preview planning documents before saving.";
      this.statusMessage = message;
      this.safetyGate.log("warning", "Planning docs export blocked", message);
      return { ok: false, message };
    }

    if (!this.safetyGate.getProject()) {
      const message = "Select a project folder before saving planning documents.";
      this.saveBlockedReason = message;
      this.statusMessage = message;
      this.safetyGate.log("blocked", "Planning docs export refused", message);
      return { ok: false, message };
    }

    this.pendingOverwriteFiles = this.listExistingPlanningFiles();
    if (this.pendingOverwriteFiles.length > 0 && !confirmOverwrite) {
      this.safetyGate.log(
        "info",
        "Planning docs overwrite confirmation shown",
        this.pendingOverwriteFiles.join(", "),
      );
      this.statusMessage =
        "Some `.nttc/planning/` files exist. Confirm overwrite before saving.";
      return {
        ok: false,
        message: "Existing planning files need overwrite confirmation.",
        needsOverwriteConfirmation: true,
      };
    }

    this.safetyGate.log(
      "info",
      "Planning docs export confirmed",
      confirmOverwrite
        ? "User confirmed overwrite for existing planning files."
        : "User confirmed first-time save to `.nttc/planning/`.",
    );

    const dirResult = this.safetyGate.resolvePlanningDocumentsDirectory();
    if (!dirResult.allowed || !dirResult.dirPath) {
      const message =
        dirResult.denyReason ??
        "Could not verify a safe `.nttc/planning/` folder.";
      this.saveBlockedReason = message;
      this.statusMessage = message;
      this.safetyGate.log("blocked", "Planning docs export failed", message);
      return { ok: false, message };
    }

    this.busy = true;
    const filesWritten: string[] = [];

    try {
      if (!fs.existsSync(dirResult.dirPath)) {
        fs.mkdirSync(dirResult.dirPath, { recursive: true });
      }

      for (const file of this.planningDocsPreview.files) {
        if (!isPlanningDocumentFileName(file.fileName)) continue;
        const gate = this.safetyGate.checkPlanningDocumentWrite(file.fileName);
        if (!gate.allowed || !gate.normalizedPath) {
          const message =
            gate.denyReason ?? `Safety Gate refused write for ${file.fileName}.`;
          this.statusMessage = message;
          this.safetyGate.log("blocked", "Planning docs export failed", message);
          return { ok: false, message };
        }
        fs.writeFileSync(gate.normalizedPath, file.content, {
          encoding: "utf8",
          flag: "w",
        });
        filesWritten.push(file.fileName);
      }

      const savedAt = new Date().toISOString();
      this.planningDocsLastSaved = {
        savedAt,
        filesWritten,
        overwriteConfirmed: confirmOverwrite,
        truncationFlags: [...this.planningDocsPreview.truncationFlags],
        generatedAt: this.planningDocsPreview.generatedAt,
      };
      this.pendingOverwriteFiles = [];
      this.saveBlockedReason = null;
      this.statusMessage = `Saved ${filesWritten.length} planning files to \`.nttc/planning/\`.`;
      this.safetyGate.log(
        "success",
        "Planning docs saved",
        filesWritten.join(", "),
      );
      return { ok: true, message: this.statusMessage, filesWritten };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save planning files.";
      this.statusMessage = `Save failed: ${message}`;
      this.safetyGate.log("blocked", "Planning docs export failed", message);
      return { ok: false, message };
    } finally {
      this.busy = false;
    }
  }

  generatePhase1Handoff(planningStyle: PlanningStyleId): Phase1BuilderHandoffRecord | null {
    if (!this.importedBlueprint) {
      this.statusMessage = "Import a blueprint before generating Phase 1 handoff.";
      return null;
    }
    const markdown = buildPhase1BuilderHandoffMarkdown({
      intake: this.intake,
      imported: this.importedBlueprint,
      completeness: this.completenessReport,
      planningStyle,
    });
    this.phase1Handoff = {
      generatedAt: new Date().toISOString(),
      markdown,
    };
    this.statusMessage = "Phase 1 Builder Handoff generated (text-only).";
    this.safetyGate.log(
      "success",
      "Phase 1 builder handoff generated",
      "Text-only — no source files created.",
    );
    return this.phase1Handoff;
  }

  recordCopyPlannerQuestions(): void {
    if (!this.plannerQuestions) {
      this.safetyGate.log(
        "warning",
        "Blueprint planner questions copy blocked",
        "Generate planner questions first.",
      );
      return;
    }
    this.safetyGate.log("success", "Blueprint planner questions copied", "Copy recorded.");
  }

  recordCopyPlannerPrompt(): void {
    if (!this.plannerPrompt) {
      this.safetyGate.log(
        "warning",
        "Blueprint planner prompt copy blocked",
        "Create planner AI prompt first.",
      );
      return;
    }
    this.safetyGate.log("success", "Blueprint planner AI prompt copied", "Copy recorded.");
  }

  recordCopyImportedBlueprint(): void {
    if (!this.importedBlueprint) {
      this.safetyGate.log(
        "warning",
        "Blueprint copy blocked",
        "Import a blueprint first.",
      );
      return;
    }
    this.safetyGate.log("success", "Imported blueprint copied", "Copy recorded.");
  }

  recordCopyPhase1Handoff(): void {
    if (!this.phase1Handoff) {
      this.safetyGate.log(
        "warning",
        "Phase 1 handoff copy blocked",
        "Generate Phase 1 handoff first.",
      );
      return;
    }
    this.safetyGate.log("success", "Phase 1 builder handoff copied", "Copy recorded.");
  }

  restoreFromHistory(input: {
    intake: BlueprintIntake | null;
    plannerQuestions: BlueprintPlannerQuestions | null;
    plannerPrompt: BlueprintPlannerPrompt | null;
    imported: BlueprintImportedRecord | null;
    completeness: BlueprintCompletenessReport | null;
    preview: PlanningDocumentsPreview | null;
    lastSaved: PlanningDocumentsSavedRecord | null;
    phase1: Phase1BuilderHandoffRecord | null;
    draftText: string;
    draftSource: BlueprintSource;
    selectedFile: string | null;
  }): void {
    if (input.intake) this.intake = { ...defaultIntake(), ...input.intake };
    this.plannerQuestions = input.plannerQuestions;
    this.plannerPrompt = input.plannerPrompt;
    this.importedBlueprint = input.imported;
    this.completenessReport = input.completeness;
    this.planningDocsPreview = input.preview;
    this.planningDocsLastSaved = input.lastSaved;
    this.phase1Handoff = input.phase1;
    this.draftBlueprintText = input.draftText;
    this.draftBlueprintSource = input.draftSource;
    this.selectedPreviewFileName = input.selectedFile;
    this.pendingOverwriteFiles = this.listExistingPlanningFiles();
    if (input.imported) {
      this.statusMessage = `Blueprint restored (${input.imported.source}).`;
    }
  }

  clearForProjectChange(): void {
    this.planningDocsPreview = null;
    this.planningDocsLastSaved = null;
    this.pendingOverwriteFiles = [];
    this.saveBlockedReason = null;
    this.busy = false;
  }

  private listExistingPlanningFiles(): string[] {
    const dir = this.safetyGate.resolvePlanningDocumentsDirectory();
    if (!dir.allowed || !dir.dirPath || !fs.existsSync(dir.dirPath)) return [];
    try {
      return fs
        .readdirSync(dir.dirPath)
        .filter((name) => isPlanningDocumentFileName(name));
    } catch {
      return [];
    }
  }
}

export { BLUEPRINT_PLANNING_SUBFOLDER };
