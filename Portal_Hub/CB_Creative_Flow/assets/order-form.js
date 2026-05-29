/* =====================================================================
   CB Media Hub — Order Form module logic
   - Auth guard: block submit if not logged in, auto-fill requester info
   - Chip / checkbox toggle states
   - Conditional deliverable groups + sub-forms per request_type
   - Section progress + scroll-spy
   - File uploader (drag/drop)
   - Autosave draft to localStorage
   - Preview Brief modal
   - Form submission → MEDIA-YYYY-NNNN order ID
   ===================================================================== */
(function () {
  'use strict';

  const DRAFT_KEY = 'mh-order-draft-v2';

  /* ===== AUTH ===== */
  const AUTH_USER = (() => {
    try { return JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { return null; }
  })();

  // Block design/editor: production roles không có quyền tạo order.
  // Admin/Account/Client + guest (sẽ được redirect login khi submit) thì OK.
  if (AUTH_USER && ['design', 'editor'].includes(AUTH_USER.role)) {
    if (window.MH && window.MH.toast) {
      window.MH.toast({
        type: 'warning',
        title: 'Không đủ quyền',
        message: 'Role ' + AUTH_USER.role + ' không tạo được order. Liên hệ Account để được hỗ trợ.',
        duration: 4500
      });
    }
    setTimeout(() => location.replace('dashboard.html'), 800);
    return;
  }

  function autofillRequester() {
    if (!AUTH_USER) return;
    const fill = (id, val) => {
      const el = document.getElementById(id);
      if (el && !el.value && val) el.value = val;
    };
    fill('requester_name', AUTH_USER.name || '');
    fill('requester_email', AUTH_USER.email || '');
    fill('requester_contact', AUTH_USER.phone || '');

    // Department/branch match
    const dept = document.getElementById('department');
    if (dept) {
      const val = AUTH_USER.department || AUTH_USER.team || '';
      const opt = [...dept.options].find(o => o.value === val || o.textContent.trim() === val);
      if (opt) dept.value = opt.value;
    }

    // Role note mapping
    const roleNote = document.getElementById('requester_role_note');
    if (roleNote && AUTH_USER.role) {
      const roleMap = { client: 'Chi nhánh', account: 'HO', admin: 'HO', design: 'HO', editor: 'HO' };
      const mapped = roleMap[AUTH_USER.role];
      if (mapped) {
        const opt = [...roleNote.options].find(o => o.value === mapped);
        if (opt) roleNote.value = opt.value;
      }
    }

    // Lock email to account (cannot submit with different email)
    const emailEl = document.getElementById('requester_email');
    if (emailEl) {
      emailEl.readOnly = true;
      emailEl.style.cssText += ';background:var(--surface-2);cursor:not-allowed;';
      emailEl.title = 'Email lấy từ tài khoản đăng nhập, không thể thay đổi.';
    }
  }

  function renderAuthBar() {
    const bar = document.getElementById('auth-gate-bar');
    if (!bar) return;
    if (AUTH_USER) {
      bar.innerHTML = `
        <span class="auth-ok-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Đang gửi với tài khoản: <b>${AUTH_USER.email}</b>
        </span>`;
    } else {
      bar.innerHTML = `
        <span class="auth-warn-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Bạn cần đăng nhập để gửi yêu cầu.
        </span>
        <a class="btn btn-primary btn-sm" id="login-to-submit-btn" href="login.html?redirect=request.html">Đăng nhập ngay</a>`;
      document.getElementById('login-to-submit-btn').addEventListener('click', (e) => {
        e.preventDefault();
        // Save draft before leaving
        try {
          const payload = { data: snapshotForm(), savedAt: Date.now() };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch (_) {}
        location.href = 'login.html?redirect=request.html';
      });
    }
  }

  // Update header login button if logged in
  function updateHeaderAuth() {
    const loginBtn = document.getElementById('header-login-btn');
    if (!loginBtn) return;
    if (AUTH_USER) {
      loginBtn.textContent = AUTH_USER.name || AUTH_USER.email;
      loginBtn.href = AUTH_USER.role === 'client' ? 'client-dashboard.html' : 'dashboard.html';
      loginBtn.title = 'Vào Dashboard';
    }
  }

  /* ---------- Chip groups (radio + checkbox) ----------
     Mỗi `.chip` là một <label> wrap <input hidden>. Browser tự toggle input
     khi click label, nên KHÔNG được toggle thủ công nữa (gây double-toggle
     làm checkbox luôn về false). Chỉ cần lắng nghe `change` để sync class. */
  function syncChips(group) {
    group.querySelectorAll('.chip').forEach((c) => {
      const input = c.querySelector('input');
      if (input) c.classList.toggle('is-active', input.checked);
    });
  }
  document.querySelectorAll('.chips').forEach((group) => {
    group.addEventListener('change', (e) => {
      if (!e.target || e.target.tagName !== 'INPUT') return;
      // For radios sharing a `name`, change only fires on the newly-checked one;
      // syncChips re-evaluates the whole group so the previously-active chip is cleared.
      syncChips(group);
    });
    syncChips(group);
  });

  /* ---------- Conditional deliverable groups + sub-forms ---------- */
  const form = document.getElementById('request-form');
  function updateConditional() {
    const selected = form.querySelector('input[name="request_type"]:checked');
    const val = selected ? selected.value : null;

    document.querySelectorAll('[data-deliverable-for]').forEach((g) => {
      const roles = g.getAttribute('data-deliverable-for').split(',').map((s) => s.trim());
      g.classList.toggle('is-active', val && roles.includes(val));
    });
    document.querySelectorAll('[data-subform-for]').forEach((g) => {
      const roles = g.getAttribute('data-subform-for').split(',').map((s) => s.trim());
      g.classList.toggle('is-active', val && roles.includes(val));
    });
    // Uncheck deliverables that are now hidden
    document.querySelectorAll('.deliverable-group:not(.is-active) input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  }
  form.querySelectorAll('input[name="request_type"]').forEach((r) => r.addEventListener('change', updateConditional));

  /* ---------- Priority → urgent reason ---------- */
  const urgentField = document.getElementById('urgent_field');
  const urgentReason = document.getElementById('urgent_reason');
  form.querySelectorAll('input[name="priority"]').forEach((r) => {
    r.addEventListener('change', () => {
      const isCritical = r.checked && r.value === 'critical';
      urgentField.style.display = isCritical ? '' : 'none';
      if (isCritical) urgentReason.setAttribute('data-conditional-req', '');
      else urgentReason.removeAttribute('data-conditional-req');
    });
  });

  /* ---------- Wording warning ---------- */
  const wordingWarn = document.getElementById('wording-warning');
  form.querySelectorAll('input[name="wording_required"]').forEach((r) => {
    r.addEventListener('change', () => {
      wordingWarn.style.display = (r.checked && r.value === 'no') ? '' : 'none';
    });
  });

  /* ---------- File uploader ---------- */
  const uploader = document.getElementById('uploader');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const files = new Map();
  function fmtSize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
  function renderFiles() {
    fileList.innerHTML = '';
    files.forEach((f, key) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <div class="ficon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div><b>${f.name}</b><span>${fmtSize(f.size)}</span></div>
        <button type="button" class="x" aria-label="Xóa tệp" data-key="${key}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
      fileList.appendChild(row);
    });
    refreshProgress();
  }
  fileList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    files.delete(btn.dataset.key); renderFiles();
  });
  function addFiles(list) {
    [...list].forEach((f) => {
      if (f.size > 100 * 1024 * 1024) {
        window.MH.toast({ type: 'warning', title: 'File quá lớn', message: `"${f.name}" vượt 100MB. Vui lòng dùng link Google Drive.` });
        return;
      }
      files.set(f.name + '-' + f.size + '-' + f.lastModified, f);
    });
    renderFiles();
  }
  fileInput.addEventListener('change', () => addFiles(fileInput.files));
  ['dragenter', 'dragover'].forEach((ev) => uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((ev) => uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.remove('is-drag'); }));
  uploader.addEventListener('drop', (e) => { if (e.dataTransfer) addFiles(e.dataTransfer.files); });

  /* ---------- Progress info (sections completed) ---------- */
  const SECTIONS = ['sec-a', 'sec-b', 'sec-c', 'sec-d', 'sec-e', 'sec-f', 'sec-g'];
  let activeSectionId = SECTIONS[0];
  function sectionCompleted(id) {
    const sec = document.getElementById(id);
    if (!sec) return false;
    if (id === 'sec-e') {
      return files.size > 0 || ['source_link', 'working_drive_link', 'asset_note'].some((fieldId) => {
        const field = document.getElementById(fieldId);
        return field && field.value.trim();
      });
    }
    const required = sec.querySelectorAll('[required], [data-conditional-req]');
    for (const el of required) {
      if (el.offsetParent === null) continue; // hidden
      if (el.type === 'checkbox') { if (!el.checked) return false; }
      else if (el.type === 'radio') { if (!sec.querySelector(`input[name="${el.name}"]:checked`)) return false; }
      else if (!el.value.trim()) return false;
    }
    // Section B chip groups
    if (id === 'sec-b') {
      if (!sec.querySelector('#target_audience input:checked')) return false;
      if (!sec.querySelector('#usage_channels input:checked')) return false;
    }
    return true;
  }
  function refreshProgress() {
    const done = SECTIONS.filter(sectionCompleted).length;
    const el = document.querySelector('#progress-info b');
    if (el) el.textContent = done;
    const currentIndex = Math.max(0, SECTIONS.indexOf(activeSectionId));
    const pct = Math.round((done / SECTIONS.length) * 100);
    const sideLabel = document.getElementById('side-progress-label');
    const sideFill = document.getElementById('side-progress-fill');
    if (sideLabel) sideLabel.textContent = 'Bước ' + (currentIndex + 1) + '/' + SECTIONS.length + ' · ' + pct + '% hoàn tất';
    if (sideFill) sideFill.style.width = pct + '%';
    document.querySelectorAll('[data-step-link]').forEach((link) => {
      const id = link.getAttribute('data-step-link');
      link.classList.toggle('is-active', id === activeSectionId);
      link.classList.toggle('is-done', sectionCompleted(id));
      link.setAttribute('aria-current', id === activeSectionId ? 'step' : 'false');
    });
  }
  form.addEventListener('input', refreshProgress);
  form.addEventListener('change', refreshProgress);

  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
    if (!visible) return;
    activeSectionId = visible.target.id;
    refreshProgress();
  }, { rootMargin: '-22% 0px -62% 0px', threshold: [0, 0.15, 0.4] });
  SECTIONS.forEach((id) => {
    const sec = document.getElementById(id);
    if (sec) sectionObserver.observe(sec);
  });
  document.querySelectorAll('[data-step-link]').forEach((link) => {
    link.addEventListener('click', () => {
      const id = link.getAttribute('data-step-link');
      if (id) {
        activeSectionId = id;
        refreshProgress();
      }
    });
  });

  /* ---------- Autosave draft to localStorage ---------- */
  const draftStatus = document.getElementById('draft-status');
  const draftMsg = document.getElementById('draft-msg');
  function snapshotForm() {
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (data[k] !== undefined) { data[k] = [].concat(data[k], v); } else { data[k] = v; }
    });
    // checkboxes in chip groups (not in FormData since they're hidden inputs)
    data.target_audience = [...document.querySelectorAll('#target_audience input:checked')].map((i) => i.value);
    data.usage_channels = [...document.querySelectorAll('#usage_channels input:checked')].map((i) => i.value);
    data.deliverable_type = [...document.querySelectorAll('input[name="deliverable_type"]:checked')].map((i) => i.value);
    return data;
  }
  function saveDraft(announce) {
    draftStatus.classList.add('is-saving');
    draftMsg.textContent = 'Đang lưu...';
    try {
      const payload = { data: snapshotForm(), savedAt: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setTimeout(() => {
        draftStatus.classList.remove('is-saving');
        const t = new Date(payload.savedAt);
        const pad = (n) => String(n).padStart(2, '0');
        draftMsg.textContent = 'Đã lưu nháp lúc ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
        if (announce) window.MH.toast({ type: 'success', title: 'Đã lưu nháp', message: 'Bản nháp sẽ tự khôi phục khi quay lại.' });
      }, 300);
    } catch (e) {
      draftStatus.classList.remove('is-saving');
      draftMsg.textContent = 'Không thể lưu nháp';
    }
  }
  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const { data, savedAt } = JSON.parse(raw);
      Object.entries(data).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach((val) => {
            const el = form.querySelector(`input[name="${k}"][value="${val}"]`);
            if (el) el.checked = true;
          });
          // chip groups
          if (k === 'target_audience') v.forEach((val) => {
            const el = document.querySelector(`#target_audience input[value="${val}"]`);
            if (el) el.checked = true;
          });
          if (k === 'usage_channels') v.forEach((val) => {
            const el = document.querySelector(`#usage_channels input[value="${val}"]`);
            if (el) el.checked = true;
          });
          if (k === 'deliverable_type') v.forEach((val) => {
            const el = document.querySelector(`input[name="deliverable_type"][value="${val}"]`);
            if (el) el.checked = true;
          });
        } else {
          const el = form.querySelector(`[name="${k}"]`);
          if (!el) return;
          if (el.type === 'radio') {
            const radio = form.querySelector(`input[name="${k}"][value="${v}"]`);
            if (radio) radio.checked = true;
          } else if (el.type === 'checkbox') {
            el.checked = (v === 'on' || v === true);
          } else {
            el.value = v;
          }
        }
      });
      // re-sync UI states
      document.querySelectorAll('.chips').forEach(syncChips);
      updateConditional();
      const t = new Date(savedAt);
      const pad = (n) => String(n).padStart(2, '0');
      draftMsg.textContent = 'Khôi phục bản nháp ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ' · ' + pad(t.getDate()) + '/' + pad(t.getMonth() + 1);
      return true;
    } catch (e) { return false; }
  }
  setInterval(() => saveDraft(false), 30000);
  document.getElementById('save-draft-btn').addEventListener('click', () => saveDraft(true));

  /* ---------- Validation ---------- */
  function clearErrors() {
    form.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error'));
    form.querySelectorAll('[data-error-for]').forEach((e) => (e.style.display = 'none'));
  }
  function markErrorField(input) {
    const field = input.closest('.field');
    if (field) field.classList.add('has-error');
  }
  function showGroupError(name) {
    const e = form.querySelector(`[data-error-for="${name}"]`);
    if (e) e.style.display = 'block';
  }
  function validate() {
    // Auth check — must be first guard
    if (!AUTH_USER) {
      window.MH.toast({ type: 'error', title: 'Chưa đăng nhập', message: 'Vui lòng đăng nhập để gửi yêu cầu.' });
      const bar = document.getElementById('auth-gate-bar');
      if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    clearErrors();
    let firstInvalid = null;
    function fail(el) { markErrorField(el); if (!firstInvalid) firstInvalid = el; }

    // Standard required
    form.querySelectorAll('[required], [data-conditional-req]').forEach((el) => {
      if (el.offsetParent === null) return; // hidden
      let ok = true;
      if (el.type === 'checkbox') ok = el.checked;
      else if (el.type === 'radio') ok = !!form.querySelector(`input[name="${el.name}"]:checked`);
      else if (el.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
      else if (el.id === 'project_purpose') ok = el.value.trim().length >= 20;
      else ok = !!el.value.trim();
      if (!ok) fail(el);
    });

    // Multi-checkbox chip groups
    if (!form.querySelector('#target_audience input:checked')) {
      showGroupError('target_audience');
      const sec = document.getElementById('sec-b');
      if (sec && !firstInvalid) firstInvalid = sec;
    }
    if (!form.querySelector('#usage_channels input:checked')) {
      showGroupError('usage_channels');
      const sec = document.getElementById('sec-b');
      if (sec && !firstInvalid) firstInvalid = sec;
    }

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { firstInvalid.focus({ preventScroll: true }); } catch (e) {}
      window.MH.toast({ type: 'error', title: 'Thiếu thông tin', message: 'Vui lòng kiểm tra các trường đánh dấu đỏ.' });
      return false;
    }
    return true;
  }

  /* ---------- Preview Brief modal ---------- */
  const previewModal = document.getElementById('preview-modal');
  const previewBody = document.getElementById('preview-body');
  const previewBtn = document.getElementById('preview-btn');
  const previewClose = document.getElementById('preview-close');
  const previewEdit = document.getElementById('preview-edit');
  const previewSubmit = document.getElementById('preview-submit');

  const REQ_TYPE_LABEL = {
    design: 'Thiết kế / POSM', digital: 'Digital Design', video: 'Video Editing',
    motion: 'Motion Graphic', shoot: 'Quay', photo: 'Chụp ảnh',
    ads: 'Ads / Post Basic', slide: 'Slide / Proposal', other: 'Khác'
  };
  const PRIORITY_LABEL = { normal: 'Bình thường', urgent: 'Gấp', critical: 'Rất gấp' };

  function buildPreview() {
    const d = snapshotForm();
    const audience = (d.target_audience || []).map((v) => `<span class="chip-mini">${v}</span>`).join('') || '<em class="muted">—</em>';
    const channels = (d.usage_channels || []).map((v) => `<span class="chip-mini">${v}</span>`).join('') || '<em class="muted">—</em>';
    const deliverables = (d.deliverable_type || []).map((v) => `<span class="chip-mini">${v}</span>`).join('') || '<em class="muted">—</em>';
    const fileList = [...files.values()].map((f) => `<span class="chip-mini">${f.name} <small class="muted">(${fmtSize(f.size)})</small></span>`).join('') || '<em class="muted">Chưa đính kèm file</em>';
    const val = (v) => v && String(v).trim() ? v : '<em class="muted">—</em>';

    return `
      <div class="preview-block">
        <h5>A. Người gửi</h5>
        <dl>
          <dt>Họ và tên</dt><dd>${val(d.requester_name)}</dd>
          <dt>Email</dt><dd>${val(d.requester_email)}</dd>
          <dt>Chi nhánh / Bộ phận</dt><dd>${val(d.department)}</dd>
          <dt>Liên hệ</dt><dd>${val(d.requester_contact)}</dd>
        </dl>
      </div>
      <div class="preview-block">
        <h5>B. Dự án</h5>
        <dl>
          <dt>Tên dự án</dt><dd>${val(d.project_name)}</dd>
          <dt>Mã kế hoạch</dt><dd>${val(d.campaign_code)}</dd>
          <dt>Mục đích</dt><dd>${val(d.project_purpose)}</dd>
          <dt>Đối tượng</dt><dd>${audience}</dd>
          <dt>Kênh sử dụng</dt><dd>${channels}</dd>
          <dt>Ngày sử dụng</dt><dd>${val(d.actual_use_date)}</dd>
        </dl>
      </div>
      <div class="preview-block">
        <h5>C. Loại yêu cầu &amp; hạng mục</h5>
        <dl>
          <dt>Loại yêu cầu</dt><dd>${val(REQ_TYPE_LABEL[d.request_type] || d.request_type)}</dd>
          <dt>Hạng mục</dt><dd>${deliverables}</dd>
          <dt>Kích thước / tỉ lệ</dt><dd>${val(d.size_ratio)}</dd>
          <dt>Số phiên bản</dt><dd>${val(d.version_quantity)}</dd>
        </dl>
      </div>
      <div class="preview-block">
        <h5>D. Nội dung &amp; định hướng</h5>
        <dl>
          <dt>Nội dung</dt><dd>${val(d.content_brief)}</dd>
          <dt>Headline</dt><dd>${val(d.main_headline)}</dd>
          <dt>CTA</dt><dd>${val(d.cta)}</dd>
          <dt>Định hướng</dt><dd>${val(d.creative_direction)}</dd>
          <dt>Wording</dt><dd>${d.wording_required === 'yes' ? 'Cần hỗ trợ wording' : (d.wording_required === 'no' ? 'Dùng đúng nội dung' : '—')}</dd>
          <dt>Link tham khảo</dt><dd>${val(d.reference_link)}</dd>
        </dl>
      </div>
      <div class="preview-block">
        <h5>E. Tài nguyên</h5>
        <dl>
          <dt>Tệp đính kèm</dt><dd>${fileList}</dd>
          <dt>Drive tài nguyên</dt><dd>${val(d.source_link)}</dd>
          <dt>Folder làm việc</dt><dd>${val(d.working_drive_link)}</dd>
        </dl>
      </div>
      <div class="preview-block">
        <h5>F. Deadline</h5>
        <dl>
          <dt>Deadline</dt><dd>${val(d.requested_deadline)} ${d.requested_deadline_time ? '· ' + d.requested_deadline_time : ''}</dd>
          <dt>Ưu tiên</dt><dd>${val(PRIORITY_LABEL[d.priority] || d.priority)}</dd>
          <dt>Cố định?</dt><dd>${d.is_fixed_deadline === 'yes' ? 'Có' : (d.is_fixed_deadline === 'no' ? 'Không' : '—')}</dd>
          ${d.priority === 'critical' ? `<dt>Lý do gấp</dt><dd>${val(d.urgent_reason)}</dd>` : ''}
        </dl>
      </div>
      <div class="preview-block">
        <h5>G. Xác nhận</h5>
        <dl>
          <dt>Trách nhiệm nội dung</dt><dd>${d.content_responsibility_confirmed === 'on' ? '<b style="color:var(--success)">✓ Đã xác nhận</b>' : '<b style="color:var(--danger)">Chưa xác nhận</b>'}</dd>
          <dt>Chính sách deadline</dt><dd>${d.deadline_policy_confirmed === 'on' ? '<b style="color:var(--success)">✓ Đã đọc</b>' : '<em class="muted">—</em>'}</dd>
        </dl>
      </div>
    `;
  }

  function openPreview() {
    if (!validate()) return;
    previewBody.innerHTML = buildPreview();
    previewModal.classList.add('is-open');
    previewModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closePreview() {
    previewModal.classList.remove('is-open');
    previewModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  previewBtn.addEventListener('click', openPreview);
  previewClose.addEventListener('click', closePreview);
  previewEdit.addEventListener('click', closePreview);
  previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closePreview(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && previewModal.classList.contains('is-open')) closePreview(); });

  /* ---------- Submit ---------- */
  async function doSubmit() {
    // Final auth guard (API layer equivalent for static site)
    if (!AUTH_USER) {
      window.MH.toast({ type: 'error', title: '401 Unauthorized', message: 'Authentication required to submit request.' });
      return;
    }
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.classList.add('is-loading');
    submitBtn.textContent = 'Đang gửi...';

    const year = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    const code = 'MEDIA-' + year + '-' + num;

    // Phase 2: upload attached brief files lên Supabase Storage `brief-files` bucket
    // nếu enabled. Trả về array {name, path, size} để lưu vào order payload.
    const briefFiles = [];
    if (window.MH && window.MH.store && window.MH.supabaseEnabled && files && files.size > 0) {
      submitBtn.textContent = 'Đang upload files...';
      let i = 0;
      for (const f of files.values()) {
        try {
          const ts = Date.now() + '-' + (i++);
          const safe = (f.name || 'brief').replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const path = code + '/brief-' + ts + '-' + safe;
          await window.MH.store.files.upload('brief-files', path, f, { contentType: f.type || 'application/octet-stream' });
          briefFiles.push({ name: f.name, path: path, size: f.size, type: f.type });
        } catch (e) {
          console.warn('[order-form] upload file failed:', e);
          window.MH.toast({ type: 'warning', title: 'Upload file lỗi', message: f.name + ' — bỏ qua, tiếp tục gửi order.' });
        }
      }
    }

    // Build order payload with requester identity
    const orderPayload = Object.assign(snapshotForm(), {
      order_id:         code,
      requester_id:     (AUTH_USER && AUTH_USER.id) || AUTH_USER.email,
      requester_email:  AUTH_USER.email,
      requester_name:   AUTH_USER.name || '',
      department:       AUTH_USER.department || AUTH_USER.team || '',
      created_by:       AUTH_USER.email,
      submitted_at:     new Date().toISOString(),
      brief_files:      briefFiles,
      file_brief_url:   briefFiles.length ? briefFiles[0].path : null
    });

    // Phase 1: persist sang Supabase `orders` nếu enabled
    let dbPersisted = false;
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      submitBtn.textContent = 'Đang lưu order...';
      try {
        // Map payload sang schema columns. Bỏ field không có trong public.orders.
        const row = {
          order_id: code,
          requester_id: (AUTH_USER && AUTH_USER.id) ? AUTH_USER.id : null,
          requester_name: orderPayload.requester_name,
          requester_email: orderPayload.requester_email,
          requester_contact: orderPayload.requester_contact || orderPayload.phone || null,
          department: orderPayload.department,
          project_name: orderPayload.project_name || orderPayload.title || 'Untitled',
          project_purpose: orderPayload.project_purpose || orderPayload.purpose || null,
          request_type: orderPayload.request_type || 'design',
          deliverable_type: orderPayload.deliverable_type || [],
          target_audience: orderPayload.target_audience || [],
          usage_channels: orderPayload.usage_channels || [],
          size_ratio: orderPayload.size_ratio || null,
          content_brief: orderPayload.content_brief || null,
          creative_direction: orderPayload.creative_direction || null,
          wording_required: !!orderPayload.wording_required,
          source_link: orderPayload.source_link || null,
          file_brief_url: orderPayload.file_brief_url,
          priority: orderPayload.priority || 'normal',
          requested_deadline: orderPayload.requested_deadline || null,
          actual_use_date: orderPayload.actual_use_date || null,
          urgent_reason: orderPayload.urgent_reason || null,
          account_status: 'pending',
          production_status: 'unassigned',
          progress: 5,
          content_responsibility_confirmed: !!orderPayload.content_responsibility_confirmed,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };
        // Chỉ pass shoot_location khi photo/shoot — backward-compat với DB chưa migrate cột này.
        const locVal = orderPayload.shooting_location || orderPayload.photo_location;
        if ((row.request_type === 'photo' || row.request_type === 'shoot') && locVal) {
          row.shoot_location = locVal;
        }
        await window.MH.store.orders.create(row);
        dbPersisted = true;

        // Notify TẤT CẢ admin + account user về order mới (realtime + bell badge)
        try {
          const { data: staff } = await window.MH.supabase
            .from('users')
            .select('id, name')
            .in('role', ['admin', 'account'])
            .eq('status', 'active');
          if (Array.isArray(staff) && staff.length) {
            const notifPayloads = staff.map(function (u) {
              return {
                user_id: u.id,
                type: 'order_new',
                title: '📥 Order mới: ' + code,
                message: (orderPayload.project_name || 'Untitled') + ' · ' + (orderPayload.requester_name || '') + ' · ' + (orderPayload.department || ''),
                link: 'database-orders.html?id=' + code,
                related_entity_type: 'orders',
                related_entity_id: code
              };
            });
            await window.MH.supabase.from('notifications').insert(notifPayloads);
          }
        } catch (e) { console.warn('[order-form] notify staff failed:', e); }
      } catch (e) {
        console.warn('[order-form] create order in Supabase failed:', e);
        window.MH.toast({ type: 'warning', title: 'Sync DB lỗi', message: 'Order lưu local. Liên hệ admin để re-submit.' });
      }
    }

    // Always also persist to localStorage (demo fallback + offline cache)
    try {
      const orders = JSON.parse(localStorage.getItem('mh-submitted-orders') || '[]');
      orders.unshift(orderPayload);
      localStorage.setItem('mh-submitted-orders', JSON.stringify(orders.slice(0, 50)));
    } catch (_) {}

    document.getElementById('order-code').textContent = code;
    const trackLink = document.getElementById('track-link');
    if (trackLink) trackLink.href = 'tracking.html?code=' + code;
    document.getElementById('form-view').classList.add('hidden');
    document.getElementById('form-section').classList.add('hidden');
    document.getElementById('success-view').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.MH.toast({
      type: 'success',
      title: 'Gửi thành công',
      message: 'Order ID: ' + code + (dbPersisted ? ' · Đã lưu DB' : ' · Demo local')
    });
    localStorage.removeItem(DRAFT_KEY);
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    closePreview();
    doSubmit();
  });
  previewSubmit.addEventListener('click', () => {
    closePreview();
    doSubmit();
  });

  /* ---------- Copy + new request ---------- */
  document.getElementById('copy-code').addEventListener('click', async () => {
    const code = document.getElementById('order-code').textContent;
    try { await navigator.clipboard.writeText(code); window.MH.toast({ type: 'success', message: 'Đã sao chép Order ID' }); } catch (e) {}
  });
  document.getElementById('new-request').addEventListener('click', () => {
    form.reset();
    files.clear(); renderFiles();
    document.querySelectorAll('.chips').forEach(syncChips);
    updateConditional();
    document.getElementById('success-view').classList.add('hidden');
    document.getElementById('form-view').classList.remove('hidden');
    document.getElementById('form-section').classList.remove('hidden');
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.classList.remove('is-loading');
    submitBtn.innerHTML = 'Submit Request <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- Init ---------- */
  updateConditional();
  refreshProgress();
  renderAuthBar();
  updateHeaderAuth();
  if (restoreDraft()) {
    refreshProgress();
    window.MH.toast({ type: 'info', title: 'Bản nháp được khôi phục', message: 'Tiếp tục từ chỗ bạn dừng. Bấm "Lưu nháp" để cập nhật.' });
  }
  // Auto-fill after draft restore so account fields override blank draft fields
  autofillRequester();
})();
