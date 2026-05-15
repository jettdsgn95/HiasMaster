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

| Email | Role | Tag | Tên hiển thị | Redirect sau login |
|---|---|---|---|---|
| `admin@cb.vn` | Admin | Manager | Mai Phương | `dashboard.html` |
| `account@cb.vn` | Account | Account | Hậu Nguyễn | `dashboard.html` |
| `design@cb.vn` | Design | Design | Duy Trần | `dashboard.html` |
| `editor@cb.vn` | Editor | Editor | Linh Chi | `dashboard.html` |
| `client@cb.vn` | Client | Client | Lan Anh | `client-dashboard.html` |

Email hợp lệ khác sẽ được gán quyền Admin để demo nhanh toàn site. Client role có khu vực riêng biệt (`client-dashboard.html`), bị chặn khỏi Internal Dashboard.

---

## Current Scope

| Area | Status | Ghi chú |
|---|:---:|---|
| Public site | Done | `index`, `request`, `tracking`, `help`, `login` |
| Client Portal | Done | `client-dashboard.html` — xem orders, tracking, request, profile |
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
| Storage | `localStorage` cho theme, session, draft, orders, settings |
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
├── index.html            Public homepage
├── login.html            Login + 5 demo account tiles
├── request.html          Order Form (auth-gated submit)
├── tracking.html         Client tracking by MEDIA-* code
├── help.html             FAQ + search + accordion
│
├── client-dashboard.html Client Portal (Client role only)
│
├── dashboard.html        Internal Master Dashboard
├── database-orders.html  Orders table, drawer, push-to-prod
├── production-board.html Table / Kanban / My Tasks
├── delivery-log.html     Delivery management
├── reports.html          KPI, charts, export
├── ai-tools.html         12 AI mini apps
├── chatbot.html          CB Assistant dedicated page
├── user-management.html  User CRUD (Admin only)
├── settings.html         System config (Admin only)
│
└── assets/
    ├── logo.png
    ├── styles.css            Design system, all page styles
    ├── app.js                Shared: theme, toast, profile modal, header chip
    ├── order-form.js         request.html — 7-section form, auth guard, draft
    ├── client-dashboard.js   client-dashboard.html — Client Portal logic
    ├── database-orders.js
    ├── production-board.js
    ├── delivery-log.js
    ├── reports.js
    ├── ai-tools.js
    ├── chatbot.js
    ├── user-management.js
    └── settings.js
```

Build hiện tại: **15 HTML pages · 11 JS files · 1 CSS file · 1 logo asset**.

---

## Brand & Product Rules

- Brand colors: navy `#191970`, red `#BA110F`.
- Typography: Inter / Plus Jakarta Sans, dùng Playfair Display italic cho accent.
- Buttons dùng pill radius thống nhất.
- Content ưu tiên tiếng Việt; tiếng Anh chỉ dùng cho tech terms hoặc nhãn nghiệp vụ quen thuộc.
- Dữ liệu hiện là mock/demo, chưa có upload thật, auth thật hay API persistence.
- Avatar luôn hình tròn (`border-radius: 9999px`) toàn bộ site.
- Header layout (internal pages): `[Logo] ← → [Theme Toggle][Notification Bell][User Profile ▾]`

---

## Spec Sources

Spec gốc nằm tại [`../Brief_Wflow/`](../Brief_Wflow/):

- `media-hub-page-module-spec.md`
- `CB_Creative_Flow_Master_Dashboard_Module.md`
- `CB_Creative_Flow_02_Order_Form_Module.md` → `CB_Creative_Flow_11_Client_Portal_YeuCauSangTao_module.md`
- `CB_Creative_Flow_03_database_orders_module.md`
- `CB_Creative_Flow_04_production_board_module.md`
- `CB_Creative_Flow_05_delivery_log_module.md`
- `CB_Creative_Flow_06_reports_module.md`
- `CB_Creative_Flow_07_user_management_module.md`
- `CB_Creative_Flow_08_settings_module.md`
- `CB_Creative_Flow_09_ai_tools_module.md`
- `CB_Creative_Flow_10_chatbot_module.md`

---

## Deploy (Railway)

Project có sẵn `package.json` và `railway.json` để deploy lên [Railway](https://railway.app) qua Nixpacks builder + `serve` package.

```text
1. Commit + push code lên GitHub remote (jettdsgn95/HiasMaster).
2. Tại Railway dashboard: New Project → Deploy from GitHub repo → chọn HiasMaster.
3. Vào Settings của service → "Root Directory" → set thành: Portal_Hub/CB_Creative_Flow
4. Save → Railway tự install + start.
5. Generate public domain ở tab Networking để có URL test.
```

Local dev:

```bash
cd Portal_Hub/CB_Creative_Flow
npm install
npm run dev          # http://localhost:3000
```

`npm start` dùng `$PORT` env (Railway tự set), không chạy được trên Windows cmd. Local dùng `npm run dev`.

---

## Handoff Workflow

Sau mỗi task hoàn thành:

1. Cập nhật `_hot.md` nếu có thay đổi về architecture, convention, token, role hoặc known quirk.
2. Cập nhật `STATUS.md` nếu module/file/progress thay đổi.
3. Nếu user gõ `check_update`, re-scan file map, localStorage keys, pending modules và sync lại docs.

---

Brand: **CB Centres** · Project owner: `jett.dsgn95@gmail.com`

*Last updated: 2026-05-15*
