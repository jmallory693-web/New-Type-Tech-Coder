/**
 * Stage 39 packaged-app smoke harness (CDP).
 * Read-only UI/DOM checks — no product code changes.
 */
const CDP = "http://127.0.0.1:9223";

const report = {
  launched: false,
  title: null,
  pageUrl: null,
  usesVite: null,
  inspectOnly: null,
  liveQwenDisabled: null,
  builderPlanMode: null,
  installedModels: null,
  roleModelMapping: null,
  suggestDefaults: null,
  roleModelShown: null,
  builderPlanModelShown: null,
  speakerScripts: null,
  audioTts: null,
  editMode: null,
  arbitraryTerminal: null,
  customCommand: null,
  stage38aStartup: null,
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
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
  await send("DOM.enable");
  return { page, send, ws };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function clickTab(send, label) {
  await evaluate(
    send,
    `(() => {
      const tabs = [...document.querySelectorAll('button, [role="tab"]')];
      const tab = tabs.find((el) => (el.textContent || '').includes(${JSON.stringify(label)}));
      if (!tab) return false;
      tab.click();
      return true;
    })()`,
  );
  await new Promise((r) => setTimeout(r, 400));
}

try {
  const { page, send, ws } = await connect();
  report.launched = true;
  report.title = page.title;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const bodyText = await evaluate(
    send,
    `document.body ? document.body.innerText : ''`,
  );
  const html = await evaluate(send, `document.documentElement.outerHTML`);

  report.inspectOnly =
    /Inspect-only|Inspect \/ review only|inspect-only/i.test(bodyText) ||
    /Inspect-only/i.test(html);
  report.liveQwenDisabled = /Live Qwen is disabled/i.test(bodyText);
  report.audioTts = /text-to-speech|TTS|Play audio|Speak aloud/i.test(bodyText);
  report.editMode = /Enable Edit Mode|Edit Mode Available:\s*Yes/i.test(bodyText);
  report.arbitraryTerminal =
    /Open Terminal|Arbitrary terminal|Run any command/i.test(bodyText);
  report.customCommand =
    /Custom command|Type a command to run/i.test(bodyText);

  await clickTab(send, "AI Review");
  const aiText = await evaluate(
    send,
    `document.body ? document.body.innerText : ''`,
  );
  report.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(aiText);
  report.speakerScripts = /Speaker Scripts/i.test(aiText);
  report.roleModelShown = /Model for this role:/i.test(aiText);
  report.builderPlanModelShown = /Model for Builder Plan Mode:/i.test(aiText);
  report.liveQwenDisabled =
    report.liveQwenDisabled || /Live Qwen is disabled/i.test(aiText);

  await clickTab(send, "Settings");
  const settingsText = await evaluate(
    send,
    `document.body ? document.body.innerText : ''`,
  );
  report.installedModels = /Installed Ollama Models/i.test(settingsText);
  report.roleModelMapping = /Role Model Mapping/i.test(settingsText);
  report.suggestDefaults = /Suggest Role Model Defaults/i.test(settingsText);
  const refreshBtn = await evaluate(
    send,
    `!![...document.querySelectorAll('button')].find((b) => (b.textContent||'').includes('Refresh Installed Models'))`,
  );
  report.installedModels = report.installedModels && refreshBtn;

  const snap = await evaluate(
    send,
    `typeof window.nttc === 'object' && window.nttc.getSnapshot
      ? window.nttc.getSnapshot().then((s) => ({
          mode: s.safety?.mode,
          writesAllowed: s.safety?.writesAllowed,
          editModeAvailable: s.safety?.editModeAvailable,
          log0: s.actionLog?.[0]?.detail || s.actionLog?.find(e => /App started/i.test(e.message||''))?.detail || null,
          hasBuilderPlan: !!s.builderPlan,
          hasInstalledModels: !!s.installedModels,
          hasRoleMapping: !!s.roleModelMapping,
          hasSpeaker: !!s.speakerScript,
        }))
      : { bridgeMissing: true }`,
  );

  if (snap?.bridgeMissing) fail("window.nttc bridge missing in packaged app");
  if (snap?.mode !== "inspect-only") fail(`Expected inspect-only, got ${snap?.mode}`);
  if (snap?.writesAllowed) fail("writesAllowed should be false");
  if (snap?.editModeAvailable) fail("editModeAvailable should be false");
  if (!snap?.hasBuilderPlan) fail("builderPlan missing from snapshot");
  if (!snap?.hasInstalledModels) fail("installedModels missing from snapshot");
  if (!snap?.hasRoleMapping) fail("roleModelMapping missing from snapshot");
  if (!snap?.hasSpeaker) fail("speakerScript missing from snapshot");
  report.stage38aStartup = /Stage 38A/i.test(String(snap?.log0 || ""));
  report.inspectOnly = report.inspectOnly || snap?.mode === "inspect-only";

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.builderPlanMode) fail("Builder Plan Mode UI missing");
  if (!report.installedModels) fail("Installed Ollama Models / Refresh missing");
  if (!report.roleModelMapping) fail("Role Model Mapping missing");
  if (!report.suggestDefaults) fail("Suggest Role Model Defaults missing");
  if (!report.roleModelShown) fail("AI Review role model label missing");
  if (!report.builderPlanModelShown) fail("Builder Plan model label missing");
  if (!report.speakerScripts) fail("Speaker Scripts missing");
  if (report.audioTts) fail("Audio/TTS controls unexpectedly present");
  if (!report.liveQwenDisabled) fail("Live Qwen disabled banner missing");
  if (report.editMode) fail("Edit mode UI unexpectedly present");
  if (report.arbitraryTerminal) fail("Arbitrary terminal UI unexpectedly present");
  if (report.customCommand) fail("Custom command UI unexpectedly present");

  console.log(JSON.stringify({ report, snap }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
