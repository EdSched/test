// ── VIP 课程框架管理（阶段1）──
// admin 按专业新建框架（默认内容由 VIP 目录预填）→ 编辑完善 → 分享给对应老师补充。
// 数据：vip_frameworks（框架头）+ vip_framework_items（每节课条目）。

let vfFrameworks = [];        // 所有框架（列表用）
let vfItems = [];             // 当前打开框架的条目（内存工作副本）
let vfCurrentId = null;       // 当前打开的框架 id
let vfOriginalItemIds = new Set();  // 打开时的原始条目 id（用于保存时算删除）
let vfOpenCats = {};          // 分类折叠状态
let vfShareTeachers = [];     // 当前框架已选的分享老师（多选，内存副本）
let vfView = 'templates';     // 框架内视图：templates(课程套餐) / content(框架内容)
let vfTemplates = [];         // 当前框架下的命名套餐

const VIP_STATUS_LABEL = { draft: '编辑中', shared: '待老师补充', done: '已完成' };
const VIP_STATUS_COLOR = { draft: '#8a6d3b', shared: '#1a3a6a', done: '#1a4a28' };
const VIP_STATUS_BG    = { draft: '#faf0dc', shared: '#ddeaf8', done: '#ddf0e0' };

// 分类配色（还原独立 VIP 页面）
const VF_CAT_COLOR = {
  found:  { bg: '#f5f0e8', color: '#2a2820' }, base:   { bg: '#ddeaf8', color: '#1a3a6a' },
  adv:    { bg: '#e8e4f8', color: '#3a2a7a' }, method: { bg: '#ddf0e0', color: '#1a4a28' },
  ext:    { bg: '#f0f4e8', color: '#3a4a18' }, past:   { bg: '#f8e4dc', color: '#6a2818' },
  eng:    { bg: '#ece8e0', color: '#3a3830' }, plan:   { bg: '#faecd8', color: '#5a3010' },
  apply:  { bg: '#fbeaf0', color: '#6a1a3a' }, inter:  { bg: '#e1f0ea', color: '#0a4030' },
  ta:     { bg: '#e8eaf8', color: '#1a2a6a' },
};

async function loadVipFrameworks() {
  vfFrameworks = await sb('/rest/v1/vip_frameworks?select=*&order=created_at.desc').catch(() => []);
}

// ── 主页面：框架列表 + 新建 ──
function renderVipFrameworkPage(mc) {
  vfCurrentId = null;
  const majorOpts = majorOptionsHtml('', { placeholder: '选择专业…' });

  const cards = vfFrameworks.length ? vfFrameworks.map(f => {
    const st = f.status || 'draft';
    return `
    <div onclick="openVipFramework('${f.id}')" style="cursor:pointer;border:1px solid var(--border);border-radius:5px;padding:12px 14px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:12px;transition:border-color .12s" onmouseover="this.style.borderColor='var(--text-2)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600">${f.title || (majorLabel(f.major) + ' VIP框架')}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px">专业：${majorLabel(f.major)}${(f.assigned_teachers && f.assigned_teachers.length) ? '　·　分享给：' + f.assigned_teachers.join('、') : (f.assigned_teacher ? '　·　分享给：' + f.assigned_teacher : '')}</div>
      </div>
      <span style="flex-shrink:0;font-size:10px;padding:2px 10px;border-radius:3px;background:${VIP_STATUS_BG[st]};color:${VIP_STATUS_COLOR[st]}">${VIP_STATUS_LABEL[st]}</span>
    </div>`;
  }).join('') : '<div style="font-size:12px;color:var(--text-3);padding:20px 0;text-align:center">暂无框架，选择专业后点「新建框架」</div>';

  mc.innerHTML = `
  <div class="page-section" style="max-width:820px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600">VIP 课程框架</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px">按专业建立 VIP 课程模板，可自行完善或分享给老师补充内容</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <select id="vf_new_major" style="font-size:12px">${majorOpts}</select>
        <button class="btn btn-outline" onclick="vfAddMajor()" style="white-space:nowrap">＋新增专业</button>
        <button class="btn btn-primary" onclick="createVipFramework()" style="white-space:nowrap">＋新建框架</button>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${cards}</div>
  </div>`;
}

// 在 VIP 框架页直接新增专业（复用 constants 的 createMajor + 自动生成代号）
async function vfAddMajor() {
  const label = prompt('请输入新专业名称（中文），例如：観光学');
  if (!label || !label.trim()) return;
  const suggested = (typeof generateMajorKey === 'function') ? generateMajorKey(label.trim()) : '';
  const keyInput = prompt('英文代号（系统内部使用）已自动生成，可直接确认或修改：\n\n规则：只能小写字母/数字/下划线，以字母开头。', suggested);
  if (keyInput === null) return;
  const key = await createMajor(label.trim(), keyInput.trim());
  if (key) {
    alert(`已新增专业「${label.trim()}」，代号：${key}\n现在可在下拉里选它建框架，全站也已可用。`);
    renderVipFrameworkPage(document.getElementById('mainContent'));
  }
}

async function createVipFramework() {
  const major = document.getElementById('vf_new_major').value;
  if (!major) { alert('请先选择专业'); return; }
  const btn = document.querySelector('#mainContent .btn-primary');
  if (btn) { btn.textContent = '生成中…'; btn.disabled = true; }
  try {
    const id = 'vf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
    const fw = { id, major, title: majorLabel(major) + ' VIP课程框架', status: 'draft', assigned_teacher: '', share_note: '' };
    await sb('/rest/v1/vip_frameworks', 'POST', [fw]);
    const defaults = vipBuildDefaultItems(major);
    const items = defaults.map((it, i) => ({
      id: 'vfi-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 4),
      framework_id: id, filled: false, ...it,
    }));
    for (let i = 0; i < items.length; i += 20) {
      await sb('/rest/v1/vip_framework_items', 'POST', items.slice(i, i + 20));
    }
    await loadVipFrameworks();
    openVipFramework(id);
  } catch (e) {
    alert('新建失败：' + e.message);
    if (btn) { btn.textContent = '＋新建框架'; btn.disabled = false; }
  }
}

// ── 打开某框架进入编辑 ──
async function openVipFramework(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">加载中…</div>';
  vfCurrentId = id;
  const items = await sb(`/rest/v1/vip_framework_items?framework_id=eq.${id}&select=*&order=sort_order.asc`).catch(() => []);
  vfItems = items;
  vfOriginalItemIds = new Set(items.map(i => i.id));
  vfOpenCats = {};
  const fw = vfFrameworks.find(f => f.id === id);
  vfShareTeachers = (fw && fw.assigned_teachers && fw.assigned_teachers.length)
    ? [...fw.assigned_teachers]
    : (fw && fw.assigned_teacher ? [fw.assigned_teacher] : []);
  vfView = 'templates';
  vfTemplates = await sb(`/rest/v1/vip_plan_templates?framework_id=eq.${id}&select=*&order=created_at.desc`).catch(() => []);
  renderVipFrameworkEditor(mc);
}

function renderVipFrameworkEditor(mc) {
  const fw = vfFrameworks.find(f => f.id === vfCurrentId);
  if (!fw) { renderVipFrameworkPage(mc); return; }
  const st = fw.status || 'draft';

  // 按 VIP_CATEGORIES 顺序分组
  const groups = VIP_CATEGORIES.map(c => {
    const its = vfItems.filter(i => i.category === c.key).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return { ...c, items: its };
  });

  const groupsHtml = groups.map(g => {
    const open = vfOpenCats[g.key] !== false; // 默认展开
    const rows = g.items.map(it => `
      <div style="border-top:1px solid var(--border-light);padding:8px 10px;display:grid;grid-template-columns:1.1fr 2fr 1.4fr 64px 28px;gap:8px;align-items:start">
        <input value="${vfEsc(it.name)}" placeholder="课程名" onchange="vfEditItem('${it.id}','name',this.value)" style="font-size:11px;font-weight:500">
        <textarea onchange="vfEditItem('${it.id}','content',this.value)" placeholder="内容说明" style="font-size:11px;resize:vertical;min-height:34px;line-height:1.5">${vfEsc(it.content)}</textarea>
        <input value="${vfEsc(it.homework)}" placeholder="课后作业" onchange="vfEditItem('${it.id}','homework',this.value)" style="font-size:11px">
        <input type="number" step="0.5" min="0" value="${it.default_hours != null ? it.default_hours : 2}" onchange="vfEditItem('${it.id}','default_hours',this.value)" style="font-size:11px;text-align:center" title="课时">
        <button onclick="vfRemoveItem('${it.id}')" title="删除此条" style="background:none;border:1px solid var(--border);border-radius:3px;color:var(--text-3);cursor:pointer;font-size:12px;height:28px">×</button>
      </div>`).join('') || '<div style="padding:8px 10px;font-size:11px;color:var(--text-3);border-top:1px solid var(--border-light)">该分类暂无条目</div>';

    return `
    <div style="border:1px solid var(--border);border-radius:5px;overflow:hidden">
      <div onclick="vfToggleCat('${g.key}')" style="cursor:pointer;padding:9px 12px;background:var(--bg);display:flex;align-items:center;justify-content:space-between;user-select:none">
        <div style="display:flex;align-items:center;gap:8px"><span style="border-radius:3px;padding:2px 10px;font-size:11px;font-weight:500;background:${(VF_CAT_COLOR[g.key]||{}).bg||'#eee'};color:${(VF_CAT_COLOR[g.key]||{}).color||'#333'}">${g.label}</span><span style="font-size:10px;color:var(--text-3)">${g.items.length} 条</span></div>
        <span style="font-size:10px;color:var(--text-3)">${open ? '收起 ▾' : '展开 ▸'}</span>
      </div>
      <div style="display:${open ? 'block' : 'none'}">
        ${rows}
        <div style="border-top:1px solid var(--border-light);padding:6px 10px">
          <button onclick="vfAddItem('${g.key}','${g.label}')" style="font-size:10px;background:none;border:1px dashed var(--border);border-radius:3px;padding:3px 10px;cursor:pointer;color:var(--text-3);font-family:inherit">＋ 添加一条</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // 分享给老师：多选（标签 + 下拉添加）
  const teachers = (typeof cachedTeachers !== 'undefined' ? cachedTeachers : []) || [];
  const addOpts = teachers
    .filter(t => !vfShareTeachers.includes(t.name))
    .map(t => `<option value="${vfEsc(t.name)}">${vfEsc(t.name)}</option>`).join('');
  const tagsHtml = vfShareTeachers.length
    ? vfShareTeachers.map(n => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:2px 6px 2px 9px">${vfEsc(n)}<button onclick="vfRemoveShareTeacher('${vfEsc(n)}')" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:13px;line-height:1;padding:0">×</button></span>`).join('')
    : '<span style="font-size:11px;color:var(--text-3)">尚未选择老师</span>';

  const contentBody = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn btn-primary" onclick="saveVipFramework()">保存框架</button>
      <button class="btn btn-outline" onclick="deleteVipFramework()" style="color:#a33">删除框架</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">${groupsHtml}</div>
    <div style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:5px;background:var(--bg)">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px">分享给老师补充（可多位）</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px" id="vf_share_tags">${tagsHtml}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="vf_share_add" onchange="vfAddShareTeacher(this.value);this.value=''" style="font-size:12px;min-width:150px"><option value="">＋ 添加老师…</option>${addOpts}</select>
        <input id="vf_share_note" value="${vfEsc(fw.share_note || '')}" placeholder="给老师的提示（可选）" style="flex:1;min-width:200px;font-size:11px">
        <button class="btn btn-primary" onclick="shareVipToTeacher()" style="white-space:nowrap">保存并分享</button>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:6px">分享后状态变为「待老师补充」，所选老师在各自页面都能看到并填写；任一老师提交后变「已完成」。</div>
    </div>`;

  const tabBtn = (id, label) => `<button onclick="vfSetView('${id}')" style="font-size:12px;padding:5px 14px;border:none;background:${vfView === id ? 'var(--text-1,#1a1814)' : 'transparent'};color:${vfView === id ? '#fff' : 'var(--text-2)'};cursor:pointer;font-family:inherit">${label}</button>`;

  mc.innerHTML = `
  <div class="page-section" style="max-width:1000px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap">
      <button onclick="backToVipFrameworkList()" style="font-size:11px;background:none;border:1px solid var(--border);border-radius:3px;padding:4px 12px;cursor:pointer;font-family:inherit;color:var(--text-2)">← 返回列表</button>
      <div style="display:flex;border:1px solid var(--border);border-radius:4px;overflow:hidden">
        ${tabBtn('templates', '课程套餐')}${tabBtn('content', '框架内容')}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:8px 0 16px">
      <div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600">${fw.title}</div>
      <span style="font-size:10px;padding:2px 10px;border-radius:3px;background:${VIP_STATUS_BG[st]};color:${VIP_STATUS_COLOR[st]}">${VIP_STATUS_LABEL[st]}</span>
      <span style="font-size:11px;color:var(--text-3)">共 ${vfItems.length} 条</span>
    </div>
    ${vfView === 'content' ? contentBody : renderVfTemplatesBody(fw)}
  </div>`;
}

function vfSetView(v) { vfView = v; renderVipFrameworkEditor(document.getElementById('mainContent')); }

// 课程套餐视图：新建套餐 + 已保存套餐列表
function renderVfTemplatesBody(fw) {
  const cards = vfTemplates.length ? vfTemplates.map(t => {
    const items = Array.isArray(t.items) ? t.items : [];
    return `
    <div onclick="openVfTemplate('${t.id}')" style="cursor:pointer;border:1px solid var(--border);border-radius:5px;padding:12px 14px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:10px" onmouseover="this.style.borderColor='var(--text-2)'" onmouseout="this.style.borderColor='var(--border)'">
      <div><div style="font-size:14px;font-weight:600">${vfEsc(t.name || '未命名套餐')}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">${t.total_sessions || 0} 回 · ${t.total_hours || 0} 课时${(t.subject_hours && t.subject_hours > 0) ? '（含专业知识' + t.subject_hours + '）' : ''} · ${items.length} 门课</div></div>
      <span style="font-size:16px;color:var(--text-3)">›</span>
    </div>`;
  }).join('') : '<div style="font-size:12px;color:var(--text-3);padding:16px 0;text-align:center">暂无套餐，点「＋新建套餐」从本框架点选课程创建</div>';

  return `
    <div style="margin-bottom:12px"><button class="btn btn-primary" onclick="openTemplateBuilder()">＋ 新建套餐</button>
      <span style="font-size:11px;color:var(--text-3);margin-left:10px">从本框架点选课程、自定义命名（如 20H / 30小时），保存后可反复套用到学生</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">${cards}</div>`;
}

// 套餐详情：课程 + 应用到学生 + 用了此套餐的学生名单
async function openVfTemplate(tid) {
  const mc = document.getElementById('mainContent');
  const t = vfTemplates.find(x => x.id === tid);
  if (!t) return;
  mc.innerHTML = '<div class="loading">加载中…</div>';
  const users = await sb(`/rest/v1/vip_student_plans?template_id=eq.${tid}&select=id,student_name,student_id,status,created_at&order=created_at.desc`).catch(() => []);
  const items = Array.isArray(t.items) ? t.items : [];
  const catMap = {};
  items.forEach((it, i) => { const k = it.category || 'other'; if (!catMap[k]) catMap[k] = { key: k, label: it.category_label || k, items: [], min: i }; catMap[k].items.push(it); });
  const groups = Object.values(catMap).sort((a, b) => a.min - b.min);
  const groupsHtml = groups.map(g => {
    const col = VF_CAT_COLOR[g.key] || { bg: '#eee', color: '#333' };
    const rows = g.items.map(it => `<div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 10px;border-top:1px solid var(--border-light);font-size:11px"><div><div style="font-weight:500">${vfEsc(it.name)}</div><div style="color:var(--text-3)">${vfEsc(it.content) || ''}</div></div><div style="color:var(--text-3)">${it.hours != null ? it.hours + 'H' : ''}</div></div>`).join('');
    return `<div style="margin-bottom:10px"><div style="margin-bottom:4px"><span style="border-radius:3px;padding:2px 9px;font-size:11px;font-weight:500;background:${col.bg};color:${col.color}">${vfEsc(g.label)}</span></div><div style="border:1px solid var(--border);border-radius:4px;overflow:hidden">${rows}</div></div>`;
  }).join('');

  const usersHtml = users.length ? users.map(u => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);margin-bottom:5px;font-size:12px"><span style="font-weight:500">${vfEsc(u.student_name)}${u.student_id ? ' <span style="font-size:10px;color:#1a4a28">已在籍</span>' : ''}</span><span style="font-size:10px;color:var(--text-3)">${({ signed: '已签约', pending: '待确认', confirmed: '已确认' })[u.status] || u.status}</span></div>`).join('') : '<div style="font-size:11px;color:var(--text-3)">还没有学生使用此套餐</div>';

  mc.innerHTML = `
  <div class="page-section" style="max-width:900px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap">
      <button onclick="openVipFramework('${t.framework_id}')" style="font-size:11px;background:none;border:1px solid var(--border);border-radius:3px;padding:4px 12px;cursor:pointer;font-family:inherit;color:var(--text-2)">← 返回套餐列表</button>
      <button class="btn btn-outline" onclick="deleteVfTemplate('${t.id}')" style="color:#a33">删除套餐</button>
    </div>
    <div style="font-family:'Noto Serif SC',serif;font-size:17px;font-weight:600;margin:6px 0">${vfEsc(t.name || '套餐')}</div>
    <div style="font-size:12px;color:var(--text-3);margin-bottom:16px">${t.total_sessions || 0} 回 · ${t.total_hours || 0} 课时${(t.subject_hours && t.subject_hours > 0) ? ' · 专业知识 ' + t.subject_hours + ' 课时' : ''}</div>

    <div style="padding:12px 14px;border:1px solid var(--border);border-radius:5px;background:var(--bg);margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px">应用到学生</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input id="vf_apply_name" placeholder="输入学生姓名" style="font-size:12px;min-width:160px">
        <button class="btn btn-primary" onclick="applyTemplateToStudent('${t.id}')">套用给该学生</button>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:6px">套用后生成一份该学生的方案（状态"已确认"）；姓名与学生登录/在籍姓名一致即可自动关联。</div>
    </div>

    <div style="font-size:12px;font-weight:600;margin-bottom:8px">用了此套餐的学生（${users.length}）</div>
    <div style="margin-bottom:18px">${usersHtml}</div>

    <div style="font-size:12px;font-weight:600;margin-bottom:8px">套餐课程</div>
    ${groupsHtml || '<div style="font-size:11px;color:var(--text-3)">此套餐暂无课程</div>'}
  </div>`;
}

async function deleteVfTemplate(tid) {
  const t = vfTemplates.find(x => x.id === tid);
  if (!confirm(`确认删除套餐「${t ? t.name : ''}」？（已套用给学生的方案不受影响）`)) return;
  try {
    await sb(`/rest/v1/vip_plan_templates?id=eq.${tid}`, 'DELETE');
    vfTemplates = vfTemplates.filter(x => x.id !== tid);
    openVipFramework(vfCurrentId);
  } catch (e) { alert('删除失败：' + e.message); }
}

async function applyTemplateToStudent(tid) {
  const t = vfTemplates.find(x => x.id === tid);
  if (!t) return;
  const name = (document.getElementById('vf_apply_name').value || '').trim();
  if (!name) { alert('请输入学生姓名'); return; }
  // 若该学生已在籍，带上 student_id + 其 VIP 指导老师
  let studentId = '', teachers = [];
  try {
    const st = await sb(`/rest/v1/students?name=eq.${encodeURIComponent(name)}&select=id,vip_teachers&limit=1`);
    if (st && st.length) { studentId = st[0].id; teachers = st[0].vip_teachers || []; }
  } catch (e) {}
  const rec = {
    id: 'vsp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
    student_name: name, student_id: studentId || null, major: t.major, framework_id: t.framework_id,
    framework_title: '', template_id: t.id, items: t.items, total_sessions: t.total_sessions,
    total_hours: t.total_hours, subject_hours: t.subject_hours || 0, status: 'confirmed',
    assigned_teachers: teachers, created_by: 'admin',
  };
  try {
    await sb('/rest/v1/vip_student_plans', 'POST', [rec]);
    alert(`已把套餐「${t.name}」套用给「${name}」${studentId ? '（已自动关联在籍学生）' : ''}`);
    openVfTemplate(tid);
  } catch (e) { alert('套用失败：' + e.message); }
}

function backToVipFrameworkList() {
  renderVipFrameworkPage(document.getElementById('mainContent'));
}
function vfToggleCat(key) {
  vfOpenCats[key] = vfOpenCats[key] === false ? true : false;
  renderVipFrameworkEditor(document.getElementById('mainContent'));
}
function vfEditItem(id, field, value) {
  const it = vfItems.find(x => x.id === id);
  if (!it) return;
  it[field] = field === 'default_hours' ? (parseFloat(value) || 0) : value;
}
function vfAddItem(cat, label) {
  const maxOrder = vfItems.reduce((m, i) => Math.max(m, i.sort_order || 0), 0);
  vfItems.push({
    id: 'vfi-new-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
    framework_id: vfCurrentId, category: cat, category_label: label,
    name: '', content: '', homework: '', default_hours: 2,
    sort_order: maxOrder + 1, source: 'custom', filled: false, _new: true,
  });
  vfOpenCats[cat] = true;
  renderVipFrameworkEditor(document.getElementById('mainContent'));
}
function vfRemoveItem(id) {
  vfItems = vfItems.filter(x => x.id !== id);
  renderVipFrameworkEditor(document.getElementById('mainContent'));
}

async function saveVipFramework() {
  const btn = document.querySelector('#mainContent .btn-primary');
  if (btn) { btn.textContent = '保存中…'; btn.disabled = true; }
  try {
    const newItems = vfItems.filter(i => i._new);
    const existing = vfItems.filter(i => !i._new);
    const currentIds = new Set(vfItems.map(i => i.id));
    const removedIds = [...vfOriginalItemIds].filter(id => !currentIds.has(id));

    // 新增条目 → POST
    if (newItems.length) {
      const payload = newItems.map(({ _new, ...rest }) => rest);
      for (let i = 0; i < payload.length; i += 20) {
        await sb('/rest/v1/vip_framework_items', 'POST', payload.slice(i, i + 20));
      }
    }
    // 已有条目 → 逐条 PATCH（内容/名称/作业/课时/顺序）
    for (const it of existing) {
      await sb(`/rest/v1/vip_framework_items?id=eq.${it.id}`, 'PATCH', {
        name: it.name, content: it.content, homework: it.homework,
        default_hours: it.default_hours, sort_order: it.sort_order,
      });
    }
    // 删除的条目 → DELETE
    for (const id of removedIds) {
      await sb(`/rest/v1/vip_framework_items?id=eq.${id}`, 'DELETE');
    }
    // 重新同步内存状态
    vfItems.forEach(i => delete i._new);
    vfOriginalItemIds = new Set(vfItems.map(i => i.id));
    alert('已保存');
    renderVipFrameworkEditor(document.getElementById('mainContent'));
  } catch (e) {
    alert('保存失败：' + e.message);
    if (btn) { btn.textContent = '保存框架'; btn.disabled = false; }
  }
}

function vfAddShareTeacher(name) {
  if (!name || vfShareTeachers.includes(name)) return;
  vfShareTeachers.push(name);
  renderVipFrameworkEditor(document.getElementById('mainContent'));
}
function vfRemoveShareTeacher(name) {
  vfShareTeachers = vfShareTeachers.filter(n => n !== name);
  renderVipFrameworkEditor(document.getElementById('mainContent'));
}

async function shareVipToTeacher() {
  const note = document.getElementById('vf_share_note').value.trim();
  if (!vfShareTeachers.length) { alert('请至少添加一位老师'); return; }
  if (!confirm(`确认分享给：${vfShareTeachers.join('、')}？\n分享前请先「保存框架」，否则未保存的内容修改不会带过去。`)) return;
  try {
    await sb(`/rest/v1/vip_frameworks?id=eq.${vfCurrentId}`, 'PATCH', {
      assigned_teachers: vfShareTeachers, assigned_teacher: vfShareTeachers[0] || '',
      share_note: note, status: 'shared',
    });
    const fw = vfFrameworks.find(f => f.id === vfCurrentId);
    if (fw) { fw.assigned_teachers = [...vfShareTeachers]; fw.assigned_teacher = vfShareTeachers[0] || ''; fw.share_note = note; fw.status = 'shared'; }
    alert(`已分享给：${vfShareTeachers.join('、')}`);
    renderVipFrameworkEditor(document.getElementById('mainContent'));
  } catch (e) {
    alert('分享失败：' + e.message);
  }
}

async function deleteVipFramework() {
  const fw = vfFrameworks.find(f => f.id === vfCurrentId);
  if (!fw) return;
  if (!confirm(`确认删除框架「${fw.title}」及其全部条目？此操作不可撤销。`)) return;
  try {
    await sb(`/rest/v1/vip_framework_items?framework_id=eq.${vfCurrentId}`, 'DELETE');
    await sb(`/rest/v1/vip_frameworks?id=eq.${vfCurrentId}`, 'DELETE');
    await loadVipFrameworks();
    renderVipFrameworkPage(document.getElementById('mainContent'));
  } catch (e) {
    alert('删除失败：' + e.message);
  }
}

// HTML 转义（用于 value / textContent 注入）
function vfEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ════════════════════════════════════════════════════════════════
// 学生档案里直接为学生建 VIP 方案（admin 数据中心）
// 选模板 → 勾课程/设课时 → 保存，方案直接绑定该学生 + 关联其 VIP 指导老师
// ════════════════════════════════════════════════════════════════
let spbFrameworks = [];
let spbItems = [];
let spbSel = new Set();
let spbHrs = {};
let spbSubjectHours = 0;
let spbCtx = { sid: '', name: '', major: '' };
let spbMode = 'student';      // 'student'(为学生建方案) / 'template'(新建套餐)
let spbTplFwId = '';          // 套餐模式：来源框架 id
const SPB_SUBJECT_CATS = ['base', 'adv', 'method', 'ext'];
const SPB_HOURS_OPTS = [0.5, 1, 2, 3, 4];

async function openStudentPlanBuilder() {
  const sid = document.getElementById('studentId')?.value;
  const name = (document.getElementById('st_name')?.value || '').trim();
  const major = document.getElementById('st_major')?.value || '';
  if (!sid) { alert('请先保存学生，再为其添加 VIP 方案'); return; }
  if (!name) { alert('请先填写学生姓名'); return; }
  spbCtx = { sid, name, major };
  spbMode = 'student';
  spbItems = []; spbSel = new Set(); spbHrs = {}; spbSubjectHours = 0;
  // 载入框架：优先该专业，没有则全部
  let fws = await sb(`/rest/v1/vip_frameworks?major=eq.${encodeURIComponent(major)}&select=*&order=created_at.desc`).catch(() => []);
  if (!fws.length) fws = await sb('/rest/v1/vip_frameworks?select=*&order=major.asc,created_at.desc').catch(() => []);
  spbFrameworks = fws;
  renderSpbModal();
  if (fws.length) spbSelectFramework(fws[0].id);
}

function renderSpbModal() {
  const existing = document.getElementById('spbModal');
  if (existing) existing.remove();
  const isTpl = spbMode === 'template';
  const fwOpts = spbFrameworks.map(f => `<option value="${f.id}">${vfEsc(f.title || majorLabel(f.major))}</option>`).join('');
  const m = document.createElement('div');
  m.id = 'spbModal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  const controls = isTpl
    ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <span style="font-size:11px;color:var(--text-3)">套餐名称</span>
        <input id="spb_tpl_name" placeholder="如 20H / 30小时" style="font-size:12px;width:130px">
        <span style="font-size:11px;color:var(--text-3)">专业知识总课时</span>
        <input type="number" id="spb_subject_hours" step="0.5" min="0" value="" placeholder="0" onchange="spbSetSubjectHours(this.value)" style="width:64px;font-size:12px;text-align:center">
        <span id="spb_totals" style="font-size:12px;color:var(--text-2);margin-left:auto">0 回 · 0 课时</span>
      </div>`
    : `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <span style="font-size:11px;color:var(--text-3)">选择模板</span>
        <select id="spb_fw" onchange="spbSelectFramework(this.value)" style="font-size:12px">${fwOpts}</select>
        <span style="font-size:11px;color:var(--text-3)">专业知识总课时</span>
        <input type="number" id="spb_subject_hours" step="0.5" min="0" value="" placeholder="0" onchange="spbSetSubjectHours(this.value)" style="width:64px;font-size:12px;text-align:center">
        <span id="spb_totals" style="font-size:12px;color:var(--text-2);margin-left:auto">0 回 · 0 课时</span>
      </div>`;
  const showBody = isTpl || spbFrameworks.length;
  m.innerHTML = `
    <div style="background:var(--surface);border-radius:6px;padding:18px;max-width:720px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">
        <div style="font-size:14px;font-weight:600">${isTpl ? '新建课程套餐' : '为「' + vfEsc(spbCtx.name) + '」添加 VIP 方案'}</div>
        <button onclick="document.getElementById('spbModal').remove()" style="background:none;border:1px solid var(--border);border-radius:3px;padding:3px 10px;cursor:pointer;font-size:12px">关闭</button>
      </div>
      ${showBody ? `
      ${controls}
      <div id="spb_body" style="max-height:52vh;overflow-y:auto"><div style="color:var(--text-3);font-size:12px">加载中…</div></div>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button onclick="document.getElementById('spbModal').remove()" style="font-size:12px;background:none;border:1px solid var(--border);border-radius:3px;padding:6px 14px;cursor:pointer">取消</button>
        <button onclick="spbSavePlan()" style="font-size:12px;background:var(--accent,#1a1814);color:#fff;border:none;border-radius:3px;padding:6px 16px;cursor:pointer;font-weight:500">${isTpl ? '保存套餐' : '保存方案并绑定该学生'}</button>
      </div>` : '<div style="font-size:12px;color:var(--text-3);padding:20px 0">暂无可用框架模板，请先在「VIP框架」建立模板。</div>'}
    </div>`;
  document.body.appendChild(m);
}

async function spbSelectFramework(fwId) {
  spbItems = await sb(`/rest/v1/vip_framework_items?framework_id=eq.${fwId}&select=*&order=sort_order.asc`).catch(() => []);
  spbSel = new Set(); spbHrs = {};
  renderSpbBody();
}

function spbHoursOf(it) {
  if (SPB_SUBJECT_CATS.includes(it.category) || it.category === 'ta') return it.default_hours != null ? it.default_hours : 2;
  return spbHrs[it.id] != null ? spbHrs[it.id] : (it.default_hours != null ? it.default_hours : 2);
}
function spbCalc() {
  let sessions = 0, hours = 0;
  spbItems.forEach(it => {
    if (!spbSel.has(it.id)) return;
    const isSub = SPB_SUBJECT_CATS.includes(it.category);
    if (isSub && spbSubjectHours > 0) return;
    const h = spbHoursOf(it);
    hours += h;
    if (isSub) sessions += h / 2; else if (it.category === 'ta') sessions += 0; else sessions += 1;
  });
  if (spbSubjectHours > 0) { hours += spbSubjectHours; sessions += spbSubjectHours / 2; }
  return { sessions: +sessions.toFixed(1), hours: +hours.toFixed(1) };
}
function spbUpdateTotals() { const c = spbCalc(); const el = document.getElementById('spb_totals'); if (el) el.textContent = `${c.sessions} 回 · ${c.hours} 课时`; }

function renderSpbBody() {
  const body = document.getElementById('spb_body');
  if (!body) return;
  if (!spbItems.length) { body.innerHTML = '<div style="color:var(--text-3);font-size:12px">该模板暂无课程</div>'; spbUpdateTotals(); return; }
  const catMap = {};
  spbItems.forEach(it => {
    const k = it.category || 'other';
    if (!catMap[k]) catMap[k] = { key: k, label: it.category_label || k, items: [], min: it.sort_order || 0 };
    catMap[k].items.push(it); catMap[k].min = Math.min(catMap[k].min, it.sort_order || 0);
  });
  const groups = Object.values(catMap).sort((a, b) => a.min - b.min);
  body.innerHTML = groups.map(g => {
    const col = VF_CAT_COLOR[g.key] || { bg: '#eee', color: '#333' };
    const rows = g.items.map(it => {
      const sel = spbSel.has(it.id);
      const editable = !SPB_SUBJECT_CATS.includes(it.category) && it.category !== 'ta';
      const h = spbHoursOf(it);
      const hCtl = editable
        ? `<select onclick="event.stopPropagation()" onchange="spbSetHours('${it.id}',this.value)" ${sel ? '' : 'disabled'} style="font-size:11px;width:54px;text-align:center">${SPB_HOURS_OPTS.map(o => `<option value="${o}"${o === h ? ' selected' : ''}>${o}H</option>`).join('')}</select>`
        : `<span style="font-size:11px;font-weight:500">${h}H</span>`;
      return `<div onclick="spbToggle('${it.id}')" style="display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;padding:6px 8px;border-top:1px solid var(--border-light);cursor:pointer;background:${sel ? 'var(--bg)' : 'transparent'}">
        <div style="display:flex;justify-content:center"><div style="width:13px;height:13px;border:1px solid ${sel ? 'var(--accent,#1a1814)' : 'var(--border)'};border-radius:2px;background:${sel ? 'var(--accent,#1a1814)' : 'transparent'};color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center">${sel ? '✓' : ''}</div></div>
        <div style="min-width:0"><div style="font-size:11px;font-weight:500">${vfEsc(it.name)}</div><div style="font-size:10px;color:var(--text-3)">${vfEsc(it.content) || ''}</div></div>
        <div style="text-align:right">${hCtl}</div>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:12px"><div style="margin-bottom:4px"><span style="border-radius:3px;padding:2px 9px;font-size:11px;font-weight:500;background:${col.bg};color:${col.color}">${vfEsc(g.label)}</span></div><div style="border:1px solid var(--border);border-radius:4px;overflow:hidden">${rows}</div></div>`;
  }).join('');
  spbUpdateTotals();
}

function spbToggle(id) { if (spbSel.has(id)) spbSel.delete(id); else spbSel.add(id); renderSpbBody(); }
function spbSetHours(id, v) { spbHrs[id] = parseFloat(v); spbUpdateTotals(); }
function spbSetSubjectHours(v) { spbSubjectHours = parseFloat(v) || 0; renderSpbBody(); }

// 从当前框架点选课程、命名，保存为可复用套餐
function openTemplateBuilder() {
  spbMode = 'template';
  spbTplFwId = vfCurrentId;
  spbCtx = { sid: '', name: '', major: (vfFrameworks.find(f => f.id === vfCurrentId) || {}).major || '' };
  spbItems = [...vfItems];   // 当前框架的条目
  spbSel = new Set(); spbHrs = {}; spbSubjectHours = 0;
  renderSpbModal();
  renderSpbBody();
}

async function spbSavePlan() {
  if (!spbSel.size && !(spbSubjectHours > 0)) { alert('请至少点选一门课程，或设置专业知识总课时'); return; }
  const items = spbItems.filter(it => spbSel.has(it.id)).map(it => ({
    category: it.category, category_label: it.category_label, name: it.name,
    content: it.content, homework: it.homework, hours: spbHoursOf(it),
  }));
  const c = spbCalc();

  if (spbMode === 'template') {
    const nameEl = document.getElementById('spb_tpl_name');
    const tname = (nameEl ? nameEl.value : '').trim();
    if (!tname) { alert('请填写套餐名称（如 20H）'); return; }
    const fw = vfFrameworks.find(f => f.id === spbTplFwId);
    const rec = {
      id: 'vtpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      framework_id: spbTplFwId, major: fw ? fw.major : spbCtx.major, name: tname,
      items, total_sessions: c.sessions, total_hours: c.hours, subject_hours: spbSubjectHours || 0,
    };
    try {
      await sb('/rest/v1/vip_plan_templates', 'POST', [rec]);
      document.getElementById('spbModal').remove();
      vfTemplates.unshift(rec);
      renderVipFrameworkEditor(document.getElementById('mainContent'));
      alert(`已保存套餐「${tname}」`);
    } catch (e) { alert('保存失败：' + e.message); }
    return;
  }

  // 学生模式
  const fwId = document.getElementById('spb_fw').value;
  const fw = spbFrameworks.find(f => f.id === fwId);
  const teachers = (typeof vipTeacherTags !== 'undefined' && Array.isArray(vipTeacherTags)) ? [...vipTeacherTags] : [];
  const rec = {
    id: 'vsp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
    student_name: spbCtx.name, student_id: spbCtx.sid, major: spbCtx.major || (fw ? fw.major : ''),
    framework_id: fwId, framework_title: fw ? fw.title : '',
    items, total_sessions: c.sessions, total_hours: c.hours, subject_hours: spbSubjectHours || 0,
    status: 'confirmed', assigned_teachers: teachers, created_by: 'admin',
  };
  try {
    await sb('/rest/v1/vip_student_plans', 'POST', [rec]);
    document.getElementById('spbModal').remove();
    const s = (typeof cachedStudents !== 'undefined') ? cachedStudents.find(x => x.id === spbCtx.sid) : null;
    if (typeof renderStudentVipPlans === 'function') renderStudentVipPlans(s || { id: spbCtx.sid, name: spbCtx.name });
    alert(`已为「${spbCtx.name}」创建 VIP 方案（${c.sessions}回/${c.hours}课时）并绑定。`);
  } catch (e) { alert('保存失败：' + e.message); }
}
