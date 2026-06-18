'use strict';

/* ===== AUTH GUARD ===== */
let user;
try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch(e) { user = null; }
if (!user || !user.role) { location.replace('login.html'); }
if (user && user.role !== 'client') { location.replace('dashboard.html'); }
document.body.setAttribute('data-user-role', user ? user.role : '');

/* ===== PUBLIC STATUS MAP ===== */
const PUB_STATUS = {
  pending:       { label: 'Yêu cầu đã gửi',             cls: 's--pending' },
  checking:      { label: 'Đã nhận yêu cầu',            cls: 's--checking' },
  needinfo:      { label: 'Cần bổ sung brief',           cls: 's--needinfo' },
  wording:       { label: 'Chuẩn hóa brief',             cls: 's--wording' },
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
  // Ladder Client (tăng đều theo 6 mốc timeline): gửi đơn 5% → Account kiểm tra 10% → … → 100%.
  pending:5, checking:10, needinfo:10, wording:15, confirmed:25,
  received:35, inprogress:55, revision:60, review:70,
  feedback_wait:80, feedback_fix:85, ready:90, delivered:95,
  completed:100, paused:0, cancelled:0,
};

const TL_STAGES = [
  { label:'Đã nhận',           statuses:['pending','checking','needinfo','wording'] },
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

// Icon thông báo: dùng chung từ assets/notif-icons.js (SINGLE SOURCE OF TRUTH —
// đồng bộ với internal bell). notif-icons.js load trước app.js trước client-dashboard.js
// nên window.MH.notifIcons luôn sẵn sàng. Key theo raw_type (Supabase notification.type).
function notifIcon(rawType) { return window.MH.notifIcons.get(rawType); }
function stripNotifEmoji(s) { return window.MH.notifIcons.stripEmoji(s); }

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
  wordingFeedbackOrderId: null,
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
    // Guard Phase 5: KHÔNG lộ Internal Media Request (order nội bộ Content→Media) cho Client.
    remote = remote.filter(function (o) {
      return !(o.client_visible === false || o.order_kind === 'internal_media_request' || o.origin === 'content_team');
    });
    // Always replace khi Supabase enabled (kể cả empty) — DB là source of truth.

    const TYPE_LABEL = { design: 'Thiết kế', digital: 'Digital', video: 'Video', motion: 'Motion', media: 'Quay / Chụp ảnh', shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads', slide: 'Slide' };
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
        created_raw: o.created_at || '',
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
        revision_round: o.revision_round || 0,
        revision_limit: o.revision_limit || 3,
        feedback_status: o.feedback_status || '',
        latest_feedback_note: o.latest_feedback_note || '',
        last_feedback_at: o.last_feedback_at || '',
        last_feedback_by: o.last_feedback_by || '',
        // Phase 4 — Brief Wording (Client confirmation). KHÔNG map internal note (wording_account_note / wording_production_note).
        brief_wording_status: o.brief_wording_status || 'none',
        brief_wording_round: o.brief_wording_round || 0,
        wording_brief: o.wording_brief || '',
        wording_objective: o.wording_objective || '',
        wording_core_message: o.wording_core_message || '',
        wording_required_info: o.wording_required_info || '',
        wording_tone_style: o.wording_tone_style || '',
        wording_cta: o.wording_cta || '',
        wording_approved_at: o.wording_approved_at || '',
        wording_client_feedback_at: o.wording_client_feedback_at || '',
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
// Trạng thái HIỂN THỊ cho Client (timeline/nhãn/%): order đã rating/final → bàn giao/hoàn thành,
// không kẹt ở feedback_wait. Tránh tình huống order đã đánh giá mà timeline vẫn đứng "Kiểm tra nội bộ".
function pubEffStatus(o) {
  if (!o) return 'pending';
  if (o.status === 'cancelled') return 'cancelled';
  if (o.rating || o.status === 'completed') return 'completed';
  if (isFinalDelivered(o)) return 'delivered';
  return o.status;
}
function pubStatus(o) { const s = pubEffStatus(o); return PUB_STATUS[s] || { label: s, cls: '' }; }
function pubProgress(o) { return PUB_PROGRESS[pubEffStatus(o)] ?? 0; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
// Order đã bàn giao Final khi có final_link / rating (chắc chắn nhất) HOẶC status delivered/completed HOẶC feedback_status=final_sent.
// Dùng cho Action Center / drawer / bảng để client luôn thấy bảng "đánh giá + tạo Order mới" sau khi nhận Final.
function isFinalDelivered(o) { return !!(o && (o.rating || o.final_link || ['delivered', 'completed'].includes(o.status) || o.feedback_status === 'final_sent')); }
function fmtDT(s) {
  if (!s) return '';
  const d = new Date(typeof s === 'string' && s.replace ? s.replace(' ', 'T') : s);
  if (isNaN(d.getTime())) return String(s);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear()
    + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

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
  const awaitFb    = ORDERS.filter(o => o.status === 'feedback_wait' && !isFinalDelivered(o)).length;
  const delivered  = ORDERS.filter(o => isFinalDelivered(o)).length;
  const noRating   = ORDERS.filter(o => isFinalDelivered(o) && !state.ratings[o.id]).length;

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
      const f = card.dataset.kpiFilter || '';
      const sel = document.getElementById('orders-filter-status');
      // Áp filter thật theo KPI (gồm 'active'/'no_rating' không có trong dropdown);
      // dropdown chỉ phản chiếu khi có option tương ứng, ngược lại để trống.
      state.ordersFilterStatus = f;
      sel.value = sel.querySelector('option[value="' + f + '"]') ? f : '';
      renderOrdersTable();
    });
  });
}

/* ===== RENDER: ACTION CENTER ===== */
function renderActionCenter() {
  const actions = [];
  ORDERS.forEach(o => {
    if (o.status === 'needinfo') actions.push({ type:'needinfo', order:o });
    if (shouldShowPreviewAction(o)) actions.push({ type:'preview', order:o });
    if (isFinalDelivered(o) && !state.ratings[o.id]) actions.push({ type:'rating', order:o });
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
          <button class="btn btn-warning btn-sm" data-action="needinfo" data-order-id="${o.id}">Bổ sung ngay</button>
          <button class="btn btn-secondary btn-sm" data-action="open-order" data-order-id="${o.id}">Xem chi tiết</button>
        </div>
      </div>`;
    if (a.type === 'preview') {
      const roundN = getPreviewRound(o);
      const roundTxt = appliesRevisionRule(o) ? ` · Feedback Vòng ${roundN}/${o.revision_limit||3}` : '';
      return `
      <div class="action-card ac--preview">
        <div class="action-card-head">
          <div class="action-card-icon ai--preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
          <div><div class="action-card-title">Bản Preview lần ${roundN} chờ feedback</div><div class="action-card-order">${o.id}${roundTxt}</div></div>
        </div>
        <p>${o.name} — Đã có <b>bản Preview lần ${roundN}</b> để anh/chị kiểm tra nội dung, bố cục, hình ảnh và gửi feedback.</p>
        <div class="action-card-btns">
          ${o.preview_link ? `<a class="btn btn-info btn-sm" href="${o.preview_link}" target="_blank" rel="noopener">Xem Preview</a>` : ''}
          <button class="btn btn-success btn-sm" data-action="approve-preview" data-order-id="${o.id}">Duyệt Preview</button>
          <button class="btn btn-secondary btn-sm" data-action="feedback" data-order-id="${o.id}">Gửi feedback</button>
        </div>
      </div>`;
    }
    if (a.type === 'rating') return `
      <div class="action-card ac--rating">
        <div class="action-card-head">
          <div class="action-card-icon ai--rating"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
          <div><div class="action-card-title">Chưa đánh giá <span class="cl-rate-pill">★ 5 giây</span></div><div class="action-card-order">${o.id}</div></div>
        </div>
        <p>${o.name} — Sản phẩm đã bàn giao. <b>Đánh giá giúp team Media cải thiện chất lượng</b> (chỉ vài giây, không bắt buộc). Cần chỉnh sửa/phát sinh sau Final thì tạo một Order mới từ yêu cầu này.</p>
        <div class="action-card-btns">
          ${o.final_link ? `<a class="btn btn-secondary btn-sm" href="${o.final_link}" target="_blank" rel="noopener">Xem Final</a>` : ''}
          <button class="btn btn-success btn-sm cl-rate-btn" data-action="rating" data-order-id="${o.id}">Đánh giá ngay</button>
          <button class="btn btn-secondary btn-sm" data-action="new-order-from" data-order-id="${o.id}">Tạo Order mới</button>
        </div>
      </div>`;
    return '';
  }).join('')}</div>`;
}

/* ===== RENDER: CURRENT ORDERS ===== */
function renderCurrentOrders() {
  const active = ORDERS.filter(o => !['completed','cancelled','delivered'].includes(pubEffStatus(o)));
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
        <div class="co-card-prog">
          <div class="co-progress-bar"><div class="co-progress-fill" style="width:${pg}%"></div></div>
          <div class="co-progress-label"><span>${st.label}</span><span>${pg}%</span></div>
        </div>
        <div class="co-card-foot">
          <span style="font-size:var(--text-xs);color:var(--text-muted)">PIC: ${o.pic || '—'}</span>
          <span style="font-size:var(--text-xs);color:var(--primary);font-weight:600">Chi tiết →</span>
        </div>
      </div>`;
  }).join('');
}

/* ===== RENDER: ORDERS TABLE ===== */
// Bucket filter trạng thái KHỚP nhãn badge (pubEffStatus), không so raw o.status.
const STATUS_FILTER_GROUPS = {
  submitted: ['pending', 'checking', 'confirmed', 'wording'],
  needinfo:  ['needinfo'],
  producing: ['received', 'inprogress', 'revision', 'feedback_fix'],
  review:    ['review', 'ready'],
  feedback:  ['feedback_wait'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};
// Thứ tự "Cần xử lý trước": việc client cần action (bổ sung brief / phản hồi) lên đầu.
const STATUS_SORT_PRIO = ['needinfo', 'feedback_wait', 'review', 'ready', 'revision', 'feedback_fix', 'inprogress', 'received', 'confirmed', 'wording', 'checking', 'pending', 'delivered', 'completed', 'paused', 'cancelled'];
// Timestamp tạo đơn để sort theo ngày (created_raw từ DB; fallback parse 'DD/MM/YYYY' của mock).
function orderTime(o) {
  if (o.created_raw) { const d = new Date(String(o.created_raw).replace(' ', 'T')); if (!isNaN(d.getTime())) return d.getTime(); }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(o.date || '');
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0;
}
function orderDeadlineTime(o) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(o.deadline || '');
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : Infinity; // không có deadline → cuối khi sort tăng dần
}
function getFilteredOrders() {
  let list = [...ORDERS];
  const s = state.ordersSearch.toLowerCase();
  if (s) list = list.filter(o => o.id.toLowerCase().includes(s) || o.name.toLowerCase().includes(s));
  const fs = state.ordersFilterStatus;
  // 'active' (KPI Đang xử lý) + 'delivered' (KPI Đã bàn giao = isFinalDelivered, gồm cả đã đánh giá)
  // + 'no_rating' (KPI Chưa đánh giá) giữ semantics khớp KPI drilldown.
  if (fs === 'active')         list = list.filter(o => !['delivered', 'completed', 'cancelled'].includes(pubEffStatus(o)));
  else if (fs === 'delivered') list = list.filter(o => isFinalDelivered(o));
  else if (fs === 'no_rating') list = list.filter(o => isFinalDelivered(o) && !state.ratings[o.id]);
  else if (STATUS_FILTER_GROUPS[fs]) list = list.filter(o => STATUS_FILTER_GROUPS[fs].includes(pubEffStatus(o)));
  if (state.ordersFilterType) list = list.filter(o => o.type === state.ordersFilterType);
  if (state.ordersSort === 'date_desc')         list.sort((a, b) => orderTime(b) - orderTime(a));
  else if (state.ordersSort === 'date_asc')     list.sort((a, b) => orderTime(a) - orderTime(b));
  else if (state.ordersSort === 'deadline_asc') list.sort((a, b) => orderDeadlineTime(a) - orderDeadlineTime(b));
  else if (state.ordersSort === 'status')       list.sort((a, b) => {
    const ia = STATUS_SORT_PRIO.indexOf(pubEffStatus(a)), ib = STATUS_SORT_PRIO.indexOf(pubEffStatus(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return list;
}

function renderOrdersTable() {
  const list = getFilteredOrders();
  const activeCount = ORDERS.filter(o => !['completed','cancelled','delivered'].includes(pubEffStatus(o))).length;

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
      : (isFinalDelivered(o)
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
      <div class="dw-callout dw--warning">
        <p>Team Media cần bạn bổ sung thêm thông tin để tiếp tục xử lý:</p>
        <p class="dw-meta">${o.need_info}</p>
        <div class="dw-actions"><button class="btn btn-warning btn-sm" data-action="needinfo" data-order-id="${o.id}">Bổ sung ngay</button></div>
      </div></div>`;
  } else if (o.status === 'feedback_wait' && !isFinalDelivered(o)) {
    const _design = appliesRevisionRule(o), _limit = (o.revision_limit || 3);
    const roundN = getPreviewRound(o), _submitted = (o.revision_round || 0);
    const _roundTxt = _design ? ` · Feedback Vòng ${roundN}/${_limit}` : '';
    const fs = o.feedback_status || '';
    if (shouldShowPreviewAction(o)) {
      actionBlock = `<div class="drawer-detail-section"><h4>Bản Preview lần ${roundN} — chờ feedback${_roundTxt}</h4>
      <div class="dw-callout dw--info">
        <p>Anh/chị có <b>bản Preview lần ${roundN}</b> cần kiểm tra nội dung, bố cục, hình ảnh. Nếu đạt yêu cầu, hãy bấm <b>Duyệt Preview</b>; nếu cần chỉnh, hãy gửi feedback để team Media tiếp tục hoàn thiện.</p>
        <div class="dw-actions">
          ${o.preview_link ? `<a class="btn btn-info btn-sm" href="${o.preview_link}" target="_blank" rel="noopener">Xem Preview</a>` : ''}
          <button class="btn btn-success btn-sm" data-action="approve-preview" data-order-id="${o.id}">Duyệt Preview</button>
          <button class="btn btn-secondary btn-sm" data-action="feedback" data-order-id="${o.id}">Gửi feedback</button>
        </div>
      </div></div>`;
    } else if (fs === 'approved') {
      actionBlock = `<div class="drawer-detail-section"><h4>Đã duyệt Preview</h4>
      <div class="dw-callout dw--success">
        <p><b>Bản Preview đã được duyệt.</b> Team Media đang chuẩn bị file Final và sẽ gửi lại trong thời gian sớm nhất.</p>
        ${o.preview_link ? `<div class="dw-actions"><a class="btn btn-info btn-sm" href="${o.preview_link}" target="_blank" rel="noopener">Xem Preview</a></div>` : ''}
      </div></div>`;
    } else {
      // Vòng cuối (Vòng 3 với order design) → team xử lý xong sẽ bàn giao FINAL, không phải Preview tiếp theo.
      const _isLastRound = _design && _submitted >= _limit;
      const _nextArtifact = _isLastRound ? 'bàn giao bản Final' : 'gửi bản Preview tiếp theo';
      const _msg = (fs === 'revision_in_progress')
        ? `Team Media đang chỉnh sửa theo feedback của anh/chị và sẽ ${_nextArtifact}.`
        : (fs === 'exceeded_limit')
          ? 'Đã đạt giới hạn số vòng chỉnh sửa. Team Media sẽ liên hệ để thống nhất hướng xử lý tiếp theo.'
          : `Anh/chị đã gửi feedback${_design ? ` Vòng ${_submitted}` : ''}. Team Media đang xử lý và sẽ ${_nextArtifact}.`;
      actionBlock = `<div class="drawer-detail-section"><h4>Đã gửi feedback — chờ team xử lý</h4>
      <div class="dw-callout dw--muted">
        <p>${_msg}</p>
        ${o.preview_link ? `<div class="dw-actions"><a class="btn btn-secondary btn-sm" href="${o.preview_link}" target="_blank" rel="noopener">Xem Preview gần nhất</a></div>` : ''}
      </div></div>`;
    }
  } else if (isFinalDelivered(o)) {
    const finishedRounds = appliesRevisionRule(o) && (o.revision_round || 0) >= (o.revision_limit || 3);
    const _msg = finishedRounds
      ? 'Yêu cầu đã hoàn tất 03 vòng feedback. Team Media đã xử lý Feedback Vòng 3 và bàn giao bản Final. Anh/chị vui lòng kiểm tra sản phẩm hoàn thiện và gửi đánh giá. Nếu cần chỉnh sửa hoặc phát sinh thêm sau Final, vui lòng tạo một Order mới từ yêu cầu hiện tại để team tiếp tục xử lý.'
      : 'Sản phẩm đã được bàn giao. Anh/chị vui lòng kiểm tra và gửi đánh giá. Nếu cần chỉnh sửa hoặc phát sinh thêm, có thể tạo một Order mới từ yêu cầu hiện tại.';
    actionBlock = `<div class="drawer-detail-section"><h4>${finishedRounds ? 'Đã bàn giao Final' : 'Sản phẩm đã bàn giao'}</h4>
      <div class="dw-callout dw--success">
        <p>${_msg}</p>
        <div class="dw-actions">
          ${o.final_link ? `<a class="btn btn-secondary btn-sm" href="${o.final_link}" target="_blank" rel="noopener">Xem Final</a>` : ''}
          <button class="btn btn-primary btn-sm" data-action="new-order-from" data-order-id="${o.id}">Tạo Order mới từ yêu cầu này</button>
        </div>
        ${!rt ? `<div class="cl-rate-nudge">
            <div class="cl-rate-stars" aria-hidden="true">★★★★★</div>
            <div class="cl-rate-text"><b>Bạn thấy sản phẩm thế nào?</b><span>Đánh giá chỉ mất vài giây &amp; giúp team Media cải thiện chất lượng. Không bắt buộc.</span></div>
            <button class="btn btn-success btn-sm cl-rate-btn" data-action="rating" data-order-id="${o.id}">Đánh giá ngay</button>
          </div>` : `<div class="cl-rate-done">✓ Cảm ơn anh/chị đã đánh giá ${'★'.repeat(Number(rt.score) || 0)}${rt.comment ? ' — “' + esc(rt.comment) + '”' : ''}</div>`}
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

  // Phase 4 — Brief Wording block (Client confirmation). Chỉ hiển thị khi Account đã gửi.
  let wordingBlock = '';
  {
    const ws = o.brief_wording_status || 'none';
    const wround = o.brief_wording_round || 0;
    const wrow = (label, val) => val && String(val).trim()
      ? `<div class="dw-detail"><span class="dw-dt">${label}</span><span class="dw-dd" style="white-space:pre-wrap">${esc(val)}</span></div>` : '';
    if (['sent_to_client', 'client_feedback', 'client_approved', 'completed'].includes(ws)) {
      const fields = `
        ${wrow('Brief đã wording', o.wording_brief)}
        ${wrow('Mục tiêu sau khi chuẩn hóa', o.wording_objective)}
        ${wrow('Thông điệp chính', o.wording_core_message)}
        ${wrow('Thông tin bắt buộc', o.wording_required_info)}
        ${wrow('Tone & style', o.wording_tone_style)}
        ${wrow('CTA đề xuất', o.wording_cta)}
        ${wround ? `<div class="dw-detail"><span class="dw-dt">Vòng hiện tại</span><span class="dw-dd">Vòng ${wround}</span></div>` : ''}`;
      let head, tone, banner, actions = '';
      if (ws === 'sent_to_client') {
        head = 'Brief đã được chuẩn hóa'; tone = 'dw--brand';
        const atLimit = wordingAtLimit(o);                       // đã dùng hết 2 vòng chỉnh
        const lastRound = wround === (WORDING_ROUND_LIMIT - 1);  // sắp gửi vòng cuối (2/2)
        const roundNote = atLimit
          ? `<p class="bw-note bw-warn" style="margin-top:8px">${WORDING_LIMIT_MSG}</p>`
          : (lastRound ? `<p class="bw-note bw-warn" style="margin-top:8px">${WORDING_LAST_ROUND_MSG}</p>` : '');
        banner = `<p>Team đã chuẩn hóa nội dung yêu cầu của anh/chị. Vui lòng kiểm tra và <b>xác nhận brief</b> để chuyển sang bước sản xuất${atLimit ? '' : ', hoặc <b>yêu cầu chỉnh brief</b> nếu cần điều chỉnh'}.</p>${roundNote}`;
        actions = `<div class="dw-actions">
            <button class="btn btn-success btn-sm" data-action="approve-wording" data-order-id="${o.id}">Xác nhận brief</button>
            ${atLimit ? '' : `<button class="btn btn-secondary btn-sm" data-action="wording-feedback" data-order-id="${o.id}">Yêu cầu chỉnh brief</button>`}
          </div>`;
      } else if (ws === 'client_feedback') {
        head = 'Đã gửi yêu cầu chỉnh brief'; tone = 'dw--warning';
        banner = `<p>Anh/chị đã gửi yêu cầu chỉnh brief${o.wording_client_feedback_at ? ' lúc ' + fmtDT(o.wording_client_feedback_at) : ''}. Team đang điều chỉnh và sẽ gửi lại bản chuẩn hóa để anh/chị xác nhận.</p>`;
      } else {
        head = 'Brief đã được xác nhận'; tone = 'dw--success';
        banner = `<p><b>Anh/chị đã xác nhận brief đã chuẩn hóa.</b>${o.wording_approved_at ? ' (' + fmtDT(o.wording_approved_at) + ')' : ''} Team đang triển khai sản xuất theo nội dung đã thống nhất.</p>`;
      }
      wordingBlock = `<div class="drawer-detail-section"><h4>${head}</h4>
        <div class="dw-callout ${tone}">
          ${banner}
          <div>${fields}</div>
          ${actions}
        </div></div>`;
    }
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
        ${['media', 'photo', 'shoot'].includes(o.request_type) && o.shoot_location ? `<div class="detail-row"><span class="detail-dt">Địa điểm</span><span class="detail-dd">${o.shoot_location}</span></div>` : ''}
        <div class="detail-row"><span class="detail-dt">Ngày gửi</span><span class="detail-dd">${o.date}</span></div>
        <div class="detail-row"><span class="detail-dt">Deadline</span><span class="detail-dd">${o.deadline}</span></div>
        <div class="detail-row"><span class="detail-dt">Trạng thái</span><span class="detail-dd"><span class="tb-status ${st.cls}">${st.label}</span></span></div>
        <div class="detail-row"><span class="detail-dt">Người phụ trách</span><span class="detail-dd">${o.pic}</span></div>
      </div>
    </div>
    <div class="drawer-detail-section"><h4>Tiến độ</h4>
      <div class="co-progress-bar"><div class="co-progress-fill" style="width:${pg}%"></div></div>
      <div class="co-progress-label" style="margin-top:4px"><span>${st.label}</span><span>${pg}%</span></div>
      <div class="pub-timeline">${tlHtml(pubEffStatus(o))}</div>
    </div>
    ${wordingBlock}${actionBlock}${filesBlock}${ratingBlock}
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
  // Chặn đánh giá trùng: đã có rating (local state hoặc satisfaction_score) → không cho mở lại modal.
  if (state.ratings[orderId] || o.rating) {
    toast('info', 'Đã đánh giá', 'Anh/chị đã gửi đánh giá cho yêu cầu này rồi. Cảm ơn anh/chị!');
    return;
  }
  state.ratingOrderId = orderId;
  document.getElementById('rating-order-label').textContent = `${o.id} — ${o.name}`;
  document.getElementById('rating-comment').value = '';
  document.querySelectorAll('#star-rating input').forEach(i => i.checked = false);
  document.getElementById('star-label').textContent = 'Chọn mức đánh giá';
  document.getElementById('rating-modal').classList.add('is-open');
}
function closeRatingModal() { document.getElementById('rating-modal').classList.remove('is-open'); state.ratingOrderId = null; }

// ===== REVISION ROUNDS — Preview → tối đa 03 vòng feedback (chủ yếu order design) =====
const REVISION_ROUNDS = {
  1: { title: 'Feedback Vòng 1', help: 'Anh/chị vui lòng kiểm tra tổng thể bản Preview và gửi góp ý về bố cục, hình ảnh/element, nội dung chữ hoặc các điểm cần điều chỉnh chính. Vòng 1 hỗ trợ điều chỉnh trong phạm vi brief đã xác nhận, tối đa khoảng 60% tổng thể thiết kế.' },
  2: { title: 'Feedback Vòng 2', help: 'Anh/chị vui lòng kiểm tra phiên bản đã được chỉnh sửa và gửi các góp ý tinh chỉnh tiếp theo. Vòng 2 tập trung hoàn thiện trên phương án hiện tại, phạm vi điều chỉnh tối đa khoảng 30% tổng thể.' },
  3: { title: 'Feedback Vòng 3 — Final Check', help: 'Đây là vòng kiểm tra cuối trước khi chốt Final. Anh/chị vui lòng chỉ gửi các điều chỉnh nhỏ như nội dung chữ, lỗi chính tả, thông tin chi tiết hoặc các tinh chỉnh rất nhỏ.' }
};
const REVISION_POLICY_HTML = '<b>Chính sách feedback/chỉnh sửa:</b> Mỗi yêu cầu thiết kế gồm tối đa <b>03 vòng</b> trong phạm vi brief đã xác nhận.<br>• <b>Vòng 1</b>: điều chỉnh chính (bố cục, hình ảnh/element, nội dung chữ) — không quá ~60% tổng thể.<br>• <b>Vòng 2</b>: tinh chỉnh trên bản đã cập nhật — không quá ~30% tổng thể.<br>• <b>Vòng 3</b>: kiểm tra cuối trước Final — chỉ chỉnh nhỏ (chữ, chính tả, chi tiết).<br>Từ <b>vòng 4</b> trở đi hoặc thay đổi vượt brief → hệ thống ghi nhận thành một yêu cầu/task mới.';
const ROUND4_MESSAGE = 'Yêu cầu này đã sử dụng đủ 03 vòng feedback/chỉnh sửa. Các góp ý mới từ vòng thứ 4 hoặc thay đổi vượt phạm vi brief ban đầu sẽ được ghi nhận thành một yêu cầu/task mới để team Media tiếp tục xử lý.';
// Vòng 3 là vòng feedback CUỐI của order hiện tại — cảnh báo client gom đủ chỉnh sửa trước Final.
const R3_WARNING_HTML = 'Đây là vòng feedback cuối cùng của yêu cầu này.<br><br>Anh/chị vui lòng kiểm tra kỹ toàn bộ bản Preview và tổng hợp đầy đủ các nội dung cần điều chỉnh trước khi gửi. Feedback ở vòng này chỉ áp dụng cho các tinh chỉnh cuối trong phạm vi brief đã xác nhận, ưu tiên chỉnh sửa nội dung chữ, lỗi chính tả, thông tin chi tiết và các điều chỉnh nhỏ để hoàn thiện sản phẩm.<br><br>Các yêu cầu thay đổi lớn về bố cục, concept, hình ảnh/element chính hoặc thay đổi vượt phạm vi brief ban đầu sẽ được ghi nhận thành một Order mới sau khi bản Final được bàn giao.';
const R3_NOTE = 'Vui lòng gom đầy đủ các nội dung cần chỉnh trong lần phản hồi này để team Media xử lý và bàn giao Final.';
function appliesRevisionRule(o) { return ['design', 'digital'].includes(o.request_type); }
// Chỉ hiện action "Bản Preview chờ feedback" khi order thực sự đang đợi feedback từ client.
function shouldShowPreviewAction(o) {
  if (isFinalDelivered(o)) return false; // đã có Final → không còn ở vòng Preview feedback.
  return o.status === 'feedback_wait' && !!o.preview_link && (!o.feedback_status || o.feedback_status === 'waiting_feedback');
}
// Số vòng Preview hiện tại = revision_round + 1, kẹp theo revision_limit.
function getPreviewRound(o) {
  const round = Number(o.revision_round || 0) + 1;
  const limit = Number(o.revision_limit || 3);
  return Math.min(round, limit);
}

/* ===== PHASE 4 — Brief Wording confirmation (Client) ===== */
// Chỉ cho thao tác khi Account thực sự đang chờ Client (brief_wording_status = sent_to_client).
function wordingActionable(o) { return o && o.brief_wording_status === 'sent_to_client'; }
// Brief wording tối đa 2 vòng chỉnh từ Client (khác Preview design = 3 vòng).
const WORDING_ROUND_LIMIT = 2;
// Đã dùng hết số vòng chỉnh wording cho phép (brief_wording_round >= limit) → KHÔNG cho gửi thêm.
function wordingAtLimit(o) { return Number(o && o.brief_wording_round || 0) >= WORDING_ROUND_LIMIT; }
const WORDING_LAST_ROUND_MSG = 'Đây là <b>vòng chỉnh sửa wording cuối cùng (vòng 2/2)</b>. Vui lòng tổng hợp đầy đủ nội dung cần điều chỉnh — sau vòng này brief sẽ được chốt để chuyển sản xuất.';
const WORDING_LIMIT_MSG = 'Yêu cầu này đã dùng hết <b>2 vòng chỉnh wording</b>. Vui lòng <b>xác nhận brief</b> để chuyển sản xuất; nếu vẫn cần thay đổi lớn, hãy liên hệ Account để được hỗ trợ.';

async function approveWording(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  if (!wordingActionable(o)) {
    toast('info', 'Đã xử lý', 'Brief wording của yêu cầu này đã được xác nhận hoặc đang chờ team chỉnh.');
    return;
  }
  if (!window.confirm('Anh/chị xác nhận brief đã được chuẩn hóa và đồng ý chuyển sang bước sản xuất?')) return;

  const nowIso = new Date().toISOString();
  const by = (user && (user.name || user.email)) || 'Client';
  // Optimistic UI
  o.brief_wording_status = 'client_approved';
  o.wording_approved_at = nowIso;
  if (o.__raw) Object.assign(o.__raw, { brief_wording_status: 'client_approved', wording_approved_at: nowIso, wording_approved_by: by });
  toast('success', 'Đã xác nhận brief', 'Cảm ơn anh/chị. Team sẽ tiến hành sản xuất theo nội dung đã thống nhất.');
  renderAll();
  openOrderDrawer(orderId);

  if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
  try {
    await window.MH.supabaseReady;
    // Ghi qua RPC update_brief_wording (client KHÔNG có UPDATE orders trực tiếp dưới RLS).
    await window.MH.store.orders.updateWording(o.id, {
      brief_wording_status: 'client_approved',
      wording_approved_at: nowIso,
      wording_approved_by: by
    });
    const { data: staff } = await window.MH.supabase
      .from('users').select('id').in('role', ['admin', 'account']).eq('status', 'active');
    if (Array.isArray(staff) && staff.length) {
      await window.MH.supabase.from('notifications').insert(staff.map(function (u) {
        return {
          user_id: u.id,
          // type base-CHECK-safe (không phụ thuộc add-brief-wording-confirmation/add-revision-rounds đã chạy chưa).
          type: 'order_status_changed',
          title: 'Client đã xác nhận brief wording',
          message: `Client đã xác nhận brief wording cho yêu cầu ${o.id} · ${o.name || ''}. Account có thể Confirm Brief và Push Production.`,
          link: 'database-orders.html?id=' + o.id,
          related_entity_type: 'orders',
          related_entity_id: o.id
        };
      }));
    }
  } catch (err) {
    console.warn('[client-dashboard] approve wording failed:', err);
    toast('warning', 'Sync lỗi', 'Đã lưu local. Vui lòng kiểm tra lại nếu Account chưa nhận thông báo.');
  }
}

function openWordingFeedbackModal(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  if (!wordingActionable(o)) {
    toast('info', 'Đã gửi yêu cầu', 'Anh/chị đã gửi yêu cầu chỉnh brief. Vui lòng chờ team gửi lại bản chuẩn hóa.');
    return;
  }
  if (wordingAtLimit(o)) {
    toast('info', 'Đã đạt tối đa 2 vòng', 'Yêu cầu đã dùng hết 2 vòng chỉnh wording. Vui lòng xác nhận brief hoặc liên hệ Account.');
    return;
  }
  state.wordingFeedbackOrderId = orderId;
  const label = document.getElementById('wfb-order-label');
  if (label) label.textContent = `${o.id} — ${o.name}`;
  ['wfb-content', 'wfb-reason', 'wfb-link'].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
  const nextRound = (o.brief_wording_round || 0) + 1;
  const warn = document.getElementById('wfb-round-warn');
  if (warn) {
    // Vòng client sắp gửi đạt giới hạn (vòng 2/2) → báo đây là vòng chỉnh cuối.
    if (nextRound >= WORDING_ROUND_LIMIT) { warn.hidden = false; warn.innerHTML = WORDING_LAST_ROUND_MSG; }
    else warn.hidden = true;
  }
  document.getElementById('wording-feedback-modal').classList.add('is-open');
}
function closeWordingFeedbackModal() {
  const m = document.getElementById('wording-feedback-modal');
  if (m) m.classList.remove('is-open');
  state.wordingFeedbackOrderId = null;
}

function openFeedbackModal(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  state.feedbackOrderId = orderId;
  document.getElementById('feedback-order-label').textContent = `${o.id} — ${o.name}`;

  const applies = appliesRevisionRule(o);
  const round = o.revision_round || 0;
  const limit = o.revision_limit || 3;
  const nextRound = round + 1;                 // vòng client sắp gửi
  const atLimit = applies && round >= limit;   // đã dùng hết 3 vòng → block vòng 4

  const badge = document.getElementById('fb-round-badge');
  const help = document.getElementById('fb-round-help');
  const form = document.getElementById('fb-form');
  const policy = document.getElementById('fb-policy');
  const round4 = document.getElementById('fb-round4-block');
  const submit = document.getElementById('feedback-submit');
  const note = document.getElementById('fb-note');
  const title = document.getElementById('feedback-modal-title');
  const isR3 = applies && nextRound >= limit; // vòng 3 = vòng feedback cuối

  if (atLimit) {
    // Vòng 4: KHÔNG cho gửi feedback thường → hiện block hướng dẫn tạo yêu cầu mới.
    if (title) title.textContent = 'Gửi phản hồi chỉnh sửa';
    if (badge) { badge.textContent = 'Bản Preview · Đã dùng hết 03 vòng'; badge.classList.add('is-final'); }
    if (help) help.textContent = '';
    if (note) note.hidden = true;
    if (form) form.hidden = true;
    if (policy) policy.hidden = true;
    if (round4) { round4.hidden = false; document.getElementById('fb-round4-msg').textContent = ROUND4_MESSAGE; }
    if (submit) submit.hidden = true;
  } else if (isR3) {
    // Vòng 3 — Final Check: cảnh báo rõ đây là vòng cuối.
    if (title) title.textContent = 'Feedback Vòng 3 — Final Check';
    if (badge) { badge.classList.add('is-final'); badge.textContent = 'Vòng cuối · 3/3'; }
    if (help) help.innerHTML = R3_WARNING_HTML;
    if (note) { note.hidden = false; note.textContent = R3_NOTE; }
    if (policy) { policy.hidden = false; policy.innerHTML = REVISION_POLICY_HTML; }
    if (form) form.hidden = false;
    if (round4) round4.hidden = true;
    if (submit) { submit.hidden = false; submit.textContent = 'Gửi Feedback Vòng 3 — Final Check'; }
  } else {
    const meta = REVISION_ROUNDS[Math.min(nextRound, 3)] || REVISION_ROUNDS[1];
    if (title) title.textContent = 'Gửi phản hồi chỉnh sửa';
    if (badge) {
      badge.classList.remove('is-final');
      badge.textContent = applies ? `Bản Preview · ${meta.title} (${nextRound}/${limit})` : 'Bản Preview · Gửi feedback';
    }
    if (help) help.textContent = applies ? meta.help : 'Anh/chị vui lòng kiểm tra bản Preview và gửi góp ý để team Media tiếp tục hoàn thiện.';
    if (note) note.hidden = true;
    if (policy) { policy.hidden = !applies; policy.innerHTML = REVISION_POLICY_HTML; }
    if (form) form.hidden = false;
    if (round4) round4.hidden = true;
    if (submit) { submit.hidden = false; submit.textContent = 'Gửi phản hồi'; }
  }

  document.getElementById('fb-type').value = '';
  document.getElementById('fb-content').value = '';
  document.getElementById('fb-priority').value = 'Bình thường';
  document.getElementById('feedback-modal').classList.add('is-open');
}
function closeFeedbackModal() { document.getElementById('feedback-modal').classList.remove('is-open'); state.feedbackOrderId = null; }
// Client tự tạo Order mới (chỉnh sửa/phát sinh) từ order gốc → request.html ở chế độ revision.
// Admin/Account KHÔNG tạo thay client.
function gotoRevisionForm(o) {
  if (!o) return;
  const p = new URLSearchParams();
  p.set('mode', 'revision');
  p.set('ref_order', o.id);
  if (o.name) p.set('project_name', o.name);
  location.href = 'request.html?' + p.toString();
}

// Client duyệt Preview → feedback_status=approved + notify Account/Admin chuẩn bị Final.
// KHÔNG đổi production_status (task-driven) — chỉ đánh dấu preview đã được duyệt.
async function approvePreview(orderId) {
  const o = ORDERS.find(x => x.id === orderId);
  if (!o) return;
  if (o.feedback_status === 'approved') { toast('info', 'Đã duyệt', 'Bản Preview của yêu cầu này đã được duyệt trước đó.'); return; }
  if (o.feedback_status && o.feedback_status !== 'waiting_feedback') { toast('info', 'Không thể duyệt', 'Bản Preview này đang trong quá trình xử lý feedback. Vui lòng chờ bản Preview mới.'); return; }
  const by = (user && (user.name || user.email)) || 'Client';
  const nowIso = new Date().toISOString();
  // Optimistic UI
  o.feedback_status = 'approved';
  o.approved_at = nowIso;
  o.approved_by = by;
  renderAll();
  toast('success', 'Đã duyệt Preview', 'Bản Preview đã được duyệt. Team Media sẽ chuẩn bị file Final và gửi lại trong thời gian sớm nhất.');

  if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
  try {
    await window.MH.supabaseReady;
    await window.MH.store.orders.update(o.id, {
      feedback_status: 'approved',
      approved_at: nowIso,
      approved_by: by,
      last_updated: nowIso
    });
    if (o.__raw) Object.assign(o.__raw, { feedback_status: 'approved', approved_at: nowIso, approved_by: by });

    const { data: staff } = await window.MH.supabase
      .from('users').select('id').in('role', ['admin', 'account']).eq('status', 'active');
    if (Array.isArray(staff) && staff.length) {
      const payloads = staff.map(function (u) {
        return {
          user_id: u.id,
          type: 'client_preview_approved',
          title: 'Client đã duyệt Preview',
          message: `Client đã đồng ý bản Preview của yêu cầu ${o.id}. Vui lòng chuẩn bị và gửi Final Link.`,
          link: 'database-orders.html?id=' + o.id,
          related_entity_type: 'orders',
          related_entity_id: o.id
        };
      });
      await window.MH.supabase.from('notifications').insert(payloads);
    }
  } catch (err) {
    console.warn('[client-dashboard] approve preview failed:', err);
    toast('warning', 'Sync lỗi', 'Đã lưu local. Vui lòng thử lại nếu Account chưa nhận thông báo.');
  }
}

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
  else if (action === 'approve-wording') approveWording(orderId);
  else if (action === 'wording-feedback') openWordingFeedbackModal(orderId);
  else if (action === 'approve-preview') approvePreview(orderId);
  else if (action === 'rating')   openRatingModal(orderId);
  else if (action === 'new-order-from') gotoRevisionForm(ORDERS.find(x => x.id === orderId));
  else if (action === 'preview') {
    const o = ORDERS.find(x => x.id === orderId);
    if (o && o.preview_link) window.open(o.preview_link, '_blank', 'noopener');
  }
});

// Tab buttons
document.querySelectorAll('.client-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// Chuông (#notif-btn) CHỈ mở dropdown thông báo — dropdown do app.js (buildDropdown) wire sẵn
// trên mọi button[aria-label="Thông báo"]. KHÔNG switchTab ở đây (gây nhảy tab khi bấm chuông).
// Xem danh sách đầy đủ qua sidebar / tab "Thông báo".

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
document.getElementById('rating-submit').addEventListener('click', async () => {
  const checked = document.querySelector('#star-rating input:checked');
  if (!checked) { toast('warning','Chọn mức đánh giá','Vui lòng chọn từ 1 đến 5 sao.'); return; }
  const score = +checked.value;
  const comment = document.getElementById('rating-comment').value.trim();
  const prev = state.ratingOrderId;
  state.ratings[prev] = { score: score, comment: comment };
  // Sync luôn vào order (mọi mode) để chống đánh giá trùng kể cả khi Supabase tắt.
  const ratedOrder = ORDERS.find(x => x.id === prev);
  if (ratedOrder) { ratedOrder.rating = score; ratedOrder.rating_comment = comment; if (ratedOrder.__raw) { ratedOrder.__raw.satisfaction_score = score; ratedOrder.__raw.client_feedback = comment; } }
  closeRatingModal();

  // Persist Supabase + notify staff (fire-and-forget). Trước đây chỉ lưu local → mất khi reload.
  if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
    try {
      await window.MH.store.orders.update(prev, {
        satisfaction_score: score,
        client_feedback: comment || null,
        last_updated: new Date().toISOString()
      });
      if (window.MH.supabase) {
        const { data: staff } = await window.MH.supabase
          .from('users').select('id').in('role', ['admin', 'account']).eq('status', 'active');
        if (Array.isArray(staff) && staff.length) {
          await window.MH.supabase.from('notifications').insert(staff.map(function (u) {
            return {
              user_id: u.id,
              type: 'rating_received',
              title: 'Client đã đánh giá',
              message: `${prev} — ${score}★ (${STAR_LABELS[score] || ''})${comment ? ' · "' + comment + '"' : ''}`,
              link: 'database-orders.html?id=' + prev,
              related_entity_type: 'orders',
              related_entity_id: prev
            };
          }));
        }
      }
    } catch (e) {
      console.warn('[client-dashboard] rating persist/notify failed:', e);
      toast('warning','Sync lỗi','Đánh giá đã lưu tạm, vui lòng thử lại nếu chưa cập nhật.');
    }
  }

  if (state.openOrderId === prev) openOrderDrawer(prev);
  renderAll();
  toast('success','Đã gửi đánh giá','Cảm ơn phản hồi của bạn!');
});

// Feedback modal
document.getElementById('feedback-close').addEventListener('click', closeFeedbackModal);
document.getElementById('feedback-cancel').addEventListener('click', closeFeedbackModal);
document.getElementById('feedback-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeFeedbackModal(); });

/* Phase 4 — wording feedback modal wiring */
(function wireWordingFeedbackModal() {
  const close = document.getElementById('wfb-close');
  const cancel = document.getElementById('wfb-cancel');
  const modal = document.getElementById('wording-feedback-modal');
  const submit = document.getElementById('wfb-submit');
  if (close) close.addEventListener('click', closeWordingFeedbackModal);
  if (cancel) cancel.addEventListener('click', closeWordingFeedbackModal);
  if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) closeWordingFeedbackModal(); });
  if (submit) submit.addEventListener('click', async () => {
    const o = ORDERS.find(x => x.id === state.wordingFeedbackOrderId);
    if (!o) { closeWordingFeedbackModal(); return; }
    if (!wordingActionable(o)) {
      toast('info', 'Đã gửi yêu cầu', 'Anh/chị đã gửi yêu cầu chỉnh brief cho yêu cầu này.');
      closeWordingFeedbackModal(); return;
    }
    if (wordingAtLimit(o)) {
      toast('info', 'Đã đạt tối đa 2 vòng', 'Yêu cầu đã dùng hết 2 vòng chỉnh wording. Vui lòng xác nhận brief hoặc liên hệ Account.');
      closeWordingFeedbackModal(); return;
    }
    const content = (document.getElementById('wfb-content').value || '').trim();
    const reason = (document.getElementById('wfb-reason').value || '').trim();
    const link = (document.getElementById('wfb-link').value || '').trim();
    if (!content) { toast('warning', 'Thiếu thông tin', 'Vui lòng nhập nội dung cần chỉnh.'); return; }

    const nextRound = (o.brief_wording_round || 0) + 1;
    const by = (user && (user.name || user.email)) || 'Client';
    const nowIso = new Date().toISOString();
    const fbText = `[Wording Vòng ${nextRound}] ${content}`
      + (reason ? `\nLý do: ${reason}` : '')
      + (link ? `\nTham khảo: ${link}` : '');

    // Optimistic UI
    o.brief_wording_status = 'client_feedback';
    o.brief_wording_round = nextRound;
    o.wording_client_feedback_at = nowIso;
    if (o.__raw) Object.assign(o.__raw, { brief_wording_status: 'client_feedback', brief_wording_round: nextRound, wording_client_feedback: fbText, wording_client_feedback_at: nowIso });
    closeWordingFeedbackModal();
    toast('success', 'Đã gửi yêu cầu chỉnh brief',
      nextRound >= WORDING_ROUND_LIMIT
        ? 'Đây là vòng chỉnh wording cuối (2/2). Team sẽ điều chỉnh và gửi lại bản chuẩn hóa để anh/chị xác nhận & chốt sản xuất.'
        : 'Team sẽ điều chỉnh và gửi lại bản chuẩn hóa để anh/chị xác nhận.');
    renderAll();
    openOrderDrawer(o.id);

    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
    try {
      await window.MH.supabaseReady;
      // Ghi qua RPC update_brief_wording (client KHÔNG có UPDATE orders trực tiếp dưới RLS).
      await window.MH.store.orders.updateWording(o.id, {
        brief_wording_status: 'client_feedback',
        brief_wording_round: nextRound,
        wording_client_feedback: fbText,
        wording_client_feedback_at: nowIso
      });
      const { data: staff } = await window.MH.supabase
        .from('users').select('id, role').in('role', ['admin', 'account', 'lead_content', 'content']).eq('status', 'active');
      if (Array.isArray(staff) && staff.length) {
        await window.MH.supabase.from('notifications').insert(staff.map(function (u) {
          // Link theo surface của từng role: content → Content Wording; lead_content → Content Workspace;
          // admin/account → Client Orders drawer (nơi Account kiểm tra & gửi Client).
          const link = (u.role === 'content' ? 'content-workbench.html?id='
            : (u.role === 'lead_content' ? 'content-team.html?id=' : 'database-orders.html?id=')) + o.id;
          return {
            user_id: u.id,
            // type base-CHECK-safe (chạy không phụ thuộc migration pending).
            type: 'order_status_changed',
            title: 'Client yêu cầu chỉnh brief wording',
            message: `Client yêu cầu chỉnh brief wording (Vòng ${nextRound}) cho yêu cầu ${o.id} · ${o.name || ''}. Content cần chỉnh & gửi lại Account duyệt.`,
            link: link,
            related_entity_type: 'orders',
            related_entity_id: o.id
          };
        }));
      }
    } catch (err) {
      console.warn('[client-dashboard] wording feedback failed:', err);
      toast('warning', 'Sync lỗi', 'Đã lưu local. Vui lòng thử lại nếu team chưa nhận thông báo.');
    }
  });
})();
document.getElementById('feedback-submit').addEventListener('click', async () => {
  const o = ORDERS.find(x => x.id === state.feedbackOrderId);
  if (!o) { closeFeedbackModal(); return; }
  // Chống gửi trùng: chỉ cho gửi khi đang thực sự chờ feedback (waiting_feedback / chưa set).
  if (o.feedback_status && o.feedback_status !== 'waiting_feedback') {
    toast('info', 'Đã gửi feedback', 'Anh/chị đã gửi feedback cho bản Preview này. Vui lòng chờ team Media gửi bản Preview tiếp theo.');
    closeFeedbackModal(); return;
  }
  const applies = appliesRevisionRule(o);
  const round = o.revision_round || 0;
  const limit = o.revision_limit || 3;

  // Vòng 4 (order design đã đủ 3 vòng) → KHÔNG lưu như feedback thường.
  if (applies && round >= limit) {
    toast('warning', 'Đã đủ 03 vòng feedback', ROUND4_MESSAGE);
    return;
  }

  const type = document.getElementById('fb-type').value;
  const content = document.getElementById('fb-content').value.trim();
  if (!type || !content) { toast('warning','Thiếu thông tin','Vui lòng chọn loại phản hồi và nhập nội dung.'); return; }

  const nextRound = round + 1;
  const isR3 = applies && nextRound >= limit; // vòng feedback cuối
  const noteText = `[Feedback Vòng ${nextRound}] ${type}: ${content}`;
  const by = (user && (user.name || user.email)) || 'Client';
  const nowIso = new Date().toISOString();

  // Optimistic UI: cập nhật state local
  o.revision_round = nextRound;
  o.feedback_status = 'feedback_received';
  o.latest_feedback_note = noteText;
  o.last_feedback_at = nowIso;
  o.last_feedback_by = by;
  closeFeedbackModal();
  if (isR3) toast('success', 'Đã gửi Feedback Vòng 3 — Final Check', 'Đây là vòng feedback cuối cùng của yêu cầu này. Team Media sẽ xử lý các nội dung anh/chị đã phản hồi và gửi bản Final sau khi hoàn tất.');
  else toast('success', `Đã gửi Feedback Vòng ${nextRound}`, 'Team Media sẽ xử lý phản hồi của anh/chị sớm nhất.');
  renderAll();

  // Persist Supabase + notify admin/account (fire-and-forget)
  if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
  try {
    await window.MH.supabaseReady;
    await window.MH.store.orders.update(o.id, {
      revision_round: nextRound,
      feedback_status: 'feedback_received',
      latest_feedback_note: noteText,
      last_feedback_at: nowIso,
      last_feedback_by: by,
      last_updated: nowIso
    });
    if (o.__raw) Object.assign(o.__raw, { revision_round: nextRound, feedback_status: 'feedback_received', latest_feedback_note: noteText, last_feedback_at: nowIso, last_feedback_by: by });

    const { data: staff } = await window.MH.supabase
      .from('users').select('id').in('role', ['admin', 'account']).eq('status', 'active');
    if (Array.isArray(staff) && staff.length) {
      const payloads = staff.map(function (u) {
        return {
          user_id: u.id,
          type: 'client_feedback_received',
          title: isR3 ? 'Client đã gửi Feedback Vòng 3 — Final Check' : 'Client đã gửi feedback',
          message: isR3
            ? `Client đã gửi feedback vòng cuối cho yêu cầu ${o.id}. Account/Admin cần chuyển feedback này cho PIC xử lý. Sau khi xử lý, PIC cần cập nhật Final Link để bàn giao cho Client.`
            : `Client đã gửi feedback Vòng ${nextRound} cho yêu cầu ${o.id} · ${o.name || ''}.`,
          link: 'database-orders.html?id=' + o.id,
          related_entity_type: 'orders',
          related_entity_id: o.id
        };
      });
      await window.MH.supabase.from('notifications').insert(payloads);
    }
  } catch (err) {
    console.warn('[client-dashboard] submit feedback failed:', err);
    toast('warning', 'Sync lỗi', 'Đã lưu local. Vui lòng thử lại nếu Account chưa nhận thông báo.');
  }
});

// Round-4 CTA: tạo yêu cầu mới (điều hướng sang form order với prefill từ order gốc)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="new-request"]');
  if (!btn) return;
  const o = ORDERS.find(x => x.id === state.feedbackOrderId);
  closeFeedbackModal();
  gotoRevisionForm(o);
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
  // Persist Supabase để dot KHÔNG quay lại sau reload + để badge chuông (app.js,
  // đọc is_read từ Supabase) cũng tự clear ở lần refresh kế. Trước đây chỉ set local.
  if (window.MH && window.MH.store && window.MH.store.notifications && window.MH.supabaseEnabled) {
    Promise.resolve(window.MH.store.notifications.markAllRead()).catch(function (err) {
      console.warn('[client-dashboard] markAllRead failed:', err);
    });
  }
  toast('success','Đã đánh dấu đọc','Tất cả thông báo đã được đánh dấu là đã đọc.');
});

/* ===== RENDER ALL ===== */
function renderAll() {
  renderKPIs();
  renderActionCenter();
  renderCurrentOrders();
  renderOrdersTable();
  renderNotifications();
  maybeRemindRating();
}
// Nhắc nhẹ client đánh giá (1 lần/phiên) nếu có sản phẩm đã bàn giao mà chưa rating → tăng tỉ lệ rating.
function maybeRemindRating() {
  if (state._ratingReminded) return;
  const pending = ORDERS.filter((o) => isFinalDelivered(o) && !state.ratings[o.id]);
  if (!pending.length) return;
  state._ratingReminded = true;
  setTimeout(function () {
    toast('info', '⭐ ' + pending.length + ' sản phẩm chưa đánh giá',
      'Dành vài giây đánh giá giúp team Media cải thiện chất lượng. Mở yêu cầu đã bàn giao để đánh giá (không bắt buộc).');
  }, 1600);
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
