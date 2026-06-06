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
  if (['admin', 'account', 'content'].indexOf(user.role) < 0) {
    if (window.MH && window.MH.toast) window.MH.toast({ type: 'warning', title: 'Không có quyền', message: 'Content Wording chỉ dành cho Admin / Account / Content.' });
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
  const WS_CONTENT_EDITABLE = ['none', 'assigned', 'in_progress', 'account_revision', 'client_feedback'];
  function contentEditable(o) { return canEditWording && WS_CONTENT_EDITABLE.indexOf((o && o.brief_wording_status) || 'none') >= 0; }

  (function () {
    const n = document.getElementById('hpc-name'); if (n) n.textContent = user.name || 'User';
    const a = document.getElementById('hpc-avatar'); if (a) a.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
    const r = document.getElementById('hpc-role-badge'); if (r) { r.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1); r.className = 'role-badge r--' + user.role + ' header-pc-role'; }
    const lo = document.getElementById('logout-btn'); if (lo) lo.addEventListener('click', function () { localStorage.removeItem('mh-user'); if (window.MH && window.MH.toast) window.MH.toast({ type: 'info', title: 'Đã đăng xuất' }); setTimeout(function () { location.replace('login.html'); }, 400); });
  })();

  /* ---------- Helpers / constants ---------- */
  function toast(t, ti, m) { if (window.MH && window.MH.toast) window.MH.toast({ type: t, title: ti, message: m }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function fmtDT(s) { if (!s) return '—'; s = String(s); const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z'); if (isNaN(d.getTime())) return s; const p = function (n) { return String(n).padStart(2, '0'); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  const WSTATUS = {
    none: 'Chưa chuyển Content Wording', assigned: 'Đã chuyển Content Wording', in_progress: 'Content đang xử lý',
    submitted_to_account: 'Chờ Account duyệt', account_revision: 'Account yêu cầu Content chỉnh',
    sent_to_client: 'Chờ Client xác nhận brief wording', client_feedback: 'Client yêu cầu chỉnh brief wording',
    client_approved: 'Client đã xác nhận brief wording', completed: 'Hoàn tất Content Wording'
  };
  const ENGAGED = ['assigned', 'in_progress', 'submitted_to_account', 'account_revision', 'sent_to_client', 'client_feedback', 'client_approved', 'completed'];
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
  const LIFE = ['Assigned', 'Content Working', 'Submitted to Account', 'Account Review', 'Client Confirmation', 'Approved'];
  const LIFE_REACHED = { none: 0, assigned: 1, in_progress: 1, account_revision: 1, submitted_to_account: 3, sent_to_client: 4, client_feedback: 4, client_approved: 6, completed: 6 };

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
    list = list.map(function (o) { return Object.assign({}, o, cache[o.order_id] || {}); });
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
        + '<td><span class="tb-status s--wording"><span class="dot"></span>' + esc(WSTATUS[ws] || ws) + '</span></td>'
        + '<td><span class="text-xs">' + (o.brief_wording_round || 0) + '</span></td>'
        + '<td><span class="text-xs">' + esc(o.brief_wording_pic || '—') + '</span></td>'
        + '<td><button class="btn btn-secondary btn-sm" data-open="' + esc(o.order_id) + '">Mở Wording Drawer</button></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="10" style="text-align:center;padding:44px;color:var(--text-muted)">Chưa có order nào cần Content Wording.</td></tr>';
  }

  /* ---------- Drawer ---------- */
  function buildActions(o) {
    const ws = o.brief_wording_status || 'none';
    const btns = [];
    if (contentEditable(o)) {
      if (ws === 'assigned' || ws === 'client_feedback') btns.push('<button class="btn btn-secondary btn-sm" id="w-start">' + (ws === 'client_feedback' ? 'Chỉnh theo Client' : 'Bắt đầu xử lý') + '</button>');
      btns.push('<button class="btn btn-secondary btn-sm" id="w-save">Lưu nháp</button>');
      btns.push('<button class="btn btn-primary btn-sm" id="w-submit">Gửi Account duyệt</button>');
    } else if (isContent && ws === 'submitted_to_account') {
      // Content đã gửi — chờ Account duyệt: không cho gửi lại, chỉ hiện trạng thái.
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
        : (ws === 'submitted_to_account' ? 'Đã gửi Account duyệt — đang chờ Account xử lý, không thể chỉnh.'
          : (ws === 'sent_to_client' ? 'Đã gửi Client xác nhận — chế độ chỉ đọc.'
            : ((ws === 'client_approved' || ws === 'completed') ? 'Brief wording đã hoàn tất — chế độ chỉ đọc.' : 'Chế độ chỉ đọc.'))))
      + '</p>';
    const v = function (x) { return x ? esc(x) : '<em class="muted">—</em>'; };
    const arr = function (a) { return (Array.isArray(a) && a.length) ? a.map(function (x) { return '<span class="chip-mini">' + esc(x) + '</span>'; }).join('') : '<em class="muted">—</em>'; };
    const link = function (u) { return u ? '<a class="link" href="' + esc(u) + '" target="_blank" rel="noopener">Mở link</a>' : '<em class="muted">—</em>'; };

    const reached = LIFE_REACHED[ws] != null ? LIFE_REACHED[ws] : 0;
    const lifeLi = LIFE.map(function (s, i) {
      const st = i < reached ? 'done' : (i === reached ? 'active' : 'pending');
      return '<li class="bw-step bw-' + st + '"><span class="bw-dot">' + (st === 'done' ? '✓' : (i + 1)) + '</span><span class="bw-label">' + s + '</span></li>';
    }).join('');
    const revisionNote = (ws === 'account_revision' && o.wording_account_note) ? '<div class="dw-callout dw--warning" style="margin-top:var(--space-3)"><p><b>Account yêu cầu chỉnh:</b> ' + esc(o.wording_account_note) + '</p></div>' : '';

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
        + (ws === 'submitted_to_account' ? '<p class="text-xs muted" style="margin:0 0 8px">Content đã gửi bản wording. Duyệt → "Gửi Client xác nhận", hoặc "Trả Content chỉnh" kèm ghi chú.</p>' : '')
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
    const st = document.getElementById('cwb-d-status'); st.className = 'tb-status s--wording'; st.innerHTML = '<span class="dot"></span>' + (WSTATUS[ws] || ws);
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
    if (['assigned', 'account_revision', 'client_feedback'].indexOf(current.brief_wording_status) >= 0) patch.brief_wording_status = 'in_progress';
    await persist(current, patch, 'Content lưu nháp');
    toast('success', 'Đã lưu nháp', current.order_id + ' — bản wording đã được lưu.');
    reloadAndReopen();
  }
  async function startWork() {
    if (!contentEditable(current)) return;
    if (['assigned', 'account_revision', 'client_feedback'].indexOf(current.brief_wording_status) < 0) return;
    const startMsg = current.brief_wording_status === 'client_feedback' ? 'Content chỉnh theo Client' : 'Content bắt đầu xử lý';
    await persist(current, { brief_wording_status: 'in_progress', wording_last_updated_at: new Date().toISOString() }, startMsg);
    toast('info', 'Bắt đầu xử lý', current.order_id);
    reloadAndReopen();
  }
  async function submitToAccount() {
    if (!contentEditable(current)) return;
    if (current.brief_wording_status === 'submitted_to_account') { toast('info', 'Đã gửi', current.order_id + ' — bản wording đã gửi Account, đang chờ duyệt.'); return; }
    if (!isValidForSubmit()) { toast('warning', 'Chưa đủ điều kiện', 'Hoàn tất các trường bắt buộc (*) + toàn bộ checklist trước khi gửi.'); return; }
    const data = collectForm();
    const nowIso = new Date().toISOString();
    await persist(current, Object.assign({}, data, {
      brief_wording_status: 'submitted_to_account',
      wording_submitted_by: user.name || user.role,
      wording_submitted_at: nowIso,
      wording_last_updated_at: nowIso
    }), 'Content gửi Account duyệt');
    toast('success', 'Đã gửi Account duyệt', current.order_id + ' — chờ Account review.');
    reloadAndReopen();
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
    toast('info', 'Đã trả Content chỉnh', current.order_id);
    reloadAndReopen();
  }
  async function accountSendToClient() {
    if (!isAccountAdmin) return;
    if (current.brief_wording_status !== 'submitted_to_account') { toast('warning', 'Chưa thể gửi', 'Chỉ gửi Client khi Content đã submit.'); return; }
    const nowIso = new Date().toISOString();
    const by = (user && (user.name || user.role)) || 'Account';
    await persist(current, { brief_wording_status: 'sent_to_client', wording_client_sent_at: nowIso, wording_client_sent_by: by, wording_last_updated_at: nowIso }, 'Account gửi Client xác nhận');
    toast('success', 'Đã gửi Client xác nhận', current.order_id + ' — chờ Client xác nhận brief wording trong Client Portal.');
    reloadAndReopen();
  }

  function wireDrawer() {
    const w = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    w('w-save', saveDraft); w('w-start', startWork); w('w-submit', submitToAccount);
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
