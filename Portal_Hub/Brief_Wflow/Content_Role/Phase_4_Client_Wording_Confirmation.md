# Phase 4 — Client Confirms Brief Wording

## Project Context

Phase 1 added Content role.  
Phase 2 added mandatory wording gate.  
Phase 3 added Content Workbench and Content Wording Drawer.

This phase adds the client-facing confirmation step.

Important system rule:

```text
Client only works through Account-facing surfaces in Client Portal.
Client must not see internal Content Workbench or Task Tracker.
```

---

## Goal

Allow Account to send the worded brief to Client for confirmation, and allow Client to either:

```text
1. Xác nhận brief đã wording
2. Yêu cầu chỉnh brief wording
```

Only after Client confirms wording can Account Confirm Brief and Push to Production.

---

## Core Workflow

```text
Content submits wording to Account
→ Account reviews wording
→ Account clicks Gửi Client xác nhận Brief
→ Client sees Brief đã wording in Client Portal
→ Client clicks Xác nhận brief OR Yêu cầu chỉnh brief

If Client confirms:
→ brief_wording_status = client_approved / completed
→ Account can Confirm Brief

If Client requests changes:
→ brief_wording_status = client_feedback
→ Content receives feedback and revises
→ Account sends revised wording to Client again
```

---

## Scope

### In scope

- Add Account action: `Gửi Client xác nhận Brief`.
- Add Client Portal section: `Brief đã được chuẩn hóa`.
- Add Client buttons: `Xác nhận brief` and `Yêu cầu chỉnh brief`.
- Add feedback modal for Client wording revision request.
- Support wording feedback rounds.
- Unlock Confirm Brief when client approves wording.
- Update wording lifecycle/timeline.

### Out of scope

- Do not change Preview/Final production feedback flow.
- Do not merge wording feedback rounds with production preview feedback rounds.
- Do not expose Content Workbench to Client.
- Do not restore Delivery Log.
- Full dashboard/report metrics can wait for Phase 5.

---

## Suggested Files to Review / Update

```text
assets/database-orders.js
database-orders.html
assets/client-dashboard.js
client-dashboard.html
assets/content-workbench.js
content-workbench.html
assets/data-store.js
assets/styles.css
```

Optional migration if fields do not exist:

```text
supabase/add-brief-wording-confirmation.sql
```

---

## Required Data Fields

If not already implemented, add:

```text
wording_client_sent_at
wording_client_sent_by
wording_client_feedback
wording_client_feedback_at
wording_approved_at
wording_approved_by
brief_wording_round
```

If using a separate `brief_wording_tasks` table, store feedback per wording task and round.

Recommended statuses used in this phase:

```text
submitted_to_account
sent_to_client
client_feedback
client_approved
completed
```

---

## Account Order Drawer Requirements

In the Brief Wording block, Account/Admin should see:

```text
Brief đã wording
Content PIC
Round
Submitted at
Account review note
Client confirmation status
```

CTA:

```text
Gửi Client xác nhận Brief
```

Button enable rules:

```text
Enable only when:
- brief_wording_status = submitted_to_account OR account_review_approved OR ready_for_client
- wording_brief is not empty
```

When clicked:

```text
brief_wording_status = sent_to_client
wording_client_sent_at = now
wording_client_sent_by = current user
```

Client should then see confirmation UI in Client Portal.

---

## Client Portal Requirements

Inside Client order detail drawer, add section:

```text
Brief đã được chuẩn hóa
```

Show:

```text
Brief đã wording
Mục tiêu sau khi chuẩn hóa
Thông điệp chính
Thông tin bắt buộc
Tone & style
CTA đề xuất
Ghi chú cần xác nhận
Round hiện tại
```

Client actions:

```text
Xác nhận brief
Yêu cầu chỉnh brief
```

Only show these actions when:

```text
brief_wording_status = sent_to_client
```

If already approved:

```text
Show: Brief đã được xác nhận
Hide action buttons
Show approval timestamp
```

If feedback submitted:

```text
Show: Đã gửi yêu cầu chỉnh brief
Hide duplicate submission unless Account sends revised wording again
```

---

## Client Feedback Modal

When Client clicks:

```text
Yêu cầu chỉnh brief
```

Open modal with fields:

```text
Nội dung cần chỉnh
Lý do chỉnh
Link/file tham khảo nếu có
```

Required:

```text
Nội dung cần chỉnh
```

On submit:

```text
brief_wording_status = client_feedback
brief_wording_round += 1
wording_client_feedback = modal content
wording_client_feedback_at = now
```

Then Content Workbench should show the order again for revision.

---

## Client Approval Action

When Client clicks:

```text
Xác nhận brief
```

Confirm dialog:

```text
Anh/chị xác nhận brief đã được chuẩn hóa và đồng ý chuyển sang bước sản xuất?
```

On confirm:

```text
brief_wording_status = client_approved
wording_approved_at = now
wording_approved_by = current client/user
```

Then Account Order Drawer should unlock:

```text
Confirm Brief
```

Do not auto-confirm the brief unless explicitly required. Recommended behavior:

```text
Client approval unlocks Confirm Brief.
Account still clicks Confirm Brief manually to maintain Account control.
```

---

## Wording Rounds

Wording rounds are separate from production preview feedback rounds.

Recommended wording round policy:

```text
Round starts at 1 when Account transfers to Content.
Each Client feedback increments wording round.
Account revision to Content may or may not increment round depending on preferred audit policy.
```

Simple rule:

```text
Increment round only when Client requests changes.
```

Suggested soft limit:

```text
Show warning after Round 3: "Brief wording đã qua 3 vòng chỉnh. Account cần xác nhận hướng xử lý tiếp theo."
```

Do not automatically create new production order in this phase.

---

## Content Workbench Update

If `brief_wording_status = client_feedback`, Content Workbench should show:

```text
Client yêu cầu chỉnh
```

Drawer should display:

```text
Client Feedback Round N
Feedback content
Feedback timestamp
```

Content can revise wording and submit back to Account again.

---

## Gate Rule Update

In `database-orders.js`:

```text
Confirm Brief is enabled only when:
brief_wording_status in ['client_approved', 'completed']
```

After Account clicks Confirm Brief:

```text
account_status = confirmed
```

After that, Push to Production can follow existing validation.

---

## Acceptance Criteria

- Account can send worded brief to Client.
- Client sees worded brief in Client Portal only when sent by Account.
- Client can approve wording.
- Client can request wording revision.
- Client feedback returns order to Content workflow.
- Account cannot Confirm Brief until Client approves wording.
- Production feedback rounds remain separate from wording feedback rounds.
- Client does not see Content Workbench, Task Tracker, or internal notes.
- Delivery Log is not restored.

---

## Test Cases

### Test 1 — Account sends wording to Client

```text
Content submits wording to Account
Login as Account
Open Order Drawer
Click Gửi Client xác nhận Brief
Expected:
- brief_wording_status = sent_to_client
- Client Portal displays Brief đã được chuẩn hóa
```

### Test 2 — Client approves wording

```text
Login as Client
Open order detail
Click Xác nhận brief
Expected:
- brief_wording_status = client_approved
- wording_approved_at saved
- Account can now Confirm Brief
```

### Test 3 — Client requests wording changes

```text
Login as Client
Open order detail
Click Yêu cầu chỉnh brief
Submit feedback
Expected:
- brief_wording_status = client_feedback
- brief_wording_round increments
- Content Workbench shows order requiring revision
```

### Test 4 — Confirm Brief remains locked

```text
brief_wording_status = sent_to_client
Login as Account
Open Order Drawer
Expected:
- Confirm Brief is disabled
```

### Test 5 — Confirm Brief unlocks

```text
brief_wording_status = client_approved
Login as Account
Open Order Drawer
Expected:
- Confirm Brief is enabled
```

---

## Dev / Claude Prompt

```text
You are updating the CB Creative Flow static web app.

Read README.md, _hot.md, and STATUS.md first. Preserve the current static multi-page architecture: HTML/CSS/vanilla JS, zero build. Do not convert to React/Tailwind/npm.

Task: Implement Phase 4 — Client Confirms Brief Wording.

Business context:
- Content Wording is mandatory before Confirm Brief and Push Production.
- Content prepares the worded brief.
- Account is the only internal role that sends the worded brief to Client.
- Client must confirm or request changes inside Client Portal.
- Client must not access Content Workbench, Task Tracker, or internal notes.

Requirements:
1. In Order Drawer, add/enable Account action `Gửi Client xác nhận Brief` when wording is ready.
2. When Account sends to Client:
   - set `brief_wording_status = sent_to_client`
   - save sent timestamp/user if fields exist
3. In Client Portal order detail drawer, add section `Brief đã được chuẩn hóa`.
4. Show worded brief fields to Client only after Account sends them.
5. Add Client buttons:
   - `Xác nhận brief`
   - `Yêu cầu chỉnh brief`
6. When Client approves:
   - set `brief_wording_status = client_approved`
   - save `wording_approved_at`
   - unlock Account `Confirm Brief`
   - do not auto-push production
7. When Client requests changes:
   - open feedback modal
   - require feedback text
   - set `brief_wording_status = client_feedback`
   - increment `brief_wording_round`
   - save feedback text/time
   - make the order visible again in Content Workbench for revision
8. Keep wording feedback rounds separate from production Preview/Final feedback rounds.
9. Do not expose internal Content Workbench or Task Tracker to Client.
10. Do not restore Delivery Log.
11. Preserve existing Preview/Final flow inside Order Drawer.

Acceptance criteria:
- Account sends wording to Client.
- Client can approve or request changes.
- Account cannot Confirm Brief before Client approval.
- After Client approval, Account can Confirm Brief and then Push Production using existing flow.
```
