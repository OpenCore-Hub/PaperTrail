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
  const [progress, setProgress] = useState<number | null>(null);
  const router = useRouter();

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setProgress(null);
      }}
    >
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
            setProgress(0);
            return files;
          }}
          onUploadProgress={(progressValue) => {
            setProgress(progressValue);
          }}
          onClientUploadComplete={() => {
            toast.success("Document uploaded");
            setProgress(null);
            setOpen(false);
            router.refresh();
          }}
          onUploadError={(error) => {
            toast.error(error.message);
            setProgress(null);
          }}
        />
        {progress !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Uploading...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
