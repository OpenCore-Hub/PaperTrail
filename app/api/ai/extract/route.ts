import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Structured AI extraction is not implemented in v0.3" },
    { status: 501 },
  );
}
