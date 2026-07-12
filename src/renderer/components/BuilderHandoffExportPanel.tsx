import type { ReactNode } from "react";
import type {
  BuilderHandoffExportState,
  BuilderHandoffStrictness,
  BuilderHandoffTarget,
  ExternalPatchDraftComparisonState,
  ImportedPatchDraftState,
  PatchDraftSafetyReviewState,
  PatchDraftState,
  PlanningStyleId,
} from "../../shared/types";
import {
  BUILDER_HANDOFF_EXPORT_NO_INPUTS_MESSAGE,
  BUILDER_HANDOFF_EXPORT_PURPOSE,
  BUILDER_HANDOFF_STRICTNESS_OPTIONS,
  BUILDER_HANDOFF_TARGET_OPTIONS,
} from "../../shared/builderHandoffExportConstants";
import { getBuilderHandoffTargetLabel } from "../../shared/builderHandoffTargetWording";
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

export function BuilderHandoffExportPanel({
  handoff,
  patchDraft,
  importedPatchDraft,
  patchDraftSafetyReview,
  externalPatchDraftComparison,
  safetyBackupVerified,
  generating,
  copyState,
  onTargetChange,
  onStrictnessChange,
  onGenerate,
  onCopy,
  onClear,
  planningStyle,
}: {
  handoff: BuilderHandoffExportState;
  patchDraft: PatchDraftState;
  importedPatchDraft: ImportedPatchDraftState;
  patchDraftSafetyReview: PatchDraftSafetyReviewState;
  externalPatchDraftComparison: ExternalPatchDraftComparisonState;
  safetyBackupVerified: boolean;
  generating: boolean;
  copyState: "idle" | "copied" | "failed";
  onTargetChange: (target: BuilderHandoffTarget) => void;
  onStrictnessChange: (strictness: BuilderHandoffStrictness) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onClear: () => void;
  planningStyle: PlanningStyleId;
}) {
  const saved = handoff.saved;
  const hasNttcDraft = Boolean(patchDraft.saved);
  const hasImportedDraft = Boolean(importedPatchDraft.saved);
  const hasSafetyReview = Boolean(patchDraftSafetyReview.saved);
  const hasComparison = Boolean(externalPatchDraftComparison.saved);
  const canGenerate =
    hasNttcDraft ||
    hasImportedDraft ||
    hasSafetyReview ||
    hasComparison;

  return (
    <div className="stack" data-focus-id="builder-handoff-export">
      <div>
        <div className="field-label">Builder Handoff Export</div>
        <HelpNote>
          What it does: {BUILDER_HANDOFF_EXPORT_PURPOSE} What it does not do:
          call Ollama, read source files, apply patches, run commands, connect to
          external tools, or edit project files.
        </HelpNote>
        <PlanningStyleStatusLine style={planningStyle} />
      </div>

      <div className="field-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <label className="field-label" style={{ minWidth: "8rem" }}>
          Handoff target
          <select
            className="field-input"
            value={handoff.target}
            onChange={(e) =>
              onTargetChange(e.target.value as BuilderHandoffTarget)
            }
          >
            {BUILDER_HANDOFF_TARGET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label" style={{ minWidth: "8rem" }}>
          Handoff strictness
          <select
            className="field-input"
            value={handoff.strictness}
            onChange={(e) =>
              onStrictnessChange(e.target.value as BuilderHandoffStrictness)
            }
          >
            {BUILDER_HANDOFF_STRICTNESS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
        <div>NTTC Patch Draft exists: {hasNttcDraft ? "yes" : "no"}</div>
        <div>Imported Patch Draft exists: {hasImportedDraft ? "yes" : "no"}</div>
        <div>
          Patch Draft Safety Review exists: {hasSafetyReview ? "yes" : "no"}
        </div>
        <div>
          External Patch Draft Comparison exists: {hasComparison ? "yes" : "no"}
        </div>
        <div>
          Safety Backup verified: {safetyBackupVerified ? "yes" : "no"}
        </div>
      </div>

      {!canGenerate ? (
        <div className="onedrive-warning" role="status">
          {BUILDER_HANDOFF_EXPORT_NO_INPUTS_MESSAGE}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <ActionButton
          label="Generate Builder Handoff Pack"
          hint={
            !canGenerate
              ? BUILDER_HANDOFF_EXPORT_NO_INPUTS_MESSAGE
              : generating
                ? "Building rule-based handoff pack…"
                : "Create a text-only builder handoff (no AI)"
          }
          disabled={!canGenerate || generating}
          primary={canGenerate && !generating}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Builder Handoff Pack"
          hint={
            saved
              ? "Copy the latest handoff markdown report"
              : "Generate a handoff pack first"
          }
          disabled={!saved}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Builder Handoff Pack"
          hint={
            saved
              ? "Remove the saved handoff from this session"
              : "No handoff pack to clear"
          }
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {handoff.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {handoff.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Target: {getBuilderHandoffTargetLabel(saved.target)} · Strictness:{" "}
            {saved.strictness} · Recommendation: {saved.recommendation}
            {saved.missingContextCount > 0
              ? ` · Missing context: ${saved.missingContextCount}`
              : ""}
            {copyState === "copied" ? " · Copied" : ""}
          </div>
          <div
            className="review-preview"
            aria-label="Builder Handoff Pack excerpt"
          >
            {saved.previewExcerpt}
          </div>
        </>
      ) : null}
    </div>
  );
}
