/* =====================================================================
   CB Media Hub — Production Board module logic
   - Auth guard (admin/account/design/editor) — client redirected
   - 3 views: Table / Kanban (drag-drop) / My Tasks
   - Default view per role: design/editor → My Tasks, admin/account → Table
   - Status transitions with auto-progress
   - Task detail drawer with brief, files, status actions, comments, activity
   - Ready-for-delivery validation (preview/final link required)
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth guard ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (user.role === 'client') {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Internal Task Tracker chỉ dành cho team nội bộ.' });
    setTimeout(() => location.replace('client-dashboard.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  const pcName = document.getElementById('pc-name');
  const pcAvatar = document.getElementById('pc-avatar');
  const pcRole = document.getElementById('pc-role-badge');
  if (pcName) pcName.textContent = user.name || 'User';
  if (pcAvatar) pcAvatar.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
  if (pcRole) { pcRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1); pcRole.className = 'role-badge r--' + user.role; }

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

  const sb = document.getElementById('dash-sb');
  const sbd = document.getElementById('sb-backdrop');
  const sbt = document.getElementById('sb-toggle');
  if (sbt) sbt.addEventListener('click', () => { sb.classList.add('is-open'); sbd.classList.add('is-open'); });
  if (sbd) sbd.addEventListener('click', () => { sb.classList.remove('is-open'); sbd.classList.remove('is-open'); });

  /* ---------- Phase 1 data layer hooks ----------
     Expose TASKS làm fallback cho cross-page (Database Orders Related Tasks block,
     Task Dashboard). Khi Supabase enabled, async swap dataset. Mutations dùng
     persistTask() write-through (optimistic UI + Supabase update fire-and-forget). */
  async function loadTasksFromStore(localTasks) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return null;
    try {
      const remote = await window.MH.store.tasks.list();
      if (Array.isArray(remote)) {
        // Always replace khi Supabase enabled (kể cả empty)
        localTasks.length = 0;
        remote.forEach(function (r) {
          r.comments = r.comments || [];
          localTasks.push(r);
        });
        return remote.length;
      }
    } catch (e) { console.warn('[production-board] remote load failed:', e); }
    return null;
  }
  function persistTask(taskId, patch) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
    window.MH.store.tasks.upsert(Object.assign({ task_id: taskId }, patch)).catch(function (err) {
      console.warn('[production-board] persist failed:', err);
    });
  }
  function persistTaskComment(taskId, comment) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
    window.MH.store.taskComments.add(taskId, comment).catch(function (err) {
      console.warn('[production-board] comment persist failed:', err);
    });
  }

  /* ---------- Status & progress maps ---------- */
  const STATUS_LABEL = {
    pending: 'Chưa nhận task', received: 'Nhận task', inprogress: 'Đang thực hiện',
    review: 'Chờ duyệt nội bộ', revision: 'Chỉnh sửa nội bộ',
    feedback_wait: 'Chờ client phản hồi', feedback_fix: 'Chỉnh sửa theo feedback',
    ready: 'Sẵn sàng bàn giao', delivered: 'Đã bàn giao', completed: 'Hoàn thành',
    paused: 'Tạm dừng', cancelled: 'Hủy'
  };
  const STATUS_PROGRESS = {
    pending: 20, received: 30, inprogress: 50, review: 65, revision: 75,
    feedback_wait: 80, feedback_fix: 85, ready: 90, delivered: 95,
    completed: 100, paused: 0, cancelled: 0
  };
  const TYPE_LABEL = {
    design: 'Design / POSM', digital: 'Digital Design', video: 'Video', motion: 'Motion',
    media: 'Quay / Chụp ảnh', shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads / Post', slide: 'Slide'
  };
  const PRIORITY_LABEL = { normal: 'Bình thường', urgent: 'Gấp', critical: 'Rất gấp' };

  /* ---------- Mock tasks ---------- */
  const TODAY = new Date('2026-05-13');
  function fmtDT() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  // Hiển thị timestamp → "DD/MM/YYYY HH:MM" local. Bare "YYYY-MM-DD HH:MM" (fmtDT) coi là UTC.
  function fmtDateTime(s) {
    if (!s) return '—';
    s = String(s);
    const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return s;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // internal_deadline (ISO Supabase HOẶC bare local) → value cho <input datetime-local> (local).
  function toLocalInput(s) {
    if (!s) return '';
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function parseDate(s) { return s ? new Date(s.replace(' ', 'T')) : null; }
  function diffDays(s) { const d = parseDate(s); if (!d) return null; return Math.ceil((d - TODAY) / 86400000); }
  function fmtRelative(s) {
    const days = diffDays(s);
    if (days === null) return '';
    if (days < 0) return `Trễ ${-days}d`;
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Còn 1d';
    return `Còn ${days}d`;
  }
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  /* ---------- Team members for @mention autocomplete ---------- */
  const TEAM_MEMBERS = [
    { name: 'Mai Phương',  role: 'admin'   },
    { name: 'Hậu',         role: 'account' },
    { name: 'Đức Anh',     role: 'account' },
    { name: 'Duy',         role: 'design'  },
    { name: 'Vinh',        role: 'design'  },
    { name: 'Linh Chi',    role: 'editor'  }
  ];
  function teamMembersForUser(currentUserName) {
    const seen = new Set();
    const list = [];
    if (currentUserName && !seen.has(currentUserName)) {
      list.push({ name: currentUserName, role: '', is_self: true });
      seen.add(currentUserName);
    }
    TEAM_MEMBERS.forEach((m) => { if (!seen.has(m.name)) { list.push(m); seen.add(m.name); } });
    return list;
  }
  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ---------- Comment helpers: id, mentions, reply parent ---------- */
  function genCommentId() {
    return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function ensureCommentIds(task) {
    (task.comments || []).forEach((c) => { if (!c.id) c.id = genCommentId(); });
  }
  function parseMentions(text) {
    if (!text) return [];
    const names = TEAM_MEMBERS.map((m) => m.name);
    const found = [];
    names.forEach((n) => {
      const re = new RegExp('@' + n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?=\\b|$|\\s)', 'i');
      if (re.test(text) && !found.includes(n)) found.push(n);
    });
    return found;
  }
  function renderCommentText(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    // Sort by length desc to avoid matching "Linh" inside "Linh Chi" first
    const names = [...TEAM_MEMBERS.map((m) => m.name)].sort((a, b) => b.length - a.length);
    names.forEach((n) => {
      const safe = n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const re = new RegExp('@' + safe + '(?=\\b|$|\\s|[.,;:!?])', 'g');
      html = html.replace(re, '<span class="mention">@' + escapeHtml(n) + '</span>');
    });
    return html.replace(/\n/g, '<br>');
  }
  function findCommentById(task, id) {
    return (task.comments || []).find((c) => c.id === id) || null;
  }

  function renderCommentItem(c, isReply, task) {
    const replyParent = c.reply_to ? findCommentById(task, c.reply_to) : null;
    const replyBadge = replyParent ? `
      <div class="reply-indicator" data-scroll-to="${replyParent.id}" title="Cuộn tới comment gốc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
        Reply tới <b>@${escapeHtml(replyParent.author)}</b>
      </div>` : '';
    return `
      <div class="comment-item ${isReply ? 'is-reply' : ''}" id="cm-${c.id}" data-comment-id="${c.id}">
        <span class="ca">${initials(c.author)}</span>
        <div class="c-bubble">
          <div class="c-head">
            <span><b>${escapeHtml(c.author)}</b><span class="c-type t--${c.type || 'internal'}">${(c.type || 'internal').toUpperCase()}</span></span>
            <time>${fmtDateTime(c.time)}</time>
          </div>
          ${replyBadge}
          <div>${renderCommentText(c.text)}</div>
          <div class="comment-actions">
            <button type="button" data-reply="${c.id}" title="Trả lời">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              Reply
            </button>
          </div>
        </div>
      </div>`;
  }

  // Group: top-level chronological, replies indented immediately under their parent.
  function renderCommentsThread(task) {
    ensureCommentIds(task);
    const comments = task.comments || [];
    if (!comments.length) return '<p class="text-xs muted">Chưa có comment.</p>';
    const topLevel = comments.filter((c) => !c.reply_to);
    const repliesByParent = {};
    comments.filter((c) => c.reply_to).forEach((c) => {
      (repliesByParent[c.reply_to] = repliesByParent[c.reply_to] || []).push(c);
    });
    // Orphan replies (parent deleted) → render at top-level
    const orphanReplies = comments.filter((c) => c.reply_to && !findCommentById(task, c.reply_to));
    return [
      ...topLevel.map((c) => renderCommentItem(c, false, task) + (repliesByParent[c.id] || []).map((r) => renderCommentItem(r, true, task)).join('')),
      ...orphanReplies.map((c) => renderCommentItem(c, false, task))
    ].join('');
  }

  // Reply state — single instance per drawer session
  let replyingToId = null;

  // TASKS cleared — Supabase là source of truth. loadTasksFromStore() swap khi enabled.
  const TASKS = [];

  /* ---------- Persisted extra tasks (created via Task Tracker / Order drawer) ----------
     Tasks live in localStorage `mh-extra-tasks` so they survive page reloads + cross-page (Database Orders → Task Tracker).
     Each entry has the same shape as TASKS items above. `is_standalone: true` means no gắn order.
  */
  const EXTRA_TASKS_KEY = 'mh-extra-tasks';
  function loadExtraTasks() {
    try { return JSON.parse(localStorage.getItem(EXTRA_TASKS_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function saveExtraTasks(arr) {
    try { localStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify(arr || [])); } catch (e) {}
  }
  function appendExtraTask(task) {
    const arr = loadExtraTasks();
    arr.push(task);
    if (arr.length > 100) arr.shift();
    saveExtraTasks(arr);
  }
  // Merge persisted extras into in-memory TASKS, dedupe by task_id
  loadExtraTasks().forEach((t) => {
    if (t && t.task_id && !TASKS.find((x) => x.task_id === t.task_id)) {
      t.comments = t.comments || [];
      TASKS.push(t);
    }
  });
  function nextTaskId() {
    let max = 0;
    TASKS.forEach((t) => {
      const m = /TASK-(\d+)/.exec(t.task_id || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'TASK-' + String(max + 1).padStart(4, '0');
  }

  /* ---------- ORDER_INDEX: derive order_id → project_name from existing TASKS for cross-page lookups ---------- */
  const ORDER_INDEX = {};
  TASKS.forEach((t) => {
    if (t.order_id && !ORDER_INDEX[t.order_id]) ORDER_INDEX[t.order_id] = { project_name: t.project_name };
  });

  // Phase 1: expose array để các module/page khác (Database Orders Related Tasks,
  // Task Dashboard, Reports) đọc cùng dataset.
  window.MH_MOCK_TASKS = TASKS;

  /* ---------- State ---------- */
  const state = {
    view: ['design', 'editor'].includes(user.role) ? 'mytasks' : 'table',
    search: '', status: '', priority: '', type: '', pic: '',
    quick: null,     // summary card quick-filter
    quickChip: ''    // chip filter row above toolbar
  };

  /* ---------- Match task PIC với user hiện tại ----------
     PIC (assigned_to) thường lưu tên ngắn ("Duy", "Hậu"), còn user.name là tên đầy đủ
     ("Duy Trần", "Hậu Nguyễn"). Khớp khi bằng nhau HOẶC full name chứa tên PIC theo
     word-boundary (tránh false-positive kiểu "Duyên"). Fix: `.split(' ').pop()` cũ lấy
     CHỮ CUỐI ("Trần") nên PIC "Duy" không bao giờ khớp. */
  function isMyTask(assignedTo) {
    if (!assignedTo) return false;
    const a = String(assignedTo).trim().toLowerCase();
    const u = String(user.name || '').trim().toLowerCase();
    if (!a || !u) return false;
    if (a === u) return true;
    return u.startsWith(a + ' ') || u.endsWith(' ' + a) || u.includes(' ' + a + ' ');
  }

  /* ---------- Scoping by role ---------- */
  function visibleTasks() {
    if (user.role === 'design' || user.role === 'editor') {
      return TASKS.filter((t) => isMyTask(t.assigned_to));
    }
    return TASKS;
  }

  function applyFilters(arr) {
    return arr.filter((t) => {
      if (state.search) {
        const q = state.search.toLowerCase();
        const hay = [t.task_id, t.order_id, t.project_name, t.task_type, t.content, t.assigned_to].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (state.status && t.status !== state.status) return false;
      if (state.priority && t.priority !== state.priority) return false;
      if (state.type && t.task_type !== state.type) return false;
      if (state.pic && t.assigned_to !== state.pic) return false;
      if (state.quick) {
        switch (state.quick) {
          case 'my': if (!isMyTask(t.assigned_to)) return false; break;
          case 'soon': { const d = diffDays(t.internal_deadline); if (!(d !== null && d >= 0 && d <= 2 && t.status !== 'completed')) return false; break; }
          case 'overdue': { const d = diffDays(t.internal_deadline); if (!(d !== null && d < 0 && t.status !== 'completed')) return false; break; }
          case 'review': if (t.status !== 'review') return false; break;
          case 'ready': if (t.status !== 'ready') return false; break;
          case 'inproduction': if (!['received', 'inprogress', 'revision', 'feedback_fix'].includes(t.status)) return false; break;
          case 'completed': if (t.status !== 'completed' && t.status !== 'delivered') return false; break;
          // Module 4 — Task Dashboard drilldown keys
          case 'pending': if (t.status !== 'pending') return false; break;
          case 'revision': if (t.status !== 'revision') return false; break;
          case 'blocked': if (t.status !== 'paused') return false; break;
          case 'unassigned': if (t.assigned_to) return false; break;
          case 'linked': if (!(t.order_id && !t.is_standalone)) return false; break;
          case 'standalone': if (!(t.is_standalone || !t.order_id)) return false; break;
          case 'due_today': { const d = diffDays(t.internal_deadline); if (!(d === 0 && t.status !== 'completed' && t.status !== 'delivered')) return false; break; }
          case 'due_week': { const d = diffDays(t.internal_deadline); if (!(d !== null && d >= 0 && d <= 7 && t.status !== 'completed' && t.status !== 'delivered')) return false; break; }
          case 'completed_week': {
            if (t.status !== 'completed' && t.status !== 'delivered') return false;
            const lu = t.last_update ? new Date((typeof t.last_update === 'string' ? t.last_update.replace(' ', 'T') : t.last_update)) : null;
            if (!lu || isNaN(lu.getTime())) return false;
            if (Date.now() - lu.getTime() > 7 * 24 * 60 * 60 * 1000) return false;
            break;
          }
        }
      }
      if (state.quickChip) {
        switch (state.quickChip) {
          case 'due_today': { const d = diffDays(t.internal_deadline); if (!(d === 0 && t.status !== 'completed')) return false; break; }
          case 'due_week': { const d = diffDays(t.internal_deadline); if (!(d !== null && d >= 0 && d <= 7 && t.status !== 'completed')) return false; break; }
          case 'overdue': { const d = diffDays(t.internal_deadline); if (!(d !== null && d < 0 && t.status !== 'completed')) return false; break; }
          case 'unassigned': if (t.assigned_to) return false; break;
          case 'mine': if (!isMyTask(t.assigned_to)) return false; break;
          case 'standalone': if (!(t.is_standalone || !t.order_id)) return false; break;
        }
      }
      return true;
    });
  }

  /* ---------- Render: summary ---------- */
  function renderSummary() {
    const scope = visibleTasks();
    const my = scope.filter((t) => isMyTask(t.assigned_to) && t.status !== 'completed');
    const overdue = scope.filter((t) => { const d = diffDays(t.internal_deadline); return d !== null && d < 0 && t.status !== 'completed'; });
    const soon = scope.filter((t) => { const d = diffDays(t.internal_deadline); return d !== null && d >= 0 && d <= 2 && t.status !== 'completed'; });
    const review = scope.filter((t) => t.status === 'review');
    const ready = scope.filter((t) => t.status === 'ready');
    document.getElementById('sm-total').textContent = scope.length;
    document.getElementById('sm-my').textContent = my.length;
    document.getElementById('sm-soon').textContent = soon.length;
    document.getElementById('sm-overdue').textContent = overdue.length;
    document.getElementById('sm-review').textContent = review.length;
    document.getElementById('sm-ready').textContent = ready.length;
    // sidebar badge
    const nb = document.getElementById('nav-mytask');
    if (nb) nb.textContent = my.length;
  }

  /* ---------- Render: table ---------- */
  const tbody = document.getElementById('tasks-tbody');
  function renderTable() {
    const filtered = applyFilters(visibleTasks());
    document.getElementById('tv-visible').textContent = filtered.length;
    document.getElementById('tv-total').textContent = visibleTasks().length;
    document.getElementById('vt-table').textContent = filtered.length;
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13"><div class="empty-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
        <h3>Không có task phù hợp</h3>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map((t) => {
      const days = diffDays(t.internal_deadline);
      const dlCls = days !== null && t.status !== 'completed' ? (days < 0 ? 'is-overdue' : (days <= 2 ? 'is-soon' : '')) : '';
      const overdueRow = (days !== null && days < 0 && t.status !== 'completed') ? 'is-overdue' : '';
      const dl = parseDate(t.internal_deadline);
      const dl_fmt = dl ? `${String(dl.getDate()).padStart(2,'0')}/${String(dl.getMonth()+1).padStart(2,'0')}` : '—';
      const picAlt = t.assigned_to && ['Hậu','Linh Chi','Vinh'].indexOf(t.assigned_to) % 2 === 0 ? 'has-red' : '';
      const picInit = t.assigned_to ? t.assigned_to.substring(0, 2).toUpperCase() : '';
      const links = [];
      if (t.preview_link) links.push('<span class="kc-flag has-preview">P</span>');
      if (t.final_link)   links.push('<span class="kc-flag has-final">F</span>');
      if (t.link_drive)   links.push('<span class="kc-flag">D</span>');
      const contentShort = t.content.length > 60 ? t.content.substring(0, 60) + '…' : t.content;
      return `
        <tr data-id="${t.task_id}" class="${overdueRow}">
          <td><span class="order-id">${t.task_id}</span></td>
          <td><span class="mono text-xs muted">${t.order_id}</span></td>
          <td class="project-cell"><b>${escapeHtml(t.project_name)}</b></td>
          <td><span class="text-xs">${TYPE_LABEL[t.task_type] || t.task_type}</span></td>
          <td><span class="text-xs muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:200px">${escapeHtml(contentShort)}</span></td>
          <td><span class="priority-pill p--${t.priority}"><span class="dot"></span>${PRIORITY_LABEL[t.priority]}</span></td>
          <td><div class="pic-cell ${picAlt}"><span class="pic-avatar">${picInit}</span><span class="pic-name">${escapeHtml(t.assigned_to || '—')}</span></div></td>
          <td><span class="tb-status s--${t.status}"><span class="dot"></span>${STATUS_LABEL[t.status]}</span></td>
          <td><div class="progress-mini"><div class="bar"><i style="width:${t.progress}%"></i></div><b>${t.progress}%</b></div></td>
          <td><div class="deadline-cell ${dlCls}"><span class="date">${dl_fmt}</span><span class="relative">${fmtRelative(t.internal_deadline)}</span></div></td>
          <td><div class="kc-flags">${links.join('') || '<span class="text-xs muted">—</span>'}</div></td>
          <td><span class="mono text-xs muted">${fmtDateTime(t.last_update).split(' ')[0]}</span></td>
          <td><button class="icon-btn" data-action="view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg></button></td>
        </tr>
      `;
    }).join('');
  }

  /* ---------- Render: kanban ---------- */
  function renderKanban() {
    const filtered = applyFilters(visibleTasks());
    document.getElementById('vt-kanban').textContent = filtered.length;
    const cols = document.querySelectorAll('#kanban-board .kanban-col');
    cols.forEach((col) => {
      const status = col.getAttribute('data-status');
      const list = filtered.filter((t) => t.status === status);
      col.querySelector('.col-count').textContent = list.length;
      const body = col.querySelector('.kanban-col-body');
      if (list.length === 0) {
        body.innerHTML = `<div class="text-xs muted" style="text-align:center; padding:var(--space-3) 0; font-style:italic">Trống</div>`;
        return;
      }
      body.innerHTML = list.map((t) => {
        const days = diffDays(t.internal_deadline);
        const dlCls = days !== null && t.status !== 'completed' ? (days < 0 ? 'is-overdue' : (days <= 2 ? 'is-soon' : '')) : '';
        const overdue = days !== null && days < 0 && t.status !== 'completed' ? 'is-overdue' : '';
        const dl = parseDate(t.internal_deadline);
        const dl_fmt = dl ? `${String(dl.getDate()).padStart(2,'0')}/${String(dl.getMonth()+1).padStart(2,'0')}` : '—';
        const picAlt = t.assigned_to && ['Hậu','Linh Chi','Vinh'].indexOf(t.assigned_to) % 2 === 0 ? 'has-red' : '';
        const picInit = t.assigned_to ? t.assigned_to.substring(0, 2).toUpperCase() : '?';
        const flags = [];
        if (t.preview_link) flags.push('<span class="kc-flag has-preview">P</span>');
        if (t.final_link)   flags.push('<span class="kc-flag has-final">F</span>');
        if (t.comments && t.comments.length) flags.push(`<span class="kc-flag has-comments">${t.comments.length}c</span>`);
        return `
          <div class="kanban-card ${overdue}" draggable="true" data-id="${t.task_id}">
            <div class="kc-head">
              <span class="kc-id">${t.task_id}</span>
              <span class="priority-pill p--${t.priority} kc-priority"><span class="dot"></span>${PRIORITY_LABEL[t.priority][0]}</span>
            </div>
            <div class="kc-title">${escapeHtml(t.project_name)}</div>
            <div class="kc-flags">${flags.join('')}</div>
            <div class="kc-meta">
              <span class="kc-pic"><span class="pic-avatar ${picAlt ? '' : ''}" style="${picAlt ? 'background:var(--grad-red)' : ''}">${picInit}</span> ${escapeHtml(t.assigned_to || '—')}</span>
              <span class="kc-deadline ${dlCls}">${dl_fmt} · ${fmtRelative(t.internal_deadline)}</span>
            </div>
            <div class="kc-progress"><i style="width:${t.progress}%"></i></div>
          </div>
        `;
      }).join('');
    });
    wireDragDrop();
  }

  /* ---------- Render: my tasks ---------- */
  function renderMyTasks() {
    const scope = visibleTasks();
    const userTasks = scope.filter((t) => isMyTask(t.assigned_to));
    const groups = {
      new: userTasks.filter((t) => ['pending', 'received'].includes(t.status)),
      progress: userTasks.filter((t) => ['inprogress', 'review'].includes(t.status)),
      revision: userTasks.filter((t) => ['revision', 'feedback_fix'].includes(t.status)),
      soon: userTasks.filter((t) => { const d = diffDays(t.internal_deadline); return d !== null && d >= 0 && d <= 2 && t.status !== 'completed'; }),
      done: userTasks.filter((t) => ['ready', 'completed', 'delivered'].includes(t.status)).slice(0, 5)
    };
    document.getElementById('vt-mytasks').textContent = userTasks.length;
    function fill(id, list) {
      const group = document.getElementById(id);
      group.querySelector('.count').textContent = list.length;
      const body = group.querySelector('.mt-list');
      if (list.length === 0) { body.innerHTML = ''; return; }
      body.innerHTML = list.map((t) => {
        const days = diffDays(t.internal_deadline);
        const cls = days !== null && t.status !== 'completed' ? (days < 0 ? 'is-overdue' : (days <= 2 ? 'is-soon' : '')) : '';
        return `
          <div class="mt-task ${cls}" data-id="${t.task_id}">
            <div class="mt-info">
              <b>${escapeHtml(t.project_name)}</b>
              <div class="mt-meta"><span class="mono">${t.task_id}</span> · ${TYPE_LABEL[t.task_type]} · <span class="tb-status s--${t.status}" style="font-size:9px; padding:1px 6px"><span class="dot"></span>${STATUS_LABEL[t.status]}</span></div>
            </div>
            <div class="mt-action">${fmtRelative(t.internal_deadline) || '—'}</div>
          </div>
        `;
      }).join('');
    }
    fill('mtg-new', groups.new);
    fill('mtg-progress', groups.progress);
    fill('mtg-revision', groups.revision);
    fill('mtg-soon', groups.soon);
    fill('mtg-done', groups.done);
  }

  /* ---------- Render coordinator ---------- */
  function render() {
    renderSummary();
    if (state.view === 'table') renderTable();
    else if (state.view === 'kanban') renderKanban();
    else renderMyTasks();
  }

  /* ---------- View switch ---------- */
  function setView(v) {
    state.view = v;
    document.querySelectorAll('.view-tab').forEach((t) => t.classList.toggle('is-active', t.getAttribute('data-view') === v));
    document.getElementById('view-table').style.display = v === 'table' ? '' : 'none';
    document.getElementById('view-kanban').style.display = v === 'kanban' ? '' : 'none';
    document.getElementById('view-mytasks').style.display = v === 'mytasks' ? '' : 'none';
    render();
  }
  document.getElementById('view-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.view-tab');
    if (!btn) return;
    setView(btn.getAttribute('data-view'));
  });

  // Subtitle per role
  const subtitle = document.getElementById('page-subtitle');
  if (subtitle) {
    const text = {
      admin: 'Quản lý toàn bộ task sản xuất — Kanban / Table / My Tasks.',
      account: 'Theo dõi task của order bạn phụ trách + duyệt nội bộ.',
      design: 'Task được giao cho bạn — cập nhật status, upload preview/final.',
      editor: 'Task được giao cho bạn — cập nhật status, upload preview/final.'
    };
    subtitle.textContent = text[user.role] || text.admin;
  }

  /* ---------- Toolbar ---------- */
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 180);
  });
  ['filter-status', 'filter-priority', 'filter-type', 'filter-pic'].forEach((id) => {
    const key = id.replace('filter-', '');
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => { state[key] = e.target.value; render(); });
  });

  // Summary quick filters
  document.querySelectorAll('.pb-stat').forEach((card) => {
    card.addEventListener('click', () => {
      const q = card.getAttribute('data-quick');
      if (state.quick === q || q === 'all') { state.quick = null; }
      else state.quick = q;
      document.querySelectorAll('.pb-stat').forEach((c) => c.classList.remove('is-active'));
      if (state.quick) card.classList.add('is-active');
      render();
    });
  });

  /* ---------- Drag & drop kanban ---------- */
  let draggedId = null;
  let colsWired = false;
  function wireDragDrop() {
    const canDrag = ['admin', 'account', 'design', 'editor'].includes(user.role);
    // Cards re-rendered each time → wire fresh
    document.querySelectorAll('.kanban-card').forEach((card) => {
      card.setAttribute('draggable', canDrag ? 'true' : 'false');
      card.addEventListener('dragstart', (e) => {
        draggedId = card.getAttribute('data-id');
        card.classList.add('is-dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        document.querySelectorAll('.kanban-col').forEach((c) => c.classList.remove('is-dragover'));
        draggedId = null;
      });
    });
    // Columns wired once (they persist between renders)
    if (colsWired) return;
    colsWired = true;
    document.querySelectorAll('.kanban-col').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('is-dragover'); });
      col.addEventListener('dragleave', () => col.classList.remove('is-dragover'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('is-dragover');
        if (!draggedId) return;
        const newStatus = col.getAttribute('data-status');
        const task = TASKS.find((t) => t.task_id === draggedId);
        if (!task || task.status === newStatus) return;
        if (!canTransition(task, newStatus)) {
          window.MH.toast({ type: 'warning', title: 'Không thể chuyển', message: getTransitionError(task, newStatus) });
          return;
        }
        updateStatus(task, newStatus);
      });
    });
  }

  /* ---------- Status transitions ---------- */
  function canTransition(task, newStatus) {
    // PIC (design/editor) cannot directly move to completed or ready
    if (['design', 'editor'].includes(user.role)) {
      if (newStatus === 'completed') return false;
      if (newStatus === 'ready' && task.status !== 'review') return false;
    }
    // Ready for delivery requires preview or final link
    if (newStatus === 'ready' && !task.preview_link && !task.final_link) return false;
    // Account/Admin can do anything else
    return true;
  }
  function getTransitionError(task, newStatus) {
    if (['design', 'editor'].includes(user.role) && newStatus === 'completed') return 'P.I.C không thể tự đóng task. Account/Admin sẽ chuyển sau bàn giao.';
    if (newStatus === 'ready' && !task.preview_link && !task.final_link) return 'Cần upload Preview hoặc Final link trước.';
    if (['design', 'editor'].includes(user.role) && newStatus === 'ready' && task.status !== 'review') return 'Task cần qua bước "Chờ duyệt nội bộ" trước.';
    return 'Transition không hợp lệ.';
  }
  /* ---------- Notify khi status task đổi (Account↔Designer handoff) ----------
     - review            → báo Account + Admin (có task chờ duyệt nội bộ)
     - revision/feedback_fix → báo PIC (task cần chỉnh sửa)
     Fire-and-forget, không block UI. */
  async function notifyTaskStatusChange(task, newStatus) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    const base = {
      related_entity_type: 'tasks',
      related_entity_id: task.task_id,
      link: 'production-board.html?id=' + task.task_id
    };
    try {
      if (newStatus === 'review') {
        const { data: staff } = await window.MH.supabase
          .from('users').select('id').in('role', ['admin', 'account']).eq('status', 'active');
        if (Array.isArray(staff) && staff.length) {
          await window.MH.supabase.from('notifications').insert(staff.map((u) => Object.assign({}, base, {
            user_id: u.id,
            type: 'task_status_changed',
            title: 'Task chờ duyệt nội bộ',
            message: `${task.task_id} · ${task.project_name || ''} — ${task.assigned_to || 'PIC'} đã gửi duyệt. Vui lòng kiểm tra.`
          })));
        }
      } else if (newStatus === 'revision' || newStatus === 'feedback_fix') {
        const picId = await window.MH.store.notifications.findUserIdByName(task.assigned_to);
        if (picId) {
          await window.MH.store.notifications.create(Object.assign({}, base, {
            user_id: picId,
            type: 'task_status_changed',
            title: 'Task cần chỉnh sửa',
            message: `${task.task_id} · ${task.project_name || ''} — Account yêu cầu chỉnh sửa. Xem ghi chú trong task.`
          }));
        }
      }
    } catch (e) { console.warn('[task] notify status change failed:', e); }
  }

  function updateStatus(task, newStatus) {
    const old = task.status;
    task.status = newStatus;
    task.progress = STATUS_PROGRESS[newStatus] ?? task.progress;
    task.last_update = fmtDT();
    if (newStatus === 'completed') task.completed_at = task.last_update;
    task.comments = task.comments || [];
    const transitionComment = { author: user.name, text: `Status: ${STATUS_LABEL[old]} → ${STATUS_LABEL[newStatus]}`, time: task.last_update, type: 'internal' };
    task.comments.push(transitionComment);
    // Phase 1: persist sang Supabase nếu enabled
    persistTask(task.task_id, {
      status: newStatus,
      progress: task.progress,
      last_update: new Date().toISOString(),
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null
    });
    persistTaskComment(task.task_id, transitionComment);
    notifyTaskStatusChange(task, newStatus); // fire-and-forget: báo Account/Admin (duyệt) hoặc PIC (sửa)
    window.MH.toast({ type: 'success', title: 'Đã cập nhật status', message: `${task.task_id}: ${STATUS_LABEL[newStatus]} · ${task.progress}%` });
    render();
    if (currentTask && currentTask.task_id === task.task_id) openDrawer(task);
  }

  /* ---------- Drawer ---------- */
  const drawer = document.getElementById('task-drawer');
  const drawerBd = document.getElementById('drawer-backdrop');
  const drawerBody = document.getElementById('drawer-body');
  let currentTask = null;

  function buildStatusActions(t) {
    const role = user.role;
    const actions = [];
    if (t.status === 'pending') actions.push({ id: 'received', label: 'Nhận task', desc: 'Xác nhận bắt đầu', cls: '' });
    if (t.status === 'received') actions.push({ id: 'inprogress', label: 'Bắt đầu sản xuất', desc: 'Chuyển → Đang thực hiện', cls: '' });
    if (t.status === 'inprogress') actions.push({ id: 'review', label: 'Gửi duyệt nội bộ', desc: 'Đã có preview / final', cls: 'sa--success' });
    if (t.status === 'review') {
      if (['admin', 'account'].includes(role)) {
        actions.push({ id: 'revision', label: 'Yêu cầu chỉnh sửa', desc: 'Quay lại P.I.C', cls: 'sa--warn' });
        actions.push({ id: 'ready', label: 'Đạt — Sẵn sàng bàn giao', desc: 'Push → Delivery Log', cls: 'sa--success', disabled: !t.preview_link && !t.final_link });
      }
    }
    if (t.status === 'revision') actions.push({ id: 'review', label: 'Đã chỉnh xong → Review lại', desc: 'Account duyệt lại', cls: '' });
    if (t.status === 'ready') {
      if (['admin', 'account'].includes(role)) actions.push({ id: 'completed', label: 'Đóng task — Hoàn thành', desc: 'Sau khi đã bàn giao client', cls: 'sa--success' });
    }
    // Always allow pause/cancel for admin/account
    if (['admin', 'account'].includes(role) && !['completed', 'cancelled'].includes(t.status)) {
      actions.push({ id: 'paused', label: 'Tạm dừng', desc: 'Thiếu thông tin / quyết định', cls: 'sa--warn' });
      actions.push({ id: 'cancelled', label: 'Hủy task', desc: 'Không triển khai', cls: 'sa--danger' });
    }
    return actions;
  }

  function buildProductionChecklist(t) {
    const statusRank = {
      pending: 0, received: 1, inprogress: 2, review: 3, revision: 3,
      feedback_wait: 3, feedback_fix: 3, ready: 4, delivered: 5, completed: 5
    };
    const rank = statusRank[t.status] || 0;
    const items = [
      { label: 'Nhận task và xác nhận bắt đầu xử lý', done: rank >= 1 },
      { label: 'Kiểm tra brief, nội dung và tài nguyên đầu vào', done: Boolean((t.content && t.content.trim()) || t.link_drive) },
      { label: 'Cập nhật source / preview / final link', done: Boolean(t.link_drive || t.preview_link || t.final_link) },
      { label: 'Gửi duyệt nội bộ cho Account / Lead', done: rank >= 3 },
      { label: 'Sẵn sàng bàn giao hoặc đóng task', done: rank >= 4 }
    ];
    const done = items.filter((item) => item.done).length;
    return { items, done, total: items.length };
  }

  function renderProductionChecklist(t) {
    const checklist = buildProductionChecklist(t);
    const pct = Math.round((checklist.done / checklist.total) * 100);
    return `
      <div class="tw-checklist-head">
        <span>Production Checklist</span>
        <b>${checklist.done}/${checklist.total}</b>
      </div>
      <div class="tw-check-progress"><span style="width:${pct}%"></span></div>
      <ul class="tw-checklist">
        ${checklist.items.map((item) => `
          <li class="${item.done ? 'is-done' : ''}">
            <span class="tw-check-box">${item.done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</span>
            <span>${escapeHtml(item.label)}</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  function taskActivityItems(t) {
    const items = [];
    if (t.created_at) items.push({ label: 'Tạo task', actor: t.comments?.[0]?.author || 'System', time: t.created_at });
    (t.comments || []).slice(-6).forEach((c) => {
      let label = 'Comment';
      if (/Status:/i.test(c.text || '')) label = 'Đổi trạng thái';
      else if (/links/i.test(c.text || '')) label = 'Cập nhật file/link';
      else if (/PIC=|deadline=|priority=/i.test(c.text || '')) label = 'Cập nhật thông tin task';
      else if (/Task được tạo|Standalone task/i.test(c.text || '')) label = 'Khởi tạo task';
      items.push({ label, actor: c.author || 'System', time: c.time || t.last_update });
    });
    if (!items.length) items.push({ label: 'Chưa có activity', actor: 'System', time: t.last_update || fmtDT() });
    return items.slice(-7).reverse();
  }

  function renderActivityRail(t) {
    return `
      <ol class="tw-activity">
        ${taskActivityItems(t).map((item) => `
          <li>
            <span class="tw-dot"></span>
            <div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.actor)}</small></div>
            <time>${fmtDateTime(item.time)}</time>
          </li>
        `).join('')}
      </ol>
    `;
  }

  function renderPeopleRail(t) {
    const names = [t.assigned_to, user.name, 'Account'].filter(Boolean);
    const unique = [...new Set(names)].slice(0, 3);
    return unique.map((name) => `<span class="tw-avatar" title="${escapeHtml(name)}">${escapeHtml(initials(name))}</span>`).join('');
  }

  function nextActionHint(t) {
    if (t.status === 'pending') return 'Nhận task để bắt đầu xử lý và cập nhật timeline.';
    if (t.status === 'received') return 'Bắt đầu sản xuất và cập nhật file nguồn khi có.';
    if (t.status === 'inprogress') return 'Hoàn tất preview/final link trước khi gửi duyệt nội bộ.';
    if (t.status === 'review') return 'Account / Lead kiểm tra và quyết định ready hoặc revision.';
    if (t.status === 'revision') return 'Cập nhật chỉnh sửa rồi gửi duyệt lại.';
    if (t.status === 'ready') return 'Chuẩn bị bàn giao qua Delivery Log.';
    return 'Theo dõi activity và cập nhật khi có thay đổi mới.';
  }

  function openDrawer(t) {
    currentTask = t;
    replyingToId = null;
    document.getElementById('d-task-id').textContent = t.task_id;
    document.getElementById('d-order-id').textContent = t.order_id;
    document.getElementById('d-project').textContent = t.project_name;
    const s = document.getElementById('d-status');
    s.className = 'tb-status s--' + t.status;
    s.innerHTML = '<span class="dot"></span>' + STATUS_LABEL[t.status];
    const p = document.getElementById('d-priority');
    p.className = 'priority-pill p--' + t.priority;
    p.innerHTML = '<span class="dot"></span>' + PRIORITY_LABEL[t.priority];
    document.getElementById('d-type').textContent = TYPE_LABEL[t.task_type] || t.task_type;
    document.getElementById('d-copy').setAttribute('data-copy', t.task_id);

    const days = diffDays(t.internal_deadline);
    const dlCls = days !== null && t.status !== 'completed' ? (days < 0 ? 'is-overdue' : (days <= 2 ? 'is-soon' : '')) : '';
    const dl = parseDate(t.internal_deadline);
    const dl_fmt = dl ? `${String(dl.getDate()).padStart(2,'0')}/${String(dl.getMonth()+1).padStart(2,'0')}/${dl.getFullYear()} ${String(dl.getHours()).padStart(2,'0')}:${String(dl.getMinutes()).padStart(2,'0')}` : '—';
    const v = (x) => x ? escapeHtml(x) : '<em class="muted">—</em>';
    const link = (u) => u ? `<a class="link" href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(u)}</a>` : '<em class="muted">Chưa có</em>';

    const actions = buildStatusActions(t);
    const actionsHtml = actions.length === 0 ? '<p class="text-xs muted">Không có action khả dụng ở status hiện tại.</p>'
      : `<div class="status-actions">${actions.map((a) => `
        <button class="status-action-btn ${a.cls || ''}" data-status="${a.id}" ${a.disabled ? 'disabled' : ''}>
          <span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          <span class="sa-text"><b>${a.label}</b><span>${a.desc}</span></span>
        </button>
      `).join('')}</div>`;

    const canEditLinks = user.role !== 'client' && (isMyTask(t.assigned_to) || ['admin', 'account'].includes(user.role));

    const linkInput = (id, value, placeholder) => canEditLinks
      ? `<input class="input" id="${id}" type="url" value="${escapeHtml(value || '')}" placeholder="${placeholder}" />`
      : `<span class="text-xs">${value ? `<a href="${escapeHtml(value)}" target="_blank" class="link">${escapeHtml(value)}</a>` : '<em class="muted">Chưa có</em>'}</span>`;
    const checklist = buildProductionChecklist(t);

    drawerBody.innerHTML = `
      <div class="task-summary-grid">
        <div class="task-summary-tile"><label>P.I.C</label><b>${v(t.assigned_to)}</b></div>
        <div class="task-summary-tile"><label>Internal Deadline</label><b class="deadline-cell ${dlCls}" style="background:none; padding:0">${dl_fmt}</b></div>
        <div class="task-summary-tile"><label>Loại task</label><b>${TYPE_LABEL[t.task_type] || t.task_type}</b></div>
        <div class="task-summary-tile"><label>Checklist</label><b>${checklist.done}/${checklist.total}</b></div>
      </div>

      <section class="drawer-block tw-worktype">
        <div class="drawer-block-head"><span class="block-letter">🔗</span><h4>Loại công việc</h4></div>
        ${(t.order_id && !t.is_standalone) ? `
          <p class="text-xs muted" style="margin:0 0 8px"><span class="worktype-badge worktype-badge--linked">Linked to Client Order</span></p>
          <div class="linked-order-card">
            <span class="lo-id">${escapeHtml(t.order_id)}</span>
            <span class="lo-title">${escapeHtml((ORDER_INDEX[t.order_id] && ORDER_INDEX[t.order_id].project_name) || t.project_name || '—')}</span>
            <a class="btn btn-secondary btn-sm" href="database-orders.html?id=${escapeHtml(t.order_id)}">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              Mở Order
            </a>
          </div>
        ` : `
          <p class="text-xs muted" style="margin:0 0 8px"><span class="worktype-badge worktype-badge--standalone">Standalone Internal Task</span></p>
          <p class="text-xs muted" style="margin:0">Công việc nội bộ độc lập — KHÔNG gắn Client Order. Task do team Media tự khởi tạo cho campaign nội bộ / brand asset / admin workstream.</p>
        `}
      </section>

      <section class="drawer-block tw-brief-card">
        <div class="drawer-block-head"><span class="block-letter">📋</span><h4>Brief Information</h4></div>
        <dl>
          <dt>Task ID</dt><dd><span class="mono">${escapeHtml(t.task_id)}</span></dd>
          <dt>Linked Order</dt><dd>${t.order_id ? `<span class="mono">${escapeHtml(t.order_id)}</span>` : '<em class="muted">Standalone</em>'}</dd>
          <dt>Content</dt><dd>${v(t.content)}</dd>
          <dt>Type</dt><dd>${TYPE_LABEL[t.task_type]}</dd>
          ${(t.task_type === 'photo' || t.task_type === 'shoot') ? `<dt>Địa điểm</dt><dd>${v(t.shoot_location)}</dd>` : ''}
        </dl>
      </section>

      <section class="drawer-block tw-check-card">
        <div class="drawer-block-head"><span class="block-letter">✓</span><h4>Production Checklist</h4></div>
        ${renderProductionChecklist(t)}
      </section>

      <section class="drawer-block tw-files-card">
        <div class="drawer-block-head"><span class="block-letter">🔗</span><h4>Files &amp; Links</h4></div>

        <div class="link-row ${t.link_drive ? 'has-link' : ''}">
          <span class="l-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></span>
          <div class="l-info"><b>Source / Working Drive</b>${canEditLinks ? '' : `<span>${t.link_drive ? `<a href="${escapeHtml(t.link_drive)}" target="_blank" class="link">${escapeHtml(t.link_drive)}</a>` : 'Chưa có'}</span>`}</div>
          ${canEditLinks ? linkInput('link-drive-in', t.link_drive, 'https://drive.google.com/...') : ''}
        </div>

        <div class="link-row ${t.preview_link ? 'has-link' : ''}">
          <span class="l-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
          <div class="l-info"><b>Preview Link</b>${canEditLinks ? '' : `<span>${t.preview_link ? `<a href="${escapeHtml(t.preview_link)}" target="_blank" class="link">${escapeHtml(t.preview_link)}</a>` : 'Chưa có'}</span>`}</div>
          ${canEditLinks ? linkInput('preview-in', t.preview_link, 'https://drive.google.com/preview...') : ''}
        </div>

        <div class="link-row ${t.final_link ? 'has-link' : ''}">
          <span class="l-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <div class="l-info"><b>Final Link</b>${canEditLinks ? '' : `<span>${t.final_link ? `<a href="${escapeHtml(t.final_link)}" target="_blank" class="link">${escapeHtml(t.final_link)}</a>` : 'Chưa có'}</span>`}</div>
          ${canEditLinks ? linkInput('final-in', t.final_link, 'https://drive.google.com/final...') : ''}
        </div>

        <div class="tw-upload-zone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Drop/upload file ở đây khi bật Supabase Storage cho deliverables</span>
        </div>

        ${canEditLinks ? `<div class="row" style="justify-content:flex-end; margin-top:8px"><button class="btn btn-secondary btn-sm" id="save-links">Lưu links</button></div>` : ''}
      </section>

      <section class="drawer-block tw-action-rail">
        <div class="drawer-block-head"><span class="block-letter">⚡</span><h4>Status &amp; Actions</h4></div>
        <div class="tw-rail-section">
          <span class="tw-rail-label">Next Actions</span>
        </div>
        ${actionsHtml}
        ${['admin', 'account'].includes(user.role) ? `
        <div class="edit-row mt-4">
          <label>P.I.C</label>
          <select class="select" id="edit-pic">
            ${['Duy', 'Vinh', 'Linh Chi', 'Mai Phương'].map((p) => `<option ${t.assigned_to === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Internal Deadline</label>
          <input class="input" id="edit-deadline" type="datetime-local" value="${toLocalInput(t.internal_deadline)}" />
        </div>
        <div class="edit-row">
          <label>Priority</label>
          <select class="select" id="edit-priority">
            ${Object.entries(PRIORITY_LABEL).map(([k, l]) => `<option value="${k}" ${t.priority === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="row" style="justify-content:flex-end; margin-top:8px"><button class="btn btn-secondary btn-sm" id="save-meta">Lưu thay đổi</button></div>
        ` : ''}

        <div class="tw-rail-section">
          <span class="tw-rail-label">Người liên quan</span>
          <div class="tw-people">${renderPeopleRail(t)}</div>
        </div>

        <div class="tw-ai-card">
          <span>Gợi ý bước tiếp theo</span>
          <p>${escapeHtml(nextActionHint(t))}</p>
          <button type="button" class="btn btn-secondary btn-sm" id="tw-generate-checklist">Tạo checklist</button>
        </div>

        <div class="tw-rail-section">
          <span class="tw-rail-label">Activity Log</span>
          ${renderActivityRail(t)}
        </div>
      </section>

      <section class="drawer-block tw-comments-card">
        <div class="drawer-block-head"><span class="block-letter">💬</span><h4>Comments &amp; Activity (${(t.comments || []).length})</h4></div>
        <div class="tw-comment-tabs">
          <button type="button" class="is-active">Comment</button>
          <button type="button">Activity</button>
        </div>
        <div class="comments-thread" id="comments-thread">
          ${renderCommentsThread(t)}
        </div>

        <div class="comment-composer">
          <div class="composer-reply-banner" id="reply-banner" style="display:none;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            <span class="reply-target">Đang reply <b id="reply-target-name"></b></span>
            <span class="reply-snip" id="reply-snip"></span>
            <button type="button" class="close-reply" id="cancel-reply" aria-label="Hủy reply">×</button>
          </div>
          <div class="comment-composer-wrap">
            <textarea class="textarea" id="comment-input" placeholder="Viết comment... gõ @ để mention"></textarea>
            <div class="mention-dropdown" id="mention-dropdown"></div>
          </div>
          <div class="row">
            <div class="composer-type">
              <label for="comment-type">Loại:</label>
              <select class="select" id="comment-type">
                <option value="internal">Internal</option>
                <option value="revision">Revision</option>
                <option value="feedback">Client Feedback</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm" id="add-comment">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Gửi
            </button>
          </div>
        </div>
      </section>
    `;

    // Wire status action buttons
    drawerBody.querySelectorAll('.status-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const newStatus = btn.getAttribute('data-status');
        if (!canTransition(currentTask, newStatus)) {
          window.MH.toast({ type: 'warning', title: 'Không thể chuyển', message: getTransitionError(currentTask, newStatus) });
          return;
        }
        updateStatus(currentTask, newStatus);
      });
    });

    const aiChecklistBtn = document.getElementById('tw-generate-checklist');
    if (aiChecklistBtn) {
      aiChecklistBtn.addEventListener('click', () => {
        window.MH.toast({ type: 'info', title: 'Checklist đã sẵn sàng', message: 'Production checklist đang được tính từ status, links và dữ liệu task hiện tại.' });
      });
    }

    // Save links
    const saveLinksBtn = document.getElementById('save-links');
    if (saveLinksBtn) {
      saveLinksBtn.addEventListener('click', () => {
        currentTask.link_drive = document.getElementById('link-drive-in').value.trim();
        currentTask.preview_link = document.getElementById('preview-in').value.trim();
        currentTask.final_link = document.getElementById('final-in').value.trim();
        currentTask.last_update = fmtDT();
        currentTask.comments = currentTask.comments || [];
        const linksComment = { author: user.name, text: 'Cập nhật links', time: currentTask.last_update, type: 'internal' };
        currentTask.comments.push(linksComment);
        persistTask(currentTask.task_id, {
          link_drive: currentTask.link_drive,
          preview_link: currentTask.preview_link,
          final_link: currentTask.final_link,
          last_update: new Date().toISOString()
        });
        persistTaskComment(currentTask.task_id, linksComment);
        window.MH.toast({ type: 'success', title: 'Đã lưu links', message: currentTask.task_id });
        render(); openDrawer(currentTask);
      });
    }

    // Save meta
    const saveMetaBtn = document.getElementById('save-meta');
    if (saveMetaBtn) {
      saveMetaBtn.addEventListener('click', () => {
        currentTask.assigned_to = document.getElementById('edit-pic').value;
        currentTask.internal_deadline = document.getElementById('edit-deadline').value.replace('T', ' ');
        currentTask.priority = document.getElementById('edit-priority').value;
        currentTask.last_update = fmtDT();
        currentTask.comments = currentTask.comments || [];
        const metaComment = { author: user.name, text: `Đã cập nhật: PIC=${currentTask.assigned_to} · deadline=${currentTask.internal_deadline} · priority=${PRIORITY_LABEL[currentTask.priority]}`, time: currentTask.last_update, type: 'internal' };
        currentTask.comments.push(metaComment);
        persistTask(currentTask.task_id, {
          assigned_to: currentTask.assigned_to,
          internal_deadline: currentTask.internal_deadline ? new Date(currentTask.internal_deadline.replace(' ', 'T')).toISOString() : null,
          priority: currentTask.priority,
          last_update: new Date().toISOString()
        });
        persistTaskComment(currentTask.task_id, metaComment);
        window.MH.toast({ type: 'success', title: 'Đã lưu thay đổi', message: currentTask.task_id });
        render(); openDrawer(currentTask);
      });
    }

    // ============ Comments: add / reply / @mention autocomplete ============
    const commentInput = document.getElementById('comment-input');
    const replyBanner = document.getElementById('reply-banner');
    const replyTargetName = document.getElementById('reply-target-name');
    const replySnip = document.getElementById('reply-snip');
    const mentionDropdown = document.getElementById('mention-dropdown');

    function setReplyTarget(commentId) {
      replyingToId = commentId;
      const target = commentId ? findCommentById(currentTask, commentId) : null;
      if (target) {
        replyTargetName.textContent = '@' + target.author;
        const snip = (target.text || '').replace(/\s+/g, ' ').slice(0, 60);
        replySnip.textContent = '— ' + snip + (target.text.length > 60 ? '…' : '');
        replyBanner.style.display = 'flex';
        commentInput.focus();
      } else {
        replyingToId = null;
        replyBanner.style.display = 'none';
      }
    }

    // Reply button on each comment
    drawerBody.querySelectorAll('button[data-reply]').forEach((btn) => {
      btn.addEventListener('click', () => setReplyTarget(btn.getAttribute('data-reply')));
    });

    // Scroll to parent comment when clicking reply indicator
    drawerBody.querySelectorAll('.reply-indicator[data-scroll-to]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = drawerBody.querySelector('#cm-' + el.getAttribute('data-scroll-to'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.outline = '2px solid var(--primary)';
          setTimeout(() => { target.style.outline = ''; }, 1400);
        }
      });
    });

    // Cancel reply
    document.getElementById('cancel-reply').addEventListener('click', () => setReplyTarget(null));

    // @mention autocomplete on textarea
    const teamForUser = teamMembersForUser(user.name);
    let mentionActiveIndex = 0;
    let mentionQueryStart = -1; // index in input where '@' was typed

    function closeMentionDropdown() {
      mentionDropdown.classList.remove('is-open');
      mentionDropdown.innerHTML = '';
      mentionQueryStart = -1;
    }

    function renderMentionDropdown(query) {
      const q = (query || '').toLowerCase();
      const matches = teamForUser.filter((m) => m.name.toLowerCase().includes(q));
      if (!matches.length) {
        mentionDropdown.innerHTML = '<div class="empty">Không tìm thấy thành viên</div>';
      } else {
        mentionDropdown.innerHTML = matches.map((m, i) => `
          <div class="mention-option ${i === mentionActiveIndex ? 'is-active' : ''}" data-name="${escapeHtml(m.name)}" data-index="${i}">
            <span class="ca-mini ${(['Hậu','Linh Chi','Vinh'].indexOf(m.name) % 2 === 0 && m.name) ? 'has-red' : ''}">${initials(m.name)}</span>
            <span>${escapeHtml(m.name)}${m.is_self ? ' <small style="color:var(--text-muted)">(bạn)</small>' : ''}</span>
          </div>
        `).join('');
      }
      mentionDropdown.classList.add('is-open');
      // Bind option click
      mentionDropdown.querySelectorAll('.mention-option').forEach((opt) => {
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault(); // keep focus on textarea
          insertMention(opt.getAttribute('data-name'));
        });
      });
    }

    function insertMention(name) {
      if (mentionQueryStart < 0) return;
      const val = commentInput.value;
      const before = val.slice(0, mentionQueryStart);
      const after = val.slice(commentInput.selectionStart);
      const mention = '@' + name + ' ';
      commentInput.value = before + mention + after;
      const newPos = (before + mention).length;
      commentInput.setSelectionRange(newPos, newPos);
      closeMentionDropdown();
    }

    commentInput.addEventListener('input', () => {
      const val = commentInput.value;
      const caret = commentInput.selectionStart;
      // Look back from caret for '@' (no whitespace between @ and caret)
      const lookback = val.slice(0, caret);
      const atMatch = lookback.match(/@([^\s@]*)$/);
      if (atMatch) {
        mentionQueryStart = caret - atMatch[0].length;
        mentionActiveIndex = 0;
        renderMentionDropdown(atMatch[1]);
      } else {
        closeMentionDropdown();
      }
    });

    commentInput.addEventListener('keydown', (e) => {
      if (!mentionDropdown.classList.contains('is-open')) return;
      const options = mentionDropdown.querySelectorAll('.mention-option');
      if (!options.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionActiveIndex = (mentionActiveIndex + 1) % options.length;
        options.forEach((o, i) => o.classList.toggle('is-active', i === mentionActiveIndex));
        options[mentionActiveIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionActiveIndex = (mentionActiveIndex - 1 + options.length) % options.length;
        options.forEach((o, i) => o.classList.toggle('is-active', i === mentionActiveIndex));
        options[mentionActiveIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(options[mentionActiveIndex].getAttribute('data-name'));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMentionDropdown();
      }
    });

    commentInput.addEventListener('blur', () => {
      // Delay so option mousedown can register before close
      setTimeout(() => closeMentionDropdown(), 120);
    });

    // Submit comment
    document.getElementById('add-comment').addEventListener('click', () => {
      const text = commentInput.value.trim();
      if (!text) return;
      const type = document.getElementById('comment-type').value;
      const mentions = parseMentions(text);
      const replyParent = replyingToId ? findCommentById(currentTask, replyingToId) : null;
      currentTask.comments = currentTask.comments || [];
      const newComment = {
        id: genCommentId(),
        author: user.name,
        text,
        time: fmtDT(),
        type,
        mentions,
        reply_to: replyParent ? replyParent.id : null,
        reply_to_author: replyParent ? replyParent.author : null
      };
      currentTask.comments.push(newComment);
      currentTask.last_update = fmtDT();
      persistTaskComment(currentTask.task_id, newComment);
      persistTask(currentTask.task_id, { last_update: new Date().toISOString() });
      const toastMsg = replyParent
        ? `Đã reply @${replyParent.author}`
        : (mentions.length ? `Đã gửi · mention ${mentions.length}` : 'Đã gửi comment');
      window.MH.toast({ type: 'success', message: toastMsg });
      replyingToId = null;
      render(); openDrawer(currentTask);
    });

    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerBd.classList.add('is-open');
    document.body.style.overflow = 'hidden';
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

  /* ---------- Click handlers ---------- */
  function openByEvent(e) {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = row.getAttribute('data-id');
    const task = TASKS.find((t) => t.task_id === id);
    if (task) openDrawer(task);
  }
  tbody.addEventListener('click', openByEvent);
  document.getElementById('view-kanban').addEventListener('click', openByEvent);
  document.getElementById('view-mytasks').addEventListener('click', openByEvent);

  /* ---------- Drilldown from Master/Task Dashboard ----------
     Expanded (Module 4) cho 17 KPI của Task Dashboard. */
  const DRILLDOWN_MAP = {
    // Master Dashboard legacy keys
    in_production:    { quick: 'inproduction',  view: 'table', label: 'In Production',     desc: 'Task đang sản xuất (Nhận / Đang thực hiện / Chỉnh sửa).' },
    internal_review:  { quick: 'review',        view: 'table', label: 'Internal Review',   desc: 'Task chờ duyệt nội bộ.' },
    due_soon:         { quick: 'soon',          view: 'table', label: 'Due Soon',          desc: 'Task tới hạn trong 48h, chưa hoàn thành.' },
    overdue:          { quick: 'overdue',       view: 'table', label: 'Overdue Tasks',     desc: 'Task đã quá hạn nội bộ, chưa hoàn thành.' },
    on_time_rate:     { quick: 'completed',     view: 'table', label: 'On-time Rate',      desc: 'Task đã hoàn thành — đối chiếu deadline để tính SLA.' },
    // Task Volume
    linked:           { quick: 'linked',        view: 'table', label: 'Linked Tasks',      desc: 'Internal tasks gắn với Client Order.' },
    standalone:       { quick: 'standalone',    view: 'table', label: 'Standalone Tasks',  desc: 'Công việc nội bộ độc lập, không gắn Client Order.' },
    pending:          { quick: 'pending',       view: 'table', label: 'New / Pending',     desc: 'Task mới được giao, chưa nhận.' },
    // Workload
    unassigned:       { quick: 'unassigned',    view: 'table', label: 'Unassigned Tasks',  desc: 'Task chưa gán P.I.C.' },
    // Deadline
    due_today:        { quick: 'due_today',     view: 'table', label: 'Due Today',         desc: 'Task tới hạn hôm nay, chưa hoàn thành.' },
    due_week:         { quick: 'due_week',      view: 'table', label: 'Due This Week',     desc: 'Task tới hạn trong 7 ngày tới, chưa hoàn thành.' },
    // Production Status
    revision:         { quick: 'revision',      view: 'table', label: 'Revision',          desc: 'Task đang chỉnh sửa nội bộ.' },
    status_completed: { quick: 'completed',     view: 'table', label: 'Completed',         desc: 'Task đã hoàn thành.' },
    blocked:          { quick: 'blocked',       view: 'table', label: 'Blocked',           desc: 'Task tạm dừng / bị block.' },
    // Performance
    completed_week:   { quick: 'completed_week',view: 'table', label: 'Completed This Week', desc: 'Task hoàn thành trong 7 ngày qua.' }
  };
  function applyDrilldownFromURL() {
    const params = new URLSearchParams(location.search);
    const key = params.get('dl');
    if (!key || !DRILLDOWN_MAP[key]) return null;
    const cfg = DRILLDOWN_MAP[key];
    state.view = cfg.view;
    state.quick = cfg.quick;
    document.querySelectorAll('.pb-stat').forEach((c) => c.classList.toggle('is-active', c.getAttribute('data-quick') === cfg.quick));
    return cfg;
  }
  function clearDrilldown() {
    state.quick = null;
    state.view = ['design', 'editor'].includes(user.role) ? 'mytasks' : 'table';
    document.querySelectorAll('.pb-stat').forEach((c) => c.classList.remove('is-active'));
    history.replaceState(null, '', location.pathname);
    const banner = document.getElementById('dl-banner');
    if (banner) banner.remove();
    setView(state.view);
  }
  function injectDrilldownBanner(cfg) {
    const anchor = document.querySelector('.table-card');
    if (!anchor) return;
    const filtered = applyFilters(visibleTasks());
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

  /* ---------- Init ---------- */
  setView(state.view);
  if (drilldownCfg) {
    injectDrilldownBanner(drilldownCfg);
    document.querySelector('.table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Auto-open task drawer khi ?id=MEDIA-* hoặc ?id=TASK-* được pass (Alert Center, notification click...).
  const focusId = new URLSearchParams(location.search).get('id');
  function tryFocusTask(showToast) {
    if (!focusId) return false;
    const task = TASKS.find((t) => t.task_id === focusId || t.order_id === focusId);
    if (task) { setTimeout(() => openDrawer(task), 80); return true; }
    if (showToast) {
      window.MH.toast({ type: 'warning', title: 'Không tìm thấy task', message: `${focusId} không có trong dataset.`, duration: 5000 });
    }
    return false;
  }
  const focusedFromMock = tryFocusTask(false);

  // Phase 1: nếu Supabase enabled, swap dataset bằng dữ liệu thật rồi re-render.
  loadTasksFromStore(TASKS).then(function (n) {
    if (typeof n === 'number') {
      console.log('[production-board] swapped ' + n + ' tasks từ Supabase');
      // Re-build ORDER_INDEX với dataset mới
      Object.keys(ORDER_INDEX).forEach(function (k) { delete ORDER_INDEX[k]; });
      TASKS.forEach(function (t) {
        if (t.order_id && !ORDER_INDEX[t.order_id]) ORDER_INDEX[t.order_id] = { project_name: t.project_name };
      });
      render();
      if (currentTask) {
        const updated = TASKS.find(function (t) { return t.task_id === currentTask.task_id; });
        if (updated) openDrawer(updated);
      }
      if (focusId && !focusedFromMock) tryFocusTask(true);
    } else if (focusId && !focusedFromMock) {
      tryFocusTask(true);
    }
  });

  /* ---------- Quick filter chips ---------- */
  const chipsRow = document.getElementById('quick-filter-chips');
  if (chipsRow) {
    chipsRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.saved-view-chip');
      if (!btn) return;
      const f = btn.getAttribute('data-quick-filter') || '';
      state.quickChip = f;
      chipsRow.querySelectorAll('.saved-view-chip').forEach((c) => c.classList.toggle('is-active', c === btn));
      render();
    });
  }

  /* ---------- Create / Edit Task modal ----------
     Module 2 (5/2026): standalone checkbox → radio group "Loại công việc" với
     2 option: 'linked' (gắn Client Order) hoặc 'standalone' (Internal Task độc lập).
     `is_standalone` field trong data model giữ nguyên — UI chỉ đổi cách user chọn. */
  const modal = document.getElementById('task-modal');
  const modalBd = document.getElementById('task-modal-backdrop');
  const tmWorktypeLinked = document.getElementById('tm-worktype-linked');
  const tmWorktypeStandalone = document.getElementById('tm-worktype-standalone');
  const tmOrderRow = document.getElementById('tm-order-row');
  const tmStandaloneHint = document.getElementById('tm-standalone-hint');
  const tmOrderId = document.getElementById('tm-order-id');
  const tmProject = document.getElementById('tm-project');
  const tmContent = document.getElementById('tm-content');
  const tmType = document.getElementById('tm-type');
  const tmPriority = document.getElementById('tm-priority');
  const tmPic = document.getElementById('tm-pic');
  const tmDeadline = document.getElementById('tm-deadline');
  const tmStatus = document.getElementById('tm-status');
  const tmLocationRow = document.getElementById('tm-location-row');
  const tmLocation = document.getElementById('tm-location');
  const modalTitle = document.getElementById('task-modal-title');
  let editingTaskId = null;

  function applyWorktypeUI(isStandalone) {
    tmOrderRow.style.display = isStandalone ? 'none' : '';
    tmStandaloneHint.style.display = isStandalone ? '' : 'none';
  }
  // Show "Địa điểm" row khi task_type là chụp/quay
  function applyLocationUI() {
    if (!tmLocationRow) return;
    const isShoot = (tmType.value === 'photo' || tmType.value === 'shoot');
    tmLocationRow.style.display = isShoot ? '' : 'none';
  }
  if (tmType) tmType.addEventListener('change', applyLocationUI);

  function openTaskModal(prefill, editId) {
    editingTaskId = editId || null;
    modalTitle.textContent = editId ? 'Sửa công việc nội bộ' : 'Giao việc nội bộ mới';
    const p = prefill || {};
    const isStandalone = !!p.is_standalone || (editId ? !!p.is_standalone : false);
    if (isStandalone) {
      tmWorktypeStandalone.checked = true;
      tmWorktypeLinked.checked = false;
    } else {
      tmWorktypeLinked.checked = true;
      tmWorktypeStandalone.checked = false;
    }
    applyWorktypeUI(isStandalone);
    tmOrderId.value = p.order_id || '';
    tmProject.value = p.project_name || '';
    tmContent.value = p.content || '';
    tmType.value = p.task_type || 'design';
    if (tmLocation) tmLocation.value = p.shoot_location || '';
    applyLocationUI();
    tmPriority.value = p.priority || 'normal';
    tmPic.value = p.assigned_to || '';
    if (p.internal_deadline) {
      tmDeadline.value = toLocalInput(p.internal_deadline);
    } else {
      tmDeadline.value = '';
    }
    tmStatus.value = p.status || 'pending';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modalBd.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => tmProject.focus(), 60);
  }
  function closeTaskModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalBd.classList.remove('is-open');
    document.body.style.overflow = '';
    editingTaskId = null;
  }
  // Helper: lấy worktype hiện tại (true = standalone, false = linked)
  function isWorktypeStandalone() {
    return tmWorktypeStandalone && tmWorktypeStandalone.checked;
  }
  // Radio group change handler — toggle order row + helper text
  [tmWorktypeLinked, tmWorktypeStandalone].forEach((radio) => {
    if (!radio) return;
    radio.addEventListener('change', () => {
      const std = isWorktypeStandalone();
      applyWorktypeUI(std);
      if (std) tmOrderId.value = '';
    });
  });
  document.getElementById('btn-create-task').addEventListener('click', () => {
    if (user.role === 'client') return;
    openTaskModal({ assigned_to: user.name && ['Duy','Vinh','Linh Chi','Mai Phương'].includes(user.name) ? user.name : '' });
  });
  document.getElementById('task-modal-close').addEventListener('click', closeTaskModal);
  document.getElementById('task-modal-cancel').addEventListener('click', closeTaskModal);
  modalBd.addEventListener('click', () => { if (modal.classList.contains('is-open')) closeTaskModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeTaskModal(); });

  document.getElementById('task-modal-save').addEventListener('click', () => {
    const project = tmProject.value.trim();
    if (!project) {
      window.MH.toast({ type: 'warning', title: 'Thiếu project name', message: 'Vui lòng nhập tên project / task.' });
      tmProject.focus();
      return;
    }
    const isStandalone = isWorktypeStandalone();
    const orderId = isStandalone ? '' : (tmOrderId.value || '').trim();
    // Validation: linked option phải có Client Order ID
    if (!isStandalone && !orderId) {
      window.MH.toast({ type: 'warning', title: 'Thiếu Client Order ID', message: 'Chọn "Liên kết với Client Order" thì cần nhập mã MEDIA-*, hoặc đổi sang "Công việc nội bộ độc lập".' });
      tmOrderId.focus();
      return;
    }
    const deadlineRaw = tmDeadline.value ? tmDeadline.value.replace('T', ' ') : '';
    const status = tmStatus.value || 'pending';

    if (editingTaskId) {
      const t = TASKS.find((x) => x.task_id === editingTaskId);
      if (!t) { closeTaskModal(); return; }
      t.project_name = project;
      t.content = tmContent.value.trim();
      t.task_type = tmType.value;
      t.shoot_location = (t.task_type === 'photo' || t.task_type === 'shoot') ? (tmLocation ? tmLocation.value.trim() : '') : '';
      t.priority = tmPriority.value;
      t.assigned_to = tmPic.value || null;
      t.internal_deadline = deadlineRaw || null;
      t.status = status;
      t.progress = STATUS_PROGRESS[status] ?? t.progress;
      t.is_standalone = isStandalone;
      t.order_id = isStandalone ? '' : orderId;
      t.last_update = fmtDT();
      t.comments = t.comments || [];
      const editComment = { id: genCommentId(), author: user.name, text: 'Đã cập nhật task (Edit modal).', time: t.last_update, type: 'internal' };
      t.comments.push(editComment);
      // Persist updated extras (localStorage fallback)
      const extras = loadExtraTasks();
      const idx = extras.findIndex((x) => x.task_id === t.task_id);
      if (idx >= 0) { extras[idx] = t; saveExtraTasks(extras); }
      // Phase 1: persist sang Supabase nếu enabled
      const editPatch = {
        project_name: t.project_name,
        content: t.content,
        task_type: t.task_type,
        priority: t.priority,
        assigned_to: t.assigned_to,
        internal_deadline: t.internal_deadline ? new Date(t.internal_deadline.replace(' ', 'T')).toISOString() : null,
        status: t.status,
        progress: t.progress,
        is_standalone: t.is_standalone,
        order_id: t.is_standalone ? null : t.order_id,
        last_update: new Date().toISOString()
      };
      // Chỉ pass shoot_location key khi type là photo/shoot — tránh fail nếu DB chưa có migration cột này.
      if (t.task_type === 'photo' || t.task_type === 'shoot') editPatch.shoot_location = t.shoot_location || null;
      persistTask(t.task_id, editPatch);
      persistTaskComment(t.task_id, editComment);
      window.MH.toast({ type: 'success', title: 'Đã lưu task', message: t.task_id });
      closeTaskModal();
      render();
      if (currentTask && currentTask.task_id === t.task_id) openDrawer(t);
      return;
    }

    const newTaskType = tmType.value;
    const newShootLoc = (newTaskType === 'photo' || newTaskType === 'shoot') ? (tmLocation ? tmLocation.value.trim() : '') : '';
    const newTask = {
      task_id: nextTaskId(),
      order_id: orderId,
      is_standalone: isStandalone,
      project_name: project,
      task_type: newTaskType,
      content: tmContent.value.trim(),
      shoot_location: newShootLoc,
      priority: tmPriority.value,
      assigned_to: tmPic.value || null,
      status: status,
      progress: STATUS_PROGRESS[status] ?? 20,
      internal_deadline: deadlineRaw || null,
      link_drive: '', preview_link: '', final_link: '',
      created_at: fmtDT(),
      last_update: fmtDT(),
      comments: [{ id: genCommentId(), author: user.name, text: orderId ? `Task được tạo từ Order ${orderId}.` : 'Standalone task được tạo.', time: fmtDT(), type: 'internal' }]
    };
    TASKS.push(newTask);
    appendExtraTask(newTask);
    if (newTask.order_id && !ORDER_INDEX[newTask.order_id]) ORDER_INDEX[newTask.order_id] = { project_name: newTask.project_name };
    // Phase 1: persist sang Supabase (full row insert via upsert)
    const createPatch = {
      order_id: newTask.order_id || null,
      is_standalone: newTask.is_standalone,
      project_name: newTask.project_name,
      task_type: newTask.task_type,
      content: newTask.content,
      priority: newTask.priority,
      assigned_to: newTask.assigned_to,
      status: newTask.status,
      progress: newTask.progress,
      internal_deadline: newTask.internal_deadline ? new Date(newTask.internal_deadline.replace(' ', 'T')).toISOString() : null,
      link_drive: newTask.link_drive,
      preview_link: newTask.preview_link,
      final_link: newTask.final_link,
      created_at: new Date().toISOString(),
      last_update: new Date().toISOString()
    };
    // Chỉ pass shoot_location khi photo/shoot — backward-compat với DB chưa migrate.
    if (newTask.task_type === 'photo' || newTask.task_type === 'shoot') createPatch.shoot_location = newTask.shoot_location || null;
    persistTask(newTask.task_id, createPatch);
    if (newTask.comments && newTask.comments.length) {
      persistTaskComment(newTask.task_id, newTask.comments[0]);
    }
    window.MH.toast({ type: 'success', title: '✓ Đã tạo task', message: `${newTask.task_id} · ${newTask.project_name}` });
    closeTaskModal();
    render();
    openDrawer(newTask);
  });

  /* ---------- Auto-open Create Task modal khi ?createTask=1 (prefill from query) ---------- */
  (function handleCreateFromURL() {
    const params = new URLSearchParams(location.search);
    if (params.get('createTask') !== '1') return;
    if (user.role === 'client') return;
    const prefill = {
      order_id: params.get('order_id') || '',
      project_name: params.get('project_name') || '',
      task_type: params.get('task_type') || params.get('request_type') || 'design',
      priority: params.get('priority') || 'normal',
      internal_deadline: params.get('internal_deadline') || '',
      assigned_to: params.get('production_pic') || params.get('assigned_to') || '',
      content: params.get('content') || '',
      shoot_location: params.get('shoot_location') || '',
      is_standalone: params.get('standalone') === '1'
    };
    setTimeout(() => openTaskModal(prefill), 120);
    // Clean URL so refresh doesn't re-open modal
    const url = new URL(location.href);
    ['createTask','order_id','project_name','task_type','request_type','priority','internal_deadline','production_pic','assigned_to','content','standalone'].forEach((k) => url.searchParams.delete(k));
    history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
  })();

  /* ---------- Expose "Edit Task" via drawer (admin/account/PIC) — hook the drawer-head Edit pencil ---------- */
  function attachDrawerEditButton() {
    const head = document.querySelector('#task-drawer .drawer-head > div');
    if (!head || head.querySelector('.btn-edit-task')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-sm btn-edit-task';
    btn.style.marginTop = '8px';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Sửa công việc';
    btn.addEventListener('click', () => {
      if (!currentTask) return;
      openTaskModal({
        order_id: currentTask.order_id,
        is_standalone: !!currentTask.is_standalone || !currentTask.order_id,
        project_name: currentTask.project_name,
        task_type: currentTask.task_type,
        content: currentTask.content,
        priority: currentTask.priority,
        assigned_to: currentTask.assigned_to,
        status: currentTask.status,
        internal_deadline: currentTask.internal_deadline
      }, currentTask.task_id);
    });
    head.appendChild(btn);
  }
  // Patch openDrawer so we attach the Edit button each time
  const _origOpenDrawer = openDrawer;
  openDrawer = function (t) {
    _origOpenDrawer(t);
    if (['admin', 'account'].includes(user.role) || isMyTask(t.assigned_to)) attachDrawerEditButton();
  };
})();
