# _hot.md — AI Agent Quick-Load Context

> Đọc file này trước khi sửa project. Nó chứa context ngắn để agent/dev mới tiếp quản đúng style, đúng convention.
>
> *Last updated: 2026-05-14 · Project state: MVP demo · 10/10 internal modules done*

---

## 1. TL;DR

**CB Media Hub / CB Creative Flow** là Creative Service Portal cho **CB Centres**.

- Static multi-page site: 15 HTML pages, 12 JS files, 1 shared CSS, zero build.
- Workflow chính: Order Form → Database Orders → Production Board → Delivery Log → Reports.
- Brand: navy `#191970` + red `#BA110F`, Inter / Plus Jakarta Sans + Playfair italic accent.
- Done: 6 public pages + 10 internal modules, gồm AI Tools MVP và Chatbot MVP.
- Pending: không còn pending module MVP; phần còn lại là backend/production integration.
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

---

## 3. File Map

### Public Pages

| File | Purpose | JS |
|---|---|---|
| `index.html` | Homepage + hero + quick actions | inline |
| `login.html` | Login + 5 demo account tiles | inline |
| `request.html` | Order Form 7 sections | `order-form.js` |
| `tracking.html` | Client tracking by `MEDIA-*` code | inline |
| `deliveries.html` | Client deliverables view | inline |
| `help.html` | FAQ + search + accordion | inline |

### Internal Pages

| File | Roles | JS |
|---|---|---|
| `dashboard.html` | admin, account, design, editor | inline |
| `database-orders.html` | admin, account | `database-orders.js` |
| `production-board.html` | admin, account, design, editor | `production-board.js` |
| `delivery-log.html` | admin, account | `delivery-log.js` |
| `reports.html` | admin, account | `reports.js` |
| `ai-tools.html` | admin, account, design, editor | `ai-tools.js` |
| `chatbot.html` | admin, account, design, editor | `chatbot.js` |
| `user-management.html` | admin | `user-management.js` |
| `settings.html` | admin | `settings.js` |

Shared assets:

- `assets/styles.css` — design tokens, components, page styles.
- `assets/app.js` — theme toggle, mobile nav, toast, copy helpers.
- `assets/logo.png` — resized brand logo, 256×256, ~13 KB.

---

## 4. Auth & Roles

Session key: `localStorage['mh-user']`.

```json
{
  "role": "admin",
  "name": "Mai Phương",
  "email": "admin@cb.vn",
  "initials": "MP",
  "title": "Admin · Account Lead"
}
```

Demo accounts, password `cb2026`:

| Email | Role | Tag |
|---|---|---|
| `admin@cb.vn` | admin | Manager |
| `account@cb.vn` | account | Account |
| `design@cb.vn` | design | Design |
| `editor@cb.vn` | editor | Editor |
| `client@cb.vn` | client | Client |

Important nuance: design/editor are stored as `role: "design"` and `role: "editor"` in `login.html`. Some specs call them "Staff", but code-level role filters should use `design,editor`, not `staff`.

Client demo account redirects to `tracking.html`, is blocked from Dashboard/internal modules, and can test scoped codes `MEDIA-2026-0001` / `MEDIA-2026-0008`. Unknown valid email defaults to admin for demo convenience.

Auth guard pattern:

```js
let user;
try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
if (!user || !user.role) { location.replace('login.html'); return; }
document.body.setAttribute('data-user', user.email);
document.body.setAttribute('data-user-role', user.role);
```

Restricted pages add role checks and redirect to `dashboard.html` or public tracking for Client with a toast.

---

## 5. Navigation

Internal sidebar groups:

```text
Vận hành
├── Dashboard
├── Order Form
├── Database Orders     admin/account
├── Production Board
├── Delivery Log        admin/account
└── Reports             admin/account

Hệ thống
├── AI Tools            all internal roles
├── Chatbot             all internal roles
├── User Management     admin
└── Settings            admin
```

Role visibility uses `data-show-roles`. Keep the CSS specificity rule:

```css
body [data-show-roles] { display: none; }
body[data-user-role="admin"] [data-show-roles*="admin"] { display: revert; }
```

AI Tools sidebar links point to `ai-tools.html`. Chatbot sidebar links point to `chatbot.html`, and `assets/chatbot.js` injects a floating assistant on pages that load it when a user session exists.

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

Use this anchor for deterministic overdue/due-soon behavior.

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

Drawer pattern:

```html
<div class="drawer-backdrop" id="drawer-backdrop"></div>
<aside class="drawer" id="xxx-drawer" aria-hidden="true">
  <div class="drawer-head"></div>
  <div class="drawer-actions"></div>
  <div class="drawer-body"></div>
</aside>
```

Detail block:

```html
<section class="drawer-block">
  <div class="drawer-block-head"><span class="block-letter">A</span><h4>Section name</h4></div>
  <dl><dt>Label</dt><dd>Value</dd></dl>
</section>
```

Tables:

- `.table-card`
- `.table-head`
- `.table-wrap`
- `.data-table`
- `.sortable[data-sort]`
- `.pagination`

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
| `mh-settings` | Settings panel state |
| `mh-settings-activity` | Settings activity log, last 50 |
| `mh-ai-usage-log` | AI Tools usage log demo, last 50 |
| `mh-ai-saved-outputs` | AI output save demo, last 50 |
| `mh-chatbot-history` | Chatbot message history demo, last 80 |
| `mh-chatbot-feedback` | Chatbot Good/Bad feedback demo, last 50 |

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

---

## 10. Completed MVP & Production Work

AI Tools:

- `ai-tools.html` + `assets/ai-tools.js` built from spec 09.
- Includes 12 mini apps, category tabs/search, role permission, dynamic forms, CB brand preset, mock generation, copy/export/save demo and usage log.
- Static MVP uses a local mock generator; real backend later should replace generate/save/log with `/api/ai-tools/*`.

Chatbot:

- `chatbot.html` + `assets/chatbot.js` built from spec 10.
- Dedicated page includes suggested prompts by role, context panel, chat thread, safe action links, history clear and feedback.
- Floating widget is injected on internal/public pages that load `assets/chatbot.js` when a user session exists.
- Static MVP supports process FAQ, order/task lookup with role checks, missing brief guidance, content generation handoff to AI Tools, report summary for admin/account and navigation help.
- Real backend later should replace mock order/task data and enforce record ownership/data scope.

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
4. Confirm whether AI Tools/Chatbot specs or files now exist.
5. Update `Last updated` in `_hot.md` and `STATUS.md`.
6. Report the sync summary in 1-2 lines.

---

*End of _hot.md*
