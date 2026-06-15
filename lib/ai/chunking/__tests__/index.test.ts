import { describe, it, expect } from "vitest";
import { chunkPage, chunkDocument } from "../index";

function generateText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ");
}

describe("chunkPage", () => {
  it("returns a single chunk for short pages", () => {
    const text = "This is a short page.\n\nWith two paragraphs.";
    const chunks = chunkPage(text, 1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      content: text,
      pageNumber: 1,
    });
  });

  it("splits long pages into multiple chunks with overlap", () => {
    const text = generateText(6000);
    const chunks = chunkPage(text, 2);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.pageNumber).toBe(2);
    }
  });

  it("returns empty array for empty text", () => {
    expect(chunkPage("", 1)).toEqual([]);
  });
});

describe("chunkDocument", () => {
  it("chunks multiple pages", () => {
    const pages = [
      { pageNumber: 1, text: "Page one content." },
      { pageNumber: 2, text: generateText(6000) },
      { pageNumber: 3, text: "Page three content." },
    ];

    const chunks = chunkDocument(pages);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    const pageNumbers = chunks.map((c) => c.pageNumber);
    expect(pageNumbers).toContain(1);
    expect(pageNumbers).toContain(2);
    expect(pageNumbers).toContain(3);
  });
});
