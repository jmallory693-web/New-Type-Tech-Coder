/**
 * Stage 111 packaged-app smoke — reportsArchitectureSectionProps after Stage 110.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9247
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9247";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

const ARCH_SECTION_IDS = [
  "architecture-health",
  "architecture-refactor-task-cards",
  "architecture-refactor-task-builder-handoff",
  "architecture-refactor-task-implementation-intake",
];

const INTAKE_REPORT = `# Analysis
Stage 110 props-builder smoke.

# Plan
Verify buildReportsArchitectureSectionProps wiring.

# Files changed
- src/renderer/components/reportsArchitectureSectionProps.ts

# Implementation summary
Moved architecture prop assembly out of App.tsx.

# Validation performed
npm run typecheck passed.

# Behavior preservation checks
Preserve existing behavior. No new features. No Apply Patch.

# Risks
Low.

# Safety confirmations
No source editing added by NTTC.

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
  const snap = () => evaluate("window.nttc.getSnapshot()");
  return { page, evaluate, snap, ws };
}

function listProjectFiles(root) {
  const out = [];
  const skip = new Set(["node_modules", "release", "dist", ".git"]);
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

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  const distJs = fs
    .readdirSync(path.join(REPO, "dist", "assets"))
    .find((f) => f.endsWith(".js"));
  const bundleText = fs.readFileSync(
    path.join(REPO, "dist", "assets", distJs),
    "utf8",
  );
  report.bundleIncludesPropsBuilder =
    bundleText.includes("buildReportsArchitectureSectionProps") ||
    (bundleText.includes("Architecture Health") &&
      bundleText.includes("Architecture Refactor Implementation Intake"));
  if (!report.bundleIncludesPropsBuilder) fail("Bundle missing Stage 110 architecture wiring");

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9247"], {
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
  await new Promise((r) => setTimeout(r, 800));

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
    return { positions, ordered, ids };
  })()`);
  report.sectionOrder = sectionOrder;

  const reportsText = await evaluate(`document.body.innerText`);
  report.uiReports = {
    architectureHealthSection: /Architecture Health/i.test(reportsText),
    refactorSection: /Architecture Refactor Task Cards/i.test(reportsText),
    handoffSection: /Architecture Refactor Builder Handoff/i.test(reportsText),
    intakeSection: /Architecture Refactor Implementation Intake/i.test(reportsText),
    generateHealth: /Generate Architecture Health Report/i.test(reportsText),
    generateCards: /Generate Refactor Task Cards/i.test(reportsText),
    generateHandoff: /Generate Refactor Builder Handoff/i.test(reportsText),
    saveIntake: /Save Refactor Implementation Report/i.test(reportsText),
    copyIntake: /Copy Refactor Implementation Report/i.test(reportsText),
    clearIntake: /Clear Refactor Implementation Report/i.test(reportsText),
    stageForReview: /Use this report for Implementation Review/i.test(reportsText),
    markReturned: /Mark Refactor Implementation Returned/i.test(reportsText),
  };

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  const advisorBefore = (await snap()).advisorResponse;

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  let s = await snap();
  const healthMd = s.architectureHealth?.saved?.markdown ?? "";
  report.stage110Regression = {
    healthGenerated: Boolean(s.architectureHealth?.saved),
    appTsxMonolithRisk:
      /App\.tsx/i.test(healthMd) &&
      (/critical|monolith|warning|largest|line/i.test(healthMd)),
    mainIndexMonolithRisk:
      /main[/\\]index\.ts|src[/\\]main[/\\]index\.ts/i.test(healthMd),
  };

  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.stage110Regression.cardsGenerated = Boolean(
    s.architectureRefactorTaskCards?.saved?.cards?.length,
  );

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask("ARCH-1")`,
  );
  await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 1200));
  s = await snap();
  report.stage110Regression.handoffGenerated = Boolean(
    s.architectureRefactorTaskBuilderHandoff?.saved,
  );

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeSelectedTask("ARCH-1")`,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(INTAKE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const summary =
    s.architectureRefactorTaskImplementationIntake?.selectedReport?.summaryMarkdown ?? "";
  const reportsByTaskId =
    s.architectureRefactorTaskImplementationIntake?.reportsByTaskId ?? {};
  const arch1Report = reportsByTaskId["ARCH-1"];
  report.stage110Regression.intakeSaved = summary.includes(
    "# NTTC Architecture Refactor Implementation Intake Summary",
  );
  report.stage110Regression.reportStatusMapWorks = Boolean(arch1Report?.savedAt);

  await evaluate(`window.nttc.markArchitectureRefactorTaskImplementationReturned()`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.stage110Regression.markReturned = {
    cardStatus:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
        ?.status === "implementation-returned",
    reportFlag:
      s.architectureRefactorTaskImplementationIntake?.selectedReport
        ?.markedImplementationReturned === true,
  };

  await evaluate(
    `window.nttc.stageArchitectureRefactorTaskImplementationReportForReview()`,
  );
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  const builder = s.builderResult?.saved;
  report.stage110Regression.stageForReview = {
    staged: Boolean(builder),
    responseType: builder?.responseType === "Implementation report",
    artifactKind:
      builder?.taskArtifactKind === "Architecture Refactor Implementation Report",
    taskId: builder?.taskId === "ARCH-1",
    noAutoImplReview: !s.implementationReview?.saved,
    noAdvisorCall: advisorBefore === s.advisorResponse,
  };

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const contextFile = s.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_CONTEXT.md",
  );
  report.stage110Regression.projectMemoryMentionsRefactor =
    /Architecture refactor implementation reports exist:/i.test(
      contextFile?.content ?? "",
    );

  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const implMd = s.blueprint?.planningDocsPreview?.files?.find(
    (f) => f.fileName === "ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORTS.md",
  );
  report.stage110Regression.planningPreviewHasImplMd = Boolean(implMd);

  report.regressionBlueprint = {
    taskImplementationIntake: /Task Implementation Intake/i.test(
      await evaluate(`document.body.innerText`),
    ),
    taskBuilderHandoff: /Task Builder Handoff/i.test(await evaluate(`document.body.innerText`)),
    phaseTaskCards: /Phase Task Cards/i.test(await evaluate(`document.body.innerText`)),
  };

  report.boundaries = {
    srcFileCountSame: listProjectFiles(PROJECT).filter(
      (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
    ).length === srcBefore.length,
    noAdvisorDuringSmoke: advisorBefore === (await snap()).advisorResponse,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (!report.launch.usesAsar || report.launch.usesVite) fail("Not packaged asar launch");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.liveQwenDisabled) fail("Live Qwen not disabled");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.sectionOrder?.ordered) fail("Architecture section order wrong");
  for (const [k, v] of Object.entries(report.uiReports)) {
    if (!v) fail(`UI missing: ${k}`);
  }
  if (!report.stage110Regression.healthGenerated) fail("Architecture Health generate failed");
  if (!report.stage110Regression.cardsGenerated) fail("Refactor task cards generate failed");
  if (!report.stage110Regression.handoffGenerated) fail("Builder handoff generate failed");
  if (!report.stage110Regression.intakeSaved) fail("Implementation intake save failed");
  if (!report.stage110Regression.reportStatusMapWorks) fail("Report status map failed");
  if (!report.stage110Regression.markReturned?.cardStatus) fail("Mark returned status failed");
  if (!report.stage110Regression.stageForReview?.staged) fail("Stage for review failed");
  if (!report.stage110Regression.stageForReview?.noAutoImplReview) {
    fail("Implementation Review auto-ran");
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
