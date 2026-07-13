/* =====================================================================
   CB Media Hub — Ads Order Form (request.html?type=ads)
   Luồng Client → Content Team (KHÔNG qua Account/Production).
   Form 6 section tự chứa, TÁCH BIỆT form Media (#request-form / order-form.js).
   Kích hoạt CHỈ khi URL có ?type=ads → ẩn form Media, hiện #ads-form-section.
   Order tạo: order_kind='ads_order', request_type='ads', owner_team='content',
   client_visible=true, ads_status='submitted', ads_detail={6 section}, prefix ADS-YYYY-xxxx.
   ===================================================================== */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);

  const adsSection = document.getElementById('ads-form-section');
  const adsForm = document.getElementById('ads-form');
  if (!adsSection || !adsForm) return;
  const startAds = (params.get('type') || '').toLowerCase() === 'ads';

  /* ---------- Auth ---------- */
  const AUTH_USER = (() => {
    try { return JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { return null; }
  })();

  /* ---------- Switch Media ↔ Ads (segmented toggle #rf-type-switch) ---------- */
  const introEls = {
    eyebrow: document.getElementById('rf-eyebrow'),
    title: document.getElementById('rf-title'),
    lead: document.getElementById('rf-lead')
  };
  // Snapshot text gốc form Media (chụp lúc load, trước khi switch sang Ads).
  const introOrig = {
    eyebrow: introEls.eyebrow ? introEls.eyebrow.textContent : '',
    title: introEls.title ? introEls.title.innerHTML : '',
    lead: introEls.lead ? introEls.lead.textContent : '',
    doc: document.title
  };
  function setToggle(mode) {
    document.querySelectorAll('.rf-type-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-rf-type') === mode);
      b.setAttribute('aria-selected', b.getAttribute('data-rf-type') === mode ? 'true' : 'false');
    });
  }
  function showAds() {
    const mfs = document.getElementById('form-section');
    if (mfs) mfs.classList.add('hidden');      // ẩn form Media
    adsSection.hidden = false; adsSection.classList.remove('hidden');
    if (introEls.eyebrow) introEls.eyebrow.textContent = 'Yêu cầu chạy Ads';
    if (introEls.title) introEls.title.innerHTML = '<span class="serif-italic">Yêu cầu</span> chạy Ads';
    if (introEls.lead) introEls.lead.textContent = 'Gửi yêu cầu chạy quảng cáo tới Content Team CB Centres. Cung cấp mục tiêu, ngân sách, kênh và nội dung để team chuẩn bị và triển khai đúng chiến dịch.';
    document.title = 'Yêu cầu chạy Ads — CB Media Hub';
    setToggle('ads');
    try { history.replaceState(null, '', 'request.html?type=ads'); } catch (e) { }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showMedia() {
    const mfs = document.getElementById('form-section');
    if (mfs) mfs.classList.remove('hidden');   // hiện lại form Media
    adsSection.hidden = true; adsSection.classList.add('hidden');
    if (introEls.eyebrow) introEls.eyebrow.textContent = introOrig.eyebrow;
    if (introEls.title) introEls.title.innerHTML = introOrig.title;
    if (introEls.lead) introEls.lead.textContent = introOrig.lead;
    document.title = introOrig.doc;
    setToggle('media');
    try { history.replaceState(null, '', 'request.html'); } catch (e) { }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Autofill người yêu cầu + auth bar ---------- */
  function autofill() {
    const bar = document.getElementById('cmp-auth-bar');
    if (AUTH_USER) {
      const set = (id, val) => { const el = document.getElementById(id); if (el && !el.value && val) el.value = val; };
      set('ads_requester_name', AUTH_USER.name || '');
      set('ads_requester_email', AUTH_USER.email || '');
      set('ads_requester_phone', AUTH_USER.phone || '');
      set('ads_branch_department', AUTH_USER.department || AUTH_USER.team || '');
      const emailEl = document.getElementById('ads_requester_email');
      if (emailEl) { emailEl.readOnly = true; emailEl.style.cssText += ';background:var(--surface-2);cursor:not-allowed;'; emailEl.title = 'Email lấy từ tài khoản đăng nhập.'; }
      if (bar) bar.innerHTML = '<span class="auth-ok-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Đang gửi với tài khoản: <b>' + esc(AUTH_USER.email) + '</b></span>';
    } else if (bar) {
      bar.innerHTML = '<span class="auth-warn-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg> Bạn cần đăng nhập để gửi yêu cầu.</span> <a class="btn btn-primary btn-sm" href="login.html?redirect=' + encodeURIComponent('request.html?type=ads') + '">Đăng nhập ngay</a>';
    }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

  /* ---------- Chip toggle (đồng bộ is-active — order-form.js đã bind global .chips
       nhưng bind lại ở đây để chắc chắn khi ads chạy độc lập). ---------- */
  adsForm.querySelectorAll('.chips').forEach(function (group) {
    const sync = function () { group.querySelectorAll('.chip').forEach(function (c) { const i = c.querySelector('input'); if (i) c.classList.toggle('is-active', i.checked); }); };
    group.addEventListener('change', sync); sync();
  });
  adsForm.querySelectorAll('.chip--toggle input').forEach(function (i) {
    const sync = function () { i.closest('.chip').classList.toggle('is-active', i.checked); };
    i.addEventListener('change', sync); sync();
  });

  /* ---------- File kế hoạch / phiếu đề xuất ---------- */
  let planFile = null;
  (function wirePlanFile() {
    const inp = document.getElementById('ads_plan_file');
    const drop = document.getElementById('cmp-file-drop');
    const txt = document.getElementById('cmp-file-text');
    if (!inp) return;
    inp.addEventListener('change', function () {
      planFile = (inp.files && inp.files[0]) || null;
      if (planFile && planFile.size > 100 * 1024 * 1024) {
        window.MH.toast({ type: 'warning', title: 'File quá lớn', message: '"' + planFile.name + '" vượt 100MB. Vui lòng dùng link Google Drive.' });
        planFile = null; inp.value = '';
      }
      if (txt) txt.textContent = planFile ? planFile.name : 'Chọn file kế hoạch / phiếu đề xuất (PDF · Word · PPT · ảnh)';
      if (drop) drop.classList.toggle('has-file', !!planFile);
    });
  })();

  /* ---------- Thu thập dữ liệu 6 section ---------- */
  function multi(name) { return [].slice.call(adsForm.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; }); }
  function val(name) { const el = adsForm.querySelector('[name="' + name + '"]'); return el ? el.value.trim() : ''; }
  function checked(name) { const el = adsForm.querySelector('input[name="' + name + '"]'); return !!(el && el.checked); }

  function collectDetail() {
    return {
      // 1. Chiến dịch
      campaign_name: val('campaign_name'),
      plan_file_url: val('plan_file_url'),
      branch_department: val('branch_department'),
      requester_name: val('requester_name'),
      requester_email: val('requester_email'),
      requester_phone: val('requester_phone'),
      desired_launch_date: val('desired_launch_date'),
      campaign_start_date: val('campaign_start_date'),
      campaign_end_date: val('campaign_end_date'),
      priority: val('priority') || 'normal',
      // 2. Mục tiêu
      objective: val('objective'),
      expected_kpi: val('expected_kpi'),
      expected_leads: val('expected_leads'),
      expected_cpl: val('expected_cpl'),
      kpi_notes: val('kpi_notes'),
      // 3. Nội dung cần quảng cáo
      product_program_name: val('product_program_name'),
      short_description: val('short_description'),
      offer_message: val('offer_message'),
      target_student_group: val('target_student_group'),
      target_audience_description: val('target_audience_description'),
      applicable_area: val('applicable_area'),
      hotline_or_contact: val('hotline_or_contact'),
      landing_or_form_url: val('landing_or_form_url'),
      // 4. Kênh & ngân sách
      platforms: multi('platforms'),
      campaign_type: val('campaign_type'),
      budget_amount: val('budget_amount'),
      budget_type: val('budget_type') || 'total',
      daily_budget: val('daily_budget'),
      budget_notes: val('budget_notes'),
      // Ads Order luôn cần Content viết copy; nếu cần creative/thiết kế → Content chủ động
      // tạo Internal Media Request (KHÔNG hỏi Client ở form này).
      need_content_copy: true,
      // 5. Xác nhận
      confirm_information: checked('confirm_information'),
      special_notes: val('special_notes')
    };
  }

  // Tóm tắt text cho content_brief (fallback khi DB chưa có cột ads_detail).
  function briefSummary(d) {
    const OBJ = { lead_generation: 'Lead Generation', inbox: 'Inbox', awareness: 'Awareness', event: 'Sự kiện', opening: 'Khai trương', remarketing: 'Remarketing', traffic: 'Traffic', video_view: 'Video View' };
    const parts = [];
    parts.push('[Yêu cầu chạy Ads]');
    if (d.objective) parts.push('Mục tiêu: ' + (OBJ[d.objective] || d.objective));
    if (d.product_program_name) parts.push('Sản phẩm/CT: ' + d.product_program_name);
    if (d.offer_message) parts.push('Offer: ' + d.offer_message);
    if (d.platforms && d.platforms.length) parts.push('Kênh: ' + d.platforms.join(', '));
    if (d.budget_amount || d.daily_budget) parts.push('Ngân sách: ' + (d.budget_type === 'daily' ? (d.daily_budget || '—') + 'đ/ngày' : (d.budget_amount || '—') + 'đ tổng'));
    if (d.expected_kpi) parts.push('KPI: ' + d.expected_kpi);
    if (d.landing_or_form_url) parts.push('Landing: ' + d.landing_or_form_url);
    if (d.need_media_production) parts.push('CẦN creative/thiết kế');
    if (d.special_notes) parts.push('Ghi chú: ' + d.special_notes);
    return parts.join(' · ');
  }

  /* ---------- Validate ---------- */
  function validate(d) {
    let ok = true;
    const err = function (name, show) {
      const e = adsForm.querySelector('[data-error-for="' + name + '"]');
      if (e) e.style.display = show ? 'block' : 'none';
    };
    err('campaign_name', !d.campaign_name);
    err('objective', !d.objective);
    err('product_program_name', !d.product_program_name);
    err('confirm_information', !d.confirm_information);
    [['campaign_name', d.campaign_name], ['objective', d.objective], ['product_program_name', d.product_program_name], ['confirm_information', d.confirm_information]].forEach(function (p) { if (!p[1]) ok = false; });
    if (!ok) {
      const firstErr = adsForm.querySelector('.error[style*="block"]');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.MH.toast({ type: 'warning', title: 'Thiếu thông tin', message: 'Vui lòng điền các trường bắt buộc (*).' });
    }
    return ok;
  }

  /* ---------- Notify Lead Content (+admin) ---------- */
  // Qua RPC notify_roles — client không đọc được users theo role dưới RLS
  // (lookup trực tiếp trả [] im lặng → Lead Content không nhận noti).
  async function notifyLeadContent(code, d) {
    if (!window.MH || !window.MH.supabaseEnabled || !window.MH.supabase) return;
    try {
      const { error: nerr } = await window.MH.supabase.rpc('notify_roles', {
        p_roles: ['lead_content', 'admin'],
        p_type: 'order_new',
        p_title: 'Yêu cầu chạy Ads mới',
        p_message: (d.campaign_name || code) + ' · ' + (d.branch_department || '') + ' · ' + (d.requester_name || ''),
        p_link: 'content-team.html?tab=ads-orders&id=' + code,
        p_entity_type: 'orders',
        p_entity_id: code
      });
      if (nerr) throw nerr;
    } catch (e) { console.warn('[ads-order-form] notify lead_content failed (chạy supabase/add-notify-roles-rpc.sql nếu RPC chưa có):', e); }
  }

  /* ---------- Submit ---------- */
  async function doSubmit() {
    if (!AUTH_USER) {
      window.MH.toast({ type: 'error', title: '401 Unauthorized', message: 'Vui lòng đăng nhập để gửi yêu cầu.' });
      location.href = 'login.html?redirect=' + encodeURIComponent('request.html?type=ads');
      return;
    }
    const d = collectDetail();
    if (!validate(d)) return;

    const btn = document.getElementById('ads-submit-btn');
    btn.classList.add('is-loading');
    const year = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    const code = 'ADS-' + year + '-' + num;

    // Upload file kế hoạch (nếu có + Supabase Storage bật). Fallback: chỉ lưu tên + cảnh báo.
    let planFileMeta = null;
    if (planFile) {
      if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
        btn.textContent = 'Đang upload file...';
        try {
          await window.MH.supabaseReady;
          const safe = (planFile.name || 'plan').replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const path = code + '/plan-' + Date.now() + '-' + safe;
          await window.MH.store.files.upload('brief-files', path, planFile, { contentType: planFile.type || 'application/octet-stream' });
          planFileMeta = { name: planFile.name, path: path, size: planFile.size };
        } catch (e) {
          console.warn('[ads-order-form] upload plan file failed:', e);
          window.MH.toast({ type: 'warning', title: 'Upload file lỗi', message: planFile.name + ' — bỏ qua, tiếp tục gửi. Có thể dán link Drive thay thế.' });
        }
      } else {
        planFileMeta = { name: planFile.name, size: planFile.size, note: 'chưa upload (demo/offline)' };
      }
    }
    if (planFileMeta) d.plan_file = planFileMeta;

    const nowIso = new Date().toISOString();
    const row = {
      order_id: code,
      requester_id: (AUTH_USER && AUTH_USER.id) ? AUTH_USER.id : null,
      requester_name: d.requester_name || AUTH_USER.name || '',
      requester_email: d.requester_email || AUTH_USER.email || '',
      requester_contact: d.requester_phone || null,
      department: d.branch_department || AUTH_USER.department || AUTH_USER.team || '',
      project_name: d.campaign_name || 'Ads campaign',
      request_type: 'ads',
      order_kind: 'ads_order',
      owner_team: 'content',
      client_visible: true,
      ads_status: 'submitted',
      ads_detail: d,
      deliverable_type: [],
      file_brief_url: (planFileMeta && planFileMeta.path) ? planFileMeta.path : null,
      content_brief: briefSummary(d),
      priority: d.priority || 'normal',
      requested_deadline: d.desired_launch_date || d.campaign_start_date || null,
      // Trung tính: KHÔNG vào hàng chờ Account (route thuộc Content Team).
      account_status: 'confirmed',
      production_status: 'unassigned',
      progress: 5,
      created_at: nowIso,
      last_updated: nowIso
    };

    let dbPersisted = false;
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      try {
        await window.MH.supabaseReady;
        await window.MH.store.orders.create(row); // loop-strip cột thiếu nếu chưa migrate
        dbPersisted = true;
        await notifyLeadContent(code, d);
      } catch (e) {
        console.warn('[ads-order-form] create ads order failed:', e);
        window.MH.toast({ type: 'warning', title: 'Sync DB lỗi', message: 'Yêu cầu lưu local. Liên hệ admin.' });
      }
    }
    // localStorage fallback (demo + offline)
    try {
      const orders = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]');
      orders.unshift(row);
      localStorage.setItem('mh-submitted-orders', JSON.stringify(orders.slice(0, 50)));
    } catch (_) {}

    try { localStorage.removeItem(ADS_DRAFT_KEY); } catch (_) {}
    showSuccess(code, dbPersisted);
    btn.classList.remove('is-loading');
  }

  /* ---------- Lưu nháp (localStorage riêng cho Ads) ---------- */
  const ADS_DRAFT_KEY = 'mh-ads-draft';
  function snapshotAds() {
    const data = {};
    adsForm.querySelectorAll('input,select,textarea').forEach(function (el) {
      if (!el.name || el.type === 'file') return;
      if (el.type === 'checkbox') { if (el.checked) (data[el.name] = data[el.name] || []).push(el.value); }
      else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
      else data[el.name] = el.value;
    });
    return data;
  }
  function saveAdsDraft(announce) {
    try {
      localStorage.setItem(ADS_DRAFT_KEY, JSON.stringify({ data: snapshotAds(), savedAt: Date.now() }));
      if (announce) window.MH.toast({ type: 'success', title: 'Đã lưu nháp', message: 'Bản nháp yêu cầu Ads sẽ tự khôi phục khi quay lại.' });
    } catch (e) { }
  }
  function restoreAdsDraft() {
    try {
      const raw = localStorage.getItem(ADS_DRAFT_KEY); if (!raw) return false;
      const parsed = JSON.parse(raw); const data = parsed && parsed.data; if (!data) return false;
      Object.keys(data).forEach(function (k) {
        const val = data[k];
        if (Array.isArray(val)) {
          val.forEach(function (vv) { const el = adsForm.querySelector('input[name="' + k + '"][value="' + vv + '"]'); if (el) el.checked = true; });
        } else {
          const el = adsForm.querySelector('[name="' + k + '"]');
          if (!el || el.type === 'file') return;
          if (el.type === 'checkbox') el.checked = (el.value === val || val === 'yes');
          else if (el.type === 'radio') { const r = adsForm.querySelector('input[name="' + k + '"][value="' + val + '"]'); if (r) r.checked = true; }
          else el.value = val;
        }
      });
      adsForm.querySelectorAll('.chips').forEach(function (g) { g.querySelectorAll('.chip').forEach(function (c) { const i = c.querySelector('input'); if (i) c.classList.toggle('is-active', i.checked); }); });
      adsForm.querySelectorAll('.chip--toggle input').forEach(function (i) { i.closest('.chip').classList.toggle('is-active', i.checked); });
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Preview Brief (Ads) ---------- */
  function buildAdsPreview(d) {
    const OBJ = { lead_generation: 'Lead Generation', inbox: 'Inbox / Tin nhắn', awareness: 'Awareness', event: 'Sự kiện', opening: 'Khai trương', remarketing: 'Remarketing', traffic: 'Traffic', video_view: 'Video View' };
    const row = function (label, valStr) { return (valStr && String(valStr).trim()) ? '<div class="detail-row"><span class="detail-dt">' + label + '</span><span class="detail-dd">' + esc(valStr) + '</span></div>' : ''; };
    const budget = d.budget_type === 'daily' ? (d.daily_budget ? d.daily_budget + ' đ/ngày' : '') : (d.budget_amount ? d.budget_amount + ' đ (tổng)' : '');
    const plats = (d.platforms || []).join(', ');
    const fileName = (d.plan_file && d.plan_file.name) || (planFile && planFile.name) || '';
    const sec = function (title, inner) { return inner ? '<div class="drawer-detail-section"><h4>' + title + '</h4><div>' + inner + '</div></div>' : ''; };
    return sec('Chiến dịch', row('Tên chiến dịch', d.campaign_name) + row('Chi nhánh / Bộ phận', d.branch_department) + row('Người yêu cầu', (d.requester_name || '') + (d.requester_email ? ' · ' + d.requester_email : '')) + row('File kế hoạch', fileName) + row('Link kế hoạch', d.plan_file_url) + row('Ngày lên Ads', d.desired_launch_date) + row('Chạy', (d.campaign_start_date || '?') + ' → ' + (d.campaign_end_date || '?')) + row('Ưu tiên', d.priority))
      + sec('Mục tiêu / KPI', row('Mục tiêu', OBJ[d.objective] || d.objective) + row('KPI', d.expected_kpi) + row('Số lead', d.expected_leads) + row('CPL', d.expected_cpl) + row('Ghi chú KPI', d.kpi_notes))
      + sec('Nội dung & đối tượng', row('Sản phẩm / CT', d.product_program_name) + row('Mô tả', d.short_description) + row('Ưu đãi', d.offer_message) + row('Nhóm học viên', d.target_student_group) + row('Đối tượng', d.target_audience_description) + row('Khu vực', d.applicable_area) + row('Hotline', d.hotline_or_contact) + row('Landing / Form', d.landing_or_form_url))
      + sec('Kênh & ngân sách', row('Nền tảng', plats) + row('Loại chiến dịch', d.campaign_type) + row('Ngân sách', budget) + row('Ghi chú ngân sách', d.budget_notes))
      + sec('Khác', row('Ghi chú thêm', d.special_notes));
  }
  function openAdsPreview() {
    const d = collectDetail();
    if (!validate(d)) return;
    document.getElementById('ads-preview-body').innerHTML = buildAdsPreview(d);
    const m = document.getElementById('ads-preview-modal'); m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false');
  }
  function closeAdsPreview() { const m = document.getElementById('ads-preview-modal'); m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); }

  /* ---------- Success (reuse #success-view, đổi copy cho Ads) ---------- */
  function showSuccess(code, dbPersisted) {
    const oc = document.getElementById('order-code'); if (oc) oc.textContent = code;
    const trackLink = document.getElementById('track-link'); if (trackLink) trackLink.href = 'client-dashboard.html';
    // Đổi nội dung success cho ngữ cảnh Ads (Content Team tiếp nhận).
    const h = document.querySelector('#success-view h2'); if (h) h.textContent = 'Yêu cầu chạy Ads đã được gửi';
    const lead = document.querySelector('#success-view .lead');
    if (lead) lead.innerHTML = 'Yêu cầu đã chuyển thẳng <strong>Content Team</strong>. Lead Content sẽ tiếp nhận, phân công và chuẩn bị nội dung. Bạn có thể theo dõi trạng thái trong Portal của mình.';
    const badge = document.querySelector('#success-view .badge'); if (badge) badge.innerHTML = '<span class="dot"></span> Đã nhận yêu cầu Ads';
    const formView = document.getElementById('form-view'); if (formView) formView.classList.add('hidden');
    adsSection.classList.add('hidden');
    const successView = document.getElementById('success-view'); if (successView) successView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.MH.toast({ type: 'success', title: 'Gửi thành công', message: 'Ads Order: ' + code + (dbPersisted ? ' · Đã lưu DB' : ' · Demo local') });
  }

  adsForm.addEventListener('submit', function (e) { e.preventDefault(); doSubmit(); });

  // Lưu nháp + Preview
  const sdBtn = document.getElementById('ads-save-draft-btn'); if (sdBtn) sdBtn.addEventListener('click', function () { saveAdsDraft(true); });
  const pvBtn = document.getElementById('ads-preview-btn'); if (pvBtn) pvBtn.addEventListener('click', openAdsPreview);
  const pvClose = document.getElementById('ads-preview-close'); if (pvClose) pvClose.addEventListener('click', closeAdsPreview);
  const pvEdit = document.getElementById('ads-preview-edit'); if (pvEdit) pvEdit.addEventListener('click', closeAdsPreview);
  const pvSubmit = document.getElementById('ads-preview-submit'); if (pvSubmit) pvSubmit.addEventListener('click', function () { closeAdsPreview(); doSubmit(); });
  const pvModal = document.getElementById('ads-preview-modal');
  if (pvModal) {
    pvModal.addEventListener('click', function (e) { if (e.target === pvModal) closeAdsPreview(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pvModal.classList.contains('is-open')) closeAdsPreview(); });
  }

  // Toggle Media ↔ Ads
  document.querySelectorAll('.rf-type-btn').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (b.getAttribute('data-rf-type') === 'ads') showAds(); else showMedia();
    });
  });

  /* ---------- Chooser popup (Media vs Ads) ---------- */
  const chooser = document.getElementById('rf-chooser');
  function openChooser() { if (chooser) { chooser.classList.add('is-open'); chooser.setAttribute('aria-hidden', 'false'); } }
  function closeChooser() { if (chooser) { chooser.classList.remove('is-open'); chooser.setAttribute('aria-hidden', 'true'); } }
  if (chooser) {
    chooser.querySelectorAll('.rf-choice-card[data-rf-type]').forEach(function (c) {
      c.addEventListener('click', function () {
        if (c.getAttribute('data-rf-type') === 'ads') showAds(); else showMedia();
        closeChooser();
      });
    });
    const cx = document.getElementById('rf-chooser-close'); if (cx) cx.addEventListener('click', closeChooser);
    // Click nền (ngoài card) → đóng, mặc định Media.
    chooser.addEventListener('click', function (e) { if (e.target === chooser) closeChooser(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && chooser.classList.contains('is-open')) closeChooser(); });
  }

  /* ---------- Stepper trái: scroll-spy + tiến độ ---------- */
  const ADS_STEPS = ['ads-sec-1', 'ads-sec-2', 'ads-sec-3', 'ads-sec-4', 'ads-sec-5'];
  let adsActiveIdx = 0;
  function adsSectionDone(id) {
    const g = function (n) { const el = adsForm.querySelector('[name="' + n + '"]'); return !!(el && el.value.trim()); };
    if (id === 'ads-sec-1') return g('campaign_name');
    if (id === 'ads-sec-2') return g('objective');
    if (id === 'ads-sec-3') return g('product_program_name');
    if (id === 'ads-sec-4') return adsForm.querySelectorAll('input[name="platforms"]:checked').length > 0 || g('campaign_type') || g('budget_amount') || g('daily_budget');
    if (id === 'ads-sec-5') { const c = adsForm.querySelector('input[name="confirm_information"]'); return !!(c && c.checked); }
    return false;
  }
  function refreshAdsSteps() {
    let done = 0;
    ADS_STEPS.forEach(function (id, i) {
      const link = document.querySelector('[data-ads-step="' + id + '"]');
      const ok = adsSectionDone(id); if (ok) done++;
      if (link) {
        link.classList.toggle('is-done', ok);
        link.classList.toggle('is-active', i === adsActiveIdx);
        link.setAttribute('aria-current', i === adsActiveIdx ? 'step' : 'false');
      }
    });
    const pct = Math.round(done / ADS_STEPS.length * 100);
    const lab = document.getElementById('ads-side-progress-label'); if (lab) lab.textContent = 'Bước ' + (adsActiveIdx + 1) + '/' + ADS_STEPS.length + ' · ' + pct + '% hoàn tất';
    const fill = document.getElementById('ads-side-progress-fill'); if (fill) fill.style.width = pct + '%';
  }
  function initAdsStepper() {
    document.querySelectorAll('[data-ads-step]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const id = a.getAttribute('data-ads-step'); const el = document.getElementById(id);
        if (el) { adsActiveIdx = ADS_STEPS.indexOf(id); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); refreshAdsSteps(); }
      });
    });
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(function (entries) {
        const vis = entries.filter(function (en) { return en.isIntersecting; })
          .sort(function (a, b) { return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top); });
        if (vis.length) { const i = ADS_STEPS.indexOf(vis[0].target.id); if (i >= 0) { adsActiveIdx = i; refreshAdsSteps(); } }
      }, { rootMargin: '-22% 0px -62% 0px', threshold: [0, 0.15, 0.4] });
      ADS_STEPS.forEach(function (id) { const el = document.getElementById(id); if (el) obs.observe(el); });
    }
    adsForm.addEventListener('input', refreshAdsSteps);
    adsForm.addEventListener('change', refreshAdsSteps);
    refreshAdsSteps();
  }

  /* ---------- Init ---------- */
  const hadDraft = restoreAdsDraft();   // khôi phục nháp Ads (nếu có) trước khi autofill
  autofill();
  initAdsStepper();
  if (hadDraft && startAds) window.MH.toast({ type: 'info', title: 'Đã khôi phục nháp', message: 'Tiếp tục yêu cầu Ads từ chỗ bạn dừng.' });
  const mode = (params.get('mode') || '').toLowerCase();
  if (startAds) {
    showAds();                                   // CTA Portal ?type=ads → thẳng Ads
  } else if (params.get('type') === 'media' || mode === 'revision') {
    showMedia();                                 // ?type=media hoặc revision flow → thẳng Media
  } else {
    setToggle('media');                          // vào từ nav (không ?type) → mặc định Media + popup chọn
    openChooser();
  }
})();
