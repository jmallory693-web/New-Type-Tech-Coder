import { useMemo, type ReactNode } from "react";
import { parseArchitectureRefactorTaskImplementationReportText } from "../../shared/architectureRefactorTasks/parseArchitectureRefactorTaskImplementationReport";
import {
  ARCHITECTURE_REFACTOR_BEHAVIOR_CHANGE_WARNING,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_BUILDER_SOURCES,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_INTAKE_PURPOSE,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_DRAFT_CHARS,
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_FORMAT_REMINDER,
} from "../../shared/architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants";
import { refactorReportStatusLabel } from "../../shared/architectureRefactorTasks/buildArchitectureRefactorTaskImplementationIntakeSummary";
import type {
  ArchitectureRefactorTaskBuilderHandoffState,
  ArchitectureRefactorTaskCardsRecord,
  ArchitectureRefactorTaskImplementationIntakeState,
  ArchitectureRefactorTaskImplementationReportRecord,
} from "../../shared/types";

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

export function ArchitectureRefactorTaskImplementationIntakePanel({
  refactorTaskCards,
  handoff,
  intake,
  reportStatusByTaskId,
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
  refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
  handoff: ArchitectureRefactorTaskBuilderHandoffState;
  intake: ArchitectureRefactorTaskImplementationIntakeState;
  reportStatusByTaskId: Record<string, string>;
  draftText: string;
  onSelectedTaskChange: (taskId: string) => void;
  onBuilderSourceChange: (
    source: (typeof ARCHITECTURE_REFACTOR_IMPLEMENTATION_BUILDER_SOURCES)[number],
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
  const cards = refactorTaskCards?.cards ?? [];
  const handoffTaskId =
    handoff.selectedTaskId ?? handoff.saved?.selectedTaskId ?? null;
  const selectedId =
    intake.selectedTaskId ??
    handoffTaskId ??
    refactorTaskCards?.activeTaskId ??
    cards[0]?.id ??
    "";
  const saved = intake.selectedReport;
  const liveParse = useMemo(
    () =>
      draftText.trim()
        ? parseArchitectureRefactorTaskImplementationReportText(draftText)
        : null,
    [draftText],
  );
  const canSave = Boolean(draftText.trim()) && cards.length > 0 && Boolean(selectedId);

  return (
    <section
      className="blueprint-section"
      data-focus-id="architecture-refactor-task-implementation-intake"
    >
      <h3 className="blueprint-section-title">
        Architecture Refactor Implementation Intake
      </h3>
      <p className="field-value muted">
        {ARCHITECTURE_REFACTOR_IMPLEMENTATION_INTAKE_PURPOSE}
      </p>

      {!refactorTaskCards?.cards.length ? (
        <StatusLine>Generate Architecture Refactor Task Cards first.</StatusLine>
      ) : null}

      <div className="field-value muted">
        <div className="field-label">Suggested report-back format</div>
        <ul className="blueprint-status-list">
          {ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_FORMAT_REMINDER.map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
      </div>

      <div className="blueprint-field-row task-handoff-selectors">
        <label className="field-label">
          Selected refactor task
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
                e.target.value as (typeof ARCHITECTURE_REFACTOR_IMPLEMENTATION_BUILDER_SOURCES)[number],
              )
            }
          >
            {ARCHITECTURE_REFACTOR_IMPLEMENTATION_BUILDER_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field-label">
        Refactor implementation report
        <textarea
          className="request-box"
          value={draftText}
          maxLength={ARCHITECTURE_REFACTOR_IMPLEMENTATION_MAX_DRAFT_CHARS}
          placeholder="Paste the builder's refactor implementation report (analysis, plan, files changed, validation, behavior preservation, risks, safety confirmations, blockers)…"
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

      {liveParse && liveParse.missingBehaviorPreservationChecks.length > 0 && canSave ? (
        <div className="onedrive-warning" role="status">
          Missing behavior-preservation checks:{" "}
          {liveParse.missingBehaviorPreservationChecks.join(", ")}.
        </div>
      ) : null}

      {liveParse?.behaviorChangeWarning && canSave ? (
        <div className="onedrive-warning" role="alert">
          {ARCHITECTURE_REFACTOR_BEHAVIOR_CHANGE_WARNING}
        </div>
      ) : null}

      <div className="blueprint-actions">
        <ActionButton
          label="Save Refactor Implementation Report"
          hint="Store pasted refactor report for the selected task (text only)"
          primary
          disabled={!canSave}
          onClick={onSave}
        />
        <ActionButton
          label="Copy Refactor Implementation Report"
          hint="Copy saved refactor report text"
          disabled={!saved || saved.stale}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Refactor Implementation Report"
          hint="Remove saved refactor report for selected task"
          disabled={!saved}
          onClick={onClear}
        />
        <ActionButton
          label="Mark Refactor Implementation Returned"
          hint="Update refactor task status after reviewing pasted report"
          disabled={!saved || saved.stale || saved.markedImplementationReturned}
          onClick={onMarkReturned}
        />
        <ActionButton
          label="Mark Refactor Reviewed"
          hint="Mark refactor reviewed after implementation report (warns if no Implementation Review)"
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
          Refactor implementation report is stale — refactor cards were cleared or
          regenerated.
        </StatusLine>
      ) : null}
      {copyState === "copied" ? (
        <StatusLine>Refactor Implementation Report copied.</StatusLine>
      ) : null}

      {cards.length > 0 ? (
        <ul className="blueprint-status-list">
          {cards.map((card) => (
            <li key={card.id}>
              {card.id}: report status —{" "}
              {reportStatusByTaskId[card.id] ?? "no report"}
            </li>
          ))}
        </ul>
      ) : null}

      {saved && !saved.stale ? (
        <>
          <ul className="blueprint-status-list">
            <li>Task: {saved.taskId}</li>
            <li>Refactor target: {saved.refactorTarget}</li>
            <li>Builder: {saved.builderSource}</li>
            <li>
              Status:{" "}
              {refactorReportStatusLabel({
                hasReport: true,
                stale: saved.stale,
                markedImplementationReturned: saved.markedImplementationReturned,
                markedReviewed: saved.markedReviewed,
              })}
            </li>
            {saved.detectedFilesChanged.length > 0 ? (
              <li>Files detected: {saved.detectedFilesChanged.length}</li>
            ) : null}
            {saved.missingExpectedSections.length > 0 ? (
              <li>
                Missing sections: {saved.missingExpectedSections.join(", ")}
              </li>
            ) : null}
            {saved.behaviorChangeWarning ? (
              <li>{ARCHITECTURE_REFACTOR_BEHAVIOR_CHANGE_WARNING}</li>
            ) : null}
            {saved.changedFilesScopeWarnings.length > 0 ? (
              <li>
                Changed-files scope warnings: {saved.changedFilesScopeWarnings.length}
              </li>
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

export function buildRefactorReportStatusMap(
  reports: Record<string, ArchitectureRefactorTaskImplementationReportRecord>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [id, report] of Object.entries(reports)) {
    map[id] = refactorReportStatusLabel({
      hasReport: true,
      stale: report.stale,
      markedImplementationReturned: report.markedImplementationReturned,
      markedReviewed: report.markedReviewed,
    });
  }
  return map;
}
