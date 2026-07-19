// ResultsView.jsx — shown after extraction. Features the top-5 most-prominent
// persona cards (the backend returns characters most-mentioned first) and lists
// the full cast below. From here the writer can start a scene or restart.
// Styled to match the scene page: warm canvas, colored avatars, purple accents.

import { initials, colorFor } from "./avatar";
import { T } from "./theme";

const TOP_N = 5;

export default function ResultsView({
  result,
  title,
  wordCount = 0,
  onReset,
  onOpenChat,
  onOpenScene,
}) {
  const characters = result?.characters ?? [];
  const chunkCount = result?.chunk_count ?? 0;
  const idToName = Object.fromEntries(characters.map((c) => [c.id, c.name]));

  const top = characters.slice(0, TOP_N);
  const rest = characters.slice(TOP_N);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>✦ Manuscript Characters</div>
          <h1 style={styles.title}>{title || "Your manuscript"}</h1>
          <p style={styles.meta}>
            {wordCount > 0 && `${wordCount.toLocaleString()} words · `}
            {chunkCount > 0 && `${chunkCount} chunks · `}
            {characters.length} character{characters.length === 1 ? "" : "s"} found
          </p>
        </div>
        <div style={styles.headerActions}>
          {onOpenScene && characters.length > 0 && (
            <button style={styles.primaryBtn} onClick={onOpenScene}>
              Create a scene →
            </button>
          )}
          <button style={styles.secondaryBtn} onClick={onReset}>
            ↩ New manuscript
          </button>
        </div>
      </header>

      {characters.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>◎</div>
          <p style={styles.emptyTitle}>No characters were extracted</p>
          <p style={styles.emptyHint}>
            Try a longer manuscript, or one with more dialogue and named
            characters.
          </p>
        </div>
      ) : (
        <main style={styles.main}>
          <section>
            <h2 style={styles.sectionTitle}>
              {top.length < TOP_N ? "Persona cards" : "Top 5 characters"}
            </h2>
            <div style={styles.cardGrid}>
              {top.map((c) => (
                <PersonaCard
                  key={c.id}
                  c={c}
                  idToName={idToName}
                  onOpenChat={onOpenChat}
                />
              ))}
            </div>
          </section>

          {rest.length > 0 && (
            <section style={{ marginTop: "2.5rem" }}>
              <h2 style={styles.sectionTitle}>
                All characters ({characters.length})
              </h2>
              <div style={styles.list}>
                {rest.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    style={styles.listRow}
                    onClick={() => onOpenChat?.(c)}
                    title={`Chat with ${c.name}`}
                  >
                    <span style={{ ...styles.listAvatar, background: colorFor(c.id) }}>
                      {initials(c.name)}
                    </span>
                    <span style={styles.listInfo}>
                      <span style={styles.listName}>{c.name}</span>
                      {c.traits?.length > 0 && (
                        <span style={styles.listTraits}>
                          {c.traits.slice(0, 3).join(", ")}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function PersonaCard({ c, idToName, onOpenChat }) {
  const relationships = Object.entries(c.relationships || {});
  return (
    <article
      style={{ ...styles.card, ...(onOpenChat ? styles.cardClickable : {}) }}
      onClick={() => onOpenChat?.(c)}
      role={onOpenChat ? "button" : undefined}
      title={onOpenChat ? `Chat with ${c.name}` : undefined}
    >
      <div style={styles.cardHead}>
        <div style={{ ...styles.avatar, background: colorFor(c.id) }}>
          {initials(c.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={styles.cardName}>{c.name}</div>
          {typeof c.first_appearance_chunk === "number" && (
            <div style={styles.cardSub}>
              first appears in chunk {c.first_appearance_chunk}
            </div>
          )}
        </div>
      </div>

      {c.traits?.length > 0 && (
        <div style={styles.chips}>
          {c.traits.map((t) => (
            <span key={t} style={styles.chip}>
              {t}
            </span>
          ))}
        </div>
      )}

      {c.physical && (
        <p style={styles.field}>
          <span style={styles.fieldLabel}>Appearance</span>
          <span style={styles.physicalText}>{c.physical}</span>
        </p>
      )}

      {c.voice && (
        <p style={styles.voice}>
          <span style={styles.fieldLabel}>Voice</span>
          {c.voice}
        </p>
      )}

      {c.motivations?.length > 0 && (
        <div style={styles.field}>
          <span style={styles.fieldLabel}>Motivations</span>
          <ul style={styles.motList}>
            {c.motivations.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {relationships.length > 0 && (
        <div style={styles.field}>
          <span style={styles.fieldLabel}>Relationships</span>
          <div style={styles.rels}>
            {relationships.map(([id, nature]) => (
              <div key={id} style={styles.relRow}>
                <span style={styles.relName}>{idToName[id] || id}</span>
                <span style={styles.relNature}>{nature}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onOpenChat && <div style={styles.cardCta}>Chat with {c.name} →</div>}
    </article>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: T.bg,
    fontFamily: T.font,
    color: T.ink,
    lineHeight: 1.6,
    paddingBottom: "4rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    flexWrap: "wrap",
    padding: "1.75rem 2rem 1.25rem",
    background: T.surface,
    borderBottom: `1px solid ${T.border}`,
  },
  headerLeft: { minWidth: 0 },
  logo: {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: T.inkMuted,
    letterSpacing: "0.02em",
    marginBottom: "0.35rem",
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  meta: { margin: "0.25rem 0 0", color: T.inkSoft, fontSize: "0.85rem" },
  headerActions: { display: "flex", gap: "0.6rem", flexShrink: 0 },
  primaryBtn: {
    background: T.accent,
    color: "#fff",
    border: "none",
    borderRadius: T.radius,
    padding: "0.55rem 1.1rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  secondaryBtn: {
    background: "none",
    border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    padding: "0.55rem 1.1rem",
    fontSize: "0.85rem",
    cursor: "pointer",
    color: T.inkSoft,
    fontFamily: "inherit",
  },
  main: { maxWidth: 1080, margin: "0 auto", padding: "2rem" },
  sectionTitle: {
    fontSize: "1.05rem",
    fontWeight: 700,
    margin: "0 0 1rem",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "1.25rem",
  },
  card: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
  },
  cardClickable: { cursor: "pointer" },
  cardCta: {
    marginTop: "auto",
    paddingTop: "0.75rem",
    borderTop: `1px solid ${T.border}`,
    color: T.accent,
    fontSize: "0.82rem",
    fontWeight: 600,
  },
  cardHead: { display: "flex", alignItems: "center", gap: "0.75rem" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: "1.05rem",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardSub: { fontSize: "0.72rem", color: T.inkMuted },
  chips: { display: "flex", flexWrap: "wrap", gap: "0.35rem" },
  chip: {
    background: T.accentBg,
    color: "#5a44c4",
    borderRadius: 999,
    padding: "0.2rem 0.6rem",
    fontSize: "0.75rem",
    fontWeight: 500,
  },
  voice: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#3d4650",
    fontStyle: "italic",
  },
  physicalText: { fontSize: "0.85rem", color: "#3d4650" },
  field: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  fieldLabel: {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: T.inkMuted,
    marginRight: "0.4rem",
  },
  motList: {
    margin: 0,
    paddingLeft: "1.1rem",
    fontSize: "0.85rem",
    color: "#3d4650",
  },
  rels: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  relRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.75rem",
    fontSize: "0.82rem",
  },
  relName: { fontWeight: 600, color: T.ink, flexShrink: 0 },
  relNature: { color: T.inkSoft, textAlign: "right" },
  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "0.6rem",
  },
  listRow: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: "0.6rem 0.85rem",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    textAlign: "left",
    width: "100%",
    cursor: "pointer",
    fontFamily: "inherit",
    color: "inherit",
  },
  listAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.68rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0.1rem",
    minWidth: 0,
  },
  listName: { fontWeight: 600, fontSize: "0.88rem" },
  listTraits: {
    fontSize: "0.75rem",
    color: T.inkMuted,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  empty: { textAlign: "center", padding: "5rem 1rem", color: T.inkSoft },
  emptyIcon: { fontSize: "2.5rem", color: T.borderStrong, marginBottom: "0.5rem" },
  emptyTitle: { fontWeight: 600, fontSize: "1.05rem", margin: "0 0 0.35rem" },
  emptyHint: { fontSize: "0.9rem", margin: 0 },
};
