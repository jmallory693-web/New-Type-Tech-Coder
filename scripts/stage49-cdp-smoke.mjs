/**
 * Stage 49 packaged-app smoke harness (CDP).
 * Stage 48 message polish + Stage 45/46 regressions.
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9229";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";

const MISSING_DEPS_SNIPPET =
  "Dependencies may not be installed in this project folder. NTTC does not install packages.";
const NO_GIT_SNIPPET =
  "No Git repo was found in this folder. Changed-files scan is limited.";
const ONEDRIVE_SNIPPET =
  "This project is inside OneDrive. Sync tools can sometimes lock files";
const LOCAL_AI_SNIPPET = "Local AI timed out while using";
const LOCAL_AI_SUGGESTION =
  "Try a smaller installed model, reduce context, or generate fewer reports before asking.";
const REVIEW_BACKLOG_LABEL = "Review Backlog";

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
  stage48: {
    bundleStrings: null,
    missingDepsHelper: null,
    noGitPatchNote: null,
    onedriveWarning: null,
    reviewBacklogLabel: null,
    localAiMessageStrings: null,
    noInstallButton: null,
  },
  audioTts: null,
  editMode: null,
  arbitraryTerminal: null,
  customCommand: null,
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
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.name.endsWith(".js")) {
        haystack += fs.readFileSync(fullPath, "utf8");
      }
    }
  }
  return haystack;
}

function scanBundleStrings() {
  const rendererHaystack = readJsHaystack(path.join(REPO, "dist", "assets"));
  const mainHaystack = readJsHaystack(path.join(REPO, "dist-electron"));
  const haystack = `${rendererHaystack}\n${mainHaystack}`;
  return {
    missingDeps: haystack.includes(MISSING_DEPS_SNIPPET),
    noGit: haystack.includes(NO_GIT_SNIPPET),
    onedrive: haystack.includes(ONEDRIVE_SNIPPET),
    localAiTimedOut: haystack.includes(LOCAL_AI_SNIPPET),
    localAiSuggestion: haystack.includes(LOCAL_AI_SUGGESTION),
    reviewBacklog: haystack.includes(REVIEW_BACKLOG_LABEL),
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

try {
  report.stage48.bundleStrings = scanBundleStrings();
  if (!report.stage48.bundleStrings.missingDeps) {
    fail("Stage 48 missing-deps copy not found in build output");
  }
  if (!report.stage48.bundleStrings.noGit) {
    fail("Stage 48 no-Git copy not found in build output");
  }
  if (!report.stage48.bundleStrings.onedrive) {
    fail("Stage 48 OneDrive copy not found in build output");
  }
  if (!report.stage48.bundleStrings.localAiTimedOut) {
    fail("Stage 48 Local AI failure copy not found in build output");
  }
  if (!report.stage48.bundleStrings.reviewBacklog) {
    fail("Stage 48 Review Backlog label not found in build output");
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
  report.customCommand = null;

  report.stage48.noInstallButton = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('button')];
    const bad = buttons.filter((b) =>
      /install dependencies|npm install|run install/i.test(b.textContent || ''),
    );
    return { badCount: bad.length, labels: bad.map((b) => b.textContent?.trim()) };
  })()`);

  let snap = await evaluate(`window.nttc.openRecentProject(${JSON.stringify(DISPOSABLE)})`);
  snap = await evaluate(`window.nttc.summarizeProject()`);
  snap = await evaluate(`window.nttc.runSafeCheck('typecheck')`);
  const typecheckSummary = snap.safeChecks?.lastResult?.plainEnglishSummary || "";
  const typecheckOutput = snap.safeChecks?.lastResult?.combinedOutput || "";
  report.stage48.missingDepsHelper =
    typecheckSummary.includes(MISSING_DEPS_SNIPPET) ||
    typecheckSummary.includes("npm install") && typecheckSummary.includes("outside NTTC");
  if (!report.stage48.missingDepsHelper && typecheckOutput) {
    report.stage48.missingDepsHelper = typecheckSummary.includes("Dependencies may not be installed");
  }

  snap = await evaluate(`window.nttc.scanChangedFiles()`);
  snap = await evaluate(`window.nttc.generatePatchReviewPack()`);
  const patchStatus = snap.changedFiles?.statusMessage || "";
  report.stage48.noGitPatchNote = patchStatus.includes(NO_GIT_SNIPPET);

  await clickTab(evaluate, "Dashboard");
  bodyText = await evaluate(`document.body.innerText`);
  report.stage48.onedriveWarning =
    snap.safety?.project?.isOneDrive === true
      ? bodyText.includes(ONEDRIVE_SNIPPET)
      : bodyText.includes(ONEDRIVE_SNIPPET) || report.stage48.bundleStrings.onedrive;

  report.stage48.reviewBacklogLabel =
    bodyText.includes(REVIEW_BACKLOG_LABEL) ||
    report.stage48.bundleStrings.reviewBacklog;

  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  report.liveQwenDisabled =
    report.liveQwenDisabled || /Live Qwen is disabled/i.test(aiText);
  report.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(aiText);
  report.speakerScripts = /Speaker Scripts/i.test(aiText);

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
    await openByPrefix(selected);
    const panel = !!document.querySelector('.role-help-panel');
    document.querySelector('.role-help-close')?.click();
    return { selected, panel, linkCount: document.querySelectorAll('.role-help-link').length };
  })()`);
  report.roleHelp = roleHelp;

  await clickTab(evaluate, "Request / Output");
  const reqText = await evaluate(`document.body.innerText`);
  report.implementationReview = /Implementation Review/i.test(reqText);
  report.builderPlanComparison = /Builder Plan Comparison/i.test(reqText);

  await clickTab(evaluate, "Settings");
  const settingsText = await evaluate(`document.body.innerText`);
  report.roleModelMapping = /Role Model Mapping/i.test(settingsText);

  report.stage48.localAiMessageStrings = report.stage48.bundleStrings.localAiTimedOut &&
    report.stage48.bundleStrings.localAiSuggestion;

  const safetySnap = await evaluate(`window.nttc.getSnapshot()`);
  const safetyUi = await evaluate(`(() => {
    const text = document.body.innerText || '';
    return {
      noEditButton: ![...document.querySelectorAll('button')].some((b) =>
        /Enable Edit Mode/i.test(b.textContent || ''),
      ),
      noTtsControl: ![...document.querySelectorAll('button,input')].some((el) =>
        /\\bTTS\\b|Play audio|Speak aloud/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
      ),
      noCustomCmd: ![...document.querySelectorAll('input,textarea')].some((el) =>
        /custom command|type a command/i.test(el.getAttribute('placeholder') || ''),
      ),
    };
  })()`);

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.inspectOnly) fail("Inspect-only badge missing");
  if (!report.liveQwenDisabled) fail("Live Qwen disabled banner missing");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  if (safetySnap?.safety?.mode !== "inspect-only") fail("Expected inspect-only mode");
  if (!report.implementationReview) fail("Implementation Review missing");
  if (!report.builderPlanComparison) fail("Builder Plan Comparison missing");
  if (!report.builderPlanMode) fail("Builder Plan Mode missing");
  if (!report.speakerScripts) fail("Speaker Scripts missing");
  if (!report.roleModelMapping) fail("Role Model Mapping missing");
  if (!roleHelp?.panel) fail("Clickable role help modal failed");
  if (!report.stage48.missingDepsHelper) {
    fail(`Missing-deps helper not shown after typecheck (summary: ${typecheckSummary.slice(0, 120)})`);
  }
  if (!report.stage48.noGitPatchNote) {
    fail(`No-Git patch note missing (status: ${patchStatus})`);
  }
  if (!report.stage48.onedriveWarning) fail("OneDrive warning copy not visible");
  if (!report.stage48.reviewBacklogLabel) fail("Review Backlog dashboard label not found");
  if (!report.stage48.localAiMessageStrings) fail("Local AI failure message strings missing from build");
  if (report.stage48.noInstallButton?.badCount > 0) {
    fail(`Install button found: ${report.stage48.noInstallButton.labels.join(", ")}`);
  }
  if (report.audioTts || !safetyUi.noTtsControl) fail("Audio/TTS unexpectedly present");
  if (report.editMode || !safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (report.arbitraryTerminal) fail("Arbitrary terminal unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");

  console.log(JSON.stringify({ report, safetySnap: {
    mode: safetySnap.safety?.mode,
    writesAllowed: safetySnap.safety?.writesAllowed,
    liveInspectEnabled: safetySnap.qwen?.liveInspectEnabled,
    isOneDrive: safetySnap.safety?.project?.isOneDrive,
  }, typecheckSummary: typecheckSummary.slice(0, 200), patchStatus }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
