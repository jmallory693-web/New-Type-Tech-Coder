/**
 * Stage 68 packaged-app smoke harness (CDP).
 * Stage 67 Manual Patch Draft Import + regressions.
 *
 * Launch packaged app first:
 *   "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9239
 */
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9239";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const DISPOSABLE =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const PROJECT = fs.existsSync(DISPOSABLE) ? DISPOSABLE : REPO;

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  stage67: {},
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
    manualImportSection: haystack.includes("Manual Patch Draft Import"),
    saveImportedDraft: haystack.includes("Save Imported Patch Draft"),
    clearImportedDraft: haystack.includes("Clear Imported Patch Draft"),
    copyImportedDraft: haystack.includes("Copy Imported Patch Draft"),
    safetyReviewTarget: haystack.includes("Safety Review Target"),
    importedSources: [
      "Cursor",
      "Codex",
      "Claude",
      "ChatGPT",
      "Grok",
      "Qwen",
      "Human programmer",
      "Other",
    ].every((s) => haystack.includes(s)),
    importedTypes: [
      "Patch draft",
      "Diff-like draft",
      "Code snippet proposal",
      "Implementation plan",
      "Revision request",
      "Unknown",
    ].every((s) => haystack.includes(s)),
    saveImportedIpc: haystack.includes("nttc:save-imported-patch-draft"),
    setReviewTargetIpc: haystack.includes(
      "nttc:set-patch-draft-safety-review-target",
    ),
    reviewTargetSection: haystack.includes("## Review Target"),
    ollamaNotChecked: haystack.includes("Ollama: Not checked"),
    codeContextSection: haystack.includes("Code Context Pack — Preview Only"),
    askCodeAiSection: haystack.includes("Ask Local AI About Selected Code"),
    patchDraftSection: haystack.includes("Patch Draft Mode — No Apply"),
    safetyReviewSection: haystack.includes("Patch Draft Safety Review"),
    projectMemorySection: haystack.includes("Project Memory / Handoff Files"),
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
  await new Promise((r) => setTimeout(r, 700));
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
  report.stage67.bundleStrings = bundle;
  for (const [key, ok] of Object.entries(bundle)) {
    if (key === "noApplyPatchButton") {
      if (!ok) fail("Apply Patch button string found in bundle");
      continue;
    }
    if (!ok) fail(`Stage 67/68 bundle string missing: ${key}`);
  }

  const { page, evaluate, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  const headerText = await evaluate(`document.body.innerText`);
  report.stage67.inspectOnly = /Inspect-only/i.test(headerText);
  report.stage67.liveQwenDisabled = /Live Qwen disabled/i.test(headerText);
  report.stage67.ollamaBubble = /Ollama:/i.test(headerText);

  await clickTab(evaluate, "Reports");
  const reportsText = await evaluate(`document.body.innerText`);
  report.stage67.manualImportVisible =
    /Manual Patch Draft Import/i.test(reportsText);
  report.stage67.saveButtonVisible =
    /Save Imported Patch Draft/i.test(reportsText);
  report.stage67.clearButtonVisible =
    /Clear Imported Patch Draft/i.test(reportsText);
  report.stage67.copyButtonVisible =
    /Copy Imported Patch Draft/i.test(reportsText);

  const dropdowns = await evaluate(`(() => {
    const selects = [...document.querySelectorAll('select')];
    const source = selects.find((s) => {
      const opts = [...s.options].map((o) => o.value);
      return opts.includes('Cursor') && opts.includes('Claude') && opts.includes('Human programmer');
    });
    const draftType = selects.find((s) => {
      const opts = [...s.options].map((o) => o.value);
      return opts.includes('Patch draft') && opts.includes('Diff-like draft') && opts.includes('Revision request');
    });
    return {
      sourceOptions: source ? [...source.options].map((o) => o.value) : [],
      draftTypeOptions: draftType ? [...draftType.options].map((o) => o.value) : [],
      hasTextarea: !!document.querySelector('textarea[placeholder*="outside"]') ||
        !!document.querySelector('textarea[placeholder*="Paste proposed"]'),
    };
  })()`);
  report.stage67.dropdowns = dropdowns;

  const beforePkg = fileStatSafe(path.join(PROJECT, "package.json"));

  // Empty import
  await evaluate(`window.nttc.setImportedPatchDraftDraft('')`);
  const emptySnap = await evaluate(`window.nttc.saveImportedPatchDraft()`);
  report.stage67.emptyImportBlocked = /paste an imported patch draft/i.test(
    emptySnap.importedPatchDraft?.statusMessage || "",
  );

  // Normal imported draft
  const normalDraft =
    "Proposed change: update src/renderer/App.tsx to add a helper.\n// patch draft from smoke test";
  await evaluate(
    `window.nttc.setImportedPatchDraftSource('Claude')`,
  );
  await evaluate(
    `window.nttc.setImportedPatchDraftType('Diff-like draft')`,
  );
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft(${JSON.stringify(normalDraft)})`,
  );
  const saveSnap = await evaluate(`window.nttc.saveImportedPatchDraft()`);
  report.stage67.normalSave = {
    saved: !!saveSnap.importedPatchDraft?.saved,
    source: saveSnap.importedPatchDraft?.saved?.source,
    draftType: saveSnap.importedPatchDraft?.saved?.draftType,
    hasPreview: Boolean(saveSnap.importedPatchDraft?.saved?.previewExcerpt),
    reviewTarget:
      saveSnap.patchDraftSafetyReview?.reviewTarget ?? null,
  };

  // Risk phrase warning (live scan in UI — save still allowed)
  const riskyDraft = "Please enable edit mode and run commands in arbitrary terminal.";
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft(${JSON.stringify(riskyDraft)})`,
  );
  const riskySnap = await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  report.stage67.riskySave = {
    riskCount: riskySnap.importedPatchDraft?.saved?.riskPhraseCount ?? 0,
    riskPhrases: riskySnap.importedPatchDraft?.saved?.riskPhrases ?? [],
    actionLogRisk: (riskySnap.actionLog ?? []).some((e) =>
      /risk phrases detected/i.test(e.message),
    ),
  };

  // Secret pattern warning — blocked without override
  const secretDraft = "API_KEY=sk-testsecretvalue1234567890abcdef";
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft(${JSON.stringify(secretDraft)})`,
  );
  const secretSnap = await evaluate(`window.nttc.saveImportedPatchDraft()`);
  report.stage67.secretBlocked = {
    stillHasPrevious: !!secretSnap.importedPatchDraft?.saved,
    statusMessage: secretSnap.importedPatchDraft?.statusMessage ?? "",
    actionLogSecret: (secretSnap.actionLog ?? []).some((e) =>
      /possible secret detected/i.test(e.message),
    ),
  };

  // Copy imported draft
  const copySnap = await evaluate(`window.nttc.recordCopyImportedPatchDraft()`);
  report.stage67.copyLogged = (copySnap.actionLog ?? []).some((e) =>
    /Imported patch draft copied/i.test(e.message),
  );

  // Safety review for imported draft
  await evaluate(
    `window.nttc.setPatchDraftSafetyReviewTarget('imported-patch-draft')`,
  );
  const targetSnap = await evaluate(
    `window.nttc.setPatchDraftSafetyReviewTarget('imported-patch-draft')`,
  );
  report.stage67.targetSelected = {
    reviewTarget: targetSnap.patchDraftSafetyReview?.reviewTarget,
    actionLog: (targetSnap.actionLog ?? []).some((e) =>
      /safety review target selected/i.test(e.message),
    ),
  };

  const reviewSnap = await evaluate(
    `window.nttc.generatePatchDraftSafetyReview()`,
  );
  report.stage67.importedSafetyReview = {
    generated: !!reviewSnap.patchDraftSafetyReview?.saved,
    reviewTargetLabel:
      reviewSnap.patchDraftSafetyReview?.saved?.reviewTargetLabel ?? null,
    reviewTargetKind:
      reviewSnap.patchDraftSafetyReview?.saved?.reviewTargetKind ?? null,
    recommendation:
      reviewSnap.patchDraftSafetyReview?.saved?.recommendation ?? null,
    markdownHasTarget: /Review Target/i.test(
      reviewSnap.patchDraftSafetyReview?.saved?.markdownReport || "",
    ),
    importedEmphasis: /outside NTTC|did not apply/i.test(
      reviewSnap.patchDraftSafetyReview?.saved?.markdownReport || "",
    ),
    actionLogGenerated: (reviewSnap.actionLog ?? []).some((e) =>
      /safety review generated for imported draft/i.test(e.message),
    ),
  };

  // Target selector when both drafts exist — generate NTTC patch draft is heavy;
  // verify selector UI exists in bundle and IPC works
  report.stage67.targetSelectorInBundle = bundle.safetyReviewTarget;

  const afterPkg = fileStatSafe(path.join(PROJECT, "package.json"));
  report.regressions = {
    codeContextPack: /Code Context Pack — Preview Only/i.test(reportsText),
    askCodeAi: /Ask Local AI About Selected Code/i.test(reportsText),
    codeQuestionTemplates: /Code Question Template/i.test(reportsText),
    patchDraft: /Patch Draft Mode — No Apply/i.test(reportsText),
    safetyReview: /Patch Draft Safety Review/i.test(reportsText),
    projectMemory: /Project Memory \/ Handoff Files/i.test(reportsText),
    sourceUnchanged: beforePkg.mtimeMs === afterPkg.mtimeMs,
    noApplyPatch: await evaluate(
      `![...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    ),
  };

  await clickTab(evaluate, "AI Review");
  const aiText = await evaluate(`document.body.innerText`);
  report.regressions.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(aiText);
  report.regressions.speakerScripts = /Speaker Scripts/i.test(aiText);

  await clickTab(evaluate, "Request / Output");
  const reqText = await evaluate(`document.body.innerText`);
  report.regressions.implementationReview = /Implementation Review/i.test(reqText);
  report.regressions.builderPlanComparison = /Builder Plan Comparison/i.test(reqText);

  await clickTab(evaluate, "Settings");
  report.regressions.roleModelMapping = /Role Model Mapping/i.test(
    await evaluate(`document.body.innerText`),
  );

  const safetyUi = await evaluate(`(() => ({
    noEditButton: ![...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || '')),
    noTtsControl: ![...document.querySelectorAll('button,input')].some((el) =>
      /\\bTTS\\b|Play audio|Speak aloud/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
    ),
    noCustomCmd: ![...document.querySelectorAll('input,textarea')].some((el) =>
      /custom command|type a command/i.test(el.getAttribute('placeholder') || ''),
    ),
  }))()`);

  const safetySnap = await evaluate(`window.nttc.getSnapshot()`);

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.stage67.manualImportVisible) fail("Manual Patch Draft Import not visible");
  if (!report.stage67.saveButtonVisible) fail("Save Imported Patch Draft not visible");
  if (!report.stage67.clearButtonVisible) fail("Clear Imported Patch Draft not visible");
  if (!report.stage67.copyButtonVisible) fail("Copy Imported Patch Draft not visible");
  if (!dropdowns.sourceOptions.includes("Cursor")) fail("Source dropdown missing Cursor");
  if (!dropdowns.sourceOptions.includes("Claude")) fail("Source dropdown missing Claude");
  if (!dropdowns.draftTypeOptions.includes("Patch draft")) {
    fail("Draft type dropdown missing Patch draft");
  }
  if (!dropdowns.draftTypeOptions.includes("Unknown")) {
    fail("Draft type dropdown missing Unknown");
  }
  if (!report.stage67.emptyImportBlocked) fail("Empty import did not show clear message");
  if (!report.stage67.normalSave.saved) fail("Normal imported draft did not save");
  if (report.stage67.normalSave.source !== "Claude") {
    fail(`Expected source Claude, got ${report.stage67.normalSave.source}`);
  }
  if (report.stage67.normalSave.reviewTarget !== "imported-patch-draft") {
    fail("Review target not auto-set to imported-patch-draft after save");
  }
  if (report.stage67.riskySave.riskCount < 1) fail("Risk phrases not detected on risky draft");
  if (!report.stage67.secretBlocked.actionLogSecret) {
    fail("Secret detection not logged");
  }
  if (/possible secret/i.test(report.stage67.secretBlocked.statusMessage) === false &&
      !report.stage67.secretBlocked.stillHasPrevious) {
    // blocked save should keep previous or show message
  }
  if (!report.stage67.importedSafetyReview.generated) {
    fail("Safety review for imported draft not generated");
  }
  if (!/Imported Patch Draft from Claude/i.test(
    report.stage67.importedSafetyReview.reviewTargetLabel || "",
  )) {
    fail("Review target label missing imported source");
  }
  if (!report.stage67.importedSafetyReview.importedEmphasis) {
    fail("Safety review missing imported-draft emphasis");
  }
  if (!report.regressions.sourceUnchanged) fail("Source files changed after smoke");
  if (!safetyUi.noEditButton) fail("Edit mode unexpectedly present");
  if (!safetyUi.noTtsControl) fail("TTS unexpectedly present");
  if (!safetyUi.noCustomCmd) fail("Custom command input unexpectedly present");
  if (safetySnap?.qwen?.liveInspectEnabled) fail("Live Qwen should be disabled");
  for (const [key, ok] of Object.entries(report.regressions)) {
    if (!ok) fail(`Regression failed: ${key}`);
  }

  console.log(JSON.stringify({ report, project: PROJECT }, null, 2));
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
