/**
 * Stage 121 structural smoke — Safe Scaffold File Tree Preview (no UI launch).
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const BUILDER = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFileTreePreview.js",
);
const TYPES = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildModeFileTreePreview.js",
);
const TAB = path.join(
  REPO,
  "src",
  "renderer",
  "components",
  "BuildModeTab.tsx",
);

const report = { failures: [], pass: false };
function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

const builder = await import(pathToFileURL(BUILDER).href);
const types = await import(pathToFileURL(TYPES).href);

const {
  buildSafeScaffoldFileTreePreview,
  evaluateFileTreePreviewPreconditions,
} = builder;
const { validateProposedRelativePath } = types;

function check(name, cond) {
  if (!cond) fail(name);
  else console.log("PASS", name);
}

// Path validation
check(
  "relative path ok",
  validateProposedRelativePath("src/App.tsx") === null,
);
check(
  "absolute blocked",
  validateProposedRelativePath("C:/evil/App.tsx") !== null,
);
check(
  "traversal blocked",
  validateProposedRelativePath("../etc/passwd") !== null,
);
check("tilde blocked", validateProposedRelativePath("~/secret") !== null);
check(
  "node_modules blocked",
  validateProposedRelativePath("node_modules/x") !== null,
);
check("env blocked", validateProposedRelativePath(".env") !== null);
check(
  "leading slash blocked",
  validateProposedRelativePath("/src/App.tsx") !== null,
);

// Preconditions
const baseOk = {
  blueprintImported: true,
  taskCardCount: 3,
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  targetStale: false,
  targetBusy: false,
};
check(
  "ready when preconditions met",
  evaluateFileTreePreviewPreconditions(baseOk).canGenerate === true,
);
check(
  "blocked without blueprint",
  evaluateFileTreePreviewPreconditions({
    ...baseOk,
    blueprintImported: false,
  }).canGenerate === false,
);
check(
  "blocked without task cards",
  evaluateFileTreePreviewPreconditions({
    ...baseOk,
    taskCardCount: 0,
  }).canGenerate === false,
);
check(
  "blocked without target",
  evaluateFileTreePreviewPreconditions({
    ...baseOk,
    targetFolderPath: null,
  }).canGenerate === false,
);
check(
  "blocked when target blocked",
  evaluateFileTreePreviewPreconditions({
    ...baseOk,
    targetSafetyStatus: "blocked",
  }).canGenerate === false,
);
check(
  "blocked when target stale",
  evaluateFileTreePreviewPreconditions({
    ...baseOk,
    targetStale: true,
  }).canGenerate === false,
);
check(
  "caution allows generate",
  evaluateFileTreePreviewPreconditions({
    ...baseOk,
    targetSafetyStatus: "caution",
  }).canGenerate === true,
);

// Generate safe
const safe = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
});
check("safe generates record", Boolean(safe.record));
check("safe has relative paths only", Boolean(safe.record?.proposedRelativePaths?.length));
check(
  "safe markdown has preview-only",
  /Preview only\. No files have been created/i.test(safe.record?.markdown ?? ""),
);
check(
  "safe markdown has no contents claim",
  /not generated|paths only|No source\/file contents/i.test(
    safe.record?.markdown ?? "",
  ),
);
check(
  "no absolute paths in proposed",
  (safe.record?.proposedRelativePaths ?? []).every(
    (p) => validateProposedRelativePath(p) === null,
  ),
);

const caution = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "desktop-app",
  taskCardCount: 1,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\caution-target",
  targetSafetyStatus: "caution",
});
check("caution generates", Boolean(caution.record));
check(
  "caution warning present",
  (caution.record?.warnings ?? []).some((w) => /Caution/i.test(w)),
);

const blocked = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 1,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\x",
  targetSafetyStatus: "blocked",
});
check("blocked does not generate", !blocked.record);

const missingBp = buildSafeScaffoldFileTreePreview({
  blueprintImported: false,
  blueprintProjectType: "web-app",
  taskCardCount: 1,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\x",
  targetSafetyStatus: "safe",
});
check("no blueprint does not generate", !missingBp.record);

const noCards = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 0,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\x",
  targetSafetyStatus: "safe",
});
check("no task cards does not generate", !noCards.record);

// UI structural
const tab = fs.readFileSync(TAB, "utf8");
check("UI has File Tree Preview section", /Safe Scaffold File Tree Preview/.test(tab));
check("UI has Generate button", /Generate File Tree Preview/.test(tab));
check("UI has Copy button", /Copy File Tree Preview/.test(tab));
check("UI has Clear button", /Clear File Tree Preview/.test(tab));
check(
  "UI no Create Files button",
  !/>\s*Create Files\s*</.test(tab),
);
check("UI no Scaffold button", !/>\s*Scaffold\s*</.test(tab));
check("UI no Write button", !/>\s*Write\s*</.test(tab) && !/>\s*Write Files\s*</.test(tab));
check(
  "UI no Generate Contents button",
  !/>\s*Generate Contents\s*</.test(tab),
);

report.pass = report.failures.length === 0;
console.log(JSON.stringify({ pass: report.pass, failures: report.failures }, null, 2));
process.exit(report.pass ? 0 : 1);
