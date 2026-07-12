import type { ArchitectureRefactorTaskCardsState } from "../../shared/types";
import {
  TASK_CARD_STATUS_LABELS,
  type ArchitectureRefactorTaskCardStatus,
} from "../../shared/architectureRefactorTasks/architectureRefactorTaskConstants";
import { labelForArchitectureRefactorTaskQuality } from "../../shared/architectureRefactorTasks/assessArchitectureRefactorTaskQuality";

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

function qualityClass(quality: string): string {
  switch (quality) {
    case "good":
      return "task-card-quality-good";
    case "too-broad":
      return "task-card-quality-broad";
    case "blocked":
      return "task-card-quality-blocked";
    default:
      return "task-card-quality-warn";
  }
}

export function ArchitectureRefactorTaskCardsPanel({
  refactorTaskCards,
  architectureHealthReady,
  architectureHealthStale,
  reportStatusByTaskId,
  onGenerate,
  onCopyAll,
  onClear,
  onCopyTask,
  onSetStatus,
  onResetStatus,
  copyAllState,
  copyTaskState,
}: {
  refactorTaskCards: ArchitectureRefactorTaskCardsState;
  architectureHealthReady: boolean;
  architectureHealthStale: boolean;
  reportStatusByTaskId?: Record<string, string>;
  onGenerate: () => void;
  onCopyAll: () => void;
  onClear: () => void;
  onCopyTask: (taskId: string) => void;
  onSetStatus: (taskId: string, status: ArchitectureRefactorTaskCardStatus) => void;
  onResetStatus: (taskId: string) => void;
  copyAllState: "idle" | "copied" | "failed";
  copyTaskState: Record<string, "idle" | "copied" | "failed">;
}) {
  const record = refactorTaskCards.saved;
  const blockedCount = record?.cards.filter((c) => c.status === "blocked").length ?? 0;
  const reviewedCount = record?.cards.filter((c) => c.status === "reviewed").length ?? 0;

  return (
    <section className="blueprint-section" data-focus-id="architecture-refactor-task-cards">
      <h3 className="blueprint-section-title">Architecture Refactor Task Cards</h3>
      <p className="field-value muted">
        Planning-only refactor task cards from Architecture Health metadata. No
        refactor performed, no AI, no source reads, no automatic sends.
      </p>
      <div className="blueprint-actions">
        <ActionButton
          label="Generate Refactor Task Cards"
          hint="Build 3–8 narrow refactor planning cards from Architecture Health"
          primary
          disabled={!architectureHealthReady || architectureHealthStale}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy All Refactor Task Cards"
          hint="Copy all refactor task card markdown"
          disabled={!record}
          onClick={onCopyAll}
        />
        <ActionButton
          label="Clear Refactor Task Cards"
          hint="Remove generated refactor task cards from session"
          disabled={!record}
          onClick={onClear}
        />
      </div>
      {!architectureHealthReady ? (
        <p className="field-value muted blueprint-status-line">
          Generate an Architecture Health Report first.
        </p>
      ) : null}
      {architectureHealthStale ? (
        <p className="field-value muted blueprint-status-line">
          Architecture Health Report is stale — regenerate before creating refactor
          task cards.
        </p>
      ) : null}
      {refactorTaskCards.statusMessage ? (
        <p className="field-value muted blueprint-status-line">
          {refactorTaskCards.statusMessage}
        </p>
      ) : null}
      {copyAllState === "copied" ? (
        <p className="field-value muted blueprint-status-line">
          All refactor task cards copied.
        </p>
      ) : null}
      {record ? (
        <>
          {record.stale ? (
            <p className="field-value muted blueprint-status-line">
              Refactor task cards are stale — regenerate after Architecture Health
              updates.
            </p>
          ) : null}
          <ul className="blueprint-status-list task-card-meta-list">
            <li>Task count: {record.taskCount}</li>
            <li>Active task: {record.activeTaskId ?? "none"}</li>
            <li>Reviewed: {reviewedCount}</li>
            <li>Blocked: {blockedCount}</li>
          </ul>
          <div className="task-card-list">
            {record.cards.map((card) => (
              <article key={card.id} className="task-card-item">
                <header className="task-card-header">
                  <h4>
                    {card.id} — {card.title}
                  </h4>
                  <span
                    className={`task-card-quality ${qualityClass(card.quality)}`}
                  >
                    Quality: {labelForArchitectureRefactorTaskQuality(card.quality)}
                  </span>
                  <span className="task-card-status">
                    Status: {TASK_CARD_STATUS_LABELS[card.status]}
                  </span>
                  {reportStatusByTaskId?.[card.id] ? (
                    <span className="task-card-status">
                      Report: {reportStatusByTaskId[card.id]}
                    </span>
                  ) : null}
                </header>
                {card.qualityFlags.length > 0 ? (
                  <p className="field-value muted task-card-flags">
                    Flags: {card.qualityFlags.join(", ")}
                  </p>
                ) : null}
                <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
                  Target: {card.refactorTarget} · Risk: {card.currentRisk}
                </p>
                <div className="blueprint-actions task-card-actions">
                  <ActionButton
                    label="Copy This Refactor Task"
                    hint="Copy this refactor task card markdown"
                    onClick={() => onCopyTask(card.id)}
                  />
                  <ActionButton
                    label="Mark Planned"
                    hint="Metadata only"
                    onClick={() => onSetStatus(card.id, "planned")}
                  />
                  <ActionButton
                    label="Mark Sent to Builder"
                    hint="Metadata only — does not send automatically"
                    onClick={() => onSetStatus(card.id, "sent-to-builder")}
                  />
                  <ActionButton
                    label="Mark Implementation Returned"
                    hint="Metadata only"
                    onClick={() =>
                      onSetStatus(card.id, "implementation-returned")
                    }
                  />
                  <ActionButton
                    label="Mark Reviewed"
                    hint="Metadata only"
                    onClick={() => onSetStatus(card.id, "reviewed")}
                  />
                  <ActionButton
                    label="Reset Status"
                    hint="Reset to Drafted"
                    onClick={() => onResetStatus(card.id)}
                  />
                </div>
                {copyTaskState[card.id] === "copied" ? (
                  <p className="field-value muted">Copied.</p>
                ) : null}
                <pre className="preview-box task-card-preview">{card.markdown}</pre>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
