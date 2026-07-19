// WorkspaceView.jsx — Shown after manuscript is processed. Hosts the
// persistent top bar (title + timeline slider), character checklist sidebar,
// and the main Chat / Scene panel.
// This is the stub; full chat/scene panels are built in later iterations.

import { useState } from "react";

export default function WorkspaceView({ result, title, onReset }) {
  const characters = result?.characters ?? [];
  const chunkCount = result?.chunk_count ?? 0;
  const wordCount = result?.word_count ?? 0;

  // Activated characters: default top-5 by appearance, or all if ≤ 5
  const [activated, setActivated] = useState(() => {
    const ids = new Set(characters.slice(0, 5).map((c) => c.id));
    return ids;
  });

  // Timeline: 0–100 (percentage through manuscript)
  const [timeline, setTimeline] = useState(100);

  const toggleCharacter = (id) =>
    setActivated((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () => setActivated(new Set(characters.map((c) => c.id)));
  const selectNone = () => setActivated(new Set());

  const activatedList = characters.filter((c) => activated.has(c.id));

  return (
    <div style={styles.shell}>
      {/* ── top bar ──────────────────────────────────────────────── */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.logo}>✦ MC</span>
          <div style={styles.manuscriptMeta}>
            <span style={styles.manuscriptTitle}>{title}</span>
            <span style={styles.metaDetail}>
              {wordCount > 0 && `${wordCount.toLocaleString()} words · `}
              {chunkCount > 0 && `${chunkCount} chunks · `}
              {characters.length} characters
            </span>
          </div>
        </div>

        <div style={styles.timelineWrap}>
          <label style={styles.timelineLabel}>
            Timeline — {timeline === 100 ? "full manuscript" : `${timeline}% through`}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={timeline}
            onChange={(e) => setTimeline(Number(e.target.value))}
            style={styles.slider}
          />
        </div>

        <button style={styles.resetBtn} onClick={onReset} title="Upload a new manuscript">
          ↩ New manuscript
        </button>
      </header>

      {/* ── body ─────────────────────────────────────────────────── */}
      <div style={styles.body}>
        {/* sidebar — character checklist */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={styles.sidebarTitle}>Characters</span>
            <span style={styles.sidebarActions}>
              <button style={styles.microBtn} onClick={selectAll}>All</button>
              <button style={styles.microBtn} onClick={selectNone}>None</button>
            </span>
          </div>

          <div style={styles.characterList}>
            {characters.length === 0 && (
              <p style={styles.emptyNote}>No characters extracted yet.</p>
            )}
            {characters.map((c) => (
              <label key={c.id} style={styles.characterRow}>
                <input
                  type="checkbox"
                  checked={activated.has(c.id)}
                  onChange={() => toggleCharacter(c.id)}
                  style={styles.checkbox}
                />
                <div style={styles.characterInfo}>
                  <span style={styles.characterName}>{c.name}</span>
                  {c.traits && c.traits.length > 0 && (
                    <span style={styles.characterTraits}>
                      {c.traits.slice(0, 3).join(", ")}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </aside>

        {/* main panel */}
        <main style={styles.main}>
          {activatedList.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>◎</div>
              <p style={styles.emptyTitle}>No characters selected</p>
              <p style={styles.emptyHint}>
                Check one or more characters in the sidebar to start chatting or
                run a scene.
              </p>
            </div>
          ) : (
            <div style={styles.placeholder}>
              <h2 style={styles.placeholderTitle}>Workspace ready</h2>
              <p style={styles.placeholderSub}>
                {activatedList.length} character{activatedList.length > 1 ? "s" : ""} activated
                &nbsp;·&nbsp; timeline at {timeline === 100 ? "full manuscript" : `${timeline}%`}
              </p>
              <p style={{ color: "#8c959f", fontSize: "0.875rem", marginTop: "1rem" }}>
                Chat and Scene panels coming soon. The API contract is already wired
                — see <code>api.js</code>.
              </p>
              <div style={styles.activatedCards}>
                {activatedList.map((c) => (
                  <div key={c.id} style={styles.characterCard}>
                    <div style={styles.cardName}>{c.name}</div>
                    {c.traits && (
                      <div style={styles.cardTraits}>{c.traits.slice(0, 4).join(" · ")}</div>
                    )}
                    {c.motivations && (
                      <div style={styles.cardMotivation}>{c.motivations}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── styles ───────────────────────────────────────────────────────────────
const styles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    color: "#1f2328",
    background: "#f7f8fa",
    lineHeight: 1.6,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
    padding: "0 1.5rem",
    height: 56,
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    minWidth: 0,
  },
  logo: {
    fontWeight: 700,
    fontSize: "1rem",
    flexShrink: 0,
  },
  manuscriptMeta: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.25,
    minWidth: 0,
  },
  manuscriptTitle: {
    fontWeight: 600,
    fontSize: "0.9rem",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 220,
  },
  metaDetail: {
    fontSize: "0.75rem",
    color: "#57606a",
  },
  timelineWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    maxWidth: 280,
    minWidth: 120,
  },
  timelineLabel: {
    fontSize: "0.72rem",
    color: "#57606a",
    userSelect: "none",
  },
  slider: {
    width: "100%",
    accentColor: "#3b82d4",
    cursor: "pointer",
  },
  resetBtn: {
    marginLeft: "auto",
    background: "none",
    border: "1px solid #d0d7de",
    borderRadius: 6,
    padding: "0.3rem 0.75rem",
    fontSize: "0.8rem",
    cursor: "pointer",
    color: "#57606a",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: "#fff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1rem 0.5rem",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  sidebarTitle: {
    fontWeight: 600,
    fontSize: "0.85rem",
  },
  sidebarActions: {
    display: "flex",
    gap: "0.4rem",
  },
  microBtn: {
    background: "none",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "0.15rem 0.45rem",
    fontSize: "0.72rem",
    cursor: "pointer",
    color: "#57606a",
    fontFamily: "inherit",
  },
  characterList: {
    overflowY: "auto",
    flex: 1,
    padding: "0.4rem 0",
  },
  characterRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    padding: "0.45rem 1rem",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  checkbox: {
    marginTop: 3,
    accentColor: "#3b82d4",
    flexShrink: 0,
  },
  characterInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  },
  characterName: {
    fontWeight: 500,
  },
  characterTraits: {
    fontSize: "0.75rem",
    color: "#8c959f",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  emptyNote: {
    color: "#8c959f",
    fontSize: "0.8rem",
    padding: "1rem",
    margin: 0,
  },
  main: {
    flex: 1,
    overflow: "auto",
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
  },
  emptyState: {
    margin: "auto",
    textAlign: "center",
    maxWidth: 360,
  },
  emptyIcon: {
    fontSize: "2.5rem",
    color: "#d0d7de",
    marginBottom: "0.75rem",
  },
  emptyTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    margin: "0 0 0.4rem",
  },
  emptyHint: {
    color: "#57606a",
    fontSize: "0.875rem",
    margin: 0,
  },
  placeholder: {
    maxWidth: 640,
  },
  placeholderTitle: {
    margin: "0 0 0.25rem",
    fontSize: "1.25rem",
    fontWeight: 700,
  },
  placeholderSub: {
    color: "#57606a",
    margin: 0,
    fontSize: "0.9rem",
  },
  activatedCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    marginTop: "1.5rem",
  },
  characterCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "1rem",
  },
  cardName: {
    fontWeight: 600,
    marginBottom: "0.3rem",
    fontSize: "0.95rem",
  },
  cardTraits: {
    fontSize: "0.78rem",
    color: "#57606a",
    marginBottom: "0.4rem",
  },
  cardMotivation: {
    fontSize: "0.8rem",
    color: "#57606a",
    fontStyle: "italic",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};
