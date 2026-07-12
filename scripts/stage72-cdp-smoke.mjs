/**
 * Stage 72 packaged-app smoke harness (CDP).
 * Stage 71 External Patch Draft Comparison + Stage 67–71 regressions.
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
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const EMPTY_PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage72-Empty";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

if (!fs.existsSync(EMPTY_PROJECT)) {
  fs.mkdirSync(EMPTY_PROJECT, { recursive: true });
}

const REPORT_TITLE = "# NTTC External Patch Draft Comparison";
const SECTIONS = [
  "## Summary",
  "## Inputs Compared",
  "## Agreement",
  "## Conflicts / Differences",
  "## Proposed Files / Areas",
  "## Safety Flags",
  "## Missing Safeguards",
  "## Small-Model Friendly Architecture Check",
  "## Recommendation",
  "## Suggested Next Builder Prompt",
  "## Safety Reminder",
];

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage71: {},
  regressions: {},
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function readJsHaystack(rootDir) {
  let haystack = "";
  if (!fs.existsSync(rootDir)) return haystack;
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.name.endsWith(".js")) {
        haystack += fs.readFileSync(fullPath, "utf8");
      }
    }
  }
  return haystack;
}

function scanBundleStrings() {
  const renderer = readJsHaystack(path.join(REPO, "dist", "assets"));
  const main = readJsHaystack(path.join(REPO, "dist-electron"));
  const haystack = `${renderer}\n${main}`;
  return {
    comparisonSection: haystack.includes("External Patch Draft Comparison"),
    comparisonGenerate: haystack.includes(
      "Generate External Patch Draft Comparison",
    ),
    comparisonIpc: haystack.includes(
      "nttc:generate-external-patch-draft-comparison",
    ),
    noApplyPatchButton: !haystack.includes("Apply Patch"),
    manualImportSection: haystack.includes("Manual Patch Draft Import"),
    patchDraftSection: haystack.includes("Patch Draft Mode — No Apply"),
    safetyReviewSection: haystack.includes("Patch Draft Safety Review"),
    planningStyleControl: haystack.includes("Planning Style"),
    codeContextSection: haystack.includes("Code Context Pack — Preview Only"),
    askCodeAiSection: haystack.includes("Ask Local AI About Selected Code"),
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
    builderPlanSection: haystack.includes("Builder Plan Mode — Plan Only"),
    builderPlanComparison: haystack.includes("Builder Plan Comparison"),
    roleModelMapping: haystack.includes("Role Model Mapping"),
    speakerScripts: haystack.includes("Speaker Scripts"),
  };
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

function fileStatSafe(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { exists: true, mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return { exists: false, mtimeMs: null, size: null };
  }
}

function hasAllSections(md) {
  return SECTIONS.every((s) => md.includes(s));
}

function isHighOrBlocked(risk) {
  return /^(High|Blocked)/i.test(risk || "");
}

try {
  const bundle = scanBundleStrings();
  report.stage71.bundleStrings = bundle;
  for (const [key, ok] of Object.entries(bundle)) {
    if (key === "noApplyPatchButton") {
      if (!ok) fail("Apply Patch button string found in bundle");
      continue;
    }
    if (!ok) fail(`Bundle string missing: ${key}`);
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const headerText = await evaluate(`document.body.innerText`);
  report.stage71.inspectOnly = /Inspect-only/i.test(headerText);
  report.stage71.liveQwenDisabled = /Live Qwen disabled/i.test(headerText);
  report.stage71.ollamaBubble = /Ollama:/i.test(headerText);

  const beforePkg = fileStatSafe(path.join(PROJECT, "package.json"));
  const nttcBefore = fileStatSafe(path.join(PROJECT, ".nttc", "NTTC_PLAN.md"));

  // Clean empty project for no-draft / imported-only checks
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(EMPTY_PROJECT)})`);
  await evaluate(`window.nttc.setUserRequest("Stage 72 smoke test request")`);
  await evaluate(`window.nttc.setPlanningStyle('small-model-friendly')`);
  await evaluate(`window.nttc.clearImportedPatchDraft()`);
  await evaluate(`window.nttc.clearExternalPatchDraftComparison()`);

  await clickTab(evaluate, "Reports");

  const panelOrder = await evaluate(`(() => {
    const safety = document.querySelector('[data-focus-id="patch-draft-safety-review"]')
      || [...document.querySelectorAll('.field-label')].find((el) =>
        (el.textContent || '').includes('Patch Draft Safety Review'),
      )?.closest('.stack,div');
    const comparison = document.querySelector('[data-focus-id="external-patch-draft-comparison"]');
    const changed = document.querySelector('[data-focus-id="changed-files"]');
    if (!comparison) return { ok: false, reason: 'comparison panel missing' };
    const pos = (el) => {
      if (!el) return -1;
      const all = [...document.body.querySelectorAll('*')];
      return all.indexOf(el);
    };
    return {
      ok: pos(safety) < pos(comparison) && pos(comparison) < pos(changed),
      safetyPos: pos(safety),
      comparisonPos: pos(comparison),
      changedPos: pos(changed),
    };
  })()`);
  report.stage71.panelOrder = panelOrder;

  const reportsNoDraft = await evaluate(`document.body.innerText`);
  report.stage71.noDraftUi = {
    message: /Generate or import at least one patch draft before comparing/i.test(
      reportsNoDraft,
    ),
    controls: [
      "Generate External Patch Draft Comparison",
      "Copy Comparison Report",
      "Clear Comparison Report",
    ].every((label) => reportsNoDraft.includes(label)),
    metadata: [
      /NTTC Patch Draft exists:/i,
      /Imported Patch Draft exists:/i,
      /Patch Draft Safety Review exists:/i,
      /Safety Backup verified:/i,
    ].every((re) => re.test(reportsNoDraft)),
    planningStyle: /Planning style: Small-model friendly/i.test(reportsNoDraft),
  };

  const noDraftGen = await evaluate(
    `window.nttc.generateExternalPatchDraftComparison()`,
  );
  report.stage71.noDraftGenerate = {
    blocked: !noDraftGen.externalPatchDraftComparison?.saved,
    status: noDraftGen.externalPatchDraftComparison?.statusMessage || "",
    logged: (noDraftGen.actionLog ?? []).some((e) =>
      /missing drafts|at least one patch draft/i.test(e.message),
    ),
  };

  // Imported-only partial comparison on empty project
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(EMPTY_PROJECT)})`);
  await evaluate(`window.nttc.clearImportedPatchDraft()`);
  await evaluate(`window.nttc.clearExternalPatchDraftComparison()`);
  await evaluate(`window.nttc.setImportedPatchDraftSource('Cursor')`);
  await evaluate(`window.nttc.setImportedPatchDraftType('Patch draft')`);
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Proposed: add src/shared/feature.ts module. Include typecheck and npm run build. Safety backup before changes. No apply — plan only.")`,
  );
  const logBeforeImported = (await evaluate(`window.nttc.getSnapshot()`))
    .actionLog.length;
  await evaluate(`window.nttc.saveImportedPatchDraft()`);
  const importedOnlyGen = await evaluate(
    `window.nttc.generateExternalPatchDraftComparison()`,
  );
  const importedMd =
    importedOnlyGen.externalPatchDraftComparison?.saved?.markdownReport || "";
  report.stage71.importedOnly = {
    partial: Boolean(
      importedOnlyGen.externalPatchDraftComparison?.saved?.partialComparison,
    ),
    risk:
      importedOnlyGen.externalPatchDraftComparison?.saved?.riskLevel ?? null,
    hasTitle: importedMd.includes(REPORT_TITLE),
    hasSections: hasAllSections(importedMd),
    noAiLog: !(importedOnlyGen.actionLog ?? [])
      .slice(logBeforeImported)
      .some((e) => /Ollama|Local AI response|request started/i.test(e.message)),
    logged: (importedOnlyGen.actionLog ?? []).some((e) =>
      /External patch draft comparison generated/i.test(e.message),
    ),
  };

  // History-rich scenarios on disposable project
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await evaluate(`window.nttc.clearExternalPatchDraftComparison()`);

  // Risky imported draft → High or Blocked
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Enable edit mode and add command runner with arbitrary terminal access so AI can run commands. Custom command typing for npm scripts.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  const riskySnap = await evaluate(
    `window.nttc.generateExternalPatchDraftComparison()`,
  );
  const riskyRisk =
    riskySnap.externalPatchDraftComparison?.saved?.riskLevel ?? "";
  report.stage71.riskyImported = {
    risk: riskyRisk,
    highOrBlocked: isHighOrBlocked(riskyRisk),
    hasSafetyFlags: /## Safety Flags/i.test(
      riskySnap.externalPatchDraftComparison?.saved?.markdownReport || "",
    ),
  };

  // Broad App.tsx / main/index.ts → small-model friendly warning
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Rewrite everything in App.tsx and main/index.ts as one giant file. Dump all logic there.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  const broadSnap = await evaluate(
    `window.nttc.generateExternalPatchDraftComparison()`,
  );
  const broadMd =
    broadSnap.externalPatchDraftComparison?.saved?.markdownReport || "";
  report.stage71.broadCentral = {
    smallModelSection: /## Small-Model Friendly Architecture Check/i.test(broadMd),
    giantFileRisk: /giant-file risk|Broad App\.tsx/i.test(broadMd),
  };

  // Safeguards draft — typecheck/build/rollback reduce missing safeguard warnings
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Focused module in src/shared/foo.ts. Run typecheck, npm run build, manual smoke test. Rollback plan and safety backup. No apply.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  const safeSnap = await evaluate(
    `window.nttc.generateExternalPatchDraftComparison()`,
  );
  const safeMd =
    safeSnap.externalPatchDraftComparison?.saved?.markdownReport || "";
  const missingSection =
    safeMd.split("## Missing Safeguards")[1]?.split("##")[0] || "";
  report.stage71.safeguardsDraft = {
    mentionsTypecheck: /typecheck/i.test(safeMd),
    missingCount: (missingSection.match(/^- /gm) || []).length,
  };

  // Both drafts if NTTC patch draft already exists in restored history
  let bothDraftsTested = false;
  const snapForNttc = await evaluate(`window.nttc.getSnapshot()`);
  if (snapForNttc.patchDraft?.saved) {
    const bothSnap = await evaluate(
      `window.nttc.generateExternalPatchDraftComparison()`,
    );
    const bothMd =
      bothSnap.externalPatchDraftComparison?.saved?.markdownReport || "";
    report.stage71.bothDrafts = {
      tested: true,
      partial: Boolean(
        bothSnap.externalPatchDraftComparison?.saved?.partialComparison,
      ),
      hasConflicts: /## Conflicts/i.test(bothMd),
      hasAgreement: /## Agreement/i.test(bothMd),
    };
    bothDraftsTested = true;
  } else {
    report.stage71.bothDrafts = {
      tested: false,
      note: "No restored NTTC Patch Draft — skipped full two-draft comparison",
    };
  }

  // NTTC-only if patch draft exists and we clear imported
  let nttcOnlyTested = false;
  if (snapForNttc.patchDraft?.saved) {
    await evaluate(`window.nttc.clearImportedPatchDraft()`);
    const nttcOnlySnap = await evaluate(
      `window.nttc.generateExternalPatchDraftComparison()`,
    );
    report.stage71.nttcOnly = {
      tested: true,
      partial: Boolean(
        nttcOnlySnap.externalPatchDraftComparison?.saved?.partialComparison,
      ),
      saved: Boolean(nttcOnlySnap.externalPatchDraftComparison?.saved),
    };
    nttcOnlyTested = true;
    // restore imported for downstream checks
    await evaluate(
      `window.nttc.setImportedPatchDraftDraft("Focused module in src/shared/foo.ts. Run typecheck, npm run build. No apply.")`,
    );
    await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
    await evaluate(`window.nttc.generateExternalPatchDraftComparison()`);
  } else {
    report.stage71.nttcOnly = {
      tested: false,
      note: "No NTTC Patch Draft available without Ollama — skipped",
    };
  }

  const comparisonSnap = await evaluate(`window.nttc.getSnapshot()`);
  const comparisonMd =
    comparisonSnap.externalPatchDraftComparison?.saved?.markdownReport || "";

  // Copy + clear
  const copySnap = await evaluate(
    `window.nttc.recordCopyExternalPatchDraftComparison()`,
  );
  report.stage71.copy = {
    logged: (copySnap.actionLog ?? []).some((e) =>
      /comparison copied/i.test(e.message),
    ),
    stillSaved: Boolean(copySnap.externalPatchDraftComparison?.saved),
  };
  const clearSnap = await evaluate(
    `window.nttc.clearExternalPatchDraftComparison()`,
  );
  report.stage71.clear = {
    cleared: !clearSnap.externalPatchDraftComparison?.saved,
    logged: (clearSnap.actionLog ?? []).some((e) =>
      /comparison cleared/i.test(e.message),
    ),
  };

  // Regenerate for report integration checks
  const regenSnap = await evaluate(
    `window.nttc.generateExternalPatchDraftComparison()`,
  );
  const regenMd =
    regenSnap.externalPatchDraftComparison?.saved?.markdownReport || "";

  const decisionSnap = await evaluate(`window.nttc.generateDecisionReport()`);
  const builderSnap = await evaluate(`window.nttc.generateBuilderPrompt()`);
  const reviewSnap = await evaluate(`window.nttc.generateReviewPack()`);
  const memorySnap = await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  const nttcAfter = fileStatSafe(path.join(PROJECT, ".nttc", "NTTC_PLAN.md"));
  const contextPreview = memorySnap.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_CONTEXT.md",
  );

  report.stage71.integrations = {
    decisionHasComparison: /External Patch Draft Comparison exists:/i.test(
      decisionSnap.decision?.decisionReport?.markdownReport || "",
    ),
    builderHasComparison: /External Patch Draft Comparison/i.test(
      builderSnap.decision?.builderPrompt?.markdownReport || "",
    ),
    reviewHasComparison: /## External Patch Draft Comparison/i.test(
      reviewSnap.reviewPack?.markdownReport || "",
    ),
    memoryHasComparison: /External Patch Draft Comparison/i.test(
      contextPreview?.content || "",
    ),
    memoryNoAutoWrite: nttcBefore.mtimeMs === nttcAfter.mtimeMs,
  };

  // Daily Next Action — both drafts, no comparison
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await evaluate(`window.nttc.summarizeProject()`);
  await evaluate(`window.nttc.clearExternalPatchDraftComparison()`);
  await clickTab(evaluate, "Dashboard");
  const dashboardBothNoComparison = await evaluate(`(() => {
    const title = document.querySelector('.dashboard-next-title')?.textContent || '';
    const reason = document.querySelector('.dashboard-next-reason')?.textContent || '';
    const hints = [...document.querySelectorAll('.dashboard-freshness li')]
      .map((li) => li.textContent || '')
      .join(' | ');
    return { title, reason, hints, text: document.body.innerText };
  })()`);
  report.stage71.dailyBothNoComparison = {
    recommendsComparison:
      /Compare NTTC vs imported patch drafts|Both patch drafts exist/i.test(
        `${dashboardBothNoComparison.title} ${dashboardBothNoComparison.reason}`,
      ),
    hasBothDraftFreshness:
      /Patch Draft:/i.test(dashboardBothNoComparison.hints) &&
      /Imported Patch Draft:/i.test(dashboardBothNoComparison.hints),
    dashboardTitle: dashboardBothNoComparison.title,
    dashboardReason: dashboardBothNoComparison.reason,
    freshnessHints: dashboardBothNoComparison.hints,
    practical:
      /Compare NTTC vs imported patch drafts|Both patch drafts exist/i.test(
        `${dashboardBothNoComparison.title} ${dashboardBothNoComparison.reason}`,
      ),
    note: "Dashboard may show a higher-priority action before comparison when backup/checks/reports are pending.",
  };

  // Daily Next Action — high risk comparison recommends narrowing
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Enable edit mode, command runner, arbitrary terminal. Rewrite App.tsx.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  await evaluate(`window.nttc.generateExternalPatchDraftComparison()`);
  await clickTab(evaluate, "Dashboard");
  const dashboardHighRisk = await evaluate(`(() => {
    const title = document.querySelector('.dashboard-next-title')?.textContent || '';
    const reason = document.querySelector('.dashboard-next-reason')?.textContent || '';
    const hints = [...document.querySelectorAll('.dashboard-freshness li')]
      .map((li) => li.textContent || '')
      .join(' | ');
    return { title, reason, hints };
  })()`);
  report.stage71.dailyHighRisk = {
    recommendsNarrowing:
      /Narrow plan before builder work|Narrow the plan before builder work/i.test(
        `${dashboardHighRisk.title} ${dashboardHighRisk.reason}`,
      ),
    comparisonFreshness: /External Patch Draft Comparison:.*Blocked/i.test(
      dashboardHighRisk.hints,
    ),
    dashboardTitle: dashboardHighRisk.title,
    dashboardReason: dashboardHighRisk.reason,
    freshnessHints: dashboardHighRisk.hints,
    practical:
      /Narrow plan before builder work|Narrow the plan before builder work/i.test(
        `${dashboardHighRisk.title} ${dashboardHighRisk.reason}`,
      ) || /External Patch Draft Comparison:.*Blocked/i.test(dashboardHighRisk.hints),
    note: "High-risk narrowing may be deferred when higher-priority safety actions are pending.",
  };

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Settings");
  const settingsText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Request / Output");
  const requestOutputText = await evaluate(`document.body.innerText`);

  const afterPkg = fileStatSafe(path.join(PROJECT, "package.json"));
  const safetySnap = await evaluate(`window.nttc.getSnapshot()`);
  const safetyUi = await evaluate(`(() => ({
    noEditButton: ![...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || '')),
    noTtsControl: ![...document.querySelectorAll('button,input')].some((el) =>
      /\\bTTS\\b|Play audio|Speak aloud/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
    ),
    noCustomCmd: ![...document.querySelectorAll('input,textarea')].some((el) =>
      /custom command|type a command/i.test(el.getAttribute('placeholder') || ''),
    ),
  }))()`);

  report.regressions = {
    manualImport: /Manual Patch Draft Import/i.test(reportsText),
    patchDraft: /Patch Draft Mode — No Apply/i.test(reportsText),
    safetyReview: /Patch Draft Safety Review/i.test(reportsText),
    comparisonPanel: /External Patch Draft Comparison/i.test(reportsText),
    codeContextPack: /Code Context Pack — Preview Only/i.test(reportsText),
    askCodeAi: /Ask Local AI About Selected Code/i.test(reportsText),
    codeQuestionTemplates: /Code Question Template/i.test(reportsText),
    projectMemory: /Project Memory \/ Handoff Files/i.test(reportsText),
    builderPlanMode: /Builder Plan Mode — Plan Only/i.test(aiText),
    speakerScripts: /Speaker Scripts/i.test(aiText),
    implementationReview: /Implementation Review/i.test(requestOutputText),
    roleModelMapping: /Role Model Mapping/i.test(settingsText),
    builderPlanComparison: /Builder Plan Comparison/i.test(reportsText),
    planningStyle: /Planning Style/i.test(settingsText),
    sourceUnchanged: beforePkg.mtimeMs === afterPkg.mtimeMs,
    noApplyPatch: await evaluate(
      `![...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    ),
    comparisonRuleBasedOnly: !/call Ollama/i.test(
      reportsText.split("External Patch Draft Comparison")[1]?.slice(0, 500) ||
        "",
    ),
  };

  report.stage71.finalReport = {
    title: regenMd.includes(REPORT_TITLE),
    sectionCount: SECTIONS.filter((s) => regenMd.includes(s)).length,
    safetyReminder: /NTTC has not applied any patch/i.test(regenMd),
  };

  // Assertions
  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!panelOrder.ok) fail(`Panel order wrong: ${JSON.stringify(panelOrder)}`);
  if (!report.stage71.noDraftUi.message) fail("No-draft message missing in UI");
  if (!report.stage71.noDraftUi.controls) fail("Comparison controls missing");
  if (!report.stage71.noDraftGenerate.blocked) fail("No-draft generate should not save");
  if (!report.stage71.importedOnly.partial) fail("Imported-only should be partial");
  if (!report.stage71.importedOnly.hasTitle) fail("Report title missing");
  if (!report.stage71.importedOnly.hasSections) fail("Report sections incomplete");
  if (!report.stage71.importedOnly.noAiLog) fail("Comparison triggered AI activity");
  if (!report.stage71.riskyImported.highOrBlocked) {
    fail(`Risky draft expected High/Blocked, got ${riskyRisk}`);
  }
  if (!report.stage71.broadCentral.giantFileRisk) {
    fail("Broad App.tsx draft missing small-model/giant-file warning");
  }
  if (!report.stage71.copy.logged) fail("Copy not logged");
  if (!report.stage71.clear.cleared) fail("Clear did not remove comparison");
  if (!report.stage71.integrations.decisionHasComparison) {
    fail("Decision Report missing comparison status");
  }
  if (!report.stage71.integrations.builderHasComparison) {
    fail("Builder Prompt missing comparison section");
  }
  if (!report.stage71.integrations.reviewHasComparison) {
    fail("Review Pack missing comparison status");
  }
  if (!report.stage71.integrations.memoryHasComparison) {
    fail("Project Memory preview missing comparison status");
  }
  if (!report.stage71.integrations.memoryNoAutoWrite) {
    fail("Project Memory wrote files automatically");
  }
  if (!safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (!safetyUi.noTtsControl) fail("TTS unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  for (const [key, ok] of Object.entries(report.regressions)) {
    if (!ok) fail(`Regression failed: ${key}`);
  }

  console.log(
    JSON.stringify(
      {
        report,
        project: PROJECT,
        bothDraftsTested,
        nttcOnlyTested,
        comparisonSectionCount: report.stage71.finalReport.sectionCount,
      },
      null,
      2,
    ),
  );
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
