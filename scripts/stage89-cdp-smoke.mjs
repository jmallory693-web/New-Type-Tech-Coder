/**
 * Stage 89 packaged-app smoke (CDP).
 * Task Card Builder Handoff workflow + Stage 86/87 regressions.
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

const HANDOFF_SECTIONS = [
  "Builder Target",
  "Selected Task",
  "Goal",
  "Context",
  "What To Build",
  "What Not To Build Yet",
  "Likely Files / Modules",
  "Safety Boundaries",
  "Small-Model Friendly Architecture",
  "Builder Instructions",
  "Validation Required",
  "Report Back Format",
  "After Builder Returns",
  "Safety Reminder",
];

const TARGETS = [
  "cursor",
  "codex",
  "claude",
  "chatgpt",
  "grok",
  "qwen",
  "human-programmer",
  "generic-builder",
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
  const bodyText = await evaluate(`document.body.innerText`);
  report.ui = {
    taskCardsSection: /Blueprint Phase Task Cards/i.test(bodyText),
    handoffSection: /Task Card Builder Handoff/i.test(bodyText),
    handoffAfterTaskCards:
      bodyText.indexOf("Blueprint Phase Task Cards") <
      bodyText.indexOf("Task Card Builder Handoff"),
    generateHandoffBtn: await evaluate(
      `[...document.querySelectorAll('button.action-btn')].some((b) => (b.textContent || '').trim() === 'Generate Task Builder Handoff')`,
    ),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));
  await clickTab(evaluate, "Blueprint");

  await evaluate(`window.nttc.clearImportedBlueprint()`);
  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  await evaluate(`window.nttc.clearTaskCardBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 400));

  let s = await snap();
  const noCardsBody = await evaluate(`document.body.innerText`);
  report.noTaskCards = {
    message: /Generate Blueprint Phase Task Cards first/i.test(noCardsBody),
  };
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  s = await snap();
  if (s.blueprint?.taskCardBuilderHandoff?.saved) {
    fail("Handoff generated without task cards");
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

  await evaluate(`window.nttc.setTaskCardBuilderHandoffSelectedTask("P1A")`);
  s = await snap();
  const uiBody = await evaluate(`document.body.innerText`);
  report.dropdowns = {
    selectedTask: s.blueprint?.taskCardBuilderHandoff?.selectedTaskId === "P1A",
    targetOptions:
      /Cursor/.test(uiBody) &&
      /Codex/.test(uiBody) &&
      /Claude/.test(uiBody) &&
      /ChatGPT/.test(uiBody) &&
      /Grok/.test(uiBody) &&
      /Qwen/.test(uiBody) &&
      /Human programmer/.test(uiBody) &&
      /Generic builder/.test(uiBody),
    strictnessOptions:
      /Conservative/.test(uiBody) &&
      /Normal/.test(uiBody) &&
      /Fast small patch/.test(uiBody),
  };

  await evaluate(`window.nttc.setTaskCardBuilderHandoffTarget("generic-builder")`);
  await evaluate(`window.nttc.setTaskCardBuilderHandoffStrictness("conservative")`);
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  s = await snap();
  const handoff = s.blueprint?.taskCardBuilderHandoff?.saved;
  const md = handoff?.markdown ?? "";
  report.handoffDefault = {
    title: md.startsWith("# NTTC Task Builder Handoff"),
    sectionsOk: HANDOFF_SECTIONS.every((sec) => md.includes(`## ${sec}`)),
    readiness: handoff?.readiness ?? null,
    hasReadinessUi: /Readiness:/i.test(await evaluate(`document.body.innerText`)),
    taskMeta: md.includes("P1A") && md.includes("Selected Task"),
    smallModel: /Small-Model|small and focused|module boundaries/i.test(md),
    conservative: /Conservative|strongest safety/i.test(md),
    notAutoSent: s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")
      ?.status === "drafted",
  };

  const targetWording = {};
  for (const target of ["cursor", "claude", "human-programmer"]) {
    await evaluate(`window.nttc.setTaskCardBuilderHandoffTarget(${JSON.stringify(target)})`);
    await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
    const tmd =
      (await snap()).blueprint?.taskCardBuilderHandoff?.saved?.markdown ?? "";
    if (target === "cursor") targetWording.cursor = /file-by-file|scoped/i.test(tmd);
    if (target === "claude") {
      targetWording.claude = /hidden file access|missing context/i.test(tmd);
    }
    if (target === "human-programmer") {
      targetWording["human-programmer"] = /checklist|unclear before coding/i.test(tmd);
    }
  }
  report.targetWording = targetWording;

  await evaluate(`window.nttc.setTaskCardBuilderHandoffStrictness("fast-small-patch")`);
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  const fastMd =
    (await snap()).blueprint?.taskCardBuilderHandoff?.saved?.markdown ?? "";
  report.fastStrictness = {
    narrows: /small and fast|narrow/i.test(fastMd),
    keepsSafety: /Do not bypass|Apply Patch|Live Qwen/i.test(fastMd),
  };

  await evaluate(`window.nttc.recordCopyTaskCardBuilderHandoff()`);
  s = await snap();
  report.copy = {
    copiedAt: Boolean(s.blueprint?.taskCardBuilderHandoff?.saved?.copiedAt),
    copyLog: (s.actionLog ?? []).some((e) => /Task builder handoff copied/i.test(e.message)),
    statusStillDrafted:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")?.status ===
      "drafted",
  };

  await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus("P1A", "sent-to-builder")`);
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 600));
  const dashSent = await evaluate(`document.body.innerText`);
  report.dailyNextSent = /Import Builder Result|builder result|paste/i.test(dashSent);

  await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus("P1A", "implementation-returned")`);
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 600));
  const dashImpl = await evaluate(`document.body.innerText`);
  report.dailyNextImpl = /Implementation Review|Review Returned/i.test(dashImpl);

  await clickTab(evaluate, "Blueprint");
  await evaluate(`window.nttc.clearTaskCardBuilderHandoff()`);
  s = await snap();
  report.clear = { cleared: !s.blueprint?.taskCardBuilderHandoff?.saved };

  await evaluate(`window.nttc.setTaskCardBuilderHandoffTarget("generic-builder")`);
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 300));
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.historyRestore = {
    handoffExists: Boolean(s.blueprint?.taskCardBuilderHandoff?.saved),
    taskId: s.blueprint?.taskCardBuilderHandoff?.saved?.selectedTaskId,
    notStale: !s.blueprint?.taskCardBuilderHandoff?.saved?.stale,
  };

  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  s = await snap();
  report.staleOnClearCards = {
    stale: Boolean(s.blueprint?.taskCardBuilderHandoff?.saved?.stale),
  };

  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await evaluate(`window.nttc.setTaskCardBuilderHandoffSelectedTask("P1A")`);
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir)
    ? [...fs.readdirSync(planningDir)]
    : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const taskCardsFile = preview?.files?.find((f) => f.fileName === "TASK_CARDS.md");
  const currentHandoffFile = preview?.files?.find(
    (f) => f.fileName === "CURRENT_TASK_HANDOFF.md",
  );
  report.planningPreview = {
    taskCardsNote: /Task Builder Handoff exists/i.test(taskCardsFile?.content ?? ""),
    hasCurrentHandoffMd: Boolean(currentHandoffFile),
    handoffBodyInPreview: /NTTC Task Builder Handoff/i.test(
      currentHandoffFile?.content ?? "",
    ),
    noDiskWrite:
      JSON.stringify(fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : []) ===
      JSON.stringify(planningBefore),
  };

  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 600));
  const reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    taskBuilderHandoffStep: /Task Builder Handoff/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    phaseTaskCardsStep: /Phase Task Cards/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
    builderHandoffExport: /Builder Handoff/i.test(reportsText),
  };

  const srcAfter = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  report.boundaries = {
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
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.ui.handoffSection) fail("Task Card Builder Handoff section missing");
  if (!report.ui.handoffAfterTaskCards) fail("Handoff not after task cards");
  if (!report.noTaskCards.message) fail("No-task-cards message missing");
  if (!report.handoffDefault.title) fail("Handoff title missing");
  if (!report.handoffDefault.sectionsOk) fail("Handoff sections incomplete");
  if (!report.handoffDefault.notAutoSent) fail("Task auto-changed to sent");
  if (!report.copy.copyLog) fail("Copy handoff log missing");
  if (!report.historyRestore.handoffExists) fail("History restore failed");
  if (!report.staleOnClearCards.stale) fail("Handoff not stale after clear cards");
  if (!report.planningPreview.noDiskWrite) fail("Preview wrote disk files");
  if (!report.planningPreview.hasCurrentHandoffMd) fail("CURRENT_TASK_HANDOFF.md missing");
  if (!report.workflow.taskBuilderHandoffStep) fail("Workflow step missing");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
