/**
 * Stage 91 packaged-app smoke (CDP).
 * Task Implementation Intake workflow + Stage 89/90 regressions.
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

const COMPLETE_REPORT = `# Builder Implementation Report

## 1. Analysis
Implemented habit list shell for P1A.

## 2. Plan
Add HabitList component and types only.

## 3. Files changed
- src/shared/types.ts
- src/renderer/components/HabitList.tsx

## 4. Implementation summary
Added habit list UI shell with no persistence yet.

## 5. Validation performed
npm run typecheck passed. Manual smoke on habit list render.

## 6. Risks
Low risk; planning-only adjacent work deferred.

## 7. Safety confirmations
No source edit mode. Text only. Did not apply patch. No commands run.

## 8. Questions / blockers
None.
`;

const INCOMPLETE_REPORT = `Implemented something.
Changed src/foo.ts.
No validation yet.
`;

const SUMMARY_SECTIONS = [
  "# NTTC Task Implementation Intake Summary",
  "## Task",
  "## Builder / Source",
  "## Report Status",
  "## Detected Files Changed",
  "## Validation Mentioned",
  "## Risks / Blockers",
  "## Safety Confirmations",
  "## Missing Report Sections",
  "## Recommended Next Step",
  "## Safety Reminder",
];

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

function btnExists(evaluate, label) {
  return evaluate(
    `[...document.querySelectorAll('button.action-btn,button')].some((b) => (b.textContent || '').trim() === ${JSON.stringify(label)})`,
  );
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
  let bodyText = await evaluate(`document.body.innerText`);
  report.ui = {
    taskCardsSection: /Blueprint Phase Task Cards/i.test(bodyText),
    handoffSection: /Task Card Builder Handoff/i.test(bodyText),
    intakeSection: /Task Implementation Intake/i.test(bodyText),
    intakeAfterHandoff:
      bodyText.indexOf("Task Card Builder Handoff") <
      bodyText.indexOf("Task Implementation Intake"),
    saveBtn: await btnExists(evaluate, "Save Task Implementation Report"),
    copyBtn: await btnExists(evaluate, "Copy Task Implementation Report"),
    clearBtn: await btnExists(evaluate, "Clear Task Implementation Report"),
    markReturnedBtn: await btnExists(evaluate, "Mark Task Implementation Returned"),
    markReviewedBtn: await btnExists(evaluate, "Mark Task Reviewed"),
    stageReviewBtn: await btnExists(
      evaluate,
      "Use this report for Implementation Review",
    ),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));
  await clickTab(evaluate, "Blueprint");

  await evaluate(`window.nttc.clearImportedBlueprint()`);
  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  await evaluate(`window.nttc.clearTaskCardBuilderHandoff()`);
  await evaluate(`window.nttc.clearTaskImplementationReport()`);
  await new Promise((r) => setTimeout(r, 400));

  bodyText = await evaluate(`document.body.innerText`);
  report.noTaskCards = {
    message: /Generate Blueprint Phase Task Cards first/i.test(bodyText),
  };

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
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await evaluate(`window.nttc.setTaskCardBuilderHandoffSelectedTask("P1A")`);
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 500));

  bodyText = await evaluate(`document.body.innerText`);
  report.builderSources = {
    cursor: /Cursor/.test(bodyText),
    codex: /Codex/.test(bodyText),
    claude: /Claude/.test(bodyText),
    chatgpt: /ChatGPT/.test(bodyText),
    grok: /Grok/.test(bodyText),
    qwen: /Qwen/.test(bodyText),
    human: /Human programmer/.test(bodyText),
    other: /Other/.test(bodyText),
  };

  let s = await snap();
  const selectedBeforeSave =
    s.blueprint?.taskImplementationIntake?.selectedTaskId ??
    s.blueprint?.taskCardBuilderHandoff?.selectedTaskId;
  report.defaultTask = {
    matchesHandoff: selectedBeforeSave === "P1A",
  };

  await evaluate(
    `window.nttc.setTaskImplementationIntakeBuilderSource("Cursor")`,
  );
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  s = await snap();
  const saved = s.blueprint?.taskImplementationIntake?.selectedReport;
  const summary = saved?.summaryMarkdown ?? "";
  report.completeSave = {
    saved: Boolean(saved),
    summarySectionsOk: SUMMARY_SECTIONS.every((sec) => summary.includes(sec)),
    filesDetected: (saved?.detectedFilesChanged?.length ?? 0) > 0,
    validationMentioned: (saved?.detectedValidationMentions?.length ?? 0) > 0,
    risksPresent: (saved?.detectedRisksBlockers?.length ?? 0) > 0,
    safetyConfirmations: (saved?.detectedSafetyConfirmations?.length ?? 0) > 0,
    notAutoReturned: saved?.markedImplementationReturned === false,
    saveLog: (s.actionLog ?? []).some((e) =>
      /Task implementation report saved/i.test(e.message),
    ),
    cardStillNotReturned:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")
        ?.status !== "implementation-returned",
  };

  await evaluate(`window.nttc.clearTaskImplementationReport()`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(INCOMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  s = await snap();
  const incomplete = s.blueprint?.taskImplementationIntake?.selectedReport;
  report.incompleteSave = {
    saved: Boolean(incomplete),
    missingSections: (incomplete?.missingExpectedSections?.length ?? 0) > 0,
    missingLog: (s.actionLog ?? []).some((e) =>
      /missing sections detected/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.clearTaskImplementationReport()`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText("API_KEY=sk-test\\nImplemented foo.")`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  s = await snap();
  report.secretBlock = {
    notSavedWithoutOverride: !s.blueprint?.taskImplementationIntake?.selectedReport,
    secretLog: (s.actionLog ?? []).some((e) =>
      /possible secret detected/i.test(e.message),
    ),
  };
  await evaluate(`window.nttc.saveTaskImplementationReport(true)`);
  s = await snap();
  report.secretOverride = {
    savedWithOverride: Boolean(
      s.blueprint?.taskImplementationIntake?.selectedReport?.savedWithSecretOverride,
    ),
  };

  const advisorBefore = s.advisorResponse;
  const codeAiBefore = s.codeContextAi?.saved;
  report.noAutoAi = {
    advisorUnchanged: advisorBefore === s.advisorResponse,
    codeAiUnchanged: codeAiBefore === s.codeContextAi?.saved,
    implReviewNotAutoRun: !s.implementationReview?.saved,
  };

  await evaluate(`window.nttc.recordCopyTaskImplementationReport()`);
  s = await snap();
  report.copy = {
    copyLog: (s.actionLog ?? []).some((e) =>
      /Task implementation report copied/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.markTaskImplementationReturned()`);
  s = await snap();
  report.markReturned = {
    status:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")
        ?.status,
    flag: s.blueprint?.taskImplementationIntake?.selectedReport
      ?.markedImplementationReturned,
    log: (s.actionLog ?? []).some((e) =>
      /marked implementation returned/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.markTaskImplementationReviewed(false)`);
  s = await snap();
  report.markReviewedWarn = {
    stillNotReviewed:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")
        ?.status !== "reviewed",
    needsConfirm: /No Implementation Review found/i.test(
      s.blueprint?.taskImplementationIntake?.statusMessage ?? "",
    ),
  };

  await evaluate(`window.nttc.markTaskImplementationReviewed(true)`);
  s = await snap();
  report.markReviewed = {
    status:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")
        ?.status,
    reviewedFlag:
      s.blueprint?.taskImplementationIntake?.selectedReport?.markedReviewed,
    nextSuggestion: Boolean(
      s.blueprint?.taskImplementationIntake?.nextTaskSuggestion,
    ),
  };

  await evaluate(`window.nttc.stageTaskImplementationReportForReview()`);
  s = await snap();
  report.stageForReview = {
    builderResultType: s.builderResult?.saved?.responseType,
    builderResultLabel: s.builderResult?.saved?.label,
    notAutoImplReview: !s.implementationReview?.saved,
    stageLog: (s.actionLog ?? []).some((e) =>
      /staged for review|staged for Implementation Review/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.clearTaskImplementationReport()`);
  s = await snap();
  report.clear = {
    cleared: !s.blueprint?.taskImplementationIntake?.selectedReport,
    clearLog: (s.actionLog ?? []).some((e) =>
      /Task implementation report cleared/i.test(e.message),
    ),
  };

  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  await evaluate(`window.nttc.markTaskImplementationReturned()`);
  await new Promise((r) => setTimeout(r, 300));
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.historyRestore = {
    reportExists: Boolean(
      s.blueprint?.taskImplementationIntake?.reportsByTaskId?.P1A,
    ),
    markedReturned:
      s.blueprint?.taskImplementationIntake?.reportsByTaskId?.P1A
        ?.markedImplementationReturned,
  };

  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  s = await snap();
  report.staleOnClearCards = {
    stale: Boolean(
      s.blueprint?.taskImplementationIntake?.reportsByTaskId?.P1A?.stale,
    ),
  };

  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);

  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir)
    ? [...fs.readdirSync(planningDir)]
    : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const currentStatus = preview?.files?.find((f) => f.fileName === "CURRENT_STATUS.md");
  const taskCardsFile = preview?.files?.find((f) => f.fileName === "TASK_CARDS.md");
  const implReportsFile = preview?.files?.find(
    (f) => f.fileName === "IMPLEMENTATION_REPORTS.md",
  );
  report.planningPreview = {
    statusNote: /implementation reports/i.test(currentStatus?.content ?? ""),
    taskCardsNote: /implementation reports/i.test(taskCardsFile?.content ?? ""),
    hasImplReportsMd: Boolean(implReportsFile),
    noDiskWrite:
      JSON.stringify(fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : []) ===
      JSON.stringify(planningBefore),
  };

  await evaluate(`window.nttc.setBlueprintPhaseTaskCardStatus("P1A", "sent-to-builder")`);
  await evaluate(`window.nttc.clearTaskImplementationReport()`);
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 600));
  const dashPaste = await evaluate(`document.body.innerText`);
  report.dailyNextPaste = /Paste Builder|implementation report/i.test(dashPaste);

  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 600));
  const dashMark = await evaluate(`document.body.innerText`);
  report.dailyNextMark = /Mark.*Implementation Returned/i.test(dashMark);

  await evaluate(`window.nttc.markTaskImplementationReturned()`);
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 600));
  const dashReview = await evaluate(`document.body.innerText`);
  report.dailyNextReview = /Implementation Review/i.test(dashReview);

  await evaluate(`window.nttc.markTaskImplementationReviewed(true)`);
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 600));
  const dashNext = await evaluate(`document.body.innerText`);
  report.dailyNextNextTask = /next task|Move to Next Task|P1B/i.test(dashNext);

  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 600));
  const reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    intakeStep: /Task Implementation Intake/i.test(reportsText),
    handoffStep: /Task Builder Handoff/i.test(reportsText),
    taskCardsStep: /Phase Task Cards/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
    noApplyPatchBtn: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
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

  report.regression = {
    handoffStillWorks: Boolean(s.blueprint?.taskCardBuilderHandoff?.saved),
    taskCardsExist: Boolean(s.blueprint?.phaseTaskCards?.saved),
    blueprintImported: Boolean(s.blueprint?.importedBlueprint),
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.ui.intakeSection) fail("Task Implementation Intake section missing");
  if (!report.ui.intakeAfterHandoff) fail("Intake not after handoff");
  if (!report.noTaskCards.message) fail("No-task-cards message missing");
  if (!report.completeSave.saved) fail("Complete report save failed");
  if (!report.completeSave.summarySectionsOk) fail("Summary sections incomplete");
  if (!report.completeSave.notAutoReturned) fail("Auto-marked returned on save");
  if (!report.secretBlock.notSavedWithoutOverride) fail("Secret not blocked");
  if (!report.secretOverride.savedWithOverride) fail("Secret override save failed");
  if (report.markReturned.status !== "implementation-returned") {
    fail("Mark returned did not update task status");
  }
  if (report.markReviewed.status !== "reviewed") fail("Mark reviewed failed");
  if (report.stageForReview.builderResultType !== "Implementation report") {
    fail("Stage for review wrong builder result type");
  }
  if (report.stageForReview.notAutoImplReview === false) {
    fail("Implementation Review auto-ran");
  }
  if (!report.historyRestore.reportExists) fail("History restore failed");
  if (!report.staleOnClearCards.stale) fail("Report not stale after clear cards");
  if (!report.planningPreview.noDiskWrite) fail("Preview wrote disk files");
  if (!report.workflow.intakeStep) fail("Workflow intake step missing");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
