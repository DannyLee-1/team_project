import { NextResponse } from "next/server";
import { readProjects, writeProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 팀 결성(성사) 기록 — 성공 기준·NSM 측정
export async function POST(request) {
  const { projectId, picks } = await request.json().catch(() => ({}));
  if (!projectId || !Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "결성할 팀원을 1명 이상 선택해 주세요." }, { status: 400 });
  }
  const projects = readProjects();
  const project = projects.find((p) => p.id === projectId);
  if (project) {
    project.teamFormed = true;
    project.picks = picks;
    writeProjects(projects);
  }
  return NextResponse.json({ ok: true });
}
