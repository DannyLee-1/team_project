import { NextResponse } from "next/server";
import {
  ROLES,
  newId,
  readMakers,
  writeMakers,
  readProposals,
  writeProposals,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readMakers());
}

export async function POST(request) {
  const { name, role, headline, work, interview, reputation, tags } = await request
    .json()
    .catch(() => ({}));
  if (!name?.trim() || !headline?.trim() || !work?.trim()) {
    return NextResponse.json({ error: "이름, 한 줄 소개, 대표 결과물은 필수예요." }, { status: 400 });
  }
  const makerRole = ROLES.includes(role) ? role : ROLES[0];
  const makers = readMakers();
  const maker = {
    id: newId("m"),
    name: name.trim(),
    headline: headline.trim(),
    role: makerRole,
    verified: false,
    wants: interview?.trim() || "",
    skill_signals: {
      works: [work.trim()],
      solved_cases: [],
      reputation: reputation?.trim() ? [reputation.trim()] : [],
    },
    tags: (tags || "").split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 6),
  };
  makers.push(maker);
  writeMakers(makers);

  // 데모: 등록하면 '받은 제안'이 내 정보에 바로 뜨도록 샘플 제안 1건 생성
  const proposals = readProposals();
  proposals.push({
    id: newId("pr"),
    makerId: maker.id,
    makerName: maker.name,
    fromName: "김다솔",
    fromRole: "15년 차 사회복지사",
    idea: "독거 어르신을 매일 자동으로 안부 확인하고, 이상 신호가 있으면 복지사에게 알려주는 서비스",
    target: "어르신·돌봄 대상",
    createdAt: new Date().toISOString(),
  });
  writeProposals(proposals);

  return NextResponse.json({ ok: true, maker });
}
