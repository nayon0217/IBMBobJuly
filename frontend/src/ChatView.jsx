// ChatView.jsx — minimal single-character chat. Intentionally bare: another
// agent owns the real chat UI. This just proves the /chat round-trip: the
// writer types a question, it's sent as a ChatRequest, and the character agent
// replies in voice. History is the running transcript minus the new message.

import { useEffect, useRef, useState } from "react";
import { chat } from "./api";

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
        <button style={styles.sendBtn} type="submit" disabled={loading || !input.trim()}>
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
    background: "#f7f8fa",
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    color: "#1f2328",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem 1.5rem",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  name: { fontWeight: 700, fontSize: "1.05rem" },
  sub: { fontSize: "0.78rem", color: "#8c959f" },
  backBtn: {
    background: "none",
    border: "1px solid #d0d7de",
    borderRadius: 8,
    padding: "0.45rem 0.9rem",
    fontSize: "0.85rem",
    cursor: "pointer",
    color: "#57606a",
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
  empty: { color: "#8c959f", fontSize: "0.9rem", textAlign: "center", marginTop: "2rem" },
  row: { display: "flex" },
  bubble: {
    maxWidth: "80%",
    padding: "0.7rem 0.95rem",
    borderRadius: 14,
    fontSize: "0.92rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  mine: { background: "#3b82d4", color: "#fff", borderBottomRightRadius: 4 },
  theirs: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    color: "#1f2328",
    borderBottomLeftRadius: 4,
  },
  speaker: {
    fontSize: "0.72rem",
    fontWeight: 700,
    color: "#8c959f",
    marginBottom: "0.25rem",
  },
  typing: { color: "#8c959f", fontStyle: "italic" },
  error: { color: "#cf222e", fontSize: "0.85rem", textAlign: "center" },
  composer: {
    display: "flex",
    gap: "0.6rem",
    padding: "1rem 1.5rem",
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    maxWidth: 720,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  input: {
    flex: 1,
    padding: "0.7rem 0.9rem",
    borderRadius: 10,
    border: "1px solid #d0d7de",
    fontSize: "0.92rem",
    fontFamily: "inherit",
    outline: "none",
  },
  sendBtn: {
    background: "#1f2328",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "0.7rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
