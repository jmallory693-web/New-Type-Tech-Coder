import type {
  BlueprintPhaseTaskCardsRecord,
  ChangedFilesScanResult,
  ChangedFilesTaskLinkState,
} from "../../shared/types";
import { formatChangedFilesTaskSuggestion } from "../../shared/suggestChangedFilesTaskLink";

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

export function ChangedFilesTaskLinkPanel({
  taskCards,
  lastScan,
  taskLink,
  onSelectTask,
  onLink,
  onClear,
}: {
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  lastScan: ChangedFilesScanResult | null;
  taskLink: ChangedFilesTaskLinkState;
  onSelectTask: (taskId: string) => void;
  onLink: () => void;
  onClear: () => void;
}) {
  const cards = taskCards?.cards ?? [];
  const hasCards = cards.length > 0;
  const hasScan = Boolean(lastScan?.scannedAt && lastScan.isGitRepo);
  const saved = taskLink.saved;
  const suggestionText = formatChangedFilesTaskSuggestion({
    taskId: taskLink.suggestedTaskId,
    reason: taskLink.suggestedReason,
  });

  return (
    <div className="stack" style={{ marginTop: "0.75rem" }}>
      <div className="field-label">Blueprint Task Link</div>
      <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
        Associate read-only changed-file metadata with a Blueprint task ID.
        Metadata only — no source reads, no auto-link.
      </p>

      {!hasCards ? (
        <p className="field-value muted">Generate Blueprint Phase Task Cards first.</p>
      ) : null}
      {hasCards && !hasScan ? (
        <p className="field-value muted">
          Generate a Changed Files / Patch Review Pack first.
        </p>
      ) : null}

      {suggestionText ? (
        <p className="field-value muted">{suggestionText}</p>
      ) : null}

      <label className="field-label">
        Selected task
        <select
          className="field-input"
          value={taskLink.selectedTaskId ?? ""}
          disabled={!hasCards}
          onChange={(e) => {
            if (e.target.value) onSelectTask(e.target.value);
          }}
        >
          <option value="">Select a task…</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} — {c.title}
            </option>
          ))}
        </select>
      </label>

      <div className="stack">
        <ActionButton
          label="Link Current Changed Files Metadata to Selected Task"
          hint="Stores safe changed-file paths/counts with the selected task (manual only)."
          primary
          disabled={!hasCards || !hasScan || !taskLink.selectedTaskId}
          onClick={onLink}
        />
        <ActionButton
          label="Clear Changed Files Task Link"
          hint="Remove the stored task link metadata."
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {saved ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          Linked: {saved.taskId}
          {saved.taskTitle ? ` — ${saved.taskTitle}` : ""} ·{" "}
          {saved.changedFilesCount ?? 0} file(s) · linked{" "}
          {new Date(saved.linkedAt).toLocaleString()}
          {saved.stale ? " · stale" : ""}
          {(saved.warnings?.length ?? 0) > 0
            ? ` · ${saved.warnings!.length} scope warning(s)`
            : ""}
        </div>
      ) : null}

      {saved?.warnings?.length ? (
        <div className="onedrive-warning" role="status">
          Scope warnings: {saved.warnings.join(" ")}
        </div>
      ) : null}

      {taskLink.statusMessage ? (
        <p className="field-value muted">{taskLink.statusMessage}</p>
      ) : null}
    </div>
  );
}
