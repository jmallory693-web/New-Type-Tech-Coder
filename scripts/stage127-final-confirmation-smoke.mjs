/**
 * Stage 127 structural smoke — Safe Scaffold Final Confirmation Gate (no UI launch).
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
const CONFIRM_BUILDER = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFinalConfirmation.js",
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
const confirmMod = await import(pathToFileURL(CONFIRM_BUILDER).href);

const { buildSafeScaffoldFileTreePreview } = treeMod;
const { buildSafeScaffoldFileContentPreview } = contentMod;
const { buildSafeScaffoldWriteManifestPreview } = manifestMod;
const {
  buildSafeScaffoldFinalConfirmation,
  evaluateFinalConfirmationPreconditions,
  acknowledgementsAreComplete,
} = confirmMod;

const tree = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
});
check("tree generates", Boolean(tree.record));

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
check("content generates", Boolean(content.record));

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
check("manifest generates", Boolean(manifest.record));

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
  proposedRelativePaths: tree.record.proposedRelativePaths,
  readyToCreate: manifest.record.readyToCreate,
  notReady: manifest.record.notReady,
};

check(
  "ready when preconditions met",
  evaluateFinalConfirmationPreconditions(baseOk).canConfirm === true,
);
check(
  "blocked without blueprint",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    blueprintImported: false,
  }).canConfirm === false,
);
check(
  "blocked without task cards",
  evaluateFinalConfirmationPreconditions({ ...baseOk, taskCardCount: 0 })
    .canConfirm === false,
);
check(
  "blocked without target",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    targetFolderPath: null,
  }).canConfirm === false,
);
check(
  "blocked when target blocked",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    targetSafetyStatus: "blocked",
  }).canConfirm === false,
);
check(
  "blocked when target stale",
  evaluateFinalConfirmationPreconditions({ ...baseOk, targetStale: true })
    .canConfirm === false,
);
check(
  "blocked without file tree",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    fileTreeExists: false,
  }).canConfirm === false,
);
check(
  "blocked when file tree stale",
  evaluateFinalConfirmationPreconditions({ ...baseOk, fileTreeStale: true })
    .canConfirm === false,
);
check(
  "blocked without file content",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    fileContentExists: false,
  }).canConfirm === false,
);
check(
  "blocked when file content stale",
  evaluateFinalConfirmationPreconditions({ ...baseOk, fileContentStale: true })
    .canConfirm === false,
);
check(
  "blocked without write manifest",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    writeManifestExists: false,
  }).canConfirm === false,
);
check(
  "blocked when write manifest stale",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    writeManifestStale: true,
  }).canConfirm === false,
);
check(
  "blocked with blocked-path entries",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    notReady: [
      {
        relativePath: "../evil.ts",
        reason: "unsafe",
        pathStatus: "blocked-path",
      },
    ],
  }).canConfirm === false,
);
check(
  "blocked with blocked-content entries",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    notReady: [
      {
        relativePath: "bad.ts",
        reason: "unsafe",
        pathStatus: "blocked-content",
      },
    ],
  }).canConfirm === false,
);
check(
  "blocked with zero ready-to-create",
  evaluateFinalConfirmationPreconditions({
    ...baseOk,
    readyToCreate: [],
  }).canConfirm === false,
);

const acksIncomplete = {
  futureWriteBoundaries: false,
  stage127NoWrite: false,
  cautionTarget: false,
};
check(
  "acks incomplete without boxes",
  acknowledgementsAreComplete({
    targetSafetyStatus: "safe",
    acknowledgements: acksIncomplete,
  }) === false,
);

const acksSafe = {
  futureWriteBoundaries: true,
  stage127NoWrite: true,
  cautionTarget: false,
};
check(
  "acks complete for safe",
  acknowledgementsAreComplete({
    targetSafetyStatus: "safe",
    acknowledgements: acksSafe,
  }) === true,
);
check(
  "acks incomplete for caution without caution box",
  acknowledgementsAreComplete({
    targetSafetyStatus: "caution",
    acknowledgements: acksSafe,
  }) === false,
);
const acksCaution = {
  futureWriteBoundaries: true,
  stage127NoWrite: true,
  cautionTarget: true,
};
check(
  "acks complete for caution",
  acknowledgementsAreComplete({
    targetSafetyStatus: "caution",
    acknowledgements: acksCaution,
  }) === true,
);

const blockedWithoutAcks = buildSafeScaffoldFinalConfirmation({
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
  acknowledgements: acksIncomplete,
});
check("cannot record without acks", blockedWithoutAcks.record === null);

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
  acknowledgements: acksSafe,
});
check("safe confirmation records", Boolean(confirmed.record));
check(
  "summary header",
  confirmed.record?.markdown.includes(
    "# NTTC Safe Scaffold Final Confirmation Summary",
  ) === true,
);
check(
  "no files created language",
  confirmed.record?.markdown.includes("No files have been created") === true,
);
check(
  "no overwrite language",
  confirmed.record?.markdown.includes("will not overwrite existing files") ===
    true,
);
check(
  "no edit language",
  confirmed.record?.markdown.includes("will not edit existing files") === true,
);
check(
  "no commands language",
  confirmed.record?.markdown.includes("will not run commands") === true,
);
check(
  "no install language",
  confirmed.record?.markdown.includes("will not install packages") === true,
);
check(
  "no patches language",
  confirmed.record?.markdown.includes("will not apply patches") === true,
);
check(
  "no AI automatic",
  confirmed.record?.markdown.includes("will not call AI automatically") ===
    true,
);
check(
  "has ready-to-create count",
  (confirmed.record?.readyToCreateCount ?? 0) > 0,
);
check(
  "still disabled note",
  confirmed.record?.markdown.includes(
    "Safe Scaffold writing is still disabled",
  ) === true ||
    confirmed.record?.markdown.includes(
      "later stage may add the first actual scaffold write",
    ) === true,
);

const cautionTree = buildSafeScaffoldFileTreePreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\caution-target",
  targetSafetyStatus: "caution",
});
const cautionContent = buildSafeScaffoldFileContentPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\caution-target",
  targetSafetyStatus: "caution",
  fileTreeGeneratedAt: cautionTree.record.generatedAt,
  proposedRelativePaths: cautionTree.record.proposedRelativePaths,
});
const cautionManifest = buildSafeScaffoldWriteManifestPreview({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  targetFolderPath: "D:\\caution-target",
  targetSafetyStatus: "caution",
  fileTreeGeneratedAt: cautionTree.record.generatedAt,
  proposedRelativePaths: cautionTree.record.proposedRelativePaths,
  fileContentGeneratedAt: cautionContent.record.generatedAt,
  templatedFiles: cautionContent.record.templatedFiles,
  filesWithoutContents: cautionContent.record.filesWithoutContents,
});
const cautionConfirmed = buildSafeScaffoldFinalConfirmation({
  blueprintImported: true,
  blueprintProjectType: "web-app",
  taskCardCount: 2,
  targetFolderPath: "D:\\caution-target",
  targetSafetyStatus: "caution",
  fileTreeGeneratedAt: cautionTree.record.generatedAt,
  proposedRelativePaths: cautionTree.record.proposedRelativePaths,
  fileContentGeneratedAt: cautionContent.record.generatedAt,
  templatedRelativePaths: cautionContent.record.templatedFiles.map(
    (f) => f.relativePath,
  ),
  filesWithoutContents: cautionContent.record.filesWithoutContents,
  writeManifestGeneratedAt: cautionManifest.record.generatedAt,
  readyToCreate: cautionManifest.record.readyToCreate,
  notReady: cautionManifest.record.notReady,
  acknowledgements: acksCaution,
});
check("caution confirmation records", Boolean(cautionConfirmed.record));
check(
  "caution warning present",
  (cautionConfirmed.record?.warnings?.length ?? 0) > 0,
);

const tabSrc = fs.readFileSync(TAB, "utf8");
const sharedConfirm = fs.readFileSync(
  path.join(REPO, "src", "shared", "buildModeFinalConfirmation.ts"),
  "utf8",
);
check("UI has Final Confirmation section", /Safe Scaffold Final Confirmation/.test(tabSrc));
check("UI has Review Final Confirmation", /Review Final Confirmation/.test(tabSrc));
check("UI has Clear Final Confirmation", /Clear Final Confirmation/.test(tabSrc));
check("UI has Copy Confirmation Summary", /Copy Confirmation Summary/.test(tabSrc));
check(
  "UI has disabled Write Files",
  /SAFE_SCAFFOLD_WRITE_FILES_DISABLED_LABEL/.test(tabSrc) &&
    /Write Files — Disabled until next stage/.test(sharedConfirm),
);
check(
  "UI no Create Files button",
  !/>\s*Create Files\s*</.test(tabSrc) &&
    !/onClick=\{[^}]*Create Files/.test(tabSrc),
);
check("UI no Scaffold button label", !/>\s*Scaffold\s*</.test(tabSrc));
check("UI no Write Files enabled", !/>\s*Write Files\s*</.test(tabSrc));
check("UI no Install", !/>\s*Install\s*</.test(tabSrc));
check("UI no Run button", !/>\s*Run\s*</.test(tabSrc));
check(
  "UI has ack boundaries language",
  /SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_BOUNDARIES/.test(tabSrc) &&
    /will not overwrite existing files/.test(sharedConfirm),
);
check(
  "UI has stage 127 ack",
  /SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_STAGE127/.test(tabSrc) &&
    /Stage 127 does not create files/.test(sharedConfirm),
);
check(
  "UI has caution ack",
  /SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_CAUTION/.test(tabSrc) &&
    /selected target folder is Caution/.test(sharedConfirm),
);

const guideSrc = fs.readFileSync(GUIDE, "utf8");
check(
  "guide note",
  /Safe Scaffold Final Confirmation records readiness for a future write stage/.test(
    guideSrc,
  ),
);

const charterSrc = fs.readFileSync(CHARTER, "utf8");
check(
  "checklist confirmation label",
  /Future write confirmation recorded/.test(charterSrc),
);
check(
  "later-stage actual write items",
  /Actual files written/.test(charterSrc) &&
    /Written-files manifest after write/.test(charterSrc),
);

report.pass = report.failures.length === 0;
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
