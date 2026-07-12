/**
 * Focused Stage 13 re-check: lifecycle block + lint + history reopen.
 * Assumes packaged app already running with CDP 9222 and bridge fixed.
 */
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage13-Disposable";
const CDP = "http://127.0.0.1:9222";
const fs = await import("node:fs");
const path = await import("node:path");

const report = { failures: [], notes: [], lifecycle: null, lint: null, historyRelaunch: null, uiText: null };

function pass(m) { console.log("PASS:", m); }
function fail(m) { report.failures.push(m); console.error("FAIL:", m); }

async function cdpConnect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("No CDP page");
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
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.text ||
          JSON.stringify(result.exceptionDetails.exception),
      );
    }
    return result.result?.value;
  }
  return { evaluate, page, ws };
}

const { evaluate, page, ws } = await cdpConnect();
console.log("CDP", page.title, page.url);

report.uiText = await evaluate(`document.body.innerText.slice(0, 800)`);

let snap = await evaluate(`(async () => {
  return await window.nttc.openRecentProject(${JSON.stringify(PROJECT)});
})()`);
pass(`Opened project: ${snap.safety?.project?.displayName}`);

snap = await evaluate(`(async () => await window.nttc.summarizeProject())()`);
const scripts = snap.projectSummary?.packageScripts || [];
const entries = snap.projectSummary?.packageScriptEntries || [];
console.log("scripts", scripts);
console.log("plain", (snap.projectSummary?.plainEnglishExplanation || "").slice(0, 220));

const buildCand = (snap.safeChecks?.available || []).find((c) => c.kind === "build");
const blocked = (snap.safeChecks?.blocked || []).filter(
  (b) => b.lifecycleHooks && b.lifecycleHooks.length,
);
report.lifecycle = {
  scripts,
  buildAvailable: Boolean(buildCand),
  buildBlocked: Boolean(buildCand?.blocked),
  buildReason: buildCand?.reason || null,
  blockedHooks: blocked.map((b) => ({
    script: b.scriptName,
    hooks: b.lifecycleHooks,
    reason: b.reason,
  })),
};

if (
  report.lifecycle.buildBlocked &&
  /prebuild|postbuild/i.test(report.lifecycle.buildReason || "")
) {
  pass(`Build lifecycle-blocked: ${report.lifecycle.buildReason}`);
} else {
  fail(`Build not lifecycle-blocked: ${JSON.stringify(report.lifecycle)}`);
}

snap = await evaluate(`(async () => await window.nttc.runSafeCheck('build'))()`);
if (snap.safeChecks?.lastResult?.status === "blocked") {
  pass("runSafeCheck(build) blocked");
} else {
  fail(`runSafeCheck(build)=${snap.safeChecks?.lastResult?.status}`);
}

const lintCand = (snap.safeChecks?.available || []).find(
  (c) => c.kind === "lint" && c.available && !c.blocked,
);
if (lintCand) {
  // Confirmation is UI-side; IPC runSafeCheck is the allowlisted runner.
  snap = await evaluate(`(async () => await window.nttc.runSafeCheck('lint'))()`);
  report.lint = {
    status: snap.safeChecks?.lastResult?.status,
    summary: snap.safeChecks?.lastResult?.plainEnglishSummary,
    output: (snap.safeChecks?.lastResult?.combinedOutput || "").slice(0, 200),
  };
  if (["passed", "failed"].includes(report.lint.status)) {
    pass(`Lint ran: ${report.lint.status} — ${report.lint.summary}`);
  } else {
    fail(`Lint unexpected: ${report.lint.status}`);
  }
} else {
  fail("Lint candidate not available");
}

// History: save, then verify reopen restores without auto-run
snap = await evaluate(`(async () => await window.nttc.saveSessionHistory())()`);
const histPath = path.join(
  process.env.APPDATA || "",
  "New Type Tech Coder",
  "history",
  "session-history.json",
);
const hist = JSON.parse(fs.readFileSync(histPath, "utf8"));
report.historyRelaunch = {
  recent: (hist.recentProjects || []).map((p) => p.path || p.normalizedPath || p),
  hasSummaryRecord: Boolean(
    hist.projects?.[Object.keys(hist.projects || {})[0]]?.lastSummary ||
      hist.currentProjectHistory?.lastSummary ||
      snap.history?.currentProjectHistory,
  ),
  rawKeys: Object.keys(hist),
};

// Clear in-memory by reopening — should load history, not auto-scan
snap = await evaluate(`(async () => {
  await window.nttc.clearProject();
  return await window.nttc.openRecentProject(${JSON.stringify(PROJECT)});
})()`);

report.historyRelaunch.afterReopen = {
  hasProject: Boolean(snap.safety?.project),
  summaryFromHistory: Boolean(snap.summaryIsFromHistory),
  hasSummary: Boolean(snap.projectSummary),
  autoScanRunning: Boolean(snap.summarizing || snap.safeChecks?.running),
  advisorBusy: Boolean(snap.advisorBusy),
  checkpointBusy: Boolean(snap.checkpointBusy),
  statusBits: {
    summaryStatus: snap.summaryStatusMessage || null,
    historyNote: snap.history?.statusMessage || null,
  },
};

if (report.historyRelaunch.afterReopen.hasProject) pass("Recent project reopen works");
else fail("Recent project reopen failed");

if (report.historyRelaunch.afterReopen.summaryFromHistory || report.historyRelaunch.afterReopen.hasSummary)
  pass("Previous saved summary/history present after reopen");
else fail("No saved summary after reopen");

if (
  !report.historyRelaunch.afterReopen.autoScanRunning &&
  !report.historyRelaunch.afterReopen.advisorBusy &&
  !report.historyRelaunch.afterReopen.checkpointBusy
) {
  pass("No auto scan/AI/command/restore on reopen");
} else {
  fail("Unexpected auto activity on reopen");
}

const out = path.join(
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder",
  "stage13-recheck-report.json",
);
fs.writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
console.log("REPORT", out);
console.log(JSON.stringify(report, null, 2));
ws.close();
if (report.failures.length) process.exitCode = 2;
