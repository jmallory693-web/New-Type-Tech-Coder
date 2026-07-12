/**
 * Stage 74: Builder Handoff Pack persistence across app restart.
 * Usage:
 *   node scripts/stage74-handoff-restore.mjs save
 *   (restart packaged app with --remote-debugging-port=9239)
 *   node scripts/stage74-handoff-restore.mjs restore
 */
import fs from "node:fs";

const CDP = "http://127.0.0.1:9239";
const mode = process.argv[2] || "restore";
const PROJECT =
  process.argv[3] ||
  (fs.existsSync(
    "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable",
  )
    ? "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable"
    : "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder");

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
  await evaluate(`window.nttc.setImportedPatchDraftSource('Cursor')`);
  await evaluate(`window.nttc.setImportedPatchDraftType('Patch draft')`);
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft("Focused module in src/shared/handoff.ts. typecheck, npm run build, safety backup. No apply.")`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft()`);
  const snap = await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  const saved = snap.builderHandoffExport?.saved;
  console.log(
    JSON.stringify(
      {
        ok: Boolean(saved),
        target: saved?.target ?? null,
        strictness: saved?.strictness ?? null,
        recommendation: saved?.recommendation ?? null,
        generatedAt: saved?.generatedAt ?? null,
      },
      null,
      2,
    ),
  );
  ws.close();
  process.exit(saved ? 0 : 1);
}

await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
const snap = await evaluate(`window.nttc.getSnapshot()`);
const saved = snap.builderHandoffExport?.saved;
console.log(
  JSON.stringify(
    {
      ok: Boolean(saved),
      target: saved?.target ?? null,
      strictness: saved?.strictness ?? null,
      recommendation: saved?.recommendation ?? null,
      statusMessage: snap.builderHandoffExport?.statusMessage ?? null,
    },
    null,
    2,
  ),
);
ws.close();
process.exit(saved ? 0 : 1);
