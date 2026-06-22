import { NextResponse } from "next/server";
import {
  ROLES,
  newId,
  readMakers,
  readProjects,
  writeProjects,
} from "@/lib/store";
import { client, SYSTEM_PROMPT, OUTPUT_SCHEMA } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const idea = (body?.idea || "").trim();
  const guide = body?.guide || {}; // { audience, coreHint, scale }
  const editedBrief = body?.editedBrief; // 사용자가 직접 수정한 브리프(재분석용)
  const reanalyze = !!body?.reanalyze;
  if (!idea) return NextResponse.json({ error: "아이디어를 한 줄 적어 주세요." }, { status: 400 });

  const makers = readMakers();
  const guideLines = [
    guide.audience && `- 주로 쓸 사람(타겟): ${guide.audience}`,
    guide.coreHint && `- 방식(핵심기능 방향): ${guide.coreHint}`,
    guide.scale && `- 규모: ${guide.scale}`,
  ]
    .filter(Boolean)
    .join("\n");

  const editedLines = editedBrief
    ? [
        editedBrief.problem && `- 문제: ${editedBrief.problem}`,
        editedBrief.target && `- 타겟: ${editedBrief.target}`,
        editedBrief.coreFeature && `- 핵심 방향: ${editedBrief.coreFeature}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const userContent = `# 비전문가의 문제·아이디어
${idea}
${guideLines ? `\n# 객관식 가이드 답\n${guideLines}` : ""}
${
  editedLines
    ? `\n# 사용자가 직접 수정한 브리프 (이 내용을 최우선으로 반영해 brief 를 다시 정리하고 역할·매칭을 다시 도출하라)\n${editedLines}`
    : ""
}

# 등록된 만드는 사람들(각자 role 보유: ${ROLES.join(", ")})
${JSON.stringify(makers, null, 2)}

위 정보를 바탕으로 brief 를 정리하고, 필요한 역할(3개 enum 중)을 짚고, 역할별로 사람을 추천해줘.`;

  try {
    const response = await client().messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: userContent }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "이 아이디어는 처리하기 어려워요. 다르게 적어 주세요." },
        { status: 422 },
      );
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) return NextResponse.json({ error: "AI 응답을 받지 못했어요." }, { status: 502 });

    const result = JSON.parse(textBlock.text);
    const byId = Object.fromEntries(makers.map((m) => [m.id, m]));
    for (const role of result.roles ?? []) {
      for (const rec of role.recommendations ?? []) {
        const m = byId[rec.maker_id];
        rec.headline = m?.headline ?? "";
        rec.verified = !!m?.verified;
      }
    }

    // 재분석이 아니면 프로젝트 신규 생성, 재분석이면 기존 id 재사용
    let projectId = body?.projectId || null;
    if (!reanalyze) {
      const projects = readProjects();
      const project = {
        id: newId("p"),
        idea,
        createdAt: new Date().toISOString(),
        roleCount: result.roles?.length ?? 0,
        teamFormed: false,
      };
      projects.push(project);
      writeProjects(projects);
      projectId = project.id;
    }

    return NextResponse.json({ projectId, brief: result.brief, roles: result.roles });
  } catch (err) {
    console.error(err);
    const unauthorized = err?.status === 401;
    return NextResponse.json(
      {
        error: unauthorized
          ? "API 키 인증 실패. ANTHROPIC_API_KEY 환경변수를 확인해 주세요."
          : "추천 생성 중 오류가 발생했어요.",
      },
      { status: unauthorized ? 401 : 500 },
    );
  }
}
