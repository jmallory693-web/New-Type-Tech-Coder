/**
 * Stage 106 — Architecture Refactor Implementation Intake validation (local compiled modules).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { parseArchitectureRefactorTaskImplementationReportText } = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/architectureRefactorTasks/parseArchitectureRefactorTaskImplementationReport.js",
    ),
  ).href
);
const {
  buildArchitectureRefactorTaskImplementationIntakeSummary,
  compareRefactorReportToChangedFilesMetadata,
} = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/architectureRefactorTasks/buildArchitectureRefactorTaskImplementationIntakeSummary.js",
    ),
  ).href
);
const { ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_KIND } = await import(
  pathToFileURL(
    path.join(
      REPO,
      "dist-electron/shared/architectureRefactorTasks/architectureRefactorTaskImplementationIntakeConstants.js",
    ),
  ).href
);

const sampleReport = `# Analysis
Narrow refactor only.

# Plan
Extract helper.

# Files changed
- src/renderer/App.tsx

# Implementation summary
Moved layout helpers.

# Validation performed
npm run typecheck passed.

# Behavior preservation checks
Preserve existing behavior. No new features. No Apply Patch.

# Risks
Low risk.

# Safety confirmations
No source editing added by NTTC.

# Questions / blockers
None.
`;

const parse = parseArchitectureRefactorTaskImplementationReportText(sampleReport);
assert.ok(parse.detectedFilesChanged.length > 0, "files changed detected");
assert.ok(parse.detectedValidationMentions.length > 0, "validation detected");
assert.ok(!parse.blockedBySecrets, "sample should not block secrets");

const secretParse = parseArchitectureRefactorTaskImplementationReportText(
  "API_KEY=sk-test\nFiles changed: foo.ts",
);
assert.ok(secretParse.blockedBySecrets, "secret pattern should block");

const warnings = compareRefactorReportToChangedFilesMetadata({
  detectedFilesChanged: ["src/renderer/App.tsx"],
  changedFilesScan: {
    files: [{ path: "src/main/index.ts", status: "modified" }],
  },
  changedFilesTaskLink: null,
});
assert.ok(warnings.length > 0, "scope warnings expected");

const summary = buildArchitectureRefactorTaskImplementationIntakeSummary({
  taskId: "ARCH-1",
  taskTitle: "Split App layout",
  refactorTarget: "App.tsx",
  builderSource: "Cursor",
  savedAt: new Date().toISOString(),
  markedImplementationReturned: false,
  markedReviewed: false,
  stale: false,
  truncationFlag: false,
  parse,
  hasImplementationReview: false,
  changedFilesScopeWarnings: warnings,
});
assert.match(summary, /NTTC Architecture Refactor Implementation Intake Summary/);
assert.equal(
  ARCHITECTURE_REFACTOR_IMPLEMENTATION_REPORT_KIND,
  "Architecture Refactor Implementation Report",
);

console.log("Stage 106 Architecture Refactor Implementation Intake validation: PASS");
