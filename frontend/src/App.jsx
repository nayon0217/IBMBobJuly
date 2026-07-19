// App.jsx — root component and screen router. The user moves through screens:
// Upload -> Processing (loading) -> Results (persona cards). From results they
// can chat one-on-one with a character, or set up and enter a multi-character
// scene.

import { useState } from "react";
import UploadView from "./UploadView";
import ProcessingView from "./ProcessingView";
import ResultsView from "./ResultsView";
import ChatView from "./ChatView";
import SceneSetupView from "./SceneSetupView";
import SceneView from "./SceneView";
import { extract } from "./api";

export default function App() {
  const [phase, setPhase] = useState("upload"); // upload | processing | results | chat | sceneSetup | scene
  const [result, setResult] = useState(null);
  const [title, setTitle] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState("");
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [sceneConfig, setSceneConfig] = useState(null);

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
    setSceneConfig(null);
  }

  function openChat(character) {
    setActiveCharacter(character);
    setPhase("chat");
  }

  function enterScene(config) {
    setSceneConfig(config);
    setPhase("scene");
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
        onOpenScene={() => setPhase("sceneSetup")}
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

  if (phase === "sceneSetup") {
    return (
      <SceneSetupView
        result={result}
        title={title}
        wordCount={wordCount}
        onBack={() => setPhase("results")}
        onStartChat={openChat}
        onEnterScene={enterScene}
      />
    );
  }

  if (phase === "scene") {
    return (
      <SceneView
        characters={result?.characters ?? []}
        characterIds={sceneConfig?.characterIds ?? []}
        title={title}
        situation={sceneConfig?.situation ?? ""}
        knowledgeUpToChunk={sceneConfig?.knowledgeUpToChunk ?? null}
        onBack={() => setPhase("sceneSetup")}
      />
    );
  }

  return <UploadView onSubmit={handleSubmit} />;
}
