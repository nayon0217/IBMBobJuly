// ChatView.jsx — one-on-one chat with a single character. Styled to match the
// scene page: warm canvas, purple writer bubbles, a colored character avatar,
// and a pill composer. The writer types a question, it's sent as a ChatRequest,
// and the character agent replies in voice. History is the running transcript
// minus the new message.

import { useEffect, useRef, useState } from "react";
import { chat } from "./api";
import { initials, colorFor } from "./avatar";
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
        <button style={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
      </div>
    );
  }

  const accent = colorFor(character.id);

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
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Characters
        </button>
        <div style={{ ...styles.avatar, background: accent }}>
          {initials(character.name)}
        </div>
        <div>
          <div style={styles.name}>{character.name}</div>
          <div style={styles.sub}>{title || "Manuscript"}</div>
        </div>
      </header>

      <main style={styles.thread}>
        {messages.length === 0 && (
          <p style={styles.empty}>
            Ask {character.name} anything — they only know the story up to where
            they've been.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.speaker_id === "writer";
          return (
            <div
              key={i}
              style={{ ...styles.row, justifyContent: mine ? "flex-end" : "flex-start" }}
            >
              {!mine && (
                <div style={{ ...styles.msgAvatar, background: accent }}>
                  {initials(idToName[m.speaker_id] || character.name)}
                </div>
              )}
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
        {loading && (
          <div style={{ ...styles.row, justifyContent: "flex-start" }}>
            <div style={{ ...styles.msgAvatar, background: accent }}>
              {initials(character.name)}
            </div>
            <div style={{ ...styles.bubble, ...styles.theirs, ...styles.typing }}>
              {character.name} is thinking…
            </div>
          </div>
        )}
        {error && <p style={styles.error}>{error}</p>}
        <div ref={endRef} />
      </main>

      <form style={styles.composer} onSubmit={send}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${character.name}…`}
          disabled={loading}
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
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: T.bg,
    fontFamily: T.font,
    color: T.ink,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.9rem",
    padding: "0.9rem 1.5rem",
    background: T.surface,
    borderBottom: `1px solid ${T.border}`,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  name: { fontWeight: 700, fontSize: "1.05rem" },
  sub: { fontSize: "0.78rem", color: T.inkMuted },
  backBtn: {
    background: "none",
    border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    padding: "0.45rem 0.9rem",
    fontSize: "0.85rem",
    cursor: "pointer",
    color: T.inkSoft,
    fontFamily: "inherit",
  },
  thread: {
    flex: 1,
    overflowY: "auto",
    padding: "1.5rem",
    maxWidth: 720,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  empty: { color: T.inkMuted, fontSize: "0.9rem", textAlign: "center", marginTop: "2rem" },
  row: { display: "flex", alignItems: "flex-end", gap: "0.5rem" },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "0.62rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "80%",
    padding: "0.7rem 0.95rem",
    borderRadius: 16,
    fontSize: "0.92rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  mine: { background: T.accent, color: "#fff", borderBottomRightRadius: 4 },
  theirs: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    color: T.ink,
    borderBottomLeftRadius: 4,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  speaker: {
    fontSize: "0.72rem",
    fontWeight: 700,
    color: T.inkMuted,
    marginBottom: "0.25rem",
  },
  typing: { color: T.inkMuted, fontStyle: "italic" },
  error: { color: T.danger, fontSize: "0.85rem", textAlign: "center" },
  composer: {
    display: "flex",
    gap: "0.6rem",
    padding: "1rem 1.5rem",
    background: T.surface,
    borderTop: `1px solid ${T.border}`,
    maxWidth: 720,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
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
