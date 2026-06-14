"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, Loader2 } from "lucide-react";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface TeamData {
  members: Member[];
  invites: Invite[];
}

export function TeamManagement() {
  const router = useRouter();
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">("EDITOR");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetch("/api/team")
      .then((res) => res.json())
      .then((result: TeamData) => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load team");
        setLoading(false);
      });
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);

    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    const result = await res.json();
    setInviting(false);

    if (!res.ok) {
      toast.error(result.error || "Failed to send invite");
      return;
    }

    if (result.emailSent) {
      if (result.emailProvider === "console") {
        toast.success("Invite created (email logged to console)", {
          description: result.invite.inviteUrl,
        });
      } else {
        toast.success("Invite sent by email");
      }
    } else {
      toast.error("Invite created but email failed", {
        description:
          result.emailDetail || "Please copy the invite link manually.",
      });
    }

    setEmail("");
    setRole("EDITOR");
    setData((prev) =>
      prev
        ? {
            ...prev,
            invites: [result.invite, ...prev.invites],
          }
        : null,
    );
    router.refresh();
  }

  async function updateRole(
    memberId: string,
    newRole: "ADMIN" | "EDITOR" | "VIEWER",
  ) {
    const res = await fetch(`/api/team/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (!res.ok) {
      const result = await res.json();
      toast.error(result.error || "Failed to update role");
      return;
    }

    toast.success("Role updated");
    setData((prev) =>
      prev
        ? {
            ...prev,
            members: prev.members.map((m) =>
              m.id === memberId ? { ...m, role: newRole } : m,
            ),
          }
        : null,
    );
  }

  async function removeMember(memberId: string) {
    const res = await fetch(`/api/team/members/${memberId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const result = await res.json();
      toast.error(result.error || "Failed to remove member");
      return;
    }

    toast.success("Member removed");
    setData((prev) =>
      prev
        ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) }
        : null,
    );
  }

  async function cancelInvite(inviteId: string) {
    const res = await fetch(`/api/team/invite/${inviteId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const result = await res.json();
      toast.error(result.error || "Failed to cancel invite");
      return;
    }

    toast.success("Invite cancelled");
    setData((prev) =>
      prev
        ? { ...prev, invites: prev.invites.filter((i) => i.id !== inviteId) }
        : null,
    );
  }

  function copyInviteUrl(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
          <CardDescription>
            Send an invite link to add someone to your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
              />
            </div>
            <div className="w-full space-y-2 sm:w-40">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) =>
                  setRole(v as "ADMIN" | "EDITOR" | "VIEWER")
                }
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={inviting}
              className="w-full sm:w-auto"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No members yet
                  </TableCell>
                </TableRow>
              ) : (
                data.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.name ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          updateRole(
                            member.id,
                            v as "ADMIN" | "EDITOR" | "VIEWER",
                          )
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(member.createdAt))} ago
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeMember(member.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invites.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No pending invites
                  </TableCell>
                </TableRow>
              ) : (
                data.invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>{invite.role}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(invite.expiresAt))} left
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            copyInviteUrl(
                              `${window.location.origin}/auth/invite?token=${invite.token}`,
                            )
                          }
                          title="Copy invite link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => cancelInvite(invite.id)}
                          title="Cancel invite"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
