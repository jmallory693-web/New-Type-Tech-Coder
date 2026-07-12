/**
 * Stage 79 packaged-app smoke harness (CDP).
 * Stage 78 Quick Start Guide + Stage 76–77 regressions.
 *
 * Launch packaged app first:
 *   "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9239
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

const GUIDE_SECTIONS = [
  "What NTTC is",
  "What NTTC is not",
  "Recommended safe workflow",
  "First-time user path",
  "Ollama / local AI",
  "Outside AI workflow",
  "Safety warnings",
  "Understanding recommendations",
  "What files NTTC may write",
  "Troubleshooting",
];

const NOT_IS_BULLETS = [
  "not an IDE",
  "does not edit your source files",
  "does not apply patches",
  "does not run arbitrary terminal commands",
  "does not let AI browse your project invisibly",
  "does not enable Live Qwen",
  ".nttc/*.md",
];

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage78: {},
  regressions: {},
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

/** Action log prepends new entries (unshift); return only entries added since beforeLen. */
function newActionLogEntries(entries, beforeLen) {
  const list = entries ?? [];
  const added = list.length - beforeLen;
  return added > 0 ? list.slice(0, added) : [];
}

function readRendererHaystack() {
  let haystack = "";
  const root = path.join(REPO, "dist", "assets");
  if (!fs.existsSync(root)) return haystack;
  for (const name of fs.readdirSync(root)) {
    if (name.endsWith(".js")) haystack += fs.readFileSync(path.join(root, name), "utf8");
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
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  return { page, evaluate, ws };
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').trim() === ${JSON.stringify(label)} ||
      (el.textContent || '').includes(${JSON.stringify(label)}),
    );
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 700));
}

try {
  const renderer = readRendererHaystack();
  report.stage78.bundle = {
    guideTab: renderer.includes("Guide") && renderer.includes("quick-start-guide"),
    quickStartTitle: renderer.includes("NTTC Quick Start Guide"),
    newHere: renderer.includes("New here?"),
    reportsHint: renderer.includes("Open the Quick Start Guide"),
    copyGuide: renderer.includes("Copy Quick Start Guide"),
    workflowProgress: renderer.includes("Workflow Progress"),
    noApplyPatch: !renderer.includes("Apply Patch"),
  };
  for (const [key, ok] of Object.entries(report.stage78.bundle)) {
    if (key === "noApplyPatch") {
      if (!ok) fail("Apply Patch in renderer bundle");
      continue;
    }
    if (!ok) fail(`Bundle missing: ${key}`);
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const headerText = await evaluate(`document.body.innerText.slice(0, 3000)`);
  report.regressions.shell = {
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
    noEditMode: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || ''))`,
    )),
    noTts: !(await evaluate(
      `[...document.querySelectorAll('button,input')].some((el) => /\\bTTS\\b|Play audio/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')))`,
    )),
    noCustomCmd: !(await evaluate(
      `[...document.querySelectorAll('input,textarea')].some((el) => /custom command|type a command/i.test(el.getAttribute('placeholder') || ''))`,
    )),
  };

  const guideTabVisible = await evaluate(`(() => {
    return [...document.querySelectorAll('button,[role=tab]')].some((el) =>
      (el.textContent || '').trim() === 'Guide',
    );
  })()`);
  report.stage78.guideTabVisible = guideTabVisible;

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1000));

  await clickTab(evaluate, "Dashboard");
  const newHere = await evaluate(`(() => {
    const card = document.querySelector('.dashboard-new-here');
    return {
      found: !!card,
      openBtn: !!card?.querySelector('.btn-label')?.textContent?.includes('Open Quick Start Guide'),
      copyBtn: !!card?.querySelector('.btn-label')?.textContent?.includes('Copy Quick Start Guide'),
    };
  })()`);
  report.stage78.dashboardNewHere = newHere;

  const logBeforeOpen = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
  await clickTab(evaluate, "Guide");
  const onGuideTabDirect = await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').trim() === 'Guide',
    );
    return tab?.classList.contains('active') || tab?.getAttribute('aria-current') === 'page';
  })()`);
  const afterOpen = await evaluate(`window.nttc.getSnapshot()`);
  const openedLogged = newActionLogEntries(afterOpen.actionLog, logBeforeOpen).some(
    (e) => e.message === "Quick Start Guide opened",
  );
  report.stage78.openGuide = { onGuideTab: onGuideTabDirect, openedLogged };

  const guideText = await evaluate(`(() => {
    const el = document.querySelector('[data-focus-id="quick-start-guide"]');
    return el ? el.innerText : '';
  })()`);
  const sections = GUIDE_SECTIONS.map((s) => ({
    title: s,
    found: guideText.includes(s),
  }));
  const notIs = NOT_IS_BULLETS.map((b) => ({
    phrase: b,
    found: guideText.includes(b) || guideText.toLowerCase().includes(b.toLowerCase()),
  }));
  report.stage78.sections = sections;
  report.stage78.notIsBullets = notIs;

  const logBeforeCopy = afterOpen.actionLog.length;
  await evaluate(`(() => {
    const label = [...document.querySelectorAll('.quick-start-guide-actions .btn-label')].find(
      (el) => (el.textContent || '').trim() === 'Copy Quick Start Guide',
    );
    label?.closest('button')?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  const afterCopy = await evaluate(`window.nttc.getSnapshot()`);
  const copyLogSlice = newActionLogEntries(afterCopy.actionLog, logBeforeCopy);
  const copiedLogged = copyLogSlice.some(
    (e) => e.message === "Quick Start Guide copied",
  );
  const bodyNotLogged = !copyLogSlice.some((e) =>
    /safe AI coding supervisor|Recommended safe workflow/i.test(e.message),
  );
  report.stage78.copyGuide = { copiedLogged, bodyNotLogged };

  await clickTab(evaluate, "Reports");
  const reportsHint = await evaluate(`(() => {
    const hint = document.querySelector('.workflow-guide-hint');
    const link = hint?.querySelector('button');
    if (!link) return { found: false };
    link.click();
    return { found: true, text: hint.textContent || '' };
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  const hintOpensGuide = await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').trim() === 'Guide',
    );
    return tab?.classList.contains('active') || tab?.getAttribute('aria-current') === 'page';
  })()`);
  report.stage78.reportsHint = { ...reportsHint, hintOpensGuide };

  await clickTab(evaluate, "Dashboard");
  const dashboardOpenClick = await evaluate(`(() => {
    const label = [...document.querySelectorAll('.dashboard-new-here .btn-label')].find((el) =>
      (el.textContent || '').includes('Open Quick Start Guide'),
    );
    if (!label) return { clicked: false };
    label.closest('button')?.click();
    return { clicked: true };
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  const dashboardOpensGuide = await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').trim() === 'Guide',
    );
    return tab?.classList.contains('active') || tab?.getAttribute('aria-current') === 'page';
  })()`);
  report.stage78.dashboardOpenButton = {
    ...dashboardOpenClick,
    opensGuide: dashboardOpensGuide,
  };

  const nttcPlan = path.join(PROJECT, ".nttc", "NTTC_PLAN.md");
  const planMtimeBefore = fs.existsSync(nttcPlan) ? fs.statSync(nttcPlan).mtimeMs : null;
  await clickTab(evaluate, "Guide");
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').trim() === 'Copy Quick Start Guide',
    );
    if (btn) btn.click();
  })()`);
  const planMtimeAfter = fs.existsSync(nttcPlan) ? fs.statSync(nttcPlan).mtimeMs : null;
  report.stage78.noProjectWrites = planMtimeBefore === planMtimeAfter;

  const pkgMtimeBefore = fs.existsSync(path.join(PROJECT, "package.json"))
    ? fs.statSync(path.join(PROJECT, "package.json")).mtimeMs
    : null;
  await new Promise((r) => setTimeout(r, 300));
  const pkgMtimeAfter = fs.existsSync(path.join(PROJECT, "package.json"))
    ? fs.statSync(path.join(PROJECT, "package.json")).mtimeMs
    : null;
  report.stage78.noSourceEdits = pkgMtimeBefore === pkgMtimeAfter;

  const aiLogBefore = (afterCopy.actionLog ?? []).length;
  await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const afterHandoff = await evaluate(`window.nttc.getSnapshot()`);
  report.stage78.guideNoAi = !(afterHandoff.actionLog ?? [])
    .slice(aiLogBefore)
    .some((e) => /Ollama|Local AI response started/i.test(e.message));

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Dashboard");
  const dashText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Settings");
  const settingsText = await evaluate(`document.body.innerText`);

  report.regressions.panels = {
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    handoffReadiness: /Handoff Readiness/i.test(reportsText),
    recommendedNext: /Recommended Next Step/i.test(dashText),
    expectedResult: /Expected Result/i.test(dashText),
    builderHandoff: /Builder Handoff Export/i.test(reportsText),
    comparison: /External Patch Draft Comparison/i.test(reportsText),
    manualImport: /Manual Patch Draft Import/i.test(reportsText),
    safetyReview: /Patch Draft Safety Review/i.test(reportsText),
    patchDraft: /Patch Draft Mode — No Apply/i.test(reportsText),
    codeContext: /Code Context Pack — Preview Only/i.test(reportsText),
    askCodeAi: /Ask Local AI About Selected Code/i.test(reportsText),
    codeTemplates: /Code Question Template/i.test(reportsText),
    projectMemory: /Project Memory \/ Handoff Files/i.test(reportsText),
    builderPlan: /Builder Plan Mode — Plan Only/i.test(aiText),
    builderPlanComparison: /Builder Plan Comparison/i.test(reportsText),
    implementationReview: /Implementation Review/i.test(reportsText),
    roleModelMapping: /Role Model Mapping/i.test(settingsText),
    speakerScripts: /Speaker Scripts/i.test(aiText),
    planningStyle: /Planning Style/i.test(settingsText),
  };

  ws.close();

  if (report.usesVite) fail("Packaged app uses Vite/dev URL");
  if (!guideTabVisible) fail("Guide tab not visible");
  if (!newHere.found) fail("Dashboard New here? card missing");
  if (!onGuideTabDirect) fail("Guide tab did not activate");
  if (!openedLogged) fail("Quick Start Guide opened not logged");
  if (!copiedLogged) fail("Quick Start Guide copied not logged");
  if (!dashboardOpensGuide) fail("Dashboard Open Quick Start Guide button failed");
  if (!bodyNotLogged) fail("Guide body appears in action log");
  if (!reportsHint.found || !hintOpensGuide) fail("Reports hint failed");
  for (const s of sections) {
    if (!s.found) fail(`Guide section missing: ${s.title}`);
  }
  for (const b of notIs) {
    if (!b.found) fail(`What NTTC is not missing: ${b.phrase}`);
  }
  if (!report.stage78.noProjectWrites) fail("Guide caused project file writes");
  if (!report.stage78.noSourceEdits) fail("Guide caused source edits");
  if (!report.stage78.guideNoAi) fail("Guide workflow triggered AI");
  for (const [key, ok] of Object.entries(report.regressions.shell)) {
    if (!ok) fail(`Shell regression: ${key}`);
  }
  for (const [key, ok] of Object.entries(report.regressions.panels)) {
    if (!ok) fail(`Panel regression: ${key}`);
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
