// ProcessingView.jsx — the loading screen shown while the backend extracts
// characters. The backend call is a single synchronous request (no streaming
// yet), so the per-stage labels below advance on a timer to communicate what
// the pipeline is doing rather than reflecting exact server progress.

import { useEffect, useState } from "react";

// Written as a get-in rather than a progress log: each label names a thing a
// theatre does before a performance, in the order the pipeline actually does
// its equivalent (read → roster → index → ground → ready).
const STAGES = [
  "Reading the script…",
  "Printing cast list…",
  "Building the set…",
  "Setting the stage…",
  "Focusing the spotlights…",
];

export default function ProcessingView({ title, error, onBack }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (error) return;
    // Advance through the labels, holding on the last one until the request
    // resolves (extraction on a full novel can take a while).
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 2600);
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="mc-screen mc-loader-page">
        <div className="mc-loader-card">
          <div className="mc-err-icon">⚠</div>
          <h2 className="mc-err-title">Extraction failed</h2>
          <p className="mc-err-text">{error}</p>
          <button className="mc-btn mc-btn--accent" onClick={onBack}>
            ← Back to upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mc-screen mc-loader-page">
      <div className="mc-loader-card">
        <div className="mc-spin" />
        <h2 className="mc-loader-title">
          Calling the cast of {title ? `“${title}”` : "your manuscript"}
        </h2>
        <p className="mc-loader-stage">{STAGES[stage]}</p>

        <div className="mc-steps">
          {STAGES.map((label, i) => (
            <div key={label} className="mc-step-row">
              <span
                className={
                  "mc-step-dot" +
                  (i < stage ? " is-done" : i === stage ? " is-active" : "")
                }
              >
                {i < stage ? "✓" : ""}
              </span>
              <span className={"mc-step-label" + (i <= stage ? " is-active" : "")}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <p className="mc-hint">
          This can take a minute on a full-length manuscript — hang tight.
        </p>
      </div>
    </div>
  );
}
