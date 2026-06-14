"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const PdfViewerContent = dynamic(
  () =>
    import("./pdf-viewer-content").then((mod) => ({
      default: mod.PdfViewerContent,
    })),
  { ssr: false },
);

export function PdfViewer(props: ComponentProps<typeof PdfViewerContent>) {
  return <PdfViewerContent {...props} />;
}
