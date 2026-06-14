"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Globe, Trash2, Loader2 } from "lucide-react";

interface DomainStatus {
  domain: string | null;
  verified: boolean;
  verifiedAt: string | null;
  instructions?: string;
}

export function CustomDomainManager() {
  const router = useRouter();
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/team/domain")
      .then((res) => res.json())
      .then((data: DomainStatus) => {
        setStatus(data);
        if (data.domain) setDomain(data.domain);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load domain settings");
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/team/domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(data.error || "Failed to verify domain", {
        description: data.instructions,
      });
      return;
    }

    toast.success("Custom domain verified");
    setStatus(data);
    router.refresh();
  }

  async function handleRemove() {
    const res = await fetch("/api/team/domain", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to remove domain");
      return;
    }

    toast.success("Custom domain removed");
    setStatus({ domain: null, verified: false, verifiedAt: null });
    setDomain("");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Custom domain
          </CardTitle>
          <CardDescription>
            Serve your share links under your own brand domain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <div className="flex gap-2">
                <Input
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="brand.example.com"
                  required
                  disabled={status?.verified}
                />
                {status?.verified ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRemove}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                ) : (
                  <Button type="submit" disabled={saving}>
                    {saving ? "Verifying…" : "Verify"}
                  </Button>
                )}
              </div>
            </div>

            {status?.verified && status.domain && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">
                  Verified on {new Date(status.verifiedAt!).toLocaleDateString()}
                </span>
                <Badge variant="secondary">Active</Badge>
              </div>
            )}

            {status?.instructions && !status.verified && (
              <p className="text-sm text-muted-foreground">
                {status.instructions}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {status?.verified && status.domain && (
        <Card>
          <CardHeader>
            <CardTitle>Share link preview</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block rounded-md bg-muted p-3 text-sm">
              https://{status.domain}/v/abc123
            </code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
