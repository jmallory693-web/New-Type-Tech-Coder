/**
 * Stage 87 packaged-app smoke (CDP).
 * Blueprint Phase Task Cards workflow + regressions.
 *
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9239
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";
const REQUIRED_SECTIONS = [
  "Task ID",
  "Task Title",
  "Phase",
  "Goal",
  "Why This Matters",
  "Inputs / Context",
  "Likely Files / Modules",
  "What To Build",
  "What Not To Build Yet",
  "Safety Boundaries",
  "Small-Model Friendly Architecture",
  "Builder Prompt",
  "Validation Steps",
  "Report Back Format",
  "Open Questions",
  "Status",
];

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief

Small offline habit tracker for Windows.

## Product Requirements

Track habits, daily completion, streaks, notes, local saves.

## User Stories

As a user I want to log habits daily.

## Feature Roadmap

Phase 1: core habit list and daily check-off.

## Data Model

Habit: id, name, notes. DailyLog: habitId, date, completed.

## Screen / Workflow Flow

Main list → habit detail → mark complete.

## Architecture Plan

Electron + local JSON storage.

## Suggested File / Module Plan

- src/shared/types.ts
- src/main/store/habitStore.ts
- src/renderer/components/HabitList.tsx

## Build Phases

1A — App shell planning
1B — Core data model
1C — First screen workflow
1D — Local save/load
1E — Validation checklist

## Validation Plan

Manual smoke: create habit, mark complete, restart app.

## Risks / Open Questions

None for Phase 1.

## AI Team Roles

Human builder + NTTC planner.

## Phase 1 Builder Handoff

Build shell and first screen only.

## Current Status

Blueprint ready for Phase 1 planning.
`;

const report = { failures: [], warnings: [], pass: false };

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function warn(msg) {
  report.warnings.push(msg);
  console.warn("WARN:", msg);
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
  const snap = () => evaluate(`window.nttc.getSnapshot()`);
  return { page, evaluate, snap, ws };
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').trim() === ${JSON.stringify(label)},
    );
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 700));
}

function listProjectFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "node_modules" || name === ".git") continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) listProjectFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9239"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 6000));

  const { page, evaluate, snap, ws } = await connect();
  report.launch = {
    pageUrl: page.url,
    usesAsar: /app\.asar/i.test(page.url || ""),
    usesVite: /5173|vite/i.test(page.url || ""),
  };

  const headerText = await evaluate(`document.body.innerText.slice(0, 3000)`);
  report.shell = {
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };

  await clickTab(evaluate, "Blueprint");
  const blueprintTextBefore = await evaluate(`document.body.innerText`);
  report.taskCardsUi = {
    sectionTitle: /Blueprint Phase Task Cards/i.test(blueprintTextBefore),
    afterPhase1Handoff:
      blueprintTextBefore.indexOf("Phase 1 Builder Handoff") <
      blueprintTextBefore.indexOf("Blueprint Phase Task Cards"),
    generateBtn: await evaluate(
      `[...document.querySelectorAll('button.action-btn')].some((b) => (b.textContent || '').trim() === 'Generate Phase Task Cards')`,
    ),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));
  await clickTab(evaluate, "Blueprint");

  let s = await snap();
  await evaluate(`window.nttc.clearImportedBlueprint()`);
  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  s = await snap();
  const bodyAfterNoBp = await evaluate(`document.body.innerText`);
  report.noBlueprint = {
    blockedMessage:
      /Save or import a Project Blueprint before generating task cards/i.test(
        bodyAfterNoBp,
      ) ||
      /Save or import a Project Blueprint before generating task cards/i.test(
        s.blueprint?.phaseTaskCards?.statusMessage ?? "",
      ),
  };
  if (s.blueprint?.phaseTaskCards?.saved) {
    fail("Task cards generated without blueprint");
  }

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  const pkgMtime = fs.existsSync(path.join(PROJECT, "package.json"))
    ? fs.statSync(path.join(PROJECT, "package.json")).mtimeMs
    : null;

  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: "Offline habit tracker for Windows.",
      projectType: "desktop-app",
      buildStyle: "small-model-friendly",
    })})`,
  );
  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  await evaluate(`window.nttc.generateBlueprintPhase1Handoff()`);
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const record = s.blueprint?.phaseTaskCards?.saved;
  const cards = record?.cards ?? [];
  report.generation = {
    count: cards.length,
    inRange: cards.length >= 4 && cards.length <= 8,
    ids: cards.map((c) => c.id),
    readableIds: cards.every((c) => /^P1[A-Z]$/.test(c.id)),
    activeTaskId: record?.activeTaskId ?? null,
    sectionsOk: cards.every((c) =>
      REQUIRED_SECTIONS.every((sec) => c.markdown.includes(`## ${sec}`)),
    ),
    qualityBadges: cards.map((c) => c.quality),
    hasQualityUi: /Quality:/i.test(await evaluate(`document.body.innerText`)),
  };

  const firstId = cards[0]?.id;
  if (firstId) {
    await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus(${JSON.stringify(firstId)}, "planned")`);
    await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus(${JSON.stringify(firstId)}, "sent-to-builder")`);
    await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus(${JSON.stringify(firstId)}, "implementation-returned")`);
    await evaluate(`window.nttc.setBlueprintActivePhaseTaskCard(${JSON.stringify(firstId)})`);
    await evaluate(`window.nttc.recordCopyBlueprintPhaseTaskCard(${JSON.stringify(firstId)})`);
    await evaluate(`window.nttc.recordCopyAllBlueprintPhaseTaskCards()`);
    s = await snap();
    const card0 = s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === firstId);
    report.statusFlow = {
      status: card0?.status,
      active: s.blueprint?.status?.activeTaskId === firstId,
      copyLogs: (s.actionLog ?? []).some((e) => /task card copied/i.test(e.message)),
      copyAllLogs: (s.actionLog ?? []).some((e) => /All blueprint task cards copied/i.test(e.message)),
    };
    await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus(${JSON.stringify(firstId)}, "reviewed")`);
    await evaluate(`window.nttc.resetBlueprintPhaseTaskCardStatus(${JSON.stringify(firstId)})`);
    s = await snap();
    report.statusFlow.afterReset =
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === firstId)?.status === "drafted";
  }

  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  s = await snap();
  report.clear = { cleared: !s.blueprint?.phaseTaskCards?.saved };
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  s = await snap();
  report.regenerate = { count: s.blueprint?.phaseTaskCards?.saved?.cards?.length ?? 0 };

  const savedStatus = s.blueprint?.phaseTaskCards?.saved?.cards?.[0]?.status;
  await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus("P1A", "planned")`);
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.historyRestore = {
    cardsExist: Boolean(s.blueprint?.phaseTaskCards?.saved),
    cardCount: s.blueprint?.phaseTaskCards?.saved?.cards?.length ?? 0,
    statusRestored:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")?.status ===
      "planned",
    savedStatusBeforeReload: savedStatus,
  };

  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir)
    ? fs.readdirSync(planningDir)
    : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const previewFiles = (preview?.files ?? []).map((f) => f.fileName);
  const buildPhases = preview?.files?.find((f) => f.fileName === "BUILD_PHASES.md");
  const taskCardsPreview = preview?.files?.find((f) => f.fileName === "TASK_CARDS.md");
  report.planningPreview = {
    fileCount: previewFiles.length,
    hasTaskCardsMd: previewFiles.includes("TASK_CARDS.md"),
    buildPhasesSummary: /Blueprint Phase Task Cards/i.test(buildPhases?.content ?? ""),
    handoffSummary: /Blueprint Phase Task Cards|Task ID/i.test(
      preview?.files?.find((f) => f.fileName === "HANDOFF_NOTES.md")?.content ?? "",
    ),
    currentStatusSummary: /Blueprint Phase Task Cards|Active task/i.test(
      preview?.files?.find((f) => f.fileName === "CURRENT_STATUS.md")?.content ?? "",
    ),
    noDiskWrite:
      JSON.stringify(
        fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : [],
      ) === JSON.stringify(planningBefore),
    taskCardsBody: Boolean(taskCardsPreview?.content?.includes("NTTC Blueprint Task Card")),
  };

  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 600));
  const dashText = await evaluate(`document.body.innerText`);
  report.dashboard = {
    dailyNext: /Generate Phase Task Cards|Copy P1|Blueprint|task card/i.test(dashText),
    recommendedNext: /Recommended Next Step/i.test(dashText),
  };

  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 600));
  const reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    phaseTaskCardsStep: /Phase Task Cards/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    handoffReadiness: /Handoff Readiness/i.test(reportsText),
  };

  report.regressions = {
    askLocalPlanner: await evaluate(
      `[...document.querySelectorAll('button.action-btn')].some((b) => (b.textContent || '').trim() === 'Ask Local Planner AI')`,
    ),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
    codeContext: /Code Context Pack/i.test(reportsText),
    projectMemory: /Project Memory/i.test(reportsText),
    noAudio: !/TTS|text.to.speech|speaker script player/i.test(
      (await evaluate(`document.body.innerText`)).toLowerCase(),
    ),
  };

  const srcAfter = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  report.boundaries = {
    noAiCallDuringCards: !(s.actionLog ?? []).some((e) =>
      /ollama|local ai.*task card/i.test(`${e.message} ${e.detail ?? ""}`),
    ),
    pkgUnchanged:
      pkgMtime ===
      (fs.existsSync(path.join(PROJECT, "package.json"))
        ? fs.statSync(path.join(PROJECT, "package.json")).mtimeMs
        : null),
    srcFileCountSame: srcBefore.length === srcAfter.length,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.launch.usesAsar && !/file:/i.test(report.launch.pageUrl ?? "")) {
    warn("pageUrl may not show app.asar explicitly");
  }
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.liveQwenDisabled) fail("Live Qwen not shown disabled");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.taskCardsUi.sectionTitle) fail("Blueprint Phase Task Cards section missing");
  if (!report.taskCardsUi.afterPhase1Handoff) fail("Task cards not after Phase 1 Handoff");
  if (!report.noBlueprint.blockedMessage) fail("No-blueprint message missing");
  if (!report.generation.inRange) fail(`Card count ${report.generation.count} not 4-8`);
  if (!report.generation.readableIds) fail("Task IDs not readable P1A style");
  if (!report.generation.sectionsOk) fail("Missing required card sections");
  if (!report.statusFlow?.copyLogs) fail("Copy task log missing");
  if (!report.clear.cleared) fail("Clear task cards failed");
  if (!report.historyRestore.cardsExist) fail("History restore failed");
  if (!report.planningPreview.noDiskWrite) fail("Preview wrote files to disk");
  if (!report.planningPreview.hasTaskCardsMd) fail("TASK_CARDS.md preview missing");
  if (!report.workflow.phaseTaskCardsStep) fail("Workflow Phase Task Cards step missing");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
