/* =============== 基础配置（按你现有 API） =============== */
const API_URL = 'https://script.google.com/macros/s/AKfycbwew2T6Scwk5HGbNcf4wh-gmcXyJW6YULKGHEvyNQLA5SQ-fjB_epdNbSxdbb0Se2w/exec';

// 所属 → 专业（学科逻辑顺序，互不混合）
const MAJOR_OPTIONS = {
  '理科大学院': [
    '机械',        // 工学基础
    '电子电器',    // 电气/信息硬件
    '生物化学',    // 生命理学
    '情报学'       // 信息学（软件/数据）
  ],
  '文科大学院': [
    '文学',
    '历史学',
    '社会学',
    '社会福祉学',
    '新闻传播学',
    '表象文化',
    '经营学',
    '经济学',
    '日本语教育'
  ]
};

/* =============== 小工具 =============== */
const $ = (id) => document.getElementById(id);
function setApiStatus({ok, text}) {
  const dotTop = $('apiDotTop'), txtTop = $('apiTextTop');
  const inline = $('apiStatusInline');
  if (dotTop) dotTop.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
  if (txtTop) txtTop.textContent = text || (ok ? 'API 正常' : (ok===false ? 'API 连接失败' : 'API 检测中'));
  if (inline) {
    let dot = inline.querySelector('.api-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'api-dot wait';
      dot.style.cssText = 'display:inline-block;border-radius:50%;width:8px;height:8px;margin-right:6px;';
      inline.prepend(dot);
    }
    dot.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
    inline.lastChild && inline.lastChild.nodeType===3 && (inline.lastChild.textContent=' ');
    inline.append(text ? (' ' + text) : (ok ? ' API连接成功' : (ok===false ? ' API连接失败' : ' 正在检测 API 连接…')));
  }
}

/* =============== 统一/适配 =============== */
function normalizeUser(u = {}, fallbackId = '') {
  return {
    userId: u.userid || u.userId || u.username || u.id || fallbackId || '',
    name: u.name || u.realName || u.displayName || '',
    role: u.role || u.identity || '',
    department: u.affiliation || u.department || u.dept || '',
    major: u.major || u.subject || ''
  };
}
function normalizeRole(user){
  const id = String(user.userId||'');
  const r0 = String(user.role||'').toLowerCase();
  if (r0.includes('admin') || r0.includes('管') || id.startsWith('A')) return 'admin';
  if (r0.includes('teacher') || r0.includes('师') || id.startsWith('T')) return 'teacher';
  return 'student';
}
function adaptEvents(rows) {
  if (!Array.isArray(rows)) return [];
  
  // 后端已返回标准 FullCalendar 格式，只做基本过滤和清理
  return rows.filter(r => r && r.start && r.title).map(r => ({
    id: r.id,
    title: r.title,
    start: r.start,
    end: r.end,
    backgroundColor: r.backgroundColor,
    borderColor: r.borderColor,
    extendedProps: r.extendedProps || {}
  }));
}

/* =============== API =============== */
async function callAPI(action, params = {}) {
  try {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('params', JSON.stringify(params));
    const controller = new AbortController();
    const t = setTimeout(()=>controller.abort(), 8000);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      mode: 'cors',
      signal: controller.signal
    });
    clearTimeout(t);
    const text = await res.text();
    let clean = text.trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) clean = clean.slice(s, e+1);
    return JSON.parse(clean);
  } catch (err) {
    return { success:false, message:'网络请求失败: ' + err.message };
  }
}
async function checkApiHealth() {
  setApiStatus({ok:null, text:'API 检测中'});
  try {
    const [r1, r2] = await Promise.allSettled([
      callAPI('testConnection'),
      callAPI('ping', { t: Date.now() })
    ]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ ok, text: ok ? 'API 连接成功' : 'API 连接异常' });
    return ok;
  } catch (e) {
    setApiStatus({ ok:false, text:'API 连接失败' });
    return false;
  }
}

/* =============== 全局状态 =============== */
let currentUser = null;
let calendar = null;
const navLinks = [];

/* =============== 登录 / 注册 / 登出（极简） =============== */
function showRegisterForm() {
  $('loginForm').style.display = 'none';
  $('registerForm').style.display = 'block';
  $('loginError').textContent = '';
  $('registerError').textContent = '';
}
function showLoginForm() {
  $('registerForm').style.display = 'none';
  $('loginForm').style.display = 'block';
  $('loginError').textContent = '';
  $('registerError').textContent = '';
}
async function login() {
  const userid = ($('loginUsername').value || '').trim();
  const err = $('loginError');
  if (!userid) { err.textContent = '请输入用户ID'; return; }
  err.style.color=''; err.textContent='正在登录…';
  const r = await callAPI('loginByUserid', { userid });
  if (r && (r.success || r.ok)) {
    currentUser = normalizeUser(r.user, userid);
    $('loginContainer').style.display = 'none';
    $('mainApp').style.display = 'block';
    try{ window.location.hash = '#app'; }catch{}
    updateUserUI();
    initCalendar();
    bindTopBarButtons();
    loadCalendarEvents();
  } else {
    err.style.color='#c00';
    err.textContent = (r && (r.message || r.msg)) || '登录失败：用户ID不存在';
  }
}

// appV1.js — 注册处理（最小改动版）
// 带完整调试功能的注册函数
async function registerUser(evt){
  evt?.preventDefault?.();
  console.log('🔥 注册函数开始执行');
  
  const $ = id => document.getElementById(id);

  // 1) 获取所有表单元素和错误显示元素
  const err        = $('registerError');
  const name       = $('registerName').value.trim();
  const email      = $('registerEmail').value.trim();
  const department = $('registerDepartment').value.trim();
  const role       = $('registerRole').value.trim();
  const majorSel   = $('registerMajorSelect')?.value?.trim() || '';
  const majorFree  = $('registerMajorFree')?.value?.trim() || '';
  const major      = (department === '其他') ? majorFree : majorSel;

  console.log('📝 收集到的表单数据:', {
    name, email, department, role, 
    majorSel, majorFree, major,
    '所属是否为其他': department === '其他'
  });

  // 2) 数据验证
  if (!name || !email || !department || !role) {
    console.log('❌ 基础字段验证失败');
    err.style.color = '#c00';
    err.textContent = '请填写姓名、邮箱、所属、身份'; 
    return;
  }
  
  if (department === '其他' && !major) {
    console.log('❌ 其他部门但未填写专业');
    err.style.color = '#c00';
    err.textContent = '所属为"其他"时，请填写专业'; 
    return;
  }
  
  if (department !== '其他' && !major) {
    console.log('❌ 非其他部门但未选择专业');
    err.style.color = '#c00';
    err.textContent = '请选择一个专业'; 
    return;
  }

  console.log('✅ 数据验证通过，准备调用API');

  // 3) 显示加载状态
  err.style.color = '';
  err.textContent = '正在登记…';
  
  // 4) 准备API参数
  const apiParams = { name, email, department, major, role };
  console.log('🚀 调用注册API，参数:', apiParams);
  console.log('🌐 API地址:', API_URL);

  try {
    // 5) 调用API
    const startTime = Date.now();
    const r = await callAPI('registerByProfile', apiParams);
    const endTime = Date.now();
    
    console.log(`📡 API调用完成，耗时: ${endTime - startTime}ms`);
    console.log('📥 API返回结果:', r);
    
    // 6) 处理返回结果
    if (r && r.success) {  // 注册API只检查 success，不检查 ok
      console.log('✅ 注册成功');
      err.style.color = 'green';
      err.textContent = (role.indexOf('老师') > -1)
        ? '已完成注册，等待管理员分配用户ID'
        : '已完成注册，等待老师分配ID';
    } else {
      console.log('❌ 注册失败');
      console.log('失败原因:', r ? r.message : '无返回信息');
      
      err.style.color = '#c00';
      let msg = (r && r.message) ? r.message : '登记失败（无返回信息）';  // 只使用 message
      
      // 显示调试信息（如果有）
      if (r && r.debug) {
        console.log('🔍 调试信息:', r.debug);
        msg += '\n调试信息: ' + JSON.stringify(r.debug, null, 2);
      }
      
      err.textContent = msg;
    }
  } catch (error) {
    console.error('💥 注册过程发生异常:', error);
    err.style.color = '#c00';
    err.textContent = '网络错误: ' + error.message;
  }
}

function logout() {
  currentUser = null;
  $('mainApp').style.display = 'none';
  $('loginContainer').style.display = 'flex';
  $('loginUsername').value = '';
  $('loginError').textContent = '';
  setApiStatus({ok:null, text:'API 检测中'});
  try{ window.location.hash = '#login'; }catch{}
  checkApiHealth();  
}

/* =============== 角色导航与页面切换 =============== */
/** 管理员别名：侧栏 data-page -> 实际页面ID */
// 统一：直接按 data-page 去找 `${pageId}Page`
// === [预约/定课/休讲] 前端临时状态（不落表） ===
const __uiState = {
  booked:   new Set(), // 学生端“已预约”
  claimed:  new Set(), // 老师端“已定课（待确认）”
  canceled: new Set()  // 已休讲（只标记这一次）
};

// 角色判定：沿用你登录成功后保存的 user 对象
function getCurrentRole() {
  try {
    const raw = localStorage.getItem('edsched_user'); // ← 若你用别的键，改这里
    if (!raw) return '';
    const u = JSON.parse(raw);
    return String(u.role || '').trim(); // '学生' / '老师' / '管理员' 等
  } catch { return ''; }
}

// 事件标记提取：仅用于“视觉模拟”
// 规则：学生端：标题含「面谈 / VIP」→ 可预约；老师端：未休讲→ 可定课
function deriveFlags(event) {
  const id   = event.id;
  const tit  = (event.title || '');
  const role = getCurrentRole();

  const isCanceled = __uiState.canceled.has(id);
  const isBooked   = __uiState.booked.has(id);
  const isClaimed  = __uiState.claimed.has(id);

  const isInterviewOrVip = /面谈|VIP/i.test(tit);

  const canBook   = (role.includes('学生') && isInterviewOrVip && !isCanceled);
  const canClaim  = (role.includes('老师') && !isCanceled);
  const canCancel = (role.includes('老师') || role.includes('管理员')) && !isCanceled && !isInterviewOrVip;
  // ^ 休讲按钮：按你描述，仅“已安排/正常发布”的课允许。这里先放宽为老师/管理员可见（仅视觉），真正判断等接后端。

  return { isCanceled, isBooked, isClaimed, canBook, canClaim, canCancel };
}

// 轻量弹窗（不改你现有UI就用这个；如果你已有Modal组件，换成你自己的API即可）
function openMiniDialog(title, actions = []) {
  // actions: [{text, handler, variant}] ; variant 可为 'danger'|'primary'|'ghost'
  const overlay = document.createElement('div');
  overlay.className = 'eds-mini-modal__overlay';
  const dlg = document.createElement('div');
  dlg.className = 'eds-mini-modal';
  dlg.innerHTML = `<div class="eds-mini-modal__title">${title}</div>
                   <div class="eds-mini-modal__actions"></div>`;
  const box = dlg.querySelector('.eds-mini-modal__actions');
  actions.forEach(a=>{
    const btn = document.createElement('button');
    btn.className = `eds-mini-modal__btn ${a.variant||''}`;
    btn.textContent = a.text;
    btn.onclick = ()=>{ try{ a.handler&&a.handler(); } finally { document.body.removeChild(overlay); } };
    box.appendChild(btn);
  });
  overlay.onclick = (e)=>{ if(e.target===overlay) document.body.removeChild(overlay); };
  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
}

function resolvePageIdForRole(pageId) {
  return pageId;
}
function showPage(pageIdRaw) {
  const pageId = resolvePageIdForRole(pageIdRaw);
  document.querySelectorAll('.page-content').forEach(p => { p.classList.remove('active'); p.style.display='none'; });
  const panel = document.getElementById(pageId + 'Page');
  if (panel) { panel.style.display='block'; panel.classList.add('active'); }
  navLinks.forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`.nav-link[data-page="${pageIdRaw}"]`);
  if (active) active.classList.add('active');
  if (pageId === 'calendar' && window.calendar) setTimeout(()=>window.calendar.updateSize(), 60);
  
  // 添加预约功能调用
  if (pageId === 'mycourses' && window.bookingModule) {
    setTimeout(() => {
      window.bookingModule.loadMyConfirmations();
    }, 100);
  }
}
function updateUserUI() {
  if (!currentUser) return;
  currentUser.roleNorm = normalizeRole(currentUser);
  $('userGreeting').textContent = '欢迎，' + (currentUser.name || currentUser.userId);
  $('userRole').textContent = '(' + (currentUser.role || '') + ')';

  // 三套导航容器互斥显示（按你新的 HTML 结构）
  const ns = $('nav-student'), nt = $('nav-teacher'), na = $('nav-admin');
  ns && (ns.style.display = currentUser.roleNorm === 'student' ? '' : 'none');
  nt && (nt.style.display = currentUser.roleNorm === 'teacher' ? '' : 'none');
  na && (na.style.display = currentUser.roleNorm === 'admin'   ? '' : 'none');

  // 让当前角色导航的第一个链接高亮并显示对应页面
  const navRoot = currentUser.roleNorm === 'student' ? ns : (currentUser.roleNorm === 'teacher' ? nt : na);
  let firstLink = navRoot ? navRoot.querySelector('.nav-link') : null;
  if (firstLink) {
    document.querySelectorAll('.nav-link').forEach(a=>a.classList.remove('active'));
    firstLink.classList.add('active');
    const pid = resolvePageIdForRole(firstLink.dataset.page);
    showPage(pid);
  } else {
    // 兜底到日历
    showPage('calendar');
  }
}

/* =============== 日历 =============== */
function initCalendar() {
  const el = $('mainCalendar');
  if (!el) return;

  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';

  const calendarOptions = {
    // === 加入：渲染徽标（eventDidMount） ===
    eventDidMount: function(info) {
      const ev = info.event;
      const flags = deriveFlags(ev);

      // 休讲样式
      if (flags.isCanceled) {
        info.el.classList.add('event--canceled');
        // 标题右侧加【休讲】
        const tag = document.createElement('span');
        tag.className = 'badge badge--canceled';
        tag.textContent = '休讲';
        info.el.querySelector('.fc-event-title')?.appendChild(tag);
      }

      // 老师端"可定课"
      if (flags.canClaim && !flags.isClaimed) {
        const tag = document.createElement('span');
        tag.className = 'badge badge--claimable';
        tag.textContent = '可定课';
        info.el.querySelector('.fc-event-title')?.appendChild(tag);
      }
      // 学生端"可预约"
      if (flags.canBook && !flags.isBooked) {
        const tag = document.createElement('span');
        tag.className = 'badge badge--bookable';
        tag.textContent = '可预约';
        info.el.querySelector('.fc-event-title')?.appendChild(tag);
      }
      // 已定课 / 已预约 的轻标签
      if (flags.isClaimed) {
        const tag = document.createElement('span');
        tag.className = 'badge badge--claimed';
        tag.textContent = '已定课';
        info.el.querySelector('.fc-event-title')?.appendChild(tag);
      }
      if (flags.isBooked) {
        const tag = document.createElement('span');
        tag.className = 'badge badge--booked';
        tag.textContent = '已预约';
        info.el.querySelector('.fc-event-title')?.appendChild(tag);
      }
    },

    // === 加入：点击交互（eventClick） ===
    eventClick: function(info) {
      const ev = info.event;
      const id = ev.id;
      const title = ev.title || '';
      const flags = deriveFlags(ev);

      // 构建动作集合（仅视觉，不落表）
      const actions = [];

      // 学生端：可预约
      if (flags.canBook && !flags.isBooked) {
        actions.push({
          text: '预约',
          variant: 'primary',
          handler: () => {
            __uiState.booked.add(id);
            info.view.calendar.refetchEvents();
          }
        });
      }

      // 老师端：可定课（未定）
      if (flags.canClaim && !flags.isClaimed) {
        actions.push({
          text: '定课（待确认）',
          variant: 'primary',
          handler: () => {
            __uiState.claimed.add(id);
            info.view.calendar.refetchEvents();
          }
        });
      }

      // 老师端：安排休讲（仅这一次、只做前端置灰）
      if (flags.canCancel) {
        actions.push({
          text: '安排休讲（仅本次）',
          variant: 'danger',
          handler: () => {
            __uiState.canceled.add(id);
            info.view.calendar.refetchEvents();
          }
        });
      }

      // 没有动作就不弹
      if (actions.length === 0) {
        // 如果没有可执行的动作，则保留你原有的 alert 逻辑
        const ext = ev.extendedProps || {};
        const start = ev.start ? ev.start.toLocaleString('zh-CN') : '';
        const end = ev.end ? ev.end.toLocaleString('zh-CN') : '';
        const teacher = ext.teacher ? `\n任课老师：${ext.teacher}` : '';
        const slotId = ext.slotId ? `\n槽位ID：${ext.slotId}` : '';
        alert(`课程：${title}\n时间：${start} ~ ${end}${teacher}${slotId}`);
        return;
      }

      openMiniDialog(title, actions);
    },

    initialView: initialView,
    locale: 'zh-cn',
    firstDay: 1,
    height: 'auto',
    headerToolbar: false,
    allDaySlot: false,
    slotMinTime:'08:00:00',
    slotMaxTime:'22:00:00',
    slotDuration:'00:30:00',
    expandRows:true,
    datesSet: updateCalendarTitle,

    // ★ 新增：由 FullCalendar 主动拉取你的 API
    events: async function(info, success, failure) {
      try {
        const viewStart = info.startStr ? info.startStr.slice(0,10) : '';
        const viewEnd   = info.endStr   ? info.endStr.slice(0,10)   : '';
        const params = {
          userId: (currentUser && currentUser.userId) ? currentUser.userId : '',
          viewStart, viewEnd,
          debugNoAuth: !currentUser   // 允许未登录自测
        };
        const res  = await callAPI('listVisibleSlots', params);
        const rows = Array.isArray(res) ? res : (res && res.data) ? res.data : [];
        const adaptedRows = adaptEvents(rows);
        success(adaptedRows);

      } catch (err) {
        failure && failure(err);
      }
    }
  };

  const cal = new FullCalendar.Calendar(el, calendarOptions);
  cal.render();
  window.calendar = cal;
  calendar = cal;
  setTimeout(()=>{ try{ cal.updateSize(); }catch{} }, 60);
  updateCalendarTitle();
}

function updateCalendarTitle() {
  if (!calendar) return;
  const view = calendar.view, date = calendar.getDate();
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  if (view.type === 'timeGridDay') $('calendarTitle').textContent = `${y}/${m}/${d}`;
  else if (view.type === 'timeGridWeek') {
    const s = new Date(view.currentStart), e = new Date(view.currentEnd); e.setDate(e.getDate()-1);
    $('calendarTitle').textContent = `${y}/${String(s.getMonth()+1).padStart(2,'0')}/${String(s.getDate()).padStart(2,'0')} – ${String(e.getMonth()+1).padStart(2,'0')}/${String(e.getDate()).padStart(2,'0')}`;
  } else $('calendarTitle').textContent = `${y}/${m}`;
}
async function loadCalendarEvents() {
  if (!calendar) return;
  // 新：统一交给 FullCalendar 触发拉取逻辑
  try { calendar.refetchEvents(); } catch {}
}



function updateTodayStats(){
  // 占位（不连后台统计）
  $('todayCourses').textContent = $('todayCourses').textContent || '0';
  $('todayConsultations').textContent = $('todayConsultations').textContent || '0';
  $('todayReminders').textContent = $('todayReminders').textContent || '0';
  $('attendanceRate').textContent = $('attendanceRate').textContent || '—';
}

/* =============== 顶部按钮与视图切换（极简） =============== */
function bindTopBarButtons() {
  $('prevBtn')?.addEventListener('click', ()=>{ calendar?.prev(); updateCalendarTitle(); });
  $('todayBtn')?.addEventListener('click', ()=>{ calendar?.today(); updateCalendarTitle(); });
  $('nextBtn')?.addEventListener('click', ()=>{ calendar?.next(); updateCalendarTitle(); });

  $('dayBtn')?.addEventListener('click', (e)=>{ calendar?.changeView('timeGridDay'); setSegActive(e.target); updateCalendarTitle(); });
  $('weekBtn')?.addEventListener('click', (e)=>{ calendar?.changeView('timeGridWeek'); setSegActive(e.target); updateCalendarTitle(); });
  $('monthBtn')?.addEventListener('click', (e)=>{ calendar?.changeView('dayGridMonth'); setSegActive(e.target); updateCalendarTitle(); });

  $('refreshDataBtn')?.addEventListener('click', ()=> { calendar?.refetchEvents(); });
}
function setSegActive(btn){
  ['dayBtn','weekBtn','monthBtn'].forEach(id=>{ const b=$(id); b && b.classList.remove('active'); });
  btn && btn.classList.add('active');
}


/* =============== 初始化 =============== */
document.addEventListener('DOMContentLoaded', async () => {
  // 导航点击：统一用 data-page
  document.querySelectorAll('.nav-link').forEach(link => {
    navLinks.push(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pid = link.dataset.page;
      if (pid) showPage(pid);
    });
  });

  // 登录/注册/退出
  $('loginBtn')?.addEventListener('click', login);
  $('registerBtn')?.addEventListener('click', registerUser);
  $('logoutBtn')?.addEventListener('click', logout);
  $('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  $('showLoginBtn')?.addEventListener('click', showLoginForm);
  $('loginUserid')?.addEventListener('keypress', (e)=>{ if (e.key==='Enter') login(); });


  // —— 注册表单：所属部门 → 专业 联动（极简，不记历史）——
  (function () {
    const depSel    = document.getElementById('registerDepartment');
    const majorSel  = document.getElementById('registerMajorSelect'); // 下拉
    const majorFree = document.getElementById('registerMajorFree');   // 自由填写
    if (!depSel || !majorSel || !majorFree) return;

    const fill = (arr) => {
      majorSel.innerHTML =
        '<option value="">选择专业</option>' +
        (arr || []).map(v => `<option value="${v}">${v}</option>`).join('');
    };

    const apply = () => {
      const dep = depSel.value || '';
      const list = MAJOR_OPTIONS[dep];
      if (Array.isArray(list) && list.length) {
        // 文/理：使用下拉
        majorFree.style.display = 'none';
        majorSel.style.display  = '';
        fill(list);
        majorSel.value = '';      // 每次切换都要求重新选择
        majorFree.value = '';     // 清空自由输入的残留
      } else {
        // 其他：只允许自由填写
        majorSel.style.display  = 'none';
        majorFree.style.display = '';
        majorSel.innerHTML = '<option value="">选择专业</option>'; // 清空下拉
        majorSel.value = '';
        majorFree.value = '';     // 切换到“其他”时也清空
      }
    };

    apply();
    depSel.addEventListener('change', apply);
  })();

  // —— 发布对象：所属 → 专业（可不选 + 全选）——
// —— 发布对象：所属 → 专业（多选；所属=全部/未选时禁用专业）——
(function () {
  const depSel   = document.getElementById('pubDepartment');
  const majorSel = document.getElementById('pubMajor');
  if (!depSel || !majorSel) return;

  const fill = (arr) => {
    majorSel.innerHTML =
      '<option value="" disabled>（可不选，可多选）</option>' +
      (arr || []).map(v => `<option value="${v}">${v}</option>`).join('');
  };

  const disableMajor = (flag) => {
    majorSel.disabled = !!flag;
    if (flag) {
      // 清空已选
      Array.from(majorSel.options).forEach(o => o.selected = false);
    }
  };

  const apply = () => {
    const dep  = depSel.value || '';
    if (!dep || dep === '全部') {
      fill([]);              // 只保留提示行
      disableMajor(true);    // 全选/未选所属：禁用专业
      return;
    }
    const list = MAJOR_OPTIONS[dep];
    fill(Array.isArray(list) ? list : []);
    disableMajor(false);
  };

  // 关键：让多选无需按 Ctrl/⌘，点一下就切换选中
  majorSel.addEventListener('mousedown', (e) => {
    const opt = e.target;
    if (opt && opt.tagName === 'OPTION' && !opt.disabled) {
      e.preventDefault();           // 阻止原生“清空其他选项”的行为
      opt.selected = !opt.selected; // 切换选中
    }
  });

  apply();
  depSel.addEventListener('change', apply);
})();

  // API 健康检查
  setApiStatus({ok:null, text:'API 检测中'});
  try {
    const [r1, r2] = await Promise.allSettled([callAPI('testConnection'), callAPI('ping', {t: Date.now()})]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ok, text: ok ? 'API 连接成功' : 'API 连接异常'});
    if (!ok) {
      const d = $('loginError'); if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
    }
  } catch {
    setApiStatus({ok:false, text:'API 连接失败'});
    const d = $('loginError'); if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
  }

  // 移动端抽屉（≤600px 生效）
  (function(){
    const strip = document.getElementById('menuStrip');
    const aside = document.querySelector('aside');
    const main  = document.querySelector('main');
    if (!strip || !aside || !main) return;

    const mq = window.matchMedia('(max-width:600px)');
    const isOpen = () => document.body.classList.contains('mobile-menu-open');
    const refreshCal = () => { try{ const cal = window.calendar; if (cal) setTimeout(()=>cal.updateSize(), 80); }catch{}; };

    const open  = ()=>{ document.body.classList.add('mobile-menu-open'); strip.setAttribute('aria-expanded','true');  strip.querySelector('.label').textContent='收起菜单'; refreshCal(); };
    const close = ()=>{ document.body.classList.remove('mobile-menu-open'); strip.setAttribute('aria-expanded','false'); strip.querySelector('.label').textContent='展开菜单'; refreshCal(); };

    strip.addEventListener('click', (e)=>{ if (!mq.matches) return; e.stopPropagation(); isOpen() ? close() : open(); });
    main.addEventListener('click', (e)=>{ if (!mq.matches || !isOpen()) return; if (aside.contains(e.target) || strip.contains(e.target)) return; close(); });
    const onChange = () => { if (!mq.matches) close(); };
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
  })();
});
/* ===== ACT_BLOCK_STYLES: legend & booking modal & event states ===== */

/* 图例条 */
.cal-legend{
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; margin:8px 0 8px 0; padding:8px 12px;
  border:1px solid var(--border); border-radius:10px; background:#fafafa;
}
.cal-legend .legend-left{ display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
.cal-legend .legend-item{ display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#444; }
.legend-dot{
  width:10px; height:10px; border-radius:50%; display:inline-block; border:1px solid #999; box-sizing:border-box;
}
.legend-dot.dot-bookable{
  background: repeating-linear-gradient(45deg, #fff, #fff 2px, #eaeaea 2px, #eaeaea 4px);
  border-style:dashed;
}
.legend-dot.dot-booked{ background:#fbbf2455; border-color:#f59e0b; }
.legend-dot.dot-confirmed{ background:#84cc16; border-color:#65a30d; }
.cal-legend .legend-right{ display:flex; align-items:center; gap:10px; }

/* 轻开关（仅视觉，不绑定逻辑） */
.legend-toggle{ display:inline-flex; align-items:center; gap:8px; cursor:pointer; user-select:none; }
.legend-toggle input{ position:absolute; opacity:0; pointer-events:none; }
.legend-toggle .toggle-decor{
  width:36px; height:20px; border-radius:999px; background:#ddd; position:relative; transition:all .2s;
}
.legend-toggle .toggle-decor::after{
  content:""; position:absolute; left:2px; top:2px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.15); transition:all .2s;
}
.legend-toggle input:checked + .toggle-decor{ background:#cbd5e1; }
.legend-toggle input:checked + .toggle-decor::after{ transform:translateX(16px); }
.legend-toggle .toggle-label{ font-size:12px; color:#555; }

/* FullCalendar 事件视觉态（后续 JS 只需在 eventContent 上加这些类名） */
.fc .evt-bookable{
  background: repeating-linear-gradient(45deg, #fff, #fff 3px, #f4f4f4 3px, #f4f4f4 6px) !important;
  border:1px dashed #a3a3a3 !important; color:#222 !important;
}
.fc .evt-bookable--teacher{
  background: repeating-linear-gradient(45deg, #fff, #fff 3px, #f6f6f6 3px, #f6f6f6 6px) !important;
  border:1px dashed #c5c5c5 !important; color:#333 !important; opacity:.8;
}
.fc .evt-booked{ background:#fde68a !important; border:1px solid #f59e0b !important; color:#3b2f00 !important; }
.fc .evt-confirmed{ background:#86efac !important; border:1px solid #16a34a !important; color:#064e3b !important; }

/* 学生端“可预约”小贴片（仅视觉，老师端不显示） */
.fc .evt-bookable .pill-book{
  position:absolute; right:4px; bottom:2px; font-size:10px; padding:1px 6px;
  background:#fff; border:1px solid #a3a3a3; border-radius:999px; line-height:1.2;
}

/* 预约模态（仅视觉） */
.modal[hidden]{ display:none !important; }
.modal{ position:fixed; inset:0; z-index:1100; }
.modal__overlay{
  position:absolute; inset:0; background:rgba(0,0,0,.35); backdrop-filter:saturate(120%) blur(1px);
}
.modal__card{
  position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);
  width:min(420px, 92vw); background:#fff; border:1px solid var(--border); border-radius:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.12); overflow:hidden;
}
.modal__header{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:12px 14px; border-bottom:1px solid var(--border);
}
.modal__body{ padding:14px; display:flex; flex-direction:column; gap:12px; }
.modal__row{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.modal__row .modal__field{ display:flex; flex-direction:column; gap:6px; }
.modal__field label{ font-size:12px; color:#666; }
.modal__readonly{ padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:#fafafa; font-size:14px; color:#222; }
.modal__actions{
  display:flex; justify-content:flex-end; gap:10px; padding:12px 14px; border-top:1px solid var(--border);
}
.modal__close{ border:none; background:#fff; width:28px; height:28px; border-radius:6px; line-height:1; font-weight:700; }
@media (max-width:600px){
  .modal__row{ grid-template-columns:1fr; }
}
