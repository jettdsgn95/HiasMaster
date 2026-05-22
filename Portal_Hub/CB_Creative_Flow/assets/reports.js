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
  // Mock data cleared — Reports sẽ render empty state cho đến khi có data thật.
  // Phase 3 task: wire Reports load dynamic từ Supabase (MH.store.orders/tasks/deliveries/aiUsage).
  const TREND = [];
  const TYPES = [];
  const ROLES = [];
  const PICS = [];
  const HEATMAP = [];
  const FUNNEL = [];
  const RATINGS = [];
  const PIC_KPI = [];
  const OVERDUE = [];
  const FEEDBACK = [];

  const KPI_AGG = {
    orders: 0, tasks: 0, completed: 0, progress: 0, ontime: 0, overdue: 0,
    rating: 0, ratedCount: 0, coverage: 0, ratedTotal: 0,
    revision: 0, reopened: 0, briefNeed: 0, delivery: 0,
    dlOntrack: 0, dlSoon: 0, dlToday: 0, dlLate: 0, avgCompletion: 0
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
