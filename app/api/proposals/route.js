import { NextResponse } from "next/server";
import { readProposals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 특정 전문가가 받은 제안 목록 (내 정보 · 받은 제안)
export async function GET(request) {
  const makerId = request.nextUrl.searchParams.get("makerId");
  const proposals = readProposals();
  const list = makerId ? proposals.filter((p) => p.makerId === makerId) : proposals;
  return NextResponse.json([...list].reverse());
}
