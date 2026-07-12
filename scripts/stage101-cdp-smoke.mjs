/**
 * Stage 101 packaged-app smoke (CDP) — Architecture Health scanner accuracy after Stage 100.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9242
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9242";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

const REQUIRED_SECTIONS = [
  "## Summary",
  "## Largest Files",
  "## Monolith Risk",
  "## Small-Model Friendliness",
  "## High-Risk Coordination Files",
  "## Suggested Extraction Areas",
  "## Task-Card Alignment",
  "## Changed-Files Pressure",
  "## Recommended Refactor Task Cards",
  "## Recommendation",
  "## Safety Reminder",
];

const EXCLUDED_PREFIXES = [
  "dist-electron/",
  "dist/",
  "build/",
  "release/",
  "out/",
  ".next/",
  ".vite/",
  "coverage/",
  ".cache/",
  "node_modules/",
  ".git/",
  ".nttc/",
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

function pathsInMarkdown(md) {
  const paths = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(md))) {
    if (m[1].includes("/") || m[1].includes("\\")) paths.push(m[1].replace(/\\/g, "/"));
  }
  return paths;
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9242"], {
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
    noAudioTts: !/Text-to-Speech|TTS controls/i.test(headerText),
    noEditMode: !/Edit mode enabled|Enable edit mode/i.test(headerText),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));

  await clickTab(evaluate, "Reports");
  let reportsText = await evaluate(`document.body.innerText`);
  report.uiReports = {
    architectureHealthSection: /Architecture Health/i.test(reportsText),
    generateButton: /Generate Architecture Health Report/i.test(reportsText),
    copyButton: /Copy Architecture Health Report/i.test(reportsText),
    clearButton: /Clear Architecture Health Report/i.test(reportsText),
    changedFilesSection: /Changed Files \/ Patch Review/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply/i.test(reportsText),
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    blueprintTaskLink: /Blueprint Task Link/i.test(reportsText),
  };

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );

  await evaluate(`window.nttc.scanChangedFiles()`);
  await new Promise((r) => setTimeout(r, 3500));

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));

  let s = await snap();
  const ah = s.architectureHealth?.saved;
  const md = ah?.markdown ?? "";

  report.architectureHealth = {
    saved: Boolean(ah),
    largestIsApp:
      ah?.largestFilePath?.replace(/\\/g, "/") === "src/renderer/App.tsx",
    largestLineCount: ah?.largestFileLineCount ?? 0,
    criticalCount: ah?.criticalCount ?? 0,
    appInLargest: /## Largest Files[\s\S]*`src\/renderer\/App\.tsx`/i.test(md),
    appInMonolith: /## Monolith Risk[\s\S]*`src\/renderer\/App\.tsx`[\s\S]*Critical monolith risk/i.test(md),
    appRoleHint: /App\.tsx[\s\S]*Renderer root wiring|tab shell/i.test(md),
    mainInLargest: /## Largest Files[\s\S]*`src\/main\/index\.ts`/i.test(md),
    mainInMonolith: /## Monolith Risk[\s\S]*`src\/main\/index\.ts`[\s\S]*Critical monolith risk/i.test(md),
    noDistElectron: !/dist-electron\//i.test(md),
    noSourceBodies: !/function\s+\w+\s*\(|import\s+.*from\s+['"]|export\s+(default\s+)?function/.test(md),
    sections: Object.fromEntries(REQUIRED_SECTIONS.map((sec) => [sec, md.includes(sec)])),
  };

  const scannedPaths = pathsInMarkdown(md);
  report.exclusions = {
    noDistElectronPaths: scannedPaths.every((p) => !p.startsWith("dist-electron/")),
    noExcludedPrefixes: scannedPaths.every(
      (p) => !EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix)),
    ),
    excludedHits: scannedPaths.filter((p) =>
      EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix)),
    ),
  };

  report.changedFilesPressure = {
    packageConfigSeparate: /package manifest|package\/config context/i.test(md),
    viteConfigSeparate: /Vite config|package\/config context/i.test(md),
    appMonolithPressure: /App\.tsx[\s\S]*critical monolith risk|monolith risk/i.test(
      md.slice(md.indexOf("## Changed-Files Pressure")),
    ),
    noAutoFix: !/auto-fix|automatically fix/i.test(md),
  };

  const genAtBefore = ah?.generatedAt;
  await evaluate(`window.nttc.clearArchitectureHealthReport()`);
  s = await snap();
  report.historyClear = { cleared: !s.architectureHealth?.saved };

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  s = await snap();
  const genAtAfter = s.architectureHealth?.saved?.generatedAt;
  report.historyCopy = {
    regenerated: Boolean(genAtAfter && genAtAfter !== genAtBefore),
    hasMarkdown: Boolean(s.architectureHealth?.saved?.markdown?.length),
  };

  const restoreGenAt = s.architectureHealth?.saved?.generatedAt;
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.historyRestore = {
    restored: Boolean(s.architectureHealth?.saved),
    sameGeneratedAt: s.architectureHealth?.saved?.generatedAt === restoreGenAt,
    staleAfterRestore: Boolean(s.architectureHealth?.saved?.stale),
  };

  await evaluate(`window.nttc.summarizeProject()`);
  await new Promise((r) => setTimeout(r, 4000));
  s = await snap();
  report.staleOnSummary = {
    stale: Boolean(s.architectureHealth?.saved?.stale),
    staleLog: (s.actionLog ?? []).some((e) =>
      /Architecture health stale|architecture health stale/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  await evaluate(`window.nttc.scanChangedFiles()`);
  await new Promise((r) => setTimeout(r, 3500));
  s = await snap();
  report.staleOnChangedFiles = {
    stale: Boolean(s.architectureHealth?.saved?.stale),
  };

  await evaluate(`window.nttc.refreshCodeContextFileList()`);
  await new Promise((r) => setTimeout(r, 3000));
  s = await snap();
  const blocked = s.codeContext?.blockedSamples ?? [];
  const appBlocked = blocked.find((b) => /App\.tsx/i.test(b.relativePath ?? b.path ?? ""));
  report.codeContextSafety = {
    hasBlockedSamples: blocked.length > 0,
    appTsxBlocked: Boolean(appBlocked),
    appBlockReason: appBlocked?.reason ?? null,
    stillUsesSizeOrSecret:
      /Too large|SECRET|secret|262144|256/i.test(appBlocked?.reason ?? "") ||
      blocked.some((b) => /Too large|SECRET|secret|262144/i.test(b.reason ?? "")),
    scanArchNoSecretGate: !fs
      .readFileSync(
        path.join(REPO, "dist-electron/main/architecture/scanArchitectureHealthFiles.js"),
        "utf8",
      )
      .includes("hasSecretPattern"),
    codeContextStillHasSecretGate: fs
      .readFileSync(path.join(REPO, "dist-electron/main/codeContext/codeContextSafety.js"), "utf8")
      .includes("CODE_CONTEXT_SECRET_PATTERNS"),
  };

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const contextFile = s.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_CONTEXT.md",
  );
  report.projectMemory = {
    hasPreview: Boolean(s.projectMemory?.preview),
    architectureHealthInContext: /Architecture Health/i.test(contextFile?.content ?? ""),
    previewOnly: true,
  };

  const planningDir = path.join(PROJECT, ".nttc", "planning");
  const planningBefore = fs.existsSync(planningDir) ? [...fs.readdirSync(planningDir)] : [];
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const preview = s.blueprint?.planningDocsPreview;
  const archHealthFile = preview?.files?.find(
    (f) => f.fileName === "ARCHITECTURE_HEALTH.md",
  );
  report.planningPreview = {
    hasArchHealthMd: Boolean(archHealthFile),
    archHealthContent: /Architecture Health|monolith/i.test(archHealthFile?.content ?? ""),
    noDiskWrite:
      JSON.stringify(fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : []) ===
      JSON.stringify(planningBefore),
  };

  await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
  await new Promise((r) => setTimeout(r, 800));
  const planningAfter = fs.existsSync(planningDir) ? fs.readdirSync(planningDir) : [];
  report.planningExport = {
    onlyMd: planningAfter.every((f) => f.endsWith(".md")),
    hasArchHealthExport: planningAfter.includes("ARCHITECTURE_HEALTH.md"),
  };

  await clickTab(evaluate, "Blueprint");
  const blueprintText = await evaluate(`document.body.innerText`);
  report.regressionBlueprint = {
    phaseTaskCards: /Blueprint Phase Task Cards/i.test(blueprintText),
    taskArtifactIndex: /Task Artifact Index/i.test(blueprintText),
    taskReconciliation: /Blueprint Task Reconciliation/i.test(blueprintText),
    localPlanner: /Local Planner AI|Planner AI/i.test(blueprintText),
    blueprintImport: /Blueprint Import|Import Blueprint/i.test(blueprintText),
  };

  await clickTab(evaluate, "Guide");
  const guideText = await evaluate(`document.body.innerText`);
  report.regressionGuide = { guideTab: guideText.length > 200 };

  await clickTab(evaluate, "Reports");
  reportsText = await evaluate(`document.body.innerText`);
  report.regressionReports = {
    handoffReadiness: /Handoff Readiness/i.test(reportsText),
    dailyNextAction: /Daily Next Action|Next Action/i.test(reportsText),
    codeContext: /Code Context/i.test(reportsText),
    builderHandoff: /Builder Handoff/i.test(reportsText),
  };

  const srcAfter = listProjectFiles(PROJECT).filter(
    (f) => !f.includes(`${path.sep}.nttc${path.sep}`),
  );
  report.boundaries = {
    srcFileCountSame: srcBefore.length === srcAfter.length,
    planningOnlyMd: planningAfter.every((f) => f.endsWith(".md")),
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (report.launch.usesVite) fail("Uses Vite/dev mode");
  if (!report.launch.usesAsar) fail("Not loading from app.asar");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.liveQwenDisabled) fail("Live Qwen not disabled");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.uiReports.architectureHealthSection) fail("Architecture Health section missing");
  if (!report.uiReports.generateButton) fail("Generate Architecture Health Report button missing");
  if (!report.uiReports.copyButton) fail("Copy Architecture Health Report button missing");
  if (!report.uiReports.clearButton) fail("Clear Architecture Health Report button missing");
  if (!report.architectureHealth.saved) fail("Architecture Health report not saved");
  if (!report.architectureHealth.appInLargest) fail("App.tsx missing from Largest Files");
  if (!report.architectureHealth.appInMonolith) fail("App.tsx missing from Monolith Risk as Critical");
  if (!report.architectureHealth.mainInMonolith) fail("main/index.ts missing from Monolith Risk as Critical");
  if (!report.architectureHealth.noDistElectron) fail("dist-electron paths found in report");
  if (!report.exclusions.noExcludedPrefixes) fail("Excluded build folders appeared in report");
  if (!report.architectureHealth.noSourceBodies) fail("Source bodies detected in report");
  for (const sec of REQUIRED_SECTIONS) {
    if (!report.architectureHealth.sections[sec]) fail(`Missing report section: ${sec}`);
  }
  if (!report.historyClear.cleared) fail("Clear Architecture Health failed");
  if (!report.historyRestore.restored) fail("Architecture Health history restore failed");
  if (!report.staleOnSummary.stale) fail("Project summary rescan did not mark report stale");
  if (!report.staleOnChangedFiles.stale) fail("Changed-files scan did not mark report stale");
  if (!report.codeContextSafety.codeContextStillHasSecretGate) fail("Code Context secret gate weakened");
  if (!report.codeContextSafety.scanArchNoSecretGate) fail("Architecture scan still uses secret gate unexpectedly");
  if (!report.planningPreview.noDiskWrite) fail("Planning preview wrote disk");
  if (!report.planningExport.hasArchHealthExport) fail("ARCHITECTURE_HEALTH.md not exported");
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
