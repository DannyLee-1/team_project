import { NextResponse } from "next/server";
import { readMakers, writeMakers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const makers = readMakers();
  const maker = makers.find((m) => m.id === id);
  if (!maker) return NextResponse.json({ error: "전문가를 찾을 수 없어요." }, { status: 404 });
  maker.verified = body?.verified !== false;
  writeMakers(makers);
  return NextResponse.json({ ok: true, verified: maker.verified });
}
