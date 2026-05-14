# CB Creative Flow - Media Hub by CB Centres
# 05. Delivery Log Module — Detailed Specification for Dev

**Module:** Delivery Log  
**Purpose:** Cập nhật vào website portal để Account/Admin quản lý bước kiểm tra, bàn giao sản phẩm, nhận rating và đóng order sau khi task đã sẵn sàng bàn giao từ Production Board.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, clean SaaS dashboard.  
**Output chính:** Quản lý toàn bộ quá trình bàn giao sản phẩm từ Media team đến Client/Requester.

---

# 1. Mục đích

**Delivery Log Module** là khu vực dành cho **Account/Admin** kiểm soát bước cuối cùng của workflow Media:

```text
Order Form
→ Database Orders
→ Production Board
→ Delivery Log
→ Completed
```

Delivery Log dùng để:

1. Nhận task đã sẵn sàng bàn giao từ Production Board.
2. Cho Account kiểm tra file trước khi gửi client.
3. Quản lý preview link, final link, delivery date.
4. Theo dõi trạng thái gửi preview/final.
5. Ghi nhận client feedback.
6. Ghi nhận rating/mức độ hài lòng.
7. Đóng order/task sau khi bàn giao.
8. Cập nhật dữ liệu cho Reports/Dashboard.

---

# 2. Người dùng chính

```text
Account
Admin
Client
```

## 2.1. Account

Account dùng Delivery Log để:

```text
Xem task sẵn sàng bàn giao
Kiểm tra preview/final link
Yêu cầu chỉnh sửa nội bộ nếu file chưa đạt
Gửi preview/final cho client
Theo dõi client feedback
Ghi nhận delivery date
Nhận rating
Đóng order/task
```

## 2.2. Admin

Admin dùng Delivery Log để:

```text
Theo dõi toàn bộ trạng thái bàn giao
Kiểm soát task bị trễ bàn giao
Theo dõi chất lượng delivery
Can thiệp khi task bị mở lại
Xuất báo cáo delivery
```

## 2.3. Client

Client chỉ thấy phần public:

```text
Preview link nếu cần duyệt
Final link khi đã bàn giao
Public delivery status
Feedback/rating form
```

Client không thấy:

```text
Internal note
Internal deadline
Account internal checklist
P.I.C workload
Activity log nội bộ
```

---

# 3. Vị trí trong hệ thống

## Menu

```text
Main
└── Delivery Log
```

## Route đề xuất

```text
/delivery
/delivery/:delivery_id
/delivery/order/:order_id
/delivery/task/:task_id
/client/orders/:order_id/delivery
```

---

# 4. Điều kiện task xuất hiện trong Delivery Log

Task từ Production Board chỉ được chuyển sang Delivery Log khi đủ điều kiện:

```text
Production Status = Sẵn sàng bàn giao
Preview hoặc Final Link không rỗng
Account/Admin đã duyệt nội bộ hoặc xác nhận file đạt
Task không bị hủy
```

## Nếu thiếu link

Hiển thị lỗi:

```text
Không thể chuyển task sang Delivery Log.
Vui lòng cập nhật Preview Link hoặc Final Link trước khi bàn giao.
```

## Khi task vào Delivery Log

Hệ thống tạo record Delivery:

```text
delivery_id
order_id
task_id
account_id
production_pic_id
delivery_status = Chờ Account kiểm tra
preview_link
final_link
created_at
```

---

# 5. Main Delivery Log Page

## 5.1. Layout tổng

```text
Delivery Log Page
├── Header Area
│   ├── Page title
│   ├── Subtitle
│   ├── Search
│   ├── Filter
│   ├── Export
│   └── Quick actions
│
├── Delivery Summary Cards
│   ├── Ready for Delivery
│   ├── Waiting Account Check
│   ├── Preview Sent
│   ├── Waiting Client Feedback
│   ├── Final Sent
│   ├── Waiting Rating
│   ├── Completed
│   └── Reopened
│
├── Filter Bar
│   ├── Delivery Status
│   ├── Account
│   ├── P.I.C
│   ├── Project/Campaign/Event
│   ├── Type
│   ├── Delivery Date
│   ├── Rating
│   └── Overdue
│
├── Delivery Table
└── Delivery Detail Drawer/Page
```

---

# 6. Header Area

## 6.1. Nội dung

| Thành phần | Nội dung |
|---|---|
| Page title | Delivery Log |
| Subtitle | Quản lý bàn giao sản phẩm, feedback, rating và đóng đơn |
| Search | Tìm Order ID, Project, Account, P.I.C |
| Filter | Mở bộ lọc |
| Export | Xuất Excel/PDF |
| Quick action | Xem task chờ kiểm tra / chờ rating |

UI suggestion:

```text
[Delivery Log]
Theo dõi việc kiểm tra, bàn giao và đánh giá sản phẩm Media

[Search order/project...] [Filter] [Export]
```

---

# 7. Delivery Summary Cards

| Card | Ý nghĩa | Click behavior |
|---|---|---|
| Ready for Delivery | Task từ Production Board đã sẵn sàng bàn giao | Filter status = Sẵn sàng bàn giao / Chờ Account kiểm tra |
| Waiting Account Check | Chờ Account kiểm tra file | Filter delivery_status = Chờ Account kiểm tra |
| Preview Sent | Đã gửi preview | Filter delivery_status = Đã gửi preview |
| Waiting Client Feedback | Chờ client phản hồi | Filter delivery_status = Chờ client phản hồi |
| Final Sent | Đã gửi final | Filter delivery_status = Đã gửi final |
| Waiting Rating | Đã bàn giao nhưng chưa có rating | Filter rating = null |
| Completed | Đã hoàn thành | Filter delivery_status = Hoàn thành |
| Reopened | Task/order bị mở lại | Filter reopened_count > 0 |

---

# 8. Filter Bar

Delivery Log cần filter theo:

```text
Delivery Status
Account
P.I.C
Project/Campaign/Event
Type
Delivery Date
Requested Deadline
Internal Deadline
Rating
Overdue
Reopened
Department/Branch
```

## Search cần tìm theo:

```text
delivery_id
order_id
task_id
project_name
account_name
production_pic_name
requester_name
department
final_link
delivery_note
client_feedback
```

---

# 9. Delivery Table

## 9.1. Columns bắt buộc

```text
Delivery ID
Order ID
Task ID
Timestamp
Project/Campaign/Event
Type
Account
P.I.C
Delivery Status
Delivery Date
Link Drive
Rate
Note
Action
```

## 9.2. Giải thích cột

| Cột | Ý nghĩa |
|---|---|
| Delivery ID | Mã delivery |
| Order ID | Mã order |
| Task ID | Mã task liên kết |
| Timestamp | Thời gian order/task được tạo hoặc chuyển delivery |
| Project/Campaign/Event | Tên chương trình/dự án |
| Type | Loại sản phẩm |
| Account | Account phụ trách bàn giao |
| P.I.C | Người sản xuất |
| Delivery Status | Trạng thái bàn giao |
| Delivery Date | Ngày gửi sản phẩm |
| Link Drive | Link preview/final |
| Rate | Mức độ hài lòng 1–5 |
| Note | Ghi chú bàn giao |
| Action | Thao tác nhanh |

## 9.3. Action menu

```text
View Detail
Check File
Request Internal Revision
Send Preview
Send Final
Copy Final Link
Ask for Rating
Close Delivery
Reopen Delivery
Open Order Detail
Open Task Detail
```

---

# 10. Delivery Detail Page / Drawer

## 10.1. Layout

```text
Delivery Detail
├── Header Summary
│   ├── Delivery ID
│   ├── Order ID
│   ├── Task ID
│   ├── Project/Campaign/Event
│   ├── Delivery Status
│   ├── Rating
│   └── Quick actions
│
├── Block A — Order & Task Summary
├── Block B — File & Link
├── Block C — Delivery Control
├── Block D — Feedback & Rating
├── Block E — Checklist
└── Block F — Activity Log
```

---

# 11. Block A — Order & Task Summary

## Fields

```text
Order ID
Task ID
Project/Campaign/Event
Requester
Department/Branch
Type
Priority
Requested Deadline
Internal Deadline
Production Status
P.I.C
Account
```

## Mục đích

Giúp Account hiểu nhanh sản phẩm nào đang được bàn giao và thuộc order/task nào.

---

# 12. Block B — File & Link

## Fields

```text
Brief File
Source Link
Working Drive Link
Preview Link
Final Link
File Version
Uploaded By
Uploaded At
```

## Actions

```text
Open Preview
Open Final
Copy Link
Update Link
Check Drive Permission
Mark as Preview
Mark as Final
```

## Drive permission checklist

```text
Link có mở quyền xem/tải chưa?
Link có đúng file/folder không?
File đã đúng version chưa?
File có đặt tên rõ ràng chưa?
File có đủ format cần bàn giao không?
```

---

# 13. Block C — Delivery Control

## Fields

```text
Delivery Status
Delivery Date
Delivery Channel
Delivered To
Delivered By
Client Approval Status
Delivery Note
```

## Delivery Channel options

```text
Portal
Email
Zalo
Google Drive
Direct message
Other
```

## Client Approval Status

```text
Pending
Approved
Revision Requested
No Response
```

---

# 14. Block D — Feedback & Rating

## Fields

```text
Satisfaction Score
Client Feedback
Revision Request
Rating Date
Rated By
Feedback Category
```

## Rating scale

```text
1 — Rất không hài lòng
2 — Không hài lòng
3 — Bình thường
4 — Hài lòng
5 — Rất hài lòng
```

## Feedback categories

```text
Chất lượng thiết kế/video
Tiến độ
Phối hợp
Nội dung chưa đúng
File/link bàn giao
Khác
```

---

# 15. Block E — Checklist trước khi bàn giao

Checklist bắt buộc cho Account trước khi bấm `Send Final`.

```text
Đã kiểm tra đúng nội dung brief
Đã kiểm tra chính tả/thông tin chương trình
Đã kiểm tra đúng kích thước/tỉ lệ
Đã kiểm tra đúng brand CB
Đã kiểm tra đúng file final
Đã kiểm tra quyền truy cập link Drive
Đã kiểm tra đúng version file
Đã ghi chú nếu có thay đổi so với brief
```

## Rule

```text
Chỉ cho bấm Send Final khi checklist hoàn tất.
Nếu thiếu checklist, hiển thị warning.
```

---

# 16. Block F — Activity Log

## Activity types

```text
delivery_created
account_checked
internal_revision_requested
preview_sent
client_feedback_received
final_sent
rating_submitted
delivery_completed
delivery_reopened
delivery_note_updated
final_link_updated
```

## Fields

```text
Time
User
Action Type
Old Value
New Value
Comment
```

---

# 17. Delivery Status

## Status list

```text
Chưa sẵn sàng bàn giao
Chờ Account kiểm tra
Cần chỉnh sửa nội bộ
Sẵn sàng bàn giao
Đã gửi preview
Chờ client phản hồi
Client yêu cầu chỉnh sửa
Đã gửi final
Đã nhận đánh giá
Hoàn thành
Mở lại
Hủy
```

## Ý nghĩa status

| Status | Ý nghĩa |
|---|---|
| Chưa sẵn sàng bàn giao | Task chưa đủ điều kiện bàn giao |
| Chờ Account kiểm tra | Task đã sẵn sàng, Account cần kiểm tra |
| Cần chỉnh sửa nội bộ | Account yêu cầu P.I.C sửa trước khi gửi client |
| Sẵn sàng bàn giao | File đạt, có thể gửi client |
| Đã gửi preview | Đã gửi bản preview cho client xem |
| Chờ client phản hồi | Đang chờ client approve/feedback |
| Client yêu cầu chỉnh sửa | Client yêu cầu sửa |
| Đã gửi final | Đã gửi final link |
| Đã nhận đánh giá | Client đã rating |
| Hoàn thành | Delivery đóng |
| Mở lại | Task/order mở lại sau bàn giao |
| Hủy | Delivery bị hủy |

---

# 18. Delivery Flow

## 18.1. Flow chuẩn

```text
Production Board: Sẵn sàng bàn giao
→ Delivery Log: Chờ Account kiểm tra
→ Account kiểm tra file
→ Nếu chưa đạt: Cần chỉnh sửa nội bộ
→ Nếu đạt: Sẵn sàng bàn giao
→ Gửi preview nếu cần
→ Chờ client phản hồi
→ Client approve hoặc yêu cầu chỉnh sửa
→ Gửi final
→ Client rating
→ Hoàn thành
```

## 18.2. Nếu cần chỉnh sửa nội bộ

```text
Delivery Status = Cần chỉnh sửa nội bộ
Production Status = Chỉnh sửa nội bộ
Comment gửi về P.I.C
Task quay lại Production Board
```

## 18.3. Nếu client yêu cầu chỉnh sửa

```text
Delivery Status = Client yêu cầu chỉnh sửa
Production Status = Chỉnh sửa theo feedback
revision_count + 1
Task quay lại Production Board
```

## 18.4. Nếu không có feedback sau X ngày

Config trong Settings:

```text
Auto close after 3 ngày kể từ ngày gửi final nếu client không phản hồi
```

---

# 19. Data Model — Delivery

| Field | Type | Required | Note |
|---|---|---:|---|
| delivery_id | string | Yes | Primary key |
| order_id | string | Yes | FK Orders |
| task_id | string | No | FK Tasks |
| account_id | string | Yes | Account phụ trách |
| production_pic_id | string | Yes | P.I.C |
| requester_id | string | No | Client/requester |
| project_name | string | Yes | Snapshot |
| delivery_status | enum | Yes | Status |
| preview_link | string | No | Link preview |
| final_link | string | No | Link final |
| delivery_date | datetime | No | Ngày gửi |
| delivery_channel | enum | No | Portal/Email/Zalo/Drive |
| delivered_to | string | No | Người nhận |
| delivered_by | string | No | Người gửi |
| client_approval_status | enum | No | Pending/Approved/Revision |
| satisfaction_score | number | No | 1–5 |
| client_feedback | text | No | Feedback |
| delivery_note | text | No | Note |
| checklist_json | json | No | Checklist trước bàn giao |
| closed_at | datetime | No | Thời gian đóng |
| reopened_count | number | No | Số lần mở lại |
| created_at | datetime | Yes | Ngày tạo |
| updated_at | datetime | Yes | Cập nhật |

---

# 20. API đề xuất

## List deliveries

```http
GET /api/deliveries
```

Query params:

```text
search
delivery_status
account_id
production_pic_id
project_name
type
delivery_date
rating
overdue
reopened
page
limit
sort
```

## Get delivery detail

```http
GET /api/deliveries/{delivery_id}
```

## Check file / approve for delivery

```http
POST /api/deliveries/{delivery_id}/check
```

Request:

```json
{
  "checklist": {
    "brief_checked": true,
    "content_checked": true,
    "size_checked": true,
    "brand_checked": true,
    "final_file_checked": true,
    "drive_permission_checked": true,
    "version_checked": true
  },
  "delivery_status": "Sẵn sàng bàn giao",
  "note": "File đạt, có thể gửi client."
}
```

## Request internal revision

```http
POST /api/deliveries/{delivery_id}/request-internal-revision
```

Request:

```json
{
  "comment": "Cần chỉnh lại CTA và kiểm tra chính tả.",
  "send_back_to_production": true
}
```

## Send preview

```http
POST /api/deliveries/{delivery_id}/send-preview
```

Request:

```json
{
  "preview_link": "https://drive.google.com/...",
  "delivery_channel": "Portal",
  "message": "Vui lòng kiểm tra preview."
}
```

## Submit client feedback

```http
POST /api/deliveries/{delivery_id}/client-feedback
```

Request:

```json
{
  "client_approval_status": "Revision Requested",
  "client_feedback": "Vui lòng chỉnh lại thông tin thời gian."
}
```

## Send final

```http
POST /api/deliveries/{delivery_id}/send-final
```

Request:

```json
{
  "final_link": "https://drive.google.com/...",
  "delivery_channel": "Portal",
  "delivered_to": "client@cbcentres.com",
  "note": "Đã gửi final."
}
```

## Submit rating

```http
POST /api/deliveries/{delivery_id}/rating
```

Request:

```json
{
  "satisfaction_score": 5,
  "client_feedback": "Thiết kế đúng brief, bàn giao nhanh."
}
```

## Close delivery

```http
POST /api/deliveries/{delivery_id}/close
```

Request:

```json
{
  "note": "Đã hoàn tất bàn giao."
}
```

## Reopen delivery

```http
POST /api/deliveries/{delivery_id}/reopen
```

Request:

```json
{
  "reason": "Client cần chỉnh sửa sau khi kiểm tra final."
}
```

---

# 21. Integration với các module khác

## 21.1. Production Board

Delivery Log nhận task từ Production Board khi:

```text
Production Status = Sẵn sàng bàn giao
```

Nếu Delivery yêu cầu sửa:

```text
Production Status = Chỉnh sửa nội bộ
hoặc Chỉnh sửa theo feedback
```

## 21.2. Database Orders

Delivery Log cập nhật ngược:

```text
delivery_status
preview_link
final_delivery_link
delivery_date
satisfaction_score
client_feedback
progress
closed_at
```

## 21.3. Reports

Delivery Log cung cấp dữ liệu:

```text
Delivery completed count
Average rating
Rating coverage
Delivery on-time rate
Reopened count
Waiting rating count
Client feedback categories
```

## 21.4. Client Tracking

Client chỉ thấy public delivery info:

```text
Preview Link
Final Link
Public Status
Feedback form
Rating form
```

---

# 22. Notification Requirements

## Khi task vào Delivery Log

Người nhận:

```text
Account
Admin nếu cần
```

Nội dung:

```text
Task TASK-0001 đã sẵn sàng bàn giao. Vui lòng kiểm tra file.
```

## Khi Account yêu cầu chỉnh sửa nội bộ

Người nhận:

```text
P.I.C
Account
```

Nội dung:

```text
Task TASK-0001 cần chỉnh sửa nội bộ trước khi bàn giao.
```

## Khi gửi preview cho client

Người nhận:

```text
Client/Requester
Account
```

Nội dung:

```text
Bạn có bản preview cần kiểm tra cho order MEDIA-2026-0001.
```

## Khi client feedback

Người nhận:

```text
Account
P.I.C
```

Nội dung:

```text
Client đã gửi feedback cho order MEDIA-2026-0001.
```

## Khi gửi final

Người nhận:

```text
Client/Requester
Account
Admin optional
```

Nội dung:

```text
Sản phẩm của bạn đã được bàn giao. Vui lòng kiểm tra link final và đánh giá mức độ hài lòng.
```

## Khi client rating

Người nhận:

```text
Account
Admin
```

Nội dung:

```text
Client đã đánh giá order MEDIA-2026-0001: 5/5.
```

---

# 23. Frontend Component Structure

```text
DeliveryLogPage
├── DeliveryHeader
│   ├── SearchInput
│   ├── FilterButton
│   └── ExportButton
│
├── DeliverySummaryCards
│   ├── ReadyForDeliveryCard
│   ├── WaitingAccountCheckCard
│   ├── PreviewSentCard
│   ├── WaitingClientFeedbackCard
│   ├── FinalSentCard
│   ├── WaitingRatingCard
│   ├── CompletedCard
│   └── ReopenedCard
│
├── DeliveryFilterBar
│   ├── DeliveryStatusFilter
│   ├── AccountFilter
│   ├── PICFilter
│   ├── ProjectFilter
│   ├── TypeFilter
│   ├── DeliveryDateFilter
│   ├── RatingFilter
│   └── OverdueFilter
│
├── DeliveryTable
│   ├── DeliveryTableRow
│   └── DeliveryActionsMenu
│
├── DeliveryDetailDrawer
│   ├── DeliveryHeaderSummary
│   ├── OrderTaskSummary
│   ├── FileLinkPanel
│   ├── DeliveryControlPanel
│   ├── FeedbackRatingPanel
│   ├── DeliveryChecklist
│   └── ActivityLog
│
├── CheckFileModal
├── SendPreviewModal
├── SendFinalModal
├── RequestRevisionModal
├── RatingModal
└── ReopenDeliveryModal
```

---

# 24. UI States

## Loading

```text
Loading deliveries...
Loading delivery detail...
Sending preview...
Sending final...
Saving rating...
Closing delivery...
```

## Empty

```text
Không có task nào chờ bàn giao.
Không có delivery nào trong bộ lọc này.
Không có task nào chờ rating.
```

## Error

```text
Không thể tải Delivery Log.
Không thể gửi final vì thiếu checklist.
Không thể chuyển delivery vì thiếu final link.
```

## Success

```text
Đã gửi preview.
Đã gửi final.
Đã ghi nhận rating.
Đã đóng delivery.
Đã yêu cầu chỉnh sửa nội bộ.
```

---

# 25. Acceptance Criteria

## Functional

```text
Task từ Production Board chuyển được sang Delivery Log khi đủ điều kiện.
Account thấy task chờ kiểm tra.
Account có thể kiểm tra file bằng checklist.
Nếu chưa đạt, Account có thể yêu cầu chỉnh sửa nội bộ.
Nếu đạt, Account có thể gửi preview/final.
Client có thể feedback hoặc rating.
Delivery Date được ghi nhận khi gửi final.
Delivery Status cập nhật đúng flow.
Delivery Log cập nhật ngược Database Orders.
Activity Log ghi nhận mọi thay đổi quan trọng.
```

## Security

```text
Client không thấy internal note/checklist/activity log nội bộ.
P.I.C không gửi final trực tiếp nếu chưa có quyền.
Account chỉ thấy delivery theo quyền.
Backend enforce permission cho mọi API.
```

## UX

```text
Table rõ ràng, có badge trạng thái.
Checklist trước bàn giao dễ thao tác.
Có warning khi thiếu link Drive hoặc thiếu quyền truy cập.
Có loading/empty/error/success state.
Có filter theo status, Account, P.I.C, rating.
```

---

# 26. Suggested Initial Build Scope

## MVP

```text
Delivery list
Delivery detail drawer
Status update
Checklist trước bàn giao
Send final
Rating 1–5
Close delivery
Sync back Database Orders
Activity Log basic
```

## Phase 2

```text
Send preview
Client feedback flow
Reopen delivery
Rating categories
Export report
Drive permission checker
Auto-close after X days
```

## Phase 3

```text
AI delivery summary
AI quality checklist suggestion
Auto reminder rating
Delivery SLA prediction
```

---

# 27. Prompt cho Dev/Claude

```text
Build the 05. Delivery Log Module for "CB Creative Flow - Media Hub by CB Centres".

Purpose:
Delivery Log is where Account/Admin manage file checking, preview/final delivery, client feedback, rating and order closing after tasks are ready from Production Board.

Main users:
Account, Admin, Client.

Required features:
- Delivery table with columns:
  Delivery ID, Order ID, Task ID, Timestamp, Project/Campaign/Event, Type, Account, PIC, Delivery Status, Delivery Date, Link Drive, Rate, Note, Action.
- Delivery detail drawer/page with blocks:
  Order & Task Summary, File & Link, Delivery Control, Feedback & Rating, Checklist, Activity Log.
- Checklist before sending final:
  brief checked, content checked, size checked, brand checked, final file checked, drive permission checked, version checked.
- Delivery statuses:
  Chưa sẵn sàng bàn giao, Chờ Account kiểm tra, Cần chỉnh sửa nội bộ, Sẵn sàng bàn giao, Đã gửi preview, Chờ client phản hồi, Client yêu cầu chỉnh sửa, Đã gửi final, Đã nhận đánh giá, Hoàn thành, Mở lại, Hủy.
- Account can send preview/final, request revision, close delivery.
- Client can view preview/final public link, submit feedback and rating.
- Delivery Log must sync delivery_status, final_link, delivery_date, satisfaction_score and client_feedback back to Database Orders.
- Use CB brand:
  Red #BA110F
  Blue #191970
  Font Montserrat
  Clean professional SaaS UI.
```
