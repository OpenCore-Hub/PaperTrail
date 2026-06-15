"use client";

import dynamic from "next/dynamic";
import { forwardRef, type ComponentProps } from "react";
import type { PdfViewerHandle } from "./pdf-viewer-content";

const PdfViewerContent = dynamic(
  () =>
    import("./pdf-viewer-content").then((mod) => ({
      default: mod.PdfViewerContent,
    })),
  { ssr: false },
);

export const PdfViewer = forwardRef<
  PdfViewerHandle,
  ComponentProps<typeof PdfViewerContent>
>((props, ref) => <PdfViewerContent ref={ref} {...props} />);

PdfViewer.displayName = "PdfViewer";
