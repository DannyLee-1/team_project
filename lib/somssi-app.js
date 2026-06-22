// 솜씨 SPA 컨트롤러 (클라이언트 전용). page.js 의 useEffect 에서 startApp() 호출.
// IA 기반: 0 Landing · 1 분기 · 2 수요 · 3 공급 · 4 Dashboard · 5 My Info · 6 Admin
export function startApp() {
  const app = document.getElementById("app");
  if (!app) return;

  const S = {
    loggedIn: false,
    userName: "김다솔",
    isAdmin: false,
    idea: "",
    guide: {},
    projectId: null,
    brief: null,
    roles: [],
    accepted: new Map(),
    pending: null,
    teamRecorded: false,
    supplyRole: null,
    myMakerId: null,
    myMakerName: null,
    myMakerRole: null,
  };

  let ROLES = [];
  let MAKERS = {};

  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ic = (n) => `<svg class="ic"><use href="#${n}"/></svg>`;
  const initial = (n) => (n ? n.trim()[0] : "?");
  const roleColor = (role) =>
    role === "서비스 기획자" ? "g" : role === "UX·UI 디자이너" ? "p" : "c";

  function mount(html) {
    app.innerHTML = html;
    app.scrollTop = 0;
  }

  async function boot() {
    try {
      ROLES = await fetch("/api/roles").then((r) => r.json());
      const list = await (await fetch("/api/makers")).json();
      MAKERS = Object.fromEntries(list.map((m) => [m.id, m]));
    } catch {}
  }
  const json = (p) => fetch(p).then((r) => r.json());
  const post = (p, b) =>
    fetch(p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    }).then((r) => r.json().then((j) => ({ ok: r.ok, j })));

  const topBrand = () => `
    <div class="top">
      <span class="brand">솜씨</span>
      ${
        S.loggedIn
          ? `<span class="me" data-tab="${S.isAdmin ? "admin" : "me"}">${esc(initial(S.userName))}</span>`
          : `<span class="auth"><span class="pill-join" data-act="login">로그인</span></span>`
      }
    </div>`;
  const topFlow = (t) =>
    `<div class="topflow"><span class="ti-back" data-act="back">${ic("i-back")}</span><b>${esc(t)}</b></div>`;

  function tabbar(active) {
    let tabs;
    if (!S.loggedIn) tabs = [["home", "i-home", "소개"], ["service", "i-spark", "서비스"]];
    else if (S.isAdmin) tabs = [["admin", "i-shield", "운영자"]];
    else tabs = [["home", "i-home", "홈"], ["service", "i-spark", "서비스"], ["me", "i-user", "내정보"]];
    return `<div class="tabbar">${tabs
      .map(
        ([k, i, l]) =>
          `<button class="tab ${active === k ? "on" : ""}" data-tab="${k}">${ic(i)}${l}</button>`,
      )
      .join("")}</div>`;
  }

  function bindCommon(back) {
    app.querySelectorAll('[data-act="login"]').forEach((b) => (b.onclick = renderLogin));
    app.querySelectorAll('[data-act="signup"]').forEach((b) => (b.onclick = renderSignup));
    app.querySelectorAll("[data-tab]").forEach((t) => (t.onclick = () => goTab(t.dataset.tab)));
    const b = app.querySelector('[data-act="back"]');
    if (b && back) b.onclick = back;
    const g = app.querySelector('[data-act="closegate"]');
    if (g) g.onclick = (e) => e.target === g && renderLanding();
  }

  const ACCOUNTS = {
    a: { name: "김다솔", isAdmin: false },
    b: { name: "운영자", isAdmin: true },
  };
  function resetSession() {
    S.myMakerId = null;
    S.myMakerName = null;
    S.myMakerRole = null;
    S.accepted = new Map();
    S.pending = null;
  }
  function doAuth(idVal) {
    const acc = ACCOUNTS[(idVal || "").trim().toLowerCase()];
    if (!acc) return false;
    resetSession();
    S.loggedIn = true;
    S.userName = acc.name;
    S.isAdmin = acc.isAdmin;
    if (S.isAdmin) renderAdmin();
    else renderLanding();
    return true;
  }
  function doSignup(name) {
    resetSession();
    S.loggedIn = true;
    S.isAdmin = false;
    S.userName = (name || "").trim() || "김다솔";
    renderLanding();
  }
  function logout() {
    resetSession();
    S.loggedIn = false;
    S.userName = "김다솔";
    S.isAdmin = false;
    renderLanding();
  }
  function goTab(tab) {
    if (tab === "home") return renderLanding();
    if (tab === "service") return S.loggedIn ? renderBranch() : renderLanding(true);
    if (tab === "me") return renderMe();
    if (tab === "admin") return renderAdmin();
  }

  // ════════ 0. LANDING ════════
  async function renderLanding(gate = false) {
    const s = await json("/api/stats").catch(() => ({}));
    const stat = (n, l) => `<div class="stat"><div class="num">${n ?? "·"}</div><div class="lbl">${l}</div></div>`;
    mount(`
      ${topBrand()}
      <div class="scr">
        <span class="eyebrow">소개</span>
        <div class="h">아이디어만 있으면,<br/>팀을 솜씨가 찾아드려요</div>
        <div class="sub">개발·디자인을 몰라도 괜찮아요. 한 줄만 적으면<br/>AI가 필요한 역할을 짚고 딱 맞는 사람을 골라드려요.</div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:4px">
          <div class="vrow">${ic("i-spark")}한 줄 → 객관식 → 브리프, 1분이면 끝</div>
          <div class="vrow">${ic("i-shield")}검증된(✓인증) 사람만 추천</div>
          <div class="vrow">${ic("i-msgs")}같이하기 → 수락하면 상세 프로필 공개</div>
        </div>
        <div class="dash" style="margin-top:18px">
          <div class="dash-title">지금 솜씨에서는</div>
          <div class="dash-grid">
            ${stat(s.projectCount, "등록된 프로젝트")}${stat(s.expertCount, "등록된 전문가")}
            ${stat(s.verifiedCount, "인증된 전문가")}${stat(s.teamFormedCount, "결성된 팀")}
          </div>
        </div>
        <div class="grow"></div>
      </div>
      <div class="footer">
        ${
          !S.loggedIn
            ? `<button class="cta" data-act="signup">회원가입하고 시작하기</button>
               <button class="cta-o" data-act="login">로그인</button>`
            : S.isAdmin
            ? `<button class="cta" data-act="goadmin">운영자 모드로 이동</button>`
            : `<button class="cta" data-act="goservice">서비스 시작하기</button>`
        }
      </div>
      ${tabbar("home")}
      ${
        gate
          ? `<div class="overlay" data-act="closegate"><div class="sheet center">
              <div class="handle"></div><div class="lock">${ic("i-lock")}</div>
              <h4>로그인하고 시작해요</h4>
              <div class="sub">서비스(분기·매칭)는 로그인이 필요해요.<br/>소개는 로그인 없이 둘러볼 수 있어요.</div>
              <button class="cta" style="width:100%" data-act="login">로그인</button>
            </div></div>`
          : ""
      }`);
    bindCommon();
    const gs = app.querySelector('[data-act="goservice"]');
    if (gs) gs.onclick = () => goTab("service");
    const ga = app.querySelector('[data-act="goadmin"]');
    if (ga) ga.onclick = () => goTab("admin");
  }

  // ════════ 로그인 (데모 a/b) ════════
  function renderLogin() {
    mount(`
      ${topFlow("로그인")}
      <div class="scr">
        <span class="eyebrow">로그인</span>
        <div class="h">솜씨에<br/>로그인할게요</div>
        <div class="field-label">아이디</div>
        <input type="text" id="lId" placeholder="a 또는 b" autocomplete="off" />
        <div class="field-label">비밀번호</div>
        <input type="text" id="lPw" placeholder="비밀번호 (데모: 아무거나)" />
        <div id="lErr"></div>
        <div class="hint" style="margin-top:12px">계정이 없으세요? <span class="link" data-act="signup">회원가입</span></div>
        <div class="muted-card" style="margin-top:14px">
          데모 계정<br/>
          · <b>a</b> — 이용자 (김다솔)<br/>
          · <b>b</b> — 운영자 (운영자 모드 사용 가능)
        </div>
        <div class="grow"></div>
      </div>
      <div class="footer"><button class="cta" id="loginBtn">로그인</button></div>`);
    bindCommon(renderLanding);
    const tryLogin = () => {
      if (!doAuth(app.querySelector("#lId").value)) {
        app.querySelector("#lErr").innerHTML =
          `<div class="error-msg">아이디는 a 또는 b 예요. (데모 계정)</div>`;
      }
    };
    app.querySelector("#loginBtn").onclick = tryLogin;
    app.querySelector("#lId").addEventListener("keydown", (e) => e.key === "Enter" && tryLogin());
  }

  // ════════ 회원가입 ════════
  function renderSignup() {
    mount(`
      ${topFlow("회원가입")}
      <div class="scr">
        <span class="eyebrow">회원가입</span>
        <div class="h">솜씨<br/>시작하기</div>
        <div class="sub">소셜 로그인으로 30초면 끝나요.</div>
        <button class="social kakao" data-soc>${ic("i-msgs")} 카카오로 시작하기</button>
        <button class="social google" data-soc>${ic("i-user")} 구글로 시작하기</button>
        <div class="divider"><span>또는 이메일로 가입</span></div>
        <div class="field-label">이름 / 닉네임</div>
        <input type="text" id="suName" placeholder="예) 김다솔" />
        <div class="field-label">이메일</div>
        <input type="text" id="suEmail" placeholder="example@somssi.kr" />
        <div class="field-label">비밀번호</div>
        <input type="text" id="suPw" placeholder="비밀번호" />
        <div class="hint" style="margin-top:12px">이미 계정이 있으세요? <span class="link" data-act="login">로그인</span></div>
        <div class="grow"></div>
      </div>
      <div class="footer"><button class="cta" id="suBtn">회원가입 완료</button></div>`);
    bindCommon(renderLanding);
    app.querySelector("#suBtn").onclick = () => doSignup(app.querySelector("#suName").value);
    app.querySelectorAll("[data-soc]").forEach((b) => (b.onclick = () => doSignup()));
  }

  // ════════ 1. 분기 ════════
  function renderBranch() {
    mount(`
      ${topBrand()}
      <div class="scr">
        <span class="eyebrow">서비스</span>
        <div class="h">무엇을<br/>도와드릴까요?</div>
        <div class="pick" style="margin-top:8px">
          <div class="opt-card sel" data-act="demand"><b>팀원 구하기 ${ic("i-arrow")}</b><p>만들고 싶은 아이디어가 있어요</p></div>
          <div class="opt-card clay" data-act="supply"><b>팀원 되기</b><p>실력으로 협업 기회를 받을래요</p></div>
        </div>
      </div>
      ${tabbar("service")}`);
    bindCommon();
    app.querySelector('[data-act="demand"]').onclick = startDemand;
    app.querySelector('[data-act="supply"]').onclick = renderSupplyRole;
  }

  // ════════ 2. 수요 플로우 ════════
  const IDEA_CHIPS = ["독거 어르신 안부 확인", "복지 제도 안내 챗봇", "자원봉사 매칭"];
  function startDemand() {
    S.idea = "";
    S.guide = {};
    S.accepted = new Map();
    S.pending = null;
    S.teamRecorded = false;
    renderIdea();
  }
  function renderIdea() {
    mount(`
      ${topFlow("팀원 구하기 · 1단계")}
      <div class="scr">
        <span class="eyebrow">아이디어 입력 · H5</span>
        <div class="h">어떤 걸<br/>만들고 싶으세요?</div>
        <textarea id="idea" rows="5" placeholder="예) 지역 돌봄 사각지대의 독거 어르신을 매일 자동으로 안부 확인하고, 이상 신호가 있으면 복지사에게 알려주고 싶어요.">${esc(S.idea)}</textarea>
        <div class="chips">${IDEA_CHIPS.map(
          (c) => `<span class="chip pick" data-chip="${esc(c)}">${esc(c)}</span>`,
        ).join("")}</div>
        <div class="hint">전문 용어 없이 한 줄이면 충분해요.</div>
      </div>
      <div class="footer"><button class="cta" id="next" disabled>다음</button></div>`);
    bindCommon(renderBranch);
    const ta = app.querySelector("#idea"),
      next = app.querySelector("#next");
    const sync = () => (next.disabled = !ta.value.trim());
    ta.oninput = () => {
      S.idea = ta.value;
      sync();
    };
    app.querySelectorAll("[data-chip]").forEach(
      (c) =>
        (c.onclick = () => {
          ta.value = c.dataset.chip;
          S.idea = ta.value;
          sync();
          ta.focus();
        }),
    );
    next.onclick = () => S.idea.trim() && openGuide(0);
    sync();
  }

  const GUIDE = [
    { key: "audience", q: "주로 누가 쓰면 좋을까요?", opts: ["어르신·돌봄 대상", "보호자·가족", "복지 종사자", "일반 사용자"] },
    { key: "coreHint", q: "어떤 방식에 가까울까요?", opts: ["알림·리마인드", "정보 모아보기", "매칭·연결", "상담·대화"] },
    { key: "scale", q: "규모는 어느 정도일까요?", opts: ["동네·소규모", "지역 단위", "전국", "아직 몰라요"] },
  ];
  function openGuide(step) {
    const g = GUIDE[step];
    if (!g) return submitIdea();
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `
      <div class="sheet">
        <div class="handle"></div>
        <div class="progress"><span>${ic("i-spark")} AI 가이드</span><span>${step + 1} / ${GUIDE.length} · 1분이면 끝나요</span></div>
        <div class="q">${esc(g.q)}</div>
        <div class="pick">${g.opts
          .map((o) => `<div class="opt-card" data-opt="${esc(o)}"><b style="font-weight:500;font-size:14px">${esc(o)}</b></div>`)
          .join("")}</div>
        <button class="cta-mute" data-opt="">잘 모르겠어요 · 건너뛰기</button>
      </div>`;
    app.appendChild(ov);
    ov.querySelectorAll("[data-opt]").forEach(
      (el) =>
        (el.onclick = () => {
          if (el.dataset.opt) S.guide[g.key] = el.dataset.opt;
          ov.remove();
          openGuide(step + 1);
        }),
    );
    ov.onclick = (e) => e.target === ov && ov.remove();
  }

  async function submitIdea() {
    renderLoading();
    const { ok, j } = await post("/api/recommend", { idea: S.idea, guide: S.guide }).catch(() => ({ ok: false, j: {} }));
    if (!ok) return renderIdeaError(j.error);
    S.projectId = j.projectId;
    S.brief = j.brief || { problem: S.idea, target: "", coreFeature: "" };
    S.roles = j.roles || [];
    renderBrief();
  }
  function renderLoading() {
    mount(`<div class="topflow"><b>AI 매칭 중</b></div>
      <div class="loading"><div class="spinner"></div><p>브리프를 정리하고<br/>부합도 높은 사람을 고르고 있어요…</p></div>`);
  }
  function renderIdeaError(msg) {
    renderIdea();
    const e = document.createElement("div");
    e.className = "error-msg";
    e.textContent = msg || "오류가 발생했어요.";
    app.querySelector(".scr").appendChild(e);
  }

  // 매칭용 브리프 (H1)
  function renderBrief() {
    const roleChips = S.roles.map((r) => `<span class="chip">${esc(r.role)}</span>`).join("");
    mount(`
      ${topFlow("팀원 구하기 · 브리프")}
      <div class="scr">
        <span class="eyebrow ai">${ic("i-file")} 매칭용 브리프 · AI 산출</span>
        <div class="h sm">이렇게 정리해봤어요</div>
        <div class="sub">맞으면 그대로, 아니면 고쳐도 돼요. 무엇을 만들지는 팀이 정해요.</div>
        <div class="field-label">문제</div>
        <input type="text" id="bP" value="${esc(S.brief.problem)}" />
        <div class="field-label">타겟</div>
        <input type="text" id="bT" value="${esc(S.brief.target)}" />
        <div class="field-label">핵심 방향</div>
        <input type="text" id="bC" value="${esc(S.brief.coreFeature)}" />
        <div class="field-label">필요한 역할</div>
        <div class="chips" style="margin-top:4px">${roleChips}</div>
        <button class="cta-o" data-act="reanalyze" style="margin-top:16px">${ic("i-spark")} 수정한 내용으로 다시 분석</button>
        <div class="hint" style="margin-top:8px">문제·타겟·핵심 방향을 고치고 누르면 AI가 그 내용으로 다시 정리·매칭해요.</div>
        <div class="grow"></div>
      </div>
      <div class="footer"><button class="cta" data-act="match">이 브리프로 팀 찾기</button></div>`);
    bindCommon(renderIdea);
    const readBrief = () => ({
      problem: app.querySelector("#bP").value,
      target: app.querySelector("#bT").value,
      coreFeature: app.querySelector("#bC").value,
    });
    app.querySelector('[data-act="match"]').onclick = () => {
      S.brief = readBrief();
      renderMatch();
    };
    app.querySelector('[data-act="reanalyze"]').onclick = async () => {
      const edited = readBrief();
      renderLoading();
      const { ok, j } = await post("/api/recommend", {
        idea: S.idea,
        guide: S.guide,
        editedBrief: edited,
        reanalyze: true,
        projectId: S.projectId,
      }).catch(() => ({ ok: false, j: {} }));
      if (!ok) {
        S.brief = edited;
        return renderBrief();
      }
      if (j.projectId) S.projectId = j.projectId;
      S.brief = j.brief || edited;
      S.roles = j.roles || S.roles;
      renderBrief();
    };
  }

  // 부합도 매칭 (H2·H5)
  function renderMatch() {
    const groups = S.roles
      .map((role) => {
        const color = roleColor(role.role);
        const cands = role.recommendations
          .map((rec) => {
            const joined = S.accepted.has(rec.maker_id);
            return `<div class="cand2">
              <span class="av s ${color}">${esc(initial(rec.name))}</span>
              <div class="meta">
                <div class="ln1">${esc(rec.name)}${rec.verified ? `<span class="shield">${ic("i-shield")}</span>` : ""}</div>
                <div class="ln2">${esc(rec.headline || "")} · 부합 ${rec.score}%</div>
              </div>
              <button class="btn-join ${joined ? "done" : ""}" data-join="${esc(rec.maker_id)}" data-role="${esc(role.role)}" ${joined ? "disabled" : ""}>${joined ? "✓ 합류" : "같이하기"}</button>
            </div>`;
          })
          .join("");
        return `<div class="grp"><div class="glab">${esc(role.role)}</div>${cands}</div>`;
      })
      .join("");
    const n = S.accepted.size;
    mount(`
      ${topFlow("팀원 구하기 · 매칭")}
      <div class="scr">
        <span class="eyebrow ai">${ic("i-spark")} AI 매칭 · 부합도순</span>
        <div class="h sm">부합도 높은 사람이에요</div>
        <div class="sub">선택 전엔 간단 프로필만 보여요.<br/>같이하기를 보내 수락하면 상세가 열려요.</div>
        ${groups}
        <div class="hint" style="text-align:center;margin-top:6px">추천 근거는 실제 결과물·평판만 사용했어요</div>
      </div>
      ${n ? `<div class="footer"><button class="cta" data-act="team">팀 시작하기 (${n}명)</button></div>` : ""}`);
    bindCommon(renderBrief);
    app.querySelectorAll("[data-join]").forEach(
      (b) =>
        (b.onclick = async () => {
          const role = S.roles.find((r) => r.role === b.dataset.role);
          const rec = role.recommendations.find((r) => r.maker_id === b.dataset.join);
          S.pending = { rec, roleLabel: role.role, color: roleColor(role.role) };
          post("/api/propose", {
            makerId: rec.maker_id,
            fromName: "김다솔",
            idea: S.brief?.problem || S.idea,
            target: S.brief?.target || "",
          }).catch(() => {});
          renderMatched();
        }),
    );
    const t = app.querySelector('[data-act="team"]');
    if (t) t.onclick = renderTeamDone;
  }

  function renderMatched() {
    const { rec, roleLabel, color } = S.pending;
    const m = MAKERS[rec.maker_id] || {};
    const sig = m.skill_signals || {};
    const works = (sig.works || []).join(" · ") || "대표 결과물 준비중";
    const rep = (sig.reputation || [])[0] || "평판 정보 준비중";
    const wants = m.wants || "협업 방식은 대화로 맞춰가요";
    mount(`
      ${topFlow("같이하기 · 수락됨")}
      <div class="scr">
        <span class="eyebrow br">같이하기 수락됨 · 상세 프로필 공개</span>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="circ c" style="width:44px;height:44px">${ic("i-check")}</div><div class="h sm">바로 수락됐어요!</div>
        </div>
        <div class="dcard">
          <div class="dhead"><span class="av ${color}" style="width:40px;height:40px;font-size:15px">${esc(initial(rec.name))}</span>
            <div><div class="drole">${esc(rec.name)} · ${esc(roleLabel)}${rec.verified ? `<span class="shield">${ic("i-shield")}</span>` : ""}</div><div class="dmeta">부합 ${rec.score}%</div></div></div>
          <div class="dline">${ic("i-file")}<div><div class="dk">대표 결과물</div>${esc(works)}</div></div>
          <div class="dline">${ic("i-msgs")}<div><div class="dk">평판·인터뷰</div>${esc(rep)}</div></div>
          <div class="dline">${ic("i-users")}<div><div class="dk">원하는 협업</div>${esc(wants)}</div></div>
        </div>
        <div class="grow"></div>
      </div>
      <div class="footer"><button class="cta" data-act="add">팀에 추가하고 계속</button></div>`);
    bindCommon(renderMatch);
    app.querySelector('[data-act="add"]').onclick = () => {
      S.accepted.set(rec.maker_id, { rec, roleLabel, color });
      S.pending = null;
      renderMatch();
    };
  }

  async function renderTeamDone() {
    if (!S.teamRecorded) {
      S.teamRecorded = true;
      post("/api/team", { projectId: S.projectId, picks: [...S.accepted.keys()] }).catch(() => {});
    }
    const members = [...S.accepted.values()]
      .map(
        ({ rec, roleLabel, color }) =>
          `<div class="mem"><span class="av ${color}">${esc(initial(rec.name))}</span><small>${esc(roleLabel.split(/[ ·/]/)[0])}</small></div>`,
      )
      .join("");
    mount(`
      <div class="scr center">
        <span class="eyebrow" style="align-self:flex-start">성사 완료</span>
        <div class="party">${ic("i-users")}</div>
        <div class="h">팀이 만들어졌어요!</div>
        <div class="sub">${S.accepted.size}명이 합류했어요.<br/>이제 함께 첫 작동 버전을 만들어봐요.</div>
        <div class="team">${members}</div>
        <div class="grow"></div>
        <div class="scope">솜씨는 여기까지 — 만들기는 팀이 직접 정해요 (협업은 플랫폼 밖)</div>
      </div>
      <div class="footer"><button class="cta" data-act="me">내 정보에서 확인</button></div>`);
    app.querySelector('[data-act="me"]').onclick = renderMe;
  }

  // ════════ 3. 공급 플로우 ════════
  function renderSupplyRole() {
    mount(`
      ${topFlow("팀원 되기 · 역할 선택")}
      <div class="scr">
        <span class="eyebrow br">${ic("i-shield")} 프로필 등록</span>
        <div class="h sm">어떤 역할로<br/>참여하시겠어요?</div>
        <div class="sub">솜씨의 역할은 3가지예요. 하나를 골라주세요.</div>
        <div class="pick" style="margin-top:6px">
          ${ROLES.map(
            (r) => `<div class="opt-card ${S.supplyRole === r ? "sel" : ""}" data-role="${esc(r)}"><b>${esc(r)}</b></div>`,
          ).join("")}
        </div>
        <div class="grow"></div>
      </div>
      <div class="footer"><button class="cta clay" id="rnext" ${S.supplyRole ? "" : "disabled"}>다음</button></div>`);
    bindCommon(renderBranch);
    const cards = app.querySelectorAll("[data-role]");
    const next = app.querySelector("#rnext");
    cards.forEach(
      (el) =>
        (el.onclick = () => {
          S.supplyRole = el.dataset.role;
          cards.forEach((c) => c.classList.toggle("sel", c === el));
          next.disabled = false;
        }),
    );
    next.onclick = renderSupplyForm;
  }

  function renderSupplyForm() {
    mount(`
      ${topFlow("팀원 되기 · 실력 신호")}
      <div class="scr">
        <span class="eyebrow br">${esc(S.supplyRole)}</span>
        <div class="h sm">실력으로<br/>자신을 증명하세요</div>
        <div class="sub">이력서 대신 결과물·인터뷰·평판으로. 운영자 검증 후 ✓인증.</div>
        <div class="lrow" style="box-shadow:none;background:var(--g50);margin-top:4px">
          <span class="av s g">${esc(initial(S.userName))}</span>
          <div class="lrow-main"><div class="lrow-t">${esc(S.userName)}</div>
          <div class="lrow-s">계정 이름으로 등록돼요</div></div>
        </div>
        <div class="field-label">한 줄 소개</div><input type="text" id="sHeadline" placeholder="예) 복지·공공 서비스 풀스택 개발자" />
        <div class="field-label">대표 결과물 / 포트폴리오</div>
        <textarea id="sWork" rows="3" placeholder="예) 독거노인 안부 확인 웹앱을 혼자 만들어 복지관 3곳에 배포, 월 220명 사용"></textarea>
        <div class="field-label">인터뷰 한마디 (어떤 협업을 원하나요, 선택)</div>
        <input type="text" id="sItv" placeholder="예) 사회적 가치 있는 초기 아이디어를 빠르게 만들고 싶어요" />
        <div class="field-label">평판 / 레퍼런스 (선택)</div>
        <input type="text" id="sRep" placeholder="예) 함께 일한 복지사 평: 현장 언어로 빠르게 만든다" />
        <div class="field-label">태그 (선택)</div><input type="text" id="sTags" placeholder="예) 풀스택, React, 복지도메인" />
      </div>
      <div class="footer"><button class="cta clay" id="reg" disabled>전문가로 등록하기</button></div>`);
    bindCommon(renderSupplyRole);
    const req = ["sHeadline", "sWork"].map((i) => app.querySelector("#" + i));
    const btn = app.querySelector("#reg");
    const sync = () => (btn.disabled = req.some((e) => !e.value.trim()));
    req.forEach((e) => (e.oninput = sync));
    btn.onclick = submitMaker;
  }

  async function submitMaker() {
    const body = {
      name: S.userName,
      role: S.supplyRole,
      headline: app.querySelector("#sHeadline").value,
      work: app.querySelector("#sWork").value,
      interview: app.querySelector("#sItv").value,
      reputation: app.querySelector("#sRep").value,
      tags: app.querySelector("#sTags").value,
    };
    const { ok, j } = await post("/api/makers", body);
    if (!ok) {
      const e = document.createElement("div");
      e.className = "error-msg";
      e.textContent = j.error;
      app.querySelector(".scr").appendChild(e);
      return;
    }
    MAKERS[j.maker.id] = j.maker;
    S.myMakerId = j.maker.id;
    S.myMakerName = j.maker.name;
    S.myMakerRole = j.maker.role;
    mount(`
      <div class="scr center">
        <span class="eyebrow br" style="align-self:flex-start">등록 완료</span>
        <div class="circ c" style="margin-top:8px">${ic("i-check")}</div>
        <div class="h sm">${esc(body.name)}님,<br/>전문가 풀에 등록됐어요</div>
        <div class="sub">역할: ${esc(body.role)}<br/>운영자 검증을 거치면 ✓인증 마크가 붙고 추천돼요.</div>
        <div class="grow"></div>
      </div>
      <div class="footer"><button class="cta" data-act="me">내 정보에서 받은 제안 보기</button></div>`);
    app.querySelector('[data-act="me"]').onclick = renderMe;
  }

  // ════════ 내 프로젝트·매칭 현황 ════════
  async function myProjectsSection() {
    const projects = await json("/api/projects").catch(() => []);
    return (
      (projects || [])
        .slice(0, 5)
        .map(
          (p) => `<div class="lrow">
          <div class="lrow-main"><div class="lrow-t">${esc(p.idea)}</div>
          <div class="lrow-s">${p.teamFormed ? "성사 완료" : "매칭 진행 중"} · 역할 ${p.roleCount || "-"}</div></div>
          <span class="badge ${p.teamFormed ? "done" : "wait"}">${p.teamFormed ? "결성" : "진행"}</span>
        </div>`,
        )
        .join("") ||
      '<div class="muted-card">아직 의뢰한 프로젝트가 없어요. 서비스 탭 → 팀원 구하기에서 시작해보세요.</div>'
    );
  }

  // ════════ 5. MY INFORMATION ════════
  async function renderMe() {
    let inbox = "";
    if (S.myMakerId) {
      const proposals = await json("/api/proposals?makerId=" + S.myMakerId).catch(() => []);
      inbox =
        proposals.length === 0
          ? `<div class="muted-card">아직 받은 제안이 없어요. 누군가 같이하기를 보내면 여기에 떠요.</div>`
          : proposals
              .map(
                (p) => `<div class="lrow">
                  <span class="me" style="width:38px;height:38px;font-size:13px">${esc(initial(p.fromName))}</span>
                  <div class="lrow-main">
                    <div class="lrow-t">${esc(p.fromName)}님이 같이하기를 제안했어요</div>
                    <div class="lrow-s">“${esc(p.idea || "")}”</div>
                  </div>
                  <span class="badge done">매칭</span>
                </div>`,
              )
              .join("");
    }

    const supplierCard = S.myMakerId
      ? `<div class="dcard" style="margin-bottom:9px">
          <div class="dhead"><span class="av c" style="width:40px;height:40px;font-size:15px">${esc(initial(S.myMakerName))}</span>
          <div><div class="drole">${esc(S.myMakerName)} · ${esc(S.myMakerRole)}</div>
          <div class="dmeta">내 전문가 프로필 · 검증 대기</div></div></div></div>`
      : "";

    const myProjects = await myProjectsSection();
    const supplySection = S.myMakerId
      ? `${supplierCard}${inbox}`
      : `<div class="muted-card">아직 ‘팀원 되기’로 등록하지 않았어요.<br/>등록하면 내 전문가 프로필과 받은 제안이 여기 표시돼요. (서비스 탭 → 팀원 되기)</div>`;

    mount(`
      ${topBrand()}
      <div class="scr">
        <span class="eyebrow">My Information</span>
        <div class="dcard">
          <div class="dhead"><span class="me" style="width:44px;height:44px;font-size:16px">${esc(initial(S.userName))}</span>
            <div><div class="drole">${esc(S.userName)}</div><div class="dmeta">비전문가(수요자) · 로그인됨</div></div></div>
          <button class="cta-o" data-act="editp">프로필 수정</button>
        </div>

        <div class="sec-head"><span class="sec-dot g"></span>🧩 팀 구하기 <span class="sec-sub">내가 의뢰한 프로젝트</span></div>
        ${myProjects}

        <div class="sec-head"><span class="sec-dot c"></span>🛠️ 팀원으로 하기 <span class="sec-sub">내가 참여 · 받은 제안</span></div>
        ${supplySection}

        <div class="field-label">${ic("i-gear")} 계정 설정</div>
        <div class="muted-card">계정 설정 · 알림 설정 — 준비 중 (이번 버전 보류)</div>

        <div class="grow"></div>
        <button class="cta-mute" data-act="logout" style="margin-top:14px;color:#b5462a">로그아웃</button>
      </div>
      ${tabbar("me")}`);
    bindCommon();
    app.querySelector('[data-act="editp"]').onclick = () => alert("프로필 수정은 데모에서는 준비 중이에요.");
    app.querySelector('[data-act="logout"]').onclick = logout;
  }

  // ════════ 6. ADMIN ════════
  async function renderAdmin() {
    const [s, list] = await Promise.all([json("/api/stats"), json("/api/makers")]).catch(() => [{}, []]);
    const conv = s.projectCount ? Math.round((s.teamFormedCount / s.projectCount) * 100) : 0;
    const stat = (n, l) => `<div class="stat"><div class="num">${n ?? 0}</div><div class="lbl">${l}</div></div>`;
    const rows = (list || [])
      .map(
        (m) => `<div class="lrow">
          <div class="lrow-main"><div class="lrow-t">${esc(m.name)} ${m.verified ? `<span class="shield">${ic("i-shield")}</span>` : ""}</div><div class="lrow-s">${esc(m.role || "-")} · ${esc(m.headline || "")}</div></div>
          <button class="btn-join ${m.verified ? "done" : ""}" data-verify="${esc(m.id)}" data-on="${m.verified ? "1" : "0"}">${m.verified ? "인증 해제" : "인증 부여"}</button>
        </div>`,
      )
      .join("");
    mount(`
      ${topBrand()}
      <div class="scr">
        <span class="eyebrow">운영자 모드 · Admin</span>
        <div class="h sm">${esc(S.userName)}님,<br/>플랫폼을 관리해요</div>
        <div class="field-label">${ic("i-chart")} 측정 대시보드 · 활성도</div>
        <div class="dash"><div class="dash-grid">${stat(s.projectCount, "프로젝트")}${stat(s.expertCount, "전문가")}${stat(s.verifiedCount, "인증 전문가")}${stat(s.teamFormedCount, "결성된 팀")}</div></div>
        <div class="dash" style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div class="lrow-t">매칭→결성 전환율 (NSM/KPI)</div><div class="num" style="font-size:20px">${conv}%</div>
          </div>
          <div class="stepper">${["브리프", "같이하기", "수락", "성사", "출시"]
            .map((st, i) => `<span class="step ${i <= 3 ? "on" : ""}">${st}</span>`)
            .join("<i></i>")}</div>
          <div class="hint" style="margin-top:6px">성공 끝점 = '첫 작동 버전 출시' (플랫폼 밖에서 측정)</div>
        </div>

        <div class="field-label">전문가 DB 관리 · 실력 인증 (H2·H4)</div>
        ${rows}

        <div class="field-label">기관 제휴 관리</div>
        <div class="muted-card">창업지원·복지·교육 기관 제휴 — 준비 중 (Cold start 2단계 · 보류)</div>
        <div class="grow"></div>
        <button class="cta-mute" data-act="logout" style="margin-top:14px;color:#b5462a">로그아웃</button>
      </div>
      ${tabbar("admin")}`);
    bindCommon();
    app.querySelector('[data-act="logout"]').onclick = logout;
    app.querySelectorAll("[data-verify]").forEach(
      (b) =>
        (b.onclick = async () => {
          await post(`/api/makers/${b.dataset.verify}/verify`, { verified: b.dataset.on !== "1" });
          const fresh = await (await fetch("/api/makers")).json();
          MAKERS = Object.fromEntries(fresh.map((m) => [m.id, m]));
          renderAdmin();
        }),
    );
  }

  // 시작
  (async () => {
    await boot();
    renderLanding();
  })();
}
