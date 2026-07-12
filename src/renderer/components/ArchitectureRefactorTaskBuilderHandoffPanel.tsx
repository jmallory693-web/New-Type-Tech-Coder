import type { ReactNode } from "react";
import type {
  ArchitectureRefactorTaskBuilderHandoffState,
  ArchitectureRefactorTaskCardsRecord,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
} from "../../shared/types";
import {
  ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS,
  ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_PURPOSE,
  ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TARGET_OPTIONS,
} from "../../shared/architectureRefactorTasks/architectureRefactorTaskBuilderHandoffConstants";
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

export function ArchitectureRefactorTaskBuilderHandoffPanel({
  refactorTaskCards,
  handoff,
  architectureHealthReady,
  onSelectedTaskChange,
  onTargetChange,
  onStrictnessChange,
  onGenerate,
  onCopy,
  onClear,
  copyState,
}: {
  refactorTaskCards: ArchitectureRefactorTaskCardsRecord | null;
  handoff: ArchitectureRefactorTaskBuilderHandoffState;
  architectureHealthReady: boolean;
  onSelectedTaskChange: (taskId: string) => void;
  onTargetChange: (target: BuilderHandoffTarget) => void;
  onStrictnessChange: (strictness: BuilderHandoffStrictness) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onClear: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const cards = refactorTaskCards?.cards ?? [];
  const selectedId =
    handoff.selectedTaskId ??
    refactorTaskCards?.activeTaskId ??
    cards[0]?.id ??
    "";
  const saved = handoff.saved;

  return (
    <section
      className="blueprint-section"
      data-focus-id="architecture-refactor-task-builder-handoff"
    >
      <h3 className="blueprint-section-title">
        Architecture Refactor Builder Handoff
      </h3>
      <p className="field-value muted">
        {ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_PURPOSE}
      </p>

      {!refactorTaskCards?.cards.length ? (
        <StatusLine>Generate Architecture Refactor Task Cards first.</StatusLine>
      ) : null}

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
          Handoff target
          <select
            className="field-input"
            value={handoff.target}
            onChange={(e) =>
              onTargetChange(e.target.value as BuilderHandoffTarget)
            }
          >
            {ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TARGET_OPTIONS.map(
              (o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ),
            )}
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
            {ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_STRICTNESS_OPTIONS.map(
              (o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <div className="blueprint-actions">
        <ActionButton
          label="Generate Refactor Builder Handoff"
          hint="Rule-based handoff from selected refactor task card only"
          primary
          disabled={
            !refactorTaskCards?.cards.length ||
            !architectureHealthReady ||
            !selectedId
          }
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Refactor Builder Handoff"
          hint="Copies markdown — does not send automatically"
          disabled={!saved || saved.stale}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Refactor Builder Handoff"
          hint="Remove generated handoff from session"
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {!architectureHealthReady ? (
        <StatusLine>
          Generate a current Architecture Health Report before creating a refactor
          handoff.
        </StatusLine>
      ) : null}
      {!selectedId && refactorTaskCards?.cards.length ? (
        <StatusLine>
          Select a refactor task card before generating a handoff.
        </StatusLine>
      ) : null}
      {handoff.statusMessage ? (
        <StatusLine>{handoff.statusMessage}</StatusLine>
      ) : null}
      {saved?.stale ? (
        <StatusLine>
          Previous handoff is stale — regenerate after refactor cards or Architecture
          Health changes.
        </StatusLine>
      ) : null}
      {copyState === "copied" ? (
        <StatusLine>Architecture Refactor Builder Handoff copied.</StatusLine>
      ) : null}
      {handoff.suggestedNextStatus && saved && !saved.stale ? (
        <StatusLine>{handoff.suggestedNextStatus}</StatusLine>
      ) : null}

      {saved && !saved.stale ? (
        <>
          <ul className="blueprint-status-list">
            <li>
              Readiness:{" "}
              {ARCHITECTURE_REFACTOR_HANDOFF_READINESS_LABELS[saved.readiness] ??
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
              This refactor task is too broad for safe implementation. Ask the
              builder for a narrower plan first.
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
