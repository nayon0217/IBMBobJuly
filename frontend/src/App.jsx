// App.jsx — root component and screen router. The user moves through screens:
// Upload -> Processing (extract: discover the cast) -> Scene setup. From scene
// setup they pick who to chat/stage with; entering a chat or scene grounds the
// selected persona cards on demand (Grounding screen) before rendering.

import { useEffect, useState } from "react";
import UploadView from "./UploadView";
import ProcessingView from "./ProcessingView";
import PersonaLoadingView from "./PersonaLoadingView";
import ChatView from "./ChatView";
import SceneSetupView from "./SceneSetupView";
import SceneView from "./SceneView";
import { endSession, extract, personas } from "./api";

export default function App() {
  // upload | processing | sceneSetup | grounding | chat | scene
  const [phase, setPhase] = useState("upload");
  const [result, setResult] = useState(null);
  const [title, setTitle] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState("");

  // Grounded (Stage 4) persona cards for the active chat/scene.
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [activeKnowledge, setActiveKnowledge] = useState(null);
  const [groundedCast, setGroundedCast] = useState([]);
  const [sceneConfig, setSceneConfig] = useState(null);

  // Grounding-screen state.
  const [groundingMode, setGroundingMode] = useState("chat"); // "chat" | "scene"
  const [groundingNames, setGroundingNames] = useState([]);
  const [groundError, setGroundError] = useState("");

  // A manuscript must not outlive the session that uploaded it, and closing the
  // tab is the usual way a session ends — so tear down server-side state there
  // too, not just when the writer explicitly starts over.
  useEffect(() => {
    const teardown = () => endSession();
    window.addEventListener("beforeunload", teardown);
    return () => window.removeEventListener("beforeunload", teardown);
  }, []);

  async function handleSubmit(text, manuscriptTitle) {
    setTitle(manuscriptTitle);
    setWordCount(text ? text.trim().split(/\s+/).filter(Boolean).length : 0);
    setError("");
    setResult(null);
    setPhase("processing");
    try {
      const res = await extract(text, manuscriptTitle);
      setResult(res);
      setPhase("sceneSetup");
    } catch (e) {
      // Stay on the processing screen and surface the error there.
      setError(e.message || "Extraction failed.");
    }
  }

  function reset() {
    endSession();
    setPhase("upload");
    setResult(null);
    setTitle("");
    setWordCount(0);
    setError("");
    setActiveCharacter(null);
    setGroundedCast([]);
    setSceneConfig(null);
  }

  const nameFor = (id) =>
    result?.characters?.find((c) => c.id === id)?.name || id;

  // Entering a chat grounds the chosen character (Stage 4) at the selected
  // timeline point before rendering.
  async function openChat(character, opts = {}) {
    const knowledge = opts.knowledgeUpToChunk ?? null;
    setGroundingMode("chat");
    setGroundingNames([character.name]);
    setGroundError("");
    setActiveKnowledge(knowledge);
    setPhase("grounding");
    try {
      const res = await personas([character.id], knowledge);
      setActiveCharacter(res.characters[0]);
      setPhase("chat");
    } catch (e) {
      setGroundError(e.message || "Could not build the persona.");
    }
  }

  // Entering a scene grounds the whole selected cast before rendering.
  async function enterScene(config) {
    setSceneConfig(config);
    setGroundingMode("scene");
    setGroundingNames(config.characterIds.map(nameFor));
    setGroundError("");
    setPhase("grounding");
    try {
      const res = await personas(
        config.characterIds,
        config.knowledgeUpToChunk ?? null
      );
      setGroundedCast(res.characters);
      setPhase("scene");
    } catch (e) {
      setGroundError(e.message || "Could not build the personas.");
    }
  }

  if (phase === "processing") {
    return <ProcessingView title={title} error={error} onBack={reset} />;
  }

  if (phase === "grounding") {
    return (
      <PersonaLoadingView
        names={groundingNames}
        mode={groundingMode}
        error={groundError}
        onBack={() => setPhase("sceneSetup")}
      />
    );
  }

  if (phase === "chat") {
    return (
      <ChatView
        character={activeCharacter}
        characters={activeCharacter ? [activeCharacter] : []}
        title={title}
        knowledgeUpToChunk={activeKnowledge}
        onBack={() => setPhase("sceneSetup")}
      />
    );
  }

  if (phase === "sceneSetup") {
    return (
      <SceneSetupView
        result={result}
        title={title}
        wordCount={wordCount}
        onBack={reset}
        onStartChat={openChat}
        onEnterScene={enterScene}
      />
    );
  }

  if (phase === "scene") {
    return (
      <SceneView
        characters={groundedCast}
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
