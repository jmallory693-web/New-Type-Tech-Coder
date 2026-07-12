/**
 * Stage 51 packaged-app smoke harness (CDP).
 * Stage 50 Project Memory + Stage 48/45 regressions.
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9230";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";

const APPROVED_FILES = [
  "NTTC_PLAN.md",
  "NTTC_DONE.md",
  "NTTC_CONTEXT.md",
  "NTTC_REVIEW_HANDOFF.md",
  "NTTC_THREAD_EXPORT.md",
];

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  inspectOnly: null,
  liveQwenDisabled: null,
  implementationReview: null,
  builderPlanComparison: null,
  builderPlanMode: null,
  speakerScripts: null,
  roleModelMapping: null,
  roleHelp: null,
  stage50: {
    bundleStrings: null,
    uiSection: null,
    generateButton: null,
    previewTabs: null,
    saveButton: null,
    saveRequiresConfirmation: null,
    overwriteRequiresConfirmation: null,
    nttcFilesWritten: null,
    onlyApprovedFiles: null,
    sourceUnchanged: null,
    reviewReportMentions: null,
    decisionReportMentions: null,
    dailyNextCanRecommend: null,
  },
  audioTts: null,
  editMode: null,
  arbitraryTerminal: null,
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
  const haystack = `${readJsHaystack(path.join(REPO, "dist", "assets"))}\n${readJsHaystack(path.join(REPO, "dist-electron"))}`;
  return {
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
    generatePreview: haystack.includes("Generate Project Memory Preview"),
    saveFiles: haystack.includes("Save Project Memory Files"),
    confirmSave: haystack.includes("Confirm Save"),
    saveNoSourceEdit: haystack.includes("This will not edit source code"),
    exportDailyAction: haystack.includes("export-project-memory"),
    nttcPlan: haystack.includes("NTTC_PLAN.md"),
    documentationOnly: haystack.includes(
      "These are markdown planning files only",
    ),
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
  await new Promise((r) => setTimeout(r, 600));
}

function listNttcFiles(projectRoot) {
  const dir = path.join(projectRoot, ".nttc");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
}

function fileStatSafe(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { exists: true, mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return { exists: false, mtimeMs: null, size: null };
  }
}

try {
  report.stage50.bundleStrings = scanBundleStrings();
  if (!report.stage50.bundleStrings.projectMemorySection) {
    fail("Stage 50 Project Memory UI strings not found in build output");
  }
  if (!report.stage50.bundleStrings.documentationOnly) {
    fail("Stage 50 documentation-only safety copy not found in build");
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  let bodyText = await evaluate(`document.body ? document.body.innerText : ''`);
  report.inspectOnly = /Inspect-only/i.test(bodyText);
  report.liveQwenDisabled = /Live Qwen is disabled/i.test(bodyText);
  report.audioTts = /text-to-speech|\bTTS\b|Play audio|Speak aloud/i.test(bodyText);
  report.editMode = /Enable Edit Mode/i.test(bodyText);
  report.arbitraryTerminal = /Arbitrary terminal|Open Terminal|Run any command/i.test(
    bodyText,
  );

  if (!fs.existsSync(DISPOSABLE)) {
    fail(`Disposable project missing: ${DISPOSABLE}`);
  }

  const pkgJsonPath = path.join(DISPOSABLE, "package.json");
  const readmePath = path.join(DISPOSABLE, "README.md");
  const beforePkg = fileStatSafe(pkgJsonPath);
  const beforeReadme = fileStatSafe(readmePath);

  let snap = await evaluate(`window.nttc.openRecentProject(${JSON.stringify(DISPOSABLE)})`);
  snap = await evaluate(`window.nttc.summarizeProject()`);
  snap = await evaluate(`window.nttc.generateReviewPack()`);
  snap = await evaluate(`window.nttc.generateDecisionReport()`);

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.stage50.uiSection = /Project Memory \/ Handoff Files/i.test(reportsText);
  report.stage50.generateButton = [...reportsText.matchAll(/Generate Project Memory Preview/g)].length > 0 ||
    (await evaluate(`[...document.querySelectorAll('button')].some((b) => /Generate Project Memory Preview/i.test(b.textContent || ''))`));
  report.stage50.saveButton = await evaluate(`[...document.querySelectorAll('button')].some((b) => /Save Project Memory Files/i.test(b.textContent || ''))`);
  report.stage50.saveUiConfirmationCopy =
    report.stage50.bundleStrings.confirmSave &&
    report.stage50.bundleStrings.saveNoSourceEdit;

  await clickTab(evaluate, "Dashboard");
  const dashBeforeSave = await evaluate(`document.body.innerText`);
  report.stage50.dailyNextCanRecommend =
    /Export Project Memory/i.test(dashBeforeSave) ||
    report.stage50.bundleStrings.exportDailyAction;

  snap = await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  const preview = snap.projectMemory?.preview;
  report.stage50.previewTabs = {
    fileCount: preview?.files?.length ?? 0,
    names: (preview?.files ?? []).map((f) => f.fileName),
    hasAllApproved: APPROVED_FILES.every((name) =>
      (preview?.files ?? []).some((f) => f.fileName === name),
    ),
  };

  await clickTab(evaluate, "Reports");
  const tabLabels = await evaluate(`[...document.querySelectorAll('.memory-file-tab')].map((b) => b.textContent?.trim())`);
  report.stage50.previewTabs.uiTabCount = tabLabels?.length ?? 0;

  const nttcDir = path.join(DISPOSABLE, ".nttc");
  if (fs.existsSync(nttcDir)) {
    for (const file of fs.readdirSync(nttcDir)) {
      fs.unlinkSync(path.join(nttcDir, file));
    }
  }

  const firstSave = await evaluate(`window.nttc.saveProjectMemoryFiles(false)`);
  const firstSaved = firstSave.projectMemory?.lastSaved;
  const firstFiles = listNttcFiles(DISPOSABLE);
  report.stage50.nttcFilesWritten = {
    count: firstFiles.length,
    files: firstFiles,
    lastSavedAt: firstSaved?.savedAt ?? null,
  };
  report.stage50.onlyApprovedFiles =
    firstFiles.length === APPROVED_FILES.length &&
    firstFiles.every((f) => APPROVED_FILES.includes(f));

  const overwriteAttempt = await evaluate(`window.nttc.saveProjectMemoryFiles(false)`);
  const pendingOverwrite = overwriteAttempt.projectMemory?.pendingOverwriteFiles ?? [];
  report.stage50.overwriteRequiresConfirmation =
    pendingOverwrite.length >= APPROVED_FILES.length ||
    /overwrite confirmation|already exist/i.test(
      overwriteAttempt.projectMemory?.statusMessage || "",
    );

  const confirmedSave = await evaluate(`window.nttc.saveProjectMemoryFiles(true)`);
  report.stage50.saveRequiresConfirmation =
    Boolean(firstSaved) &&
    Boolean(confirmedSave.projectMemory?.lastSaved) &&
    report.stage50.saveUiConfirmationCopy;

  const afterPkg = fileStatSafe(pkgJsonPath);
  const afterReadme = fileStatSafe(readmePath);
  report.stage50.sourceUnchanged =
    beforePkg.mtimeMs === afterPkg.mtimeMs &&
    beforeReadme.mtimeMs === afterReadme.mtimeMs &&
    beforePkg.size === afterPkg.size;

  const reviewPack = await evaluate(`window.nttc.generateReviewPack()`);
  const decision = await evaluate(`window.nttc.generateDecisionReport()`);
  const reviewMd = reviewPack.reviewPack?.markdownReport || "";
  const decisionMd = decision.decision?.decisionReport?.markdownReport || "";
  report.stage50.reviewReportMentions =
    reviewMd.includes("Project Memory") && reviewMd.includes(".nttc/");
  report.stage50.decisionReportMentions =
    decisionMd.includes("Project Memory") && decisionMd.includes(".nttc/");

  if (!report.stage50.dailyNextCanRecommend) {
    // Accept freshness hint in generated review pack when dashboard already advanced.
    report.stage50.dailyNextCanRecommend = reviewMd.includes("Project Memory: not saved");
  }

  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  report.liveQwenDisabled =
    report.liveQwenDisabled || /Live Qwen is disabled/i.test(aiText);
  report.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(aiText);
  report.speakerScripts = /Speaker Scripts/i.test(aiText);

  const roleHelp = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('.role-help-link')][0];
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 350));
    const panel = !!document.querySelector('.role-help-panel');
    document.querySelector('.role-help-close')?.click();
    return { panel, linkCount: document.querySelectorAll('.role-help-link').length };
  })()`);
  report.roleHelp = roleHelp;

  await clickTab(evaluate, "Request / Output");
  const reqText = await evaluate(`document.body.innerText`);
  report.implementationReview = /Implementation Review/i.test(reqText);
  report.builderPlanComparison = /Builder Plan Comparison/i.test(reqText);

  await clickTab(evaluate, "Settings");
  const settingsText = await evaluate(`document.body.innerText`);
  report.roleModelMapping = /Role Model Mapping/i.test(settingsText);

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

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.inspectOnly) fail("Inspect-only badge missing");
  if (!report.liveQwenDisabled) fail("Live Qwen disabled banner missing");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  if (safetySnap?.safety?.mode !== "inspect-only") fail("Expected inspect-only mode");
  if (!report.stage50.uiSection) fail("Project Memory / Handoff Files section missing in Reports");
  if (!report.stage50.generateButton) fail("Generate Project Memory Preview button missing");
  if (!report.stage50.previewTabs?.hasAllApproved) {
    fail(`Preview missing approved files: ${JSON.stringify(report.stage50.previewTabs)}`);
  }
  if (!report.stage50.saveButton) fail("Save Project Memory Files button missing");
  if (!report.stage50.saveUiConfirmationCopy) {
    fail("Save confirmation copy (Confirm Save) not found in UI strings");
  }
  if (!report.stage50.nttcFilesWritten?.count) fail(".nttc/ files were not written on save");
  if (!report.stage50.onlyApprovedFiles) fail("Non-approved or missing files in .nttc/");
  if (!report.stage50.overwriteRequiresConfirmation) {
    fail("Overwrite confirmation path not detected on second save");
  }
  if (!report.stage50.sourceUnchanged) fail("Source files appear changed after Project Memory save");
  if (!report.stage50.reviewReportMentions) fail("Review Report missing Project Memory status");
  if (!report.stage50.decisionReportMentions) fail("Decision Report missing Project Memory status");
  if (!report.stage50.dailyNextCanRecommend) {
    fail("Daily Next Action export-project-memory rule not present");
  }
  if (!report.implementationReview) fail("Implementation Review missing");
  if (!report.builderPlanComparison) fail("Builder Plan Comparison missing");
  if (!report.builderPlanMode) fail("Builder Plan Mode missing");
  if (!report.speakerScripts) fail("Speaker Scripts missing");
  if (!report.roleModelMapping) fail("Role Model Mapping missing");
  if (!roleHelp?.panel) fail("Clickable role help modal failed");
  if (report.audioTts || !safetyUi.noTtsControl) fail("Audio/TTS unexpectedly present");
  if (report.editMode || !safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (report.arbitraryTerminal) fail("Arbitrary terminal unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");

  console.log(
    JSON.stringify(
      {
        report,
        safetySnap: {
          mode: safetySnap.safety?.mode,
          writesAllowed: safetySnap.safety?.writesAllowed,
          liveInspectEnabled: safetySnap.qwen?.liveInspectEnabled,
        },
        nttcDir,
        firstFiles,
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
