/**
 * Stage 100 — Architecture Health scanner accuracy validation (local only).
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
const { collectChangedFilesPressure } = await import(
  pathToFileURL(
    path.join(REPO, "dist-electron/shared/architectureHealth/architectureHealthHelpers.js"),
  ).href
);

const gate = new SafetyGate();
gate.initialize();
gate.setProjectRoot(REPO);

const scan = scanArchitectureHealthFiles(gate, REPO, {
  includeTestFiles: false,
  includeMarkdownDocs: false,
});

const byPath = new Map(scan.files.map((f) => [f.relativePath, f]));
const paths = scan.files.map((f) => f.relativePath);

const report = buildArchitectureHealthReport({
  generatedAt: new Date().toISOString(),
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
  changedFilesScan: {
    scannedAt: new Date().toISOString(),
    projectPath: REPO,
    isGitRepo: true,
    gitAvailable: true,
    statusMessage: "mock",
    errorMessage: null,
    branchName: "main",
    totalCount: 4,
    modifiedCount: 4,
    addedCount: 0,
    deletedCount: 0,
    renamedCount: 0,
    untrackedCount: 0,
    otherCount: 0,
    riskyCount: 0,
    truncated: false,
    truncationNote: null,
    manyFilesWarning: null,
    globalRiskFlags: [],
    files: [
      { path: "src/renderer/App.tsx", status: "modified", riskFlags: [] },
      { path: "package.json", status: "modified", riskFlags: [] },
      { path: "vite.config.ts", status: "modified", riskFlags: [] },
      { path: "src/main/index.ts", status: "modified", riskFlags: [] },
    ],
    skippedOutsideOrDenied: [],
  },
  changedFilesTaskLink: null,
});

const distElectronHits = paths.filter((p) => p.includes("dist-electron"));
const app = byPath.get("src/renderer/App.tsx");
const main = byPath.get("src/main/index.ts");
const largestTop20 = [...scan.files]
  .sort((a, b) => b.lineCount - a.lineCount)
  .slice(0, 20)
  .map((f) => f.relativePath);

const configPressure = collectChangedFilesPressure({
  changedFilePaths: ["package.json", "vite.config.ts", "src/renderer/App.tsx"],
  files: scan.files,
});

const hasSourceBody =
  /function\s+\w+\s*\(|import\s+.*from|export\s+(default\s+)?function/.test(
    report.markdown,
  );

const checks = [
  ["App.tsx scanned", Boolean(app)],
  [
    "App.tsx Critical monolith risk",
    app?.riskLevel === "Critical monolith risk",
  ],
  [
    "App.tsx in top 20 largest",
    largestTop20.includes("src/renderer/App.tsx"),
  ],
  [
    "App.tsx high-risk coordination",
    app?.isHighRiskCoordinationFile === true,
  ],
  ["main/index.ts scanned", Boolean(main)],
  [
    "main/index.ts Critical monolith risk",
    main?.riskLevel === "Critical monolith risk",
  ],
  ["dist-electron excluded", distElectronHits.length === 0],
  [
    "package.json config pressure",
    configPressure.some((l) => l.includes("package manifest")),
  ],
  [
    "vite.config.ts config pressure",
    configPressure.some((l) => l.includes("Vite config")),
  ],
  ["no source bodies in markdown", !hasSourceBody],
  [
    "App.tsx in report markdown",
    report.markdown.includes("src/renderer/App.tsx"),
  ],
];

console.log("=== Stage 100 Architecture Health Validation ===");
console.log(`Files scanned: ${scan.fileCountScanned}`);
console.log(`Blocked/skipped: ${scan.blockedCount}`);
console.log(`Largest file: ${report.largestFilePath} (${report.largestFileLineCount} lines)`);
console.log(`Critical count: ${report.criticalCount}`);
if (app) {
  console.log(
    `App.tsx: ${app.lineCount} lines, ${app.riskLevel}, role=${app.roleHint}`,
  );
}
if (main) {
  console.log(`main/index.ts: ${main.lineCount} lines, ${main.riskLevel}`);
}
console.log("\nTop 5 largest:");
for (const f of largestTop20.slice(0, 5)) {
  const meta = byPath.get(f);
  console.log(`  ${f} — ${meta?.lineCount ?? "?"} lines (${meta?.riskLevel ?? "?"})`);
}
console.log("\nChanged-Files Pressure (sample):");
for (const line of configPressure) console.log(`  ${line}`);

let failed = 0;
console.log("\nChecks:");
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed += 1;
}

process.exit(failed ? 1 : 0);
