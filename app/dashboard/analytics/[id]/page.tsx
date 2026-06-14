import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface AnalyticsPageProps {
  params: { id: string };
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    redirect("/auth/signin");
  }

  const document = await prisma.document.findFirst({
    where: {
      id: params.id,
      workspaceId: session.user.workspaceId,
    },
  });

  if (!document) {
    notFound();
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
          <h1 className="text-xl font-bold">Analytics</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <AnalyticsDashboard documentId={document.id} filename={document.filename} />
      </main>
    </div>
  );
}
