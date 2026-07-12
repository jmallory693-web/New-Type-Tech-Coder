/** Stage 62 retry — smaller context Patch Draft */
const CDP = "http://127.0.0.1:9236";
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 1;
  const p = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data));
    if (m.id && p.has(m.id)) {
      const { resolve, reject } = p.get(m.id);
      p.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = id++;
      p.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };
  return { evaluate, ws };
}

const { evaluate, ws } = await connect();
let snap = await evaluate(
  `window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`,
);
await evaluate(`window.nttc.setRoleModelMapping("patch-draft", "qwen2.5-coder:7b")`);
await evaluate(`window.nttc.setCodeContextMaxLinesPerFile(25)`);
await evaluate(`window.nttc.setCodeContextMaxTotalChars(10000)`);
await evaluate(`window.nttc.clearCodeContextSelection()`);
snap = await evaluate(`window.nttc.refreshCodeContextFileList()`);
const one =
  snap.codeContext?.candidates?.find((c) => /package\.json$/.test(c.relativePath)) ??
  snap.codeContext?.candidates?.find((c) => /\.ts$/.test(c.relativePath));
if (one) {
  await evaluate(
    `window.nttc.setCodeContextFileSelected(${JSON.stringify(one.relativePath)}, true)`,
  );
}
await evaluate(`window.nttc.applyCodeQuestionTemplate("small-patch-plan", "replace")`);
snap = await evaluate(`window.nttc.generateCodeContextPreview()`);
await evaluate(`window.nttc.setPatchDraftIncludeCodeAi(false)`);
await evaluate(`window.nttc.setPatchDraftIncludeBuilderPlanDecision(false)`);
await evaluate(`window.nttc.setPatchDraftIncludeImplementationReview(false)`);

const t0 = Date.now();
snap = await evaluate(`window.nttc.generatePatchDraft()`);
const patchMs = Date.now() - t0;
const draft = snap.patchDraft?.saved;
console.log(
  JSON.stringify(
    {
      patchMs,
      ok: Boolean(draft),
      model: draft?.modelName,
      status: snap.patchDraft?.statusMessage,
      hasHeader: /#\s*NTTC Patch Draft/i.test(draft?.draftText ?? ""),
      proposesFiles: /proposed files|src\//i.test(draft?.draftText ?? ""),
      validation: /typecheck|build|smoke/i.test(draft?.draftText ?? ""),
      excerpt: draft?.previewExcerpt?.slice(0, 400),
    },
    null,
    2,
  ),
);

if (draft) {
  const t1 = Date.now();
  snap = await evaluate(`window.nttc.generatePatchDraftSafetyReview()`);
  const sr = snap.patchDraftSafetyReview?.saved;
  console.log(
    JSON.stringify(
      {
        safetyMs: Date.now() - t1,
        recommendation: sr?.recommendation,
        safetyFlags: sr?.safetyFlagCount,
        missing: sr?.missingSafeguardCount,
        suggestedPrompt: Boolean(sr?.suggestedNextPrompt),
        excerpt: sr?.previewExcerpt?.slice(0, 350),
      },
      null,
      2,
    ),
  );
  await evaluate(`window.nttc.saveSessionHistory()`);
}

ws.close();
