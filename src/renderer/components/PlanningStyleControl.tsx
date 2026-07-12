import type { PlanningStyleId, PlanningStyleState } from "../../shared/types";
import {
  PLANNING_STYLE_OPTIONS,
  SMALL_MODEL_FRIENDLY_HELPER_NOTE,
  getPlanningStyleStatusLine,
} from "../../shared/planningStyle";

export function PlanningStyleControl({
  planningStyle,
  onStyleChange,
}: {
  planningStyle: PlanningStyleState;
  onStyleChange: (style: PlanningStyleId) => void;
}) {
  const statusLine = getPlanningStyleStatusLine(planningStyle.style);

  return (
    <div className="stack" data-focus-id="planning-style">
      <div>
        <div className="field-label">Planning Style</div>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {SMALL_MODEL_FRIENDLY_HELPER_NOTE}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="planning-style-select">
          Planning style preset
        </label>
        <select
          id="planning-style-select"
          className="settings-input"
          value={planningStyle.style}
          onChange={(event) =>
            onStyleChange(event.target.value as PlanningStyleId)
          }
        >
          {PLANNING_STYLE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {statusLine ? (
        <div className="field-value" style={{ fontSize: "0.82rem" }}>
          {statusLine}
        </div>
      ) : null}

      {planningStyle.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {planningStyle.statusMessage}
        </div>
      ) : null}
    </div>
  );
}

export function PlanningStyleStatusLine({
  style,
}: {
  style: PlanningStyleId;
}) {
  const line = getPlanningStyleStatusLine(style);
  if (!line) return null;
  return (
    <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
      {line}
    </div>
  );
}
