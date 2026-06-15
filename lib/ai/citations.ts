export interface Citation {
  pageNumber: number;
  chunkId: string;
  excerpt: string;
  documentId?: string;
  documentName?: string;
}

const CITATION_PATTERN = /\[citation:\s?([a-f0-9-]{36})\]/g;
const MAX_CITATIONS = 8;

/**
 * Extract citation markers from an AI answer and map them to validated chunk
 * metadata. Citation markers look like `[citation:<chunkId>]` or
 * `[citation: <chunkId>]`. Only chunk IDs present in `availableChunks` are
 * returned; unknown IDs are silently ignored. The result is de-duplicated by
 * chunkId, limited to `MAX_CITATIONS`, and ordered by first appearance in the
 * answer.
 */
export function extractCitations(
  answer: string,
  availableChunks: Array<{
    id: string;
    pageNumber: number;
    excerpt: string;
    documentId?: string;
    documentName?: string;
  }>,
): Citation[] {
  const chunkMap = new Map(availableChunks.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const citations: Citation[] = [];

  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  CITATION_PATTERN.lastIndex = 0;
  while ((match = CITATION_PATTERN.exec(answer)) !== null) {
    matches.push(match);
  }

  for (const m of matches) {
    const chunkId = m[1];
    if (!chunkId || seen.has(chunkId)) continue;

    const chunk = chunkMap.get(chunkId);
    if (!chunk) continue;

    seen.add(chunkId);
    citations.push({
      chunkId,
      pageNumber: chunk.pageNumber,
      excerpt: chunk.excerpt,
      ...(chunk.documentId !== undefined && { documentId: chunk.documentId }),
      ...(chunk.documentName !== undefined && {
        documentName: chunk.documentName,
      }),
    });

    if (citations.length >= MAX_CITATIONS) break;
  }

  return citations;
}
