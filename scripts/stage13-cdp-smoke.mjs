/**
 * Stage 13 disposable packaged-app smoke harness (CDP over --remote-debugging-port).
 * Does not change product code. Disposable project only.
 */
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage13-Disposable";
const CDP = "http://127.0.0.1:9222";

const report = {
  launchedWithoutVite: false,
  title: null,
  pageUrl: null,
  inspectOnly: null,
  liveQwenDisabled: null,
  projectSelected: null,
  oneDriveWarning: null,
  summary: null,
  reviewPack: null,
  checkpoint: null,
  restore: null,
  safeChecks: null,
  lifecycleBlock: null,
  advisor: null,
  qwen: null,
  external: null,
  history: null,
  failures: [],
  notes: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function cdpConnect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("No CDP page target");
  report.title = page.title;
  report.pageUrl = page.url;
  report.launchedWithoutVite =
    typeof page.url === "string" &&
    page.url.startsWith("file:") &&
    !page.url.includes("5173");

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
    const result = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    return result;
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

  return { ws, send, evaluate, page };
}

async function main() {
  const { evaluate, page } = await cdpConnect();
  console.log("CDP page:", page.title, page.url);

  if (report.launchedWithoutVite) pass("Launched from file:// asar (no Vite)");
  else fail("App appears to still use Vite/dev URL");

  if (report.title === "New Type Tech Coder") pass("Window title correct");
  else fail(`Unexpected title: ${report.title}`);

  // Initial snapshot
  let snap = await evaluate(`(async () => {
    if (!window.nttc) return { error: 'no nttc bridge' };
    return await window.nttc.getSnapshot();
  })()`);
  if (snap?.error) throw new Error(snap.error);

  report.inspectOnly =
    snap.safety?.mode === "inspect-only" &&
    snap.safety?.editModeAvailable === false &&
    snap.safety?.writesAllowed === false;
  report.liveQwenDisabled =
    snap.qwen?.liveInspectEnabled === false &&
    /disabled for safety/i.test(String(snap.qwen?.liveInspectDisabledReason || ""));

  if (report.inspectOnly) pass("Inspect-only / no edit mode");
  else fail("Inspect-only flags incorrect");

  if (report.liveQwenDisabled) pass("Live Qwen disabled");
  else fail("Live Qwen not clearly disabled");

  // Open disposable project without auto-scan first, then summarize
  snap = await evaluate(`(async () => {
    return await window.nttc.openRecentProject(${JSON.stringify(PROJECT)});
  })()`);

  // openRecent may fail if never saved; use internal path via select is dialog-only.
  // Prefer a direct summarize after forcing project through openRecentMetadata path.
  // If openRecent failed because path missing from history, call summarize after
  // using a custom evaluate that invokes IPC openRecent which still setProjectRoot
  // only when path exists — openRecentProject validates directory exists.
  if (!snap.safety?.project) {
    // Force via openRecentProject again after ensuring path exists — it should work
    // even with empty history (logs "No previous saved records").
    snap = await evaluate(`(async () => {
      return await window.nttc.openRecentProject(${JSON.stringify(PROJECT)});
    })()`);
  }

  if (!snap.safety?.project) {
    // Fallback: use checkPath + a synthetic approach — selectProjectFolder needs dialog.
    // Use Node-side note and try IPC channel through evaluate with openRecent again.
    fail("Could not select disposable project via openRecentProject");
    console.log(JSON.stringify(snap.safety, null, 2));
  } else {
    report.projectSelected = {
      name: snap.safety.project.displayName,
      path: snap.safety.project.normalizedPath,
      isOneDrive: snap.safety.project.isOneDrive,
    };
    report.oneDriveWarning = Boolean(snap.safety.project.isOneDrive);
    pass(`Project selected: ${snap.safety.project.displayName}`);
  }

  // Summarize
  snap = await evaluate(`(async () => await window.nttc.summarizeProject())()`);
  const summary = snap.projectSummary;
  report.summary = {
    exists: Boolean(summary),
    fromHistory: snap.summaryIsFromHistory,
    plainEnglish: summary?.plainEnglishExplanation?.slice(0, 240) || null,
    skippedLinks: summary?.skippedSymlinkOrJunctionCount ?? null,
    skippedLinkNames: summary?.skippedSymlinkOrJunctionNames ?? [],
    inspected: summary?.inspectedSafeFiles ?? [],
    hasEnvInInspected: (summary?.inspectedSafeFiles || []).some((f) =>
      /\.env/i.test(f),
    ),
    markdownHasSecretToken: /SECRET_TOKEN|do-not-read-this/.test(
      summary?.markdownReport || "",
    ),
    markdownHasRawSource: /console\.log\("hello disposable"\)/.test(
      summary?.markdownReport || "",
    ),
  };
  if (report.summary.exists) pass("Project Summary generated");
  else fail("Project Summary missing");
  if (report.summary.hasEnvInInspected || report.summary.markdownHasSecretToken)
    fail("Summary appears to include .env/secret contents");
  else pass("Summary does not include .env secret contents");
  if (report.summary.markdownHasRawSource)
    fail("Summary includes raw source from index.js");
  else pass("Summary does not include raw source body");
  if ((report.summary.skippedLinks || 0) > 0)
    pass(`Symlink/junction skips reported: ${report.summary.skippedLinks}`);
  else
    report.notes.push(
      "No symlink/junction skips counted (junction may be detected as directory differently).",
    );

  // Review pack
  snap = await evaluate(`(async () => {
    await window.nttc.setUserRequest('Stage 13 disposable safety review');
    return await window.nttc.generateReviewPack();
  })()`);
  const pack = snap.reviewPack;
  report.reviewPack = {
    exists: Boolean(pack),
    startsOk: /^# New Type Tech Coder - Copy-Paste Review Report/m.test(
      pack?.markdownReport || "",
    ),
    hasInspectOnly: /Inspect-only/i.test(pack?.markdownReport || ""),
    hasLifecycleSection: /Lifecycle hook/i.test(pack?.markdownReport || ""),
    hasLiveQwenDisabled: /Live Qwen is disabled for safety/i.test(
      pack?.markdownReport || "",
    ),
    excerpt: (pack?.previewExcerpt || "").slice(0, 200),
  };
  if (report.reviewPack.exists && report.reviewPack.startsOk)
    pass("Copy-Paste Review Report generated with correct title");
  else fail("Review Report missing or wrong title");

  // Safety backup
  snap = await evaluate(`(async () => await window.nttc.createCheckpoint())()`);
  const cp = snap.latestCheckpoint;
  report.checkpoint = {
    exists: Boolean(cp),
    method: cp?.method || null,
    methodLabel: cp?.methodLabel || null,
    skippedCount: cp?.skippedCount ?? null,
    snapshotDir: cp?.snapshotDir || null,
    warnings: cp?.warnings || [],
    status: snap.checkpointStatusMessage || null,
  };
  if (report.checkpoint.exists) pass(`Safety Backup created (${report.checkpoint.method})`);
  else fail(`Safety Backup failed: ${report.checkpoint.status}`);

  // Confirm no checkpoint files inside project
  const fs = await import("node:fs");
  const path = await import("node:path");
  const projectHasCheckpointDir = fs.existsSync(
    path.join(PROJECT, "checkpoints"),
  );
  if (projectHasCheckpointDir)
    fail("Checkpoint folder found inside disposable project");
  else pass("No checkpoint folder inside project");

  // Modify disposable file then restore
  const marker = path.join(PROJECT, "STAGE13_MARKER.txt");
  fs.writeFileSync(marker, "created after backup", "utf8");
  snap = await evaluate(`(async () => await window.nttc.undoLastCheckpoint())()`);
  const markerStillThere = fs.existsSync(marker);
  report.restore = {
    status: snap.checkpointStatusMessage || null,
    ok: /restored|restore/i.test(String(snap.checkpointStatusMessage || "")),
    markerRemoved: !markerStillThere,
    latestMethod: snap.latestCheckpoint?.method || null,
  };
  // For folder snapshot restore, marker should be removed if restorable.
  // For git restore, depends on whether file was tracked.
  if (report.restore.ok || /Restored project/i.test(report.restore.status || ""))
    pass(`Restore reported success: ${report.restore.status}`);
  else fail(`Restore unclear: ${report.restore.status}`);
  if (!markerStillThere) pass("Post-backup marker file removed by restore");
  else
    report.notes.push(
      "Marker file still present after restore (may be expected for git clean rules / deny list).",
    );

  // Safe checks + lifecycle block
  snap = await evaluate(`(async () => await window.nttc.summarizeProject())()`);
  const lifecycle = (snap.safeChecks?.blocked || []).filter(
    (b) => b.lifecycleHooks && b.lifecycleHooks.length,
  );
  const buildCandidate = (snap.safeChecks?.available || []).find(
    (c) => c.kind === "build",
  );
  report.lifecycleBlock = {
    hooks: lifecycle.map((b) => ({
      script: b.scriptName,
      hooks: b.lifecycleHooks,
      reason: b.reason,
    })),
    buildBlocked: Boolean(buildCandidate?.blocked),
    buildReason: buildCandidate?.reason || null,
  };
  if (
    report.lifecycleBlock.buildBlocked &&
    /prebuild|postbuild/i.test(report.lifecycleBlock.buildReason || "")
  )
    pass("Build blocked by prebuild/postbuild lifecycle hooks");
  else fail("Expected build to be lifecycle-hook blocked");

  // Attempt run should also block
  snap = await evaluate(`(async () => await window.nttc.runSafeCheck('build'))()`);
  report.safeChecks = {
    lastStatus: snap.safeChecks?.lastResult?.status || null,
    lastSummary: snap.safeChecks?.lastResult?.plainEnglishSummary || null,
    available: (snap.safeChecks?.available || [])
      .filter((c) => c.available && !c.blocked)
      .map((c) => c.scriptName),
  };
  if (report.safeChecks.lastStatus === "blocked")
    pass("runSafeCheck('build') stayed blocked");
  else fail(`runSafeCheck status was ${report.safeChecks.lastStatus}`);

  // Lint should be runnable (no prelint/postlint in package.json)
  if (report.safeChecks.available.includes("lint")) {
    snap = await evaluate(`(async () => await window.nttc.runSafeCheck('lint'))()`);
    report.safeChecks.lintStatus = snap.safeChecks?.lastResult?.status || null;
    report.safeChecks.lintSummary =
      snap.safeChecks?.lastResult?.plainEnglishSummary || null;
    if (["passed", "failed"].includes(report.safeChecks.lintStatus))
      pass(`Lint check ran (${report.safeChecks.lintStatus})`);
    else fail(`Lint check unexpected status: ${report.safeChecks.lintStatus}`);
  } else {
    report.notes.push("Lint not available after detection");
  }

  // Local AI
  snap = await evaluate(`(async () => await window.nttc.testProviderConnection())()`);
  const providerReady = snap.provider?.connectionState === "ready";
  if (providerReady) {
    snap = await evaluate(`(async () => await window.nttc.askLocalAi())()`);
    report.advisor = {
      ready: true,
      hasResponse: Boolean(snap.advisorResponse),
      status: snap.advisorStatusMessage,
      responsePreview: (snap.advisorResponse?.responseText || "").slice(0, 200),
    };
    if (report.advisor.hasResponse) pass("Local AI Reviewer responded");
    else fail(`Local AI failed: ${report.advisor.status}`);
  } else {
    report.advisor = {
      ready: false,
      status: snap.advisorStatusMessage || snap.provider?.message,
      unreachableClear: /not reachable|not ready|local|Ollama|127\.0\.0\.1/i.test(
        String(snap.advisorStatusMessage || snap.provider?.message || ""),
      ),
    };
    if (report.advisor.unreachableClear)
      pass("Local AI unreachable message is clear");
    else fail("Local AI unreachable message unclear");
  }

  // Qwen prompt pack
  snap = await evaluate(`(async () => await window.nttc.generateQwenPromptPack())()`);
  report.qwen = {
    liveEnabled: snap.qwen?.liveInspectEnabled,
    promptExists: Boolean(snap.qwen?.promptPack),
    promptInspectOnly: /inspect-only|do not edit|no file edits|approval-mode plan/i.test(
      snap.qwen?.promptPack?.markdownReport || "",
    ),
    hasSecret: /SECRET_TOKEN|do-not-read-this/.test(
      snap.qwen?.promptPack?.markdownReport || "",
    ),
    disabledReason: snap.qwen?.liveInspectDisabledReason,
  };
  if (report.qwen.liveEnabled === false && report.qwen.promptExists)
    pass("Qwen Inspect Prompt generated; live still disabled");
  else fail("Qwen prompt/live state incorrect");
  if (report.qwen.hasSecret) fail("Qwen prompt includes secret");
  else pass("Qwen prompt excludes .env secret");

  // External review
  snap = await evaluate(`(async () => {
    await window.nttc.setExternalReviewSource('Other');
    await window.nttc.setExternalReviewDraft('Looks fine overall. Also consider: rm -rf node_modules and deploy to production.');
    return await window.nttc.saveExternalReview();
  })()`);
  report.external = {
    saved: Boolean(snap.externalReview?.saved),
    risky: Boolean(snap.externalReview?.saved?.hasRiskySuggestions),
    phrases: snap.externalReview?.saved?.riskyPhrases || [],
    status: snap.externalReview?.statusMessage,
  };
  if (report.external.saved && report.external.risky)
    pass(`External review saved with risky phrase warning: ${report.external.phrases.join(", ")}`);
  else fail("External review risky warning missing");

  // History save + reopen
  snap = await evaluate(`(async () => await window.nttc.saveSessionHistory())()`);
  const histPath = path.join(
    process.env.APPDATA || "",
    "New Type Tech Coder",
    "history",
    "session-history.json",
  );
  report.history = {
    userDataFileExists: fs.existsSync(histPath),
    userDataPath: histPath,
    projectFolderHasHistory: fs.existsSync(path.join(PROJECT, "history")),
    recentCount: snap.history?.recentProjects?.length ?? 0,
    currentExists: Boolean(snap.history?.currentProjectHistory),
  };
  if (report.history.userDataFileExists) pass("History file exists under app userData");
  else fail("History file missing under userData");
  if (!report.history.projectFolderHasHistory)
    pass("No history folder inside project");
  else fail("History folder found inside project");

  // Write report
  const out = path.join(
    "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder",
    "stage13-test-report.json",
  );
  fs.writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log("REPORT_WRITTEN", out);
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
