/**
 * Stage 85 packaged-app smoke (CDP).
 * Blueprint Planner suggestion polish + quick Local Planner AI smoke.
 *
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9239
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage75-Disposable";
const QA_MODEL = "qwen2.5-coder:7b";
const SAVED_MAPPING_MARKER = "qwen2.5-coder:7b";
const IDEA =
  "I want to build a small offline habit tracker for Windows. It should track habits, daily completion, streaks, notes, and simple local saves. Build it in small phases for a non-coder.";

const report = { failures: [], warnings: [], pass: false };

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

async function connect() {
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

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').trim() === ${JSON.stringify(label)},
    );
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 700));
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");
  const renderer = fs.readFileSync(
    path.join(
      REPO,
      "dist",
      "assets",
      fs.readdirSync(path.join(REPO, "dist", "assets")).find((f) => f.endsWith(".js")) ?? "",
    ),
    "utf8",
  );
  report.bundle = {
    blueprintPlannerHint: /Large coder models may time out/i.test(renderer),
    suggestBlueprintPlanner: renderer.includes("suggestBlueprintPlannerModel"),
  };

  const { page, evaluate, ws } = await connect();
  report.launch = { pageUrl: page.url, usesVite: /5173|vite/i.test(page.url || "") };

  const headerText = await evaluate(`document.body.innerText.slice(0, 2500)`);
  report.shell = {
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1200));
  const mappingBefore = (await evaluate(`window.nttc.getSnapshot()`)).roleModelMapping
    ?.mappings?.["blueprint-planner"];

  await evaluate(`window.nttc.refreshInstalledModels()`);
  await new Promise((r) => setTimeout(r, 2500));
  const afterRefresh = await evaluate(`window.nttc.getSnapshot()`);
  const names = (afterRefresh.installedModels?.models ?? []).map((m) => m.name);
  await evaluate(`window.nttc.suggestRoleModelDefaults()`);
  await new Promise((r) => setTimeout(r, 500));
  const afterSuggest = await evaluate(`window.nttc.getSnapshot()`);
  const suggested = afterSuggest.roleModelMapping?.mappings?.["blueprint-planner"];
  report.blueprintPlannerSuggestion = {
    suggested,
    avoidsLarge:
      !/30b|a3b|32b|70b/i.test(suggested ?? "") ||
      suggested === "qwen2.5-coder:7b",
    prefersSmall:
      /7b|8b|6\.7b|1\.5b/i.test(suggested ?? "") ||
      ["llama3.1", "mistral", "gemma", "phi"].some((k) =>
        (suggested ?? "").toLowerCase().includes(k),
      ),
    mappingBeforeReload: mappingBefore,
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1000));
  const afterReload = await evaluate(`window.nttc.getSnapshot()`);
  report.mappingPersistence = {
    afterSuggest,
    afterReload: afterReload.roleModelMapping?.mappings?.["blueprint-planner"],
    persistedThroughReload: Boolean(afterReload.roleModelMapping?.mappings?.["blueprint-planner"]),
  };

  await clickTab(evaluate, "Blueprint");
  report.blueprintUi = {
    askBtn: await evaluate(
      `[...document.querySelectorAll('button.action-btn')].some((b) => (b.textContent || '').trim() === 'Ask Local Planner AI')`,
    ),
  };

  await clickTab(evaluate, "Settings / Advanced");
  await new Promise((r) => setTimeout(r, 600));
  const settingsText = await evaluate(`document.body.innerText`);
  report.settings = {
    blueprintPlannerRole: /Blueprint Planner/i.test(settingsText),
    helperMention: /Large coder models may time out|7B–8B|7B-8B/i.test(settingsText),
    roleModelMapping: /Role Model Mapping/i.test(settingsText),
  };

  await evaluate(
    `window.nttc.setRoleModelMapping("blueprint-planner", ${JSON.stringify(QA_MODEL)})`,
  );
  await evaluate(`window.nttc.testProviderConnection()`);
  await new Promise((r) => setTimeout(r, 2500));
  await clickTab(evaluate, "Blueprint");
  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({ projectIdea: IDEA, buildStyle: "small-model-friendly" })})`,
  );
  await new Promise((r) => setTimeout(r, 400));

  const pkgMtime = fs.existsSync(path.join(PROJECT, "package.json"))
    ? fs.statSync(path.join(PROJECT, "package.json")).mtimeMs
    : null;
  const planningBefore = fs.existsSync(path.join(PROJECT, ".nttc", "planning"))
    ? fs.readdirSync(path.join(PROJECT, ".nttc", "planning")).length
    : 0;

  await evaluate(`(() => {
    window.__confirmResult = false;
    window.confirm = (m) => window.__confirmResult;
  })()`);
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button.action-btn')].find((b) =>
      (b.textContent || '').trim() === 'Ask Local Planner AI',
    );
    if (btn && !btn.disabled) btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  let snap = await evaluate(`window.nttc.getSnapshot()`);
  const noDraftCancel = !snap.blueprint?.plannerAi?.saved;

  await evaluate(`(() => { window.__confirmResult = true; })()`);
  await evaluate(`window.nttc.askLocalPlannerAi()`);
  const start = Date.now();
  while (Date.now() - start < 180000) {
    snap = await evaluate(`window.nttc.getSnapshot()`);
    if (snap.blueprint?.plannerAi?.saved?.responseText) break;
    if (
      !snap.blueprint?.plannerAi?.busy &&
      /failed|timed out|blocked/i.test(snap.blueprint?.plannerAi?.statusMessage ?? "")
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const draft = snap.blueprint?.plannerAi?.saved;
  report.quickPlanner = {
    cancelOk: noDraftCancel,
    completed: Boolean(draft?.responseText),
    timedOut: /timed out/i.test(snap.blueprint?.plannerAi?.statusMessage ?? ""),
    elapsedSec: Math.round((Date.now() - start) / 1000),
    model: draft?.modelName ?? null,
    sections: draft?.sectionsPresent?.length ?? 0,
    readiness: draft?.readinessEstimate ?? null,
    boundaryLog: (snap.actionLog ?? []).some((e) =>
      /idea\/planning fields only/i.test(`${e.message} ${e.detail ?? ""}`),
    ),
    noPlanningWrite:
      (fs.existsSync(path.join(PROJECT, ".nttc", "planning"))
        ? fs.readdirSync(path.join(PROJECT, ".nttc", "planning")).length
        : 0) === planningBefore,
    pkgUnchanged:
      pkgMtime ===
      (fs.existsSync(path.join(PROJECT, "package.json"))
        ? fs.statSync(path.join(PROJECT, "package.json")).mtimeMs
        : null),
  };

  if (draft?.responseText) {
    await evaluate(`window.nttc.recordCopyBlueprintPlannerAiDraft()`);
    await evaluate(`window.nttc.saveBlueprintPlannerDraftAsImported()`);
    await evaluate(`window.nttc.checkBlueprintCompleteness()`);
    report.quickPlanner.copyAndSave = {
      imported: Boolean((await evaluate(`window.nttc.getSnapshot()`)).blueprint?.importedBlueprint),
      completeness: Boolean(
        (await evaluate(`window.nttc.getSnapshot()`)).blueprint?.completenessReport,
      ),
    };
  }

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.regressions = {
    workflowProgress: /Workflow Progress/i.test(reportsText),
    codeContext: /Code Context Pack/i.test(reportsText),
    patchDraft: /Patch Draft Mode — No Apply/i.test(reportsText),
    projectMemory: /Project Memory/i.test(reportsText),
  };

  ws.close();

  if (report.launch.usesVite) fail("Uses Vite");
  if (!report.bundle.blueprintPlannerHint) fail("Blueprint planner hint missing from bundle");
  if (!report.blueprintPlannerSuggestion.prefersSmall) fail("Suggestion not small/planning model");
  if (/30b|a3b/i.test(report.blueprintPlannerSuggestion.suggested ?? "")) {
    fail(`Suggested large model: ${report.blueprintPlannerSuggestion.suggested}`);
  }
  if (!report.blueprintUi.askBtn) fail("Ask Local Planner AI missing");
  if (!report.quickPlanner.cancelOk) fail("Cancel did not block draft");
  if (!report.quickPlanner.boundaryLog) fail("Boundary log missing");
  if (!report.quickPlanner.pkgUnchanged) fail("package.json changed");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(String(err?.message ?? err));
  report.pass = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
