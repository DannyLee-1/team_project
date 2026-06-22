import fs from "node:fs";
import path from "node:path";
import makersSeed from "@/data/makers.json";
import projectsSeed from "@/data/projects.json";
import proposalsSeed from "@/data/proposals.json";

// Vercel(서버리스)은 파일시스템이 읽기 전용 → /tmp 에 시드를 풀어 읽고 쓴다(인스턴스 단위 휘발).
// 로컬에선 data/ 디렉터리를 직접 읽고 쓴다.
const onVercel = !!process.env.VERCEL;
const DATA_DIR = onVercel ? "/tmp/somssi-data" : path.join(process.cwd(), "data");
const SEED = {
  "makers.json": makersSeed,
  "projects.json": projectsSeed,
  "proposals.json": proposalsSeed,
};

if (onVercel) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const [f, seed] of Object.entries(SEED)) {
      const p = path.join(DATA_DIR, f);
      if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(seed, null, 2));
    }
  } catch {}
}

const P = (f) => path.join(DATA_DIR, f);
const read = (f) => JSON.parse(fs.readFileSync(P(f), "utf-8"));
const write = (f, d) => fs.writeFileSync(P(f), JSON.stringify(d, null, 2));

export const readMakers = () => read("makers.json");
export const writeMakers = (d) => write("makers.json", d);
export const readProjects = () => read("projects.json");
export const writeProjects = (d) => write("projects.json", d);
export const readProposals = () => read("proposals.json");
export const writeProposals = (d) => write("proposals.json", d);

export const newId = (prefix) =>
  `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// IA 범례: 역할 후보는 정확히 3개. AI 매칭 enum = 이 3개.
export const ROLES = ["서비스 기획자", "UX·UI 디자이너", "노코드·풀스택 개발자"];
