import type { ReactNode } from "react";
import type {
  ExternalPatchDraftComparisonState,
  ImportedPatchDraftState,
  PatchDraftState,
  PlanningStyleId,
} from "../../shared/types";
import {
  EXTERNAL_PATCH_DRAFT_COMPARISON_NO_DRAFTS_MESSAGE,
  EXTERNAL_PATCH_DRAFT_COMPARISON_PURPOSE,
} from "../../shared/externalPatchDraftComparisonConstants";
import { PlanningStyleStatusLine } from "./PlanningStyleControl";

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

function HelpNote({ children }: { children: ReactNode }) {
  return (
    <div className="help-note" role="note">
      {children}
    </div>
  );
}

export function ExternalPatchDraftComparisonPanel({
  comparison,
  patchDraft,
  importedPatchDraft,
  safetyBackupVerified,
  patchDraftSafetyReviewExists,
  generating,
  copyState,
  onGenerate,
  onCopy,
  onClear,
  planningStyle,
}: {
  comparison: ExternalPatchDraftComparisonState;
  patchDraft: PatchDraftState;
  importedPatchDraft: ImportedPatchDraftState;
  safetyBackupVerified: boolean;
  patchDraftSafetyReviewExists: boolean;
  generating: boolean;
  copyState: "idle" | "copied" | "failed";
  onGenerate: () => void;
  onCopy: () => void;
  onClear: () => void;
  planningStyle: PlanningStyleId;
}) {
  const saved = comparison.saved;
  const hasNttcDraft = Boolean(patchDraft.saved);
  const hasImportedDraft = Boolean(importedPatchDraft.saved);
  const canGenerate = hasNttcDraft || hasImportedDraft;

  return (
    <div className="stack" data-focus-id="external-patch-draft-comparison">
      <div>
        <div className="field-label">External Patch Draft Comparison</div>
        <HelpNote>
          What it does: {EXTERNAL_PATCH_DRAFT_COMPARISON_PURPOSE} What it does
          not do: call Ollama, read source files, apply patches, run commands,
          or edit project files.
        </HelpNote>
        <PlanningStyleStatusLine style={planningStyle} />
      </div>

      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
        <div>NTTC Patch Draft exists: {hasNttcDraft ? "yes" : "no"}</div>
        <div>Imported Patch Draft exists: {hasImportedDraft ? "yes" : "no"}</div>
        {importedPatchDraft.saved ? (
          <div>
            Imported source/type/time: {importedPatchDraft.saved.source} /{" "}
            {importedPatchDraft.saved.draftType} /{" "}
            {importedPatchDraft.saved.importedAt}
          </div>
        ) : null}
        <div>
          Patch Draft Safety Review exists:{" "}
          {patchDraftSafetyReviewExists ? "yes" : "no"}
        </div>
        <div>
          Safety Backup verified: {safetyBackupVerified ? "yes" : "no"}
        </div>
      </div>

      {!canGenerate ? (
        <div className="onedrive-warning" role="status">
          {EXTERNAL_PATCH_DRAFT_COMPARISON_NO_DRAFTS_MESSAGE}
        </div>
      ) : null}

      {hasNttcDraft && !hasImportedDraft ? (
        <div className="onedrive-warning" role="status">
          Only NTTC Patch Draft exists. Comparison will be partial.
        </div>
      ) : null}

      {hasImportedDraft && !hasNttcDraft ? (
        <div className="onedrive-warning" role="status">
          Only Imported Patch Draft exists. Comparison will be partial.
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <ActionButton
          label="Generate External Patch Draft Comparison"
          hint={
            !canGenerate
              ? EXTERNAL_PATCH_DRAFT_COMPARISON_NO_DRAFTS_MESSAGE
              : generating
                ? "Building rule-based comparison…"
                : "Compare NTTC vs imported patch drafts (no AI)"
          }
          disabled={!canGenerate || generating}
          primary={canGenerate && !generating}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Comparison Report"
          hint={
            saved
              ? "Copy the latest comparison markdown report"
              : "Generate a comparison report first"
          }
          disabled={!saved}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Comparison Report"
          hint={
            saved
              ? "Remove the saved comparison from this session"
              : "No comparison report to clear"
          }
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {comparison.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {comparison.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Risk: {saved.riskLevel} · Recommendation: {saved.recommendation}
            {saved.partialComparison ? " · Partial comparison" : ""}
            {copyState === "copied" ? " · Copied" : ""}
          </div>
          <div className="review-preview" aria-label="External Patch Draft Comparison excerpt">
            {saved.previewExcerpt}
          </div>
        </>
      ) : null}
    </div>
  );
}
