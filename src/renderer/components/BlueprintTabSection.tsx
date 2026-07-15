import { BlueprintPlannerPanel } from "./BlueprintPlannerPanel";
import type { BlueprintTabSectionProps } from "./blueprintTabSectionProps";

/** Stage 113: Blueprint tab shell extracted from App.tsx (rendering/container wiring only). */
export function BlueprintTabSection(props: BlueprintTabSectionProps) {
  const { localAiProgressBanner, ...plannerProps } = props;

  return (
    <div className="tab-panel" role="tabpanel" aria-label="Blueprint">
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Project Blueprint Planner</h2>
          <p className="panel-subtitle">
            Build from idea — planning documents only, no source code or
            scaffolding.
          </p>
        </div>
        <div className="panel-body">
          {localAiProgressBanner}
          <BlueprintPlannerPanel {...plannerProps} />
        </div>
      </section>
    </div>
  );
}
