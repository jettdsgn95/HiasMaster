# Phase 1 — Add Content Role & Permission

## Project Context

Project: **CB Creative Flow / CB Media Hub**  
Current architecture: static multi-page site, zero-build, vanilla HTML/CSS/JS.  
Current workflow before this phase:

```text
Client submits Order
→ Account checks brief
→ Account confirms brief
→ Account pushes to Production
→ Task Tracker handles internal production
→ Preview/Final handled inside Order Drawer
→ Client Portal handles client confirmation, feedback, rating
```

New business rule:

```text
Content Wording is now a mandatory gate before Account can Confirm Brief and Push to Production.
```

This phase only introduces the **Content role** and permission structure. Do not implement the full wording workflow yet.

---

## Goal

Add a new internal role:

```text
content
```

The Content role is responsible for future brief wording tasks. At this phase, the system only needs to recognize this role, allow correct routing, show correct navigation, and restrict access properly.

---

## Scope

### In scope

- Add role `content` to the user/session role system.
- Add demo account for Content if demo users are currently hardcoded.
- Allow Content to access internal dashboard layout.
- Add sidebar menu placeholder for `Content Wording`.
- Redirect Content user to `content-workbench.html` if this page exists, or to `dashboard.html` temporarily if not yet created.
- Restrict Content from admin-only pages.
- Ensure existing roles still work: Admin, Account, Design, Editor, Client.

### Out of scope

- Do not build Content Wording Drawer yet.
- Do not change production workflow yet.
- Do not change Client Portal yet.
- Do not change notification flow yet except if needed to avoid errors.
- Do not touch Delivery Log. Delivery Log was removed and must not be restored.

---

## Suggested Files to Review / Update

Depending on current implementation, likely files:

```text
login.html
assets/app.js
assets/data-store.js
assets/user-management.js
user-management.html
dashboard.html
order-dashboard.html
task-dashboard.html
database-orders.html
production-board.html
reports.html
ai-tools.html
chatbot.html
settings.html
```

If sidebar/nav is duplicated across pages, update each relevant internal page consistently.

---

## Role Permission Matrix

| Page / Module | Admin | Account | Content | Design | Editor | Client |
|---|---:|---:|---:|---:|---:|---:|
| Public pages | Yes | Yes | Yes | Yes | Yes | Yes |
| Client Portal | No | No | No | No | No | Yes |
| Master Dashboard | Yes | Yes | Yes | Yes | Yes | No |
| Database Orders | Yes | Yes | Optional read-only / limited | No or limited | No or limited | No |
| Content Wording | Yes | Yes | Yes | No | No | No |
| Task Tracker | Yes | Yes | Optional read-only | Yes | Yes | No |
| Reports | Yes | Yes | Optional | Optional | Optional | No |
| AI Tools | Yes | Yes | Yes | Yes | Yes | No |
| Chatbot | Yes | Yes | Yes | Yes | Yes | No |
| User Management | Yes | No | No | No | No | No |
| Settings | Yes | No | No | No | No | No |

Recommended for this phase:

```text
Content can access dashboard.html and future content-workbench.html.
Content cannot access user-management.html or settings.html.
Client still cannot access internal dashboard.
```

---

## Demo Account

If demo accounts are hardcoded, add:

```text
Email: content@cb.vn
Role: Content
Tag: Content
Display name: Content Team
Redirect after login: content-workbench.html if available, otherwise dashboard.html
```

If the current shared demo password is still used:

```text
Cbmedia2026
```

Do not expose passwords in UI if the current system already removed hardcoded password tiles.

---

## UI Requirements

### Sidebar

Add menu item under internal operations group:

```text
Content Wording
```

Suggested route:

```text
content-workbench.html
```

If the page does not exist yet, the menu can be hidden until Phase 3, or shown as disabled with label:

```text
Content Wording — Coming soon
```

Recommended: add route now but create a minimal placeholder page only if needed to prevent broken links.

### Header Profile

Ensure role badge displays:

```text
Content
```

Avatar must remain circular.

---

## Access Guard Rules

Implement or update a shared helper if possible:

```js
const INTERNAL_ROLES = ['admin', 'account', 'content', 'design', 'editor'];
const ADMIN_ONLY_ROLES = ['admin'];
const ACCOUNT_ADMIN_ROLES = ['admin', 'account'];
const CONTENT_WORKFLOW_ROLES = ['admin', 'account', 'content'];
```

Rules:

```text
If role = client → redirect away from internal pages to client-dashboard.html.
If role = content and page is user-management.html/settings.html → block and redirect to dashboard.html or content-workbench.html.
If role = content → allow internal shell, notification bell, profile, AI/chatbot if currently allowed for internal users.
```

---

## Acceptance Criteria

- Content role can log in successfully.
- Content role is recognized in `mh-user` or Supabase user metadata.
- Content role sees internal layout, not Client Portal layout.
- Content role does not access admin-only pages.
- Admin/Account/Design/Editor/Client flows remain unchanged.
- Sidebar does not break on any internal page.
- No existing navigation item becomes duplicated or broken.
- No Delivery Log page/link is restored.

---

## Test Cases

### Test 1 — Content login

```text
Login as content@cb.vn
Expected:
- Login succeeds.
- User is routed to content-workbench.html if available, otherwise dashboard.html.
- Header profile shows Content role.
```

### Test 2 — Content blocked from Settings

```text
Login as content@cb.vn
Open settings.html manually
Expected:
- Access is blocked.
- User is redirected to dashboard.html or content-workbench.html.
- No sensitive settings UI is shown.
```

### Test 3 — Client still blocked from internal pages

```text
Login as client@cb.vn
Open dashboard.html manually
Expected:
- Client is redirected to client-dashboard.html.
```

### Test 4 — Existing roles unchanged

```text
Login as admin/account/design/editor/client
Expected:
- Existing redirects and permissions still work.
```

---

## Dev / Claude Prompt

```text
You are updating the CB Creative Flow static web app.

Read README.md, _hot.md, and STATUS.md first. Preserve the current architecture: static multi-page HTML/CSS/vanilla JS, zero build, no React/Tailwind/npm conversion.

Task: Implement Phase 1 — Add Content Role & Permission.

Business context:
- A new internal role `content` will be responsible for mandatory brief wording in later phases.
- This phase only adds role recognition, login/redirect behavior, sidebar/menu permission, and access guard rules.
- Do not implement the wording workflow yet.
- Do not change Production flow yet.
- Do not restore Delivery Log.

Requirements:
1. Add role `content` to the role/session/user management system.
2. Add demo user if demo users are hardcoded:
   - email: content@cb.vn
   - role: content
   - tag: Content
   - display name: Content Team
   - redirect: content-workbench.html if available, otherwise dashboard.html.
3. Allow `content` to access internal pages required for future Content Wording work.
4. Block `content` from admin-only pages such as user-management.html and settings.html.
5. Add a sidebar/menu item named `Content Wording` for route `content-workbench.html`. If the page does not exist yet, make the item hidden, disabled, or safely non-breaking.
6. Keep Client role isolated in client-dashboard.html and blocked from all internal pages.
7. Preserve all existing role behavior for admin/account/design/editor/client.
8. Do not change Delivery Log references or restore removed delivery-log files.

Acceptance criteria:
- Content can log in and see internal shell.
- Content cannot access admin-only pages.
- Client still cannot access internal pages.
- Existing roles still work.
- No broken sidebar/header/profile behavior.
- No production or client confirmation workflow changes in this phase.
```
