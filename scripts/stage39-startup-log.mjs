const CDP = "http://127.0.0.1:9224";
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
const result = await send("Runtime.evaluate", {
  expression: `(async () => {
    const s = await window.nttc.getSnapshot();
    return s.actionLog.filter((e) => /App started|Stage 38/i.test(e.message + ' ' + (e.detail||''))).slice(0,5);
  })()`,
  returnByValue: true,
  awaitPromise: true,
});
console.log(JSON.stringify(result.result.value, null, 2));
ws.close();
