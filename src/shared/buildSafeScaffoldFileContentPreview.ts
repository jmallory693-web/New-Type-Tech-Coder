/**
 * Stage 123: deterministic Safe Scaffold file-content preview builder.
 * In-memory templates only. No AI. No source reads. No writes. No commands.
 */

import {
  labelForBlueprintProjectType,
  type BlueprintProjectType,
} from "./blueprintConstants";
import type { SafeScaffoldTargetSafetyStatus } from "./buildModeTargetSafety";
import {
  SAFE_SCAFFOLD_FILE_CONTENT_CAUTION_WARNING,
  SAFE_SCAFFOLD_FILE_CONTENT_NO_RUN,
  SAFE_SCAFFOLD_FILE_CONTENT_PREVIEW_ONLY,
  fingerprintFileTreePreview,
  type SafeScaffoldFileContentFileEntry,
  type SafeScaffoldFileContentPreviewRecord,
} from "./buildModeFileContentPreview";
import { validateProposedRelativePath } from "./buildModeFileTreePreview";

export type BuildSafeScaffoldFileContentPreviewInput = {
  blueprintImported: boolean;
  blueprintProjectType: BlueprintProjectType | string;
  taskCardCount: number;
  taskCardsGeneratedAt: string | null;
  targetFolderPath: string;
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus;
  fileTreeGeneratedAt: string;
  proposedRelativePaths: string[];
};

const CONTENT_TEMPLATE_PATHS = new Set([
  "package.json",
  "readme.md",
  "index.html",
  "src/main.tsx",
  "src/app.tsx",
  "src/styles.css",
  "docs/project_notes.md",
  ".nttc/planning/readme.md",
]);

function normalizeRel(p: string): string {
  return p.trim().replace(/\\/g, "/");
}

function isDirectoryPath(p: string): boolean {
  return p.endsWith("/");
}

function languageForPath(rel: string): string {
  const lower = rel.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "tsx";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".md")) return "md";
  return "text";
}

function packageJsonContent(projectType: string): string {
  const name =
    projectType === "desktop-app"
      ? "nttc-safe-scaffold-desktop"
      : projectType === "game"
        ? "nttc-safe-scaffold-game"
        : "nttc-safe-scaffold-app";
  return JSON.stringify(
    {
      name,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      // Starter deps are placeholders only — NTTC does not install them.
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
      devDependencies: {
        typescript: "^5.8.0",
        vite: "^6.0.0",
      },
    },
    null,
    2,
  );
}

function readmeContent(projectTypeLabel: string): string {
  return [
    `# Safe Scaffold Starter`,
    ``,
    `Deterministic NTTC Safe Scaffold preview for a **${projectTypeLabel}**.`,
    ``,
    `## Status`,
    ``,
    `- This README is preview-only.`,
    `- No files have been created by NTTC.`,
    `- ${SAFE_SCAFFOLD_FILE_CONTENT_NO_RUN}`,
    ``,
    `## Next steps (outside NTTC)`,
    ``,
    `1. Review the Safe Scaffold File Content Preview.`,
    `2. Confirm write only in a later NTTC stage (not enabled yet).`,
    `3. Install/run packages only in your own terminal if you choose — not from NTTC.`,
    ``,
  ].join("\n");
}

function indexHtmlContent(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Safe Scaffold Starter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function mainTsxContent(): string {
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
`;
}

function appTsxContent(projectTypeLabel: string): string {
  return `export default function App() {
  return (
    <main className="app-shell">
      <h1>Safe Scaffold Starter</h1>
      <p>
        Deterministic preview for a ${projectTypeLabel} app.
        No files have been written by NTTC yet.
      </p>
    </main>
  );
}
`;
}

function stylesCssContent(): string {
  return `:root {
  color-scheme: light;
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.5;
  background: #f7f3ea;
  color: #1c1914;
}

body {
  margin: 0;
}

.app-shell {
  max-width: 42rem;
  margin: 0 auto;
  padding: 3rem 1.25rem;
}

h1 {
  font-size: 2rem;
  margin: 0 0 0.75rem;
}
`;
}

function projectNotesContent(projectTypeLabel: string): string {
  return [
    `# Project Notes`,
    ``,
    `Planning notes for this ${projectTypeLabel} Safe Scaffold preview.`,
    ``,
    `- Contents are deterministic starters only.`,
    `- NTTC has not created these files on disk.`,
    `- Do not store secrets here.`,
    ``,
  ].join("\n");
}

function nttcPlanningReadmeContent(): string {
  return [
    `# .nttc/planning`,
    ``,
    `Reserved for future NTTC planning-document exports.`,
    ``,
    `- This folder path is preview-only in Safe Scaffold Mode.`,
    `- Existing NTTC planning exports still require explicit confirmation elsewhere.`,
    `- No planning docs are written by this preview stage.`,
    ``,
  ].join("\n");
}

function contentForPath(
  rel: string,
  projectType: string,
  projectTypeLabel: string,
): SafeScaffoldFileContentFileEntry | null {
  const lower = normalizeRel(rel).toLowerCase();
  if (isDirectoryPath(lower)) return null;
  if (!CONTENT_TEMPLATE_PATHS.has(lower)) return null;

  let content = "";
  if (lower === "package.json") content = packageJsonContent(projectType);
  else if (lower === "readme.md") content = readmeContent(projectTypeLabel);
  else if (lower === "index.html") content = indexHtmlContent();
  else if (lower === "src/main.tsx") content = mainTsxContent();
  else if (lower === "src/app.tsx") content = appTsxContent(projectTypeLabel);
  else if (lower === "src/styles.css") content = stylesCssContent();
  else if (lower === "docs/project_notes.md") {
    content = projectNotesContent(projectTypeLabel);
  } else if (lower === ".nttc/planning/readme.md") {
    content = nttcPlanningReadmeContent();
  } else {
    return null;
  }

  return {
    relativePath: normalizeRel(rel),
    language: languageForPath(rel),
    content,
  };
}

function contentLooksUnsafe(content: string): string | null {
  const lower = content.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\.env\b/, "Generated content references .env."],
    [/begin (rsa|openssh) private key/, "Generated content looks like a private key."],
    [/api[_-]?key\s*[:=]\s*['\"]?[a-z0-9_\-]{16,}/i, "Generated content looks like an API key."],
    [/password\s*[:=]\s*['\"][^'\"]{4,}/i, "Generated content looks like a password."],
    [/token\s*[:=]\s*['\"][a-z0-9_\-\.]{16,}/i, "Generated content looks like a token."],
    [/postinstall/, "Generated content includes postinstall."],
    [/preinstall/, "Generated content includes preinstall."],
    [/curl[^\n]*\|\s*bash/, "Generated content includes curl|bash."],
    [/\beval\s*\(/, "Generated content includes eval("],
    [/rm\s+-rf\s+\//, "Generated content includes dangerous deletion."],
  ];
  for (const [re, reason] of patterns) {
    if (re.test(lower) || re.test(content)) return reason;
  }
  return null;
}

export function evaluateFileContentPreviewPreconditions(input: {
  blueprintImported: boolean;
  taskCardCount: number;
  targetFolderPath: string | null;
  targetSafetyStatus: SafeScaffoldTargetSafetyStatus | null;
  targetStale: boolean;
  targetBusy: boolean;
  fileTreeExists: boolean;
  fileTreeStale: boolean;
  proposedRelativePaths: string[];
}): { canGenerate: boolean; hardBlocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.blueprintImported) {
    reasons.push("Import or generate a Blueprint first.");
  }
  if (input.taskCardCount <= 0) {
    reasons.push("Generate Blueprint Phase Task Cards first.");
  }
  if (!input.targetFolderPath) {
    reasons.push("Select a Safe Scaffold target folder.");
  }
  if (input.targetBusy) {
    reasons.push("Target folder safety check is still running.");
  }
  if (input.targetStale) {
    reasons.push("Target folder safety is stale — refresh the folder safety check.");
  }
  if (!input.targetSafetyStatus) {
    reasons.push("Run a target folder safety check.");
  }
  if (input.targetSafetyStatus === "blocked") {
    reasons.push("Target folder is Blocked — choose a different empty folder.");
  }
  if (!input.fileTreeExists) {
    reasons.push("Generate a Safe Scaffold File Tree Preview first.");
  }
  if (input.fileTreeStale) {
    reasons.push("File Tree Preview is stale — regenerate it first.");
  }
  if (
    input.fileTreeExists &&
    !input.fileTreeStale &&
    input.proposedRelativePaths.length === 0
  ) {
    reasons.push("File Tree Preview has no proposed paths.");
  }

  const pathErrors: string[] = [];
  for (const p of input.proposedRelativePaths) {
    const err = validateProposedRelativePath(p);
    if (err) pathErrors.push(err);
  }
  if (pathErrors.length > 0) {
    reasons.push(
      `File Tree Preview paths failed safety validation (${pathErrors.length}).`,
    );
  }

  const hardBlocked =
    input.targetSafetyStatus === "blocked" || pathErrors.length > 0;
  const canGenerate =
    input.blueprintImported &&
    input.taskCardCount > 0 &&
    Boolean(input.targetFolderPath) &&
    !input.targetStale &&
    !input.targetBusy &&
    (input.targetSafetyStatus === "safe" ||
      input.targetSafetyStatus === "caution") &&
    input.fileTreeExists &&
    !input.fileTreeStale &&
    pathErrors.length === 0 &&
    input.proposedRelativePaths.length > 0;

  return { canGenerate, hardBlocked, reasons: canGenerate ? [] : reasons };
}

export function buildSafeScaffoldFileContentPreview(
  input: BuildSafeScaffoldFileContentPreviewInput,
): {
  record: SafeScaffoldFileContentPreviewRecord | null;
  blockedReasons: string[];
} {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  const pre = evaluateFileContentPreviewPreconditions({
    blueprintImported: input.blueprintImported,
    taskCardCount: input.taskCardCount,
    targetFolderPath: input.targetFolderPath,
    targetSafetyStatus: input.targetSafetyStatus,
    targetStale: false,
    targetBusy: false,
    fileTreeExists: true,
    fileTreeStale: false,
    proposedRelativePaths: input.proposedRelativePaths,
  });
  if (!pre.canGenerate) {
    return { record: null, blockedReasons: pre.reasons };
  }

  if (input.targetSafetyStatus === "caution") {
    warnings.push(SAFE_SCAFFOLD_FILE_CONTENT_CAUTION_WARNING);
  }

  const projectType = String(input.blueprintProjectType || "unknown");
  const projectTypeLabel =
    labelForBlueprintProjectType(projectType as BlueprintProjectType) ||
    projectType;

  const proposedRelativePaths = input.proposedRelativePaths.map(normalizeRel);
  const templatedFiles: SafeScaffoldFileContentFileEntry[] = [];
  const filesWithoutContents: string[] = [];

  for (const rel of proposedRelativePaths) {
    const pathErr = validateProposedRelativePath(rel);
    if (pathErr) {
      blockedReasons.push(pathErr);
      continue;
    }
    if (isDirectoryPath(rel)) {
      filesWithoutContents.push(rel);
      continue;
    }
    const entry = contentForPath(rel, projectType, projectTypeLabel);
    if (!entry) {
      filesWithoutContents.push(rel);
      continue;
    }
    const unsafe = contentLooksUnsafe(entry.content);
    if (unsafe) {
      blockedReasons.push(`${rel}: ${unsafe}`);
      continue;
    }
    templatedFiles.push(entry);
  }

  if (blockedReasons.length > 0) {
    return { record: null, blockedReasons };
  }
  if (templatedFiles.length === 0) {
    blockedReasons.push(
      "No content templates matched the current File Tree Preview paths.",
    );
    return { record: null, blockedReasons };
  }

  const generatedAt = new Date().toISOString();
  const fingerprint = fingerprintFileTreePreview({
    generatedAt: input.fileTreeGeneratedAt,
    proposedRelativePaths,
  });

  const fileSections = templatedFiles
    .map((f) => {
      return [
        `### ${f.relativePath}`,
        "```" + f.language,
        f.content.replace(/\n$/, ""),
        "```",
        "",
      ].join("\n");
    })
    .join("\n");

  const withoutLines =
    filesWithoutContents.length > 0
      ? filesWithoutContents.map((p) => `- ${p}`).join("\n")
      : "- (none)";

  const markdown = [
    "# NTTC Safe Scaffold File Content Preview",
    "",
    "## Status",
    SAFE_SCAFFOLD_FILE_CONTENT_PREVIEW_ONLY,
    "",
    "## Source Inputs",
    `- Blueprint status: ${input.blueprintImported ? "imported" : "missing"}`,
    `- Blueprint project type: ${projectTypeLabel} (\`${projectType}\`)`,
    `- Task cards: ${input.taskCardCount}`,
    `- Target folder: ${input.targetFolderPath}`,
    `- Target folder safety: ${input.targetSafetyStatus}`,
    `- File tree preview: ${input.fileTreeGeneratedAt}`,
    "",
    "## Proposed Files",
    "",
    fileSections.trimEnd(),
    "",
    "## Files Without Contents Yet",
    withoutLines,
    "",
    "## Safety Boundaries",
    "- Contents are deterministic starter templates only.",
    "- No existing project source files were read.",
    "- No secrets, `.env`, or private keys are generated.",
    `- ${SAFE_SCAFFOLD_FILE_CONTENT_NO_RUN}`,
    "- This stage does not create files, edit files, install packages, or call AI.",
    ...(warnings.length > 0
      ? ["", "### Warnings", ...warnings.map((w) => `- ${w}`)]
      : []),
    "",
    "## Next Step",
    "Review these file contents. The next Safe Scaffold stage will prepare write confirmation and a written-files manifest (still no automatic writes).",
    "",
  ].join("\n");

  const record: SafeScaffoldFileContentPreviewRecord = {
    generatedAt,
    sourceBlueprintImported: true,
    sourceBlueprintProjectType: projectType,
    sourceTaskCardCount: input.taskCardCount,
    sourceTaskCardsGeneratedAt: input.taskCardsGeneratedAt,
    sourceTargetFolderPath: input.targetFolderPath,
    sourceTargetSafetyStatus: input.targetSafetyStatus,
    sourceFileTreeGeneratedAt: input.fileTreeGeneratedAt,
    sourceFileTreeFingerprint: fingerprint,
    proposedRelativePaths,
    templatedFiles,
    filesWithoutContents,
    markdown,
    warnings,
    blockedReasons: [],
    stale: false,
  };

  return { record, blockedReasons: [] };
}
