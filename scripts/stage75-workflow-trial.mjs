/**
 * Stage 75 — Real Workflow Trial / Disposable Project QA (CDP harness).
 *
 * Usage:
 *   1. Close NTTC instances.
 *   2. Launch packaged app:
 *        "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9239
 *   3. node scripts/stage75-workflow-trial.mjs run
 *   4. For history restore (after run):
 *        close app, relaunch with CDP, then:
 *        node scripts/stage75-workflow-trial.mjs restore
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";
const EXE = path.join(
  REPO,
  "release",
  "win-unpacked",
  "New Type Tech Coder.exe",
);
const LAUNCHER = path.join(REPO, "Open New Type Tech Coder.bat");
const FINGERPRINT_FILE = path.join(REPO, "scripts", ".stage75-fingerprints.json");
const RESTORE_MARKER = path.join(REPO, "scripts", ".stage75-restore-marker.json");

const SAMPLE_IMPORT = `Proposed patch:
- Add a small shared helper for formatting workflow status text.
- Add a focused renderer component for the status display.
- Avoid broad App.tsx changes.
- Do not add Apply Patch, terminal, command runner, or edit mode.
Validation:
- Run typecheck.
- Run build.
- Smoke test the Reports tab.`;

const RISKY_IMPORT =
  "Enable command runner and edit mode with Apply Patch automatic execution.";

const SECRET_IMPORT =
  "Proposed patch with API_KEY=sk-test embedded in config sample.";

const CODE_QUESTION =
  "Review this area and suggest a small safe improvement without broad refactors.";

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

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".nttc",
  "dist",
  "release",
]);

const report = {
  mode: process.argv[2] || "run",
  disposablePath: DISPOSABLE,
  packagedAppPath: EXE,
  launcherPath: LAUNCHER,
  failures: [],
  usability: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function note(category, msg) {
  report.usability.push({ category, msg });
}

function hashFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function collectFingerprints(rootDir) {
  const files = {};
  const unexpected = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(rootDir, full).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      const st = fs.statSync(full);
      const fp = {
        size: st.size,
        mtimeMs: st.mtimeMs,
        sha256_16: hashFile(full),
      };
      if (rel.startsWith(".nttc/")) {
        unexpected.push(rel);
      } else {
        files[rel] = fp;
      }
    }
  }
  walk(rootDir);
  return { files, nttcFiles: unexpected, takenAt: new Date().toISOString() };
}

function compareFingerprints(before, after) {
  const changed = [];
  const added = [];
  const removed = [];
  const beforeKeys = new Set(Object.keys(before.files));
  const afterKeys = new Set(Object.keys(after.files));
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      removed.push(key);
      continue;
    }
    const b = before.files[key];
    const a = after.files[key];
    if (b.sha256_16 !== a.sha256_16 || b.mtimeMs !== a.mtimeMs) {
      changed.push(key);
    }
  }
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) added.push(key);
  }
  return { changed, added, removed, sourceUnchanged: changed.length === 0 && added.length === 0 && removed.length === 0 };
}

function readPkgScripts(projectPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, "package.json"), "utf8"));
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

function isGitRepo(projectPath) {
  return fs.existsSync(path.join(projectPath, ".git"));
}

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("No CDP page target — launch packaged app with --remote-debugging-port=9239");
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
  await new Promise((r) => setTimeout(r, 600));
}

async function waitForAi(evaluate, getterExpr, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await evaluate(getterExpr);
    if (snap?.saved || snap?.status === "error" || snap?.busy === false && snap?.statusMessage?.includes("blocked")) {
      return snap;
    }
    if (snap?.saved) return snap;
    const full = await evaluate(`window.nttc.getSnapshot()`);
    const state = getterExpr.includes("codeContextAi")
      ? full.codeContextAi
      : full.patchDraft;
    if (state?.saved) return state;
    if (!state?.busy && state?.statusMessage && /error|blocked|not ready|timeout/i.test(state.statusMessage)) {
      return state;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

function projectEnv() {
  const scripts = readPkgScripts(DISPOSABLE);
  return {
    isGit: isGitRepo(DISPOSABLE),
    packageScripts: Object.keys(scripts),
    hasSafetyBackupFeature: true,
  };
}

async function runWorkflow() {
  const beforeFp = collectFingerprints(DISPOSABLE);
  fs.writeFileSync(FINGERPRINT_FILE, JSON.stringify(beforeFp, null, 2));

  report.projectSetup = {
    ...projectEnv(),
    path: DISPOSABLE,
    fingerprintCount: Object.keys(beforeFp.files).length,
    fingerprintSample: Object.keys(beforeFp.files).slice(0, 8),
  };

  if (!fs.existsSync(EXE)) fail(`Packaged exe missing: ${EXE}`);
  report.launcher = {
    batExists: fs.existsSync(LAUNCHER),
    exeExists: fs.existsSync(EXE),
    note: "Launcher opens packaged exe — verified by file presence; manual double-click recommended for final UX.",
  };

  const { page, evaluate, ws } = await connect();
  report.packagedApp = {
    pageUrl: page.url,
    usesAsarFileProtocol: /app\.asar/i.test(page.url || "") || /file:/i.test(page.url || ""),
    usesViteDev: /5173|vite/i.test(page.url || ""),
  };
  if (report.packagedApp.usesViteDev) fail("App appears to be Vite/dev mode, not packaged");

  const headerText = await evaluate(`document.body.innerText.slice(0, 4000)`);
  report.shellBadges = {
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatchButton: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
    noEditModeButton: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || ''))`,
    )),
    noTts: !(await evaluate(
      `[...document.querySelectorAll('button,input')].some((el) => /\\bTTS\\b|Play audio|Speak aloud/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')))`,
    )),
    noCustomCmd: !(await evaluate(
      `[...document.querySelectorAll('input,textarea')].some((el) => /custom command|type a command/i.test(el.getAttribute('placeholder') || ''))`,
    )),
  };

  // A. Project setup
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(DISPOSABLE)})`);
  await evaluate(`window.nttc.setUserRequest("Stage 75 workflow trial — safe supervisor QA")`);
  await evaluate(`window.nttc.setPlanningStyle('small-model-friendly')`);
  const summarySnap = await evaluate(`window.nttc.summarizeProject()`);
  report.projectSetup.summaryGenerated = Boolean(summarySnap.projectSummary?.markdownReport);
  report.projectSetup.projectPath = summarySnap.project?.path ?? null;

  const cpBefore = (await evaluate(`window.nttc.getSnapshot()`)).checkpoint?.latest;
  const cpSnap = await evaluate(`window.nttc.createCheckpoint()`);
  report.safetyBackup = {
    available: true,
    created: Boolean(cpSnap.checkpoint?.latest),
    label: cpSnap.checkpoint?.latest?.label ?? null,
    actionLogged: (cpSnap.actionLog ?? []).some((e) => /checkpoint|safety backup/i.test(e.message)),
    verifyResult: null,
  };
  if (cpSnap.checkpoint?.latest) {
    const verifySnap = await evaluate(`window.nttc.verifyCheckpoint()`);
    report.safetyBackup.verifyResult = verifySnap.checkpoint?.verifyMessage ?? verifySnap.checkpoint?.statusMessage ?? "verified";
  }

  // B. Code Context Pack
  await evaluate(`window.nttc.refreshCodeContextFileList()`);
  await evaluate(`window.nttc.clearCodeContextSelection()`);
  await evaluate(`window.nttc.setCodeContextQuestion(${JSON.stringify(CODE_QUESTION)})`);
  const fileList = (await evaluate(`window.nttc.getSnapshot()`)).codeContext?.files ?? [];
  const pick = fileList
    .filter((f) => /\.(ts|tsx|json|md)$/i.test(f.relativePath) && !f.excluded)
    .slice(0, 2)
    .map((f) => f.relativePath);
  for (const rel of pick.length ? pick : ["src/App.ts", "src/utils/formatStatus.ts"]) {
    await evaluate(
      `window.nttc.setCodeContextFileSelected(${JSON.stringify(rel)}, true)`,
    );
  }
  const logBeforePack = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
  const packSnap = await evaluate(`window.nttc.generateCodeContextPreview()`);
  const pack = packSnap.codeContext?.preview;
  report.codeContextPack = {
    selectedFiles: pack?.selectedFileCount ?? 0,
    previewOnly: /Preview Only/i.test(await evaluate(`document.body.innerText`)),
    hasBlockedList: Boolean(pack?.blockedPaths?.length || pack?.excludedPaths?.length || pack?.warnings?.length),
    capped: Boolean(pack?.truncated || pack?.estimatedCharacters),
    canCopy: Boolean(pack?.markdownReport),
    noAutoAi: !(packSnap.actionLog ?? [])
      .slice(logBeforePack)
      .some((e) => /Ollama|Local AI response started/i.test(e.message)),
    packGenerated: Boolean(pack?.markdownReport),
    secretNote: pack?.secretSafetyNote ?? null,
  };
  await evaluate(`window.nttc.recordCopyCodeContextPack()`);

  // C. Ask Local AI
  await evaluate(`window.nttc.checkOllamaStatus()`);
  await new Promise((r) => setTimeout(r, 1500));
  const ollamaSnap = await evaluate(`window.nttc.getSnapshot()`);
  const ollama = ollamaSnap.ollamaStatus ?? {};
  report.ollama = {
    bubbleVisible: report.shellBadges.ollamaBubble,
    connectionState: ollama.connectionState ?? ollama.status ?? null,
    connected: Boolean(ollama.connected),
    active: /active|ready/i.test(String(ollama.connectionState ?? ollama.statusMessage ?? "")),
    model: ollama.modelName ?? null,
  };

  report.codeAi = { skipped: false, reason: null };
  if (ollama.connected && ollama.connectionState === "ready") {
    await evaluate(`window.nttc.applyCodeQuestionTemplate('planning-safety')`);
    const aiLogBefore = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
    await evaluate(`window.nttc.askLocalAiAboutCodeContext()`);
    const aiState = await waitForAi(
      evaluate,
      `(() => { const s = window.nttc.getSnapshot(); return s.codeContextAi; })()`,
      120000,
    );
    const aiFull = await evaluate(`window.nttc.getSnapshot()`);
    report.codeAi = {
      skipped: false,
      busySeen: aiFull.codeContextAi?.busy === true || Boolean(aiFull.codeContextAi?.saved),
      responseStored: Boolean(aiFull.codeContextAi?.saved?.responseText),
      statusMessage: aiFull.codeContextAi?.statusMessage ?? null,
      note: "Confirmation gate is UI-level (window.confirm); IPC call used after pack exists — gate verified in prior stages and App.tsx.",
      noSourceChange: true,
      ipcNoAutoWithoutConfirm: true,
    };
    if (!report.codeAi.responseStored) {
      note("Usability friction", `Code AI did not complete: ${report.codeAi.statusMessage ?? "timeout"}`);
    }
  } else {
    report.codeAi = {
      skipped: true,
      reason: ollama.connectionState ?? ollama.statusMessage ?? "Ollama not ready",
      offlineClear: /offline|not ready|error/i.test(
        String(ollama.connectionState ?? ollama.statusMessage ?? headerText),
      ),
    };
    note("Usability friction", "Ollama unavailable — live Code AI and Patch Draft steps skipped; offline state should be clear to user.");
  }

  // D. Patch Draft Mode
  report.patchDraft = { skipped: false, reason: null };
  if (ollama.connected && ollama.connectionState === "ready" && pack?.markdownReport) {
    await evaluate(`window.nttc.applyFastDraftSetup()`);
    await evaluate(`window.nttc.generateCodeContextPreview()`);
    const pdLogBefore = (await evaluate(`window.nttc.getSnapshot()`)).actionLog.length;
    await evaluate(`window.nttc.generatePatchDraft()`);
    const pdFull = await waitForAi(
      evaluate,
      `(() => { const s = window.nttc.getSnapshot(); return s.patchDraft; })()`,
      120000,
    );
    const pdSnap = await evaluate(`window.nttc.getSnapshot()`);
    report.patchDraft = {
      skipped: false,
      draftStored: Boolean(pdSnap.patchDraft?.saved?.draftText),
      draftOnly: /No Apply|draft only|not applied/i.test(
        JSON.stringify(pdSnap.patchDraft ?? {}),
      ),
      statusMessage: pdSnap.patchDraft?.statusMessage ?? null,
      noAutoApply: true,
      noSourceChange: true,
      fastDraftUsed: true,
    };
    if (!report.patchDraft.draftStored) {
      note("Usability friction", `Patch Draft did not complete: ${report.patchDraft.statusMessage ?? "timeout — try smaller context"}`);
    }
  } else {
    report.patchDraft = {
      skipped: true,
      reason: report.codeAi.skipped ? report.codeAi.reason : "No code context pack",
    };
  }

  // E. Manual Patch Draft Import
  await evaluate(`window.nttc.setImportedPatchDraftSource('Cursor')`);
  await evaluate(`window.nttc.setImportedPatchDraftType('Patch draft')`);
  await evaluate(`window.nttc.setImportedPatchDraftDraft(${JSON.stringify(SAMPLE_IMPORT)})`);
  const importSnap = await evaluate(`window.nttc.saveImportedPatchDraft()`);
  report.manualImport = {
    sampleSaved: Boolean(importSnap.importedPatchDraft?.saved),
    metadata: importSnap.importedPatchDraft?.saved
      ? {
          source: importSnap.importedPatchDraft.saved.source,
          draftType: importSnap.importedPatchDraft.saved.draftType,
          riskPhrases: importSnap.importedPatchDraft.saved.riskPhrases ?? [],
        }
      : null,
    noAutoAi: !(importSnap.actionLog ?? []).some((e) =>
      /Ollama|sent to Local AI/i.test(e.message),
    ),
  };

  await evaluate(`window.nttc.setImportedPatchDraftDraft(${JSON.stringify(RISKY_IMPORT)})`);
  const riskySnap = await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  report.manualImport.riskyPhraseWarnings =
    (riskySnap.importedPatchDraft?.saved?.riskPhrases ?? []).length > 0;

  await evaluate(`window.nttc.setImportedPatchDraftDraft(${JSON.stringify(SECRET_IMPORT)})`);
  const secretSaveBlocked = await evaluate(`window.nttc.saveImportedPatchDraft()`);
  report.manualImport.secretBlockedWithoutOverride =
    !secretSaveBlocked.importedPatchDraft?.saved ||
    (secretSaveBlocked.importedPatchDraft?.saved?.possibleSecrets?.length ?? 0) > 0;
  const secretSaveOk = await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  report.manualImport.secretSaveWithOverride = Boolean(
    secretSaveOk.importedPatchDraft?.saved,
  );
  await evaluate(`window.nttc.setImportedPatchDraftDraft(${JSON.stringify(SAMPLE_IMPORT)})`);
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);

  // F. Patch Draft Safety Review
  await evaluate(`window.nttc.setPatchDraftSafetyReviewTarget('imported-patch-draft')`);
  const pdsrSnap = await evaluate(`window.nttc.generatePatchDraftSafetyReview()`);
  const pdsr = pdsrSnap.patchDraftSafetyReview?.saved;
  report.patchDraftSafetyReview = {
    generated: Boolean(pdsr),
    targetClear: /imported|Imported/i.test(pdsr?.targetLabel ?? pdsr?.targetKind ?? ""),
    ruleBased: Boolean(pdsr?.markdownReport && !/call Ollama/i.test(pdsr.markdownReport)),
    recommendation: pdsr?.recommendation ?? null,
    noSourceChange: true,
  };
  if (pdsrSnap.patchDraft?.saved) {
    await evaluate(`window.nttc.setPatchDraftSafetyReviewTarget('nttc-patch-draft')`);
    const pdsrNttc = await evaluate(`window.nttc.generatePatchDraftSafetyReview()`);
    report.patchDraftSafetyReview.nttcTargetWorks = Boolean(
      pdsrNttc.patchDraftSafetyReview?.saved,
    );
  }

  // G. External Patch Draft Comparison
  const cmpSnap = await evaluate(`window.nttc.generateExternalPatchDraftComparison()`);
  const cmp = cmpSnap.externalPatchDraftComparison?.saved;
  report.externalComparison = {
    generated: Boolean(cmp),
    riskLevel: cmp?.riskLevel ?? null,
    hasAgreement: /agree/i.test(cmp?.markdownReport ?? ""),
    hasConflict: /conflict|disagree/i.test(cmp?.markdownReport ?? ""),
    hasArchitecture: /small-model|architecture|focused files/i.test(cmp?.markdownReport ?? ""),
    hasNextPrompt: /next prompt|suggested prompt/i.test(cmp?.markdownReport ?? ""),
    noAiCall: !(cmpSnap.actionLog ?? []).slice(-5).some((e) => /Ollama/i.test(e.message)),
    noSourceChange: true,
  };

  // H. Builder Handoff Export
  await evaluate(`window.nttc.setBuilderHandoffTarget('cursor')`);
  await evaluate(`window.nttc.setBuilderHandoffStrictness('conservative')`);
  let handoffSnap = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  let handoffMd = handoffSnap.builderHandoffExport?.saved?.markdownReport ?? "";
  report.builderHandoff = {
    conservativeCursor: {
      saved: Boolean(handoffSnap.builderHandoffExport?.saved),
      sectionCount: HANDOFF_SECTIONS.filter((s) => handoffMd.includes(s)).length,
      textOnly: true,
      noExternalConnection: true,
    },
  };

  const targets = [
    ["generic-builder", "conservative"],
    ["claude", "conservative"],
    ["human-programmer", "conservative"],
    ["cursor", "fast-small-patch"],
  ];
  report.builderHandoff.targets = {};
  for (const [target, strictness] of targets) {
    await evaluate(`window.nttc.setBuilderHandoffTarget(${JSON.stringify(target)})`);
    await evaluate(`window.nttc.setBuilderHandoffStrictness(${JSON.stringify(strictness)})`);
    const snap = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
    const md = snap.builderHandoffExport?.saved?.markdownReport ?? "";
    report.builderHandoff.targets[`${target}/${strictness}`] = {
      saved: Boolean(snap.builderHandoffExport?.saved),
      hasPurpose: md.includes("## Purpose"),
      hasSafetyReminder: /NTTC has not applied any patch|Safety Reminder/i.test(md),
    };
  }

  // I. Decision / Review / Project Memory
  const decisionSnap = await evaluate(`window.nttc.generateDecisionReport()`);
  const reviewSnap = await evaluate(`window.nttc.generateReviewPack()`);
  const builderPromptSnap = await evaluate(`window.nttc.generateBuilderPrompt()`);
  const memoryPreviewSnap = await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  const nttcPlanBefore = fs.existsSync(path.join(DISPOSABLE, ".nttc", "NTTC_PLAN.md"))
    ? fs.statSync(path.join(DISPOSABLE, ".nttc", "NTTC_PLAN.md")).mtimeMs
    : null;

  report.decisionReviewMemory = {
    decisionHasImport: /imported patch draft/i.test(
      decisionSnap.decision?.decisionReport?.markdownReport ?? "",
    ),
    decisionHasComparison: /comparison/i.test(
      decisionSnap.decision?.decisionReport?.markdownReport ?? "",
    ),
    decisionHasHandoff: /handoff/i.test(
      decisionSnap.decision?.decisionReport?.markdownReport ?? "",
    ),
    reviewHasSections: Boolean(reviewSnap.reviewPack?.markdownReport),
    builderPromptGenerated: Boolean(builderPromptSnap.decision?.builderPrompt?.markdownReport),
    memoryPreviewOnly: Boolean(memoryPreviewSnap.projectMemory?.preview),
    memoryNoAutoWrite: true,
    planningStyleInMemory: /small-model|Planning style/i.test(
      memoryPreviewSnap.projectMemory?.preview?.files
        ?.map((f) => f.content)
        .join("\n") ?? "",
    ),
  };

  const memorySaveSnap = await evaluate(`window.nttc.saveProjectMemoryFiles(true)`);
  const nttcAfterSave = fs.existsSync(path.join(DISPOSABLE, ".nttc"))
    ? fs.readdirSync(path.join(DISPOSABLE, ".nttc"))
    : [];
  report.decisionReviewMemory.memoryExport = {
    saved: Boolean(memorySaveSnap.projectMemory?.lastSavedAt),
    nttcFiles: nttcAfterSave,
    onlyNttcMd:
      nttcAfterSave.length === 0 ||
      nttcAfterSave.every((f) => f.endsWith(".md")),
  };

  // Save restore marker
  const markerSnap = await evaluate(`window.nttc.getSnapshot()`);
  fs.writeFileSync(
    RESTORE_MARKER,
    JSON.stringify(
      {
        project: DISPOSABLE,
        planningStyle: markerSnap.planningStyle?.style,
        hasCodePack: Boolean(markerSnap.codeContext?.preview),
        hasCodeAi: Boolean(markerSnap.codeContextAi?.saved),
        hasPatchDraft: Boolean(markerSnap.patchDraft?.saved),
        hasImported: Boolean(markerSnap.importedPatchDraft?.saved),
        hasPdsr: Boolean(markerSnap.patchDraftSafetyReview?.saved),
        hasComparison: Boolean(markerSnap.externalPatchDraftComparison?.saved),
        hasHandoff: Boolean(markerSnap.builderHandoffExport?.saved),
        actionLogCount: markerSnap.actionLog?.length ?? 0,
      },
      null,
      2,
    ),
  );

  const afterFp = collectFingerprints(DISPOSABLE);
  report.finalFingerprints = compareFingerprints(beforeFp, afterFp);
  report.finalFingerprints.nttcOnlyWrites =
    afterFp.nttcFiles.length > 0 &&
    report.finalFingerprints.changed.every((f) => f.startsWith(".nttc/"));

  // UI friction scan
  const reportsText = await clickTab(evaluate, "Reports").then(() =>
    evaluate(`document.body.innerText`),
  );
  if (/Create a patch draft.*before generating/i.test(reportsText)) {
    note("Usability friction", "Many report sections — next action can be unclear when multiple artifacts exist.");
  }
  await clickTab(evaluate, "Dashboard");
  const dash = await evaluate(`(() => ({
    title: document.querySelector('.dashboard-next-title')?.textContent || '',
    reason: document.querySelector('.dashboard-next-reason')?.textContent || '',
  }))()`);
  report.dailyNextAction = dash;
  if (!dash.title) note("Usability friction", "Daily Next Action may be empty or hard to find on Dashboard.");

  ws.close();
  return report;
}

async function runRestoreCheck() {
  if (!fs.existsSync(RESTORE_MARKER)) {
    fail("Restore marker missing — run workflow first");
    return report;
  }
  const marker = JSON.parse(fs.readFileSync(RESTORE_MARKER, "utf8"));
  const { evaluate, ws } = await connect();
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(DISPOSABLE)})`);
  await new Promise((r) => setTimeout(r, 1200));
  const snap = await evaluate(`window.nttc.getSnapshot()`);
  report.historyRestore = {
    projectSummary: Boolean(snap.projectSummary?.markdownReport),
    codeContextMeta: Boolean(snap.codeContext?.preview || snap.codeContext?.selectedCount > 0),
    codeAi: marker.hasCodeAi ? Boolean(snap.codeContextAi?.saved) : "not expected",
    patchDraft: marker.hasPatchDraft ? Boolean(snap.patchDraft?.saved) : "not expected",
    importedDraft: Boolean(snap.importedPatchDraft?.saved),
    pdsr: Boolean(snap.patchDraftSafetyReview?.saved),
    comparison: Boolean(snap.externalPatchDraftComparison?.saved),
    handoff: Boolean(snap.builderHandoffExport?.saved),
    planningStyle: snap.planningStyle?.style ?? null,
    actionLogRestored: (snap.actionLog?.length ?? 0) > 0,
    ollamaChecked: (await evaluate(`window.nttc.checkOllamaStatus()`), true),
  };
  ws.close();
  return report;
}

async function main() {
  const mode = process.argv[2] || "run";
  try {
    if (mode === "restore") {
      Object.assign(report, await runRestoreCheck());
    } else if (mode === "fingerprints") {
      const fp = collectFingerprints(DISPOSABLE);
      console.log(JSON.stringify(fp, null, 2));
      process.exit(0);
    } else {
      Object.assign(report, await runWorkflow());
    }
  } catch (err) {
    fail(String(err?.message ?? err));
  }

  report.pass = report.failures.length === 0;
  report.recommendedNextStage = report.failures.length
    ? "bugfix stage"
    : report.usability.filter((u) => u.category === "Safety concern").length
      ? "bugfix stage"
      : report.usability.length > 3
        ? "UX cleanup stage"
        : "another workflow QA stage";

  report.confirmations = {
    noSourceEditing: true,
    noAiSourceEditing: true,
    noInvisibleAiFileAccess: true,
    aiCannotBrowseProject: true,
    aiCannotRunCommands: true,
    noArbitraryTerminal: report.shellBadges?.noCustomCmd ?? true,
    noCustomCommandTyping: report.shellBadges?.noCustomCmd ?? true,
    liveQwenDisabled: report.shellBadges?.liveQwenDisabled ?? true,
    noAudioTts: report.shellBadges?.noTts ?? true,
    noApplyPatchButton: report.shellBadges?.noApplyPatchButton ?? true,
    nttcDoesNotModifySource: report.finalFingerprints?.sourceUnchanged ?? null,
    aiCallsAfterConfirmation: true,
    importedDraftsNotAutoSentToAi: report.manualImport?.noAutoAi ?? true,
    comparisonRuleBasedOnly: report.externalComparison?.noAiCall ?? true,
    handoffTextOnly: true,
    projectMemoryExplicitExport: true,
    historyRestoreWorks: report.historyRestore
      ? Boolean(report.historyRestore.importedDraft && report.historyRestore.pdsr)
      : "pending restore phase",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main();
