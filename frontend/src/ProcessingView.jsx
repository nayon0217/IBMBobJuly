// ProcessingView.jsx — the loading screen shown while the backend extracts
// characters. The backend call is a single synchronous request (no streaming
// yet), so the per-stage labels below advance on a timer to communicate what
// the pipeline is doing rather than reflecting exact server progress.

import { useEffect, useState } from "react";

const STAGES = [
  "Reading your manuscript…",
  "Splitting it into scenes…",
  "Building the vector index…",
  "Discovering characters…",
  "Merging names and aliases…",
  "Grounding persona cards in the text…",
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
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>⚠</div>
          <h2 style={styles.errorTitle}>Extraction failed</h2>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.backBtn} onClick={onBack}>
            ← Back to upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <h2 style={styles.title}>
          Bringing {title ? `“${title}”` : "your manuscript"} to life
        </h2>
        <p style={styles.stageText}>{STAGES[stage]}</p>

        <div style={styles.steps}>
          {STAGES.map((label, i) => (
            <div key={label} style={styles.stepRow}>
              <span
                style={{
                  ...styles.stepDot,
                  ...(i < stage
                    ? styles.stepDone
                    : i === stage
                    ? styles.stepActive
                    : {}),
                }}
              >
                {i < stage ? "✓" : ""}
              </span>
              <span
                style={{
                  ...styles.stepLabel,
                  ...(i <= stage ? styles.stepLabelActive : {}),
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <p style={styles.hint}>
          This can take a minute on a full-length manuscript — hang tight.
        </p>
      </div>

      <style>{keyframes}</style>
    </div>
  );
}

const keyframes = `
@keyframes mc-spin { to { transform: rotate(360deg); } }
@keyframes mc-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f8fa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    color: "#1f2328",
    lineHeight: 1.6,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "2.5rem",
    width: "100%",
    maxWidth: 480,
    textAlign: "center",
    boxSizing: "border-box",
  },
  spinner: {
    width: 44,
    height: 44,
    margin: "0 auto 1.25rem",
    borderRadius: "50%",
    border: "3px solid #e5e7eb",
    borderTopColor: "#3b82d4",
    animation: "mc-spin 0.9s linear infinite",
  },
  title: {
    margin: "0 0 0.35rem",
    fontSize: "1.2rem",
    fontWeight: 700,
  },
  stageText: {
    margin: "0 0 1.5rem",
    color: "#3b82d4",
    fontWeight: 500,
    fontSize: "0.95rem",
    animation: "mc-pulse 1.6s ease-in-out infinite",
  },
  steps: {
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    maxWidth: 320,
    margin: "0 auto",
  },
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: "2px solid #d0d7de",
    color: "#fff",
    fontSize: "0.7rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepDone: {
    background: "#2d7d46",
    borderColor: "#2d7d46",
  },
  stepActive: {
    borderColor: "#3b82d4",
    boxShadow: "0 0 0 3px rgba(59,130,212,0.15)",
  },
  stepLabel: {
    fontSize: "0.85rem",
    color: "#8c959f",
  },
  stepLabelActive: {
    color: "#1f2328",
  },
  hint: {
    marginTop: "1.75rem",
    marginBottom: 0,
    fontSize: "0.8rem",
    color: "#8c959f",
  },
  errorIcon: {
    fontSize: "2rem",
    color: "#cf222e",
    marginBottom: "0.5rem",
  },
  errorTitle: {
    margin: "0 0 0.5rem",
    fontSize: "1.15rem",
    fontWeight: 700,
  },
  errorText: {
    color: "#57606a",
    fontSize: "0.9rem",
    margin: "0 0 1.5rem",
    wordBreak: "break-word",
  },
  backBtn: {
    background: "#1f2328",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.6rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
