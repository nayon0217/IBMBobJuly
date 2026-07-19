// SceneSetupView.jsx — "Set the scene". The writer picks who's involved and
// where in the story to drop them, then enters the scene. Because the app also
// has a one-on-one chat feature, this page carries a mode toggle: in "Scene"
// mode the writer combines one or more characters into a live stage; in "Chat"
// mode they pick a single character and open the classic chat thread.
//
// This page lists the *whole* cast discovered at upload. Persona cards no
// longer exist here — they're grounded on demand when a chat/scene is entered.

import { useMemo, useState } from "react";
import { initials, colorFor } from "./avatar";

export default function SceneSetupView({
  result,
  title,
  wordCount = 0,
  onBack,
  onEnterScene,
  onStartChat,
}) {
  const characters = result?.characters ?? [];
  const chunkCount = result?.chunk_count ?? 0;
  const timelineSummaries = result?.timeline ?? [];

  const [mode, setMode] = useState("scene"); // "scene" | "chat"

  // Default selection: the two most-prominent characters (or the first one).
  const [selected, setSelected] = useState(
    () => new Set(characters.slice(0, Math.min(2, characters.length)).map((c) => c.id))
  );

  // Timeline: how far through the manuscript the characters "know". 100 = end.
  const [timeline, setTimeline] = useState(100);

  const selectedList = characters.filter((c) => selected.has(c.id));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "chat") {
        // Single-select: choosing a character replaces the current pick.
        return next.has(id) ? new Set() : new Set([id]);
      }
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const switchMode = (next) => {
    setMode(next);
    if (next === "chat") {
      // Collapse to a single selection when moving to one-on-one chat.
      setSelected((prev) => {
        const first = characters.find((c) => prev.has(c.id));
        return new Set(first ? [first.id] : []);
      });
    }
  };

  const selectAll = () => setSelected(new Set(characters.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const knowledgeChunk =
    chunkCount > 0 ? Math.max(1, Math.round((timeline / 100) * chunkCount)) : null;

  const timelineLabel =
    timeline >= 100
      ? "full manuscript"
      : `${timeline}% in${knowledgeChunk ? ` · up to chunk ${knowledgeChunk}` : ""}`;

  // "What happens" at the current point, from the ingestion-time timeline
  // summaries. The slider position maps to a chunk index; find the span it
  // falls in and show that span's one-line recap.
  const currentChunk =
    chunkCount > 0
      ? timeline >= 100
        ? chunkCount - 1
        : Math.max(0, (knowledgeChunk ?? 1) - 1)
      : 0;
  const timelineSummary = useMemo(() => {
    const span = timelineSummaries.find(
      (t) => currentChunk >= t.chunk_start && currentChunk <= t.chunk_end
    );
    return span?.summary || "";
  }, [timelineSummaries, currentChunk]);

  const canGo = mode === "chat" ? selectedList.length === 1 : selectedList.length >= 1;

  const knowledgeUpToChunk = timeline >= 100 ? null : knowledgeChunk;

  const submit = () => {
    if (!canGo) return;
    if (mode === "chat") {
      onStartChat?.(selectedList[0], { knowledgeUpToChunk });
      return;
    }
    onEnterScene?.({
      characterIds: selectedList.map((c) => c.id),
      situation: "",
      timeline,
      knowledgeUpToChunk,
    });
  };

  const namesLabel = useMemo(
    () => selectedList.map((c) => c.name).join(", "),
    [selectedList]
  );

  return (
    <div style={styles.shell}>
      {/* ── sidebar ─────────────────────────────────────────────── */}
      <aside style={styles.sidebar}>
        <div style={styles.sideHead}>
          <div style={styles.sideTitle}>{title || "Your manuscript"}</div>
          <div style={styles.sideMeta}>
            {wordCount > 0 && `${wordCount.toLocaleString()} words`}
            {chunkCount > 0 && ` · ${chunkCount} chunks`}
          </div>
        </div>

        <div style={styles.sideSectionRow}>
          <span style={styles.sideSectionLabel}>
            Characters · {selected.size}/{characters.length}
          </span>
          {mode === "scene" && (
            <span style={styles.sideActions}>
              <button style={styles.linkBtn} onClick={selectAll}>
                All
              </button>
              <span style={styles.dot}>·</span>
              <button style={styles.linkBtn} onClick={selectNone}>
                None
              </button>
            </span>
          )}
        </div>

        <div style={styles.charList}>
          {characters.length === 0 && (
            <p style={styles.emptyNote}>No characters extracted yet.</p>
          )}
          {characters.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                style={{ ...styles.charRow, ...(on ? styles.charRowOn : {}) }}
              >
                <span
                  style={{
                    ...styles.checkbox,
                    ...(on ? styles.checkboxOn : {}),
                  }}
                >
                  {on && "✓"}
                </span>
                <span
                  style={{
                    ...styles.avatar,
                    background: colorFor(c.id),
                    opacity: on ? 1 : 0.55,
                  }}
                >
                  {initials(c.name)}
                </span>
                <span style={{ ...styles.charName, opacity: on ? 1 : 0.55 }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── main ────────────────────────────────────────────────── */}
      <main style={styles.main}>
        <div style={styles.panel}>
          <div style={styles.topRow}>
            <div style={styles.modeToggle}>
              <button
                style={{
                  ...styles.modeBtn,
                  ...(mode === "scene" ? styles.modeBtnOn : {}),
                }}
                onClick={() => switchMode("scene")}
              >
                Scene
              </button>
              <button
                style={{
                  ...styles.modeBtn,
                  ...(mode === "chat" ? styles.modeBtnOn : {}),
                }}
                onClick={() => switchMode("chat")}
              >
                One-on-one chat
              </button>
            </div>
            <button style={styles.backBtn} onClick={onBack}>
              ↩ New manuscript
            </button>
          </div>

          <h1 style={styles.heading}>
            {mode === "chat" ? "Start a chat" : "Set the scene"}
          </h1>
          <p style={styles.subhead}>
            {selectedList.length === 0
              ? mode === "chat"
                ? "Pick a character from the left to talk to."
                : "Pick one or more characters from the left."
              : `${selectedList.length} character${
                  selectedList.length === 1 ? "" : "s"
                } selected — ${namesLabel}`}
          </p>

          <div style={styles.avatarRow}>
            {selectedList.map((c) => (
              <span
                key={c.id}
                title={c.name}
                style={{ ...styles.bigAvatar, background: colorFor(c.id) }}
              >
                {initials(c.name)}
              </span>
            ))}
            {mode === "scene" && (
              <span style={styles.addAvatar} title="Select more characters on the left">
                +
              </span>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Where are they in the story?</label>
            <input
              type="range"
              min={0}
              max={100}
              value={timeline}
              onChange={(e) => setTimeline(Number(e.target.value))}
              style={styles.slider}
            />
            {/* Show what's actually happening at this point, from the timeline
                summaries extracted at upload — not just a bare percentage. */}
            <div style={styles.timelineReadout}>
              {timelineSummary
                ? `“${timelineSummary}”`
                : timeline >= 100
                ? "They know how the whole story ends."
                : "They know the story up to this point."}
            </div>
            <div style={styles.timelineSub}>
              {timeline >= 100
                ? "The full manuscript"
                : `${timelineLabel}`}
            </div>
          </div>

          <button
            style={{ ...styles.enterBtn, ...(canGo ? {} : styles.enterBtnOff) }}
            onClick={submit}
            disabled={!canGo}
          >
            {mode === "chat" ? "Start chat →" : "Enter scene →"}
          </button>

          <p style={styles.groundNote}>
            {mode === "chat"
              ? "We'll build this character's persona from the manuscript when you start."
              : "We'll build each character's persona from the manuscript when you enter the scene."}
          </p>
        </div>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    height: "100vh",
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    color: "#1f2328",
    background: "#f4f2ec",
  },
  // ── sidebar ──
  sidebar: {
    width: 260,
    flexShrink: 0,
    background: "#161320",
    color: "#e7e4ef",
    display: "flex",
    flexDirection: "column",
    padding: "1.25rem 0",
    overflow: "hidden",
  },
  sideHead: { padding: "0 1.25rem 1rem" },
  sideTitle: { fontWeight: 700, fontSize: "1rem", lineHeight: 1.3 },
  sideMeta: { fontSize: "0.72rem", color: "#8b869c", marginTop: "0.15rem" },
  sideSectionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1.25rem 0.5rem",
  },
  sideSectionLabel: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#8b869c",
  },
  sideActions: { display: "flex", alignItems: "center", gap: "0.35rem" },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#8f7ff0",
    fontSize: "0.72rem",
    cursor: "pointer",
    fontFamily: "inherit",
    padding: 0,
  },
  dot: { color: "#4a4657", fontSize: "0.72rem" },
  charList: { flex: 1, overflowY: "auto", padding: "0.35rem 0.6rem" },
  emptyNote: { color: "#8b869c", fontSize: "0.8rem", padding: "0.5rem 0.65rem" },
  charRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    width: "100%",
    padding: "0.5rem 0.65rem",
    borderRadius: 8,
    border: "none",
    background: "none",
    color: "inherit",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    marginBottom: "0.1rem",
  },
  charRowOn: { background: "#211d30" },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: "1.5px solid #4a4657",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.65rem",
    color: "#fff",
    flexShrink: 0,
  },
  checkboxOn: { background: "#7c5cff", border: "1.5px solid #7c5cff" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "0.68rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  charName: {
    fontSize: "0.85rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  // ── main ──
  main: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    padding: "3rem",
  },
  panel: {
    maxWidth: 560,
    width: "100%",
    margin: "0 auto",
    alignSelf: "flex-start",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    marginBottom: "2.5rem",
  },
  modeToggle: {
    display: "inline-flex",
    background: "#ecebe4",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    background: "none",
    border: "none",
    borderRadius: 8,
    padding: "0.4rem 0.85rem",
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "#57606a",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  modeBtnOn: {
    background: "#fff",
    color: "#1f2328",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  },
  backBtn: {
    background: "none",
    border: "1px solid #dcdad0",
    borderRadius: 8,
    padding: "0.4rem 0.85rem",
    fontSize: "0.82rem",
    cursor: "pointer",
    color: "#57606a",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  heading: { margin: 0, fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em" },
  subhead: { margin: "0.35rem 0 1.25rem", color: "#8c959f", fontSize: "0.9rem" },
  avatarRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1.75rem",
    flexWrap: "wrap",
  },
  bigAvatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "0.8rem",
    fontWeight: 700,
  },
  addAvatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "1.5px dashed #c8c6bc",
    color: "#a9a79c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
  },
  field: { marginBottom: "1.5rem" },
  fieldLabel: {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#8c959f",
    marginBottom: "0.6rem",
  },
  slider: { width: "100%", accentColor: "#7c5cff", cursor: "pointer" },
  timelineReadout: {
    fontSize: "0.9rem",
    color: "#1f2328",
    fontStyle: "italic",
    marginTop: "0.5rem",
    lineHeight: 1.5,
  },
  timelineSub: {
    fontSize: "0.72rem",
    color: "#8c959f",
    marginTop: "0.25rem",
  },
  groundNote: {
    marginTop: "1rem",
    fontSize: "0.78rem",
    color: "#8c959f",
    lineHeight: 1.5,
  },
  enterBtn: {
    background: "#6a4bff",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "0.7rem 1.4rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: "0.5rem",
  },
  enterBtnOff: { background: "#c9c4e8", cursor: "not-allowed" },
};
