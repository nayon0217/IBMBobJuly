// ChatView.jsx — split layout: large character avatar + speech bubble on the
// left, scrolling conversation history on the right, composer pinned at bottom.

import { useEffect, useRef, useState } from "react";
import { chat } from "./api";
import { colorFor } from "./avatar";
import { buildAvatarUrl } from "./characterAvatar";
import { T } from "./theme";

export default function ChatView({ character, characters = [], title, onBack }) {
  const [messages, setMessages] = useState([]); // [{ speaker_id, text }]
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const idToName = Object.fromEntries(characters.map((c) => [c.id, c.name]));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!character) {
    return (
      <div style={styles.page}>
        <p>No character selected.</p>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
      </div>
    );
  }

  const avatarUrl = buildAvatarUrl(character.physical, character.id, character.gender);

  // Most recent character reply — shown live in the speech bubble.
  const lastCharMsg = loading
    ? null
    : [...messages].reverse().find((m) => m.speaker_id !== "writer");

  async function send(e) {
    e?.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const history = messages;
    setMessages([...history, { speaker_id: "writer", text: message }]);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const res = await chat(character.id, message, history);
      setMessages((m) => [...m, res.reply]);
    } catch (err) {
      setError(err.message || "The character could not reply.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>

      {/* ── top bar ──────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Characters</button>
        <div style={styles.headerTitle}>
          <span style={styles.headerName}>{character.name}</span>
          <span style={styles.headerSub}>{title || "Manuscript"}</span>
        </div>
      </header>

      {/* ── body ─────────────────────────────────────────────────────── */}
      <div style={styles.body}>

        {/* ── LEFT: avatar + speech bubble ─────────────────────────── */}
        <div style={styles.avatarPanel}>

          {/* Speech bubble — always visible, updates with latest reply */}
          <div style={styles.speechBubbleWrap}>
            <div style={{
              ...styles.speechBubble,
              ...((!lastCharMsg && !loading) ? styles.speechBubbleEmpty : {}),
            }}>
              {loading
                ? <span style={styles.typingDots}>● &nbsp;● &nbsp;●</span>
                : lastCharMsg
                  ? lastCharMsg.text
                  : `Ask me anything…`}
            </div>
            {/* Triangle tail pointing down toward the avatar's mouth */}
            <div style={styles.bubbleTail} />
          </div>

          <img src={avatarUrl} alt={character.name} style={styles.bigAvatar} />
          <div style={styles.avatarName}>{character.name}</div>
        </div>

        {/* ── RIGHT: conversation history ───────────────────────────── */}
        <div style={styles.thread}>
          {messages.length === 0 && (
            <p style={styles.empty}>
              Your conversation with {character.name} will appear here.
            </p>
          )}

          {messages.map((m, i) => {
            const mine = m.speaker_id === "writer";
            return (
              <div
                key={i}
                style={{ ...styles.row, justifyContent: mine ? "flex-end" : "flex-start" }}
              >
                <div style={{ ...styles.bubble, ...(mine ? styles.mine : styles.theirs) }}>
                  {!mine && (
                    <div style={styles.speaker}>
                      {idToName[m.speaker_id] || character.name}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            );
          })}

          {error && <p style={styles.error}>{error}</p>}
          <div ref={endRef} />
        </div>
      </div>

      {/* ── composer ─────────────────────────────────────────────────── */}
      <form style={styles.composer} onSubmit={send}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${character.name}…`}
          disabled={loading}
          autoFocus
        />
        <button
          style={{ ...styles.sendBtn, ...(loading || !input.trim() ? styles.sendBtnOff : {}) }}
          type="submit"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: T.bg,
    fontFamily: T.font,
    color: T.ink,
    overflow: "hidden",
  },

  // ── header ──────────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.9rem",
    padding: "0.9rem 1.5rem",
    background: T.surface,
    borderBottom: `1px solid ${T.border}`,
    flexShrink: 0,
  },
  headerTitle: { display: "flex", flexDirection: "column" },
  headerName: { fontWeight: 700, fontSize: "1rem" },
  headerSub: { fontSize: "0.75rem", color: T.inkMuted },
  backBtn: {
    background: "none",
    border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    padding: "0.45rem 0.9rem",
    fontSize: "0.85rem",
    cursor: "pointer",
    color: T.inkSoft,
    fontFamily: "inherit",
    flexShrink: 0,
  },

  // ── body ────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },

  // ── avatar panel (left ~40%) ─────────────────────────────────────
  avatarPanel: {
    width: "38%",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "1.5rem 1.25rem 1rem",
    background: T.surface,
    borderRight: `1px solid ${T.border}`,
    position: "relative",
    gap: "0.4rem",
  },
  bigAvatar: {
    width: "min(280px, 72%)",
    height: "min(280px, 72%)",
    flexShrink: 0,
  },
  avatarName: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: T.inkMuted,
    letterSpacing: "0.02em",
  },

  // ── speech bubble ───────────────────────────────────────────────
  speechBubbleWrap: {
    position: "absolute",
    top: "1.25rem",
    left: "1rem",
    right: "1rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  speechBubble: {
    background: T.surface,
    border: `2px solid ${T.ink}`,
    borderRadius: 16,
    padding: "0.85rem 1rem",
    fontSize: "0.92rem",
    lineHeight: 1.55,
    color: T.ink,
    width: "100%",
    boxSizing: "border-box",
    maxHeight: 200,
    overflowY: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  speechBubbleEmpty: {
    color: T.inkMuted,
    fontStyle: "italic",
    borderColor: T.borderStrong,
    borderStyle: "dashed",
  },
  // CSS triangle tail pointing down toward the avatar's mouth
  bubbleTail: {
    marginLeft: "2.25rem",
    width: 0,
    height: 0,
    borderLeft: "9px solid transparent",
    borderRight: "9px solid transparent",
    borderTop: `13px solid ${T.ink}`,
  },
  typingDots: {
    letterSpacing: "0.2em",
    color: T.inkMuted,
    fontSize: "1rem",
  },

  // ── conversation history (right pane) ─────────────────────────
  thread: {
    flex: 1,
    overflowY: "auto",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.65rem",
  },
  empty: {
    color: T.inkMuted,
    fontSize: "0.88rem",
    textAlign: "center",
    marginTop: "2rem",
  },
  row: { display: "flex" },
  bubble: {
    maxWidth: "88%",
    padding: "0.65rem 0.9rem",
    borderRadius: 16,
    fontSize: "0.9rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  mine: { background: T.accent, color: "#fff", borderBottomRightRadius: 4, marginLeft: "auto" },
  theirs: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    color: T.ink,
    borderBottomLeftRadius: 4,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  speaker: {
    fontSize: "0.7rem",
    fontWeight: 700,
    color: T.inkMuted,
    marginBottom: "0.2rem",
  },
  error: { color: T.danger, fontSize: "0.85rem", textAlign: "center" },

  // ── composer ────────────────────────────────────────────────────
  composer: {
    display: "flex",
    gap: "0.6rem",
    padding: "0.9rem 1.25rem",
    background: T.surface,
    borderTop: `1px solid ${T.border}`,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: "0.75rem 1rem",
    borderRadius: T.radiusPill,
    border: `1px solid ${T.borderStrong}`,
    fontSize: "0.92rem",
    fontFamily: "inherit",
    outline: "none",
  },
  sendBtn: {
    background: T.accent,
    color: "#fff",
    border: "none",
    borderRadius: T.radiusPill,
    padding: "0.7rem 1.5rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  sendBtnOff: { background: T.accentDisabled, cursor: "not-allowed" },
};
