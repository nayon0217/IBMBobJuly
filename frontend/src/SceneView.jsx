// SceneView.jsx — the scene stage. The characters chosen in SceneSetupView are
// dropped onto a shared stage. The writer describes an imaginary scene in the
// box at the bottom; that description is sent to POST /scene as `situation`,
// and each character's line from the returned dialogue floats above them as a
// speech bubble. (The sample UI has a timeline slider here — intentionally
// omitted; the timeline is chosen during setup.)

import { useEffect, useMemo, useState } from "react";
import { colorFor } from "./avatar";
import { buildAvatarUrl } from "./characterAvatar";
import { runScene } from "./api";

const MAX_TURNS = 6;

// While the backend is thinking, the stage plays a little "conversation":
// a typing bubble hops from actor to actor and their faces cycle through
// these expressions so the wait feels alive rather than frozen.
const THINKING_EMOTIONS = [
  "smile", "twinkle", "serious", "concerned", "default", "grimace", "sad", "tongue",
];
const THINKING_TICK_MS = 1200;

export default function SceneView({
  characters = [],
  characterIds = [],
  title,
  situation = "",
  onBack,
}) {
  const cast = useMemo(
    () => characterIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean),
    [characterIds, characters]
  );

  // Latest spoken line per character id -> text.
  const [bubbles, setBubbles] = useState({});
  // Latest expression per character id -> emotion (a DiceBear mouth value).
  // Drives each actor's facial expression, mirroring the one-on-one chat.
  const [emotions, setEmotions] = useState({});

  // ── loading "conversation" animation ──
  // A monotonically increasing tick that advances while we wait on the backend.
  // It picks the actor currently "speaking" and re-keys the typing bubble so it
  // re-animates each hop.
  const [thinkingTick, setThinkingTick] = useState(0);
  // Transient per-character expressions shown only during the wait.
  const [thinkingEmotions, setThinkingEmotions] = useState({});

  // Generated avatar per character id, derived from the persona card's physical
  // description — same pipeline as the one-on-one chat page. While loading, the
  // mouth follows the animated "thinking" expression so the faces come alive;
  // once played, it mirrors that character's latest line's emotion.
  const avatarUrls = useMemo(
    () =>
      Object.fromEntries(
        cast.map((c) => {
          const mouth = loading ? thinkingEmotions[c.id] : emotions[c.id];
          return [c.id, buildAvatarUrl(c.physical, c.id, c.gender, mouth)];
        })
      ),
    [cast, emotions, loading, thinkingEmotions]
  );

  // The actor whose typing bubble is currently showing while we wait.
  const activeSpeakerId =
    loading && cast.length > 0 ? cast[thinkingTick % cast.length].id : null;

  // Drive the wait animation: hop the speaking bubble and reshuffle every
  // actor's expression on a fixed cadence until the scene resolves.
  useEffect(() => {
    if (!loading || cast.length === 0) return undefined;

    const advance = (tick) => {
      setThinkingEmotions(() => {
        const next = {};
        cast.forEach((c, i) => {
          next[c.id] = THINKING_EMOTIONS[(tick + i) % THINKING_EMOTIONS.length];
        });
        return next;
      });
    };

    setThinkingTick(0);
    advance(0);
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      setThinkingTick(tick);
      advance(tick);
    }, THINKING_TICK_MS);

    return () => clearInterval(id);
  }, [loading, cast]);
  // Seed the composer with the situation the writer sketched during setup.
  const [input, setInput] = useState(situation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [played, setPlayed] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  async function playScene(e) {
    e?.preventDefault();
    const description = input.trim();
    if (!description || loading || cast.length === 0) return;

    setError("");
    setLoading(true);
    setBubbles({});
    setEmotions({});
    setSuggestion(null);

    try {
      // POST /scene with { character_ids, situation, max_turns } — one or more
      // characters; the backend runs the round-robin + name-callout scene.
      const res = await runScene(cast.map((c) => c.id), description, {
        maxTurns: MAX_TURNS,
      });
      const latest = {};
      const latestEmotion = {};
      for (const turn of res.dialogue ?? []) {
        if (turn.speaker_id !== "writer") {
          latest[turn.speaker_id] = turn.text;
          if (turn.emotion) latestEmotion[turn.speaker_id] = turn.emotion;
        }
      }
      setBubbles(latest);
      setEmotions(latestEmotion);
      setSuggestion(res.suggestion ?? null);
      setPlayed(true);
    } catch (err) {
      setError(err.message || "The scene could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.shell}>
      <style>{keyframes}</style>
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
            {cast.map((c) => {
              const isSpeaking = c.id === activeSpeakerId;
              return (
                <div key={c.id} style={styles.actor}>
                  {bubbles[c.id] ? (
                    <>
                      <div style={styles.bubble}>{bubbles[c.id]}</div>
                      <div style={styles.bubbleTail} />
                    </>
                  ) : isSpeaking ? (
                    <>
                      <div
                        key={thinkingTick}
                        style={{ ...styles.bubble, ...styles.bubbleTyping }}
                      >
                        <span style={styles.typingDots}>
                          <span style={{ ...styles.dot, animationDelay: "0s" }} />
                          <span style={{ ...styles.dot, animationDelay: "0.18s" }} />
                          <span style={{ ...styles.dot, animationDelay: "0.36s" }} />
                        </span>
                      </div>
                      <div style={styles.bubbleTail} />
                    </>
                  ) : (
                    // Reserve the bubble's vertical space so avatars don't jump
                    // as the typing bubble hops between actors.
                    <div style={styles.bubbleSpacer} />
                  )}
                  <img
                    src={avatarUrls[c.id]}
                    alt={c.name}
                    style={{
                      ...styles.actorAvatar,
                      background: colorFor(c.id),
                      ...(isSpeaking ? styles.actorAvatarSpeaking : {}),
                    }}
                  />
                  <div style={styles.actorName}>{c.name}</div>
                </div>
              );
            })}
          </div>
        </div>
        {error && <p style={styles.error}>{error}</p>}

        {suggestion && (
          <section style={styles.aftermath}>
            <div style={styles.aftermathCol}>
              <h3 style={styles.aftermathLabel}>What happened</h3>
              <p style={styles.summaryText}>{suggestion.summary}</p>
            </div>
            {suggestion.character_feelings?.length > 0 && (
              <div style={styles.aftermathCol}>
                <h3 style={styles.aftermathLabel}>How they feel now</h3>
                <div style={styles.feelings}>
                  {cast.map((c, i) => (
                    <div key={c.id} style={styles.feelingRow}>
                      <img
                        src={avatarUrls[c.id]}
                        alt={c.name}
                        style={{ ...styles.feelingAvatar, background: colorFor(c.id) }}
                      />
                      <div>
                        <div style={styles.feelingName}>{c.name}</div>
                        <div style={styles.feelingText}>
                          {suggestion.character_feelings[i]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
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

// Injected once via a <style> tag — inline styles can't express keyframes.
const keyframes = `
@keyframes scenePop {
  0%   { opacity: 0; transform: translateY(8px) scale(0.8); }
  60%  { opacity: 1; transform: translateY(-2px) scale(1.04); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes sceneTyping {
  0%, 70%, 100% { transform: translateY(0); opacity: 0.35; }
  35%           { transform: translateY(-5px); opacity: 1; }
}
@keyframes sceneBob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}
`;

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
  bubbleTyping: {
    padding: "0.7rem 0.9rem",
    animation: "scenePop 0.28s ease-out",
  },
  typingDots: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#8a7fb0",
    display: "inline-block",
    animation: "sceneTyping 1.1s ease-in-out infinite",
  },
  // Keeps the row height stable while the typing bubble hops between actors.
  bubbleSpacer: { height: 40, marginBottom: "0.35rem" },
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
    objectFit: "cover",
    border: "3px solid rgba(255,255,255,0.65)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  },
  actorAvatarSpeaking: {
    borderColor: "#fff",
    boxShadow: "0 0 0 4px rgba(255,255,255,0.25), 0 6px 18px rgba(0,0,0,0.3)",
    animation: "sceneBob 1.2s ease-in-out infinite",
  },
  actorName: {
    marginTop: "0.5rem",
    color: "#fff",
    fontSize: "0.78rem",
    fontWeight: 600,
    textAlign: "center",
  },
  error: { color: "#cf222e", fontSize: "0.85rem", textAlign: "center", marginTop: "0.75rem" },
  aftermath: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1.25rem",
    marginTop: "1rem",
    background: "#fff",
    border: "1px solid #e3e1d7",
    borderRadius: 14,
    padding: "1.25rem 1.5rem",
  },
  aftermathCol: { minWidth: 0 },
  aftermathLabel: {
    margin: "0 0 0.6rem",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#8c959f",
  },
  summaryText: { margin: 0, fontSize: "0.92rem", lineHeight: 1.55, color: "#1f2328" },
  feelings: { display: "flex", flexDirection: "column", gap: "0.85rem" },
  feelingRow: { display: "flex", gap: "0.6rem", alignItems: "flex-start" },
  feelingAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
  feelingName: { fontWeight: 700, fontSize: "0.85rem" },
  feelingText: { fontSize: "0.88rem", lineHeight: 1.5, color: "#3d4650", fontStyle: "italic" },
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
