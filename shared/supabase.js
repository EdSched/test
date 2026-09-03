// ── Supabase client ──
const SB_URL = 'https://vwntezfvqbrkeovnseku.supabase.co';
const SB_KEY = 'sb_publishable_cUnCkti5qv1_G4N6Ho5tpw_9pr7pSas';

// 只把时间字段（time_range/start_time/end_time）里的全角冒号「：」转半角「:」
// 不碰名字/备注/文案等字段（那些用全角冒号是正常中文写法）
const _TIME_FIELDS = ['time_range','start_time','end_time'];
function _normTimeColon(v){
  if (Array.isArray(v)) return v.map(_normTimeColon);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k in v) {
      if (_TIME_FIELDS.includes(k) && typeof v[k] === 'string') o[k] = v[k].replace(/：/g, ':');
      else o[k] = _normTimeColon(v[k]);
    }
    return o;
  }
  return v;
}

async function sb(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(_normTimeColon(body));
  const r = await fetch(SB_URL + path, opts);
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

// ── Fetch all rows (bypasses 1000-row default limit) ──
async function sbAll(path) {
  const pageSize = 1000;
  let all = [], offset = 0;
  const sep = path.includes('?') ? '&' : '?';
  while (true) {
    const batch = await sb(`${path}${sep}limit=${pageSize}&offset=${offset}`);
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// ── Supabase Storage ──
// Upload a file to a public bucket, returns the public URL
async function sbUpload(bucket, path, file) {
  const url = `${SB_URL}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  return `${SB_URL}/storage/v1/object/public/${bucket}/${path}`;
}
