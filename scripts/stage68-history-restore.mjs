/**
 * Stage 68: imported patch draft history restore across app restart.
 * Requires packaged app running with --remote-debugging-port=9239
 * Usage: node scripts/stage68-history-restore.mjs save|restore
 */
import fs from "node:fs";

const CDP = "http://127.0.0.1:9239";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;
const mode = process.argv[2] || "restore";

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
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
  return { evaluate, ws };
}

const { evaluate, ws } = await connect();

if (mode === "save") {
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await evaluate(`window.nttc.setImportedPatchDraftSource("ChatGPT")`);
  await evaluate(`window.nttc.setImportedPatchDraftType("Implementation plan")`);
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("History restore smoke test draft for Stage 68.")`,
  );
  const snap = await evaluate(`window.nttc.saveImportedPatchDraft()`);
  console.log(
    JSON.stringify(
      {
        ok: Boolean(snap.importedPatchDraft?.saved),
        id: snap.importedPatchDraft?.saved?.id ?? null,
        project: PROJECT,
      },
      null,
      2,
    ),
  );
  ws.close();
  process.exit(snap.importedPatchDraft?.saved ? 0 : 1);
}

await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
const snap = await evaluate(`window.nttc.getSnapshot()`);
const rec = snap.importedPatchDraft?.saved;
console.log(
  JSON.stringify(
    {
      historyRestoreAfterReopen: Boolean(rec),
      source: rec?.source ?? null,
      draftType: rec?.draftType ?? null,
      preview: rec?.previewExcerpt?.slice(0, 80) ?? null,
    },
    null,
    2,
  ),
);
ws.close();
process.exit(rec ? 0 : 1);
