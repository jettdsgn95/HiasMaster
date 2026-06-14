/* =====================================================================
   CB Media Hub — Reports module logic
   - Auth guard: admin/account
   - LIVE data từ Supabase qua MH.store.orders/tasks/users (wired 2026-06-12).
     Supabase chưa enabled → empty state (zero-build fallback, không mock).
   - Filters (period/role/PIC/branch/type) recompute client-side từ RAW snapshot.
   - Render: 12 KPI cards, 6 charts (line SVG, donut, h-bars, stacked, heatmap, quality)
   -         Delivery funnel, rating distribution, SLA
   - Tables: PIC KPI · Overdue Risk · Feedback Rating
   - Export PDF/Excel (CSV download)
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  // system_supervisor: read-only monitor — được xem Reports + export (không có mutation trong module này).
  if (!['admin', 'account', 'system_supervisor'].includes(user.role)) {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Reports chỉ dành cho Admin/Account.' });
    setTimeout(() => location.replace('dashboard.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('mh-user'); window.MH.toast({ type: 'info', title: 'Đã đăng xuất' });
    setTimeout(() => location.href = 'login.html', 500);
  });
  const sb = document.getElementById('dash-sb'), sbd = document.getElementById('sb-backdrop'), sbt = document.getElementById('sb-toggle');
  if (sbt) sbt.addEventListener('click', () => { sb.classList.add('is-open'); sbd.classList.add('is-open'); });
  if (sbd) sbd.addEventListener('click', () => { sb.classList.remove('is-open'); sbd.classList.remove('is-open'); });

  /* ---------- Report data (LIVE từ Supabase — computeReportData() điền) ---------- */
  const TREND_DAYS = 14;
  let TREND = [];
  let TYPES = [];
  let ROLES = [];
  let PICS = [];
  let HEATMAP = [];
  let FUNNEL = [];
  let RATINGS = [];
  let PIC_KPI = [];
  let OVERDUE = [];
  let FEEDBACK = [];

  const KPI_AGG = {
    orders: 0, tasks: 0, completed: 0, progress: 0, ontime: 0, overdue: 0,
    rating: 0, ratedCount: 0, coverage: 0, ratedTotal: 0,
    revision: 0, reopened: 0, briefNeed: 0, briefOk: 0, delivery: 0,
    dlOntrack: 0, dlSoon: 0, dlToday: 0, dlLate: 0, avgCompletion: 0
  };

  // Snapshot orders/tasks/users từ store — filter chỉ recompute từ đây, không refetch
  const RAW = { orders: [], tasks: [], users: [] };

  const TYPE_LABEL = { design: 'Design / POSM', digital: 'Digital', video: 'Video', motion: 'Motion', shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads', slide: 'Slide', media: 'Quay / Chụp', other: 'Khác' };
  const TYPE_COLOR = { design: '#191970', digital: '#3849b3', video: '#BA110F', motion: '#d62a28', shoot: '#f59e0b', photo: '#10b981', ads: '#0ea5e9', slide: '#6c5ec0', media: '#f59e0b', other: '#94a3b8' };
  // Vị trí đảm nhiệm suy từ task_type — khớp value của #filter-role (design/editor/shoot)
  const ROLE_OF_TASK_TYPE = { design: 'design', digital: 'design', ads: 'design', slide: 'design', video: 'editor', motion: 'editor', shoot: 'shoot', photo: 'shoot' };
  const ROLE_BAR_LABEL = { design: 'Design', editor: 'Editor (Video)', shoot: 'Media (Quay/Chụp)' };
  const TASK_STATUS_LABEL = { pending: 'Chờ nhận', received: 'Đã nhận', inprogress: 'Đang xử lý', review: 'Chờ duyệt', revision: 'Chỉnh sửa', feedback_wait: 'Chờ feedback', feedback_fix: 'Sửa feedback', ready: 'Sẵn sàng', delivered: 'Đã bàn giao', completed: 'Hoàn thành', paused: 'Tạm dừng', cancelled: 'Đã hủy' };

  /* ---------- Helpers ---------- */
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function emptyState(msg) { return `<div style="padding:24px 12px;text-align:center;color:var(--text-muted);font-size:12px">${escapeHtml(msg)}</div>`; }
  function parseDate(s) {
    if (!s) return null;
    const d = new Date(typeof s === 'string' ? s.replace(' ', 'T') : s);
    return isNaN(d.getTime()) ? null : d;
  }
  function diffDaysFromNow(deadline) {
    const d = parseDate(deadline);
    if (!d) return null;
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dlStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((dlStart - dayStart) / 86400000);
  }
  function isOverdueD(deadline, isCompleted) {
    if (!deadline || isCompleted) return false;
    const d = parseDate(deadline);
    return d ? d.getTime() < Date.now() : false;
  }
  function isCompletedStatus(s) { return s === 'completed' || s === 'delivered'; }
  function isOpenStatus(s) { return !isCompletedStatus(s) && s !== 'cancelled' && s !== 'paused'; }
  function fmtDM(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }

  /* ---------- Load + filter (LIVE) ---------- */
  async function loadReportsFromStore() {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) {
      console.warn('[reports] Supabase chưa enabled — giữ empty state.');
      return;
    }
    try {
      await window.MH.supabaseReady;
      const [orders, tasks, users] = await Promise.all([
        window.MH.store.orders.list(),
        window.MH.store.tasks.list(),
        window.MH.store.users.list().catch(() => [])
      ]);
      RAW.orders = Array.isArray(orders) ? orders : [];
      RAW.tasks = Array.isArray(tasks) ? tasks : [];
      RAW.users = Array.isArray(users) ? users : [];
      populatePicFilter();
      recompute();
    } catch (e) {
      console.warn('[reports] load failed:', e);
    }
  }

  function populatePicFilter() {
    const sel = document.getElementById('filter-pic');
    if (!sel) return;
    const cur = sel.value;
    const names = new Set();
    RAW.tasks.forEach((t) => { if (t.assigned_to) names.add(t.assigned_to); });
    RAW.orders.forEach((o) => { [o.production_pic, o.production_pic_video, o.production_pic_photo].forEach((p) => { if (p) names.add(p); }); });
    sel.innerHTML = '<option value="">Mọi PIC</option>' + [...names].sort().map((n) => `<option${n === cur ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
  }

  function periodStart(period) {
    const now = new Date();
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const days = parseInt(period, 10) || 30;
    return new Date(Date.now() - days * 86400000);
  }

  function applyFilters() {
    const period = document.getElementById('filter-period').value;
    const role = document.getElementById('filter-role').value;
    const pic = document.getElementById('filter-pic').value;
    const dept = document.getElementById('filter-department').value;
    const type = document.getElementById('filter-type').value;

    const from = periodStart(period).getTime();
    const inPeriod = (iso) => { const d = parseDate(iso); return !d || d.getTime() >= from; }; // thiếu created_at → giữ lại

    let orders = RAW.orders.filter((o) => inPeriod(o.created_at));
    let tasks = RAW.tasks.filter((t) => inPeriod(t.created_at));

    if (dept) orders = orders.filter((o) => (o.department || '').includes(dept));
    if (type) {
      tasks = tasks.filter((t) => t.task_type === type);
      // order media gộp Quay/Chụp → vẫn khớp khi lọc shoot/photo
      orders = orders.filter((o) => o.request_type === type || (o.request_type === 'media' && (type === 'shoot' || type === 'photo')));
    }
    // role 'account' không gán task → giữ toàn hệ thống
    if (role && role !== 'account') tasks = tasks.filter((t) => (ROLE_OF_TASK_TYPE[t.task_type] || 'design') === role);
    if (pic) {
      tasks = tasks.filter((t) => (t.assigned_to || '').includes(pic));
      orders = orders.filter((o) => [o.production_pic, o.production_pic_video, o.production_pic_photo, o.account_pic].some((p) => (p || '').includes(pic)));
    }
    return { orders, tasks };
  }

  function recompute() {
    const f = applyFilters();
    computeReportData(f.orders, f.tasks, RAW.users);
    renderAll();
  }

  /* ---------- Aggregate orders/tasks → KPI_AGG + chart/table arrays ---------- */
  function computeReportData(orders, tasks, users) {
    // Match word-boundary để "Du" không khớp nhầm "Duy Trần" (Du=Media ≠ Duy=Design)
    const userRoleFor = (n) => {
      const u = (users || []).find((x) => x.name && (x.name === n || x.name.startsWith(n + ' ') || n.startsWith(x.name + ' ')));
      return u ? u.role : null;
    };
    const orderById = {};
    orders.forEach((o) => { orderById[o.order_id] = o; });

    const completedT = tasks.filter((t) => isCompletedStatus(t.status));
    const openT = tasks.filter((t) => isOpenStatus(t.status));
    const overdueOpen = openT.filter((t) => isOverdueD(t.internal_deadline, false));
    const rated = orders.filter((o) => o.satisfaction_score != null);
    const deliveredO = orders.filter((o) => !!o.final_delivery_link || ['final', 'rated', 'completed'].includes(o.delivery_status) || ['delivered', 'completed'].includes(o.production_status));

    /* KPI */
    KPI_AGG.orders = orders.length;
    KPI_AGG.tasks = tasks.length;
    KPI_AGG.completed = completedT.length;
    KPI_AGG.progress = openT.filter((t) => t.status !== 'pending').length;
    const eligible = completedT.length + overdueOpen.length;
    KPI_AGG.ontime = eligible === 0 ? 0 : Math.round((completedT.length / eligible) * 100);
    KPI_AGG.overdue = overdueOpen.length;
    KPI_AGG.ratedCount = rated.length;
    KPI_AGG.ratedTotal = deliveredO.length;
    KPI_AGG.rating = rated.length ? +(rated.reduce((s, o) => s + o.satisfaction_score, 0) / rated.length).toFixed(1) : 0;
    KPI_AGG.coverage = deliveredO.length ? Math.round((rated.length / deliveredO.length) * 100) : 0;
    // revision_round có sau migration add-revision-rounds.sql — chưa chạy thì undefined → 0
    const previewed = orders.filter((o) => !!o.preview_link);
    KPI_AGG.revision = previewed.length ? +(previewed.reduce((s, o) => s + (o.revision_round || 0), 0) / previewed.length).toFixed(1) : 0;
    KPI_AGG.reopened = orders.filter((o) => o.delivery_status === 'reopened').length;
    KPI_AGG.briefNeed = orders.filter((o) => o.account_status === 'needinfo').length;
    KPI_AGG.briefOk = orders.filter((o) => o.account_status === 'confirmed').length;
    KPI_AGG.delivery = deliveredO.length;

    let ontrack = 0, soon = 0, today = 0, late = 0;
    openT.forEach((t) => {
      if (!t.internal_deadline) return;
      const days = diffDaysFromNow(t.internal_deadline);
      if (days === null) return;
      if (isOverdueD(t.internal_deadline, false)) late++;
      else if (days === 0) today++;
      else if (days <= 3) soon++;
      else ontrack++;
    });
    KPI_AGG.dlOntrack = ontrack; KPI_AGG.dlSoon = soon; KPI_AGG.dlToday = today; KPI_AGG.dlLate = late;

    const cw = completedT.filter((t) => parseDate(t.created_at) && parseDate(t.completed_at || t.last_update));
    KPI_AGG.avgCompletion = cw.length
      ? +(cw.reduce((s, t) => s + Math.max(0, parseDate(t.completed_at || t.last_update) - parseDate(t.created_at)), 0) / cw.length / 86400000).toFixed(1)
      : 0;

    /* TREND — 14 ngày gần nhất */
    const sameDay = (iso, d) => { const x = parseDate(iso); return !!x && x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };
    TREND = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      TREND.push({
        date: d,
        label: fmtDM(d),
        orders: orders.filter((o) => sameDay(o.created_at, d)).length,
        tasks: tasks.filter((t) => sameDay(t.created_at, d)).length,
        completed: tasks.filter((t) => isCompletedStatus(t.status) && sameDay(t.completed_at || t.last_update, d)).length,
        overdue: tasks.filter((t) => isOpenStatus(t.status) && sameDay(t.internal_deadline, d) && isOverdueD(t.internal_deadline, false)).length
      });
    }
    if (!TREND.some((d) => d.orders || d.tasks || d.completed || d.overdue)) TREND = [];

    /* TYPES — donut theo task_type */
    const typeCounts = {};
    tasks.forEach((t) => { const k = t.task_type || 'other'; typeCounts[k] = (typeCounts[k] || 0) + 1; });
    TYPES = Object.keys(typeCounts)
      .map((k) => ({ label: TYPE_LABEL[k] || k, color: TYPE_COLOR[k] || '#94a3b8', count: typeCounts[k] }))
      .sort((a, b) => b.count - a.count);

    /* ROLES — theo vị trí suy từ task_type */
    const roleAgg = {};
    tasks.forEach((t) => {
      const r = ROLE_OF_TASK_TYPE[t.task_type] || 'design';
      if (!roleAgg[r]) roleAgg[r] = { total: 0, completed: 0, scores: [] };
      roleAgg[r].total++;
      if (isCompletedStatus(t.status)) roleAgg[r].completed++;
      const o = t.order_id && orderById[t.order_id];
      if (o && o.satisfaction_score != null) roleAgg[r].scores.push(o.satisfaction_score);
    });
    ROLES = Object.keys(roleAgg).map((r) => ({
      label: ROLE_BAR_LABEL[r] || r,
      cls: 'role--' + r,
      total: roleAgg[r].total,
      completed: roleAgg[r].completed,
      rating: roleAgg[r].scores.length ? +(roleAgg[r].scores.reduce((s, v) => s + v, 0) / roleAgg[r].scores.length).toFixed(1) : '–'
    })).sort((a, b) => b.total - a.total);

    /* PIC aggregate — dùng chung cho stacked bar + bảng KPI */
    const picAgg = {};
    tasks.forEach((t) => {
      const name = t.assigned_to || '— Chưa gán —';
      if (!picAgg[name]) picAgg[name] = { total: 0, done: 0, ontime: 0, soon: 0, overdue: 0, rev: 0, scores: [], compMs: [], types: {} };
      const a = picAgg[name];
      const r = ROLE_OF_TASK_TYPE[t.task_type] || 'design';
      a.total++;
      a.types[r] = (a.types[r] || 0) + 1;
      if (isCompletedStatus(t.status)) {
        a.done++;
        const doneAt = parseDate(t.completed_at || t.last_update);
        if (!t.internal_deadline || (doneAt && doneAt <= parseDate(t.internal_deadline))) a.ontime++;
        if (parseDate(t.created_at) && doneAt) a.compMs.push(Math.max(0, doneAt - parseDate(t.created_at)));
      } else if (isOpenStatus(t.status)) {
        if (isOverdueD(t.internal_deadline, false)) a.overdue++;
        else { const days = diffDaysFromNow(t.internal_deadline); if (days !== null && days <= 3) a.soon++; }
      }
      if (t.status === 'revision' || t.status === 'feedback_fix') a.rev++;
      const o = t.order_id && orderById[t.order_id];
      if (o && o.satisfaction_score != null) a.scores.push(o.satisfaction_score);
    });
    PICS = Object.keys(picAgg)
      .map((n) => ({ name: n, total: picAgg[n].total, ontime: picAgg[n].ontime, soon: picAgg[n].soon, overdue: picAgg[n].overdue, done: picAgg[n].done }))
      .sort((a, b) => b.total - a.total).slice(0, 8);

    /* HEATMAP — orders+tasks tạo theo thứ trong tuần */
    const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    orders.forEach((o) => { const d = parseDate(o.created_at); if (d) dowCounts[d.getDay()]++; });
    tasks.forEach((t) => { const d = parseDate(t.created_at); if (d) dowCounts[d.getDay()]++; });
    const dowMax = Math.max(1, ...dowCounts);
    HEATMAP = dowCounts.some((c) => c > 0)
      ? [1, 2, 3, 4, 5, 6, 0].map((i) => ({ day: DOW[i], count: dowCounts[i], intensity: Math.min(4, Math.ceil((dowCounts[i] / dowMax) * 4)) }))
      : [];

    /* FUNNEL — lifecycle order: Tiếp nhận → ... → Đánh giá */
    const cProd = orders.filter((o) => o.production_status && o.production_status !== 'unassigned').length;
    const cFeedback = orders.filter((o) => (o.revision_round || 0) > 0 || !!o.client_feedback).length;
    FUNNEL = orders.length === 0 ? [] : [
      { label: 'Tiếp nhận', count: orders.length },
      { label: 'Brief xác nhận', count: KPI_AGG.briefOk },
      { label: 'Sản xuất', count: cProd },
      { label: 'Preview', count: previewed.length },
      { label: 'Feedback', count: cFeedback },
      { label: 'Final', count: orders.filter((o) => !!o.final_delivery_link).length },
      { label: 'Đánh giá', count: rated.length }
    ].map((s) => ({ ...s, pct: Math.round((s.count / orders.length) * 100) }));

    /* RATINGS — phân bố 5→1 sao */
    RATINGS = rated.length
      ? [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rated.filter((o) => o.satisfaction_score === stars).length }))
      : [];

    /* PIC_KPI — bảng xếp hạng nhân sự */
    const ROLE_TITLE = { admin: 'Admin', account: 'Account', design: 'Design', editor: 'Editor', content: 'Content', lead_content: 'Lead Content' };
    PIC_KPI = Object.keys(picAgg).filter((n) => n !== '— Chưa gán —').map((n) => {
      const a = picAgg[n];
      const eligiblePic = a.done + a.overdue;
      const ontimePct = eligiblePic ? Math.round((a.ontime / eligiblePic) * 100) : 0;
      const rating = a.scores.length ? +(a.scores.reduce((s, v) => s + v, 0) / a.scores.length).toFixed(1) : null;
      const avgMs = a.compMs.length ? a.compMs.reduce((s, v) => s + v, 0) / a.compMs.length : null;
      // KPI composite: 60% on-time + 25% rating (chưa có rating → 70 neutral) + 15% ít revision
      const kpi = Math.round(0.6 * ontimePct + 0.25 * (rating != null ? (rating / 5) * 100 : 70) + 0.15 * Math.max(0, 100 - (a.rev / Math.max(1, a.total)) * 100));
      const domRole = Object.keys(a.types).sort((x, y) => a.types[y] - a.types[x])[0];
      return {
        role: ROLE_TITLE[userRoleFor(n)] || ROLE_BAR_LABEL[domRole] || '—',
        name: n, total: a.total, done: a.done, ontime: ontimePct, late: a.overdue, rev: a.rev,
        rating: rating != null ? rating : '–',
        time: avgMs != null ? (avgMs / 86400000).toFixed(1) + 'd' : '—',
        kpi
      };
    }).sort((a, b) => b.kpi - a.kpi);

    /* OVERDUE & risk — task open trễ hạn hoặc còn ≤2 ngày */
    OVERDUE = openT.filter((t) => {
      if (!t.internal_deadline) return false;
      const days = diffDaysFromNow(t.internal_deadline);
      return isOverdueD(t.internal_deadline, false) || (days !== null && days <= 2);
    }).map((t) => {
      const days = diffDaysFromNow(t.internal_deadline);
      const over = isOverdueD(t.internal_deadline, false);
      const dl = parseDate(t.internal_deadline);
      return {
        task: t.task_id,
        order: t.order_id || 'Standalone',
        project: t.project_name || '—',
        type: TYPE_LABEL[t.task_type] || t.task_type || '—',
        pic: t.assigned_to || '—',
        account: (t.order_id && orderById[t.order_id] && orderById[t.order_id].account_pic) || '—',
        priority: t.priority || 'normal',
        deadline: dl ? `${fmtDM(dl)} ${String(dl.getHours()).padStart(2, '0')}:${String(dl.getMinutes()).padStart(2, '0')}` : '—',
        overdue: over ? (days === 0 ? 'Trễ hôm nay' : `Trễ ${-days} ngày`) : (days === 0 ? 'Còn hôm nay' : `Còn ${days} ngày`),
        status: t.status,
        _days: over ? Math.min(days, -0.5) : days
      };
    }).sort((a, b) => a._days - b._days).slice(0, 10);

    /* FEEDBACK — top 6 rating gần nhất */
    FEEDBACK = rated.slice()
      .sort((a, b) => (parseDate(b.last_updated) || 0) - (parseDate(a.last_updated) || 0))
      .slice(0, 6)
      .map((o) => {
        const d = parseDate(o.last_updated);
        return {
          order: o.order_id, project: o.project_name || '—', requester: o.requester_name || '—',
          account: o.account_pic || '—',
          pic: o.production_pic || o.production_pic_video || o.production_pic_photo || '—',
          rating: o.satisfaction_score, fb: o.client_feedback || '—', cats: [],
          date: d ? `${fmtDM(d)}/${d.getFullYear()}` : '—'
        };
      });
  }

  /* ---------- Render KPI ---------- */
  function renderKPI() {
    setText('kpi-orders', KPI_AGG.orders);
    setText('kpi-tasks', KPI_AGG.tasks);
    setText('kpi-completed', KPI_AGG.completed);
    setText('kpi-progress', KPI_AGG.progress);
    setText('kpi-ontime', KPI_AGG.ontime + '%');
    setText('kpi-overdue', KPI_AGG.overdue);
    setText('kpi-rating', KPI_AGG.rating);
    setText('kpi-rated-count', KPI_AGG.ratedCount);
    setText('kpi-coverage', KPI_AGG.coverage + '%');
    setText('kpi-coverage-ratio', `${KPI_AGG.ratedCount}/${KPI_AGG.ratedTotal}`);
    setText('kpi-revision', KPI_AGG.revision);
    setText('kpi-reopened', KPI_AGG.reopened);
    setText('kpi-briefneed', KPI_AGG.briefNeed);
    setText('kpi-delivery', KPI_AGG.delivery);
    setText('sla-num', KPI_AGG.ontime);
    setText('avg-completion', KPI_AGG.avgCompletion);
    document.getElementById('sla-bar').style.width = KPI_AGG.ontime + '%';
    setText('dl-ontrack', KPI_AGG.dlOntrack);
    setText('dl-soon', KPI_AGG.dlSoon);
    setText('dl-today', KPI_AGG.dlToday);
    setText('dl-late', KPI_AGG.dlLate);
  }

  /* ---------- Chart 1: Line chart (SVG) ---------- */
  function renderLineChart() {
    const wrap = document.getElementById('line-chart-wrap');
    if (!TREND.length) { wrap.innerHTML = emptyState('Chưa có hoạt động trong 14 ngày gần nhất.'); return; }
    const W = 800, H = 240, P = { l: 36, r: 12, t: 16, b: 28 };
    const innerW = W - P.l - P.r;
    const innerH = H - P.t - P.b;

    const series = [
      { key: 'orders',    color: '#191970',     fill: '#191970' },
      { key: 'tasks',     color: '#f59e0b',     fill: '#f59e0b' },
      { key: 'completed', color: '#10b981',     fill: '#10b981' },
      { key: 'overdue',   color: '#BA110F',     fill: '#BA110F' }
    ];
    const maxY = Math.max(...TREND.flatMap((d) => series.map((s) => d[s.key]))) + 2;
    const step = innerW / Math.max(1, TREND.length - 1);

    function x(i) { return P.l + i * step; }
    function y(v) { return P.t + innerH - (v / maxY) * innerH; }

    let html = `<svg class="line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;

    // Grid lines (4 horizontal)
    for (let i = 0; i <= 4; i++) {
      const yy = P.t + (innerH / 4) * i;
      html += `<line class="grid-line" x1="${P.l}" y1="${yy}" x2="${P.l + innerW}" y2="${yy}" />`;
      const val = Math.round(maxY * (1 - i / 4));
      html += `<text class="axis-text" x="${P.l - 6}" y="${yy + 3}" text-anchor="end">${val}</text>`;
    }

    // X-axis labels (every 2nd)
    TREND.forEach((d, i) => {
      if (i % 2 === 0 || i === TREND.length - 1) {
        html += `<text class="axis-text" x="${x(i)}" y="${H - P.b + 16}" text-anchor="middle">${d.label}</text>`;
      }
    });

    // Series
    series.forEach((s) => {
      // Area fill
      let pathFill = `M ${x(0)} ${H - P.b} `;
      TREND.forEach((d, i) => { pathFill += `L ${x(i)} ${y(d[s.key])} `; });
      pathFill += `L ${x(TREND.length - 1)} ${H - P.b} Z`;
      html += `<path class="series-area" d="${pathFill}" fill="${s.fill}" opacity="0.08" />`;

      // Line
      let path = '';
      TREND.forEach((d, i) => {
        path += (i === 0 ? 'M' : 'L') + ` ${x(i)} ${y(d[s.key])} `;
      });
      html += `<path class="series-line" d="${path}" stroke="${s.color}" />`;

      // Dots
      TREND.forEach((d, i) => {
        html += `<circle class="series-dot" cx="${x(i)}" cy="${y(d[s.key])}" r="3" fill="#fff" stroke="${s.color}"><title>${d.label} · ${s.key}: ${d[s.key]}</title></circle>`;
      });
    });

    html += '</svg>';
    wrap.innerHTML = html;
  }

  /* ---------- Chart 2: Donut ---------- */
  function renderTypeDonut() {
    const total = TYPES.reduce((s, t) => s + t.count, 0);
    setText('type-total', total);
    if (!total) {
      document.getElementById('type-donut').style.background = 'var(--surface-2)';
      document.getElementById('type-legend').innerHTML = emptyState('Chưa có task trong kỳ.');
      return;
    }
    // conic gradient
    let acc = 0;
    const stops = TYPES.map((t) => {
      const start = (acc / total) * 100;
      acc += t.count;
      const end = (acc / total) * 100;
      return `${t.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }).join(', ');
    const donut = document.getElementById('type-donut');
    donut.style.background = `conic-gradient(${stops})`;
    // Legend
    document.getElementById('type-legend').innerHTML = TYPES.map((t) => {
      const pct = ((t.count / total) * 100).toFixed(1);
      return `<div class="status-legend-item"><i style="background:${t.color}"></i><span>${t.label}</span><span class="pct">${pct}%</span></div>`;
    }).join('');
  }

  /* ---------- Chart 3: Role performance (horizontal bar) ---------- */
  function renderRoleBars() {
    if (!ROLES.length) { document.getElementById('role-bars').innerHTML = emptyState('Chưa có dữ liệu.'); return; }
    const maxTotal = Math.max(...ROLES.map((r) => r.total));
    document.getElementById('role-bars').innerHTML = ROLES.map((r) => {
      const pct = (r.total / maxTotal) * 100;
      const donePct = (r.completed / r.total) * 100;
      return `
        <div class="h-bar-row ${r.cls}">
          <div class="label">${r.label}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%"></div>
            <span class="bar-fill-text">${r.completed}/${r.total} · ${donePct.toFixed(0)}%</span>
          </div>
          <div class="val">${r.total}<small>★ ${r.rating}</small></div>
        </div>
      `;
    }).join('');
  }

  /* ---------- Chart 4: PIC stacked bar ---------- */
  function renderPICBars() {
    if (!PICS.length) { document.getElementById('pic-bars').innerHTML = emptyState('Chưa có dữ liệu.'); return; }
    const maxTotal = Math.max(...PICS.map((p) => p.total));
    document.getElementById('pic-bars').innerHTML = PICS.map((p) => {
      const tot = p.total;
      const segs = [
        { key: 'ontime',  val: p.ontime,  cls: 'stk--ontime' },
        { key: 'soon',    val: p.soon,    cls: 'stk--soon' },
        { key: 'overdue', val: p.overdue, cls: 'stk--overdue' },
        { key: 'done',    val: p.done - p.ontime, cls: 'stk--done' }  // additional completed beyond on-time
      ].filter((s) => s.val > 0);
      const segHtml = segs.map((s) => `<i class="${s.cls}" style="width:${(s.val/tot)*100}%" title="${s.key}: ${s.val}"></i>`).join('');
      const widthPct = (tot / maxTotal) * 100;
      const init = p.name.substring(0, 2).toUpperCase();
      return `
        <div class="stacked-row">
          <div class="label"><span class="ava">${init}</span> ${p.name}</div>
          <div class="stacked-bar" style="width:${widthPct}%">${segHtml}</div>
          <div class="total">${tot}</div>
        </div>
      `;
    }).join('');
  }

  /* ---------- Chart 5: Heatmap ---------- */
  function renderHeatmap() {
    if (!HEATMAP.length) { document.getElementById('heatmap').innerHTML = emptyState('Chưa có dữ liệu.'); return; }
    let html = '<div class="hm-rowlabel"></div>';
    HEATMAP.forEach((d) => html += `<div class="hm-collabel">${d.day}</div>`);
    html += `<div class="hm-rowlabel">Workload</div>`;
    HEATMAP.forEach((d) => {
      html += `<div class="hm-cell" data-intensity="${d.intensity}" title="${d.day}: ${d.count} tasks">${d.count}</div>`;
    });
    document.getElementById('heatmap').innerHTML = html;
  }

  /* ---------- Funnel ---------- */
  function renderFunnel() {
    if (!FUNNEL.length || !FUNNEL[0].count) { document.getElementById('funnel').innerHTML = emptyState('Chưa có order trong kỳ.'); return; }
    const max = FUNNEL[0].count;
    const colors = [
      'linear-gradient(135deg, #191970 0%, #3849b3 100%)',
      'linear-gradient(135deg, #1d2580 0%, #3849b3 100%)',
      'linear-gradient(135deg, #232b8f 0%, #4351be 100%)',
      'linear-gradient(135deg, #4351be 0%, #6c5ec0 100%)',
      'linear-gradient(135deg, #6c5ec0 0%, #ad3c63 100%)',
      'linear-gradient(135deg, #ad3c63 0%, #d62a28 100%)',
      'linear-gradient(135deg, #d62a28 0%, #BA110F 100%)'
    ];
    document.getElementById('funnel').innerHTML = FUNNEL.map((s, i) => {
      const w = (s.count / max) * 100;
      return `<div class="funnel-report-step" style="width:${w}%; background:${colors[i]}"><b>${escapeHtml(s.label)}</b><span class="fn-count">${s.count}</span><span class="fn-pct">${s.pct}%</span></div>`;
    }).join('');
  }

  /* ---------- Rating distribution ---------- */
  function renderRatingDist() {
    if (!RATINGS.length) { document.getElementById('rating-dist').innerHTML = emptyState('Chưa có đánh giá từ client.'); return; }
    const max = Math.max(1, ...RATINGS.map((r) => r.count));
    document.getElementById('rating-dist').innerHTML = RATINGS.map((r) => {
      const w = (r.count / max) * 100;
      const lowCls = r.stars <= 2 ? 'rd--low' : '';
      const stars = '★'.repeat(r.stars);
      return `<div class="rating-dist-row ${lowCls}">
        <div class="rd-label">${stars}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
        <div class="val">${r.count}</div>
      </div>`;
    }).join('');
  }

  /* ---------- Quality cells ---------- */
  function renderQuality() {
    setText('q-brief-ok', KPI_AGG.briefOk);
    setText('q-brief-bad', KPI_AGG.briefNeed);
    setText('q-rated', KPI_AGG.ratedCount);
    setText('q-norate', KPI_AGG.ratedTotal - KPI_AGG.ratedCount);
    setText('q-reopen', KPI_AGG.reopened);
    setText('q-ontime', KPI_AGG.ontime + '%');
    setText('q-late', (100 - KPI_AGG.ontime) + '%');
    setText('q-rev', KPI_AGG.revision);
  }

  /* ---------- Tables ---------- */
  function kpiBadge(score) {
    if (score >= 95) return `<span class="kpi-score s--excellent">${score}/100</span>`;
    if (score >= 88) return `<span class="kpi-score s--good">${score}/100</span>`;
    if (score >= 75) return `<span class="kpi-score s--ok">${score}/100</span>`;
    return `<span class="kpi-score s--poor">${score}/100</span>`;
  }

  function renderPICTable() {
    if (!PIC_KPI.length) {
      document.getElementById('pic-table-body').innerHTML = `<tr><td colspan="10">${emptyState('Chưa có task được gán PIC trong kỳ.')}</td></tr>`;
      return;
    }
    document.getElementById('pic-table-body').innerHTML = PIC_KPI.map((p, i) => {
      const init = p.name.substring(0, 2).toUpperCase();
      const alt = i % 2 === 1 ? 'has-red' : '';
      return `<tr>
        <td><span class="text-xs">${escapeHtml(p.role)}</span></td>
        <td><div class="pic-cell ${alt}"><span class="pic-avatar">${init}</span><span class="pic-name">${escapeHtml(p.name)}</span></div></td>
        <td><b>${p.total}</b></td>
        <td>${p.done}</td>
        <td><b style="color:var(--success)">${p.ontime}%</b></td>
        <td>${p.late ? `<b style="color:var(--red-600)">${p.late}</b>` : '0'}</td>
        <td>${p.rev}</td>
        <td><b style="color:#f59e0b">★ ${p.rating}</b></td>
        <td><span class="mono text-xs">${p.time}</span></td>
        <td>${kpiBadge(p.kpi)}</td>
      </tr>`;
    }).join('');
  }

  function renderOverdueTable() {
    if (!OVERDUE.length) {
      document.getElementById('overdue-table-body').innerHTML = `<tr><td colspan="10">${emptyState('Không có task rủi ro deadline — tốt!')}</td></tr>`;
      return;
    }
    document.getElementById('overdue-table-body').innerHTML = OVERDUE.map((t) => {
      const picInit = t.pic.substring(0, 2).toUpperCase();
      const accInit = t.account.substring(0, 2).toUpperCase();
      const picAlt = ['Hậu', 'Linh Chi', 'Vinh'].indexOf(t.pic) % 2 === 0 ? 'has-red' : '';
      const isOverdue = t.overdue.startsWith('Còn') ? false : true;
      return `<tr class="${isOverdue ? 'is-overdue' : ''}">
        <td><div style="display:flex; flex-direction:column; gap:2px"><span class="order-id">${t.task}</span><span class="mono text-xs muted">${t.order}</span></div></td>
        <td><b>${escapeHtml(t.project)}</b></td>
        <td><span class="text-xs">${t.type}</span></td>
        <td><div class="pic-cell ${picAlt}"><span class="pic-avatar">${picInit}</span><span class="pic-name">${escapeHtml(t.pic)}</span></div></td>
        <td><div class="pic-cell"><span class="pic-avatar">${accInit}</span><span class="pic-name">${escapeHtml(t.account)}</span></div></td>
        <td><span class="priority-pill p--${t.priority}"><span class="dot"></span>${t.priority === 'critical' ? 'Rất gấp' : t.priority === 'urgent' ? 'Gấp' : 'Bình thường'}</span></td>
        <td><span class="mono text-xs">${t.deadline.split(' ')[0]}</span></td>
        <td><b style="color:${isOverdue ? 'var(--red-600)' : 'var(--warning-fg)'}">${t.overdue}</b></td>
        <td><span class="tb-status s--${t.status}"><span class="dot"></span>${TASK_STATUS_LABEL[t.status] || t.status}</span></td>
        <td><a class="btn btn-ghost btn-sm" href="production-board.html?id=${encodeURIComponent(t.task)}">Mở</a></td>
      </tr>`;
    }).join('');
  }

  function renderFeedbackTable() {
    const FB_LABEL = { quality: 'Chất lượng', timing: 'Tiến độ', coord: 'Phối hợp', content: 'Nội dung', file: 'File' };
    const FB_CLS = { quality: 'is-quality', timing: 'is-timing', coord: 'is-coord', content: 'is-content', file: 'is-file' };
    if (!FEEDBACK.length) {
      document.getElementById('feedback-table-body').innerHTML = `<tr><td colspan="9">${emptyState('Chưa có rating/feedback từ client trong kỳ.')}</td></tr>`;
      return;
    }
    document.getElementById('feedback-table-body').innerHTML = FEEDBACK.map((f) => {
      const accInit = f.account.substring(0, 2).toUpperCase();
      const picInit = f.pic.substring(0, 2).toUpperCase();
      const picAlt = ['Hậu', 'Linh Chi', 'Vinh'].indexOf(f.pic) % 2 === 0 ? 'has-red' : '';
      const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
      const cats = f.cats.map((k) => `<span class="fb-cat ${FB_CLS[k]}">${FB_LABEL[k]}</span>`).join('');
      const lowRating = f.rating <= 3;
      return `<tr>
        <td><span class="mono text-xs">${f.order}</span></td>
        <td><b>${escapeHtml(f.project)}</b></td>
        <td><span class="text-xs">${escapeHtml(f.requester)}</span></td>
        <td><div class="pic-cell"><span class="pic-avatar">${accInit}</span><span class="pic-name">${escapeHtml(f.account)}</span></div></td>
        <td><div class="pic-cell ${picAlt}"><span class="pic-avatar">${picInit}</span><span class="pic-name">${escapeHtml(f.pic)}</span></div></td>
        <td><span style="color:${lowRating ? 'var(--red-600)' : '#f59e0b'}; font-weight:700; font-size:13px">${stars}</span></td>
        <td><span class="text-xs" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:240px">${escapeHtml(f.fb)}</span></td>
        <td><div class="fb-categories">${cats}</div></td>
        <td><span class="mono text-xs muted">${f.date}</span></td>
      </tr>`;
    }).join('');
  }

  /* ---------- Filter handlers — recompute từ RAW snapshot ---------- */
  function updateFilterSummary() {
    const period = document.getElementById('filter-period').selectedOptions[0].textContent;
    const role = document.getElementById('filter-role').value;
    const pic = document.getElementById('filter-pic').value;
    const dept = document.getElementById('filter-department').value;
    const tags = [period];
    if (role) tags.push(role);
    if (pic) tags.push('PIC: ' + pic);
    if (dept) tags.push(dept);
    document.getElementById('filter-summary').innerHTML = `Báo cáo <b style="color:var(--text)">${tags[0]}</b>${tags.length > 1 ? ' · ' + tags.slice(1).join(' · ') : ' · toàn hệ thống'}`;
  }
  ['filter-period', 'filter-role', 'filter-pic', 'filter-department', 'filter-type'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      updateFilterSummary();
      recompute();
      window.MH.toast({ type: 'info', title: 'Đã áp dụng bộ lọc', message: `${KPI_AGG.orders} order · ${KPI_AGG.tasks} task trong kỳ.` });
    });
  });

  /* ---------- Export ---------- */
  function exportCSV() {
    const rows = [
      ['CB Media Hub — Reports Export'],
      ['Period: ' + document.getElementById('filter-period').selectedOptions[0].textContent],
      ['Generated: ' + new Date().toISOString()],
      [],
      ['=== KPI SUMMARY ==='],
      ['Metric', 'Value'],
      ['Total Orders', KPI_AGG.orders],
      ['Total Tasks', KPI_AGG.tasks],
      ['Completed', KPI_AGG.completed],
      ['In Progress', KPI_AGG.progress],
      ['On-time Rate', KPI_AGG.ontime + '%'],
      ['Overdue Tasks', KPI_AGG.overdue],
      ['Avg Rating', KPI_AGG.rating],
      ['Rating Coverage', KPI_AGG.coverage + '%'],
      ['Revision Avg', KPI_AGG.revision],
      ['Reopened', KPI_AGG.reopened],
      ['Brief Need Info', KPI_AGG.briefNeed],
      ['Delivery Completed', KPI_AGG.delivery],
      [],
      ['=== PIC KPI ==='],
      ['Role', 'Name', 'Total', 'Done', 'On-time %', 'Late', 'Revision', 'Rating', 'Avg Time', 'KPI Score'],
      ...PIC_KPI.map((p) => [p.role, p.name, p.total, p.done, p.ontime, p.late, p.rev, p.rating, p.time, p.kpi]),
      [],
      ['=== OVERDUE & RISK ==='],
      ['Task ID', 'Order', 'Project', 'Type', 'PIC', 'Account', 'Priority', 'Deadline', 'Overdue', 'Status'],
      ...OVERDUE.map((t) => [t.task, t.order, t.project, t.type, t.pic, t.account, t.priority, t.deadline, t.overdue, t.status]),
      [],
      ['=== FEEDBACK & RATING ==='],
      ['Order', 'Project', 'Requester', 'Account', 'PIC', 'Rating', 'Feedback', 'Categories', 'Date'],
      ...FEEDBACK.map((f) => [f.order, f.project, f.requester, f.account, f.pic, f.rating, f.fb, f.cats.join('; '), f.date])
    ];
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cb-media-hub-reports-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.MH.toast({ type: 'success', title: 'Đã export', message: 'File CSV (Excel-compatible) đã tải về.' });
  }

  document.getElementById('export-xlsx').addEventListener('click', exportCSV);
  document.getElementById('export-pdf').addEventListener('click', () => {
    window.MH.toast({ type: 'info', title: 'Export PDF', message: 'Sử dụng Print → Save as PDF (Ctrl+P). Demo dùng CSV cho Excel.' });
    setTimeout(() => window.print(), 600);
  });

  /* ---------- Init ---------- */
  function renderAll() {
    renderKPI();
    renderLineChart();
    renderTypeDonut();
    renderRoleBars();
    renderPICBars();
    renderHeatmap();
    renderFunnel();
    renderRatingDist();
    renderQuality();
    renderPICTable();
    renderOverdueTable();
    renderFeedbackTable();
  }
  renderAll();
  updateFilterSummary();
  loadReportsFromStore();
  // Giữ số liệu tươi khi tab mở lâu — pattern Master Dashboard (poll 60s + reload khi quay lại tab)
  setInterval(loadReportsFromStore, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadReportsFromStore(); });
})();
