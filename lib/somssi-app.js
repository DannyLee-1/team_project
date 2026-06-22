// 솜씨 — 웹 디자인 SPA 컨트롤러 (클라이언트 전용). page.js useEffect 에서 startApp() 호출.
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

  const json = (p) => fetch(p).then((r) => r.json());
  const post = (p, b) =>
    fetch(p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    }).then((r) => r.json().then((j) => ({ ok: r.ok, j })));

  async function boot() {
    try {
      ROLES = await fetch("/api/roles").then((r) => r.json());
      const list = await (await fetch("/api/makers")).json();
      MAKERS = Object.fromEntries(list.map((m) => [m.id, m]));
    } catch {}
  }

  // ── 상단 내비게이션 ──
  function nav(active) {
    let links;
    if (!S.loggedIn) links = [["home", "소개"], ["service", "서비스"]];
    else if (S.isAdmin) links = [["admin", "운영자"]];
    else links = [["home", "홈"], ["service", "서비스"], ["me", "내정보"]];
    const acct = S.loggedIn
      ? `<span class="avatar" data-tab="${S.isAdmin ? "admin" : "me"}">${esc(initial(S.userName))}</span>`
      : `<button class="btn line sm" data-act="login">로그인</button><button class="btn sm" data-act="signup">회원가입</button>`;
    return `<header class="nav"><div class="nav-inner">
      <span class="brand" data-tab="home">✦ 솜씨</span>
      <nav class="nav-links">${links
        .map(([k, l]) => `<button class="nav-link ${active === k ? "on" : ""}" data-tab="${k}">${l}</button>`)
        .join("")}</nav>
      <div class="nav-acct">${acct}</div>
    </div></header>`;
  }

  const backLink = (label) => `<div class="back" data-act="back">${ic("i-back")} ${esc(label)}</div>`;

  function view(active, inner, back) {
    app.innerHTML = `${nav(active)}<main class="page">${inner}</main>`;
    window.scrollTo(0, 0);
    bindCommon(back);
  }
  function viewN(active, inner, back, klass = "narrow") {
    app.innerHTML = `${nav(active)}<main class="page ${klass}">${inner}</main>`;
    window.scrollTo(0, 0);
    bindCommon(back);
  }

  function bindCommon(back) {
    app.querySelectorAll('[data-act="login"]').forEach((b) => (b.onclick = renderLogin));
    app.querySelectorAll('[data-act="signup"]').forEach((b) => (b.onclick = renderSignup));
    app.querySelectorAll("[data-tab]").forEach((t) => (t.onclick = () => goTab(t.dataset.tab)));
    const b = app.querySelector('[data-act="back"]');
    if (b && back) b.onclick = back;
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
    if (tab === "service") return S.loggedIn ? renderBranch() : openGate();
    if (tab === "me") return renderMe();
    if (tab === "admin") return renderAdmin();
  }

  function modal(html) {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `<div class="modal">${html}</div>`;
    ov.onclick = (e) => e.target === ov && ov.remove();
    document.body.appendChild(ov);
    return ov;
  }
  function openGate() {
    const ov = modal(`<div class="center">
      <div class="lock">${ic("i-lock")}</div>
      <h4>로그인하고 시작해요</h4>
      <p class="page-sub" style="margin:8px 0 18px">서비스(분기·매칭)는 로그인이 필요해요.</p>
      <div class="stack">
        <button class="btn block" data-g="login">로그인</button>
        <button class="btn line block" data-g="signup">회원가입</button>
      </div></div>`);
    ov.querySelector('[data-g="login"]').onclick = () => {
      ov.remove();
      renderLogin();
    };
    ov.querySelector('[data-g="signup"]').onclick = () => {
      ov.remove();
      renderSignup();
    };
  }

  // ════════ 0. LANDING ════════
  async function renderLanding() {
    const s = await json("/api/stats").catch(() => ({}));
    const stat = (n, l) => `<div class="stat"><div class="num">${n ?? "·"}</div><div class="lbl">${l}</div></div>`;
    const cta = !S.loggedIn
      ? `<button class="btn lg" data-act="signup">회원가입하고 시작하기</button>
         <button class="btn line lg" data-act="login">로그인</button>`
      : S.isAdmin
      ? `<button class="btn lg" data-g="admin">운영자 모드로 이동</button>`
      : `<button class="btn lg" data-g="service">서비스 시작하기</button>`;
    view(
      "home",
      `
      <section class="hero">
        <div class="hero-left">
          <span class="eyebrow">${ic("i-spark")} AI 팀 매칭 플랫폼</span>
          <h1 class="hero-title">아이디어만 있으면,<br/>팀을 솜씨가<br/>찾아드려요</h1>
          <p class="hero-sub">개발·디자인을 몰라도 괜찮아요. 한 줄만 적으면 AI가 필요한 역할을 짚고, 검증된 사람 중 딱 맞는 사람을 골라드려요.</p>
          <div class="hero-cta">${cta}</div>
        </div>
        <div class="hero-right">
          <div class="hero-panel">
            <div class="card-cap">지금 솜씨에서는</div>
            <div class="statgrid">
              ${stat(s.projectCount, "등록된 프로젝트")}${stat(s.expertCount, "등록된 전문가")}
              ${stat(s.verifiedCount, "인증된 전문가")}${stat(s.teamFormedCount, "결성된 팀")}
            </div>
          </div>
        </div>
      </section>
      <section class="features">
        <div class="feature"><div class="fi g">${ic("i-search")}</div><h3>필요한 역할을 짚어줘요</h3><p>한 줄 아이디어 → 객관식 → 브리프. 1분이면 필요한 역할 2~3개를 AI가 정리해요.</p></div>
        <div class="feature"><div class="fi p">${ic("i-shield")}</div><h3>검증된 사람만 추천</h3><p>이력서가 아니라 만든 결과물·평판으로. 운영자 ✓인증을 거친 전문가를 부합도순으로.</p></div>
        <div class="feature"><div class="fi c">${ic("i-msgs")}</div><h3>같이하기 → 바로 매칭</h3><p>마음에 드는 사람에게 같이하기를 보내면 상세 프로필이 열리고 팀이 결성돼요.</p></div>
      </section>`,
    );
    const gservice = app.querySelector('[data-g="service"]');
    if (gservice) gservice.onclick = () => goTab("service");
    const gadmin = app.querySelector('[data-g="admin"]');
    if (gadmin) gadmin.onclick = () => goTab("admin");
  }

  // ════════ 로그인 / 회원가입 ════════
  function renderLogin() {
    viewN(
      "",
      `${backLink("뒤로")}
      <h1 class="page-title">로그인</h1>
      <p class="page-sub">데모 계정으로 둘러보세요.</p>
      <div class="formcard" style="margin-top:22px">
        <div class="field"><label class="field-label">아이디</label><input type="text" id="lId" placeholder="a 또는 b" autocomplete="off" /></div>
        <div class="field"><label class="field-label">비밀번호</label><input type="text" id="lPw" placeholder="데모: 아무거나" /></div>
        <div id="lErr"></div>
        <button class="btn block lg" id="loginBtn" style="margin-top:20px">로그인</button>
        <p class="hint" style="margin-top:14px;text-align:center">계정이 없으세요? <span class="link" data-act="signup">회원가입</span></p>
      </div>
      <div class="muted" style="margin-top:16px">데모 계정 · <b>a</b> 이용자(김다솔) · <b>b</b> 운영자(운영자 모드)</div>`,
      renderLanding,
    );
    const tryLogin = () => {
      if (!doAuth(app.querySelector("#lId").value))
        app.querySelector("#lErr").innerHTML = `<div class="err">아이디는 a 또는 b 예요.</div>`;
    };
    app.querySelector("#loginBtn").onclick = tryLogin;
    app.querySelector("#lId").addEventListener("keydown", (e) => e.key === "Enter" && tryLogin());
  }

  function renderSignup() {
    viewN(
      "",
      `${backLink("뒤로")}
      <h1 class="page-title">솜씨 시작하기</h1>
      <p class="page-sub">소셜 로그인으로 30초면 끝나요.</p>
      <div class="formcard" style="margin-top:22px">
        <button class="social kakao" data-soc>${ic("i-msgs")} 카카오로 시작하기</button>
        <button class="social" data-soc>${ic("i-user")} 구글로 시작하기</button>
        <div class="divider"><span>또는 이메일로 가입</span></div>
        <div class="field"><label class="field-label">이름 / 닉네임</label><input type="text" id="suName" placeholder="예) 김다솔" /></div>
        <div class="field"><label class="field-label">이메일</label><input type="text" id="suEmail" placeholder="example@somssi.kr" /></div>
        <div class="field"><label class="field-label">비밀번호</label><input type="text" id="suPw" placeholder="비밀번호" /></div>
        <button class="btn block lg" id="suBtn" style="margin-top:20px">회원가입 완료</button>
        <p class="hint" style="margin-top:14px;text-align:center">이미 계정이 있으세요? <span class="link" data-act="login">로그인</span></p>
      </div>`,
      renderLanding,
    );
    app.querySelector("#suBtn").onclick = () => doSignup(app.querySelector("#suName").value);
    app.querySelectorAll("[data-soc]").forEach((b) => (b.onclick = () => doSignup()));
  }

  // ════════ 1. 분기 ════════
  function renderBranch() {
    view(
      "service",
      `
      <h1 class="page-title">무엇을 도와드릴까요?</h1>
      <p class="page-sub">필요한 쪽을 선택하세요.</p>
      <div class="branch">
        <div class="branch-card demand" data-g="demand"><span class="bi">🧩</span><h3>팀원 구하기 ${ic("i-arrow")}</h3><p>만들고 싶은 아이디어가 있어요. AI가 역할을 짚고 사람을 추천해요.</p></div>
        <div class="branch-card supply" data-g="supply"><span class="bi">🛠️</span><h3>팀원 되기</h3><p>실력으로 협업 기회를 받을래요. 결과물·평판으로 자신을 증명해요.</p></div>
      </div>`,
    );
    app.querySelector('[data-g="demand"]').onclick = startDemand;
    app.querySelector('[data-g="supply"]').onclick = renderSupplyRole;
  }

  // ════════ 2. 수요 ════════
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
    viewN(
      "service",
      `${backLink("팀원 구하기")}
      <span class="eyebrow">1단계 · 아이디어</span>
      <h1 class="page-title" style="margin-top:12px">어떤 걸 만들고 싶으세요?</h1>
      <div class="formcard" style="margin-top:20px">
        <textarea id="idea" rows="5" placeholder="예) 지역 돌봄 사각지대의 독거 어르신을 매일 자동으로 안부 확인하고, 이상 신호가 있으면 복지사에게 알려주고 싶어요.">${esc(S.idea)}</textarea>
        <div class="chips" style="margin-top:14px">${IDEA_CHIPS.map((c) => `<span class="chip pick" data-chip="${esc(c)}">${esc(c)}</span>`).join("")}</div>
        <p class="hint" style="margin-top:12px">전문 용어 없이 한 줄이면 충분해요.</p>
        <button class="btn block lg" id="next" style="margin-top:18px" disabled>다음</button>
      </div>`,
      renderBranch,
    );
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
    const ov = modal(`
      <div class="progress"><span>${ic("i-spark")} AI 가이드</span><span>${step + 1} / ${GUIDE.length}</span></div>
      <div class="q">${esc(g.q)}</div>
      <div class="stack" style="margin-top:8px">
        ${g.opts.map((o) => `<button class="opt" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}
        <button class="btn ghost block" data-opt="" style="margin-top:4px">잘 모르겠어요 · 건너뛰기</button>
      </div>`);
    ov.querySelectorAll("[data-opt]").forEach(
      (el) =>
        (el.onclick = () => {
          if (el.dataset.opt) S.guide[g.key] = el.dataset.opt;
          ov.remove();
          openGuide(step + 1);
        }),
    );
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
    app.innerHTML = `${nav("service")}<main class="page"><div class="loading"><div class="spinner"></div><p>브리프를 정리하고<br/>부합도 높은 사람을 고르고 있어요…</p></div></main>`;
    bindCommon();
  }
  function renderIdeaError(msg) {
    renderIdea();
    const e = document.createElement("div");
    e.className = "err";
    e.textContent = msg || "오류가 발생했어요.";
    app.querySelector(".formcard").appendChild(e);
  }

  // 브리프
  function renderBrief() {
    const roleChips = S.roles.map((r) => `<span class="chip">${esc(r.role)}</span>`).join("");
    viewN(
      "service",
      `${backLink("팀원 구하기")}
      <span class="eyebrow ai">${ic("i-file")} 매칭용 브리프 · AI 산출</span>
      <h1 class="page-title" style="margin-top:12px">이렇게 정리해봤어요</h1>
      <p class="page-sub">맞으면 그대로, 아니면 고쳐서 다시 분석하세요. 무엇을 만들지는 팀이 정해요.</p>
      <div class="formcard" style="margin-top:20px">
        <div class="field"><label class="field-label">문제</label><input type="text" id="bP" value="${esc(S.brief.problem)}" /></div>
        <div class="field"><label class="field-label">타겟</label><input type="text" id="bT" value="${esc(S.brief.target)}" /></div>
        <div class="field"><label class="field-label">핵심 방향</label><input type="text" id="bC" value="${esc(S.brief.coreFeature)}" /></div>
        <div class="field"><label class="field-label">필요한 역할</label><div class="chips">${roleChips}</div></div>
        <button class="btn line block" data-act="reanalyze" style="margin-top:18px">${ic("i-spark")} 수정한 내용으로 다시 분석</button>
        <button class="btn block lg" data-act="match" style="margin-top:10px">이 브리프로 팀 찾기</button>
      </div>`,
      renderIdea,
    );
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

  // 매칭
  function renderMatch() {
    const cols = S.roles
      .map((role) => {
        const color = roleColor(role.role);
        const cards = role.recommendations
          .map((rec) => {
            const joined = S.accepted.has(rec.maker_id);
            return `<div class="cand">
              <div class="cand-top">
                <span class="av ${color}">${esc(initial(rec.name))}</span>
                <div style="flex:1;min-width:0">
                  <div class="cand-name">${esc(rec.name)}${rec.verified ? `<span class="shield">${ic("i-shield")}</span>` : ""}</div>
                  <div class="cand-role">${esc(rec.headline || "")}</div>
                </div>
                <div class="cand-score"><b>${rec.score}</b><span>부합도</span></div>
              </div>
              <button class="btn-join ${joined ? "done" : ""}" data-join="${esc(rec.maker_id)}" data-role="${esc(role.role)}" ${joined ? "disabled" : ""}>${joined ? "✓ 합류함" : "같이하기"}</button>
            </div>`;
          })
          .join("");
        return `<section class="role-col">
          <div class="role-col-head"><h3>${esc(role.role)}</h3><span class="why">${esc(role.why || "")}</span></div>
          <div class="cand-grid">${cards}</div>
        </section>`;
      })
      .join("");
    const n = S.accepted.size;
    view(
      "service",
      `${backLink("브리프로")}
      <span class="eyebrow ai">${ic("i-spark")} AI 매칭 · 부합도순</span>
      <div style="display:flex;align-items:end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:12px">
        <div><h1 class="page-title">부합도 높은 사람이에요</h1>
        <p class="page-sub">같이하기를 보내면 바로 수락돼 상세 프로필이 열려요.</p></div>
        ${n ? `<button class="btn lg" data-act="team">팀 시작하기 (${n}명)</button>` : ""}
      </div>
      ${cols}`,
      renderBrief,
    );
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
    viewN(
      "service",
      `${backLink("매칭으로")}
      <span class="eyebrow br">같이하기 수락됨 · 상세 프로필 공개</span>
      <h1 class="page-title" style="margin-top:12px">바로 수락됐어요!</h1>
      <div class="dcard">
        <div class="dhead"><span class="av ${color}">${esc(initial(rec.name))}</span>
          <div><div class="drole">${esc(rec.name)} · ${esc(roleLabel)}${rec.verified ? `<span class="shield">${ic("i-shield")}</span>` : ""}</div><div class="dmeta">부합도 ${rec.score}%</div></div></div>
        <div class="dline">${ic("i-file")}<div><div class="dk">대표 결과물</div>${esc(works)}</div></div>
        <div class="dline">${ic("i-msgs")}<div><div class="dk">평판·인터뷰</div>${esc(rep)}</div></div>
        <div class="dline">${ic("i-users")}<div><div class="dk">원하는 협업</div>${esc(wants)}</div></div>
      </div>
      <button class="btn block lg" data-act="add" style="margin-top:18px">팀에 추가하고 계속</button>`,
      renderMatch,
      "mid",
    );
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
    viewN(
      "service",
      `<div class="center" style="padding-top:30px">
        <div class="party">${ic("i-users")}</div>
        <h1 class="page-title">팀이 만들어졌어요!</h1>
        <p class="page-sub">${S.accepted.size}명이 합류했어요. 이제 함께 첫 작동 버전을 만들어봐요.</p>
        <div class="team">${members}</div>
        <button class="btn lg" data-g="me" style="margin-top:8px">내 정보에서 확인</button>
        <p class="scope">솜씨는 여기까지 — 만들기는 팀이 직접 정해요 (협업은 플랫폼 밖)</p>
      </div>`,
      null,
      "mid",
    );
    app.querySelector('[data-g="me"]').onclick = renderMe;
  }

  // ════════ 3. 공급 ════════
  function renderSupplyRole() {
    viewN(
      "service",
      `${backLink("팀원 되기")}
      <span class="eyebrow br">${ic("i-shield")} 프로필 등록</span>
      <h1 class="page-title" style="margin-top:12px">어떤 역할로 참여하시겠어요?</h1>
      <p class="page-sub">솜씨의 역할은 3가지예요. 하나를 골라주세요.</p>
      <div class="stack" style="margin-top:20px">
        ${ROLES.map((r) => `<button class="opt" data-role="${esc(r)}" style="${S.supplyRole === r ? "border-color:var(--g500);background:var(--g50)" : ""}">${esc(r)}</button>`).join("")}
      </div>
      <button class="btn clay block lg" id="rnext" style="margin-top:22px" ${S.supplyRole ? "" : "disabled"}>다음</button>`,
      renderBranch,
      "mid",
    );
    const opts = app.querySelectorAll("[data-role]");
    const next = app.querySelector("#rnext");
    opts.forEach(
      (el) =>
        (el.onclick = () => {
          S.supplyRole = el.dataset.role;
          opts.forEach((o) => {
            const on = o === el;
            o.style.borderColor = on ? "var(--g500)" : "";
            o.style.background = on ? "var(--g50)" : "";
          });
          next.disabled = false;
        }),
    );
    next.onclick = renderSupplyForm;
  }

  function renderSupplyForm() {
    viewN(
      "service",
      `${backLink("역할 선택")}
      <span class="eyebrow br">${esc(S.supplyRole)}</span>
      <h1 class="page-title" style="margin-top:12px">실력으로 자신을 증명하세요</h1>
      <p class="page-sub">이력서 대신 결과물·인터뷰·평판으로. 운영자 검증 후 ✓인증.</p>
      <div class="formcard" style="margin-top:20px">
        <div class="lrow" style="box-shadow:none;background:var(--g50)">
          <span class="av g" style="width:40px;height:40px;font-size:15px">${esc(initial(S.userName))}</span>
          <div class="lrow-main"><div class="lrow-t">${esc(S.userName)}</div><div class="lrow-s">계정 이름으로 등록돼요</div></div>
        </div>
        <div class="field"><label class="field-label">한 줄 소개</label><input type="text" id="sHeadline" placeholder="예) 복지·공공 서비스 풀스택 개발자" /></div>
        <div class="field"><label class="field-label">대표 결과물 / 포트폴리오</label><textarea id="sWork" rows="3" placeholder="예) 독거노인 안부 확인 웹앱을 혼자 만들어 복지관 3곳에 배포, 월 220명 사용"></textarea></div>
        <div class="field"><label class="field-label">인터뷰 한마디 (선택)</label><input type="text" id="sItv" placeholder="예) 사회적 가치 있는 초기 아이디어를 빠르게 만들고 싶어요" /></div>
        <div class="field"><label class="field-label">평판 / 레퍼런스 (선택)</label><input type="text" id="sRep" placeholder="예) 함께 일한 복지사 평: 현장 언어로 빠르게 만든다" /></div>
        <div class="field"><label class="field-label">태그 (선택)</label><input type="text" id="sTags" placeholder="예) 풀스택, React, 복지도메인" /></div>
        <button class="btn clay block lg" id="reg" style="margin-top:20px" disabled>전문가로 등록하기</button>
      </div>`,
      renderSupplyRole,
      "mid",
    );
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
      e.className = "err";
      e.textContent = j.error;
      app.querySelector(".formcard").appendChild(e);
      return;
    }
    MAKERS[j.maker.id] = j.maker;
    S.myMakerId = j.maker.id;
    S.myMakerName = j.maker.name;
    S.myMakerRole = j.maker.role;
    viewN(
      "service",
      `<div class="center" style="padding-top:30px">
        <div class="circ c" style="width:72px;height:72px">${ic("i-check")}</div>
        <h1 class="page-title" style="margin-top:18px">${esc(body.name)}님, 등록됐어요</h1>
        <p class="page-sub">역할: ${esc(body.role)} · 운영자 검증을 거치면 ✓인증 마크가 붙고 추천돼요.</p>
        <button class="btn lg" data-g="me" style="margin-top:8px">내 정보에서 받은 제안 보기</button>
      </div>`,
      null,
      "mid",
    );
    app.querySelector('[data-g="me"]').onclick = renderMe;
  }

  // ════════ 내 프로젝트 ════════
  async function myProjectsHtml() {
    const projects = await json("/api/projects").catch(() => []);
    const rows = (projects || [])
      .slice(0, 6)
      .map(
        (p) => `<div class="lrow">
        <div class="lrow-main"><div class="lrow-t">${esc(p.idea)}</div><div class="lrow-s">${p.teamFormed ? "성사 완료" : "매칭 진행 중"} · 역할 ${p.roleCount || "-"}</div></div>
        <span class="badge ${p.teamFormed ? "done" : "wait"}">${p.teamFormed ? "결성" : "진행"}</span>
      </div>`,
      )
      .join("");
    return rows
      ? `<div class="list-grid">${rows}</div>`
      : `<div class="muted">아직 의뢰한 프로젝트가 없어요. 서비스 → 팀원 구하기에서 시작해보세요.</div>`;
  }

  // ════════ 5. MY INFORMATION ════════
  async function renderMe() {
    let inbox = "";
    if (S.myMakerId) {
      const proposals = await json("/api/proposals?makerId=" + S.myMakerId).catch(() => []);
      inbox =
        proposals.length === 0
          ? `<div class="muted">아직 받은 제안이 없어요.</div>`
          : `<div class="list-grid">${proposals
              .map(
                (p) => `<div class="lrow">
                <span class="av g" style="width:40px;height:40px;font-size:14px">${esc(initial(p.fromName))}</span>
                <div class="lrow-main"><div class="lrow-t">${esc(p.fromName)}님이 같이하기를 제안했어요</div><div class="lrow-s">“${esc(p.idea || "")}”</div></div>
                <span class="badge done">매칭</span></div>`,
              )
              .join("")}</div>`;
    }
    const supplierCard = S.myMakerId
      ? `<div class="dcard" style="margin-top:0">
          <div class="dhead"><span class="av c">${esc(initial(S.myMakerName))}</span>
          <div><div class="drole">${esc(S.myMakerName)} · ${esc(S.myMakerRole)}</div><div class="dmeta">내 전문가 프로필 · 검증 대기</div></div></div></div>`
      : "";
    const supply = S.myMakerId
      ? `${supplierCard}${inbox}`
      : `<div class="muted">아직 ‘팀원 되기’로 등록하지 않았어요. 등록하면 내 전문가 프로필과 받은 제안이 여기 표시돼요. (서비스 → 팀원 되기)</div>`;
    const projects = await myProjectsHtml();

    view(
      "me",
      `
      <h1 class="page-title">내 정보</h1>
      <div class="dcard" style="margin-top:18px">
        <div class="dhead"><span class="av g" style="width:50px;height:50px;font-size:18px">${esc(initial(S.userName))}</span>
          <div><div class="drole" style="font-size:18px">${esc(S.userName)}</div><div class="dmeta">비전문가(수요자) · 로그인됨</div></div>
          <button class="btn ghost sm" data-act="logout" style="margin-left:auto">로그아웃</button></div>
      </div>

      <div class="sec-head"><span class="sec-dot g"></span>🧩 팀 구하기 <span class="sec-sub">내가 의뢰한 프로젝트</span></div>
      ${projects}

      <div class="sec-head"><span class="sec-dot c"></span>🛠️ 팀원으로 하기 <span class="sec-sub">내가 참여 · 받은 제안</span></div>
      ${supply}

      <div class="sec-head"><span class="sec-dot c" style="background:var(--t3)"></span>⚙️ 계정 설정</div>
      <div class="muted">계정 설정 · 알림 설정 — 준비 중 (이번 버전 보류)</div>`,
    );
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
        <span class="av ${roleColor(m.role)}" style="width:40px;height:40px;font-size:14px">${esc(initial(m.name))}</span>
        <div class="lrow-main"><div class="lrow-t">${esc(m.name)} ${m.verified ? `<span class="shield">${ic("i-shield")}</span>` : ""}</div><div class="lrow-s">${esc(m.role || "-")} · ${esc(m.headline || "")}</div></div>
        <button class="btn-join ${m.verified ? "done" : ""}" data-verify="${esc(m.id)}" data-on="${m.verified ? "1" : "0"}" style="padding:9px 14px">${m.verified ? "인증 해제" : "인증 부여"}</button>
      </div>`,
      )
      .join("");
    view(
      "admin",
      `
      <h1 class="page-title">운영자 모드</h1>
      <p class="page-sub">${esc(S.userName)}님, 플랫폼을 관리해요.</p>

      <div class="sec-head"><span class="sec-dot g"></span>${ic("i-chart")} 측정 대시보드 · KPI</div>
      <div class="card"><div class="statgrid" style="grid-template-columns:repeat(4,1fr)">
        ${stat(s.projectCount, "프로젝트")}${stat(s.expertCount, "전문가")}${stat(s.verifiedCount, "인증 전문가")}${stat(s.teamFormedCount, "결성된 팀")}
      </div></div>
      <div class="card" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="lrow-t">매칭→결성 전환율 (NSM)</div><div class="num" style="font-size:24px;color:var(--g500);font-weight:800">${conv}%</div></div>
        <div class="stepper">${["브리프", "같이하기", "수락", "성사", "출시"].map((st, i) => `<span class="step ${i <= 3 ? "on" : ""}">${st}</span>`).join("<i></i>")}</div>
        <p class="hint" style="margin-top:8px">성공 끝점 = '첫 작동 버전 출시' (플랫폼 밖에서 측정)</p>
      </div>

      <div class="sec-head"><span class="sec-dot c"></span>${ic("i-shield")} 전문가 DB · 실력 인증</div>
      <div class="list-grid">${rows}</div>

      <div class="sec-head"><span class="sec-dot c" style="background:var(--t3)"></span>기관 제휴 관리</div>
      <div class="muted">창업지원·복지·교육 기관 제휴 — 준비 중 (Cold start 2단계 · 보류)</div>

      <div class="btn-row" style="margin-top:28px"><button class="btn ghost" data-act="logout">로그아웃</button></div>`,
    );
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

  (async () => {
    await boot();
    renderLanding();
  })();
}
