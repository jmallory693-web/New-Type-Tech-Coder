import { useEffect, useState } from "react";
import type { BlueprintState } from "../../shared/types";
import type { SafeScaffoldTargetState } from "../../shared/buildModeTargetSafety";
import type { SafeScaffoldFileTreePreviewState } from "../../shared/buildModeFileTreePreview";
import type { SafeScaffoldFileContentPreviewState } from "../../shared/buildModeFileContentPreview";
import type { SafeScaffoldWriteManifestPreviewState } from "../../shared/buildModeWriteManifestPreview";
import type { SafeScaffoldFinalConfirmationState } from "../../shared/buildModeFinalConfirmation";
import {
  BUILD_MODE_INACTIVE_BANNER,
  BUILD_MODE_SAFETY_CHARTER_RULES,
  BUILD_MODE_STATUS_EXPLAIN,
  BUILD_MODE_STATUS_LABEL,
  BUILD_MODE_WILL_NOT_DO,
  FUTURE_SAFE_SCAFFOLD_REQUIREMENTS,
} from "../../shared/buildModeSafetyCharter";
import { deriveBuildModeReadiness } from "../../shared/buildModeReadiness";
import {
  folderSafetyLabel,
  SAFE_SCAFFOLD_FILE_CREATION_NOT_ENABLED_YET,
  SAFE_SCAFFOLD_FUTURE_WRITE_READINESS,
  SAFE_SCAFFOLD_TARGET_UI_LABELS,
} from "../../shared/buildModeTargetSafety";
import {
  SAFE_SCAFFOLD_FILE_TREE_NO_CONTENTS_YET,
  SAFE_SCAFFOLD_FILE_TREE_PREVIEW_ONLY,
  SAFE_SCAFFOLD_FILE_TREE_UI_LABELS,
} from "../../shared/buildModeFileTreePreview";
import {
  SAFE_SCAFFOLD_FILE_CONTENT_PREVIEW_ONLY,
  SAFE_SCAFFOLD_FILE_CONTENT_UI_LABELS,
} from "../../shared/buildModeFileContentPreview";
import {
  SAFE_SCAFFOLD_WRITE_MANIFEST_PREVIEW_ONLY,
  SAFE_SCAFFOLD_WRITE_MANIFEST_UI_LABELS,
} from "../../shared/buildModeWriteManifestPreview";
import {
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_BOUNDARIES,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_CAUTION,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_STAGE127,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_RECORDED,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_STALE_MESSAGE,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_STILL_DISABLED,
  SAFE_SCAFFOLD_FINAL_CONFIRMATION_UI_LABELS,
  SAFE_SCAFFOLD_WRITE_FILES_DISABLED_LABEL,
} from "../../shared/buildModeFinalConfirmation";

/** Stage 117–127: Build Mode — readiness + previews + final confirmation gate only. */
export function BuildModeTab({
  blueprint,
  safeScaffoldTarget,
  safeScaffoldFileTreePreview,
  safeScaffoldFileContentPreview,
  safeScaffoldWriteManifestPreview,
  safeScaffoldFinalConfirmation,
  onOpenBlueprint,
  onSelectTargetFolder,
  onClearTargetFolder,
  onRefreshTargetSafety,
  onGenerateFileTreePreview,
  onClearFileTreePreview,
  onCopyFileTreePreview,
  onGenerateFileContentPreview,
  onClearFileContentPreview,
  onCopyFileContentPreview,
  onGenerateWriteManifestPreview,
  onClearWriteManifestPreview,
  onCopyWriteManifestPreview,
  onRecordFinalConfirmation,
  onClearFinalConfirmation,
  onCopyFinalConfirmation,
}: {
  blueprint: BlueprintState;
  safeScaffoldTarget: SafeScaffoldTargetState;
  safeScaffoldFileTreePreview: SafeScaffoldFileTreePreviewState;
  safeScaffoldFileContentPreview: SafeScaffoldFileContentPreviewState;
  safeScaffoldWriteManifestPreview: SafeScaffoldWriteManifestPreviewState;
  safeScaffoldFinalConfirmation: SafeScaffoldFinalConfirmationState;
  onOpenBlueprint: () => void;
  onSelectTargetFolder: () => void | Promise<void>;
  onClearTargetFolder: () => void | Promise<void>;
  onRefreshTargetSafety: () => void | Promise<void>;
  onGenerateFileTreePreview: () => void | Promise<void>;
  onClearFileTreePreview: () => void | Promise<void>;
  onCopyFileTreePreview: () => void | Promise<void>;
  onGenerateFileContentPreview: () => void | Promise<void>;
  onClearFileContentPreview: () => void | Promise<void>;
  onCopyFileContentPreview: () => void | Promise<void>;
  onGenerateWriteManifestPreview: () => void | Promise<void>;
  onClearWriteManifestPreview: () => void | Promise<void>;
  onCopyWriteManifestPreview: () => void | Promise<void>;
  onRecordFinalConfirmation: (acks: {
    futureWriteBoundaries: boolean;
    stage127NoWrite: boolean;
    cautionTarget: boolean;
  }) => void | Promise<void>;
  onClearFinalConfirmation: () => void | Promise<void>;
  onCopyFinalConfirmation: () => void | Promise<void>;
}) {
  const readiness = deriveBuildModeReadiness(
    blueprint,
    safeScaffoldTarget,
    safeScaffoldFileTreePreview,
    safeScaffoldFileContentPreview,
    safeScaffoldWriteManifestPreview,
    safeScaffoldFinalConfirmation,
  );
  const uiLabel = SAFE_SCAFFOLD_TARGET_UI_LABELS[safeScaffoldTarget.uiStatus];
  const safetyLabel = folderSafetyLabel(safeScaffoldTarget);
  const summary = safeScaffoldTarget.lastCheck?.entrySummary;
  const entrySummaryText = summary
    ? `${summary.totalEntries} entries` +
      (summary.truncated ? " (truncated)" : "") +
      ` · files ${summary.fileCount}` +
      ` · dirs ${summary.directoryCount}` +
      (summary.entryNames.length > 0
        ? ` · names: ${summary.entryNames.slice(0, 12).join(", ")}${
            summary.entryNames.length > 12 ? "…" : ""
          }`
        : " · (empty)")
    : "none";

  const laterOnlyIds = new Set([
    "actual-files-written",
    "written-files-manifest-after-write",
  ]);

  const fileTreeUi =
    SAFE_SCAFFOLD_FILE_TREE_UI_LABELS[safeScaffoldFileTreePreview.uiStatus];
  const canClickGenerateTree =
    !safeScaffoldFileTreePreview.busy &&
    safeScaffoldFileTreePreview.readinessBlockedReasons.length === 0;

  const fileContentUi =
    SAFE_SCAFFOLD_FILE_CONTENT_UI_LABELS[
      safeScaffoldFileContentPreview.uiStatus
    ];
  const canClickGenerateContent =
    !safeScaffoldFileContentPreview.busy &&
    safeScaffoldFileContentPreview.readinessBlockedReasons.length === 0;

  const writeManifestUi =
    SAFE_SCAFFOLD_WRITE_MANIFEST_UI_LABELS[
      safeScaffoldWriteManifestPreview.uiStatus
    ];
  const canClickGenerateManifest =
    !safeScaffoldWriteManifestPreview.busy &&
    safeScaffoldWriteManifestPreview.readinessBlockedReasons.length === 0;

  const finalConfirmationUi =
    SAFE_SCAFFOLD_FINAL_CONFIRMATION_UI_LABELS[
      safeScaffoldFinalConfirmation.uiStatus
    ];
  const confirmationPreconditionsMet =
    !safeScaffoldFinalConfirmation.busy &&
    safeScaffoldFinalConfirmation.readinessBlockedReasons.length === 0;
  const confirmationLocked =
    Boolean(safeScaffoldFinalConfirmation.saved) &&
    !safeScaffoldFinalConfirmation.saved?.stale;

  const [ackBoundaries, setAckBoundaries] = useState(false);
  const [ackStage127, setAckStage127] = useState(false);
  const [ackCaution, setAckCaution] = useState(false);

  useEffect(() => {
    const saved = safeScaffoldFinalConfirmation.saved;
    if (saved && !saved.stale) {
      setAckBoundaries(saved.acknowledgements.futureWriteBoundaries);
      setAckStage127(saved.acknowledgements.stage127NoWrite);
      setAckCaution(saved.acknowledgements.cautionTarget);
      return;
    }
    setAckBoundaries(false);
    setAckStage127(false);
    setAckCaution(false);
  }, [
    safeScaffoldFinalConfirmation.saved?.confirmedAt,
    safeScaffoldFinalConfirmation.saved?.stale,
    safeScaffoldFinalConfirmation.saved,
  ]);

  const requiresCautionAck = safeScaffoldFinalConfirmation.requiresCautionAck;
  const acksComplete =
    ackBoundaries &&
    ackStage127 &&
    (!requiresCautionAck || ackCaution);
  const canClickRecord =
    confirmationPreconditionsMet && acksComplete && !confirmationLocked;

  return (
    <div className="tab-panel" role="tabpanel" aria-label="Build">
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Safe Scaffold Mode</h2>
          <p className="panel-subtitle">
            Target folder readiness, previews, write-manifest preview, and final
            confirmation gate only. NTTC does not write files in this stage.
          </p>
        </div>
        <div className="panel-body stack">
          <div
            className="onedrive-warning"
            role="status"
            data-focus-id="build-mode-status"
          >
            {BUILD_MODE_INACTIVE_BANNER.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>

          <div data-focus-id="build-mode-safety-charter">
            <div className="field-label">Build Mode Status</div>
            <div className="field-value">
              Build Mode Status: <strong>{BUILD_MODE_STATUS_LABEL}</strong>
            </div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              {BUILD_MODE_STATUS_EXPLAIN}
            </p>
          </div>

          <div className="section-divider" />

          <div data-focus-id="build-mode-target-folder">
            <div className="field-label">Safe Scaffold Target Folder</div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              Select a future scaffold target folder. Assessment uses shallow
              folder metadata only. No files are created.
            </p>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                type="button"
                className="action-btn primary"
                onClick={() => void onSelectTargetFolder()}
                disabled={safeScaffoldTarget.busy}
              >
                Select Target Folder
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onClearTargetFolder()}
                disabled={
                  safeScaffoldTarget.busy || !safeScaffoldTarget.selectedPath
                }
              >
                Clear Target Folder
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onRefreshTargetSafety()}
                disabled={
                  safeScaffoldTarget.busy || !safeScaffoldTarget.selectedPath
                }
              >
                Refresh Folder Safety Check
              </button>
            </div>

            <div
              className="onedrive-warning"
              role="status"
              style={{ marginTop: "0.75rem" }}
            >
              <div className="field-label" style={{ marginBottom: "0.25rem" }}>
                Folder Safety Status
              </div>
              <div className="field-value">
                <strong>{uiLabel}</strong>
              </div>
            </div>

            <div className="field-value" style={{ marginTop: "0.5rem" }}>
              Selected Target Folder:{" "}
              <strong>{safeScaffoldTarget.selectedPath ?? "none"}</strong>
            </div>
            <div className="field-value">
              Folder Safety: <strong>{safetyLabel}</strong>
              {safeScaffoldTarget.stale ? (
                <span className="muted"> (stale — refresh recommended)</span>
              ) : null}
            </div>
            <div className="field-value">
              Future write readiness:{" "}
              <strong>{SAFE_SCAFFOLD_FUTURE_WRITE_READINESS}</strong>
            </div>
            <div className="field-label" style={{ marginTop: "0.5rem" }}>
              Reasons
            </div>
            {safeScaffoldTarget.lastCheck?.reasons?.length ? (
              <ul className="workflow-list">
                {safeScaffoldTarget.lastCheck.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="field-value muted">No check result yet.</p>
            )}
            <div className="field-label" style={{ marginTop: "0.35rem" }}>
              Detected entries summary
            </div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              {entrySummaryText}
            </p>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              {SAFE_SCAFFOLD_FILE_CREATION_NOT_ENABLED_YET}
            </p>
            {safeScaffoldTarget.statusMessage ? (
              <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
                {safeScaffoldTarget.statusMessage}
              </p>
            ) : null}
          </div>

          <div className="section-divider" />

          <div data-focus-id="build-mode-file-tree-preview">
            <div className="field-label">Safe Scaffold File Tree Preview</div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              Deterministic proposed relative paths only. No file contents. No
              files are created.
            </p>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                type="button"
                className="action-btn primary"
                onClick={() => void onGenerateFileTreePreview()}
                disabled={!canClickGenerateTree}
              >
                Generate File Tree Preview
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onCopyFileTreePreview()}
                disabled={
                  safeScaffoldFileTreePreview.busy ||
                  !safeScaffoldFileTreePreview.saved?.markdown
                }
              >
                Copy File Tree Preview
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onClearFileTreePreview()}
                disabled={
                  safeScaffoldFileTreePreview.busy ||
                  !safeScaffoldFileTreePreview.saved
                }
              >
                Clear File Tree Preview
              </button>
            </div>

            <div
              className="onedrive-warning"
              role="status"
              style={{ marginTop: "0.75rem" }}
            >
              <div className="field-label" style={{ marginBottom: "0.25rem" }}>
                File Tree Preview Status
              </div>
              <div className="field-value">
                <strong>{fileTreeUi}</strong>
              </div>
            </div>

            {safeScaffoldFileTreePreview.readinessBlockedReasons.length > 0 &&
            !safeScaffoldFileTreePreview.saved ? (
              <div style={{ marginTop: "0.5rem" }}>
                <div className="field-label">Not ready</div>
                <ul className="workflow-list">
                  {safeScaffoldFileTreePreview.readinessBlockedReasons.map(
                    (reason) => (
                      <li key={reason}>{reason}</li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {safeScaffoldFileTreePreview.saved ? (
              <>
                <div className="field-value" style={{ marginTop: "0.5rem" }}>
                  Generated:{" "}
                  <strong>
                    {safeScaffoldFileTreePreview.saved.generatedAt}
                  </strong>
                  {safeScaffoldFileTreePreview.saved.stale ? (
                    <span className="muted"> (stale)</span>
                  ) : null}
                </div>
                <div className="field-value">
                  Paths:{" "}
                  <strong>
                    {
                      safeScaffoldFileTreePreview.saved.proposedRelativePaths
                        .length
                    }
                  </strong>
                </div>
                <div className="field-value">
                  Target safety at generation:{" "}
                  <strong>
                    {safeScaffoldFileTreePreview.saved.sourceTargetSafetyStatus}
                  </strong>
                </div>
                {safeScaffoldFileTreePreview.saved.warnings.length > 0 ? (
                  <ul className="workflow-list">
                    {safeScaffoldFileTreePreview.saved.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="field-label" style={{ marginTop: "0.5rem" }}>
                  Preview markdown
                </div>
                <pre
                  className="code-block"
                  style={{
                    whiteSpace: "pre-wrap",
                    maxHeight: "22rem",
                    overflow: "auto",
                    fontSize: "0.8rem",
                  }}
                >
                  {safeScaffoldFileTreePreview.saved.markdown}
                </pre>
              </>
            ) : (
              <p className="field-value muted" style={{ marginTop: "0.5rem" }}>
                {SAFE_SCAFFOLD_FILE_TREE_PREVIEW_ONLY}{" "}
                {SAFE_SCAFFOLD_FILE_TREE_NO_CONTENTS_YET}
              </p>
            )}
            {safeScaffoldFileTreePreview.statusMessage ? (
              <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
                {safeScaffoldFileTreePreview.statusMessage}
              </p>
            ) : null}
          </div>

          <div className="section-divider" />

          <div data-focus-id="build-mode-file-content-preview">
            <div className="field-label">Safe Scaffold File Content Preview</div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              Deterministic starter templates in memory only. No files are
              created. NTTC will not run package scripts.
            </p>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                type="button"
                className="action-btn primary"
                onClick={() => void onGenerateFileContentPreview()}
                disabled={!canClickGenerateContent}
              >
                Generate File Content Preview
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onCopyFileContentPreview()}
                disabled={
                  safeScaffoldFileContentPreview.busy ||
                  !safeScaffoldFileContentPreview.saved?.markdown
                }
              >
                Copy File Content Preview
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onClearFileContentPreview()}
                disabled={
                  safeScaffoldFileContentPreview.busy ||
                  !safeScaffoldFileContentPreview.saved
                }
              >
                Clear File Content Preview
              </button>
            </div>

            <div
              className="onedrive-warning"
              role="status"
              style={{ marginTop: "0.75rem" }}
            >
              <div className="field-label" style={{ marginBottom: "0.25rem" }}>
                File Content Preview Status
              </div>
              <div className="field-value">
                <strong>{fileContentUi}</strong>
              </div>
            </div>

            {safeScaffoldFileContentPreview.readinessBlockedReasons.length >
              0 && !safeScaffoldFileContentPreview.saved ? (
              <div style={{ marginTop: "0.5rem" }}>
                <div className="field-label">Not ready</div>
                <ul className="workflow-list">
                  {safeScaffoldFileContentPreview.readinessBlockedReasons.map(
                    (reason) => (
                      <li key={reason}>{reason}</li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {safeScaffoldFileContentPreview.saved ? (
              <>
                <div className="field-value" style={{ marginTop: "0.5rem" }}>
                  Generated:{" "}
                  <strong>
                    {safeScaffoldFileContentPreview.saved.generatedAt}
                  </strong>
                  {safeScaffoldFileContentPreview.saved.stale ? (
                    <span className="muted"> (stale)</span>
                  ) : null}
                </div>
                <div className="field-value">
                  Templated files:{" "}
                  <strong>
                    {safeScaffoldFileContentPreview.saved.templatedFiles.length}
                  </strong>
                </div>
                <div className="field-value">
                  Without contents yet:{" "}
                  <strong>
                    {
                      safeScaffoldFileContentPreview.saved.filesWithoutContents
                        .length
                    }
                  </strong>
                </div>
                <div className="field-value">
                  Target safety at generation:{" "}
                  <strong>
                    {
                      safeScaffoldFileContentPreview.saved
                        .sourceTargetSafetyStatus
                    }
                  </strong>
                </div>
                {safeScaffoldFileContentPreview.saved.warnings.length > 0 ? (
                  <ul className="workflow-list">
                    {safeScaffoldFileContentPreview.saved.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="field-label" style={{ marginTop: "0.5rem" }}>
                  Preview markdown
                </div>
                <pre
                  className="code-block"
                  style={{
                    whiteSpace: "pre-wrap",
                    maxHeight: "28rem",
                    overflow: "auto",
                    fontSize: "0.8rem",
                  }}
                >
                  {safeScaffoldFileContentPreview.saved.markdown}
                </pre>
              </>
            ) : (
              <p className="field-value muted" style={{ marginTop: "0.5rem" }}>
                {SAFE_SCAFFOLD_FILE_CONTENT_PREVIEW_ONLY}
              </p>
            )}
            {safeScaffoldFileContentPreview.statusMessage ? (
              <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
                {safeScaffoldFileContentPreview.statusMessage}
              </p>
            ) : null}
          </div>

          <div className="section-divider" />

          <div data-focus-id="build-mode-write-manifest-preview">
            <div className="field-label">Safe Scaffold Write Manifest Preview</div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              Deterministic future-write plan in memory only. No files are
              created. Record final confirmation in the section below.
            </p>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                type="button"
                className="action-btn primary"
                onClick={() => void onGenerateWriteManifestPreview()}
                disabled={!canClickGenerateManifest}
              >
                Generate Write Manifest Preview
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onCopyWriteManifestPreview()}
                disabled={
                  safeScaffoldWriteManifestPreview.busy ||
                  !safeScaffoldWriteManifestPreview.saved?.markdown
                }
              >
                Copy Write Manifest Preview
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onClearWriteManifestPreview()}
                disabled={
                  safeScaffoldWriteManifestPreview.busy ||
                  !safeScaffoldWriteManifestPreview.saved
                }
              >
                Clear Write Manifest Preview
              </button>
            </div>

            <div
              className="onedrive-warning"
              role="status"
              style={{ marginTop: "0.75rem" }}
            >
              <div className="field-label" style={{ marginBottom: "0.25rem" }}>
                Write Manifest Preview Status
              </div>
              <div className="field-value">
                <strong>{writeManifestUi}</strong>
              </div>
            </div>

            {safeScaffoldWriteManifestPreview.readinessBlockedReasons.length >
              0 && !safeScaffoldWriteManifestPreview.saved ? (
              <div style={{ marginTop: "0.5rem" }}>
                <div className="field-label">Not ready</div>
                <ul className="workflow-list">
                  {safeScaffoldWriteManifestPreview.readinessBlockedReasons.map(
                    (reason) => (
                      <li key={reason}>{reason}</li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {safeScaffoldWriteManifestPreview.saved ? (
              <>
                <div className="field-value" style={{ marginTop: "0.5rem" }}>
                  Generated:{" "}
                  <strong>
                    {safeScaffoldWriteManifestPreview.saved.generatedAt}
                  </strong>
                  {safeScaffoldWriteManifestPreview.saved.stale ? (
                    <span className="muted"> (stale)</span>
                  ) : null}
                </div>
                <div className="field-value">
                  Ready to create:{" "}
                  <strong>
                    {
                      safeScaffoldWriteManifestPreview.saved.readyToCreate
                        .length
                    }
                  </strong>
                </div>
                <div className="field-value">
                  Not ready:{" "}
                  <strong>
                    {safeScaffoldWriteManifestPreview.saved.notReady.length}
                  </strong>
                </div>
                <div className="field-value">
                  Target safety at generation:{" "}
                  <strong>
                    {
                      safeScaffoldWriteManifestPreview.saved
                        .sourceTargetSafetyStatus
                    }
                  </strong>
                </div>
                {safeScaffoldWriteManifestPreview.saved.warnings.length > 0 ? (
                  <ul className="workflow-list">
                    {safeScaffoldWriteManifestPreview.saved.warnings.map(
                      (w) => (
                        <li key={w}>{w}</li>
                      ),
                    )}
                  </ul>
                ) : null}
                <div className="field-label" style={{ marginTop: "0.5rem" }}>
                  Preview markdown
                </div>
                <pre
                  className="code-block"
                  style={{
                    whiteSpace: "pre-wrap",
                    maxHeight: "28rem",
                    overflow: "auto",
                    fontSize: "0.8rem",
                  }}
                >
                  {safeScaffoldWriteManifestPreview.saved.markdown}
                </pre>
              </>
            ) : (
              <p className="field-value muted" style={{ marginTop: "0.5rem" }}>
                {SAFE_SCAFFOLD_WRITE_MANIFEST_PREVIEW_ONLY}
              </p>
            )}
            {safeScaffoldWriteManifestPreview.statusMessage ? (
              <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
                {safeScaffoldWriteManifestPreview.statusMessage}
              </p>
            ) : null}
          </div>

          <div className="section-divider" />

          <div data-focus-id="build-mode-final-confirmation">
            <div className="field-label">Safe Scaffold Final Confirmation</div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              Explicit readiness gate for a future write stage. Recording
              confirmation does not create files.
            </p>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                type="button"
                className="action-btn primary"
                onClick={() =>
                  void onRecordFinalConfirmation({
                    futureWriteBoundaries: ackBoundaries,
                    stage127NoWrite: ackStage127,
                    cautionTarget: ackCaution,
                  })
                }
                disabled={!canClickRecord}
              >
                Review Final Confirmation
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onCopyFinalConfirmation()}
                disabled={
                  safeScaffoldFinalConfirmation.busy ||
                  !safeScaffoldFinalConfirmation.saved?.markdown
                }
              >
                Copy Confirmation Summary
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => void onClearFinalConfirmation()}
                disabled={
                  safeScaffoldFinalConfirmation.busy ||
                  !safeScaffoldFinalConfirmation.saved
                }
              >
                Clear Final Confirmation
              </button>
              <button
                type="button"
                className="action-btn"
                disabled
                title={SAFE_SCAFFOLD_WRITE_FILES_DISABLED_LABEL}
              >
                {SAFE_SCAFFOLD_WRITE_FILES_DISABLED_LABEL}
              </button>
            </div>

            <div
              className="onedrive-warning"
              role="status"
              style={{ marginTop: "0.75rem" }}
            >
              <div className="field-label" style={{ marginBottom: "0.25rem" }}>
                Final Confirmation Status
              </div>
              <div className="field-value">
                <strong>{finalConfirmationUi}</strong>
              </div>
              {safeScaffoldFinalConfirmation.saved &&
              !safeScaffoldFinalConfirmation.saved.stale ? (
                <>
                  <p className="field-value" style={{ marginTop: "0.35rem" }}>
                    {SAFE_SCAFFOLD_FINAL_CONFIRMATION_RECORDED}
                  </p>
                  <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
                    {SAFE_SCAFFOLD_FINAL_CONFIRMATION_STILL_DISABLED}
                  </p>
                </>
              ) : null}
              {safeScaffoldFinalConfirmation.saved?.stale ? (
                <p className="field-value" style={{ marginTop: "0.35rem" }}>
                  {SAFE_SCAFFOLD_FINAL_CONFIRMATION_STALE_MESSAGE}
                </p>
              ) : null}
            </div>

            {safeScaffoldFinalConfirmation.readinessBlockedReasons.length > 0 &&
            !safeScaffoldFinalConfirmation.saved ? (
              <div style={{ marginTop: "0.5rem" }}>
                <div className="field-label">Not ready</div>
                <ul className="workflow-list">
                  {safeScaffoldFinalConfirmation.readinessBlockedReasons.map(
                    (reason) => (
                      <li key={reason}>{reason}</li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            <div
              className="onedrive-warning"
              role="note"
              style={{ marginTop: "0.75rem" }}
            >
              <div className="field-label" style={{ marginBottom: "0.35rem" }}>
                Required acknowledgements
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={ackBoundaries}
                  disabled={!confirmationPreconditionsMet || confirmationLocked}
                  onChange={(e) => setAckBoundaries(e.target.checked)}
                />
                <span className="field-value" style={{ fontSize: "0.85rem" }}>
                  {SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_BOUNDARIES}
                </span>
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={ackStage127}
                  disabled={!confirmationPreconditionsMet || confirmationLocked}
                  onChange={(e) => setAckStage127(e.target.checked)}
                />
                <span className="field-value" style={{ fontSize: "0.85rem" }}>
                  {SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_STAGE127}
                </span>
              </label>
              {requiresCautionAck ? (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ackCaution}
                    disabled={!confirmationPreconditionsMet || confirmationLocked}
                    onChange={(e) => setAckCaution(e.target.checked)}
                  />
                  <span className="field-value" style={{ fontSize: "0.85rem" }}>
                    {SAFE_SCAFFOLD_FINAL_CONFIRMATION_ACK_CAUTION}
                  </span>
                </label>
              ) : null}
            </div>

            {safeScaffoldFinalConfirmation.saved ? (
              <>
                <div className="field-value" style={{ marginTop: "0.5rem" }}>
                  Confirmed:{" "}
                  <strong>
                    {safeScaffoldFinalConfirmation.saved.confirmedAt}
                  </strong>
                  {safeScaffoldFinalConfirmation.saved.stale ? (
                    <span className="muted"> (stale)</span>
                  ) : null}
                </div>
                <div className="field-value">
                  Ready to create:{" "}
                  <strong>
                    {safeScaffoldFinalConfirmation.saved.readyToCreateCount}
                  </strong>
                </div>
                <div className="field-value">
                  Not ready:{" "}
                  <strong>
                    {safeScaffoldFinalConfirmation.saved.notReadyCount}
                  </strong>
                </div>
                <div className="field-value">
                  Target safety at confirmation:{" "}
                  <strong>
                    {
                      safeScaffoldFinalConfirmation.saved
                        .sourceTargetSafetyStatus
                    }
                  </strong>
                </div>
                {safeScaffoldFinalConfirmation.saved.warnings.length > 0 ? (
                  <ul className="workflow-list">
                    {safeScaffoldFinalConfirmation.saved.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="field-label" style={{ marginTop: "0.5rem" }}>
                  Confirmation summary
                </div>
                <pre
                  className="code-block"
                  style={{
                    whiteSpace: "pre-wrap",
                    maxHeight: "28rem",
                    overflow: "auto",
                    fontSize: "0.8rem",
                  }}
                >
                  {safeScaffoldFinalConfirmation.saved.markdown}
                </pre>
              </>
            ) : (
              <p className="field-value muted" style={{ marginTop: "0.5rem" }}>
                {SAFE_SCAFFOLD_FINAL_CONFIRMATION_STILL_DISABLED}
              </p>
            )}
            {safeScaffoldFinalConfirmation.statusMessage ? (
              <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
                {safeScaffoldFinalConfirmation.statusMessage}
              </p>
            ) : null}
          </div>

          <div className="section-divider" />

          <div>
            <div className="field-label">Safety Charter</div>
            <p className="field-value muted" style={{ fontSize: "0.85rem" }}>
              Safe Scaffold Mode rules:
            </p>
            <ul className="workflow-list">
              {BUILD_MODE_SAFETY_CHARTER_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="section-divider" />

          <div>
            <div className="field-label">Future Safe Scaffold Requirements</div>
            <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
              Checklist reflects Blueprint, target-folder, previews,
              write-manifest, and final confirmation readiness. No write actions
              are available yet.
            </p>
            <ul
              className="workflow-list"
              style={{ listStyle: "none", paddingLeft: 0 }}
            >
              {FUTURE_SAFE_SCAFFOLD_REQUIREMENTS.map((item) => {
                const satisfied = Boolean(
                  readiness.checklistSatisfied[item.id],
                );
                const isFutureOnly = laterOnlyIds.has(item.id);
                return (
                  <li key={item.id} className="field-value">
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={satisfied}
                        disabled
                        readOnly
                        aria-disabled="true"
                      />
                      <span>
                        {item.label}
                        {isFutureOnly && !satisfied ? (
                          <span className="muted"> (later stage)</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
              Required before scaffold write: all of the above. File creation is
              not enabled in this stage.
            </p>
          </div>

          <div className="section-divider" />

          <div>
            <div className="field-label">Current Blueprint Readiness</div>
            <div className="field-value">
              Blueprint: <strong>{readiness.blueprintPresence}</strong>
            </div>
            <div className="field-value">
              Completeness: <strong>{readiness.completenessLabel}</strong>
            </div>
            <div className="field-value">
              Task Cards: <strong>{readiness.taskCardsLabel}</strong>
            </div>
          </div>

          <div className="section-divider" />

          <div className="onedrive-warning" role="alert">
            <div className="field-label" style={{ marginBottom: "0.35rem" }}>
              What NTTC Will Not Do
            </div>
            <div>This Build tab does not:</div>
            <ul>
              {BUILD_MODE_WILL_NOT_DO.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="section-divider" />

          <div>
            <div className="field-label">Next Step</div>
            <p className="field-value">{readiness.nextStepText}</p>
            {readiness.nextStepKind === "create-blueprint" ||
            readiness.nextStepKind === "generate-task-cards" ? (
              <button
                type="button"
                className="action-btn primary"
                onClick={onOpenBlueprint}
              >
                Open Blueprint Tab
              </button>
            ) : (
              <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
                No Create Files, Scaffold, Write, Install, or Run controls exist
                yet.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
