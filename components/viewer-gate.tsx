"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, FileText, AlertCircle } from "lucide-react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { PdfViewer } from "./pdf-viewer";

interface ViewerGateProps {
  link: {
    id: string;
    slug: string;
    passwordHash: string | null;
    emailGate: boolean;
    allowDownload: boolean;
    isExpired: boolean;
  };
  filename: string;
}

export function ViewerGate({ link, filename }: ViewerGateProps) {
  const [granted, setGranted] = useState(!link.passwordHash && !link.emailGate);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [viewerToken, setViewerToken] = useState<string | null>(null);
  const [viewerSessionId, setViewerSessionId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string>("anonymous");
  const startedRef = useRef(false);

  useEffect(() => {
    FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => setFingerprint(result.visitorId))
      .catch(() => setFingerprint("anonymous"));
  }, []);

  const ungatedVerifiedRef = useRef(false);

  useEffect(() => {
    if (!link.passwordHash && !link.emailGate && !ungatedVerifiedRef.current) {
      ungatedVerifiedRef.current = true;
      setChecking(true);
      fetch("/api/view/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: link.id }),
      })
        .then((res) => {
          setChecking(false);
          if (!res.ok) {
            return res.json().then((data) => {
              throw new Error(data.error || "Access denied");
            });
          }
          return res.json();
        })
        .then((data) => {
          setViewerToken(data.token);
          setGranted(true);
        })
        .catch((err) => {
          toast.error(err.message);
        });
    }
  }, [link.id, link.passwordHash, link.emailGate]);

  const verifyAccess = useCallback(async () => {
    setChecking(true);
    const res = await fetch("/api/view/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linkId: link.id,
        password: password || undefined,
        viewerEmail: email || undefined,
      }),
    });
    setChecking(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Access denied");
      return;
    }

    const data = await res.json();
    setViewerToken(data.token);
    setGranted(true);
  }, [link.id, password, email]);

  const startSession = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    const res = await fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linkId: link.id,
        action: "start",
        viewerToken: viewerToken ?? "",
        viewerEmail: email || undefined,
        fingerprint,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setViewerSessionId(data.sessionId);
    }
  }, [link.id, viewerToken, email, fingerprint]);

  useEffect(() => {
    if (granted && viewerToken) {
      startSession();
    }
  }, [granted, viewerToken, startSession]);

  useEffect(() => {
    if (!viewerSessionId) return;

    const heartbeat = setInterval(() => {
      // Pause heartbeat when the tab is hidden to avoid inflating duration
      // while the viewer is not actually looking at the document.
      if (document.visibilityState !== "visible") {
        return;
      }

      fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: viewerSessionId,
          action: "heartbeat",
        }),
      });
    }, 5000);

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        "/api/view",
        JSON.stringify({ sessionId: viewerSessionId, action: "end" }),
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [viewerSessionId]);

  async function checkPassword(e: React.FormEvent) {
    e.preventDefault();
    await verifyAccess();
  }

  async function checkEmail(e: React.FormEvent) {
    e.preventDefault();
    await verifyAccess();
  }

  if (link.isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle>Link expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This share link is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!granted && link.passwordHash) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>Password protected</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={checkPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {link.emailGate && (
                <div className="space-y-2">
                  <Label htmlFor="email">Your email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={checking}>
                {checking ? "Checking..." : "View document"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!granted && link.emailGate) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enter your email to view</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={checkEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={checking}>
                {checking ? "Checking..." : "View document"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pdfUrl = `/api/view/pdf?token=${encodeURIComponent(viewerToken ?? "")}`;

  if (!viewerSessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle>Loading document</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span className="font-medium">{filename}</span>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <PdfViewer
          pdfUrl={pdfUrl}
          sessionId={viewerSessionId}
          allowDownload={link.allowDownload}
          filename={filename}
        />
      </main>
    </div>
  );
}
