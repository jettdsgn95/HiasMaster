# Phase 2 — Mandatory Brief Wording Gate in Order Drawer

## Project Context

Project: **CB Creative Flow / CB Media Hub**  
Current system centers order processing inside `database-orders.html` / `assets/database-orders.js`.  
Preview/Final delivery is already handled inside the Order Drawer. Delivery Log must not be restored.

New business rule:

```text
Every client order must pass Content Wording before Account can Confirm Brief and Push to Production.
```

This phase adds the workflow gate and status fields. It does not build the full Content drawer yet.

---

## Goal

Modify Account order intake flow:

```text
Client submits Order
→ Account clicks "Kiểm tra Brief"
→ If brief is missing info: Account requests Client supplement
→ If brief is sufficient: Account clicks "Chuyển Content Wording"
→ Order enters mandatory Content Wording state
→ Confirm Brief is locked until wording is approved by Client
→ Push to Production remains locked until Confirm Brief is completed
```

---

## Scope

### In scope

- Add brief wording status model to orders.
- Add Order Drawer UI block showing mandatory wording workflow.
- Add Account action button: `Chuyển Content Wording`.
- Lock `Confirm Brief` until wording is approved.
- Lock `Push to Production` until order is confirmed after wording approval.
- Add safe fallback for mock/localStorage and Supabase mode.
- Keep current need-info flow.

### Out of scope

- Do not build Content Workbench Drawer yet.
- Do not build Client confirmation UI yet.
- Do not build full notifications yet.
- Do not modify production-board behavior except if necessary to respect the new gate.
- Do not restore Delivery Log.

---

## Suggested Files to Review / Update

```text
assets/database-orders.js
database-orders.html
assets/data-store.js
assets/styles.css
supabase/add-brief-wording-fields.sql   (new migration, if Supabase is enabled)
README.md / STATUS.md / _hot.md          (optional docs update after implementation)
```

---

## Proposed Data Fields

Add to orders if using direct order fields:

```text
brief_wording_status text default 'none'
brief_wording_round integer default 0
brief_wording_pic text or uuid nullable
wording_approved_at timestamptz nullable
wording_last_updated_at timestamptz nullable
```

Recommended status values:

```text
none
assigned
in_progress
submitted_to_account
account_revision
sent_to_client
client_feedback
client_approved
completed
```

For this phase, only these statuses need to be actively used:

```text
none
assigned
client_approved
completed
```

Later phases will use the full status list.

---

## Order Drawer UI Requirements

Add a new block inside Order Drawer:

```text
Brief Wording Workflow
```

Suggested lifecycle display:

```text
1. Account kiểm tra brief
2. Chuyển Content Wording
3. Content xử lý wording
4. Account gửi Client xác nhận
5. Client xác nhận brief wording
6. Sẵn sàng Confirm Brief
```

For Phase 2, show future steps as pending if not implemented yet.

---

## Account Actions

### Existing action: Kiểm tra Brief

Behavior remains:

```text
Account clicks "Kiểm tra Brief"
→ account_status = checking
```

### If brief is missing information

Use existing action:

```text
Yêu cầu bổ sung
```

Expected:

```text
account_status = needinfo
```

### If brief is sufficient

New action:

```text
Chuyển Content Wording
```

Expected:

```text
account_status = wording
brief_wording_status = assigned
brief_wording_round = 1 if currently 0
```

Optional if Content PIC is not selected yet:

```text
brief_wording_pic = null
```

If there is a Content PIC selector in this phase, save it. If not, auto-assign can be deferred to Phase 3.

---

## Gate Rules

### Rule 1 — Confirm Brief lock

```text
If brief_wording_status is not client_approved or completed:
    Disable Confirm Brief button.
    Show warning:
    "Order cần hoàn tất Content Wording và được Client xác nhận trước khi Confirm Brief."
```

### Rule 2 — Push Production lock

```text
If account_status is not confirmed:
    Disable Push to Production.
```

### Rule 3 — No production task before wording approval

```text
pushToProduction() must validate:
- account_status === 'confirmed'
- brief_wording_status in ['client_approved', 'completed']
```

If validation fails, show toast and do not create task.

---

## Suggested Status Mapping for UI

| `brief_wording_status` | UI label |
|---|---|
| `none` | Chưa chuyển Content Wording |
| `assigned` | Đã chuyển Content Wording |
| `in_progress` | Content đang xử lý |
| `submitted_to_account` | Chờ Account duyệt |
| `account_revision` | Account yêu cầu Content chỉnh |
| `sent_to_client` | Chờ Client xác nhận brief wording |
| `client_feedback` | Client yêu cầu chỉnh brief wording |
| `client_approved` | Client đã xác nhận brief wording |
| `completed` | Hoàn tất Content Wording |

---

## Mock / LocalStorage Handling

If the project currently uses mock orders/localStorage fallback:

- Add default `brief_wording_status: 'none'` to mock orders.
- Update adapters to tolerate missing field.
- Existing old mock/localStorage data must not crash the UI.
- If field missing, treat as `none`.

---

## Supabase Migration Suggestion

Create file:

```text
supabase/add-brief-wording-fields.sql
```

Suggested SQL:

```sql
alter table public.orders
  add column if not exists brief_wording_status text default 'none',
  add column if not exists brief_wording_round integer default 0,
  add column if not exists brief_wording_pic text,
  add column if not exists wording_approved_at timestamptz,
  add column if not exists wording_last_updated_at timestamptz;
```

If there is a CHECK constraint strategy for status fields, add it carefully and idempotently.

---

## Acceptance Criteria

- Account can still check brief and request supplement if missing.
- Account can click `Chuyển Content Wording` when brief is sufficient.
- Order displays wording status inside Order Drawer.
- `Confirm Brief` is disabled before wording is approved.
- `Push to Production` cannot run before wording approval and confirmed brief.
- Existing Preview/Final flow remains unchanged.
- Existing Task Tracker flow remains unchanged.
- Delivery Log is not restored.

---

## Test Cases

### Test 1 — Missing brief info

```text
Open new order as Account
Click Kiểm tra Brief
Click Yêu cầu bổ sung
Expected:
- account_status = needinfo
- No wording status required yet
- Client supplement flow remains as before
```

### Test 2 — Sufficient brief, transfer to Content Wording

```text
Open new order as Account
Click Kiểm tra Brief
Click Chuyển Content Wording
Expected:
- account_status = wording
- brief_wording_status = assigned
- wording lifecycle block updates
- Confirm Brief is disabled
- Push Production is disabled
```

### Test 3 — Hard gate validation

```text
Manually try to trigger pushToProduction while brief_wording_status = assigned
Expected:
- No task is created
- Toast warns that wording approval is required
```

### Test 4 — Simulated approved status

```text
Set brief_wording_status = client_approved
Open order drawer
Expected:
- Confirm Brief becomes available
- After Confirm Brief, Push Production becomes available
```

---

## Dev / Claude Prompt

```text
You are updating the CB Creative Flow static web app.

Read README.md, _hot.md, and STATUS.md first. Preserve the current architecture: static multi-page HTML/CSS/vanilla JS, zero build. Do not convert to React/Tailwind/npm.

Task: Implement Phase 2 — Mandatory Brief Wording Gate in Order Drawer.

Business rule:
- Every client order must pass Content Wording before Account can Confirm Brief and Push to Production.
- Account first checks the brief.
- If missing information, Account requests Client supplement using the existing need-info flow.
- If brief is sufficient, Account clicks `Chuyển Content Wording`.
- The order enters `brief_wording_status = assigned` and `account_status = wording`.
- Account cannot Confirm Brief until `brief_wording_status` is `client_approved` or `completed`.
- Account cannot Push to Production unless account_status is `confirmed` and wording is approved/completed.

Implementation requirements:
1. Add order fields with safe fallback:
   - brief_wording_status
   - brief_wording_round
   - brief_wording_pic
   - wording_approved_at
   - wording_last_updated_at
2. Add a migration file if Supabase is enabled: `supabase/add-brief-wording-fields.sql`.
3. Add a `Brief Wording Workflow` block inside the Order Drawer.
4. Add Account action button: `Chuyển Content Wording`.
5. Preserve existing `Kiểm tra Brief` and `Yêu cầu bổ sung` behavior.
6. Lock `Confirm Brief` until wording is approved/completed.
7. Lock `Push to Production` until Confirm Brief is completed.
8. Add validation inside `pushToProduction()` so production task cannot be created before wording approval.
9. Ensure old mock/localStorage orders without new fields do not crash.
10. Do not build Content Workbench yet.
11. Do not build Client confirmation UI yet.
12. Do not restore Delivery Log.

Acceptance criteria:
- Account can transfer a sufficient brief to Content Wording.
- Confirm Brief is disabled until wording approval.
- Push Production cannot bypass the wording gate.
- Existing order/task/preview/final flows are not broken.
```
