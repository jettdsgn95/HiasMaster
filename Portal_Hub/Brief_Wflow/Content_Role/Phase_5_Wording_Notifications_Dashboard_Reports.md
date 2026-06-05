# Phase 5 — Wording Notifications, Dashboard & Reports

## Project Context

Previous phases added:

```text
Phase 1: Content role
Phase 2: Mandatory wording gate
Phase 3: Content Workbench + Content Wording Drawer
Phase 4: Client wording confirmation
```

This phase completes operational visibility: notifications, dashboard cards, filters, and reporting metrics for Content Wording.

---

## Goal

Make the Content Wording workflow trackable end-to-end.

Add:

```text
Wording notifications
Dashboard metrics
Report metrics
Activity timeline improvements
Filter/drilldown support
```

---

## Scope

### In scope

- Add new notification types for wording workflow.
- Add icon mappings in `assets/notif-icons.js` only.
- Add notification producers/consumers where needed.
- Add dashboard cards for Content Wording status.
- Add filters/drilldowns for wording workload.
- Add report metrics for Content role performance.
- Add activity log entries for wording lifecycle.

### Out of scope

- Do not change the core wording workflow unless fixing bugs.
- Do not change production Preview/Final delivery logic.
- Do not restore Delivery Log.
- Do not expose internal notes to Client.

---

## Notification Types

Add these types:

```text
brief_wording_assigned
brief_wording_started
brief_wording_submitted
brief_wording_account_revision
brief_wording_sent_client
brief_wording_client_feedback
brief_wording_approved
brief_wording_completed
```

If the database has CHECK constraints on `notifications.type`, update the migration carefully and idempotently.

---

## Notification Matrix

| Event | Notification type | Receiver |
|---|---|---|
| Account transfers order to Content | `brief_wording_assigned` | Content PIC / Content team |
| Content starts wording | `brief_wording_started` | Account/Admin optional |
| Content submits wording to Account | `brief_wording_submitted` | Account/Admin |
| Account returns revision to Content | `brief_wording_account_revision` | Content PIC |
| Account sends wording to Client | `brief_wording_sent_client` | Client |
| Client requests wording changes | `brief_wording_client_feedback` | Account + Content PIC |
| Client approves wording | `brief_wording_approved` | Account + Content PIC |
| Account confirms brief after approval | `brief_wording_completed` | Content PIC optional |

---

## Notification Icon Rules

Current project uses shared notification icon module:

```text
assets/notif-icons.js
```

Rules:

```text
Do not create separate icon maps inside app.js or client-dashboard.js.
Do not add emoji to producer titles.
Add new icon paths/types only in notif-icons.js.
```

Suggested visual mapping:

| Type | Icon idea | Color class |
|---|---|---|
| `brief_wording_assigned` | document/edit | `is-accent` |
| `brief_wording_started` | pen line | neutral |
| `brief_wording_submitted` | send/check | `is-accent` |
| `brief_wording_account_revision` | rotate/revision | `is-danger` or warning |
| `brief_wording_sent_client` | send | `is-accent` |
| `brief_wording_client_feedback` | message/edit | warning |
| `brief_wording_approved` | check circle | success/accent |
| `brief_wording_completed` | clipboard check | success/accent |

---

## Notification Producer Requirements

Add notifications at these action points:

### Account transfers to Content Wording

```text
Action: Chuyển Content Wording
Notify: Content PIC / active Content users
Type: brief_wording_assigned
Link: content-workbench.html?id=<order_id>
```

### Content submits to Account

```text
Action: Gửi Account duyệt
Notify: active Account/Admin users
Type: brief_wording_submitted
Link: database-orders.html?id=<order_id>
```

### Account returns revision

```text
Action: Trả Content chỉnh
Notify: Content PIC
Type: brief_wording_account_revision
Link: content-workbench.html?id=<order_id>
```

### Account sends wording to Client

```text
Action: Gửi Client xác nhận Brief
Notify: Client requester
Type: brief_wording_sent_client
Link: client-dashboard.html?order=<order_id> or tracking fallback
```

### Client requests changes

```text
Action: Yêu cầu chỉnh brief
Notify: Account/Admin + Content PIC
Type: brief_wording_client_feedback
Link for Account: database-orders.html?id=<order_id>
Link for Content: content-workbench.html?id=<order_id>
```

### Client approves wording

```text
Action: Xác nhận brief
Notify: Account/Admin + Content PIC
Type: brief_wording_approved
Link for Account: database-orders.html?id=<order_id>
Link for Content: content-workbench.html?id=<order_id>
```

---

## Dashboard Requirements

### Master Dashboard

Add a Content Wording section or cards:

```text
Wording Pending
Wording In Progress
Waiting Account Review
Waiting Client Confirmation
Client Feedback
Wording Approved
```

Each card should drill down to the right page:

```text
content-workbench.html?dl=<key>
```

Suggested drilldown keys:

```text
wording_pending
wording_in_progress
wording_account_review
wording_client_review
wording_feedback
wording_approved
```

### Order Dashboard

Add order lifecycle metric:

```text
Orders waiting for Content Wording
Orders waiting for Client Wording Approval
Orders ready to Confirm Brief
```

### Task Dashboard

Do not mix Content Wording with production task workload unless the project decides Content Wording is a task type.

Recommended:

```text
Keep Content Wording metrics separate from production tasks.
```

---

## Reports Requirements

Add Content Wording report section:

```text
Content Wording Performance
```

Metrics:

```text
Total wording orders
Wording completed
Average wording turnaround time
Average client confirmation time
Average wording rounds
Client approval first-pass rate
Revision rate by Content PIC
Overdue wording tasks
```

Optional table:

```text
Content PIC
Assigned
Completed
In Progress
Client Feedback
Average Turnaround
First-pass Approval Rate
```

---

## Filters

Add filters where relevant:

```text
Wording status
Content PIC
Wording round
Waiting Account review
Waiting Client confirmation
Client feedback
```

---

## Activity Timeline Requirements

Ensure every key wording event is logged:

```text
Account transferred order to Content Wording
Content started wording
Content saved draft
Content submitted wording to Account
Account returned wording revision
Account sent wording to Client
Client requested wording changes
Content resubmitted wording
Client approved wording
Account confirmed brief
```

Activity log should be visible in:

```text
Content Wording Drawer
Order Drawer activity section
```

---

## Access / Privacy Rules

- Client only receives client-safe notifications and links.
- Client must never receive internal notes or Content Workbench URLs.
- Content should receive Content Workbench links.
- Account/Admin should receive Database Orders links.
- Use role-aware notification link resolution if the app already has this pattern.

---

## Acceptance Criteria

- All wording actions trigger correct notifications.
- Notification icons render from `assets/notif-icons.js`.
- No emoji is added to notification producer titles.
- Client notification opens Client Portal order drawer.
- Content notification opens Content Workbench drawer.
- Account notification opens Order Drawer.
- Master Dashboard shows wording counts.
- Reports include Content Wording performance section.
- Activity timelines reflect wording lifecycle.
- No Delivery Log is restored.
- Existing production notification flow remains unchanged.

---

## Test Cases

### Test 1 — Assigned notification

```text
Account clicks Chuyển Content Wording
Expected:
- Content receives brief_wording_assigned notification
- Clicking notification opens content-workbench.html?id=<order_id>
```

### Test 2 — Content submitted notification

```text
Content clicks Gửi Account duyệt
Expected:
- Account/Admin receives brief_wording_submitted notification
- Clicking opens database-orders.html?id=<order_id>
```

### Test 3 — Client confirmation notification

```text
Account clicks Gửi Client xác nhận Brief
Expected:
- Client receives brief_wording_sent_client notification
- Clicking opens Client Portal order drawer
```

### Test 4 — Client feedback notification

```text
Client requests wording revision
Expected:
- Account receives notification
- Content receives notification
- Content Workbench shows status client_feedback
```

### Test 5 — Client approval notification

```text
Client approves wording
Expected:
- Account receives approval notification
- Content receives approval notification
- Dashboard count updates
- Confirm Brief unlocks
```

### Test 6 — Dashboard drilldown

```text
Click Wording In Progress card
Expected:
- Opens content-workbench.html with corresponding filter
```

---

## Dev / Claude Prompt

```text
You are updating the CB Creative Flow static web app.

Read README.md, _hot.md, and STATUS.md first. Preserve the current static multi-page architecture: HTML/CSS/vanilla JS, zero build. Do not convert to React/Tailwind/npm.

Task: Implement Phase 5 — Wording Notifications, Dashboard & Reports.

Business context:
- Phases 1-4 added Content role, mandatory wording gate, Content Workbench Drawer, and Client wording confirmation.
- This phase completes operational visibility and notification tracking.

Requirements:
1. Add notification types:
   - brief_wording_assigned
   - brief_wording_started
   - brief_wording_submitted
   - brief_wording_account_revision
   - brief_wording_sent_client
   - brief_wording_client_feedback
   - brief_wording_approved
   - brief_wording_completed
2. If Supabase notifications.type has CHECK constraints, add an idempotent migration to extend allowed types.
3. Add notification icons only in `assets/notif-icons.js`.
4. Do not add emoji to notification producer titles.
5. Add notification producers:
   - Account transfers wording → notify Content
   - Content submits → notify Account/Admin
   - Account returns revision → notify Content
   - Account sends to Client → notify Client
   - Client requests changes → notify Account/Admin + Content
   - Client approves → notify Account/Admin + Content
6. Ensure role-aware links:
   - Client → client-dashboard.html?order=<order_id>
   - Content → content-workbench.html?id=<order_id>
   - Account/Admin → database-orders.html?id=<order_id>
7. Add Master Dashboard wording metrics:
   - Wording Pending
   - Wording In Progress
   - Waiting Account Review
   - Waiting Client Confirmation
   - Client Feedback
   - Wording Approved
8. Add drilldown links to Content Workbench filters.
9. Add Reports section: Content Wording Performance.
10. Add metrics:
   - Total wording orders
   - Wording completed
   - Average wording turnaround time
   - Average client confirmation time
   - Average wording rounds
   - First-pass approval rate
   - Revision rate by Content PIC
   - Overdue wording tasks
11. Add wording events to Activity Timeline in Content Drawer and Order Drawer.
12. Do not change production Preview/Final flow.
13. Do not restore Delivery Log.
14. Do not expose internal notes or Content Workbench links to Client.

Acceptance criteria:
- Wording flow is fully trackable with notifications.
- Dashboard and Reports reflect wording workload.
- Existing production and delivery flows remain unchanged.
```
