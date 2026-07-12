/**
 * Stage 64 packaged-app smoke harness (CDP).
 * Stage 63 live Ollama usability fixes + prior regressions.
 *
 * Launch packaged app first:
 *   "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9237
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9237";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  inspectOnly: null,
  liveQwenDisabled: null,
  stage63: {},
  regressions: {},
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

function readJsHaystack(rootDir) {
  let haystack = "";
  if (!fs.existsSync(rootDir)) return haystack;
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.name.endsWith(".js")) {
        haystack += fs.readFileSync(fullPath, "utf8");
      }
    }
  }
  return haystack;
}

function scanBundleStrings() {
  const renderer = readJsHaystack(path.join(REPO, "dist", "assets"));
  const main = readJsHaystack(path.join(REPO, "dist-electron"));
  const haystack = `${renderer}\n${main}`;
  return {
    workingBanner: haystack.includes("Working…"),
    slowReminder: haystack.includes("Large local models can take 1–2+ minutes."),
    contextSlowWarning: haystack.includes(
      "This context may be slow for local models",
    ),
    fastDraftSetupButton: haystack.includes("Fast Draft Setup"),
    fastDraftSetupMessage: haystack.includes(
      "Fast Draft Setup reduces context size",
    ),
    patchDraftFailureFollowUp: haystack.includes(
      "Patch Draft did not complete, so Patch Draft Safety Review is not available yet",
    ),
    progressStartedLog: haystack.includes("Local AI request progress started"),
    progressCompletedLog: haystack.includes(
      "Local AI request completed with elapsed time",
    ),
    progressFailedLog: haystack.includes(
      "Local AI request failed with elapsed time",
    ),
    contextWarningLog: haystack.includes("Context-size warning shown"),
    fastDraftLog: haystack.includes("Fast Draft Setup clicked"),
    applyFastDraftIpc: haystack.includes("nttc:apply-fast-draft-setup"),
    stage48FailureHint: haystack.includes("Try a smaller installed model"),
    codeContextSection: haystack.includes("Code Context Pack — Preview Only"),
    askCodeAiSection: haystack.includes("Ask Local AI About Selected Code"),
    codeQuestionTemplates: haystack.includes("Code Question Templates"),
    patchDraftSection: haystack.includes("Patch Draft Mode — No Apply"),
    safetyReviewSection: haystack.includes("Patch Draft Safety Review"),
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
    builderPlanMode: haystack.includes("Builder Plan Mode — Plan Only"),
    askLocalAiRole: haystack.includes("Ask Local AI Role"),
    implementationReview: haystack.includes("Implementation Review"),
    builderPlanComparison: haystack.includes("Builder Plan Comparison"),
    roleModelMapping: haystack.includes("Role Model Mapping"),
    speakerScripts: haystack.includes("Speaker Scripts"),
    confirmCodeAi: haystack.includes(
      "Send this approved Code Context Pack to Local AI",
    ),
    confirmPatchDraft: haystack.includes(
      "Send this approved Code Context Pack to Local AI for a patch draft",
    ),
    noApplyPatchButton: !haystack.includes("Apply Patch"),
  };
}

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
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  };
  return { page, evaluate, ws };
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button,[role=tab]')].find((el) =>
      (el.textContent || '').includes(${JSON.stringify(label)}),
    );
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 600));
}

function fileStatSafe(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { exists: true, mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return { exists: false, mtimeMs: null, size: null };
  }
}

try {
  const bundle = scanBundleStrings();
  report.stage63.bundleStrings = bundle;

  for (const [key, ok] of Object.entries(bundle)) {
    if (key === "noApplyPatchButton") {
      if (!ok) fail("Apply Patch button string found in bundle");
      continue;
    }
    if (!ok) fail(`Stage 63/64 bundle string missing: ${key}`);
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const bodyText = await evaluate(`document.body ? document.body.innerText : ''`);
  report.inspectOnly = /Inspect-only/i.test(bodyText);
  report.liveQwenDisabled = /Live Qwen disabled/i.test(bodyText);

  await clickTab(evaluate, "AI Review");
  const aiReviewText = await evaluate(`document.body.innerText`);
  report.liveQwenDisabled =
    report.liveQwenDisabled || /Live Qwen disabled/i.test(aiReviewText);

  const pkgJsonPath = path.join(PROJECT, "package.json");
  const beforePkg = fileStatSafe(pkgJsonPath);

  let snap = await evaluate(
    `window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`,
  );
  snap = await evaluate(`window.nttc.summarizeProject()`);
  snap = await evaluate(`window.nttc.generateReviewPack()`);

  await clickTab(evaluate, "Reports");
  snap = await evaluate(`window.nttc.refreshCodeContextFileList()`);

  report.stage63.fastDraftButtonInUi = await evaluate(
    `[...document.querySelectorAll('button')].some((b) => /Fast Draft Setup/i.test(b.textContent || ''))`,
  );

  const beforeFastDraft = {
    maxLines: snap.codeContext?.maxLinesPerFile,
    codeAiExcerpt: snap.patchDraft?.includeCodeAiResponseExcerpt,
    planExcerpt: snap.patchDraft?.includeBuilderPlanDecisionExcerpt,
    implExcerpt: snap.patchDraft?.includeImplementationReviewExcerpt,
    selectedCount: snap.codeContext?.selectedCount,
    savedDraftId: snap.patchDraft?.saved?.id ?? null,
    codeAiBusy: snap.codeContextAi?.busy,
    patchDraftBusy: snap.patchDraft?.busy,
  };

  snap = await evaluate(`window.nttc.applyFastDraftSetup()`);
  report.stage63.fastDraftSetup = {
    maxLinesPerFile: snap.codeContext?.maxLinesPerFile,
    includeCodeAi: snap.patchDraft?.includeCodeAiResponseExcerpt,
    includeBuilderPlan: snap.patchDraft?.includeBuilderPlanDecisionExcerpt,
    includeImpl: snap.patchDraft?.includeImplementationReviewExcerpt,
    statusMessage: snap.codeContext?.statusMessage,
    selectedCountUnchanged:
      snap.codeContext?.selectedCount === beforeFastDraft.selectedCount,
    noAutoSend:
      !snap.codeContextAi?.busy &&
      !snap.patchDraft?.busy &&
      (snap.patchDraft?.saved?.id ?? null) === beforeFastDraft.savedDraftId,
  };

  const candidates = snap.codeContext?.candidates ?? [];
  const tsCandidate = candidates.find((c) => /\.tsx?$/.test(c.relativePath));
  if (tsCandidate) {
    snap = await evaluate(
      `window.nttc.setCodeContextFileSelected(${JSON.stringify(tsCandidate.relativePath)}, true)`,
    );
    snap = await evaluate(`window.nttc.generateCodeContextPreview()`);
  }

  const patchDraftFail = await evaluate(`window.nttc.generatePatchDraft()`);
  report.stage63.patchDraftFailure = {
    hasFailureMessage: Boolean(patchDraftFail.patchDraft?.lastFailureMessage),
    failureFollowUpInStatus:
      /Patch Draft did not complete|timed out|failed/i.test(
        patchDraftFail.patchDraft?.lastFailureMessage || "",
      ) ||
      /Patch Draft did not complete|timed out|failed/i.test(
        patchDraftFail.patchDraft?.statusMessage || "",
      ),
    stage48Fields:
      /Patch Draft|model|http:\/\/|smaller installed model|shorter context/i.test(
        patchDraftFail.patchDraft?.statusMessage ||
          patchDraftFail.patchDraft?.lastFailureMessage ||
          "",
      ),
    noDraftSaved: !patchDraftFail.patchDraft?.saved,
    hadExistingDraft: Boolean(beforeFastDraft.savedDraftId),
  };

  await clickTab(evaluate, "AI Review");
  const progressProbe = await evaluate(`(async () => {
    if (typeof window.nttc.testProviderConnection !== 'function') {
      return { skipped: true, reason: 'no testProviderConnection' };
    }
    await window.nttc.testProviderConnection();
    const started = window.nttc.askLocalAi();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const snap = await window.nttc.getSnapshot();
      if (snap.localAiProgress?.active) {
        await new Promise((r) => setTimeout(r, 1200));
        const text = document.body.innerText || '';
        return {
          active: true,
          mode: snap.localAiProgress.mode,
          label: snap.localAiProgress.label,
          modelName: snap.localAiProgress.modelName,
          baseUrl: snap.localAiProgress.baseUrl,
          workingText: /Working…/i.test(text),
          slowReminder: /Large local models can take 1–2\\+ minutes/i.test(text),
          elapsedShown: /\\d+s elapsed/i.test(text),
        };
      }
    }
    try { await started; } catch {}
    return { active: false };
  })()`);
  report.stage63.progressIndicator = progressProbe;

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.stage63.failureFollowUpInUi =
    /Patch Draft did not complete, so Patch Draft Safety Review is not available yet/i.test(
      reportsText,
    );
  report.stage63.failureFollowUpSkipped =
    !report.stage63.failureFollowUpInUi &&
    report.stage63.patchDraftFailure?.hadExistingDraft;

  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  report.regressions.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(
    aiText,
  );
  report.regressions.askLocalAiRole = /Ask Local AI Role/i.test(aiText);
  report.regressions.speakerScripts = /Speaker Scripts/i.test(aiText);

  const roleHelp = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('.role-help-link')][0];
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 350));
    const panel = !!document.querySelector('.role-help-panel');
    document.querySelector('.role-help-close')?.click();
    return { panel, linkCount: document.querySelectorAll('.role-help-link').length };
  })()`);
  report.regressions.roleHelp = roleHelp;

  await clickTab(evaluate, "Request / Output");
  const reqText = await evaluate(`document.body.innerText`);
  report.regressions.implementationReview = /Implementation Review/i.test(
    reqText,
  );
  report.regressions.builderPlanComparison = /Builder Plan Comparison/i.test(
    reqText,
  );

  await clickTab(evaluate, "Settings");
  const settingsText = await evaluate(`document.body.innerText`);
  report.regressions.roleModelMapping = /Role Model Mapping/i.test(settingsText);

  const safetySnap = await evaluate(`window.nttc.getSnapshot()`);
  const safetyUi = await evaluate(`(() => ({
    noEditButton: ![...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || '')),
    noTtsControl: ![...document.querySelectorAll('button,input')].some((el) =>
      /\\bTTS\\b|Play audio|Speak aloud/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
    ),
    noCustomCmd: ![...document.querySelectorAll('input,textarea')].some((el) =>
      /custom command|type a command/i.test(el.getAttribute('placeholder') || ''),
    ),
    noApplyPatch: ![...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim())),
  }))()`);

  const afterPkg = fileStatSafe(pkgJsonPath);
  report.regressions.sourceUnchanged = beforePkg.mtimeMs === afterPkg.mtimeMs;
  report.regressions.projectMemory = /Project Memory \/ Handoff Files/i.test(
    reportsText,
  );
  report.regressions.codeContextPack = /Code Context Pack — Preview Only/i.test(
    reportsText,
  );
  report.regressions.codeQuestionTemplates = /Code Question Templates/i.test(
    reportsText,
  );
  report.regressions.patchDraftMode = /Patch Draft Mode — No Apply/i.test(
    reportsText,
  );
  report.regressions.safetyReview = /Patch Draft Safety Review/i.test(
    reportsText,
  );

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.inspectOnly) fail("Inspect-only badge missing");
  if (!report.liveQwenDisabled) fail("Live Qwen disabled banner missing");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  if (safetySnap?.safety?.mode !== "inspect-only") fail("Expected inspect-only mode");
  if (!report.stage63.fastDraftButtonInUi) fail("Fast Draft Setup button missing in UI");
  if (report.stage63.fastDraftSetup?.maxLinesPerFile !== 25) {
    fail("Fast Draft Setup did not set max lines to 25");
  }
  if (
    report.stage63.fastDraftSetup?.includeCodeAi ||
    report.stage63.fastDraftSetup?.includeBuilderPlan ||
    report.stage63.fastDraftSetup?.includeImpl
  ) {
    fail("Fast Draft Setup did not turn optional excerpts off");
  }
  if (!report.stage63.fastDraftSetup?.selectedCountUnchanged) {
    fail("Fast Draft Setup changed file selection");
  }
  if (!report.stage63.fastDraftSetup?.noAutoSend) {
    fail("Fast Draft Setup triggered auto-send or draft generation");
  }
  if (!report.stage63.failureFollowUpInUi && !report.stage63.failureFollowUpSkipped) {
    if (report.stage63.patchDraftFailure?.hasFailureMessage) {
      fail("Patch Draft failure follow-up not shown near Safety Review");
    }
  }
  if (
    report.stage63.progressIndicator?.active &&
    (!report.stage63.progressIndicator.workingText ||
      !report.stage63.progressIndicator.slowReminder ||
      !report.stage63.progressIndicator.elapsedShown)
  ) {
    fail("Progress indicator missing Working…, elapsed seconds, or slow reminder");
  }
  if (!report.regressions.sourceUnchanged) fail("Source files changed after smoke ops");
  if (!safetyUi.noApplyPatch) fail("Apply Patch button unexpectedly present");
  if (!safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (!safetyUi.noTtsControl) fail("Audio/TTS unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");
  if (!roleHelp?.panel) fail("Clickable role help modal failed");

  for (const [key, ok] of Object.entries(report.regressions)) {
    if (key === "roleHelp") continue;
    if (!ok) fail(`Regression check failed: ${key}`);
  }

  console.log(JSON.stringify({ report, project: PROJECT }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
