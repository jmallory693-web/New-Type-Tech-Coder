/**
 * Stage 135 structural smoke — Local Coder Task Prompt (no Electron launch).
 */
import assert from "node:assert/strict";
import {
  evaluateLocalCoderTaskPromptPreconditions,
  buildLocalCoderTaskPrompt,
} from "../dist-electron/shared/buildLocalCoderTaskPrompt.js";
import {
  normalizeLocalCoderTaskPromptRecord,
  emptyLocalCoderTaskPromptTombstone,
  LOCAL_CODER_TASK_PROMPT_COPY_PASTE_NOTE,
  LOCAL_CODER_TASK_PROMPT_GUIDE_NOTE,
} from "../dist-electron/shared/buildModeLocalCoderTaskPrompt.js";
import fs from "node:fs";
import path from "node:path";

const failures = [];
function pass(msg) {
  console.log("PASS", msg);
}
function fail(msg) {
  failures.push(msg);
  console.error("FAIL", msg);
}

const baseEval = {
  plannerResponseExists: true,
  plannerResponseStale: false,
  plannerResponseStatus: "Good",
  acceptedForCoderPromptPrep: true,
  recommendedNextTask: "Add login form submit handler",
  likelyFilesCount: 2,
  scaffoldFilesCount: 3,
};

// 1–6. Preconditions
{
  const noResp = evaluateLocalCoderTaskPromptPreconditions({
    ...baseEval,
    plannerResponseExists: false,
    acceptedForCoderPromptPrep: false,
    recommendedNextTask: null,
    likelyFilesCount: 0,
    scaffoldFilesCount: 0,
  });
  if (!noResp.canGenerate && noResp.reasons.includes("missing planner response"))
    pass("not ready without planner response");
  else fail("expected missing planner response");

  const blocked = evaluateLocalCoderTaskPromptPreconditions({
    ...baseEval,
    plannerResponseStatus: "Blocked",
  });
  if (!blocked.canGenerate && blocked.reasons.includes("planner response blocked"))
    pass("not ready when Blocked");
  else fail("expected blocked status");

  const notAccepted = evaluateLocalCoderTaskPromptPreconditions({
    ...baseEval,
    acceptedForCoderPromptPrep: false,
  });
  if (
    !notAccepted.canGenerate &&
    notAccepted.reasons.includes("planner response not accepted")
  )
    pass("not ready when not accepted");
  else fail("expected not accepted");

  const stale = evaluateLocalCoderTaskPromptPreconditions({
    ...baseEval,
    plannerResponseStale: true,
  });
  if (!stale.canGenerate && stale.reasons.includes("accepted marker stale"))
    pass("not ready when accepted marker stale");
  else fail("expected stale accepted marker");

  const noTask = evaluateLocalCoderTaskPromptPreconditions({
    ...baseEval,
    recommendedNextTask: null,
  });
  if (!noTask.canGenerate && noTask.reasons.includes("missing recommended task"))
    pass("not ready without recommended task");
  else fail("expected missing recommended task");

  const noFiles = evaluateLocalCoderTaskPromptPreconditions({
    ...baseEval,
    likelyFilesCount: 0,
    scaffoldFilesCount: 0,
  });
  if (
    !noFiles.canGenerate &&
    noFiles.reasons.includes("missing likely files / scaffold files")
  )
    pass("not ready without likely/scaffold files");
  else fail("expected missing files");

  const ready = evaluateLocalCoderTaskPromptPreconditions(baseEval);
  if (ready.canGenerate) pass("ready when accepted Good + task + files");
  else fail("expected ready");
}

const buildBase = {
  plannerResponseStatus: "Good",
  plannerResponseAcceptedAt: "2026-07-15T12:00:00.000Z",
  plannerResponseAnalyzedAt: "2026-07-15T11:59:00.000Z",
  recommendedNextTask: "Add login form submit handler",
  whyThisTask: "Foundation for auth",
  likelyFiles: ["src/auth/LoginForm.tsx", "src/auth/api.ts"],
  filesNotToTouch: ["package.json", "src/main/index.ts"],
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

// 7–8. Generate Good / Caution
{
  const good = buildLocalCoderTaskPrompt({
    ...buildBase,
    promptStyle: "general-coder",
  });
  if (good.record && /# NTTC Local Coder Task Prompt/.test(good.record.markdown))
    pass("Accepted Good → generates");
  else fail("Good generate failed");

  const caution = buildLocalCoderTaskPrompt({
    ...buildBase,
    promptStyle: "general-coder",
    plannerResponseStatus: "Caution",
  });
  if (
    caution.record &&
    caution.record.warnings.some((w) => /Caution/i.test(w))
  )
    pass("Accepted Caution → generates with caution note");
  else fail("Caution generate missing warning");
}

// 9–11. Styles
{
  const small = buildLocalCoderTaskPrompt({
    ...buildBase,
    promptStyle: "small-local-coder",
  });
  if (
    small.record?.markdown.includes("Prefer **one file**") &&
    small.record.markdown.includes("Return (keep short):")
  )
    pass("Small local coder style stricter/shorter");
  else fail("small style");

  const general = buildLocalCoderTaskPrompt({
    ...buildBase,
    promptStyle: "general-coder",
  });
  if (general.record?.markdown.includes("balanced detail"))
    pass("General coder style balanced");
  else fail("general style");

  const strict = buildLocalCoderTaskPrompt({
    ...buildBase,
    promptStyle: "strict-patch-planning-coder",
  });
  if (
    strict.record?.markdown.includes("before/after") &&
    strict.record.markdown.includes("uncertainty list")
  )
    pass("Strict patch-planning style structured");
  else fail("strict style");
}

// 12–21. Prompt contents
{
  const md =
    buildLocalCoderTaskPrompt({
      ...buildBase,
      promptStyle: "general-coder",
    }).record?.markdown || "";

  const checks = [
    ["current task", /## Current Task[\s\S]*login form/i],
    ["likely files", /## Files Likely Involved[\s\S]*LoginForm/i],
    ["files not to touch", /## Files Not To Touch[\s\S]*package\.json/i],
    ["acceptance checks", /## Acceptance Checks[\s\S]*Form submits/i],
    ["risks", /## Risks To Avoid[\s\S]*Partial submit/i],
    ["hard boundaries", /Do not ask NTTC to run commands/i],
    ["no auto-apply", /will not auto-apply/i],
    ["human-only commands", /human-only notes|NTTC will not run commands/i],
    ["no secrets", /Do not include secrets/i],
    ["no .env", /Do not include \.env files/i],
    ["no API keys", /Do not include API keys/i],
    ["no private keys", /Do not include private keys/i],
    ["no postinstall", /postinstall\/preinstall/i],
    ["no destructive", /Do not include destructive commands/i],
  ];
  for (const [label, re] of checks) {
    if (re.test(md)) pass(`prompt includes ${label}`);
    else fail(`missing ${label}`);
  }
}

// Tombstone
{
  const tomb = emptyLocalCoderTaskPromptTombstone();
  if (normalizeLocalCoderTaskPromptRecord(tomb) === null)
    pass("tombstone does not restore as current");
  else fail("tombstone should normalize to null");
}

// Guide / copy-paste notes
{
  if (/does not send it automatically/i.test(LOCAL_CODER_TASK_PROMPT_COPY_PASTE_NOTE))
    pass("copy/paste note present");
  else fail("copy/paste note");
  if (
    /Local Coder Task Prompts turn an accepted local planner response/i.test(
      LOCAL_CODER_TASK_PROMPT_GUIDE_NOTE,
    )
  )
    pass("guide note present");
  else fail("guide note");
}

// UI structural
{
  const tabPath = path.join(
    process.cwd(),
    "src/renderer/components/BuildModeTab.tsx",
  );
  const tab = fs.readFileSync(tabPath, "utf8");
  if (tab.includes("Local Coder Task Prompt")) pass("UI section present");
  else fail("UI section missing");
  if (tab.includes("Generate Coder Prompt")) pass("Generate control present");
  else fail("Generate missing");
  if (tab.includes("Copy Coder Prompt")) pass("Copy control present");
  else fail("Copy missing");
  if (tab.includes("Clear Coder Prompt")) pass("Clear control present");
  else fail("Clear missing");

  const orderOk = await (async () => {
    const responseIdx = tab.indexOf("Local Planner Response Import");
    const coderIdx = tab.indexOf('data-focus-id="build-mode-local-coder-task-prompt"');
    const safetyIdx = tab.indexOf(">Safety Charter<");
    return responseIdx >= 0 && coderIdx > responseIdx && safetyIdx > coderIdx;
  })();
  if (orderOk) pass("Coder Prompt after Response Import, before Safety Charter");
  else fail("section order wrong");

  const forbidden = [
    "Run Coder",
    "Send to AI",
    "Apply Patch",
    "Install packages",
    "Run command",
  ];
  const hit = forbidden.find((f) => tab.includes(f));
  if (!hit) pass("no forbidden action buttons in BuildModeTab labels");
  else fail(`forbidden control text found: ${hit}`);
}

// Pure builder — no fs/child_process
{
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/shared/buildLocalCoderTaskPrompt.ts"),
    "utf8",
  );
  if (!/\bfrom ["']node:fs["']/.test(src) && !/\bchild_process\b/.test(src))
    pass("builder has no fs/child_process");
  else fail("builder must stay pure");
}

// Guide file updated
{
  const guide = fs.readFileSync(
    path.join(process.cwd(), "src/shared/quickStartGuide.ts"),
    "utf8",
  );
  if (
    guide.includes(
      "Local Coder Task Prompts turn an accepted local planner response",
    )
  )
    pass("quickStartGuide includes coder prompt note");
  else fail("guide missing coder note");
}

assert.equal(failures.length, 0, failures.join("; "));
console.log("\nStage 135 structural smoke: ALL PASS");
