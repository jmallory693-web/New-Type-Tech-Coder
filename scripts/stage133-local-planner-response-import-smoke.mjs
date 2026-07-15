/**
 * Stage 133 structural smoke — Local Planner Response Import (no Electron launch).
 */
import assert from "node:assert/strict";
import {
  analyzeLocalPlannerResponse,
  evaluateLocalPlannerResponseImportPreconditions,
  parseLocalPlannerResponseText,
} from "../dist-electron/shared/parseLocalPlannerResponse.js";
import {
  LOCAL_PLANNER_RESPONSE_IMPORT_GUIDE_NOTE,
  normalizeLocalPlannerResponseImportRecord,
  emptyLocalPlannerResponseImportTombstone,
} from "../dist-electron/shared/buildModeLocalPlannerResponseImport.js";
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

// 1–2. Preconditions
{
  const noBrief = evaluateLocalPlannerResponseImportPreconditions({
    briefExists: false,
    briefStale: false,
  });
  if (!noBrief.canAnalyze && noBrief.reasons.some((r) => /Build Brief/i.test(r)))
    pass("not ready without planner brief");
  else fail("expected block without brief");

  const staleBrief = evaluateLocalPlannerResponseImportPreconditions({
    briefExists: true,
    briefStale: true,
  });
  if (!staleBrief.canAnalyze && staleBrief.reasons.some((r) => /stale/i.test(r)))
    pass("blocked when brief stale");
  else fail("expected block when brief stale");

  const ready = evaluateLocalPlannerResponseImportPreconditions({
    briefExists: true,
    briefStale: false,
  });
  if (ready.canAnalyze) pass("ready when brief exists and not stale");
  else fail("expected analyze ready with brief");
}

// 3. Empty response
{
  const empty = analyzeLocalPlannerResponse({
    rawResponseText: "   ",
    ...briefMeta,
  });
  if (!empty.record && empty.blockedReasons.some((r) => /non-empty/i.test(r)))
    pass("empty response blocked");
  else fail("expected empty response blocked");
}

const goodResponse = `
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

// 4–12. Well-structured parse
{
  const parsed = parseLocalPlannerResponseText(goodResponse);
  if (parsed.recommendedNextTask?.includes("login form"))
    pass("extracts recommended task");
  else fail("missing recommended task");
  if (parsed.likelyFiles.some((f) => /LoginForm/.test(f)))
    pass("extracts likely files");
  else fail("missing likely files");
  if (parsed.filesNotToTouch.some((f) => /package\.json/.test(f)))
    pass("extracts files not to touch");
  else fail("missing files not to touch");
  if (parsed.risks.length > 0) pass("extracts risks");
  else fail("missing risks");
  if (parsed.acceptanceChecks.length > 0) pass("extracts acceptance checks");
  else fail("missing acceptance checks");
  if (parsed.coderPromptOutline?.includes("submit"))
    pass("extracts coder prompt outline");
  else fail("missing coder outline");
  if (parsed.criticQuestions.length > 0) pass("extracts critic questions");
  else fail("missing critic questions");
  if (parsed.requestedCommands.some((c) => /typecheck/.test(c)))
    pass("lists commands as human-only notes");
  else fail("missing commands");
  if (parsed.stopConditions.length > 0) pass("extracts stop conditions");
  else fail("missing stop conditions");

  const analyzed = analyzeLocalPlannerResponse({
    rawResponseText: goodResponse,
    ...briefMeta,
  });
  if (
    analyzed.record &&
    (analyzed.record.status === "Good" || analyzed.record.status === "Caution")
  )
    pass(`well-structured → ${analyzed.record.status}`);
  else fail("expected Good or Caution for well-structured");

  if (analyzed.record?.summaryMarkdown.includes("# NTTC Local Planner Response Summary"))
    pass("summary markdown generated");
  else fail("missing summary markdown");

  if (
    analyzed.record?.summaryMarkdown.includes(
      "NTTC will not run commands",
    )
  )
    pass("commands section notes human-only");
  else fail("missing human-only commands note");

  if (
    analyzed.record &&
    analyzed.record.status !== "Blocked" &&
    !analyzed.record.acceptedForCoderPromptPrep
  )
    pass("accepted marker metadata starts false");
  else fail("accepted should start false");
}

// 13–16. Blocked safety
function expectBlocked(label, text) {
  const r = analyzeLocalPlannerResponse({
    rawResponseText: text,
    ...briefMeta,
  });
  if (r.record?.status === "Blocked") pass(`${label} → Blocked`);
  else fail(`${label} expected Blocked, got ${r.record?.status}`);
}

expectBlocked(
  "asks NTTC to run commands",
  "## Recommended Next Task\nDo X\n\nAsk NTTC to run the build commands.",
);
expectBlocked(
  "asks install packages",
  "## Recommended Next Task\nDo X\n\nAsk NTTC to install packages with npm install.",
);
expectBlocked(
  "asks apply patch",
  "## Recommended Next Task\nDo X\n\nAsk NTTC to apply patch now.",
);
expectBlocked(
  "broad rewrite",
  "## Recommended Next Task\nBroad rewrite of the entire codebase.",
);

// 17–19. Caution warnings
{
  const missing = analyzeLocalPlannerResponse({
    rawResponseText: `
## Recommended Next Task
Something fairly specific enough maybe
## Likely Files
- a.ts
`,
    ...briefMeta,
  });
  if (missing.record?.status === "Caution" || missing.record?.status === "Blocked")
    pass("missing acceptance/stop/not-touch → warn");
  else fail("expected Caution/Blocked when fields missing");

  const vague = analyzeLocalPlannerResponse({
    rawResponseText: `
## Recommended Next Task
todo
## Acceptance Checks
- ok
## Stop Conditions
- stop
## Files Not To Touch
- package.json
`,
    ...briefMeta,
  });
  if (
    vague.record?.safetyWarnings.some((w) => w.id === "too-vague") ||
    vague.record?.status !== "Good"
  )
    pass("too vague warns");
  else fail("expected vague warning");
}

// Accepted only Good/Caution
{
  const good = analyzeLocalPlannerResponse({
    rawResponseText: goodResponse,
    ...briefMeta,
  });
  const blocked = analyzeLocalPlannerResponse({
    rawResponseText:
      "## Recommended Next Task\nX\n\nAsk NTTC to run commands please.",
    ...briefMeta,
  });
  if (good.record && good.record.status !== "Blocked")
    pass("Good/Caution canAccept eligible");
  else fail("good should be accept-eligible status");
  if (blocked.record?.status === "Blocked")
    pass("Blocked not accept-eligible");
  else fail("blocked should not be Good/Caution");
}

// Tombstone / normalize
{
  const tomb = emptyLocalPlannerResponseImportTombstone();
  if (normalizeLocalPlannerResponseImportRecord(tomb) === null)
    pass("tombstone does not restore as current");
  else fail("tombstone should normalize to null");
}

// Guide note present in source
{
  if (
    LOCAL_PLANNER_RESPONSE_IMPORT_GUIDE_NOTE.includes(
      "untrusted claim",
    )
  )
    pass("guide note present");
  else fail("guide note missing");
}

// Structural: UI string + no forbidden controls in BuildModeTab
{
  const tabPath = path.join(
    process.cwd(),
    "src/renderer/components/BuildModeTab.tsx",
  );
  const tab = fs.readFileSync(tabPath, "utf8");
  if (tab.includes("Local Planner Response Import"))
    pass("UI section present");
  else fail("UI section missing");
  if (tab.includes("Analyze Planner Response")) pass("Analyze control present");
  else fail("Analyze control missing");
  if (tab.includes("Copy Planner Response Summary"))
    pass("Copy summary control present");
  else fail("Copy summary missing");
  if (tab.includes("Clear Planner Response")) pass("Clear control present");
  else fail("Clear control missing");
  if (tab.includes("Mark Response Accepted For Coder Prompt Prep"))
    pass("Accepted marker control present");
  else fail("Accepted marker missing");

  const forbidden = [
    "Run Planner",
    "Send to AI",
    "Run Coder",
    "Apply Patch",
    "Write Files",
    "Install packages",
    "Run command",
  ];
  const hit = forbidden.find((f) => tab.includes(f));
  if (!hit) pass("no forbidden action buttons in BuildModeTab labels");
  else fail(`forbidden control text found: ${hit}`);
}

// Confirm parse module does not import fs / child_process
{
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/shared/parseLocalPlannerResponse.ts"),
    "utf8",
  );
  if (!/\bfrom ["']node:fs["']/.test(src) && !/\bchild_process\b/.test(src))
    pass("parser has no fs/child_process");
  else fail("parser must stay pure");
}

assert.equal(failures.length, 0, failures.join("; "));
console.log("\nStage 133 structural smoke: ALL PASS");
