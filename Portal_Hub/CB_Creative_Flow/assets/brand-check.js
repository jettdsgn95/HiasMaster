/* =====================================================================
   CB Media Hub — AI Brand Safety Checker (brand-check.html)

   Flow: upload ảnh → nhập metadata → gọi AI Vision → rule override engine
   → lưu brand_checks + brand_check_criteria → drawer kết quả → history/dashboard.

   AI Vision:
     - Supabase ON  → upload Storage `brand-check-images/{uid}/{checkId}/…`
                      rồi invoke Edge Function `brand-check-analyze` (API key
                      nằm trong Supabase secrets — KHÔNG bao giờ ở frontend).
                      Function lỗi/chưa deploy → lưu NEEDS_MANUAL_REVIEW
                      (hoặc REQUIRES_MEDIA_REVIEW nếu metadata có rủi ro).
     - Supabase OFF → chế độ DEMO: simulateAiResult() mô phỏng kết quả từ
                      metadata (flag rõ trong UI), lưu localStorage.

   Rule engine client-side là bản MIRROR của Edge Function (nguồn chuẩn:
   supabase/functions/brand-check-analyze/index.ts) — dùng cho demo mode và
   fallback khi AI lỗi. Đổi rule phải đổi CẢ HAI chỗ.

   Roles: admin/account/lead_media = Media (hậu kiểm + dashboard + thấy tất cả);
   system_supervisor = read-only tất cả; design/editor/content/lead_content =
   upload + xem lượt của mình. Client bị guard đá từ HTML (Phase sau mở
   cho chi nhánh qua Client Portal).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Context ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) return;

  const MEDIA_ROLES = ['admin', 'account', 'lead_media'];
  const READ_ALL_ROLES = MEDIA_ROLES.concat(['system_supervisor']);
  const isMedia = MEDIA_ROLES.indexOf(user.role) >= 0;
  const seesAll = READ_ALL_ROLES.indexOf(user.role) >= 0;
  const isSupervisor = user.role === 'system_supervisor';
  const isClient = user.role === 'client';   // giáo viên/chi nhánh tự kiểm

  const remote = function () { return !!(window.MH && window.MH.supabaseEnabled); };

  /* ---------- Chế độ hoạt động ----------
     DEMO = true khi backend brand-check CHƯA dùng được (Supabase tắt HOẶC bảng
     chưa tạo HOẶC chưa có session auth). Lúc đó module đọc/ghi hoàn toàn trên
     localStorage `mh-brand-checks` (self-contained), AI chấm bằng mô phỏng — để
     mở local vẫn xem được flow end-to-end. Khi backend provisioned → DEMO=false,
     dùng Supabase (bảng thật + Edge Function AI). Quyết định 1 lần ở detectMode().
     Tránh lỗi cũ: Supabase bật nửa vời (có URL/KEY nhưng chưa migrate) → hard error. */
  let DEMO = false;
  let demoReason = '';

  const LS_KEY = 'mh-brand-checks';
  const SEQ_KEY = 'mh-brand-check-seq';
  function lsRead() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; } }
  function lsWrite(list) { try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 100))); } catch (e) {} }
  function nextCheckCode() {
    let n = parseInt(localStorage.getItem(SEQ_KEY) || '0', 10) + 1;
    try { localStorage.setItem(SEQ_KEY, String(n)); } catch (e) {}
    return 'BSC-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0');
  }
  // Local store (chỉ dùng khi DEMO) — cùng key với data-store fallback để nhất quán.
  const localStore = {
    async list() { return lsRead(); },
    async get(id) { return lsRead().find(function (c) { return String(c.id) === String(id); }) || null; },
    async create(row) {
      const list = lsRead();
      row.id = row.id || ('bcheck-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      row.check_code = row.check_code || nextCheckCode();
      row.created_at = new Date().toISOString();
      row.manual_status = row.manual_status || 'PENDING';
      list.unshift(row);
      lsWrite(list);
      return row;
    },
    async update(id, patch) {
      const list = lsRead();
      const i = list.findIndex(function (c) { return String(c.id) === String(id); });
      if (i >= 0) { list[i] = Object.assign({}, list[i], patch); lsWrite(list); return list[i]; }
      return null;
    },
    async addCriteria(id, rows) {
      const list = lsRead();
      const i = list.findIndex(function (c) { return String(c.id) === String(id); });
      if (i >= 0) { list[i].criteria = rows; lsWrite(list); }
      return rows;
    }
  };
  // Data accessor: DEMO → localStore · else → Supabase store.
  const db = {
    list: function (f) { return DEMO ? localStore.list(f) : window.MH.store.brandChecks.list(f); },
    get: function (id) { return DEMO ? localStore.get(id) : window.MH.store.brandChecks.get(id); },
    create: function (r) { return DEMO ? localStore.create(r) : window.MH.store.brandChecks.create(r); },
    update: function (id, p) { return DEMO ? localStore.update(id, p) : window.MH.store.brandChecks.update(id, p); },
    addCriteria: function (id, rows) { return DEMO ? localStore.addCriteria(id, rows) : window.MH.store.brandChecks.addCriteria(id, rows); }
  };

  // Phát hiện backend dùng được không (chạy 1 lần ở init).
  async function detectMode() {
    if (!remote()) { DEMO = true; demoReason = 'chưa kết nối Supabase'; return; }
    try {
      await window.MH.supabaseReady;
      const client = window.MH.supabase;
      if (!client) { DEMO = true; demoReason = 'Supabase không tải được'; return; }
      const me = await window.MH.store.users.me().catch(function () { return null; });
      if (!me || !me.id) { DEMO = true; demoReason = 'chưa đăng nhập bằng tài khoản Supabase (đang dùng phiên demo)'; return; }
      // Probe bảng brand_checks — chưa chạy add-brand-check.sql → error.
      const probe = await client.from('brand_checks').select('id').limit(1);
      if (probe.error) { DEMO = true; demoReason = 'bảng brand_checks chưa tạo — chạy supabase/add-brand-check.sql'; return; }
      DEMO = false;
    } catch (e) {
      DEMO = true; demoReason = 'backend chưa sẵn sàng';
    }
  }

  /* ---------- Hằng số hiển thị ---------- */
  const AI_STATUS = {
    PASS:                  { label: 'Đạt',                    badge: 'badge-success' },
    NEEDS_REVISION:        { label: 'Cần chỉnh sửa',          badge: 'badge-warning' },
    FAIL:                  { label: 'Không đạt',              badge: 'badge-danger' },
    REQUIRES_MEDIA_REVIEW: { label: 'Bắt buộc Media duyệt',   badge: 'badge-danger bc-badge-review' },
    NEEDS_MANUAL_REVIEW:   { label: 'Chờ duyệt tay (AI lỗi)', badge: 'badge-default' }
  };
  const MANUAL_STATUS = {
    PENDING:           { label: 'Chưa hậu kiểm',       badge: 'badge-default' },
    APPROVED:          { label: 'Media đã duyệt',      badge: 'badge-success' },
    REVISION_REQUIRED: { label: 'Yêu cầu chỉnh sửa',   badge: 'badge-warning' },
    REJECTED:          { label: 'Từ chối sử dụng',     badge: 'badge-danger' },
    ARCHIVED:          { label: 'Lưu trữ',             badge: 'badge-default' }
  };
  const GROUP_LABEL = {
    group_1_internal:     'Nhóm 1 — Nội bộ',
    group_2_self_check:   'Nhóm 2 — Tự kiểm',
    group_3_media_review: 'Nhóm 3 — Media duyệt'
  };
  const CRITERIA_DEF = [
    { code: 'logo_identity',         name: 'Logo & nhận diện CB Centres',   max: 25 },
    { code: 'brand_color',           name: 'Màu sắc thương hiệu',           max: 15 },
    { code: 'text_quality',          name: 'Text & thông tin hiển thị',     max: 15 },
    { code: 'ai_artifacts',          name: 'Lỗi AI về hình ảnh / nhân vật', max: 15 },
    { code: 'education_suitability', name: 'Phù hợp môi trường giáo dục',   max: 15 },
    { code: 'communication_risk',    name: 'Rủi ro truyền thông / pháp lý', max: 15 }
  ];
  const CRITERION_STATUS = {
    pass:    { label: 'Đạt',        badge: 'badge-success' },
    warning: { label: 'Cảnh báo',   badge: 'badge-warning' },
    fail:    { label: 'Không đạt',  badge: 'badge-danger' }
  };
  const MAX_FILE = 10 * 1024 * 1024;
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

  /* ---------- State ---------- */
  let CHECKS = [];           // snapshot list theo scope role
  let selectedFile = null;   // File đang chọn
  let previewDataUrl = null; // dataURL preview (fallback storage khi demo)
  let submitting = false;

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(opts) { if (window.MH && window.MH.toast) window.MH.toast(opts); }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function aiBadge(status) {
    const m = AI_STATUS[status] || { label: status || '—', badge: 'badge-default' };
    return '<span class="badge ' + m.badge + '">' + esc(m.label) + '</span>';
  }
  function manualBadge(status) {
    const m = MANUAL_STATUS[status] || MANUAL_STATUS.PENDING;
    return '<span class="badge ' + m.badge + '">' + esc(m.label) + '</span>';
  }
  function scoreClass(score) {
    if (score == null) return '';
    if (score >= 85) return 'bc-score--pass';
    if (score >= 70) return 'bc-score--rev';
    return 'bc-score--fail';
  }

  // Kết luận HÀNH ĐỘNG theo (trạng thái AI × nhóm nội dung) — người dùng biết
  // ngay ĐƯỢC DÙNG / CẦN SỬA / PHẢI GỬI MEDIA. Nhóm 1&2 đạt → tự dùng (planning).
  function actionVerdict(check) {
    const g = check.usage_group;
    switch (check.ai_status) {
      case 'REQUIRES_MEDIA_REVIEW':
        return { cls: 'bc-verdict--review', title: 'Bắt buộc gửi Media duyệt',
          text: 'Nội dung này CHƯA được tự đăng/dùng công khai. Đã chuyển vào hàng đợi để Media kiểm tra và phản hồi cho bạn.' };
      case 'FAIL':
        return { cls: 'bc-verdict--fail', title: 'Không đạt',
          text: 'Không nên sử dụng ảnh này. Xem lỗi bên dưới và tạo lại theo gợi ý.' };
      case 'NEEDS_REVISION':
        return { cls: 'bc-verdict--rev', title: 'Cần chỉnh sửa',
          text: 'Chỉnh theo gợi ý bên dưới rồi kiểm lại trước khi dùng.' };
      case 'PASS':
        if (g === 'group_1_internal')
          return { cls: 'bc-verdict--pass', title: 'Được dùng nội bộ',
            text: 'Đạt — dùng được trong lớp / worksheet / slide nội bộ, không cần Media duyệt.' };
        if (g === 'group_2_self_check')
          return { cls: 'bc-verdict--pass', title: 'Đủ điều kiện tự đăng',
            text: 'Đạt — chi nhánh được tự đăng. Nên đối chiếu nhanh brand guideline trước khi đăng.' };
        return { cls: 'bc-verdict--review', title: 'Cần Media duyệt',
          text: 'Đạt về hình ảnh, nhưng nhóm nội dung này vẫn cần Media duyệt trước khi dùng.' };
      case 'NEEDS_MANUAL_REVIEW':
        return { cls: 'bc-verdict--review', title: 'Chờ Media kiểm tra tay',
          text: 'AI chưa phân tích được — ảnh đã lưu và chuyển Media kiểm tra thủ công.' };
      default:
        return null;
    }
  }

  /* =====================================================================
     RULE ENGINE (mirror của Edge Function — mục 18 planning doc)
     ===================================================================== */
  function applyOverrideRules(aiResult, metadata) {
    const overrides = [];
    if (metadata.usage_group === 'group_3_media_review') {
      overrides.push('Nội dung thuộc Nhóm 3 - bắt buộc Media duyệt');
    }
    if (metadata.has_mascot && metadata.usage_channel !== 'internal_classroom') {
      overrides.push('Có mascot Cici trong nội dung công khai');
    }
    if (metadata.is_admission_or_ads) {
      overrides.push('Nội dung tuyển sinh/quảng cáo/ưu đãi/chiến dịch');
    }
    if (metadata.involves_partner) {
      overrides.push('Nội dung liên quan đối tác/trường học/đơn vị bên ngoài');
    }
    if (metadata.contains_sensitive_info) {
      overrides.push('Nội dung có thông tin nhạy cảm/học phí/chứng chỉ/cam kết');
    }
    const logoCrit = (aiResult.criteria || []).find(function (c) { return c.code === 'logo_identity'; });
    if (logoCrit && logoCrit.status === 'fail') {
      overrides.push('Logo/nhận diện CB không đạt');
    }
    if (overrides.length > 0) {
      return Object.assign({}, aiResult, {
        status: 'REQUIRES_MEDIA_REVIEW',
        requires_media_review: true,
        override_rules_triggered: (aiResult.override_rules_triggered || []).concat(overrides)
      });
    }
    return aiResult;
  }

  function statusFromScore(score) {
    if (score >= 85) return 'PASS';
    if (score >= 70) return 'NEEDS_REVISION';
    return 'FAIL';
  }

  /* =====================================================================
     DEMO MODE — mô phỏng kết quả AI khi Supabase/Edge Function chưa nối.
     Deterministic theo title (không random mỗi lần bấm) + degrade theo flags.
     ===================================================================== */
  function seededRand(seedStr) {
    let h = 2166136261;
    const s = String(seedStr || 'cb');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function simulateAiResult(metadata) {
    const rnd = seededRand(metadata.title + '|' + (metadata.image_file_name || ''));
    const criteria = CRITERIA_DEF.map(function (def) {
      // 0.82–1.0 của max, trừ điểm theo flag liên quan
      let ratio = 0.82 + rnd() * 0.18;
      if (def.code === 'logo_identity' && metadata.has_logo) ratio -= rnd() * 0.3;
      if (def.code === 'communication_risk' && (metadata.is_admission_or_ads || metadata.involves_partner)) ratio -= rnd() * 0.35;
      if (def.code === 'education_suitability' && metadata.has_cb_facility) ratio -= rnd() * 0.2;
      if (def.code === 'ai_artifacts') ratio -= rnd() * 0.2;
      ratio = Math.max(0.35, Math.min(1, ratio));
      const score = Math.round(def.max * ratio);
      const st = ratio >= 0.85 ? 'pass' : (ratio >= 0.65 ? 'warning' : 'fail');
      return {
        code: def.code, name: def.name, status: st, score: score, max_score: def.max,
        findings: st === 'pass'
          ? 'Không phát hiện vấn đề đáng kể (kết quả mô phỏng demo).'
          : 'Có dấu hiệu cần kiểm tra thủ công ở nhóm tiêu chí này (kết quả mô phỏng demo).',
        recommendation: st === 'pass'
          ? 'Giữ nguyên, đối chiếu nhanh với brand guideline trước khi dùng.'
          : 'Kiểm tra kỹ chi tiết ' + def.name.toLowerCase() + ' và chỉnh sửa trước khi sử dụng.'
      };
    });
    const total = criteria.reduce(function (s, c) { return s + c.score; }, 0);
    let result = {
      overall_score: total,
      status: statusFromScore(total),
      risk_group_recommendation: metadata.usage_group || 'group_2_self_check',
      requires_media_review: false,
      summary: '[DEMO] Kết quả mô phỏng — chưa kết nối AI Vision. Điểm và nhận xét chỉ minh họa flow, KHÔNG dùng làm căn cứ duyệt thật.',
      criteria: criteria,
      detected_issues: criteria.filter(function (c) { return c.status !== 'pass'; })
        .map(function (c) { return c.name + ': cần kiểm tra thủ công'; }),
      required_actions: ['Kết nối Supabase + deploy Edge Function brand-check-analyze để chấm điểm thật'],
      override_rules_triggered: [],
      confidence: 'low'
    };
    result = applyOverrideRules(result, metadata);
    return result;
  }

  /* =====================================================================
     AI CALL — Edge Function `brand-check-analyze`
     ===================================================================== */
  async function invokeAnalyze(storagePath, mimeType, metadata) {
    await window.MH.supabaseReady;
    const client = window.MH.supabase;
    const { data, error } = await client.functions.invoke('brand-check-analyze', {
      body: { storage_path: storagePath, mime_type: mimeType, metadata: metadata }
    });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  // AI lỗi/chưa deploy → kết quả fallback: rủi ro cao → REQUIRES_MEDIA_REVIEW, còn lại chờ duyệt tay.
  function fallbackResult(metadata, reason) {
    const risky = metadata.usage_group === 'group_3_media_review' || metadata.has_mascot
      || metadata.is_admission_or_ads || metadata.involves_partner || metadata.contains_sensitive_info;
    let result = {
      overall_score: null,
      status: risky ? 'REQUIRES_MEDIA_REVIEW' : 'NEEDS_MANUAL_REVIEW',
      risk_group_recommendation: metadata.usage_group || 'group_2_self_check',
      requires_media_review: risky,
      summary: 'AI Vision không phân tích được (' + reason + '). Ảnh đã được lưu — cần Media kiểm tra thủ công.',
      criteria: [],
      detected_issues: [],
      required_actions: ['Media kiểm tra thủ công theo checklist thương hiệu'],
      override_rules_triggered: [],
      confidence: 'low'
    };
    // Vẫn chạy override để log lý do bắt buộc duyệt.
    const applied = applyOverrideRules(result, metadata);
    if (applied.status === 'REQUIRES_MEDIA_REVIEW') return applied;
    return result;
  }

  /* =====================================================================
     SUBMIT FLOW
     ===================================================================== */
  function collectMetadata() {
    const groupInput = document.querySelector('input[name="bc-group"]:checked');
    return {
      title: $('bc-title').value.trim(),
      unit_name: $('bc-unit').value.trim(),
      branch_name: $('bc-branch').value.trim(),
      usage_purpose: $('bc-purpose').value,
      usage_channel: $('bc-channel').value,
      usage_group: groupInput ? groupInput.value : '',
      planned_publish_date: $('bc-date').value || null,
      has_logo: $('bc-f-logo').checked,
      has_mascot: $('bc-f-mascot').checked,
      has_uniform: $('bc-f-uniform').checked,
      has_cb_facility: $('bc-f-facility').checked,
      is_admission_or_ads: $('bc-f-ads').checked,
      involves_partner: $('bc-f-partner').checked,
      contains_sensitive_info: $('bc-f-sensitive').checked,
      image_file_name: selectedFile ? selectedFile.name : null
    };
  }

  function validateForm(silent) {
    const meta = collectMetadata();
    const problems = [];
    if (!meta.title) problems.push('tên nội dung');
    if (!meta.usage_group) problems.push('nhóm nội dung');
    if (!selectedFile) problems.push('ảnh cần kiểm tra');
    const hint = $('bc-submit-hint');
    if (hint) {
      hint.textContent = problems.length
        ? 'Còn thiếu: ' + problems.join(', ') + '.'
        : 'Sẵn sàng — bấm "Kiểm tra thương hiệu".';
    }
    $('bc-submit').disabled = problems.length > 0 || submitting || isSupervisor;
    if (!silent && problems.length) {
      toast({ type: 'warning', title: 'Thiếu thông tin', msg: 'Vui lòng bổ sung: ' + problems.join(', ') + '.' });
    }
    return problems.length === 0;
  }

  async function doSubmit() {
    if (submitting || !validateForm(false)) return;
    if (isSupervisor) { toast({ type: 'info', title: 'Chế độ giám sát', msg: 'System Supervisor chỉ xem, không tạo lượt kiểm.' }); return; }
    submitting = true;
    const btn = $('bc-submit');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="bc-spinner"></span> Đang phân tích hình ảnh…';

    const meta = collectMetadata();
    let aiResult = null;
    let aiProvider = DEMO ? 'demo' : 'edge';
    let storagePath = null;
    let imageUrl = null;
    let uploaderId = null;

    try {
      if (!DEMO) {
        // 1) Xác định uid Supabase (uploader_id phải = auth.uid() để qua RLS).
        const me = await window.MH.store.users.me();
        if (!me || !me.id) throw new Error('Không xác định được tài khoản đăng nhập.');
        uploaderId = me.id;

        // 2) Upload ảnh vào bucket private.
        const checkKey = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const safeName = selectedFile.name.replace(/[^\w.\-]+/g, '_').slice(-80);
        storagePath = uploaderId + '/' + checkKey + '/' + Date.now() + '-' + safeName;
        await window.MH.store.files.upload('brand-check-images', storagePath, selectedFile, {
          contentType: selectedFile.type, upsert: false
        });

        // 3) Gọi Edge Function phân tích.
        try {
          aiResult = await invokeAnalyze(storagePath, selectedFile.type, meta);
          aiProvider = aiResult._provider || 'edge';
        } catch (fnErr) {
          console.warn('[brand-check] Edge Function lỗi:', fnErr);
          aiResult = fallbackResult(meta, String(fnErr && fnErr.message || fnErr).slice(0, 120));
          aiProvider = 'fallback';
          toast({ type: 'warning', title: 'AI Vision chưa sẵn sàng', msg: 'Đã lưu ảnh và chuyển trạng thái chờ duyệt thủ công.' });
        }
      } else {
        // DEMO: không backend — mô phỏng kết quả, ảnh nhỏ lưu dataURL để preview lại.
        aiResult = simulateAiResult(meta);
        aiProvider = 'demo';
        if (previewDataUrl && selectedFile.size <= 800 * 1024) imageUrl = previewDataUrl;
      }

      // 4) Lưu record. (DEMO → localStorage · else → Supabase; check_code do trigger/local gán)
      const row = {
        title: meta.title,
        uploader_id: uploaderId,
        uploader_name: user.name || null,
        uploader_email: user.email || null,
        unit_name: meta.unit_name || null,
        branch_name: meta.branch_name || null,
        usage_purpose: meta.usage_purpose || null,
        usage_channel: meta.usage_channel || null,
        usage_group: meta.usage_group,
        planned_publish_date: meta.planned_publish_date,
        has_logo: meta.has_logo,
        has_mascot: meta.has_mascot,
        has_uniform: meta.has_uniform,
        has_cb_facility: meta.has_cb_facility,
        is_admission_or_ads: meta.is_admission_or_ads,
        involves_partner: meta.involves_partner,
        contains_sensitive_info: meta.contains_sensitive_info,
        image_url: imageUrl,
        image_storage_path: storagePath,
        image_file_name: selectedFile.name,
        image_file_size: selectedFile.size,
        image_mime_type: selectedFile.type,
        ai_score: aiResult.overall_score,
        ai_status: aiResult.status,
        ai_summary: aiResult.summary,
        ai_result_json: aiResult,
        ai_provider: aiProvider,
        ai_confidence: aiResult.confidence || null,
        override_rules: aiResult.override_rules_triggered || [],
        manual_status: 'PENDING'
      };
      const saved = await db.create(row);
      const savedId = saved && saved.id;

      // 5) Lưu criteria (bảng riêng ở Supabase; fallback inline trong row).
      if (savedId && (aiResult.criteria || []).length) {
        await db.addCriteria(savedId, aiResult.criteria.map(function (c) {
          return {
            criterion_code: c.code, criterion_name: c.name, status: c.status,
            score: c.score, max_score: c.max_score, findings: c.findings, recommendation: c.recommendation
          };
        }));
      }

      // 6) Notify Media khi bắt buộc duyệt / chờ duyệt tay (chỉ khi có backend).
      if (!DEMO && (aiResult.status === 'REQUIRES_MEDIA_REVIEW' || aiResult.status === 'NEEDS_MANUAL_REVIEW')) {
        notifyMedia(saved, aiResult).catch(function (e) { console.warn('[brand-check] notify lỗi:', e); });
      }

      // 7) Audit log (best-effort — bỏ qua khi DEMO).
      if (!DEMO) {
        window.MH.store.activity.log({
          action: 'brand_check_created',
          entity_type: 'brand_checks',
          entity_id: savedId || null
        });
      }

      // 8) Refresh list + mở drawer kết quả.
      await loadChecks();
      renderHistory();
      renderDashboard();
      resetForm();
      const statusLabel = AI_STATUS[aiResult.status] ? AI_STATUS[aiResult.status].label : aiResult.status;
      toast({ type: 'success', title: 'Đã kiểm tra xong · ' + (saved.check_code || ''), msg: statusLabel });
      if (savedId) openDrawer(savedId);
    } catch (err) {
      console.error('[brand-check] submit lỗi:', err);
      toast({ type: 'error', title: 'Không kiểm tra được', msg: String(err && err.message || err).slice(0, 160) });
    } finally {
      submitting = false;
      btn.innerHTML = originalHtml;
      validateForm(true);
    }
  }

  // Thông báo cho admin + lead_media (type 'system' — nằm trong CHECK constraint notifications).
  async function notifyMedia(saved, aiResult) {
    const users = await window.MH.store.users.list();
    const targets = (users || []).filter(function (u) {
      return u && (u.role === 'admin' || u.role === 'lead_media') && u.id;
    });
    const title = aiResult.status === 'REQUIRES_MEDIA_REVIEW'
      ? 'Brand check bắt buộc Media duyệt'
      : 'Brand check chờ duyệt thủ công (AI lỗi)';
    for (let i = 0; i < targets.length; i++) {
      await window.MH.store.notifications.create({
        user_id: targets[i].id,
        type: 'system',
        title: title,
        message: (saved.title || 'Không tên') + ' — ' + (saved.uploader_name || saved.uploader_email || 'không rõ người upload'),
        link: 'brand-check.html?id=' + saved.id,
        related_entity_type: null,
        related_entity_id: String(saved.id)
      });
    }
  }

  /* =====================================================================
     LOAD + HISTORY
     ===================================================================== */
  async function loadChecks() {
    let list = await db.list();
    if (!seesAll) {
      // Backend thật: RLS đã scope theo uploader. DEMO: lọc theo email ở client.
      list = (list || []).filter(function (c) {
        if (!DEMO) return true;
        return c.uploader_email === user.email;
      });
    }
    CHECKS = list || [];
    // Build datalist chi nhánh từ data sẵn có.
    const dl = $('bc-branch-list');
    if (dl) {
      const branches = {};
      CHECKS.forEach(function (c) { if (c.branch_name) branches[c.branch_name] = 1; });
      dl.innerHTML = Object.keys(branches).map(function (b) { return '<option value="' + esc(b) + '"></option>'; }).join('');
    }
  }

  function filteredChecks() {
    const q = ($('bc-search').value || '').toLowerCase().trim();
    const fs = $('bc-filter-status').value;
    const fm = $('bc-filter-manual').value;
    const fg = $('bc-filter-group').value;
    return CHECKS.filter(function (c) {
      if (fs && c.ai_status !== fs) return false;
      if (fm && (c.manual_status || 'PENDING') !== fm) return false;
      if (fg && c.usage_group !== fg) return false;
      if (q) {
        const hay = [c.title, c.uploader_name, c.uploader_email, c.branch_name, c.unit_name].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function renderHistory() {
    const tbody = $('bc-tbody');
    const empty = $('bc-history-empty');
    if (!tbody) return;
    const list = filteredChecks();
    empty.hidden = list.length > 0;
    tbody.innerHTML = list.map(function (c) {
      return '<tr data-id="' + esc(c.id) + '" tabindex="0">'
        + '<td class="project-cell"><span class="bc-code-cell">' + esc(c.check_code || ('#' + String(c.id).slice(0, 6))) + '</span><b>' + esc(c.title || 'Không tên') + '</b><span>' + esc(c.image_file_name || '') + '</span></td>'
        + '<td class="requester-cell"><b>' + esc(c.uploader_name || c.uploader_email || '—') + '</b><span>' + esc([c.branch_name, c.unit_name].filter(Boolean).join(' · ')) + '</span></td>'
        + '<td><span class="text-xs">' + esc(GROUP_LABEL[c.usage_group] || '—') + '</span></td>'
        + '<td><b class="bc-score ' + scoreClass(c.ai_score) + '">' + (c.ai_score == null ? '—' : c.ai_score) + '</b></td>'
        + '<td>' + aiBadge(c.ai_status) + '</td>'
        + '<td>' + manualBadge(c.manual_status || 'PENDING') + '</td>'
        + '<td class="text-xs muted">' + fmtDate(c.created_at) + '</td>'
        + '</tr>';
    }).join('');
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openDrawer(tr.getAttribute('data-id')); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDrawer(tr.getAttribute('data-id')); });
    });
  }

  /* ---------- CSV export ---------- */
  function exportCsv() {
    const rows = filteredChecks();
    if (!rows.length) { toast({ type: 'info', title: 'Không có dữ liệu để xuất' }); return; }
    const header = ['check_code', 'title', 'uploader', 'branch', 'unit', 'usage_group', 'usage_channel', 'ai_score', 'ai_status', 'manual_status', 'override_rules', 'created_at', 'id'];
    const lines = [header.join(',')].concat(rows.map(function (c) {
      const cell = function (v) {
        const s = String(v == null ? '' : v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? '"' + s + '"' : s;
      };
      return [
        c.check_code || '', c.title, c.uploader_name || c.uploader_email, c.branch_name, c.unit_name,
        c.usage_group, c.usage_channel, c.ai_score, c.ai_status, c.manual_status || 'PENDING',
        (Array.isArray(c.override_rules) ? c.override_rules.join(' | ') : ''), c.created_at, c.id
      ].map(cell).join(',');
    }));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'brand-checks-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* =====================================================================
     DASHBOARD (Media)
     ===================================================================== */
  function pct(n, total) { return total ? Math.round(n * 100 / total) : 0; }

  function kpiCard(label, value, sub) {
    return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div>'
      + '<div class="kpi-value">' + value + '</div>'
      + (sub ? '<div class="kpi-sub text-xs muted">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  function barRow(label, count, maxCount, cls) {
    const w = maxCount ? Math.max(3, Math.round(count * 100 / maxCount)) : 0;
    return '<div class="bc-bar-row"><span class="bc-bar-label">' + esc(label) + '</span>'
      + '<span class="bc-bar-track"><i class="' + (cls || '') + '" style="width:' + w + '%"></i></span>'
      + '<b class="bc-bar-num">' + count + '</b></div>';
  }

  function renderDashboard() {
    const kpis = $('bc-kpis');
    if (!kpis) return;
    const total = CHECKS.length;
    const byStatus = {};
    CHECKS.forEach(function (c) { byStatus[c.ai_status] = (byStatus[c.ai_status] || 0) + 1; });
    const pending = CHECKS.filter(function (c) { return (c.manual_status || 'PENDING') === 'PENDING' && (c.ai_status === 'REQUIRES_MEDIA_REVIEW' || c.ai_status === 'NEEDS_MANUAL_REVIEW'); }).length;

    kpis.innerHTML =
      kpiCard('Tổng lượt kiểm', total, '')
      + kpiCard('Tỷ lệ Đạt', pct(byStatus.PASS || 0, total) + '%', (byStatus.PASS || 0) + ' lượt')
      + kpiCard('Cần chỉnh sửa', pct(byStatus.NEEDS_REVISION || 0, total) + '%', (byStatus.NEEDS_REVISION || 0) + ' lượt')
      + kpiCard('Không đạt', pct(byStatus.FAIL || 0, total) + '%', (byStatus.FAIL || 0) + ' lượt')
      + kpiCard('Bắt buộc Media duyệt', (byStatus.REQUIRES_MEDIA_REVIEW || 0), 'chờ hậu kiểm: ' + pending);

    // Phân bố kết quả AI
    const stEl = $('bc-chart-status');
    const stOrder = ['PASS', 'NEEDS_REVISION', 'FAIL', 'REQUIRES_MEDIA_REVIEW', 'NEEDS_MANUAL_REVIEW'];
    const stMax = Math.max.apply(null, stOrder.map(function (s) { return byStatus[s] || 0; }).concat([1]));
    stEl.innerHTML = total
      ? stOrder.map(function (s) {
          return barRow(AI_STATUS[s].label, byStatus[s] || 0, stMax,
            s === 'PASS' ? 'bc-fill--pass' : (s === 'NEEDS_REVISION' ? 'bc-fill--rev' : 'bc-fill--fail'));
        }).join('')
      : emptyChart();

    // Top lỗi theo tiêu chí (đọc từ ai_result_json.criteria — không cần query bảng con)
    const critCount = {};
    CHECKS.forEach(function (c) {
      const crits = (c.ai_result_json && c.ai_result_json.criteria) || c.criteria || [];
      crits.forEach(function (cr) {
        if (cr.status === 'fail' || cr.status === 'warning') critCount[cr.code] = (critCount[cr.code] || 0) + 1;
      });
    });
    const critRows = CRITERIA_DEF
      .map(function (d) { return { name: d.name, n: critCount[d.code] || 0 }; })
      .sort(function (a, b) { return b.n - a.n; });
    const critMax = Math.max.apply(null, critRows.map(function (r) { return r.n; }).concat([1]));
    $('bc-chart-criteria').innerHTML = critRows.some(function (r) { return r.n > 0; })
      ? critRows.map(function (r) { return barRow(r.name, r.n, critMax, 'bc-fill--rev'); }).join('')
      : emptyChart();

    // Theo chi nhánh/đơn vị (top 6)
    const unitCount = {};
    CHECKS.forEach(function (c) {
      const key = c.branch_name || c.unit_name || 'Không rõ';
      unitCount[key] = (unitCount[key] || 0) + 1;
    });
    const unitRows = Object.keys(unitCount)
      .map(function (k) { return { name: k, n: unitCount[k] }; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 6);
    const unitMax = Math.max.apply(null, unitRows.map(function (r) { return r.n; }).concat([1]));
    $('bc-chart-unit').innerHTML = unitRows.length
      ? unitRows.map(function (r) { return barRow(r.name, r.n, unitMax, 'bc-fill--navy'); }).join('')
      : emptyChart();

    // Trend 14 ngày
    const days = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      days.push({ key: d.toISOString().slice(0, 10), label: (d.getDate()) + '/' + (d.getMonth() + 1), n: 0 });
    }
    CHECKS.forEach(function (c) {
      const key = String(c.created_at || '').slice(0, 10);
      const day = days.find(function (d) { return d.key === key; });
      if (day) day.n++;
    });
    const trendMax = Math.max.apply(null, days.map(function (d) { return d.n; }).concat([1]));
    $('bc-chart-trend').innerHTML = CHECKS.length
      ? days.map(function (d) {
          const h = Math.max(4, Math.round(d.n * 100 / trendMax));
          return '<div class="bc-trend-col" title="' + d.label + ': ' + d.n + ' lượt">'
            + '<i style="height:' + h + '%"></i><span>' + d.label + '</span></div>';
        }).join('')
      : emptyChart();
  }

  function emptyChart() {
    return '<div class="bc-chart-empty text-xs muted">Chưa có dữ liệu.</div>';
  }

  /* =====================================================================
     DRAWER — chi tiết kết quả + manual review
     ===================================================================== */
  let drawerCheckId = null;

  async function openDrawer(id) {
    const check = CHECKS.find(function (c) { return String(c.id) === String(id); })
      || await db.get(id);
    if (!check) { toast({ type: 'error', title: 'Không tìm thấy lượt kiểm' }); return; }
    drawerCheckId = check.id;

    $('bcd-id').textContent = check.check_code || ('CHECK · ' + String(check.id).slice(0, 8).toUpperCase());
    $('bcd-title').textContent = check.title || 'Không tên';
    $('bcd-badges').innerHTML = aiBadge(check.ai_status) + ' ' + manualBadge(check.manual_status || 'PENDING')
      + (check.ai_provider === 'demo' ? ' <span class="badge badge-info">DEMO</span>' : '');

    const body = $('bc-drawer-body');
    const ai = check.ai_result_json || {};
    const crits = (ai.criteria && ai.criteria.length) ? ai.criteria : (check.criteria || []);
    const overrides = Array.isArray(check.override_rules) && check.override_rules.length
      ? check.override_rules : (ai.override_rules_triggered || []);

    const verdict = actionVerdict(check);
    body.innerHTML =
      // Kết luận hành động (nổi bật, ai cũng đọc được ngay)
      (verdict
        ? '<div class="bc-verdict ' + verdict.cls + '"><b>' + esc(verdict.title) + '</b><span>' + esc(verdict.text) + '</span></div>'
        : '')
      // Ảnh
      + '<div class="bc-d-section"><div class="bc-d-img" id="bcd-img-wrap">'
        + '<div class="bc-d-img-loading text-xs muted">Đang tải ảnh…</div>'
      + '</div>'
      + '<div class="text-xs muted">' + esc(check.image_file_name || '') + ' · ' + fmtSize(check.image_file_size) + '</div></div>'

      // Điểm + kết luận
      + '<div class="bc-d-section bc-d-scorebox">'
        + '<div class="bc-d-score ' + scoreClass(check.ai_score) + '"><b>' + (check.ai_score == null ? '—' : check.ai_score) + '</b><span>/100</span></div>'
        + '<div class="bc-d-verdict">'
          + '<div>' + aiBadge(check.ai_status) + (check.ai_confidence ? ' <span class="text-xs muted">confidence: ' + esc(check.ai_confidence) + '</span>' : '') + '</div>'
          + '<p>' + esc(check.ai_summary || ai.summary || '—') + '</p>'
        + '</div>'
      + '</div>'

      // Rule override
      + (overrides.length
        ? '<div class="bc-d-section bc-d-overrides"><h4>Rule override đã kích hoạt</h4><ul>'
          + overrides.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('')
          + '</ul><p class="text-xs muted">Dù điểm cao, nội dung này vẫn phải gửi Media duyệt trước khi sử dụng.</p></div>'
        : '')

      // Bảng tiêu chí
      + '<div class="bc-d-section"><h4>Tiêu chí đánh giá</h4>'
      + (crits.length
        ? '<table class="data-table bc-crit-table"><thead><tr><th>Tiêu chí</th><th>Trạng thái</th><th>Điểm</th></tr></thead><tbody>'
          + crits.map(function (c) {
              const st = CRITERION_STATUS[c.status] || { label: c.status, badge: 'badge-default' };
              return '<tr><td><b>' + esc(c.criterion_name || c.name) + '</b>'
                + (c.findings ? '<span class="bc-crit-note">' + esc(c.findings) + '</span>' : '')
                + (c.recommendation ? '<span class="bc-crit-note bc-crit-rec">→ ' + esc(c.recommendation) + '</span>' : '')
                + '</td>'
                + '<td><span class="badge ' + st.badge + '">' + esc(st.label) + '</span></td>'
                + '<td><b>' + (c.score == null ? '—' : c.score) + '</b><span class="text-xs muted">/' + (c.max_score || '—') + '</span></td></tr>';
            }).join('')
          + '</tbody></table>'
        : '<p class="text-xs muted">AI không trả tiêu chí chi tiết (chờ duyệt thủ công).</p>')
      + '</div>'

      // Lỗi + hành động
      + ((ai.detected_issues || []).length
        ? '<div class="bc-d-section"><h4>Lỗi phát hiện</h4><ul class="bc-d-list">'
          + ai.detected_issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>'
        : '')
      + ((ai.required_actions || []).length
        ? '<div class="bc-d-section"><h4>Hành động cần làm</h4><ul class="bc-d-list bc-d-list--action">'
          + ai.required_actions.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>'
        : '')

      // Metadata
      + '<div class="bc-d-section"><h4>Thông tin khai báo</h4><dl class="bc-d-meta">'
        + metaRow('Mã kiểm duyệt', check.check_code || '—')
        + metaRow('Người upload', (check.uploader_name || '—') + (check.uploader_email ? ' · ' + check.uploader_email : ''))
        + metaRow('Chi nhánh / đơn vị', [check.branch_name, check.unit_name].filter(Boolean).join(' · ') || '—')
        + metaRow('Nhóm nội dung', GROUP_LABEL[check.usage_group] || '—')
        + metaRow('Mục đích / kênh', [check.usage_purpose, check.usage_channel].filter(Boolean).join(' · ') || '—')
        + metaRow('Ngày dự kiến dùng', check.planned_publish_date || '—')
        + metaRow('Flags', flagsText(check))
        + metaRow('Ngày kiểm', fmtDate(check.created_at))
        + metaRow('AI provider', check.ai_provider || '—')
      + '</dl></div>'

      // Manual review panel (Media)
      + buildManualPanel(check);

    // Ảnh: dataURL (demo) hoặc signed URL (bucket private).
    loadDrawerImage(check);

    // Wire manual review buttons.
    if (isMedia) {
      body.querySelectorAll('[data-manual]').forEach(function (b) {
        b.addEventListener('click', function () { saveManualReview(b.getAttribute('data-manual')); });
      });
    }

    $('bc-drawer').classList.add('is-open');
    $('bc-drawer-backdrop').classList.add('is-open');
  }

  function metaRow(k, v) { return '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>'; }

  function flagsText(c) {
    const parts = [];
    if (c.has_logo) parts.push('logo CB');
    if (c.has_mascot) parts.push('mascot Cici');
    if (c.has_uniform) parts.push('đồng phục');
    if (c.has_cb_facility) parts.push('cơ sở/bảng hiệu CB');
    if (c.is_admission_or_ads) parts.push('tuyển sinh/quảng cáo');
    if (c.involves_partner) parts.push('đối tác');
    if (c.contains_sensitive_info) parts.push('thông tin nhạy cảm');
    return parts.length ? parts.join(', ') : 'không';
  }

  async function loadDrawerImage(check) {
    const wrap = $('bcd-img-wrap');
    if (!wrap) return;
    let url = check.image_url || null;
    if (!url && check.image_storage_path && !DEMO) {
      url = await window.MH.store.files.signedUrl('brand-check-images', check.image_storage_path, 3600);
    }
    if (url) {
      wrap.innerHTML = '<img src="' + esc(url) + '" alt="Ảnh kiểm duyệt" />';
    } else {
      wrap.innerHTML = '<div class="bc-d-img-loading text-xs muted">Không có ảnh lưu trữ (demo offline chỉ giữ ảnh ≤ 400KB).</div>';
    }
  }

  function buildManualPanel(check) {
    if (!isMedia) {
      if (isSupervisor) return '';
      // Người upload thấy trạng thái + ghi chú của Media (read-only).
      return check.manual_note
        ? '<div class="bc-d-section"><h4>Ghi chú của Media</h4><p>' + esc(check.manual_note) + '</p>'
          + (check.manual_reviewer_name ? '<span class="text-xs muted">— ' + esc(check.manual_reviewer_name) + ', ' + fmtDate(check.reviewed_at) + '</span>' : '')
          + '</div>'
        : '';
    }
    return '<div class="bc-d-section bc-d-manual"><h4>Hậu kiểm của Media</h4>'
      + '<div class="field"><label for="bcd-manual-note">Ghi chú</label>'
      + '<textarea class="textarea" id="bcd-manual-note" rows="3" placeholder="Lý do duyệt / yêu cầu chỉnh / từ chối…">' + esc(check.manual_note || '') + '</textarea></div>'
      + '<div class="bc-d-manual-actions">'
      + '<button class="btn btn-primary btn-sm" data-manual="APPROVED">Duyệt (Approved)</button>'
      + '<button class="btn btn-secondary btn-sm" data-manual="REVISION_REQUIRED">Yêu cầu chỉnh sửa</button>'
      + '<button class="btn btn-secondary btn-sm bc-btn-danger" data-manual="REJECTED">Từ chối</button>'
      + '<button class="btn btn-ghost btn-sm" data-manual="ARCHIVED">Lưu trữ</button>'
      + '</div>'
      + (check.manual_reviewer_name
        ? '<span class="text-xs muted">Lần hậu kiểm gần nhất: ' + esc(check.manual_reviewer_name) + ' · ' + fmtDate(check.reviewed_at) + '</span>'
        : '')
      + '</div>';
  }

  async function saveManualReview(status) {
    if (!drawerCheckId || !isMedia) return;
    const note = ($('bcd-manual-note') && $('bcd-manual-note').value.trim()) || null;
    try {
      const patch = {
        manual_status: status,
        manual_note: note,
        manual_reviewer_name: user.name || user.email || user.role,
        reviewed_at: new Date().toISOString()
      };
      if (!DEMO) {
        const me = await window.MH.store.users.me();
        if (me && me.id) patch.manual_reviewer_id = me.id;
      }
      const updated = await db.update(drawerCheckId, patch);
      // Notify người upload (nếu backend + có uploader_id).
      if (!DEMO && updated && updated.uploader_id) {
        window.MH.store.notifications.create({
          user_id: updated.uploader_id,
          type: 'system',
          title: 'Media đã hậu kiểm: ' + (MANUAL_STATUS[status] ? MANUAL_STATUS[status].label : status),
          message: (updated.title || 'Brand check') + (note ? ' — ' + note.slice(0, 120) : ''),
          link: 'brand-check.html?id=' + updated.id,
          related_entity_type: null,
          related_entity_id: String(updated.id)
        }).catch(function (e) { console.warn('[brand-check] notify uploader lỗi:', e); });
      }
      window.MH.store.activity.log({ action: 'brand_check_manual_review', entity_type: 'brand_checks', entity_id: drawerCheckId });
      toast({ type: 'success', title: 'Đã lưu hậu kiểm', msg: MANUAL_STATUS[status] ? MANUAL_STATUS[status].label : status });
      await loadChecks();
      renderHistory();
      renderDashboard();
      openDrawer(drawerCheckId);
    } catch (err) {
      console.error('[brand-check] manual review lỗi:', err);
      toast({ type: 'error', title: 'Không lưu được hậu kiểm', msg: String(err && err.message || err).slice(0, 160) });
    }
  }

  function closeDrawer() {
    drawerCheckId = null;
    $('bc-drawer').classList.remove('is-open');
    $('bc-drawer-backdrop').classList.remove('is-open');
    // Xóa ?id= khỏi URL cho sạch deep-link.
    if (location.search.indexOf('id=') >= 0) history.replaceState(null, '', location.pathname);
  }

  /* =====================================================================
     UPLOAD / DROPZONE
     ===================================================================== */
  function handleFile(file) {
    if (!file) return;
    if (ALLOWED_MIME.indexOf(file.type) < 0) {
      toast({ type: 'error', title: 'Định dạng không hỗ trợ', msg: 'Chỉ nhận JPG, PNG, WEBP.' });
      return;
    }
    if (file.size > MAX_FILE) {
      toast({ type: 'error', title: 'Ảnh quá lớn', msg: 'Tối đa 10MB — ảnh này ' + fmtSize(file.size) + '.' });
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = function () {
      previewDataUrl = reader.result;
      $('bc-preview-img').src = previewDataUrl;
      $('bc-preview-name').textContent = file.name;
      $('bc-preview-size').textContent = file.type + ' · ' + fmtSize(file.size);
      $('bc-drop-idle').hidden = true;
      $('bc-drop-preview').hidden = false;
      validateForm(true);
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    selectedFile = null;
    previewDataUrl = null;
    $('bc-file').value = '';
    $('bc-drop-idle').hidden = false;
    $('bc-drop-preview').hidden = true;
    validateForm(true);
  }

  function resetForm() {
    clearFile();
    ['bc-title', 'bc-unit', 'bc-branch', 'bc-date'].forEach(function (id) { $(id).value = ''; });
    ['bc-purpose', 'bc-channel'].forEach(function (id) { $(id).value = ''; });
    document.querySelectorAll('input[name="bc-group"]').forEach(function (r) { r.checked = false; });
    ['bc-f-logo', 'bc-f-mascot', 'bc-f-uniform', 'bc-f-facility', 'bc-f-ads', 'bc-f-partner', 'bc-f-sensitive']
      .forEach(function (id) { $(id).checked = false; });
    validateForm(true);
  }

  /* =====================================================================
     TABS + INIT
     ===================================================================== */
  function switchView(view) {
    document.querySelectorAll('.bc-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-view') === view);
    });
    $('bc-view-new').hidden = view !== 'new';
    $('bc-view-history').hidden = view !== 'history';
    $('bc-view-dashboard').hidden = view !== 'dashboard';
    if (view === 'history') renderHistory();
    if (view === 'dashboard') renderDashboard();
  }

  async function init() {
    // Xác định chế độ (backend thật vs demo) TRƯỚC khi load/submit.
    await detectMode();
    const note = $('bc-mode-note');
    if (note) {
      note.textContent = DEMO
        ? '⚠ Chế độ DEMO (' + demoReason + ') — kết quả AI là mô phỏng, lưu tạm trên trình duyệt.'
        : '';
    }

    // Tabs
    document.querySelectorAll('.bc-tab').forEach(function (t) {
      t.addEventListener('click', function () { switchView(t.getAttribute('data-view')); });
    });
    $('bc-new-btn').addEventListener('click', function () {
      switchView('new');
      $('bc-title').focus();
    });

    // Dropzone
    const dz = $('bc-dropzone');
    const fileInput = $('bc-file');
    dz.addEventListener('click', function (e) {
      if (e.target.id === 'bc-remove-file') return;
      fileInput.click();
    });
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    fileInput.addEventListener('change', function () { handleFile(fileInput.files[0]); });
    ['dragover', 'dragenter'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-drag'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    $('bc-remove-file').addEventListener('click', function (e) { e.stopPropagation(); clearFile(); });

    // Form validate on input
    ['bc-title'].forEach(function (id) { $(id).addEventListener('input', function () { validateForm(true); }); });
    document.querySelectorAll('input[name="bc-group"]').forEach(function (r) {
      r.addEventListener('change', function () {
        // Chọn Nhóm 3 → gợi ý bật flag quảng cáo nếu chưa (không ép).
        validateForm(true);
      });
    });
    $('bc-submit').addEventListener('click', doSubmit);

    // History filters
    ['bc-search', 'bc-filter-status', 'bc-filter-manual', 'bc-filter-group'].forEach(function (id) {
      $(id).addEventListener('input', renderHistory);
      $(id).addEventListener('change', renderHistory);
    });
    $('bc-export-csv').addEventListener('click', exportCsv);

    // Drawer
    $('bc-drawer-close').addEventListener('click', closeDrawer);
    $('bc-drawer-backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    // Supervisor: khóa form tạo mới.
    if (isSupervisor) {
      $('bc-submit').disabled = true;
      const hint = $('bc-submit-hint');
      if (hint) hint.textContent = 'System Supervisor chỉ xem — không tạo lượt kiểm mới.';
    }

    validateForm(true);

    // Data
    await loadChecks();
    renderHistory();
    renderDashboard();

    // Deep-link ?id= → mở drawer + chuyển tab history.
    const params = new URLSearchParams(location.search);
    const deepId = params.get('id');
    if (deepId) {
      switchView('history');
      openDrawer(deepId);
    }

    // Realtime refresh (Media dashboard) — best-effort, chỉ khi backend thật.
    if (!DEMO && seesAll) {
      try {
        await window.MH.supabaseReady;
        window.MH.supabase
          .channel('brand-checks-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_checks' }, async function () {
            await loadChecks();
            renderHistory();
            renderDashboard();
          })
          .subscribe();
      } catch (e) { /* realtime không bắt buộc */ }
    }

    // Poll nhẹ 60s khi tab visible (giống reports.js).
    setInterval(async function () {
      if (document.visibilityState !== 'visible') return;
      await loadChecks();
      if (!$('bc-view-history').hidden) renderHistory();
      if (!$('bc-view-dashboard').hidden) renderDashboard();
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
