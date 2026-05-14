# STATUS.md — Module Progress Tracker

> Tracker tiến độ CB Media Hub. Cập nhật sau mỗi task có thay đổi module/file/progress, hoặc khi user gõ `check_update`.
>
> *Last updated: 2026-05-14*

---

## Quick View

| # | Module | Status | Files | Spec |
|---|---|:---:|---|---|
| 0 | Public site | Done | `index`, `request`, `tracking`, `deliveries`, `help`, `login` | [page spec](../Brief%20Wflow/media-hub-page-module-spec.md) |
| 1 | Master Dashboard | Done | `dashboard.html` | [01](../Brief%20Wflow/CB_Creative_Flow_Master_Dashboard_Module.md) |
| 2 | Order Form | Done | `request.html`, `order-form.js` | [02](../Brief%20Wflow/CB_Creative_Flow_02_Order_Form_Module.md) |
| 3 | Database Orders | Done | `database-orders.html`, `database-orders.js` | [03](../Brief%20Wflow/CB_Creative_Flow_03_database_orders_module.md) |
| 4 | Production Board | Done | `production-board.html`, `production-board.js` | [04](../Brief%20Wflow/CB_Creative_Flow_04_production_board_module.md) |
| 5 | Delivery Log | Done | `delivery-log.html`, `delivery-log.js` | [05](../Brief%20Wflow/CB_Creative_Flow_05_delivery_log_module.md) |
| 6 | Reports | Done | `reports.html`, `reports.js` | [06](../Brief%20Wflow/CB_Creative_Flow_06_reports_module.md) |
| 7 | User Management | Done | `user-management.html`, `user-management.js` | [07](../Brief%20Wflow/CB_Creative_Flow_07_user_management_module.md) |
| 8 | Settings | Done | `settings.html`, `settings.js` | [08](../Brief%20Wflow/CB_Creative_Flow_08_settings_module.md) |
| 9 | AI Tools | Done | `ai-tools.html`, `ai-tools.js` | [09](../Brief%20Wflow/CB_Creative_Flow_09_ai_tools_module.md) |
| 10 | Chatbot | Done | `chatbot.html`, `chatbot.js` | [10](../Brief%20Wflow/CB_Creative_Flow_10_chatbot_module.md) |
| 11 | API Flow docs page | Removed | — | [api flow](../Brief%20Wflow/media-hub-api-flow-spec.md) |

**Overall**: 10/10 internal modules done · 6/6 public pages done · 0 module pending.

---

## Completed Modules

### 0. Public Site

Status: Done

- `index.html`: hero, quick actions, workflow, tracking lookup, deliveries preview, FAQ, support strip.
- `login.html`: 5 demo account tiles, click-to-login, password show/hide, internal users redirect Dashboard, Client redirects public tracking.
- `request.html`: 7-section order form, conditional service sub-forms, autosave, preview, success state.
- `tracking.html`: search by `MEDIA-2026-*` code, client-scope guard, mock order timeline, progress, feedback modal.
- `deliveries.html`: deliverables grid/list, filters, 9 mock items.
- `help.html`: FAQ sections, search, scroll-spy, contact card.

### 1. Master Dashboard

Status: Done

- Role-aware sidebar/nav/profile.
- 12 KPI cards, filters, refresh, role-based visibility.
- Workflow health, alert center, workload, production status, SLA gauge, delivery funnel, recent activity.
- Quick Actions panel with role filters.

### 2. Order Form

Status: Done

- 7 sections A-G: requester, brief, request type, content, assets, deadline, confirm.
- Sticky stepper and submit bar.
- Service tiles and deliverables by type.
- Video/Quay/Photo/Ads conditional sections.
- Upload simulation with max-size validation.
- Priority logic, wording warning, autosave to `mh-order-draft-v2`, preview modal.

### 3. Database Orders

Status: Done

- Saved views, search, filters, sortable table, pagination.
- Detail drawer with request, brief, internal management, delivery summary, push validation, activity log.
- Drawer actions: Check, Need Info, Confirm, Push to Production, Cancel.
- Push validation: confirmed brief, PIC, deadline, active status, deliverable.
- 18 mock orders.

### 4. Production Board

Status: Done

- Views: Table, Kanban, My Tasks.
- Default view by role: admin/account table; design/editor task-focused.
- Summary cards, filters, table columns, drag-drop Kanban.
- Drag/status validation, link requirements for Ready.
- Task drawer with files, links, actions, metadata and comments.
- 16 mock tasks.

### 5. Delivery Log

Status: Done

- Summary cards, toolbar filters, delivery table.
- Detail drawer A-F: order/task, files/links, delivery control, feedback/rating, checklist, activity log.
- Action modals: Send Preview, Send Final, Request Revision, Submit Rating.
- Send Final requires checklist 8/8 and final link.
- Reopen flow and 10 mock deliveries.

### 6. Reports

Status: Done

- 12 KPI cards and 5 report filters.
- 6 custom charts: trend, distribution donut, role bars, PIC stacked bars, heatmap, quality grid.
- Delivery funnel, rating distribution, SLA gauge.
- PIC KPI table, overdue risk table, feedback table.
- CSV export and browser print PDF.

### 7. User Management

Status: Done

- Summary cards, filters, user table.
- Detail drawer: profile, role/permission, module access, assigned work, activity, security.
- Create/Edit modal with validation and permission preview.
- Safeguards: unique email, cannot deactivate only admin, warns on open tasks.
- 14 mock users and CSV export.

### 8. Settings

Status: Done

- 12 panels: General, Workflow Status, SLA, Notifications, Brand, AI Tools, Chatbot, Files & Drive, Departments, Client Portal, Reports & Export, Security.
- Per-panel Save/Cancel, localStorage persistence.
- Test connection mocks, reset defaults, export JSON.
- Settings Activity Log in `mh-settings-activity`.

### 9. AI Tools

Status: Done

- Built from `CB_Creative_Flow_09_ai_tools_module.md`.
- `ai-tools.html` provides category tabs, search, tool cards, workspace form, brand preset, output panel and usage log.
- `assets/ai-tools.js` includes 12 mini apps: Post Generator, Ads Copy, Caption Builder, Brief Optimizer, Missing Info Checker, Visual Prompt, Video Concept, Slide Outline, Campaign Idea, Hashtag/CTA, Tone Adjuster, Summarizer.
- Role permission by tool for admin/account/design/editor; client access is blocked in this static demo.
- Mock generation with CB guardrails, copy, regenerate, export markdown, feedback, save-to-order/task demo.
- Demo persistence: `mh-ai-usage-log`, `mh-ai-saved-outputs`.
- Sidebar AI Tools links now point to `ai-tools.html` across internal pages.

### 10. Chatbot

Status: Done

- Built from `CB_Creative_Flow_10_chatbot_module.md`.
- `chatbot.html` provides dedicated assistant page with suggested prompts, context panel, chat thread, safe actions, feedback and history clear.
- `assets/chatbot.js` injects floating CB Assistant widget on internal/public pages when a user session exists.
- Supports process guidance, order/task status lookup demo, brief missing-info guidance, content-generation handoff to AI Tools, report summary and navigation help.
- Permission checks are simulated by role for admin/account/design/editor/client.
- Demo persistence: `mh-chatbot-history`, `mh-chatbot-feedback`.
- Sidebar Chatbot links now point to `chatbot.html` across internal pages.

---

## Pending Modules

No pending MVP modules. Remaining work is production integration: backend APIs, real auth, real data scope, storage/upload, AI provider and notification workflows.

---

## File Inventory

Build total: 15 HTML pages · 10 JS files · 1 CSS file · 1 logo asset.

| File | KB |
|---|---:|
| `assets/styles.css` | 187.9 |
| `request.html` | 63.7 |
| `assets/database-orders.js` | 54.2 |
| `assets/delivery-log.js` | 53.2 |
| `dashboard.html` | 51.8 |
| `assets/production-board.js` | 49.2 |
| `settings.html` | 47.4 |
| `assets/user-management.js` | 43.5 |
| `assets/ai-tools.js` | 30.5 |
| `assets/reports.js` | 28.4 |
| `reports.html` | 24.8 |
| `index.html` | 24.1 |
| `assets/settings.js` | 24.0 |
| `user-management.html` | 23.4 |
| `assets/order-form.js` | 20.7 |
| `assets/chatbot.js` | 20.6 |
| `production-board.html` | 20.0 |
| `tracking.html` | 21.5 |
| `database-orders.html` | 17.5 |
| `delivery-log.html` | 15.8 |
| `help.html` | 15.0 |
| `ai-tools.html` | 14.1 |
| `login.html` | 14.7 |
| `deliveries.html` | 13.3 |
| `assets/logo.png` | 13.0 |
| `chatbot.html` | 9.1 |
| `assets/app.js` | 23.0 |

---

## Changelog

| Date | Module | Action |
|---|---|---|
| 2026-05-12 | Public site | Built initial 6 pages and brand setup |
| 2026-05-13 | Public site | Rebrand to navy `#191970` + red `#BA110F`, pill buttons, serif accents |
| 2026-05-13 | Dashboard/Auth | Built dashboard, demo accounts, role-based UI |
| 2026-05-14 | Order Form | Rebuilt to 7-section v2 spec |
| 2026-05-14 | Database Orders | Added full table, drawer, push-to-production flow |
| 2026-05-14 | Production Board | Added table/Kanban/My Tasks, drag-drop, status transitions |
| 2026-05-14 | Delivery Log | Added drawer, checklist, send preview/final flows |
| 2026-05-14 | Reports | Added KPI, custom charts, tables, export |
| 2026-05-14 | User Management | Added user CRUD UI, permissions, validation |
| 2026-05-14 | Settings | Added 12 settings panels, workflow editor, activity log |
| 2026-05-14 | AI Tools | Built module 09 MVP with 12 mini apps, mock generation, usage log |
| 2026-05-14 | Chatbot | Built module 10 MVP with dedicated page, floating widget, lookup, history |
| 2026-05-14 | Auth | Added Client demo account and client-role redirect/guard |
| 2026-05-14 | Tracking | Synced public tracking demo with `MEDIA-*` Order Data codes and client scope |
| 2026-05-14 | Handoff docs | Created README, `_hot.md`, `STATUS.md` |
| 2026-05-14 | Handoff docs | Optimized README, `_hot.md`, `STATUS.md` for clarity and maintainability |
| 2026-05-14 | Handoff docs | `check_update`: synced JS count 12→10, `tracking.html` 19.0→21.5 KB, `chatbot.js` 20.5→20.6 KB |
| 2026-05-14 | Auth/Profile | Added editable Profile modal in `app.js` (Hồ sơ menu): edit name/initials/title, auto-avatar, persists to `mh-user`, refreshes profile chip live across all internal pages |
| 2026-05-14 | Auth/Profile | Extended Profile modal: avatar image upload (auto-resize 256px, JPEG 85%), phone/department/bio fields, role select gated to Admin only, chip avatar img sync on page load |
| 2026-05-14 | Dashboard | KPI cards click-through drilldown: 12 cards mapped to Orders/Production/Delivery via `?dl=<card_key>` URL; target modules apply view/quick filter on load, show drilldown banner with count + Xóa filter, scroll to table. Spec: `Master_dashboard_clickthrough_drilldown.md` (Option B MVP) |
| 2026-05-14 | Deploy | Added `package.json` + `railway.json` for Railway deploy via Nixpacks + `serve` package. Root Directory phải set = `Portal Hub/CB_Creative_Flow` trong Railway dashboard |

---

## check_update Protocol

When user types `check_update`:

1. Verify root/assets file map and file sizes.
2. Check `localStorage` keys in JS against `_hot.md`.
3. Check auth guards and role visibility assumptions.
4. Confirm whether AI Tools/Chatbot specs or files now exist.
5. Update `Last updated` in `_hot.md` and `STATUS.md`.
6. Report the sync summary clearly.

---

*End of STATUS.md*
