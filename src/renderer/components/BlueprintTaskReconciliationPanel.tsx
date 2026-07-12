import type { ReactNode } from "react";
import type {
  BlueprintPhaseTaskCardsRecord,
  BlueprintTaskReconciliationState,
} from "../../shared/types";
import {
  TASK_RECONCILIATION_PURPOSE,
  TASK_RECONCILIATION_REPORT_TITLE,
} from "../../shared/taskReconciliationConstants";

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

export function BlueprintTaskReconciliationPanel({
  taskCards,
  reconciliation,
  onGenerate,
  onCopy,
  onClear,
  copyState,
}: {
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  reconciliation: BlueprintTaskReconciliationState;
  onGenerate: () => void;
  onCopy: () => void;
  onClear: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const saved = reconciliation.saved;
  const hasCards = Boolean(taskCards?.cards.length);

  return (
    <section className="blueprint-section">
      <h3 className="blueprint-section-title">Blueprint Task Reconciliation</h3>
      <p className="field-value muted">{TASK_RECONCILIATION_PURPOSE}</p>

      <div className="blueprint-actions">
        <ActionButton
          label="Generate Reconciliation Report"
          hint="Rule-based cross-card reconciliation from stored planning artifacts only"
          primary
          disabled={!hasCards}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Reconciliation Report"
          hint="Copies markdown — does not send automatically"
          disabled={!saved || saved.stale}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Reconciliation Report"
          hint="Remove saved reconciliation report from session"
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {!hasCards ? (
        <StatusLine>Generate Blueprint Phase Task Cards first.</StatusLine>
      ) : null}
      {reconciliation.statusMessage ? (
        <StatusLine>{reconciliation.statusMessage}</StatusLine>
      ) : null}
      {saved?.stale ? (
        <StatusLine>
          Task cards changed after this reconciliation report. Regenerate report.
        </StatusLine>
      ) : null}
      {saved?.contractFieldsMissing ? (
        <StatusLine>
          Task cards are missing contract fields. Reconciliation can still check
          safety/status, but producer/consumer checks are limited.
        </StatusLine>
      ) : null}
      {copyState === "copied" ? (
        <StatusLine>Reconciliation report copied.</StatusLine>
      ) : null}
      {copyState === "failed" ? (
        <StatusLine>Clipboard copy failed — copy manually from preview.</StatusLine>
      ) : null}

      {saved && !saved.stale ? (
        <>
          <ul className="blueprint-status-list">
            <li>Recommendation: {saved.recommendation}</li>
            <li>Task cards: {saved.taskCardCount}</li>
            <li>Missing producers: {saved.missingProducerCount}</li>
            <li>Duplicate/overlap flags: {saved.duplicateOverlapCount}</li>
            <li>Monolith risk flags: {saved.monolithRiskCount}</li>
            <li>Status inconsistencies: {saved.statusInconsistencyCount}</li>
            <li>
              Implementation inconsistencies: {saved.implementationInconsistencyCount}
            </li>
          </ul>
          <pre className="blueprint-preview blueprint-preview-tall">
            {saved.previewExcerpt || saved.markdown.slice(0, 2000)}
          </pre>
          <StatusLine>Report title: {TASK_RECONCILIATION_REPORT_TITLE}</StatusLine>
        </>
      ) : null}
    </section>
  );
}
