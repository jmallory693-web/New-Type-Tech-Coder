import {
  QUICK_START_GUIDE_SECTIONS,
  QUICK_START_GUIDE_TITLE,
} from "../../shared/quickStartGuide";

const SAFETY_FOOTER =
  "Safety reminder: NTTC has not applied any patch. All drafts are proposals.";

export function QuickStartGuidePanel({
  onCopy,
  copyState,
}: {
  onCopy: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  return (
    <div className="quick-start-guide" data-focus-id="quick-start-guide">
      <div className="quick-start-guide-header">
        <h2 className="quick-start-guide-title">{QUICK_START_GUIDE_TITLE}</h2>
        <p className="quick-start-guide-lead">
          A plain-English guide for using New Type Tech Coder safely. This guide
          is built into the app — it does not read your project or call AI.
        </p>
        <div className="quick-start-guide-actions">
          <button type="button" className="btn btn-primary" onClick={onCopy}>
            <span className="btn-label">Copy Quick Start Guide</span>
            <span className="btn-hint">
              {copyState === "copied"
                ? "Copied to clipboard"
                : copyState === "failed"
                  ? "Copy failed — try again"
                  : "Copies concise markdown — no project data"}
            </span>
          </button>
        </div>
      </div>

      <div className="quick-start-guide-sections">
        {QUICK_START_GUIDE_SECTIONS.map((section) => (
          <section
            key={section.id}
            className="quick-start-guide-section"
            aria-labelledby={`guide-${section.id}`}
          >
            <h3
              id={`guide-${section.id}`}
              className="quick-start-guide-section-title"
            >
              {section.title}
            </h3>
            {section.paragraphs.map((paragraph, index) =>
              paragraph.trim() ? (
                <p
                  key={`${section.id}-p-${index}`}
                  className="quick-start-guide-p"
                >
                  {paragraph}
                </p>
              ) : null,
            )}
            {section.numbered?.length ? (
              <ol className="quick-start-guide-list">
                {section.numbered.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : null}
            {section.bullets?.length ? (
              <ul className="quick-start-guide-list">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <p className="quick-start-guide-footer" role="note">
        {SAFETY_FOOTER}
      </p>
    </div>
  );
}
