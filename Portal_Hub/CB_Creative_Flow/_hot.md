# _hot.md — AI Agent Quick-Load Context

> Đọc file này trước khi sửa project. Nó chứa context ngắn để agent/dev mới tiếp quản đúng style, đúng convention.
>
> *Last updated: 2026-06-01 · Project state: Production-ready beta · Supabase Phase 1+2 LIVE · Realtime push · Demo data cleared · Cancel-order modal · **3 Dashboards fully wired** (Master separated combined / Orders Dashboard 13-KPI Client lifecycle / Task Dashboard 17-KPI Internal workload) · Master Dashboard live refresh · UI naming consistency (Modules 1-5) · **Client notifications sync LIVE** (5 producers + Realtime consumer) · **Notification bell minimal line icons (no emoji)** · Order Workbench single-column flow · Task Workbench drawer · Homepage hero copy targets Nội bộ CB Centres · Homepage hero background refresh · Order Form smart flow stepper · Railway deploy LIVE ✓*

---

## 1. TL;DR

**CB Media Hub / CB Creative Flow** là Creative Service Portal cho **CB Centres**.

- Static multi-page site: 16 HTML pages, 13 JS files, 1 shared CSS, zero build. (Delivery Log page gỡ 2026-06-03 — bàn giao trong Order drawer.)
- **2 khu vực riêng biệt**: Internal Dashboard (admin/account/design/editor) và Client Portal (client).
- Workflow chính: Order Form → Client Orders (database-orders) → Internal Task Tracker → **bàn giao trong Order drawer** → Reports.
- Brand: navy `#191970` + red `#BA110F`, Inter / Plus Jakarta Sans + Playfair italic accent.
- Done: 5 public pages + 1 client portal + 10 internal modules, gồm AI Tools MVP và Chatbot MVP.
- Data/auth/upload/API đều là demo/mock, chưa production-ready.

---

## 2. Brand Tokens

```css
--brand-600: #191970;
--red-600: #BA110F;

--grad-navy:  linear-gradient(135deg, #191970 0%, #3849b3 100%);
--grad-red:   linear-gradient(135deg, #d62a28 0%, #BA110F 100%);
--grad-brand: linear-gradient(135deg, #191970 0%, #4338ca 45%, #BA110F 100%);

--success: #16a34a;
--warning: #f59e0b;
--danger:  #dc2626;
--info:    #0ea5e9;
```

Typography:

- Sans/display: Inter + Plus Jakarta Sans.
- Accent: Playfair Display italic via `.serif-italic` và `.serif-italic--red`.
- Mono: JetBrains Mono.

Interaction/style invariants:

- Buttons dùng pill radius (`--radius-pill`).
- Touch target tối thiểu 44×44px.
- Giữ focus visible, reduced motion, dark mode fallback.
- Không dùng emoji làm structural icon trong UI; dùng inline SVG Lucide-style.
- Content Vietnamese-first.
- Avatar luôn hình tròn: `.avatar { border-radius: 9999px !important; overflow: hidden; }` — global trong `styles.css`.
- Theme toggle là pill switch (`[data-theme-toggle].theme-toggle-switch`), CSS-driven qua `[data-theme="dark"]` selector. Không dùng inline style cho icons.

---

## 3. File Map

### Public Pages

| File | Purpose | JS |
|---|---|---|
| `index.html` | Homepage + hero + quick actions | inline |
| `login.html` | Login + 5 demo account tiles | inline |
| `request.html` | Order Form 7 sections (auth-gated) | `order-form.js` |
| `tracking.html` | Client tracking by `MEDIA-*` code | inline |
| `help.html` | FAQ + search + accordion | inline |

> `deliveries.html` không tồn tại trong codebase — đã remove khỏi docs.

### Client Portal

| File | Roles | JS |
|---|---|---|
| `client-dashboard.html` | client only | `client-dashboard.js` |

Client Portal gồm: xem orders của mình, order status tracking, tạo yêu cầu mới (link sang `request.html`), profile. Client bị redirect về đây sau login và bị block khỏi Internal Dashboard.

### Internal Pages

| File | Roles | JS |
|---|---|---|
| `dashboard.html` | admin, account, design, editor | inline (Master Dashboard) |
| `order-dashboard.html` | admin, account | inline (Order-level KPI) |
| `task-dashboard.html` | admin, account, design, editor | inline (Task-level / Production KPI) |
| `database-orders.html` | admin, account | `database-orders.js` |
| `production-board.html` | admin, account, design, editor | `production-board.js` — Task Tracker / Production Board |
| `reports.html` | admin, account | `reports.js` |
| `ai-tools.html` | admin, account, design, editor | `ai-tools.js` |
| `chatbot.html` | admin, account, design, editor | `chatbot.js` |
| `user-management.html` | admin | `user-management.js` |
| `settings.html` | admin | `settings.js` |

### Shared Assets

- `assets/styles.css` — Design tokens, components, page styles. Gồm `.header-profile-chip`, `.theme-toggle-switch`, `.sidebar-version-block`, `.btn-login-pill`, `.auth-gate-bar`.
- `assets/notif-icons.js` — **Shared notification icon module** (2026-06-02). Expose `window.MH.notifIcons` (`PATHS` + `get(type)→{svg,cls}` + `stripEmoji(s)`). Single source of truth cho icon thông báo, dùng bởi `app.js` (bell) + `client-dashboard.js` (panel). Load TRƯỚC `app.js` trên 12 page có chuông/panel.
- `assets/config.js` — **Runtime config**, load TRƯỚC `app.js` trên 17/17 page. Expose `window.MH_CONFIG` với `SENTRY_DSN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_ENV` (auto-detect localhost vs production), `SENTRY_RELEASE`, `APP_VERSION`, `FEATURES` flags (gồm `SUPABASE_DB`). Để trống các key = disable feature tương ứng. File commit kèm repo, fill tay khi sẵn sàng bật.
- `assets/supabase-client.js` — **Supabase SDK loader (Phase 1)**, dynamic import @supabase/supabase-js@2.45.4 từ `esm.sh` CDN (giữ zero-build). Expose `window.MH.supabase`, `window.MH.supabaseReady` (Promise), `window.MH.supabaseEnabled`. Auth state change handler mirror Supabase session sang `localStorage['mh-user']` cho compat code hiện tại. Khi config trống → stub null, không network call.
- `assets/data-store.js` — **Data abstraction (Phase 1+2)**, expose `window.MH.store` với 10 namespaces: `users`, `orders`, `tasks`, `taskComments`, `deliveries`, `aiUsage`, `chatbot`, `files`, **`notifications`**, `auth`, `activity`. Mọi method trả Promise — nếu Supabase enabled → query qua SDK, else fallback `window.MH_MOCK_*` arrays + localStorage keys cũ. Consumer code dùng `await MH.store.tasks.get(id)` thay vì `TASKS.find(...)` — không branch theo backend. **Always-swap pattern (5/2026)**: bỏ điều kiện `remote.length > 0`, khi Supabase enabled luôn replace local array (kể cả empty → UI hiển thị empty state thay vì fallback mock).

**Module migration progress (Phase 1):**
- ✅ `login.html` — Supabase Auth-first via `MH.store.auth.signIn()`, fallback `loginAsDemo()`.
- ✅ `database-orders.js` — `MH_MOCK_ORDERS`, async `loadOrdersFromStore`, mutations via `persistOrder` (status, push-to-prod, save-internal).
- ✅ `production-board.js` — `MH_MOCK_TASKS`, `loadTasksFromStore`, `persistTask` + `persistTaskComment` cho status transitions, save links/meta, comment add, Create/Edit task modal.
- ✅ `delivery-log.js` — `MH_MOCK_DELIVERIES`, `loadDeliveriesFromStore`, `persistCurDelivery` hook vào 7 mutation sites (check, request_rev, send_preview, send_final, rate, close, reopen).
- ✅ `user-management.js` — `MH_MOCK_USERS`, `loadUsersFromStore` (adapter Supabase row → mock shape), `persistUser` cho status toggle + edit user (chỉ field nằm trong public.users schema).
- ✅ `ai-tools.js` — `addUsage()` + `saveOutput()` write-through via `MH.store.aiUsage.log()` + `saveOutput()`.
- ✅ `chatbot.js` — `pushMessage()` + `saveFeedback()` write-through via `MH.store.chatbot.append()` + `feedback()`. Cần thêm namespace `chatbot` vào data-store.js.
- ✅ Enable RLS policies — `supabase/rls.sql` idempotent (DROP + CREATE), helper functions `current_user_role()` / `is_staff()` / `is_admin_or_account()` / `is_admin()`, policies cho 11 bảng. Run trong Supabase SQL Editor sau khi verify migration.

**Phase 2 — File Storage:**
- ✅ `supabase/storage.sql` — 3 buckets (`avatars` public, `brief-files` + `deliverables` private) với mime/size limits + storage.objects policies dùng helper functions từ rls.sql.
- ✅ `assets/data-store.js` thêm namespace `files`: `upload(bucket, path, file, opts)`, `getPublicUrl()`, `signedUrl(bucket, path, expiresIn)`, `list()`, `remove()`. Fallback avatar → data URL inline; bucket private throw nếu chưa cấu hình.
- ✅ `assets/app.js` Profile modal save: nếu Supabase Storage enabled VÀ pendingAvatar là data URL → fetch → blob → upload `avatars/{user.id}/avatar-{ts}.{ext}` → publicUrl thay thế data URL. Persist profile metadata (name/initials/title/phone/department/bio/avatar_url/role) sang `public.users` qua raw client.
- ✅ `assets/order-form.js` doSubmit (async): trước khi tạo order, upload mỗi file trong `files` Map lên `brief-files/{order_id}/brief-{ts}-{filename}` với contentType. Lưu array `briefFiles` vào payload, INSERT row vào `public.orders` qua `MH.store.orders.create()`. localStorage fallback giữ nguyên.
- ⬜ Delivery preview/final file upload — chưa migrate (current dùng Drive URL inputs, không có upload native).

**Phase 1.5 — Realtime Notifications (5/2026):**
- ✅ `supabase/add-notifications.sql` — bảng `notifications` (user_id, type, title, message, link, related_entity_*, is_read) + 3 index + trigger `touch_notif_read_at`.
- ✅ `supabase/enable-realtime.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE notifications` để WebSocket push từ Postgres.
- ✅ `data-store.js notifications` namespace — listUnread/listAll/create/markRead/markAllRead/findUserIdByName.
- ✅ `app.js initNotificationBell` IIFE — auto-wire dropdown vào tất cả `button[aria-label="Thông báo"]`, badge unread, click bell mở dropdown 20 mới nhất. **Supabase Realtime subscribe channel `notif-{uid}` filter `user_id=eq.me`** → INSERT event → `showNotifPopup()` toast 8s + click→markRead+navigate. Poll 60s backup, cleanup channel on `beforeunload`.
- **Producers** đã ship: `order-form.js` (notify admin+account khi client submit, type=`order_new`), `database-orders.js pushToProduction` (notify PIC khi push to prod, type=`task_assigned`).
- **Bell icon = minimal line SVG theo `notification.type`** (2026-06-01, refactor 06-02): icon lấy từ shared module `window.MH.notifIcons` (xem mục dưới), `app.js` chỉ giữ alias `notifIcon=(t)=>MH.notifIcons.get(t)` + `stripNotifEmoji=(s)=>MH.notifIcons.stripEmoji(s)`. Dropdown item layout `[span.mh-notif-item-ico][div.mh-notif-item-body]`. Màu mặc định `var(--text-muted)`, `is-accent`=navy, `is-danger`=red. **KHÔNG thêm emoji mới vào title producer** — icon do consumer render theo type; cần icon mới chỉ thêm key vào `assets/notif-icons.js` PATHS.
- **Notification click → order drawer cho client (2026-06-02)**: `app.js resolveNotifLink` role-aware — `mh-user.role==='client'` → `client-dashboard.html?order=<id>` (client không vào được database-orders/production-board/delivery-log). `client-dashboard.js openOrderFromQuery()` đọc `?order=` sau khi orders load → `switchTab('orders')` + `openOrderDrawer(id)`. Tab panel `.notif-item` cũng clickable toàn bộ (`data-action="open-order"`). **notifyClient producer vẫn để link=`tracking.html?code=…`** (cho public tracking page) — client override sang in-portal drawer ở consumer, không cần đổi producer.
- **Notification flow end-to-end (hoàn thiện 2026-06-02 B+C+D)** — ma trận producer→consumer:
  - Client submit order → `order_new` → Admin+Account.
  - Account check/needinfo/confirm → `order_status_changed`/`order_needinfo`/`order_confirmed` → Client.
  - Account **Push → Production** → tạo task + `task_assigned` → **PIC** (lookup qua `findUserIdByName` fuzzy: exact→prefix→suffix→contains, tên ngắn khớp tên đầy đủ) + `order_status_changed` → Client.
  - PIC gửi duyệt (status→`review`) → `task_status_changed` "Task chờ duyệt nội bộ" → **Admin+Account** (`production-board.js notifyTaskStatusChange`).
  - Account trả sửa (status→`revision`/`feedback_fix` ở Task Tracker, HOẶC `request_rev` ở Delivery Log) → `task_status_changed` "Task cần chỉnh sửa" → **PIC**.
  - **Account bàn giao trong Order drawer** (`database-orders.js` section "Bàn giao cho client", 2026-06-03): nhập Preview Link → "Gửi Preview" (set `order.preview_link`+`delivery_status=client_wait`+`production_status=feedback_wait`); Final Link → "Gửi Final" (set `final_delivery_link`+`delivery_status=final`+`production_status=delivered`) → notify `delivery_preview`/`delivery_final` → Client. **Client Portal đọc `orders.preview_link`/`orders.final_delivery_link`** (KHÔNG đọc bảng `deliveries`). ⚠️ **Delivery Log (`delivery-log.js`) thao tác trên bảng `deliveries` riêng, KHÔNG sync sang order → vestigial cho flow thật**; đừng dùng Delivery Log để bàn giao cho client.
  - Client rating → `orders.update(satisfaction_score, client_feedback)` + `rating_received` → **Admin+Account** (`client-dashboard.js`, KHÔNG còn local-only).
  - LƯU Ý: gán PIC trên order ≠ tạo task; phải Push. Mọi cross-user INSERT notification được RLS cho phép (producer chạy dưới user bất kỳ).
- **Icon thông báo = SHARED MODULE `assets/notif-icons.js` (2026-06-02 refactor)**: SINGLE SOURCE OF TRUTH. Expose `window.MH.notifIcons` = `{ PATHS, get(type)→{svg,cls}, stripEmoji(s) }`. Cả `app.js` (bell dropdown, internal+client) lẫn `client-dashboard.js` (panel "Thông báo") đều consume `window.MH.notifIcons` — KHÔNG còn map riêng. **Sửa icon/màu chỉ ở `notif-icons.js` là mọi surface (bell, panel, toast) tự đồng bộ.** Load `<script src="assets/notif-icons.js">` TRƯỚC `app.js` trên 12 page có chuông/panel (11 internal + client-dashboard; public pages không có chuông nên `initNotificationBell` early-return, không cần). `cls` (is-accent/is-danger) do từng surface tự style màu. Client panel item dùng `.notif-ico` (CSS inline `client-dashboard.html`).
- **Bell attention state (2026-06-01)**: `refreshBadge()` toggle 1 class `.has-unread` trên `.mh-notif-wrap` theo `notifications.listUnread()` count > 0 — điều khiển ĐỒNG THỜI: badge đỏ (dot), **chuông gradient navy→red** (`stroke: url(#mh-bell-grad)`, def SVG inject vào body) + **animation rung `mhBellRing`**, và **dot pulse `mhBadgePulse`**. Hết chưa đọc (mark-all / đọc hết) → bỏ `has-unread` → chuông về `currentColor`, dừng animation, ẩn dot. Animation tắt khi `prefers-reduced-motion` (gradient + dot vẫn giữ). Mọi path đều gọi `refreshBadge`: start, poll 60s, realtime INSERT, mark-all, click item.

**Phase 1.5b — Client notifications sync (2026-05-23):**
- ✅ `database-orders.js notifyClient()` helper — lookup `order.requester_id` first, fallback `users.id` qua `requester_email`. INSERT notification row fire-and-forget.
- ✅ `database-orders.js updateStatus()` — hooked 3 status transitions: `checking` (🔎 Brief đang được kiểm tra, type=`order_status_changed`), `needinfo` (⚠ Cần bổ sung brief, type=`order_needinfo`), `confirmed` (✅ Brief đã được xác nhận, type=`order_confirmed`).
- ✅ `database-orders.js pushToProduction()` — thêm notification cho client (🚀 Đã chuyển sang sản xuất, type=`order_status_changed`) song song với notify PIC.
- ✅ `delivery-log.js notifyClientDelivery()` helper — lookup `users.id` qua `delivery.requester_email` (delivery rows không có requester_id field). Hooks: `send_preview` (👀 Đã có bản xem trước, type=`delivery_preview`, kèm link preview file) + `send_final` (📦 Đã bàn giao final, type=`delivery_final`, kèm link final file).
- ✅ `client-dashboard.js` Consumer wired:
  - Replaced 5 mock NOTIFS entries → `let NOTIFS = []`.
  - `NOTIF_TYPE_UI_MAP` bridge Supabase notification.type → client UI type (needinfo/preview/rating/confirmed/cancelled/system).
  - `mapNotifFromSupabase(n)` adapter: row → mock NOTIFS shape `{id, type, raw_type, order_id, title, message, link, time, read}`.
  - `formatNotifTime(s)` ISO timestamptz → "DD/MM/YYYY HH:MM".
  - `loadNotificationsFromStore()` async fetch `MH.store.notifications.listAll(50)` → replace NOTIFS + re-seed `state.notifRead`. Always-swap pattern.
  - `startNotificationsRealtime()` subscribe `notif-{user.id}` channel filter `user_id=eq.{user.id}` → INSERT event → `NOTIFS.unshift(mapped)` + `renderNotifications()` + toast popup 🔔 6s. Cleanup channel on `beforeunload`.
  - Mark-as-read click handler now calls `MH.store.notifications.markRead(notifId)` write-through (fire-and-forget).
- **Producer/consumer pattern**: producers (database-orders.js, delivery-log.js, order-form.js) fire-and-forget INSERT vào notifications table với try/catch + console.warn; consumer (client-dashboard.js, app.js initNotificationBell) subscribe Realtime channel filter theo user_id để push UI.
- Type schema: `notifications.type` CHECK constraint (từ `add-cancel-fields.sql`) cover: task_assigned, task_status_changed, task_comment, order_new, order_status_changed, order_confirmed, order_needinfo, order_cancelled, delivery_preview, delivery_final, rating_received, system.

**Phase 1.5c — Reverse-direction brief supplement (2026-05-23):**
- ✅ `client-dashboard.js info-submit` handler (Bổ sung brief modal): trước chỉ optimistic local `o.status='checking'` + toast → giờ đầy đủ flow:
  - Optimistic UI: `o.status='checking'`, clear `o.need_info`, close modal, re-render.
  - Persist Supabase: `MH.store.orders.update(orderId, { account_status:'checking', internal_note: prevNote + '\n\n[Client bổ sung — DD/MM/YYYY HH:MM]\nNội dung: ...\nLink: ...', last_updated })`. Append vào `internal_note` (text free) để **account thấy ngay trong drawer "Ghi chú nội bộ"** mà không cần SQL migration. Timestamp prefix giúp phân biệt source.
  - Notify admin + account active: query `users.in('role',['admin','account']).eq('status','active')` → bulk INSERT notifications `type='order_status_changed'`, title='📥 Client đã bổ sung brief', link=`database-orders.html?id=<order_id>`. Pattern y hệt `order-form.js doSubmit` lúc client tạo order mới.
  - Cập nhật `o.__raw.internal_note` + `o.__raw.account_status` để local cache đồng nhất sau refresh.
- Gap còn lại (out-of-scope): account-side click "Yêu cầu bổ sung" hiện chỉ `updateStatus('needinfo')` → KHÔNG có modal cho account nhập "cần bổ sung gì cụ thể" → client thấy default text "Vui lòng bổ sung brief — liên hệ Account team." Cần thêm modal account-side trong lần refine sau.

**Shoot location field (2026-05-23):**
- ✅ SQL migration `supabase/add-shoot-location.sql` — ADD `shoot_location text` cho cả `orders` và `tasks`. Idempotent (`IF NOT EXISTS`). **Cần chạy migration này trong Supabase SQL Editor để field hoạt động trên Railway DB.**
- ✅ Order Form (`request.html` + `order-form.js`): các sub-form `shoot` và `photo` đã có sẵn input `shooting_location`/`photo_location` từ trước → `doSubmit` giờ map qua `shoot_location` khi INSERT row Supabase. Field optional, không validate ràng buộc theo type (UI conditional show là đủ).
- ✅ Database Orders drawer: Brief Information section thêm dòng `<dt>Địa điểm</dt>` khi `request_type IN ('photo','shoot')`.
- ✅ Push to Production: `taskPayload.shoot_location` kế thừa từ `order.shoot_location` khi `request_type IN ('photo','shoot')` (else null). "Create Task from this Order" deep-link cũng pass qua URL param `shoot_location`.
- ✅ Client Portal drawer: hiển thị "Địa điểm" trong section detail-row khi `request_type IN ('photo','shoot')` và `shoot_location` có value.
- ✅ Task Tracker (`production-board.html` + `production-board.js`): modal "Giao việc nội bộ" thêm row `#tm-location-row` show/hide khi `tmType.value IN ('photo','shoot')`. Save (cả Create lẫn Edit) include `shoot_location` vào persistTask payload. Drawer Brief Information section hiển thị `<dt>Địa điểm</dt>` khi task_type photo/shoot.
- Field optional ở tất cả entry point — không block submit; UI ẩn row khi type không phải photo/shoot để tránh nhiễu.
- ✅ 2026-05-29 resilience: `assets/data-store.js` catches Supabase `PGRST204` schema-cache errors for optional `shoot_location`, then retries orders/tasks write without that field. This prevents photo/shoot orders from getting stuck as local-only while the DB migration/cache is not updated. Still run `supabase/add-shoot-location.sql` to persist location values.

**Header compact redesign (2026-05-23):**
- ✅ Header top-right: **[Theme circle 36px] [Bell circle 36px] [Profile: text + avatar 36px]**. Theme toggle rewrite từ pill switch 48×26 với thumb translateX → icon-only circular đồng nhất bell.
- ✅ Profile chip giờ là **inline text + avatar tròn KHÔNG border** (chốt 2026-05-23): `flex-direction: row-reverse` để name+role text bên trái, avatar bên phải. Text 2 dòng (name 13px bold + role badge 10px). Cả cụm clickable mở dropdown menu cũ. Hover: background `var(--surface-2)` + avatar ring shadow. Mobile (`max-width: 560px`): ẩn text, chỉ avatar tròn (avoid layout vỡ).
- ✅ **VN/EN lang toggle ĐÃ REMOVED** (tested chưa cần, scope quá lớn nếu dịch full 17 page). `assets/i18n.js` đã xóa, CSS `.lang-pill` đã xóa, `data-i18n` attrs trên 3 profile menu items + 2 aria labels còn lại trong HTML nhưng KHÔNG có consumer — không gây lỗi, nhưng nếu cần clean có thể strip sau.

**Homepage hero background refresh (2026-05-26):**
- ✅ `index.html` hero thêm `hero-bg` decorative layer (`aria-hidden`) với orb/line/floating panels, inspired by QuickMagic mood nhưng dùng CB brand navy `#191970` + red `#BA110F` only.
- ✅ `assets/styles.css` hỗ trợ 2 mode: Light mode = clean bright portal có grid/glow nhẹ; Dark mode = cinematic workspace navy/red, glass trust strip, floating panels rõ hơn. Floating panels là **visual-only, không có text** để tránh người xem hiểu nhầm là button/chip có thể click. Không thêm ảnh nền bitmap/dependency.
- ✅ Hero content, CTA, character asset và flow không đổi. Mobile/tablet nhỏ stack CTA full-width, hide bớt decorative panels để tránh overflow.
- ✅ 2026-05-29 copy update: Homepage hero chuyển wording từ "khách hàng" sang "Nội bộ CB Centres" để đúng audience nội bộ.

**Order Form smart flow stepper (2026-05-26):**
- ✅ `request.html` sidebar stepper A-G đổi sang timeline 1-7 có icon, mô tả ngắn từng bước, progress bar và trạng thái active/done để thể hiện flow kế tiếp rõ hơn.
- ✅ `assets/order-form.js` sync active step theo scroll/click bằng `IntersectionObserver`; done state vẫn dựa vào completion thật của từng section.
- ✅ Bước 5 `Tài nguyên` là optional nên không auto-complete khi chưa có file/link/note; chỉ chuyển done khi user thêm tài nguyên thật. Giữ selector/form submit flow hiện tại.
- ✅ 2026-05-29 sync UI: section header badge trong từng card đổi từ A-G sang 1-7, cùng ngôn ngữ với sidebar flow. Badge dùng node tròn thống nhất, không alternate chữ/màu gây lệch nhận thức.
- ✅ 2026-05-29 copy update: Section 2 field hiển thị `Mã kế hoạch` với placeholder `KH07/CBMK`; giữ id/name `campaign_code` để không ảnh hưởng payload/storage.
- ✅ 2026-06-02 **GỘP Quay + Chụp → 1 type `media` "Quay / Chụp ảnh"** (Phase 1+2). 1 tile `media` (bỏ tile shoot/photo riêng); sub-form "Thông tin buổi Quay / Chụp" có `media_service` (☑Quay ☑Chụp ≥1) + onsite dùng chung; `media_location`→`shoot_location`, onsite info gói vào `content_brief`. **Media KHÔNG dùng checkbox "Hạng mục cần sản xuất"** (ẩn `data-subform-hide-for="media"`) — chỉ service selector ☑Quay ☑Chụp + ô Nội dung. **Push order media tạo 2 task theo PIC được gán** (không theo deliverable): task_type `shoot` (Quay, assigned=production_pic_video) + `photo` (Chụp, assigned=production_pic_photo). Order drawer media hiện **2 ô PIC** (Quay/Chụp). Push/readiness/brief-checklist media-aware (bỏ check deliverable+size). **SQL `supabase/add-media-pics.sql` BẮT BUỘC**: mở rộng CHECK `orders.request_type` thêm `'media'` + 2 cột PIC (tasks.task_type giữ nguyên vì media split thành shoot/photo). request_type cũ `shoot`/`photo` vẫn hợp lệ cho order cũ. TYPE_LABEL `media`='Quay / Chụp ảnh' ở 3 module + order-form REQ_TYPE_LABEL.
- ✅ 2026-06-02 (slide) ẩn Kích thước/Tỉ lệ (thêm `slide` vào hide list); Section 4 ẩn textarea `content_brief` (`data-subform-hide-for="slide"`) + thêm `#slide_source_link` "Link nội dung thô" (Google Doc/Slide, bắt buộc) qua **cơ chế mới `data-subform-show-for`** (hiện field CHỈ cho type liệt kê; CSS `[data-subform-show-for]{display:none}`+`.is-cond-shown`). doSubmit map link→`content_brief`.
- ✅ 2026-06-02 (video/motion) ẩn Kích thước/Tỉ lệ (mở rộng `data-subform-hide-for="media,video,motion"` — đã có "Tỉ lệ video"). Video sub-form thêm `#script_link` "Link kịch bản" (bắt buộc) + đổi `#footage_link`→"Link source"; bỏ checkbox "Đã có kịch bản". Links gói vào `content_brief`.
- ✅ 2026-06-02 (photo) Hạng mục Chụp ảnh: deliverable đổi "Chân dung"→`Hoạt động ngoại khóa`, "Chụp sản phẩm"→`Chụp Studio/Photoshoot` (đổi cả value). 2 trường Kích thước/Tỉ lệ + Kích thước cụ thể ẩn khi chọn photo qua **`data-subform-hide-for="photo"`** (cơ chế mới: `updateConditional` toggle `.is-hidden-cond { display:none!important }`, dùng được cho mọi type). Photo dùng sub-form "Thông tin buổi chụp" sẵn có (`photo_location`→ map vào cột `shoot_location`).
- ✅ 2026-06-02 Section 3 `Kích thước / Tỉ lệ` (`#size_ratio`, sub-form design): options đổi `Banner ngang`→`Banner ngang 3 x 1m`, `Khác — sẽ ghi rõ trong mô tả`→`Khác — điền vào ô bên cạnh`, thêm `Standee 80 x 200cm`. Field bên cạnh ĐỔI từ `Số lượng phiên bản` (`version_quantity`, number) → **`Kích thước cụ thể`** (`#custom_size`, text, **disabled mặc định**). `order-form.js syncCustomSize()` chỉ enable `custom_size` khi `size_ratio` bắt đầu bằng `Khác` (clear value khi đổi sang preset khác); gọi lúc init + on change + sau restoreDraft. **`version_quantity` đã bị bỏ hoàn toàn** (không persist DB trước giờ). doSubmit: khi `size_ratio` = `Khác…` + có `custom_size` → lưu `custom_size` vào cột `size_ratio` (DB chỉ có cột này). Preview đổi nhãn `Số phiên bản`→`Kích thước cụ thể`. CSS thêm `.input:disabled/.select:disabled/.textarea:disabled`.

**Task Workbench drawer (2026-05-29):**
- ✅ `production-board.html` task drawer thêm class `.task-workbench`; `assets/styles.css` mở rộng riêng drawer task lên workbench 2 cột: main detail + right action rail. Không ảnh hưởng drawer Database Orders vì CSS scoped theo `.task-workbench`.
- ✅ `assets/production-board.js` giữ logic status/link/meta/comment cũ, bổ sung production checklist tự tính từ status/content/link, action rail gồm Next Actions, Người liên quan, AI hint, Activity Log.
- ✅ Pattern UI: task detail là nơi xử lý task cụ thể, không chỉ xem thông tin. Giữ `TASKS` data shape và Supabase payload hiện tại.

**Order Workbench drawer (2026-05-29):**
- ✅ `database-orders.html` order drawer thêm class `.order-workbench`; `assets/styles.css` mở rộng drawer Admin/Account order thành **single-column workbench flow**: summary strip → animated next-action banner → requester → brief → điều phối → ghi chú/comment nội bộ → điều kiện tạo task → related tasks → delivery → activity.
- ✅ `assets/database-orders.js` Việt hóa các block drawer cũ (Requester/Brief/Internal/Related/Delivery/Push/Activity), thêm `orderNextAction()` để Account/Admin nhìn thấy bước kế tiếp ngay khi mở order mới.
- ✅ `internal_note` được kéo ra thành block riêng **Ghi chú / Comment nội bộ**. Đây chưa phải threaded comments như Task Tracker; cố ý giữ field/schema hiện tại để không cần migration, vẫn persist qua `persistOrder(... internal_note ...)`.
- ✅ Animation banner `Hành động kế tiếp`: CSS `orderNextAttention` nhẹ bằng lift + navy glow, bọc trong `prefers-reduced-motion` để không gây khó chịu.
- ✅ Logic cũ giữ nguyên: action buttons Check/Need Info/Confirm/Push/Cancel, save internal fields, create task from order, notification và Supabase write-through không đổi.

**Master Dashboard live refresh (2026-05-29):**
- ✅ `dashboard.html` fix refresh button: trước chỉ đổi timestamp/toast, giờ gọi lại `loadMasterDashboard()` để fetch `orders.list()` + `tasks.list()` thật.
- ✅ Thêm polling fallback 60s và Supabase Realtime hook cho `orders`/`tasks` nếu publication đã bật. Timestamp `Last updated` chỉ đổi sau khi load data thành công.

**Other 2026-05-20 work:**
- **Drawer action area refactor (cancel modal)**: bỏ stepper UI 4 chấm khỏi `database-orders.html`. `wf-hint` giờ chỉ hiện khi `isPushed` với message "✓ Đã push sang Task Tracker · PIC · Xem task →"; ẩn khi chưa push. Action button row: `[Hủy đơn]` canh trái (gradient `#E53935 → #BA110F` + `margin-right: auto`) ⟷ `[Kiểm tra brief] [Yêu cầu bổ sung] [Xác nhận brief] [Push → Production]` (Push đổi sang gradient green `#22C55E → #16A34A`). `updateStepperState()` giờ chỉ enable/disable button + toggle hint visibility, không còn DOM ops cho stepper.
- **Cancel modal**: `#cancel-modal` overlay với Order ID + Project name readonly + select "Nguyên nhân chính" (5 cause keys: brief_insufficient / no_longer_needed / deadline_mismatch / duplicate_request / other) + textarea "Lý do hủy đơn" required + checkbox "Gửi thông báo đến client" default checked. Submit → `submitCancel()` validate reason → mutate local order → `persistOrder({ account_status:'rejected', production_status:'cancelled', cancel_reason, cancel_cause, cancelled_by, cancelled_at })` → nếu notify checked + Supabase enabled → lookup client `users.id` qua `requester_id` hoặc `requester_email` → INSERT notification type=`order_cancelled` link `tracking.html?code=...`. Row kebab "Hủy đơn" cũng mở modal (bỏ `confirm()` cũ).
- **Tracking cancel banner**: `tracking.html` thêm `#r-cancel-banner` hiển thị "Yêu cầu này đã bị hủy" + cause + reason + cancelled_by/at khi `raw.account_status === 'rejected'` || `raw.production_status === 'cancelled'`. Đọc từ `data.__rawOrder` (Supabase shape).
- **Green-circle tick style (yêu cầu #5)**: `.checklist li.ok::before` + `.push-check li.ok::before` đổi sang nền `#16A34A`, check trắng, `border-radius: 9999px`, `width/height 16-18px`. Áp dụng cho Brief checklist + Push-to-Production pre-check.
- **SQL migration** `supabase/add-cancel-fields.sql`: ADD `cancel_reason text` + `cancel_cause text` (CHECK 5 keys) + `cancelled_by uuid REFERENCES users(id)` + `cancelled_at timestamptz` vào `orders`. Đồng thời extend `notifications.type` CHECK constraint với `'order_cancelled'` + `'order_new'`.
- 4-step Account workflow buttons gradient nền nhạt→đậm + Cancel red-700 (bỏ outline). _(Step 4 đã đổi từ red sang green 5/2026.)_
- Stepper UI 4 chấm + đường nối + hint text — _(đã remove 5/2026, xem mục Drawer action area refactor.)_
- `pushToProduction` (async): idempotent check (đã có task → toast warning + skip), INSERT task auto-fill từ order, INSERT notification cho PIC, UPDATE order.production_status.
- ROLE_LABEL trong `user-management.js` mở rộng `design`/`editor` (trước thiếu → UI hiển thị UNDEFINED). CSS `rt--design` teal + `rt--editor` cam.
- Tracking auth flow: chưa login + click Tra cứu → `requireLoginModal()` overlay với CTA preserve `?code=`. Scope check: legacy `client_scope` OR `requester_email`/`requester_id` match.
- Client redirect fix: dashboard.html/ai-tools.js/production-board.js role=client → `client-dashboard.html` (trước redirect `tracking.html` legacy).
- Demo Accounts section + ACCOUNTS map + DEMO_PWD hardcoded XÓA khỏi login.html (security). loginAs() chỉ Supabase auth.
- Cross-page tasks/orders: clear demo seed qua `supabase/clear-demo.sql`, đồng bộ 9 user password (5 demo `Cbmedia2026`, 4 client test `client@test`) qua SQL `UPDATE auth.users SET encrypted_password = crypt(..., gen_salt('bf'))`.

**Migration pattern thống nhất:**
```text
1. Expose mock: window.MH_MOCK_X = X_ARRAY
2. Async swap: loadXFromStore(localArr) — Promise<number|null>, swap content + re-render
3. Optimistic mutation: mutate local trước, persistX(id, patch) fire-and-forget Supabase
4. Khi supabaseEnabled === false → tất cả persist là no-op, demo flow KHÔNG đổi
```
- `assets/app.js` — **Sentry lazy-loader top-of-IIFE** (load CDN bundle nếu DSN có, init kèm beforeSend tag user role/email từ `mh-user`, skip nếu DSN trống → 0 network call). Theme toggle (CSS-driven pill switch), mobile nav, toast, copy helpers, Profile editor modal, **header profile chip** (`#header-profile-chip`) toggle + populate. Functions: `refreshProfileChip(user)`, `refreshHeaderChip(user)`, `syncChipFromUser()`, `openProfileModal()`.
- `assets/logo.png` — Resized brand logo, 256×256, ~13 KB.

---

## 4. Auth & Roles

Session key: `localStorage['mh-user']`.

```json
{
  "role": "admin",
  "name": "Mai Phương",
  "email": "admin@cb.vn",
  "initials": "MP",
  "title": "Admin · Account Lead",
  "avatar": "",
  "phone": "",
  "department": "",
  "bio": ""
}
```

Profile fields (set via Profile modal từ header profile chip → Hồ sơ cá nhân):

- `avatar`: data URL JPEG ≤ 256px, render qua `.avatar.has-img > img`. Trống = fallback initials.
- `phone`, `department`, `bio`: free text (department có datalist 7 chi nhánh).
- Role chỉ Admin được đổi (select); các role khác readonly badge.

Demo accounts, password `cb2026`:

| Email | Role | Redirect sau login |
|---|---|---|
| `admin@cb.vn` | admin | `dashboard.html` |
| `account@cb.vn` | account | `dashboard.html` |
| `design@cb.vn` | design | `dashboard.html` |
| `editor@cb.vn` | editor | `dashboard.html` |
| `client@cb.vn` | client | `client-dashboard.html` |

Important nuances:

- design/editor lưu là `role: "design"` và `role: "editor"`. Dùng `design,editor` không dùng `staff` trong filter.
- Client bị block Internal Dashboard → redirect `client-dashboard.html`.
- `login.html` hỗ trợ `?redirect=<page>` param: sau login sẽ redirect về trang gốc (dùng bởi `order-form.js` để bảo toàn draft).
- Unknown valid email = admin để demo nhanh.

Auth guard pattern (internal pages):

```js
let user;
try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
if (!user || !user.role) { location.replace('login.html'); return; }
document.body.setAttribute('data-user', user.email);
document.body.setAttribute('data-user-role', user.role);
```

Auth guard pattern (`request.html` — order form):

```js
const AUTH_USER = (() => { try { return JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch(e) { return null; } })();
// validate() → blocks submit if !AUTH_USER
// doSubmit() → injects requester_id/email/name/department vào order payload
// redirect to login.html?redirect=request.html nếu chưa login + bảo toàn draft
```

---

## 5. Navigation

### Internal Header Layout

```text
[Hamburger] [Logo/Brand]    ←→    [Theme Toggle][Notification Bell][User Profile ▾]
```

- **Theme toggle**: pill switch `(.theme-toggle-switch[data-theme-toggle])`, CSS-driven.
- **User Profile**: `#header-profile-chip` — avatar + name + role badge. Click → dropdown gồm: Hồ sơ cá nhân (→ openProfile modal), Cài đặt (→ `settings.html`), Đăng xuất.
- **No "Tạo Order" button** trong header — đã remove. Button này chỉ còn trong page content.

### Internal Sidebar

```text
Vận hành
├── Master Dashboard
├── Orders Dashboard       admin/account  (was "Order Dashboard")
├── Task Dashboard         (page subtitle: "Internal Work Dashboard")
├── Order Form             admin/account (design/editor blocked)
├── Client Orders          admin/account  (was "Database Orders"; file: database-orders.html)
├── Internal Task Tracker  (was "Task Tracker"; file: production-board.html; page H1: "Internal Task Tracker / Task Tracker · Production Board")
└── Reports                admin/account
    (Delivery Log đã GỠ 2026-06-03 — bàn giao Preview/Final link nằm trong Order drawer của Client Orders)

Hệ thống
├── AI Tools            all internal roles
├── Chatbot             all internal roles
├── User Management     admin
└── Settings            admin

[bottom]
CB Creative Flow
v1.0
```

Sidebar bottom: App version block (thay thế profile card cũ).

### Public Header Layout

```text
[Logo/Brand]    [nav links]    [Theme Toggle][Đăng nhập (red pill)]
```

- Không còn "Gửi yêu cầu" CTA pill trong header public.
- Login button: `.btn-login-pill` — gradient đỏ `#BA110F → #E53935`, `border-radius: 9999px`.

Role visibility trong internal sidebar dùng `data-show-roles`:

```css
body [data-show-roles] { display: none; }
body[data-user-role="admin"] [data-show-roles*="admin"] { display: revert; }
```

---

## 6. Data Conventions

IDs:

- Orders: `MEDIA-YYYY-NNNN`
- Tasks: `TASK-NNNN`
- Deliveries: `DLV-YYYY-NNNN`
- Users: `USR-NNNN`

Status keys:

- Account: `pending`, `checking`, `needinfo`, `confirmed`, `rejected`
- Production: `pending`, `received`, `inprogress`, `review`, `revision`, `feedback_wait`, `feedback_fix`, `ready`, `delivered`, `completed`, `paused`, `cancelled`
- Delivery: `waiting`, `need_rev`, `ready`, `preview`, `client_wait`, `client_rev`, `final`, `rated`, `completed`, `reopened`, `cancelled`

Production progress:

```text
pending 20% → received 30% → inprogress 50% → review 65%
→ revision 75% → feedback_wait 80% → feedback_fix 85%
→ ready 90% → delivered 95% → completed 100%
paused/cancelled = 0%
```

Demo date anchor:

- `database-orders.js`, `production-board.js`, `delivery-log.js`: `new Date('2026-05-13')`
- `reports.js`: `today = new Date('2026-05-13')`

People/departments reused across modules:

- PIC/account names: Duy, Vinh, Linh Chi, Hậu, Mai Phương, Đức Anh.
  - ⚠ `tasks.assigned_to` lưu **tên ngắn** ("Duy") nhưng `mh-user.name` của account là **tên đầy đủ** ("Duy Trần"). `production-board.js isMyTask(assignedTo)` (2026-06-02) match user↔task: bằng nhau HOẶC full name chứa tên PIC theo word-boundary. **Đừng dùng `=== user.name` hay `.split(' ').pop()`** (lấy nhầm chữ cuối → design/editor không thấy task của mình). Task chỉ tạo khi **Push → Production** (assigned_to = order.production_pic).
- Departments: HO Marketing, Academic, Sales, CB Mekong, CB Hưng Phú, CB Cần Thơ, CB Tiên Thủy.

---

## 7. Common UI Patterns

Toast:

```js
window.MH.toast({
  type: 'success' | 'error' | 'info' | 'warning',
  title: 'Title',
  message: 'Body',
  duration: 4000
});
```

Profile modal:

```js
window.MH.openProfile(); // mở profile editor modal
```

Header Profile Chip (DOM):

```html
<div class="header-profile-chip" id="header-profile-chip" tabindex="0">
  <span class="avatar" id="hpc-avatar">MP</span>
  <div class="header-pc-info">
    <span class="header-pc-name" id="hpc-name">Mai Phương</span>
    <span class="role-badge r--admin header-pc-role" id="hpc-role-badge">Admin</span>
  </div>
  <svg class="header-pc-chevron">...</svg>
  <div class="header-profile-menu" id="header-profile-menu">
    <a href="#" class="hpm-item" id="hpm-profile">Hồ sơ cá nhân</a>
    <a href="settings.html" class="hpm-item" data-show-roles="admin">Cài đặt</a>
    <div class="hpm-divider"></div>
    <button class="hpm-item hpm-danger" id="logout-btn">Đăng xuất</button>
  </div>
</div>
```

`app.js` handles: toggle (`is-open` class), populate (`refreshHeaderChip(user)`), Hồ sơ link → `openProfileModal()`.

Drawer pattern:

```html
<div class="drawer-backdrop" id="drawer-backdrop"></div>
<aside class="drawer" id="xxx-drawer" aria-hidden="true">
  <div class="drawer-head"></div>
  <div class="drawer-actions"></div>
  <div class="drawer-body"></div>
</aside>
```

Detail row (drawer body — dùng div/span, không dùng dl/dt/dd vì browser default gây layout vỡ):

```html
<div class="detail-row">
  <span class="detail-dt">Label</span>
  <span class="detail-dd">Value</span>
</div>
```

Tables:

- `.table-card`, `.table-head`, `.table-wrap`, `.data-table`
- `.sortable[data-sort]`, `.pagination`

Badges:

- `.tb-status.s--<key>`
- `.priority-pill.p--normal|urgent|critical`
- `.role-tag-badge.rt--admin|account|staff|client|manager`
- `.user-status.us--active|pending|inactive|suspended|archived`
- `.rating-stars`, `.star-input`

---

## 8. localStorage Keys

| Key | Purpose |
|---|---|
| `mh-theme` | Theme: `light` / `dark` |
| `mh-user` | Current user session |
| `mh-order-draft-v2` | Order Form autosave draft |
| `mh-submitted-orders` | Orders submitted via request.html (demo, max 50) |
| `mh-settings` | Settings panel state |
| `mh-settings-activity` | Settings activity log, last 50 |
| `mh-ai-usage-log` | AI Tools usage log demo, last 50 |
| `mh-ai-saved-outputs` | AI output save demo, last 50 |
| `mh-chatbot-history` | Chatbot message history demo, last 80 |
| `mh-chatbot-feedback` | Chatbot Good/Bad feedback demo, last 50 |
| `mh-extra-tasks` | Tasks tạo mới qua Task Tracker hoặc "Create Task from Order" (cross-page demo, last 100). Mỗi entry có shape giống TASKS[] trong production-board.js, gồm `is_standalone: bool` + optional `order_id`. |

---

## 8b. Dashboard KPI Drilldown

Mỗi KPI card trong `dashboard.html` có `data-card-key` + click handler → redirect tới module tương ứng với `?dl=<card_key>`:

```text
total_orders / new_requests / brief_need_info / completed → database-orders.html
in_production / internal_review / due_soon / overdue / on_time_rate → production-board.html
ready_for_delivery / average_rating / rating_coverage → delivery-log.html
```

Target page reads `?dl=...` → set `state.view` / `state.quick` → render → inject `.drilldown-banner` (label + count + "Xóa filter") trước `.table-card` → smooth-scroll vào table.

Dashboard **Alert Center** dùng cùng cơ chế nhưng kèm `&id=MEDIA-*`: 6 button "Xem" → link tới module + drilldown filter + record ID. Destination module sau khi render thử `find(record matches id)` → `openDrawer` nếu có, toast warning nếu là placeholder demo không tồn tại trong mock data.

## 8d. Order ↔ Task ↔ Delivery relationship

```text
Order  (client/branch submits brief — lives in Database Orders)
  └── Task[]  (internal work item — Task Tracker / Production Board)
        └── Delivery (preview/final — Delivery Log)
```

- Order = client/branch request (`MEDIA-YYYY-NNNN`).
- Task = internal work assigned to Media team (`TASK-NNNN`). One Order → many Tasks.
- Task linkage:
  - `order_id`: nếu task gắn order, ID dạng `MEDIA-*`.
  - `is_standalone: true`: task nội bộ độc lập, không gắn order. Vẫn xuất hiện trong Task Tracker; quick-filter "Standalone".
- Client never sees Tasks; Task Tracker và Task Dashboard chỉ có role admin/account/design/editor.
- Cross-page bridge: tasks tạo mới qua Task Tracker hoặc "Create Task from Order" lưu vào `localStorage['mh-extra-tasks']`. Cả `production-board.js` và `database-orders.js` đều đọc storage này để hiển thị lẫn nhau.
- "Create Task from this Order" trong Database Orders drawer → redirect `production-board.html?createTask=1&order_id=...&project_name=...&task_type=...&priority=...&internal_deadline=...&production_pic=...&content=...` → auto-mở Create Task modal có prefill.

## 8f. Dashboard KPI groups (Modules 3+4)

Cả 3 dashboard (Master / Orders / Task) đều load real-time từ Supabase qua `MH.store`. **Orders Dashboard** chỉ đọc `orders.list()` (NEVER tasks). **Task Dashboard** chỉ đọc `tasks.list()` (NEVER orders). **Master Dashboard** parallel fetch cả 2.

### Orders Dashboard (`order-dashboard.html`) — 13 KPI + 6 breakdowns

- **Order Intake** (5): `total_orders` / `new_requests` (pending) / `checking` / `brief_need_info` (needinfo) / `confirmed` (confirmed && !completed)
- **Production Flow** (3): `in_production` (received/inprogress/revision/feedback_fix) / `ready_for_delivery` (production_status=ready) / `delivered`
- **Feedback & Completion** (5): `waiting_feedback` (delivery_status preview/client_wait/client_rev) / `rated_orders` (satisfaction_score>0) / `average_rating` (no drilldown) / `completed` (production_status=completed) / `cancelled_orders` (account=rejected OR production=cancelled)
- **Breakdowns**: by branch (`data-branch`), type (`data-type`), priority (`data-priority`), account PIC (`data-account-pic`), production status (`data-prod-status`), delivery status (`data-delivery-status`)
- **Drilldown** → `database-orders.html?dl=KEY` via `DRILLDOWN_MAP` 12 keys (matched với `matchesView()` switch trong database-orders.js).

### Task Dashboard (`task-dashboard.html`) — 17 KPI + 6-PIC workload + 2 breakdowns

- **Task Volume** (4): `total_tasks` / `linked_tasks` (order_id && !is_standalone) / `standalone_tasks` (is_standalone OR !order_id) / `new_internal_tasks` (status=pending)
- **Workload** (1 KPI + chart): `unassigned_tasks` (!assigned_to && isOpenStatus) + **Workload by PIC** 6-member bar chart (Duy/Vinh/Linh Chi/Hậu/Đức Anh/Mai Phương, MAX_PER_PIC=8, bar đỏ khi overload)
- **Deadline** (3): `due_today` (diffDays=0) / `due_this_week` (diffDays ∈ [0,7]) / `overdue` (deadline past)
- **Production Status** (6): `status_pending` (=pending) / `in_production` (received/inprogress/revision/feedback_fix) / `internal_review` (=review) / `status_revision` (=revision) / `status_completed` (=completed/delivered) / `status_blocked` (=paused)
- **Performance** (3): `on_time_rate` (= completed / (completed + overdue) * 100) / `completed_this_week` (completed && last_update ≥ NOW-7d) / `avg_completion_time` (avg days created_at → last_update, no drilldown)
- **Drilldown** → `production-board.html?dl=KEY` via `DRILLDOWN_MAP` 15 keys (`state.quick` switch trong production-board.js).

### Master Dashboard (`dashboard.html`) — separated combined view

- Module 5 refine (2026-05-22): Master Dashboard remains combined, but no ambiguous mixed KPI row. Layout is now 4 sections:
  - **Client Orders Overview**: Total Client Orders / Active Client Orders / Need More Info / In Production / Delivered / Waiting Feedback / Completed / Cancelled.
  - **Internal Tasks Overview**: Total Internal Tasks / Active Internal Tasks / Standalone Tasks / Linked Tasks / Due Today / Overdue / Unassigned / Completed This Week.
  - **Alerts**: Client Orders waiting brief info, Client Orders waiting feedback, overdue internal tasks, unassigned internal tasks, high priority tasks/orders.
  - **Team Workload**: tasks by PIC, overdue by PIC, workload pressure threshold MAX_PER_PIC=8.
- Drilldown pattern preserved: visible Module 5 KPI cards use `data-card-key` plus optional `data-drill-key` to route to supported target filters in `database-orders.html` / `production-board.html`.
- **Cleanup 2026-05-22**: 5 legacy hidden blocks REMOVED (~302 lines): old mixed KPI grid + Workflow Health pipeline + Production Status donut + Delivery Funnel + Recent Activity. `loadMasterDashboard()` bỏ 18 dbSetKpi calls dead (legacy keys không còn card target). Loader giờ gọn: `renderModule5Dashboard(O, T)` + Workload by PIC. dashboard.html từ 1138 → 774 lines. Git history giữ rollback.

### Helper functions (inline mỗi dashboard)

- `setKpi(cardKey, val)` — update `.kpi[data-card-key=X] .kpi-value`
- `updateBars(attr, countsMap)` — update bar rows + widths theo max
- `parseDate(s)`, `diffDaysFromNow(d)`, `isOverdueD(d, isCompleted)`, `isCompletedStatus(s)`, `isOpenStatus(s)`

### Why separate Orders vs Task Dashboard?

- Orders = client-facing lifecycle (brief → confirm → produce → deliver → rate)
- Tasks = internal workload (assigned, deadline, on-time rate, who's overloaded)
- Mixing 2 flow tạo confusion. Master Dashboard mới là combined view.

---

## 8e. Internal Task Tracker (Production Board) formalization

- Page H1: `Internal Task Tracker / Task Tracker · Production Board`. Sidebar label: `Internal Task Tracker`. File path vẫn `production-board.html` (no rename, per Module 1 acceptance).
- Page head có button `[+ Giao việc nội bộ]` (gắn `#btn-create-task`). Mở Create Task modal trong cùng page.
- Quick filter chips trên toolbar (`#quick-filter-chips`): Tất cả · Due Today · Due This Week · Overdue · Unassigned · My Tasks · **Standalone Internal**. Lưu trong `state.quickChip`. Khác với summary card `data-quick` (giữ nguyên).
- **Create / Edit Task modal `#task-modal` (Module 2 refactor, 5/2026)**:
  - Modal title default "Giao việc nội bộ mới" (create) / "Sửa công việc nội bộ" (edit).
  - **Radio group "Loại công việc"** (`name="tm-worktype"`) thay cho old checkbox `#tm-standalone`. 2 option:
    - `value="linked"` (default, `#tm-worktype-linked`): Liên kết với Client Order → hiển thị `#tm-order-row` để nhập MEDIA-* code.
    - `value="standalone"` (`#tm-worktype-standalone`): Công việc nội bộ độc lập → ẩn order row, hiện `#tm-standalone-hint` info card "ℹ Công việc này không liên kết với Client Order nào."
  - Save validation: linked option BẮT BUỘC nhập order_id (warning toast nếu trống). Standalone không cần.
  - Prefill từ URL params (`?createTask=1&order_id=...&project_name=...&task_type=...&priority=...&internal_deadline=...&production_pic=...&content=...&standalone=1`) hoặc edit task → set radio đúng theo `is_standalone`.
  - Save mới tạo `TASK-NNNN` (auto-increment dựa trên max TASK ID), push vào TASKS + `mh-extra-tasks` + Supabase `tasks` table.
  - JS helper: `applyWorktypeUI(isStandalone)`, `isWorktypeStandalone()`.
- Edit Task: drawer head sẽ chèn dynamic `[Sửa công việc]` button cho admin/account hoặc P.I.C của task. Mở modal trong edit mode.
- **Drawer "Loại công việc" block** (rename từ "Linked Order"):
  - Nếu task có `order_id && !is_standalone` → badge `.worktype-badge--linked` (navy "Linked to Client Order") + linked-order-card với order_id + project + "Mở Order" button → `database-orders.html?id=<order_id>`.
  - Nếu `is_standalone || !order_id` → badge `.worktype-badge--standalone` (red "Standalone Internal Task") + giải thích "Công việc nội bộ độc lập — KHÔNG gắn Client Order...".

## 8c. Comment system (Production Board)

Task drawer comment thread hỗ trợ @mention + Reply:

- **@mention**: gõ `@` trong textarea → dropdown filter realtime 6 team members + current user. Keyboard nav (↑/↓/Enter/Tab/Esc). Tên có chip `.mention` style khi render. `parseMentions(text)` → array of names. Names có dấu cách (Mai Phương, Linh Chi, Đức Anh) chỉ pick từ dropdown — không gõ tay được.
- **Reply**: button "Reply" mỗi comment (hidden cho đến khi hover) → set `replyingToId` → banner trên composer hiển thị "@Author — snippet" + nút × cancel. Submit → comment có `reply_to` (parent id), render indented (`.is-reply` class).
- **Comment object shape** (`task.comments[]`): `{ id, author, text, time, type, mentions[], reply_to, reply_to_author }`. Existing comments backfill id qua `ensureCommentIds` khi mở drawer.
- **Reply indicator**: comment con có badge "Reply tới @Author" — click scroll smooth tới parent + outline glow 1.4s.
- Data lưu in-memory trong `TASKS[].comments`. Reload mất.

---

## 9. Known Decisions

- Brand colors are CB Centres navy `#191970` and red `#BA110F`; do not revert to indigo/violet.
- Original logo was huge; current `assets/logo.png` is resized for web.
- Dark mode needs explicit fallback for gradient text when text disappears.
- User rejected count-up animation for trust strip; only use count-up where explicitly requested.
- Validation rules to preserve:
  - User Management: no duplicate email, do not deactivate the only admin.
  - Database Orders: push to Production requires confirmed brief + PIC + internal deadline + deliverable.
  - Production Board: PIC cannot directly complete/ready without required link.
  - Delivery Log: Send Final requires checklist 8/8 and final link.
  - Settings: do not delete statuses currently used by data.
- `<dl>/<dt>/<dd>` trong drawer body gây layout vỡ (browser default CSS); thay bằng `<div>/<span class="detail-dt/detail-dd">`.
- Profile chip đã được move từ sidebar bottom lên header right. Sidebar bottom dùng App version block đơn giản.
- `#logout-btn` ID nằm trong `.header-profile-menu` và được xử lý bởi từng page JS riêng.
- `app.js` handle toggle cho `#header-profile-chip`; page JS files không cần tự xử lý toggle nữa.
- **Business model — 2 operational flows (5/2026 clarification + Module 1 UI naming)**: Hệ thống có 2 luồng vận hành SEPARATE:
  - **(1) Client Orders**: requests từ client/branch/department submit qua `request.html`. Lifecycle đầy đủ: receive brief → check brief → request more info → confirm brief → production → delivery → feedback/rating → completed/cancelled. Mô hình data: `public.orders` table, mỗi row có `requester_id` link `auth.users`. Quản lý qua **Client Orders** (`database-orders.html` — sidebar label "Client Orders") + **Orders Dashboard** (`order-dashboard.html`).
  - **(2) Internal Tasks**: work items nội bộ Leader/Admin/Account assign trực tiếp cho Media team. Có thể link với 1 Client Order (`order_id`) HOẶC standalone (`is_standalone=true`, no order_id) cho admin/internal workstream. Mô hình data: `public.tasks` table. Quản lý qua **Internal Task Tracker** (`production-board.html` — sidebar label "Internal Task Tracker") + **Task Dashboard** / Internal Work Dashboard (`task-dashboard.html`). **Client KHÔNG được thấy data này** — RLS chặn DB level + role guard client-side redirect role=client → `client-dashboard.html`.
  - **Dashboard mapping (đã wire 21/5)**: Master Dashboard = combined orders + tasks; Orders Dashboard = ONLY orders; Task Dashboard = ONLY tasks.
  - **UI label changes (Module 1, 5/2026)**: KHÔNG rename files/routes. Chỉ update text trong sidebar `<span>`, page `<h1>`, `<title>`, meta description, và JS user-visible strings (toast/chatbot reply/action buttons). File paths giữ nguyên: `database-orders.html`, `production-board.html`, `order-dashboard.html`, `task-dashboard.html`.
- **Dashboard data wiring pattern (5/2026)**: 3 dashboard pages (`dashboard.html`/`order-dashboard.html`/`task-dashboard.html`) inline async `loadXDashboard()` IIFE: (1) await `MH.supabaseReady` (2) parallel fetch `MH.store.orders.list()` + `MH.store.tasks.list()` (3) compute KPI + counts (4) update DOM qua `data-card-key` / `data-pipe` / `data-pic` / `data-branch` / `data-type` / `data-link` attributes. Khi Supabase off → console.warn + UI giữ 0 (no breakage). Helper: `dbIsOverdue(deadline, isCompleted)`, `dbIsDueSoon(deadline, isCompleted)` (48h window), `dbIsCompleted(status)` (status === 'completed' || 'delivered'). Pattern này KHÔNG động database-orders.js/production-board.js (đã có write-through), chỉ wire read-only dashboards.
- **AI Voice TTS engine evaluation (5/2026)** — Supertonic giữ làm production target chính sau khi đánh giá 3 alternative đều fail web compatibility:
  - **VietCloneVoice** (github.com/pvlong19911-cmyk/VietCloneVoice): Windows `.exe` binary, không có WASM/JS port → cần Windows server backend. Loại.
  - **OmniVoice** (github.com/k2-fsa/OmniVoice): PyTorch model, 600+ language support nhưng không có ONNX/WASM export, cần GPU + Python backend. Loại.
  - **sherpa-onnx** (github.com/k2-fsa/sherpa-onnx) + Piper VN models: WASM build có thể chạy on-device thật, có 3 Vietnamese Piper model (`vais1000-medium` 63MB, `25hours_single-low` 20MB, `vivos-x_low` 10MB). NHƯNG yêu cầu build emscripten + cmake local + bundle 75-80MB first load + phá nguyên tắc zero-build. Defer làm Phase 3 task riêng.
  - → Kết luận: giữ Supertonic spec (10 preset M1-M5/F1-F5, 16 ngôn ngữ gồm `vi`, expression tags). Demo runtime Web Speech API tiếp tục là placeholder. Khi nào sẵn sàng build pipeline thật → swap.
- **Web Speech API Vietnamese voice limitation**: `window.speechSynthesis` chỉ có giọng Việt nếu OS đã cài. Windows 10/11 KHÔNG ship vi-VN voices default — cần `Settings → Time & Language → Speech → Add voices → Vietnamese`. Edge browser có thể truy cập Microsoft cloud neural voices (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`) khi online. Chrome/Firefox phụ thuộc OS voice. Khi không có vi voice → `getVoices().filter(v.lang.startsWith('vi'))` rỗng → code fallback sang voice tiếng Anh đầu tiên → đọc Tiếng Việt sai phonetic. Diagnostic snippet: `window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('vi'))`.

---

## 10. Completed MVP & Production Work

AI Tools:

- `ai-tools.html` + `assets/ai-tools.js` built from spec 09.
- 13 mini apps, category tabs/search, role permission, dynamic forms, CB brand preset, mock generation, copy/export/save demo and usage log.
- **AI Voice (Supertonic)** — category `voice`. Engine: github.com/supertone-inc/supertonic (ONNX, ~99M params, 44.1kHz). Demo runtime: Web Speech API (`window.speechSynthesis`). Preset M1-M5/F1-F5, 16 ngôn ngữ, expression tags. Voice Player UI có waveform animation + Play/Pause/Stop + Export SSML. Production handoff: SSML preserve expression tags để swap backend giữ format.

Chatbot:

- `chatbot.html` + `assets/chatbot.js` built from spec 10.
- Dedicated page: suggested prompts by role, context panel, chat thread, safe actions, feedback, history clear.
- Floating widget injected on internal/public pages khi có user session.

Client Portal:

- `client-dashboard.html` + `assets/client-dashboard.js` built from spec 11.
- Gồm: greeting, order status cards, order list, order detail drawer, notification panel, profile.
- Auth guard: chỉ `role === 'client'`; admin/staff bị redirect sang `dashboard.html`.
- Order Form (`request.html`) có auth guard: block submit nếu chưa login, auto-fill requester info, lock email, inject identity vào payload, lưu vào `mh-submitted-orders`, preserve draft trước khi redirect đăng nhập.

Nice-to-have production work:

- Replace inline mock data with backend APIs.
- Implement real auth and password validation.
- Implement real upload/storage.
- Replace simulated notification/test connection flows.
- Replace `window.print()` PDF export if real server/client export is needed.

---

## 11. `check_update` Protocol

When user types `check_update`:

1. Compare actual root/assets files with README and this file.
2. Check `STATUS.md` file sizes and module statuses.
3. Scan `localStorage` keys in JS and update section 8 if needed.
4. Confirm whether new modules/files exist that aren't documented.
5. Update `Last updated` in `_hot.md` and `STATUS.md`.
6. Report the sync summary in 1-2 lines.

---

## 12. `sync_task` Protocol

When user types `sync_task`:

1. Update `STATUS.md`: Completed Modules description (nếu thay đổi feature), File Inventory (KB), Changelog (thêm entry ngày hôm nay).
2. Update `_hot.md`: bất kỳ section nào phản ánh thay đổi về convention, token, role, file map, known decisions.
3. Update `README.md`: nếu có file mới, role mới, hoặc thay đổi về deploy/stack.
4. Cập nhật `Last updated` trong cả 3 file.
5. Báo tóm tắt 1–2 dòng: file nào đã cập nhật và nội dung thay đổi chính.

---

*End of _hot.md*
