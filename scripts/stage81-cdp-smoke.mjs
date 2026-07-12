/**
 * Stage 81 packaged-app smoke harness (CDP).
 * Stage 80 Blueprint Planner + Stage 78–79 regressions.
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
const PLANNING_DIR = path.join(PROJECT, ".nttc", "planning");

const PROJECT_TYPES = [
  "Desktop app",
  "Web app",
  "Game",
  "Automation tool",
  "Data tool",
  "Writing/publishing tool",
  "Business/internal tool",
  "Unknown / decide later",
];
const TARGET_USERS = [
  "Just me",
  "Small team",
  "Public users",
  "Client/customer",
  "Family/friend",
  "Unknown",
];
const TECH_COMFORT = ["Non-coder", "Beginner", "Intermediate", "Developer"];
const BUILD_STYLES = [
  "Safe phased build",
  "Fast prototype",
  "Small-model friendly",
  "Production-minded",
  "Unknown",
];
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
const PROMPT_RULES = [
  "Do not write source code yet",
  "Do not scaffold files yet",
  "Do not install packages",
  "Do not assume hidden file access",
  "Create planning documents and a phase-by-phase build plan only",
];
const PHASE1_SECTIONS = [
  "## Goal",
  "## Context",
  "## What to Build First",
  "## What Not to Build Yet",
  "## Suggested Files / Modules",
  "## Safety Boundaries",
  "## Small-Model Friendly Architecture",
  "## Validation Required",
  "## Report Back Format",
  "## Open Questions",
];

const SAMPLE_IDEA =
  "Offline warehouse inventory tracker with search, low-stock warnings, and local saves.";

const COMPLETE_BLUEPRINT = `# Project Blueprint

## Project Brief
Simple offline inventory tracker for a small warehouse.

## Product Requirements
Track products, quantities, and storage locations.

## User Stories
As a warehouse worker I want to search products quickly.

## Feature Roadmap
Phase 1: add/list/search. Phase 2: import/export.

## Data Model
Product id, name, quantity, location.

## Screen / Workflow Flow
Home list, add form, search bar, settings.

## Architecture Plan
Local desktop app with local file storage.

## Suggested File / Module Plan
Small focused modules per screen and data layer.

## Build Phases
Phase 1: core list and save. Phase 2: import/export.

## Validation Plan
Manual smoke tests for add/search/save.

## Risks / Open Questions
Should we support barcodes later?

## AI Team Roles
Planner, builder, reviewer.

## Phase 1 Builder Handoff
Build list UI and local save only.

## Current Status
Planning complete — ready for Phase 1.
`;

const INCOMPLETE_BLUEPRINT = `# Project Blueprint

## Project Brief
Vague idea only.
`;

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage80: {},
  planningExport: {},
  historyRestore: {},
  regressions: {},
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
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
    if (btn) btn.click();
    return !!btn;
  })()`);
}

function listPlanningFilesOnDisk() {
  if (!fs.existsSync(PLANNING_DIR)) return [];
  return fs.readdirSync(PLANNING_DIR).filter((f) => f.endsWith(".md"));
}

try {
  const renderer = readRendererHaystack();
  report.stage80.bundle = {
    blueprintTab: renderer.includes("Blueprint") && renderer.includes("blueprint-planner"),
    buildFromIdea: renderer.includes("Build From Idea"),
    plannerQuestions: renderer.includes("Generate Planner Questions"),
    plannerPrompt: renderer.includes("Create Planner AI Prompt"),
    noLocalPlannerAi: !renderer.includes("Ask Local Planner AI"),
    planningExport: renderer.includes("Save Planning Documents"),
    phase1Handoff: renderer.includes("Generate Phase 1 Builder Handoff"),
    guideBlueprintMention: renderer.includes("Blueprint tab"),
    noApplyPatch: !renderer.includes("Apply Patch"),
  };
  for (const [key, ok] of Object.entries(report.stage80.bundle)) {
    if (key === "noLocalPlannerAi" || key === "noApplyPatch") {
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
    noLocalPlannerBtn: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /Ask Local Planner AI/i.test(b.textContent || ''))`,
    )),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));

  const blueprintTabVisible = await evaluate(`(() =>
    [...document.querySelectorAll('button,[role=tab]')].some((el) =>
      (el.textContent || '').trim() === 'Blueprint',
    ))()`);
  report.stage80.blueprintTabVisible = blueprintTabVisible;
  await clickTab(evaluate, "Blueprint");

  const formCheck = await evaluate(`(() => {
    const root = document.querySelector('[data-focus-id="blueprint-planner"]');
    const text = root ? root.innerText : '';
    const selects = root ? root.querySelectorAll('select').length : 0;
    return {
      buildFromIdea: /Build From Idea/i.test(text),
      projectIdea: !!root?.querySelector('textarea'),
      projectType: /Project type/i.test(text),
      targetUser: /Target user/i.test(text),
      technicalComfort: /Technical comfort/i.test(text),
      buildStyle: /Build style/i.test(text),
      constraints: /Constraints/i.test(text),
      answers: /Answers \\/ clarifications/i.test(text),
      selectCount: selects,
    };
  })()`);
  report.stage80.form = formCheck;

  const optionCheck = await evaluate(`(() => {
    const root = document.querySelector('[data-focus-id="blueprint-planner"]');
    const text = root ? root.innerText : '';
    const has = (labels) => labels.every((l) => text.includes(l));
    return {
      projectTypes: has(${JSON.stringify(PROJECT_TYPES)}),
      targetUsers: has(${JSON.stringify(TARGET_USERS)}),
      techComfort: has(${JSON.stringify(TECH_COMFORT)}),
      buildStyles: has(${JSON.stringify(BUILD_STYLES)}),
    };
  })()`);
  report.stage80.options = optionCheck;

  await evaluate(`window.nttc.setBlueprintIntake(${JSON.stringify({
    projectIdea: SAMPLE_IDEA,
    buildStyle: "small-model-friendly",
    answersClarifications: "Offline only. Windows desktop. No cloud.",
  })})`);
  await new Promise((r) => setTimeout(r, 400));

  const aiLogBeforeQuestions = (await evaluate(`window.nttc.getSnapshot()`)).actionLog
    .length;
  await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterQuestions = await evaluate(`window.nttc.getSnapshot()`);
  const questionsSnap = afterQuestions.blueprint;
  const questionsAi = newActionLogEntries(afterQuestions.actionLog, aiLogBeforeQuestions).some(
    (e) => /Ollama|Local AI response/i.test(e.message),
  );
  report.stage80.plannerQuestions = {
    generated: Boolean(questionsSnap?.plannerQuestions?.markdown),
    hasPurpose: questionsSnap?.plannerQuestions?.markdown?.includes("Purpose"),
    noAiCall: !questionsAi,
    logged: newActionLogEntries(afterQuestions.actionLog, aiLogBeforeQuestions).some((e) =>
      /planner questions generated/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.generateBlueprintPlannerPrompt()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterPrompt = await evaluate(`window.nttc.getSnapshot()`);
  const promptMd = afterPrompt.blueprint?.plannerPrompt?.markdown ?? "";
  report.stage80.plannerPrompt = {
    generated: Boolean(promptMd),
    rules: Object.fromEntries(
      PROMPT_RULES.map((r) => [r, promptMd.toLowerCase().includes(r.toLowerCase())]),
    ),
    copyable: promptMd.length > 200,
  };

  const pkgJsonMtimeBefore = fs.existsSync(path.join(PROJECT, "package.json"))
    ? fs.statSync(path.join(PROJECT, "package.json")).mtimeMs
    : null;
  const planningBefore = listPlanningFilesOnDisk();

  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(COMPLETE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterImport = await evaluate(`window.nttc.getSnapshot()`);
  report.stage80.importComplete = {
    imported: Boolean(afterImport.blueprint?.importedBlueprint),
    sectionsPresent:
      (afterImport.blueprint?.importedBlueprint?.sectionsPresent?.length ?? 0) > 5,
    metadata: Boolean(afterImport.blueprint?.importedBlueprint?.ideaSummary),
  };

  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterComplete = await evaluate(`window.nttc.getSnapshot()`);
  const cr = afterComplete.blueprint?.completenessReport;
  report.stage80.completenessComplete = {
    hasReport: Boolean(cr),
    presentCount: cr?.presentSections?.length ?? 0,
    missingCount: cr?.missingSections?.length ?? 0,
    readiness: cr?.readiness ?? null,
  };

  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(INCOMPLETE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterIncomplete = await evaluate(`window.nttc.getSnapshot()`);
  const incReadiness = afterIncomplete.blueprint?.completenessReport?.readiness;
  report.stage80.completenessIncomplete = {
    readiness: incReadiness,
    ok:
      incReadiness === "not-ready" || incReadiness === "needs-clarification",
  };

  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(COMPLETE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await new Promise((r) => setTimeout(r, 500));

  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterPreview = await evaluate(`window.nttc.getSnapshot()`);
  const previewFiles =
    afterPreview.blueprint?.planningDocsPreview?.files?.map((f) => f.fileName) ?? [];
  const planningAfterPreview = listPlanningFilesOnDisk();
  report.stage80.preview = {
    fileCount: previewFiles.length,
    allFilesListed: PLANNING_FILES.every((f) => previewFiles.includes(f)),
    noDiskWrite: planningAfterPreview.length === planningBefore.length,
    pkgUnchanged: pkgJsonMtimeBefore === fs.statSync(path.join(PROJECT, "package.json")).mtimeMs,
  };

  const needsOverwrite = (afterPreview.blueprint?.pendingOverwriteFiles?.length ?? 0) > 0;
  await evaluate(`window.nttc.saveBlueprintPlanningDocuments(${needsOverwrite ? "true" : "false"})`);
  await new Promise((r) => setTimeout(r, 800));
  let afterSave = await evaluate(`window.nttc.getSnapshot()`);
  if (
    afterSave.blueprint?.pendingOverwriteFiles?.length > 0 &&
    !afterSave.blueprint?.planningDocsLastSaved
  ) {
    await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
    await new Promise((r) => setTimeout(r, 800));
    afterSave = await evaluate(`window.nttc.getSnapshot()`);
  }
  const planningAfterSave = listPlanningFilesOnDisk();
  const onlyPlanningMd =
    planningAfterSave.length > 0 &&
    planningAfterSave.every((f) => PLANNING_FILES.includes(f));
  const writtenUnderPlanning = planningAfterSave.every((f) =>
    fs.existsSync(path.join(PLANNING_DIR, f)),
  );
  report.planningExport = {
    saved: Boolean(afterSave.blueprint?.planningDocsLastSaved),
    filesOnDisk: planningAfterSave,
    onlyApprovedFiles: onlyPlanningMd,
    underNttcPlanning: writtenUnderPlanning,
    overwriteFlow: needsOverwrite,
    pkgUnchanged:
      pkgJsonMtimeBefore === fs.statSync(path.join(PROJECT, "package.json")).mtimeMs,
    noSourceOutsideNttc: !fs.existsSync(
      path.join(PROJECT, "src", "blueprint-smoke-artifact.ts"),
    ),
  };

  await evaluate(`window.nttc.generateBlueprintPhase1Handoff()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterPhase1 = await evaluate(`window.nttc.getSnapshot()`);
  const phase1Md = afterPhase1.blueprint?.phase1Handoff?.markdown ?? "";
  report.stage80.phase1 = {
    generated: Boolean(phase1Md),
    sections: Object.fromEntries(
      PHASE1_SECTIONS.map((s) => [s, phase1Md.includes(s)]),
    ),
    textOnly: Boolean(phase1Md) && !fs.existsSync(path.join(PROJECT, "src", "phase1-scaffold")),
  };

  const marker = {
    idea: SAMPLE_IDEA,
    importedAt: afterPhase1.blueprint?.importedBlueprint?.importedAt,
    phase1At: afterPhase1.blueprint?.phase1Handoff?.generatedAt,
    exportedAt: afterPhase1.blueprint?.planningDocsLastSaved?.savedAt,
  };
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));
  const restored = await evaluate(`window.nttc.getSnapshot()`);
  const rb = restored.blueprint;
  report.historyRestore = {
    ideaRestored: rb?.intake?.projectIdea?.includes("inventory"),
    questionsRestored: Boolean(rb?.plannerQuestions?.markdown),
    promptRestored: Boolean(rb?.plannerPrompt?.markdown),
    importedRestored: Boolean(rb?.importedBlueprint?.blueprintText?.includes("Project Blueprint")),
    completenessRestored: Boolean(rb?.completenessReport?.markdownReport),
    previewRestored: Boolean(rb?.planningDocsPreview?.files?.length),
    exportRestored: Boolean(rb?.planningDocsLastSaved?.savedAt),
    phase1Restored: Boolean(rb?.phase1Handoff?.markdown?.includes("Phase 1")),
    marker,
  };

  await clickTab(evaluate, "Dashboard");
  const dashText = await evaluate(`document.body.innerText`);
  report.stage80.dashboard = {
    recommendedNext: /Recommended Next Step/i.test(dashText),
    blueprintPathHint:
      /Blueprint|Import Project Blueprint|planning/i.test(dashText) ||
      restored.blueprint?.status?.ideaExists,
  };

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.stage80.workflow = {
    workflowProgress: /Workflow Progress/i.test(reportsText),
    blueprintStepsWhenIdea:
      /Blueprint Idea|Blueprint Imported|Planning Docs/i.test(reportsText) ||
      restored.blueprint?.status?.ideaExists,
  };

  await clickTab(evaluate, "Guide");
  const guideText = await evaluate(`document.body.innerText`);
  report.stage80.guide = {
    blueprintMention: /Blueprint tab/i.test(guideText),
  };

  await clickTab(evaluate, "Reports");
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
    builderPlanComparison: /Builder Plan Comparison/i.test(reportsText),
    implementationReview: /Implementation Review/i.test(reportsText),
    roleModelMapping: /Role Model Mapping/i.test(settingsText),
    speakerScripts: /Speaker Scripts/i.test(aiText),
    planningStyle: /Planning Style/i.test(settingsText),
    guideTab: /Quick Start Guide/i.test(guideText),
  };

  ws.close();

  if (report.usesVite) fail("Packaged app uses Vite/dev URL");
  if (!blueprintTabVisible) fail("Blueprint tab not visible");
  if (!formCheck.buildFromIdea) fail("Build From Idea section missing");
  for (const [k, v] of Object.entries(optionCheck)) {
    if (!v) fail(`Dropdown options missing: ${k}`);
  }
  if (!report.stage80.plannerQuestions.generated) fail("Planner questions not generated");
  if (report.stage80.plannerQuestions.noAiCall === false) fail("Planner questions triggered AI");
  for (const [rule, ok] of Object.entries(report.stage80.plannerPrompt.rules)) {
    if (!ok) fail(`Planner prompt missing rule: ${rule}`);
  }
  if (!report.stage80.importComplete.imported) fail("Blueprint import failed");
  if (!report.stage80.completenessComplete.hasReport) fail("Completeness report missing");
  if (!report.stage80.completenessIncomplete.ok) fail("Incomplete blueprint readiness wrong");
  if (!report.stage80.preview.allFilesListed) fail("Planning preview missing files");
  if (!report.stage80.preview.noDiskWrite) fail("Preview wrote files to disk");
  if (!report.planningExport.saved) fail("Planning docs export not saved");
  if (!report.planningExport.onlyApprovedFiles) fail("Non-approved files written");
  if (!report.planningExport.pkgUnchanged) fail("Source files changed during export");
  if (!report.stage80.phase1.generated) fail("Phase 1 handoff not generated");
  for (const [sec, ok] of Object.entries(report.stage80.phase1.sections)) {
    if (!ok) fail(`Phase 1 handoff missing: ${sec}`);
  }
  if (!report.historyRestore.ideaRestored) fail("Blueprint intake not restored");
  if (!report.historyRestore.importedRestored) fail("Imported blueprint not restored");
  if (!report.historyRestore.phase1Restored) fail("Phase 1 handoff not restored");
  if (!report.stage80.guide.blueprintMention) fail("Guide missing Blueprint mention");
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
