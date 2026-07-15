/**
 * Stage 114 packaged-app smoke — BlueprintTabSection after Stage 113.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9248
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9248";
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

const TASK_INTAKE_REPORT = `# Builder Implementation Report

## 1. Analysis
Stage 114 Blueprint tab shell smoke for P1A.

## 2. Plan
Verify BlueprintTabSection wiring only.

## 3. Files changed
- src/renderer/components/BlueprintTabSection.tsx
- src/renderer/components/blueprintTabSectionProps.ts

## 4. Implementation summary
Moved Blueprint tab shell out of App.tsx.

## 5. Validation performed
npm run typecheck passed.

## 6. Behavior preservation checks
Preserve existing behavior. No Apply Patch. No new features.

## 7. Risks
Low.

## 8. Safety confirmations
No source editing added by NTTC.

## 9. Questions / blockers
None.
`;

const ARCH_INTAKE_REPORT = `# Analysis
Stage 114 architecture regression smoke.

# Plan
Verify Reports architecture section still works.

# Files changed
- src/renderer/components/reportsArchitectureSectionProps.ts

# Implementation summary
No Stage 114 architecture changes.

# Validation performed
Packaged smoke only.

# Behavior preservation checks
Preserve existing behavior. No Apply Patch.

# Risks
Low.

# Safety confirmations
No source editing added by NTTC.

# Questions / blockers
None.
`;

const ARCH_SECTION_IDS = [
  "architecture-health",
  "architecture-refactor-task-cards",
  "architecture-refactor-task-builder-handoff",
  "architecture-refactor-task-implementation-intake",
];

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
  const skip = new Set(["node_modules", "release", "release-stage111", "dist", "dist-electron", ".git"]);
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
    stage113Wiring:
      bundleText.includes("buildBlueprintTabSectionProps") ||
      (bundleText.includes("Project Blueprint Planner") &&
        bundleText.includes("Build From Idea") &&
        bundleText.includes("blueprint-planner")),
    blueprintPlanner: bundleText.includes("Project Blueprint Planner"),
    buildFromIdea: bundleText.includes("Build From Idea"),
    noApplyPatch: !bundleText.includes("Apply Patch"),
  };
  if (!report.bundle.stage113Wiring) fail("Bundle missing Stage 113 Blueprint tab wiring");
  if (!report.bundle.noApplyPatch) fail("Bundle unexpectedly contains Apply Patch");

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9248"], {
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
    reportsTab: await btnExists(evaluate, "Reports"),
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes("/.nttc/") && !f.includes("\\.nttc\\"),
  );
  const advisorBefore = (await snap()).advisorResponse;

  // --- Blueprint tab UI regression ---
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 800));
  const blueprintText = await evaluate(`document.body.innerText`);
  const subtitleOk = /Build from idea — planning documents only, no source code or\s*scaffolding/i.test(
    blueprintText,
  );
  report.blueprintUi = {
    focusId: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="blueprint-planner"]'))`,
    ),
    headerTitle: /Project Blueprint Planner/i.test(blueprintText),
    subtitleUnchanged: subtitleOk,
    buildFromIdea: /Build From Idea/i.test(blueprintText),
    generateQuestions: await btnExists(evaluate, "Generate Planner Questions"),
    generatePrompt: await btnExists(evaluate, "Create Planner AI Prompt"),
    localPlannerAi: await btnExists(evaluate, "Ask Local Planner AI"),
    importSection: /Import Planner Blueprint/i.test(blueprintText),
    completeness: /Blueprint Completeness/i.test(blueprintText),
    checkCompleteness: await btnExists(evaluate, "Check Blueprint Completeness"),
    planningDocs: /Planning Documents/i.test(blueprintText),
    previewPlanning: await btnExists(evaluate, "Preview Planning Documents"),
    savePlanning: await btnExists(
      evaluate,
      "Save Planning Documents to `.nttc/planning/`",
    ),
    phase1Handoff: /Phase 1 Builder Handoff/i.test(blueprintText),
    phaseTaskCards: /Blueprint Phase Task Cards|Phase Task Cards/i.test(blueprintText),
    taskBuilderHandoff: /Task Card Builder Handoff|Task Builder Handoff/i.test(blueprintText),
    taskIntake: /Task Implementation Intake/i.test(blueprintText),
    taskReconciliation: /Task Reconciliation/i.test(blueprintText),
    taskArtifactIndex: /Task Artifact Index/i.test(blueprintText),
    stageReviewBtn: await btnExists(
      evaluate,
      "Use this report for Implementation Review",
    ),
  };

  // --- Functional Blueprint smoke ---
  await evaluate(`window.nttc.clearImportedBlueprint()`).catch(() => {});
  await evaluate(`window.nttc.clearBlueprintPhaseTaskCards()`).catch(() => {});
  await evaluate(`window.nttc.clearTaskCardBuilderHandoff()`).catch(() => {});
  await evaluate(`window.nttc.clearTaskImplementationReport()`).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: "Stage 114 disposable habit tracker smoke idea.",
      projectType: "desktop-app",
      buildStyle: "small-model-friendly",
    })})`,
  );
  await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(`window.nttc.generateBlueprintPlannerPrompt()`);
  await new Promise((r) => setTimeout(r, 800));
  let s = await snap();
  report.blueprintFunctional = {
    questionsGenerated: Boolean(s.blueprint?.plannerQuestions),
    promptGenerated: Boolean(s.blueprint?.plannerPrompt),
    localPlannerControlsPresent: report.blueprintUi.localPlannerAi,
  };

  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await new Promise((r) => setTimeout(r, 600));
  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.blueprintFunctional.imported = Boolean(s.blueprint?.importedBlueprint);
  report.blueprintFunctional.completenessRan = Boolean(
    s.blueprint?.completenessReport || s.blueprint?.status?.completenessCheckExists,
  );

  let planningCountBefore = 0;
  try {
    planningCountBefore = fs.existsSync(path.join(PROJECT, ".nttc", "planning"))
      ? fs.readdirSync(path.join(PROJECT, ".nttc", "planning")).length
      : 0;
  } catch {
    planningCountBefore = 0;
  }

  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 1000));
  s = await snap();
  let planningCountAfterPreview = 0;
  try {
    planningCountAfterPreview = fs.existsSync(path.join(PROJECT, ".nttc", "planning"))
      ? fs.readdirSync(path.join(PROJECT, ".nttc", "planning")).length
      : 0;
  } catch {
    planningCountAfterPreview = 0;
  }
  report.blueprintFunctional.planningPreview = {
    hasFiles: (s.blueprint?.planningDocsPreview?.files?.length ?? 0) > 0,
    didNotWrite: planningCountAfterPreview === planningCountBefore,
  };

  await evaluate(`window.nttc.generateBlueprintPhase1Handoff()`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 1000));
  s = await snap();
  const cards = s.blueprint?.phaseTaskCards?.saved?.cards ?? [];
  report.blueprintFunctional.phase1Handoff = Boolean(s.blueprint?.phase1Handoff);
  report.blueprintFunctional.phaseTaskCards = cards.length > 0;

  const firstTaskId = cards[0]?.id ?? "P1A";
  await evaluate(
    `window.nttc.setTaskCardBuilderHandoffSelectedTask(${JSON.stringify(firstTaskId)})`,
  );
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.blueprintFunctional.taskBuilderHandoff = Boolean(
    s.blueprint?.taskCardBuilderHandoff?.saved,
  );

  await evaluate(
    `window.nttc.setTaskImplementationIntakeSelectedTask(${JSON.stringify(firstTaskId)})`,
  );
  await evaluate(`window.nttc.setTaskImplementationIntakeBuilderSource("Cursor")`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(TASK_INTAKE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const taskSummary =
    s.blueprint?.taskImplementationIntake?.selectedReport?.summaryMarkdown ?? "";
  report.blueprintFunctional.taskIntakeSaved = /NTTC Task Implementation Intake Summary/i.test(
    taskSummary,
  );

  await evaluate(`window.nttc.stageTaskImplementationReportForReview()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  const builder = s.builderResult?.saved;
  report.blueprintFunctional.stageForReview = {
    staged: Boolean(builder),
    noAutoImplReview: !s.implementationReview?.saved,
    noAdvisorCall: advisorBefore === s.advisorResponse,
  };

  await evaluate(`window.nttc.generateBlueprintTaskReconciliation()`).catch(() => {});
  await evaluate(`window.nttc.generateTaskArtifactIndex()`).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.blueprintFunctional.reconciliation = Boolean(
    s.blueprint?.taskReconciliation?.saved ||
      s.blueprint?.blueprintTaskReconciliation?.saved,
  );
  report.blueprintFunctional.artifactIndex = Boolean(
    s.blueprint?.taskArtifactIndex?.saved,
  );

  // --- Project Memory preview (no write) ---
  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.projectMemory = {
    previewExists: (s.projectMemory?.preview?.files?.length ?? 0) > 0,
  };

  // --- Reports architecture regression ---
  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 800));
  const reportsText = await evaluate(`document.body.innerText`);
  const sectionOrder = await evaluate(`(() => {
    const ids = ${JSON.stringify(ARCH_SECTION_IDS)};
    const positions = ids.map((id) => {
      const el = document.querySelector('[data-focus-id="' + id + '"]');
      if (!el) return -1;
      const all = [...document.querySelectorAll('[data-focus-id]')];
      return all.indexOf(el);
    });
    const ordered =
      positions.every((p) => p >= 0) &&
      positions.every((p, i) => i === 0 || p > positions[i - 1]);
    return { positions, ordered };
  })()`);
  report.reportsUi = {
    architectureHealth: /Architecture Health/i.test(reportsText),
    refactorCards: /Architecture Refactor Task Cards/i.test(reportsText),
    refactorHandoff: /Architecture Refactor Builder Handoff/i.test(reportsText),
    refactorIntake: /Architecture Refactor Implementation Intake/i.test(reportsText),
    sectionOrder,
  };

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  s = await snap();
  report.reportsFunctional = {
    healthGenerated: Boolean(s.architectureHealth?.saved),
  };
  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.reportsFunctional.cardsGenerated = Boolean(
    s.architectureRefactorTaskCards?.saved?.cards?.length,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask("ARCH-1")`,
  );
  await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 1200));
  s = await snap();
  report.reportsFunctional.handoffGenerated = Boolean(
    s.architectureRefactorTaskBuilderHandoff?.saved,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeSelectedTask("ARCH-1")`,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(ARCH_INTAKE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const archSummary =
    s.architectureRefactorTaskImplementationIntake?.selectedReport?.summaryMarkdown ?? "";
  report.reportsFunctional.intakeSaved = /Architecture Refactor Implementation Intake Summary/i.test(
    archSummary,
  );
  await evaluate(
    `window.nttc.stageArchitectureRefactorTaskImplementationReportForReview()`,
  );
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  const archBuilder = s.builderResult?.saved;
  report.reportsFunctional.stageForReview = {
    staged: Boolean(archBuilder),
    taskId: archBuilder?.taskId === "ARCH-1",
    noAutoImplReview: !s.implementationReview?.saved,
  };

  report.boundaries = {
    srcFileCountSame:
      listProjectFiles(PROJECT).filter(
        (f) => !f.includes("/.nttc/") && !f.includes("\\.nttc\\"),
      ).length === srcBefore.length,
    noAdvisorDuringSmoke: advisorBefore === (await snap()).advisorResponse,
    noApplyPatch: report.shell.noApplyPatch,
    liveQwenDisabled: report.shell.liveQwenDisabled,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (!report.launch.usesAsar || report.launch.usesVite) fail("Not packaged asar launch");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.liveQwenDisabled) fail("Live Qwen not disabled");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.shell.blueprintTab) fail("Blueprint tab missing");
  if (!report.shell.reportsTab) fail("Reports tab missing");
  for (const [k, v] of Object.entries(report.blueprintUi)) {
    if (!v) fail(`Blueprint UI missing: ${k}`);
  }
  if (!report.blueprintFunctional.questionsGenerated) fail("Planner questions failed");
  if (!report.blueprintFunctional.promptGenerated) fail("Planner prompt failed");
  if (!report.blueprintFunctional.imported) fail("Blueprint import failed");
  if (!report.blueprintFunctional.completenessRan) fail("Completeness check failed");
  if (!report.blueprintFunctional.planningPreview?.hasFiles) {
    fail("Planning preview missing files");
  }
  if (!report.blueprintFunctional.planningPreview?.didNotWrite) {
    fail("Planning preview wrote files");
  }
  if (!report.blueprintFunctional.phase1Handoff) fail("Phase 1 Builder Handoff generate failed");
  if (!report.blueprintFunctional.phaseTaskCards) fail("Phase task cards generate failed");
  if (!report.blueprintFunctional.taskBuilderHandoff) fail("Task builder handoff failed");
  if (!report.blueprintFunctional.taskIntakeSaved) fail("Task implementation intake save failed");
  if (!report.blueprintFunctional.stageForReview?.staged) {
    fail("Task stage for review failed");
  }
  if (!report.blueprintFunctional.stageForReview?.noAutoImplReview) {
    fail("Implementation Review auto-ran from task intake");
  }
  if (!report.reportsUi.sectionOrder?.ordered) fail("Reports architecture section order wrong");
  if (!report.reportsFunctional.healthGenerated) fail("Architecture Health generate failed");
  if (!report.reportsFunctional.cardsGenerated) fail("Refactor cards generate failed");
  if (!report.reportsFunctional.handoffGenerated) fail("Refactor handoff generate failed");
  if (!report.reportsFunctional.intakeSaved) fail("Refactor intake save failed");
  if (!report.reportsFunctional.stageForReview?.taskId) {
    fail("Refactor staging missing ARCH-1 metadata");
  }
  if (!report.reportsFunctional.stageForReview?.noAutoImplReview) {
    fail("Implementation Review auto-ran from refactor intake");
  }
  if (!report.boundaries.srcFileCountSame) fail("Unexpected source file changes during smoke");
  if (!report.boundaries.noAdvisorDuringSmoke) fail("Unexpected AI advisor call");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
  console.log(JSON.stringify(report, null, 2));
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  process.exit(1);
}
