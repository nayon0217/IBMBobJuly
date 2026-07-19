// App.jsx — root component and screen router. The user moves through three
// screens: Upload -> Processing (loading) -> Results (persona cards). From the
// results screen they can open the full workspace (chat/scene) or start over.

import { useState } from "react";
import UploadView from "./UploadView";
import ProcessingView from "./ProcessingView";
import ResultsView from "./ResultsView";
import ChatView from "./ChatView";
import WorkspaceView from "./WorkspaceView";
import { extract } from "./api";

export default function App() {
  const [phase, setPhase] = useState("upload"); // upload | processing | results | chat | workspace
  const [result, setResult] = useState(null);
  const [title, setTitle] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState("");
  const [activeCharacter, setActiveCharacter] = useState(null);

  async function handleSubmit(text, manuscriptTitle) {
    setTitle(manuscriptTitle);
    setWordCount(text ? text.trim().split(/\s+/).filter(Boolean).length : 0);
    setError("");
    setResult(null);
    setPhase("processing");
    try {
      const res = await extract(text, manuscriptTitle);
      setResult(res);
      setPhase("results");
    } catch (e) {
      // Stay on the processing screen and surface the error there.
      setError(e.message || "Extraction failed.");
    }
  }

  function reset() {
    setPhase("upload");
    setResult(null);
    setTitle("");
    setWordCount(0);
    setError("");
    setActiveCharacter(null);
  }

  function openChat(character) {
    setActiveCharacter(character);
    setPhase("chat");
  }

  if (phase === "processing") {
    return (
      <ProcessingView
        title={title}
        error={error}
        onBack={reset}
      />
    );
  }

  if (phase === "results") {
    return (
      <ResultsView
        result={result}
        title={title}
        wordCount={wordCount}
        onReset={reset}
        onOpenChat={openChat}
        onOpenWorkspace={() => setPhase("workspace")}
      />
    );
  }

  if (phase === "chat") {
    return (
      <ChatView
        character={activeCharacter}
        characters={result?.characters ?? []}
        title={title}
        onBack={() => setPhase("results")}
      />
    );
  }

  if (phase === "workspace") {
    return (
      <WorkspaceView
        result={result}
        title={title}
        wordCount={wordCount}
        onReset={reset}
      />
    );
  }

  return <UploadView onSubmit={handleSubmit} />;
}
