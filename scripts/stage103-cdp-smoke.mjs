/**
 * Stage 103 packaged-app smoke (CDP) — Architecture Refactor Task Cards after Stage 102.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9243
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9243";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

const CARD_SECTIONS = [
  "## Task ID",
  "## Task Title",
  "## Refactor Target",
  "## Goal",
  "## Why This Matters",
  "## Current Risk",
  "## Files Likely Involved",
  "## What To Change",
  "## What Not To Change",
  "## Safety Boundaries",
  "## Small-Model Friendly Architecture",
  "## Builder Prompt",
  "## Validation Steps",
  "## Report Back Format",
  "## Status",
];

const BUILDER_SAFETY_PHRASES = [
  "Preserve behavior",
  "Do not add new features",
  "Do not change safety boundaries",
  "Do not add Apply Patch",
  "Do not enable Live Qwen",
  "Do not add terminal/custom command features",
  "Report changed files, validation, risks, and safety confirmations",
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
  spawn(EXE, ["--remote-debugging-port=9243"], {
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
    generateRefactorButton: /Generate Refactor Task Cards/i.test(reportsText),
    copyAllRefactorButton: /Copy All Refactor Task Cards/i.test(reportsText),
    clearRefactorButton: /Clear Refactor Task Cards/i.test(reportsText),
    perCardCopy: /Copy This Refactor Task/i.test(reportsText),
    markPlanned: /Mark Planned/i.test(reportsText),
    markSent: /Mark Sent to Builder/i.test(reportsText),
    markReturned: /Mark Implementation Returned/i.test(reportsText),
    markReviewed: /Mark Reviewed/i.test(reportsText),
    resetStatus: /Reset Status/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
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
    hasRefactorSuggestions: (health?.refactorSuggestions?.length ?? 0) > 0,
  };

  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  const cards = s.architectureRefactorTaskCards?.saved;
  const cardList = cards?.cards ?? [];
  report.refactorCards = {
    saved: Boolean(cards),
    count: cards?.taskCount ?? 0,
    countOk: (cards?.taskCount ?? 0) >= 3 && (cards?.taskCount ?? 0) <= 8,
    ids: cardList.map((c) => c.id),
    hasArch1: cardList.some((c) => c.id === "ARCH-1"),
    hasArch2: cardList.some((c) => c.id === "ARCH-2"),
    hasArch3: cardList.some((c) => c.id === "ARCH-3"),
    allSections: cardList.every((c) =>
      CARD_SECTIONS.every((sec) => c.markdown.includes(sec)),
    ),
    planningOnlyTitle: cardList.every((c) =>
      c.markdown.includes("# NTTC Architecture Refactor Task Card"),
    ),
    noGiantRewrite: !cardList.some((c) =>
      /rewrite the entire|complete overhaul|everything at once|redesign the app/i.test(
        c.markdown,
      ),
    ),
    noBehaviorChange: !cardList.some((c) =>
      /change behavior|add new feature|enable edit mode/i.test(c.goal + c.whatToChange),
    ),
    builderSafety: cardList.every((c) =>
      BUILDER_SAFETY_PHRASES.every((p) => c.builderPrompt.includes(p)),
    ),
    noSourceBodies: !/function\s+\w+\s*\(|import\s+.*from\s+['"]/.test(
      cards?.allCardsMarkdown ?? "",
    ),
    noAdvisorCall: advisorBefore === s.advisorResponse,
  };

  const firstId = cardList[0]?.id ?? "ARCH-1";
  await evaluate(`window.nttc.setArchitectureRefactorTaskCardStatus(${JSON.stringify(firstId)}, "planned")`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.statusPlanned = {
    status:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === firstId)
        ?.status === "planned",
  };

  await evaluate(`window.nttc.setArchitectureRefactorTaskCardStatus(${JSON.stringify(firstId)}, "sent-to-builder")`);
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskCardStatus(${JSON.stringify(firstId)}, "implementation-returned")`,
  );
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.setArchitectureRefactorTaskCardStatus(${JSON.stringify(firstId)}, "reviewed")`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.statusLifecycle = {
    reviewed:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === firstId)
        ?.status === "reviewed",
  };

  await evaluate(`window.nttc.resetArchitectureRefactorTaskCardStatus(${JSON.stringify(firstId)})`);
  await new Promise((r) => setTimeout(r, 400));
  s = await snap();
  report.statusReset = {
    drafted:
      s.architectureRefactorTaskCards?.saved?.cards.find((c) => c.id === firstId)
        ?.status === "drafted",
  };

  const copyMarkdown = await evaluate(`(() => {
    const rec = window.nttc.getSnapshot().architectureRefactorTaskCards?.saved;
    return rec?.cards?.[0]?.markdown ?? null;
  })()`);
  report.copySingle = { hasMarkdown: Boolean(copyMarkdown?.includes("## Task ID")) };

  await evaluate(`window.nttc.clearArchitectureRefactorTaskCards()`);
  s = await snap();
  report.clearCards = { cleared: !s.architectureRefactorTaskCards?.saved };

  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  const restoreCards = s.architectureRefactorTaskCards?.saved;
  const restoreGenAt = restoreCards?.generatedAt;

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.historyRestore = {
    restored: Boolean(s.architectureRefactorTaskCards?.saved),
    sameGeneratedAt:
      s.architectureRefactorTaskCards?.saved?.generatedAt === restoreGenAt,
    reviewedCount: s.architectureRefactorTaskCards?.saved?.cards.filter(
      (c) => c.status === "reviewed",
    ).length,
  };

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  s = await snap();
  report.staleOnHealthRegen = {
    stale: Boolean(s.architectureRefactorTaskCards?.saved?.stale),
  };

  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const contextFile = s.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_CONTEXT.md",
  );
  report.projectMemory = {
    refactorSummary: /Architecture refactor task cards exist/i.test(
      contextFile?.content ?? "",
    ),
  };

  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir) ? [...fs.readdirSync(planningDir)] : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const refactorMd = preview?.files?.find(
    (f) => f.fileName === "ARCHITECTURE_REFACTOR_TASKS.md",
  );
  report.planningPreview = {
    hasRefactorMd: Boolean(refactorMd),
    refactorContent: /Architecture Refactor Task Card|ARCH-/i.test(
      refactorMd?.content ?? "",
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
    hasRefactorExport: planningAfter.includes("ARCHITECTURE_REFACTOR_TASKS.md"),
  };

  reportsText = await evaluate(`document.body.innerText`);
  report.workflow = {
    refactorStep: /Architecture Refactor Task Cards/i.test(reportsText),
    dailyNextMention: /Refactor|ARCH-/i.test(reportsText),
    blueprintTaskLink: /Blueprint Task Link/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
  };

  await clickTab(evaluate, "Blueprint");
  const blueprintText = await evaluate(`document.body.innerText`);
  report.regressionBlueprint = {
    phaseTaskCards: /Blueprint Phase Task Cards/i.test(blueprintText),
    taskArtifactIndex: /Task Artifact Index/i.test(blueprintText),
    localPlanner: /Local Planner AI|Planner AI/i.test(blueprintText),
  };

  const srcAfter = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  report.boundaries = {
    srcFileCountSame: srcBefore.length === srcAfter.length,
    noAdvisorDuringRefactor: report.refactorCards.noAdvisorCall,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.launch.usesAsar) fail("Not loading from app.asar");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.uiReports.refactorSection) fail("Architecture Refactor Task Cards section missing");
  if (!report.uiReports.generateRefactorButton) fail("Generate Refactor Task Cards button missing");
  if (!report.architectureHealth.appCritical) fail("App.tsx not critical in health report");
  if (!report.architectureHealth.mainCritical) fail("main/index.ts not critical in health report");
  if (!report.refactorCards.saved) fail("Refactor task cards not saved");
  if (!report.refactorCards.countOk) fail("Card count not 3-8");
  if (!report.refactorCards.hasArch1) fail("ARCH-1 missing");
  if (!report.refactorCards.hasArch2) fail("ARCH-2 missing");
  if (!report.refactorCards.hasArch3) fail("ARCH-3 missing");
  if (!report.refactorCards.allSections) fail("Missing required card sections");
  if (!report.refactorCards.noGiantRewrite) fail("Giant rewrite language found");
  if (!report.refactorCards.builderSafety) fail("Builder safety phrases missing");
  if (!report.statusPlanned.status) fail("Mark Planned failed");
  if (!report.statusLifecycle.reviewed) fail("Status lifecycle failed");
  if (!report.clearCards.cleared) fail("Clear refactor cards failed");
  if (!report.historyRestore.restored) fail("History restore failed");
  if (!report.staleOnHealthRegen.stale) fail("Stale on health regen failed");
  if (!report.projectMemory.refactorSummary) fail("Project Memory missing refactor summary");
  if (!report.planningPreview.noDiskWrite) fail("Planning preview wrote disk");
  if (!report.planningExport.hasRefactorExport) fail("ARCHITECTURE_REFACTOR_TASKS.md not exported");
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
