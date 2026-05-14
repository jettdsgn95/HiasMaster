# CB Creative Flow - Media Hub by CB Centres
# 06. Reports Module — Detailed Specification for Dev

**Module:** Reports & Performance Dashboard  
**Purpose:** Cập nhật vào website portal để Admin/Leader/Account theo dõi báo cáo hiệu suất vận hành Media theo thời gian, vị trí, nhân sự, loại task, deadline, SLA, chất lượng brief và rating.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, clean SaaS dashboard.  
**Output chính:** Dashboard báo cáo có filter, chart, KPI cards, table và export.

---

# 1. Mục đích

**Reports Module** là nơi tổng hợp dữ liệu từ:

```text
Database Orders
Production Board / Tasks
Delivery Log
Users
Activity Log
```

Module này dùng để:

1. Báo cáo tổng số order/task theo thời gian.
2. Theo dõi hiệu suất theo vị trí: Account, Design, Editor, Shooting.
3. Theo dõi workload theo từng P.I.C.
4. Theo dõi tỷ lệ đúng hạn/trễ hạn.
5. Theo dõi chất lượng brief.
6. Theo dõi số vòng chỉnh sửa.
7. Theo dõi rating/mức độ hài lòng.
8. Theo dõi delivery performance.
9. Xuất báo cáo PDF/Excel cho quản lý.

---

# 2. Người dùng chính

```text
Admin
Manager/Leader
Account nếu được cấp quyền
```

## Admin

```text
Xem toàn bộ report
Filter toàn hệ thống
Export PDF/Excel
Theo dõi workload và hiệu suất team
```

## Manager/Leader

```text
Xem report theo team
Theo dõi hiệu suất, chất lượng, deadline
Đánh giá workload và năng lực vận hành
```

## Account

```text
Xem report order/task mình phụ trách
Theo dõi delivery, rating và brief quality
```

## Design/Editor

Mặc định không vào Reports tổng. Có thể có **My Performance Report** nếu được cấp quyền.

---

# 3. Vị trí trong hệ thống

## Menu

```text
Main
└── Reports
```

## Route đề xuất

```text
/reports
/reports/overview
/reports/performance
/reports/delivery
/reports/pic
/reports/export
```

---

# 4. Data Sources

Reports cần lấy dữ liệu từ các bảng:

```text
Orders
Tasks
Delivery
Users
ActivityLog
Comments
Files
```

## Required fields

### Orders

```text
order_id
created_at
updated_at
requester_id
department
project_name
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
status
progress
priority
assigned_at
internal_deadline
completed_at
preview_link
final_link
revision_count
reopened_count
last_update
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

### Users

```text
user_id
full_name
role
tag
department
status
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

# 5. Report Filters

Reports cần có bộ lọc toàn cục.

## Filter list

| Filter | Type | Options |
|---|---|---|
| Date Range | Date range picker | Hôm nay / 7 ngày / 30 ngày / Tháng này / Quý này / Năm / Custom |
| Role | Multi-select | Account / Design / Editor / Shooting / Admin |
| P.I.C | Select/Search | Danh sách user active |
| Account | Select/Search | Account PIC |
| Department/Branch | Select/Search | Danh sách chi nhánh/bộ phận |
| Request Type | Multi-select | Design/POSM / Video / Quay / Chụp / Ads |
| Task Type | Multi-select | Backdrop / Standee / Social Post / Reel... |
| Priority | Multi-select | Bình thường / Gấp / Rất gấp |
| Status | Multi-select | Production/Delivery status |
| Deadline status | Select | On Track / Due Soon / Overdue / Completed Late |
| Rating | Select | 1–5 sao |
| Has Feedback | Boolean | Có / Không |

## Filter behavior

Khi filter thay đổi, cập nhật toàn bộ:

```text
KPI Cards
Charts
Tables
Ranking
Export data
```

---

# 6. Reports Layout

## Layout tổng

```text
Reports Page
├── Header Area
│   ├── Page title
│   ├── Subtitle
│   ├── Filter bar
│   ├── Export PDF
│   └── Export Excel
│
├── KPI Summary Cards
│   ├── Total Orders
│   ├── Total Tasks
│   ├── Completed Tasks
│   ├── On-time Rate
│   ├── Overdue Tasks
│   ├── Average Rating
│   ├── Revision Average
│   └── Rating Coverage
│
├── Chart Section
│   ├── Task theo thời gian
│   ├── Cơ cấu task theo hạng mục
│   ├── Báo cáo theo vị trí
│   ├── Hiệu suất theo P.I.C
│   ├── Workload theo ngày trong tuần
│   └── Chất lượng brief & bàn giao
│
├── KPI Table by Role/P.I.C
├── Overdue & Risk Table
├── Feedback & Rating Table
└── Export Settings
```

---

# 7. KPI Summary Cards

## Cards bắt buộc

| KPI | Ý nghĩa |
|---|---|
| Total Orders | Tổng order trong kỳ |
| Total Tasks | Tổng task trong kỳ |
| Completed Tasks | Task hoàn thành |
| In Progress | Task đang xử lý |
| On-time Rate | Tỷ lệ đúng deadline nội bộ |
| Overdue Tasks | Task trễ hạn |
| Average Rating | Điểm hài lòng trung bình |
| Rating Coverage | Tỷ lệ order/task có rating |
| Revision Average | Số vòng chỉnh sửa trung bình |
| Reopened Tasks | Số task/order bị mở lại |
| Brief Need Info | Số brief thiếu thông tin |
| Delivery Completed | Số delivery hoàn tất |

---

# 8. KPI Formulas

## Total Orders

```sql
COUNT(orders.order_id)
WHERE orders.created_at BETWEEN selected_start AND selected_end
```

## Total Tasks

```sql
COUNT(tasks.task_id)
WHERE tasks.created_at BETWEEN selected_start AND selected_end
```

## Completed Tasks

```sql
COUNT(tasks.task_id)
WHERE tasks.status = 'Hoàn thành'
AND tasks.completed_at BETWEEN selected_start AND selected_end
```

## On-time Rate

```sql
COUNT(tasks WHERE completed_at <= internal_deadline)
/
COUNT(tasks WHERE status = 'Hoàn thành')
* 100
```

## Overdue Tasks

```sql
COUNT(tasks.task_id)
WHERE internal_deadline < NOW()
AND status NOT IN ('Hoàn thành', 'Hủy')
```

## Average Rating

```sql
AVG(delivery.satisfaction_score)
WHERE satisfaction_score IS NOT NULL
AND delivery_date BETWEEN selected_start AND selected_end
```

## Rating Coverage

```sql
COUNT(delivery WHERE satisfaction_score IS NOT NULL)
/
COUNT(delivery WHERE delivery_status IN ('Đã gửi final', 'Đã nhận đánh giá', 'Hoàn thành'))
* 100
```

## Revision Average

```sql
AVG(tasks.revision_count)
WHERE completed_at BETWEEN selected_start AND selected_end
```

## Brief Need Info

```sql
COUNT(orders.order_id)
WHERE account_status = 'Cần bổ sung thông tin'
AND created_at BETWEEN selected_start AND selected_end
```

---

# 9. Chart 1 — Task theo thời gian

## Mục đích

Theo dõi xu hướng order/task theo ngày, tuần hoặc tháng.

## Chart type

```text
Line chart
```

## X-axis

```text
Date / Week / Month
```

## Y-axis

```text
Number of orders/tasks
```

## Series

```text
Order mới
Task tạo mới
Task hoàn thành
Task trễ hạn
Delivery hoàn tất
```

## Data needed

```text
orders.created_at
tasks.created_at
tasks.completed_at
tasks.internal_deadline
tasks.status
delivery.delivery_date
delivery.delivery_status
```

## Click behavior

```text
Click vào một điểm trên chart → mở danh sách order/task tương ứng theo ngày và status.
```

---

# 10. Chart 2 — Cơ cấu task theo hạng mục

## Mục đích

Biết hạng mục nào chiếm nhiều workload.

## Chart type

```text
Donut chart / Pie chart
```

## Group by

```text
Design/POSM
Digital/Social
Video Editing
Quay/Chụp
Ads/Post Basic
Slide/Proposal
Other
```

## Metric

```text
Task count
Percentage
```

## Data needed

```text
tasks.task_type
orders.deliverable_type
tasks.created_at
```

---

# 11. Chart 3 — Báo cáo theo vị trí

## Mục đích

So sánh workload và hiệu suất theo vị trí.

## Chart type

```text
Horizontal bar chart
```

## Group by

```text
Account
Design
Editor
Shooting
Hybrid
```

## Metrics

```text
Total Tasks
Completed Tasks
In Progress Tasks
Overdue Tasks
Average Rating
Revision Average
```

## Data needed

```text
users.role
users.tag
tasks.role_tag
tasks.assigned_to
tasks.status
tasks.completed_at
delivery.satisfaction_score
```

---

# 12. Chart 4 — Hiệu suất theo P.I.C

## Mục đích

Theo dõi hiệu suất từng nhân sự.

## Chart type

```text
Stacked bar chart
```

## Group by

```text
assigned_to / production_pic_id
```

## Stack

```text
Đúng hạn
Sắp trễ
Trễ hạn
Hoàn thành
Đang xử lý
```

## Data needed

```text
tasks.assigned_to
tasks.status
tasks.internal_deadline
tasks.completed_at
tasks.progress
```

---

# 13. Chart 5 — Workload theo ngày trong tuần

## Mục đích

Biết ngày nào phát sinh nhiều task/order nhất để tối ưu vận hành.

## Chart type

```text
Heatmap
```

## Group by

```text
Thứ 2
Thứ 3
Thứ 4
Thứ 5
Thứ 6
Thứ 7
Chủ nhật
```

## Metrics

```text
Order created count
Task assigned count
Task completed count
```

## Data needed

```text
orders.created_at
tasks.assigned_at
tasks.completed_at
```

---

# 14. Chart 6 — Chất lượng brief & bàn giao

## Mục đích

Theo dõi chất lượng đầu vào và đầu ra.

## Chart type

```text
Bar chart
```

## Metrics

```text
Brief đủ
Brief thiếu
Có rating
Không có rating
Task mở lại
Đúng hạn
Trễ hạn
Revision trung bình
```

## Data needed

```text
orders.account_status
orders.brief_status
tasks.revision_count
tasks.reopened_count
delivery.satisfaction_score
delivery.reopened_count
```

---

# 15. Delivery Performance Report

## Metrics

```text
Ready for Delivery count
Waiting Account Check count
Preview Sent count
Waiting Client Feedback count
Final Sent count
Completed Delivery count
Waiting Rating count
Average Delivery Time
Average Rating
Rating Coverage
Reopened Delivery Count
```

## Chart đề xuất

```text
Delivery funnel
Rating distribution
Delivery status distribution
Delivery completed over time
```

## Delivery funnel stages

```text
Ready for Delivery
→ Account Checked
→ Preview Sent
→ Client Approved
→ Final Sent
→ Rated
→ Completed
```

---

# 16. SLA / Deadline Report

## Metrics

```text
On-time Rate
Late Rate
Internal Overdue Count
Client Overdue Count
Due Soon Count
Average Completion Time
Average Delay Time
```

## Deadline status mapping

| Status | Điều kiện |
|---|---|
| On Track | Deadline còn >48h |
| Due Soon | Deadline còn 24–48h |
| Due Today | Deadline trong ngày |
| Internal Overdue | Quá internal_deadline |
| Client Overdue | Quá requested_deadline |
| Completed On Time | completed_at <= internal_deadline |
| Completed Late | completed_at > internal_deadline |

---

# 17. KPI Table by Role/P.I.C

## Table columns

```text
Vị trí
Nhân sự
Tổng task
Hoàn thành
Đang xử lý
Đúng hạn
Trễ hạn
Revision TB
Rating TB
Thời gian xử lý TB
Điểm KPI
```

## Example

| Vị trí | Nhân sự | Tổng task | Hoàn thành | Đúng hạn | Trễ hạn | Revision TB | Rating TB | Thời gian xử lý TB | Điểm KPI |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| Design | Duy | 42 | 39 | 93% | 3 | 1.3 | 4.8 | 2.1 ngày | 92/100 |
| Editor | Vinh | 35 | 31 | 89% | 4 | 1.6 | 4.6 | 3.4 ngày | 88/100 |
| Account | Hậu | 47 | 44 | 94% | 2 | 1.2 | 4.9 | 0.8 ngày kiểm brief | 95/100 |

---

# 18. Overdue & Risk Table

## Mục đích

Hiển thị task/order có rủi ro trễ hạn để xử lý nhanh.

## Columns

```text
Order ID
Task ID
Project/Campaign/Event
Type
P.I.C
Account
Priority
Internal Deadline
Requested Deadline
Overdue Time
Status
Action
```

## Action

```text
Open Task
Open Order
Notify P.I.C
Change Deadline
Reassign
Add Comment
```

---

# 19. Feedback & Rating Table

## Columns

```text
Order ID
Delivery ID
Project/Campaign/Event
Client/Requester
Rating
Feedback
Feedback Category
Delivery Date
Account
P.I.C
Action
```

## Use cases

```text
Xem các rating thấp 1–3 sao
Xem feedback liên quan chất lượng
Xem feedback liên quan tiến độ
Xem feedback theo P.I.C
```

---

# 20. Export Requirements

## Export PDF

PDF nên gồm:

```text
Report period
KPI summary
Task trend chart
Role performance chart
PIC performance table
SLA summary
Delivery summary
Rating summary
Top overdue tasks
```

## Export Excel

Excel nên có các sheet:

```text
Summary
Orders
Tasks
Delivery
PIC Performance
Role Performance
Overdue List
Rating Feedback
Raw Data
```

---

# 21. API đề xuất

## Reports summary

```http
GET /api/reports/summary
```

Query params:

```text
start_date
end_date
role
pic_id
account_id
department
request_type
task_type
priority
status
rating
```

## Task trend

```http
GET /api/reports/task-trend
```

## Task type distribution

```http
GET /api/reports/task-type-distribution
```

## Role performance

```http
GET /api/reports/role-performance
```

## PIC performance

```http
GET /api/reports/pic-performance
```

## Delivery performance

```http
GET /api/reports/delivery-performance
```

## SLA report

```http
GET /api/reports/sla
```

## Export report

```http
GET /api/reports/export?format=xlsx
GET /api/reports/export?format=pdf
```

---

# 22. Frontend Component Structure

```text
ReportsPage
├── ReportsHeader
│   ├── DateRangeFilter
│   ├── RoleFilter
│   ├── PICFilter
│   ├── DepartmentFilter
│   ├── TaskTypeFilter
│   ├── ExportPDFButton
│   └── ExportExcelButton
│
├── ReportKPICards
│   └── KPICard
│
├── ChartsSection
│   ├── TaskTrendChart
│   ├── TaskTypeDistributionChart
│   ├── RolePerformanceChart
│   ├── PICPerformanceChart
│   ├── WorkloadHeatmap
│   └── BriefDeliveryQualityChart
│
├── DeliveryPerformanceSection
│   ├── DeliveryFunnel
│   ├── RatingDistribution
│   └── DeliveryStatusChart
│
├── SLAReportSection
│   ├── OnTimeRateCard
│   ├── DeadlineStatusChart
│   └── OverdueRiskTable
│
├── PICPerformanceTable
├── FeedbackRatingTable
└── ExportSettingsModal
```

---

# 23. Recommended Chart Library

Nếu build React:

```text
Recharts
ApexCharts
ECharts
Chart.js
```

Khuyến nghị:

```text
Recharts hoặc ApexCharts
```

---

# 24. UI States

## Loading

```text
Loading reports...
Loading chart data...
Exporting report...
```

## Empty

```text
Không có dữ liệu trong khoảng thời gian này.
Không có task trễ hạn.
Chưa có rating trong kỳ này.
```

## Error

```text
Không thể tải báo cáo.
Không thể export file.
Vui lòng thử lại.
```

## Success

```text
Đã export báo cáo.
Đã áp dụng bộ lọc.
```

---

# 25. Permission & Security

## Visibility rules

```text
Admin xem toàn bộ report.
Manager/Leader xem report theo team hoặc toàn hệ thống nếu được cấp quyền.
Account xem report theo order/task mình phụ trách.
Design/Editor chỉ xem My Performance Report nếu được cấp quyền.
Client không xem Reports nội bộ.
```

Backend phải enforce:

```text
role
permission_group
data_scope
record ownership
```

---

# 26. Acceptance Criteria

## Functional

```text
Có filter theo thời gian, role, P.I.C, department, task type, priority, status.
KPI cards cập nhật theo filter.
Có chart task theo thời gian.
Có chart cơ cấu task theo hạng mục.
Có chart báo cáo theo vị trí.
Có chart hiệu suất theo P.I.C.
Có heatmap workload theo ngày trong tuần.
Có chart chất lượng brief & bàn giao.
Có bảng KPI theo vị trí/nhân sự.
Có bảng overdue & risk.
Có bảng feedback/rating.
Có export PDF/Excel.
```

## Security

```text
User chỉ xem report đúng quyền.
Client không truy cập report nội bộ.
Backend filter data theo permission.
```

## UX

```text
Chart rõ ràng, dễ đọc.
Có loading/empty/error state.
Có click-through từ chart sang list order/task tương ứng.
Responsive desktop/tablet.
Export có dữ liệu đúng filter.
```

---

# 27. Suggested Initial Build Scope

## MVP

```text
Report filter
KPI cards
Task trend chart
Task type distribution chart
Role performance chart
PIC performance table
Overdue table
Basic export Excel placeholder
```

## Phase 2

```text
Delivery funnel
Rating distribution
Workload heatmap
SLA report
Feedback category report
Export PDF
Click-through chart
```

## Phase 3

```text
AI report summary
AI workload recommendation
Predictive overdue risk
Scheduled email report
Custom report builder
```

---

# 28. Prompt cho Dev/Claude

```text
Build the 06. Reports Module for "CB Creative Flow - Media Hub by CB Centres".

Purpose:
Reports Module provides performance reporting by time, role, PIC, task type, SLA, delivery, rating and brief quality.

Main users:
Admin, Manager/Leader, Account if granted.

Required filters:
Date Range, Role, PIC, Account, Department/Branch, Request Type, Task Type, Priority, Status, Deadline Status, Rating.

Required KPI cards:
Total Orders, Total Tasks, Completed Tasks, In Progress, On-time Rate, Overdue Tasks, Average Rating, Rating Coverage, Revision Average, Reopened Tasks, Brief Need Info, Delivery Completed.

Required charts:
1. Task over time — line chart
2. Task type distribution — donut/pie chart
3. Role performance — horizontal bar chart
4. PIC performance — stacked bar chart
5. Workload by weekday — heatmap
6. Brief & delivery quality — bar chart
7. Delivery funnel
8. Rating distribution
9. SLA/deadline report

Required tables:
PIC/Role KPI table
Overdue & Risk table
Feedback & Rating table

Export:
PDF and Excel.

Data sources:
Orders, Tasks, Delivery, Users, ActivityLog.

Use CB brand:
Red #BA110F
Blue #191970
Font Montserrat
Clean professional SaaS dashboard UI.

Backend must enforce permission and data scope.
```
