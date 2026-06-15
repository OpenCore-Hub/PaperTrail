import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { TeamManagement } from "@/components/team-management";
import { CustomDomainManager } from "@/components/custom-domain-manager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Sparkles } from "lucide-react";

export default async function TeamSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

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
          <h1 className="text-xl font-bold">Team settings</h1>
          <Button variant="outline" size="sm" asChild className="ml-auto">
            <Link href="/dashboard/settings/ai">
              <Sparkles className="mr-1 h-4 w-4" />
              AI Settings
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="domain">Custom domain</TabsTrigger>
          </TabsList>
          <TabsContent value="members" className="mt-6">
            <TeamManagement />
          </TabsContent>
          <TabsContent value="domain" className="mt-6">
            <CustomDomainManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
