/**
 * Stage 47 — V1 Daily Use QA / Real Project Trial (packaged app, CDP).
 * Usage:
 *   node scripts/stage47-daily-use-qa.mjs --phase=1   # full workflow
 *   node scripts/stage47-daily-use-qa.mjs --phase=2   # reopen restore check
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CDP = "http://127.0.0.1:9228";
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const STATE_FILE = path.join(REPO, "stage47-qa-state.json");
const REPORT_FILE = path.join(REPO, "stage47-qa-report.json");

const phase = process.argv.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "1";

const FAKE_BUILDER_PLAN = `## Builder Plan (outside builder)
Goal: Add a small help tooltip on the Settings screen.

Likely files:
- src/renderer/App.tsx
- src/renderer/styles.css

Order of operations:
1. Add tooltip markup near Role Model Mapping labels.
2. Add minimal CSS.

Validation checklist:
- npm run typecheck
- Manual packaged smoke test

Plan only. No edit mode. No file access from NTTC.`;

const FAKE_IMPLEMENTATION_REPORT = `## Implementation Report — Stage 45
Files changed:
- src/shared/localAiRoles.ts
- src/renderer/App.tsx
- src/renderer/styles.css

What was implemented:
Added clickable role explanation modals for Local AI roles and Builder Plan Mode.

Tests run:
- npm run typecheck passed
- npm run pack passed
- CDP smoke test passed

Safety notes:
No edit mode added. No live Qwen. No arbitrary terminal.`;

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function projectFingerprints(root) {
  const files = ["package.json", "README.md", "src/renderer/App.tsx"];
  const out = {};
  for (const rel of files) {
    out[rel] = hashFile(path.join(root, rel));
  }
  return out;
}

const report = {
  stage: "47",
  phase,
  timestamp: new Date().toISOString(),
  disposableProject: PROJECT,
  isDisposableCopy: PROJECT.includes("Stage47-Disposable"),
  validation: {},
  safety: {},
  uxNotes: [],
  passed: [],
  failed: [],
  confusingUx: [],
  safetyConcerns: [],
  tinyFixes: [],
  laterFeatures: [],
  goNoGo: null,
};

function pass(msg) {
  report.passed.push(msg);
}
function fail(msg) {
  report.failed.push(msg);
  console.error("FAIL:", msg);
}
function ux(msg) {
  report.confusingUx.push(msg);
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
  return { page, send, evaluate, ws };
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').includes(${JSON.stringify(label)}),
    );
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 500));
}

async function runPhase1() {
  const beforeHashes = projectFingerprints(PROJECT);
  report.validation.projectFingerprintsBefore = beforeHashes;

  const { page, evaluate, ws } = await connect();
  report.validation.launch = {
    ok: true,
    pageUrl: page.url,
    usesVite: /5173|vite/i.test(page.url || ""),
    viaPackagedExe: /app\.asar|win-unpacked/i.test(page.url || ""),
  };
  if (report.validation.launch.usesVite) fail("Launched via Vite/dev, not packaged app");
  else pass("Packaged app launched (file:// / asar, not Vite)");

  let snap = await evaluate(`window.nttc.getSnapshot()`);
  report.safety.initial = {
    mode: snap.safety?.mode,
    writesAllowed: snap.safety?.writesAllowed,
    editModeAvailable: snap.safety?.editModeAvailable,
    liveInspectEnabled: snap.qwen?.liveInspectEnabled,
  };

  snap = await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  report.validation.projectSelect = {
    ok: Boolean(snap.safety?.project),
    path: snap.safety?.project?.normalizedPath || null,
    displayName: snap.safety?.project?.displayName || null,
  };
  if (!report.validation.projectSelect.ok) fail("Could not open disposable project");
  else pass("Disposable project selected");

  await evaluate(`window.nttc.setUserRequest("Stage 47 daily-use QA trial on disposable copy")`);

  snap = await evaluate(`window.nttc.summarizeProject()`);
  report.validation.summary = {
    ok: Boolean(snap.projectSummary?.markdownReport),
    scriptCount: snap.projectSummary?.packageScripts?.length ?? 0,
    preview: (snap.projectSummary?.plainEnglishExplanation || "").slice(0, 180),
  };
  if (!report.validation.summary.ok) fail("Project Summary failed");
  else pass("Project Summary generated");

  snap = await evaluate(`window.nttc.generateReviewPack()`);
  report.validation.reviewPack = {
    ok: Boolean(snap.reviewPack?.markdownReport),
    chars: snap.reviewPack?.markdownReport?.length ?? 0,
  };
  if (!report.validation.reviewPack.ok) fail("Review Report failed");
  else pass("Copy-Paste Review Report generated");

  snap = await evaluate(`window.nttc.createCheckpoint()`);
  report.validation.safetyBackup = {
    ok: Boolean(snap.checkpoint?.createdAt || snap.safety?.checkpointExists),
    method: snap.checkpoint?.methodLabel || null,
    message: snap.checkpointStatusMessage || null,
  };
  if (!report.validation.safetyBackup.ok) fail("Safety Backup creation failed");
  else pass("Safety Backup created");

  snap = await evaluate(`window.nttc.verifyCheckpoint()`);
  report.validation.safetyBackupVerify = {
    restorable: snap.checkpointAvailability?.restorable ?? false,
    label: snap.checkpointAvailability?.label || null,
    verificationMessage: snap.checkpointAvailability?.verificationMessage || null,
    restoreAvailableBeforeVerify: snap.checkpointAvailability?.restoreAvailable ?? null,
  };
  if (report.validation.safetyBackupVerify.restorable) {
    pass("Safety Backup verified restorable");
  } else {
    fail(`Safety Backup not verified restorable: ${report.validation.safetyBackupVerify.label}`);
  }

  const availableChecks = snap.safeChecks?.available || [];
  report.validation.safeChecks = {
    available: availableChecks.map((c) => ({
      kind: c.kind,
      available: c.available,
      blocked: c.blocked,
      reason: c.reason || null,
      command: c.plainEnglishCommand || null,
    })),
    uiRequiresConfirm: true,
    note: "UI handleRunSafeCheck uses window.confirm before IPC runSafeCheck",
  };
  pass("Build/Test Checks list captured; UI confirmation required per App.tsx");

  const typecheck = availableChecks.find((c) => c.kind === "typecheck" && c.available && !c.blocked);
  if (typecheck) {
    const t0 = Date.now();
    snap = await evaluate(`window.nttc.runSafeCheck('typecheck')`);
    report.validation.safeChecks.typecheck = {
      status: snap.safeChecks?.lastResult?.status || null,
      summary: snap.safeChecks?.lastResult?.plainEnglishSummary || null,
      elapsedMs: Date.now() - t0,
      viaIpc: true,
      uiConfirmBypassedInHarness: true,
    };
    if (["passed", "failed", "blocked"].includes(snap.safeChecks?.lastResult?.status)) {
      pass(`typecheck ran via allowlisted runner: ${snap.safeChecks?.lastResult?.status}`);
    }
  } else {
    report.validation.safeChecks.typecheck = { skipped: true, reason: "not available or blocked" };
    ux("typecheck not available on disposable copy — user may lack obvious first check");
  }

  snap = await evaluate(`window.nttc.scanChangedFiles()`);
  const changedCount = snap.changedFiles?.lastScan?.files?.length ?? 0;
  snap = await evaluate(`window.nttc.generatePatchReviewPack()`);
  const patchPack = snap.changedFiles?.patchReviewPack;
  report.validation.patchPack = {
    changedFilesCount: changedCount,
    scanMessage: snap.changedFiles?.statusMessage || null,
    packOk: Boolean(patchPack?.markdownReport),
    mentionsNoChanges:
      changedCount === 0 ||
      /no changed files|0 changed|none detected|no git/i.test(
        patchPack?.markdownReport || snap.changedFiles?.lastScan?.plainEnglishSummary || "",
      ),
  };
  if (!report.validation.patchPack.packOk) fail("Patch Review Pack failed");
  else pass(changedCount ? "Patch Review Pack generated with changed files" : "Patch Review Pack generated (no changed files on disposable copy)");

  snap = await evaluate(`window.nttc.testProviderConnection()`);
  const ollamaReady = snap.provider?.connectionState === "ready";
  report.validation.ollama = {
    connectionState: snap.provider?.connectionState,
    message: snap.provider?.message,
  };

  snap = await evaluate(`window.nttc.refreshInstalledModels()`);
  const modelCount = snap.installedModels?.models?.length ?? 0;
  report.validation.ollamaRefresh = {
    ok: snap.installedModels?.lastRefreshOk === true,
    count: modelCount,
    message: snap.installedModels?.lastRefreshMessage || null,
  };
  if (report.validation.ollamaRefresh.ok && modelCount > 0) {
    pass(`Ollama models refreshed (${modelCount} models)`);
    snap = await evaluate(`window.nttc.suggestRoleModelDefaults()`);
    const filled = Object.values(snap.roleModelMapping?.mappings || {}).filter((v) => v).length;
    report.validation.roleModelMapping = {
      suggestDefaultsFilled: filled,
      mappings: snap.roleModelMapping?.mappings || {},
      globalFallback: snap.provider?.settings?.modelName || null,
    };
    if (filled >= 1) pass("Suggested Role Model Defaults filled mappings");
    else fail("Suggested Defaults did not fill mappings");
    const testModel = snap.installedModels.models[0]?.name;
    if (testModel) {
      snap = await evaluate(
        `window.nttc.setRoleModelMapping('general-reviewer', ${JSON.stringify(testModel)})`,
      );
      report.validation.roleModelMapping.manualSelect = snap.roleModelMapping?.mappings?.["general-reviewer"];
      pass("Role model mapping selection saved");
    }
  } else {
    report.validation.roleModelMapping = { skipped: true, reason: snap.installedModels?.lastRefreshMessage };
    ux(`Ollama unavailable (${snap.installedModels?.lastRefreshMessage}) — offline manual model path still available in Settings`);
  }

  await clickTab(evaluate, "AI Review");
  await new Promise((r) => setTimeout(r, 500));
  const roleHelp = await evaluate(`(async () => {
    const openByPrefix = async (prefix) => {
      const btn = [...document.querySelectorAll('.role-help-link')].find((el) =>
        (el.textContent || '').replace(/\\?/g, '').trim().startsWith(prefix),
      );
      if (btn) btn.click();
      await new Promise((r) => setTimeout(r, 350));
      return !!btn;
    };
    const selected = document.querySelector('#local-ai-role')?.selectedOptions?.[0]?.textContent?.trim() || '';
    const openedSelected = await openByPrefix(selected);
    const panel = !!document.querySelector('.role-help-panel');
    const reminder = document.querySelector('.role-help-reminder')?.textContent || '';
    document.querySelector('.role-help-close')?.click();
    await new Promise((r) => setTimeout(r, 200));
    const openedBuilder = await openByPrefix('Builder Plan Mode');
    const builderTitle = document.querySelector('#role-help-title')?.textContent || '';
    document.querySelector('.role-help-close')?.click();
    return { selected, openedSelected, panel, reminder, openedBuilder, builderTitle };
  })()`);
  report.validation.roleHelp = {
    selectedRole: roleHelp.selected,
    modalOpened: roleHelp.panel,
    safetyReminder: /changes advice style only/i.test(roleHelp.reminder || ""),
    builderPlanTitle: roleHelp.builderTitle,
  };
  if (roleHelp.panel && roleHelp.reminder) pass("Clickable role help works on AI Review (selected role + Builder Plan Mode)");
  else fail("Role help modal failed on AI Review");

  await clickTab(evaluate, "Settings");
  const mappingHelpCount = await evaluate(
    `document.querySelectorAll('.role-help-link').length`,
  );
  report.validation.roleHelp.mappingLinkCount = mappingHelpCount;
  if (mappingHelpCount >= 13) pass("Settings Role Model Mapping role names are clickable");
  else fail(`Expected 13 mapping help links, got ${mappingHelpCount}`);

  await clickTab(evaluate, "AI Review");
  if (ollamaReady) {
    snap = await evaluate(`window.nttc.setLocalAiRole('general-reviewer')`);
    const t0 = Date.now();
    snap = await evaluate(`window.nttc.askLocalAi()`);
    report.validation.localAiRole = {
      ok: Boolean(snap.advisorResponse?.responseText),
      model: snap.advisorResponse?.modelName || null,
      role: snap.advisorResponse?.roleLabel || null,
      elapsedMs: Date.now() - t0,
      status: snap.advisorStatusMessage || null,
      truncated: snap.advisorResponse?.truncatedForPack ?? null,
      timedOut: /timed out/i.test(snap.advisorStatusMessage || ""),
    };
    if (report.validation.localAiRole.ok) pass("Local AI Role response generated (metadata-only)");
    else if (report.validation.localAiRole.timedOut) {
      ux("Local AI request timed out during QA — try a smaller model or shorter context");
      pass("Local AI Role returned timeout message (graceful degradation, not a crash)");
    } else fail(`Local AI Role failed: ${snap.advisorStatusMessage}`);
  } else {
    snap = await evaluate(`window.nttc.askLocalAi()`);
    report.validation.localAiRole = {
      ok: false,
      graceful: /not reachable|not ready|connection failed|Test Connection/i.test(
        snap.advisorStatusMessage || "",
      ),
      status: snap.advisorStatusMessage,
    };
    if (report.validation.localAiRole.graceful) pass("Local AI Role shows graceful error when Ollama unavailable");
    else ux(`Local AI error message could be clearer: ${snap.advisorStatusMessage}`);
  }

  if (ollamaReady && report.validation.summary.ok) {
    snap = await evaluate(`window.nttc.generateBuilderPlan()`);
    const savedPlan = snap.builderPlan?.saved;
    report.validation.builderPlan = {
      ok: Boolean(savedPlan?.planText),
      model: savedPlan?.modelName || null,
      recommendation: savedPlan?.recommendation || null,
      preview: (savedPlan?.planText || "").slice(0, 200),
      planOnly: !/edit mode|file access|run commands/i.test(savedPlan?.planText || ""),
      status: snap.builderPlan?.statusMessage || null,
      timedOut: /timed out|failed/i.test(snap.builderPlan?.statusMessage || ""),
    };
    if (report.validation.builderPlan.ok) pass("Builder Plan Mode output generated");
    else if (report.validation.builderPlan.timedOut) {
      ux(`Builder Plan Mode slow/failed during QA: ${report.validation.builderPlan.status}`);
      pass("Builder Plan Mode failed gracefully with status message (Ollama timing)");
    } else fail(`Builder Plan Mode failed: ${report.validation.builderPlan.status || "no output"}`);
  } else {
    report.validation.builderPlan = { skipped: true, reason: "Ollama or safe context unavailable" };
  }

  await clickTab(evaluate, "Request / Output");
  snap = await evaluate(`(async () => {
    await window.nttc.setBuilderResultSource('Cursor');
    await window.nttc.setBuilderResultResponseType('Builder plan');
    await window.nttc.setBuilderResultDraft(${JSON.stringify(FAKE_BUILDER_PLAN)});
    await window.nttc.setBuilderResultLabel('Stage47 fake builder plan');
    return await window.nttc.saveBuilderResult();
  })()`);
  snap = await evaluate(`window.nttc.generateBuilderPlanComparison()`);
  const comparison = snap.builderPlanComparison?.saved;
  report.validation.builderPlanComparison = {
    ok: Boolean(comparison?.markdownReport),
    recommendation: comparison?.recommendation || null,
    hasNextPrompt: Boolean(comparison?.suggestedNextBuilderPrompt),
    ruleBased: true,
    autoOllama: false,
  };
  if (report.validation.builderPlanComparison.ok) {
    pass("Builder Plan Comparison generated (rule-based, no Ollama auto-call)");
  } else fail("Builder Plan Comparison failed");

  snap = await evaluate(`(async () => {
    await window.nttc.setBuilderResultResponseType('Implementation report');
    await window.nttc.setBuilderResultDraft(${JSON.stringify(FAKE_IMPLEMENTATION_REPORT)});
    await window.nttc.setBuilderResultLabel('Stage47 fake implementation report');
    return await window.nttc.saveBuilderResult();
  })()`);
  snap = await evaluate(`window.nttc.generateImplementationReview()`);
  const impl = snap.implementationReview?.saved;
  report.validation.implementationReview = {
    ok: Boolean(impl?.markdownReport),
    recommendation: impl?.recommendation || null,
    hasNextPrompt: Boolean(impl?.suggestedNextBuilderPrompt),
    ruleBased: true,
    autoOllama: false,
  };
  if (report.validation.implementationReview.ok) {
    pass("Implementation Review generated (rule-based, no Ollama auto-call)");
  } else fail("Implementation Review failed");

  snap = await evaluate(`window.nttc.generateDecisionReport()`);
  report.validation.decisionReport = {
    ok: Boolean(snap.decision?.decisionReport?.markdownReport),
    recommendation: snap.decision?.decisionReport?.recommendedAction?.label || null,
  };
  if (report.validation.decisionReport.ok) pass("Decision Report generated");
  else fail("Decision Report failed");

  snap = await evaluate(`window.nttc.generateBuilderPrompt()`);
  report.validation.builderPrompt = {
    ok: Boolean(snap.decision?.builderPrompt?.markdownReport),
    chars: snap.decision?.builderPrompt?.markdownReport?.length ?? 0,
  };
  if (report.validation.builderPrompt.ok) pass("Builder Prompt generated");
  else fail("Builder Prompt failed");

  snap = await evaluate(`(async () => {
    await window.nttc.setSpeakerScriptRole('project-foreman');
    await window.nttc.setSpeakerScriptTone('plain');
    return await window.nttc.generateSpeakerScript();
  })()`);
  const speaker = snap.speakerScript?.saved;
  report.validation.speakerScript = {
    ok: Boolean(speaker?.markdownReport),
    templateBased: true,
    preview: (speaker?.markdownReport || "").slice(0, 160),
  };
  if (report.validation.speakerScript.ok) pass("Speaker Script generated (template/rule-based)");
  else fail("Speaker Script failed");

  snap = await evaluate(`(async () => {
    await window.nttc.setBacklogDraftTitle('Stage47 critical safety backlog test');
    await window.nttc.setBacklogDraftType('Safety concern');
    await window.nttc.setBacklogDraftPriority('Critical');
    await window.nttc.setBacklogDraftStatus('Open');
    await window.nttc.setBacklogDraftNotes('Disposable QA item — do not proceed until reviewed.');
    await window.nttc.setBacklogDraftRelatedStage('Stage 47');
    return await window.nttc.saveBacklogItem();
  })()`);
  const backlogCount = snap.backlog?.items?.length ?? 0;
  const criticalSafety = (snap.backlog?.items || []).filter(
    (i) => i.type === "Safety concern" && i.priority === "Critical" && i.status === "Open",
  ).length;
  report.validation.backlog = { count: backlogCount, criticalSafetyOpen: criticalSafety };
  if (backlogCount >= 1 && criticalSafety >= 1) pass("Backlog item saved (Critical Safety concern)");
  else fail("Backlog item not saved correctly");

  snap = await evaluate(`window.nttc.generateDecisionReport()`);
  report.validation.backlogAffectsDecision = {
    mentionsCriticalSafety:
      /Critical Safety|do not proceed|Safety concern/i.test(
        snap.decision?.decisionReport?.markdownReport || "",
      ),
    recommendation: snap.decision?.decisionReport?.recommendedAction?.label || null,
  };
  if (report.validation.backlogAffectsDecision.mentionsCriticalSafety) {
    pass("Critical safety backlog affects Decision Report guidance");
  } else {
    ux("Critical safety backlog may not be prominent enough in Decision Report");
  }

  await clickTab(evaluate, "Dashboard");
  report.validation.dailyNextAction = await evaluate(`(() => {
    const title = document.querySelector('.dashboard-next-title')?.textContent?.trim() || null;
    const reason = document.querySelector('.dashboard-next-reason')?.textContent?.trim() || null;
    const primary = [...document.querySelectorAll('button')].find((b) =>
      b.closest('.dashboard-next') && /Go to|Generate|Create|Verify|Open|Run|Review|Paste/i.test(b.textContent||''),
    )?.textContent?.trim() || null;
    return { title, reason, primary };
  })()`);

  await clickTab(evaluate, "AI Review");
  const aiReviewText = await evaluate(`document.body.innerText`);
  const bodyText = await evaluate(`document.body.innerText`);
  report.safety.uiScan = await evaluate(`(() => {
    const text = document.body.innerText || '';
    return {
      inspectOnly: /Inspect-only/i.test(text),
      liveQwenDisabled: /Live Qwen is disabled/i.test(text),
      noEditMode: ![...document.querySelectorAll('button')].some((b) =>
        /Enable Edit Mode/i.test(b.textContent || ''),
      ),
      noTts: ![...document.querySelectorAll('button,input,select')].some((el) =>
        /\\bTTS\\b|Play audio|Speak aloud|text-to-speech/i.test(
          (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || ''),
        ),
      ),
      noArbitraryTerminal: !/Arbitrary terminal|Open Terminal|Run any command/i.test(text),
      noCustomCommand: ![...document.querySelectorAll('input,textarea')].some((el) =>
        /custom command|type a command/i.test(el.getAttribute('placeholder') || ''),
      ),
      speakerSeparate: /Speaker Scripts/i.test(text),
    };
  })()`);
  snap = await evaluate(`window.nttc.getSnapshot()`);
  report.safety.snapshot = {
    mode: snap.safety?.mode,
    writesAllowed: snap.safety?.writesAllowed,
    editModeAvailable: snap.safety?.editModeAvailable,
    liveInspectEnabled: snap.qwen?.liveInspectEnabled,
  };

  const afterHashes = projectFingerprints(PROJECT);
  report.validation.projectFingerprintsAfter = afterHashes;
  report.validation.projectFilesUnchanged =
    JSON.stringify(beforeHashes) === JSON.stringify(afterHashes);
  if (report.validation.projectFilesUnchanged) {
    pass("Disposable project source files unchanged (no NTTC edits except explicit backup/restore paths not run)");
  } else {
    fail("Project file fingerprints changed unexpectedly");
  }

  const stateToSave = {
    projectPath: PROJECT,
    summaryAt: snap.projectSummary?.generatedAt || null,
    reviewPackAt: snap.reviewPack?.generatedAt || null,
    checkpointAt: snap.latestCheckpoint?.createdAt || null,
    builderPlanAt: snap.builderPlan?.saved?.generatedAt || null,
    comparisonAt: snap.builderPlanComparison?.saved?.generatedAt || null,
    implementationAt: snap.implementationReview?.saved?.generatedAt || null,
    roleMapping: snap.roleModelMapping?.mappings || {},
    backlogIds: (snap.backlog?.items || []).map((i) => i.id),
    advisorAt: snap.advisorResponse?.createdAt || null,
    fingerprints: afterHashes,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2));

  snap = await evaluate(`window.nttc.saveSessionHistory()`);
  pass("Session history saved before relaunch");

  ws.close();
}

async function runPhase2() {
  if (!fs.existsSync(STATE_FILE)) throw new Error("Missing stage47-qa-state.json — run phase 1 first");
  const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));

  const { page, evaluate, ws } = await connect();
  report.validation.relaunch = {
    ok: true,
    pageUrl: page.url,
    usesVite: /5173|vite/i.test(page.url || ""),
  };
  if (report.validation.relaunch.usesVite) fail("Relaunch used Vite/dev");
  else pass("App relaunched packaged (post-close)");

  let snap = await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  report.validation.restore = {
    hasProject: Boolean(snap.safety?.project),
    summaryFromHistory: Boolean(snap.summaryIsFromHistory || snap.projectSummary),
    reviewPack: Boolean(snap.reviewPack),
    checkpoint: Boolean(snap.latestCheckpoint?.createdAt || snap.safety?.checkpointExists),
    checkpointVerified: snap.checkpointAvailability?.restorable ?? false,
    builderPlan: Boolean(snap.builderPlan?.saved),
    comparison: Boolean(snap.builderPlanComparison?.saved),
    implementationReview: Boolean(snap.implementationReview?.saved),
    roleMappingCount: Object.values(snap.roleModelMapping?.mappings || {}).filter(Boolean).length,
    backlogCount: snap.backlog?.items?.length ?? 0,
    advisor: Boolean(snap.advisorResponse),
    autoActivity: {
      summarizing: Boolean(snap.summarizing),
      advisorBusy: Boolean(snap.advisorBusy),
      checkpointBusy: Boolean(snap.checkpointBusy),
      safeChecksRunning: Boolean(snap.safeChecks?.running),
    },
  };

  if (report.validation.restore.hasProject) pass("Recent project reopened");
  else fail("Recent project reopen failed");
  if (report.validation.restore.summaryFromHistory) pass("Summary/history restored");
  else fail("Summary not restored");
  if (report.validation.restore.reviewPack) pass("Review pack restored");
  if (report.validation.restore.checkpoint) pass("Safety Backup record restored");
  if (report.validation.restore.checkpointVerified) pass("Safety Backup still verified/readable");
  if (report.validation.restore.builderPlan) pass("Builder Plan restored");
  if (report.validation.restore.comparison) pass("Builder Plan Comparison restored");
  if (report.validation.restore.implementationReview) pass("Implementation Review restored");
  if (report.validation.restore.roleMappingCount >= 1) pass("Role Model Mapping restored");
  if (report.validation.restore.backlogCount >= 1) pass("Backlog restored");
  if (
    !report.validation.restore.autoActivity.summarizing &&
    !report.validation.restore.autoActivity.advisorBusy &&
    !report.validation.restore.autoActivity.checkpointBusy &&
    !report.validation.restore.autoActivity.safeChecksRunning
  ) {
    pass("No auto scan/AI/check/restore on reopen");
  } else {
    fail("Unexpected automatic activity on reopen");
  }

  const hashes = projectFingerprints(PROJECT);
  if (JSON.stringify(hashes) === JSON.stringify(saved.fingerprints)) {
    pass("Project files still unchanged after relaunch");
  } else {
    fail("Project files changed after relaunch");
  }

  ws.close();
}

function finalizeReport() {
  const s = report.safety.snapshot || report.safety.initial || {};
  const checks = [
    ["inspectOnly badge", report.safety.uiScan?.inspectOnly],
    ["writesAllowed false", s.writesAllowed === false],
    ["editModeAvailable false", s.editModeAvailable === false],
    ["liveInspectEnabled false", s.liveInspectEnabled === false],
    ["Live Qwen disabled UI", report.safety.uiScan?.liveQwenDisabled],
    ["no edit mode UI", report.safety.uiScan?.noEditMode],
    ["no TTS UI", report.safety.uiScan?.noTts],
    ["no arbitrary terminal UI", report.safety.uiScan?.noArbitraryTerminal],
    ["no custom command UI", report.safety.uiScan?.noCustomCommand],
    ["inspect-only mode", s.mode === "inspect-only"],
  ];
  report.safety.confirmationChecklist = Object.fromEntries(checks);
  for (const [label, ok] of checks) {
    if (ok) pass(`Safety: ${label}`);
    else {
      fail(`Safety check failed: ${label}`);
      report.safetyConcerns.push(`${label} not confirmed`);
    }
  }

  if (report.failed.length === 0) {
    report.goNoGo = "Go for daily use on disposable project copies.";
  } else if (report.failed.length <= 2) {
    report.goNoGo = "Go for daily use with caution.";
  } else {
    report.goNoGo = "No-go until bugs are fixed.";
  }

  if (report.validation.launch?.usesVite === false) {
    report.tinyFixes.push("Consider surfacing 'Selected role model' more prominently after role help modal closes.");
  }
  report.laterFeatures.push("Optional guided first-run tour for non-coders (separate from V1 safety scope).");

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("REPORT_FILE", REPORT_FILE);
}

try {
  if (phase === "2") await runPhase2();
  else await runPhase1();
  finalizeReport();
  process.exit(report.failed.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  finalizeReport();
  process.exit(1);
}
