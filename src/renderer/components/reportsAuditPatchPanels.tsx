import { useEffect, useState, type ReactNode } from "react";
import type {
  BlueprintPhaseTaskCardsRecord,
  ChangedFilesState,
  CodeContextAiState,
  CodeContextState,
  LocalAiProgressMode,
  LocalAiProgressState,
  PatchDraftSafetyReviewState,
  PatchDraftSafetyReviewTargetKind,
  PatchDraftState,
  PlanningStyleId,
} from "../../shared/types";
import {
  CODE_CONTEXT_AI_SEND_NOTE,
  CODE_CONTEXT_PREVIEW_NOTE,
  PATCH_DRAFT_SEND_NOTE,
} from "../../shared/codeContextConstants";
import { PATCH_DRAFT_SAFETY_REVIEW_TARGETS } from "../../shared/importedPatchDraftConstants";
import { CODE_QUESTION_TEMPLATES } from "../../shared/codeQuestionTemplates";
import {
  elapsedSecondsSince,
  formatLocalAiProgressMessage,
  PATCH_DRAFT_FAILURE_SAFETY_REVIEW_NOTE,
} from "../../shared/localAiUsability";
import { getRoleHelp, type RoleHelpKey } from "../../shared/localAiRoles";
import { PlanningStyleStatusLine } from "./PlanningStyleControl";
import { ChangedFilesTaskLinkPanel } from "./ChangedFilesTaskLinkPanel";

function HelpNote({ children }: { children: ReactNode }) {
  return (
    <div className="help-note" role="note">
      {children}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ActionButton({
  label,
  hint,
  disabled,
  primary,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={primary ? "action-btn primary" : "action-btn"}
      title={hint}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LocalAiProgressBanner({
  progress,
  mode,
}: {
  progress: LocalAiProgressState | null;
  mode: LocalAiProgressMode;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!progress?.active || progress.mode !== mode) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [progress?.active, progress?.mode, progress?.startedAt, mode]);

  if (!progress?.active || progress.mode !== mode) return null;

  const elapsedSeconds = elapsedSecondsSince(progress.startedAt);
  const message = formatLocalAiProgressMessage({
    label: progress.label,
    modelName: progress.modelName,
    baseUrl: progress.baseUrl,
    elapsedSeconds,
  });

  return (
    <div className="onedrive-warning" role="status" aria-live="polite">
      <strong>Working…</strong> {message}
    </div>
  );
}

function ClickableRoleName({
  roleKey,
  label,
  onOpen,
}: {
  roleKey: RoleHelpKey;
  label?: string;
  onOpen: (key: RoleHelpKey) => void;
}) {
  const displayLabel = label ?? getRoleHelp(roleKey).title;
  return (
    <button
      type="button"
      className="role-help-link"
      onClick={() => onOpen(roleKey)}
      aria-label={`Learn what ${displayLabel} does`}
    >
      {displayLabel}
      <span className="role-help-icon" aria-hidden="true">
        ?
      </span>
    </button>
  );
}

export function ChangedFilesPanel({
  changedFiles,
  taskCards,
  hasProject,
  scanning,
  generatingPack,
  onScan,
  onGeneratePack,
  onCopyPack,
  onSelectTaskLink,
  onLinkTask,
  onClearTaskLink,
  copyState,
}: {
  changedFiles: ChangedFilesState;
  taskCards: BlueprintPhaseTaskCardsRecord | null;
  hasProject: boolean;
  scanning: boolean;
  generatingPack: boolean;
  onScan: () => void;
  onGeneratePack: () => void;
  onCopyPack: () => void;
  onSelectTaskLink: (taskId: string) => void;
  onLinkTask: () => void;
  onClearTaskLink: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const scan = changedFiles.lastScan;
  const pack = changedFiles.patchReviewPack;

  return (
    <div className="stack">
      <div>
        <div className="field-label">Changed Files / Patch Review</div>
        <HelpNote>
          What it does: lists files another tool may have changed (Git status),
          flags risky paths, and builds a Patch Review Pack for outside AI
          review. What it does not do: edit files, stage, commit, reset, or
          clean. Why it is safe: read-only Git metadata only — no full diffs,
          no secrets, no raw source in the pack.
        </HelpNote>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          New Type Tech Coder does not edit these files. It only reports what
          changed.
        </div>
      </div>

      {!hasProject ? (
        <div className="placeholder-box">
          Select a project folder first. Changed-file detection currently
          requires Git.
        </div>
      ) : !scan ? (
        <div className="placeholder-box">
          No changed-files scan yet. Next: click{" "}
          <strong>Scan Changed Files</strong>. Requires a Git repository.
        </div>
      ) : (
        <>
          <div className="field-value">
            Last scan: {formatTime(scan.scannedAt)}
            {scan.branchName ? ` · branch ${scan.branchName}` : ""}
          </div>
          <div className="field-value">
            Changed: {scan.totalCount} · Modified {scan.modifiedCount} · Added{" "}
            {scan.addedCount} · Deleted {scan.deletedCount} · Renamed{" "}
            {scan.renamedCount} · Untracked {scan.untrackedCount}
          </div>
          {scan.errorMessage || !scan.isGitRepo ? (
            <div className="onedrive-warning" role="status">
              {scan.errorMessage ||
                "Changed-file detection currently requires Git."}
            </div>
          ) : null}
          {scan.manyFilesWarning ? (
            <div className="onedrive-warning" role="status">
              {scan.manyFilesWarning}
            </div>
          ) : null}
          {scan.globalRiskFlags.length > 0 ? (
            <div className="onedrive-warning" role="status">
              Risk flags:{" "}
              {scan.globalRiskFlags.map((f) => f.plainEnglish).join(" ")}
            </div>
          ) : null}
          {scan.truncationNote ? (
            <div className="field-value muted">{scan.truncationNote}</div>
          ) : null}
          {scan.files.length > 0 ? (
            <div className="review-preview" aria-label="Changed files list">
              {scan.files
                .slice(0, 30)
                .map((f) => {
                  const risks =
                    f.riskFlags.length > 0
                      ? ` [${f.riskFlags.map((r) => r.label).join(", ")}]`
                      : "";
                  return `${f.kind}: ${f.path}${risks}`;
                })
                .join("\n")}
              {scan.files.length > 30 ? "\n…" : ""}
            </div>
          ) : scan.isGitRepo && !scan.errorMessage ? (
            <div className="field-value">Working tree looks clean.</div>
          ) : null}
        </>
      )}

      {changedFiles.statusMessage ? (
        <div className="field-value muted">{changedFiles.statusMessage}</div>
      ) : null}

      <div className="stack">
        <ActionButton
          label="Scan Changed Files"
          hint={
            !hasProject
              ? "Select a project folder first"
              : scanning
                ? "Scanning read-only Git status…"
                : "Read-only Git status (no stage/commit/reset)"
          }
          disabled={!hasProject || scanning}
          onClick={onScan}
        />
        <ActionButton
          label="Generate Patch Review Pack"
          hint={
            generatingPack
              ? "Building Patch Review Pack…"
              : "Builds a copy-paste pack from changed-file metadata"
          }
          disabled={!hasProject || generatingPack || scanning}
          onClick={onGeneratePack}
        />
      </div>

      {pack ? (
        <>
          <div className="field-value">
            Patch Review Pack · {formatTime(pack.generatedAt)} ·{" "}
            {pack.changedFileCount} file(s) · {pack.riskyCount} risk-flagged
          </div>
          {pack.limitedContext ? (
            <div className="onedrive-warning" role="status">
              Limited context — scan changed files with Git for a fuller pack.
            </div>
          ) : null}
          <div
            className="review-preview"
            aria-label="Patch Review Pack preview"
          >
            {pack.previewExcerpt}
            {"\n"}…
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            {pack.secretSafetyNote}
          </div>
          <ActionButton
            label="Copy Patch Review Pack"
            hint={
              copyState === "copied"
                ? "Copied Patch Review Pack"
                : copyState === "failed"
                  ? "Copy failed — try again"
                  : "Copy for ChatGPT / Claude / Gemini / Grok"
            }
            disabled={false}
            primary
            onClick={onCopyPack}
          />
        </>
      ) : null}

      <ChangedFilesTaskLinkPanel
        taskCards={taskCards}
        lastScan={scan}
        taskLink={changedFiles.taskLink}
        onSelectTask={onSelectTaskLink}
        onLink={onLinkTask}
        onClear={onClearTaskLink}
      />
    </div>
  );
}

export function CodeContextPanel({
  codeContext,
  hasProject,
  filterDraft,
  onFilterChange,
  questionDraft,
  onQuestionChange,
  onApplyTemplate,
  onClearQuestion,
  maxLinesDraft,
  onMaxLinesChange,
  maxCharsDraft,
  onMaxCharsChange,
  refreshing,
  generating,
  onRefresh,
  onGenerate,
  onClearSelection,
  onToggleFile,
  onCopy,
  copyState,
}: {
  codeContext: CodeContextState;
  hasProject: boolean;
  filterDraft: string;
  onFilterChange: (value: string) => void;
  questionDraft: string;
  onQuestionChange: (value: string) => void;
  onApplyTemplate: (templateId: string, mode?: "append" | "replace") => void;
  onClearQuestion: () => void;
  maxLinesDraft: number;
  onMaxLinesChange: (value: number) => void;
  maxCharsDraft: number;
  onMaxCharsChange: (value: number) => void;
  refreshing: boolean;
  generating: boolean;
  onRefresh: () => void;
  onGenerate: () => void;
  onClearSelection: () => void;
  onToggleFile: (path: string, selected: boolean) => void;
  onCopy: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const filtered = codeContext.candidates.filter((file) => {
    const q = filterDraft.trim().toLowerCase();
    if (!q) return true;
    return file.relativePath.toLowerCase().includes(q);
  });

  const estimatedChars = codeContext.preview?.estimatedCharacters ?? 0;

  return (
    <div className="stack" data-focus-id="code-context-pack">
      <div>
        <div className="field-label">Code Context Pack — Preview Only</div>
        <HelpNote>
          What it does: builds a markdown pack from selected safe file excerpts
          for a future AI review stage. What it does not do: call Ollama, Local
          AI, Builder Plan Mode, live Qwen, or send anything automatically.
          Why it is safe: path-checked reads, secret-pattern blocking, size
          limits, and preview/copy only.
        </HelpNote>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {CODE_CONTEXT_PREVIEW_NOTE}
        </div>
      </div>

      <div className="field-label">Code question (optional)</div>
      <textarea
        className="request-box"
        rows={2}
        value={questionDraft}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="What should a future AI explain about the selected code?"
        disabled={!hasProject}
      />

      <div data-focus-id="code-question-templates">
        <div className="field-label">Code Question Templates</div>
        <HelpNote>
          Guided prompts for Ask Local AI About Selected Code. Templates fill the
          Code Question field only — they do not send anything to AI automatically.
        </HelpNote>
        {codeContext.selectedTemplate ? (
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Last template: {codeContext.selectedTemplate.templateLabel} ·{" "}
            {formatTime(codeContext.selectedTemplate.selectedAt)}
          </div>
        ) : null}
        <div className="row gap wrap" style={{ marginTop: "0.5rem" }}>
          {Object.values(CODE_QUESTION_TEMPLATES).map((template) => (
            <ActionButton
              key={template.id}
              label={template.label}
              hint="Fill or append to Code Question (no AI call)"
              disabled={!hasProject}
              onClick={() => onApplyTemplate(template.id)}
            />
          ))}
          <ActionButton
            label="Clear Code Question"
            hint="Clear the Code Question field"
            disabled={!hasProject || !questionDraft.trim()}
            onClick={onClearQuestion}
          />
        </div>
      </div>

      <div className="row gap wrap">
        <label className="field-label">
          Max lines / file
          <input
            type="number"
            min={20}
            max={500}
            value={maxLinesDraft}
            onChange={(e) => onMaxLinesChange(Number(e.target.value))}
            disabled={!hasProject}
            style={{ marginLeft: 8, width: 80 }}
          />
        </label>
        <label className="field-label">
          Max total chars
          <input
            type="number"
            min={5000}
            max={80000}
            value={maxCharsDraft}
            onChange={(e) => onMaxCharsChange(Number(e.target.value))}
            disabled={!hasProject}
            style={{ marginLeft: 8, width: 100 }}
          />
        </label>
      </div>

      <ActionButton
        label="Refresh Safe File List"
        hint={
          !hasProject
            ? "Select a project first"
            : refreshing
              ? "Scanning safe candidate files…"
              : "Lists up to 50 safe text/code files (`.nttc/` excluded)"
        }
        disabled={!hasProject || refreshing || codeContext.busy}
        onClick={onRefresh}
      />

      <div className="field-label">Search / filter files</div>
      <input
        className="text-input"
        value={filterDraft}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Filter by path…"
        disabled={!hasProject || codeContext.candidates.length === 0}
      />

      <div className="field-value">
        Selected: {codeContext.selectedCount} · Blocked/skipped:{" "}
        {codeContext.blockedCount}
        {codeContext.listingTruncated ? " · listing capped" : ""}
        {codeContext.preview
          ? ` · last preview ~${estimatedChars} chars`
          : ""}
      </div>

      {codeContext.candidates.length === 0 ? (
        <div className="placeholder-box">
          {hasProject
            ? "No safe file list yet. Click Refresh Safe File List."
            : "Select a project folder to list safe code/text files."}
        </div>
      ) : (
        <div className="code-context-file-list" role="list">
          {filtered.map((file) => (
            <label key={file.relativePath} className="code-context-file-row">
              <input
                type="checkbox"
                checked={file.selected}
                onChange={(e) => onToggleFile(file.relativePath, e.target.checked)}
              />
              <span>
                {file.relativePath}{" "}
                <span className="muted">({file.sizeBytes} bytes)</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="row gap wrap">
        <ActionButton
          label="Generate Code Context Preview"
          hint={
            generating
              ? "Building preview…"
              : "Preview only — does not call any AI"
          }
          disabled={!hasProject || generating || codeContext.busy}
          onClick={onGenerate}
        />
        <ActionButton
          label="Clear Selection"
          hint="Deselect all listed files"
          disabled={!hasProject || codeContext.selectedCount === 0}
          onClick={onClearSelection}
        />
      </div>

      {codeContext.preview ? (
        <>
          <div className="field-value">
            Preview generated {formatTime(codeContext.preview.generatedAt)} ·
            included {codeContext.preview.includedFileCount} / selected{" "}
            {codeContext.preview.selectedFileCount}
          </div>
          {codeContext.preview.truncationFlags.length > 0 ? (
            <div className="onedrive-warning" role="status">
              {codeContext.preview.truncationFlags.join(" ")}
            </div>
          ) : null}
          <div className="review-preview" aria-label="Code Context Pack preview">
            {codeContext.preview.previewExcerpt}
            {"\n"}…
          </div>
          <ActionButton
            label="Copy Code Context Pack"
            hint={
              copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy full markdown pack"
            }
            primary
            disabled={!codeContext.preview.markdownReport}
            onClick={onCopy}
          />
        </>
      ) : null}

      {codeContext.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {codeContext.statusMessage}
        </div>
      ) : null}
    </div>
  );
}

export function CodeContextAiPanel({
  codeContext,
  codeContextAi,
  providerReady,
  modelLabel,
  modelSourceLabel,
  copyState,
  onAsk,
  onCopy,
  onOpenRoleHelp,
  localAiProgress,
}: {
  codeContext: CodeContextState;
  codeContextAi: CodeContextAiState;
  providerReady: boolean;
  modelLabel: string;
  modelSourceLabel: string;
  copyState: "idle" | "copied" | "failed";
  onAsk: () => void;
  onCopy: () => void;
  onOpenRoleHelp: (key: RoleHelpKey) => void;
  localAiProgress: LocalAiProgressState | null;
}) {
  const pack = codeContext.preview;
  const saved = codeContextAi.saved;
  const hasPack = Boolean(pack?.markdownReport?.trim());
  const canAsk = providerReady && hasPack && !codeContextAi.busy && !codeContext.busy;
  const packWarnings =
    (pack?.warningCount ?? 0) > 0 || Boolean(pack?.truncated);

  return (
    <div className="stack" data-focus-id="code-context-ai">
      <div>
        <div
          className="field-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            flexWrap: "wrap",
          }}
        >
          Ask Local AI About Selected Code
        </div>
        <HelpNote>
          Sends only the previewed Code Context Pack to your local Ollama reviewer
          after you confirm. The model cannot browse the project, edit files, or run
          commands.
        </HelpNote>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {CODE_CONTEXT_AI_SEND_NOTE}
        </div>
      </div>

      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
        Role/mode:{" "}
        <ClickableRoleName
          roleKey="code-context-review"
          label="Code Reviewer"
          onOpen={onOpenRoleHelp}
        />
        {" · "}
        Model: <strong>{modelLabel}</strong>
        {modelSourceLabel ? ` · ${modelSourceLabel}` : ""}
      </div>

      {pack ? (
        <div className="field-value" style={{ fontSize: "0.82rem" }}>
          Context pack: {formatTime(pack.generatedAt)} · selected{" "}
          {pack.selectedFileCount} · warnings {pack.warningCount}
          {pack.truncated ? " · truncated" : ""}
        </div>
      ) : (
        <div className="placeholder-box">
          Generate a Code Context Pack preview above before asking Local AI.
        </div>
      )}

      {packWarnings && hasPack ? (
        <div className="onedrive-warning" role="status">
          This pack has warnings or truncation. You can still send it after
          confirmation, but the AI may be missing context.
        </div>
      ) : null}

      <LocalAiProgressBanner progress={localAiProgress} mode="code-context-review" />

      <div className="row gap wrap">
        <ActionButton
          label="Ask Local AI About Code"
          hint={
            !hasPack
              ? "Generate a Code Context Pack first"
              : !providerReady
                ? "Connect a local AI reviewer first"
                : codeContextAi.busy
                  ? "Waiting for Local AI response…"
                  : "Confirmation required — sends approved pack only"
          }
          disabled={!canAsk}
          primary={canAsk}
          onClick={onAsk}
        />
        <ActionButton
          label="Copy Code AI Response"
          hint={
            copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : saved
                  ? "Copy full Local AI Code Review"
                  : "Ask Local AI About Code first"
          }
          disabled={!saved || codeContextAi.busy}
          onClick={onCopy}
        />
      </div>

      {saved ? (
        <>
          <div className="field-value" style={{ fontSize: "0.82rem" }}>
            Response {formatTime(saved.generatedAt)} · {saved.modelName} · pack{" "}
            {formatTime(saved.contextPackGeneratedAt)} · selected{" "}
            {saved.selectedFileCount} · warnings {saved.warningCount}
            {saved.truncated ? " · pack truncated" : ""}
            {saved.truncatedResponse ? " · response truncated" : ""}
          </div>
          {saved.recommendedNextStep ? (
            <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
              Recommended next step: {saved.recommendedNextStep}
            </div>
          ) : null}
          <div className="review-preview" aria-label="Code AI response preview">
            {saved.previewExcerpt}
            {"\n"}…
          </div>
        </>
      ) : null}

      {codeContextAi.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {codeContextAi.statusMessage}
        </div>
      ) : null}
    </div>
  );
}

export function PatchDraftPanel({
  codeContext,
  patchDraft,
  providerReady,
  modelLabel,
  modelSourceLabel,
  copyState,
  hasCodeAiResponse,
  hasBuilderPlanOrDecision,
  hasImplementationReview,
  onToggleCodeAi,
  onToggleBuilderPlanDecision,
  onToggleImplementationReview,
  onGenerate,
  onCopy,
  onOpenRoleHelp,
  onFastDraftSetup,
  localAiProgress,
  planningStyle,
}: {
  codeContext: CodeContextState;
  patchDraft: PatchDraftState;
  providerReady: boolean;
  modelLabel: string;
  modelSourceLabel: string;
  copyState: "idle" | "copied" | "failed";
  hasCodeAiResponse: boolean;
  hasBuilderPlanOrDecision: boolean;
  hasImplementationReview: boolean;
  onToggleCodeAi: (include: boolean) => void;
  onToggleBuilderPlanDecision: (include: boolean) => void;
  onToggleImplementationReview: (include: boolean) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onOpenRoleHelp: (key: RoleHelpKey) => void;
  onFastDraftSetup: () => void;
  localAiProgress: LocalAiProgressState | null;
  planningStyle: PlanningStyleId;
}) {
  const pack = codeContext.preview;
  const saved = patchDraft.saved;
  const hasPack = Boolean(pack?.markdownReport?.trim());
  const canGenerate =
    providerReady && hasPack && !patchDraft.busy && !codeContext.busy;
  const packWarnings =
    (pack?.warningCount ?? 0) > 0 || Boolean(pack?.truncated);

  return (
    <div className="stack" data-focus-id="patch-draft-mode">
      <div>
        <div
          className="field-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            flexWrap: "wrap",
          }}
        >
          Patch Draft Mode — No Apply
        </div>
        <HelpNote>
          Asks local Ollama to draft a proposed patch from the approved Code Context
          Pack after you confirm. NTTC will not edit files, apply patches, or run
          commands.
        </HelpNote>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {PATCH_DRAFT_SEND_NOTE}
        </div>
        <PlanningStyleStatusLine style={planningStyle} />
      </div>

      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
        Role/mode:{" "}
        <ClickableRoleName
          roleKey="patch-draft"
          label="Patch Draft"
          onOpen={onOpenRoleHelp}
        />
        {" · "}
        Model: <strong>{modelLabel}</strong>
        {modelSourceLabel ? ` · ${modelSourceLabel}` : ""}
      </div>

      {pack ? (
        <div className="field-value" style={{ fontSize: "0.82rem" }}>
          Context pack: {formatTime(pack.generatedAt)} · selected{" "}
          {pack.selectedFileCount} · warnings {pack.warningCount}
          {pack.truncated ? " · truncated" : ""}
        </div>
      ) : (
        <div className="placeholder-box">
          Generate a Code Context Pack preview above before generating a Patch Draft.
        </div>
      )}

      <label
        className="field-value"
        htmlFor="patch-draft-code-ai"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <input
          id="patch-draft-code-ai"
          type="checkbox"
          checked={patchDraft.includeCodeAiResponseExcerpt}
          disabled={patchDraft.busy || !hasCodeAiResponse}
          onChange={(e) => onToggleCodeAi(e.target.checked)}
        />
        Include latest Code AI response excerpt
      </label>

      <label
        className="field-value"
        htmlFor="patch-draft-plan-decision"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <input
          id="patch-draft-plan-decision"
          type="checkbox"
          checked={patchDraft.includeBuilderPlanDecisionExcerpt}
          disabled={patchDraft.busy || !hasBuilderPlanOrDecision}
          onChange={(e) => onToggleBuilderPlanDecision(e.target.checked)}
        />
        Include Builder Plan / Decision Report excerpt
      </label>

      <label
        className="field-value"
        htmlFor="patch-draft-impl-review"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <input
          id="patch-draft-impl-review"
          type="checkbox"
          checked={patchDraft.includeImplementationReviewExcerpt}
          disabled={patchDraft.busy || !hasImplementationReview}
          onChange={(e) => onToggleImplementationReview(e.target.checked)}
        />
        Include Implementation Review excerpt
      </label>

      {packWarnings && hasPack ? (
        <div className="onedrive-warning" role="status">
          This pack has warnings or truncation. You can still generate a draft after
          confirmation, but the AI may be missing context.
        </div>
      ) : null}

      <div className="row gap wrap">
        <ActionButton
          label="Fast Draft Setup"
          hint="Set 25 lines/file, turn optional excerpts off, and show faster-draft tips (no auto-send)"
          disabled={patchDraft.busy || codeContext.busy}
          onClick={onFastDraftSetup}
        />
      </div>

      <LocalAiProgressBanner progress={localAiProgress} mode="patch-draft-mode" />

      <div className="row gap wrap">
        <ActionButton
          label="Generate Patch Draft with Local AI"
          hint={
            !hasPack
              ? "Generate a Code Context Pack first"
              : !providerReady
                ? "Connect a local AI reviewer first"
                : patchDraft.busy
                  ? "Generating Patch Draft…"
                  : "Confirmation required — draft only, no apply"
          }
          disabled={!canGenerate}
          primary={canGenerate}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Patch Draft"
          hint={
            copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : saved
                  ? "Copy full Patch Draft markdown"
                  : "Generate a Patch Draft first"
          }
          disabled={!saved || patchDraft.busy}
          onClick={onCopy}
        />
      </div>

      {saved ? (
        <>
          <div className="field-value" style={{ fontSize: "0.82rem" }}>
            Draft {formatTime(saved.generatedAt)} · {saved.modelName} · pack{" "}
            {formatTime(saved.contextPackGeneratedAt)} · selected{" "}
            {saved.selectedFileCount} · warnings {saved.warningCount}
            {saved.truncated ? " · pack truncated" : ""}
            {saved.truncatedResponse ? " · draft truncated" : ""}
          </div>
          {saved.recommendation ? (
            <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
              Recommendation: {saved.recommendation}
            </div>
          ) : null}
          <div className="review-preview" aria-label="Patch Draft preview">
            {saved.previewExcerpt}
            {"\n"}…
          </div>
        </>
      ) : null}

      {patchDraft.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {patchDraft.statusMessage}
        </div>
      ) : null}
    </div>
  );
}

export function PatchDraftSafetyReviewPanel({
  review,
  hasNttcPatchDraft,
  hasImportedPatchDraft,
  recentPatchDraftFailure,
  generating,
  copyState,
  onReviewTargetChange,
  onGenerate,
  onCopy,
  planningStyle,
}: {
  review: PatchDraftSafetyReviewState;
  hasNttcPatchDraft: boolean;
  hasImportedPatchDraft: boolean;
  recentPatchDraftFailure: boolean;
  generating: boolean;
  copyState: "idle" | "copied" | "failed";
  onReviewTargetChange: (target: PatchDraftSafetyReviewTargetKind) => void;
  onGenerate: () => void;
  onCopy: () => void;
  planningStyle: PlanningStyleId;
}) {
  const saved = review.saved;
  const reviewTarget = review.reviewTarget ?? "nttc-patch-draft";
  const bothDraftsExist = hasNttcPatchDraft && hasImportedPatchDraft;
  const hasDraftForTarget =
    reviewTarget === "imported-patch-draft"
      ? hasImportedPatchDraft
      : hasNttcPatchDraft;
  const targetLabel =
    PATCH_DRAFT_SAFETY_REVIEW_TARGETS.find((t) => t.id === reviewTarget)?.label ??
    "NTTC Patch Draft";

  return (
    <div className="stack" data-focus-id="patch-draft-safety-review">
      <div>
        <div className="field-label">Patch Draft Safety Review</div>
        <HelpNote>
          What it does: analyzes Patch Draft text (NTTC-generated or manually
          imported) and safe NTTC metadata with keyword rules before you send it
          to an outside builder. What it does not do: call Ollama, read source
          files, run commands,           apply patches, or edit project files.
        </HelpNote>
        <PlanningStyleStatusLine style={planningStyle} />
      </div>

      {bothDraftsExist ? (
        <div>
          <div className="field-label">Safety Review Target</div>
          <select
            className="settings-input"
            value={reviewTarget}
            onChange={(event) =>
              onReviewTargetChange(
                event.target.value as PatchDraftSafetyReviewTargetKind,
              )
            }
          >
            {PATCH_DRAFT_SAFETY_REVIEW_TARGETS.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          Review target: <strong>{targetLabel}</strong>
          {hasImportedPatchDraft && !hasNttcPatchDraft
            ? " (only imported draft available)"
            : hasNttcPatchDraft && !hasImportedPatchDraft
              ? " (only NTTC draft available)"
              : ""}
        </div>
      )}

      {!hasDraftForTarget ? (
        <div className="onedrive-warning" role="status">
          {reviewTarget === "imported-patch-draft"
            ? "Paste an imported patch draft first."
            : recentPatchDraftFailure
              ? PATCH_DRAFT_FAILURE_SAFETY_REVIEW_NOTE
              : "Generate a Patch Draft first."}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <ActionButton
          label="Generate Patch Draft Safety Review"
          hint={
            !hasDraftForTarget
              ? reviewTarget === "imported-patch-draft"
                ? "Save an Imported Patch Draft first."
                : "Generate a Patch Draft first."
              : generating
                ? "Building rule-based Patch Draft Safety Review…"
                : `Review ${targetLabel} risks before outside builder (no Ollama)`
          }
          disabled={!hasDraftForTarget || generating}
          primary={hasDraftForTarget && !generating}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Patch Draft Safety Review"
          hint={
            copyState === "copied"
              ? "Copied Patch Draft Safety Review"
              : copyState === "failed"
                ? "Copy failed — try again"
                : saved
                  ? "Copy the full Patch Draft Safety Review markdown"
                  : "Generate a Patch Draft Safety Review first"
          }
          disabled={!saved || generating}
          onClick={onCopy}
        />
      </div>

      {review.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.85rem" }}>
          {review.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-value" style={{ fontSize: "0.9rem" }}>
            Recommendation badge: <strong>{saved.recommendation}</strong>
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Review target: {saved.reviewTargetLabel ?? saved.reviewTargetKind} ·{" "}
            Source draft: {formatTime(saved.sourcePatchDraftGeneratedAt)} · Review{" "}
            {formatTime(saved.generatedAt)}
            {saved.truncatedInput ? " · input truncated" : ""}
            {saved.truncatedReview ? " · review truncated" : ""}
          </div>
          <div
            className="review-preview"
            aria-label="Patch Draft Safety Review preview"
          >
            {saved.previewExcerpt}
          </div>
        </>
      ) : (
        <div className="placeholder-box">
          No Patch Draft Safety Review yet. Next: save an Imported Patch Draft or
          generate an NTTC Patch Draft, then click{" "}
          <strong>Generate Patch Draft Safety Review</strong>.
        </div>
      )}
    </div>
  );
}
