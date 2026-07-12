import type {
  HandoffReadinessLevel,
  WorkflowHealthLevel,
  WorkflowHealthSummary,
  WorkflowProgressItem,
} from "../../shared/workflowGuidance";
import { WORKFLOW_NAV_TARGETS } from "../../shared/workflowGuidance";

function statusIcon(status: WorkflowProgressItem["status"]): string {
  switch (status) {
    case "completed":
      return "✓";
    case "current":
      return "→";
    case "recommended-next":
      return "★";
    case "blocked":
      return "✕";
    default:
      return "○";
  }
}

function statusLabel(status: WorkflowProgressItem["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "current":
      return "Current";
    case "recommended-next":
      return "Recommended Next";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

function healthTone(level: WorkflowHealthLevel): "ok" | "warning" | "danger" {
  if (level === "green") return "ok";
  if (level === "yellow") return "warning";
  return "danger";
}

function readinessTone(
  level: HandoffReadinessLevel,
): "neutral" | "info" | "ok" | "warning" {
  switch (level) {
    case "implementation-ready":
      return "ok";
    case "review-ready":
      return "info";
    case "planning-only":
      return "warning";
    default:
      return "neutral";
  }
}

export function WorkflowGuidancePanel({
  progress,
  health,
  handoffReadiness,
  blockedReasons,
  onNavigate,
}: {
  progress: WorkflowProgressItem[];
  health: WorkflowHealthSummary;
  handoffReadiness: { level: HandoffReadinessLevel; label: string; detail: string };
  blockedReasons: string[];
  onNavigate: (focusId: string) => void;
}) {
  return (
    <div className="workflow-guidance-stack" data-focus-id="workflow-guidance">
      <div className="workflow-guidance-row">
        <div className="workflow-guidance-card">
          <h3 className="workflow-guidance-title">Workflow Progress</h3>
          <p className="workflow-guidance-subtitle">
            Based on stored NTTC metadata only — nothing is inferred from source
            files.
          </p>
          <ul className="workflow-progress-list">
            {progress.map((item) => (
              <li
                key={item.id}
                className={`workflow-progress-item workflow-progress-${item.status}`}
              >
                <div className="workflow-progress-head">
                  <span className="workflow-progress-icon" aria-hidden="true">
                    {statusIcon(item.status)}
                  </span>
                  <span className="workflow-progress-label">{item.label}</span>
                  <span className={`badge badge-${item.status === "completed" ? "ok" : item.status === "blocked" ? "danger" : item.status === "recommended-next" ? "info" : "neutral"}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <div className="workflow-progress-detail">{item.detail}</div>
              </li>
            ))}
          </ul>
          <div className="workflow-nav-buttons">
            {WORKFLOW_NAV_TARGETS.map((target) => (
              <button
                key={target.focusId}
                type="button"
                className="workflow-nav-btn"
                onClick={() => onNavigate(target.focusId)}
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>

        <div className="workflow-guidance-side">
          <div className="workflow-guidance-card">
            <h3 className="workflow-guidance-title">Workflow Health</h3>
            <div className={`workflow-health workflow-health-${health.level}`}>
              <span className={`badge badge-${healthTone(health.level)}`}>
                {health.label}
              </span>
              <ul className="workflow-health-list">
                {health.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="workflow-guidance-card">
            <h3 className="workflow-guidance-title">Handoff Readiness</h3>
            <div className="workflow-handoff-readiness">
              <span
                className={`badge badge-${readinessTone(handoffReadiness.level)}`}
              >
                {handoffReadiness.label}
              </span>
              <p className="workflow-handoff-detail">{handoffReadiness.detail}</p>
            </div>
          </div>

          {blockedReasons.length > 0 ? (
            <div className="workflow-guidance-card workflow-blocked-card">
              <h3 className="workflow-guidance-title">Blocked — why?</h3>
              <ul className="workflow-blocked-list">
                {blockedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
