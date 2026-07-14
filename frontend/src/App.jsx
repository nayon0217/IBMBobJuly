// App.jsx — a deliberately plain harness that exercises the whole contract:
// extract characters, chat with one, run a scene. Person B grows this into the
// real UI (Week 2 chat view, Week 3 scene view). No styling effort spent here
// on purpose — polish is Week 4.

import { useState } from "react";
import { extract, chat, runScene } from "./api";

const SAMPLE = "Once upon a time, Elizabeth met Darcy in a crowded ballroom...";

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);

  const say = (line) => setLog((l) => [...l, line]);
  const guard = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      say(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const doExtract = () =>
    guard(async () => {
      const res = await extract(SAMPLE, "Demo");
      setCharacters(res.characters);
      say(`Extracted ${res.characters.length} characters.`);
    });

  const doChat = (id) =>
    guard(async () => {
      const res = await chat(id, "Who are you, really?");
      say(`${id}: ${res.reply.text}`);
    });

  const doScene = () =>
    guard(async () => {
      const ids = characters.slice(0, 2).map((c) => c.id);
      const res = await runScene(ids, "They are trapped by rain in a parlour.");
      res.dialogue.forEach((t) => say(`${t.speaker_id}: ${t.text}`));
      say(`💡 ${res.suggestion.summary}`);
      res.suggestion.what_happens_next.forEach((s) => say(`   → ${s}`));
    });

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui", lineHeight: 1.5 }}>
      <h1>Manuscript Characters — dev harness</h1>
      <p style={{ color: "#666" }}>
        Proves the API contract works. Replace with the real UI as you build.
      </p>

      <button onClick={doExtract} disabled={busy}>1. Extract characters</button>

      {characters.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          {characters.map((c) => (
            <button key={c.id} onClick={() => doChat(c.id)} disabled={busy} style={{ marginRight: 8 }}>
              Chat with {c.name}
            </button>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={doScene} disabled={busy}>3. Run a scene (first two)</button>
          </div>
        </div>
      )}

      <pre style={{ marginTop: "1.5rem", background: "#f5f5f5", padding: "1rem", whiteSpace: "pre-wrap" }}>
        {log.join("\n") || "Output appears here."}
      </pre>
    </main>
  );
}
