/**
 * Stage 84: Local Planner AI smaller-model end-to-end QA (CDP).
 *
 * Prereq: launch packaged app with CDP:
 *   release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9239
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";
const PLANNING_DIR = path.join(PROJECT, ".nttc", "planning");
const QA_MODEL = "qwen2.5-coder:7b";

const IDEA =
  "I want to build a simple offline recipe manager for Windows. It should store recipes locally, allow search, tags, ingredients, meal planning, and export. I am a non-coder and want it built in small safe phases.";

const CONSTRAINTS =
  "Offline only. Windows first. No login. No cloud. Local saves. Simple UI. Build in small phases. Do not add features beyond the first useful version.";

const ANSWERS =
  "MVP should include recipe list, add/edit recipe, tags, search, and local JSON save. Meal planning and export can be later phases.";

const PROMPT_RULES = [
  "Do not write source code yet",
  "Do not scaffold files yet",
  "Do not install packages",
  "Do not assume hidden file access",
  "Create planning documents and a phase-by-phase build plan only",
];

const REQUIRED_SECTIONS = [
  "Project Brief",
  "Product Requirements",
  "User Stories",
  "Feature Roadmap",
  "Data Model",
  "Build Phases",
  "Phase 1 Builder Handoff",
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

const report = {
  projectPath: PROJECT,
  qaModel: QA_MODEL,
  failures: [],
  warnings: [],
  pass: false,
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function warn(msg) {
  report.warnings.push(msg);
}

function fingerprintProject() {
  const out = {
    planningExists: fs.existsSync(PLANNING_DIR),
    planningFiles: fs.existsSync(PLANNING_DIR)
      ? fs.readdirSync(PLANNING_DIR).filter((f) => f.endsWith(".md"))
      : [],
    packageJsonMtime: null,
    srcFiles: {},
    scaffoldArtifacts: {
      stage84Artifact: fs.existsSync(path.join(PROJECT, "src", "stage84-artifact.ts")),
      blueprintSmoke: fs.existsSync(path.join(PROJECT, "src", "blueprint-smoke-artifact.ts")),
      phase1Scaffold: fs.existsSync(path.join(PROJECT, "src", "phase1-scaffold")),
    },
  };
  const pkg = path.join(PROJECT, "package.json");
  if (fs.existsSync(pkg)) out.packageJsonMtime = fs.statSync(pkg).mtimeMs;
  const src = path.join(PROJECT, "src");
  if (fs.existsSync(src)) {
    for (const name of fs.readdirSync(src)) {
      const full = path.join(src, name);
      if (fs.statSync(full).isFile()) out.srcFiles[name] = fs.statSync(full).mtimeMs;
    }
  }
  return out;
}

function listPlanningOnDisk() {
  if (!fs.existsSync(PLANNING_DIR)) return [];
  return fs.readdirSync(PLANNING_DIR).filter((f) => f.endsWith(".md"));
}

function newActionLogEntries(entries, beforeLen) {
  const list = entries ?? [];
  const added = list.length - beforeLen;
  return added > 0 ? list.slice(0, added) : [];
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
      (el.textContent || '').trim() === ${JSON.stringify(label)},
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

async function waitForDraft(evaluate, timeoutMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await evaluate(`window.nttc.getSnapshot()`);
    if (snap.blueprint?.plannerAi?.saved?.responseText) return snap;
    if (
      !snap.blueprint?.plannerAi?.busy &&
      /failed|timed out|blocked|empty|not ready/i.test(
        snap.blueprint?.plannerAi?.statusMessage ?? "",
      )
    ) {
      return snap;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return evaluate(`window.nttc.getSnapshot()`);
}

async function relaunchApp() {
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2500));
  spawn(EXE, ["--remote-debugging-port=9239"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 6000));
  return connect();
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");
  if (!fs.existsSync(PROJECT)) fail(`Project path missing: ${PROJECT}`);

  report.before = fingerprintProject();

  let { evaluate, ws, page } = await connect();
  report.launch = { pageUrl: page.url, usesVite: /5173|vite/i.test(page.url || "") };

  await evaluate(`window.nttc.refreshInstalledModels()`);
  await new Promise((r) => setTimeout(r, 2500));
  const afterRefresh = await evaluate(`window.nttc.getSnapshot()`);
  report.modelMapping = {
    refreshOk: afterRefresh.installedModels?.lastRefreshOk,
    modelCount: afterRefresh.installedModels?.models?.length ?? 0,
    modelInList: (afterRefresh.installedModels?.models ?? []).some(
      (m) => m.name === QA_MODEL || m.name?.startsWith(`${QA_MODEL}:`),
    ),
  };

  await evaluate(
    `window.nttc.setRoleModelMapping("blueprint-planner", ${JSON.stringify(QA_MODEL)})`,
  );
  await new Promise((r) => setTimeout(r, 400));
  await evaluate(`window.nttc.testProviderConnection()`);
  await new Promise((r) => setTimeout(r, 2500));

  let snap = await evaluate(`window.nttc.getSnapshot()`);
  report.ollama = {
    connected: snap.provider?.connected,
    state: snap.provider?.connectionState,
    message: snap.provider?.message,
    bubble: snap.ollamaStatus?.status,
    blueprintPlannerMapping: snap.roleModelMapping?.mappings?.["blueprint-planner"],
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));
  await clickTab(evaluate, "Blueprint");

  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: IDEA,
      projectType: "desktop-app",
      targetUser: "just-me",
      technicalComfort: "non-coder",
      buildStyle: "small-model-friendly",
      constraints: CONSTRAINTS,
      answersClarifications: ANSWERS,
    })})`,
  );
  await new Promise((r) => setTimeout(r, 500));

  const logBeforeQuestions = snap.actionLog?.length ?? 0;
  await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
  await new Promise((r) => setTimeout(r, 600));
  snap = await evaluate(`window.nttc.getSnapshot()`);
  const qLog = newActionLogEntries(snap.actionLog, logBeforeQuestions);
  const qMd = snap.blueprint?.plannerQuestions?.markdown ?? "";
  report.plannerQuestions = {
    generated: Boolean(qMd),
    hasPurpose: qMd.includes("Purpose"),
    noAiCall: !qLog.some((e) => /Local Planner AI started|Code AI request started/i.test(e.message)),
    logged: qLog.some((e) => /planner questions generated/i.test(e.message)),
  };

  await evaluate(`window.nttc.generateBlueprintPlannerPrompt()`);
  await new Promise((r) => setTimeout(r, 600));
  snap = await evaluate(`window.nttc.getSnapshot()`);
  const pMd = snap.blueprint?.plannerPrompt?.markdown ?? "";
  report.plannerPrompt = {
    generated: Boolean(pMd),
    rules: Object.fromEntries(
      PROMPT_RULES.map((r) => [r, pMd.toLowerCase().includes(r.toLowerCase())]),
    ),
    requiredSections: Object.fromEntries(
      REQUIRED_SECTIONS.map((s) => [s, pMd.includes(s)]),
    ),
    smallModelGuidance:
      /small-model|small model|focused modules/i.test(pMd) ||
      snap.planningStyle?.style === "small-model-friendly",
    copyable: pMd.length > 200,
  };

  await evaluate(`(() => {
    window.__confirmCalls = [];
    window.__confirmResult = false;
    window.confirm = (m) => { window.__confirmCalls.push(m); return window.__confirmResult; };
  })()`);
  const logBeforeCancel = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
  await clickActionButton(evaluate, "Ask Local Planner AI");
  await new Promise((r) => setTimeout(r, 800));
  snap = await evaluate(`window.nttc.getSnapshot()`);
  const cancelLog = newActionLogEntries(snap.actionLog, logBeforeCancel);
  const confirmText = (await evaluate(`window.__confirmCalls`))?.[0] ?? "";
  report.confirmationGate = {
    confirmShown: CONFIRM_SNIPPETS.every((s) => confirmText.includes(s)),
    confirmSample: confirmText.slice(0, 280),
    cancelledLog: cancelLog.some((e) => /Local Planner AI cancelled/i.test(e.message)),
    noDraftAfterCancel: !snap.blueprint?.plannerAi?.saved,
    notBusyAfterCancel: !snap.blueprint?.plannerAi?.busy,
  };

  await evaluate(`(() => { window.__confirmResult = true; })()`);
  const planningBeforeAi = listPlanningOnDisk();
  const logBeforeAi = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
  const aiStart = Date.now();
  await clickActionButton(evaluate, "Ask Local Planner AI");
  const progressSeen = await evaluate(
    `(() => /Working…|Blueprint Planner is working|1–2\\+ minutes/i.test(document.body.innerText))()`,
  );
  snap = await waitForDraft(evaluate, 300000);
  const elapsedMs = Date.now() - aiStart;
  const draft = snap.blueprint?.plannerAi?.saved;
  const aiLog = newActionLogEntries(snap.actionLog, logBeforeAi);
  const timedOut = /timed out|timeout/i.test(snap.blueprint?.plannerAi?.statusMessage ?? "");

  report.livePlannerAi = {
    progressSeen,
    completed: Boolean(draft?.responseText),
    timedOut,
    elapsedMs,
    elapsedSec: Math.round(elapsedMs / 1000),
    model: draft?.modelName ?? snap.blueprint?.plannerAi?.statusMessage?.match(/model ([^ ]+)/)?.[1] ?? QA_MODEL,
    modelUsed: draft?.modelName ?? null,
    baseUrl: draft?.baseUrl ?? snap.provider?.baseUrl,
    outputChars: draft?.responseText?.length ?? 0,
    sectionsPresent: draft?.sectionsPresent ?? [],
    sectionsMissing: draft?.sectionsMissing ?? [],
    readiness: draft?.readinessEstimate ?? null,
    truncated: draft?.truncatedResponse ?? false,
    status: snap.blueprint?.plannerAi?.statusMessage ?? null,
    bubbleAfter: snap.ollamaStatus?.status,
    startedLog: aiLog.some((e) => /Local Planner AI started/i.test(e.message)),
    completedLog: aiLog.some((e) => /Local Planner AI completed/i.test(e.message)),
    boundaryLog: aiLog.some((e) =>
      /idea\/planning fields only/i.test(`${e.message} ${e.detail ?? ""}`),
    ),
    notAutoImportedBeforeSave: !snap.blueprint?.importedBlueprint?.savedAsImportedBlueprint,
    noPlanningWriteDuringAi: listPlanningOnDisk().length === planningBeforeAi.length,
  };

  if (!draft?.responseText) {
    fail("Local Planner AI did not return a draft");
  } else {
    const beforeSaveImport = Boolean(snap.blueprint?.importedBlueprint);
    await evaluate(`window.nttc.recordCopyBlueprintPlannerAiDraft()`);
    await new Promise((r) => setTimeout(r, 400));
    snap = await evaluate(`window.nttc.getSnapshot()`);
    report.copyDraft = {
      copyLogged: newActionLogEntries(snap.actionLog, logBeforeAi).some((e) =>
        /Local Planner Blueprint copied/i.test(e.message),
      ) || snap.actionLog?.some((e) => /Local Planner Blueprint copied/i.test(e.message)),
      draftStillExists: Boolean(snap.blueprint?.plannerAi?.saved),
      notAutoImported: !beforeSaveImport || snap.blueprint?.importedBlueprint?.source !== "local-planner-ai",
    };

    await evaluate(`window.nttc.saveBlueprintPlannerDraftAsImported()`);
    await new Promise((r) => setTimeout(r, 700));
    snap = await evaluate(`window.nttc.getSnapshot()`);
    report.saveDraftAsBlueprint = {
      imported: Boolean(snap.blueprint?.importedBlueprint),
      source: snap.blueprint?.importedBlueprint?.source ?? null,
      savedFlag: snap.blueprint?.plannerAi?.saved?.savedAsImportedBlueprint ?? false,
      saveLogged: snap.actionLog?.some((e) =>
        /Local Planner Draft saved as Blueprint/i.test(e.message),
      ),
      draftStillAvailable: Boolean(snap.blueprint?.plannerAi?.saved),
    };

    await evaluate(`window.nttc.checkBlueprintCompleteness()`);
    await new Promise((r) => setTimeout(r, 600));
    snap = await evaluate(`window.nttc.getSnapshot()`);
    const cr = snap.blueprint?.completenessReport;
    report.completeness = {
      hasReport: Boolean(cr),
      readiness: cr?.readiness ?? null,
      presentCount: cr?.presentSections?.length ?? 0,
      missingCount: cr?.missingSections?.length ?? 0,
      missing: cr?.missingSections ?? [],
    };

    const planningBeforePreview = listPlanningOnDisk();
    await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
    await new Promise((r) => setTimeout(r, 600));
    snap = await evaluate(`window.nttc.getSnapshot()`);
    const previewFiles =
      snap.blueprint?.planningDocsPreview?.files?.map((f) => f.fileName) ?? [];
    report.planningPreview = {
      fileCount: previewFiles.length,
      listsNttcPlanning: previewFiles.every((f) => PLANNING_FILES.includes(f)),
      noDiskWrite: listPlanningOnDisk().length === planningBeforePreview.length,
    };

    await evaluate(`window.nttc.generateBlueprintPhase1Handoff()`);
    await new Promise((r) => setTimeout(r, 600));
    snap = await evaluate(`window.nttc.getSnapshot()`);
    const phase1Md = snap.blueprint?.phase1Handoff?.markdown ?? "";
    report.phase1Handoff = {
      generated: Boolean(phase1Md),
      sections: Object.fromEntries(PHASE1_SECTIONS.map((s) => [s, phase1Md.includes(s)])),
      textOnly: !fs.existsSync(path.join(PROJECT, "src", "phase1-scaffold")),
    };

    const needsOverwrite = (snap.blueprint?.pendingOverwriteFiles?.length ?? 0) > 0;
    await evaluate(
      `window.nttc.saveBlueprintPlanningDocuments(${needsOverwrite ? "true" : "false"})`,
    );
    await new Promise((r) => setTimeout(r, 800));
    snap = await evaluate(`window.nttc.getSnapshot()`);
    if (
      snap.blueprint?.pendingOverwriteFiles?.length > 0 &&
      !snap.blueprint?.planningDocsLastSaved
    ) {
      await evaluate(`window.nttc.saveBlueprintPlanningDocuments(true)`);
      await new Promise((r) => setTimeout(r, 800));
      snap = await evaluate(`window.nttc.getSnapshot()`);
    }
    const planningAfterExport = listPlanningOnDisk();
    report.planningExport = {
      saved: Boolean(snap.blueprint?.planningDocsLastSaved),
      filesOnDisk: planningAfterExport,
      onlyApproved:
        planningAfterExport.length === 0 ||
        planningAfterExport.every((f) => PLANNING_FILES.includes(f)),
      underNttcPlanning: planningAfterExport.every((f) =>
        fs.existsSync(path.join(PLANNING_DIR, f)),
      ),
      overwriteFlow: needsOverwrite,
    };

    const marker = {
      idea: IDEA.slice(0, 48),
      draftId: snap.blueprint?.plannerAi?.saved?.id,
      importedAt: snap.blueprint?.importedBlueprint?.importedAt,
      phase1At: snap.blueprint?.phase1Handoff?.generatedAt,
      mapping: snap.roleModelMapping?.mappings?.["blueprint-planner"],
    };
    await evaluate(`window.nttc.saveSessionHistory()`);
    await new Promise((r) => setTimeout(r, 500));
    ws.close();

    ({ evaluate, ws, page } = await relaunchApp());
    await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
    await new Promise((r) => setTimeout(r, 1800));
    snap = await evaluate(`window.nttc.getSnapshot()`);
    const rb = snap.blueprint;
    report.historyRestore = {
      ideaRestored: rb?.intake?.projectIdea?.includes("recipe manager"),
      projectType: rb?.intake?.projectType,
      targetUser: rb?.intake?.targetUser,
      questionsRestored: Boolean(rb?.plannerQuestions?.markdown),
      promptRestored: Boolean(rb?.plannerPrompt?.markdown),
      localDraftRestored: Boolean(rb?.plannerAi?.saved?.responseText),
      importedRestored: Boolean(rb?.importedBlueprint?.blueprintText),
      sourceRestored: rb?.importedBlueprint?.source ?? null,
      completenessRestored: Boolean(rb?.completenessReport),
      previewRestored: Boolean(rb?.planningDocsPreview?.files?.length),
      exportRestored: Boolean(rb?.planningDocsLastSaved),
      phase1Restored: Boolean(rb?.phase1Handoff?.markdown),
      mappingRestored: snap.roleModelMapping?.mappings?.["blueprint-planner"],
      marker,
    };

    await clickTab(evaluate, "Guide");
    const guideText = await evaluate(`document.body.innerText`);
    await clickTab(evaluate, "Reports");
    const reportsText = await evaluate(`document.body.innerText`);
    await clickTab(evaluate, "AI Review");
    const aiText = await evaluate(`document.body.innerText`);
    const headerText = await evaluate(`document.body.innerText.slice(0, 3000)`);

    report.regressions = {
      inspectOnly: /Inspect-only/i.test(headerText),
      liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
      ollamaBubble: /Ollama:/i.test(headerText),
      noApplyPatch: !(await evaluate(
        `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
      )),
      guide: /Quick Start Guide/i.test(guideText),
      workflowProgress: /Workflow Progress/i.test(reportsText),
      workflowHealth: /Workflow Health/i.test(reportsText),
      handoffReadiness: /Handoff Readiness/i.test(reportsText),
      codeContext: /Code Context Pack — Preview Only/i.test(reportsText),
      askCodeAi: /Ask Local AI About Selected Code/i.test(reportsText),
      patchDraft: /Patch Draft Mode — No Apply/i.test(reportsText),
      manualImport: /Manual Patch Draft Import/i.test(reportsText),
      safetyReview: /Patch Draft Safety Review/i.test(reportsText),
      comparison: /External Patch Draft Comparison/i.test(reportsText),
      builderHandoff: /Builder Handoff Export/i.test(reportsText),
      projectMemory: /Project Memory/i.test(reportsText),
      builderPlan: /Builder Plan Mode — Plan Only/i.test(aiText),
    };

    ws.close();
  }

  report.after = fingerprintProject();
  report.sourceSafety = {
    packageJsonUnchanged:
      report.before.packageJsonMtime === report.after.packageJsonMtime,
    srcFilesUnchanged:
      JSON.stringify(report.before.srcFiles) === JSON.stringify(report.after.srcFiles),
    noScaffoldArtifacts: !Object.values(report.after.scaffoldArtifacts).some(Boolean),
    planningOnlyUnderNttc:
      report.after.planningFiles.length === 0 ||
      report.after.planningFiles.every((f) => PLANNING_FILES.includes(f)),
  };

  report.dataBoundary = {
    sentOnlyIdeaFields: report.livePlannerAi?.boundaryLog ?? false,
    noCodeContextInLogs: !(await (async () => {
      const s = snap;
      return (s.actionLog ?? []).some((e) =>
        /Code Context Pack/i.test(`${e.message} ${e.detail ?? ""}`) &&
        /Local Planner AI started/i.test(e.message),
      );
    })()),
  };

  if (report.launch.usesVite) fail("Packaged app uses Vite");
  if (!report.modelMapping.modelInList) warn("QA model not in installed list after refresh");
  if (!report.ollama.connected) fail("Ollama not connected after test");
  if (!report.plannerQuestions.noAiCall) fail("Planner questions triggered AI");
  for (const [rule, ok] of Object.entries(report.plannerPrompt?.rules ?? {})) {
    if (!ok) fail(`Planner prompt missing rule: ${rule}`);
  }
  if (!report.confirmationGate.confirmShown) fail("Confirmation gate incomplete");
  if (!report.confirmationGate.noDraftAfterCancel) fail("Cancel created draft");
  if (!report.livePlannerAi?.completed) fail("Live planner did not complete");
  if (report.livePlannerAi?.timedOut) fail("Live planner timed out with smaller model");
  if (!report.saveDraftAsBlueprint?.imported) fail("Save draft as blueprint failed");
  if (!["local-planner-ai", "ollama"].includes(report.saveDraftAsBlueprint?.source ?? "")) {
    fail("Saved blueprint source not Local Planner AI/Ollama");
  }
  if (!report.completeness?.hasReport) fail("Completeness report missing");
  if (!report.planningPreview?.noDiskWrite) fail("Preview wrote planning files");
  if (!report.phase1Handoff?.generated) fail("Phase 1 handoff missing");
  if (!report.historyRestore?.localDraftRestored) fail("Local draft not restored");
  if (!report.historyRestore?.importedRestored) fail("Imported blueprint not restored");
  if (!report.sourceSafety.packageJsonUnchanged) fail("package.json changed");
  if (!report.sourceSafety.srcFilesUnchanged) fail("src files changed");

  report.pass = report.failures.length === 0;
  report.recommendedNextStage =
    report.pass
      ? "Stage 85 rebuild/pack validation or next planned feature stage"
      : "Fix blocking Local Planner AI issues before next feature stage";

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
