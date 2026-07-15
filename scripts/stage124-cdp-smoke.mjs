/**
 * Stage 124 packaged-app smoke — Safe Scaffold File Content Preview after Stage 123.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9250
 *
 * Native folder dialog is not CDP-automatable; injects a Safe target into history
 * then refreshes safety and generates file-tree + file-content preview via IPC.
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
const PATH_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildModeFileTreePreview.js",
);

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 124 disposable smoke blueprint.
## Product Requirements
Verify packaged Safe Scaffold File Content Preview.
## User Stories
As a user I want deterministic in-memory file content preview.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A.
## Screen / Workflow Flow
Build tab file-content preview.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/BuildModeTab.tsx
## Build Phases
1A — Stage 124 smoke
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
Stage 124 Blueprint regression.

## 2. Plan
Confirm Blueprint still works after Stage 123 packaging.

## 3. Files changed
- none in Stage 124

## 4. Implementation summary
Packaging only.

## 5. Validation performed
Packaged smoke.

## 6. Behavior preservation checks
No Apply Patch. File-content preview is templates in memory only.

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
    stage123Wiring:
      bundleText.includes("Safe Scaffold File Tree Preview") &&
      bundleText.includes("Safe Scaffold File Content Preview") &&
      bundleText.includes("Generate File Content Preview") &&
      bundleText.includes("Copy File Content Preview") &&
      bundleText.includes("Clear File Content Preview") &&
      bundleText.includes("Safe Scaffold Target Folder") &&
      (bundleText.includes("Planning Only") ||
        bundleText.includes("Build Mode Status")),
    noApplyPatch: !bundleText.includes("Apply Patch"),
    guideNote:
      /Safe Scaffold File Content Preview shows deterministic starter contents in memory only/i.test(
        bundleText,
      ),
  };
  if (!report.bundle.stage123Wiring) fail("Bundle missing Stage 123 wiring");
  if (!report.bundle.noApplyPatch) fail("Bundle unexpectedly contains Apply Patch");
  if (!report.bundle.guideNote) fail("Bundle missing Guide file-content note");

  // Path safety structural (deterministic)
  const pathMod = await import(pathToFileURL(PATH_JS).href);
  const builderMod = await import(pathToFileURL(BUILDER_JS).href);
  const contentMod = await import(pathToFileURL(CONTENT_BUILDER_JS).href);
  const validate = pathMod.validateProposedRelativePath;
  const buildPreview = builderMod.buildSafeScaffoldFileTreePreview;
  const buildContent = contentMod.buildSafeScaffoldFileContentPreview;
  const evaluateContentPreconditions =
    contentMod.evaluateFileContentPreviewPreconditions;
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

  report.contentPreconditions = {
    noBlueprint: !evaluateContentPreconditions({
      blueprintImported: false,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
    noCards: !evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 0,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
    noTarget: !evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: null,
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
    blockedTarget: !evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "blocked",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
    staleTarget: !evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: true,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
    noTree: !evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: false,
      fileTreeStale: false,
      proposedRelativePaths: [],
    }).canGenerate,
    staleTree: !evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: true,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
    safeOk: evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "safe",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
    cautionOk: evaluateContentPreconditions({
      blueprintImported: true,
      taskCardCount: 1,
      targetFolderPath: "D:\\t",
      targetSafetyStatus: "caution",
      targetStale: false,
      targetBusy: false,
      fileTreeExists: true,
      fileTreeStale: false,
      proposedRelativePaths: ["src/App.tsx"],
    }).canGenerate,
  };
  if (Object.values(report.contentPreconditions).some((v) => !v)) {
    fail("Content precondition matrix failed");
  }

  const cautionTree = buildPreview({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 1,
    taskCardsGeneratedAt: null,
    targetFolderPath: "D:\\caution",
    targetSafetyStatus: "caution",
  });
  const cautionBuilt = buildContent({
    blueprintImported: true,
    blueprintProjectType: "web-app",
    taskCardCount: 1,
    taskCardsGeneratedAt: null,
    targetFolderPath: "D:\\caution",
    targetSafetyStatus: "caution",
    fileTreeGeneratedAt:
      cautionTree.record?.generatedAt ?? "2026-01-01T00:00:00.000Z",
    proposedRelativePaths:
      cautionTree.record?.proposedRelativePaths ?? [
        "package.json",
        "README.md",
        "index.html",
        "src/main.tsx",
        "src/App.tsx",
        "src/styles.css",
        "docs/PROJECT_NOTES.md",
        "electron.manifest.md",
      ],
  });
  const cautionMd = cautionBuilt.record?.markdown ?? "";
  const templated = cautionBuilt.record?.templatedFiles ?? [];
  report.cautionContent = {
    generated: Boolean(cautionBuilt.record),
    hasWarning: (cautionBuilt.record?.warnings ?? []).some((w) =>
      /Target folder is Caution, not Safe/i.test(w),
    ),
    hasSections: [
      "# NTTC Safe Scaffold File Content Preview",
      "## Status",
      "## Source Inputs",
      "## Proposed Files",
      "## Files Without Contents Yet",
      "## Safety Boundaries",
      "## Next Step",
    ].every((sec) => cautionMd.includes(sec)),
    hasPackageJson: templated.some((f) => f.relativePath === "package.json"),
    hasReadme: templated.some(
      (f) => f.relativePath.toLowerCase() === "readme.md",
    ),
    hasIndexHtml: templated.some((f) => f.relativePath === "index.html"),
    hasMain: templated.some((f) => f.relativePath === "src/main.tsx"),
    hasApp: templated.some((f) => f.relativePath === "src/App.tsx"),
    hasCss: templated.some((f) => f.relativePath === "src/styles.css"),
    hasNotes: templated.some(
      (f) => f.relativePath.toLowerCase() === "docs/project_notes.md",
    ),
    withoutUnknown:
      (cautionBuilt.record?.filesWithoutContents ?? []).length > 0,
    relativeOnly: (cautionBuilt.record?.proposedRelativePaths ?? []).every(
      (rel) => validate(rel) === null,
    ),
    noEnv: !templated.some((f) => /\.env\b/i.test(f.content)),
    noPostinstall: !templated.some((f) =>
      /postinstall|preinstall/i.test(f.content),
    ),
    noCurlBash: !/curl[^\n]*\|\s*bash/i.test(cautionMd),
    noEval: !templated.some((f) => /\beval\s*\(/.test(f.content)),
    noRunNote: /NTTC will not run these scripts automatically/i.test(cautionMd),
  };
  if (
    !report.cautionContent.generated ||
    !report.cautionContent.hasWarning ||
    !report.cautionContent.hasSections ||
    !report.cautionContent.hasPackageJson ||
    !report.cautionContent.relativeOnly ||
    !report.cautionContent.noEnv ||
    !report.cautionContent.noPostinstall ||
    !report.cautionContent.noRunNote
  ) {
    fail("Caution content preview structural checks failed");
  }

  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "nttc-s124-safe-"));
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
    generateTreeBtn: buildButtons.some((b) =>
      /^Generate File Tree Preview$/i.test(b),
    ),
    generateContentBtn: buildButtons.some((b) =>
      /^Generate File Content Preview$/i.test(b),
    ),
    copyContentBtn: buildButtons.some((b) =>
      /^Copy File Content Preview$/i.test(b),
    ),
    clearContentBtn: buildButtons.some((b) =>
      /^Clear File Content Preview$/i.test(b),
    ),
    noCreateFiles: !buildButtons.some((b) => /^Create Files$/i.test(b)),
    noScaffold: !buildButtons.some((b) => /^Scaffold$/i.test(b)),
    noWrite: !buildButtons.some(
      (b) => /^Write$/i.test(b) || /^Write Files$/i.test(b),
    ),
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
  };

  // Blueprint + task cards
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: "Stage 124 file content packaging smoke.",
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

  let s = await snap();
  const treePreview = s.safeScaffoldFileTreePreview?.saved;
  const contentPreview = s.safeScaffoldFileContentPreview?.saved;
  report.preview = {
    treeExists: Boolean(treePreview),
    contentExists: Boolean(contentPreview),
    contentStale: Boolean(contentPreview?.stale),
    templatedCount: contentPreview?.templatedFiles?.length ?? 0,
    withoutCount: contentPreview?.filesWithoutContents?.length ?? 0,
    relativeOnly: (contentPreview?.proposedRelativePaths ?? []).every(
      (p) =>
        typeof p === "string" &&
        !/[A-Za-z]:/.test(p) &&
        !p.includes("..") &&
        !p.startsWith("/") &&
        !p.startsWith("\\"),
    ),
    hasHeader: /# NTTC Safe Scaffold File Content Preview/.test(
      contentPreview?.markdown ?? "",
    ),
    hasStatus: /## Status/.test(contentPreview?.markdown ?? ""),
    hasProposed: /## Proposed Files/.test(contentPreview?.markdown ?? ""),
    hasWithout: /## Files Without Contents Yet/.test(
      contentPreview?.markdown ?? "",
    ),
    hasSafety: /## Safety Boundaries/.test(contentPreview?.markdown ?? ""),
    previewOnly: /Preview only\. No files have been created/i.test(
      contentPreview?.markdown ?? "",
    ),
    noRunNote: /NTTC will not run these scripts automatically/i.test(
      contentPreview?.markdown ?? "",
    ),
    noEnvInTemplates: !(contentPreview?.templatedFiles ?? []).some((f) =>
      /\.env\b/i.test(f.content),
    ),
    noPostinstall: !(contentPreview?.templatedFiles ?? []).some((f) =>
      /postinstall|preinstall/i.test(f.content),
    ),
  };

  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 600));
  buildText = await evaluate(`document.body.innerText`);
  report.buildUi.checklistFileTree =
    /Scaffold file tree preview generated/i.test(buildText);
  report.buildUi.checklistFileContents =
    /Scaffold file contents preview generated/i.test(buildText);
  report.buildUi.contentStatusCard =
    /File Content Preview Status/i.test(buildText);
  report.buildUi.laterWrite =
    /User confirmed write[\s\S]*later stage/i.test(buildText);
  report.buildUi.laterManifest =
    /Written-files manifest prepared[\s\S]*later stage/i.test(buildText);

  // Copy API (clipboard may fail in headless; recordCopy is enough)
  await evaluate(`window.nttc.recordCopySafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 300));

  // Stale after regenerate file-tree
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.staleAfterTreeRegen = Boolean(
    s.safeScaffoldFileContentPreview?.saved?.stale,
  );

  // Regenerate content for task-card stale test
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.staleAfterTaskCards = Boolean(
    s.safeScaffoldFileContentPreview?.saved?.stale,
  );

  // Regenerate fresh previews for persistence test
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.previewFresh = Boolean(
    s.safeScaffoldFileContentPreview?.saved &&
      !s.safeScaffoldFileContentPreview.saved.stale,
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

  // Ensure a current content preview exists before restart persistence
  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
  await evaluate(`window.nttc.generateSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const beforeRestartMarkdown =
    s.safeScaffoldFileContentPreview?.saved?.markdown?.slice(0, 80) ?? "";

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2000));

  // Restart — restore preview (stale is expected on restore)
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
    hasPreview: Boolean(s.safeScaffoldFileContentPreview?.saved?.markdown),
    stale: Boolean(s.safeScaffoldFileContentPreview?.saved?.stale),
    noSourceBodiesStored: !(
      s.safeScaffoldFileContentPreview?.saved?.templatedFiles ?? []
    ).some((f) => /EXISTING_SOURCE_MARKER_SHOULD_NOT_APPEAR/.test(f.content)),
    markdownSnippetMatches: Boolean(
      beforeRestartMarkdown &&
        (s.safeScaffoldFileContentPreview?.saved?.markdown ?? "").includes(
          beforeRestartMarkdown.slice(0, 40),
        ),
    ),
  };

  await conn.evaluate(`window.nttc.clearSafeScaffoldFileContentPreview()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await conn.snap();
  report.persistenceClear = {
    cleared: !s.safeScaffoldFileContentPreview?.saved,
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
    stillCleared: !s.safeScaffoldFileContentPreview?.saved,
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
  if (!report.buildUi.fileContentSection) fail("File Content Preview section missing");
  if (!report.buildUi.generateContentBtn) fail("Generate File Content Preview missing");
  if (!report.buildUi.copyContentBtn) fail("Copy File Content Preview missing");
  if (!report.buildUi.clearContentBtn) fail("Clear File Content Preview missing");
  if (!report.buildUi.noCreateFiles) fail("Create Files button found");
  if (!report.buildUi.noScaffold) fail("Scaffold button found");
  if (!report.buildUi.noWrite) fail("Write button found");
  if (!report.buildUi.noInstall) fail("Install button found");
  if (!report.buildUi.noRun) fail("Run button found");
  if (!report.preview.contentExists) fail("File content preview did not generate");
  if (!report.preview.relativeOnly) fail("Preview paths not relative-only");
  if (!report.preview.hasHeader) fail("Preview missing header");
  if (!report.preview.noEnvInTemplates) fail("Preview templates contain .env");
  if (!report.staleAfterTreeRegen) fail("Content preview did not stale after tree regen");
  if (!report.staleAfterTaskCards) fail("Content preview did not stale after task cards");
  if (!report.noWrite.srcFileCountSame) fail("Source files changed");
  if (!report.noWrite.noAdvisorCall) fail("Unexpected AI advisor call");
  if (!report.noWrite.tempEmptyUnchanged) fail("Temp target folder was written");
  if (!report.guide.fileContentNote) fail("Guide missing file-content note");
  if (!report.reports.workflowFileContent) {
    fail("Workflow missing File Content Preview step");
  }
  if (!report.blueprint.taskIntake) fail("Blueprint task intake failed");
  if (!report.blueprint.noAutoImplReview) fail("Implementation Review auto-ran");
  if (!report.persistenceRestore.hasPreview) fail("Content preview did not restore");
  if (!report.persistenceRestore.stale) fail("Restored content preview should be stale");
  if (!report.persistenceClear.cleared) fail("Clear content preview failed");
  if (!report.persistenceClearedPersists.stillCleared) {
    fail("Cleared content preview reappeared after restart");
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
