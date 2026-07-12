/**
 * Stage 77 packaged-app smoke harness (CDP).
 * Stage 76 Workflow Guidance + regressions.
 *
 * Launch packaged app first:
 *   "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9239
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE_CANDIDATES = [
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable",
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable",
];
const PROJECT =
  DISPOSABLE_CANDIDATES.find((p) => fs.existsSync(p)) ?? REPO;

const WORKFLOW_LABELS = [
  "Project opened",
  "Safety Backup",
  "Code Context Pack",
  "Local AI Review",
  "Patch Draft",
  "Manual Patch Import",
  "Patch Draft Safety Review",
  "External Patch Comparison",
  "Builder Handoff",
  "Project Memory Export",
];

const STATUS_LABELS = [
  "Completed",
  "Current",
  "Recommended Next",
  "Blocked",
  "Pending",
];

const NAV_BUTTONS = [
  "Go to Code Context",
  "Go to Patch Draft",
  "Go to Safety Review",
  "Go to Builder Handoff",
  "Go to Project Memory",
];

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage76: {},
  collapse: {},
  actionLog: {},
  regressions: {},
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function readRendererHaystack() {
  let haystack = "";
  const root = path.join(REPO, "dist", "assets");
  if (!fs.existsSync(root)) return haystack;
  for (const name of fs.readdirSync(root)) {
    if (name.endsWith(".js")) {
      haystack += fs.readFileSync(path.join(root, name), "utf8");
    }
  }
  return haystack;
}

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("No CDP page target");
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
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  };
  return { page, evaluate, ws };
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').includes(${JSON.stringify(label)}),
    );
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 700));
}

try {
  const renderer = readRendererHaystack();
  report.stage76.bundleStrings = {
    workflowProgress: renderer.includes("Workflow Progress"),
    workflowHealth: renderer.includes("Workflow Health"),
    handoffReadiness: renderer.includes("Handoff Readiness"),
    blockedWhy: renderer.includes("Blocked — why?"),
    recommendedNextStep: renderer.includes("Recommended Next Step"),
    expectedResult: renderer.includes("Expected Result"),
    reportsWorkflowSection: renderer.includes("reports-workflow-section"),
    noApplyPatch: !renderer.includes("Apply Patch"),
  };
  for (const [key, ok] of Object.entries(report.stage76.bundleStrings)) {
    if (key === "noApplyPatch") {
      if (!ok) fail("Apply Patch string found in renderer bundle");
      continue;
    }
    if (!ok) fail(`Bundle string missing: ${key}`);
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const headerText = await evaluate(`document.body.innerText.slice(0, 5000)`);
  report.regressions.shell = {
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatchButton: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
    noEditMode: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || ''))`,
    )),
    noTts: !(await evaluate(
      `[...document.querySelectorAll('button,input')].some((el) => /\\bTTS\\b|Play audio|Speak aloud/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')))`,
    )),
    noCustomCmd: !(await evaluate(
      `[...document.querySelectorAll('input,textarea')].some((el) => /custom command|type a command/i.test(el.getAttribute('placeholder') || ''))`,
    )),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);

  const workflowCard = await evaluate(`(() => {
    const card = document.querySelector('[data-focus-id="workflow-guidance"]');
    const text = card ? card.innerText : '';
    const labels = ${JSON.stringify(WORKFLOW_LABELS)}.map((l) => ({
      label: l,
      found: text.includes(l),
    }));
    const statuses = ${JSON.stringify(STATUS_LABELS)}.filter((s) => text.includes(s));
    const navButtons = ${JSON.stringify(NAV_BUTTONS)}.map((b) => ({
      label: b,
      found: [...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === b),
    }));
    const health = /Workflow Health/i.test(text) && /(Green|Yellow|Red)/i.test(text);
    const handoff = /Handoff Readiness/i.test(text) &&
      /(Not Ready|Planning Only|Review Ready|Implementation Ready)/i.test(text);
    const blockedCard = document.body.innerText.includes('Blocked — why?');
    return {
      cardPresent: !!card,
      labels,
      statusesFound: statuses,
      navButtons,
      health,
      handoff,
      blockedCardVisible: blockedCard,
      position: card ? [...document.body.querySelectorAll('*')].indexOf(card) : -1,
      summarizePos: (() => {
        const summarize = [...document.querySelectorAll('button')].find((b) =>
          (b.textContent || '').includes('Summarize Project'),
        );
        return summarize ? [...document.body.querySelectorAll('*')].indexOf(summarize.closest('.panel-body') || summarize) : -1;
      })(),
    };
  })()`);

  report.stage76.workflowCard = workflowCard;
  report.stage76.workflowAtTop =
    workflowCard.cardPresent && workflowCard.position > 0;

  for (const item of workflowCard.labels) {
    if (!item.found) fail(`Workflow label missing: ${item.label}`);
  }
  if (workflowCard.statusesFound.length < 2) {
    fail(`Expected multiple status labels, got: ${workflowCard.statusesFound.join(", ")}`);
  }
  for (const btn of workflowCard.navButtons) {
    if (!btn.found) fail(`Nav button missing: ${btn.label}`);
  }
  if (!workflowCard.health) fail("Workflow Health section missing");
  if (!workflowCard.handoff) fail("Handoff Readiness section missing");

  const navJump = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((el) =>
      (el.textContent || '').trim() === 'Go to Code Context',
    );
    if (!btn) return { clicked: false };
    btn.click();
    return { clicked: true };
  })()`);
  await new Promise((r) => setTimeout(r, 1200));
  const codeContextVisible = await evaluate(`(() => {
    const el = document.querySelector('[data-focus-id="code-context-pack"]');
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.width > 0;
  })()`);
  report.stage76.navJumpCodeContext = { clicked: navJump.clicked, visible: codeContextVisible };

  const collapseIpc = await evaluate(
    `window.nttc.setReportsPanelCollapsed('code-context-pack', true)`,
  );
  report.collapse.setCollapsed =
    collapseIpc.reportsUi?.panelCollapse?.["code-context-pack"] === true;

  const sectionCollapsed = await evaluate(`(() => {
    const section = document.querySelector('[data-panel-id="code-context-pack"]');
    return section ? !section.open : null;
  })()`);
  report.collapse.uiCollapsed = sectionCollapsed === true;

  await evaluate(`window.nttc.setReportsPanelCollapsed('code-context-pack', false)`);
  const expanded = await evaluate(`(() => {
    const section = document.querySelector('[data-panel-id="code-context-pack"]');
    return section ? section.open : null;
  })()`);
  report.collapse.manualExpand = expanded === true;

  const collapsibleCount = await evaluate(
    `document.querySelectorAll('.reports-workflow-section').length`,
  );
  report.collapse.collapsiblePanelCount = collapsibleCount;

  await clickTab(evaluate, "Dashboard");
  const dashboard = await evaluate(`(() => {
    const card = document.querySelector('.dashboard-next');
    const text = card ? card.innerText : '';
    return {
      hasRecommendedLabel: /Recommended\\b/i.test(text),
      hasReason: /Reason/i.test(text),
      hasExpected: /Expected Result/i.test(text),
      title: document.querySelector('.dashboard-next-title')?.textContent || '',
      expected: document.querySelector('.dashboard-next-expected')?.textContent || '',
    };
  })()`);
  report.stage76.dashboard = dashboard;

  await clickTab(evaluate, "Settings");
  await evaluate(`window.nttc.logUiAction('info', 'Builder Prompt copied', 'smoke')`);
  await evaluate(`window.nttc.logUiAction('info', 'Builder Prompt copied', 'smoke')`);
  await evaluate(`window.nttc.logUiAction('info', 'Builder Prompt copied', 'smoke')`);
  const logGrouped = await evaluate(`(() => {
    const items = [...document.querySelectorAll('.log-message')];
    return items.some((el) => /Builder Prompt copied \\(3\\)/.test(el.textContent || ''));
  })()`);
  report.actionLog.grouped = logGrouped;

  await clickTab(evaluate, "Reports");
  const regressionsText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Settings");
  const settingsText = await evaluate(`document.body.innerText`);

  report.regressions.panels = {
    builderHandoff: /Builder Handoff Export/i.test(regressionsText),
    comparison: /External Patch Draft Comparison/i.test(regressionsText),
    manualImport: /Manual Patch Draft Import/i.test(regressionsText),
    safetyReview: /Patch Draft Safety Review/i.test(regressionsText),
    patchDraft: /Patch Draft Mode — No Apply/i.test(regressionsText),
    codeContext: /Code Context Pack — Preview Only/i.test(regressionsText),
    askCodeAi: /Ask Local AI About Selected Code/i.test(regressionsText),
    codeTemplates: /Code Question Template/i.test(regressionsText),
    projectMemory: /Project Memory \/ Handoff Files/i.test(regressionsText),
    builderPlan: /Builder Plan Mode — Plan Only/i.test(aiText),
    builderPlanComparison: /Builder Plan Comparison/i.test(regressionsText),
    implementationReview: /Implementation Review/i.test(regressionsText),
    roleModelMapping: /Role Model Mapping/i.test(settingsText),
    speakerScripts: /Speaker Scripts/i.test(aiText),
    planningStyle: /Planning Style/i.test(settingsText),
  };

  const memorySnap = await evaluate(`window.nttc.getSnapshot()`);
  const nttcPlan = path.join(PROJECT, ".nttc", "NTTC_PLAN.md");
  const planMtimeBefore = fs.existsSync(nttcPlan)
    ? fs.statSync(nttcPlan).mtimeMs
    : null;
  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  const afterPreview = fs.existsSync(nttcPlan)
    ? fs.statSync(nttcPlan).mtimeMs
    : null;
  report.stage76.memoryNoAutoWrite = planMtimeBefore === afterPreview;

  const aiLogBefore = (memorySnap.actionLog ?? []).length;
  await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const afterHandoff = await evaluate(`window.nttc.getSnapshot()`);
  const handoffAiLog = (afterHandoff.actionLog ?? [])
    .slice(aiLogBefore)
    .some((e) => /Ollama|Local AI response started/i.test(e.message));
  report.stage76.guidanceNoAi = !handoffAiLog;

  ws.close();

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!workflowCard.cardPresent) fail("Workflow Progress card missing");
  if (!dashboard.hasRecommendedLabel) fail("Dashboard Recommended label missing");
  if (!dashboard.hasExpected) fail("Dashboard Expected Result missing");
  if (!navJump.clicked || !codeContextVisible) fail("Go to Code Context navigation failed");
  if (!report.collapse.setCollapsed) fail("Collapse IPC did not persist");
  if (collapsibleCount < 6) fail(`Expected collapsible panels, got ${collapsibleCount}`);
  if (!logGrouped) fail("Action Log grouping not shown");
  if (!report.stage76.memoryNoAutoWrite) fail("Project Memory preview auto-wrote files");
  if (!report.stage76.guidanceNoAi) fail("Workflow guidance triggered AI");

  for (const [key, ok] of Object.entries(report.regressions.shell)) {
    if (!ok) fail(`Shell regression failed: ${key}`);
  }
  for (const [key, ok] of Object.entries(report.regressions.panels)) {
    if (!ok) fail(`Panel regression failed: ${key}`);
  }

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
