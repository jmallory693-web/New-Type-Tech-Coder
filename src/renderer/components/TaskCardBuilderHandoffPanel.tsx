import type { ReactNode } from "react";
import type {
  BlueprintPhaseTaskCardsRecord,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
  TaskCardBuilderHandoffState,
} from "../../shared/types";
import {
  TASK_CARD_BUILDER_HANDOFF_PURPOSE,
  TASK_CARD_BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  TASK_CARD_BUILDER_HANDOFF_TARGET_OPTIONS,
  TASK_CARD_HANDOFF_READINESS_LABELS,
} from "../../shared/taskCardBuilderHandoffConstants";
import { getBuilderHandoffTargetLabel } from "../../shared/builderHandoffTargetWording";

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

export function TaskCardBuilderHandoffPanel({
  taskCards,
  handoff,
  blueprintImported,
  onSelectedTaskChange,
  onTargetChange,
  onStrictnessChange,
  onGenerate,
  onCopy,
  onClear,
  copyState,
}: {
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  handoff: TaskCardBuilderHandoffState;
  blueprintImported: boolean;
  onSelectedTaskChange: (taskId: string) => void;
  onTargetChange: (target: BuilderHandoffTarget) => void;
  onStrictnessChange: (strictness: BuilderHandoffStrictness) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onClear: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const cards = taskCards?.cards ?? [];
  const selectedId =
    handoff.selectedTaskId ?? taskCards?.activeTaskId ?? cards[0]?.id ?? "";
  const saved = handoff.saved;

  return (
    <section className="blueprint-section">
      <h3 className="blueprint-section-title">Task Card Builder Handoff</h3>
      <p className="field-value muted">{TASK_CARD_BUILDER_HANDOFF_PURPOSE}</p>

      {!taskCards?.cards.length ? (
        <StatusLine>Generate Blueprint Phase Task Cards first.</StatusLine>
      ) : null}

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
          Handoff target
          <select
            className="field-input"
            value={handoff.target}
            onChange={(e) =>
              onTargetChange(e.target.value as BuilderHandoffTarget)
            }
          >
            {TASK_CARD_BUILDER_HANDOFF_TARGET_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Strictness
          <select
            className="field-input"
            value={handoff.strictness}
            onChange={(e) =>
              onStrictnessChange(e.target.value as BuilderHandoffStrictness)
            }
          >
            {TASK_CARD_BUILDER_HANDOFF_STRICTNESS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="blueprint-actions">
        <ActionButton
          label="Generate Task Builder Handoff"
          hint="Rule-based handoff from selected task card only"
          primary
          disabled={!taskCards?.cards.length || !blueprintImported || !selectedId}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Task Builder Handoff"
          hint="Copies markdown — does not send automatically"
          disabled={!saved || saved.stale}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Task Builder Handoff"
          hint="Remove generated handoff from session"
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {!blueprintImported ? (
        <StatusLine>
          Save or import a Project Blueprint before generating task handoff.
        </StatusLine>
      ) : null}
      {!selectedId && taskCards?.cards.length ? (
        <StatusLine>Select a task card before generating a handoff.</StatusLine>
      ) : null}
      {handoff.statusMessage ? (
        <StatusLine>{handoff.statusMessage}</StatusLine>
      ) : null}
      {saved?.stale ? (
        <StatusLine>
          Previous handoff is stale — regenerate after task card changes.
        </StatusLine>
      ) : null}
      {copyState === "copied" ? (
        <StatusLine>Task Builder Handoff copied.</StatusLine>
      ) : null}
      {handoff.suggestedNextStatus && saved && !saved.stale ? (
        <StatusLine>{handoff.suggestedNextStatus}</StatusLine>
      ) : null}

      {saved && !saved.stale ? (
        <>
          <ul className="blueprint-status-list">
            <li>
              Readiness:{" "}
              {TASK_CARD_HANDOFF_READINESS_LABELS[saved.readiness] ??
                saved.readiness}
            </li>
            <li>Recommendation: {saved.recommendation}</li>
            <li>Target: {getBuilderHandoffTargetLabel(saved.target)}</li>
            <li>Strictness: {saved.strictness}</li>
            <li>Task: {saved.selectedTaskId}</li>
            {saved.copiedAt ? <li>Copied: yes</li> : <li>Copied: no</li>}
          </ul>
          {saved.tooBroadWarning ? (
            <StatusLine>
              This task is too broad for safe implementation. Ask the builder for
              a narrower plan first.
            </StatusLine>
          ) : null}
          <pre className="blueprint-preview blueprint-preview-tall">
            {saved.markdown}
          </pre>
        </>
      ) : null}
    </section>
  );
}
