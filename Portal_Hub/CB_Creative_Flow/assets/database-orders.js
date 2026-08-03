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
  // admin / account / lead_media = full quyền. system_supervisor = monitor read-only.
  // lead_content = READ-ONLY + comment nội bộ (theo dõi brief gốc/status/timeline — 2026-07-06).
  if (!['admin', 'account', 'system_supervisor', 'lead_media', 'lead_content'].includes(user.role)) {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Client Orders chỉ dành cho Admin / Account / Media Lead.' });
    const home = user.role === 'content' ? 'content-workbench.html' : 'dashboard.html';
    setTimeout(() => location.replace(home), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);
  // READONLY: system_supervisor (monitor toàn hệ thống) + lead_content (theo dõi order).
  // Mọi mutation UI bị khóa; lead_content có THÊM đúng 1 quyền ghi: comment nội bộ
  // qua RPC append_lead_content_order_note (không đụng cột nghiệp vụ nào).
  const IS_LEAD_CONTENT = user.role === 'lead_content';
  const READONLY = user.role === 'system_supervisor' || IS_LEAD_CONTENT;
  // Media Lead = quyền vận hành NGANG Account → alias cho mọi check ['admin','account'] bên dưới.
  // data-user-role giữ 'lead_media' thật (CSS/nav); RLS DB thấy role thật qua current_user_role().
  if (user.role === 'lead_media') user.role = 'account';

  // Banner READ-ONLY trên page head — UI phải nói rõ đang ở chế độ chỉ xem.
  if (READONLY) {
    const head = document.querySelector('.dash-page-head h1');
    if (head) {
      const tag = document.createElement('span');
      tag.className = 'badge badge-info do-viewonly-badge';
      tag.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Chế độ chỉ xem'
        + (IS_LEAD_CONTENT ? ' · Lead Content' : ' · Giám sát');
      head.appendChild(tag);
    }
  }

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
    design: 'Thiết kế / Digital', digital: 'Digital Design', video: 'Video', motion: 'Motion',
    media: 'Quay / Chụp ảnh', shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads / Post', slide: 'Slide / Proposal', other: 'Khác'
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
        // Ads Order (order_kind='ads_order') thuộc Content Team → KHÔNG hiện ở Client Orders
        // của Account (không phải bottleneck). Internal Ads Media Request vẫn hiện (push Production).
        const visible = remote.filter(function (r) { return r.order_kind !== 'ads_order'; });
        localOrders.length = 0;
        visible.forEach(function (r) { localOrders.push(r); });
        return visible.length;
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

  /* ---------- PIC options từ Users thật (đồng bộ User Management) ----------
     Dropdown gán PIC trước đây hardcode 4 tên seed → user tạo mới trong User Management
     không xuất hiện để gán. Nay load users thật theo role, option kèm nhãn role
     ("Khánh Du · Editor") để Account/Lead/Admin chọn đúng người.
     Fallback seed chỉ dùng khi Supabase off / chưa load được users (demo). */
  const ROLE_TAG = {
    admin: 'Admin', account: 'Account', lead_media: 'Lead Media',
    design: 'Design', editor: 'Editor',
    lead_content: 'Lead Content', content: 'Content', system_supervisor: 'Giám sát'
  };
  const PROD_PIC_ROLES = ['design', 'editor'];
  const ACCT_PIC_ROLES = ['admin', 'account', 'lead_media'];
  const FALLBACK_PROD_PICS = [
    { name: 'Duy', role: 'design' }, { name: 'Vinh', role: 'design' },
    { name: 'Linh Chi', role: 'editor' }, { name: 'Mai Phương', role: 'admin' }
  ];
  const FALLBACK_ACCT_PICS = [
    { name: 'Hậu', role: 'account' }, { name: 'Mai Phương', role: 'admin' }, { name: 'Đức Anh', role: 'account' }
  ];
  let STAFF_USERS = [];
  async function loadStaffUsers() {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return 0;
    try {
      const list = await window.MH.store.users.list();
      // MH.isActiveUser loại cả 'suspended'/'archived'/'pending' — "Deactivate" ghi 'suspended'.
      STAFF_USERS = (list || []).filter((u) => u && u.name && (window.MH && window.MH.isActiveUser ? window.MH.isActiveUser(u) : u.status !== 'inactive'));
      if (window.MH.setUserDir) window.MH.setUserDir(list || []); // resolve id→tên cho PIC (Stage 2)
    } catch (e) { console.warn('[database-orders] users load failed:', e); }
    return STAFF_USERS.length;
  }
  // PIC nay keyed theo user_id (rename-proof). Option value=id; hiển thị resolve id→tên hiện tại.
  function picName(id, snapshot) { return (window.MH && window.MH.picLabel) ? window.MH.picLabel(id, snapshot) : (snapshot || ''); }
  function picOptionsId(currentId, currentName, roles) {
    const users = STAFF_USERS.filter((u) => roles.includes(u.role));
    return window.MH.picOptionsById(users, { current: currentId || '', currentName: currentName || '', placeholder: '— Chưa gán —', roleTag: ROLE_TAG });
  }
  function picUserPool(roles, fallback, current) {
    const seen = {};
    let pool = STAFF_USERS
      .filter((u) => roles.includes(u.role) && !seen[u.name] && (seen[u.name] = 1))
      .map((u) => ({ name: u.name, role: u.role }));
    if (!pool.length) pool = fallback.slice(); // Supabase off / users chưa load
    if (current && !pool.some((u) => u.name === current)) pool.push({ name: current, role: '' }); // giữ giá trị đang gán
    return pool.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }
  function picOptions(current, roles, fallback) {
    current = current || '';
    // data-role → badge role ở custom dropdown (app.js enhancePicSelects); text "Tên · Tag" = fallback native.
    return '<option value="">— Chưa gán —</option>' + picUserPool(roles, fallback, current).map((u) => {
      const tag = ROLE_TAG[u.role] || u.role;
      return `<option value="${escapeHtml(u.name)}" data-role="${escapeHtml(tag)}" ${u.name === current ? 'selected' : ''}>${escapeHtml(u.name)}${tag ? ' · ' + tag : ''}</option>`;
    }).join('');
  }

  /* ---------- Helpers ---------- */
  const ACCOUNT_STATUS_LABEL = {
    pending: 'Chờ xác nhận', checking: 'Đang kiểm tra', needinfo: 'Cần bổ sung',
    wording: 'Content Wording', confirmed: 'Đã xác nhận', rejected: 'Hủy đơn'
  };
  // Phase 2 — Brief Wording status (cổng bắt buộc trước Confirm Brief).
  const WORDING_STATUS_LABEL = {
    none: 'Chưa chuyển Content Wording', assigned: 'Đã chuyển Content Wording',
    pic_assigned: 'Lead đã gán PIC Content', in_progress: 'Content đang xử lý',
    submitted_to_lead: 'Chờ Lead Content duyệt', lead_revision: 'Lead yêu cầu Content chỉnh',
    submitted_to_account: 'Chờ Account duyệt',
    account_revision: 'Account yêu cầu Content chỉnh', sent_to_client: 'Chờ Client xác nhận brief wording',
    client_feedback: 'Client yêu cầu chỉnh brief wording', client_approved: 'Client đã xác nhận brief wording',
    completed: 'Hoàn tất Content Wording'
  };
  // Wording đã được duyệt → cho phép Confirm Brief.
  function wordingStatusOf(o) { return (o && o.brief_wording_status) || 'none'; }
  // Order revision (client tạo tiếp sau khi Order gốc quá 03 vòng feedback) → trả mã Order gốc.
  // Ưu tiên cột parent_order_id (nếu đã chạy add-revision-link.sql); fallback bóc từ content_brief
  // (order-form.js LUÔN nhúng "[Yêu cầu chỉnh sửa phát sinh — từ Order gốc MEDIA-...]") → không cần migration.
  function getRevisionRef(o) {
    if (!o) return null;
    if (o.parent_order_id) return o.parent_order_id;
    const m = String(o.content_brief || '').match(/từ Order gốc\s+(MEDIA-[0-9A-Za-z\-]+)/);
    return m ? m[1] : null;
  }
  function isWordingApproved(o) { const w = wordingStatusOf(o); return w === 'client_approved' || w === 'completed'; }

  /* ---------- MEDIA CAPTURE ROUTING (2026-07-31) ----------
     Media Order (Quay/Chụp/Video) KHÔNG đi cổng Content Wording — owner là Lead
     Media, cổng thay thế là LOGISTICS (ngày/giờ · địa điểm · người đón team ·
     dịch vụ · output · PIC). Media CÓ SCRIPT thì gate bổ sung là Content Script
     Subtask được duyệt, KHÔNG phải wording của order.
     Helper dùng chung ở app.js (window.MH.routing) — fallback nội bộ phòng
     trường hợp app.js chưa load kịp (thứ tự script luôn app.js trước, nhưng
     giữ fallback để file này không phụ thuộc cứng). */
  const ROUTING = (window.MH && window.MH.routing) || {
    isAdsOrder: (o) => !!o && (o.order_kind === 'ads_order' || o.request_type === 'ads'),
    isMediaOrder: (o) => !!o && ['media', 'shoot', 'photo', 'video'].includes(o.request_type) && !(o.order_kind === 'ads_order' || o.request_type === 'ads'),
    mediaNeedsContentScript: (o) => !!o && (o.media_script_required === true || o.needs_script === true),
    requiresContentWording: (o) => !!o && ['design', 'digital', 'slide'].includes(o.request_type)
  };
  const isMediaOrder = (o) => ROUTING.isMediaOrder(o);
  const mediaNeedsScript = (o) => ROUTING.mediaNeedsContentScript(o);
  // Cổng wording CHỈ áp cho luồng Design/Digital/Slide. Media (kể cả có script)
  // không bao giờ bị khoá Confirm Brief bởi wording.
  function wordingGateApplies(o) { return !!o && !isMediaOrder(o) && !ROUTING.isAdsOrder(o) && ROUTING.requiresContentWording(o); }
  const MEDIA_LOGISTICS_LABEL = { pending: 'Chưa kiểm tra', checking: 'Đang kiểm tra', need_info: 'Thiếu thông tin', confirmed: 'Đã chốt logistics' };
  const MEDIA_SCHEDULE_LABEL = { pending: 'Chưa chốt lịch', confirmed: 'Đã chốt lịch', rescheduled: 'Đã dời lịch', cancelled: 'Đã huỷ lịch' };
  const MEDIA_SCRIPT_LABEL = {
    not_required: 'Không cần script', required: 'Cần script — chưa tạo subtask', subtask_created: 'Đã tạo subtask Content',
    in_progress: 'Content đang viết', submitted_to_lead: 'Chờ Lead Content duyệt', lead_revision: 'Lead trả chỉnh',
    lead_approved: 'Lead Content đã duyệt', script_approved: 'Script đã chốt', cancelled: 'Đã huỷ script'
  };
  function mediaLogisticsOf(o) { return (o && o.media_logistics_status) || 'pending'; }
  function mediaScriptStatusOf(o) { return (o && o.media_script_status) || (mediaNeedsScript(o) ? 'required' : 'not_required'); }
  function isMediaScriptApproved(o) { return mediaScriptStatusOf(o) === 'script_approved'; }
  // Điều kiện logistics đủ để Push (brief §11.1): thiếu mục nào trả về mục đó.
  function mediaLogisticsMissing(o) {
    const miss = [];
    if (mediaLogisticsOf(o) !== 'confirmed') miss.push('chốt logistics');
    if (!o.shoot_date) miss.push('ngày quay/chụp');
    if (!o.shoot_time) miss.push('giờ quay/chụp');
    if (!o.shoot_location) miss.push('địa điểm');
    if (!o.onsite_contact) miss.push('người liên hệ onsite');
    if (!o.onsite_phone) miss.push('SĐT onsite');
    if (mediaNeedsScript(o) && !isMediaScriptApproved(o)) miss.push('script được duyệt');
    return miss;
  }
  // Block tóm tắt Media trong Order drawer (thay chỗ của Content Wording).
  // CHỈ đọc + deep-link sang Media Operations — mọi hành động vận hành Media
  // (chốt logistics/lịch, tạo script subtask, gán PIC dựng) nằm ở workspace của
  // Lead Media để không nhân đôi logic ở 2 nơi.
  function buildMediaOpsSummary(o) {
    const lg = mediaLogisticsOf(o);
    const sch = o.media_schedule_status || 'pending';
    const scr = mediaScriptStatusOf(o);
    const needScript = mediaNeedsScript(o);
    const miss = mediaLogisticsMissing(o);
    const v = (x) => x ? escapeHtml(x) : '<em class="muted">—</em>'; // local: `v` của buildDrawer là biến trong hàm đó
    const chip = (txt, cls) => `<span class="badge ${cls}">${escapeHtml(txt)}</span>`;
    const lgCls = lg === 'confirmed' ? 'badge-success' : (lg === 'need_info' ? 'badge-danger' : 'badge-warning');
    const schCls = sch === 'confirmed' ? 'badge-success' : (sch === 'cancelled' ? 'badge-danger' : 'badge-warning');
    const scrCls = scr === 'script_approved' ? 'badge-success' : (scr === 'lead_revision' ? 'badge-danger' : 'badge-warning');
    return `
      <section class="drawer-block ow-media-ops">
        <div class="drawer-block-head"><span class="block-letter">M</span><h4>Media — Logistics &amp; Lịch quay/chụp</h4></div>
        <p class="text-xs muted" style="margin:0 0 10px">Order Quay/Chụp/Video <b>không đi qua Content Wording</b>. Owner là <b>Lead Media</b> — chốt logistics, lịch và PIC trong Media Operations.</p>
        <dl>
          <dt>Logistics</dt><dd>${chip(MEDIA_LOGISTICS_LABEL[lg] || lg, lgCls)}</dd>
          <dt>Lịch quay/chụp</dt><dd>${chip(MEDIA_SCHEDULE_LABEL[sch] || sch, schCls)}${o.shoot_date ? ` <span class="text-xs muted">· ${escapeHtml(fmtDeadlineDate(o.shoot_date))}${o.shoot_time ? ' · ' + escapeHtml(o.shoot_time) : ''}</span>` : ''}</dd>
          <dt>Địa điểm</dt><dd>${v(o.shoot_location)}</dd>
          <dt>Liên hệ onsite</dt><dd>${o.onsite_contact ? escapeHtml(o.onsite_contact) + (o.onsite_phone ? ' · ' + escapeHtml(o.onsite_phone) : '') : '<em class="muted">—</em>'}</dd>
          <dt>Cần script/content</dt><dd>${needScript ? chip(MEDIA_SCRIPT_LABEL[scr] || scr, scrCls) : '<em class="muted">Không cần</em>'}</dd>
        </dl>
        ${miss.length ? `<p class="text-xs" style="margin:8px 0 0;color:var(--danger)">Chưa đủ điều kiện Push: ${escapeHtml(miss.join(' · '))}</p>` : '<p class="text-xs" style="margin:8px 0 0;color:var(--success,#0A7A52)">Đã đủ điều kiện Push Production.</p>'}
        <div class="row" style="margin-top:10px">
          <a class="btn btn-secondary btn-sm" href="media-operations.html?id=${escapeHtml(o.order_id)}">Mở trong Media Operations →</a>
        </div>
      </section>`;
  }
  // Trễ hạn wording: có wording_deadline, chưa duyệt/hoàn tất, chưa hủy, và đã quá hạn.
  function isWordingOverdue(o) {
    if (!o || !o.wording_deadline) return false;
    if (isWordingApproved(o)) return false;
    if (o.account_status === 'rejected' || o.production_status === 'cancelled') return false;
    const d = new Date(String(o.wording_deadline).replace(' ', 'T'));
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  }
  const PROD_STATUS_LABEL = {
    unassigned: 'Chưa phân công', received: 'Nhận task', inprogress: 'Đang thực hiện',
    review: 'Chờ duyệt nội bộ', revision: 'Chỉnh sửa nội bộ', ready: 'Sẵn sàng bàn giao',
    delivered: 'Đã bàn giao', completed: 'Hoàn thành', cancelled: 'Hủy'
  };
  // % progress theo production_status (đồng bộ khi đổi status để tránh "received nhưng 5%").
  const PROD_PROGRESS = {
    unassigned: 5, pending: 5, received: 20, inprogress: 50, review: 65,
    revision: 75, feedback_wait: 80, feedback_fix: 85, ready: 90,
    delivered: 95, completed: 100, paused: 0, cancelled: 0
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
  const TODAY = (function () { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(); // ngày THẬT (bỏ hardcode demo anchor)
  function parseDate(s) { return s ? new Date(s.replace(' ', 'T')) : null; }
  // Hiển thị timestamp (created_at / last_updated) → "DD/MM/YYYY HH:MM" giờ local.
  // created_at/last_updated lưu dạng UTC (toISOString); bare "YYYY-MM-DD HH:MM" cũng coi là UTC.
  function fmtDateTime(s) {
    if (!s) return '—';
    s = String(s);
    const d = new Date(/[Z+]/.test(s.slice(10)) ? s : s.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return s;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // Đổi internal_deadline (ISO từ Supabase HOẶC bare local) → value cho <input datetime-local> (giờ local).
  function toLocalInput(s) {
    if (!s) return '';
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  /* ---------- Effective deadline (P0 deadline flow) ----------
     3 lớp deadline: requested_deadline (Client nhập, GIỮ NGUYÊN audit) →
     agreed_deadline (Account đề xuất/đã thống nhất với Client) → internal_deadline (nội bộ giao PIC).
     Hiển thị cho Client/Account = agreed || requested. Production vẫn dùng internal_deadline. */
  function effectiveDeadline(o) { return (o && (o.agreed_deadline || o.requested_deadline)) || null; }
  function fmtDeadlineDate(s) {
    const d = parseDate(String(s || ''));
    if (!d || isNaN(d.getTime())) return s || '—';
    const pad = (n) => String(n).padStart(2, '0');
    // agreed_deadline là timestamptz (có giờ) — hiện kèm HH:MM; requested_deadline là date thuần.
    const hasTime = /[T ]\d{2}:/.test(String(s));
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` + (hasTime ? ` ${pad(d.getHours())}:${pad(d.getMinutes())}` : '');
  }
  function deadlineLabel(o) {
    if (!o) return '—';
    if (o.agreed_deadline) return fmtDeadlineDate(o.agreed_deadline) + ' · Đã thống nhất';
    if (o.requested_deadline) return fmtDeadlineDate(o.requested_deadline) + ' · Client đề xuất';
    return '—';
  }
  // Internal deadline trễ hơn deadline đã thống nhất với Client → cảnh báo (không block cứng).
  function internalPastEffective(o) {
    if (!o || !o.internal_deadline) return false;
    const eff = effectiveDeadline(o);
    if (!eff) return false;
    const di = parseDate(String(o.internal_deadline));
    let de = parseDate(String(eff));
    if (!di || !de || isNaN(di.getTime()) || isNaN(de.getTime())) return false;
    // requested_deadline là date thuần → coi hạn = cuối ngày đó.
    if (!/[T ]\d{2}:/.test(String(eff))) { de = new Date(de); de.setHours(23, 59, 59, 999); }
    return di.getTime() > de.getTime();
  }

  // Order media gán PIC qua production_pic_video/photo; còn lại dùng production_pic đơn.
  function orderHasPic(o) {
    return o.request_type === 'media' ? (!!o.production_pic_video || !!o.production_pic_photo) : !!o.production_pic;
  }
  // Order đã push sang Task Tracker (task đã được tạo) → khóa sửa PIC trong drawer
  // để tránh desync (đổi PIC ở order KHÔNG reassign task đã tạo). Đổi PIC ở Task Tracker.
  function isOrderPushed(o) {
    const isCancelled = o.account_status === 'rejected' || o.production_status === 'cancelled';
    return !!o.production_status && o.production_status !== 'unassigned' && !isCancelled;
  }
  // Quy tắc 3 vòng feedback/revision áp dụng CHÍNH cho order design (design + digital design).
  // Type khác (video/media/slide/motion/other): linh hoạt — không chặn cứng vòng 4.
  function appliesRevisionRule(o) {
    // Order NỘI BỘ Content→Media không có "client" nên KHÔNG áp luật 3 vòng feedback Client.
    if (isInternalContentOrder(o)) return false;
    return ['design', 'digital'].includes(o.request_type);
  }

  /* ---------- INTERNAL CONTENT ORDER — context-aware wording (2026-08-03) ----------
     Order do Content Team tạo sang Media KHÔNG phải Client Order: không có client thật,
     không lộ Client Portal, không notify client. Người nhận bàn giao là **PIC Content**
     của `source_content_task_id`, Lead Content chỉ CC/giám sát.
     ⚠ Hẹp hơn `isInternalOrder()` (hàm cũ, gom cả Ads): CỐ Ý **không** gồm
     `internal_ads_media_request` / `origin='ads_order'` / `source_ads_order_id` vì flow Ads
     chưa được chốt — đụng vào là đổi nghiệp vụ Ads ngoài phạm vi. */
  function isInternalContentOrder(order) {
    return !!(order && (
      order.order_kind === 'internal_media_request'
      || order.origin === 'content_team'
      || order.client_visible === false
      || order.source_content_task_id
    ));
  }
  // Toàn bộ chữ trong block Bàn giao lấy từ đây — KHÔNG hardcode "Client" ở chỗ nào nữa.
  function deliveryTargetMeta(order) {
    if (isInternalContentOrder(order)) {
      return {
        isInternalContent: true,
        title: 'Bàn giao nội bộ cho Content',
        previewBtn: 'Gửi Preview → Content',
        finalBtn: 'Gửi Final → Content',
        sentPreviewToast: 'Đã gửi Preview cho Content',
        sentFinalToast: 'Đã gửi Final cho Content',
        sentDetail: 'PIC Content/Lead Content đã nhận thông báo + link.',
        helpPreview: 'Nhập link Drive rồi bấm gửi — PIC Content/Lead Content nhận thông báo và mở link trong Content Workspace.',
        helpFinal: 'Final chỉ gửi một lần. PIC Content/Lead Content sẽ nhận thông báo để tiếp tục xử lý task gốc.',
        finalSentBtn: '✓ Đã gửi Final cho Content',
        alreadyFinalMsg: 'Yêu cầu nội bộ này đã bàn giao Final cho Content rồi — không gửi lại.',
        needFinalMsg: 'Cần gửi Final cho Content trước khi đóng yêu cầu nội bộ.',
        closeLabel: 'Đóng yêu cầu nội bộ — Hoàn thành',
        closeHelp: 'Đóng khi Content đã nhận sản phẩm và xử lý xong task gốc.',
        closedToast: 'Đã đóng yêu cầu nội bộ — Hoàn thành',
        closedDetail: 'Đã bàn giao cho Content.',
        completedText: 'Yêu cầu nội bộ đã hoàn thành và bàn giao cho Content.',
        ratingLabel: 'Xác nhận nội bộ',
        deliveryTargetName: 'Content'
      };
    }
    return {
      isInternalContent: false,
      title: 'Bàn giao cho Client',
      previewBtn: 'Gửi Preview → Client',
      finalBtn: 'Gửi Final → Client',
      sentPreviewToast: 'Đã gửi Preview',
      sentFinalToast: 'Đã gửi Final',
      sentDetail: 'Client đã nhận thông báo + link.',
      helpPreview: 'Nhập link Drive rồi bấm gửi — client nhận thông báo và mở link ngay trong Client Portal. Final chỉ gửi một lần.',
      helpFinal: 'Đã bàn giao Final cho client — chỉ gửi MỘT lần. Cần thay đổi thì liên hệ quản trị.',
      finalSentBtn: '✓ Đã gửi Final',
      alreadyFinalMsg: 'Order này đã bàn giao Final cho client rồi — không gửi lại.',
      needFinalMsg: 'Cần gửi Final cho client trước khi đóng đơn.',
      closeLabel: 'Đóng đơn — Hoàn thành',
      closeHelp: 'Đóng đơn khi client đã nhận sản phẩm. Rating của client là <b>tùy chọn</b> — không bắt buộc để hoàn thành đơn.',
      closedToast: 'Đã đóng đơn — Hoàn thành',
      closedDetail: 'Rating của client (nếu có sau) vẫn được ghi nhận.',
      completedText: 'Đơn đã Hoàn thành.',
      ratingLabel: 'Rating',
      deliveryTargetName: 'Client'
    };
  }
  // Hook chỉ để harness headless kiểm được các helper + render drawer (không dùng trong app).
  window.__DBO_TEST = {
    isInternalContentOrder: function (o) { return isInternalContentOrder(o); },
    deliveryTargetMeta: function (o) { return deliveryTargetMeta(o); },
    feedbackMeta: function (o) { return feedbackMeta(o); },
    appliesRevisionRule: function (o) { return appliesRevisionRule(o); },
    openDrawer: function (o) { return openDrawer(o); }
  };
  function feedbackMeta(order) {
    if (isInternalContentOrder(order)) {
      return {
        title: 'Feedback / Chỉnh sửa nội bộ',
        latestLabel: 'Feedback gần nhất từ Content',
        emptyText: 'Chưa có feedback từ Content.',
        appliesClientRevisionLimit: false
      };
    }
    return {
      title: 'Feedback / Vòng chỉnh sửa',
      latestLabel: 'Feedback gần nhất từ Client',
      emptyText: 'Chưa có feedback.',
      appliesClientRevisionLimit: appliesRevisionRule(order)
    };
  }
  const FEEDBACK_STATUS_LABEL = {
    waiting_feedback: 'Chờ feedback từ client',
    feedback_received: 'Client đã gửi feedback',
    revision_in_progress: 'Đang chỉnh theo feedback',
    approved: 'Client đã duyệt / đã Final',
    exceeded_limit: 'Đã đạt giới hạn chỉnh sửa'
  };
  // Bản nhãn cho order NỘI BỘ Content→Media: cùng key nhưng đổi "Client" → "Content".
  // Thiếu bản này thì dù title/nút đã đúng, dòng "Feedback status" vẫn rò chữ Client.
  const FEEDBACK_STATUS_LABEL_INTERNAL = {
    waiting_feedback: 'Chờ feedback từ Content',
    feedback_received: 'Content đã gửi feedback',
    revision_in_progress: 'Đang chỉnh theo feedback',
    approved: 'Content đã duyệt / đã Final',
    exceeded_limit: 'Đã đạt giới hạn chỉnh sửa'
  };
  // Panel Feedback/Vòng chỉnh sửa trong Order drawer (cạnh khu Bàn giao Preview/Final).
  function buildRevisionPanel(o) {
    const fMeta = feedbackMeta(o);
    // Internal Content Order: KHÔNG áp luật 3 vòng feedback Client → không hiện badge "0/3",
    // feedback nội bộ Content↔Media KHÔNG bị tính vào hạn mức của Client Order.
    const applies = fMeta.appliesClientRevisionLimit;
    const round = o.revision_round || 0;
    const limit = o.revision_limit || 3;
    const atLimit = applies && round >= limit;
    const fbLabels = isInternalContentOrder(o) ? FEEDBACK_STATUS_LABEL_INTERNAL : FEEDBACK_STATUS_LABEL;
    const fbStatus = o.feedback_status ? (fbLabels[o.feedback_status] || o.feedback_status) : '—';
    const roundBadge = applies
      ? `<span class="rev-round-badge ${atLimit ? 'is-limit' : ''}">Vòng chỉnh sửa: <b>${round}/${limit}</b></span>`
      : `<span class="rev-round-badge is-flex">${fMeta.appliesClientRevisionLimit === false && isInternalContentOrder(o) ? 'Nội bộ — không giới hạn vòng' : 'Linh hoạt — không giới hạn vòng'}</span>`;
    const canAct = ['admin', 'account'].includes(user.role);
    return `
      <div class="rev-panel ${atLimit ? 'rev-panel--limit' : ''}">
        <div class="rev-panel-head">
          <span class="rev-panel-title">${escapeHtml(fMeta.title)}</span>
          ${roundBadge}
          ${atLimit ? `<span class="rev-limit-badge">Đã đạt giới hạn chỉnh sửa</span>` : ''}
        </div>
        <dl class="rev-panel-dl">
          <dt>Feedback status</dt><dd>${fbStatus}</dd>
          <dt>Feedback gần nhất</dt><dd>${o.latest_feedback_note ? '<span class="text-xs muted">xem bên dưới</span>' : `<em class="muted">${escapeHtml(fMeta.emptyText)}</em>`}</dd>
          <dt>Lúc</dt><dd>${o.last_feedback_at ? fmtDateTime(o.last_feedback_at) : '<em class="muted">—</em>'}</dd>
          <dt>Bởi</dt><dd>${o.last_feedback_by ? escapeHtml(o.last_feedback_by) : '<em class="muted">—</em>'}</dd>
        </dl>
        ${(atLimit && o.feedback_status === 'feedback_received' && canAct) ? `
          <div style="margin-top:10px;padding:11px 13px;background:rgba(14,165,233,.08);border:1px solid rgba(14,165,233,.25);border-left:3px solid var(--info,#0ea5e9);border-radius:8px;font-size:12.5px;line-height:1.55">
            <b>Feedback Vòng 3 — Final Check.</b> Đây là vòng chỉnh sửa cuối cùng của Order hiện tại. Account/Admin cần gửi feedback này cho PIC xử lý. Sau khi Production hoàn tất, PIC cập nhật Final Link và gửi duyệt nội bộ. Account/Admin kiểm tra và gửi Final cho Client.
          </div>` : ''}
        ${longText(fMeta.latestLabel, o.latest_feedback_note, { emptyText: fMeta.emptyText, lines: 3 })}
        ${(o.latest_feedback_note && canAct && o.feedback_status === 'feedback_received') ? `
          <div class="rev-panel-actions">
            <button type="button" class="btn btn-sm ${atLimit ? 'btn-primary' : 'btn-secondary'}" id="btn-send-feedback-pic">${atLimit ? 'Gửi feedback vòng 3 cho PIC' : 'Gửi feedback này cho PIC'}</button>
          </div>` : ''}
      </div>`;
  }
  // Label ngắn cho task.status (dùng ở section "Links from Task Tracker").
  const TASK_STATUS_LABEL_SHORT = {
    pending: 'Chưa nhận', received: 'Nhận task', inprogress: 'Đang thực hiện', review: 'Chờ duyệt nội bộ',
    revision: 'Chỉnh sửa nội bộ', feedback_wait: 'Chờ client', feedback_fix: 'Chỉnh theo feedback',
    ready: 'Sẵn sàng bàn giao', delivered: 'Đã bàn giao', completed: 'Hoàn thành', paused: 'Tạm dừng', cancelled: 'Hủy'
  };
  let drawerLinkedTasks = null; // cache task liên kết của order đang mở (cho nút gửi feedback / dùng link)

  // Gửi latest_feedback_note của order tới 1 task PIC: comment(type=feedback) + status=feedback_fix
  // + notify PIC (task_status_changed) + order.feedback_status=revision_in_progress.
  async function sendFeedbackToTask(task) {
    if (!task) return;
    const note = currentOrder.latest_feedback_note || '';
    if (!note) { window.MH.toast({ type: 'warning', title: 'Chưa có feedback', message: 'Order chưa có feedback từ client để gửi.' }); return; }
    if (!(window.MH && window.MH.store && window.MH.supabaseEnabled)) { window.MH.toast({ type: 'warning', title: 'Cần Supabase', message: 'Bật Supabase để gửi feedback cho PIC.' }); return; }
    const nowIso = new Date().toISOString();
    try {
      // 1) Comment type=feedback (chỉ field hợp lệ: author/text/type)
      await window.MH.store.taskComments.add(task.task_id, { author: user.name || 'Account', text: '[Feedback từ client] ' + note, type: 'feedback' }).catch(function (e) { console.warn('[feedback→pic] comment failed:', e); });
      // 2) Task → feedback_fix (giữ key cũ, không đổi schema)
      await window.MH.store.tasks.update(task.task_id, { status: 'feedback_fix', last_update: nowIso });
      // 3) Notify PIC qua luồng task_status_changed
      const picId = await window.MH.store.notifications.findUserIdByName(task.assigned_to);
      if (picId) await window.MH.store.notifications.create({
        user_id: picId, type: 'task_status_changed',
        title: 'Yêu cầu chỉnh sửa từ Account',
        message: `${task.task_id} · ${currentOrder.order_id} — Account chuyển feedback client: ${note}`,
        link: 'production-board.html?id=' + task.task_id,
        related_entity_type: 'tasks', related_entity_id: task.task_id
      });
      // 4) Order → revision_in_progress
      currentOrder.feedback_status = 'revision_in_progress';
      currentOrder.last_updated = nowIso.slice(0, 16).replace('T', ' ');
      persistOrder(currentOrder.order_id, { feedback_status: 'revision_in_progress', last_updated: nowIso });
      window.MH.toast({ type: 'success', title: 'Đã gửi feedback cho PIC xử lý', message: `${task.task_id} → ${task.assigned_to || 'PIC'} · status: Chỉnh theo feedback` });
      render(); openDrawer(currentOrder);
    } catch (e) {
      console.warn('[feedback→pic] failed:', e);
      window.MH.toast({ type: 'warning', title: 'Lỗi gửi feedback', message: 'Vui lòng thử lại.' });
    }
  }

  // Nút "Gửi feedback này cho PIC" ở revision panel: 1 task → gửi luôn; nhiều → chỉ định ở mục Links.
  async function onRevisionSendToPic() {
    let tasks = drawerLinkedTasks;
    if (!tasks && window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try { tasks = (await window.MH.store.tasks.list({ order_id: currentOrder.order_id }) || []).filter((t) => !t.is_standalone); } catch (e) { tasks = []; }
    }
    tasks = tasks || [];
    if (!tasks.length) { window.MH.toast({ type: 'warning', title: 'Chưa có task liên kết', message: 'Order này chưa có task sản xuất liên kết. Vui lòng kiểm tra lại Task Tracker trước khi gửi feedback cho PIC.' }); return; }
    if (tasks.length === 1) { sendFeedbackToTask(tasks[0]); return; }
    window.MH.toast({ type: 'info', title: 'Có nhiều task', message: 'Chọn task cụ thể ở mục "Links from Task Tracker" để gửi feedback.' });
    const m = document.getElementById('tt-links-mount'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Async load task liên kết → render section "Links from Task Tracker" + wire nút.
  async function loadTaskLinksIntoDrawer(orderId) {
    const mount = document.getElementById('tt-links-mount');
    if (!mount) return;
    if (!(window.MH && window.MH.store && window.MH.supabaseEnabled)) { mount.innerHTML = ''; return; }
    let tasks = [];
    try { tasks = await window.MH.store.tasks.list({ order_id: orderId }); } catch (e) { console.warn('[tt-links] list failed:', e); }
    tasks = (tasks || []).filter((t) => !t.is_standalone);
    drawerLinkedTasks = tasks;
    if (!tasks.length) { mount.innerHTML = `<p class="text-xs muted" style="margin:10px 0 0">Chưa có task liên kết. Push order sang Production để tạo task.</p>`; return; }
    const linkRow = (label, val) => {
      const safe = escapeHtml(val || '');
      return `<div class="tt-link-row"><span class="tt-link-label">${label}</span>${val
        ? `<a href="${safe}" target="_blank" rel="noopener" class="tt-link-val">${safe}</a><button type="button" class="btn btn-ghost btn-xs" data-copy="${safe}">Copy</button>`
        : `<span class="tt-link-val muted">Chưa có</span>`}</div>`;
    };
    mount.innerHTML = `<div class="tt-links-head">Links from Task Tracker</div>` + tasks.map((t) => `
      <div class="tt-link-card" data-task-id="${t.task_id}">
        <div class="tt-link-card-head">
          <b>${t.task_id}</b>
          <span class="tt-link-pic">${escapeHtml(t.assigned_to || '— Chưa gán —')}</span>
          <span class="tb-status s--${t.status}" style="margin-left:auto"><span class="dot"></span>${TASK_STATUS_LABEL_SHORT[t.status] || t.status}</span>
        </div>
        ${linkRow('Source', t.link_drive)}
        ${linkRow('Preview', t.preview_link)}
        ${linkRow('Final', t.final_link)}
        <div class="tt-link-actions">
          <button type="button" class="btn btn-ghost btn-xs" data-use-preview="${escapeHtml(t.preview_link || '')}" ${t.preview_link ? '' : 'disabled'}>Dùng làm Preview</button>
          <button type="button" class="btn btn-ghost btn-xs" data-use-final="${escapeHtml(t.final_link || '')}" ${t.final_link ? '' : 'disabled'}>Dùng làm Final</button>
          ${currentOrder.latest_feedback_note ? `<button type="button" class="btn btn-xs btn-secondary" data-send-feedback="${t.task_id}">Gửi feedback cho PIC</button>` : ''}
        </div>
      </div>`).join('');
    // Wire (delegation 1 lần trên mount)
    mount.onclick = function (e) {
      const cp = e.target.closest('[data-copy]');
      if (cp) { const val = cp.getAttribute('data-copy'); if (val && navigator.clipboard) navigator.clipboard.writeText(val).then(() => window.MH.toast({ type: 'success', title: 'Đã copy', message: 'Link đã vào clipboard.' })); return; }
      const up = e.target.closest('[data-use-preview]');
      if (up) { const i = document.getElementById('dlv-preview-link'); if (i) { i.value = up.getAttribute('data-use-preview'); window.MH.toast({ type: 'info', title: 'Đã điền Preview Link', message: 'Bấm "Gửi Preview → Client" để bàn giao (chưa gửi tự động).' }); } return; }
      const uf = e.target.closest('[data-use-final]');
      if (uf) { const i = document.getElementById('dlv-final-link'); if (i) { i.value = uf.getAttribute('data-use-final'); window.MH.toast({ type: 'info', title: 'Đã điền Final Link', message: 'Bấm "Gửi Final → Client" để bàn giao (chưa gửi tự động).' }); } return; }
      const sf = e.target.closest('[data-send-feedback]');
      if (sf) { const id = sf.getAttribute('data-send-feedback'); const t = (drawerLinkedTasks || []).find((x) => x.task_id === id); if (t) sendFeedbackToTask(t); return; }
    };
  }

  // Render 1 chip PIC: avatar tròn (initials) + tên (+ nhãn phụ Quay/Chụp nếu có).
  function picChip(name, suffix) {
    if (!name) return '';
    const init = name.substring(0, 2).toUpperCase();
    const alt = ['Hậu', 'Linh Chi', 'Vinh'].indexOf(name) % 2 === 0 ? 'has-red' : '';
    return `<div class="pic-cell ${alt}"><span class="pic-avatar">${init}</span><span class="pic-name">${escapeHtml(name)}${suffix ? ` <small class="muted">· ${suffix}</small>` : ''}</span></div>`;
  }
  function diffDays(target) {
    const d = parseDate(target);
    if (!d) return null;
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // so theo NGÀY lịch, bỏ giờ
    return Math.round((a - TODAY) / (24 * 60 * 60 * 1000));
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
  // Long text / link dài trong drawer — helper chung ở app.js (preview 3 dòng → Xem thêm → modal).
  function longText(title, text, opts) {
    return (window.MH && window.MH.longText) ? window.MH.longText(title, text, opts)
      : '<div class="drawer-longtext"><div class="drawer-longtext__body">' + escapeHtml(text || '—') + '</div></div>';
  }
  function linkBlock(label, url, emptyText) {
    return (window.MH && window.MH.linkActions) ? window.MH.linkActions(label, url, { emptyText: emptyText })
      : (url ? '<a class="link" target="_blank" rel="noopener" href="' + escapeHtml(url) + '">Mở link</a>' : '<em class="muted">—</em>');
  }

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
      case 'pending': return isNewOrder(o);
      case 'checking': return o.account_status === 'checking';
      case 'needinfo': return o.account_status === 'needinfo';
      case 'confirmed': return o.account_status === 'confirmed' && o.production_status !== 'completed';
      case 'unassigned': return o.account_status === 'confirmed' && !orderHasPic(o);
      case 'urgent': return o.priority === 'urgent' || o.priority === 'critical';
      case 'overdue': {
        const days = diffDays(effectiveDeadline(o));
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
      const hay = [o.order_id, o.requester_name, o.requester_email, o.department, o.project_name, o.project_purpose, o.content_brief,
        picName(o.production_pic_user_id, o.production_pic), picName(o.account_pic_user_id, o.account_pic),
        picName(o.production_pic_video_user_id, o.production_pic_video), picName(o.production_pic_photo_user_id, o.production_pic_photo)]
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
    // Deadline hiển thị = effective (agreed || requested) — internal_deadline KHÔNG dùng ở đây.
    const effDl = effectiveDeadline(o);
    const isOverdue = deadlineClass(effDl, ['completed', 'delivered'].includes(o.production_status)) === 'is-overdue';
    const dlCls = deadlineClass(effDl, ['completed', 'delivered'].includes(o.production_status));
    const ts = parseDate(o.created_at);
    const ts_fmt = ts ? `${String(ts.getDate()).padStart(2,'0')}/${String(ts.getMonth()+1).padStart(2,'0')} · ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}` : '—';
    const dl = parseDate(effDl);
    const dl_fmt = dl ? `${String(dl.getDate()).padStart(2,'0')}/${String(dl.getMonth()+1).padStart(2,'0')}/${dl.getFullYear()}` : '—';
    // PIC cell: order media gán qua production_pic_video/photo (KHÔNG phải production_pic đơn).
    let picCell;
    if (o.request_type === 'media' && (o.production_pic_video || o.production_pic_photo)) {
      picCell = `<div class="pic-cell-stack">${picChip(picName(o.production_pic_video_user_id, o.production_pic_video), 'Quay')}${picChip(picName(o.production_pic_photo_user_id, o.production_pic_photo), 'Chụp')}</div>`;
    } else if (o.production_pic || o.production_pic_user_id) {
      picCell = picChip(picName(o.production_pic_user_id, o.production_pic), '');
    } else {
      picCell = `<span class="pic-unassigned">— Chưa gán —</span>`;
    }

    return `
      <tr data-id="${o.order_id}" class="${isOverdue ? 'is-overdue' : ''}">
        <td><span class="order-id">${o.order_id}</span>${isNewOrder(o) ? '<span class="order-new-badge">NEW</span>' : ''}${getRevisionRef(o) ? `<span class="rev-cont-badge" title="Tiếp nối từ ${escapeHtml(getRevisionRef(o))} (sau 03 vòng feedback)">↩ Tiếp</span>` : ''}</td>
        <td><span class="text-xs muted">${ts_fmt}</span></td>
        <td class="requester-cell"><b>${escapeHtml(o.requester_name)}</b><span>${escapeHtml(o.department)}</span></td>
        <td class="project-cell"><b>${escapeHtml(o.project_name)}</b><span>${o.deliverable_type ? o.deliverable_type.slice(0, 2).join(' · ') + (o.deliverable_type.length > 2 ? ' +' + (o.deliverable_type.length - 2) : '') : ''}</span></td>
        <td><span class="text-xs">${TYPE_LABEL[o.request_type] || o.request_type}</span></td>
        <td><span class="priority-pill p--${o.priority}"><span class="dot"></span>${PRIORITY_LABEL[o.priority]}</span></td>
        <td><div class="deadline-cell ${dlCls}"><span class="date">${dl_fmt}${o.agreed_deadline ? ' <span class="text-xs" title="Deadline đã thống nhất với Client" style="color:var(--success)">✓</span>' : ''}</span><span class="relative">${fmtRelative(effDl)}</span></div></td>
        <td><span class="tb-status s--${o.account_status}"><span class="dot"></span>${ACCOUNT_STATUS_LABEL[o.account_status]}</span></td>
        <td><span class="tb-status s--${o.production_status}"><span class="dot"></span>${PROD_STATUS_LABEL[o.production_status] || '—'}</span></td>
        <td>${picCell}</td>
        <td><div class="progress-mini"><div class="bar"><i style="width:${o.progress}%"></i></div><b>${o.progress}%</b></div></td>
        <td>
          <div class="row-actions" data-row-id="${o.order_id}">
            <button class="kebab" aria-label="Hành động">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            <div class="menu">
              <button data-action="view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View Detail</button>
              ${READONLY ? '' : `<button data-action="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kiểm tra brief</button>
              <button data-action="needinfo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg> Yêu cầu bổ sung</button>
              <button data-action="confirm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Xác nhận brief</button>
              <button data-action="assign"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg> Gán P.I.C / Deadline</button>
              <button data-action="push"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> Push → Production</button>
              <hr/>
              <button data-action="cancel" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Hủy đơn</button>`}
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
    // Cập nhật count của drilldown banner (tránh kẹt "0 kết quả" do tính lúc ORDERS còn rỗng/async).
    const dlCount = document.getElementById('dl-count');
    if (dlCount) dlCount.textContent = total;
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
    setCount('count-pending', ORDERS.filter((o) => isNewOrder(o)).length);
    setCount('count-needinfo', ORDERS.filter((o) => o.account_status === 'needinfo').length);
    setCount('count-confirmed', ORDERS.filter((o) => o.account_status === 'confirmed' && o.production_status !== 'completed').length);
    setCount('count-unassigned', ORDERS.filter((o) => o.account_status === 'confirmed' && !orderHasPic(o)).length);
    setCount('count-urgent', ORDERS.filter((o) => (o.priority === 'urgent' || o.priority === 'critical') && o.account_status !== 'rejected').length);
    setCount('count-overdue', ORDERS.filter((o) => {
      const days = diffDays(effectiveDeadline(o));
      return days !== null && days < 0 && o.production_status !== 'completed' && o.account_status !== 'rejected';
    }).length);
    setCount('count-completed', ORDERS.filter((o) => o.production_status === 'completed' || o.production_status === 'delivered').length);
    // sidebar badge
    const navBadge = document.getElementById('nav-pending');
    if (navBadge) navBadge.textContent = ORDERS.filter((o) => isNewOrder(o)).length;
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
    removeDrilldownBanner(); // user đổi view thủ công → banner drilldown cũ không còn đúng
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

  // Export — xuất CSV danh sách Client Orders đang lọc (Excel-compatible, BOM UTF-8).
  const exportOrdersBtn = document.getElementById('export-orders');
  if (exportOrdersBtn) {
    exportOrdersBtn.addEventListener('click', () => {
      const list = sortBy(applyFilters(), state.sortKey, state.sortDir);
      const header = ['Order ID', 'Ngày tạo', 'Requester', 'Phòng ban', 'Project', 'Loại', 'Ưu tiên', 'Deadline', 'Account status', 'Production status', 'P.I.C', 'Tiến độ %'];
      const rows = [
        ['CB Media Hub — Client Orders Export'],
        ['Generated: ' + new Date().toLocaleString('vi-VN')],
        ['Số dòng: ' + list.length + ' (theo bộ lọc hiện tại)'],
        [],
        header,
        ...list.map((o) => [
          o.order_id,
          o.created_at || '',
          o.requester_name || '',
          o.department || '',
          o.project_name || '',
          TYPE_LABEL[o.request_type] || o.request_type || '',
          PRIORITY_LABEL[o.priority] || o.priority || '',
          effectiveDeadline(o) || '',
          ACCOUNT_STATUS_LABEL[o.account_status] || o.account_status || '',
          PROD_STATUS_LABEL[o.production_status] || o.production_status || '',
          picName(o.production_pic_user_id, o.production_pic) || '',
          (o.progress != null ? o.progress : '')
        ])
      ];
      const csv = rows.map((r) => r.map((c) => {
        const s = String(c ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cb-media-hub-client-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      window.MH.toast({ type: 'success', title: 'Đã export', message: `${list.length} orders → CSV (Excel-compatible).` });
    });
  }

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
      const act = action.getAttribute('data-action');
      // Read-only monitor: chỉ cho 'view', chặn mọi mutation (defense-in-depth, kebab vốn đã ẩn).
      if (READONLY && act !== 'view') { document.querySelectorAll('.row-actions.is-open').forEach((r) => r.classList.remove('is-open')); return; }
      const id = action.closest('.row-actions').getAttribute('data-row-id');
      const order = ORDERS.find((o) => o.order_id === id);
      if (!order) return;
      handleAction(act, order);
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
      { ok: o.request_type === 'media' ? true : (o.deliverable_type && o.deliverable_type.length > 0), label: o.request_type === 'media' ? 'Có dịch vụ Quay / Chụp' : 'Có hạng mục cụ thể' },
      { ok: o.request_type === 'media' ? !!o.shoot_location : !!o.size_ratio, label: o.request_type === 'media' ? 'Có địa điểm buổi chụp' : 'Có kích thước / tỉ lệ' },
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
    // Media: checklist logistics thay cho checklist wording (brief §11).
    if (isMediaOrder(o)) {
      const mchecks = [
        { ok: mediaLogisticsOf(o) === 'confirmed', label: 'Lead Media đã chốt logistics' },
        { ok: !!o.shoot_date && !!o.shoot_time, label: 'Có ngày + giờ quay/chụp' },
        { ok: !!o.shoot_location, label: 'Có địa điểm' },
        { ok: !!o.onsite_contact && !!o.onsite_phone, label: 'Có người liên hệ onsite + SĐT' },
        { ok: !!o.production_pic_video || !!o.production_pic_photo || !!o.production_pic_editor || !!o.production_pic, label: 'Đã gán ít nhất 1 PIC Media' },
        { ok: !!o.internal_deadline, label: 'Đã set Internal Deadline' },
        { ok: o.production_status !== 'cancelled' && o.account_status !== 'rejected', label: 'Order chưa bị hủy' }
      ];
      if (mediaNeedsScript(o)) mchecks.splice(1, 0, { ok: isMediaScriptApproved(o), label: 'Content Script Subtask đã được duyệt' });
      const mOk = mchecks.every((c) => c.ok);
      return `<div class="push-check ${mOk ? '' : 'is-fail'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
          mOk ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
        }</svg>
        <div>
          <b>${mOk ? 'Đủ điều kiện chuyển sang Production Board' : 'Thiếu điều kiện chuyển Production Board'}</b>
          <ul>${mchecks.map((c) => `<li class="${c.ok ? 'ok' : ''}">${escapeHtml(c.label)}</li>`).join('')}</ul>
          <p class="text-xs muted" style="margin:6px 0 0">Media không cần Content Wording / Client duyệt wording.</p>
        </div>
      </div>`;
    }
    const checks = [
      { ok: isWordingApproved(o), label: 'Content Wording đã được Client xác nhận' },
      { ok: o.account_status === 'confirmed', label: 'Brief đã được xác nhận' },
      { ok: o.request_type === 'media' ? (!!o.production_pic_video || !!o.production_pic_photo) : !!o.production_pic, label: o.request_type === 'media' ? 'Đã gán PIC Quay/Chụp' : 'Đã gán P.I.C sản xuất' },
      { ok: !!o.internal_deadline, label: 'Đã set Internal Deadline' },
      { ok: o.production_status !== 'cancelled' && o.account_status !== 'rejected', label: 'Order chưa bị hủy' },
      { ok: o.request_type === 'media' ? true : (o.deliverable_type && o.deliverable_type.length > 0), label: o.request_type === 'media' ? 'Hạng mục theo dịch vụ Quay / Chụp' : 'Có hạng mục cụ thể' }
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

  // Phase 2 — Brief Wording Workflow block (lifecycle 6 bước + trạng thái wording hiện tại).
  function buildWordingWorkflow(o) {
    const ws = wordingStatusOf(o);
    const round = o.brief_wording_round || 0;
    const approved = isWordingApproved(o);
    const cancelled = o.account_status === 'rejected' || o.production_status === 'cancelled';
    const reachedMap = { none: 0, assigned: 2, pic_assigned: 2, in_progress: 2, submitted_to_lead: 2, lead_revision: 2, submitted_to_account: 3, account_revision: 3, sent_to_client: 4, client_feedback: 4, client_approved: 6, completed: 6 };
    const reached = reachedMap[ws] != null ? reachedMap[ws] : 0;
    const steps = ['Account kiểm tra brief', 'Chuyển Content Wording', 'Content xử lý wording', 'Account gửi Client xác nhận', 'Client xác nhận brief wording', 'Sẵn sàng Confirm Brief'];
    const li = steps.map(function (s, i) {
      const st = i < reached ? 'done' : (i === reached ? 'active' : 'pending');
      return `<li class="bw-step bw-${st}"><span class="bw-dot">${st === 'done' ? '✓' : (i + 1)}</span><span class="bw-label">${s}</span></li>`;
    }).join('');
    const note = cancelled ? '' : (ws === 'none'
      ? '<p class="bw-note">Bấm <b>Chuyển Content Wording</b> khi brief đã đủ thông tin — bắt buộc trước khi Confirm Brief.</p>'
      : (approved
        ? '<p class="bw-note bw-ok">Content Wording đã được Client xác nhận — có thể Confirm Brief.</p>'
        : (ws === 'submitted_to_account'
          ? '<p class="bw-note">Content đã gửi bản wording — kiểm tra rồi bấm <b>Gửi Client xác nhận Brief</b>.</p>'
          : (ws === 'sent_to_client'
            ? '<p class="bw-note">Đã gửi Client — chờ Client xác nhận brief wording trước khi Confirm Brief.</p>'
            : (ws === 'client_feedback'
              ? '<p class="bw-note bw-warn">Client yêu cầu chỉnh brief wording — Content cần chỉnh & gửi lại Account trước khi gửi Client lần nữa.</p>'
              : '<p class="bw-note">Confirm Brief sẽ mở khi Client xác nhận brief wording.</p>')))));
    // Phase 4 — trạng thái xác nhận của Client.
    const clientConfText = approved
      ? `Client đã xác nhận${o.wording_approved_at ? ' · ' + fmtDateTime(o.wording_approved_at) : ''}`
      : (ws === 'sent_to_client'
        ? `Đã gửi Client${o.wording_client_sent_at ? ' · ' + fmtDateTime(o.wording_client_sent_at) : ''} · chờ xác nhận`
        : (ws === 'client_feedback'
          ? `Client yêu cầu chỉnh${o.wording_client_feedback_at ? ' · ' + fmtDateTime(o.wording_client_feedback_at) : ''}`
          : 'Chưa gửi Client'));
    // CTA "Gửi Client xác nhận Brief": chỉ bật khi Content đã submit & có nội dung wording.
    const canSendClient = !cancelled && ws === 'submitted_to_account' && !!(o.wording_brief && String(o.wording_brief).trim());
    const showSendBtn = !cancelled && !approved && ['submitted_to_account', 'sent_to_client', 'client_feedback', 'account_revision'].includes(ws);
    const soft3 = round >= 2 && !approved; // wording cap 2 vòng — cảnh báo Account khi đã đạt giới hạn
    const overdue = isWordingOverdue(o);
    // Hạn hoàn thành wording — Account đặt khi/ sau khi Chuyển Content Wording (đặt nhanh).
    const deadlineEditable = !cancelled && !approved;
    const deadlineField = `
        <div class="bw-deadline-field" style="margin-top:12px">
          <label class="label" for="ow-wording-deadline">Hạn hoàn thành wording</label>
          <div class="row" style="gap:8px; align-items:center">
            <input class="input" type="datetime-local" id="ow-wording-deadline" value="${toLocalInput(o.wording_deadline)}" ${deadlineEditable ? '' : 'disabled'} style="max-width:230px" />
            <button type="button" class="btn btn-secondary btn-sm" id="act-save-wording-deadline" ${deadlineEditable ? '' : 'disabled'}>Lưu hạn</button>
          </div>
          ${o.wording_deadline ? `<p class="text-xs ${overdue ? 'cwb-overdue' : 'muted'}" style="margin:6px 0 0">Hạn wording: <b>${fmtDateTime(o.wording_deadline)}</b>${overdue ? ' · ⚠ Đã trễ hạn' : ''}</p>` : `<p class="text-xs muted" style="margin:6px 0 0">${ws === 'none' ? 'Đặt hạn rồi bấm "Chuyển Content Wording" — hạn sẽ đi kèm.' : 'Chưa đặt hạn wording.'}</p>`}
        </div>`;
    return `
      <section class="drawer-block ow-wording">
        <div class="drawer-block-head"><span class="block-letter">W</span><h4>Brief Wording Workflow</h4></div>
        <div class="bw-status">Trạng thái: <b>${WORDING_STATUS_LABEL[ws] || ws}</b>${round ? ' · Vòng ' + round : ''}</div>
        <ol class="bw-steps">${li}</ol>
        ${note}
        ${deadlineField}
        ${soft3 ? '<p class="bw-note bw-warn">Brief wording đã đạt tối đa <b>2 vòng chỉnh</b> (Client không thể gửi thêm). Hoàn thiện bản wording rồi gửi Client xác nhận để chốt sản xuất; nếu Client vẫn cần thay đổi lớn, trao đổi trực tiếp.</p>' : ''}
        ${ws !== 'none' ? `
        <dl class="bw-summary" style="margin:12px 0 0">
          <dt>PIC Content</dt><dd>${o.brief_wording_pic ? escapeHtml(o.brief_wording_pic) : '<em class="muted">Chưa gán</em>'}</dd>
          <dt>Hạn wording</dt><dd>${o.wording_deadline ? `<span class="${overdue ? 'cwb-overdue' : ''}">${fmtDateTime(o.wording_deadline)}</span>${overdue ? ' · ⚠ trễ' : ''}` : '<em class="muted">—</em>'}</dd>
          <dt>Vòng wording</dt><dd>${round || '<em class="muted">—</em>'}</dd>
          <dt>Gửi Account lúc</dt><dd>${o.wording_submitted_at ? fmtDateTime(o.wording_submitted_at) : '<em class="muted">—</em>'}</dd>
          <dt>Xác nhận Client</dt><dd>${escapeHtml(clientConfText)}</dd>
        </dl>
        ${o.wording_brief ? longText('Brief đã wording', o.wording_brief) : ''}
        ${o.wording_account_note ? longText('Ghi chú Account', o.wording_account_note) : ''}
        ${o.wording_client_feedback ? longText('Client yêu cầu chỉnh', o.wording_client_feedback) : ''}` : ''}
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px">
          ${showSendBtn ? `<button type="button" class="btn btn-primary btn-sm" id="act-send-wording-client" ${canSendClient ? '' : 'disabled'}>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            ${ws === 'sent_to_client' ? 'Đã gửi Client — chờ xác nhận' : 'Gửi Client xác nhận Brief'}
          </button>` : ''}
          <a class="btn btn-secondary btn-sm" href="content-team.html?id=${escapeHtml(o.order_id)}">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Mở Content Workspace
          </a>
          <a class="btn btn-secondary btn-sm" href="content-workbench.html?id=${escapeHtml(o.order_id)}">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            Mở Content Wording
          </a>
        </div>
      </section>`;
  }

  function buildActivity(o) {
    const acts = [
      { time: o.created_at, label: `Order được tạo bởi <b>${o.requester_name}</b>` },
      o.account_pic && { time: o.last_updated, label: `<b>${escapeHtml(picName(o.account_pic_user_id, o.account_pic))}</b> bắt đầu kiểm tra brief` },
      o.account_status === 'needinfo' && { time: o.last_updated, label: `<b>${escapeHtml(picName(o.account_pic_user_id, o.account_pic))}</b> yêu cầu bổ sung brief` },
      o.account_status === 'confirmed' && { time: o.last_updated, label: `<b>${escapeHtml(picName(o.account_pic_user_id, o.account_pic))}</b> xác nhận brief` },
      o.production_pic && { time: o.last_updated, label: `Gán P.I.C: <b>${escapeHtml(picName(o.production_pic_user_id, o.production_pic))}</b>` },
      ['inprogress', 'review', 'ready', 'delivered', 'completed'].includes(o.production_status) && { time: o.last_updated, label: `Status → ${PROD_STATUS_LABEL[o.production_status]}` }
    ].filter(Boolean);
    return `<ul class="activity-mini">${acts.slice(-5).reverse().map((a) => `<li><span>${a.label}</span><time>${fmtDateTime(a.time)}</time></li>`).join('')}</ul>`;
  }

  /* ---------- Order Lifecycle (display-only) ----------
     Suy ra giai đoạn hiện tại của order qua 4 nhóm: Brief → Production →
     Preview & Feedback → Final & Rating. KHÔNG phải action buttons. */
  function computeLifecycle(o) {
    const cancelled = o.account_status === 'rejected' || o.production_status === 'cancelled';
    const briefConfirmed = o.account_status === 'confirmed';
    const isPushed = !!o.production_status && o.production_status !== 'unassigned' && !cancelled;
    const hasPreview = !!o.preview_link;
    const hasFinal = !!o.final_delivery_link;
    const rated = typeof o.satisfaction_score === 'number' && o.satisfaction_score > 0;
    const completed = o.production_status === 'completed';
    const fb = o.feedback_status || '';
    const round = o.revision_round || 0;

    const briefText = ({ pending: 'Đã nhận yêu cầu', checking: 'Đang kiểm tra brief', needinfo: 'Cần bổ sung brief', wording: 'Đang Content Wording', confirmed: 'Đã xác nhận brief', rejected: 'Đơn đã hủy' })[o.account_status] || '—';
    const prodText = ({ unassigned: 'Chưa push Task Tracker', received: 'Production đã nhận task', inprogress: 'Đang sản xuất', review: 'Chờ duyệt nội bộ', revision: 'Cần chỉnh sửa nội bộ', ready: 'Sẵn sàng gửi Preview', delivered: 'Đã bàn giao', completed: 'Hoàn thành', cancelled: 'Đã hủy' })[o.production_status] || '—';
    let previewText;
    if (fb === 'approved') previewText = 'Client đã duyệt Preview';
    else if (fb === 'exceeded_limit') previewText = 'Đã đạt giới hạn chỉnh sửa';
    else if (fb === 'feedback_received') previewText = `Client đã gửi Feedback Round ${round}`;
    else if (fb === 'revision_in_progress') previewText = `Đang chỉnh Feedback Round ${round}`;
    else if (hasPreview) previewText = 'Đã gửi Preview · Chờ Client phản hồi';
    else previewText = 'Chưa gửi Preview';
    let finalText;
    if (completed) finalText = 'Hoàn thành';
    else if (rated) finalText = 'Client đã đánh giá';
    else if (hasFinal) finalText = 'Đã gửi Final · Chờ Client đánh giá';
    else finalText = 'Chưa gửi Final';

    let active, stage;
    if (cancelled) { active = -1; stage = 'cancelled'; }
    else if (completed) { active = 3; stage = 'completed'; }
    else if (rated) { active = 3; stage = 'rated'; }
    else if (hasFinal) { active = 3; stage = 'final_sent'; }
    else if (fb === 'approved') { active = 3; stage = 'preview_approved'; }
    else if (fb === 'exceeded_limit') { active = 2; stage = 'exceeded'; }
    else if (fb === 'revision_in_progress') { active = 2; stage = 'revising'; }
    else if (fb === 'feedback_received') { active = 2; stage = 'feedback_received'; }
    else if (hasPreview) { active = 2; stage = 'preview_sent'; }
    else if (isPushed) { active = 1; stage = 'production'; }
    else if (briefConfirmed) { active = 1; stage = 'brief_confirmed'; }
    else { active = 0; stage = 'brief'; }

    const orderDone = completed || rated;
    const stateOf = (i) => cancelled ? 'pending' : (orderDone ? 'done' : (i < active ? 'done' : (i === active ? 'active' : 'pending')));
    const groups = [
      { label: 'Brief', state: stateOf(0), status: briefText },
      { label: 'Production', state: stateOf(1), status: prodText },
      { label: 'Preview & Feedback', state: stateOf(2), status: previewText },
      { label: 'Final & Rating', state: stateOf(3), status: finalText }
    ];

    let summary;
    switch (stage) {
      case 'cancelled': summary = 'Đơn đã hủy'; break;
      case 'completed': summary = 'Hoàn thành'; break;
      case 'rated': summary = 'Client đã đánh giá · Hoàn tất'; break;
      case 'final_sent': summary = 'Đã gửi Final · Chờ Client đánh giá'; break;
      case 'preview_approved': summary = 'Client đã duyệt Preview · Chờ gửi Final'; break;
      case 'exceeded': summary = 'Đã đạt giới hạn chỉnh sửa · Tạo task/order mới'; break;
      case 'revising': summary = `Đang chỉnh Feedback Round ${round} · PIC xử lý`; break;
      case 'feedback_received': summary = `Client đã gửi Feedback Round ${round} · Đang chờ gửi cho PIC`; break;
      case 'preview_sent': summary = 'Đã gửi Preview · Chờ Client phản hồi'; break;
      case 'production': summary = prodText; break;
      case 'brief_confirmed': summary = 'Đã xác nhận brief · Chờ push Task Tracker'; break;
      default: summary = briefText;
    }
    return { groups, summary, stage, active, round, cancelled };
  }

  function buildLifecycleTimeline(o) {
    const lc = computeLifecycle(o);
    const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const nodes = lc.groups.map((g, i) => `
      <div class="lc-node lc-${g.state}">
        <span class="lc-dot">${g.state === 'done' ? check : (g.state === 'active' ? '<span class="lc-pulse"></span>' : '')}</span>
        <div class="lc-text"><span class="lc-label">${g.label}</span><span class="lc-status">${escapeHtml(g.status)}</span></div>
      </div>${i < lc.groups.length - 1 ? '<span class="lc-arrow"></span>' : ''}`).join('');
    return `
      <section class="order-lifecycle ${lc.cancelled ? 'is-cancelled' : ''}" aria-label="Tiến trình order">
        <div class="lc-track">${nodes}</div>
        <div class="lc-summary"><span class="lc-summary-dot"></span>${escapeHtml(lc.summary)}</div>
      </section>`;
  }

  /* Linked Task card — thông tin task sản xuất liên kết (thay cho dòng "Đã push sang Task Tracker").
     Informational, KHÔNG phải status chính của order. */
  function buildLinkedTaskCard(o) {
    const cancelled = o.account_status === 'rejected' || o.production_status === 'cancelled';
    const isPushed = !!o.production_status && o.production_status !== 'unassigned' && !cancelled;
    const tasks = tasksForOrder(o.order_id) || [];
    if (!isPushed && !tasks.length) return ''; // chưa push & chưa có task → không hiện card
    const rows = tasks.length
      ? tasks.map((t) => `
          <div class="lt-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 0;border-top:1px solid var(--divider)">
            <a class="link mono" href="production-board.html?id=${escapeHtml(t.task_id)}" style="font-weight:700">${escapeHtml(t.task_id)}</a>
            <span class="text-xs muted">${escapeHtml(TYPE_LABEL[t.task_type] || t.task_type || '—')}</span>
            <span class="text-xs" style="color:var(--brand-600,#191970)">${t.assigned_to ? escapeHtml(t.assigned_to) : '— chưa gán —'}</span>
            <span class="tb-status s--${t.status}"><span class="dot"></span>${TASK_STATUS_LABEL[t.status] || t.status}</span>
            <a class="link" href="production-board.html?id=${escapeHtml(t.task_id)}" style="margin-left:auto">Xem task →</a>
          </div>`).join('')
      : `<p class="text-xs muted" style="margin:6px 0 0">Đã liên kết task sản xuất — mở <a href="production-board.html?dl=in_production" class="link">Task Tracker</a> để xem chi tiết.</p>`;
    return `
      <section class="drawer-block ow-linked-task">
        <div class="drawer-block-head"><span class="block-letter">T</span><h4>Task Tracker</h4></div>
        <div class="linked-task-card" style="border:1px solid var(--border);border-radius:var(--radius);padding:11px 14px;background:var(--surface-2,#f8f9fd)">
          <p class="text-xs muted" style="margin:0">Đã liên kết task sản xuất.</p>
          ${rows}
        </div>
      </section>`;
  }

  // "Hành động kế tiếp" — suy ra từ lifecycle stage (display-only timeline ở trên).
  function orderNextAction(o) {
    const lc = computeLifecycle(o);
    const N = lc.round;
    switch (lc.stage) {
      case 'cancelled':        return { title: 'Order đã hủy', detail: 'Không còn hành động sản xuất cho order này.' };
      case 'completed':        return { title: 'Hoàn thành', detail: 'Order đã hoàn tất — Final đã bàn giao và đóng task.' };
      case 'rated':            return { title: 'Đã có đánh giá', detail: 'Client đã đánh giá. Đóng order/task ở Task Tracker nếu chưa.' };
      case 'final_sent':       return { title: 'Chờ Client đánh giá', detail: 'Final đã được gửi. Client cần kiểm tra và gửi đánh giá để hoàn tất order.' };
      case 'preview_approved': return { title: 'Chuẩn bị gửi Final', detail: 'Client đã duyệt bản Preview. Account lấy Final Link từ "Links from Task Tracker" (hoặc yêu cầu PIC xuất Final), rồi gửi Final cho Client.' };
      case 'exceeded':         return { title: 'Đã đạt giới hạn chỉnh sửa', detail: 'Order đã dùng đủ 03 vòng feedback. Tạo task/order mới từ feedback để team Media xử lý tiếp.' };
      case 'revising':         return { title: 'PIC đang chỉnh sửa', detail: `Feedback Round ${N} đã chuyển cho PIC. Chờ PIC cập nhật Preview mới rồi gửi lại Client.` };
      case 'feedback_received':return { title: 'Gửi feedback cho PIC', detail: `Client đã gửi Feedback Round ${N}. Account cần chuyển feedback này cho PIC trong Task Tracker để chỉnh sửa.` };
      case 'preview_sent':     return { title: 'Chờ Client phản hồi', detail: 'Đã gửi Preview — theo dõi feedback từ Client. Nếu Client duyệt Preview, Account gửi Final. Nếu Client gửi feedback, chuyển feedback cho PIC xử lý.' };
      case 'production': {
        if (o.production_status === 'ready') return isInternalContentOrder(o)
          ? { title: 'Bàn giao nội bộ cho Content', detail: 'Task đã sẵn sàng. Lấy Preview Link ở "Links from Task Tracker" → mục Bàn giao → bấm Gửi Preview → Content.' }
          : { title: 'Bàn giao cho client', detail: 'Task đã sẵn sàng. Lấy Preview Link ở "Links from Task Tracker" → mục Bàn giao → bấm Gửi Preview.' };
        if (o.production_status === 'review') return { title: 'Duyệt nội bộ', detail: 'Team đã gửi preview/final — mở Task Tracker duyệt (Đạt → Sẵn sàng bàn giao) trước khi gửi Preview.' };
        return { title: 'Theo dõi sản xuất', detail: 'Mở Task Tracker để xem tiến độ chi tiết của team Media.' };
      }
      case 'brief_confirmed': {
        const noPic = o.request_type === 'media' ? (!o.production_pic_video && !o.production_pic_photo) : !o.production_pic;
        if (noPic) return o.request_type === 'media'
          ? { title: 'Gán PIC Quay / Chụp', detail: 'Chọn PIC cho dịch vụ cần thực hiện (Quay và/hoặc Chụp) để sẵn sàng tạo task.' }
          : { title: 'Gán Production PIC', detail: 'Chọn người phụ trách sản xuất để sẵn sàng tạo task.' };
        if (!o.internal_deadline) return { title: 'Set Internal Deadline', detail: 'Cần deadline nội bộ trước khi push sang Task Tracker.' };
        return { title: 'Push sang Task Tracker', detail: 'Brief đã đủ điều kiện, có thể tạo task sản xuất.' };
      }
      default: { // brief
        // Media: owner là Lead Media, cổng là logistics — không nhắc Content Wording.
        if (isMediaOrder(o)) {
          const miss = mediaLogisticsMissing(o);
          if (mediaNeedsScript(o) && !isMediaScriptApproved(o)) {
            return { title: 'Chờ script Content', detail: `Order cần kịch bản (${MEDIA_SCRIPT_LABEL[mediaScriptStatusOf(o)] || ''}). Lead Media theo dõi Content Script Subtask trong Media Operations; script duyệt xong mới push Production.` };
          }
          if (miss.length) return { title: 'Lead Media chốt logistics', detail: `Còn thiếu: ${miss.join(' · ')}. Mở Media Operations để chốt lịch/địa điểm/liên hệ onsite.` };
          if (o.account_status !== 'confirmed') return { title: 'Xác nhận brief', detail: 'Logistics đã đủ — xác nhận brief rồi gán PIC Media và push Production.' };
          return { title: 'Gán PIC & Push Production', detail: 'Logistics đã chốt. Gán PIC Quay/Chụp/Dựng và push sang Task Tracker.' };
        }
        if (o.account_status === 'wording') {
          return isWordingApproved(o)
            ? { title: 'Xác nhận brief', detail: 'Content Wording đã được Client xác nhận — có thể Confirm Brief.' }
            : { title: 'Chờ Content Wording', detail: `Order đang ở Content Wording (${WORDING_STATUS_LABEL[wordingStatusOf(o)]}). Confirm Brief mở khi Client xác nhận brief wording.` };
        }
        if (o.account_status === 'checking') return { title: 'Chuyển Content Wording hoặc yêu cầu bổ sung', detail: 'Brief đã kiểm tra: nếu đủ thông tin → "Chuyển Content Wording"; nếu thiếu → "Yêu cầu bổ sung".' };
        if (o.account_status === 'needinfo') return { title: 'Chờ client bổ sung', detail: 'Theo dõi phản hồi của client trước khi chuyển Content Wording.' };
        return { title: 'Kiểm tra brief', detail: 'Account cần rà soát thông tin trước khi chuyển Content Wording.' };
      }
    }
  }

  /* ---------- Deadline thương lượng với Client (P0 deadline flow) ----------
     Account/Admin/Lead Media đề xuất agreed_deadline mới + lý do → Client nhận noti
     deadline_proposed → Client Đồng ý (accepted) / Cần trao đổi lại (rejected) qua RPC.
     requested_deadline KHÔNG BAO GIỜ bị ghi đè (audit). internal_deadline không lộ Client. */
  const DL_PROPOSAL_LABEL = {
    none: 'Chưa có đề xuất', proposed: 'Đang chờ Client phản hồi',
    accepted: 'Client đã đồng ý', rejected: 'Client cần trao đổi lại'
  };
  function buildDeadlineNegotiation(o) {
    const status = o.deadline_proposal_status || 'none';
    const closed = o.account_status === 'rejected' || o.production_status === 'cancelled' || o.production_status === 'completed';
    const isInternal = isInternalOrder(o);
    if (isInternal) return ''; // order nội bộ không có client thật — không thương lượng deadline.
    const statusChip = {
      none: '', proposed: 'badge-warning', accepted: 'badge-success', rejected: 'badge-danger'
    }[status];
    const histArr = Array.isArray(o.deadline_history) ? o.deadline_history
      : (typeof o.deadline_history === 'string' ? (function () { try { return JSON.parse(o.deadline_history) || []; } catch (e) { return []; } })() : []);
    const histHtml = histArr.length ? `
      <details class="text-xs" style="margin-top:8px">
        <summary style="cursor:pointer;color:var(--text-muted)">Lịch sử deadline (${histArr.length})</summary>
        <ul style="margin:6px 0 0 16px;color:var(--text-muted);display:flex;flex-direction:column;gap:3px">
          ${histArr.slice().reverse().map((h) => `<li>${escapeHtml(fmtDateTime(h.at))} · <b>${escapeHtml({ proposed: 'Đề xuất', accepted: 'Client đồng ý', rejected: 'Client trao đổi lại' }[h.type] || h.type)}</b>${h.to ? ' → ' + escapeHtml(fmtDeadlineDate(h.to)) : (h.deadline ? ' → ' + escapeHtml(fmtDeadlineDate(h.deadline)) : '')}${h.reason ? ' · ' + escapeHtml(h.reason) : ''}${h.note ? ' · "' + escapeHtml(h.note) + '"' : ''} — ${escapeHtml(h.by || '')}</li>`).join('')}
        </ul>
      </details>` : '';
    const lateWarn = internalPastEffective(o) ? `
      <div class="text-xs" style="margin-top:10px;padding:9px 12px;background:rgba(186,17,15,.07);border:1px solid rgba(186,17,15,.28);border-radius:8px;color:#8c1210">
        <b>⚠ Internal Deadline đang trễ hơn deadline đã thống nhất với Client.</b> Vui lòng điều chỉnh Internal Deadline hoặc thương lượng lại deadline với Client.
      </div>` : '';
    const rejectedNote = status === 'rejected' && o.deadline_response_note ? `
      <div class="text-xs" style="margin-top:10px;padding:9px 12px;background:var(--surface-2);border-radius:8px">
        <b>Phản hồi của Client${o.deadline_responded_at ? ' (' + fmtDateTime(o.deadline_responded_at) + ')' : ''}:</b> ${escapeHtml(o.deadline_response_note)}
      </div>` : '';
    const canPropose = ['admin', 'account'].includes(user.role) && !READONLY && !closed;
    const form = canPropose ? `
      <div class="edit-row" style="margin-top:12px">
        <label>Deadline đề xuất mới</label>
        <input class="input" id="dl-propose-input" type="datetime-local" value="${status === 'proposed' ? toLocalInput(o.agreed_deadline) : ''}" />
      </div>
      <div class="edit-row">
        <label>Lý do điều chỉnh</label>
        <textarea class="textarea" id="dl-propose-reason" placeholder="VD: khối lượng thiết kế lớn, cần thêm 2 ngày để đảm bảo chất lượng..." style="min-height:64px">${status === 'proposed' ? escapeHtml(o.deadline_proposal_reason || '') : ''}</textarea>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:4px">
        <button class="btn btn-primary btn-sm" id="dl-propose-send">${status === 'proposed' ? 'Cập nhật đề xuất → Client' : 'Gửi Client xác nhận deadline mới'}</button>
      </div>
      <p class="text-xs muted" style="margin:8px 0 0">Client sẽ nhận thông báo và bấm <b>Đồng ý</b> / <b>Cần trao đổi lại</b> trong Client Portal. Deadline gốc của Client được giữ nguyên để đối chiếu.</p>
    ` : (closed ? '<p class="text-xs muted" style="margin-top:10px">Order đã đóng/hủy — không thương lượng deadline nữa.</p>' : '');
    return `
      <section class="drawer-block ow-deadline-nego">
        <div class="drawer-block-head"><span class="block-letter">DL</span><h4>Deadline thương lượng với Client</h4></div>
        <dl>
          <dt>Deadline Client mong muốn</dt><dd>${o.requested_deadline ? escapeHtml(fmtDeadlineDate(o.requested_deadline)) : '<em class="muted">—</em>'}</dd>
          <dt>Deadline đã thống nhất</dt><dd>${o.agreed_deadline ? '<b>' + escapeHtml(fmtDeadlineDate(o.agreed_deadline)) + '</b>' : '<em class="muted">—</em>'}</dd>
          <dt>Trạng thái đề xuất</dt><dd>${statusChip ? `<span class="badge ${statusChip}">${DL_PROPOSAL_LABEL[status]}</span>` : DL_PROPOSAL_LABEL[status]}${status === 'proposed' && o.deadline_proposed_at ? ` <span class="text-xs muted">· gửi ${fmtDateTime(o.deadline_proposed_at)}</span>` : ''}</dd>
          ${status !== 'none' && o.deadline_proposal_reason ? `<dt>Lý do điều chỉnh</dt><dd>${escapeHtml(o.deadline_proposal_reason)}</dd>` : ''}
        </dl>
        ${rejectedNote}
        ${lateWarn}
        ${form}
        ${histHtml}
      </section>`;
  }

  let dlProposeSending = false;
  async function sendDeadlineProposal(o) {
    if (dlProposeSending || !o) return;
    if (o.account_status === 'rejected' || o.production_status === 'cancelled' || o.production_status === 'completed') {
      window.MH.toast({ type: 'warning', title: 'Order đã đóng', message: 'Không thể đề xuất deadline cho order đã hoàn thành/hủy.' }); return;
    }
    const input = document.getElementById('dl-propose-input');
    const reasonEl = document.getElementById('dl-propose-reason');
    const val = input ? input.value : '';
    const reason = reasonEl ? reasonEl.value.trim() : '';
    if (!val) { window.MH.toast({ type: 'error', title: 'Thiếu deadline', message: 'Chọn deadline đề xuất mới trước khi gửi.' }); return; }
    if (!reason) { window.MH.toast({ type: 'error', title: 'Thiếu lý do', message: 'Nhập lý do điều chỉnh — Client cần biết vì sao deadline thay đổi.' }); return; }
    const proposed = new Date(val);
    if (isNaN(proposed.getTime())) { window.MH.toast({ type: 'error', title: 'Deadline không hợp lệ', message: 'Kiểm tra lại giá trị deadline.' }); return; }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (proposed.getTime() < todayStart.getTime()) {
      window.MH.toast({ type: 'error', title: 'Deadline trong quá khứ', message: 'Deadline đề xuất phải từ hôm nay trở đi.' }); return;
    }
    const proposedIso = proposed.toISOString();
    const nowIso = new Date().toISOString();
    const by = user.name || user.email || 'Account';
    const prevHist = Array.isArray(o.deadline_history) ? o.deadline_history
      : (typeof o.deadline_history === 'string' ? (function () { try { return JSON.parse(o.deadline_history) || []; } catch (e) { return []; } })() : []);
    const hist = prevHist.concat([{
      type: 'proposed',
      from: o.agreed_deadline || o.requested_deadline || null,
      to: proposedIso,
      reason: reason,
      by: by,
      at: nowIso
    }]);
    const patch = {
      agreed_deadline: proposedIso,
      deadline_proposal_status: 'proposed',
      deadline_proposal_reason: reason,
      deadline_proposed_by: by,
      deadline_proposed_by_id: user.id || null,
      deadline_proposed_at: nowIso,
      deadline_responded_at: null,
      deadline_response_by: null,
      deadline_response_note: null,
      deadline_history: hist,
      last_updated: nowIso
    };
    dlProposeSending = true;
    const btn = document.getElementById('dl-propose-send');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi…'; }
    try {
      if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
        // Bài học transferToWording: GHI DB TRƯỚC + verify rồi mới notify — tránh "noti ma".
        const saved = await window.MH.store.orders.update(o.order_id, patch);
        if (!saved || saved.deadline_proposal_status !== 'proposed') {
          throw new Error('Update không land (RLS khớp 0 dòng hoặc thiếu migration) — đã chạy supabase/add-agreed-deadline-flow.sql chưa?');
        }
        Object.assign(o, saved);
      } else {
        Object.assign(o, patch, { last_updated: nowIso.slice(0, 16).replace('T', ' ') });
      }
      // Notify client (type deadline_proposed — cần migration mở CHECK; fail chỉ warn, không chặn).
      notifyClient(o, {
        type: 'deadline_proposed',
        title: 'Đề xuất điều chỉnh deadline',
        message: `${o.order_id} · ${o.project_name || ''} — Team đề xuất deadline mới: ${fmtDeadlineDate(proposedIso)}. Lý do: ${reason}. Vui lòng xác nhận trong Client Portal.`,
        link: 'client-dashboard.html?order=' + encodeURIComponent(o.order_id)
      });
      window.MH.toast({ type: 'success', title: 'Đã gửi đề xuất deadline', message: 'Client sẽ nhận thông báo và phản hồi trong Portal.' });
      render();
      openDrawer(o);
    } catch (err) {
      console.error('[deadline-proposal] gửi lỗi:', err);
      window.MH.toast({ type: 'error', title: 'Không gửi được đề xuất', message: String(err && err.message || err).slice(0, 200) });
    } finally {
      dlProposeSending = false;
      const b = document.getElementById('dl-propose-send');
      if (b) { b.disabled = false; }
    }
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
    document.getElementById('d-created').textContent = 'Tạo lúc ' + fmtDateTime(o.created_at);
    document.getElementById('d-copy').setAttribute('data-copy', o.order_id);
    // Phase 5: badge order nội bộ (Internal Media Request từ Content Team).
    var _ib = document.getElementById('d-internal-badge');
    if (_ib) {
      var _isInternal = o.order_kind === 'internal_media_request' || o.order_kind === 'internal_ads_media_request' || o.origin === 'content_team' || o.origin === 'ads_order' || o.client_visible === false;
      _ib.hidden = !_isInternal;
      var _fromAds = o.order_kind === 'internal_ads_media_request' || o.origin === 'ads_order';
      _ib.textContent = _fromAds ? 'Internal · From Ads' : 'Internal · From Content';
      if (_isInternal && (o.source_content_task_id || o.source_ads_order_id)) { _ib.title = 'Order nội bộ' + (_fromAds ? ' phục vụ Ads Order ' + (o.source_ads_order_id || '') : ' từ Content Task') + ' — không hiển thị Client Portal'; }
    }

    const safeJoin = (a) => Array.isArray(a) ? a.map((v) => `<span class="chip-mini">${escapeHtml(v)}</span>`).join('') : (a || '<em class="muted">—</em>');
    const v = (x) => x ? escapeHtml(x) : '<em class="muted">—</em>';
    const link = (u, label) => u ? `<a class="link" href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(label || u)}</a>` : '<em class="muted">—</em>';

    const nextAction = orderNextAction(o);
    // Mọi chữ trong block Bàn giao lấy từ đây (Client Order thật vs Internal Content Order).
    const dMeta = deliveryTargetMeta(o);
    drawerBody.innerHTML = `
      ${(function () { const ref = getRevisionRef(o); return ref ? `
      <div class="ow-revision-banner" style="margin-bottom:14px;padding:11px 14px;background:rgba(186,17,15,.07);border:1px solid rgba(186,17,15,.28);border-left:3px solid #BA110F;border-radius:10px;font-size:13px;line-height:1.55">
        <b>↩ Order chỉnh sửa tiếp</b> — tạo nối tiếp từ Order gốc <a class="link" href="database-orders.html?id=${escapeHtml(ref)}"><b>${escapeHtml(ref)}</b></a> sau khi đã hoàn tất <b>03 vòng feedback</b>. Đây KHÔNG phải order mới hoàn toàn — client cần chỉnh sửa/phát sinh thêm. Xem brief cũ ở Order gốc để có ngữ cảnh.
      </div>` : ''; })()}
      ${buildLifecycleTimeline(o)}

      <section class="drawer-block ow-next">
        <div class="drawer-block-head"><span class="block-letter">N</span><h4>Hành động kế tiếp</h4></div>
        <div class="order-next-action">
          <b>${escapeHtml(nextAction.title)}</b>
          <p>${escapeHtml(nextAction.detail)}</p>
        </div>
      </section>

      ${buildLinkedTaskCard(o)}

      <section class="order-summary-grid" aria-label="Tóm tắt order">
        <div class="order-summary-tile">
          <span>Người gửi</span>
          <b>${v(o.requester_name)}</b>
          <small>${v(o.department)}</small>
        </div>
        <div class="order-summary-tile">
          <span>Deadline hiệu lực</span>
          <b>${escapeHtml(deadlineLabel(o))}</b>
          <small>${PRIORITY_LABEL[o.priority] || o.priority}</small>
        </div>
        <div class="order-summary-tile">
          <span>Account PIC</span>
          <b>${v(picName(o.account_pic_user_id, o.account_pic))}</b>
          <small>${ACCOUNT_STATUS_LABEL[o.account_status] || o.account_status}</small>
        </div>
        <div class="order-summary-tile">
          <span>Production PIC</span>
          <b>${v(o.request_type === 'media' ? (picName(o.production_pic_video_user_id, o.production_pic_video) || picName(o.production_pic_photo_user_id, o.production_pic_photo)) : picName(o.production_pic_user_id, o.production_pic))}</b>
          <small>${PROD_STATUS_LABEL[o.production_status] || o.production_status}</small>
        </div>
      </section>

      <section class="drawer-block ow-requester">
        <div class="drawer-block-head"><span class="block-letter">A</span><h4>Thông tin người gửi</h4></div>
        <dl>
          <dt>Họ và tên</dt><dd>${v(o.requester_name)}</dd>
          <dt>Email</dt><dd>${v(o.requester_email)}</dd>
          <dt>SĐT / Liên hệ</dt><dd>${v(o.requester_contact)}</dd>
          <dt>Chi nhánh / Bộ phận</dt><dd>${v(o.department)}</dd>
          <dt>Ngày gửi</dt><dd><span class="mono">${fmtDateTime(o.created_at)}</span></dd>
        </dl>
      </section>

      <section class="drawer-block ow-brief">
        <div class="drawer-block-head"><span class="block-letter">B</span><h4>Thông tin brief</h4></div>
        <dl>
          <dt>Mục đích</dt><dd>${v(o.project_purpose)}</dd>
          <dt>Đối tượng mục tiêu</dt><dd>${safeJoin(o.target_audience)}</dd>
          <dt>Kênh sử dụng</dt><dd>${safeJoin(o.usage_channels)}</dd>
          <dt>Loại yêu cầu</dt><dd>${v(TYPE_LABEL[o.request_type])}</dd>
          <dt>Hạng mục</dt><dd>${safeJoin(o.deliverable_type)}</dd>
          <dt>Kích thước</dt><dd>${v(o.size_ratio)}</dd>
          ${['media', 'photo', 'shoot'].includes(o.request_type) ? `<dt>Địa điểm</dt><dd>${v(o.shoot_location)}</dd>` : ''}
          <dt>Wording</dt><dd>${o.wording_required ? 'Cần wording' : 'Dùng đúng nội dung'}</dd>
          <dt>File brief</dt><dd>${linkBlock('', o.file_brief_url, 'Chưa có file brief.')}</dd>
          <dt>Source link</dt><dd>${linkBlock('', o.source_link, 'Chưa có source link.')}</dd>
        </dl>
        ${longText('Nội dung brief', o.content_brief)}
        ${longText('Định hướng sáng tạo', o.creative_direction, { emptyText: 'Chưa có định hướng.' })}
        ${buildBriefChecklist(o)}
      </section>

      ${isMediaOrder(o) ? buildMediaOpsSummary(o) : buildWordingWorkflow(o)}

      <section class="drawer-block ow-internal">
        <div class="drawer-block-head"><span class="block-letter">C</span><h4>Điều phối nội bộ</h4></div>
        <div class="edit-row">
          <label>Account Status</label>
          <select class="select" id="edit-account-status">
            ${Object.entries(ACCOUNT_STATUS_LABEL).map(([k, label]) => `<option value="${k}" ${o.account_status === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Account PIC</label>
          <select class="select" id="edit-account-pic" data-pic-dd>
            ${picOptionsId(o.account_pic_user_id, o.account_pic, ACCT_PIC_ROLES)}
          </select>
        </div>
        ${o.request_type === 'media' ? `
        <div class="edit-row">
          <label>PIC Quay</label>
          <select class="select" id="edit-prod-pic-video" data-pic-dd ${isOrderPushed(o) ? 'disabled' : ''}>
            ${picOptionsId(o.production_pic_video_user_id, o.production_pic_video, PROD_PIC_ROLES)}
          </select>
        </div>
        <div class="edit-row">
          <label>PIC Chụp</label>
          <select class="select" id="edit-prod-pic-photo" data-pic-dd ${isOrderPushed(o) ? 'disabled' : ''}>
            ${picOptionsId(o.production_pic_photo_user_id, o.production_pic_photo, PROD_PIC_ROLES)}
          </select>
        </div>
        ` : `
        <div class="edit-row">
          <label>Production PIC</label>
          <select class="select" id="edit-prod-pic" data-pic-dd ${isOrderPushed(o) ? 'disabled' : ''}>
            ${picOptionsId(o.production_pic_user_id, o.production_pic, PROD_PIC_ROLES)}
          </select>
        </div>
        `}
        ${isOrderPushed(o) ? `<p class="text-xs muted" style="margin:-4px 0 8px; display:flex; align-items:center; gap:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Đã push — đổi PIC tại <a href="production-board.html?dl=in_production" class="link">Task Tracker</a> để task được gán lại đúng người.
        </p>` : ''}
        <div class="edit-row">
          <label>Priority</label>
          <select class="select" id="edit-priority">
            ${Object.entries(PRIORITY_LABEL).map(([k, label]) => `<option value="${k}" ${o.priority === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Internal Deadline</label>
          <input class="input" id="edit-internal-deadline" type="datetime-local" value="${toLocalInput(o.internal_deadline)}" />
        </div>
        <div class="edit-row">
          <label>Production Status</label>
          <select class="select" id="edit-prod-status" disabled title="Tự đồng bộ theo trạng thái task ở Task Tracker — không chỉnh tay">
            ${Object.entries(PROD_STATUS_LABEL).map(([k, label]) => `<option value="${k}" ${o.production_status === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <p class="text-xs muted" style="margin:-2px 0 0; display:flex; align-items:center; gap:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          Tự đồng bộ theo task ở <a href="production-board.html?dl=in_production" class="link">Task Tracker</a> (Production cập nhật).
        </p>
      </section>

      ${buildDeadlineNegotiation(o)}

      <section class="drawer-block ow-comments">
        <div class="drawer-block-head"><span class="block-letter">C</span><h4>Ghi chú / Comment nội bộ</h4></div>
        <p class="ow-comment-help">Ghi chú trao đổi giữa Admin/Account về brief, thông tin cần bổ sung hoặc quyết định xử lý.</p>
        <textarea class="textarea" id="edit-internal-note" placeholder="Viết ghi chú nội bộ..." style="min-height:110px">${escapeHtml(o.internal_note || '')}</textarea>
        <div class="row" style="justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3)">
          <button class="btn btn-ghost btn-sm" id="save-internal">Lưu điều phối & ghi chú</button>
          ${(() => {
            const isCancelled = o.account_status === 'rejected' || o.production_status === 'cancelled';
            if (isCancelled) return '';
            if (isOrderPushed(o)) return `<button class="btn btn-sm" id="confirm-coordination" disabled style="opacity:.5">✓ Đã chuyển Production</button>`;
            const canConfirm = o.account_status === 'confirmed';
            return `<button class="btn btn-sm btn-push-coord" id="confirm-coordination" ${canConfirm ? '' : 'disabled'} title="${canConfirm ? 'Lưu điều phối và tạo task Production' : 'Cần Xác nhận brief trước'}">Xác nhận &amp; Chuyển Production →</button>`;
          })()}
        </div>
      </section>

      <section class="drawer-block ow-lc-comments" ${(!IS_LEAD_CONTENT && !o.lead_content_notes) ? 'hidden' : ''}>
        <div class="drawer-block-head"><span class="block-letter">C2</span><h4>Comment Lead Content</h4></div>
        <p class="ow-comment-help">Kênh comment nội bộ của Lead Content (chỉ hiển thị nội bộ — Client Portal không thấy).</p>
        ${o.lead_content_notes
          ? longText('Thread comment', o.lead_content_notes, { lines: 3, emptyText: 'Chưa có comment nào.' })
          : `<div class="lc-notes-view lc-notes-empty" id="lc-notes-view">Chưa có comment nào.</div>`}
        ${IS_LEAD_CONTENT ? `
        <textarea class="textarea" id="lc-comment-input" placeholder="Comment nội bộ cho Account/Admin (ghi danh Lead Content)…" style="min-height:80px; margin-top: var(--space-3)"></textarea>
        <div class="row" style="justify-content: flex-end; margin-top: var(--space-2)">
          <button class="btn btn-primary btn-sm" id="lc-send-comment">Gửi comment (Lead Content)</button>
        </div>` : ''}
      </section>

      <section class="drawer-block ow-push">
        <div class="drawer-block-head"><span class="block-letter">E</span><h4>Điều kiện tạo task</h4></div>
        ${buildPushCheck(o)}
      </section>

      <section class="drawer-block ow-tasks">
        <div class="drawer-block-head"><span class="block-letter">T</span><h4>Task liên quan</h4></div>
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

      <section class="drawer-block ow-delivery">
        <div class="drawer-block-head"><span class="block-letter">D</span><h4>${escapeHtml(dMeta.title)}</h4></div>
        ${['admin', 'account'].includes(user.role) ? `
        ${!o.final_delivery_link ? `
        <div class="edit-row">
          <label>Preview Link</label>
          <input class="input" id="dlv-preview-link" type="url" value="${escapeHtml(o.preview_link || '')}" placeholder="https://drive.google.com/preview..." />
        </div>
        <div class="row" style="justify-content:flex-end; margin:4px 0 12px">
          <button class="btn btn-secondary btn-sm" id="send-preview-btn">${escapeHtml(dMeta.previewBtn)}</button>
        </div>` : ''}
        <div class="edit-row">
          <label>Final Link</label>
          <input class="input" id="dlv-final-link" type="url" value="${escapeHtml(o.final_delivery_link || '')}" placeholder="https://drive.google.com/final..." ${o.final_delivery_link ? 'readonly' : ''} />
        </div>
        <div class="row" style="justify-content:flex-end; margin-top:4px">
          <button class="btn btn-primary btn-sm" id="send-final-btn" ${o.final_delivery_link ? 'disabled' : ''}>${escapeHtml(o.final_delivery_link ? dMeta.finalSentBtn : dMeta.finalBtn)}</button>
        </div>
        <p class="text-xs muted" style="margin:10px 0 0">${escapeHtml(o.final_delivery_link ? dMeta.helpFinal : dMeta.helpPreview)}</p>
        ${o.final_delivery_link && o.production_status !== 'completed' ? `
        <div class="row" style="justify-content:flex-end; margin-top:12px">
          <button class="btn btn-success btn-sm" id="close-order-btn">${escapeHtml(dMeta.closeLabel)}</button>
        </div>
        <p class="text-xs muted" style="margin:6px 0 0">${dMeta.closeHelp}</p>` : ''}
        ${o.production_status === 'completed' ? `<p class="text-xs" style="margin:12px 0 0;color:var(--success);font-weight:600">✓ ${escapeHtml(dMeta.completedText)}</p>` : ''}
        ` : `
        <dl>
          <dt>Preview Link</dt><dd>${linkBlock('', o.preview_link, 'Chưa có Preview.')}</dd>
          <dt>Final Link</dt><dd>${linkBlock('', o.final_delivery_link, 'Chưa có Final.')}</dd>
        </dl>
        `}
        ${buildRevisionPanel(o)}
        <div id="tt-links-mount" class="tt-links"></div>
        <dl style="margin-top:12px">
          <dt>Delivery Status</dt><dd>${o.delivery_status ? `<span class="tb-status s--${o.delivery_status}"><span class="dot"></span>${PROD_STATUS_LABEL[o.delivery_status] || o.delivery_status}</span>` : '<em class="muted">—</em>'}</dd>
          <dt>Delivery Date</dt><dd>${v(o.delivery_date)}</dd>
          ${dMeta.isInternalContent ? '' : `<dt>${escapeHtml(dMeta.ratingLabel)}</dt><dd>${o.satisfaction_score ? `<b style="color:var(--warning); font-size:var(--text-base)">★ ${o.satisfaction_score}/5</b>` : '<em class="muted">Chưa có rating</em>'}</dd>`}
        </dl>
        ${dMeta.isInternalContent ? '' : longText('Feedback của Client', o.client_feedback, { emptyText: 'Chưa có feedback.' })}
      </section>

      <section class="drawer-block ow-activity">
        <div class="drawer-block-head"><span class="block-letter">L</span><h4>Nhật ký xử lý</h4></div>
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
        params.set('task_type', currentOrder.request_type === 'media' ? 'shoot' : (currentOrder.request_type || 'design'));
        params.set('priority', currentOrder.priority || 'normal');
        if (currentOrder.internal_deadline) params.set('internal_deadline', currentOrder.internal_deadline);
        if (currentOrder.production_pic) params.set('production_pic', currentOrder.production_pic);
        if (currentOrder.content_brief) params.set('content', currentOrder.content_brief);
        if (currentOrder.shoot_location && ['media', 'photo', 'shoot'].includes(currentOrder.request_type)) {
          params.set('shoot_location', currentOrder.shoot_location);
        }
        location.href = 'production-board.html?' + params.toString();
      });
    }

    // Wire delivery hand-off (gửi Preview/Final link → update order + notify client)
    function sendDelivery(kind) {
      const isFinal = kind === 'final';
      const meta = deliveryTargetMeta(currentOrder);
      // Guard: Final chỉ gửi MỘT lần. Đã có final_delivery_link → chặn (tránh re-persist + re-notify
      // do bấm nhiều lần / double-click trước khi drawer re-render disable nút).
      if (isFinal && currentOrder.final_delivery_link && String(currentOrder.final_delivery_link).trim()) {
        window.MH.toast({ type: 'warning', title: 'Đã gửi Final', message: meta.alreadyFinalMsg });
        return;
      }
      const input = document.getElementById(isFinal ? 'dlv-final-link' : 'dlv-preview-link');
      const linkVal = input ? input.value.trim() : '';
      if (!linkVal) {
        window.MH.toast({ type: 'error', title: 'Thiếu link', message: `Nhập ${isFinal ? 'Final' : 'Preview'} Link trước khi gửi.` });
        return;
      }
      const today = new Date().toISOString().slice(0, 10); // date column 'YYYY-MM-DD'
      // Bàn giao ĐẦU TIÊN luôn là "Preview" (yêu cầu nghiệp vụ — không gọi Final/Draft/Demo).
      // Preview → mở vòng feedback (feedback_status=waiting_feedback). Final → approved.
      const localFields = isFinal
        // ⚠ feedback_status='approved' (KHÔNG dùng 'final_sent' — value đó KHÔNG có trong CHECK
        // orders_feedback_status_check → vi phạm constraint làm FAIL cả UPDATE, final_link không lưu →
        // client không nhận Final). 'approved' = "client duyệt / đã gửi Final" (đúng comment migration).
        // Lifecycle/isFinalDelivered nhận diện Final qua final_delivery_link + production_status='delivered'.
        ? { final_delivery_link: linkVal, delivery_status: 'final', production_status: 'delivered', progress: 95, delivery_date: today, feedback_status: 'approved' }
        : { preview_link: linkVal, delivery_status: 'client_wait', production_status: 'feedback_wait', delivery_date: today, feedback_status: 'waiting_feedback' };
      Object.assign(currentOrder, localFields, { last_updated: new Date().toISOString().slice(0, 16).replace('T', ' ') });
      persistOrder(currentOrder.order_id, Object.assign({}, localFields, { last_updated: new Date().toISOString() }));
      // Notify client — resolveNotifLink (client role) sẽ mở order drawer trong Client Portal.
      notifyClient(currentOrder, isFinal
        ? { type: 'delivery_final', title: 'Final đã sẵn sàng', message: `Yêu cầu ${currentOrder.order_id} đã được xử lý theo Feedback Vòng 3 và bàn giao bản Final. Anh/chị vui lòng kiểm tra sản phẩm hoàn thiện và gửi đánh giá. Nếu cần chỉnh sửa hoặc phát sinh thêm sau Final, vui lòng tạo một Order mới từ yêu cầu hiện tại.`, link: linkVal }
        : { type: 'delivery_preview', title: 'Sản phẩm Preview đã sẵn sàng', message: `Yêu cầu ${currentOrder.order_id} đã có bản Preview. Anh/chị vui lòng kiểm tra nội dung, bố cục, hình ảnh và gửi feedback trực tiếp trên hệ thống để team Media tiếp tục hoàn thiện.`, link: linkVal });
      // Khép kín: order nội bộ → báo PIC Content (chính) + Lead Content (giám sát).
      // notifyClient đã tự bỏ qua internal order nên client thật KHÔNG nhận gì.
      if (isInternalOrder(currentOrder)) notifyContentRequester(currentOrder, isFinal, linkVal);
      window.MH.toast({
        type: 'success',
        title: isFinal ? meta.sentFinalToast : meta.sentPreviewToast,
        message: meta.sentDetail
      });
      render();
      openDrawer(currentOrder);
    }
    // Đóng đơn → Hoàn thành. Dùng khi đã gửi Final mà client không đánh giá (rating tùy chọn,
    // không gate hoàn thành). Set production_status+delivery_status='completed'.
    function closeOrderCompleted(o) {
      if (!o) return;
      const meta = deliveryTargetMeta(o);
      if (o.production_status === 'completed') { window.MH.toast({ type: 'info', title: 'Đã hoàn thành', message: meta.completedText }); return; }
      if (!o.final_delivery_link) { window.MH.toast({ type: 'warning', title: 'Chưa gửi Final', message: meta.needFinalMsg }); return; }
      const nowIso = new Date().toISOString();
      o.production_status = 'completed';
      o.delivery_status = 'completed';
      o.last_updated = nowIso.slice(0, 16).replace('T', ' ');
      persistOrder(o.order_id, { production_status: 'completed', delivery_status: 'completed', last_updated: nowIso });
      window.MH.toast({ type: 'success', title: meta.closedToast, message: o.order_id + ' · ' + meta.closedDetail });
      render();
      openDrawer(o);
    }
    const sendPreviewBtn = document.getElementById('send-preview-btn');
    if (sendPreviewBtn) sendPreviewBtn.addEventListener('click', () => sendDelivery('preview'));
    const sendFinalBtn = document.getElementById('send-final-btn');
    if (sendFinalBtn) sendFinalBtn.addEventListener('click', () => sendDelivery('final'));
    // Đóng đơn — Hoàn thành (lưới an toàn khi client KHÔNG đánh giá; rating là tùy chọn).
    const closeOrderBtn = document.getElementById('close-order-btn');
    if (closeOrderBtn) closeOrderBtn.addEventListener('click', () => closeOrderCompleted(currentOrder));

    // Gửi feedback hiện tại cho PIC xử lý (revision panel).
    const sendFbPicBtn = document.getElementById('btn-send-feedback-pic');
    if (sendFbPicBtn) sendFbPicBtn.addEventListener('click', onRevisionSendToPic);
    // Async load "Links from Task Tracker" vào order drawer.
    drawerLinkedTasks = null;
    loadTaskLinksIntoDrawer(o.order_id);

    // (Đã gỡ "Tạo task mới từ feedback này" — Feedback Vòng 3 vẫn thuộc order hiện tại:
    //  xử lý Round 3 → PIC cập nhật Final → Account gửi Final → Client tự tạo Order mới nếu cần.)

    // Đọc giá trị form Điều phối → ghi vào currentOrder + write-through Supabase.
    // Dùng chung cho nút "Lưu điều phối" và nút "Xác nhận & Chuyển Production".
    // Sau khi push (isPushed) các select PIC bị disable → giữ nguyên giá trị cũ, không ghi đè.
    function applyCoordination() {
      const isMedia = currentOrder.request_type === 'media';
      const newStatus = document.getElementById('edit-account-status').value;
      // PIC select value = user_id (Stage 2). Ghi CẢ id (khóa) LẪN tên snapshot (hiển thị legacy).
      // Select disable (đã push) → giữ id+tên hiện tại của order, không đọc DOM.
      const readPic = (el, curId, curName) => {
        // value = id (user thật) | "name:<tên>" (legacy chưa backfill) | "" (bỏ gán). picPick giải mã
        // → giữ tên legacy, KHÔNG xóa mất assignment khi Save nếu PIC chưa liên kết id.
        if (el && !el.disabled) { return window.MH.picPick(el.value || ''); }
        return { id: curId || null, name: curName || null };
      };
      const acctPic = readPic(document.getElementById('edit-account-pic'), currentOrder.account_pic_user_id, currentOrder.account_pic);
      const prod = readPic(document.getElementById('edit-prod-pic'), currentOrder.production_pic_user_id, currentOrder.production_pic);
      const prodV = isMedia ? readPic(document.getElementById('edit-prod-pic-video'), currentOrder.production_pic_video_user_id, currentOrder.production_pic_video)
        : { id: currentOrder.production_pic_video_user_id || null, name: currentOrder.production_pic_video || null };
      const prodP = isMedia ? readPic(document.getElementById('edit-prod-pic-photo'), currentOrder.production_pic_photo_user_id, currentOrder.production_pic_photo)
        : { id: currentOrder.production_pic_photo_user_id || null, name: currentOrder.production_pic_photo || null };
      const newAcctPic = acctPic.name, newProdPic = prod.name, newProdPicVideo = prodV.name, newProdPicPhoto = prodP.name;
      const newPriority = document.getElementById('edit-priority').value;
      const newDeadline = document.getElementById('edit-internal-deadline').value.replace('T', ' ');
      // Production Status giờ TASK-DRIVEN (select disabled) → KHÔNG đọc form, giữ giá trị order hiện tại.
      // Tránh ghi đè trạng thái đã auto-sync từ Task Tracker khi Account bấm Lưu.
      const elProdStatus = document.getElementById('edit-prod-status');
      const newProdStatus = (elProdStatus && !elProdStatus.disabled) ? elProdStatus.value : (currentOrder.production_status || 'unassigned');
      const newNote = document.getElementById('edit-internal-note').value;
      // Sync progress theo production_status (đổi status → progress khớp). Status không đổi → giữ progress order.
      const newProgress = (newProdStatus !== currentOrder.production_status && PROD_PROGRESS[newProdStatus] != null)
        ? PROD_PROGRESS[newProdStatus] : currentOrder.progress;

      Object.assign(currentOrder, {
        account_status: newStatus,
        account_pic: newAcctPic, account_pic_user_id: acctPic.id,
        production_pic: newProdPic, production_pic_user_id: prod.id,
        production_pic_video: newProdPicVideo, production_pic_video_user_id: prodV.id,
        production_pic_photo: newProdPicPhoto, production_pic_photo_user_id: prodP.id,
        priority: newPriority,
        internal_deadline: newDeadline || null,
        production_status: newProdStatus,
        progress: newProgress,
        internal_note: newNote,
        last_updated: new Date().toISOString().slice(0, 16).replace('T', ' ')
      });
      // Phase 1: write-through Supabase
      const patch = {
        account_status: newStatus,
        account_pic: newAcctPic, account_pic_user_id: acctPic.id,
        production_pic: newProdPic, production_pic_user_id: prod.id,
        priority: newPriority,
        internal_deadline: newDeadline ? new Date(newDeadline.replace(' ', 'T')).toISOString() : null,
        production_status: newProdStatus,
        progress: newProgress,
        internal_note: newNote,
        last_updated: new Date().toISOString()
      };
      // 2 PIC cho media — cần cột production_pic_video/photo (chạy supabase/add-media-pics.sql)
      if (isMedia) {
        patch.production_pic_video = newProdPicVideo; patch.production_pic_video_user_id = prodV.id;
        patch.production_pic_photo = newProdPicPhoto; patch.production_pic_photo_user_id = prodP.id;
      }
      persistOrder(currentOrder.order_id, patch);
      // Cảnh báo (không block): internal_deadline trễ hơn deadline đã thống nhất với Client.
      if (internalPastEffective(currentOrder)) {
        window.MH.toast({ type: 'warning', title: 'Internal Deadline trễ hơn deadline Client', message: 'Internal Deadline đang trễ hơn deadline đã thống nhất với Client. Vui lòng điều chỉnh.' });
      }
    }

    // Wire save button — chỉ lưu, không push.
    document.getElementById('save-internal').addEventListener('click', () => {
      applyCoordination();
      window.MH.toast({ type: 'success', title: 'Đã lưu', message: 'Cập nhật Internal Management cho ' + currentOrder.order_id });
      render();
      openDrawer(currentOrder); // refresh drawer view
    });

    // Wire "Xác nhận & Chuyển Production" — lưu điều phối rồi push.
    // pushToProduction tự validate (thiếu PIC/deadline → toast) + render + openDrawer.
    const confirmProdBtn = document.getElementById('confirm-coordination');
    if (confirmProdBtn) confirmProdBtn.addEventListener('click', () => {
      applyCoordination();
      pushToProduction(currentOrder);
    });

    // Phase 4 — wire "Gửi Client xác nhận Brief" (nằm trong Brief Wording Workflow block).
    const sendWordingBtn = document.getElementById('act-send-wording-client');
    if (sendWordingBtn) sendWordingBtn.addEventListener('click', () => sendWordingToClient(currentOrder));

    // Wire "Lưu hạn" — Account đặt/sửa Hạn hoàn thành wording.
    const saveDlBtn = document.getElementById('act-save-wording-deadline');
    if (saveDlBtn) saveDlBtn.addEventListener('click', () => saveWordingDeadline(currentOrder));

    // Update stepper state theo account_status + production_status
    updateStepperState(o);

    // Wire nút "Gửi comment (Lead Content)" (chỉ render khi IS_LEAD_CONTENT).
    const lcBtn = document.getElementById('lc-send-comment');
    if (lcBtn) lcBtn.addEventListener('click', () => sendLeadContentComment(o));

    // Wire "Gửi Client xác nhận deadline mới" (Deadline thương lượng — admin/account/lead_media).
    const dlBtn = document.getElementById('dl-propose-send');
    if (dlBtn) dlBtn.addEventListener('click', () => sendDeadlineProposal(currentOrder));

    // Custom dropdown PIC (tên + badge role). Trigger là div nên applyDrawerReadonly không ẩn nhầm.
    if (window.MH && window.MH.enhancePicSelects) window.MH.enhancePicSelects(drawerBody);

    // Read-only monitor: khóa toàn bộ input + ẩn mọi nút mutation trong drawer (giữ link điều hướng <a>).
    if (READONLY) applyDrawerReadonly();

    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerBd.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  /* Read-only (system_supervisor + lead_content): khóa mọi control trong order drawer.
     Disable input/select/textarea + ẩn mọi <button> (trừ nút đóng). Link <a> giữ để điều hướng.
     NGOẠI LỆ duy nhất cho lead_content: ô comment + nút gửi comment (kênh Lead Content). */
  const RO_KEEP_IDS = ['drawer-close', 'lc-comment-input', 'lc-send-comment'];
  function applyDrawerReadonly() {
    const root = document.getElementById('order-drawer');
    if (!root) return;
    root.querySelectorAll('input, select, textarea').forEach((el) => {
      if (RO_KEEP_IDS.includes(el.id)) return;
      el.disabled = true;
    });
    root.querySelectorAll('button').forEach((b) => {
      if (RO_KEEP_IDS.includes(b.id)) return;
      b.style.display = 'none';
    });
  }

  /* Lead Content gửi comment nội bộ — đường ghi DUY NHẤT: RPC
     append_lead_content_order_note (SECURITY DEFINER, chỉ append text,
     không đụng cột nghiệp vụ). Fallback demo (Supabase off): mutate mock. */
  let lcSending = false;
  async function sendLeadContentComment(o) {
    if (lcSending) return;
    const input = document.getElementById('lc-comment-input');
    const btn = document.getElementById('lc-send-comment');
    const text = (input && input.value.trim()) || '';
    if (!text) { window.MH.toast({ type: 'warning', title: 'Comment rỗng', message: 'Nhập nội dung trước khi gửi.' }); return; }
    lcSending = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi…'; }
    try {
      let updatedNotes;
      if (window.MH.supabaseEnabled) {
        await window.MH.supabaseReady;
        const { data, error } = await window.MH.supabase.rpc('append_lead_content_order_note', {
          p_order_id: o.order_id, p_text: text
        });
        if (error) throw error;
        updatedNotes = data && data.lead_content_notes;
      } else {
        // Demo/offline: append trực tiếp vào mock (cùng format với RPC).
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const line = `[${stamp} · ${user.name || 'Lead Content'} · Lead Content] ${text}`;
        updatedNotes = (o.lead_content_notes ? o.lead_content_notes + '\n\n' : '') + line;
        await window.MH.store.orders.update(o.order_id, { lead_content_notes: updatedNotes });
      }
      o.lead_content_notes = updatedNotes || o.lead_content_notes;
      // Thread comment nay render bằng LongTextBlock (2026-07-31) → cập nhật vào
      // `.drawer-longtext__body` trong chính section này. Giữ fallback #lc-notes-view
      // cho nhánh chưa có comment nào (lúc đó vẫn là div cũ).
      const sectionEl = document.querySelector('#order-drawer .ow-lc-comments');
      const ltBody = sectionEl && sectionEl.querySelector('.drawer-longtext__body');
      if (ltBody) {
        ltBody.textContent = o.lead_content_notes || '';
        const meta = sectionEl.querySelector('.drawer-longtext__meta');
        if (meta) meta.textContent = String(o.lead_content_notes || '').length + ' ký tự';
      } else {
        const view = document.getElementById('lc-notes-view');
        if (view) { view.textContent = o.lead_content_notes || ''; view.classList.remove('lc-notes-empty'); }
      }
      if (input) input.value = '';
      window.MH.toast({ type: 'success', title: 'Đã gửi comment', message: 'Account/Admin sẽ thấy trong Order Drawer.' });
      // Báo Admin + Account có comment mới (type 'system' — nằm trong CHECK notifications).
      try {
        const usersList = await window.MH.store.users.list();
        const targets = (usersList || []).filter((u) => u && u.id && (u.role === 'admin' || u.role === 'account'));
        for (const t of targets) {
          await window.MH.store.notifications.create({
            user_id: t.id, type: 'system',
            title: 'Lead Content comment trên order ' + o.order_id,
            message: text.slice(0, 140),
            link: 'database-orders.html?id=' + o.order_id,
            related_entity_type: 'orders', related_entity_id: o.order_id
          });
        }
      } catch (e) { console.warn('[lc-comment] notify lỗi:', e); }
    } catch (err) {
      console.error('[lc-comment] gửi lỗi:', err);
      window.MH.toast({ type: 'error', title: 'Không gửi được comment', message: String(err && err.message || err).slice(0, 200) + ' — đã chạy supabase/add-lead-content-order-view.sql chưa?' });
    } finally {
      lcSending = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Gửi comment (Lead Content)'; }
    }
  }

  /* ---------- Drawer state update ----------
     Stepper UI lớn đã bỏ — function này giờ chỉ:
       1. Toggle visibility của push-status message (chỉ hiện khi đã push).
       2. Enable/disable các action button theo account_status + production_status. */
  function updateStepperState(o) {
    if (!o) return;
    // Read-only monitor: ẩn hết Quick Actions + Hủy đơn, không enable nút nào.
    if (READONLY) {
      ['#order-drawer .wf-actions-flow', '#order-drawer .wf-actions-danger', '#order-drawer .drawer-actions']
        .forEach((sel) => { const el = document.querySelector(sel); if (el) el.style.display = 'none'; });
      const h = document.getElementById('wf-hint'); if (h) { h.hidden = true; h.innerHTML = ''; }
      return;
    }
    const hint   = document.getElementById('wf-hint');
    const flow   = document.querySelector('#order-drawer .wf-actions-flow');
    const danger = document.querySelector('#order-drawer .wf-actions-danger');
    const btnCheck   = document.getElementById('act-checking');
    const btnNeed    = document.getElementById('act-needinfo');
    const btnWording = document.getElementById('act-wording');
    const btnConfirm = document.getElementById('act-confirm');
    const btnPush    = document.getElementById('act-push');
    const btnCancel  = document.getElementById('act-cancel');
    const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };

    // Thông tin "đã push" giờ nằm ở Linked Task card trong body → ẩn dòng wf-hint cũ (tránh trùng status).
    if (hint) { hint.hidden = true; hint.innerHTML = ''; }

    const isCancelled = o.account_status === 'rejected' || o.production_status === 'cancelled';
    const isPushed    = !!o.production_status && o.production_status !== 'unassigned' && !isCancelled;
    const isConfirmed = o.account_status === 'confirmed';
    const completed   = o.production_status === 'completed';
    const rated       = typeof o.satisfaction_score === 'number' && o.satisfaction_score > 0;
    const hasPreview  = !!o.preview_link;
    const hasFinal    = !!o.final_delivery_link;

    // Quick Actions theo lifecycle stage (contextual show/hide — không chỉ disable):
    //  - Brief (chưa confirm/push): Kiểm tra brief · Yêu cầu bổ sung · Xác nhận brief.
    //  - Brief đã confirm, chưa push: Push → Production.
    //  - Đã push / có Preview / có Final / hoàn tất: ẩn hết nút brief & push
    //    (action giai đoạn sau nằm trong body: Bàn giao Preview/Final, Gửi feedback cho PIC, Xem task).
    const briefStage = !isCancelled && !isConfirmed && !isPushed && !hasPreview && !hasFinal;
    const pushStage  = !isCancelled && isConfirmed && !isPushed && !hasPreview && !hasFinal;

    [btnCheck, btnNeed, btnWording, btnConfirm, btnPush, btnCancel].forEach((b) => { if (b) b.disabled = false; });
    // Media Order KHÔNG đi Content Wording (2026-07-31) → ẩn hẳn nút chuyển wording.
    const wordingFlow = !isMediaOrder(o);
    show(btnCheck,   briefStage);
    show(btnNeed,    briefStage);
    show(btnWording, briefStage && wordingFlow);
    show(btnConfirm, briefStage);
    show(btnPush,    pushStage);

    // Phase 2 — cổng Content Wording:
    if (briefStage) {
      const ws = wordingStatusOf(o);
      const approved = isWordingApproved(o);
      // 'pending' chưa kiểm tra → chưa cho Bổ sung / Chuyển Wording / Xác nhận.
      if (o.account_status === 'pending') {
        if (btnNeed) btnNeed.disabled = true;
        if (btnWording) btnWording.disabled = true;
        if (btnConfirm) btnConfirm.disabled = true;
      }
      // Đã chuyển Content Wording rồi (status khác 'none') → khóa nút "Chuyển Content Wording".
      if (btnWording && ws !== 'none') btnWording.disabled = true;
      // Rule 1 — Confirm Brief bị khóa tới khi Content Wording được Client xác nhận.
      // CHỈ áp cho luồng cần wording; Media confirm brief bình thường (cổng logistics ở bước Push).
      if (btnConfirm && wordingGateApplies(o) && !approved) btnConfirm.disabled = true;
    }

    // Hủy đơn = "Hành động khác", tách riêng; ẩn khi đã hủy / hoàn thành / đã đánh giá.
    const canCancel = !isCancelled && !completed && !rated;
    show(btnCancel, canCancel);

    // Ẩn container rỗng để không còn khung/khoảng trắng thừa ở đầu drawer.
    show(flow, briefStage || pushStage);
    // Hủy đơn giờ ở footer dưới cùng drawer (tách khỏi .drawer-actions trên cùng).
    show(danger, canCancel);
    show(document.querySelector('#order-drawer .drawer-actions'), briefStage || pushStage);
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
  document.getElementById('act-wording').addEventListener('click', () => transferToWording(currentOrder));
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
  function isInternalOrder(order) {
    return !!(order && (order.order_kind === 'internal_media_request' || order.order_kind === 'internal_ads_media_request' || order.origin === 'content_team' || order.origin === 'ads_order' || order.client_visible === false || order.source_content_task_id || order.source_ads_order_id));
  }
  // Badge NEW: order client = chờ Account xác nhận (pending); order NỘI BỘ auto-confirmed (Option A)
  // → "new" cho tới khi Lead Media/Account push Production (production_status còn unassigned/null).
  function isNewOrder(o) {
    if (!o) return false;
    if (isInternalOrder(o)) return (!o.production_status || o.production_status === 'unassigned') && o.account_status !== 'rejected';
    return o.account_status === 'pending';
  }
  async function notifyClient(order, notifPayload) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return false;
    if (!order) return false;
    // Order NỘI BỘ từ Content Team không có "client" thật — không bắn noti văn phong client.
    // (Content nhận noti riêng qua notifyContentRequester, deep-link về content task.)
    if (isInternalOrder(order)) return false;
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

  /* ---------- KHÉP KÍN loop Content↔Production: báo Content khi Media bàn giao ----------
     Order nội bộ → báo Lead Content (role) khi gửi Preview/Final, deep-link content task drawer.
     Chỉ insert notifications (quyền staff) — Content tự thấy link Preview/Final qua block tracking
     (fillMediaTrack đọc order). related_entity_type='orders' (CHECK constraint). */
  async function notifyContentRequester(order, isFinal, linkVal) {
    if (!window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return false;
    if (!order || !(order.source_content_task_id || order.source_ads_order_id)) return false;

    const type = isFinal ? 'delivery_final' : 'delivery_preview';
    const title = isFinal ? 'Media đã bàn giao Final' : 'Media đã gửi Preview';

    /* ---- Nhánh Ads: giữ NGUYÊN hành vi cũ (chỉ Lead Content, deep-link Ads Orders).
           Flow Ads chưa chốt → không đụng. ---- */
    if (!order.source_content_task_id) {
      try {
        const { error } = await window.MH.supabase.rpc('notify_roles', {
          p_roles: ['lead_content'], p_type: type, p_title: title,
          p_message: order.order_id + ' · ' + (order.project_name || '') + ' — đơn nội bộ Media ' + (isFinal ? 'đã bàn giao Final' : 'đã có Preview') + '. Mở để xem.',
          p_link: 'content-team.html?tab=ads-orders&id=' + order.source_ads_order_id,
          p_entity_type: 'orders', p_entity_id: order.order_id
        });
        if (error) { console.warn('[delivery] notify_roles (ads) error:', error); return false; }
        return true;
      } catch (e) { console.warn('[delivery] notify lead_content (ads) failed:', e); return false; }
    }

    /* ---- Nhánh Content: người nhận CHÍNH là PIC Content của task gốc; Lead Content chỉ CC.
           Trước 2026-08-03 chỉ notify role lead_content ⇒ PIC Content — người phải xử lý
           tiếp task — KHÔNG hề biết Media đã bàn giao. ---- */
    const taskId = order.source_content_task_id;
    const link = 'content-team.html?task=' + encodeURIComponent(taskId);
    const message = order.order_id + ' · ' + (order.project_name || '')
      + ' — Media đã ' + (isFinal ? 'bàn giao Final' : 'gửi Preview')
      + ' cho yêu cầu nội bộ từ Content. Mở Content Task để kiểm tra link.';

    let primaryNotified = false;
    let task = null;
    try {
      const { data, error } = await window.MH.supabase
        .from('content_tasks')
        .select('id, assigned_pic_user_id, created_by_user_id, assigned_pic, title')
        .eq('id', taskId).maybeSingle();
      if (error) console.warn('[delivery] load source content task failed:', error);
      task = data;
    } catch (e) { console.warn('[delivery] load source content task threw:', e); }

    /* ⚠ 2026-08-03: PHẢI kiểm `status` người nhận. Insert notification cho user đã bị
       Deactivate (status='suspended') vẫn THÀNH CÔNG ở DB — RLS chỉ kiểm role NGƯỜI GỬI —
       nên trước đó code báo "đã gửi" trong khi thư rơi vào hộp không ai mở. Chọn người
       nhận đầu tiên CÒN HOẠT ĐỘNG theo thứ tự: PIC được gán → người tạo task. */
    const candidates = [];
    if (task && task.assigned_pic_user_id) candidates.push({ id: task.assigned_pic_user_id, why: 'PIC được gán' });
    if (task && task.created_by_user_id && task.created_by_user_id !== task.assigned_pic_user_id) {
      candidates.push({ id: task.created_by_user_id, why: 'người tạo task' });
    }
    let primaryUserId = null;
    let inactiveHit = null;
    if (candidates.length) {
      let statusById = {};
      try {
        const { data: us } = await window.MH.supabase
          .from('users').select('id, name, email, status').in('id', candidates.map((c) => c.id));
        (us || []).forEach((u) => { statusById[u.id] = u; });
      } catch (e) { console.warn('[delivery] load recipient status failed:', e); statusById = null; }
      for (const c of candidates) {
        const u = statusById ? statusById[c.id] : null;
        // Không đọc được bảng users (RLS/lỗi mạng) → vẫn gửi, tốt hơn là im lặng bỏ qua.
        const active = !statusById || !u || (window.MH.isActiveUser ? window.MH.isActiveUser(u) : true);
        if (active) { primaryUserId = c.id; break; }
        if (!inactiveHit) inactiveHit = { who: (u && (u.name || u.email)) || c.why, status: u && u.status, why: c.why };
      }
    }
    if (primaryUserId && window.MH.store && window.MH.store.notifications) {
      try {
        await window.MH.store.notifications.create({
          user_id: primaryUserId, type: type, title: title, message: message, link: link,
          related_entity_type: 'orders', related_entity_id: order.order_id
        });
        primaryNotified = true;
      } catch (e) { console.warn('[delivery] notify primary Content PIC failed:', e); }
    }

    let leadNotified = false;
    try {
      const { error } = await window.MH.supabase.rpc('notify_roles', {
        p_roles: ['lead_content'], p_type: type, p_title: title, p_message: message,
        p_link: link, p_entity_type: 'orders', p_entity_id: order.order_id
      });
      if (error) console.warn('[delivery] notify_roles lead_content error:', error);
      else leadNotified = true;
    } catch (e) { console.warn('[delivery] notify lead_content failed:', e); }

    // KHÔNG fail im lặng — người gửi phải biết ai đã/chưa nhận được.
    if (!primaryNotified && !leadNotified) {
      window.MH.toast({
        type: 'warning', title: 'Đã lưu link nhưng chưa báo được Content',
        message: 'Không gửi được notification cho PIC Content/Lead Content. Kiểm tra RLS hoặc RPC notify_roles.'
      });
      return false;
    }
    if (!primaryNotified) {
      window.MH.toast({
        type: 'warning',
        title: 'Đã báo Lead Content, chưa báo được PIC Content',
        message: inactiveHit
          // Ca thường gặp nhất: PIC đã bị Deactivate trong User Management.
          ? ('PIC Content của task (' + (inactiveHit.who || '—') + ') đang ở trạng thái "' + (inactiveHit.status || 'không hoạt động') + '" nên không nhận được thông báo. Lead Content cần gán lại PIC cho Content Task này.')
          : 'Không xác định được assigned_pic_user_id/created_by_user_id của Content Task gốc.',
        duration: 7000
      });
    }
    return true;
  }

  function updateStatus(o, newStatus, msg) {
    if (!o) return;
    // Phase 2 Rule 1 — hard gate: không cho Confirm Brief khi Content Wording chưa được Client xác nhận.
    // 2026-07-31: gate CHỈ áp cho luồng cần wording (design/digital/slide). Media
    // (quay/chụp/video) có cổng riêng là logistics — kiểm ở bước Push, không chặn Confirm.
    if (newStatus === 'confirmed' && wordingGateApplies(o) && !isWordingApproved(o)) {
      window.MH.toast({ type: 'warning', title: 'Chưa thể Confirm Brief', message: 'Order cần hoàn tất Content Wording và được Client xác nhận trước khi Confirm Brief.' });
      return;
    }
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

  // Phase 2 — Account chuyển order sang Content Wording (cổng bắt buộc trước Confirm Brief).
  // account_status='wording', brief_wording_status='assigned', round=1 nếu đang 0.
  async function transferToWording(o) {
    if (!o) return;
    if (o.account_status === 'rejected' || o.production_status === 'cancelled') {
      window.MH.toast({ type: 'warning', title: 'Order đã hủy', message: 'Không thể chuyển Content Wording cho order đã hủy.' }); return;
    }
    const ws = wordingStatusOf(o);
    if (isWordingApproved(o)) { window.MH.toast({ type: 'info', title: 'Wording đã hoàn tất', message: 'Content Wording của order này đã được Client xác nhận.' }); return; }
    if (ws !== 'none') { window.MH.toast({ type: 'info', title: 'Đang Content Wording', message: 'Order đã được chuyển Content Wording (' + (WORDING_STATUS_LABEL[ws] || ws) + ').' }); return; }
    const nowIso = new Date().toISOString();
    const round = (o.brief_wording_round || 0) === 0 ? 1 : o.brief_wording_round;
    const patch = {
      account_status: 'wording',
      brief_wording_status: 'assigned',
      brief_wording_round: round,
      wording_last_updated_at: nowIso,
      last_updated: nowIso
    };
    // Kèm "Hạn hoàn thành wording" nếu Account đã nhập ô deadline trong block.
    const dlEl = document.getElementById('ow-wording-deadline');
    if (dlEl && dlEl.value) patch.wording_deadline = new Date(dlEl.value).toISOString();

    // GHI DB TRƯỚC + XÁC NHẬN row đã đổi rồi mới notify — tránh noti "ma" (Lead nhận
    // thông báo nhưng Content Inbox rỗng) khi update KHÔNG land: lỗi CHECK/thiếu migration
    // (23514), hoặc RLS khớp 0 dòng (update trả về null KHÔNG kèm error → im lặng).
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      let saved = null;
      try { saved = await window.MH.store.orders.update(o.order_id, patch); }
      catch (err) {
        console.warn('[database-orders] transferToWording persist failed:', err);
        window.MH.toast({ type: 'danger', title: 'Chuyển Content Wording THẤT BẠI', message: 'Không ghi được trạng thái vào hệ thống — kiểm tra đã chạy add-brief-wording-fields.sql + add-content-team.sql (giá trị account_status="wording"/brief_wording_status="assigned") và quyền RLS. CHƯA gửi cho Content.' });
        return;
      }
      if (!saved || saved.brief_wording_status !== 'assigned' || saved.account_status !== 'wording') {
        console.warn('[database-orders] transferToWording: update matched 0 rows / RLS blocked', { orderId: o.order_id, saved: saved });
        window.MH.toast({ type: 'danger', title: 'Chuyển Content Wording KHÔNG lưu', message: 'Hệ thống không cập nhật được trạng thái đơn (có thể do quyền RLS hoặc đơn không tồn tại). Content Inbox sẽ KHÔNG thấy đơn — CHƯA gửi thông báo cho Content.' });
        return;
      }
      Object.assign(o, saved); // đồng bộ đúng row DB đã lưu
    } else {
      Object.assign(o, patch);
      o.last_updated = nowIso.slice(0, 16).replace('T', ' ');
    }
    notifyContentWording(o); // chỉ báo team Content khi trạng thái ĐÃ lưu thật
    window.MH.toast({ type: 'success', title: 'Đã chuyển Content Wording', message: o.order_id + (o.wording_deadline ? ' · Hạn wording ' + fmtDateTime(o.wording_deadline) : '') + ' — chờ Content xử lý & Client xác nhận brief wording.' });
    render(); openDrawer(o);
  }

  // Notify team Content khi Account chuyển order sang Content Wording.
  // Content Team flow: ƯU TIÊN Lead Content (nhận request ở Content Inbox, gán PIC);
  // chưa có user lead_content → fallback notify mọi content user (flow cũ).
  // Pattern giống order-form.js notify staff: bulk INSERT notifications (fire-and-forget).
  // Dùng type 'task_assigned' (đã có trong CHECK constraint) + link content-team.html
  // (resolveNotifLink ưu tiên field link nên mở đúng Content Team Workspace).
  async function notifyContentWording(o) {
    if (!o || !window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    try {
      let { data: leads } = await window.MH.supabase
        .from('users').select('id, name')
        .eq('role', 'lead_content').eq('status', 'active');
      let title = '📥 Order mới trong Content Inbox';
      let link = 'content-team.html?id=' + (o.order_id || ''); // lead → Workspace
      if (!Array.isArray(leads) || !leads.length) {
        const r = await window.MH.supabase
          .from('users').select('id, name')
          .eq('role', 'content').eq('status', 'active');
        leads = r.data; title = '📝 Order cần Content Wording';
        link = 'content-workbench.html?id=' + (o.order_id || ''); // fallback content → Wording
      }
      if (Array.isArray(leads) && leads.length) {
        const payloads = leads.map(function (u) {
          return {
            user_id: u.id,
            type: 'task_assigned',
            title: title,
            message: (o.order_id || '') + ' · ' + (o.project_name || 'Untitled') + (o.wording_deadline ? ' · Hạn wording: ' + fmtDateTime(o.wording_deadline) : ''),
            link: link,
            related_entity_type: 'orders',
            related_entity_id: o.order_id
          };
        });
        await window.MH.supabase.from('notifications').insert(payloads);
      }
    } catch (e) { console.warn('[db-orders] notify content wording failed:', e); }
  }

  // Account đặt/sửa "Hạn hoàn thành wording" (đặt nhanh, không cần chuyển lại).
  function saveWordingDeadline(o) {
    if (!o) return;
    if (o.account_status === 'rejected' || o.production_status === 'cancelled') {
      window.MH.toast({ type: 'warning', title: 'Order đã hủy', message: 'Không thể đặt hạn wording cho order đã hủy.' }); return;
    }
    const dlEl = document.getElementById('ow-wording-deadline');
    const iso = (dlEl && dlEl.value) ? new Date(dlEl.value).toISOString() : null;
    o.wording_deadline = iso;
    persistOrder(o.order_id, { wording_deadline: iso });
    window.MH.toast({ type: 'success', title: 'Đã lưu hạn wording', message: o.order_id + (iso ? ' · ' + fmtDateTime(iso) : ' · đã xóa hạn') });
    openDrawer(o);
  }

  // Phase 4 — Account gửi bản wording cho Client xác nhận.
  function sendWordingToClient(o) {
    if (!o) return;
    if (o.account_status === 'rejected' || o.production_status === 'cancelled') {
      window.MH.toast({ type: 'warning', title: 'Order đã hủy', message: 'Không thể gửi Client cho order đã hủy.' }); return;
    }
    const ws = wordingStatusOf(o);
    if (ws !== 'submitted_to_account') {
      window.MH.toast({ type: 'info', title: 'Chưa thể gửi', message: 'Chỉ gửi Client khi Content đã submit bản wording (Chờ Account duyệt).' }); return;
    }
    if (!(o.wording_brief && String(o.wording_brief).trim())) {
      window.MH.toast({ type: 'warning', title: 'Thiếu nội dung', message: 'Bản wording (Brief đã wording) đang trống — không thể gửi Client.' }); return;
    }
    const nowIso = new Date().toISOString();
    const by = (user && (user.name || user.email)) || 'Account';
    o.brief_wording_status = 'sent_to_client';
    o.wording_client_sent_at = nowIso;
    o.wording_client_sent_by = by;
    o.wording_last_updated_at = nowIso;
    o.last_updated = nowIso.slice(0, 16).replace('T', ' ');
    persistOrder(o.order_id, {
      brief_wording_status: 'sent_to_client',
      wording_client_sent_at: nowIso,
      wording_client_sent_by: by,
      wording_last_updated_at: nowIso,
      last_updated: nowIso
    });
    // Notify Client của order (fire-and-forget) — dùng helper notifyClient (requester_id/email fallback).
    notifyClient(o, {
      // type base-CHECK-safe (không phụ thuộc add-revision-rounds/brief-wording-confirmation đã chạy chưa).
      type: 'order_status_changed',
      title: 'Brief đã được chuẩn hóa — chờ anh/chị xác nhận',
      message: `Yêu cầu ${o.order_id}${o.project_name ? ' · ' + o.project_name : ''} đã được chuẩn hóa nội dung. Vui lòng mở chi tiết để xác nhận hoặc yêu cầu chỉnh brief.`,
      link: 'client-dashboard.html?id=' + o.order_id
    });
    window.MH.toast({ type: 'success', title: 'Đã gửi Client', message: o.order_id + ' — chờ Client xác nhận brief wording.' });
    render(); openDrawer(o);
  }

  async function pushToProduction(o) {
    if (!o) return;
    const isMedia = o.request_type === 'media';
    const mediaRoute = isMediaOrder(o); // media/shoot/photo/video (không phải ads)
    const hasPic = mediaRoute
      ? (!!o.production_pic_video || !!o.production_pic_photo || !!o.production_pic_editor || !!o.production_pic)
      : (isMedia ? (!!o.production_pic_video || !!o.production_pic_photo) : !!o.production_pic);
    const checks = {
      // Media: cổng là LOGISTICS (+ script approved nếu có script), KHÔNG phải wording.
      wording: mediaRoute ? true : (wordingGateApplies(o) ? isWordingApproved(o) : true),
      brief: o.account_status === 'confirmed',
      pic: hasPic,
      deadline: !!o.internal_deadline,
      notCancelled: o.production_status !== 'cancelled' && o.account_status !== 'rejected',
      deliverable: o.request_type === 'media' ? true : (o.deliverable_type && o.deliverable_type.length > 0)
    };
    const missing = [];
    if (!checks.wording) missing.push('Content Wording được Client xác nhận');
    if (mediaRoute) mediaLogisticsMissing(o).forEach((m) => missing.push(m));
    if (!checks.brief) missing.push('xác nhận brief');
    if (!checks.pic) missing.push(mediaRoute ? 'gán ít nhất 1 PIC Media' : 'gán P.I.C');
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

    // Plan task: media → tách 2 task (Quay/Chụp) theo PIC đã gán; còn lại 1 task.
    const deliverables = o.deliverable_type || [];
    const isQuayItem = (d) => /^quay/i.test(String(d).trim());
    let plan;
    if (isMedia) {
      plan = [];
      if (o.production_pic_video) plan.push({ pic: o.production_pic_video, taskType: 'shoot', label: 'Quay', items: deliverables.filter(isQuayItem) });
      if (o.production_pic_photo) plan.push({ pic: o.production_pic_photo, taskType: 'photo', label: 'Chụp', items: deliverables.filter((d) => !isQuayItem(d)) });
      // PIC dựng/hậu kỳ (add-media-operations.sql) → task Edit riêng, sau buổi quay.
      if (o.production_pic_editor) plan.push({ pic: o.production_pic_editor, taskType: 'edit', label: 'Dựng / Hậu kỳ', items: [] });
    } else {
      plan = [{ pic: o.production_pic, taskType: o.request_type || 'design', label: '', items: deliverables }];
    }

    const deadlineISO = o.internal_deadline ? (typeof o.internal_deadline === 'string' ? new Date(o.internal_deadline.replace(' ', 'T')).toISOString() : new Date(o.internal_deadline).toISOString()) : null;
    const createdTaskIds = [];

    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try {
        for (const part of plan) {
          const taskId = await generateNextTaskId();
          const taskPayload = {
            task_id: taskId,
            order_id: o.order_id,
            is_standalone: false,
            project_name: (o.project_name || 'Untitled') + (part.label ? ' — ' + part.label : ''),
            task_type: part.taskType,
            content: o.content_brief || '',
            priority: o.priority || 'normal',
            assigned_to: part.pic,
            status: 'received',
            progress: 20,
            internal_deadline: deadlineISO,
            link_drive: o.source_link || '',
            preview_link: '',
            final_link: '',
            created_at: new Date().toISOString(),
            last_update: new Date().toISOString()
          };
          if (['media', 'photo', 'shoot'].includes(o.request_type) && o.shoot_location) taskPayload.shoot_location = o.shoot_location;
          // Kế thừa ngày/giờ buổi quay sang task để Calendar chấm lịch quay/chụp theo task.
          if (['media', 'photo', 'shoot'].includes(o.request_type)) {
            if (o.shoot_date) taskPayload.shoot_date = o.shoot_date;
            if (o.shoot_time) taskPayload.shoot_time = o.shoot_time;
          }
          await window.MH.store.tasks.upsert(taskPayload);
          createdTaskIds.push(taskId);
          // Notify PIC (lookup user_id qua name, fuzzy match)
          const picUserId = await window.MH.store.notifications.findUserIdByName(part.pic);
          if (picUserId) {
            await window.MH.store.notifications.create({
              user_id: picUserId,
              type: 'task_assigned',
              title: 'Task mới được giao',
              message: `${taskId} · ${taskPayload.project_name} · ${TYPE_LABEL[part.taskType] || part.taskType} · Deadline: ${o.internal_deadline || '—'}`,
              link: 'production-board.html?id=' + taskId,
              related_entity_type: 'tasks',
              related_entity_id: taskId
            });
          } else {
            console.warn('[push] không tìm thấy user_id cho PIC:', part.pic);
          }
        }
      } catch (e) {
        console.warn('[push] task creation failed:', e);
        window.MH.toast({ type: 'error', title: 'Tạo task thất bại', message: 'DB không phản hồi. Thử lại hoặc liên hệ admin.' });
        return;
      }
    } else {
      for (const part of plan) createdTaskIds.push(await generateNextTaskId());
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
      title: 'Đã chuyển sang sản xuất',
      message: `${o.order_id} · ${o.project_name || ''} — Team Media đang thực hiện. Bản preview sẽ được gửi khi hoàn thành.`
    });

    const picSummary = plan.map((p) => (p.label ? p.label + ': ' : '') + p.pic).join(' · ');
    window.MH.toast({
      type: 'success',
      title: '✓ Đã chuyển Production Board',
      message: `${o.order_id} → ${createdTaskIds.join(', ')} · ${picSummary}`,
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
    new_requests:      { view: 'pending',      sortKey: 'created_at',   sortDir: 'desc', label: 'New Orders',          desc: 'Đơn mới chờ Account xác nhận.' },
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
  // Gỡ banner drilldown khi user tự đổi view/sort (banner không còn khớp filter hiển thị).
  // Khác clearDrilldown: KHÔNG ép view/sort về mặc định — giữ lựa chọn user vừa thao tác.
  function removeDrilldownBanner() {
    const b = document.getElementById('dl-banner');
    if (b) b.remove();
    if (new URLSearchParams(location.search).get('dl')) history.replaceState(null, '', location.pathname);
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
  // Deep-link mở drawer: nhận cả ?id= lẫn ?order= (alias — link từ Content Team/notification).
  const _dlParams = new URLSearchParams(location.search);
  const focusId = _dlParams.get('id') || _dlParams.get('order');
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

  // Load users thật cho dropdown PIC (fire-and-forget — thường xong trước khi mở drawer).
  loadStaffUsers().then(function (n) {
    if (!n) return;
    // Filter "Mọi PIC" (static HTML) — bổ sung tên user thật chưa có trong options.
    const filterSel = document.getElementById('filter-pic');
    if (filterSel) {
      const existing = new Set(Array.from(filterSel.options).map((op) => op.value || op.textContent));
      picUserPool(PROD_PIC_ROLES.concat(ACCT_PIC_ROLES), [], '').forEach((u) => {
        if (existing.has(u.name)) return;
        const op = document.createElement('option');
        op.textContent = u.name;
        filterSel.appendChild(op);
        existing.add(u.name);
      });
    }
    // Drawer đang mở (options build trước khi users về) → refresh options tại chỗ.
    if (!currentOrder) return;
    [['edit-account-pic', currentOrder.account_pic_user_id, currentOrder.account_pic, ACCT_PIC_ROLES],
     ['edit-prod-pic', currentOrder.production_pic_user_id, currentOrder.production_pic, PROD_PIC_ROLES],
     ['edit-prod-pic-video', currentOrder.production_pic_video_user_id, currentOrder.production_pic_video, PROD_PIC_ROLES],
     ['edit-prod-pic-photo', currentOrder.production_pic_photo_user_id, currentOrder.production_pic_photo, PROD_PIC_ROLES]
    ].forEach(function (cfg) {
      const el = document.getElementById(cfg[0]);
      if (el) el.innerHTML = picOptionsId(el.value || cfg[1], cfg[2], cfg[3]);
    });
    // Rebuild menu custom dropdown sau khi options đổi.
    if (window.MH && window.MH.enhancePicSelects) window.MH.enhancePicSelects(document.getElementById('order-drawer'));
  });

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
