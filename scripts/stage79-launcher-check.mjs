/**
 * Stage 79 launcher verification: bat starts packaged exe; UI spot-check via CDP.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const LAUNCHER = path.join(REPO, "Open New Type Tech Coder.bat");
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const CDP = "http://127.0.0.1:9239";

const report = { batExists: false, exeExists: false, processStarted: false, ui: null, pass: false };

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
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  return { page, evaluate, ws };
}

report.batExists = fs.existsSync(LAUNCHER);
report.exeExists = fs.existsSync(EXE);
if (!report.batExists || !report.exeExists) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const bat = spawn("cmd.exe", ["/c", LAUNCHER], {
  cwd: REPO,
  stdio: "ignore",
  detached: false,
});
await new Promise((resolve) => {
  bat.on("exit", resolve);
  setTimeout(resolve, 4000);
});
await new Promise((r) => setTimeout(r, 2000));
report.processStarted = true;

// Bat does not pass --remote-debugging-port; relaunch same packaged exe for UI spot-check.
spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2000));
spawn(EXE, ["--remote-debugging-port=9239"], {
  cwd: REPO,
  detached: true,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 5000));

const { page, evaluate, ws } = await connect();
report.ui = {
  pageUrl: page.url,
  usesVite: /5173|vite/i.test(page.url || ""),
  guideTab: await evaluate(`(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === 'Guide'))()`),
};
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((el) => (el.textContent || '').trim() === 'Dashboard'); if (b) b.click(); })()`);
await new Promise((r) => setTimeout(r, 600));
report.ui.newHereCard = await evaluate(`(() => !!document.querySelector('.dashboard-new-here'))()`);
ws.close();

report.pass =
  report.batExists &&
  report.exeExists &&
  report.processStarted &&
  !report.ui.usesVite &&
  report.ui.guideTab &&
  report.ui.newHereCard;

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
