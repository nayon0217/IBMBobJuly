// UploadView.jsx — Landing page. Accepts a manuscript via file upload
// (.txt, .pdf, .docx) or paste-text, then triggers extraction.

import { useState, useRef, useCallback } from "react";
import { extract } from "./api";

const ACCEPTED = {
  "text/plain": ".txt",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
};

const ACCEPT_STRING = Object.values(ACCEPTED).join(",");

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

export default function UploadView({ onExtracted }) {
  const [mode, setMode] = useState("file"); // "file" | "paste"
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState(null); // null | "reading" | "extracting" | "done" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(""); // human-readable status line

  const inputRef = useRef();

  const isFileMode = mode === "file";
  const canSubmit =
    status !== "reading" &&
    status !== "extracting" &&
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
  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("reading");
    setProgress("Reading file…");

    try {
      let text = "";
      if (isFileMode) {
        if (!file) return;
        text = await readFileAsText(file);
      } else {
        text = pasteText.trim();
      }

      if (text.length < 50) {
        throw new Error("The manuscript seems too short. Please provide more text.");
      }

      const manuscriptTitle = title.trim() || (isFileMode ? file.name : "Untitled Manuscript");

      setStatus("extracting");
      setProgress("Sending to server for character extraction… this may take a minute.");

      const result = await extract(text, manuscriptTitle);

      setStatus("done");
      setProgress(`Done — ${result.characters?.length ?? 0} characters found.`);
      onExtracted(result, manuscriptTitle, text);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong.");
      setProgress("");
    }
  }

  return (
    <div style={styles.page}>
      {/* ── header ─────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.logo}>✦ Manuscript Characters</div>
        <p style={styles.tagline}>
          Upload your manuscript and bring your characters to life with AI.
        </p>
      </header>

      {/* ── card ───────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Upload your manuscript</h2>

        {/* mode tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(isFileMode ? styles.tabActive : {}) }}
            onClick={() => setMode("file")}
            type="button"
          >
            File upload
          </button>
          <button
            style={{ ...styles.tab, ...(!isFileMode ? styles.tabActive : {}) }}
            onClick={() => setMode("paste")}
            type="button"
          >
            Paste text
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* title field */}
          <label style={styles.label}>
            Manuscript title <span style={styles.optional}>(optional)</span>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Pride and Prejudice"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          {/* file drop zone */}
          {isFileMode && (
            <div
              style={{
                ...styles.dropzone,
                ...(dragging ? styles.dropzoneDragging : {}),
                ...(file ? styles.dropzoneHasFile : {}),
              }}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_STRING}
                style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && handleFileChosen(e.target.files[0])}
              />
              {file ? (
                <div style={styles.fileInfo}>
                  <span style={styles.fileIcon}>{fileIcon(file.name)}</span>
                  <div>
                    <div style={styles.fileName}>{file.name}</div>
                    <div style={styles.fileSize}>{formatSize(file.size)}</div>
                  </div>
                  <button
                    type="button"
                    style={styles.removeBtn}
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
                <div style={styles.dropPrompt}>
                  <div style={styles.dropIcon}>↑</div>
                  <div>
                    Drag &amp; drop your manuscript here, or{" "}
                    <span style={styles.browseLink}>browse</span>
                  </div>
                  <div style={styles.supportedTypes}>
                    Supported formats: .txt &nbsp;·&nbsp; .pdf &nbsp;·&nbsp; .docx
                  </div>
                </div>
              )}
            </div>
          )}

          {/* paste textarea */}
          {!isFileMode && (
            <label style={styles.label}>
              Paste manuscript text
              <textarea
                style={styles.textarea}
                placeholder="Paste the full text of your manuscript here…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={12}
              />
              <span style={styles.charCount}>{pasteText.length.toLocaleString()} characters</span>
            </label>
          )}

          {/* status / error */}
          {status === "extracting" && (
            <div style={styles.progressBar}>
              <div style={styles.progressFill} />
            </div>
          )}
          {progress && status !== "error" && (
            <p style={{ ...styles.statusMsg, color: status === "done" ? "#2d7d46" : "#555" }}>
              {progress}
            </p>
          )}
          {errorMsg && <p style={styles.errorMsg}>⚠ {errorMsg}</p>}

          {/* submit */}
          <button
            type="submit"
            style={{ ...styles.submitBtn, ...(canSubmit ? {} : styles.submitBtnDisabled) }}
            disabled={!canSubmit}
          >
            {status === "reading"
              ? "Reading…"
              : status === "extracting"
              ? "Extracting characters…"
              : "Process manuscript →"}
          </button>
        </form>
      </div>

      {/* ── how it works ───────────────────────────────────────────── */}
      <div style={styles.howItWorks}>
        <div style={styles.step}>
          <div style={styles.stepNum}>1</div>
          <div>Upload or paste your manuscript</div>
        </div>
        <div style={styles.stepArrow}>→</div>
        <div style={styles.step}>
          <div style={styles.stepNum}>2</div>
          <div>AI extracts your characters</div>
        </div>
        <div style={styles.stepArrow}>→</div>
        <div style={styles.step}>
          <div style={styles.stepNum}>3</div>
          <div>Chat with them or run scenes</div>
        </div>
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

// ── styles ───────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f8fa",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "3rem 1rem 4rem",
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    color: "#1f2328",
    lineHeight: 1.6,
  },
  header: {
    textAlign: "center",
    marginBottom: "2.5rem",
  },
  logo: {
    fontSize: "1.6rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: "0.4rem",
  },
  tagline: {
    color: "#57606a",
    fontSize: "1rem",
    margin: 0,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "2rem 2.5rem",
    width: "100%",
    maxWidth: 560,
    boxSizing: "border-box",
  },
  cardTitle: {
    margin: "0 0 1.25rem",
    fontSize: "1.15rem",
    fontWeight: 600,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "1.5rem",
    gap: 0,
  },
  tab: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "0.5rem 1rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "#57606a",
    marginBottom: -1,
  },
  tabActive: {
    color: "#3b82d4",
    borderBottomColor: "#3b82d4",
    fontWeight: 600,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  optional: {
    fontWeight: 400,
    color: "#57606a",
    fontSize: "0.8rem",
  },
  input: {
    border: "1px solid #d0d7de",
    borderRadius: 6,
    padding: "0.5rem 0.75rem",
    fontSize: "0.95rem",
    outline: "none",
    fontFamily: "inherit",
  },
  dropzone: {
    border: "2px dashed #d0d7de",
    borderRadius: 10,
    padding: "2rem 1.5rem",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    background: "#fafafa",
    textAlign: "center",
  },
  dropzoneDragging: {
    borderColor: "#3b82d4",
    background: "#eff6ff",
  },
  dropzoneHasFile: {
    borderColor: "#2d7d46",
    background: "#f0fdf4",
    textAlign: "left",
    cursor: "default",
  },
  dropPrompt: {
    color: "#57606a",
    fontSize: "0.9rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.4rem",
  },
  dropIcon: {
    fontSize: "1.75rem",
    color: "#b0bac5",
  },
  browseLink: {
    color: "#3b82d4",
    fontWeight: 500,
    textDecoration: "underline",
    cursor: "pointer",
  },
  supportedTypes: {
    fontSize: "0.78rem",
    color: "#8c959f",
    marginTop: "0.2rem",
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  fileIcon: {
    fontSize: "1.75rem",
    flexShrink: 0,
  },
  fileName: {
    fontWeight: 500,
    fontSize: "0.9rem",
    wordBreak: "break-all",
  },
  fileSize: {
    color: "#57606a",
    fontSize: "0.8rem",
  },
  removeBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#8c959f",
    fontSize: "1rem",
    flexShrink: 0,
    padding: "0.25rem",
  },
  textarea: {
    border: "1px solid #d0d7de",
    borderRadius: 6,
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    lineHeight: 1.55,
    color: "#1f2328",
  },
  charCount: {
    fontSize: "0.78rem",
    color: "#8c959f",
    alignSelf: "flex-end",
  },
  progressBar: {
    height: 4,
    background: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    width: "100%",
    background: "linear-gradient(90deg, #3b82d4 0%, #7c5cd8 50%, #3b82d4 100%)",
    backgroundSize: "200%",
    animation: "shimmer 1.4s linear infinite",
  },
  statusMsg: {
    margin: 0,
    fontSize: "0.85rem",
  },
  errorMsg: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#cf222e",
    background: "#fff0f0",
    border: "1px solid #ffcdd0",
    borderRadius: 6,
    padding: "0.5rem 0.75rem",
  },
  submitBtn: {
    background: "#1f2328",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.7rem 1.25rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-end",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  submitBtnDisabled: {
    background: "#b0bac5",
    cursor: "not-allowed",
  },
  howItWorks: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "2.5rem",
    color: "#57606a",
    fontSize: "0.85rem",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#e5e7eb",
    color: "#1f2328",
    fontSize: "0.75rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepArrow: {
    color: "#d0d7de",
    fontWeight: 300,
  },
};
