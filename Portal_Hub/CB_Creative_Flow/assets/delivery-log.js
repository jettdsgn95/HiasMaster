/* =====================================================================
   CB Media Hub — Delivery Log module logic
   - Auth guard: admin / account only (design/editor/client redirected)
   - Mock deliveries linked to tasks + orders
   - Summary cards, filter, sortable table
   - Detail drawer with 6 blocks (A–F)
   - Send Preview / Send Final (with checklist validation) / Request Revision / Rating
   - Close / Reopen / Activity log
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Auth ---------- */
  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (!['admin', 'account'].includes(user.role)) {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Delivery Log nội bộ chỉ dành cho Admin/Account.' });
    setTimeout(() => location.replace('dashboard.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  const pcName = document.getElementById('pc-name');
  const pcAvatar = document.getElementById('pc-avatar');
  const pcRole = document.getElementById('pc-role-badge');
  if (pcName) pcName.textContent = user.name || 'User';
  if (pcAvatar) pcAvatar.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
  if (pcRole) { pcRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1); pcRole.className = 'role-badge r--' + user.role; }
  const chip = document.getElementById('profile-chip');
  if (chip) {
    chip.addEventListener('click', (e) => { if (e.target.closest('.profile-menu')) return; chip.classList.toggle('is-open'); });
    document.addEventListener('click', (e) => { if (!chip.contains(e.target)) chip.classList.remove('is-open'); });
  }
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('mh-user'); window.MH.toast({ type: 'info', title: 'Đã đăng xuất' });
    setTimeout(() => location.href = 'login.html', 500);
  });
  const sb = document.getElementById('dash-sb'), sbd = document.getElementById('sb-backdrop'), sbt = document.getElementById('sb-toggle');
  if (sbt) sbt.addEventListener('click', () => { sb.classList.add('is-open'); sbd.classList.add('is-open'); });
  if (sbd) sbd.addEventListener('click', () => { sb.classList.remove('is-open'); sbd.classList.remove('is-open'); });

  /* ---------- Helpers ---------- */
  const STATUS_LABEL = {
    waiting: 'Chờ Account kiểm tra', need_rev: 'Cần chỉnh sửa nội bộ', ready: 'Sẵn sàng bàn giao',
    preview: 'Đã gửi preview', client_wait: 'Chờ client phản hồi', client_rev: 'Client yêu cầu chỉnh sửa',
    final: 'Đã gửi final', rated: 'Đã nhận đánh giá', completed: 'Hoàn thành',
    reopened: 'Mở lại', cancelled: 'Hủy'
  };
  const TYPE_LABEL = { design: 'Design / POSM', digital: 'Digital', video: 'Video', motion: 'Motion', shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads', slide: 'Slide' };
  const CHANNEL_LABEL = { portal: 'Portal', email: 'Email', zalo: 'Zalo', drive: 'Google Drive', dm: 'Direct message', other: 'Khác' };
  const FB_CATEGORIES = [
    { key: 'quality',  label: 'Chất lượng', cls: 'is-quality' },
    { key: 'timing',   label: 'Tiến độ',    cls: 'is-timing' },
    { key: 'coord',    label: 'Phối hợp',   cls: 'is-coord' },
    { key: 'content',  label: 'Nội dung',   cls: 'is-content' },
    { key: 'file',     label: 'File / link',cls: 'is-file' }
  ];
  const TODAY = new Date('2026-05-13');
  function parseDate(s) { return s ? new Date(s.replace(' ', 'T')) : null; }
  function diffDays(s) { const d = parseDate(s); if (!d) return null; return Math.ceil((d - TODAY) / 86400000); }
  function fmtDT() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function stars(score) {
    if (!score) return '<em class="muted text-xs">Chưa rating</em>';
    let h = '<span class="rating-stars">';
    for (let i = 1; i <= 5; i++) h += `<span class="star ${i <= score ? '' : 'empty'}">${i <= score ? '★' : '☆'}</span>`;
    h += `<b>${score}/5</b></span>`;
    return h;
  }

  /* ---------- Mock data (linked to existing tasks) ---------- */
  const DELIVERIES = [
    { delivery_id: 'DLV-2026-0001', order_id: 'MEDIA-2026-0006', task_id: 'TASK-0003',
      project_name: 'Reel TikTok Tháng 5', task_type: 'video',
      requester_name: 'Vũ Hoàng Mai', requester_email: 'mai.vu@cbcentres.com', department: 'HO Marketing',
      account_name: 'Hậu', production_pic: 'Vinh',
      delivery_status: 'waiting', priority: 'critical',
      preview_link: 'https://drive.google.com/preview-reels-v1', final_link: '',
      delivery_date: null, delivery_channel: '', delivered_to: '', delivered_by: '',
      client_approval_status: 'Pending', satisfaction_score: null, client_feedback: '',
      fb_categories: [], delivery_note: '', closed_at: null, reopened_count: 0,
      checklist: { brief: false, content: false, size: false, brand: false, file: false, drive: false, version: false, note: false },
      requested_deadline: '2026-05-13', internal_deadline: '2026-05-12 17:00',
      created_at: '2026-05-12 16:45', updated_at: '2026-05-12 16:45',
      activity: [{ time: '2026-05-12 16:45', user: 'Vinh', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' }]
    },
    { delivery_id: 'DLV-2026-0002', order_id: 'MEDIA-2026-0009', task_id: 'TASK-0006',
      project_name: 'Slide Proposal Đối tác Trường', task_type: 'slide',
      requester_name: 'Lê Thị Hoa', requester_email: 'hoa.le@cbcentres.com', department: 'Academic',
      account_name: 'Mai Phương', production_pic: 'Duy',
      delivery_status: 'ready', priority: 'normal',
      preview_link: 'https://drive.google.com/preview-slide-v2', final_link: 'https://drive.google.com/final-slide',
      delivery_date: null, delivery_channel: '', delivered_to: '', delivered_by: '',
      client_approval_status: 'Pending', satisfaction_score: null, client_feedback: '',
      fb_categories: [], delivery_note: 'File OK, chuẩn brand CB.', closed_at: null, reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: true, file: true, drive: true, version: true, note: false },
      requested_deadline: '2026-05-14', internal_deadline: '2026-05-13 17:00',
      created_at: '2026-05-12 10:00', updated_at: '2026-05-12 10:30',
      activity: [
        { time: '2026-05-12 10:00', user: 'Duy', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-12 10:30', user: 'Mai Phương', type: 'account_checked', desc: 'Đã kiểm tra file — đạt' }
      ]
    },
    { delivery_id: 'DLV-2026-0003', order_id: 'MEDIA-2026-0005', task_id: 'TASK-0002',
      project_name: 'Photoshoot Cơ sở Mới', task_type: 'photo',
      requester_name: 'Đỗ Quang Hùng', requester_email: 'hung.do@cbcentres.com', department: 'CB Cần Thơ',
      account_name: 'Đức Anh', production_pic: 'Linh Chi',
      delivery_status: 'need_rev', priority: 'normal',
      preview_link: 'https://drive.google.com/preview-photo', final_link: '',
      delivery_date: null, delivery_channel: '', delivered_to: '', delivered_by: '',
      client_approval_status: 'Pending', satisfaction_score: null, client_feedback: '',
      fb_categories: [], delivery_note: 'Ảnh #12, #18 cần tăng sáng. Đẩy lại Production.', closed_at: null, reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: false, file: false, drive: true, version: false, note: false },
      requested_deadline: '2026-05-18', internal_deadline: '2026-05-15 17:00',
      created_at: '2026-05-12 08:15', updated_at: '2026-05-12 14:00',
      activity: [
        { time: '2026-05-12 08:15', user: 'Linh Chi', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-12 14:00', user: 'Đức Anh', type: 'internal_revision_requested', desc: 'Yêu cầu retouch ảnh #12, #18' }
      ]
    },
    { delivery_id: 'DLV-2026-0004', order_id: 'MEDIA-2026-0010', task_id: 'TASK-0007',
      project_name: 'Bộ Poster Tuyển dụng', task_type: 'design',
      requester_name: 'Phạm Thanh Hà', requester_email: 'ha.pham@cbcentres.com', department: 'CB Mekong',
      account_name: 'Hậu', production_pic: 'Vinh',
      delivery_status: 'rated', priority: 'normal',
      preview_link: 'https://drive.google.com/preview-posters', final_link: 'https://drive.google.com/final-posters',
      delivery_date: '2026-05-09 11:30', delivery_channel: 'portal', delivered_to: 'ha.pham@cbcentres.com', delivered_by: 'Hậu',
      client_approval_status: 'Approved', satisfaction_score: 5,
      client_feedback: 'Bộ poster đẹp, đủ thông tin, đúng tone. Cảm ơn team!',
      fb_categories: ['quality', 'timing'], delivery_note: '', closed_at: null, reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: true, file: true, drive: true, version: true, note: true },
      requested_deadline: '2026-05-09', internal_deadline: '2026-05-08 17:00',
      created_at: '2026-05-08 17:00', updated_at: '2026-05-10 14:20',
      activity: [
        { time: '2026-05-08 17:00', user: 'Vinh', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-08 18:30', user: 'Hậu', type: 'account_checked', desc: 'Checklist OK — chuyển sang Sẵn sàng bàn giao' },
        { time: '2026-05-09 11:30', user: 'Hậu', type: 'final_sent', desc: 'Gửi final qua Portal' },
        { time: '2026-05-10 14:20', user: 'CB Mekong', type: 'rating_submitted', desc: 'Client rating 5/5' }
      ]
    },
    { delivery_id: 'DLV-2026-0005', order_id: 'MEDIA-2026-0012', task_id: 'TASK-0009',
      project_name: 'Email Template Newsletter Q2', task_type: 'digital',
      requester_name: 'Vũ Hoàng Mai', requester_email: 'mai.vu@cbcentres.com', department: 'HO Marketing',
      account_name: 'Hậu', production_pic: 'Duy',
      delivery_status: 'completed', priority: 'normal',
      preview_link: 'https://drive.google.com/preview-email', final_link: 'https://drive.google.com/final-email-template',
      delivery_date: '2026-05-11 16:30', delivery_channel: 'email', delivered_to: 'mai.vu@cbcentres.com', delivered_by: 'Hậu',
      client_approval_status: 'Approved', satisfaction_score: 4,
      client_feedback: 'Template chuẩn responsive. Có thể tinh tế hơn ở phần CTA.',
      fb_categories: ['quality'], delivery_note: '', closed_at: '2026-05-12 09:00', reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: true, file: true, drive: true, version: true, note: false },
      requested_deadline: '2026-05-12', internal_deadline: '2026-05-11 17:00',
      created_at: '2026-05-11 16:00', updated_at: '2026-05-12 09:00',
      activity: [
        { time: '2026-05-11 16:00', user: 'Duy', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-11 16:20', user: 'Hậu', type: 'account_checked', desc: 'Checklist OK' },
        { time: '2026-05-11 16:30', user: 'Hậu', type: 'final_sent', desc: 'Gửi final qua Email' },
        { time: '2026-05-11 22:30', user: 'HO Marketing', type: 'rating_submitted', desc: 'Rating 4/5' },
        { time: '2026-05-12 09:00', user: 'Hậu', type: 'delivery_completed', desc: 'Đóng delivery' }
      ]
    },
    { delivery_id: 'DLV-2026-0006', order_id: 'MEDIA-2026-0014', task_id: 'TASK-0012',
      project_name: 'Voucher Ưu đãi Tháng 5', task_type: 'design',
      requester_name: 'Trần Quốc Anh', requester_email: 'qa@cbcentres.com', department: 'CB Mekong',
      account_name: 'Hậu', production_pic: 'Duy',
      delivery_status: 'completed', priority: 'normal',
      preview_link: 'https://drive.google.com/preview-vouchers', final_link: 'https://drive.google.com/final-vouchers',
      delivery_date: '2026-05-05 11:00', delivery_channel: 'portal', delivered_to: 'qa@cbcentres.com', delivered_by: 'Hậu',
      client_approval_status: 'Approved', satisfaction_score: 5,
      client_feedback: 'Voucher đẹp, in ra rõ, đúng spec.',
      fb_categories: ['quality', 'file'], delivery_note: '', closed_at: '2026-05-06 10:00', reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: true, file: true, drive: true, version: true, note: true },
      requested_deadline: '2026-05-05', internal_deadline: '2026-05-04 17:00',
      created_at: '2026-05-05 09:00', updated_at: '2026-05-06 10:00',
      activity: [
        { time: '2026-05-05 09:00', user: 'Duy', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-05 11:00', user: 'Hậu', type: 'final_sent', desc: 'Gửi final qua Portal' },
        { time: '2026-05-06 09:30', user: 'CB Mekong', type: 'rating_submitted', desc: 'Rating 5/5' },
        { time: '2026-05-06 10:00', user: 'Hậu', type: 'delivery_completed', desc: 'Đóng delivery' }
      ]
    },
    { delivery_id: 'DLV-2026-0007', order_id: 'MEDIA-2026-0011', task_id: 'TASK-0008',
      project_name: 'TVC Sản phẩm Hè 30s', task_type: 'video',
      requester_name: 'Đỗ Quang Hùng', requester_email: 'hung.do@cbcentres.com', department: 'CB Cần Thơ',
      account_name: 'Mai Phương', production_pic: 'Vinh',
      delivery_status: 'preview', priority: 'urgent',
      preview_link: 'https://drive.google.com/preview-tvc-v2', final_link: '',
      delivery_date: '2026-05-11 18:00', delivery_channel: 'portal', delivered_to: 'hung.do@cbcentres.com', delivered_by: 'Mai Phương',
      client_approval_status: 'Pending', satisfaction_score: null, client_feedback: '',
      fb_categories: [], delivery_note: 'Đang chờ client review preview v2.', closed_at: null, reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: true, file: false, drive: true, version: true, note: false },
      requested_deadline: '2026-05-10', internal_deadline: '2026-05-08 17:00',
      created_at: '2026-05-11 17:00', updated_at: '2026-05-11 18:00',
      activity: [
        { time: '2026-05-11 17:00', user: 'Vinh', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-11 18:00', user: 'Mai Phương', type: 'preview_sent', desc: 'Gửi preview v2 cho client' }
      ]
    },
    { delivery_id: 'DLV-2026-0008', order_id: 'MEDIA-2026-0008', task_id: 'TASK-0005',
      project_name: 'Logo Motion Sản phẩm Mới', task_type: 'motion',
      requester_name: 'Nguyễn Hữu Tài', requester_email: 'tai.nguyen@cbcentres.com', department: 'CB Tiên Thủy',
      account_name: 'Đức Anh', production_pic: 'Linh Chi',
      delivery_status: 'client_wait', priority: 'normal',
      preview_link: 'https://drive.google.com/preview-motion-logo', final_link: '',
      delivery_date: '2026-05-10 14:00', delivery_channel: 'zalo', delivered_to: 'tai.nguyen@cbcentres.com', delivered_by: 'Đức Anh',
      client_approval_status: 'Pending', satisfaction_score: null, client_feedback: '',
      fb_categories: [], delivery_note: 'Chờ client review 3 phiên bản motion.', closed_at: null, reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: true, file: false, drive: true, version: true, note: false },
      requested_deadline: '2026-05-20', internal_deadline: '2026-05-18 17:00',
      created_at: '2026-05-10 13:00', updated_at: '2026-05-10 14:00',
      activity: [
        { time: '2026-05-10 13:00', user: 'Linh Chi', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-10 14:00', user: 'Đức Anh', type: 'preview_sent', desc: 'Gửi 3 phiên bản motion qua Zalo' }
      ]
    },
    { delivery_id: 'DLV-2026-0009', order_id: 'MEDIA-2026-0007', task_id: 'TASK-0004',
      project_name: 'Brochure Khóa AI Summer', task_type: 'design',
      requester_name: 'Trần Quốc Anh', requester_email: 'qa@cbcentres.com', department: 'CB Mekong',
      account_name: 'Mai Phương', production_pic: 'Duy',
      delivery_status: 'client_rev', priority: 'normal',
      preview_link: 'https://drive.google.com/preview-brochure-v1', final_link: '',
      delivery_date: '2026-05-08 16:00', delivery_channel: 'portal', delivered_to: 'qa@cbcentres.com', delivered_by: 'Mai Phương',
      client_approval_status: 'Revision Requested', satisfaction_score: null,
      client_feedback: 'Trang 2: học phí cần cập nhật con số mới. Trang 4: thêm phần FAQ tuyển sinh.',
      fb_categories: ['content'], delivery_note: '', closed_at: null, reopened_count: 1,
      checklist: { brief: true, content: true, size: true, brand: true, file: false, drive: true, version: true, note: false },
      requested_deadline: '2026-05-08', internal_deadline: '2026-05-06 17:00',
      created_at: '2026-05-08 15:00', updated_at: '2026-05-09 09:00',
      activity: [
        { time: '2026-05-08 15:00', user: 'Duy', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-08 16:00', user: 'Mai Phương', type: 'preview_sent', desc: 'Gửi preview v1' },
        { time: '2026-05-09 09:00', user: 'CB Mekong', type: 'client_feedback_received', desc: 'Client yêu cầu cập nhật học phí + FAQ' }
      ]
    },
    { delivery_id: 'DLV-2026-0010', order_id: 'MEDIA-2026-0016', task_id: 'TASK-0013',
      project_name: 'Facebook Ads Copy Tháng 5', task_type: 'ads',
      requester_name: 'Phạm Thị Lan', requester_email: 'lan.pham@cbcentres.com', department: 'Sales',
      account_name: 'Hậu', production_pic: 'Mai Phương',
      delivery_status: 'final', priority: 'urgent',
      preview_link: 'https://drive.google.com/preview-fb-copy', final_link: 'https://drive.google.com/final-fb-copy',
      delivery_date: '2026-05-12 11:00', delivery_channel: 'portal', delivered_to: 'lan.pham@cbcentres.com', delivered_by: 'Hậu',
      client_approval_status: 'Approved', satisfaction_score: null, client_feedback: '',
      fb_categories: [], delivery_note: 'Đã gửi 10 ad copy. Chờ rating từ client.', closed_at: null, reopened_count: 0,
      checklist: { brief: true, content: true, size: true, brand: true, file: true, drive: true, version: true, note: true },
      requested_deadline: '2026-05-01', internal_deadline: '2026-05-01 17:00',
      created_at: '2026-05-12 10:00', updated_at: '2026-05-12 11:00',
      activity: [
        { time: '2026-05-12 10:00', user: 'Mai Phương', type: 'delivery_created', desc: 'Task chuyển sang Delivery Log' },
        { time: '2026-05-12 10:45', user: 'Hậu', type: 'account_checked', desc: 'Checklist OK' },
        { time: '2026-05-12 11:00', user: 'Hậu', type: 'final_sent', desc: 'Gửi final qua Portal' }
      ]
    }
  ];

  /* ---------- State ---------- */
  const state = { search: '', status: '', account: '', pic: '', rating: '', quick: null };

  function applyFilters() {
    return DELIVERIES.filter((d) => {
      if (state.search) {
        const q = state.search.toLowerCase();
        const hay = [d.delivery_id, d.order_id, d.task_id, d.project_name, d.account_name, d.production_pic, d.requester_name, d.department, d.final_link, d.delivery_note, d.client_feedback].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (state.status && d.delivery_status !== state.status) return false;
      if (state.account && d.account_name !== state.account) return false;
      if (state.pic && d.production_pic !== state.pic) return false;
      if (state.rating === 'null' && d.satisfaction_score) return false;
      else if (state.rating && state.rating !== 'null' && d.satisfaction_score !== parseInt(state.rating, 10)) return false;
      if (state.quick) {
        switch (state.quick) {
          case 'waiting': if (d.delivery_status !== 'waiting') return false; break;
          case 'need_rev': if (d.delivery_status !== 'need_rev') return false; break;
          case 'ready': if (d.delivery_status !== 'ready') return false; break;
          case 'preview': if (d.delivery_status !== 'preview') return false; break;
          case 'client_wait': if (!['client_wait', 'client_rev'].includes(d.delivery_status)) return false; break;
          case 'final': if (d.delivery_status !== 'final') return false; break;
          case 'waiting_rating': if (!(d.delivery_status === 'final' && !d.satisfaction_score)) return false; break;
          case 'reopened': if (!(d.reopened_count > 0)) return false; break;
          case 'ready_for_delivery': if (!['waiting', 'ready'].includes(d.delivery_status)) return false; break;
          case 'rated': if (!d.satisfaction_score) return false; break;
        }
      }
      return true;
    });
  }

  /* ---------- Render ---------- */
  const tbody = document.getElementById('deliveries-tbody');
  function renderSummary() {
    document.getElementById('sm-waiting').textContent = DELIVERIES.filter((d) => d.delivery_status === 'waiting').length;
    document.getElementById('sm-needrev').textContent = DELIVERIES.filter((d) => d.delivery_status === 'need_rev').length;
    document.getElementById('sm-ready').textContent = DELIVERIES.filter((d) => d.delivery_status === 'ready').length;
    document.getElementById('sm-preview').textContent = DELIVERIES.filter((d) => d.delivery_status === 'preview').length;
    document.getElementById('sm-clientwait').textContent = DELIVERIES.filter((d) => ['client_wait', 'client_rev'].includes(d.delivery_status)).length;
    document.getElementById('sm-final').textContent = DELIVERIES.filter((d) => d.delivery_status === 'final').length;
    document.getElementById('sm-waitrating').textContent = DELIVERIES.filter((d) => d.delivery_status === 'final' && !d.satisfaction_score).length;
    document.getElementById('sm-reopened').textContent = DELIVERIES.filter((d) => d.reopened_count > 0).length;
    // Avg rating
    const rated = DELIVERIES.filter((d) => d.satisfaction_score);
    const avg = rated.length ? (rated.reduce((s, d) => s + d.satisfaction_score, 0) / rated.length).toFixed(1) : '—';
    document.getElementById('avg-rating').textContent = avg !== '—' ? `★ ${avg}` : '—';
    // Sidebar badge: waiting check + need_rev (urgent items needing Account action)
    const nb = document.getElementById('nav-waiting');
    if (nb) nb.textContent = DELIVERIES.filter((d) => ['waiting', 'need_rev'].includes(d.delivery_status)).length;
  }

  function renderTable() {
    const filtered = applyFilters();
    document.getElementById('tv-visible').textContent = filtered.length;
    document.getElementById('tv-total').textContent = DELIVERIES.length;
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12"><div class="empty-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <h3>Không có delivery phù hợp</h3>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map((d) => {
      const dl = parseDate(d.delivery_date);
      const dl_fmt = dl ? `${String(dl.getDate()).padStart(2,'0')}/${String(dl.getMonth()+1).padStart(2,'0')}` : '—';
      const upd = parseDate(d.updated_at);
      const upd_fmt = upd ? `${String(upd.getDate()).padStart(2,'0')}/${String(upd.getMonth()+1).padStart(2,'0')}` : '—';
      const flags = [];
      if (d.preview_link) flags.push('<span class="kc-flag has-preview">P</span>');
      if (d.final_link)   flags.push('<span class="kc-flag has-final">F</span>');
      const accInit = d.account_name ? d.account_name.substring(0, 2).toUpperCase() : '?';
      const picInit = d.production_pic ? d.production_pic.substring(0, 2).toUpperCase() : '?';
      const picAlt = d.production_pic && ['Hậu','Linh Chi','Vinh'].indexOf(d.production_pic) % 2 === 0 ? 'has-red' : '';
      return `
        <tr data-id="${d.delivery_id}">
          <td><span class="order-id">${d.delivery_id}</span>${d.reopened_count ? `<span class="badge badge-warning" style="margin-left:4px; padding:1px 6px; font-size:9px">↻ ${d.reopened_count}</span>` : ''}</td>
          <td><div style="display:flex; flex-direction:column; gap:2px"><span class="mono text-xs">${d.order_id}</span><span class="mono text-xs muted">${d.task_id}</span></div></td>
          <td class="project-cell"><b>${escapeHtml(d.project_name)}</b><span>${escapeHtml(d.requester_name)} · ${escapeHtml(d.department)}</span></td>
          <td><span class="text-xs">${TYPE_LABEL[d.task_type] || d.task_type}</span></td>
          <td><div class="pic-cell"><span class="pic-avatar">${accInit}</span><span class="pic-name">${escapeHtml(d.account_name)}</span></div></td>
          <td><div class="pic-cell ${picAlt}"><span class="pic-avatar">${picInit}</span><span class="pic-name">${escapeHtml(d.production_pic)}</span></div></td>
          <td><span class="tb-status s--${d.delivery_status}"><span class="dot"></span>${STATUS_LABEL[d.delivery_status]}</span></td>
          <td><span class="text-xs">${dl_fmt}</span>${d.delivery_channel ? `<span class="text-xs muted" style="display:block; font-size:10px">${CHANNEL_LABEL[d.delivery_channel] || d.delivery_channel}</span>` : ''}</td>
          <td><div class="kc-flags">${flags.join('') || '<span class="text-xs muted">—</span>'}</div></td>
          <td>${stars(d.satisfaction_score)}</td>
          <td><span class="mono text-xs muted">${upd_fmt}</span></td>
          <td><button class="icon-btn" data-action="view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg></button></td>
        </tr>
      `;
    }).join('');
  }

  function render() { renderSummary(); renderTable(); }

  /* ---------- Toolbar ---------- */
  let st; document.getElementById('search-input').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 180); });
  ['filter-status', 'filter-account', 'filter-pic', 'filter-rating'].forEach((id) => {
    const key = id.replace('filter-', '');
    document.getElementById(id).addEventListener('change', (e) => { state[key] = e.target.value; render(); });
  });
  document.querySelectorAll('.pb-stat').forEach((card) => {
    card.addEventListener('click', () => {
      const q = card.getAttribute('data-quick');
      if (state.quick === q) state.quick = null; else state.quick = q;
      document.querySelectorAll('.pb-stat').forEach((c) => c.classList.remove('is-active'));
      if (state.quick) card.classList.add('is-active');
      render();
    });
  });
  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const d = DELIVERIES.find((x) => x.delivery_id === row.getAttribute('data-id'));
    if (d) openDrawer(d);
  });

  /* ---------- Drawer ---------- */
  const drawer = document.getElementById('delivery-drawer');
  const drawerBd = document.getElementById('drawer-backdrop');
  const drawerBody = document.getElementById('drawer-body');
  let cur = null;

  function buildChecklist(d) {
    const items = [
      { key: 'brief',   label: 'Đã kiểm tra đúng nội dung brief' },
      { key: 'content', label: 'Đã kiểm tra chính tả / thông tin chương trình' },
      { key: 'size',    label: 'Đã kiểm tra đúng kích thước / tỉ lệ' },
      { key: 'brand',   label: 'Đã kiểm tra đúng brand CB' },
      { key: 'file',    label: 'Đã kiểm tra đúng file final' },
      { key: 'drive',   label: 'Đã kiểm tra quyền truy cập link Drive' },
      { key: 'version', label: 'Đã kiểm tra đúng version file' },
      { key: 'note',    label: 'Đã ghi chú nếu có thay đổi so với brief' }
    ];
    const done = items.filter((i) => d.checklist[i.key]).length;
    return { html: items.map((i) => `
      <label class="pre-checklist-item">
        <input type="checkbox" data-ck="${i.key}" ${d.checklist[i.key] ? 'checked' : ''} />
        <span class="ck-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <span>${i.label}</span>
      </label>
    `).join(''), done, total: items.length };
  }

  function openDrawer(d) {
    cur = d;
    document.getElementById('d-delivery-id').textContent = d.delivery_id;
    document.getElementById('d-order-task').textContent = `${d.order_id} · ${d.task_id}`;
    document.getElementById('d-project').textContent = d.project_name;
    const ds = document.getElementById('d-status');
    ds.className = 'tb-status s--' + d.delivery_status;
    ds.innerHTML = '<span class="dot"></span>' + STATUS_LABEL[d.delivery_status];
    document.getElementById('d-rating-head').innerHTML = d.satisfaction_score ? stars(d.satisfaction_score) : '';
    document.getElementById('d-channel').textContent = d.delivery_channel ? '· qua ' + (CHANNEL_LABEL[d.delivery_channel] || d.delivery_channel) : '';
    document.getElementById('d-copy').setAttribute('data-copy', d.delivery_id);

    const v = (x) => x ? escapeHtml(x) : '<em class="muted">—</em>';
    const link = (u) => u ? `<a class="link" href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(u)}</a>` : '<em class="muted">Chưa có</em>';
    const ck = buildChecklist(d);
    const ckComplete = ck.done === ck.total;
    const canSendFinal = ckComplete && (d.final_link || d.preview_link) && !['completed', 'cancelled'].includes(d.delivery_status);
    const canSendPreview = d.preview_link && ['waiting', 'ready'].includes(d.delivery_status);
    const canRequestRev = ['waiting', 'preview', 'client_rev'].includes(d.delivery_status);
    const canRate = d.delivery_status === 'final' && !d.satisfaction_score;
    const canClose = ['rated', 'final'].includes(d.delivery_status) && !d.closed_at;
    const canReopen = d.delivery_status === 'completed';

    drawerBody.innerHTML = `
      <!-- Block A: Order & Task Summary -->
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">A</span><h4>Order &amp; Task Summary</h4></div>
        <dl>
          <dt>Order ID</dt><dd><a class="link" href="database-orders.html">${d.order_id}</a></dd>
          <dt>Task ID</dt><dd><a class="link" href="production-board.html">${d.task_id}</a></dd>
          <dt>Project</dt><dd>${v(d.project_name)}</dd>
          <dt>Requester</dt><dd>${v(d.requester_name)} · ${v(d.requester_email)}</dd>
          <dt>Department</dt><dd>${v(d.department)}</dd>
          <dt>Type</dt><dd>${v(TYPE_LABEL[d.task_type])}</dd>
          <dt>Priority</dt><dd><span class="priority-pill p--${d.priority}"><span class="dot"></span>${d.priority === 'critical' ? 'Rất gấp' : d.priority === 'urgent' ? 'Gấp' : 'Bình thường'}</span></dd>
          <dt>Requested Deadline</dt><dd>${v(d.requested_deadline)}</dd>
          <dt>Internal Deadline</dt><dd>${v(d.internal_deadline)}</dd>
          <dt>Account</dt><dd>${v(d.account_name)}</dd>
          <dt>P.I.C</dt><dd>${v(d.production_pic)}</dd>
        </dl>
      </section>

      <!-- Block B: File & Link -->
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">B</span><h4>Files &amp; Links</h4></div>
        <div class="link-row ${d.preview_link ? 'has-link' : ''}">
          <span class="l-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
          <div class="l-info"><b>Preview Link</b><span>${d.preview_link ? `<a href="${escapeHtml(d.preview_link)}" target="_blank" class="link">${escapeHtml(d.preview_link)}</a>` : 'Chưa có'}</span></div>
          ${d.preview_link ? `<button class="btn btn-ghost btn-sm" data-copy="${escapeHtml(d.preview_link)}"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>` : ''}
        </div>
        <div class="link-row ${d.final_link ? 'has-link' : ''}">
          <span class="l-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <div class="l-info"><b>Final Link</b><span>${d.final_link ? `<a href="${escapeHtml(d.final_link)}" target="_blank" class="link">${escapeHtml(d.final_link)}</a>` : 'Chưa có'}</span></div>
          ${d.final_link ? `<button class="btn btn-ghost btn-sm" data-copy="${escapeHtml(d.final_link)}"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>` : ''}
        </div>
      </section>

      <!-- Block C: Delivery Control -->
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">C</span><h4>Delivery Control</h4></div>
        <dl>
          <dt>Delivery Status</dt><dd><span class="tb-status s--${d.delivery_status}"><span class="dot"></span>${STATUS_LABEL[d.delivery_status]}</span></dd>
          <dt>Delivery Date</dt><dd>${v(d.delivery_date)}</dd>
          <dt>Channel</dt><dd>${d.delivery_channel ? CHANNEL_LABEL[d.delivery_channel] || d.delivery_channel : '<em class="muted">—</em>'}</dd>
          <dt>Delivered to</dt><dd>${v(d.delivered_to)}</dd>
          <dt>Delivered by</dt><dd>${v(d.delivered_by)}</dd>
          <dt>Client Approval</dt><dd><b>${v(d.client_approval_status)}</b></dd>
          <dt>Delivery Note</dt><dd>${v(d.delivery_note)}</dd>
          ${d.reopened_count ? `<dt>Reopened</dt><dd><span class="badge badge-warning"><span class="dot"></span>${d.reopened_count} lần</span></dd>` : ''}
        </dl>

        <div class="status-actions" style="margin-top: var(--space-3)">
          <button class="status-action-btn" data-act="check"><span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span><span class="sa-text"><b>Kiểm tra file</b><span>Tick checklist trước khi gửi</span></span></button>
          <button class="status-action-btn sa--warn" data-act="request_rev" ${canRequestRev ? '' : 'disabled'}><span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span><span class="sa-text"><b>Yêu cầu chỉnh sửa nội bộ</b><span>Trả về Production</span></span></button>
          <button class="status-action-btn" data-act="send_preview" ${canSendPreview ? '' : 'disabled'}><span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span><span class="sa-text"><b>Gửi Preview</b><span>Gửi cho client xem trước</span></span></button>
          <button class="status-action-btn sa--success" data-act="send_final" ${canSendFinal ? '' : 'disabled'}><span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span><span class="sa-text"><b>Gửi Final</b><span>${canSendFinal ? 'Bàn giao chính thức' : (ckComplete ? 'Chưa có link' : 'Cần hoàn tất checklist')}</span></span></button>
          <button class="status-action-btn sa--success" data-act="rate" ${canRate ? '' : 'disabled'}><span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span><span class="sa-text"><b>Ghi nhận rating</b><span>Nhập đánh giá client</span></span></button>
          ${canClose ? `<button class="status-action-btn sa--success" data-act="close"><span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><circle cx="12" cy="16" r="1"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><span class="sa-text"><b>Đóng delivery</b><span>Hoàn tất bàn giao</span></span></button>` : ''}
          ${canReopen ? `<button class="status-action-btn sa--warn" data-act="reopen"><span class="sa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></span><span class="sa-text"><b>Mở lại delivery</b><span>Client yêu cầu chỉnh sửa lại</span></span></button>` : ''}
        </div>
      </section>

      <!-- Block D: Feedback & Rating -->
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">D</span><h4>Feedback &amp; Rating</h4></div>
        <dl>
          <dt>Satisfaction</dt><dd>${stars(d.satisfaction_score)}</dd>
          <dt>Client Feedback</dt><dd>${v(d.client_feedback)}</dd>
          <dt>Categories</dt><dd>${d.fb_categories && d.fb_categories.length ? `<div class="fb-categories">${d.fb_categories.map((k) => { const c = FB_CATEGORIES.find((x) => x.key === k); return c ? `<span class="fb-cat ${c.cls}">${c.label}</span>` : ''; }).join('')}</div>` : '<em class="muted">—</em>'}</dd>
        </dl>
      </section>

      <!-- Block E: Pre-delivery Checklist -->
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">E</span><h4>Pre-delivery Checklist</h4></div>
        <div class="checklist-progress ${ckComplete ? 'is-complete' : ''}">
          <span>${ckComplete ? '✓ Checklist hoàn tất' : 'Tiến độ checklist'}</span>
          <b>${ck.done}/${ck.total}</b>
        </div>
        <div class="pre-checklist">${ck.html}</div>
      </section>

      <!-- Block F: Activity Log -->
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">F</span><h4>Activity Log (${d.activity.length})</h4></div>
        <ul class="activity-mini">
          ${[...d.activity].reverse().map((a) => `<li><span><b>${escapeHtml(a.user)}</b> · ${escapeHtml(a.desc)}</span><time>${a.time}</time></li>`).join('')}
        </ul>
      </section>
    `;

    // Wire checklist
    drawerBody.querySelectorAll('input[data-ck]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const key = inp.getAttribute('data-ck');
        cur.checklist[key] = inp.checked;
        cur.updated_at = fmtDT();
        cur.activity.push({ time: cur.updated_at, user: user.name, type: 'checklist_updated', desc: `Checklist "${key}" → ${inp.checked ? 'OK' : 'Chưa'}` });
        // Re-render this drawer + table
        render();
        openDrawer(cur);
      });
    });
    // Wire status actions
    drawerBody.querySelectorAll('.status-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        handleAction(btn.getAttribute('data-act'));
      });
    });

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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (modal.classList.contains('is-open')) closeModal(); else if (drawer.classList.contains('is-open')) closeDrawer(); } });

  /* ---------- Action modal ---------- */
  const modal = document.getElementById('action-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalSubmit = document.getElementById('modal-submit');
  function openModal(title, bodyHtml, onSubmit) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modalSubmit.onclick = onSubmit;
  }
  function closeModal() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  /* ---------- Action handlers ---------- */
  function logActivity(type, desc) {
    cur.activity.push({ time: fmtDT(), user: user.name, type, desc });
    cur.updated_at = fmtDT();
  }

  function handleAction(act) {
    switch (act) {
      case 'check': {
        const ck = Object.values(cur.checklist).filter(Boolean).length;
        cur.delivery_status = ck === 8 ? 'ready' : cur.delivery_status;
        if (ck === 8) logActivity('account_checked', 'Checklist hoàn tất — chuyển sang Sẵn sàng bàn giao');
        window.MH.toast({ type: ck === 8 ? 'success' : 'info', title: ck === 8 ? '✓ Sẵn sàng bàn giao' : 'Checklist', message: `${ck}/8 mục đã tick` });
        render(); openDrawer(cur);
        break;
      }

      case 'request_rev':
        openModal('Yêu cầu chỉnh sửa nội bộ', `
          <p class="text-sm muted" style="margin-bottom:var(--space-3)">Comment sẽ gửi về P.I.C <b>${escapeHtml(cur.production_pic)}</b>. Task sẽ quay lại Production Board với status "Chỉnh sửa nội bộ".</p>
          <div class="field"><label class="label">Nội dung chỉnh sửa <span class="req">*</span></label><textarea class="textarea" id="rev-comment" placeholder="Mô tả cụ thể những điểm cần chỉnh..."></textarea></div>
        `, () => {
          const text = document.getElementById('rev-comment').value.trim();
          if (!text) { window.MH.toast({ type: 'error', message: 'Vui lòng nhập nội dung.' }); return; }
          cur.delivery_status = 'need_rev';
          cur.delivery_note = text;
          logActivity('internal_revision_requested', 'Yêu cầu chỉnh sửa: ' + text);
          window.MH.toast({ type: 'success', title: 'Đã yêu cầu chỉnh sửa', message: 'Task quay lại Production Board cho ' + cur.production_pic });
          closeModal(); render(); openDrawer(cur);
        });
        break;

      case 'send_preview':
        openModal('Gửi Preview cho client', `
          <div class="field"><label class="label">Preview Link</label><input class="input" id="prev-link" type="url" value="${escapeHtml(cur.preview_link)}" /></div>
          <div class="field mt-4"><label class="label">Channel</label>
            <div class="channel-chips" id="prev-channels">
              ${['portal','email','zalo','drive','dm'].map((c, i) => `<label class="channel-chip"><input type="radio" name="prev-channel" value="${c}" ${i === 0 ? 'checked' : ''}> ${CHANNEL_LABEL[c]}</label>`).join('')}
            </div>
          </div>
          <div class="field mt-4"><label class="label">Tin nhắn kèm theo</label><textarea class="textarea" id="prev-msg" placeholder="Vui lòng kiểm tra preview và phản hồi trong 2 ngày làm việc.">Vui lòng kiểm tra bản preview và phản hồi nếu cần chỉnh sửa.</textarea></div>
        `, () => {
          const link = document.getElementById('prev-link').value.trim();
          const channel = document.querySelector('input[name="prev-channel"]:checked').value;
          if (!link) { window.MH.toast({ type: 'error', message: 'Cần Preview Link.' }); return; }
          cur.preview_link = link;
          cur.delivery_status = 'client_wait';
          cur.delivery_channel = channel;
          cur.delivery_date = fmtDT();
          cur.delivered_by = user.name;
          cur.delivered_to = cur.requester_email;
          logActivity('preview_sent', `Gửi preview qua ${CHANNEL_LABEL[channel]}`);
          window.MH.toast({ type: 'success', title: 'Đã gửi Preview', message: cur.delivery_id });
          closeModal(); render(); openDrawer(cur);
        });
        break;

      case 'send_final':
        openModal('Gửi Final cho client', `
          <div class="field"><label class="label">Final Link <span class="req">*</span></label><input class="input" id="final-link" type="url" value="${escapeHtml(cur.final_link)}" placeholder="https://drive.google.com/final..." /></div>
          <div class="field mt-4"><label class="label">Channel</label>
            <div class="channel-chips" id="final-channels">
              ${['portal','email','zalo','drive'].map((c, i) => `<label class="channel-chip"><input type="radio" name="final-channel" value="${c}" ${i === 0 ? 'checked' : ''}> ${CHANNEL_LABEL[c]}</label>`).join('')}
            </div>
          </div>
          <div class="field mt-4"><label class="label">Gửi tới (email)</label><input class="input" id="final-to" type="email" value="${escapeHtml(cur.requester_email)}" /></div>
          <div class="field mt-4"><label class="label">Ghi chú bàn giao</label><textarea class="textarea" id="final-note" placeholder="Tùy chọn..."></textarea></div>
        `, () => {
          const link = document.getElementById('final-link').value.trim();
          if (!link) { window.MH.toast({ type: 'error', message: 'Final Link bắt buộc.' }); return; }
          cur.final_link = link;
          cur.delivery_channel = document.querySelector('input[name="final-channel"]:checked').value;
          cur.delivered_to = document.getElementById('final-to').value.trim();
          cur.delivery_note = document.getElementById('final-note').value.trim();
          cur.delivery_status = 'final';
          cur.delivery_date = fmtDT();
          cur.delivered_by = user.name;
          cur.client_approval_status = 'Approved';
          logActivity('final_sent', `Gửi final qua ${CHANNEL_LABEL[cur.delivery_channel]}`);
          window.MH.toast({ type: 'success', title: '✓ Đã gửi Final', message: cur.delivery_id });
          closeModal(); render(); openDrawer(cur);
        });
        break;

      case 'rate':
        openModal('Ghi nhận rating từ client', `
          <p class="text-sm muted" style="margin-bottom:var(--space-3)">Mức độ hài lòng từ client cho delivery ${cur.delivery_id}.</p>
          <div class="field"><label class="label">Rating <span class="req">*</span></label>
            <div class="star-input" id="rate-stars">
              ${[1,2,3,4,5].map((n) => `<span class="star" data-n="${n}">★</span>`).join('')}
            </div>
            <span class="helper" id="rate-helper">Click để chọn (1 — 5)</span>
          </div>
          <div class="field mt-4"><label class="label">Feedback từ client</label><textarea class="textarea" id="rate-feedback" placeholder="Nội dung feedback..."></textarea></div>
          <div class="field mt-4"><label class="label">Categories</label>
            <div class="channel-chips" id="rate-cats">
              ${FB_CATEGORIES.map((c) => `<label class="channel-chip"><input type="checkbox" value="${c.key}"> ${c.label}</label>`).join('')}
            </div>
          </div>
        `, () => {
          const score = parseInt(document.getElementById('rate-stars').getAttribute('data-score') || '0', 10);
          if (!score) { window.MH.toast({ type: 'error', message: 'Vui lòng chọn rating.' }); return; }
          cur.satisfaction_score = score;
          cur.client_feedback = document.getElementById('rate-feedback').value.trim();
          cur.fb_categories = [...document.querySelectorAll('#rate-cats input:checked')].map((i) => i.value);
          cur.delivery_status = 'rated';
          logActivity('rating_submitted', `Client rating ${score}/5${cur.client_feedback ? ' · "' + cur.client_feedback + '"' : ''}`);
          window.MH.toast({ type: 'success', title: `★ Rating ${score}/5 ghi nhận`, message: cur.delivery_id });
          closeModal(); render(); openDrawer(cur);
        });
        // Wire star input
        setTimeout(() => {
          const stars = document.querySelectorAll('#rate-stars .star');
          let score = 0;
          stars.forEach((s) => {
            s.addEventListener('mouseenter', () => { const n = parseInt(s.dataset.n, 10); stars.forEach((x, i) => x.classList.toggle('is-hover', i < n)); });
            s.addEventListener('mouseleave', () => { stars.forEach((x) => x.classList.remove('is-hover')); });
            s.addEventListener('click', () => { score = parseInt(s.dataset.n, 10); document.getElementById('rate-stars').setAttribute('data-score', score); stars.forEach((x, i) => x.classList.toggle('is-active', i < score)); document.getElementById('rate-helper').textContent = `${score}/5 — ${['Rất không hài lòng','Không hài lòng','Bình thường','Hài lòng','Rất hài lòng'][score-1]}`; });
          });
        }, 50);
        break;

      case 'close':
        cur.delivery_status = 'completed';
        cur.closed_at = fmtDT();
        logActivity('delivery_completed', 'Đóng delivery — hoàn tất');
        window.MH.toast({ type: 'success', title: '✓ Đã đóng delivery', message: cur.delivery_id });
        render(); openDrawer(cur);
        break;

      case 'reopen':
        openModal('Mở lại delivery', `
          <p class="text-sm muted" style="margin-bottom:var(--space-3)">Mở lại sẽ tăng counter "Reopened" và quay lại Production Board.</p>
          <div class="field"><label class="label">Lý do mở lại <span class="req">*</span></label><textarea class="textarea" id="reopen-reason" placeholder="VD: Client phát hiện lỗi sau khi đã bàn giao..."></textarea></div>
        `, () => {
          const reason = document.getElementById('reopen-reason').value.trim();
          if (!reason) { window.MH.toast({ type: 'error', message: 'Cần lý do.' }); return; }
          cur.delivery_status = 'reopened';
          cur.reopened_count = (cur.reopened_count || 0) + 1;
          cur.closed_at = null;
          logActivity('delivery_reopened', 'Mở lại: ' + reason);
          window.MH.toast({ type: 'warning', title: '↻ Đã mở lại delivery', message: cur.delivery_id });
          closeModal(); render(); openDrawer(cur);
        });
        break;
    }
  }

  /* ---------- Drilldown from Master Dashboard ---------- */
  const DRILLDOWN_MAP = {
    ready_for_delivery: { quick: 'ready_for_delivery', label: 'Ready for Delivery', desc: 'Delivery chờ Account kiểm tra hoặc sẵn sàng bàn giao.' },
    average_rating:     { quick: 'rated',              label: 'Average Rating',    desc: 'Delivery đã có rating — xếp theo rating thấp trước.' },
    rating_coverage:    { quick: 'waiting_rating',     label: 'Rating Coverage',   desc: 'Delivery đã gửi final nhưng chưa có rating.' }
  };
  function applyDrilldownFromURL() {
    const params = new URLSearchParams(location.search);
    const key = params.get('dl');
    if (!key || !DRILLDOWN_MAP[key]) return null;
    const cfg = DRILLDOWN_MAP[key];
    state.quick = cfg.quick;
    const card = document.querySelector('.pb-stat[data-quick="' + cfg.quick + '"]');
    document.querySelectorAll('.pb-stat').forEach((c) => c.classList.remove('is-active'));
    if (card) card.classList.add('is-active');
    return cfg;
  }
  function clearDrilldown() {
    state.quick = null;
    document.querySelectorAll('.pb-stat').forEach((c) => c.classList.remove('is-active'));
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

  /* ---------- Init ---------- */
  render();
  if (drilldownCfg) {
    injectDrilldownBanner(drilldownCfg);
    document.querySelector('.table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
