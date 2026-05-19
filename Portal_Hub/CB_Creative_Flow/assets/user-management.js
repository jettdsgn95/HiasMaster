/* =====================================================================
   CB Media Hub — User Management module logic
   - Auth guard: admin only
   - Mock user dataset (~14 users covering all roles)
   - Render: 7 summary cards, user table, detail drawer (7 blocks)
   - Create / Edit user modal with validation (unique email, last admin protect)
   - Status transitions (activate / deactivate / suspend / resend invite)
   - Permission preview per group selection
   - Activity log per user
   - Export CSV
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (user.role !== 'admin') {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'User Management chỉ dành cho Admin.' });
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

  /* ---------- Constants ---------- */
  // ROLE_LABEL mở rộng để khớp schema Supabase (admin/account/design/editor/client).
  // Giữ manager/staff cho mock cũ tương thích ngược.
  const ROLE_LABEL = {
    admin: 'Admin', manager: 'Manager', account: 'Account',
    design: 'Design', editor: 'Editor', staff: 'Staff', client: 'Client'
  };
  const STATUS_LABEL = { pending: 'Pending Invite', active: 'Active', inactive: 'Inactive', suspended: 'Suspended', archived: 'Archived' };
  const PERM_LABEL = {
    full: 'Full Access', manager_view: 'Manager View', order_mgmt: 'Order Management',
    production_only: 'Production Only', delivery_only: 'Delivery Only',
    report_viewer: 'Report Viewer', client_only: 'Client Order Only',
    ai_tools: 'AI Tools Access', custom: 'Custom'
  };
  const SCOPE_LABEL = {
    all: 'All Data', team: 'Team Data', department: 'Department Data',
    assigned: 'Assigned Data', own: 'Own Created Data', client_own: 'Client Own Data', custom: 'Custom Scope'
  };

  // Permission preview lookup
  const PERM_PREVIEW = {
    full: [
      'View / create / edit / delete tất cả records',
      'Manage users + permission groups',
      'Configure system settings',
      'Approve & close orders / tasks',
      'Export reports & view audit log'
    ],
    manager_view: [
      'View dashboard + reports toàn team',
      'View order/task/delivery của team',
      'Comment trên task',
      'Không edit settings, không quản lý user'
    ],
    order_mgmt: [
      'Create / view assigned orders',
      'Check brief + request more info',
      'Confirm brief, assign PIC, set internal deadline',
      'Send preview / final + close delivery'
    ],
    production_only: [
      'View task được assign',
      'Update task status + upload preview/final',
      'Comment trên task của mình',
      'Không xem all orders, không assign PIC, không close order'
    ],
    delivery_only: [
      'View delivery được phân quyền',
      'Check file + send preview/final',
      'Submit rating + close delivery',
      'Không create/edit orders trực tiếp'
    ],
    report_viewer: [
      'View dashboard + reports',
      'Export báo cáo',
      'Không edit records nào'
    ],
    client_only: [
      'Create order + view own orders',
      'Comment / feedback trên order của mình',
      'Download final link + rating',
      'Không thấy internal note / deadline / dashboard nội bộ'
    ],
    ai_tools: [
      'Sử dụng AI Tools (Brief Optimizer, Asset Check...)',
      'Quyền cộng dồn với permission group khác'
    ],
    custom: [
      'Permission được cấu hình thủ công',
      'Vui lòng kiểm tra ở User Detail sau khi tạo'
    ]
  };

  // Module access matrix per permission group
  const MODULE_MATRIX = {
    full: { dashboard: ['view'], orders: ['view','create','edit','delete','assign','export'], production: ['view','create','edit','assign','approve','upload'], delivery: ['view','edit','deliver','approve'], reports: ['view','export'], ai_tools: ['use_ai'], users: ['view','create','edit'], settings: ['view','configure'] },
    manager_view: { dashboard: ['view'], orders: ['view'], production: ['view'], delivery: ['view'], reports: ['view','export'], ai_tools: ['use_ai'], users: ['view'] },
    order_mgmt: { dashboard: ['view'], orders: ['view','create','edit','assign'], production: ['view','edit'], delivery: ['view','edit','deliver'], reports: ['view'], ai_tools: ['use_ai'] },
    production_only: { dashboard: ['view'], orders: ['view'], production: ['view','edit','upload'], reports: ['view'] },
    delivery_only: { dashboard: ['view'], delivery: ['view','edit','deliver'], reports: ['view'] },
    report_viewer: { dashboard: ['view'], reports: ['view','export'] },
    client_only: { orders: ['create','view'], delivery: ['view'], comments: ['view','comment'] },
    ai_tools: { ai_tools: ['use_ai'], chatbot: ['use_ai'] },
    custom: {}
  };

  /* ---------- Mock users ---------- */
  const USERS = [
    {
      user_id: 'USR-0001', full_name: 'Mai Phương', email: 'admin@cb.vn', phone: '0901234500',
      role: 'admin', tag: 'Manager', department: 'HO Marketing',
      permission_group: 'full', data_scope: 'all',
      status: 'active', last_login_at: '2026-05-13 09:24', created_at: '2025-08-01 09:00',
      created_by: 'system',
      allowed_departments: ['CB Mekong','CB Hưng Phú','CB Cần Thơ','CB Tiên Thủy','Academic','Sales'],
      activity: [
        { time: '2025-08-01 09:00', actor: 'system', action: 'user_created', desc: 'Tạo user hệ thống' },
        { time: '2026-04-12 14:20', actor: 'Mai Phương', action: 'role_changed', desc: 'Account Lead → Admin' }
      ],
      work_stats: { assigned_orders: 41, waiting_brief: 0, in_delivery: 5, avg_rating: 4.9 }
    },
    {
      user_id: 'USR-0002', full_name: 'Hậu Nguyễn', email: 'account@cb.vn', phone: '0901234501',
      role: 'account', tag: 'Account', department: 'HO Marketing',
      permission_group: 'order_mgmt', data_scope: 'assigned',
      status: 'active', last_login_at: '2026-05-13 08:45', created_at: '2025-08-15 09:00',
      created_by: 'Mai Phương',
      allowed_departments: ['CB Mekong','CB Hưng Phú'],
      activity: [
        { time: '2025-08-15 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Account Manager' },
        { time: '2026-01-10 11:00', actor: 'Mai Phương', action: 'data_scope_changed', desc: 'Department Data → Assigned Data' }
      ],
      work_stats: { assigned_orders: 39, waiting_brief: 3, in_delivery: 4, avg_rating: 4.9 }
    },
    {
      user_id: 'USR-0003', full_name: 'Duy Trần', email: 'design@cb.vn', phone: '0901234502',
      role: 'staff', tag: 'Design', department: 'HO Marketing',
      permission_group: 'production_only', data_scope: 'assigned',
      status: 'active', last_login_at: '2026-05-13 10:12', created_at: '2025-09-01 09:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2025-09-01 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Senior Designer' }
      ],
      work_stats: { assigned_tasks: 45, open_tasks: 5, overdue_tasks: 0, completed_tasks: 39, avg_progress: 78 }
    },
    {
      user_id: 'USR-0004', full_name: 'Linh Chi', email: 'editor@cb.vn', phone: '0901234503',
      role: 'staff', tag: 'Editor', department: 'HO Marketing',
      permission_group: 'production_only', data_scope: 'assigned',
      status: 'active', last_login_at: '2026-05-13 11:30', created_at: '2025-09-10 09:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2025-09-10 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Video Editor' },
        { time: '2026-03-15 16:30', actor: 'Mai Phương', action: 'permission_changed', desc: 'Custom → Production Only' }
      ],
      work_stats: { assigned_tasks: 35, open_tasks: 6, overdue_tasks: 1, completed_tasks: 26, avg_progress: 72 }
    },
    {
      user_id: 'USR-0005', full_name: 'Vinh Lê', email: 'vinh.le@cb.vn', phone: '0901234504',
      role: 'staff', tag: 'Editor', department: 'HO Marketing',
      permission_group: 'production_only', data_scope: 'assigned',
      status: 'active', last_login_at: '2026-05-13 08:00', created_at: '2025-10-05 09:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2025-10-05 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Video Editor' }
      ],
      work_stats: { assigned_tasks: 40, open_tasks: 7, overdue_tasks: 2, completed_tasks: 31, avg_progress: 65 }
    },
    {
      user_id: 'USR-0006', full_name: 'Đức Anh', email: 'duc.anh@cb.vn', phone: '0901234505',
      role: 'account', tag: 'Account', department: 'CB Cần Thơ',
      permission_group: 'order_mgmt', data_scope: 'department',
      status: 'active', last_login_at: '2026-05-12 17:45', created_at: '2025-11-01 09:00',
      created_by: 'Mai Phương',
      allowed_departments: ['CB Cần Thơ'],
      activity: [
        { time: '2025-11-01 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Account chi nhánh' }
      ],
      work_stats: { assigned_orders: 22, waiting_brief: 2, in_delivery: 3, avg_rating: 4.8 }
    },
    {
      user_id: 'USR-0007', full_name: 'Nguyễn Thu Hà', email: 'ha.nguyen@cbcentres.com', phone: '0907654321',
      role: 'client', tag: 'Academic', department: 'Academic',
      permission_group: 'client_only', data_scope: 'client_own',
      status: 'active', last_login_at: '2026-05-12 10:30', created_at: '2026-01-15 10:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2026-01-15 10:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Client (Academic HO)' }
      ],
      work_stats: { created_orders: 12, open_orders: 3, completed_orders: 9, avg_rating_given: 4.7 }
    },
    {
      user_id: 'USR-0008', full_name: 'Lê Văn Minh', email: 'minh.le@cbcentres.com', phone: '0913456789',
      role: 'client', tag: 'Branch', department: 'CB Hưng Phú',
      permission_group: 'client_only', data_scope: 'client_own',
      status: 'active', last_login_at: '2026-05-12 11:00', created_at: '2025-12-01 10:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2025-12-01 10:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Client CB Hưng Phú' }
      ],
      work_stats: { created_orders: 8, open_orders: 2, completed_orders: 6, avg_rating_given: 4.6 }
    },
    {
      user_id: 'USR-0009', full_name: 'Trần Quốc Anh', email: 'qa@cbcentres.com', phone: '0901234567',
      role: 'client', tag: 'Branch', department: 'CB Mekong',
      permission_group: 'client_only', data_scope: 'client_own',
      status: 'active', last_login_at: '2026-05-11 14:20', created_at: '2025-12-10 10:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2025-12-10 10:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Client CB Mekong' }
      ],
      work_stats: { created_orders: 15, open_orders: 4, completed_orders: 11, avg_rating_given: 4.9 }
    },
    {
      user_id: 'USR-0010', full_name: 'Đỗ Quang Hùng', email: 'hung.do@cbcentres.com', phone: '0905112233',
      role: 'client', tag: 'Branch', department: 'CB Cần Thơ',
      permission_group: 'client_only', data_scope: 'client_own',
      status: 'active', last_login_at: '2026-05-10 09:00', created_at: '2026-01-05 10:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2026-01-05 10:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Client CB Cần Thơ' }
      ],
      work_stats: { created_orders: 6, open_orders: 1, completed_orders: 5, avg_rating_given: 4.5 }
    },
    {
      user_id: 'USR-0011', full_name: 'Trần Thị Lan', email: 'lan.tran@cb.vn', phone: '0901234506',
      role: 'staff', tag: 'Photo', department: 'HO Marketing',
      permission_group: 'production_only', data_scope: 'assigned',
      status: 'pending', last_login_at: null, created_at: '2026-05-10 14:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2026-05-10 14:00', actor: 'Mai Phương', action: 'user_created', desc: 'Tạo user mới (chờ accept invite)' },
        { time: '2026-05-10 14:00', actor: 'system', action: 'invite_sent', desc: 'Gửi email mời tới lan.tran@cb.vn' }
      ],
      work_stats: { assigned_tasks: 0, open_tasks: 0, overdue_tasks: 0, completed_tasks: 0, avg_progress: 0 }
    },
    {
      user_id: 'USR-0012', full_name: 'Phạm Văn Tâm', email: 'tam.pham@cb.vn', phone: '0901234507',
      role: 'manager', tag: 'Manager', department: 'HO Marketing',
      permission_group: 'manager_view', data_scope: 'team',
      status: 'active', last_login_at: '2026-05-12 16:00', created_at: '2025-10-15 09:00',
      created_by: 'Mai Phương',
      allowed_departments: ['CB Mekong','CB Hưng Phú','CB Cần Thơ','CB Tiên Thủy'],
      activity: [
        { time: '2025-10-15 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Media Leader' }
      ],
      work_stats: { team_members: 5, team_open_orders: 47, team_avg_rating: 4.7, team_on_time_rate: 92 }
    },
    {
      user_id: 'USR-0013', full_name: 'Hoàng Văn Sơn', email: 'son.hoang@cb.vn', phone: '0901234508',
      role: 'staff', tag: 'Design', department: 'CB Mekong',
      permission_group: 'production_only', data_scope: 'assigned',
      status: 'inactive', last_login_at: '2026-02-28 17:00', created_at: '2025-09-01 09:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2025-09-01 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Junior Designer' },
        { time: '2026-03-01 14:00', actor: 'Mai Phương', action: 'user_deactivated', desc: 'Nghỉ việc' }
      ],
      work_stats: { assigned_tasks: 12, open_tasks: 0, overdue_tasks: 0, completed_tasks: 12, avg_progress: 100 }
    },
    {
      user_id: 'USR-0014', full_name: 'Nguyễn Mai', email: 'mai.nguyen@cb.vn', phone: '',
      role: 'staff', tag: 'Hybrid', department: 'HO Marketing',
      permission_group: 'production_only', data_scope: 'assigned',
      status: 'suspended', last_login_at: '2026-04-15 09:00', created_at: '2025-11-20 09:00',
      created_by: 'Mai Phương',
      allowed_departments: [],
      activity: [
        { time: '2025-11-20 09:00', actor: 'Mai Phương', action: 'user_created', desc: 'Cấp tài khoản Hybrid Staff' },
        { time: '2026-04-20 10:00', actor: 'Mai Phương', action: 'user_deactivated', desc: 'Suspend do vi phạm policy' }
      ],
      work_stats: { assigned_tasks: 8, open_tasks: 2, overdue_tasks: 0, completed_tasks: 6, avg_progress: 75 }
    }
  ];

  // Phase 1: expose array để các module/page khác đọc khi cần.
  window.MH_MOCK_USERS = USERS;

  /* ---------- Phase 1 helpers ---------- */
  // Default permission_group + data_scope dựa trên role (cho user import từ Supabase
  // chưa có các field này — schema public.users chưa có cột tương ứng).
  function defaultPermByRole(role) {
    switch (role) {
      case 'admin':   return { tag: 'manager', permission_group: 'full',         data_scope: 'all' };
      case 'account': return { tag: 'account', permission_group: 'order_mgmt',   data_scope: 'all' };
      case 'design':  return { tag: 'staff',   permission_group: 'production_only', data_scope: 'assigned' };
      case 'editor':  return { tag: 'staff',   permission_group: 'production_only', data_scope: 'assigned' };
      case 'client':  return { tag: 'client',  permission_group: 'client_only', data_scope: 'client_own' };
      default:        return { tag: 'client',  permission_group: 'client_only', data_scope: 'client_own' };
    }
  }
  async function loadUsersFromStore(localArr) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled) return null;
    try {
      const remote = await window.MH.store.users.list();
      if (Array.isArray(remote)) {  // Always replace khi Supabase enabled
        // Adapter: map Supabase column names → mock shape + default field UI cần.
        localArr.length = 0;
        remote.forEach(function (r) {
          const role = r.role || 'client';                // null → client (spec yêu cầu)
          const perm = defaultPermByRole(role);
          localArr.push(Object.assign({}, r, {
            user_id: r.id,                                // UI legacy dùng user_id; Supabase dùng id
            full_name: r.name || (r.email || '').split('@')[0],
            role: role,
            tag: r.tag || perm.tag,
            permission_group: r.permission_group || perm.permission_group,
            data_scope: r.data_scope || perm.data_scope,
            status: r.status || 'active',
            phone: r.phone || '',
            department: r.department || '',
            created_at: r.created_at,
            last_login_at: r.last_login_at,
            work_stats: r.work_stats || { assigned_tasks: 0, open_tasks: 0, overdue_tasks: 0, completed_tasks: 0, avg_progress: 0 },
            activity: r.activity || []
          }));
        });
        return remote.length;
      }
    } catch (e) { console.warn('[user-management] remote load failed:', e); }
    return null;
  }
  function persistUser(userId, patch) {
    if (!window.MH || !window.MH.store || !window.MH.supabaseEnabled || !userId) return;
    // Direct table update via supabase client (data-store.js chưa có users.update — gọi raw)
    if (window.MH.supabase) {
      window.MH.supabase.from('users').update(patch).eq('id', userId).then(function (res) {
        if (res.error) console.warn('[user-management] persist failed:', res.error);
      });
    }
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function initials(name) { return (name || '').split(' ').map((s) => s[0]).filter(Boolean).slice(-2).join('').toUpperCase() || '?'; }
  function fmtDT() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function relTime(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T'));
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' ngày trước';
    return s.split(' ')[0];
  }

  /* ---------- State ---------- */
  const state = { search: '', role: '', tag: '', department: '', status: '', quick: null };

  function applyFilters() {
    return USERS.filter((u) => {
      if (state.search) {
        const q = state.search.toLowerCase();
        const hay = [u.full_name, u.email, u.phone, u.department, u.tag, ROLE_LABEL[u.role]].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (state.role && u.role !== state.role) return false;
      if (state.tag && u.tag !== state.tag) return false;
      if (state.department && u.department !== state.department) return false;
      if (state.status && u.status !== state.status) return false;
      if (state.quick) {
        switch (state.quick) {
          case 'active': if (u.status !== 'active') return false; break;
          case 'admin': if (u.role !== 'admin') return false; break;
          case 'account': if (u.role !== 'account') return false; break;
          case 'staff': if (u.role !== 'staff') return false; break;
          case 'client': if (u.role !== 'client') return false; break;
          case 'inactive': if (!['inactive','suspended','archived'].includes(u.status)) return false; break;
        }
      }
      return true;
    });
  }

  /* ---------- Render summary ---------- */
  function renderSummary() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('sm-total', USERS.length);
    set('sm-active', USERS.filter((u) => u.status === 'active').length);
    set('sm-admin', USERS.filter((u) => u.role === 'admin').length);
    set('sm-account', USERS.filter((u) => u.role === 'account').length);
    set('sm-staff', USERS.filter((u) => u.role === 'staff').length);
    set('sm-client', USERS.filter((u) => u.role === 'client').length);
    set('sm-inactive', USERS.filter((u) => ['inactive','suspended','archived'].includes(u.status)).length);
    // sidebar badge = pending invites
    const nb = document.getElementById('nav-users');
    if (nb) nb.textContent = USERS.filter((u) => u.status === 'pending').length;
  }

  /* ---------- Render table ---------- */
  const tbody = document.getElementById('users-tbody');
  function renderTable() {
    const filtered = applyFilters();
    document.getElementById('tv-visible').textContent = filtered.length;
    document.getElementById('tv-total').textContent = USERS.length;
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <h3>Không có user phù hợp</h3>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map((u, i) => {
      const cellAlt = i % 3 === 1 ? 'has-red' : (i % 3 === 2 ? 'has-mix' : '');
      const ll = u.last_login_at
        ? `<div class="last-login"><b>${relTime(u.last_login_at)}</b><span>${u.last_login_at}</span></div>`
        : `<div class="last-login never">Chưa đăng nhập</div>`;
      return `
        <tr data-id="${u.user_id}">
          <td>
            <div class="user-cell ${cellAlt}">
              <span class="ua">${initials(u.full_name)}</span>
              <div class="ui-info">
                <b>${escapeHtml(u.full_name)}</b>
                <span>${escapeHtml(u.email)}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px">
              <span class="role-tag-badge rt--${u.role}">${ROLE_LABEL[u.role]}</span>
              <span class="tag-chip">${escapeHtml(u.tag)}</span>
            </div>
          </td>
          <td><span class="text-xs">${escapeHtml(u.department)}</span></td>
          <td><span class="text-xs">${PERM_LABEL[u.permission_group] || u.permission_group}</span></td>
          <td><span class="text-xs muted">${SCOPE_LABEL[u.data_scope] || u.data_scope}</span></td>
          <td>${ll}</td>
          <td><span class="user-status us--${u.status}"><span class="dot"></span>${STATUS_LABEL[u.status]}</span></td>
          <td><button class="icon-btn" data-action="view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg></button></td>
        </tr>
      `;
    }).join('');
  }

  function render() { renderSummary(); renderTable(); }

  /* ---------- Toolbar ---------- */
  let st; document.getElementById('search-input').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 180); });
  ['filter-role', 'filter-tag', 'filter-department', 'filter-status'].forEach((id) => {
    const key = id.replace('filter-', '');
    document.getElementById(id).addEventListener('change', (e) => { state[key] = e.target.value; render(); });
  });
  document.querySelectorAll('.pb-stat').forEach((card) => {
    card.addEventListener('click', () => {
      const q = card.getAttribute('data-quick');
      if (q === 'all' || state.quick === q) state.quick = null; else state.quick = q;
      document.querySelectorAll('.pb-stat').forEach((c) => c.classList.remove('is-active'));
      if (state.quick) card.classList.add('is-active');
      render();
    });
  });
  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const u = USERS.find((x) => x.user_id === row.getAttribute('data-id'));
    if (u) openDrawer(u);
  });

  /* ---------- Drawer ---------- */
  const drawer = document.getElementById('user-drawer');
  const drawerBd = document.getElementById('drawer-backdrop');
  const drawerBody = document.getElementById('drawer-body');
  let curUser = null;

  function buildModuleMatrix(permKey) {
    const matrix = MODULE_MATRIX[permKey] || {};
    const allModules = ['dashboard', 'orders', 'production', 'delivery', 'reports', 'ai_tools', 'users', 'settings'];
    const MODULE_LABEL = {
      dashboard: 'Dashboard', orders: 'Orders', production: 'Production',
      delivery: 'Delivery', reports: 'Reports', ai_tools: 'AI Tools',
      users: 'User Mgmt', settings: 'Settings'
    };
    return `<div class="module-matrix">${
      allModules.map((m) => {
        const acts = matrix[m] || [];
        const hasAccess = acts.length > 0;
        const ACTIONS = ['view','create','edit','approve','assign','export'];
        return `<div class="module-matrix-row">
          <b>${MODULE_LABEL[m]}</b>
          <div class="actions">${
            hasAccess
              ? ACTIONS.map((a) => acts.includes(a) ? `<span class="act">${a}</span>` : '').filter(Boolean).join('') + (acts.includes('use_ai') ? '<span class="act">use</span>' : '') + (acts.includes('upload') ? '<span class="act">upload</span>' : '') + (acts.includes('configure') ? '<span class="act">configure</span>' : '') + (acts.includes('deliver') ? '<span class="act">deliver</span>' : '') + (acts.includes('comment') ? '<span class="act">comment</span>' : '')
              : '<span class="act deny">no access</span>'
          }</div>
        </div>`;
      }).join('')
    }</div>`;
  }

  function buildWorkStats(u) {
    const s = u.work_stats || {};
    if (u.role === 'account' || u.role === 'admin') {
      return `<div class="work-stats">
        <div class="work-stat"><label>Assigned</label><b>${s.assigned_orders || 0}</b></div>
        <div class="work-stat warn"><label>Waiting brief</label><b>${s.waiting_brief || 0}</b></div>
        <div class="work-stat"><label>In delivery</label><b>${s.in_delivery || 0}</b></div>
        <div class="work-stat ok"><label>Avg rating</label><b>★ ${s.avg_rating || '—'}</b></div>
      </div>`;
    }
    if (u.role === 'staff') {
      return `<div class="work-stats">
        <div class="work-stat"><label>Assigned</label><b>${s.assigned_tasks || 0}</b></div>
        <div class="work-stat"><label>Open</label><b>${s.open_tasks || 0}</b></div>
        <div class="work-stat bad"><label>Overdue</label><b>${s.overdue_tasks || 0}</b></div>
        <div class="work-stat ok"><label>Completed</label><b>${s.completed_tasks || 0}</b></div>
      </div>`;
    }
    if (u.role === 'client') {
      return `<div class="work-stats">
        <div class="work-stat"><label>Created</label><b>${s.created_orders || 0}</b></div>
        <div class="work-stat"><label>Open</label><b>${s.open_orders || 0}</b></div>
        <div class="work-stat ok"><label>Completed</label><b>${s.completed_orders || 0}</b></div>
        <div class="work-stat ok"><label>Avg rating</label><b>★ ${s.avg_rating_given || '—'}</b></div>
      </div>`;
    }
    if (u.role === 'manager') {
      return `<div class="work-stats">
        <div class="work-stat"><label>Team size</label><b>${s.team_members || 0}</b></div>
        <div class="work-stat"><label>Open orders</label><b>${s.team_open_orders || 0}</b></div>
        <div class="work-stat ok"><label>On-time</label><b>${s.team_on_time_rate || 0}%</b></div>
        <div class="work-stat ok"><label>Avg rating</label><b>★ ${s.team_avg_rating || '—'}</b></div>
      </div>`;
    }
    return '';
  }

  function openDrawer(u) {
    curUser = u;
    document.getElementById('d-user-id').textContent = u.user_id;
    document.getElementById('d-name').textContent = u.full_name;
    document.getElementById('d-copy').setAttribute('data-copy', u.user_id);
    const dr = document.getElementById('d-role');
    dr.className = 'role-tag-badge rt--' + u.role;
    dr.textContent = ROLE_LABEL[u.role];
    document.getElementById('d-tag').textContent = u.tag;
    const ds = document.getElementById('d-status');
    ds.className = 'user-status us--' + u.status;
    ds.innerHTML = '<span class="dot"></span>' + STATUS_LABEL[u.status];

    // Toggle button label
    const toggleLabel = document.getElementById('toggle-status-label');
    toggleLabel.textContent = u.status === 'active' ? 'Deactivate' : (u.status === 'pending' ? 'Activate' : 'Reactivate');

    const v = (x) => x ? escapeHtml(x) : '<em class="muted">—</em>';
    const dept = u.allowed_departments && u.allowed_departments.length
      ? `<div class="dept-chips">${u.allowed_departments.map((d) => `<span class="chip">${escapeHtml(d)}</span>`).join('')}</div>`
      : '<em class="muted">— Chỉ department chính —</em>';

    drawerBody.innerHTML = `
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">A</span><h4>Profile Summary</h4></div>
        <dl>
          <dt>Email</dt><dd>${v(u.email)}</dd>
          <dt>Phone</dt><dd>${v(u.phone)}</dd>
          <dt>Department chính</dt><dd>${v(u.department)}</dd>
          <dt>Created</dt><dd><span class="mono text-xs">${v(u.created_at)}</span> ${u.created_by ? `· by ${escapeHtml(u.created_by)}` : ''}</dd>
          <dt>Last Login</dt><dd>${u.last_login_at ? `<span class="mono text-xs">${u.last_login_at}</span> <em class="muted">(${relTime(u.last_login_at)})</em>` : '<em class="muted">Chưa đăng nhập</em>'}</dd>
        </dl>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">B</span><h4>Role &amp; Permission</h4></div>
        <dl>
          <dt>Role</dt><dd><span class="role-tag-badge rt--${u.role}">${ROLE_LABEL[u.role]}</span></dd>
          <dt>Tag</dt><dd><span class="tag-chip">${escapeHtml(u.tag)}</span></dd>
          <dt>Permission Group</dt><dd><b>${PERM_LABEL[u.permission_group]}</b></dd>
          <dt>Data Scope</dt><dd>${SCOPE_LABEL[u.data_scope]}</dd>
          <dt>Allowed Departments</dt><dd>${dept}</dd>
        </dl>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">C</span><h4>Module Access</h4></div>
        ${buildModuleMatrix(u.permission_group)}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">D</span><h4>Assigned Work Summary</h4></div>
        ${buildWorkStats(u)}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">E</span><h4>Recent Activity (${u.activity.length})</h4></div>
        <ul class="activity-mini">
          ${[...u.activity].reverse().map((a) => `<li><span><b>${escapeHtml(a.actor)}</b> · ${escapeHtml(a.desc)}</span><time>${a.time}</time></li>`).join('')}
        </ul>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">F</span><h4>Security</h4></div>
        <dl>
          <dt>Status</dt><dd><span class="user-status us--${u.status}"><span class="dot"></span>${STATUS_LABEL[u.status]}</span></dd>
          <dt>Auth method</dt><dd>Email + password (SSO sắp hỗ trợ)</dd>
          <dt>Invite token</dt><dd>${u.status === 'pending' ? '<em class="muted">Hết hạn sau 7 ngày — resend nếu cần</em>' : '<em class="muted">N/A</em>'}</dd>
        </dl>
      </section>
    `;

    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerBd.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawerBd.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  drawerBd.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal.classList.contains('is-open')) closeModal();
      else if (drawer.classList.contains('is-open')) closeDrawer();
    }
  });

  /* ---------- Drawer actions ---------- */
  document.getElementById('act-edit').addEventListener('click', () => openModal('edit', curUser));
  document.getElementById('act-resend').addEventListener('click', () => {
    if (!curUser) return;
    curUser.activity.push({ time: fmtDT(), actor: user.name, action: 'invite_resent', desc: 'Gửi lại email mời' });
    window.MH.toast({ type: 'success', title: 'Đã gửi lại invite', message: curUser.email });
    openDrawer(curUser);
  });
  document.getElementById('act-reset').addEventListener('click', () => {
    if (!curUser) return;
    curUser.activity.push({ time: fmtDT(), actor: user.name, action: 'password_reset_sent', desc: 'Gửi link reset password' });
    window.MH.toast({ type: 'success', title: 'Đã gửi link reset', message: curUser.email });
    openDrawer(curUser);
  });
  document.getElementById('act-toggle-status').addEventListener('click', () => {
    if (!curUser) return;
    // Validation: không deactivate admin duy nhất
    if (curUser.status === 'active' && curUser.role === 'admin') {
      const otherAdmins = USERS.filter((x) => x.role === 'admin' && x.status === 'active' && x.user_id !== curUser.user_id);
      if (otherAdmins.length === 0) {
        window.MH.toast({ type: 'error', title: 'Không thể deactivate', message: 'Đây là Admin duy nhất đang active. Cần tạo Admin khác trước.' });
        return;
      }
    }
    // Validation: warning nếu user có open tasks
    const stats = curUser.work_stats || {};
    const openCount = (stats.open_tasks || stats.open_orders || 0);
    if (curUser.status === 'active' && openCount > 0) {
      if (!confirm(`User đang có ${openCount} task/order đang mở. Deactivate sẽ giữ lịch sử nhưng cần reassign. Tiếp tục?`)) return;
    }

    const oldStatus = curUser.status;
    let newStatus, actionType, desc;
    if (curUser.status === 'active') {
      newStatus = 'inactive'; actionType = 'user_deactivated'; desc = 'Deactivate user';
    } else if (curUser.status === 'pending') {
      newStatus = 'active'; actionType = 'user_activated'; desc = 'Activate user (manual)';
    } else {
      newStatus = 'active'; actionType = 'user_reactivated'; desc = 'Reactivate user';
    }
    curUser.status = newStatus;
    curUser.activity.push({ time: fmtDT(), actor: user.name, action: actionType, desc: `${desc}: ${STATUS_LABEL[oldStatus]} → ${STATUS_LABEL[newStatus]}` });
    // Phase 1: persist sang Supabase nếu enabled (curUser.id là uuid từ auth)
    persistUser(curUser.id, { status: newStatus });
    window.MH.toast({ type: 'success', title: '✓ Đã cập nhật status', message: `${curUser.full_name}: ${STATUS_LABEL[newStatus]}` });
    render(); openDrawer(curUser);
  });

  /* ---------- Modal ---------- */
  const modal = document.getElementById('user-modal');
  const form = document.getElementById('user-form');
  let modalMode = 'create'; // 'create' | 'edit'
  let editingUser = null;

  function openModal(mode, u) {
    modalMode = mode;
    editingUser = u || null;
    document.getElementById('modal-title').textContent = mode === 'create' ? 'Thêm user mới' : 'Chỉnh sửa user';
    document.getElementById('modal-subtitle').textContent = mode === 'create'
      ? 'Cấp tài khoản + gán role, permission group và data scope.'
      : 'Cập nhật thông tin user. Email không thể đổi.';
    document.getElementById('modal-submit').innerHTML = mode === 'create'
      ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Tạo user'
      : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Lưu thay đổi';

    form.reset();
    form.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error'));
    document.getElementById('permission-preview').style.display = 'none';

    if (mode === 'edit' && u) {
      document.getElementById('u-name').value = u.full_name;
      document.getElementById('u-email').value = u.email;
      document.getElementById('u-email').readOnly = true;
      document.getElementById('u-phone').value = u.phone || '';
      document.getElementById('u-department').value = u.department;
      document.getElementById('u-role').value = u.role;
      document.getElementById('u-tag').value = u.tag;
      document.getElementById('u-permission').value = u.permission_group;
      document.getElementById('u-scope').value = u.data_scope;
      document.getElementById('u-status').value = u.status;
      document.getElementById('u-invite').parentElement.style.display = 'none';
      updatePermissionPreview();
    } else {
      document.getElementById('u-email').readOnly = false;
      document.getElementById('u-invite').parentElement.style.display = '';
      document.getElementById('u-status').value = 'pending';
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  document.getElementById('add-user-btn').addEventListener('click', () => openModal('create', null));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  /* ---------- Permission preview (auto-suggest scope khi đổi role/permission) ---------- */
  function updatePermissionPreview() {
    const permKey = document.getElementById('u-permission').value;
    if (!permKey || !PERM_PREVIEW[permKey]) {
      document.getElementById('permission-preview').style.display = 'none';
      return;
    }
    document.getElementById('permission-preview').style.display = 'block';
    document.getElementById('permission-preview-list').innerHTML = PERM_PREVIEW[permKey].map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  }
  document.getElementById('u-permission').addEventListener('change', updatePermissionPreview);

  // Auto-suggest permission & scope based on role
  document.getElementById('u-role').addEventListener('change', (e) => {
    const role = e.target.value;
    const permSel = document.getElementById('u-permission');
    const scopeSel = document.getElementById('u-scope');
    const tagSel = document.getElementById('u-tag');
    if (modalMode === 'create' && permSel.value === '') {
      const map = {
        admin: { perm: 'full', scope: 'all', tag: 'Manager' },
        manager: { perm: 'manager_view', scope: 'team', tag: 'Manager' },
        account: { perm: 'order_mgmt', scope: 'assigned', tag: 'Account' },
        staff: { perm: 'production_only', scope: 'assigned', tag: 'Design' },
        client: { perm: 'client_only', scope: 'client_own', tag: 'Branch' }
      };
      const m = map[role];
      if (m) {
        permSel.value = m.perm; scopeSel.value = m.scope;
        if (!tagSel.value) tagSel.value = m.tag;
        updatePermissionPreview();
      }
    }
  });

  /* ---------- Submit (Create / Edit) ---------- */
  function clearErrors() { form.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error')); }
  function markError(input) { const f = input.closest('.field'); if (f) f.classList.add('has-error'); }

  document.getElementById('modal-submit').addEventListener('click', () => {
    clearErrors();
    const name = document.getElementById('u-name').value.trim();
    const email = document.getElementById('u-email').value.trim().toLowerCase();
    const phone = document.getElementById('u-phone').value.trim();
    const dept = document.getElementById('u-department').value;
    const role = document.getElementById('u-role').value;
    const tag = document.getElementById('u-tag').value;
    const perm = document.getElementById('u-permission').value;
    const scope = document.getElementById('u-scope').value;
    const status = document.getElementById('u-status').value;
    const sendInvite = document.getElementById('u-invite').checked;

    let firstInvalid = null;
    function fail(el) { markError(el); if (!firstInvalid) firstInvalid = el; }
    if (!name) fail(document.getElementById('u-name'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(document.getElementById('u-email'));
    if (!dept) fail(document.getElementById('u-department'));
    if (!role) fail(document.getElementById('u-role'));
    if (!tag) fail(document.getElementById('u-tag'));
    if (!perm) fail(document.getElementById('u-permission'));
    if (!scope) fail(document.getElementById('u-scope'));

    // Unique email check (chỉ khi create hoặc đổi email)
    if (modalMode === 'create') {
      if (USERS.find((u) => u.email.toLowerCase() === email)) {
        fail(document.getElementById('u-email'));
        window.MH.toast({ type: 'error', title: 'Email đã tồn tại', message: email });
        return;
      }
    }

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.MH.toast({ type: 'error', title: 'Thiếu thông tin', message: 'Vui lòng kiểm tra các trường được đánh dấu đỏ.' });
      return;
    }

    // Validation: admin + permission group
    if (role === 'admin' && perm !== 'full') {
      if (!confirm('Admin thông thường nên có Permission Group = Full Access. Tiếp tục với Custom?')) return;
    }

    if (modalMode === 'create') {
      const newId = 'USR-' + String(USERS.length + 1).padStart(4, '0');
      const newUser = {
        user_id: newId, full_name: name, email, phone,
        role, tag, department: dept,
        permission_group: perm, data_scope: scope,
        status: sendInvite ? 'pending' : status,
        last_login_at: null, created_at: fmtDT(), created_by: user.name,
        allowed_departments: [],
        activity: [{ time: fmtDT(), actor: user.name, action: 'user_created', desc: `Tạo user role ${ROLE_LABEL[role]}, tag ${tag}` }],
        work_stats: {}
      };
      if (sendInvite) {
        newUser.activity.push({ time: fmtDT(), actor: 'system', action: 'invite_sent', desc: 'Gửi email mời tới ' + email });
      }
      USERS.push(newUser);
      window.MH.toast({ type: 'success', title: '✓ Đã tạo user', message: `${name} · ${ROLE_LABEL[role]}${sendInvite ? ' · invite đã gửi' : ''}` });
    } else if (editingUser) {
      const changes = [];
      if (editingUser.full_name !== name) changes.push(`name: ${editingUser.full_name} → ${name}`);
      if (editingUser.role !== role) changes.push(`role: ${ROLE_LABEL[editingUser.role]} → ${ROLE_LABEL[role]}`);
      if (editingUser.permission_group !== perm) changes.push(`permission: ${PERM_LABEL[editingUser.permission_group]} → ${PERM_LABEL[perm]}`);
      if (editingUser.data_scope !== scope) changes.push(`scope: ${SCOPE_LABEL[editingUser.data_scope]} → ${SCOPE_LABEL[scope]}`);
      if (editingUser.status !== status) changes.push(`status: ${STATUS_LABEL[editingUser.status]} → ${STATUS_LABEL[status]}`);
      Object.assign(editingUser, {
        full_name: name, phone, department: dept, role, tag,
        permission_group: perm, data_scope: scope, status
      });
      if (changes.length) {
        editingUser.activity.push({ time: fmtDT(), actor: user.name, action: 'user_updated', desc: changes.join(' · ') });
      }
      // Phase 1: persist update sang Supabase (chỉ những field nằm trong public.users schema)
      persistUser(editingUser.id, {
        name: name,
        phone: phone || null,
        department: dept || null,
        role: role,
        status: status
      });
      window.MH.toast({ type: 'success', title: '✓ Đã cập nhật user', message: name });
      if (curUser && curUser.user_id === editingUser.user_id) openDrawer(editingUser);
    }
    closeModal();
    render();
  });

  /* ---------- Export ---------- */
  document.getElementById('export-users').addEventListener('click', () => {
    const rows = [
      ['CB Media Hub — User Management Export'],
      ['Generated: ' + new Date().toISOString()],
      ['Total users: ' + USERS.length],
      [],
      ['User ID', 'Full Name', 'Email', 'Phone', 'Role', 'Tag', 'Department', 'Permission Group', 'Data Scope', 'Status', 'Last Login', 'Created At', 'Created By'],
      ...USERS.map((u) => [u.user_id, u.full_name, u.email, u.phone || '', ROLE_LABEL[u.role], u.tag, u.department, PERM_LABEL[u.permission_group], SCOPE_LABEL[u.data_scope], STATUS_LABEL[u.status], u.last_login_at || 'Never', u.created_at, u.created_by || ''])
    ];
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cb-media-hub-users-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.MH.toast({ type: 'success', title: 'Đã export', message: `${USERS.length} users` });
  });

  /* ---------- Init ---------- */
  render();

  // Phase 1: swap dataset từ Supabase nếu enabled.
  loadUsersFromStore(USERS).then(function (n) {
    if (typeof n === 'number') {
      console.log('[user-management] swapped ' + n + ' users từ Supabase');
      render();
    }
  });
})();
