import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("api:user:delete");

export const dynamic = "force-dynamic";

const deleteSchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = deleteSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.password) {
      return NextResponse.json(
        {
          error:
            "Accounts without a password cannot be deleted this way. Please contact support.",
        },
        { status: 400 },
      );
    }

    const valid = await bcrypt.compare(parsed.password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 },
      );
    }

    await prisma.user.delete({ where: { id: user.id } });

    log.info({ userId: user.id }, "user.deleted");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "user.delete_failed");
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
