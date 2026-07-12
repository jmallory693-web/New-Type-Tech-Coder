import { useMemo } from "react";
import type {
  ImportedPatchDraftSource,
  ImportedPatchDraftState,
  ImportedPatchDraftType,
} from "../../shared/types";
import {
  IMPORTED_PATCH_DRAFT_NOTE,
  IMPORTED_PATCH_DRAFT_NO_APPLY_WARNING,
  IMPORTED_PATCH_DRAFT_SOURCES,
  IMPORTED_PATCH_DRAFT_TYPES,
} from "../../shared/importedPatchDraftConstants";
import { scanImportedPatchDraftText } from "../../shared/scanImportedPatchDraft";

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

function HelpNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="help-note" role="note">
      {children}
    </div>
  );
}

export function ManualPatchDraftImportPanel({
  importedPatchDraft,
  copyState,
  onSourceChange,
  onDraftTypeChange,
  onDraftChange,
  onSave,
  onClearSaved,
  onCopy,
}: {
  importedPatchDraft: ImportedPatchDraftState;
  copyState: "idle" | "copied" | "failed";
  onSourceChange: (source: ImportedPatchDraftSource) => void;
  onDraftTypeChange: (draftType: ImportedPatchDraftType) => void;
  onDraftChange: (text: string) => void;
  onSave: () => void;
  onClearSaved: () => void;
  onCopy: () => void;
}) {
  const saved = importedPatchDraft.saved;
  const draftText = importedPatchDraft.draftText;
  const canSave = draftText.trim().length > 0;
  const liveScan = useMemo(
    () => scanImportedPatchDraftText(draftText.trim()),
    [draftText],
  );

  return (
    <div className="stack" data-focus-id="manual-patch-draft-import">
      <div>
        <div className="field-label">Manual Patch Draft Import</div>
        <HelpNote>
          Paste an outside patch draft from Cursor, Codex, Claude, ChatGPT, Grok,
          Qwen, a human programmer, or another tool. NTTC stores it as text only,
          does not apply it, and does not send it to AI automatically.
        </HelpNote>
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {IMPORTED_PATCH_DRAFT_NOTE}
        </div>
      </div>

      <div className="onedrive-warning" role="status">
        {IMPORTED_PATCH_DRAFT_NO_APPLY_WARNING}
      </div>

      <div>
        <div className="field-label">Source</div>
        <select
          className="settings-input"
          value={importedPatchDraft.source}
          onChange={(event) =>
            onSourceChange(event.target.value as ImportedPatchDraftSource)
          }
        >
          {IMPORTED_PATCH_DRAFT_SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Draft type</div>
        <select
          className="settings-input"
          value={importedPatchDraft.draftType}
          onChange={(event) =>
            onDraftTypeChange(event.target.value as ImportedPatchDraftType)
          }
        >
          {IMPORTED_PATCH_DRAFT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="field-label">Paste imported patch draft</div>
        <textarea
          className="request-box"
          value={draftText}
          maxLength={80000}
          placeholder="Paste proposed code snippets, diff-like suggestions, implementation plans, or builder patch drafts…"
          onChange={(event) => onDraftChange(event.target.value)}
        />
      </div>

      {liveScan.blockedBySecrets && canSave ? (
        <div className="onedrive-warning" role="alert">
          Possible secret-like pattern detected. Remove secret values before saving.
          Saving may be blocked unless you explicitly confirm after review.
        </div>
      ) : null}

      {liveScan.riskPhrases.length > 0 && canSave ? (
        <div className="onedrive-warning" role="status">
          Risk phrases detected ({liveScan.riskPhrases.length}):{" "}
          {liveScan.riskPhrases.slice(0, 8).join(", ")}
          {liveScan.riskPhrases.length > 8 ? "…" : ""}. Run Patch Draft Safety
          Review before trusting this draft.
        </div>
      ) : null}

      <div className="row gap wrap">
        <ActionButton
          label="Save Imported Patch Draft"
          hint={
            !canSave
              ? "Paste draft text first"
              : liveScan.blockedBySecrets
                ? "May require confirmation if secret-like patterns remain"
                : "Save as imported draft only — NTTC will not apply it"
          }
          disabled={!canSave}
          primary={canSave}
          onClick={onSave}
        />
        <ActionButton
          label="Clear Imported Patch Draft"
          hint="Remove the saved imported draft (does not clear the paste box)"
          disabled={!saved}
          onClick={onClearSaved}
        />
        <ActionButton
          label="Copy Imported Patch Draft"
          hint={
            copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : saved
                  ? "Copy full saved imported draft text"
                  : "Save an Imported Patch Draft first"
          }
          disabled={!saved}
          onClick={onCopy}
        />
      </div>

      {importedPatchDraft.statusMessage ? (
        <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
          {importedPatchDraft.statusMessage}
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="field-label">Imported draft metadata</div>
          <div className="field-value" style={{ fontSize: "0.82rem" }}>
            Source: <strong>{saved.source}</strong> · Type:{" "}
            <strong>{saved.draftType}</strong> · Imported{" "}
            {formatTime(saved.importedAt)}
            {saved.truncatedImport ? " · truncated on save" : ""}
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Risk phrases: {saved.riskPhraseCount}
            {saved.riskPhrases.length
              ? ` (${saved.riskPhrases.slice(0, 6).join(", ")}${saved.riskPhrases.length > 6 ? "…" : ""})`
              : ""}
          </div>
          {saved.likelyFilesAreas.length ? (
            <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
              Likely files/areas: {saved.likelyFilesAreas.slice(0, 8).join(", ")}
              {saved.likelyFilesAreas.length > 8 ? "…" : ""}
            </div>
          ) : null}
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Context at import — Code Context Pack:{" "}
            {saved.contextAtImport.codeContextPackExisted ? "yes" : "no"} · Code AI
            response: {saved.contextAtImport.codeAiResponseExisted ? "yes" : "no"} ·
            NTTC Patch Draft:{" "}
            {saved.contextAtImport.nttcPatchDraftExisted ? "yes" : "no"} · Safety
            Review:{" "}
            {saved.contextAtImport.patchDraftSafetyReviewExisted ? "yes" : "no"} ·
            Safety Backup verified:{" "}
            {saved.contextAtImport.safetyBackupVerified ? "yes" : "no"}
          </div>
          <div className="review-preview" aria-label="Imported patch draft preview">
            {saved.previewExcerpt}
            {"\n"}…
          </div>
        </>
      ) : (
        <div className="placeholder-box">
          No imported patch draft saved yet. Paste an outside draft above and click{" "}
          <strong>Save Imported Patch Draft</strong>, then run Patch Draft Safety
          Review.
        </div>
      )}
    </div>
  );
}
