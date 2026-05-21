# _hot.md — AI Agent Quick-Load Context

> Đọc file này trước khi sửa project. Nó chứa context ngắn để agent/dev mới tiếp quản đúng style, đúng convention.
>
> *Last updated: 2026-05-21 · Project state: Production-ready beta · Supabase Phase 1+2 LIVE · Realtime push enabled · **Full demo data cleared (operations)** · Cancel-order modal flow · Railway deploy LIVE ✓*

---

## 1. TL;DR

**CB Media Hub / CB Creative Flow** là Creative Service Portal cho **CB Centres**.

- Static multi-page site: 17 HTML pages, 11 JS files, 1 shared CSS, zero build.
- **2 khu vực riêng biệt**: Internal Dashboard (admin/account/design/editor) và Client Portal (client).
- Workflow chính: Order Form → Database Orders → Production Board → Delivery Log → Reports.
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
| `delivery-log.html` | admin, account | `delivery-log.js` |
| `reports.html` | admin, account | `reports.js` |
| `ai-tools.html` | admin, account, design, editor | `ai-tools.js` |
| `chatbot.html` | admin, account, design, editor | `chatbot.js` |
| `user-management.html` | admin | `user-management.js` |
| `settings.html` | admin | `settings.js` |

### Shared Assets

- `assets/styles.css` — Design tokens, components, page styles. Gồm `.header-profile-chip`, `.theme-toggle-switch`, `.sidebar-version-block`, `.btn-login-pill`, `.auth-gate-bar`.
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
├── Order Dashboard     admin/account
├── Task Dashboard
├── Order Form          admin/account (design/editor blocked)
├── Database Orders     admin/account
├── Task Tracker        (sidebar label; page H1: "Task Tracker / Production Board")
├── Delivery Log        admin/account
└── Reports             admin/account

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

## 8e. Task Tracker (Production Board) formalization

- Page H1 hiển thị: `Task Tracker / Production Board`. Sidebar label: `Task Tracker`. File path vẫn `production-board.html` (không rename file ở task này).
- Page head có button `[+ Tạo Task]` (gắn `#btn-create-task`). Mở Create Task modal trong cùng page.
- Quick filter chips hàng trên toolbar (`#quick-filter-chips`): Tất cả · Due Today · Due This Week · Overdue · Unassigned · My Tasks · Standalone. Lưu trong `state.quickChip`. Khác với summary card `data-quick` (giữ nguyên).
- Create Task modal (`#task-modal`): hỗ trợ standalone checkbox (ẩn order_id row), prefill order_id/project/type/priority/deadline/pic/content/status. Save mới tạo `TASK-NNNN` (auto-increment dựa trên max TASK ID), push vào TASKS + `mh-extra-tasks`.
- Edit Task: drawer head sẽ chèn dynamic `[Sửa Task]` button cho admin/account hoặc P.I.C của task. Mở modal trong edit mode.
- Linked Order block trong drawer: hiển thị order_id + project_name + button "Mở Order" → `database-orders.html?id=<order_id>`. Nếu task `is_standalone`, hiển thị note "Standalone internal task — không gắn Order".

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
