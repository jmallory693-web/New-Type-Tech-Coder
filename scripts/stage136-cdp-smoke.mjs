/**
 * Stage 136 packaged-app smoke — Local Coder Task Prompt after Stage 135.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9252
 * Smoke-only: no product features. No Live Write. No AI calls.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const CDP = "http://127.0.0.1:9252";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;
const CODER_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildLocalCoderTaskPrompt.js",
);
const CODER_MODE_JS = path.join(
  REPO,
  "dist-electron",
  "shared",
  "buildModeLocalCoderTaskPrompt.js",
);

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 136 Local Coder Task Prompt packaging smoke.
## Product Requirements
Packaged generate/copy/clear without AI.
## User Stories
As a user I generate a copy/paste coder prompt.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A.
## Screen / Workflow Flow
Build tab Local Coder Task Prompt.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/BuildModeTab.tsx
## Build Phases
1A — Stage 136 smoke
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
  spawn(EXE, ["--remote-debugging-port=9252"], {
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

async function ensureAcceptedPlannerResponse(evaluate, snap) {
  let s = await snap();
  const steps = [];

  const hasAccepted =
    s.localPlannerResponseImport?.saved &&
    !s.localPlannerResponseImport.saved.stale &&
    s.localPlannerResponseImport.saved.acceptedForCoderPromptPrep &&
    (s.localPlannerResponseImport.saved.status === "Good" ||
      s.localPlannerResponseImport.saved.status === "Caution");
  if (hasAccepted) {
    steps.push("already-accepted");
    return { snapshot: s, steps };
  }

  if (!s.blueprint?.importedBlueprint) {
    steps.push("set-blueprint");
    await evaluate(
      `window.nttc.setBlueprintIntake(${JSON.stringify({
        projectIdea: "Stage 136 Local Coder Task Prompt packaging smoke.",
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

  if (s.localPlannerBuildBrief?.canGenerate || !s.localPlannerBuildBrief?.saved) {
    if (s.localPlannerBuildBrief?.canGenerate) {
      steps.push("generate-brief");
      await evaluate(`window.nttc.generateLocalPlannerBuildBrief()`);
      await new Promise((r) => setTimeout(r, 600));
      s = await snap();
    }
  }

  if (s.localPlannerBuildBrief?.saved) {
    steps.push("analyze-response");
    await evaluate(
      `window.nttc.setLocalPlannerResponseDraftText(${JSON.stringify(GOOD_RESPONSE)})`,
    );
    await evaluate(`window.nttc.analyzeLocalPlannerResponse()`);
    await new Promise((r) => setTimeout(r, 600));
    s = await snap();
    if (
      s.localPlannerResponseImport?.canAccept ||
      (s.localPlannerResponseImport?.saved &&
        s.localPlannerResponseImport.saved.status !== "Blocked")
    ) {
      steps.push("accept-response");
      await evaluate(
        `window.nttc.markLocalPlannerResponseAcceptedForCoderPromptPrep()`,
      );
      await new Promise((r) => setTimeout(r, 400));
      s = await snap();
    }
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
    coderPrompt:
      bundleText.includes("Local Coder Task Prompt") &&
      bundleText.includes("Generate Coder Prompt") &&
      bundleText.includes("Copy Coder Prompt") &&
      bundleText.includes("Clear Coder Prompt"),
    styles:
      bundleText.includes("Small local coder") &&
      bundleText.includes("General coder") &&
      bundleText.includes("Strict patch-planning coder"),
    copyPasteNote: /does not send it automatically/i.test(bundleText),
    guideNote:
      /Local Coder Task Prompts turn an accepted local planner response/i.test(
        bundleText,
      ),
    responseImportStillThere: bundleText.includes(
      "Local Planner Response Import",
    ),
    buildBriefStillThere: bundleText.includes("Local Planner Build Brief"),
    noApplyPatch: !bundleText.includes("Apply Patch"),
  };
  for (const [k, v] of Object.entries(report.bundle)) {
    if (!v) fail(`bundle.${k}`);
  }

  // Structural coder prompt (offline)
  const coderMod = await import(pathToFileURL(CODER_JS).href);
  const coderModeMod = await import(pathToFileURL(CODER_MODE_JS).href);
  const evaluatePre = coderMod.evaluateLocalCoderTaskPromptPreconditions;
  const buildCoder = coderMod.buildLocalCoderTaskPrompt;
  const normalize = coderModeMod.normalizeLocalCoderTaskPromptRecord;
  const tombstone = coderModeMod.emptyLocalCoderTaskPromptTombstone;

  const buildBase = {
    plannerResponseStatus: "Good",
    plannerResponseAcceptedAt: "2026-07-15T12:00:00.000Z",
    plannerResponseAnalyzedAt: "2026-07-15T11:59:00.000Z",
    recommendedNextTask: "Add login form submit handler",
    whyThisTask: "Foundation for auth",
    likelyFiles: ["src/auth/LoginForm.tsx", "src/auth/api.ts"],
    filesNotToTouch: ["package.json"],
    risks: ["Partial submit state"],
    acceptanceChecks: ["Form submits without throw"],
    coderPromptOutline: "Implement submit only",
    stopConditions: ["Stop if package.json changes needed"],
    blueprintProjectType: "web-app",
    targetFolderPath: "C:/tmp/scaffold",
    targetSafetyStatus: "safe",
    scaffoldWriteWrittenAt: "2026-07-15T10:00:00.000Z",
    scaffoldCreatedRelativePaths: ["package.json", "src/index.ts"],
    fileTreeGeneratedAt: null,
    fileTreeProposedPaths: [],
    selectedTaskTitle: "Wire login form",
  };

  report.structural = {};
  {
    const noResp = evaluatePre({
      plannerResponseExists: false,
      plannerResponseStale: false,
      plannerResponseStatus: null,
      acceptedForCoderPromptPrep: false,
      recommendedNextTask: null,
      likelyFilesCount: 0,
      scaffoldFilesCount: 0,
    });
    report.structural.noResponse = !noResp.canGenerate;
    const blocked = evaluatePre({
      plannerResponseExists: true,
      plannerResponseStale: false,
      plannerResponseStatus: "Blocked",
      acceptedForCoderPromptPrep: true,
      recommendedNextTask: "X",
      likelyFilesCount: 1,
      scaffoldFilesCount: 0,
    });
    report.structural.blocked = !blocked.canGenerate;
    const notAccepted = evaluatePre({
      plannerResponseExists: true,
      plannerResponseStale: false,
      plannerResponseStatus: "Good",
      acceptedForCoderPromptPrep: false,
      recommendedNextTask: "X",
      likelyFilesCount: 1,
      scaffoldFilesCount: 0,
    });
    report.structural.notAccepted = !notAccepted.canGenerate;
    const good = buildCoder({ ...buildBase, promptStyle: "general-coder" });
    report.structural.goodGenerate = Boolean(good.record?.markdown);
    report.structural.header = /# NTTC Local Coder Task Prompt/.test(
      good.record?.markdown || "",
    );
    report.structural.sections =
      /## Purpose/.test(good.record?.markdown || "") &&
      /## Model Role/.test(good.record?.markdown || "") &&
      /## Current Task/.test(good.record?.markdown || "") &&
      /## Project Context/.test(good.record?.markdown || "") &&
      /## Files Likely Involved/.test(good.record?.markdown || "") &&
      /## Files Not To Touch/.test(good.record?.markdown || "") &&
      /## Implementation Boundaries/.test(good.record?.markdown || "") &&
      /## Acceptance Checks/.test(good.record?.markdown || "") &&
      /## Risks To Avoid/.test(good.record?.markdown || "") &&
      /## Desired Output Format/.test(good.record?.markdown || "");
    report.structural.notRunningCommands =
      /not running commands/i.test(good.record?.markdown || "");
    report.structural.notEditingDirectly =
      /not editing files directly/i.test(good.record?.markdown || "");
    report.structural.noAutoApply =
      /will not auto-apply/i.test(good.record?.markdown || "");
    report.structural.humanOnly =
      /human-only|NTTC will not run commands/i.test(
        good.record?.markdown || "",
      );
    report.structural.noSecrets =
      /Do not include secrets/.test(good.record?.markdown || "") &&
      /Do not include \.env files/.test(good.record?.markdown || "") &&
      /Do not include API keys/.test(good.record?.markdown || "") &&
      /Do not include private keys/.test(good.record?.markdown || "");
    report.structural.noPostinstall =
      /postinstall\/preinstall/.test(good.record?.markdown || "") &&
      /destructive commands/.test(good.record?.markdown || "");
    const small = buildCoder({
      ...buildBase,
      promptStyle: "small-local-coder",
    });
    report.structural.smallStyle = /Prefer \*\*one file\*\*/.test(
      small.record?.markdown || "",
    );
    const strict = buildCoder({
      ...buildBase,
      promptStyle: "strict-patch-planning-coder",
    });
    report.structural.strictStyle =
      /before\/after/.test(strict.record?.markdown || "") &&
      /uncertainty list/.test(strict.record?.markdown || "");
    const caution = buildCoder({
      ...buildBase,
      promptStyle: "general-coder",
      plannerResponseStatus: "Caution",
    });
    report.structural.cautionNote = (caution.record?.warnings || []).some((w) =>
      /Caution/i.test(w),
    );
    report.structural.tombstone = normalize(tombstone()) === null;
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
  report.chrome.guideTab = /Quick Start|Local Coder Task Prompt/i.test(
    guideBody,
  );
  report.chrome.guideNote =
    /Local Coder Task Prompts turn an accepted local planner response/i.test(
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
    const response = labels.indexOf('Local Planner Response Import');
    const coder = labels.indexOf('Local Coder Task Prompt');
    const safety = labels.indexOf('Safety Charter');
    return {
      response,
      coder,
      safety,
      ok: response >= 0 && coder > response && safety > coder,
    };
  })()`);
  const styleOptions = await evaluate(`(() => {
    const sel = [...document.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => /Small local coder/i.test(o.textContent || '')),
    );
    if (!sel) return null;
    const texts = [...sel.options].map((o) => (o.textContent || '').trim());
    return {
      small: texts.some((t) => /^Small local coder$/i.test(t)),
      general: texts.some((t) => /^General coder$/i.test(t)),
      strict: texts.some((t) => /^Strict patch-planning coder$/i.test(t)),
    };
  })()`);

  report.buildTab = {
    open: /Safe Scaffold|Local Planner|Local Coder/i.test(buildBody),
    buildBrief: /Local Planner Build Brief/i.test(buildBody),
    responseImport: /Local Planner Response Import/i.test(buildBody),
    coderPrompt: /Local Coder Task Prompt/i.test(buildBody),
    orderOk: orderCheck?.ok === true,
    generate: buildButtons.some((b) => /^Generate Coder Prompt$/i.test(b)),
    copy: buildButtons.some((b) => /^Copy Coder Prompt$/i.test(b)),
    clear: buildButtons.some((b) => /^Clear Coder Prompt$/i.test(b)),
    styleSmall: styleOptions?.small === true,
    styleGeneral: styleOptions?.general === true,
    styleStrict: styleOptions?.strict === true,
    copyPasteNote:
      /copy\/paste into a local coder model/i.test(buildBody) &&
      /does not send it automatically/i.test(buildBody),
    noRunCoder: !buildButtons.some((b) => /^Run Coder$/i.test(b)),
    noSendToAi: !buildButtons.some((b) => /^Send to AI$/i.test(b)),
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

  // Live IPC: generate coder prompt from accepted response
  const ready = await ensureAcceptedPlannerResponse(evaluate, snap);
  report.live = { steps: ready.steps };
  let s = ready.snapshot;

  if (
    !s.localPlannerResponseImport?.saved?.acceptedForCoderPromptPrep ||
    s.localPlannerResponseImport.saved.stale
  ) {
    fail("Could not prepare accepted planner response for coder prompt smoke");
  } else {
    await evaluate(
      `window.nttc.setLocalCoderTaskPromptOptions(${JSON.stringify({
        promptStyle: "general-coder",
      })})`,
    );
    await evaluate(`window.nttc.generateLocalCoderTaskPrompt()`);
    await new Promise((r) => setTimeout(r, 600));
    s = await snap();
    const saved = s.localCoderTaskPrompt?.saved;
    report.live.generated =
      Boolean(saved?.markdown) &&
      /# NTTC Local Coder Task Prompt/.test(saved.markdown);
    report.live.includesTask = /login form/i.test(
      saved?.recommendedTask || saved?.markdown || "",
    );

    await evaluate(
      `window.nttc.setLocalCoderTaskPromptOptions(${JSON.stringify({
        promptStyle: "small-local-coder",
      })})`,
    );
    // style change should stale if generated
    s = await snap();
    report.live.staleOnStyleChange =
      !s.localCoderTaskPrompt?.saved ||
      s.localCoderTaskPrompt.saved.stale === true;

    await evaluate(`window.nttc.generateLocalCoderTaskPrompt()`);
    await new Promise((r) => setTimeout(r, 500));
    s = await snap();
    report.live.smallStyle =
      s.localCoderTaskPrompt?.saved?.promptStyle === "small-local-coder";

    await evaluate(`window.nttc.clearLocalCoderTaskPrompt()`);
    await new Promise((r) => setTimeout(r, 400));
    s = await snap();
    report.live.cleared = !s.localCoderTaskPrompt?.saved;

    // Re-generate for persistence
    await evaluate(
      `window.nttc.setLocalCoderTaskPromptOptions(${JSON.stringify({
        promptStyle: "general-coder",
      })})`,
    );
    await evaluate(`window.nttc.generateLocalCoderTaskPrompt()`);
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!report.live.generated) fail("live generate failed");
  if (!report.live.cleared) fail("live clear failed");

  // Persistence restart
  ws.close();
  killApp();
  await new Promise((r) => setTimeout(r, 2000));
  ({ page, evaluate, snap, ws } = await launchApp());
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.persistence = {
    restored: Boolean(s.localCoderTaskPrompt?.saved?.markdown),
    restoredStale: s.localCoderTaskPrompt?.saved?.stale === true,
  };
  if (!report.persistence.restored) fail("coder prompt did not restore");

  // Stale after response re-analyze
  if (s.localPlannerBuildBrief?.saved) {
    await evaluate(
      `window.nttc.setLocalPlannerResponseDraftText(${JSON.stringify(GOOD_RESPONSE)})`,
    );
    await evaluate(`window.nttc.analyzeLocalPlannerResponse()`);
    await new Promise((r) => setTimeout(r, 500));
    s = await snap();
    report.persistence.staleAfterResponseChange =
      s.localCoderTaskPrompt?.saved?.stale === true;
    if (!report.persistence.staleAfterResponseChange) {
      fail("coder prompt should stale after response re-analyze");
    }
  }

  // Clear persists
  await evaluate(`window.nttc.clearLocalCoderTaskPrompt()`);
  await new Promise((r) => setTimeout(r, 400));
  ws.close();
  killApp();
  await new Promise((r) => setTimeout(r, 2000));
  ({ page, evaluate, snap, ws } = await launchApp());
  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 2000));
  s = await snap();
  report.persistence.clearPersists = !s.localCoderTaskPrompt?.saved;
  if (!report.persistence.clearPersists) fail("clear did not persist");

  // Regressions
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

  report.safety = {
    noApplyPatch: await evaluate(
      `[...document.querySelectorAll('button')].every((b) => !/^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
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
