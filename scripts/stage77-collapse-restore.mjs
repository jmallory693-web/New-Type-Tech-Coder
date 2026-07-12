/**
 * Stage 77: collapse preference persistence across restart.
 * Usage:
 *   node scripts/stage77-collapse-restore.mjs save
 *   (restart packaged app with --remote-debugging-port=9239)
 *   node scripts/stage77-collapse-restore.mjs restore
 */
const CDP = "http://127.0.0.1:9239";
const mode = process.argv[2] || "restore";
const PROJECT =
  process.argv[3] ||
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";

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
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  return { evaluate, ws };
}

const { evaluate, ws } = await connect();
await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);

if (mode === "save") {
  await evaluate(`window.nttc.setReportsPanelCollapsed('patch-draft-mode', true)`);
  await evaluate(`window.nttc.setReportsPanelCollapsed('builder-handoff-export', true)`);
  const snap = await evaluate(`window.nttc.getSnapshot()`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        collapse: snap.reportsUi?.panelCollapse ?? {},
      },
      null,
      2,
    ),
  );
  ws.close();
  process.exit(0);
}

await new Promise((r) => setTimeout(r, 1200));
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
    (el.textContent || '').includes('Reports'),
  );
  if (tab) tab.click();
})()`);
await new Promise((r) => setTimeout(r, 800));
const snap = await evaluate(`window.nttc.getSnapshot()`);
const collapse = snap.reportsUi?.panelCollapse ?? {};
const ui = await evaluate(`(() => ({
  patchDraftCollapsed: (() => {
    const s = document.querySelector('[data-panel-id="patch-draft-mode"]');
    return s ? !s.open : null;
  })(),
  handoffCollapsed: (() => {
    const s = document.querySelector('[data-panel-id="builder-handoff-export"]');
    return s ? !s.open : null;
  })(),
}))()`);

console.log(
  JSON.stringify(
    {
      ok:
        collapse["patch-draft-mode"] === true &&
        collapse["builder-handoff-export"] === true,
      stored: collapse,
      ui,
    },
    null,
    2,
  ),
);
ws.close();
process.exit(
  collapse["patch-draft-mode"] === true &&
    collapse["builder-handoff-export"] === true
    ? 0
    : 1,
);
