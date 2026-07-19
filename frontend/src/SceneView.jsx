// SceneView.jsx — the scene stage. The characters chosen in SceneSetupView are
// dropped onto a shared stage. The writer describes an imaginary scene in the
// box at the bottom; that description is sent to POST /scene as `situation`,
// and each character's line from the returned dialogue floats above them as a
// speech bubble. (The sample UI has a timeline slider here — intentionally
// omitted; the timeline is chosen during setup.)

import { useMemo, useState } from "react";
import { initials, colorFor } from "./avatar";
import { runScene, chat } from "./api";

const MAX_TURNS = 6;

export default function SceneView({
  characters = [],
  characterIds = [],
  title,
  situation = "",
  knowledgeUpToChunk = null,
  onBack,
}) {
  const cast = useMemo(
    () => characterIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean),
    [characterIds, characters]
  );

  // Latest spoken line per character id -> text.
  const [bubbles, setBubbles] = useState({});
  // Seed the composer with the situation the writer sketched during setup.
  const [input, setInput] = useState(situation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [played, setPlayed] = useState(false);

  async function playScene(e) {
    e?.preventDefault();
    const description = input.trim();
    if (!description || loading) return;

    setError("");
    setLoading(true);
    setBubbles({});

    try {
      if (cast.length < 2) {
        // /scene requires two+ characters; a solo "scene" is really a chat.
        const only = cast[0];
        const res = await chat(only.id, description, [], knowledgeUpToChunk);
        setBubbles({ [only.id]: res.reply.text });
      } else {
        // POST /scene with { character_ids, situation, max_turns }.
        const res = await runScene(cast.map((c) => c.id), description, {
          maxTurns: MAX_TURNS,
        });
        const latest = {};
        for (const turn of res.dialogue ?? []) {
          if (turn.speaker_id !== "writer") latest[turn.speaker_id] = turn.text;
        }
        setBubbles(latest);
      }
      setPlayed(true);
    } catch (err) {
      setError(err.message || "The scene could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.shell}>
      {/* ── top bar ── */}
      <header style={styles.topBar}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <span style={styles.topTitle}>{title || "Scene"}</span>
        <div style={styles.chips}>
          {cast.map((c) => (
            <span
              key={c.id}
              style={{
                ...styles.chip,
                color: colorFor(c.id),
                borderColor: colorFor(c.id),
              }}
            >
              <span style={{ ...styles.chipDot, background: colorFor(c.id) }} />
              {c.name}
            </span>
          ))}
        </div>
      </header>

      {/* ── stage ── */}
      <main style={styles.stageWrap}>
        <div style={styles.stage}>
          <div style={styles.stageLabel}>
            {loading ? "Scene in progress…" : played ? "Scene" : "Set the scene"}
          </div>

          {!played && !loading && cast.length > 0 && (
            <p style={styles.stageHint}>
              Describe an imaginary scene below and press Play to watch it unfold.
            </p>
          )}

          <div style={styles.actors}>
            {cast.length === 0 && (
              <p style={styles.emptyStage}>No characters in this scene.</p>
            )}
            {cast.map((c) => (
              <div key={c.id} style={styles.actor}>
                {bubbles[c.id] ? (
                  <div style={styles.bubble}>{bubbles[c.id]}</div>
                ) : loading ? (
                  <div style={{ ...styles.bubble, ...styles.bubbleGhost }}>…</div>
                ) : null}
                {(bubbles[c.id] || loading) && <div style={styles.bubbleTail} />}
                <div
                  style={{
                    ...styles.actorAvatar,
                    background: colorFor(c.id),
                  }}
                >
                  {initials(c.name)}
                </div>
                <div style={styles.actorName}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>
        {error && <p style={styles.error}>{error}</p>}
      </main>

      {/* ── composer ── */}
      <form style={styles.composer} onSubmit={playScene}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Describe an imaginary scene… e.g. "They are trapped by rain in a parlour."'
          disabled={loading}
        />
        <button
          type="submit"
          style={{ ...styles.askBtn, ...(loading || !input.trim() ? styles.askBtnOff : {}) }}
          disabled={loading || !input.trim()}
        >
          {loading ? "…" : played ? "Replay" : "Play"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    color: "#1f2328",
    background: "#f4f2ec",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.75rem 1.25rem",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  backBtn: {
    background: "none",
    border: "1px solid #d0d7de",
    borderRadius: 8,
    padding: "0.4rem 0.85rem",
    fontSize: "0.82rem",
    cursor: "pointer",
    color: "#57606a",
    fontFamily: "inherit",
  },
  topTitle: { fontWeight: 700, fontSize: "0.95rem" },
  chips: { display: "flex", gap: "0.4rem", flexWrap: "wrap", marginLeft: "0.5rem" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    border: "1px solid",
    borderRadius: 999,
    padding: "0.2rem 0.6rem",
    fontSize: "0.72rem",
    fontWeight: 600,
    background: "#fff",
  },
  chipDot: { width: 7, height: 7, borderRadius: "50%" },
  stageWrap: {
    flex: 1,
    overflow: "auto",
    padding: "1rem 1.25rem",
    display: "flex",
    flexDirection: "column",
  },
  stage: {
    flex: 1,
    borderRadius: 16,
    background: "linear-gradient(180deg, #3b2f5e 0%, #6a4a6b 55%, #a97e86 100%)",
    position: "relative",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-around",
    padding: "2rem 2.5rem 3rem",
    minHeight: 420,
    overflow: "hidden",
  },
  stageLabel: {
    position: "absolute",
    top: "1.25rem",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.65)",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  actors: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-around",
    width: "100%",
    gap: "1.5rem",
    flexWrap: "wrap",
  },
  emptyStage: { color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" },
  stageHint: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    transform: "translateY(-50%)",
    textAlign: "center",
    color: "rgba(255,255,255,0.55)",
    fontSize: "0.9rem",
    padding: "0 2rem",
    margin: 0,
  },
  actor: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: 200,
  },
  bubble: {
    background: "#fff",
    color: "#1f2328",
    borderRadius: 14,
    padding: "0.6rem 0.8rem",
    fontSize: "0.82rem",
    lineHeight: 1.4,
    maxWidth: 220,
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
    marginBottom: "0.35rem",
    textAlign: "center",
  },
  bubbleGhost: {
    background: "rgba(255,255,255,0.25)",
    color: "rgba(255,255,255,0.85)",
    boxShadow: "none",
    fontStyle: "italic",
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: "7px solid #fff",
    marginBottom: "0.75rem",
  },
  actorAvatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: 700,
    border: "3px solid rgba(255,255,255,0.65)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  },
  actorName: {
    marginTop: "0.5rem",
    color: "#fff",
    fontSize: "0.78rem",
    fontWeight: 600,
    textAlign: "center",
  },
  error: { color: "#cf222e", fontSize: "0.85rem", textAlign: "center", marginTop: "0.75rem" },
  composer: {
    display: "flex",
    gap: "0.6rem",
    padding: "1rem 1.25rem",
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: "0.75rem 1rem",
    borderRadius: 999,
    border: "1px solid #d0d7de",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    outline: "none",
  },
  askBtn: {
    background: "#6a4bff",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "0.75rem 1.5rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  askBtnOff: { background: "#c9c4e8", cursor: "not-allowed" },
};
