/**
 * Stage 62 — Live Ollama Code AI / Patch Draft QA (packaged app, CDP).
 * Usage:
 *   node scripts/stage62-live-ollama-qa.mjs --phase=1
 *   node scripts/stage62-live-ollama-qa.mjs --phase=2
 *
 * Prerequisite: launch packaged app with CDP, e.g.
 *   "release/win-unpacked/New Type Tech Coder.exe" --remote-debugging-port=9236
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CDP = "http://127.0.0.1:9236";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const PROJECT =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\NTTC-Stage47-Disposable";
const STATE_FILE = path.join(REPO, "stage62-qa-state.json");
const REPORT_FILE = path.join(REPO, "stage62-qa-report.json");

const phase = process.argv.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "1";
const CODE_MODEL = "qwen2.5-coder:7b";
const FALLBACK_MODEL = "qwen2.5-coder:7b";

const report = {
  stage: "62",
  phase,
  timestamp: new Date().toISOString(),
  disposableProject: PROJECT,
  passed: [],
  failed: [],
  ollama: {},
  safetyConcerns: [],
  confusingUx: [],
  tinyFixes: [],
  laterFeatures: [],
  goNoGo: null,
  validation: {},
};

function pass(msg) {
  report.passed.push(msg);
}
function fail(msg) {
  report.failed.push(msg);
  console.error("FAIL:", msg);
}
function ux(msg) {
  report.confusingUx.push(msg);
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function projectFingerprints(root) {
  const files = ["package.json", "README.md", "src/renderer/App.tsx"];
  const out = {};
  for (const rel of files) {
    out[rel] = hashFile(path.join(root, rel));
  }
  return out;
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
      else if (entry.name.endsWith(".js")) haystack += fs.readFileSync(fullPath, "utf8");
    }
  }
  return haystack;
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
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  return { page, evaluate, ws };
}

async function timedEvaluate(evaluate, expression) {
  const start = Date.now();
  const value = await evaluate(expression);
  return { value, ms: Date.now() - start };
}

function analyzeCodeAiResponse(text) {
  const t = text || "";
  return {
    mentionsMissingContext: /more context|additional files|select more|need more excerpt/i.test(t),
    asksForCommands: /run\s+(npm|command)|execute\s+command|terminal|shell/i.test(t),
    asksForEdits: /edit\s+(the\s+)?files?|apply\s+(the\s+)?patch|write\s+to\s+disk/i.test(t),
    asksForFileAccess: /browse\s+(the\s+)?project|read\s+all\s+files|full\s+repo/i.test(t),
    hasSections: /##\s+/i.test(t),
  };
}

function analyzePatchDraft(text) {
  const t = text || "";
  return {
    hasNttcHeader: /#\s*NTTC Patch Draft/i.test(t),
    proposesFiles: /proposed files|files?\s+to\s+change|src\//i.test(t),
    hasValidation: /typecheck|build|smoke\s+test|validation/i.test(t),
    violatesNoApply: /\bapply\s+(the\s+)?patch\b|nttc\s+should\s+edit|write\s+changes?\s+to\s+disk/i.test(t),
    asksForCommands: /run\s+(npm|command)|arbitrary\s+terminal/i.test(t),
  };
}

async function runPhase1() {
  const beforeHashes = projectFingerprints(PROJECT);
  const { page, evaluate, ws } = await connect();

  report.validation.launch = {
    pageUrl: page.url,
    usesVite: /5173|vite/i.test(page.url || ""),
  };
  if (report.validation.launch.usesVite) fail("Packaged app appears to use Vite/dev URL");
  else pass("Packaged app launched without Vite/dev server");

  const haystack = readJsHaystack(path.join(REPO, "dist", "assets")) +
    readJsHaystack(path.join(REPO, "dist-electron"));
  report.validation.confirmStrings = {
    codeAi: haystack.includes("Send this approved Code Context Pack to Local AI"),
    codeAiExcerpts: haystack.includes("Only selected excerpts are sent"),
    codeAiNoEdits: haystack.includes("No source files are edited"),
    patchDraft: haystack.includes(
      "Send this approved Code Context Pack to Local AI for a patch draft",
    ),
    patchDraftOnly: haystack.includes("Output is a draft only"),
    patchDraftNoApply: haystack.includes("NTTC will not apply the patch"),
  };
  for (const [k, ok] of Object.entries(report.validation.confirmStrings)) {
    if (ok) pass(`Approval dialog copy present in bundle: ${k}`);
    else fail(`Missing approval dialog copy: ${k}`);
  }

  let snap = await evaluate(
    `window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`,
  );
  if (!snap.safety?.project) fail("Disposable project selection failed");
  else pass("Disposable project selected");

  snap = await evaluate(
    `window.nttc.updateProviderSettings(${JSON.stringify({
      providerType: "ollama-compatible",
      baseUrl: "http://127.0.0.1:11434",
      modelName: FALLBACK_MODEL,
    })})`,
  );
  const testConn = await timedEvaluate(evaluate, `window.nttc.testProviderConnection()`);
  report.ollama.testConnection = {
    ms: testConn.ms,
    state: testConn.value.provider?.connectionState,
    message: testConn.value.provider?.lastTestMessage,
  };
  if (testConn.value.provider?.connectionState === "ready") pass("Ollama Test Connection ready");
  else fail(`Ollama Test Connection failed: ${testConn.value.provider?.lastTestMessage}`);

  const refresh = await timedEvaluate(evaluate, `window.nttc.refreshInstalledModels()`);
  const modelNames = (refresh.value.installedModels?.models ?? []).map((m) => m.name);
  report.ollama.refresh = {
    ms: refresh.ms,
    count: modelNames.length,
    models: modelNames.slice(0, 15),
  };
  if (modelNames.length > 0) pass(`Refresh Installed Ollama Models (${modelNames.length} models)`);
  else fail("Refresh Installed Models returned no models");

  const mappings = [
    ["code-context-review", CODE_MODEL],
    ["patch-draft", CODE_MODEL],
    ["patch-planner", CODE_MODEL],
  ];
  for (const [role, model] of mappings) {
  if (!modelNames.includes(model)) {
      ux(`Model ${model} not in installed list; mapping may fall back`);
    }
    snap = await evaluate(
      `window.nttc.setRoleModelMapping(${JSON.stringify(role)}, ${JSON.stringify(model)})`,
    );
  }
  report.validation.modelMappings = snap.roleModelMapping?.mappings ?? {};
  if (snap.roleModelMapping?.mappings?.["code-context-review"] === CODE_MODEL) {
    pass("Code Reviewer (code-context-review) mapped");
  } else fail("Code Reviewer mapping not set");
  if (snap.roleModelMapping?.mappings?.["patch-draft"] === CODE_MODEL) {
    pass("Patch Draft mapped");
  } else fail("Patch Draft mapping not set");

  snap = await evaluate(`window.nttc.summarizeProject()`);
  report.validation.summary = Boolean(snap.projectSummary);
  if (snap.projectSummary) pass("Project Summary generated");
  else fail("Project Summary failed");

  snap = await evaluate(`window.nttc.refreshCodeContextFileList()`);
  const candidates = snap.codeContext?.candidates ?? [];
  const smallTs = candidates
    .filter((c) => /\.tsx?$/.test(c.relativePath))
    .slice(0, 3);
  if (smallTs.length < 1) fail("No .ts/.tsx candidates for Code Context Pack");
  for (const file of smallTs) {
    snap = await evaluate(
      `window.nttc.setCodeContextFileSelected(${JSON.stringify(file.relativePath)}, true)`,
    );
  }
  snap = await evaluate(`window.nttc.setCodeContextMaxLinesPerFile(40)`);
  snap = await evaluate(
    `window.nttc.applyCodeQuestionTemplate("safety-boundary-risks", "replace")`,
  );
  snap = await evaluate(`window.nttc.generateCodeContextPreview()`);
  const pack = snap.codeContext?.preview;
  const md = pack?.markdownReport ?? "";
  report.validation.codeContextPack = {
    generatedAt: pack?.generatedAt ?? null,
    selectedFiles: pack?.includedFileCount ?? 0,
    warnings: pack?.warningCount ?? 0,
    blockedSecrets: md.includes("BEGIN RSA PRIVATE KEY") || md.includes("API_KEY=supersecret"),
    hasPackHeader: md.includes("# NTTC Code Context Pack"),
    templateLabel: snap.codeContext?.selectedTemplate?.templateLabel ?? null,
  };
  if (pack && report.validation.codeContextPack.hasPackHeader) pass("Code Context Pack preview generated");
  else fail("Code Context Pack preview failed");
  if (!report.validation.codeContextPack.blockedSecrets) pass("No blocked/secret bodies in pack");
  else fail("Blocked/secret content may appear in pack");
  if (report.validation.codeContextPack.templateLabel) {
    pass(`Code Question template applied: ${report.validation.codeContextPack.templateLabel}`);
  }

  const actionLogBeforeCodeAi = (snap.actionLog ?? []).length;
  const codeAi = await timedEvaluate(evaluate, `window.nttc.askLocalAiAboutCodeContext()`);
  const codeAiSaved = codeAi.value.codeContextAi?.saved;
  report.ollama.codeAi = {
    ms: codeAi.ms,
    model: codeAiSaved?.modelName ?? null,
    roleMode: codeAiSaved?.roleMode ?? null,
    baseUrl: codeAiSaved?.baseUrl ?? null,
    truncated: codeAiSaved?.truncatedResponse ?? null,
    status: codeAi.value.codeContextAi?.statusMessage ?? null,
    analysis: analyzeCodeAiResponse(codeAiSaved?.responseText ?? ""),
    excerpt: (codeAiSaved?.previewExcerpt ?? "").slice(0, 400),
  };
  if (codeAiSaved?.responseText) {
    pass(`Code AI response received (${codeAi.ms} ms, model ${codeAiSaved.modelName})`);
    if (report.ollama.codeAi.analysis.hasSections) pass("Code AI response used structured sections");
    if (report.ollama.codeAi.analysis.mentionsMissingContext) {
      ux("Code AI mentioned missing context (may be appropriate)");
    }
    if (report.ollama.codeAi.analysis.asksForCommands) {
      report.safetyConcerns.push("Code AI response language mentions running commands");
    }
    if (report.ollama.codeAi.analysis.asksForEdits) {
      report.safetyConcerns.push("Code AI response language suggests edits/apply");
    }
  } else {
    fail(`Code AI failed: ${codeAi.value.codeContextAi?.statusMessage ?? "no response"}`);
    report.ollama.codeAi.error = codeAi.value.codeContextAi?.statusMessage;
  }

  const patchDraft = await timedEvaluate(evaluate, `window.nttc.generatePatchDraft()`);
  const draftSaved = patchDraft.value.patchDraft?.saved;
  report.ollama.patchDraft = {
    ms: patchDraft.ms,
    model: draftSaved?.modelName ?? null,
    roleMode: draftSaved?.roleMode ?? null,
    mappingKey: draftSaved?.mappingKey ?? null,
    status: patchDraft.value.patchDraft?.statusMessage ?? null,
    analysis: analyzePatchDraft(draftSaved?.draftText ?? ""),
    excerpt: (draftSaved?.previewExcerpt ?? "").slice(0, 400),
  };
  if (draftSaved?.draftText) {
    pass(`Patch Draft received (${patchDraft.ms} ms, model ${draftSaved.modelName})`);
    if (report.ollama.patchDraft.analysis.hasNttcHeader) pass("Patch Draft used # NTTC Patch Draft header");
    else ux("Patch Draft missing explicit # NTTC Patch Draft header");
    if (report.ollama.patchDraft.analysis.proposesFiles) pass("Patch Draft proposed files/areas");
    if (report.ollama.patchDraft.analysis.hasValidation) pass("Patch Draft mentioned validation steps");
    if (report.ollama.patchDraft.analysis.violatesNoApply) {
      report.safetyConcerns.push("Patch Draft language may violate no-apply boundary");
    }
  } else {
    fail(`Patch Draft failed: ${patchDraft.value.patchDraft?.statusMessage ?? "no draft"}`);
    report.ollama.patchDraft.error = patchDraft.value.patchDraft?.statusMessage;
  }

  const logBeforeSafety = (patchDraft.value.actionLog ?? []).length;
  const safetyReview = await timedEvaluate(
    evaluate,
    `window.nttc.generatePatchDraftSafetyReview()`,
  );
  const sr = safetyReview.value.patchDraftSafetyReview?.saved;
  const logAfterSafety = (safetyReview.value.actionLog ?? []).length;
  report.validation.safetyReview = {
    ms: safetyReview.ms,
    recommendation: sr?.recommendation ?? null,
    safetyFlags: sr?.safetyFlagCount ?? null,
    missingSafeguards: sr?.missingSafeguardCount ?? null,
    hasSuggestedPrompt: Boolean(sr?.suggestedNextPrompt?.trim()),
    excerpt: (sr?.previewExcerpt ?? "").slice(0, 350),
    newActionLogEntries: logAfterSafety - logBeforeSafety,
  };
  const builderJs = fs.readFileSync(
    path.join(REPO, "dist-electron", "main", "review", "buildPatchDraftSafetyReview.js"),
    "utf8",
  );
  report.validation.safetyReview.ruleBasedBuilder =
    builderJs.includes("rule/keyword-based") && !/\baskLocalAi\b/.test(builderJs);
  if (sr) {
    pass(`Patch Draft Safety Review generated (${safetyReview.ms} ms, rule-based)`);
    if (safetyReview.ms < 5000) pass("Safety Review completed quickly (no Ollama wait)");
    if (sr.recommendation) pass(`Safety Review recommendation: ${sr.recommendation}`);
    if (sr.suggestedNextPrompt) pass("Suggested Next Prompt present");
  } else {
    fail(`Patch Draft Safety Review failed: ${safetyReview.value.patchDraftSafetyReview?.statusMessage}`);
  }
  if (report.validation.safetyReview.ruleBasedBuilder) {
    pass("Safety Review builder is rule-based (no askLocalAi)");
  } else fail("Safety Review builder may not be rule-based");

  const builderPrompt = await timedEvaluate(evaluate, `window.nttc.generateBuilderPrompt()`);
  const bpText = builderPrompt.value.decision?.builderPrompt?.promptText ?? "";
  report.validation.builderPrompt = {
    ms: builderPrompt.ms,
    mentionsPatchDraft: /Patch Draft/i.test(bpText),
    mentionsSafetyReview: /Patch Draft Safety Review|Safety Review/i.test(bpText),
    length: bpText.length,
  };
  if (builderPrompt.value.decision?.builderPrompt) {
    pass("Builder Prompt generated");
    if (draftSaved && report.validation.builderPrompt.mentionsPatchDraft) {
      pass("Builder Prompt references Patch Draft");
    }
    if (sr && report.validation.builderPrompt.mentionsSafetyReview) {
      pass("Builder Prompt references Safety Review");
    }
  } else fail("Builder Prompt generation failed");

  const memPreview = await timedEvaluate(
    evaluate,
    `window.nttc.generateProjectMemoryPreview()`,
  );
  const memFiles = memPreview.value.projectMemory?.preview?.files ?? [];
  const statusMd =
    memFiles.find((f) => f.fileName === "STATUS.md")?.content ??
    memFiles.map((f) => f.content).join("\n");
  report.validation.projectMemory = {
    ms: memPreview.ms,
    fileCount: memFiles.length,
    mentionsCodeAi: /Code AI|Local AI Code Review/i.test(statusMd),
    mentionsPatchDraft: /Patch Draft/i.test(statusMd),
    mentionsSafetyReview: /Patch Draft Safety Review|Safety review/i.test(statusMd),
    storesFullDraft: statusMd.includes(draftSaved?.draftText?.slice(0, 200) ?? "___none___"),
  };
  if (memPreview.value.projectMemory?.preview) {
    pass("Project Memory preview generated");
    if (report.validation.projectMemory.mentionsCodeAi) pass("Project Memory mentions Code AI status");
    if (report.validation.projectMemory.mentionsPatchDraft) pass("Project Memory mentions Patch Draft");
    if (report.validation.projectMemory.mentionsSafetyReview) {
      pass("Project Memory mentions Patch Draft Safety Review");
    }
    if (!report.validation.projectMemory.storesFullDraft) {
      pass("Project Memory does not embed full Patch Draft body");
    } else {
      report.safetyConcerns.push("Project Memory may include large Patch Draft excerpt");
    }
  } else fail("Project Memory preview failed");

  const safetyUi = await evaluate(`(() => ({
    inspectOnly: /Inspect-only/i.test(document.body.innerText),
    liveQwen: /Live Qwen is disabled/i.test(document.body.innerText),
    noApplyPatchButton: ![...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim())),
    noEditMode: ![...document.querySelectorAll('button')].some((b) => /Enable Edit Mode/i.test(b.textContent || '')),
    noTts: ![...document.querySelectorAll('button,input')].some((el) => /\\bTTS\\b|Play audio/i.test((el.textContent || '') + (el.getAttribute('aria-label') || ''))),
    noCustomCmd: ![...document.querySelectorAll('input,textarea')].some((el) => /custom command|type a command/i.test(el.getAttribute('placeholder') || '')),
  }))()`);
  const safetySnap = await evaluate(`window.nttc.getSnapshot()`);
  report.validation.safety = {
    ui: safetyUi,
    mode: safetySnap.safety?.mode,
    writesAllowed: safetySnap.safety?.writesAllowed,
    liveInspectEnabled: safetySnap.qwen?.liveInspectEnabled,
  };
  if (safetyUi.noApplyPatchButton) pass("No Apply Patch button");
  if (safetySnap.safety?.mode === "inspect-only") pass("Inspect-only mode confirmed");
  if (!safetySnap.qwen?.liveInspectEnabled) pass("Live Qwen disabled in snapshot");

  const afterHashes = projectFingerprints(PROJECT);
  report.validation.sourceUnchanged =
    JSON.stringify(beforeHashes) === JSON.stringify(afterHashes);
  if (report.validation.sourceUnchanged) pass("No source files edited during QA");
  else fail("Source file fingerprints changed during QA");

  const stateToSave = {
    projectPath: PROJECT,
    codeContextAt: snap.codeContext?.preview?.generatedAt,
    codeAiAt: codeAiSaved?.generatedAt,
    patchDraftAt: draftSaved?.generatedAt,
    safetyReviewAt: sr?.generatedAt,
    roleMapping: snap.roleModelMapping?.mappings,
    fingerprints: afterHashes,
    models: report.ollama,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2));

  snap = await evaluate(`window.nttc.saveSessionHistory()`);
  pass("Session history saved before relaunch");

  ws.close();
}

async function runPhase2() {
  if (!fs.existsSync(STATE_FILE)) throw new Error("Run phase 1 first");
  const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));

  const { page, evaluate, ws } = await connect();
  report.validation.relaunch = {
    pageUrl: page.url,
    usesVite: /5173|vite/i.test(page.url || ""),
  };
  if (!report.validation.relaunch.usesVite) pass("App relaunched packaged after close");
  else fail("Relaunch used Vite/dev");

  let snap = await evaluate(
    `window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`,
  );
  report.validation.restore = {
    codeContextPreview: Boolean(snap.codeContext?.preview),
    codeContextAi: Boolean(snap.codeContextAi?.saved),
    patchDraft: Boolean(snap.patchDraft?.saved),
    safetyReview: Boolean(snap.patchDraftSafetyReview?.saved),
    codeAiModel: snap.codeContextAi?.saved?.modelName ?? null,
    patchDraftModel: snap.patchDraft?.saved?.modelName ?? null,
    safetyRecommendation: snap.patchDraftSafetyReview?.saved?.recommendation ?? null,
    mappingCodeReview: snap.roleModelMapping?.mappings?.["code-context-review"] ?? null,
    mappingPatchDraft: snap.roleModelMapping?.mappings?.["patch-draft"] ?? null,
    autoBusy: Boolean(snap.codeContextAi?.busy || snap.patchDraft?.busy),
  };

  if (report.validation.restore.codeContextPreview) pass("Code Context Pack metadata restored");
  else fail("Code Context Pack not restored");
  if (report.validation.restore.codeContextAi) pass("Code AI response restored");
  else fail("Code AI response not restored");
  if (report.validation.restore.patchDraft) pass("Patch Draft restored");
  else fail("Patch Draft not restored");
  if (report.validation.restore.safetyReview) pass("Patch Draft Safety Review restored");
  else fail("Patch Draft Safety Review not restored");
  if (report.validation.restore.mappingCodeReview) pass("Role mappings restored");
  if (!report.validation.restore.autoBusy) pass("No auto Ollama activity on reopen");
  else fail("Unexpected busy state on reopen (possible auto-call)");

  const hashes = projectFingerprints(PROJECT);
  if (JSON.stringify(hashes) === JSON.stringify(saved.fingerprints)) {
    pass("Project files unchanged after reopen");
  } else fail("Project files changed after reopen");

  ws.close();
}

function finalizeReport() {
  if (report.failed.length === 0 && report.safetyConcerns.length === 0) {
    report.goNoGo = "Go for live local-AI code review on disposable project copies";
  } else if (report.failed.length === 0) {
    report.goNoGo = "Go with caution";
  } else if (report.failed.length <= +2) {
    report.goNoGo = "Go with caution";
  } else {
    report.goNoGo = "No-go until bugs are fixed";
  }

  if (report.ollama.codeAi?.ms > 90000) {
    report.tinyFixes.push("Consider showing elapsed-time progress during long Code AI calls.");
  }
  if (report.ollama.patchDraft?.ms > 90000) {
    report.tinyFixes.push("Consider showing elapsed-time progress during long Patch Draft calls.");
  }
  report.laterFeatures.push(
    "Optional in-app progress indicator for Ollama calls without adding auto-execution.",
  );

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("REPORT_FILE", REPORT_FILE);
}

try {
  if (phase === "2") await runPhase2();
  else await runPhase1();
  finalizeReport();
  process.exit(report.failed.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  finalizeReport();
  process.exit(1);
}
