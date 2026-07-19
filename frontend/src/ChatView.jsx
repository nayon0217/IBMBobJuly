// ChatView.jsx — split layout: large character portrait + speech bubble on the
// left, scrolling conversation history on the right, composer pinned at bottom.
// Styling: "The Reading Room" (theme.css) — a deep espresso portrait nook beside
// a warm paper thread.

import { useEffect, useRef, useState } from "react";
import { chat } from "./api";
import { colorFor } from "./avatar";
import { buildAvatarUrl } from "./characterAvatar";

export default function ChatView({
  character,
  characters = [],
  title,
  knowledgeUpToChunk = null,
  onBack,
}) {
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
      <div className="mc-screen mc-loader-page">
        <div className="mc-loader-card">
          <p className="mc-err-text">No character selected.</p>
          <button className="mc-btn mc-btn--accent" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  // Most recent character reply — shown live in the speech bubble.
  const lastCharMsg = loading
    ? null
    : [...messages].reverse().find((m) => m.speaker_id !== "writer");

  // The avatar's mouth mirrors the latest reply's emotion (neutral by default).
  const avatarUrl = buildAvatarUrl(
    character.physical,
    character.id,
    character.gender,
    lastCharMsg?.emotion,
  );

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
      const res = await chat(character.id, message, history, knowledgeUpToChunk);
      setMessages((m) => [...m, res.reply]);
    } catch (err) {
      setError(err.message || "The character could not reply.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mc-screen mc-chat-shell">
      {/* ── top bar ──────────────────────────────────────────────────── */}
      <header className="mc-chat-head">
        <button className="mc-btn mc-btn--ghost-dark" onClick={onBack}>← Characters</button>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="mc-chat-name">{character.name}</span>
          <span className="mc-chat-sub">{title || "Manuscript"}</span>
        </div>
      </header>

      {/* ── body ─────────────────────────────────────────────────────── */}
      <div className="mc-chat-body">

        {/* ── LEFT: portrait + speech bubble ───────────────────────── */}
        <div className="mc-avatar-panel">

          {/* Speech bubble — always visible, updates with latest reply */}
          <div className="mc-speech-wrap">
            <div className={"mc-speech" + (!lastCharMsg && !loading ? " is-empty" : "")}>
              {loading
                ? <span className="mc-typing-ink">● &nbsp;● &nbsp;●</span>
                : lastCharMsg
                  ? lastCharMsg.text
                  : `Ask me anything…`}
            </div>
            {/* Triangle tail pointing down toward the portrait's head */}
            <div className="mc-speech-tail" />
          </div>

          <img src={avatarUrl} alt={character.name} className="mc-big-portrait" />
          <div className="mc-portrait-name">{character.name}</div>
        </div>

        {/* ── RIGHT: conversation history ───────────────────────────── */}
        <div className="mc-thread">
          {messages.length === 0 && (
            <p className="mc-thread-empty">
              Your conversation with {character.name} will appear here.
            </p>
          )}

          {messages.map((m, i) => {
            const mine = m.speaker_id === "writer";
            return (
              <div
                key={i}
                className="mc-msg-row"
                style={{ justifyContent: mine ? "flex-end" : "flex-start" }}
              >
                <div className={"mc-msg " + (mine ? "mine" : "theirs")}>
                  {!mine && (
                    <div className="mc-msg-speaker">
                      {idToName[m.speaker_id] || character.name}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            );
          })}

          {error && (
            <p style={{ color: "var(--danger)", fontFamily: "var(--sans)", fontSize: ".85rem", textAlign: "center" }}>
              {error}
            </p>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* ── composer ─────────────────────────────────────────────────── */}
      <form
        onSubmit={send}
        style={{
          display: "flex",
          gap: ".6rem",
          padding: ".9rem 1.25rem",
          background: "var(--card)",
          borderTop: "1px solid var(--line)",
          flexShrink: 0,
        }}
      >
        <input
          className="mc-input"
          style={{ borderRadius: "var(--radius-pill)", padding: ".75rem 1.1rem" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${character.name}…`}
          disabled={loading}
          autoFocus
        />
        <button
          className="mc-btn mc-btn--accent mc-btn--pill mc-btn--lg"
          type="submit"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
