/* =====================================================================
   media-operations.js — Media Operations (Điều phối Media)
   Workspace của LEAD MEDIA cho Media Order (Quay / Chụp / Video).

   Nguyên tắc routing (xem window.MH.routing ở app.js — nguồn sự thật chung):
     · Media Order KHÔNG đi qua Content Wording. Cổng thay thế = LOGISTICS
       (ngày/giờ · địa điểm · liên hệ onsite · dịch vụ · PIC · deadline).
     · Media CÓ KỊCH BẢN (TVC/testimonial/interview/VO/scripted video) chỉ sinh
       1 Content Script Subtask (content_tasks, source='media_order') cho team
       Content; Parent Order KHÔNG bị kéo vào flow wording. Script duyệt xong
       mới mở khoá Push Production.
     · Ads: KHÔNG đụng — order ads bị loại khỏi mọi truy vấn của trang này.

   Roles: lead_media + admin = owner (mọi action) · account = support (read +
   deep-link liên hệ requester) · system_supervisor = read-only monitor.

   ⚠ Cần supabase/add-media-operations.sql để persist các cột media_*; chưa chạy
   thì data-store loop-strip bỏ cột thiếu → UI vẫn chạy (state không lưu được).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth guard ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (user.role === 'client') { location.replace('client-dashboard.html'); return; }
  const ALLOWED = ['admin', 'lead_media', 'account', 'system_supervisor'];
  if (ALLOWED.indexOf(user.role) < 0) {
    if (window.MH && window.MH.toast) window.MH.toast({ type: 'warning', title: 'Không có quyền', message: 'Media Operations dành cho Lead Media / Admin (Account xem hỗ trợ).' });
    setTimeout(function () { location.replace('dashboard.html'); }, 900);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  // Phase 2 của brief: KHÔNG alias lead_media → account rồi mất context.
  // Giữ role thật; quyền vận hành đọc từ IS_LEAD_MEDIA/CAN_OPERATE.
  const ORIGINAL_ROLE = user.role;
  const IS_LEAD_MEDIA = ORIGINAL_ROLE === 'lead_media';
  const IS_ADMIN = ORIGINAL_ROLE === 'admin';
  const IS_ACCOUNT = ORIGINAL_ROLE === 'account';
  const IS_SUPERVISOR = ORIGINAL_ROLE === 'system_supervisor';
  const CAN_OPERATE = IS_LEAD_MEDIA || IS_ADMIN;   // chốt logistics/lịch/PIC/push/script
  const READONLY = IS_ACCOUNT || IS_SUPERVISOR;

  (function initChip() {
    const n = document.getElementById('hpc-name'); if (n) n.textContent = user.name || 'User';
    const a = document.getElementById('hpc-avatar'); if (a) a.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
    const r = document.getElementById('hpc-role-badge'); if (r) {
      r.textContent = ORIGINAL_ROLE === 'lead_media' ? 'Lead Media' : ORIGINAL_ROLE.charAt(0).toUpperCase() + ORIGINAL_ROLE.slice(1);
      r.className = 'role-badge r--' + ORIGINAL_ROLE + ' header-pc-role';
    }
    const badge = document.getElementById('mo-readonly-badge');
    if (badge && READONLY) badge.hidden = false;
    const lo = document.getElementById('logout-btn');
    if (lo) lo.addEventListener('click', function () { localStorage.removeItem('mh-user'); if (window.MH && window.MH.toast) window.MH.toast({ type: 'info', title: 'Đã đăng xuất' }); setTimeout(function () { location.replace('login.html'); }, 400); });
  })();

  /* ---------- Helpers ---------- */
  function toast(t, ti, m) { if (window.MH && window.MH.toast) window.MH.toast({ type: t, title: ti, message: m }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function parseDt(s) {
    if (!s) return null;
    s = String(s);
    const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + (s.length <= 10 ? 'T00:00:00' : '') + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }
  function p2(n) { return String(n).padStart(2, '0'); }
  function fmtDate(s) { const d = parseDt(s); return d ? p2(d.getUTCDate ? d.getDate() : d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() : (s || '—'); }
  function fmtDT(s) { const d = parseDt(s); return d ? fmtDate(s) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) : (s || '—'); }
  function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function initials(name) { return String(name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }
  function dayStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  const ROUTING = (window.MH && window.MH.routing) || {
    isAdsOrder: function (o) { return !!o && (o.order_kind === 'ads_order' || o.request_type === 'ads'); },
    isMediaOrder: function (o) { return !!o && ['media', 'shoot', 'photo', 'video'].indexOf(o.request_type) >= 0 && !(o.order_kind === 'ads_order' || o.request_type === 'ads'); },
    mediaNeedsContentScript: function (o) { return !!o && (o.media_script_required === true || o.needs_script === true); }
  };

  /* ---------- Constants ---------- */
  const LOGISTICS_LABEL = { pending: 'Chưa kiểm tra', checking: 'Đang kiểm tra', need_info: 'Thiếu thông tin', confirmed: 'Đã chốt logistics' };
  const SCHEDULE_LABEL = { pending: 'Chưa chốt lịch', confirmed: 'Đã chốt lịch', rescheduled: 'Đã dời lịch', cancelled: 'Đã huỷ lịch' };
  const SCRIPT_LABEL = {
    not_required: 'Không cần script', required: 'Cần script — chưa tạo subtask', subtask_created: 'Đã tạo subtask',
    in_progress: 'Content đang viết', submitted_to_lead: 'Chờ Lead Content duyệt', lead_revision: 'Lead trả chỉnh',
    lead_approved: 'Lead Content đã duyệt', script_approved: 'Script đã chốt', cancelled: 'Đã huỷ script'
  };
  const SCRIPT_TYPE_LABEL = {
    tvc: 'TVC', testimonial: 'Testimonial', interview: 'Phỏng vấn', scripted_video: 'Video có kịch bản',
    voice_over: 'Voice-over', course_intro: 'Video giới thiệu khoá học', recruitment_video: 'Video tuyển sinh', video_series: 'Video series'
  };
  // Nhãn task theo góc nhìn Media (brief §10.3) — status DB giữ nguyên.
  const TASK_STATUS_MEDIA = {
    pending: 'Chờ nhận task', received: 'Đã nhận task', inprogress: 'Đang quay/chụp/dựng',
    review: 'Chờ Lead Media duyệt', revision: 'Chỉnh sửa nội bộ', feedback_wait: 'Chờ feedback client',
    feedback_fix: 'Chỉnh theo feedback', ready: 'Sẵn sàng bàn giao', delivered: 'Đã bàn giao',
    completed: 'Hoàn thành', paused: 'Tạm dừng', cancelled: 'Đã huỷ'
  };
  const TASK_TYPE_LABEL = { shoot: 'Quay', photo: 'Chụp', video: 'Video', media: 'Quay/Chụp', edit: 'Dựng / Hậu kỳ', motion: 'Motion', design: 'Thiết kế' };
  const MEDIA_TASK_TYPES = ['media', 'shoot', 'photo', 'video', 'edit'];
  const PRIO_LABEL = { normal: 'Bình thường', urgent: 'Gấp', critical: 'Rất gấp' };
  // ⚠ content_tasks.priority CHECK = ('low','normal','high','urgent') — KHÔNG có 'critical'
  // (khác thang priority của orders). Đưa 'critical' xuống sẽ vi phạm CHECK → insert fail.
  const CT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
  const CT_PRIO_LABEL = { low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Gấp' };
  function ctPriority(orderPriority) {
    if (orderPriority === 'critical') return 'urgent';
    return CT_PRIORITIES.indexOf(orderPriority) >= 0 ? orderPriority : 'normal';
  }
  const PROD_PIC_ROLES = ['design', 'editor'];

  /* ---------- State ---------- */
  let ORDERS = [];        // media orders (không gồm ads)
  let TASKS = [];         // production tasks thuộc media
  let SCRIPT_TASKS = [];  // content_tasks source='media_order'
  let STAFF = [];
  let view = 'overview';
  let currentOrder = null;
  let modalSave = null;
  const ALL_VIEWS = ['overview', 'queue', 'schedule', 'tasks', 'review', 'all'];
  const FILTERS = { search: '', service: '', logistics: '', script: '', branch: '', overdue: '' };
  const SCH = { range: 'week', pic: '', branch: '', service: '' };

  /* ---------- Derived getters ---------- */
  function logisticsOf(o) { return (o && o.media_logistics_status) || 'pending'; }
  function scheduleOf(o) { return (o && o.media_schedule_status) || 'pending'; }
  function needsScript(o) { return ROUTING.mediaNeedsContentScript(o); }
  // Trạng thái script hiển thị = trạng thái SỐNG của subtask bên Content, trừ khi
  // Lead Media đã chốt 'script_approved' (cột trên order là chốt cuối cùng).
  // CỐ Ý không để Content ghi ngược vào orders: role content/lead_content KHÔNG có
  // UPDATE orders cho media order dưới RLS → ghi sẽ fail im lặng. Đọc xuôi an toàn hơn.
  const CT_TO_SCRIPT = {
    new: 'subtask_created', assigned: 'subtask_created', pic_assigned: 'subtask_created',
    in_progress: 'in_progress', submitted_to_lead: 'submitted_to_lead', lead_revision: 'lead_revision',
    lead_approved: 'lead_approved', completed: 'lead_approved'
  };
  function scriptStatusOf(o) {
    const own = o && o.media_script_status;
    if (own === 'script_approved' || own === 'cancelled') return own;
    const t = scriptTaskOf(o);
    if (t && CT_TO_SCRIPT[t.status]) return CT_TO_SCRIPT[t.status];
    return own || (needsScript(o) ? 'required' : 'not_required');
  }
  function isScriptApproved(o) { return scriptStatusOf(o) === 'script_approved'; }
  function isPushed(o) { return !!o && ['unassigned', 'cancelled'].indexOf(o.production_status || 'unassigned') < 0; }
  function isClosed(o) { return !!o && (o.production_status === 'cancelled' || o.account_status === 'rejected' || o.production_status === 'completed'); }
  function picName(id, snapshot) { return (window.MH && window.MH.picLabel) ? window.MH.picLabel(id, snapshot) : (snapshot || ''); }
  function picVideo(o) { return picName(o.production_pic_video_user_id, o.production_pic_video); }
  function picPhoto(o) { return picName(o.production_pic_photo_user_id, o.production_pic_photo); }
  function picEditor(o) { return picName(o.production_pic_editor_user_id, o.production_pic_editor); }
  function allPics(o) { return [picVideo(o), picPhoto(o), picEditor(o), o.production_pic].filter(Boolean); }
  function serviceOf(o) {
    if (o.media_service) return o.media_service;
    // Fallback: suy từ PIC đã gán / hạng mục / brief (order cũ chưa có cột media_service).
    const parts = [];
    const items = Array.isArray(o.deliverable_type) ? o.deliverable_type.join(' ') : String(o.deliverable_type || '');
    const brief = String(o.content_brief || '');
    if (o.production_pic_video || /quay/i.test(items) || /Dịch vụ:[^·]*Quay/i.test(brief)) parts.push('Quay');
    if (o.production_pic_photo || /chụp/i.test(items) || /Dịch vụ:[^·]*Chụp/i.test(brief)) parts.push('Chụp');
    if (!parts.length && o.request_type === 'video') parts.push('Quay');
    if (!parts.length && o.request_type === 'photo') parts.push('Chụp');
    return parts.join(' + ');
  }
  function scriptTaskOf(o) {
    if (!o) return null;
    if (o.media_script_task_id) {
      const byId = SCRIPT_TASKS.find(function (t) { return t.id === o.media_script_task_id; });
      if (byId) return byId;
    }
    return SCRIPT_TASKS.find(function (t) { return t.order_id === o.order_id; }) || null;
  }
  // Điều kiện Push (brief §11) — trả về danh sách còn thiếu.
  function pushMissing(o) {
    const miss = [];
    if (logisticsOf(o) !== 'confirmed') miss.push('chốt logistics');
    if (!o.shoot_date) miss.push('ngày quay/chụp');
    if (!o.shoot_time) miss.push('giờ quay/chụp');
    if (!o.shoot_location) miss.push('địa điểm');
    if (!o.onsite_contact) miss.push('người liên hệ onsite');
    if (!o.onsite_phone) miss.push('SĐT onsite');
    if (!serviceOf(o)) miss.push('dịch vụ (Quay/Chụp)');
    if (!allPics(o).length) miss.push('ít nhất 1 PIC Media');
    if (!o.internal_deadline) miss.push('Internal Deadline');
    if (needsScript(o) && !isScriptApproved(o)) miss.push('script được duyệt');
    return miss;
  }
  function nextActionOf(o) {
    if (isClosed(o)) return 'Đã đóng';
    if (isPushed(o)) return 'Theo dõi sản xuất';
    if (logisticsOf(o) === 'need_info') return 'Chờ bổ sung thông tin';
    if (logisticsOf(o) !== 'confirmed') return 'Kiểm tra logistics';
    if (needsScript(o) && !isScriptApproved(o)) {
      const st = scriptStatusOf(o);
      if (st === 'required') return 'Tạo Script Subtask';
      if (st === 'lead_approved') return 'Chốt Script Approved';
      return 'Chờ Content viết script';
    }
    if (scheduleOf(o) !== 'confirmed') return 'Chốt lịch quay/chụp';
    if (!allPics(o).length) return 'Gán PIC Media';
    if (!o.internal_deadline) return 'Set Internal Deadline';
    return 'Push Production';
  }
  function isOverdue(o) {
    const d = parseDt(o.internal_deadline || o.agreed_deadline || o.requested_deadline);
    if (!d || isClosed(o)) return false;
    return d.getTime() < Date.now();
  }

  /* ---------- Chips ---------- */
  function chip(txt, cls) { return '<span class="mo-chip ' + cls + '">' + esc(txt) + '</span>'; }
  function logisticsChip(o) {
    const s = logisticsOf(o);
    return chip(LOGISTICS_LABEL[s] || s, s === 'confirmed' ? 'mo-ok' : (s === 'need_info' ? 'mo-bad' : 'mo-warn'));
  }
  function scriptChip(o) {
    if (!needsScript(o)) return '<span class="text-xs muted">Không cần</span>';
    const s = scriptStatusOf(o);
    return chip(SCRIPT_LABEL[s] || s, s === 'script_approved' ? 'mo-ok' : (s === 'lead_revision' ? 'mo-bad' : 'mo-warn'));
  }
  function scheduleChip(o) {
    const s = scheduleOf(o);
    const when = o.shoot_date ? fmtDate(o.shoot_date) + (o.shoot_time ? ' · ' + esc(o.shoot_time) : '') : 'chưa có lịch';
    return chip(when, s === 'confirmed' ? 'mo-ok' : (s === 'cancelled' ? 'mo-bad' : 'mo-warn'));
  }
  function naChip(o) { return '<span class="na-chip">→ ' + esc(nextActionOf(o)) + '</span>'; }
  function slaChip(dl, done) {
    if (done) return '';
    if (!dl) return '<span class="sla-chip sla-none">Chưa đặt hạn</span>';
    const d = parseDt(dl); if (!d) return '';
    const h = (d.getTime() - Date.now()) / 3600000;
    let cls, txt;
    if (h < 0) { cls = 'sla-red'; txt = '⚠ Trễ · ' + fmtDate(dl); }
    else if (h < 24) { cls = 'sla-orange'; txt = '<24h · ' + fmtDate(dl); }
    else if (h < 48) { cls = 'sla-yellow'; txt = '<48h · ' + fmtDate(dl); }
    else { cls = 'sla-green'; txt = fmtDate(dl); }
    return '<span class="sla-chip ' + cls + '">' + esc(txt) + '</span>';
  }
  const ICON_CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  function emptyState(icon, title, help) {
    return '<div class="ctm-empty">' + icon + '<div class="ctm-empty-title">' + esc(title) + '</div>' + (help ? '<div class="ctm-empty-help">' + esc(help) + '</div>' : '') + '</div>';
  }

  /* ---------- Data load ---------- */
  async function loadStaff() {
    if (!(window.MH && window.MH.store && window.MH.supabaseEnabled)) return;
    try {
      const list = (await window.MH.store.users.list()) || [];
      STAFF = list.filter(function (u) { return u.status !== 'inactive'; });
      if (window.MH.setUserDir) window.MH.setUserDir(list);
    } catch (e) { console.warn('[mo] load users failed:', e); }
  }
  async function loadOrders() {
    let list = [];
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try { await window.MH.supabaseReady; list = (await window.MH.store.orders.list()) || []; }
      catch (e) { console.warn('[mo] load orders failed:', e); }
    } else {
      try { list = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]'); } catch (e) { list = []; }
    }
    // CHỈ media order — ads bị loại tuyệt đối (không đụng luồng Ads).
    ORDERS = list.filter(function (o) { return ROUTING.isMediaOrder(o); });
    renderAll();
  }
  async function loadTasks() {
    let list = [];
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try { list = (await window.MH.store.tasks.list()) || []; } catch (e) { console.warn('[mo] load tasks failed:', e); }
    } else {
      try { list = JSON.parse(localStorage.getItem('mh-extra-tasks') || '[]'); } catch (e) { list = []; }
    }
    const mediaOrderIds = {};
    ORDERS.forEach(function (o) { mediaOrderIds[o.order_id] = 1; });
    TASKS = list.filter(function (t) {
      return MEDIA_TASK_TYPES.indexOf(t.task_type) >= 0 || mediaOrderIds[t.order_id];
    });
    renderAll();
  }
  async function loadScriptTasks() {
    if (!(window.MH && window.MH.store && window.MH.store.contentTasks)) return;
    try {
      const list = (await window.MH.store.contentTasks.list()) || [];
      SCRIPT_TASKS = list.filter(function (t) { return t.source === 'media_order'; });
    } catch (e) { console.warn('[mo] load script tasks failed:', e); }
    renderAll();
  }

  /* ---------- Persist ---------- */
  async function patchOrder(o, patch, okMsg) {
    Object.assign(o, patch);
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try {
        const saved = await window.MH.store.orders.update(o.order_id, patch);
        if (!saved) {
          toast('danger', 'Không lưu được', o.order_id + ' — RLS chặn hoặc đơn không tồn tại. Kiểm tra đã chạy add-media-operations.sql và quyền Lead Media.');
          return false;
        }
      } catch (e) {
        console.warn('[mo] patchOrder failed:', e);
        toast('danger', 'Lưu thất bại', 'Không ghi được vào hệ thống — kiểm tra add-media-operations.sql.');
        return false;
      }
    } else {
      // Demo/localStorage: ghi ngược vào mh-submitted-orders để reload còn thấy.
      try {
        const raw = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]');
        const i = raw.findIndex(function (x) { return x.order_id === o.order_id; });
        if (i >= 0) { Object.assign(raw[i], patch); localStorage.setItem('mh-submitted-orders', JSON.stringify(raw)); }
      } catch (e) { /* demo-only */ }
    }
    if (okMsg) toast('success', okMsg, o.order_id);
    renderAll();
    if (currentOrder && currentOrder.order_id === o.order_id) openDrawer(o);
    return true;
  }
  async function notifyUserId(userId, n) {
    if (!userId || !(window.MH && window.MH.store && window.MH.supabaseEnabled)) return;
    try { await window.MH.store.notifications.create(Object.assign({ user_id: userId }, n)); }
    catch (e) { console.warn('[mo] notify failed:', e); }
  }
  async function notifyRoles(roles, n) {
    if (!(window.MH && window.MH.supabaseEnabled && window.MH.supabase)) return false;
    try {
      const { error } = await window.MH.supabase.rpc('notify_roles', {
        p_roles: roles, p_type: n.type, p_title: n.title, p_message: n.message,
        p_link: n.link || null, p_entity_type: n.related_entity_type || null, p_entity_id: n.related_entity_id || null
      });
      if (error) { console.warn('[mo] notify_roles error:', error); return false; }
      return true;
    } catch (e) { console.warn('[mo] notify_roles failed (chạy add-notify-roles-rpc.sql?):', e); return false; }
  }

  window.__MO_DEBUG = {
    getOrders: function () { return ORDERS; },
    getTasks: function () { return TASKS; },
    getScriptTasks: function () { return SCRIPT_TASKS; },
    pushMissing: pushMissing,
    nextActionOf: nextActionOf
  };

  /* ---------- Tabs ---------- */
  function renderTabs() {
    document.querySelectorAll('#mo-tabs [data-mo-view]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mo-view') === view);
    });
    ALL_VIEWS.forEach(function (v) {
      const el = document.getElementById('mo-view-' + v);
      if (el) el.hidden = v !== view;
    });
    const q = queueOrders().length, s = scheduleOrders('all').length, t = TASKS.length;
    setText('mo-count-queue', q); setText('mo-count-schedule', s); setText('mo-count-tasks', t);
    setText('mo-count-review', reviewTasks('review').length + reviewTasks('revision').length);
    setText('mo-count-all', ORDERS.length);
  }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function goView(v) { view = v; renderTabs(); if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' }); }

  /* ---------- Queries ---------- */
  function queueOrders() { return ORDERS.filter(function (o) { return !isPushed(o) && !isClosed(o); }); }
  function scheduleOrders(range) {
    const withDate = ORDERS.filter(function (o) { return !!o.shoot_date && !isClosed(o); });
    if (range === 'all') return withDate.sort(byShootDate);
    const today = dayStart(new Date());
    return withDate.filter(function (o) {
      const d = parseDt(o.shoot_date); if (!d) return false;
      const ds = dayStart(d);
      if (range === 'today') return ds.getTime() === today.getTime();
      if (range === 'week') { const diff = (ds - today) / 86400000; return diff >= 0 && diff < 7; }
      if (range === 'month') return ds.getMonth() === today.getMonth() && ds.getFullYear() === today.getFullYear() && ds >= today;
      return true;
    }).sort(byShootDate);
  }
  function byShootDate(a, b) { return String(a.shoot_date || '').localeCompare(String(b.shoot_date || '')); }
  function reviewTasks(kind) {
    if (kind === 'review') return TASKS.filter(function (t) { return t.status === 'review'; });
    if (kind === 'revision') return TASKS.filter(function (t) { return t.status === 'revision' || t.status === 'feedback_fix'; });
    if (kind === 'ready') return TASKS.filter(function (t) { return t.status === 'ready'; });
    return TASKS.filter(function (t) { return t.status === 'delivered' || t.status === 'completed'; });
  }

  /* ---------- Render: overview ---------- */
  function renderActionCenter() {
    const el = document.getElementById('mo-action-center'); if (!el) return;
    const today = dayStart(new Date());
    const cards = [
      { label: 'Media order mới', n: ORDERS.filter(function (o) { return logisticsOf(o) === 'pending' && !isPushed(o) && !isClosed(o); }).length, color: '#191970', go: 'queue' },
      { label: 'Chờ kiểm tra logistics', n: ORDERS.filter(function (o) { return logisticsOf(o) === 'checking'; }).length, color: '#1D4ED8', go: 'queue' },
      { label: 'Thiếu thông tin', n: ORDERS.filter(function (o) { return logisticsOf(o) === 'need_info'; }).length, color: '#BA110F', go: 'queue' },
      { label: 'Cần script / đang viết', n: ORDERS.filter(function (o) { return needsScript(o) && !isScriptApproved(o) && !isClosed(o); }).length, color: '#6B21A8', go: 'queue' },
      { label: 'Chờ gán PIC', n: ORDERS.filter(function (o) { return !isPushed(o) && !isClosed(o) && !allPics(o).length; }).length, color: '#B07600', go: 'queue' },
      { label: 'Lịch hôm nay', n: scheduleOrders('today').length, color: '#0E7490', go: 'schedule' },
      { label: 'Lịch 7 ngày tới', n: scheduleOrders('week').length, color: '#0E7490', go: 'schedule' },
      { label: 'Đang quay/chụp/dựng', n: TASKS.filter(function (t) { return t.status === 'inprogress'; }).length, color: '#1D4ED8', go: 'tasks' },
      { label: 'Chờ duyệt nội bộ', n: reviewTasks('review').length, color: '#6B21A8', go: 'review' },
      { label: 'Trễ hạn', n: ORDERS.filter(isOverdue).length, color: '#BA110F', go: 'all' }
    ];
    el.innerHTML = cards.map(function (c) {
      return '<button class="ctm-ac-card" data-mo-go="' + c.go + '" style="--ac:' + c.color + '"><span class="ctm-ac-n">' + c.n + '</span><span class="ctm-ac-l">' + esc(c.label) + '</span></button>';
    }).join('');
    // Card "Lịch hôm nay" bấm vào phải set range=today để list khớp con số.
    el.querySelectorAll('[data-mo-go]').forEach(function (b) {
      if (b.textContent.indexOf('hôm nay') >= 0) b.setAttribute('data-mo-range', 'today');
      if (b.textContent.indexOf('7 ngày') >= 0) b.setAttribute('data-mo-range', 'week');
    });
  }
  function orderCardHtml(o, extra) {
    return '<button class="ctm-inbox-item" data-mo-open="' + esc(o.order_id) + '">'
      + '<div class="ctm-ii-top"><b>' + esc(o.order_id) + '</b>' + (serviceOf(o) ? ' <span class="src-chip src-ads">' + esc(serviceOf(o)) + '</span>' : '') + '</div>'
      + '<div class="ctm-ii-title">' + esc(o.project_name || '—') + '</div>'
      + '<div class="text-xs muted">' + esc(o.department || '—') + (extra || '') + '</div>'
      + '</button>';
  }
  function renderUpcoming() {
    const box = document.getElementById('mo-upcoming'); if (!box) return;
    const list = scheduleOrders('week');
    box.innerHTML = list.length ? list.slice(0, 8).map(function (o) {
      return orderCardHtml(o, ' · ' + esc(o.shoot_location || 'chưa có địa điểm') + '<br>' + scheduleChip(o) + ' ' + naChip(o));
    }).join('') : emptyState(ICON_CAM, 'Không có lịch quay/chụp trong 7 ngày tới', 'Chốt lịch trong Media Orders chờ xử lý để hiện ở đây.');
  }
  function renderRisk() {
    const box = document.getElementById('mo-risk'); if (!box) return;
    const list = ORDERS.filter(function (o) { return isOverdue(o) || logisticsOf(o) === 'need_info'; });
    setText('mo-risk-count', list.length);
    box.innerHTML = list.length ? list.map(function (o) {
      return orderCardHtml(o, '<br>' + logisticsChip(o) + ' ' + slaChip(o.internal_deadline || o.requested_deadline, false));
    }).join('') : emptyState(ICON_CHECK, 'Không có đơn trễ hạn / thiếu thông tin', 'Mọi Media Order đang trong hạn.');
  }
  function renderWorkload() {
    const box = document.getElementById('mo-workload'); if (!box) return;
    const per = {};
    TASKS.forEach(function (t) {
      if (['completed', 'cancelled'].indexOf(t.status) >= 0) return;
      const nm = picName(t.assigned_to_user_id, t.assigned_to); if (!nm) return;
      per[nm] = (per[nm] || 0) + 1;
    });
    ORDERS.filter(function (o) { return !isPushed(o) && !isClosed(o); }).forEach(function (o) {
      allPics(o).forEach(function (nm) { per[nm] = (per[nm] || 0) + 1; });
    });
    const rows = Object.keys(per).map(function (k) { return [k, per[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (!rows.length) { box.innerHTML = emptyState(ICON_CAM, 'Chưa có PIC Media nào đang có việc', 'Gán PIC Quay/Chụp/Dựng để theo dõi tải công việc.'); return; }
    const denom = Math.max(rows[0][1], 4);
    box.innerHTML = rows.map(function (e) {
      const w = Math.max(Math.round(e[1] / denom * 100), 6);
      return '<div class="ctm-wl-row"><span class="ctm-wl-name"><span class="pic-avatar avatar">' + esc(initials(e[0])) + '</span>' + esc(e[0]) + '</span>'
        + '<span class="ctm-wl-track"><i style="width:' + w + '%"></i></span><b class="ctm-wl-val">' + e[1] + '</b></div>';
    }).join('');
  }
  function renderScriptList() {
    const box = document.getElementById('mo-script-list'); if (!box) return;
    const list = ORDERS.filter(function (o) { return needsScript(o) && !isClosed(o); });
    setText('mo-script-count', list.length);
    box.innerHTML = list.length ? list.map(function (o) {
      const st = scriptTaskOf(o);
      return orderCardHtml(o, (st && st.task_code ? ' · ' + esc(st.task_code) : '') + '<br>' + scriptChip(o) + (st && st.assigned_pic ? ' <span class="text-xs muted">PIC: ' + esc(picName(st.assigned_pic_user_id, st.assigned_pic)) + '</span>' : ''));
    }).join('') : emptyState(ICON_CHECK, 'Không có order cần script', 'Order TVC / testimonial / interview / VO sẽ hiện tại đây.');
  }

  /* ---------- Render: queue ---------- */
  function renderQueue() {
    const tb = document.getElementById('mo-queue-tbody'); if (!tb) return;
    const list = queueOrders().sort(function (a, b) { return String(a.shoot_date || 'z').localeCompare(String(b.shoot_date || 'z')); });
    const info = document.getElementById('mo-queue-info');
    if (info) info.innerHTML = '<strong>' + list.length + '</strong> đơn chờ xử lý';
    tb.innerHTML = list.length ? list.map(function (o) {
      return '<tr data-id="' + esc(o.order_id) + '">'
        + '<td><span class="order-id">' + esc(o.order_id) + '</span></td>'
        + '<td><b>' + esc(o.project_name || '—') + '</b></td>'
        + '<td><span class="text-xs">' + esc(o.department || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(serviceOf(o) || '—') + '</span></td>'
        + '<td>' + scheduleChip(o) + '</td>'
        + '<td><span class="text-xs">' + esc(o.shoot_location || '—') + '</span></td>'
        + '<td><span class="text-xs">' + (allPics(o).length ? esc(allPics(o).join(', ')) : '<em class="muted">chưa gán</em>') + '</span></td>'
        + '<td>' + scriptChip(o) + '</td>'
        + '<td>' + logisticsChip(o) + '</td>'
        + '<td>' + naChip(o) + '</td>'
        + '<td><button class="btn btn-secondary btn-sm" data-mo-open="' + esc(o.order_id) + '">Mở</button></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="11" style="text-align:center;padding:44px;color:var(--text-muted)">Không có Media Order nào chờ xử lý.</td></tr>';
  }

  /* ---------- Render: schedule ---------- */
  function renderSchedule() {
    const box = document.getElementById('mo-schedule-list'); if (!box) return;
    let list = scheduleOrders(SCH.range);
    if (SCH.pic) list = list.filter(function (o) { return allPics(o).indexOf(SCH.pic) >= 0; });
    if (SCH.branch) list = list.filter(function (o) { return (o.department || '') === SCH.branch; });
    if (SCH.service) list = list.filter(function (o) { return (serviceOf(o) || '').indexOf(SCH.service) >= 0; });
    const info = document.getElementById('mo-sch-info');
    if (info) info.innerHTML = '<strong>' + list.length + '</strong> buổi quay/chụp';
    // Nhóm theo ngày để Lead Media đọc theo lịch chứ không phải bảng phẳng.
    const byDay = {};
    list.forEach(function (o) { const k = String(o.shoot_date).slice(0, 10); (byDay[k] = byDay[k] || []).push(o); });
    const days = Object.keys(byDay).sort();
    box.innerHTML = days.length ? days.map(function (k) {
      const isToday = k === ymd(new Date());
      return '<div class="mo-sch-day">'
        + '<div class="mo-sch-day-head">' + esc(fmtDate(k)) + (isToday ? ' <span class="mo-chip mo-warn">Hôm nay</span>' : '') + ' <span class="text-xs muted">· ' + byDay[k].length + ' buổi</span></div>'
        + byDay[k].map(function (o) {
            return '<button class="ctm-inbox-item" data-mo-open="' + esc(o.order_id) + '">'
              + '<div class="ctm-ii-top"><b>' + esc(o.order_id) + '</b> ' + scheduleChip(o) + (serviceOf(o) ? ' <span class="src-chip src-ads">' + esc(serviceOf(o)) + '</span>' : '') + '</div>'
              + '<div class="ctm-ii-title">' + esc(o.project_name || '—') + '</div>'
              + '<div class="text-xs muted">' + esc(o.shoot_location || 'chưa có địa điểm') + ' · ' + esc(o.department || '—')
              + (o.onsite_contact ? ' · Onsite: ' + esc(o.onsite_contact) + (o.onsite_phone ? ' (' + esc(o.onsite_phone) + ')' : '') : '')
              + '<br>PIC: ' + (allPics(o).length ? esc(allPics(o).join(', ')) : 'chưa gán') + ' ' + naChip(o) + '</div>'
              + '</button>';
          }).join('')
        + '</div>';
    }).join('') : emptyState(ICON_CAM, 'Không có buổi quay/chụp nào', 'Đổi bộ lọc phạm vi hoặc chốt lịch cho Media Order.');
    // Filter options (giữ selection)
    fillSelect('mo-sch-pic', uniq(ORDERS.reduce(function (acc, o) { return acc.concat(allPics(o)); }, [])), SCH.pic, 'Mọi PIC');
    fillSelect('mo-sch-branch', uniq(ORDERS.map(function (o) { return o.department; })), SCH.branch, 'Mọi chi nhánh');
  }
  function uniq(arr) { const seen = {}; return arr.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }).sort(); }
  function fillSelect(id, values, current, placeholder) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = '<option value="">' + placeholder + '</option>' + values.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
    el.value = current || '';
  }

  /* ---------- Render: production tasks ---------- */
  function renderTasks() {
    const tb = document.getElementById('mo-tasks-tbody'); if (!tb) return;
    const list = TASKS.slice().sort(function (a, b) { return String(a.internal_deadline || 'z').localeCompare(String(b.internal_deadline || 'z')); });
    const info = document.getElementById('mo-tasks-info');
    if (info) info.innerHTML = '<strong>' + list.length + '</strong> task Media';
    tb.innerHTML = list.length ? list.map(function (t) {
      const done = ['completed', 'delivered', 'cancelled'].indexOf(t.status) >= 0;
      return '<tr data-task="' + esc(t.task_id) + '">'
        + '<td><span class="order-id">' + esc(t.task_id) + '</span></td>'
        + '<td><b>' + esc(t.project_name || '—') + '</b>' + (t.order_id ? '<div class="text-xs muted">' + esc(t.order_id) + '</div>' : '') + '</td>'
        + '<td><span class="text-xs">' + esc(TASK_TYPE_LABEL[t.task_type] || t.task_type || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(picName(t.assigned_to_user_id, t.assigned_to) || '—') + '</span></td>'
        + '<td><span class="text-xs">' + (t.shoot_date ? esc(fmtDate(t.shoot_date)) + (t.shoot_time ? ' · ' + esc(t.shoot_time) : '') : '—') + '</span></td>'
        + '<td>' + slaChip(t.internal_deadline, done) + '</td>'
        + '<td><span class="tb-status s--' + esc(t.status) + '"><span class="dot"></span>' + esc(TASK_STATUS_MEDIA[t.status] || t.status) + '</span></td>'
        + '<td><a class="btn btn-secondary btn-sm" href="production-board.html?id=' + esc(t.task_id) + '">Mở task</a></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="8" style="text-align:center;padding:44px;color:var(--text-muted)">Chưa có task Media nào. Push Production từ Media Order để tạo task.</td></tr>';
  }

  /* ---------- Render: review / delivery ---------- */
  function taskCardHtml(t) {
    return '<a class="ctm-inbox-item" href="production-board.html?id=' + esc(t.task_id) + '">'
      + '<div class="ctm-ii-top"><b>' + esc(t.task_id) + '</b> <span class="src-chip src-ads">' + esc(TASK_TYPE_LABEL[t.task_type] || t.task_type || '—') + '</span></div>'
      + '<div class="ctm-ii-title">' + esc(t.project_name || '—') + '</div>'
      + '<div class="text-xs muted">PIC: ' + esc(picName(t.assigned_to_user_id, t.assigned_to) || '—')
      + (t.preview_link ? ' · có Preview' : '') + (t.final_link ? ' · có Final' : '')
      + '<br>' + slaChip(t.internal_deadline, ['completed', 'delivered'].indexOf(t.status) >= 0) + '</div>'
      + '</a>';
  }
  function renderReview() {
    const groups = [
      ['mo-rev-internal', 'mo-rev-internal-count', reviewTasks('review'), 'Không có bản nào chờ duyệt', 'PIC gửi duyệt (status "review") sẽ vào đây.'],
      ['mo-rev-revision', 'mo-rev-revision-count', reviewTasks('revision'), 'Không có task cần chỉnh', 'Task bị trả chỉnh nội bộ sẽ hiện ở đây.'],
      ['mo-rev-ready', 'mo-rev-ready-count', reviewTasks('ready'), 'Chưa có bản sẵn sàng bàn giao', 'Task duyệt xong (status "ready") sẽ vào đây.'],
      ['mo-rev-done', 'mo-rev-done-count', reviewTasks('done'), 'Chưa có bản đã bàn giao', 'Task delivered/completed sẽ hiện ở đây.']
    ];
    groups.forEach(function (g) {
      const box = document.getElementById(g[0]); if (!box) return;
      const cnt = document.getElementById(g[1]); if (cnt) cnt.textContent = g[2].length;
      box.innerHTML = g[2].length ? g[2].map(taskCardHtml).join('') : emptyState(ICON_CHECK, g[3], g[4]);
    });
  }

  /* ---------- Render: all ---------- */
  function applyAllFilters(list) {
    const q = FILTERS.search.toLowerCase();
    return list.filter(function (o) {
      if (FILTERS.service && (serviceOf(o) || '').indexOf(FILTERS.service) < 0) return false;
      if (FILTERS.logistics && logisticsOf(o) !== FILTERS.logistics) return false;
      if (FILTERS.script === 'yes' && !needsScript(o)) return false;
      if (FILTERS.script === 'no' && needsScript(o)) return false;
      if (FILTERS.branch && (o.department || '') !== FILTERS.branch) return false;
      if (FILTERS.overdue === 'overdue' && !isOverdue(o)) return false;
      if (q && ((o.order_id || '') + ' ' + (o.project_name || '') + ' ' + (o.shoot_location || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderAllList() {
    const tb = document.getElementById('mo-all-tbody'); if (!tb) return;
    const list = applyAllFilters(ORDERS);
    const info = document.getElementById('mo-all-info');
    if (info) info.innerHTML = 'Hiển thị <strong>' + list.length + '</strong> / ' + ORDERS.length + ' Media Order';
    tb.innerHTML = list.length ? list.map(function (o) {
      return '<tr data-id="' + esc(o.order_id) + '">'
        + '<td><span class="order-id">' + esc(o.order_id) + '</span></td>'
        + '<td><b>' + esc(o.project_name || '—') + '</b></td>'
        + '<td><span class="text-xs">' + esc(o.department || '—') + '</span></td>'
        + '<td><span class="text-xs">' + esc(serviceOf(o) || '—') + '</span></td>'
        + '<td>' + scheduleChip(o) + '</td>'
        + '<td>' + slaChip(o.internal_deadline || o.agreed_deadline || o.requested_deadline, isClosed(o)) + '</td>'
        + '<td><span class="text-xs">' + (allPics(o).length ? esc(allPics(o).join(', ')) : '—') + '</span></td>'
        + '<td>' + scriptChip(o) + '</td>'
        + '<td><span class="text-xs">' + esc(o.production_status || 'unassigned') + '</span></td>'
        + '<td><button class="btn btn-secondary btn-sm" data-mo-open="' + esc(o.order_id) + '">Mở</button></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="10" style="text-align:center;padding:44px;color:var(--text-muted)">Không có Media Order nào khớp bộ lọc.</td></tr>';
    fillSelect('mo-filter-branch', uniq(ORDERS.map(function (o) { return o.department; })), FILTERS.branch, 'Mọi chi nhánh');
    const fl = document.getElementById('mo-filter-logistics');
    if (fl && fl.options.length <= 1) {
      fl.innerHTML = '<option value="">Mọi trạng thái logistics</option>' + Object.keys(LOGISTICS_LABEL).map(function (k) {
        return '<option value="' + k + '">' + LOGISTICS_LABEL[k] + '</option>';
      }).join('');
    }
  }

  function renderAll() {
    renderTabs();
    renderActionCenter(); renderUpcoming(); renderRisk(); renderWorkload(); renderScriptList();
    renderQueue(); renderSchedule(); renderTasks(); renderReview(); renderAllList();
  }

  /* ---------- Init (phần drawer/action nằm ở cuối file) ---------- */
  document.getElementById('mo-tabs').addEventListener('click', function (e) {
    const b = e.target.closest('[data-mo-view]'); if (!b) return;
    goView(b.getAttribute('data-mo-view'));
  });
  document.addEventListener('click', function (e) {
    const card = e.target.closest('.ctm-card-action[data-mo-view]');
    if (card) { goView(card.getAttribute('data-mo-view')); return; }
    const ac = e.target.closest('[data-mo-go]');
    if (ac) {
      const range = ac.getAttribute('data-mo-range');
      if (range) { SCH.range = range; const sel = document.getElementById('mo-sch-range'); if (sel) sel.value = range; renderSchedule(); }
      goView(ac.getAttribute('data-mo-go'));
      return;
    }
    const open = e.target.closest('[data-mo-open]');
    if (open) {
      const o = ORDERS.find(function (x) { return x.order_id === open.getAttribute('data-mo-open'); });
      if (o) openDrawer(o);
    }
  });
  ['range', 'pic', 'branch', 'service'].forEach(function (k) {
    const el = document.getElementById('mo-sch-' + k);
    if (el) el.addEventListener('change', function (ev) { SCH[k] = ev.target.value; renderSchedule(); });
  });
  const searchEl = document.getElementById('mo-search');
  if (searchEl) searchEl.addEventListener('input', function (e) { FILTERS.search = e.target.value; renderAllList(); });
  ['service', 'logistics', 'script', 'branch', 'overdue'].forEach(function (k) {
    const el = document.getElementById('mo-filter-' + k);
    if (el) el.addEventListener('change', function (ev) { FILTERS[k] = ev.target.value; renderAllList(); });
  });

  window.__MO_INTERNAL = {
    patchOrder: patchOrder, notifyRoles: notifyRoles, notifyUserId: notifyUserId,
    esc: esc, fmtDate: fmtDate, fmtDT: fmtDT, parseDt: parseDt, toast: toast,
    logisticsOf: logisticsOf, scheduleOf: scheduleOf, needsScript: needsScript,
    scriptStatusOf: scriptStatusOf, isScriptApproved: isScriptApproved, scriptTaskOf: scriptTaskOf,
    serviceOf: serviceOf, allPics: allPics, pushMissing: pushMissing, isPushed: isPushed, isClosed: isClosed,
    picVideo: picVideo, picPhoto: picPhoto, picEditor: picEditor,
    LOGISTICS_LABEL: LOGISTICS_LABEL, SCHEDULE_LABEL: SCHEDULE_LABEL, SCRIPT_LABEL: SCRIPT_LABEL,
    SCRIPT_TYPE_LABEL: SCRIPT_TYPE_LABEL, PRIO_LABEL: PRIO_LABEL, PROD_PIC_ROLES: PROD_PIC_ROLES,
    TASK_STATUS_MEDIA: TASK_STATUS_MEDIA, TASK_TYPE_LABEL: TASK_TYPE_LABEL,
    getStaff: function () { return STAFF; }, getTasks: function () { return TASKS; },
    setCurrent: function (o) { currentOrder = o; }, getCurrent: function () { return currentOrder; },
    renderAll: renderAll, CAN_OPERATE: CAN_OPERATE, READONLY: READONLY, IS_LEAD_MEDIA: IS_LEAD_MEDIA, user: user,
    reload: function () { return Promise.all([loadOrders(), loadTasks(), loadScriptTasks()]); }
  };

  /* ---------- Boot ---------- */
  Promise.all([loadStaff(), loadOrders()]).then(function () {
    return Promise.all([loadTasks(), loadScriptTasks()]);
  }).then(function () {
    const id = new URLSearchParams(location.search).get('id');
    if (id) {
      const o = ORDERS.find(function (x) { return x.order_id === id; });
      if (o) { goView('queue'); openDrawer(o); }
      else toast('warning', 'Không mở được order', id + ' không phải Media Order hoặc bạn không có quyền xem.');
    }
  });
  setInterval(function () { if (!document.hidden) { loadOrders(); loadTasks(); loadScriptTasks(); } }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { loadOrders(); loadTasks(); loadScriptTasks(); } });

  /* =====================================================================
     DRAWER — Media Order (brief §9)
     Media thường: A Thông tin · B Lịch & địa điểm · C Liên hệ onsite ·
     D Dịch vụ · E Output · F Phân công PIC · G Production · H Source/Preview/
     Final · I Delivery.  Media có script: thêm block Content Script Subtask.
     KHÔNG có block Content Wording / Lead Content duyệt wording / Client xác
     nhận wording — đúng yêu cầu "Media không đi qua wording".
     ===================================================================== */
  const drawer = document.getElementById('mo-drawer');
  const drawerBd = document.getElementById('mo-drawer-backdrop');
  const drawerBody = document.getElementById('mo-drawer-body');
  const drawerActions = document.getElementById('mo-drawer-actions');

  function picOptions(currentId, currentName) {
    if (window.MH && window.MH.picOptionsById) {
      return window.MH.picOptionsById(STAFF, { current: currentId || (currentName ? 'name:' + currentName : ''), roleTag: PROD_PIC_ROLES, placeholder: '— Chưa gán —' });
    }
    return '<option value="">— Chưa gán —</option>';
  }
  function toLocalInput(s) {
    const d = parseDt(s); if (!d) return '';
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function vOr(x) { return x ? esc(x) : '<em class="muted">—</em>'; }

  function buildScriptBlock(o) {
    if (!needsScript(o)) {
      return CAN_OPERATE && !isPushed(o) ? `
        <section class="drawer-block">
          <div class="drawer-block-head"><span class="block-letter">S</span><h4>Kịch bản / Content</h4></div>
          <p class="text-xs muted" style="margin:0 0 10px">Order này đang đánh dấu <b>không cần script</b>. TVC / testimonial / phỏng vấn / VO / video có kịch bản thì bật để tạo Content Script Subtask cho team Content.</p>
          <div class="edit-row">
            <label>Loại kịch bản</label>
            <select class="select" id="mo-script-type">
              <option value="">— Chọn loại —</option>
              ${Object.keys(SCRIPT_TYPE_LABEL).map((k) => `<option value="${k}">${SCRIPT_TYPE_LABEL[k]}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-secondary btn-sm" id="mo-mark-script">Đánh dấu "Cần script/content"</button>
        </section>` : '';
    }
    const st = scriptStatusOf(o);
    const task = scriptTaskOf(o);
    const canCreate = CAN_OPERATE && !task && st !== 'script_approved';
    const canApprove = CAN_OPERATE && task && ['lead_approved', 'completed'].indexOf(task.status) >= 0 && st !== 'script_approved';
    return `
      <section class="drawer-block mo-script-block">
        <div class="drawer-block-head"><span class="block-letter">S</span><h4>Content Script Subtask</h4></div>
        <dl>
          <dt>Loại kịch bản</dt><dd>${vOr(SCRIPT_TYPE_LABEL[o.media_content_type] || o.media_content_type)}</dd>
          <dt>Trạng thái script</dt><dd><span class="mo-chip ${st === 'script_approved' ? 'mo-ok' : (st === 'lead_revision' ? 'mo-bad' : 'mo-warn')}">${esc(SCRIPT_LABEL[st] || st)}</span></dd>
          <dt>Mã subtask</dt><dd>${task ? esc(task.task_code || task.id.slice(0, 8)) : '<em class="muted">chưa tạo</em>'}</dd>
          <dt>PIC Content</dt><dd>${task ? vOr(picName(task.assigned_pic_user_id, task.assigned_pic)) : '<em class="muted">—</em>'}</dd>
          <dt>Hạn script</dt><dd>${task && task.wording_deadline ? esc(fmtDT(task.wording_deadline)) : '<em class="muted">—</em>'}</dd>
          <dt>Link bản thảo</dt><dd>${task && (task.script_link || task.draft_link) ? `<a class="link" target="_blank" rel="noopener" href="${esc(task.script_link || task.draft_link)}">Mở bản thảo</a>` : '<em class="muted">—</em>'}</dd>
        </dl>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
          ${canCreate ? '<button class="btn btn-primary btn-sm" id="mo-create-script">Tạo Content Script Subtask</button>' : ''}
          ${task ? `<a class="btn btn-secondary btn-sm" href="content-team.html?task=${esc(task.id)}">Theo dõi subtask →</a>` : ''}
          ${canApprove ? '<button class="btn btn-primary btn-sm" id="mo-approve-script">Đánh dấu Script Approved</button>' : ''}
        </div>
        ${st !== 'script_approved' ? '<p class="text-xs muted" style="margin:8px 0 0">Push Production bị khoá tới khi script được chốt.</p>' : ''}
      </section>`;
  }

  function buildDrawerBody(o) {
    const tasks = TASKS.filter(function (t) { return t.order_id === o.order_id; });
    const svc = serviceOf(o);
    const lock = !CAN_OPERATE || isPushed(o) ? 'disabled' : '';
    const missing = pushMissing(o);
    const deliverables = Array.isArray(o.deliverable_type) ? o.deliverable_type : (o.deliverable_type ? [o.deliverable_type] : []);
    return `
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">A</span><h4>Thông tin yêu cầu quay/chụp</h4></div>
        <dl>
          <dt>Người yêu cầu</dt><dd>${vOr(o.requester_name)}${o.requester_contact ? ' · ' + esc(o.requester_contact) : ''}</dd>
          <dt>Chi nhánh / Bộ phận</dt><dd>${vOr(o.department)}</dd>
          <dt>Loại yêu cầu</dt><dd>${vOr(o.request_type)}</dd>
          <dt>Mục đích</dt><dd>${vOr(o.project_purpose)}</dd>
          <dt>Nội dung brief</dt><dd style="white-space:pre-wrap">${vOr(o.content_brief)}</dd>
          <dt>Deadline khách</dt><dd>${o.agreed_deadline || o.requested_deadline ? esc(fmtDate(o.agreed_deadline || o.requested_deadline)) : '<em class="muted">—</em>'}</dd>
          <dt>File brief</dt><dd>${o.file_brief_url ? `<a class="link" target="_blank" rel="noopener" href="${esc(o.file_brief_url)}">Mở file</a>` : '<em class="muted">—</em>'}</dd>
        </dl>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">B</span><h4>Lịch &amp; địa điểm</h4></div>
        <div class="edit-row"><label>Ngày quay/chụp</label><input class="input" type="date" id="mo-shoot-date" value="${esc(String(o.shoot_date || '').slice(0, 10))}" ${lock} /></div>
        <div class="edit-row"><label>Giờ</label><input class="input" type="text" id="mo-shoot-time" placeholder="VD: 9:00 — 11:30" value="${esc(o.shoot_time || '')}" ${lock} /></div>
        <div class="edit-row"><label>Địa điểm</label><input class="input" type="text" id="mo-shoot-location" value="${esc(o.shoot_location || '')}" ${lock} /></div>
        <div class="edit-row"><label>Trạng thái lịch</label><div>${chip(SCHEDULE_LABEL[scheduleOf(o)] || scheduleOf(o), scheduleOf(o) === 'confirmed' ? 'mo-ok' : 'mo-warn')}</div></div>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">C</span><h4>Người phụ trách tại điểm quay</h4></div>
        <div class="edit-row"><label>Người đón team</label><input class="input" type="text" id="mo-onsite-contact" value="${esc(o.onsite_contact || '')}" ${lock} /></div>
        <div class="edit-row"><label>SĐT onsite</label><input class="input" type="tel" id="mo-onsite-phone" value="${esc(o.onsite_phone || '')}" ${lock} /></div>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">D</span><h4>Dịch vụ cần thực hiện</h4></div>
        <div class="edit-row">
          <label>Dịch vụ</label>
          <select class="select" id="mo-service" ${lock}>
            ${['', 'Quay', 'Chụp', 'Quay + Chụp'].map((s) => `<option value="${esc(s)}" ${svc === s ? 'selected' : ''}>${s || '— Chưa chốt —'}</option>`).join('')}
          </select>
        </div>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">E</span><h4>Output bàn giao</h4></div>
        <dl>
          <dt>Hạng mục</dt><dd>${deliverables.length ? deliverables.map((d) => `<span class="chip-mini">${esc(d)}</span>`).join('') : '<em class="muted">—</em>'}</dd>
          <dt>Ghi chú logistics</dt><dd style="white-space:pre-wrap">${vOr(o.media_logistics_note)}</dd>
        </dl>
      </section>

      ${buildScriptBlock(o)}

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">F</span><h4>Phân công Media PIC</h4></div>
        <div class="edit-row"><label>PIC Quay</label><select class="select" id="mo-pic-video" data-pic-dd ${lock}>${picOptions(o.production_pic_video_user_id, o.production_pic_video)}</select></div>
        <div class="edit-row"><label>PIC Chụp</label><select class="select" id="mo-pic-photo" data-pic-dd ${lock}>${picOptions(o.production_pic_photo_user_id, o.production_pic_photo)}</select></div>
        <div class="edit-row"><label>PIC Dựng / Hậu kỳ</label><select class="select" id="mo-pic-editor" data-pic-dd ${lock}>${picOptions(o.production_pic_editor_user_id, o.production_pic_editor)}</select></div>
        <div class="edit-row"><label>Internal Deadline</label><input class="input" type="datetime-local" id="mo-internal-deadline" value="${esc(toLocalInput(o.internal_deadline))}" ${lock} /></div>
        ${CAN_OPERATE && !isPushed(o) ? '<button class="btn btn-secondary btn-sm" id="mo-save-assign">Lưu logistics &amp; phân công</button>' : ''}
        ${isPushed(o) ? '<p class="text-xs muted" style="margin:8px 0 0">Đã push Production — sửa PIC/lịch trong Task Tracker.</p>' : ''}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">G</span><h4>Production &amp; Calendar</h4></div>
        <dl>
          <dt>Trạng thái sản xuất</dt><dd>${vOr(o.production_status || 'unassigned')}</dd>
          <dt>Task đã tạo</dt><dd>${tasks.length ? tasks.map((t) => `<a class="link mono" href="production-board.html?id=${esc(t.task_id)}">${esc(t.task_id)}</a> <span class="text-xs muted">${esc(TASK_TYPE_LABEL[t.task_type] || t.task_type)} · ${esc(TASK_STATUS_MEDIA[t.status] || t.status)}</span>`).join('<br>') : '<em class="muted">chưa có task</em>'}</dd>
        </dl>
        ${missing.length ? `<p class="text-xs" style="margin:8px 0 0;color:var(--danger)">Chưa đủ điều kiện Push: ${esc(missing.join(' · '))}</p>` : '<p class="text-xs" style="margin:8px 0 0;color:#0A7A52">Đủ điều kiện Push Production.</p>'}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">H</span><h4>Source / Preview / Final</h4></div>
        ${tasks.length ? tasks.map((t) => `
          <div class="text-xs" style="padding:8px 0;border-top:1px solid var(--divider)">
            <b>${esc(t.task_id)}</b> · ${esc(TASK_TYPE_LABEL[t.task_type] || t.task_type)}<br>
            Source: ${t.link_drive ? `<a class="link" target="_blank" rel="noopener" href="${esc(t.link_drive)}">link</a>` : '—'} ·
            Preview: ${t.preview_link ? `<a class="link" target="_blank" rel="noopener" href="${esc(t.preview_link)}">link</a>` : '—'} ·
            Final: ${t.final_link ? `<a class="link" target="_blank" rel="noopener" href="${esc(t.final_link)}">link</a>` : '—'}
          </div>`).join('') : '<p class="text-xs muted" style="margin:0">Chưa có task nào — link sẽ xuất hiện sau khi PIC upload trong Task Tracker.</p>'}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">I</span><h4>Bàn giao cho requester / client</h4></div>
        <dl>
          <dt>Preview đã gửi</dt><dd>${o.preview_link ? `<a class="link" target="_blank" rel="noopener" href="${esc(o.preview_link)}">link</a>` : '<em class="muted">—</em>'}</dd>
          <dt>Final đã gửi</dt><dd>${o.final_delivery_link ? `<a class="link" target="_blank" rel="noopener" href="${esc(o.final_delivery_link)}">link</a>` : '<em class="muted">—</em>'}</dd>
        </dl>
        <p class="text-xs muted" style="margin:8px 0 0">Gửi Preview/Final cho client vẫn thực hiện ở <b>Client Orders</b> (Account/Admin) để giữ 1 nguồn liên lạc với client.</p>
        <div class="row" style="margin-top:8px"><a class="btn btn-secondary btn-sm" href="database-orders.html?id=${esc(o.order_id)}">Mở Client Orders →</a></div>
      </section>`;
  }

  function buildDrawerActions(o) {
    if (!CAN_OPERATE) {
      return READONLY ? '<div class="wf-actions"><div class="wf-actions-flow"><span class="wf-wait-tag">Chế độ chỉ xem — Lead Media là owner của Media Order</span></div></div>' : '';
    }
    if (isClosed(o)) return '<div class="wf-actions"><div class="wf-actions-flow"><span class="wf-wait-tag">Order đã đóng / huỷ</span></div></div>';
    const lg = logisticsOf(o);
    const btns = [];
    if (!isPushed(o)) {
      if (lg === 'pending') btns.push('<button class="btn btn-secondary btn-sm" id="mo-act-checking">Bắt đầu kiểm tra logistics</button>');
      if (lg !== 'confirmed') btns.push('<button class="btn btn-warning btn-sm" id="mo-act-needinfo">Cần bổ sung thông tin</button>');
      if (lg !== 'confirmed') btns.push('<button class="btn btn-primary btn-sm" id="mo-act-confirm-logistics">Chốt logistics</button>');
      if (scheduleOf(o) !== 'confirmed') btns.push('<button class="btn btn-secondary btn-sm" id="mo-act-confirm-schedule">Chốt lịch quay/chụp</button>');
      const miss = pushMissing(o);
      btns.push(`<button class="btn btn-primary btn-sm" id="mo-act-push" ${miss.length ? 'disabled' : ''} title="${miss.length ? 'Thiếu: ' + esc(miss.join(' · ')) : 'Tạo task sản xuất'}">Push Production →</button>`);
    } else {
      btns.push('<span class="wf-wait-tag">Đã push Production — theo dõi ở Task Tracker</span>');
      btns.push('<a class="btn btn-secondary btn-sm" href="production-board.html?order=' + esc(o.order_id) + '">Mở Task Tracker</a>');
    }
    return '<div class="wf-actions"><div class="wf-actions-flow">' + btns.join('') + '</div></div>';
  }

  function openDrawer(o) {
    currentOrder = o;
    document.getElementById('mo-d-order-id').textContent = o.order_id;
    document.getElementById('mo-d-project').textContent = o.project_name || '—';
    const st = document.getElementById('mo-d-status');
    st.className = 'tb-status'; st.innerHTML = '<span class="dot"></span>' + esc(LOGISTICS_LABEL[logisticsOf(o)] || logisticsOf(o));
    const pr = document.getElementById('mo-d-priority');
    pr.className = 'priority-pill p--' + (o.priority || 'normal');
    pr.innerHTML = '<span class="dot"></span>' + esc(PRIO_LABEL[o.priority] || 'Bình thường');
    document.getElementById('mo-d-service').textContent = serviceOf(o) || 'chưa chốt dịch vụ';
    document.getElementById('mo-d-pic').textContent = 'PIC: ' + (allPics(o).join(', ') || '—');
    drawerActions.innerHTML = buildDrawerActions(o);
    drawerBody.innerHTML = buildDrawerBody(o);
    drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false');
    drawerBd.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (window.MH && window.MH.enhancePicSelects) window.MH.enhancePicSelects(drawerBody);
    wireDrawer(o);
  }
  function closeDrawer() {
    drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true');
    drawerBd.classList.remove('is-open');
    document.body.style.overflow = '';
    currentOrder = null;
  }
  document.getElementById('mo-drawer-close').addEventListener('click', closeDrawer);
  drawerBd.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('mo-modal').classList.contains('is-open')) { closeModal(); return; }
    if (drawer.classList.contains('is-open')) closeDrawer();
  });

  function readAssignForm(o) {
    const pick = function (id) {
      const el = document.getElementById(id); if (!el) return { id: null, name: null };
      return (window.MH && window.MH.picPick) ? window.MH.picPick(el.value) : { id: null, name: el.value || null };
    };
    const val = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const video = pick('mo-pic-video'), photo = pick('mo-pic-photo'), editor = pick('mo-pic-editor');
    const dl = val('mo-internal-deadline');
    return {
      shoot_date: val('mo-shoot-date') || null,
      shoot_time: val('mo-shoot-time') || null,
      shoot_location: val('mo-shoot-location') || null,
      onsite_contact: val('mo-onsite-contact') || null,
      onsite_phone: val('mo-onsite-phone') || null,
      media_service: val('mo-service') || null,
      production_pic_video: video.name, production_pic_video_user_id: video.id,
      production_pic_photo: photo.name, production_pic_photo_user_id: photo.id,
      production_pic_editor: editor.name, production_pic_editor_user_id: editor.id,
      internal_deadline: dl ? new Date(dl).toISOString() : (o.internal_deadline || null)
    };
  }

  function wireDrawer(o) {
    const on = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('mo-save-assign', async function () {
      const patch = readAssignForm(o);
      const before = allPics(o).join(',');
      if (await patchOrder(o, patch, 'Đã lưu logistics & phân công')) {
        const after = allPics(o);
        if (after.join(',') !== before) notifyAssignedPics(o, patch);
      }
    });
    on('mo-act-checking', function () { patchOrder(o, { media_logistics_status: 'checking' }, 'Đang kiểm tra logistics'); });
    on('mo-act-needinfo', async function () {
      const note = prompt('Thiếu thông tin gì? (gửi kèm cho Account/requester)', o.media_logistics_note || '');
      if (note === null) return;
      const ok = await patchOrder(o, { media_logistics_status: 'need_info', media_logistics_note: note }, 'Đã đánh dấu thiếu thông tin');
      if (ok) {
        notifyRoles(['account', 'admin'], {
          type: 'order_needinfo', title: '⚠ Media order thiếu thông tin',
          message: o.order_id + ' · ' + (o.project_name || '') + ' — Lead Media cần bổ sung: ' + note,
          link: 'database-orders.html?id=' + o.order_id, related_entity_type: 'orders', related_entity_id: o.order_id
        });
      }
    });
    on('mo-act-confirm-logistics', async function () {
      const patch = readAssignForm(o);
      patch.media_logistics_status = 'confirmed';
      if (patch.shoot_date && patch.shoot_time && patch.shoot_location) patch.media_schedule_status = 'confirmed';
      const miss = [];
      if (!patch.shoot_date) miss.push('ngày quay/chụp');
      if (!patch.shoot_time) miss.push('giờ');
      if (!patch.shoot_location) miss.push('địa điểm');
      if (!patch.onsite_contact || !patch.onsite_phone) miss.push('liên hệ onsite');
      if (!patch.media_service) miss.push('dịch vụ');
      if (miss.length) { toast('warning', 'Chưa chốt được logistics', 'Còn thiếu: ' + miss.join(' · ')); return; }
      patchOrder(o, patch, 'Đã chốt logistics');
    });
    on('mo-act-confirm-schedule', async function () {
      const patch = readAssignForm(o);
      if (!patch.shoot_date || !patch.shoot_time || !patch.shoot_location) { toast('warning', 'Thiếu lịch', 'Cần ngày + giờ + địa điểm trước khi chốt lịch.'); return; }
      patch.media_schedule_status = 'confirmed';
      patchOrder(o, patch, 'Đã chốt lịch quay/chụp');
    });
    on('mo-act-push', function () { pushProduction(o); });
    on('mo-mark-script', function () {
      const sel = document.getElementById('mo-script-type');
      const type = sel ? sel.value : '';
      if (!type) { toast('warning', 'Chọn loại kịch bản', 'Cần chọn TVC / testimonial / phỏng vấn… trước khi đánh dấu.'); return; }
      patchOrder(o, { media_script_required: true, media_content_type: type, media_script_status: 'required' }, 'Đã đánh dấu cần script');
    });
    on('mo-create-script', function () { openScriptModal(o); });
    on('mo-approve-script', function () {
      patchOrder(o, { media_script_status: 'script_approved' }, 'Script đã chốt — mở khoá Push Production');
    });
  }

  async function notifyAssignedPics(o, patch) {
    const targets = [
      { id: patch.production_pic_video_user_id, name: patch.production_pic_video, role: 'Quay' },
      { id: patch.production_pic_photo_user_id, name: patch.production_pic_photo, role: 'Chụp' },
      { id: patch.production_pic_editor_user_id, name: patch.production_pic_editor, role: 'Dựng' }
    ].filter(function (t) { return t.id || t.name; });
    for (const t of targets) {
      let uid = t.id;
      if (!uid && t.name && window.MH && window.MH.store && window.MH.supabaseEnabled) {
        try { uid = await window.MH.store.notifications.findUserIdByName(t.name); } catch (e) { uid = null; }
      }
      await notifyUserId(uid, {
        type: 'task_assigned', title: 'Bạn được phân công buổi ' + t.role,
        message: o.order_id + ' · ' + (o.project_name || '') + ' — ' + (o.shoot_date ? fmtDate(o.shoot_date) : 'chưa chốt lịch') + (o.shoot_location ? ' · ' + o.shoot_location : ''),
        link: 'media-operations.html?id=' + o.order_id, related_entity_type: 'orders', related_entity_id: o.order_id
      });
    }
  }

  /* ---------- Content Script Subtask ---------- */
  const modal = document.getElementById('mo-modal');
  const modalBd = document.getElementById('mo-modal-backdrop');
  const modalBody = document.getElementById('mo-modal-body');
  function openModal(title, html, onSave) {
    document.getElementById('mo-modal-title').textContent = title;
    modalBody.innerHTML = html;
    modalSave = onSave;
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
    modalBd.classList.add('is-open');
  }
  function closeModal() {
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    modalBd.classList.remove('is-open');
    modalSave = null;
  }
  document.getElementById('mo-modal-close').addEventListener('click', closeModal);
  document.getElementById('mo-modal-cancel').addEventListener('click', closeModal);
  modalBd.addEventListener('click', closeModal);
  document.getElementById('mo-modal-save').addEventListener('click', async function () {
    if (!modalSave) return;
    const btn = this; btn.disabled = true;
    try { const ok = await modalSave(); if (ok !== false) closeModal(); }
    finally { btn.disabled = false; }
  });

  function openScriptModal(o) {
    const type = o.media_content_type || '';
    openModal('Tạo Content Script Subtask — ' + o.order_id, `
      <p class="text-xs muted" style="margin:0 0 12px">Subtask sẽ vào <b>Content Team</b> (Lead Content nhận → gán PIC Content → viết → duyệt). Parent Media Order KHÔNG chuyển sang luồng wording.</p>
      <div class="field"><label class="label">Tiêu đề <span class="req">*</span></label>
        <input class="input" id="mo-sc-title" value="${esc('Script: ' + (o.project_name || o.order_id))}" /></div>
      <div class="field"><label class="label">Loại kịch bản</label>
        <select class="select" id="mo-sc-type">
          ${Object.keys(SCRIPT_TYPE_LABEL).map((k) => `<option value="${k}" ${type === k ? 'selected' : ''}>${SCRIPT_TYPE_LABEL[k]}</option>`).join('')}
        </select></div>
      <div class="field"><label class="label">Brief cho Content</label>
        <textarea class="textarea" id="mo-sc-brief" style="min-height:90px">${esc(o.content_brief || '')}</textarea></div>
      <div class="field"><label class="label">Hạn hoàn thành script</label>
        <input class="input" type="datetime-local" id="mo-sc-deadline" value="${esc(toLocalInput(o.internal_deadline))}" /></div>
      <div class="field"><label class="label">Ưu tiên</label>
        <select class="select" id="mo-sc-priority">
          ${CT_PRIORITIES.map((k) => `<option value="${k}" ${ctPriority(o.priority) === k ? 'selected' : ''}>${CT_PRIO_LABEL[k]}</option>`).join('')}
        </select></div>
    `, async function () {
      const title = (document.getElementById('mo-sc-title').value || '').trim();
      if (!title) { toast('warning', 'Thiếu tiêu đề', 'Nhập tiêu đề subtask.'); return false; }
      const scType = document.getElementById('mo-sc-type').value;
      const brief = document.getElementById('mo-sc-brief').value;
      const dl = document.getElementById('mo-sc-deadline').value;
      const prio = document.getElementById('mo-sc-priority').value;
      const payload = {
        title: title,
        brief: brief,
        source: 'media_order',
        order_id: o.order_id,
        media_content_type: scType,
        output_types: ['script'],
        status: 'new',
        priority: prio,
        wording_deadline: dl ? new Date(dl).toISOString() : null,
        need_media_production: false,
        created_by: user.name || '',
        created_by_user_id: user.id || null
      };
      let created = null;
      try { created = await window.MH.store.contentTasks.create(payload); }
      catch (e) {
        console.warn('[mo] create script subtask failed:', e);
        toast('danger', 'Tạo subtask thất bại', 'Kiểm tra đã chạy add-media-operations.sql (source=media_order + RLS lead_media).');
        return false;
      }
      if (!created || !created.id) {
        toast('danger', 'Tạo subtask thất bại', 'DB không trả về bản ghi — kiểm tra RLS content_tasks cho lead_media.');
        return false;
      }
      SCRIPT_TASKS.push(created);
      await patchOrder(o, {
        media_script_required: true, media_content_type: scType,
        media_script_status: 'subtask_created', media_script_task_id: created.id
      }, 'Đã tạo Content Script Subtask');
      notifyRoles(['lead_content', 'admin'], {
        type: 'task_assigned', title: '🎬 Script subtask mới từ Media',
        message: (created.task_code || '') + ' · ' + title + ' — Media Order ' + o.order_id + (dl ? ' · hạn ' + fmtDT(dl) : ''),
        link: 'content-team.html?task=' + created.id, related_entity_type: null, related_entity_id: created.id
      });
      return true;
    });
  }

  /* ---------- Push Production ---------- */
  async function generateTaskId() {
    let max = 0;
    try {
      const all = (window.MH && window.MH.store && window.MH.supabaseEnabled)
        ? ((await window.MH.store.tasks.list()) || [])
        : JSON.parse(localStorage.getItem('mh-extra-tasks') || '[]');
      all.forEach(function (t) {
        const m = String(t.task_id || '').match(/TASK-(\d+)/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
    } catch (e) { /* fallback dưới */ }
    return 'TASK-' + String(max + 1).padStart(4, '0');
  }
  async function pushProduction(o) {
    const miss = pushMissing(o);
    if (miss.length) { toast('error', 'Chưa thể Push', 'Thiếu: ' + miss.join(' · ')); return; }
    const existing = TASKS.filter(function (t) { return t.order_id === o.order_id; });
    if (existing.length) {
      toast('warning', 'Order đã có task', existing.map(function (t) { return t.task_id; }).join(', ') + ' — không tạo mới.');
      return;
    }
    const svc = serviceOf(o);
    const plan = [];
    if (/Quay/i.test(svc) && (picVideo(o) || o.production_pic_video)) plan.push({ pic: picVideo(o), picId: o.production_pic_video_user_id, taskType: 'shoot', label: 'Quay' });
    if (/Chụp/i.test(svc) && (picPhoto(o) || o.production_pic_photo)) plan.push({ pic: picPhoto(o), picId: o.production_pic_photo_user_id, taskType: 'photo', label: 'Chụp' });
    if (picEditor(o)) plan.push({ pic: picEditor(o), picId: o.production_pic_editor_user_id, taskType: 'edit', label: 'Dựng / Hậu kỳ' });
    if (!plan.length) { toast('error', 'Không tạo được task', 'Dịch vụ và PIC chưa khớp — kiểm tra lại phân công.'); return; }

    const createdIds = [];
    for (const part of plan) {
      const taskId = await generateTaskId();
      const payload = {
        task_id: taskId,
        order_id: o.order_id,
        is_standalone: false,
        project_name: (o.project_name || 'Untitled') + ' — ' + part.label,
        task_type: part.taskType,
        content: o.content_brief || '',
        priority: o.priority || 'normal',
        assigned_to: part.pic,
        assigned_to_user_id: part.picId || null,
        status: 'received',
        progress: 20,
        internal_deadline: o.internal_deadline || null,
        shoot_date: o.shoot_date || null,
        shoot_time: o.shoot_time || null,
        shoot_location: o.shoot_location || null,
        link_drive: o.source_link || '',
        preview_link: '', final_link: '',
        created_at: new Date().toISOString(),
        last_update: new Date().toISOString()
      };
      if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
        try { await window.MH.store.tasks.upsert(payload); }
        catch (e) {
          console.warn('[mo] push task failed:', e);
          toast('danger', 'Tạo task thất bại', 'DB không phản hồi — thử lại hoặc liên hệ admin.');
          return;
        }
      } else {
        try {
          const raw = JSON.parse(localStorage.getItem('mh-extra-tasks') || '[]');
          raw.push(payload); localStorage.setItem('mh-extra-tasks', JSON.stringify(raw));
        } catch (e) { /* demo-only */ }
      }
      createdIds.push(taskId);
      TASKS.push(payload);
      let uid = part.picId;
      if (!uid && part.pic && window.MH && window.MH.store && window.MH.supabaseEnabled) {
        try { uid = await window.MH.store.notifications.findUserIdByName(part.pic); } catch (e) { uid = null; }
      }
      await notifyUserId(uid, {
        type: 'task_assigned', title: 'Task Media mới được giao',
        message: taskId + ' · ' + payload.project_name + (o.shoot_date ? ' · ' + fmtDate(o.shoot_date) : '') + (o.shoot_location ? ' · ' + o.shoot_location : ''),
        link: 'production-board.html?id=' + taskId, related_entity_type: 'tasks', related_entity_id: taskId
      });
    }
    await patchOrder(o, {
      production_status: 'received',
      media_review_status: 'not_started',
      last_updated: new Date().toISOString()
    }, 'Đã push Production');
    toast('success', 'Đã tạo ' + createdIds.length + ' task', createdIds.join(', '));
    loadTasks();
  }
})();

