/**
 * Stage 74 packaged-app smoke harness (CDP).
 * Stage 73 Builder Handoff Export + Stage 71–73 regressions.
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

const HANDOFF_TITLE = "# NTTC Builder Handoff Pack";
const HANDOFF_SECTIONS = [
  "## Purpose",
  "## Builder Target",
  "## Current Safety Status",
  "## Approved Direction",
  "## Scope",
  "## Safety Boundaries",
  "## Small-Model Friendly Architecture",
  "## Validation Required",
  "## Builder Instructions",
  "## Report Back Format",
  "## Missing Context / Warnings",
  "## Recommendation",
  "## Safety Reminder",
];

const TARGET_LABELS = [
  "Generic builder",
  "Cursor",
  "Codex",
  "Claude",
  "ChatGPT",
  "Grok",
  "Qwen",
  "Human programmer",
];

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage73: {},
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
    handoffSection: haystack.includes("Builder Handoff Export"),
    handoffGenerate: haystack.includes("Generate Builder Handoff Pack"),
    handoffIpc: haystack.includes("nttc:generate-builder-handoff-export"),
    comparisonSection: haystack.includes("External Patch Draft Comparison"),
    noApplyPatchButton: !renderer.includes("Apply Patch"),
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
  return HANDOFF_SECTIONS.every((s) => md.includes(s));
}

function isDoNotSendOrPlanning(rec) {
  return /Do not send yet|Send only for planning/i.test(rec || "");
}

try {
  const bundle = scanBundleStrings();
  report.stage73.bundleStrings = bundle;
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
  report.stage73.inspectOnly = /Inspect-only/i.test(headerText);
  report.stage73.liveQwenDisabled = /Live Qwen disabled/i.test(headerText);
  report.stage73.ollamaBubble = /Ollama:/i.test(headerText);

  const beforePkg = fileStatSafe(path.join(PROJECT, "package.json"));
  const nttcBefore = fileStatSafe(path.join(PROJECT, ".nttc", "NTTC_PLAN.md"));

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(EMPTY_PROJECT)})`);
  await evaluate(`window.nttc.setUserRequest("Stage 74 smoke test request")`);
  await evaluate(`window.nttc.setPlanningStyle('small-model-friendly')`);
  await evaluate(`window.nttc.clearImportedPatchDraft()`);
  await evaluate(`window.nttc.clearExternalPatchDraftComparison()`);
  await evaluate(`window.nttc.clearBuilderHandoffExport()`);

  await clickTab(evaluate, "Reports");

  const panelOrder = await evaluate(`(() => {
    const comparison = document.querySelector('[data-focus-id="external-patch-draft-comparison"]');
    const handoff = document.querySelector('[data-focus-id="builder-handoff-export"]');
    const changed = document.querySelector('[data-focus-id="changed-files"]');
    if (!handoff) return { ok: false, reason: 'handoff panel missing' };
    const pos = (el) => {
      if (!el) return -1;
      return [...document.body.querySelectorAll('*')].indexOf(el);
    };
    return {
      ok: pos(comparison) < pos(handoff) && pos(handoff) < pos(changed),
      comparisonPos: pos(comparison),
      handoffPos: pos(handoff),
      changedPos: pos(changed),
    };
  })()`);
  report.stage73.panelOrder = panelOrder;

  const selectors = await evaluate(`(() => {
    const target = [...document.querySelectorAll('select')].find((sel) => {
      const label = sel.closest('label');
      return label && /Handoff target/i.test(label.textContent || '');
    });
    const strictness = [...document.querySelectorAll('select')].find((sel) => {
      const label = sel.closest('label');
      return label && /Handoff strictness/i.test(label.textContent || '');
    });
    return {
      targetValue: target?.value ?? null,
      targetOptions: target ? [...target.options].map((o) => o.textContent) : [],
      strictnessValue: strictness?.value ?? null,
      strictnessOptions: strictness
        ? [...strictness.options].map((o) => o.textContent)
        : [],
    };
  })()`);
  report.stage73.selectors = selectors;

  const reportsNoInput = await evaluate(`document.body.innerText`);
  report.stage73.noInputUi = {
    message:
      /Create a patch draft, imported draft, safety review, or comparison before generating a handoff/i.test(
        reportsNoInput,
      ),
    controls: [
      "Generate Builder Handoff Pack",
      "Copy Builder Handoff Pack",
      "Clear Builder Handoff Pack",
    ].every((label) => reportsNoInput.includes(label)),
  };

  const noInputGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  report.stage73.noInputGenerate = {
    blocked: !noInputGen.builderHandoffExport?.saved,
    status: noInputGen.builderHandoffExport?.statusMessage || "",
  };

  // Imported-only handoff
  await evaluate(`window.nttc.setImportedPatchDraftSource('Cursor')`);
  await evaluate(`window.nttc.setImportedPatchDraftType('Patch draft')`);
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Add src/shared/feature.ts. Include typecheck and npm run build. Safety backup. No apply — plan only.")`,
  );
  const logBeforeImported = (await evaluate(`window.nttc.getSnapshot()`)).actionLog
    .length;
  await evaluate(`window.nttc.saveImportedPatchDraft()`);
  const importedOnlyGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const importedMd =
    importedOnlyGen.builderHandoffExport?.saved?.markdownReport || "";
  report.stage73.importedOnly = {
    saved: Boolean(importedOnlyGen.builderHandoffExport?.saved),
    recommendation:
      importedOnlyGen.builderHandoffExport?.saved?.recommendation ?? null,
    planningOrCaution: isDoNotSendOrPlanning(
      importedOnlyGen.builderHandoffExport?.saved?.recommendation,
    ),
    hasTitle: importedMd.includes(HANDOFF_TITLE),
    hasSections: hasAllSections(importedMd),
    noAiLog: !(importedOnlyGen.actionLog ?? [])
      .slice(logBeforeImported)
      .some((e) => /Ollama|Local AI response|request started/i.test(e.message)),
  };

  // Switch to disposable for richer scenarios
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await evaluate(`window.nttc.setPlanningStyle('small-model-friendly')`);

  // PDSR do not proceed
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Enable edit mode and command runner with arbitrary terminal. apply patch automatically.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  await evaluate(`window.nttc.setPatchDraftSafetyReviewTarget('imported-patch-draft')`);
  await evaluate(`window.nttc.generatePatchDraftSafetyReview()`);
  const pdsrSnap = await evaluate(`window.nttc.getSnapshot()`);
  const pdsrBlockedGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  report.stage73.pdsrDoNotProceed = {
    pdsrRecommendation: pdsrSnap.patchDraftSafetyReview?.saved?.recommendation,
    handoffRecommendation:
      pdsrBlockedGen.builderHandoffExport?.saved?.recommendation ?? null,
    isDoNotSend:
      pdsrBlockedGen.builderHandoffExport?.saved?.recommendation ===
      "Do not send yet",
  };

  // Comparison blocked/high
  await evaluate(`window.nttc.generateExternalPatchDraftComparison()`);
  const blockedComparisonGen = await evaluate(
    `window.nttc.generateBuilderHandoffExport()`,
  );
  report.stage73.comparisonBlocked = {
    comparisonRisk:
      blockedComparisonGen.externalPatchDraftComparison?.saved?.riskLevel ?? null,
    handoffRecommendation:
      blockedComparisonGen.builderHandoffExport?.saved?.recommendation ?? null,
    safeRecommendation: isDoNotSendOrPlanning(
      blockedComparisonGen.builderHandoffExport?.saved?.recommendation,
    ),
  };

  // Target: Cursor
  await evaluate(`window.nttc.setBuilderHandoffTarget('cursor')`);
  await evaluate(`window.nttc.setBuilderHandoffStrictness('conservative')`);
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Add src/shared/narrow.ts module only. typecheck, build, safety backup, rollback. No apply.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  await evaluate(`window.nttc.generateExternalPatchDraftComparison()`);
  const cursorGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const cursorMd = cursorGen.builderHandoffExport?.saved?.markdownReport || "";
  report.stage73.targetCursor = {
    target: cursorGen.builderHandoffExport?.saved?.target,
    hasCursorWording: /file-by-file|scoped/i.test(cursorMd),
    conservativeWording: /strongest safety boundaries|Do not skip validation/i.test(
      cursorMd,
    ),
  };

  // Target: Claude
  await evaluate(`window.nttc.setBuilderHandoffTarget('claude')`);
  const claudeGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const claudeMd = claudeGen.builderHandoffExport?.saved?.markdownReport || "";
  report.stage73.targetClaude = {
    hasReviewWording: /Review and plan before implementation|hidden file access/i.test(
      claudeMd,
    ),
  };

  // Target: Human programmer
  await evaluate(`window.nttc.setBuilderHandoffTarget('human-programmer')`);
  const humanGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const humanMd = humanGen.builderHandoffExport?.saved?.markdownReport || "";
  report.stage73.targetHuman = {
    hasChecklistWording: /review checklist/i.test(humanMd),
  };

  // Fast small patch strictness
  await evaluate(`window.nttc.setBuilderHandoffStrictness('fast-small-patch')`);
  const fastGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const fastMd = fastGen.builderHandoffExport?.saved?.markdownReport || "";
  report.stage73.strictnessFast = {
    hasNarrowWording: /small and fast|touched files only/i.test(fastMd),
    noApply: /Do not add terminal|Apply Patch|live Qwen/i.test(fastMd),
  };

  // Default planning style — no expanded modularity block lines
  await evaluate(`window.nttc.setPlanningStyle('default')`);
  const defaultStyleGen = await evaluate(
    `window.nttc.generateBuilderHandoffExport()`,
  );
  const defaultMd =
    defaultStyleGen.builderHandoffExport?.saved?.markdownReport || "";
  report.stage73.defaultPlanningStyle = {
    hasDefaultLine: /Planning style: Default/i.test(defaultMd),
    noExpandedModularity: !/split logic into small focused files/i.test(defaultMd),
  };

  // Small-model friendly
  await evaluate(`window.nttc.setPlanningStyle('small-model-friendly')`);
  const friendlyGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const friendlyMd =
    friendlyGen.builderHandoffExport?.saved?.markdownReport || "";
  report.stage73.friendlyPlanningStyle = {
    hasModularity: /small focused files|giant file rewrites|small-model friendly architecture/i.test(
      friendlyMd,
    ),
  };

  // NTTC-only if restored from history
  const snapNttc = await evaluate(`window.nttc.getSnapshot()`);
  if (snapNttc.patchDraft?.saved) {
    await evaluate(`window.nttc.clearImportedPatchDraft()`);
    const nttcOnlyGen = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
    report.stage73.nttcOnly = {
      tested: true,
      saved: Boolean(nttcOnlyGen.builderHandoffExport?.saved),
      recommendation:
        nttcOnlyGen.builderHandoffExport?.saved?.recommendation ?? null,
    };
    await evaluate(
      `window.nttc.setImportedPatchDraftDraft("Add src/shared/narrow.ts. typecheck, build, safety backup. No apply.")`,
    );
    await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  } else {
    report.stage73.nttcOnly = {
      tested: false,
      note: "No restored NTTC Patch Draft — skipped",
    };
  }

  // Copy / clear
  const copySnap = await evaluate(`window.nttc.recordCopyBuilderHandoffExport()`);
  report.stage73.copy = {
    logged: (copySnap.actionLog ?? []).some((e) =>
      /handoff pack copied/i.test(e.message),
    ),
    stillSaved: Boolean(copySnap.builderHandoffExport?.saved),
  };
  const clearSnap = await evaluate(`window.nttc.clearBuilderHandoffExport()`);
  report.stage73.clear = {
    cleared: !clearSnap.builderHandoffExport?.saved,
    logged: (clearSnap.actionLog ?? []).some((e) =>
      /handoff pack cleared/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const decisionSnap = await evaluate(`window.nttc.generateDecisionReport()`);
  const builderSnap = await evaluate(`window.nttc.generateBuilderPrompt()`);
  const reviewSnap = await evaluate(`window.nttc.generateReviewPack()`);
  const memorySnap = await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  const nttcAfter = fileStatSafe(path.join(PROJECT, ".nttc", "NTTC_PLAN.md"));
  const contextPreview = memorySnap.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_CONTEXT.md",
  );

  report.stage73.integrations = {
    decisionHasHandoff: /Builder Handoff Pack exists:/i.test(
      decisionSnap.decision?.decisionReport?.markdownReport || "",
    ),
    builderHasHandoff: /Builder Handoff Export/i.test(
      builderSnap.decision?.builderPrompt?.markdownReport || "",
    ),
    reviewHasHandoff: /## Builder Handoff Export/i.test(
      reviewSnap.reviewPack?.markdownReport || "",
    ),
    memoryHasHandoff: /Builder Handoff Pack/i.test(contextPreview?.content || ""),
    memoryNoAutoWrite: nttcBefore.mtimeMs === nttcAfter.mtimeMs,
  };

  await evaluate(`window.nttc.clearBuilderHandoffExport()`);
  await evaluate(`window.nttc.summarizeProject()`);
  await clickTab(evaluate, "Dashboard");
  const dashboardNoHandoff = await evaluate(`(() => {
    const title = document.querySelector('.dashboard-next-title')?.textContent || '';
    const reason = document.querySelector('.dashboard-next-reason')?.textContent || '';
    const hints = [...document.querySelectorAll('.dashboard-freshness li')]
      .map((li) => li.textContent || '')
      .join(' | ');
    return { title, reason, hints };
  })()`);
  report.stage73.dailyRecommendHandoff = {
    title: dashboardNoHandoff.title,
    reason: dashboardNoHandoff.reason,
    mentionsHandoff: /Builder Handoff|handoff pack/i.test(
      `${dashboardNoHandoff.title} ${dashboardNoHandoff.reason}`,
    ),
    practical: false,
    note: "May be deferred by higher-priority daily actions.",
  };

  await evaluate(`window.nttc.setBuilderHandoffStrictness('conservative')`);
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Enable edit mode, command runner, arbitrary terminal.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  await evaluate(`window.nttc.generateExternalPatchDraftComparison()`);
  await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  await clickTab(evaluate, "Dashboard");
  const dashboardDoNotSend = await evaluate(`(() => {
    const title = document.querySelector('.dashboard-next-title')?.textContent || '';
    const reason = document.querySelector('.dashboard-next-reason')?.textContent || '';
    return { title, reason };
  })()`);
  report.stage73.dailyDoNotSend = {
    title: dashboardDoNotSend.title,
    reason: dashboardDoNotSend.reason,
    mentionsSafeguards: /safeguard|Do not send|handoff/i.test(
      `${dashboardDoNotSend.title} ${dashboardDoNotSend.reason}`,
    ),
    practical: /Resolve handoff safeguards|Do not send/i.test(
      `${dashboardDoNotSend.title} ${dashboardDoNotSend.reason}`,
    ),
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

  const finalMd =
    safetySnap.builderHandoffExport?.saved?.markdownReport ||
    friendlyMd ||
    "";

  report.regressions = {
    comparisonPanel: /External Patch Draft Comparison/i.test(reportsText),
    manualImport: /Manual Patch Draft Import/i.test(reportsText),
    patchDraft: /Patch Draft Mode — No Apply/i.test(reportsText),
    safetyReview: /Patch Draft Safety Review/i.test(reportsText),
    handoffPanel: /Builder Handoff Export/i.test(reportsText),
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
    handoffRuleBasedOnly: !/call Ollama/i.test(
      reportsText.split("Builder Handoff Export")[1]?.slice(0, 500) || "",
    ),
  };

  report.stage73.finalReport = {
    title: finalMd.includes(HANDOFF_TITLE),
    sectionCount: HANDOFF_SECTIONS.filter((s) => finalMd.includes(s)).length,
    safetyReminder: /NTTC has not applied any patch/i.test(finalMd),
  };

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!panelOrder.ok) fail(`Panel order wrong: ${JSON.stringify(panelOrder)}`);
  if (selectors.targetValue !== "generic-builder") {
    fail(`Expected default target generic-builder, got ${selectors.targetValue}`);
  }
  if (selectors.strictnessValue !== "conservative") {
    fail(`Expected default strictness conservative, got ${selectors.strictnessValue}`);
  }
  for (const label of TARGET_LABELS) {
    if (!selectors.targetOptions.includes(label)) {
      fail(`Missing handoff target option: ${label}`);
    }
  }
  if (!selectors.strictnessOptions.includes("Conservative")) fail("Missing Conservative");
  if (!selectors.strictnessOptions.includes("Normal")) fail("Missing Normal");
  if (!selectors.strictnessOptions.includes("Fast small patch")) {
    fail("Missing Fast small patch");
  }
  if (!report.stage73.noInputUi.message) fail("No-input message missing");
  if (!report.stage73.noInputGenerate.blocked) fail("No-input generate should not save");
  if (!report.stage73.importedOnly.saved) fail("Imported-only handoff not saved");
  if (!report.stage73.importedOnly.hasTitle) fail("Handoff title missing");
  if (!report.stage73.importedOnly.hasSections) fail("Handoff sections incomplete");
  if (!report.stage73.importedOnly.noAiLog) fail("Handoff triggered AI activity");
  if (!report.stage73.pdsrDoNotProceed.isDoNotSend) {
    fail(`PDSR do-not-proceed expected Do not send yet, got ${report.stage73.pdsrDoNotProceed.handoffRecommendation}`);
  }
  if (!report.stage73.comparisonBlocked.safeRecommendation) {
    fail("Blocked comparison should yield Do not send or planning recommendation");
  }
  if (!report.stage73.targetCursor.hasCursorWording) fail("Cursor wording missing");
  if (!report.stage73.targetClaude.hasReviewWording) fail("Claude review wording missing");
  if (!report.stage73.targetHuman.hasChecklistWording) fail("Human checklist wording missing");
  if (!report.stage73.strictnessFast.noApply) fail("Fast strictness missing no-apply safety");
  if (!report.stage73.friendlyPlanningStyle.hasModularity) {
    fail("Small-model friendly modularity missing");
  }
  if (!report.stage73.copy.logged) fail("Copy not logged");
  if (!report.stage73.clear.cleared) fail("Clear did not remove handoff");
  if (!report.stage73.integrations.decisionHasHandoff) {
    fail("Decision Report missing handoff status");
  }
  if (!report.stage73.integrations.builderHasHandoff) {
    fail("Builder Prompt missing handoff section");
  }
  if (!report.stage73.integrations.reviewHasHandoff) {
    fail("Review Pack missing handoff status");
  }
  if (!report.stage73.integrations.memoryHasHandoff) {
    fail("Project Memory preview missing handoff status");
  }
  if (!report.stage73.integrations.memoryNoAutoWrite) {
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
        handoffSectionCount: report.stage73.finalReport.sectionCount,
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
