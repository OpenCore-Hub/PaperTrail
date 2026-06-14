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
import { FileText, BarChart3 } from "lucide-react";
import { CreateLinkDialog } from "./create-link-dialog";
import { ManageLinksDialog } from "./manage-links-dialog";

interface DocumentListProps {
  documents: Array<{
    id: string;
    filename: string;
    fileSize: number;
    createdAt: Date;
    _count: { links: number };
  }>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DocumentList({ documents }: DocumentListProps) {
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
        <Card key={doc.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="line-clamp-1 text-base">
                  {doc.filename}
                </CardTitle>
              </div>
              <Badge variant="secondary">{formatFileSize(doc.fileSize)}</Badge>
            </div>
            <CardDescription>
              Uploaded {formatDistanceToNow(new Date(doc.createdAt))} ago ·{" "}
              {doc._count.links} link{doc._count.links === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <CreateLinkDialog documentId={doc.id} />
            <ManageLinksDialog documentId={doc.id} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/analytics/${doc.id}`}>
                <BarChart3 className="mr-1 h-4 w-4" />
                Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
