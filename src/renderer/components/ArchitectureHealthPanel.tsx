import type { ArchitectureHealthState } from "../../shared/types";
import {
  ARCHITECTURE_HEALTH_MAX_FILES,
  ARCHITECTURE_HEALTH_PURPOSE,
  ARCHITECTURE_HEALTH_REPORT_TITLE,
} from "../../shared/architectureHealth/architectureHealthConstants";

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

export function ArchitectureHealthPanel({
  architectureHealth,
  hasProject,
  onGenerate,
  onCopy,
  onClear,
  onIncludeTestFilesChange,
  onIncludeMarkdownDocsChange,
  copyState,
}: {
  architectureHealth: ArchitectureHealthState;
  hasProject: boolean;
  onGenerate: () => void;
  onCopy: () => void;
  onClear: () => void;
  onIncludeTestFilesChange: (include: boolean) => void;
  onIncludeMarkdownDocsChange: (include: boolean) => void;
  copyState: "idle" | "copied" | "failed";
}) {
  const saved = architectureHealth.saved;
  const busy = architectureHealth.busy;

  return (
    <div className="stack" data-focus-id="architecture-health">
      <div className="field-label">Architecture Health</div>
      <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
        {ARCHITECTURE_HEALTH_PURPOSE}
      </p>

      <label className="field-label" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={architectureHealth.includeTestFiles}
          disabled={!hasProject || busy}
          onChange={(e) => onIncludeTestFilesChange(e.target.checked)}
        />
        Include test files
      </label>

      <label className="field-label" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={architectureHealth.includeMarkdownDocs}
          disabled={!hasProject || busy}
          onChange={(e) => onIncludeMarkdownDocsChange(e.target.checked)}
        />
        Include markdown/docs
      </label>

      <p className="field-value muted" style={{ fontSize: "0.82rem" }}>
        Max files scanned: {ARCHITECTURE_HEALTH_MAX_FILES.toLocaleString()} (safe cap)
      </p>

      <div className="stack">
        <ActionButton
          label="Generate Architecture Health Report"
          hint={
            busy
              ? "Scanning safe file metadata…"
              : "Builds a metadata-only monolith risk report (no source bodies, no AI)"
          }
          primary
          disabled={!hasProject || busy}
          onClick={onGenerate}
        />
        <ActionButton
          label="Copy Architecture Health Report"
          hint={
            copyState === "copied"
              ? "Copied Architecture Health Report"
              : copyState === "failed"
                ? "Copy failed — try again"
                : "Copy metadata report for outside review"
          }
          disabled={!saved}
          onClick={onCopy}
        />
        <ActionButton
          label="Clear Architecture Health Report"
          hint="Remove the stored architecture health report"
          disabled={!saved}
          onClick={onClear}
        />
      </div>

      {architectureHealth.statusMessage ? (
        <p className="field-value muted blueprint-status-line">
          {architectureHealth.statusMessage}
        </p>
      ) : null}

      {saved ? (
        <>
          <div className="field-value" style={{ fontSize: "0.82rem" }}>
            {ARCHITECTURE_HEALTH_REPORT_TITLE.replace("# ", "")} ·{" "}
            {new Date(saved.generatedAt).toLocaleString()} · {saved.fileCountScanned}{" "}
            file(s) scanned
            {saved.stale ? " · stale" : ""}
          </div>
          <div className="field-value muted" style={{ fontSize: "0.82rem" }}>
            Largest: {saved.largestFilePath ?? "n/a"} ({saved.largestFileLineCount}{" "}
            lines) · Critical: {saved.criticalCount} · Warnings: {saved.warningCount}{" "}
            · {saved.recommendation}
          </div>
          <div
            className="review-preview"
            aria-label="Architecture Health Report preview"
          >
            {saved.previewExcerpt}
            {saved.previewExcerpt.length < saved.markdown.length ? "\n…" : ""}
          </div>
        </>
      ) : null}
    </div>
  );
}
