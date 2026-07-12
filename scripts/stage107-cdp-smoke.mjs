/**
 * Stage 107 packaged-app smoke (CDP) — Architecture Refactor Implementation Intake after Stage 106.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9245
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9245";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

const BUILDER_SOURCES = [
  "Cursor",
  "Codex",
  "Claude",
  "ChatGPT",
  "Grok",
  "Qwen",
  "Human programmer",
  "Other",
];

const SUMMARY_SECTIONS = [
  "## Refactor Task",
  "## Builder / Source",
  "## Report Status",
  "## Detected Files Changed",
  "## Validation Mentioned",
  "## Behavior Preservation Mentioned",
  "## Risks / Blockers",
  "## Safety Confirmations",
  "## Missing Report Sections",
  "## Recommended Next Step",
  "## Safety Reminder",
];

const COMPLETE_REPORT = `# Analysis
Narrow refactor only.

# Plan
Extract helper from App.tsx wiring.

# Files changed
- src/renderer/App.tsx

# Implementation summary
Moved layout helpers into a named component.

# Validation performed
npm run typecheck passed.

# Behavior preservation checks
Preserve existing behavior. No new features. No Apply Patch.

# Risks
Low risk.

# Safety confirmations
No source editing added by NTTC.

# Questions / blockers
None.
`;

const INCOMPLETE_REPORT = `# Analysis
Partial report only.
`;

const BEHAVIOR_CHANGE_REPORT = `# Analysis
Refactor done.

# Plan
Changed wiring.

# Files changed
- src/renderer/App.tsx

# Implementation summary
Updated handlers.

# Validation performed
Manual review.

# Behavior preservation checks
Note: behavior changed during refactor.

# Risks
Medium.

# Safety confirmations
None.

# Questions / blockers
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
  spawn(EXE, ["--remote-debugging-port=9245"], {
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
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  await clickTab(evaluate, "Reports");

  let reportsText = await evaluate(`document.body.innerText`);
  report.uiReports = {
    architectureHealthSection: /Architecture Health/i.test(reportsText),
    refactorSection: /Architecture Refactor Task Cards/i.test(reportsText),
    handoffSection: /Architecture Refactor Builder Handoff/i.test(reportsText),
    intakeSection: /Architecture Refactor Implementation Intake/i.test(reportsText),
    selectedTaskDropdown: /Selected refactor task/i.test(reportsText),
    builderSourceDropdown: /Builder \/ source/i.test(reportsText),
    saveButton: /Save Refactor Implementation Report/i.test(reportsText),
    copyButton: /Copy Refactor Implementation Report/i.test(reportsText),
    clearButton: /Clear Refactor Implementation Report/i.test(reportsText),
    markReturnedButton: /Mark Refactor Implementation Returned/i.test(reportsText),
    markReviewedButton: /Mark Refactor Reviewed/i.test(reportsText),
    stageForReviewButton: /Use this report for Implementation Review/i.test(reportsText),
  };

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  const advisorBefore = (await snap()).advisorResponse;

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask("ARCH-1")`,
  );
  await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 1200));

  const builderOptions = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('select')].flatMap((s) =>
      [...s.options].map((o) => o.value),
    );
    return ${JSON.stringify(BUILDER_SOURCES)}.every((src) => labels.includes(src));
  })()`);
  report.builderSources = { allPresent: builderOptions };

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeSelectedTask("ARCH-1")`,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  let s = await snap();
  const saved = s.architectureRefactorTaskImplementationIntake?.selectedReport;
  const summary = saved?.summaryMarkdown ?? "";
  report.saveComplete = {
    saved: Boolean(saved),
    title: summary.includes("# NTTC Architecture Refactor Implementation Intake Summary"),
    allSections: SUMMARY_SECTIONS.every((sec) => summary.includes(sec)),
    filesDetected: (saved?.detectedFilesChanged?.length ?? 0) > 0,
    validationMentions: (saved?.detectedValidationMentions?.length ?? 0) > 0,
    behaviorMentions: (saved?.detectedBehaviorPreservationMentions?.length ?? 0) > 0,
    risks: (saved?.detectedRisksBlockers?.length ?? 0) > 0,
    safety: (saved?.detectedSafetyConfirmations?.length ?? 0) > 0,
    noAdvisorCall: advisorBefore === s.advisorResponse,
  };

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(INCOMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.incompleteSave = {
    allowed: Boolean(s.architectureRefactorTaskImplementationIntake?.selectedReport),
    missingSections:
      (s.architectureRefactorTaskImplementationIntake?.selectedReport
        ?.missingExpectedSections?.length ?? 0) > 0,
  };

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText("API_KEY=sk-test\\nFiles changed: secret.ts")`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  const reportAfterSecret =
    s.architectureRefactorTaskImplementationIntake?.selectedReport?.reportText ?? "";
  report.secretBlock = {
    blockedWithoutOverride:
      reportAfterSecret.includes("Moved layout helpers") &&
      /Possible secret detected/i.test(
        s.architectureRefactorTaskImplementationIntake?.statusMessage ?? "",
      ),
  };

  await evaluate(`window.nttc.recordCopyArchitectureRefactorTaskImplementationReport()`);
  report.copyReport = {
    copied: Boolean(
      (await snap()).architectureRefactorTaskImplementationIntake?.selectedReport,
    ),
  };

  const savedAt =
    (await snap()).architectureRefactorTaskImplementationIntake?.selectedReport?.savedAt;
  const projectPath =
    (await snap()).safety?.project?.normalizedPath ?? PROJECT;
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(projectPath)})`);
  await new Promise((r) => setTimeout(r, 2500));
  s = await snap();
  const restoredReport =
    s.architectureRefactorTaskImplementationIntake?.reportsByTaskId?.["ARCH-1"];
  report.historyRestore = {
    reportRestored: Boolean(restoredReport),
    sameSavedAt: restoredReport?.savedAt === savedAt,
  };

  await evaluate(`window.nttc.markArchitectureRefactorTaskImplementationReturned()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.markReturned = {
    status:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
        ?.status === "implementation-returned",
    reportFlag:
      s.architectureRefactorTaskImplementationIntake?.selectedReport
        ?.markedImplementationReturned === true,
  };

  await evaluate(`window.nttc.markArchitectureRefactorTaskImplementationReviewed(false)`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.markReviewedNoImplReview = {
    stillNotReviewed:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
        ?.status !== "reviewed",
  };

  await evaluate(`window.nttc.markArchitectureRefactorTaskImplementationReviewed(true)`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.markReviewedConfirm = {
    reviewed:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
        ?.status === "reviewed",
    nextSuggestion: Boolean(
      s.architectureRefactorTaskImplementationIntake?.nextTaskSuggestion,
    ),
  };

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(BEHAVIOR_CHANGE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(`window.nttc.markArchitectureRefactorTaskImplementationReviewed(false)`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.behaviorChangeBlock = {
    warningFlag: Boolean(
      s.architectureRefactorTaskImplementationIntake?.selectedReport?.behaviorChangeWarning,
    ),
    notReviewed:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
        ?.status !== "reviewed",
  };

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(COMPLETE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(
    `window.nttc.stageArchitectureRefactorTaskImplementationReportForReview()`,
  );
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  const builder = s.builderResult?.saved;
  report.stageForReview = {
    staged: Boolean(builder),
    responseType: builder?.responseType === "Implementation report",
    artifactKind:
      builder?.taskArtifactKind === "Architecture Refactor Implementation Report",
    taskId: builder?.taskId === "ARCH-1",
    noAutoImplReview: !s.implementationReview?.saved,
    noAdvisorCall: advisorBefore === s.advisorResponse,
  };

  await evaluate(`window.nttc.scanChangedFiles()`);
  await new Promise((r) => setTimeout(r, 4000));
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(
      "# Files changed\\n- src/missing-from-scan.ts\\n# Validation performed\\ntypecheck\\n# Behavior preservation checks\\npreserve behavior\\nno new features\\nno apply patch",
    )})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.changedFilesCompare = {
    scopeWarnings:
      (s.architectureRefactorTaskImplementationIntake?.selectedReport
        ?.changedFilesScopeWarnings?.length ?? 0) > 0,
  };

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const contextFile = s.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_CONTEXT.md",
  );
  report.projectMemory = {
    implSummary: /Architecture refactor implementation reports exist:/i.test(
      contextFile?.content ?? "",
    ),
  };

  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir) ? [...fs.readdirSync(planningDir)] : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const implMd = preview?.files?.find(
    (f) => f.fileName === "ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS.md",
  );
  report.planningPreview = {
    hasImplMd: Boolean(implMd),
    noDiskWrite:
      JSON.stringify(fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : []) ===
      JSON.stringify(planningBefore),
  };

  await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
  await new Promise((r) => setTimeout(r, 800));
  const planningAfter = fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : [];
  report.planningExport = {
    onlyMd: planningAfter.every((f) => f.endsWith(".md")),
    hasImplExport: planningAfter.includes("ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS.md"),
  };

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 10000));
  s = await snap();
  report.staleOnHealth = {
    stale: Object.values(
      s.architectureRefactorTaskImplementationIntake?.reportsByTaskId ?? {},
    ).some((r) => r.stale),
    statusMentionsStale: /stale/i.test(
      s.architectureRefactorTaskImplementationIntake?.statusMessage ?? "",
    ),
  };

  reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    intakeStep: /Architecture Refactor Implementation Intake/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    handoffStillPresent: /Architecture Refactor Builder Handoff/i.test(reportsText),
  };

  await clickTab(evaluate, "Blueprint");
  const blueprintText = await evaluate(`document.body.innerText`);
  report.regressionBlueprint = {
    taskImplementationIntake: /Task Implementation Intake/i.test(blueprintText),
    taskBuilderHandoff: /Task Card Builder Handoff/i.test(blueprintText),
    phaseTaskCards: /Blueprint Phase Task Cards/i.test(blueprintText),
  };

  const srcAfter = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  report.boundaries = {
    srcFileCountSame: srcBefore.length === srcAfter.length,
    noAdvisorDuringIntake: report.saveComplete.noAdvisorCall,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.launch.usesAsar) fail("Not loading from app.asar");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.uiReports.intakeSection) fail("Implementation Intake section missing");
  if (!report.uiReports.saveButton) fail("Save Refactor Implementation Report missing");
  if (!report.builderSources.allPresent) fail("Builder/source options incomplete");
  if (!report.saveComplete.saved) fail("Complete report not saved");
  if (!report.saveComplete.title) fail("Summary title missing");
  if (!report.saveComplete.allSections) fail("Summary sections missing");
  if (!report.incompleteSave.allowed) fail("Incomplete report save blocked");
  if (!report.secretBlock.blockedWithoutOverride) fail("Secret not blocked");
  if (!report.markReturned.status) fail("Mark returned status not updated");
  if (!report.markReviewedNoImplReview.stillNotReviewed) fail("Reviewed without confirm");
  if (!report.stageForReview.staged) fail("Stage for review failed");
  if (!report.stageForReview.artifactKind) fail("Wrong artifact kind");
  if (!report.stageForReview.noAutoImplReview) fail("Implementation Review auto-ran");
  if (!report.historyRestore.reportRestored) fail("History restore failed");
  if (!report.staleOnHealth.stale && !report.staleOnHealth.statusMentionsStale) {
    fail("Report not stale on health regen");
  }
  if (!report.projectMemory.implSummary) fail("Project Memory missing impl summary");
  if (!report.planningPreview.hasImplMd) report.warnings.push("Planning preview missing ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS.md (blueprint may be missing)");
  if (!report.planningExport.hasImplExport) report.warnings.push("Planning export missing impl reports file");
  if (!report.planningPreview.noDiskWrite) fail("Planning preview wrote disk");
  if (!report.boundaries.srcFileCountSame) fail("Source files changed outside .nttc/planning");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
