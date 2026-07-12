/**
 * Stage 97 packaged-app smoke (CDP) — Changed Files Task Link focus.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9241
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9241";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

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
  spawn(EXE, ["--remote-debugging-port=9241"], {
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

  await clickTab(evaluate, "Reports");
  let auditText = await evaluate(`document.body.innerText`);
  report.uiReports = {
    changedFilesSection: /Changed Files \/ Patch Review/i.test(auditText),
    blueprintTaskLink: /Blueprint Task Link/i.test(auditText),
    linkButton: /Link Current Changed Files Metadata to Selected Task/i.test(auditText),
    clearLinkButton: /Clear Changed Files Task Link/i.test(auditText),
    taskDropdown: /Selected task/i.test(auditText),
  };

  await clickTab(evaluate, "Blueprint");
  let blueprintText = await evaluate(`document.body.innerText`);
  report.uiBlueprint = {
    taskArtifactIndex: /Task Artifact Index/i.test(blueprintText),
    taskReconciliation: /Blueprint Task Reconciliation/i.test(blueprintText),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );

  await evaluate(`window.nttc.clearImportedBlueprint()`);
  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  await evaluate(`window.nttc.clearTaskCardBuilderHandoff()`);
  await evaluate(`window.nttc.clearTaskImplementationReport()`);
  await evaluate(`window.nttc.clearBlueprintTaskReconciliation()`);
  await evaluate(`window.nttc.clearTaskArtifactIndex()`);
  await evaluate(`window.nttc.clearChangedFilesTaskLink()`);
  await new Promise((r) => setTimeout(r, 400));

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
  await new Promise((r) => setTimeout(r, 500));

  const advisorBeforeScan = (await snap()).advisorResponse;
  await evaluate(`window.nttc.scanChangedFiles()`);
  await new Promise((r) => setTimeout(r, 3000));
  let s = await snap();
  const scan = s.changedFiles?.lastScan;
  report.changedFilesScan = {
    hasScan: Boolean(scan?.scannedAt),
    isGitRepo: Boolean(scan?.isGitRepo),
    totalCount: scan?.totalCount ?? 0,
    noAdvisorCall: advisorBeforeScan === s.advisorResponse,
  };

  await clickTab(evaluate, "Reports");
  auditText = await evaluate(`document.body.innerText`);
  report.taskLinkUi = {
    suggestionShown: /Suggested task:/i.test(auditText),
    notAutoLinkedBeforeClick: !s.changedFiles?.taskLink?.saved,
  };

  s = await snap();
  const suggestedId = s.changedFiles?.taskLink?.suggestedTaskId;
  report.taskLinkSuggestion = {
    hasSuggestion: Boolean(suggestedId),
    suggestedId,
  };

  await evaluate(`window.nttc.setChangedFilesTaskLinkSelectedTask("P1A")`);
  const advisorBeforeLink = s.advisorResponse;
  await evaluate(`window.nttc.linkChangedFilesToTask()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const link = s.changedFiles?.taskLink?.saved;
  report.taskLinkCreate = {
    linked: Boolean(link),
    taskId: link?.taskId === "P1A",
    taskTitle: Boolean(link?.taskTitle),
    linkedAt: Boolean(link?.linkedAt),
    changedFilesCount: typeof link?.changedFilesCount === "number",
    stale: link?.stale === false,
    pathsStored: (link?.changedFilePaths?.length ?? 0) >= 0,
    noAdvisorCall: advisorBeforeLink === s.advisorResponse,
    linkLog: (s.actionLog ?? []).some((e) =>
      /Changed-files metadata linked|linked to task/i.test(e.message),
    ),
  };

  report.scopeDrift = {
    warningCount: link?.warnings?.length ?? 0,
    hasBroadFileWarning: (link?.warnings ?? []).some((w) =>
      /Broad core file|App\.tsx|main\/index|package\.json/i.test(w),
    ),
    pathsIncludeApp: (link?.changedFilePaths ?? []).some((p) => /App\.tsx/i.test(p)),
    pathsIncludeMain: (link?.changedFilePaths ?? []).some((p) =>
      /main[\\/]index\.ts/i.test(p),
    ),
  };

  await evaluate(`window.nttc.clearChangedFilesTaskLink()`);
  s = await snap();
  report.taskLinkClear = {
    cleared: !s.changedFiles?.taskLink?.saved,
    clearLog: (s.actionLog ?? []).some((e) =>
      /Changed-files task link cleared|task link cleared/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.setChangedFilesTaskLinkSelectedTask("P1A")`);
  await evaluate(`window.nttc.linkChangedFilesToTask()`);
  await new Promise((r) => setTimeout(r, 300));

  const linkIdBeforeReopen = (await snap()).changedFiles?.taskLink?.saved?.linkedAt;
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.historyRestore = {
    restored: Boolean(s.changedFiles?.taskLink?.saved),
    sameLinkedAt: s.changedFiles?.taskLink?.saved?.linkedAt === linkIdBeforeReopen,
    taskId: s.changedFiles?.taskLink?.saved?.taskId ?? null,
  };

  await evaluate(`window.nttc.generateTaskArtifactIndex()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const indexMd = s.blueprint?.taskArtifactIndex?.saved?.markdown ?? "";
  report.artifactIndex = {
    saved: Boolean(s.blueprint?.taskArtifactIndex?.saved),
    p1aChangedFilesSection: /P1A[\s\S]*### Changed Files Link[\s\S]*Linked: yes/i.test(
      indexMd,
    ),
    globalLinkSection: /## Changed Files Link[\s\S]*Linked task:/i.test(indexMd),
    notDeferOnly: !/not linked to a Blueprint task ID/i.test(indexMd) || /Linked task:/i.test(indexMd),
    hasChangedFilesLinkInDetails: /Changed Files Link/i.test(indexMd),
  };

  await evaluate(`window.nttc.generateBlueprintTaskReconciliation()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const reconMd = s.blueprint?.taskReconciliation?.saved?.markdown ?? "";
  report.reconciliation = {
    saved: Boolean(s.blueprint?.taskReconciliation?.saved),
    hasSection: reconMd.includes("## Changed Files Link Consistency"),
    hasLinkWarnings: /changed-files|scope|fingerprint|link/i.test(reconMd),
  };

  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir)
    ? [...fs.readdirSync(planningDir)]
    : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const currentStatus = preview?.files?.find((f) => f.fileName === "CURRENT_STATUS.md");
  const linkFile = preview?.files?.find(
    (f) => f.fileName === "CHANGED_FILES_TASK_LINKS.md",
  );
  report.planningPreview = {
    statusNote: /Changed Files Task Link|changed-files task link/i.test(
      currentStatus?.content ?? "",
    ),
    hasLinkMd: Boolean(linkFile),
    noDiskWrite:
      JSON.stringify(fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : []) ===
      JSON.stringify(planningBefore),
  };

  await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
  await new Promise((r) => setTimeout(r, 500));
  const planningAfter = fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : [];
  report.planningExport = {
    onlyMd: planningAfter.every((f) => f.endsWith(".md")),
    hasLinkExport: planningAfter.includes("CHANGED_FILES_TASK_LINKS.md"),
  };

  const genAtBefore = s.blueprint?.phaseTaskCards?.saved?.generatedAt;
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.linkStaleOnRegen = {
    cardsRegenerated: s.blueprint?.phaseTaskCards?.saved?.generatedAt !== genAtBefore,
    linkStale: Boolean(s.changedFiles?.taskLink?.saved?.stale),
    staleLog: (s.actionLog ?? []).some((e) =>
      /Changed-files task link stale|task link stale/i.test(e.message),
    ),
  };

  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 600));
  const reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    changedFilesTaskLinkStep: /Changed Files Task Link/i.test(reportsText),
    taskArtifactIndexStep: /Task Artifact Index/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
  };

  const srcAfter = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  report.boundaries = {
    srcFileCountSame: srcBefore.length === srcAfter.length,
    metadataOnly: Boolean(s.changedFiles?.taskLink?.saved?.taskId),
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.launch.usesAsar) fail("Not loading from app.asar");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.uiReports.blueprintTaskLink) fail("Blueprint Task Link missing on Reports tab");
  if (!report.uiReports.linkButton) fail("Link button missing");
  if (!report.uiBlueprint.taskArtifactIndex) fail("Task Artifact Index missing");
  if (!report.uiBlueprint.taskReconciliation) fail("Task Reconciliation missing");
  if (!report.changedFilesScan.hasScan) fail("Changed-files scan failed");
  if (!report.taskLinkCreate.linked) fail("Task link not created");
  if (!report.taskLinkCreate.taskId) fail("Task link missing P1A task ID");
  if (!report.taskLinkClear.cleared) fail("Clear task link failed");
  if (!report.historyRestore.restored) fail("Task link history restore failed");
  if (!report.artifactIndex.globalLinkSection) fail("Artifact index global link section missing");
  if (!report.reconciliation.hasSection) fail("Reconciliation missing Changed Files Link Consistency");
  if (!report.planningPreview.noDiskWrite) fail("Planning preview wrote disk");
  if (!report.workflow.changedFilesTaskLinkStep) fail("Workflow step missing");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
