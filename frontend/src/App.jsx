// App.jsx — root component. Routes between the Upload/landing view and the
// Manuscript Workspace view based on whether extraction has completed.

import { useState } from "react";
import UploadView from "./UploadView";
import WorkspaceView from "./WorkspaceView";

export default function App() {
  // result: the ExtractResponse from the backend; null until processing done
  const [result, setResult] = useState(null);
  const [manuscriptTitle, setManuscriptTitle] = useState("");

  function handleExtracted(extractResult, title) {
    setManuscriptTitle(title);
    setResult(extractResult);
  }

  function handleReset() {
    setResult(null);
    setManuscriptTitle("");
  }

  if (result) {
    return (
      <WorkspaceView
        result={result}
        title={manuscriptTitle}
        onReset={handleReset}
      />
    );
  }

  return <UploadView onExtracted={handleExtracted} />;
}
