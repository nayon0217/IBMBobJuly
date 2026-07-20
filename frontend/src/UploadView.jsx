// UploadView.jsx — Landing page. Accepts a manuscript via file upload
// (.txt, .pdf, .docx) or paste-text, then triggers extraction.
//
// Styling: "The Green Room" (see theme.css). The hero is set as a theatre
// playbill — script article over heavy roman name — above a full-bleed velvet
// couch with the cast waiting on it (TheatreCouch). The hero holds the whole
// viewport, so the intake form is reached only by scrolling: you see the room
// before you're asked for anything.

import { useState, useRef, useCallback, useEffect } from "react";
import { extractTextFromFile } from "./fileText";
import { useReveal } from "./useReveal";
import TheatreCouch from "./TheatreCouch";

const ACCEPTED = {
  "text/plain": ".txt",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
};

const ACCEPT_STRING = Object.values(ACCEPTED).join(",");

export default function UploadView({ onSubmit }) {
  const [mode, setMode] = useState("file"); // "file" | "paste"
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState(null); // null | "reading" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(""); // human-readable status line

  const [scrolled, setScrolled] = useState(false);

  const inputRef = useRef();
  const revealRef = useReveal();

  // The cue is an invitation, not a control — once the reader has taken it,
  // it gets out of the way.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isFileMode = mode === "file";
  const canSubmit =
    status !== "reading" &&
    (isFileMode ? file !== null : pasteText.trim().length > 20);

  // ── drag-and-drop ──────────────────────────────────────────────────────
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChosen(dropped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileChosen(f) {
    setFile(f);
    setErrorMsg("");
    setStatus(null);
    // pre-fill title from filename (strip extension)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  // ── submit ─────────────────────────────────────────────────────────────
  // We only read the file to text here; the actual extraction (and its loading
  // screen) is owned by App, which swaps to ProcessingView on hand-off.
  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("reading");
    setProgress("Reading file…");

    try {
      let text = "";
      if (isFileMode) {
        if (!file) return;
        text = await extractTextFromFile(file, setProgress);
      } else {
        text = pasteText.trim();
      }

      if (text.length < 50) {
        throw new Error("The manuscript seems too short. Please provide more text.");
      }

      const manuscriptTitle =
        title.trim() || (isFileMode ? file.name : "Untitled Manuscript");

      onSubmit(text, manuscriptTitle);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong.");
      setProgress("");
    }
  }

  return (
    <div className="mc-screen" ref={revealRef}>
      {/* ── hero: the bill, then the room it advertises ────────────────── */}
      <section className="mc-theatre">
        <div className="mc-wrap">
          <header className="mc-top">
            <div className="mc-mark">The Green Room</div>
            <p className="mc-tagline">Step backstage with the characters in your manuscript.</p>
          </header>

          <div className="mc-hero">
            <div className="mc-playbill mc-reveal">
              <span className="mc-eyebrow">Tonight — the cast of your manuscript</span>

              <span className="mc-billing">The</span>
              <h1 className="mc-headword">Green Room</h1>

              <div className="mc-bill-rule">
                <span className="mc-lozenge" />
              </div>

              <div className="mc-pron">
                <span className="phon">[ˈɡriːn ruːm]</span>
                <span className="pos">noun</span>
              </div>

              <div className="mc-entry-rule" />

              <div className="mc-senses">
                <div className="mc-sense">
                  <span className="mc-sense-n">1.</span>
                  <p>The room offstage where the cast wait before going on.</p>
                </div>
                <div className="mc-sense">
                  <span className="mc-sense-n">2.</span>
                  <p>
                    Where your characters wait. <em>Go in and talk to them.</em>
                  </p>
                </div>
              </div>
            </div>

            <div className="mc-reveal" style={{ "--d": "120ms" }}>
              <span className="mc-stage-cap">Every book has a green room</span>
              <div className="mc-stage-frame">
                <TheatreCouch />
              </div>
            </div>
          </div>
        </div>

        <a
          href="#intake"
          className={`mc-cue${scrolled ? " is-gone" : ""}`}
          aria-hidden={scrolled}
          tabIndex={scrolled ? -1 : 0}
        >
          <span>Submit a manuscript</span>
          <span className="mc-cue-arrow" />
        </a>
      </section>

      <div className="mc-wrap">
        {/* ── intake / upload ────────────────────────────────────────── */}
        <section className="mc-section" id="intake">
          <div className="mc-sec-head mc-reveal">
            <h2>Submit a manuscript, enter its green room</h2>
          </div>

          <div className="mc-hero" style={{ padding: 0, alignItems: "start" }}>
            {/* upload slipcase */}
            <div className="mc-slipcase mc-reveal">
              <h3 className="mc-slip-title">Upload your manuscript</h3>

              {/* mode tabs */}
              <div className="mc-tabs" role="tablist" style={{ marginBottom: "1.3rem" }}>
                <button
                  className={`mc-tab${isFileMode ? " is-on" : ""}`}
                  onClick={() => setMode("file")}
                  type="button"
                >
                  File upload
                </button>
                <button
                  className={`mc-tab${!isFileMode ? " is-on" : ""}`}
                  onClick={() => setMode("paste")}
                  type="button"
                >
                  Paste text
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* title field */}
                <label className="mc-field">
                  <span className="mc-label">
                    Manuscript title <span className="mc-opt">(optional)</span>
                  </span>
                  <input
                    className="mc-input"
                    type="text"
                    placeholder="e.g. Pride and Prejudice"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                {/* file drop zone */}
                {isFileMode && (
                  <div className="mc-field">
                    <span className="mc-label">Manuscript file</span>
                    <div
                      className={
                        "mc-drop" +
                        (dragging ? " is-drag" : "") +
                        (file ? " has-file" : "")
                      }
                      tabIndex={0}
                      role="button"
                      aria-label="Upload manuscript"
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      onClick={() => inputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          inputRef.current?.click();
                        }
                      }}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPT_STRING}
                        style={{ display: "none" }}
                        onChange={(e) =>
                          e.target.files[0] && handleFileChosen(e.target.files[0])
                        }
                      />
                      {file ? (
                        <div className="mc-fileinfo">
                          <span className="mc-fileicon">{fileIcon(file.name)}</span>
                          <div>
                            <div className="mc-filename">{file.name}</div>
                            <div className="mc-filesize">{formatSize(file.size)}</div>
                          </div>
                          <button
                            type="button"
                            className="mc-remove"
                            aria-label="Remove file"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFile(null);
                              setTitle("");
                              setStatus(null);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mc-drop-up">↑</div>
                          <p>
                            Drag &amp; drop your manuscript here, or{" "}
                            <span className="mc-browse">browse</span>
                          </p>
                          <div className="mc-fmt">
                            SUPPORTED · .TXT · .PDF · .DOCX
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* paste textarea */}
                {!isFileMode && (
                  <label className="mc-field">
                    <span className="mc-label">Paste manuscript text</span>
                    <textarea
                      className="mc-textarea"
                      placeholder="Paste the full text of your manuscript here…"
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={12}
                    />
                    <span className="mc-charcount">
                      {pasteText.length.toLocaleString()} characters
                    </span>
                  </label>
                )}

                {/* status / error */}
                {progress && status !== "error" && (
                  <p className="mc-status" style={{ marginBottom: "1rem" }}>{progress}</p>
                )}
                {errorMsg && (
                  <p className="mc-error" style={{ marginBottom: "1rem" }}>⚠ {errorMsg}</p>
                )}

                {/* submit */}
                <button
                  type="submit"
                  className="mc-btn mc-btn--primary mc-btn--block mc-btn--lg"
                  disabled={!canSubmit}
                >
                  {status === "reading" ? "Reading…" : "Open the green room →"}
                </button>
              </form>
            </div>

            {/* how it works — as chapters */}
            <div className="mc-chapters">
              <div className="mc-step-lg mc-reveal">
                <span className="mc-rn">i.</span>
                <div>
                  <h4>Sign in at the stage door</h4>
                  <p>Upload or paste your manuscript. Files are read in your browser — only the plain text is sent on.</p>
                </div>
              </div>
              <div className="mc-step-lg mc-reveal" style={{ "--d": "90ms" }}>
                <span className="mc-rn">ii.</span>
                <div>
                  <h4>The cast is called</h4>
                  <p>AI reads the whole work and calls every character to the room, matching their aliases and marking where each one appears.</p>
                </div>
              </div>
              <div className="mc-step-lg mc-reveal" style={{ "--d": "180ms" }}>
                <span className="mc-rn">iii.</span>
                <div>
                  <h4>Knock and go in</h4>
                  <p>Talk to one character alone, or put several on stage together and watch the scene play out.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────
function fileIcon(name) {
  if (name.endsWith(".pdf")) return "📄";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "📝";
  return "📃";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
