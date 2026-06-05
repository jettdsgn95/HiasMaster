# Phase 3 — Content Workbench & Content Wording Drawer

## Project Context

Phase 1 added role `content`.  
Phase 2 added mandatory Content Wording gate before Account can Confirm Brief and Push to Production.

This phase builds the actual working interface for the Content role.

Content Wording is not Production. It is a mandatory brief-standardization step before production begins.

---

## Goal

Create a dedicated internal page and drawer for Content Wording work:

```text
content-workbench.html
assets/content-workbench.js
```

The Content role can see assigned wording orders, open a drawer, review the original brief, create the worded/standardized brief, complete a checklist, and submit the result to Account.

---

## Core Workflow

```text
Account clicks Chuyển Content Wording
→ Order appears in Content Workbench
→ Content opens Content Wording Drawer
→ Content reviews original brief
→ Content writes standardized wording brief
→ Content completes checklist
→ Content clicks Gửi Account duyệt
→ Account receives/opens wording result from Order Drawer or Content Workbench
```

---

## Scope

### In scope

- Create `content-workbench.html`.
- Create `assets/content-workbench.js`.
- Add internal sidebar route `Content Wording`.
- Build Content Wording table/list.
- Build Content Wording Drawer.
- Allow Content to save draft and submit to Account.
- Allow Account/Admin to view and optionally return wording for revision.
- Persist wording fields to mock/localStorage and Supabase if enabled.
- Update Order Drawer to show wording result summary if available.

### Out of scope

- Do not build Client Portal confirmation yet. That is Phase 4.
- Do not implement final notification matrix yet. That is Phase 5.
- Do not modify production Task Tracker except if needed for navigation.
- Do not restore Delivery Log.

---

## Suggested Files to Create

```text
content-workbench.html
assets/content-workbench.js
```

## Suggested Files to Update

```text
assets/styles.css
assets/app.js
assets/data-store.js
assets/database-orders.js
database-orders.html
```

Optional docs after implementation:

```text
README.md
STATUS.md
_hot.md
```

---

## Data Model Recommendation

Recommended long-term approach: create a dedicated table/namespace:

```text
brief_wording_tasks
```

Suggested fields:

```text
id
order_id
assigned_content_id
assigned_content_name
status
round
original_brief_snapshot
wording_brief
core_message
required_info
tone_style
cta
production_note
content_checklist_json
account_review_note
client_feedback
client_approved_at
submitted_by
submitted_at
created_at
updated_at
```

If the project needs faster implementation, use order fields first:

```text
wording_brief
wording_core_message
wording_required_info
wording_tone_style
wording_cta
wording_production_note
wording_content_checklist
wording_account_note
wording_submitted_by
wording_submitted_at
```

Recommended for control and scalability:

```text
Use a separate `brief_wording_tasks` table/namespace if feasible.
Fallback gracefully to order fields/localStorage if migration is not available.
```

---

## Content Workbench Page Requirements

Page title:

```text
Content Wording
```

Subtitle:

```text
Chuẩn hóa brief trước khi chuyển Production
```

Main sections:

```text
Summary cards
Filters
Wording task table/list
Content Wording Drawer
```

### Summary Cards

Suggested cards:

```text
Mới chuyển Content
Đang xử lý
Chờ Account duyệt
Account yêu cầu chỉnh
Chờ Client xác nhận
Client yêu cầu chỉnh
Đã xác nhận
```

### Filters

```text
Status
PIC Content
Request type
Branch / Department
Deadline
Priority
Search by Order ID / Project name
```

### Table Columns

```text
Order ID
Project / Campaign
Branch / Department
Request Type
Priority
Deadline
Wording Status
Round
PIC Content
Last Updated
Action
```

Action:

```text
Mở Wording Drawer
```

---

## Content Wording Drawer Layout

Drawer name:

```text
Content Wording Drawer
```

### 1. Header

Show:

```text
Order ID
Project name
Branch / Department
Request type
Priority
Client deadline
Internal deadline
Wording status
Round
PIC Content
```

Role-based CTA:

For Content:

```text
Lưu nháp
Bắt đầu xử lý
Gửi Account duyệt
```

For Account/Admin:

```text
Trả Content chỉnh
Gửi Client xác nhận   (can be placeholder until Phase 4)
```

### 2. Wording Lifecycle

```text
Assigned
→ Content Working
→ Submitted to Account
→ Account Review
→ Client Confirmation
→ Approved
```

Show future client confirmation step as pending until Phase 4.

### 3. Original Brief Snapshot

Read-only block.

Show original client-submitted content:

```text
Project / campaign name
Objective
Target audience
Request type
Deliverables
Original content / direction
Headline / CTA if any
Required info
Files / links
Client notes
```

Important:

```text
Do not allow Content to edit the original brief directly.
```

### 4. Wording Workspace

Editable by Content/Admin. Read-only for Account unless Admin override is allowed.

Fields:

```text
Brief đã wording
Mục tiêu sau khi chuẩn hóa
Thông điệp chính
Thông tin bắt buộc cần thể hiện
Tone & style nội dung
CTA đề xuất
Ghi chú cho Production team
```

### 5. Content Responsibility Checklist

Required before submitting to Account.

Checklist:

```text
Đã hiểu đúng mục tiêu truyền thông
Đã kiểm tra đủ thông tin bắt buộc
Đã chuẩn hóa thông điệp chính
Đã đề xuất CTA phù hợp
Đã loại bỏ nội dung mơ hồ / thiếu rõ ràng
Đã ghi chú rõ điểm cần Production lưu ý
Đã kiểm tra tone phù hợp brand CB
```

Submit button rule:

```text
Gửi Account duyệt is disabled until required wording fields and checklist are completed.
```

### 6. Account Review Panel

Visible to Account/Admin and read-only for Content except review notes.

Actions:

```text
Trả Content chỉnh
Gửi Client xác nhận
```

For Phase 3:

- `Trả Content chỉnh` should work.
- `Gửi Client xác nhận` can either set `brief_wording_status = sent_to_client` or be prepared for Phase 4 depending on implementation plan.

If Account returns revision:

```text
brief_wording_status = account_revision
account_review_note = required
```

### 7. Client Feedback / Approval Panel

For Phase 3, show as placeholder/read-only:

```text
Client confirmation will be implemented in Phase 4.
```

If existing status is `client_feedback`, display existing feedback safely.

### 8. Files / Links Workspace

Fields:

```text
Client source link
Working Google Doc link
Reference link
Internal wording link
```

Only the selected client-facing wording content should later be sent to Client.

### 9. Activity Timeline

Log actions:

```text
Assigned to Content
Content started wording
Content saved draft
Content submitted to Account
Account returned revision
Account sent to Client
Client requested changes
Client approved wording
```

For this phase, implement at least:

```text
Assigned to Content
Draft saved
Submitted to Account
Account returned revision
```

---

## Status Transitions

Recommended transitions:

```text
assigned
→ in_progress
→ submitted_to_account
→ account_revision
→ in_progress
→ submitted_to_account
```

Later phases will add:

```text
submitted_to_account
→ sent_to_client
→ client_feedback
→ in_progress
→ submitted_to_account
→ sent_to_client
→ client_approved
→ completed
```

---

## Role Permissions

| Action | Admin | Account | Content |
|---|---:|---:|---:|
| View wording list | Yes | Yes | Yes |
| Open drawer | Yes | Yes | Yes |
| Edit wording fields | Yes | Optional no | Yes |
| Save draft | Yes | Optional no | Yes |
| Submit to Account | Yes | No | Yes |
| Return Content revision | Yes | Yes | No |
| Send Client confirmation | Yes | Yes | No |
| Override status | Yes | No | No |

Recommended:

```text
Account should review and route, not rewrite Content wording unless Admin permits override.
```

---

## Order Drawer Integration

In `database-orders.js`, add a Wording Summary block:

```text
Brief Wording Summary
- Wording status
- Content PIC
- Round
- Last submitted at
- Brief đã wording preview
- Button: Mở Content Wording
```

Account can open the Content Wording Drawer or navigate to:

```text
content-workbench.html?id=<order_id>
```

---

## Acceptance Criteria

- Content role can access Content Workbench.
- Content sees orders with `brief_wording_status` assigned/in_progress/account_revision/client_feedback.
- Content can open Content Wording Drawer.
- Original brief is read-only.
- Content can fill wording fields.
- Content cannot submit until required fields and checklist are complete.
- Content can submit to Account.
- Account/Admin can review wording result.
- Account/Admin can return to Content for revision with note.
- Order Drawer shows wording summary.
- Existing production flow remains locked until wording approval.
- No Client Portal confirmation is required in this phase.
- Delivery Log is not restored.

---

## Test Cases

### Test 1 — Content sees assigned wording order

```text
Account transfers order to Content Wording
Login as Content
Open Content Wording page
Expected:
- Order appears in list
- Status = assigned
```

### Test 2 — Content save draft

```text
Open drawer as Content
Fill some wording fields
Click Lưu nháp
Refresh page
Expected:
- Draft is persisted
- Status can become in_progress
```

### Test 3 — Checklist validation

```text
Open drawer as Content
Fill wording brief but leave checklist incomplete
Expected:
- Gửi Account duyệt remains disabled
```

### Test 4 — Submit to Account

```text
Complete required fields and checklist
Click Gửi Account duyệt
Expected:
- brief_wording_status = submitted_to_account
- submitted_by and submitted_at saved
- Account can see result
```

### Test 5 — Account returns revision

```text
Login as Account
Open wording drawer
Click Trả Content chỉnh with note
Expected:
- brief_wording_status = account_revision
- Content sees revision note
```

---

## Dev / Claude Prompt

```text
You are updating the CB Creative Flow static web app.

Read README.md, _hot.md, and STATUS.md first. Preserve the current static multi-page architecture: HTML/CSS/vanilla JS, zero build. Do not convert to React/Tailwind/npm.

Task: Implement Phase 3 — Content Workbench & Content Wording Drawer.

Business context:
- Content Wording is a mandatory step after Account checks the brief and before Confirm Brief / Push Production.
- Phase 1 added role `content`.
- Phase 2 added the mandatory wording gate and order fields.
- This phase builds the working interface for Content to process wording.

Create:
1. `content-workbench.html`
2. `assets/content-workbench.js`

Update as needed:
- sidebar/nav to include Content Wording
- `assets/styles.css` for drawer/table components
- `assets/data-store.js` for wording data access if needed
- `assets/database-orders.js` to show wording summary and link/open wording drawer

Functional requirements:
1. Content Workbench lists orders that require wording.
2. Content can open Content Wording Drawer.
3. Drawer must show original brief as read-only.
4. Drawer must provide editable wording fields:
   - Brief đã wording
   - Mục tiêu sau khi chuẩn hóa
   - Thông điệp chính
   - Thông tin bắt buộc
   - Tone & style
   - CTA đề xuất
   - Ghi chú cho Production team
5. Add required Content checklist:
   - Đã hiểu đúng mục tiêu truyền thông
   - Đã kiểm tra đủ thông tin bắt buộc
   - Đã chuẩn hóa thông điệp chính
   - Đã đề xuất CTA phù hợp
   - Đã loại bỏ nội dung mơ hồ / thiếu rõ ràng
   - Đã ghi chú rõ điểm cần Production lưu ý
   - Đã kiểm tra tone phù hợp brand CB
6. `Gửi Account duyệt` must be disabled until required fields and checklist are completed.
7. Content can save draft.
8. Content can submit to Account, setting `brief_wording_status = submitted_to_account`.
9. Account/Admin can view wording result and return revision with required note, setting `brief_wording_status = account_revision`.
10. Add Wording Summary block inside Order Drawer with button/link to open Content Wording for that order.
11. Do not implement Client Portal confirmation yet; that is Phase 4.
12. Do not restore Delivery Log.
13. Preserve existing order/task/preview/final flows.

Acceptance criteria:
- Content can process wording in a dedicated drawer.
- Account can review and return revision.
- Order Drawer reflects wording status.
- Confirm Brief / Push Production remain locked until wording approval from a later phase.
```
