/* =====================================================================
   content-team.js — Content Team Workspace (Lead Content + Content)
   - Team TÁCH BIỆT khỏi Production/Task Tracker: queue/board/drawer/review riêng.
   - Roles: admin (full) · account (read + theo dõi, action ở Client Orders)
            lead_content (gán PIC, đặt hạn, duyệt/trả chỉnh)
            content (làm wording được gán, lưu nháp, gửi Lead).
   - Flow: Account "Chuyển Content Wording" → assigned (Inbox Lead)
       → Lead gán PIC (pic_assigned) → Content làm (in_progress)
       → Content gửi Lead (submitted_to_lead) → Lead duyệt (submitted_to_account)
         hoặc trả chỉnh (lead_revision ↺)
       → Account gửi Client (sent_to_client) → Client approve/feedback (Client Portal).
   - Persist: localStorage cache `mh-wording-drafts` (CHUNG với content-workbench)
     + Supabase RPC update_brief_wording (⚠ cần supabase/add-content-team.sql).
   - Client KHÔNG truy cập; design/editor KHÔNG truy cập.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth guard ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (user.role === 'client') { location.replace('client-dashboard.html'); return; }
  // Content Workspace = trang của LEAD (sidebar "Content Team → Content Workspace").
  // Role content làm việc ở Content Wording — redirect kèm ?id để mở đúng order.
  if (user.role === 'content') {
    const q = new URLSearchParams(location.search).get('id');
    location.replace('content-workbench.html' + (q ? '?id=' + encodeURIComponent(q) : ''));
    return;
  }
  // system_supervisor = monitor read-only: vào xem được, nhưng KHÔNG có cờ Lead/Content/Account
  // → mọi nút action (gán PIC, duyệt, gửi…) tự ẩn (canWork/canLeadReview/canAssign đều false).
  if (['admin', 'account', 'lead_content', 'system_supervisor'].indexOf(user.role) < 0) {
    if (window.MH && window.MH.toast) window.MH.toast({ type: 'warning', title: 'Không có quyền', message: 'Content Workspace chỉ dành cho Admin / Account / Lead Content.' });
    setTimeout(function () { location.replace('dashboard.html'); }, 900);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  const isAdmin = user.role === 'admin';
  const isAccount = user.role === 'account';
  const isSupervisor = user.role === 'system_supervisor'; // read-only monitor
  const isLead = user.role === 'lead_content' || isAdmin;          // quyền Lead Content
  const isContent = user.role === 'content' || isAdmin;            // quyền Content (admin demo được cả 2)
  const isAccountAdmin = isAdmin || isAccount;

  (function initChip() {
    const n = document.getElementById('hpc-name'); if (n) n.textContent = user.name || 'User';
    const a = document.getElementById('hpc-avatar'); if (a) a.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
    const r = document.getElementById('hpc-role-badge'); if (r) {
      r.textContent = user.role === 'lead_content' ? 'Lead Content' : user.role.charAt(0).toUpperCase() + user.role.slice(1);
      r.className = 'role-badge r--' + user.role + ' header-pc-role';
    }
    const lo = document.getElementById('logout-btn'); if (lo) lo.addEventListener('click', function () { localStorage.removeItem('mh-user'); if (window.MH && window.MH.toast) window.MH.toast({ type: 'info', title: 'Đã đăng xuất' }); setTimeout(function () { location.replace('login.html'); }, 400); });
  })();

  /* ---------- Helpers ---------- */
  function toast(t, ti, m) { if (window.MH && window.MH.toast) window.MH.toast({ type: t, title: ti, message: m }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function fmtDT(s) { if (!s) return '—'; s = String(s); const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z'); if (isNaN(d.getTime())) return s; const p = function (n) { return String(n).padStart(2, '0'); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function toLocalInput(s) { if (!s) return ''; const d = new Date(/[Z+]/.test(String(s).slice(10)) ? s : String(s).replace(' ', 'T') + 'Z'); if (isNaN(d.getTime())) return ''; const p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function initials(name) { return String(name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }
  // PIC match kiểu isMyTask (production-board): bằng nhau HOẶC chứa theo ranh giới từ.
  function isMine(picName) {
    if (!picName || !user.name) return false;
    const a = String(picName).trim().toLowerCase();
    const b = String(user.name).trim().toLowerCase();
    if (a === b) return true;
    return new RegExp('(^|\\s)' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(b)
      || new RegExp('(^|\\s)' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(a);
  }
  // Trễ hạn wording — same rule với content-workbench/database-orders.
  function isWordingOverdue(o) {
    if (!o || !o.wording_deadline) return false;
    const ws = o.brief_wording_status || 'none';
    if (ws === 'client_approved' || ws === 'completed') return false;
    if (o.account_status === 'rejected' || o.production_status === 'cancelled') return false;
    const s = String(o.wording_deadline);
    const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z');
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  }

  /* ---------- Constants ---------- */
  const WSTATUS = {
    none: 'Chưa chuyển Content Wording',
    assigned: 'Inbox — chờ Lead phân công',
    pic_assigned: 'Đã gán PIC — chờ bắt đầu',
    in_progress: 'Content đang viết',
    submitted_to_lead: 'Chờ Lead Content duyệt',
    lead_revision: 'Lead yêu cầu chỉnh',
    submitted_to_account: 'Lead đã duyệt — chờ Account',
    account_revision: 'Account yêu cầu chỉnh',
    sent_to_client: 'Chờ Client xác nhận',
    client_feedback: 'Client yêu cầu chỉnh',
    client_approved: 'Client đã xác nhận',
    completed: 'Hoàn tất Content Wording'
  };
  const ENGAGED = ['assigned', 'pic_assigned', 'in_progress', 'submitted_to_lead', 'lead_revision', 'submitted_to_account', 'account_revision', 'sent_to_client', 'client_feedback', 'client_approved', 'completed'];
  // Content được chỉnh/gửi khi wording đang ở pha Content.
  const WS_CONTENT_EDITABLE = ['pic_assigned', 'in_progress', 'lead_revision', 'account_revision', 'client_feedback'];
  const STAT_CARDS = [
    { k: 'inbox', label: 'Inbox chờ phân công', color: '#191970', match: ['assigned'] },
    { k: 'writing', label: 'Đang viết', color: '#1D4ED8', match: ['pic_assigned', 'in_progress'] },
    { k: 'lead_review', label: 'Chờ Lead duyệt', color: '#6B21A8', match: ['submitted_to_lead'] },
    { k: 'revision', label: 'Cần chỉnh sửa', color: '#B07600', match: ['lead_revision', 'account_revision', 'client_feedback'] },
    { k: 'waiting', label: 'Chờ Account / Client', color: '#0E7490', match: ['submitted_to_account', 'sent_to_client'] },
    { k: 'done', label: 'Đã xác nhận', color: '#0A7A52', match: ['client_approved', 'completed'] },
    { k: 'overdue', label: 'Trễ hạn wording', color: '#BA110F', match: null } // tính riêng
  ];
  const KANBAN_COLS = [
    { key: 'ct-inbox', title: 'Inbox', statuses: ['assigned'] },
    { key: 'ct-todo', title: 'Đã gán PIC', statuses: ['pic_assigned'] },
    { key: 'ct-writing', title: 'Đang viết', statuses: ['in_progress'] },
    { key: 'ct-lead', title: 'Chờ Lead duyệt', statuses: ['submitted_to_lead'] },
    { key: 'ct-revision', title: 'Cần chỉnh', statuses: ['lead_revision', 'account_revision', 'client_feedback'] },
    { key: 'ct-waiting', title: 'Chờ Account/Client', statuses: ['submitted_to_account', 'sent_to_client'] },
    { key: 'ct-done', title: 'Hoàn tất', statuses: ['client_approved', 'completed'] }
  ];
  const TYPE_LABEL = { design: 'Thiết kế', media: 'Quay / Chụp', video: 'Video', motion: 'Motion', slide: 'Slide', digital: 'Digital', other: 'Khác', photo: 'Chụp', shoot: 'Quay', ads: 'Ads / Post' };
  const PRIO_LABEL = { normal: 'Bình thường', urgent: 'Gấp', critical: 'Rất gấp' };
  const CHECKLIST = [
    { k: 'goal', label: 'Đã hiểu đúng mục tiêu truyền thông' },
    { k: 'info', label: 'Đã kiểm tra đủ thông tin bắt buộc' },
    { k: 'message', label: 'Đã chuẩn hóa thông điệp chính' },
    { k: 'cta', label: 'Đã đề xuất CTA phù hợp' },
    { k: 'clarity', label: 'Đã loại bỏ nội dung mơ hồ / thiếu rõ ràng' },
    { k: 'prodnote', label: 'Đã ghi chú rõ điểm cần Production lưu ý' },
    { k: 'tone', label: 'Đã kiểm tra tone phù hợp brand CB' }
  ];
  const WFIELDS = [
    { k: 'wording_brief', label: 'Brief đã wording', req: true, rows: 5 },
    { k: 'wording_objective', label: 'Mục tiêu sau khi chuẩn hóa', rows: 2 },
    { k: 'wording_core_message', label: 'Thông điệp chính', req: true, rows: 2 },
    { k: 'wording_required_info', label: 'Thông tin bắt buộc cần thể hiện', rows: 3 },
    { k: 'wording_tone_style', label: 'Tone & style nội dung', rows: 2 },
    { k: 'wording_cta', label: 'CTA đề xuất', rows: 1 },
    { k: 'wording_production_note', label: 'Ghi chú cho Production team', rows: 2 }
  ];
  const LINKS = [
    { k: 'wording_client_source_link', label: 'Client source link' },
    { k: 'wording_doc_link', label: 'Working Google Doc link' },
    { k: 'wording_reference_link', label: 'Reference link' },
    { k: 'wording_internal_link', label: 'Internal wording link' }
  ];
  const LIFE = ['Inbox Lead Content', 'Gán PIC Content', 'Content thực hiện', 'Lead Content duyệt', 'Account duyệt', 'Client xác nhận', 'Hoàn tất'];
  const LIFE_REACHED = {
    none: 0, assigned: 1, pic_assigned: 2, in_progress: 2, lead_revision: 2,
    submitted_to_lead: 3, account_revision: 2, submitted_to_account: 4,
    sent_to_client: 5, client_feedback: 5, client_approved: 7, completed: 7
  };

  /* ---------- LocalStorage cache (CHUNG với content-workbench) ---------- */
  const WCACHE_KEY = 'mh-wording-drafts';
  function loadCache() { try { return JSON.parse(localStorage.getItem(WCACHE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveCache(c) { try { localStorage.setItem(WCACHE_KEY, JSON.stringify(c)); } catch (e) { } }
  function cacheOf(id) { return loadCache()[id] || {}; }
  function setCache(id, patch) { const c = loadCache(); c[id] = Object.assign({}, c[id], patch); saveCache(c); return c[id]; }
  function pushActivity(id, text) { const c = loadCache(); const e = c[id] || (c[id] = {}); e.activity = e.activity || []; e.activity.push({ text: text, by: user.name || user.role, at: new Date().toISOString() }); saveCache(c); }
  function parseChecklist(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }

  /* ---------- State ---------- */
  let ORDERS = [];
  // Cờ nghi RLS chặn đọc orders: Lead Content (role thật) đọc về 0 đơn khi Supabase bật
  // = dấu hiệu mạnh của thiếu policy "orders lead_content read" hoặc role DB sai
  // (RLS lọc rows KHÔNG sinh error nên không catch được → phải suy từ heuristic).
  // Chỉ dùng để đổi empty-state Inbox (inline, không toast — tránh phiền khi hệ thống
  // mới tinh chưa có đơn nào).
  let ordersReadBlocked = false;
  let CONTENT_USERS = []; // users role=content (gán PIC)
  let current = null;
  // Phase 2 — Content Plans + Tasks (data model mới, TÁCH BIỆT orders/brief_wording).
  let CONTENT_PLANS = [];
  let CONTENT_TASKS = [];
  let currentPlan = null;
  let currentTask = null;
  let view = isLead && !isAdmin ? 'inbox' : (user.role === 'content' ? 'mine' : 'dashboard');
  const FILTERS = { search: '', status: '', type: '', pic: '' };

  /* ---------- Quyền theo trạng thái ---------- */
  function canWork(o) {
    if (!o) return false;
    if (isAdmin) return WS_CONTENT_EDITABLE.indexOf(o.brief_wording_status || 'none') >= 0;
    if (user.role !== 'content') return false;
    if (WS_CONTENT_EDITABLE.indexOf(o.brief_wording_status || 'none') < 0) return false;
    return owIsMine(o); // chỉ PIC được gán mới chỉnh
  }
  function canAssign(o) {
    if (!o || !isLead) return false;
    const ws = o.brief_wording_status || 'none';
    return ws !== 'client_approved' && ws !== 'completed' && o.account_status !== 'rejected' && o.production_status !== 'cancelled';
  }
  function canLeadReview(o) { return !!o && isLead && (o.brief_wording_status === 'submitted_to_lead'); }

  /* ---------- Data load ---------- */
  async function loadOrders() {
    let list = [];
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try { await window.MH.supabaseReady; list = (await window.MH.store.orders.list()) || []; } catch (e) { console.warn('[ctm] load failed:', e); }
    } else {
      try { list = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]'); } catch (e) { list = []; }
    }
    const cache = loadCache();
    // DB là nguồn thật cho lifecycle khi Supabase bật; cache chỉ preserve nháp.
    // Khác content-workbench: chỉ override khi DB có giá trị (cột mới có thể CHƯA migrate).
    const DB_AUTH = ['brief_wording_status', 'brief_wording_round', 'brief_wording_pic', 'brief_wording_pic_user_id', 'wording_last_updated_at',
      'wording_submitted_at', 'wording_submitted_by', 'wording_client_sent_at', 'wording_client_sent_by',
      'wording_approved_at', 'wording_client_feedback', 'wording_client_feedback_at',
      'wording_account_note', 'wording_lead_note', 'wording_lead_reviewed_at', 'wording_lead_reviewed_by',
      'wording_submitted_to_lead_at', 'wording_deadline', 'account_status', 'production_status'];
    const sbOn = !!(window.MH && window.MH.supabaseEnabled);
    list = list.map(function (o) {
      const c = cache[o.order_id];
      if (!c) return o;
      const merged = Object.assign({}, o, c);
      if (sbOn) DB_AUTH.forEach(function (k) { if (o[k] !== undefined) merged[k] = o[k]; });
      return merged;
    });
    window.__CTM_ALL = list;
    // Chỉ tính cho Lead Content THẬT (không phải admin — admin đọc orders qua is_staff,
    // 0 đơn với admin là rỗng thật). Lead đọc orders CHỈ qua policy "orders lead_content read";
    // thiếu policy / role DB sai → RLS trả [] im lặng → Inbox rỗng dù đã có đơn.
    ordersReadBlocked = sbOn && user.role === 'lead_content' && list.length === 0;
    ORDERS = list.filter(function (o) { return ENGAGED.indexOf(o.brief_wording_status || 'none') >= 0; });
    ADS_ORDERS = list.filter(function (o) { return o.order_kind === 'ads_order'; });
    renderAll();
  }
  async function loadContentUsers() {
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try {
        await window.MH.supabaseReady;
        // TẤT CẢ users (lead_content/content đọc được qua policy "users content team read")
        // → nạp directory resolve id→tên hiện tại (PIC keyed theo user_id).
        const all = (await window.MH.store.users.list()) || [];
        if (window.MH.setUserDir) window.MH.setUserDir(all);
        CONTENT_USERS = all.filter(function (u) { return u.role === 'content' && u.status !== 'inactive'; });
      } catch (e) { console.warn('[ctm] load content users failed:', e); }
    }
  }

  /* ---------- Notifications (fire-and-forget, pattern notifyContentWording) ---------- */
  async function notifyRoles(roles, payload) {
    if (!window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    try {
      const { data: us } = await window.MH.supabase
        .from('users').select('id').in('role', roles).eq('status', 'active');
      if (Array.isArray(us) && us.length) {
        await window.MH.supabase.from('notifications').insert(us.map(function (u) { return Object.assign({ user_id: u.id }, payload); }));
      }
    } catch (e) { console.warn('[ctm] notify roles failed:', e); }
  }
  async function notifyByName(name, payload) {
    if (!window.MH || !window.MH.supabaseEnabled || !window.MH.store) return;
    try {
      const uid = await window.MH.store.notifications.findUserIdByName(name);
      if (uid) await window.MH.store.notifications.create(Object.assign({ user_id: uid }, payload));
    } catch (e) { console.warn('[ctm] notify by name failed:', e); }
  }
  // Notify trực tiếp theo user_id (PIC content_tasks keyed theo id — khỏi lookup tên).
  async function notifyUserId(uid, payload) {
    if (!uid || !window.MH || !window.MH.supabaseEnabled || !window.MH.store) return;
    try { await window.MH.store.notifications.create(Object.assign({ user_id: uid }, payload)); }
    catch (e) { console.warn('[ctm] notify by id failed:', e); }
  }
  // link mặc định → Workspace (lead); notify cho PIC content thì truyền link Wording.
  function notifPayload(o, type, title, message, link) {
    return {
      type: type, title: title, message: message,
      link: (link || 'content-team.html?id=') + (o.order_id || ''),
      related_entity_type: 'orders', related_entity_id: o.order_id
    };
  }

  /* ---------- Persist ---------- */
  async function persist(o, patch, activity) {
    Object.assign(o, patch);
    setCache(o.order_id, patch);
    if (activity) pushActivity(o.order_id, activity);
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      // Ghi qua RPC update_brief_wording (content/lead_content KHÔNG có UPDATE orders trực tiếp).
      try { await window.MH.store.orders.updateWording(o.order_id, patch); }
      catch (e) {
        console.warn('[ctm] persist failed:', e);
        toast('warning', 'Chưa đồng bộ được DB', 'Thay đổi mới lưu cục bộ. Kiểm tra đã chạy supabase/add-content-team.sql chưa.');
      }
    } else {
      try {
        const arr = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]');
        const idx = arr.findIndex(function (x) { return x.order_id === o.order_id; });
        if (idx >= 0) { arr[idx] = Object.assign({}, arr[idx], patch); localStorage.setItem('mh-submitted-orders', JSON.stringify(arr)); }
      } catch (e) { }
    }
  }
  async function reloadAndReopen() {
    const id = current && current.order_id;
    await loadOrders();
    if (!id) return;
    const o = ORDERS.find(function (x) { return x.order_id === id; });
    if (o) openDrawer(o); else closeDrawer();
  }

  /* ===================================================================
     RENDER — tabs / dashboard / inbox / board / list / mine
     =================================================================== */
  function byStatus(statuses) { return ORDERS.filter(function (o) { return statuses.indexOf(o.brief_wording_status || 'none') >= 0; }); }
  function myOrders() { return ORDERS.filter(function (o) { return owIsMine(o); }); }

  function renderTabs() {
    // Role-gate tab: Inbox chỉ Lead/Admin; Mine chỉ Content/Admin.
    document.querySelectorAll('#ctm-tabs [data-ctm-view]').forEach(function (b) {
      const v = b.getAttribute('data-ctm-view');
      if (v === 'inbox' && !isLead) { b.style.display = 'none'; return; }
      if (v === 'mine' && !(isContent || user.role === 'content')) { b.style.display = 'none'; return; }
      // Plans + Initiatives: Lead Content / Admin điều phối (Account read-only được xem nếu cần).
      if ((v === 'plans' || v === 'initiatives') && !(isLead || isAccountAdmin || isSupervisor)) { b.style.display = 'none'; return; }
      // Ads Orders: Lead Content / Admin điều phối; Account/Supervisor xem read-only.
      if (v === 'ads-orders' && !(isLead || isAccountAdmin || isSupervisor)) { b.style.display = 'none'; return; }
      b.classList.toggle('is-active', v === view);
    });
    var cAds = document.getElementById('ctm-count-ads'); if (cAds) cAds.textContent = ADS_ORDERS.length;
    // Badge Inbox = order chờ phân công + order chờ duyệt + TASK NỘI BỘ chờ duyệt
    // (trước đây thiếu vế cuối nên Lead thấy 0 dù có task đang chờ mình).
    document.getElementById('ctm-count-inbox').textContent = byStatus(['assigned']).length + byStatus(['submitted_to_lead']).length + pendingContentTasks().length;
    document.getElementById('ctm-count-list').textContent = ORDERS.length;
    document.getElementById('ctm-count-mine').textContent = myOrders().length;
    var cPlans = document.getElementById('ctm-count-plans'); if (cPlans) cPlans.textContent = CONTENT_PLANS.length;
    var cInit = document.getElementById('ctm-count-initiatives'); if (cInit) cInit.textContent = initiativeTasks().length;
    ['dashboard', 'inbox', 'ads-orders', 'plans', 'initiatives', 'board', 'list', 'mine'].forEach(function (v) {
      const el = document.getElementById('ctm-view-' + v);
      if (el) el.hidden = v !== view;
    });
  }

  function renderStats() {
    const counts = {};
    ORDERS.forEach(function (o) { const w = o.brief_wording_status || 'none'; counts[w] = (counts[w] || 0) + 1; });
    const overdue = ORDERS.filter(isWordingOverdue).length;
    document.getElementById('ctm-stats').innerHTML = STAT_CARDS.map(function (s) {
      const val = s.match ? s.match.reduce(function (sum, k) { return sum + (counts[k] || 0); }, 0) : overdue;
      return '<div class="cwb-stat" style="border-top-color:' + s.color + '"><div class="cwb-stat-val" style="color:' + s.color + '">' + val + '</div><div class="cwb-stat-label">' + s.label + '</div></div>';
    }).join('');
  }

  // Inline SVG Lucide-style cho empty-state (KHÔNG emoji structural).
  const ICON_USERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const ICON_LAYERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  function ctmEmpty(icon, title, help) {
    return '<div class="ctm-empty">' + icon + '<div class="ctm-empty-title">' + esc(title) + '</div>' + (help ? '<div class="ctm-empty-help">' + esc(help) + '</div>' : '') + '</div>';
  }

  function renderWorkload() {
    const el = document.getElementById('ctm-workload'); if (!el) return;
    const per = {};
    // Order-wording đang chạy (brief_wording_pic).
    ORDERS.forEach(function (o) {
      const ws = o.brief_wording_status || 'none';
      if (['client_approved', 'completed'].indexOf(ws) >= 0) return;
      var nm = owPicName(o);
      if (!nm) return;
      per[nm] = (per[nm] || 0) + 1;
    });
    // Content Task đang hoạt động (assigned_pic) — gộp để workload phản ánh đủ việc Content.
    CONTENT_TASKS.forEach(function (t) {
      const nm = ctPicName(t);
      if (!nm) return;
      if (CT_DONE.indexOf(t.status) >= 0 || t.status === 'archived') return;
      per[nm] = (per[nm] || 0) + 1;
    });
    const entries = Object.keys(per).map(function (k) { return [k, per[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) {
      el.innerHTML = ctmEmpty(ICON_USERS, 'Chưa có wording đang chạy', 'Khi Lead Content gán PIC, workload sẽ hiển thị tại đây.');
      return;
    }
    // Scale theo PIC bận nhất; denom tối thiểu 4 để value nhỏ KHÔNG kéo full width gây hiểu nhầm.
    const denom = Math.max(entries[0][1], 4);
    el.innerHTML = entries.map(function (e) {
      const w = Math.max(Math.round(e[1] / denom * 100), 6);
      return '<div class="ctm-wl-row"><span class="ctm-wl-name"><span class="pic-avatar avatar">' + esc(initials(e[0])) + '</span>' + esc(e[0]) + '</span>'
        + '<span class="ctm-wl-track"><i style="width:' + w + '%"></i></span><b class="ctm-wl-val">' + e[1] + '</b></div>';
    }).join('');
  }

  function renderOverdueList() {
    const list = ORDERS.filter(isWordingOverdue);
    document.getElementById('ctm-overdue-count').textContent = list.length + ' order';
    document.getElementById('ctm-overdue-list').innerHTML = list.length ? list.map(function (o) {
      return '<button class="ctm-inbox-item" data-open="' + esc(o.order_id) + '">'
        + '<div><b>' + esc(o.order_id) + '</b> · ' + esc(o.project_name || '—') + '</div>'
        + '<div class="text-xs"><span class="cwb-overdue">⚠ Hạn ' + esc(fmtDT(o.wording_deadline)) + '</span> · ' + esc(WSTATUS[o.brief_wording_status] || '') + ' · PIC: ' + esc(owPicName(o) || 'chưa gán') + '</div>'
        + '</button>';
    }).join('') : ctmEmpty(ICON_CHECK, 'Không có order trễ hạn', 'Tất cả wording đang trong hạn.');
  }

  function renderRecentActivity() {
    const cache = loadCache();
    let acts = [];
    ORDERS.forEach(function (o) {
      ((cache[o.order_id] || {}).activity || []).forEach(function (a) { acts.push({ id: o.order_id, text: a.text, by: a.by, at: a.at }); });
    });
    acts.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    document.getElementById('ctm-recent-activity').innerHTML = acts.length ? acts.slice(0, 10).map(function (a) {
      return '<li><span><b>' + esc(a.id) + '</b> — ' + esc(a.text) + ' · <b>' + esc(a.by) + '</b></span><time>' + fmtDT(a.at) + '</time></li>';
    }).join('') : '<li><span class="muted">Chưa có hoạt động.</span></li>';
  }

  function inboxItemHtml(o, extra) {
    return '<button class="ctm-inbox-item" data-open="' + esc(o.order_id) + '">'
      + '<div class="ctm-ii-top"><b>' + esc(o.order_id) + '</b><span class="priority-pill p--' + (o.priority || 'normal') + '"><span class="dot"></span>' + esc(PRIO_LABEL[o.priority] || '—') + '</span></div>'
      + '<div class="ctm-ii-title">' + esc(o.project_name || '—') + '</div>'
      + '<div class="text-xs muted">' + esc(TYPE_LABEL[o.request_type] || o.request_type || '—') + ' · ' + esc(o.department || '—') + (extra || '') + '</div>'
      + '</button>';
  }
  function renderInbox() {
    const news = byStatus(['assigned']);
    const reviews = byStatus(['submitted_to_lead']);
    document.getElementById('ctm-inbox-new-count').textContent = news.length + ' yêu cầu';
    document.getElementById('ctm-inbox-review-count').textContent = reviews.length + ' bản chờ duyệt';
    // Empty-state phân biệt "chưa có đơn" vs "RLS chặn đọc" (hết rỗng câm — xem loadOrders).
    const newEmpty = ordersReadBlocked
      ? '<div class="text-xs" style="margin:0;padding:12px 16px;color:var(--danger)"><b>Không đọc được đơn nào.</b> Nếu Account đã chuyển đơn sang Content Wording mà vẫn trống: kiểm tra đã chạy <code>add-content-team.sql</code> (policy "orders lead_content read") và role tài khoản trong DB = <code>lead_content</code>.</div>'
      : '<p class="text-xs muted" style="margin:0;padding:12px 16px">Không có yêu cầu mới.</p>';
    document.getElementById('ctm-inbox-new').innerHTML = news.length ? news.map(function (o) {
      return inboxItemHtml(o, o.wording_deadline ? ' · Hạn: ' + fmtDT(o.wording_deadline) : ' · Chưa đặt hạn');
    }).join('') : newEmpty;
    document.getElementById('ctm-inbox-review').innerHTML = reviews.length ? reviews.map(function (o) {
      return inboxItemHtml(o, ' · PIC: ' + esc(owPicName(o) || '—') + (o.wording_submitted_to_lead_at ? ' · Gửi: ' + fmtDT(o.wording_submitted_to_lead_at) : ''));
    }).join('') : '<p class="text-xs muted" style="margin:0;padding:12px 16px">Không có bản wording chờ duyệt.</p>';

    // Task nội bộ chờ duyệt — nguồn KHÁC (bảng content_tasks, không phải orders).
    // Trước đây chỉ nằm ở tab "Task nội bộ" nên Lead nhìn Inbox thấy trống → tưởng mất task.
    const ctPending = pendingContentTasks();
    const ctCountEl = document.getElementById('ctm-inbox-ct-count');
    if (ctCountEl) ctCountEl.textContent = ctPending.length + ' task chờ duyệt';
    const ctBox = document.getElementById('ctm-inbox-ct');
    if (ctBox) {
      ctBox.innerHTML = ctPending.length ? ctPending.map(function (t) {
        const late = reviewLateCT(t);
        return '<button class="ctm-inbox-item" data-task-open="' + esc(t.id) + '">'
          + '<div><b>' + esc(ctCode(t)) + '</b> · ' + esc(t.title || '—') + '</div>'
          + '<div class="text-xs muted">PIC: ' + esc(ctPicName(t) || '—')
          + (t.lead_review_due ? ' · Hạn duyệt: ' + fmtDT(t.lead_review_due) : '')
          + (late ? ' · ⚠ quá hạn duyệt' : '') + '</div>'
          + '</button>';
      }).join('') : '<p class="text-xs muted" style="margin:0;padding:12px 16px">Không có task nội bộ chờ duyệt.</p>';
    }
  }
  // Content task PIC đã gửi Lead duyệt (mọi nguồn: tự đề xuất, task con Plan, Ads).
  function pendingContentTasks() {
    return CONTENT_TASKS.filter(function (t) { return t.status === 'submitted_to_lead'; })
      .sort(function (a, b) { return String(a.lead_review_due || '').localeCompare(String(b.lead_review_due || '')); });
  }

  function renderBoard() {
    document.getElementById('ctm-board').innerHTML = KANBAN_COLS.map(function (col) {
      const items = byStatus(col.statuses);
      const cards = items.map(function (o) {
        const overdue = isWordingOverdue(o);
        return '<div class="kanban-card' + (overdue ? ' is-overdue' : '') + '" data-open="' + esc(o.order_id) + '">'
          + '<div class="kc-head"><span class="kc-id">' + esc(o.order_id) + '</span><span class="priority-pill kc-priority p--' + (o.priority || 'normal') + '"><span class="dot"></span>' + esc(PRIO_LABEL[o.priority] || '—') + '</span></div>'
          + '<div class="kc-title">' + esc(o.project_name || '—') + '</div>'
          + '<div class="kc-meta">'
          + (owPicName(o) ? '<span class="kc-pic"><span class="pic-avatar avatar">' + esc(initials(owPicName(o))) + '</span>' + esc(owPicName(o)) + '</span>' : '<span class="muted">Chưa gán PIC</span>')
          + (o.wording_deadline ? '<span class="kc-deadline' + (overdue ? ' is-overdue' : '') + '">' + fmtDT(o.wording_deadline) + '</span>' : '')
          + '</div>'
          + '<div class="kc-flags"><span class="kc-flag">Vòng ' + (o.brief_wording_round || 0) + '</span>' + (o.wording_doc_link ? '<span class="kc-flag has-preview">Doc</span>' : '') + '</div>'
          + '</div>';
      }).join('');
      return '<div class="kanban-col" data-status="' + col.key + '">'
        + '<div class="kanban-col-head"><span class="col-title">' + col.title + '</span><span class="col-count">' + items.length + '</span></div>'
        + '<div class="kanban-col-body">' + (cards || '<p class="text-xs muted" style="margin:8px 4px">Trống</p>') + '</div>'
        + '</div>';
    }).join('');
  }

  function rowHtml(o, withPic) {
    const ws = o.brief_wording_status || 'none';
    const overdue = isWordingOverdue(o);
    return '<tr data-id="' + esc(o.order_id) + '">'
      + '<td><span class="order-id">' + esc(o.order_id) + '</span></td>'
      + '<td><b>' + esc(o.project_name || '—') + '</b></td>'
      + '<td><span class="text-xs">' + esc(TYPE_LABEL[o.request_type] || o.request_type || '—') + '</span></td>'
      + '<td><span class="priority-pill p--' + (o.priority || 'normal') + '"><span class="dot"></span>' + esc(PRIO_LABEL[o.priority] || '—') + '</span></td>'
      + '<td><span class="text-xs' + (overdue ? ' cwb-overdue' : '') + '">' + esc(fmtDT(o.wording_deadline)) + (overdue ? ' ⚠' : '') + '</span></td>'
      + '<td><span class="tb-status s--wording"><span class="dot"></span>' + esc(WSTATUS[ws] || ws) + '</span></td>'
      + '<td><span class="text-xs">' + (o.brief_wording_round || 0) + '</span></td>'
      + (withPic ? '<td><span class="text-xs">' + esc(owPicName(o) || '—') + '</span></td>' : '')
      + '<td><button class="btn btn-secondary btn-sm" data-open="' + esc(o.order_id) + '">Mở</button></td>'
      + '</tr>';
  }
  function applyFilters(list) {
    const q = FILTERS.search.toLowerCase();
    return list.filter(function (o) {
      if (FILTERS.status && (o.brief_wording_status || 'none') !== FILTERS.status) return false;
      if (FILTERS.type && o.request_type !== FILTERS.type) return false;
      if (FILTERS.pic && (owPicName(o) || '') !== FILTERS.pic) return false;
      if (q && ((o.order_id || '') + ' ' + (o.project_name || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderList() {
    const list = applyFilters(ORDERS);
    document.getElementById('ctm-list-info').innerHTML = 'Hiển thị <strong>' + list.length + '</strong> / ' + ORDERS.length + ' order trong Content Team';
    document.getElementById('ctm-list-tbody').innerHTML = list.length ? list.map(function (o) { return rowHtml(o, true); }).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:44px;color:var(--text-muted)">Chưa có order nào trong Content Team.</td></tr>';
    // PIC filter options (refresh nhẹ, giữ selection)
    const fp = document.getElementById('ctm-filter-pic');
    const cur = fp.value; const seen = {};
    fp.innerHTML = '<option value="">Mọi PIC</option>';
    ORDERS.forEach(function (o) { var nm = owPicName(o); if (nm && !seen[nm]) { seen[nm] = 1; const op = document.createElement('option'); op.value = nm; op.textContent = nm; fp.appendChild(op); } });
    fp.value = cur;
  }
  function renderMine() {
    const list = myOrders();
    document.getElementById('ctm-mine-info').innerHTML = '<strong>' + list.length + '</strong> task wording được gán cho bạn';
    document.getElementById('ctm-mine-tbody').innerHTML = list.length ? list.map(function (o) { return rowHtml(o, false); }).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:44px;color:var(--text-muted)">Bạn chưa được gán content task nào.</td></tr>';
  }

  function renderAll() {
    renderTabs(); renderStats(); renderWorkload(); renderOverdueList(); renderRecentActivity();
    renderInbox(); renderBoard(); renderList(); renderMine();
    renderPlans(); renderInitiatives(); renderContentDashboard();
    renderAdsOrders();
  }

  /* ===================================================================
     DRAWER
     =================================================================== */
  function buildActions(o) {
    const ws = o.brief_wording_status || 'none';
    const btns = [];
    if (canWork(o)) {
      if (['pic_assigned', 'lead_revision', 'account_revision', 'client_feedback'].indexOf(ws) >= 0)
        btns.push('<button class="btn btn-secondary btn-sm" id="ct-start">' + (ws === 'pic_assigned' ? 'Bắt đầu xử lý' : 'Chỉnh theo yêu cầu') + '</button>');
      btns.push('<button class="btn btn-secondary btn-sm" id="ct-save">Lưu nháp</button>');
      btns.push('<button class="btn btn-primary btn-sm" id="ct-submit">Gửi Lead Content duyệt</button>');
    } else if (user.role === 'content' && ws === 'submitted_to_lead' && owIsMine(o)) {
      btns.push('<span class="wf-wait-tag">Đã gửi Lead — chờ duyệt</span>');
    }
    if (canLeadReview(o)) {
      btns.push('<button class="btn btn-warning btn-sm" id="ct-return">Trả Content chỉnh</button>');
      btns.push('<button class="btn btn-primary btn-sm" id="ct-approve">Duyệt &amp; chuyển Account</button>');
    }
    if (isAccountAdmin && ['submitted_to_account', 'sent_to_client', 'client_feedback', 'client_approved'].indexOf(ws) >= 0) {
      btns.push('<a class="btn btn-secondary btn-sm" href="database-orders.html?id=' + esc(o.order_id) + '">Mở Client Orders</a>');
    } else if (isLead && o.order_id) {
      // Lead Content theo dõi order gốc read-only (guard database-orders đã mở 2026-07-06).
      btns.push('<a class="btn btn-ghost btn-sm" href="database-orders.html?id=' + esc(o.order_id) + '">Mở Order gốc (chỉ xem)</a>');
    }
    return btns.length ? '<div class="wf-actions"><div class="wf-actions-flow">' + btns.join('') + '</div></div>' : '';
  }

  function buildAssignPanel(o) {
    if (!isLead) {
      return owPicName(o)
        ? '' // PIC hiển thị ở head + summary, không cần panel riêng cho non-lead
        : '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">P</span><h4>Phân công</h4></div><p class="text-xs muted" style="margin:0">Chưa gán PIC Content — chờ Lead Content phân công.</p></section>';
    }
    if (!canAssign(o)) return '';
    const ws = o.brief_wording_status || 'none';
    const btnLabel = ws === 'assigned' ? 'Gán PIC & bắt đầu' : 'Cập nhật phân công';
    return '<section class="drawer-block ctm-assign"><div class="drawer-block-head"><span class="block-letter">P</span><h4>Lead Content — Phân công</h4></div>'
      + '<div class="ctm-assign-grid">'
      + '<div class="field"><label class="label">PIC Content</label><select class="select" id="ct-pic">' + picOptionsByIdCT(o.brief_wording_pic_user_id, o.brief_wording_pic) + '</select></div>'
      + '<div class="field"><label class="label">Hạn hoàn thành wording</label><input class="input" type="datetime-local" id="ct-deadline" value="' + toLocalInput(o.wording_deadline) + '" /></div>'
      + '</div>'
      + '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn btn-primary btn-sm" id="ct-assign">' + btnLabel + '</button></div>'
      + (ws === 'assigned' ? '<p class="text-xs muted" style="margin:8px 0 0">Gán PIC sẽ chuyển trạng thái sang "Đã gán PIC" và thông báo cho Content.</p>' : '')
      + '</section>';
  }

  function buildLeadPanel(o) {
    const ws = o.brief_wording_status || 'none';
    if (isLead) {
      return '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">R</span><h4>Lead Review Panel</h4></div>'
        + (ws === 'submitted_to_lead' ? '<p class="text-xs muted" style="margin:0 0 8px">Content đã gửi bản wording. Duyệt → chuyển Account, hoặc trả Content chỉnh kèm ghi chú.</p>' : '')
        + '<div class="field"><label class="label">Ghi chú review của Lead (bắt buộc khi trả chỉnh)</label><textarea class="textarea" id="ct-lead-note" rows="2" placeholder="Điểm cần Content chỉnh...">' + esc(o.wording_lead_note || '') + '</textarea></div>'
        + (o.wording_lead_reviewed_at ? '<p class="text-xs muted" style="margin:8px 0 0">Lần review gần nhất: ' + fmtDT(o.wording_lead_reviewed_at) + (o.wording_lead_reviewed_by ? ' · ' + esc(o.wording_lead_reviewed_by) : '') + '</p>' : '')
        + '</section>';
    }
    return o.wording_lead_note
      ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">R</span><h4>Lead Review</h4></div><div class="bw-note' + (ws === 'lead_revision' ? ' bw-warn' : '') + '">' + esc(o.wording_lead_note) + '</div></section>'
      : '';
  }

  function buildBody(o) {
    const ws = o.brief_wording_status || 'none';
    const cl = parseChecklist(o.wording_content_checklist);
    const editable = canWork(o);
    const ro = editable ? '' : 'readonly';
    const lockNote = editable ? '' : '<p class="text-xs muted" style="margin:0 0 8px">'
      + (ws === 'assigned' ? 'Chờ Lead Content gán PIC trước khi bắt đầu wording.'
        : (ws === 'submitted_to_lead' ? 'Đã gửi Lead Content duyệt — đang chờ xử lý, không thể chỉnh.'
          : (ws === 'submitted_to_account' ? 'Lead đã duyệt — đang chờ Account xử lý.'
            : (ws === 'sent_to_client' ? 'Đã gửi Client xác nhận — chế độ chỉ đọc.'
              : ((ws === 'client_approved' || ws === 'completed') ? 'Brief wording đã hoàn tất — chế độ chỉ đọc.'
                : 'Chế độ chỉ đọc — chỉ PIC Content được gán (hoặc Admin) chỉnh sửa.')))))
      + '</p>';
    const v = function (x) { return x ? esc(x) : '<em class="muted">—</em>'; };
    const arr = function (a) { return (Array.isArray(a) && a.length) ? a.map(function (x) { return '<span class="chip-mini">' + esc(x) + '</span>'; }).join('') : '<em class="muted">—</em>'; };
    const link = function (u) { return u ? '<a class="link" href="' + esc(u) + '" target="_blank" rel="noopener">Mở link</a>' : '<em class="muted">—</em>'; };

    const reached = LIFE_REACHED[ws] != null ? LIFE_REACHED[ws] : 0;
    const lifeLi = LIFE.map(function (s, i) {
      const st = i < reached ? 'done' : (i === reached ? 'active' : 'pending');
      return '<li class="bw-step bw-' + st + '"><span class="bw-dot">' + (st === 'done' ? '✓' : (i + 1)) + '</span><span class="bw-label">' + s + '</span></li>';
    }).join('');
    const revisionNote = (ws === 'lead_revision' && o.wording_lead_note) ? '<div class="dw-callout dw--warning" style="margin-top:var(--space-3)"><p><b>Lead yêu cầu chỉnh:</b> ' + esc(o.wording_lead_note) + '</p></div>'
      : ((ws === 'account_revision' && o.wording_account_note) ? '<div class="dw-callout dw--warning" style="margin-top:var(--space-3)"><p><b>Account yêu cầu chỉnh:</b> ' + esc(o.wording_account_note) + '</p></div>'
        : ((ws === 'client_feedback' && o.wording_client_feedback) ? '<div class="dw-callout dw--warning" style="margin-top:var(--space-3)"><p><b>Client yêu cầu chỉnh — Vòng ' + (o.brief_wording_round || 0) + ':</b></p><p style="white-space:pre-wrap">' + esc(o.wording_client_feedback) + '</p></div>' : ''));

    const wf = WFIELDS.map(function (f) {
      return '<div class="field"><label class="label">' + f.label + (f.req ? ' <span class="req" style="color:var(--danger)">*</span>' : '') + '</label><textarea class="textarea ctm-field" id="ct-' + f.k + '" rows="' + f.rows + '" ' + ro + ' placeholder="...">' + esc(o[f.k] || '') + '</textarea></div>';
    }).join('');
    const clHtml = CHECKLIST.map(function (c) {
      return '<label class="checkbox"><input type="checkbox" class="ctm-check" id="ctcl-' + c.k + '" ' + (cl[c.k] ? 'checked' : '') + ' ' + (editable ? '' : 'disabled') + ' /><div><span class="checkbox-text">' + c.label + '</span></div></label>';
    }).join('');
    const lk = LINKS.map(function (f) {
      const val = o[f.k] || '';
      return '<div class="field"><label class="label">' + f.label + '</label><div class="row" style="gap:8px"><input class="input ctm-field" type="url" id="ct-' + f.k + '" ' + ro + ' value="' + esc(val) + '" placeholder="https://..." style="flex:1" />'
        + (val ? '<a class="btn btn-secondary btn-sm" href="' + esc(val) + '" target="_blank" rel="noopener">Mở</a>' : '') + '</div></div>';
    }).join('');

    // Trạng thái Account + Client (read-only, KHÔNG lộ gì mới cho client)
    var acctInner;
    if (ws === 'submitted_to_account') acctInner = '<div class="dw-callout dw--brand"><p>Lead đã duyệt — chờ Account kiểm tra &amp; gửi Client (thao tác ở Client Orders drawer).</p></div>';
    else if (ws === 'account_revision' && o.wording_account_note) acctInner = '<div class="dw-callout dw--warning"><p><b>Account yêu cầu chỉnh:</b> ' + esc(o.wording_account_note) + '</p></div>';
    else if (ws === 'sent_to_client') acctInner = '<div class="dw-callout dw--brand"><p>Account đã gửi Client' + (o.wording_client_sent_at ? ' · ' + fmtDT(o.wording_client_sent_at) : '') + ' — chờ Client xác nhận.</p></div>';
    else if (ws === 'client_feedback') acctInner = '<div class="dw-callout dw--warning"><p><b>Client yêu cầu chỉnh</b>' + (o.wording_client_feedback_at ? ' · ' + fmtDT(o.wording_client_feedback_at) : '') + '</p>' + (o.wording_client_feedback ? '<p style="white-space:pre-wrap">' + esc(o.wording_client_feedback) + '</p>' : '') + '</div>';
    else if (ws === 'client_approved' || ws === 'completed') acctInner = '<div class="dw-callout dw--success"><p><b>Client đã xác nhận brief wording.</b>' + (o.wording_approved_at ? ' <span class="dw-meta">· ' + fmtDT(o.wording_approved_at) + '</span>' : '') + '</p></div>';
    else acctInner = '<p class="text-xs muted" style="margin:0">Chưa tới bước Account / Client.</p>';

    const acts = (cacheOf(o.order_id).activity || []).slice(-10).reverse();
    const actHtml = acts.length ? acts.map(function (a) { return '<li><span>' + esc(a.text) + ' — <b>' + esc(a.by) + '</b></span><time>' + fmtDT(a.at) + '</time></li>'; }).join('') : '<li><span class="muted">Chưa có hoạt động.</span></li>';

    const overdue = isWordingOverdue(o);

    return ''
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">L</span><h4>Content Lifecycle</h4></div><ol class="bw-steps">' + lifeLi + '</ol>' + revisionNote + '</section>'
      + buildAssignPanel(o)
      + '<section class="drawer-block cwb-snapshot"><div class="drawer-block-head"><span class="block-letter">B</span><h4>Brief gốc (read-only)</h4></div><dl>'
        + '<dt>Người gửi</dt><dd>' + v(o.requester_name) + ' · ' + v(o.department) + '</dd>'
        + '<dt>Mục đích</dt><dd>' + v(o.project_purpose) + '</dd>'
        + '<dt>Đối tượng</dt><dd>' + arr(o.target_audience) + '</dd>'
        + '<dt>Kênh sử dụng</dt><dd>' + arr(o.usage_channels) + '</dd>'
        + '<dt>Loại yêu cầu</dt><dd>' + v(TYPE_LABEL[o.request_type] || o.request_type) + '</dd>'
        + '<dt>Nội dung gốc</dt><dd style="white-space:pre-wrap">' + v(o.content_brief) + '</dd>'
        + '<dt>Định hướng</dt><dd>' + v(o.creative_direction) + '</dd>'
        + '<dt>File brief</dt><dd>' + link(o.file_brief_url) + '</dd>'
        + '<dt>Source link</dt><dd>' + link(o.source_link) + '</dd>'
        + '<dt>Client deadline</dt><dd>' + v(o.requested_deadline) + '</dd>'
        + '<dt>Hạn wording</dt><dd>' + (o.wording_deadline ? '<span class="' + (overdue ? 'cwb-overdue' : '') + '">' + esc(fmtDT(o.wording_deadline)) + '</span>' + (overdue ? ' · ⚠ trễ' : '') : '<em class="muted">— (Lead chưa đặt)</em>') + '</dd>'
      + '</dl></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">W</span><h4>Content Wording Workspace</h4></div>' + lockNote + wf + '</section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">C</span><h4>Content Quality Checklist</h4></div><div style="display:flex;flex-direction:column;gap:8px">' + clHtml + '</div>' + (editable ? '<p class="text-xs muted" style="margin:10px 0 0">Bắt buộc tích đủ + điền các trường (*) trước khi "Gửi Lead Content duyệt".</p>' : '') + '</section>'
      + buildLeadPanel(o)
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">AC</span><h4>Account &amp; Client</h4></div>' + acctInner + '</section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">F</span><h4>Files / Links workspace</h4></div>' + lk + '</section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">A</span><h4>Activity timeline</h4></div><ul class="activity-mini">' + actHtml + '</ul></section>';
  }

  function openDrawer(o) {
    current = o;
    document.getElementById('ctm-d-order-id').textContent = o.order_id;
    document.getElementById('ctm-d-project').textContent = o.project_name || '—';
    const ws = o.brief_wording_status || 'none';
    const st = document.getElementById('ctm-d-status'); st.className = 'tb-status s--wording'; st.innerHTML = '<span class="dot"></span>' + (WSTATUS[ws] || ws);
    const pr = document.getElementById('ctm-d-priority'); pr.className = 'priority-pill p--' + (o.priority || 'normal'); pr.innerHTML = '<span class="dot"></span>' + (PRIO_LABEL[o.priority] || o.priority || '—');
    document.getElementById('ctm-d-round').textContent = 'Vòng ' + (o.brief_wording_round || 0);
    document.getElementById('ctm-d-pic').textContent = 'PIC: ' + (owPicName(o) || 'chưa gán');
    document.getElementById('ctm-drawer-actions').innerHTML = buildActions(o);
    document.getElementById('ctm-drawer-body').innerHTML = buildBody(o);
    wireDrawer();
    const dr = document.getElementById('ctm-drawer'); dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    document.getElementById('ctm-drawer-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    const dr = document.getElementById('ctm-drawer'); dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true');
    document.getElementById('ctm-drawer-backdrop').classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* ---------- Form collect / validate ---------- */
  function collectForm() {
    const data = {};
    WFIELDS.forEach(function (f) { const el = document.getElementById('ct-' + f.k); if (el) data[f.k] = el.value; });
    LINKS.forEach(function (f) { const el = document.getElementById('ct-' + f.k); if (el) data[f.k] = el.value; });
    const cl = {}; CHECKLIST.forEach(function (c) { const el = document.getElementById('ctcl-' + c.k); cl[c.k] = !!(el && el.checked); });
    data.wording_content_checklist = JSON.stringify(cl);
    return data;
  }
  function isValidForSubmit() {
    const reqOk = WFIELDS.filter(function (f) { return f.req; }).every(function (f) { const el = document.getElementById('ct-' + f.k); return el && el.value.trim(); });
    const clOk = CHECKLIST.every(function (c) { const el = document.getElementById('ctcl-' + c.k); return el && el.checked; });
    return reqOk && clOk;
  }
  function refreshSubmitState() { const b = document.getElementById('ct-submit'); if (b) b.disabled = !isValidForSubmit(); }

  /* ---------- Actions: Lead ---------- */
  async function assignPic() {
    if (!isLead || !current || !canAssign(current)) return;
    const picEl = document.getElementById('ct-pic');
    const dlEl = document.getElementById('ct-deadline');
    const rawPic = (picEl && picEl.value || '').trim();         // value = id | "name:<tên>" (legacy) | ""
    if (!rawPic) { toast('warning', 'Thiếu PIC', 'Chọn PIC Content trong danh sách trước khi gán.'); if (picEl) picEl.focus(); return; }
    const pickW = window.MH.picPick(rawPic);
    const picId = pickW.id;
    const pic = pickW.name || '';
    const ws = current.brief_wording_status || 'none';
    const patch = { brief_wording_pic_user_id: picId, brief_wording_pic: pic };
    if (dlEl && dlEl.value) patch.wording_deadline = new Date(dlEl.value).toISOString();
    if (ws === 'assigned') patch.brief_wording_status = 'pic_assigned';
    const isNew = ws === 'assigned';
    await persist(current, patch, (isNew ? 'Lead gán PIC: ' : 'Lead cập nhật phân công: ') + pic + (patch.wording_deadline ? ' · hạn ' + fmtDT(patch.wording_deadline) : ''));
    notifyUserId(picId, notifPayload(current, 'task_assigned', '📝 Bạn được gán Content Wording',
      current.order_id + ' · ' + (current.project_name || 'Untitled') + (patch.wording_deadline ? ' · Hạn: ' + fmtDT(patch.wording_deadline) : '') + ' — Lead: ' + (user.name || 'Lead Content'),
      'content-workbench.html?id='));
    toast('success', isNew ? 'Đã gán PIC' : 'Đã cập nhật phân công', current.order_id + ' → ' + pic);
    reloadAndReopen();
  }
  async function leadReturnRevision() {
    if (!canLeadReview(current)) return;
    const el = document.getElementById('ct-lead-note');
    const note = (el && el.value || '').trim();
    if (!note) { toast('warning', 'Cần ghi chú', 'Nhập điểm cần Content chỉnh trước khi trả.'); if (el) el.focus(); return; }
    const nowIso = new Date().toISOString();
    await persist(current, {
      brief_wording_status: 'lead_revision',
      wording_lead_note: note,
      wording_lead_reviewed_at: nowIso,
      wording_lead_reviewed_by: user.name || user.role
    }, 'Lead trả Content chỉnh: ' + note);
    if (current.brief_wording_pic_user_id) notifyUserId(current.brief_wording_pic_user_id, notifPayload(current, 'task_status_changed', '✍️ Lead yêu cầu chỉnh wording', current.order_id + ' · ' + note, 'content-workbench.html?id='));
    else if (current.brief_wording_pic) notifyByName(current.brief_wording_pic, notifPayload(current, 'task_status_changed', '✍️ Lead yêu cầu chỉnh wording', current.order_id + ' · ' + note, 'content-workbench.html?id='));
    toast('info', 'Đã trả Content chỉnh', current.order_id);
    reloadAndReopen();
  }
  async function leadApprove() {
    if (!canLeadReview(current)) return;
    const el = document.getElementById('ct-lead-note');
    const note = (el && el.value || '').trim();
    const nowIso = new Date().toISOString();
    const patch = {
      brief_wording_status: 'submitted_to_account',
      wording_lead_reviewed_at: nowIso,
      wording_lead_reviewed_by: user.name || user.role,
      wording_submitted_by: user.name || user.role,
      wording_submitted_at: nowIso
    };
    if (note) patch.wording_lead_note = note;
    await persist(current, patch, 'Lead duyệt bản wording — chuyển Account');
    notifyRoles(['admin', 'account'], notifPayload(current, 'task_status_changed', '✅ Wording đã được Lead Content duyệt',
      current.order_id + ' · ' + (current.project_name || 'Untitled') + ' — sẵn sàng gửi Client xác nhận (Client Orders drawer).'));
    toast('success', 'Đã duyệt & chuyển Account', current.order_id + ' — Account sẽ gửi Client xác nhận.');
    reloadAndReopen();
  }

  /* ---------- Actions: Content ---------- */
  async function startWork() {
    if (!canWork(current)) return;
    const ws = current.brief_wording_status || 'none';
    if (['pic_assigned', 'lead_revision', 'account_revision', 'client_feedback'].indexOf(ws) < 0) return;
    const msg = ws === 'pic_assigned' ? 'Content bắt đầu xử lý'
      : (ws === 'lead_revision' ? 'Content chỉnh theo Lead'
        : (ws === 'account_revision' ? 'Content chỉnh theo Account' : 'Content chỉnh theo Client'));
    await persist(current, { brief_wording_status: 'in_progress' }, msg);
    toast('info', 'Bắt đầu xử lý', current.order_id);
    reloadAndReopen();
  }
  async function saveDraft() {
    if (!canWork(current)) return;
    const data = collectForm();
    const patch = Object.assign({}, data);
    if (['pic_assigned', 'lead_revision', 'account_revision', 'client_feedback'].indexOf(current.brief_wording_status) >= 0) patch.brief_wording_status = 'in_progress';
    await persist(current, patch, 'Content lưu nháp');
    toast('success', 'Đã lưu nháp', current.order_id + ' — bản wording đã được lưu.');
    reloadAndReopen();
  }
  async function submitToLead() {
    if (!canWork(current)) return;
    if (current.brief_wording_status === 'submitted_to_lead') { toast('info', 'Đã gửi', current.order_id + ' — đang chờ Lead duyệt.'); return; }
    if (!isValidForSubmit()) { toast('warning', 'Chưa đủ điều kiện', 'Hoàn tất các trường bắt buộc (*) + toàn bộ Quality Checklist trước khi gửi.'); return; }
    const data = collectForm();
    const nowIso = new Date().toISOString();
    await persist(current, Object.assign({}, data, {
      brief_wording_status: 'submitted_to_lead',
      wording_submitted_to_lead_at: nowIso
    }), 'Content gửi Lead Content duyệt');
    notifyRoles(['lead_content'], notifPayload(current, 'task_status_changed', '📨 Bản wording chờ Lead duyệt',
      current.order_id + ' · ' + (current.project_name || 'Untitled') + ' — ' + (user.name || 'Content') + ' đã gửi bản wording.'));
    toast('success', 'Đã gửi Lead Content duyệt', current.order_id + ' — chờ Lead review.');
    reloadAndReopen();
  }

  function wireDrawer() {
    const w = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    w('ct-start', startWork); w('ct-save', saveDraft); w('ct-submit', submitToLead);
    w('ct-assign', assignPic); w('ct-return', leadReturnRevision); w('ct-approve', leadApprove);
    document.querySelectorAll('#ctm-drawer-body .ctm-field').forEach(function (el) { el.addEventListener('input', refreshSubmitState); });
    document.querySelectorAll('#ctm-drawer-body .ctm-check').forEach(function (el) { el.addEventListener('change', refreshSubmitState); });
    refreshSubmitState();
  }

  /* ===================================================================
     PHASE 2 — CONTENT PLANS + INITIATIVES + TASK ASSIGNMENT
     Data model mới (MH.store.contentPlans / contentTasks), TÁCH BIỆT
     hoàn toàn flow orders/brief_wording phía trên. Lead Content điều phối:
     tạo Plan cha → tách Task con → gán PIC → follow → roll-up tiến độ.
     =================================================================== */
  const ENUMS = (window.MH && window.MH.store && window.MH.store.contentEnums) || {
    OUTPUT_TYPES: ['social_post', 'album_caption', 'ads_copy', 'video_script', 'voice_over', 'kv_headline', 'landing_copy', 'email_zalo_sms', 'internal_announcement', 'campaign_big_idea', 'content_package', 'other']
  };
  const OUTPUT_LABEL = {
    social_post: 'Social post', album_caption: 'Album caption', ads_copy: 'Ads copy', video_script: 'Video script',
    voice_over: 'Voice-over', kv_headline: 'KV headline', landing_copy: 'Landing copy', email_zalo_sms: 'Email/Zalo/SMS',
    internal_announcement: 'Thông báo nội bộ', campaign_big_idea: 'Big idea', content_package: 'Content package', other: 'Khác'
  };
  const CT_STATUS = {
    new: 'Mới', assigned: 'Chờ phân công', pic_assigned: 'Đã gán PIC', in_progress: 'Đang viết',
    submitted_to_lead: 'Chờ Lead duyệt', lead_revision: 'Lead trả chỉnh', lead_approved: 'Lead đã duyệt',
    submitted_to_account: 'Chờ Account', account_revision: 'Account trả chỉnh', sent_to_client: 'Chờ Client',
    client_feedback: 'Client phản hồi', client_approved: 'Client duyệt', media_order_created: 'Đã tạo Media Request',
    completed: 'Hoàn tất', archived: 'Lưu trữ'
  };
  const PLAN_STATUS = {
    draft: 'Nháp', active: 'Sẵn sàng', in_progress: 'Đang chạy', pending_review: 'Có bản chờ duyệt',
    at_risk: 'Có task trễ', completed: 'Hoàn tất', archived: 'Lưu trữ'
  };
  const SOURCE_LABEL = { client_order: 'Client Order', content_initiated: 'Task nội bộ', strategy_board: 'Strategy Board', campaign_package: 'Kế hoạch đã ký', ads_order: 'Ads Order' };
  const PRIO_VI = { low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Gấp', critical: 'Rất gấp' };
  // Trạng thái production của Media Order nội bộ (đọc read-only để Content theo dõi — Phase 5).
  const PROD_STATUS = {
    unassigned: 'Chưa phân công', pending: 'Chờ nhận', received: 'Đã nhận', inprogress: 'Đang sản xuất',
    review: 'Chờ duyệt nội bộ', revision: 'Đang chỉnh', feedback_wait: 'Chờ phản hồi', feedback_fix: 'Sửa theo feedback',
    ready: 'Sẵn sàng bàn giao', delivered: 'Đã bàn giao', completed: 'Hoàn tất', paused: 'Tạm dừng', cancelled: 'Đã hủy'
  };
  // Phase 4 — Lead Review: hiển thị bản thảo PIC + checklist + handoff + revision.
  const WS_LABEL = {
    draft_title: 'Tiêu đề bản thảo', draft_body: 'Nội dung / Body', caption: 'Caption', headline: 'Headline',
    subheadline: 'Subheadline', script: 'Kịch bản / Scene', voice_over: 'Voice-over',
    ads_primary_text: 'Ads — Primary text', ads_headline: 'Ads — Headline', landing_copy: 'Landing copy',
    email_sms_zalo_copy: 'Email/Zalo/SMS', cta: 'CTA', mandatory_info: 'Thông tin bắt buộc', visual_direction: 'Định hướng hình ảnh'
  };
  const WS_ORDER = ['draft_title', 'draft_body', 'headline', 'subheadline', 'caption', 'script', 'voice_over', 'ads_primary_text', 'ads_headline', 'landing_copy', 'email_sms_zalo_copy', 'cta', 'mandatory_info', 'visual_direction'];
  const CTCHK = [['goal', 'Đúng mục tiêu nội dung'], ['audience', 'Đúng đối tượng'], ['tone', 'Đúng tone CB'], ['message', 'Thông điệp rõ ràng'], ['cta', 'CTA rõ'], ['info', 'Thông tin bắt buộc đủ'], ['spelling', 'Không lỗi chính tả'], ['format', 'Format phù hợp kênh sử dụng'], ['assumptions', 'Đã ghi assumptions nếu thiếu thông tin']];
  const HANDOFF_LABEL = { final_headline: 'Final headline', final_body_or_script: 'Final body/script', handoff_mandatory_info: 'Thông tin bắt buộc', handoff_visual_direction: 'Định hướng hình ảnh', format_size: 'Format/Size', channel: 'Kênh đăng' };
  const REVISION_REASONS = ['Sai mục tiêu nội dung', 'Sai đối tượng', 'Sai tone CB', 'Hook chưa đủ mạnh', 'Thông điệp chưa rõ', 'CTA chưa rõ', 'Thiếu thông tin bắt buộc', 'Copy quá dài', 'Copy quá ngắn', 'Sai format kênh', 'Lỗi chính tả/ngữ pháp', 'Cần bổ sung visual note', 'Cần bổ sung handoff cho Media', 'Khác'];
  // Trạng thái task được coi là "đã xong" để tính progress roll-up.
  const CT_DONE = ['lead_approved', 'client_approved', 'completed', 'media_order_created'];
  const CT_ACTIVE = ['new', 'assigned', 'pic_assigned', 'in_progress', 'lead_revision', 'account_revision', 'client_feedback', 'submitted_to_account', 'sent_to_client'];

  function parseDt(s) { if (!s) return null; s = String(s); const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z'); return isNaN(d.getTime()) ? null : d; }
  function ctIsOverdue(t) {
    if (!t || !t.wording_deadline) return false;
    if (CT_DONE.indexOf(t.status) >= 0 || t.status === 'archived') return false;
    const d = parseDt(t.wording_deadline); return !!d && d.getTime() < Date.now();
  }
  // Mã task nội bộ Content (CT-YYYY-NNN) — sinh bởi trigger DB add-content-task-code.sql.
  // Chưa chạy migration / task cũ chưa backfill → hiện mã tạm từ id để vẫn nhắc được nhau.
  function ctCode(t) {
    if (!t) return '—';
    if (t.task_code) return t.task_code;
    return 'CT-' + String(t.id || '').slice(-4).toUpperCase();
  }
  // Tên PIC content_task để HIỂN THỊ: resolve user_id → tên hiện tại (rename-proof),
  // fallback snapshot tên cũ (data chưa backfill id). MH.picLabel ở app.js.
  function ctPicName(t) {
    return (t && window.MH && window.MH.picLabel) ? window.MH.picLabel(t.assigned_pic_user_id, t.assigned_pic) : (t && t.assigned_pic) || '';
  }
  // PIC wording (orders.brief_wording_pic) — Stage 2: keyed theo brief_wording_pic_user_id.
  function owPicName(o) {
    return (o && window.MH && window.MH.picLabel) ? window.MH.picLabel(o.brief_wording_pic_user_id, o.brief_wording_pic) : (o && o.brief_wording_pic) || '';
  }
  function owIsMine(o) {
    if (!o) return false;
    if (o.brief_wording_pic_user_id) return !!user.id && o.brief_wording_pic_user_id === user.id;
    return isMine(o.brief_wording_pic);
  }
  function initiativeTasks() { return CONTENT_TASKS.filter(function (t) { return t.source === 'content_initiated' && !t.content_plan_id; }); }
  function planChildTasks(planId) { return CONTENT_TASKS.filter(function (t) { return t.content_plan_id === planId; }); }
  function arrayOf(a) { return Array.isArray(a) ? a : (a ? [a] : []); }

  // Roll-up status/progress của Plan cha từ task con (spec §6).
  function rollup(planId) {
    const ts = planChildTasks(planId);
    const total = ts.length;
    const done = ts.filter(function (t) { return CT_DONE.indexOf(t.status) >= 0; }).length;
    const overdue = ts.filter(ctIsOverdue).length;
    const pendingReview = ts.filter(function (t) { return t.status === 'submitted_to_lead'; }).length;
    const writing = ts.filter(function (t) { return ['pic_assigned', 'in_progress', 'lead_revision', 'account_revision', 'client_feedback'].indexOf(t.status) >= 0; }).length;
    const mediaReq = ts.filter(function (t) { return t.media_request_created || t.status === 'media_order_created'; }).length;
    const progress = total ? Math.round(done / total * 100) : 0;
    let status;
    if (total === 0) status = 'draft';
    else if (done === total) status = 'completed';
    else if (overdue > 0) status = 'at_risk';
    else if (pendingReview > 0) status = 'pending_review';
    else if (writing > 0 || done > 0) status = 'in_progress';
    else status = 'active';
    return { total: total, done: done, overdue: overdue, pendingReview: pendingReview, writing: writing, mediaReq: mediaReq, progress: progress, status: status };
  }

  /* ---------- Data load ---------- */
  async function loadContentData() {
    try {
      if (window.MH && window.MH.supabaseEnabled) await window.MH.supabaseReady;
      if (window.MH && window.MH.store && window.MH.store.contentPlans) {
        CONTENT_PLANS = (await window.MH.store.contentPlans.list()) || [];
        CONTENT_TASKS = (await window.MH.store.contentTasks.list()) || [];
      }
    } catch (e) { console.warn('[ctm] load content data failed:', e); }
    // renderInbox() BẮT BUỘC ở đây: panel "Task nội bộ — chờ Lead duyệt" đọc
    // CONTENT_TASKS, mà data này load ở luồng riêng (không qua loadOrders/renderAll).
    renderTabs(); renderInbox(); renderPlans(); renderInitiatives(); renderContentDashboard();
    if (currentPlan) { const p = CONTENT_PLANS.find(function (x) { return x.id === currentPlan.id; }); if (p) currentPlan = p; }
    if (currentTask) { const t = CONTENT_TASKS.find(function (x) { return x.id === currentTask.id; }); if (t) currentTask = t; }
  }
  async function ctReload(reopen) {
    await loadContentData();
    if (reopen === 'plan' && currentPlan) openPlanDrawer(currentPlan);
    else if (reopen === 'task' && currentTask) openTaskDrawer(currentTask);
  }

  /* ---------- PIC Content options ----------
     ⚠ PIC content_tasks nay KEYED THEO user_id (rename-proof) — dùng picOptionsByIdCT
     (option value=id, hiển thị tên hiện tại). Các select ghi cột ORDERS (ct-pic wording,
     ads-pic/ads-tt-pic) TẠM giữ value=TÊN qua picSelectOptions (Stage 2 sẽ chuyển id +
     sửa RPC update_brief_wording). Cả hai đều nguồn từ CONTENT_USERS thật — ĐÃ BỎ seed
     cứng + BỎ append tên lịch sử trong task/order (nguồn sinh trùng tên cũ/mới). */
  const ROLE_TAG_CT = { content: 'Content', lead_content: 'Lead', admin: 'Admin', account: 'Account' };
  // Content_tasks: option keyed theo user_id.
  function picOptionsByIdCT(currentId, currentName) {
    return window.MH.picOptionsById(CONTENT_USERS, {
      current: currentId || '', currentName: currentName || '',
      placeholder: '— Chọn PIC Content —', roleTag: ROLE_TAG_CT
    });
  }
  // Orders/ads (name-based tạm thời): nguồn users thật + giữ current, KHÔNG seed, KHÔNG
  // gộp tên lịch sử → hết ghost/dedupe. sort vi.
  function contentPicNames(current) {
    const names = {};
    CONTENT_USERS.forEach(function (u) { if (u.name) names[u.name] = 1; });
    if (current) names[current] = 1; // giữ giá trị hiện tại để select hiển thị đúng
    return Object.keys(names).sort(function (a, b) { return a.localeCompare(b, 'vi'); });
  }
  function picSelectOptions(current) {
    current = current || '';
    return '<option value="">— Chọn PIC Content —</option>'
      + contentPicNames(current).map(function (n) {
        return '<option value="' + esc(n) + '"' + (n === current ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');
  }
  function outputCheckboxes(selected) {
    selected = arrayOf(selected);
    return (ENUMS.OUTPUT_TYPES || []).map(function (k) {
      return '<label class="ctm-chk-chip"><input type="checkbox" class="ctm-out-chk" value="' + k + '" ' + (selected.indexOf(k) >= 0 ? 'checked' : '') + '/><span>' + esc(OUTPUT_LABEL[k] || k) + '</span></label>';
    }).join('');
  }
  function collectOutputs(scopeSel) {
    return Array.prototype.slice.call(document.querySelectorAll(scopeSel + ' .ctm-out-chk:checked')).map(function (c) { return c.value; });
  }
  function outputChips(types) {
    types = arrayOf(types);
    return types.length ? types.map(function (k) { return '<span class="chip-mini">' + esc(OUTPUT_LABEL[k] || k) + '</span>'; }).join('') : '<em class="muted">—</em>';
  }
  function ctStatusBadge(st) { return '<span class="tb-status s--wording"><span class="dot"></span>' + esc(CT_STATUS[st] || st) + '</span>'; }
  function planStatusBadge(st) { return '<span class="ctm-plan-badge ps--' + esc(st) + '">' + esc(PLAN_STATUS[st] || st) + '</span>'; }

  /* ===================================================================
     RENDER — Content Plans list
     =================================================================== */
  function renderPlans() {
    const tb = document.getElementById('ctm-plans-tbody'); if (!tb) return;
    document.getElementById('ctm-plans-info').innerHTML = '<strong>' + CONTENT_PLANS.length + '</strong> Content Plan';
    const btn = document.getElementById('ctm-new-plan'); if (btn) btn.style.display = isLead ? '' : 'none';
    if (!CONTENT_PLANS.length) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:44px;color:var(--text-muted)">Chưa có Content Plan nào.' + (isLead ? ' Bấm “Tạo Content Plan”.' : '') + '</td></tr>';
      return;
    }
    tb.innerHTML = CONTENT_PLANS.map(function (p) {
      const r = rollup(p.id);
      const dl = p.plan_deadline ? fmtDT(p.plan_deadline) : '—';
      return '<tr data-plan="' + esc(p.id) + '">'
        + '<td><b>' + esc(p.title || '—') + '</b>' + (p.campaign_name ? '<div class="text-xs muted">' + esc(p.campaign_name) + '</div>' : '') + '</td>'
        + '<td><span class="text-xs">' + esc(SOURCE_LABEL[p.source] || p.source || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(p.owner_lead || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(dl) + '</span></td>'
        + '<td><span class="ctm-progress"><i style="width:' + r.progress + '%"></i></span><span class="text-xs">' + r.progress + '%</span></td>'
        + '<td><span class="text-xs">' + r.total + '</span></td>'
        + '<td><span class="text-xs' + (r.overdue ? ' cwb-overdue' : '') + '">' + r.overdue + '</span></td>'
        + '<td><span class="text-xs">' + r.pendingReview + '</span></td>'
        + '<td>' + planStatusBadge(r.status) + '</td>'
        + '<td><button class="btn btn-secondary btn-sm" data-plan-open="' + esc(p.id) + '">Mở</button></td>'
        + '</tr>';
    }).join('');
  }

  /* ===================================================================
     RENDER — Content Initiatives list
     =================================================================== */
  function renderInitiatives() {
    const tb = document.getElementById('ctm-init-tbody'); if (!tb) return;
    const list = initiativeTasks();
    document.getElementById('ctm-init-info').innerHTML = '<strong>' + list.length + '</strong> task nội bộ team Content';
    const btn = document.getElementById('ctm-new-initiative'); if (btn) btn.style.display = isLead ? '' : 'none';
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:44px;color:var(--text-muted)">Chưa có task nội bộ nào.' + (isLead ? ' Bấm “Tạo task nội bộ”.' : '') + '</td></tr>';
      return;
    }
    tb.innerHTML = list.map(function (t) {
      const overdue = ctIsOverdue(t);
      // Task do PIC content tự tạo (created_by = assigned_pic) → nhãn phân biệt với task Lead tạo.
      const selfMade = (t.created_by_user_id && t.assigned_pic_user_id && t.created_by_user_id === t.assigned_pic_user_id)
        || (!t.assigned_pic_user_id && t.created_by && t.assigned_pic && t.created_by === t.assigned_pic);
      return '<tr data-task="' + esc(t.id) + '">'
        + '<td><span class="order-id">' + esc(ctCode(t)) + '</span></td>'
        + '<td><b>' + esc(t.title || '—') + '</b>' + (selfMade ? ' <span class="chip-mini">PIC tự đề xuất</span>' : '') + '</td>'
        + '<td>' + outputChips(t.output_types) + '</td>'
        + '<td><span class="text-xs">' + esc(ctPicName(t) || '—') + '</span></td>'
        + '<td><span class="text-xs' + (overdue ? ' cwb-overdue' : '') + '">' + (t.wording_deadline ? fmtDT(t.wording_deadline) + (overdue ? ' ⚠' : '') : '—') + '</span></td>'
        + '<td><span class="priority-pill p--' + (t.priority || 'normal') + '"><span class="dot"></span>' + esc(PRIO_VI[t.priority] || t.priority || '—') + '</span></td>'
        + '<td><span class="text-xs">' + (t.need_media_production ? '<span class="chip-mini">Cần Media</span>' : '—') + '</span></td>'
        + '<td>' + ctStatusBadge(t.status) + (reviewLateCT(t) ? ' <span class="chip-mini" style="background:var(--danger);color:#fff;border:0">quá hạn duyệt</span>' : '') + '</td>'
        + '<td><button class="btn btn-secondary btn-sm" data-task-open="' + esc(t.id) + '">Mở</button></td>'
        + '</tr>';
    }).join('');
  }

  /* ===================================================================
     PHASE 6 — Content Dashboard KPI + breakdowns + tables
     =================================================================== */
  function dueSoon(t) {
    if (!t || !t.wording_deadline) return false;
    if (CT_DONE.indexOf(t.status) >= 0 || t.status === 'archived') return false;
    const d = parseDt(t.wording_deadline); if (!d) return false;
    const diff = d.getTime() - Date.now();
    return diff >= 0 && diff <= 3 * 86400000;
  }
  function barRows(map, color) {
    const entries = Object.keys(map).map(function (k) { return [k, map[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) return '<p class="text-xs muted" style="margin:0;padding:10px 4px">Chưa có dữ liệu.</p>';
    const max = entries[0][1] || 1;
    return entries.map(function (e) {
      return '<div class="ctm-bar-row"><span class="ctm-bar-name" style="min-width:160px">' + esc(e[0]) + '</span><span class="ctm-bar-track"><i style="width:' + Math.round(e[1] / max * 100) + '%' + (color ? ';background:' + color : '') + '"></i></span><b class="ctm-bar-val">' + e[1] + '</b></div>';
    }).join('');
  }
  function renderContentDashboard() {
    const kpiEl = document.getElementById('ctm-ct-kpi'); if (!kpiEl) return;
    const T = CONTENT_TASKS;
    const approved = T.filter(function (t) { return CT_DONE.indexOf(t.status) >= 0; });
    const firstPass = approved.filter(function (t) { return (t.internal_revision_count || 0) === 0; }).length;
    const needMedia = T.filter(function (t) { return t.need_media_production; }).length;
    const mediaReq = T.filter(function (t) { return t.media_request_created; }).length;
    const revSum = T.reduce(function (s, t) { return s + (t.internal_revision_count || 0); }, 0);
    const kpis = [
      { v: T.length, label: 'Tổng Content Task', color: '#191970' },
      { v: T.filter(function (t) { return t.source === 'client_order'; }).length, label: 'Client Order Task', color: '#1D4ED8' },
      { v: initiativeTasks().length, label: 'Task nội bộ Content', color: '#6B21A8' },
      { v: CONTENT_PLANS.length, label: 'Content Plan', color: '#0E7490' },
      { v: T.filter(dueSoon).length, label: 'Sắp tới hạn (≤3 ngày)', color: '#B07600' },
      { v: T.filter(ctIsOverdue).length, label: 'Trễ hạn', color: '#BA110F' },
      { v: T.filter(function (t) { return t.status === 'submitted_to_lead'; }).length, label: 'Chờ Lead duyệt', color: '#6B21A8' },
      { v: approved.length, label: 'Đã Lead duyệt', color: '#0A7A52' },
      { v: mediaReq, label: 'Media Request đã tạo', color: '#0A7A52' },
      { v: approved.length ? Math.round(firstPass / approved.length * 100) + '%' : '—', label: 'Duyệt ngay vòng 1', color: '#1D4ED8' },
      { v: T.length ? (revSum / T.length).toFixed(1) : '0', label: 'Vòng sửa TB / task', color: '#B07600' },
      { v: needMedia ? Math.round(mediaReq / needMedia * 100) + '%' : '—', label: 'Content→Media', color: '#191970' }
    ];
    kpiEl.innerHTML = kpis.map(function (k) { return '<div class="cwb-stat" style="border-top-color:' + k.color + '"><div class="cwb-stat-val" style="color:' + k.color + '">' + k.v + '</div><div class="cwb-stat-label">' + k.label + '</div></div>'; }).join('');

    // Breakdown theo status
    const byStatusMap = {};
    T.forEach(function (t) { const l = CT_STATUS[t.status] || t.status; byStatusMap[l] = (byStatusMap[l] || 0) + 1; });
    const elS = document.getElementById('ctm-ct-by-status'); if (elS) elS.innerHTML = barRows(byStatusMap, 'var(--grad-navy)');

    // Breakdown theo source + output (gộp 1 panel)
    const bySource = {}; T.forEach(function (t) { const l = SOURCE_LABEL[t.source] || t.source || '—'; bySource[l] = (bySource[l] || 0) + 1; });
    const byOutput = {}; T.forEach(function (t) { arrayOf(t.output_types).forEach(function (o) { const l = OUTPUT_LABEL[o] || o; byOutput[l] = (byOutput[l] || 0) + 1; }); });
    const elSo = document.getElementById('ctm-ct-by-source');
    if (elSo) elSo.innerHTML = '<div class="text-xs muted" style="margin:0 0 4px">Theo nguồn</div>' + barRows(bySource, '#0E7490') + '<div class="text-xs muted" style="margin:10px 0 4px">Theo output type</div>' + barRows(byOutput, '#6B21A8');

    // Plans progress — compact progress rows (name · status badge · meta · bar)
    const elP = document.getElementById('ctm-ct-plans');
    if (elP) elP.innerHTML = CONTENT_PLANS.length ? CONTENT_PLANS.map(function (p) {
      const r = rollup(p.id);
      return '<button class="ctm-plan-row" data-plan-open="' + esc(p.id) + '">'
        + '<div class="ctm-plan-row-top"><span class="ctm-plan-name">' + esc(p.title || p.id) + '</span><span class="ctm-plan-pct">' + r.done + '/' + r.total + ' · ' + r.progress + '%</span></div>'
        + '<span class="ctm-progress sm"><i style="width:' + r.progress + '%"></i></span>'
        + '<div class="ctm-plan-meta">' + planStatusBadge(r.status)
        + (r.pendingReview ? '<span class="ctm-meta-chip is-review">' + r.pendingReview + ' chờ duyệt</span>' : '')
        + (r.done ? '<span class="ctm-meta-chip is-done">' + r.done + ' hoàn thành</span>' : '')
        + (r.overdue ? '<span class="ctm-meta-chip is-danger">' + r.overdue + ' trễ</span>' : '')
        + '</div></button>';
    }).join('') : ctmEmpty(ICON_LAYERS, 'Chưa có Content Plan', 'Tạo kế hoạch để tách thành nhiều task con cho team.');

    // High revision tasks (≥2 vòng)
    const elH = document.getElementById('ctm-ct-highrev');
    const high = T.filter(function (t) { return (t.internal_revision_count || 0) >= 2; }).sort(function (a, b) { return (b.internal_revision_count || 0) - (a.internal_revision_count || 0); }).slice(0, 6);
    if (elH) elH.innerHTML = high.length ? high.map(function (t) {
      return '<button class="ctm-inbox-item" data-task-open="' + esc(t.id) + '"><div class="ctm-ii-top"><b>' + esc(t.title || t.id) + '</b><span class="kc-flag" style="background:var(--warning);color:#fff;border:0">' + (t.internal_revision_count || 0) + ' vòng</span></div><div class="text-xs muted">PIC: ' + esc(ctPicName(t) || '—') + ' · ' + esc(CT_STATUS[t.status] || t.status) + '</div></button>';
    }).join('') : ctmEmpty(ICON_CHECK, 'Không có task vòng sửa cao', 'Các task đang trong giới hạn vòng sửa lành mạnh.');
  }

  /* ===================================================================
     PLAN DRAWER
     =================================================================== */
  function buildPlanBody(p) {
    const r = rollup(p.id);
    const ts = planChildTasks(p.id);
    const v = function (x) { return x ? esc(x) : '<em class="muted">—</em>'; };
    const chans = arrayOf(p.channels);
    const chHtml = chans.length ? chans.map(function (c) { return '<span class="chip-mini">' + esc(c) + '</span>'; }).join('') : '<em class="muted">—</em>';
    const fileHtml = p.attachment_url ? '<a class="link" href="' + esc(p.attachment_url) + '" target="_blank" rel="noopener">' + esc(p.attachment_name || 'Mở file kế hoạch') + '</a>'
      : (p.attachment_path ? '<span id="ctm-pd-file" data-att-path="' + esc(p.attachment_path) + '">' + esc(p.attachment_name || 'File kế hoạch') + ' <span class="text-xs muted">· đang tạo link…</span></span>'
        : (p.attachment_name ? esc(p.attachment_name) + ' <span class="text-xs muted">(chưa có link)</span>' : '<em class="muted">— chưa đính kèm</em>'));

    const childRows = ts.length ? ts.map(function (t) {
      const overdue = ctIsOverdue(t);
      return '<tr data-task="' + esc(t.id) + '">'
        + '<td><b>' + esc(t.title || '—') + '</b><div class="text-xs muted">' + outputChips(t.output_types) + '</div></td>'
        + '<td><span class="text-xs">' + (ctPicName(t) ? esc(ctPicName(t)) : '<em>chưa gán</em>') + '</span></td>'
        + '<td><span class="text-xs' + (overdue ? ' cwb-overdue' : '') + '">' + (t.wording_deadline ? fmtDT(t.wording_deadline) + (overdue ? ' ⚠' : '') : '—') + '</span></td>'
        + '<td>' + ctStatusBadge(t.status) + (reviewLateCT(t) ? ' <span class="chip-mini" style="background:var(--danger);color:#fff;border:0">quá hạn duyệt</span>' : '') + '</td>'
        + '<td><button class="btn btn-secondary btn-sm" data-task-open="' + esc(t.id) + '">Mở</button></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted)">Chưa có task con. ' + (isLead ? 'Bấm “Thêm task con”.' : '') + '</td></tr>';

    const acts = (loadCache()['plan:' + p.id] || {}).activity || [];
    const actHtml = acts.length ? acts.slice(-12).reverse().map(function (a) { return '<li><span>' + esc(a.text) + ' — <b>' + esc(a.by) + '</b></span><time>' + fmtDT(a.at) + '</time></li>'; }).join('') : '<li><span class="muted">Chưa có hoạt động.</span></li>';

    return ''
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">P</span><h4>Thông tin kế hoạch</h4></div><dl>'
        + '<dt>Nguồn</dt><dd>' + v(SOURCE_LABEL[p.source] || p.source) + (p.origin ? ' · ' + v(p.origin) : '') + '</dd>'
        + '<dt>Campaign</dt><dd>' + v(p.campaign_name) + '</dd>'
        + '<dt>Mục tiêu</dt><dd style="white-space:pre-wrap">' + v(p.objective) + '</dd>'
        + '<dt>Kênh sử dụng</dt><dd>' + chHtml + '</dd>'
        + '<dt>Đối tượng</dt><dd>' + v(p.target_audience) + '</dd>'
        + '<dt>Key message</dt><dd>' + v(p.key_message) + '</dd>'
        + '<dt>CTA</dt><dd>' + v(p.cta) + '</dd>'
        + '<dt>Deadline tổng</dt><dd>' + (p.plan_deadline ? esc(fmtDT(p.plan_deadline)) : '<em class="muted">—</em>') + '</dd>'
        + '<dt>File/link kế hoạch</dt><dd>' + fileHtml + '</dd>'
      + '</dl></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">S</span><h4>Progress summary</h4></div>'
        + '<div class="ctm-progress lg"><i style="width:' + r.progress + '%"></i></div>'
        + '<div class="ctm-sum-grid">'
          + '<div class="ctm-sum"><b>' + r.total + '</b><span>Tổng task</span></div>'
          + '<div class="ctm-sum"><b>' + r.done + '</b><span>Đã duyệt/xong</span></div>'
          + '<div class="ctm-sum"><b>' + r.writing + '</b><span>Đang viết</span></div>'
          + '<div class="ctm-sum"><b>' + r.pendingReview + '</b><span>Chờ Lead duyệt</span></div>'
          + '<div class="ctm-sum' + (r.overdue ? ' is-danger' : '') + '"><b>' + r.overdue + '</b><span>Trễ hạn</span></div>'
          + '<div class="ctm-sum"><b>' + r.mediaReq + '</b><span>Media Request</span></div>'
        + '</div></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">T</span><h4>Task con (' + ts.length + ')</h4>'
        + (isLead ? '<button class="btn btn-primary btn-sm" id="ctm-add-child" style="margin-left:auto"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Thêm task con</button>' : '')
        + '</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Task</th><th>PIC</th><th>Hạn</th><th>Trạng thái</th><th></th></tr></thead><tbody>' + childRows + '</tbody></table></div></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">A</span><h4>Activity timeline</h4></div><ul class="activity-mini">' + actHtml + '</ul></section>';
  }
  function buildPlanActions(p) {
    if (!isLead) return '';
    const btns = [];
    btns.push('<button class="btn btn-secondary btn-sm" id="ctm-edit-plan">Sửa kế hoạch</button>');
    btns.push('<button class="btn btn-primary btn-sm" id="ctm-add-child-2">Thêm task con</button>');
    if (p.status !== 'archived') btns.push('<button class="btn btn-warning btn-sm" id="ctm-archive-plan">Lưu trữ</button>');
    return '<div class="wf-actions"><div class="wf-actions-flow">' + btns.join('') + '</div></div>';
  }
  function openPlanDrawer(p) {
    currentPlan = p;
    const r = rollup(p.id);
    document.getElementById('ctm-pd-source').textContent = (SOURCE_LABEL[p.source] || 'PLAN').toUpperCase();
    document.getElementById('ctm-pd-title').textContent = p.title || '—';
    const st = document.getElementById('ctm-pd-status'); st.className = 'tb-status'; st.innerHTML = planStatusBadge(r.status);
    document.getElementById('ctm-pd-progress').textContent = r.progress + '% · ' + r.done + '/' + r.total + ' task';
    document.getElementById('ctm-pd-deadline').textContent = 'Hạn: ' + (p.plan_deadline ? fmtDT(p.plan_deadline) : '—');
    document.getElementById('ctm-plan-actions').innerHTML = buildPlanActions(p);
    document.getElementById('ctm-plan-body').innerHTML = buildPlanBody(p);
    wirePlanDrawer();
    // File upload (attachment_path, bucket private) → tạo signed URL tải về (best-effort).
    if (p.attachment_path && !p.attachment_url && window.MH && window.MH.store && window.MH.store.files) {
      window.MH.store.files.signedUrl('plan-files', p.attachment_path, 3600).then(function (url) {
        const el = document.getElementById('ctm-pd-file');
        if (el) el.innerHTML = url ? '<a class="link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(p.attachment_name || 'Tải file kế hoạch') + '</a>'
          : esc(p.attachment_name || 'File kế hoạch') + ' <span class="text-xs muted">(không tạo được link tải)</span>';
      }).catch(function () { });
    }
    const dr = document.getElementById('ctm-plan-drawer'); dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    document.getElementById('ctm-plan-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closePlanDrawer() {
    currentPlan = null;
    const dr = document.getElementById('ctm-plan-drawer'); dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true');
    document.getElementById('ctm-plan-backdrop').classList.remove('is-open');
    if (!document.getElementById('ctm-task-drawer').classList.contains('is-open')) document.body.style.overflow = '';
  }
  function wirePlanDrawer() {
    const w = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    w('ctm-add-child', function () { openChildTaskModal(currentPlan); });
    w('ctm-add-child-2', function () { openChildTaskModal(currentPlan); });
    w('ctm-edit-plan', function () { openPlanModal(currentPlan); });
    w('ctm-archive-plan', archivePlan);
  }
  async function archivePlan() {
    if (!isLead || !currentPlan) return;
    await window.MH.store.contentPlans.update(currentPlan.id, { status: 'archived' });
    pushPlanActivity(currentPlan.id, 'Lead lưu trữ kế hoạch');
    toast('info', 'Đã lưu trữ', currentPlan.title || currentPlan.id);
    ctReload('plan');
  }
  function pushPlanActivity(planId, text) {
    const c = loadCache(); const key = 'plan:' + planId; const e = c[key] || (c[key] = {}); e.activity = e.activity || [];
    e.activity.push({ text: text, by: user.name || user.role, at: new Date().toISOString() }); saveCache(c);
  }

  /* ===================================================================
     CONTENT TASK DRAWER (Lead follow / reassign)
     =================================================================== */
  function reviewLateCT(t) { return t && t.status === 'submitted_to_lead' && t.lead_review_due && new Date(t.lead_review_due) < new Date(); }
  function buildTaskBody(t) {
    const v = function (x) { return x ? esc(x) : '<em class="muted">—</em>'; };
    const overdue = ctIsOverdue(t);
    const reviewLate = reviewLateCT(t);
    // Q3 — PIC self-checklist (read-only cho Lead)
    const pcArr = (Array.isArray(t.pic_checklist) ? t.pic_checklist : []).map(function (x) { return typeof x === 'string' ? { label: x, done: false } : { label: (x && x.label) || '', done: !!(x && x.done) }; }).filter(function (x) { return x.label; });
    const pcBlock = pcArr.length ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">P</span><h4>Checklist của PIC (' + pcArr.filter(function (x) { return x.done; }).length + '/' + pcArr.length + ')</h4></div><ul class="ctm-chk-readonly">'
      + pcArr.map(function (x) { return '<li class="' + (x.done ? 'is-on' : '') + '">' + (x.done ? '✓ ' : '○ ') + esc(x.label) + '</li>'; }).join('') + '</ul></section>' : '';
    const plan = t.content_plan_id ? CONTENT_PLANS.find(function (p) { return p.id === t.content_plan_id; }) : null;
    const acts = ((loadCache()['task:' + t.id] || {}).activity) || [];
    const actHtml = acts.length ? acts.slice(-12).reverse().map(function (a) { return '<li><span>' + esc(a.text) + ' — <b>' + esc(a.by) + '</b></span><time>' + fmtDT(a.at) + '</time></li>'; }).join('') : '<li><span class="muted">Chưa có hoạt động.</span></li>';

    let assignHtml = '';
    if (isLead) {
      const planDl = plan && plan.plan_deadline ? ' data-plan-deadline="' + esc(plan.plan_deadline) + '"' : '';
      assignHtml = '<section class="drawer-block ctm-assign"><div class="drawer-block-head"><span class="block-letter">P</span><h4>Lead — Phân công &amp; follow</h4></div>'
        + '<div class="ctm-assign-grid">'
        + '<div class="field"><label class="label">PIC Content</label><select class="select" id="ctm-t-pic">' + picOptionsByIdCT(t.assigned_pic_user_id, t.assigned_pic) + '</select></div>'
        + '<div class="field"><label class="label">Hạn wording</label><input class="input" type="datetime-local" id="ctm-t-deadline"' + planDl + ' value="' + toLocalInput(t.wording_deadline) + '" /></div>'
        + '</div>'
        + '<div class="ctm-assign-grid">'
        + '<div class="field"><label class="label">Ưu tiên</label><select class="select" id="ctm-t-priority">'
          + ['low', 'normal', 'high', 'urgent'].map(function (k) { return '<option value="' + k + '"' + ((t.priority || 'normal') === k ? ' selected' : '') + '>' + ({ low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Gấp' }[k]) + '</option>'; }).join('') + '</select></div>'
        + '<div class="field"><label class="label">Cần Media sản xuất</label><label class="checkbox" style="margin-top:8px"><input type="checkbox" id="ctm-t-media" ' + (t.need_media_production ? 'checked' : '') + ' /><div><span class="checkbox-text">Có — sẽ tạo Internal Media Request sau khi duyệt (Phase 5)</span></div></label></div>'
        + '</div>'
        + '<div class="row" style="justify-content:flex-end;margin-top:8px;gap:8px"><button class="btn btn-primary btn-sm" id="ctm-t-save-assign">Cập nhật phân công</button></div>'
        + '<p class="text-xs muted" id="ctm-t-dlwarn" style="margin:6px 0 0;color:var(--warning);display:none">Hạn task con vượt deadline kế hoạch cha.</p>'
        + '</section>';
    }

    const missing = (isLead) ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">!</span><h4>Missing Info / Assumptions / Risk</h4></div>'
      + '<p class="text-xs muted" style="margin:0 0 8px">Cảnh báo nghiệp vụ — KHÔNG trả brief về Account, chỉ ghi chú để Content nắm.</p>'
      + '<div class="field"><label class="label">Thiếu thông tin (missing info)</label><textarea class="textarea" id="ctm-t-missing" rows="2" placeholder="Thông tin còn thiếu...">' + esc(t.missing_info_notes || '') + '</textarea></div>'
      + '<div class="field"><label class="label">Giả định (assumptions)</label><textarea class="textarea" id="ctm-t-assume" rows="2" placeholder="Giả định khi làm...">' + esc(t.assumptions || '') + '</textarea></div>'
      + '<div class="field"><label class="label">Câu hỏi cho Account/Client</label><textarea class="textarea" id="ctm-t-questions" rows="2" placeholder="Câu hỏi cần làm rõ...">' + esc(t.questions_for_account_client || '') + '</textarea></div>'
      + '<div class="field"><label class="label">Rủi ro (risk notes)</label><textarea class="textarea" id="ctm-t-risk" rows="2" placeholder="Điểm rủi ro...">' + esc(t.risk_notes || '') + '</textarea></div>'
      + '<div class="row" style="justify-content:flex-end"><button class="btn btn-secondary btn-sm" id="ctm-t-save-notes">Lưu ghi chú</button></div>'
      + '</section>'
      : ((t.missing_info_notes || t.assumptions || t.risk_notes) ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">!</span><h4>Ghi chú nghiệp vụ</h4></div>'
        + (t.missing_info_notes ? '<p class="text-xs"><b>Thiếu info:</b> ' + esc(t.missing_info_notes) + '</p>' : '')
        + (t.assumptions ? '<p class="text-xs"><b>Giả định:</b> ' + esc(t.assumptions) + '</p>' : '')
        + (t.risk_notes ? '<p class="text-xs"><b>Rủi ro:</b> ' + esc(t.risk_notes) + '</p>' : '')
        + '</section>' : '');

    // Phase 4 — Lead Review blocks: bản thảo Content + checklist + handoff + revision history + review panel.
    const WSF = WS_ORDER.filter(function (k) { return t[k]; });
    const draftBlock = WSF.length ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">D</span><h4>Bản thảo Content</h4></div>'
      + WSF.map(function (k) { return '<div class="ctm-draft-field"><div class="ctm-draft-label">' + esc(WS_LABEL[k] || k) + '</div><div class="ctm-draft-val" style="white-space:pre-wrap">' + esc(t[k]) + '</div></div>'; }).join('') + '</section>'
      : (isLead ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">D</span><h4>Bản thảo Content</h4></div><p class="text-xs muted" style="margin:0">PIC chưa nhập nội dung.</p></section>' : '');
    const cl = (t.quality_checklist && typeof t.quality_checklist === 'object') ? t.quality_checklist : parseChecklist(t.quality_checklist);
    const clDone = CTCHK.filter(function (c) { return cl[c[0]]; }).length;
    const checklistBlock = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">C</span><h4>Quality Checklist (' + clDone + '/' + CTCHK.length + ')</h4></div><ul class="ctm-chk-readonly">'
      + CTCHK.map(function (c) { return '<li class="' + (cl[c[0]] ? 'is-on' : '') + '">' + (cl[c[0]] ? '✓ ' : '○ ') + esc(c[1]) + '</li>'; }).join('') + '</ul></section>';
    const hoFilled = Object.keys(HANDOFF_LABEL).filter(function (k) { return t[k]; });
    const handoffBlock = t.need_media_production ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">H</span><h4>Production Handoff Draft</h4></div>'
      + (hoFilled.length ? '<dl>' + hoFilled.map(function (k) { return '<dt>' + esc(HANDOFF_LABEL[k]) + '</dt><dd style="white-space:pre-wrap">' + esc(t[k]) + '</dd>'; }).join('') + '</dl>' : '<p class="text-xs muted" style="margin:0">Chưa có handoff — bổ sung trước khi tạo Media Request (Phase 5).</p>') + '</section>' : '';
    const rev = Array.isArray(t.revision_history) ? t.revision_history : [];
    const revBlock = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">V</span><h4>Revision History (' + (t.internal_revision_count || 0) + ' vòng)</h4></div>'
      + (rev.length ? '<ul class="activity-mini">' + rev.slice().reverse().map(function (r) { return '<li><span><b>Vòng ' + esc(r.round || '') + ':</b> ' + esc(r.reason || '') + (r.note ? ' — ' + esc(r.note) : '') + ' · <b>' + esc(r.by || '') + '</b></span><time>' + fmtDT(r.at) + '</time></li>'; }).join('') + '</ul>' : '<p class="text-xs muted" style="margin:0">Chưa có vòng sửa nội bộ.</p>') + '</section>';
    let reviewPanel = '';
    if (isLead && t.status === 'submitted_to_lead') {
      reviewPanel = '<section class="drawer-block ctm-review"><div class="drawer-block-head"><span class="block-letter">R</span><h4>Lead Review Panel</h4></div>'
        + (reviewLate ? '<div class="dw-callout dw--warning" style="margin:0 0 8px"><p><b>⚠ Quá hạn duyệt</b> — hạn ' + esc(fmtDT(t.lead_review_due)) + '. Ưu tiên xử lý để không treo Content.</p></div>' : (t.lead_review_due ? '<p class="text-xs muted" style="margin:0 0 6px">Hạn duyệt: <b>' + esc(fmtDT(t.lead_review_due)) + '</b></p>' : ''))
        + '<p class="text-xs muted" style="margin:0 0 8px">PIC đã gửi bản thảo. Duyệt để chuyển bước, hoặc trả chỉnh (KHÔNG giới hạn vòng) kèm lý do + ghi chú.</p>'
        + '<div class="field"><label class="label">Lý do trả chỉnh</label><select class="select" id="ctm-rev-reason"><option value="">— Chọn lý do —</option>' + REVISION_REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div>'
        + '<div class="field"><label class="label">Ghi chú Lead (bắt buộc khi trả chỉnh)</label><textarea class="textarea" id="ctm-rev-note" rows="2" placeholder="Điểm cần Content chỉnh...">' + esc(t.lead_review_note || '') + '</textarea></div>'
        + '</section>';
    } else if (isLead && t.status === 'lead_approved') {
      reviewPanel = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">R</span><h4>Lead Review</h4></div><div class="dw-callout dw--success"><p><b>Đã duyệt nội dung.</b>' + (t.lead_approved_at ? ' · ' + fmtDT(t.lead_approved_at) : '') + (t.need_media_production ? ' — chờ <b>PIC Content</b> gửi Internal Media Request (trong Content Workbench).' : '') + '</p></div></section>';
    }
    // Phase 5 — block theo dõi Media Order nội bộ (read-only). Content/Lead KHÔNG vào
    // database-orders được → fetch order qua MH.store.orders.get điền async ở openTaskDrawer.
    const mediaTrack = (t.media_request_created && t.media_order_id)
      ? '<section class="drawer-block cwb-snapshot ctm-review"><div class="drawer-block-head"><span class="block-letter">M</span><h4>Media Order — theo dõi sản xuất</h4></div>'
        + '<div id="ctm-media-track-body"><p class="text-xs muted" style="margin:0">Đang tải trạng thái <b>' + esc(t.media_order_id) + '</b>…</p></div></section>'
      : '';

    // Phase 5 — Checklist hoàn tất task (read-only cho Lead theo dõi; PIC gửi Media + bấm hoàn tất).
    let completionHtml = '';
    if (['lead_approved', 'media_order_created', 'completed'].indexOf(t.status) >= 0) {
      const isDone = t.status === 'completed';
      const cmpItems = [{ id: 'ctm-cmp-approved', label: 'Nội dung đã được Lead Content duyệt', done: true }];
      if (t.need_media_production) {
        cmpItems.push({ id: 'ctm-cmp-sent', label: 'Đã gửi Internal Media Request (thiết kế)', done: isDone || !!t.media_request_created });
        cmpItems.push({ id: 'ctm-cmp-final', label: 'Media bàn giao Final', done: isDone });
      }
      const cmpTotal = cmpItems.length, cmpDone = cmpItems.filter(function (x) { return x.done; }).length;
      const cmpPct = Math.round(cmpDone / cmpTotal * 100);
      completionHtml = '<section class="drawer-block ctm-review"><div class="drawer-block-head"><span class="block-letter">✓</span><h4>Checklist hoàn tất task</h4></div><ul class="ctm-chk-readonly">'
        + cmpItems.map(function (it) { return '<li id="' + it.id + '" class="' + (it.done ? 'is-on' : '') + '">' + (it.done ? '✓ ' : '○ ') + esc(it.label) + '</li>'; }).join('') + '</ul>'
        + '<div style="margin-top:10px"><span class="ctm-progress"><i id="ctm-cmp-bar" style="width:' + cmpPct + '%"></i></span> <span class="text-xs" id="ctm-cmp-text">' + cmpDone + '/' + cmpTotal + ' · ' + cmpPct + '%</span></div>'
        + '<p class="text-xs muted" style="margin:8px 0 0">PIC Content gửi Media trong workbench rồi bấm <b>Hoàn tất task</b> khi Media bàn giao Final.</p>'
        + '</section>';
    }

    return ''
      + (plan ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">K</span><h4>Thuộc kế hoạch</h4></div><button class="ctm-inbox-item" data-plan-open="' + esc(plan.id) + '"><b>' + esc(plan.title || plan.id) + '</b><div class="text-xs muted">' + esc(SOURCE_LABEL[plan.source] || plan.source || '') + '</div></button></section>' : '')
      + assignHtml
      + '<section class="drawer-block cwb-snapshot"><div class="drawer-block-head"><span class="block-letter">B</span><h4>Thông tin task</h4></div><dl>'
        + '<dt>Mã task</dt><dd><span class="order-id">' + esc(ctCode(t)) + '</span></dd>'
        + '<dt>Nguồn</dt><dd>' + v(SOURCE_LABEL[t.source] || t.source) + (t.order_id ? ' · Order ' + esc(t.order_id) : '') + '</dd>'
        + '<dt>Output types</dt><dd>' + outputChips(t.output_types) + '</dd>'
        + '<dt>Brief</dt><dd style="white-space:pre-wrap">' + v(t.brief) + '</dd>'
        + '<dt>PIC Content</dt><dd>' + v(ctPicName(t)) + '</dd>'
        + '<dt>Hạn wording</dt><dd>' + (t.wording_deadline ? '<span class="' + (overdue ? 'cwb-overdue' : '') + '">' + esc(fmtDT(t.wording_deadline)) + '</span>' + (overdue ? ' · ⚠ trễ' : '') : '<em class="muted">—</em>') + '</dd>'
        + '<dt>Vòng sửa nội bộ</dt><dd>' + (t.internal_revision_count || 0) + '</dd>'
        + ((t.lead_review_due || t.status === 'submitted_to_lead') ? '<dt>Hạn Lead duyệt</dt><dd>' + (t.lead_review_due ? '<span class="' + (reviewLate ? 'cwb-overdue' : '') + '">' + esc(fmtDT(t.lead_review_due)) + '</span>' + (reviewLate ? ' · ⚠ quá hạn duyệt' : '') : '<em class="muted">—</em>') + '</dd>' : '')
        + '<dt>Cần Media</dt><dd>' + (t.need_media_production ? 'Có' + (t.media_request_created ? ' · đã tạo Media Request' : '') : 'Không') + '</dd>'
      + '</dl></section>'
      + mediaTrack
      + completionHtml
      + draftBlock
      + missing
      + checklistBlock
      + pcBlock
      + handoffBlock
      + revBlock
      + reviewPanel
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">A</span><h4>Activity timeline</h4></div><ul class="activity-mini">' + actHtml + '</ul></section>';
  }
  function buildTaskActions(t) {
    if (!isLead) return '';
    if (t.status === 'submitted_to_lead') {
      const approveLabel = t.need_media_production ? 'Duyệt nội dung' : (t.source === 'client_order' ? 'Duyệt &amp; chuyển Account' : 'Duyệt &amp; hoàn tất');
      return '<div class="wf-actions"><div class="wf-actions-flow">'
        + '<button class="btn btn-warning btn-sm" id="ctm-rev-return">Trả Content chỉnh</button>'
        + '<button class="btn btn-primary btn-sm" id="ctm-rev-approve">' + approveLabel + '</button>'
        + '</div></div>';
    }
    // Phase 5 — đã có Media Order. Admin/Account mở thẳng; Lead Content từ
    // 2026-07-06 CŨNG vào được database-orders ở chế độ READ-ONLY + comment
    // (guard đã mở) → hiện link "Mở Order gốc (chỉ xem)".
    if (t.media_request_created && t.media_order_id) {
      if (isAdmin || isAccount) return '<div class="wf-actions"><div class="wf-actions-flow"><a class="btn btn-secondary btn-sm" href="database-orders.html?id=' + esc(t.media_order_id) + '">Mở Media Order</a></div></div>';
      if (isLead) return '<div class="wf-actions"><div class="wf-actions-flow"><a class="btn btn-ghost btn-sm" href="database-orders.html?id=' + esc(t.media_order_id) + '">Mở Order gốc (chỉ xem)</a></div></div>';
      return '';
    }
    // Phase 5 — PIC Content gửi Internal Media Request (trong content-workbench). Lead KHÔNG tạo nữa,
    // chỉ theo dõi qua block "Media Order" + "Checklist hoàn tất task".
    return '';
  }
  function openTaskDrawer(t) {
    currentTask = t;
    // Eyebrow drawer = "TASK NỘI BỘ · CT-2026-001" để Lead nhắc đúng mã khi trao đổi.
    document.getElementById('ctm-td-source').textContent = (SOURCE_LABEL[t.source] || 'TASK').toUpperCase() + ' · ' + ctCode(t);
    document.getElementById('ctm-td-title').textContent = t.title || '—';
    const st = document.getElementById('ctm-td-status'); st.className = 'tb-status s--wording'; st.innerHTML = '<span class="dot"></span>' + (CT_STATUS[t.status] || t.status);
    const pr = document.getElementById('ctm-td-priority'); pr.className = 'priority-pill p--' + (t.priority || 'normal'); pr.innerHTML = '<span class="dot"></span>' + (PRIO_VI[t.priority] || t.priority || '—');
    document.getElementById('ctm-td-pic').textContent = 'PIC: ' + (ctPicName(t) || 'chưa gán');
    document.getElementById('ctm-task-actions').innerHTML = buildTaskActions(t);
    document.getElementById('ctm-task-body').innerHTML = buildTaskBody(t);
    wireTaskDrawer();
    if (t.media_request_created && t.media_order_id) fillMediaTrack(t.media_order_id);
    const dr = document.getElementById('ctm-task-drawer'); dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    document.getElementById('ctm-task-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeTaskDrawer() {
    currentTask = null;
    const dr = document.getElementById('ctm-task-drawer'); dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true');
    document.getElementById('ctm-task-backdrop').classList.remove('is-open');
    if (!document.getElementById('ctm-plan-drawer').classList.contains('is-open')) document.body.style.overflow = '';
  }
  // Theo dõi Media Order nội bộ (read-only) — Content/Lead đọc order qua RLS lead_content SELECT,
  // KHÔNG cần vào database-orders (bị guard chặn). Điền vào #ctm-media-track-body.
  async function fillMediaTrack(orderId) {
    let o = null;
    try { o = await window.MH.store.orders.get(orderId); } catch (e) { console.warn('[ctm] media track fetch:', e); }
    const cur = document.getElementById('ctm-media-track-body');
    if (cur) {
      if (!o) { cur.innerHTML = '<p class="text-xs muted" style="margin:0">Order <b>' + esc(orderId) + '</b> — chưa đồng bộ được trạng thái (cần Supabase + đã chạy add-content-to-media-order.sql).</p>'; }
      else {
        const ps = o.production_status || 'unassigned';
        const prog = (o.progress != null ? o.progress : 0);
        const picMedia = o.production_pic || [o.production_pic_video, o.production_pic_photo].filter(Boolean).join(' · ');
        const links = [];
        if (o.preview_link) links.push('<a class="btn btn-secondary btn-sm" href="' + esc(o.preview_link) + '" target="_blank" rel="noopener">Xem Preview</a>');
        if (o.final_delivery_link) links.push('<a class="btn btn-secondary btn-sm" href="' + esc(o.final_delivery_link) + '" target="_blank" rel="noopener">Xem Final</a>');
        const pushed = ps && ps !== 'unassigned';
        cur.innerHTML = '<dl style="margin:0">'
          + '<dt>Order nội bộ</dt><dd><span class="order-id">' + esc(orderId) + '</span> <span class="ctm-internal-badge">Internal</span></dd>'
          + '<dt>PIC Media</dt><dd>' + (picMedia ? esc(picMedia) : '<em class="muted">chưa gán</em>') + '</dd>'
          + '<dt>Trạng thái SX</dt><dd><span class="tb-status s--wording"><span class="dot"></span>' + esc(PROD_STATUS[ps] || ps) + '</span>' + (pushed ? '' : ' <span class="text-xs muted">· chờ Media/Account push Production</span>') + '</dd>'
          + '<dt>Tiến độ</dt><dd><span class="ctm-progress"><i style="width:' + prog + '%"></i></span> <span class="text-xs">' + prog + '%</span></dd>'
          + '<dt>Hạn sản xuất</dt><dd>' + (o.requested_deadline ? esc(o.requested_deadline) : '<em class="muted">—</em>') + '</dd>'
          + '<dt>Bàn giao</dt><dd>' + (links.length ? '<div class="row" style="flex-wrap:wrap;gap:6px">' + links.join('') + '</div>' : '<em class="muted">chưa có</em>') + '</dd>'
          + '</dl>';
      }
    }
    // Cập nhật Checklist hoàn tất (read-only) theo trạng thái Final của order.
    const t = currentTask;
    if (t) {
      const final = !!(o && (o.final_delivery_link || o.production_status === 'delivered' || o.production_status === 'completed'));
      const fin = document.getElementById('ctm-cmp-final');
      if (fin) { fin.className = final ? 'is-on' : ''; fin.innerHTML = (final ? '✓ ' : '○ ') + 'Media bàn giao Final'; }
      let total = 1, done = 1;
      if (t.need_media_production) { total += 2; done += (t.media_request_created ? 1 : 0) + (final ? 1 : 0); }
      const pct = Math.round(done / total * 100);
      const bar = document.getElementById('ctm-cmp-bar'); if (bar) bar.style.width = pct + '%';
      const txt = document.getElementById('ctm-cmp-text'); if (txt) txt.textContent = done + '/' + total + ' · ' + pct + '%';
    }
  }
  function wireTaskDrawer() {
    const w = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    w('ctm-t-save-assign', saveTaskAssign);
    w('ctm-t-save-notes', saveTaskNotes);
    w('ctm-rev-return', leadReturnTask);
    w('ctm-rev-approve', leadApproveTask);
    const dl = document.getElementById('ctm-t-deadline');
    if (dl) dl.addEventListener('change', function () {
      const pd = dl.getAttribute('data-plan-deadline'); const warn = document.getElementById('ctm-t-dlwarn');
      if (!warn) return;
      const over = pd && dl.value && parseDt(dl.value) && parseDt(pd) && parseDt(dl.value).getTime() > parseDt(pd).getTime();
      warn.style.display = over ? '' : 'none';
    });
  }
  async function saveTaskAssign() {
    if (!isLead || !currentTask) return;
    // PIC content_tasks keyed theo user_id: select value = id (user thật) | "name:<tên>" (legacy) | "".
    const pick = window.MH.picPick(document.getElementById('ctm-t-pic').value || '');
    const picId = pick.id;
    const pic = pick.name || '';
    const dlEl = document.getElementById('ctm-t-deadline');
    const prio = document.getElementById('ctm-t-priority').value;
    const media = document.getElementById('ctm-t-media').checked;
    const oldPicId = currentTask.assigned_pic_user_id || '';
    const oldPic = ctPicName(currentTask);
    const wasUnassigned = !oldPicId && !currentTask.assigned_pic;
    const isReassign = !!picId && !!oldPicId && picId !== oldPicId;
    // Đổi PIC khi task đang chạy = PIC cũ MẤT quyền sửa ngay (RLS khớp assigned_pic_user_id
    // = auth.uid()) — bản thảo họ đang viết dở sẽ không lưu được nữa.
    // Bắt xác nhận thay vì khóa ô (vẫn cần đổi khi PIC nghỉ đột xuất).
    if (isReassign && ['in_progress', 'submitted_to_lead', 'lead_revision'].indexOf(currentTask.status) >= 0) {
      const ok = window.confirm('Chuyển task "' + (currentTask.title || currentTask.id) + '" từ ' + oldPic + ' sang ' + pic + '?\n\n'
        + oldPic + ' sẽ MẤT quyền chỉnh sửa task này ngay lập tức (kể cả bản thảo đang viết dở).\n'
        + 'Cả hai người sẽ nhận được thông báo.');
      if (!ok) return;
    }
    // Ghi CẢ id (khóa thật) LẪN tên snapshot (hiển thị legacy).
    const patch = { assigned_pic_user_id: picId || null, assigned_pic: pic, priority: prio, need_media_production: media };
    if (dlEl && dlEl.value) patch.wording_deadline = new Date(dlEl.value).toISOString();
    if (picId && ['new', 'assigned'].indexOf(currentTask.status) >= 0) patch.status = 'pic_assigned';

    // Ghi DB TRƯỚC + verify rồi mới notify (bài học noti ma transferToWording).
    // Trước đây KHÔNG có try/catch: update throw là hàm chết im lặng giữa chừng —
    // không toast, không đổi gì, người dùng tưởng nút hỏng.
    let saved;
    try { saved = await window.MH.store.contentTasks.update(currentTask.id, patch); }
    catch (e) {
      console.warn('[ctm] saveTaskAssign failed:', e);
      toast('danger', 'Chưa lưu được phân công', 'DB từ chối ghi. Kiểm tra đã chạy add-content-initiatives.sql + quyền Lead Content (RLS) chưa.');
      return;
    }
    // RLS khớp 0 dòng → maybeSingle() trả null mà KHÔNG throw → phải tự bắt.
    if (window.MH && window.MH.supabaseEnabled && !saved) {
      toast('danger', 'Chưa lưu được phân công', 'Không có dòng nào được cập nhật (RLS chặn hoặc task đã bị xóa). Chưa gửi thông báo cho ai.');
      return;
    }
    if (saved) Object.assign(currentTask, saved); else Object.assign(currentTask, patch);

    pushTaskActivity(currentTask.id,
      wasUnassigned ? ('Lead gán PIC: ' + (pic || '(bỏ gán)'))
        : (isReassign ? ('Lead chuyển PIC: ' + oldPic + ' → ' + pic)
          : ('Lead cập nhật phân công: ' + (pic || '(bỏ gán)')))
      + (patch.wording_deadline ? ' · hạn ' + fmtDT(patch.wording_deadline) : ''));

    // Notify: TRƯỚC ĐÂY chỉ báo khi PIC đang trống (wasUnassigned) → đổi PIC
    // thì KHÔNG ai biết (task nội bộ luôn có sẵn PIC = người tạo). Nay báo cả 2 chiều.
    const label = ctCode(currentTask) + ' · ' + (currentTask.title || 'Content task');
    const dlTxt = patch.wording_deadline ? ' · Hạn: ' + fmtDT(patch.wording_deadline) : '';
    if (picId && wasUnassigned) {
      notifyUserId(picId, { type: 'task_assigned', title: '📝 Bạn được gán Content Task', message: label + dlTxt + ' — Lead: ' + (user.name || 'Lead Content'), link: 'content-workbench.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
    } else if (isReassign) {
      notifyUserId(picId, { type: 'task_assigned', title: '📝 Bạn được giao lại Content Task', message: label + dlTxt + ' — chuyển từ ' + oldPic + ' · Lead: ' + (user.name || 'Lead Content'), link: 'content-workbench.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
      if (oldPicId) notifyUserId(oldPicId, { type: 'task_status_changed', title: '↔️ Task đã chuyển cho người khác', message: label + ' — nay do ' + pic + ' phụ trách. Bạn không còn quyền chỉnh sửa task này.', link: 'content-workbench.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
    }
    if (currentTask.content_plan_id) await syncPlanStatus(currentTask.content_plan_id);
    toast('success', isReassign ? 'Đã chuyển PIC' : 'Đã cập nhật', label + (isReassign ? ' → ' + pic : ''));
    ctReload('task');
  }
  async function saveTaskNotes() {
    if (!isLead || !currentTask) return;
    const patch = {
      missing_info_notes: document.getElementById('ctm-t-missing').value,
      assumptions: document.getElementById('ctm-t-assume').value,
      questions_for_account_client: document.getElementById('ctm-t-questions').value,
      risk_notes: document.getElementById('ctm-t-risk').value
    };
    await window.MH.store.contentTasks.update(currentTask.id, patch);
    pushTaskActivity(currentTask.id, 'Lead cập nhật ghi chú nghiệp vụ');
    toast('success', 'Đã lưu ghi chú', currentTask.title || currentTask.id);
    ctReload('task');
  }
  function pushTaskActivity(taskId, text) {
    const c = loadCache(); const key = 'task:' + taskId; const e = c[key] || (c[key] = {}); e.activity = e.activity || [];
    e.activity.push({ text: text, by: user.name || user.role, at: new Date().toISOString() }); saveCache(c);
  }
  // Cập nhật status/progress plan cha sau khi task con đổi (persist best-effort).
  async function syncPlanStatus(planId) {
    const r = rollup(planId);
    try { await window.MH.store.contentPlans.update(planId, { status: r.status, progress: r.progress }); } catch (e) { }
  }

  /* ---------- Phase 4 — Lead Review / Internal Revision (no-limit) ---------- */
  async function leadReturnTask() {
    if (!isLead || !currentTask || currentTask.status !== 'submitted_to_lead') return;
    const reasonEl = document.getElementById('ctm-rev-reason');
    const noteEl = document.getElementById('ctm-rev-note');
    const reason = (reasonEl && reasonEl.value) || '';
    const note = ((noteEl && noteEl.value) || '').trim();
    if (!note) { toast('warning', 'Cần ghi chú', 'Nhập điểm cần Content chỉnh trước khi trả.'); if (noteEl) noteEl.focus(); return; }
    const cnt = (currentTask.internal_revision_count || 0) + 1;            // ĐẾM vòng, KHÔNG chặn
    const hist = (Array.isArray(currentTask.revision_history) ? currentTask.revision_history.slice() : []);
    hist.push({ round: cnt, reason: reason || 'Khác', note: note, by: user.name || user.role, at: new Date().toISOString() });
    await window.MH.store.contentTasks.update(currentTask.id, {
      status: 'lead_revision', lead_review_status: 'revision',
      internal_revision_count: cnt, revision_history: hist,
      last_revision_reason: reason || 'Khác', lead_review_note: note
    });
    pushTaskActivity(currentTask.id, 'Lead trả chỉnh (vòng ' + cnt + ')' + (reason ? ': ' + reason : ''));
    // Ads: Lead trả chỉnh task ads → ads_status='lead_revision'.
    await syncAdsFromContentTask(currentTask, 'lead_revision', ['submitted_to_lead', 'writing_ads_content', 'assigned_to_content']);
    if (currentTask.assigned_pic_user_id) notifyUserId(currentTask.assigned_pic_user_id, { type: 'task_status_changed', title: '✍️ Lead yêu cầu chỉnh content', message: ctCode(currentTask) + ' · ' + (currentTask.title || 'Content task') + (reason ? ' · ' + reason : '') + ' — ' + note, link: 'content-workbench.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
    else if (currentTask.assigned_pic) notifyByName(currentTask.assigned_pic, { type: 'task_status_changed', title: '✍️ Lead yêu cầu chỉnh content', message: ctCode(currentTask) + ' · ' + (currentTask.title || 'Content task') + (reason ? ' · ' + reason : '') + ' — ' + note, link: 'content-workbench.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
    if (currentTask.content_plan_id) await syncPlanStatus(currentTask.content_plan_id);
    toast('info', 'Đã trả Content chỉnh', currentTask.title || currentTask.id);
    ctReload('task');
  }
  async function leadApproveTask() {
    if (!isLead || !currentTask || currentTask.status !== 'submitted_to_lead') return;
    const noteEl = document.getElementById('ctm-rev-note');
    const note = ((noteEl && noteEl.value) || '').trim();
    const nowIso = new Date().toISOString();
    const patch = { lead_review_status: 'approved', lead_approved_at: nowIso, lead_approved_by_user_id: user.id || null, lead_approved_by: user.name || user.role };
    if (note) patch.lead_review_note = note;
    // Định tuyến sau Lead duyệt (spec §6): cần Media → lead_approved (chờ Phase 5);
    // client_order → submitted_to_account; còn lại (initiative/plan không Media) → completed.
    let nextMsg;
    if (currentTask.need_media_production) { patch.status = 'lead_approved'; nextMsg = ' — chờ tạo Internal Media Request (Phase 5).'; }
    else if (currentTask.source === 'client_order') { patch.status = 'submitted_to_account'; nextMsg = ' — chuyển Account.'; }
    else { patch.status = 'completed'; nextMsg = ' — hoàn tất nội bộ.'; }
    await window.MH.store.contentTasks.update(currentTask.id, patch);
    pushTaskActivity(currentTask.id, 'Lead duyệt nội dung' + nextMsg);
    // Ads: Lead duyệt task ads → cần Media thì 'need_creative' (chờ Media Request), không thì 'lead_approved'.
    await syncAdsFromContentTask(currentTask, currentTask.need_media_production ? 'need_creative' : 'lead_approved',
      ['submitted_to_lead', 'lead_revision', 'writing_ads_content', 'assigned_to_content']);
    if (currentTask.assigned_pic_user_id) notifyUserId(currentTask.assigned_pic_user_id, { type: 'task_status_changed', title: '✅ Lead đã duyệt content', message: ctCode(currentTask) + ' · ' + (currentTask.title || 'Content task') + nextMsg, link: 'content-workbench.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
    else if (currentTask.assigned_pic) notifyByName(currentTask.assigned_pic, { type: 'task_status_changed', title: '✅ Lead đã duyệt content', message: ctCode(currentTask) + ' · ' + (currentTask.title || 'Content task') + nextMsg, link: 'content-workbench.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
    if (patch.status === 'submitted_to_account') notifyRoles(['admin', 'account'], { type: 'task_status_changed', title: '✅ Content task đã được Lead duyệt', message: ctCode(currentTask) + ' · ' + (currentTask.title || 'Content task') + ' — sẵn sàng cho Account.', link: 'content-team.html?task=' + currentTask.id, related_entity_type: null, related_entity_id: currentTask.id });
    if (currentTask.content_plan_id) await syncPlanStatus(currentTask.content_plan_id);
    toast('success', 'Đã duyệt', (currentTask.title || currentTask.id) + nextMsg);
    ctReload('task');
  }

  /* ---------- Phase 5 — Internal Media Request (Content → Media) ---------- */
  const MEDIA_REQ_FIELDS = [
    { k: 'final_headline', label: 'Final headline', src: ['final_headline', 'headline', 'title'] },
    { k: 'final_body_or_script', label: 'Final body / script', req: true, area: true, rows: 4, src: ['final_body_or_script', 'draft_body', 'script', 'caption'] },
    { k: 'cta', label: 'CTA', src: ['cta'] },
    { k: 'mandatory_info', label: 'Thông tin bắt buộc', area: true, rows: 2, src: ['handoff_mandatory_info', 'mandatory_info'] },
    { k: 'visual_direction', label: 'Định hướng hình ảnh', req: true, area: true, rows: 2, src: ['handoff_visual_direction', 'visual_direction'] },
    { k: 'format_size', label: 'Format / Size', req: true, src: ['format_size'] },
    { k: 'channel', label: 'Kênh đăng', req: true, src: ['channel'] },
    { k: 'asset_link', label: 'Asset link', type: 'url', src: ['handoff_asset_link'] },
    { k: 'media_note', label: 'Ghi chú cho Media', area: true, rows: 2, src: ['media_note'] }
  ];
  function mediaPrefill(t, f) {
    for (let i = 0; i < f.src.length; i++) { const k = f.src[i]; if (k === 'title') return t.title || ''; let val = t[k]; if (Array.isArray(val)) val = val[0]; if (val) return val; }
    return '';
  }
  function genOrderId() {
    const d = new Date(); const p = function (n) { return String(n).padStart(2, '0'); };
    return 'MEDIA-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-CT' + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  function openMediaRequestModal(t) {
    if (!isLead || !t) return;
    if (t.status !== 'lead_approved' || !t.need_media_production || t.media_request_created) { toast('warning', 'Chưa đủ điều kiện', 'Chỉ tạo Media Request cho task đã Lead duyệt + cần Media + chưa tạo.'); return; }
    const reqTypes = [['design', 'Thiết kế'], ['media', 'Quay / Chụp'], ['video', 'Video'], ['motion', 'Motion'], ['slide', 'Slide'], ['digital', 'Digital'], ['ads', 'Ads / Post'], ['other', 'Khác']];
    const body = ''
      + '<p class="text-xs muted" style="margin:0 0 6px">Tạo <b>Internal Media Request</b> — order nội bộ (KHÔNG lộ Client Portal) để Media team sản xuất. Lead Media/Account push sang Production sau.</p>'
      + MEDIA_REQ_FIELDS.map(function (f) { return fieldText('mr-' + f.k, f.label, mediaPrefill(t, f), { req: f.req, area: f.area, rows: f.rows, type: f.type }); }).join('')
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Loại sản xuất (request type) <span style="color:var(--red-600)">*</span></label><select class="select" id="mr-request_type">' + reqTypes.map(function (r) { return '<option value="' + r[0] + '"' + (t.request_type === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></div>'
      + fieldText('mr-deliverable_type', 'Hạng mục bàn giao (deliverable) *', t.deliverable_type || '', { ph: 'VD: 3 post + 1 KV' })
      + fieldText('mr-production_deadline', 'Hạn sản xuất *', toLocalInput(t.production_deadline || t.wording_deadline), { type: 'datetime-local' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Ưu tiên</label><select class="select" id="mr-priority">' + ['low', 'normal', 'high', 'urgent'].map(function (k) { return '<option value="' + k + '"' + ((t.priority || 'normal') === k ? ' selected' : '') + '>' + (PRIO_VI[k]) + '</option>'; }).join('') + '</select></div>';
    openModal('Tạo Internal Media Request — ' + (t.title || ''), body, function () { return createMediaRequest(t); });
  }
  async function createMediaRequest(t) {
    const get = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const vals = {};
    MEDIA_REQ_FIELDS.forEach(function (f) { vals[f.k] = get('mr-' + f.k); });
    vals.request_type = get('mr-request_type');
    vals.deliverable_type = get('mr-deliverable_type');
    const dlRaw = get('mr-production_deadline');
    vals.priority = get('mr-priority') || 'normal';
    // Validate min required (spec §4): body/script, visual, format, channel, deadline, request_type, deliverable.
    const missing = [];
    if (!vals.final_body_or_script) missing.push('Final body/script');
    if (!vals.visual_direction) missing.push('Định hướng hình ảnh');
    if (!vals.format_size) missing.push('Format/Size');
    if (!vals.channel) missing.push('Kênh đăng');
    if (!dlRaw) missing.push('Hạn sản xuất');
    if (!vals.request_type) missing.push('Loại sản xuất');
    if (!vals.deliverable_type) missing.push('Hạng mục bàn giao');
    if (missing.length) { toast('warning', 'Thiếu handoff', 'Cần điền: ' + missing.join(', ') + '.'); return false; }
    const deadlineDate = new Date(dlRaw);
    const deadlineIso = deadlineDate.toISOString();
    const deadlineYmd = deadlineIso.slice(0, 10); // requested_deadline là DATE
    const orderId = genOrderId();
    const briefParts = [vals.final_body_or_script];
    if (vals.cta) briefParts.push('CTA: ' + vals.cta);
    if (vals.mandatory_info) briefParts.push('Thông tin bắt buộc: ' + vals.mandatory_info);
    const noteParts = ['[Internal Media Request từ Content Team]', 'Content Task: ' + (t.title || t.id)];
    if (vals.media_note) noteParts.push('Ghi chú Media: ' + vals.media_note);
    // priority task (low/normal/high/urgent) → priority order CHECK (normal/urgent/critical).
    const ORDER_PRIO = { low: 'normal', normal: 'normal', high: 'urgent', urgent: 'critical', critical: 'critical' };
    const payload = {
      order_id: orderId,
      project_name: vals.final_headline || t.title || 'Internal Media Request',
      content_brief: briefParts.join('\n\n'),
      creative_direction: vals.visual_direction,
      size_ratio: vals.format_size,
      source_link: vals.asset_link || null,
      internal_note: noteParts.join('\n'),
      requested_deadline: deadlineYmd,
      internal_deadline: deadlineIso,
      request_type: vals.request_type,
      deliverable_type: [vals.deliverable_type],   // text[]
      priority: ORDER_PRIO[vals.priority] || 'normal',
      department: 'Content Team',
      requester_name: user.name || 'Lead Content',
      requester_email: (user && user.email) || 'content-team@cb.vn',
      requester_role: 'lead_content',
      origin: 'content_team',
      order_kind: 'internal_media_request',
      client_visible: false,
      source_content_task_id: t.id,
      source_content_plan_id: t.content_plan_id || null,
      account_status: 'confirmed',          // reuse flow: Lead Media/Account push thẳng Production
      brief_wording_status: 'completed',     // KHÔNG vào Content Wording lại
      created_at: new Date().toISOString()
    };
    // 1) Tạo order nội bộ (best-effort; loop-strip cột thiếu nếu migration chưa chạy).
    try { await window.MH.store.orders.create(payload); }
    catch (e) {
      console.warn('[ctm] create media order failed:', e);
      toast('warning', 'Chưa tạo được Media Order', 'Kiểm tra đã chạy add-content-to-media-order.sql + RLS lead_content. Thay đổi chưa lưu.');
      return false;
    }
    // 2) Cập nhật content task: đánh dấu đã tạo Media Request + lưu handoff đã chốt.
    await window.MH.store.contentTasks.update(t.id, {
      status: 'media_order_created', media_request_created: true, media_order_id: orderId,
      handoff_ready: true, final_headline: vals.final_headline, final_body_or_script: vals.final_body_or_script,
      handoff_mandatory_info: vals.mandatory_info, handoff_visual_direction: vals.visual_direction,
      format_size: vals.format_size, channel: vals.channel, handoff_asset_link: vals.asset_link,
      media_note: vals.media_note, production_deadline: deadlineIso, request_type: vals.request_type,
      deliverable_type: vals.deliverable_type
    });
    pushTaskActivity(t.id, 'Lead tạo Internal Media Request → ' + orderId);
    notifyRoles(['admin', 'account', 'lead_media'], { type: 'order_new', title: '🎬 Internal Media Request từ Content', message: orderId + ' · ' + (vals.final_headline || t.title || '') + ' — cần Media sản xuất (push Production).', link: 'database-orders.html?id=' + orderId, related_entity_type: 'orders', related_entity_id: orderId });
    if (t.content_plan_id) await syncPlanStatus(t.content_plan_id);
    toast('success', 'Đã tạo Media Request', orderId + ' — order nội bộ, không lộ Client Portal.');
    closeModal();
    await loadContentData();
    if (currentTask) { const nt = CONTENT_TASKS.find(function (x) { return x.id === t.id; }); if (nt) openTaskDrawer(nt); }
    return true;
  }

  /* ===================================================================
     MODALS — tạo/sửa Plan · tạo Initiative · tạo Task con
     =================================================================== */
  let modalSaveHandler = null;
  function openModal(title, bodyHtml, onSave) {
    document.getElementById('ctm-modal-title').textContent = title;
    document.getElementById('ctm-modal-body').innerHTML = bodyHtml;
    modalSaveHandler = onSave;
    document.getElementById('ctm-modal').classList.add('is-open');
    document.getElementById('ctm-modal').setAttribute('aria-hidden', 'false');
    document.getElementById('ctm-modal-backdrop').classList.add('is-open');
  }
  function closeModal() {
    modalSaveHandler = null;
    document.getElementById('ctm-modal').classList.remove('is-open');
    document.getElementById('ctm-modal').setAttribute('aria-hidden', 'true');
    document.getElementById('ctm-modal-backdrop').classList.remove('is-open');
  }
  function fieldText(id, label, val, opts) {
    opts = opts || {};
    return '<div class="edit-row" style="grid-template-columns:1fr"><label>' + esc(label) + (opts.req ? ' <span style="color:var(--red-600)">*</span>' : '') + '</label>'
      + (opts.area ? '<textarea class="textarea" id="' + id + '" rows="' + (opts.rows || 2) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(val || '') + '</textarea>'
        : '<input class="input" id="' + id + '" type="' + (opts.type || 'text') + '" value="' + esc(val || '') + '" placeholder="' + esc(opts.ph || '') + '" />')
      + '</div>';
  }

  function openPlanModal(plan) {
    if (!isLead) return;
    const p = plan || {};
    // Đính kèm kế hoạch ngay dưới Tên: nút upload PDF + ô link Drive/Doc (cạnh nhau).
    const attachBlock = '<div class="edit-row" style="grid-template-columns:1fr"><label>File kế hoạch (PDF) <span class="text-xs muted">· hoặc dán link bên cạnh</span></label>'
      + '<div class="ctm-attach-row">'
      + '<label class="ctm-file-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
      + '<span id="cpm-file-label">' + (p.attachment_name ? esc(p.attachment_name) : 'Chọn file PDF…') + '</span>'
      + '<input type="file" id="cpm-file" accept=".pdf,application/pdf" hidden /></label>'
      + '<input class="input" type="url" id="cpm-atturl" placeholder="https://drive… (link Doc/Drive)" value="' + esc(p.attachment_url || '') + '" />'
      + '</div>'
      + (p.attachment_path && !p.attachment_url ? '<p class="text-xs muted" style="margin:5px 0 0">Đã đính kèm: <b>' + esc(p.attachment_name || 'file') + '</b> — chọn file mới để thay.</p>' : '')
      + '</div>';
    const body = ''
      + fieldText('cpm-title', 'Tên kế hoạch', p.title, { req: true, ph: 'VD: Kế hoạch Khai trương Q3' })
      + attachBlock
      + fieldText('cpm-campaign', 'Campaign', p.campaign_name, { ph: 'Tên campaign' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Nguồn</label><select class="select" id="cpm-source">'
        + ['campaign_package', 'content_initiated', 'strategy_board', 'client_order'].map(function (k) { return '<option value="' + k + '"' + ((p.source || 'campaign_package') === k ? ' selected' : '') + '>' + esc(SOURCE_LABEL[k]) + '</option>'; }).join('') + '</select></div>'
      + fieldText('cpm-objective', 'Mục tiêu', p.objective, { area: true, rows: 2, ph: 'Mục tiêu kế hoạch' })
      + fieldText('cpm-channels', 'Kênh sử dụng (phân cách bằng dấu phẩy)', arrayOf(p.channels).join(', '), { ph: 'facebook, tiktok, landing' })
      + fieldText('cpm-audience', 'Đối tượng', p.target_audience, { ph: 'Đối tượng mục tiêu' })
      + fieldText('cpm-keymsg', 'Key message', p.key_message, { ph: 'Thông điệp chính' })
      + fieldText('cpm-cta', 'CTA', p.cta, { ph: 'Kêu gọi hành động' })
      + fieldText('cpm-deadline', 'Deadline tổng', toLocalInput(p.plan_deadline), { type: 'datetime-local' });
    openModal(plan ? 'Sửa Content Plan' : 'Tạo Content Plan', body, function () { return savePlan(plan); });
    const fEl = document.getElementById('cpm-file');
    if (fEl) fEl.addEventListener('change', function () { const lbl = document.getElementById('cpm-file-label'); if (lbl) lbl.textContent = (fEl.files && fEl.files[0]) ? fEl.files[0].name : 'Chọn file PDF…'; });
  }
  // Upload PDF kế hoạch lên Storage bucket plan-files dưới prefix content-plans/ (cần RLS từ add-content-initiatives.sql mới).
  async function uploadContentPlanFile(planId, file) {
    if (!window.MH || !window.MH.store || !window.MH.store.files || !planId || !file) return null;
    if (!window.MH.supabaseEnabled) { toast('warning', 'Chưa lưu được file', 'Demo chưa bật Supabase — dùng ô link thay cho upload.'); return null; }
    try {
      const safe = (file.name || 'file').replace(/[^\w.\-]+/g, '_');
      const path = 'content-plans/' + planId + '/' + Date.now() + '-' + safe;
      const res = await window.MH.store.files.upload('plan-files', path, file, { contentType: file.type || 'application/pdf' });
      return { path: (res && res.path) || path, name: file.name || safe };
    } catch (e) { console.warn('[ctm upload]', e); toast('warning', 'Lỗi upload file', 'Không tải được lên Storage (kiểm tra đã chạy add-content-initiatives.sql bản mới). Dùng ô link thay thế.'); return null; }
  }
  async function savePlan(existing) {
    const title = (document.getElementById('cpm-title').value || '').trim();
    if (!title) { toast('warning', 'Thiếu tên', 'Nhập tên kế hoạch.'); return false; }
    const payload = {
      title: title,
      campaign_name: document.getElementById('cpm-campaign').value.trim(),
      source: document.getElementById('cpm-source').value,
      objective: document.getElementById('cpm-objective').value.trim(),
      channels: document.getElementById('cpm-channels').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      target_audience: document.getElementById('cpm-audience').value.trim(),
      key_message: document.getElementById('cpm-keymsg').value.trim(),
      cta: document.getElementById('cpm-cta').value.trim(),
      attachment_url: document.getElementById('cpm-atturl').value.trim()   // link Drive/Doc (ô cạnh nút upload)
    };
    const dl = document.getElementById('cpm-deadline').value;
    if (dl) payload.plan_deadline = new Date(dl).toISOString();
    const fileEl = document.getElementById('cpm-file');
    const file = fileEl && fileEl.files && fileEl.files[0];
    if (existing) {
      if (file) { const up = await uploadContentPlanFile(existing.id, file); if (up) { payload.attachment_path = up.path; payload.attachment_name = up.name; } }
      await window.MH.store.contentPlans.update(existing.id, payload);
      pushPlanActivity(existing.id, 'Lead cập nhật thông tin kế hoạch' + (file ? ' + đính kèm file' : ''));
      toast('success', 'Đã lưu', title);
    } else {
      payload.owner_lead = user.name || 'Lead Content';
      payload.created_by = user.name || user.role;
      payload.status = 'active';
      const created = await window.MH.store.contentPlans.create(payload);
      // Upload sau khi có id (path = content-plans/<id>/...), rồi gắn attachment_path vào plan.
      if (file) { const up = await uploadContentPlanFile(created.id, file); if (up) await window.MH.store.contentPlans.update(created.id, { attachment_path: up.path, attachment_name: up.name }); }
      pushPlanActivity(created.id, 'Lead tạo kế hoạch' + (file ? ' + đính kèm file' : ''));
      toast('success', 'Đã tạo Content Plan', title);
    }
    closeModal();
    await loadContentData();
    if (existing && currentPlan) openPlanDrawer(CONTENT_PLANS.find(function (x) { return x.id === existing.id; }) || existing);
    return true;
  }

  function openChildTaskModal(plan) {
    if (!isLead || !plan) return;
    const body = ''
      + fieldText('cct-title', 'Tiêu đề task', '', { req: true, ph: 'VD: Bài social khai trương' })
      + fieldText('cct-brief', 'Brief', '', { area: true, rows: 3, ph: 'Mô tả nội dung cần viết...' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Output types</label><div class="ctm-chk-group" id="cct-outputs">' + outputCheckboxes([]) + '</div></div>'
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>PIC Content</label><select class="select" id="cct-pic">' + picOptionsByIdCT('') + '</select></div>'
      + fieldText('cct-deadline', 'Hạn wording', '', { type: 'datetime-local' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Ưu tiên</label><select class="select" id="cct-priority">' + ['low', 'normal', 'high', 'urgent'].map(function (k) { return '<option value="' + k + '"' + (k === 'normal' ? ' selected' : '') + '>' + ({ low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Gấp' }[k]) + '</option>'; }).join('') + '</select></div>'
      + '<div class="edit-row" style="grid-template-columns:1fr"><label class="checkbox"><input type="checkbox" id="cct-media" /><div><span class="checkbox-text">Cần Media sản xuất (tạo Internal Media Request sau khi duyệt)</span></div></label></div>'
      + '<p class="text-xs muted" id="cct-dlwarn" style="margin:0;color:var(--warning);display:none">Hạn task con vượt deadline kế hoạch cha (' + (plan.plan_deadline ? fmtDT(plan.plan_deadline) : '—') + ').</p>';
    openModal('Thêm task con — ' + (plan.title || ''), body, function () { return saveChildTask(plan); });
    const dl = document.getElementById('cct-deadline');
    if (dl && plan.plan_deadline) dl.addEventListener('change', function () {
      const warn = document.getElementById('cct-dlwarn');
      const over = dl.value && parseDt(dl.value).getTime() > parseDt(plan.plan_deadline).getTime();
      if (warn) warn.style.display = over ? '' : 'none';
    });
  }
  async function saveChildTask(plan) {
    const title = (document.getElementById('cct-title').value || '').trim();
    if (!title) { toast('warning', 'Thiếu tiêu đề', 'Nhập tiêu đề task.'); return false; }
    const pickC = window.MH.picPick(document.getElementById('cct-pic').value || '');
    const picId = pickC.id;
    const pic = pickC.name || '';
    const payload = {
      content_plan_id: plan.id, source: plan.source === 'client_order' ? 'client_order' : 'campaign_package',
      title: title, brief: document.getElementById('cct-brief').value.trim(),
      output_types: collectOutputs('#cct-outputs'), assigned_pic_user_id: picId || null, assigned_pic: pic,
      priority: document.getElementById('cct-priority').value,
      need_media_production: document.getElementById('cct-media').checked,
      status: picId ? 'pic_assigned' : 'new', created_by_user_id: user.id || null, created_by: user.name || user.role
    };
    const dl = document.getElementById('cct-deadline').value;
    if (dl) payload.wording_deadline = new Date(dl).toISOString();
    const created = await window.MH.store.contentTasks.create(payload);
    pushPlanActivity(plan.id, 'Lead thêm task con: ' + title + (pic ? ' → ' + pic : ''));
    if (picId) notifyUserId(picId, { type: 'task_assigned', title: '📝 Bạn được gán Content Task', message: title + (payload.wording_deadline ? ' · Hạn: ' + fmtDT(payload.wording_deadline) : '') + ' — Lead: ' + (user.name || 'Lead Content'), link: 'content-workbench.html?task=' + created.id, related_entity_type: null, related_entity_id: created.id });
    await syncPlanStatus(plan.id);
    toast('success', 'Đã thêm task con', title);
    closeModal();
    await loadContentData();
    if (currentPlan) openPlanDrawer(CONTENT_PLANS.find(function (x) { return x.id === plan.id; }) || plan);
    return true;
  }

  function openInitiativeModal() {
    if (!isLead) return;
    const body = ''
      + fieldText('cim-title', 'Tiêu đề', '', { req: true, ph: 'VD: Series Tip chăm sóc khách hàng' })
      + fieldText('cim-objective', 'Mục tiêu', '', { area: true, rows: 2, ph: 'Mục tiêu nội dung' })
      + fieldText('cim-channels', 'Kênh (phân cách bằng dấu phẩy)', '', { ph: 'facebook, tiktok' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Output types</label><div class="ctm-chk-group" id="cim-outputs">' + outputCheckboxes([]) + '</div></div>'
      + fieldText('cim-audience', 'Đối tượng', '', { ph: 'Đối tượng mục tiêu' })
      + fieldText('cim-keymsg', 'Key message', '', { ph: 'Thông điệp chính' })
      + fieldText('cim-cta', 'CTA', '', { ph: 'Kêu gọi hành động' })
      + fieldText('cim-assets', 'Asset links (phân cách bằng dấu phẩy)', '', { ph: 'https://..., https://...' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>PIC Content</label><select class="select" id="cim-pic">' + picOptionsByIdCT('') + '</select></div>'
      + fieldText('cim-deadline', 'Hạn wording', '', { type: 'datetime-local' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Ưu tiên</label><select class="select" id="cim-priority">' + ['low', 'normal', 'high', 'urgent'].map(function (k) { return '<option value="' + k + '"' + (k === 'normal' ? ' selected' : '') + '>' + ({ low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Gấp' }[k]) + '</option>'; }).join('') + '</select></div>'
      + '<div class="edit-row" style="grid-template-columns:1fr"><label class="checkbox"><input type="checkbox" id="cim-media" /><div><span class="checkbox-text">Cần Media sản xuất</span></div></label></div>'
      + '<div id="cim-media-wrap" style="display:none">'
        + fieldText('cim-media-type', 'Loại Media Request', '', { ph: 'VD: KV, video teaser' })
        + fieldText('cim-media-deadline', 'Hạn Media', '', { type: 'datetime-local' })
        + fieldText('cim-media-notes', 'Ghi chú cho Media', '', { area: true, rows: 2, ph: 'Định hướng cho Media team' })
      + '</div>';
    openModal('Tạo task nội bộ Content Team', body, saveInitiative);
    const mc = document.getElementById('cim-media');
    if (mc) mc.addEventListener('change', function () { document.getElementById('cim-media-wrap').style.display = mc.checked ? '' : 'none'; });
  }
  async function saveInitiative() {
    const title = (document.getElementById('cim-title').value || '').trim();
    if (!title) { toast('warning', 'Thiếu tiêu đề', 'Nhập tiêu đề task nội bộ.'); return false; }
    const pickI = window.MH.picPick(document.getElementById('cim-pic').value || '');
    const picId = pickI.id;
    const pic = pickI.name || '';
    const needMedia = document.getElementById('cim-media').checked;
    const payload = {
      source: 'content_initiated', content_plan_id: null,
      title: title, brief: document.getElementById('cim-objective').value.trim(),
      output_types: collectOutputs('#cim-outputs'),
      assigned_pic_user_id: picId || null, assigned_pic: pic, priority: document.getElementById('cim-priority').value,
      visual_direction: document.getElementById('cim-keymsg').value.trim(),
      asset_links: document.getElementById('cim-assets').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      need_media_production: needMedia,
      status: picId ? 'pic_assigned' : 'new', created_by_user_id: user.id || null, created_by: user.name || user.role
    };
    const dl = document.getElementById('cim-deadline').value;
    if (dl) payload.wording_deadline = new Date(dl).toISOString();
    if (needMedia) {
      payload.request_type = document.getElementById('cim-media-type').value.trim();
      payload.media_note = document.getElementById('cim-media-notes').value.trim();
      const md = document.getElementById('cim-media-deadline').value;
      if (md) payload.production_deadline = new Date(md).toISOString();
    }
    const created = await window.MH.store.contentTasks.create(payload);
    pushTaskActivity(created.id, 'Lead tạo task nội bộ Content Team' + (pic ? ' → ' + pic : ''));
    if (picId) notifyUserId(picId, { type: 'task_assigned', title: '📝 Bạn được gán task nội bộ Content', message: title + ' — Lead: ' + (user.name || 'Lead Content'), link: 'content-workbench.html?task=' + created.id, related_entity_type: null, related_entity_id: created.id });
    toast('success', 'Đã tạo task nội bộ', title);
    closeModal();
    loadContentData();
    return true;
  }

  /* ===================================================================
     ADS ORDERS — Client → Content Team (order_kind='ads_order')
     Lifecycle riêng `ads_status`; KHÔNG qua Account/Production.
     =================================================================== */
  let ADS_ORDERS = [];
  let currentAds = null;

  const ADS_STATUS = {
    draft: 'Nháp', submitted: 'Client vừa gửi', lead_checking: 'Lead đang kiểm tra',
    assigned_to_content: 'Đã gán PIC Content', writing_ads_content: 'Đang viết nội dung Ads',
    submitted_to_lead: 'Chờ Lead duyệt', lead_revision: 'Lead trả chỉnh', lead_approved: 'Lead đã duyệt',
    need_creative: 'Cần creative', media_request_created: 'Đã tạo Media Request',
    creative_ready: 'Creative sẵn sàng', ready_to_launch: 'Sẵn sàng chạy Ads', running: 'Đang chạy',
    paused: 'Tạm dừng', completed: 'Hoàn thành', report_updated: 'Đã cập nhật báo cáo',
    archived: 'Lưu trữ', cancelled: 'Đã hủy'
  };
  const ADS_STATUS_CLS = {
    submitted: 's--pending', lead_checking: 's--checking', assigned_to_content: 's--inprogress',
    writing_ads_content: 's--inprogress', submitted_to_lead: 's--review', lead_revision: 's--needinfo',
    lead_approved: 's--inprogress', need_creative: 's--needinfo', media_request_created: 's--inprogress',
    creative_ready: 's--ready', ready_to_launch: 's--ready', running: 's--inprogress',
    paused: 's--needinfo', completed: 's--completed', report_updated: 's--completed', archived: 's--completed', cancelled: 's--cancelled'
  };
  const ADS_OBJECTIVE = { lead_generation: 'Lead Generation', inbox: 'Inbox / Tin nhắn', awareness: 'Awareness', event: 'Sự kiện', opening: 'Khai trương', remarketing: 'Remarketing', traffic: 'Traffic', video_view: 'Video View' };
  const ADS_LIFE = ['Client gửi', 'Kiểm tra & gán PIC', 'Viết nội dung', 'Lead duyệt', 'Creative', 'Sẵn sàng / Chạy', 'Hoàn thành'];
  const ADS_LIFE_REACHED = {
    draft: 0, submitted: 0, lead_checking: 1, assigned_to_content: 1, writing_ads_content: 2,
    submitted_to_lead: 3, lead_revision: 2, lead_approved: 3, need_creative: 4, media_request_created: 4,
    creative_ready: 5, ready_to_launch: 5, running: 5, paused: 5, completed: 6, report_updated: 6, archived: 6, cancelled: 0
  };
  const ADS_NEW = ['submitted', 'lead_checking'];
  const ADS_TERMINAL = ['completed', 'report_updated', 'archived', 'cancelled'];

  function adsDetail(o) {
    if (!o) return {};
    let d = o.ads_detail;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
    return d && typeof d === 'object' ? d : {};
  }
  function adsPicOf(o) { return o.brief_wording_pic || (adsDetail(o).assigned_pic) || ''; }
  function adsTasksOf(o) { return CONTENT_TASKS.filter(function (t) { return t.source === 'ads_order' && t.order_id === o.order_id; }); }
  function fmtBudget(d) {
    if (d.budget_type === 'daily') return d.daily_budget ? Number(d.daily_budget).toLocaleString('vi-VN') + ' đ/ngày' : '—';
    return d.budget_amount ? Number(d.budget_amount).toLocaleString('vi-VN') + ' đ (tổng)' : '—';
  }

  async function persistAds(o, patch, activity) {
    Object.assign(o, patch);
    if (activity) pushActivity(o.order_id, activity);
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try { await window.MH.store.orders.update(o.order_id, patch); }
      catch (e) { console.warn('[ctm-ads] persist failed:', e); toast('warning', 'Chưa đồng bộ DB', 'Kiểm tra đã chạy supabase/add-ads-orders.sql + RLS lead_content.'); }
    } else {
      try { const arr = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]'); const i = arr.findIndex(function (x) { return x.order_id === o.order_id; }); if (i >= 0) { arr[i] = Object.assign({}, arr[i], patch); localStorage.setItem('mh-submitted-orders', JSON.stringify(arr)); } } catch (e) { }
    }
  }
  async function reloadAndReopenAds() {
    const id = currentAds && currentAds.order_id;
    await loadOrders();
    if (!id) return;
    const o = ADS_ORDERS.find(function (x) { return x.order_id === id; });
    if (o) openAdsDrawer(o); else closeAdsDrawer();
  }
  // Auto-sync ads_status theo hành động Lead trên Content Task nguồn ads (return/approve).
  // allowedFrom: chỉ sync khi ads_status hiện tại thuộc list (không kéo lùi trạng thái launch).
  async function syncAdsFromContentTask(t, newStatus, allowedFrom) {
    if (!t || t.source !== 'ads_order' || !t.order_id) return;
    const o = ADS_ORDERS.find(function (x) { return x.order_id === t.order_id; })
      || (window.__CTM_ALL || []).find(function (x) { return x.order_id === t.order_id && x.order_kind === 'ads_order'; });
    if (!o) return;
    const cur = o.ads_status || 'submitted';
    if (allowedFrom && allowedFrom.indexOf(cur) < 0) return;
    await persistAds(o, { ads_status: newStatus }, 'Đồng bộ từ Content Task → ' + (ADS_STATUS[newStatus] || newStatus));
  }

  /* ---------- RENDER: Ads view ---------- */
  function renderAdsOrders() {
    const list = ADS_ORDERS.slice();
    const cInbox = document.getElementById('ctm-ads-inbox');
    const news = list.filter(function (o) { return ADS_NEW.indexOf(o.ads_status || 'submitted') >= 0; });
    const newCount = document.getElementById('ctm-ads-new-count'); if (newCount) newCount.textContent = news.length + ' yêu cầu';
    if (cInbox) cInbox.innerHTML = news.length
      ? news.map(function (o) {
          const d = adsDetail(o);
          return '<button class="ctm-inbox-item" data-ads-open="' + esc(o.order_id) + '"><div class="ctm-ii-top"><b>' + esc(o.project_name || o.order_id) + '</b><span class="badge-campaign">Ads</span><span class="badge-from-client">From Client</span></div>'
            + '<div class="text-xs muted">' + esc(o.order_id) + ' · ' + esc(ADS_OBJECTIVE[d.objective] || d.objective || '—') + ' · ' + esc(o.department || d.branch_department || '—') + '</div></button>';
        }).join('')
      : '<p class="text-xs muted" style="margin:0">Chưa có yêu cầu Ads mới.</p>';

    const tb = document.getElementById('ctm-ads-tbody');
    const info = document.getElementById('ctm-ads-info'); if (info) info.textContent = list.length + ' Ads Order';
    if (tb) tb.innerHTML = list.length
      ? list.map(function (o) {
          const d = adsDetail(o);
          const st = o.ads_status || 'submitted';
          const needCr = d.need_media_production || st === 'need_creative' || st === 'media_request_created';
          return '<tr style="cursor:pointer" data-ads-open="' + esc(o.order_id) + '">'
            + '<td class="mono text-xs">' + esc(o.order_id) + '</td>'
            + '<td><b>' + esc(o.project_name || '—') + '</b></td>'
            + '<td class="text-xs">' + esc(ADS_OBJECTIVE[d.objective] || d.objective || '—') + '</td>'
            + '<td class="text-xs">' + esc(fmtBudget(d)) + '</td>'
            + '<td class="text-xs">' + esc(adsPicOf(o) || '—') + '</td>'
            + '<td><span class="tb-status ' + (ADS_STATUS_CLS[st] || '') + '">' + esc(ADS_STATUS[st] || st) + '</span></td>'
            + '<td>' + (needCr ? '<span class="badge-need-creative">Need Creative</span>' : '<span class="text-xs muted">—</span>') + '</td>'
            + '<td><button class="btn btn-ghost btn-sm" data-ads-open="' + esc(o.order_id) + '">Mở</button></td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:44px;color:var(--text-muted)">Chưa có Ads Order nào từ Client.</td></tr>';

    renderAdsDashboard(list);
  }

  /* ---------- Dashboard: Ads Orders KPI (Fix 4a) ---------- */
  function renderAdsDashboard(list) {
    const dash = document.getElementById('ctm-ads-dash');
    const attn = document.getElementById('ctm-ads-attn');
    if (!dash && !attn) return;
    const BUCKETS = [
      { label: 'Mới — chờ tiếp nhận', match: ['submitted', 'lead_checking'], color: '#191970' },
      { label: 'Đang chuẩn bị nội dung', match: ['assigned_to_content', 'writing_ads_content', 'submitted_to_lead', 'lead_revision', 'lead_approved'], color: '#1D4ED8' },
      { label: 'Đang chuẩn bị creative', match: ['need_creative', 'media_request_created'], color: '#B07600' },
      { label: 'Sẵn sàng / Đang chạy', match: ['creative_ready', 'ready_to_launch', 'running', 'paused'], color: '#0E7490' },
      { label: 'Hoàn thành', match: ['completed', 'report_updated', 'archived'], color: '#0A7A52' },
      { label: 'Đã hủy', match: ['cancelled'], color: '#94a3b8' }
    ];
    if (dash) {
      if (!list.length) {
        dash.innerHTML = '<p class="text-xs muted" style="margin:0">Chưa có Ads Order nào.</p>';
      } else {
        const max = Math.max.apply(null, BUCKETS.map(function (b) { return list.filter(function (o) { return b.match.indexOf(o.ads_status || 'submitted') >= 0; }).length; }).concat([1]));
        dash.innerHTML = BUCKETS.map(function (b) {
          const n = list.filter(function (o) { return b.match.indexOf(o.ads_status || 'submitted') >= 0; }).length;
          return '<div style="display:flex;align-items:center;gap:10px;padding:4px 0">'
            + '<span class="text-xs" style="flex:0 0 168px;color:var(--text-muted)">' + b.label + '</span>'
            + '<span style="flex:1;height:6px;background:var(--surface-3);border-radius:99px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.round(n / max * 100) + '%;background:' + b.color + ';border-radius:99px"></i></span>'
            + '<b class="text-xs" style="flex:0 0 20px;text-align:right">' + n + '</b></div>';
        }).join('');
      }
    }
    if (attn) {
      // Cần chú ý: mới chưa nhận + đang chờ Lead duyệt + creative chờ xử lý.
      const ATTN = ['submitted', 'lead_checking', 'submitted_to_lead', 'need_creative'];
      const items = list.filter(function (o) { return ATTN.indexOf(o.ads_status || 'submitted') >= 0; });
      const cnt = document.getElementById('ctm-ads-attn-count'); if (cnt) cnt.textContent = items.length;
      attn.innerHTML = items.length
        ? items.slice(0, 6).map(function (o) {
            const st = o.ads_status || 'submitted';
            return '<button class="ctm-inbox-item" data-ads-open="' + esc(o.order_id) + '"><div class="ctm-ii-top"><b>' + esc(o.project_name || o.order_id) + '</b><span class="badge-campaign">Ads</span></div>'
              + '<div class="text-xs muted">' + esc(o.order_id) + ' · ' + esc(ADS_STATUS[st] || st) + ' · PIC: ' + esc(adsPicOf(o) || 'chưa gán') + '</div></button>';
          }).join('')
        : '<p class="text-xs muted" style="margin:0">Không có Ads Order nào cần chú ý.</p>';
    }
  }

  /* ---------- Ads drawer ---------- */
  function buildAdsActions(o) {
    if (!isLead) return '';
    const st = o.ads_status || 'submitted';
    const btns = [];
    const B = function (id, label, kind) { btns.push('<button class="btn btn-' + (kind || 'secondary') + ' btn-sm" data-ads-act="' + id + '">' + label + '</button>'); };
    if (ADS_NEW.indexOf(st) >= 0) B('lead_checking', 'Tiếp nhận đơn', 'primary');
    if (['assigned_to_content', 'lead_revision'].indexOf(st) >= 0) B('writing_ads_content', 'Bắt đầu viết nội dung', 'secondary');
    if (st === 'writing_ads_content') B('submitted_to_lead', 'Đánh dấu chờ Lead duyệt', 'secondary');
    if (st === 'submitted_to_lead') { B('lead_revision', 'Trả chỉnh', 'warning'); B('lead_approved', 'Duyệt nội dung', 'primary'); }
    if (['lead_approved', 'need_creative', 'creative_ready'].indexOf(st) >= 0) B('ready_to_launch', 'Sẵn sàng chạy Ads', 'primary');
    if (st === 'ready_to_launch') B('running', 'Bắt đầu chạy', 'primary');
    if (st === 'running') { B('paused', 'Tạm dừng', 'warning'); B('completed', 'Hoàn thành', 'primary'); }
    if (st === 'paused') B('running', 'Tiếp tục chạy', 'primary');
    if (st === 'completed') { B('report_updated', 'Cập nhật báo cáo', 'secondary'); B('archived', 'Lưu trữ', 'secondary'); }
    if (ADS_TERMINAL.indexOf(st) < 0) B('cancelled', 'Hủy đơn', 'ghost');
    return btns.length ? '<div class="wf-actions"><div class="wf-actions-flow">' + btns.join('') + '</div></div>' : '';
  }

  function buildAdsBody(o) {
    const d = adsDetail(o);
    const st = o.ads_status || 'submitted';
    const v = function (x) { return (x && String(x).trim()) ? esc(x) : '<em class="muted">—</em>'; };
    const arr = function (a) { return (Array.isArray(a) && a.length) ? a.map(function (x) { return '<span class="chip-mini">' + esc(x) + '</span>'; }).join('') : '<em class="muted">—</em>'; };
    const link = function (u) { return u ? '<a class="link" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>' : '<em class="muted">—</em>'; };
    const rowd = function (label, val) { return '<div class="detail-row"><span class="detail-dt">' + label + '</span><span class="detail-dd">' + val + '</span></div>'; };
    const planVal = (function () {
      const parts = [];
      if (d.plan_file && d.plan_file.name) parts.push('<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' + esc(d.plan_file.name));
      if (d.plan_file_url) parts.push('<a class="link" href="' + esc(d.plan_file_url) + '" target="_blank" rel="noopener">Link Google Drive</a>');
      return parts.length ? parts.join(' · ') : '<em class="muted">—</em>';
    })();

    const reached = ADS_LIFE_REACHED[st] != null ? ADS_LIFE_REACHED[st] : 0;
    const lifeLi = ADS_LIFE.map(function (s, i) {
      const cs = i < reached ? 'done' : (i === reached ? 'active' : 'pending');
      return '<li class="bw-step bw-' + cs + '"><span class="bw-dot">' + (cs === 'done' ? '✓' : (i + 1)) + '</span><span class="bw-label">' + s + '</span></li>';
    }).join('');
    const revNote = (st === 'lead_revision' && o.wording_lead_note) ? '<div class="dw-callout dw--warning" style="margin-top:var(--space-3)"><p><b>Lead trả chỉnh:</b> ' + esc(o.wording_lead_note) + '</p></div>' : '';

    // Assign PIC panel (Lead)
    let assign = '';
    if (isLead && ADS_TERMINAL.indexOf(st) < 0) {
      assign = '<section class="drawer-block ctm-assign"><div class="drawer-block-head"><span class="block-letter">P</span><h4>Lead Content — Phân công PIC</h4></div>'
        + '<div class="ctm-assign-grid"><div class="field"><label class="label">PIC Content</label><select class="select" id="ads-pic">' + picSelectOptions(adsPicOf(o)) + '</select></div></div>'
        + '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn btn-primary btn-sm" id="ads-assign">Gán PIC Content</button></div></section>';
    }

    // Content Tasks tách từ Ads Order
    const tasks = adsTasksOf(o);
    const taskRows = tasks.length ? tasks.map(function (t) {
      return '<button class="ctm-inbox-item" data-task-open="' + esc(t.id) + '"><div class="ctm-ii-top"><b>' + esc(t.title || t.id) + '</b><span class="text-xs">' + esc(CT_STATUS[t.status] || t.status) + '</span></div><div class="text-xs muted">PIC: ' + esc(ctPicName(t) || 'chưa gán') + '</div></button>';
    }).join('') : '<p class="text-xs muted" style="margin:0">Chưa tách Content Task nào.</p>';
    const taskBtn = (isLead && ADS_TERMINAL.indexOf(st) < 0) ? '<button class="btn btn-secondary btn-sm" id="ads-split-tasks" style="margin-top:8px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Tách Content Tasks</button>' : '';

    // Internal Media Request — fallback tìm theo source_ads_order_id (khi PIC tạo từ workbench
    // trước lúc cột ads_media_order_id kịp sync, hoặc DB thiếu cột).
    const mediaId = o.ads_media_order_id || (function () {
      const m = (window.__CTM_ALL || []).find(function (x) { return x.order_kind === 'internal_ads_media_request' && x.source_ads_order_id === o.order_id; });
      return m ? m.order_id : null;
    })();
    let mediaBlock;
    if (mediaId) {
      mediaBlock = '<div class="dw-callout dw--brand"><p><b>Đã tạo Internal Media Request:</b> <span class="mono">' + esc(mediaId) + '</span> <span class="badge-internal-src">Internal · From Ads</span></p><p class="text-xs muted" style="margin:6px 0 0">Media team sản xuất creative; không lộ Client Portal.</p></div>';
    } else if (isLead && ['lead_approved', 'need_creative', 'writing_ads_content', 'submitted_to_lead'].indexOf(st) >= 0) {
      mediaBlock = '<p class="text-xs muted" style="margin:0 0 8px">Cần thiết kế/video? Tạo yêu cầu nội bộ cho Media (không lộ Client).</p><button class="btn btn-primary btn-sm" id="ads-media-req"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Tạo Internal Media Request</button>';
    } else {
      mediaBlock = '<p class="text-xs muted" style="margin:0">Chưa cần creative.</p>';
    }

    const creativeReadyBtn = (isLead && mediaId && ['media_request_created', 'need_creative'].indexOf(st) >= 0) ? '<button class="btn btn-success btn-sm" data-ads-act="creative_ready" style="margin-top:8px">Đánh dấu Creative sẵn sàng</button>' : '';

    const acts = (cacheOf(o.order_id).activity || []).slice(-10).reverse();
    const actHtml = acts.length ? acts.map(function (a) { return '<li><span>' + esc(a.text) + ' — <b>' + esc(a.by) + '</b></span><time>' + fmtDT(a.at) + '</time></li>'; }).join('') : '<li><span class="muted">Chưa có hoạt động.</span></li>';

    return ''
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:0 0 var(--space-3)"><span class="badge-campaign">Ads Order</span><span class="badge-from-client">From Client</span>' + (d.need_media_production ? '<span class="badge-need-creative">Need Creative</span>' : '') + '</div>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">L</span><h4>Ads Lifecycle</h4></div><ol class="bw-steps">' + lifeLi + '</ol>' + revNote + '</section>'
      + assign
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">C</span><h4>Thông tin chiến dịch</h4></div><div>'
        + rowd('Chi nhánh / Bộ phận', v(d.branch_department)) + rowd('Người yêu cầu', v(d.requester_name) + ' · ' + v(d.requester_email))
        + rowd('File kế hoạch', planVal)
        + rowd('Ngày lên Ads', v(d.desired_launch_date)) + rowd('Chạy', v(d.campaign_start_date) + ' → ' + v(d.campaign_end_date))
        + rowd('Ưu tiên', v(PRIO_LABEL[d.priority] || d.priority)) + '</div></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">K</span><h4>Mục tiêu / KPI</h4></div><div>'
        + rowd('Mục tiêu', v(ADS_OBJECTIVE[d.objective] || d.objective)) + rowd('KPI kỳ vọng', v(d.expected_kpi))
        + rowd('Số lead', v(d.expected_leads)) + rowd('CPL', v(d.expected_cpl)) + rowd('Ghi chú KPI', v(d.kpi_notes)) + '</div></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">$</span><h4>Kênh &amp; ngân sách</h4></div><div>'
        + rowd('Nền tảng', arr(d.platforms)) + rowd('Loại chiến dịch', v(d.campaign_type)) + rowd('Ngân sách', v(fmtBudget(d))) + rowd('Ghi chú ngân sách', v(d.budget_notes)) + '</div></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">A</span><h4>Nội dung &amp; đối tượng</h4></div><div>'
        + rowd('Sản phẩm / CT', v(d.product_program_name)) + rowd('Mô tả ngắn', v(d.short_description)) + rowd('Ưu đãi', v(d.offer_message))
        + rowd('Nhóm học viên', v(d.target_student_group)) + rowd('Mô tả đối tượng', v(d.target_audience_description)) + rowd('Khu vực', v(d.applicable_area))
        + rowd('Hotline', v(d.hotline_or_contact)) + rowd('Landing / Form', link(d.landing_or_form_url)) + '</div></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">T</span><h4>Content Tasks</h4></div>' + taskRows + taskBtn + '</section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">M</span><h4>Internal Media Request</h4></div>' + mediaBlock + creativeReadyBtn + '</section>'
      + (d.special_notes ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">N</span><h4>Ghi chú khách hàng</h4></div><p style="white-space:pre-wrap;margin:0">' + esc(d.special_notes) + '</p></section>' : '')
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">·</span><h4>Hoạt động</h4></div><ul class="activity-mini">' + actHtml + '</ul></section>';
  }

  function openAdsDrawer(o) {
    currentAds = o;
    const st = o.ads_status || 'submitted';
    document.getElementById('ctm-ad-id').textContent = o.order_id;
    document.getElementById('ctm-ad-title').textContent = o.project_name || '—';
    const stEl = document.getElementById('ctm-ad-status'); stEl.textContent = ADS_STATUS[st] || st; stEl.className = 'tb-status ' + (ADS_STATUS_CLS[st] || '');
    const d = adsDetail(o);
    const pr = document.getElementById('ctm-ad-priority'); pr.innerHTML = '<span class="dot"></span>' + (PRIO_LABEL[d.priority] || d.priority || 'Bình thường');
    document.getElementById('ctm-ad-pic').textContent = 'PIC: ' + (adsPicOf(o) || 'chưa gán');
    document.getElementById('ctm-ads-actions').innerHTML = buildAdsActions(o);
    document.getElementById('ctm-ads-body').innerHTML = buildAdsBody(o);
    // Wire actions
    document.querySelectorAll('#ctm-ads-actions [data-ads-act], #ctm-ads-body [data-ads-act]').forEach(function (b) {
      b.addEventListener('click', function () { adsAdvance(o, b.getAttribute('data-ads-act')); });
    });
    const asg = document.getElementById('ads-assign'); if (asg) asg.addEventListener('click', function () { assignAdsPic(o); });
    const split = document.getElementById('ads-split-tasks'); if (split) split.addEventListener('click', function () { openAdsSplitModal(o); });
    const mreq = document.getElementById('ads-media-req'); if (mreq) mreq.addEventListener('click', function () { openAdsMediaModal(o); });
    document.getElementById('ctm-ads-drawer').classList.add('is-open');
    document.getElementById('ctm-ads-drawer').setAttribute('aria-hidden', 'false');
    document.getElementById('ctm-ads-backdrop').classList.add('is-open');
  }
  function closeAdsDrawer() {
    currentAds = null;
    document.getElementById('ctm-ads-drawer').classList.remove('is-open');
    document.getElementById('ctm-ads-drawer').setAttribute('aria-hidden', 'true');
    document.getElementById('ctm-ads-backdrop').classList.remove('is-open');
  }

  /* Khép kín noti phía CLIENT cho Ads lifecycle: Media flow client nhận noti ở
     checking/confirmed/preview/final, Ads trước đây câm hoàn toàn sau submit.
     Báo client 3 nấc: running (bắt đầu chạy) · completed · cancelled.
     resume paused→running KHÔNG re-notify (client đã biết chiến dịch đang chạy).
     Type 'order_status_changed' (có sẵn trong CHECK constraint); bell client tự
     resolve về client-dashboard.html?order=<ADS-id> qua related_entity_id. */
  const ADS_CLIENT_NOTIFY = {
    running:   { title: 'Chiến dịch Ads đã bắt đầu chạy', msg: 'chiến dịch của anh/chị đã được lên Ads và đang chạy. Theo dõi trạng thái trong Cổng của tôi.' },
    completed: { title: 'Chiến dịch Ads đã hoàn thành', msg: 'chiến dịch đã kết thúc. Content Team sẽ cập nhật báo cáo kết quả (nếu có) qua kênh liên hệ của anh/chị.' },
    cancelled: { title: 'Yêu cầu chạy Ads đã hủy', msg: 'yêu cầu chạy Ads đã được hủy. Vui lòng liên hệ Content Team nếu anh/chị cần thêm thông tin.' }
  };
  async function notifyAdsClient(o, newStatus, prevStatus) {
    if (!window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    const info = ADS_CLIENT_NOTIFY[newStatus];
    if (!info) return;
    if (newStatus === 'running' && prevStatus === 'paused') return;
    try {
      let uid = o.requester_id || null;
      if (!uid && o.requester_email) {
        const { data } = await window.MH.supabase
          .from('users').select('id').eq('email', o.requester_email).maybeSingle();
        if (data && data.id) uid = data.id;
      }
      if (!uid) { console.warn('[ctm-ads] notify client: không tìm thấy user cho', o.requester_email); return; }
      await window.MH.supabase.from('notifications').insert({
        user_id: uid,
        type: 'order_status_changed',
        title: info.title,
        message: o.order_id + ' · ' + (o.project_name || '') + ' — ' + info.msg,
        link: 'tracking.html?code=' + encodeURIComponent(o.order_id),
        related_entity_type: 'orders',
        related_entity_id: o.order_id
      });
    } catch (e) { console.warn('[ctm-ads] notify client failed:', e); }
  }

  async function adsAdvance(o, newStatus) {
    if (!isLead || !newStatus) return;
    const prevStatus = o.ads_status || 'submitted';
    if (newStatus === 'lead_revision') {
      const note = prompt('Lý do trả chỉnh cho Content:', o.wording_lead_note || '');
      if (note === null) return;
      await persistAds(o, { ads_status: 'lead_revision', wording_lead_note: note }, 'Lead trả chỉnh nội dung Ads');
      // PIC role content bị guard đá khỏi content-team → link về Content Wording (nơi PIC làm task ads).
      notifyByName(adsPicOf(o), { type: 'task_status_changed', title: 'Ads — Lead trả chỉnh', message: o.order_id + ': ' + (note || ''), link: 'content-workbench.html', related_entity_type: 'orders', related_entity_id: o.order_id });
    } else if (newStatus === 'cancelled') {
      if (!confirm('Hủy Ads Order ' + o.order_id + '?')) return;
      await persistAds(o, { ads_status: 'cancelled' }, 'Hủy Ads Order');
      notifyAdsClient(o, 'cancelled', prevStatus);
    } else {
      await persistAds(o, { ads_status: newStatus }, 'Ads chuyển trạng thái → ' + (ADS_STATUS[newStatus] || newStatus));
      notifyAdsClient(o, newStatus, prevStatus);
    }
    toast('success', 'Đã cập nhật', o.order_id + ' → ' + (ADS_STATUS[newStatus] || newStatus));
    await reloadAndReopenAds();
  }

  async function assignAdsPic(o) {
    const pic = (document.getElementById('ads-pic').value || '').trim();
    if (!pic) { toast('warning', 'Thiếu PIC', 'Nhập tên PIC Content.'); return; }
    const patch = { brief_wording_pic: pic };
    if (ADS_NEW.indexOf(o.ads_status || 'submitted') >= 0) patch.ads_status = 'assigned_to_content';
    await persistAds(o, patch, 'Gán PIC Content: ' + pic);
    // PIC role content không vào được content-team → link Content Wording (task ads sẽ được tách về đó).
    notifyByName(pic, { type: 'task_assigned', title: 'Bạn được gán Ads Order', message: o.order_id + ' · ' + (o.project_name || '') + ' — Lead sẽ tách Content Task cho bạn.', link: 'content-workbench.html', related_entity_type: 'orders', related_entity_id: o.order_id });
    toast('success', 'Đã gán PIC', pic);
    await reloadAndReopenAds();
  }

  /* ---------- Tách Content Tasks từ Ads Order ---------- */
  const ADS_TASK_TYPES = [
    { k: 'ads_copy', label: 'Ads copy', outputs: ['primary_text'] },
    { k: 'headline', label: 'Headline', outputs: ['headline'] },
    { k: 'caption', label: 'Caption', outputs: ['caption'] },
    { k: 'video_script', label: 'Video script', outputs: ['video_script'] },
    { k: 'landing_copy', label: 'Landing copy', outputs: ['landing_copy'] }
  ];
  function openAdsSplitModal(o) {
    if (!isLead) return;
    const chips = ADS_TASK_TYPES.map(function (t) { return '<label class="ctm-chk-chip"><input type="checkbox" name="ads-tt" value="' + t.k + '" /> ' + t.label + '</label>'; }).join('');
    const body = '<p class="text-xs muted" style="margin:0 0 8px">Chọn hạng mục nội dung cần tách. Mỗi hạng mục tạo 1 Content Task cho PIC xử lý ở Content Wording.</p>'
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Hạng mục</label><div class="ctm-chk-group">' + chips + '</div></div>'
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>PIC Content</label><select class="select" id="ads-tt-pic">' + picSelectOptions(adsPicOf(o)) + '</select></div>'
      + fieldText('ads-tt-deadline', 'Hạn wording', '', { type: 'datetime-local' });
    openModal('Tách Content Tasks — ' + (o.project_name || o.order_id), body, function () { return createAdsContentTasks(o); });
  }
  async function createAdsContentTasks(o) {
    const picked = [].slice.call(document.querySelectorAll('input[name="ads-tt"]:checked')).map(function (i) { return i.value; });
    if (!picked.length) { toast('warning', 'Chưa chọn', 'Chọn ít nhất 1 hạng mục.'); return false; }
    const pic = (document.getElementById('ads-tt-pic').value || '').trim();
    const dlRaw = document.getElementById('ads-tt-deadline').value;
    const d = adsDetail(o);
    let created = 0;
    for (let i = 0; i < picked.length; i++) {
      const def = ADS_TASK_TYPES.find(function (x) { return x.k === picked[i]; });
      const payload = {
        source: 'ads_order', order_id: o.order_id, content_plan_id: null,
        title: '[Ads] ' + def.label + ' — ' + (o.project_name || o.order_id),
        brief: [d.product_program_name, d.offer_message, d.mandatory_message].filter(Boolean).join(' · '),
        output_types: def.outputs, assigned_pic: pic, priority: d.priority || 'normal',
        visual_direction: d.desired_angle || '', mandatory_info: d.mandatory_message || '', cta: d.desired_cta || '',
        need_media_production: !!d.need_media_production,
        status: pic ? 'pic_assigned' : 'new', created_by: user.name || user.role
      };
      if (dlRaw) payload.wording_deadline = new Date(dlRaw).toISOString();
      try { const c = await window.MH.store.contentTasks.create(payload); created++; if (pic) notifyByName(pic, { type: 'task_assigned', title: 'Content Task (Ads) mới', message: payload.title, link: 'content-workbench.html?task=' + c.id, related_entity_type: null, related_entity_id: c.id }); }
      catch (e) { console.warn('[ctm-ads] create content task failed:', e); }
    }
    if (!created) { toast('warning', 'Chưa tạo được', 'Kiểm tra add-content-initiatives.sql + add-ads-orders.sql (source ads_order).'); return false; }
    const patch = { ads_status: 'writing_ads_content' };
    if (ADS_NEW.indexOf(o.ads_status || 'submitted') >= 0 || o.ads_status === 'assigned_to_content') { patch.brief_wording_pic = pic || adsPicOf(o); }
    await persistAds(o, patch, 'Tách ' + created + ' Content Task' + (pic ? ' → ' + pic : ''));
    toast('success', 'Đã tách task', created + ' Content Task đã tạo.');
    closeModal();
    await Promise.all([loadOrders(), loadContentData()]);
    const no = ADS_ORDERS.find(function (x) { return x.order_id === o.order_id; }); if (no) openAdsDrawer(no);
    return true;
  }

  /* ---------- Internal Ads Media Request ---------- */
  function genAdsMediaId() {
    const d = new Date(); return 'ADS-MEDIA-' + d.getFullYear() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  function openAdsMediaModal(o) {
    if (!isLead) return;
    const d = adsDetail(o);
    const reqTypes = [['design', 'Thiết kế'], ['media', 'Quay / Chụp'], ['video', 'Video'], ['motion', 'Motion'], ['digital', 'Digital'], ['other', 'Khác']];
    const body = '<p class="text-xs muted" style="margin:0 0 6px">Tạo <b>Internal Media Request từ Ads</b> — order nội bộ (KHÔNG lộ Client Portal). Media sản xuất creative, Lead Media/Account push Production.</p>'
      + fieldText('amr-body', 'Nội dung / brief creative', [d.offer_message, d.mandatory_message, d.desired_angle].filter(Boolean).join('\n'), { req: true, area: true, rows: 4 })
      + fieldText('amr-visual', 'Định hướng hình ảnh', d.visual_style || '', { req: true, area: true, rows: 2 })
      + fieldText('amr-format', 'Format / Size', (Array.isArray(d.creative_sizes) ? d.creative_sizes.join(', ') : ''), { req: true })
      + fieldText('amr-channel', 'Kênh đăng', (Array.isArray(d.platforms) ? d.platforms.join(', ') : ''), { req: true })
      + fieldText('amr-deliverable', 'Hạng mục bàn giao', (Array.isArray(d.creative_types) ? d.creative_types.join(', ') : ''), { req: true, ph: 'VD: 3 static + 1 video' })
      + fieldText('amr-asset', 'Asset link', d.existing_assets_url || '', { type: 'url' })
      + '<div class="edit-row" style="grid-template-columns:1fr"><label>Loại sản xuất *</label><select class="select" id="amr-request_type">' + reqTypes.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select></div>'
      + fieldText('amr-deadline', 'Hạn sản xuất *', toLocalInput(d.creative_deadline ? d.creative_deadline + 'T17:00' : ''), { type: 'datetime-local' })
      + fieldText('amr-note', 'Ghi chú cho Media', d.brand_notes || '', { area: true, rows: 2 });
    openModal('Internal Media Request từ Ads — ' + (o.project_name || o.order_id), body, function () { return createAdsMediaRequest(o); });
  }
  async function createAdsMediaRequest(o) {
    const get = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const body = get('amr-body'), visual = get('amr-visual'), format = get('amr-format'), channel = get('amr-channel');
    const deliverable = get('amr-deliverable'), asset = get('amr-asset'), reqType = get('amr-request_type');
    const dlRaw = get('amr-deadline'), note = get('amr-note');
    const missing = [];
    if (!body) missing.push('Nội dung/brief'); if (!visual) missing.push('Định hướng hình ảnh');
    if (!format) missing.push('Format/Size'); if (!channel) missing.push('Kênh'); if (!deliverable) missing.push('Hạng mục'); if (!dlRaw) missing.push('Hạn sản xuất');
    if (missing.length) { toast('warning', 'Thiếu thông tin', 'Cần: ' + missing.join(', ') + '.'); return false; }
    const deadlineIso = new Date(dlRaw).toISOString();
    const orderId = genAdsMediaId();
    const payload = {
      order_id: orderId,
      project_name: (o.project_name || 'Ads') + ' — Creative',
      content_brief: body,
      creative_direction: visual,
      size_ratio: format,
      source_link: asset || null,
      internal_note: ['[Internal Media Request từ Ads Order]', 'Nguồn Ads: ' + o.order_id, note ? ('Ghi chú: ' + note) : ''].filter(Boolean).join('\n'),
      requested_deadline: deadlineIso.slice(0, 10),
      internal_deadline: deadlineIso,
      request_type: reqType || 'design',
      deliverable_type: [deliverable],
      priority: (adsDetail(o).priority === 'critical' ? 'critical' : (adsDetail(o).priority === 'urgent' ? 'urgent' : 'normal')),
      department: 'Content Team',
      requester_name: user.name || 'Lead Content',
      requester_email: (user && user.email) || 'content-team@cb.vn',
      requester_role: 'lead_content',
      origin: 'ads_order',
      order_kind: 'internal_ads_media_request',
      client_visible: false,
      source_ads_order_id: o.order_id,
      account_status: 'confirmed',
      brief_wording_status: 'completed',
      created_at: new Date().toISOString()
    };
    try { await window.MH.store.orders.create(payload); }
    catch (e) { console.warn('[ctm-ads] create ads-media order failed:', e); toast('warning', 'Chưa tạo được', 'Kiểm tra add-ads-orders.sql + RLS lead_content insert ads-media.'); return false; }
    await persistAds(o, { ads_status: 'media_request_created', ads_media_order_id: orderId }, 'Tạo Internal Media Request → ' + orderId);
    notifyRoles(['admin', 'account', 'lead_media'], { type: 'order_new', title: 'Internal Media Request (Ads)', message: orderId + ' · ' + (o.project_name || '') + ' — creative cho Ads (push Production).', link: 'database-orders.html?id=' + orderId, related_entity_type: 'orders', related_entity_id: orderId });
    toast('success', 'Đã tạo Media Request', orderId + ' — nội bộ, không lộ Client.');
    closeModal();
    await reloadAndReopenAds();
    return true;
  }

  /* ---------- Wiring Phase 2 (chạy lúc IIFE init, element đã có ở cuối body) ---------- */
  (function wirePhase2() {
    const on = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('ctm-new-plan', function () { openPlanModal(null); });
    on('ctm-new-initiative', openInitiativeModal);
    on('ctm-plan-close', closePlanDrawer);
    on('ctm-plan-backdrop', closePlanDrawer);
    on('ctm-task-close', closeTaskDrawer);
    on('ctm-task-backdrop', closeTaskDrawer);
    on('ctm-modal-close', closeModal);
    on('ctm-modal-cancel', closeModal);
    on('ctm-modal-backdrop', closeModal);
    on('ctm-modal-save', async function () { if (modalSaveHandler) await modalSaveHandler(); });
    // Delegation mở plan/task từ list rows + nút trong drawer.
    document.addEventListener('click', function (e) {
      // "Xem tất cả" trên card dashboard → chuyển tab (data-ctm-view ngoài #ctm-tabs).
      const act = e.target.closest('.ctm-card-action[data-ctm-view]');
      if (act) { view = act.getAttribute('data-ctm-view'); renderTabs(); if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const pb = e.target.closest('[data-plan-open]');
      if (pb) { const p = CONTENT_PLANS.find(function (x) { return x.id === pb.getAttribute('data-plan-open'); }); if (p) { if (currentTask && !document.getElementById('ctm-plan-drawer').contains(pb)) closeTaskDrawer(); openPlanDrawer(p); } return; }
      const tb = e.target.closest('[data-task-open]');
      if (tb) { const t = CONTENT_TASKS.find(function (x) { return x.id === tb.getAttribute('data-task-open'); }); if (t) openTaskDrawer(t); return; }
    });
  })();

  /* ---------- Init ---------- */
  (function fillFilterOptions() {
    const fs = document.getElementById('ctm-filter-status');
    ENGAGED.forEach(function (k) { const op = document.createElement('option'); op.value = k; op.textContent = WSTATUS[k]; fs.appendChild(op); });
    const ft = document.getElementById('ctm-filter-type');
    ['design', 'media', 'video', 'motion', 'slide', 'digital', 'ads', 'other'].forEach(function (k) { const op = document.createElement('option'); op.value = k; op.textContent = TYPE_LABEL[k] || k; ft.appendChild(op); });
  })();

  document.getElementById('ctm-tabs').addEventListener('click', function (e) {
    const b = e.target.closest('[data-ctm-view]'); if (!b) return;
    view = b.getAttribute('data-ctm-view');
    renderTabs();
  });
  document.getElementById('ctm-search').addEventListener('input', function (e) { FILTERS.search = e.target.value; renderList(); });
  ['status', 'type', 'pic'].forEach(function (k) {
    document.getElementById('ctm-filter-' + k).addEventListener('change', function (e) { FILTERS[k] = e.target.value; renderList(); });
  });
  document.getElementById('ctm-drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('ctm-drawer-backdrop').addEventListener('click', closeDrawer);
  document.getElementById('ctm-ads-close').addEventListener('click', closeAdsDrawer);
  document.getElementById('ctm-ads-backdrop').addEventListener('click', closeAdsDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('ctm-modal').classList.contains('is-open')) { closeModal(); return; }
    if (document.getElementById('ctm-ads-drawer').classList.contains('is-open')) { closeAdsDrawer(); return; }
    if (document.getElementById('ctm-task-drawer').classList.contains('is-open')) { closeTaskDrawer(); return; }
    if (document.getElementById('ctm-plan-drawer').classList.contains('is-open')) { closePlanDrawer(); return; }
    if (document.getElementById('ctm-drawer').classList.contains('is-open')) closeDrawer();
  });
  // Delegation chung: mọi phần tử [data-open] (inbox card, kanban card, row button) → drawer.
  document.addEventListener('click', function (e) {
    const ab = e.target.closest('[data-ads-open]');
    if (ab) { const a = ADS_ORDERS.find(function (x) { return x.order_id === ab.getAttribute('data-ads-open'); }); if (a) openAdsDrawer(a); return; }
    const b = e.target.closest('[data-open]'); if (!b) return;
    const o = ORDERS.find(function (x) { return x.order_id === b.getAttribute('data-open'); }); if (o) openDrawer(o);
  });

  Promise.all([loadContentUsers(), loadOrders(), loadContentData()]).then(function () {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'ads-orders' && (isLead || isAccountAdmin || isSupervisor)) { view = 'ads-orders'; renderTabs(); }
    // Deep-link từ notification: PHẢI chuyển đúng tab trước khi mở drawer.
    // Trước đây chỉ mở drawer trên tab hiện tại (thường là Dashboard) → đóng drawer
    // ra là màn hình trống, người dùng tưởng "không có task".
    const id = params.get('id');
    if (id) {
      const ad = ADS_ORDERS.find(function (x) { return x.order_id === id; });
      if (ad) { view = 'ads-orders'; renderTabs(); openAdsDrawer(ad); }
      else {
        const all = window.__CTM_ALL || [];
        const inEngaged = ORDERS.find(function (x) { return x.order_id === id; });
        const o = inEngaged || all.find(function (x) { return x.order_id === id; });
        if (o) {
          // Order đã vào Content Team → về Inbox (chỗ Lead xử lý); chưa vào thì
          // giữ tab hiện tại + nói rõ vì sao nó không nằm trong danh sách.
          if (inEngaged) { view = 'inbox'; renderTabs(); }
          else toast('warning', 'Order chưa ở Content Team', id + ' chưa được Account chuyển sang Content Wording (hoặc đã rời luồng) — mở ở chế độ xem.');
          openDrawer(o);
        } else {
          toast('danger', 'Không mở được order', id + ' không có trong danh sách bạn xem được. Kiểm tra order đã được chuyển Content Wording chưa, hoặc quyền truy cập.');
        }
      }
    }
    // Deep-link Plan / Content Task (Phase 2).
    const planId = params.get('plan');
    if (planId) {
      const p = CONTENT_PLANS.find(function (x) { return x.id === planId; });
      if (p) { view = 'plans'; renderTabs(); openPlanDrawer(p); }
      else toast('danger', 'Không mở được kế hoạch', 'Content Plan không tồn tại hoặc bạn không có quyền xem.');
    }
    const taskId = params.get('task');
    if (taskId) {
      const t = CONTENT_TASKS.find(function (x) { return x.id === taskId; });
      if (t) {
        // Task chờ duyệt → Inbox (hàng đợi việc của Lead); còn lại → tab Task nội bộ.
        view = (t.status === 'submitted_to_lead') ? 'inbox' : 'initiatives';
        renderTabs();
        openTaskDrawer(t);
      } else {
        toast('danger', 'Không mở được task', 'Content task không tồn tại hoặc bạn không có quyền xem.');
      }
    }
  });
  // Đồng bộ nhẹ: poll 60s + reload khi quay lại tab (pattern calendar.js).
  setInterval(function () { if (!document.hidden) { loadOrders(); loadContentData(); } }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { loadOrders(); loadContentData(); } });
})();
