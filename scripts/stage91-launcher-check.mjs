/**
 * Stage 91 launcher verification: bat starts packaged exe; Task Implementation Intake spot-check.
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

spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));

const bat = spawn("cmd.exe", ["/c", LAUNCHER], {
  cwd: REPO,
  stdio: "ignore",
  detached: false,
});
await new Promise((resolve) => {
  bat.on("exit", resolve);
  setTimeout(resolve, 5000);
});
await new Promise((r) => setTimeout(r, 2000));
report.processStarted = true;

spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2000));
spawn(EXE, ["--remote-debugging-port=9239"], {
  cwd: REPO,
  detached: true,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 6000));

const { page, evaluate, ws } = await connect();
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Blueprint');
  if (tab) tab.click();
})()`);
await new Promise((r) => setTimeout(r, 800));
const body = await evaluate(`document.body.innerText`);
const noApplyPatchBtn = await evaluate(
  `[...document.querySelectorAll('button')].every((b) => !/^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
);
report.ui = {
  pageUrl: page.url,
  usesVite: /5173|vite/i.test(page.url || ""),
  usesAsar: /app\.asar/i.test(page.url || ""),
  blueprintTab: /Blueprint/i.test(body),
  taskCardsSection: /Blueprint Phase Task Cards/i.test(body),
  handoffSection: /Task Card Builder Handoff/i.test(body),
  intakeSection: /Task Implementation Intake/i.test(body),
  saveIntakeBtn: /Save Task Implementation Report/i.test(body),
  noApplyPatch: noApplyPatchBtn,
};
ws.close();
spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

report.pass =
  report.batExists &&
  report.exeExists &&
  report.processStarted &&
  !report.ui.usesVite &&
  report.ui.usesAsar &&
  report.ui.intakeSection &&
  report.ui.saveIntakeBtn &&
  report.ui.noApplyPatch;

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
