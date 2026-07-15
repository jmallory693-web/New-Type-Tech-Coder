/**
 * Stage 120 persistence/history smoke for Safe Scaffold target metadata.
 * Native folder dialog is not automatable via CDP — injects history metadata only
 * (no file contents), then verifies restore/stale/refresh/clear persistence.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const CDP = "http://127.0.0.1:9250";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const HISTORY = path.join(
  process.env.APPDATA || "",
  "New Type Tech Coder",
  "history",
  "session-history.json",
);
const ASSESS_JS = path.join(
  REPO,
  "dist-electron",
  "main",
  "buildMode",
  "assessSafeScaffoldTarget.js",
);

const report = { failures: [], pass: false };

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function normalizeKey(p) {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("No CDP target");
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
  const snap = () => evaluate("window.nttc.getSnapshot()");
  return { evaluate, snap, ws };
}

async function launch() {
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9250"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 7000));
}

async function stop() {
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2000));
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");
  if (!fs.existsSync(HISTORY)) fail("session-history.json missing");
  if (report.failures.length) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "nttc-s120-persist-"));
  const mod = await import(pathToFileURL(ASSESS_JS).href);
  const check = mod.assessSafeScaffoldTarget({
    selectedPath: emptyDir,
    currentProjectRoot: REPO,
  });
  if (check.status !== "safe") {
    fail(`Expected safe empty temp, got ${check.status}`);
  }

  await stop();

  const raw = JSON.parse(fs.readFileSync(HISTORY, "utf8"));
  const key = normalizeKey(REPO);
  if (!raw.projects?.[key]) {
    // try alternate key forms
    const found = Object.keys(raw.projects || {}).find(
      (k) => normalizeKey(k) === key || k.toLowerCase().includes("new type tech coder"),
    );
    if (!found) fail(`Project history key not found for ${REPO}`);
    else report.historyKey = found;
  } else {
    report.historyKey = key;
  }

  if (!report.historyKey) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const record = raw.projects[report.historyKey];
  record.safeScaffoldTarget = {
    selectedPath: check.resolvedPath || emptyDir,
    lastCheck: check,
    stale: false,
  };
  // Ensure no file contents field slipped in
  const serialized = JSON.stringify(record.safeScaffoldTarget);
  if (/fileContents|sourceBody|rawContent/i.test(serialized)) {
    fail("Injected history unexpectedly includes file contents fields");
  }
  fs.writeFileSync(HISTORY, JSON.stringify(raw, null, 2), "utf8");

  await launch();
  let { evaluate, snap, ws } = await connect();
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(REPO)})`);
  await new Promise((r) => setTimeout(r, 2000));
  let s = await snap();
  const restored = s.safeScaffoldTarget;
  report.restore = {
    selectedPath: restored?.selectedPath ?? null,
    stale: Boolean(restored?.stale),
    hasLastCheck: Boolean(restored?.lastCheck),
    status: restored?.lastCheck?.status ?? null,
  };
  if (!restored?.selectedPath) fail("Target path did not restore from history");
  if (!restored.stale) fail("Restored target safety should be marked stale");

  await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.afterRefresh = {
    selectedPath: s.safeScaffoldTarget?.selectedPath ?? null,
    stale: Boolean(s.safeScaffoldTarget?.stale),
    status: s.safeScaffoldTarget?.lastCheck?.status ?? null,
  };
  if (s.safeScaffoldTarget?.stale) fail("Target still stale after refresh");
  if (s.safeScaffoldTarget?.lastCheck?.status !== "safe") {
    fail(`Expected safe after refresh, got ${s.safeScaffoldTarget?.lastCheck?.status}`);
  }

  // No-write check on emptyDir
  if (fs.readdirSync(emptyDir).length !== 0) {
    fail("Refresh wrote files into empty target folder");
  }

  await evaluate(`window.nttc.clearSafeScaffoldTargetFolder()`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  report.afterClear = {
    selectedPath: s.safeScaffoldTarget?.selectedPath ?? null,
    uiStatus: s.safeScaffoldTarget?.uiStatus ?? null,
  };
  if (s.safeScaffoldTarget?.selectedPath) fail("Clear did not remove selected path");

  ws.close();
  await stop();

  // Restart: cleared state should persist
  await launch();
  ({ evaluate, snap, ws } = await connect());
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(REPO)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.afterRestartCleared = {
    selectedPath: s.safeScaffoldTarget?.selectedPath ?? null,
    uiStatus: s.safeScaffoldTarget?.uiStatus ?? null,
  };
  if (s.safeScaffoldTarget?.selectedPath) {
    fail("Cleared target folder reappeared after restart");
  }

  ws.close();
  await stop();

  try {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
  console.log(JSON.stringify(report, null, 2));
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  process.exit(1);
}
