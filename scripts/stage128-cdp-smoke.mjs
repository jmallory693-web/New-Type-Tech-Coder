/**
 * Stage 128 packaged-app smoke — Safe Scaffold Final Confirmation Gate after Stage 127.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9250
 *
 * Native folder dialog is not CDP-automatable; injects a Safe target into history
 * then refreshes safety and generates tree + content + write-manifest + final confirmation via IPC.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const CDP = "http://127.0.0.1:9250";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;
const HISTORY = path.join(
  process.env.APPDATA || "",
  "New Type Tech Coder",
  "history",
  "session-history.json",
);
const ASSESS_JS = path.join(
  REPO,
  "dist-electron",
  "main",
  "buildMode",
  "assessSafeScaffoldTarget.js",
);
const BUILDER_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFileTreePreview.js",
);
const CONTENT_BUILDER_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFileContentPreview.js",
);
const MANIFEST_BUILDER_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldWriteManifestPreview.js",
);
const CONFIRM_BUILDER_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldFinalConfirmation.js",
);
const PATH_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildModeFileTreePreview.js",
);

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 128 disposable smoke blueprint.
## Product Requirements
Verify packaged Safe Scaffold Final Confirmation Gate.
## User Stories
As a user I want final confirmation readiness before any write stage.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A.
## Screen / Workflow Flow
Build tab final confirmation gate.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/BuildModeTab.tsx
## Build Phases
1A — Stage 128 smoke
## Validation Plan
Packaged CDP smoke.
## Risks / Open Questions
None.
## AI Team Roles
Human + NTTC.
## Phase 1 Builder Handoff
None.
## Current Status
Ready.
`;

const TASK_INTAKE_REPORT = `# Builder Implementation Report

## 1. Analysis
Stage 128 Blueprint regression.

## 2. Plan
Confirm Blueprint still works after Stage 127 packaging.

## 3. Files changed
- none in Stage 128

## 4. Implementation summary
Packaging only.

## 5. Validation performed
Packaged smoke.

## 6. Behavior preservation checks
No Apply Patch. Final confirmation is metadata/readiness only.

## 7. Risks
Low.

## 8. Safety confirmations
No source editing by NTTC.

## 9. Questions / blockers
None.
`;

const report = { failures: [], warnings: [], pass: false };

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function normalizeKey(p) {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("No CDP target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const snap = () => evaluate("window.nttc.getSnapshot()");
  return { page, evaluate, snap, ws };
}

function listProjectFiles(root) {
  const out = [];
  const skip = new Set([
    "node_modules",
    "release",
    "release-stage111",
    "dist",
    "dist-electron",
    ".git",
  ]);
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (skip.has(name)) continue;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push(full.replace(/\\/g, "/"));
    }
  }
  walk(root);
  return out;
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const t = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === ${JSON.stringify(label)},
    );
    if (t) t.click();
  })()`);
}

async function btnExists(evaluate, label) {
  return evaluate(
    `[...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === ${JSON.stringify(label)})`,
  );
}

function injectSafeTarget(emptyDir, check) {
  if (!fs.existsSync(HISTORY)) throw new Error("session-history.json missing");
  const raw = JSON.parse(fs.readFileSync(HISTORY, "utf8"));
  const key = normalizeKey(PROJECT);
  const found =
    raw.projects?.[key]
      ? key
      : Object.keys(raw.projects || {}).find(
          (k) =>
            normalizeKey(k) === key ||
            k.toLowerCase().includes("new type tech coder"),
        );
  if (!found) throw new Error(`History key missing for ${PROJECT}`);
  raw.projects[found].safeScaffoldTarget = {
    selectedPath: check.resolvedPath || emptyDir,
    lastCheck: check,
    stale: false,
  };
  // Clear previews so generate is fresh
  raw.projects[found].safeScaffoldFileTreePreview = null;
  raw.projects[found].safeScaffoldFileContentPreview = null;
  raw.projects[found].safeScaffoldWriteManifestPreview = null;
  raw.projects[found].safeScaffoldFinalConfirmation = null;
  fs.writeFileSync(HISTORY, JSON.stringify(raw, null, 2), "utf8");
  return found;
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  const distJs = fs
    .readdirSync(path.join(REPO, "dist", "assets"))
    .find((f) => f.endsWith(".js"));
  const bundleText = fs.readFileSync(
    path.join(REPO, "dist", "assets", distJs),
    "utf8",
  );
  report.bundle = {
    stage127Wiring:
      bundleText.includes("Safe Scaffold File Tree Preview") &&
      bundleText.includes("Safe Scaffold File Content Preview") &&
      bundleText.includes("Safe Scaffold Write Manifest Preview") &&
      bundleText.includes("Safe Scaffold Final Confirmation") &&
      bundleText.includes("Review Final Confirmation") &&
      bundleText.includes("Clear Final Confirmation") &&
      bundleText.includes("Safe Scaffold Target Folder") &&
      (bundleText.includes("Planning Only") ||
        bundleText.includes("Build Mode Status")),
    noApplyPatch: !bundleText.includes("Apply Patch"),
    guideNote:
      /Safe Scaffold Final Confirmation records readiness for a future write stage/i.test(
        bundleText,
      ),
  };
  if (!report.bundle.stage127Wiring) fail("Bundle missing Stage 127 wiring");
  if (!report.bundle.noApplyPatch) fail("Bundle unexpectedly contains Apply Patch");
  if (!report.bundle.guideNote) fail("Bundle missing Guide final-confirmation note");

  // Path safety structural (deterministic)
  const pathMod = await import(pathToFileURL(PATH_JS).href);
  const builderMod = await import(pathToFileURL(BUILDER_JS).href);
  const contentMod = await import(pathToFileURL(CONTENT_BUILDER_JS).href);
  const manifestMod = await import(pathToFileURL(MANIFEST_BUILDER_JS).href);
  const confirmMod = await import(pathToFileURL(CONFIRM_BUILDER_JS).href);
  const validate = pathMod.validateProposedRelativePath;
  const buildPreview = builderMod.buildSafeScaffoldFileTreePreview;
  const buildContent = contentMod.buildSafeScaffoldFileContentPreview;
  const buildManifest = manifestMod.buildSafeScaffoldWriteManifestPreview;
  const evaluateManifestPreconditions =
    manifestMod.evaluateWriteManifestPreviewPreconditions;
  const evaluateFinalPreconditions =
    confirmMod.evaluateFinalConfirmationPreconditions;
  const buildFinalConfirmation = confirmMod.buildSafeScaffoldFinalConfirmation;
  const acknowledgementsAreComplete = confirmMod.acknowledgementsAreComplete;
  report.pathSafety = {
    relativeOk: validate("src/App.tsx") === null,
    absBlocked: validate("C:/x") !== null,
    traversalBlocked: validate("../x") !== null,
    tildeBlocked: validate("~/x") !== null,
    nmBlocked: validate("node_modules/x") !== null,
    gitBlocked: validate(".git/config") !== null,
    distBlocked: validate("dist/out.js") !== null,
    envBlocked: validate(".env") !== null,
    keyBlocked: validate("id_rsa") !== null,
    slashBlocked: validate("/src/App.tsx") !== null,
  };
  if (Object.values(report.pathSafety).some((v) => !v)) fail("Path safety matrix failed");

  report.manifestPreconditions = {
    noBlueprint: !evaluateManifestPreconditions({
      blueprintImported: false,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    noCards: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 0,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    noTarget: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: null,
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    blockedTarget: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "blocked",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    staleTarget: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: true,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    noTree: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: false,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: [],
      templatedFiles: [],
    }).canGenerate,
    staleTree: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: true,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    noContent: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: false,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [],
    }).canGenerate,
    staleContent: !evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: true,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    safeOk: evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
    cautionOk: evaluateManifestPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "caution",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      fileContentExists: true,
      fileContentStale: false,
      proposedRelativePaths: ["src/App.tsx"],
      templatedFiles: [{ relativePath: "src/App.tsx", content: "export {}" }],
    }).canGenerate,
  };
  if (Object.values(report.manifestPreconditions).some((v) => !v)) {
    fail("Manifest precondition matrix failed");
  }

  const cautionTree = buildPreview({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 1,
    taskCardsGeneratedAt: null,
    targetFolderPath: "D:\\caution",
    targetSafetyStatus: "caution",
  });
  const cautionContent = buildContent({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 1,
    taskCardsGeneratedAt: null,
    targetFolderPath: "D:\\caution",
    targetSafetyStatus: "caution",
    fileTreeGeneratedAt:
      cautionTree.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    proposedRelativePaths: cautionTree.record?.proposedRelativePaths ?? [],
  });
  const cautionBuilt = buildManifest({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 1,
    taskCardsGeneratedAt: null,
    targetFolderPath: "D:\\caution",
    targetSafetyStatus: "caution",
    fileTreeGeneratedAt:
      cautionTree.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    proposedRelativePaths: cautionTree.record?.proposedRelativePaths ?? [],
    fileContentGeneratedAt:
      cautionContent.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    templatedFiles: cautionContent.record?.templatedFiles ?? [],
    filesWithoutContents: cautionContent.record?.filesWithoutContents ?? [],
  });
  const cautionMd = cautionBuilt.record?.markdown ?? "";
  const covered = new Set([
    ...(cautionBuilt.record?.readyToCreate ?? []).map((e) => e.relativePath),
    ...(cautionBuilt.record?.notReady ?? []).map((e) => e.relativePath),
  ]);
  report.cautionManifest = {
    generated: Boolean(cautionBuilt.record),
    hasWarning: (cautionBuilt.record?.warnings ?? []).some((w) =>
      /Target folder is Caution, not Safe/i.test(w),
    ),
    hasSections: [
      "# NTTC Safe Scaffold Write Manifest Preview",
      "## Status",
      "## Source Inputs",
      "## Future Write Plan",
      "## Files That Would Be Created",
      "## Files Not Ready For Write",
      "## Required Final Confirmation",
      "## Rollback Note",
      "## Safety Boundaries",
      "## Next Step",
    ].every((sec) => cautionMd.includes(sec)),
    previewOnly: /Preview only\. No files have been created/i.test(cautionMd),
    noOverwrite: /would not overwrite existing files/i.test(cautionMd),
    noEdit: /would not edit existing files/i.test(cautionMd),
    noCommands: /would not run commands/i.test(cautionMd),
    noInstall: /would not install packages/i.test(cautionMd),
    noPatches: /would not apply patches/i.test(cautionMd),
    everyPathClassified: (cautionTree.record?.proposedRelativePaths ?? []).every(
      (p) => covered.has(p),
    ),
    hasReady: (cautionBuilt.record?.readyToCreate?.length ?? 0) > 0,
    hasNotReady: (cautionBuilt.record?.notReady?.length ?? 0) > 0,
    hasDirectoryOnly: (cautionBuilt.record?.notReady ?? []).some(
      (e) => e.pathStatus === "directory-only",
    ),
    hasMissingContent: (cautionBuilt.record?.notReady ?? []).some(
      (e) => e.pathStatus === "missing-content",
    ),
  };
  if (
    !report.cautionManifest.generated ||
    !report.cautionManifest.hasWarning ||
    !report.cautionManifest.hasSections ||
    !report.cautionManifest.everyPathClassified ||
    !report.cautionManifest.previewOnly ||
    !report.cautionManifest.noOverwrite
  ) {
    fail("Caution write-manifest structural checks failed");
  }

  const readyRows = cautionBuilt.record?.readyToCreate ?? [];
  const notReadyRows = cautionBuilt.record?.notReady ?? [];
  const confirmBase = {
    blueprintImported: true,
    taskCardCount: 1,
    targetFolderPath: "D:\\caution",
    targetSafetyStatus: "caution",
    targetStale: false,
    targetBusy: false,
    fileTreeExists: true,
    fileTreeStale: false,
    fileContentExists: true,
    fileContentStale: false,
    writeManifestExists: true,
    writeManifestStale: false,
    proposedRelativePaths: cautionTree.record?.proposedRelativePaths ?? [],
    readyToCreate: readyRows,
    notReady: notReadyRows,
  };
  report.finalPreconditions = {
    noBlueprint: !evaluateFinalPreconditions({
      ...confirmBase,
      blueprintImported: false,
    }).canConfirm,
    noCards: !evaluateFinalPreconditions({
      ...confirmBase,
      taskCardCount: 0,
    }).canConfirm,
    noTarget: !evaluateFinalPreconditions({
      ...confirmBase,
      targetFolderPath: null,
    }).canConfirm,
    blockedTarget: !evaluateFinalPreconditions({
      ...confirmBase,
      targetSafetyStatus: "blocked",
    }).canConfirm,
    staleTarget: !evaluateFinalPreconditions({
      ...confirmBase,
      targetStale: true,
    }).canConfirm,
    noTree: !evaluateFinalPreconditions({
      ...confirmBase,
      fileTreeExists: false,
    }).canConfirm,
    staleTree: !evaluateFinalPreconditions({
      ...confirmBase,
      fileTreeStale: true,
    }).canConfirm,
    noContent: !evaluateFinalPreconditions({
      ...confirmBase,
      fileContentExists: false,
    }).canConfirm,
    staleContent: !evaluateFinalPreconditions({
      ...confirmBase,
      fileContentStale: true,
    }).canConfirm,
    noManifest: !evaluateFinalPreconditions({
      ...confirmBase,
      writeManifestExists: false,
    }).canConfirm,
    staleManifest: !evaluateFinalPreconditions({
      ...confirmBase,
      writeManifestStale: true,
    }).canConfirm,
    safeOk: evaluateFinalPreconditions({
      ...confirmBase,
      targetSafetyStatus: "safe",
      targetFolderPath: "D:\\safe",
    }).canConfirm,
    cautionOk: evaluateFinalPreconditions(confirmBase).canConfirm,
    blockedPathBlocks:
      !evaluateFinalPreconditions({
        ...confirmBase,
        notReady: [
          {
            relativePath: "../x.ts",
            reason: "bad",
            pathStatus: "blocked-path",
          },
        ],
      }).canConfirm,
    noReadyBlocks: !evaluateFinalPreconditions({
      ...confirmBase,
      readyToCreate: [],
    }).canConfirm,
  };
  if (Object.values(report.finalPreconditions).some((v) => !v)) {
    fail("Final confirmation precondition matrix failed");
  }

  report.cautionConfirmation = {
    acksIncomplete: !acknowledgementsAreComplete({
      targetSafetyStatus: "caution",
      acknowledgements: {
        futureWriteBoundaries: true,
        stage127NoWrite: true,
        cautionTarget: false,
      },
    }),
    acksComplete: acknowledgementsAreComplete({
      targetSafetyStatus: "caution",
      acknowledgements: {
        futureWriteBoundaries: true,
        stage127NoWrite: true,
        cautionTarget: true,
      },
    }),
    safeNoCautionNeeded: acknowledgementsAreComplete({
      targetSafetyStatus: "safe",
      acknowledgements: {
        futureWriteBoundaries: true,
        stage127NoWrite: true,
        cautionTarget: false,
      },
    }),
  };
  const cautionConfirmBuilt = buildFinalConfirmation({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 1,
    targetFolderPath: "D:\\caution",
    targetSafetyStatus: "caution",
    fileTreeGeneratedAt:
      cautionTree.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    proposedRelativePaths: cautionTree.record?.proposedRelativePaths ?? [],
    fileContentGeneratedAt:
      cautionContent.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    templatedRelativePaths: (cautionContent.record?.templatedFiles ?? []).map(
      (f) => f.relativePath,
    ),
    filesWithoutContents: cautionContent.record?.filesWithoutContents ?? [],
    writeManifestGeneratedAt:
      cautionBuilt.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    readyToCreate: readyRows,
    notReady: notReadyRows,
    acknowledgements: {
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget: true,
    },
  });
  const cautionConfirmMd = cautionConfirmBuilt.record?.markdown ?? "";
  report.cautionConfirmation.recorded = Boolean(cautionConfirmBuilt.record);
  report.cautionConfirmation.hasHeader =
    /# NTTC Safe Scaffold Final Confirmation Summary/.test(cautionConfirmMd);
  report.cautionConfirmation.noFilesCreated =
    /No files have been created/i.test(cautionConfirmMd);
  report.cautionConfirmation.stillDisabled =
    /later stage may add the first actual scaffold write|still disabled/i.test(
      cautionConfirmMd,
    );
  report.cautionConfirmation.hasWarning =
    (cautionConfirmBuilt.record?.warnings ?? []).some((w) =>
      /Target folder is Caution, not Safe/i.test(w),
    );
  report.cautionConfirmation.hasSections = [
    "## Status",
    "## Target Folder",
    "## Ready-To-Create Files",
    "## Not-Ready Files",
    "## Safety Boundaries",
    "## Next Step",
  ].every((sec) => cautionConfirmMd.includes(sec));
  if (
    !report.cautionConfirmation.acksIncomplete ||
    !report.cautionConfirmation.acksComplete ||
    !report.cautionConfirmation.safeNoCautionNeeded ||
    !report.cautionConfirmation.recorded ||
    !report.cautionConfirmation.hasHeader ||
    !report.cautionConfirmation.noFilesCreated ||
    !report.cautionConfirmation.hasWarning
  ) {
    fail("Caution final-confirmation structural checks failed");
  }

  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "nttc-s128-safe-"));
  const assessMod = await import(pathToFileURL(ASSESS_JS).href);
  const check = assessMod.assessSafeScaffoldTarget({
    selectedPath: emptyDir,
    currentProjectRoot: PROJECT,
  });
  if (check.status !== "safe") fail(`Expected safe temp folder, got ${check.status}`);

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  injectSafeTarget(emptyDir, check);

  spawn(EXE, ["--remote-debugging-port=9250"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 7000));

  const { page, evaluate, snap, ws } = await connect();
  report.launch = {
    pageUrl: page.url,
    usesAsar: /app\.asar/i.test(page.url || ""),
    usesVite: /5173|vite/i.test(page.url || ""),
  };

  const headerText = await evaluate(`document.body.innerText.slice(0, 4000)`);
  report.shell = {
    dashboard: /Daily Next Action|Workflow Progress|Workflow Health/i.test(headerText),
    guideTab: await btnExists(evaluate, "Guide"),
    blueprintTab: await btnExists(evaluate, "Blueprint"),
    buildTab: await btnExists(evaluate, "Build"),
    projectSetupTab: await btnExists(evaluate, "Project Setup"),
    reportsTab: await btnExists(evaluate, "Reports"),
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));

  // Target restores stale — refresh to unlock preview
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await new Promise((r) => setTimeout(r, 600));

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes("/.nttc/") && !f.includes("\\.nttc\\"),
  );
  let nttcPlanningBefore = 0;
  try {
    const p = path.join(PROJECT, ".nttc", "planning");
    nttcPlanningBefore = fs.existsSync(p) ? fs.readdirSync(p).length : 0;
  } catch {
    nttcPlanningBefore = 0;
  }
  const advisorBefore = (await snap()).advisorResponse;
  const emptyBefore = fs.readdirSync(emptyDir);

  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 800));
  let buildText = await evaluate(`document.body.innerText`);
  const buildButtons = await evaluate(`(() => {
    return [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean);
  })()`);

  report.buildUi = {
    planningOnly: /Planning Only/i.test(buildText),
    targetSection: /Safe Scaffold Target Folder/i.test(buildText),
    fileTreeSection: /Safe Scaffold File Tree Preview/i.test(buildText),
    fileContentSection: /Safe Scaffold File Content Preview/i.test(buildText),
    writeManifestSection: /Safe Scaffold Write Manifest Preview/i.test(buildText),
    finalConfirmationSection: /Safe Scaffold Final Confirmation/i.test(buildText),
    generateManifestBtn: buildButtons.some((b) =>
      /^Generate Write Manifest Preview$/i.test(b),
    ),
    reviewFinalConfirmBtn: buildButtons.some((b) =>
      /^Review Final Confirmation$/i.test(b),
    ),
    clearFinalConfirmBtn: buildButtons.some((b) =>
      /^Clear Final Confirmation$/i.test(b),
    ),
    copyFinalConfirmBtn: buildButtons.some((b) =>
      /^Copy Confirmation Summary$/i.test(b),
    ),
    disabledWriteFilesBtn: buildButtons.some((b) =>
      /^Write Files — Disabled until next stage$/i.test(b),
    ),
    noCreateFiles: !buildButtons.some((b) => /^Create Files$/i.test(b)),
    noScaffold: !buildButtons.some((b) => /^Scaffold$/i.test(b)),
    noWriteEnabled: !buildButtons.some((b) => /^Write Files$/i.test(b)),
    noInstall: !buildButtons.some((b) => /^Install$/i.test(b)),
    noRun: !buildButtons.some((b) => /^Run$/i.test(b)),
    focusTarget: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="build-mode-target-folder"]'))`,
    ),
    focusTree: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="build-mode-file-tree-preview"]'))`,
    ),
    focusContent: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="build-mode-file-content-preview"]'))`,
    ),
    focusManifest: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="build-mode-write-manifest-preview"]'))`,
    ),
    focusFinalConfirm: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="build-mode-final-confirmation"]'))`,
    ),
    ackLanguage: /will not overwrite existing files/i.test(buildText),
    stage127Ack: /Stage 127 does not create files/i.test(buildText),
  };

  // Blueprint + task cards
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: "Stage 128 final confirmation packaging smoke.",
      projectType: "web-app",
      buildStyle: "small-model-friendly",
    })})`,
  );
  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 1000));

  // After task cards, target may still be ok but tree stale — refresh target then generate
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(
    `window.nttc.recordSafeScaffoldFinalConfirmation(${JSON.stringify({
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget: false,
    })})`,
  );
  await new Promise((r) => setTimeout(r, 800));

  let s = await snap();
  const treePreview = s.safeScaffoldFileTreePreview?.saved;
  const contentPreview = s.safeScaffoldFileContentPreview?.saved;
  const manifestPreview = s.safeScaffoldWriteManifestPreview?.saved;
  const finalConfirm = s.safeScaffoldFinalConfirmation?.saved;
  const coveredLive = new Set([
    ...(manifestPreview?.readyToCreate ?? []).map((e) => e.relativePath),
    ...(manifestPreview?.notReady ?? []).map((e) => e.relativePath),
  ]);
  report.preview = {
    treeExists: Boolean(treePreview),
    contentExists: Boolean(contentPreview),
    manifestExists: Boolean(manifestPreview),
    confirmationExists: Boolean(finalConfirm),
    confirmationStale: Boolean(finalConfirm?.stale),
    readyCount: finalConfirm?.readyToCreateCount ?? 0,
    notReadyCount: finalConfirm?.notReadyCount ?? 0,
    everyPathClassified: (treePreview?.proposedRelativePaths ?? []).every((p) =>
      coveredLive.has(p),
    ),
    hasHeader: /# NTTC Safe Scaffold Final Confirmation Summary/.test(
      finalConfirm?.markdown ?? "",
    ),
    hasStatus: /## Status/.test(finalConfirm?.markdown ?? ""),
    hasTarget: /## Target Folder/.test(finalConfirm?.markdown ?? ""),
    hasReady: /## Ready-To-Create Files/.test(finalConfirm?.markdown ?? ""),
    hasNotReady: /## Not-Ready Files/.test(finalConfirm?.markdown ?? ""),
    hasSafety: /## Safety Boundaries/.test(finalConfirm?.markdown ?? ""),
    hasNext: /## Next Step/.test(finalConfirm?.markdown ?? ""),
    noFilesCreated: /No files have been created/i.test(
      finalConfirm?.markdown ?? "",
    ),
    stillDisabled:
      /still disabled|later stage may add the first actual scaffold write/i.test(
        finalConfirm?.markdown ?? "",
      ),
  };

  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 600));
  buildText = await evaluate(`document.body.innerText`);
  report.buildUi.checklistFileTree =
    /Scaffold file tree preview generated/i.test(buildText);
  report.buildUi.checklistFileContents =
    /Scaffold file contents preview generated/i.test(buildText);
  report.buildUi.checklistWriteManifest =
    /Write manifest preview prepared/i.test(buildText);
  report.buildUi.checklistFinalConfirm =
    /Future write confirmation recorded/i.test(buildText);
  report.buildUi.finalConfirmStatusCard =
    /Final Confirmation Status/i.test(buildText);
  report.buildUi.laterActualWritten =
    /Actual files written[\s\S]*later stage/i.test(buildText);
  report.buildUi.laterManifestAfterWrite =
    /Written-files manifest after write[\s\S]*later stage/i.test(buildText);
  report.buildUi.stillNoWriteUnlocked =
    !buildButtons.some((b) => /^Create Files$/i.test(b)) &&
    !buildButtons.some((b) => /^Write Files$/i.test(b));
  report.buildUi.disabledWriteStillDisabled = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /^Write Files — Disabled until next stage$/i.test((x.textContent || '').trim()),
    );
    return Boolean(b && b.disabled);
  })()`);

  // Copy APIs
  await evaluate(`window.nttc.recordCopySafeScaffoldWriteManifestPreview()`);
  await evaluate(`window.nttc.recordCopySafeScaffoldFinalConfirmation()`);
  await new Promise((r) => setTimeout(r, 300));

  // Stale after regenerate file-tree
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.staleAfterTreeRegen = Boolean(
    s.safeScaffoldFinalConfirmation?.saved?.stale,
  );

  // Stale after content regen
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(
    `window.nttc.recordSafeScaffoldFinalConfirmation(${JSON.stringify({
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget: false,
    })})`,
  );
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  report.staleAfterContentRegen = Boolean(
    s.safeScaffoldFinalConfirmation?.saved?.stale,
  );

  // Stale after manifest regen
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await evaluate(
    `window.nttc.recordSafeScaffoldFinalConfirmation(${JSON.stringify({
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget: false,
    })})`,
  );
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  report.staleAfterManifestRegen = Boolean(
    s.safeScaffoldFinalConfirmation?.saved?.stale,
  );

  // Regenerate for task-card stale test
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await evaluate(
    `window.nttc.recordSafeScaffoldFinalConfirmation(${JSON.stringify({
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget: false,
    })})`,
  );
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.staleAfterTaskCards = Boolean(
    s.safeScaffoldFinalConfirmation?.saved?.stale,
  );

  // Regenerate fresh for persistence test
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await evaluate(
    `window.nttc.recordSafeScaffoldFinalConfirmation(${JSON.stringify({
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget: false,
    })})`,
  );
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.previewFresh = Boolean(
    s.safeScaffoldFinalConfirmation?.saved &&
      !s.safeScaffoldFinalConfirmation.saved.stale,
  );

  let nttcPlanningAfter = 0;
  try {
    const p = path.join(PROJECT, ".nttc", "planning");
    nttcPlanningAfter = fs.existsSync(p) ? fs.readdirSync(p).length : 0;
  } catch {
    nttcPlanningAfter = 0;
  }
  report.noWrite = {
    srcFileCountSame:
      listProjectFiles(PROJECT).filter(
        (f) => !f.includes("/.nttc/") && !f.includes("\\.nttc\\"),
      ).length === srcBefore.length,
    planningCountUnchangedByBuild: nttcPlanningAfter === nttcPlanningBefore,
    noAdvisorCall: advisorBefore === (await snap()).advisorResponse,
    tempEmptyUnchanged: fs.readdirSync(emptyDir).length === emptyBefore.length,
  };

  // Guide
  await clickTab(evaluate, "Guide");
  await new Promise((r) => setTimeout(r, 500));
  const guideText = await evaluate(`document.body.innerText`);
  report.guide = {
    finalConfirmNote:
      /Safe Scaffold Final Confirmation records readiness for a future write stage/i.test(
        guideText,
      ),
    writeManifestNote:
      /Safe Scaffold Write Manifest Preview lists exactly which files a future write stage would create/i.test(
        guideText,
      ),
    fileContentNote:
      /Safe Scaffold File Content Preview shows deterministic starter contents in memory only/i.test(
        guideText,
      ),
    fileTreeNote:
      /Safe Scaffold File Tree Preview shows proposed relative file paths only/i.test(
        guideText,
      ),
    targetNote: /Target folder safety checks are metadata-only/i.test(guideText),
  };

  // Reports
  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 800));
  const reportsText = await evaluate(`document.body.innerText`);
  report.reports = {
    workflowFinalConfirm: /Safe Scaffold Final Confirmation/i.test(reportsText),
    workflowWriteManifest: /Safe Scaffold Write Manifest Preview/i.test(
      reportsText,
    ),
    workflowFileContent: /Safe Scaffold File Content Preview/i.test(reportsText),
    workflowFileTree: /Safe Scaffold File Tree Preview/i.test(reportsText),
    workflowTarget: /Safe Scaffold Target Folder/i.test(reportsText),
    architectureHealth: /Architecture Health/i.test(reportsText),
    architectureRefactor: /Architecture Refactor Task Cards/i.test(reportsText),
    auditPatch:
      /Code Context Pack/i.test(reportsText) &&
      /Patch Draft Mode/i.test(reportsText) &&
      /Manual Patch Draft Import/i.test(reportsText) &&
      /Patch Draft Safety Review/i.test(reportsText) &&
      /External Patch Draft Comparison/i.test(reportsText) &&
      /Builder Handoff Export/i.test(reportsText),
    changedFiles: /Changed Files|Patch Review Pack/i.test(reportsText),
    noApplyPatch: report.shell.noApplyPatch,
  };

  // Blueprint regression
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
  await evaluate(`window.nttc.generateBlueprintPlannerPrompt()`);
  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await evaluate(`window.nttc.generateBlueprintPhase1Handoff()`);
  s = await snap();
  const cards = s.blueprint?.phaseTaskCards?.saved?.cards ?? [];
  const firstTaskId = cards[0]?.id ?? "P1A";
  await evaluate(
    `window.nttc.setTaskCardBuilderHandoffSelectedTask(${JSON.stringify(firstTaskId)})`,
  );
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeSelectedTask(${JSON.stringify(firstTaskId)})`,
  );
  await evaluate(`window.nttc.setTaskImplementationIntakeBuilderSource("Cursor")`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(TASK_INTAKE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  await evaluate(`window.nttc.stageTaskImplementationReportForReview()`);
  await evaluate(`window.nttc.generateBlueprintTaskReconciliation()`).catch(() => {});
  await evaluate(`window.nttc.generateTaskArtifactIndex()`).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.blueprint = {
    questions: Boolean(s.blueprint?.plannerQuestions),
    prompt: Boolean(s.blueprint?.plannerPrompt),
    imported: Boolean(s.blueprint?.importedBlueprint),
    completeness: Boolean(s.blueprint?.completenessReport),
    planningPreview: (s.blueprint?.planningDocsPreview?.files?.length ?? 0) > 0,
    phase1: Boolean(s.blueprint?.phase1Handoff),
    taskCards: cards.length > 0,
    taskHandoff: Boolean(s.blueprint?.taskCardBuilderHandoff?.saved),
    taskIntake: /Task Implementation Intake Summary/i.test(
      s.blueprint?.taskImplementationIntake?.selectedReport?.summaryMarkdown ?? "",
    ),
    reconciliation: Boolean(s.blueprint?.taskReconciliation?.saved),
    artifactIndex: Boolean(s.blueprint?.taskArtifactIndex?.saved),
    noAutoImplReview: !s.implementationReview?.saved,
  };

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 400));

  // Ensure a current final confirmation exists before restart persistence
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await evaluate(
    `window.nttc.recordSafeScaffoldFinalConfirmation(${JSON.stringify({
      futureWriteBoundaries: true,
      stage127NoWrite: true,
      cautionTarget: false,
    })})`,
  );
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const beforeRestartMarkdown =
    s.safeScaffoldFinalConfirmation?.saved?.markdown?.slice(0, 80) ?? "";

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2000));

  // Restart — restore confirmation (stale is expected on restore)
  spawn(EXE, ["--remote-debugging-port=9250"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 7000));
  let conn = await connect();
  await conn.evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await conn.snap();
  report.persistenceRestore = {
    hasPreview: Boolean(s.safeScaffoldFinalConfirmation?.saved?.markdown),
    stale: Boolean(s.safeScaffoldFinalConfirmation?.saved?.stale),
    noSourceBodiesStored: !(JSON.stringify(
      s.safeScaffoldFinalConfirmation?.saved ?? {},
    ).includes("EXISTING_SOURCE_MARKER_SHOULD_NOT_APPEAR")),
    markdownSnippetMatches: Boolean(
      beforeRestartMarkdown &&
        (s.safeScaffoldFinalConfirmation?.saved?.markdown ?? "").includes(
          beforeRestartMarkdown.slice(0, 40),
        ),
    ),
  };

  await conn.evaluate(`window.nttc.clearSafeScaffoldFinalConfirmation()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await conn.snap();
  report.persistenceClear = {
    cleared: !s.safeScaffoldFinalConfirmation?.saved,
  };
  conn.ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2000));

  spawn(EXE, ["--remote-debugging-port=9250"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 7000));
  conn = await connect();
  await conn.evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await conn.snap();
  report.persistenceClearedPersists = {
    stillCleared: !s.safeScaffoldFinalConfirmation?.saved,
  };
  conn.ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  try {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  if (!report.launch.usesAsar || report.launch.usesVite) fail("Not packaged asar launch");
  if (!report.shell.buildTab) fail("Build tab missing");
  if (!report.buildUi.writeManifestSection) fail("Write Manifest Preview section missing");
  if (!report.buildUi.finalConfirmationSection) {
    fail("Final Confirmation section missing");
  }
  if (!report.buildUi.reviewFinalConfirmBtn) fail("Review Final Confirmation missing");
  if (!report.buildUi.clearFinalConfirmBtn) fail("Clear Final Confirmation missing");
  if (!report.buildUi.disabledWriteFilesBtn) {
    fail("Disabled Write Files placeholder missing");
  }
  if (!report.buildUi.disabledWriteStillDisabled) {
    fail("Write Files placeholder was enabled");
  }
  if (!report.buildUi.noCreateFiles) fail("Create Files button found");
  if (!report.buildUi.noScaffold) fail("Scaffold button found");
  if (!report.buildUi.noWriteEnabled) fail("Enabled Write Files button found");
  if (!report.buildUi.noInstall) fail("Install button found");
  if (!report.buildUi.noRun) fail("Run button found");
  if (!report.preview.confirmationExists) fail("Final confirmation did not record");
  if (!report.preview.everyPathClassified) fail("Not every path was classified");
  if (!report.preview.hasHeader) fail("Confirmation missing header");
  if (!report.preview.noFilesCreated) fail("Confirmation missing no-files-created claim");
  if (!report.staleAfterTreeRegen) fail("Confirmation did not stale after tree regen");
  if (!report.staleAfterContentRegen) {
    fail("Confirmation did not stale after content regen");
  }
  if (!report.staleAfterManifestRegen) {
    fail("Confirmation did not stale after manifest regen");
  }
  if (!report.staleAfterTaskCards) fail("Confirmation did not stale after task cards");
  if (!report.noWrite.srcFileCountSame) fail("Source files changed");
  if (!report.noWrite.noAdvisorCall) fail("Unexpected AI advisor call");
  if (!report.noWrite.tempEmptyUnchanged) fail("Temp target folder was written");
  if (!report.guide.finalConfirmNote) fail("Guide missing final-confirmation note");
  if (!report.reports.workflowFinalConfirm) {
    fail("Workflow missing Final Confirmation step");
  }
  if (!report.blueprint.taskIntake) fail("Blueprint task intake failed");
  if (!report.blueprint.noAutoImplReview) fail("Implementation Review auto-ran");
  if (!report.persistenceRestore.hasPreview) fail("Final confirmation did not restore");
  if (!report.persistenceRestore.stale) fail("Restored confirmation should be stale");
  if (!report.persistenceClear.cleared) fail("Clear confirmation failed");
  if (!report.persistenceClearedPersists.stillCleared) {
    fail("Cleared confirmation reappeared after restart");
  }

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
  console.log(JSON.stringify(report, null, 2));
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  process.exit(1);
}
