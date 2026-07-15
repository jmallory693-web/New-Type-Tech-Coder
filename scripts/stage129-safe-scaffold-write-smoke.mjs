/**
 * Stage 129 structural smoke — Safe Scaffold Write readiness + write helpers (no UI launch).
 * Does not create files in the real project. May write inside a disposable temp folder.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";

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
const CONFIRM_BUILDER = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFinalConfirmation.js",
);
const WRITE_EVAL = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldWrite.js",
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
const WRITE_TYPES = path.join(
  REPO,
  "src",
  "shared",
  "buildModeSafeScaffoldWrite.ts",
);

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
const confirmMod = await import(pathToFileURL(CONFIRM_BUILDER).href);
const writeMod = await import(pathToFileURL(WRITE_EVAL).href);

const { buildSafeScaffoldFileTreePreview } = treeMod;
const { buildSafeScaffoldFileContentPreview } = contentMod;
const { buildSafeScaffoldWriteManifestPreview } = manifestMod;
const { buildSafeScaffoldFinalConfirmation } = confirmMod;
const { evaluateSafeScaffoldWritePreconditions, scaffoldContentLooksUnsafe } =
  writeMod;

const tree = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
});
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
const manifest = buildSafeScaffoldWriteManifestPreview({
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
const acks = {
  futureWriteBoundaries: true,
  stage127NoWrite: true,
  cautionTarget: false,
};
const confirmed = buildSafeScaffoldFinalConfirmation({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  fileTreeGeneratedAt: tree.record.generatedAt,
  proposedRelativePaths: tree.record.proposedRelativePaths,
  fileContentGeneratedAt: content.record.generatedAt,
  templatedRelativePaths: content.record.templatedFiles.map((f) => f.relativePath),
  filesWithoutContents: content.record.filesWithoutContents,
  writeManifestGeneratedAt: manifest.record.generatedAt,
  readyToCreate: manifest.record.readyToCreate,
  notReady: manifest.record.notReady,
  acknowledgements: acks,
});
check("confirm generates", Boolean(confirmed.record));

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
  writeManifestExists: true,
  writeManifestStale: false,
  finalConfirmationExists: true,
  finalConfirmationStale: false,
  finalConfirmationAcks: acks,
  proposedRelativePaths: tree.record.proposedRelativePaths,
  readyToCreate: manifest.record.readyToCreate,
  notReady: manifest.record.notReady,
};

check(
  "ready when preconditions met",
  evaluateSafeScaffoldWritePreconditions(baseOk).canWrite === true,
);
check(
  "blocked without blueprint",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    blueprintImported: false,
  }).canWrite === false,
);
check(
  "blocked without cards",
  evaluateSafeScaffoldWritePreconditions({ ...baseOk, taskCardCount: 0 })
    .canWrite === false,
);
check(
  "blocked without target",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    targetFolderPath: null,
  }).canWrite === false,
);
check(
  "blocked caution for stage 129",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    targetSafetyStatus: "caution",
  }).canWrite === false,
);
check(
  "blocked when blocked target",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    targetSafetyStatus: "blocked",
  }).canWrite === false,
);
check(
  "blocked when target stale",
  evaluateSafeScaffoldWritePreconditions({ ...baseOk, targetStale: true })
    .canWrite === false,
);
check(
  "blocked without tree",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    fileTreeExists: false,
  }).canWrite === false,
);
check(
  "blocked without content",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    fileContentExists: false,
  }).canWrite === false,
);
check(
  "blocked without manifest",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    writeManifestExists: false,
  }).canWrite === false,
);
check(
  "blocked without confirmation",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    finalConfirmationExists: false,
  }).canWrite === false,
);
check(
  "blocked when confirmation stale",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    finalConfirmationStale: true,
  }).canWrite === false,
);
check(
  "blocked with blocked-path",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    notReady: [
      { relativePath: "../x", reason: "bad", pathStatus: "blocked-path" },
    ],
  }).canWrite === false,
);
check(
  "blocked with blocked-content",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    notReady: [
      { relativePath: "bad.ts", reason: "unsafe", pathStatus: "blocked-content" },
    ],
  }).canWrite === false,
);
check(
  "blocked with zero ready",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    readyToCreate: [],
  }).canWrite === false,
);
check(
  "blocked without acks",
  evaluateSafeScaffoldWritePreconditions({
    ...baseOk,
    finalConfirmationAcks: {
      futureWriteBoundaries: false,
      stage127NoWrite: false,
      cautionTarget: false,
    },
  }).canWrite === false,
);

check(
  "content unsafe detects eval",
  scaffoldContentLooksUnsafe("eval(foo)") !== null,
);
check(
  "content safe for hello",
  scaffoldContentLooksUnsafe("export const x = 1;\n") === null,
);

const tabSrc = fs.readFileSync(TAB, "utf8");
const writeTypes = fs.readFileSync(WRITE_TYPES, "utf8");
check("UI has Safe Scaffold Write section", /Safe Scaffold Write/.test(tabSrc));
check(
  "UI has Write Safe Scaffold Files button label",
  /SAFE_SCAFFOLD_WRITE_BUTTON_LABEL/.test(tabSrc) &&
    /Write Safe Scaffold Files/.test(writeTypes),
);
check("UI has Re-check Write Readiness", /Re-check Write Readiness/.test(tabSrc));
check("UI has Clear Write Result", /Clear Write Result/.test(tabSrc));
check("UI has Copy Write Result", /Copy Write Result/.test(tabSrc));
check("UI no Apply Patch", !/>\s*Apply Patch\s*</.test(tabSrc));
check("UI no Install button", !/>\s*Install\s*</.test(tabSrc));
check("UI no Run button", !/>\s*Run\s*</.test(tabSrc));
check(
  "dialog warning language",
  /will not overwrite files/i.test(writeTypes) &&
    /Proceed with creating these new files/i.test(writeTypes),
);
check(
  "rollback note constant",
  /did not run commands or install packages/i.test(writeTypes),
);
check(
  "clear note constant",
  /does not delete files from disk/i.test(writeTypes),
);

const guideSrc = fs.readFileSync(GUIDE, "utf8");
check(
  "guide note",
  /Safe Scaffold Write creates new files only after final confirmation/i.test(
    guideSrc,
  ),
);

const charterSrc = fs.readFileSync(CHARTER, "utf8");
check(
  "checklist written-files result label",
  /Written-files result recorded/.test(charterSrc),
);

// Disposable exclusive-create smoke using Node wx flag (mirrors manager semantics)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nttc-s129-"));
const sampleRel = "README.md";
const sampleAbs = path.join(tmp, sampleRel);
fs.writeFileSync(sampleAbs, "# hello\n", { encoding: "utf8", flag: "wx" });
check("exclusive create works once", fs.existsSync(sampleAbs));
let secondFailed = false;
try {
  fs.writeFileSync(sampleAbs, "# overwrite?\n", { encoding: "utf8", flag: "wx" });
} catch {
  secondFailed = true;
}
check("exclusive create refuses overwrite", secondFailed === true);
check(
  "no project contamination",
  !fs.existsSync(path.join(REPO, "STAGE129_SHOULD_NOT_EXIST.txt")),
);
fs.rmSync(tmp, { recursive: true, force: true });

report.pass = report.failures.length === 0;
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
