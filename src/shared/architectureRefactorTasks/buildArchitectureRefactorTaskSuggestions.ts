import type { ArchitectureHealthFileEntry } from "../architectureHealth/buildArchitectureHealthReport";
import {
  riskSeverityRank,
} from "../architectureHealth/assessArchitectureFileRisk";

/** Metadata-only refactor suggestion (Stage 98/102). */
export interface RefactorTaskCardSuggestion {
  title: string;
  goal: string;
  filesLikelyInvolved: string;
  whatNotToChange: string;
  validationRequired: string;
  risk: string;
  suggestedBuilderPrompt: string;
  refactorTarget?: string;
  whatToChange?: string;
}

/** Stage 102: deterministic suggestions from architecture health file metadata. */
export function buildArchitectureRefactorTaskSuggestions(
  files: ArchitectureHealthFileEntry[],
): RefactorTaskCardSuggestion[] {
  const suggestions: RefactorTaskCardSuggestion[] = [];
  const sorted = [...files].sort(
    (a, b) =>
      riskSeverityRank(b.riskLevel) - riskSeverityRank(a.riskLevel) ||
      b.lineCount - a.lineCount,
  );

  const appTsx = sorted.find((f) => /(?:^|\/)App\.tsx$/i.test(f.relativePath));
  if (appTsx && riskSeverityRank(appTsx.riskLevel) >= 2) {
    suggestions.push({
      title: "Extract Reports tab section rendering from App.tsx",
      refactorTarget: appTsx.relativePath,
      goal: "Move Reports tab panels (Architecture Health, Changed Files, review packs) into focused container/components without changing behavior.",
      whatToChange:
        "Extract one Reports subsection at a time into src/renderer/components/. Pass handlers/state as props from App.tsx.",
      filesLikelyInvolved: `${appTsx.relativePath}; src/renderer/components/*Panel.tsx`,
      whatNotToChange:
        "Do not add source editing, AI file access, terminal, Apply Patch, or Live Qwen. Do not grow App.tsx.",
      validationRequired:
        "npm run typecheck; manual smoke of Reports tab sections; confirm no source edits by NTTC.",
      risk: "Medium — large renderer wiring file; extract incrementally.",
      suggestedBuilderPrompt:
        "Extract one Reports tab subsection from App.tsx into a new focused component under src/renderer/components/. Keep IPC calls in App.tsx minimal. No behavior changes.",
    });
    suggestions.push({
      title: "Extract Blueprint tab container wiring from App.tsx",
      refactorTarget: appTsx.relativePath,
      goal: "Move Blueprint tab shell wiring into a focused BlueprintTabContainer component.",
      whatToChange:
        "Move Blueprint tab JSX wiring into BlueprintTabContainer.tsx; keep App.tsx as prop pass-through.",
      filesLikelyInvolved: `${appTsx.relativePath}; src/renderer/components/BlueprintPlannerPanel.tsx`,
      whatNotToChange:
        "Do not redesign Blueprint workflow or add auto task-card creation from reports.",
      validationRequired:
        "npm run typecheck; Blueprint tab smoke (planner, task cards, handoff).",
      risk: "Medium — touches primary navigation shell.",
      suggestedBuilderPrompt:
        "Create BlueprintTabContainer.tsx and move Blueprint tab JSX wiring from App.tsx. Leave state/handlers passed as props.",
    });
    suggestions.push({
      title: "Reduce repeated dashboard/workflow rendering in App.tsx",
      refactorTarget: appTsx.relativePath,
      goal: "Extract repeated dashboard/workflow status rendering into reusable components.",
      whatToChange:
        "Identify one repeated workflow/dashboard block and move to a focused component under src/renderer/components/.",
      filesLikelyInvolved: `${appTsx.relativePath}; src/renderer/components/`,
      whatNotToChange:
        "Do not change workflow logic, daily next action rules, or navigation behavior.",
      validationRequired:
        "npm run typecheck; smoke Workflow Progress/Health and Daily Next Action display.",
      risk: "Low-medium — UI extraction only.",
      suggestedBuilderPrompt:
        "Extract one repeated dashboard/workflow JSX block from App.tsx into a reusable component. Preserve props and behavior.",
    });
  }

  const mainIndex = sorted.find((f) =>
    /(?:^|\/)main\/index\.ts$/i.test(f.relativePath),
  );
  if (mainIndex && riskSeverityRank(mainIndex.riskLevel) >= 2) {
    suggestions.push({
      title: "Extract IPC registration groups from main/index.ts",
      refactorTarget: mainIndex.relativePath,
      goal: "Group related ipcMain.handle registrations into focused registration helpers under src/main/.",
      whatToChange:
        "Move one domain IPC block into src/main/<domain>/registerIpc.ts and call from index.ts.",
      filesLikelyInvolved: `${mainIndex.relativePath}; src/main/*/*.ts`,
      whatNotToChange:
        "Do not change IPC channel names, safety boundaries, or add command execution.",
      validationRequired:
        "npm run typecheck; smoke IPC for moved handler groups.",
      risk: "Medium-high — central bootstrap file.",
      suggestedBuilderPrompt:
        "Extract one domain IPC registration block from main/index.ts into src/main/<domain>/registerIpc.ts. Import and call from index.ts.",
    });
  }

  const largeManagers = sorted.filter(
    (f) => /Manager\.ts$/i.test(f.relativePath) && f.lineCount > 700,
  );
  for (const mgr of largeManagers.slice(0, 2)) {
    suggestions.push({
      title: `Split responsibilities in ${mgr.relativePath}`,
      refactorTarget: mgr.relativePath,
      goal: "Extract focused helpers or sub-managers from an oversized manager file.",
      whatToChange:
        "Move pure helper logic into src/shared/<domain>/ helpers; keep manager as orchestrator.",
      filesLikelyInvolved: `${mgr.relativePath}; src/shared/<domain>/`,
      whatNotToChange:
        "Do not change public manager API used by main/index.ts without updating callers.",
      validationRequired: "npm run typecheck; feature smoke for the manager domain.",
      risk: "Medium — domain logic concentration.",
      suggestedBuilderPrompt: `Extract pure helper functions from ${mgr.relativePath} into src/shared/<domain>/ helpers. Keep manager as orchestrator.`,
    });
  }

  const sharedTypes = sorted.find((f) =>
    /(?:^|\/)shared\/types\.ts$/i.test(f.relativePath),
  );
  if (sharedTypes && sharedTypes.lineCount > 700) {
    suggestions.push({
      title: "Split architecture/task planning type definitions by domain",
      refactorTarget: sharedTypes.relativePath,
      goal: "Move large type groups into domain-specific type files under src/shared/.",
      whatToChange:
        "Move one related type group into src/shared/<domain>Types.ts and re-export from types.ts.",
      filesLikelyInvolved: `${sharedTypes.relativePath}; src/shared/types*.ts`,
      whatNotToChange:
        "Do not break existing imports across main/renderer without re-exports.",
      validationRequired: "npm run typecheck after each type group move.",
      risk: "Low-medium — type-only refactor if imports updated carefully.",
      suggestedBuilderPrompt:
        "Move one related type group from shared/types.ts into src/shared/<domain>Types.ts and re-export from types.ts.",
    });
  }

  if (suggestions.length < 3) {
    suggestions.push({
      title: "Create reusable ReportPanel shell component",
      refactorTarget: "src/renderer/App.tsx",
      goal: "Standardize Generate/Copy/Clear report panels to reduce repeated JSX in App.tsx.",
      whatToChange:
        "Create ReportPanelShell with title, purpose, action buttons, preview area; migrate one panel.",
      filesLikelyInvolved:
        "src/renderer/components/ReportPanelShell.tsx; src/renderer/App.tsx",
      whatNotToChange: "Do not change report content or IPC semantics.",
      validationRequired: "Visual smoke of Reports tab panels.",
      risk: "Low — UI shell extraction only.",
      suggestedBuilderPrompt:
        "Create ReportPanelShell with title, purpose, action buttons, preview area. Migrate one existing report panel as proof.",
    });
  }

  return suggestions.slice(0, 8);
}
