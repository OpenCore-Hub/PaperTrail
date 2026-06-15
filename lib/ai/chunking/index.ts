import { encodingForModel } from "js-tiktoken";

export interface TextChunk {
  content: string;
  pageNumber: number;
  paragraphIndex?: number;
}

const MAX_TOKENS_PER_PAGE = 1500;
const OVERLAP_TOKENS = 200;
const CHUNK_TARGET_TOKENS = 1000;

let cachedEncoder: ReturnType<typeof encodingForModel> | null = null;

function getEncoder() {
  if (!cachedEncoder) {
    cachedEncoder = encodingForModel("text-embedding-3-small");
  }
  return cachedEncoder;
}

function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

function splitBySentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function takeTokensFromEnd(text: string, tokenCount: number): string {
  const encoder = getEncoder();
  const tokens = encoder.encode(text);
  const slice = tokens.slice(-tokenCount);
  const decoded = encoder.decode(slice);
  return Array.isArray(decoded) ? decoded.join("") : decoded;
}

export function chunkPage(
  pageText: string,
  pageNumber: number,
): Array<Omit<TextChunk, "paragraphIndex"> & { paragraphIndex?: number }> {
  const trimmed = pageText.trim();
  if (!trimmed) {
    return [];
  }

  const totalTokens = countTokens(trimmed);
  if (totalTokens <= MAX_TOKENS_PER_PAGE) {
    return [{ content: trimmed, pageNumber }];
  }

  const paragraphs = splitByParagraphs(trimmed);
  if (paragraphs.length <= 1) {
    return chunkSentences(trimmed, pageNumber);
  }

  const chunks: TextChunk[] = [];
  let currentChunks: string[] = [];
  let currentTokens = 0;
  let paragraphIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = countTokens(paragraph);

    if (
      currentTokens > 0 &&
      currentTokens + paragraphTokens > CHUNK_TARGET_TOKENS
    ) {
      const content = currentChunks.join("\n\n");
      chunks.push({ content, pageNumber, paragraphIndex });

      const overlapText = currentChunks.join("\n\n");
      const overlap = takeTokensFromEnd(overlapText, OVERLAP_TOKENS);
      currentChunks = overlap ? [overlap] : [];
      currentTokens = overlap ? countTokens(overlap) : 0;
      paragraphIndex++;
    }

    currentChunks.push(paragraph);
    currentTokens += paragraphTokens;
  }

  if (currentChunks.length > 0) {
    chunks.push({
      content: currentChunks.join("\n\n"),
      pageNumber,
      paragraphIndex,
    });
  }

  return chunks;
}

export function chunkDocument(
  pages: { pageNumber: number; text: string }[],
): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const pageChunks = chunkPage(page.text, page.pageNumber);
    chunks.push(...pageChunks);
  }

  return chunks;
}

function splitByWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

export function chunkSentences(text: string, pageNumber: number): TextChunk[] {
  const sentences = splitBySentences(text);
  if (sentences.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    if (sentenceTokens > CHUNK_TARGET_TOKENS && current.length === 0) {
      const words = splitByWords(sentence);
      for (const word of words) {
        const wordTokens = countTokens(word);
        if (
          currentTokens + wordTokens > CHUNK_TARGET_TOKENS &&
          current.length > 0
        ) {
          chunks.push({ content: current.join(" "), pageNumber });
          current = [];
          currentTokens = 0;
        }
        current.push(word);
        currentTokens += wordTokens;
      }
      continue;
    }

    if (
      currentTokens + sentenceTokens > CHUNK_TARGET_TOKENS &&
      current.length > 0
    ) {
      chunks.push({ content: current.join(" "), pageNumber });
      current = [];
      currentTokens = 0;
    }
    current.push(sentence);
    currentTokens += sentenceTokens;
  }

  if (current.length > 0) {
    chunks.push({ content: current.join(" "), pageNumber });
  }

  return chunks;
}
