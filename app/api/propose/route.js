import { NextResponse } from "next/server";
import { newId, readMakers, readProposals, writeProposals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 수요자가 '같이하기'를 보냄 → 해당 전문가가 받은 제안으로 기록 (MVP: 무조건 수락)
export async function POST(request) {
  const { makerId, fromName, idea, target } = await request.json().catch(() => ({}));
  if (!makerId) return NextResponse.json({ error: "대상 전문가가 필요해요." }, { status: 400 });
  const maker = readMakers().find((m) => m.id === makerId);
  const proposals = readProposals();
  proposals.push({
    id: newId("pr"),
    makerId,
    makerName: maker?.name ?? "",
    fromName: fromName?.trim() || "아이디어 제안자",
    fromRole: "비전문가",
    idea: (idea || "").trim(),
    target: (target || "").trim(),
    createdAt: new Date().toISOString(),
  });
  writeProposals(proposals);
  return NextResponse.json({ ok: true });
}
