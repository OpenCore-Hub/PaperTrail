"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, BarChart3, Trash2, Loader2 } from "lucide-react";
import { CreateLinkDialog } from "./create-link-dialog";
import { ManageLinksDialog } from "./manage-links-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { canManageDocuments, type UserRole } from "@/lib/roles";

interface DocumentListProps {
  documents: Array<{
    id: string;
    filename: string;
    fileSize: number;
    createdAt: Date;
    _count: { links: number };
  }>;
  userRole: UserRole;
}

interface DocumentCardProps {
  document: DocumentListProps["documents"][number];
  userRole: UserRole;
}

function DocumentCard({ document, userRole }: DocumentCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/documents/${document.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setConfirmOpen(false);

    if (!res.ok) {
      toast.error("Failed to delete document");
      return;
    }

    toast.success("Document deleted");
    router.refresh();
  }

  return (
    <Card data-document-id={document.id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="line-clamp-1 text-base">
              {document.filename}
            </CardTitle>
          </div>
          <Badge variant="secondary">{formatFileSize(document.fileSize)}</Badge>
        </div>
        <CardDescription>
          Uploaded {formatDistanceToNow(new Date(document.createdAt))} ago ·{" "}
          {document._count.links} link{document._count.links === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {canManageDocuments(userRole) && (
          <>
            <CreateLinkDialog documentId={document.id} />
            <ManageLinksDialog documentId={document.id} />
          </>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/analytics/${document.id}`}>
            <BarChart3 className="mr-1 h-4 w-4" />
            Analytics
          </Link>
        </Button>
        {canManageDocuments(userRole) && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="delete-document-button"
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete document</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete{" "}
                  <strong>{document.filename}</strong>? This will also delete
                  all share links and analytics for this document. This action
                  cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DocumentList({ documents, userRole }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <Card className="py-12 text-center">
        <CardContent>
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No documents yet</h3>
          <p className="text-muted-foreground">
            Upload your first PDF to create tracked share links.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} userRole={userRole} />
      ))}
    </div>
  );
}
