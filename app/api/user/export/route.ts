import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { withRequestContext } from "@/lib/with-request-context";

export const dynamic = "force-dynamic";

async function handler() {
  const log = getRequestLogger("api:user:export");

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspace: true,
        documents: {
          orderBy: { createdAt: "desc" },
          include: {
            links: {
              orderBy: { createdAt: "desc" },
              include: {
                sessions: {
                  orderBy: { startedAt: "desc" },
                  include: {
                    pageViews: {
                      orderBy: { pageNumber: "asc" },
                    },
                  },
                },
                viewerGrants: {
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
        passwordResetTokens: {
          orderBy: { createdAt: "desc" },
        },
        emailVerificationTokens: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      workspace: user.workspace
        ? {
            id: user.workspace.id,
            name: user.workspace.name,
            slug: user.workspace.slug,
            customDomain: user.workspace.customDomain,
            customDomainVerifiedAt: user.workspace.customDomainVerifiedAt,
            plan: user.workspace.plan,
            createdAt: user.workspace.createdAt,
            updatedAt: user.workspace.updatedAt,
          }
        : null,
      documents: user.documents.map((document) => ({
        id: document.id,
        filename: document.filename,
        storageKey: document.storageKey,
        fileSize: document.fileSize,
        pageCount: document.pageCount,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        links: document.links.map((link) => ({
          id: link.id,
          slug: link.slug,
          expiresAt: link.expiresAt,
          emailGate: link.emailGate,
          allowDownload: link.allowDownload,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
          sessions: link.sessions.map((viewSession) => ({
            id: viewSession.id,
            fingerprint: viewSession.fingerprint,
            viewerEmail: viewSession.viewerEmail,
            startedAt: viewSession.startedAt,
            endedAt: viewSession.endedAt,
            durationSeconds: viewSession.durationSeconds,
            pageViews: viewSession.pageViews.map((pageView) => ({
              id: pageView.id,
              pageNumber: pageView.pageNumber,
              enteredAt: pageView.enteredAt,
              durationSeconds: pageView.durationSeconds,
            })),
          })),
          viewerGrants: link.viewerGrants.map((grant) => ({
            id: grant.id,
            token: grant.token,
            expiresAt: grant.expiresAt,
            createdAt: grant.createdAt,
          })),
        })),
      })),
      passwordResetTokens: user.passwordResetTokens.map((token) => ({
        id: token.id,
        token: token.token,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      })),
      emailVerificationTokens: user.emailVerificationTokens.map((token) => ({
        id: token.id,
        token: token.token,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      })),
      exportedAt: new Date().toISOString(),
    };

    const json = JSON.stringify(exportData, null, 2);
    const filename = `dochub-export-${userId}.json`;

    audit("user.data_exported", { userId });

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    log.error({ error }, "user.export_failed");
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 },
    );
  }
}

export const GET = withRequestContext(handler);
