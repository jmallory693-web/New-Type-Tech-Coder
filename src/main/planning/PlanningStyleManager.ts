import {
  DEFAULT_PLANNING_STYLE,
  normalizePlanningStyle,
  type PlanningStyleId,
} from "../../shared/planningStyle";
import type { PlanningStyleState } from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

/** Stage 69: user-selected planning style (generated guidance only). */
export class PlanningStyleManager {
  private style: PlanningStyleId = DEFAULT_PLANNING_STYLE;
  private statusMessage: string | null =
    `Planning style: ${DEFAULT_PLANNING_STYLE === "small-model-friendly" ? "Small-model friendly" : "Default"} (default for new installs).`;

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): PlanningStyleState {
    return {
      style: this.style,
      statusMessage: this.statusMessage,
    };
  }

  getStyle(): PlanningStyleId {
    return this.style;
  }

  setStyle(style: unknown): void {
    const next = normalizePlanningStyle(style);
    if (next === this.style) return;
    this.style = next;
    this.statusMessage =
      next === "small-model-friendly"
        ? "Planning style set to Small-model friendly."
        : "Planning style set to Default.";
    this.safetyGate.log(
      "info",
      "Planning style changed",
      next === "small-model-friendly"
        ? "Small-model friendly"
        : "Default",
    );
  }

  restoreSaved(style: PlanningStyleId | null | undefined): void {
    this.style = normalizePlanningStyle(style);
    this.statusMessage = `Planning style restored (${this.style === "small-model-friendly" ? "Small-model friendly" : "Default"}).`;
  }
}
