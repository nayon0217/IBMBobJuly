// fileText.js — turn an uploaded manuscript file into plain text before it is
// sent to POST /extract (the backend contract only accepts text).
// .txt reads directly; .pdf goes through pdf.js; .docx through mammoth.
// Parsers are dynamically imported so they only download when actually needed.

async function pdfToText(file, onProgress) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  // Keep the loading task: in pdf.js the cleanup method lives on the task, not
  // on the document proxy (calling doc.destroy() throws "not a function").
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(`Reading PDF — page ${i} of ${doc.numPages}…`);
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // pdf.js returns positioned fragments; hasEOL marks visual line breaks.
      let pageText = "";
      for (const item of content.items) {
        pageText += item.str;
        if (item.hasEOL) pageText += "\n";
      }
      pages.push(pageText.trim());
    }
    return pages.join("\n\n");
  } finally {
    await loadingTask.destroy();
  }
}

async function docxToText(file) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

function txtToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

/**
 * Extract plain text from an uploaded manuscript file.
 * @param {File} file - .txt, .pdf, or .docx
 * @param {(msg: string) => void} [onProgress] - human-readable status updates
 * @returns {Promise<string>}
 */
export async function extractTextFromFile(file, onProgress) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return pdfToText(file, onProgress);
  if (name.endsWith(".docx")) return docxToText(file);
  if (name.endsWith(".doc")) {
    throw new Error(
      "Legacy .doc files aren't supported — please save as .docx, .pdf, or .txt."
    );
  }
  return txtToText(file);
}
