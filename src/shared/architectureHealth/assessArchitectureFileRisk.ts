import {
  ARCHITECTURE_HEALTH_LINE_THRESHOLDS,
  HIGH_RISK_COORDINATION_PATTERNS,
  type ArchitectureHealthRiskLevel,
  type ArchitectureHealthSuggestedAction,
} from "./architectureHealthConstants";

export function assessLineCountRisk(
  lineCount: number,
  relativePath: string,
): ArchitectureHealthRiskLevel {
  const isAppTsx = /(?:^|\/)App\.tsx$/i.test(relativePath);
  const isMainIndex = /(?:^|\/)main\/index\.ts$/i.test(relativePath);

  let level: ArchitectureHealthRiskLevel;
  if (lineCount <= ARCHITECTURE_HEALTH_LINE_THRESHOLDS.okMax) {
    level = "OK";
  } else if (lineCount <= ARCHITECTURE_HEALTH_LINE_THRESHOLDS.watchMax) {
    level = "Watch";
  } else if (lineCount <= ARCHITECTURE_HEALTH_LINE_THRESHOLDS.largeMax) {
    level = "Large";
  } else if (lineCount <= ARCHITECTURE_HEALTH_LINE_THRESHOLDS.monolithMax) {
    level = "Monolith risk";
  } else {
    level = "Critical monolith risk";
  }

  if (isAppTsx || isMainIndex) {
    if (lineCount > ARCHITECTURE_HEALTH_LINE_THRESHOLDS.monolithMax) {
      return "Critical monolith risk";
    }
    if (lineCount > ARCHITECTURE_HEALTH_LINE_THRESHOLDS.largeMax) {
      return level === "OK" || level === "Watch" || level === "Large"
        ? "Monolith risk"
        : level;
    }
  }

  return level;
}

export function isHighRiskCoordinationFile(relativePath: string): boolean {
  return HIGH_RISK_COORDINATION_PATTERNS.some((entry) =>
    entry.pattern.test(relativePath),
  );
}

export function inferFileRoleHint(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (/(?:^|\/)App\.tsx$/i.test(normalized)) {
    return "Renderer root wiring / tab shell";
  }
  if (/(?:^|\/)main\/index\.ts$/i.test(normalized)) {
    return "Main process IPC + app bootstrap";
  }
  if (/preload\.(?:ts|js|mjs|cjs)$/i.test(normalized)) {
    return "Preload bridge";
  }
  if (/Manager\.ts$/i.test(normalized)) {
    return "Domain manager";
  }
  if (/(?:^|\/)shared\/types\.ts$/i.test(normalized)) {
    return "Shared types aggregator";
  }
  if (/Constants\.ts$/i.test(normalized)) {
    return "Constants aggregator";
  }
  if (/(?:^|\/)components\//i.test(normalized)) {
    return "UI component";
  }
  if (/(?:^|\/)renderer\//i.test(normalized)) {
    return "Renderer module";
  }
  if (/(?:^|\/)main\//i.test(normalized)) {
    return "Main process module";
  }
  if (/(?:^|\/)shared\//i.test(normalized)) {
    return "Shared module";
  }
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(normalized)) {
    return "Test file";
  }
  if (/\.md$/i.test(normalized)) {
    return "Documentation";
  }
  if (/\.json$/i.test(normalized)) {
    return "Config / data JSON";
  }
  return "Source module";
}

export function suggestArchitectureAction(input: {
  relativePath: string;
  lineCount: number;
  riskLevel: ArchitectureHealthRiskLevel;
  roleHint: string;
}): ArchitectureHealthSuggestedAction {
  const normalized = input.relativePath.replace(/\\/g, "/");

  if (input.riskLevel === "OK") return "OK";
  if (input.riskLevel === "Watch") return "Watch";

  if (/(?:^|\/)App\.tsx$/i.test(normalized)) {
    return "Split renderer wiring";
  }
  if (/(?:^|\/)main\/index\.ts$/i.test(normalized)) {
    return "Split IPC wiring";
  }
  if (/Manager\.ts$/i.test(normalized)) {
    return "Extract manager";
  }
  if (/(?:^|\/)shared\/types\.ts$/i.test(normalized) || /Constants\.ts$/i.test(normalized)) {
    return "Extract constants/types";
  }
  if (/(?:^|\/)components\//i.test(normalized) || /\.tsx$/i.test(normalized)) {
    return "Extract components";
  }
  if (
    input.riskLevel === "Monolith risk" ||
    input.riskLevel === "Critical monolith risk"
  ) {
    return "Create refactor task card";
  }
  return "Avoid adding new logic here";
}

export function riskSeverityRank(level: ArchitectureHealthRiskLevel): number {
  switch (level) {
    case "OK":
      return 0;
    case "Watch":
      return 1;
    case "Large":
      return 2;
    case "Monolith risk":
      return 3;
    case "Critical monolith risk":
      return 4;
    default:
      return 0;
  }
}

export function deriveArchitectureRecommendation(input: {
  criticalCount: number;
  monolithCount: number;
  largeCount: number;
}): import("./architectureHealthConstants").ArchitectureHealthRecommendation {
  if (input.criticalCount > 0) {
    return "Critical monolith risk — plan refactors first";
  }
  if (input.monolithCount > 0) {
    return "Monolith risk — extract before adding features";
  }
  if (input.largeCount > 0) {
    return "Watch large files";
  }
  return "Healthy";
}
