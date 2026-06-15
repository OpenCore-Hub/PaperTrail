"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerContentProps {
  pdfUrl: string;
  sessionId: string;
  allowDownload?: boolean;
  filename?: string;
}

export function PdfViewerContent({
  pdfUrl,
  sessionId,
  allowDownload,
  filename,
}: PdfViewerContentProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageVisibility, setPageVisibility] = useState<Record<number, boolean>>(
    {},
  );
  const visibilityRef = useRef<Record<number, boolean>>({});
  const enteredAtRef = useRef<Record<number, number>>({});
  const reportedRef = useRef<Set<number>>(new Set());

  const reportPageView = useCallback(
    async (pageNumber: number, durationMs: number) => {
      if (durationMs < 500) return; // ignore quick flashes
      await fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "page",
          pageNumber,
        }),
      });
    },
    [sessionId],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        const updates: Record<number, boolean> = {};

        entries.forEach((entry) => {
          const page = Number(entry.target.getAttribute("data-page-number"));
          const isVisible = entry.isIntersecting;
          updates[page] = isVisible;

          if (isVisible) {
            if (!enteredAtRef.current[page]) {
              enteredAtRef.current[page] = now;
            }
          } else {
            const enteredAt = enteredAtRef.current[page];
            if (enteredAt && !reportedRef.current.has(page)) {
              const duration = now - enteredAt;
              reportPageView(page, duration);
              reportedRef.current.add(page);
            }
            delete enteredAtRef.current[page];
          }
        });

        visibilityRef.current = { ...visibilityRef.current, ...updates };
        setPageVisibility((prev) => ({ ...prev, ...updates }));
      },
      { threshold: 0.5 },
    );

    const pages = document.querySelectorAll("[data-page-number]");
    pages.forEach((p) => observer.observe(p));

    return () => observer.disconnect();
  }, [numPages, reportPageView]);

  useEffect(() => {
    const enteredAt = enteredAtRef.current;
    const reported = reportedRef.current;
    return () => {
      // Flush any visible pages on unmount
      const now = Date.now();
      Object.entries(visibilityRef.current).forEach(([page, visible]) => {
        if (visible) {
          const start = enteredAt[Number(page)];
          if (start && !reported.has(Number(page))) {
            reportPageView(Number(page), now - start);
          }
        }
      });
    };
  }, [reportPageView]);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {allowDownload && filename && (
        <div className="w-full max-w-4xl px-4">
          <a
            href={`${pdfUrl}&download=1`}
            download={filename}
            className="text-sm text-primary hover:underline"
          >
            Download PDF
          </a>
        </div>
      )}
      <Document
        file={pdfUrl}
        onLoadSuccess={(doc) => setNumPages(doc.numPages)}
        loading={<p className="text-muted-foreground">Loading PDF…</p>}
        error={<p className="text-destructive">Failed to load document.</p>}
        className="flex flex-col items-center gap-4"
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
          <div
            key={pageNumber}
            data-page-number={pageNumber}
            className={cn(
              "shadow-sm transition-opacity",
              pageVisibility[pageNumber] ? "opacity-100" : "opacity-90",
            )}
          >
            <Page
              pageNumber={pageNumber}
              width={800}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={<div className="h-[300px] w-[800px] bg-muted" />}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
