"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [valid, setValid] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }

    fetch(`/api/team/invite/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Invalid invite");
        }
        return res.json();
      })
      .then((data) => {
        setInviteEmail(data.invite.email);
        setWorkspaceName(data.invite.workspaceName);
        setValid(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to accept invite");
      return;
    }

    toast.success("Welcome! Please sign in.");
    router.push("/auth/signin");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Validating invite…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !valid) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>
              {error ?? "This invite link is invalid."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/auth/signin">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {workspaceName}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to collaborate on DocHub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={inviteEmail} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Accept invite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Loading invite…</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <InviteForm />
    </Suspense>
  );
}
