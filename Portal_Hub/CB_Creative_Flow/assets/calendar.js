/* =====================================================================
   calendar.js — Lịch / Calendar (Schedule view)
   ---------------------------------------------------------------------
   Hiển thị theo NGÀY: deadline task/order + lịch quay/chụp + bàn giao.
   Read-only — click sự kiện → popover → mở drawer ở Task Tracker /
   Client Orders. Task tạo/sửa vẫn ở các module gốc.

   Role filter (yêu cầu nghiệp vụ):
     - admin / account  → FULL (mọi task + order).
     - design / editor  → CHỈ task mình PIC (isMyTask), kèm lịch quay/chụp
                          của task đó. Không thấy order-level.
     - content          → order đang ở wording active + lịch quay/chụp của
                          order đó (phạm vi "liên quan" cho role wording).

   Demo "hôm nay" = new Date('2026-05-13') — thống nhất với reports/board
   để event demo hiện đúng tháng (xem _hot.md mục Data Conventions).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- User ---------- */
  let USER;
  try { USER = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { USER = null; }
  if (!USER || !USER.role) return; // auth guard inline đã redirect; phòng hờ
  const ROLE = USER.role;
  const IS_FULL = ROLE === 'admin' || ROLE === 'account';
  const IS_PRODUCTION = ROLE === 'design' || ROLE === 'editor';
  const IS_CONTENT = ROLE === 'content';

  /* ---------- Hằng số ---------- */
  const TODAY = new Date('2026-05-13'); // demo anchor (đồng bộ reports/board)
  const TODAY_KEY = dayKey(TODAY);
  const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']; // Monday-first (giống ref)
  const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const TYPE_LABEL = { media: 'Quay / Chụp ảnh', shoot: 'Quay', photo: 'Chụp ảnh', design: 'Design / POSM', digital: 'Digital', video: 'Video', motion: 'Motion', slide: 'Slide', ads: 'Ads / Post', other: 'Khác' };
  const EVENT_LABEL = { 'task-deadline': 'Deadline Task', 'order-deadline': 'Deadline Order', shoot: 'Lịch quay/chụp', delivery: 'Bàn giao' };

  /* ---------- State ---------- */
  let cursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); // tháng đang xem
  let view = 'month'; // month | week | agenda
  let weekRef = new Date(TODAY); // ngày tham chiếu cho week view
  let allEvents = [];
  const activeTypes = new Set(['task-deadline', 'order-deadline', 'shoot', 'delivery']);

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const elTitle = $('cal-title');
  const elWeekdays = $('cal-weekdays');
  const elGrid = $('cal-grid');
  const elAgenda = $('cal-agenda');
  const elEmpty = $('cal-empty');
  const elLoading = $('cal-loading');
  const elSurface = $('cal-surface');
  const elCount = $('cal-event-count');
  const elScopeNote = $('cal-scope-note');
  const elPop = $('cal-pop');
  const elPopBd = $('cal-pop-backdrop');

  /* ---------- Date helpers ---------- */
  function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    const str = String(s).trim();
    const dOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (dOnly) return new Date(+dOnly[1], +dOnly[2] - 1, +dOnly[3]); // local midnight, tránh lệch tz
    const dt = new Date(str.replace(' ', 'T'));
    return isNaN(dt.getTime()) ? null : dt;
  }
  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDayLabel(d) {
    const wd = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()];
    return wd + ', ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function fmtTime(s) {
    const d = parseDate(s);
    if (!d) return '';
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  // Thứ 2 = đầu tuần. JS getDay(): CN=0..T7=6 → chuyển sang T2=0..CN=6.
  function mondayIndex(d) { return (d.getDay() + 6) % 7; }
  function startOfWeek(d) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    s.setDate(s.getDate() - mondayIndex(s));
    return s;
  }
  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ---------- PIC match (copy từ production-board.js isMyTask) ---------- */
  function isMyTask(assignedTo) {
    if (!assignedTo) return false;
    const a = String(assignedTo).trim().toLowerCase();
    const u = String(USER.name || '').trim().toLowerCase();
    if (!a || !u) return false;
    if (a === u) return true;
    return u.startsWith(a + ' ') || u.endsWith(' ' + a) || u.includes(' ' + a + ' ');
  }

  /* ---------- Build events ---------- */
  function shootDateFromOrder(o) {
    if (o.shoot_date) return o.shoot_date;
    // Fallback: bóc "Ngày: YYYY-MM-DD" khỏi content_brief (order media cũ chưa có cột).
    const m = /Ngày:\s*(\d{4}-\d{2}-\d{2})/.exec(o.content_brief || '');
    return m ? m[1] : null;
  }
  function isActiveTask(t) {
    return t.status !== 'completed' && t.status !== 'cancelled';
  }
  function makeEvent(date, type, title, opts) {
    opts = opts || {};
    return { date: date, key: dayKey(date), type: type, title: title || '(Không tên)', pic: opts.pic || '', sub: opts.sub || '', time: opts.time || '', refKind: opts.refKind, refId: opts.refId, status: opts.status || '' };
  }

  function buildEvents(tasks, orders) {
    const events = [];

    /* ----- TASKS ----- */
    tasks.forEach((t) => {
      if (!isActiveTask(t)) return;
      // design/editor: chỉ task mình PIC. content: bỏ task (theo order). full: tất cả.
      if (IS_PRODUCTION && !isMyTask(t.assigned_to)) return;
      if (IS_CONTENT) return;

      const typeLbl = TYPE_LABEL[t.task_type] || t.task_type || '';
      // Deadline task
      const dl = parseDate(t.internal_deadline);
      if (dl) {
        events.push(makeEvent(dl, 'task-deadline', t.project_name || t.task_id, {
          pic: t.assigned_to, sub: typeLbl, time: fmtTime(t.internal_deadline),
          refKind: 'task', refId: t.task_id, status: t.status
        }));
      }
      // Lịch quay/chụp từ task (sau push, task quay/chụp kế thừa shoot_date)
      if (['shoot', 'photo', 'media'].includes(t.task_type)) {
        const sd = parseDate(t.shoot_date);
        if (sd) {
          events.push(makeEvent(sd, 'shoot', t.project_name || t.task_id, {
            pic: t.assigned_to, sub: (typeLbl || 'Buổi quay/chụp') + (t.shoot_time ? ' · ' + t.shoot_time : ''),
            refKind: 'task', refId: t.task_id, status: t.status
          }));
        }
      }
    });

    /* ----- ORDERS ----- */
    orders.forEach((o) => {
      // Bỏ order đã huỷ/từ chối.
      if (o.account_status === 'rejected' || o.production_status === 'cancelled') return;
      // Phạm vi role:
      if (IS_PRODUCTION) return; // design/editor không xem order-level
      if (IS_CONTENT) {
        const ws = o.brief_wording_status;
        const active = ws && ws !== 'none' && ws !== 'completed' && ws !== 'client_approved';
        if (!active) return; // content chỉ thấy order đang wording
      }

      const typeLbl = TYPE_LABEL[o.request_type] || o.request_type || '';
      const picName = o.production_pic || o.production_pic_video || o.production_pic_photo || '';

      // Deadline order (ưu tiên requested_deadline; fallback internal_deadline)
      const dl = parseDate(o.requested_deadline || o.internal_deadline);
      if (dl) {
        events.push(makeEvent(dl, 'order-deadline', o.project_name || o.order_id, {
          pic: picName, sub: (o.order_id || '') + (typeLbl ? ' · ' + typeLbl : ''),
          refKind: 'order', refId: o.order_id, status: o.production_status
        }));
      }
      // Lịch quay/chụp từ order (nguồn chính cho admin/account/content)
      if (['media', 'photo', 'shoot'].includes(o.request_type)) {
        const sd = parseDate(shootDateFromOrder(o));
        if (sd) {
          events.push(makeEvent(sd, 'shoot', o.project_name || o.order_id, {
            pic: picName, sub: (typeLbl || 'Buổi quay/chụp') + (o.shoot_time ? ' · ' + o.shoot_time : '') + (o.shoot_location ? ' · ' + o.shoot_location : ''),
            refKind: 'order', refId: o.order_id, status: o.production_status
          }));
        }
      }
      // Bàn giao (chỉ full role) — delivery_date hoặc mốc final.
      if (IS_FULL) {
        const dd = o.delivery_date || (o.final_delivery_link ? o.last_updated : null);
        const dv = parseDate(dd);
        if (dv) {
          events.push(makeEvent(dv, 'delivery', o.project_name || o.order_id, {
            pic: picName, sub: (o.order_id || '') + ' · ' + (o.final_delivery_link ? 'Final' : 'Bàn giao'),
            refKind: 'order', refId: o.order_id, status: o.production_status
          }));
        }
      }
    });

    return events;
  }

  /* ---------- Render ---------- */
  function visibleEvents() { return allEvents.filter((e) => activeTypes.has(e.type)); }

  function chipHtml(ev) {
    const t = ev.time ? '<span class="cal-chip-time">' + ev.time + '</span>' : '';
    const pic = ev.pic ? '<span class="cal-chip-pic" title="' + esc(ev.pic) + '">' + esc(initials(ev.pic)) + '</span>' : '';
    return '<button class="cal-evt cal-evt--' + ev.type + '" data-evt-id="' + ev._idx + '" title="' + esc(EVENT_LABEL[ev.type] + ' · ' + ev.title) + '">' +
      t + '<span class="cal-evt-title">' + esc(ev.title) + '</span>' + pic + '</button>';
  }

  function renderMonth() {
    elWeekdays.hidden = false; elGrid.hidden = false; elAgenda.hidden = true;
    elTitle.textContent = MONTHS[cursor.getMonth()] + ', ' + cursor.getFullYear();
    elWeekdays.innerHTML = WEEKDAYS.map((w) => '<div class="cal-wd">' + w + '</div>').join('');

    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    const evByDay = groupByDay(visibleEvents());

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = dayKey(d);
      const inMonth = d.getMonth() === cursor.getMonth();
      const isToday = key === TODAY_KEY;
      const dayEvts = (evByDay[key] || []);
      const MAX = 3;
      const shown = dayEvts.slice(0, MAX).map(chipHtml).join('');
      const more = dayEvts.length > MAX ? '<button class="cal-more" data-more-key="' + key + '">+' + (dayEvts.length - MAX) + ' khác</button>' : '';
      cells += '<div class="cal-cell' + (inMonth ? '' : ' is-out') + (isToday ? ' is-today' : '') + '" data-day="' + key + '">' +
        '<div class="cal-cell-head"><span class="cal-cell-num">' + d.getDate() + '</span></div>' +
        '<div class="cal-cell-evts">' + shown + more + '</div></div>';
    }
    elGrid.className = 'cal-grid';
    elGrid.innerHTML = cells;
    elEmpty.hidden = visibleEvents().length > 0;
  }

  function renderWeek() {
    elWeekdays.hidden = false; elGrid.hidden = false; elAgenda.hidden = true;
    const ws = startOfWeek(weekRef);
    const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
    elTitle.textContent = ws.getDate() + '/' + (ws.getMonth() + 1) + ' – ' + we.getDate() + '/' + (we.getMonth() + 1) + '/' + we.getFullYear();
    elWeekdays.innerHTML = WEEKDAYS.map((w, i) => {
      const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i);
      return '<div class="cal-wd">' + w + ' <b>' + d.getDate() + '</b></div>';
    }).join('');

    const evByDay = groupByDay(visibleEvents());
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i);
      const key = dayKey(d);
      const isToday = key === TODAY_KEY;
      const dayEvts = (evByDay[key] || []);
      const list = dayEvts.map(chipHtml).join('') || '<span class="cal-week-empty">—</span>';
      cells += '<div class="cal-cell cal-cell--week' + (isToday ? ' is-today' : '') + '" data-day="' + key + '">' +
        '<div class="cal-cell-evts">' + list + '</div></div>';
    }
    elGrid.className = 'cal-grid cal-grid--week';
    elGrid.innerHTML = cells;
    elEmpty.hidden = visibleEvents().length > 0;
  }

  function renderAgenda() {
    elWeekdays.hidden = true; elGrid.hidden = true; elAgenda.hidden = false;
    elTitle.textContent = MONTHS[cursor.getMonth()] + ', ' + cursor.getFullYear();
    // Sự kiện trong tháng đang xem, sắp theo ngày.
    const inMonth = visibleEvents().filter((e) => e.date.getMonth() === cursor.getMonth() && e.date.getFullYear() === cursor.getFullYear());
    inMonth.sort((a, b) => a.date - b.date || a.type.localeCompare(b.type));
    if (!inMonth.length) { elAgenda.innerHTML = ''; elEmpty.hidden = false; return; }
    elEmpty.hidden = true;
    const byDay = groupByDay(inMonth);
    const keys = Object.keys(byDay).sort();
    elAgenda.innerHTML = keys.map((k) => {
      const d = byDay[k][0].date;
      const rows = byDay[k].map((ev) =>
        '<button class="cal-ag-row" data-evt-id="' + ev._idx + '">' +
        '<span class="cal-dot cal-dot--' + dotClass(ev.type) + '"></span>' +
        '<span class="cal-ag-time">' + (ev.time || '') + '</span>' +
        '<span class="cal-ag-title">' + esc(ev.title) + '</span>' +
        '<span class="cal-ag-tag">' + EVENT_LABEL[ev.type] + '</span>' +
        (ev.pic ? '<span class="cal-chip-pic">' + esc(initials(ev.pic)) + '</span>' : '') +
        '</button>'
      ).join('');
      return '<div class="cal-ag-day' + (k === TODAY_KEY ? ' is-today' : '') + '"><div class="cal-ag-date">' + fmtDayLabel(d) + '</div>' + rows + '</div>';
    }).join('');
  }

  function dotClass(type) {
    return type === 'task-deadline' ? 'task' : type === 'order-deadline' ? 'order' : type === 'shoot' ? 'shoot' : 'delivery';
  }

  function groupByDay(events) {
    const map = {};
    events.forEach((e) => { (map[e.key] = map[e.key] || []).push(e); });
    // Sắp trong ngày: theo giờ rồi theo type.
    Object.keys(map).forEach((k) => map[k].sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.type.localeCompare(b.type)));
    return map;
  }

  function render() {
    // Gán index ổn định để chip tra cứu event khi click.
    allEvents.forEach((e, i) => { e._idx = i; });
    if (elCount) elCount.textContent = String(visibleEvents().length);
    if (view === 'month') renderMonth();
    else if (view === 'week') renderWeek();
    else renderAgenda();
  }

  /* ---------- Popover ---------- */
  function openPop(ev, anchorRect) {
    const target = navTarget(ev);
    const statusLine = ev.status ? '<div class="cal-pop-meta">Trạng thái: <b>' + esc(ev.status) + '</b></div>' : '';
    const picLine = ev.pic ? '<div class="cal-pop-meta">P.I.C: <b>' + esc(ev.pic) + '</b></div>' : '';
    const timeLine = ev.time ? '<div class="cal-pop-meta">Giờ: <b>' + esc(ev.time) + '</b></div>' : '';
    elPop.innerHTML =
      '<div class="cal-pop-head"><span class="cal-dot cal-dot--' + dotClass(ev.type) + '"></span><span class="cal-pop-tag">' + EVENT_LABEL[ev.type] + '</span>' +
      '<button class="cal-pop-x" id="cal-pop-x" aria-label="Đóng">&times;</button></div>' +
      '<div class="cal-pop-title">' + esc(ev.title) + '</div>' +
      '<div class="cal-pop-meta">' + fmtDayLabel(ev.date) + '</div>' +
      timeLine + picLine + (ev.sub ? '<div class="cal-pop-meta">' + esc(ev.sub) + '</div>' : '') + statusLine +
      (target ? '<a class="btn btn-primary btn-sm cal-pop-open" href="' + target + '">Mở chi tiết →</a>' : '');
    elPop.hidden = false; elPopBd.hidden = false;
    // Định vị gần chip (desktop). Mobile: CSS căn giữa.
    const popW = 280;
    let left = anchorRect.left + window.scrollX;
    let top = anchorRect.bottom + window.scrollY + 6;
    if (left + popW > window.scrollX + document.documentElement.clientWidth - 12) {
      left = window.scrollX + document.documentElement.clientWidth - popW - 12;
    }
    elPop.style.left = Math.max(12, left) + 'px';
    elPop.style.top = top + 'px';
    const x = $('cal-pop-x');
    if (x) x.addEventListener('click', closePop);
  }
  function closePop() { elPop.hidden = true; elPopBd.hidden = true; }
  function navTarget(ev) {
    if (ev.refKind === 'task') return 'production-board.html?id=' + encodeURIComponent(ev.refId);
    if (ev.refKind === 'order') {
      if (IS_FULL) return 'database-orders.html?id=' + encodeURIComponent(ev.refId);
      if (IS_CONTENT) return 'content-workbench.html?order=' + encodeURIComponent(ev.refId);
    }
    return '';
  }

  /* ---------- Events / wiring ---------- */
  function onSurfaceClick(e) {
    const evtBtn = e.target.closest('[data-evt-id]');
    if (evtBtn) {
      const ev = allEvents[+evtBtn.getAttribute('data-evt-id')];
      if (ev) openPop(ev, evtBtn.getBoundingClientRect());
      return;
    }
    const moreBtn = e.target.closest('[data-more-key]');
    if (moreBtn) { weekRef = parseDate(moreBtn.getAttribute('data-more-key')); view = 'week'; syncViewButtons(); render(); }
  }

  function syncViewButtons() {
    document.querySelectorAll('.cal-view-btn').forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-view') === view));
  }

  function wire() {
    $('cal-prev').addEventListener('click', () => { shiftPeriod(-1); render(); });
    $('cal-next').addEventListener('click', () => { shiftPeriod(1); render(); });
    $('cal-today').addEventListener('click', () => { cursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); weekRef = new Date(TODAY); render(); });
    document.querySelectorAll('.cal-view-btn').forEach((b) => b.addEventListener('click', () => {
      view = b.getAttribute('data-view'); syncViewButtons();
      if (view === 'week') {
        // Vào week: nếu đang xem tháng của "hôm nay" → tuần chứa hôm nay; else giữa tháng đang xem.
        weekRef = (cursor.getFullYear() === TODAY.getFullYear() && cursor.getMonth() === TODAY.getMonth())
          ? new Date(TODAY) : new Date(cursor.getFullYear(), cursor.getMonth(), 15);
      }
      render();
    }));
    document.querySelectorAll('.cal-chip').forEach((c) => c.addEventListener('click', () => {
      const t = c.getAttribute('data-type');
      if (activeTypes.has(t)) activeTypes.delete(t); else activeTypes.add(t);
      c.classList.toggle('is-active', activeTypes.has(t));
      render();
    }));
    elSurface.addEventListener('click', onSurfaceClick);
    elPopBd.addEventListener('click', closePop);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
  }

  function shiftPeriod(dir) {
    if (view === 'week') {
      weekRef = new Date(weekRef.getFullYear(), weekRef.getMonth(), weekRef.getDate() + dir * 7);
      cursor = new Date(weekRef.getFullYear(), weekRef.getMonth(), 1);
    } else {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    }
  }

  /* ---------- Scope note ---------- */
  function setScopeNote() {
    if (!elScopeNote) return;
    if (IS_FULL) elScopeNote.textContent = 'Bạn đang xem TOÀN BỘ lịch của team (Admin/Account).';
    else if (IS_PRODUCTION) elScopeNote.textContent = 'Chỉ hiển thị task bạn đang phụ trách (P.I.C).';
    else if (IS_CONTENT) elScopeNote.textContent = 'Chỉ hiển thị order đang trong giai đoạn chuẩn hoá wording.';
    else elScopeNote.textContent = '';
  }

  /* ---------- Load ---------- */
  async function load() {
    setScopeNote();
    let tasks = [], orders = [];
    try {
      if (window.MH && window.MH.supabaseReady) { try { await window.MH.supabaseReady; } catch (e) {} }
      if (window.MH && window.MH.store) {
        const needTasks = !IS_CONTENT;
        const needOrders = !IS_PRODUCTION;
        const [tr, or] = await Promise.all([
          needTasks ? window.MH.store.tasks.list() : Promise.resolve([]),
          needOrders ? window.MH.store.orders.list() : Promise.resolve([])
        ]);
        tasks = Array.isArray(tr) ? tr : [];
        orders = Array.isArray(or) ? or : [];
      }
    } catch (e) {
      console.warn('[calendar] load failed:', e);
    }
    allEvents = buildEvents(tasks, orders);
    if (elLoading) elLoading.hidden = true;
    if (elSurface) elSurface.hidden = false;
    render();
  }

  /* ---------- esc ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Boot ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { wire(); load(); });
  } else {
    wire(); load();
  }
})();
