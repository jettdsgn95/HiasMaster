# STATUS.md — Module Progress Tracker

> Tracker tiến độ CB Media Hub. Cập nhật sau mỗi task có thay đổi module/file/progress, hoặc khi user gõ `check_update`.
>
> *Last updated: 2026-05-15 · Project state: MVP demo · 11/11 modules done*

---

## Quick View

| # | Module | Status | Files | Spec |
|---|---|:---:|---|---|
| 0 | Public site | Done | `index`, `request`, `tracking`, `help`, `login` | [page spec](../Brief_Wflow/media-hub-page-module-spec.md) |
| 1 | Master Dashboard | Done | `dashboard.html` | [01](../Brief_Wflow/CB_Creative_Flow_Master_Dashboard_Module.md) |
| 2 | Order Form | Done | `request.html`, `order-form.js` | [02](../Brief_Wflow/CB_Creative_Flow_02_Order_Form_Module.md) |
| 3 | Database Orders | Done | `database-orders.html`, `database-orders.js` | [03](../Brief_Wflow/CB_Creative_Flow_03_database_orders_module.md) |
| 4 | Production Board | Done | `production-board.html`, `production-board.js` | [04](../Brief_Wflow/CB_Creative_Flow_04_production_board_module.md) |
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

### 1. Master Dashboard

Status: Done

- Role-aware sidebar, header chip, KPI cards with drilldown.
- 12 KPI cards with `?dl=<card_key>` click-through: maps to Orders/Production/Delivery modules, target applies view/filter on load, shows drilldown banner, scrolls to table.
- Workflow health, alert center, workload, production status, SLA gauge, delivery funnel, recent activity.
- Quick Actions panel with role-based visibility.

### 2. Order Form

Status: Done

- 7 sections A–G: requester, brief, request type, content, assets, deadline, confirm.
- Sticky stepper and submit bar.
- Service tiles and deliverables by type (Video/Quay/Photo/Ads conditional sections).
- Upload simulation with max-size validation.
- Priority logic, wording warning, autosave to `mh-order-draft-v2`, preview modal.
- Auth guard: inject requester identity into order payload, lock email field, preserve draft on redirect.

### 3. Database Orders

Status: Done

- Saved views, search, filters, sortable table, pagination.
- Detail drawer: request info, brief, internal management, delivery summary, push validation, activity log.
- Drawer actions: Check, Need Info, Confirm, Push to Production, Cancel.
- Push validation: confirmed brief + PIC + internal deadline + deliverable + active status.
- 18 mock orders.

### 4. Production Board

Status: Done

- Views: Table, Kanban, My Tasks.
- Default view by role: admin/account → table; design/editor → task-focused.
- Summary cards, filters, sortable table, drag-drop Kanban.
- Drag/status validation, link requirement for Ready/Delivered transitions.
- Task drawer: files, links, actions, metadata, comments.
- 16 mock tasks.

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
- 12 mini apps: Post Generator, Ads Copy, Caption Builder, Brief Optimizer, Missing Info Checker, Visual Prompt, Video Concept, Slide Outline, Campaign Idea, Hashtag/CTA, Tone Adjuster, Summarizer.
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

Build total: **15 HTML pages · 11 JS files · 1 CSS file · 1 logo asset**.

| File | KB |
|---|---:|
| `assets/styles.css` | 199.0 |
| `request.html` | 64.3 |
| `assets/production-board.js` | 60.7 |
| `assets/database-orders.js` | 54.7 |
| `assets/delivery-log.js` | 53.8 |
| `dashboard.html` | 52.2 |
| `settings.html` | 49.1 |
| `assets/user-management.js` | 42.8 |
| `assets/client-dashboard.js` | 36.5 |
| `client-dashboard.html` | 30.6 |
| `assets/ai-tools.js` | 30.5 |
| `assets/reports.js` | 27.7 |
| `reports.html` | 26.4 |
| `assets/order-form.js` | 26.3 |
| `user-management.html` | 25.0 |
| `assets/app.js` | 24.3 |
| `assets/settings.js` | 23.3 |
| `production-board.html` | 21.6 |
| `tracking.html` | 21.0 |
| `assets/chatbot.js` | 21.0 |
| `database-orders.html` | 18.8 |
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
