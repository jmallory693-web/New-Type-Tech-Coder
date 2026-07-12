/**
 * Stage 93: deterministic quality severity harness (no UI).
 */
import { assessBlueprintTaskCardQuality } from "../dist-electron/shared/assessBlueprintTaskCardQuality.js";

const base = {
  id: "P1A",
  title: "Habit list shell",
  goal: "Create a focused habit list view shell.",
  whatToBuild: "Habit list component and shared types.",
  whatNotToBuildYet: "No persistence, no settings, no later phases.",
  safetyBoundaries:
    "Implement only this task. Do not build later phases. No Apply Patch. No terminal.",
  smallModelGuidance:
    "Keep files small. Use components and shared modules. Avoid App.tsx dumps.",
  validationSteps:
    "Run typecheck. Manually open habit list. Confirm render only.",
  reportBackFormat:
    "Report changed files, validation, risks, and safety confirmations.",
  likelyFilesModules: "src/shared/types.ts, src/renderer/components/HabitList.tsx",
  builderPrompt: "Build habit list shell only.",
  smallModelFriendly: true,
};

const cases = [
  {
    name: "0 flags → good",
    input: base,
    expect: "good",
  },
  {
    name: "1 flag → needs-clarification",
    input: { ...base, goal: "x" },
    expect: "needs-clarification",
  },
  {
    name: "3 flags → too-broad",
    input: {
      ...base,
      title: "Build everything for the full app complete",
      goal: "x",
      validationSteps: "typecheck",
      reportBackFormat: "files",
    },
    expect: "too-broad",
  },
  {
    name: "missing safety boundaries → blocked",
    input: { ...base, safetyBoundaries: "" },
    expect: "blocked",
  },
  {
    name: "too broad flag → too-broad",
    input: {
      ...base,
      title: "Build the complete full app everything",
    },
    expect: "too-broad",
  },
];

const report = { pass: true, results: [] };
for (const c of cases) {
  const { quality, flags } = assessBlueprintTaskCardQuality(c.input);
  const ok = quality === c.expect;
  report.results.push({ name: c.name, quality, flags, expect: c.expect, ok });
  if (!ok) report.pass = false;
}
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
