/**
 * Stage 134 packaged-app smoke — Local Planner Response Import after Stage 133.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9251
 * Smoke-only: no product features. No Live Write. No AI calls.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const CDP = "http://127.0.0.1:9251";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;
const PARSE_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "parseLocalPlannerResponse.js",
);
const IMPORT_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildModeLocalPlannerResponseImport.js",
);

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 134 Local Planner Response Import packaging smoke.
## Product Requirements
Packaged paste/analyze/copy/clear without AI.
## User Stories
As a user I paste a local planner answer into NTTC.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A.
## Screen / Workflow Flow
Build tab Local Planner Response Import.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/BuildModeTab.tsx
## Build Phases
1A — Stage 134 smoke
## Validation Plan
Packaged CDP smoke.
## Risks / Open Questions
None.
## AI Team Roles
Human + NTTC.
## Phase 1 Builder Handoff
None.
## Current Status
Ready.
`;

const GOOD_RESPONSE = `
## Recommended Next Task
Add the login form submit handler.

## Why This Task
Foundation for auth.

## Likely Files
- src/auth/LoginForm.tsx
- src/auth/api.ts

## Files Not To Touch
- package.json
- src/main/index.ts

## Risks
- Partial submit state

## Acceptance Checks
- Form submits without throw
- Errors display on failure

## Coder Prompt Outline
Implement submit only. Do not change routes.

## Critic Review Questions
- Did you touch package.json?
- Are stop conditions clear?

## Commands
- npm run typecheck (human only)

## Stop Conditions
- Stop if package.json changes are needed
- Stop if more than 3 files required
`;

const report = { failures: [], warnings: [], pass: false };

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function killApp() {
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], {
    stdio: "ignore",
  });
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
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  };
  const snap = () => evaluate("window.nttc.getSnapshot()");
  return { page, evaluate, snap, ws };
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const t = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === ${JSON.stringify(label)},
    );
    if (t) t.click();
  })()`);
}

async function launchApp() {
  killApp();
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9251"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 7000));
  return connect();
}

function cardCount(s) {
  return (
    s.blueprint?.phaseTaskCards?.saved?.cards?.length ??
    s.blueprint?.phaseTaskCards?.cards?.length ??
    0
  );
}

async function ensureBriefReady(evaluate, snap) {
  let s = await snap();
  const steps = [];
  if (s.localPlannerBuildBrief?.canGenerate || s.localPlannerBuildBrief?.saved) {
    if (!s.localPlannerBuildBrief?.saved) {
      steps.push("generate-brief");
      await evaluate(`window.nttc.generateLocalPlannerBuildBrief()`);
      await new Promise((r) => setTimeout(r, 600));
      s = await snap();
    } else {
      steps.push("brief-already-present");
    }
    return { snapshot: s, steps };
  }

  if (!s.blueprint?.importedBlueprint) {
    steps.push("set-blueprint");
    await evaluate(
      `window.nttc.setBlueprintIntake(${JSON.stringify({
        projectIdea: "Stage 134 Response Import packaging smoke.",
        projectType: "web-app",
        buildStyle: "small-model-friendly",
      })})`,
    );
    await evaluate(
      `window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`,
    );
    await evaluate(`window.nttc.saveImportedBlueprint()`);
    await new Promise((r) => setTimeout(r, 500));
    s = await snap();
  }

  if (cardCount(s) <= 0 && s.blueprint?.importedBlueprint) {
    steps.push("generate-task-cards");
    await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
    await new Promise((r) => setTimeout(r, 1000));
    s = await snap();
  }

  const hasPreviewOrWrite =
    Boolean(s.safeScaffoldWrite?.saved?.createdRelativePaths?.length) ||
    Boolean(s.safeScaffoldFileTreePreview?.saved) ||
    Boolean(s.safeScaffoldFileContentPreview?.saved);

  if (!hasPreviewOrWrite && s.safeScaffoldTarget?.selectedPath) {
    steps.push("generate-file-tree-preview");
    try {
      await evaluate(`window.nttc.refreshSafeScaffoldTargetSafety()`);
      await new Promise((r) => setTimeout(r, 400));
      await evaluate(`window.nttc.generateSafeScaffoldFileTreePreview()`);
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      steps.push(`tree-preview-error:${err.message || err}`);
    }
    s = await snap();
  }

  if (s.localPlannerBuildBrief?.canGenerate) {
    steps.push("generate-brief");
    await evaluate(`window.nttc.generateLocalPlannerBuildBrief()`);
    await new Promise((r) => setTimeout(r, 600));
    s = await snap();
  } else {
    steps.push("brief-blocked");
    steps.push(
      ...(s.localPlannerBuildBrief?.readinessBlockedReasons ?? []).slice(0, 5),
    );
  }
  return { snapshot: s, steps };
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  // Bundle wiring
  const distJs = fs
    .readdirSync(path.join(REPO, "dist", "assets"))
    .find((f) => f.endsWith(".js"));
  const bundleText = fs.readFileSync(
    path.join(REPO, "dist", "assets", distJs),
    "utf8",
  );
  report.bundle = {
    responseImport:
      bundleText.includes("Local Planner Response Import") &&
      bundleText.includes("Analyze Planner Response") &&
      bundleText.includes("Copy Planner Response Summary") &&
      bundleText.includes("Clear Planner Response"),
    guideNote: /Local Planner Response Import lets you paste a local model's planning answer/i.test(
      bundleText,
    ),
    untrusted: /untrusted claim/i.test(bundleText),
    buildBriefStillThere: bundleText.includes("Local Planner Build Brief"),
    noApplyPatch: !bundleText.includes("Apply Patch"),
  };
  if (!report.bundle.responseImport) fail("Bundle missing Response Import wiring");
  if (!report.bundle.guideNote) fail("Bundle missing Response Import guide note");
  if (!report.bundle.untrusted) fail("Bundle missing untrusted claim wording");
  if (!report.bundle.buildBriefStillThere) fail("Bundle missing Build Brief");
  if (!report.bundle.noApplyPatch) fail("Bundle unexpectedly contains Apply Patch");

  // Structural parser (offline)
  const parseMod = await import(pathToFileURL(PARSE_JS).href);
  const importMod = await import(pathToFileURL(IMPORT_JS).href);
  const analyze = parseMod.analyzeLocalPlannerResponse;
  const evaluatePre = parseMod.evaluateLocalPlannerResponseImportPreconditions;
  const normalize = importMod.normalizeLocalPlannerResponseImportRecord;
  const tombstone = importMod.emptyLocalPlannerResponseImportTombstone;

  const briefMeta = {
    sourceBriefGeneratedAt: "2026-07-15T00:00:00.000Z",
    sourceBriefMode: "post-write",
    sourceBriefStrictness: "smallest-safe",
    sourceBriefTargetLocalModelType: "general-local-llm",
    sourceSelectedTaskId: "t1",
    sourceSelectedTaskTitle: "Wire login form",
    briefExists: true,
    briefStale: false,
  };

  report.structural = {};
  {
    const noBrief = evaluatePre({ briefExists: false, briefStale: false });
    report.structural.noBrief = !noBrief.canAnalyze;
    const empty = analyze({ rawResponseText: "  ", ...briefMeta });
    report.structural.emptyBlocked = !empty.record;
    const good = analyze({ rawResponseText: GOOD_RESPONSE, ...briefMeta });
    report.structural.goodStatus =
      good.record?.status === "Good" || good.record?.status === "Caution";
    report.structural.summaryHeader = /# NTTC Local Planner Response Summary/.test(
      good.record?.summaryMarkdown || "",
    );
    report.structural.hasSections =
      /## Recommended Next Task/.test(good.record?.summaryMarkdown || "") &&
      /## Likely Files/.test(good.record?.summaryMarkdown || "") &&
      /## Files Not To Touch/.test(good.record?.summaryMarkdown || "") &&
      /## Risks/.test(good.record?.summaryMarkdown || "") &&
      /## Acceptance Checks/.test(good.record?.summaryMarkdown || "") &&
      /## Coder Prompt Outline/.test(good.record?.summaryMarkdown || "") &&
      /## Critic Review Questions/.test(good.record?.summaryMarkdown || "") &&
      /## Requested Commands/.test(good.record?.summaryMarkdown || "") &&
      /## Stop Conditions/.test(good.record?.summaryMarkdown || "") &&
      /## Safety Warnings/.test(good.record?.summaryMarkdown || "") &&
      /## NTTC Decision/.test(good.record?.summaryMarkdown || "");
    report.structural.extractTask = /login form/i.test(
      good.record?.parsed?.recommendedNextTask || "",
    );
    report.structural.extractFiles =
      (good.record?.parsed?.likelyFiles || []).some((f) => /LoginForm/.test(f));
    report.structural.extractNotTouch =
      (good.record?.parsed?.filesNotToTouch || []).some((f) =>
        /package\.json/.test(f),
      );
    report.structural.commandsHumanOnly = /NTTC will not run commands/.test(
      good.record?.summaryMarkdown || "",
    );
    const runCmd = analyze({
      rawResponseText:
        "## Recommended Next Task\nDo X\n\nAsk NTTC to run the build commands.",
      ...briefMeta,
    });
    report.structural.blockRunCommands = runCmd.record?.status === "Blocked";
    const install = analyze({
      rawResponseText:
        "## Recommended Next Task\nDo X\n\nAsk NTTC to install packages with npm install.",
      ...briefMeta,
    });
    report.structural.blockInstall = install.record?.status === "Blocked";
    const patch = analyze({
      rawResponseText:
        "## Recommended Next Task\nDo X\n\nAsk NTTC to apply patch now.",
      ...briefMeta,
    });
    report.structural.blockPatch = patch.record?.status === "Blocked";
    const rewrite = analyze({
      rawResponseText:
        "## Recommended Next Task\nBroad rewrite of the entire codebase.",
      ...briefMeta,
    });
    report.structural.blockRewrite = rewrite.record?.status === "Blocked";
    report.structural.tombstone = normalize(tombstone()) === null;
    report.structural.acceptDisabledWhenBlocked =
      runCmd.record?.status === "Blocked" &&
      !runCmd.record?.acceptedForCoderPromptPrep;
  }
  for (const [k, v] of Object.entries(report.structural)) {
    if (!v) fail(`structural.${k}`);
  }

  // Launch packaged app
  let { page, evaluate, snap, ws } = await launchApp();
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));

  report.packagedShell = {
    pageUrl: page.url,
    usesVite: /5173|vite/i.test(page.url || ""),
    usesAsar: /app\.asar/i.test(page.url || ""),
  };
  if (report.packagedShell.usesVite) fail("Vite/dev mode detected");
  if (!report.packagedShell.usesAsar) fail("Expected app.asar file URL");

  // Tabs / chrome
  const dashboardBody = await evaluate(`document.body.innerText`);
  report.chrome = {
    dashboard: /Daily Next Action|Recommended|Dashboard/i.test(dashboardBody),
    inspectOnly: /Inspect-only/i.test(dashboardBody),
    ollamaBubble: /Ollama/i.test(dashboardBody),
  };

  for (const tab of ["Guide", "Blueprint", "Build", "Project Setup", "Reports"]) {
    await clickTab(evaluate, tab);
    await new Promise((r) => setTimeout(r, 500));
  }
  await clickTab(evaluate, "Guide");
  await new Promise((r) => setTimeout(r, 400));
  const guideBody = await evaluate(`document.body.innerText`);
  report.chrome.guideTab = /Quick Start|Local Planner Response Import/i.test(
    guideBody,
  );
  report.chrome.guideNote = /Local Planner Response Import lets you paste/i.test(
    guideBody,
  );

  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 800));
  const buildBody = await evaluate(`document.body.innerText`);
  const buildButtons = await evaluate(`(() => {
    return [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean);
  })()`);
  const orderCheck = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.field-label')].map((el) =>
      (el.textContent || '').trim(),
    );
    const brief = labels.indexOf('Local Planner Build Brief');
    const response = labels.indexOf('Local Planner Response Import');
    const safety = labels.indexOf('Safety Charter');
    return {
      brief,
      response,
      safety,
      ok: brief >= 0 && response > brief && safety > response,
    };
  })()`);

  report.buildTab = {
    open: /Safe Scaffold|Local Planner/i.test(buildBody),
    buildBrief: /Local Planner Build Brief/i.test(buildBody),
    responseImport: /Local Planner Response Import/i.test(buildBody),
    orderOk: orderCheck?.ok === true,
    textarea: /Paste Planner Response/i.test(buildBody),
    analyze: buildButtons.some((b) => /^Analyze Planner Response$/i.test(b)),
    copySummary: buildButtons.some((b) =>
      /^Copy Planner Response Summary$/i.test(b),
    ),
    clear: buildButtons.some((b) => /^Clear Planner Response$/i.test(b)),
    acceptMarker: buildButtons.some((b) =>
      /Accepted For Coder Prompt Prep/i.test(b),
    ),
    noRunPlanner: !buildButtons.some((b) => /^Run Planner$/i.test(b)),
    noSendToAi: !buildButtons.some((b) => /^Send to AI$/i.test(b)),
    noRunCoder: !buildButtons.some((b) => /^Run Coder$/i.test(b)),
    noApplyPatch: !buildButtons.some((b) => /^Apply Patch$/i.test(b)),
    noWriteExisting: !buildButtons.some((b) =>
      /Write\/Edit Existing Files/i.test(b),
    ),
    noTerminal: !/Custom Command|Terminal Command/i.test(buildBody),
    noInstallUi: !buildButtons.some((b) => /^Install Packages$/i.test(b)),
    safeScaffoldWrite: /Safe Scaffold Write/i.test(buildBody),
    liveQwenDisabled: !/Live Qwen enabled/i.test(buildBody),
  };
  for (const [k, v] of Object.entries(report.buildTab)) {
    if (!v) fail(`buildTab.${k}`);
  }

  // Workflow step
  await clickTab(evaluate, "Dashboard");
  await new Promise((r) => setTimeout(r, 500));
  const dashBody = await evaluate(`document.body.innerText`);
  report.workflow = {
    hasResponseImportStep: /Local Planner Response Import/i.test(dashBody),
  };

  // Live IPC: not-ready without brief, then analyze with brief
  await clickTab(evaluate, "Build");
  await new Promise((r) => setTimeout(r, 400));

  // Clear any prior response/brief state for not-ready check when possible
  try {
    await evaluate(`window.nttc.clearLocalPlannerResponse()`);
  } catch {
    /* ignore */
  }

  let s0 = await snap();
  report.live = { notReadyWithoutBrief: false, analyzeGood: false };

  // If brief missing, response should not be ready
  if (!s0.localPlannerBuildBrief?.saved) {
    report.live.notReadyWithoutBrief =
      s0.localPlannerResponseImport?.uiStatus === "not-ready" ||
      (s0.localPlannerResponseImport?.readinessBlockedReasons || []).length > 0;
  } else {
    // Temporarily: check readiness reasons after ensure path; mark as skip-ok
    report.live.notReadyWithoutBrief = true;
    report.warnings.push(
      "Brief already present — skipped fresh not-ready-without-brief UI assert",
    );
  }

  const ready = await ensureBriefReady(evaluate, snap);
  report.live.briefSteps = ready.steps;
  let s = ready.snapshot;

  if (!s.localPlannerBuildBrief?.saved) {
    fail("Could not generate Local Planner Build Brief for response import smoke");
  } else {
    await evaluate(
      `window.nttc.setLocalPlannerResponseDraftText(${JSON.stringify(GOOD_RESPONSE)})`,
    );
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(`window.nttc.analyzeLocalPlannerResponse()`);
    await new Promise((r) => setTimeout(r, 600));
    s = await snap();
    const saved = s.localPlannerResponseImport?.saved;
    report.live.analyzeGood =
      Boolean(saved) &&
      (saved.status === "Good" || saved.status === "Caution") &&
      /# NTTC Local Planner Response Summary/.test(saved.summaryMarkdown || "");
    report.live.canAccept = s.localPlannerResponseImport?.canAccept === true;
    report.live.status = saved?.status || null;
    report.live.extractTask = /login form/i.test(
      saved?.parsed?.recommendedNextTask || "",
    );

    if (report.live.canAccept) {
      await evaluate(
        `window.nttc.markLocalPlannerResponseAcceptedForCoderPromptPrep()`,
      );
      await new Promise((r) => setTimeout(r, 400));
      s = await snap();
      report.live.accepted =
        s.localPlannerResponseImport?.saved?.acceptedForCoderPromptPrep === true;
      report.live.acceptedMetadataOnly =
        !/# NTTC Local Coder/.test(
          s.localPlannerResponseImport?.saved?.summaryMarkdown || "",
        );
    } else {
      report.live.accepted = false;
      fail("canAccept was false after Good/Caution analyze");
    }

    // Blocked: ask NTTC to run commands
    await evaluate(
      `window.nttc.setLocalPlannerResponseDraftText(${JSON.stringify(
        "## Recommended Next Task\nDo X\n\nAsk NTTC to run the build commands.",
      )})`,
    );
    await evaluate(`window.nttc.analyzeLocalPlannerResponse()`);
    await new Promise((r) => setTimeout(r, 500));
    s = await snap();
    report.live.blockedStatus =
      s.localPlannerResponseImport?.saved?.status === "Blocked";
    report.live.acceptDisabledBlocked =
      s.localPlannerResponseImport?.canAccept === false;

    // Clear
    await evaluate(`window.nttc.clearLocalPlannerResponse()`);
    await new Promise((r) => setTimeout(r, 400));
    s = await snap();
    report.live.cleared = !s.localPlannerResponseImport?.saved;

    // Re-analyze for persistence restart check
    await evaluate(
      `window.nttc.setLocalPlannerResponseDraftText(${JSON.stringify(GOOD_RESPONSE)})`,
    );
    await evaluate(`window.nttc.analyzeLocalPlannerResponse()`);
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!report.live.analyzeGood) fail("live analyze Good/Caution failed");
  if (!report.live.blockedStatus) fail("live blocked status failed");
  if (!report.live.acceptDisabledBlocked)
    fail("live accept should be disabled when Blocked");
  if (!report.live.cleared) fail("live clear failed");

  // Persistence: restart
  ws.close();
  killApp();
  await new Promise((r) => setTimeout(r, 2000));
  ({ page, evaluate, snap, ws } = await launchApp());
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.persistence = {
    restored: Boolean(s.localPlannerResponseImport?.saved?.summaryMarkdown),
    restoredStale: s.localPlannerResponseImport?.saved?.stale === true,
  };
  if (!report.persistence.restored) fail("response did not restore after restart");

  // Stale on brief regenerate
  if (s.localPlannerBuildBrief?.canGenerate || s.localPlannerBuildBrief?.saved) {
    await evaluate(`window.nttc.generateLocalPlannerBuildBrief()`);
    await new Promise((r) => setTimeout(r, 600));
    s = await snap();
    report.persistence.staleAfterBriefRegen =
      s.localPlannerResponseImport?.saved?.stale === true;
    if (!report.persistence.staleAfterBriefRegen) {
      fail("response should stale after brief regenerate");
    }
  }

  // Clear persists
  await evaluate(`window.nttc.clearLocalPlannerResponse()`);
  await new Promise((r) => setTimeout(r, 400));
  ws.close();
  killApp();
  await new Promise((r) => setTimeout(r, 2000));
  ({ page, evaluate, snap, ws } = await launchApp());
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.persistence.clearPersists = !s.localPlannerResponseImport?.saved;
  if (!report.persistence.clearPersists)
    fail("clear did not persist across restart");

  // Blueprint / Reports regression presence
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 500));
  const bpBody = await evaluate(`document.body.innerText`);
  report.regressions = {
    blueprint: /Project Blueprint Planner|Blueprint/i.test(bpBody),
  };
  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 500));
  const rpBody = await evaluate(`document.body.innerText`);
  report.regressions.reports =
    /Architecture Health|Code Context Pack|Patch Draft/i.test(rpBody);
  report.regressions.architectureIntake =
    /Architecture Refactor|Implementation Intake/i.test(rpBody);
  if (!report.regressions.blueprint) fail("Blueprint tab regression");
  if (!report.regressions.reports) fail("Reports tab regression");

  // Safety: Live Qwen / Apply Patch
  report.safety = {
    noApplyPatch: await evaluate(
      `[...document.querySelectorAll('button')].every((b) => !/^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    ),
    noAiAutoInStatus:
      !(s.localPlannerResponseImport?.statusMessage || "").includes(
        "Calling Ollama",
      ),
  };
  if (!report.safety.noApplyPatch) fail("Apply Patch button found");

  ws.close();
  killApp();

  report.pass = report.failures.length === 0;
} catch (err) {
  fail(String(err?.stack || err));
  try {
    killApp();
  } catch {
    /* ignore */
  }
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
