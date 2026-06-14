import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateWorkspaceSlug } from "@/lib/slug";
import { z } from "zod";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  name: z.string().min(1),
  workspaceName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const slug = generateWorkspaceSlug(parsed.workspaceName);
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.workspaceName,
        slug,
      },
    });

    await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        password: passwordHash,
        role: "ADMIN",
        workspaceId: workspace.id,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
