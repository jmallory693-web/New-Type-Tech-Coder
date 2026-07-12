/** Stage 76: persisted Reports tab panel collapse preferences. */

export type ReportsPanelCollapseMap = Record<string, boolean>;

export class ReportsUiManager {
  private panelCollapse: ReportsPanelCollapseMap = {};

  loadFromHistory(saved: ReportsPanelCollapseMap | null | undefined): void {
    this.panelCollapse = saved && typeof saved === "object" ? { ...saved } : {};
  }

  getPanelCollapse(): ReportsPanelCollapseMap {
    return { ...this.panelCollapse };
  }

  setPanelCollapsed(panelId: string, collapsed: boolean): void {
    if (!panelId.trim()) return;
    this.panelCollapse = { ...this.panelCollapse, [panelId]: collapsed };
  }

  getPersistencePayload(): ReportsPanelCollapseMap {
    return this.getPanelCollapse();
  }
}
