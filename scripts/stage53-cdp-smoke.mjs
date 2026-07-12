/**
 * Stage 53 packaged-app smoke harness (CDP).
 * Stage 52 Code Context Pack + Stage 50/48 regressions.
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9231";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

const PACK_SECTIONS = [
  "# NTTC Code Context Pack",
  "## User Question",
  "## Pack Status",
  "## Safety Boundaries",
  "## Project Context",
  "## Included Files",
  "## Blocked / Excluded Files",
  "## Suggested Question For AI",
];

const DENY_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "release",
  ".nttc",
];

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  inspectOnly: null,
  liveQwenDisabled: null,
  stage52: {
    bundleStrings: null,
    uiSection: null,
    refreshButton: null,
    filterInput: null,
    maxLinesControl: null,
    maxCharsControl: null,
    generateButton: null,
    copyButton: null,
    clearButton: null,
    selectedCountVisible: null,
    blockedCountVisible: null,
    charEstimateVisible: null,
    fileListAfterRefresh: null,
    previewSections: null,
    safeFileSelectable: null,
    blockedNotIncluded: null,
    denyDirsExcluded: null,
    noAiOnGenerate: null,
    noOllamaOnGenerate: null,
    sourceUnchanged: null,
  },
  projectMemory: null,
  implementationReview: null,
  builderPlanComparison: null,
  builderPlanMode: null,
  roleModelMapping: null,
  roleHelp: null,
  speakerScripts: null,
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
    codeContextSection: haystack.includes("Code Context Pack — Preview Only"),
    refreshSafeList: haystack.includes("Refresh Safe File List"),
    generatePreview: haystack.includes("Generate Code Context Preview"),
    copyPack: haystack.includes("Copy Code Context Pack"),
    previewOnlyNote: haystack.includes("Nothing is sent to AI"),
    packTitle: haystack.includes("NTTC Code Context Pack"),
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
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

function fileStatSafe(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { exists: true, mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return { exists: false, mtimeMs: null, size: null };
  }
}

try {
  report.stage52.bundleStrings = scanBundleStrings();
  if (!report.stage52.bundleStrings.codeContextSection) {
    fail("Stage 52 Code Context Pack UI strings not found in build output");
  }
  if (!report.stage52.bundleStrings.previewOnlyNote) {
    fail("Stage 52 preview-only safety copy not found in build");
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

  const pkgJsonPath = path.join(PROJECT, "package.json");
  const readmePath = path.join(PROJECT, "README.md");
  const beforePkg = fileStatSafe(pkgJsonPath);
  const beforeReadme = fileStatSafe(readmePath);

  let snap = await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  snap = await evaluate(`window.nttc.summarizeProject()`);
  snap = await evaluate(`window.nttc.generateReviewPack()`);
  snap = await evaluate(`window.nttc.generateDecisionReport()`);

  const ollamaBefore = snap.ollama?.lastCheckAt ?? null;
  const qwenBefore = snap.qwen?.lastResponseAt ?? null;
  const localAiBefore = snap.localAi?.lastRunAt ?? null;

  snap = await evaluate(`window.nttc.refreshCodeContextFileList()`);
  const candidates = snap.codeContext?.candidates ?? [];
  report.stage52.fileListAfterRefresh = candidates.length;
  report.stage52.denyDirsExcluded = DENY_DIRS.every((dir) =>
    candidates.every((c) => !c.relativePath.split(/[\\/]/).includes(dir)),
  );

  const tsCandidate = candidates.find((c) => /\.tsx?$/.test(c.relativePath));
  if (tsCandidate) {
    snap = await evaluate(
      `window.nttc.setCodeContextFileSelected(${JSON.stringify(tsCandidate.relativePath)}, true)`,
    );
    report.stage52.safeFileSelectable = snap.codeContext?.selectedCount === 1;
  } else {
    fail(`No .ts/.tsx candidate found in project ${PROJECT}`);
  }

  snap = await evaluate(
    `window.nttc.setCodeContextQuestion("Stage 53 smoke: explain selected code safely.")`,
  );
  snap = await evaluate(`window.nttc.generateCodeContextPreview()`);
  const preview = snap.codeContext?.preview;
  const md = preview?.markdownReport ?? "";
  report.stage52.previewSections = Object.fromEntries(
    PACK_SECTIONS.map((s) => [s, md.includes(s)]),
  );
  report.stage52.blockedNotIncluded =
    !md.includes("BEGIN RSA PRIVATE KEY") &&
    !md.includes("API_KEY=supersecret");
  report.stage52.noAiOnGenerate =
    (snap.ollama?.lastCheckAt ?? null) === ollamaBefore &&
    (snap.qwen?.lastResponseAt ?? null) === qwenBefore &&
    (snap.localAi?.lastRunAt ?? null) === localAiBefore;
  report.stage52.noOllamaOnGenerate = report.stage52.noAiOnGenerate;

  snap = await evaluate(`window.nttc.recordCopyCodeContextPack()`);
  report.stage52.noAiOnGenerate =
    report.stage52.noAiOnGenerate &&
    (snap.ollama?.lastCheckAt ?? null) === ollamaBefore &&
    (snap.qwen?.lastResponseAt ?? null) === qwenBefore;

  const afterPkg = fileStatSafe(pkgJsonPath);
  const afterReadme = fileStatSafe(readmePath);
  report.stage52.sourceUnchanged =
    beforePkg.mtimeMs === afterPkg.mtimeMs &&
    beforeReadme.mtimeMs === afterReadme.mtimeMs;

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.stage52.uiSection = /Code Context Pack — Preview Only/i.test(reportsText);
  report.stage52.refreshButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Refresh Safe File List/i.test(b.textContent || ''))`,
  );
  report.stage52.filterInput = await evaluate(
    `!!document.querySelector('input[placeholder*="Filter by path"]')`,
  );
  report.stage52.maxLinesControl = await evaluate(
    `[...document.querySelectorAll('label')].some((l) => /Max lines/i.test(l.textContent || ''))`,
  );
  report.stage52.maxCharsControl = await evaluate(
    `[...document.querySelectorAll('label')].some((l) => /Max total chars/i.test(l.textContent || ''))`,
  );
  report.stage52.generateButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Generate Code Context Preview/i.test(b.textContent || ''))`,
  );
  report.stage52.copyButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Copy Code Context Pack/i.test(b.textContent || ''))`,
  );
  report.stage52.clearButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Clear Selection/i.test(b.textContent || ''))`,
  );
  report.stage52.selectedCountVisible = /Selected:\s*\d+/i.test(reportsText);
  report.stage52.blockedCountVisible = /Blocked\/skipped:/i.test(reportsText);
  report.stage52.charEstimateVisible =
    /last preview ~\d+ chars/i.test(reportsText) ||
    /Estimated characters/i.test(md);

  report.projectMemory = /Project Memory \/ Handoff Files/i.test(reportsText);

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
  if (!report.stage52.uiSection) fail("Code Context Pack section missing in Reports");
  if (!report.stage52.refreshButton) fail("Refresh Safe File List button missing");
  if (!report.stage52.filterInput) fail("File search/filter input missing");
  if (!report.stage52.maxLinesControl) fail("Max lines control missing");
  if (!report.stage52.maxCharsControl) fail("Max total chars control missing");
  if (!report.stage52.generateButton) fail("Generate Code Context Preview button missing");
  if (!report.stage52.copyButton) fail("Copy Code Context Pack button missing");
  if (!report.stage52.clearButton) fail("Clear Selection button missing");
  if (!report.stage52.selectedCountVisible) fail("Selected file count not visible");
  if (!report.stage52.blockedCountVisible) fail("Blocked/skipped count not visible");
  if (!report.stage52.fileListAfterRefresh) fail("Safe file list empty after refresh");
  if (!report.stage52.denyDirsExcluded) fail("Denied directories appear in candidate list");
  if (!report.stage52.safeFileSelectable) fail("Could not select safe .ts/.tsx file");
  for (const [section, ok] of Object.entries(report.stage52.previewSections ?? {})) {
    if (!ok) fail(`Preview missing section: ${section}`);
  }
  if (!report.stage52.noAiOnGenerate) fail("AI/Ollama activity detected during code context generate/copy");
  if (!report.stage52.sourceUnchanged) fail("Source files appear changed after code context operations");
  if (!report.projectMemory) fail("Project Memory section missing");
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
        project: PROJECT,
        safetySnap: {
          mode: safetySnap.safety?.mode,
          writesAllowed: safetySnap.safety?.writesAllowed,
          liveInspectEnabled: safetySnap.qwen?.liveInspectEnabled,
        },
        previewMeta: {
          included: preview?.includedFileCount,
          blocked: preview?.blockedFileCount,
          chars: preview?.estimatedCharacters,
        },
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
