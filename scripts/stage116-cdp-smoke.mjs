/**
 * Stage 116 packaged-app smoke — ReportsAuditPatchSection after Stage 115.
 * Launch: release/win-unpacked/New Type Tech Coder.exe --remote-debugging-port=9249
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP = "http://127.0.0.1:9249";
const REPO =
  "C:\\Users\\Justin Mallory\\OneDrive\\Desktop\\New Type Tech Coder";
const EXE = path.join(REPO, "release", "win-unpacked", "New Type Tech Coder.exe");
const PROJECT = REPO;

const SAMPLE_BLUEPRINT = `# NTTC Project Blueprint

## Project Brief
Stage 116 disposable smoke blueprint.
## Product Requirements
Verify audit/patch extraction packaging.
## User Stories
As a user I want smoke to pass.
## Feature Roadmap
Phase 1: packaging validation only.
## Data Model
N/A for smoke.
## Screen / Workflow Flow
Reports → audit/patch panels.
## Architecture Plan
Electron packaged app.
## Suggested File / Module Plan
- src/renderer/components/ReportsAuditPatchSection.tsx
## Build Phases
1A — Stage 116 smoke
## Validation Plan
Packaged CDP smoke.
## Risks / Open Questions
None.
## AI Team Roles
Human + NTTC.
## Phase 1 Builder Handoff
None for smoke.
## Current Status
Ready.
`;

const TASK_INTAKE_REPORT = `# Builder Implementation Report

## 1. Analysis
Stage 116 Blueprint regression.

## 2. Plan
Confirm Blueprint still works after Stage 115.

## 3. Files changed
- src/renderer/components/BlueprintTabSection.tsx

## 4. Implementation summary
No Stage 116 Blueprint changes.

## 5. Validation performed
Packaged smoke.

## 6. Behavior preservation checks
No Apply Patch.

## 7. Risks
Low.

## 8. Safety confirmations
No source editing by NTTC.

## 9. Questions / blockers
None.
`;

const ARCH_INTAKE_REPORT = `# Analysis
Stage 116 architecture regression.

# Plan
Verify architecture section still works.

# Files changed
- none in Stage 116

# Implementation summary
Packaging only.

# Validation performed
Packaged smoke.

# Behavior preservation checks
No Apply Patch.

# Risks
Low.

# Safety confirmations
No source editing by NTTC.

# Questions / blockers
None.
`;

const SAFE_PATCH_DRAFT = `# Proposed Patch Draft

## Summary
Safe smoke draft with no secrets.

## Files
- src/renderer/components/ReportsAuditPatchSection.tsx

## Diff sketch
\`\`\`diff
+ // Stage 116 smoke only
\`\`\`

## Safety
No Apply Patch. Text only. No commands.
`;

const SECRET_PATCH_DRAFT = `API_KEY=sk-test-secret-value
draft body for override test
`;

const AUDIT_FOCUS_IDS = [
  "code-context-pack",
  "code-context-ai",
  "patch-draft-mode",
  "manual-patch-draft-import",
  "patch-draft-safety-review",
  "external-patch-draft-comparison",
  "builder-handoff-export",
  "changed-files",
];

const ARCH_SECTION_IDS = [
  "architecture-health",
  "architecture-refactor-task-cards",
  "architecture-refactor-task-builder-handoff",
  "architecture-refactor-task-implementation-intake",
];

const report = { failures: [], warnings: [], pass: false };

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
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
  return { page, evaluate, snap, ws };
}

function listProjectFiles(root) {
  const out = [];
  const skip = new Set([
    "node_modules",
    "release",
    "release-stage111",
    "dist",
    "dist-electron",
    ".git",
  ]);
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (skip.has(name)) continue;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push(full.replace(/\\/g, "/"));
    }
  }
  walk(root);
  return out;
}

async function clickTab(evaluate, label) {
  await evaluate(`(() => {
    const t = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === ${JSON.stringify(label)},
    );
    if (t) t.click();
  })()`);
}

async function btnExists(evaluate, label) {
  return evaluate(
    `[...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === ${JSON.stringify(label)})`,
  );
}

try {
  if (!fs.existsSync(EXE)) fail("Packaged exe missing");

  const distJs = fs
    .readdirSync(path.join(REPO, "dist", "assets"))
    .find((f) => f.endsWith(".js"));
  const bundleText = fs.readFileSync(
    path.join(REPO, "dist", "assets", distJs),
    "utf8",
  );
  report.bundle = {
    stage115Wiring:
      bundleText.includes("buildReportsAuditPatchSectionProps") ||
      (bundleText.includes("Code Context Pack") &&
        bundleText.includes("Patch Draft Mode") &&
        bundleText.includes("Manual Patch Draft Import") &&
        bundleText.includes("Builder Handoff Export")),
    noApplyPatch: !bundleText.includes("Apply Patch"),
  };
  if (!report.bundle.stage115Wiring) fail("Bundle missing Stage 115 audit/patch wiring");
  if (!report.bundle.noApplyPatch) fail("Bundle unexpectedly contains Apply Patch");

  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  spawn(EXE, ["--remote-debugging-port=9249"], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 7000));

  const { page, evaluate, snap, ws } = await connect();
  report.launch = {
    pageUrl: page.url,
    usesAsar: /app\.asar/i.test(page.url || ""),
    usesVite: /5173|vite/i.test(page.url || ""),
  };

  const headerText = await evaluate(`document.body.innerText.slice(0, 4000)`);
  report.shell = {
    dashboard: /Daily Next Action|Workflow Progress|Workflow Health/i.test(headerText),
    guideTab: await btnExists(evaluate, "Guide"),
    blueprintTab: await btnExists(evaluate, "Blueprint"),
    reportsTab: await btnExists(evaluate, "Reports"),
    inspectOnly: /Inspect-only/i.test(headerText),
    liveQwenDisabled: /Live Qwen disabled/i.test(headerText),
    ollamaBubble: /Ollama:/i.test(headerText),
    noApplyPatch: !(await evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Apply Patch\\b/i.test((b.textContent || '').trim()))`,
    )),
  };

  await evaluate(`window.nttc.openRecentProject(${JSON.stringify(PROJECT)})`);
  await new Promise((r) => setTimeout(r, 1500));

  const srcBefore = listProjectFiles(PROJECT).filter(
    (f) => !f.includes("/.nttc/") && !f.includes("\\.nttc\\"),
  );
  const advisorBefore = (await snap()).advisorResponse;

  // --- Reports audit/patch UI regression ---
  await clickTab(evaluate, "Reports");
  await new Promise((r) => setTimeout(r, 1000));
  // Expand collapsed Reports workflow sections so labels remain visible
  await evaluate(`(() => {
    for (const el of document.querySelectorAll('details.reports-workflow-section')) {
      el.open = true;
    }
  })()`);
  await new Promise((r) => setTimeout(r, 400));

  const reportsText = await evaluate(`document.body.innerText`);
  const focusOrder = await evaluate(`(() => {
    const ids = ${JSON.stringify(AUDIT_FOCUS_IDS)};
    const positions = ids.map((id) => {
      const el = document.querySelector('[data-focus-id="' + id + '"]');
      if (!el) return -1;
      const all = [...document.querySelectorAll('[data-focus-id]')];
      return all.indexOf(el);
    });
    const ordered =
      positions.every((p) => p >= 0) &&
      positions.every((p, i) => i === 0 || p > positions[i - 1]);
    return { positions, ordered, missing: ids.filter((_, i) => positions[i] < 0) };
  })()`);

  report.auditUi = {
    codeContext: /Code Context Pack/i.test(reportsText),
    askLocalAi: /Ask Local AI About Selected Code/i.test(reportsText),
    patchDraft: /Patch Draft Mode/i.test(reportsText),
    patchDraftNoApply: /Patch Draft Mode — No Apply|No Apply/i.test(reportsText),
    manualImport: /Manual Patch Draft Import/i.test(reportsText),
    safetyReview: /Patch Draft Safety Review/i.test(reportsText),
    externalComparison: /External Patch Draft Comparison/i.test(reportsText),
    builderHandoff: /Builder Handoff Export/i.test(reportsText),
    changedFiles: /Changed Files/i.test(reportsText),
    focusOrder,
    generateCodeContext:
      (await btnExists(evaluate, "Generate Code Context Preview")) ||
      /Generate Code Context Preview/i.test(reportsText),
    copyControls:
      /Copy Code Context Pack|Copy Patch Draft|Copy Patch Draft Safety Review|Copy Builder Handoff/i.test(
        reportsText,
      ),
  };

  // --- Functional audit/patch ---
  let s = await snap();
  await evaluate(`window.nttc.refreshCodeContextFileList()`).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  const candidates = s.codeContext?.candidates ?? [];
  if (candidates.length > 0) {
    const pick = candidates
      .filter((c) => /\\.(ts|tsx|js|jsx|md)$/i.test(c.relativePath || ""))
      .slice(0, 3);
    for (const c of pick.length ? pick : candidates.slice(0, 2)) {
      await evaluate(
        `window.nttc.setCodeContextFileSelected(${JSON.stringify(c.relativePath)}, true)`,
      );
    }
  }
  await evaluate(`window.nttc.generateCodeContextPreview()`);
  await new Promise((r) => setTimeout(r, 5000));
  s = await snap();
  report.auditFunctional = {
    codeContextPreview: Boolean(s.codeContext?.preview?.markdownReport?.trim()),
    providerReady: Boolean(s.provider?.ready),
  };

  // Manual import (safe)
  await evaluate(`window.nttc.setImportedPatchDraftSource("Other")`).catch(() => {});
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft(${JSON.stringify(SAFE_PATCH_DRAFT)})`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(false)`);
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.auditFunctional.manualImportSaved = Boolean(s.importedPatchDraft?.saved);

  // Secret-like draft
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft(${JSON.stringify(SECRET_PATCH_DRAFT)})`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(false)`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  const secretBlockedWithoutOverride =
    !s.importedPatchDraft?.saved ||
    s.importedPatchDraft?.saved?.draftText !== SECRET_PATCH_DRAFT.trim() ||
    (s.actionLog ?? []).some((e) => /secret/i.test(e.message || ""));
  report.auditFunctional.secretHandling = {
    blockedOrWarned: secretBlockedWithoutOverride || Boolean(s.importedPatchDraft?.statusMessage),
  };
  await evaluate(`window.nttc.saveImportedPatchDraft(true)`);
  await new Promise((r) => setTimeout(r, 500));
  s = await snap();
  report.auditFunctional.secretOverrideAllowed = Boolean(
    s.importedPatchDraft?.saved?.savedWithSecretOverride ||
      s.importedPatchDraft?.saved,
  );

  // Restore safe draft for downstream panels
  await evaluate(
    `window.nttc.setImportedPatchDraftDraft(${JSON.stringify(SAFE_PATCH_DRAFT)})`,
  );
  await evaluate(`window.nttc.saveImportedPatchDraft(false)`);
  await new Promise((r) => setTimeout(r, 400));

  await evaluate(`window.nttc.generatePatchDraftSafetyReview()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.auditFunctional.safetyReview = Boolean(s.patchDraftSafetyReview?.saved);

  await evaluate(`window.nttc.generateExternalPatchDraftComparison()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.auditFunctional.externalComparison = Boolean(
    s.externalPatchDraftComparison?.saved,
  );

  await evaluate(`window.nttc.generateBuilderHandoffExport()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.auditFunctional.builderHandoff = Boolean(s.builderHandoffExport?.saved);

  await evaluate(`window.nttc.scanChangedFiles()`);
  await new Promise((r) => setTimeout(r, 3000));
  await evaluate(`window.nttc.generatePatchReviewPack()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.auditFunctional.changedFilesPack = Boolean(
    s.changedFiles?.patchReviewPack || s.changedFiles?.lastScan,
  );

  // Local AI panels: only if provider ready; otherwise confirm UI
  report.auditFunctional.localAi = {
    providerReady: Boolean(s.provider?.ready),
    askControlsPresent: report.auditUi.askLocalAi,
    patchDraftNoApplyUi: report.auditUi.patchDraftNoApply,
  };
  if (s.provider?.ready && report.auditFunctional.codeContextPreview) {
    // Do not auto-ask; confirm Patch Draft generate is available but optional
    report.auditFunctional.localAi.canGeneratePatchDraft = true;
  }

  // --- Architecture regression ---
  const archOrder = await evaluate(`(() => {
    const ids = ${JSON.stringify(ARCH_SECTION_IDS)};
    const positions = ids.map((id) => {
      const el = document.querySelector('[data-focus-id="' + id + '"]');
      if (!el) return -1;
      const all = [...document.querySelectorAll('[data-focus-id]')];
      return all.indexOf(el);
    });
    return {
      positions,
      ordered:
        positions.every((p) => p >= 0) &&
        positions.every((p, i) => i === 0 || p > positions[i - 1]),
    };
  })()`);
  report.reportsUi = {
    architectureHealth: /Architecture Health/i.test(reportsText),
    refactorCards: /Architecture Refactor Task Cards/i.test(reportsText),
    refactorHandoff: /Architecture Refactor Builder Handoff/i.test(reportsText),
    refactorIntake: /Architecture Refactor Implementation Intake/i.test(reportsText),
    sectionOrder: archOrder,
  };

  await evaluate(`window.nttc.generateArchitectureHealthReport()`);
  await new Promise((r) => setTimeout(r, 8000));
  s = await snap();
  report.reportsFunctional = {
    healthGenerated: Boolean(s.architectureHealth?.saved),
  };
  await evaluate(`window.nttc.generateArchitectureRefactorTaskCards()`);
  await new Promise((r) => setTimeout(r, 1500));
  s = await snap();
  report.reportsFunctional.cardsGenerated = Boolean(
    s.architectureRefactorTaskCards?.saved?.cards?.length,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskBuilderHandoffSelectedTask("ARCH-1")`,
  );
  await evaluate(`window.nttc.generateArchitectureRefactorTaskBuilderHandoff()`);
  await new Promise((r) => setTimeout(r, 1200));
  s = await snap();
  report.reportsFunctional.handoffGenerated = Boolean(
    s.architectureRefactorTaskBuilderHandoff?.saved,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeSelectedTask("ARCH-1")`,
  );
  await evaluate(
    `window.nttc.setArchitectureRefactorTaskImplementationIntakeDraftText(${JSON.stringify(ARCH_INTAKE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveArchitectureRefactorTaskImplementationReport(false)`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  const archSummary =
    s.architectureRefactorTaskImplementationIntake?.selectedReport?.summaryMarkdown ??
    "";
  report.reportsFunctional.intakeSaved =
    /Architecture Refactor Implementation Intake Summary/i.test(archSummary);
  await evaluate(
    `window.nttc.stageArchitectureRefactorTaskImplementationReportForReview()`,
  );
  await new Promise((r) => setTimeout(r, 600));
  s = await snap();
  report.reportsFunctional.stageForReview = {
    staged: Boolean(s.builderResult?.saved),
    taskId: s.builderResult?.saved?.taskId === "ARCH-1",
    noAutoImplReview: !s.implementationReview?.saved,
  };

  // --- Blueprint regression ---
  await clickTab(evaluate, "Blueprint");
  await new Promise((r) => setTimeout(r, 800));
  const blueprintText = await evaluate(`document.body.innerText`);
  report.blueprintUi = {
    header: /Project Blueprint Planner/i.test(blueprintText),
    buildFromIdea: /Build From Idea/i.test(blueprintText),
    focusId: await evaluate(
      `Boolean(document.querySelector('[data-focus-id="blueprint-planner"]'))`,
    ),
  };

  await evaluate(
    `window.nttc.setBlueprintIntake(${JSON.stringify({
      projectIdea: "Stage 116 blueprint regression smoke.",
      projectType: "desktop-app",
      buildStyle: "small-model-friendly",
    })})`,
  );
  await evaluate(`window.nttc.generateBlueprintPlannerQuestions()`);
  await evaluate(`window.nttc.generateBlueprintPlannerPrompt()`);
  await evaluate(`window.nttc.setBlueprintDraftText(${JSON.stringify(SAMPLE_BLUEPRINT)})`);
  await evaluate(`window.nttc.saveImportedBlueprint()`);
  await evaluate(`window.nttc.checkBlueprintCompleteness()`);
  let planningCountBefore = 0;
  try {
    planningCountBefore = fs.existsSync(path.join(PROJECT, ".nttc", "planning"))
      ? fs.readdirSync(path.join(PROJECT, ".nttc", "planning")).length
      : 0;
  } catch {
    planningCountBefore = 0;
  }
  await evaluate(`window.nttc.previewBlueprintPlanningDocuments()`);
  await new Promise((r) => setTimeout(r, 1000));
  s = await snap();
  let planningCountAfterPreview = 0;
  try {
    planningCountAfterPreview = fs.existsSync(path.join(PROJECT, ".nttc", "planning"))
      ? fs.readdirSync(path.join(PROJECT, ".nttc", "planning")).length
      : 0;
  } catch {
    planningCountAfterPreview = 0;
  }
  await evaluate(`window.nttc.generateBlueprintPhase1Handoff()`);
  await evaluate(`window.nttc.generateBlueprintPhaseTaskCards()`);
  await new Promise((r) => setTimeout(r, 1000));
  s = await snap();
  const cards = s.blueprint?.phaseTaskCards?.saved?.cards ?? [];
  const firstTaskId = cards[0]?.id ?? "P1A";
  await evaluate(
    `window.nttc.setTaskCardBuilderHandoffSelectedTask(${JSON.stringify(firstTaskId)})`,
  );
  await evaluate(`window.nttc.generateTaskCardBuilderHandoff()`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeSelectedTask(${JSON.stringify(firstTaskId)})`,
  );
  await evaluate(`window.nttc.setTaskImplementationIntakeBuilderSource("Cursor")`);
  await evaluate(
    `window.nttc.setTaskImplementationIntakeDraftText(${JSON.stringify(TASK_INTAKE_REPORT)})`,
  );
  await evaluate(`window.nttc.saveTaskImplementationReport(false)`);
  await evaluate(`window.nttc.stageTaskImplementationReportForReview()`);
  await evaluate(`window.nttc.generateBlueprintTaskReconciliation()`).catch(() => {});
  await evaluate(`window.nttc.generateTaskArtifactIndex()`).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.blueprintFunctional = {
    questions: Boolean(s.blueprint?.plannerQuestions),
    prompt: Boolean(s.blueprint?.plannerPrompt),
    imported: Boolean(s.blueprint?.importedBlueprint),
    completeness: Boolean(s.blueprint?.completenessReport),
    planningPreview: {
      hasFiles: (s.blueprint?.planningDocsPreview?.files?.length ?? 0) > 0,
      didNotWrite: planningCountAfterPreview === planningCountBefore,
    },
    phase1: Boolean(s.blueprint?.phase1Handoff),
    phaseTaskCards: cards.length > 0,
    taskHandoff: Boolean(s.blueprint?.taskCardBuilderHandoff?.saved),
    taskIntake: /Task Implementation Intake Summary/i.test(
      s.blueprint?.taskImplementationIntake?.selectedReport?.summaryMarkdown ?? "",
    ),
    stageForReview: {
      staged: Boolean(s.builderResult?.saved),
      noAutoImplReview: !s.implementationReview?.saved,
    },
    reconciliation: Boolean(
      s.blueprint?.taskReconciliation?.saved ||
        s.blueprint?.blueprintTaskReconciliation?.saved,
    ),
    artifactIndex: Boolean(s.blueprint?.taskArtifactIndex?.saved),
  };

  await evaluate(`window.nttc.generateProjectMemoryPreview()`);
  await new Promise((r) => setTimeout(r, 800));
  s = await snap();
  report.projectMemory = {
    previewExists: (s.projectMemory?.preview?.files?.length ?? 0) > 0,
  };

  report.boundaries = {
    srcFileCountSame:
      listProjectFiles(PROJECT).filter(
        (f) => !f.includes("/.nttc/") && !f.includes("\\.nttc\\"),
      ).length === srcBefore.length,
    noAdvisorDuringSmoke: advisorBefore === (await snap()).advisorResponse,
    noApplyPatch: report.shell.noApplyPatch,
    liveQwenDisabled: report.shell.liveQwenDisabled,
  };

  ws.close();
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });

  if (!report.launch.usesAsar || report.launch.usesVite) fail("Not packaged asar launch");
  if (!report.shell.inspectOnly) fail("Inspect-only badge missing");
  if (!report.shell.liveQwenDisabled) fail("Live Qwen not disabled");
  if (!report.shell.noApplyPatch) fail("Apply Patch button found");
  if (!report.shell.reportsTab) fail("Reports tab missing");
  if (!report.auditUi.codeContext) fail("Code Context missing");
  if (!report.auditUi.askLocalAi) fail("Ask Local AI missing");
  if (!report.auditUi.patchDraftNoApply) fail("Patch Draft No Apply missing");
  if (!report.auditUi.manualImport) fail("Manual Patch Draft Import missing");
  if (!report.auditUi.safetyReview) fail("Patch Draft Safety Review missing");
  if (!report.auditUi.externalComparison) fail("External comparison missing");
  if (!report.auditUi.builderHandoff) fail("Builder Handoff Export missing");
  if (!report.auditUi.changedFiles) fail("Changed Files missing");
  if (!report.auditUi.focusOrder?.ordered) {
    fail(`Audit focus order wrong: ${JSON.stringify(report.auditUi.focusOrder)}`);
  }
  if (!report.auditFunctional.codeContextPreview) fail("Code Context preview failed");
  if (!report.auditFunctional.manualImportSaved) fail("Manual import save failed");
  if (!report.auditFunctional.safetyReview) fail("Safety review generate failed");
  if (!report.auditFunctional.externalComparison) fail("External comparison failed");
  if (!report.auditFunctional.builderHandoff) fail("Builder handoff export failed");
  if (!report.auditFunctional.changedFilesPack) fail("Changed files / pack failed");
  if (!report.reportsUi.sectionOrder?.ordered) fail("Architecture section order wrong");
  if (!report.reportsFunctional.healthGenerated) fail("Architecture Health failed");
  if (!report.reportsFunctional.cardsGenerated) fail("Refactor cards failed");
  if (!report.reportsFunctional.handoffGenerated) fail("Refactor handoff failed");
  if (!report.reportsFunctional.intakeSaved) fail("Refactor intake failed");
  if (!report.reportsFunctional.stageForReview?.taskId) fail("ARCH-1 staging metadata missing");
  if (!report.reportsFunctional.stageForReview?.noAutoImplReview) {
    fail("Implementation Review auto-ran from refactor");
  }
  if (!report.blueprintUi.header) fail("Blueprint header missing");
  if (!report.blueprintFunctional.questions) fail("Blueprint questions failed");
  if (!report.blueprintFunctional.prompt) fail("Blueprint prompt failed");
  if (!report.blueprintFunctional.phaseTaskCards) fail("Phase task cards failed");
  if (!report.blueprintFunctional.taskIntake) fail("Task intake save failed");
  if (!report.blueprintFunctional.stageForReview?.noAutoImplReview) {
    fail("Implementation Review auto-ran from task intake");
  }
  if (!report.blueprintFunctional.planningPreview?.didNotWrite) {
    fail("Planning preview wrote files");
  }
  if (!report.boundaries.srcFileCountSame) fail("Unexpected source file changes");
  if (!report.boundaries.noAdvisorDuringSmoke) fail("Unexpected AI advisor call");

  report.pass = report.failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
  console.log(JSON.stringify(report, null, 2));
  spawn("taskkill", ["/F", "/IM", "New Type Tech Coder.exe"], { stdio: "ignore" });
  process.exit(1);
}
