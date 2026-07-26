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
  teacherVipFrameworks = await sb(
    `/rest/v1/vip_frameworks?assigned_teacher=eq.${encodeURIComponent(teacherName)}&status=in.("shared","done")&select=*&order=created_at.desc`
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
