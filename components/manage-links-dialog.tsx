"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Link2,
  Copy,
  Trash2,
  Edit2,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface LinkItem {
  id: string;
  slug: string;
  hasPassword: boolean;
  expiresAt: string | null;
  emailGate: boolean;
  allowDownload: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ManageLinksDialogProps {
  documentId: string;
}

export function ManageLinksDialog({ documentId }: ManageLinksDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>("");

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/links`);
      if (!res.ok) throw new Error("Failed to load links");
      const data = await res.json();
      setLinks(data.links);
    } catch {
      toast.error("Failed to load links");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (!open) return;

    loadLinks();
    fetch("/api/workspace")
      .then((res) => res.json())
      .then((data) => {
        const domain: string | null = data.workspace?.customDomain;
        const verified: boolean = data.workspace?.verified;
        if (domain && verified) {
          setBaseUrl(`https://${domain}`);
        } else {
          setBaseUrl(window.location.origin);
        }
      })
      .catch(() => setBaseUrl(window.location.origin));
  }, [open, loadLinks]);

  function linkUrl(slug: string) {
    return `${baseUrl || window.location.origin}/v/${slug}`;
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(linkUrl(slug));
    toast.success("Link copied");
  }

  async function deleteLink(id: string) {
    const res = await fetch(`/api/share/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete link");
      return;
    }
    toast.success("Link deleted");
    setLinks((prev) => prev.filter((l) => l.id !== id));
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="mr-1 h-4 w-4" />
          Manage links
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share links</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No share links yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <code className="max-w-[180px] truncate text-xs">
                        {linkUrl(link.slug)}
                      </code>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copyLink(link.slug)}
                          title="Copy link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                          title="Open link"
                        >
                          <a
                            href={linkUrl(link.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {link.hasPassword ? (
                      <span className="text-xs text-amber-600">Enabled</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        None
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {link.expiresAt ? (
                      <span className="text-xs">
                        {new Date(link.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Never
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingLink(link)}
                        title="Edit link"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteLink(link.id)}
                        title="Delete link"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {editingLink && (
          <EditLinkDialog
            link={editingLink}
            baseUrl={baseUrl}
            onClose={() => setEditingLink(null)}
            onSaved={(updated) => {
              setLinks((prev) =>
                prev.map((l) => (l.id === updated.id ? updated : l)),
              );
              setEditingLink(null);
              router.refresh();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditLinkDialogProps {
  link: LinkItem;
  baseUrl: string;
  onClose: () => void;
  onSaved: (link: LinkItem) => void;
}

function EditLinkDialog({
  link,
  baseUrl,
  onClose,
  onSaved,
}: EditLinkDialogProps) {
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState(
    link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
  );
  const [emailGate, setEmailGate] = useState(link.emailGate);
  const [allowDownload, setAllowDownload] = useState(link.allowDownload);
  const [saving, setSaving] = useState(false);
  const [removePassword, setRemovePassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body: Record<string, unknown> = {
      expiresAt: expiresAt || null,
      emailGate,
      allowDownload,
    };

    if (removePassword) {
      body.password = "";
    } else if (password) {
      body.password = password;
    }

    const res = await fetch(`/api/share/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to update link");
      return;
    }

    const data = await res.json();
    toast.success("Link updated");
    onSaved(data.link);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit share link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border p-3 break-all text-sm">
            {`${baseUrl || window.location.origin}/v/${link.slug}`}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">Password</Label>
            {link.hasPassword && !removePassword ? (
              <div className="flex items-center gap-2">
                <Input id="edit-password" value="••••••••" disabled />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRemovePassword(true)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Input
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  removePassword ? "No password" : "Leave empty to keep current"
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-expires">Expires at</Label>
            <Input
              id="edit-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-email-gate">Require viewer email</Label>
            <Switch
              id="edit-email-gate"
              checked={emailGate}
              onCheckedChange={setEmailGate}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-download">Allow download</Label>
            <Switch
              id="edit-download"
              checked={allowDownload}
              onCheckedChange={setAllowDownload}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
