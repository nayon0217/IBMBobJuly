// UploadView.jsx — Landing page. Accepts a manuscript via file upload
// (.txt, .pdf, .docx) or paste-text, then triggers extraction.
// Styling: "The Reading Room" (see theme.css) — a warm, book-forward hero with
// a catalogued shelf, a slipcase upload card, and chapter-style steps.

import { useState, useRef, useCallback } from "react";
import { extractTextFromFile } from "./fileText";
import { useReveal } from "./useReveal";

const ACCEPTED = {
  "text/plain": ".txt",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
};

const ACCEPT_STRING = Object.values(ACCEPTED).join(",");

// Decorative spines for the hero shelf — archetypes, not extracted characters
// (the real cast is discovered only after a manuscript is processed).
const SHELF = [
  { n: "001", label: "The Protagonist", cls: "s1" },
  { n: "002", label: "The Rival", cls: "s2" },
  { n: "003", label: "The Confidante", cls: "s3" },
  { n: "004", label: "The Beloved", cls: "s4" },
  { n: "005", label: "The Mentor", cls: "s5" },
  { n: "006", label: "The Narrator", cls: "s6" },
];

export default function UploadView({ onSubmit }) {
  const [mode, setMode] = useState("file"); // "file" | "paste"
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState(null); // null | "reading" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(""); // human-readable status line

  const inputRef = useRef();
  const revealRef = useReveal();

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
      <div className="mc-wrap">
        {/* ── header ─────────────────────────────────────────────────── */}
        <header className="mc-top">
          <div className="mc-mark">Manuscript Characters<span className="dot">.</span></div>
          <p className="mc-tagline">Bring the voices in your manuscript to life with AI.</p>
        </header>

        {/* ── hero ───────────────────────────────────────────────────── */}
        <section className="mc-hero">
          <div className="mc-reveal">
            <div className="mc-chapter">
              <span className="mc-rule" />
              <span className="mc-eyebrow">Chapter I — The Cast</span>
            </div>
            <h1 className="mc-display">
              Every manuscript is a room <em>full of voices.</em>
            </h1>
            <p className="mc-lede">
              Upload your manuscript and bring your characters to life with AI —
              talk with them one-on-one, or set them loose together in a scene.
            </p>
            <div className="mc-filetags">
              <span className="mc-filetag">.TXT</span>
              <span className="mc-filetag">.PDF</span>
              <span className="mc-filetag">.DOCX</span>
            </div>
          </div>

          <div className="mc-shelf mc-reveal" style={{ "--d": "120ms" }}>
            <span className="mc-shelf-cap">Every cast has its shelf</span>
            <div className="mc-spines">
              {SHELF.map((s) => (
                <div key={s.n} className={`mc-spine ${s.cls}`}>
                  <small>{s.n}</small>
                  {s.label}
                </div>
              ))}
            </div>
            <div className="mc-shelf-base" />
          </div>
        </section>

        {/* ── intake / upload ────────────────────────────────────────── */}
        <section className="mc-section">
          <div className="mc-sec-head mc-reveal">
            <span className="mc-sec-num">§ 01</span>
            <h2>Submit a manuscript to the library</h2>
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
                  {status === "reading" ? "Reading…" : "Process manuscript →"}
                </button>
              </form>
            </div>

            {/* how it works — as chapters */}
            <div className="mc-chapters">
              <div className="mc-step-lg mc-reveal">
                <span className="mc-rn">i.</span>
                <div>
                  <h4>Deposit the text</h4>
                  <p>Upload or paste your manuscript. Nothing leaves the shelf without your say.</p>
                </div>
              </div>
              <div className="mc-step-lg mc-reveal" style={{ "--d": "90ms" }}>
                <span className="mc-rn">ii.</span>
                <div>
                  <h4>The cast is catalogued</h4>
                  <p>AI reads the whole work and extracts your characters, their aliases and the timeline.</p>
                </div>
              </div>
              <div className="mc-step-lg mc-reveal" style={{ "--d": "180ms" }}>
                <span className="mc-rn">iii.</span>
                <div>
                  <h4>Bring them off the page</h4>
                  <p>Chat with a character one-on-one, or stage several together in a live scene.</p>
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
