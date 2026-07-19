// SceneSetupView.jsx — "Set the scene". The writer picks who's involved and
// where in the story to drop them, then enters the scene. Because the app also
// has a one-on-one chat feature, this page carries a mode toggle: in "Scene"
// mode the writer combines one or more characters into a live stage; in "Chat"
// mode they pick a single character and open the classic chat thread.
//
// This page lists the *whole* cast discovered at upload. Persona cards no
// longer exist here — they're grounded on demand when a chat/scene is entered.
// Styling: "The Reading Room" (theme.css) — an espresso roster beside a warm
// paper stage-setting panel.

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
    <div className="mc-screen mc-setup-shell">
      {/* ── roster (espresso sidebar) ───────────────────────────────── */}
      <aside className="mc-roster">
        <div className="mc-roster-head">
          <div className="mc-roster-title">{title || "Your manuscript"}</div>
          <div className="mc-roster-meta">
            {wordCount > 0 && `${wordCount.toLocaleString()} words`}
            {chunkCount > 0 && ` · ${chunkCount} chunks`}
          </div>
        </div>

        <div className="mc-roster-row">
          <span className="mc-roster-label">
            Characters · {selected.size}/{characters.length}
          </span>
          {mode === "scene" && (
            <span>
              <button className="mc-link" onClick={selectAll}>All</button>
              <span className="mc-dot-sep">·</span>
              <button className="mc-link" onClick={selectNone}>None</button>
            </span>
          )}
        </div>

        <div className="mc-cast-list">
          {characters.length === 0 && (
            <p className="mc-empty-note">No characters extracted yet.</p>
          )}
          {characters.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={"mc-cast-row" + (on ? " is-on" : "")}
              >
                <span className="mc-check">{on && "✓"}</span>
                <span
                  className="mc-medallion"
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: ".68rem",
                    background: colorFor(c.id),
                    opacity: on ? 1 : 0.55,
                  }}
                >
                  {initials(c.name)}
                </span>
                <span className="mc-cast-name" style={{ opacity: on ? 1 : 0.55 }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── main (warm paper panel) ─────────────────────────────────── */}
      <main className="mc-setup-main">
        <div className="mc-panel">
          <div className="mc-toprow">
            <div className="mc-modes">
              <button
                className={"mc-mode" + (mode === "scene" ? " is-on" : "")}
                onClick={() => switchMode("scene")}
              >
                Scene
              </button>
              <button
                className={"mc-mode" + (mode === "chat" ? " is-on" : "")}
                onClick={() => switchMode("chat")}
              >
                One-on-one chat
              </button>
            </div>
            <button className="mc-btn mc-btn--ghost" onClick={onBack}>
              ↩ New manuscript
            </button>
          </div>

          <div className="mc-chapter">
            <span className="mc-rule" />
            <span className="mc-eyebrow">
              {mode === "chat" ? "One-on-one" : "The Stage"}
            </span>
          </div>
          <h1 className="mc-heading">
            {mode === "chat" ? "Start a chat" : "Set the scene"}
          </h1>
          <p className="mc-subhead">
            {selectedList.length === 0
              ? mode === "chat"
                ? "Pick a character from the left to talk to."
                : "Pick one or more characters from the left."
              : `${selectedList.length} character${
                  selectedList.length === 1 ? "" : "s"
                } selected — ${namesLabel}`}
          </p>

          <div className="mc-avatar-row">
            {selectedList.map((c) => (
              <span
                key={c.id}
                title={c.name}
                className="mc-medallion mc-big-avatar"
                style={{ background: colorFor(c.id) }}
              >
                {initials(c.name)}
              </span>
            ))}
            {mode === "scene" && (
              <span className="mc-add-avatar" title="Select more characters on the left">
                +
              </span>
            )}
          </div>

          <div className="mc-field-block">
            <label className="mc-field-label">Where are they in the story?</label>
            <input
              type="range"
              min={0}
              max={100}
              value={timeline}
              onChange={(e) => setTimeline(Number(e.target.value))}
              className="mc-slider"
              aria-label="Timeline position"
            />
            {/* Show what's actually happening at this point, from the timeline
                summaries extracted at upload — not just a bare percentage. */}
            <div className="mc-readout">
              {timelineSummary
                ? `“${timelineSummary}”`
                : timeline >= 100
                ? "They know how the whole story ends."
                : "They know the story up to this point."}
            </div>
            <div className="mc-timeline-sub">
              {timeline >= 100 ? "The full manuscript" : `${timelineLabel}`}
            </div>
          </div>

          <button
            className="mc-btn mc-btn--accent mc-btn--lg"
            onClick={submit}
            disabled={!canGo}
          >
            {mode === "chat" ? "Start chat →" : "Enter scene →"}
          </button>

          <p className="mc-ground-note">
            {mode === "chat"
              ? "We'll build this character's persona from the manuscript when you start."
              : "We'll build each character's persona from the manuscript when you enter the scene."}
          </p>
        </div>
      </main>
    </div>
  );
}
