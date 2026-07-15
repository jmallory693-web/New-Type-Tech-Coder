/**
 * Stage 125 structural smoke — Safe Scaffold Write Manifest Preview (no UI launch).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const TREE_BUILDER = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFileTreePreview.js",
);
const CONTENT_BUILDER = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFileContentPreview.js",
);
const MANIFEST_BUILDER = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldWriteManifestPreview.js",
);
const TAB = path.join(
  REPO,
  "src",
  "renderer",
  "components",
  "BuildModeTab.tsx",
);
const GUIDE = path.join(REPO, "src", "shared", "quickStartGuide.ts");
const CHARTER = path.join(REPO, "src", "shared", "buildModeSafetyCharter.ts");

const report = { failures: [], pass: false };
function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}
function check(name, cond) {
  if (!cond) fail(name);
  else console.log("PASS", name);
}

const treeMod = await import(pathToFileURL(TREE_BUILDER).href);
const contentMod = await import(pathToFileURL(CONTENT_BUILDER).href);
const manifestMod = await import(pathToFileURL(MANIFEST_BUILDER).href);

const { buildSafeScaffoldFileTreePreview } = treeMod;
const { buildSafeScaffoldFileContentPreview } = contentMod;
const {
  buildSafeScaffoldWriteManifestPreview,
  evaluateWriteManifestPreviewPreconditions,
} = manifestMod;

const tree = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
});
check("tree generates for manifest smoke", Boolean(tree.record));

const content = buildSafeScaffoldFileContentPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  fileTreeGeneratedAt: tree.record.generatedAt,
  proposedRelativePaths: tree.record.proposedRelativePaths,
});
check("content generates for manifest smoke", Boolean(content.record));

const baseOk = {
  blueprintImported: true,
  taskCardCount: 2,
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  targetStale: false,
  targetBusy: false,
  fileTreeExists: true,
  fileTreeStale: false,
  fileContentExists: true,
  fileContentStale: false,
  proposedRelativePaths: tree.record.proposedRelativePaths,
  templatedFiles: content.record.templatedFiles,
};

check(
  "ready when preconditions met",
  evaluateWriteManifestPreviewPreconditions(baseOk).canGenerate === true,
);
check(
  "blocked without blueprint",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    blueprintImported: false,
  }).canGenerate === false,
);
check(
  "blocked without task cards",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    taskCardCount: 0,
  }).canGenerate === false,
);
check(
  "blocked without target",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    targetFolderPath: null,
  }).canGenerate === false,
);
check(
  "blocked when target blocked",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    targetSafetyStatus: "blocked",
  }).canGenerate === false,
);
check(
  "blocked when target stale",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    targetStale: true,
  }).canGenerate === false,
);
check(
  "blocked without file tree",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    fileTreeExists: false,
  }).canGenerate === false,
);
check(
  "blocked when file tree stale",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    fileTreeStale: true,
  }).canGenerate === false,
);
check(
  "blocked without file content",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    fileContentExists: false,
  }).canGenerate === false,
);
check(
  "blocked when file content stale",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    fileContentStale: true,
  }).canGenerate === false,
);
check(
  "caution allows generate",
  evaluateWriteManifestPreviewPreconditions({
    ...baseOk,
    targetSafetyStatus: "caution",
  }).canGenerate === true,
);

const safe = buildSafeScaffoldWriteManifestPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  fileTreeGeneratedAt: tree.record.generatedAt,
  proposedRelativePaths: tree.record.proposedRelativePaths,
  fileContentGeneratedAt: content.record.generatedAt,
  templatedFiles: content.record.templatedFiles,
  filesWithoutContents: content.record.filesWithoutContents,
});

check("safe generates record", Boolean(safe.record));
const md = safe.record?.markdown ?? "";
check("status section", /## Status/.test(md) && /Preview only\. No files have been created/i.test(md));
check("source inputs", /## Source Inputs/.test(md));
check("future write plan", /## Future Write Plan/.test(md));
check("files that would be created", /## Files That Would Be Created/.test(md));
check("files not ready", /## Files Not Ready For Write/.test(md));
check("required final confirmation", /## Required Final Confirmation/.test(md));
check(
  "confirmation text present",
  /I understand NTTC will create new scaffold files/i.test(md),
);
check("rollback note", /## Rollback Note/.test(md));
check("safety boundaries", /## Safety Boundaries/.test(md));
check("next step", /## Next Step/.test(md));
check("has ready-to-create rows", (safe.record?.readyToCreate?.length ?? 0) > 0);
check("has not-ready rows", (safe.record?.notReady?.length ?? 0) > 0);

const covered = new Set([
  ...(safe.record?.readyToCreate ?? []).map((e) => e.relativePath),
  ...(safe.record?.notReady ?? []).map((e) => e.relativePath),
]);
check(
  "every tree path classified",
  tree.record.proposedRelativePaths.every((p) => covered.has(p)),
);

const caution = buildSafeScaffoldWriteManifestPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\caution",
  targetSafetyStatus: "caution",
  fileTreeGeneratedAt: tree.record.generatedAt,
  proposedRelativePaths: tree.record.proposedRelativePaths,
  fileContentGeneratedAt: content.record.generatedAt,
  templatedFiles: content.record.templatedFiles,
  filesWithoutContents: content.record.filesWithoutContents,
});
check("caution generates", Boolean(caution.record));
check(
  "caution warning",
  (caution.record?.warnings ?? []).some((w) =>
    /Target folder is Caution, not Safe/i.test(w),
  ),
);

const blocked = buildSafeScaffoldWriteManifestPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: null,
  targetFolderPath: "D:\\x",
  targetSafetyStatus: "blocked",
  fileTreeGeneratedAt: tree.record.generatedAt,
  proposedRelativePaths: tree.record.proposedRelativePaths,
  fileContentGeneratedAt: content.record.generatedAt,
  templatedFiles: content.record.templatedFiles,
  filesWithoutContents: content.record.filesWithoutContents,
});
check("blocked does not generate", !blocked.record);

const tab = fs.readFileSync(TAB, "utf8");
check("UI has Write Manifest section", /Safe Scaffold Write Manifest Preview/.test(tab));
check("UI has Generate button", /Generate Write Manifest Preview/.test(tab));
check("UI has Copy button", /Copy Write Manifest Preview/.test(tab));
check("UI has Clear button", /Clear Write Manifest Preview/.test(tab));
check("UI no Create Files", !/>\s*Create Files\s*</.test(tab));
check("UI no Scaffold", !/>\s*Scaffold\s*</.test(tab));
check("UI no Write Files", !/>\s*Write Files\s*</.test(tab));
check("UI no Install", !/>\s*Install\s*</.test(tab));
check("UI no Run", !/>\s*Run\s*</.test(tab));
check(
  "UI has Final Confirmation section",
  /Safe Scaffold Final Confirmation/i.test(tab) &&
    /Review Final Confirmation/i.test(tab) &&
    /SAFE_SCAFFOLD_WRITE_FILES_DISABLED_LABEL/.test(tab),
);

const guide = fs.readFileSync(GUIDE, "utf8");
check(
  "guide note",
  /lists exactly which files a future write stage would create/i.test(guide),
);

const charter = fs.readFileSync(CHARTER, "utf8");
check(
  "checklist preview label",
  /Write manifest preview prepared/.test(charter),
);
check(
  "later-stage actual write items",
  /Actual files written/.test(charter) &&
    /Written-files manifest after write/.test(charter),
);

report.pass = report.failures.length === 0;
console.log(JSON.stringify({ pass: report.pass, failures: report.failures }, null, 2));
process.exit(report.pass ? 0 : 1);
