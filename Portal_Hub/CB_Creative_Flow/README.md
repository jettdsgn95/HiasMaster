# CB Media Hub — Creative Service Portal

**CB Creative Flow** là MVP demo cho team **CB Centres** quản lý workflow Media từ tiếp nhận brief → sản xuất → bàn giao → đánh giá.

Project hiện là static multi-page site, không framework, không build step. Mục tiêu chính: cho stakeholder duyệt UI/UX và luồng nghiệp vụ trước khi nối backend/API thật.

---

## Quick Start

```text
1. Mở index.html bằng browser.
2. Click "Đăng nhập".
3. Nhập email demo (bảng dưới) + mật khẩu, đăng nhập qua Supabase.
```

Mật khẩu demo chung: `Cbmedia2026` _(tiles demo + password cứng đã gỡ khỏi login.html vì bảo mật — đăng nhập thủ công qua Supabase auth)_

| Email | Role | Tag | Tên hiển thị | Redirect sau login |
|---|---|---|---|---|
| `admin@cb.vn` | Admin | Manager | Mai Phương | `dashboard.html` |
| `account@cb.vn` | Account | Account | Hậu Nguyễn | `dashboard.html` |
| `design@cb.vn` | Design | Design | Duy Trần | `dashboard.html` |
| `editor@cb.vn` | Editor | Editor | Linh Chi | `dashboard.html` |
| `client@cb.vn` | Client | Client | Lan Anh | `client-dashboard.html` |

Role Content Team (tạo tay trong Supabase Auth + metadata `{name, role}` SAU khi chạy `add-content-role.sql` + `add-content-team.sql`):

| Role | Redirect sau login | Quyền chính |
|---|---|---|
| `lead_content` | `content-team.html` (Content Workspace) | Nhận request ở Content Inbox, gán PIC, đặt hạn wording, duyệt / trả chỉnh. **Từ 2026-07-06**: vào được `database-orders.html` chế độ **READ-ONLY** (nav "Client Orders · View only") — xem brief gốc/status/timeline/links + **comment nội bộ** (kênh riêng, client không thấy); mọi mutation nghiệp vụ bị khóa. ⚠ `add-lead-content-order-view.sql` |
| `content` | `content-workbench.html` (Content Wording) | Làm wording được gán, lưu nháp, **gửi Lead Content duyệt** |

Sidebar có nhóm **Content Team** riêng với 2 sub: *Content Workspace* (lead) · *Content Wording* (content); admin/account thấy cả hai.

Role **`system_supervisor`** ("Giám sát hệ thống") — GIÁM SÁT chỉ-đọc cấp hệ thống (redirect `dashboard.html`). Xem toàn bộ Orders / Tasks / Content Team / Calendar / Reports (kèm export) nhưng **mọi mutation bị khóa** (không confirm/push/assign/đổi status/drag/tạo-sửa task/bàn giao/duyệt wording/hủy đơn). Sidebar thấy mọi mục TRỪ Order Form / User Management / Settings. ⚠ chạy `supabase/add-system-supervisor.sql` (role check + SELECT-only RLS). Tạo user qua Supabase Auth metadata `{name, role:'system_supervisor'}`.

Role **`lead_media`** ("Lead Media") — **Trưởng nhóm Production**, quyền vận hành **NGANG Account**: Client Orders / Internal Task Tracker / 3 Dashboards / Reports / Order Form (push/confirm/gán PIC/hủy đơn/tạo-sửa-gán task/drag…). **KHÔNG** vào Content Team (Workspace + Wording) và **KHÔNG** Settings/User Management (admin-only). Cũng dùng **Strategy Board** (Supervisor Planning — nhận/giao/đề xuất kế hoạch). Login → **Master Dashboard**. Cơ chế: frontend alias `lead_media`→`account` cho check quyền (giữ `data-user-role='lead_media'` cho CSS/nav, KHÔNG lộ Content Team); RLS DB thấy role thật. ⚠ chạy **`supabase/add-media-lead-production.sql`** (thêm lead_media vào `is_staff()` + `is_admin_or_account()`) — sau `add-supervisor-planning.sql`. Tạo user qua Supabase Auth metadata `{name, role:'lead_media'}`.

Email hợp lệ khác sẽ được gán quyền Admin để demo nhanh toàn site. Client role có khu vực riêng biệt (`client-dashboard.html`), bị chặn khỏi Internal Dashboard.

---

## Current Scope

| Area | Status | Ghi chú |
|---|:---:|---|
| Public site | Done | `index`, `request`, `tracking`, `help`, `login`; homepage targets Nội bộ CB Centres + request smart flow stepper |
| Client Portal | Done | `client-dashboard.html` — xem orders, tracking, request, profile; **2 CTA riêng** (thiết kế/Media + chạy Ads) |
| Ads Orders (Client→Content) | Done | Luồng Ads campaign TÁCH khỏi Media/Production: `request.html?type=ads` (`ads-order-form.js`, form 5 section — không hỏi Creative) → order `order_kind='ads_order'` (prefix `ADS-2026-xxx`) → tab **Ads Orders** trong `content-team.html` (Lead Content: gán PIC · tách Content Tasks · tạo **Internal Media Request** `ADS-MEDIA-2026-xxx`). Client chỉ thấy public status. ⚠ `add-ads-orders.sql` |
| Internal ops | Done | Dashboard, orders, production, reports, AI, chatbot, users, settings; Order Workbench + Task Workbench drawers. _(Delivery Log đã gỡ 2026-06-03 — bàn giao Preview/Final trong Order drawer; Production Status order tự sync theo task.)_ **Reports wired LIVE 2026-06-12**: `reports.js` load orders/tasks/users qua `MH.store`, aggregate client-side, filters recompute thật, empty-state khi chưa có data, poll 60s. |
| Preview → Feedback → Final | Done | Bàn giao **trong Order drawer** (Client Portal đọc `orders.preview_link` / `orders.final_delivery_link`). Bàn giao đầu luôn là **"Preview"**; order **design** tối đa **03 vòng feedback** (Vòng 1 ~60% · Vòng 2 ~30% · Vòng 3 chỉ chỉnh nhỏ), **vòng 4** → ghi nhận thành task/order mới. Client có nút **"Duyệt Preview"**. Order drawer: **Order Lifecycle Timeline** (Brief → Production → Preview & Feedback → Final & Rating, display-only) + **"Gửi feedback cho PIC"** + **"Links from Task Tracker"** (Dùng làm Preview/Final — chỉ điền ô, không tự gửi). Task drawer hiện **Client Feedback Round N/3**. Chỉ Account/Admin gửi Preview/Final. Notif: `delivery_preview` · `client_feedback_received` · `client_preview_approved` · `delivery_final` · `rating_received`. SQL: `add-revision-rounds.sql` + `add-preview-approval.sql`. _(KHÔNG khôi phục Delivery Log; KHÔNG dùng bảng `deliveries`; KHÔNG lộ Task Tracker cho client.)_ |
| Calendar / Lịch | Done | `calendar.html` — Month/Week/Agenda. Chấm 4 loại sự kiện theo ngày: **Deadline Task** (`tasks.internal_deadline`) · **Deadline Order** (`orders.requested_deadline`) · **Lịch quay/chụp** (`shoot_date`, fallback parse `content_brief`) · **Bàn giao** (`delivery_date`/final). **Role-filtered**: admin/account thấy full; design/editor chỉ task mình PIC (`isMyTask`); content chỉ order đang wording. Read-only — click sự kiện → popover → mở `production-board.html?id=` / `database-orders.html?id=`. Nav inject qua `app.js injectCalendarNav()`. ⚠ cần `add-shoot-date.sql` để shoot_date lưu cột thật. |
| AI Tools | Done | 13 mini apps (gồm AI Voice / Supertonic on-device TTS), workspace form, output panel, usage log demo |
| Dashboards | Wired LIVE | **Master Dashboard** (Module 5 — 4 sections separated: Client Orders Overview 8 metrics / Internal Tasks Overview 8 metrics / Alerts 5 categories / Team Workload 6-PIC bar) · **Orders Dashboard** (13 KPI Client Order lifecycle: Intake / Production Flow / Feedback & Completion + 6 breakdowns) · **Task Dashboard** (17 KPI Internal workload: Volume / Workload / Deadline / Status / Performance + 6-PIC bar chart). Master Dashboard refresh button fetches Supabase again, polls every 60s, and listens to orders/tasks realtime when publication is enabled. Drilldown click-through tới database-orders.html / production-board.html với filter chính xác |
| Chatbot | Done | Dedicated page + floating widget trên internal/public pages khi đã login |
| Supervisor Planning | Done | `supervisor-planning.html` + `supervisor-planning.js` (sidebar **"Strategy Board"**) — Supervisor/Admin lập + giao **kế hoạch nội bộ** cho Lead Media / Content / **cả 2** (`both`), TÁCH BIỆT `tasks` production + wording. Bảng `lead_tasks` + đính kèm PDF/link; **tiến độ RIÊNG từng Lead** (lead_status); **cổng duyệt per-lane** (Lead "Nộp duyệt" Kế hoạch/Sản phẩm → Supervisor Duyệt / Trả chỉnh, lane completed chỉ khi Supervisor duyệt); **Lead chủ động đề xuất kế hoạch** (origin=lead → Supervisor Duyệt/Từ chối; mention Lead kia "nắm thông tin" read-only); **Drawer workspace cộng tác** (comment 2 chiều + activity timeline + checklist/progress); **List + Board kanban** (cột "Chờ duyệt"); notify 2 chiều + deep-link + realtime; role mới `lead_media`. ⚠ chạy `supabase/add-supervisor-planning.sql`. |
| AI Brand Safety Checker | Done (MVP) | `brand-check.html` + `assets/brand-check.js` (sidebar **"Brand Safety"**, mọi role nội bộ + **client/giáo viên tự kiểm** từ Client Portal → sidebar tối giản; banner kết luận `actionVerdict`: Nhóm 1/2 đạt = tự dùng, Nhóm 3 + ca rủi ro = bắt buộc Media duyệt) — kiểm duyệt hình ảnh AI theo checklist thương hiệu CB: upload JPG/PNG/WEBP ≤10MB + metadata (nhóm nội dung 1/2/3 + 7 quick flags) → AI Vision chấm 6 tiêu chí /100 điểm → **rule engine v2** (CHỈ Nhóm 3 ⇒ `REQUIRES_MEDIA_REVIEW`; Nhóm 1/2 status theo điểm — AI muốn Media xem chỉ thành `ai_warnings` khuyến nghị; **tag ĐÃ DUYỆT**: PASS Nhóm 1/2 auto-duyệt, mã duyệt = check_code, Media approve/thu hồi qua hậu kiểm) → lưu `brand_checks` + `brand_check_criteria` → drawer kết quả (điểm, tiêu chí, lỗi, hành động, override) + History (filter + CSV) + Dashboard hậu kiểm cho Media (admin/account/lead_media; supervisor read-only) + manual review (APPROVED/REVISION_REQUIRED/REJECTED/ARCHIVED + note + notify uploader). AI gọi qua **Supabase Edge Function `brand-check-analyze`** (API key trong secrets; provider env: Anthropic mặc định / OpenAI / Gemini); chưa deploy function → fallback `NEEDS_MANUAL_REVIEW`; Supabase off → chế độ DEMO mô phỏng. ⚠ chạy `add-brand-check.sql` + deploy Edge Function. Spec: [`../Brief_Wflow/CB_Brand_AI_Safety/`](../Brief_Wflow/CB_Brand_AI_Safety/CB_AI_Brand_Safety_Checker_Planning_Prompt_Claude.md) |
| Content Team Workspace | Done | `content-team.html` — team Content TÁCH BIỆT Production (role `lead_content` + `content`). Dashboard / Content Inbox (Lead) / **Content Plans** / **Content Initiatives** / Board Kanban 7 cột / Danh sách / My Content Tasks + Content Wording Drawer (Lifecycle · Assign PIC + hạn · Workspace · Quality Checklist · Lead Review · Files/Links · Activity). Flow: Account "Chuyển Content Wording" → Lead Inbox → gán PIC → Content làm → gửi Lead duyệt → (trả chỉnh ↺) → Account gửi Client xác nhận → Client duyệt → Confirm Brief & Push. Content/Lead bị chặn Task Tracker + Client Orders (redirect). `content-workbench.html` giữ làm legacy (status Content Team = read-only). ⚠ chạy `supabase/add-content-team.sql`. **Content Team Deep Workflow** (2026-06-18): Phase 1 nền data (3 namespace `contentPlans`/`contentTasks`/`contentTaskComments`, ⚠ `add-content-initiatives.sql`) + Phase 2 Lead Workspace (tab **Content Plans** plan cha + roll-up progress/status từ task con + Plan Drawer + tách task con gán PIC; tab **Content Initiatives** Lead chủ động tạo; Content Task Drawer follow/reassign + Missing Info/Assumptions/Risk — Lead KHÔNG trả brief về Account) + **Phase 3 PIC Workbench** (`content-workbench.html` tab "Content Tasks của tôi": PIC viết multi-output theo `output_types`, ghi Missing Info, tick Quality Checklist 9 mục, Production Handoff Draft nếu cần Media, **Gửi Lead Content duyệt** → `submitted_to_lead`; KHÔNG bypass Lead) + **Phase 4 Lead Review & Internal Revision** (Content Task Drawer ở content-team: Lead xem bản thảo + checklist + handoff + revision history, **Trả Content chỉnh** không giới hạn vòng (đếm `internal_revision_count` + `revision_history`, 14 lý do) hoặc **Duyệt** → định tuyến `lead_approved`/`submitted_to_account`/`completed` theo source/need_media + roll-up plan cha) + **Phase 5 Content→Media** (Lead bấm **Tạo Internal Media Request** trên task `lead_approved` cần Media → handoff modal → tạo order nội bộ `client_visible=false`/`order_kind=internal_media_request`/`origin=content_team` + link ngược `source_content_task_id`; badge "Internal · From Content" ở Database Orders; Client Portal lọc bỏ; ⚠ `add-content-to-media-order.sql`) + **Phase 6 Dashboard/Calendar/QA** (content-team Dashboard KPI Content Tasks/Plans + breakdowns + plans progress + high-revision; Calendar event Hạn Content Task/Plan role-filtered; docs). |

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
├── request.html          Order Form Media (stepper) + Ads 5-section (?type=ads)
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
├── content-workbench.html Content Wording (legacy solo flow)
├── content-team.html     Content Team Workspace — Dashboard / Inbox / Board / My Tasks (lead_content + content)
├── supervisor-planning.html Supervisor Planning — kế hoạch nội bộ Supervisor→Lead Media/Content (lead_tasks)
├── calendar.html         Lịch / Calendar — deadline task/order + lịch quay/chụp (role-filtered)
├── reports.html          KPI, charts, export
├── brand-check.html      AI Brand Safety Checker — kiểm duyệt hình ảnh AI theo brand CB
├── ai-tools.html         12 AI mini apps
├── chatbot.html          CB Assistant dedicated page
├── user-management.html  User CRUD (Admin only)
├── settings.html         System config (Admin only)
│
└── assets/
    ├── logo.png
    ├── styles.css            Design system, all page styles
    ├── app.js                Shared: theme, toast, profile modal, header chip
    ├── home-motion.js        index.html — GSAP motion (count-up, reveal, parallax)
    ├── order-form.js         request.html — Media form, auth guard, draft, flow progress
    ├── ads-order-form.js     request.html?type=ads — form Ads 6 section (Client → Content Team)
    ├── client-dashboard.js   client-dashboard.html — Client Portal logic
    ├── database-orders.js
    ├── production-board.js
    ├── content-workbench.js  Content Wording legacy
    ├── content-team.js       Content Team Workspace logic (roles, board, drawer, lead review)
    ├── supervisor-planning.js supervisor-planning.html — kế hoạch nội bộ (leadTasks CRUD, role-aware, drawer)
    ├── calendar.js              calendar.html — month/week/agenda, role-filtered events, popover→drawer
    ├── reports.js
    ├── brand-check.js        brand-check.html — upload/AI call/rule engine/history/dashboard/manual review
    ├── ai-tools.js
    ├── chatbot.js
    ├── user-management.js
    └── settings.js
```

Build hiện tại: **21 HTML pages (+5 trang demo/preview `_*.html` không tính) · 21 JS files · 1 CSS file · 1 logo asset · Supabase SQL migrations + 1 Edge Function** (AI Brand Safety Checker thêm 2026-07-03; Supervisor Planning thêm 2026-06-17; Content Team Workspace thêm 2026-06-11; Calendar/Lịch thêm 2026-06-08). (Delivery Log page removed 2026-06-03 — bàn giao link nay nằm trong Order drawer.)

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
11. [`add-shoot-date.sql`](supabase/add-shoot-date.sql) — orders/tasks.shoot_date + shoot_time (cho Calendar chấm lịch quay/chụp; order-form lưu media_date→shoot_date, push kế thừa sang task)
12. [`add-wording-deadline.sql`](supabase/add-wording-deadline.sql) — orders.wording_deadline (Hạn hoàn thành wording; Account đặt ở Order drawer, Content Wording hiển thị + tô đỏ khi trễ)
13. [`add-content-team.sql`](supabase/add-content-team.sql) — Content Team Workspace: role `lead_content` (users_role_check) + 3 status wording mới (`pic_assigned`/`submitted_to_lead`/`lead_revision`) + cột Lead review (`wording_lead_note`/`wording_lead_reviewed_at`/`wording_lead_reviewed_by`/`wording_submitted_to_lead_at`) + RLS lead_content SELECT orders/users + RPC `update_brief_wording` v2 (thêm lead_content, status mới, wording_deadline)
14. [`add-system-supervisor.sql`](supabase/add-system-supervisor.sql) — role `system_supervisor` (Giám sát hệ thống, monitor read-only): users_role_check += role + helper `is_system_supervisor()` + **SELECT-only** RLS orders/tasks/task_comments/users/deliveries/activity_log. KHÔNG đụng `is_staff()` (nó còn gate write). Chạy sau `rls.sql` + `add-content-team.sql`.
15. [`add-supervisor-planning.sql`](supabase/add-supervisor-planning.sql) — module Supervisor Planning: `users_role_check` += `lead_media` + bảng `lead_tasks` (id/title/description/**assigned_lead** (`lead_media`/`lead_content`/**`both`**)/status (tổng hợp)/**`lead_status` jsonb** (tiến độ RIÊNG từng Lead, gồm trạng thái `submitted`/`revision` của cổng duyệt)/**`checklist` jsonb**/**`lead_submissions` jsonb** (hồ sơ Lead nộp duyệt per-lane)/**`origin`** (supervisor/lead)/**`approval`** (approved/proposed/declined)/**`informed_leads` jsonb** (Lead mention "nắm thông tin")/priority/deadline/attachment_path/name/url/created_by/created_at/updated_at) + bảng **`lead_task_comments`** (kind comment/status/system/submit/review) + index + trigger + **bucket Storage `plan-files`** + RLS 2 bảng (supervisor/admin **ALL**; lead **SELECT/UPDATE/DELETE** dòng bucket mình incl `both`, comment thì SELECT+INSERT, **KHÔNG INSERT plan**) + storage policy + **Realtime** (lead_tasks + lead_task_comments) + RLS **lead INSERT đề xuất** (origin=lead, approval=proposed, bucket mình) + **informed SELECT** (Lead được mention đọc read-only). Chạy sau `rls.sql` + `add-system-supervisor.sql`.
16. [`add-media-lead-production.sql`](supabase/add-media-lead-production.sql) — Media Lead = quyền vận hành Production **ngang Account**: CREATE OR REPLACE `is_staff()` + `is_admin_or_account()` thêm `lead_media` (đọc orders/tasks + ghi task + quản lý order). KHÔNG đụng `is_admin()` (Settings/User Mgmt vẫn admin). Chạy sau `rls.sql` + `add-supervisor-planning.sql`.
17. [`add-content-initiatives.sql`](supabase/add-content-initiatives.sql) — **Content Team Deep Workflow Phase 1 (Foundation)**: 3 bảng mới `content_plans` (kế hoạch/campaign cha) + `content_tasks` (task con giao PIC Content — gồm Workspace multi-output, Missing Info/Assumptions, Revision history no-limit, Production Handoff Package) + `content_task_comments` (revision/comment/activity). `source` enum `client_order`/`content_initiated`/`strategy_board`/`campaign_package`. RLS Content-Team-only (admin full · lead_content full · content đọc-all + sửa task assigned_pic=mình · account đọc task source=client_order) — **KHÔNG đụng `is_staff()`** nên content/lead_content vẫn KHÔNG thấy Production tasks; client KHÔNG thấy. + index + trigger updated_at + Realtime. Chạy sau `rls.sql` + `add-content-team.sql`.
18. [`add-content-to-media-order.sql`](supabase/add-content-to-media-order.sql) — **Content Team Deep Workflow Phase 5 (Internal Media Request)**: thêm cột `orders.origin`/`order_kind`/`client_visible`(default true)/`source_content_task_id`/`source_content_plan_id`/`requester_role` + index + RLS **lead_content INSERT/UPDATE order nội bộ** (chỉ `order_kind='internal_media_request'` + `client_visible=false`). Cho phép Lead Content tạo Internal Media Request (order nội bộ KHÔNG lộ Client Portal) sau khi duyệt content. Chạy sau `add-content-initiatives.sql`.
19. [`add-ads-orders.sql`](supabase/add-ads-orders.sql) — **Ads Orders (Client → Content Team)**: cột `orders.owner_team`/`ads_status`/`ads_detail`(jsonb)/`source_ads_order_id` + index; `request_type` CHECK **+= `post`** (tile Media "Ads/Post Basic" đổi thành "Post"); `content_tasks.source` CHECK **+= `ads_order`**; RLS **lead_content UPDATE `ads_order`** + **lead_content/content INSERT `internal_ads_media_request`** (client_visible=false). Ads Order route thẳng Content Team, KHÔNG qua Account/Production; Internal Ads Media Request KHÔNG lộ Client Portal. Chạy sau `add-content-to-media-order.sql`.

20. [`add-brand-check.sql`](supabase/add-brand-check.sql) — **AI Brand Safety Checker**: bảng `brand_checks` (metadata + flags + ảnh + kết quả AI `ai_result_json` + override + manual review) + `brand_check_criteria` (điểm 6 tiêu chí) + RLS (mọi user INSERT/SELECT lượt của mình · admin/account/lead_media SELECT all + UPDATE hậu kiểm · system_supervisor SELECT all) + bucket Storage private **`brand-check-images`** (JPG/PNG/WEBP ≤10MB, path `{uploader_id}/{check_id}/…`, policy prefix `cbbrand_`) + Realtime. Chạy sau `rls.sql`. **Kèm Edge Function** [`functions/brand-check-analyze/`](supabase/functions/brand-check-analyze/index.ts): deploy `supabase functions deploy brand-check-analyze` + `supabase secrets set GEMINI_API_KEY=AIza...` (**provider mặc định = gemini**, model `gemini-2.5-flash` ép JSON qua `responseSchema` + nới safety; tùy chọn `BRAND_CHECK_MODEL`; đổi provider: `BRAND_CHECK_PROVIDER=openai`+`OPENAI_API_KEY` / `anthropic`+`ANTHROPIC_API_KEY`). Chưa deploy function → app fallback `NEEDS_MANUAL_REVIEW`; Supabase off → demo mô phỏng.

21. [`add-lead-content-order-view.sql`](supabase/add-lead-content-order-view.sql) — **Lead Content xem Client Orders (read-only + comment)**: cột `orders.lead_content_notes` (thread comment nội bộ, TÁCH `internal_note` vì internal_note lộ ra Client Portal khi needinfo) + RPC **`append_lead_content_order_note`** (SECURITY DEFINER — lead_content/admin, CHỈ append text kèm `[thời gian · tên · Lead Content]`, không đụng cột nghiệp vụ). Đọc orders của lead_content đã có sẵn (add-content-team.sql). Frontend: guard database-orders mở cho lead_content ở chế độ READONLY (cơ chế monitor của system_supervisor) + section "Comment Lead Content" trong Order drawer + nav "Client Orders · View only" + link "Mở Order gốc (chỉ xem)" từ Content Team + deep-link `?order=` alias. Chạy sau `add-content-team.sql`.

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
- **Feedback Round 3 = final feedback round of the current order.** Round 3 is STILL part of the current order — no new task/order is created immediately. Flow: Client submits Round 3 → Account forwards to PIC ("Gửi feedback vòng 3 cho PIC", task → `feedback_fix`) → PIC must provide **Final Link** (Task Tracker blocks the `review` transition without it at round 3) → Account/Admin sends **Final** from the Order Drawer (`feedback_status='final_sent'`) → Client rates or creates a **new order themselves** via `request.html?mode=revision&ref_order=ID`. Admin/Account must NOT create the new order for the Client. The new order is a normal Client Order (links back via `parent_order_id`/`order_origin`; optional migration `supabase/add-revision-link.sql`). Delivery Log stays removed; Preview/Final handoff stays inside the Order Drawer.

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
- [x] **Brief Wording flow (Content Role Phase 1→4)**: role `content` + Content Workbench + cổng bắt buộc wording + Client xác nhận brief trong Portal. ⚠ Chạy 3 migration theo thứ tự: `supabase/add-brief-wording-fields.sql` → `add-brief-wording-workspace-fields.sql` → `add-brief-wording-confirmation.sql` (để wording persist cross-user; chưa chạy thì fallback localStorage same-browser).
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

*Last updated: 2026-07-06 · **Ads client notify + lead_media order_new** — Ads lifecycle giờ báo client 3 nấc `running`/`completed`/`cancelled` (type `order_status_changed`, gọi trong `adsAdvance`; resume `paused`→`running` không re-notify); order mới từ client notify thêm role `lead_media` (ngang Account) · **Ads Orders** — luồng Client → Content Team (`request.html?type=ads` + `ads-order-form.js` + tab Ads Orders trong content-team + Internal Media Request `ADS-MEDIA-`; prefix `ADS-`/`MEDIA-`/`ADS-MEDIA-`; ⚠ `add-ads-orders.sql`) · Module **Supervisor Planning** (`supervisor-planning.html`+`.js`, bảng `lead_tasks`, role mới `lead_media`, ⚠ `add-supervisor-planning.sql`) · Role `system_supervisor` (Giám sát hệ thống) — monitor read-only toàn hệ thống (⚠ `add-system-supervisor.sql`) · Reports wired LIVE Supabase (module cuối cùng nối DB) + Content Team Workspace (role lead_content + content, content-team.html, ⚠ add-content-team.sql) + Workflow notifications khép kín + bàn giao trong Order drawer (Delivery Log gỡ) + order media Quay/Chụp gộp tách 2 task + Order Form rút gọn theo type + New Orders card*
