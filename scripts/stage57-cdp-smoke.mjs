/**
 * Stage 57 packaged-app smoke harness (CDP).
 * Stage 56 Code Question Templates + Stage 54/52 regressions.
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9233";
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
  stage54: {
    bundleStrings: null,
    uiSection: null,
    askButton: null,
    copyResponseButton: null,
    codeReviewerMapping: null,
    codeReviewerModelSelect: null,
    askDisabledWithoutPack: null,
    noAiOnPackGenerate: null,
    confirmStringsInBundle: null,
    ipcBlockedWithoutPack: null,
    packOnlyPrompt: null,
    roleHelpCodeReviewer: null,
  },
  stage56: {
    bundleStrings: null,
    uiSection: null,
    templateButtons: null,
    clearButton: null,
    replaceFillsQuestion: null,
    appendPreservesText: null,
    clearWorks: null,
    templateMetadataStored: null,
    noAiOnTemplateClick: null,
    confirmGateInBundle: null,
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
    confirmExcerptsOnly: haystack.includes("Only selected excerpts are sent"),
    confirmNoEdits: haystack.includes("No source files are edited"),
    confirmNoCommands: haystack.includes("No commands are run"),
    confirmNoHiddenAccess: haystack.includes(
      "No hidden file access is granted",
    ),
    packWarningCopy: haystack.includes("warnings or truncation"),
    previewOnlyNote: haystack.includes("does not send anything to AI"),
    packOnlySendNote: haystack.includes(
      "cannot browse your project or edit files",
    ),
    approvedPackOnly: main.includes("Approved Code Context Pack"),
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
    codeQuestionTemplatesSection: haystack.includes("Code Question Templates"),
    clearCodeQuestion: haystack.includes("Clear Code Question"),
    templateLabels: stage56Labels,
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
  for (const [key, ok] of Object.entries(bundle)) {
    if (key === "templateLabels") {
      for (const [label, labelOk] of Object.entries(ok)) {
        if (!labelOk) fail(`Stage 56 bundle label missing: ${label}`);
      }
      continue;
    }
    if (!ok) fail(`Stage 54/56 bundle string missing: ${key}`);
  }

  report.stage54.packOnlyPrompt = fs
    .readFileSync(
      path.join(
        REPO,
        "dist-electron",
        "main",
        "codeContext",
        "buildCodeContextAiPrompt.js",
      ),
      "utf8",
    )
    .includes("Approved Code Context Pack");

  report.stage56.confirmGateInBundle = bundle.confirmSendPack;

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  let bodyText = await evaluate(`document.body ? document.body.innerText : ''`);
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
  snap = await evaluate(`window.nttc.generateDecisionReport()`);

  snap = await evaluate(`window.nttc.refreshCodeContextFileList()`);
  const candidates = snap.codeContext?.candidates ?? [];
  report.stage52.fileListAfterRefresh = candidates.length;
  report.stage52.denyDirsExcluded = DENY_DIRS.every((dir) =>
    candidates.every((c) => !c.relativePath.split(/[\\/]/).includes(dir)),
  );

  await clickTab(evaluate, "Reports");
  const beforePackUi = await evaluate(`(() => {
    const ask = [...document.querySelectorAll('button')].find((b) =>
      /Ask Local AI About Code/i.test(b.textContent || ''),
    );
    return {
      section: /Ask Local AI About Selected Code/i.test(document.body.innerText),
      askExists: !!ask,
      askDisabled: ask ? ask.disabled : null,
      placeholder: /Generate a Code Context Pack preview above/i.test(document.body.innerText),
    };
  })()`);
  report.stage54.uiSection = beforePackUi.section;
  report.stage54.askDisabledWithoutPack =
    beforePackUi.askDisabled === true || beforePackUi.placeholder;

  const tsCandidate = candidates.find((c) => /\.tsx?$/.test(c.relativePath));
  if (!tsCandidate) fail(`No .ts/.tsx candidate found in project ${PROJECT}`);

  snap = await evaluate(
    `window.nttc.setCodeContextFileSelected(${JSON.stringify(tsCandidate.relativePath)}, true)`,
  );
  report.stage52.safeFileSelectable = snap.codeContext?.selectedCount === 1;

  snap = await evaluate(
    `window.nttc.setCodeContextQuestion("Stage 57 smoke: explain selected code safely.")`,
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
  report.stage54.noAiOnPackGenerate =
    (snap.codeContextAi?.saved ?? null) === null && !snap.codeContextAi?.busy;

  const afterPkg = fileStatSafe(pkgJsonPath);
  const afterReadme = fileStatSafe(readmePath);
  report.stage52.sourceUnchanged =
    beforePkg.mtimeMs === afterPkg.mtimeMs &&
    beforeReadme.mtimeMs === afterReadme.mtimeMs;

  const blockedIpc = await evaluate(`window.nttc.askLocalAiAboutCodeContext()`);
  report.stage54.ipcBlockedWithoutPack = Boolean(
    blockedIpc.codeContext?.preview?.markdownReport &&
      !blockedIpc.codeContextAi?.saved &&
      /provider is not ready|Generate a Code Context Pack|confirm/i.test(
        blockedIpc.codeContextAi?.statusMessage || "",
      ),
  );

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.stage52.uiSection = /Code Context Pack — Preview Only/i.test(reportsText);
  report.stage56.uiSection = /Code Question Templates/i.test(reportsText);
  report.stage56.templateButtons = Object.fromEntries(
    TEMPLATE_LABELS.map((label) => [label, reportsText.includes(label)]),
  );
  report.stage56.clearButton = /Clear Code Question/i.test(reportsText);

  report.stage54.askButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Ask Local AI About Code/i.test(b.textContent || ''))`,
  );
  report.stage54.copyResponseButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Copy Code AI Response/i.test(b.textContent || ''))`,
  );
  report.stage52.refreshButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Refresh Safe File List/i.test(b.textContent || ''))`,
  );
  report.stage52.generateButton = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Generate Code Context Preview/i.test(b.textContent || ''))`,
  );

  const aiBeforeTemplate = await evaluate(`window.nttc.getSnapshot()`);
  snap = await evaluate(
    `window.nttc.applyCodeQuestionTemplate("explain-selected-code", "replace")`,
  );
  const replaceQuestion = snap.codeContext?.codeQuestion ?? "";
  report.stage56.replaceFillsQuestion =
    /Explain what the selected code does in plain English/i.test(replaceQuestion);
  report.stage56.templateMetadataStored = Boolean(
    snap.codeContext?.selectedTemplate?.templateLabel === "Explain selected code",
  );
  report.stage56.noAiOnTemplateClick =
    (snap.codeContextAi?.saved ?? null) === null &&
    !snap.codeContextAi?.busy &&
    aiBeforeTemplate.codeContextAi?.saved === snap.codeContextAi?.saved;

  snap = await evaluate(
    `window.nttc.setCodeContextQuestion("Keep this user text.")`,
  );
  snap = await evaluate(
    `window.nttc.applyCodeQuestionTemplate("find-likely-bugs", "append")`,
  );
  const appendQuestion = snap.codeContext?.codeQuestion ?? "";
  report.stage56.appendPreservesText =
    appendQuestion.includes("Keep this user text.") &&
    appendQuestion.includes("---") &&
    /Review the selected code for likely bugs/i.test(appendQuestion);

  snap = await evaluate(`window.nttc.clearCodeContextQuestion()`);
  report.stage56.clearWorks = (snap.codeContext?.codeQuestion ?? "") === "";

  report.projectMemory = /Project Memory \/ Handoff Files/i.test(reportsText);

  const codeReviewerHelp = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('.role-help-link')].find((el) =>
      (el.textContent || '').includes('Code Reviewer'),
    );
    if (!btn) return { found: false, panel: false };
    btn.click();
    await new Promise((r) => setTimeout(r, 350));
    const panel = !!document.querySelector('.role-help-panel');
    document.querySelector('.role-help-close')?.click();
    return { found: true, panel };
  })()`);
  report.stage54.roleHelpCodeReviewer = codeReviewerHelp;

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
  report.stage54.codeReviewerMapping = /Code Reviewer/i.test(settingsText);
  report.stage54.codeReviewerModelSelect = await evaluate(
    `[...document.querySelectorAll('select')].some((sel) => {
      const row = sel.closest('tr, .field-value, label, div');
      return row && /Code Reviewer/i.test(row.textContent || '');
    })`,
  );

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

  report.stage54.confirmStringsInBundle = bundle.confirmSendPack;

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.inspectOnly) fail("Inspect-only badge missing");
  if (!report.liveQwenDisabled) fail("Live Qwen disabled banner missing");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  if (safetySnap?.safety?.mode !== "inspect-only") fail("Expected inspect-only mode");
  if (!report.stage52.uiSection) fail("Code Context Pack section missing");
  if (!report.stage54.uiSection) fail("Ask Local AI About Selected Code section missing");
  if (!report.stage56.uiSection) fail("Code Question Templates section missing");
  for (const [label, ok] of Object.entries(report.stage56.templateButtons ?? {})) {
    if (!ok) fail(`Template button missing in UI: ${label}`);
  }
  if (!report.stage56.clearButton) fail("Clear Code Question button missing");
  if (!report.stage56.replaceFillsQuestion) fail("Replace template did not fill question");
  if (!report.stage56.appendPreservesText) fail("Append template did not preserve user text");
  if (!report.stage56.clearWorks) fail("Clear Code Question did not clear field");
  if (!report.stage56.templateMetadataStored) fail("Template metadata not stored");
  if (!report.stage56.noAiOnTemplateClick) fail("Template click should not call AI");
  if (!report.stage56.confirmGateInBundle) fail("Confirmation gate strings missing from bundle");
  if (!report.stage54.askButton) fail("Ask Local AI About Code button missing");
  if (!report.stage54.copyResponseButton) fail("Copy Code AI Response button missing");
  if (!report.stage54.noAiOnPackGenerate) {
    fail("Pack preview generation should not create Code AI response");
  }
  if (!report.stage54.packOnlyPrompt) {
    fail("Code AI prompt builder missing approved-pack-only guard");
  }
  if (!report.stage54.codeReviewerMapping) fail("Code Reviewer missing from Role Model Mapping");
  if (!report.stage54.codeReviewerModelSelect) fail("Code Reviewer model dropdown missing");
  if (!codeReviewerHelp?.panel) fail("Code Reviewer clickable help failed");
  for (const [section, ok] of Object.entries(report.stage52.previewSections ?? {})) {
    if (!ok) fail(`Preview missing section: ${section}`);
  }
  if (!report.stage52.blockedNotIncluded) fail("Blocked/secret content may be in pack");
  if (!report.stage52.sourceUnchanged) fail("Source files changed after code context ops");
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
          warnings: preview?.warningCount,
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
