import Anthropic from "@anthropic-ai/sdk";
import { ROLES } from "@/lib/store";

let _client;
export function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export const SYSTEM_PROMPT = `너는 'AI 시대에 작은 팀을 짜주는 전문가'야.
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

export const OUTPUT_SCHEMA = {
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
