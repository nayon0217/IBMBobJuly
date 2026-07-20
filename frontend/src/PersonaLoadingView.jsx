// PersonaLoadingView.jsx — shown while persona cards are grounded on demand
// (Stage 4), which now runs when the writer enters a chat or scene instead of
// during upload. Character grounding is one LLM call each, so this can take a
// moment; the labels below advance on a timer to communicate progress.

import { useEffect, useState } from "react";

export default function PersonaLoadingView({ names = [], mode = "chat", error, onBack }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="mc-screen mc-loader-page">
        <div className="mc-loader-card">
          <div className="mc-err-icon">⚠</div>
          <h2 className="mc-err-title">
            Couldn't build the persona{names.length > 1 ? "s" : ""}
          </h2>
          <p className="mc-err-text">{error}</p>
          <button className="mc-btn mc-btn--accent" onClick={onBack}>
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
    <div className="mc-screen mc-loader-page">
      <div className="mc-loader-card">
        <div className="mc-spin" />
        <h2 className="mc-loader-title">
          {mode === "scene" ? "Setting the stage" : "Getting into character"}
        </h2>
        <p className="mc-loader-who">{label}</p>
        <p className="mc-loader-stage">{message}</p>
        <p className="mc-hint">
          Grounding each character in the manuscript — this only happens the
          first time you open them.
        </p>
      </div>
    </div>
  );
}
