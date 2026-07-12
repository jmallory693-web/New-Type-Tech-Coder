/**
 * Stage 83 packaged-app smoke harness (CDP).
 * Stage 82 Local Planner AI + Stage 80–81 regressions.
 *
 * Launch packaged app first:
 *   "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9239
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;
const PLANNING_DIR = path.join(PROJECT, ".nttc", "planning");

const SAMPLE_IDEA =
  "I want to build a simple offline recipe manager for Windows. It should store recipes locally, allow search, tags, ingredients, meal planning, and export. I am a non-coder and want it built in small safe phases.";

const COMPLETE_BLUEPRINT = `# Project Blueprint

## Project Brief
Simple offline recipe manager for Windows.

## Product Requirements
Store recipes locally with search, tags, and export.

## User Stories
As a home cook I want to find recipes by ingredient.

## Feature Roadmap
Phase 1: add/list/search. Phase 2: meal planning.

## Data Model
Recipe id, title, ingredients, tags.

## Screen / Workflow Flow
Home list, recipe detail, add form, search.

## Architecture Plan
Local desktop app with local file storage.

## Suggested File / Module Plan
Small focused modules per screen and data layer.

## Build Phases
Phase 1: core list and save. Phase 2: export.

## Validation Plan
Manual smoke tests for add/search/save.

## Risks / Open Questions
Should we support photos later?

## AI Team Roles
Planner, builder, reviewer.

## Phase 1 Builder Handoff
Build list UI and local save only.

## Current Status
Planning complete — ready for Phase 1.
`;

const PLANNING_FILES = [
  "PROJECT_BRIEF.md",
  "PRODUCT_REQUIREMENTS.md",
  "FEATURE_ROADMAP.md",
  "DATA_MODEL.md",
  "SCREEN_FLOW.md",
  "ARCHITECTURE_PLAN.md",
  "BUILD_PHASES.md",
  "VALIDATION_PLAN.md",
  "AI_TEAM_ROLES.md",
  "HANDOFF_NOTES.md",
  "CURRENT_STATUS.md",
  "DECISIONS_LOG.md",
];

const CONFIRM_SNIPPETS = [
  "Blueprint idea fields",
  "will not read project source files",
  "will not send Code Context Pack",
  "will not write source code",
  "will not scaffold app files",
  "will not install packages",
  "will not run commands",
  "will not save planning documents automatically",
  "Continue?",
];

const report = {
  packagedOutputs: {
    exe: fs.existsSync(EXE),
    installer: fs.existsSync(
      path.join(REPO, "release", "New Type Tech Coder-0.1.0-Setup.exe"),
    ),
  },
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage82: {},
  planningExport: {},
  historyRestore: {},
  regressions: {},
  failures: [],
  warnings: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function warn(msg) {
  report.warnings.push(msg);
}

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
    if (name.endsWith(".js")) {
      haystack += fs.readFileSync(path.join(root, name), "utf8");
    }
  }
  return haystack;
}

function listPlanningFilesOnDisk() {
  if (!fs.existsSync(PLANNING_DIR)) return [];
  return fs.readdirSync(PLANNING_DIR).filter((f) => f.endsWith(".md"));
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
      (el.textContent || '').trim() === ${JSON.stringify(label)} ||
      (el.textContent || '').includes(${JSON.stringify(label)}),
    );
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 700));
}

async function clickActionButton(evaluate, label) {
  return evaluate(`(() => {
    const btn = [...document.querySelectorAll('button.action-btn')].find((el) =>
      (el.textContent || '').trim() === ${JSON.stringify(label)},
    );
    if (btn && !btn.disabled) btn.click();
    return { clicked: !!btn, disabled: btn?.disabled ?? null };
  })()`);
}

async function waitForPlannerDraft(evaluate, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await evaluate(`window.nttc.getSnapshot()`);
    if (snap.blueprint?.plannerAi?.saved?.responseText) return snap;
    if (!snap.blueprint?.plannerAi?.busy && snap.blueprint?.plannerAi?.statusMessage) {
      const msg = snap.blueprint.plannerAi.statusMessage;
      if (/failed|timed out|not ready|blocked|empty/i.test(msg)) return snap;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return evaluate(`window.nttc.getSnapshot()`);
}

try {
  if (!report.packagedOutputs.exe) fail("Packaged exe missing");

  const renderer = readRendererHaystack();
  report.stage82.bundle = {
    askLocalPlannerAi: renderer.includes("Ask Local Planner AI"),
    helperText: renderer.includes("does not read project files, write code"),
    blueprintPlannerMapping: renderer.includes("Blueprint Planner"),
    saveLocalDraft: renderer.includes("Save Local Draft as Blueprint"),
    copyLocalDraft: renderer.includes("Copy Local Planner Blueprint Draft"),
    noApplyPatch: !renderer.includes("Apply Patch"),
  };
  for (const [key, ok] of Object.entries(report.stage82.bundle)) {
    if (key === "noApplyPatch") {
      if (!ok) fail(`Bundle check failed: ${key}`);
      continue;
    }
    if (!ok) fail(`Bundle missing: ${key}`);
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const headerText = await evaluate(`document.body.innerText.slice(0, 4000)`);
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

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));

  await clickTab(evaluate, "Blueprint");
  const uiCheck = await evaluate(`(() => {
    const root = document.querySelector('[data-focus-id="blueprint-planner"]');
    const text = root ? root.innerText : '';
    const buttons = root ? [...root.querySelectorAll('button.action-btn')].map((b) => (b.textContent || '').trim()) : [];
    return {
      panel: !!root,
      askBtn: buttons.includes('Ask Local Planner AI'),
      helper: /does not read project files, write code, or create files/i.test(text),
      copyDraftBtn: buttons.includes('Copy Local Planner Blueprint Draft'),
      saveDraftBtn: buttons.includes('Save Local Draft as Blueprint'),
      statusArea: /Local Planner AI|Optional: ask Local Planner AI/i.test(text),
    };
  })()`);
  report.stage82.ui = uiCheck;

  await evaluate(`window.nttc.setBlueprintIntake(${JSON.stringify({ projectIdea: "" })})`);
  await new Promise((r) => setTimeout(r, 400));
  const emptyBtn = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button.action-btn')].find((b) =>
      (b.textContent || '').trim() === 'Ask Local Planner AI',
    );
    return { exists: !!btn, disabled: btn?.disabled ?? null };
  })()`);
  const emptyIpc = await evaluate(`window.nttc.askLocalPlannerAi()`);
  report.stage82.emptyIdea = {
    buttonDisabled: emptyBtn.disabled === true,
    statusMessage: emptyIpc.blueprint?.plannerAi?.statusMessage ?? null,
    blocked: /Describe the project idea/i.test(
      emptyIpc.blueprint?.plannerAi?.statusMessage ?? "",
    ),
    noDraft: !emptyIpc.blueprint?.plannerAi?.saved,
  };

  await evaluate(`window.nttc.setBlueprintIntake(${JSON.stringify({
    projectIdea: SAMPLE_IDEA,
    answersClarifications: "Offline only. Windows desktop. No cloud login.",
    buildStyle: "small-model-friendly",
  })})`);
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.generateBlueprintPlannerPrompt()`);
  await new Promise((r) => setTimeout(r, 500));

  await evaluate(`(() => {
    window.__confirmCalls = [];
    window.__confirmResult = false;
    window.confirm = (m) => { window.__confirmCalls.push(m); return window.__confirmResult; };
  })()`);
  const logBeforeCancel = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
  const cancelClick = await clickActionButton(evaluate, "Ask Local Planner AI");
  await new Promise((r) => setTimeout(r, 800));
  const afterCancel = await evaluate(`window.nttc.getSnapshot()`);
  const cancelLog = newActionLogEntries(afterCancel.actionLog, logBeforeCancel);
  const confirmText = (await evaluate(`window.__confirmCalls`))?.[0] ?? "";
  report.stage82.confirmationGate = {
    click: cancelClick,
    confirmShown: CONFIRM_SNIPPETS.every((s) => confirmText.includes(s)),
    confirmTextSample: confirmText.slice(0, 240),
    cancelledLog: cancelLog.some((e) => /Local Planner AI cancelled/i.test(e.message)),
    noDraftAfterCancel: !afterCancel.blueprint?.plannerAi?.saved,
    notBusyAfterCancel: !afterCancel.blueprint?.plannerAi?.busy,
  };

  const providerBefore = await evaluate(`window.nttc.getSnapshot()`);
  const ollamaReady =
    providerBefore.provider?.connected &&
    providerBefore.provider?.connectionState === "ready";

  report.stage82.ollamaStatusBefore = {
    connected: providerBefore.provider?.connected,
    state: providerBefore.provider?.connectionState,
    message: providerBefore.provider?.message,
    bubble: providerBefore.ollamaStatus?.status,
  };

  if (ollamaReady) {
    await evaluate(`(() => { window.__confirmResult = true; })()`);
    const logBeforeAi = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
    await clickActionButton(evaluate, "Ask Local Planner AI");
    const progressSeen = await evaluate(`(() => {
      return /Working…|Blueprint Planner is working/i.test(document.body.innerText);
    })()`);
    const afterAi = await waitForPlannerDraft(evaluate, 180000);
    const draft = afterAi.blueprint?.plannerAi?.saved;
    const aiLog = newActionLogEntries(afterAi.actionLog, logBeforeAi);
    report.stage82.liveOllama = {
      progressSeen,
      completed: Boolean(draft?.responseText),
      model: draft?.modelName ?? null,
      baseUrl: draft?.baseUrl ?? null,
      elapsedMs: draft?.elapsedMs ?? null,
      sectionsPresent: draft?.sectionsPresent?.length ?? 0,
      readiness: draft?.readinessEstimate ?? null,
      preview: Boolean(draft?.previewExcerpt),
      notAutoImported: !afterAi.blueprint?.importedBlueprint?.source?.includes("local"),
      startedLog: aiLog.some((e) => /Local Planner AI started/i.test(e.message)),
      completedLog: aiLog.some((e) => /Local Planner AI completed/i.test(e.message)),
      dataBoundaryLog: aiLog.some((e) =>
        /idea\/planning fields only/i.test(e.detail || e.message || ""),
      ),
      ollamaAfter: afterAi.ollamaStatus?.status,
    };

    if (draft?.responseText) {
      const beforeSave = await evaluate(`window.nttc.getSnapshot()`);
      await evaluate(`window.nttc.saveBlueprintPlannerDraftAsImported()`);
      await new Promise((r) => setTimeout(r, 600));
      const afterSave = await evaluate(`window.nttc.getSnapshot()`);
      report.stage82.saveDraftAsBlueprint = {
        imported: Boolean(afterSave.blueprint?.importedBlueprint),
        source: afterSave.blueprint?.importedBlueprint?.source ?? null,
        savedFlag: afterSave.blueprint?.plannerAi?.saved?.savedAsImportedBlueprint,
        notAutoBeforeExplicitSave:
          !beforeSave.blueprint?.importedBlueprint && afterSave.blueprint?.importedBlueprint,
      };

      await evaluate(`window.nttc.checkBlueprintCompleteness()`);
      await new Promise((r) => setTimeout(r, 500));
      await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
      await new Promise((r) => setTimeout(r, 500));
      const afterPreview = await evaluate(`window.nttc.getSnapshot()`);
      const planningBefore = listPlanningFilesOnDisk();
      report.stage82.afterLocalDraft = {
        completeness: Boolean(afterPreview.blueprint?.completenessReport),
        preview: Boolean(afterPreview.blueprint?.planningDocsPreview?.files?.length),
        noAutoPlanningWrite: listPlanningFilesOnDisk().length === planningBefore.length,
      };
    } else {
      warn("Live Ollama ready but no draft returned — check model mapping");
      report.stage82.liveOllama.skippedCompletion = true;
    }
  } else {
    warn("Ollama not ready — skipping live planner completion test");
    const offlineSnap = await evaluate(`window.nttc.askLocalPlannerAi()`);
    report.stage82.offline = {
      statusMessage: offlineSnap.blueprint?.plannerAi?.statusMessage ?? null,
      clearMessage: /not ready|Ollama|model selected/i.test(
        offlineSnap.blueprint?.plannerAi?.statusMessage ?? "",
      ),
      noDraft: !offlineSnap.blueprint?.plannerAi?.saved,
      plannerPromptStillExists: Boolean(offlineSnap.blueprint?.plannerPrompt?.markdown),
    };
  }

  const planningBefore = listPlanningFilesOnDisk();
  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(COMPLETE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 500));
  let snap = await evaluate(`window.nttc.getSnapshot()`);
  const needsOverwrite = (snap.blueprint?.pendingOverwriteFiles?.length ?? 0) > 0;
  await evaluate(`window.nttc.saveBlueprintPlanningDocuments(${needsOverwrite ? "true" : "false"})`);
  await new Promise((r) => setTimeout(r, 800));
  snap = await evaluate(`window.nttc.getSnapshot()`);
  if (snap.blueprint?.pendingOverwriteFiles?.length > 0 && !snap.blueprint?.planningDocsLastSaved) {
    await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
    await new Promise((r) => setTimeout(r, 800));
    snap = await evaluate(`window.nttc.getSnapshot()`);
  }
  const planningAfter = listPlanningFilesOnDisk();
  report.planningExport = {
    saved: Boolean(snap.blueprint?.planningDocsLastSaved),
    onlyApproved:
      planningAfter.length === 0 ||
      planningAfter.every((f) => PLANNING_FILES.includes(f)),
    underNttcPlanning: planningAfter.every((f) =>
      fs.existsSync(path.join(PLANNING_DIR, f)),
    ),
    noNewOutsideNttc: !fs.existsSync(path.join(PROJECT, "src", "stage83-artifact.ts")),
  };

  const marker = {
    idea: SAMPLE_IDEA.slice(0, 40),
    draftId: snap.blueprint?.plannerAi?.saved?.id ?? null,
    importedAt: snap.blueprint?.importedBlueprint?.importedAt ?? null,
  };
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  const restored = await evaluate(`window.nttc.getSnapshot()`);
  const rb = restored.blueprint;
  report.historyRestore = {
    ideaRestored: rb?.intake?.projectIdea?.includes("recipe manager"),
    questionsRestored: Boolean(rb?.plannerQuestions?.markdown),
    promptRestored: Boolean(rb?.plannerPrompt?.markdown),
    localDraftRestored: Boolean(rb?.plannerAi?.saved?.responseText),
    importedRestored: Boolean(rb?.importedBlueprint?.blueprintText),
    completenessRestored: Boolean(rb?.completenessReport),
    previewRestored: Boolean(rb?.planningDocsPreview?.files?.length),
    exportRestored: Boolean(rb?.planningDocsLastSaved),
    marker,
  };

  await clickTab(evaluate, "Guide");
  const guideText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  await clickTab(evaluate, "Settings / Advanced");
  await new Promise((r) => setTimeout(r, 600));
  const settingsText = await evaluate(`document.body.innerText`);

  report.regressions.panels = {
    workflowProgress: /Workflow Progress/i.test(reportsText),
    workflowHealth: /Workflow Health/i.test(reportsText),
    handoffReadiness: /Handoff Readiness/i.test(reportsText),
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
    roleModelMapping: /Role Model Mapping/i.test(settingsText),
    blueprintPlannerRole: /Blueprint Planner/i.test(settingsText),
    guideLocalPlanner: /Ask Local Planner AI/i.test(guideText),
    guideBlueprint: /Blueprint tab/i.test(guideText),
  };

  ws.close();

  if (report.usesVite) fail("Packaged app uses Vite/dev URL");
  if (!uiCheck.panel) fail("Blueprint panel missing");
  if (!uiCheck.askBtn) fail("Ask Local Planner AI button missing");
  if (!uiCheck.helper) fail("Local planner helper text missing");
  if (!report.stage82.emptyIdea.blocked) fail("Empty idea did not block");
  if (!report.stage82.confirmationGate.confirmShown) fail("Confirmation gate text incomplete");
  if (!report.stage82.confirmationGate.noDraftAfterCancel) fail("Cancel still created draft");
  if (ollamaReady && report.stage82.liveOllama?.completed) {
    if (!report.stage82.liveOllama.dataBoundaryLog) warn("Data boundary log not found");
    if (!report.stage82.saveDraftAsBlueprint?.imported) fail("Save Local Draft as Blueprint failed");
    if (!["local-planner-ai", "ollama"].includes(report.stage82.saveDraftAsBlueprint?.source)) {
      fail("Saved blueprint source not Local Planner AI/Ollama");
    }
  } else if (!ollamaReady) {
    if (!report.stage82.offline?.clearMessage) fail("Offline message unclear");
  }
  if (!report.planningExport.onlyApproved) fail("Non-approved planning files written");
  if (!report.historyRestore.ideaRestored) fail("History restore: idea missing");
  if (report.stage82.liveOllama?.completed && !report.historyRestore.localDraftRestored) {
    fail("History restore: local planner draft missing");
  }
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
