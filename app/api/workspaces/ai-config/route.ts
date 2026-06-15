import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { canManageWorkspace, type UserRole } from "@/lib/roles";
import { encryptApiKey } from "@/lib/ai/crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:workspaces:ai-config");

export const dynamic = "force-dynamic";

const aiConfigSchema = z.object({
  mode: z.enum(["CLOUD", "BYOK", "LOCAL"]),
  provider: z.enum(["openai", "anthropic", "ollama"]),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await prisma.aiProviderConfig.findUnique({
      where: { workspaceId: session.user.workspaceId },
    });

    if (!config) {
      return NextResponse.json({
        mode: "CLOUD",
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: null,
        baseUrl: null,
      });
    }

    return NextResponse.json({
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey ? "***" : null,
      baseUrl: config.baseUrl,
    });
  } catch (error) {
    log.error({ error }, "ai_config.get_failed");
    return NextResponse.json(
      { error: "Failed to load AI config" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user?.workspaceId ||
      !canManageWorkspace(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = aiConfigSchema.parse(body);

    const encryptedKey =
      parsed.apiKey && parsed.mode !== "LOCAL"
        ? encryptApiKey(parsed.apiKey)
        : null;

    const config = await prisma.aiProviderConfig.upsert({
      where: { workspaceId: session.user.workspaceId },
      update: {
        mode: parsed.mode,
        provider: parsed.provider,
        model: parsed.model,
        apiKey: encryptedKey,
        baseUrl: parsed.baseUrl,
      },
      create: {
        workspaceId: session.user.workspaceId,
        mode: parsed.mode,
        provider: parsed.provider,
        model: parsed.model,
        apiKey: encryptedKey,
        baseUrl: parsed.baseUrl,
      },
    });

    return NextResponse.json({
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey ? "***" : null,
      baseUrl: config.baseUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "ai_config.put_failed");
    return NextResponse.json(
      { error: "Failed to save AI config" },
      { status: 500 },
    );
  }
}
