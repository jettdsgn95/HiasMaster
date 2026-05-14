/* =====================================================================
   CB Media Hub — Settings module logic
   - Auth guard: admin only
   - Settings stored in localStorage (would be /api/settings in production)
   - 12 categories: General / Workflow / SLA / Notifications / Brand / AI
   -                Chatbot / Files / Departments / Client Portal / Reports / Security
   - Workflow status editor (3 modules)
   - Brand color picker with live preview
   - Test connections (notification / AI / Drive)
   - Activity log persists between sessions
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (user.role !== 'admin') {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Settings chỉ dành cho Admin.' });
    setTimeout(() => location.replace('dashboard.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

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

  /* ---------- Default state ---------- */
  const DEFAULT_STATUSES = {
    account: [
      { name: 'Chờ xác nhận',          key: 'pending',     color: '#0ea5e9', progress: 5,  public: 'Đã nhận yêu cầu' },
      { name: 'Đang kiểm tra brief',   key: 'checking',    color: '#3849b3', progress: 10, public: 'Đang kiểm tra thông tin' },
      { name: 'Cần bổ sung thông tin', key: 'needinfo',    color: '#f59e0b', progress: 10, public: 'Cần bổ sung brief' },
      { name: 'Đã xác nhận brief',     key: 'confirmed',   color: '#16a34a', progress: 20, public: 'Đã tiếp nhận' },
      { name: 'Từ chối / Hủy đơn',     key: 'rejected',    color: '#BA110F', progress: 0,  public: 'Đã hủy' }
    ],
    production: [
      { name: 'Chưa nhận task',         key: 'pending',     color: '#94a3b8', progress: 20, public: 'Đã phân công' },
      { name: 'Nhận task',              key: 'received',    color: '#3849b3', progress: 30, public: 'Đang chuẩn bị' },
      { name: 'Đang thực hiện',         key: 'inprogress',  color: '#191970', progress: 50, public: 'Đang sản xuất' },
      { name: 'Chờ duyệt nội bộ',       key: 'review',      color: '#0ea5e9', progress: 65, public: 'Đang kiểm tra nội bộ' },
      { name: 'Chỉnh sửa nội bộ',       key: 'revision',    color: '#f59e0b', progress: 75, public: 'Đang chỉnh sửa' },
      { name: 'Chờ client phản hồi',    key: 'feedback_wait', color: '#3849b3', progress: 80, public: 'Chờ phản hồi của bạn' },
      { name: 'Chỉnh sửa theo feedback',key: 'feedback_fix',  color: '#f59e0b', progress: 85, public: 'Đang chỉnh sửa theo feedback' },
      { name: 'Sẵn sàng bàn giao',      key: 'ready',       color: '#10b981', progress: 90, public: 'Sắp bàn giao' },
      { name: 'Đã bàn giao',            key: 'delivered',   color: '#16a34a', progress: 95, public: 'Đã bàn giao' },
      { name: 'Hoàn thành',             key: 'completed',   color: '#16a34a', progress: 100,public: 'Hoàn thành' },
      { name: 'Tạm dừng',               key: 'paused',      color: '#94a3b8', progress: 0,  public: 'Tạm dừng' },
      { name: 'Hủy',                    key: 'cancelled',   color: '#BA110F', progress: 0,  public: 'Đã hủy' }
    ],
    delivery: [
      { name: 'Chờ Account kiểm tra',     key: 'waiting',     color: '#0ea5e9', progress: 90, public: 'Sắp bàn giao' },
      { name: 'Cần chỉnh sửa nội bộ',     key: 'need_rev',    color: '#f59e0b', progress: 75, public: 'Đang chỉnh sửa' },
      { name: 'Sẵn sàng bàn giao',        key: 'ready',       color: '#10b981', progress: 90, public: 'Sắp bàn giao' },
      { name: 'Đã gửi preview',           key: 'preview',     color: '#3849b3', progress: 92, public: 'Đã gửi preview' },
      { name: 'Chờ client phản hồi',      key: 'client_wait', color: '#191970', progress: 92, public: 'Chờ phản hồi của bạn' },
      { name: 'Client yêu cầu chỉnh sửa', key: 'client_rev',  color: '#BA110F', progress: 85, public: 'Đang chỉnh sửa theo feedback' },
      { name: 'Đã gửi final',             key: 'final',       color: '#16a34a', progress: 95, public: 'Đã bàn giao' },
      { name: 'Đã nhận đánh giá',         key: 'rated',       color: '#16a34a', progress: 98, public: 'Đã đánh giá' },
      { name: 'Hoàn thành',               key: 'completed',   color: '#16a34a', progress: 100,public: 'Hoàn thành' },
      { name: 'Mở lại',                   key: 'reopened',    color: '#f59e0b', progress: 85, public: 'Đang xử lý lại' },
      { name: 'Hủy',                      key: 'cancelled',   color: '#BA110F', progress: 0,  public: 'Đã hủy' }
    ]
  };

  const NOTIFICATION_EVENTS = [
    { key: 'order_created',     name: 'New order created',          desc: 'Order Form vừa được submit',           channels: ['inapp','email'], recipients: 'Admin, Account' },
    { key: 'brief_needinfo',    name: 'Brief needs more info',      desc: 'Account yêu cầu bổ sung brief',         channels: ['inapp','email'], recipients: 'Requester, Account' },
    { key: 'brief_confirmed',   name: 'Brief confirmed',            desc: 'Account đã xác nhận brief',             channels: ['inapp'],          recipients: 'Requester, Account, Admin' },
    { key: 'pic_assigned',      name: 'PIC assigned',               desc: 'Task được gán cho PIC',                 channels: ['inapp','email'], recipients: 'P.I.C, Account' },
    { key: 'task_not_accepted', name: 'Task not accepted (4h)',     desc: 'PIC chưa nhận task quá 4 giờ',          channels: ['inapp','email'], recipients: 'P.I.C, Account, Admin' },
    { key: 'task_due_soon',     name: 'Task due soon',              desc: 'Task sắp đến hạn nội bộ',               channels: ['inapp'],          recipients: 'P.I.C, Account' },
    { key: 'task_overdue',      name: 'Task overdue',               desc: 'Task trễ deadline nội bộ',              channels: ['inapp','email'], recipients: 'P.I.C, Account, Admin' },
    { key: 'task_review',       name: 'Task waiting internal review',desc: 'PIC đã gửi preview/final review',       channels: ['inapp'],          recipients: 'Account' },
    { key: 'ready_delivery',    name: 'Ready for delivery',         desc: 'Task chuyển sang Delivery Log',         channels: ['inapp'],          recipients: 'Account' },
    { key: 'preview_sent',      name: 'Preview sent to client',     desc: 'Account đã gửi preview',                channels: ['email'],          recipients: 'Client / Requester' },
    { key: 'client_feedback',   name: 'Client feedback received',   desc: 'Client đã phản hồi',                    channels: ['inapp','email'], recipients: 'Account, P.I.C' },
    { key: 'final_sent',        name: 'Final sent',                 desc: 'Account đã gửi final',                  channels: ['email'],          recipients: 'Client / Requester' },
    { key: 'rating_submitted',  name: 'Rating submitted',           desc: 'Client đã rating',                      channels: ['inapp'],          recipients: 'Account, Admin' },
    { key: 'order_completed',   name: 'Order completed',            desc: 'Order đóng thành công',                 channels: ['inapp','email'], recipients: 'Requester, Account, Admin' }
  ];

  const DEFAULT_DEPARTMENTS = [
    { id: 'DEPT-HO-MKT',  name: 'HO Marketing', type: 'HO',       account: 'Mai Phương', status: 'active' },
    { id: 'DEPT-ACA',     name: 'Academic',     type: 'Academic', account: 'Hậu',         status: 'active' },
    { id: 'DEPT-SALES',   name: 'Sales',        type: 'Sales',    account: 'Hậu',         status: 'active' },
    { id: 'DEPT-MEKONG',  name: 'CB Mekong',    type: 'Branch',   account: 'Đức Anh',     status: 'active' },
    { id: 'DEPT-HP',      name: 'CB Hưng Phú',  type: 'Branch',   account: 'Hậu',         status: 'active' },
    { id: 'DEPT-CT',      name: 'CB Cần Thơ',   type: 'Branch',   account: 'Đức Anh',     status: 'active' },
    { id: 'DEPT-TT',      name: 'CB Tiên Thủy', type: 'Branch',   account: 'Mai Phương',  status: 'active' }
  ];

  /* ---------- Storage ---------- */
  const STORAGE_KEY = 'mh-settings';
  const ACTIVITY_KEY = 'mh-settings-activity';
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (s && typeof s === 'object') return s;
    } catch (e) {}
    return {
      workflow: JSON.parse(JSON.stringify(DEFAULT_STATUSES)),
      departments: JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS))
    };
  }
  function saveSettings(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function loadActivity() {
    try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveActivity(arr) {
    try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(arr.slice(-50))); } catch (e) {}
  }
  function logChange(category, desc) {
    const a = loadActivity();
    const entry = { time: new Date().toISOString().slice(0, 16).replace('T', ' '), actor: user.name, category, desc };
    a.push(entry);
    saveActivity(a);
    renderActivity();
  }

  let settings = loadSettings();

  /* ---------- Category switching ---------- */
  document.querySelectorAll('.nav-btn[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.querySelectorAll('.settings-panel').forEach((p) => p.classList.toggle('is-active', p.getAttribute('data-panel') === cat));
      // Re-render dynamic content
      if (cat === 'workflow') renderStatusList(currentWfTab);
      if (cat === 'notifications') renderEventTable();
      if (cat === 'departments') renderDeptTable();
    });
  });

  /* ---------- Workflow status editor ---------- */
  let currentWfTab = 'account';
  document.querySelectorAll('.workflow-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      currentWfTab = tab.getAttribute('data-wf');
      document.querySelectorAll('.workflow-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      renderStatusList(currentWfTab);
    });
  });

  function renderStatusList(module) {
    const list = settings.workflow[module] || [];
    const container = document.getElementById('status-list');
    container.innerHTML = list.map((s, i) => `
      <div class="status-config-row" data-idx="${i}">
        <span class="order-num">${i + 1}</span>
        <input class="status-name-input" data-field="name" value="${escapeAttr(s.name)}"/>
        <input type="color" data-field="color" value="${s.color}" title="Color"/>
        <input class="progress-input" data-field="progress" type="number" min="0" max="100" value="${s.progress}" title="Progress %"/>
        <input class="public-input" data-field="public" value="${escapeAttr(s.public || '')}" title="Public mapping" placeholder="Public name..."/>
        <button class="del-btn" data-action="del" title="Xóa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.status-config-row').forEach((row) => {
      const idx = parseInt(row.getAttribute('data-idx'), 10);
      row.querySelectorAll('[data-field]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const f = inp.getAttribute('data-field');
          const val = inp.type === 'number' ? parseInt(inp.value, 10) : inp.value;
          settings.workflow[module][idx][f] = val;
        });
      });
      row.querySelector('[data-action="del"]').addEventListener('click', () => {
        if (!confirm(`Xóa status "${settings.workflow[module][idx].name}"? Lưu ý: status đang dùng bởi dữ liệu sẽ bị block ở backend.`)) return;
        const removed = settings.workflow[module].splice(idx, 1)[0];
        logChange('workflow', `Xóa status "${removed.name}" trong ${module}`);
        renderStatusList(module);
      });
    });
  }

  document.getElementById('add-status-btn').addEventListener('click', () => {
    const newStatus = { name: 'Status mới', key: 'new_' + Date.now(), color: '#94a3b8', progress: 0, public: '' };
    settings.workflow[currentWfTab].push(newStatus);
    renderStatusList(currentWfTab);
  });

  /* ---------- Notifications event table ---------- */
  function renderEventTable() {
    const tbody = document.getElementById('event-table');
    tbody.innerHTML = NOTIFICATION_EVENTS.map((e, i) => `
      <div class="event-row" data-idx="${i}">
        <label class="toggle"><input type="checkbox" checked data-toggle-event="${e.key}"><span class="track"></span></label>
        <div class="ev-name"><b>${e.name}</b><span>${e.desc}</span></div>
        <div class="ch-icons">
          <span class="${e.channels.includes('inapp') ? 'is-on' : ''}" title="In-app">A</span>
          <span class="${e.channels.includes('email') ? 'is-on' : ''}" title="Email">E</span>
          <span class="${e.channels.includes('slack') ? 'is-on' : ''}" title="Slack / Google Chat">S</span>
          <span class="${e.channels.includes('zalo') ? 'is-on' : ''}" title="Zalo">Z</span>
        </div>
        <div class="recipients">${e.recipients}</div>
        <button class="btn btn-ghost btn-sm" data-edit-event="${e.key}">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
      </div>
    `).join('');
    tbody.querySelectorAll('[data-edit-event]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.MH.toast({ type: 'info', title: 'Edit template', message: 'Modal edit template sẽ mở (chưa wire trong demo).' });
      });
    });
  }

  /* ---------- Departments ---------- */
  function renderDeptTable() {
    const tbody = document.getElementById('dept-table');
    tbody.innerHTML = settings.departments.map((d, i) => `
      <div class="dept-row" data-idx="${i}">
        <div><b>${escapeHtml(d.name)}</b><div class="text-xs muted mono" style="font-size:10px">${d.id}</div></div>
        <span class="dept-type">${d.type}</span>
        <span class="text-xs muted">Account: <b>${escapeHtml(d.account)}</b></span>
        <span class="user-status us--${d.status === 'active' ? 'active' : 'inactive'}"><span class="dot"></span>${d.status === 'active' ? 'Active' : 'Inactive'}</span>
        <button class="btn btn-ghost btn-sm" data-del-dept="${i}">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `).join('');
    tbody.querySelectorAll('[data-del-dept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-del-dept'), 10);
        const d = settings.departments[idx];
        if (!confirm(`Vô hiệu hóa "${d.name}"? Department sẽ không xuất hiện trong dropdown nhưng dữ liệu cũ vẫn giữ.`)) return;
        d.status = d.status === 'active' ? 'inactive' : 'active';
        logChange('departments', `${d.status === 'active' ? 'Activate' : 'Deactivate'} ${d.name}`);
        renderDeptTable();
      });
    });
  }
  document.getElementById('dept-add').addEventListener('click', () => {
    const name = prompt('Tên chi nhánh / bộ phận:');
    if (!name) return;
    const newDept = {
      id: 'DEPT-' + Date.now().toString(36).toUpperCase(),
      name, type: 'Branch', account: 'Mai Phương', status: 'active'
    };
    settings.departments.push(newDept);
    logChange('departments', `Tạo department "${name}"`);
    renderDeptTable();
  });
  document.getElementById('dept-import').addEventListener('click', () => {
    window.MH.toast({ type: 'info', title: 'Import CSV', message: 'Demo — kết nối backend để import bulk departments.' });
  });

  /* ---------- Brand color picker live preview ---------- */
  ['b-primary', 'b-accent', 'b-bg'].forEach((id) => {
    const input = document.getElementById(id);
    const hex = document.getElementById(id + '-hex');
    input.addEventListener('input', () => {
      hex.textContent = input.value.toUpperCase();
      // Live preview (only the brand-preview area)
      if (id === 'b-primary') {
        const btn = document.getElementById('bp-btn-primary');
        if (btn) btn.style.background = input.value;
      }
      if (id === 'b-accent') {
        const btn = document.getElementById('bp-btn-accent');
        if (btn) btn.style.background = `linear-gradient(135deg, ${input.value} 0%, ${input.value} 100%)`;
      }
    });
  });

  /* ---------- General Maintenance toggle label ---------- */
  document.getElementById('g-maintenance').addEventListener('change', (e) => {
    document.getElementById('g-maintenance-label').textContent = e.target.checked ? 'Bật' : 'Tắt';
  });

  /* ---------- Save handlers (per panel) ---------- */
  document.querySelectorAll('[data-action="save"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.settings-panel');
      const cat = panel.getAttribute('data-panel');
      saveSettings(settings);
      const labels = {
        general: 'General settings', workflow: 'Workflow status (' + currentWfTab + ')',
        sla: 'SLA & Deadline', notifications: 'Notifications', brand: 'Brand',
        ai: 'AI Tools', chatbot: 'Chatbot', files: 'File & Drive',
        client_portal: 'Client Portal', reports: 'Report & Export', security: 'Security'
      };
      logChange(cat, `Đã cập nhật ${labels[cat] || cat}`);
      window.MH.toast({ type: 'success', title: '✓ Đã lưu', message: labels[cat] || cat });
    });
  });

  document.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.MH.toast({ type: 'info', title: 'Đã hủy', message: 'Chưa lưu thay đổi.' });
      settings = loadSettings();
      // Re-render dynamic panels
      const panel = btn.closest('.settings-panel').getAttribute('data-panel');
      if (panel === 'workflow') renderStatusList(currentWfTab);
      if (panel === 'departments') renderDeptTable();
    });
  });

  /* ---------- Test connection buttons ---------- */
  document.getElementById('test-notif').addEventListener('click', () => {
    const btn = document.getElementById('test-notif');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = 'Send Test';
      btn.disabled = false;
      window.MH.toast({ type: 'success', title: '✓ Test notification sent', message: 'Email gửi tới ' + user.email + ' (demo).' });
      logChange('notifications', 'Test notification gửi tới ' + user.email);
    }, 800);
  });
  document.getElementById('test-ai').addEventListener('click', () => {
    const btn = document.getElementById('test-ai');
    const key = document.getElementById('ai-key').value.trim();
    btn.textContent = 'Testing...';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = 'Test connection';
      btn.disabled = false;
      if (!key) {
        window.MH.toast({ type: 'error', title: 'Thiếu API key', message: 'Vui lòng nhập API key trước khi test.' });
        return;
      }
      window.MH.toast({ type: 'success', title: '✓ Kết nối thành công', message: 'Model phản hồi OK (demo).' });
      logChange('ai', 'Test AI connection — OK');
    }, 1000);
  });
  document.getElementById('test-drive').addEventListener('click', () => {
    const btn = document.getElementById('test-drive');
    btn.textContent = 'Testing...';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = 'Test Drive connection';
      btn.disabled = false;
      window.MH.toast({ type: 'success', title: '✓ Drive OK', message: 'Quyền root folder đã verify (demo).' });
      logChange('files', 'Test Google Drive — OK');
    }, 1000);
  });

  /* ---------- Reset & Export ---------- */
  document.getElementById('reset-defaults').addEventListener('click', () => {
    if (!confirm('Reset toàn bộ Settings về mặc định? Activity log sẽ giữ lại.')) return;
    settings = { workflow: JSON.parse(JSON.stringify(DEFAULT_STATUSES)), departments: JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS)) };
    saveSettings(settings);
    logChange('system', 'Reset settings về defaults');
    renderStatusList(currentWfTab);
    renderDeptTable();
    window.MH.toast({ type: 'warning', title: 'Đã reset', message: 'Toàn bộ Settings về default values.' });
  });

  document.getElementById('export-settings').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cb-media-hub-settings-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.MH.toast({ type: 'success', title: '✓ Đã export', message: 'Settings backup file đã tải.' });
  });

  /* ---------- Activity log ---------- */
  function renderActivity() {
    const list = loadActivity();
    const ul = document.getElementById('activity-list');
    const count = document.getElementById('activity-count');
    count.textContent = list.length + ' changes';
    ul.innerHTML = list.slice(-15).reverse().map((a) => `
      <li>
        <span><b>${escapeHtml(a.actor)}</b> · ${escapeHtml(a.desc)} <span class="text-xs muted">(${a.category})</span></span>
        <time>${a.time}</time>
      </li>
    `).join('');
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr(s) { return String(s ?? '').replace(/"/g, '&quot;'); }

  /* ---------- Init ---------- */
  renderStatusList(currentWfTab);
  renderEventTable();
  renderDeptTable();
  renderActivity();

  // Toggle labels
  document.querySelectorAll('.toggle input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      // No-op: actual label change handled per-toggle if needed
    });
  });
})();
