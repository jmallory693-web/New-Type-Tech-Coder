import type { BlueprintState } from "../../shared/types";
import type { SafeScaffoldTargetState } from "../../shared/buildModeTargetSafety";
import type { SafeScaffoldFileTreePreviewState } from "../../shared/buildModeFileTreePreview";
import type { SafeScaffoldFileContentPreviewState } from "../../shared/buildModeFileContentPreview";
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

/** Stage 117–123: Build Mode — readiness + file-tree + file-content preview only. */
export function BuildModeTab({
  blueprint,
  safeScaffoldTarget,
  safeScaffoldFileTreePreview,
  safeScaffoldFileContentPreview,
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
}: {
  blueprint: BlueprintState;
  safeScaffoldTarget: SafeScaffoldTargetState;
  safeScaffoldFileTreePreview: SafeScaffoldFileTreePreviewState;
  safeScaffoldFileContentPreview: SafeScaffoldFileContentPreviewState;
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
}) {
  const readiness = deriveBuildModeReadiness(
    blueprint,
    safeScaffoldTarget,
    safeScaffoldFileTreePreview,
    safeScaffoldFileContentPreview,
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
    "user-confirmed-write",
    "written-files-manifest",
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

  return (
    <div className="tab-panel" role="tabpanel" aria-label="Build">
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Safe Scaffold Mode</h2>
          <p className="panel-subtitle">
            Target folder readiness, file-tree preview, and file-content preview
            only. NTTC does not write files in this stage.
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
              Checklist reflects Blueprint, target-folder, file-tree, and
              file-content preview readiness. No write actions are available
              yet.
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
