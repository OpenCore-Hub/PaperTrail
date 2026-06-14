import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentList } from "@/components/document-list";
import { UploadDocument } from "@/components/upload-document";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    redirect("/auth/signin");
  }

  const documents = await prisma.document.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { links: true },
      },
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">DocHub</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Documents</h2>
            <p className="text-muted-foreground">
              Upload PDFs and create tracked share links.
            </p>
          </div>
          <UploadDocument />
        </div>

        <DocumentList documents={documents} />
      </main>
    </div>
  );
}
