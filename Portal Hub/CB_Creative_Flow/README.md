# CB Media Hub — Creative Service Portal

**CB Creative Flow** là MVP demo cho team **CB Centres** quản lý workflow Media từ tiếp nhận brief → sản xuất → bàn giao → đánh giá.

Project hiện là static multi-page site, không framework, không build step. Mục tiêu chính: cho stakeholder duyệt UI/UX và luồng nghiệp vụ trước khi nối backend/API thật.

---

## Quick Start

```text
1. Mở index.html bằng browser.
2. Click "Đăng nhập".
3. Chọn 1 demo account tile để tự fill credentials và vào dashboard.
```

Mật khẩu demo chung: `cb2026`

| Email | Role | Tag | Tên hiển thị | Phạm vi |
|---|---|---|---|---|
| `admin@cb.vn` | Admin | Manager | Mai Phương | Toàn hệ thống |
| `account@cb.vn` | Account | Account | Hậu Nguyễn | Order / Delivery / Reports |
| `design@cb.vn` | Design | Design | Duy Trần | My Tasks |
| `editor@cb.vn` | Editor | Editor | Linh Chi | My Tasks |
| `client@cb.vn` | Client | Client | Lan Anh | Tracking / Deliveries / Chatbot public |

Email hợp lệ khác sẽ được gán quyền Admin để demo nhanh toàn site. Account Client sẽ được chuyển về khu vực public tracking thay vì Dashboard.

---

## Current Scope

| Area | Status | Ghi chú |
|---|:---:|---|
| Public site | Done | Homepage, request form, tracking, deliveries, help, login |
| Internal ops | Done | Dashboard, orders, production, delivery, reports, AI, chatbot, users, settings |
| AI Tools | Done | 12 mini apps, workspace form, output panel, usage log demo |
| Chatbot | Done | Dedicated page + floating widget trên internal/public pages khi đã login |

Xem tiến độ chi tiết ở [`STATUS.md`](STATUS.md). Agent/dev mới nên đọc [`_hot.md`](_hot.md) trước khi sửa code.

---

## Tech Stack

| Layer | Choice |
|---|---|
| HTML | Static multi-page, Vietnamese-first |
| CSS | `assets/styles.css` với CSS variables và dark mode |
| JS | Vanilla ES, mock data inline theo module |
| Storage | `localStorage` cho theme, session, draft, settings |
| Fonts | Inter / Plus Jakarta Sans / Playfair Display / JetBrains Mono |
| Icons | Inline SVG theo style Lucide |

Không dùng React, Vue, Tailwind, npm hay bundler. Mở file `.html` là chạy.

---

## File Map

```text
CB_Creative_Flow/
├── README.md
├── _hot.md
├── STATUS.md
│
├── index.html
├── login.html
├── request.html
├── tracking.html
├── deliveries.html
├── help.html
│
├── dashboard.html
├── database-orders.html
├── production-board.html
├── delivery-log.html
├── reports.html
├── ai-tools.html
├── chatbot.html
├── user-management.html
├── settings.html
│
└── assets/
    ├── logo.png
    ├── styles.css
    ├── app.js
    ├── order-form.js
    ├── database-orders.js
    ├── production-board.js
    ├── delivery-log.js
    ├── reports.js
    ├── ai-tools.js
    ├── chatbot.js
    ├── user-management.js
    └── settings.js
```

Build hiện tại: **15 HTML pages · 12 JS files · 1 CSS file · 1 logo asset**.

---

## Brand & Product Rules

- Brand colors: navy `#191970`, red `#BA110F`.
- Typography: Inter / Plus Jakarta Sans, dùng Playfair Display italic cho accent.
- Buttons dùng pill radius thống nhất.
- Content ưu tiên tiếng Việt; tiếng Anh chỉ dùng cho tech terms hoặc nhãn nghiệp vụ quen thuộc.
- Dữ liệu hiện là mock/demo, chưa có upload thật, auth thật hay API persistence.

---

## Spec Sources

Spec gốc nằm tại [`../Brief Wflow/`](../Brief%20Wflow/):

- `media-hub-page-module-spec.md`
- `media-hub-api-flow-spec.md`
- `CB_Creative_Flow_Master_Dashboard_Module.md`
- `CB_Creative_Flow_02_Order_Form_Module.md`
- `CB_Creative_Flow_03_database_orders_module.md`
- `CB_Creative_Flow_04_production_board_module.md`
- `CB_Creative_Flow_05_delivery_log_module.md`
- `CB_Creative_Flow_06_reports_module.md`
- `CB_Creative_Flow_07_user_management_module.md`
- `CB_Creative_Flow_08_settings_module.md`
- `CB_Creative_Flow_09_ai_tools_module.md`
- `CB_Creative_Flow_10_chatbot_module.md`

---

## Handoff Workflow

Sau mỗi task hoàn thành:

1. Cập nhật `_hot.md` nếu có thay đổi về architecture, convention, token, role hoặc known quirk.
2. Cập nhật `STATUS.md` nếu module/file/progress thay đổi.
3. Nếu user gõ `check_update`, re-scan file map, localStorage keys, pending modules và sync lại docs.

---

Brand: **CB Centres** · Project owner: `jett.dsgn95@gmail.com`

*Last updated: 2026-05-14*
