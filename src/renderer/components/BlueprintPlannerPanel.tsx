import type { ReactNode } from "react";
import type { BlueprintState } from "../../shared/types";
import { BlueprintPhaseTaskCardsPanel } from "./BlueprintPhaseTaskCardsPanel";
import { TaskCardBuilderHandoffPanel } from "./TaskCardBuilderHandoffPanel";
import { TaskImplementationIntakePanel } from "./TaskImplementationIntakePanel";
import { BlueprintTaskReconciliationPanel } from "./BlueprintTaskReconciliationPanel";
import { TaskArtifactIndexPanel } from "./TaskArtifactIndexPanel";
import {
  BLUEPRINT_BUILD_STYLE_OPTIONS,
  BLUEPRINT_CONSTRAINTS_PLACEHOLDER,
  BLUEPRINT_IDEA_PLACEHOLDER,
  BLUEPRINT_PROJECT_TYPE_OPTIONS,
  BLUEPRINT_SOURCE_OPTIONS,
  BLUEPRINT_TARGET_USER_OPTIONS,
  BLUEPRINT_TECHNICAL_COMFORT_OPTIONS,
  PLANNING_DOCS_SAFETY_WARNING,
  type BlueprintBuildStyle,
  type BlueprintProjectType,
  type BlueprintSource,
  type BlueprintTargetUser,
  type BlueprintTechnicalComfort,
} from "../../shared/blueprintConstants";

function ActionButton({
  label,
  hint,
  disabled,
  primary,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={primary ? "action-btn primary" : "action-btn"}
      title={hint}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StatusLine({ children }: { children: ReactNode }) {
  return <p className="field-value muted blueprint-status-line">{children}</p>;
}

export function BlueprintPlannerPanel({
  blueprint,
  projectSelected,
  onIntakeChange,
  onGenerateQuestions,
  onCopyQuestions,
  onGeneratePrompt,
  onCopyPrompt,
  onAskLocalPlannerAi,
  onCopyLocalPlannerDraft,
  onSaveLocalDraftAsBlueprint,
  onDraftSourceChange,
  onDraftTextChange,
  onSaveImported,
  onClearImported,
  onCopyImported,
  onCheckCompleteness,
  onPreviewPlanningDocs,
  onSavePlanningDocs,
  onConfirmOverwritePlanningDocs,
  onGeneratePhase1Handoff,
  onCopyPhase1Handoff,
  onGeneratePhaseTaskCards,
  onCopyAllPhaseTaskCards,
  onClearPhaseTaskCards,
  onCopyPhaseTaskCard,
  onSetPhaseTaskCardStatus,
  onResetPhaseTaskCardStatus,
  onSetActivePhaseTaskCard,
  onTaskHandoffSelectedTaskChange,
  onTaskHandoffTargetChange,
  onTaskHandoffStrictnessChange,
  onGenerateTaskBuilderHandoff,
  onCopyTaskBuilderHandoff,
  onClearTaskBuilderHandoff,
  onTaskImplSelectedTaskChange,
  onTaskImplBuilderSourceChange,
  onTaskImplDraftChange,
  onSaveTaskImplementationReport,
  onCopyTaskImplementationReport,
  onClearTaskImplementationReport,
  onMarkTaskImplementationReturned,
  onMarkTaskReviewed,
  onStageTaskImplementationReportForReview,
  onGenerateBlueprintTaskReconciliation,
  onCopyBlueprintTaskReconciliation,
  onClearBlueprintTaskReconciliation,
  onGenerateTaskArtifactIndex,
  onCopyTaskArtifactIndex,
  onClearTaskArtifactIndex,
  onTaskArtifactIndexFilterChange,
  onSelectPreviewFile,
  questionsCopyState,
  promptCopyState,
  localPlannerCopyState,
  importedCopyState,
  phase1CopyState,
  phaseTaskCardsCopyAllState,
  phaseTaskCardCopyState,
  taskBuilderHandoffCopyState,
  taskImplementationIntakeCopyState,
  taskImplementationIntakeDraft,
  taskReconciliationCopyState,
  taskArtifactIndexCopyState,
}: {
  blueprint: BlueprintState;
  projectSelected: boolean;
  onIntakeChange: (patch: Partial<BlueprintState["intake"]>) => void;
  onGenerateQuestions: () => void;
  onCopyQuestions: () => void;
  onGeneratePrompt: () => void;
  onCopyPrompt: () => void;
  onAskLocalPlannerAi: () => void;
  onCopyLocalPlannerDraft: () => void;
  onSaveLocalDraftAsBlueprint: () => void;
  onDraftSourceChange: (source: BlueprintSource) => void;
  onDraftTextChange: (text: string) => void;
  onSaveImported: () => void;
  onClearImported: () => void;
  onCopyImported: () => void;
  onCheckCompleteness: () => void;
  onPreviewPlanningDocs: () => void;
  onSavePlanningDocs: () => void;
  onConfirmOverwritePlanningDocs: () => void;
  onGeneratePhase1Handoff: () => void;
  onCopyPhase1Handoff: () => void;
  onGeneratePhaseTaskCards: () => void;
  onCopyAllPhaseTaskCards: () => void;
  onClearPhaseTaskCards: () => void;
  onCopyPhaseTaskCard: (taskId: string) => void;
  onSetPhaseTaskCardStatus: (
    taskId: string,
    status: import("../../shared/blueprintTaskCardConstants").BlueprintPhaseTaskCardStatus,
  ) => void;
  onResetPhaseTaskCardStatus: (taskId: string) => void;
  onSetActivePhaseTaskCard: (taskId: string) => void;
  onTaskHandoffSelectedTaskChange: (taskId: string) => void;
  onTaskHandoffTargetChange: (
    target: import("../../shared/types").BuilderHandoffTarget,
  ) => void;
  onTaskHandoffStrictnessChange: (
    strictness: import("../../shared/types").BuilderHandoffStrictness,
  ) => void;
  onGenerateTaskBuilderHandoff: () => void;
  onCopyTaskBuilderHandoff: () => void;
  onClearTaskBuilderHandoff: () => void;
  onTaskImplSelectedTaskChange: (taskId: string) => void;
  onTaskImplBuilderSourceChange: (
    source: import("../../shared/taskImplementationIntakeConstants").TaskImplementationBuilderSource,
  ) => void;
  onTaskImplDraftChange: (text: string) => void;
  onSaveTaskImplementationReport: () => void;
  onCopyTaskImplementationReport: () => void;
  onClearTaskImplementationReport: () => void;
  onMarkTaskImplementationReturned: () => void;
  onMarkTaskReviewed: () => void;
  onStageTaskImplementationReportForReview: () => void;
  onGenerateBlueprintTaskReconciliation: () => void;
  onCopyBlueprintTaskReconciliation: () => void;
  onClearBlueprintTaskReconciliation: () => void;
  onGenerateTaskArtifactIndex: () => void;
  onCopyTaskArtifactIndex: () => void;
  onClearTaskArtifactIndex: () => void;
  onTaskArtifactIndexFilterChange: (taskId: string | null) => void;
  onSelectPreviewFile: (fileName: string) => void;
  questionsCopyState: "idle" | "copied" | "failed";
  promptCopyState: "idle" | "copied" | "failed";
  localPlannerCopyState: "idle" | "copied" | "failed";
  importedCopyState: "idle" | "copied" | "failed";
  phase1CopyState: "idle" | "copied" | "failed";
  phaseTaskCardsCopyAllState: "idle" | "copied" | "failed";
  phaseTaskCardCopyState: Record<string, "idle" | "copied" | "failed">;
  taskBuilderHandoffCopyState: "idle" | "copied" | "failed";
  taskImplementationIntakeCopyState: "idle" | "copied" | "failed";
  taskImplementationIntakeDraft: string;
  taskReconciliationCopyState: "idle" | "copied" | "failed";
  taskArtifactIndexCopyState: "idle" | "copied" | "failed";
}) {
  const { intake, status, plannerAi } = blueprint;
  const selectedPreview = blueprint.planningDocsPreview?.files.find(
    (f) => f.fileName === blueprint.selectedPreviewFileName,
  );
  const needsOverwrite =
    blueprint.pendingOverwriteFiles.length > 0 && !blueprint.planningDocsLastSaved;

  return (
    <div className="blueprint-planner" data-focus-id="blueprint-planner">
      <section className="blueprint-section">
        <h3 className="blueprint-section-title">Build From Idea</h3>
        <p className="field-value muted">
          Plan a new app or major feature before code exists. Rule-based helpers
          and copyable prompts only — NTTC does not call AI automatically.
        </p>

        <div className="field-label">Project idea</div>
        <textarea
          className="blueprint-textarea"
          rows={8}
          placeholder={BLUEPRINT_IDEA_PLACEHOLDER}
          value={intake.projectIdea}
          onChange={(e) => onIntakeChange({ projectIdea: e.target.value })}
        />

        <div className="blueprint-field-grid">
          <label className="blueprint-field">
            <span className="field-label">Project type</span>
            <select
              value={intake.projectType}
              onChange={(e) =>
                onIntakeChange({
                  projectType: e.target.value as BlueprintProjectType,
                })
              }
            >
              {BLUEPRINT_PROJECT_TYPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="blueprint-field">
            <span className="field-label">Target user</span>
            <select
              value={intake.targetUser}
              onChange={(e) =>
                onIntakeChange({
                  targetUser: e.target.value as BlueprintTargetUser,
                })
              }
            >
              {BLUEPRINT_TARGET_USER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="blueprint-field">
            <span className="field-label">Technical comfort</span>
            <select
              value={intake.technicalComfort}
              onChange={(e) =>
                onIntakeChange({
                  technicalComfort: e.target.value as BlueprintTechnicalComfort,
                })
              }
            >
              {BLUEPRINT_TECHNICAL_COMFORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="blueprint-field">
            <span className="field-label">Build style</span>
            <select
              value={intake.buildStyle}
              onChange={(e) =>
                onIntakeChange({
                  buildStyle: e.target.value as BlueprintBuildStyle,
                })
              }
            >
              {BLUEPRINT_BUILD_STYLE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-label">Constraints</div>
        <textarea
          className="blueprint-textarea"
          rows={4}
          placeholder={BLUEPRINT_CONSTRAINTS_PLACEHOLDER}
          value={intake.constraints}
          onChange={(e) => onIntakeChange({ constraints: e.target.value })}
        />
      </section>

      <section className="blueprint-section">
        <h3 className="blueprint-section-title">Planner Questions</h3>
        <div className="blueprint-actions">
          <ActionButton
            label="Generate Planner Questions"
            hint="Rule-based checklist — does not call AI"
            primary
            onClick={onGenerateQuestions}
          />
          <ActionButton
            label="Copy Planner Questions"
            hint="Copies checklist to clipboard"
            disabled={!blueprint.plannerQuestions}
            onClick={onCopyQuestions}
          />
        </div>
        {questionsCopyState === "copied" ? (
          <StatusLine>Planner questions copied.</StatusLine>
        ) : null}
        {blueprint.plannerQuestions ? (
          <pre className="blueprint-preview">{blueprint.plannerQuestions.markdown}</pre>
        ) : null}
        <div className="field-label">Answers / clarifications</div>
        <textarea
          className="blueprint-textarea"
          rows={5}
          placeholder="Paste answers to the planner questions here."
          value={intake.answersClarifications}
          onChange={(e) =>
            onIntakeChange({ answersClarifications: e.target.value })
          }
        />
      </section>

      <section className="blueprint-section">
        <h3 className="blueprint-section-title">Planner AI Prompt</h3>
        <div className="blueprint-actions">
          <ActionButton
            label="Create Planner AI Prompt"
            hint="Copyable prompt for outside or local planner AI"
            primary
            onClick={onGeneratePrompt}
          />
          <ActionButton
            label="Copy Planner AI Prompt"
            hint="Does not send automatically"
            disabled={!blueprint.plannerPrompt}
            onClick={onCopyPrompt}
          />
        </div>
        {promptCopyState === "copied" ? (
          <StatusLine>Planner AI prompt copied.</StatusLine>
        ) : null}
        {blueprint.plannerPrompt ? (
          <pre className="blueprint-preview blueprint-preview-tall">
            {blueprint.plannerPrompt.markdown}
          </pre>
        ) : null}
        <div className="blueprint-actions">
          <ActionButton
            label="Ask Local Planner AI"
            hint="Optional local Ollama planner — idea fields only; requires confirmation"
            primary
            disabled={
              !status.ideaExists || plannerAi.busy || blueprint.busy
            }
            onClick={onAskLocalPlannerAi}
          />
        </div>
        <p className="field-value muted" style={{ fontSize: "0.78rem" }}>
          Uses your local Ollama model to draft a Project Blueprint from the idea
          fields only. It does not read project files, write code, or create
          files.
        </p>
        {!blueprint.plannerQuestions ? (
          <p className="field-value muted" style={{ fontSize: "0.78rem" }}>
            Tip: generate planner questions first for a stronger local draft.
          </p>
        ) : null}
        {plannerAi.statusMessage ? (
          <StatusLine>{plannerAi.statusMessage}</StatusLine>
        ) : null}
        {plannerAi.saved ? (
          <div className="blueprint-local-planner-draft">
            <h4 className="field-label">Local Planner Blueprint Draft</h4>
            <StatusLine>
              Generated {plannerAi.saved.generatedAt} · {plannerAi.saved.modelName}{" "}
              · {Math.round(plannerAi.saved.elapsedMs / 1000)}s · readiness:{" "}
              {plannerAi.saved.readinessEstimate?.replace(/-/g, " ") ?? "unknown"}
              {plannerAi.saved.truncatedResponse ? " · truncated" : ""}
            </StatusLine>
            <pre className="blueprint-preview blueprint-preview-tall">
              {plannerAi.saved.previewExcerpt}
            </pre>
            <div className="blueprint-actions">
              <ActionButton
                label="Copy Local Planner Blueprint Draft"
                hint="Copies full draft markdown"
                onClick={onCopyLocalPlannerDraft}
              />
              <ActionButton
                label="Save Local Draft as Blueprint"
                hint="Stores draft as imported blueprint after your review"
                primary
                disabled={plannerAi.saved.savedAsImportedBlueprint}
                onClick={onSaveLocalDraftAsBlueprint}
              />
            </div>
            {localPlannerCopyState === "copied" ? (
              <StatusLine>Local Planner Blueprint Draft copied.</StatusLine>
            ) : null}
            {plannerAi.saved.savedAsImportedBlueprint ? (
              <StatusLine>
                This draft was saved as the official imported blueprint.
              </StatusLine>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="blueprint-section">
        <h3 className="blueprint-section-title">Import Planner Blueprint</h3>
        <label className="blueprint-field">
          <span className="field-label">Blueprint source</span>
          <select
            value={blueprint.draftBlueprintSource}
            onChange={(e) =>
              onDraftSourceChange(e.target.value as BlueprintSource)
            }
          >
            {BLUEPRINT_SOURCE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="blueprint-textarea blueprint-textarea-tall"
          rows={12}
          placeholder="Paste the Project Blueprint markdown returned by your planner AI or human planner."
          value={blueprint.draftBlueprintText}
          onChange={(e) => onDraftTextChange(e.target.value)}
        />
        <div className="blueprint-actions">
          <ActionButton
            label="Save Imported Blueprint"
            hint="Stores blueprint in session — does not send to AI"
            primary
            onClick={onSaveImported}
          />
          <ActionButton
            label="Clear Blueprint"
            hint="Clears imported blueprint and related reports"
            disabled={!blueprint.importedBlueprint}
            onClick={onClearImported}
          />
          <ActionButton
            label="Copy Blueprint"
            hint="Copies imported blueprint text"
            disabled={!blueprint.importedBlueprint}
            onClick={onCopyImported}
          />
        </div>
        {importedCopyState === "copied" ? (
          <StatusLine>Imported blueprint copied.</StatusLine>
        ) : null}
        {blueprint.importedBlueprint ? (
          <StatusLine>
            Imported {blueprint.importedBlueprint.importedAt} from{" "}
            {blueprint.importedBlueprint.source}. Sections present:{" "}
            {blueprint.importedBlueprint.sectionsPresent.length}.
          </StatusLine>
        ) : null}
      </section>

      <section className="blueprint-section">
        <h3 className="blueprint-section-title">Blueprint Completeness</h3>
        <ActionButton
          label="Check Blueprint Completeness"
          hint="Rule-based section check — no AI"
          primary
          disabled={!blueprint.importedBlueprint}
          onClick={onCheckCompleteness}
        />
        {blueprint.completenessReport ? (
          <div className="blueprint-completeness">
            <p className="field-value">
              <strong>Readiness:</strong>{" "}
              {blueprint.completenessReport.readiness.replace(/-/g, " ")}
            </p>
            <pre className="blueprint-preview">
              {blueprint.completenessReport.markdownReport}
            </pre>
          </div>
        ) : null}
      </section>

      <section className="blueprint-section">
        <h3 className="blueprint-section-title">Planning Documents</h3>
        <p className="help-note" role="note">
          {PLANNING_DOCS_SAFETY_WARNING}
        </p>
        <div className="blueprint-actions">
          <ActionButton
            label="Preview Planning Documents"
            hint="Preview only — no files written"
            primary
            disabled={!blueprint.importedBlueprint}
            onClick={onPreviewPlanningDocs}
          />
          <ActionButton
            label="Save Planning Documents to `.nttc/planning/`"
            hint="Requires project folder and confirmation"
            disabled={
              !blueprint.planningDocsPreview || !projectSelected || blueprint.busy
            }
            onClick={onSavePlanningDocs}
          />
          {needsOverwrite ? (
            <ActionButton
              label="Confirm Overwrite & Save"
              hint="Overwrite existing planning markdown files"
              onClick={onConfirmOverwritePlanningDocs}
            />
          ) : null}
        </div>
        {!projectSelected ? (
          <StatusLine>Select a project folder before exporting planning documents.</StatusLine>
        ) : null}
        {blueprint.planningDocsPreview ? (
          <div className="blueprint-docs-preview">
            <ul className="blueprint-doc-list">
              {blueprint.planningDocsPreview.files.map((file) => (
                <li key={file.fileName}>
                  <button
                    type="button"
                    className={
                      file.fileName === blueprint.selectedPreviewFileName
                        ? "link-button active"
                        : "link-button"
                    }
                    onClick={() => onSelectPreviewFile(file.fileName)}
                  >
                    {file.relativePath}
                  </button>
                </li>
              ))}
            </ul>
            {selectedPreview ? (
              <pre className="blueprint-preview blueprint-preview-tall">
                {selectedPreview.content}
              </pre>
            ) : null}
          </div>
        ) : null}
        {blueprint.planningDocsLastSaved ? (
          <StatusLine>
            Saved {blueprint.planningDocsLastSaved.savedAt} —{" "}
            {blueprint.planningDocsLastSaved.filesWritten.join(", ")}
          </StatusLine>
        ) : null}
      </section>

      <section className="blueprint-section">
        <h3 className="blueprint-section-title">Phase 1 Builder Handoff</h3>
        <div className="blueprint-actions">
          <ActionButton
            label="Generate Phase 1 Builder Handoff"
            hint="Text-only handoff from saved blueprint"
            primary
            disabled={!blueprint.importedBlueprint}
            onClick={onGeneratePhase1Handoff}
          />
          <ActionButton
            label="Copy Phase 1 Handoff"
            hint="Copies markdown — no source files created"
            disabled={!blueprint.phase1Handoff}
            onClick={onCopyPhase1Handoff}
          />
        </div>
        {phase1CopyState === "copied" ? (
          <StatusLine>Phase 1 handoff copied.</StatusLine>
        ) : null}
        {blueprint.phase1Handoff ? (
          <pre className="blueprint-preview blueprint-preview-tall">
            {blueprint.phase1Handoff.markdown}
          </pre>
        ) : null}
      </section>

      <BlueprintPhaseTaskCardsPanel
        phaseTaskCards={blueprint.phaseTaskCards}
        blueprintImported={Boolean(blueprint.importedBlueprint)}
        status={{
          activeTaskId: status.activeTaskId,
          nextTaskId: status.nextTaskId,
          blockedTaskCount: status.blockedTaskCount,
          readyToSendTaskCount: status.readyToSendTaskCount,
        }}
        onGenerate={onGeneratePhaseTaskCards}
        onCopyAll={onCopyAllPhaseTaskCards}
        onClear={onClearPhaseTaskCards}
        onCopyTask={onCopyPhaseTaskCard}
        onSetStatus={onSetPhaseTaskCardStatus}
        onResetStatus={onResetPhaseTaskCardStatus}
        onSetActive={onSetActivePhaseTaskCard}
        copyAllState={phaseTaskCardsCopyAllState}
        copyTaskState={phaseTaskCardCopyState}
      />

      <TaskCardBuilderHandoffPanel
        taskCards={blueprint.phaseTaskCards.saved}
        handoff={blueprint.taskCardBuilderHandoff}
        blueprintImported={Boolean(blueprint.importedBlueprint)}
        onSelectedTaskChange={onTaskHandoffSelectedTaskChange}
        onTargetChange={onTaskHandoffTargetChange}
        onStrictnessChange={onTaskHandoffStrictnessChange}
        onGenerate={onGenerateTaskBuilderHandoff}
        onCopy={onCopyTaskBuilderHandoff}
        onClear={onClearTaskBuilderHandoff}
        copyState={taskBuilderHandoffCopyState}
      />

      <TaskImplementationIntakePanel
        taskCards={blueprint.phaseTaskCards.saved}
        handoff={blueprint.taskCardBuilderHandoff}
        intake={blueprint.taskImplementationIntake}
        draftText={taskImplementationIntakeDraft}
        onSelectedTaskChange={onTaskImplSelectedTaskChange}
        onBuilderSourceChange={onTaskImplBuilderSourceChange}
        onDraftChange={onTaskImplDraftChange}
        onSave={onSaveTaskImplementationReport}
        onCopy={onCopyTaskImplementationReport}
        onClear={onClearTaskImplementationReport}
        onMarkReturned={onMarkTaskImplementationReturned}
        onMarkReviewed={onMarkTaskReviewed}
        onStageForReview={onStageTaskImplementationReportForReview}
        copyState={taskImplementationIntakeCopyState}
      />

      <BlueprintTaskReconciliationPanel
        taskCards={blueprint.phaseTaskCards.saved}
        reconciliation={blueprint.taskReconciliation}
        onGenerate={onGenerateBlueprintTaskReconciliation}
        onCopy={onCopyBlueprintTaskReconciliation}
        onClear={onClearBlueprintTaskReconciliation}
        copyState={taskReconciliationCopyState}
      />

      <TaskArtifactIndexPanel
        taskCards={blueprint.phaseTaskCards.saved}
        artifactIndex={blueprint.taskArtifactIndex}
        onGenerate={onGenerateTaskArtifactIndex}
        onCopy={onCopyTaskArtifactIndex}
        onClear={onClearTaskArtifactIndex}
        onFilterChange={onTaskArtifactIndexFilterChange}
        copyState={taskArtifactIndexCopyState}
      />

      <section className="blueprint-section blueprint-status-summary">
        <h3 className="blueprint-section-title">Blueprint Status</h3>
        <ul className="blueprint-status-list">
          <li>Idea captured: {status.ideaExists ? "yes" : "no"}</li>
          <li>Blueprint imported: {status.blueprintImported ? "yes" : "no"}</li>
          <li>
            Completeness check: {status.completenessCheckExists ? "yes" : "no"}
          </li>
          <li>
            Planning docs preview: {status.planningDocsPreviewExists ? "yes" : "no"}
          </li>
          <li>
            Planning docs exported: {status.planningDocsExported ? "yes" : "no"}
          </li>
          <li>
            Phase 1 handoff: {status.phase1HandoffExists ? "yes" : "no"}
          </li>
          <li>Task cards: {status.taskCardsExist ? "yes" : "no"}</li>
          <li>Active task: {status.activeTaskId ?? "none"}</li>
          <li>Next task: {status.nextTaskId ?? "none"}</li>
          <li>Blocked tasks: {status.blockedTaskCount}</li>
          <li>Ready to send: {status.readyToSendTaskCount}</li>
          <li>
            Task builder handoff: {status.taskBuilderHandoffExists ? "yes" : "no"}
          </li>
          <li>
            Handoff task: {status.taskBuilderHandoffSelectedTaskId ?? "none"}
          </li>
          <li>
            Handoff readiness: {status.taskBuilderHandoffReadiness ?? "n/a"}
          </li>
          <li>Handoff stale: {status.taskBuilderHandoffStale ? "yes" : "no"}</li>
          <li>
            Handoff copied: {status.taskBuilderHandoffCopied ? "yes" : "no"}
          </li>
          <li>
            Implementation reports: {status.taskImplementationReportCount}
          </li>
          <li>
            Active task report:{" "}
            {status.activeTaskHasImplementationReport ? "yes" : "no"}
          </li>
          <li>
            Pending mark returned:{" "}
            {status.pendingMarkImplementationReturned ? "yes" : "no"}
          </li>
          <li>
            Task reconciliation: {status.taskReconciliationExists ? "yes" : "no"}
          </li>
          <li>
            Reconciliation stale: {status.taskReconciliationStale ? "yes" : "no"}
          </li>
          <li>
            Reconciliation recommendation:{" "}
            {status.taskReconciliationRecommendation ?? "n/a"}
          </li>
          <li>
            Missing producers: {status.taskReconciliationMissingProducers}
          </li>
          <li>
            Status inconsistencies: {status.taskReconciliationStatusInconsistencyCount}
          </li>
          <li>
            Task artifact index: {status.taskArtifactIndexExists ? "yes" : "no"}
          </li>
          <li>
            Artifact index stale: {status.taskArtifactIndexStale ? "yes" : "no"}
          </li>
          <li>
            Artifact index recommendation:{" "}
            {status.taskArtifactIndexRecommendation ?? "n/a"}
          </li>
          <li>Unlinked artifacts: {status.taskArtifactIndexUnlinkedCount}</li>
          <li>Stale artifact flags: {status.taskArtifactIndexStaleCount}</li>
          <li>
            Local Planner draft: {status.localPlannerDraftExists ? "yes" : "no"}
          </li>
          <li>
            Local draft saved as Blueprint:{" "}
            {status.localPlannerDraftSavedAsBlueprint ? "yes" : "no"}
          </li>
          <li>Local Planner AI: {status.localPlannerAiStatus}</li>
          <li>
            Readiness: {status.readinessStatus ?? "not checked"}
          </li>
        </ul>
        {blueprint.statusMessage ? (
          <StatusLine>{blueprint.statusMessage}</StatusLine>
        ) : null}
      </section>
    </div>
  );
}
