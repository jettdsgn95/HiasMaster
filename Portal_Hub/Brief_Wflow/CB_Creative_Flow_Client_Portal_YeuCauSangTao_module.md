# CB Creative Flow - Media Hub by CB Centres
# Client Portal Module — “Yêu cầu sáng tạo của tôi”

**Module name:** Yêu cầu sáng tạo của tôi  
**Purpose:** Xây dựng giao diện riêng cho tài khoản Client sau khi đăng nhập, giúp Client tạo yêu cầu mới, theo dõi lịch sử yêu cầu, xem tiến độ hiện tại, nhận thông báo trạng thái, gửi feedback/rating và sử dụng AI Tools được cấp quyền.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, Font Montserrat, clean SaaS dashboard.  
**Primary route:** `/client/dashboard`  
**Main user role:** `Client`

---

# 1. Bối cảnh

Hiện tại hệ thống đã có các module nội bộ:

```text
Master Dashboard
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

Tuy nhiên khi đăng nhập với vai trò **Client**, hệ thống chưa có giao diện riêng. Cần bổ sung một page/module riêng tên:

```text
Yêu cầu sáng tạo của tôi
```

Đây là giao diện dành cho Client để tự theo dõi toàn bộ yêu cầu đã gửi, tiến độ đang xử lý, trạng thái cần phản hồi và các file đã bàn giao.

---

# 2. Mục tiêu module

Module **Yêu cầu sáng tạo của tôi** giúp Client:

```text
Tạo yêu cầu sáng tạo mới
Xem lịch sử đơn/yêu cầu đã gửi
Theo dõi tiến độ yêu cầu đang xử lý
Nhận thông báo trạng thái yêu cầu
Xem preview/final link nếu đã được bàn giao
Bổ sung brief khi Account yêu cầu
Gửi feedback/chỉnh sửa nếu có preview/final
Đánh giá mức độ hài lòng sau khi bàn giao
Sử dụng AI Tools được cấp quyền
Chatbot hỗ trợ gửi brief, tra cứu order và tạo nội dung cơ bản
```

Mục tiêu trải nghiệm:

```text
Minh bạch tiến độ
Dễ gửi yêu cầu
Dễ biết mình cần làm gì
Giảm hỏi thủ công qua Zalo/email
Tăng chất lượng brief đầu vào
Tăng tỷ lệ rating sau bàn giao
```

---

# 3. Người dùng chính

```text
Client
Branch Client
Department Client
Partner Client
Internal Requester
```

Client có thể là:

```text
Chi nhánh
Bộ phận nội bộ
Đối tác
Cá nhân được cấp quyền gửi order
```

Ví dụ:

```text
CB Mekong
Academic Department
Sales Team
Partner School
CB Hưng Phú
```

---

# 4. Route & Redirect Logic

## 4.1. Login redirect

Khi user đăng nhập:

```text
If user.role = Client
→ Redirect to /client/dashboard
```

Không đưa Client vào Master Dashboard nội bộ.

## 4.2. Client routes

Client chỉ được truy cập các route sau:

```text
/client/dashboard
/client/order-form
/client/orders
/client/orders/:order_id
/client/ai-tools
/client/notifications
/client/support
/client/profile
```

## 4.3. Blocked routes for Client

Client không được truy cập:

```text
/dashboard
/dashboard/master
/orders internal
/database-orders
/production
/delivery internal
/reports
/user-management
/settings
/admin
```

Nếu Client cố truy cập các route nội bộ:

```text
Redirect về /client/dashboard
hoặc trả 403 Permission Denied
```

---

# 5. Navigation riêng cho Client

Khi role = Client, sidebar/menu phải khác giao diện nội bộ.

## 5.1. Client sidebar

```text
Tổng quan
Tạo yêu cầu
Yêu cầu sáng tạo của tôi
AI Tools
Thông báo
Hỗ trợ
Tài khoản
```

## 5.2. Không hiển thị trong Client sidebar

```text
Master Dashboard
Database Orders
Production Board
Delivery Log nội bộ
Reports
User Management
Settings
```

## 5.3. Suggested top CTA

Trên header luôn nên có CTA:

```text
+ Tạo yêu cầu mới
```

---

# 6. Nguyên tắc bảo mật dữ liệu

Client chỉ được thấy dữ liệu public và dữ liệu thuộc quyền của họ.

## 6.1. Client được thấy

```text
Order ID
Tên yêu cầu / Project / Campaign
Ngày gửi
Deadline mong muốn
Trạng thái public
Tiến độ public
Preview link nếu đã được gửi
Final link nếu đã bàn giao
Feedback/rating của chính order đó
Thông báo liên quan đến order của mình
AI Tools được cấp quyền
```

## 6.2. Client không được thấy

```text
Internal Deadline
Internal Note
Account internal comment
Production PIC workload
Task nội bộ chi tiết
Tên nhân sự xử lý nếu không muốn public
Master Dashboard nội bộ
Reports nội bộ
User Management
Settings
Activity Log nội bộ
Permission settings
AI internal prompt/template
AI usage cost/log nội bộ
```

---

# 7. Data Scope cho Client

## 7.1. Client data visibility

Backend phải enforce data scope:

```text
Client chỉ thấy order nếu:
orders.requester_id = current_user.id
OR orders.client_account_id = current_user.id
OR orders.department_id IN current_user.allowed_departments
```

## 7.2. Query rule

```sql
SELECT * FROM orders
WHERE requester_id = current_user_id
OR client_account_id = current_user_id
OR department_id IN allowed_departments;
```

## 7.3. Backend rule bắt buộc

Không chỉ ẩn ở frontend. Backend phải kiểm tra:

```text
current_user.role = Client
record ownership
allowed_departments
public field mapping
AI tool permission
```

---

# 8. Public Status Mapping

Client không nên thấy status nội bộ quá chi tiết. Cần map sang status public dễ hiểu.

| Internal Status | Client Public Status |
|---|---|
| Chờ xác nhận | Đã nhận yêu cầu |
| Đang kiểm tra brief | Đang kiểm tra thông tin |
| Cần bổ sung thông tin | Cần bổ sung brief |
| Đã xác nhận brief | Đã tiếp nhận |
| Chưa phân công | Đang điều phối |
| Đã phân công | Đang xử lý |
| Chưa nhận task | Đang xử lý |
| Nhận task | Đang xử lý |
| Đang thực hiện | Đang sản xuất |
| Chờ duyệt nội bộ | Đang kiểm tra nội bộ |
| Chỉnh sửa nội bộ | Đang hoàn thiện |
| Sẵn sàng bàn giao | Sắp bàn giao |
| Đã gửi preview | Đã gửi bản xem trước |
| Chờ client phản hồi | Chờ phản hồi từ bạn |
| Client yêu cầu chỉnh sửa | Đang chỉnh sửa theo phản hồi |
| Chỉnh sửa theo feedback | Đang chỉnh sửa theo phản hồi |
| Đã gửi final | Đã bàn giao |
| Đã nhận đánh giá | Đã nhận đánh giá |
| Hoàn thành | Hoàn thành |
| Tạm dừng | Tạm dừng |
| Hủy | Đã hủy |

---

# 9. Public Progress Mapping

Không nên show toàn bộ progress nội bộ nếu không cần. Client nên thấy timeline milestone đơn giản.

## 9.1. Public timeline

```text
1. Đã nhận yêu cầu
2. Đang kiểm tra brief
3. Đã tiếp nhận
4. Đang xử lý
5. Đang kiểm tra nội bộ
6. Sắp bàn giao
7. Đã bàn giao
8. Hoàn thành
```

## 9.2. Public progress percent nếu cần

| Public Stage | Progress |
|---|---:|
| Đã nhận yêu cầu | 10% |
| Đang kiểm tra brief | 15% |
| Cần bổ sung brief | 15% |
| Đã tiếp nhận | 20% |
| Đang xử lý | 50% |
| Đang kiểm tra nội bộ | 75% |
| Sắp bàn giao | 90% |
| Đã bàn giao | 95% |
| Hoàn thành | 100% |
| Đã hủy | 0% |

---

# 10. Module structure

```text
Yêu cầu sáng tạo của tôi
├── Client Dashboard Overview
├── Quick Actions
├── Required Action Center
├── Current Orders
├── Order History
├── Client Order Detail Public View
├── Notifications
├── Client AI Tools
└── Client Support / Chatbot
```

---

# 11. Client Dashboard Overview

## 11.1. Mục đích

Là trang đầu tiên sau khi Client đăng nhập. Hiển thị tổng quan nhanh về các yêu cầu của Client.

## 11.2. Welcome header

```text
Xin chào, {client_name}

Yêu cầu sáng tạo của tôi
Theo dõi các yêu cầu thiết kế, video, quay/chụp và nội dung Media của bạn tại CB Centres.
```

CTA:

```text
+ Tạo yêu cầu mới
```

## 11.3. KPI cards

| Card | Meaning | Click behavior |
|---|---|---|
| Tổng yêu cầu | Tổng order của Client | Filter all orders |
| Đang xử lý | Order đang trong production | Filter active public status |
| Cần bổ sung brief | Order cần Client bổ sung thông tin | Filter public_status = Cần bổ sung brief |
| Chờ phản hồi | Order có preview/feedback cần Client xử lý | Filter public_status = Chờ phản hồi từ bạn |
| Đã bàn giao | Order đã có final link | Filter public_status = Đã bàn giao |
| Chưa đánh giá | Delivery đã final nhưng chưa rating | Filter waiting rating |

## 11.4. Example UI copy

```text
Tổng quan yêu cầu sáng tạo của bạn

[12] Tổng yêu cầu
[3] Đang xử lý
[1] Cần bổ sung brief
[2] Chờ phản hồi của bạn
[5] Đã bàn giao
[1] Chưa đánh giá
```

---

# 12. Quick Actions

## 12.1. Mục đích

Cho Client thao tác nhanh.

## 12.2. Action buttons

```text
+ Tạo yêu cầu mới
Xem yêu cầu đang xử lý
Bổ sung brief
Xem file đã bàn giao
Đánh giá sản phẩm
Dùng AI tạo caption/post
Chat với CB Assistant
```

## 12.3. UI gợi ý

```text
Bạn cần làm gì hôm nay?

[+ Tạo yêu cầu mới]
[Kiểm tra tiến độ]
[Bổ sung brief]
[Dùng AI Tools]
[Hỏi CB Assistant]
```

---

# 13. Required Action Center

## 13.1. Mục đích

Đây là khu vực rất quan trọng, giúp Client biết ngay việc nào đang chờ họ xử lý.

## 13.2. Action categories

```text
Cần bổ sung brief
Cần duyệt preview
Cần gửi feedback
Cần đánh giá sản phẩm
```

## 13.3. Card examples

```text
Cần bổ sung brief
Order MEDIA-2026-0009 cần bổ sung kích thước và CTA chính.

[Bổ sung ngay]
```

```text
Đã có bản preview
Order MEDIA-2026-0010 đã có preview để bạn kiểm tra.

[Xem preview] [Gửi phản hồi]
```

```text
Chưa đánh giá
Order MEDIA-2026-0011 đã bàn giao final. Vui lòng đánh giá mức độ hài lòng.

[Đánh giá ngay]
```

## 13.4. Empty state

```text
Không có hành động nào cần bạn xử lý lúc này.
Team Media đang tiếp tục xử lý các yêu cầu của bạn.
```

---

# 14. Current Orders / Đơn đang xử lý

## 14.1. Mục đích

Hiển thị các order chưa hoàn thành hoặc đang cần Client chú ý.

## 14.2. Điều kiện hiển thị

```text
public_status NOT IN Hoàn thành, Đã hủy
```

Ưu tiên hiển thị:

```text
Cần bổ sung brief
Chờ phản hồi từ bạn
Đang xử lý
Đang sản xuất
Sắp bàn giao
Đã bàn giao nhưng chưa đánh giá
```

## 14.3. Order card fields

```text
Order ID
Tên yêu cầu / Project
Ngày gửi
Deadline mong muốn
Trạng thái hiện tại
Progress public
Action tiếp theo
```

## 14.4. Example card

```text
MEDIA-2026-0008
Backdrop Summer Campaign

Ngày gửi: 10/03/2026
Deadline mong muốn: 14/03/2026
Trạng thái: Đang sản xuất
Tiến độ: 50%

[Theo dõi chi tiết]
```

## 14.5. Example card cần action

```text
MEDIA-2026-0009
Social Post IELTS

Trạng thái: Cần bổ sung brief
Cần bổ sung: Kích thước, CTA chính, hình ảnh sản phẩm

[Bổ sung thông tin]
```

---

# 15. Order History / Lịch sử yêu cầu

## 15.1. Mục đích

Cho Client xem toàn bộ order đã từng gửi.

## 15.2. Table columns

```text
Order ID
Ngày gửi
Tên yêu cầu
Loại yêu cầu
Hạng mục
Deadline mong muốn
Trạng thái
Ngày bàn giao
Rating
Action
```

## 15.3. Filter

```text
Tìm kiếm theo Order ID / Tên yêu cầu
Trạng thái
Loại yêu cầu
Hạng mục
Khoảng thời gian
Đã bàn giao / Chưa bàn giao
Chưa đánh giá
```

## 15.4. Sort

```text
Ngày gửi mới nhất
Deadline gần nhất
Trạng thái cần xử lý trước
Ngày bàn giao mới nhất
Rating thấp trước
```

## 15.5. Row actions

```text
Xem chi tiết
Xem preview
Xem final
Bổ sung brief
Gửi feedback
Đánh giá
Tạo yêu cầu tương tự
```

---

# 16. Client Order Detail Public View

## 16.1. Mục đích

Khi Client click một order, hệ thống mở trang chi tiết public, chỉ hiển thị thông tin Client được phép xem.

## 16.2. Layout

```text
Order Detail Public
├── Header Summary
├── Progress Timeline
├── Brief Summary
├── Required Action
├── Files & Delivery
├── Feedback / Revision
├── Rating
└── Support
```

## 16.3. Header Summary

Fields:

```text
Order ID
Tên yêu cầu
Loại yêu cầu
Hạng mục
Ngày gửi
Deadline mong muốn
Trạng thái public
```

Example:

```text
MEDIA-2026-0008
Backdrop Summer Campaign

Loại yêu cầu: Thiết kế/POSM
Hạng mục: Backdrop
Ngày gửi: 10/03/2026
Deadline mong muốn: 14/03/2026
Trạng thái: Đang sản xuất
```

## 16.4. Progress Timeline

Timeline client-facing:

```text
Đã nhận yêu cầu  ✓
Đang kiểm tra brief  ✓
Đã tiếp nhận  ✓
Đang xử lý  ●
Đang kiểm tra nội bộ  ○
Sắp bàn giao  ○
Đã bàn giao  ○
Hoàn thành  ○
```

## 16.5. Brief Summary

Client thấy lại brief đã gửi:

```text
Mục đích
Đối tượng mục tiêu
Loại yêu cầu
Hạng mục
Kích thước
Nội dung đã gửi
Định hướng thiết kế
Wording
File brief/source link
Ghi chú
```

Nếu brief đã được Account xác nhận:

```text
Brief đã được tiếp nhận. Nếu cần thay đổi nội dung, vui lòng gửi feedback hoặc liên hệ Account phụ trách.
```

## 16.6. Required Action Block

### Case 1 — Cần bổ sung brief

```text
Team Media cần bạn bổ sung thêm thông tin để tiếp tục xử lý.

Thông tin cần bổ sung:
- Kích thước standee
- CTA chính
- Link ảnh sản phẩm

[Bổ sung thông tin]
```

### Case 2 — Chờ phản hồi preview

```text
Bạn có bản preview cần kiểm tra.

[Xem preview]
[Gửi phản hồi]
[Đồng ý bản preview]
```

### Case 3 — Đã gửi final nhưng chưa rating

```text
Sản phẩm đã được bàn giao. Vui lòng đánh giá mức độ hài lòng.

[Xem final]
[Đánh giá sản phẩm]
```

### Case 4 — Không cần action

```text
Không có hành động cần thực hiện lúc này.
Team Media đang xử lý yêu cầu của bạn.
```

---

# 17. Files & Delivery

## 17.1. Client được thấy

```text
Preview Link
Final Link
Delivery Date
File version nếu có
Delivery note public
```

## 17.2. Actions

```text
Open Preview
Open Final
Copy Link
Download nếu link cho phép
```

## 17.3. Empty state

```text
File bàn giao chưa sẵn sàng. Hệ thống sẽ thông báo khi có bản preview/final.
```

---

# 18. Feedback / Revision

## 18.1. Mục đích

Cho Client gửi phản hồi có cấu trúc thay vì nhắn rời rạc.

## 18.2. Feedback form fields

```text
Feedback type
Nội dung phản hồi
File đính kèm nếu có
Mức độ ưu tiên
Xác nhận nội dung chỉnh sửa
```

## 18.3. Feedback type options

```text
Chỉnh nội dung
Chỉnh hình ảnh
Chỉnh màu sắc
Chỉnh kích thước
Sai thông tin
Sai chính tả
Khác
```

## 18.4. Business rule

Nếu Client gửi feedback:

```text
Delivery Status = Client yêu cầu chỉnh sửa
Production Status = Chỉnh sửa theo feedback
revision_count + 1
Notify Account/P.I.C
```

## 18.5. UI warning

```text
Các yêu cầu chỉnh sửa phát sinh ngoài brief ban đầu có thể cần Account xác nhận lại deadline.
```

---

# 19. Rating / Satisfaction

## 19.1. Mục đích

Đo mức độ hài lòng sau khi bàn giao.

## 19.2. Rating form

```text
Mức độ hài lòng 1–5
Feedback ngắn
Lý do chưa hài lòng nếu rating <= 3
Cho phép team liên hệ lại nếu cần
```

## 19.3. Rating scale

```text
1 — Rất không hài lòng
2 — Không hài lòng
3 — Bình thường
4 — Hài lòng
5 — Rất hài lòng
```

## 19.4. Business rule

```text
Nếu delivery_status = Đã gửi final hoặc Hoàn thành
→ Hiển thị Rating form nếu chưa rating.
```

Sau khi rating:

```text
satisfaction_score được lưu vào Delivery
client_feedback được lưu
rating_date được ghi nhận
Dashboard/Reports cập nhật
```

---

# 20. Notifications cho Client

## 20.1. Notification types

```text
Order created confirmation
Brief needs more info
Brief confirmed
Order in production
Preview sent
Client feedback requested
Final delivered
Rating reminder
Order completed
Order reopened
```

## 20.2. Notification list UI

```text
Notification title
Order ID
Short message
Time
Read/unread status
Action button
```

## 20.3. Examples

```text
Cần bổ sung brief
Order MEDIA-2026-0009 cần bổ sung kích thước và CTA.
[Bổ sung ngay]
```

```text
Đã có bản preview
Order MEDIA-2026-0010 đã có preview để bạn kiểm tra.
[Xem preview]
```

---

# 21. AI Tools dành cho Client

Client có thể sử dụng AI Tools nhưng phải giới hạn theo quyền.

## 21.1. AI Tools nên cho Client dùng

```text
Post Generator
Caption Builder
Ads Copy Basic
Brief Helper
CTA/Hashtag Generator
Visual Prompt Basic nếu phù hợp
```

## 21.2. AI Tools không nên mở mặc định cho Client

```text
Internal Brief Optimizer nâng cao
Report Summary
Workload Recommendation
Internal Prompt Template
AI Cost/Usage Logs
Admin AI Settings
```

## 21.3. Client AI Tools page

```text
Client AI Tools
├── Tạo caption/post
├── Tạo ads copy cơ bản
├── Gợi ý brief đầy đủ hơn
├── Tạo CTA/Hashtag
└── Lịch sử nội dung đã tạo
```

## 21.4. Client AI output actions

```text
Copy
Save as Draft
Use in New Order
Attach to Existing Order nếu có quyền
```

## 21.5. Recommended AI-to-Order flow

```text
Client tạo caption/content bằng AI
→ Click "Dùng nội dung này để tạo yêu cầu thiết kế"
→ Mở Order Form
→ Auto-fill content_brief
→ Client bổ sung thêm thông tin
→ Submit order
```

Tính năng này rất nên có vì giúp Client gửi brief tốt hơn.

---

# 22. Client Chatbot

## 22.1. Chatbot hỗ trợ Client

```text
Hướng dẫn gửi order
Giải thích các status public
Tra cứu order của tôi
Hỏi cần bổ sung brief gì
Tạo caption/post cơ bản
Hướng dẫn đánh giá sản phẩm
```

## 22.2. Chatbot không được trả lời

```text
Ai đang thiết kế nếu hệ thống không public
Internal deadline
Internal note
Lý do nội bộ bị chậm
Report nội bộ
Thông tin order của client khác
```

## 22.3. Suggested prompts cho Client

```text
Tôi muốn gửi yêu cầu thiết kế mới
Kiểm tra trạng thái đơn của tôi
Tôi cần bổ sung brief gì?
Tạo giúp tôi caption cho chương trình này
Tôi muốn đánh giá sản phẩm đã nhận
```

---

# 23. Database / Data Requirements

## 23.1. Users table fields

Cần có hoặc bổ sung:

```text
user_id
role = Client
client_type
organization_name
department_id
allowed_departments
allowed_order_types
status
```

## 23.2. Orders table

Client query dựa vào:

```text
requester_id
client_account_id
department_id
created_at
project_name
request_type
deliverable_type
requested_deadline
account_status
production_status
delivery_status
progress
```

## 23.3. Delivery table

Client thấy public fields:

```text
delivery_id
order_id
preview_link
final_link
delivery_status public
delivery_date
satisfaction_score
client_feedback
```

## 23.4. Notifications table

Nên có:

```text
notification_id
user_id
order_id
task_id optional
delivery_id optional
title
message
type
action_url
is_read
created_at
```

## 23.5. ClientFeedback table

Có thể dùng chung với Delivery feedback hoặc tách riêng:

```text
feedback_id
order_id
delivery_id
user_id
feedback_type
content
attachments
created_at
status
```

---

# 24. API Requirements

## 24.1. Client dashboard summary

```http
GET /api/client/dashboard/summary
```

Response:

```json
{
  "total_orders": 12,
  "in_progress": 3,
  "need_info": 1,
  "waiting_feedback": 2,
  "delivered": 5,
  "waiting_rating": 1
}
```

## 24.2. Client orders list

```http
GET /api/client/orders
```

Query params:

```text
status
start_date
end_date
request_type
search
page
limit
sort
```

## 24.3. Client order detail

```http
GET /api/client/orders/{order_id}
```

Important:

```text
Response chỉ trả public fields.
Không trả internal_deadline, internal_note, activity_log nội bộ.
```

## 24.4. Submit missing info

```http
POST /api/client/orders/{order_id}/submit-info
```

Request:

```json
{
  "additional_info": "Kích thước standee 80x180cm. CTA: Đăng ký ngay.",
  "source_link": "https://drive.google.com/...",
  "attachments": []
}
```

## 24.5. Submit feedback

```http
POST /api/client/orders/{order_id}/feedback
```

Request:

```json
{
  "feedback_type": "Chỉnh nội dung",
  "content": "Vui lòng chỉnh lại thời gian khai giảng.",
  "priority": "Bình thường",
  "attachments": []
}
```

## 24.6. Submit rating

```http
POST /api/client/orders/{order_id}/rating
```

Request:

```json
{
  "satisfaction_score": 5,
  "client_feedback": "Thiết kế đúng brief, bàn giao nhanh."
}
```

## 24.7. Client notifications

```http
GET /api/client/notifications
PATCH /api/client/notifications/{notification_id}/read
PATCH /api/client/notifications/read-all
```

## 24.8. Client AI Tools

Dùng chung endpoint AI Tools nhưng backend phải check role:

```http
POST /api/ai-tools/{tool_key}/generate
```

Validation:

```text
role = Client
tool_key allowed for Client
usage limit not exceeded
```

---

# 25. Frontend Component Structure

```text
ClientPortalPage
├── ClientSidebar
├── ClientHeader
│   ├── PageTitle: Yêu cầu sáng tạo của tôi
│   ├── NotificationBell
│   └── CreateOrderButton
│
├── ClientDashboardOverview
│   ├── WelcomeCard
│   ├── ClientKPICards
│   └── QuickActions
│
├── RequiredActionCenter
│   ├── NeedInfoCard
│   ├── PreviewReviewCard
│   └── RatingReminderCard
│
├── CurrentOrdersSection
│   └── ClientOrderCard
│
├── OrderHistorySection
│   ├── SearchFilterBar
│   └── ClientOrdersTable
│
├── ClientOrderDetailPage
│   ├── PublicOrderHeader
│   ├── PublicProgressTimeline
│   ├── PublicBriefSummary
│   ├── RequiredActionBlock
│   ├── FilesDeliveryPanel
│   ├── FeedbackForm
│   ├── RatingForm
│   └── SupportPanel
│
├── ClientNotificationsPage
├── ClientAIToolsPage
└── ClientChatbotWidget
```

---

# 26. UI / Visual Direction

## 26.1. Style

```text
Clean SaaS dashboard
Friendly but professional
Less complex than internal dashboard
White background
Large CTA buttons
Clear status badges
Progress timeline easy to read
```

## 26.2. Brand

```text
Primary red: #BA110F
Secondary blue: #191970
Font: Montserrat
Rounded cards
Soft shadow
High whitespace
```

## 26.3. Suggested layout

```text
Top header:
Logo + Yêu cầu sáng tạo của tôi + Create Order button + Notification bell

Main content:
Left/center: Required Actions + Current Orders
Right: AI Tools quick card + Notifications

Bottom:
Order History table
```

---

# 27. Empty / Loading / Error States

## Loading

```text
Đang tải yêu cầu của bạn...
Đang tải chi tiết yêu cầu...
Đang gửi phản hồi...
Đang gửi đánh giá...
```

## Empty dashboard

```text
Bạn chưa có yêu cầu sáng tạo nào.
Hãy tạo yêu cầu đầu tiên để team Media hỗ trợ bạn.

[+ Tạo yêu cầu mới]
```

## Empty current orders

```text
Không có yêu cầu nào đang xử lý.
```

## Empty notifications

```text
Bạn chưa có thông báo mới.
```

## Error

```text
Không thể tải dữ liệu yêu cầu. Vui lòng thử lại.
Bạn không có quyền xem yêu cầu này.
Không thể gửi phản hồi. Vui lòng thử lại.
```

## Success

```text
Đã gửi yêu cầu bổ sung brief.
Đã gửi phản hồi.
Đã ghi nhận đánh giá.
Đã tạo nội dung AI.
```

---

# 28. Notification Rules

## 28.1. Notify Client when

```text
Order created
Brief needs more info
Brief confirmed
Order moved to production
Preview sent
Client feedback requested
Final delivered
Rating reminder
Order completed
Order reopened
```

## 28.2. Rating reminder rule

Nếu order đã gửi final nhưng chưa rating sau X ngày:

```text
Gửi notification nhắc đánh giá
Hiển thị trong Required Action Center
```

Default:

```text
X = 2 ngày
```

Có thể cấu hình trong Settings.

---

# 29. Recommended Optimizations

## 29.1. “Tạo yêu cầu tương tự”

Trong Order History, thêm action:

```text
Tạo yêu cầu tương tự
```

Flow:

```text
Client click
→ Mở Order Form
→ Auto-fill request_type, deliverable_type, size, target_audience, creative_direction từ order cũ
→ Client chỉnh nội dung mới
→ Submit
```

Rất hữu ích cho chi nhánh thường đặt các hạng mục lặp lại.

## 29.2. AI → Order Form

Flow:

```text
Client dùng AI tạo caption/content
→ Click "Dùng nội dung này để tạo yêu cầu thiết kế"
→ Mở Order Form
→ Auto-fill content_brief
```

Mục tiêu:

```text
Giúp brief đầu vào đầy đủ hơn
Giảm thời gian Account phải hỏi lại
Tăng chất lượng order
```

## 29.3. Feedback có cấu trúc

Thay vì để Client nhập tự do hoàn toàn, nên có category:

```text
Sai nội dung
Sai chính tả
Sai kích thước
Chỉnh màu sắc
Chỉnh layout
Thêm/bớt thông tin
Khác
```

Mục tiêu:

```text
Giúp Reports phân tích được nguyên nhân chỉnh sửa
Giúp Account/P.I.C xử lý nhanh hơn
```

## 29.4. Required Action Center ưu tiên cao

Nên đặt ngay dưới KPI hoặc bên phải dashboard.

Mục tiêu:

```text
Client biết ngay việc cần làm
Giảm pending feedback
Giảm pending rating
Giảm order bị chậm do thiếu brief
```

---

# 30. Acceptance Criteria

## 30.1. Functional

```text
Khi user role = Client đăng nhập, redirect vào /client/dashboard.
Client thấy giao diện riêng tên "Yêu cầu sáng tạo của tôi".
Client không thấy Master Dashboard nội bộ.
Client xem được tổng quan order của mình.
Client xem được lịch sử order.
Client click order để xem Order Detail Public.
Client thấy trạng thái public, progress timeline, preview/final link nếu có.
Client có thể bổ sung brief khi status cần bổ sung.
Client có thể gửi feedback khi có preview/final.
Client có thể rating sau khi bàn giao.
Client nhận notification trạng thái order.
Client dùng được AI Tools được cấp quyền.
Client có thể dùng AI output để tạo Order Form nếu tính năng được bật.
```

## 30.2. Security

```text
Backend enforce Client data scope.
Client chỉ thấy order của mình hoặc department được cấp quyền.
Client không thấy internal deadline.
Client không thấy internal note.
Client không thấy activity log nội bộ.
Client không thấy production workload.
Client không thấy order của client khác.
Client không truy cập được Database Orders/Production Board/Reports/User Management/Settings.
AI Tools của Client bị giới hạn theo permission.
```

## 30.3. UX

```text
Giao diện đơn giản hơn dashboard nội bộ.
Có CTA Tạo yêu cầu mới rõ ràng.
Có khu vực Việc cần bạn xử lý.
Order status dễ hiểu bằng ngôn ngữ public.
Timeline trực quan.
Có filter/search lịch sử order.
Có notification unread.
AI Tools dễ truy cập.
Có empty/loading/error/success states.
```

---

# 31. Suggested Build Scope

## MVP

```text
Client login redirect
Client sidebar riêng
/client/dashboard
KPI cards
Required Action Center
Current Orders
Order History
Public Order Detail
Client notifications basic
Client rating form
Limited AI Tools link/page
Route guard
Backend data scope
```

## Phase 2

```text
Submit missing info
Client feedback form
AI → Order Form
Tạo yêu cầu tương tự
Notification unread count
Client chatbot suggested prompts
Advanced filters
```

## Phase 3

```text
Client-specific AI history
Realtime notification
Feedback attachment upload
Public delivery approval flow
Client satisfaction analytics
```

---

# 32. Prompt cho Dev / Claude / Codex

```text
Build a dedicated Client Portal page named "Yêu cầu sáng tạo của tôi" for CB Creative Flow - Media Hub by CB Centres.

When user.role = Client, redirect after login to /client/dashboard instead of the internal Master Dashboard.

The Client Portal must include:
- Client-specific sidebar: Tổng quan, Tạo yêu cầu, Yêu cầu sáng tạo của tôi, AI Tools, Thông báo, Hỗ trợ, Tài khoản.
- Overview KPI cards: Tổng yêu cầu, Đang xử lý, Cần bổ sung brief, Chờ phản hồi, Đã bàn giao, Chưa đánh giá.
- Required Action Center: Cần bổ sung brief, cần duyệt preview, cần gửi feedback, cần đánh giá.
- Current Orders section with public progress.
- Order History table with search/filter/sort.
- Public Order Detail page with Header Summary, Progress Timeline, Brief Summary, Required Action, Files & Delivery, Feedback, Rating and Support.
- Client Notifications page.
- Limited Client AI Tools access.
- Optional AI-to-Order flow: use AI generated content to prefill Order Form.

Client can:
- Create new order.
- View own order history.
- Track current order progress.
- View public status.
- View preview/final link if available.
- Submit missing brief info.
- Submit feedback/revision.
- Rate completed delivery.
- Use allowed AI Tools.

Client must not see:
- Internal Master Dashboard.
- Database Orders internal view.
- Production Board.
- Delivery Log internal view.
- Reports.
- User Management.
- Settings.
- Internal deadline.
- Internal notes.
- Internal comments.
- Production workload.
- Orders from other clients.

Backend must enforce client data scope:
orders.requester_id = current_user.id
OR orders.client_account_id = current_user.id
OR orders.department_id IN current_user.allowed_departments.

Use public status mapping for Client.
Use CB brand:
Red #BA110F
Blue #191970
Font Montserrat
Clean professional SaaS UI.
```
