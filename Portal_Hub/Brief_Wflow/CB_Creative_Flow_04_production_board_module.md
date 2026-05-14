# CB Creative Flow - Media Hub by CB Centres
# 04. Production Board Module — Detailed Specification for Dev

**Module:** Production Board  
**Purpose:** Cập nhật vào website portal để Design/Editor/P.I.C nhận task, theo dõi brief, cập nhật tiến độ và upload preview/final.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, clean SaaS dashboard.  
**Output chính:** Quản lý toàn bộ quá trình sản xuất task sau khi order đã được xác nhận từ Database Orders.

---

# 1. Mục đích

**Production Board Module** là nơi **Design/Editor/P.I.C** nhận task, theo dõi nội dung brief, cập nhật tiến độ và upload preview/final.

Nếu **Database Orders** là kho dữ liệu tổng, thì **Production Board** là nơi biến order thành công việc sản xuất thực tế.

```text
Order Form
→ Database Orders
→ Production Board
→ Delivery Log
→ Reports/Dashboard
```

Production Board giúp team Media:

1. Biết task nào được giao cho ai.
2. Biết deadline nội bộ của từng task.
3. Theo dõi trạng thái xử lý.
4. Cập nhật tiến độ tự động theo status.
5. Upload/link preview hoặc final.
6. Gửi task sang bước duyệt nội bộ.
7. Chuyển task sang Delivery Log khi đã sẵn sàng bàn giao.
8. Đồng bộ dữ liệu ngược về Database Orders và Reports.

---

# 2. Người dùng chính

```text
Design
Editor
Account
Admin
```

## 2.1. Design

Dùng Production Board để:

```text
Nhận task thiết kế
Xem brief
Xem source/file
Cập nhật trạng thái
Upload preview/final
Gửi duyệt nội bộ
```

## 2.2. Editor

Dùng Production Board để:

```text
Nhận task video/motion/quay/chụp
Xem brief và footage/source
Cập nhật trạng thái dựng/quay/chụp
Upload preview/final
Gửi duyệt nội bộ
```

## 2.3. Account

Dùng Production Board để:

```text
Theo dõi task của order mình phụ trách
Kiểm tra tiến độ
Comment chỉnh sửa
Duyệt nội bộ
Chuyển task sang Delivery Log
```

## 2.4. Admin

Dùng Production Board để:

```text
Xem toàn bộ task
Điều phối workload
Gán/đổi P.I.C
Đổi deadline nội bộ
Đổi priority
Theo dõi task trễ hạn
Can thiệp khi cần
```

---

# 3. Vị trí trong hệ thống

## Menu

```text
Main
└── Production Board
```

## Route đề xuất

```text
/production
/production/tasks
/production/tasks/:task_id
/production/my-tasks
/production/kanban
```

---

# 4. Điều kiện task xuất hiện trên Production Board

Task chỉ được tạo trên Production Board sau khi order trong Database Orders đủ điều kiện:

```text
Account Status = Đã xác nhận brief
P.I.C đã được gán
Internal Deadline đã có
Order không bị hủy
```

## Validation trước khi tạo task

```text
account_status = Đã xác nhận brief
production_pic_id hoặc assigned_to không rỗng
internal_deadline không rỗng
order_status != Hủy
deliverable_type không rỗng
content_brief hoặc file/source không rỗng
```

Nếu thiếu điều kiện, hệ thống báo:

```text
Không thể tạo task trên Production Board.
Vui lòng xác nhận brief, gán P.I.C và nhập Internal Deadline trước.
```

---

# 5. View cần có

Production Board cần có 3 view chính:

```text
A. Table View
B. Kanban View
C. My Tasks
```

---

# 6. A. Table View

## 6.1. Mục đích

**Table View** dùng cho **Admin/Account** quản lý nhiều task cùng lúc.

Phù hợp để:

```text
Lọc task theo P.I.C
Lọc task theo deadline
Lọc task theo trạng thái
Xem task trễ hạn
Xem task chờ duyệt nội bộ
Xem task sẵn sàng bàn giao
```

## 6.2. Table columns bắt buộc

```text
Task ID
Order ID
Project/Campaign/Event
Type
Content
Priority
P.I.C
Status
Progress
Internal Deadline
Link Drive
Last Update
Action
```

## 6.3. Giải thích cột

| Cột | Ý nghĩa |
|---|---|
| Task ID | Mã task, ví dụ: TASK-0001 |
| Order ID | Mã order liên kết, ví dụ: MEDIA-2026-0001 |
| Project/Campaign/Event | Tên chương trình/dự án/sự kiện |
| Type | Loại task: Design, Video, Photo, Shooting, Ads... |
| Content | Nội dung brief rút gọn hoặc link brief |
| Priority | Bình thường / Gấp / Rất gấp |
| P.I.C | Người xử lý chính |
| Status | Trạng thái production hiện tại |
| Progress | Tiến độ tự động theo status |
| Internal Deadline | Deadline nội bộ |
| Link Drive | Link source/working file/preview/final |
| Last Update | Lần cập nhật cuối |
| Action | Các thao tác nhanh |

## 6.4. Action trong Table View

```text
View Detail
Update Status
Change P.I.C
Change Deadline
Change Priority
Add Comment
Upload/Update Link
Send to Internal Review
Mark Ready for Delivery
Open Delivery Log
Cancel Task
```

## 6.5. Filter trong Table View

```text
Search
Status
Priority
P.I.C
Type
Internal Deadline
Project/Campaign/Event
Order ID
Overdue
Last Update
```

## 6.6. Search cần tìm theo

```text
Task ID
Order ID
Project/Campaign/Event
Type
Content
P.I.C
Status
```

---

# 7. B. Kanban View

## 7.1. Mục đích

**Kanban View** dùng cho **Design/Editor** cập nhật trạng thái trực quan.

Kanban giúp nhân sự thấy công việc của mình đang ở đâu trong workflow.

## 7.2. Kanban columns bắt buộc

```text
Chưa nhận task
Nhận task
Đang thực hiện
Chờ duyệt nội bộ
Chỉnh sửa nội bộ
Sẵn sàng bàn giao
Hoàn thành
```

## 7.3. Card task cần hiển thị

```text
Task ID
Order ID
Project/Campaign/Event
Type
Priority
P.I.C
Internal Deadline
Progress
Link Drive nếu có
```

## 7.4. Kanban action

Mỗi card nên có:

```text
View Brief
Open Source
Update Status
Add Comment
Upload Preview
Upload Final
Send to Internal Review
Mark Ready for Delivery
```

## 7.5. Drag & Drop rule

Có thể cho kéo thả giữa các cột, nhưng phải kiểm soát transition hợp lệ.

Ví dụ:

```text
Chưa nhận task → Nhận task
Nhận task → Đang thực hiện
Đang thực hiện → Chờ duyệt nội bộ
Chờ duyệt nội bộ → Chỉnh sửa nội bộ
Chờ duyệt nội bộ → Sẵn sàng bàn giao
Sẵn sàng bàn giao → Hoàn thành
```

Không nên cho P.I.C tự kéo trực tiếp:

```text
Đang thực hiện → Hoàn thành
Đang thực hiện → Đã bàn giao
```

Vì bước bàn giao cần Account kiểm tra.

---

# 8. C. My Tasks

## 8.1. Mục đích

**My Tasks** dùng cho từng nhân sự Design/Editor/P.I.C xem các task được giao cho mình.

## 8.2. Nhóm task trong My Tasks

```text
Task mới được giao
Đang thực hiện
Cần chỉnh sửa
Sắp đến hạn
Hoàn thành gần đây
```

## 8.3. My Tasks filter

```text
Status
Priority
Internal Deadline
Type
Project/Campaign/Event
Order ID
```

## 8.4. My Tasks permission

```text
Design/Editor chỉ thấy task assigned_to = current_user_id.
Account có thể thấy task thuộc order mình phụ trách.
Admin thấy tất cả.
```

---

# 9. Chức năng của P.I.C

P.I.C có thể thao tác:

```text
Nhận task
Xem brief
Xem file/source
Cập nhật status
Thêm ghi chú
Upload/link preview
Upload/link final
Gửi duyệt nội bộ
Đánh dấu sẵn sàng bàn giao
```

## 9.1. P.I.C không nên có quyền mặc định

```text
Gửi final trực tiếp cho client
Đóng order tổng
Đổi Account Status
Xóa order/task
Xem report toàn hệ thống
Đổi P.I.C của người khác
Đổi deadline nếu không được cấp quyền
```

---

# 10. Chức năng của Account/Admin

Account/Admin có thể thao tác:

```text
Xem toàn bộ task
Gán/đổi P.I.C
Đổi deadline nội bộ
Đổi priority
Comment chỉnh sửa
Duyệt nội bộ
Chuyển task sang Delivery Log
```

## 10.1. Account/Admin kiểm tra nội bộ

Khi P.I.C gửi task sang **Chờ duyệt nội bộ**, Account/Admin kiểm tra:

```text
Đúng brief chưa
Đúng kích thước chưa
Đúng nội dung chưa
Đúng brand CB chưa
Đúng file/link chưa
Có cần chỉnh sửa nội bộ không
```

Nếu chưa đạt:

```text
Status = Chỉnh sửa nội bộ
Comment yêu cầu chỉnh sửa
```

Nếu đạt:

```text
Status = Sẵn sàng bàn giao
Task được chuyển sang Delivery Log
```

---

# 11. Production Status

Production Status cần chuẩn hóa như sau:

```text
Chưa nhận task
Nhận task
Đang thực hiện
Chờ duyệt nội bộ
Chỉnh sửa nội bộ
Chờ client phản hồi
Chỉnh sửa theo feedback
Sẵn sàng bàn giao
Đã bàn giao
Hoàn thành
Tạm dừng
Hủy
```

## 11.1. Ý nghĩa status

| Status | Ý nghĩa |
|---|---|
| Chưa nhận task | Task đã được giao nhưng P.I.C chưa xác nhận |
| Nhận task | P.I.C đã nhận việc |
| Đang thực hiện | P.I.C đang sản xuất |
| Chờ duyệt nội bộ | P.I.C đã gửi preview/final cho Account/Admin kiểm tra |
| Chỉnh sửa nội bộ | Cần chỉnh theo góp ý nội bộ |
| Chờ client phản hồi | Đã gửi client xem/duyệt |
| Chỉnh sửa theo feedback | Đang chỉnh theo feedback client |
| Sẵn sàng bàn giao | Đã đạt, chờ Account gửi final |
| Đã bàn giao | Final đã được gửi |
| Hoàn thành | Task đóng |
| Tạm dừng | Tạm ngưng do thiếu thông tin/quyết định |
| Hủy | Không triển khai |

---

# 12. Progress tự động

Progress nên tự động theo status, không để P.I.C nhập tay nếu không cần.

| Status | Progress |
|---|---:|
| Chưa nhận task | 20% |
| Nhận task | 30% |
| Đang thực hiện | 50% |
| Chờ duyệt nội bộ | 65% |
| Chỉnh sửa nội bộ | 75% |
| Chờ client phản hồi | 80% |
| Chỉnh sửa theo feedback | 85% |
| Sẵn sàng bàn giao | 90% |
| Đã bàn giao | 95% |
| Hoàn thành | 100% |
| Hủy | 0% |

## 12.1. Rule

```text
Khi Status thay đổi → Progress tự động cập nhật.
Khi Progress cập nhật → Last Update tự động ghi nhận.
Khi Status = Hoàn thành → Completed At tự động ghi nhận.
Khi Status = Hủy → Progress = 0%.
```

---

# 13. Output của Production Board Module

Khi P.I.C hoặc Account/Admin thao tác trên Production Board, hệ thống cần tạo các output sau:

```text
Task status được cập nhật
Progress được cập nhật
Last Update được ghi nhận
Preview/final link được lưu
Activity Log được tạo
Task sẵn sàng chuyển sang Delivery Log
```

---

# 14. Task Detail Page / Drawer

## 14.1. Mục đích

Task Detail giúp P.I.C/Account/Admin xem và xử lý một task cụ thể.

## 14.2. Layout đề xuất

```text
Task Detail
├── Header Summary
│   ├── Task ID
│   ├── Order ID
│   ├── Project/Campaign/Event
│   ├── Priority
│   ├── Status
│   ├── Progress
│   └── Internal Deadline
│
├── Brief Information
├── Files & Links
├── Status & Progress
├── Comments
├── Activity Log
└── Action Panel
```

## 14.3. Header Summary fields

```text
Task ID
Order ID
Project/Campaign/Event
Type
Priority
P.I.C
Status
Progress
Internal Deadline
Last Update
```

## 14.4. Brief Information

```text
Content/Brief
Size/Ratio
Creative Direction
Target Audience
Usage Channel
Source Link
File Brief
Note
```

## 14.5. Files & Links

```text
Source Link
Working Drive Link
Preview Link
Final Link
Uploaded Files
```

## 14.6. Comments

Comment cần hỗ trợ:

```text
Internal comment
Revision comment
Client feedback nếu được chuyển từ Delivery Log
Mention user nếu có phase sau
Attachment nếu cần
```

---

# 15. Data Model — Tasks

| Field | Type | Required | Note |
|---|---|---:|---|
| task_id | string | Yes | TASK-0001 |
| order_id | string | Yes | FK Orders |
| project_name | string | Yes | Snapshot từ Orders |
| task_type | string | Yes | Type |
| content | text | Yes | Brief/content |
| priority | enum | Yes | Bình thường/Gấp/Rất gấp |
| assigned_to | string | Yes | P.I.C |
| status | enum | Yes | Production Status |
| progress | number | Yes | 0–100 |
| internal_deadline | datetime | Yes | Deadline nội bộ |
| link_drive | string | No | Link source/working/final |
| preview_link | string | No | Link preview |
| final_link | string | No | Link final |
| last_update | datetime | Yes | Last Update |
| completed_at | datetime | No | Ngày hoàn thành |
| note | text | No | Ghi chú |
| revision_count | number | No | Số vòng chỉnh sửa |
| created_at | datetime | Yes | Ngày tạo |

## 15.1. Field mở rộng khuyến nghị

| Field | Type | Note |
|---|---|---|
| role_tag | enum | Design/Editor/Photo/Video/Account |
| created_by | string | User tạo task |
| assigned_at | datetime | Thời điểm giao task |
| accepted_at | datetime | P.I.C nhận task |
| ready_for_delivery_at | datetime | Thời điểm sẵn sàng bàn giao |
| cancelled_at | datetime | Nếu task hủy |
| cancel_reason | text | Lý do hủy |
| reopened_count | number | Số lần mở lại |
| client_feedback_count | number | Số lần feedback từ client |

---

# 16. API đề xuất cho Production Board

## 16.1. List tasks

```http
GET /api/tasks
```

Query params:

```text
search
status
priority
assigned_to
task_type
internal_deadline
overdue
order_id
page
limit
sort
```

## 16.2. Get task detail

```http
GET /api/tasks/{task_id}
```

## 16.3. Update task status

```http
PATCH /api/tasks/{task_id}/status
```

Request:

```json
{
  "status": "Đang thực hiện",
  "note": "Đã bắt đầu thiết kế KV."
}
```

Response:

```json
{
  "success": true,
  "task_id": "TASK-0001",
  "status": "Đang thực hiện",
  "progress": 50,
  "last_update": "2026-03-10T16:02:00+07:00"
}
```

## 16.4. Upload/update task link

```http
PATCH /api/tasks/{task_id}/links
```

Request:

```json
{
  "preview_link": "https://drive.google.com/...",
  "final_link": "",
  "link_drive": "https://drive.google.com/..."
}
```

## 16.5. Assign/change P.I.C

```http
PATCH /api/tasks/{task_id}/assign
```

Request:

```json
{
  "assigned_to": "USER-DESIGN-001",
  "reason": "Điều phối lại workload."
}
```

## 16.6. Change internal deadline

```http
PATCH /api/tasks/{task_id}/deadline
```

Request:

```json
{
  "internal_deadline": "2026-03-14T17:00:00+07:00",
  "reason": "Điều chỉnh theo timeline mới."
}
```

## 16.7. Add comment

```http
POST /api/tasks/{task_id}/comments
```

Request:

```json
{
  "comment": "Cần kiểm tra lại wording CTA và kích thước logo.",
  "comment_type": "Internal"
}
```

## 16.8. Mark ready for delivery

```http
POST /api/tasks/{task_id}/ready-for-delivery
```

Response:

```json
{
  "success": true,
  "task_id": "TASK-0001",
  "status": "Sẵn sàng bàn giao",
  "progress": 90,
  "delivery_status": "Chờ Account kiểm tra"
}
```

---

# 17. Điều kiện chuyển sang Delivery Log

Task chỉ được chuyển sang Delivery Log khi:

```text
Status = Sẵn sàng bàn giao
Preview hoặc Final Link không rỗng
Account/Admin đã kiểm tra nội bộ
Task không bị hủy
```

Nếu thiếu link:

```text
Không thể chuyển sang Delivery Log.
Vui lòng cập nhật Preview Link hoặc Final Link trước.
```

## 17.1. Delivery record được tạo

Khi task sẵn sàng bàn giao, hệ thống tạo record trong Delivery Log:

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

# 18. Integration với Database Orders

Production Board phải cập nhật ngược về Database Orders.

| Production Board thay đổi | Database Orders cập nhật |
|---|---|
| Status thay đổi | production_status |
| Progress thay đổi | progress |
| P.I.C thay đổi | production_pic_id |
| Internal Deadline thay đổi | internal_deadline |
| Preview/final link thêm mới | preview_link/final_delivery_link |
| Last Update thay đổi | updated_at |
| Task hoàn thành | completed_at/order progress |

Nếu một order có nhiều task:

```text
Order progress = average(task progress)
Order production_status = trạng thái tổng hợp từ các task con
```

---

# 19. Activity Log

Mỗi hành động cần ghi log:

```text
task_created
task_assigned
task_status_changed
task_deadline_changed
task_priority_changed
task_comment_added
task_link_uploaded
task_ready_for_delivery
task_completed
task_cancelled
```

Log fields:

```text
log_id
order_id
task_id
user_id
action_type
old_value
new_value
comment
created_at
```

Ví dụ log:

```text
10/03/2026 16:02 — Duy chuyển TASK-0001 từ Nhận task sang Đang thực hiện.
10/03/2026 16:10 — Duy upload Preview Link.
10/03/2026 16:20 — Hậu comment: Cần chỉnh CTA và kiểm logo.
```

---

# 20. Notification Requirements

## 20.1. Khi task được tạo/gán P.I.C

Người nhận:

```text
P.I.C
Account
Admin nếu cần
```

Nội dung:

```text
Bạn có task mới được giao.
Task ID: TASK-0001
Order ID: MEDIA-2026-0001
Deadline nội bộ: 14/03/2026 17:00
```

## 20.2. Khi P.I.C cập nhật Chờ duyệt nội bộ

Người nhận:

```text
Account
Admin nếu cần
```

Nội dung:

```text
Task TASK-0001 đã có bản preview/final cần kiểm tra nội bộ.
```

## 20.3. Khi task trễ hạn

Người nhận:

```text
P.I.C
Account
Admin
```

Nội dung:

```text
Task TASK-0001 đã trễ deadline nội bộ.
```

## 20.4. Khi task sẵn sàng bàn giao

Người nhận:

```text
Account
```

Nội dung:

```text
Task TASK-0001 đã sẵn sàng bàn giao. Vui lòng kiểm tra Delivery Log.
```

---

# 21. Frontend Component Structure

```text
ProductionBoardPage
├── ProductionHeader
│   ├── SearchInput
│   ├── ViewToggle
│   │   ├── Table View
│   │   ├── Kanban View
│   │   └── My Tasks
│   └── FilterButton
│
├── ProductionSummaryCards
│   ├── Total Tasks
│   ├── My Open Tasks
│   ├── Due Soon
│   ├── Overdue
│   ├── Internal Review
│   └── Ready for Delivery
│
├── ProductionFilterBar
│   ├── StatusFilter
│   ├── PriorityFilter
│   ├── PICFilter
│   ├── TypeFilter
│   ├── DeadlineFilter
│   └── OverdueFilter
│
├── TableView
│   ├── TaskTable
│   └── TaskActionsMenu
│
├── KanbanView
│   ├── KanbanColumn
│   └── TaskCard
│
├── MyTasksView
│   ├── NewAssigned
│   ├── InProgress
│   ├── NeedRevision
│   ├── DueSoon
│   └── RecentlyCompleted
│
├── TaskDetailDrawer
│   ├── TaskHeaderSummary
│   ├── BriefInformation
│   ├── FilesLinks
│   ├── StatusProgress
│   ├── Comments
│   └── ActivityLog
│
├── UpdateStatusModal
├── UploadLinkModal
├── ChangePICModal
├── ChangeDeadlineModal
└── ReadyForDeliveryModal
```

---

# 22. UI States

## 22.1. Loading state

```text
Loading tasks...
Loading task detail...
Updating status...
Uploading link...
Changing P.I.C...
Moving to Delivery Log...
```

## 22.2. Empty state

```text
Chưa có task nào trong bộ lọc này.
Bạn chưa có task mới.
Không có task sắp đến hạn.
Không có task trễ hạn.
```

## 22.3. Error state

```text
Không thể tải danh sách task.
Không thể cập nhật trạng thái.
Không thể chuyển sang Delivery Log vì thiếu preview/final link.
```

## 22.4. Success state

```text
Đã cập nhật trạng thái.
Đã lưu link preview/final.
Đã chuyển task sang Delivery Log.
Đã đổi P.I.C.
```

---

# 23. UX Notes

1. Table View ưu tiên cho Admin/Account.
2. Kanban View ưu tiên cho Design/Editor.
3. My Tasks là view mặc định cho Design/Editor khi đăng nhập.
4. Status badge phải rõ màu.
5. Progress bar cần tự động và dễ nhìn.
6. Task overdue cần highlight đỏ.
7. Task gấp/rất gấp cần badge nổi bật.
8. Action nguy hiểm như hủy task cần confirmation.
9. P.I.C không nên tự chuyển task sang Hoàn thành nếu chưa qua Delivery.
10. Activity Log cần lưu mọi thay đổi quan trọng.
11. Nếu link Drive trống, không cho chuyển sang Delivery Log.
12. Cần responsive cho màn hình laptop và tablet; mobile có thể dùng card list.

---

# 24. Validation Rules

## 24.1. Update status validation

```text
status required
status must be valid production status
user must have permission
transition must be allowed
```

## 24.2. Send to internal review validation

```text
preview_link or final_link required
status should be Đang thực hiện or Chỉnh sửa nội bộ
```

## 24.3. Mark ready for delivery validation

```text
status must be Chờ duyệt nội bộ or Chỉnh sửa nội bộ
preview_link or final_link required
Account/Admin approval required
task is not cancelled
```

## 24.4. Change P.I.C validation

```text
new assigned_to user must be Active
new assigned_to tag should match task_type
reason required if task already in progress
```

## 24.5. Change deadline validation

```text
internal_deadline required
reason required if deadline is extended
user must have Account/Admin permission
```

---

# 25. Acceptance Criteria — Production Board Module

## Functional

```text
Task được tạo từ Database Orders sau khi brief xác nhận.
Design/Editor chỉ thấy task được gán cho mình trong My Tasks.
Admin/Account xem được toàn bộ task theo quyền.
P.I.C có thể nhận task.
P.I.C có thể cập nhật status.
Status thay đổi thì progress tự động cập nhật.
P.I.C có thể upload/link preview/final.
Account/Admin có thể comment chỉnh sửa.
Account/Admin có thể chuyển task sang Delivery Log.
Production Board cập nhật ngược Database Orders.
Activity Log được tạo cho các thay đổi quan trọng.
```

## Security

```text
Design/Editor không được xem task không được assign.
P.I.C không được gửi final trực tiếp cho client nếu chưa có quyền.
P.I.C không được đóng order tổng.
Backend phải kiểm tra permission cho mọi API.
```

## UX

```text
Có Table View cho Admin/Account.
Có Kanban View cho Design/Editor.
Có My Tasks cho từng nhân sự.
Status badge rõ màu.
Progress bar dễ nhìn.
Task overdue được highlight.
Có loading/empty/error/success state.
```

---

# 26. Suggested Initial Build Scope

## MVP

```text
Task list Table View
Kanban View basic
My Tasks
Task Detail Drawer
Update Status
Auto Progress
Upload/link preview/final
Comment basic
Ready for Delivery action
Sync back to Database Orders
Activity Log basic
```

## Phase 2

```text
Drag & drop Kanban
Advanced filter
Bulk update
Deadline alert
Workload by P.I.C
Mention user in comment
File upload progress
```

## Phase 3

```text
AI task summary
AI missing asset check
Auto workload recommendation
Realtime update
Advanced approval flow
```

---

# 27. Prompt cho Dev/Claude

```text
Build the 04. Production Board Module for "CB Creative Flow - Media Hub by CB Centres".

Purpose:
This module is where Design/Editor/PIC receive tasks, track brief content, update progress and upload preview/final.

Main users:
Design, Editor, Account, Admin.

Required views:
1. Table View for Admin/Account:
Task ID, Order ID, Project/Campaign/Event, Type, Content, Priority, PIC, Status, Progress, Internal Deadline, Link Drive, Last Update, Action.

2. Kanban View for Design/Editor:
Columns:
Chưa nhận task, Nhận task, Đang thực hiện, Chờ duyệt nội bộ, Chỉnh sửa nội bộ, Sẵn sàng bàn giao, Hoàn thành.

3. My Tasks for each PIC:
Task mới được giao, Đang thực hiện, Cần chỉnh sửa, Sắp đến hạn, Hoàn thành gần đây.

PIC actions:
Nhận task, xem brief, xem file/source, cập nhật status, thêm ghi chú, upload/link preview, upload/link final, gửi duyệt nội bộ, đánh dấu sẵn sàng bàn giao.

Account/Admin actions:
Xem toàn bộ task, gán/đổi PIC, đổi deadline nội bộ, đổi priority, comment chỉnh sửa, duyệt nội bộ, chuyển task sang Delivery Log.

Production Status:
Chưa nhận task, Nhận task, Đang thực hiện, Chờ duyệt nội bộ, Chỉnh sửa nội bộ, Chờ client phản hồi, Chỉnh sửa theo feedback, Sẵn sàng bàn giao, Đã bàn giao, Hoàn thành, Tạm dừng, Hủy.

Auto progress mapping:
Chưa nhận task = 20%
Nhận task = 30%
Đang thực hiện = 50%
Chờ duyệt nội bộ = 65%
Chỉnh sửa nội bộ = 75%
Chờ client phản hồi = 80%
Chỉnh sửa theo feedback = 85%
Sẵn sàng bàn giao = 90%
Đã bàn giao = 95%
Hoàn thành = 100%
Hủy = 0%

Outputs:
Task status updated
Progress updated
Last Update recorded
Preview/final link saved
Activity Log created
Task can move to Delivery Log when ready.

Use CB brand:
Red #BA110F
Blue #191970
Font Montserrat
Clean professional SaaS UI.
```
