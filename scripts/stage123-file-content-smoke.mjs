/**
 * Stage 123 structural smoke — Safe Scaffold File Content Preview (no UI launch).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const BUILDER = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFileContentPreview.js",
);
const TAB = path.join(
  REPO,
  "src",
  "renderer",
  "components",
  "BuildModeTab.tsx",
);
const GUIDE = path.join(REPO, "src", "shared", "quickStartGuide.ts");

const report = { failures: [], pass: false };
function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function check(name, cond) {
  if (!cond) fail(name);
  else console.log("PASS", name);
}

const builder = await import(pathToFileURL(BUILDER).href);
const {
  buildSafeScaffoldFileContentPreview,
  evaluateFileContentPreviewPreconditions,
} = builder;

const treePaths = [
  "package.json",
  "README.md",
  "index.html",
  "src/",
  "src/main.tsx",
  "src/App.tsx",
  "src/styles.css",
  "docs/",
  "docs/PROJECT_NOTES.md",
  ".nttc/",
  ".nttc/planning/",
  "electron.manifest.md",
];

const baseOk = {
  blueprintImported: true,
  taskCardCount: 3,
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  targetStale: false,
  targetBusy: false,
  fileTreeExists: true,
  fileTreeStale: false,
  proposedRelativePaths: treePaths,
};

check(
  "ready when preconditions met",
  evaluateFileContentPreviewPreconditions(baseOk).canGenerate === true,
);
check(
  "blocked without blueprint",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    blueprintImported: false,
  }).canGenerate === false,
);
check(
  "blocked without task cards",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    taskCardCount: 0,
  }).canGenerate === false,
);
check(
  "blocked without target",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    targetFolderPath: null,
  }).canGenerate === false,
);
check(
  "blocked when target blocked",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    targetSafetyStatus: "blocked",
  }).canGenerate === false,
);
check(
  "blocked when target stale",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    targetStale: true,
  }).canGenerate === false,
);
check(
  "blocked without file tree",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    fileTreeExists: false,
  }).canGenerate === false,
);
check(
  "blocked when file tree stale",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    fileTreeStale: true,
  }).canGenerate === false,
);
check(
  "blocked when path unsafe",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    proposedRelativePaths: ["../evil.ts"],
  }).canGenerate === false,
);
check(
  "caution allows generate",
  evaluateFileContentPreviewPreconditions({
    ...baseOk,
    targetSafetyStatus: "caution",
  }).canGenerate === true,
);

const safe = buildSafeScaffoldFileContentPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  fileTreeGeneratedAt: "2026-01-01T00:00:00.000Z",
  proposedRelativePaths: treePaths,
});

check("safe generates record", Boolean(safe.record));
check(
  "safe markdown status section",
  /## Status/.test(safe.record?.markdown ?? "") &&
    /Preview only\. No files have been created/i.test(
      safe.record?.markdown ?? "",
    ),
);
check(
  "safe markdown source inputs",
  /## Source Inputs/.test(safe.record?.markdown ?? ""),
);
check(
  "safe markdown proposed files",
  /## Proposed Files/.test(safe.record?.markdown ?? ""),
);
check(
  "safe markdown without contents",
  /## Files Without Contents Yet/.test(safe.record?.markdown ?? ""),
);
check(
  "safe markdown safety boundaries",
  /## Safety Boundaries/.test(safe.record?.markdown ?? ""),
);
check(
  "safe markdown next step",
  /## Next Step/.test(safe.record?.markdown ?? ""),
);
check(
  "templated package.json",
  (safe.record?.templatedFiles ?? []).some(
    (f) => f.relativePath === "package.json",
  ),
);
check(
  "templated README.md",
  (safe.record?.templatedFiles ?? []).some(
    (f) => f.relativePath.toLowerCase() === "readme.md",
  ),
);
check(
  "templated index.html",
  (safe.record?.templatedFiles ?? []).some(
    (f) => f.relativePath === "index.html",
  ),
);
check(
  "templated src/main.tsx",
  (safe.record?.templatedFiles ?? []).some(
    (f) => f.relativePath === "src/main.tsx",
  ),
);
check(
  "unknown paths listed without contents",
  (safe.record?.filesWithoutContents ?? []).includes("electron.manifest.md"),
);
check(
  "directories listed without contents",
  (safe.record?.filesWithoutContents ?? []).includes("src/"),
);
check(
  "no .env in markdown body templates",
  !(safe.record?.templatedFiles ?? []).some((f) => /\.env\b/i.test(f.content)),
);
check(
  "no private key material",
  !(safe.record?.templatedFiles ?? []).some((f) =>
    /BEGIN (RSA |OPENSSH )?PRIVATE KEY/i.test(f.content),
  ),
);
check(
  "no postinstall",
  !(safe.record?.templatedFiles ?? []).some((f) => /postinstall/i.test(f.content)),
);
check(
  "scripts not-run note present",
  /NTTC will not run these scripts automatically/i.test(
    safe.record?.markdown ?? "",
  ),
);

const caution = buildSafeScaffoldFileContentPreview({
  blueprintImported: true,
  blueprintProjectType: "desktop-app",
  taskCardCount: 1,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\caution-target",
  targetSafetyStatus: "caution",
  fileTreeGeneratedAt: "2026-01-01T00:00:00.000Z",
  proposedRelativePaths: treePaths,
});
check("caution generates", Boolean(caution.record));
check(
  "caution warning present",
  (caution.record?.warnings ?? []).some((w) =>
    /Target folder is Caution, not Safe/i.test(w),
  ),
);

const blocked = buildSafeScaffoldFileContentPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 1,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\x",
  targetSafetyStatus: "blocked",
  fileTreeGeneratedAt: "2026-01-01T00:00:00.000Z",
  proposedRelativePaths: treePaths,
});
check("blocked does not generate", !blocked.record);

const badPath = buildSafeScaffoldFileContentPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 1,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\x",
  targetSafetyStatus: "safe",
  fileTreeGeneratedAt: "2026-01-01T00:00:00.000Z",
  proposedRelativePaths: [".env", "src/App.tsx"],
});
check("unsafe path does not generate", !badPath.record);

const tab = fs.readFileSync(TAB, "utf8");
check(
  "UI has File Content Preview section",
  /Safe Scaffold File Content Preview/.test(tab),
);
check("UI has Generate button", /Generate File Content Preview/.test(tab));
check("UI has Copy button", /Copy File Content Preview/.test(tab));
check("UI has Clear button", /Clear File Content Preview/.test(tab));
check("UI no Create Files button", !/>\s*Create Files\s*</.test(tab));
check("UI no Scaffold button", !/>\s*Scaffold\s*</.test(tab));
check(
  "UI no Write button",
  !/>\s*Write\s*</.test(tab) && !/>\s*Write Files\s*</.test(tab),
);
check("UI no Install button", !/>\s*Install\s*</.test(tab));
check("UI no Run button", !/>\s*Run\s*</.test(tab));

const guide = fs.readFileSync(GUIDE, "utf8");
check(
  "guide note present",
  /deterministic starter contents in memory only/i.test(guide),
);

report.pass = report.failures.length === 0;
console.log(
  JSON.stringify({ pass: report.pass, failures: report.failures }, null, 2),
);
process.exit(report.pass ? 0 : 1);
