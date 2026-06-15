import { describe, it, expect } from "vitest";
import { extractCitations, type Citation } from "../citations";

function makeChunks() {
  return [
    {
      id: "11111111-1111-1111-1111-111111111111",
      pageNumber: 1,
      excerpt: "First chunk excerpt",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      pageNumber: 2,
      excerpt: "Second chunk excerpt",
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      pageNumber: 3,
      excerpt: "Third chunk excerpt",
    },
  ];
}

describe("extractCitations", () => {
  it("extracts [citation:<chunkId>] markers", () => {
    const answer =
      "Answer one [citation:11111111-1111-1111-1111-111111111111] and two [citation:22222222-2222-2222-2222-222222222222].";
    const result = extractCitations(answer, makeChunks());

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual<Citation>({
      chunkId: "11111111-1111-1111-1111-111111111111",
      pageNumber: 1,
      excerpt: "First chunk excerpt",
    });
    expect(result[1]).toEqual<Citation>({
      chunkId: "22222222-2222-2222-2222-222222222222",
      pageNumber: 2,
      excerpt: "Second chunk excerpt",
    });
  });

  it("extracts [citation: <chunkId>] with a space", () => {
    const answer =
      "See [citation: 11111111-1111-1111-1111-111111111111] for details.";
    const result = extractCitations(answer, makeChunks());

    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("de-duplicates repeated chunk ids and preserves first appearance order", () => {
    const answer =
      "First [citation:22222222-2222-2222-2222-222222222222], then [citation:11111111-1111-1111-1111-111111111111], then [citation:22222222-2222-2222-2222-222222222222] again.";
    const result = extractCitations(answer, makeChunks());

    expect(result).toHaveLength(2);
    expect(result[0].chunkId).toBe(
      "22222222-2222-2222-2222-222222222222",
    );
    expect(result[1].chunkId).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("ignores citation markers for unknown chunk ids", () => {
    const answer =
      "Known [citation:11111111-1111-1111-1111-111111111111] and unknown [citation:99999999-9999-9999-9999-999999999999].";
    const result = extractCitations(answer, makeChunks());

    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("returns an empty array when no citation markers exist", () => {
    const result = extractCitations("No citations here.", makeChunks());
    expect(result).toEqual([]);
  });

  it("limits results to 8 citations", () => {
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      pageNumber: i + 1,
      excerpt: `Excerpt ${i + 1}`,
    }));

    const answer = chunks
      .map((chunk) => `[citation:${chunk.id}]`)
      .join(" ");

    const result = extractCitations(answer, chunks);
    expect(result).toHaveLength(8);
  });
});
