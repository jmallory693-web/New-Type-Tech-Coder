/**
 * Stage 134 launcher verification — packaged app after Stage 133 Response Import.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const LAUNCHER = path.join(REPO, "Open New Type Tech Coder.bat");
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const CDP = "http://127.0.0.1:9251";
const PROJECT = REPO;

const report = {
  batExists: false,
  exeExists: false,
  processStarted: false,
  ui: null,
  pass: false,
};

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
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
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
spawn(EXE, ["--remote-debugging-port=9251"], {
  cwd: REPO,
  detached: true,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 7000));

const { page, evaluate, ws } = await connect();
await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
await new Promise((r) => setTimeout(r, 1500));

await evaluate(`(() => {
  const t = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Build');
  if (t) t.click();
})()`);
await new Promise((r) => setTimeout(r, 800));
const buildBody = await evaluate(`document.body.innerText`);
const orderOk = await evaluate(`(() => {
  const labels = [...document.querySelectorAll('.field-label')].map((el) =>
    (el.textContent || '').trim(),
  );
  const brief = labels.indexOf('Local Planner Build Brief');
  const response = labels.indexOf('Local Planner Response Import');
  const safety = labels.indexOf('Safety Charter');
  return brief >= 0 && response > brief && safety > response;
})()`);

await evaluate(`(() => {
  const t = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Blueprint');
  if (t) t.click();
})()`);
await new Promise((r) => setTimeout(r, 500));
const blueprintBody = await evaluate(`document.body.innerText`);

await evaluate(`(() => {
  const t = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Reports');
  if (t) t.click();
})()`);
await new Promise((r) => setTimeout(r, 500));
const reportsBody = await evaluate(`document.body.innerText`);

report.ui = {
  pageUrl: page.url,
  usesVite: /5173|vite/i.test(page.url || ""),
  usesAsar: /app\.asar/i.test(page.url || ""),
  buildTab: /Safe Scaffold Mode|Planning Only/i.test(buildBody),
  safeScaffoldWrite: /Safe Scaffold Write/i.test(buildBody),
  localPlannerBuildBrief: /Local Planner Build Brief/i.test(buildBody),
  localPlannerResponseImport: /Local Planner Response Import/i.test(buildBody),
  responseBetweenBriefAndSafety: orderOk === true,
  analyzeButton: /Analyze Planner Response/i.test(buildBody),
  blueprintTab: /Project Blueprint Planner/i.test(blueprintBody),
  reportsTab: /Architecture Health|Code Context Pack/i.test(reportsBody),
  noApplyPatch: await evaluate(
    `[...document.querySelectorAll('button')].every((b) => !/^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
  ),
};
ws.close();
spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

report.pass =
  report.batExists &&
  report.exeExists &&
  report.processStarted &&
  !report.ui.usesVite &&
  report.ui.usesAsar &&
  report.ui.buildTab &&
  report.ui.safeScaffoldWrite &&
  report.ui.localPlannerBuildBrief &&
  report.ui.localPlannerResponseImport &&
  report.ui.responseBetweenBriefAndSafety &&
  report.ui.analyzeButton &&
  report.ui.blueprintTab &&
  report.ui.reportsTab &&
  report.ui.noApplyPatch;

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
