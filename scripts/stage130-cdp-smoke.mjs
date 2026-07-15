/**
 * Stage 130 packaged-app smoke — Safe Scaffold Write after Stage 129 First Guarded Write.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9250
 *
 * Native folder dialog is not CDP-automatable; injects a Safe target into history
 * then refreshes safety and generates tree + content + write-manifest + final confirmation,
 * then exercises Write Safe Scaffold Files (native MessageBox dismissed via SendKeys).
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
const WRITE_EVAL_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildSafeScaffoldWrite.js",
);
const PATH_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildModeFileTreePreview.js",
);

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 130 disposable smoke blueprint for guarded Safe Scaffold Write.
## Product Requirements
Verify packaged Safe Scaffold Write creates files only in a Safe empty target.
## User Stories
As a user I want Write Safe Scaffold Files after final confirmation.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A.
## Screen / Workflow Flow
Build tab Safe Scaffold Write.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/BuildModeTab.tsx
## Build Phases
1A — Stage 130 smoke
## Validation Plan
Packaged CDP smoke with live guarded write.
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
Stage 130 Blueprint regression after Stage 129 write.

## 2. Plan
Confirm Blueprint still works after Stage 129 packaging.

## 3. Files changed
- none in Stage 130 product source (smoke only)

## 4. Implementation summary
Packaging + write smoke.

## 5. Validation performed
Packaged smoke with guarded write.

## 6. Behavior preservation checks
No Apply Patch. Write is create-only into Safe empty target.

## 7. Risks
Low.

## 8. Safety confirmations
No source editing by NTTC.

## 9. Questions / blockers
None.
`;

const ACKS_SAFE = {
  futureWriteBoundaries: true,
  stage127NoWrite: true,
  cautionTarget: false,
};

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

function listFilesRecursive(root) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
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
    selectedPath: fs.realpathSync.native(check.resolvedPath || emptyDir),
    lastCheck: {
      ...check,
      resolvedPath: fs.realpathSync.native(check.resolvedPath || emptyDir),
      selectedPath: fs.realpathSync.native(check.resolvedPath || emptyDir),
    },
    stale: false,
  };
  // Clear previews + write result so generate/write is fresh
  raw.projects[found].safeScaffoldFileTreePreview = null;
  raw.projects[found].safeScaffoldFileContentPreview = null;
  raw.projects[found].safeScaffoldWriteManifestPreview = null;
  raw.projects[found].safeScaffoldFinalConfirmation = null;
  raw.projects[found].safeScaffoldWriteResult = null;
  fs.writeFileSync(HISTORY, JSON.stringify(raw, null, 2), "utf8");
  return found;
}

/**
 * Dismiss native MessageBox ["Cancel","Create Files"] via TAB+ENTER on dialog HWND.
 * Uses repo script (scripts/stage130-accept-write-dialog.ps1).
 */
function scheduleWriteDialogAccept() {
  const scriptPath = path.join(REPO, "scripts", "stage130-accept-write-dialog.ps1");
  const statusPath = path.join(
    os.tmpdir(),
    `nttc-stage130-accept-write-${Date.now()}.status.txt`,
  );
  const logPath = path.join(os.tmpdir(), "nttc-stage130-dialog-helper.log");
  const out = fs.openSync(logPath, "w");
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-StatusPath",
      statusPath,
    ],
    {
      detached: false,
      stdio: ["ignore", out, out],
      windowsHide: true,
      cwd: REPO,
    },
  );
  child.on("error", (err) => {
    fs.appendFileSync(logPath, `\nspawn error: ${err.message}\n`);
  });
  child.on("exit", (code) => {
    fs.appendFileSync(logPath, `\nexit code: ${code}\n`);
  });
  report.dialogAccept = { scriptPath, statusPath, logPath, pid: child.pid };
}

async function regenerateWriteStack(evaluate) {
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateSafeScaffoldWriteManifestPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(
    `window.nttc.recordSafeScaffoldFinalConfirmation(${JSON.stringify(ACKS_SAFE)})`,
  );
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.recheckSafeScaffoldWriteReadiness()`);
  await new Promise((r) => setTimeout(r, 400));
}

async function waitForCanWrite(snap, evaluate, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const s = await snap();
    if (s.safeScaffoldWrite?.canWrite) return s;
    await evaluate(`window.nttc.recheckSafeScaffoldWriteReadiness()`);
    await new Promise((r) => setTimeout(r, 400));
  }
  return snap();
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
    stage129Wiring:
      bundleText.includes("Safe Scaffold Write") &&
      bundleText.includes("Write Safe Scaffold Files") &&
      bundleText.includes("Re-check Write Readiness") &&
      bundleText.includes("Safe Scaffold Final Confirmation") &&
      bundleText.includes("Safe Scaffold Write Manifest Preview") &&
      bundleText.includes("Clear Write Result") &&
      bundleText.includes("Copy Write Result") &&
      bundleText.includes("Safe Scaffold Target Folder") &&
      (bundleText.includes("Planning Only") ||
        bundleText.includes("Build Mode Status")),
    noApplyPatch: !bundleText.includes("Apply Patch"),
    guideNote:
      /Safe Scaffold Write creates new files only after final confirmation/i.test(
        bundleText,
      ),
  };
  if (!report.bundle.stage129Wiring) fail("Bundle missing Stage 129 write wiring");
  if (!report.bundle.noApplyPatch) fail("Bundle unexpectedly contains Apply Patch");
  if (!report.bundle.guideNote) fail("Bundle missing Guide Safe Scaffold Write note");

  // Path safety structural (deterministic)
  const pathMod = await import(pathToFileURL(PATH_JS).href);
  const builderMod = await import(pathToFileURL(BUILDER_JS).href);
  const contentMod = await import(pathToFileURL(CONTENT_BUILDER_JS).href);
  const manifestMod = await import(pathToFileURL(MANIFEST_BUILDER_JS).href);
  const confirmMod = await import(pathToFileURL(CONFIRM_BUILDER_JS).href);
  const writeMod = await import(pathToFileURL(WRITE_EVAL_JS).href);
  const validate = pathMod.validateProposedRelativePath;
  const buildPreview = builderMod.buildSafeScaffoldFileTreePreview;
  const buildContent = contentMod.buildSafeScaffoldFileContentPreview;
  const buildManifest = manifestMod.buildSafeScaffoldWriteManifestPreview;
  const buildFinalConfirmation = confirmMod.buildSafeScaffoldFinalConfirmation;
  const evaluateWritePreconditions =
    writeMod.evaluateSafeScaffoldWritePreconditions;

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

  // Structural write stack (Safe target) for precondition matrix
  const safeTree = buildPreview({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 2,
    taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
    targetFolderPath: "D:\\empty-target",
    targetSafetyStatus: "safe",
  });
  const safeContent = buildContent({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 2,
    taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
    targetFolderPath: "D:\\empty-target",
    targetSafetyStatus: "safe",
    fileTreeGeneratedAt: safeTree.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    proposedRelativePaths: safeTree.record?.proposedRelativePaths ?? [],
  });
  const safeManifest = buildManifest({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 2,
    taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
    targetFolderPath: "D:\\empty-target",
    targetSafetyStatus: "safe",
    fileTreeGeneratedAt: safeTree.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    proposedRelativePaths: safeTree.record?.proposedRelativePaths ?? [],
    fileContentGeneratedAt:
      safeContent.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    templatedFiles: safeContent.record?.templatedFiles ?? [],
    filesWithoutContents: safeContent.record?.filesWithoutContents ?? [],
  });
  const safeConfirm = buildFinalConfirmation({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 2,
    targetFolderPath: "D:\\empty-target",
    targetSafetyStatus: "safe",
    fileTreeGeneratedAt: safeTree.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    proposedRelativePaths: safeTree.record?.proposedRelativePaths ?? [],
    fileContentGeneratedAt:
      safeContent.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    templatedRelativePaths: (safeContent.record?.templatedFiles ?? []).map(
      (f) => f.relativePath,
    ),
    filesWithoutContents: safeContent.record?.filesWithoutContents ?? [],
    writeManifestGeneratedAt:
      safeManifest.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    readyToCreate: safeManifest.record?.readyToCreate ?? [],
    notReady: safeManifest.record?.notReady ?? [],
    acknowledgements: ACKS_SAFE,
  });
  if (!safeConfirm.record) fail("Structural Safe final confirmation failed to build");

  const writeBase = {
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
    finalConfirmationAcks: ACKS_SAFE,
    proposedRelativePaths: safeTree.record?.proposedRelativePaths ?? [],
    readyToCreate: safeManifest.record?.readyToCreate ?? [],
    notReady: safeManifest.record?.notReady ?? [],
  };

  report.writePreconditions = {
    noBlueprint: !evaluateWritePreconditions({
      ...writeBase,
      blueprintImported: false,
    }).canWrite,
    noCards: !evaluateWritePreconditions({ ...writeBase, taskCardCount: 0 }).canWrite,
    noTarget: !evaluateWritePreconditions({
      ...writeBase,
      targetFolderPath: null,
    }).canWrite,
    cautionBlocked: !evaluateWritePreconditions({
      ...writeBase,
      targetSafetyStatus: "caution",
    }).canWrite,
    blockedTarget: !evaluateWritePreconditions({
      ...writeBase,
      targetSafetyStatus: "blocked",
    }).canWrite,
    staleTarget: !evaluateWritePreconditions({
      ...writeBase,
      targetStale: true,
    }).canWrite,
    noTree: !evaluateWritePreconditions({
      ...writeBase,
      fileTreeExists: false,
    }).canWrite,
    noContent: !evaluateWritePreconditions({
      ...writeBase,
      fileContentExists: false,
    }).canWrite,
    noManifest: !evaluateWritePreconditions({
      ...writeBase,
      writeManifestExists: false,
    }).canWrite,
    noConfirmation: !evaluateWritePreconditions({
      ...writeBase,
      finalConfirmationExists: false,
    }).canWrite,
    staleConfirmation: !evaluateWritePreconditions({
      ...writeBase,
      finalConfirmationStale: true,
    }).canWrite,
    blockedPath: !evaluateWritePreconditions({
      ...writeBase,
      notReady: [
        {
          relativePath: "../x.ts",
          reason: "bad",
          pathStatus: "blocked-path",
        },
      ],
    }).canWrite,
    blockedContent: !evaluateWritePreconditions({
      ...writeBase,
      notReady: [
        {
          relativePath: "bad.ts",
          reason: "unsafe",
          pathStatus: "blocked-content",
        },
      ],
    }).canWrite,
    zeroReady: !evaluateWritePreconditions({
      ...writeBase,
      readyToCreate: [],
    }).canWrite,
    incompleteAcks: !evaluateWritePreconditions({
      ...writeBase,
      finalConfirmationAcks: {
        futureWriteBoundaries: false,
        stage127NoWrite: false,
        cautionTarget: false,
      },
    }).canWrite,
    safeOk: evaluateWritePreconditions(writeBase).canWrite === true,
  };
  if (Object.values(report.writePreconditions).some((v) => !v)) {
    fail("Write precondition matrix failed");
  }
  if (!report.writePreconditions.cautionBlocked) {
    fail("Caution target must remain blocked for Stage 129/130 write");
  }

  // Caution may still generate confirm/manifest, but write must stay blocked
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
  report.cautionWriteBlocked = {
    manifestGenerated: Boolean(cautionBuilt.record),
    writeBlocked: !evaluateWritePreconditions({
      ...writeBase,
      targetFolderPath: "D:\\caution",
      targetSafetyStatus: "caution",
      proposedRelativePaths: cautionTree.record?.proposedRelativePaths ?? [],
      readyToCreate: cautionBuilt.record?.readyToCreate ?? [],
      notReady: cautionBuilt.record?.notReady ?? [],
      finalConfirmationAcks: {
        futureWriteBoundaries: true,
        stage127NoWrite: true,
        cautionTarget: true,
      },
    }).canWrite,
  };
  if (!report.cautionWriteBlocked.writeBlocked) {
    fail("Caution target was allowed to write");
  }

  const tmpRoot = fs.realpathSync.native(os.tmpdir());
  const emptyDir = fs.mkdtempSync(path.join(tmpRoot, "nttc-s130-safe-"));
  const assessMod = await import(pathToFileURL(ASSESS_JS).href);
  const check = assessMod.assessSafeScaffoldTarget({
    selectedPath: emptyDir,
    currentProjectRoot: PROJECT,
  });
  if (check.status !== "safe") fail(`Expected safe temp folder, got ${check.status}`);
  // Prefer long-path forms so Windows 8.3 TEMP short names do not trip linkSafety.
  if (check.resolvedPath) {
    try {
      check.resolvedPath = fs.realpathSync.native(check.resolvedPath);
    } catch {
      /* keep resolvedPath */
    }
  }

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

  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await new Promise((r) => setTimeout(r, 600));

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) =>
      !f.includes("/.nttc/") &&
      !f.includes("\\.nttc\\") &&
      !/stage130-accept-write.*\.status\.txt$/i.test(f) &&
      !/stage130-dialog-helper\.log$/i.test(f),
  );
  let nttcPlanningBefore = 0;
  try {
    const p = path.join(PROJECT, ".nttc", "planning");
    nttcPlanningBefore = fs.existsSync(p) ? fs.readdirSync(p).length : 0;
  } catch {
    nttcPlanningBefore = 0;
  }
  const advisorBefore = (await snap()).advisorResponse;
  const emptyBefore = listFilesRecursive(emptyDir);

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
    writeSection: /Safe Scaffold Write/i.test(buildText),
    recheckWriteBtn: buildButtons.some((b) => /^Re-check Write Readiness$/i.test(b)),
    writeSafeScaffoldBtn: buildButtons.some((b) =>
      /^Write Safe Scaffold Files$/i.test(b),
    ),
    copyWriteResultBtn: buildButtons.some((b) => /^Copy Write Result$/i.test(b)),
    clearWriteResultBtn: buildButtons.some((b) => /^Clear Write Result$/i.test(b)),
    generateManifestBtn: buildButtons.some((b) =>
      /^Generate Write Manifest Preview$/i.test(b),
    ),
    reviewFinalConfirmBtn: buildButtons.some((b) =>
      /^Review Final Confirmation$/i.test(b),
    ),
    noApplyPatch: !buildButtons.some((b) => /^Apply Patch$/i.test(b)),
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
    focusWrite: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="build-mode-safe-scaffold-write"]'))`,
    ),
  };

  // Blueprint + task cards
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: "Stage 130 Safe Scaffold Write packaging smoke.",
      projectType: "web-app",
      buildStyle: "small-model-friendly",
    })})`,
  );
  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 1000));

  await regenerateWriteStack(evaluate);

  let s = await snap();
  const treePreview = s.safeScaffoldFileTreePreview?.saved;
  const contentPreview = s.safeScaffoldFileContentPreview?.saved;
  const manifestPreview = s.safeScaffoldWriteManifestPreview?.saved;
  const finalConfirm = s.safeScaffoldFinalConfirmation?.saved;
  const coveredLive = new Set([
    ...(manifestPreview?.readyToCreate ?? []).map((e) => e.relativePath),
    ...(manifestPreview?.notReady ?? []).map((e) => e.relativePath),
  ]);
  const readyPaths = (manifestPreview?.readyToCreate ?? []).map((e) =>
    e.relativePath.replace(/\\/g, "/"),
  );
  const directoryOnlyPaths = (manifestPreview?.notReady ?? [])
    .filter((e) => e.pathStatus === "directory-only")
    .map((e) => e.relativePath.replace(/\\/g, "/"));

  report.preview = {
    treeExists: Boolean(treePreview),
    contentExists: Boolean(contentPreview),
    manifestExists: Boolean(manifestPreview),
    confirmationExists: Boolean(finalConfirm),
    confirmationStale: Boolean(finalConfirm?.stale),
    readyCount: readyPaths.length,
    notReadyCount: (manifestPreview?.notReady ?? []).length,
    everyPathClassified: (treePreview?.proposedRelativePaths ?? []).every((p) =>
      coveredLive.has(p),
    ),
    canWriteBefore: Boolean(s.safeScaffoldWrite?.canWrite),
  };

  s = await waitForCanWrite(snap, evaluate);
  report.preview.canWrite = Boolean(s.safeScaffoldWrite?.canWrite);
  if (!report.preview.canWrite) fail("Write readiness never reached canWrite");

  // --- Live happy-path write (critical) ---
  scheduleWriteDialogAccept();
  let helperReady = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (
      report.dialogAccept?.statusPath &&
      fs.existsSync(report.dialogAccept.statusPath)
    ) {
      report.dialogAccept.preWriteStatus = fs
        .readFileSync(report.dialogAccept.statusPath, "utf8")
        .trim();
      helperReady = true;
      break;
    }
  }
  if (!helperReady) {
    const logSnippet =
      report.dialogAccept?.logPath && fs.existsSync(report.dialogAccept.logPath)
        ? fs.readFileSync(report.dialogAccept.logPath, "utf8").slice(0, 500)
        : "(no log)";
    fail(
      `Write dialog accept helper did not start (status missing before write). log=${logSnippet}`,
    );
  }
  try {
    await Promise.race([
      evaluate(`window.nttc.writeSafeScaffoldFiles()`),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("writeSafeScaffoldFiles CDP timeout (60s)")),
          60000,
        ),
      ),
    ]);
  } catch (err) {
    fail(`Live write evaluate: ${err.message || err}`);
    // Unblock main-process MessageBox so later CDP calls can proceed.
    spawn(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W{ [DllImport(\"user32.dll\",CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c,string n); [DllImport(\"user32.dll\")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l); }'; $h=[W]::FindWindow('#32770','Safe Scaffold Write'); if($h -ne [IntPtr]::Zero){ [W]::PostMessage($h,0x0010,[IntPtr]::Zero,[IntPtr]::Zero) }",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (report.dialogAccept?.statusPath && fs.existsSync(report.dialogAccept.statusPath)) {
    report.dialogAccept.status = fs
      .readFileSync(report.dialogAccept.statusPath, "utf8")
      .trim();
    if (!/^accepted\b/i.test(report.dialogAccept.status)) {
      // Helper status can lag; live write success is authoritative.
      await new Promise((r) => setTimeout(r, 1500));
      if (fs.existsSync(report.dialogAccept.statusPath)) {
        report.dialogAccept.status = fs
          .readFileSync(report.dialogAccept.statusPath, "utf8")
          .trim();
      }
    }
  } else {
    fail("Write dialog accept status file missing");
  }
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  const writeSaved = s.safeScaffoldWrite?.saved;
  const createdPaths = (writeSaved?.createdRelativePaths ?? []).map((p) =>
    p.replace(/\\/g, "/"),
  );
  if (
    report.dialogAccept?.status &&
    !/^accepted\b/i.test(report.dialogAccept.status) &&
    createdPaths.length === 0
  ) {
    fail(`Write dialog accept status: ${report.dialogAccept.status}`);
  } else if (
    report.dialogAccept?.status &&
    !/^accepted\b/i.test(report.dialogAccept.status) &&
    createdPaths.length > 0
  ) {
    report.warnings.push(
      `Dialog helper status was '${report.dialogAccept.status}' but write succeeded (${createdPaths.length} files).`,
    );
  }
  const writeMd = writeSaved?.markdown ?? "";
  const emptyAfterWrite = listFilesRecursive(emptyDir);

  report.liveWrite = {
    saved: Boolean(writeSaved),
    createdCount: createdPaths.length,
    statusMessage: s.safeScaffoldWrite?.statusMessage ?? null,
    readinessBlockedReasons: s.safeScaffoldWrite?.readinessBlockedReasons ?? [],
    uiStatus: s.safeScaffoldWrite?.uiStatus ?? null,
    hasWriteResultHeader: /# NTTC Safe Scaffold Write Result/.test(writeMd),
    hasRollbackNote:
      /did not run commands or install packages/i.test(writeMd) ||
      /Manual Rollback Note/i.test(writeMd) ||
      /did not run commands or install packages/i.test(
        writeSaved?.rollbackNote ?? "",
      ),
    spotCheckOk: false,
    directoryOnlyNotFiles: true,
    emptyDirHasCreated: false,
    emptyDirFileCount: emptyAfterWrite.length,
  };

  if (!writeSaved || createdPaths.length === 0) {
    fail("Live write did not save createdRelativePaths");
  } else {
    const spot = createdPaths.slice(0, Math.min(5, createdPaths.length));
    report.liveWrite.spotCheckOk = spot.every((rel) =>
      fs.existsSync(path.join(emptyDir, ...rel.split("/"))),
    );
    if (!report.liveWrite.spotCheckOk) fail("Spot-check: created path missing on disk");

    for (const dirRel of directoryOnlyPaths) {
      const abs = path.join(emptyDir, ...dirRel.split("/"));
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        report.liveWrite.directoryOnlyNotFiles = false;
        fail(`Directory-only path was created as a file: ${dirRel}`);
      }
    }

    const createdAbs = new Set(
      createdPaths.map((rel) =>
        path.join(emptyDir, ...rel.split("/")).replace(/\\/g, "/").toLowerCase(),
      ),
    );
    const afterLower = emptyAfterWrite.map((f) => f.toLowerCase());
    report.liveWrite.emptyDirHasCreated = [...createdAbs].every((abs) =>
      afterLower.includes(abs),
    );
    if (!report.liveWrite.emptyDirHasCreated) {
      fail("emptyDir missing one or more created files");
    }
    if (emptyAfterWrite.length < createdPaths.length) {
      fail("emptyDir file count lower than createdRelativePaths");
    }
    if (!report.liveWrite.hasWriteResultHeader) {
      fail("Write result markdown missing Write Result header");
    }
    if (!report.liveWrite.hasRollbackNote) {
      fail("Write result missing rollback note");
    }
  }

  // Second write: should be blocked (target no longer Safe/empty and/or conflicts)
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.recheckSafeScaffoldWriteReadiness()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.secondWrite = {
    canWriteFalse: s.safeScaffoldWrite?.canWrite === false,
    note:
      "Post-write re-write is blocked because folder is no longer Safe/empty and/or files already exist. Optional pre-write conflict inject on a fresh temp omitted.",
  };
  if (!report.secondWrite.canWriteFalse) {
    // Refresh stack without calling write again (preserve successful write result)
    await regenerateWriteStack(evaluate);
    s = await snap();
    report.secondWrite.canWriteFalse = s.safeScaffoldWrite?.canWrite === false;
    if (!report.secondWrite.canWriteFalse) {
      fail(
        "Second write still canWrite after refresh — expected block (non-empty/conflict). Did not invoke write to preserve first write result.",
      );
    }
  }

  // noWrite: project src unchanged; emptyDir WAS written (expected)
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
        (f) =>
          !f.includes("/.nttc/") &&
          !f.includes("\\.nttc\\") &&
          !/stage130-accept-write.*\.status\.txt$/i.test(f) &&
          !/stage130-dialog-helper\.log$/i.test(f),
      ).length === srcBefore.length,
    planningCountUnchangedByBuild: nttcPlanningAfter === nttcPlanningBefore,
    noAdvisorCall: advisorBefore === (await snap()).advisorResponse,
    tempWasEmptyBefore: emptyBefore.length === 0,
    tempHasFilesAfter: emptyAfterWrite.length > 0,
  };
  if (!report.noWrite.srcFileCountSame) fail("Project source files changed (contamination)");
  if (!report.noWrite.noAdvisorCall) fail("Unexpected AI advisor call");
  if (!report.noWrite.tempWasEmptyBefore) fail("Temp target was not empty before write");
  if (!report.noWrite.tempHasFilesAfter) fail("Temp target was not written after success");

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
  report.buildUi.checklistWritten =
    /Written-files result recorded|Actual files written/i.test(buildText);

  // Guide
  await clickTab(evaluate, "Guide");
  await new Promise((r) => setTimeout(r, 500));
  const guideText = await evaluate(`document.body.innerText`);
  report.guide = {
    writeNote:
      /Safe Scaffold Write creates new files only after final confirmation/i.test(
        guideText,
      ),
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
    workflowFilesWritten: /Safe Scaffold Files Written/i.test(reportsText),
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

  // Persistence uses the live write result (keep saved until after restore)
  s = await snap();
  const beforeRestartMarkdown =
    s.safeScaffoldWrite?.saved?.markdown?.slice(0, 80) ?? "";
  const diskFilesBeforeRestart = listFilesRecursive(emptyDir);
  report.persistencePrep = {
    hasWriteResult: Boolean(s.safeScaffoldWrite?.saved?.markdown),
    createdCount: s.safeScaffoldWrite?.saved?.createdRelativePaths?.length ?? 0,
    diskFiles: diskFilesBeforeRestart.length,
  };
  if (!report.persistencePrep.hasWriteResult) {
    fail("Write result missing before restart persistence test");
  }

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2000));

  // Restart — write result restores (stale mark on restore is OK per manager)
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
    hasWriteResult: Boolean(s.safeScaffoldWrite?.saved?.markdown),
    stale: Boolean(s.safeScaffoldWrite?.saved?.stale),
    markdownSnippetMatches: Boolean(
      beforeRestartMarkdown &&
        (s.safeScaffoldWrite?.saved?.markdown ?? "").includes(
          beforeRestartMarkdown.slice(0, 40),
        ),
    ),
    diskFilesRemain:
      listFilesRecursive(emptyDir).length === diskFilesBeforeRestart.length,
  };

  // Failure-safety + clear: clear app record only; disk files remain
  const filesBeforeClear = listFilesRecursive(emptyDir);
  await conn.evaluate(`window.nttc.clearSafeScaffoldWriteResult()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await conn.snap();
  const filesAfterClear = listFilesRecursive(emptyDir);
  report.clearWriteResult = {
    cleared: !s.safeScaffoldWrite?.saved,
    filesRemain:
      filesAfterClear.length === filesBeforeClear.length &&
      filesBeforeClear.length > 0,
  };
  report.persistenceClear = {
    cleared: report.clearWriteResult.cleared,
    diskFilesRemain: report.clearWriteResult.filesRemain,
  };
  if (!report.clearWriteResult.cleared) fail("Clear Write Result failed");
  if (!report.clearWriteResult.filesRemain) {
    fail("Clear Write Result deleted disk files (must only clear app record)");
  }
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
    stillCleared: !s.safeScaffoldWrite?.saved,
    diskFilesRemain:
      listFilesRecursive(emptyDir).length === diskFilesBeforeRestart.length &&
      diskFilesBeforeRestart.length > 0,
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
  if (!report.buildUi.writeSection) fail("Safe Scaffold Write section missing");
  if (!report.buildUi.writeSafeScaffoldBtn) fail("Write Safe Scaffold Files button missing");
  if (!report.buildUi.recheckWriteBtn) fail("Re-check Write Readiness button missing");
  if (!report.buildUi.copyWriteResultBtn) fail("Copy Write Result button missing");
  if (!report.buildUi.clearWriteResultBtn) fail("Clear Write Result button missing");
  if (!report.buildUi.noApplyPatch) fail("Apply Patch button found");
  if (!report.buildUi.noInstall) fail("Install button found");
  if (!report.buildUi.noRun) fail("Run button found");
  if (!report.preview.confirmationExists) fail("Final confirmation did not record");
  if (!report.preview.everyPathClassified) fail("Not every path was classified");
  if (!report.liveWrite.saved || report.liveWrite.createdCount === 0) {
    fail("Live write failed");
  }
  if (!report.noWrite.srcFileCountSame) fail("Project source contamination");
  if (!report.guide.writeNote) fail("Guide missing Safe Scaffold Write note");
  if (!report.reports.workflowFilesWritten) {
    fail("Workflow missing Safe Scaffold Files Written step");
  }
  if (!report.blueprint.taskIntake) fail("Blueprint task intake failed");
  if (!report.blueprint.noAutoImplReview) fail("Implementation Review auto-ran");
  if (!report.persistenceRestore.hasWriteResult) fail("Write result did not restore");
  if (!report.persistenceRestore.diskFilesRemain) {
    fail("Disk files missing after restart");
  }
  if (!report.persistenceClear.cleared) fail("Clear write result failed");
  if (!report.persistenceClear.diskFilesRemain) {
    fail("Disk files deleted on clear write result");
  }
  if (!report.persistenceClearedPersists.stillCleared) {
    fail("Cleared write result reappeared after restart");
  }
  if (!report.persistenceClearedPersists.diskFilesRemain) {
    fail("Disk files missing after clear+restart");
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
