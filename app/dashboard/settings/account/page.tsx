import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    redirect("/auth/signin");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Account settings</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <AccountSettingsForm
          email={session.user.email ?? ""}
          role={session.user.role}
          workspaceName={workspace?.name ?? "Your workspace"}
        />
      </main>
    </div>
  );
}
