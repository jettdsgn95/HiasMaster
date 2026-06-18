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

   "Hôm nay" = ngày THẬT (new Date()) — lịch phản ánh đúng thực tế, mặc định
   mở tháng hiện tại. Đồng bộ realtime: Supabase Realtime trên orders/tasks
   (best-effort) + poll 60s + reload khi quay lại tab.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- User ---------- */
  let USER;
  try { USER = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { USER = null; }
  if (!USER || !USER.role) return; // auth guard inline đã redirect; phòng hờ
  const ROLE = USER.role;
  const IS_FULL = ROLE === 'admin' || ROLE === 'account' || ROLE === 'system_supervisor'; // supervisor = full read-only view
  const IS_PRODUCTION = ROLE === 'design' || ROLE === 'editor';
  const IS_CONTENT = ROLE === 'content' || ROLE === 'lead_content'; // team Content (gồm Lead)

  /* ---------- Hằng số ---------- */
  // "Hôm nay" = ngày THẬT (không hardcode demo anchor) — lịch phản ánh đúng thực tế.
  // Tính theo local midnight để so khớp theo NGÀY, không lệch vì giờ/giây.
  const TODAY = (function () { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
  const TODAY_KEY = dayKey(TODAY);
  const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']; // Monday-first (giống ref)
  const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const TYPE_LABEL = { media: 'Quay / Chụp ảnh', shoot: 'Quay', photo: 'Chụp ảnh', design: 'Design / POSM', digital: 'Digital', video: 'Video', motion: 'Motion', slide: 'Slide', ads: 'Ads / Post', other: 'Khác' };
  const EVENT_LABEL = { 'task-deadline': 'Deadline Task', 'order-deadline': 'Deadline Order', shoot: 'Lịch quay/chụp', delivery: 'Bàn giao', 'wording-deadline': 'Hạn Content Wording', 'ct-deadline': 'Hạn Content Task', 'cplan-deadline': 'Hạn Content Plan' };

  /* ---------- State ---------- */
  let cursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); // tháng đang xem (Month/Week)
  let view = 'month'; // month | week | day
  let weekRef = new Date(TODAY); // ngày tham chiếu cho week view
  let selectedDay = new Date(TODAY); // ngày đang mở ở Day view
  let miniCursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); // tháng hiển thị ở mini-calendar
  let allEvents = [];
  const activeTypes = new Set(['task-deadline', 'order-deadline', 'shoot', 'delivery', 'wording-deadline', 'ct-deadline', 'cplan-deadline']);

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const elTitle = $('cal-title');
  const elWeekdays = $('cal-weekdays');
  const elGrid = $('cal-grid');
  const elDay = $('cal-day');
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

  function buildEvents(tasks, orders, ctasks, cplans) {
    const events = [];
    ctasks = Array.isArray(ctasks) ? ctasks : [];
    cplans = Array.isArray(cplans) ? cplans : [];

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
        // Content CHỈ thấy "Hạn Content Wording" (Account đã đặt) — ẩn deadline order + shoot.
        const ws = o.brief_wording_status;
        const active = ws && ws !== 'none' && ws !== 'completed' && ws !== 'client_approved';
        if (!active || !o.wording_deadline) return;
        const wd = parseDate(o.wording_deadline);
        if (wd) {
          events.push(makeEvent(wd, 'wording-deadline', o.project_name || o.order_id, {
            pic: o.brief_wording_pic, sub: (o.order_id || '') + ' · Hạn wording',
            refKind: 'order', refId: o.order_id, status: ws
          }));
        }
        return; // content dừng tại đây, không tạo order-deadline/shoot/delivery
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

    /* ----- CONTENT TASKS / PLANS (Deep Workflow — Phase 6) ----- */
    // lead_content/admin: toàn bộ; content: task mình PIC; (account/production không hiện ở đây).
    const seeContent = ROLE === 'lead_content' || ROLE === 'admin' || ROLE === 'content';
    if (seeContent) {
      const DONE = ['lead_approved', 'submitted_to_account', 'sent_to_client', 'client_approved', 'completed', 'media_order_created', 'archived'];
      ctasks.forEach((t) => {
        if (DONE.indexOf(t.status) >= 0) return;
        if (ROLE === 'content' && !isMyTask(t.assigned_pic)) return;
        const dl = parseDate(t.wording_deadline);
        if (!dl) return;
        events.push(makeEvent(dl, 'ct-deadline', t.title || t.id, {
          pic: t.assigned_pic, sub: (CT_SOURCE[t.source] || t.source || '') + ' · Hạn wording',
          refKind: 'ctask', refId: t.id, status: t.status
        }));
      });
      // Plan deadline — chỉ Lead/Admin.
      if (ROLE === 'lead_content' || ROLE === 'admin') {
        cplans.forEach((p) => {
          if (p.status === 'archived' || p.status === 'completed') return;
          const dl = parseDate(p.plan_deadline);
          if (!dl) return;
          events.push(makeEvent(dl, 'cplan-deadline', p.title || p.id, {
            pic: p.owner_lead, sub: (p.campaign_name || 'Content Plan'),
            refKind: 'cplan', refId: p.id, status: p.status
          }));
        });
      }
    }

    return events;
  }
  const CT_SOURCE = { client_order: 'Client Order', content_initiated: 'Chủ động', strategy_board: 'Strategy Board', campaign_package: 'Kế hoạch' };

  /* ---------- Render ---------- */
  function visibleEvents() { return allEvents.filter((e) => activeTypes.has(e.type)); }

  function chipHtml(ev) {
    const t = ev.time ? '<span class="cal-chip-time">' + ev.time + '</span>' : '';
    const pic = ev.pic ? '<span class="cal-chip-pic" title="' + esc(ev.pic) + '">' + esc(initials(ev.pic)) + '</span>' : '';
    return '<button class="cal-evt cal-evt--' + ev.type + '" data-evt-id="' + ev._idx + '" title="' + esc(EVENT_LABEL[ev.type] + ' · ' + ev.title) + '">' +
      t + '<span class="cal-evt-title">' + esc(ev.title) + '</span>' + pic + '</button>';
  }

  function renderMonth() {
    elWeekdays.hidden = false; elGrid.hidden = false; elDay.hidden = true;
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
        '<div class="cal-cell-head"><button class="cal-cell-num" data-open-day="' + key + '" title="Xem chi tiết ngày">' + d.getDate() + '</button></div>' +
        '<div class="cal-cell-evts">' + shown + more + '</div></div>';
    }
    elGrid.className = 'cal-grid';
    elGrid.innerHTML = cells;
    elEmpty.hidden = visibleEvents().length > 0;
  }

  function renderWeek() {
    elWeekdays.hidden = false; elGrid.hidden = false; elDay.hidden = true;
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

  /* ---------- DAY VIEW (ref-style: mini-calendar trái + danh sách task của ngày phải) ---------- */
  const WEEKDAYS_FULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  function renderDay() {
    elWeekdays.hidden = true; elGrid.hidden = true; elDay.hidden = false;
    elEmpty.hidden = true; // Day view có empty-state riêng trong panel phải
    const selKey = dayKey(selectedDay);
    elTitle.textContent = WEEKDAYS_FULL[selectedDay.getDay()] + ', ' +
      String(selectedDay.getDate()).padStart(2, '0') + '/' + String(selectedDay.getMonth() + 1).padStart(2, '0') + '/' + selectedDay.getFullYear();

    elDay.innerHTML = '<div class="cal-mini">' + miniCalHtml(selKey) + '</div>' +
      '<div class="cal-day-panel">' +
        '<div class="cal-day-h"><b>' + WEEKDAYS_FULL[selectedDay.getDay()] + '</b>' +
        '<span>' + String(selectedDay.getDate()).padStart(2, '0') + '/' + String(selectedDay.getMonth() + 1).padStart(2, '0') + '/' + selectedDay.getFullYear() + '</span></div>' +
        dayListHtml(selKey) +
      '</div>';
  }

  // Lưới mini-calendar cho tháng miniCursor; đánh dấu today / selected / có-event.
  function miniCalHtml(selKey) {
    const evByDay = groupByDay(visibleEvents());
    const head = '<div class="cal-mini-head">' +
      '<button class="cal-mini-nav" data-mini-nav="prev" aria-label="Tháng trước">‹</button>' +
      '<span class="cal-mini-title">' + MONTHS[miniCursor.getMonth()] + ', ' + miniCursor.getFullYear() + '</span>' +
      '<button class="cal-mini-nav" data-mini-nav="next" aria-label="Tháng sau">›</button></div>';
    const wd = '<div class="cal-mini-wd">' + WEEKDAYS.map((w) => '<span>' + w + '</span>').join('') + '</div>';
    const gridStart = startOfWeek(new Date(miniCursor.getFullYear(), miniCursor.getMonth(), 1));
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = dayKey(d);
      const cls = ['cal-mini-day'];
      if (d.getMonth() !== miniCursor.getMonth()) cls.push('is-out');
      if (key === TODAY_KEY) cls.push('is-today');
      if (key === selKey) cls.push('is-selected');
      if ((evByDay[key] || []).length) cls.push('has-evt');
      cells += '<button class="' + cls.join(' ') + '" data-open-day="' + key + '">' + d.getDate() + '</button>';
    }
    return head + wd + '<div class="cal-mini-grid">' + cells + '</div>';
  }

  // Danh sách đầy đủ event của ngày selKey (đã lọc theo activeTypes).
  function dayListHtml(selKey) {
    const list = (groupByDay(visibleEvents())[selKey] || []);
    if (!list.length) return '<div class="cal-day-empty">Không có sự kiện trong ngày này.</div>';
    return '<div class="cal-day-list">' + list.map((ev) => {
      const av = ev.pic ? '<span class="cal-day-pic" title="' + esc(ev.pic) + '">' + esc(initials(ev.pic)) + '</span>' : '';
      const who = ev.pic ? '<span class="cal-day-who">' + esc(ev.pic) + '</span>' : '';
      const time = ev.time ? '<span class="cal-day-time">' + ev.time + '</span>' : '';
      return '<button class="cal-day-row" data-evt-id="' + ev._idx + '">' +
        '<span class="cal-dot cal-dot--' + dotClass(ev.type) + '"></span>' +
        time +
        '<span class="cal-day-main"><span class="cal-day-title">' + esc(ev.title) + '</span>' +
        '<span class="cal-day-sub">' + EVENT_LABEL[ev.type] + (ev.sub ? ' · ' + esc(ev.sub) : '') + '</span></span>' +
        who + av +
        '</button>';
    }).join('') + '</div>';
  }

  function dotClass(type) {
    return type === 'task-deadline' ? 'task' : type === 'order-deadline' ? 'order' : type === 'shoot' ? 'shoot' : (type === 'wording-deadline' || type === 'ct-deadline') ? 'wording' : type === 'cplan-deadline' ? 'order' : 'delivery';
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
    else renderDay();
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
      if (ROLE === 'lead_content') return 'content-team.html?id=' + encodeURIComponent(ev.refId);
      if (ROLE === 'content') return 'content-workbench.html?id=' + encodeURIComponent(ev.refId);
    }
    // Content Task / Plan (Phase 6)
    if (ev.refKind === 'ctask') return (ROLE === 'content' ? 'content-workbench.html?task=' : 'content-team.html?task=') + encodeURIComponent(ev.refId);
    if (ev.refKind === 'cplan') return 'content-team.html?plan=' + encodeURIComponent(ev.refId);
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
    // Mini-calendar đổi tháng (không đổi ngày đang chọn)
    const miniNav = e.target.closest('[data-mini-nav]');
    if (miniNav) {
      const dir = miniNav.getAttribute('data-mini-nav') === 'next' ? 1 : -1;
      miniCursor = new Date(miniCursor.getFullYear(), miniCursor.getMonth() + dir, 1);
      render();
      return;
    }
    // "+N khác" hoặc click số ngày → mở Day view của đúng ngày đó
    const openDay = e.target.closest('[data-more-key], [data-open-day]');
    if (openDay) {
      const key = openDay.getAttribute('data-more-key') || openDay.getAttribute('data-open-day');
      gotoDay(parseDate(key));
    }
  }

  // Mở Day view tại 1 ngày: đồng bộ selectedDay + miniCursor + cursor.
  function gotoDay(d) {
    if (!d) return;
    selectedDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    miniCursor = new Date(d.getFullYear(), d.getMonth(), 1);
    cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    view = 'day'; syncViewButtons(); render();
  }

  function syncViewButtons() {
    document.querySelectorAll('.cal-view-btn').forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-view') === view));
  }

  function wire() {
    $('cal-prev').addEventListener('click', () => { shiftPeriod(-1); render(); });
    $('cal-next').addEventListener('click', () => { shiftPeriod(1); render(); });
    $('cal-today').addEventListener('click', () => {
      cursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
      weekRef = new Date(TODAY); selectedDay = new Date(TODAY); miniCursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
      render();
    });
    document.querySelectorAll('.cal-view-btn').forEach((b) => b.addEventListener('click', () => {
      view = b.getAttribute('data-view'); syncViewButtons();
      const cursorHasToday = cursor.getFullYear() === TODAY.getFullYear() && cursor.getMonth() === TODAY.getMonth();
      if (view === 'week') {
        // Vào week: nếu đang xem tháng của "hôm nay" → tuần chứa hôm nay; else giữa tháng đang xem.
        weekRef = cursorHasToday ? new Date(TODAY) : new Date(cursor.getFullYear(), cursor.getMonth(), 15);
      } else if (view === 'day') {
        // Vào day: nếu selectedDay không thuộc tháng đang xem → chọn hôm nay (nếu cùng tháng) hoặc mùng 1.
        if (selectedDay.getFullYear() !== cursor.getFullYear() || selectedDay.getMonth() !== cursor.getMonth()) {
          selectedDay = cursorHasToday ? new Date(TODAY) : new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        }
        miniCursor = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
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
    } else if (view === 'day') {
      // Day view: ‹ › dịch ±1 NGÀY; đồng bộ mini-calendar + cursor theo tháng của ngày mới.
      selectedDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() + dir);
      miniCursor = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
      cursor = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
    } else {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    }
  }

  /* ---------- Scope note ---------- */
  function setScopeNote() {
    if (!elScopeNote) return;
    if (IS_FULL) elScopeNote.textContent = 'Bạn đang xem TOÀN BỘ lịch của team (Admin/Account).';
    else if (IS_PRODUCTION) elScopeNote.textContent = 'Chỉ hiển thị task bạn đang phụ trách (P.I.C).';
    else if (IS_CONTENT) elScopeNote.textContent = 'Chỉ hiển thị Hạn Content Wording (do Account đặt).';
    else elScopeNote.textContent = '';
  }

  /* ---------- Load ---------- */
  // silent=true → refresh ngầm (realtime/poll), không bật lại spinner, giữ nguyên view/cursor/filter.
  async function load(silent) {
    setScopeNote();
    let tasks = [], orders = [], ctasks = [], cplans = [];
    try {
      if (window.MH && window.MH.supabaseReady) { try { await window.MH.supabaseReady; } catch (e) {} }
      if (window.MH && window.MH.store) {
        const needTasks = !IS_CONTENT;
        const needOrders = !IS_PRODUCTION;
        // Content Deep Workflow events (Phase 6) cho Content team + admin.
        const needContent = ROLE === 'lead_content' || ROLE === 'admin' || ROLE === 'content';
        const store = window.MH.store;
        const [tr, or, ctr, cpr] = await Promise.all([
          needTasks ? store.tasks.list() : Promise.resolve([]),
          needOrders ? store.orders.list() : Promise.resolve([]),
          (needContent && store.contentTasks) ? store.contentTasks.list() : Promise.resolve([]),
          (needContent && store.contentPlans) ? store.contentPlans.list() : Promise.resolve([])
        ]);
        tasks = Array.isArray(tr) ? tr : [];
        orders = Array.isArray(or) ? or : [];
        ctasks = Array.isArray(ctr) ? ctr : [];
        cplans = Array.isArray(cpr) ? cpr : [];
      }
    } catch (e) {
      console.warn('[calendar] load failed:', e);
    }
    allEvents = buildEvents(tasks, orders, ctasks, cplans);
    if (!silent) {
      if (elLoading) elLoading.hidden = true;
      if (elSurface) elSurface.hidden = false;
    }
    render();
  }

  /* ---------- Đồng bộ realtime ----------
     1) Supabase Realtime trên orders/tasks (best-effort — chỉ fire nếu 2 bảng
        đã được ADD vào publication; nếu chưa, poll 60s lo phần còn lại).
     2) Poll 60s fallback. 3) Reload khi quay lại tab (visibilitychange).
     Mọi reload là silent (không nháy spinner, giữ nguyên tháng/view/filter). */
  let reloadTimer = null;
  function scheduleReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => { reloadTimer = null; load(true); }, 600); // debounce burst thay đổi
  }
  function startRealtime() {
    // 2) Poll fallback
    setInterval(() => { if (!document.hidden) load(true); }, 60000);
    // 3) Reload khi tab được focus lại
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
    // 1) Supabase Realtime (nếu có client)
    try {
      const sbc = window.MH && window.MH.supabase;
      if (!sbc || typeof sbc.channel !== 'function') return;
      const ch = sbc.channel('cal-sync-' + (USER.id || USER.email || 'anon'));
      if (!IS_CONTENT) ch.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleReload);
      if (!IS_PRODUCTION) ch.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleReload);
      ch.subscribe();
      window.addEventListener('beforeunload', () => { try { sbc.removeChannel(ch); } catch (e) {} });
    } catch (e) {
      console.warn('[calendar] realtime subscribe failed (poll vẫn chạy):', e);
    }
  }

  /* ---------- esc ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Boot ---------- */
  function boot() { wire(); load().then(startRealtime); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
