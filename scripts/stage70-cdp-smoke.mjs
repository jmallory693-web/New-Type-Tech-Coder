/**
 * Stage 70 packaged-app smoke harness (CDP).
 * Stage 69 Planning Style + Stage 67/68 regressions.
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
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

const EXPANDED_MARKER = "## Small-Model Friendly Architecture";
const COMPACT_MARKER =
  "prefer small focused modules and clear file boundaries";
const MODULAR_SUGGESTED =
  "split changes into small focused modules with clear file boundaries";

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage69: {},
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
    planningStyleControl: haystack.includes("Planning Style"),
    planningStyleOptions:
      haystack.includes("Small-model friendly") &&
      haystack.includes("small-model-friendly"),
    setPlanningStyleIpc: haystack.includes("nttc:set-planning-style"),
    expandedGuidanceInMain: haystack.includes(EXPANDED_MARKER),
    compactGuidanceInMain: haystack.includes(COMPACT_MARKER),
    manualImportSection: haystack.includes("Manual Patch Draft Import"),
    noApplyPatchButton: !haystack.includes("Apply Patch"),
    codeContextSection: haystack.includes("Code Context Pack — Preview Only"),
    askCodeAiSection: haystack.includes("Ask Local AI About Selected Code"),
    patchDraftSection: haystack.includes("Patch Draft Mode — No Apply"),
    safetyReviewSection: haystack.includes("Patch Draft Safety Review"),
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

function hasExpanded(text) {
  return Boolean(text && text.includes(EXPANDED_MARKER));
}

try {
  const bundle = scanBundleStrings();
  report.stage69.bundleStrings = bundle;
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
  report.stage69.inspectOnly = /Inspect-only/i.test(headerText);
  report.stage69.liveQwenDisabled = /Live Qwen disabled/i.test(headerText);
  report.stage69.ollamaBubble = /Ollama:/i.test(headerText);

  await clickTab(evaluate, "Settings");
  const settingsText = await evaluate(`document.body.innerText`);
  report.stage69.planningStyleVisible = /Planning Style/i.test(settingsText);
  report.stage69.planningHelperVisible =
    /split logic into small readable files/i.test(settingsText);

  const planningSelect = await evaluate(`(() => {
    const sel = document.querySelector('#planning-style-select');
    if (!sel) return null;
    return {
      value: sel.value,
      options: [...sel.options].map((o) => ({ value: o.value, label: o.textContent })),
    };
  })()`);
  report.stage69.planningSelect = planningSelect;

  const beforePkg = fileStatSafe(path.join(PROJECT, "package.json"));

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await evaluate(`window.nttc.setUserRequest("Stage 70 smoke test request")`);

  // Default should be small-model-friendly for fresh/no saved setting
  const initialSnap = await evaluate(`window.nttc.getSnapshot()`);
  report.stage69.initialStyle = initialSnap.planningStyle?.style ?? null;

  // Switch to Default — should log, should not auto-call AI
  const actionLogBeforeDefault = (initialSnap.actionLog ?? []).length;
  const defaultSnap = await evaluate(`window.nttc.setPlanningStyle('default')`);
  report.stage69.switchToDefault = {
    style: defaultSnap.planningStyle?.style,
    logged: (defaultSnap.actionLog ?? []).some((e) =>
      /Planning style changed/i.test(e.message),
    ),
    actionLogGrew: (defaultSnap.actionLog ?? []).length > actionLogBeforeDefault,
    noAutoAiCall: !(defaultSnap.actionLog ?? []).some((e) =>
      /request started|Ollama|Local AI response/i.test(e.message),
    ),
  };

  // Rule-based outputs with Default — expanded guidance omitted
  const decisionDefault = await evaluate(`window.nttc.generateDecisionReport()`);
  const builderDefault = await evaluate(`window.nttc.generateBuilderPrompt()`);
  const reviewDefault = await evaluate(`window.nttc.generateReviewPack()`);
  report.stage69.defaultOutputs = {
    decisionHasCompact: /Planning style: Default/i.test(
      decisionDefault.decision?.decisionReport?.markdownReport || "",
    ),
    decisionNoExpanded: !hasExpanded(
      decisionDefault.decision?.decisionReport?.markdownReport,
    ),
    builderNoExpanded: !hasExpanded(
      builderDefault.decision?.builderPrompt?.markdownReport,
    ),
    reviewHasPlanningLine: /Planning style:/i.test(
      reviewDefault.reviewPack?.markdownReport || "",
    ),
    reviewNoExpanded: !hasExpanded(reviewDefault.reviewPack?.markdownReport),
  };

  // Switch back to Small-model friendly
  const friendlySnap = await evaluate(
    `window.nttc.setPlanningStyle('small-model-friendly')`,
  );
  report.stage69.switchToFriendly = {
    style: friendlySnap.planningStyle?.style,
    statusLine: /Planning style: Small-model friendly/i.test(
      friendlySnap.planningStyle?.statusMessage || "",
    ),
    logged: (friendlySnap.actionLog ?? []).some((e) =>
      /Planning style changed/i.test(e.message),
    ),
  };

  const decisionFriendly = await evaluate(`window.nttc.generateDecisionReport()`);
  const builderFriendly = await evaluate(`window.nttc.generateBuilderPrompt()`);
  const reviewFriendly = await evaluate(`window.nttc.generateReviewPack()`);
  report.stage69.friendlyOutputs = {
    decisionHasCompact: new RegExp(COMPACT_MARKER, "i").test(
      decisionFriendly.decision?.decisionReport?.markdownReport || "",
    ),
    builderHasExpanded: hasExpanded(
      builderFriendly.decision?.builderPrompt?.markdownReport,
    ),
    reviewHasPlanningLine: new RegExp(COMPACT_MARKER, "i").test(
      reviewFriendly.reviewPack?.markdownReport || "",
    ),
    builderGuidanceLogged: (builderFriendly.actionLog ?? []).some((e) =>
      /Small-model friendly guidance included in Builder Prompt/i.test(e.message),
    ),
  };

  // Project Memory preview — guidance, no auto-write
  const nttcBefore = fileStatSafe(path.join(PROJECT, ".nttc", "NTTC_PLAN.md"));
  const memorySnap = await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  const nttcAfter = fileStatSafe(path.join(PROJECT, ".nttc", "NTTC_PLAN.md"));
  const planPreview = memorySnap.projectMemory?.preview?.files?.find(
    (f) => f.fileName === "NTTC_PLAN.md",
  );
  report.stage69.projectMemory = {
    previewGenerated: Boolean(memorySnap.projectMemory?.preview),
    planHasPlanningStyle: /Planning Style/i.test(planPreview?.content || ""),
    planHasCompact: new RegExp(COMPACT_MARKER, "i").test(planPreview?.content || ""),
    noAutoWrite: nttcBefore.mtimeMs === nttcAfter.mtimeMs,
    guidanceLogged: (memorySnap.actionLog ?? []).some((e) =>
      /Small-model friendly guidance included in Project Memory/i.test(e.message),
    ),
  };

  // Patch Draft Safety Review + imported draft suggested prompt
  await evaluate(`window.nttc.setImportedPatchDraftSource('Cursor')`);
  await evaluate(`window.nttc.setImportedPatchDraftType('Patch draft')`);
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Proposed: refactor src/renderer/App.tsx into smaller modules.\\n// patch draft")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft()`);
  await evaluate(
    `window.nttc.setPatchDraftSafetyReviewTarget('imported-patch-draft')`,
  );
  const pdsrSnap = await evaluate(`window.nttc.generatePatchDraftSafetyReview()`);
  const pdsrMd = pdsrSnap.patchDraftSafetyReview?.saved?.markdownReport || "";
  report.stage69.patchDraftSafetyReview = {
    hasPlanningLine: /Planning style:/i.test(pdsrMd),
    suggestedHasModular: new RegExp(MODULAR_SUGGESTED, "i").test(pdsrMd),
  };

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.stage69.reportsStatusLines = {
    decision: /Planning style: Small-model friendly/i.test(reportsText),
    patchDraftPanel: /Patch Draft Mode — No Apply/i.test(reportsText),
    safetyReview: /Patch Draft Safety Review/i.test(reportsText),
    manualImport: /Manual Patch Draft Import/i.test(reportsText),
  };

  // Builder Plan Comparison planning line (rule-based generate if possible)
  await clickTab(evaluate, "Request / Output");
  await evaluate(`window.nttc.setBuilderResultSource('Cursor')`);
  await evaluate(`window.nttc.setBuilderResultResponseType('Builder plan')`);
  await evaluate(
    `window.nttc.setBuilderResultDraft("Outside builder plan: split feature into src/shared/types.ts and src/main/feature/manager.ts")`,
  );
  await evaluate(`window.nttc.saveBuilderResult()`);
  const comparisonSnap = await evaluate(
    `window.nttc.generateBuilderPlanComparison()`,
  );
  const comparisonMd =
    comparisonSnap.builderPlanComparison?.saved?.markdownReport || "";
  report.stage69.builderPlanComparison = {
    hasPlanningLine: /Planning style:/i.test(comparisonMd),
    suggestedHasModular: new RegExp(MODULAR_SUGGESTED, "i").test(comparisonMd),
  };

  // Daily Next Action mention when broad draft implied
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Rewrite everything in App.tsx and main/index.ts as one giant file.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  await clickTab(evaluate, "Dashboard");
  const dashboardText = await evaluate(`document.body.innerText`);
  report.stage69.dailyNextBroadDraft = /Small-model friendly planning/i.test(
    dashboardText,
  );

  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  report.stage69.aiReviewStatusLine = /Planning style: Small-model friendly/i.test(
    aiText,
  );

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
    codeContextPack: /Code Context Pack — Preview Only/i.test(reportsText),
    askCodeAi: /Ask Local AI About Selected Code/i.test(reportsText),
    codeQuestionTemplates: /Code Question Template/i.test(reportsText),
    projectMemory: /Project Memory \/ Handoff Files/i.test(reportsText),
    builderPlanMode: /Builder Plan Mode — Plan Only/i.test(aiText),
    speakerScripts: /Speaker Scripts/i.test(aiText),
    implementationReview: /Implementation Review/i.test(requestOutputText),
    roleModelMapping: /Role Model Mapping/i.test(settingsText),
    sourceUnchanged: beforePkg.mtimeMs === afterPkg.mtimeMs,
    noApplyPatch: await evaluate(
      `![...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    ),
  };

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!planningSelect) fail("Planning style select not found");
  if (!planningSelect.options.some((o) => o.label === "Default")) {
    fail("Default option missing");
  }
  if (!planningSelect.options.some((o) => o.label === "Small-model friendly")) {
    fail("Small-model friendly option missing");
  }
  if (report.stage69.initialStyle !== "small-model-friendly") {
    fail(`Expected initial style small-model-friendly, got ${report.stage69.initialStyle}`);
  }
  if (report.stage69.switchToDefault.style !== "default") {
    fail("Switch to Default failed");
  }
  if (!report.stage69.switchToDefault.logged) {
    fail("Planning style change not logged");
  }
  if (!report.stage69.switchToDefault.noAutoAiCall) {
    fail("Style change triggered unexpected AI activity");
  }
  if (!report.stage69.defaultOutputs.builderNoExpanded) {
    fail("Default style still includes expanded guidance in Builder Prompt");
  }
  if (!report.stage69.friendlyOutputs.builderHasExpanded) {
    fail("Small-model friendly Builder Prompt missing expanded guidance");
  }
  if (!report.stage69.friendlyOutputs.decisionHasCompact) {
    fail("Decision Report missing compact planning style line");
  }
  if (!report.stage69.patchDraftSafetyReview.hasPlanningLine) {
    fail("Patch Draft Safety Review missing planning style line");
  }
  if (!report.stage69.patchDraftSafetyReview.suggestedHasModular) {
    fail("Patch Draft Safety Review missing modular suggested prompt");
  }
  if (!report.stage69.builderPlanComparison.hasPlanningLine) {
    fail("Builder Plan Comparison missing planning style line");
  }
  if (!report.stage69.projectMemory.noAutoWrite) {
    fail("Project Memory preview wrote files automatically");
  }
  if (!report.stage69.projectMemory.planHasPlanningStyle) {
    fail("Project Memory preview missing planning style guidance");
  }
  if (!safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (!safetyUi.noTtsControl) fail("TTS unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  for (const [key, ok] of Object.entries(report.regressions)) {
    if (!ok) fail(`Regression failed: ${key}`);
  }

  console.log(JSON.stringify({ report, project: PROJECT }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
