/**
 * Stage 75 supplement — Ollama + Safety Backup checks (CDP).
 * Requires packaged app on port 9239 with Stage 75 disposable project history loaded.
 */
const CDP = "http://127.0.0.1:9239";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
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

async function waitFor(getter, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await getter();
    if (v?.saved?.responseText || v?.saved?.draftText) return v;
    if (v?.busy === false && v?.statusMessage && /error|blocked|timeout|failed/i.test(v.statusMessage)) {
      return v;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

const { evaluate, ws } = await connect();
await evaluate(`window.nttc.openRecentProject(${JSON.stringify(DISPOSABLE)})`);
await evaluate(`window.nttc.checkOllamaStatus()`);
await new Promise((r) => setTimeout(r, 2000));

const snap0 = await evaluate(`window.nttc.getSnapshot()`);
const ollama = snap0.ollamaStatus ?? {};
const checkpoint = snap0.checkpoint ?? snap0.latestCheckpoint ?? null;
const availability = snap0.checkpointAvailability ?? null;

const out = {
  ollama: {
    status: ollama.status,
    modelName: ollama.modelName,
    tooltip: ollama.tooltip,
    errorMessage: ollama.errorMessage,
  },
  safetyBackup: {
    checkpoint,
    availability,
    checkpointExists: snap0.safety?.checkpointExists ?? null,
  },
  codeAi: null,
  patchDraft: null,
};

if (ollama.status === "active") {
  await evaluate(`window.nttc.refreshCodeContextFileList()`);
  await evaluate(`window.nttc.setCodeContextFileSelected('src/utils/formatStatus.ts', true)`);
  await evaluate(
    `window.nttc.setCodeContextQuestion('Review this area and suggest a small safe improvement without broad refactors.')`,
  );
  await evaluate(`window.nttc.applyFastDraftSetup()`);
  await evaluate(`window.nttc.generateCodeContextPreview()`);
  await evaluate(`window.nttc.applyCodeQuestionTemplate('planning-safety')`);
  await evaluate(`window.nttc.askLocalAiAboutCodeContext()`);
  const ai = await waitFor(async () => (await evaluate(`window.nttc.getSnapshot()`)).codeContextAi);
  out.codeAi = {
    responseStored: Boolean(ai?.saved?.responseText),
    statusMessage: ai?.statusMessage ?? null,
    busy: ai?.busy ?? null,
  };

  if (ai?.saved) {
    await evaluate(`window.nttc.generatePatchDraft()`);
    const pd = await waitFor(async () => (await evaluate(`window.nttc.getSnapshot()`)).patchDraft);
    out.patchDraft = {
      draftStored: Boolean(pd?.saved?.draftText),
      statusMessage: pd?.statusMessage ?? null,
    };
  }
} else {
  out.skippedReason = `Ollama status: ${ollama.status}`;
}

// Verify checkpoint if missing in snapshot
if (!checkpoint) {
  const cp = await evaluate(`window.nttc.createCheckpoint()`);
  out.safetyBackup.createAttempt = {
    checkpoint: cp.checkpoint ?? cp.latestCheckpoint ?? null,
    statusMessage: cp.checkpointStatusMessage ?? null,
    availability: cp.checkpointAvailability ?? null,
  };
} else {
  const verify = await evaluate(`window.nttc.verifyCheckpoint()`);
  out.safetyBackup.verify = {
    availability: verify.checkpointAvailability ?? null,
    statusMessage: verify.checkpointStatusMessage ?? null,
  };
}

ws.close();
console.log(JSON.stringify(out, null, 2));
