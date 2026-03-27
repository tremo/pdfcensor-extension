import { scanText, type ScanOptions, type ScanResult } from "./scanner";

/**
 * Extract text from a file and scan for PII.
 * Supports: TXT, CSV, PDF (via pdf.js), DOCX (via JSZip).
 *
 * PDF and DOCX parsing are loaded dynamically to keep bundle size small.
 */
export async function scanFile(
  file: File,
  options: ScanOptions
): Promise<ScanResult> {
  const text = await extractText(file);
  return scanText(text, options);
}

async function extractText(file: File): Promise<string> {
  const type = file.type;
  const name = file.name.toLowerCase();

  // Plain text files
  if (type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".csv")) {
    return file.text();
  }

  // PDF
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(file);
  }

  // DOCX
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return extractDocxText(file);
  }

  // Unsupported — return empty
  return "";
}

/**
 * Extract text from PDF using pdf.js.
 * pdf.js is loaded dynamically from the extension bundle.
 */
async function extractPdfText(file: File): Promise<string> {
  // Dynamic import — pdf.js must be added as a dependency
  const pdfjsLib = await import("pdfjs-dist");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: { str?: string }) => item.str || "")
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n\n");
}

/**
 * Extract text from DOCX using JSZip.
 * Parses document.xml for <w:t> text nodes.
 */
async function extractDocxText(file: File): Promise<string> {
  // Dynamic import — jszip must be added as a dependency
  const JSZip = (await import("jszip")).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return "";

  // Extract text from <w:t> tags
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;
  while ((match = regex.exec(docXml)) !== null) {
    textParts.push(match[1]);
  }

  return textParts.join(" ");
}
