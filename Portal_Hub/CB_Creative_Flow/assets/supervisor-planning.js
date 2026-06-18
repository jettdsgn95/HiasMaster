/* =====================================================================
   supervisor-planning.js — Supervisor Planning ("Strategy Board")

   - Module TÁCH BIỆT: System Supervisor (+ Admin) lập + giao kế hoạch nội bộ
     cho Lead Media / Lead Content / CẢ 2 ('both'). KHÔNG dính tasks production / wording.
   - Roles vào trang: admin + system_supervisor (full), lead_media + lead_content
     (xem kế hoạch CỦA MÌNH gồm 'both' + cập nhật tiến độ phần mình + comment).
   - Tiến độ RIÊNG từng Lead: lead_status jsonb {lead_media, lead_content}; `status` = derived.
   - Workspace cộng tác: comment 2 chiều + activity timeline (lead_task_comments),
     checklist/progress (jsonb), notify 2 chiều, realtime, deep-link ?id, board kanban.
   - Data: MH.store.leadTasks + MH.store.leadTaskComments. ⚠ cần add-supervisor-planning.sql.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth guard ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  const ALLOW = ['admin', 'system_supervisor', 'lead_media', 'lead_content'];
  if (ALLOW.indexOf(user.role) < 0) {
    if (window.MH && window.MH.toast) window.MH.toast({ type: 'warning', title: 'Không có quyền', message: 'Strategy Board chỉ dành cho Giám sát hệ thống và Lead.' });
    setTimeout(function () { location.replace(user.role === 'client' ? 'client-dashboard.html' : 'dashboard.html'); }, 900);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  const store = (window.MH && window.MH.store) || null;

  /* Demo seed (CHỈ khi Supabase TẮT). */
  (function seedMock() {
    if (window.MH && window.MH.supabaseEnabled) return;
    if (window.MH_MOCK_LEAD_TASKS) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('mh-lead-tasks') || 'null'); } catch (e) {}
    if (saved && saved.length) { window.MH_MOCK_LEAD_TASKS = saved; return; }
    const iso = function (d) { return new Date(d).toISOString(); };
    window.MH_MOCK_LEAD_TASKS = [
      { id: 'plan-demo-1', title: 'Kế hoạch nội dung Fanpage tháng 7', description: 'Lên lịch 12 bài viết + 4 reel cho fanpage CB Centres, bám sự kiện tuyển sinh.', assigned_lead: 'lead_content', status: 'in_progress', lead_status: { lead_content: 'submitted' }, lead_submissions: { lead_content: { kind: 'plan', link: 'https://docs.google.com/document/d/demo-content-plan', note: 'Bản kế hoạch nội dung tháng 7, nhờ anh duyệt.', submitted_at: iso('2026-06-14'), round: 1 } }, checklist: [{ id: 'c1', text: 'Lên outline 12 bài', done: true }, { id: 'c2', text: 'Viết 4 kịch bản reel', done: false }, { id: 'c3', text: 'Duyệt nội dung tuần 1', done: false }], priority: 2, deadline: '2026-06-30', attachment_url: 'https://drive.google.com/file/d/demo-plan-content', attachment_name: 'Brief-Content-T7.pdf', created_by: null, created_at: iso('2026-06-10'), updated_at: iso('2026-06-14') },
      { id: 'plan-demo-2', title: 'Bộ ảnh + video khai giảng CB Mekong', description: 'Phối hợp ekip quay/chụp buổi khai giảng, output album + 1 video 60s.', assigned_lead: 'lead_media', status: 'pending', lead_status: { lead_media: 'pending' }, checklist: [], priority: 3, deadline: '2026-06-22', created_by: null, created_at: iso('2026-06-12'), updated_at: iso('2026-06-12') },
      { id: 'plan-demo-3', title: 'Chiến dịch tuyển sinh Q3 (Media + Content)', description: 'Phối hợp 2 team: Content lên thông điệp + Media sản xuất ấn phẩm/clip cho chiến dịch tuyển sinh quý 3.', assigned_lead: 'both', status: 'in_progress', lead_status: { lead_media: 'pending', lead_content: 'in_progress' }, checklist: [{ id: 'c1', text: 'Chốt key message', done: true }, { id: 'c2', text: 'Storyboard clip', done: false }], priority: 3, deadline: '2026-07-15', created_by: null, created_at: iso('2026-06-15'), updated_at: iso('2026-06-16') },
      { id: 'plan-demo-4', title: 'Chuẩn hóa thư viện template thiết kế', description: 'Rà soát + gom template Canva/PSD dùng chung cho team Media.', assigned_lead: 'lead_media', status: 'completed', lead_status: { lead_media: 'completed' }, checklist: [], priority: 1, deadline: '2026-06-08', created_by: null, created_at: iso('2026-05-28'), updated_at: iso('2026-06-08') },
      { id: 'plan-demo-5', title: 'Đề xuất: Series TikTok review khóa học', description: 'Content đề xuất làm series 6 video TikTok review trải nghiệm học viên — cần Media hỗ trợ quay.', assigned_lead: 'lead_content', origin: 'lead', approval: 'proposed', informed_leads: ['lead_media'], status: 'pending', lead_status: { lead_content: 'pending' }, checklist: [], priority: 2, deadline: '2026-07-20', created_by: null, created_at: iso('2026-06-16'), updated_at: iso('2026-06-16') }
    ];
  })();

  const isAdmin = user.role === 'admin';
  const isSupervisor = user.role === 'system_supervisor';
  const canManage = isAdmin || isSupervisor;
  const myLead = user.role === 'lead_media' ? 'lead_media' : user.role === 'lead_content' ? 'lead_content' : null;

  /* ---------- Labels + status model ---------- */
  const LEAD_LABEL = { lead_media: 'Lead Media', lead_content: 'Lead Content', both: 'Media + Content' };
  const LEAD_SHORT = { lead_media: 'Media', lead_content: 'Content' };
  const LEAD_CLS = { lead_media: 'lt-lead--media', lead_content: 'lt-lead--content', both: 'lt-lead--both' };
  const STATUS_LABEL = { pending: 'Chờ xử lý', in_progress: 'Đang thực hiện', submitted: 'Chờ duyệt', revision: 'Cần chỉnh', completed: 'Hoàn thành', archived: 'Lưu trữ', proposed: 'Đề xuất', declined: 'Từ chối' };
  const LEAD_MANUAL = ['pending', 'in_progress'];                              // Lead tự set tay (KHÔNG completed — chống tự duyệt; submitted qua "Nộp duyệt")
  const LANE_SUP = ['pending', 'in_progress', 'submitted', 'revision', 'completed']; // supervisor override 1 lane
  const BOARD_COLS = ['pending', 'in_progress', 'submitted', 'completed'];     // cột Board (revision gộp vào in_progress)
  const SUBMIT_KIND = { plan: 'Kế hoạch', product: 'Sản phẩm' };
  const PRIO = { 1: { label: 'Thường', cls: 'p--normal' }, 2: { label: 'Cao', cls: 'p--urgent' }, 3: { label: 'Khẩn', cls: 'p--critical' } };

  function leadsOf(assigned) { return assigned === 'both' ? ['lead_media', 'lead_content'] : [assigned]; }
  function informedOf(p) { return (p && Array.isArray(p.informed_leads)) ? p.informed_leads : []; }
  function otherLead(lead) { return lead === 'lead_media' ? 'lead_content' : 'lead_media'; }
  // Lead thấy plan: chịu trách nhiệm (assigned/both) HOẶC được mention nắm thông tin.
  function leadCanSee(p, lead) { return p.assigned_lead === lead || p.assigned_lead === 'both' || informedOf(p).indexOf(lead) >= 0; }
  function isResponsible(p, lead) { return p.assigned_lead === lead || p.assigned_lead === 'both'; }
  function leadStatusOf(p, lead) { return (p && p.lead_status && p.lead_status[lead]) || 'pending'; }
  function laneSub(p, lead) { return (p && p.lead_submissions && p.lead_submissions[lead]) || null; }
  // status cột (CHECK 4 trạng thái): submitted/revision coi là active → in_progress.
  function deriveOverall(p) {
    if (!p) return 'pending';
    if (p.status === 'archived') return 'archived';
    const ls = leadsOf(p.assigned_lead).map(function (l) { return leadStatusOf(p, l); });
    if (ls.length && ls.every(function (s) { return s === 'completed'; })) return 'completed';
    if (ls.some(function (s) { return s !== 'pending'; })) return 'in_progress';
    return 'pending';
  }
  // status hiển thị (badge/board): Đề xuất / Từ chối / Chờ duyệt / Cần chỉnh / …
  function displayOverall(p) {
    if (!p) return 'pending';
    if (p.approval === 'proposed') return 'proposed';
    if (p.approval === 'declined') return 'declined';
    if (p.status === 'archived') return 'archived';
    const ls = leadsOf(p.assigned_lead).map(function (l) { return leadStatusOf(p, l); });
    if (ls.length && ls.every(function (s) { return s === 'completed'; })) return 'completed';
    if (ls.some(function (s) { return s === 'revision'; })) return 'revision';
    if (ls.some(function (s) { return s === 'submitted'; })) return 'submitted';
    if (ls.some(function (s) { return s === 'in_progress' || s === 'completed'; })) return 'in_progress';
    return 'pending';
  }
  function boardColOf(p) { const d = displayOverall(p); if (d === 'revision') return 'in_progress'; return BOARD_COLS.indexOf(d) >= 0 ? d : null; }
  function progressOf(p) {
    const c = (p && p.checklist) || [];
    if (!c.length) return null;
    const d = c.filter(function (i) { return i && i.done; }).length;
    return Math.round((d / c.length) * 100);
  }

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function toast(t, ti, m) { if (window.MH && window.MH.toast) window.MH.toast({ type: t, title: ti, message: m }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function prioOf(p) { return PRIO[Number(p)] || PRIO[1]; }
  function leadLabel(l) { return LEAD_LABEL[l] || l || '—'; }
  function statusLabel(s) { return STATUS_LABEL[s] || s || '—'; }
  function todayYmd() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parseYmd(s) { if (!s) return null; const m = String(s).slice(0, 10).split('-'); if (m.length !== 3) return null; const d = new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2])); d.setHours(0, 0, 0, 0); return isNaN(d.getTime()) ? null : d; }
  function fmtDate(s) { const d = parseYmd(s); if (!d) return '—'; return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  function fmtDT(s) { if (!s) return '—'; const d = new Date(s); if (isNaN(d.getTime())) return '—'; return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function isOverdue(p) { if (!p || !p.deadline) return false; const ov = deriveOverall(p); if (ov === 'completed' || ov === 'archived') return false; const d = parseYmd(p.deadline); return !!d && d < todayYmd(); }
  function daysLeft(p) { const d = parseYmd(p && p.deadline); if (!d) return null; return Math.round((d - todayYmd()) / 86400000); }
  function uid(pfx) { return (pfx || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // Inline SVG icons (Lucide-style, đồng nhất design system — KHÔNG dùng emoji structural).
  const ICONS = {
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    clip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    undo: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
  };
  function ic(name, size) { size = size || 14; return '<svg class="sp-ic" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }

  /* ---------- State ---------- */
  let PLANS = [];
  let USERS_BY_ID = {};
  let me = null;
  let view = 'list';       // 'list' | 'board'
  let openPlanId = null;   // plan đang mở drawer
  let remindedOverdue = false;

  /* ---------- Chip + head ---------- */
  (function initChip() {
    const n = $('hpc-name'); if (n) n.textContent = user.name || 'User';
    const a = $('hpc-avatar'); if (a) a.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
    const r = $('hpc-role-badge'); if (r) {
      const lbl = window.MH && window.MH.roleLabel ? window.MH.roleLabel(user.role)
        : (user.role === 'lead_media' ? 'Lead Media' : user.role === 'lead_content' ? 'Lead Content'
          : user.role === 'system_supervisor' ? 'Giám sát hệ thống' : user.role.charAt(0).toUpperCase() + user.role.slice(1));
      r.textContent = lbl; r.className = 'role-badge r--' + user.role + ' header-pc-role';
    }
    const lo = $('logout-btn'); if (lo) lo.addEventListener('click', function () { localStorage.removeItem('mh-user'); toast('info', 'Đã đăng xuất'); setTimeout(function () { location.replace('login.html'); }, 400); });
  })();
  (function tuneHead() {
    const sub = $('sp-subtitle');
    if (sub && myLead) sub.innerHTML = 'Kế hoạch <strong>' + esc(leadLabel(myLead)) + '</strong> được giao cho bạn. <span class="text-xs muted">Bạn cập nhật tiến độ phần mình + trao đổi; nội dung do Giám sát hệ thống quản lý.</span>';
    const newBtn = $('sp-new-btn');
    if (newBtn && (canManage || myLead)) { newBtn.hidden = false; if (myLead) newBtn.innerHTML = newBtn.innerHTML.replace('Tạo kế hoạch', 'Đề xuất kế hoạch'); }
    if (myLead) {
      const fl = $('sp-filter-lead'); if (fl) fl.style.display = 'none';
      // Form = chế độ ĐỀ XUẤT: khóa bucket về chính mình + hiện ô mention Lead kia.
      const fLead = $('sp-f-lead'); if (fLead) { fLead.value = myLead; fLead.disabled = true; }
      const sub = $('sp-f-submit'); if (sub) sub.textContent = 'Gửi đề xuất';
      const ft = document.querySelector('#sp-form-card .table-head h3'); if (ft) ft.textContent = 'Đề xuất kế hoạch';
      const inrow = $('sp-f-informed-row'); if (inrow) inrow.hidden = false;
      const inlbl = $('sp-f-informed-label'); if (inlbl) inlbl.textContent = 'Thông báo cho ' + leadLabel(otherLead(myLead)) + ' để nắm thông tin';
    }
    const note = $('sp-f-file-note');
    if (note && window.MH && !window.MH.supabaseEnabled) note.textContent = '(Demo chưa bật Supabase → chỉ lưu link, không upload file.)';
  })();

  /* ---------- Users (creator names) ---------- */
  async function loadUsers() {
    if (!store) return;
    try { const list = await store.users.list(); USERS_BY_ID = {}; (list || []).forEach(function (u) { if (u && u.id) USERS_BY_ID[u.id] = u.name || u.full_name || u.email; }); } catch (e) {}
  }
  function creatorName(p) {
    if (!p || !p.created_by) return '—';
    if (me && p.created_by === me.id) return user.name || 'Bạn';
    return USERS_BY_ID[p.created_by] || '—';
  }

  /* ---------- LOAD ---------- */
  async function load() {
    if (!store) { PLANS = []; render(); return; }
    try { me = await store.users.me(); } catch (e) { me = null; }
    await loadUsers();
    await silentReload();
    maybeRemindOverdue();
  }
  async function silentReload() {
    if (!store) return;
    let plans = [];
    try { plans = await store.leadTasks.list(); } catch (e) { console.warn('[planning] list', e); plans = []; }
    if (myLead) plans = plans.filter(function (p) { return leadCanSee(p, myLead); });
    PLANS = plans || [];
    render();
  }
  function maybeRemindOverdue() {
    if (remindedOverdue) return;
    const n = PLANS.filter(isOverdue).length;
    if (n > 0) { toast('warning', 'Có kế hoạch trễ hạn', n + ' kế hoạch đã quá deadline.'); }
    remindedOverdue = true;
  }

  /* ---------- RENDER ---------- */
  function filtered() {
    const q = ($('sp-search') && $('sp-search').value || '').trim().toLowerCase();
    const fLead = (canManage && $('sp-filter-lead')) ? $('sp-filter-lead').value : '';
    const fStatus = $('sp-filter-status') ? $('sp-filter-status').value : '';
    return PLANS.filter(function (p) {
      if (fLead && p.assigned_lead !== fLead) return false;
      if (fStatus && displayOverall(p) !== fStatus) return false;
      if (q) { const hay = (String(p.title || '') + ' ' + String(p.description || '')).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
      return true;
    }).sort(function (a, b) {
      const pa = Number(b.priority || 1) - Number(a.priority || 1); if (pa) return pa;
      const da = parseYmd(a.deadline), db = parseYmd(b.deadline);
      if (da && db && da - db) return da - db;
      if (da && !db) return -1; if (!da && db) return 1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  function renderStats() {
    const wrap = $('sp-stats'); if (!wrap) return;
    const total = PLANS.length;
    const media = PLANS.filter(function (p) { return p.assigned_lead === 'lead_media'; }).length;
    const content = PLANS.filter(function (p) { return p.assigned_lead === 'lead_content'; }).length;
    const both = PLANS.filter(function (p) { return p.assigned_lead === 'both'; }).length;
    const active = PLANS.filter(function (p) { return displayOverall(p) === 'in_progress'; }).length;
    const done = PLANS.filter(function (p) { return displayOverall(p) === 'completed'; }).length;
    const proposed = PLANS.filter(function (p) { return p.approval === 'proposed'; }).length;
    const overdue = PLANS.filter(isOverdue).length;
    const cards = myLead
      ? [['Tổng', total, ''], ['Đang thực hiện', active, ''], ['Hoàn thành', done, ''], ['Trễ hạn', overdue, overdue ? 'is-danger' : '']]
      : [['Tổng kế hoạch', total, ''], ['Đề xuất chờ duyệt', proposed, proposed ? 'is-warn' : ''], ['Lead Media', media, 'is-media'], ['Lead Content', content, 'is-content'], ['Cả 2 Lead', both, ''], ['Hoàn thành', done, ''], ['Trễ hạn', overdue, overdue ? 'is-danger' : '']];
    wrap.innerHTML = cards.map(function (c) { return '<div class="cwb-stat sp-stat ' + c[2] + '"><div class="cwb-stat-val">' + c[1] + '</div><div class="cwb-stat-label">' + esc(c[0]) + '</div></div>'; }).join('');
  }

  function statusBadge(s) { return '<span class="tb-status lt-st--' + esc(s) + '">' + esc(statusLabel(s)) + '</span>'; }
  function leadBadge(l) { return '<span class="lt-lead-badge ' + (LEAD_CLS[l] || '') + '">' + esc(leadLabel(l)) + '</span>'; }
  function prioPill(p) { const pr = prioOf(p); return '<span class="priority-pill ' + pr.cls + '"><span class="dot"></span>' + esc(pr.label) + '</span>'; }
  // Per-lead status mini-chips (cho plan 'both' hiển thị tiến độ từng nhánh).
  function perLeadChips(p) {
    if (p.assigned_lead !== 'both') return '';
    return '<div class="sp-perlead">' + leadsOf('both').map(function (l) {
      const st = leadStatusOf(p, l);
      return '<span class="sp-pl-chip sp-pl--' + st + '">' + esc(LEAD_SHORT[l]) + ': ' + esc(statusLabel(st)) + '</span>';
    }).join('') + '</div>';
  }

  function render() {
    renderStats();
    const rows = filtered();
    const info = $('sp-list-info'); if (info) info.textContent = rows.length + ' / ' + PLANS.length + ' kế hoạch';
    const listCard = $('sp-list-card'); const boardWrap = $('sp-board');
    if (listCard) listCard.hidden = view !== 'list';
    if (boardWrap) boardWrap.hidden = view !== 'board';
    if (view === 'board') renderBoard(rows); else renderTable(rows);
    document.querySelectorAll('.sp-view-chip').forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-view') === view); });
  }

  function rowHtml(p) {
    const od = isOverdue(p); const ov = displayOverall(p); const prog = progressOf(p);
    return '<tr data-plan-id="' + esc(p.id) + '" class="sp-row' + (od ? ' sp-row--overdue' : '') + '">'
      + '<td><div class="sp-cell-title">' + esc(p.title || '—') + (p.attachment_path || p.attachment_url ? ' <span class="sp-clip" title="Có đính kèm">' + ic('clip', 13) + '</span>' : '') + '</div>'
      + (p.description ? '<div class="sp-cell-desc">' + esc(String(p.description).slice(0, 90)) + (String(p.description).length > 90 ? '…' : '') + '</div>' : '')
      + (prog != null ? '<div class="sp-mini-prog"><i style="width:' + prog + '%"></i></div>' : '')
      + '</td>'
      + '<td>' + leadBadge(p.assigned_lead) + perLeadChips(p) + '</td>'
      + '<td>' + statusBadge(ov) + '</td>'
      + '<td>' + prioPill(p.priority) + '</td>'
      + '<td>' + (p.deadline ? '<span class="' + (od ? 'sp-overdue-text' : '') + '">' + fmtDate(p.deadline) + '</span>' : '<span class="muted">—</span>') + '</td>'
      + '<td><span class="text-xs muted">' + esc(creatorName(p)) + '</span></td>'
      + '<td class="sp-row-act"><button class="btn btn-ghost btn-sm" data-open="' + esc(p.id) + '">Mở</button></td>'
      + '</tr>';
  }
  function renderTable(rows) {
    const tbody = $('sp-tbody'); const empty = $('sp-empty');
    if (empty) empty.hidden = rows.length !== 0;
    if (tbody) tbody.innerHTML = rows.map(rowHtml).join('');
  }
  function renderBoard(rows) {
    const wrap = $('sp-board'); if (!wrap) return;
    wrap.innerHTML = BOARD_COLS.map(function (col) {
      const items = rows.filter(function (p) { return boardColOf(p) === col; });
      const cards = items.map(function (p) {
        const od = isOverdue(p); const prog = progressOf(p);
        return '<div class="sp-card' + (od ? ' sp-card--overdue' : '') + '" data-open="' + esc(p.id) + '">'
          + '<div class="sp-card-top">' + leadBadge(p.assigned_lead) + prioPill(p.priority) + '</div>'
          + '<div class="sp-card-title">' + esc(p.title || '—') + '</div>'
          + perLeadChips(p)
          + (prog != null ? '<div class="sp-mini-prog"><i style="width:' + prog + '%"></i></div>' : '')
          + '<div class="sp-card-foot"><span class="text-xs ' + (od ? 'sp-overdue-text' : 'muted') + '">' + (p.deadline ? fmtDate(p.deadline) : '—') + '</span>' + (p.attachment_path || p.attachment_url ? '<span class="sp-clip">' + ic('clip', 13) + '</span>' : '') + '</div>'
          + '</div>';
      }).join('') || '<div class="sp-col-empty muted text-xs">Không có kế hoạch</div>';
      return '<div class="sp-col sp-col--' + col + '"><div class="sp-col-head"><span>' + esc(statusLabel(col)) + '</span><span class="sp-col-count">' + items.length + '</span></div><div class="sp-col-body">' + cards + '</div></div>';
    }).join('');
  }

  /* ---------- DRAWER (workspace) ---------- */
  async function resolveAttachmentUrl(p) {
    if (p && p.attachment_path && store && store.files) { try { return await store.files.signedUrl('plan-files', p.attachment_path, 3600); } catch (e) { return null; } }
    if (p && p.attachment_url) return p.attachment_url;
    return null;
  }
  function attachmentLinkHtml(url, name) {
    return '<a class="sp-attach-link" href="' + esc(url) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' + esc(name || 'File kế hoạch') + '</a>';
  }
  function statusSelectHtml(idAttr, current, opts) {
    return '<select class="select" id="' + idAttr + '">' + opts.map(function (s) { return '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' + esc(statusLabel(s)) + '</option>'; }).join('') + '</select>';
  }

  // Lane card: tiến độ + cổng duyệt (Nộp duyệt / Duyệt / Trả chỉnh) cho 1 Lead.
  function laneCardHtml(p, lead) {
    const st = leadStatusOf(p, lead);
    const sub = laneSub(p, lead);
    const isMine = myLead === lead;
    let h = '<div class="sp-lane sp-lane--' + st + '" data-lead="' + lead + '">';
    h += '<div class="sp-lane-head"><span class="lt-lead-badge ' + (LEAD_CLS[lead] || '') + '">' + esc(LEAD_SHORT[lead] || leadLabel(lead)) + '</span><span class="tb-status lt-st--' + st + '">' + esc(statusLabel(st)) + '</span></div>';
    // Hồ sơ nộp
    if (sub) {
      h += '<div class="sp-sub"><div class="sp-sub-head">Hồ sơ nộp · ' + esc(SUBMIT_KIND[sub.kind] || sub.kind || '') + (sub.round ? ' · vòng ' + sub.round : '') + ' <span class="muted text-xs">' + (sub.submitted_at ? fmtDT(sub.submitted_at) : '') + '</span></div>';
      if (sub.file_path) h += '<div class="sp-sub-file muted text-xs" data-sub-file="' + lead + '">Đang lấy link file…</div>';
      if (sub.link) h += '<a class="sp-attach-link" href="' + esc(sub.link) + '" target="_blank" rel="noopener">' + esc(sub.link) + '</a>';
      if (sub.note) h += '<div class="sp-sub-note">' + esc(sub.note) + '</div>';
      if (sub.review_note && st === 'revision') h += '<div class="sp-revnote">' + ic('undo', 13) + ' <span><b>Trả chỉnh:</b> ' + esc(sub.review_note) + '</span></div>';
      h += '</div>';
    } else if (st === 'revision') { h += '<div class="sp-revnote">Cần chỉnh sửa — nộp lại.</div>'; }
    // Controls
    h += '<div class="sp-lane-ctl">';
    if (canManage) {
      h += statusSelectHtml('sp-ls-' + lead, st, LANE_SUP);
      if (st === 'submitted') h += '<button class="btn btn-success btn-sm" data-act="approve" data-lead="' + lead + '" type="button">Duyệt</button><button class="btn btn-warning btn-sm" data-act="reject" data-lead="' + lead + '" type="button">Trả chỉnh</button>';
    } else if (isMine) {
      if (st === 'pending' || st === 'in_progress') {
        h += statusSelectHtml('sp-ls-' + lead, st, LEAD_MANUAL) + '<button class="btn btn-primary btn-sm" data-act="submit" data-lead="' + lead + '" type="button">Nộp duyệt</button>';
      } else if (st === 'revision') {
        h += '<button class="btn btn-primary btn-sm" data-act="submit" data-lead="' + lead + '" type="button">Nộp lại</button>';
      } else if (st === 'submitted') {
        h += '<span class="muted text-xs">Đã nộp · chờ Giám sát duyệt.</span>';
      } else if (st === 'completed') {
        h += '<span class="sp-approved text-xs">' + ic('check', 13) + ' Đã được duyệt</span>';
      }
    } else {
      h += '<span class="muted text-xs">Lane của ' + esc(LEAD_SHORT[lead] || lead) + '</span>';
    }
    h += '</div>';
    // Form nộp duyệt (Lead) — ẩn, toggle bằng nút "Nộp duyệt/Nộp lại".
    if (isMine && (st === 'pending' || st === 'in_progress' || st === 'revision')) {
      h += '<div class="sp-submit-form" data-sf="' + lead + '" hidden>'
        + '<select class="select" data-sf-kind="' + lead + '"><option value="product">Sản phẩm</option><option value="plan">Kế hoạch</option></select>'
        + '<input class="input" type="url" data-sf-link="' + lead + '" placeholder="Link sản phẩm / kế hoạch (Drive/PDF)" />'
        + '<input class="input" type="file" data-sf-file="' + lead + '" accept=".pdf,application/pdf,image/*,.doc,.docx,.ppt,.pptx" />'
        + '<textarea class="textarea" data-sf-note="' + lead + '" rows="2" placeholder="Ghi chú cho Giám sát…"></textarea>'
        + '<button class="btn btn-primary btn-sm" data-act="do-submit" data-lead="' + lead + '" type="button">Gửi duyệt</button>'
        + '</div>';
    }
    // Form trả chỉnh (Supervisor) — ẩn, toggle bằng nút "Trả chỉnh".
    if (canManage && st === 'submitted') {
      h += '<div class="sp-reject-form" data-rf="' + lead + '" hidden><textarea class="textarea" data-rf-note="' + lead + '" rows="2" placeholder="Lý do trả chỉnh…"></textarea><button class="btn btn-warning btn-sm" data-act="do-reject" data-lead="' + lead + '" type="button">Gửi trả chỉnh</button></div>';
    }
    h += '</div>';
    return h;
  }

  async function openDrawer(id) {
    const p = PLANS.find(function (x) { return x.id === id; });
    if (!p) { toast('warning', 'Không tìm thấy', 'Kế hoạch không còn tồn tại.'); return; }
    openPlanId = id;
    $('sp-d-title').textContent = p.title || '—';
    const leadEl = $('sp-d-lead'); leadEl.textContent = leadLabel(p.assigned_lead); leadEl.className = 'lt-lead-badge ' + (LEAD_CLS[p.assigned_lead] || '');
    const ov = displayOverall(p);
    const stEl = $('sp-d-status'); stEl.textContent = statusLabel(ov); stEl.className = 'tb-status lt-st--' + ov;
    const prEl = $('sp-d-priority'); const pr = prioOf(p.priority); prEl.className = 'priority-pill ' + pr.cls; prEl.innerHTML = '<span class="dot"></span>' + esc(pr.label);

    const attUrl = await resolveAttachmentUrl(p);
    const attView = attUrl ? attachmentLinkHtml(attUrl, p.attachment_name || p.attachment_url || 'File kế hoạch')
      : (p.attachment_path ? '<span class="muted text-xs">Có file đính kèm (không tạo được link tải).</span>' : '');

    const canParticipate = canManage || isResponsible(p, myLead); // informed-only Lead = chỉ xem
    const body = $('sp-drawer-body');
    let html = '<div class="sp-ws">';

    // Banner đề xuất (Lead → Supervisor duyệt)
    if (p.approval === 'proposed') {
      const cn = creatorName(p);
      html += '<div class="sp-propose-banner"><div class="sp-pb-info">' + ic('clipboard', 18) + '<div class="sp-pb-txt"><b>Đề xuất kế hoạch' + (cn && cn !== '—' ? ' · ' + esc(cn) : '') + '</b><span class="text-xs muted">Chờ Giám sát duyệt</span></div></div>'
        + (canManage ? '<div class="sp-pb-act"><button class="btn btn-success btn-sm" id="sp-approve-proposal" type="button">Duyệt đề xuất</button><button class="btn btn-danger-soft btn-sm" id="sp-decline-proposal" type="button">Từ chối</button></div>' : '<span class="text-xs muted">Đã gửi, chờ duyệt.</span>')
        + '</div>';
    } else if (p.approval === 'declined') {
      html += '<div class="sp-propose-banner sp-pb-declined"><div class="sp-pb-info">' + ic('x', 18) + '<div class="sp-pb-txt"><b>Đề xuất đã bị từ chối</b></div></div>'
        + (canManage ? '<div class="sp-pb-act"><button class="btn btn-ghost btn-sm" id="sp-approve-proposal" type="button">Khôi phục &amp; duyệt</button></div>' : '') + '</div>';
    } else if (informedOf(p).indexOf(myLead) >= 0 && !isResponsible(p, myLead)) {
      html += '<div class="sp-propose-banner sp-pb-informed"><div class="sp-pb-info">' + ic('eye', 18) + '<div class="sp-pb-txt"><b>Bạn được mention để nắm thông tin</b><span class="text-xs muted">Chỉ xem · không chịu trách nhiệm</span></div></div></div>';
    }

    if (canManage) {
      html += '<section class="sp-ws-sec"><h4>Nội dung kế hoạch</h4>'
        + '<label class="field"><span class="field-label">Tiêu đề <em class="req">*</em></span><input class="input" id="sp-e-title" maxlength="160" value="' + esc(p.title || '') + '" /></label>'
        + '<label class="field"><span class="field-label">Mô tả</span><textarea class="textarea" id="sp-e-desc" rows="3">' + esc(p.description || '') + '</textarea></label>'
        + '<div class="sp-edit-grid">'
        + '<label class="field"><span class="field-label">Giao cho Lead</span><select class="select" id="sp-e-lead">'
        + '<option value="lead_media"' + (p.assigned_lead === 'lead_media' ? ' selected' : '') + '>Lead Media</option>'
        + '<option value="lead_content"' + (p.assigned_lead === 'lead_content' ? ' selected' : '') + '>Lead Content</option>'
        + '<option value="both"' + (p.assigned_lead === 'both' ? ' selected' : '') + '>Cả 2 Lead (Media + Content)</option></select></label>'
        + '<label class="field"><span class="field-label">Ưu tiên</span><select class="select" id="sp-e-priority">'
        + '<option value="1"' + (Number(p.priority) === 1 ? ' selected' : '') + '>Thường</option>'
        + '<option value="2"' + (Number(p.priority) === 2 ? ' selected' : '') + '>Cao</option>'
        + '<option value="3"' + (Number(p.priority) === 3 ? ' selected' : '') + '>Khẩn</option></select></label>'
        + '<label class="field"><span class="field-label">Deadline</span><input class="input" type="date" id="sp-e-deadline" value="' + esc(p.deadline ? String(p.deadline).slice(0, 10) : '') + '" /></label>'
        + '<label class="field"><span class="field-label">Lưu trữ</span><label class="sp-archive"><input type="checkbox" id="sp-e-archived"' + (p.status === 'archived' ? ' checked' : '') + ' /> Đánh dấu lưu trữ</label></label>'
        + '</div>'
        + '<div class="sp-attach"><span class="field-label">File / link kế hoạch</span>'
        + '<div class="sp-attach-current">' + (attView || '<span class="muted text-xs">Chưa có file/link.</span>') + '</div>'
        + '<input class="input" type="file" id="sp-e-file" accept=".pdf,application/pdf,image/*,.doc,.docx,.ppt,.pptx" />'
        + '<input class="input" type="url" id="sp-e-link" placeholder="… hoặc link (Drive/PDF)" value="' + esc(p.attachment_url || '') + '" /></div>'
        + '<div class="sp-meta-row"><span class="muted text-xs">Người tạo: ' + esc(creatorName(p)) + '</span><span class="muted text-xs">Cập nhật: ' + (p.updated_at ? fmtDT(p.updated_at) : '—') + '</span></div>'
        + '<div class="sp-edit-actions"><button class="btn btn-danger-soft btn-sm" id="sp-e-delete" type="button">Xóa kế hoạch</button><button class="btn btn-primary" id="sp-e-save" type="button">Lưu thay đổi</button></div>'
        + '</section>';
    } else {
      html += '<section class="sp-ws-sec">'
        + (p.description ? '<div class="sp-view-desc">' + esc(p.description) + '</div>' : '<div class="sp-view-desc muted">Không có mô tả.</div>')
        + '<div class="detail-row"><span class="detail-dt">Giao cho</span><span class="detail-dd">' + esc(leadLabel(p.assigned_lead)) + '</span></div>'
        + '<div class="detail-row"><span class="detail-dt">Ưu tiên</span><span class="detail-dd">' + esc(prioOf(p.priority).label) + '</span></div>'
        + '<div class="detail-row"><span class="detail-dt">Deadline</span><span class="detail-dd' + (isOverdue(p) ? ' sp-overdue-text' : '') + '">' + (p.deadline ? fmtDate(p.deadline) : '—') + '</span></div>'
        + '<div class="detail-row"><span class="detail-dt">File kế hoạch</span><span class="detail-dd">' + (attView || '<span class="muted">—</span>') + '</span></div>'
        + '<div class="detail-row"><span class="detail-dt">Người giao</span><span class="detail-dd">' + esc(creatorName(p)) + '</span></div>'
        + '</section>';
    }

    // ----- Tiến độ + Duyệt từng Lane -----
    html += '<section class="sp-ws-sec"><h4>Tiến độ &amp; duyệt từng Lead</h4><div class="sp-leadstatus" id="sp-leadstatus">'
      + leadsOf(p.assigned_lead).map(function (l) { return laneCardHtml(p, l); }).join('')
      + '</div>'
      + (canParticipate ? '<button class="btn btn-ghost btn-sm" id="sp-ls-save" type="button">Lưu trạng thái thủ công</button>' : '')
      + '</section>';

    // ----- Checklist / progress -----
    const prog = progressOf(p);
    html += '<section class="sp-ws-sec"><h4>Checklist đầu việc' + (prog != null ? ' <span class="sp-prog-pct">' + prog + '%</span>' : '') + '</h4>'
      + (prog != null ? '<div class="sp-prog"><i style="width:' + prog + '%"></i></div>' : '')
      + '<ul class="sp-check" id="sp-check">' + checklistItemsHtml(p) + '</ul>'
      + (canManage ? '<div class="sp-check-add"><input class="input" id="sp-check-new" placeholder="Thêm đầu việc…" /><button class="btn btn-ghost btn-sm" id="sp-check-add-btn" type="button">+ Thêm</button></div>' : '')
      + '</section>';

    // ----- Trao đổi + hoạt động -----
    html += '<section class="sp-ws-sec"><h4>Trao đổi &amp; hoạt động</h4>'
      + '<div class="sp-timeline" id="sp-timeline"><div class="muted text-xs">Đang tải…</div></div>'
      + (canParticipate ? '<div class="sp-comment-box"><textarea class="textarea" id="sp-comment" rows="2" placeholder="Nhập trao đổi với ' + (myLead ? 'Giám sát hệ thống' : 'Lead') + '…"></textarea><button class="btn btn-primary btn-sm" id="sp-comment-send" type="button">Gửi</button></div>' : '<p class="text-xs muted">Bạn được mention để nắm thông tin — chỉ xem.</p>')
      + '</section>';

    html += '</div>';
    body.innerHTML = html;

    // Wire
    if (canManage) {
      $('sp-e-save').addEventListener('click', function () { saveManage(p.id); });
      $('sp-e-delete').addEventListener('click', function () { removePlan(p.id); });
      if ($('sp-check-add-btn')) $('sp-check-add-btn').addEventListener('click', function () { addChecklistItem(p.id); });
      if ($('sp-approve-proposal')) $('sp-approve-proposal').addEventListener('click', function () { approveProposal(p.id); });
      if ($('sp-decline-proposal')) $('sp-decline-proposal').addEventListener('click', function () { declineProposal(p.id); });
    }
    if ($('sp-ls-save')) $('sp-ls-save').addEventListener('click', function () { saveLeadStatus(p.id); });
    // Cổng duyệt + nộp (delegated): toggle form / gửi.
    const ls = $('sp-leadstatus');
    if (ls) ls.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const lead = b.getAttribute('data-lead'); const act = b.getAttribute('data-act');
      if (act === 'submit') { const f = ls.querySelector('[data-sf="' + lead + '"]'); if (f) f.hidden = !f.hidden; }
      else if (act === 'do-submit') { submitLane(p.id, lead); }
      else if (act === 'approve') { approveLane(p.id, lead); }
      else if (act === 'reject') { const f = ls.querySelector('[data-rf="' + lead + '"]'); if (f) f.hidden = !f.hidden; }
      else if (act === 'do-reject') { rejectLane(p.id, lead); }
    });
    if ($('sp-check')) $('sp-check').addEventListener('change', function (ev) { const cb = ev.target.closest('input[type="checkbox"][data-ci]'); if (cb) toggleChecklist(p.id, cb.getAttribute('data-ci'), cb.checked); });
    if ($('sp-check')) $('sp-check').addEventListener('click', function (ev) { const rm = ev.target.closest('[data-ci-del]'); if (rm) removeChecklistItem(p.id, rm.getAttribute('data-ci-del')); });
    if ($('sp-comment-send')) $('sp-comment-send').addEventListener('click', function () { sendComment(p.id); });

    // Resolve link tải file hồ sơ nộp (signed URL) cho từng lane.
    leadsOf(p.assigned_lead).forEach(async function (l) {
      const sub = laneSub(p, l); const el = ls && ls.querySelector('[data-sub-file="' + l + '"]');
      if (sub && sub.file_path && el) { try { const u = await resolveAttachmentUrl({ attachment_path: sub.file_path }); el.innerHTML = u ? attachmentLinkHtml(u, sub.file_name || 'File nộp') : ('File: ' + esc(sub.file_name || '')); } catch (e) { el.textContent = 'File: ' + (sub.file_name || ''); } }
    });

    showDrawer(true);
    loadTimeline(p.id);
  }

  function checklistItemsHtml(p) {
    const c = (p && p.checklist) || [];
    if (!c.length) return '<li class="muted text-xs">Chưa có đầu việc.</li>';
    return c.map(function (it) {
      return '<li class="sp-check-item' + (it.done ? ' is-done' : '') + '">'
        + '<label><input type="checkbox" data-ci="' + esc(it.id) + '"' + (it.done ? ' checked' : '') + ' /> <span>' + esc(it.text) + '</span></label>'
        + (canManage ? '<button class="sp-ci-del" data-ci-del="' + esc(it.id) + '" title="Xóa" aria-label="Xóa đầu việc" type="button">' + ic('x', 14) + '</button>' : '')
        + '</li>';
    }).join('');
  }

  function showDrawer(open) {
    const dr = $('sp-drawer'); const bd = $('sp-drawer-backdrop');
    if (!dr || !bd) return;
    if (!open) openPlanId = null;
    dr.classList.toggle('is-open', open);
    dr.setAttribute('aria-hidden', open ? 'false' : 'true');
    bd.classList.toggle('is-open', open);
  }

  /* ---------- TIMELINE / COMMENTS ---------- */
  async function loadTimeline(planId) {
    const box = $('sp-timeline'); if (!box) return;
    let items = [];
    try { items = await store.leadTaskComments.byPlan(planId); } catch (e) {}
    renderTimeline(items);
  }
  function renderTimeline(items) {
    const box = $('sp-timeline'); if (!box) return;
    if (!items || !items.length) { box.innerHTML = '<div class="muted text-xs">Chưa có trao đổi.</div>'; return; }
    box.innerHTML = items.map(function (c) {
      const who = esc(c.author_name || 'Hệ thống');
      const when = fmtDT(c.created_at);
      if (c.kind === 'comment') {
        return '<div class="sp-msg"><div class="sp-msg-head"><b>' + who + '</b> <span class="muted text-xs">' + when + '</span></div><div class="sp-msg-body">' + esc(c.body || '') + '</div></div>';
      }
      return '<div class="sp-event"><span class="sp-event-dot"></span><span class="sp-event-txt">' + who + ' · ' + esc(c.body || '') + '</span><span class="muted text-xs">' + when + '</span></div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  }
  async function logEvent(planId, body, kind) {
    try { await store.leadTaskComments.add(planId, { author_id: me ? me.id : null, author_name: user.name || (myLead ? leadLabel(myLead) : 'Giám sát'), author_role: user.role, kind: kind || 'system', body: body }); } catch (e) {}
  }
  async function sendComment(planId) {
    const ta = $('sp-comment'); const body = (ta && ta.value || '').trim();
    if (!body) { toast('warning', 'Trống', 'Nhập nội dung trao đổi.'); return; }
    const btn = $('sp-comment-send'); if (btn) btn.disabled = true;
    try {
      await store.leadTaskComments.add(planId, { author_id: me ? me.id : null, author_name: user.name || 'User', author_role: user.role, kind: 'comment', body: body });
      if (ta) ta.value = '';
      await loadTimeline(planId);
      notifyComment(planId, body);
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không gửi được trao đổi.'); }
    finally { if (btn) btn.disabled = false; }
  }

  /* ---------- CHECKLIST ---------- */
  async function persistChecklist(planId, checklist) {
    const idx = PLANS.findIndex(function (x) { return x.id === planId; });
    if (idx >= 0) PLANS[idx].checklist = checklist;
    try { await store.leadTasks.update(planId, { checklist: checklist }); } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không lưu được checklist.'); }
    if (idx >= 0) { const li = $('sp-check'); if (li) li.innerHTML = checklistItemsHtml(PLANS[idx]); updateDrawerProgress(PLANS[idx]); render(); }
  }
  function updateDrawerProgress(p) {
    const prog = progressOf(p);
    const pct = document.querySelector('.sp-prog-pct'); const bar = document.querySelector('.sp-ws-sec .sp-prog > i');
    if (pct) pct.textContent = prog != null ? prog + '%' : '';
    if (bar && prog != null) bar.style.width = prog + '%';
  }
  function getPlan(id) { return PLANS.find(function (x) { return x.id === id; }); }
  async function toggleChecklist(planId, ciId, done) {
    const p = getPlan(planId); if (!p) return;
    const list = (p.checklist || []).map(function (it) { return it.id === ciId ? Object.assign({}, it, { done: done, done_at: done ? new Date().toISOString() : null, done_by: done ? (user.name || '') : null }) : it; });
    await persistChecklist(planId, list);
  }
  async function addChecklistItem(planId) {
    const inp = $('sp-check-new'); const text = (inp && inp.value || '').trim();
    if (!text) return;
    const p = getPlan(planId); if (!p) return;
    const list = (p.checklist || []).concat([{ id: uid('ci'), text: text, done: false }]);
    if (inp) inp.value = '';
    await persistChecklist(planId, list);
  }
  async function removeChecklistItem(planId, ciId) {
    const p = getPlan(planId); if (!p) return;
    const list = (p.checklist || []).filter(function (it) { return it.id !== ciId; });
    await persistChecklist(planId, list);
  }

  /* ---------- MUTATIONS ---------- */
  async function uploadPlanFile(planId, file) {
    if (!store || !store.files || !planId || !file) return null;
    if (!(window.MH && window.MH.supabaseEnabled)) { toast('warning', 'Chưa lưu được file', 'Demo chưa bật Supabase — dùng ô link thay cho upload.'); return null; }
    try {
      const safe = (file.name || 'file').replace(/[^\w.\-]+/g, '_');
      const path = planId + '/' + Date.now() + '-' + safe;
      const res = await store.files.upload('plan-files', path, file, { contentType: file.type || 'application/octet-stream' });
      return { path: (res && res.path) || path, name: file.name || safe };
    } catch (e) { console.warn('[planning upload]', e); toast('error', 'Lỗi upload', 'Không tải được file lên Storage.'); return null; }
  }

  function applyLocal(planId, patch) { const idx = PLANS.findIndex(function (x) { return x.id === planId; }); if (idx >= 0) PLANS[idx] = Object.assign({}, PLANS[idx], patch); }
  function reopenDrawer(planId) { if (openPlanId === planId) openDrawer(planId); }
  function storedStatus(p, lead_status) { return (p.status === 'archived') ? 'archived' : deriveOverall(Object.assign({}, p, { lead_status: lead_status, status: 'active' })); }

  // Lead nộp duyệt (Kế hoạch/Sản phẩm) → lane 'submitted', notify Supervisor.
  async function submitLane(planId, lead) {
    const p = getPlan(planId); if (!p) return;
    const q = function (sel) { const ls = $('sp-leadstatus'); return ls ? ls.querySelector(sel) : null; };
    const kind = (q('[data-sf-kind="' + lead + '"]') || {}).value || 'product';
    const link = ((q('[data-sf-link="' + lead + '"]') || {}).value || '').trim();
    const note = ((q('[data-sf-note="' + lead + '"]') || {}).value || '').trim();
    const fileEl = q('[data-sf-file="' + lead + '"]');
    const hasFile = fileEl && fileEl.files && fileEl.files[0];
    if (!link && !hasFile) { toast('warning', 'Thiếu hồ sơ', 'Dán link hoặc chọn file để nộp.'); return; }
    const prev = laneSub(p, lead); const round = ((prev && prev.round) || 0) + 1;
    const sub = { kind: kind, link: link || null, note: note || null, submitted_at: new Date().toISOString(), round: round };
    if (hasFile) { const up = await uploadPlanFile(planId, fileEl.files[0]); if (up) { sub.file_path = up.path; sub.file_name = up.name; } }
    const lead_submissions = Object.assign({}, p.lead_submissions || {}); lead_submissions[lead] = sub;
    const lead_status = Object.assign({}, p.lead_status || {}); lead_status[lead] = 'submitted';
    const patch = { lead_submissions: lead_submissions, lead_status: lead_status, status: storedStatus(p, lead_status) };
    try {
      await store.leadTasks.update(planId, patch); applyLocal(planId, patch);
      logEvent(planId, (LEAD_SHORT[lead] || lead) + ' nộp ' + (SUBMIT_KIND[kind] || '') + ' (vòng ' + round + ')', 'submit');
      notifyUsers(['system_supervisor', 'admin'], planNotif('task_status_changed', 'Lead nộp duyệt', (LEAD_SHORT[lead] || '') + ' nộp ' + (SUBMIT_KIND[kind] || '') + ' — ' + (p.title || ''), planId));
      toast('success', '✓ Đã nộp', 'Đã gửi Giám sát duyệt.');
      reopenDrawer(planId); render(); loadTimeline(planId);
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không nộp được.'); }
  }

  // Supervisor duyệt 1 lane → 'completed', notify Lead.
  async function approveLane(planId, lead) {
    const p = getPlan(planId); if (!p) return;
    const lead_status = Object.assign({}, p.lead_status || {}); lead_status[lead] = 'completed';
    const patch = { lead_status: lead_status, status: storedStatus(p, lead_status) };
    try {
      await store.leadTasks.update(planId, patch); applyLocal(planId, patch);
      logEvent(planId, (LEAD_SHORT[lead] || lead) + ' được duyệt', 'review');
      notifyUsers([lead], planNotif('task_status_changed', 'Kế hoạch được duyệt', 'Đã duyệt ' + (LEAD_SHORT[lead] || '') + ' — ' + (p.title || ''), planId));
      toast('success', '✓ Đã duyệt', (LEAD_SHORT[lead] || '') + ' hoàn thành.');
      reopenDrawer(planId); render(); loadTimeline(planId);
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không duyệt được.'); }
  }

  // Supervisor trả chỉnh 1 lane → 'revision' + lý do, notify Lead.
  async function rejectLane(planId, lead) {
    const ls = $('sp-leadstatus'); const noteEl = ls && ls.querySelector('[data-rf-note="' + lead + '"]');
    const note = ((noteEl || {}).value || '').trim();
    if (!note) { toast('warning', 'Cần lý do', 'Nhập lý do trả chỉnh.'); return; }
    const p = getPlan(planId); if (!p) return;
    const lead_submissions = Object.assign({}, p.lead_submissions || {});
    if (lead_submissions[lead]) lead_submissions[lead] = Object.assign({}, lead_submissions[lead], { review_note: note });
    const lead_status = Object.assign({}, p.lead_status || {}); lead_status[lead] = 'revision';
    const patch = { lead_submissions: lead_submissions, lead_status: lead_status, status: storedStatus(p, lead_status) };
    try {
      await store.leadTasks.update(planId, patch); applyLocal(planId, patch);
      logEvent(planId, (LEAD_SHORT[lead] || lead) + ' bị trả chỉnh: ' + note, 'review');
      notifyUsers([lead], planNotif('task_status_changed', 'Kế hoạch cần chỉnh', 'Trả chỉnh ' + (LEAD_SHORT[lead] || '') + ': ' + note + ' — ' + (p.title || ''), planId));
      toast('info', 'Đã trả chỉnh', 'Đã gửi Lead chỉnh sửa.');
      reopenDrawer(planId); render(); loadTimeline(planId);
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không trả chỉnh được.'); }
  }

  // Supervisor duyệt ĐỀ XUẤT của Lead → plan chính thức (approval=approved).
  async function approveProposal(planId) {
    const p = getPlan(planId); if (!p) return;
    const patch = { approval: 'approved' };
    try {
      await store.leadTasks.update(planId, patch); applyLocal(planId, patch);
      logEvent(planId, 'Giám sát duyệt đề xuất', 'review');
      notifyUsers(leadsOf(p.assigned_lead).concat(informedOf(p)), planNotif('task_status_changed', 'Đề xuất được duyệt', 'Đã duyệt: ' + (p.title || ''), planId));
      toast('success', '✓ Đã duyệt đề xuất', 'Kế hoạch đã chính thức.');
      reopenDrawer(planId); render(); loadTimeline(planId);
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không duyệt được đề xuất.'); }
  }
  // Supervisor từ chối đề xuất → approval=declined (+ lý do tùy chọn).
  async function declineProposal(planId) {
    const p = getPlan(planId); if (!p) return;
    const note = (window.prompt('Lý do từ chối đề xuất (tùy chọn):', '') || '').trim();
    const patch = { approval: 'declined' };
    try {
      await store.leadTasks.update(planId, patch); applyLocal(planId, patch);
      logEvent(planId, 'Giám sát từ chối đề xuất' + (note ? ': ' + note : ''), 'review');
      notifyUsers(leadsOf(p.assigned_lead), planNotif('task_status_changed', 'Đề xuất bị từ chối', (note || 'Không nêu lý do') + ' — ' + (p.title || ''), planId));
      toast('info', 'Đã từ chối đề xuất', '');
      reopenDrawer(planId); render(); loadTimeline(planId);
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không từ chối được.'); }
  }

  // Supervisor/Admin lưu nội dung + per-lead status + archive.
  async function saveManage(id) {
    const p = getPlan(id); if (!p) return;
    const title = ($('sp-e-title').value || '').trim();
    if (!title) { toast('warning', 'Thiếu tiêu đề', 'Tiêu đề không được để trống.'); return; }
    const assigned = $('sp-e-lead').value;
    const archived = $('sp-e-archived') && $('sp-e-archived').checked;
    // gom per-lead status từ section "Tiến độ từng Lead" (select theo lead đang assigned)
    const lead_status = Object.assign({}, p.lead_status || {});
    leadsOf(assigned).forEach(function (l) { const sel = $('sp-ls-' + l); if (sel) lead_status[l] = sel.value; else if (!lead_status[l]) lead_status[l] = 'pending'; });
    const patch = {
      title: title,
      description: ($('sp-e-desc').value || '').trim() || null,
      assigned_lead: assigned,
      priority: Number($('sp-e-priority').value) || 1,
      deadline: $('sp-e-deadline').value || null,
      lead_status: lead_status
    };
    const linkEl = $('sp-e-link'); if (linkEl) patch.attachment_url = (linkEl.value || '').trim() || null;
    patch.status = archived ? 'archived' : deriveOverall(Object.assign({}, p, { assigned_lead: assigned, lead_status: lead_status, status: 'active' }));
    const btn = $('sp-e-save'); if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    try {
      const fileEl = $('sp-e-file');
      if (fileEl && fileEl.files && fileEl.files[0]) { const up = await uploadPlanFile(id, fileEl.files[0]); if (up) { patch.attachment_path = up.path; patch.attachment_name = up.name; } }
      const updated = await store.leadTasks.update(id, patch);
      const idx = PLANS.findIndex(function (x) { return x.id === id; });
      const newAssigned = assigned, oldAssigned = p.assigned_lead;
      if (idx >= 0) PLANS[idx] = Object.assign({}, PLANS[idx], updated || patch);
      logEvent(id, 'Cập nhật kế hoạch', 'system');
      // Reassign → báo lead mới được thêm vào.
      if (newAssigned !== oldAssigned) {
        const added = leadsOf(newAssigned).filter(function (l) { return leadsOf(oldAssigned).indexOf(l) < 0; });
        if (added.length) notifyUsers(added, planNotif('task_assigned', 'Kế hoạch được giao cho bạn', title, id));
      }
      toast('success', '✓ Đã lưu', 'Kế hoạch đã cập nhật.');
      showDrawer(false); render();
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không lưu được — kiểm tra kết nối / migration.'); if (btn) { btn.disabled = false; btn.textContent = 'Lưu thay đổi'; } }
  }

  // Lưu per-lead status (supervisor: mọi lead; lead: chỉ phần mình). Notify chiều còn lại.
  async function saveLeadStatus(id) {
    const p = getPlan(id); if (!p) return;
    const lead_status = Object.assign({}, p.lead_status || {});
    const changed = [];
    leadsOf(p.assigned_lead).forEach(function (l) {
      const sel = $('sp-ls-' + l); if (!sel) return;
      if ((lead_status[l] || 'pending') !== sel.value) changed.push({ lead: l, to: sel.value });
      lead_status[l] = sel.value;
    });
    if (!changed.length) { toast('info', 'Không đổi', 'Trạng thái chưa thay đổi.'); return; }
    const patch = { lead_status: lead_status, status: (p.status === 'archived' ? 'archived' : deriveOverall(Object.assign({}, p, { lead_status: lead_status, status: 'active' }))) };
    const btn = $('sp-ls-save'); if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    try {
      const updated = await store.leadTasks.update(id, patch);
      const idx = PLANS.findIndex(function (x) { return x.id === id; });
      if (idx >= 0) PLANS[idx] = Object.assign({}, PLANS[idx], updated || patch);
      for (let i = 0; i < changed.length; i++) {
        const ch = changed[i];
        logEvent(id, (LEAD_SHORT[ch.lead] || ch.lead) + ' → ' + statusLabel(ch.to), 'status');
        // Lead đổi → báo Supervisor+Admin; Supervisor đổi → báo Lead nhánh đó.
        if (myLead) notifyUsers(['system_supervisor', 'admin'], planNotif('task_status_changed', 'Lead cập nhật kế hoạch', (LEAD_SHORT[ch.lead] || '') + ': ' + statusLabel(ch.to) + ' — ' + (p.title || ''), id));
        else notifyUsers([ch.lead], planNotif('task_status_changed', 'Cập nhật tiến độ kế hoạch', statusLabel(ch.to) + ' — ' + (p.title || ''), id));
      }
      toast('success', '✓ Đã cập nhật', 'Tiến độ đã lưu.');
      const stEl = $('sp-d-status'); const ov = deriveOverall(PLANS[idx >= 0 ? idx : 0] || p); if (stEl) { stEl.textContent = statusLabel(ov); stEl.className = 'tb-status lt-st--' + ov; }
      loadTimeline(id); render();
    } catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không lưu được tiến độ.'); if (btn) { btn.disabled = false; btn.textContent = 'Lưu tiến độ'; } }
  }

  async function removePlan(id) {
    if (!window.confirm('Xóa kế hoạch này? Hành động không thể hoàn tác.')) return;
    try { await store.leadTasks.delete(id); PLANS = PLANS.filter(function (x) { return x.id !== id; }); toast('info', 'Đã xóa', 'Kế hoạch đã được xóa.'); showDrawer(false); render(); }
    catch (e) { console.warn(e); toast('error', 'Lỗi', 'Không xóa được kế hoạch.'); }
  }

  function planNotif(type, title, message, id) {
    return { type: type, title: title, message: message || '', link: 'supervisor-planning.html?id=' + id, related_entity_type: 'lead_task', related_entity_id: id };
  }
  async function notifyUsers(roles, payload) {
    if (!store || !store.notifications) return;
    try {
      for (let r = 0; r < roles.length; r++) {
        const us = await store.users.list({ role: roles[r], status: 'active' });
        for (let i = 0; i < (us || []).length; i++) {
          if (me && us[i].id === me.id) continue;
          await store.notifications.create(Object.assign({ user_id: us[i].id, is_read: false }, payload));
        }
      }
    } catch (e) { /* fire-and-forget */ }
  }
  function notifyLead(assigned, plan) { notifyUsers(leadsOf(assigned), planNotif('task_assigned', 'Kế hoạch mới được giao', plan.title || '', plan.id)); }
  function notifyComment(planId, body) {
    const p = getPlan(planId); if (!p) return;
    const snip = body.length > 80 ? body.slice(0, 80) + '…' : body;
    const recipients = myLead ? ['system_supervisor', 'admin'] : leadsOf(p.assigned_lead);
    notifyUsers(recipients, planNotif('task_comment', 'Trao đổi mới trong kế hoạch', snip + ' — ' + (p.title || ''), planId));
  }

  async function createPlan(e) {
    if (e) e.preventDefault();
    if (!canManage && !myLead) return;
    const isProposal = !canManage && !!myLead; // Lead đề xuất
    const title = ($('sp-f-title').value || '').trim();
    if (!title) { toast('warning', 'Thiếu tiêu đề', 'Nhập tiêu đề kế hoạch.'); return; }
    const assigned = isProposal ? myLead : $('sp-f-lead').value;
    const lead_status = {}; leadsOf(assigned).forEach(function (l) { lead_status[l] = 'pending'; });
    const link = $('sp-f-link') ? ($('sp-f-link').value || '').trim() : '';
    const informed = (isProposal && $('sp-f-informed') && $('sp-f-informed').checked) ? [otherLead(myLead)] : [];
    const payload = {
      title: title, description: ($('sp-f-desc').value || '').trim() || null,
      assigned_lead: assigned, status: 'pending', lead_status: lead_status, checklist: [],
      priority: Number($('sp-f-priority').value) || 1, deadline: $('sp-f-deadline').value || null,
      origin: isProposal ? 'lead' : 'supervisor', approval: isProposal ? 'proposed' : 'approved',
      informed_leads: informed, created_by: (me && me.id) ? me.id : null
    };
    if (link) payload.attachment_url = link;
    const btn = $('sp-f-submit'); const btnLabel = isProposal ? 'Gửi đề xuất' : 'Tạo kế hoạch';
    if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi…'; }
    try {
      const created = await store.leadTasks.upsert(payload);
      let row = created || Object.assign({ id: uid('plan'), created_at: new Date().toISOString() }, payload);
      const fileEl = $('sp-f-file');
      if (fileEl && fileEl.files && fileEl.files[0] && row.id) {
        const up = await uploadPlanFile(row.id, fileEl.files[0]);
        if (up) { const patched = await store.leadTasks.update(row.id, { attachment_path: up.path, attachment_name: up.name }); row = patched || Object.assign(row, { attachment_path: up.path, attachment_name: up.name }); }
      }
      PLANS.unshift(row);
      if (isProposal) {
        logEvent(row.id, leadLabel(myLead) + ' đề xuất kế hoạch', 'submit');
        notifyUsers(['system_supervisor', 'admin'], planNotif('task_status_changed', 'Đề xuất kế hoạch mới', leadLabel(myLead) + ' đề xuất: ' + title, row.id));
        if (informed.length) notifyUsers(informed, planNotif('task_assigned', 'Bạn được mention trong kế hoạch', leadLabel(myLead) + ' đề xuất: ' + title + ' (để bạn nắm thông tin)', row.id));
        toast('success', '✓ Đã gửi đề xuất', 'Chờ Giám sát duyệt.');
      } else {
        logEvent(row.id, 'Tạo kế hoạch · giao ' + leadLabel(assigned), 'system');
        notifyLead(assigned, row);
        toast('success', '✓ Đã tạo kế hoạch', leadLabel(assigned) + ' · ' + title);
      }
      resetForm(); toggleForm(false); render();
    } catch (err) { console.warn(err); toast('error', 'Lỗi', 'Không gửi được — kiểm tra kết nối / chạy add-supervisor-planning.sql.'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = btnLabel; } }
  }

  function resetForm() { if ($('sp-form')) $('sp-form').reset(); if ($('sp-f-priority')) $('sp-f-priority').value = '1'; }
  function toggleForm(open) { const card = $('sp-form-card'); if (!card) return; card.hidden = !open; if (open) { const t = $('sp-f-title'); if (t) t.focus(); } }

  /* ---------- REALTIME ---------- */
  function startRealtime() {
    if (!(window.MH && window.MH.supabase && window.MH.supabaseEnabled)) return;
    try {
      const ch = window.MH.supabase.channel('plan-rt-' + (me ? me.id : 'anon'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_tasks' }, function () { silentReload(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_task_comments' }, function (payload) { if (openPlanId && payload && payload.new && payload.new.lead_task_id === openPlanId) loadTimeline(openPlanId); })
        .subscribe();
      window.addEventListener('beforeunload', function () { try { window.MH.supabase.removeChannel(ch); } catch (e) {} });
    } catch (e) {}
  }

  /* ---------- EVENTS ---------- */
  function wire() {
    ['sp-search', 'sp-filter-lead', 'sp-filter-status'].forEach(function (idv) { const el = $(idv); if (!el) return; el.addEventListener('input', render); el.addEventListener('change', render); });
    document.querySelectorAll('.sp-view-chip').forEach(function (c) { c.addEventListener('click', function () { view = c.getAttribute('data-view') || 'list'; render(); }); });
    function onCardClick(ev) { const t = ev.target.closest('[data-open]'); const row = ev.target.closest('[data-plan-id]'); const id = t ? t.getAttribute('data-open') : (row ? row.getAttribute('data-plan-id') : null); if (id) openDrawer(id); }
    const tbody = $('sp-tbody'); if (tbody) tbody.addEventListener('click', onCardClick);
    const board = $('sp-board'); if (board) board.addEventListener('click', onCardClick);
    if ($('sp-new-btn')) $('sp-new-btn').addEventListener('click', function () { toggleForm(true); });
    if ($('sp-f-cancel')) $('sp-f-cancel').addEventListener('click', function () { toggleForm(false); });
    if ($('sp-form-close')) $('sp-form-close').addEventListener('click', function () { toggleForm(false); });
    if ($('sp-form')) $('sp-form').addEventListener('submit', createPlan);
    if ($('sp-drawer-close')) $('sp-drawer-close').addEventListener('click', function () { showDrawer(false); });
    if ($('sp-drawer-backdrop')) $('sp-drawer-backdrop').addEventListener('click', function () { showDrawer(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') showDrawer(false); });
  }

  function openFromQuery() {
    const id = new URLSearchParams(location.search).get('id');
    if (id && PLANS.some(function (p) { return p.id === id; })) openDrawer(id);
  }

  /* ---------- Init ---------- */
  wire();
  if (store && window.MH && window.MH.supabaseReady) {
    window.MH.supabaseReady.then(function () { load().then(function () { openFromQuery(); startRealtime(); }); }).catch(function () { load(); });
  } else { load().then(function () { openFromQuery(); }); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') silentReload(); });
  // Demo (Supabase tắt): đồng bộ cross-tab/cross-login khi tab khác ghi localStorage
  // (event 'storage' chỉ fire ở các tab KHÁC tab vừa ghi).
  window.addEventListener('storage', function (e) {
    if (!e) return;
    if (e.key === 'mh-lead-tasks') { silentReload(); if (openPlanId) reopenDrawer(openPlanId); }
    else if (e.key === 'mh-lead-task-comments') { if (openPlanId) loadTimeline(openPlanId); }
  });
})();
