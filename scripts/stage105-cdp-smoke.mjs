/**
 * Stage 105 packaged-app smoke (CDP) — Architecture Refactor Builder Handoff after Stage 104.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9244
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9244";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

const HANDOFF_SECTIONS = [
  "## Builder Target",
  "## Selected Refactor Task",
  "## Refactor Goal",
  "## Current Architecture Risk",
  "## What To Change",
  "## What Not To Change",
  "## Files Likely Involved",
  "## Behavior Preservation Requirements",
  "## Safety Boundaries",
  "## Small-Model Friendly Architecture",
  "## Builder Instructions",
  "## Validation Required",
  "## Report Back Format",
  "## After Builder Returns",
  "## Recommendation",
  "## Safety Reminder",
];

const BEHAVIOR_PRESERVATION = [
  "Preserve existing behavior",
  "Do not add new features",
  "Do not remove safety checks",
  "Do not weaken confirmations",
  "Do not change Live Qwen disabled behavior",
  "Do not add Apply Patch",
  "Do not add terminal/custom command features",
  "Do not change source-reading rules",
  "Do not change secret-detection rules",
  "Keep the refactor small and reversible",
];

const APP_TSX_NOTE =
  "Do not keep adding logic to App.tsx. Move focused rendering/handler clusters into named components or helpers. Keep App.tsx as wiring/shell where practical.";

const MAIN_INDEX_NOTE =
  "Do not keep adding logic to main/index.ts. Move focused IPC registration or manager wiring into named helper modules where practical. Keep main/index.ts as orchestration where practical.";

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
  spawn(EXE, ["--remote-debugging-port=9244"], {
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
    selectedTaskDropdown: /Selected refactor task/i.test(reportsText),
    targetDropdown: /Handoff target/i.test(reportsText),
    strictnessDropdown: /Strictness/i.test(reportsText),
    generateHandoffButton: /Generate Refactor Builder Handoff/i.test(reportsText),
    copyHandoffButton: /Copy Refactor Builder Handoff/i.test(reportsText),
    clearHandoffButton: /Clear Refactor Builder Handoff/i.test(reportsText),
  };

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  const advisorBefore = (await snap()).advisorResponse;

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  let s = await snap();
  const health = s.architectureHealth?.saved;
  report.architectureHealth = {
    saved: Boolean(health),
    appCritical: /App\.tsx[\s\S]*Critical monolith risk/i.test(health?.markdown ?? ""),
    mainCritical: /main\/index\.ts[\s\S]*Critical monolith risk/i.test(
      health?.markdown ?? "",
    ),
  };

  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  const cards = s.architectureRefactorTaskCards?.saved;
  const cardList = cards?.cards ?? [];
  const arch1 = cardList.find((c) => c.id === "ARCH-1");
  report.refactorCards = {
    saved: Boolean(cards),
    hasArch1: Boolean(arch1),
  };

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask("ARCH-1")`,
  );
  await new Promise((r) => setTimeout(r, 400));

  const statusBeforeHandoff =
    s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
      ?.status ?? null;

  await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 1200));
  s = await snap();
  const handoff = s.architectureRefactorTaskBuilderHandoff?.saved;
  const md = handoff?.markdown ?? "";
  report.handoffGenerate = {
    saved: Boolean(handoff),
    title: md.includes("# NTTC Architecture Refactor Builder Handoff"),
    allSections: HANDOFF_SECTIONS.every((sec) => md.includes(sec)),
    behaviorPreservation: BEHAVIOR_PRESERVATION.every((p) => md.includes(p)),
    appTsxWording: md.includes(APP_TSX_NOTE),
    readiness: Boolean(handoff?.readiness),
    recommendation: Boolean(handoff?.recommendation),
    noAutoSent:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
        ?.status === statusBeforeHandoff,
    noSourceBodies: !/function\s+\w+\s*\(|import\s+.*from\s+['"]/.test(md),
    noAdvisorCall: advisorBefore === s.advisorResponse,
  };

  const mainCard = cardList.find((c) => /main\/index\.ts/i.test(c.refactorTarget));
  if (mainCard) {
    await evaluate(
      `window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask(${JSON.stringify(mainCard.id)})`,
    );
    await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
    await new Promise((r) => setTimeout(r, 1200));
    s = await snap();
    const mainMd = s.architectureRefactorTaskBuilderHandoff?.saved?.markdown ?? "";
    report.mainIndexWording = { present: mainMd.includes(MAIN_INDEX_NOTE) };
  } else {
    report.mainIndexWording = { present: false, skipped: true };
    report.warnings.push("No main/index.ts refactor card generated");
  }

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask("ARCH-1")`,
  );
  for (const target of ["cursor", "claude", "human-programmer"]) {
    await evaluate(
      `window.nttc.setArchitectureRefactorTaskBuilderHandoffTarget(${JSON.stringify(target)})`,
    );
    await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
    await new Promise((r) => setTimeout(r, 800));
    s = await snap();
    const targetMd = s.architectureRefactorTaskBuilderHandoff?.saved?.markdown ?? "";
    report[`target_${target}`] = {
      mentionsTarget: new RegExp(target.replace("-", "[ -]?"), "i").test(targetMd),
      hasSafety: /Do not add Apply Patch/i.test(targetMd),
    };
  }

  for (const strictness of ["conservative", "normal", "fast-small-patch"]) {
    await evaluate(
      `window.nttc.setArchitectureRefactorTaskBuilderHandoffStrictness(${JSON.stringify(strictness)})`,
    );
    await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
    await new Promise((r) => setTimeout(r, 800));
    s = await snap();
    const strictMd = s.architectureRefactorTaskBuilderHandoff?.saved?.markdown ?? "";
    report[`strictness_${strictness}`] = {
      mentionsStrictness: strictMd.includes(strictness),
      hasSafetyBoundaries: /## Safety Boundaries/i.test(strictMd),
    };
  }

  report.copyHandoff = { hasMarkdown: Boolean(handoff?.markdown?.includes("## Builder Target")) };

  await evaluate(`window.nttc.clearArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.clearHandoff = { cleared: !s.architectureRefactorTaskBuilderHandoff?.saved };

  await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 1200));
  const handoffGenAt = (await snap()).architectureRefactorTaskBuilderHandoff?.saved
    ?.generatedAt;

  const dailyBefore = (await snap()).decision?.lastRecommendedNextAction?.title ?? "";

  await evaluate(
    `window.nttc.setArchitectureRefactorTaskCardStatus("ARCH-1", "sent-to-builder")`,
  );
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  const dailyAfterSent = s.decision?.lastRecommendedNextAction?.title ?? "";
  report.dailyNextSent = {
    markedSent:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === "ARCH-1")
        ?.status === "sent-to-builder",
    dailyChanged: dailyBefore !== dailyAfterSent,
    dailyAfterSent,
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.historyRestore = {
    handoffRestored: Boolean(s.architectureRefactorTaskBuilderHandoff?.saved),
    sameGeneratedAt:
      s.architectureRefactorTaskBuilderHandoff?.saved?.generatedAt === handoffGenAt,
  };

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  s = await snap();
  report.staleOnHealthRegen = {
    handoffStale: Boolean(s.architectureRefactorTaskBuilderHandoff?.saved?.stale),
  };

  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 1200));
  s = await snap();

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const contextFile = s.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_CONTEXT.md",
  );
  report.projectMemory = {
    handoffSummary: /Architecture refactor handoff exists for ARCH-/i.test(
      contextFile?.content ?? "",
    ),
  };

  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir) ? [...fs.readdirSync(planningDir)] : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const handoffMd = preview?.files?.find(
    (f) => f.fileName === "ARCHITECTURE_REFACTOR_HANDOFF.md",
  );
  report.planningPreview = {
    hasHandoffMd: Boolean(handoffMd),
    handoffContent: /Architecture Refactor Builder Handoff|ARCH-1/i.test(
      handoffMd?.content ?? "",
    ),
    noDiskWrite:
      JSON.stringify(fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : []) ===
      JSON.stringify(planningBefore),
  };

  await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
  await new Promise((r) => setTimeout(r, 800));
  const planningAfter = fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : [];
  report.planningExport = {
    onlyMd: planningAfter.every((f) => f.endsWith(".md")),
    hasHandoffExport: planningAfter.includes("ARCHITECTURE_REFACTOR_HANDOFF.md"),
  };

  reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    handoffStep: /Architecture Refactor Builder Handoff/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    refactorCardsStillPresent: /Architecture Refactor Task Cards/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
  };

  await clickTab(evaluate, "Blueprint");
  const blueprintText = await evaluate(`document.body.innerText`);
  report.regressionBlueprint = {
    phaseTaskCards: /Blueprint Phase Task Cards/i.test(blueprintText),
    taskBuilderHandoff: /Task Card Builder Handoff/i.test(blueprintText),
    taskArtifactIndex: /Task Artifact Index/i.test(blueprintText),
  };

  const srcAfter = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  report.boundaries = {
    srcFileCountSame: srcBefore.length === srcAfter.length,
    noAdvisorDuringHandoff: report.handoffGenerate.noAdvisorCall,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.launch.usesAsar) fail("Not loading from app.asar");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.uiReports.handoffSection) fail("Architecture Refactor Builder Handoff section missing");
  if (!report.uiReports.generateHandoffButton) fail("Generate Refactor Builder Handoff button missing");
  if (!report.architectureHealth.appCritical) fail("App.tsx not critical");
  if (!report.architectureHealth.mainCritical) fail("main/index.ts not critical");
  if (!report.refactorCards.hasArch1) fail("ARCH-1 missing");
  if (!report.handoffGenerate.saved) fail("Handoff not saved");
  if (!report.handoffGenerate.title) fail("Handoff title missing");
  if (!report.handoffGenerate.allSections) fail("Handoff sections missing");
  if (!report.handoffGenerate.behaviorPreservation) fail("Behavior preservation missing");
  if (!report.handoffGenerate.appTsxWording) fail("App.tsx wording missing");
  if (!report.handoffGenerate.noAutoSent) fail("Handoff auto-marked card Sent to Builder");
  if (!report.clearHandoff.cleared) fail("Clear handoff failed");
  if (!report.historyRestore.handoffRestored) fail("Handoff history restore failed");
  if (!report.staleOnHealthRegen.handoffStale) fail("Handoff not stale on health regen");
  if (!report.projectMemory.handoffSummary) fail("Project Memory missing handoff summary");
  if (!report.planningPreview.noDiskWrite) fail("Planning preview wrote disk");
  if (!report.planningExport.hasHandoffExport) fail("ARCHITECTURE_REFACTOR_HANDOFF.md not exported");
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
