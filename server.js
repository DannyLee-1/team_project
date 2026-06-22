import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 번들에 포함된 시드(읽기 전용) → 실행 시 쓰기 가능한 위치로 복사해 사용.
// Vercel 같은 서버리스에선 파일시스템이 읽기 전용이라 /tmp 를 쓴다(인스턴스 단위 휘발).
const SEED_DIR = path.join(__dirname, "data");
const DATA_DIR = process.env.VERCEL ? "/tmp/somssi-data" : SEED_DIR;
const FILES = ["makers.json", "projects.json", "proposals.json"];
if (DATA_DIR !== SEED_DIR) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const f of FILES) {
    const dst = path.join(DATA_DIR, f);
    if (!fs.existsSync(dst)) fs.copyFileSync(path.join(SEED_DIR, f), dst);
  }
}
const MAKERS_PATH = path.join(DATA_DIR, "makers.json");
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
const PROPOSALS_PATH = path.join(DATA_DIR, "proposals.json");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const newId = (prefix) =>
  `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// IA 범례: 역할 후보는 정확히 3개. AI 매칭 enum = 이 3개.
const ROLES = ["서비스 기획자", "UX·UI 디자이너", "노코드·풀스택 개발자"];

const client = new Anthropic();

const SYSTEM_PROMPT = `너는 'AI 시대에 작은 팀을 짜주는 전문가'야.
비전문가가 적은 문제·아이디어와 객관식 답을 보고, 매칭용 브리프를 정리하고 필요한 역할을 짚어.

[브리프]
- brief.problem: 풀려는 문제 한 줄
- brief.target: 이걸 쓸 사람(타겟) 한 줄
- brief.coreFeature: 사용자가 말하거나 고른 방향의 요약 한 줄
  (※ 사용자가 한 말의 요약일 뿐, 네가 무엇을 만들지·세부 기능을 새로 정하지 마라)

[필요한 역할]
- 역할은 반드시 다음 3개 중에서만 고른다: ${ROLES.join(" / ")}
- 이 아이디어에 꼭 필요한 역할만 1~3개 고른다.

[사람 추천 — 부합도]
- 각 역할에는 그 역할(role 필드가 일치하는)에 해당하는 사람만 추천한다.
- 추천 근거는 '진짜 실력 신호(만든 결과물·문제를 푼 사례·평판)'만 사용한다.
- 각 사람의 부합도를 0~100점으로 보수적으로 매긴다(역할별 적합 순서, 보통 1~2명).
- 추천 이유는 2~3줄, 반드시 입력에 있는 사실만 인용. 과장·추측 금지.

출력은 정해진 JSON 스키마만. 다른 말 금지.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    brief: {
      type: "object",
      properties: {
        problem: { type: "string" },
        target: { type: "string" },
        coreFeature: { type: "string" },
      },
      required: ["problem", "target", "coreFeature"],
      additionalProperties: false,
    },
    roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: ROLES },
          why: { type: "string", description: "왜 이 역할이 필요한지 한 줄" },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                maker_id: { type: "string" },
                name: { type: "string" },
                score: { type: "integer", description: "0~100 부합도" },
                reasons: { type: "array", items: { type: "string" } },
              },
              required: ["maker_id", "name", "score", "reasons"],
              additionalProperties: false,
            },
          },
        },
        required: ["role", "why", "recommendations"],
        additionalProperties: false,
      },
    },
  },
  required: ["brief", "roles"],
  additionalProperties: false,
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 역할 enum 노출(공급 등록 시 사용)
app.get("/api/roles", (_req, res) => res.json(ROLES));

// 대시보드/KPI 현황
app.get("/api/stats", (_req, res) => {
  const makers = readJson(MAKERS_PATH);
  const projects = readJson(PROJECTS_PATH);
  res.json({
    projectCount: projects.length,
    expertCount: makers.length,
    verifiedCount: makers.filter((m) => m.verified).length,
    teamFormedCount: projects.filter((p) => p.teamFormed).length,
  });
});

// 최근 프로젝트(내 프로젝트·매칭 현황용)
app.get("/api/projects", (_req, res) => {
  const projects = readJson(PROJECTS_PATH);
  res.json([...projects].reverse().slice(0, 12));
});

// 전문가 DB
app.get("/api/makers", (_req, res) => res.json(readJson(MAKERS_PATH)));

// 공급측 등록 (역할은 3개 enum 중 하나)
app.post("/api/makers", (req, res) => {
  const { name, role, headline, work, interview, reputation, tags } = req.body ?? {};
  if (!name?.trim() || !headline?.trim() || !work?.trim()) {
    return res.status(400).json({ error: "이름, 한 줄 소개, 대표 결과물은 필수예요." });
  }
  const makerRole = ROLES.includes(role) ? role : ROLES[0];
  const makers = readJson(MAKERS_PATH);
  const maker = {
    id: newId("m"),
    name: name.trim(),
    headline: headline.trim(),
    role: makerRole,
    verified: false, // 운영자 인증 심사 전
    wants: interview?.trim() || "",
    skill_signals: {
      works: [work.trim()],
      solved_cases: [],
      reputation: reputation?.trim() ? [reputation.trim()] : [],
    },
    tags: (tags || "").split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 6),
  };
  makers.push(maker);
  writeJson(MAKERS_PATH, makers);

  // 데모: 등록하면 '받은 제안'이 내 정보에 바로 뜨도록 샘플 제안 1건 생성
  const proposals = readJson(PROPOSALS_PATH);
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
  writeJson(PROPOSALS_PATH, proposals);

  res.json({ ok: true, maker });
});

// 수요자가 '같이하기'를 보냄 → 해당 전문가가 받은 제안으로 기록 (MVP: 무조건 수락)
app.post("/api/propose", (req, res) => {
  const { makerId, fromName, idea, target } = req.body ?? {};
  if (!makerId) return res.status(400).json({ error: "대상 전문가가 필요해요." });
  const makers = readJson(MAKERS_PATH);
  const maker = makers.find((m) => m.id === makerId);
  const proposals = readJson(PROPOSALS_PATH);
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
  writeJson(PROPOSALS_PATH, proposals);
  res.json({ ok: true });
});

// 특정 전문가가 받은 제안 목록 (내 정보 · 받은 제안)
app.get("/api/proposals", (req, res) => {
  const makerId = req.query.makerId;
  const proposals = readJson(PROPOSALS_PATH);
  const list = makerId ? proposals.filter((p) => p.makerId === makerId) : proposals;
  res.json([...list].reverse());
});

// 운영자: 실력 인증 부여/해제
app.post("/api/makers/:id/verify", (req, res) => {
  const makers = readJson(MAKERS_PATH);
  const maker = makers.find((m) => m.id === req.params.id);
  if (!maker) return res.status(404).json({ error: "전문가를 찾을 수 없어요." });
  maker.verified = req.body?.verified !== false;
  writeJson(MAKERS_PATH, makers);
  res.json({ ok: true, verified: maker.verified });
});

// 수요측: 아이디어 + 가이드 답 → 브리프 + 역할 짚기 + 부합도 매칭
app.post("/api/recommend", async (req, res) => {
  const idea = (req.body?.idea || "").trim();
  const guide = req.body?.guide || {}; // { audience, coreHint, scale }
  const editedBrief = req.body?.editedBrief; // 사용자가 직접 수정한 브리프(재분석용)
  const reanalyze = !!req.body?.reanalyze;
  if (!idea) return res.status(400).json({ error: "아이디어를 한 줄 적어 주세요." });

  const makers = readJson(MAKERS_PATH);
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
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: userContent }],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "이 아이디어는 처리하기 어려워요. 다르게 적어 주세요." });
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "AI 응답을 받지 못했어요." });

    const result = JSON.parse(textBlock.text);
    const byId = Object.fromEntries(makers.map((m) => [m.id, m]));
    for (const role of result.roles ?? []) {
      for (const rec of role.recommendations ?? []) {
        const m = byId[rec.maker_id];
        rec.headline = m?.headline ?? "";
        rec.verified = !!m?.verified;
      }
    }

    // 재분석(reanalyze)일 땐 프로젝트를 새로 만들지 않고 기존 것을 재사용
    let projectId = req.body?.projectId || null;
    if (!reanalyze) {
      const projects = readJson(PROJECTS_PATH);
      const project = {
        id: newId("p"),
        idea,
        createdAt: new Date().toISOString(),
        roleCount: result.roles?.length ?? 0,
        teamFormed: false,
      };
      projects.push(project);
      writeJson(PROJECTS_PATH, projects);
      projectId = project.id;
    }

    res.json({ projectId, brief: result.brief, roles: result.roles });
  } catch (err) {
    console.error(err);
    const unauthorized = err?.status === 401;
    res.status(unauthorized ? 401 : 500).json({
      error: unauthorized
        ? "API 키 인증 실패. .env 의 ANTHROPIC_API_KEY 를 확인해 주세요."
        : "추천 생성 중 오류가 발생했어요.",
    });
  }
});

// 팀 결성(성사) 기록 — 성공 기준·NSM 측정
app.post("/api/team", (req, res) => {
  const { projectId, picks } = req.body ?? {};
  if (!projectId || !Array.isArray(picks) || picks.length === 0) {
    return res.status(400).json({ error: "결성할 팀원을 1명 이상 선택해 주세요." });
  }
  const projects = readJson(PROJECTS_PATH);
  const project = projects.find((p) => p.id === projectId);
  if (project) {
    project.teamFormed = true;
    project.picks = picks;
    writeJson(PROJECTS_PATH, projects);
  }
  res.json({ ok: true });
});

// 로컬에서만 서버를 띄운다. Vercel(서버리스)에서는 export 한 app 을 핸들러로 사용.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`솜씨(Somssi) 실행 중 → http://localhost:${PORT}`));
}

export default app;
