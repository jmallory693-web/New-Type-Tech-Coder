import type { ReactNode } from "react";

export function ReportsWorkflowSection({
  panelId,
  title,
  collapsed,
  onToggle,
  children,
}: {
  panelId: string;
  title: string;
  collapsed: boolean;
  onToggle: (collapsed: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="reports-workflow-section"
      data-panel-id={panelId}
      open={!collapsed}
    >
      <summary
        className="reports-workflow-summary"
        onClick={(event) => {
          event.preventDefault();
          onToggle(!collapsed);
        }}
      >
        <span className="reports-workflow-summary-title">{title}</span>
        <span className="reports-workflow-summary-hint">
          {collapsed ? "Expand section" : "Collapse section"}
        </span>
      </summary>
      <div className="reports-workflow-body">{children}</div>
    </details>
  );
}
