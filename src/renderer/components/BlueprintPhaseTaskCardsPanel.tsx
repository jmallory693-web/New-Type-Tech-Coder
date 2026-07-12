import type { ReactNode } from "react";
import type { BlueprintPhaseTaskCardsState } from "../../shared/types";
import {
  TASK_CARD_STATUS_LABELS,
  type BlueprintPhaseTaskCardStatus,
} from "../../shared/blueprintTaskCardConstants";
import { labelForTaskCardQuality } from "../../shared/assessBlueprintTaskCardQuality";

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

export function BlueprintPhaseTaskCardsPanel({
  phaseTaskCards,
  blueprintImported,
  status,
  onGenerate,
  onCopyAll,
  onClear,
  onCopyTask,
  onSetStatus,
  onResetStatus,
  onSetActive,
  copyAllState,
  copyTaskState,
}: {
  phaseTaskCards: BlueprintPhaseTaskCardsState;
  blueprintImported: boolean;
  status: {
    activeTaskId: string | null;
    nextTaskId: string | null;
    blockedTaskCount: number;
    readyToSendTaskCount: number;
  };
  onGenerate: () => void;
  onCopyAll: () => void;
  onClear: () => void;
  onCopyTask: (taskId: string) => void;
  onSetStatus: (taskId: string, status: BlueprintPhaseTaskCardStatus) => void;
  onResetStatus: (taskId: string) => void;
  onSetActive: (taskId: string) => void;
  copyAllState: "idle" | "copied" | "failed";
  copyTaskState: Record<string, "idle" | "copied" | "failed">;
}) {
  const record = phaseTaskCards.saved;

  return (
    <section className="blueprint-section">
      <h3 className="blueprint-section-title">Blueprint Phase Task Cards</h3>
      <p className="field-value muted">
        Rule-based task cards from saved blueprint — planning text only. No AI,
        no source reads, no automatic sends.
      </p>
      <div className="blueprint-actions">
        <ActionButton
          label="Generate Phase Task Cards"
          hint="Break blueprint into 4–8 builder-ready planning packets"
          primary
          disabled={!blueprintImported}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy All Task Cards"
          hint="Copies all task card markdown"
          disabled={!record}
          onClick={onCopyAll}
        />
        <ActionButton
          label="Clear Task Cards"
          hint="Remove generated task cards from session"
          disabled={!record}
          onClick={onClear}
        />
      </div>
      {!blueprintImported ? (
        <StatusLine>
          Save or import a Project Blueprint before generating task cards.
        </StatusLine>
      ) : null}
      {phaseTaskCards.statusMessage ? (
        <StatusLine>{phaseTaskCards.statusMessage}</StatusLine>
      ) : null}
      {copyAllState === "copied" ? (
        <StatusLine>All task cards copied.</StatusLine>
      ) : null}
      {record ? (
        <>
          <ul className="blueprint-status-list task-card-meta-list">
            <li>Task count: {record.taskCount}</li>
            <li>Active task: {status.activeTaskId ?? "none"}</li>
            <li>Next task: {status.nextTaskId ?? "none"}</li>
            <li>Blocked: {status.blockedTaskCount}</li>
            <li>Ready to send: {status.readyToSendTaskCount}</li>
          </ul>
          {record.incompleteBlueprintWarning ? (
            <StatusLine>
              Blueprint is incomplete. Task cards may be planning-only until
              missing sections are filled.
            </StatusLine>
          ) : null}
          {record.missingPhase1Warning ? (
            <StatusLine>
              Phase 1 Builder Handoff not generated — cards use blueprint
              context only.
            </StatusLine>
          ) : null}
          {record.tooManyTasksWarning ? (
            <StatusLine>
              Task list was capped — consider splitting phases in the blueprint.
            </StatusLine>
          ) : null}
          <div className="task-card-list">
            {record.cards.map((card) => {
              const isActive = card.id === record.activeTaskId;
              return (
                <article
                  key={card.id}
                  className={
                    isActive ? "task-card-item task-card-active" : "task-card-item"
                  }
                >
                  <header className="task-card-header">
                    <h4>
                      {card.id} — {card.title}
                    </h4>
                    <span
                      className={`task-card-quality ${qualityClass(card.quality)}`}
                    >
                      Quality: {labelForTaskCardQuality(card.quality)}
                    </span>
                    <span className="task-card-status">
                      Status: {TASK_CARD_STATUS_LABELS[card.status]}
                    </span>
                  </header>
                  {card.qualityFlags.length > 0 ? (
                    <p className="field-value muted task-card-flags">
                      Flags: {card.qualityFlags.join(", ")}
                    </p>
                  ) : null}
                  <div className="blueprint-actions task-card-actions">
                    <ActionButton
                      label="Copy This Task"
                      hint="Copy this task card markdown"
                      onClick={() => onCopyTask(card.id)}
                    />
                    <ActionButton
                      label="Set Active"
                      hint="Mark as current focus task"
                      onClick={() => onSetActive(card.id)}
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
                      hint="Builder work returned for review"
                      onClick={() =>
                        onSetStatus(card.id, "implementation-returned")
                      }
                    />
                    <ActionButton
                      label="Mark Reviewed"
                      hint="Task reviewed and accepted"
                      onClick={() => onSetStatus(card.id, "reviewed")}
                    />
                    <ActionButton
                      label="Reset Status"
                      hint="Reset to Drafted"
                      onClick={() => onResetStatus(card.id)}
                    />
                  </div>
                  {copyTaskState[card.id] === "copied" ? (
                    <StatusLine>Task {card.id} copied.</StatusLine>
                  ) : null}
                  <pre className="blueprint-preview blueprint-preview-tall task-card-preview">
                    {card.markdown}
                  </pre>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
