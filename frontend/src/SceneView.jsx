// SceneView.jsx — the scene stage. The characters chosen in SceneSetupView are
// dropped onto a shared stage. The writer describes an imaginary scene in the
// box at the bottom; that description is sent to POST /scene as `situation`,
// and each character's line from the returned dialogue floats above them as a
// speech bubble. (The sample UI has a timeline slider here — intentionally
// omitted; the timeline is chosen during setup.)
// Styling: "The Reading Room" (theme.css) — a warm espresso atrium around a
// mood-tinted stage with serif, paper-textured speech bubbles.

import { useEffect, useMemo, useState } from "react";
import { colorFor } from "./avatar";
import { buildAvatarUrl } from "./characterAvatar";
import { runScene } from "./api";

const MAX_TURNS = 6;

// The stage backdrop tints itself to match the scene the writer describes.
// Each entry pairs a set of trigger words with a top→bottom gradient that
// evokes that setting/mood. The first matching palette wins, so more specific
// moods are listed before broader ones. `DEFAULT_STAGE_GRADIENT` is the dusk
// tone used when nothing matches.
const DEFAULT_STAGE_GRADIENT =
  "linear-gradient(180deg, #3b2f5e 0%, #6a4a6b 55%, #a97e86 100%)";

const SCENE_GRADIENTS = [
  { words: ["night", "midnight", "moon", "moonlight", "starlit", "stars", "dark"], gradient: "linear-gradient(180deg, #0b1026 0%, #1c2450 55%, #2e3b6b 100%)" },
  { words: ["dawn", "sunrise", "morning", "daybreak"], gradient: "linear-gradient(180deg, #2b3a67 0%, #c56b8e 55%, #f2c17d 100%)" },
  { words: ["sunset", "dusk", "evening", "twilight"], gradient: "linear-gradient(180deg, #4a2c5e 0%, #a3436b 55%, #e8965a 100%)" },
  { words: ["rain", "storm", "thunder", "fog", "mist", "grey", "gray", "gloom", "overcast"], gradient: "linear-gradient(180deg, #2f3a44 0%, #4a5a66 55%, #7c8a94 100%)" },
  { words: ["fire", "flame", "flames", "burning", "inferno", "blaze", "ember"], gradient: "linear-gradient(180deg, #3a0d0d 0%, #7a1f12 55%, #c25a2a 100%)" },
  { words: ["snow", "winter", "ice", "icy", "frost", "cold", "blizzard"], gradient: "linear-gradient(180deg, #3a4a63 0%, #7f95b3 55%, #d6e3ef 100%)" },
  { words: ["forest", "woods", "wood", "garden", "meadow", "tree", "trees", "jungle", "grove"], gradient: "linear-gradient(180deg, #12351f 0%, #2f6b3a 55%, #7fae6a 100%)" },
  { words: ["sea", "ocean", "beach", "shore", "water", "river", "lake", "harbour", "harbor", "coast", "waves"], gradient: "linear-gradient(180deg, #08313f 0%, #12667a 55%, #4fb0b8 100%)" },
  { words: ["desert", "sand", "sun", "sunny", "heat", "dune"], gradient: "linear-gradient(180deg, #5a3410 0%, #b3742a 55%, #e8c06a 100%)" },
  { words: ["war", "battle", "blood", "death", "duel", "fight"], gradient: "linear-gradient(180deg, #2a0d0d 0%, #5e1f22 55%, #8a3a3a 100%)" },
  { words: ["love", "romance", "kiss", "rose", "wedding"], gradient: "linear-gradient(180deg, #4a1f3a 0%, #a3436b 55%, #e39ab0 100%)" },
  { words: ["ball", "ballroom", "party", "palace", "candle", "candlelight", "feast", "banquet"], gradient: "linear-gradient(180deg, #3a1f2e 0%, #7a3a4a 55%, #c98a6a 100%)" },
];

// A warm depth vignette layered above whichever mood gradient is chosen, so the
// stage always reads as a recessed, grounded space.
const STAGE_VIGNETTE = "radial-gradient(80% 60% at 50% 120%, rgba(0,0,0,0.35), transparent 60%)";

// Pick a stage gradient from the scene description. Matches on whole words so a
// scene like "trapped by rain in a parlour" tints stormy grey.
function gradientForScene(text) {
  if (!text) return DEFAULT_STAGE_GRADIENT;
  const haystack = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
  for (const { words, gradient } of SCENE_GRADIENTS) {
    if (words.some((w) => haystack.includes(` ${w} `))) return gradient;
  }
  return DEFAULT_STAGE_GRADIENT;
}

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
  knowledgeUpToChunk = null,
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

  // Seed the composer with the situation the writer sketched during setup.
  const [input, setInput] = useState(situation);
  // The scene description that's currently "on stage" — drives the backdrop
  // tint. Seeded with the setup situation so the stage is themed on arrival.
  const [sceneText, setSceneText] = useState(situation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [played, setPlayed] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

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

  // Backdrop gradient chosen from the scene on stage.
  const stageGradient = useMemo(() => gradientForScene(sceneText), [sceneText]);

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

  async function playScene(e) {
    e?.preventDefault();
    const description = input.trim();
    if (!description || loading || cast.length === 0) return;

    setError("");
    setLoading(true);
    setBubbles({});
    setEmotions({});
    setSuggestion(null);
    setSceneText(description);

    try {
      // POST /scene with { character_ids, situation, max_turns } — one or more
      // characters; the backend runs the round-robin + name-callout scene.
      const res = await runScene(cast.map((c) => c.id), description, {
        maxTurns: MAX_TURNS,
        knowledgeUpToChunk,
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
    <div className="mc-screen mc-scene-shell">
      {/* ── top bar ── */}
      <header className="mc-scene-bar">
        <button className="mc-btn mc-btn--ghost-dark" onClick={onBack}>
          ← Back
        </button>
        <span className="mc-scene-title">{title || "Scene"}</span>
        <div className="mc-chips">
          {cast.map((c) => (
            <span key={c.id} className="mc-chip">
              <span className="mc-chip-dot" style={{ background: colorFor(c.id) }} />
              {c.name}
            </span>
          ))}
        </div>
      </header>

      {/* ── stage ── */}
      <main className="mc-stage-wrap">
        <div
          className="mc-stage"
          style={{ background: `${STAGE_VIGNETTE}, ${stageGradient}` }}
        >
          <div className="mc-stage-label">
            {loading ? "Scene in progress…" : played ? "Scene" : "Set the scene"}
          </div>

          {!played && !loading && cast.length > 0 && (
            <p className="mc-stage-hint">
              Describe an imaginary scene below and press Play to watch it unfold.
            </p>
          )}

          <div className="mc-actors">
            {cast.length === 0 && (
              <p className="mc-empty-stage">No characters in this scene.</p>
            )}
            {cast.map((c) => {
              const isSpeaking = c.id === activeSpeakerId;
              return (
                <div key={c.id} className="mc-actor">
                  {bubbles[c.id] ? (
                    <>
                      <div className="mc-bubble">{bubbles[c.id]}</div>
                      <div className="mc-bubble-tail" />
                    </>
                  ) : isSpeaking ? (
                    <>
                      <div key={thinkingTick} className="mc-bubble">
                        <span className="mc-typing">
                          <span className="mc-typing-dot" style={{ animationDelay: "0s" }} />
                          <span className="mc-typing-dot" style={{ animationDelay: "0.18s" }} />
                          <span className="mc-typing-dot" style={{ animationDelay: "0.36s" }} />
                        </span>
                      </div>
                      <div className="mc-bubble-tail" />
                    </>
                  ) : (
                    // Reserve the bubble's vertical space so avatars don't jump
                    // as the typing bubble hops between actors.
                    <div className="mc-bubble-spacer" />
                  )}
                  <img
                    src={avatarUrls[c.id]}
                    alt={c.name}
                    className={
                      "mc-actor-avatar" +
                      (bubbles[c.id] ? "" : " idle") +
                      (isSpeaking ? " speaking" : "")
                    }
                    style={{ background: colorFor(c.id) }}
                  />
                  <div className="mc-actor-name">{c.name}</div>
                </div>
              );
            })}
          </div>
        </div>
        {error && <p className="mc-scene-error">{error}</p>}

        {suggestion && (
          <section className="mc-colophon">
            <div>
              <h4>What happened</h4>
              <p className="summary">{suggestion.summary}</p>
            </div>
            {suggestion.character_feelings?.length > 0 && (
              <div>
                <h4>How they feel now</h4>
                <div>
                  {cast.map((c, i) => (
                    <div key={c.id} className="mc-feel">
                      <img
                        src={avatarUrls[c.id]}
                        alt={c.name}
                        className="mc-medallion"
                        style={{ width: 34, height: 34, background: colorFor(c.id) }}
                      />
                      <div>
                        <div className="mc-feel-name">{c.name}</div>
                        <div className="mc-feel-text">
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
      <form className="mc-composer" onSubmit={playScene}>
        <input
          className="mc-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Describe an imaginary scene… e.g. "They are trapped by rain in a parlour."'
          disabled={loading}
        />
        <button
          type="submit"
          className="mc-btn mc-btn--warm mc-btn--pill mc-btn--lg"
          disabled={loading || !input.trim()}
        >
          {loading ? "…" : played ? "Replay" : "Play"}
        </button>
      </form>
    </div>
  );
}
