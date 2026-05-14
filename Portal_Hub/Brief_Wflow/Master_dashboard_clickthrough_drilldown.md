# Master Dashboard Click-through Drilldown Update
## CB Creative Flow - Media Hub by CB Centres

**Mục tiêu:** Cập nhật Master Dashboard để các KPI Card không chỉ hiển thị số liệu, mà khi click sẽ mở danh sách record tương ứng đã filter/sort đúng. Sau đó user click vào từng dòng để đi đến trang chi tiết Order / Task / Delivery.

---

# 1. Yêu cầu chính

Hiện tại Master Dashboard chỉ hiển thị số liệu tổng quan.

Cần cập nhật:

```text
Click KPI Card
→ Hiển thị bảng list tương ứng đã filter/sort đúng dữ liệu
→ Click một dòng trong bảng
→ Direct tới detail page của record đó
```

Ví dụ:

```text
Click card New Requests = 12
→ Hiển thị bảng 12 request có account_status = Chờ xác nhận
→ Sort theo created_at ASC
→ Click vào một order
→ Direct tới /orders/{order_id}
```

---

# 2. UX Behavior

## 2.1. KPI Card click behavior

Mỗi KPI Card trên Master Dashboard cần có trạng thái clickable.

```text
Hover card → có hiệu ứng nhẹ
Click card → card active/highlight
Dashboard hiển thị Result Panel hoặc redirect đến module list
```

Khuyến nghị build theo 2 option:

## Option A — Drilldown panel ngay trong Dashboard

```text
Master Dashboard
├── KPI Cards
├── Drilldown Result Panel
│   ├── Title
│   ├── Filter chips
│   ├── Search within result
│   ├── Sort dropdown
│   ├── Table
│   └── Pagination
```

## Option B — Redirect sang module tương ứng

```text
Click New Requests
→ /orders?account_status=cho_xac_nhan&sort=created_at_asc
```

**Khuyến nghị:**  
MVP dùng **Option B** để build nhanh.  
Phase 2 dùng **Option A** để UX tốt hơn.

---

# 3. Drilldown Result Panel

Nếu dùng Option A, panel cần có:

```text
Panel Title
Applied Filter Chips
Search within result
Sort dropdown
Export current list
Table
Pagination
```

Ví dụ title:

```text
New Requests — 12 orders
Overdue — 4 tasks
Ready for Delivery — 9 deliveries
```

Filter chips ví dụ:

```text
[Account Status: Chờ xác nhận]
[Date Range: Tháng này]
[Sort: Created At ASC]
```

---

# 4. Row click behavior

## Nếu record là Order

```text
Click row hoặc Order ID
→ /orders/{order_id}
```

## Nếu record là Task

```text
Click row hoặc Task ID
→ /production/tasks/{task_id}
```

## Nếu record là Delivery

```text
Click row hoặc Delivery ID
→ /delivery/{delivery_id}
```

## Nếu row có nhiều ID

Ưu tiên theo loại card:

```text
New Requests → Order Detail
Brief Need Info → Order Detail
In Production → Task Detail
Internal Review → Task Detail
Due Soon → Task Detail
Overdue → Task Detail
Ready for Delivery → Delivery Detail
Average Rating → Delivery Detail
Rating Coverage → Delivery Detail
```

---

# 5. Card Key Mapping

Dev nên gắn mỗi KPI card với một `card_key`.

| KPI Card | card_key | Source Module | Filter | Sort | Detail Route |
|---|---|---|---|---|---|
| Total Orders | total_orders | orders | date range hiện tại | created_at DESC | /orders/{order_id} |
| New Requests | new_requests | orders | account_status = Chờ xác nhận | created_at ASC | /orders/{order_id} |
| Brief Need Info | brief_need_info | orders | account_status = Cần bổ sung thông tin | updated_at DESC | /orders/{order_id} |
| In Production | in_production | tasks | active production statuses | internal_deadline ASC | /production/tasks/{task_id} |
| Internal Review | internal_review | tasks | status = Chờ duyệt nội bộ | last_update DESC | /production/tasks/{task_id} |
| Ready for Delivery | ready_for_delivery | delivery | delivery_status = Chờ Account kiểm tra OR task_status = Sẵn sàng bàn giao | created_at ASC | /delivery/{delivery_id} |
| Due Soon | due_soon | tasks | internal_deadline trong 48h tới, chưa hoàn thành/hủy | internal_deadline ASC | /production/tasks/{task_id} |
| Overdue | overdue | tasks | internal_deadline < now, chưa hoàn thành/hủy | internal_deadline ASC | /production/tasks/{task_id} |
| Completed | completed | orders/tasks | completed_at trong date range | completed_at DESC | /orders/{order_id} hoặc /production/tasks/{task_id} |
| On-time Rate | on_time_rate | tasks | task đã hoàn thành trong kỳ | completed_at DESC | /production/tasks/{task_id} |
| Average Rating | average_rating | delivery | satisfaction_score IS NOT NULL | satisfaction_score ASC | /delivery/{delivery_id} |
| Rating Coverage | rating_coverage | delivery | final sent nhưng satisfaction_score IS NULL | delivery_date ASC | /delivery/{delivery_id} |

---

# 6. Filter chi tiết theo từng KPI

## 6.1. New Requests

```text
Source: orders
Filter:
- account_status = Chờ xác nhận
- created_at trong Dashboard date range hiện tại

Sort:
- created_at ASC

Route:
- /orders?account_status=cho_xac_nhan&sort=created_at_asc
```

Table columns:

```text
Order ID
Created At
Project/Campaign/Event
Requester
Department
Request Type
Priority
Account Status
Last Updated
Action
```

---

## 6.2. Brief Need Info

```text
Source: orders
Filter:
- account_status = Cần bổ sung thông tin
- updated_at hoặc created_at trong Dashboard date range

Sort:
- updated_at DESC

Route:
- /orders?account_status=can_bo_sung_thong_tin&sort=updated_at_desc
```

Table columns:

```text
Order ID
Project/Campaign/Event
Requester
Department
Account PIC
Missing Info Note
Last Updated
Action
```

---

## 6.3. In Production

```text
Source: tasks
Filter:
- task_status IN:
  - Nhận task
  - Đang thực hiện
  - Chỉnh sửa nội bộ
  - Chỉnh sửa theo feedback

Sort:
- internal_deadline ASC

Route:
- /production?status=in_production&sort=internal_deadline_asc
```

Table columns:

```text
Task ID
Order ID
Project/Campaign/Event
Type
P.I.C
Status
Progress
Internal Deadline
Action
```

---

## 6.4. Internal Review

```text
Source: tasks
Filter:
- task_status = Chờ duyệt nội bộ

Sort:
- last_update DESC

Route:
- /production?status=cho_duyet_noi_bo&sort=last_update_desc
```

Table columns:

```text
Task ID
Order ID
Project/Campaign/Event
P.I.C
Preview Link
Last Update
Internal Deadline
Action
```

---

## 6.5. Ready for Delivery

```text
Source: delivery/tasks
Filter:
- delivery_status = Chờ Account kiểm tra
OR
- task_status = Sẵn sàng bàn giao

Sort:
- created_at ASC hoặc ready_for_delivery_at ASC

Route:
- /delivery?status=cho_account_kiem_tra&sort=created_at_asc
```

Table columns:

```text
Delivery ID
Order ID
Task ID
Project/Campaign/Event
Account
P.I.C
Delivery Status
Preview Link
Final Link
Action
```

---

## 6.6. Due Soon

```text
Source: tasks
Filter:
- internal_deadline BETWEEN now AND now + 48h
- task_status NOT IN Hoàn thành, Hủy

Sort:
- internal_deadline ASC

Route:
- /production?deadline=due_soon&sort=internal_deadline_asc
```

Table columns:

```text
Task ID
Order ID
Project/Campaign/Event
P.I.C
Status
Progress
Internal Deadline
Remaining Time
Action
```

---

## 6.7. Overdue

```text
Source: tasks
Filter:
- internal_deadline < now
- task_status NOT IN Hoàn thành, Hủy

Sort:
- internal_deadline ASC

Route:
- /production?deadline=overdue&sort=internal_deadline_asc
```

Table columns:

```text
Task ID
Order ID
Project/Campaign/Event
P.I.C
Account
Priority
Status
Internal Deadline
Overdue Time
Action
```

---

## 6.8. Completed

```text
Source: orders/tasks
Filter:
- status = Hoàn thành
- completed_at trong Dashboard date range

Sort:
- completed_at DESC

Route:
- /orders?status=completed&sort=completed_at_desc
```

---

## 6.9. On-time Rate

```text
Source: tasks
Filter:
- task_status = Hoàn thành
- completed_at trong Dashboard date range

Sort:
- completed_at DESC
```

Table cần thêm:

```text
Internal Deadline
Completed At
SLA Result: Đúng hạn / Trễ hạn
Delay Time
```

---

## 6.10. Average Rating

```text
Source: delivery
Filter:
- satisfaction_score IS NOT NULL
- delivery_date trong Dashboard date range

Sort:
- satisfaction_score ASC
```

Rating thấp hiển thị trước để dễ kiểm tra vấn đề.

Route:

```text
/delivery?has_rating=true&sort=rating_asc
```

---

## 6.11. Rating Coverage

```text
Source: delivery
Filter:
- delivery_status IN Đã gửi final, Hoàn thành
- satisfaction_score IS NULL

Sort:
- delivery_date ASC
```

Route:

```text
/delivery?rating=missing&sort=delivery_date_asc
```

---

# 7. API đề xuất

## Option A — API riêng cho drilldown

```http
GET /api/dashboard/drilldown
```

Query params:

```text
card_key
start_date
end_date
role
pic_id
department
page
limit
sort_field
sort_direction
```

Ví dụ:

```http
GET /api/dashboard/drilldown?card_key=new_requests&start_date=2026-03-01&end_date=2026-03-31&page=1&limit=20
```

Response:

```json
{
  "title": "New Requests",
  "source_module": "orders",
  "total": 12,
  "filters": {
    "account_status": "Chờ xác nhận"
  },
  "sort": {
    "field": "created_at",
    "direction": "asc"
  },
  "data": [
    {
      "order_id": "MEDIA-2026-0001",
      "created_at": "2026-03-10T10:30:00+07:00",
      "project_name": "Summer Campaign",
      "requester_name": "Nguyễn Văn A",
      "department": "CB Mekong",
      "request_type": "Thiết kế/POSM",
      "priority": "Gấp",
      "account_status": "Chờ xác nhận",
      "production_status": "Chưa phân công",
      "progress": 5,
      "detail_url": "/orders/MEDIA-2026-0001"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12
  }
}
```

---

## Option B — dùng lại API từng module

Redirect trực tiếp:

```text
/orders?account_status=cho_xac_nhan
/production?deadline=overdue
/delivery?rating=missing
```

Khuyến nghị:

```text
MVP dùng Option B.
Phase 2 dùng /api/dashboard/drilldown.
```

---

# 8. Frontend State đề xuất

```ts
type DashboardDrilldownState = {
  activeCard: string | null;
  title: string;
  sourceModule: "orders" | "tasks" | "delivery";
  filters: Record<string, any>;
  sort: {
    field: string;
    direction: "asc" | "desc";
  };
  data: any[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};
```

---

# 9. Permission rule bắt buộc

Backend phải kiểm tra quyền, không chỉ filter frontend.

```text
Admin → xem toàn bộ.
Manager/Leader → xem theo team/scope.
Account → chỉ thấy order/task/delivery được phân quyền.
Design/Editor → chỉ thấy task assigned_to = current_user_id.
Client → không được vào Master Dashboard.
```

Nếu không có quyền:

```text
Return 403 hoặc empty result theo policy.
Không trả internal note/internal deadline cho user không đủ quyền.
```

---

# 10. Empty / Loading / Error State

## Loading

```text
Đang tải danh sách...
```

## Empty

```text
Không có dữ liệu phù hợp với bộ lọc này.
```

## Error

```text
Không thể tải danh sách. Vui lòng thử lại.
```

---

# 11. Acceptance Criteria

## Functional

```text
Click New Requests card hiển thị đúng 12 request.
List New Requests sort theo created_at ASC.
Click một request mở đúng /orders/{order_id}.
Click Overdue card hiển thị đúng task trễ hạn.
Click một overdue task mở đúng /production/tasks/{task_id}.
Click Ready for Delivery mở đúng delivery/task cần Account xử lý.
Các global filters trên Dashboard vẫn được giữ khi click card.
Có pagination nếu list nhiều hơn 20 dòng.
Có empty state nếu không có dữ liệu.
Có loading state khi đang tải list.
```

## Security

```text
User chỉ thấy dữ liệu đúng quyền.
Client không truy cập Master Dashboard drilldown.
Backend enforce permission/data scope.
Không trả internal data cho user không có quyền.
```

## UX

```text
KPI card có cursor pointer.
Hover card có hiệu ứng nhẹ.
Khi card active, card có border/highlight.
Result panel hiển thị title rõ ràng.
Filter chips cho biết list đang lọc theo gì.
Row có hover state.
Order ID/Task ID/Delivery ID có thể click.
```

---

# 12. Codex Command ngắn

```text
Update Master Dashboard KPI cards to support click-through drilldown. When a KPI card is clicked, apply the mapped filters/sort, show a table list of matching records, and allow row click to navigate to Order/Task/Delivery detail pages. Preserve global dashboard filters and enforce backend permission/data scope.
```
