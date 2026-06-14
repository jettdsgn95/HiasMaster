/* =====================================================================
   content-workbench.js — Phase 3: Content Wording Workbench + Drawer
   - Content chuẩn hóa brief (order-level fields) trước Confirm Brief.
   - Persist: localStorage cache (mh-wording-drafts) + Supabase orders.update (best-effort).
   - Out of scope: Client confirm UI (Phase 4), notifications (Phase 5).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth guard ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (user.role === 'client') { location.replace('client-dashboard.html'); return; }
  // system_supervisor = monitor read-only: vào xem được; canEditWording + isAccountAdmin đều false
  // → workspace readonly, không nút Content/Account nào render.
  if (['admin', 'account', 'content', 'lead_content', 'system_supervisor'].indexOf(user.role) < 0) {
    if (window.MH && window.MH.toast) window.MH.toast({ type: 'warning', title: 'Không có quyền', message: 'Content Wording chỉ dành cho Admin / Account / Lead Content / Content.' });
    setTimeout(function () { location.replace('dashboard.html'); }, 900);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);
  const isContent = user.role === 'content';
  const isAdmin = user.role === 'admin';
  const isAccountAdmin = ['admin', 'account'].indexOf(user.role) >= 0;
  const canEditWording = isContent || isAdmin; // Account: read-only workspace (role matrix)
  // Content chỉ được chỉnh/gửi khi wording đang ở pha của Content. Khi đã 'submitted_to_account'
  // (chờ Account duyệt) / 'sent_to_client' / 'client_approved' / 'completed' → khóa, tránh gửi lại.
  // Content Wording = trang LÀM VIỆC của role content trong Content Team flow:
  // content chỉnh được khi wording ở pha Content (kể cả pic_assigned/lead_revision),
  // và nút gửi đi qua LEAD ("Gửi Lead Content duyệt" → submitted_to_lead) — không còn gửi thẳng Account.
  const WS_CONTENT_EDITABLE = ['none', 'assigned', 'pic_assigned', 'in_progress', 'lead_revision', 'account_revision', 'client_feedback'];
  function contentEditable(o) { return canEditWording && WS_CONTENT_EDITABLE.indexOf((o && o.brief_wording_status) || 'none') >= 0; }

  (function () {
    const n = document.getElementById('hpc-name'); if (n) n.textContent = user.name || 'User';
    const a = document.getElementById('hpc-avatar'); if (a) a.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
    const r = document.getElementById('hpc-role-badge'); if (r) { r.textContent = user.role === 'lead_content' ? 'Lead Content' : user.role.charAt(0).toUpperCase() + user.role.slice(1); r.className = 'role-badge r--' + user.role + ' header-pc-role'; }
    const lo = document.getElementById('logout-btn'); if (lo) lo.addEventListener('click', function () { localStorage.removeItem('mh-user'); if (window.MH && window.MH.toast) window.MH.toast({ type: 'info', title: 'Đã đăng xuất' }); setTimeout(function () { location.replace('login.html'); }, 400); });
  })();

  /* ---------- Helpers / constants ---------- */
  function toast(t, ti, m) { if (window.MH && window.MH.toast) window.MH.toast({ type: t, title: ti, message: m }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function fmtDT(s) { if (!s) return '—'; s = String(s); const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z'); if (isNaN(d.getTime())) return s; const p = function (n) { return String(n).padStart(2, '0'); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  // Trễ hạn wording: có wording_deadline, chưa duyệt/hoàn tất, chưa hủy, đã quá hạn.
  function isWordingOverdue(o) {
    if (!o || !o.wording_deadline) return false;
    const ws = o.brief_wording_status || 'none';
    if (ws === 'client_approved' || ws === 'completed') return false;
    if (o.account_status === 'rejected' || o.production_status === 'cancelled') return false;
    const s = String(o.wording_deadline);
    const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z');
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  }

  const WSTATUS = {
    none: 'Chưa chuyển Content Wording', assigned: 'Đã chuyển Content Wording', in_progress: 'Content đang xử lý',
    pic_assigned: 'Lead đã gán PIC Content', submitted_to_lead: 'Chờ Lead Content duyệt', lead_revision: 'Lead yêu cầu Content chỉnh',
    submitted_to_account: 'Chờ Account duyệt', account_revision: 'Account yêu cầu Content chỉnh',
    sent_to_client: 'Chờ Client xác nhận brief wording', client_feedback: 'Client yêu cầu chỉnh brief wording',
    client_approved: 'Client đã xác nhận brief wording', completed: 'Hoàn tất Content Wording'
  };
  // Badge WORDING STATUS: trạng thái DONE (Client đã chốt / hoàn tất) → XANH LÁ (s--completed) + icon check;
  // các trạng thái đang xử lý giữ tím (s--wording). Giúp content nhận diện nhanh order đã chốt brief.
  const WS_DONE = ['client_approved', 'completed'];
  function wsIsDone(ws) { return WS_DONE.indexOf(ws) >= 0; }
  function wsCls(ws) { return wsIsDone(ws) ? 's--completed' : 's--wording'; }
  function wsMark(ws) {
    return wsIsDone(ws)
      ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<span class="dot"></span>';
  }
  const ENGAGED = ['assigned', 'pic_assigned', 'in_progress', 'submitted_to_lead', 'lead_revision', 'submitted_to_account', 'account_revision', 'sent_to_client', 'client_feedback', 'client_approved', 'completed'];
  const STAT_CARDS = [
    { k: 'assigned', label: 'Mới chuyển Content', color: '#191970' },
    { k: 'in_progress', label: 'Đang xử lý', color: '#1D4ED8' },
    { k: 'submitted_to_account', label: 'Chờ Account duyệt', color: '#6B21A8' },
    { k: 'account_revision', label: 'Account yêu cầu chỉnh', color: '#B07600' },
    { k: 'sent_to_client', label: 'Chờ Client xác nhận', color: '#0E7490' },
    { k: 'client_feedback', label: 'Client yêu cầu chỉnh', color: '#BA110F' },
    { k: 'client_approved', label: 'Đã xác nhận', color: '#0A7A52' }
  ];
  const TYPE_LABEL = { design: 'Thiết kế', media: 'Quay / Chụp', video: 'Video', motion: 'Motion', slide: 'Slide', digital: 'Digital', other: 'Khác', photo: 'Chụp', shoot: 'Quay' };
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
  const LIFE = ['Assigned', 'Content Working', 'Lead Review', 'Account Review', 'Client Confirmation', 'Approved'];
  const LIFE_REACHED = { none: 0, assigned: 1, pic_assigned: 1, in_progress: 1, lead_revision: 1, submitted_to_lead: 2, account_revision: 1, submitted_to_account: 3, sent_to_client: 4, client_feedback: 4, client_approved: 6, completed: 6 };

  /* ---------- LocalStorage cache (đảm bảo draft persist khi reload kể cả chưa migrate) ---------- */
  const WCACHE_KEY = 'mh-wording-drafts';
  function loadCache() { try { return JSON.parse(localStorage.getItem(WCACHE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveCache(c) { try { localStorage.setItem(WCACHE_KEY, JSON.stringify(c)); } catch (e) { } }
  function cacheOf(id) { return loadCache()[id] || {}; }
  function setCache(id, patch) { const c = loadCache(); c[id] = Object.assign({}, c[id], patch); saveCache(c); return c[id]; }
  function pushActivity(id, text) { const c = loadCache(); const e = c[id] || (c[id] = {}); e.activity = e.activity || []; e.activity.push({ text: text, by: user.name || user.role, at: new Date().toISOString() }); saveCache(c); }
  function parseChecklist(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }

  /* ---------- State ---------- */
  let ORDERS = [];
  let current = null;
  let deptFilled = false;
  const FILTERS = { search: '', status: '', type: '', priority: '', dept: '' };

  /* ---------- Data load ---------- */
  async function loadOrders() {
    let list = [];
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try { await window.MH.supabaseReady; list = (await window.MH.store.orders.list()) || []; } catch (e) { console.warn('[cwb] load failed:', e); }
    } else {
      try { list = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]'); } catch (e) { list = []; }
    }
    const cache = loadCache();
    // Cache localStorage chỉ để PRESERVE bản nháp content (text/checklist/links/activity).
    // KHI Supabase bật → DB là NGUỒN THẬT cho lifecycle/status: KHÔNG để cache cũ đè
    // (Account/Client tiến order ở DB, không ghi vào cache content → tránh desync stage).
    const DB_AUTH = ['brief_wording_status', 'brief_wording_round', 'brief_wording_pic', 'wording_last_updated_at',
      'wording_submitted_at', 'wording_submitted_by', 'wording_client_sent_at', 'wording_client_sent_by',
      'wording_approved_at', 'wording_client_feedback', 'wording_client_feedback_at',
      'wording_account_note', 'wording_lead_note', 'wording_lead_reviewed_at', 'wording_lead_reviewed_by',
      'wording_submitted_to_lead_at', 'wording_deadline', 'account_status', 'production_status'];
    const sbOn = !!(window.MH && window.MH.supabaseEnabled);
    list = list.map(function (o) {
      const c = cache[o.order_id];
      if (!c) return o;
      const merged = Object.assign({}, o, c);
      // DB thắng cho status/lifecycle — chỉ override khi DB CÓ giá trị
      // (cột chưa migrate trả undefined, không được clobber cache local).
      if (sbOn) DB_AUTH.forEach(function (k) { if (o[k] !== undefined) merged[k] = o[k]; });
      return merged;
    });
    window.__CWB_ALL = list; // giữ full list cho auto-open theo ?id
    ORDERS = list.filter(function (o) { return ENGAGED.indexOf(o.brief_wording_status || 'none') >= 0; });
    if (!deptFilled) { fillDeptOptions(); deptFilled = true; }
    renderStats(); renderTable();
  }

  /* ---------- Render: stats + table ---------- */
  function renderStats() {
    const counts = {};
    ORDERS.forEach(function (o) { const w = o.brief_wording_status || 'none'; counts[w] = (counts[w] || 0) + 1; });
    document.getElementById('cwb-stats').innerHTML = STAT_CARDS.map(function (s) {
      return '<div class="cwb-stat" style="border-top-color:' + s.color + '"><div class="cwb-stat-val" style="color:' + s.color + '">' + (counts[s.k] || 0) + '</div><div class="cwb-stat-label">' + s.label + '</div></div>';
    }).join('');
  }
  function applyFilters() {
    const q = FILTERS.search.toLowerCase();
    return ORDERS.filter(function (o) {
      if (FILTERS.status && (o.brief_wording_status || 'none') !== FILTERS.status) return false;
      if (FILTERS.type && o.request_type !== FILTERS.type) return false;
      if (FILTERS.priority && o.priority !== FILTERS.priority) return false;
      if (FILTERS.dept && o.department !== FILTERS.dept) return false;
      if (q && ((o.order_id || '') + ' ' + (o.project_name || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderTable() {
    const list = applyFilters();
    document.getElementById('cwb-info').innerHTML = 'Hiển thị <strong>' + list.length + '</strong> / ' + ORDERS.length + ' order cần wording';
    const tb = document.getElementById('cwb-tbody');
    tb.innerHTML = list.length ? list.map(function (o) {
      const ws = o.brief_wording_status || 'none';
      return '<tr data-id="' + esc(o.order_id) + '">'
        + '<td><span class="order-id">' + esc(o.order_id) + '</span></td>'
        + '<td><b>' + esc(o.project_name || '—') + '</b></td>'
        + '<td><span class="text-xs">' + esc(o.department || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(TYPE_LABEL[o.request_type] || o.request_type || '—') + '</span></td>'
        + '<td><span class="priority-pill p--' + (o.priority || 'normal') + '"><span class="dot"></span>' + esc(PRIO_LABEL[o.priority] || o.priority || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(o.requested_deadline || '—') + '</span></td>'
        + '<td><span class="text-xs' + (isWordingOverdue(o) ? ' cwb-overdue' : '') + '">' + esc(fmtDT(o.wording_deadline)) + (isWordingOverdue(o) ? ' ⚠' : '') + '</span></td>'
        + '<td><span class="tb-status ' + wsCls(ws) + '" style="display:inline-flex;align-items:center;gap:4px">' + wsMark(ws) + esc(WSTATUS[ws] || ws) + '</span></td>'
        + '<td><span class="text-xs">' + (o.brief_wording_round || 0) + '</span></td>'
        + '<td><span class="text-xs">' + esc(o.brief_wording_pic || '—') + '</span></td>'
        + '<td><button class="btn btn-secondary btn-sm" data-open="' + esc(o.order_id) + '">Mở Wording Drawer</button></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="11" style="text-align:center;padding:44px;color:var(--text-muted)">Chưa có order nào cần Content Wording.</td></tr>';
  }

  /* ---------- Drawer ---------- */
  function buildActions(o) {
    const ws = o.brief_wording_status || 'none';
    const btns = [];
    if (contentEditable(o)) {
      const startLabel = ws === 'client_feedback' ? 'Chỉnh theo Client'
        : (ws === 'lead_revision' ? 'Chỉnh theo Lead'
          : (ws === 'account_revision' ? 'Chỉnh theo Account' : 'Bắt đầu xử lý'));
      if (['assigned', 'pic_assigned', 'lead_revision', 'account_revision', 'client_feedback'].indexOf(ws) >= 0) btns.push('<button class="btn btn-secondary btn-sm" id="w-start">' + startLabel + '</button>');
      btns.push('<button class="btn btn-secondary btn-sm" id="w-save">Lưu nháp</button>');
      btns.push('<button class="btn btn-primary btn-sm" id="w-submit">' + (HAS_LEAD ? 'Gửi Lead Content duyệt' : 'Gửi Account duyệt') + '</button>');
    } else if (isContent && ws === 'submitted_to_lead') {
      btns.push('<span class="wf-wait-tag">Đã gửi Lead Content — chờ duyệt</span>');
    } else if (isContent && ws === 'submitted_to_account') {
      btns.push('<span class="wf-wait-tag">Đã gửi Account — chờ duyệt</span>');
    }
    if (isAccountAdmin) {
      if (['submitted_to_account', 'sent_to_client', 'client_feedback'].indexOf(ws) >= 0) btns.push('<button class="btn btn-warning btn-sm" id="w-return">Trả Content chỉnh</button>');
      if (ws === 'submitted_to_account') btns.push('<button class="btn btn-info btn-sm" id="w-toclient">Gửi Client xác nhận</button>');
    }
    return btns.length ? '<div class="wf-actions"><div class="wf-actions-flow">' + btns.join('') + '</div></div>' : '';
  }

  function buildBody(o) {
    const ws = o.brief_wording_status || 'none';
    const cl = parseChecklist(o.wording_content_checklist);
    const editable = contentEditable(o);
    const ro = editable ? '' : 'readonly';
    // Ghi chú khóa workspace: phân biệt khóa do role (account) vs do pha wording (đã gửi/đã chuyển).
    const lockNote = editable ? '' : '<p class="text-xs muted" style="margin:0 0 8px">'
      + (!canEditWording ? 'Chỉ Content/Admin chỉnh sửa — bạn đang xem chế độ chỉ đọc.'
        : (ws === 'submitted_to_lead' ? 'Đã gửi Lead Content duyệt — đang chờ Lead xử lý, không thể chỉnh.'
          : (ws === 'submitted_to_account' ? 'Lead đã duyệt — đang chờ Account xử lý, không thể chỉnh.'
            : (ws === 'sent_to_client' ? 'Đã gửi Client xác nhận — chế độ chỉ đọc.'
              : ((ws === 'client_approved' || ws === 'completed') ? 'Brief wording đã hoàn tất — chế độ chỉ đọc.' : 'Chế độ chỉ đọc.')))))
      + '</p>';
    const v = function (x) { return x ? esc(x) : '<em class="muted">—</em>'; };
    const arr = function (a) { return (Array.isArray(a) && a.length) ? a.map(function (x) { return '<span class="chip-mini">' + esc(x) + '</span>'; }).join('') : '<em class="muted">—</em>'; };
    const link = function (u) { return u ? '<a class="link" href="' + esc(u) + '" target="_blank" rel="noopener">Mở link</a>' : '<em class="muted">—</em>'; };

    const reached = LIFE_REACHED[ws] != null ? LIFE_REACHED[ws] : 0;
    const lifeLi = LIFE.map(function (s, i) {
      const st = i < reached ? 'done' : (i === reached ? 'active' : 'pending');
      return '<li class="bw-step bw-' + st + '"><span class="bw-dot">' + (st === 'done' ? '✓' : (i + 1)) + '</span><span class="bw-label">' + s + '</span></li>';
    }).join('');
    const revisionNote = (ws === 'lead_revision' && o.wording_lead_note)
      ? '<div class="dw-callout dw--warning" style="margin-top:var(--space-3)"><p><b>Lead yêu cầu chỉnh:</b> ' + esc(o.wording_lead_note) + '</p></div>'
      : ((ws === 'account_revision' && o.wording_account_note) ? '<div class="dw-callout dw--warning" style="margin-top:var(--space-3)"><p><b>Account yêu cầu chỉnh:</b> ' + esc(o.wording_account_note) + '</p></div>' : '');

    const wf = WFIELDS.map(function (f) {
      return '<div class="field"><label class="label">' + f.label + (f.req ? ' <span class="req" style="color:var(--danger)">*</span>' : '') + '</label><textarea class="textarea cwb-field" id="w-' + f.k + '" rows="' + f.rows + '" ' + ro + ' placeholder="...">' + esc(o[f.k] || '') + '</textarea></div>';
    }).join('');
    const clHtml = CHECKLIST.map(function (c) {
      return '<label class="checkbox"><input type="checkbox" class="cwb-check" id="cl-' + c.k + '" ' + (cl[c.k] ? 'checked' : '') + ' ' + (editable ? '' : 'disabled') + ' /><div><span class="checkbox-text">' + c.label + '</span></div></label>';
    }).join('');
    const lk = LINKS.map(function (f) {
      return '<div class="field"><label class="label">' + f.label + '</label><input class="input cwb-field" type="url" id="w-' + f.k + '" ' + ro + ' value="' + esc(o[f.k] || '') + '" placeholder="https://..." /></div>';
    }).join('');

    const acctPanel = isAccountAdmin
      ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">R</span><h4>Account Review</h4></div>'
        + (ws === 'submitted_to_account' ? '<p class="text-xs muted" style="margin:0 0 8px">Lead Content đã duyệt bản wording. Duyệt → "Gửi Client xác nhận", hoặc "Trả Content chỉnh" kèm ghi chú.</p>' : '')
        + '<div class="field"><label class="label">Ghi chú review (bắt buộc khi trả Content chỉnh)</label><textarea class="textarea" id="w-account-note" rows="2" placeholder="Điểm cần Content chỉnh...">' + esc(o.wording_account_note || '') + '</textarea></div></section>'
      : (o.wording_account_note ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">R</span><h4>Account Review</h4></div><div class="bw-note">' + esc(o.wording_account_note) + '</div></section>' : '');

    var clientInner;
    if (ws === 'client_feedback' && o.wording_client_feedback) {
      clientInner = '<div class="dw-callout dw--warning"><p><b>Client yêu cầu chỉnh — Vòng ' + (o.brief_wording_round || 0) + '</b>'
        + (o.wording_client_feedback_at ? ' <span class="dw-meta">· ' + fmtDT(o.wording_client_feedback_at) + '</span>' : '') + '</p>'
        + '<p style="white-space:pre-wrap">' + esc(o.wording_client_feedback) + '</p></div>';
    } else if (ws === 'sent_to_client') {
      clientInner = '<div class="dw-callout dw--brand"><p>Đã gửi Client — chờ Client xác nhận brief wording.</p></div>';
    } else if (ws === 'client_approved' || ws === 'completed') {
      clientInner = '<div class="dw-callout dw--success"><p><b>Client đã xác nhận brief wording.</b>'
        + (o.wording_approved_at ? ' <span class="dw-meta">· ' + fmtDT(o.wording_approved_at) + '</span>' : '') + '</p></div>';
    } else {
      clientInner = '<p class="text-xs muted" style="margin:0">Chưa gửi Client.</p>';
    }
    const clientPanel = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">CL</span><h4>Client xác nhận</h4></div>' + clientInner + '</section>';

    const acts = (cacheOf(o.order_id).activity || []).slice(-8).reverse();
    const actHtml = acts.length ? acts.map(function (a) { return '<li><span>' + esc(a.text) + ' — <b>' + esc(a.by) + '</b></span><time>' + fmtDT(a.at) + '</time></li>'; }).join('') : '<li><span class="muted">Chưa có hoạt động.</span></li>';

    return ''
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">L</span><h4>Wording Lifecycle</h4></div><ol class="bw-steps">' + lifeLi + '</ol>' + revisionNote + '</section>'
      + '<section class="drawer-block cwb-snapshot"><div class="drawer-block-head"><span class="block-letter">B</span><h4>Brief gốc (read-only)</h4></div><dl>'
        + '<dt>Người gửi</dt><dd>' + v(o.requester_name) + ' · ' + v(o.department) + '</dd>'
        + '<dt>Mục đích</dt><dd>' + v(o.project_purpose) + '</dd>'
        + '<dt>Đối tượng</dt><dd>' + arr(o.target_audience) + '</dd>'
        + '<dt>Kênh sử dụng</dt><dd>' + arr(o.usage_channels) + '</dd>'
        + '<dt>Loại yêu cầu</dt><dd>' + v(TYPE_LABEL[o.request_type] || o.request_type) + '</dd>'
        + '<dt>Hạng mục</dt><dd>' + arr(o.deliverable_type) + '</dd>'
        + '<dt>Nội dung gốc</dt><dd style="white-space:pre-wrap">' + v(o.content_brief) + '</dd>'
        + '<dt>Định hướng</dt><dd>' + v(o.creative_direction) + '</dd>'
        + '<dt>Kích thước</dt><dd>' + v(o.size_ratio) + '</dd>'
        + '<dt>File brief</dt><dd>' + link(o.file_brief_url) + '</dd>'
        + '<dt>Source link</dt><dd>' + link(o.source_link) + '</dd>'
        + '<dt>Client deadline</dt><dd>' + v(o.requested_deadline) + '</dd>'
        + '<dt>Hạn wording</dt><dd>' + (o.wording_deadline ? '<span class="' + (isWordingOverdue(o) ? 'cwb-overdue' : '') + '">' + esc(fmtDT(o.wording_deadline)) + '</span>' + (isWordingOverdue(o) ? ' · ⚠ trễ' : '') : '<em class="muted">— (Account chưa đặt)</em>') + '</dd>'
      + '</dl></section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">W</span><h4>Wording Workspace</h4></div>' + lockNote + wf + '</section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">C</span><h4>Checklist trách nhiệm Content</h4></div><div style="display:flex;flex-direction:column;gap:8px">' + clHtml + '</div>' + (editable ? '<p class="text-xs muted" style="margin:10px 0 0">Bắt buộc tích đủ + điền các trường (*) trước khi "Gửi Account duyệt".</p>' : '') + '</section>'
      + acctPanel
      + clientPanel
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">F</span><h4>Files / Links</h4></div>' + lk + '</section>'
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">A</span><h4>Activity</h4></div><ul class="activity-mini">' + actHtml + '</ul></section>';
  }

  function openDrawer(o) {
    current = o;
    document.getElementById('cwb-d-order-id').textContent = o.order_id;
    document.getElementById('cwb-d-project').textContent = o.project_name || '—';
    const ws = o.brief_wording_status || 'none';
    const st = document.getElementById('cwb-d-status'); st.className = 'tb-status ' + wsCls(ws); st.style.display = 'inline-flex'; st.style.alignItems = 'center'; st.style.gap = '4px'; st.innerHTML = wsMark(ws) + (WSTATUS[ws] || ws);
    const pr = document.getElementById('cwb-d-priority'); pr.className = 'priority-pill p--' + (o.priority || 'normal'); pr.innerHTML = '<span class="dot"></span>' + (PRIO_LABEL[o.priority] || o.priority || '—');
    document.getElementById('cwb-d-round').textContent = 'Vòng ' + (o.brief_wording_round || 0);
    document.getElementById('cwb-drawer-actions').innerHTML = buildActions(o);
    document.getElementById('cwb-drawer-body').innerHTML = buildBody(o);
    wireDrawer(o);
    const dr = document.getElementById('wording-drawer'); dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    document.getElementById('cwb-drawer-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    const dr = document.getElementById('wording-drawer'); dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true');
    document.getElementById('cwb-drawer-backdrop').classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* ---------- Form collect / validate / persist ---------- */
  function collectForm() {
    const data = {};
    WFIELDS.forEach(function (f) { const el = document.getElementById('w-' + f.k); if (el) data[f.k] = el.value; });
    LINKS.forEach(function (f) { const el = document.getElementById('w-' + f.k); if (el) data[f.k] = el.value; });
    const cl = {}; CHECKLIST.forEach(function (c) { const el = document.getElementById('cl-' + c.k); cl[c.k] = !!(el && el.checked); });
    data.wording_content_checklist = JSON.stringify(cl);
    return data;
  }
  function isValidForSubmit() {
    const reqOk = WFIELDS.filter(function (f) { return f.req; }).every(function (f) { const el = document.getElementById('w-' + f.k); return el && el.value.trim(); });
    const clOk = CHECKLIST.every(function (c) { const el = document.getElementById('cl-' + c.k); return el && el.checked; });
    return reqOk && clOk;
  }
  function refreshSubmitState() { const b = document.getElementById('w-submit'); if (b) b.disabled = !isValidForSubmit(); }

  async function persist(o, patch, activity) {
    Object.assign(o, patch);
    setCache(o.order_id, patch);
    if (activity) pushActivity(o.order_id, activity);
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      // Ghi qua RPC update_brief_wording (content KHÔNG có UPDATE orders trực tiếp dưới RLS).
      try { await window.MH.store.orders.updateWording(o.order_id, patch); } catch (e) { console.warn('[cwb] persist failed:', e); }
    } else {
      // localStorage-only: cập nhật mh-submitted-orders nếu có
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
    const o = ORDERS.find(function (x) { return x.order_id === id; });
    if (o) openDrawer(o); else closeDrawer();
  }

  async function saveDraft() {
    if (!contentEditable(current)) return;
    const data = collectForm();
    const nowIso = new Date().toISOString();
    const patch = Object.assign({}, data, { wording_last_updated_at: nowIso });
    if (['assigned', 'pic_assigned', 'lead_revision', 'account_revision', 'client_feedback'].indexOf(current.brief_wording_status) >= 0) patch.brief_wording_status = 'in_progress';
    await persist(current, patch, 'Content lưu nháp');
    toast('success', 'Đã lưu nháp', current.order_id + ' — bản wording đã được lưu.');
    reloadAndReopen();
  }
  async function startWork() {
    if (!contentEditable(current)) return;
    if (['assigned', 'pic_assigned', 'lead_revision', 'account_revision', 'client_feedback'].indexOf(current.brief_wording_status) < 0) return;
    const ws = current.brief_wording_status;
    const startMsg = ws === 'client_feedback' ? 'Content chỉnh theo Client'
      : (ws === 'lead_revision' ? 'Content chỉnh theo Lead'
        : (ws === 'account_revision' ? 'Content chỉnh theo Account' : 'Content bắt đầu xử lý'));
    await persist(current, { brief_wording_status: 'in_progress', wording_last_updated_at: new Date().toISOString() }, startMsg);
    toast('info', 'Bắt đầu xử lý', current.order_id);
    reloadAndReopen();
  }
  // Có Lead Content active → content gửi LEAD duyệt (Content Team flow); CHƯA có Lead → fallback gửi thẳng Account.
  // (Lead chỉ tồn tại sau khi chạy add-content-team.sql → nếu HAS_LEAD true thì RPC v2 chắc chắn đã có, cho phép submitted_to_lead.)
  let HAS_LEAD = false;
  async function detectLeads() {
    if (!window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) { HAS_LEAD = false; return; }
    try {
      const { data } = await window.MH.supabase.from('users').select('id').eq('role', 'lead_content').eq('status', 'active').limit(1);
      HAS_LEAD = Array.isArray(data) && data.length > 0;
    } catch (e) { HAS_LEAD = false; }
  }
  async function submitWording() {
    if (!contentEditable(current)) return;
    const target = HAS_LEAD ? 'submitted_to_lead' : 'submitted_to_account';
    if (current.brief_wording_status === target) { toast('info', 'Đã gửi', current.order_id + ' — bản wording đã gửi, đang chờ duyệt.'); return; }
    if (!isValidForSubmit()) { toast('warning', 'Chưa đủ điều kiện', 'Hoàn tất các trường bắt buộc (*) + toàn bộ checklist trước khi gửi.'); return; }
    const data = collectForm();
    const nowIso = new Date().toISOString();
    if (HAS_LEAD) {
      // → LEAD CONTENT duyệt. Lead duyệt xong mới tới Account (content-team.html).
      await persist(current, Object.assign({}, data, {
        brief_wording_status: 'submitted_to_lead',
        wording_submitted_to_lead_at: nowIso,
        wording_last_updated_at: nowIso
      }), 'Content gửi Lead Content duyệt');
      notifyRolesWb(current, ['lead_content'], 'task_status_changed', '📨 Bản wording chờ Lead duyệt',
        current.order_id + ' · ' + (current.project_name || 'Untitled') + ' — ' + (user.name || 'Content') + ' đã gửi bản wording.',
        'content-team.html?id=' + (current.order_id || ''));
      toast('success', 'Đã gửi Lead Content duyệt', current.order_id + ' — chờ Lead review.');
    } else {
      // → THẲNG ACCOUNT (chưa có Lead). Link sang Client Orders drawer nơi Account kiểm tra & gửi Client.
      await persist(current, Object.assign({}, data, {
        brief_wording_status: 'submitted_to_account',
        wording_submitted_at: nowIso,
        wording_submitted_by: (user && (user.name || user.role)) || 'Content',
        wording_last_updated_at: nowIso
      }), 'Content gửi Account duyệt');
      notifyRolesWb(current, ['admin', 'account'], 'task_status_changed', '📨 Bản wording chờ Account duyệt',
        current.order_id + ' · ' + (current.project_name || 'Untitled') + ' — ' + (user.name || 'Content') + ' đã gửi bản wording.',
        'database-orders.html?id=' + (current.order_id || ''));
      toast('success', 'Đã gửi Account duyệt', current.order_id + ' — chờ Account kiểm tra & gửi Client.');
    }
    reloadAndReopen();
  }
  // Notify mọi lead_content active (fire-and-forget, pattern notifyContentWording).
  async function notifyLeads(o, title, message) {
    if (!o || !window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    try {
      const { data: leads } = await window.MH.supabase
        .from('users').select('id').eq('role', 'lead_content').eq('status', 'active');
      if (Array.isArray(leads) && leads.length) {
        await window.MH.supabase.from('notifications').insert(leads.map(function (u) {
          return {
            user_id: u.id, type: 'task_status_changed', title: title, message: message,
            link: 'content-team.html?id=' + (o.order_id || ''),
            related_entity_type: 'orders', related_entity_id: o.order_id
          };
        }));
      }
    } catch (e) { console.warn('[cwb] notify leads failed:', e); }
  }
  // Notify nhiều role active (fire-and-forget). type base-CHECK-safe để chạy không phụ thuộc migration.
  async function notifyRolesWb(o, roles, type, title, message, link) {
    if (!o || !window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    try {
      const { data: us } = await window.MH.supabase
        .from('users').select('id').in('role', roles).eq('status', 'active');
      if (Array.isArray(us) && us.length) {
        await window.MH.supabase.from('notifications').insert(us.map(function (u) {
          return {
            user_id: u.id, type: type, title: title, message: message,
            link: link || ('content-workbench.html?id=' + (o.order_id || '')),
            related_entity_type: 'orders', related_entity_id: o.order_id
          };
        }));
      }
    } catch (e) { console.warn('[cwb] notifyRoles failed:', e); }
  }
  // Notify PIC Content theo tên (brief_wording_pic) → lookup uuid qua store helper.
  async function notifyPicWb(o, name, title, message) {
    if (!o || !name || !window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
    try {
      const uid = await window.MH.store.notifications.findUserIdByName(name);
      if (uid) await window.MH.store.notifications.create({
        user_id: uid, type: 'task_status_changed', title: title, message: message,
        link: 'content-workbench.html?id=' + (o.order_id || ''),
        related_entity_type: 'orders', related_entity_id: o.order_id
      });
    } catch (e) { console.warn('[cwb] notifyPic failed:', e); }
  }
  // Notify Client của order (requester_id → fallback email). type order_status_changed (base-safe).
  async function notifyClientWb(o, title, message) {
    if (!o || !window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    try {
      let uid = o.requester_id || null;
      if (!uid && o.requester_email) {
        const { data: u } = await window.MH.supabase.from('users').select('id').eq('email', o.requester_email).maybeSingle();
        uid = u && u.id;
      }
      if (!uid) { console.warn('[cwb] notifyClient: no user_id for', o.requester_email); return; }
      await window.MH.supabase.from('notifications').insert({
        user_id: uid, type: 'order_status_changed', title: title, message: message,
        link: 'client-dashboard.html?order=' + (o.order_id || ''),
        related_entity_type: 'orders', related_entity_id: o.order_id
      });
    } catch (e) { console.warn('[cwb] notifyClient failed:', e); }
  }
  async function accountReturnRevision() {
    if (!isAccountAdmin) return;
    const el = document.getElementById('w-account-note');
    const note = (el && el.value || '').trim();
    if (!note) { toast('warning', 'Cần ghi chú', 'Nhập điểm cần Content chỉnh trước khi trả.'); if (el) el.focus(); return; }
    await persist(current, {
      brief_wording_status: 'account_revision',
      wording_account_note: note,
      wording_last_updated_at: new Date().toISOString()
    }, 'Account trả Content chỉnh: ' + note);
    notifyPicWb(current, current.brief_wording_pic, '✍️ Account yêu cầu chỉnh wording',
      current.order_id + ' · ' + (current.project_name || '') + ' — ' + note);
    toast('info', 'Đã trả Content chỉnh', current.order_id);
    reloadAndReopen();
  }
  async function accountSendToClient() {
    if (!isAccountAdmin) return;
    if (current.brief_wording_status !== 'submitted_to_account') { toast('warning', 'Chưa thể gửi', 'Chỉ gửi Client khi Content đã submit.'); return; }
    const nowIso = new Date().toISOString();
    const by = (user && (user.name || user.role)) || 'Account';
    await persist(current, { brief_wording_status: 'sent_to_client', wording_client_sent_at: nowIso, wording_client_sent_by: by, wording_last_updated_at: nowIso }, 'Account gửi Client xác nhận');
    notifyClientWb(current, '📝 Brief cần bạn xác nhận',
      current.order_id + ' · ' + (current.project_name || '') + ' — Account đã gửi brief đã chuẩn hóa, vui lòng xác nhận trong Portal.');
    toast('success', 'Đã gửi Client xác nhận', current.order_id + ' — chờ Client xác nhận brief wording trong Client Portal.');
    reloadAndReopen();
  }

  function wireDrawer() {
    const w = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    w('w-save', saveDraft); w('w-start', startWork); w('w-submit', submitWording);
    w('w-return', accountReturnRevision); w('w-toclient', accountSendToClient);
    document.querySelectorAll('#cwb-drawer-body .cwb-field').forEach(function (el) { el.addEventListener('input', refreshSubmitState); });
    document.querySelectorAll('#cwb-drawer-body .cwb-check').forEach(function (el) { el.addEventListener('change', refreshSubmitState); });
    refreshSubmitState();
  }

  /* ---------- Filters init ---------- */
  function fillFilterOptions() {
    const fs = document.getElementById('cwb-filter-status');
    ENGAGED.forEach(function (k) { const op = document.createElement('option'); op.value = k; op.textContent = WSTATUS[k]; fs.appendChild(op); });
    const ft = document.getElementById('cwb-filter-type');
    ['design', 'media', 'video', 'motion', 'slide', 'digital', 'other'].forEach(function (k) { const op = document.createElement('option'); op.value = k; op.textContent = TYPE_LABEL[k] || k; ft.appendChild(op); });
    const fp = document.getElementById('cwb-filter-priority');
    ['normal', 'urgent', 'critical'].forEach(function (k) { const op = document.createElement('option'); op.value = k; op.textContent = PRIO_LABEL[k]; fp.appendChild(op); });
  }
  function fillDeptOptions() {
    const fd = document.getElementById('cwb-filter-dept'); const seen = {};
    ORDERS.forEach(function (o) { if (o.department && !seen[o.department]) { seen[o.department] = 1; const op = document.createElement('option'); op.value = o.department; op.textContent = o.department; fd.appendChild(op); } });
  }

  /* ---------- Init ---------- */
  detectLeads(); // xác định có Lead Content active → định tuyến submit content→Lead vs content→Account
  fillFilterOptions();
  document.getElementById('cwb-search').addEventListener('input', function (e) { FILTERS.search = e.target.value; renderTable(); });
  ['status', 'type', 'priority', 'dept'].forEach(function (k) {
    document.getElementById('cwb-filter-' + k).addEventListener('change', function (e) { FILTERS[k] = e.target.value; renderTable(); });
  });
  document.getElementById('cwb-drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('cwb-drawer-backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('wording-drawer').classList.contains('is-open')) closeDrawer(); });
  document.getElementById('cwb-tbody').addEventListener('click', function (e) {
    const b = e.target.closest('[data-open]'); if (!b) return;
    const o = ORDERS.find(function (x) { return x.order_id === b.getAttribute('data-open'); }); if (o) openDrawer(o);
  });

  loadOrders().then(function () {
    const id = new URLSearchParams(location.search).get('id');
    if (id) {
      const all = window.__CWB_ALL || [];
      const o = ORDERS.find(function (x) { return x.order_id === id; }) || all.find(function (x) { return x.order_id === id; });
      if (o) openDrawer(o);
    }
  });
})();
