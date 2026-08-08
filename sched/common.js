/* 唯新 · 教学资源调度系统  核心库 common.js
   所有页面共用：Supabase 读写 / 时段 / 冲突检测 / 格式化 */

const SB_URL = 'https://vwntezfvqbrkeovnseku.supabase.co';
const SB_KEY = 'sb_publishable_cUnCkti5qv1_G4N6Ho5tpw_9pr7pSas';

/* ---------- Supabase REST 封装 ---------- */
function sbHeaders(extra){
  return Object.assign({
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}
async function sbGet(table, query){
  const url = SB_URL + '/rest/v1/' + table + '?' + (query || 'select=*');
  const r = await fetch(url, { headers: sbHeaders() });
  if(!r.ok) throw new Error(table + ' 读取失败: ' + r.status + ' ' + await r.text());
  return r.json();
}
async function sbInsert(table, rows){
  const r = await fetch(SB_URL + '/rest/v1/' + table, {
    method:'POST', headers: sbHeaders({ Prefer:'return=representation' }),
    body: JSON.stringify(Array.isArray(rows)? rows : [rows])
  });
  if(!r.ok) throw new Error('写入失败: ' + r.status + ' ' + await r.text());
  return r.json();
}
async function sbUpdate(table, id, patch){
  const r = await fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method:'PATCH', headers: sbHeaders({ Prefer:'return=representation' }),
    body: JSON.stringify(patch)
  });
  if(!r.ok) throw new Error('更新失败: ' + r.status + ' ' + await r.text());
  return r.json();
}
async function sbDelete(table, id){
  const r = await fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method:'DELETE', headers: sbHeaders()
  });
  if(!r.ok) throw new Error('删除失败: ' + r.status + ' ' + await r.text());
  return true;
}

/* ---------- 常量 ---------- */
const CAMPUSES   = ['高马','市谷'];
const CATEGORIES = ['学部文科','学部理科','语言','大学院文科','大学院理科'];
const WEEKDAYS   = ['','周一','周二','周三','周四','周五','周六','周日'];
const WD_MAP = {'周一':1,'周二':2,'周三':3,'周四':4,'周五':5,'周六':6,'周日':7,'周天':7,
  '星期一':1,'星期二':2,'星期三':3,'星期四':4,'星期五':5,'星期六':6,'星期日':7,'星期天':7,
  '礼拜一':1,'礼拜二':2,'礼拜三':3,'礼拜四':4,'礼拜五':5,'礼拜六':6,'礼拜日':7,
  '1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7};
// 解析 "周二/周四"、"周二、周四"、"2,4" 等 -> [2,4]（去重升序）
function parseWeekdays(s){
  if(s==null || s==='') return [];
  const arr = String(s).split(/[\/、,，\s;；]+/).map(x=>WD_MAP[x.trim()]).filter(Boolean);
  return [...new Set(arr)].sort((a,b)=>a-b);
}
function weekdaysLabel(str){ // "2,4" -> "周二/周四"
  return String(str||'').split(',').filter(Boolean).map(d=>WEEKDAYS[Number(d)]).join('/');
}
const KIND_LABEL = { course:'排课', vip:'VIP', temp:'临时使用', rental:'对外出租', meeting:'开会' };
const KIND_CLASS = { course:'k-course', vip:'k-vip', temp:'k-temp', rental:'k-rental', meeting:'k-meeting' };

/* 30 分钟时段：08:00 ~ 22:00 */
const SLOTS = (function(){
  const a=[]; for(let m=8*60; m<22*60; m+=30){
    const h=String(Math.floor(m/60)).padStart(2,'0'), mm=String(m%60).padStart(2,'0');
    a.push(h+':'+mm);
  } return a;
})();
function slotEnd(t){ // 某 30 分格的结束时刻
  const [h,m]=t.split(':').map(Number); let x=h*60+m+30;
  return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');
}

/* ---------- 日期/时间工具 ---------- */
function todayStr(){ const d=new Date(); return d.toISOString().slice(0,10); }
function weekdayOf(dateStr){ // 1=周一...7=周日
  const d=new Date(dateStr+'T00:00:00'); const w=d.getDay(); return w===0?7:w;
}
function overlap(aS,aE,bS,bE){ return aS < bE && bS < aE; } // 时间字符串区间是否重叠

/* 日期加减 / 相差天数 */
function addDays(dateStr, n){
  const d=new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function diffDays(a, b){ // b - a，天
  return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/86400000);
}
/* 按开课月份归期 */
function termOf(dateStr){
  if(!dateStr) return '';
  const [y,m]=dateStr.split('-').map(Number);
  const s = m<=3?1 : m<=6?4 : m<=9?7 : 10;
  return y+'年'+s+'月期';
}
/* 时长（分钟） */
function durationMin(s,e){ const p=t=>{const[a,b]=t.split(':').map(Number);return a*60+b;}; return p(e)-p(s); }

/* 就近空档：同教室当天其他空时段 + 前后 N 天同时段空的日期 */
function findNearby(bookings, roomId, dateStr, s, e, days){
  days = days||5;
  const dur = durationMin(s,e);
  const occupied = (d, ss, ee) => bookings.some(b =>
    b.status!=='pending' && String(b.room_id)===String(roomId) &&
    bookingOnDate(b, d) && overlap(ss, ee, b.start_time, b.end_time));
  // 当天其他空时段（按开始时刻找能放下 dur 的连续空档起点）
  const sameDay=[];
  for(const st of SLOTS){
    const stMin=(()=>{const[a,b]=st.split(':').map(Number);return a*60+b;})();
    const etMin=stMin+dur; if(etMin>22*60) break;
    const et=String(Math.floor(etMin/60)).padStart(2,'0')+':'+String(etMin%60).padStart(2,'0');
    if(st===s) continue;
    if(!occupied(dateStr, st, et)) sameDay.push(st+'-'+et);
  }
  // 前后 N 天同时段
  const nearDates=[];
  for(let off=1; off<=days; off++){
    for(const d of [addDays(dateStr,off), addDays(dateStr,-off)]){
      if(!occupied(d, s, e)) nearDates.push({date:d, off});
    }
  }
  nearDates.sort((a,b)=>Math.abs(a.off)-Math.abs(b.off));
  return { sameDay: sameDay.slice(0,6), nearDates: nearDates.slice(0,6) };
}

/* 某 booking 在指定日期是否生效 */
function bookingOnDate(b, dateStr){
  if(b.recurrence === 'weekly'){
    if(b.start_date && dateStr < b.start_date) return false;
    if(b.end_date   && dateStr > b.end_date)   return false;
    return Number(b.weekday) === weekdayOf(dateStr);
  }
  return b.booking_date === dateStr;
}

/* ---------- 冲突检测 ---------- */
// 教室冲突：同教室、同日期、时间重叠（排除自身）
function roomConflicts(bookings, roomId, dateStr, s, e, excludeId){
  return bookings.filter(b =>
    b.id !== excludeId && b.status !== 'pending' &&
    String(b.room_id) === String(roomId) &&
    bookingOnDate(b, dateStr) && overlap(s, e, b.start_time, b.end_time));
}
// 账号冲突：同账号、同日期、时间重叠（排除自身）
function accountConflicts(bookings, accId, dateStr, s, e, excludeId){
  return bookings.filter(b =>
    b.id !== excludeId && b.status !== 'pending' &&
    b.uses_meeting && String(b.meeting_account_id) === String(accId) &&
    bookingOnDate(b, dateStr) && overlap(s, e, b.start_time, b.end_time));
}

/* ---------- DOM 小工具 ---------- */
function el(id){ return document.getElementById(id); }
function opt(v, t){ const o=document.createElement('option'); o.value=v; o.textContent=t??v; return o; }
function fillSelect(sel, arr, valFn, txtFn, placeholder){
  sel.innerHTML='';
  if(placeholder) sel.appendChild(opt('', placeholder));
  arr.forEach(x => sel.appendChild(opt(valFn?valFn(x):x, txtFn?txtFn(x):x)));
}
function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function toast(msg, ok){ // 顶部临时提示
  let t=el('__toast'); if(!t){ t=document.createElement('div'); t.id='__toast';
    t.style.cssText='position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;'+
      'padding:9px 16px;border-radius:6px;color:#fff;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.15)';
    document.body.appendChild(t); }
  t.style.background = ok===false ? '#d93025' : '#0f9d58';
  t.textContent = msg; t.style.opacity='1';
  clearTimeout(t.__h); t.__h=setTimeout(()=>{ t.style.opacity='0'; }, 2600);
}

/* ---------- 口令校验（entry / admin 页共用）---------- */
async function checkCode(code, needRole){
  const rows = await sbGet('sched_access_codes',
    'select=*&code=eq.'+encodeURIComponent(code)+'&active=eq.true');
  if(!rows.length) return null;
  const rec = rows[0];
  if(needRole === 'entry') return (rec.role==='entry'||rec.role==='admin') ? rec : null;
  if(needRole === 'admin') return rec.role==='admin' ? rec : null;
  return rec;
}

/* ---------- 顶部导航（各页统一注入）---------- */
function renderNav(active){
  const items = [
    ['index.html','首页'],['board.html','教室看板'],['timetable.html','学生课表'],
    ['booking.html','教室预约'],['meeting.html','会议账号'],
    ['entry.html','录入'],['admin.html','管理']
  ];
  return '<header class="top"><div class="wrap"><h1>唯新 · 教学资源调度</h1><nav>'+
    items.map(([h,t])=>`<a href="${h}"${h===active?' style="color:var(--blue);font-weight:600"':''}>${t}</a>`).join('')+
    '</nav></div></header>';
}
