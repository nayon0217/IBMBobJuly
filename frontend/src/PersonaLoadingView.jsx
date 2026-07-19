// PersonaLoadingView.jsx — shown while persona cards are grounded on demand
// (Stage 4), which now runs when the writer enters a chat or scene instead of
// during upload. Character grounding is one LLM call each, so this can take a
// moment; the labels below advance on a timer to communicate progress.

import { useEffect, useState } from "react";
import { T } from "./theme";

export default function PersonaLoadingView({ names = [], mode = "chat", error, onBack }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>⚠</div>
          <h2 style={styles.errorTitle}>Couldn't build the persona{names.length > 1 ? "s" : ""}</h2>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.backBtn} onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  const label = names.length ? names.join(", ") : "your characters";
  const messages = [
    `Reading the manuscript for ${label}…`,
    "Retrieving their key scenes…",
    "Writing persona cards grounded in the text…",
    "Almost there…",
  ];
  const message = messages[Math.min(tick, messages.length - 1)];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <h2 style={styles.title}>
          {mode === "scene" ? "Preparing the stage" : "Getting into character"}
        </h2>
        <p style={styles.who}>{label}</p>
        <p style={styles.message}>{message}</p>
        <p style={styles.hint}>
          Grounding each character in the manuscript — this only happens the
          first time you open them.
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
    background: T.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    fontFamily: T.font,
    color: T.ink,
    lineHeight: 1.6,
  },
  card: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusLg,
    padding: "2.5rem",
    width: "100%",
    maxWidth: 460,
    textAlign: "center",
    boxSizing: "border-box",
    boxShadow: "0 8px 30px rgba(60,50,90,0.05)",
  },
  spinner: {
    width: 44,
    height: 44,
    margin: "0 auto 1.25rem",
    borderRadius: "50%",
    border: `3px solid ${T.border}`,
    borderTopColor: T.accent,
    animation: "mc-spin 0.9s linear infinite",
  },
  title: { margin: "0 0 0.15rem", fontSize: "1.2rem", fontWeight: 700 },
  who: { margin: "0 0 1.25rem", color: T.inkMuted, fontSize: "0.9rem", fontWeight: 600 },
  message: {
    margin: "0 0 1.5rem",
    color: T.accent,
    fontWeight: 500,
    fontSize: "0.95rem",
    animation: "mc-pulse 1.6s ease-in-out infinite",
  },
  hint: { marginTop: 0, marginBottom: 0, fontSize: "0.8rem", color: T.inkMuted },
  errorIcon: { fontSize: "2rem", color: T.danger, marginBottom: "0.5rem" },
  errorTitle: { margin: "0 0 0.5rem", fontSize: "1.15rem", fontWeight: 700 },
  errorText: {
    color: T.inkSoft,
    fontSize: "0.9rem",
    margin: "0 0 1.5rem",
    wordBreak: "break-word",
  },
  backBtn: {
    background: T.accent,
    color: "#fff",
    border: "none",
    borderRadius: T.radius,
    padding: "0.6rem 1.4rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
