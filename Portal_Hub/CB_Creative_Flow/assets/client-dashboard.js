'use strict';

/* ===== AUTH GUARD ===== */
let user;
try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch(e) { user = null; }
if (!user || !user.role) { location.replace('login.html'); }
if (user && user.role !== 'client') { location.replace('dashboard.html'); }
document.body.setAttribute('data-user-role', user ? user.role : '');

/* ===== PUBLIC STATUS MAP ===== */
const PUB_STATUS = {
  pending:       { label: 'Đã nhận yêu cầu',            cls: 's--pending' },
  checking:      { label: 'Đang kiểm tra thông tin',     cls: 's--checking' },
  needinfo:      { label: 'Cần bổ sung brief',           cls: 's--needinfo' },
  confirmed:     { label: 'Đã tiếp nhận',                cls: 's--confirmed' },
  received:      { label: 'Đang xử lý',                  cls: 's--inprogress' },
  inprogress:    { label: 'Đang sản xuất',               cls: 's--inprogress' },
  review:        { label: 'Đang kiểm tra nội bộ',        cls: 's--review' },
  revision:      { label: 'Đang hoàn thiện',             cls: 's--revision' },
  feedback_wait: { label: 'Chờ phản hồi từ bạn',        cls: 's--feedback-wait' },
  feedback_fix:  { label: 'Đang chỉnh sửa theo phản hồi',cls: 's--revision' },
  ready:         { label: 'Sắp bàn giao',                cls: 's--ready' },
  delivered:     { label: 'Đã bàn giao',                 cls: 's--delivered' },
  completed:     { label: 'Hoàn thành',                  cls: 's--completed' },
  paused:        { label: 'Tạm dừng',                    cls: 's--paused' },
  cancelled:     { label: 'Đã hủy',                      cls: 's--cancelled' },
};

const PUB_PROGRESS = {
  pending:10, checking:15, needinfo:15, confirmed:20,
  received:30, inprogress:50, review:75, revision:75,
  feedback_wait:90, feedback_fix:85, ready:90, delivered:95,
  completed:100, paused:0, cancelled:0,
};

const TL_STAGES = [
  { label:'Đã nhận',           statuses:['pending','checking','needinfo'] },
  { label:'Đã tiếp nhận',      statuses:['confirmed'] },
  { label:'Đang xử lý',        statuses:['received','inprogress','revision','feedback_fix'] },
  { label:'Kiểm tra nội bộ',   statuses:['review','feedback_wait','ready'] },
  { label:'Đã bàn giao',       statuses:['delivered'] },
  { label:'Hoàn thành',        statuses:['completed'] },
];

const STAR_LABELS = ['','Rất không hài lòng','Không hài lòng','Bình thường','Hài lòng','Rất hài lòng'];

/* ===== MOCK DATA ===== */
const ORDERS = [
  { id:'MEDIA-2026-0001', name:'Video Recap Khai giảng Tháng 3',  type:'Video',    category:'Video Event',     date:'18/03/2026', deadline:'28/03/2026', status:'inprogress',    pic:'Duy',        preview_link:'', final_link:'', rating:null, rating_comment:'', need_info:'' },
  { id:'MEDIA-2026-0008', name:'Backdrop Summer Campaign 2026',   type:'Thiết kế', category:'POSM/Backdrop',   date:'10/03/2026', deadline:'28/03/2026', status:'needinfo',      pic:'Vinh',       preview_link:'', final_link:'', rating:null, rating_comment:'', need_info:'Kích thước backdrop (W×H cm), CTA chính hiển thị, link ảnh sản phẩm chất lượng cao.' },
  { id:'MEDIA-2026-0015', name:'Key Visual IELTS Q3',             type:'Thiết kế', category:'Key Visual',      date:'05/04/2026', deadline:'20/04/2026', status:'feedback_wait', pic:'Linh Chi',   preview_link:'https://drive.google.com/file/preview-kv-q3', final_link:'', rating:null, rating_comment:'', need_info:'' },
  { id:'MEDIA-2026-0019', name:'Motion Logo CB Centres',          type:'Motion',   category:'Motion/Animation',date:'18/04/2026', deadline:'05/05/2026', status:'delivered',     pic:'Đức Anh',    preview_link:'https://drive.google.com/file/preview-motion', final_link:'https://drive.google.com/file/final-motion', rating:null, rating_comment:'', need_info:'' },
  { id:'MEDIA-2026-0022', name:'Social Post IELTS Tháng 5',       type:'Thiết kế', category:'Social Post',     date:'25/04/2026', deadline:'01/05/2026', status:'completed',     pic:'Linh Chi',   preview_link:'https://drive.google.com/file/preview-sp', final_link:'https://drive.google.com/file/final-sp', rating:4, rating_comment:'Thiết kế đúng brief, bàn giao nhanh và chuyên nghiệp.', need_info:'' },
  { id:'MEDIA-2026-0025', name:'Thumbnail Pack Học bổng 2026',    type:'Thiết kế', category:'Thumbnail',       date:'03/05/2026', deadline:'15/05/2026', status:'confirmed',     pic:'Mai Phương', preview_link:'', final_link:'', rating:null, rating_comment:'', need_info:'' },
];

// Notifications — load từ Supabase notifications table khi Supabase enabled,
// fallback empty array khi off. Real-time push qua channel notif-{uid}.
let NOTIFS = [];

// Map Supabase notification.type → client UI type (cho ACT_MAP button rendering)
const NOTIF_TYPE_UI_MAP = {
  order_needinfo:        'needinfo',
  order_confirmed:       'confirmed',
  order_status_changed:  'confirmed',
  order_new:             'confirmed',
  delivery_preview:      'preview',
  delivery_final:        'rating',
  rating_received:       'rating',
  order_cancelled:       'cancelled',
  task_assigned:         'confirmed',
  system:                'system'
};

// Minimal line icons cho notification — ĐỒNG BỘ với internal bell (app.js NOTIF_ICON_PATHS),
// key theo raw_type (Supabase notification.type) để client thấy cùng icon như account nội bộ.
const NOTIF_ICON_PATHS = {
  order_new:            '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  order_status_changed: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  order_confirmed:      '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  order_needinfo:       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  order_cancelled:      '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  task_assigned:        '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  task_status_changed:  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  task_comment:         '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  delivery_preview:     '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  delivery_final:       '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  rating_received:      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  system:               '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
};
function notifIcon(rawType) {
  const inner = NOTIF_ICON_PATHS[rawType] || NOTIF_ICON_PATHS.system;
  let cls = '';
  if (rawType === 'order_new' || rawType === 'task_assigned') cls = 'is-accent';
  else if (rawType === 'order_cancelled' || rawType === 'order_needinfo') cls = 'is-danger';
  return { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`, cls };
}
// Bỏ emoji/ký hiệu dẫn đầu trong title cũ (✅ 🔎 ❌ 📥 …) — icon giờ render bằng SVG.
function stripNotifEmoji(s) {
  return String(s ?? '').replace(/^[\p{Extended_Pictographic}☀-➿⬀-⯿️‍\s]+/u, '').trim();
}

// Format Supabase timestamptz → "DD/MM/YYYY HH:MM"
function formatNotifTime(s) {
  if (!s) return '';
  try {
    const d = new Date(typeof s === 'string' ? s.replace(' ', 'T') : s);
    if (isNaN(d.getTime())) return s;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) { return s; }
}

// Adapter: Supabase notification row → client NOTIFS shape
function mapNotifFromSupabase(n) {
  return {
    id: n.id,
    type: NOTIF_TYPE_UI_MAP[n.type] || 'system',
    raw_type: n.type,
    order_id: n.related_entity_id || '',
    title: n.title || '',
    message: n.message || '',
    link: n.link || '',
    time: formatNotifTime(n.created_at),
    read: !!n.is_read
  };
}

/* ===== STATE ===== */
const state = {
  activeTab: 'overview',
  ordersSearch: '',
  ordersFilterStatus: '',
  ordersFilterType: '',
  ordersSort: 'date_desc',
  openOrderId: null,
  ratingOrderId: null,
  feedbackOrderId: null,
  infoOrderId: null,
  ratings: {},
  notifRead: new Set(),
};

ORDERS.forEach(o => { if (o.rating) state.ratings[o.id] = { score: o.rating, comment: o.rating_comment }; });
NOTIFS.filter(n => n.read).forEach(n => state.notifRead.add(n.id));

// Phase 1: expose mock array để cross-page reference (Master Dashboard funnel...)
window.MH_MOCK_CLIENT_ORDERS = ORDERS;
window.MH_MOCK_CLIENT_NOTIFS = NOTIFS;

/* ===== Load notifications thật của client từ Supabase ===== */
async function loadNotificationsFromStore() {
  if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return null;
  try {
    await window.MH.supabaseReady;
    const remote = await window.MH.store.notifications.listAll(50);
    if (!Array.isArray(remote)) return null;
    // Always replace khi Supabase enabled (DB là source of truth)
    NOTIFS.length = 0;
    remote.forEach((n) => NOTIFS.push(mapNotifFromSupabase(n)));
    // Re-seed state.notifRead từ data thật
    state.notifRead = new Set();
    NOTIFS.filter((n) => n.read).forEach((n) => state.notifRead.add(n.id));
    return NOTIFS.length;
  } catch (e) { console.warn('[client-dashboard] load notifications failed:', e); return null; }
}

/* ===== Realtime subscribe — push notification INSERT vào NOTIFS ===== */
function startNotificationsRealtime() {
  if (!window.MH || !window.MH.supabase || !window.MH.supabaseEnabled || !user || !user.id) return;
  try {
    const channel = window.MH.supabase
      .channel('notif-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'user_id=eq.' + user.id
      }, (payload) => {
        const mapped = mapNotifFromSupabase(payload.new);
        // Prepend tới NOTIFS (mới nhất ở đầu)
        NOTIFS.unshift(mapped);
        // Auto-render notification tab nếu đang ở đó
        if (typeof renderNotifications === 'function') renderNotifications();
        // Toast popup ngay khi có notification mới
        if (window.MH && window.MH.toast) {
          window.MH.toast({
            type: 'info',
            title: stripNotifEmoji(mapped.title) || 'Thông báo mới',
            message: mapped.message || '',
            duration: 6000
          });
        }
      })
      .subscribe();
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      try { window.MH.supabase.removeChannel(channel); } catch (e) {}
    });
  } catch (err) { console.warn('[client-dashboard] realtime subscribe failed:', err); }
}

/* ===== Phase 1 — Load orders thật của client từ Supabase ===== */
async function loadClientOrdersFromStore() {
  if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled || !user) return null;
  try {
    await window.MH.supabaseReady;
    // Lọc theo requester_id (uuid) trước, fallback requester_email
    let remote = [];
    if (user.id) {
      remote = await window.MH.store.orders.list({ requester_id: user.id });
    }
    if ((!remote || remote.length === 0) && user.email) {
      remote = await window.MH.store.orders.list({ requester_email: user.email });
    }
    if (!Array.isArray(remote)) remote = [];
    // Always replace khi Supabase enabled (kể cả empty) — DB là source of truth.

    const TYPE_LABEL = { design: 'Thiết kế', digital: 'Digital', video: 'Video', motion: 'Motion', shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads', slide: 'Slide' };
    function fmtDate(s) {
      if (!s) return '—';
      const d = new Date(s.replace ? s.replace(' ', 'T') : s);
      if (isNaN(d.getTime())) return s;
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }
    // Adapter map Supabase order shape → client-dashboard.ORDERS shape
    const mapped = remote.map(function (o) {
      const effStatus = (o.production_status && o.production_status !== 'unassigned') ? o.production_status : o.account_status;
      return {
        id: o.order_id,
        name: o.project_name || '—',
        type: TYPE_LABEL[o.request_type] || o.request_type || '—',
        category: (o.deliverable_type && o.deliverable_type[0]) || (TYPE_LABEL[o.request_type] || '—'),
        date: fmtDate(o.created_at),
        deadline: fmtDate(o.requested_deadline),
        status: effStatus || 'pending',
        pic: o.production_pic || o.account_pic || '',
        preview_link: o.preview_link || '',
        final_link: o.final_delivery_link || '',
        rating: o.satisfaction_score || null,
        rating_comment: o.client_feedback || '',
        need_info: o.account_status === 'needinfo' ? (o.internal_note || 'Vui lòng bổ sung brief — liên hệ Account team.') : '',
        request_type: o.request_type || '',
        shoot_location: o.shoot_location || '',
        __raw: o
      };
    });
    // Replace ORDERS content (giữ reference cho code khác)
    ORDERS.length = 0;
    mapped.forEach(function (m) { ORDERS.push(m); });
    // Re-seed state.ratings từ data thật
    state.ratings = {};
    ORDERS.forEach(function (o) { if (o.rating) state.ratings[o.id] = { score: o.rating, comment: o.rating_comment }; });
    return mapped.length;
  } catch (e) { console.warn('[client-dashboard] load remote failed:', e); return null; }
}

/* ===== HELPERS ===== */
function pubStatus(o) { return PUB_STATUS[o.status] || { label: o.status, cls: '' }; }
function pubProgress(o) { return PUB_PROGRESS[o.status] ?? 0; }

function starHtml(n) {
  return Array.from({length:5}, (_,i) =>
    `<span style="color:${i<n?'var(--warning)':'var(--surface-3)'}">${i<n?'★':'☆'}</span>`
  ).join('');
}

function tlHtml(status) {
  let curIdx = -1;
  TL_STAGES.forEach((s,i) => { if (s.statuses.includes(status)) curIdx = i; });
  const isDone = status === 'completed';
  return TL_STAGES.map((s,i) => {
    const done = i < curIdx || (i === curIdx && isDone);
    const cur  = i === curIdx && !isDone;
    const cls  = done ? 'done' : cur ? 'current' : '';
    const dot  = done ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : '';
    return `<div class="pub-tl-step ${cls}"><div class="pub-tl-dot">${dot}</div><div class="pub-tl-label">${s.label}</div></div>`;
  }).join('');
}

/* ===== RENDER: KPIs ===== */
function renderKPIs() {
  const total      = ORDERS.length;
  const inProgress = ORDERS.filter(o => ['pending','checking','confirmed','received','inprogress','review','revision','feedback_fix','ready'].includes(o.status)).length;
  const needInfo   = ORDERS.filter(o => o.status === 'needinfo').length;
  const awaitFb    = ORDERS.filter(o => o.status === 'feedback_wait').length;
  const delivered  = ORDERS.filter(o => ['delivered','completed'].includes(o.status)).length;
  const noRating   = ORDERS.filter(o => ['delivered','completed'].includes(o.status) && !state.ratings[o.id]).length;

  const ICONS = {
    list:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    loader:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
    alert:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    star:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  };

  const cards = [
    { label:'Tổng yêu cầu',       value:total,      icon:'list',    color:'var(--primary)', filter:'' },
    { label:'Đang xử lý',         value:inProgress, icon:'loader',  color:'var(--info)',    filter:'active' },
    { label:'Cần bổ sung brief',   value:needInfo,   icon:'alert',   color:'var(--warning)', filter:'needinfo' },
    { label:'Chờ phản hồi',        value:awaitFb,    icon:'message', color:'var(--info)',    filter:'feedback' },
    { label:'Đã bàn giao',         value:delivered,  icon:'check',   color:'var(--success)', filter:'delivered' },
    { label:'Chưa đánh giá',       value:noRating,   icon:'star',    color:'var(--warning)', filter:'no_rating' },
  ];

  document.getElementById('kpi-grid').innerHTML = cards.map(c => `
    <div class="kpi-card" data-kpi-filter="${c.filter}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div style="color:${c.color};margin-top:var(--space-2)">${ICONS[c.icon]}</div>
    </div>`
  ).join('');

  document.getElementById('kpi-grid').querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('click', () => {
      switchTab('orders');
      const f = card.dataset.kpiFilter;
      const sel = document.getElementById('orders-filter-status');
      sel.value = f === 'no_rating' ? '' : (f || '');
      state.ordersFilterStatus = sel.value;
      renderOrdersTable();
    });
  });
}

/* ===== RENDER: ACTION CENTER ===== */
function renderActionCenter() {
  const actions = [];
  ORDERS.forEach(o => {
    if (o.status === 'needinfo') actions.push({ type:'needinfo', order:o });
    if (o.status === 'feedback_wait') actions.push({ type:'preview', order:o });
    if (['delivered','completed'].includes(o.status) && !state.ratings[o.id]) actions.push({ type:'rating', order:o });
  });

  const count = actions.length;
  const badge = document.getElementById('ac-count');
  badge.textContent = count;
  badge.style.display = count > 0 ? '' : 'none';

  const container = document.getElementById('action-cards-container');
  if (count === 0) {
    container.innerHTML = `<div class="ac-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <p>Không có hành động nào cần bạn xử lý lúc này.<br>Team Media đang tiếp tục xử lý các yêu cầu của bạn.</p>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="action-cards">${actions.map(a => {
    const o = a.order;
    if (a.type === 'needinfo') return `
      <div class="action-card ac--needinfo">
        <div class="action-card-head">
          <div class="action-card-icon ai--needinfo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div><div class="action-card-title">Cần bổ sung brief</div><div class="action-card-order">${o.id}</div></div>
        </div>
        <p>${o.name} — Team Media cần thêm thông tin để tiếp tục xử lý.</p>
        <div class="action-card-btns">
          <button class="btn btn-sm" style="background:var(--warning);color:#fff" data-action="needinfo" data-order-id="${o.id}">Bổ sung ngay</button>
          <button class="btn btn-secondary btn-sm" data-action="open-order" data-order-id="${o.id}">Xem chi tiết</button>
        </div>
      </div>`;
    if (a.type === 'preview') return `
      <div class="action-card ac--preview">
        <div class="action-card-head">
          <div class="action-card-icon ai--preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
          <div><div class="action-card-title">Bản preview chờ duyệt</div><div class="action-card-order">${o.id}</div></div>
        </div>
        <p>${o.name} — Đã có bản xem trước để bạn kiểm tra và phản hồi.</p>
        <div class="action-card-btns">
          ${o.preview_link ? `<a class="btn btn-sm" style="background:var(--info);color:#fff" href="${o.preview_link}" target="_blank" rel="noopener">Xem preview</a>` : ''}
          <button class="btn btn-secondary btn-sm" data-action="feedback" data-order-id="${o.id}">Gửi phản hồi</button>
        </div>
      </div>`;
    if (a.type === 'rating') return `
      <div class="action-card ac--rating">
        <div class="action-card-head">
          <div class="action-card-icon ai--rating"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
          <div><div class="action-card-title">Chưa đánh giá</div><div class="action-card-order">${o.id}</div></div>
        </div>
        <p>${o.name} — Sản phẩm đã bàn giao. Hãy đánh giá để team cải thiện chất lượng.</p>
        <div class="action-card-btns">
          ${o.final_link ? `<a class="btn btn-secondary btn-sm" href="${o.final_link}" target="_blank" rel="noopener">Xem final</a>` : ''}
          <button class="btn btn-sm" style="background:var(--success);color:#fff" data-action="rating" data-order-id="${o.id}">Đánh giá ngay</button>
        </div>
      </div>`;
    return '';
  }).join('')}</div>`;
}

/* ===== RENDER: CURRENT ORDERS ===== */
function renderCurrentOrders() {
  const active = ORDERS.filter(o => !['completed','cancelled'].includes(o.status));
  const grid = document.getElementById('current-orders-grid');
  if (active.length === 0) {
    grid.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-muted)">Không có yêu cầu nào đang xử lý.</p>`;
    return;
  }
  grid.innerHTML = active.map(o => {
    const st = pubStatus(o);
    const pg = pubProgress(o);
    return `
      <div class="co-card" data-action="open-order" data-order-id="${o.id}">
        <div class="co-card-head">
          <div>
            <div class="co-card-id">${o.id}</div>
            <div class="co-card-name">${o.name}</div>
          </div>
          <span class="tb-status ${st.cls}">${st.label}</span>
        </div>
        <div class="co-card-meta">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${o.type}</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>HSD ${o.deadline}</span>
        </div>
        <div>
          <div class="co-progress-bar"><div class="co-progress-fill" style="width:${pg}%"></div></div>
          <div class="co-progress-label"><span>${st.label}</span><span>${pg}%</span></div>
        </div>
        <div class="co-card-foot">
          <span style="font-size:var(--text-xs);color:var(--text-muted)">PIC: ${o.pic}</span>
          <span style="font-size:var(--text-xs);color:var(--primary);font-weight:600">Chi tiết →</span>
        </div>
      </div>`;
  }).join('');
}

/* ===== RENDER: ORDERS TABLE ===== */
function getFilteredOrders() {
  let list = [...ORDERS];
  const s = state.ordersSearch.toLowerCase();
  if (s) list = list.filter(o => o.id.toLowerCase().includes(s) || o.name.toLowerCase().includes(s));
  const fs = state.ordersFilterStatus;
  if (fs === 'active')    list = list.filter(o => !['completed','cancelled','delivered'].includes(o.status));
  else if (fs === 'needinfo')  list = list.filter(o => o.status === 'needinfo');
  else if (fs === 'feedback')  list = list.filter(o => o.status === 'feedback_wait');
  else if (fs === 'delivered') list = list.filter(o => ['delivered','completed'].includes(o.status));
  else if (fs === 'completed') list = list.filter(o => o.status === 'completed');
  if (state.ordersFilterType) list = list.filter(o => o.type === state.ordersFilterType);
  const PRIO = ['needinfo','feedback_wait','delivered','inprogress','review','confirmed','received','pending','completed','cancelled'];
  if (state.ordersSort === 'date_desc') list.sort((a,b) => b.id.localeCompare(a.id));
  else if (state.ordersSort === 'date_asc') list.sort((a,b) => a.id.localeCompare(b.id));
  else if (state.ordersSort === 'status') list.sort((a,b) => PRIO.indexOf(a.status) - PRIO.indexOf(b.status));
  return list;
}

function renderOrdersTable() {
  const list = getFilteredOrders();
  const activeCount = ORDERS.filter(o => !['completed','cancelled'].includes(o.status)).length;

  document.getElementById('orders-count-label').textContent = `${list.length} yêu cầu`;
  document.getElementById('nav-active-count').textContent = activeCount;
  const badge = document.getElementById('tab-orders-badge');
  badge.textContent = activeCount;
  badge.style.display = activeCount > 0 ? '' : 'none';

  document.getElementById('orders-tbody').innerHTML = list.map(o => {
    const st = pubStatus(o);
    const rt = state.ratings[o.id];
    const ratingCell = rt
      ? `<span style="color:var(--warning)">${starHtml(rt.score)}</span>`
      : (['delivered','completed'].includes(o.status)
        ? `<button class="btn btn-ghost btn-sm" data-action="rating" data-order-id="${o.id}" style="font-size:10px;padding:2px 8px">Đánh giá</button>`
        : '—');
    return `
      <tr style="cursor:pointer" data-action="open-order" data-order-id="${o.id}">
        <td class="mono text-xs">${o.id}</td>
        <td><b>${o.name}</b><br><span class="text-xs muted">${o.category}</span></td>
        <td class="text-sm">${o.type}</td>
        <td class="text-xs muted">${o.date}</td>
        <td class="text-xs">${o.deadline}</td>
        <td><span class="tb-status ${st.cls}">${st.label}</span></td>
        <td>${ratingCell}</td>
        <td><button class="btn btn-ghost btn-sm" data-action="open-order" data-order-id="${o.id}">Chi tiết</button></td>
      </tr>`;
  }).join('');
}

/* ===== RENDER: NOTIFICATIONS ===== */
function renderNotifications() {
  const unread = NOTIFS.filter(n => !state.notifRead.has(n.id)).length;
  const tbadge = document.getElementById('tab-notif-badge');
  tbadge.textContent = unread;
  tbadge.style.display = unread > 0 ? '' : 'none';
  document.getElementById('nav-notif-count').textContent = unread > 0 ? unread : '—';
  document.getElementById('notif-dot').style.display = unread > 0 ? '' : 'none';

  const ACT_MAP = {
    needinfo:  { label:'Bổ sung ngay',  action:'needinfo' },
    preview:   { label:'Xem preview',   action:'preview' },
    rating:    { label:'Đánh giá ngay', action:'rating' },
    confirmed: { label:'Xem chi tiết',  action:'open-order' },
    completed: { label:'Xem chi tiết',  action:'open-order' },
  };

  document.getElementById('notif-list').innerHTML = NOTIFS.map(n => {
    const isRead = state.notifRead.has(n.id);
    const act = ACT_MAP[n.type];
    const ic = notifIcon(n.raw_type);
    return `
      <div class="notif-item ${isRead ? '' : 'unread'}" data-action="open-order" data-order-id="${n.order_id}" data-notif-id="${n.id}">
        <div class="notif-ico ${ic.cls}">${ic.svg}</div>
        <div class="notif-body">
          <div class="notif-title">${stripNotifEmoji(n.title)}</div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${n.time}</div>
        </div>
        <div class="notif-action">
          ${act ? `<button class="btn btn-secondary btn-sm" data-action="${act.action}" data-order-id="${n.order_id}" data-notif-id="${n.id}">${act.label}</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ===== RENDER: ORDER DRAWER ===== */
function openOrderDrawer(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  state.openOrderId = orderId;
  const st = pubStatus(o);
  const pg = pubProgress(o);
  const rt = state.ratings[o.id];

  document.getElementById('dr-order-id').textContent = o.id;
  document.getElementById('dr-order-name').textContent = o.name;

  // Action block
  let actionBlock = '';
  if (o.status === 'needinfo') {
    actionBlock = `<div class="drawer-detail-section"><h4>Cần bổ sung</h4>
      <div style="padding:var(--space-4);background:rgb(245 158 11 / .1);border-radius:var(--radius);border-left:3px solid var(--warning)">
        <p style="font-size:var(--text-sm);margin:0 0 var(--space-2)">Team Media cần bạn bổ sung thêm thông tin để tiếp tục xử lý:</p>
        <p style="font-size:var(--text-sm);color:var(--text-muted);margin:0">${o.need_info}</p>
        <button class="btn btn-sm" style="margin-top:var(--space-3);background:var(--warning);color:#fff" data-action="needinfo" data-order-id="${o.id}">Bổ sung ngay</button>
      </div></div>`;
  } else if (o.status === 'feedback_wait') {
    actionBlock = `<div class="drawer-detail-section"><h4>Chờ phản hồi</h4>
      <div style="padding:var(--space-4);background:rgb(14 165 233 / .1);border-radius:var(--radius);border-left:3px solid var(--info)">
        <p style="font-size:var(--text-sm);margin:0 0 var(--space-3)">Bạn có bản preview cần kiểm tra và phản hồi.</p>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          ${o.preview_link ? `<a class="btn btn-sm" style="background:var(--info);color:#fff" href="${o.preview_link}" target="_blank" rel="noopener">Xem preview</a>` : ''}
          <button class="btn btn-secondary btn-sm" data-action="feedback" data-order-id="${o.id}">Gửi phản hồi</button>
        </div>
      </div></div>`;
  } else if (['delivered','completed'].includes(o.status) && !rt) {
    actionBlock = `<div class="drawer-detail-section"><h4>Đánh giá sản phẩm</h4>
      <div style="padding:var(--space-4);background:rgb(22 163 74 / .1);border-radius:var(--radius);border-left:3px solid var(--success)">
        <p style="font-size:var(--text-sm);margin:0 0 var(--space-3)">Sản phẩm đã bàn giao. Vui lòng đánh giá mức độ hài lòng.</p>
        <button class="btn btn-sm" style="background:var(--success);color:#fff" data-action="rating" data-order-id="${o.id}">Đánh giá ngay</button>
      </div></div>`;
  }

  // Files block
  let filesBlock = '';
  if (o.preview_link || o.final_link) {
    filesBlock = `<div class="drawer-detail-section"><h4>File bàn giao</h4>
      ${o.preview_link ? `<div class="file-panel">
        <div class="file-panel-icon" style="color:var(--info)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
        <div class="file-panel-info"><b>Bản xem trước (Preview)</b><span>Kiểm tra và phản hồi</span></div>
        <a class="btn btn-secondary btn-sm" href="${o.preview_link}" target="_blank" rel="noopener">Mở</a>
      </div>` : ''}
      ${o.final_link ? `<div class="file-panel">
        <div class="file-panel-icon" style="color:var(--success)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <div class="file-panel-info"><b>File final</b><span>Sản phẩm bàn giao chính thức</span></div>
        <a class="btn btn-secondary btn-sm" href="${o.final_link}" target="_blank" rel="noopener">Mở</a>
      </div>` : ''}
    </div>`;
  } else {
    filesBlock = `<div class="drawer-detail-section"><h4>File bàn giao</h4>
      <p style="font-size:var(--text-sm);color:var(--text-muted)">File chưa sẵn sàng. Hệ thống sẽ thông báo khi có bản preview hoặc final.</p>
    </div>`;
  }

  // Rating block
  let ratingBlock = '';
  if (rt) {
    ratingBlock = `<div class="drawer-detail-section"><h4>Đánh giá của bạn</h4>
      <div style="font-size:22px">${starHtml(rt.score)}</div>
      ${rt.comment ? `<p style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--space-2)">"${rt.comment}"</p>` : ''}
    </div>`;
  }

  document.getElementById('drawer-body').innerHTML = `<div class="drawer-block">
    <div class="drawer-detail-section"><h4>Thông tin yêu cầu</h4>
      <div>
        <div class="detail-row"><span class="detail-dt">Order ID</span><span class="detail-dd mono">${o.id}</span></div>
        <div class="detail-row"><span class="detail-dt">Tên yêu cầu</span><span class="detail-dd">${o.name}</span></div>
        <div class="detail-row"><span class="detail-dt">Loại dịch vụ</span><span class="detail-dd">${o.type}</span></div>
        <div class="detail-row"><span class="detail-dt">Hạng mục</span><span class="detail-dd">${o.category}</span></div>
        ${(o.request_type === 'photo' || o.request_type === 'shoot') && o.shoot_location ? `<div class="detail-row"><span class="detail-dt">Địa điểm</span><span class="detail-dd">${o.shoot_location}</span></div>` : ''}
        <div class="detail-row"><span class="detail-dt">Ngày gửi</span><span class="detail-dd">${o.date}</span></div>
        <div class="detail-row"><span class="detail-dt">Deadline</span><span class="detail-dd">${o.deadline}</span></div>
        <div class="detail-row"><span class="detail-dt">Trạng thái</span><span class="detail-dd"><span class="tb-status ${st.cls}">${st.label}</span></span></div>
        <div class="detail-row"><span class="detail-dt">Người phụ trách</span><span class="detail-dd">${o.pic}</span></div>
      </div>
    </div>
    <div class="drawer-detail-section"><h4>Tiến độ</h4>
      <div class="co-progress-bar"><div class="co-progress-fill" style="width:${pg}%"></div></div>
      <div class="co-progress-label" style="margin-top:4px"><span>${st.label}</span><span>${pg}%</span></div>
      <div class="pub-timeline">${tlHtml(o.status)}</div>
    </div>
    ${actionBlock}${filesBlock}${ratingBlock}
  </div>`;

  document.getElementById('order-drawer').setAttribute('aria-hidden','false');
  document.getElementById('order-drawer').classList.add('is-open');
  document.getElementById('drawer-backdrop').classList.add('is-open');
}

function closeDrawer() {
  document.getElementById('order-drawer').setAttribute('aria-hidden','true');
  document.getElementById('order-drawer').classList.remove('is-open');
  document.getElementById('drawer-backdrop').classList.remove('is-open');
  state.openOrderId = null;
}

/* ===== MODALS ===== */
function openRatingModal(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  state.ratingOrderId = orderId;
  document.getElementById('rating-order-label').textContent = `${o.id} — ${o.name}`;
  document.getElementById('rating-comment').value = '';
  document.querySelectorAll('#star-rating input').forEach(i => i.checked = false);
  document.getElementById('star-label').textContent = 'Chọn mức đánh giá';
  document.getElementById('rating-modal').classList.add('is-open');
}
function closeRatingModal() { document.getElementById('rating-modal').classList.remove('is-open'); state.ratingOrderId = null; }

function openFeedbackModal(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  state.feedbackOrderId = orderId;
  document.getElementById('feedback-order-label').textContent = `${o.id} — ${o.name}`;
  document.getElementById('fb-type').value = '';
  document.getElementById('fb-content').value = '';
  document.getElementById('fb-priority').value = 'Bình thường';
  document.getElementById('feedback-modal').classList.add('is-open');
}
function closeFeedbackModal() { document.getElementById('feedback-modal').classList.remove('is-open'); state.feedbackOrderId = null; }

function openInfoModal(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  state.infoOrderId = orderId;
  document.getElementById('info-order-label').textContent = `${o.id} — ${o.name}`;
  document.getElementById('info-need-text').textContent = o.need_info || 'Vui lòng bổ sung thông tin còn thiếu.';
  document.getElementById('info-content').value = '';
  document.getElementById('info-link').value = '';
  document.getElementById('info-modal').classList.add('is-open');
}
function closeInfoModal() { document.getElementById('info-modal').classList.remove('is-open'); state.infoOrderId = null; }

function toast(type, title, message) {
  if (window.MH && window.MH.toast) window.MH.toast({ type, title, message, duration: 4000 });
}

/* ===== TAB SWITCH ===== */
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.client-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
  document.querySelectorAll('.client-view').forEach(v => v.classList.toggle('is-active', v.id === `view-${tab}`));
  document.querySelectorAll('.dash-nav a[data-tab]').forEach(a => a.classList.toggle('is-active', a.dataset.tab === tab));
}

/* ===== PROFILE CHIP ===== */
function initProfile() {
  if (!user) return;
  const welcomeEl = document.getElementById('welcome-name');
  if (welcomeEl) welcomeEl.textContent = user.name || 'bạn';
  document.getElementById('logout-btn').addEventListener('click', () => { localStorage.removeItem('mh-user'); location.replace('login.html'); });
}

/* ===== SIDEBAR TOGGLE ===== */
function initSidebar() {
  const toggle = document.getElementById('sb-toggle');
  const sidebar = document.getElementById('dash-sb');
  const backdrop = document.getElementById('sb-backdrop');
  if (!toggle) return;
  toggle.addEventListener('click', () => { sidebar.classList.toggle('is-open'); backdrop.classList.toggle('is-open'); });
  backdrop.addEventListener('click', () => { sidebar.classList.remove('is-open'); backdrop.classList.remove('is-open'); });
}

/* ===== EVENT DELEGATION ===== */
document.addEventListener('click', e => {
  // Sidebar data-tab links
  const tabLink = e.target.closest('.dash-nav a[data-tab]');
  if (tabLink) { e.preventDefault(); switchTab(tabLink.dataset.tab); return; }

  // Switch-tab buttons (e.g. "Xem tất cả")
  const switchBtn = e.target.closest('[data-switch-tab]');
  if (switchBtn) { switchTab(switchBtn.dataset.switchTab); return; }

  // Action buttons
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const orderId = btn.dataset.orderId;
  const notifId = btn.dataset.notifId;

  if (notifId) {
    state.notifRead.add(notifId);
    renderNotifications();
    // Write-through tới Supabase (fire-and-forget)
    if (window.MH && window.MH.store && window.MH.store.notifications && window.MH.supabaseEnabled) {
      Promise.resolve(window.MH.store.notifications.markRead(notifId)).catch(function (err) {
        console.warn('[client-dashboard] markRead failed:', err);
      });
    }
  }

  if (action === 'open-order')  openOrderDrawer(orderId);
  else if (action === 'needinfo') openInfoModal(orderId);
  else if (action === 'feedback') openFeedbackModal(orderId);
  else if (action === 'rating')   openRatingModal(orderId);
  else if (action === 'preview') {
    const o = ORDERS.find(x => x.id === orderId);
    if (o && o.preview_link) window.open(o.preview_link, '_blank', 'noopener');
  }
});

// Tab buttons
document.querySelectorAll('.client-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// Notif bell → notif tab
document.getElementById('notif-btn').addEventListener('click', () => switchTab('notif'));

// Drawer
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);

// Rating modal
document.getElementById('rating-close').addEventListener('click', closeRatingModal);
document.getElementById('rating-cancel').addEventListener('click', closeRatingModal);
document.getElementById('rating-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeRatingModal(); });
document.querySelectorAll('#star-rating input').forEach(inp => {
  inp.addEventListener('change', () => { document.getElementById('star-label').textContent = STAR_LABELS[+inp.value] || ''; });
});
document.getElementById('rating-submit').addEventListener('click', () => {
  const checked = document.querySelector('#star-rating input:checked');
  if (!checked) { toast('warning','Chọn mức đánh giá','Vui lòng chọn từ 1 đến 5 sao.'); return; }
  state.ratings[state.ratingOrderId] = { score: +checked.value, comment: document.getElementById('rating-comment').value.trim() };
  const prev = state.ratingOrderId;
  closeRatingModal();
  if (state.openOrderId === prev) openOrderDrawer(prev);
  renderAll();
  toast('success','Đã gửi đánh giá','Cảm ơn phản hồi của bạn!');
});

// Feedback modal
document.getElementById('feedback-close').addEventListener('click', closeFeedbackModal);
document.getElementById('feedback-cancel').addEventListener('click', closeFeedbackModal);
document.getElementById('feedback-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeFeedbackModal(); });
document.getElementById('feedback-submit').addEventListener('click', () => {
  const type = document.getElementById('fb-type').value;
  const content = document.getElementById('fb-content').value.trim();
  if (!type || !content) { toast('warning','Thiếu thông tin','Vui lòng chọn loại phản hồi và nhập nội dung.'); return; }
  closeFeedbackModal();
  toast('success','Đã gửi phản hồi','Team Media sẽ xử lý phản hồi của bạn sớm nhất.');
});

// Info modal
document.getElementById('info-close').addEventListener('click', closeInfoModal);
document.getElementById('info-cancel').addEventListener('click', closeInfoModal);
document.getElementById('info-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeInfoModal(); });
document.getElementById('info-submit').addEventListener('click', async () => {
  const content = document.getElementById('info-content').value.trim();
  const link = document.getElementById('info-link').value.trim();
  if (!content) { toast('warning','Thiếu thông tin','Vui lòng nhập thông tin cần bổ sung.'); return; }
  const o = ORDERS.find(x => x.id === state.infoOrderId);
  if (!o) { closeInfoModal(); return; }

  // Optimistic UI: đổi status local + clear need_info hint
  o.status = 'checking';
  o.need_info = '';
  closeInfoModal();
  renderAll();
  toast('success','Đã gửi bổ sung brief','Account team sẽ kiểm tra và xác nhận sớm nhất.');

  // Persist Supabase + notify admin/account (fire-and-forget)
  if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
  try {
    await window.MH.supabaseReady;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const prevNote = (o.__raw && o.__raw.internal_note) || '';
    const block =
      `\n\n[Client bổ sung — ${ts}]\n` +
      `Nội dung: ${content}` +
      (link ? `\nLink: ${link}` : '');
    const newNote = (prevNote ? prevNote.trimEnd() : '') + block;

    await window.MH.store.orders.update(o.id, {
      account_status: 'checking',
      internal_note: newNote,
      last_updated: now.toISOString()
    });
    if (o.__raw) { o.__raw.internal_note = newNote; o.__raw.account_status = 'checking'; }

    // Notify admin + account active
    const { data: staff } = await window.MH.supabase
      .from('users')
      .select('id, name')
      .in('role', ['admin', 'account'])
      .eq('status', 'active');
    if (Array.isArray(staff) && staff.length) {
      const projectName = o.name || '';
      const payloads = staff.map(function (u) {
        return {
          user_id: u.id,
          type: 'order_status_changed',
          title: '📥 Client đã bổ sung brief',
          message: `${o.id} · ${projectName} — Client đã gửi thông tin bổ sung. Vui lòng kiểm tra brief.`,
          link: 'database-orders.html?id=' + o.id,
          related_entity_type: 'orders',
          related_entity_id: o.id
        };
      });
      await window.MH.supabase.from('notifications').insert(payloads);
    }
  } catch (err) {
    console.warn('[client-dashboard] submit info supplement failed:', err);
    toast('warning','Sync lỗi','Đã lưu local. Vui lòng thử lại nếu Account chưa nhận thông báo.');
  }
});

// Orders filters
document.getElementById('orders-search').addEventListener('input', e => { state.ordersSearch = e.target.value; renderOrdersTable(); });
document.getElementById('orders-filter-status').addEventListener('change', e => { state.ordersFilterStatus = e.target.value; renderOrdersTable(); });
document.getElementById('orders-filter-type').addEventListener('change', e => { state.ordersFilterType = e.target.value; renderOrdersTable(); });
document.getElementById('orders-sort').addEventListener('change', e => { state.ordersSort = e.target.value; renderOrdersTable(); });

// Mark all read
document.getElementById('mark-all-read-btn').addEventListener('click', () => {
  NOTIFS.forEach(n => state.notifRead.add(n.id));
  renderNotifications();
  toast('success','Đã đánh dấu đọc','Tất cả thông báo đã được đánh dấu là đã đọc.');
});

/* ===== RENDER ALL ===== */
function renderAll() {
  renderKPIs();
  renderActionCenter();
  renderCurrentOrders();
  renderOrdersTable();
  renderNotifications();
}

/* ===== INIT ===== */
initProfile();
initSidebar();
renderAll();

// Mở order drawer nếu URL có ?order=<MEDIA-id> (vd click notification từ bell / panel).
function openOrderFromQuery() {
  try {
    const oid = new URLSearchParams(location.search).get('order');
    if (!oid) return false;
    const o = ORDERS.find(x => x.id === oid);
    if (o) { switchTab('orders'); openOrderDrawer(oid); return true; }
  } catch (e) {}
  return false;
}

// Phase 1: swap dataset từ Supabase nếu enabled, re-render khi xong.
loadClientOrdersFromStore().then(function (n) {
  if (typeof n === 'number') {
    console.log('[client-dashboard] swapped ' + n + ' orders từ Supabase (theo requester của ' + (user && user.email) + ')');
    renderAll();
  }
  // Sau khi orders load xong mới mở drawer theo ?order= (cần ORDERS đã có data).
  openOrderFromQuery();
});

// Phase 2: swap notifications từ Supabase + subscribe realtime
loadNotificationsFromStore().then(function (n) {
  if (typeof n === 'number') {
    console.log('[client-dashboard] swapped ' + n + ' notifications từ Supabase');
    renderNotifications();
  }
  startNotificationsRealtime();
});
