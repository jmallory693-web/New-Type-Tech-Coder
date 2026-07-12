import type { ReactNode } from "react";
import type {
  BlueprintPhaseTaskCardsRecord,
  TaskArtifactIndexState,
} from "../../shared/types";
import {
  TASK_ARTIFACT_INDEX_PURPOSE,
  TASK_ARTIFACT_INDEX_REPORT_TITLE,
} from "../../shared/taskJoinKeyConstants";

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

export function TaskArtifactIndexPanel({
  taskCards,
  artifactIndex,
  onGenerate,
  onCopy,
  onClear,
  onFilterChange,
  copyState,
}: {
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  artifactIndex: TaskArtifactIndexState;
  onGenerate: () => void;
  onCopy: () => void;
  onClear: () => void;
  onFilterChange: (taskId: string | null) => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const saved = artifactIndex.saved;
  const hasCards = Boolean(taskCards?.cards.length);
  const cards = taskCards?.cards ?? [];

  return (
    <section className="blueprint-section">
      <h3 className="blueprint-section-title">Task Artifact Index</h3>
      <p className="field-value muted">{TASK_ARTIFACT_INDEX_PURPOSE}</p>

      <label className="field-label">
        Task filter
        <select
          className="field-input"
          value={artifactIndex.filterTaskId ?? ""}
          onChange={(e) =>
            onFilterChange(e.target.value ? e.target.value : null)
          }
        >
          <option value="">Show all tasks</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} — {c.title}
            </option>
          ))}
        </select>
      </label>

      <div className="blueprint-actions">
        <ActionButton
          label="Generate Task Artifact Index"
          hint="Rule-based index of task cards, handoffs, reports, and reviews by task ID"
          primary
          disabled={!hasCards}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Task Artifact Index"
          hint="Copies markdown — does not send automatically"
          disabled={!saved || saved.stale}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Task Artifact Index"
          hint="Remove saved artifact index from session"
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {!hasCards ? (
        <StatusLine>Generate Blueprint Phase Task Cards first.</StatusLine>
      ) : null}
      {artifactIndex.statusMessage ? (
        <StatusLine>{artifactIndex.statusMessage}</StatusLine>
      ) : null}
      {saved?.stale ? (
        <StatusLine>
          Task artifacts changed after this index was generated. Regenerate Task
          Artifact Index.
        </StatusLine>
      ) : null}
      {copyState === "copied" ? (
        <StatusLine>Task Artifact Index copied.</StatusLine>
      ) : null}
      {copyState === "failed" ? (
        <StatusLine>Clipboard copy failed — copy manually from preview.</StatusLine>
      ) : null}

      {saved && !saved.stale ? (
        <>
          <ul className="blueprint-status-list">
            <li>Recommendation: {saved.recommendation}</li>
            <li>Tasks: {saved.taskCount}</li>
            <li>Linked artifacts: {saved.linkedArtifactCount}</li>
            <li>Unlinked flags: {saved.unlinkedArtifactCount}</li>
            <li>Stale flags: {saved.staleArtifactCount}</li>
            <li>Filter: {saved.filterTaskId ?? "all tasks"}</li>
          </ul>
          <pre className="blueprint-preview blueprint-preview-tall">
            {saved.previewExcerpt || saved.markdown.slice(0, 2000)}
          </pre>
          <StatusLine>Report title: {TASK_ARTIFACT_INDEX_REPORT_TITLE}</StatusLine>
        </>
      ) : null}
    </section>
  );
}
