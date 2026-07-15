/**
 * Stage 131 structural smoke — Local Planner Build Brief (no Electron launch).
 */
import assert from "node:assert/strict";
import {
  evaluateLocalPlannerBuildBriefPreconditions,
  buildLocalPlannerBuildBrief,
} from "../dist-electron/shared/buildLocalPlannerBuildBrief.js";
import {
  normalizeLocalPlannerBuildBriefRecord,
  emptyLocalPlannerBuildBriefTombstone,
  LOCAL_PLANNER_BUILD_BRIEF_COPY_PASTE_NOTE,
  LOCAL_PLANNER_BUILD_BRIEF_GUIDE_NOTE,
} from "../dist-electron/shared/buildModeLocalPlannerBuildBrief.js";
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

// Preconditions
{
  const noBp = evaluateLocalPlannerBuildBriefPreconditions({
    blueprintImported: false,
    taskCardCount: 0,
    fileTreeExists: false,
    fileContentExists: false,
    writeResultExists: false,
    writeCreatedCount: 0,
  });
  if (!noBp.canGenerate && noBp.reasons.some((r) => /Blueprint/i.test(r)))
    pass("blocked without blueprint");
  else fail("expected block without blueprint");

  const noCards = evaluateLocalPlannerBuildBriefPreconditions({
    blueprintImported: true,
    taskCardCount: 0,
    fileTreeExists: false,
    fileContentExists: false,
    writeResultExists: false,
    writeCreatedCount: 0,
  });
  if (!noCards.canGenerate && noCards.reasons.some((r) => /Task Cards/i.test(r)))
    pass("blocked without task cards");
  else fail("expected block without cards");

  const noPreview = evaluateLocalPlannerBuildBriefPreconditions({
    blueprintImported: true,
    taskCardCount: 2,
    fileTreeExists: false,
    fileContentExists: false,
    writeResultExists: false,
    writeCreatedCount: 0,
  });
  if (!noPreview.canGenerate) pass("blocked without preview/write");
  else fail("expected block without preview");

  const preWrite = evaluateLocalPlannerBuildBriefPreconditions({
    blueprintImported: true,
    taskCardCount: 2,
    fileTreeExists: true,
    fileContentExists: false,
    writeResultExists: false,
    writeCreatedCount: 0,
  });
  if (preWrite.canGenerate && preWrite.mode === "pre-write")
    pass("pre-write mode with tree preview");
  else fail("expected pre-write mode");

  const preWriteContent = evaluateLocalPlannerBuildBriefPreconditions({
    blueprintImported: true,
    taskCardCount: 2,
    fileTreeExists: false,
    fileContentExists: true,
    writeResultExists: false,
    writeCreatedCount: 0,
  });
  if (preWriteContent.canGenerate && preWriteContent.mode === "pre-write")
    pass("pre-write mode with content preview");
  else fail("expected pre-write with content");

  const postWrite = evaluateLocalPlannerBuildBriefPreconditions({
    blueprintImported: true,
    taskCardCount: 0,
    fileTreeExists: false,
    fileContentExists: false,
    writeResultExists: true,
    writeCreatedCount: 3,
  });
  if (postWrite.canGenerate && postWrite.mode === "post-write")
    pass("post-write mode");
  else fail("expected post-write mode");
}

const baseBuild = {
  blueprintImported: true,
  blueprintProjectType: "web-app",
  blueprintCompletenessLabel: "mostly ready",
  taskCardCount: 2,
  taskCardsGeneratedAt: "2026-01-01T00:00:00.000Z",
  taskCards: [
    { id: "t1", title: "Scaffold UI shell", phase: "1A", goal: "UI shell" },
    { id: "t2", title: "Add router", phase: "1A", goal: "routing" },
  ],
  selectedTaskId: null,
  targetFolderPath: "D:\\empty-target",
  targetSafetyStatus: "safe",
  fileTreeGeneratedAt: "2026-01-01T00:00:00.000Z",
  fileTreeProposedPaths: ["src/App.tsx", "package.json"],
  fileContentGeneratedAt: "2026-01-01T00:00:00.000Z",
  writeManifestGeneratedAt: null,
  finalConfirmationConfirmedAt: null,
  writeResultWrittenAt: null,
  writeCreatedRelativePaths: [],
  strictness: "smallest-safe",
  targetLocalModelType: "general-local-llm",
};

{
  const built = buildLocalPlannerBuildBrief(baseBuild);
  if (built.record?.mode === "pre-write" && built.record.markdown.includes("# NTTC Local Planner Build Brief"))
    pass("pre-write brief generates");
  else fail("pre-write brief failed");
  if (built.record?.markdown.includes("Ask planner to choose") || built.record?.markdown.includes("No task card is selected"))
    pass("no selected task asks planner to choose");
  else fail("expected choose-task wording");
}

{
  const built = buildLocalPlannerBuildBrief({
    ...baseBuild,
    selectedTaskId: "t1",
    targetLocalModelType: "small-slm",
    strictness: "smallest-safe",
  });
  const md = built.record?.markdown ?? "";
  if (/Focus Task/i.test(md) && /Scaffold UI shell/.test(md))
    pass("selected task appears");
  else fail("selected task missing");
  if (/under ~40 lines|short bullets/i.test(md)) pass("small SLM shorter format");
  else fail("small SLM format missing");
  if (/smallest safe next step/i.test(md)) pass("strictness wording");
  else fail("strictness wording missing");
}

{
  const built = buildLocalPlannerBuildBrief({
    ...baseBuild,
    targetLocalModelType: "coder-as-planner",
    strictness: "ambitious-bounded",
  });
  const md = built.record?.markdown ?? "";
  if (/Interfaces \/ contracts|files, interfaces/i.test(md))
    pass("coder-as-planner emphasizes files/interfaces");
  else fail("coder-as-planner wording missing");
  if (/ambitious but still bounded/i.test(md)) pass("ambitious strictness");
  else fail("ambitious wording missing");
}

{
  const built = buildLocalPlannerBuildBrief({
    ...baseBuild,
    fileTreeGeneratedAt: null,
    fileContentGeneratedAt: null,
    writeResultWrittenAt: "2026-01-02T00:00:00.000Z",
    writeCreatedRelativePaths: ["src/App.tsx", "package.json"],
  });
  if (built.record?.mode === "post-write") pass("post-write brief generates");
  else fail("post-write brief failed");
  if (built.record?.markdown.includes("src/App.tsx"))
    pass("created paths listed");
  else fail("created paths missing");
}

{
  const tomb = emptyLocalPlannerBuildBriefTombstone();
  assert.equal(normalizeLocalPlannerBuildBriefRecord(tomb), null);
  pass("tombstone normalizes to null");
}

{
  const repo = process.cwd();
  const guide = fs.readFileSync(
    path.join(repo, "src/shared/quickStartGuide.ts"),
    "utf8",
  );
  if (guide.includes(LOCAL_PLANNER_BUILD_BRIEF_GUIDE_NOTE))
    pass("guide note present");
  else fail("guide note missing");

  const tab = fs.readFileSync(
    path.join(repo, "src/renderer/components/BuildModeTab.tsx"),
    "utf8",
  );
  if (
    tab.includes("Local Planner Build Brief") &&
    tab.includes("Generate Planner Brief") &&
    tab.includes("LOCAL_PLANNER_BUILD_BRIEF_COPY_PASTE_NOTE") &&
    !/Run Local Planner/i.test(tab) &&
    !/>Apply Patch</i.test(tab) &&
    !/Apply Patch button/i.test(tab)
  )
    pass("Build tab UI wiring");
  else fail("Build tab UI wiring incomplete");
}

console.log(JSON.stringify({ failures, pass: failures.length === 0 }, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
