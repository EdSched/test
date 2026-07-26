// ── VIP 课程框架管理（阶段1）──
// admin 按专业新建框架（默认内容由 VIP 目录预填）→ 编辑完善 → 分享给对应老师补充。
// 数据：vip_frameworks（框架头）+ vip_framework_items（每节课条目）。

let vfFrameworks = [];        // 所有框架（列表用）
let vfItems = [];             // 当前打开框架的条目（内存工作副本）
let vfCurrentId = null;       // 当前打开的框架 id
let vfOriginalItemIds = new Set();  // 打开时的原始条目 id（用于保存时算删除）
let vfOpenCats = {};          // 分类折叠状态
let vfShareTeachers = [];     // 当前框架已选的分享老师（多选，内存副本）

const VIP_STATUS_LABEL = { draft: '编辑中', shared: '待老师补充', done: '已完成' };
const VIP_STATUS_COLOR = { draft: '#8a6d3b', shared: '#1a3a6a', done: '#1a4a28' };
const VIP_STATUS_BG    = { draft: '#faf0dc', shared: '#ddeaf8', done: '#ddf0e0' };

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
        <button class="btn btn-primary" onclick="createVipFramework()" style="white-space:nowrap">＋新建框架</button>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${cards}</div>
  </div>`;
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
        <div style="font-size:12px;font-weight:600">${g.label}<span style="font-size:10px;color:var(--text-3);font-weight:400;margin-left:8px">${g.items.length} 条</span></div>
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

  mc.innerHTML = `
  <div class="page-section" style="max-width:1000px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;flex-wrap:wrap">
      <button onclick="backToVipFrameworkList()" style="font-size:11px;background:none;border:1px solid var(--border);border-radius:3px;padding:4px 12px;cursor:pointer;font-family:inherit;color:var(--text-2)">← 返回列表</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="saveVipFramework()">保存框架</button>
        <button class="btn btn-outline" onclick="deleteVipFramework()" style="color:#a33">删除框架</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:8px 0 16px">
      <div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600">${fw.title}</div>
      <span style="font-size:10px;padding:2px 10px;border-radius:3px;background:${VIP_STATUS_BG[st]};color:${VIP_STATUS_COLOR[st]}">${VIP_STATUS_LABEL[st]}</span>
      <span style="font-size:11px;color:var(--text-3)">共 ${vfItems.length} 条</span>
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
    </div>
  </div>`;
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
