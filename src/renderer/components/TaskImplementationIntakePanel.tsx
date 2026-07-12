import { useMemo, type ReactNode } from "react";
import { parseTaskImplementationReportText } from "../../shared/parseTaskImplementationReport";
import type {
  BlueprintPhaseTaskCardsRecord,
  TaskCardBuilderHandoffState,
  TaskImplementationIntakeState,
} from "../../shared/types";
import {
  TASK_IMPLEMENTATION_BUILDER_SOURCES,
  TASK_IMPLEMENTATION_INTAKE_PURPOSE,
  TASK_IMPLEMENTATION_MAX_DRAFT_CHARS,
  TASK_IMPLEMENTATION_REPORT_FORMAT_REMINDER,
} from "../../shared/taskImplementationIntakeConstants";

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

export function TaskImplementationIntakePanel({
  taskCards,
  handoff,
  intake,
  draftText,
  onSelectedTaskChange,
  onBuilderSourceChange,
  onDraftChange,
  onSave,
  onCopy,
  onClear,
  onMarkReturned,
  onMarkReviewed,
  onStageForReview,
  copyState,
}: {
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  handoff: TaskCardBuilderHandoffState;
  intake: TaskImplementationIntakeState;
  draftText: string;
  onSelectedTaskChange: (taskId: string) => void;
  onBuilderSourceChange: (
    source: (typeof TASK_IMPLEMENTATION_BUILDER_SOURCES)[number],
  ) => void;
  onDraftChange: (text: string) => void;
  onSave: () => void;
  onCopy: () => void;
  onClear: () => void;
  onMarkReturned: () => void;
  onMarkReviewed: () => void;
  onStageForReview: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const cards = taskCards?.cards ?? [];
  const handoffTaskId =
    handoff.selectedTaskId ?? handoff.saved?.selectedTaskId ?? null;
  const selectedId =
    intake.selectedTaskId ??
    handoffTaskId ??
    taskCards?.activeTaskId ??
    cards[0]?.id ??
    "";
  const saved = intake.selectedReport;
  const liveParse = useMemo(
    () => (draftText.trim() ? parseTaskImplementationReportText(draftText) : null),
    [draftText],
  );
  const canSave = Boolean(draftText.trim()) && cards.length > 0 && Boolean(selectedId);

  return (
    <section className="blueprint-section">
      <h3 className="blueprint-section-title">Task Implementation Intake</h3>
      <p className="field-value muted">{TASK_IMPLEMENTATION_INTAKE_PURPOSE}</p>

      {!taskCards?.cards.length ? (
        <StatusLine>Generate Blueprint Phase Task Cards first.</StatusLine>
      ) : null}

      <div className="field-value muted">
        <div className="field-label">Suggested report-back format</div>
        <ul className="blueprint-status-list">
          {TASK_IMPLEMENTATION_REPORT_FORMAT_REMINDER.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="blueprint-field-row task-handoff-selectors">
        <label className="field-label">
          Selected task
          <select
            className="field-input"
            value={selectedId}
            disabled={cards.length === 0}
            onChange={(e) => onSelectedTaskChange(e.target.value)}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Builder / source
          <select
            className="field-input"
            value={intake.builderSource}
            onChange={(e) =>
              onBuilderSourceChange(
                e.target.value as (typeof TASK_IMPLEMENTATION_BUILDER_SOURCES)[number],
              )
            }
          >
            {TASK_IMPLEMENTATION_BUILDER_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field-label">
        Implementation report
        <textarea
          className="request-box"
          value={draftText}
          maxLength={TASK_IMPLEMENTATION_MAX_DRAFT_CHARS}
          placeholder="Paste the builder's implementation report (summary, files changed, validation, risks, safety confirmations, blockers)…"
          onChange={(e) => onDraftChange(e.target.value)}
        />
      </label>

      {liveParse?.blockedBySecrets && canSave ? (
        <div className="onedrive-warning" role="alert">
          Possible secret detected. Redact secrets before saving, or explicitly
          confirm override if allowed.
        </div>
      ) : null}

      {liveParse && liveParse.missingExpectedSections.length > 0 && canSave ? (
        <div className="onedrive-warning" role="status">
          Missing sections ({liveParse.missingExpectedSections.length}):{" "}
          {liveParse.missingExpectedSections.join(", ")}. You can still save.
        </div>
      ) : null}

      <div className="blueprint-actions">
        <ActionButton
          label="Save Task Implementation Report"
          hint="Store pasted report for the selected task (text only)"
          primary
          disabled={!canSave}
          onClick={onSave}
        />
        <ActionButton
          label="Copy Task Implementation Report"
          hint="Copy saved report text"
          disabled={!saved || saved.stale}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Task Implementation Report"
          hint="Remove saved report for selected task"
          disabled={!saved}
          onClick={onClear}
        />
        <ActionButton
          label="Mark Task Implementation Returned"
          hint="Update task status after reviewing pasted report"
          disabled={!saved || saved.stale || saved.markedImplementationReturned}
          onClick={onMarkReturned}
        />
        <ActionButton
          label="Mark Task Reviewed"
          hint="Mark task reviewed after implementation report (warns if no Implementation Review)"
          disabled={!saved || saved.stale || saved.markedReviewed}
          onClick={onMarkReviewed}
        />
        <ActionButton
          label="Use this report for Implementation Review"
          hint="Stages report into Builder Result as Implementation report — does not auto-run review"
          disabled={!saved || saved.stale}
          onClick={onStageForReview}
        />
      </div>

      {intake.statusMessage ? <StatusLine>{intake.statusMessage}</StatusLine> : null}
      {intake.suggestedMarkReturned ? (
        <StatusLine>{intake.suggestedMarkReturned}</StatusLine>
      ) : null}
      {intake.nextTaskSuggestion ? (
        <StatusLine>{intake.nextTaskSuggestion}</StatusLine>
      ) : null}
      {saved?.stale ? (
        <StatusLine>
          Implementation report is stale — task card was cleared or regenerated.
        </StatusLine>
      ) : null}
      {copyState === "copied" ? (
        <StatusLine>Task Implementation Report copied.</StatusLine>
      ) : null}

      {saved && !saved.stale ? (
        <>
          <ul className="blueprint-status-list">
            <li>Task: {saved.taskId}</li>
            <li>Builder: {saved.builderSource}</li>
            <li>
              Status:{" "}
              {saved.markedReviewed
                ? "Reviewed"
                : saved.markedImplementationReturned
                  ? "Implementation returned"
                  : "Saved"}
            </li>
            {saved.detectedFilesChanged.length > 0 ? (
              <li>Files detected: {saved.detectedFilesChanged.length}</li>
            ) : null}
            {saved.missingExpectedSections.length > 0 ? (
              <li>Missing sections: {saved.missingExpectedSections.join(", ")}</li>
            ) : null}
            {saved.truncationFlag ? <li>Truncated at save: yes</li> : null}
          </ul>
          <pre className="blueprint-preview blueprint-preview-tall">
            {saved.summaryMarkdown}
          </pre>
        </>
      ) : null}
    </section>
  );
}
