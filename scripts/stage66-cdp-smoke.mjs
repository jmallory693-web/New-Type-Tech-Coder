/**
 * Stage 66 packaged-app smoke harness (CDP).
 * Stage 65 persistent Ollama status bubble + regressions.
 *
 * Launch packaged app first:
 *   "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9238
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9238";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage65: {},
  regressions: {},
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
  return {
    ollamaNotChecked: haystack.includes("Ollama: Not checked"),
    ollamaChecking: haystack.includes("Ollama: Checking"),
    ollamaActive: haystack.includes("Ollama: Active"),
    ollamaOffline: haystack.includes("Ollama: Offline"),
    ollamaError: haystack.includes("Ollama: Error"),
    liveQwenNote: haystack.includes(
      "Live Qwen inspect remains disabled",
    ),
    checkOllamaIpc: haystack.includes("nttc:check-ollama-status"),
    statusCheckStarted: haystack.includes("Ollama status check started"),
    statusActiveLog: haystack.includes("Ollama status active"),
    bubbleClickedLog: haystack.includes("Ollama status bubble clicked"),
    refreshStatusLog: haystack.includes(
      "Ollama status updated from model refresh",
    ),
    codeContextSection: haystack.includes("Code Context Pack — Preview Only"),
    askCodeAiSection: haystack.includes("Ask Local AI About Selected Code"),
    patchDraftSection: haystack.includes("Patch Draft Mode — No Apply"),
    safetyReviewSection: haystack.includes("Patch Draft Safety Review"),
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
    confirmCodeAi: haystack.includes(
      "Send this approved Code Context Pack to Local AI",
    ),
    confirmPatchDraft: haystack.includes(
      "Send this approved Code Context Pack to Local AI for a patch draft",
    ),
    noApplyPatchButton: !haystack.includes("Apply Patch"),
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
  report.stage65.bundleStrings = bundle;
  for (const [key, ok] of Object.entries(bundle)) {
    if (key === "noApplyPatchButton") {
      if (!ok) fail("Apply Patch button string found in bundle");
      continue;
    }
    if (!ok) fail(`Stage 65/66 bundle string missing: ${key}`);
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const headerText = await evaluate(`document.body.innerText`);
  report.stage65.bubbleInHeader = /Ollama: Not checked/i.test(headerText);
  report.stage65.inspectOnly = /Inspect-only/i.test(headerText);
  report.stage65.liveQwenDisabled = /Live Qwen disabled/i.test(headerText);

  const initialSnap = await evaluate(`window.nttc.getSnapshot()`);
  report.stage65.defaultStatus = initialSnap.ollamaStatus?.status ?? null;
  report.stage65.defaultTooltip = initialSnap.ollamaStatus?.tooltip ?? null;

  const tabs = ["Reports", "AI Review", "Settings", "Request / Output"];
  report.stage65.visibleOnTabs = {};
  for (const tab of tabs) {
    await clickTab(evaluate, tab);
    const text = await evaluate(`document.body.innerText`);
    report.stage65.visibleOnTabs[tab] = /Ollama:/i.test(text);
  }

  const bubble = await evaluate(`(() => {
    const btn = document.querySelector('.ollama-status-bubble');
    return btn ? { exists: true, title: btn.getAttribute('title') || '', label: btn.textContent || '' } : { exists: false };
  })()`);
  report.stage65.bubbleElement = bubble;

  const beforePkg = fileStatSafe(path.join(PROJECT, "package.json"));
  const checkSnap = await evaluate(`window.nttc.checkOllamaStatus()`);
  const afterPkg = fileStatSafe(path.join(PROJECT, "package.json"));

  report.stage65.afterBubbleClick = {
    status: checkSnap.ollamaStatus?.status,
    tooltip: checkSnap.ollamaStatus?.tooltip,
    modelCount: checkSnap.ollamaStatus?.installedModelCount,
    baseUrl: checkSnap.ollamaStatus?.baseUrl,
    modelName: checkSnap.ollamaStatus?.modelName,
    lastCheckedAt: checkSnap.ollamaStatus?.lastCheckedAt,
    actionLogHasBubbleClick: (checkSnap.actionLog ?? []).some((e) =>
      /Ollama status bubble clicked/i.test(e.message),
    ),
    actionLogHasCheckStarted: (checkSnap.actionLog ?? []).some((e) =>
      /Ollama status check started/i.test(e.message),
    ),
  };

  report.stage65.tooltipHasLiveQwenNote =
    /Live Qwen inspect remains disabled/i.test(
      checkSnap.ollamaStatus?.tooltip || "",
    );
  report.stage65.tooltipHasBaseUrl = /127\.0\.0\.1|localhost/i.test(
    checkSnap.ollamaStatus?.tooltip || "",
  );
  report.stage65.tooltipHasLastChecked = /last checked/i.test(
    checkSnap.ollamaStatus?.tooltip || "",
  );

  const refreshSnap = await evaluate(`window.nttc.refreshInstalledModels()`);
  report.stage65.afterRefresh = {
    status: refreshSnap.ollamaStatus?.status,
    modelCount: refreshSnap.ollamaStatus?.installedModelCount,
    refreshLog: (refreshSnap.actionLog ?? []).some((e) =>
      /Ollama status updated from model refresh/i.test(e.message),
    ),
  };

  const resetSnap = await evaluate(
    `window.nttc.updateProviderSettings({ baseUrl: "http://127.0.0.1:11434", modelName: "qwen2.5-coder:7b" })`,
  );
  report.stage65.afterSettingsTouch = resetSnap.ollamaStatus?.status;

  const badUrlSnap = await evaluate(
    `window.nttc.updateProviderSettings({ baseUrl: "http://127.0.0.1:59999", modelName: "qwen2.5-coder:7b" })`,
  );
  report.stage65.afterBadUrlReset =
    badUrlSnap.ollamaStatus?.status === "not-checked";

  const offlineSnap = await evaluate(`window.nttc.checkOllamaStatus()`);
  report.stage65.offlineOrError = offlineSnap.ollamaStatus?.status;

  await evaluate(
    `window.nttc.updateProviderSettings({ baseUrl: "http://127.0.0.1:11434", modelName: "qwen2.5-coder:7b" })`,
  );
  const testSnap = await evaluate(`window.nttc.testProviderConnection()`);
  report.stage65.afterTestConnection = testSnap.ollamaStatus?.status;

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.regressions = {
    codeContextPack: /Code Context Pack — Preview Only/i.test(reportsText),
    askCodeAi: /Ask Local AI About Selected Code/i.test(reportsText),
    patchDraft: /Patch Draft Mode — No Apply/i.test(reportsText),
    safetyReview: /Patch Draft Safety Review/i.test(reportsText),
    projectMemory: /Project Memory \/ Handoff Files/i.test(reportsText),
    sourceUnchanged: beforePkg.mtimeMs === afterPkg.mtimeMs,
    noApplyPatch: await evaluate(
      `![...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    ),
  };

  await clickTab(evaluate, "AI Review");
  report.regressions.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(
    await evaluate(`document.body.innerText`),
  );
  report.regressions.speakerScripts = /Speaker Scripts/i.test(
    await evaluate(`document.body.innerText`),
  );

  await clickTab(evaluate, "Request / Output");
  const reqText = await evaluate(`document.body.innerText`);
  report.regressions.implementationReview = /Implementation Review/i.test(reqText);
  report.regressions.builderPlanComparison = /Builder Plan Comparison/i.test(reqText);

  await clickTab(evaluate, "Settings");
  report.regressions.roleModelMapping = /Role Model Mapping/i.test(
    await evaluate(`document.body.innerText`),
  );

  const safetyUi = await evaluate(`(() => ({
    noEditButton: ![...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || '')),
    noTtsControl: ![...document.querySelectorAll('button,input')].some((el) =>
      /\\bTTS\\b|Play audio|Speak aloud/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
    ),
    noCustomCmd: ![...document.querySelectorAll('input,textarea')].some((el) =>
      /custom command|type a command/i.test(el.getAttribute('placeholder') || ''),
    ),
  }))()`);

  const safetySnap = await evaluate(`window.nttc.getSnapshot()`);

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.stage65.bubbleInHeader) fail("Ollama bubble missing from header");
  if (report.stage65.defaultStatus !== "not-checked") {
    fail(`Expected default not-checked, got ${report.stage65.defaultStatus}`);
  }
  if (!bubble?.exists) fail("Ollama status bubble element missing");
  if (!report.stage65.afterBubbleClick.actionLogHasBubbleClick) {
    fail("Bubble click not logged");
  }
  if (!report.stage65.tooltipHasLiveQwenNote) fail("Tooltip missing Live Qwen note");
  if (!report.stage65.afterBubbleClick.actionLogHasCheckStarted) {
    fail("Status check started not logged");
  }
  for (const [tab, ok] of Object.entries(report.stage65.visibleOnTabs)) {
    if (!ok) fail(`Ollama status not visible on tab: ${tab}`);
  }
  if (!["active", "offline", "error"].includes(report.stage65.afterBubbleClick.status)) {
    fail(`Unexpected status after bubble click: ${report.stage65.afterBubbleClick.status}`);
  }
  if (!report.regressions.sourceUnchanged) fail("Source files changed after smoke");
  if (!safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (!safetyUi.noTtsControl) fail("TTS unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  for (const [key, ok] of Object.entries(report.regressions)) {
    if (!ok) fail(`Regression failed: ${key}`);
  }

  console.log(JSON.stringify({ report, project: PROJECT }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
