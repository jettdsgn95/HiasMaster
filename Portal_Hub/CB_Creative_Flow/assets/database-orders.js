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
  // Only admin / account can see Database Orders
  if (!['admin', 'account'].includes(user.role)) {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Database Orders chỉ dành cho Admin/Account.' });
    setTimeout(() => location.replace('dashboard.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

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
    design: 'Design / POSM', digital: 'Digital Design', video: 'Video', motion: 'Motion',
    shoot: 'Quay', photo: 'Chụp ảnh', ads: 'Ads / Post', slide: 'Slide / Proposal', other: 'Khác'
  };
  const PRIORITY_LABEL = { normal: 'Bình thường', urgent: 'Gấp', critical: 'Rất gấp' };

  // 18 mock orders với nhiều status khác nhau
  const ORDERS = [
    { order_id: 'MEDIA-2026-0001', created_at: '2026-05-12 09:24', requester_name: 'Trần Quốc Anh', requester_email: 'qa@cbcentres.com', requester_contact: '0901234567', department: 'CB Mekong',
      project_name: 'Summer Campaign 2026', project_purpose: 'Thiết kế POSM cho chương trình tuyển sinh hè 2026 trên toàn hệ thống chi nhánh.',
      request_type: 'design', deliverable_type: ['Backdrop', 'Standee', 'Social Post'], target_audience: ['Phụ huynh', 'Học viên ngoài CB'], usage_channels: ['Facebook', 'In ấn', 'Sự kiện'],
      size_ratio: 'Standee 80×180cm + Backdrop 4×3m', content_brief: 'Tone trẻ trung, dynamic. Key message: "Mùa hè rực rỡ tại CB."', creative_direction: 'Theo brand CB, dùng màu navy + red đặc trưng.',
      wording_required: false, source_link: 'https://drive.google.com/...', file_brief_url: 'brief-summer-2026.pdf',
      priority: 'urgent', requested_deadline: '2026-05-25', actual_use_date: '2026-06-01',
      account_status: 'pending', account_pic: null, production_pic: null, production_status: 'unassigned', delivery_status: null,
      internal_deadline: null, progress: 5, last_updated: '2026-05-12 09:24', content_responsibility_confirmed: true
    },
    { order_id: 'MEDIA-2026-0002', created_at: '2026-05-12 10:15', requester_name: 'Nguyễn Thu Hà', requester_email: 'ha.nguyen@cbcentres.com', requester_contact: '0907654321', department: 'Academic',
      project_name: 'Video Recap Lễ Tốt nghiệp Q2', project_purpose: 'Quay và dựng video recap lễ tốt nghiệp khóa 2025–2026, dùng đăng web + social.',
      request_type: 'video', deliverable_type: ['Recap Video', 'Reel/TikTok 9:16'], target_audience: ['Học viên CB', 'Phụ huynh'], usage_channels: ['Facebook', 'TikTok / Reels', 'Website'],
      size_ratio: '16:9 + 9:16', content_brief: 'Recap 2 phút highlight các khoảnh khắc nhận bằng + phỏng vấn ngắn.', creative_direction: 'Cảm xúc, ấm áp, kết hợp footage có sẵn.',
      wording_required: true, source_link: 'https://drive.google.com/footage-graduation',
      priority: 'normal', requested_deadline: '2026-05-30',
      account_status: 'checking', account_pic: 'Hậu', production_pic: null, production_status: 'unassigned',
      internal_deadline: null, progress: 10, last_updated: '2026-05-12 14:30'
    },
    { order_id: 'MEDIA-2026-0003', created_at: '2026-05-11 16:22', requester_name: 'Lê Văn Minh', requester_email: 'minh.le@cbcentres.com', requester_contact: '0913456789', department: 'CB Hưng Phú',
      project_name: 'Banner Web Mainpage Tháng 5', project_purpose: 'Banner web cho landing page chương trình ưu đãi tháng 5.',
      request_type: 'digital', deliverable_type: ['Website Banner', 'Cover Facebook'], target_audience: ['Học viên ngoài CB'], usage_channels: ['Website', 'Facebook'],
      size_ratio: '1920×600 + 1640×624', content_brief: 'Ưu đãi 30% học phí khóa Summer.', creative_direction: 'Sạch, mạnh CTA, brand CB.',
      wording_required: false,
      priority: 'urgent', requested_deadline: '2026-05-15',
      account_status: 'needinfo', account_pic: 'Hậu', production_pic: null, production_status: 'unassigned',
      internal_deadline: null, progress: 8, last_updated: '2026-05-12 09:00', internal_note: 'Thiếu hình sản phẩm và chính sách giảm giá chi tiết.'
    },
    { order_id: 'MEDIA-2026-0004', created_at: '2026-05-10 11:08', requester_name: 'Phạm Thị Lan', requester_email: 'lan.pham@cbcentres.com', requester_contact: '0908111222', department: 'Sales',
      project_name: 'Bộ Key Visual Sự kiện Q3', project_purpose: 'Bộ KV cho sự kiện ra mắt khóa Q3, sử dụng đa kênh.',
      request_type: 'design', deliverable_type: ['Backdrop', 'Standee', 'Poster', 'Social Post', 'Banner'], target_audience: ['Phụ huynh', 'Học viên CB'], usage_channels: ['Facebook', 'In ấn', 'Sự kiện', 'LCD / TV nội bộ'],
      size_ratio: 'Đa kích cỡ', content_brief: 'Sự kiện công bố lộ trình học mới Q3. Tone chuyên nghiệp, hiện đại.', creative_direction: 'Theo brand CB, có thể dùng gradient navy → red.',
      wording_required: true,
      priority: 'urgent', requested_deadline: '2026-05-22', actual_use_date: '2026-05-28',
      account_status: 'confirmed', account_pic: 'Mai Phương', production_pic: 'Duy', production_status: 'inprogress',
      internal_deadline: '2026-05-20 17:00', progress: 50, last_updated: '2026-05-12 11:42'
    },
    { order_id: 'MEDIA-2026-0005', created_at: '2026-05-09 14:05', requester_name: 'Đỗ Quang Hùng', requester_email: 'hung.do@cbcentres.com', requester_contact: '0905112233', department: 'CB Cần Thơ',
      project_name: 'Photoshoot Cơ sở Mới', project_purpose: 'Chụp ảnh cơ sở mới khai trương tại Cần Thơ.',
      request_type: 'photo', deliverable_type: ['Chụp cơ sở', 'Chụp sự kiện'], target_audience: ['Phụ huynh', 'Học viên ngoài CB'], usage_channels: ['Website', 'Facebook'],
      content_brief: 'Chụp tổng quan cơ sở + chi tiết phòng học. ~50–80 ảnh.', creative_direction: 'Tự nhiên, sáng, có người trải nghiệm không gian.',
      wording_required: false,
      priority: 'normal', requested_deadline: '2026-05-18',
      account_status: 'confirmed', account_pic: 'Đức Anh', production_pic: 'Linh Chi', production_status: 'review',
      internal_deadline: '2026-05-15 17:00', progress: 65, last_updated: '2026-05-12 08:15'
    },
    { order_id: 'MEDIA-2026-0006', created_at: '2026-05-08 17:30', requester_name: 'Vũ Hoàng Mai', requester_email: 'mai.vu@cbcentres.com', requester_contact: '0903778899', department: 'HO Marketing',
      project_name: 'Reel TikTok Tháng 5', project_purpose: 'Loạt 4 reel ngắn TikTok cho tháng 5.',
      request_type: 'video', deliverable_type: ['Reel/TikTok 9:16'], target_audience: ['Học viên ngoài CB'], usage_channels: ['TikTok / Reels'],
      size_ratio: '9:16', content_brief: '4 reel × 30s. Highlight các tip học hiệu quả.', creative_direction: 'Trending, fast cut, dùng caption motion.',
      wording_required: false, source_link: 'https://drive.google.com/footage-may',
      priority: 'critical', requested_deadline: '2026-05-13', urgent_reason: 'Campaign cần launch trước 13/5.',
      account_status: 'confirmed', account_pic: 'Hậu', production_pic: 'Vinh', production_status: 'review',
      internal_deadline: '2026-05-12 17:00', progress: 90, last_updated: '2026-05-12 16:45'
    },
    { order_id: 'MEDIA-2026-0007', created_at: '2026-05-07 09:12', requester_name: 'Trần Quốc Anh', requester_email: 'qa@cbcentres.com', requester_contact: '0901234567', department: 'CB Mekong',
      project_name: 'Brochure Khóa AI Summer', project_purpose: 'Brochure khóa AI hè 4 trang gấp.',
      request_type: 'design', deliverable_type: ['Brochure'], target_audience: ['Phụ huynh'], usage_channels: ['In ấn'],
      size_ratio: 'A4 gấp 3', content_brief: 'Giới thiệu khóa, lộ trình, học phí, FAQ.', creative_direction: 'Trang trọng, dễ đọc, infographic.',
      wording_required: true,
      priority: 'normal', requested_deadline: '2026-05-08',
      account_status: 'confirmed', account_pic: 'Mai Phương', production_pic: 'Duy', production_status: 'inprogress',
      internal_deadline: '2026-05-06 17:00', progress: 50, last_updated: '2026-05-10 14:30'
    },
    { order_id: 'MEDIA-2026-0008', created_at: '2026-05-06 13:44', requester_name: 'Nguyễn Hữu Tài', requester_email: 'tai.nguyen@cbcentres.com', requester_contact: '0902441122', department: 'CB Tiên Thủy',
      project_name: 'Logo Motion Sản phẩm Mới', project_purpose: 'Motion logo cho ra mắt sản phẩm mới.',
      request_type: 'motion', deliverable_type: ['Motion Graphic', 'Intro/Outro'], target_audience: ['Học viên CB', 'Học viên ngoài CB'], usage_channels: ['Website', 'Facebook', 'TikTok / Reels'],
      size_ratio: '16:9 + 9:16', content_brief: '3 phiên bản: 5s, 10s, 15s.', creative_direction: 'Modern, dynamic, theo brand CB.',
      wording_required: false,
      priority: 'normal', requested_deadline: '2026-05-20',
      account_status: 'confirmed', account_pic: 'Đức Anh', production_pic: 'Linh Chi', production_status: 'inprogress',
      internal_deadline: '2026-05-18 17:00', progress: 50, last_updated: '2026-05-11 16:20'
    },
    { order_id: 'MEDIA-2026-0009', created_at: '2026-05-05 08:50', requester_name: 'Lê Thị Hoa', requester_email: 'hoa.le@cbcentres.com', requester_contact: '0904553311', department: 'Academic',
      project_name: 'Slide Proposal Đối tác Trường', project_purpose: 'Slide pitch deck giới thiệu chương trình liên kết.',
      request_type: 'slide', deliverable_type: ['Slide/Proposal'], target_audience: ['Trường học / Đơn vị liên kết'], usage_channels: ['Email', 'Sự kiện'],
      size_ratio: '16:9 — 20 slide', content_brief: 'Giới thiệu CB, chương trình, lộ trình, lợi ích đối tác, case study.', creative_direction: 'Chuyên nghiệp, sạch, infographic-driven.',
      wording_required: true,
      priority: 'normal', requested_deadline: '2026-05-14',
      account_status: 'confirmed', account_pic: 'Mai Phương', production_pic: 'Duy', production_status: 'ready',
      internal_deadline: '2026-05-13 17:00', progress: 90, last_updated: '2026-05-12 10:00'
    },
    { order_id: 'MEDIA-2026-0010', created_at: '2026-05-04 15:18', requester_name: 'Phạm Thanh Hà', requester_email: 'ha.pham@cbcentres.com', requester_contact: '0906998877', department: 'CB Mekong',
      project_name: 'Bộ Poster Tuyển dụng', project_purpose: 'Poster tuyển dụng giáo viên + nhân viên Q3.',
      request_type: 'design', deliverable_type: ['Poster', 'Social Post'], target_audience: ['Giáo viên / Nhân sự nội bộ'], usage_channels: ['Facebook', 'In ấn', 'Trường học/Chi nhánh'],
      size_ratio: 'A3 + 1:1', content_brief: '5 vị trí khác nhau, mỗi vị trí 1 poster.', creative_direction: 'Warm, welcoming, brand CB.',
      wording_required: false,
      priority: 'normal', requested_deadline: '2026-05-09',
      account_status: 'confirmed', account_pic: 'Hậu', production_pic: 'Vinh', production_status: 'delivered', delivery_status: 'delivered',
      internal_deadline: '2026-05-08 17:00', progress: 95, last_updated: '2026-05-09 11:30', satisfaction_score: 5,
      final_delivery_link: 'https://drive.google.com/final-posters'
    },
    { order_id: 'MEDIA-2026-0011', created_at: '2026-05-03 09:00', requester_name: 'Đỗ Quang Hùng', requester_email: 'hung.do@cbcentres.com', requester_contact: '0905112233', department: 'CB Cần Thơ',
      project_name: 'TVC Sản phẩm Hè 30s', project_purpose: 'TVC 30s giới thiệu sản phẩm hè.',
      request_type: 'video', deliverable_type: ['TVC/Commercial'], target_audience: ['Phụ huynh', 'Học viên ngoài CB'], usage_channels: ['Facebook', 'TikTok / Reels', 'LCD / TV nội bộ'],
      size_ratio: '16:9 + 9:16', content_brief: 'TVC 30s + cutdown 15s.', creative_direction: 'Storytelling, có voice-over.',
      wording_required: true, source_link: 'https://drive.google.com/footage-summer',
      priority: 'urgent', requested_deadline: '2026-05-10',
      account_status: 'confirmed', account_pic: 'Mai Phương', production_pic: 'Vinh', production_status: 'inprogress',
      internal_deadline: '2026-05-08 17:00', progress: 50, last_updated: '2026-05-11 18:00'
    },
    { order_id: 'MEDIA-2026-0012', created_at: '2026-05-02 14:25', requester_name: 'Vũ Hoàng Mai', requester_email: 'mai.vu@cbcentres.com', requester_contact: '0903778899', department: 'HO Marketing',
      project_name: 'Email Template Newsletter Q2', project_purpose: 'Email template cho newsletter định kỳ Q2.',
      request_type: 'digital', deliverable_type: ['Email Template'], target_audience: ['Học viên CB', 'Phụ huynh'], usage_channels: ['Email'],
      size_ratio: '600px width responsive', content_brief: 'Layout 3 block: highlight, content, CTA.', creative_direction: 'Clean, brand CB, dùng được trên dark/light client.',
      wording_required: false,
      priority: 'normal', requested_deadline: '2026-05-12',
      account_status: 'confirmed', account_pic: 'Hậu', production_pic: 'Duy', production_status: 'completed', delivery_status: 'completed',
      internal_deadline: '2026-05-11 17:00', progress: 100, last_updated: '2026-05-11 16:30', satisfaction_score: 4
    },
    { order_id: 'MEDIA-2026-0013', created_at: '2026-05-01 11:10', requester_name: 'Lê Văn Minh', requester_email: 'minh.le@cbcentres.com', requester_contact: '0913456789', department: 'CB Hưng Phú',
      project_name: 'Quay Lễ Khai Giảng Cơ sở', project_purpose: 'Quay phóng sự lễ khai giảng tại CB Hưng Phú.',
      request_type: 'shoot', deliverable_type: ['Quay sự kiện'], target_audience: ['Phụ huynh', 'Học viên CB'], usage_channels: ['Facebook', 'Website'],
      content_brief: 'Quay toàn cảnh + cận cảnh học viên + phỏng vấn 3 phụ huynh.',
      wording_required: false,
      priority: 'urgent', requested_deadline: '2026-05-15', actual_use_date: '2026-05-15',
      account_status: 'confirmed', account_pic: 'Mai Phương', production_pic: 'Linh Chi', production_status: 'inprogress',
      internal_deadline: '2026-05-15 12:00', progress: 30, last_updated: '2026-05-12 09:30'
    },
    { order_id: 'MEDIA-2026-0014', created_at: '2026-04-29 16:40', requester_name: 'Trần Quốc Anh', requester_email: 'qa@cbcentres.com', requester_contact: '0901234567', department: 'CB Mekong',
      project_name: 'Voucher Ưu đãi Tháng 5', project_purpose: 'Bộ voucher in + digital cho promotion tháng 5.',
      request_type: 'design', deliverable_type: ['Voucher/Coupon'], target_audience: ['Học viên ngoài CB'], usage_channels: ['In ấn', 'Email'],
      size_ratio: '15×7cm', content_brief: '3 mệnh giá voucher khác nhau.', creative_direction: 'Bắt mắt, có giá trị nổi bật.',
      wording_required: false,
      priority: 'normal', requested_deadline: '2026-05-05',
      account_status: 'confirmed', account_pic: 'Hậu', production_pic: 'Duy', production_status: 'completed',
      internal_deadline: '2026-05-04 17:00', progress: 100, last_updated: '2026-05-05 11:00', satisfaction_score: 5
    },
    { order_id: 'MEDIA-2026-0015', created_at: '2026-05-12 14:48', requester_name: 'Nguyễn Thu Hà', requester_email: 'ha.nguyen@cbcentres.com', requester_contact: '0907654321', department: 'Academic',
      project_name: 'KV Tuyển sinh Q3 2026', project_purpose: 'Key Visual chính cho campaign tuyển sinh Q3.',
      request_type: 'design', deliverable_type: ['Backdrop', 'Standee', 'Poster', 'Social Post', 'LCD/TV Screen'], target_audience: ['Phụ huynh', 'Học viên ngoài CB'], usage_channels: ['Facebook', 'In ấn', 'Sự kiện', 'LCD / TV nội bộ', 'Website'],
      size_ratio: 'Đa kích cỡ — main KV', content_brief: 'KV chủ đề "Chinh phục Q3 cùng CB".', creative_direction: 'Hùng tráng, năng động, có cảm hứng vươn lên.',
      wording_required: true,
      priority: 'critical', requested_deadline: '2026-05-18', urgent_reason: 'Roadmap bị đẩy lên 1 tuần.',
      account_status: 'pending', account_pic: null, production_pic: null, production_status: 'unassigned',
      internal_deadline: null, progress: 5, last_updated: '2026-05-12 14:48'
    },
    { order_id: 'MEDIA-2026-0016', created_at: '2026-04-28 10:30', requester_name: 'Phạm Thị Lan', requester_email: 'lan.pham@cbcentres.com', requester_contact: '0908111222', department: 'Sales',
      project_name: 'Facebook Ads Copy Tháng 5', project_purpose: 'Set 10 ad copy Facebook cho campaign tháng 5.',
      request_type: 'ads', deliverable_type: ['Facebook Ads Copy', 'Headline/CTA'], target_audience: ['Học viên ngoài CB', 'Phụ huynh'], usage_channels: ['Facebook'],
      content_brief: '10 angle copy khác nhau, mỗi angle test 2 variations.', creative_direction: 'Hook đầu mạnh, CTA rõ.',
      wording_required: true,
      priority: 'urgent', requested_deadline: '2026-05-01',
      account_status: 'confirmed', account_pic: 'Hậu', production_pic: 'Mai Phương', production_status: 'inprogress',
      internal_deadline: '2026-05-01 17:00', progress: 50, last_updated: '2026-05-10 13:20'
    },
    { order_id: 'MEDIA-2026-0017', created_at: '2026-05-11 17:55', requester_name: 'Lê Thị Hoa', requester_email: 'hoa.le@cbcentres.com', requester_contact: '0904553311', department: 'Academic',
      project_name: 'Slide Đào tạo Nội bộ', project_purpose: 'Slide đào tạo cho buổi training nội bộ.',
      request_type: 'slide', deliverable_type: ['Slide/Proposal'], target_audience: ['Giáo viên / Nhân sự nội bộ'], usage_channels: ['Sự kiện', 'Email'],
      size_ratio: '16:9 — 30 slide', content_brief: 'Slide chuyên ngành — không cần quá hoa văn.', creative_direction: 'Brand-aligned, focus content.',
      wording_required: false,
      priority: 'normal', requested_deadline: '2026-05-25',
      account_status: 'checking', account_pic: 'Hậu', production_pic: null, production_status: 'unassigned',
      internal_deadline: null, progress: 10, last_updated: '2026-05-12 11:40'
    },
    { order_id: 'MEDIA-2026-0018', created_at: '2026-04-25 09:15', requester_name: 'Đỗ Quang Hùng', requester_email: 'hung.do@cbcentres.com', requester_contact: '0905112233', department: 'CB Cần Thơ',
      project_name: 'Banner Sự kiện Hủy', project_purpose: 'Banner sự kiện đã hủy do thay đổi kế hoạch.',
      request_type: 'design', deliverable_type: ['Banner', 'Standee'], target_audience: ['Phụ huynh'], usage_channels: ['Sự kiện'],
      content_brief: '—', creative_direction: '—',
      wording_required: false,
      priority: 'normal', requested_deadline: '2026-05-10',
      account_status: 'rejected', account_pic: 'Mai Phương', production_pic: null, production_status: 'cancelled',
      internal_deadline: null, progress: 0, last_updated: '2026-04-26 10:00', internal_note: 'Sự kiện đã hủy do thay đổi kế hoạch HQ.'
    }
  ];

  /* ---------- Helpers ---------- */
  const ACCOUNT_STATUS_LABEL = {
    pending: 'Chờ xác nhận', checking: 'Đang kiểm tra', needinfo: 'Cần bổ sung',
    confirmed: 'Đã xác nhận', rejected: 'Hủy đơn'
  };
  const PROD_STATUS_LABEL = {
    unassigned: 'Chưa phân công', received: 'Nhận task', inprogress: 'Đang thực hiện',
    review: 'Chờ duyệt nội bộ', revision: 'Chỉnh sửa nội bộ', ready: 'Sẵn sàng bàn giao',
    delivered: 'Đã bàn giao', completed: 'Hoàn thành', cancelled: 'Hủy'
  };
  const TODAY = new Date('2026-05-13'); // demo: anchored to "now"
  function parseDate(s) { return s ? new Date(s.replace(' ', 'T')) : null; }
  function diffDays(target) {
    const d = parseDate(target);
    if (!d) return null;
    return Math.ceil((d - TODAY) / (24 * 60 * 60 * 1000));
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
      case 'pending': return o.account_status === 'pending';
      case 'needinfo': return o.account_status === 'needinfo';
      case 'confirmed': return o.account_status === 'confirmed' && o.production_status !== 'completed';
      case 'unassigned': return o.account_status === 'confirmed' && !o.production_pic;
      case 'urgent': return o.priority === 'urgent' || o.priority === 'critical';
      case 'overdue': {
        const days = diffDays(o.requested_deadline);
        return days !== null && days < 0 && o.production_status !== 'completed' && o.account_status !== 'rejected';
      }
      case 'completed': return o.production_status === 'completed' || o.production_status === 'delivered';
      default: return true;
    }
  }
  function matchesFilters(o) {
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = [o.order_id, o.requester_name, o.requester_email, o.department, o.project_name, o.project_purpose, o.content_brief, o.production_pic, o.account_pic]
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
    const isOverdue = deadlineClass(o.requested_deadline, ['completed', 'delivered'].includes(o.production_status)) === 'is-overdue';
    const dlCls = deadlineClass(o.requested_deadline, ['completed', 'delivered'].includes(o.production_status));
    const ts = parseDate(o.created_at);
    const ts_fmt = ts ? `${String(ts.getDate()).padStart(2,'0')}/${String(ts.getMonth()+1).padStart(2,'0')} · ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}` : '—';
    const dl = parseDate(o.requested_deadline);
    const dl_fmt = dl ? `${String(dl.getDate()).padStart(2,'0')}/${String(dl.getMonth()+1).padStart(2,'0')}/${dl.getFullYear()}` : '—';
    const picInitials = o.production_pic ? o.production_pic.substring(0, 2).toUpperCase() : '';
    const picAlt = o.production_pic && ['Hậu','Linh Chi','Vinh'].indexOf(o.production_pic) % 2 === 0 ? 'has-red' : '';

    return `
      <tr data-id="${o.order_id}" class="${isOverdue ? 'is-overdue' : ''}">
        <td><span class="order-id">${o.order_id}</span></td>
        <td><span class="text-xs muted">${ts_fmt}</span></td>
        <td class="requester-cell"><b>${escapeHtml(o.requester_name)}</b><span>${escapeHtml(o.department)}</span></td>
        <td class="project-cell"><b>${escapeHtml(o.project_name)}</b><span>${o.deliverable_type ? o.deliverable_type.slice(0, 2).join(' · ') + (o.deliverable_type.length > 2 ? ' +' + (o.deliverable_type.length - 2) : '') : ''}</span></td>
        <td><span class="text-xs">${TYPE_LABEL[o.request_type] || o.request_type}</span></td>
        <td><span class="priority-pill p--${o.priority}"><span class="dot"></span>${PRIORITY_LABEL[o.priority]}</span></td>
        <td><div class="deadline-cell ${dlCls}"><span class="date">${dl_fmt}</span><span class="relative">${fmtRelative(o.requested_deadline)}</span></div></td>
        <td><span class="tb-status s--${o.account_status}"><span class="dot"></span>${ACCOUNT_STATUS_LABEL[o.account_status]}</span></td>
        <td><span class="tb-status s--${o.production_status}"><span class="dot"></span>${PROD_STATUS_LABEL[o.production_status] || '—'}</span></td>
        <td>${o.production_pic
          ? `<div class="pic-cell ${picAlt}"><span class="pic-avatar">${picInitials}</span><span class="pic-name">${escapeHtml(o.production_pic)}</span></div>`
          : `<span class="pic-unassigned">— Chưa gán —</span>`}</td>
        <td><div class="progress-mini"><div class="bar"><i style="width:${o.progress}%"></i></div><b>${o.progress}%</b></div></td>
        <td>
          <div class="row-actions" data-row-id="${o.order_id}">
            <button class="kebab" aria-label="Hành động">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            <div class="menu">
              <button data-action="view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View Detail</button>
              <button data-action="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kiểm tra brief</button>
              <button data-action="needinfo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg> Yêu cầu bổ sung</button>
              <button data-action="confirm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Xác nhận brief</button>
              <button data-action="assign"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg> Gán P.I.C / Deadline</button>
              <button data-action="push"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> Push → Production</button>
              <hr/>
              <button data-action="cancel" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Hủy đơn</button>
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
    setCount('count-pending', ORDERS.filter((o) => o.account_status === 'pending').length);
    setCount('count-needinfo', ORDERS.filter((o) => o.account_status === 'needinfo').length);
    setCount('count-confirmed', ORDERS.filter((o) => o.account_status === 'confirmed' && o.production_status !== 'completed').length);
    setCount('count-unassigned', ORDERS.filter((o) => o.account_status === 'confirmed' && !o.production_pic).length);
    setCount('count-urgent', ORDERS.filter((o) => (o.priority === 'urgent' || o.priority === 'critical') && o.account_status !== 'rejected').length);
    setCount('count-overdue', ORDERS.filter((o) => {
      const days = diffDays(o.requested_deadline);
      return days !== null && days < 0 && o.production_status !== 'completed' && o.account_status !== 'rejected';
    }).length);
    setCount('count-completed', ORDERS.filter((o) => o.production_status === 'completed' || o.production_status === 'delivered').length);
    // sidebar badge
    const navBadge = document.getElementById('nav-pending');
    if (navBadge) navBadge.textContent = ORDERS.filter((o) => o.account_status === 'pending').length;
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
      const id = action.closest('.row-actions').getAttribute('data-row-id');
      const order = ORDERS.find((o) => o.order_id === id);
      if (!order) return;
      handleAction(action.getAttribute('data-action'), order);
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
      { ok: o.deliverable_type && o.deliverable_type.length > 0, label: 'Có hạng mục cụ thể' },
      { ok: !!o.size_ratio, label: 'Có kích thước / tỉ lệ' },
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
    const checks = [
      { ok: o.account_status === 'confirmed', label: 'Brief đã được xác nhận' },
      { ok: !!o.production_pic, label: 'Đã gán P.I.C sản xuất' },
      { ok: !!o.internal_deadline, label: 'Đã set Internal Deadline' },
      { ok: o.production_status !== 'cancelled' && o.account_status !== 'rejected', label: 'Order chưa bị hủy' },
      { ok: o.deliverable_type && o.deliverable_type.length > 0, label: 'Có hạng mục cụ thể' }
    ];
    const allOk = checks.every((c) => c.ok);
    return `<div class="push-check ${allOk ? '' : 'is-fail'}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
        allOk ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
      }</svg>
      <div>
        <b>${allOk ? 'Đủ điều kiện chuyển sang Production Board' : 'Thiếu điều kiện chuyển Production Board'}</b>
        <ul>${checks.map((c) => `<li>${c.ok ? '✓' : '○'} ${c.label}</li>`).join('')}</ul>
      </div>
    </div>`;
  }

  function buildActivity(o) {
    const acts = [
      { time: o.created_at, label: `Order được tạo bởi <b>${o.requester_name}</b>` },
      o.account_pic && { time: o.last_updated, label: `<b>${o.account_pic}</b> bắt đầu kiểm tra brief` },
      o.account_status === 'needinfo' && { time: o.last_updated, label: `<b>${o.account_pic}</b> yêu cầu bổ sung brief` },
      o.account_status === 'confirmed' && { time: o.last_updated, label: `<b>${o.account_pic}</b> xác nhận brief` },
      o.production_pic && { time: o.last_updated, label: `Gán P.I.C: <b>${o.production_pic}</b>` },
      ['inprogress', 'review', 'ready', 'delivered', 'completed'].includes(o.production_status) && { time: o.last_updated, label: `Status → ${PROD_STATUS_LABEL[o.production_status]}` }
    ].filter(Boolean);
    return `<ul class="activity-mini">${acts.slice(-5).reverse().map((a) => `<li><span>${a.label}</span><time>${a.time}</time></li>`).join('')}</ul>`;
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
    document.getElementById('d-created').textContent = 'Tạo lúc ' + o.created_at;
    document.getElementById('d-copy').setAttribute('data-copy', o.order_id);

    const safeJoin = (a) => Array.isArray(a) ? a.map((v) => `<span class="chip-mini">${escapeHtml(v)}</span>`).join('') : (a || '<em class="muted">—</em>');
    const v = (x) => x ? escapeHtml(x) : '<em class="muted">—</em>';
    const link = (u, label) => u ? `<a class="link" href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(label || u)}</a>` : '<em class="muted">—</em>';

    drawerBody.innerHTML = `
      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">A</span><h4>Requester Information</h4></div>
        <dl>
          <dt>Họ và tên</dt><dd>${v(o.requester_name)}</dd>
          <dt>Email</dt><dd>${v(o.requester_email)}</dd>
          <dt>SĐT / Liên hệ</dt><dd>${v(o.requester_contact)}</dd>
          <dt>Chi nhánh / Bộ phận</dt><dd>${v(o.department)}</dd>
          <dt>Ngày gửi</dt><dd><span class="mono">${v(o.created_at)}</span></dd>
        </dl>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">B</span><h4>Brief Information</h4></div>
        <dl>
          <dt>Mục đích</dt><dd>${v(o.project_purpose)}</dd>
          <dt>Đối tượng mục tiêu</dt><dd>${safeJoin(o.target_audience)}</dd>
          <dt>Kênh sử dụng</dt><dd>${safeJoin(o.usage_channels)}</dd>
          <dt>Loại yêu cầu</dt><dd>${v(TYPE_LABEL[o.request_type])}</dd>
          <dt>Hạng mục</dt><dd>${safeJoin(o.deliverable_type)}</dd>
          <dt>Kích thước</dt><dd>${v(o.size_ratio)}</dd>
          <dt>Nội dung</dt><dd>${v(o.content_brief)}</dd>
          <dt>Định hướng</dt><dd>${v(o.creative_direction)}</dd>
          <dt>Wording</dt><dd>${o.wording_required ? 'Cần wording' : 'Dùng đúng nội dung'}</dd>
          <dt>File brief</dt><dd>${o.file_brief_url ? link(o.file_brief_url) : '<em class="muted">—</em>'}</dd>
          <dt>Source link</dt><dd>${link(o.source_link)}</dd>
        </dl>
        ${buildBriefChecklist(o)}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">C</span><h4>Internal Management</h4></div>
        <div class="edit-row">
          <label>Account Status</label>
          <select class="select" id="edit-account-status">
            ${Object.entries(ACCOUNT_STATUS_LABEL).map(([k, label]) => `<option value="${k}" ${o.account_status === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Account PIC</label>
          <select class="select" id="edit-account-pic">
            <option value="">— Chưa gán —</option>
            ${['Hậu', 'Mai Phương', 'Đức Anh'].map((p) => `<option ${o.account_pic === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Production PIC</label>
          <select class="select" id="edit-prod-pic">
            <option value="">— Chưa gán —</option>
            ${['Duy', 'Vinh', 'Linh Chi', 'Mai Phương'].map((p) => `<option ${o.production_pic === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Priority</label>
          <select class="select" id="edit-priority">
            ${Object.entries(PRIORITY_LABEL).map(([k, label]) => `<option value="${k}" ${o.priority === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row">
          <label>Internal Deadline</label>
          <input class="input" id="edit-internal-deadline" type="datetime-local" value="${o.internal_deadline ? o.internal_deadline.replace(' ', 'T') : ''}" />
        </div>
        <div class="edit-row">
          <label>Production Status</label>
          <select class="select" id="edit-prod-status">
            ${Object.entries(PROD_STATUS_LABEL).map(([k, label]) => `<option value="${k}" ${o.production_status === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="edit-row" style="grid-template-columns:1fr">
          <label>Internal Note</label>
          <textarea class="textarea" id="edit-internal-note" placeholder="Ghi chú nội bộ..." style="min-height:80px">${escapeHtml(o.internal_note || '')}</textarea>
        </div>
        <div class="row" style="justify-content: flex-end; margin-top: var(--space-3)">
          <button class="btn btn-primary btn-sm" id="save-internal">Lưu thay đổi</button>
        </div>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">D</span><h4>Delivery Summary</h4></div>
        <dl>
          <dt>Preview Link</dt><dd>${link(o.preview_link)}</dd>
          <dt>Final Link</dt><dd>${link(o.final_delivery_link)}</dd>
          <dt>Delivery Status</dt><dd>${o.delivery_status ? `<span class="tb-status s--${o.delivery_status}"><span class="dot"></span>${PROD_STATUS_LABEL[o.delivery_status] || o.delivery_status}</span>` : '<em class="muted">—</em>'}</dd>
          <dt>Delivery Date</dt><dd>${v(o.delivery_date)}</dd>
          <dt>Rating</dt><dd>${o.satisfaction_score ? `<b style="color:var(--warning); font-size:var(--text-base)">★ ${o.satisfaction_score}/5</b>` : '<em class="muted">Chưa có rating</em>'}</dd>
          <dt>Feedback</dt><dd>${v(o.client_feedback)}</dd>
        </dl>
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">E</span><h4>Push to Production</h4></div>
        ${buildPushCheck(o)}
      </section>

      <section class="drawer-block">
        <div class="drawer-block-head"><span class="block-letter">⏱</span><h4>Activity Log</h4></div>
        ${buildActivity(o)}
      </section>
    `;

    // Wire save button
    document.getElementById('save-internal').addEventListener('click', () => {
      const newStatus = document.getElementById('edit-account-status').value;
      const newAcctPic = document.getElementById('edit-account-pic').value || null;
      const newProdPic = document.getElementById('edit-prod-pic').value || null;
      const newPriority = document.getElementById('edit-priority').value;
      const newDeadline = document.getElementById('edit-internal-deadline').value.replace('T', ' ');
      const newProdStatus = document.getElementById('edit-prod-status').value;
      const newNote = document.getElementById('edit-internal-note').value;

      Object.assign(currentOrder, {
        account_status: newStatus,
        account_pic: newAcctPic,
        production_pic: newProdPic,
        priority: newPriority,
        internal_deadline: newDeadline || null,
        production_status: newProdStatus,
        internal_note: newNote,
        last_updated: new Date().toISOString().slice(0, 16).replace('T', ' ')
      });
      window.MH.toast({ type: 'success', title: 'Đã lưu', message: 'Cập nhật Internal Management cho ' + currentOrder.order_id });
      render();
      openDrawer(currentOrder); // refresh drawer view
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(); });

  /* ---------- Drawer action buttons ---------- */
  document.getElementById('act-checking').addEventListener('click', () => updateStatus(currentOrder, 'checking', 'Đang kiểm tra brief'));
  document.getElementById('act-needinfo').addEventListener('click', () => updateStatus(currentOrder, 'needinfo', 'Yêu cầu bổ sung brief'));
  document.getElementById('act-confirm').addEventListener('click', () => updateStatus(currentOrder, 'confirmed', 'Đã xác nhận brief'));
  document.getElementById('act-push').addEventListener('click', () => pushToProduction(currentOrder));
  document.getElementById('act-cancel').addEventListener('click', () => updateStatus(currentOrder, 'rejected', 'Đã hủy đơn'));

  function updateStatus(o, newStatus, msg) {
    if (!o) return;
    o.account_status = newStatus;
    if (newStatus === 'rejected') o.production_status = 'cancelled';
    o.last_updated = new Date().toISOString().slice(0, 16).replace('T', ' ');
    window.MH.toast({ type: 'success', title: msg, message: o.order_id });
    render();
    openDrawer(o);
  }

  function pushToProduction(o) {
    if (!o) return;
    const checks = {
      brief: o.account_status === 'confirmed',
      pic: !!o.production_pic,
      deadline: !!o.internal_deadline,
      notCancelled: o.production_status !== 'cancelled' && o.account_status !== 'rejected',
      deliverable: o.deliverable_type && o.deliverable_type.length > 0
    };
    const missing = [];
    if (!checks.brief) missing.push('xác nhận brief');
    if (!checks.pic) missing.push('gán P.I.C');
    if (!checks.deadline) missing.push('Internal Deadline');
    if (!checks.notCancelled) missing.push('order chưa bị hủy');
    if (!checks.deliverable) missing.push('hạng mục');

    if (missing.length) {
      window.MH.toast({ type: 'error', title: 'Không thể push', message: 'Thiếu: ' + missing.join(' · ') });
      return;
    }
    o.production_status = 'received';
    o.progress = 20;
    o.last_updated = new Date().toISOString().slice(0, 16).replace('T', ' ');
    window.MH.toast({ type: 'success', title: '✓ Đã chuyển Production Board', message: o.order_id + ' · Task được tạo với status "Nhận task" · Progress 20%' });
    render();
    openDrawer(o);
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
        if (confirm('Hủy đơn ' + order.order_id + '?')) updateStatus(order, 'rejected', 'Đã hủy đơn');
        break;
    }
  }

  /* ---------- Drilldown from Master Dashboard ---------- */
  const DRILLDOWN_MAP = {
    total_orders:    { view: 'all',       sortKey: 'created_at',   sortDir: 'desc', label: 'Total Orders',    desc: 'Toàn bộ order trong kỳ.' },
    new_requests:    { view: 'pending',   sortKey: 'created_at',   sortDir: 'asc',  label: 'New Requests',    desc: 'Đơn mới chờ Account xác nhận.' },
    brief_need_info: { view: 'needinfo',  sortKey: 'last_updated', sortDir: 'desc', label: 'Brief Need Info', desc: 'Đơn cần bổ sung thông tin.' },
    completed:       { view: 'completed', sortKey: 'last_updated', sortDir: 'desc', label: 'Completed',       desc: 'Đơn đã hoàn thành hoặc đã bàn giao.' }
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

  // Auto-open drawer cho record cụ thể nếu ?id=MEDIA-* được pass từ Dashboard Alert Center.
  const focusId = new URLSearchParams(location.search).get('id');
  if (focusId) {
    const order = ORDERS.find((o) => o.order_id === focusId);
    if (order) {
      setTimeout(() => openDrawer(order), 80);
    } else {
      window.MH.toast({ type: 'warning', title: 'Không tìm thấy order', message: `${focusId} chưa có trong dataset demo.`, duration: 5000 });
    }
  }
})();
