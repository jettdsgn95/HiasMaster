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
| Public site | Done | `index`, `request`, `tracking`, `help`, `login`; homepage targets Nội bộ CB Centres + request smart flow stepper |
| Client Portal | Done | `client-dashboard.html` — xem orders, tracking, request, profile |
| Internal ops | Done | Dashboard, orders, production, delivery, reports, AI, chatbot, users, settings; Order Workbench + Task Workbench drawers |
| AI Tools | Done | 13 mini apps (gồm AI Voice / Supertonic on-device TTS), workspace form, output panel, usage log demo |
| Dashboards | Wired LIVE | **Master Dashboard** (Module 5 — 4 sections separated: Client Orders Overview 8 metrics / Internal Tasks Overview 8 metrics / Alerts 5 categories / Team Workload 6-PIC bar) · **Orders Dashboard** (13 KPI Client Order lifecycle: Intake / Production Flow / Feedback & Completion + 6 breakdowns) · **Task Dashboard** (17 KPI Internal workload: Volume / Workload / Deadline / Status / Performance + 6-PIC bar chart). Master Dashboard refresh button fetches Supabase again, polls every 60s, and listens to orders/tasks realtime when publication is enabled. Drilldown click-through tới database-orders.html / production-board.html với filter chính xác |
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
├── request.html          Order Form (auth-gated submit + smart flow stepper)
├── tracking.html         Client tracking by MEDIA-* code
├── help.html             FAQ + search + accordion
│
├── client-dashboard.html Client Portal (Client role only)
│
├── dashboard.html        Internal Master Dashboard
├── order-dashboard.html  Order-level KPI dashboard
├── task-dashboard.html   Task-level / internal production KPI dashboard
├── database-orders.html  Orders table, drawer, push-to-prod
├── production-board.html Task Tracker (Production Board) — Table / Kanban / My Tasks
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
    ├── order-form.js         request.html — 7-section form, auth guard, draft, flow progress
    ├── client-dashboard.js   client-dashboard.html — Client Portal logic
    ├── database-orders.js
    ├── production-board.js
    ├── reports.js
    ├── ai-tools.js
    ├── chatbot.js
    ├── user-management.js
    └── settings.js
```

Build hiện tại: **16 HTML pages · 13 JS files · 1 CSS file · 1 logo asset · 8 Supabase SQL migrations**. (Delivery Log page removed 2026-06-03 — bàn giao link nay nằm trong Order drawer.)

Phase 1+2 added JS modules: `assets/config.js`, `assets/supabase-client.js`, `assets/data-store.js` (zero-build, loaded via ESM CDN). Shared UI module: `assets/notif-icons.js` (`window.MH.notifIcons` — single source of truth cho icon thông báo, dùng bởi bell dropdown + client panel).

Supabase migrations (chạy theo thứ tự trong [`supabase/`](supabase/) folder):
1. [`schema.sql`](supabase/schema.sql) — 11 tables + 2 views + triggers
2. [`seed.sql`](supabase/seed.sql) — initial 5 demo users metadata (optional, anh đã clear)
3. [`add-notifications.sql`](supabase/add-notifications.sql) — notifications table + trigger
4. [`add-cancel-fields.sql`](supabase/add-cancel-fields.sql) — orders.cancel_reason / cancel_cause / cancelled_by / cancelled_at + extend notifications.type CHECK
5. [`rls.sql`](supabase/rls.sql) — Row-Level Security policies cho 11 bảng
6. [`storage.sql`](supabase/storage.sql) — 3 buckets + storage.objects policies
7. [`enable-realtime.sql`](supabase/enable-realtime.sql) — ADD TABLE notifications vào publication
8. [`add-shoot-location.sql`](supabase/add-shoot-location.sql) — orders/tasks.shoot_location
9. [`add-media-pics.sql`](supabase/add-media-pics.sql) — request_type CHECK thêm `'media'` (Quay/Chụp gộp) + orders.production_pic_video / production_pic_photo (BẮT BUỘC cho order type media)
10. [`clear-demo.sql`](supabase/clear-demo.sql) — utility wipe seed data trước production test

### Order ↔ Task ↔ Delivery relationship

```text
Order (client/branch submits brief)
  └── Task[]  (internal work item assigned to Media team — Task Tracker / Production Board)
        └── Delivery (preview / final handed to client)
```

- **Order** = request submitted by client/branch/department.
- **Task** = internal work item; one Order can have many Tasks; can also be **standalone** (`is_standalone: true` + no `order_id`) cho workstream nội bộ.
- **Delivery** = preview/final handoff per Task.
- Client never sees internal Tasks — they live entirely trong Task Tracker (production-board) + internal dashboards.
- New tasks created via Task Tracker hoặc qua "Create Task from this Order" được persist vào `localStorage['mh-extra-tasks']` để 2 module thấy nhau cross-page.

---

## Brand & Product Rules

- Brand colors: navy `#191970`, red `#BA110F`.
- Typography: Inter / Plus Jakarta Sans, dùng Playfair Display italic cho accent.
- Buttons dùng pill radius thống nhất.
- Content ưu tiên tiếng Việt; tiếng Anh chỉ dùng cho tech terms hoặc nhãn nghiệp vụ quen thuộc.
- Dữ liệu hiện là mock/demo, chưa có upload thật, auth thật hay API persistence.
- Avatar luôn hình tròn (`border-radius: 9999px`) toàn bộ site.
- Header layout (internal pages): `[Logo] ← → [Theme Toggle][Notification Bell][User Profile ▾]`
- Request page uses the smart flow stepper pattern: 1-7 timeline, icon, helper text, scroll/click active state, and matching 1-7 section header badges inside the form. Completion state comes from real section data; optional assets only show done after a file/link/note is added.
- Order Form Section 2 displays the planning field as `Mã kế hoạch` with example `KH07/CBMK`; the underlying field key remains `campaign_code` for compatibility.
- Optional DB fields such as `shoot_location` are non-blocking: `data-store.js` retries Supabase writes without the optional field if PostgREST reports a missing schema column (`PGRST204`). Run `supabase/add-shoot-location.sql` to persist location values.
- Database Orders detail drawer uses the Order Workbench pattern for Admin/Account intake: summary strip, animated next-action banner, one-column processing flow, dedicated internal note/comment block, brief/task readiness, related tasks, delivery summary, and activity log. Existing check/confirm/push/cancel behavior stays compatible.
- Task Tracker detail drawer uses the Task Workbench pattern: wide two-column task drawer, production checklist, file/link workspace, next-action rail, involved people, AI hint, and activity timeline. Existing status/link/meta/comment behavior stays compatible.
- Master Dashboard refresh is data-backed: the refresh button calls `orders.list()` + `tasks.list()` again, with 60s polling fallback and optional Supabase Realtime for `orders`/`tasks`.

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
6. Set env vars trong Railway → Variables tab. Copy `.env.example` để biết key cần set.
```

### Env vars

- Xem [`.env.example`](.env.example) để biết toàn bộ env vars (gồm cả scaffold cho Phase 1 + 2).
- Phase 0 hiện chỉ optional dùng `SENTRY_DSN` để bật error tracking.
- Static site nên frontend pick env qua `assets/config.js` (commit kèm repo, fill DSN tay).

### Production checklist

- [x] `robots.txt` chặn crawler khi còn demo
- [x] `.env.example` scaffold env vars
- [x] Sentry skeleton trong `assets/config.js` + lazy CDN load trong `app.js`
- [x] **Phase 1 foundation**: `supabase/schema.sql`, `supabase/seed.sql`, `assets/supabase-client.js`, `assets/data-store.js`. Frontend zero-build retained — Supabase SDK loaded từ `esm.sh` CDN.
- [x] **Phase 1 module migration COMPLETE**: login, database-orders, production-board, delivery-log, user-management, client-dashboard, tracking, ai-tools, chatbot. Tất cả write-through pattern (optimistic UI + Supabase fire-and-forget). Always-swap khi Supabase enabled.
- [x] **Phase 1 RLS LIVE** — `supabase/rls.sql` đã chạy: 11 bảng + 4 helper functions.
- [x] **Phase 2 storage LIVE**: `supabase/storage.sql` chạy xong, 3 buckets (avatars/brief-files/deliverables) active. Avatar upload + Brief file upload qua Supabase Storage.
- [x] **Phase 1.5 Realtime notifications**: `supabase/add-notifications.sql` + `enable-realtime.sql`. Bell dropdown auto-wire mọi page, badge unread, Supabase Realtime subscribe push popup toast 8s.
- [x] **Security cleanup**: Demo Accounts section xóa khỏi login. Password 9 user (5 demo `Cbmedia2026` + 4 client test `client@test`) đồng bộ qua SQL.
- [x] **Demo data cleared**: `supabase/clear-demo.sql` chạy, DB clean cho production test.
- [x] **Workflow UX upgrade**: 4-step Stepper UI + Push→Production tạo task tự động + Notification cho PIC.
- [ ] Generate `package-lock.json` — cần Node.js local. Chạy `npm install` 1 lần, commit lockfile.
- [ ] Migrate delivery file upload (preview/final) sang Storage — Phase 2 nice-to-have
- [ ] Custom SMTP (Resend / Brevo) để vượt free tier 3 email/h cho password recovery
- [ ] Enable Realtime cho `orders`/`tasks` để dashboard auto-refresh — Phase 1.6 optional

---

## Phase 1 — Supabase setup

Phase 1 đã thêm DB foundation **mà KHÔNG phá static demo flow**: chưa fill `SUPABASE_URL` thì `data-store.js` tự fallback localStorage như cũ.

### 6 bước bật DB (≈ 20 phút)

```text
1. Vào supabase.com → New Project. Chọn region Singapore (gần VN nhất).
2. Project Settings → API → copy "Project URL" và "anon public" key.
3. Mở `assets/config.js`, paste URL/KEY vào SUPABASE_URL/SUPABASE_ANON_KEY,
   đổi FEATURES.SUPABASE_DB thành `true`.
4. Supabase Dashboard → SQL Editor → New query → paste toàn bộ
   `supabase/schema.sql` → Run. Schema sẽ tạo 12 bảng + triggers + views.
5. Authentication → Users → Add user cho 5 demo email (admin@cb.vn,
   account@cb.vn, design@cb.vn, editor@cb.vn, client@cb.vn) với password
   `cb2026`. Trigger sẽ tự insert public.users row.
6. SQL Editor → paste `supabase/seed.sql` → Run. Sẽ UPDATE role/name cho
   5 user + seed 5 orders + 4 tasks + 2 comments.
```

### Kiến trúc data layer

```text
HTML page
  └─ config.js               (SUPABASE_URL/KEY + feature flags)
     └─ supabase-client.js   (dynamic import @supabase/supabase-js v2 từ esm.sh)
        └─ data-store.js     (window.MH.store API)
           ├─ Nếu Supabase enabled  → query thật, trả Promise
           └─ Else                  → fallback localStorage + mock array
              └─ app.js + page-specific JS (consumer)
```

Mọi module sẽ chuyển dần từ `TASKS.find(...)` sang `await MH.store.tasks.get(id)`. Khi consumer code chạy `await`, branching Supabase vs localStorage diễn ra trong store, không cần page biết.

### Bảng dữ liệu (12 tables)

| Table | Vai trò |
|---|---|
| `users` | Link `auth.users`; role/name/initials/title/avatar/department |
| `orders` | Request từ client/branch — 30+ cột mirror database-orders.js |
| `tasks` | Internal work item, link `order_id` hoặc standalone |
| `task_comments` | Thread + @mention + reply (uuid self-fk) |
| `deliveries` | Preview/final handoff + checklist (jsonb) |
| `ai_usage_log` + `ai_saved_outputs` | AI Tools history |
| `chatbot_messages` | Chatbot history per user/session |
| `settings` | System config (key-value jsonb singleton) |
| `activity_log` | Audit trail toàn module |
| `order_drafts` | Server-side autosave order form |
| `tasks_with_order` (view) | Join task + order metadata |
| `orders_with_task_count` (view) | Order + task counter |

### RLS (Row-Level Security)

Sau khi verify migration hoạt động đúng, chạy `supabase/rls.sql` trong SQL Editor:

```text
1. Supabase Dashboard → SQL Editor → New query
2. Paste toàn bộ supabase/rls.sql → Run
3. Verify: SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
```

File idempotent — chạy lại nhiều lần OK (DROP + CREATE). Policies:
- **users**: self read/update, staff read-all, admin full
- **orders**: client self-read, staff read-all, admin/account write
- **tasks + task_comments**: staff only (Client KHÔNG được thấy)
- **deliveries**: admin/account write, requester có order tương ứng đọc
- **ai_usage_log + ai_saved_outputs**: user self, admin all
- **chatbot_messages**: strict per-user
- **settings**: admin only
- **activity_log**: staff read, self insert
- **order_drafts**: self only

---

## Phase 2 — File Storage (Supabase Storage)

Phase 2 thêm real file upload qua Supabase Storage. Trước đây avatar lưu data URL trong localStorage, brief files giữ trong memory không lưu.

### 3 buckets

| Bucket | Visibility | Path pattern | Used by |
|---|---|---|---|
| `avatars` | public | `{user_id}/avatar-{ts}.jpg` | Profile modal |
| `brief-files` | private | `{order_id}/brief-{ts}-{filename}` | Order Form |
| `deliverables` | private | `{order_id}/{task_id}/{preview\|final}-{ts}` | Delivery Log (future) |

### Setup

```text
1. Chạy supabase/rls.sql trước (cần helper functions is_staff/is_admin/is_admin_or_account)
2. Supabase Dashboard → SQL Editor → paste supabase/storage.sql → Run
3. Verify: Storage → Buckets — phải thấy 3 buckets với cấu hình size limit + mime types
4. Reload app. Profile modal upload avatar → DevTools Network tab thấy
   POST /storage/v1/object/avatars/{user_id}/avatar-... và avatar.has-img dùng publicUrl
```

### Storage API (`window.MH.store.files`)

```js
// Public upload (avatars)
const { path, publicUrl } = await MH.store.files.upload('avatars', `${userId}/avatar.jpg`, blob, { contentType: 'image/jpeg' });

// Private upload + signed URL
await MH.store.files.upload('brief-files', `${orderId}/brief-${ts}.pdf`, file);
const url = await MH.store.files.signedUrl('brief-files', path, 3600); // 1 hour TTL

// List + remove
const items = await MH.store.files.list('brief-files', `${orderId}/`);
await MH.store.files.remove('brief-files', [path1, path2]);
```

### Fallback (chưa cấu hình Supabase)

- Avatar: encode data URL inline → save localStorage (như Phase 0/1)
- Brief files: giữ trong memory như cũ, không upload → cảnh báo toast khi submit

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

Brand: **CB Centres** · Project owner: CB Centres Media Team

*Last updated: 2026-06-03 · Workflow notifications khép kín + bàn giao trong Order drawer (Delivery Log gỡ) + order media Quay/Chụp gộp tách 2 task (cần add-media-pics.sql) + Order Form rút gọn theo type + New Orders card*
