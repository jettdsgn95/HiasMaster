# CB Creative Flow - Media Hub by CB Centres  
# Master Dashboard Module — Detailed Specification for Dev

**Module:** Master Dashboard  
**Purpose:** Cập nhật vào website portal để Admin/Leader/Account có một màn hình tổng quan vận hành Media từ lúc nhận order đến lúc bàn giao.  
**Version:** v1.0  
**Language:** Vietnamese UI-first  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, clean SaaS dashboard.

---

# 1. Vai trò của Master Dashboard Module

**Master Dashboard** là màn hình tổng hợp cấp cao nhất của portal **CB Creative Flow - Media Hub by CB Centres**.

Module này không dùng để nhập liệu chính, mà dùng để:

1. Theo dõi toàn bộ tình hình vận hành Media.
2. Cảnh báo task/order có nguy cơ trễ hạn.
3. Theo dõi workload theo từng vị trí và từng nhân sự.
4. Theo dõi tiến độ từ Order Form → Database Orders → Production Board → Delivery Log.
5. Đánh giá chất lượng brief, chất lượng bàn giao và mức độ hài lòng.
6. Cung cấp quick access đến các module xử lý chi tiết.

---

# 2. Người dùng chính

| Role | Mục đích sử dụng Dashboard |
|---|---|
| Admin | Xem toàn bộ hệ thống, workload, deadline, bottleneck, report tổng |
| Media Leader/Manager | Theo dõi hiệu suất team, phân bổ nguồn lực, cảnh báo rủi ro |
| Account | Theo dõi order mình phụ trách, task chờ kiểm tra, task chờ bàn giao |
| Design/Editor | Có thể xem dashboard cá nhân nếu được cấp quyền |
| Client | Không xem Master Dashboard nội bộ |

---

# 3. Quyền truy cập Dashboard

## 3.1. Permission logic

| Role | Scope dữ liệu |
|---|---|
| Admin | Xem toàn bộ dữ liệu |
| Manager/Leader | Xem toàn bộ dữ liệu hoặc theo team được phân quyền |
| Account | Xem order/task do mình phụ trách hoặc được phân quyền |
| Design | Chỉ xem task của chính mình |
| Editor | Chỉ xem task của chính mình |
| Client | Không truy cập Master Dashboard nội bộ |

## 3.2. Visibility rule

Dashboard phải tự lọc dữ liệu theo user đăng nhập.

```text
Nếu role = Admin:
→ Load all orders, tasks, delivery, reports.

Nếu role = Account:
→ Load orders where account_pic_id = current_user_id
→ Load tasks linked to those orders.

Nếu role = Design/Editor:
→ Load tasks where assigned_to = current_user_id.

Nếu role = Client:
→ Redirect sang Client Order Tracking Dashboard, không vào Master Dashboard.
```

---

# 4. Vị trí trong hệ thống

## Menu chính

```text
Dashboard
Order Form
Database Orders
Production Board
Delivery Log
Reports
AI Tools
Chatbot
User Management
Settings
```

## Route đề xuất

```text
/dashboard
```

Hoặc nếu có dashboard theo role:

```text
/dashboard/master
/dashboard/account
/dashboard/my-tasks
/dashboard/client
```

---

# 5. Layout tổng thể của Master Dashboard

## 5.1. Cấu trúc layout đề xuất

```text
Master Dashboard
├── Header Area
│   ├── Page title
│   ├── Subtitle
│   ├── Date range filter
│   ├── Role/team filter
│   ├── PIC filter
│   ├── Department/Branch filter
│   ├── Export button
│   └── Create Order button
│
├── KPI Summary Cards
│   ├── Total Orders
│   ├── New Requests
│   ├── Brief Need Info
│   ├── In Production
│   ├── Internal Review
│   ├── Ready for Delivery
│   ├── Due Soon
│   ├── Overdue
│   ├── Completed
│   ├── On-time Rate
│   ├── Average Rating
│   └── Rating Coverage
│
├── Workflow Health Overview
│   ├── Order Form
│   ├── Database Orders
│   ├── Production Board
│   ├── Delivery Log
│   └── Completed
│
├── Alert Center
│   ├── Orders cần xác nhận
│   ├── Task sắp trễ
│   ├── Task đã trễ
│   ├── Task chờ Account kiểm tra
│   └── Task chờ Client phản hồi
│
├── Workload Overview
│   ├── Theo vị trí
│   ├── Theo P.I.C
│   └── Theo loại task
│
├── Production Status Overview
│   ├── Kanban summary
│   ├── Status distribution chart
│   └── Progress by stage
│
├── Deadline & SLA Overview
│   ├── Deadline categories
│   ├── SLA rate
│   ├── Overdue list
│   └── Deadline heatmap
│
├── Delivery Performance
│   ├── Delivered tasks
│   ├── Delivery on-time rate
│   ├── Rating average
│   └── Waiting rating
│
├── Recent Activity
│   ├── Status changes
│   ├── New comments
│   ├── File uploads
│   └── Delivery events
│
└── Quick Action Panel
    ├── Tạo order mới
    ├── Xem đơn chờ xác nhận
    ├── Xem task trễ
    ├── Xem task chờ duyệt
    └── Mở Reports
```

---

# 6. Header Area

## 6.1. Nội dung header

| Thành phần | Nội dung |
|---|---|
| Page title | Master Dashboard |
| Subtitle | Tổng quan vận hành Media từ brief đến bàn giao |
| Date range filter | Hôm nay / 7 ngày / 30 ngày / Tháng này / Quý này / Custom |
| Role/team filter | Tất cả / Account / Design / Editor / Shooting |
| PIC filter | Tất cả / từng nhân sự |
| Branch/Department filter | Tất cả / từng chi nhánh/bộ phận |
| Export button | Export dashboard PDF/Excel |
| Create Order button | Tạo order mới |

## 6.2. UI suggestion

```text
[Master Dashboard]
Tổng quan vận hành Media từ brief đến bàn giao

[Tháng này ▼] [Tất cả role ▼] [Tất cả PIC ▼] [Tất cả chi nhánh ▼] [Export] [+ Tạo Order]
```

## 6.3. Filter behavior

Khi user thay đổi filter, toàn bộ dashboard phải cập nhật:

```text
KPI Cards
Charts
Alert Center
Workload
Recent Activity
Tables
```

---

# 7. KPI Summary Cards

## 7.1. Mục đích

KPI cards hiển thị nhanh các chỉ số quan trọng nhất trong kỳ đang chọn.

## 7.2. Danh sách KPI cards

| Card | Ý nghĩa | Data source |
|---|---|---|
| Total Orders | Tổng số order trong kỳ | Orders |
| New Requests | Đơn mới chưa xác nhận | Orders.account_status |
| Brief Need Info | Đơn cần bổ sung brief | Orders.account_status |
| In Production | Task đang triển khai | Tasks.task_status |
| Internal Review | Task chờ duyệt nội bộ | Tasks.task_status |
| Ready for Delivery | Task sẵn sàng bàn giao | Tasks/Delivery |
| Due Soon | Task/order sắp đến hạn | Tasks.internal_deadline |
| Overdue | Task/order trễ hạn | Tasks/Orders deadline |
| Completed | Đơn/task hoàn thành | Orders/Tasks/Delivery |
| On-time Rate | Tỷ lệ hoàn thành đúng hạn | Tasks/Delivery |
| Average Rating | Điểm hài lòng trung bình | Delivery.satisfaction_score |
| Rating Coverage | Tỷ lệ đơn có đánh giá | Delivery |

## 7.3. KPI card UI

Mỗi card nên gồm:

```text
Label
Main number
Sub text
Trend indicator
Icon
Color status
Click action
```

Ví dụ:

```text
Tổng order
128
+16 so với tháng trước
Click → mở Database Orders đã filter theo kỳ
```

## 7.4. KPI formulas

### Total Orders

```sql
COUNT(orders.order_id)
WHERE orders.created_at BETWEEN selected_start AND selected_end
```

### New Requests

```sql
COUNT(orders.order_id)
WHERE account_status = 'Chờ xác nhận'
AND created_at BETWEEN selected_start AND selected_end
```

### Brief Need Info

```sql
COUNT(orders.order_id)
WHERE account_status = 'Cần bổ sung thông tin'
AND created_at BETWEEN selected_start AND selected_end
```

### In Production

```sql
COUNT(tasks.task_id)
WHERE task_status IN ('Nhận task', 'Đang thực hiện', 'Chỉnh sửa nội bộ', 'Chỉnh sửa theo feedback')
AND assigned_at BETWEEN selected_start AND selected_end
```

### Internal Review

```sql
COUNT(tasks.task_id)
WHERE task_status = 'Chờ duyệt nội bộ'
```

### Ready for Delivery

```sql
COUNT(tasks.task_id)
WHERE task_status = 'Sẵn sàng bàn giao'
```

### Due Soon

```sql
COUNT(tasks.task_id)
WHERE internal_deadline BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
AND task_status NOT IN ('Hoàn thành', 'Hủy')
```

### Overdue

```sql
COUNT(tasks.task_id)
WHERE internal_deadline < NOW()
AND task_status NOT IN ('Hoàn thành', 'Hủy')
```

### Completed

```sql
COUNT(tasks.task_id)
WHERE task_status = 'Hoàn thành'
AND completed_at BETWEEN selected_start AND selected_end
```

### On-time Rate

```sql
COUNT(completed tasks where completed_at <= internal_deadline)
/
COUNT(completed tasks)
* 100
```

### Average Rating

```sql
AVG(delivery.satisfaction_score)
WHERE satisfaction_score IS NOT NULL
AND delivery_date BETWEEN selected_start AND selected_end
```

### Rating Coverage

```sql
COUNT(delivery where satisfaction_score IS NOT NULL)
/
COUNT(delivery where delivery_status IN ('Đã gửi final', 'Đã nhận đánh giá', 'Hoàn thành'))
* 100
```

---

# 8. Workflow Health Overview

## 8.1. Mục đích

Hiển thị số lượng order/task đang nằm ở từng bước của luồng vận hành.

```text
Order Form → Database Orders → Production Board → Delivery Log → Completed
```

## 8.2. UI đề xuất

Dạng horizontal pipeline hoặc step cards:

```text
[New Request: 12]
→ [Brief Checking: 8]
→ [In Production: 34]
→ [Internal Review: 7]
→ [Delivery: 9]
→ [Completed: 68]
```

## 8.3. Stage mapping

| Workflow Stage | Mapping status |
|---|---|
| New Request | account_status = Chờ xác nhận |
| Brief Checking | account_status = Đang kiểm tra brief |
| Need More Info | account_status = Cần bổ sung thông tin |
| Confirmed Brief | account_status = Đã xác nhận brief |
| In Production | task_status = Nhận task / Đang thực hiện / Chỉnh sửa |
| Internal Review | task_status = Chờ duyệt nội bộ |
| Ready for Delivery | task_status = Sẵn sàng bàn giao |
| Delivery | delivery_status = Chờ Account kiểm tra / Đã gửi preview / Đã gửi final |
| Client Feedback | delivery_status = Chờ client phản hồi / Client yêu cầu chỉnh sửa |
| Completed | order_status/task_status/delivery_status = Hoàn thành |

## 8.4. Click behavior

Click vào từng stage sẽ mở list tương ứng:

```text
Click New Request → Database Orders filter account_status = Chờ xác nhận
Click In Production → Production Board filter status = Đang thực hiện
Click Delivery → Delivery Log filter delivery_status != Hoàn thành
```

---

# 9. Alert Center

## 9.1. Mục đích

Alert Center giúp Admin/Account nhìn ngay các điểm cần xử lý gấp.

## 9.2. Alert categories

| Alert | Điều kiện | Người cần thấy |
|---|---|---|
| Đơn mới chưa xác nhận | account_status = Chờ xác nhận | Admin, Account |
| Brief thiếu thông tin | account_status = Cần bổ sung thông tin | Account |
| Task chưa nhận | task_status = Chưa nhận task quá X giờ | Admin, Account, PIC |
| Task sắp đến hạn | internal_deadline trong 48h | Admin, Account, PIC |
| Task trễ hạn nội bộ | internal_deadline < now và chưa hoàn thành | Admin, Account, PIC |
| Task chờ duyệt nội bộ | task_status = Chờ duyệt nội bộ | Admin, Account |
| Task chờ client phản hồi | delivery_status = Chờ client phản hồi | Account |
| Đã bàn giao nhưng chưa rating | delivery_status = Đã gửi final, rating null | Account |
| Link final thiếu | delivery_status = Đã gửi final nhưng final_link rỗng | Account/Admin |
| Task bị mở lại | reopened_count > 0 | Admin, Account, PIC |

## 9.3. Alert severity

| Severity | UI color | Ý nghĩa |
|---|---|---|
| Critical | Red `#BA110F` | Đã trễ, thiếu link final, lỗi nghiêm trọng |
| Warning | Orange `#F59E0B` | Sắp trễ, chờ xử lý lâu |
| Info | Blue `#191970` | Chờ duyệt, chờ feedback |
| Success | Green `#16A34A` | Hoàn tất hoặc đã xử lý |

## 9.4. Alert card fields

Mỗi alert item gồm:

```text
Alert type
Order ID / Task ID
Project/Campaign/Event
PIC / Account
Deadline
Time remaining / overdue time
Action button
```

Ví dụ:

```text
[Critical] Task trễ deadline nội bộ
MEDIA-2026-0008 — Backdrop Summer Campaign
PIC: Duy
Trễ: 1 ngày 4 giờ
[View Task]
```

---

# 10. Workload Overview

## 10.1. Mục đích

Theo dõi khối lượng công việc theo vai trò, nhân sự và loại task.

## 10.2. Chart 1 — Workload by Role

Loại chart: Horizontal bar chart

Group:

```text
Account
Design
Editor
Shooting
AI Tools
```

Metric:

```text
Total assigned tasks
In progress tasks
Completed tasks
Overdue tasks
```

## 10.3. Chart 2 — Workload by P.I.C

Loại chart: Stacked bar chart

Group by:

```text
assigned_to / production_pic
```

Stack:

```text
Đang thực hiện
Chờ duyệt
Sắp trễ
Trễ hạn
Hoàn thành
```

## 10.4. Chart 3 — Task Type Distribution

Loại chart: Donut/Pie chart

Group:

```text
Design/POSM
Digital/Social
Video Editing
Quay/Chụp
Ads/Post Basic
Slide/Proposal
Other
```

## 10.5. Workload warning logic

Hệ thống nên cảnh báo khi:

```text
Một nhân sự có số task đang mở > ngưỡng cấu hình
Một nhân sự có trên 3 task sắp trễ
Một role có workload > 40% tổng task đang mở
Một task gấp chưa có P.I.C
```

Config gợi ý:

```text
Max open tasks per PIC: 8
Warning open tasks per PIC: 6
Critical overdue tasks per PIC: >= 3
```

---

# 11. Production Status Overview

## 11.1. Mục đích

Hiển thị tình trạng sản xuất tổng thể theo status.

## 11.2. Status distribution

Group theo `task_status`:

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

## 11.3. Chart đề xuất

- Donut chart: phân bổ task theo status.
- Stacked bar: status theo role.
- Mini Kanban summary: số lượng card mỗi cột.

## 11.4. Progress health

Cần hiển thị:

```text
Average progress
Number of tasks at 0–25%
Number of tasks at 26–50%
Number of tasks at 51–75%
Number of tasks at 76–99%
Number of tasks at 100%
```

---

# 12. Deadline & SLA Overview

## 12.1. Mục đích

Theo dõi deadline nội bộ và deadline mong muốn của client.

## 12.2. Deadline categories

| Category | Điều kiện |
|---|---|
| On Track | Deadline còn trên 48h |
| Due Soon | Deadline trong 24–48h |
| Due Today | Deadline trong ngày |
| Internal Overdue | Quá internal_deadline |
| Client Overdue | Quá requested_deadline |
| Completed On Time | completed_at <= internal_deadline |
| Completed Late | completed_at > internal_deadline |

## 12.3. Chart đề xuất

### SLA Gauge / KPI

```text
On-time Rate: 92%
Late Rate: 8%
```

### Deadline list

```text
Order ID
Project
PIC
Internal Deadline
Requested Deadline
Status
Remaining Time
```

### Calendar heatmap

Hiển thị số task đến hạn theo ngày trong tháng.

## 12.4. Deadline color rules

| Điều kiện | Badge | Color |
|---|---|---|
| Còn >2 ngày | Đúng tiến độ | Green |
| Còn 1–2 ngày | Sắp đến hạn | Yellow |
| Hôm nay | Đến hạn hôm nay | Orange |
| Quá hạn | Trễ hạn | Red |
| Hoàn thành | Completed | Blue/Green |

---

# 13. Delivery Performance Overview

## 13.1. Mục đích

Theo dõi năng lực bàn giao và chất lượng trải nghiệm client.

## 13.2. KPI

```text
Số task đã bàn giao
Số task chờ Account kiểm tra
Số task chờ client phản hồi
Số task đã gửi final
Số task chưa có rating
Rating trung bình
Rating coverage
Task mở lại sau bàn giao
```

## 13.3. Chart đề xuất

### Delivery funnel

```text
Ready for Delivery
→ Account Checked
→ Preview Sent
→ Client Approved
→ Final Sent
→ Rated
→ Completed
```

### Rating distribution

```text
1 sao
2 sao
3 sao
4 sao
5 sao
```

### Reopened tasks

```text
Task mở lại theo tháng
Task mở lại theo PIC
Task mở lại theo loại task
```

---

# 14. Recent Activity Feed

## 14.1. Mục đích

Cho phép Admin/Account xem nhanh những hoạt động mới nhất trong hệ thống.

## 14.2. Activity types

```text
Order created
Brief confirmed
Need more info requested
PIC assigned
Status changed
Comment added
File uploaded
Preview sent
Final delivered
Rating submitted
Task reopened
Order completed
```

## 14.3. Activity item fields

```text
Time
User
Action type
Order ID / Task ID
Project name
Old value
New value
Comment preview
```

Ví dụ:

```text
10/03/2026 16:02 — Duy chuyển MEDIA-2026-0003 từ Đang thực hiện sang Chờ duyệt nội bộ.
10/03/2026 16:05 — Hậu comment: Cần kiểm tra lại wording CTA.
10/03/2026 16:10 — Duy upload preview link.
```

---

# 15. Quick Action Panel

## 15.1. Mục đích

Cho phép user xử lý nhanh từ Dashboard thay vì phải đi vào menu sâu.

## 15.2. Quick actions theo role

### Admin

```text
+ Tạo Order
Xem đơn chờ xác nhận
Xem task trễ hạn
Xem workload theo nhân sự
Mở Reports
Mở User Management
```

### Account

```text
Xem đơn chờ xác nhận
Xem task chờ duyệt nội bộ
Xem task sẵn sàng bàn giao
Xem task chờ client phản hồi
Mở Delivery Log
```

### Design/Editor

```text
Xem My Tasks
Xem task sắp đến hạn
Upload preview
Cập nhật trạng thái
```

---

# 16. Dashboard Data Sources

Master Dashboard lấy dữ liệu từ các bảng:

```text
Orders
Tasks
Delivery
Users
Files
ActivityLog
Comments
```

## 16.1. Required fields

### Orders

```text
order_id
created_at
updated_at
requester_id
department
project_purpose
request_type
deliverable_type
priority
requested_deadline
internal_deadline
account_status
production_status
delivery_status
account_pic_id
production_pic_id
progress
satisfaction_score
closed_at
```

### Tasks

```text
task_id
order_id
task_name
task_type
assigned_to
role_tag
task_status
progress
priority
assigned_at
internal_deadline
completed_at
preview_link
final_link
revision_count
reopened_count
last_updated
```

### Delivery

```text
delivery_id
order_id
task_id
account_id
production_pic_id
delivery_status
preview_link
final_link
delivery_date
delivery_channel
delivered_to
delivered_by
client_approval_status
satisfaction_score
client_feedback
delivery_note
closed_at
reopened_count
```

### ActivityLog

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

# 17. API Requirements

## 17.1. Dashboard summary API

```http
GET /api/dashboard/summary
```

Query params:

```text
start_date
end_date
role
pic_id
department
task_type
priority
status
```

Response example:

```json
{
  "total_orders": 128,
  "new_requests": 12,
  "brief_need_info": 5,
  "in_production": 34,
  "internal_review": 7,
  "ready_for_delivery": 9,
  "due_soon": 11,
  "overdue": 4,
  "completed": 68,
  "on_time_rate": 92,
  "average_rating": 4.7,
  "rating_coverage": 76
}
```

## 17.2. Workflow health API

```http
GET /api/dashboard/workflow-health
```

Response example:

```json
{
  "new_request": 12,
  "brief_checking": 8,
  "need_more_info": 5,
  "confirmed_brief": 16,
  "in_production": 34,
  "internal_review": 7,
  "ready_for_delivery": 9,
  "delivery": 6,
  "client_feedback": 4,
  "completed": 68
}
```

## 17.3. Alerts API

```http
GET /api/dashboard/alerts
```

Response example:

```json
[
  {
    "severity": "critical",
    "type": "overdue_task",
    "order_id": "MEDIA-2026-0008",
    "task_id": "TASK-00028",
    "project": "Summer Campaign Backdrop",
    "pic": "Duy",
    "deadline": "2026-03-14T17:00:00",
    "overdue_hours": 28,
    "action_url": "/production/tasks/TASK-00028"
  }
]
```

## 17.4. Workload API

```http
GET /api/dashboard/workload
```

Response example:

```json
{
  "by_role": [
    {"role": "Design", "total": 52, "in_progress": 18, "completed": 31, "overdue": 3},
    {"role": "Editor", "total": 36, "in_progress": 12, "completed": 22, "overdue": 2},
    {"role": "Account", "total": 47, "in_progress": 9, "completed": 36, "overdue": 2}
  ],
  "by_pic": [
    {"name": "Duy", "open": 8, "due_soon": 2, "overdue": 1, "completed": 39},
    {"name": "Vinh", "open": 6, "due_soon": 3, "overdue": 2, "completed": 31}
  ],
  "by_task_type": [
    {"type": "Design/POSM", "value": 48},
    {"type": "Video Editing", "value": 23},
    {"type": "Quay/Chụp", "value": 14}
  ]
}
```

## 17.5. Recent activity API

```http
GET /api/dashboard/recent-activity
```

Response example:

```json
[
  {
    "time": "2026-03-10T16:02:00",
    "user": "Duy",
    "action_type": "status_changed",
    "order_id": "MEDIA-2026-0003",
    "task_id": "TASK-00012",
    "old_value": "Đang thực hiện",
    "new_value": "Chờ duyệt nội bộ",
    "comment": null
  }
]
```

---

# 18. Frontend Component Structure

## 18.1. Component tree đề xuất

```text
MasterDashboardPage
├── DashboardHeader
│   ├── DateRangeFilter
│   ├── RoleFilter
│   ├── PICFilter
│   ├── DepartmentFilter
│   ├── ExportButton
│   └── CreateOrderButton
│
├── KPISummaryCards
│   └── KPICard
│
├── WorkflowHealth
│   └── WorkflowStageCard
│
├── AlertCenter
│   └── AlertItem
│
├── WorkloadOverview
│   ├── WorkloadByRoleChart
│   ├── WorkloadByPICChart
│   └── TaskTypeDistributionChart
│
├── ProductionStatusOverview
│   ├── StatusDistributionChart
│   └── ProgressHealth
│
├── DeadlineSLAOverview
│   ├── SLAKPI
│   ├── DeadlineList
│   └── DeadlineHeatmap
│
├── DeliveryPerformance
│   ├── DeliveryFunnel
│   ├── RatingDistribution
│   └── ReopenedTasksSummary
│
├── RecentActivityFeed
│   └── ActivityItem
│
└── QuickActionPanel
    └── QuickActionButton
```

## 18.2. Recommended chart library

Dev có thể dùng:

```text
Recharts
Chart.js
ECharts
ApexCharts
```

Khuyến nghị nếu build React: **Recharts** hoặc **ApexCharts**.

---

# 19. UI Layout Detail

## 19.1. Desktop layout

```text
Row 1: Header + filters
Row 2: KPI Cards, 4 cards per row
Row 3: Workflow Health, full width
Row 4: Alert Center 40% + Workload Overview 60%
Row 5: Production Status 50% + Deadline/SLA 50%
Row 6: Delivery Performance 50% + Recent Activity 50%
Row 7: Quick Action Panel, full width
```

## 19.2. Responsive behavior

### Tablet

```text
KPI Cards: 2 columns
Charts: 1–2 columns
Tables: horizontal scroll
Sidebar: collapsible
```

### Mobile

```text
KPI Cards: 1 column
Charts: 1 column
Tables: card list hoặc horizontal scroll
Filters: collapsible filter drawer
```

---

# 20. Click-through Navigation

Dashboard không chỉ hiển thị số liệu mà phải có click-through.

| Dashboard item | Click đến |
|---|---|
| Total Orders | `/orders?date_range=...` |
| New Requests | `/orders?account_status=cho_xac_nhan` |
| Brief Need Info | `/orders?account_status=can_bo_sung` |
| In Production | `/production?status=in_progress` |
| Internal Review | `/production?status=internal_review` |
| Ready for Delivery | `/delivery?status=ready` |
| Due Soon | `/production?deadline=due_soon` |
| Overdue | `/production?deadline=overdue` |
| Completed | `/orders?status=completed` |
| Average Rating | `/reports?metric=rating` |
| Alert item | Direct order/task detail |
| Activity item | Direct order/task detail |

---

# 21. Empty State

Nếu không có dữ liệu, dashboard không được để trống.

## Empty state examples

```text
Chưa có order nào trong khoảng thời gian này.
Không có task trễ hạn. Team đang đúng tiến độ.
Chưa có đánh giá hài lòng trong kỳ này.
Không có hoạt động mới gần đây.
```

---

# 22. Loading State

Khi đang fetch dữ liệu:

```text
Skeleton cards
Skeleton chart
Skeleton table rows
Spinner nhỏ ở filter Apply
```

Không nên để toàn trang trắng.

---

# 23. Error State

Nếu API lỗi:

```text
Không thể tải dữ liệu Dashboard.
Vui lòng thử lại hoặc liên hệ Admin hệ thống.
[Retry]
```

Nếu chỉ một chart lỗi, chỉ chart đó hiển thị lỗi, không làm hỏng toàn dashboard.

---

# 24. Data Refresh

## 24.1. Refresh behavior

Dashboard nên có:

```text
Auto refresh mỗi 60 giây
Manual refresh button
Last updated timestamp
```

UI:

```text
Last updated: 10/03/2026 16:02
[Refresh]
```

## 24.2. Real-time option

Phase 2 có thể dùng WebSocket hoặc Supabase Realtime/Firebase để update:

```text
New order created
Status changed
Comment added
File uploaded
Delivery completed
```

---

# 25. Export Requirements

## 25.1. Export PDF

Export PDF gồm:

```text
Dashboard summary
KPI cards
Workflow health
Alert summary
Workload chart
SLA summary
Delivery rating summary
```

## 25.2. Export Excel

Export Excel gồm các sheet:

```text
Summary
Orders
Tasks
Delivery
PIC Performance
Overdue List
Rating Feedback
```

---

# 26. Master Dashboard Acceptance Criteria

## 26.1. Data

- Dashboard lấy dữ liệu từ Orders, Tasks, Delivery, ActivityLog.
- Số liệu thay đổi theo filter thời gian, role, PIC, department, task type.
- User chỉ thấy dữ liệu đúng quyền.
- KPI cards tính đúng theo công thức.
- Alert Center hiển thị đúng các cảnh báo quan trọng.
- Click vào KPI/alert/charts dẫn đến list đã filter.

## 26.2. UI

- Giao diện đúng brand CB.
- Có card, chart, table, alert rõ ràng.
- Responsive desktop/tablet/mobile.
- Có loading state, empty state, error state.
- Có last updated timestamp.

## 26.3. Workflow

- Khi có order mới, KPI New Requests tăng.
- Khi Account xác nhận brief, Workflow Health cập nhật.
- Khi P.I.C nhận task, In Production cập nhật.
- Khi task quá deadline, Overdue Alert xuất hiện.
- Khi task sẵn sàng bàn giao, Ready for Delivery tăng.
- Khi client rating, Average Rating và Rating Coverage cập nhật.

---

# 27. Dev Implementation Notes

1. Master Dashboard là module tổng hợp, không nên hard-code dữ liệu.
2. Tất cả chart phải lấy dữ liệu từ API hoặc state quản lý tập trung.
3. Nên tạo service riêng: `dashboardService`.
4. Nên có permission middleware/filter ở backend, không chỉ frontend.
5. Query dashboard cần tối ưu vì nhiều aggregation.
6. Nên cache summary data trong 30–60 giây nếu dữ liệu lớn.
7. Các chỉ số phải dùng cùng một định nghĩa status trên toàn hệ thống.
8. Cần thống nhất timezone theo Việt Nam: `Asia/Ho_Chi_Minh`.
9. Date range phải áp dụng nhất quán cho Orders, Tasks, Delivery.
10. Dashboard phải mở rộng được cho các role-specific dashboard về sau.

---

# 28. Suggested Initial Build Scope for Master Dashboard

## MVP nên build trước

```text
Header filters
KPI Summary Cards
Workflow Health
Alert Center
Workload by PIC
Production Status Overview
Recent Activity
Click-through navigation
```

## Phase 2

```text
Advanced charts
Deadline heatmap
Delivery funnel
Rating distribution
Export PDF/Excel
Auto refresh
Role-specific dashboard
```

## Phase 3

```text
Predictive overdue risk
AI workload recommendation
AI summary report
Realtime notifications
```

---

# 29. Prompt for Dev/Claude

```text
Build the Master Dashboard Module for "CB Creative Flow - Media Hub by CB Centres".

The dashboard must show operational performance from order intake to production and delivery. It must include:
- Header with date range, role, PIC, department and task type filters
- KPI summary cards
- Workflow health overview
- Alert center for urgent items
- Workload overview by role, PIC and task type
- Production status overview
- Deadline/SLA overview
- Delivery performance overview
- Recent activity feed
- Quick action panel

Use brand colors:
- Red: #BA110F
- Blue: #191970
- Font: Montserrat
- Style: clean professional SaaS dashboard.

The dashboard must use role-based data visibility:
Admin sees all data.
Account sees assigned orders.
Design/Editor see their own tasks.
Client does not access Master Dashboard.

Use API endpoints:
GET /api/dashboard/summary
GET /api/dashboard/workflow-health
GET /api/dashboard/alerts
GET /api/dashboard/workload
GET /api/dashboard/recent-activity

All KPI cards and chart elements must be clickable and navigate to filtered pages.
```
