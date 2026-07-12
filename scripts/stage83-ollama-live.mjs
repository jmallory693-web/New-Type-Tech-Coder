/** Supplementary Stage 83 live Ollama planner test (requires app on CDP 9239). */
const CDP = "http://127.0.0.1:9239";

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
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
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  return { evaluate, ws };
}

const IDEA =
  "I want to build a simple offline recipe manager for Windows. It should store recipes locally, allow search, tags, ingredients, meal planning, and export. I am a non-coder and want it built in small safe phases.";

const { evaluate, ws } = await connect();
await evaluate(`window.nttc.testProviderConnection()`);
await new Promise((r) => setTimeout(r, 3000));
let snap = await evaluate(`window.nttc.getSnapshot()`);
const out = {
  ollamaReady:
    snap.provider?.connected && snap.provider?.connectionState === "ready",
  provider: snap.provider,
  bubbleBefore: snap.ollamaStatus?.status,
};

if (!out.ollamaReady) {
  console.log(JSON.stringify({ ...out, skipped: "Ollama not ready after test connection" }, null, 2));
  ws.close();
  process.exit(1);
}

await evaluate(
  `window.nttc.setBlueprintIntake(${JSON.stringify({
    projectIdea: IDEA,
    answersClarifications: "Offline only. Windows desktop.",
    buildStyle: "small-model-friendly",
  })})`,
);
await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
await new Promise((r) => setTimeout(r, 600));

const logBefore = snap.actionLog?.length ?? 0;
await evaluate(`window.nttc.askLocalPlannerAi()`);
const start = Date.now();
while (Date.now() - start < 180000) {
  snap = await evaluate(`window.nttc.getSnapshot()`);
  if (snap.blueprint?.plannerAi?.saved?.responseText) break;
  if (
    !snap.blueprint?.plannerAi?.busy &&
    /failed|timed out|blocked|empty|not ready/i.test(
      snap.blueprint?.plannerAi?.statusMessage ?? "",
    )
  ) {
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}

const draft = snap.blueprint?.plannerAi?.saved;
const newLogs = (snap.actionLog ?? []).slice(0, Math.max(0, (snap.actionLog?.length ?? 0) - logBefore));
out.live = {
  completed: Boolean(draft?.responseText),
  model: draft?.modelName ?? null,
  baseUrl: draft?.baseUrl ?? null,
  elapsedMs: draft?.elapsedMs ?? null,
  sectionsPresent: draft?.sectionsPresent?.length ?? 0,
  sectionsMissing: draft?.sectionsMissing?.length ?? 0,
  readiness: draft?.readinessEstimate ?? null,
  truncated: draft?.truncatedResponse ?? false,
  preview: Boolean(draft?.previewExcerpt),
  status: snap.blueprint?.plannerAi?.statusMessage ?? null,
  bubbleAfter: snap.ollamaStatus?.status,
  startedLog: newLogs.some((e) => /Local Planner AI started/i.test(e.message)),
  completedLog: newLogs.some((e) => /Local Planner AI completed/i.test(e.message)),
  boundaryLog: newLogs.some((e) =>
    /idea\/planning fields only/i.test(`${e.message} ${e.detail ?? ""}`),
  ),
  progressInUi: await evaluate(
    `(() => /Local Planner draft|Local Planner Blueprint Draft/i.test(document.body.innerText))()`,
  ),
};

if (draft?.responseText) {
  const uiButtons = await evaluate(`(() => {
    const root = document.querySelector('[data-focus-id="blueprint-planner"]');
    const buttons = root ? [...root.querySelectorAll('button.action-btn')].map(b => (b.textContent||'').trim()) : [];
    return {
      copyDraft: buttons.includes('Copy Local Planner Blueprint Draft'),
      saveDraft: buttons.includes('Save Local Draft as Blueprint'),
    };
  })()`);
  out.uiAfterDraft = uiButtons;

  await evaluate(`window.nttc.saveBlueprintPlannerDraftAsImported()`);
  await new Promise((r) => setTimeout(r, 700));
  snap = await evaluate(`window.nttc.getSnapshot()`);
  out.saveDraft = {
    imported: Boolean(snap.blueprint?.importedBlueprint),
    source: snap.blueprint?.importedBlueprint?.source ?? null,
    savedFlag: snap.blueprint?.plannerAi?.saved?.savedAsImportedBlueprint ?? false,
  };
  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 600));
  snap = await evaluate(`window.nttc.getSnapshot()`);
  out.afterSave = {
    completeness: Boolean(snap.blueprint?.completenessReport),
    previewFiles: snap.blueprint?.planningDocsPreview?.files?.length ?? 0,
  };
}

ws.close();
out.pass = Boolean(out.live?.completed) && Boolean(out.saveDraft?.imported);
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
