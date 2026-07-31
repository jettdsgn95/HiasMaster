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
  // Order wording thuộc content HIỆN TẠI? (khóa theo brief_wording_pic_user_id, fallback tên).
  // Dùng để lọc list + gate edit — cùng nguồn sự thật với RLS "orders content read assigned wording".
  function owIsMine(o) {
    if (!o) return false;
    if (o.brief_wording_pic_user_id) return !!user.id && o.brief_wording_pic_user_id === user.id;
    return isMine(o.brief_wording_pic);
  }
  function contentEditable(o) {
    return canEditWording
      && WS_CONTENT_EDITABLE.indexOf((o && o.brief_wording_status) || 'none') >= 0
      && (!isContent || owIsMine(o)); // content chỉ sửa order wording của mình
  }

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
  // Quality Checklist wording — đạt tối thiểu CHECKLIST_MIN/tổng mới gửi duyệt được.
  const CHECKLIST = [
    { k: 'goal', label: 'Xác nhận đúng Nội dung khuyến mãi/yêu cầu/mục tiêu' },
    { k: 'message', label: 'Đã chuẩn hóa thông điệp chính' },
    { k: 'cta', label: 'Đã đề xuất CTA phù hợp' },
    { k: 'prodnote', label: 'Đã chuẩn hóa brief thiết kế, ghi chú rõ cho Media Production' }
  ];
  const CHECKLIST_MIN = 3;
  // Wording Workspace rút gọn: chỉ 2 trường (Brief đã wording + Ghi chú cho Production).
  const WFIELDS = [
    { k: 'wording_brief', label: 'Brief đã wording', req: true, rows: 6 },
    { k: 'wording_production_note', label: 'Ghi chú cho Production team', rows: 3 }
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
      // DB thắng cho status/lifecycle — chỉ override khi DB CÓ giá trị
      // (cột chưa migrate trả undefined, không được clobber cache local).
      if (sbOn) DB_AUTH.forEach(function (k) { if (o[k] !== undefined) merged[k] = o[k]; });
      return merged;
    });
    window.__CWB_ALL = list; // giữ full list cho auto-open theo ?id
    // content CHỈ thấy order wording của mình (RLS đã siết, đây là lớp UI thứ 2 phòng thủ +
    // loại order nội bộ/media khỏi list wording). admin/account/lead giữ nguyên (thấy hết).
    ORDERS = list.filter(function (o) {
      return ENGAGED.indexOf(o.brief_wording_status || 'none') >= 0 && (!isContent || owIsMine(o));
    });
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
      const wDone = ['client_approved', 'completed'].indexOf(ws) >= 0;
      return '<tr data-id="' + esc(o.order_id) + '">'
        + '<td><span class="order-id">' + esc(o.order_id) + '</span><div style="margin-top:3px">' + sourceChip('client_order') + '</div></td>'
        + '<td><b>' + esc(o.project_name || '—') + '</b></td>'
        + '<td><span class="text-xs">' + esc(o.department || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(TYPE_LABEL[o.request_type] || o.request_type || '—') + '</span></td>'
        + '<td><span class="priority-pill p--' + (o.priority || 'normal') + '"><span class="dot"></span>' + esc(PRIO_LABEL[o.priority] || o.priority || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(o.requested_deadline || '—') + '</span></td>'
        + '<td>' + (o.wording_deadline ? slaChip(o.wording_deadline, wDone) : '<span class="text-xs muted">—</span>') + '</td>'
        + '<td><span class="tb-status ' + wsCls(ws) + '" style="display:inline-flex;align-items:center;gap:4px">' + wsMark(ws) + esc(WSTATUS[ws] || ws) + '</span> ' + nextActionChip(ws, 'order', o) + '</td>'
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
      + '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">C</span><h4>Quality Checklist</h4></div><div style="display:flex;flex-direction:column;gap:8px">' + clHtml + '</div>' + (editable ? '<p class="text-xs muted" style="margin:10px 0 0">Đạt tối thiểu ' + CHECKLIST_MIN + '/' + CHECKLIST.length + ' checklist + điền các trường (*) trước khi "Gửi Account duyệt".</p>' : '') + '</section>'
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
    const clDone = CHECKLIST.filter(function (c) { const el = document.getElementById('cl-' + c.k); return el && el.checked; }).length;
    const clOk = clDone >= Math.min(CHECKLIST_MIN, CHECKLIST.length);
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
    if (!isValidForSubmit()) { toast('warning', 'Chưa đủ điều kiện', 'Hoàn tất các trường bắt buộc (*) + đạt tối thiểu ' + CHECKLIST_MIN + '/' + CHECKLIST.length + ' Quality Checklist trước khi gửi.'); return; }
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
  // Cùng lý do: RPC thay cho lookup users trực tiếp (2026-07-31). Trả số noti / -1 nếu lỗi.
  async function notifyRolesWb(o, roles, type, title, message, link) {
    if (!o || !window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return 0;
    try {
      const { data, error } = await window.MH.supabase.rpc('notify_roles', {
        p_roles: roles, p_type: type, p_title: title, p_message: message || null,
        p_link: link || ('content-workbench.html?id=' + (o.order_id || '')),
        p_entity_type: 'orders', p_entity_id: o.order_id || null
      });
      if (error) { console.warn('[cwb] notify_roles error (chạy add-notify-roles-rpc.sql?):', error); return -1; }
      return typeof data === 'number' ? data : 0;
    } catch (e) { console.warn('[cwb] notifyRolesWb failed:', e); return -1; }
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

  /* ===================================================================
     PHASE 3 — CONTENT TASKS (PIC Workbench, model content_tasks)
     View riêng "Content Tasks của tôi" — TÁCH BIỆT bảng order-wording trên.
     PIC: đọc brief → viết multi-output → ghi Missing Info → tick checklist
        → Gửi Lead Content duyệt. KHÔNG bypass Lead (không gửi Account/Client/Media).
     =================================================================== */
  const ENUMS = (window.MH && window.MH.store && window.MH.store.contentEnums) || { OUTPUT_TYPES: ['social_post', 'album_caption', 'ads_copy', 'video_script', 'voice_over', 'kv_headline', 'landing_copy', 'email_zalo_sms', 'internal_announcement', 'campaign_big_idea', 'content_package', 'other'] };
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
  const SOURCE_LABEL = { client_order: 'Client Order', content_initiated: 'Task nội bộ', strategy_board: 'Strategy Board', campaign_package: 'Kế hoạch đã ký', ads_order: 'Ads Order', media_order: 'Script Media' };

  /* ---------- Stage C — chip helpers (bản copy của content-team.js) ----------
     CỐ Ý copy chứ không import: 2 file này vốn giữ bản riêng của SOURCE_LABEL /
     CT_STATUS (zero-build, không có module system). Sửa nhãn thì sửa CẢ 2 file.
     CSS (.src-chip / .sla-chip / .na-chip) đã global trong styles.css. */
  function sourceChip(source) {
    const label = SOURCE_LABEL[source] || source || '—';
    const cls = ({ client_order: 'src-client', ads_order: 'src-ads', content_initiated: 'src-self', campaign_package: 'src-plan', strategy_board: 'src-plan', media_order: 'src-media' })[source] || 'src-other';
    return '<span class="src-chip ' + cls + '">' + esc(label) + '</span>';
  }
  // Deadline → chip màu SLA (đỏ trễ / cam <24h / vàng <48h / xanh trong hạn).
  function slaChip(deadline, done) {
    if (done) return '';
    if (!deadline) return '<span class="sla-chip sla-none">Chưa đặt hạn</span>';
    const s = String(deadline);
    const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return '';
    const diffH = (d.getTime() - Date.now()) / 3600000;
    let cls, txt;
    if (diffH < 0) { cls = 'sla-red'; txt = '⚠ Trễ · ' + fmtDT(deadline); }
    else if (diffH < 24) { cls = 'sla-orange'; txt = '<24h · ' + fmtDT(deadline); }
    else if (diffH < 48) { cls = 'sla-yellow'; txt = '<48h · ' + fmtDT(deadline); }
    else { cls = 'sla-green'; txt = fmtDT(deadline); }
    return '<span class="sla-chip ' + cls + '">' + esc(txt) + '</span>';
  }
  // "Bước tiếp theo" theo góc nhìn PIC Content (khác content-team: ở đây người đọc
  // là chính PIC nên câu chữ là việc CỦA BẠN, không phải việc của Lead).
  const NEXT_PIC_ORDER = {
    assigned: 'Chờ Lead gán PIC', pic_assigned: 'Bạn bắt đầu viết', in_progress: 'Bạn đang viết',
    submitted_to_lead: 'Chờ Lead duyệt', lead_revision: 'Bạn chỉnh theo Lead',
    submitted_to_account: 'Chờ Account', account_revision: 'Bạn chỉnh theo Account',
    sent_to_client: 'Chờ Client', client_feedback: 'Bạn chỉnh theo Client',
    client_approved: 'Hoàn tất', completed: 'Hoàn tất'
  };
  function nextActionChip(status, kind, item) {
    let txt;
    if (kind === 'task') {
      if (status === 'submitted_to_lead') txt = 'Chờ Lead duyệt';
      else if (status === 'lead_revision') txt = 'Bạn chỉnh theo Lead';
      else if (status === 'lead_approved' && item && item.need_media_production && !item.media_request_created) txt = 'Gửi sang Media';
      else if (['pic_assigned', 'new', 'assigned'].indexOf(status) >= 0) txt = 'Bạn bắt đầu viết';
      else if (status === 'in_progress') txt = 'Bạn đang viết';
      else if (CT_DONE.indexOf(status) >= 0) txt = 'Hoàn tất';
      else txt = CT_STATUS[status] || status;
    } else {
      txt = NEXT_PIC_ORDER[status] || WSTATUS[status] || status;
    }
    return '<span class="na-chip">→ ' + esc(txt) + '</span>';
  }
  const PRIO_VI = { low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Gấp', critical: 'Rất gấp' };
  // Mỗi output_type → các field workspace (map vào cột content_tasks).
  const OUTPUT_FIELDS = {
    social_post: ['draft_body', 'cta', 'mandatory_info'],
    album_caption: ['caption', 'cta'],
    ads_copy: ['ads_primary_text', 'ads_headline', 'cta'],
    video_script: ['script', 'voice_over', 'cta', 'visual_direction'],
    voice_over: ['voice_over'],
    kv_headline: ['headline', 'subheadline', 'cta', 'mandatory_info', 'visual_direction'],
    landing_copy: ['landing_copy', 'headline', 'subheadline', 'cta'],
    email_zalo_sms: ['email_sms_zalo_copy', 'cta'],
    internal_announcement: ['draft_body'],
    campaign_big_idea: ['draft_body', 'visual_direction'],
    content_package: ['draft_body', 'cta', 'mandatory_info'],
    other: ['draft_body']
  };
  const FIELD_META = {
    draft_body: { label: 'Nội dung chính / Body', rows: 4 },
    caption: { label: 'Caption', rows: 3 },
    headline: { label: 'Headline', rows: 1 },
    subheadline: { label: 'Subheadline', rows: 1 },
    script: { label: 'Kịch bản / Scene breakdown', rows: 5 },
    voice_over: { label: 'Voice-over', rows: 3 },
    ads_primary_text: { label: 'Ads — Primary text', rows: 3 },
    ads_headline: { label: 'Ads — Headline', rows: 1 },
    landing_copy: { label: 'Landing copy', rows: 5 },
    email_sms_zalo_copy: { label: 'Email / Zalo / SMS copy', rows: 3 },
    cta: { label: 'CTA', rows: 1 },
    mandatory_info: { label: 'Thông tin bắt buộc', rows: 2 },
    visual_direction: { label: 'Định hướng hình ảnh', rows: 2 }
  };
  // Quality Checklist content_task — đạt tối thiểu CT_CHECKLIST_MIN/tổng mới gửi Lead duyệt.
  const CT_CHECKLIST = [
    { k: 'goal', label: 'Xác nhận đúng Nội dung khuyến mãi/yêu cầu/mục tiêu' },
    { k: 'message', label: 'Đúng thông điệp chính' },
    { k: 'cta', label: 'Đã có CTA phù hợp' },
    { k: 'prodnote', label: 'Đã chuẩn hóa brief thiết kế, ghi chú rõ cho Media Production' }
  ];
  const CT_CHECKLIST_MIN = 3;
  const HANDOFF_FIELDS = [
    { k: 'final_headline', label: 'Final headline', rows: 1 },
    { k: 'final_body_or_script', label: 'Final body / script', rows: 4 },
    { k: 'handoff_mandatory_info', label: 'Thông tin bắt buộc', rows: 2 },
    { k: 'handoff_visual_direction', label: 'Định hướng hình ảnh', rows: 2 },
    { k: 'format_size', label: 'Format / Size', rows: 1 },
    { k: 'channel', label: 'Kênh đăng', rows: 1 }
  ];
  const CT_EDITABLE_STATUS = ['new', 'assigned', 'pic_assigned', 'in_progress', 'lead_revision', 'account_revision', 'client_feedback'];
  const CT_SUBMITTABLE = ['pic_assigned', 'in_progress', 'lead_revision'];
  const CT_DONE = ['lead_approved', 'submitted_to_account', 'sent_to_client', 'client_approved', 'completed', 'media_order_created'];

  /* ---------- Phase 5 — PIC Content gửi Internal Media Order + theo dõi (port từ content-team.js) ---------- */
  const PROD_STATUS = {
    unassigned: 'Chưa phân công', pending: 'Chờ nhận', received: 'Đã nhận', inprogress: 'Đang sản xuất',
    review: 'Chờ duyệt nội bộ', revision: 'Đang chỉnh', feedback_wait: 'Chờ phản hồi', feedback_fix: 'Sửa theo feedback',
    ready: 'Sẵn sàng bàn giao', delivered: 'Đã bàn giao', completed: 'Hoàn tất', paused: 'Tạm dừng', cancelled: 'Đã hủy'
  };
  // priority task (low/normal/high/urgent) → priority order CHECK (normal/urgent/critical).
  const ORDER_PRIO = { low: 'normal', normal: 'normal', high: 'urgent', urgent: 'critical', critical: 'critical' };
  const MEDIA_REQ_FIELDS = [
    { k: 'final_headline', label: 'Final headline', src: ['final_headline', 'headline', 'draft_title', 'title'] },
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
  // Media request phục vụ Ads Order dùng prefix riêng (badge "Internal · From Ads").
  function genAdsMediaId() {
    const d = new Date(); return 'ADS-MEDIA-' + d.getFullYear() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  // Task nguồn Ads Order (source='ads_order', order_id=ADS-xxx)?
  function isAdsTask(t) { return !!(t && t.source === 'ads_order' && t.order_id); }
  // Auto-sync ads_status trên Ads Order theo tiến độ Content Task (PIC side).
  // allowedFrom: chỉ sync khi ads_status hiện tại thuộc list (không clobber trạng thái launch về sau).
  async function syncAdsOrderFromTask(t, patch, allowedFrom) {
    if (!isAdsTask(t) || !window.MH || !window.MH.store) return;
    try {
      const o = await window.MH.store.orders.get(t.order_id);
      if (!o || o.order_kind !== 'ads_order') return;
      const cur = o.ads_status || 'submitted';
      if (allowedFrom && allowedFrom.indexOf(cur) < 0) return;
      await window.MH.store.orders.update(t.order_id, patch);
    } catch (e) { console.warn('[cwb] sync ads order failed (đã chạy add-ads-orders.sql + RLS content update ads chưa?):', e); }
  }
  function toLocalInput(s) { if (!s) return ''; const d = new Date(/[Z+]/.test(String(s).slice(10)) ? s : String(s).replace(' ', 'T') + 'Z'); if (isNaN(d.getTime())) return ''; const p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function mrField(id, label, val, opts) {
    opts = opts || {};
    const req = opts.req ? ' <span style="color:var(--red-600)">*</span>' : '';
    const inner = opts.area
      ? '<textarea class="textarea" id="' + id + '" rows="' + (opts.rows || 2) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(val || '') + '</textarea>'
      : '<input class="input" id="' + id + '" type="' + (opts.type || 'text') + '" value="' + esc(val || '') + '" placeholder="' + esc(opts.ph || '') + '" />';
    return '<div class="field"><label class="label">' + esc(label) + req + '</label>' + inner + '</div>';
  }
  function passedLeadApproval(t) { return ['lead_approved', 'media_order_created', 'completed'].indexOf(t.status) >= 0; }
  function orderFinalDelivered(o) { return !!(o && (o.final_delivery_link || o.production_status === 'delivered' || o.production_status === 'completed')); }
  function canSendMediaTask(t) { return ((isContent && isMineTask(t)) || isAdmin) && t.status === 'lead_approved' && t.need_media_production && !t.media_request_created; }

  // Ownership content_task nay theo user_id (rename-proof); task chưa backfill id → fallback tên mờ.
  function isMineTask(t) {
    if (!t) return false;
    if (t.assigned_pic_user_id) return !!user.id && t.assigned_pic_user_id === user.id;
    return isMine(t.assigned_pic);
  }
  function isMine(name) {
    if (!name || !user.name) return false;
    const a = String(name).trim().toLowerCase(), b = String(user.name).trim().toLowerCase();
    if (a === b) return true;
    return new RegExp('(^|\\s)' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(b)
      || new RegExp('(^|\\s)' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(a);
  }
  function parseDt(s) { if (!s) return null; s = String(s); const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z'); return isNaN(d.getTime()) ? null : d; }
  function ctOverdue(t) { if (!t || !t.wording_deadline) return false; if (CT_DONE.indexOf(t.status) >= 0 || t.status === 'archived') return false; const d = parseDt(t.wording_deadline); return !!d && d.getTime() < Date.now(); }
  function arrayOf(a) { return Array.isArray(a) ? a : (a ? [a] : []); }
  function parseJson(s, fb) { if (s && typeof s === 'object') return s; try { return JSON.parse(s || '') || fb; } catch (e) { return fb; } }
  function outputChips(types) { types = arrayOf(types); return types.length ? types.map(function (k) { return '<span class="chip-mini">' + esc(OUTPUT_LABEL[k] || k) + '</span>'; }).join('') : '<em class="muted">—</em>'; }
  function canEditTask(t) {
    if (!t || CT_EDITABLE_STATUS.indexOf(t.status) < 0) return false;
    if (isAdmin) return true;
    if (isContent) return isMineTask(t);
    return false; // account / lead_content / supervisor: read-only ở Wording
  }
  // Mã task nội bộ Content (CT-YYYY-NNN) — trigger DB sinh (add-content-task-code.sql).
  // Chưa migrate → mã tạm từ id để vẫn nhắc được nhau khi trao đổi.
  function cwbCode(t) {
    if (!t) return '—';
    if (t.task_code) return t.task_code;
    return 'CT-' + String(t.id || '').slice(-4).toUpperCase();
  }
  function workspaceFields(t) {
    const types = (Array.isArray(t.output_types) && t.output_types.length) ? t.output_types : ['other'];
    const out = []; const seen = {};
    types.forEach(function (ty) { (OUTPUT_FIELDS[ty] || OUTPUT_FIELDS.other).forEach(function (f) { if (!seen[f]) { seen[f] = 1; out.push(f); } }); });
    return out;
  }

  /* ---------- State (tasks) ---------- */
  let TASKS = [];
  let CONTENT_PLANS = [];
  let currentTask = null;
  let cwbView = isContent ? 'tasks' : 'orders';
  let taskSub = 'all';
  const TFILTERS = { search: '', output: '' };

  /* ---------- Data load (tasks) ---------- */
  async function loadTasks() {
    try {
      if (window.MH && window.MH.supabaseEnabled) await window.MH.supabaseReady;
      if (window.MH && window.MH.store && window.MH.store.contentTasks) {
        const all = (await window.MH.store.contentTasks.list()) || [];
        // PIC content chỉ thấy task được gán cho mình; admin/lead/account/supervisor xem tất cả (follow).
        TASKS = isContent ? all.filter(function (t) { return isMineTask(t); }) : all;
        CONTENT_PLANS = (await window.MH.store.contentPlans.list()) || [];
      }
    } catch (e) { console.warn('[cwb] load tasks failed:', e); }
    renderCwbTabs(); renderTaskStats(); renderTasks();
    if (currentTask) { const t = TASKS.find(function (x) { return x.id === currentTask.id; }); if (t) currentTask = t; }
  }
  function planOf(t) { return t.content_plan_id ? CONTENT_PLANS.find(function (p) { return p.id === t.content_plan_id; }) : null; }

  /* ---------- View tabs ---------- */
  function renderCwbTabs() {
    document.querySelectorAll('#cwb-tabs [data-cwb-view]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-cwb-view') === cwbView); });
    const vo = document.getElementById('cwb-view-orders'); if (vo) vo.hidden = cwbView !== 'orders';
    const vt = document.getElementById('cwb-view-tasks'); if (vt) vt.hidden = cwbView !== 'tasks';
    const co = document.getElementById('cwb-count-orders'); if (co) co.textContent = ORDERS.length;
    const ct = document.getElementById('cwb-count-tasks'); if (ct) ct.textContent = TASKS.length;
  }
  function subMatch(t, sub) {
    const s = t.status;
    if (sub === 'writing') return ['pic_assigned', 'in_progress'].indexOf(s) >= 0;
    if (sub === 'revision') return ['lead_revision', 'account_revision', 'client_feedback'].indexOf(s) >= 0;
    if (sub === 'submitted') return s === 'submitted_to_lead';
    if (sub === 'approved') return CT_DONE.indexOf(s) >= 0;
    return true; // all
  }
  function renderTaskStats() {
    const cards = [
      { k: 'all', label: 'Tổng task', color: '#191970' },
      { k: 'writing', label: 'Đang viết', color: '#1D4ED8' },
      { k: 'revision', label: 'Cần chỉnh', color: '#B07600' },
      { k: 'submitted', label: 'Đã gửi Lead', color: '#6B21A8' },
      { k: 'approved', label: 'Đã duyệt', color: '#0A7A52' },
      { k: 'overdue', label: 'Trễ hạn', color: '#BA110F' }
    ];
    const el = document.getElementById('cwbt-stats'); if (!el) return;
    el.innerHTML = cards.map(function (c) {
      const val = c.k === 'overdue' ? TASKS.filter(ctOverdue).length : (c.k === 'all' ? TASKS.length : TASKS.filter(function (t) { return subMatch(t, c.k); }).length);
      return '<div class="cwb-stat" style="border-top-color:' + c.color + '"><div class="cwb-stat-val" style="color:' + c.color + '">' + val + '</div><div class="cwb-stat-label">' + c.label + '</div></div>';
    }).join('');
    ['all', 'writing', 'revision', 'submitted', 'approved'].forEach(function (k) {
      const c = document.getElementById('cwbt-c-' + k); if (c) c.textContent = k === 'all' ? TASKS.length : TASKS.filter(function (t) { return subMatch(t, k); }).length;
    });
  }
  function renderTasks() {
    const tb = document.getElementById('cwbt-tbody'); if (!tb) return;
    document.querySelectorAll('#cwbt-subtabs [data-cwbt-sub]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-cwbt-sub') === taskSub); });
    const q = TFILTERS.search.toLowerCase();
    let list = TASKS.filter(function (t) { return subMatch(t, taskSub); });
    if (TFILTERS.output) list = list.filter(function (t) { return arrayOf(t.output_types).indexOf(TFILTERS.output) >= 0; });
    // Tìm được cả theo MÃ task (CT-2026-001) — mục đích chính của việc thêm mã.
    if (q) list = list.filter(function (t) { const p = planOf(t); return ((t.title || '') + ' ' + cwbCode(t) + ' ' + (p ? p.title + ' ' + (p.campaign_name || '') : '')).toLowerCase().indexOf(q) >= 0; });
    document.getElementById('cwbt-info').innerHTML = 'Hiển thị <strong>' + list.length + '</strong> / ' + TASKS.length + ' content task';
    // rebuild output filter options
    const fo = document.getElementById('cwbt-filter-output'); const cur = fo.value; const seen = {};
    fo.innerHTML = '<option value="">Mọi loại output</option>';
    TASKS.forEach(function (t) { arrayOf(t.output_types).forEach(function (o) { if (!seen[o]) { seen[o] = 1; const op = document.createElement('option'); op.value = o; op.textContent = OUTPUT_LABEL[o] || o; fo.appendChild(op); } }); });
    fo.value = cur;
    tb.innerHTML = list.length ? list.map(function (t) {
      const p = planOf(t); const overdue = ctOverdue(t);
      return '<tr data-ctask="' + esc(t.id) + '">'
        + '<td><span class="order-id">' + esc(cwbCode(t)) + '</span></td>'
        + '<td><b>' + esc(t.title || '—') + '</b></td>'
        + '<td>' + sourceChip(t.source) + (p ? '<div class="text-xs muted" style="margin-top:3px">' + esc(p.title) + '</div>' : '') + '</td>'
        + '<td>' + outputChips(t.output_types) + '</td>'
        + '<td>' + (t.wording_deadline ? slaChip(t.wording_deadline, CT_DONE.indexOf(t.status) >= 0) : '<span class="text-xs muted">—</span>') + '</td>'
        + '<td><span class="priority-pill p--' + (t.priority || 'normal') + '"><span class="dot"></span>' + esc(PRIO_VI[t.priority] || t.priority || '—') + '</span></td>'
        + '<td><span class="text-xs">' + (t.internal_revision_count || 0) + '</span></td>'
        + '<td><span class="text-xs">' + (t.need_media_production ? '<span class="chip-mini">Cần</span>' : '—') + '</span></td>'
        + '<td><span class="tb-status s--wording"><span class="dot"></span>' + esc(CT_STATUS[t.status] || t.status) + '</span> ' + nextActionChip(t.status, 'task', t) + '</td>'
        + '<td><button class="btn btn-secondary btn-sm" data-ctask-open="' + esc(t.id) + '">Mở</button></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="10" style="text-align:center;padding:44px;color:var(--text-muted)">' + (isContent ? 'Bạn chưa có content task nào. Bấm “Đề xuất task mới” để tự tạo, hoặc chờ Lead gán.' : 'Chưa có content task.') + '</td></tr>';
  }

  /* ---------- Content Task Drawer ---------- */
  function pushTaskActivity(taskId, text) {
    const c = loadCache(); const key = 'task:' + taskId; const e = c[key] || (c[key] = {}); e.activity = e.activity || [];
    e.activity.push({ text: text, by: user.name || user.role, at: new Date().toISOString() }); saveCache(c);
  }
  /* ---------- Q2: SLA Lead duyệt ---------- */
  const REVIEW_SLA_HOURS = 24; // auto-hạn nếu PIC để trống khi gửi
  function reviewOverdue(t) {
    return t && t.status === 'submitted_to_lead' && t.lead_review_due && new Date(t.lead_review_due) < new Date();
  }
  /* ---------- Q3: PIC self-checklist ---------- */
  function picChkList(t) {
    return arrayOf(t && t.pic_checklist).map(function (x) {
      return (typeof x === 'string') ? { label: x, done: false } : { label: (x && x.label) || '', done: !!(x && x.done) };
    }).filter(function (x) { return x.label; });
  }
  function picChkRowsHtml(t, editable) {
    const items = picChkList(t);
    if (!items.length) return '<p class="text-xs muted" style="margin:0">Chưa có mục nào — PIC tự thêm việc cần làm cho task này.</p>';
    return items.map(function (it, i) {
      return '<label class="checkbox pic-chk-row" data-idx="' + i + '"><input type="checkbox" class="pic-chk" ' + (it.done ? 'checked' : '') + ' ' + (editable ? '' : 'disabled') + ' /><div style="display:flex;align-items:center;gap:6px;flex:1"><span class="checkbox-text" style="flex:1">' + esc(it.label) + '</span>'
        + (editable ? '<button type="button" class="pic-chk-del" data-idx="' + i + '" title="Xóa mục" aria-label="Xóa" style="border:0;background:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:0 4px">×</button>' : '') + '</div></label>';
    }).join('');
  }
  function collectPicChk() {
    return Array.prototype.slice.call(document.querySelectorAll('#wt-picchk-list .pic-chk-row')).map(function (row) {
      const cb = row.querySelector('.pic-chk'); const lbl = row.querySelector('.checkbox-text');
      return { label: (lbl ? lbl.textContent : '').trim(), done: !!(cb && cb.checked) };
    }).filter(function (x) { return x.label; });
  }
  function updatePicChkBar() {
    const items = collectPicChk(); const total = items.length; const done = items.filter(function (x) { return x.done; }).length;
    const bar = document.getElementById('wt-picchk-bar'); const txt = document.getElementById('wt-picchk-text');
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    if (txt) txt.textContent = done + '/' + total;
  }
  function rerenderPicChk() {
    const cont = document.getElementById('wt-picchk-list'); if (!cont || !currentTask) return;
    cont.innerHTML = picChkRowsHtml(currentTask, canEditTask(currentTask));
    updatePicChkBar();
  }
  async function addPicChkItem() {
    if (!canEditTask(currentTask)) return;
    const ni = document.getElementById('wt-picchk-new'); const label = (ni && ni.value || '').trim();
    if (!label) { if (ni) ni.focus(); return; }
    const list = collectPicChk(); list.push({ label: label, done: false });
    await persistTask(currentTask, { pic_checklist: list }, 'PIC thêm mục checklist: ' + label);
    rerenderPicChk();
    const ni2 = document.getElementById('wt-picchk-new'); if (ni2) { ni2.value = ''; ni2.focus(); }
  }
  async function removePicChkItem(idx) {
    if (!canEditTask(currentTask)) return;
    const list = collectPicChk(); if (idx < 0 || idx >= list.length) return;
    list.splice(idx, 1);
    await persistTask(currentTask, { pic_checklist: list }, 'PIC xóa mục checklist');
    rerenderPicChk();
  }
  function buildTaskActions(t) {
    const btns = [];
    let hasSubmit = false;
    if (canEditTask(t)) {
      if (CT_SUBMITTABLE.indexOf(t.status) >= 0 || t.status === 'pic_assigned')
        btns.push('<button class="btn btn-secondary btn-sm" id="wt-start">' + (t.status === 'lead_revision' ? 'Chỉnh theo Lead' : (t.status === 'pic_assigned' ? 'Bắt đầu viết' : 'Tiếp tục viết')) + '</button>');
      btns.push('<button class="btn btn-secondary btn-sm" id="wt-save">Lưu nháp</button>');
      btns.push('<button class="btn btn-primary btn-sm" id="wt-submit">Gửi Lead Content duyệt</button>');
      hasSubmit = true;
    } else if (isContent && t.status === 'submitted_to_lead' && isMineTask(t)) {
      btns.push('<span class="wf-wait-tag">Đã gửi Lead — chờ duyệt</span>');
    }
    // Phase 5 — PIC gửi Media + hoàn tất task (sau khi Lead duyệt nội dung).
    const canPost = (isContent && isMineTask(t)) || isAdmin;
    if (canPost && t.status === 'lead_approved' && t.need_media_production && !t.media_request_created) {
      btns.push('<button class="btn btn-primary btn-sm" id="wt-make-media">Gửi sang Media</button>');
    }
    if (canPost && t.media_request_created && t.status !== 'completed') {
      // Bật/khóa theo Final (cập nhật async trong fillMediaTrack).
      btns.push('<button class="btn btn-primary btn-sm" id="wt-complete" disabled title="Chờ Media bàn giao Final">Hoàn tất task</button>');
    }
    // Hint lý do khi nút "Gửi Lead Content duyệt" bị khóa (text set trong refreshTaskSubmit).
    const hint = hasSubmit ? '<p id="wt-submit-hint" class="text-xs" style="display:none;margin:6px 2px 0;color:var(--danger)"></p>' : '';
    return btns.length ? '<div class="wf-actions"><div class="wf-actions-flow">' + btns.join('') + '</div>' + hint + '</div>' : '';
  }
  function buildTaskBody(t) {
    const editable = canEditTask(t);
    const ro = editable ? '' : 'readonly';
    const v = function (x) { return x ? esc(x) : '<em class="muted">—</em>'; };
    const p = planOf(t);
    const cl = parseJson(t.quality_checklist, {});
    const overdue = ctOverdue(t);

    // 1. Summary + 2. Brief + 3. Output requirements
    const summary = '<section class="drawer-block cwb-snapshot"><div class="drawer-block-head"><span class="block-letter">B</span><h4>Task Summary &amp; Brief</h4></div><dl>'
      + '<dt>Mã task</dt><dd><span class="order-id">' + esc(cwbCode(t)) + '</span></dd>'
      + '<dt>Nguồn</dt><dd>' + v(SOURCE_LABEL[t.source] || t.source) + (t.order_id ? ' · Order ' + esc(t.order_id) : '') + (p ? ' · Plan: ' + esc(p.title) : '') + '</dd>'
      + '<dt>Output yêu cầu</dt><dd>' + outputChips(t.output_types) + '</dd>'
      + '<dt>Brief</dt><dd style="white-space:pre-wrap">' + v(t.brief) + '</dd>'
      + (p ? '<dt>Key message (Plan)</dt><dd>' + v(p.key_message) + '</dd><dt>Đối tượng (Plan)</dt><dd>' + v(p.target_audience) + '</dd>' : '')
      + '<dt>Hạn wording</dt><dd>' + (t.wording_deadline ? '<span class="' + (overdue ? 'cwb-overdue' : '') + '">' + esc(fmtDT(t.wording_deadline)) + '</span>' + (overdue ? ' · ⚠ trễ' : '') : '<em class="muted">—</em>') + '</dd>'
      + '<dt>Vòng sửa nội bộ</dt><dd>' + (t.internal_revision_count || 0) + '</dd>'
      + '</dl></section>';

    // Lead revision callout
    const revisionNote = (t.status === 'lead_revision' && (t.lead_review_note || t.last_revision_reason))
      ? '<div class="dw-callout dw--warning" style="margin:0 0 var(--space-3)"><p><b>Lead yêu cầu chỉnh:</b> ' + esc(t.lead_review_note || t.last_revision_reason) + '</p></div>' : '';

    // Phase 5a — Media Order theo dõi (read-only, điền async ở openTaskDrawer/fillMediaTrack)
    const mediaTrackHtml = (t.media_request_created && t.media_order_id)
      ? '<section class="drawer-block cwb-snapshot ctm-review"><div class="drawer-block-head"><span class="block-letter">M</span><h4>Media Order — theo dõi sản xuất</h4></div>'
        + '<div id="cwb-media-track-body"><p class="text-xs muted" style="margin:0">Đang tải trạng thái <b>' + esc(t.media_order_id) + '</b>…</p></div></section>'
      : '';

    // Phase 5b — Gửi sang Media (Internal Media Request) inline (chỉ PIC sau khi Lead duyệt)
    const reqTypes = [['design', 'Thiết kế'], ['media', 'Quay / Chụp'], ['video', 'Video'], ['motion', 'Motion'], ['slide', 'Slide'], ['digital', 'Digital'], ['ads', 'Ads / Post'], ['other', 'Khác']];
    const mediaFormHtml = canSendMediaTask(t)
      ? '<section class="drawer-block ctm-review"><div class="drawer-block-head"><span class="block-letter">M</span><h4>Gửi sang Media (Internal Media Request)</h4></div>'
        + '<p class="text-xs muted" style="margin:0 0 8px">Nội dung đã được Lead duyệt — gửi order nội bộ sang Media để sản xuất (KHÔNG lộ Client Portal). Lead Media/Account push Production sau.</p>'
        + MEDIA_REQ_FIELDS.map(function (f) { return mrField('mr-' + f.k, f.label, mediaPrefill(t, f), { area: f.area, rows: f.rows, type: f.type, req: f.req }); }).join('')
        + '<div class="field"><label class="label">Loại sản xuất (request type) <span style="color:var(--red-600)">*</span></label><select class="select" id="mr-request_type">' + reqTypes.map(function (r) { return '<option value="' + r[0] + '"' + (t.request_type === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></div>'
        + mrField('mr-deliverable_type', 'Hạng mục bàn giao (deliverable)', t.deliverable_type || '', { req: true, ph: 'VD: 3 post + 1 KV' })
        + mrField('mr-production_deadline', 'Hạn sản xuất', toLocalInput(t.production_deadline || t.wording_deadline), { req: true, type: 'datetime-local' })
        + '<div class="field"><label class="label">Ưu tiên</label><select class="select" id="mr-priority">' + ['low', 'normal', 'high', 'urgent'].map(function (k) { return '<option value="' + k + '"' + ((t.priority || 'normal') === k ? ' selected' : '') + '>' + PRIO_VI[k] + '</option>'; }).join('') + '</select></div>'
        + '</section>'
      : '';

    // Phase 5c — Checklist hoàn tất task (auto-derive; mục Media-final cập nhật async)
    let completionHtml = '';
    if (passedLeadApproval(t)) {
      const isDone = t.status === 'completed';
      const items = [{ id: 'cmp-approved', label: 'Nội dung đã được Lead Content duyệt', done: true }];
      if (t.need_media_production) {
        items.push({ id: 'cmp-sent', label: 'Đã gửi Internal Media Request (thiết kế)', done: isDone || !!t.media_request_created });
        items.push({ id: 'cmp-final', label: 'Media bàn giao Final', done: isDone });
      }
      const total = items.length; const done = items.filter(function (x) { return x.done; }).length;
      const pct = Math.round(done / total * 100);
      const rows = items.map(function (it) { return '<label class="checkbox"><input type="checkbox" id="' + it.id + '" ' + (it.done ? 'checked' : '') + ' disabled /><div><span class="checkbox-text">' + esc(it.label) + '</span></div></label>'; }).join('');
      completionHtml = '<section class="drawer-block ctm-review"><div class="drawer-block-head"><span class="block-letter">✓</span><h4>Checklist hoàn tất task</h4></div>'
        + '<div style="display:flex;flex-direction:column;gap:8px">' + rows + '</div>'
        + '<div style="margin-top:10px"><span class="ctm-progress"><i id="cwb-cmp-bar" style="width:' + pct + '%"></i></span> <span class="text-xs" id="cwb-cmp-text">' + done + '/' + total + ' · ' + pct + '%</span></div>'
        + (t.need_media_production && !isDone ? '<p class="text-xs muted" style="margin:8px 0 0">Đủ checklist (Media bàn giao Final) → bấm <b>Hoàn tất task</b>.</p>' : '')
        + '</section>';
    }

    // 4. Missing Info / Assumptions — ĐÃ GỠ theo yêu cầu (không cần thiết).
    //    collectTaskForm giữ guard if(el) nên không đọc field đã gỡ; cột DB không đụng.
    const missing = '';

    // 5. Writing Workspace (multi-output)
    const wfFields = workspaceFields(t).map(function (k) {
      const m = FIELD_META[k] || { label: k, rows: 2 };
      return '<div class="field"><label class="label">' + esc(m.label) + '</label><textarea class="textarea cwbt-field" id="wt-ws-' + k + '" rows="' + m.rows + '" ' + ro + ' placeholder="...">' + esc(t[k] || '') + '</textarea></div>';
    }).join('');
    const workspace = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">W</span><h4>Writing Workspace</h4></div>'
      + (editable ? '' : '<p class="text-xs muted" style="margin:0 0 8px">Chế độ chỉ đọc — chỉ PIC được gán (hoặc Admin) chỉnh khi task đang ở pha Content.</p>')
      + '<div class="field"><label class="label">Tiêu đề bản thảo</label><input class="input cwbt-field" id="wt-ws-draft_title" ' + ro + ' value="' + esc(t.draft_title || '') + '" placeholder="Tiêu đề nội dung..." /></div>'
      + wfFields + '</section>';

    // 6. Production Handoff Draft (chỉ khi cần Media)
    const handoff = t.need_media_production ? '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">H</span><h4>Production Handoff Draft</h4></div>'
      + '<p class="text-xs muted" style="margin:0 0 8px">Task cần Media — chuẩn bị gói bàn giao (Lead hoàn thiện & tạo Media Request ở Phase 5).</p>'
      + HANDOFF_FIELDS.map(function (f) { return '<div class="field"><label class="label">' + esc(f.label) + '</label><textarea class="textarea cwbt-field" id="wt-' + f.k + '" rows="' + f.rows + '" ' + ro + ' placeholder="...">' + esc(t[f.k] || '') + '</textarea></div>'; }).join('')
      + '</section>' : '';

    // 7. Quality Checklist
    const clHtml = CT_CHECKLIST.map(function (c) {
      return '<label class="checkbox"><input type="checkbox" class="cwbt-check" id="wtcl-' + c.k + '" ' + (cl[c.k] ? 'checked' : '') + ' ' + (editable ? '' : 'disabled') + ' /><div><span class="checkbox-text">' + c.label + '</span></div></label>';
    }).join('');
    const checklist = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">C</span><h4>Quality Checklist</h4></div><div style="display:flex;flex-direction:column;gap:8px">' + clHtml + '</div>'
      + (editable ? '<p class="text-xs muted" style="margin:10px 0 0">Đạt tối thiểu ' + CT_CHECKLIST_MIN + '/' + CT_CHECKLIST.length + ' checklist + ít nhất 1 ô nội dung trước khi "Gửi Lead Content duyệt".</p>' : '') + '</section>';

    // 7b. Checklist của PIC (Q3 — PIC tự thêm/xóa mục, không block gửi duyệt)
    const pcItems = picChkList(t); const pcTotal = pcItems.length; const pcDone = pcItems.filter(function (x) { return x.done; }).length;
    const pcPct = pcTotal ? Math.round(pcDone / pcTotal * 100) : 0;
    const picChk = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">P</span><h4>Checklist của PIC</h4></div>'
      + '<p class="text-xs muted" style="margin:0 0 8px">Việc PIC tự đặt cho task này (ngoài Quality Checklist). KHÔNG bắt buộc để gửi duyệt.</p>'
      + '<div id="wt-picchk-list" style="display:flex;flex-direction:column;gap:8px">' + picChkRowsHtml(t, editable) + '</div>'
      + (editable ? '<div class="row" style="gap:6px;margin-top:10px"><input class="input" id="wt-picchk-new" placeholder="Thêm việc cần làm..." style="flex:1" /><button type="button" class="btn btn-secondary btn-sm" id="wt-picchk-add">Thêm mục</button></div>' : '')
      + '<div style="margin-top:10px"><span class="ctm-progress"><i id="wt-picchk-bar" style="width:' + pcPct + '%"></i></span> <span class="text-xs" id="wt-picchk-text">' + pcDone + '/' + pcTotal + '</span></div>'
      + '</section>';

    // 7c. SLA — Hạn Lead duyệt (Q2). Editable khi PIC sắp gửi; hiển thị + tô đỏ khi quá hạn.
    const showSla = editable && (CT_SUBMITTABLE.indexOf(t.status) >= 0 || t.status === 'submitted_to_lead');
    const slaDue = t.lead_review_due;
    const slaHtml = (showSla || slaDue)
      ? '<section class="drawer-block' + (reviewOverdue(t) ? ' ctm-review' : '') + '"><div class="drawer-block-head"><span class="block-letter">S</span><h4>Hạn Lead duyệt (SLA)</h4></div>'
        + (showSla
          ? '<div class="field"><label class="label">Hạn Lead Content phải duyệt</label><input class="input" type="datetime-local" id="wt-review-due" value="' + toLocalInput(slaDue) + '" /></div><p class="text-xs muted" style="margin:0">Để trống khi gửi → tự đặt +' + REVIEW_SLA_HOURS + 'h. Quá hạn mà Lead chưa duyệt sẽ bị đánh dấu đỏ ở Content Workspace.</p>'
          : '<p class="text-xs" style="margin:0"><b>Hạn duyệt:</b> <span class="' + (reviewOverdue(t) ? 'cwb-overdue' : '') + '">' + esc(fmtDT(slaDue)) + '</span>' + (reviewOverdue(t) ? ' · ⚠ Lead trễ duyệt' : '') + '</p>')
        + '</section>'
      : '';

    // 8. Files/Links
    const links = arrayOf(t.asset_links);
    const filesHtml = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">F</span><h4>Files / Links</h4></div>'
      + '<div class="field"><label class="label">Asset links (phân cách bằng dấu phẩy)</label><input class="input cwbt-field" id="wt-asset_links" ' + ro + ' value="' + esc(links.join(', ')) + '" placeholder="https://..., https://..." /></div>'
      + (links.length ? '<div class="row" style="flex-wrap:wrap;gap:6px">' + links.map(function (u) { return '<a class="btn btn-secondary btn-sm" href="' + esc(u) + '" target="_blank" rel="noopener">Mở link</a>'; }).join('') + '</div>' : '')
      + '</section>';

    // 9. Activity / Revision History
    const rev = arrayOf(t.revision_history);
    const revHtml = rev.length ? '<ul class="activity-mini">' + rev.slice().reverse().map(function (r) { return '<li><span><b>Vòng ' + esc(r.round || '') + ':</b> ' + esc(r.reason || r.note || '') + ' — <b>' + esc(r.by || '') + '</b></span><time>' + fmtDT(r.at) + '</time></li>'; }).join('') + '</ul>' : '';
    const acts = ((loadCache()['task:' + t.id] || {}).activity || []).slice(-10).reverse();
    const actHtml = acts.length ? acts.map(function (a) { return '<li><span>' + esc(a.text) + ' — <b>' + esc(a.by) + '</b></span><time>' + fmtDT(a.at) + '</time></li>'; }).join('') : '<li><span class="muted">Chưa có hoạt động.</span></li>';
    const activity = '<section class="drawer-block"><div class="drawer-block-head"><span class="block-letter">A</span><h4>Activity / Revision History</h4></div>' + revHtml + '<ul class="activity-mini">' + actHtml + '</ul></section>';

    return revisionNote + summary + mediaTrackHtml + mediaFormHtml + completionHtml + missing + workspace + handoff + checklist + picChk + slaHtml + filesHtml + activity;
  }
  function openTaskDrawer(t) {
    currentTask = t;
    document.getElementById('ctask-d-source').textContent = (SOURCE_LABEL[t.source] || 'TASK').toUpperCase() + ' · ' + cwbCode(t);
    document.getElementById('ctask-d-title').textContent = t.title || '—';
    const st = document.getElementById('ctask-d-status'); st.className = 'tb-status s--wording'; st.style.display = 'inline-flex'; st.style.alignItems = 'center'; st.style.gap = '4px'; st.innerHTML = '<span class="dot"></span>' + (CT_STATUS[t.status] || t.status);
    const pr = document.getElementById('ctask-d-priority'); pr.className = 'priority-pill p--' + (t.priority || 'normal'); pr.innerHTML = '<span class="dot"></span>' + (PRIO_VI[t.priority] || t.priority || '—');
    document.getElementById('ctask-d-round').textContent = 'Vòng ' + (t.internal_revision_count || 0);
    document.getElementById('ctask-drawer-actions').innerHTML = buildTaskActions(t);
    document.getElementById('ctask-drawer-body').innerHTML = buildTaskBody(t);
    wireTaskDrawer();
    if (t.media_request_created && t.media_order_id) fillMediaTrack(t.media_order_id, t);
    else refreshCompletion(t, null);
    const dr = document.getElementById('ctask-drawer'); dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    document.getElementById('ctask-drawer-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeTaskDrawer() {
    currentTask = null;
    const dr = document.getElementById('ctask-drawer'); dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true');
    document.getElementById('ctask-drawer-backdrop').classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function collectTaskForm() {
    const data = {};
    // workspace discrete columns
    ['draft_title', 'draft_body', 'caption', 'headline', 'subheadline', 'script', 'voice_over', 'ads_primary_text', 'ads_headline', 'landing_copy', 'email_sms_zalo_copy', 'cta', 'mandatory_info', 'visual_direction'].forEach(function (k) {
      const el = document.getElementById('wt-ws-' + k); if (el) data[k] = el.value;
    });
    // missing info
    ['missing_info_notes', 'assumptions', 'questions_for_account_client', 'risk_notes'].forEach(function (k) { const el = document.getElementById('wt-' + k); if (el) data[k] = el.value; });
    // handoff
    HANDOFF_FIELDS.forEach(function (f) { const el = document.getElementById('wt-' + f.k); if (el) data[f.k] = el.value; });
    // asset links
    const al = document.getElementById('wt-asset_links'); if (al) data.asset_links = al.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    // checklist
    const cl = {}; CT_CHECKLIST.forEach(function (c) { const el = document.getElementById('wtcl-' + c.k); cl[c.k] = !!(el && el.checked); });
    data.quality_checklist = cl;
    // PIC self-checklist (Q3) — chỉ ghi khi section có mặt
    if (document.getElementById('wt-picchk-list')) data.pic_checklist = collectPicChk();
    return data;
  }
  // Các cột được tính là "nội dung chính" khi gate gửi Lead (draft_title/cta/mandatory_info KHÔNG tính).
  const CT_BODY_FIELDS = ['draft_body', 'caption', 'headline', 'script', 'voice_over', 'ads_primary_text', 'landing_copy', 'email_sms_zalo_copy'];
  function taskHasContent() {
    return CT_BODY_FIELDS.some(function (k) {
      const el = document.getElementById('wt-ws-' + k); return el && el.value.trim();
    });
  }
  function taskValidForSubmit() {
    const clDone = CT_CHECKLIST.filter(function (c) { const el = document.getElementById('wtcl-' + c.k); return el && el.checked; }).length;
    const clOk = clDone >= Math.min(CT_CHECKLIST_MIN, CT_CHECKLIST.length);
    return clOk && taskHasContent();
  }
  // Lý do nút "Gửi Lead Content duyệt" đang khóa — để PIC biết còn thiếu gì.
  function submitBlockers() {
    const out = [];
    const missing = CT_CHECKLIST.filter(function (c) { const el = document.getElementById('wtcl-' + c.k); return !(el && el.checked); });
    const clDone = CT_CHECKLIST.length - missing.length;
    if (clDone < Math.min(CT_CHECKLIST_MIN, CT_CHECKLIST.length)) {
      out.push('Quality Checklist ' + clDone + '/' + CT_CHECKLIST.length + ' — cần tối thiểu ' + CT_CHECKLIST_MIN
        + '; còn thiếu: ' + missing.map(function (c) { return c.label; }).join(', '));
    }
    if (!taskHasContent()) {
      const labels = CT_BODY_FIELDS.filter(function (k) { return document.getElementById('wt-ws-' + k); })
        .map(function (k) { return (FIELD_META[k] || { label: k }).label; });
      out.push('Chưa có nội dung — điền ít nhất 1 ô: ' + (labels.join(' / ') || 'Nội dung chính / Body')
        + ' (Tiêu đề/CTA/Thông tin bắt buộc không tính)');
    }
    return out;
  }
  function refreshTaskSubmit() {
    const b = document.getElementById('wt-submit'); if (!b) return;
    const blockers = submitBlockers();
    b.disabled = blockers.length > 0;
    b.title = blockers.length ? blockers.join(' · ') : '';
    const h = document.getElementById('wt-submit-hint');
    if (h) {
      if (blockers.length) { h.style.display = ''; h.textContent = 'Chưa gửi được: ' + blockers.join(' · '); }
      else { h.style.display = 'none'; h.textContent = ''; }
    }
  }
  async function persistTask(t, patch, activity) {
    Object.assign(t, patch);
    try { await window.MH.store.contentTasks.update(t.id, patch); }
    catch (e) { console.warn('[cwb] persist task failed:', e); toast('warning', 'Chưa đồng bộ DB', 'Thay đổi lưu cục bộ. Kiểm tra đã chạy add-content-initiatives.sql chưa.'); }
    if (activity) pushTaskActivity(t.id, activity);
  }
  async function reloadTaskAndReopen() {
    const id = currentTask && currentTask.id;
    await loadTasks();
    if (!id) return;
    const t = TASKS.find(function (x) { return x.id === id; });
    if (t) openTaskDrawer(t); else closeTaskDrawer();
  }
  async function startTask() {
    if (!canEditTask(currentTask)) return;
    if (['pic_assigned', 'lead_revision', 'new', 'assigned'].indexOf(currentTask.status) < 0 && currentTask.status !== 'in_progress') return;
    if (currentTask.status === 'in_progress') { toast('info', 'Đang viết', currentTask.title); return; }
    await persistTask(currentTask, { status: 'in_progress' }, currentTask.status === 'lead_revision' ? 'PIC chỉnh theo Lead' : 'PIC bắt đầu viết');
    // Ads Order: PIC bắt đầu viết → ads_status='writing_ads_content'.
    syncAdsOrderFromTask(currentTask, { ads_status: 'writing_ads_content' }, ['submitted', 'lead_checking', 'assigned_to_content', 'lead_revision']);
    toast('info', 'Bắt đầu viết', currentTask.title);
    reloadTaskAndReopen();
  }
  async function saveTaskDraft() {
    if (!canEditTask(currentTask)) return;
    const data = collectTaskForm();
    if (['pic_assigned', 'lead_revision', 'account_revision', 'client_feedback', 'new', 'assigned'].indexOf(currentTask.status) >= 0) data.status = 'in_progress';
    await persistTask(currentTask, data, 'PIC lưu nháp');
    toast('success', 'Đã lưu nháp', currentTask.title);
    reloadTaskAndReopen();
  }
  async function submitTaskToLead() {
    if (!canEditTask(currentTask)) return;
    if (CT_SUBMITTABLE.indexOf(currentTask.status) < 0) { toast('warning', 'Chưa thể gửi', 'Task không ở trạng thái cho phép gửi.'); return; }
    const blockers = submitBlockers();
    if (blockers.length) { toast('warning', 'Chưa đủ điều kiện', blockers.join(' · ')); return; }
    const data = collectTaskForm();
    data.status = 'submitted_to_lead';
    data.lead_review_status = 'pending';
    // Q2 — hạn Lead duyệt: PIC nhập, hoặc auto = giờ gửi + SLA mặc định.
    const dueEl = document.getElementById('wt-review-due');
    const dueVal = dueEl && dueEl.value ? new Date(dueEl.value) : new Date(Date.now() + REVIEW_SLA_HOURS * 3600 * 1000);
    data.lead_review_due = dueVal.toISOString();
    await persistTask(currentTask, data, 'PIC gửi Lead Content duyệt');
    // Ads Order: gửi Lead duyệt → ads_status='submitted_to_lead' (client thấy "Đang kiểm tra nội dung").
    syncAdsOrderFromTask(currentTask, { ads_status: 'submitted_to_lead' }, ['submitted', 'lead_checking', 'assigned_to_content', 'writing_ads_content', 'lead_revision']);
    const label = cwbCode(currentTask) + ' · ' + (currentTask.title || 'Content task');
    const notified = await notifyLeadTask(currentTask, '📨 Content task chờ Lead duyệt',
      label + ' — ' + (user.name || 'Content') + ' đã gửi bản thảo.');
    if (notified) toast('success', 'Đã gửi Lead Content duyệt', label + ' — chờ Lead review.');
    else toast('warning', 'Đã lưu, nhưng chưa báo được Lead', label + ' — task đã chuyển trạng thái chờ duyệt, nhưng thông báo tới Lead thất bại (kiểm tra add-notify-roles-rpc.sql). Báo Lead trực tiếp giúp.');
    reloadTaskAndReopen();
  }
  // Báo Lead Content qua RPC `notify_roles` (SECURITY DEFINER) thay vì tự lookup
  // users + insert notifications. Lý do: bản cũ chạy trong phiên `content` — nếu RLS
  // chặn đọc users hoặc chặn insert thì query trả rỗng/lỗi mà KHÔNG throw ra UI
  // (catch chỉ console.warn) → PIC thấy "đã gửi" còn Lead không nhận được gì.
  // RPC làm cả 2 việc trong DB + trả về số noti đã tạo để mình verify được.
  // ⚠ cần supabase/add-notify-roles-rpc.sql.
  async function notifyLeadTask(t, title, message) {
    if (!t || !window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return true;
    try {
      const { error } = await window.MH.supabase.rpc('notify_roles', {
        p_roles: ['lead_content'],
        p_type: 'task_status_changed',
        p_title: title,
        p_message: message,
        p_link: 'content-team.html?task=' + (t.id || ''),
        p_entity_type: null,
        p_entity_id: t.id || null
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[cwb] notifyLeadTask failed:', e);
      return false;
    }
  }
  // Xem ghi chú ở content-team.js: chuyển sang RPC `notify_roles` (2026-07-31) vì bản
  // lookup users trực tiếp phụ thuộc RLS người gửi + nuốt lỗi → noti không tới mà im lặng.
  // Trả về số noti đã gửi, -1 nếu lỗi.
  async function notifyRoles(roles, type, title, message, link, orderId) {
    if (!window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return 0;
    try {
      const { data, error } = await window.MH.supabase.rpc('notify_roles', {
        p_roles: roles, p_type: type, p_title: title, p_message: message || null,
        p_link: link || null, p_entity_type: 'orders', p_entity_id: orderId || null
      });
      if (error) { console.warn('[cwb] notify_roles error (chạy add-notify-roles-rpc.sql?):', error); return -1; }
      return typeof data === 'number' ? data : 0;
    } catch (e) { console.warn('[cwb] notifyRoles failed:', e); return -1; }
  }
  /* ---------- Phase 5 — PIC tạo Internal Media Request inline ---------- */
  async function createMediaRequestInline(t) {
    if (!t || !canSendMediaTask(t)) { toast('warning', 'Chưa đủ điều kiện', 'Chỉ gửi Media cho task đã Lead duyệt + cần Media + chưa gửi.'); return; }
    const get = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const vals = {};
    MEDIA_REQ_FIELDS.forEach(function (f) { vals[f.k] = get('mr-' + f.k); });
    vals.request_type = get('mr-request_type');
    vals.deliverable_type = get('mr-deliverable_type');
    const dlRaw = get('mr-production_deadline');
    vals.priority = get('mr-priority') || 'normal';
    const missing = [];
    if (!vals.final_body_or_script) missing.push('Final body/script');
    if (!vals.visual_direction) missing.push('Định hướng hình ảnh');
    if (!vals.format_size) missing.push('Format/Size');
    if (!vals.channel) missing.push('Kênh đăng');
    if (!dlRaw) missing.push('Hạn sản xuất');
    if (!vals.request_type) missing.push('Loại sản xuất');
    if (!vals.deliverable_type) missing.push('Hạng mục bàn giao');
    if (missing.length) { toast('warning', 'Thiếu handoff', 'Cần điền: ' + missing.join(', ') + '.'); return; }
    const deadlineIso = new Date(dlRaw).toISOString();
    const deadlineYmd = deadlineIso.slice(0, 10); // requested_deadline là DATE
    // Task nguồn Ads Order → order nội bộ loại "internal_ads_media_request" (prefix ADS-MEDIA-,
    // badge "Internal · From Ads", link ngược source_ads_order_id) — KHÔNG dùng kind From Content.
    const adsTask = isAdsTask(t);
    const orderId = adsTask ? genAdsMediaId() : genOrderId();
    const briefParts = [vals.final_body_or_script];
    if (vals.cta) briefParts.push('CTA: ' + vals.cta);
    if (vals.mandatory_info) briefParts.push('Thông tin bắt buộc: ' + vals.mandatory_info);
    const noteParts = [adsTask ? '[Internal Media Request từ Ads Order]' : '[Internal Media Request từ Content Team]', 'Content Task: ' + (t.title || t.id)];
    if (adsTask) noteParts.push('Nguồn Ads: ' + t.order_id);
    if (vals.media_note) noteParts.push('Ghi chú Media: ' + vals.media_note);
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
      requester_name: user.name || 'Content',
      requester_email: (user && user.email) || 'content-team@cb.vn',
      requester_role: 'content',
      origin: adsTask ? 'ads_order' : 'content_team',
      order_kind: adsTask ? 'internal_ads_media_request' : 'internal_media_request',
      client_visible: false,
      source_content_task_id: t.id,
      source_content_plan_id: t.content_plan_id || null,
      account_status: 'confirmed',
      brief_wording_status: 'completed',
      created_at: new Date().toISOString()
    };
    if (adsTask) payload.source_ads_order_id = t.order_id;
    try { await window.MH.store.orders.create(payload); }
    catch (e) {
      console.warn('[cwb] create media order failed:', e);
      toast('warning', 'Chưa tạo được Media Order', 'Kiểm tra đã chạy add-content-to-media-order.sql + RLS content INSERT order nội bộ.');
      return;
    }
    await persistTask(t, {
      status: 'media_order_created', media_request_created: true, media_order_id: orderId,
      handoff_ready: true, final_headline: vals.final_headline, final_body_or_script: vals.final_body_or_script,
      handoff_mandatory_info: vals.mandatory_info, handoff_visual_direction: vals.visual_direction,
      format_size: vals.format_size, channel: vals.channel, handoff_asset_link: vals.asset_link,
      media_note: vals.media_note, production_deadline: deadlineIso, request_type: vals.request_type,
      deliverable_type: vals.deliverable_type
    }, 'PIC gửi Internal Media Request → ' + orderId);
    // Ads: cập nhật Ads Order gốc (status + link media order) để Lead drawer/Client status theo kịp.
    if (adsTask) syncAdsOrderFromTask(t, { ads_status: 'media_request_created', ads_media_order_id: orderId },
      ['submitted', 'lead_checking', 'assigned_to_content', 'writing_ads_content', 'submitted_to_lead', 'lead_revision', 'lead_approved', 'need_creative']);
    // await + kiểm số noti: PIC phải biết ngay nếu Media KHÔNG nhận được request
    // (trước 2026-07-31 gọi fire-and-forget + nuốt lỗi → Media không hay biết).
    const sentMedia = await notifyRoles(['admin', 'account', 'lead_media'], 'order_new', adsTask ? '🎬 Internal Media Request (Ads)' : '🎬 Internal Media Request từ Content',
      orderId + ' · ' + (vals.final_headline || t.title || '') + ' — cần Media sản xuất (push Production).',
      'database-orders.html?id=' + orderId, orderId);
    if (sentMedia <= 0) toast('warning', 'Order đã tạo nhưng CHƯA báo được Media', orderId + ' — báo Lead Media/Account trực tiếp giúp.');
    notifyLeadTask(t, '🎬 PIC đã gửi Media Request', (t.title || 'Content task') + ' → ' + orderId + ' (order nội bộ' + (adsTask ? ' · phục vụ Ads ' + t.order_id : '') + ').');
    toast('success', 'Đã gửi sang Media', orderId + ' — order nội bộ, không lộ Client Portal.');
    reloadTaskAndReopen();
  }
  // Theo dõi Media Order nội bộ (read-only) + cập nhật checklist hoàn tất + nút "Hoàn tất task".
  async function fillMediaTrack(orderId, t) {
    let o = null;
    try { o = await window.MH.store.orders.get(orderId); } catch (e) { console.warn('[cwb] media track fetch:', e); }
    const cur = document.getElementById('cwb-media-track-body');
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
    refreshCompletion(t || currentTask, o);
  }
  // Cập nhật checklist hoàn tất + nút "Hoàn tất task" theo trạng thái order.
  function refreshCompletion(t, o) {
    if (!t) return;
    const final = orderFinalDelivered(o);
    const fin = document.getElementById('cmp-final'); if (fin) fin.checked = final;
    let total = 1, done = 1; // mục "Lead duyệt" luôn done khi block hiện
    if (t.need_media_production) { total += 2; done += (t.media_request_created ? 1 : 0) + (final ? 1 : 0); }
    const pct = Math.round(done / total * 100);
    const bar = document.getElementById('cwb-cmp-bar'); if (bar) bar.style.width = pct + '%';
    const txt = document.getElementById('cwb-cmp-text'); if (txt) txt.textContent = done + '/' + total + ' · ' + pct + '%';
    const btn = document.getElementById('wt-complete');
    if (btn) { const ready = (!t.need_media_production) || final; btn.disabled = !ready; btn.title = ready ? '' : 'Chờ Media bàn giao Final'; }
  }
  async function completeTask(t) {
    if (!t) return;
    if (t.need_media_production) {
      let o = null; try { o = await window.MH.store.orders.get(t.media_order_id); } catch (e) { }
      if (!orderFinalDelivered(o)) { toast('warning', 'Chưa thể hoàn tất', 'Media chưa bàn giao Final cho order ' + (t.media_order_id || '') + '.'); return; }
    }
    await persistTask(t, { status: 'completed' }, 'Hoàn tất task (Media đã bàn giao Final)');
    // Ads Order: creative đã có Final → ads_status='creative_ready' (Lead bấm tiếp Sẵn sàng/Chạy).
    syncAdsOrderFromTask(t, { ads_status: 'creative_ready' }, ['media_request_created', 'need_creative', 'lead_approved']);
    notifyLeadTask(t, '✅ Content task đã hoàn tất', (t.title || 'Content task') + ' — Media bàn giao Final, PIC đã hoàn tất.');
    toast('success', 'Đã hoàn tất task', t.title || t.id);
    reloadTaskAndReopen();
  }
  function wireTaskDrawer() {
    const w = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    w('wt-start', startTask); w('wt-save', saveTaskDraft); w('wt-submit', submitTaskToLead);
    w('wt-make-media', function () { createMediaRequestInline(currentTask); });
    w('wt-complete', function () { completeTask(currentTask); });
    // Q3 — PIC self-checklist: add / remove (delegation) / toggle-bar
    w('wt-picchk-add', addPicChkItem);
    const pcNew = document.getElementById('wt-picchk-new');
    if (pcNew) pcNew.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addPicChkItem(); } });
    const pcList = document.getElementById('wt-picchk-list');
    if (pcList) {
      pcList.addEventListener('click', function (e) { const del = e.target.closest('.pic-chk-del'); if (del) { e.preventDefault(); e.stopPropagation(); removePicChkItem(parseInt(del.getAttribute('data-idx'), 10)); } });
      pcList.addEventListener('change', function (e) { if (e.target.classList.contains('pic-chk')) updatePicChkBar(); });
    }
    document.querySelectorAll('#ctask-drawer-body .cwbt-field').forEach(function (el) { el.addEventListener('input', refreshTaskSubmit); });
    document.querySelectorAll('#ctask-drawer-body .cwbt-check').forEach(function (el) { el.addEventListener('change', refreshTaskSubmit); });
    refreshTaskSubmit();
  }

  /* ===================================================================
     CONTENT TỰ ĐỀ XUẤT TASK (source=content_initiated, PIC = chính mình)
     1 gate duy nhất: Lead duyệt NỘI DUNG (submitted_to_lead → lead_approved)
     rồi PIC mới gửi được sang Media (canSendMediaTask giữ nguyên).
     Lead được notify ngay khi tạo — không cần gate "chấp thuận đề xuất".
     =================================================================== */
  let selfModalSaving = false;
  function openSelfModal() {
    const body = ''
      + mrField('cst-title', 'Tiêu đề task', '', { req: true, ph: 'VD: Post khai trương chi nhánh Q7' })
      + mrField('cst-brief', 'Brief / Mục tiêu nội dung', '', { area: true, rows: 3, ph: 'Bối cảnh, mục tiêu, thông tin chính cần truyền tải...' })
      + '<div class="field"><label class="label">Output types</label><div class="ctm-chk-group" id="cst-outputs">'
        + (ENUMS.OUTPUT_TYPES || []).map(function (k) { return '<label class="ctm-chk-chip"><input type="checkbox" class="cst-out-chk" value="' + k + '" ' + (k === 'social_post' ? 'checked' : '') + '/><span>' + esc(OUTPUT_LABEL[k] || k) + '</span></label>'; }).join('')
      + '</div></div>'
      + '<div class="field"><label class="label">Ưu tiên</label><select class="select" id="cst-priority">' + ['low', 'normal', 'high', 'urgent'].map(function (k) { return '<option value="' + k + '"' + (k === 'normal' ? ' selected' : '') + '>' + PRIO_VI[k] + '</option>'; }).join('') + '</select></div>'
      + mrField('cst-deadline', 'Hạn wording (dự kiến)', '', { type: 'datetime-local' })
      + '<div class="field"><label class="checkbox"><input type="checkbox" id="cst-media" /><div><span class="checkbox-text">Cần Media thiết kế / sản xuất</span></div></label></div>'
      + '<div id="cst-media-wrap" style="display:none">'
        + mrField('cst-media-type', 'Loại Media Request', '', { ph: 'VD: KV, post design, video teaser' })
        + mrField('cst-media-deadline', 'Hạn Media (dự kiến)', '', { type: 'datetime-local' })
        + mrField('cst-media-notes', 'Ghi chú cho Media', '', { area: true, rows: 2, ph: 'Định hướng hình ảnh sơ bộ cho Media team' })
      + '</div>'
      + '<p class="text-xs muted" style="margin:0">Task tạo xong bạn viết luôn. Gate duy nhất trước khi sang Media: <b>Lead Content duyệt nội dung</b> (Lead được thông báo ngay khi tạo).</p>';
    document.getElementById('cwbt-modal-body').innerHTML = body;
    document.getElementById('cwbt-modal').classList.add('is-open');
    document.getElementById('cwbt-modal').setAttribute('aria-hidden', 'false');
    document.getElementById('cwbt-modal-backdrop').classList.add('is-open');
    const mc = document.getElementById('cst-media');
    mc.addEventListener('change', function () { document.getElementById('cst-media-wrap').style.display = mc.checked ? '' : 'none'; });
  }
  function closeSelfModal() {
    document.getElementById('cwbt-modal').classList.remove('is-open');
    document.getElementById('cwbt-modal').setAttribute('aria-hidden', 'true');
    document.getElementById('cwbt-modal-backdrop').classList.remove('is-open');
  }
  async function saveSelfTask() {
    if (selfModalSaving) return;
    const gv = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const title = gv('cst-title');
    if (!title) { toast('warning', 'Thiếu tiêu đề', 'Nhập tiêu đề task trước khi tạo.'); return; }
    const needMedia = document.getElementById('cst-media').checked;
    const outputs = Array.prototype.slice.call(document.querySelectorAll('#cst-outputs .cst-out-chk:checked')).map(function (c) { return c.value; });
    const payload = {
      source: 'content_initiated', content_plan_id: null,
      title: title, brief: gv('cst-brief'),
      output_types: outputs.length ? outputs : ['social_post'],
      // PIC = chính mình: ghi user_id (khóa RLS content insert own_initiative) + snapshot tên.
      assigned_pic_user_id: user.id || null,
      assigned_pic: user.name || user.role,
      priority: gv('cst-priority') || 'normal',
      need_media_production: needMedia,
      status: 'in_progress', // tạo xong viết luôn — không chờ gate "chấp thuận"
      created_by_user_id: user.id || null,
      created_by: user.name || user.role
    };
    const dl = gv('cst-deadline'); if (dl) payload.wording_deadline = new Date(dl).toISOString();
    if (needMedia) {
      payload.request_type = gv('cst-media-type');
      payload.media_note = gv('cst-media-notes');
      const md = gv('cst-media-deadline'); if (md) payload.production_deadline = new Date(md).toISOString();
    }
    selfModalSaving = true;
    const btn = document.getElementById('cwbt-modal-save'); if (btn) { btn.disabled = true; btn.textContent = 'Đang tạo…'; }
    let created;
    try { created = await window.MH.store.contentTasks.create(payload); }
    catch (e) {
      console.warn('[cwb] create self task failed:', e);
      toast('error', 'Chưa tạo được task', 'Kiểm tra đã chạy add-content-self-initiative.sql (RLS cho content tự tạo task) chưa.');
      selfModalSaving = false; if (btn) { btn.disabled = false; btn.textContent = 'Tạo task'; }
      return;
    }
    pushTaskActivity(created.id, 'Content tự đề xuất task (PIC: ' + (user.name || user.role) + ')');
    notifyLeadTask(created, '📝 Content tự đề xuất task mới', cwbCode(created) + ' · ' + title + ' — ' + (user.name || 'Content') + ' tự đề xuất' + (needMedia ? ' · cần Media thiết kế' : '') + '. Gate: Lead duyệt nội dung trước khi sang Media.');
    toast('success', 'Đã tạo task ' + cwbCode(created), title + ' — viết nội dung rồi gửi Lead Content duyệt.');
    closeSelfModal();
    selfModalSaving = false; if (btn) { btn.disabled = false; btn.textContent = 'Tạo task'; }
    await loadTasks();
    const t = TASKS.find(function (x) { return x.id === created.id; }) || created;
    cwbView = 'tasks'; renderCwbTabs();
    openTaskDrawer(t);
  }
  (function wireSelfTask() {
    const nb = document.getElementById('cwbt-new-task');
    if (nb && (isContent || isAdmin)) {
      nb.hidden = false;
      nb.addEventListener('click', openSelfModal);
    }
    const w = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    w('cwbt-modal-close', closeSelfModal); w('cwbt-modal-cancel', closeSelfModal); w('cwbt-modal-backdrop', closeSelfModal);
    w('cwbt-modal-save', saveSelfTask);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('cwbt-modal').classList.contains('is-open')) closeSelfModal(); });
  })();

  /* ---------- Wiring Phase 3 (tabs + task delegation) ---------- */
  (function wirePhase3() {
    const tabs = document.getElementById('cwb-tabs');
    if (tabs) tabs.addEventListener('click', function (e) { const b = e.target.closest('[data-cwb-view]'); if (!b) return; cwbView = b.getAttribute('data-cwb-view'); renderCwbTabs(); });
    const sub = document.getElementById('cwbt-subtabs');
    if (sub) sub.addEventListener('click', function (e) { const b = e.target.closest('[data-cwbt-sub]'); if (!b) return; taskSub = b.getAttribute('data-cwbt-sub'); renderTasks(); });
    const se = document.getElementById('cwbt-search'); if (se) se.addEventListener('input', function (e) { TFILTERS.search = e.target.value; renderTasks(); });
    const fo = document.getElementById('cwbt-filter-output'); if (fo) fo.addEventListener('change', function (e) { TFILTERS.output = e.target.value; renderTasks(); });
    const cl = document.getElementById('ctask-drawer-close'); if (cl) cl.addEventListener('click', closeTaskDrawer);
    const bd = document.getElementById('ctask-drawer-backdrop'); if (bd) bd.addEventListener('click', closeTaskDrawer);
    document.addEventListener('click', function (e) { const b = e.target.closest('[data-ctask-open]'); if (!b) return; const t = TASKS.find(function (x) { return x.id === b.getAttribute('data-ctask-open'); }); if (t) openTaskDrawer(t); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('ctask-drawer').classList.contains('is-open')) closeTaskDrawer(); });
  })();

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

  Promise.all([loadOrders(), loadTasks()]).then(function () {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) {
      const all = window.__CWB_ALL || [];
      const o = ORDERS.find(function (x) { return x.order_id === id; }) || all.find(function (x) { return x.order_id === id; });
      // content: chỉ mở order wording CỦA MÌNH. Không phải/không đọc được (RLS) → toast, KHÔNG render.
      if (o && (!isContent || owIsMine(o))) { cwbView = 'orders'; renderCwbTabs(); openDrawer(o); }
      else if (isContent) toast('warning', 'Không có quyền xem', 'Order này không được gán cho bạn hoặc không còn thuộc bạn.');
    }
    // Deep-link Content Task (?task=) — chuyển sang view tasks + mở drawer.
    const taskId = params.get('task');
    if (taskId) {
      const t = TASKS.find(function (x) { return x.id === taskId; });
      // TASKS role content đã lọc isMineTask; task của người khác không có trong TASKS.
      if (t) { cwbView = 'tasks'; renderCwbTabs(); openTaskDrawer(t); }
      else if (isContent) toast('warning', 'Không có quyền xem', 'Task này không được gán cho bạn hoặc không còn thuộc bạn.');
    }
    renderCwbTabs();
  });
  // Đồng bộ nhẹ: poll 60s + reload khi quay lại tab.
  setInterval(function () { if (!document.hidden) { loadOrders(); loadTasks(); } }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { loadOrders(); loadTasks(); } });
})();
