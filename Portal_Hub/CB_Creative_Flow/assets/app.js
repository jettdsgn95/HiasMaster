/* =====================================================================
   CB Media Hub — Shared application logic
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Sentry error tracking (lazy-loaded from CDN) ----------
     Skip nếu MH_CONFIG.SENTRY_DSN trống → không network call, không overhead.
     DSN public-safe theo design Sentry. */
  (function initSentry() {
    var cfg = window.MH_CONFIG || {};
    if (!cfg.SENTRY_DSN) return;
    if (window.Sentry) {
      // Đã load (page navigate cũ) — chỉ init lại
      try {
        window.Sentry.init({
          dsn: cfg.SENTRY_DSN,
          environment: cfg.SENTRY_ENV || 'production',
          release: cfg.SENTRY_RELEASE,
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0
        });
      } catch (e) { /* swallow */ }
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://browser.sentry-cdn.com/7.119.0/bundle.tracing.min.js';
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.onload = function () {
      try {
        window.Sentry.init({
          dsn: cfg.SENTRY_DSN,
          environment: cfg.SENTRY_ENV || 'production',
          release: cfg.SENTRY_RELEASE,
          tracesSampleRate: 0.1,
          beforeSend: function (event) {
            // Tag user role nếu có session để filter trong Sentry UI
            try {
              var u = JSON.parse(localStorage.getItem('mh-user') || 'null');
              if (u) {
                event.user = event.user || {};
                event.user.email = u.email;
                event.tags = event.tags || {};
                event.tags.role = u.role;
              }
            } catch (e) {}
            return event;
          }
        });
      } catch (e) { /* swallow init failure to avoid breaking app */ }
    };
    s.onerror = function () { /* CDN unreachable — silently disable */ };
    document.head.appendChild(s);
  })();

  /* ---------- Theme (light / dark / system) ---------- */
  const THEME_KEY = 'mh-theme';
  const root = document.documentElement;

  function getStoredTheme() { return localStorage.getItem(THEME_KEY); }
  function systemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    const btns = document.querySelectorAll('[data-theme-toggle]');
    btns.forEach((b) => {
      b.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      b.setAttribute('aria-label', theme === 'dark' ? 'Chuyển sang Light mode' : 'Chuyển sang Dark mode');
      // Toggle switch: CSS handles icon visibility via [data-theme] selector — no inline override
      if (b.classList.contains('theme-toggle-switch')) return;
      // Legacy icon-btn fallback (if any remain)
      const sun = b.querySelector('.icon-sun');
      const moon = b.querySelector('.icon-moon');
      if (sun && moon) {
        sun.style.display = theme === 'dark' ? 'block' : 'none';
        moon.style.display = theme === 'dark' ? 'none' : 'block';
      }
    });
  }

  const initial = getStoredTheme() || systemTheme();
  applyTheme(initial);

  // React to system change only when user hasn't picked
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getStoredTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  /* ---------- Mobile nav toggle ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-menu-toggle]');
    if (!t) return;
    const nav = document.getElementById('site-nav');
    if (!nav) return;
    const open = nav.classList.toggle('is-open');
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ---------- Active nav link ---------- */
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href === path || (path === '' && href === 'index.html')) a.classList.add('is-active');
  });

  /* ---------- Toast ---------- */
  function ensureToastWrap() {
    let w = document.querySelector('.toast-wrap');
    if (!w) {
      w = document.createElement('div');
      w.className = 'toast-wrap';
      w.setAttribute('aria-live', 'polite');
      w.setAttribute('aria-atomic', 'false');
      document.body.appendChild(w);
    }
    return w;
  }
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };
  function toast(opts) {
    const { type = 'info', title = '', message = '', duration = 4000 } = (typeof opts === 'string' ? { message: opts } : opts) || {};
    const wrap = ensureToastWrap();
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `
      <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
      <div class="grow">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-msg">${message}</div>
      </div>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 240ms, transform 240ms';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 250);
    }, duration);
  }
  window.MH = window.MH || {};
  window.MH.toast = toast;

  /* ---------- Copy helpers ---------- */
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-copy]');
    if (!t) return;
    const text = t.getAttribute('data-copy');
    try {
      await navigator.clipboard.writeText(text);
      toast({ type: 'success', title: 'Đã sao chép', message: text });
    } catch {
      toast({ type: 'error', message: 'Không thể sao chép. Vui lòng thử lại.' });
    }
  });

  /* ---------- Profile editor modal ---------- */
  const USER_KEY = 'mh-user';
  const ROLES = [
    { value: 'admin',   label: 'Admin'   },
    { value: 'account', label: 'Account' },
    { value: 'design',  label: 'Design'  },
    { value: 'editor',  label: 'Editor'  },
    { value: 'lead_media', label: 'Lead Media' },
    { value: 'system_supervisor', label: 'Giám sát hệ thống' },
    { value: 'client',  label: 'Client'  }
  ];
  const DEPARTMENTS = ['HO Marketing', 'Academic', 'Sales', 'CB Mekong', 'CB Hưng Phú', 'CB Cần Thơ', 'CB Tiên Thủy'];
  const AVATAR_MAX_PX = 256;
  const AVATAR_MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB raw upload

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
  function deriveInitials(name) {
    if (!name) return '';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function roleLabel(role) {
    if (!role) return '';
    if (role === 'lead_content') return 'Lead Content'; // tránh "Lead_content"
    if (role === 'lead_media') return 'Lead Media';      // Lead nhóm Media (Supervisor Planning)
    if (role === 'system_supervisor') return 'Giám sát hệ thống'; // monitor-only role
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
  function renderAvatarInto(el, user) {
    if (!el) return;
    if (user.avatar) {
      el.innerHTML = `<img src="${user.avatar}" alt="" />`;
      el.classList.add('has-img');
    } else {
      el.classList.remove('has-img');
      el.textContent = user.initials || deriveInitials(user.name) || '--';
    }
  }
  function refreshProfileChip(user) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.textContent = val; };
    setText('pc-name', user.name);
    setText('pc-title', user.title || '');
    const role = document.getElementById('pc-role-badge');
    if (role && user.role) {
      role.textContent = roleLabel(user.role);
      role.className = 'role-badge r--' + user.role;
    }
    renderAvatarInto(document.getElementById('pc-avatar'), user);
    if (user.role) document.body.setAttribute('data-user-role', user.role);
    refreshHeaderChip(user);
  }

  function refreshHeaderChip(user) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.textContent = val; };
    setText('hpc-name', user.name);
    const role = document.getElementById('hpc-role-badge');
    if (role && user.role) {
      role.textContent = roleLabel(user.role);
      role.className = 'role-badge r--' + user.role + ' header-pc-role';
    }
    renderAvatarInto(document.getElementById('hpc-avatar'), user);
  }

  function injectProfileStyles() {
    if (document.getElementById('mh-profile-style')) return;
    const s = document.createElement('style');
    s.id = 'mh-profile-style';
    s.textContent = `
      .avatar.has-img { padding: 0; background: var(--surface-2); overflow: hidden; border-radius: 9999px; }
      .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      #mh-profile-modal .pf-label { font-size: 12px; color: var(--text-muted); font-weight: 600; }
      #mh-profile-modal .pf-field { display: grid; gap: 6px; }
      #mh-profile-modal .pf-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      #mh-profile-modal .pf-readonly { background: var(--surface-2); color: var(--text-muted); cursor: not-allowed; }
      #mh-profile-modal .pf-avatar-block {
        display: flex; gap: 16px; align-items: center;
        padding: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius);
      }
      #mh-profile-modal .pf-avatar-block .avatar { width: 72px; height: 72px; font-size: 22px; flex-shrink: 0; border-radius: 9999px; overflow: hidden; }
      #mh-profile-modal .pf-avatar-actions { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
      #mh-profile-modal .pf-avatar-btns { display: flex; gap: 8px; flex-wrap: wrap; }
      #mh-profile-modal .pf-mini-btn { font-size: 12px; padding: 6px 12px; border-radius: var(--radius-pill); }
      #mh-profile-modal .pf-initials-row { display: flex; align-items: center; gap: 8px; }
      #mh-profile-modal .pf-initials-row label { font-size: 11px; color: var(--text-muted); }
      #mh-profile-modal #mh-pf-initials { width: 84px; padding: 6px 8px; font-size: 13px; text-align: center; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
      #mh-profile-modal #mh-pf-bio { min-height: 72px; resize: vertical; font-family: inherit; }
      #mh-profile-modal .pf-role-static { min-height: 38px; padding: 8px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; display: flex; align-items: center; }
      @media (max-width: 560px) { #mh-profile-modal .pf-row2 { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }

  function resizeImageFile(file, maxPx) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read-fail'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode-fail'));
        img.onload = () => {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return reject(new Error('empty-image'));
          if (w > h && w > maxPx) { h = Math.round((h * maxPx) / w); w = maxPx; }
          else if (h > maxPx) { w = Math.round((w * maxPx) / h); h = maxPx; }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL('image/jpeg', 0.85));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  let profileModalEl = null;
  let initialsTouched = false;
  let pendingAvatar = null; // null = unchanged, '' = removed, string = new data url

  function buildProfileModal() {
    injectProfileStyles();
    const el = document.createElement('div');
    el.className = 'form-modal';
    el.id = 'mh-profile-modal';
    el.setAttribute('aria-hidden', 'true');
    const roleOptions = ROLES.map((r) => `<option value="${r.value}">${r.label}</option>`).join('');
    const deptOptions = DEPARTMENTS.map((d) => `<option value="${d}">`).join('');
    el.innerHTML = `
      <div class="form-modal-card" style="max-width:600px;">
        <div class="form-modal-head">
          <div>
            <h3>Hồ sơ cá nhân</h3>
            <p>Cập nhật thông tin hiển thị trong portal.</p>
          </div>
          <button type="button" class="icon-btn" data-close-profile aria-label="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form id="mh-profile-form" class="form-modal-body" style="display:grid; gap:14px;" novalidate>
          <div class="pf-avatar-block">
            <span class="avatar" id="mh-pf-avatar">--</span>
            <div class="pf-avatar-actions">
              <div class="pf-avatar-btns">
                <button type="button" class="btn btn-secondary pf-mini-btn" id="mh-pf-upload">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Tải ảnh lên
                </button>
                <button type="button" class="btn btn-ghost pf-mini-btn" id="mh-pf-remove-avatar">Xóa ảnh</button>
                <input type="file" id="mh-pf-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
              </div>
              <div class="pf-initials-row">
                <label for="mh-pf-initials">Hoặc dùng chữ:</label>
                <input id="mh-pf-initials" class="input" maxlength="3" />
              </div>
              <p style="font-size:11px; color:var(--text-muted); margin:0;">PNG/JPG/WebP/GIF · tối đa 4MB · ảnh sẽ tự thu nhỏ về ${AVATAR_MAX_PX}px.</p>
            </div>
          </div>

          <div class="pf-field">
            <label class="pf-label" for="mh-pf-name">Họ và tên <span style="color:var(--red-600)">*</span></label>
            <input id="mh-pf-name" class="input" required maxlength="60" />
          </div>

          <div class="pf-row2">
            <div class="pf-field">
              <label class="pf-label" for="mh-pf-email">Email</label>
              <input id="mh-pf-email" class="input pf-readonly" type="email" readonly />
            </div>
            <div class="pf-field">
              <label class="pf-label" for="mh-pf-role">Vai trò</label>
              <select id="mh-pf-role" class="select" hidden>${roleOptions}</select>
              <div id="mh-pf-role-static" class="pf-role-static">
                <span id="mh-pf-role-badge" class="role-badge"></span>
              </div>
            </div>
          </div>

          <div class="pf-row2">
            <div class="pf-field">
              <label class="pf-label" for="mh-pf-title">Chức danh</label>
              <input id="mh-pf-title" class="input" maxlength="80" placeholder="Ví dụ: Account Lead" />
            </div>
            <div class="pf-field">
              <label class="pf-label" for="mh-pf-phone">Số điện thoại</label>
              <input id="mh-pf-phone" class="input" type="tel" maxlength="20" placeholder="0xx xxx xxxx" />
            </div>
          </div>

          <div class="pf-field">
            <label class="pf-label" for="mh-pf-department">Phòng ban</label>
            <input id="mh-pf-department" class="input" list="mh-pf-department-list" maxlength="60" placeholder="HO Marketing, Academic, Sales..." />
            <datalist id="mh-pf-department-list">${deptOptions}</datalist>
          </div>

          <div class="pf-field">
            <label class="pf-label" for="mh-pf-bio">Mô tả ngắn</label>
            <textarea id="mh-pf-bio" class="input" maxlength="240" placeholder="Vài dòng giới thiệu bản thân, chuyên môn, sở thích..."></textarea>
          </div>

          <p id="mh-pf-note" style="font-size:11px; color:var(--text-muted); margin:4px 0 0;">Email gắn với demo account, không chỉnh sửa được. Vai trò chỉ Admin được đổi. Dữ liệu lưu cục bộ trong trình duyệt (<code>mh-user</code>).</p>
        </form>
        <div class="form-modal-foot">
          <span class="foot-hint">Thay đổi áp dụng ngay cho session hiện tại.</span>
          <div class="foot-actions">
            <button type="button" class="btn btn-ghost" data-close-profile>Hủy</button>
            <button type="button" class="btn btn-primary" id="mh-pf-save">Lưu thay đổi</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const nameInput = el.querySelector('#mh-pf-name');
    const initialsInput = el.querySelector('#mh-pf-initials');
    const avatarEl = el.querySelector('#mh-pf-avatar');
    const titleInput = el.querySelector('#mh-pf-title');
    const phoneInput = el.querySelector('#mh-pf-phone');
    const deptInput = el.querySelector('#mh-pf-department');
    const bioInput = el.querySelector('#mh-pf-bio');
    const fileInput = el.querySelector('#mh-pf-file');
    const uploadBtn = el.querySelector('#mh-pf-upload');
    const removeAvatarBtn = el.querySelector('#mh-pf-remove-avatar');
    const roleSelect = el.querySelector('#mh-pf-role');
    const roleStatic = el.querySelector('#mh-pf-role-static');

    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-close-profile]')) closeProfileModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.classList.contains('is-open')) closeProfileModal();
    });

    function previewAvatar() {
      const u = getUser() || {};
      const previewUser = {
        avatar: pendingAvatar === null ? u.avatar : pendingAvatar,
        initials: initialsInput.value.toUpperCase() || deriveInitials(nameInput.value),
        name: nameInput.value
      };
      renderAvatarInto(avatarEl, previewUser);
    }

    initialsInput.addEventListener('input', () => {
      initialsTouched = true;
      previewAvatar();
    });
    nameInput.addEventListener('input', () => {
      if (!initialsTouched) initialsInput.value = deriveInitials(nameInput.value);
      previewAvatar();
    });

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { toast({ type: 'error', message: 'Vui lòng chọn file ảnh.' }); fileInput.value = ''; return; }
      if (f.size > AVATAR_MAX_FILE_BYTES) { toast({ type: 'error', message: 'Ảnh quá lớn (tối đa 4MB).' }); fileInput.value = ''; return; }
      try {
        const dataUrl = await resizeImageFile(f, AVATAR_MAX_PX);
        pendingAvatar = dataUrl;
        previewAvatar();
        toast({ type: 'success', message: 'Đã tải ảnh, nhớ bấm "Lưu thay đổi".' });
      } catch (err) {
        toast({ type: 'error', message: 'Không đọc được file ảnh.' });
      } finally {
        fileInput.value = '';
      }
    });
    removeAvatarBtn.addEventListener('click', () => {
      pendingAvatar = '';
      previewAvatar();
    });

    el.querySelector('#mh-pf-save').addEventListener('click', async () => {
      const u = getUser();
      if (!u) { toast({ type: 'error', message: 'Phiên đăng nhập không hợp lệ.' }); return; }
      const name = nameInput.value.trim();
      if (!name) { toast({ type: 'error', message: 'Vui lòng nhập họ và tên.' }); nameInput.focus(); return; }
      const phone = phoneInput.value.trim();
      if (phone && !/^[0-9+()\-.\s]{6,20}$/.test(phone)) {
        toast({ type: 'error', message: 'Số điện thoại không hợp lệ.' }); phoneInput.focus(); return;
      }
      const initials = (initialsInput.value.trim() || deriveInitials(name)).toUpperCase().substring(0, 3);
      const title = titleInput.value.trim();
      const department = deptInput.value.trim();
      const bio = bioInput.value.trim();
      const isAdmin = u.role === 'admin';
      const nextRole = isAdmin ? roleSelect.value : u.role;

      // Phase 2: nếu Supabase Storage enabled VÀ pendingAvatar là data URL mới
      // (string bắt đầu bằng `data:`) → upload sang bucket `avatars`, replace
      // bằng publicUrl trước khi save. Khi chưa cấu hình → giữ data URL (Phase 0/1 flow).
      let finalAvatar = pendingAvatar === null ? (u.avatar || '') : pendingAvatar;
      if (
        finalAvatar && typeof finalAvatar === 'string' && finalAvatar.startsWith('data:')
        && window.MH && window.MH.store && window.MH.supabaseEnabled && u.id
      ) {
        try {
          const blob = await (await fetch(finalAvatar)).blob();
          const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
          const path = u.id + '/avatar-' + Date.now() + '.' + ext;
          const { publicUrl } = await window.MH.store.files.upload('avatars', path, blob, { contentType: blob.type });
          if (publicUrl) finalAvatar = publicUrl;
        } catch (e) {
          console.warn('[profile] avatar upload failed, giữ data URL:', e);
          toast({ type: 'warning', title: 'Upload avatar lỗi', message: 'Avatar sẽ chỉ lưu local cho phiên này.' });
        }
      }

      const updated = Object.assign({}, u, {
        name, initials, title, phone, department, bio,
        role: nextRole,
        avatar: finalAvatar
      });
      saveUser(updated);
      refreshProfileChip(updated);

      // Phase 2: persist profile changes sang public.users nếu Supabase enabled.
      if (window.MH && window.MH.supabase && window.MH.supabaseEnabled && u.id) {
        const patch = { name: name, initials: initials, title: title, phone: phone || null, department: department || null, bio: bio || null, avatar_url: typeof finalAvatar === 'string' && finalAvatar.startsWith('http') ? finalAvatar : null };
        if (isAdmin && nextRole !== u.role) patch.role = nextRole;
        window.MH.supabase.from('users').update(patch).eq('id', u.id).then(function (res) {
          if (res.error) console.warn('[profile] persist profile failed:', res.error);
        });
      }

      const roleChanged = nextRole !== u.role;
      toast({ type: 'success', title: 'Đã cập nhật hồ sơ', message: roleChanged ? `Vai trò mới: ${roleLabel(nextRole)} — tải lại trang để áp dụng đầy đủ.` : name });
      pendingAvatar = null;
      closeProfileModal();
    });

    return el;
  }

  function openProfileModal() {
    const user = getUser();
    if (!user) { toast({ type: 'warning', message: 'Vui lòng đăng nhập trước.' }); return; }
    document.querySelectorAll('.profile-chip.is-open, .header-profile-chip.is-open').forEach((c) => c.classList.remove('is-open'));
    if (!profileModalEl) profileModalEl = buildProfileModal();

    pendingAvatar = null;
    initialsTouched = !!user.initials && user.initials !== deriveInitials(user.name);

    profileModalEl.querySelector('#mh-pf-name').value = user.name || '';
    profileModalEl.querySelector('#mh-pf-email').value = user.email || '';
    profileModalEl.querySelector('#mh-pf-title').value = user.title || '';
    profileModalEl.querySelector('#mh-pf-phone').value = user.phone || '';
    profileModalEl.querySelector('#mh-pf-department').value = user.department || '';
    profileModalEl.querySelector('#mh-pf-bio').value = user.bio || '';
    const initials = user.initials || deriveInitials(user.name);
    profileModalEl.querySelector('#mh-pf-initials').value = initials;
    renderAvatarInto(profileModalEl.querySelector('#mh-pf-avatar'), user);

    const isAdmin = user.role === 'admin';
    const roleSelect = profileModalEl.querySelector('#mh-pf-role');
    const roleStatic = profileModalEl.querySelector('#mh-pf-role-static');
    const roleBadge = profileModalEl.querySelector('#mh-pf-role-badge');
    if (isAdmin) {
      roleSelect.hidden = false;
      roleStatic.hidden = true;
      roleSelect.value = user.role;
    } else {
      roleSelect.hidden = true;
      roleStatic.hidden = false;
      roleBadge.textContent = roleLabel(user.role);
      roleBadge.className = 'role-badge r--' + user.role;
    }

    profileModalEl.classList.add('is-open');
    profileModalEl.setAttribute('aria-hidden', 'false');
    setTimeout(() => profileModalEl.querySelector('#mh-pf-name').focus(), 60);
  }

  function closeProfileModal() {
    if (!profileModalEl) return;
    profileModalEl.classList.remove('is-open');
    profileModalEl.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.profile-menu a, .header-profile-menu a');
    if (!link) return;
    const txt = (link.textContent || '').trim().replace(/\s+/g, ' ');
    if (txt === 'Hồ sơ' || txt.startsWith('Hồ sơ ')) {
      e.preventDefault();
      openProfileModal();
    }
  });

  // Header profile chip toggle
  document.addEventListener('click', (e) => {
    const chip = document.getElementById('header-profile-chip');
    if (!chip) return;
    const menu = document.getElementById('header-profile-menu');
    if (chip.contains(e.target) && menu && !menu.contains(e.target)) {
      chip.classList.toggle('is-open');
      return;
    }
    if (!chip.contains(e.target)) chip.classList.remove('is-open');
  });

  window.MH.openProfile = openProfileModal;

  // After page scripts finish initializing the chip, re-apply avatar image / role if needed.
  function syncChipFromUser() {
    const user = getUser();
    if (!user) return;
    refreshProfileChip(user);
  }
  /* Content Team — nhóm sidebar riêng (h6 + ul) với 2 sub:
       1. Content Workspace (content-team.html)      — admin/account/lead_content
       2. Content Wording   (content-workbench.html) — admin/account/content
     Inject 1 chỗ cho mọi trang nội bộ; CSS data-show-roles lo ẩn/hiện theo role.
     ⚠ Substring trap: value "admin,account,lead_content" chứa "content" → role content
       sẽ match rule *="content"; CSS có override exact-match ẩn Workspace cho content. */
  function injectContentTeamGroup() {
    var u = getUser();
    var internal = ['admin', 'account', 'content', 'lead_content', 'design', 'editor', 'system_supervisor'];
    if (!u || !u.role || internal.indexOf(u.role) < 0) return; // client / public → bỏ qua
    var sidebar = document.querySelector('.dash-sidebar');
    if (!sidebar) return;
    if (sidebar.querySelector('a[href="content-team.html"], a[href="content-workbench.html"]')) return; // hardcode/đã inject → không lặp
    var groups = sidebar.querySelectorAll('.dash-nav');
    if (!groups.length) return;
    var opsUl = groups[0]; // nhóm "Vận hành" — chèn group Content Team ngay sau
    var page = location.pathname.split('/').pop() || '';

    var h6 = document.createElement('h6');
    h6.setAttribute('data-show-roles', 'admin,account,lead_content,content,system_supervisor');
    h6.textContent = 'Content Team';

    var ul = document.createElement('ul');
    ul.className = 'dash-nav';
    ul.innerHTML =
      '<li data-show-roles="admin,account,lead_content,system_supervisor"><a href="content-team.html"' + (page === 'content-team.html' ? ' class="is-active"' : '') + '><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><span>Content Workspace</span></a></li>'
      + '<li data-show-roles="admin,account,content,system_supervisor"><a href="content-workbench.html"' + (page === 'content-workbench.html' ? ' class="is-active"' : '') + '><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="13" y2="18"/></svg></span><span>Content Wording</span></a></li>';

    opsUl.insertAdjacentElement('afterend', h6);
    h6.insertAdjacentElement('afterend', ul);
  }
  /* Calendar / Lịch: thêm nav "Lịch" vào sidebar nội bộ (idempotent, mọi role nội bộ).
     Cùng pattern injectContentNav — inject 1 chỗ thay vì sửa sidebar 11 file HTML;
     CSS data-show-roles lo ẩn/hiện theo role (mọi role nội bộ đều thấy, lọc event ở calendar.js). */
  function injectCalendarNav() {
    var u = getUser();
    var internal = ['admin', 'account', 'content', 'lead_content', 'design', 'editor', 'system_supervisor'];
    if (!u || !u.role || internal.indexOf(u.role) < 0) return; // client / public → bỏ qua
    var groups = document.querySelectorAll('.dash-sidebar .dash-nav');
    if (!groups.length) return;
    var opsUl = groups[0]; // nhóm "Vận hành"
    if (opsUl.querySelector('a[href="calendar.html"]')) return; // đã có → không lặp
    var li = document.createElement('li');
    li.setAttribute('data-show-roles', 'admin,account,design,editor,content,lead_content,system_supervisor');
    li.innerHTML = '<a href="calendar.html"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span><span>Calendar</span></a>';
    if ((location.pathname.split('/').pop() || '') === 'calendar.html') { var a = li.querySelector('a'); if (a) a.classList.add('is-active'); }
    // Chèn sau "Internal Task Tracker" (production-board) cho gần nhóm task; không có thì append.
    var anchor = opsUl.querySelector('a[href="production-board.html"]');
    if (anchor && anchor.parentElement && anchor.parentElement.parentElement === opsUl) {
      anchor.parentElement.insertAdjacentElement('afterend', li);
    } else {
      opsUl.appendChild(li);
    }
  }
  /* Supervisor Planning: chèn nav "Kế hoạch" vào nhóm "Vận hành" (idempotent).
     Hiện cho system_supervisor / lead_media / lead_content / admin (CSS data-show-roles
     lo việc reveal theo role; content bị ẩn lại bằng override :has trong styles.css vì
     "lead_content" chứa substring "content"). Inject DOM cho mọi role nội bộ — không
     reveal nhầm vì chuỗi data-show-roles không chứa account/design/editor. */
  function injectPlanningNav() {
    var u = getUser();
    var internal = ['admin', 'account', 'content', 'lead_content', 'design', 'editor', 'system_supervisor', 'lead_media'];
    if (!u || !u.role || internal.indexOf(u.role) < 0) return; // client / public → bỏ qua
    var groups = document.querySelectorAll('.dash-sidebar .dash-nav');
    if (!groups.length) return;
    var opsUl = groups[0]; // nhóm "Vận hành"
    if (opsUl.querySelector('a[href="supervisor-planning.html"]')) return; // đã có → không lặp
    var li = document.createElement('li');
    li.setAttribute('data-show-roles', 'system_supervisor,lead_media,lead_content,admin');
    li.innerHTML = '<a href="supervisor-planning.html"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11H3v10h6V11z"/><path d="M21 3h-6v18h6V3z"/><path d="M15 7H9v14h6V7z"/></svg></span><span>Strategy Board</span></a>';
    if ((location.pathname.split('/').pop() || '') === 'supervisor-planning.html') { var a = li.querySelector('a'); if (a) a.classList.add('is-active'); }
    opsUl.appendChild(li);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { syncChipFromUser(); injectContentTeamGroup(); injectCalendarNav(); injectPlanningNav(); }, 0); });
  } else {
    setTimeout(function () { syncChipFromUser(); injectContentTeamGroup(); injectCalendarNav(); injectPlanningNav(); }, 0);
  }

  /* ---------- Smooth section nav (for help / request side-nav) ---------- */
  document.querySelectorAll('[data-scroll-spy]').forEach((nav) => {
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const targets = links.map((l) => document.querySelector(l.getAttribute('href'))).filter(Boolean);
    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + entry.target.id));
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
  });

  /* ---------- Year ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Notification bell + dropdown (Phase 1.5) ----------
     Tự gắn dropdown vào tất cả Bell icon (button[aria-label="Thông báo"]) trên mọi page.
     Poll danh sách notifications mỗi 60s khi user đã login. Click bell → toggle dropdown. */
  (function initNotificationBell() {
    function bellButtons() { return document.querySelectorAll('button[aria-label="Thông báo"]'); }
    if (!bellButtons().length) return;

    function injectStyles() {
      if (document.getElementById('mh-notif-styles')) return;
      const css = document.createElement('style');
      css.id = 'mh-notif-styles';
      css.textContent = `
        .mh-notif-wrap { position: relative; }
        .mh-notif-badge { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 9999px; background: var(--red-600); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid var(--surface); pointer-events: none; }
        .mh-notif-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 360px; max-height: 480px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg, 16px); box-shadow: 0 20px 50px rgba(0,0,0,0.18); z-index: 1000; display: none; overflow: hidden; flex-direction: column; }
        .mh-notif-dropdown.is-open { display: flex; }
        .mh-notif-head { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .mh-notif-head h4 { margin: 0; font-size: 14px; }
        .mh-notif-head button { background: none; border: none; color: var(--brand-600); font-size: 12px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
        .mh-notif-head button:hover { background: var(--surface-2); }
        .mh-notif-list { flex: 1; overflow-y: auto; padding: 4px; }
        .mh-notif-empty { padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px; }
        .mh-notif-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; text-decoration: none; color: inherit; cursor: pointer; transition: background 0.12s; border-left: 3px solid transparent; }
        .mh-notif-item:hover { background: var(--surface-2); }
        .mh-notif-item.is-unread { border-left-color: var(--brand-600); background: rgb(25 25 112 / 0.04); }
        .mh-notif-item-ico { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; margin-top: 1px; color: var(--text-muted); }
        .mh-notif-item-ico svg { width: 18px; height: 18px; }
        .mh-notif-item-ico.is-accent { color: var(--brand-600); }
        .mh-notif-item-ico.is-danger { color: var(--red-600); }
        .mh-notif-item-body { flex: 1 1 auto; min-width: 0; }
        .mh-notif-item-title { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
        .mh-notif-item-msg { font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 4px; }
        .mh-notif-item-time { font-size: 11px; color: var(--text-muted); }
        .mh-notif-foot { padding: 8px 12px; border-top: 1px solid var(--border); text-align: center; }
        .mh-notif-foot a { font-size: 12px; color: var(--brand-600); text-decoration: none; }

        /* ----- Bell attention state khi có notification chưa đọc ----- */
        .mh-notif-wrap.has-unread button[aria-label="Thông báo"] svg {
          stroke: url(#mh-bell-grad);
          transform-origin: 50% 4px;
          animation: mhBellRing 2.6s ease-in-out infinite;
        }
        .mh-notif-wrap.has-unread .mh-notif-badge {
          background: linear-gradient(135deg, #d62a28 0%, #BA110F 100%);
          animation: mhBadgePulse 1.8s ease-out infinite;
        }
        @keyframes mhBellRing {
          0%, 35%, 100% { transform: rotate(0); }
          4%  { transform: rotate(15deg); }
          8%  { transform: rotate(-13deg); }
          12% { transform: rotate(10deg); }
          16% { transform: rotate(-8deg); }
          20% { transform: rotate(6deg); }
          24% { transform: rotate(-3deg); }
          28% { transform: rotate(0); }
        }
        @keyframes mhBadgePulse {
          0%   { box-shadow: 0 0 0 0 rgba(186,17,15,0.55); }
          70%  { box-shadow: 0 0 0 6px rgba(186,17,15,0); }
          100% { box-shadow: 0 0 0 0 rgba(186,17,15,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mh-notif-wrap.has-unread button[aria-label="Thông báo"] svg,
          .mh-notif-wrap.has-unread .mh-notif-badge { animation: none; }
        }
      `;
      document.head.appendChild(css);

      // Gradient def cho stroke chuông (navy → red) — cần nằm trong document để url(#) resolve.
      if (!document.getElementById('mh-bell-grad-def')) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const gsvg = document.createElementNS(svgNS, 'svg');
        gsvg.id = 'mh-bell-grad-def';
        gsvg.setAttribute('width', '0');
        gsvg.setAttribute('height', '0');
        gsvg.setAttribute('aria-hidden', 'true');
        gsvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
        gsvg.innerHTML = '<defs><linearGradient id="mh-bell-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#191970"/><stop offset="100%" stop-color="#BA110F"/></linearGradient></defs>';
        document.body.appendChild(gsvg);
      }
    }

    function fmtTime(iso) {
      try {
        const d = new Date(iso);
        const diff = (Date.now() - d.getTime()) / 1000;
        if (diff < 60) return 'vừa xong';
        if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
        if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
        if (diff < 604800) return Math.floor(diff / 86400) + ' ngày trước';
        return d.toLocaleDateString('vi-VN');
      } catch (e) { return ''; }
    }
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    /* ---------- Icon thông báo: dùng chung từ assets/notif-icons.js ----------
       SINGLE SOURCE OF TRUTH — sửa icon/màu ở `assets/notif-icons.js` là cả bell
       (đây) lẫn client panel (client-dashboard.js) tự đồng bộ. notif-icons.js load
       TRƯỚC app.js nên window.MH.notifIcons luôn sẵn sàng. */
    const notifIcon = (type) => window.MH.notifIcons.get(type);
    const stripNotifEmoji = (s) => window.MH.notifIcons.stripEmoji(s);

    let dropdown = null;
    let pollTimer = null;

    function buildDropdown(bellBtn) {
      if (bellBtn.parentElement.classList.contains('mh-notif-wrap')) return;
      // Wrap bell trong container relative
      const wrap = document.createElement('span');
      wrap.className = 'mh-notif-wrap';
      bellBtn.parentNode.insertBefore(wrap, bellBtn);
      wrap.appendChild(bellBtn);

      const badge = document.createElement('span');
      badge.className = 'mh-notif-badge';
      badge.style.display = 'none';
      badge.dataset.role = 'notif-badge';
      wrap.appendChild(badge);

      dropdown = document.createElement('div');
      dropdown.className = 'mh-notif-dropdown';
      dropdown.innerHTML = `
        <div class="mh-notif-head">
          <h4>Thông báo</h4>
          <button type="button" data-action="mark-all">Đánh dấu đã đọc</button>
        </div>
        <div class="mh-notif-list"><div class="mh-notif-empty">Đang tải...</div></div>
      `;
      wrap.appendChild(dropdown);

      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('is-open');
        if (dropdown.classList.contains('is-open')) renderDropdown();
      });
      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) dropdown.classList.remove('is-open');
      });
      dropdown.querySelector('[data-action="mark-all"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!window.MH.store) return;
        await window.MH.store.notifications.markAllRead();
        await refreshBadge();
        await renderDropdown();
      });
    }

    async function refreshBadge() {
      if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return;
      try {
        const list = await window.MH.store.notifications.listUnread(50);
        const count = list.length;
        // Một state duy nhất `has-unread` trên wrap điều khiển cả badge, gradient và animation chuông.
        document.querySelectorAll('.mh-notif-wrap').forEach((wrap) => {
          const b = wrap.querySelector('[data-role="notif-badge"]');
          if (count > 0) {
            if (b) { b.textContent = count > 99 ? '99+' : String(count); b.style.display = 'flex'; }
            wrap.classList.add('has-unread');
          } else {
            if (b) b.style.display = 'none';
            wrap.classList.remove('has-unread');
          }
        });
        // Đồng bộ luôn dot tĩnh trên trang (vd Client Portal `#notif-dot`) theo CÙNG
        // nguồn unread của Supabase → tránh dot kẹt đỏ sau khi "Đánh dấu đã đọc" ở
        // dropdown (app.js) trong khi dot tĩnh do JS trang khác điều khiển.
        var staticDot = document.getElementById('notif-dot');
        if (staticDot) staticDot.style.display = count > 0 ? '' : 'none';
        return list;
      } catch (e) { console.warn('[notif] refresh badge failed:', e); return []; }
    }

    // Derive a fallback link từ related_entity_* khi notification.link rỗng.
    // Cũng giúp old notifications (trước khi producers set field link) click được.
    function resolveNotifLink(n) {
      // Role-aware: client KHÔNG truy cập được các trang nội bộ (database-orders /
      // production-board / delivery-log). Mọi notif của client mở order drawer ngay
      // trong client portal qua ?order=<MEDIA-id> thay vì điều hướng sang trang nội bộ.
      let role = '';
      try { role = (JSON.parse(localStorage.getItem('mh-user') || 'null') || {}).role || ''; } catch (e) {}
      if (role === 'client') {
        let oid = n.related_entity_id || '';
        if (!oid && n.link) {
          const m = n.link.match(/(?:code|order|id)=([^&]+)/);
          if (m) oid = decodeURIComponent(m[1]);
        }
        return oid ? ('client-dashboard.html?order=' + encodeURIComponent(oid)) : 'client-dashboard.html';
      }
      if (n.link) return n.link;
      const type = n.related_entity_type;
      const id = n.related_entity_id;
      if (!id) return '';
      if (type === 'tasks')      return 'production-board.html?id=' + encodeURIComponent(id);
      if (type === 'orders')     return 'database-orders.html?id=' + encodeURIComponent(id);
      if (type === 'deliveries') return 'database-orders.html?id=' + encodeURIComponent(id);
      return '';
    }

    async function renderDropdown() {
      if (!dropdown || !window.MH.store) return;
      const list = await window.MH.store.notifications.listAll(20);
      const body = dropdown.querySelector('.mh-notif-list');
      if (!list.length) {
        body.innerHTML = '<div class="mh-notif-empty">Chưa có thông báo nào.</div>';
        return;
      }
      body.innerHTML = list.map((n) => {
        const resolved = resolveNotifLink(n);
        const ic = notifIcon(n.type);
        return `
        <a class="mh-notif-item ${n.is_read ? '' : 'is-unread'}" data-id="${n.id}" data-link="${escapeHtml(resolved || '#')}" data-read="${n.is_read}">
          <span class="mh-notif-item-ico ${ic.cls}">${ic.svg}</span>
          <div class="mh-notif-item-body">
            <div class="mh-notif-item-title">${escapeHtml(stripNotifEmoji(n.title))}</div>
            ${n.message ? `<div class="mh-notif-item-msg">${escapeHtml(n.message)}</div>` : ''}
            <div class="mh-notif-item-time">${fmtTime(n.created_at)}</div>
          </div>
        </a>`;
      }).join('');
      body.querySelectorAll('.mh-notif-item').forEach((el) => {
        el.addEventListener('click', async (e) => {
          e.preventDefault();
          const id = el.dataset.id;
          const link = el.dataset.link;
          const wasUnread = el.dataset.read === 'false';
          if (wasUnread) { await window.MH.store.notifications.markRead(id); await refreshBadge(); }
          if (link && link !== '#') window.location.href = link;
        });
      });
    }

    async function showNotifPopup(notif) {
      // Toast lớn ở góc với link, sound nhẹ (skip nếu user reduced-motion)
      if (!window.MH || !window.MH.toast) return;
      window.MH.toast({
        type: 'info',
        title: stripNotifEmoji(notif.title) || 'Thông báo mới',
        message: notif.message || '',
        duration: 8000
      });
      // Resolve link (fallback từ related_entity_* nếu notif.link rỗng)
      const resolved = resolveNotifLink(notif);
      if (resolved) {
        setTimeout(() => {
          const toasts = document.querySelectorAll('.toast');
          const last = toasts[toasts.length - 1];
          if (last) {
            last.style.cursor = 'pointer';
            last.title = 'Click để mở';
            last.addEventListener('click', async (e) => {
              if (e.target.closest('button')) return; // không trigger khi click nút close
              if (window.MH.store && notif.id) {
                await window.MH.store.notifications.markRead(notif.id);
                await refreshBadge();
              }
              window.location.href = resolved;
            }, { once: true });
          }
        }, 50);
      }
    }

    let realtimeChannel = null;

    async function startRealtime() {
      if (!window.MH || !window.MH.supabase) return;
      const { data: { user: authUser } } = await window.MH.supabase.auth.getUser();
      if (!authUser) return;
      // Unsubscribe channel cũ nếu có (avoid duplicate khi re-init)
      if (realtimeChannel) {
        try { await window.MH.supabase.removeChannel(realtimeChannel); } catch (e) {}
        realtimeChannel = null;
      }
      realtimeChannel = window.MH.supabase
        .channel('notif-' + authUser.id)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.' + authUser.id
        }, (payload) => {
          const n = payload.new;
          if (!n) return;
          console.log('[notif] realtime new:', n.type, n.title);
          showNotifPopup(n);
          refreshBadge();
          // Re-render dropdown if open
          if (dropdown && dropdown.classList.contains('is-open')) renderDropdown();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') console.log('[notif] realtime subscribed');
          else if (status === 'CHANNEL_ERROR') console.warn('[notif] realtime channel error — fallback polling');
        });
    }

    function start() {
      // Chỉ bật notification khi user đã login + Supabase enabled
      let user;
      try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
      if (!user || !user.role || !window.MH || !window.MH.supabaseEnabled) return;
      injectStyles();
      bellButtons().forEach(buildDropdown);
      refreshBadge();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(refreshBadge, 60000); // 1 phút poll backup
      // Realtime subscribe để có popup ngay khi có notification mới
      startRealtime().catch((e) => console.warn('[notif] realtime start failed:', e));
      // Cleanup on page hide để tránh leak channel
      window.addEventListener('beforeunload', async () => {
        if (realtimeChannel && window.MH.supabase) {
          try { await window.MH.supabase.removeChannel(realtimeChannel); } catch (e) {}
        }
      });
    }
    // Delay start để chờ supabase ready
    if (window.MH && window.MH.supabaseReady) {
      window.MH.supabaseReady.then(start).catch(() => {});
    } else {
      setTimeout(start, 1000);
    }
  })();
})();
