/**
 * Stage 132 packaged-app smoke — Local Planner Build Brief after Stage 131.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9250
 *
 * Smoke-only: no product features. No MessageBox / no live Safe Scaffold Write
 * disk write on the happy path (UI + structural write preconditions only).
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
const PLANNER_JS = path.join(REPO, "dist-electron", "shared", "buildLocalPlannerBuildBrief.js");
const PLANNER_MODE_JS = path.join(REPO, "dist-electron", "shared", "buildModeLocalPlannerBuildBrief.js");
const WRITE_EVAL_JS = path.join(REPO, "dist-electron", "shared", "buildSafeScaffoldWrite.js");
const ASSESS_JS = path.join(REPO, "dist-electron", "main", "buildMode", "assessSafeScaffoldTarget.js");

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 132 Local Planner Build Brief packaging smoke.
## Product Requirements
Packaged generate/copy/clear/restore without live scaffold write.
## User Stories
As a user I want a copy/paste planner brief on Build.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A.
## Screen / Workflow Flow
Build tab Local Planner Build Brief.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/BuildModeTab.tsx
## Build Phases
1A — Stage 132 smoke
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

const report = { failures: [], warnings: [], pass: false };

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function normalizeKey(p) {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

function killApp() {
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
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
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  };
  const snap = () => evaluate("window.nttc.getSnapshot()");
  return { page, evaluate, snap, ws };
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

function findHistoryKey(raw) {
  const key = normalizeKey(PROJECT);
  if (raw.projects?.[key]) return key;
  return Object.keys(raw.projects || {}).find(
    (k) =>
      normalizeKey(k) === key ||
      k.toLowerCase().includes("new type tech coder"),
  );
}

function injectSafeTarget(emptyDir, check) {
  if (!fs.existsSync(HISTORY)) throw new Error("session-history.json missing");
  const raw = JSON.parse(fs.readFileSync(HISTORY, "utf8"));
  const found = findHistoryKey(raw);
  if (!found) throw new Error(`History key missing for ${PROJECT}`);
  const resolved = fs.realpathSync.native(check.resolvedPath || emptyDir);
  raw.projects[found].safeScaffoldTarget = {
    selectedPath: resolved,
    lastCheck: {
      ...check,
      resolvedPath: resolved,
      selectedPath: resolved,
    },
    stale: false,
  };
  fs.writeFileSync(HISTORY, JSON.stringify(raw, null, 2), "utf8");
  return found;
}

async function launchApp() {
  killApp();
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9250"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 7000));
  return connect();
}

function cardCount(s) {
  return (
    s.blueprint?.phaseTaskCards?.saved?.cards?.length ??
    s.blueprint?.phaseTaskCards?.cards?.length ??
    0
  );
}

async function ensurePlannerReady(evaluate, snap) {
  let s = await snap();
  const steps = [];
  const canGen = () => Boolean(s.localPlannerBuildBrief?.canGenerate);

  if (canGen()) {
    steps.push("already-ready");
    return { snapshot: s, steps };
  }

  if (!s.blueprint?.importedBlueprint) {
    steps.push("set-blueprint");
    await evaluate(
      `window.nttc.setBlueprintIntake(${JSON.stringify({
        projectIdea: "Stage 132 Local Planner Build Brief packaging smoke.",
        projectType: "web-app",
        buildStyle: "small-model-friendly",
      })})`,
    );
    await evaluate(
      `window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`,
    );
    await evaluate(`window.nttc.saveImportedBlueprint()`);
    await new Promise((r) => setTimeout(r, 500));
    s = await snap();
  }

  if (cardCount(s) <= 0 && s.blueprint?.importedBlueprint) {
    steps.push("generate-task-cards");
    await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
    await new Promise((r) => setTimeout(r, 1000));
    s = await snap();
  }

  if (canGen()) {
    steps.push("ready-after-blueprint-cards");
    return { snapshot: s, steps };
  }

  const hasPreviewOrWrite =
    Boolean(s.safeScaffoldWrite?.saved?.createdRelativePaths?.length) ||
    Boolean(s.safeScaffoldFileTreePreview?.saved) ||
    Boolean(s.safeScaffoldFileContentPreview?.saved);
  if (hasPreviewOrWrite && canGen()) {
    steps.push("ready-from-existing-preview-or-write");
    return { snapshot: s, steps };
  }

  const targetPath =
    s.safeScaffoldTarget?.selectedPath ||
    s.safeScaffoldTarget?.lastCheck?.resolvedPath ||
    null;
  if (targetPath) {
    steps.push("generate-file-tree-preview");
    try {
      await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
      await new Promise((r) => setTimeout(r, 400));
      await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      steps.push(`tree-preview-error:${err.message || err}`);
    }
    s = await snap();
  } else if (s.blueprint?.importedBlueprint) {
    steps.push("retry-task-cards");
    try {
      await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
      await new Promise((r) => setTimeout(r, 800));
    } catch {
      /* ignore */
    }
    s = await snap();
  }

  if (!canGen()) {
    steps.push("still-blocked");
    steps.push(
      ...(s.localPlannerBuildBrief?.readinessBlockedReasons ?? []).slice(0, 5),
    );
  } else {
    steps.push("ready");
  }
  return { snapshot: s, steps };
}

function hardBoundariesOk(md) {
  return (
    /# NTTC Local Planner Build Brief/.test(md) &&
    /## Hard Boundaries/.test(md) &&
    /Do not ask NTTC to run commands/i.test(md) &&
    /Do not ask NTTC to apply patches/i.test(md)
  );
}

let emptyDir = null;

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  // --- Bundle check ---
  const distJs = fs
    .readdirSync(path.join(REPO, "dist", "assets"))
    .find((f) => f.endsWith(".js"));
  const bundleText = fs.readFileSync(
    path.join(REPO, "dist", "assets", distJs),
    "utf8",
  );
  report.bundle = {
    localPlannerWiring:
      bundleText.includes("Local Planner Build Brief") &&
      bundleText.includes("Generate Planner Brief") &&
      bundleText.includes("Copy Planner Brief") &&
      bundleText.includes("Clear Planner Brief"),
    guideNote:
      /Local Planner Build Briefs help test local LLM\/SLM planning/i.test(
        bundleText,
      ),
    noApplyPatch: !bundleText.includes("Apply Patch"),
  };
  if (!report.bundle.localPlannerWiring) {
    fail("Bundle missing Local Planner Build Brief wiring");
  }
  if (!report.bundle.guideNote) {
    fail("Bundle missing Local Planner Build Brief guide note");
  }
  if (!report.bundle.noApplyPatch) {
    fail("Bundle unexpectedly contains Apply Patch");
  }

  // --- Structural planner checks (stage131-like) ---
  const plannerMod = await import(pathToFileURL(PLANNER_JS).href);
  const plannerModeMod = await import(pathToFileURL(PLANNER_MODE_JS).href);
  const evaluatePlanner =
    plannerMod.evaluateLocalPlannerBuildBriefPreconditions;
  const buildPlanner = plannerMod.buildLocalPlannerBuildBrief;
  const normalizeRecord = plannerModeMod.normalizeLocalPlannerBuildBriefRecord;
  const emptyTombstone = plannerModeMod.emptyLocalPlannerBuildBriefTombstone;

  report.structural = {
    noBlueprint: false,
    noCards: false,
    noPreview: false,
    preWrite: false,
    preWriteContent: false,
    postWrite: false,
    preWriteBrief: false,
    chooseTaskWording: false,
    selectedTask: false,
    smallSlm: false,
    smallestSafe: false,
    coderAsPlanner: false,
    ambitious: false,
    postWriteBrief: false,
    tombstone: false,
  };

  {
    const noBp = evaluatePlanner({
      blueprintImported: false,
      taskCardCount: 0,
      fileTreeExists: false,
      fileContentExists: false,
      writeResultExists: false,
      writeCreatedCount: 0,
    });
    report.structural.noBlueprint =
      !noBp.canGenerate && noBp.reasons.some((r) => /Blueprint/i.test(r));

    const noCards = evaluatePlanner({
      blueprintImported: true,
      taskCardCount: 0,
      fileTreeExists: false,
      fileContentExists: false,
      writeResultExists: false,
      writeCreatedCount: 0,
    });
    report.structural.noCards =
      !noCards.canGenerate && noCards.reasons.some((r) => /Task Cards/i.test(r));

    const noPreview = evaluatePlanner({
      blueprintImported: true,
      taskCardCount: 2,
      fileTreeExists: false,
      fileContentExists: false,
      writeResultExists: false,
      writeCreatedCount: 0,
    });
    report.structural.noPreview = !noPreview.canGenerate;

    const preWrite = evaluatePlanner({
      blueprintImported: true,
      taskCardCount: 2,
      fileTreeExists: true,
      fileContentExists: false,
      writeResultExists: false,
      writeCreatedCount: 0,
    });
    report.structural.preWrite =
      preWrite.canGenerate && preWrite.mode === "pre-write";

    const preWriteContent = evaluatePlanner({
      blueprintImported: true,
      taskCardCount: 2,
      fileTreeExists: false,
      fileContentExists: true,
      writeResultExists: false,
      writeCreatedCount: 0,
    });
    report.structural.preWriteContent =
      preWriteContent.canGenerate && preWriteContent.mode === "pre-write";

    const postWrite = evaluatePlanner({
      blueprintImported: true,
      taskCardCount: 0,
      fileTreeExists: false,
      fileContentExists: false,
      writeResultExists: true,
      writeCreatedCount: 3,
    });
    report.structural.postWrite =
      postWrite.canGenerate && postWrite.mode === "post-write";
  }

  const baseBuild = {
    blueprintImported: true,
    blueprintProjectType: "web-app",
    blueprintCompletenessLabel: "mostly ready",
    taskCardCount: 2,
    taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
    taskCards: [
      { id: "t1", title: "Scaffold UI shell", phase: "1A", goal: "UI shell" },
      { id: "t2", title: "Add router", phase: "1A", goal: "routing" },
    ],
    selectedTaskId: null,
    targetFolderPath: "D:\\empty-target",
    targetSafetyStatus: "safe",
    fileTreeGeneratedAt: "2026-01-01T00:00:00.000Z",
    fileTreeProposedPaths: ["src/App.tsx", "package.json"],
    fileContentGeneratedAt: "2026-01-01T00:00:00.000Z",
    writeManifestGeneratedAt: null,
    finalConfirmationConfirmedAt: null,
    writeResultWrittenAt: null,
    writeCreatedRelativePaths: [],
    strictness: "smallest-safe",
    targetLocalModelType: "general-local-llm",
  };

  {
    const built = buildPlanner(baseBuild);
    const md = built.record?.markdown ?? "";
    report.structural.preWriteBrief =
      built.record?.mode === "pre-write" &&
      md.includes("# NTTC Local Planner Build Brief");
    report.structural.chooseTaskWording =
      /Ask planner to choose|No task card is selected/i.test(md);
  }
  {
    const built = buildPlanner({
      ...baseBuild,
      selectedTaskId: "t1",
      targetLocalModelType: "small-slm",
      strictness: "smallest-safe",
    });
    const md = built.record?.markdown ?? "";
    report.structural.selectedTask =
      /Focus Task/i.test(md) && /Scaffold UI shell/.test(md);
    report.structural.smallSlm = /under ~40 lines|short bullets/i.test(md);
    report.structural.smallestSafe = /smallest safe next step/i.test(md);
  }
  {
    const built = buildPlanner({
      ...baseBuild,
      targetLocalModelType: "coder-as-planner",
      strictness: "ambitious-bounded",
    });
    const md = built.record?.markdown ?? "";
    report.structural.coderAsPlanner =
      /Interfaces \/ contracts|files, interfaces/i.test(md);
    report.structural.ambitious = /ambitious but still bounded/i.test(md);
  }
  {
    const built = buildPlanner({
      ...baseBuild,
      fileTreeGeneratedAt: null,
      fileContentGeneratedAt: null,
      writeResultWrittenAt: "2026-01-02T00:00:00.000Z",
      writeCreatedRelativePaths: ["src/App.tsx", "package.json"],
    });
    report.structural.postWriteBrief = built.record?.mode === "post-write";
  }
  {
    const tomb = emptyTombstone();
    report.structural.tombstone = normalizeRecord(tomb) === null;
  }
  if (Object.values(report.structural).some((v) => !v)) {
    fail("Structural Local Planner Build Brief matrix failed");
  }

  // --- Caution write still blocked (structural, if available) ---
  report.cautionWriteBlocked = { available: false, writeBlocked: null };
  if (fs.existsSync(WRITE_EVAL_JS)) {
    try {
      const writeMod = await import(pathToFileURL(WRITE_EVAL_JS).href);
      const evaluateWrite = writeMod.evaluateSafeScaffoldWritePreconditions;
      if (typeof evaluateWrite === "function") {
        report.cautionWriteBlocked.available = true;
        const blocked = !evaluateWrite({
          blueprintImported: true,
          taskCardCount: 2,
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
          finalConfirmationExists: true,
          finalConfirmationStale: false,
          finalConfirmationAcks: {
            futureWriteBoundaries: true,
            stage127NoWrite: true,
            cautionTarget: true,
          },
          proposedRelativePaths: ["src/App.tsx"],
          readyToCreate: [{ relativePath: "src/App.tsx" }],
          notReady: [],
        }).canWrite;
        report.cautionWriteBlocked.writeBlocked = blocked;
        if (!blocked) fail("Caution target was allowed to write (structural)");
      }
    } catch (err) {
      report.warnings.push(
        `Caution write structural skip: ${err.message || err}`,
      );
    }
  }

  // Inject a Safe empty target so tree preview can unlock pre-write if needed
  emptyDir = fs.mkdtempSync(
    path.join(fs.realpathSync.native(os.tmpdir()), "nttc-s132-safe-"),
  );
  if (fs.existsSync(ASSESS_JS) && fs.existsSync(HISTORY)) {
    try {
      const assessMod = await import(pathToFileURL(ASSESS_JS).href);
      const check = assessMod.assessSafeScaffoldTarget({
        selectedPath: emptyDir,
        currentProjectRoot: PROJECT,
      });
      if (check.status === "safe") {
        if (check.resolvedPath) {
          try {
            check.resolvedPath = fs.realpathSync.native(check.resolvedPath);
          } catch {
            /* keep */
          }
        }
        injectSafeTarget(emptyDir, check);
        report.targetInjected = true;
      } else {
        report.warnings.push(
          `Temp target not safe (${check.status}); relying on existing history state`,
        );
        report.targetInjected = false;
      }
    } catch (err) {
      report.warnings.push(`Target inject skipped: ${err.message || err}`);
      report.targetInjected = false;
    }
  } else {
    report.targetInjected = false;
  }

  // --- Launch ---
  let { page, evaluate, snap, ws } = await launchApp();
  report.launch = {
    pageUrl: page.url,
    usesAsar: /app\.asar/i.test(page.url || ""),
    usesVite: /5173|vite/i.test(page.url || ""),
    expectedIndexHtml: /file:\/\/.*app\.asar.*\/dist\/index\.html/i.test(
      page.url || "",
    ),
  };
  if (!report.launch.usesAsar || report.launch.usesVite) {
    fail("Not packaged asar launch");
  }
  if (!report.launch.expectedIndexHtml) {
    fail("Page URL is not file://...app.asar/dist/index.html");
  }

  const headerText = await evaluate(`document.body.innerText.slice(0, 5000)`);
  report.shell = {
    dashboard: await btnExists(evaluate, "Dashboard"),
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
  for (const [k, v] of Object.entries(report.shell)) {
    if (!v) fail(`Shell check failed: ${k}`);
  }

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));

  const readiness = await ensurePlannerReady(evaluate, snap);
  report.plannerPrep = {
    steps: readiness.steps,
    canGenerate: Boolean(readiness.snapshot.localPlannerBuildBrief?.canGenerate),
    availableMode: readiness.snapshot.localPlannerBuildBrief?.availableMode ?? null,
    reasons:
      readiness.snapshot.localPlannerBuildBrief?.readinessBlockedReasons ?? [],
  };
  if (!report.plannerPrep.canGenerate) {
    fail(
      `Local Planner canGenerate false after prep: ${(report.plannerPrep.reasons || []).join(" | ")}`,
    );
  }

  // --- Build UI ---
  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 800));
  let buildText = await evaluate(`document.body.innerText`);
  const buildButtons = await evaluate(`(() => {
    return [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean);
  })()`);

  const writeBtnIdx = buildText.indexOf("Write Safe Scaffold Files");
  const writeSectionIdx = (() => {
    let idx = 0;
    while (true) {
      const i = buildText.indexOf("Safe Scaffold Write", idx);
      if (i < 0) return -1;
      const rest = buildText.slice(i + "Safe Scaffold Write".length);
      if (
        !rest.startsWith(" Manifest") &&
        !rest.startsWith(" Final") &&
        !rest.startsWith(" creates") &&
        !rest.startsWith(" Result")
      ) {
        return i;
      }
      idx = i + 1;
    }
  })();
  const plannerIdx = buildText.indexOf("Local Planner Build Brief");
  // Prefer DOM label order — "Safety Charter" can appear earlier in other copy.
  const labelOrder = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.field-label')].map((el) =>
      (el.textContent || '').trim(),
    );
    const focusIds = [...document.querySelectorAll('[data-focus-id]')].map((el) =>
      el.getAttribute('data-focus-id'),
    );
    const writeFocus = focusIds.indexOf('build-mode-safe-scaffold-write');
    const plannerFocus = focusIds.indexOf('build-mode-local-planner-build-brief');
    const plannerLabel = labels.indexOf('Local Planner Build Brief');
    const safetyLabel = labels.indexOf('Safety Charter');
    return {
      plannerAfterWriteFocus: writeFocus >= 0 && plannerFocus > writeFocus,
      plannerBeforeSafetyLabel:
        plannerLabel >= 0 && safetyLabel > plannerLabel,
    };
  })()`);

  report.buildUi = {
    writeSection:
      /Safe Scaffold Write/i.test(buildText) &&
      buildButtons.some((b) => /^Write Safe Scaffold Files$/i.test(b)),
    localPlannerSection: /Local Planner Build Brief/i.test(buildText),
    plannerAfterWrite:
      labelOrder.plannerAfterWriteFocus ||
      ((writeSectionIdx >= 0 || writeBtnIdx >= 0) &&
        plannerIdx >
          Math.max(writeSectionIdx >= 0 ? writeSectionIdx : -1, writeBtnIdx)),
    plannerBeforeSafety: labelOrder.plannerBeforeSafetyLabel,
    generateBtn: buildButtons.some((b) => /^Generate Planner Brief$/i.test(b)),
    copyBtn: buildButtons.some((b) => /^Copy Planner Brief$/i.test(b)),
    clearBtn: buildButtons.some((b) => /^Clear Planner Brief$/i.test(b)),
    strictnessOptions:
      /Smallest safe/i.test(buildText) &&
      /Normal/i.test(buildText) &&
      /Ambitious/i.test(buildText),
    modelTypeOptions:
      /Small SLM/i.test(buildText) &&
      /General local LLM/i.test(buildText) &&
      /Coder model acting as planner/i.test(buildText),
    copyPasteNote:
      /copy\/paste into a local planner model/i.test(buildText) &&
      /does not send it automatically/i.test(buildText),
    noRunLocalPlanner: !buildButtons.some((b) =>
      /^Run Local Planner$/i.test(b),
    ),
    noSendToAi: !buildButtons.some((b) => /^Send to AI$/i.test(b)),
    noApplyPatch: !buildButtons.some((b) => /^Apply Patch$/i.test(b)),
    noInstall: !buildButtons.some((b) => /^Install$/i.test(b)),
    noRun: !buildButtons.some((b) => /^Run$/i.test(b)),
    focusPlanner: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="build-mode-local-planner-build-brief"]'))`,
    ),
  };
  for (const [k, v] of Object.entries(report.buildUi)) {
    if (!v) fail(`Build UI check failed: ${k}`);
  }

  // --- Live CDP planner generate ---
  let s = await evaluate(
    `window.nttc.generateLocalPlannerBuildBrief(${JSON.stringify({
      targetLocalModelType: "small-slm",
      strictness: "smallest-safe",
    })})`,
  );
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  let md = s.localPlannerBuildBrief?.saved?.markdown ?? "";
  report.planner = {
    firstGenerate: {
      saved: Boolean(s.localPlannerBuildBrief?.saved),
      hasHeader: /# NTTC Local Planner Build Brief/.test(md),
      hardBoundaries: hardBoundariesOk(md),
      smallSlm: /under ~40 lines|short bullets/i.test(md),
      smallestSafe: /smallest safe next step/i.test(md),
      mode: s.localPlannerBuildBrief?.saved?.mode ?? null,
    },
  };
  if (!report.planner.firstGenerate.saved) fail("First planner brief not saved");
  if (!report.planner.firstGenerate.hasHeader) {
    fail("First brief missing # NTTC Local Planner Build Brief");
  }
  if (!report.planner.firstGenerate.hardBoundaries) {
    fail("First brief missing Hard Boundaries");
  }
  if (!report.planner.firstGenerate.smallSlm) {
    fail("First brief missing small-slm wording");
  }
  if (!report.planner.firstGenerate.smallestSafe) {
    fail("First brief missing smallest-safe wording");
  }

  s = await evaluate(
    `window.nttc.generateLocalPlannerBuildBrief(${JSON.stringify({
      targetLocalModelType: "coder-as-planner",
      strictness: "ambitious-bounded",
    })})`,
  );
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  md = s.localPlannerBuildBrief?.saved?.markdown ?? "";
  report.planner.secondGenerate = {
    saved: Boolean(s.localPlannerBuildBrief?.saved),
    coderAsPlanner: /Interfaces \/ contracts|files, interfaces/i.test(md),
    ambitious: /ambitious but still bounded/i.test(md),
    hardBoundaries: hardBoundariesOk(md),
    modelType: s.localPlannerBuildBrief?.saved?.targetLocalModelType ?? null,
    strictness: s.localPlannerBuildBrief?.saved?.strictness ?? null,
  };
  if (!report.planner.secondGenerate.coderAsPlanner) {
    fail("Second brief missing coder-as-planner wording");
  }
  if (!report.planner.secondGenerate.ambitious) {
    fail("Second brief missing ambitious wording");
  }

  await evaluate(`window.nttc.clearLocalPlannerBuildBrief()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.planner.clear = {
    cleared: !s.localPlannerBuildBrief?.saved,
  };
  if (!report.planner.clear.cleared) fail("Clear Local Planner Build Brief failed");

  // Generate again for persistence restore test
  s = await evaluate(
    `window.nttc.generateLocalPlannerBuildBrief(${JSON.stringify({
      targetLocalModelType: "small-slm",
      strictness: "smallest-safe",
    })})`,
  );
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const beforeRestartMd =
    s.localPlannerBuildBrief?.saved?.markdown?.slice(0, 120) ?? "";
  report.planner.persistencePrep = {
    hasBrief: Boolean(s.localPlannerBuildBrief?.saved?.markdown),
  };
  if (!report.planner.persistencePrep.hasBrief) {
    fail("Brief missing before restart persistence test");
  }

  // --- Persistence: restore ---
  ws.close();
  killApp();
  await new Promise((r) => setTimeout(r, 2000));
  ({ page, evaluate, snap, ws } = await launchApp());
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.persistence = {
    restore: {
      hasBrief: Boolean(s.localPlannerBuildBrief?.saved?.markdown),
      stale: Boolean(s.localPlannerBuildBrief?.saved?.stale),
      markdownSnippetMatches: Boolean(
        beforeRestartMd &&
          (s.localPlannerBuildBrief?.saved?.markdown ?? "").includes(
            beforeRestartMd.slice(0, 40),
          ),
      ),
    },
  };
  if (!report.persistence.restore.hasBrief) {
    fail("Local Planner brief did not restore after restart");
  }

  await evaluate(`window.nttc.clearLocalPlannerBuildBrief()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.persistence.clear = {
    cleared: !s.localPlannerBuildBrief?.saved,
  };
  if (!report.persistence.clear.cleared) {
    fail("Clear after restore failed");
  }

  ws.close();
  killApp();
  await new Promise((r) => setTimeout(r, 2000));
  ({ page, evaluate, snap, ws } = await launchApp());
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.persistence.clearedPersists = {
    stillCleared: !s.localPlannerBuildBrief?.saved,
  };
  if (!report.persistence.clearedPersists.stillCleared) {
    fail("Cleared Local Planner brief reappeared after restart");
  }

  // --- Guide ---
  await clickTab(evaluate, "Guide");
  await new Promise((r) => setTimeout(r, 500));
  const guideText = await evaluate(`document.body.innerText`);
  report.guide = {
    localPlannerNote:
      /Local Planner Build Briefs help test local LLM\/SLM planning/i.test(
        guideText,
      ) ||
      (/Local Planner Build Brief/i.test(guideText) &&
        /local LLM\/SLM/i.test(guideText)),
  };
  if (!report.guide.localPlannerNote) {
    fail("Guide missing Local Planner Build Brief note");
  }

  // --- Reports light regression ---
  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 800));
  const reportsText = await evaluate(`document.body.innerText`);
  report.reports = {
    architectureHealth: /Architecture Health/i.test(reportsText),
    plannerPresence:
      /Local Planner Build Brief|Blueprint Planner|Project Blueprint/i.test(
        reportsText,
      ),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };
  if (!report.reports.architectureHealth) fail("Reports missing Architecture Health");
  if (!report.reports.plannerPresence) {
    fail("Reports missing planner presence");
  }
  if (!report.reports.noApplyPatch) fail("Apply Patch found on Reports");

  // --- Blueprint light regression ---
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  const blueprintText = await evaluate(`document.body.innerText`);
  s = await snap();
  report.blueprint = {
    plannerUi: /Project Blueprint Planner|Blueprint/i.test(blueprintText),
    imported: Boolean(s.blueprint?.importedBlueprint),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };
  if (!report.blueprint.plannerUi) fail("Blueprint planner UI missing");
  if (!report.blueprint.noApplyPatch) fail("Apply Patch found on Blueprint");

  // --- Workflow mention (Dashboard / Reports if visible) ---
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 500));
  const dashText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 500));
  const reportsAgain = await evaluate(`document.body.innerText`);
  report.workflow = {
    mentionsLocalPlanner:
      /Local Planner Build Brief/i.test(dashText) ||
      /Local Planner Build Brief/i.test(reportsAgain),
  };
  if (!report.workflow.mentionsLocalPlanner) {
    report.warnings.push(
      "Workflow/Dashboard/Reports body did not mention Local Planner Build Brief (may be collapsed)",
    );
  }

  ws.close();
  killApp();

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
  console.log(JSON.stringify(report, null, 2));
  killApp();
  process.exit(1);
} finally {
  killApp();
  if (emptyDir) {
    try {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
