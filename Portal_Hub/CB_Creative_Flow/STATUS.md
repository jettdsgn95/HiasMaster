# STATUS.md — Module Progress Tracker

> Tracker tiến độ CB Media Hub. Cập nhật sau mỗi task có thay đổi module/file/progress, hoặc khi user gõ `check_update`.
>
> *Last updated: 2026-05-29 · Project state: Production-ready beta · Phase 1+2 LIVE · Realtime notifications · Demo data cleared · Cancel-order modal · **3 Dashboards fully wired** (Master separated combined / Orders Dashboard 13-KPI Client lifecycle / Task Dashboard 17-KPI Internal workload) · UI naming consistency (Modules 1-5) · **Client notifications sync LIVE** · Homepage hero copy targets Nội bộ CB Centres · Homepage hero background refresh · Order Form smart flow stepper · Railway deploy LIVE ✓*

---

## Quick View

| # | Module | Status | Files | Spec |
|---|---|:---:|---|---|
| 0 | Public site | Done | `index`, `request`, `tracking`, `help`, `login` | [page spec](../Brief_Wflow/media-hub-page-module-spec.md) |
| 1 | Master Dashboard | Done | `dashboard.html` · `order-dashboard.html` · `task-dashboard.html` | [01](../Brief_Wflow/CB_Creative_Flow_Master_Dashboard_Module.md) |
| 2 | Order Form | Done | `request.html`, `order-form.js` | [02](../Brief_Wflow/CB_Creative_Flow_02_Order_Form_Module.md) |
| 3 | Database Orders | Done | `database-orders.html`, `database-orders.js` | [03](../Brief_Wflow/CB_Creative_Flow_03_database_orders_module.md) |
| 4 | Task Tracker (Production Board) | Done | `production-board.html`, `production-board.js` | [04](../Brief_Wflow/CB_Creative_Flow_04_production_board_module.md) |
| 5 | Delivery Log | Done | `delivery-log.html`, `delivery-log.js` | [05](../Brief_Wflow/CB_Creative_Flow_05_delivery_log_module.md) |
| 6 | Reports | Done | `reports.html`, `reports.js` | [06](../Brief_Wflow/CB_Creative_Flow_06_reports_module.md) |
| 7 | User Management | Done | `user-management.html`, `user-management.js` | [07](../Brief_Wflow/CB_Creative_Flow_07_user_management_module.md) |
| 8 | Settings | Done | `settings.html`, `settings.js` | [08](../Brief_Wflow/CB_Creative_Flow_08_settings_module.md) |
| 9 | AI Tools | Done | `ai-tools.html`, `ai-tools.js` | [09](../Brief_Wflow/CB_Creative_Flow_09_ai_tools_module.md) |
| 10 | Chatbot | Done | `chatbot.html`, `chatbot.js` | [10](../Brief_Wflow/CB_Creative_Flow_10_chatbot_module.md) |
| 11 | Client Portal | Done | `client-dashboard.html`, `client-dashboard.js` | [11](../Brief_Wflow/CB_Creative_Flow_11_Client_Portal_YeuCauSangTao_module.md) |

**Overall**: 11/11 internal modules done · 5/5 public pages done · 0 module pending.

---

## Completed Modules

### 0. Public Site

Status: Done

- `index.html`: hero, quick actions, workflow overview, tracking lookup, FAQ preview, support strip.
- `login.html`: 5 demo account tiles (click-to-fill credentials), password show/hide, role-based redirect after login, `?redirect=` param support to return to original page after auth.
- `request.html`: 7-section order form (requester → brief → type → content → assets → deadline → confirm), conditional service sub-forms, autosave draft, preview, success state. Auth-gated: blocks submit if not logged in, auto-fills requester info from session, redirects to `login.html?redirect=request.html` preserving draft.
- `tracking.html`: search by `MEDIA-*` code, client-scope guard, mock order timeline, progress, feedback modal.
- `help.html`: FAQ sections, search, scroll-spy, contact card.

> Note: `deliveries.html` was listed in earlier docs but never existed in the codebase. Removed from all references.

### 1. Master Dashboard + Order Dashboard + Task Dashboard

Status: Done

- **Master Dashboard** (`dashboard.html`): Module 5 combined overview cleaned up 2026-05-22. KPI layout có 4 sections rõ ràng — **Client Orders Overview** (8 order metrics), **Internal Tasks Overview** (8 task metrics), **Alerts** (5 alert categories), và **Team Workload** (6-PIC bar chart với pressure threshold MAX_PER_PIC=8). Legacy mixed KPI row + Workflow Health + Production Status donut + Delivery Funnel + Recent Activity đã removed (~302 lines). Drilldown wired qua `data-card-key` + optional `data-drill-key` → `database-orders.html` hoặc `production-board.html`. dashboard.html giờ 55.0 KB / 774 lines.
- **Order Dashboard** (`order-dashboard.html`): KPI cấp Order — Total / Pending / Need Info / Checking / Confirmed / Completed. Funnel theo `account_status`. Phân bố theo chi nhánh + theo loại request. Mỗi KPI click-through tới `database-orders.html?dl=<key>`.
- **Task Dashboard** (`task-dashboard.html`): KPI nội bộ team — Total Tasks / In Production / Internal Review / Due Soon / Overdue / On-time Rate. Workload theo P.I.C, phân bố loại task, Linked vs Standalone. KPI click-through tới `production-board.html?dl=<key>`.
- Cả 3 page dùng chung sidebar (Master / Order / Task Dashboard tách thành 3 entries dưới group "Vận hành").

### 2. Order Form

Status: Done

- 7 sections A–G: requester, brief, request type, content, assets, deadline, confirm.
- Smart flow stepper 1-7 with active/done states, progress bar, icons, and short helper text; submit bar stays sticky.
- Service tiles and deliverables by type (Video/Quay/Photo/Ads conditional sections).
- Upload simulation with max-size validation.
- Priority logic, wording warning, autosave to `mh-order-draft-v2`, preview modal.
- Auth guard: inject requester identity into order payload, lock email field, preserve draft on redirect.

### 3. Database Orders

Status: Done

- Saved views, search, filters, sortable table, pagination.
- Detail drawer: request info, brief, internal management, **Related Tasks**, delivery summary, push validation, activity log.
- **Related Tasks block (T)**: list mọi task gắn với order (`order_id` match) — gộp từ in-memory built-in TASKS snapshot + `localStorage['mh-extra-tasks']`. Mỗi item click → mở Task Tracker với `?id=<task_id>` auto-open drawer.
- **Create Task from this Order** button: chỉ enable khi `account_status === 'confirmed'`. Redirect `production-board.html?createTask=1&order_id=...&project_name=...&task_type=...&priority=...&internal_deadline=...&production_pic=...&content=...` → auto-mở Create Task modal có prefill.
- Drawer actions: Check, Need Info, Confirm, Push to Production, Cancel.
- Push validation: confirmed brief + PIC + internal deadline + deliverable + active status.
- 18 mock orders.

### 4. Task Tracker (Production Board)

Status: Done

- Views: Table, Kanban, My Tasks. Default view per role: admin/account → table; design/editor → My Tasks.
- Sidebar label rename: **Production Board → Task Tracker**. Page H1 dual-labeled: "Task Tracker / Production Board". File path unchanged (`production-board.html`).
- Page-head `[+ Tạo Task]` button → opens Create Task modal in-page.
- Create / Edit Task modal: supports `is_standalone` checkbox (ẩn order_id row khi bật), prefill từ URL params, save mới push vào TASKS + `localStorage['mh-extra-tasks']`. Edit Task button injected dynamically vào drawer head cho admin/account/P.I.C.
- Quick filter chip row (`#quick-filter-chips`): Tất cả · Due Today · Due This Week · Overdue · Unassigned · My Tasks · Standalone. Tách biệt với summary card quick-filter (giữ nguyên).
- Linked Order block trong task drawer: hiển thị order_id + project name + button "Mở Order" → `database-orders.html?id=<order_id>`. Task `is_standalone` hiển thị note thay vì link.
- Summary cards, filters, sortable table, drag-drop Kanban giữ nguyên.
- Drag/status validation, link requirement cho Ready/Delivered transitions.
- 16 mock tasks + cross-page tasks từ `mh-extra-tasks` (created via modal hoặc "Create Task from Order").

### 5. Delivery Log

Status: Done

- Summary cards, toolbar filters, delivery table.
- Detail drawer A–F: order/task, files/links, delivery control, feedback/rating, checklist, activity log.
- Action modals: Send Preview, Send Final, Request Revision, Submit Rating.
- Send Final requires checklist 8/8 and final link present.
- Reopen flow. 10 mock deliveries.

### 6. Reports

Status: Done

- 12 KPI cards and 5 report filters (period, type, status, PIC, branch).
- 6 custom charts: trend line, distribution donut, role bar, PIC stacked bar, heatmap, quality grid.
- Delivery funnel, rating distribution, SLA gauge.
- PIC KPI table, overdue risk table, feedback table.
- CSV export and browser print PDF.

### 7. User Management

Status: Done

- Summary cards, filters, user table.
- Detail drawer: profile, role/permission, module access, assigned work, activity, security.
- Create/Edit modal with validation and permission preview.
- Safeguards: unique email, cannot deactivate the only admin, warns on open tasks.
- 14 mock users. CSV export.

### 8. Settings

Status: Done

- 12 panels: General, Workflow Status, SLA, Notifications, Brand, AI Tools, Chatbot, Files & Drive, Departments, Client Portal, Reports & Export, Security.
- Per-panel Save/Cancel, localStorage persistence to `mh-settings`.
- Test connection mocks, reset defaults, export JSON.
- Settings Activity Log in `mh-settings-activity`.

### 9. AI Tools

Status: Done

- Built from spec 09.
- Category tabs, search, tool cards, workspace form, CB brand preset, output panel, usage log.
- 13 mini apps: Post Generator, Ads Copy, Caption Builder, Brief Optimizer, Missing Info Checker, Visual Prompt, Video Concept, Slide Outline, Campaign Idea, Hashtag/CTA, Tone Adjuster, Summarizer, **AI Voice (Supertonic)**.
- **AI Voice tool** (new): on-device TTS — engine target `Supertonic` (github.com/supertone-inc/supertonic, ONNX runtime, ~99M params, 44.1kHz). Demo runtime dùng Web Speech API. UI clone preset M1-M5/F1-F5, 16 ngôn ngữ, expression tags `[laugh]/[breath]/[sigh]/...`, quality steps. Có audio player (Play/Pause/Stop), waveform animation, export SSML, link repo.
- Role permission: admin/account/design/editor; client blocked.
- Mock generation with CB guardrails, copy, regenerate, export markdown, feedback, save demo.
- Demo persistence: `mh-ai-usage-log`, `mh-ai-saved-outputs`.

### 10. Chatbot

Status: Done

- Built from spec 10.
- Dedicated page: suggested prompts by role, context panel, chat thread, safe actions, feedback, history clear.
- Floating CB Assistant widget injected on internal/public pages when user session exists.
- Supports process guidance, order/task status lookup demo, brief missing-info, content-gen handoff to AI Tools, navigation help.
- Role permission simulated for admin/account/design/editor/client.
- Demo persistence: `mh-chatbot-history`, `mh-chatbot-feedback`.

### 11. Client Portal

Status: Done

- Built from spec 11.
- `client-dashboard.html` + `assets/client-dashboard.js`.
- Auth guard: `role === 'client'` only; admin/staff redirected to `dashboard.html`.
- Sections: greeting strip, order status summary cards, order list table, order detail drawer, notification panel, profile view.
- Order detail drawer: order info, status timeline, deliverables, feedback.
- Profile tab: view/edit name, initials, title, avatar, phone, department, bio — persists to `mh-user`.
- Demo account: `client@cb.vn` / `cb2026` → redirect to `client-dashboard.html`.

---

## Pending Modules

No pending MVP modules. Remaining work is production integration:

- Replace mock data with backend APIs (orders, tasks, deliveries, users).
- Implement real auth and password validation.
- Implement real upload/storage (avatar, assets, deliverables).
- Replace simulated notification, test-connection, and AI generation flows.
- Replace `window.print()` PDF export if server-side export is needed.

---

## File Inventory

Build total: **17 HTML pages · 13 JS files · 1 CSS file · 1 logo asset · 6 Supabase SQL migrations**.

New files 2026-05-18:
- `order-dashboard.html` — Order-level KPI dashboard
- `task-dashboard.html` — Task-level / internal production KPI dashboard
- `assets/config.js` — Runtime config (Sentry DSN + Supabase URL/KEY + feature flags)
- `assets/supabase-client.js` — Supabase SDK loader via esm.sh CDN (zero-build)
- `assets/data-store.js` — Abstraction layer `window.MH.store` với 10 namespaces
- `supabase/schema.sql`, `seed.sql`, `rls.sql`, `storage.sql`, `clear-demo.sql` — DB setup migrations
- `robots.txt`, `.env.example` — Phase 0 hardening

New files 2026-05-20:
- `supabase/add-notifications.sql` — notifications table + trigger
- `supabase/enable-realtime.sql` — ALTER PUBLICATION add notifications
- `supabase/add-cancel-fields.sql` — cancel_reason / cancel_cause / cancelled_by / cancelled_at + notifications.type extend với `order_cancelled` + `order_new`

| File | KB |
|---|---:|
| `assets/styles.css` | 209.2 |
| `assets/production-board.js` | 73.4 |
| `request.html` | 64.3 |
| `assets/database-orders.js` | 59.9 |
| `dashboard.html` | 55.0 |
| `order-dashboard.html` | 50.9 |
| `settings.html` | 49.1 |
| `task-dashboard.html` | 46.4 |
| `assets/ai-tools.js` | 45.7 |
| `assets/user-management.js` | 42.8 |
| `assets/delivery-log.js` | 42.0 |
| `assets/client-dashboard.js` | 36.5 |
| `production-board.html` | 34.3 |
| `client-dashboard.html` | 30.6 |
| `tracking.html` | 29.2 |
| `reports.html` | 27.3 |
| `assets/order-form.js` | 26.3 |
| `user-management.html` | 25.0 |
| `assets/app.js` | 24.3 |
| `assets/settings.js` | 23.3 |
| `database-orders.html` | 23.1 |
| `assets/chatbot.js` | 21.0 |
| `assets/reports.js` | 20.7 |
| `index.html` | 17.8 |
| `delivery-log.html` | 17.4 |
| `ai-tools.html` | 15.7 |
| `help.html` | 14.9 |
| `login.html` | 14.8 |
| `assets/logo.png` | 13.0 |
| `chatbot.html` | 10.9 |
| `assets/hero/cb_character_cutout.png` | 178.7 |
| `assets/hero/icon-document-pencil.png` | 29.3 |
| `assets/hero/icon-image.png` | 10.3 |
| `assets/hero/icon-bell.png` | 9.0 |

---

## Changelog

| Date | Module | Action |
|---|---|---|
| 2026-05-29 | Public Homepage | **Đổi hero audience wording sang Nội bộ CB Centres**. `index.html` hero lead đổi "khách hàng" thành "Nội bộ CB Centres"; workflow preview copy cũng đổi sang "Nội bộ CB Centres" để nhất quán audience nội bộ. Không đổi layout, CTA, routing hoặc logic. |
| 2026-05-29 | Order Form | **Đồng bộ số bước giữa sidebar và section card**. `request.html` đổi header badge từng section từ A-G sang 1-7, helper text nhắc tài nguyên đổi từ "Section E" sang "bước 5". `assets/styles.css` chỉnh `.section-num` thành node tròn đồng bộ visual với smart flow stepper, bỏ alternate A/B màu cũ để tránh lệch nhận thức giữa sidebar và nội dung form. |
| 2026-05-26 | Order Form | **Đổi sidebar A-G sang smart flow stepper 1-7**. `request.html` thêm progress bar + timeline có icon/helper text để diễn đạt bước kế tiếp rõ hơn. `assets/styles.css` thêm light/dark styles và responsive horizontal stepper trên mobile. `assets/order-form.js` sync active step theo scroll/click, done state theo section completion thật; bước 5 `Tài nguyên` optional nên chỉ done khi user thêm file/link/note, không auto xanh lúc mới vào form. |
| 2026-05-26 | Public Homepage | **Refresh hero background theo hướng QuickMagic-inspired nhưng giữ CB brand**. `index.html` thêm decorative `hero-bg` layer aria-hidden; `assets/styles.css` thêm light/dark hero background system: Light mode giữ clean portal với grid/glow navy-red nhẹ, Dark mode cinematic workspace với navy/red depth, **visual-only floating panels không có text để tránh bị hiểu là button**, glass trust strip. Không thêm asset/dependency mới, dùng CSS + hero assets sẵn. Hero content/CTA/flow giữ nguyên; mobile CTA stack full-width để tránh overflow. |
| 2026-05-23 | Shoot location field | **Thêm field "Địa điểm" cho task/order chụp ảnh hoặc quay**. SQL migration `supabase/add-shoot-location.sql` (idempotent, `IF NOT EXISTS`) ADD `shoot_location text` vào cả `orders` và `tasks`. Order Form: sub-form shoot/photo có sẵn `shooting_location`/`photo_location` input → `doSubmit` map qua `shoot_location` khi INSERT. Database Orders drawer: Brief Information thêm row "Địa điểm" khi `request_type IN ('photo','shoot')`. Push to Production: kế thừa `shoot_location` vào task. "Create Task from this Order" deep-link pass qua URL param. Client Portal drawer: hiển thị tương tự. Task Tracker modal "Giao việc nội bộ" thêm row `#tm-location-row` show/hide khi `task_type IN ('photo','shoot')`, save (Create + Edit) include `shoot_location`. Task drawer Brief Information hiển thị. Field **optional** ở tất cả entry — không block submit, UI ẩn row khi type khác. **Cần chạy migration trong Supabase SQL Editor để DB column tồn tại** |
| 2026-05-23 | Header compact redesign (revised) | **Header top-right finalized**: 3 elements 36px — `[Theme circle] [Bell circle] [Profile: name+role text + avatar tròn]`. Theme toggle rewrite từ pill switch 48×26 với thumb translateX → icon-only circular đồng nhất bell + bell có border + hover shadow. Profile chip dùng inline text + avatar KHÔNG border (`flex-direction: row-reverse`, name 13px bold + role badge 10px stacked phải avatar phải). Cả cụm clickable mở dropdown menu cũ. Hover: bg surface-2 + avatar ring shadow. Mobile <560px: ẩn text, chỉ avatar. VN/EN lang toggle scaffold (i18n.js + .lang-pill CSS) **đã removed** sau khi user xác nhận chưa cần (scope dịch toàn bộ 17 page quá lớn để phase này) |
| 2026-05-23 | Notif click drawer fix | **Auto-open drawer retry sau khi Supabase data load**. Gap: 3 module (database-orders.js / production-board.js / delivery-log.js) đọc `?id=` query param ngay sau initial render (mock = empty array vì demo cleared) → focus fail → toast warning. Fix: refactor `tryFocusOrder`/`tryFocusTask`/`tryFocusDelivery` helper với 2-pass — first attempt im lặng với mock, retry sau khi `loadXFromStore()` resolve với Supabase data → mở drawer hoặc toast warning. Áp dụng cho cả 3 module nên Alert Center + dashboard drilldown + notification click đều benefit |
| 2026-05-23 | Brief supplement reverse-flow (Phase 1.5c) | **Wire client → admin/account flow khi client bổ sung brief**. Gap: `client-dashboard.js info-submit` trước chỉ optimistic `o.status='checking'` + toast — KHÔNG persist nội dung bổ sung, KHÔNG đổi `account_status` DB, KHÔNG notify staff. Fix: 1) Persist Supabase qua `MH.store.orders.update(o.id, { account_status:'checking', internal_note: prevNote + '\n\n[Client bổ sung — DD/MM/YYYY HH:MM]\nNội dung: ...\nLink: ...', last_updated })`. Append vào `internal_note` text free (không cần SQL migration, account thấy ngay trong drawer "Ghi chú nội bộ"). Timestamp prefix phân biệt source. 2) Cập nhật `o.__raw.internal_note` + `o.__raw.account_status` để local cache đồng bộ. 3) Bulk notify admin+account active qua `users.in('role',['admin','account']).eq('status','active')` → INSERT notifications `type='order_status_changed'`, title='📥 Client đã bổ sung brief', link=`database-orders.html?id=`. Pattern giống `order-form.js doSubmit`. 4) Error handler toast warning nếu sync fail. Out-of-scope: account-side click "Yêu cầu bổ sung" chưa có modal cho account nhập "cần bổ sung gì cụ thể" (hiện chỉ updateStatus → client thấy default text). Để fix lần refine sau |
| 2026-05-23 | Client notifications (Phase 1.5b) | **Client notifications sync — 5 new producers + Realtime consumer**. Phát hiện gap: client portal notification tab show 5 mock entries (MEDIA-2026-0008/0015/0019/0025/0022 — đã xóa lúc clear demo data). Producers chỉ có 2 spot (order-form submit notify staff, pushToProduction notify PIC) — thiếu hoàn toàn notify client khi status thay đổi. **Fix**: 1) `database-orders.js` thêm `notifyClient(order, payload)` helper (lookup `requester_id` first, fallback `users.id` qua `requester_email`); hook vào `updateStatus()` cho 3 transition (checking → 🔎 Brief đang được kiểm tra type=`order_status_changed`, needinfo → ⚠ Cần bổ sung brief type=`order_needinfo`, confirmed → ✅ Brief đã được xác nhận type=`order_confirmed`); hook vào `pushToProduction()` thêm notify client (🚀 Đã chuyển sang sản xuất type=`order_status_changed`) song song notify PIC. 2) `delivery-log.js` thêm `notifyClientDelivery(delivery, payload)` helper (lookup `users.id` qua `delivery.requester_email`); hook `send_preview` (👀 Đã có bản xem trước type=`delivery_preview` kèm link preview) + `send_final` (📦 Đã bàn giao final type=`delivery_final` kèm link final). 3) `client-dashboard.js` Consumer: bỏ 5 mock NOTIFS hardcoded → `let NOTIFS = []`; thêm `NOTIF_TYPE_UI_MAP` bridge Supabase notification.type → client UI type (needinfo/preview/rating/confirmed/cancelled/system); `mapNotifFromSupabase()` adapter row → mock shape; `loadNotificationsFromStore()` always-swap pattern (listAll 50 → replace NOTIFS + re-seed state.notifRead); `startNotificationsRealtime()` subscribe channel `notif-{user.id}` filter `user_id=eq.{user.id}` → INSERT event → NOTIFS.unshift + renderNotifications + toast 🔔 6s; mark-as-read write-through `MH.store.notifications.markRead()`; cleanup channel beforeunload. Type schema dùng CHECK constraint hiện có từ `add-cancel-fields.sql` (12 types) — không cần SQL migration. Producer/consumer pattern: fire-and-forget INSERT với try/catch + console.warn để không block UI. Acceptance: ✓ Client thấy notification realtime khi staff đổi status, ✓ Toast popup 6s khi có notification mới, ✓ Mark-as-read sync DB, ✓ Mock data đã xóa hoàn toàn |
| 2026-05-22 | Master Dashboard (Module 5 refine) | **Cleanup legacy hidden blocks**. Module 5 đã ship trước đó với 4 sections (Client Orders Overview 8 metrics / Internal Tasks Overview 8 metrics / Alerts / Team Workload) nhưng giữ kèm legacy HTML hidden (~302 lines: old mixed KPI grid + Workflow Health pipeline + Production Status donut + Delivery Funnel + Recent Activity feed). Refine session 2026-05-22: (1) Remove 5 legacy hidden blocks bằng awk skip lines từ `<!-- ============ LEGACY ...` đến `<!-- ============ MODULE 5 ...` next marker. (2) Simplify `loadMasterDashboard()` inline JS: bỏ 18 dbSetKpi/dbSetKpiTrend calls cho legacy keys (total_orders, new_requests, in_production, internal_review, ready_for_delivery, due_soon, on_time_rate, average_rating, rating_coverage) — các keys này không còn DOM target sau khi remove cards. Loader giờ gọi trực tiếp `renderModule5Dashboard(O, T)` rồi compute Workload by PIC. (3) Bỏ `[data-pipe]` selector code (Workflow Health đã removed). dashboard.html từ 1138 → 774 lines (~32% reduction). Drilldown behavior unchanged: `DRILLDOWN_MAP` 26 entries, goDrilldown() reads card data-card-key + optional data-drill-key. Acceptance: ✓ Leader/Admin combined view rõ ràng, ✓ Orders + Tasks visually separated, ✓ drilldown working |
| 2026-05-22 | Master Dashboard (Module 5) | Refined `dashboard.html` as a combined Leader/Admin overview with 4 clear sections: Client Orders Overview (8 metrics), Internal Tasks Overview (8 metrics), Alerts, and Team Workload. Legacy mixed KPI row/workflow row kept hidden for rollback. Added new KPI keys with `data-drill-key` so existing drilldown behavior continues to route to Client Orders or Internal Task Tracker without mixing order/task semantics |
| 2026-05-12 | Public site | Built initial 5 pages and brand setup |
| 2026-05-13 | Public site | Rebrand to navy `#191970` + red `#BA110F`, pill buttons, serif accents |
| 2026-05-13 | Dashboard/Auth | Built dashboard, demo accounts, role-based UI |
| 2026-05-14 | Order Form | Rebuilt to 7-section v2 spec |
| 2026-05-14 | Database Orders | Added full table, drawer, push-to-production flow |
| 2026-05-14 | Production Board | Added table/Kanban/My Tasks, drag-drop, status transitions |
| 2026-05-14 | Delivery Log | Added drawer, checklist, send preview/final flows |
| 2026-05-14 | Reports | Added KPI, custom charts, tables, export |
| 2026-05-14 | User Management | Added user CRUD UI, permissions, validation |
| 2026-05-14 | Settings | Added 12 settings panels, workflow editor, activity log |
| 2026-05-14 | AI Tools | Built module 09 MVP: 12 mini apps, mock generation, usage log |
| 2026-05-14 | Chatbot | Built module 10 MVP: dedicated page, floating widget, lookup, history |
| 2026-05-14 | Auth | Added Client demo account and client-role redirect/guard |
| 2026-05-14 | Tracking | Synced public tracking demo with `MEDIA-*` codes and client scope |
| 2026-05-14 | Auth/Profile | Added editable Profile modal in `app.js`: edit name/initials/title, avatar upload (256px JPEG), phone/department/bio, role select gated to Admin; persists to `mh-user` and refreshes chip live |
| 2026-05-14 | Dashboard | KPI drilldown: 12 cards map to Orders/Production/Delivery via `?dl=<key>`; target applies filter, shows banner, scrolls to table |
| 2026-05-14 | Deploy | Added `package.json` + `railway.json` for Railway deploy via Nixpacks + `serve` |
| 2026-05-14 | Repo layout | Rename folders to remove spaces: `Portal Hub` → `Portal_Hub`, `Brief Wflow` → `Brief_Wflow` |
| 2026-05-14 | Handoff docs | Created and optimized README, `_hot.md`, `STATUS.md` |
| 2026-05-15 | Client Portal | Built module 11: `client-dashboard.html` + `client-dashboard.js` — order status, order detail drawer, notification panel, profile tab; auth guard client-only |
| 2026-05-15 | Order Form | Added auth guard to `request.html`: blocks submit if not logged in, auto-fills requester info, preserves draft on redirect to `login.html?redirect=request.html` |
| 2026-05-15 | Layout/UX | Moved User Profile from sidebar to header right: `#header-profile-chip` (avatar + name + role badge + dropdown) replaces sidebar profile card across all 10 internal pages |
| 2026-05-15 | Layout/UX | Sidebar bottom: replaced profile card with minimal App version block (CB Creative Flow · v1.0) |
| 2026-05-15 | Layout/UX | Removed "+ Tạo Order" button from `dashboard.html` and `database-orders.html` header-actions (button retained in page content) |
| 2026-05-15 | Layout/UX | Reduced role badge font size to 9px on header profile chip |
| 2026-05-15 | Public header | Removed "Gửi yêu cầu" CTA pill; login button restyled to `.btn-login-pill` (red gradient, `border-radius: 9999px`) |
| 2026-05-15 | Shared JS | `app.js` updated: `refreshHeaderChip()`, header chip toggle handler, profile modal close handles both chip selectors |
| 2026-05-15 | Docs | Removed `deliveries.html` from all docs (file never existed in codebase) |
| 2026-05-15 | Handoff docs | Synced README, `_hot.md`, `STATUS.md` to reflect 11/11 modules, current file inventory, Client Portal, new layout conventions |
| 2026-05-15 | Dashboard | Fix Alert Center: 6 "Xem" buttons không click được → đổi thành `<a class="btn">` link tới module phù hợp với `?dl=<key>&id=<order_id>`. Orders/Production/Delivery JS đọc `?id`, auto-open drawer nếu record tồn tại, toast warning nếu placeholder demo không có trong mock |
| 2026-05-15 | Auth/UX | "Cài đặt" trong header profile menu giới hạn admin: `<a href="settings.html" class="hpm-item" data-show-roles="admin">` ở 10 HTML files. Thêm CSS rule `.hpm-item[data-show-roles*="..."]` display: flex (admin/account/design/editor variants) để giữ layout đúng |
| 2026-05-15 | Production Board | Comments: thêm @mention autocomplete (gõ `@` → dropdown 6 team members + current user, filter realtime, ArrowUp/Down/Enter/Tab/Esc nav) và Reply (button per comment → banner "Đang reply @Author" → save với `reply_to` → replies indent dưới parent, click reply-indicator scroll tới parent). Comment object thêm `id`, `mentions[]`, `reply_to`, `reply_to_author`. @Name rendered as `.mention` chip trong text |
| 2026-05-15 | Auth/Order | Restrict Order Form sang admin/account/client only. Thêm `data-show-roles="admin,account"` cho sidebar Order Form `<li>` ở 9 internal pages (client giữ access qua client-dashboard sidebar). Header "+ Tạo Order" button (dashboard, database-orders) cũng gated. `order-form.js` thêm role guard: design/editor → toast warning + redirect dashboard. CSS thêm rule `.btn[data-show-roles*="..."]` display: inline-flex để giữ button layout |
| 2026-05-15 | Auth/Order | Chatbot: ẩn "Open Order Form" cho design/editor. Static link trong `chatbot.html` `data-show-roles="admin,account"`. `chatbot.js` thêm `filterActions(actions)` filter URL `request.html` khỏi message actions khi role design/editor |
| 2026-05-15 | Public/Hero | Rewrite Hero Section visual ở `index.html`: thay khối dashboard mockup cũ (`.hero-mock` + 2 `.hero-floating`) bằng cụm CB character 3D + 3 floating icons (bell, document-pencil, image). Asset đặt tại `assets/hero/` (copy từ `Source/`). Icons có animation translateY 6–10px ease-in-out infinite alternate với delay khác nhau, tôn trọng `prefers-reduced-motion`. Responsive tablet/mobile, icon document-pencil ẩn ở ≤480px |
| 2026-05-15 | Public/Hero | Refinement: tách 3 keyframe riêng (`heroFloatBell`/`heroFloatDoc`/`heroFloatImage`) — biên độ 14-18px + rotate ±3° để chuyển động dễ thấy. Reposition `icon-image` upper-right (top:130, right:28, w:46px sau scale 50%) ngang mặt character thay vì giữa torso, tránh chồng camera baked-in của cutout |
| 2026-05-18 | Nav/UX | Sidebar rename "Production Board" → "Task Tracker" trên 9 internal pages. Thêm 2 nav entries dưới Master Dashboard: `Order Dashboard` (admin/account), `Task Dashboard` (all internal). Rename "Dashboard" → "Master Dashboard" để chuẩn hóa labels |
| 2026-05-18 | Dashboard | Tạo `order-dashboard.html` (KPI cấp Order: funnel theo `account_status`, branch breakdown, type breakdown — drilldown sang `database-orders.html?dl=<key>`) và `task-dashboard.html` (KPI nội bộ: total/in-prod/review/due-soon/overdue/on-time, workload PIC, task-type distribution, Linked vs Standalone — drilldown sang `production-board.html?dl=<key>`). Master Dashboard giữ nguyên drilldown 12 KPI |
| 2026-05-18 | Task Tracker | Production Board được formalize làm Task Tracker. Page H1: "Task Tracker / Production Board". Page head thêm `[+ Tạo Task]` button mở Create Task modal in-page. Quick filter chip row trên toolbar: Tất cả/Due Today/Due This Week/Overdue/Unassigned/My Tasks/Standalone (`state.quickChip`, tách với summary card `state.quick`) |
| 2026-05-18 | Task Tracker | Create/Edit Task modal (`#task-modal`): hỗ trợ `is_standalone` checkbox (ẩn order_id row), prefill từ URL params (`?createTask=1&order_id=...&project_name=...&task_type=...&priority=...&internal_deadline=...&production_pic=...&content=...`), auto-generate `TASK-NNNN` ID, push vào TASKS + persist localStorage `mh-extra-tasks`. Edit mode mở qua dynamic "Sửa Task" button trong drawer head cho admin/account/PIC |
| 2026-05-18 | Task Tracker | Drawer thêm "Linked Order" block: hiển thị order_id + project name + "Mở Order" button → `database-orders.html?id=<order_id>`. Task `is_standalone` hoặc no `order_id` → hiển thị note thay vì link. Cũ "Order ID" line trong Brief Information bỏ |
| 2026-05-18 | Database Orders | Drawer thêm block "Related Tasks (T)": list mọi task gắn order — gộp từ `BUILT_IN_TASKS` snapshot mirror dataset Task Tracker + `mh-extra-tasks`. Mỗi item click → mở Task Tracker với `?id=<task_id>` auto-open task drawer. Button "Create Task from this Order" enable khi `account_status === 'confirmed'`, redirect Task Tracker với prefill query params |
| 2026-05-18 | Architecture | Cross-page task storage `localStorage['mh-extra-tasks']` (max 100 entries): tasks tạo mới từ Task Tracker hoặc "Create Task from Order" persist ở đây, cả `production-board.js` và `database-orders.js` đều đọc để hiển thị lẫn nhau. Mock dataset built-in vẫn giữ in-memory, không bị duplicate |
| 2026-05-18 | Production | **Phase 0 hardening**: Thêm `robots.txt` chặn crawler (demo), `.env.example` scaffold env vars cho Phase 0/1/2, `assets/config.js` runtime config (Sentry DSN + ENV + RELEASE + feature flags), Sentry browser SDK lazy-load qua CDN trong `app.js` (skip nếu DSN trống, tag user role + email). Wire `<script src="assets/config.js">` TRƯỚC `<script src="assets/app.js">` trên 17/17 HTML pages |
| 2026-05-20 | Realtime | **Realtime notification popup**: Thêm `supabase/enable-realtime.sql` ADD TABLE `notifications` vào publication `supabase_realtime`. `order-form.js doSubmit` sau khi INSERT order → query users role IN (admin,account) status=active → bulk INSERT notifications type=`order_new`. `app.js initNotificationBell` thêm `startRealtime()` subscribe channel `notif-{uid}` filter `user_id=eq.me` → INSERT event push qua WebSocket → `showNotifPopup()` toast 8s + click navigate + markRead. Cleanup channel on beforeunload. Poll 60s giữ làm fallback nếu WebSocket fail |
| 2026-05-20 | Workflow UX | **Stepper UI Account workflow + Push tạo task + Notification bell**: 1) `database-orders.js pushToProduction()` async: idempotent check `tasks.list({order_id})`, nếu có → toast warning + KHÔNG tạo mới; nếu chưa → `generateNextTaskId()` query max TASK-NNNN +1, INSERT `public.tasks` với fields auto-fill từ order (assigned_to, internal_deadline, priority, type, content), INSERT `public.notifications` type=`task_assigned` cho PIC. 2) Stepper UI 4 chấm + đường nối trong drawer top, CSS states `is-done/is-current/is-needinfo/is-cancelled` với pulse animation. `updateStepperState(o)` map account_status + production_status → visual + hint text + button enable/disable theo step. 3) `add-notifications.sql` bảng notifications + trigger touch read_at. `data-store.js` namespace `notifications`: listUnread/listAll/create/markRead/markAllRead/findUserIdByName. `app.js` IIFE initNotificationBell tự gắn dropdown vào tất cả `button[aria-label="Thông báo"]`, badge count unread, poll 60s |
| 2026-05-20 | UX | **4-step action button gradient + Cancel red**: 5 button drawer Account workflow đổi từ outline → gradient nền: Step 1 info blue nhạt, Step 2 amber warning, Step 3 navy CB, Step 4 red CB đậm. Cancel button nền red-700 với margin-left:auto. Hover lift + brightness. Dark mode tinh chỉnh contrast |
| 2026-05-20 | Security | **Xóa Demo Accounts section khỏi login.html**: Bỏ block HTML "Demo Accounts / Test mode" 5 tile click-to-login, xóa ACCOUNTS dictionary + DEMO_PWD hardcoded, xóa loginAsDemo() fallback + `[data-demo]` handler. `loginAs()` chỉ Supabase auth, fail trả error message thật. Lý do: Phase 1 đã có DB account thật, demo tiles để public là security risk |
| 2026-05-20 | Test setup | **5 demo + 4 client test accounts**: Thêm 4 user `client1-4@cb.vn` qua Supabase Auth Dashboard. Reset password tất cả 9 user qua SQL UPDATE `crypt('Cbmedia2026'/'client@test', gen_salt('bf'))` (Supabase UI mới không có "Edit password" trực tiếp, free tier rate limit recovery email 3/h). 5 demo cũ dùng `Cbmedia2026`, 4 client mới dùng `client@test` |
| 2026-05-20 | Data flow | **Tracking lookup Supabase + Client dashboard load + Tracking auth modal**: 1) `tracking.html` lookup async — try `MH.store.orders.get(code)` → mapOrderToTracking() shape, fallback localStorage `mh-submitted-orders`, bỏ hardcoded `DB` khi Supabase enabled. STATUS_PUB map 13 trạng thái → 4 statusKey. 2) `client-dashboard.js loadClientOrdersFromStore()` query orders filter `requester_id` fallback `requester_email`, adapter map Supabase shape → mock ORDERS shape (id/name/type/category/date/deadline/status/pic/preview/final/rating). 3) `tracking.html requireLoginModal()`: bỏ auto-redirect login top, thay bằng modal overlay khi user chưa login + click Tra cứu — preserve mã đã nhập qua `?redirect=` 4) Client scope check mở rộng: legacy `client_scope` HOẶC `requester_email`/`requester_id` match từ `__rawOrder` |
| 2026-05-20 | Routing | **Client redirect fix**: dashboard.html line 653 + ai-tools.js + production-board.js đều redirect role=client về `tracking.html` (legacy). Đổi sang `client-dashboard.html` đúng đích Phase 1 |
| 2026-05-20 | Bug fix | **User Management UNDEFINED badge cho design/editor**: ROLE_LABEL trong user-management.js chỉ có 5 key (admin/manager/account/staff/client) — thiếu design/editor. Bổ sung. Edit modal role dropdown thêm 2 option. CSS thêm `rt--design` (teal) + `rt--editor` (cam) cho cả light + dark. `loadUsersFromStore` adapter default đủ field UI cần (user_id, tag, permission_group, data_scope, status, phone, department) theo role |
| 2026-05-20 | Drawer UX | **Cancel-order modal + drawer action refactor (database-orders)**: 1) Remove 4-card stepper UI (`#wf-stepper`) khỏi drawer head — chỉ giữ logic enable/disable button + hint visibility trong `updateStepperState()`. 2) Push status message (`#wf-hint`) giờ chỉ hiện khi `isPushed` với text "✓ Đã push sang Task Tracker. PIC · Xem task →"; hidden khi chưa push. 3) Action button row reorder: `[Hủy đơn]` canh trái (gradient `#E53935 → #BA110F` + `margin-right: auto`) ⟷ 4 step buttons phải. Step 4 (Push → Production) đổi sang gradient green `#22C55E → #16A34A`. 4) Cancel modal `#cancel-modal` (520px overlay): Order ID + Project readonly + select "Nguyên nhân chính" (5 cause keys) + textarea "Lý do hủy đơn" required + checkbox "Gửi thông báo đến client" default ON. `submitCancel()` validate → mutate local + `persistOrder` patch 4 cancel field + notify client qua `notifications` table type=`order_cancelled`. Row kebab "Hủy đơn" cũng mở modal (bỏ `confirm()` cũ). 5) `tracking.html` thêm `#r-cancel-banner` hiển thị reason/cause/cancelled_by/at khi `raw.production_status === 'cancelled'`. 6) Green-circle tick style cho `.checklist li.ok` + `.push-check li.ok` — nền `#16A34A`, check trắng, `border-radius: 9999px`. 7) `supabase/add-cancel-fields.sql` ADD `cancel_reason/cancel_cause/cancelled_by/cancelled_at` + extend `notifications.type` CHECK với `order_cancelled` + `order_new` |
| 2026-05-20 | Drawer UX | **Tách Hủy đơn xuống hàng riêng + divider (cc05311)**: Refactor `.wf-actions` thành flex-column với 2 sub-block: `.wf-actions-flow` (4 step buttons, flex-wrap row) ⟷ `.wf-actions-danger` (border-top dashed + label `.wf-danger-label` "Hành động khác" uppercase muted + `[Hủy đơn]`). Bỏ `margin-right: auto` khỏi `.act-cancel` (không cần nữa vì đã ở row riêng). Destructive action tách hẳn khỏi 4-step flow giúp visual hierarchy rõ ràng hơn |
| 2026-05-20 | AI Tools (no-code) | **TTS engine swap exploration → reverted về Supertonic** (KHÔNG có code change committed). Đánh giá 3 alternative cho AI Voice tool: (1) VietCloneVoice (Windows .exe, không có web port → loại); (2) OmniVoice k2-fsa (PyTorch model, cần GPU backend → loại); (3) sherpa-onnx + Piper VN (có WASM, có 3 Vietnamese model thật từ HF rhasspy/piper-voices: vais1000-medium 63MB / 25hours_single-low 20MB / vivos-x_low 10MB nhưng yêu cầu build emscripten + 75-80MB bundle → phá zero-build, defer Phase 3). Kết luận: giữ Supertonic spec, Web Speech API tiếp tục làm demo runtime. **Lý do tiếng Việt phát sai trên Play button** = OS không có vi-VN voice → `window.speechSynthesis.getVoices().filter(v.lang.startsWith('vi'))` rỗng → fallback English voice → đọc gibberish. Fix tạm: install Vietnamese voice qua Windows Settings, hoặc dùng Edge browser (có Microsoft cloud neural voices `vi-VN-HoaiMyNeural` / `vi-VN-NamMinhNeural` khi online) |
| 2026-05-21 | Task Dashboard (Module 4) | **Refine Task Dashboard cho internal workload & performance**. Restructure 6-card flat grid thành **5 grouped sections** với 17 KPI total + 6-PIC workload + 2 breakdown chart: (1) **Task Volume** (4): Total Internal Tasks / Linked Tasks (order_id != null && !is_standalone) / Standalone Internal Tasks (is_standalone OR no order_id) / New Internal Tasks (status='pending'). (2) **Workload** (1 KPI + chart): Unassigned Tasks (no assigned_to) + Workload by PIC 6-member bar chart (Duy/Vinh/Linh Chi/Hậu/Đức Anh/Mai Phương, max 8 task/member, bar đỏ khi >max). (3) **Deadline** (3): Due Today (deadline today) / Due This Week (deadline ≤7 days) / Overdue Tasks (deadline past). (4) **Production Status** (6): To Do/Pending (status='pending') / In Progress (received|inprogress|revision|feedback_fix) / Internal Review (status='review') / Revision (status='revision') / Completed (status in completed/delivered) / Blocked (status='paused'). (5) **Performance** (3): On-time Rate (completed/(completed+overdue)*100) / Completed This Week (completed AND last_update trong 7 ngày) / Avg Completion Time (avg days between created_at → last_update cho completed tasks). Inline `loadTaskDashboard()` rewrite: helper `diffDaysFromNow(deadline)`, `isOverdueD()`, `isOpenStatus(s)`. **CHỈ load `MH.store.tasks.list()`** — KHÔNG load orders. `production-board.js`: expand `DRILLDOWN_MAP` từ 5 → **15 keys** với label/desc; `state.quick` switch thêm 9 case mới (pending, revision, blocked, unassigned, linked, standalone, due_today, due_week, completed_week). Page subtitle: "Trả lời câu hỏi: Team đang làm gì, ai đang quá tải, việc nào trễ?". Acceptance: ✓ Answer "team đang làm gì", ✓ Linked vs Standalone clearly separated (4-card volume + 2-row bar chart), ✓ Click-through → production-board.html?dl=KEY với filter chính xác |
| 2026-05-21 | Orders Dashboard (Module 3) | **Refine Orders Dashboard cho Client Order lifecycle**. Restructure 6-card KPI grid thành **3 grouped sections** với 13 KPI total: (1) **Order Intake** (5): Total Client Orders / New Orders / Checking Brief / Need More Info / Confirmed Brief. (2) **Production Flow** (3): In Production / Ready for Delivery / Delivered. (3) **Feedback & Completion** (5): Waiting Feedback / Rated Orders / Average Rating / Completed Orders / Cancelled Orders. **6 Breakdowns**: by branch/department + by request type (existing) + by priority + by Account PIC + by production status (9 status keys) + by delivery status (7 keys) (NEW). Inline `loadOrderDashboard()` rewrite: thêm 7 new KPI compute + 4 new breakdown maps; helper `updateBars(attr, countsMap)` consolidate bar update logic. **CHỈ load `MH.store.orders.list()`** — KHÔNG load tasks (internal tasks thuộc Task Dashboard). `database-orders.js`: expand `DRILLDOWN_MAP` từ 4 keys → **12 keys** với label/desc cho mỗi KPI; `matchesView()` switch thêm 7 case (checking/in_production/ready_for_delivery/delivered/waiting_feedback/rated_orders/cancelled). Page subtitle: "Trả lời câu hỏi: Client orders đang ở giai đoạn nào?". Acceptance: ✓ Answers stage question, ✓ no standalone tasks in metrics, ✓ KPI click-through → database-orders.html?dl=KEY với filter chính xác |
| 2026-05-21 | Task Tracker UX (Module 2) | **Refine Internal Task Tracker — radio group "Loại công việc" + Internal Task naming consistency**. production-board.html: (1) Button "+ Tạo Task" → "+ Giao việc nội bộ" (page head + modal title). (2) Modal: thay `<input type="checkbox" id="tm-standalone">` bằng radio group `name="tm-worktype"` 2 option `value="linked"` (Liên kết với Client Order, default) và `value="standalone"` (Công việc nội bộ độc lập). Mỗi option có icon + bold title + helper text dưới. (3) Khi chọn "standalone" → ẩn `#tm-order-row` + hiện `#tm-standalone-hint` với info card "ℹ Công việc này không liên kết với Client Order nào." (4) Validation save: linked option phải có MEDIA-* order_id, fail toast warning với CTA suggest switch sang standalone. (5) Drawer block "Linked Order" rename → "Loại công việc", thêm `.worktype-badge--linked` (navy "Linked to Client Order") hoặc `.worktype-badge--standalone` (red "Standalone Internal Task"). Linked card giữ "Mở Order" button → database-orders.html?id=. (6) CSS `.worktype-group`, `.worktype-option` (pseudo-class `:has(:checked)` cho selected state navy border + light bg) + `.worktype-badge` light/dark variants. (7) Quick filter chip "Standalone" → "Standalone Internal". Page subtitle update reference "Internal Tasks". "Sửa Task" button → "Sửa công việc". task-dashboard.html: H1 thêm "/ Công việc nội bộ", "+ Tạo Task" → "+ Giao việc nội bộ", "Total Tasks" → "Total Internal Tasks", section "Task vs Order link" → "Internal Tasks: Linked vs Standalone", row labels "Linked to Order" → "Linked to Client Order", "Standalone (internal)" → "Standalone Internal Task". database-orders.js drawer button "Create Task from this Order" → "Giao việc nội bộ từ Order này". `is_standalone` field shape KHÔNG đổi — data model preserved, chỉ UI clarification. Client role vẫn không thấy production-board (role guard trong production-board.js line 18). Acceptance: user có thể tạo cả 2 loại task, drawer phân biệt rõ qua badge, client cannot see |
| 2026-05-21 | UI naming (Module 1) | **Clarify Client Orders vs Internal Tasks distinction qua UI labels**. KHÔNG rename files/routes — chỉ update text. Sidebar labels (14 HTML files): "Order Dashboard" → "Orders Dashboard"; "Database Orders" → "Client Orders"; "Task Tracker" → "Internal Task Tracker". Page H1: database-orders.html "Database Orders" → "Client Orders / Database Orders"; production-board.html "Task Tracker / Production Board" → "Internal Task Tracker / Task Tracker · Production Board"; order-dashboard.html "Order Dashboard" → "Orders Dashboard — Client Orders KPI"; task-dashboard.html "Task Dashboard" → "Task Dashboard — Internal Work Dashboard". Browser `<title>` + meta descriptions cũng update tương ứng. JS user-visible strings update: `chatbot.js` (3 chatbot replies + 3 action button labels "Open Production Board" → "Open Internal Task Tracker", "Open Orders" → "Open Client Orders"); `delivery-log.js` (3 toast/modal text "Production Board" → "Internal Task Tracker"); `production-board.js` (1 access-denied toast). chatbot.html "Open Production Board" link; order-dashboard.html "Database Orders" button text; database-orders.html page subtitle. JS internal IDs (DRILLDOWN_MAP keys, data attributes), routes, file paths đều giữ nguyên — anti-break per acceptance criteria |
| 2026-05-21 | Dashboard wiring | **3 Dashboards wire dynamic load từ Supabase** (theo business clarification "2 flow vận hành: Client Orders + Internal Tasks"). Trước: 3 dashboard là static HTML mockup, KPI luôn hardcoded. Sau: **(1) Order Dashboard** (`d028886`): load `MH.store.orders.list()` → compute 6 KPI (Total/Pending/Checking/Need Info/Confirmed/Completed) + 6 Order Funnel + 7 Branch bars + 6 Type bars với % width. **(2) Task Dashboard** (`cbeb3ee`): load `MH.store.tasks.list()` → compute 6 KPI (Total/In Production/Internal Review/Due Soon/Overdue/On-time Rate) + 4 Workload PIC + 7 Task type + Linked-vs-Standalone. **(3) Master Dashboard** (`34a2c13`): parallel fetch orders + tasks → compute 12 KPI (Client Orders side: total_orders/new_requests/brief_need_info/average_rating/rating_coverage; Internal Tasks side: in_production/internal_review/ready_for_delivery/due_soon/overdue/on_time_rate; Combined: completed) + Workflow Health 6-stage pipeline + Workload by PIC 6 rows với segment bars (progress/review/overdue/done). Business model preserved: orders = client requests lifecycle, tasks = internal items (linked-to-order HOẶC standalone). RLS chặn client thấy tasks. Pattern dùng `data-card-key` + `data-pipe` + `data-pic` + `data-branch` + `data-type` + `data-link` attributes để JS dễ target, không động structure DOM khác. Async load fire-and-forget khi Supabase enabled, no-op khi off |
| 2026-05-21 | Cleanup | **Clear toàn bộ fake data ở phần Vận hành** để anh test bằng order/task thật từ client + admin: 1) `database-orders.js` ORDERS array (18 mock orders 80870→62539 bytes) + BUILT_IN_TASKS snapshot (16 mock tasks) → `[]`. 2) `production-board.js` TASKS array (16 mock tasks 79933→70360) → `[]`. 3) `delivery-log.js` DELIVERIES array (10 mock deliveries 57425→42944) → `[]`. 4) `dashboard.html` (Master): KPI 128/12/5/34/7/9/11/4/68 → 0; pipeline counts 6 stage → 0; workload bar widths (24 spans) → 0%; donut center 48 → 0; delivery tiles 32/11/5/4/1/63 → 0; "2 PIC vượt ngưỡng" badge → "Trong ngưỡng"; 6 mock Alert items → empty state "Chưa có cảnh báo"; 6 mock Activity items → empty state "Chưa có hoạt động". 5) `order-dashboard.html` + `task-dashboard.html`: KPI + pipeline + bar charts widths/counts → 0. 6) `reports.html`: KPI trends (+22/+38/+12) → 0; SLA bar width 92% → 0%; avg-completion 2.4 → 0. 7) `tracking.html`: legacy `const DB = {...}` 7 sample MEDIA codes → `{}`; remove "Thử nhanh:" example chips. **KHÔNG đổi**: User Management, AI Tools, Chatbot, Settings, Client Portal (Hệ thống + Client area giữ nguyên). Khi anh tạo order thật qua client@cb.vn → admin/account thấy ngay; dashboards vẫn 0 vì chưa wire dynamic load (cần Phase 3 nếu muốn live KPI). **Tổng giảm**: 8 file, ~64KB size cleanup |
| 2026-05-20 | Deploy ⚠ | **Railway auto-deploy stuck (CHƯA FIX)**: Sau commit `d2ab83d` (May 19), webhook GitHub→Railway không fire trên các push tiếp theo. 5 commit mới (`ba76ff5`, `dd8006c`, `6c3c5b1`, `cc05311`, `ae13cc6`) đã lên GitHub `origin/main` nhưng KHÔNG trigger deploy. Diagnosis hoàn tất: GitHub App "Railway" có repo access ✓, Source repo+branch+root config đúng ✓, Auto-deploy toggle ON ✓, Wait-for-CI OFF ✓. Toggle Auto-deploy Disable→Enable không fix. Manual Redeploy báo "Problem processing request". Empty commit `ae13cc6` push thêm cũng không trigger. **Workaround pending**: anh thử Disconnect Branch `main` trong Railway Settings → Source → Reconnect (an toàn nhất). Hoặc Disconnect Source Repo full + reconnect (rủi ro phải set lại Root Directory `/Portal_Hub/CB_Creative_Flow`). Production site `cbmediahub.up.railway.app` hiện vẫn ở commit `d2ab83d` cũ — thiếu cancel modal flow + tracking banner + tách Hủy đơn UI mới |
| 2026-05-18 | Cleanup | **Clear demo data + always-swap pattern**: Thêm `supabase/clear-demo.sql` xóa toàn bộ orders/tasks/comments/deliveries/ai_usage/chatbot/activity_log/order_drafts seed, giữ users + schema + storage. Update 5 adapter (`loadOrdersFromStore`/`loadTasksFromStore`/`loadDeliveriesFromStore`/`loadUsersFromStore`/`loadClientOrdersFromStore`) — bỏ điều kiện `remote.length > 0`, luôn replace khi Supabase enabled (kể cả empty). DB là source of truth, không còn fallback mock 18 orders khi Supabase rỗng. `tracking.html` lookup: bỏ fallback hardcoded `DB` khi Supabase enabled. Mục tiêu: client tạo order thật → flow clean, không mix mock data |
| 2026-05-18 | Phase 1 + 2 | **Phase 1 close + Phase 2 storage**: Tạo `supabase/rls.sql` idempotent — helper functions `current_user_role()`/`is_staff()`/`is_admin_or_account()`/`is_admin()` SECURITY DEFINER + 11 bảng policies (users self+staff+admin, orders client-scoped + staff-write, tasks staff-only, task_comments cascade, deliveries admin/account write + client read qua order, ai_usage self+admin, chatbot per-user strict, settings admin-only, activity staff-read, order_drafts self). Tạo `supabase/storage.sql` — 3 buckets (`avatars` public + 2MB + image mimes; `brief-files` private + 50MB; `deliverables` private + 500MB) với storage.objects policies (self-folder write avatar, staff read deliverables, requester via order_id qua split_part path). `assets/data-store.js` thêm namespace `files` với upload/getPublicUrl/signedUrl/list/remove (data URL fallback avatar). `assets/app.js` Profile modal save → fetch data URL → blob → upload Supabase Storage → publicUrl + persist `public.users` metadata. `assets/order-form.js` doSubmit (async) → upload brief files lên `brief-files/{order_id}/...` → INSERT `public.orders` qua `MH.store.orders.create()`. localStorage fallback giữ nguyên |
| 2026-05-18 | Full Phase 1 | **Phase 1 module migration (turn 3 — complete)**: Migrate xong các module còn lại theo cùng pattern Auth+Orders. 1) `production-board.js`: expose `MH_MOCK_TASKS`, `loadTasksFromStore` + `persistTask` + `persistTaskComment` cho updateStatus, save links/meta, comment add (kèm @mention + reply), Create/Edit Task modal (insert + update). Re-build `ORDER_INDEX` sau khi swap dataset. 2) `delivery-log.js`: expose `MH_MOCK_DELIVERIES`, `snapshotDelivery()` extract 8 field thuộc schema, `persistCurDelivery(cur)` hook vào 7 mutation sites qua sed. 3) `user-management.js`: expose `MH_MOCK_USERS`, `loadUsersFromStore` adapter map `name → full_name`, `persistUser(id, patch)` qua raw supabase client (data-store chưa có users.update method). Persist status toggle + edit user (chỉ name/phone/department/role/status — các field thuộc public.users). 4) `ai-tools.js`: `addUsage()` + `saveOutput()` write-through qua `MH.store.aiUsage.log()` + `saveOutput()`. 5) `data-store.js`: thêm namespace `chatbot` với `append()`, `history(sessionId, limit)`, `feedback(messageId, val)` — fallback localStorage `mh-chatbot-history` + `mh-chatbot-feedback`. 6) `chatbot.js`: `pushMessage()` + `saveFeedback()` write-through. **Tất cả module giữ optimistic UI + localStorage fallback**, demo flow zero-breakage khi Supabase chưa cấu hình |
| 2026-05-18 | Auth + Orders | **Phase 1 module migration (turn 2)**: 1) `login.html` migrate sang Supabase Auth-first: nếu `window.MH.supabaseEnabled` thì gọi `MH.store.auth.signIn()`, chờ `onAuthStateChange` mirror session → `mh-user`, redirect dashboard/client-dashboard. Lỗi auth hoặc Supabase chưa cấu hình → fallback `loginAsDemo()` giữ nguyên hành vi cũ (demo accounts + password `cb2026`). 2) `database-orders.js` migrate: expose `window.MH_MOCK_ORDERS = ORDERS` cho cross-page reuse. Thêm `loadOrdersFromStore()` fire-and-forget khi init — Supabase enabled = swap dataset từ `MH.store.orders.list()` + re-render + re-open drawer nếu đang mở. Mutations (`updateStatus`, `pushToProduction`, `save-internal` button) gọi `persistOrder()` write-through (optimistic UI + write Supabase nếu enabled, toast warning nếu sync fail). Khi Supabase chưa cấu hình → hành vi y nguyên hiện tại |
| 2026-05-18 | DB Foundation | **Phase 1 foundation**: Thêm `supabase/schema.sql` (12 bảng: users, orders, tasks, task_comments, deliveries, ai_usage_log, ai_saved_outputs, chatbot_messages, settings, activity_log, order_drafts; trigger touch timestamps + auto-create public.users từ auth.users; views tasks_with_order + orders_with_task_count; RLS policies commented sẵn). `supabase/seed.sql` UPDATE role/name cho 5 demo user + seed 5 orders + 4 tasks + 2 comments. `assets/supabase-client.js` dynamic import @supabase/supabase-js@2 từ esm.sh CDN (zero-build maintained), expose window.MH.supabase + mirror session sang `mh-user`. `assets/data-store.js` abstraction layer (`window.MH.store` với 8 namespaces) — Supabase enabled = query thật, else fallback localStorage. Update `assets/config.js` thêm SUPABASE_URL + SUPABASE_ANON_KEY + FEATURES.SUPABASE_DB. Wire `supabase-client.js + data-store.js` TRƯỚC `app.js` trên 17/17 HTML pages. **Static demo flow KHÔNG bị phá** — chưa fill config thì y nguyên hiện tại |
| 2026-05-18 | AI Tools | Thêm tool **AI Voice (Supertonic)** — category `voice` mới. UI clone preset Supertonic M1-M5/F1-F5, 16 ngôn ngữ, expression tags, quality steps. Engine plan: Supertonic ONNX (github.com/supertone-inc/supertonic). Demo runtime: Web Speech API (`window.speechSynthesis`) — on-device, real audio output, no bundling. Voice Player panel có waveform animation, Play/Pause/Stop, export SSML cho production handoff. Generate output trả markdown gồm Script preview · Voice settings · SSML draft · Production handoff note. SSML preserve expression tags để khi swap backend Supertonic giữ nguyên format |

---

## check_update Protocol

When user types `check_update`:

1. Verify root/assets file map and file sizes against File Inventory.
2. Check `localStorage` keys in JS against `_hot.md` Section 8.
3. Check auth guards and role visibility assumptions in page JS files.
4. Confirm no new modules or files exist that aren't documented.
5. Update `Last updated` in `_hot.md` and `STATUS.md`.
6. Report sync summary in 1–2 lines.

---

## sync_task Protocol

When user types `sync_task`:

1. Update `STATUS.md`: Completed Modules (nếu thay đổi feature), File Inventory (KB sizes), Changelog (entry ngày hôm nay).
2. Update `_hot.md`: convention, token, role, file map, known decisions nếu có thay đổi.
3. Update `README.md`: file mới, role mới, deploy/stack thay đổi.
4. Cập nhật `Last updated` trong cả 3 file.
5. Báo tóm tắt 1–2 dòng.

---

*End of STATUS.md*
