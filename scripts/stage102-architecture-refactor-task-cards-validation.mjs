/**
 * Stage 102 — Architecture Refactor Task Cards validation (local compiled modules).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { SafetyGate } = await import(
  pathToFileURL(path.join(REPO, "dist-electron/main/safety/SafetyGate.js")).href
);
const { scanArchitectureHealthFiles } = await import(
  pathToFileURL(
    path.join(REPO, "dist-electron/main/architecture/scanArchitectureHealthFiles.js"),
  ).href
);
const { buildArchitectureHealthReport } = await import(
  pathToFileURL(
    path.join(REPO, "dist-electron/shared/architectureHealth/buildArchitectureHealthReport.js"),
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
const { assessArchitectureRefactorTaskQuality } = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/architectureRefactorTasks/assessArchitectureRefactorTaskQuality.js",
    ),
  ).href
);

const gate = new SafetyGate();
gate.initialize();
gate.setProjectRoot(REPO);

const scan = scanArchitectureHealthFiles(gate, REPO, {
  includeTestFiles: false,
  includeMarkdownDocs: false,
});
const generatedAt = new Date().toISOString();
const report = buildArchitectureHealthReport({
  generatedAt,
  projectName: "New Type Tech Coder",
  files: scan.files,
  scanMeta: {
    fileCountScanned: scan.fileCountScanned,
    filesTruncated: scan.filesTruncated,
    blockedCount: scan.blockedCount,
    includeTestFiles: false,
    includeMarkdownDocs: false,
  },
  taskCards: null,
  changedFilesScan: null,
  changedFilesTaskLink: null,
});

const healthRecord = {
  id: "test-health",
  generatedAt: report.generatedAt,
  sourceProjectSummaryScannedAt: null,
  sourceChangedFilesScannedAt: null,
  sourceTaskCardsGeneratedAt: null,
  includeTestFiles: false,
  includeMarkdownDocs: false,
  fileCountScanned: report.fileCountScanned,
  filesTruncated: scan.filesTruncated,
  blockedCount: scan.blockedCount,
  largestFilePath: report.largestFilePath,
  largestFileLineCount: report.largestFileLineCount,
  criticalCount: report.criticalCount,
  warningCount: report.warningCount,
  recommendation: report.recommendation,
  stale: false,
  markdown: report.markdown,
  previewExcerpt: report.markdown.slice(0, 500),
  refactorSuggestions: report.refactorSuggestions,
};

const cards = buildArchitectureRefactorTaskCards({
  architectureHealth: healthRecord,
  planningStyle: "small-model-friendly",
});

const ids = cards?.cards.map((c) => c.id) ?? [];
const titles = cards?.cards.map((c) => c.title) ?? [];
const hasArch1 = ids.includes("ARCH-1");
const hasArch2 = ids.includes("ARCH-2");
const hasArch3 = ids.includes("ARCH-3");
const countOk = (cards?.taskCount ?? 0) >= 3 && (cards?.taskCount ?? 0) <= 8;
const allSections = cards?.cards.every((c) =>
  [
    "# NTTC Architecture Refactor Task Card",
    "## Task ID",
    "## Refactor Target",
    "## Builder Prompt",
    "## Safety Boundaries",
    "## Validation Steps",
    "## Status",
  ].every((sec) => c.markdown.includes(sec)),
);
const noRewrite = !cards?.cards.some((c) =>
  /rewrite the entire|complete overhaul|everything at once/i.test(c.markdown),
);
const noSourceBodies = !/function\s+\w+\s*\(|import\s+.*from/.test(
  cards?.allCardsMarkdown ?? "",
);
const builderSafety = cards?.cards.every((c) =>
  c.builderPrompt.includes("Do not add Apply Patch"),
);

console.log("=== Stage 102 Refactor Task Cards Validation ===");
console.log(`Cards: ${cards?.taskCount ?? 0}`);
console.log(`IDs: ${ids.join(", ")}`);
for (const card of cards?.cards ?? []) {
  const q = assessArchitectureRefactorTaskQuality({
    id: card.id,
    title: card.title,
    refactorTarget: card.refactorTarget,
    goal: card.goal,
    whatToChange: card.whatToChange,
    whatNotToChange: card.whatNotToChange,
    safetyBoundaries: card.safetyBoundaries,
    smallModelFriendlyArchitecture: card.smallModelFriendlyArchitecture,
    validationSteps: card.validationSteps,
    reportBackFormat: card.reportBackFormat,
    filesLikelyInvolved: card.filesLikelyInvolved,
    builderPrompt: card.builderPrompt,
    currentRisk: card.currentRisk,
  });
  console.log(`  ${card.id}: ${card.quality} (${q.flags.join("; ") || "no flags"})`);
}

const checks = [
  ["3-8 cards generated", countOk],
  ["ARCH-1 present", hasArch1],
  ["ARCH-2 present", hasArch2],
  ["ARCH-3 present", hasArch3],
  ["required sections", allSections],
  ["no giant rewrite language", noRewrite],
  ["no source bodies", noSourceBodies],
  ["builder safety reminders", builderSafety],
  ["App.tsx target card", titles.some((t) => /App\.tsx/i.test(t))],
  ["main/index.ts target card", titles.some((t) => /main\/index\.ts/i.test(t))],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed += 1;
}
process.exit(failed ? 1 : 0);
