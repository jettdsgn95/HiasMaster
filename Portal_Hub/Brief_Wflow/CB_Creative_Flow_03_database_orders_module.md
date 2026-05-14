# CB Creative Flow - Media Hub by CB Centres  
# 03. Database Orders Module & 04. Production Board Module

**Mục đích tài liệu:** Chuẩn hóa đặc tả 2 module lõi để Dev cập nhật vào website portal.  
**Phạm vi:** Database Orders và Production Board.  
**Vai trò trong hệ thống:**  
`Order Form → Database Orders → Production Board → Delivery Log → Reports/Dashboard`

---

# 03. Database Orders Module

## 1. Mục đích

**Database Orders Module** là kho dữ liệu tổng, lưu toàn bộ order sau khi **Order Form** đổ về.

Đây là **single source of truth** của hệ thống, dùng để:

- Lưu dữ liệu order gốc.
- Cho Admin/Account kiểm tra brief.
- Xác nhận hoặc yêu cầu bổ sung thông tin.
- Gán Account/P.I.C.
- Set deadline nội bộ.
- Điều phối task sang **Production Board**.
- Đồng bộ dữ liệu cho Dashboard/Reports.

---

## 2. Người dùng chính

```text
Admin
Account
```

### Admin

Admin có quyền cao nhất:

```text
Xem toàn bộ order
Sửa trạng thái
Gán Account/P.I.C
Set deadline nội bộ
Hủy/mở lại order
Export dữ liệu
Theo dõi toàn bộ workflow
```

### Account

Account dùng module này để:

```text
Kiểm tra brief
Yêu cầu bổ sung thông tin
Xác nhận brief
Gán P.I.C nếu được cấp quyền
Set deadline nội bộ nếu được cấp quyền
Theo dõi các order mình phụ trách
```

---

## 3. Chức năng chính

```text
Xem danh sách order
Tìm kiếm order
Filter theo trạng thái, chi nhánh, deadline, priority, PIC
Xem chi tiết order
Kiểm tra brief
Yêu cầu bổ sung thông tin
Xác nhận brief
Gán Account/P.I.C
Set deadline nội bộ
Đồng bộ task sang Production Board
```

---

## 4. Database Orders — Table View cần có

Table view là màn hình chính để Admin/Account quản lý order.

| Cột | Ý nghĩa |
|---|---|
| Order ID | Mã order tự động, ví dụ: MEDIA-2026-0001 |
| Timestamp | Thời gian order được tạo |
| Requester | Người gửi yêu cầu |
| Email | Email người gửi |
| Chi nhánh/Bộ phận | Đơn vị gửi yêu cầu |
| Project/Campaign/Event | Tên dự án/chương trình/sự kiện |
| Request Type | Loại yêu cầu: Design, Video, Quay, Chụp, Ads... |
| Deliverable Type | Hạng mục cụ thể: Standee, Backdrop, Social Post, Reel... |
| Priority | Bình thường / Gấp / Rất gấp |
| Requested Deadline | Deadline mong muốn từ requester |
| Account Status | Trạng thái kiểm tra brief |
| Production Status | Trạng thái sản xuất tổng quan |
| P.I.C | Người xử lý chính |
| Progress | % tiến độ |
| Last Updated | Lần cập nhật gần nhất |
| Action | Các thao tác nhanh |

### Action đề xuất

```text
View Detail
Check Brief
Request More Info
Confirm Brief
Assign PIC
Set Internal Deadline
Generate Task
Open Production Board
Cancel Order
Reopen Order
```

---

## 5. Search & Filter

### Search cần tìm được theo:

```text
Order ID
Requester
Email
Chi nhánh/Bộ phận
Project/Campaign/Event
Request Type
Deliverable Type
P.I.C
Nội dung brief
```

### Filter cần có:

```text
Account Status
Production Status
Priority
Requested Deadline
Internal Deadline
Chi nhánh/Bộ phận
Request Type
Deliverable Type
Account PIC
Production PIC/P.I.C
Overdue
Last Updated
```

### Saved views đề xuất:

```text
Đơn mới cần kiểm tra
Đơn cần bổ sung brief
Đơn đã xác nhận brief
Đơn chưa gán P.I.C
Đơn gấp
Đơn sắp đến hạn
Đơn trễ deadline
Đơn đang production
Đơn đã hoàn thành
```

---

# 6. Order Detail Page

Order Detail Page cần chia thành các block rõ ràng để Admin/Account kiểm tra nhanh.

---

## Block A — Requester Information

### Mục đích

Hiển thị thông tin người gửi yêu cầu để Account có thể liên hệ và xác định nguồn order.

### Fields

```text
Họ và tên
Email
SĐT
Chi nhánh/Bộ phận
Ngày gửi
```

### Data keys gợi ý

| UI Field | Data key |
|---|---|
| Họ và tên | requester_name |
| Email | requester_email |
| SĐT | requester_contact |
| Chi nhánh/Bộ phận | department |
| Ngày gửi | created_at |

---

## Block B — Brief Information

### Mục đích

Hiển thị toàn bộ thông tin brief để Account đánh giá brief đủ hay thiếu.

### Fields

```text
Mục đích
Đối tượng mục tiêu
Loại yêu cầu
Hạng mục
Kích thước
Nội dung
Định hướng thiết kế
Wording
File brief
Source link
Ghi chú
```

### Data keys gợi ý

| UI Field | Data key |
|---|---|
| Mục đích | project_purpose |
| Đối tượng mục tiêu | target_audience |
| Loại yêu cầu | request_type |
| Hạng mục | deliverable_type |
| Kích thước | size_ratio |
| Nội dung | content_brief |
| Định hướng thiết kế | creative_direction |
| Wording | wording_required |
| File brief | file_brief_url |
| Source link | source_link |
| Ghi chú | note |

### Brief checklist cho Account

Account nên có checklist để xác nhận brief:

```text
Có mục đích sử dụng rõ ràng
Có đối tượng mục tiêu
Có loại yêu cầu
Có hạng mục cụ thể
Có kích thước/tỉ lệ
Có nội dung cần thể hiện
Có định hướng thiết kế hoặc reference nếu cần
Có file brief/source link nếu cần
Có deadline mong muốn
Có xác nhận trách nhiệm nội dung từ requester
```

---

## Block C — Internal Management

### Mục đích

Đây là khu vực nội bộ dành cho Account/Admin quản lý trạng thái, phân công và deadline.

### Fields

```text
Account Status
Account PIC
Production PIC
Priority
Internal Deadline
Production Status
Internal Note
```

### Data keys gợi ý

| UI Field | Data key |
|---|---|
| Account Status | account_status |
| Account PIC | account_pic_id |
| Production PIC | production_pic_id |
| Priority | priority |
| Internal Deadline | internal_deadline |
| Production Status | production_status |
| Internal Note | internal_note |

### Lưu ý phân quyền

```text
Client không được thấy Block C.
Design/Editor không cần thấy toàn bộ Block C, chỉ thấy các thông tin liên quan task của mình ở Production Board.
Admin thấy toàn bộ.
Account thấy theo order được phân quyền.
```

---

## Block D — Delivery Summary

### Mục đích

Hiển thị tóm tắt trạng thái bàn giao của order.

### Fields

```text
Preview Link
Final Link
Delivery Status
Delivery Date
Rating
Client Feedback
```

### Data keys gợi ý

| UI Field | Data key |
|---|---|
| Preview Link | preview_link |
| Final Link | final_delivery_link |
| Delivery Status | delivery_status |
| Delivery Date | delivery_date |
| Rating | satisfaction_score |
| Client Feedback | client_feedback |

---

# 7. Account Status

Account Status thể hiện trạng thái kiểm tra brief trước khi đưa vào Production Board.

## Status list

```text
Chờ xác nhận
Đang kiểm tra brief
Cần bổ sung thông tin
Đã xác nhận brief
Từ chối/Hủy đơn
```

## Ý nghĩa từng status

| Account Status | Ý nghĩa |
|---|---|
| Chờ xác nhận | Order mới được gửi, Account chưa kiểm tra |
| Đang kiểm tra brief | Account đang xem brief |
| Cần bổ sung thông tin | Brief thiếu, cần requester bổ sung |
| Đã xác nhận brief | Brief đủ điều kiện triển khai |
| Từ chối/Hủy đơn | Order không hợp lệ hoặc không triển khai |

## Status transition đề xuất

```text
Chờ xác nhận
→ Đang kiểm tra brief
→ Cần bổ sung thông tin
→ Đang kiểm tra brief
→ Đã xác nhận brief
→ Đẩy sang Production Board
```

Có thể hủy từ nhiều trạng thái nếu có lý do:

```text
Chờ xác nhận → Từ chối/Hủy đơn
Cần bổ sung thông tin → Từ chối/Hủy đơn
Đã xác nhận brief → Từ chối/Hủy đơn nếu chưa production
```

---

# 8. Điều kiện đẩy sang Production Board

Order **chỉ được đồng bộ sang Production Board** khi đủ các điều kiện sau:

```text
Account Status = Đã xác nhận brief
P.I.C đã được gán
Internal Deadline đã có
Order không bị hủy
```

## Validation trước khi đẩy

Hệ thống cần kiểm tra:

```text
account_status = Đã xác nhận brief
production_pic_id không rỗng
internal_deadline không rỗng
order_status != Hủy
deliverable_type không rỗng
content_brief hoặc file/source không rỗng
```

Nếu thiếu thông tin, hiển thị lỗi:

```text
Không thể chuyển sang Production Board.
Vui lòng xác nhận brief, gán P.I.C và nhập Internal Deadline trước khi tạo task.
```

---

# 9. Output của Database Orders Module

Khi order đủ điều kiện và được chuyển sang Production Board, hệ thống cần tạo task với dữ liệu tối thiểu:

```text
Task ID
Order ID
Project/Campaign/Event
Type
Content
Priority
P.I.C
Status = Chưa nhận task
Progress = 20%
Internal Deadline
Link Drive/Source
Last Update
```

---

# 10. Data Model — Orders

## Bảng Orders

| Field | Type | Required | Note |
|---|---|---:|---|
| order_id | string | Yes | MEDIA-YYYY-0001 |
| created_at | datetime | Yes | Timestamp |
| updated_at | datetime | Yes | Last Updated |
| requester_name | string | Yes | Người gửi |
| requester_email | string | Yes | Email |
| requester_contact | string | Yes | SĐT |
| department | string | Yes | Chi nhánh/Bộ phận |
| project_name | string | Yes | Project/Campaign/Event |
| project_purpose | text | Yes | Mục đích |
| target_audience | array/string | Yes | Đối tượng mục tiêu |
| request_type | enum | Yes | Loại yêu cầu |
| deliverable_type | array/string | Yes | Hạng mục |
| size_ratio | string | Conditional | Kích thước |
| content_brief | text | Conditional | Nội dung |
| creative_direction | text | No | Định hướng thiết kế |
| wording_required | boolean | Yes | Có cần wording |
| file_brief_url | string | No | File brief |
| source_link | string | No | Link tài nguyên |
| note | text | No | Ghi chú |
| priority | enum | Yes | Bình thường/Gấp/Rất gấp |
| requested_deadline | datetime | Yes | Deadline requester |
| account_status | enum | Yes | Trạng thái Account |
| account_pic_id | string | No | Account phụ trách |
| production_pic_id | string | No | P.I.C |
| internal_deadline | datetime | No | Deadline nội bộ |
| production_status | enum | Yes | Trạng thái production |
| delivery_status | enum | Yes | Trạng thái delivery |
| progress | number | Yes | 0–100 |
| preview_link | string | No | Link preview |
| final_delivery_link | string | No | Link final |
| delivery_date | datetime | No | Ngày bàn giao |
| satisfaction_score | number | No | Rating 1–5 |
| client_feedback | text | No | Feedback |
| internal_note | text | No | Note nội bộ |
| order_status | enum | Yes | Active/Completed/Cancelled |

---

# 11. API đề xuất cho Database Orders

## List orders

```http
GET /api/orders
```

Query params:

```text
search
start_date
end_date
account_status
production_status
priority
request_type
deliverable_type
department
account_pic_id
production_pic_id
overdue
page
limit
sort
```

## Get order detail

```http
GET /api/orders/{order_id}
```

## Update account status

```http
PATCH /api/orders/{order_id}/account-status
```

Request:

```json
{
  "account_status": "Cần bổ sung thông tin",
  "comment": "Thiếu kích thước và source hình ảnh."
}
```

## Confirm brief

```http
POST /api/orders/{order_id}/confirm-brief
```

Request:

```json
{
  "account_status": "Đã xác nhận brief",
  "brief_status": "Complete",
  "internal_note": "Brief đủ, có thể triển khai."
}
```

## Assign P.I.C and internal deadline

```http
POST /api/orders/{order_id}/assign
```

Request:

```json
{
  "account_pic_id": "USER-ACCOUNT-001",
  "production_pic_id": "USER-DESIGN-002",
  "internal_deadline": "2026-03-14T17:00:00+07:00",
  "priority": "Gấp",
  "note": "Ưu tiên do deadline gần."
}
```

## Push to Production Board

```http
POST /api/orders/{order_id}/push-to-production
```

Response:

```json
{
  "success": true,
  "task_id": "TASK-0001",
  "order_id": "MEDIA-2026-0001",
  "status": "Chưa nhận task",
  "progress": 20
}
```

---

# 12. Acceptance Criteria — Database Orders Module

## Functional

```text
Order Form submit phải tạo record trong Database Orders.
Admin xem được toàn bộ order.
Account xem được order theo quyền.
Có search/filter/sort/pagination.
Có Order Detail Page chia block rõ ràng.
Account có thể kiểm tra brief.
Account có thể yêu cầu bổ sung thông tin.
Account có thể xác nhận brief.
Admin/Account có thể gán Account/P.I.C.
Admin/Account có thể set Internal Deadline.
Order chỉ đẩy sang Production Board khi đủ điều kiện.
Có Activity Log cho các thay đổi quan trọng.
```

## Security

```text
Client không được thấy Database Orders nội bộ.
Design/Editor không được thấy order chưa được assign thành task.
Backend phải enforce permission, không chỉ frontend.
Internal Note, Internal Deadline không public cho Client.
```

## UX

```text
Table dễ đọc, có badge trạng thái.
Order ID nổi bật và copy được.
Action rõ ràng.
Có loading/empty/error/success state.
Có warning nếu order thiếu điều kiện để chuyển Production Board.
```

---

# 04. Production Board Module

## 1. Mục đích

**Production Board Module** là nơi **Design/Editor/P.I.C** nhận task, theo dõi nội dung brief, cập nhật tiến độ và upload preview/final.

Nếu **Database Orders** là kho dữ liệu tổng, thì **Production Board** là nơi biến order thành công việc sản xuất thực tế.

```text
Database Orders → Production Board → Delivery Log
```

---

## 2. Người dùng chính

```text
Design
Editor
Account
Admin
```

### Design/Editor/P.I.C

Dùng để:

```text
Nhận task
Xem brief
Xem source/file
Cập nhật trạng thái
Upload preview/final
Gửi duyệt nội bộ
Đánh dấu sẵn sàng bàn giao
```

### Account/Admin

Dùng để:

```text
Theo dõi toàn bộ task
Kiểm tra tiến độ
Gán/đổi P.I.C
Đổi deadline nội bộ
Duyệt nội bộ
Chuyển task sang Delivery Log
```

---

# 3. View cần có

Production Board cần có 3 view chính:

```text
A. Table View
B. Kanban View
C. My Tasks
```

---

## A. Table View

### Mục đích

Dùng cho **Admin/Account** quản lý nhiều task cùng lúc.

### Columns cần có

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

### Action đề xuất

```text
View Detail
Update Status
Change P.I.C
Change Deadline
Add Comment
Upload Link
Send to Internal Review
Mark Ready for Delivery
Open Delivery Log
```

---

## B. Kanban View

### Mục đích

Dùng cho **Design/Editor** cập nhật trạng thái trực quan.

### Kanban columns

```text
Chưa nhận task
Nhận task
Đang thực hiện
Chờ duyệt nội bộ
Chỉnh sửa nội bộ
Sẵn sàng bàn giao
Hoàn thành
```

### Card task cần hiển thị

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

---

## C. My Tasks

### Mục đích

Dùng cho từng nhân sự xem task của mình.

### Nhóm task trong My Tasks

```text
Task mới được giao
Đang thực hiện
Cần chỉnh sửa
Sắp đến hạn
Hoàn thành gần đây
```

### Filter trong My Tasks

```text
Status
Priority
Internal Deadline
Type
Project/Campaign/Event
```

---

# 4. Chức năng của P.I.C

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

## P.I.C không nên có quyền mặc định:

```text
Gửi final trực tiếp cho client
Đóng order tổng
Đổi Account Status
Xóa order/task
Xem report toàn hệ thống
```

---

# 5. Chức năng của Account/Admin

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

## Account/Admin kiểm tra nội bộ

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

# 6. Production Status

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

## Ý nghĩa status

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

# 7. Progress tự động

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

## Rule

```text
Khi Status thay đổi → Progress tự động cập nhật.
Khi Progress cập nhật → Last Update tự động ghi nhận.
Khi Status = Hoàn thành → Completed At tự động ghi nhận.
```

---

# 8. Output của Production Board Module

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

# 9. Data Model — Tasks

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

---

# 10. API đề xuất cho Production Board

## List tasks

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

## Get task detail

```http
GET /api/tasks/{task_id}
```

## Update task status

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

## Upload/update task link

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

## Assign/change P.I.C

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

## Mark ready for delivery

```http
POST /api/tasks/{task_id}/ready-for-delivery
```

Response:

```json
{
  "success": true,
  "task_id": "TASK-0001",
  "delivery_status": "Chờ Account kiểm tra"
}
```

---

# 11. Điều kiện chuyển sang Delivery Log

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

---

# 12. Integration với Database Orders

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

# 13. Activity Log

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

---

# 14. Notification Requirements

## Khi task được tạo/gán P.I.C

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

## Khi P.I.C cập nhật Chờ duyệt nội bộ

Người nhận:

```text
Account
Admin nếu cần
```

Nội dung:

```text
Task TASK-0001 đã có bản preview/final cần kiểm tra nội bộ.
```

## Khi task trễ hạn

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

## Khi task sẵn sàng bàn giao

Người nhận:

```text
Account
```

Nội dung:

```text
Task TASK-0001 đã sẵn sàng bàn giao. Vui lòng kiểm tra Delivery Log.
```

---

# 15. Acceptance Criteria — Production Board Module

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

# 16. Prompt cho Dev/Claude

```text
Build 03. Database Orders Module and 04. Production Board Module for "CB Creative Flow - Media Hub by CB Centres".

Database Orders Module:
- Store all orders after Order Form submit.
- Act as single source of truth.
- Allow Admin/Account to view, search, filter, check brief, request more info, confirm brief, assign Account/PIC and set internal deadline.
- Required table columns:
  Order ID, Timestamp, Requester, Email, Department, Project/Campaign/Event, Request Type, Deliverable Type, Priority, Requested Deadline, Account Status, Production Status, PIC, Progress, Last Updated, Action.
- Order Detail Page must include:
  Requester Information, Brief Information, Internal Management, Delivery Summary.
- Account Status:
  Chờ xác nhận, Đang kiểm tra brief, Cần bổ sung thông tin, Đã xác nhận brief, Từ chối/Hủy đơn.
- Only push to Production Board when:
  Account Status = Đã xác nhận brief
  PIC is assigned
  Internal Deadline exists
  Order is not cancelled.

Production Board Module:
- Place for Design/Editor/PIC to receive tasks, track brief, update progress and upload preview/final.
- Must include Table View, Kanban View and My Tasks.
- Required Table View columns:
  Task ID, Order ID, Project/Campaign/Event, Type, Content, Priority, PIC, Status, Progress, Internal Deadline, Link Drive, Last Update, Action.
- Kanban columns:
  Chưa nhận task, Nhận task, Đang thực hiện, Chờ duyệt nội bộ, Chỉnh sửa nội bộ, Sẵn sàng bàn giao, Hoàn thành.
- PIC actions:
  Nhận task, xem brief, xem file/source, cập nhật status, thêm ghi chú, upload/link preview, upload/link final, gửi duyệt nội bộ, đánh dấu sẵn sàng bàn giao.
- Account/Admin actions:
  Xem toàn bộ task, gán/đổi PIC, đổi deadline nội bộ, đổi priority, comment chỉnh sửa, duyệt nội bộ, chuyển task sang Delivery Log.
- Auto progress mapping:
  Chưa nhận task 20%, Nhận task 30%, Đang thực hiện 50%, Chờ duyệt nội bộ 65%, Chỉnh sửa nội bộ 75%, Chờ client phản hồi 80%, Chỉnh sửa theo feedback 85%, Sẵn sàng bàn giao 90%, Đã bàn giao 95%, Hoàn thành 100%, Hủy 0%.

Use CB brand:
Red #BA110F
Blue #191970
Font Montserrat
Clean professional SaaS UI.
```
