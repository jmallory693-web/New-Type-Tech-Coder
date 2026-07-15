/**
 * Stage 118 packaged-app smoke — Build Mode Safety Charter after Stage 117.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9250
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9250";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 118 disposable smoke blueprint.
## Product Requirements
Verify Build Mode packaging.
## User Stories
As a user I want Build tab planning-only.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A.
## Screen / Workflow Flow
Build tab charter only.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/BuildModeTab.tsx
## Build Phases
1A — Stage 118 smoke
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
Stage 118 Blueprint regression.

## 2. Plan
Confirm Blueprint still works after Stage 117.

## 3. Files changed
- none in Stage 118

## 4. Implementation summary
Packaging only.

## 5. Validation performed
Packaged smoke.

## 6. Behavior preservation checks
No Apply Patch. Build Mode planning-only.

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

async function tabOrder(evaluate) {
  return evaluate(`(() => {
    const labels = [...document.querySelectorAll('nav button, [role="tab"], .app-tabs button, header button')]
      .map((b) => (b.textContent || '').trim())
      .filter(Boolean);
    // Prefer primary tab strip labels
    const wanted = ['Dashboard','Guide','Blueprint','Build','Project Setup','Reports'];
    const found = [];
    for (const w of wanted) {
      const i = labels.findIndex((l) => l === w || l.startsWith(w));
      if (i >= 0) found.push({ label: w, index: i });
    }
    const blueprint = found.find((f) => f.label === 'Blueprint');
    const build = found.find((f) => f.label === 'Build');
    const reports = found.find((f) => f.label === 'Reports');
    return {
      labels: found,
      buildAfterBlueprint:
        Boolean(blueprint && build && build.index > blueprint.index),
      buildBeforeReports:
        Boolean(build && reports && build.index < reports.index),
    };
  })()`);
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
    stage117Wiring:
      bundleText.includes("Safe Scaffold Mode") &&
      bundleText.includes("Safety Charter") &&
      bundleText.includes("What NTTC Will Not Do") &&
      (bundleText.includes("Planning Only") ||
        bundleText.includes("Build Mode Status")),
    noApplyPatch: !bundleText.includes("Apply Patch"),
    guideNote: /Build Mode starts with Safe Scaffold Mode/i.test(bundleText),
  };
  if (!report.bundle.stage117Wiring) fail("Bundle missing Stage 117 Build Mode wiring");
  if (!report.bundle.noApplyPatch) fail("Bundle unexpectedly contains Apply Patch");

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
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
    tabOrder: await tabOrder(evaluate),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));

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

  // Clear blueprint for no-blueprint next-step check
  await evaluate(`window.nttc.clearImportedBlueprint()`).catch(() => {});
  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 800));
  let buildText = await evaluate(`document.body.innerText`);
  const buildButtons = await evaluate(`(() => {
    return [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean);
  })()`);

  report.buildUi = {
    safeScaffoldTitle: /Safe Scaffold Mode/i.test(buildText),
    buildModeStatus: /Build Mode Status/i.test(buildText),
    planningOnly: /Planning Only/i.test(buildText),
    safetyCharter: /Safety Charter/i.test(buildText),
    futureRequirements: /Future Safe Scaffold Requirements/i.test(buildText),
    blueprintReadiness: /Current Blueprint Readiness/i.test(buildText),
    willNotDo: /What NTTC Will Not Do/i.test(buildText),
    nextStep: /Next Step/i.test(buildText),
    noCreate:
      /does not create files|will not create files|does not:\s*[\s\S]*create source files/i.test(
        buildText,
      ),
    noEdit: /will not edit|does not:\s*[\s\S]*edit source files/i.test(buildText),
    noCommands: /will not run|does not:\s*[\s\S]*run commands/i.test(buildText),
    noInstall: /install packages|install dependencies/i.test(buildText),
    noApplyPatches: /apply patches/i.test(buildText),
    checklistDisabled: await evaluate(`(() => {
      const boxes = [...document.querySelectorAll('input[type="checkbox"]')];
      return boxes.length > 0 && boxes.every((b) => b.disabled);
    })()`),
    noTargetFolderSelector: !(await evaluate(`Boolean(document.querySelector('input[type="file"]'))`)),
    noCreateFilesButton: !buildButtons.some((b) => /^Create Files$/i.test(b)),
    noScaffoldButton: !buildButtons.some((b) => /^Scaffold$/i.test(b)),
    noWriteButton: !buildButtons.some((b) => /^Write$/i.test(b) || /^Write Files$/i.test(b)),
    openBlueprintShown: buildButtons.some((b) => /Open Blueprint Tab/i.test(b)),
    nextStepPointsBlueprint: /Go to Blueprint|create\/import a project blueprint/i.test(buildText),
    focusIds: {
      status: await evaluate(
        `Boolean(document.querySelector('[data-focus-id="build-mode-status"]'))`,
      ),
      charter: await evaluate(
        `Boolean(document.querySelector('[data-focus-id="build-mode-safety-charter"]'))`,
      ),
    },
  };

  // Click Open Blueprint if present (no write)
  if (report.buildUi.openBlueprintShown) {
    await evaluate(`(() => {
      const t = [...document.querySelectorAll('button')].find((b) => /Open Blueprint Tab/i.test((b.textContent || '').trim()));
      if (t) t.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));
    report.buildUi.openBlueprintNavigates = await evaluate(
      `Boolean(document.querySelector('[data-focus-id="blueprint-planner"], [aria-label="Blueprint"]'))`,
    );
  }

  // Import blueprint + task cards, recheck Build next step
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: "Stage 118 Build Mode packaging smoke.",
      projectType: "desktop-app",
      buildStyle: "small-model-friendly",
    })})`,
  );
  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 1000));
  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 600));
  buildText = await evaluate(`document.body.innerText`);
  report.buildUi.afterCards = {
    readinessShowsCards: /Task Cards:\s*\d+\s*cards/i.test(buildText),
    nextStepLaterFolder:
      /target-folder selection will be added in a later stage/i.test(buildText),
  };

  // No-write smoke after Build interactions
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
  };

  // Guide note
  await clickTab(evaluate, "Guide");
  await new Promise((r) => setTimeout(r, 500));
  const guideText = await evaluate(`document.body.innerText`);
  report.guide = {
    buildModeNote: /Build Mode starts with Safe Scaffold Mode/i.test(guideText),
    planningOnly: /planning-only and does not write files/i.test(guideText),
  };

  // Workflow progress on Reports
  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 800));
  const reportsText = await evaluate(`document.body.innerText`);
  report.reports = {
    workflowCharter: /Build Mode Safety Charter/i.test(reportsText),
    architectureHealth: /Architecture Health/i.test(reportsText),
    auditPatch:
      /Code Context Pack/i.test(reportsText) &&
      /Patch Draft Mode/i.test(reportsText) &&
      /Manual Patch Draft Import/i.test(reportsText),
    noApplyPatch: report.shell.noApplyPatch,
  };

  // Light Blueprint functional regression
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
  await evaluate(`window.nttc.generateBlueprintPlannerPrompt()`);
  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await evaluate(`window.nttc.generateBlueprintPhase1Handoff()`);
  let s = await snap();
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
    noAutoImplReview: !s.implementationReview?.saved,
  };

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.projectMemory = {
    previewExists: (s.projectMemory?.preview?.files?.length ?? 0) > 0,
  };

  // Daily next: ensure not overriding when safety needed - just record current
  report.dailyNext = {
    id: s.dailyNextAction?.id ?? null,
    title: s.dailyNextAction?.title ?? null,
  };

  report.boundaries = {
    ...report.noWrite,
    liveQwenDisabled: report.shell.liveQwenDisabled,
    noApplyPatch: report.shell.noApplyPatch,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (!report.launch.usesAsar || report.launch.usesVite) fail("Not packaged asar launch");
  if (!report.shell.buildTab) fail("Build tab missing");
  if (!report.shell.tabOrder?.buildAfterBlueprint) fail("Build tab not after Blueprint");
  if (!report.buildUi.safeScaffoldTitle) fail("Safe Scaffold Mode title missing");
  if (!report.buildUi.planningOnly) fail("Planning Only missing");
  if (!report.buildUi.safetyCharter) fail("Safety Charter missing");
  if (!report.buildUi.futureRequirements) fail("Future requirements missing");
  if (!report.buildUi.willNotDo) fail("What NTTC Will Not Do missing");
  if (!report.buildUi.checklistDisabled) fail("Checklist not disabled");
  if (!report.buildUi.noTargetFolderSelector) fail("Unexpected file/folder picker");
  if (!report.buildUi.noCreateFilesButton) fail("Create Files button found");
  if (!report.buildUi.noScaffoldButton) fail("Scaffold button found");
  if (!report.buildUi.noWriteButton) fail("Write button found");
  if (!report.buildUi.afterCards?.nextStepLaterFolder) {
    fail("Next Step after task cards missing later-folder message");
  }
  if (!report.noWrite.srcFileCountSame) fail("Source files changed during Build smoke");
  if (!report.noWrite.noAdvisorCall) fail("Unexpected AI advisor call");
  if (!report.guide.buildModeNote) fail("Guide missing Build Mode note");
  if (!report.reports.workflowCharter) fail("Workflow Progress missing Build Mode Charter");
  if (!report.blueprint.taskIntake) fail("Blueprint task intake failed");
  if (!report.blueprint.noAutoImplReview) fail("Implementation Review auto-ran");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
  console.log(JSON.stringify(report, null, 2));
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  process.exit(1);
}
