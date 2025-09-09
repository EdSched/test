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
  const el = $('mainCalendar'); if (!el) return;
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  const cal = new FullCalendar.Calendar(el, {
    eventClick: function(info) {
  const ev = info.event;
  const ext = ev.extendedProps || {};
  const title = ev.title || '';
  const start = ev.start ? ev.start.toLocaleString('zh-CN') : '';
  const end = ev.end ? ev.end.toLocaleString('zh-CN') : '';
  const teacher = ext.teacher ? `\n任课老师：${ext.teacher}` : '';
  const slotId = ext.slotId ? `\n槽位ID：${ext.slotId}` : '';
  
  alert(`课程：${title}\n时间：${start} ~ ${end}${teacher}${slotId}`);
},
    initialView,
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
  });
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
