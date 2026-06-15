import pdfParse from "pdf-parse";

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsePdfResult {
  pages: ParsedPage[];
  pageCount: number;
}

export async function parsePdf(buffer: Buffer): Promise<ParsePdfResult> {
  const data = await pdfParse(buffer);

  const textByPage: string[] = [];

  if (data.text) {
    textByPage.push(data.text);
  }

  if (typeof data.info?.PDFFormatVersion === "undefined" && !data.text) {
    throw new Error("Unable to extract text from PDF");
  }

  const pageCount = data.numpages || textByPage.length || 0;

  const pages: ParsedPage[] = [];
  for (let i = 0; i < pageCount; i++) {
    const text = textByPage[i] ?? "";
    pages.push({
      pageNumber: i + 1,
      text: text.trim(),
    });
  }

  return { pages, pageCount };
}
