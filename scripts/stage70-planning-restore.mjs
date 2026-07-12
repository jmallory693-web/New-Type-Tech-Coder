/**
 * Stage 70: planning style persistence across app restart.
 * Usage:
 *   node scripts/stage70-planning-restore.mjs save
 *   (restart packaged app)
 *   node scripts/stage70-planning-restore.mjs restore
 */
const CDP = "http://127.0.0.1:9239";
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
  const snap = await evaluate(`window.nttc.setPlanningStyle('default')`);
  console.log(
    JSON.stringify(
      {
        ok: snap.planningStyle?.style === "default",
        style: snap.planningStyle?.style ?? null,
      },
      null,
      2,
    ),
  );
  ws.close();
  process.exit(snap.planningStyle?.style === "default" ? 0 : 1);
}

const snap = await evaluate(`window.nttc.getSnapshot()`);
const restored = snap.planningStyle?.style === "default";
console.log(
  JSON.stringify(
    {
      ok: restored,
      style: snap.planningStyle?.style ?? null,
      statusMessage: snap.planningStyle?.statusMessage ?? null,
    },
    null,
    2,
  ),
);
ws.close();
process.exit(restored ? 0 : 1);
