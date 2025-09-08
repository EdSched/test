/* =============== 精简版前端 - 仅保留登录和日历 =============== */

// 基础配置
const API_URL = 'https://script.google.com/macros/s/AKfycbwew2T6Scwk5HGbNcf4wh-gmcXyJW6YULKGHEvyNQLA5SQ-fjB_epdNbSxdbb0Se2w/exec';

// 所属 → 专业映射（用于注册）
const MAJOR_OPTIONS = {
  '理科大学院': ['机械', '电子电器', '生物化学', '情报学'],
  '文科大学院': ['文学', '历史学', '社会学', '社会福祉学', '新闻传播学', '表象文化', '经营学', '经济学', '日本语教育']
};

/* =============== 工具函数 =============== */
const $ = (id) => document.getElementById(id);

function setApiStatus({ok, text}) {
  const dotTop = $('apiDotTop'), txtTop = $('apiTextTop');
  const inline = $('apiStatusInline');
  
  if (dotTop) dotTop.className = 'api-dot ' + (ok === true ? 'ok' : ok === false ? 'err' : 'wait');
  if (txtTop) txtTop.textContent = text || (ok ? 'API 正常' : (ok === false ? 'API 连接失败' : 'API 检测中'));
  
  if (inline) {
    let dot = inline.querySelector('.api-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'api-dot wait';
      dot.style.cssText = 'display:inline-block;border-radius:50%;width:8px;height:8px;margin-right:6px;';
      inline.prepend(dot);
    }
    dot.className = 'api-dot ' + (ok === true ? 'ok' : ok === false ? 'err' : 'wait');
    const statusText = text || (ok ? ' API连接成功' : (ok === false ? ' API连接失败' : ' 正在检测 API 连接…'));
    inline.innerHTML = '';
    inline.appendChild(dot);
    inline.appendChild(document.createTextNode(statusText));
  }
}

function normalizeUser(u = {}, fallbackId = '') {
  return {
    userId: u.userId || u.username || u.id || fallbackId || '',
    name: u.name || u.realName || u.displayName || '',
    role: u.role || u.identity || '',
    department: u.department || u.affiliation || u.dept || '',
    major: u.major || u.subject || ''
  };
}

function normalizeRole(user) {
  const id = String(user.userId || '');
  const r0 = String(user.role || '').toLowerCase();
  if (r0.includes('admin') || r0.includes('管') || id.startsWith('A')) return 'admin';
  if (r0.includes('teacher') || r0.includes('师') || id.startsWith('T')) return 'teacher';
  return 'student';
}

/* =============== API 通信 =============== */
async function callAPI(action, params = {}) {
  try {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('params', JSON.stringify(params));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      mode: 'cors',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const text = await res.text();
    
    // 清理响应文本
    let clean = text.trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) clean = clean.slice(s, e + 1);
    
    return JSON.parse(clean);
  } catch (err) {
    return { success: false, message: '网络请求失败: ' + err.message };
  }
}

async function checkApiHealth() {
  setApiStatus({ok: null, text: 'API 检测中'});
  try {
    const [r1, r2] = await Promise.allSettled([
      callAPI('testConnection'),
      callAPI('ping', { t: Date.now() })
    ]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ ok, text: ok ? 'API 连接成功' : 'API 连接异常' });
    return ok;
  } catch (e) {
    setApiStatus({ ok: false, text: 'API 连接失败' });
    return false;
  }
}

/* =============== 全局状态 =============== */
let currentUser = null;
let calendar = null;
const navLinks = [];

/* =============== 登录/注册/登出 =============== */
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
  const useridInput = $('loginUserid');
  const err = $('loginError');
  
  console.log('登录函数执行，用户ID输入框:', useridInput);
  
  if (!useridInput) {
    console.error('找不到用户ID输入框 #loginUserid');
    if (err) err.textContent = '页面加载错误，请刷新重试';
    return;
  }
  
  const userid = (useridInput.value || '').trim();
  console.log('输入的用户ID:', userid);
  
  if (!userid) { 
    if (err) err.textContent = '请输入用户ID'; 
    return; 
  }
  
  err.style.color = '';
  err.textContent = '正在登录…';
  
  const r = await callAPI('loginByUserid', { userid });
  
  if (r && (r.success || r.ok)) {
    currentUser = normalizeUser(r.user, userid);
    $('loginContainer').style.display = 'none';
    $('mainApp').style.display = 'block';
    try { window.location.hash = '#app'; } catch {}
    updateUserUI();
    initCalendar();
    bindTopBarButtons();
    loadCalendarEvents();
  } else {
    err.style.color = '#c00';
    err.textContent = (r && r.message) || '登录失败：用户ID不存在';
  }
}

async function registerUser(evt) {
  evt?.preventDefault?.();
  
  const err = $('registerError');
  const name = $('registerName').value.trim();
  const email = $('registerEmail').value.trim();
  const department = $('registerDepartment').value.trim();
  const role = $('registerRole').value.trim();
  const majorSel = $('registerMajorSelect')?.value?.trim() || '';
  const majorFree = $('registerMajorFree')?.value?.trim() || '';
  const major = (department === '其他') ? majorFree : majorSel;

  // 校验
  if (!name || !email || !department || !role) {
    err.textContent = '请填写姓名、邮箱、所属、身份';
    return;
  }
  if (department === '其他' && !major) {
    err.textContent = '所属为"其他"时，请填写专业';
    return;
  }
  if (department !== '其他' && !major) {
    err.textContent = '请选择一个专业';
    return;
  }

  err.style.color = '';
  err.textContent = '正在登记…';
  
  const r = await callAPI('registerByProfile', { name, email, department, major, role });

  if (r && (r.success || r.ok)) {
    err.style.color = 'green';
    err.textContent = (role.indexOf('老师') > -1)
      ? '已完成注册，等待管理员分配用户ID'
      : '已完成注册，等待老师分配ID';
  } else {
    err.style.color = '#c00';
    err.textContent = (r && r.message) ? r.message : '登记失败（无返回信息）';
  }
}

function logout() {
  currentUser = null;
  $('mainApp').style.display = 'none';
  $('loginContainer').style.display = 'flex';
  $('loginUserid').value = '';
  $('loginError').textContent = '';
  setApiStatus({ok: null, text: 'API 检测中'});
  try { window.location.hash = '#login'; } catch {}
  checkApiHealth();
}

/* =============== 角色导航与页面切换 =============== */
function showPage(pageId) {
  // 隐藏所有页面
  document.querySelectorAll('.page-content').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  
  // 显示目标页面
  const panel = document.getElementById(pageId + 'Page');
  if (panel) {
    panel.style.display = 'block';
    panel.classList.add('active');
  }
  
  // 更新导航高亮
  navLinks.forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (active) active.classList.add('active');
  
  // 日历页面需要更新尺寸
  if (pageId === 'calendar' && window.calendar) {
    setTimeout(() => window.calendar.updateSize(), 60);
  }
}

function updateUserUI() {
  if (!currentUser) return;
  
  currentUser.roleNorm = normalizeRole(currentUser);
  $('userGreeting').textContent = '欢迎，' + (currentUser.name || currentUser.userId);
  $('userRole').textContent = '(' + (currentUser.role || '') + ')';

  // 显示对应角色的导航
  const ns = $('nav-student'), nt = $('nav-teacher'), na = $('nav-admin');
  ns && (ns.style.display = currentUser.roleNorm === 'student' ? '' : 'none');
  nt && (nt.style.display = currentUser.roleNorm === 'teacher' ? '' : 'none');
  na && (na.style.display = currentUser.roleNorm === 'admin' ? '' : 'none');

  // 激活对应导航的第一个链接
  const navRoot = currentUser.roleNorm === 'student' ? ns : (currentUser.roleNorm === 'teacher' ? nt : na);
  let firstLink = navRoot ? navRoot.querySelector('.nav-link') : null;
  
  if (firstLink) {
    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    firstLink.classList.add('active');
    showPage(firstLink.dataset.page);
  } else {
    // 兜底到日历
    showPage('calendar');
  }
}

/* =============== 日历功能 =============== */
function initCalendar() {
  const el = $('mainCalendar');
  if (!el) return;
  
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
    slotMinTime: '08:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:30:00',
    expandRows: true,
    datesSet: updateCalendarTitle,

    // 事件数据源 - 直接调用后端API
    events: async function(info, success, failure) {
      try {
        const viewStart = info.startStr ? info.startStr.slice(0, 10) : '';
        const viewEnd = info.endStr ? info.endStr.slice(0, 10) : '';
        const params = {
          userId: (currentUser && currentUser.userId) ? currentUser.userId : '',
          viewStart,
          viewEnd
        };
        
        const res = await callAPI('listVisibleSlots', params);
        const rows = Array.isArray(res) ? res : (res && res.data) ? res.data : [];
        
        success(rows);
      } catch (err) {
        failure && failure(err);
      }
    }
  });
  
  cal.render();
  window.calendar = cal;
  calendar = cal;
  setTimeout(() => { 
    try { cal.updateSize(); } catch {} 
  }, 60);
  updateCalendarTitle();
}

function updateCalendarTitle() {
  if (!calendar) return;
  
  const view = calendar.view;
  const date = calendar.getDate();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  
  if (view.type === 'timeGridDay') {
    $('calendarTitle').textContent = `${y}/${m}/${d}`;
  } else if (view.type === 'timeGridWeek') {
    const s = new Date(view.currentStart);
    const e = new Date(view.currentEnd);
    e.setDate(e.getDate() - 1);
    $('calendarTitle').textContent = `${y}/${String(s.getMonth() + 1).padStart(2, '0')}/${String(s.getDate()).padStart(2, '0')} – ${String(e.getMonth() + 1).padStart(2, '0')}/${String(e.getDate()).padStart(2, '0')}`;
  } else {
    $('calendarTitle').textContent = `${y}/${m}`;
  }
}

async function loadCalendarEvents() {
  if (!calendar) return;
  try {
    calendar.refetchEvents();
  } catch {}
}

function updateTodayStats() {
  // 简单的占位统计
  $('todayCourses').textContent = $('todayCourses').textContent || '0';
  $('todayConsultations').textContent = $('todayConsultations').textContent || '0';
  $('todayReminders').textContent = $('todayReminders').textContent || '0';
  $('attendanceRate').textContent = $('attendanceRate').textContent || '—';
}

/* =============== 顶部按钮控制 =============== */
function bindTopBarButtons() {
  $('prevBtn')?.addEventListener('click', () => {
    calendar?.prev();
    updateCalendarTitle();
  });
  
  $('todayBtn')?.addEventListener('click', () => {
    calendar?.today();
    updateCalendarTitle();
  });
  
  $('nextBtn')?.addEventListener('click', () => {
    calendar?.next();
    updateCalendarTitle();
  });

  $('dayBtn')?.addEventListener('click', (e) => {
    calendar?.changeView('timeGridDay');
    setSegActive(e.target);
    updateCalendarTitle();
  });
  
  $('weekBtn')?.addEventListener('click', (e) => {
    calendar?.changeView('timeGridWeek');
    setSegActive(e.target);
    updateCalendarTitle();
  });
  
  $('monthBtn')?.addEventListener('click', (e) => {
    calendar?.changeView('dayGridMonth');
    setSegActive(e.target);
    updateCalendarTitle();
  });

  $('refreshDataBtn')?.addEventListener('click', () => {
    calendar?.refetchEvents();
  });
}

function setSegActive(btn) {
  ['dayBtn', 'weekBtn', 'monthBtn'].forEach(id => {
    const b = $(id);
    b && b.classList.remove('active');
  });
  btn && btn.classList.add('active');
}

/* =============== 初始化 =============== */
document.addEventListener('DOMContentLoaded', async () => {
  // 导航点击事件
  document.querySelectorAll('.nav-link').forEach(link => {
    navLinks.push(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.dataset.page;
      if (pageId) showPage(pageId);
    });
  });

  // 登录/注册/退出按钮 - 简单直接的绑定
  $('loginBtn')?.addEventListener('click', login);
  $('registerBtn')?.addEventListener('click', registerUser);
  $('logoutBtn')?.addEventListener('click', logout);
  $('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  $('showLoginBtn')?.addEventListener('click', showLoginForm);
  $('loginUserid')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });

  // 注册表单：所属部门 → 专业联动
  (function() {
    const depSel = document.getElementById('registerDepartment');
    const majorSel = document.getElementById('registerMajorSelect');
    const majorFree = document.getElementById('registerMajorFree');
    if (!depSel || !majorSel || !majorFree) return;

    const fillMajorOptions = (arr) => {
      majorSel.innerHTML = 
        '<option value="">选择专业</option>' +
        (arr || []).map(v => `<option value="${v}">${v}</option>`).join('');
    };

    const updateMajorField = () => {
      const dep = depSel.value || '';
      const list = MAJOR_OPTIONS[dep];
      
      if (Array.isArray(list) && list.length) {
        // 文/理科：使用下拉选择
        majorFree.style.display = 'none';
        majorSel.style.display = '';
        fillMajorOptions(list);
        majorSel.value = '';
        majorFree.value = '';
      } else {
        // 其他：自由填写
        majorSel.style.display = 'none';
        majorFree.style.display = '';
        majorSel.innerHTML = '<option value="">选择专业</option>';
        majorSel.value = '';
        majorFree.value = '';
      }
    };

    updateMajorField();
    depSel.addEventListener('change', updateMajorField);
  })();

  // API健康检查
  setApiStatus({ok: null, text: 'API 检测中'});
  try {
    const [r1, r2] = await Promise.allSettled([
      callAPI('testConnection'),
      callAPI('ping', {t: Date.now()})
    ]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ok, text: ok ? 'API 连接成功' : 'API 连接异常'});
    
    if (!ok) {
      const loginErr = $('loginError');
      if (loginErr) {
        loginErr.style.color = '#c00';
        loginErr.textContent = '服务器连接失败，请稍后重试';
      }
    }
  } catch {
    setApiStatus({ok: false, text: 'API 连接失败'});
    const loginErr = $('loginError');
    if (loginErr) {
      loginErr.style.color = '#c00';
      loginErr.textContent = '服务器连接失败，请稍后重试';
    }
  }

  // 移动端抽屉菜单（≤600px生效）
  (function() {
    const strip = document.getElementById('menuStrip');
    const aside = document.querySelector('aside');
    const main = document.querySelector('main');
    if (!strip || !aside || !main) return;

    const mq = window.matchMedia('(max-width:600px)');
    const isOpen = () => document.body.classList.contains('mobile-menu-open');
    const refreshCalendar = () => {
      try {
        const cal = window.calendar;
        if (cal) setTimeout(() => cal.updateSize(), 80);
      } catch {}
    };

    const openMenu = () => {
      document.body.classList.add('mobile-menu-open');
      strip.setAttribute('aria-expanded', 'true');
      strip.querySelector('.label').textContent = '收起菜单';
      refreshCalendar();
    };

    const closeMenu = () => {
      document.body.classList.remove('mobile-menu-open');
      strip.setAttribute('aria-expanded', 'false');
      strip.querySelector('.label').textContent = '展开菜单';
      refreshCalendar();
    };

    strip.addEventListener('click', (e) => {
      if (!mq.matches) return;
      e.stopPropagation();
      isOpen() ? closeMenu() : openMenu();
    });

    main.addEventListener('click', (e) => {
      if (!mq.matches || !isOpen()) return;
      if (aside.contains(e.target) || strip.contains(e.target)) return;
      closeMenu();
    });

    const handleResize = () => {
      if (!mq.matches) closeMenu();
    };

    if (mq.addEventListener) {
      mq.addEventListener('change', handleResize);
    } else {
      mq.addListener(handleResize);
    }
  })();
});
