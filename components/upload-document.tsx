"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadDropzone } from "@/lib/uploadthing-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

export function UploadDocument() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload PDF</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload a PDF</DialogTitle>
        </DialogHeader>
        <UploadDropzone
          endpoint="pdfUploader"
          onBeforeUploadBegin={(files) => {
            const oversized = files.find((f) => f.size > MAX_PDF_SIZE_BYTES);
            if (oversized) {
              throw new Error("PDF must be 20MB or smaller");
            }
            return files;
          }}
          onClientUploadComplete={() => {
            toast.success("Document uploaded");
            setOpen(false);
            router.refresh();
          }}
          onUploadError={(error) => {
            toast.error(error.message);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
