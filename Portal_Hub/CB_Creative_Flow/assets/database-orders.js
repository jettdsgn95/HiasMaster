/* =====================================================================
   CB Media Hub — Database Orders module logic
   - Auth guard + role check (admin / account only)
   - Mock orders dataset
   - Table render + sort + pagination
   - Search + filter + saved views
   - Detail drawer with 4 blocks (A/B/C/D) + actions
   - Status transitions + push-to-production validation
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth guard ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  // Only admin / account can see Database Orders
  if (!['admin', 'account'].includes(user.role)) {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Database Orders chỉ dành cho Admin/Account.' });
    setTimeout(() => location.replace('dashboard.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  // Profile chip
  const pcName = document.getElementById('pc-name');
  const pcAvatar = document.getElementById('pc-avatar');
  const pcRole = document.getElementById('pc-role-badge');
  if (pcName) pcName.textContent = user.name || 'User';
  if (pcAvatar) pcAvatar.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
  if (pcRole) { pcRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1); pcRole.className = 'role-badge r--' + user.role; }

  // Profile menu toggle + logout
  const chip = document.getElementById('profile-chip');
  if (chip) {
    chip.addEventListener('click', (e) => { if (e.target.closest('.profile-menu')) return; chip.classList.toggle('is-open'); });
    document.addEventListener('click', (e) => { if (!chip.contains(e.target)) chip.classList.remove('is-open'); });
  }
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('mh-user');
    window.MH.toast({ type: 'info', title: 'Đã đăng xuất', message: 'Hẹn gặp lại!' });
    setTimeout(() => location.href = 'login.html', 500);
  });

  // Sidebar mobile
  const sb = document.getElementById('dash-sb');
  const sbd = document.getElementById('sb-backdrop');
  const sbt = document.getElementById('sb-toggle');
  if (sbt) sbt.addEventListener('click', () => { sb.classList.add('is-open'); sbd.classList.add('is-open'); });
  if (sbd) sbd.addEventListener('click', () => { sb.classList.remove('is-open'); sbd.classList.remove('is-open'); });

  /* ---------- Mock data ---------- */
  const TYPE_LABEL = {
    design: 'Design / POSM', digital: 'Digital Design', video: 'Video', motion: 'Motion',
    shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads / Post', slide: 'Slide / Proposal', other: 'Khác'
  };
  const PRIORITY_LABEL = { normal: 'Bình thường', urgent: 'Gấp', critical: 'Rất gấp' };

  // Mock orders cleared — Supabase là source of truth. Always-swap fills khi loadOrdersFromStore() chạy.
  const ORDERS = [];

  // Phase 1: expose array để các module/page khác (Order Dashboard, Reports, Master Dashboard)
  // có thể đọc cùng dataset. Khi Supabase enabled, hàm loadOrdersFromStore() sẽ swap nội dung.
  window.MH_MOCK_ORDERS = ORDERS;

  /* ---------- Phase 1 data layer hook ----------
     Expose ORDERS làm fallback cho các page khác (database-orders, reports, dashboards).
     Sau khi định nghĩa ORDERS bên dưới, IIFE sẽ gọi loadOrdersFromStore() để swap
     dataset nếu Supabase enabled. Mutations dùng persistOrder() để write-through.
     Nếu store chưa sẵn sàng → fire-and-forget, in-memory ORDERS vẫn được mutate. */
  async function loadOrdersFromStore(localOrders) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return null;
    try {
      const remote = await window.MH.store.orders.list();
      if (Array.isArray(remote)) {
        // Always replace khi Supabase enabled (kể cả empty) — DB là source of truth,
        // không fallback về mock array nữa.
        localOrders.length = 0;
        remote.forEach(function (r) { localOrders.push(r); });
        return remote.length;
      }
    } catch (e) { console.warn('[database-orders] remote load failed:', e); }
    return null;
  }
  function persistOrder(orderId, patch) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
    window.MH.store.orders.update(orderId, patch).catch(function (err) {
      console.warn('[database-orders] persist failed:', err);
      window.MH.toast({ type: 'warning', title: 'Sync lỗi', message: 'Thay đổi mới chỉ lưu local. Reload trang sẽ thử sync lại.' });
    });
  }

  /* ---------- Helpers ---------- */
  const ACCOUNT_STATUS_LABEL = {
    pending: 'Chờ xác nhận', checking: 'Đang kiểm tra', needinfo: 'Cần bổ sung',
    confirmed: 'Đã xác nhận', rejected: 'Hủy đơn'
  };
  const PROD_STATUS_LABEL = {
    unassigned: 'Chưa phân công', received: 'Nhận task', inprogress: 'Đang thực hiện',
    review: 'Chờ duyệt nội bộ', revision: 'Chỉnh sửa nội bộ', ready: 'Sẵn sàng bàn giao',
    delivered: 'Đã bàn giao', completed: 'Hoàn thành', cancelled: 'Hủy'
  };
  const TASK_STATUS_LABEL = {
    pending: 'Chưa nhận task', received: 'Nhận task', inprogress: 'Đang thực hiện',
    review: 'Chờ duyệt nội bộ', revision: 'Chỉnh sửa nội bộ',
    feedback_wait: 'Chờ client phản hồi', feedback_fix: 'Chỉnh sửa theo feedback',
    ready: 'Sẵn sàng bàn giao', delivered: 'Đã bàn giao', completed: 'Hoàn thành',
    paused: 'Tạm dừng', cancelled: 'Hủy'
  };

  /* ---------- Task Tracker / Production Board task snapshots (mirror production-board.js) ----------
     Mapping order_id → [{task_id, project_name, task_type, priority, assigned_to, status, internal_deadline}, ...]
     Kept in sync với TASKS dataset trong production-board.js. Standalone tasks (no order_id) live ONLY in localStorage.
  */
  // BUILT_IN_TASKS snapshot cleared — Related Tasks lấy từ Supabase tasks.list({order_id}) + localStorage mh-extra-tasks.
  const BUILT_IN_TASKS = [];
  function loadExtraTasks() {
    try { return JSON.parse(localStorage.getItem('mh-extra-tasks') || '[]') || []; } catch (e) { return []; }
  }
  function tasksForOrder(order_id) {
    if (!order_id) return [];
    const extras = loadExtraTasks();
    const fromExtras = extras.filter((t) => t && t.order_id === order_id);
    const fromBuiltIn = BUILT_IN_TASKS.filter((t) => t.order_id === order_id);
    const merged = [...fromBuiltIn];
    fromExtras.forEach((t) => { if (!merged.find((m) => m.task_id === t.task_id)) merged.push(t); });
    return merged;
  }
  const TODAY = new Date('2026-05-13'); // demo: anchored to "now"
  function parseDate(s) { return s ? new Date(s.replace(' ', 'T')) : null; }
  function diffDays(target) {
    const d = parseDate(target);
    if (!d) return null;
    return Math.ceil((d - TODAY) / (24 * 60 * 60 * 1000));
  }
  function fmtRelative(target) {
    const days = diffDays(target);
    if (days === null) return '';
    if (days < 0) return `Trễ ${-days} ngày`;
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Còn 1 ngày';
    return `Còn ${days} ngày`;
  }
  function deadlineClass(target, isCompleted) {
    if (isCompleted) return '';
    const days = diffDays(target);
    if (days === null) return '';
    if (days < 0) return 'is-overdue';
    if (days <= 2) return 'is-soon';
    return '';
  }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  /* ---------- State ---------- */
  const state = {
    view: 'all',
    search: '',
    priority: '',
    type: '',
    department: '',
    pic: '',
    sortKey: 'created_at',
    sortDir: 'desc',
    page: 1,
    pageSize: 10
  };

  /* ---------- Filtering ---------- */
  function matchesView(o) {
    switch (state.view) {
      case 'all': return o.account_status !== 'rejected';
      case 'pending': return o.account_status === 'pending';
      case 'checking': return o.account_status === 'checking';
      case 'needinfo': return o.account_status === 'needinfo';
      case 'confirmed': return o.account_status === 'confirmed' && o.production_status !== 'completed';
      case 'unassigned': return o.account_status === 'confirmed' && !o.production_pic;
      case 'urgent': return o.priority === 'urgent' || o.priority === 'critical';
      case 'overdue': {
        const days = diffDays(o.requested_deadline);
        return days !== null && days < 0 && o.production_status !== 'completed' && o.account_status !== 'rejected';
      }
      case 'completed': return o.production_status === 'completed';
      case 'in_production': return ['received', 'inprogress', 'revision', 'feedback_fix'].includes(o.production_status);
      case 'ready_for_delivery': return o.production_status === 'ready';
      case 'delivered': return o.production_status === 'delivered';
      case 'waiting_feedback': return ['preview', 'client_wait', 'client_rev'].includes(o.delivery_status);
      case 'rated_orders': return typeof o.satisfaction_score === 'number' && o.satisfaction_score > 0;
      case 'cancelled': return o.account_status === 'rejected' || o.production_status === 'cancelled';
      default: return true;
    }
  }
  function matchesFilters(o) {
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = [o.order_id, o.requester_name, o.requester_email, o.department, o.project_name, o.project_purpose, o.content_brief, o.production_pic, o.account_pic]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.priority && o.priority !== state.priority) return false;
    if (state.type && o.request_type !== state.type) return false;
    if (state.department && o.department !== state.department) return false;
    if (state.pic && o.production_pic !== state.pic && o.account_pic !== state.pic) return false;
    return true;
  }
  function applyFilters() {
    return ORDERS.filter((o) => matchesView(o) && matchesFilters(o));
  }
  function sortBy(arr, key, dir) {
    const m = dir === 'asc' ? 1 : -1;
    const priorityOrder = { critical: 3, urgent: 2, normal: 1 };
    return [...arr].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key === 'priority') { va = priorityOrder[va] || 0; vb = priorityOrder[vb] || 0; }
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'number') return (va - vb) * m;
      return String(va).localeCompare(String(vb)) * m;
    });
  }

  /* ---------- Render ---------- */
  const tbody = document.getElementById('orders-tbody');

  function renderRow(o) {
    const isOverdue = deadlineClass(o.requested_deadline, ['completed', 'delivered'].includes(o.production_status)) === 'is-overdue';
    const dlCls = deadlineClass(o.requested_deadline, ['completed', 'delivered'].includes(o.production_status));
    const ts = parseDate(o.created_at);
    const ts_fmt = ts ? `${String(ts.getDate()).padStart(2,'0')}/${String(ts.getMonth()+1).padStart(2,'0')} · ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}` : '—';
    const dl = parseDate(o.requested_deadline);
    const dl_fmt = dl ? `${String(dl.getDate()).padStart(2,'0')}/${String(dl.getMonth()+1).padStart(2,'0')}/${dl.getFullYear()}` : '—';
    const picInitials = o.production_pic ? o.production_pic.substring(0, 2).toUpperCase() : '';
    const picAlt = o.production_pic && ['Hậu','Linh Chi','Vinh'].indexOf(o.production_pic) % 2 === 0 ? 'has-red' : '';

    return `
      <tr data-id="${o.order_id}" class="${isOverdue ? 'is-overdue' : ''}">
        <td><span class="order-id">${o.order_id}</span></td>
        <td><span class="text-xs muted">${ts_fmt}</span></td>
        <td class="requester-cell"><b>${escapeHtml(o.requester_name)}</b><span>${escapeHtml(o.department)}</span></td>
        <td class="project-cell"><b>${escapeHtml(o.project_name)}</b><span>${o.deliverable_type ? o.deliverable_type.slice(0, 2).join(' · ') + (o.deliverable_type.length > 2 ? ' +' + (o.deliverable_type.length - 2) : '') : ''}</span></td>
        <td><span class="text-xs">${TYPE_LABEL[o.request_type] || o.request_type}</span></td>
        <td><span class="priority-pill p--${o.priority}"><span class="dot"></span>${PRIORITY_LABEL[o.priority]}</span></td>
        <td><div class="deadline-cell ${dlCls}"><span class="date">${dl_fmt}</span><span class="relative">${fmtRelative(o.requested_deadline)}</span></div></td>
        <td><span class="tb-status s--${o.account_status}"><span class="dot"></span>${ACCOUNT_STATUS_LABEL[o.account_status]}</span></td>
        <td><span class="tb-status s--${o.production_status}"><span class="dot"></span>${PROD_STATUS_LABEL[o.production_status] || '—'}</span></td>
        <td>${o.production_pic
          ? `<div class="pic-cell ${picAlt}"><span class="pic-avatar">${picInitials}</span><span class="pic-name">${escapeHtml(o.production_pic)}</span></div>`
          : `<span class="pic-unassigned">— Chưa gán —</span>`}</td>
        <td><div class="progress-mini"><div class="bar"><i style="width:${o.progress}%"></i></div><b>${o.progress}%</b></div></td>
        <td>
          <div class="row-actions" data-row-id="${o.order_id}">
            <button class="kebab" aria-label="Hành động">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            <div class="menu">
              <button data-action="view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View Detail</button>
              <button data-action="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kiểm tra brief</button>
              <button data-action="needinfo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg> Yêu cầu bổ sung</button>
              <button data-action="confirm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Xác nhận brief</button>
              <button data-action="assign"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg> Gán P.I.C / Deadline</button>
              <button data-action="push"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> Push → Production</button>
              <hr/>
              <button data-action="cancel" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Hủy đơn</button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }
  function render() {
    const filtered = applyFilters();
    const sorted = sortBy(filtered, state.sortKey, state.sortDir);
    const total = sorted.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * state.pageSize;
    const slice = sorted.slice(start, start + state.pageSize);

    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12"><div class="empty-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
        <h3>Không có order phù hợp</h3>
        <p class="mt-2">Thử thay đổi bộ lọc hoặc saved view.</p>
      </div></td></tr>`;
    } else {
      tbody.innerHTML = slice.map(renderRow).join('');
    }

    document.getElementById('visible-count').textContent = slice.length;
    document.getElementById('total-count').textContent = ORDERS.length;
    document.getElementById('page-info').textContent = `Trang ${state.page} / ${pages} · ${total} kết quả`;
    renderPagination(pages);
    renderCounts();
  }

  function renderPagination(pages) {
    const controls = document.getElementById('page-controls');
    let html = '';
    html += `<button class="page-btn" data-page="prev" ${state.page <= 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
      if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - state.page) > 1) {
        if (i === 3 || i === pages - 2) html += `<span class="text-xs muted" style="padding:0 4px">…</span>`;
        continue;
      }
      html += `<button class="page-btn ${i === state.page ? 'is-active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" data-page="next" ${state.page >= pages ? 'disabled' : ''}>›</button>`;
    controls.innerHTML = html;
  }

  function renderCounts() {
    const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
    const active = ORDERS.filter((o) => o.account_status !== 'rejected');
    setCount('count-all', active.length);
    setCount('count-pending', ORDERS.filter((o) => o.account_status === 'pending').length);
    setCount('count-needinfo', ORDERS.filter((o) => o.account_status === 'needinfo').length);
    setCount('count-confirmed', ORDERS.filter((o) => o.account_status === 'confirmed' && o.production_status !== 'completed').length);
    setCount('count-unassigned', ORDERS.filter((o) => o.account_status === 'confirmed' && !o.production_pic).length);
    setCount('count-urgent', ORDERS.filter((o) => (o.priority === 'urgent' || o.priority === 'critical') && o.account_status !== 'rejected').length);
    setCount('count-overdue', ORDERS.filter((o) => {
      const days = diffDays(o.requested_deadline);
      return days !== null && days < 0 && o.production_status !== 'completed' && o.account_status !== 'rejected';
    }).length);
    setCount('count-completed', ORDERS.filter((o) => o.production_status === 'completed' || o.production_status === 'delivered').length);
    // sidebar badge
    const navBadge = document.getElementById('nav-pending');
    if (navBadge) navBadge.textContent = ORDERS.filter((o) => o.account_status === 'pending').length;
  }

  /* ---------- Event listeners ---------- */
  // Saved views
  document.getElementById('saved-views').addEventListener('click', (e) => {
    const chip = e.target.closest('.saved-view-chip');
    if (!chip) return;
    document.querySelectorAll('.saved-view-chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    state.view = chip.getAttribute('data-view');
    state.page = 1;
    render();
  });

  // Search + filters
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; render(); }, 180);
  });
  ['filter-priority', 'filter-type', 'filter-department', 'filter-pic'].forEach((id) => {
    const key = id.replace('filter-', '');
    document.getElementById(id).addEventListener('change', (e) => { state[key] = e.target.value; state.page = 1; render(); });
  });

  // Sort
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = 'asc'; }
      document.querySelectorAll('th.sortable').forEach((t) => t.classList.remove('is-asc', 'is-desc'));
      th.classList.add(state.sortDir === 'asc' ? 'is-asc' : 'is-desc');
      render();
    });
  });

  // Pagination
  document.getElementById('page-controls').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-page]');
    if (!btn || btn.disabled) return;
    const p = btn.getAttribute('data-page');
    const filtered = applyFilters();
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (p === 'prev') state.page = Math.max(1, state.page - 1);
    else if (p === 'next') state.page = Math.min(pages, state.page + 1);
    else state.page = parseInt(p, 10);
    render();
  });

  // Row click → open drawer
  tbody.addEventListener('click', (e) => {
    const action = e.target.closest('button[data-action]');
    const kebab = e.target.closest('.kebab');
    if (kebab) {
      e.stopPropagation();
      document.querySelectorAll('.row-actions.is-open').forEach((r) => r.classList.remove('is-open'));
      kebab.parentElement.classList.toggle('is-open');
      return;
    }
    if (action) {
      e.stopPropagation();
      const id = action.closest('.row-actions').getAttribute('data-row-id');
      const order = ORDERS.find((o) => o.order_id === id);
      if (!order) return;
      handleAction(action.getAttribute('data-action'), order);
      document.querySelectorAll('.row-actions.is-open').forEach((r) => r.classList.remove('is-open'));
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = tr.getAttribute('data-id');
    const order = ORDERS.find((o) => o.order_id === id);
    if (order) openDrawer(order);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.row-actions')) {
      document.querySelectorAll('.row-actions.is-open').forEach((r) => r.classList.remove('is-open'));
    }
  });

  /* ---------- Drawer ---------- */
  const drawer = document.getElementById('order-drawer');
  const drawerBd = document.getElementById('drawer-backdrop');
  const drawerBody = document.getElementById('drawer-body');
  let currentOrder = null;

  function buildBriefChecklist(o) {
    const items = [
      { ok: !!o.project_purpose, label: 'Có mục đích sử dụng rõ ràng' },
      { ok: o.target_audience && o.target_audience.length > 0, label: 'Có đối tượng mục tiêu' },
      { ok: !!o.request_type, label: 'Có loại yêu cầu' },
      { ok: o.deliverable_type && o.deliverable_type.length > 0, label: 'Có hạng mục cụ thể' },
      { ok: !!o.size_ratio, label: 'Có kích thước / tỉ lệ' },
      { ok: !!o.content_brief, label: 'Có nội dung cần thể hiện' },
      { ok: !!o.creative_direction, label: 'Có định hướng thiết kế / reference' },
      { ok: !!(o.file_brief_url || o.source_link), label: 'Có file brief / source link' },
      { ok: !!o.requested_deadline, label: 'Có deadline mong muốn' },
      { ok: !!o.content_responsibility_confirmed, label: 'Có xác nhận trách nhiệm nội dung' }
    ];
    return `<div class="checklist">
      <h5><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Brief checklist (${items.filter((i) => i.ok).length}/${items.length})</h5>
      <ul>${items.map((i) => `<li class="${i.ok ? 'ok' : ''}">${i.label}</li>`).join('')}</ul>
    </div>`;
  }

  function buildPushCheck(o) {
    const checks = [
      { ok: o.account_status === 'confirmed', label: 'Brief đã được xác nhận' },
      { ok: !!o.production_pic, label: 'Đã gán P.I.C sản xuất' },
      { ok: !!o.internal_deadline, label: 'Đã set Internal Deadline' },
      { ok: o.production_status !== 'cancelled' && o.account_status !== 'rejected', label: 'Order chưa bị hủy' },
      { ok: o.deliverable_type && o.deliverable_type.length > 0, label: 'Có hạng mục cụ thể' }
    ];
    const allOk = checks.every((c) => c.ok);
    return `<div class="push-check ${allOk ? '' : 'is-fail'}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
        allOk ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
      }</svg>
      <div>
        <b>${allOk ? 'Đủ điều kiện chuyển sang Production Board' : 'Thiếu điều kiện chuyển Production Board'}</b>
        <ul>${checks.map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.label}</li>`).join('')}</ul>
      </div>
    </div>`;
  }

  function buildActivity(o) {
    const acts = [
      { time: o.created_at, label: `Order được tạo bởi <b>${o.requester_name}</b>` },
      o.account_pic && { time: o.last_updated, label: `<b>${o.account_pic}</b> bắt đầu kiểm tra brief` },
      o.account_status === 'needinfo' && { time: o.last_updated, label: `<b>${o.account_pic}</b> yêu cầu bổ sung brief` },
      o.account_status === 'confirmed' && { time: o.last_updated, label: `<b>${o.account_pic}</b> xác nhận brief` },
      o.production_pic && { time: o.last_updated, label: `Gán P.I.C: <b>${o.production_pic}</b>` },
      ['inprogress', 'review', 'ready', 'delivered', 'completed'].includes(o.production_status) && { time: o.last_updated, label: `Status → ${PROD_STATUS_LABEL[o.production_status]}` }
    ].filter(Boolean);
    return `<ul class="activity-mini">${acts.slice(-5).reverse().map((a) => `<li><span>${a.label}</span><time>${a.time}</time></li>`).join('')}</ul>`;
  }

  function openDrawer(o) {
    currentOrder = o;
    document.getElementById('d-order-id').textContent = o.order_id;
    document.getElementById('d-project').textContent = o.project_name;
    const s = document.getElementById('d-status');
    s.className = 'tb-status s--' + o.account_status;
    s.innerHTML = '<span class="dot"></span>' + ACCOUNT_STATUS_LABEL[o.account_status];
    const p = document.getElementById('d-priority');
    p.className = 'priority-pill p--' + o.priority;
    p.innerHTML = '<span class="dot"></span>' + PRIORITY_LABEL[o.priority];
    document.getElementById('d-created').textContent = 'Tạo lúc ' + o.created_at;
    document.getElementById('d-copy').setAttribute('data-copy', o.order_id);

    const safeJoin = (a) => Array.isArray(a) ? a.map((v) => `<span class="chip-mini">${escapeHtml(v)}</span>`).join('') : (a || '<em class="muted">—</em>');
    const v = (x) => x ? escapeHtml(x) : '<em class="muted">—</em>';
    const link = (u, label) => u ? `<a class="link" href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(label || u)}</a>` : '<em class="muted">—</em>';

    drawerBody.innerHTML = `
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">A</span><h4>Requester Information</h4></div>
        <dl>
          <dt>Họ và tên</dt><dd>${v(o.requester_name)}</dd>
          <dt>Email</dt><dd>${v(o.requester_email)}</dd>
          <dt>SĐT / Liên hệ</dt><dd>${v(o.requester_contact)}</dd>
          <dt>Chi nhánh / Bộ phận</dt><dd>${v(o.department)}</dd>
          <dt>Ngày gửi</dt><dd><span class="mono">${v(o.created_at)}</span></dd>
        </dl>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">B</span><h4>Brief Information</h4></div>
        <dl>
          <dt>Mục đích</dt><dd>${v(o.project_purpose)}</dd>
          <dt>Đối tượng mục tiêu</dt><dd>${safeJoin(o.target_audience)}</dd>
          <dt>Kênh sử dụng</dt><dd>${safeJoin(o.usage_channels)}</dd>
          <dt>Loại yêu cầu</dt><dd>${v(TYPE_LABEL[o.request_type])}</dd>
          <dt>Hạng mục</dt><dd>${safeJoin(o.deliverable_type)}</dd>
          <dt>Kích thước</dt><dd>${v(o.size_ratio)}</dd>
          ${(o.request_type === 'photo' || o.request_type === 'shoot') ? `<dt>Địa điểm</dt><dd>${v(o.shoot_location)}</dd>` : ''}
          <dt>Nội dung</dt><dd>${v(o.content_brief)}</dd>
          <dt>Định hướng</dt><dd>${v(o.creative_direction)}</dd>
          <dt>Wording</dt><dd>${o.wording_required ? 'Cần wording' : 'Dùng đúng nội dung'}</dd>
          <dt>File brief</dt><dd>${o.file_brief_url ? link(o.file_brief_url) : '<em class="muted">—</em>'}</dd>
          <dt>Source link</dt><dd>${link(o.source_link)}</dd>
        </dl>
        ${buildBriefChecklist(o)}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">C</span><h4>Internal Management</h4></div>
        <div class="edit-row">
          <label>Account Status</label>
          <select class="select" id="edit-account-status">
            ${Object.entries(ACCOUNT_STATUS_LABEL).map(([k, label]) => `<option value="${k}" ${o.account_status === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Account PIC</label>
          <select class="select" id="edit-account-pic">
            <option value="">— Chưa gán —</option>
            ${['Hậu', 'Mai Phương', 'Đức Anh'].map((p) => `<option ${o.account_pic === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Production PIC</label>
          <select class="select" id="edit-prod-pic">
            <option value="">— Chưa gán —</option>
            ${['Duy', 'Vinh', 'Linh Chi', 'Mai Phương'].map((p) => `<option ${o.production_pic === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Priority</label>
          <select class="select" id="edit-priority">
            ${Object.entries(PRIORITY_LABEL).map(([k, label]) => `<option value="${k}" ${o.priority === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Internal Deadline</label>
          <input class="input" id="edit-internal-deadline" type="datetime-local" value="${o.internal_deadline ? o.internal_deadline.replace(' ', 'T') : ''}" />
        </div>
        <div class="edit-row">
          <label>Production Status</label>
          <select class="select" id="edit-prod-status">
            ${Object.entries(PROD_STATUS_LABEL).map(([k, label]) => `<option value="${k}" ${o.production_status === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row" style="grid-template-columns:1fr">
          <label>Internal Note</label>
          <textarea class="textarea" id="edit-internal-note" placeholder="Ghi chú nội bộ..." style="min-height:80px">${escapeHtml(o.internal_note || '')}</textarea>
        </div>
        <div class="row" style="justify-content: flex-end; margin-top: var(--space-3)">
          <button class="btn btn-primary btn-sm" id="save-internal">Lưu thay đổi</button>
        </div>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">T</span><h4>Related Tasks</h4></div>
        ${(function () {
          const tasks = tasksForOrder(o.order_id);
          const list = tasks.length
            ? `<div class="related-tasks-list">${tasks.map((t) => `
                <a class="related-task-item" href="production-board.html?id=${escapeHtml(t.task_id)}">
                  <span class="rt-id">${escapeHtml(t.task_id)}</span>
                  <span class="rt-title">${escapeHtml(t.project_name || '—')}</span>
                  <span class="rt-meta">
                    <span class="priority-pill p--${t.priority}"><span class="dot"></span>${PRIORITY_LABEL[t.priority] || t.priority}</span>
                    <span class="tb-status s--${t.status}"><span class="dot"></span>${TASK_STATUS_LABEL[t.status] || t.status}</span>
                    <span class="text-xs muted">${t.assigned_to ? escapeHtml(t.assigned_to) : '— chưa gán —'}</span>
                  </span>
                </a>`).join('')}</div>`
            : `<p class="text-xs muted" style="margin:0">Chưa có task nào gắn với order này.</p>`;
          const disabled = !(o.account_status === 'confirmed') ? 'disabled' : '';
          const disabledNote = disabled ? `<p class="text-xs muted" style="margin:6px 0 0">Cần xác nhận brief trước khi tạo task.</p>` : '';
          return list + `
            <div class="row" style="justify-content:flex-end; margin-top:var(--space-3); gap:var(--space-2)">
              <a class="btn btn-secondary btn-sm" href="production-board.html${o.order_id ? '?dl=in_production' : ''}">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Mở Task Tracker
              </a>
              <button type="button" class="btn btn-primary btn-sm" id="btn-create-task-from-order" ${disabled}>
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Giao việc nội bộ từ Order này
              </button>
            </div>
            ${disabledNote}
          `;
        })()}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">D</span><h4>Delivery Summary</h4></div>
        <dl>
          <dt>Preview Link</dt><dd>${link(o.preview_link)}</dd>
          <dt>Final Link</dt><dd>${link(o.final_delivery_link)}</dd>
          <dt>Delivery Status</dt><dd>${o.delivery_status ? `<span class="tb-status s--${o.delivery_status}"><span class="dot"></span>${PROD_STATUS_LABEL[o.delivery_status] || o.delivery_status}</span>` : '<em class="muted">—</em>'}</dd>
          <dt>Delivery Date</dt><dd>${v(o.delivery_date)}</dd>
          <dt>Rating</dt><dd>${o.satisfaction_score ? `<b style="color:var(--warning); font-size:var(--text-base)">★ ${o.satisfaction_score}/5</b>` : '<em class="muted">Chưa có rating</em>'}</dd>
          <dt>Feedback</dt><dd>${v(o.client_feedback)}</dd>
        </dl>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">E</span><h4>Push to Production</h4></div>
        ${buildPushCheck(o)}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">⏱</span><h4>Activity Log</h4></div>
        ${buildActivity(o)}
      </section>
    `;

    // Wire "Create Task from this Order"
    const createTaskBtn = document.getElementById('btn-create-task-from-order');
    if (createTaskBtn) {
      createTaskBtn.addEventListener('click', () => {
        if (currentOrder.account_status !== 'confirmed') {
          window.MH.toast({ type: 'warning', title: 'Brief chưa xác nhận', message: 'Cần xác nhận brief trước khi tạo task.' });
          return;
        }
        const params = new URLSearchParams();
        params.set('createTask', '1');
        params.set('order_id', currentOrder.order_id || '');
        params.set('project_name', currentOrder.project_name || '');
        params.set('task_type', currentOrder.request_type || 'design');
        params.set('priority', currentOrder.priority || 'normal');
        if (currentOrder.internal_deadline) params.set('internal_deadline', currentOrder.internal_deadline);
        if (currentOrder.production_pic) params.set('production_pic', currentOrder.production_pic);
        if (currentOrder.content_brief) params.set('content', currentOrder.content_brief);
        if (currentOrder.shoot_location && (currentOrder.request_type === 'photo' || currentOrder.request_type === 'shoot')) {
          params.set('shoot_location', currentOrder.shoot_location);
        }
        location.href = 'production-board.html?' + params.toString();
      });
    }

    // Wire save button
    document.getElementById('save-internal').addEventListener('click', () => {
      const newStatus = document.getElementById('edit-account-status').value;
      const newAcctPic = document.getElementById('edit-account-pic').value || null;
      const newProdPic = document.getElementById('edit-prod-pic').value || null;
      const newPriority = document.getElementById('edit-priority').value;
      const newDeadline = document.getElementById('edit-internal-deadline').value.replace('T', ' ');
      const newProdStatus = document.getElementById('edit-prod-status').value;
      const newNote = document.getElementById('edit-internal-note').value;

      Object.assign(currentOrder, {
        account_status: newStatus,
        account_pic: newAcctPic,
        production_pic: newProdPic,
        priority: newPriority,
        internal_deadline: newDeadline || null,
        production_status: newProdStatus,
        internal_note: newNote,
        last_updated: new Date().toISOString().slice(0, 16).replace('T', ' ')
      });
      // Phase 1: write-through Supabase
      persistOrder(currentOrder.order_id, {
        account_status: newStatus,
        account_pic: newAcctPic,
        production_pic: newProdPic,
        priority: newPriority,
        internal_deadline: newDeadline ? new Date(newDeadline.replace(' ', 'T')).toISOString() : null,
        production_status: newProdStatus,
        internal_note: newNote,
        last_updated: new Date().toISOString()
      });
      window.MH.toast({ type: 'success', title: 'Đã lưu', message: 'Cập nhật Internal Management cho ' + currentOrder.order_id });
      render();
      openDrawer(currentOrder); // refresh drawer view
    });

    // Update stepper state theo account_status + production_status
    updateStepperState(o);

    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerBd.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  /* ---------- Drawer state update ----------
     Stepper UI lớn đã bỏ — function này giờ chỉ:
       1. Toggle visibility của push-status message (chỉ hiện khi đã push).
       2. Enable/disable các action button theo account_status + production_status. */
  function updateStepperState(o) {
    if (!o) return;
    const hint  = document.getElementById('wf-hint');
    const btnCheck   = document.getElementById('act-checking');
    const btnNeed    = document.getElementById('act-needinfo');
    const btnConfirm = document.getElementById('act-confirm');
    const btnPush    = document.getElementById('act-push');
    const btnCancel  = document.getElementById('act-cancel');

    // Reset disabled state
    [btnCheck, btnNeed, btnConfirm, btnPush, btnCancel].forEach((b) => { if (b) b.disabled = false; });

    const isCancelled = o.account_status === 'rejected' || o.production_status === 'cancelled';
    const isPushed    = o.production_status && o.production_status !== 'unassigned' && !isCancelled;
    const isConfirmed = o.account_status === 'confirmed';
    const isNeedinfo  = o.account_status === 'needinfo';
    const isChecking  = o.account_status === 'checking';
    const hasPic      = !!o.production_pic;
    const hasDeadline = !!o.internal_deadline;
    const hasDeliv    = o.deliverable_type && o.deliverable_type.length > 0;
    const readyToPush = isConfirmed && hasPic && hasDeadline && hasDeliv && !isCancelled;

    // Cancelled state — disable mọi action, hide hint
    if (isCancelled) {
      if (hint) hint.hidden = true;
      [btnCheck, btnNeed, btnConfirm, btnPush, btnCancel].forEach((b) => { if (b) b.disabled = true; });
      return;
    }

    // Button enable/disable theo state
    if (o.account_status === 'pending') {
      btnNeed.disabled = true; btnConfirm.disabled = true; btnPush.disabled = true;
    } else if (isChecking) {
      btnPush.disabled = true;
    } else if (isNeedinfo) {
      btnPush.disabled = true;
    } else if (isConfirmed && !isPushed) {
      if (!readyToPush) btnPush.disabled = true;
      btnCheck.disabled = true; btnNeed.disabled = true; btnConfirm.disabled = true;
    } else if (isPushed) {
      btnCheck.disabled = true; btnNeed.disabled = true; btnConfirm.disabled = true; btnPush.disabled = true;
    }

    // Push status message — chỉ hiện khi đã push
    if (hint) {
      if (isPushed) {
        hint.hidden = false;
        hint.className = 'wf-hint is-done';
        hint.innerHTML = 'Đã push sang Task Tracker. PIC: <b>' + (o.production_pic || '—') + '</b>. <a href="production-board.html?dl=in_production" class="link">Xem task →</a>';
      } else {
        hint.hidden = true;
        hint.innerHTML = '';
      }
    }
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawerBd.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  drawerBd.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(); });

  /* ---------- Drawer action buttons ---------- */
  document.getElementById('act-checking').addEventListener('click', () => updateStatus(currentOrder, 'checking', 'Đang kiểm tra brief'));
  document.getElementById('act-needinfo').addEventListener('click', () => updateStatus(currentOrder, 'needinfo', 'Yêu cầu bổ sung brief'));
  document.getElementById('act-confirm').addEventListener('click', () => updateStatus(currentOrder, 'confirmed', 'Đã xác nhận brief'));
  document.getElementById('act-push').addEventListener('click', () => pushToProduction(currentOrder));
  document.getElementById('act-cancel').addEventListener('click', () => openCancelModal(currentOrder));

  /* ---------- Cancel Order modal ---------- */
  const cancelModal     = document.getElementById('cancel-modal');
  const cancelModalBd   = document.getElementById('cancel-modal-backdrop');
  const cmOrderId       = document.getElementById('cm-order-id');
  const cmProject       = document.getElementById('cm-project');
  const cmCause         = document.getElementById('cm-cause');
  const cmReason        = document.getElementById('cm-reason');
  const cmNotify        = document.getElementById('cm-notify');
  const cmError         = document.getElementById('cm-error');
  const cmConfirm       = document.getElementById('cancel-modal-confirm');
  let cancelTargetOrder = null;

  const CAUSE_LABEL = {
    brief_insufficient: 'Brief chưa đủ thông tin',
    no_longer_needed:   'Không còn nhu cầu',
    deadline_mismatch:  'Deadline không phù hợp',
    duplicate_request:  'Trùng yêu cầu',
    other:              'Khác'
  };

  function openCancelModal(order) {
    if (!order) return;
    if (order.account_status === 'rejected' || order.production_status === 'cancelled') {
      window.MH.toast({ type: 'info', title: 'Order đã hủy', message: order.order_id + ' đã ở trạng thái hủy.' });
      return;
    }
    cancelTargetOrder = order;
    cmOrderId.textContent = order.order_id || '—';
    cmProject.textContent = order.project_name || '—';
    cmCause.value = '';
    cmReason.value = '';
    cmNotify.checked = true;
    cmError.hidden = true;
    cmConfirm.disabled = false;
    cancelModal.classList.add('is-open');
    cancelModal.setAttribute('aria-hidden', 'false');
    cancelModalBd.classList.add('is-open');
    setTimeout(() => cmReason.focus(), 50);
  }

  function closeCancelModal() {
    cancelModal.classList.remove('is-open');
    cancelModal.setAttribute('aria-hidden', 'true');
    cancelModalBd.classList.remove('is-open');
    cancelTargetOrder = null;
  }

  document.getElementById('cancel-modal-close').addEventListener('click', closeCancelModal);
  document.getElementById('cancel-modal-dismiss').addEventListener('click', closeCancelModal);
  cancelModalBd.addEventListener('click', closeCancelModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cancelModal.classList.contains('is-open')) closeCancelModal();
  });
  cmReason.addEventListener('input', () => { if (cmReason.value.trim()) cmError.hidden = true; });

  cmConfirm.addEventListener('click', async () => {
    if (!cancelTargetOrder) return;
    const reason = (cmReason.value || '').trim();
    if (!reason) {
      cmError.hidden = false;
      cmReason.focus();
      return;
    }
    const causeKey = cmCause.value || null;
    const notifyClient = !!cmNotify.checked;
    cmConfirm.disabled = true;
    try {
      await submitCancel(cancelTargetOrder, { reason, causeKey, notifyClient });
      closeCancelModal();
    } catch (e) {
      console.warn('[cancel] submit failed:', e);
      cmConfirm.disabled = false;
      window.MH.toast({ type: 'error', title: 'Hủy đơn thất bại', message: (e && e.message) || 'Lỗi không xác định.' });
    }
  });

  async function submitCancel(order, opts) {
    const reason = opts.reason;
    const causeKey = opts.causeKey;
    const notifyClient = opts.notifyClient;
    let me = null;
    try { me = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { me = null; }
    const meName = me && (me.name || me.email) || 'Hệ thống';
    const nowIso = new Date().toISOString();
    const nowLocal = nowIso.slice(0, 16).replace('T', ' ');

    // Mutate local snapshot (optimistic)
    order.account_status     = 'rejected';
    order.production_status  = 'cancelled';
    order.cancel_reason      = reason;
    order.cancel_cause       = causeKey;
    order.cancelled_by       = meName;
    order.cancelled_by_id    = me && me.id ? me.id : null;
    order.cancelled_at       = nowLocal;
    order.last_updated       = nowLocal;

    // Persist sang Supabase (write-through). Nếu cột chưa tồn tại sẽ fail mềm —
    // patch payload vẫn gửi các cột chuẩn để status được sync.
    const patch = {
      account_status:    'rejected',
      production_status: 'cancelled',
      last_updated:      nowIso
    };
    // Optional fields — chỉ gửi nếu schema đã add columns (xem supabase/add-cancel-fields.sql)
    patch.cancel_reason  = reason;
    patch.cancel_cause   = causeKey;
    patch.cancelled_by   = order.cancelled_by_id;
    patch.cancelled_at   = nowIso;
    persistOrder(order.order_id, patch);

    // Notify client + activity log
    if (notifyClient && window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try {
        let clientUserId = order.requester_id || null;
        if (!clientUserId && order.requester_email) {
          try {
            const { data } = await window.MH.supabase
              .from('users').select('id').eq('email', order.requester_email).maybeSingle();
            if (data && data.id) clientUserId = data.id;
          } catch (err) { console.warn('[cancel] lookup client by email failed:', err); }
        }
        if (clientUserId) {
          const causeTxt = causeKey ? (CAUSE_LABEL[causeKey] || causeKey) : null;
          await window.MH.store.notifications.create({
            user_id: clientUserId,
            type: 'order_cancelled',
            title: '❌ Yêu cầu đã bị hủy',
            message: order.order_id + ' · ' + (order.project_name || '') + (causeTxt ? ' · ' + causeTxt : '') + ' — Lý do: ' + reason,
            link: 'tracking.html?code=' + encodeURIComponent(order.order_id),
            related_entity_type: 'orders',
            related_entity_id: order.order_id
          });
        } else {
          console.warn('[cancel] không tìm thấy user_id cho client requester:', order.requester_email);
        }
      } catch (err) { console.warn('[cancel] notify client failed:', err); }
    }

    window.MH.toast({
      type: 'success',
      title: '✓ Đã hủy yêu cầu',
      message: notifyClient ? 'Đã hủy ' + order.order_id + ' và gửi thông báo đến client.' : 'Đã hủy ' + order.order_id + '.'
    });
    render();
    openDrawer(order);
  }

  /* ---------- Helper: notifyClient(order, payload) ----------
     Centralized helper để mọi workflow action (status change, push to prod, cancel,
     delivery preview/final) bắn 1 notification cho client requester.
     - Lookup user_id qua requester_id (preferred) hoặc requester_email (fallback)
     - INSERT vào notifications table với related_entity_type=orders + entity_id=order_id
     - Fire-and-forget: không block UI nếu lookup hoặc INSERT fail (log warning) */
  async function notifyClient(order, notifPayload) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return false;
    if (!order) return false;
    try {
      let clientUserId = order.requester_id || null;
      if (!clientUserId && order.requester_email && window.MH.supabase) {
        try {
          const { data } = await window.MH.supabase
            .from('users').select('id').eq('email', order.requester_email).maybeSingle();
          if (data && data.id) clientUserId = data.id;
        } catch (err) { console.warn('[notifyClient] lookup by email failed:', err); }
      }
      if (!clientUserId) {
        console.warn('[notifyClient] không tìm thấy user_id cho client:', order.requester_email);
        return false;
      }
      await window.MH.store.notifications.create({
        user_id: clientUserId,
        type: notifPayload.type,
        title: notifPayload.title,
        message: notifPayload.message,
        link: notifPayload.link || ('tracking.html?code=' + encodeURIComponent(order.order_id)),
        related_entity_type: 'orders',
        related_entity_id: order.order_id
      });
      return true;
    } catch (err) {
      console.warn('[notifyClient] create failed:', err);
      return false;
    }
  }

  function updateStatus(o, newStatus, msg) {
    if (!o) return;
    o.account_status = newStatus;
    if (newStatus === 'rejected') o.production_status = 'cancelled';
    o.last_updated = new Date().toISOString().slice(0, 16).replace('T', ' ');
    // Phase 1: persist sang Supabase nếu enabled
    persistOrder(o.order_id, {
      account_status: o.account_status,
      production_status: o.production_status,
      last_updated: new Date().toISOString()
    });
    // Module: notify client khi status thay đổi (fire-and-forget)
    const projectName = o.project_name || o.order_id;
    if (newStatus === 'checking') {
      notifyClient(o, {
        type: 'order_status_changed',
        title: '🔎 Brief đang được kiểm tra',
        message: `${o.order_id} · ${projectName} — Account đang review brief của bạn.`
      });
    } else if (newStatus === 'needinfo') {
      notifyClient(o, {
        type: 'order_needinfo',
        title: '⚠ Cần bổ sung brief',
        message: `${o.order_id} · ${projectName} — Account yêu cầu bổ sung thông tin. Vui lòng kiểm tra và phản hồi.`
      });
    } else if (newStatus === 'confirmed') {
      notifyClient(o, {
        type: 'order_confirmed',
        title: '✅ Brief đã được xác nhận',
        message: `${o.order_id} · ${projectName} — Account xác nhận brief, chuẩn bị chuyển sang sản xuất.`
      });
    }
    window.MH.toast({ type: 'success', title: msg, message: o.order_id });
    render();
    openDrawer(o);
  }

  async function pushToProduction(o) {
    if (!o) return;
    const checks = {
      brief: o.account_status === 'confirmed',
      pic: !!o.production_pic,
      deadline: !!o.internal_deadline,
      notCancelled: o.production_status !== 'cancelled' && o.account_status !== 'rejected',
      deliverable: o.deliverable_type && o.deliverable_type.length > 0
    };
    const missing = [];
    if (!checks.brief) missing.push('xác nhận brief');
    if (!checks.pic) missing.push('gán P.I.C');
    if (!checks.deadline) missing.push('Internal Deadline');
    if (!checks.notCancelled) missing.push('order chưa bị hủy');
    if (!checks.deliverable) missing.push('hạng mục');

    if (missing.length) {
      window.MH.toast({ type: 'error', title: 'Không thể push', message: 'Thiếu: ' + missing.join(' · ') });
      return;
    }

    // Idempotent check (option A): nếu order đã có task → KHÔNG tạo mới, toast warning.
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try {
        const existing = await window.MH.store.tasks.list({ order_id: o.order_id });
        if (Array.isArray(existing) && existing.length > 0) {
          window.MH.toast({
            type: 'warning',
            title: 'Order đã có task',
            message: `Đã có ${existing.length} task trong Task Tracker (${existing.map(t => t.task_id).join(', ')}). Không tạo mới.`,
            duration: 5000
          });
          // Update order status anyway (cho phép sync state nếu admin re-push)
          o.production_status = 'received';
          o.last_updated = new Date().toISOString().slice(0, 16).replace('T', ' ');
          persistOrder(o.order_id, { production_status: 'received', last_updated: new Date().toISOString() });
          render(); openDrawer(o);
          return;
        }
      } catch (e) { console.warn('[push] idempotent check failed:', e); }
    }

    // Tạo task mới từ order
    const taskId = await generateNextTaskId();
    const taskPayload = {
      task_id: taskId,
      order_id: o.order_id,
      is_standalone: false,
      project_name: o.project_name || 'Untitled',
      task_type: o.request_type || 'design',
      content: o.content_brief || '',
      priority: o.priority || 'normal',
      assigned_to: o.production_pic,
      status: 'received',
      progress: 20,
      internal_deadline: o.internal_deadline ? (typeof o.internal_deadline === 'string' ? new Date(o.internal_deadline.replace(' ', 'T')).toISOString() : new Date(o.internal_deadline).toISOString()) : null,
      link_drive: o.source_link || '',
      preview_link: '',
      final_link: '',
      created_at: new Date().toISOString(),
      last_update: new Date().toISOString()
    };
    // Chỉ pass shoot_location key khi photo/shoot — backward-compat với DB chưa migrate cột này.
    if ((o.request_type === 'photo' || o.request_type === 'shoot') && o.shoot_location) {
      taskPayload.shoot_location = o.shoot_location;
    }

    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try {
        // INSERT task
        await window.MH.store.tasks.upsert(taskPayload);

        // INSERT notification cho PIC (lookup user_id qua name)
        const picUserId = await window.MH.store.notifications.findUserIdByName(o.production_pic);
        if (picUserId) {
          await window.MH.store.notifications.create({
            user_id: picUserId,
            type: 'task_assigned',
            title: '🎯 Task mới được giao',
            message: `${taskId} · ${taskPayload.project_name} · ${TYPE_LABEL[taskPayload.task_type] || taskPayload.task_type} · Deadline: ${o.internal_deadline || '—'}`,
            link: 'production-board.html?id=' + taskId,
            related_entity_type: 'tasks',
            related_entity_id: taskId
          });
        } else {
          console.warn('[push] không tìm thấy user_id cho PIC:', o.production_pic);
        }
      } catch (e) {
        console.warn('[push] task creation failed:', e);
        window.MH.toast({ type: 'error', title: 'Tạo task thất bại', message: 'DB không phản hồi. Thử lại hoặc liên hệ admin.' });
        return;
      }
    }

    // Update order
    o.production_status = 'received';
    o.progress = 20;
    o.last_updated = new Date().toISOString().slice(0, 16).replace('T', ' ');
    persistOrder(o.order_id, {
      production_status: 'received',
      progress: 20,
      last_updated: new Date().toISOString()
    });

    // Notify client: order đã chuyển sang sản xuất (fire-and-forget)
    notifyClient(o, {
      type: 'order_status_changed',
      title: '🚀 Đã chuyển sang sản xuất',
      message: `${o.order_id} · ${o.project_name || ''} — Team Media đang thực hiện. Bản preview sẽ được gửi khi hoàn thành.`
    });

    window.MH.toast({
      type: 'success',
      title: '✓ Đã chuyển Production Board',
      message: o.order_id + ' → ' + taskId + ' · PIC: ' + o.production_pic + ' · Đã gửi notification',
      duration: 4500
    });
    render();
    openDrawer(o);
  }

  // Generate task_id incrementally (query max trong DB hoặc fallback timestamp)
  async function generateNextTaskId() {
    if (window.MH && window.MH.supabaseEnabled && window.MH.supabase) {
      try {
        const { data } = await window.MH.supabase.from('tasks').select('task_id').like('task_id', 'TASK-%').order('task_id', { ascending: false }).limit(1);
        if (data && data.length) {
          const m = /TASK-(\d+)/.exec(data[0].task_id);
          if (m) return 'TASK-' + String(parseInt(m[1], 10) + 1).padStart(4, '0');
        }
      } catch (e) { console.warn('[push] next task id query failed:', e); }
    }
    return 'TASK-' + String(Date.now()).slice(-4);  // Fallback unique-ish
  }

  /* ---------- Action handler từ row menu ---------- */
  function handleAction(action, order) {
    switch (action) {
      case 'view': openDrawer(order); break;
      case 'check': updateStatus(order, 'checking', 'Đang kiểm tra brief'); break;
      case 'needinfo': updateStatus(order, 'needinfo', 'Yêu cầu bổ sung brief'); break;
      case 'confirm': updateStatus(order, 'confirmed', 'Đã xác nhận brief'); break;
      case 'assign': openDrawer(order); break;
      case 'push': pushToProduction(order); break;
      case 'cancel':
        openCancelModal(order);
        break;
    }
  }

  /* ---------- Drilldown from Master/Orders Dashboard ----------
     Expanded (Module 3) để support tất cả KPI của Orders Dashboard. */
  const DRILLDOWN_MAP = {
    // Order Intake
    total_orders:      { view: 'all',          sortKey: 'created_at',   sortDir: 'desc', label: 'Total Client Orders', desc: 'Toàn bộ Client Orders đang active (không gồm rejected).' },
    new_requests:      { view: 'pending',      sortKey: 'created_at',   sortDir: 'asc',  label: 'New Orders',          desc: 'Đơn mới chờ Account xác nhận.' },
    checking:          { view: 'checking',     sortKey: 'last_updated', sortDir: 'desc', label: 'Checking Brief',      desc: 'Account đang review brief.' },
    brief_need_info:   { view: 'needinfo',     sortKey: 'last_updated', sortDir: 'desc', label: 'Need More Info',      desc: 'Đơn cần bổ sung thông tin từ client.' },
    confirmed:         { view: 'confirmed',    sortKey: 'last_updated', sortDir: 'desc', label: 'Confirmed Brief',     desc: 'Brief đã xác nhận, đang/sẵn sàng push Production.' },
    // Production Flow
    in_production:     { view: 'in_production',sortKey: 'last_updated', sortDir: 'desc', label: 'In Production',       desc: 'Đang sản xuất (received/inprogress/revision/feedback_fix).' },
    ready_for_delivery:{ view: 'ready_for_delivery', sortKey: 'last_updated', sortDir: 'desc', label: 'Ready for Delivery', desc: 'Sẵn sàng bàn giao (production_status=ready).' },
    delivered:         { view: 'delivered',    sortKey: 'last_updated', sortDir: 'desc', label: 'Delivered',           desc: 'Đã bàn giao đến client.' },
    // Feedback & Completion
    waiting_feedback:  { view: 'waiting_feedback', sortKey: 'last_updated', sortDir: 'desc', label: 'Waiting Feedback', desc: 'Delivery đã gửi, chờ client phản hồi.' },
    rated_orders:      { view: 'rated_orders', sortKey: 'last_updated', sortDir: 'desc', label: 'Rated Orders',        desc: 'Đơn đã có rating từ client.' },
    completed:         { view: 'completed',    sortKey: 'last_updated', sortDir: 'desc', label: 'Completed Orders',    desc: 'Đơn hoàn thành (production_status=completed).' },
    cancelled:         { view: 'cancelled',    sortKey: 'last_updated', sortDir: 'desc', label: 'Cancelled Orders',    desc: 'Đơn đã hủy (account=rejected hoặc production=cancelled).' }
  };
  function applyDrilldownFromURL() {
    const params = new URLSearchParams(location.search);
    const key = params.get('dl');
    if (!key || !DRILLDOWN_MAP[key]) return null;
    const cfg = DRILLDOWN_MAP[key];
    state.view = cfg.view;
    state.sortKey = cfg.sortKey;
    state.sortDir = cfg.sortDir;
    state.page = 1;
    document.querySelectorAll('.saved-view-chip').forEach((c) => c.classList.toggle('is-active', c.getAttribute('data-view') === cfg.view));
    document.querySelectorAll('th.sortable').forEach((th) => {
      th.classList.remove('is-asc', 'is-desc');
      if (th.getAttribute('data-sort') === cfg.sortKey) th.classList.add(cfg.sortDir === 'asc' ? 'is-asc' : 'is-desc');
    });
    return cfg;
  }
  function clearDrilldown() {
    state.view = 'all';
    state.sortKey = 'created_at';
    state.sortDir = 'desc';
    state.page = 1;
    document.querySelectorAll('.saved-view-chip').forEach((c) => c.classList.toggle('is-active', c.getAttribute('data-view') === 'all'));
    history.replaceState(null, '', location.pathname);
    const banner = document.getElementById('dl-banner');
    if (banner) banner.remove();
    render();
  }
  function injectDrilldownBanner(cfg) {
    const anchor = document.querySelector('.table-card');
    if (!anchor) return;
    const filtered = applyFilters();
    const banner = document.createElement('div');
    banner.className = 'drilldown-banner';
    banner.id = 'dl-banner';
    banner.innerHTML = `
      <span class="dl-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
      <span class="dl-text">
        <span class="dl-from">Drilldown từ Master Dashboard</span>
        <span class="dl-label">${cfg.label}</span>
      </span>
      <span class="dl-count"><b id="dl-count">${filtered.length}</b> kết quả · ${cfg.desc}</span>
      <button class="dl-clear" type="button" id="dl-clear" aria-label="Xóa filter">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Xóa filter
      </button>
    `;
    anchor.parentElement.insertBefore(banner, anchor);
    document.getElementById('dl-clear').addEventListener('click', clearDrilldown);
  }

  const drilldownCfg = applyDrilldownFromURL();

  /* ---------- Initial render ---------- */
  render();
  if (drilldownCfg) {
    injectDrilldownBanner(drilldownCfg);
    document.querySelector('.table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Auto-open drawer cho record cụ thể nếu ?id=MEDIA-* được pass (Dashboard Alert Center, notification click...).
  // Helper: thử mở drawer ngay; nếu chưa có thì caller phải retry sau khi data load.
  const focusId = new URLSearchParams(location.search).get('id');
  function tryFocusOrder(showToast) {
    if (!focusId) return false;
    const order = ORDERS.find((o) => o.order_id === focusId);
    if (order) { setTimeout(() => openDrawer(order), 80); return true; }
    if (showToast) {
      window.MH.toast({ type: 'warning', title: 'Không tìm thấy order', message: `${focusId} không có trong dataset.`, duration: 5000 });
    }
    return false;
  }
  // First attempt: với mock data hiện có (legacy demo nếu Supabase off).
  const focusedFromMock = tryFocusOrder(false);

  // Phase 1: nếu Supabase enabled, swap dataset bằng dữ liệu thật rồi re-render.
  // Chạy fire-and-forget — không block initial paint với mock.
  loadOrdersFromStore(ORDERS).then(function (n) {
    if (typeof n === 'number') {
      console.log('[database-orders] swapped ' + n + ' orders từ Supabase');
      render();
      // Re-open drawer nếu đang có currentOrder
      if (currentOrder) {
        const updated = ORDERS.find(function (o) { return o.order_id === currentOrder.order_id; });
        if (updated) openDrawer(updated);
      }
      // Retry focus nếu lần đầu chưa thấy order (ORDERS rỗng lúc init vì demo cleared).
      if (focusId && !focusedFromMock) tryFocusOrder(true);
    } else if (focusId && !focusedFromMock) {
      // Supabase off và mock không có → warn người dùng.
      tryFocusOrder(true);
    }
  });
})();
