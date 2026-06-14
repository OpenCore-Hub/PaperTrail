"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Link2, Copy } from "lucide-react";

interface CreateLinkDialogProps {
  documentId: string;
}

export function CreateLinkDialog({ documentId }: CreateLinkDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [emailGate, setEmailGate] = useState(false);
  const [allowDownload, setAllowDownload] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>("");

  useEffect(() => {
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
      .catch(() => {
        setBaseUrl(window.location.origin);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        password: password || undefined,
        expiresAt: expiresAt || undefined,
        emailGate,
        allowDownload,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to create link");
      return;
    }

    const data = await res.json();
    const origin = baseUrl || window.location.origin;
    const url = `${origin}/v/${data.slug}`;
    setCreatedLink(url);
    router.refresh();
  }

  function copyLink() {
    if (!createdLink) return;
    navigator.clipboard.writeText(createdLink);
    toast.success("Link copied to clipboard");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="mr-1 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create share link</DialogTitle>
        </DialogHeader>
        {createdLink ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 break-all text-sm">
              {createdLink}
            </div>
            <Button onClick={copyLink} className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCreatedLink(null);
                setPassword("");
                setExpiresAt("");
                setEmailGate(false);
              }}
            >
              Create another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty for no password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires">Expires at (optional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-gate">Require viewer email</Label>
              <Switch
                id="email-gate"
                checked={emailGate}
                onCheckedChange={setEmailGate}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="download">Allow download</Label>
              <Switch
                id="download"
                checked={allowDownload}
                onCheckedChange={setAllowDownload}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
