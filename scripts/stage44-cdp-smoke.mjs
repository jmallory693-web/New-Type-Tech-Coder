/**
 * Stage 44 packaged-app smoke harness (CDP).
 * Stage 42 Implementation Review + Stage 42A Ollama dropdown UX + prior stages.
 */
const CDP = "http://127.0.0.1:9226";

const REQUIRED_RESPONSE_TYPES = [
  "Plan only",
  "Implementation report",
  "Error report",
  "Builder plan",
  "Revised builder plan",
  "Unknown",
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
  refreshInstalledModelsBtn: null,
  dropdownUxStrings: null,
  manualAdvancedToggle: null,
  globalFallbackDropdown: null,
  builderPlanUnsetLabel: null,
  roleUnsetLabels: null,
  dropdownsAfterRefresh: null,
  suggestDefaultsBtn: null,
  staleModelWarning: null,
  audioTts: null,
  editMode: null,
  arbitraryTerminal: null,
  customCommand: null,
  refreshResult: null,
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
  await new Promise((r) => setTimeout(r, 500));
}

function inspectRoleMappingPanel(text, html) {
  report.dropdownUxStrings =
    /Refresh Installed Models to fill the dropdowns/i.test(text) &&
    /Manual model names are only for advanced\/offline use/i.test(text) &&
    /Coder models can be selected for patch planning or Builder Plan Mode/i.test(text);

  report.manualAdvancedToggle = /Use manual model name \(advanced\/offline\)/i.test(text);
  report.suggestDefaultsBtn = /Suggest Role Model Defaults/i.test(text);
  report.refreshInstalledModelsBtn = /Refresh Installed Models/i.test(text);

  const selects = html.match(/<select[^>]*id="role-model-[^"]*"[^>]*>[\s\S]*?<\/select>/gi) || [];
  const globalSelect = /id="global-fallback-model"[^>]*>[\s\S]*?<\/select>/i.test(html);

  report.builderPlanUnsetLabel = /Unset \/ use Patch Planner or fallback/i.test(html);
  report.roleUnsetLabels = /Unset \/ use fallback/i.test(html);

  return { selects, globalSelect };
}

try {
  const { page, send, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  let bodyText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  let html = await evaluate(send, `document.documentElement.outerHTML`);

  report.inspectOnly = /Inspect-only/i.test(bodyText) || /Inspect-only/i.test(html);
  report.liveQwenDisabled = /Live Qwen is disabled/i.test(bodyText);
  await clickTab(send, "AI Review");
  const aiTextEarly = await evaluate(send, `document.body ? document.body.innerText : ''`);
  report.liveQwenDisabled =
    report.liveQwenDisabled || /Live Qwen is disabled/i.test(aiTextEarly);
  report.audioTts = /text-to-speech|\bTTS\b|Play audio|Speak aloud/i.test(bodyText);
  report.editMode = /Enable Edit Mode|Edit Mode Available:\s*Yes/i.test(bodyText);
  report.arbitraryTerminal = /Open Terminal|Arbitrary terminal|Run any command/i.test(bodyText);
  report.customCommand = /Custom command|Type a command to run/i.test(bodyText);

  await clickTab(send, "AI Review");
  const aiText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  report.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(aiText);
  report.speakerScripts = /Speaker Scripts/i.test(aiText);

  await clickTab(send, "Request / Output");
  const reqText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  report.implementationReview = /Implementation Review/i.test(reqText);
  report.builderPlanComparison = /Builder Plan Comparison/i.test(reqText);

  await clickTab(send, "Settings");
  bodyText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  html = await evaluate(send, `document.documentElement.outerHTML`);
  report.roleModelMapping = /Role Model Mapping/i.test(bodyText);

  let panel = inspectRoleMappingPanel(bodyText, html);

  // Try refresh installed models (may succeed if Ollama is running locally)
  report.refreshResult = await evaluate(
    send,
    `typeof window.nttc === 'object'
      ? window.nttc.refreshInstalledModels().then((s) => ({
          ok: s.installedModels?.lastRefreshOk,
          count: s.installedModels?.models?.length ?? 0,
          message: s.installedModels?.lastRefreshMessage ?? null,
        })).catch((e) => ({ ok: false, count: 0, message: String(e) }))
      : { ok: false, count: 0, message: 'no bridge' }`,
  );

  await new Promise((r) => setTimeout(r, 800));
  bodyText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  html = await evaluate(send, `document.documentElement.outerHTML`);
  panel = inspectRoleMappingPanel(bodyText, html);

  const dropdownInfo = await evaluate(
    send,
    `(() => {
      const roleSelects = [...document.querySelectorAll('select[id^="role-model-"]')];
      const globalEl = document.querySelector('#global-fallback-model');
      const getOpts = (sel) => {
        if (!sel || sel.tagName !== 'SELECT') return [];
        return Array.from(sel.options).map((o) => (o.textContent || '').trim());
      };
      const builderSel = document.querySelector('#role-model-builder-plan-mode');
      return {
        roleSelectCount: roleSelects.length,
        globalIsSelect: globalEl?.tagName === 'SELECT',
        globalIsInput: globalEl?.tagName === 'INPUT',
        globalOpts: getOpts(globalEl),
        builderOpts: getOpts(builderSel),
        anyRoleOpts: roleSelects[0] ? getOpts(roleSelects[0]) : [],
        manualCheckboxes: [...document.querySelectorAll('input[type=checkbox]')].filter((c) =>
          (c.parentElement?.textContent || '').includes('Use manual model name'),
        ).length,
        visibleManualInputs: [...document.querySelectorAll('input[id^="role-model-"]')].filter(
          (i) => i.offsetParent !== null,
        ).length,
      };
    })()`,
  );

  if (report.refreshResult?.ok && report.refreshResult.count > 0) {
    report.dropdownsAfterRefresh =
      dropdownInfo.roleSelectCount >= 10 &&
      dropdownInfo.globalIsSelect &&
      dropdownInfo.builderOpts.some((o) => /Patch Planner or fallback/i.test(o)) &&
      dropdownInfo.anyRoleOpts.some((o) => /Unset \/ use fallback/i.test(o)) &&
      dropdownInfo.anyRoleOpts.length >= 2;
    report.globalFallbackDropdown = dropdownInfo.globalIsSelect;
  } else {
    // Offline / no Ollama: manual advanced UI should be available
    report.dropdownsAfterRefresh =
      report.manualAdvancedToggle &&
      (dropdownInfo.manualCheckboxes > 0 || dropdownInfo.visibleManualInputs > 0);
    report.globalFallbackDropdown = /Global Fallback Model/i.test(bodyText);
  }

  // Stale model warning: set fake mapping then check warning
  await evaluate(
    send,
    `typeof window.nttc === 'object'
      ? window.nttc.setRoleModelMapping('patch-planner', 'nttc-smoke-stale-model-42a')
      : null`,
  );
  await new Promise((r) => setTimeout(r, 400));
  const afterStale = await evaluate(send, `document.body ? document.body.innerText : ''`);
  report.staleModelWarning =
    /nttc-smoke-stale-model-42a/i.test(afterStale) &&
    /not in the installed models cache/i.test(afterStale);

  // Suggested defaults from installed cache
  if (report.refreshResult?.ok && report.refreshResult.count > 0) {
    const before = await evaluate(
      send,
      `window.nttc.getSnapshot().then((s) => JSON.stringify(s.roleModelMapping?.mappings ?? {}))`,
    );
    await evaluate(send, `window.nttc.suggestRoleModelDefaults()`);
    await new Promise((r) => setTimeout(r, 400));
    const after = await evaluate(
      send,
      `window.nttc.getSnapshot().then((s) => {
        const m = s.roleModelMapping?.mappings ?? {};
        const filled = Object.values(m).filter((v) => typeof v === 'string' && v.trim()).length;
        return { filled, mappings: m };
      })`,
    );
    if (!after?.filled || after.filled < 1) {
      fail("Suggested Defaults did not fill role mappings from installed models");
    }
  }

  const snap = await evaluate(
    send,
    `window.nttc.getSnapshot().then((s) => ({
      mode: s.safety?.mode,
      writesAllowed: s.safety?.writesAllowed,
      editModeAvailable: s.safety?.editModeAvailable,
      liveInspectEnabled: s.qwen?.liveInspectEnabled,
      hasImplementationReview: !!s.implementationReview,
      hasComparison: !!s.builderPlanComparison,
      hasRoleMapping: !!s.roleModelMapping,
      suggestDefaults: typeof window.nttc.suggestRoleModelDefaults === 'function',
    }))`,
  );

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.inspectOnly) fail("Inspect-only badge missing");
  if (!report.liveQwenDisabled) fail("Live Qwen disabled banner missing");
  if (snap?.liveInspectEnabled) fail("Live Qwen should be disabled");
  if (snap?.mode !== "inspect-only") fail(`Expected inspect-only, got ${snap?.mode}`);
  if (!report.implementationReview) fail("Implementation Review missing");
  if (!report.builderPlanComparison) fail("Builder Plan Comparison missing");
  if (!report.builderPlanMode) fail("Builder Plan Mode missing");
  if (!report.speakerScripts) fail("Speaker Scripts missing");
  if (!report.roleModelMapping) fail("Role Model Mapping missing");
  if (!report.refreshInstalledModelsBtn) fail("Refresh Installed Models missing");
  if (!report.dropdownUxStrings) fail("Stage 42A helper text missing");
  if (!report.manualAdvancedToggle) fail("Manual advanced/offline toggle missing");
  if (!report.suggestDefaultsBtn) fail("Suggest Role Model Defaults missing");
  if (!report.dropdownsAfterRefresh) {
    fail(
      `Dropdown UX check failed (refresh ok=${report.refreshResult?.ok}, models=${report.refreshResult?.count})`,
    );
  }
  if (!report.builderPlanUnsetLabel && report.refreshResult?.ok) {
    fail("Builder Plan Mode unset label missing from dropdown");
  }
  if (!report.roleUnsetLabels && report.refreshResult?.ok) {
    fail("Role unset label missing from dropdown");
  }
  if (!report.staleModelWarning) fail("Stale/missing model warning missing");
  if (report.audioTts) fail("Audio/TTS unexpectedly present");
  if (report.editMode) fail("Edit mode unexpectedly present");
  if (report.arbitraryTerminal) fail("Arbitrary terminal unexpectedly present");
  if (report.customCommand) fail("Custom command unexpectedly present");

  console.log(JSON.stringify({ report, snap, dropdownInfo, refreshResult: report.refreshResult }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
