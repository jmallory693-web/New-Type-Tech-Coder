const CDP = "http://127.0.0.1:9222";

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === "page") || list[0];
console.log("page", page.title, page.url);

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

async function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Runtime.enable");

const checks = [
  "typeof window.nttc",
  "typeof window",
  "document.readyState",
  "document.title",
  "Object.getOwnPropertyNames(window).filter(k => /ntt|electron|ipc/i.test(k)).join(',')",
  "!!document.querySelector('#root')",
  "document.body && document.body.innerText.slice(0, 300)",
];

for (const expression of checks) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: false,
  });
  console.log(expression, "=>", JSON.stringify(result.result?.value ?? result));
}

ws.close();
