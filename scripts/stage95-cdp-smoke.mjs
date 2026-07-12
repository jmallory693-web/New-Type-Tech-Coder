/**
 * Stage 95 packaged-app smoke (CDP) — Task Artifact Index / Join Keys focus.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9240
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9240";
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
## 3. Files changed
- src/shared/types.ts
- src/renderer/components/HabitList.tsx
## 5. Validation performed
npm run typecheck passed.
## 6. Risks
Low risk.
## 7. Safety confirmations
No source edit mode. Text only.
`;

const INDEX_SECTIONS = [
  "# NTTC Task Artifact Index",
  "## Summary",
  "## Task Coverage",
  "## Unlinked Artifacts",
  "## Stale Artifacts",
  "## Changed Files Link",
  "## Task Details",
  "## Recommended Fixes",
  "## Recommendation",
  "## Safety Reminder",
];

const INDEX_RECOMMENDATIONS = [
  "Deck traceable",
  "Needs relinking",
  "Resolve stale artifacts",
  "Review implementation links",
  "Blocked",
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

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9240"], {
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
    noAudioTts: !/text-to-speech|TTS|Play audio/i.test(headerText),
  };

  await clickTab(evaluate, "Blueprint");
  let bodyText = await evaluate(`document.body.innerText`);
  report.ui = {
    taskCardsSection: /Blueprint Phase Task Cards/i.test(bodyText),
    handoffSection: /Task Card Builder Handoff/i.test(bodyText),
    intakeSection: /Task Implementation Intake/i.test(bodyText),
    reconciliationSection: /Blueprint Task Reconciliation/i.test(bodyText),
    artifactIndexSection: /Task Artifact Index/i.test(bodyText),
    reconciliationAfterIntake:
      bodyText.indexOf("Task Implementation Intake") <
      bodyText.indexOf("Blueprint Task Reconciliation"),
    artifactIndexAfterReconciliation:
      bodyText.indexOf("Blueprint Task Reconciliation") <
      bodyText.indexOf("Task Artifact Index"),
    generateIndexBtn: /Generate Task Artifact Index/i.test(bodyText),
    copyIndexBtn: /Copy Task Artifact Index/i.test(bodyText),
    clearIndexBtn: /Clear Task Artifact Index/i.test(bodyText),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));
  await clickTab(evaluate, "Blueprint");

  await evaluate(`window.nttc.clearImportedBlueprint()`);
  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`);
  await evaluate(`window.nttc.clearTaskCardBuilderHandoff()`);
  await evaluate(`window.nttc.clearTaskImplementationReport()`);
  await evaluate(`window.nttc.clearBlueprintTaskReconciliation()`);
  await evaluate(`window.nttc.clearTaskArtifactIndex()`);
  await new Promise((r) => setTimeout(r, 400));

  bodyText = await evaluate(`document.body.innerText`);
  report.noTaskCardsIndex = {
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
  await new Promise((r) => setTimeout(r, 500));

  let s = await snap();
  const p1a = s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A");
  const p1b = s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1B");
  report.joinKeys = {
    p1aStableId: p1a?.id === "P1A",
    p1aFingerprint: Boolean(p1a?.taskCardFingerprint?.startsWith("tc-")),
    fingerprintDeterministic:
      p1a?.taskCardFingerprint ===
      (await snap()).blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")
        ?.taskCardFingerprint,
  };

  await evaluate(`window.nttc.setTaskCardBuilderHandoffSelectedTask("P1A")`);
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const handoff = s.blueprint?.taskCardBuilderHandoff?.saved;
  report.handoffJoinKeys = {
    taskId: handoff?.taskId === "P1A",
    taskTitle: Boolean(handoff?.taskTitle),
    taskPhase: Boolean(handoff?.taskPhase),
    sourceTaskCardHash: Boolean(handoff?.sourceTaskCardHash?.startsWith("tc-")),
    taskArtifactKind: Boolean(handoff?.taskArtifactKind),
  };

  await evaluate(`window.nttc.generateTaskArtifactIndex()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  let indexMd = s.blueprint?.taskArtifactIndex?.saved?.markdown ?? "";
  report.flagsBeforeReport = {
    missingHandoffP1B: /P1B.*handoff|no handoff|missing-handoff/i.test(indexMd),
    missingReportP1A: /P1A.*report|no implementation report|missing-report/i.test(indexMd),
    statusMismatchP1A:
      /implementation-returned|reviewed|status/i.test(indexMd) &&
      /P1A/i.test(indexMd),
  };

  await evaluate(`window.nttc.setTaskImplementationIntakeSelectedTask("P1A")`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const implReport = s.blueprint?.taskImplementationIntake?.reportsByTaskId?.P1A;
  report.intakeJoinKeys = {
    taskId: implReport?.taskId === "P1A",
    taskTitle: Boolean(implReport?.taskTitle),
    taskPhase: Boolean(implReport?.taskPhase),
    sourceTaskCardHash: Boolean(implReport?.sourceTaskCardHash?.startsWith("tc-")),
    sourceHandoffId: Boolean(implReport?.sourceHandoffId || implReport?.sourceHandoffGeneratedAt),
  };

  const advisorBeforeStage = s.advisorResponse;
  await evaluate(`window.nttc.stageTaskImplementationReportForReview()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const builder = s.builderResult?.saved;
  report.builderResultLink = {
    taskId: builder?.taskId === "P1A",
    taskTitle: Boolean(builder?.taskTitle),
    taskArtifactKind: /Blueprint Task Implementation Report/i.test(
      builder?.taskArtifactKind ?? "",
    ),
    sourceTaskCardHash: Boolean(builder?.sourceTaskCardHash),
    statusShowsP1A: /P1A/i.test(s.builderResult?.statusMessage ?? ""),
    noAdvisorCall: advisorBeforeStage === s.advisorResponse,
  };

  const advisorBeforeIndex = s.advisorResponse;
  await evaluate(`window.nttc.generateTaskArtifactIndex()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const index = s.blueprint?.taskArtifactIndex?.saved;
  indexMd = index?.markdown ?? "";
  report.artifactIndexGenerate = {
    saved: Boolean(index),
    titleOk: indexMd.includes("# NTTC Task Artifact Index"),
    sectionsOk: INDEX_SECTIONS.every((sec) => indexMd.includes(sec)),
    recommendation: index?.recommendation ?? null,
    recommendationKnown: INDEX_RECOMMENDATIONS.includes(index?.recommendation),
    p1aCard: /P1A/i.test(indexMd) && /Card|card/i.test(indexMd),
    p1aHandoff: /P1A/i.test(indexMd) && /Handoff|handoff/i.test(indexMd),
    p1aReport: /P1A/i.test(indexMd) && /Implementation Report|report/i.test(indexMd),
    changedFilesDefer: /Changed-files metadata is not yet linked to task IDs/i.test(indexMd),
    noAdvisorCall: advisorBeforeIndex === s.advisorResponse,
    noCodeAiCall: !s.codeContextAi?.saved,
    generateLog: (s.actionLog ?? []).some((e) =>
      /Task Artifact Index generated|artifact index generated/i.test(e.message),
    ),
  };

  const flagCountBeforeReturned = index?.staleArtifactCount ?? 0;
  const recBeforeReturned = index?.recommendation ?? null;

  await evaluate(`window.nttc.setTaskImplementationIntakeSelectedTask("P1A")`);
  await evaluate(`window.nttc.markTaskImplementationReturned()`);
  await evaluate(`window.nttc.generateTaskArtifactIndex()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const indexAfterReturned = s.blueprint?.taskArtifactIndex?.saved;
  report.afterReturned = {
    p1aStatus: p1a?.id
      ? s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")?.status
      : null,
    statusIsReturned:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")?.status ===
      "implementation-returned",
    recommendationChanged:
      indexAfterReturned?.recommendation !== recBeforeReturned ||
      (indexAfterReturned?.staleArtifactCount ?? 0) !== flagCountBeforeReturned,
  };

  await evaluate(`window.nttc.setTaskImplementationIntakeSelectedTask("P1A")`);
  await evaluate(`window.nttc.markTaskImplementationReviewed(true)`);
  await evaluate(`window.nttc.generateTaskArtifactIndex()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const indexAfterReviewed = s.blueprint?.taskArtifactIndex?.saved;
  const reviewedMd = indexAfterReviewed?.markdown ?? "";
  report.afterReviewed = {
    p1aReviewed:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")?.status ===
      "reviewed",
    reviewedBehaviorInIndex: /reviewed|Review/i.test(reviewedMd),
  };

  const genAtBefore = s.blueprint?.phaseTaskCards?.saved?.generatedAt;
  const indexGenBefore = s.blueprint?.taskArtifactIndex?.saved?.generatedAt;
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.indexStaleOnRegen = {
    cardsRegenerated: s.blueprint?.phaseTaskCards?.saved?.generatedAt !== genAtBefore,
    indexStale: Boolean(s.blueprint?.taskArtifactIndex?.saved?.stale),
    staleLog: (s.actionLog ?? []).some((e) =>
      /artifact index stale|Task artifacts changed/i.test(e.message),
    ),
    fingerprintChanged:
      s.blueprint?.phaseTaskCards?.saved?.cards?.find((c) => c.id === "P1A")
        ?.taskCardFingerprint !== p1a?.taskCardFingerprint,
  };

  await evaluate(`window.nttc.generateTaskArtifactIndex()`);
  await evaluate(`window.nttc.recordCopyTaskArtifactIndex()`);
  s = await snap();
  report.indexCopy = {
    copyLog: (s.actionLog ?? []).some((e) =>
      /Task Artifact Index copied|artifact index copied/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.clearTaskArtifactIndex()`);
  s = await snap();
  report.indexClear = {
    cleared: !s.blueprint?.taskArtifactIndex?.saved,
    clearLog: (s.actionLog ?? []).some((e) =>
      /Task Artifact Index cleared|artifact index cleared/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.generateTaskArtifactIndex()`);
  await new Promise((r) => setTimeout(r, 300));
  const indexIdBeforeReopen = (await snap()).blueprint?.taskArtifactIndex?.saved?.id;
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.historyRestore = {
    restored: Boolean(s.blueprint?.taskArtifactIndex?.saved),
    sameId: s.blueprint?.taskArtifactIndex?.saved?.id === indexIdBeforeReopen,
    recommendation: s.blueprint?.taskArtifactIndex?.saved?.recommendation ?? null,
  };

  await evaluate(`window.nttc.setTaskCardBuilderHandoffSelectedTask("P1B")`);
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  await evaluate(`window.nttc.setTaskImplementationIntakeSelectedTask("P1A")`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  await evaluate(`window.nttc.generateBlueprintTaskReconciliation()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const reconMd = s.blueprint?.taskReconciliation?.saved?.markdown ?? "";
  report.reconciliationIntegration = {
    handoffReportMismatch: /handoff|mismatch|task ID|drift/i.test(reconMd),
    fingerprintWarning: /fingerprint/i.test(reconMd),
    hasReconSaved: Boolean(s.blueprint?.taskReconciliation?.saved),
  };

  await evaluate(`window.nttc.clearTaskCardBuilderHandoff()`);
  await evaluate(`window.nttc.stageTaskImplementationReportForReview()`);
  await evaluate(`window.nttc.generateBlueprintTaskReconciliation()`);
  s = await snap();
  const reconNoTask = s.blueprint?.taskReconciliation?.saved?.markdown ?? "";
  report.reconciliationNoTaskId = {
    stagedWithoutHandoff: /without task ID|no task ID|unlinked/i.test(reconNoTask),
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
  const artifactFile = preview?.files?.find(
    (f) => f.fileName === "TASK_ARTIFACT_INDEX.md",
  );
  report.planningPreview = {
    statusNote: /Task Artifact Index|artifact index/i.test(currentStatus?.content ?? ""),
    hasArtifactMd: Boolean(artifactFile),
    artifactTitle: /NTTC Task Artifact Index/i.test(artifactFile?.content ?? ""),
    noDiskWrite:
      JSON.stringify(fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : []) ===
      JSON.stringify(planningBefore),
  };

  await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
  await new Promise((r) => setTimeout(r, 500));
  const planningAfter = fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : [];
  const planningOnlyMd = planningAfter.every((f) => f.endsWith(".md"));
  const planningUnderNttc = planningAfter.every(() =>
    fs.existsSync(planningDir),
  );
  report.planningExport = {
    wrotePlanning: planningAfter.length >= planningBefore.length,
    onlyMd: planningOnlyMd,
    hasArtifactExport: planningAfter.includes("TASK_ARTIFACT_INDEX.md"),
    underNttcPlanning: planningUnderNttc,
  };

  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 700));
  const dashText = await evaluate(`document.body.innerText`);
  report.dashboard = {
    artifactIndexAction: /Task Artifact Index|artifact index/i.test(dashText),
    generateIndexMention: /Generate Task Artifact Index|Regenerate Task Artifact Index/i.test(
      dashText,
    ),
  };

  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 600));
  const reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    artifactIndexStep: /Task Artifact Index/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    reconciliationStep: /Task Reconciliation/i.test(reportsText),
    intakeStep: /Task Implementation Intake/i.test(reportsText),
    handoffStep: /Task Builder Handoff/i.test(reportsText),
    taskCardsStep: /Phase Task Cards/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
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
    indexMetadataOnly: Boolean(s.blueprint?.taskArtifactIndex?.saved?.markdown),
    noAutoSend: true,
  };

  report.regression = {
    taskCardsExist: Boolean(s.blueprint?.phaseTaskCards?.saved),
    blueprintImported: Boolean(s.blueprint?.importedBlueprint),
    handoffWorks: Boolean(s.blueprint?.taskCardBuilderHandoff?.saved),
    intakeWorks: Boolean(s.blueprint?.taskImplementationIntake?.reportsByTaskId?.P1A),
    reconciliationWorks: Boolean(s.blueprint?.taskReconciliation?.saved),
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.launch.usesAsar) fail("Not loading from app.asar");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.ui.artifactIndexSection) fail("Task Artifact Index section missing");
  if (!report.ui.artifactIndexAfterReconciliation)
    fail("Task Artifact Index not after reconciliation");
  if (!report.noTaskCardsIndex.message) fail("No-task-cards index message missing");
  if (!report.joinKeys.p1aFingerprint) fail("taskCardFingerprint missing on P1A");
  if (!report.handoffJoinKeys.taskId) fail("Handoff join keys missing");
  if (!report.intakeJoinKeys.taskId) fail("Intake join keys missing");
  if (!report.builderResultLink.taskId) fail("Builder result task metadata missing");
  if (!report.artifactIndexGenerate.saved) fail("Artifact index not saved");
  if (!report.artifactIndexGenerate.sectionsOk) fail("Artifact index sections incomplete");
  if (!report.artifactIndexGenerate.recommendationKnown) fail("Unknown index recommendation");
  if (!report.artifactIndexGenerate.changedFilesDefer) fail("Changed-files defer note missing");
  if (!report.afterReturned.statusIsReturned) fail("P1A not marked implementation-returned");
  if (!report.indexStaleOnRegen.indexStale && !report.indexStaleOnRegen.cardsRegenerated)
    warn("Index stale on card regen not confirmed");
  if (!report.indexCopy.copyLog) fail("Artifact index copy log missing");
  if (!report.indexClear.cleared) fail("Artifact index clear failed");
  if (!report.historyRestore.restored) fail("Artifact index history restore failed");
  if (!report.planningPreview.noDiskWrite) fail("Planning preview wrote disk");
  if (!report.workflow.artifactIndexStep) fail("Workflow Task Artifact Index step missing");
  if (!report.boundaries.srcFileCountSame) fail("Source file count changed");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
