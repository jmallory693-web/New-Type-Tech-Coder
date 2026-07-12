/**
 * Stage 104 — Architecture Refactor Builder Handoff validation (local compiled modules).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { assessArchitectureRefactorTaskBuilderHandoffReadiness } = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/assessArchitectureRefactorTaskBuilderHandoffReadiness.js",
    ),
  ).href
);
const { buildArchitectureRefactorTaskBuilderHandoffMarkdown } = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/buildArchitectureRefactorTaskBuilderHandoff.js",
    ),
  ).href
);
const { buildArchitectureRefactorTaskCards } = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/architectureRefactorTasks/buildArchitectureRefactorTaskCards.js",
    ),
  ).href
);
const { buildArchitectureRefactorTaskSuggestions } = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/architectureRefactorTasks/buildArchitectureRefactorTaskSuggestions.js",
    ),
  ).href
);
const {
  ARCHITECTURE_REFACTOR_HANDOFF_BEHAVIOR_PRESERVATION,
  ARCHITECTURE_REFACTOR_HANDOFF_APP_TSX_NOTE,
  ARCHITECTURE_REFACTOR_HANDOFF_MAIN_INDEX_NOTE,
  ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TITLE,
} = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/architectureRefactorTasks/architectureRefactorTaskBuilderHandoffConstants.js",
    ),
  ).href
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const suggestions = buildArchitectureRefactorTaskSuggestions([
  {
    relativePath: "src/renderer/App.tsx",
    lineCount: 10795,
    byteSize: 393000,
    riskLevel: "Critical monolith risk",
    category: "renderer",
  },
  {
    relativePath: "src/main/index.ts",
    lineCount: 4700,
    byteSize: 180000,
    riskLevel: "Critical monolith risk",
    category: "main",
  },
]);

const health = {
  id: "health-test",
  generatedAt: "2026-07-11T18:00:00.000Z",
  sourceProjectSummaryScannedAt: null,
  sourceChangedFilesScannedAt: null,
  sourceTaskCardsGeneratedAt: null,
  includeTestFiles: false,
  includeMarkdownDocs: false,
  fileCountScanned: 2,
  filesTruncated: false,
  blockedCount: 0,
  largestFilePath: "src/renderer/App.tsx",
  largestFileLineCount: 10795,
  criticalCount: 2,
  warningCount: 0,
  recommendation: "Critical monolith risk — plan refactors before adding features.",
  stale: false,
  markdown: "# Architecture Health\n",
  previewExcerpt: "Critical monolith risk",
  refactorSuggestions: suggestions,
};

const cards = buildArchitectureRefactorTaskCards({
  architectureHealth: health,
  planningStyle: "small-model-friendly",
});

assert(cards?.cards.length, "Expected refactor cards");
const arch1 = cards.cards.find((c) => c.id === "ARCH-1");
assert(arch1, "Expected ARCH-1");

const readiness = assessArchitectureRefactorTaskBuilderHandoffReadiness({
  architectureHealth: health,
  refactorTaskCards: cards,
  selectedTask: arch1,
  selectedTaskId: "ARCH-1",
});

const markdown = buildArchitectureRefactorTaskBuilderHandoffMarkdown({
  architectureHealth: health,
  task: arch1,
  planningStyle: "small-model-friendly",
  target: "generic-builder",
  strictness: "conservative",
  readiness: readiness.readiness,
  recommendation: readiness.recommendation,
  tooBroadWarning: readiness.tooBroadWarning,
  changedFilesScan: {
    scannedAt: "2026-07-11T18:00:00.000Z",
    isGitRepo: true,
    totalCount: 2,
    files: [
      { path: "src/renderer/App.tsx", status: "modified" },
      { path: "src/main/index.ts", status: "modified" },
    ],
    statusMessage: "ok",
    errorMessage: null,
  },
  changedFilesTaskLink: null,
  generatedAt: "2026-07-11T18:05:00.000Z",
});

const requiredSections = [
  "# NTTC Architecture Refactor Builder Handoff",
  "## Builder Target",
  "## Selected Refactor Task",
  "## Refactor Goal",
  "## Current Architecture Risk",
  "## What To Change",
  "## What Not To Change",
  "## Files Likely Involved",
  "## Behavior Preservation Requirements",
  "## Safety Boundaries",
  "## Small-Model Friendly Architecture",
  "## Builder Instructions",
  "## Validation Required",
  "## Report Back Format",
  "## After Builder Returns",
  "## Recommendation",
  "## Safety Reminder",
];

for (const section of requiredSections) {
  assert(markdown.includes(section), `Missing section: ${section}`);
}

for (const line of ARCHITECTURE_REFACTOR_HANDOFF_BEHAVIOR_PRESERVATION) {
  assert(markdown.includes(line), `Missing behavior preservation: ${line}`);
}

assert(
  markdown.includes(ARCHITECTURE_REFACTOR_HANDOFF_APP_TSX_NOTE),
  "Missing App.tsx-specific wording",
);
assert(!markdown.includes("```typescript"), "Handoff must not include source code blocks");
assert(
  markdown.includes("Do not add Apply Patch") &&
    markdown.includes("Do not change Live Qwen disabled behavior") &&
    markdown.includes("Do not add terminal/custom command features"),
  "Missing safety phrases",
);

const mainCard = cards.cards.find((c) => /main\/index\.ts/i.test(c.refactorTarget));
let mainIndexWordingOk = false;
if (mainCard) {
  const mainMarkdown = buildArchitectureRefactorTaskBuilderHandoffMarkdown({
    architectureHealth: health,
    task: mainCard,
    planningStyle: "small-model-friendly",
    target: "cursor",
    strictness: "conservative",
    readiness: "ready-for-narrow-refactor-plan",
    recommendation: "Ready for narrow refactor plan",
    tooBroadWarning: false,
    changedFilesScan: null,
    changedFilesTaskLink: null,
    generatedAt: "2026-07-11T18:05:00.000Z",
  });
  mainIndexWordingOk = mainMarkdown.includes(
    ARCHITECTURE_REFACTOR_HANDOFF_MAIN_INDEX_NOTE,
  );
}
assert(mainIndexWordingOk, "Missing main/index.ts-specific wording");

console.log(
  JSON.stringify(
    {
      title: ARCHITECTURE_REFACTOR_TASK_BUILDER_HANDOFF_TITLE,
      readiness: readiness.readiness,
      recommendation: readiness.recommendation,
      sectionsOk: requiredSections.length,
      behaviorPreservationOk: true,
      appTsxWordingOk: true,
      mainIndexWordingOk,
      noSourceBodies: true,
      pass: true,
    },
    null,
    2,
  ),
);
