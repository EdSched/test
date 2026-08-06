// ══════════════════════════════════
// 学科负责人端口 lead.js
// 复用 admin/courses.js 的课程安排，数据与专业筛选锁定为该负责人绑定的专业
// ══════════════════════════════════

let LEAD = null;                 // 当前登录的学科负责人记录
let LEAD_MAJORS = [];            // 其负责的专业 key 列表
const LEAD_STORAGE_KEY = 'txe_lead_login';

// ── 登录 ──
async function leadLoginSubmit() {
  const name = (document.getElementById('ll_name').value || '').trim();
  const code = (document.getElementById('ll_code').value || '').trim();
  const err = document.getElementById('ll_err');
  err.textContent = '';
  if (!name || !code) { err.textContent = '请填写姓名和授权码'; return; }
  const ok = await leadLogin(name, code, false);
  if (!ok) err.textContent = '姓名或授权码不正确，或你不是学科负责人';
}

async function leadLogin(name, code, silent) {
  try {
    const rows = await sb(`/rest/v1/teachers?name=eq.${encodeURIComponent(name)}&subject_lead=eq.true&lead_code=eq.${encodeURIComponent(code)}&select=*`);
    if (!rows || !rows.length) return false;
    LEAD = rows[0];
    LEAD_MAJORS = Array.isArray(LEAD.lead_majors) ? LEAD.lead_majors.filter(Boolean) : [];
    localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({ name, code, ts: Date.now() }));
    await enterLead();
    return true;
  } catch (e) { if (!silent) console.error(e); return false; }
}

function leadLogout() {
  localStorage.removeItem(LEAD_STORAGE_KEY);
  location.reload();
}

// ── 进入：锁定专业范围，加载课程，渲染课程安排 ──
async function enterLead() {
  document.getElementById('leadLogin').style.display = 'none';
  document.getElementById('leadTopbar').style.display = 'flex';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('mainContent').innerHTML = '<div class="loading" style="padding:40px;text-align:center;color:var(--text-3)">加载中…</div>';

  // 加载专业字典
  if (typeof loadMajorsFromDB === 'function') { try { await loadMajorsFromDB(); } catch (e) {} }

  // 顶栏信息
  document.getElementById('lead_hello').textContent = (LEAD.display_name || LEAD.name) + ' · 学科负责人';
  document.getElementById('lead_majors_label').textContent =
    '负责专业：' + (LEAD_MAJORS.length ? LEAD_MAJORS.map(m => (typeof majorLabel === 'function' ? majorLabel(m) : m)).join('・') : '（未绑定，请联系管理员）');

  // 把专业筛选锁定为该负责人的专业（覆盖 constants.js 的通用实现）
  window.majorFilterKeys = function (opts = {}) {
    const ks = [...LEAD_MAJORS];
    return (opts && opts.includeAll) ? ['all', ...ks] : ks;
  };
  const _origExpand = window.expandMajorFilter;
  window.expandMajorFilter = function (f) {
    if (!f || f === 'all') return [...LEAD_MAJORS];
    // 仍走原逻辑，但结果与负责专业取交集，杜绝越权
    let base;
    try { base = _origExpand ? _origExpand(f) : [f]; } catch (e) { base = [f]; }
    return base.filter(k => LEAD_MAJORS.includes(k));
  };

  // 只加载该负责人专业范围内的课程
  try {
    if (LEAD_MAJORS.length) {
      const ov = '{' + LEAD_MAJORS.map(m => `"${String(m).replace(/"/g, '')}"`).join(',') + '}';
      window.cachedCourses = await sb(`/rest/v1/courses?major=ov.${ov}&select=*&order=created_at.desc`).catch(() => []);
    } else {
      window.cachedCourses = [];
    }
  } catch (e) { window.cachedCourses = []; }

  // 默认筛选：显示全部（已锁定为其专业）
  if (typeof coursesMajorFilter !== 'undefined') { try { coursesMajorFilter = 'all'; } catch (e) {} }
  window.coursesMajorFilter = 'all';

  renderLeadCourses();
}

function renderLeadCourses() {
  const mc = document.getElementById('mainContent');
  if (!LEAD_MAJORS.length) {
    mc.innerHTML = '<div style="padding:50px 20px;text-align:center;color:var(--text-2,#5a5650)"><div style="font-size:15px;font-weight:600;margin-bottom:8px">尚未绑定负责专业</div><div style="font-size:12px;color:var(--text-3,#9a9590)">请让管理员在「管理老师」里，为你勾选「负责专业」并保存后再登录。</div></div>';
    return;
  }
  if (typeof renderCoursesPage !== 'function') {
    mc.innerHTML = '<div style="padding:50px;text-align:center;color:#c0392b">课程安排模块未加载（courses.js 未正确引入）</div>';
    return;
  }
  try {
    renderCoursesPage(mc);
    // 空课程友好提示
    if (!Array.isArray(window.cachedCourses) || !window.cachedCourses.length) {
      const tip = document.createElement('div');
      tip.style.cssText = 'padding:14px;margin-top:10px;font-size:12px;color:var(--text-3,#9a9590);text-align:center;border:1px dashed var(--border,#e2ded6);border-radius:6px';
      tip.textContent = '你负责的专业（' + LEAD_MAJORS.map(m => (typeof majorLabel === 'function' ? majorLabel(m) : m)).join('・') + '）暂无课程。可用上方「＋ 手动添加」新建，或先在 Excel 导入。';
      mc.appendChild(tip);
    }
  } catch (e) {
    mc.innerHTML = '<div style="padding:40px;text-align:center;color:#c0392b">课程安排加载出错：' + (e && e.message ? e.message : e) + '</div>';
    console.error(e);
  }
}

// ── 自动登录（有本地记录时）──
(async function () {
  const raw = localStorage.getItem(LEAD_STORAGE_KEY);
  if (raw) {
    try {
      const info = JSON.parse(raw);
      if (info && info.name && info.code) { await leadLogin(info.name, info.code, true); }
    } catch (e) {}
  }
})();
