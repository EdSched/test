// ── 老师端：VIP 框架补充（阶段2）──
// admin 分享给本老师（assigned_teacher === teacherName）的框架，在此填写/补充内容并提交。
// 复用同一套 vip_frameworks / vip_framework_items 表；提交后 status → done。

let teacherVipFrameworks = [];   // 分享给本老师的框架列表
let tvItems = [];                // 当前打开框架的条目（内存工作副本）
let tvCurrentId = null;
let tvOriginalItemIds = new Set();
let tvOpenCats = {};

// teacher.js 的 init 会调用它（若存在）
async function loadTeacherVipFrameworks() {
  if (!teacherName) { teacherVipFrameworks = []; return; }
  // 数组包含查询：assigned_teachers 含本老师即可见（支持一个框架分享给多位老师）
  teacherVipFrameworks = await sb(
    `/rest/v1/vip_frameworks?assigned_teachers=cs.{"${teacherName}"}&status=in.("shared","done")&select=*&order=created_at.desc`
  ).catch(() => []);
}

const TV_STATUS_LABEL = { shared: '待补充', done: '已完成' };
const TV_STATUS_COLOR = { shared: '#8a6d3b', done: '#1a4a28' };
const TV_STATUS_BG    = { shared: '#faf0dc', done: '#ddf0e0' };

function renderTeacherVipFrameworks(mc) {
  tvCurrentId = null;
  if (!teacherVipFrameworks.length) {
    mc.innerHTML = '<div class="empty">暂无需要补充的 VIP 框架<br><span style="font-size:11px">当学科负责人分享 VIP 课程框架给您后，会在这里出现</span></div>';
    return;
  }
  const cards = teacherVipFrameworks.map(f => {
    const st = f.status || 'shared';
    return `
    <div onclick="openTvFramework('${f.id}')" style="cursor:pointer;border:1px solid var(--border);border-radius:5px;padding:12px 14px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:12px;transition:border-color .12s" onmouseover="this.style.borderColor='var(--text-2)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600">${tvEsc(f.title || 'VIP框架')}</div>
        ${f.share_note ? `<div style="font-size:11px;color:var(--text-2);margin-top:3px">📌 ${tvEsc(f.share_note)}</div>` : ''}
      </div>
      <span style="flex-shrink:0;font-size:10px;padding:2px 10px;border-radius:3px;background:${TV_STATUS_BG[st]};color:${TV_STATUS_COLOR[st]}">${TV_STATUS_LABEL[st] || st}</span>
    </div>`;
  }).join('');

  mc.innerHTML = `
  <div class="page-section" style="max-width:900px">
    <div style="margin-bottom:14px">
      <div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600">VIP 课程框架</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px">补充每节课的具体内容与作业，完成后点「提交完成」</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${cards}</div>
  </div>`;
}

async function openTvFramework(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">加载中…</div>';
  tvCurrentId = id;
  const items = await sb(`/rest/v1/vip_framework_items?framework_id=eq.${id}&select=*&order=sort_order.asc`).catch(() => []);
  tvItems = items;
  tvOriginalItemIds = new Set(items.map(i => i.id));
  tvOpenCats = {};
  renderTvEditor(mc);
}

function renderTvEditor(mc) {
  const fw = teacherVipFrameworks.find(f => f.id === tvCurrentId);
  if (!fw) { renderTeacherVipFrameworks(mc); return; }
  const st = fw.status || 'shared';

  // 按分类分组，分类顺序 = 各分类内最小 sort_order（无需依赖目录文件）
  const catMap = {};
  tvItems.forEach(it => {
    const k = it.category || 'other';
    if (!catMap[k]) catMap[k] = { key: k, label: it.category_label || k, items: [], minOrder: it.sort_order || 0 };
    catMap[k].items.push(it);
    catMap[k].minOrder = Math.min(catMap[k].minOrder, it.sort_order || 0);
  });
  const groups = Object.values(catMap).sort((a, b) => a.minOrder - b.minOrder);
  groups.forEach(g => g.items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

  const groupsHtml = groups.map(g => {
    const open = tvOpenCats[g.key] !== false;
    const rows = g.items.map(it => `
      <div style="border-top:1px solid var(--border-light);padding:8px 10px;display:grid;grid-template-columns:1.1fr 2fr 1.4fr 64px 28px;gap:8px;align-items:start">
        <input value="${tvEsc(it.name)}" placeholder="课程名" onchange="tvEditItem('${it.id}','name',this.value)" style="font-size:11px;font-weight:500">
        <textarea onchange="tvEditItem('${it.id}','content',this.value)" placeholder="内容说明（请按您实际授课补充）" style="font-size:11px;resize:vertical;min-height:34px;line-height:1.5">${tvEsc(it.content)}</textarea>
        <input value="${tvEsc(it.homework)}" placeholder="课后作业" onchange="tvEditItem('${it.id}','homework',this.value)" style="font-size:11px">
        <input type="number" step="0.5" min="0" value="${it.default_hours != null ? it.default_hours : 2}" onchange="tvEditItem('${it.id}','default_hours',this.value)" style="font-size:11px;text-align:center" title="课时">
        <button onclick="tvRemoveItem('${it.id}')" title="删除此条" style="background:none;border:1px solid var(--border);border-radius:3px;color:var(--text-3);cursor:pointer;font-size:12px;height:28px">×</button>
      </div>`).join('') || '<div style="padding:8px 10px;font-size:11px;color:var(--text-3);border-top:1px solid var(--border-light)">该分类暂无条目</div>';

    return `
    <div style="border:1px solid var(--border);border-radius:5px;overflow:hidden">
      <div onclick="tvToggleCat('${g.key}')" style="cursor:pointer;padding:9px 12px;background:var(--bg);display:flex;align-items:center;justify-content:space-between;user-select:none">
        <div style="font-size:12px;font-weight:600">${tvEsc(g.label)}<span style="font-size:10px;color:var(--text-3);font-weight:400;margin-left:8px">${g.items.length} 条</span></div>
        <span style="font-size:10px;color:var(--text-3)">${open ? '收起 ▾' : '展开 ▸'}</span>
      </div>
      <div style="display:${open ? 'block' : 'none'}">
        ${rows}
        <div style="border-top:1px solid var(--border-light);padding:6px 10px">
          <button onclick="tvAddItem('${g.key}','${tvEsc(g.label)}')" style="font-size:10px;background:none;border:1px dashed var(--border);border-radius:3px;padding:3px 10px;cursor:pointer;color:var(--text-3);font-family:inherit">＋ 添加一条</button>
        </div>
      </div>
    </div>`;
  }).join('');

  mc.innerHTML = `
  <div class="page-section" style="max-width:1000px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;flex-wrap:wrap">
      <button onclick="backToTvList()" style="font-size:11px;background:none;border:1px solid var(--border);border-radius:3px;padding:4px 12px;cursor:pointer;font-family:inherit;color:var(--text-2)">← 返回</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="saveTvFramework(false)">暂存</button>
        <button class="btn btn-primary" onclick="submitTvFramework()">提交完成</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:8px 0 6px">
      <div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600">${tvEsc(fw.title)}</div>
      <span style="font-size:10px;padding:2px 10px;border-radius:3px;background:${TV_STATUS_BG[st]};color:${TV_STATUS_COLOR[st]}">${TV_STATUS_LABEL[st] || st}</span>
      <span style="font-size:11px;color:var(--text-3)">共 ${tvItems.length} 条</span>
    </div>
    ${fw.share_note ? `<div style="font-size:11px;color:var(--text-2);background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 12px;margin-bottom:14px">📌 学科负责人提示：${tvEsc(fw.share_note)}</div>` : '<div style="margin-bottom:14px"></div>'}

    <div style="display:flex;flex-direction:column;gap:10px">${groupsHtml}</div>

    <div style="margin-top:16px;font-size:11px;color:var(--text-3)">
      「暂存」只保存内容、状态不变；「提交完成」保存并把框架标记为已完成，交回学科负责人。
    </div>
  </div>`;
}

function backToTvList() {
  renderTeacherVipFrameworks(document.getElementById('mainContent'));
}
function tvToggleCat(key) {
  tvOpenCats[key] = tvOpenCats[key] === false ? true : false;
  renderTvEditor(document.getElementById('mainContent'));
}
function tvEditItem(id, field, value) {
  const it = tvItems.find(x => x.id === id);
  if (!it) return;
  it[field] = field === 'default_hours' ? (parseFloat(value) || 0) : value;
  if (field !== 'default_hours') it.filled = true;
}
function tvAddItem(cat, label) {
  const maxOrder = tvItems.reduce((m, i) => Math.max(m, i.sort_order || 0), 0);
  tvItems.push({
    id: 'vfi-new-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
    framework_id: tvCurrentId, category: cat, category_label: label,
    name: '', content: '', homework: '', default_hours: 2,
    sort_order: maxOrder + 1, source: 'custom', filled: true, _new: true,
  });
  tvOpenCats[cat] = true;
  renderTvEditor(document.getElementById('mainContent'));
}
function tvRemoveItem(id) {
  tvItems = tvItems.filter(x => x.id !== id);
  renderTvEditor(document.getElementById('mainContent'));
}

async function saveTvFramework(silent) {
  const btn = document.querySelector('#mainContent .btn-primary');
  if (btn && !silent) { btn.textContent = '保存中…'; btn.disabled = true; }
  try {
    const newItems = tvItems.filter(i => i._new);
    const existing = tvItems.filter(i => !i._new);
    const currentIds = new Set(tvItems.map(i => i.id));
    const removedIds = [...tvOriginalItemIds].filter(id => !currentIds.has(id));

    if (newItems.length) {
      const payload = newItems.map(({ _new, ...rest }) => rest);
      for (let i = 0; i < payload.length; i += 20) {
        await sb('/rest/v1/vip_framework_items', 'POST', payload.slice(i, i + 20));
      }
    }
    for (const it of existing) {
      await sb(`/rest/v1/vip_framework_items?id=eq.${it.id}`, 'PATCH', {
        name: it.name, content: it.content, homework: it.homework,
        default_hours: it.default_hours, sort_order: it.sort_order, filled: it.filled || false,
      });
    }
    for (const id of removedIds) {
      await sb(`/rest/v1/vip_framework_items?id=eq.${id}`, 'DELETE');
    }
    tvItems.forEach(i => delete i._new);
    tvOriginalItemIds = new Set(tvItems.map(i => i.id));
    if (!silent) { alert('已暂存'); renderTvEditor(document.getElementById('mainContent')); }
  } catch (e) {
    alert('保存失败：' + e.message);
    if (btn && !silent) { btn.textContent = '提交完成'; btn.disabled = false; }
    throw e;
  }
}

async function submitTvFramework() {
  if (!confirm('确认提交完成？提交后框架标记为「已完成」交回学科负责人（之后仍可继续修改）。')) return;
  try {
    await saveTvFramework(true);
    await sb(`/rest/v1/vip_frameworks?id=eq.${tvCurrentId}`, 'PATCH', { status: 'done' });
    const fw = teacherVipFrameworks.find(f => f.id === tvCurrentId);
    if (fw) fw.status = 'done';
    alert('已提交完成');
    renderTvEditor(document.getElementById('mainContent'));
  } catch (e) {
    // saveTvFramework 已弹错
  }
}

function tvEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ════════════════════════════════════════════════════════════════
// 营业老师：VIP规划（p.vip_sales 权限开启后显示）
// 还原独立 VIP 页面的点选体验：彩色分类 + 可点选课程 + 汇总(回/课时) + 生成PDF。
// 数据来自 admin 建立、老师补充后的框架条目。转分享给上课老师亦在此。
// ════════════════════════════════════════════════════════════════
let salesVipFrameworks = [];
let svAllTeachers = [];
let svCurrentId = null;
let svItems = [];
let svShareTeachers = [];
let svSel = new Set();          // 已选条目 id
let svHrs = {};                 // 条目 id → 自定义课时（仅可调课时的分类）
let svShareOpen = false;

// 分类配色（还原 VIP.html）
const VIP_CAT_COLOR = {
  found:  { bg: '#f5f0e8', color: '#2a2820' },
  base:   { bg: '#ddeaf8', color: '#1a3a6a' },
  adv:    { bg: '#e8e4f8', color: '#3a2a7a' },
  method: { bg: '#ddf0e0', color: '#1a4a28' },
  ext:    { bg: '#f0f4e8', color: '#3a4a18' },
  past:   { bg: '#f8e4dc', color: '#6a2818' },
  eng:    { bg: '#ece8e0', color: '#3a3830' },
  plan:   { bg: '#faecd8', color: '#5a3010' },
  apply:  { bg: '#fbeaf0', color: '#6a1a3a' },
  inter:  { bg: '#e1f0ea', color: '#0a4030' },
  ta:     { bg: '#e8eaf8', color: '#1a2a6a' },
};
const VIP_SUBJECT_CATS = ['base', 'adv', 'method', 'ext']; // 按 课时/2 计回、课时固定
const VIP_HOURS_OPTIONS = [0.5, 1, 2, 3, 4];

async function loadSalesVipData() {
  const [fw, ts] = await Promise.all([
    sb('/rest/v1/vip_frameworks?select=*&order=major.asc,created_at.desc').catch(() => []),
    sb('/rest/v1/teachers?select=name&order=name.asc').catch(() => []),
  ]);
  salesVipFrameworks = fw; svAllTeachers = ts;
}

// ── 框架列表（按专业分组）──
async function renderVipSalesPlanning(mc) {
  svCurrentId = null;
  mc.innerHTML = '<div class="loading">加载中…</div>';
  await loadSalesVipData();

  const byMajor = {};
  salesVipFrameworks.forEach(f => { (byMajor[f.major] = byMajor[f.major] || []).push(f); });
  const majorKeys = Object.keys(byMajor).sort();
  const stLabel = { draft: '编辑中', shared: '待补充', done: '已完成' };
  const stColor = { draft: '#8a6d3b', shared: '#1a3a6a', done: '#1a4a28' };
  const stBg = { draft: '#faf0dc', shared: '#ddeaf8', done: '#ddf0e0' };

  const groupsHtml = majorKeys.length ? majorKeys.map(mk => {
    const cards = byMajor[mk].map(f => {
      const st = f.status || 'draft';
      return `
      <div onclick="openSvFramework('${f.id}')" style="cursor:pointer;border:1px solid var(--border);border-radius:5px;padding:11px 13px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:10px;transition:border-color .12s" onmouseover="this.style.borderColor='var(--text-2)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="min-width:0"><div style="font-size:12px;font-weight:600">${tvEsc(f.title || 'VIP框架')}</div></div>
        <span style="flex-shrink:0;font-size:10px;padding:2px 9px;border-radius:3px;background:${stBg[st]};color:${stColor[st]}">${stLabel[st] || st}</span>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:16px"><div style="font-size:11px;letter-spacing:.06em;color:var(--text-3);padding-bottom:6px;border-bottom:1px solid var(--border-light);margin-bottom:8px">${tvEsc(majorLabel(mk))}</div><div style="display:flex;flex-direction:column;gap:6px">${cards}</div></div>`;
  }).join('') : '<div class="empty">暂无 VIP 框架模板<br><span style="font-size:11px">请学科负责人先在「VIP框架」建立模板</span></div>';

  mc.innerHTML = `
  <div class="page-section" style="max-width:900px">
    <div style="margin-bottom:14px">
      <div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600">VIP 规划</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px">选择专业模板，为学生点选课程、生成方案 PDF；也可转分享给上课老师补充</div>
    </div>
    ${groupsHtml}
  </div>`;
}

async function openSvFramework(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">加载中…</div>';
  svCurrentId = id;
  svItems = await sb(`/rest/v1/vip_framework_items?framework_id=eq.${id}&select=*&order=sort_order.asc`).catch(() => []);
  const fw = salesVipFrameworks.find(f => f.id === id);
  svShareTeachers = (fw && fw.assigned_teachers && fw.assigned_teachers.length) ? [...fw.assigned_teachers] : [];
  svSel = new Set(); svHrs = {}; svShareOpen = false;
  renderSvSelect(mc);
}

function svHoursOf(it) {
  if (VIP_SUBJECT_CATS.includes(it.category) || it.category === 'ta') return it.default_hours != null ? it.default_hours : 2;
  return svHrs[it.id] != null ? svHrs[it.id] : (it.default_hours != null ? it.default_hours : 2);
}
function svCalc() {
  let sessions = 0, hours = 0;
  svItems.forEach(it => {
    if (!svSel.has(it.id)) return;
    const h = svHoursOf(it);
    hours += h;
    if (VIP_SUBJECT_CATS.includes(it.category)) sessions += h / 2;
    else if (it.category === 'ta') sessions += 0;
    else sessions += 1;
  });
  return { sessions: +sessions.toFixed(1), hours: +hours.toFixed(1) };
}

function renderSvSelect(mc) {
  const fw = salesVipFrameworks.find(f => f.id === svCurrentId);
  if (!fw) { renderVipSalesPlanning(mc); return; }

  // 分组（按最小 sort_order 排序）
  const catMap = {};
  svItems.forEach(it => {
    const k = it.category || 'other';
    if (!catMap[k]) catMap[k] = { key: k, label: it.category_label || k, items: [], minOrder: it.sort_order || 0 };
    catMap[k].items.push(it);
    catMap[k].minOrder = Math.min(catMap[k].minOrder, it.sort_order || 0);
  });
  const groups = Object.values(catMap).sort((a, b) => a.minOrder - b.minOrder);
  groups.forEach(g => g.items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

  const groupsHtml = groups.map(g => {
    const col = VIP_CAT_COLOR[g.key] || { bg: '#eee', color: '#333' };
    const rows = g.items.map(it => {
      const sel = svSel.has(it.id);
      const editable = !VIP_SUBJECT_CATS.includes(it.category) && it.category !== 'ta';
      const h = svHoursOf(it);
      let hoursCtl;
      if (editable) {
        const opts = VIP_HOURS_OPTIONS.map(o => `<option value="${o}"${o === h ? ' selected' : ''}>${o}H</option>`).join('');
        hoursCtl = `<select onclick="event.stopPropagation()" onchange="svSetHours('${it.id}',this.value)" ${sel ? '' : 'disabled'} style="font-family:'DM Mono',monospace;font-size:12px;font-weight:500;background:#f7f5f0;border:1px solid #e2ded6;border-radius:3px;padding:2px 4px;width:58px;text-align:center;cursor:pointer;${sel ? '' : 'opacity:.35;cursor:not-allowed'}">${opts}</select>`;
      } else {
        hoursCtl = `<span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:500">${h}H</span>`;
      }
      return `
      <div onclick="svToggle('${it.id}')" class="vsel-row" style="display:grid;grid-template-columns:34px 1fr auto;align-items:stretch;border-top:1px solid #ede9e2;cursor:pointer;min-height:50px;background:${sel ? '#f0ede8' : '#fff'}">
        <div style="display:flex;align-items:center;justify-content:center;border-right:1px solid #ede9e2">
          <div style="width:14px;height:14px;border:1px solid ${sel ? '#1a1814' : '#e2ded6'};border-radius:2px;background:${sel ? '#1a1814' : 'transparent'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px">${sel ? '✓' : ''}</div>
        </div>
        <div style="padding:7px 12px;display:flex;flex-direction:column;gap:2px;min-width:0">
          <div style="font-size:12px;font-weight:500;color:#1a1814">${tvEsc(it.name)}</div>
          <div style="font-size:11px;color:#5a5650;line-height:1.5">${tvEsc(it.content) || '<span style="color:#9a9590">（待补充）</span>'}</div>
          ${it.homework ? `<div style="font-size:10px;color:#9a9590;margin-top:1px"><span style="background:#f7f5f0;border:1px solid #ede9e2;border-radius:2px;padding:0 4px;font-size:9px;margin-right:4px">作业</span>${tvEsc(it.homework)}</div>` : ''}
        </div>
        <div style="padding:7px 12px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:3px;min-width:74px">
          ${hoursCtl}<span style="font-size:9px;color:#9a9590">${editable ? '课时/回' : '课时'}</span>
        </div>
      </div>`;
    }).join('');
    return `
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #ede9e2">
        <span style="border-radius:3px;padding:2px 10px;font-size:11px;font-weight:500;background:${col.bg};color:${col.color}">${tvEsc(g.label)}</span>
        <span style="font-size:10px;color:#9a9590">${g.items.length} 门</span>
      </div>
      <div style="background:#fff;border:1px solid #e2ded6;border-radius:4px;overflow:hidden">${rows}</div>
    </div>`;
  }).join('');

  // 转分享面板
  const addOpts = svAllTeachers.filter(t => !svShareTeachers.includes(t.name)).map(t => `<option value="${tvEsc(t.name)}">${tvEsc(t.name)}</option>`).join('');
  const tagsHtml = svShareTeachers.length
    ? svShareTeachers.map(n => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;background:#fff;border:1px solid #e2ded6;border-radius:3px;padding:2px 6px 2px 9px">${tvEsc(n)}<button onclick="svRemoveShareTeacher('${tvEsc(n)}')" style="background:none;border:none;color:#9a9590;cursor:pointer;font-size:13px;line-height:1;padding:0">×</button></span>`).join('')
    : '<span style="font-size:11px;color:#9a9590">尚未选择老师</span>';
  const sharePanel = svShareOpen ? `
    <div style="margin-bottom:14px;padding:12px 14px;border:1px solid #e2ded6;border-radius:4px;background:#f7f5f0">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:#1a1814">转分享给上课老师补充（可多位）</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">${tagsHtml}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="sv_share_add" onchange="svAddShareTeacher(this.value);this.value=''" style="font-size:12px;min-width:150px"><option value="">＋ 添加老师…</option>${addOpts}</select>
        <input id="sv_share_note" value="${tvEsc(fw.share_note || '')}" placeholder="给老师的提示（可选）" style="flex:1;min-width:200px;font-size:11px">
        <button onclick="svShareToTeacher()" style="font-size:11px;background:#1a1814;color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:inherit;white-space:nowrap">分享给老师</button>
      </div>
    </div>` : '';

  const c = svCalc();
  mc.innerHTML = `
  <div style="max-width:1040px;margin:0 auto;background:#f7f5f0;border:1px solid #e2ded6;border-radius:6px;padding:0 0 20px;font-family:'DM Mono','Noto Serif SC',monospace">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 20px;border-bottom:1px solid #e2ded6;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:12px">
        <button onclick="backToSvList()" style="font-size:11px;background:#fff;border:1px solid #e2ded6;border-radius:3px;padding:4px 12px;cursor:pointer;font-family:inherit;color:#5a5650">← 返回</button>
        <div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600;color:#1a1814">${tvEsc(fw.title)}</div>
      </div>
      <button onclick="svToggleShare()" style="font-size:11px;background:#fff;border:1px solid #e2ded6;border-radius:3px;padding:4px 12px;cursor:pointer;font-family:inherit;color:#5a5650">转分享给老师 ${svShareOpen ? '▾' : '▸'}</button>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;border-bottom:1px solid #e2ded6;background:#fff;flex-wrap:wrap;position:sticky;top:0;z-index:10">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="display:flex;align-items:baseline;gap:5px"><span id="sv_sessions" style="font-size:18px;font-weight:500;font-family:'DM Mono',monospace;color:#1a1814">${c.sessions}</span><span style="font-size:12px;color:#5a5650">回</span></div>
        <div style="width:1px;height:18px;background:#e2ded6"></div>
        <div style="display:flex;align-items:baseline;gap:5px"><span id="sv_hours" style="font-size:18px;font-weight:500;font-family:'DM Mono',monospace;color:#1a1814">${c.hours}</span><span style="font-size:12px;color:#5a5650">课时</span></div>
        <div style="width:1px;height:18px;background:#e2ded6"></div>
        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:#9a9590">学生姓名</span><input id="sv_student" placeholder="请输入姓名" style="font-family:'DM Mono',monospace;font-size:12px;border:1px solid #e2ded6;border-radius:3px;padding:2px 8px;background:#f7f5f0;color:#1a1814;outline:none;width:120px"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="svClearSel()" style="font-size:11px;background:transparent;border:1px solid #e2ded6;border-radius:3px;padding:5px 14px;cursor:pointer;font-family:inherit;color:#9a9590">清空</button>
        <button onclick="svGenerateReport()" style="font-size:11px;background:#1a1814;color:#f7f5f0;border:1px solid #1a1814;border-radius:3px;padding:5px 16px;cursor:pointer;font-family:inherit;font-weight:500">生成 PDF →</button>
      </div>
    </div>

    <div style="padding:16px 20px">
      ${sharePanel}
      ${groupsHtml}
    </div>
  </div>`;
}

function svToggle(id) {
  if (svSel.has(id)) svSel.delete(id); else svSel.add(id);
  renderSvSelect(document.getElementById('mainContent'));
}
function svSetHours(id, v) { svHrs[id] = parseFloat(v); const c = svCalc(); document.getElementById('sv_sessions').textContent = c.sessions; document.getElementById('sv_hours').textContent = c.hours; }
function svClearSel() { svSel = new Set(); svHrs = {}; renderSvSelect(document.getElementById('mainContent')); }
function svToggleShare() { svShareOpen = !svShareOpen; renderSvSelect(document.getElementById('mainContent')); }
function backToSvList() { renderVipSalesPlanning(document.getElementById('mainContent')); }
function svAddShareTeacher(name) { if (!name || svShareTeachers.includes(name)) return; svShareTeachers.push(name); renderSvSelect(document.getElementById('mainContent')); }
function svRemoveShareTeacher(name) { svShareTeachers = svShareTeachers.filter(n => n !== name); renderSvSelect(document.getElementById('mainContent')); }

async function svShareToTeacher() {
  const note = document.getElementById('sv_share_note').value.trim();
  if (!svShareTeachers.length) { alert('请至少添加一位老师'); return; }
  if (!confirm(`确认分享给：${svShareTeachers.join('、')}？`)) return;
  try {
    await sb(`/rest/v1/vip_frameworks?id=eq.${svCurrentId}`, 'PATCH', {
      assigned_teachers: svShareTeachers, assigned_teacher: svShareTeachers[0] || '', share_note: note, status: 'shared',
    });
    const fw = salesVipFrameworks.find(f => f.id === svCurrentId);
    if (fw) { fw.assigned_teachers = [...svShareTeachers]; fw.share_note = note; fw.status = 'shared'; }
    alert(`已分享给：${svShareTeachers.join('、')}`);
    renderSvSelect(document.getElementById('mainContent'));
  } catch (e) { alert('分享失败：' + e.message); }
}

// ── 生成 PDF 报告（打印窗口，还原 VIP.html 报告样式）──
function svGenerateReport() {
  if (!svSel.size) { alert('请先点选课程再生成 PDF'); return; }
  const fw = salesVipFrameworks.find(f => f.id === svCurrentId);
  const student = (document.getElementById('sv_student').value || '').trim() || '—';

  // 按分类顺序整理选中项
  const catMap = {};
  svItems.forEach(it => {
    if (!svSel.has(it.id)) return;
    const k = it.category || 'other';
    if (!catMap[k]) catMap[k] = { key: k, label: it.category_label || k, items: [], minOrder: it.sort_order || 0 };
    catMap[k].items.push(it);
    catMap[k].minOrder = Math.min(catMap[k].minOrder, it.sort_order || 0);
  });
  const groups = Object.values(catMap).sort((a, b) => a.minOrder - b.minOrder);
  groups.forEach(g => g.items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

  const c = svCalc();
  const now = new Date();
  const dateStr = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
  const esc = svGenEsc;

  let rows = '', num = 1;
  groups.forEach(g => {
    const col = VIP_CAT_COLOR[g.key] || { bg: '#f0f0f0', color: '#333' };
    g.items.forEach((it, i) => {
      const h = svHoursOf(it);
      rows += '<tr>';
      if (i === 0) rows += '<td rowspan="' + g.items.length + '" class="group-cell" style="background:' + col.bg + ';color:' + col.color + '">' + esc(g.label) + '</td>';
      rows += '<td class="num-cell">' + (num++) + '</td>'
        + '<td class="name-cell">' + esc(it.name) + '</td>'
        + '<td class="desc-cell">' + esc(it.content) + '</td>'
        + '<td class="hw-cell">' + esc(it.homework) + '</td>'
        + '<td class="hours-cell">' + (h > 0 ? h + 'H' : '—') + '</td></tr>';
    });
  });

  const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>VIP课程方案 · ' + esc(student) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">'
    + '<style>*{box-sizing:border-box;margin:0;padding:0}'
    + "body{font-family:'DM Mono','Noto Serif SC',serif;font-size:11px;color:#1a1814;background:#fff;padding:2.5cm 2cm}"
    + '.report-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1.5px solid #1a1814}'
    + ".report-title{font-family:'Noto Serif SC',serif;font-size:20px;font-weight:600}"
    + '.report-sub{font-size:10px;color:#9a9590;margin-top:3px;letter-spacing:.05em}'
    + '.report-meta{text-align:right;font-size:10px;color:#5a5650;line-height:1.9}'
    + '.report-meta .student{font-size:13px;font-weight:500;color:#1a1814;margin-bottom:2px}'
    + '.summary-row{display:flex;gap:2rem;margin-bottom:1.5rem;padding:10px 16px;background:#f7f5f0;border-radius:3px;border:1px solid #e2ded6;align-items:center}'
    + ".stat-num{font-size:22px;font-weight:500;font-family:'DM Mono',monospace;margin-right:4px}"
    + '.stat-label{font-size:11px;color:#5a5650}.stat-note{font-size:9px;color:#9a9590;margin-left:2px}'
    + 'table{width:100%;border-collapse:collapse;font-size:10px}thead tr{background:#1a1814;color:#f7f5f0}'
    + 'thead th{padding:7px 8px;text-align:left;font-weight:500;letter-spacing:.04em;font-size:9px}'
    + 'tbody tr{border-bottom:1px solid #ede9e2}td{padding:6px 8px;vertical-align:top;line-height:1.5}'
    + '.group-cell{font-weight:500;font-size:9px;text-align:center;border-right:1px solid #e2ded6;vertical-align:middle;writing-mode:vertical-rl;padding:8px 5px;width:28px}'
    + ".num-cell{width:24px;color:#9a9590;text-align:center;font-family:'DM Mono',monospace}"
    + '.name-cell{width:22%;font-weight:500}.desc-cell{color:#5a5650}'
    + '.hw-cell{width:22%;color:#5a5650;border-left:1px solid #ede9e2}'
    + ".hours-cell{width:48px;text-align:center;font-family:'DM Mono',monospace;border-left:1px solid #ede9e2;font-weight:500}"
    + '.footer{margin-top:1.5rem;padding-top:.8rem;border-top:1px solid #e2ded6;font-size:9px;color:#9a9590;display:flex;justify-content:space-between}'
    + ".print-btn{display:inline-block;margin-bottom:1.5rem;padding:8px 20px;background:#1a1814;color:#f7f5f0;border:none;border-radius:3px;font-family:inherit;font-size:12px;cursor:pointer}"
    + '@media print{body{padding:0}@page{margin:1.8cm 1.5cm;size:A4}.no-print{display:none}}</style></head><body>'
    + '<button class="print-btn no-print" onclick="window.print()">打印 / 另存为 PDF</button>'
    + '<div class="report-header"><div><div class="report-title">VIP课程方案</div><div class="report-sub">唯新教育 · TRANSFORM EDUCATION</div></div>'
    + '<div class="report-meta"><div class="student">' + esc(student) + '</div><div>生成日期：' + dateStr + '</div><div>' + c.sessions + ' 回 · ' + c.hours + ' 课时</div></div></div>'
    + '<div class="summary-row"><span class="stat-num">' + c.sessions + '</span><span class="stat-label">回</span><span class="stat-note">（不含TA指导）</span>'
    + '<span style="margin:0 8px;color:#e2ded6">|</span><span class="stat-num">' + c.hours + '</span><span class="stat-label">课时</span>'
    + '<span style="margin-left:auto;font-size:10px;color:#9a9590">已选课程合计</span></div>'
    + '<table><thead><tr><th style="width:28px"></th><th style="width:24px">#</th><th>课程名称</th><th>内容说明</th><th>课后作业</th><th style="width:48px;text-align:center">课时</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="footer"><span>唯新教育 TRANSFORM EDUCATION · VIP课程方案 · ' + esc(student) + '</span><span>本文件由 VIP 规划系统生成 · ' + dateStr + '</span></div>'
    + '</body></html>';

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}
function svGenEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
