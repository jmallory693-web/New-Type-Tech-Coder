/**
 * Stage 61 packaged-app smoke harness (CDP).
 * Stage 60 Patch Draft Safety Review + Stage 58/56/54/52 regressions.
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9235";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

const TEMPLATE_LABELS = [
  "Explain selected code",
  "Find likely bugs",
  "Check against current plan",
  "Suggest missing tests",
  "Find missing context",
  "Ask for small patch plan",
  "Review for safety boundary risks",
  "Explain errors from checks",
  "Summarize for a non-coder",
  "Prepare question for outside builder",
];

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
  stage52: {},
  stage54: {},
  stage56: {},
  stage58: {},
  stage60: {},
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
  const renderer = readJsHaystack(path.join(REPO, "dist", "assets"));
  const main = readJsHaystack(path.join(REPO, "dist-electron"));
  const haystack = `${renderer}\n${main}`;
  const stage56Labels = Object.fromEntries(
    TEMPLATE_LABELS.map((label) => [label, haystack.includes(label)]),
  );
  return {
    codeContextSection: haystack.includes("Code Context Pack — Preview Only"),
    askCodeAiSection: haystack.includes("Ask Local AI About Selected Code"),
    askCodeButton: haystack.includes("Ask Local AI About Code"),
    copyCodeAiResponse: haystack.includes("Copy Code AI Response"),
    codeReviewerLabel: haystack.includes("Code Reviewer"),
    confirmSendPack: haystack.includes(
      "Send this approved Code Context Pack to Local AI",
    ),
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
    codeQuestionTemplatesSection: haystack.includes("Code Question Templates"),
    clearCodeQuestion: haystack.includes("Clear Code Question"),
    templateLabels: stage56Labels,
    patchDraftSection: haystack.includes("Patch Draft Mode — No Apply"),
    generatePatchDraftButton: haystack.includes(
      "Generate Patch Draft with Local AI",
    ),
    copyPatchDraftButton: haystack.includes("Copy Patch Draft"),
    patchDraftNoApplyNote: haystack.includes(
      "NTTC will not edit files or apply patches",
    ),
    patchDraftMappingLabel: haystack.includes("Patch Draft"),
    safetyReviewSection: haystack.includes("Patch Draft Safety Review"),
    generateSafetyReviewButton: haystack.includes(
      "Generate Patch Draft Safety Review",
    ),
    copySafetyReviewButton: haystack.includes("Copy Patch Draft Safety Review"),
    generatePatchDraftFirst: haystack.includes("Generate a Patch Draft first."),
    recommendationBadge: haystack.includes("Recommendation badge:"),
    safetyReviewRuleBased: haystack.includes(
      "keyword rules before you send it to an outside builder",
    ),
    safetyReviewNoOllama: haystack.includes("No Ollama"),
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
  const bundle = scanBundleStrings();
  report.stage54.bundleStrings = bundle;
  report.stage56.bundleStrings = {
    codeQuestionTemplatesSection: bundle.codeQuestionTemplatesSection,
    clearCodeQuestion: bundle.clearCodeQuestion,
    templateLabels: bundle.templateLabels,
  };
  report.stage58.bundleStrings = {
    patchDraftSection: bundle.patchDraftSection,
    generatePatchDraftButton: bundle.generatePatchDraftButton,
    copyPatchDraftButton: bundle.copyPatchDraftButton,
    patchDraftMappingLabel: bundle.patchDraftMappingLabel,
  };
  report.stage60.bundleStrings = {
    safetyReviewSection: bundle.safetyReviewSection,
    generateSafetyReviewButton: bundle.generateSafetyReviewButton,
    copySafetyReviewButton: bundle.copySafetyReviewButton,
    generatePatchDraftFirst: bundle.generatePatchDraftFirst,
    recommendationBadge: bundle.recommendationBadge,
    safetyReviewRuleBased: bundle.safetyReviewRuleBased,
    safetyReviewNoOllama: bundle.safetyReviewNoOllama,
  };

  for (const [key, ok] of Object.entries(bundle)) {
    if (key === "templateLabels" || key === "noApplyPatchButton") {
      if (key === "templateLabels") {
        for (const [label, labelOk] of Object.entries(ok)) {
          if (!labelOk) fail(`Stage 56 bundle label missing: ${label}`);
        }
      }
      continue;
    }
    if (!ok) fail(`Bundle string/check missing: ${key}`);
  }

  const safetyReviewBuilderPath = path.join(
    REPO,
    "dist-electron",
    "main",
    "review",
    "buildPatchDraftSafetyReview.js",
  );
  report.stage60.builderExists = fs.existsSync(safetyReviewBuilderPath);
  if (!report.stage60.builderExists) {
    fail("buildPatchDraftSafetyReview.js missing from packaged main bundle");
  } else {
    const builderSrc = fs.readFileSync(safetyReviewBuilderPath, "utf8");
    report.stage60.ruleBasedOnly =
      builderSrc.includes("rule/keyword-based") &&
      !/\baskLocalAi\b/.test(builderSrc) &&
      !/\bProviderRegistry\b/.test(builderSrc) &&
      !/\bgeneratePatchDraft\b/.test(builderSrc);
    report.stage60.reportTitle = builderSrc.includes(
      "NTTC Patch Draft Safety Review",
    );
    if (!report.stage60.ruleBasedOnly) {
      fail("Patch Draft Safety Review builder appears to reference Ollama/AI calls");
    }
    if (!report.stage60.reportTitle) fail("Safety review report title missing in builder");
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const bodyText = await evaluate(`document.body ? document.body.innerText : ''`);
  report.inspectOnly = /Inspect-only/i.test(bodyText);
  report.liveQwenDisabled = /Live Qwen is disabled/i.test(bodyText);
  report.audioTts = /text-to-speech|\bTTS\b|Play audio|Speak aloud/i.test(
    bodyText,
  );
  report.editMode = /Enable Edit Mode/i.test(bodyText);
  report.arbitraryTerminal = /Arbitrary terminal|Open Terminal|Run any command/i.test(
    bodyText,
  );

  const pkgJsonPath = path.join(PROJECT, "package.json");
  const readmePath = path.join(PROJECT, "README.md");
  const beforePkg = fileStatSafe(pkgJsonPath);
  const beforeReadme = fileStatSafe(readmePath);

  let snap = await evaluate(
    `window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`,
  );
  snap = await evaluate(`window.nttc.summarizeProject()`);
  snap = await evaluate(`window.nttc.generateReviewPack()`);

  snap = await evaluate(`window.nttc.refreshCodeContextFileList()`);
  const candidates = snap.codeContext?.candidates ?? [];
  report.stage52.fileListAfterRefresh = candidates.length;

  await clickTab(evaluate, "Reports");
  const beforeDraftText = await evaluate(`document.body.innerText`);
  report.stage60.uiSection = /Patch Draft Safety Review/i.test(beforeDraftText);
  report.stage60.generateButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Generate Patch Draft Safety Review/i.test(b.textContent || ''))`,
  );
  report.stage60.copyButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Copy Patch Draft Safety Review/i.test(b.textContent || ''))`,
  );
  report.stage60.noDraftMessage = /Generate a Patch Draft first\./i.test(
    beforeDraftText,
  );
  report.stage60.generateDisabledWithoutDraft = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Generate Patch Draft Safety Review/i.test(b.textContent || ''),
    );
    return btn ? btn.disabled === true : null;
  })()`);
  report.stage60.previewPlaceholder = /No Patch Draft Safety Review yet/i.test(
    beforeDraftText,
  );

  const blockedSafetyReview = await evaluate(
    `window.nttc.generatePatchDraftSafetyReview()`,
  );
  report.stage60.ipcBlockedWithoutDraft = Boolean(
    !blockedSafetyReview.patchDraftSafetyReview?.saved &&
      /Generate a Patch Draft first/i.test(
        blockedSafetyReview.patchDraftSafetyReview?.statusMessage || "",
      ),
  );
  report.stage60.noOllamaOnBlockedIpc =
    (blockedSafetyReview.patchDraft?.saved ?? null) === null &&
    !blockedSafetyReview.patchDraft?.busy;

  const tsCandidate = candidates.find((c) => /\.tsx?$/.test(c.relativePath));
  if (tsCandidate) {
    snap = await evaluate(
      `window.nttc.setCodeContextFileSelected(${JSON.stringify(tsCandidate.relativePath)}, true)`,
    );
    snap = await evaluate(
      `window.nttc.setCodeContextQuestion("Stage 61 smoke: safety review only.")`,
    );
    snap = await evaluate(`window.nttc.generateCodeContextPreview()`);
    const patchDraftIpc = await evaluate(`window.nttc.generatePatchDraft()`);
    if (patchDraftIpc.patchDraft?.saved) {
      const safetyReviewIpc = await evaluate(
        `window.nttc.generatePatchDraftSafetyReview()`,
      );
      report.stage60.reviewGenerated = Boolean(
        safetyReviewIpc.patchDraftSafetyReview?.saved,
      );
      report.stage60.recommendationInSnapshot =
        safetyReviewIpc.patchDraftSafetyReview?.saved?.recommendation ?? null;
      report.stage60.previewExcerptPresent = Boolean(
        safetyReviewIpc.patchDraftSafetyReview?.saved?.previewExcerpt,
      );
      await clickTab(evaluate, "Reports");
      const afterReviewText = await evaluate(`document.body.innerText`);
      report.stage60.recommendationBadgeInUi =
        /Recommendation badge:/i.test(afterReviewText) &&
        Boolean(safetyReviewIpc.patchDraftSafetyReview?.saved?.recommendation);
      report.stage60.noOllamaOnSafetyReviewIpc =
        !safetyReviewIpc.patchDraft?.busy &&
        (safetyReviewIpc.codeContextAi?.saved ?? null) ===
          (patchDraftIpc.codeContextAi?.saved ?? null);
    } else {
      report.stage60.reviewGenerated = false;
      report.stage60.reviewSkippedReason =
        patchDraftIpc.patchDraft?.statusMessage || "Patch Draft not saved (Ollama may be offline)";
    }
  }

  const afterPkg = fileStatSafe(pkgJsonPath);
  const afterReadme = fileStatSafe(readmePath);
  report.stage52.sourceUnchanged =
    beforePkg.mtimeMs === afterPkg.mtimeMs &&
    beforeReadme.mtimeMs === afterReadme.mtimeMs;

  const reportsText = await evaluate(`document.body.innerText`);
  report.stage52.uiSection = /Code Context Pack — Preview Only/i.test(reportsText);
  report.stage56.uiSection = /Code Question Templates/i.test(reportsText);
  report.stage58.uiSection = /Patch Draft Mode — No Apply/i.test(reportsText);
  report.stage58.noApplyPatchButton = await evaluate(
    `![...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
  );
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
  if (!report.stage60.uiSection) fail("Patch Draft Safety Review section missing");
  if (!report.stage60.generateButton) fail("Generate Patch Draft Safety Review button missing");
  if (!report.stage60.copyButton) fail("Copy Patch Draft Safety Review button missing");
  if (!report.stage60.noDraftMessage) fail("Generate a Patch Draft first message missing");
  if (report.stage60.generateDisabledWithoutDraft !== true) {
    fail("Generate safety review should be disabled without Patch Draft");
  }
  if (!report.stage60.previewPlaceholder) fail("Safety review preview placeholder missing");
  if (!report.stage60.ipcBlockedWithoutDraft) fail("Safety review IPC should block without Patch Draft");
  if (!report.stage52.uiSection) fail("Code Context Pack section missing");
  if (!report.stage56.uiSection) fail("Code Question Templates section missing");
  if (!report.stage58.uiSection) fail("Patch Draft Mode section missing");
  if (!report.stage58.noApplyPatchButton) fail("Apply Patch button unexpectedly present");
  if (!report.projectMemory) fail("Project Memory section missing");
  if (!report.implementationReview) fail("Implementation Review missing");
  if (!report.builderPlanComparison) fail("Builder Plan Comparison missing");
  if (!report.builderPlanMode) fail("Builder Plan Mode missing");
  if (!report.speakerScripts) fail("Speaker Scripts missing");
  if (!report.roleModelMapping) fail("Role Model Mapping missing");
  if (!roleHelp?.panel) fail("Clickable role help modal failed");
  if (!report.stage52.sourceUnchanged) fail("Source files changed after smoke ops");
  if (report.audioTts || !safetyUi.noTtsControl) fail("Audio/TTS unexpectedly present");
  if (report.editMode || !safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (report.arbitraryTerminal) fail("Arbitrary terminal unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");

  console.log(JSON.stringify({ report, project: PROJECT }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
