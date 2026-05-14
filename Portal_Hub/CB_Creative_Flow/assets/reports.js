/* =====================================================================
   CB Media Hub — Reports module logic
   - Auth guard: admin/account
   - Mock aggregated metrics (would come from /api/reports/* in production)
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
  if (!['admin', 'account'].includes(user.role)) {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Reports chỉ dành cho Admin/Account.' });
    setTimeout(() => location.replace('dashboard.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  // Profile chip
  document.getElementById('pc-name').textContent = user.name || 'User';
  document.getElementById('pc-avatar').textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
  const pcRole = document.getElementById('pc-role-badge');
  pcRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  pcRole.className = 'role-badge r--' + user.role;
  const chip = document.getElementById('profile-chip');
  chip.addEventListener('click', (e) => { if (e.target.closest('.profile-menu')) return; chip.classList.toggle('is-open'); });
  document.addEventListener('click', (e) => { if (!chip.contains(e.target)) chip.classList.remove('is-open'); });
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('mh-user'); window.MH.toast({ type: 'info', title: 'Đã đăng xuất' });
    setTimeout(() => location.href = 'login.html', 500);
  });
  const sb = document.getElementById('dash-sb'), sbd = document.getElementById('sb-backdrop'), sbt = document.getElementById('sb-toggle');
  if (sbt) sbt.addEventListener('click', () => { sb.classList.add('is-open'); sbd.classList.add('is-open'); });
  if (sbd) sbd.addEventListener('click', () => { sb.classList.remove('is-open'); sbd.classList.remove('is-open'); });

  /* ---------- Mock report data ---------- */
  // Task trend — last 14 days (with realistic curve)
  const TREND_DAYS = 14;
  function genTrend() {
    const today = new Date('2026-05-13');
    const data = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const base = isWeekend ? 2 : 7;
      const noise = () => Math.floor(Math.random() * 4);
      data.push({
        date: d,
        label: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,
        orders: base + noise() + (i < 5 ? 3 : 0),
        tasks: base + 3 + noise() + (i < 5 ? 4 : 0),
        completed: Math.max(1, base + noise() - 1),
        overdue: i < 3 ? noise() : 0
      });
    }
    return data;
  }
  // Use deterministic seed-like pattern instead so render is stable each load
  const TREND = [
    { label: '30/04', orders: 5, tasks: 9, completed: 4, overdue: 0 },
    { label: '01/05', orders: 7, tasks: 10, completed: 6, overdue: 1 },
    { label: '02/05', orders: 2, tasks: 5, completed: 3, overdue: 0 },
    { label: '03/05', orders: 4, tasks: 7, completed: 5, overdue: 0 },
    { label: '04/05', orders: 3, tasks: 6, completed: 4, overdue: 0 },
    { label: '05/05', orders: 9, tasks: 12, completed: 7, overdue: 1 },
    { label: '06/05', orders: 8, tasks: 11, completed: 8, overdue: 0 },
    { label: '07/05', orders: 6, tasks: 9, completed: 6, overdue: 1 },
    { label: '08/05', orders: 11, tasks: 14, completed: 9, overdue: 2 },
    { label: '09/05', orders: 7, tasks: 10, completed: 8, overdue: 1 },
    { label: '10/05', orders: 4, tasks: 7, completed: 6, overdue: 0 },
    { label: '11/05', orders: 3, tasks: 6, completed: 5, overdue: 0 },
    { label: '12/05', orders: 12, tasks: 16, completed: 10, overdue: 2 },
    { label: '13/05', orders: 9, tasks: 13, completed: 8, overdue: 3 }
  ];

  // Type distribution (matches Production Board / Database Orders patterns)
  const TYPES = [
    { key: 'design',  label: 'Design / POSM',  count: 42, color: 'var(--brand-600)' },
    { key: 'video',   label: 'Video',          count: 23, color: 'var(--red-600)' },
    { key: 'photo',   label: 'Chụp ảnh',       count: 14, color: '#10b981' },
    { key: 'motion',  label: 'Motion',         count: 12, color: '#f59e0b' },
    { key: 'ads',     label: 'Ads / Post',     count: 18, color: '#0ea5e9' },
    { key: 'slide',   label: 'Slide',          count: 9,  color: '#8b5cf6' }
  ];

  // Role performance
  const ROLES = [
    { key: 'account', label: 'Account',  cls: 'r--account', total: 47, completed: 44, rating: 4.9 },
    { key: 'design',  label: 'Design',   cls: 'r--design',  total: 52, completed: 39, rating: 4.7 },
    { key: 'editor',  label: 'Editor',   cls: 'r--editor',  total: 36, completed: 31, rating: 4.6 },
    { key: 'shoot',   label: 'Shooting', cls: 'r--shoot',   total: 14, completed: 12, rating: 4.8 },
    { key: 'hybrid',  label: 'Hybrid',   cls: 'r--hybrid',  total:  8, completed:  7, rating: 4.5 }
  ];

  // PIC performance (stacked)
  const PICS = [
    { name: 'Duy',        ontime: 28, soon: 4, overdue: 1, done: 39, ongoing: 5, total: 45 },
    { name: 'Vinh',       ontime: 22, soon: 6, overdue: 2, done: 31, ongoing: 7, total: 40 },
    { name: 'Linh Chi',   ontime: 18, soon: 3, overdue: 1, done: 26, ongoing: 6, total: 35 },
    { name: 'Mai Phương', ontime: 32, soon: 2, overdue: 0, done: 35, ongoing: 4, total: 41 },
    { name: 'Hậu',        ontime: 30, soon: 3, overdue: 1, done: 33, ongoing: 5, total: 39 },
    { name: 'Đức Anh',    ontime: 14, soon: 2, overdue: 0, done: 17, ongoing: 3, total: 22 }
  ];

  // Heatmap — 7 days × 1 row (combined activity)
  // Intensity 1-6
  const HEATMAP = [
    { day: 'T2', count: 18, intensity: 4 },
    { day: 'T3', count: 22, intensity: 5 },
    { day: 'T4', count: 25, intensity: 6 },
    { day: 'T5', count: 19, intensity: 4 },
    { day: 'T6', count: 21, intensity: 5 },
    { day: 'T7', count: 8,  intensity: 2 },
    { day: 'CN', count: 4,  intensity: 1 }
  ];

  // Delivery funnel
  const FUNNEL = [
    { label: 'Ready for Delivery',  count: 28, pct: 100 },
    { label: 'Account Checked',     count: 26, pct: 93 },
    { label: 'Preview Sent',        count: 22, pct: 79 },
    { label: 'Client Approved',     count: 19, pct: 68 },
    { label: 'Final Sent',          count: 17, pct: 61 },
    { label: 'Rated',               count: 14, pct: 50 },
    { label: 'Completed',           count: 11, pct: 39 }
  ];

  // Rating distribution
  const RATINGS = [
    { stars: 5, count: 28 },
    { stars: 4, count: 18 },
    { stars: 3, count: 4 },
    { stars: 2, count: 1 },
    { stars: 1, count: 1 }
  ];

  // PIC KPI table
  const PIC_KPI = [
    { role: 'Account', name: 'Mai Phương', total: 41, done: 35, ontime: 95, late: 2, rev: 1.1, rating: 4.9, time: '0.8 ngày', kpi: 96 },
    { role: 'Account', name: 'Hậu',        total: 39, done: 33, ontime: 94, late: 2, rev: 1.2, rating: 4.9, time: '1.1 ngày', kpi: 95 },
    { role: 'Design',  name: 'Duy',        total: 45, done: 39, ontime: 93, late: 3, rev: 1.3, rating: 4.8, time: '2.1 ngày', kpi: 92 },
    { role: 'Editor',  name: 'Vinh',       total: 40, done: 31, ontime: 86, late: 4, rev: 1.6, rating: 4.6, time: '3.4 ngày', kpi: 84 },
    { role: 'Photo',   name: 'Linh Chi',   total: 35, done: 26, ontime: 88, late: 3, rev: 1.4, rating: 4.7, time: '2.6 ngày', kpi: 87 },
    { role: 'Account', name: 'Đức Anh',    total: 22, done: 17, ontime: 91, late: 2, rev: 1.0, rating: 4.8, time: '1.4 ngày', kpi: 90 }
  ];

  // Overdue / risk
  const OVERDUE = [
    { task: 'TASK-0008', order: 'MEDIA-2026-0011', project: 'TVC Sản phẩm Hè 30s', type: 'Video', pic: 'Vinh', account: 'Mai Phương', priority: 'urgent', deadline: '2026-05-08 17:00', overdue: '5 ngày', status: 'inprogress' },
    { task: 'TASK-0004', order: 'MEDIA-2026-0007', project: 'Brochure Khóa AI Summer', type: 'Design', pic: 'Duy', account: 'Mai Phương', priority: 'normal', deadline: '2026-05-06 17:00', overdue: '7 ngày', status: 'inprogress' },
    { task: 'TASK-0013', order: 'MEDIA-2026-0016', project: 'Facebook Ads Copy Tháng 5', type: 'Ads', pic: 'Mai Phương', account: 'Hậu', priority: 'urgent', deadline: '2026-05-01 17:00', overdue: '12 ngày', status: 'inprogress' },
    { task: 'TASK-0003', order: 'MEDIA-2026-0006', project: 'Reel TikTok Tháng 5', type: 'Video', pic: 'Vinh', account: 'Hậu', priority: 'critical', deadline: '2026-05-12 17:00', overdue: '1 ngày', status: 'review' },
    { task: 'TASK-0014', order: 'MEDIA-2026-0005', project: 'Photoshoot Cơ sở Mới — Retouch', type: 'Photo', pic: 'Linh Chi', account: 'Đức Anh', priority: 'normal', deadline: '2026-05-16 17:00', overdue: 'Còn 3 ngày', status: 'revision' }
  ];

  // Feedback / rating recent
  const FEEDBACK = [
    { order: 'MEDIA-2026-0010', project: 'Bộ Poster Tuyển dụng', requester: 'Phạm Thanh Hà', account: 'Hậu', pic: 'Vinh', rating: 5, fb: 'Bộ poster đẹp, đủ thông tin, đúng tone. Cảm ơn team!', cats: ['quality','timing'], date: '2026-05-10' },
    { order: 'MEDIA-2026-0014', project: 'Voucher Ưu đãi Tháng 5', requester: 'Trần Quốc Anh', account: 'Hậu', pic: 'Duy', rating: 5, fb: 'Voucher đẹp, in ra rõ, đúng spec.', cats: ['quality','file'], date: '2026-05-06' },
    { order: 'MEDIA-2026-0012', project: 'Email Template Newsletter Q2', requester: 'Vũ Hoàng Mai', account: 'Hậu', pic: 'Duy', rating: 4, fb: 'Template chuẩn responsive. Có thể tinh tế hơn ở phần CTA.', cats: ['quality'], date: '2026-05-11' },
    { order: 'MEDIA-2026-0021', project: 'Banner OA Sự kiện', requester: 'Nguyễn Thu Hà', account: 'Đức Anh', pic: 'Linh Chi', rating: 5, fb: 'Banner phối hợp tốt, brand chuẩn.', cats: ['quality','coord'], date: '2026-05-08' },
    { order: 'MEDIA-2026-0019', project: 'Photoshoot Sản phẩm Mới', requester: 'Đỗ Quang Hùng', account: 'Đức Anh', pic: 'Linh Chi', rating: 4, fb: 'Ảnh sản phẩm tốt, hậu kỳ có thể đậm hơn.', cats: ['quality'], date: '2026-01-30' },
    { order: 'MEDIA-2026-0024', project: 'Reel Sản phẩm Hè', requester: 'Trần Quốc Anh', account: 'Mai Phương', pic: 'Linh Chi', rating: 3, fb: 'Cut chậm, cần tăng nhịp ở phần cuối.', cats: ['timing','content'], date: '2026-02-18' }
  ];

  const KPI_AGG = {
    orders: 128, tasks: 174, completed: 119, progress: 32, ontime: 92, overdue: 4,
    rating: 4.7, ratedCount: 52, coverage: 76, ratedTotal: 68,
    revision: 1.4, reopened: 3, briefNeed: 5, delivery: 68,
    dlOntrack: 32, dlSoon: 11, dlToday: 5, dlLate: 4, avgCompletion: 2.4
  };

  /* ---------- Helpers ---------- */
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

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
    const step = innerW / (TREND.length - 1);

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
    const max = Math.max(...RATINGS.map((r) => r.count));
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
    setText('q-brief-ok', 78);
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
        <td><span class="tb-status s--${t.status}"><span class="dot"></span>${t.status === 'inprogress' ? 'Đang xử lý' : t.status === 'review' ? 'Chờ duyệt' : 'Chỉnh sửa'}</span></td>
        <td><a class="btn btn-ghost btn-sm" href="production-board.html">Mở</a></td>
      </tr>`;
    }).join('');
  }

  function renderFeedbackTable() {
    const FB_LABEL = { quality: 'Chất lượng', timing: 'Tiến độ', coord: 'Phối hợp', content: 'Nội dung', file: 'File' };
    const FB_CLS = { quality: 'is-quality', timing: 'is-timing', coord: 'is-coord', content: 'is-content', file: 'is-file' };
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

  /* ---------- Filter handlers (visual only — no backend recompute) ---------- */
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
      // In production, refetch /api/reports/* with new params
      window.MH.toast({ type: 'info', title: 'Đã áp dụng bộ lọc', message: 'Demo — kết nối API thực tế để cập nhật số liệu.' });
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
  updateFilterSummary();
})();
