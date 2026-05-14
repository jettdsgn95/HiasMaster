# CB Creative Flow - Media Hub by CB Centres
# Chatbot Module — Detailed Specification for Dev

**Module:** Chatbot Support  
**Purpose:** Tích hợp trợ lý chatbot hỗ trợ quy trình, tra cứu trạng thái order/task theo quyền, hướng dẫn gửi brief và tạo nội dung cơ bản.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, Font Montserrat, clean SaaS dashboard.  

---

# 1. Mục đích

**Chatbot Module** là trợ lý tương tác trong portal **CB Creative Flow - Media Hub by CB Centres**.

Chatbot dùng để:

```text
Hướng dẫn người dùng gửi order
Giải thích quy trình vận hành
Giải thích ý nghĩa status
Tra cứu trạng thái order/task theo quyền
Hướng dẫn bổ sung brief
Hỗ trợ tạo caption/ads copy/prompt cơ bản
Tóm tắt brief
Gợi ý thông tin còn thiếu
Điều hướng người dùng đến đúng module
```

Chatbot không thay thế quyết định của Admin/Account. Các thao tác quan trọng như hủy order, đổi deadline, gửi final, đóng order phải qua UI/action có permission rõ ràng.

---

# 2. Người dùng chính

```text
Client
Account
Admin
Design
Editor
Manager/Leader
```

## Client

```text
Hỏi cách gửi brief
Kiểm tra trạng thái order của mình
Hỏi cần bổ sung thông tin gì
Nhận link preview/final nếu được public
Gửi feedback hoặc được hướng dẫn đến form rating
Tạo caption/post cơ bản nếu được cấp quyền
```

## Account

```text
Tra cứu order nhanh
Tóm tắt brief
Tạo câu hỏi bổ sung brief
Viết email/nhắn tin phản hồi client
Tạo caption/ads copy cơ bản
```

## Admin/Manager

```text
Hỏi tổng quan workload
Hỏi task trễ hạn
Hỏi order chờ xác nhận
Hỏi hiệu suất theo P.I.C
Điều hướng đến dashboard/report
```

## Design/Editor

```text
Xem task được giao
Hỏi brief tóm tắt
Tạo visual prompt
Tạo concept nhanh
Hỏi deadline nội bộ của task
```

---

# 3. Vị trí trong hệ thống

## UI placement

Chatbot có thể đặt ở:

```text
Floating chat button góc phải dưới
Dedicated Chatbot page
Inline assistant trong Order Detail / Task Detail
Inline helper trong Order Form
```

## Route đề xuất

```text
/chatbot
/assistant
```

## Floating entry

```text
Button: CB Assistant
Icon: chat bubble
Position: bottom-right
```

---

# 4. Chatbot Scope

Chatbot có 4 nhóm chức năng chính:

```text
A. Process Assistant
B. Order/Task Status Assistant
C. Brief Assistant
D. Content/Creative Assistant
```

---

# 5. A. Process Assistant

## Mục đích

Hướng dẫn người dùng sử dụng portal và hiểu quy trình.

## Chatbot cần trả lời được:

```text
Tôi muốn gửi đơn thiết kế thì làm sao?
Deadline tối thiểu cho standee là bao lâu?
Tôi cần upload file gì?
Tôi có thể chỉnh brief sau khi gửi không?
Account Status nghĩa là gì?
Production Status nghĩa là gì?
Khi nào order được bàn giao?
Làm sao để đánh giá mức độ hài lòng?
```

## Knowledge base cần có

```text
Order Form guide
Database Orders workflow
Production Board workflow
Delivery Log workflow
SLA/deadline policy
Status definitions
File upload policy
Brand/content responsibility note
```

---

# 6. B. Order/Task Status Assistant

## Mục đích

Tra cứu nhanh trạng thái order/task theo quyền người dùng.

## Câu hỏi cần hỗ trợ

```text
Đơn MEDIA-2026-0001 đang ở trạng thái nào?
Task TASK-0001 ai đang làm?
Deadline nội bộ của task này là khi nào?
Order nào đang chờ tôi xử lý?
Tôi có task nào sắp đến hạn không?
Order nào đang chờ client feedback?
Order nào chưa có rating?
```

## Permission rule

Chatbot chỉ được trả dữ liệu nếu user có quyền xem record đó.

```text
Admin → có thể hỏi toàn bộ.
Manager → hỏi dữ liệu team được cấp quyền.
Account → hỏi order/task mình phụ trách.
Design/Editor → hỏi task assigned_to = current_user_id.
Client → chỉ hỏi order requester_id = current_user_id.
```

Nếu không có quyền:

```text
Bạn không có quyền xem thông tin của order/task này. Vui lòng liên hệ Admin hoặc Account phụ trách.
```

---

# 7. C. Brief Assistant

## Mục đích

Hỗ trợ Account/Client chuẩn hóa brief.

## Use cases

```text
Tóm tắt brief này giúp tôi.
Brief này còn thiếu thông tin gì?
Viết câu hỏi yêu cầu client bổ sung brief.
Chuyển brief thô thành brief rõ ràng cho Designer.
Tạo checklist trước khi xác nhận brief.
```

## Input sources

```text
Order Form data
Order Detail brief
Uploaded document summary nếu phase sau hỗ trợ
User pasted text
```

## Output

```text
Brief summary
Missing information
Questions to requester
Recommended next action
Ready to confirm: Yes/No
```

---

# 8. D. Content / Creative Assistant

## Mục đích

Hỗ trợ tạo nội dung media cơ bản ngay trong chat.

## Use cases

```text
Viết caption Facebook cho chương trình IELTS.
Tạo ads copy cho chiến dịch tuyển sinh.
Tạo visual prompt cho social post.
Gợi ý concept campaign.
Tạo outline slide proposal.
Tạo CTA và hashtag.
```

## Output types

```text
Caption
Ads copy
Headline
CTA
Hashtag
Visual prompt
Video concept
Slide outline
Campaign idea
```

## Integration

Các tác vụ content có thể gọi lại AI Tools Module.

```text
Chatbot → AI Tools API → Generate output → Chat response
```

---

# 9. Chatbot UI

## 9.1. Chat window layout

```text
Chatbot Window
├── Header
│   ├── Bot name
│   ├── Status
│   ├── Minimize
│   └── Close
│
├── Suggested Prompts
├── Message Thread
├── Attachment/Context Area nếu có
├── Input Box
│   ├── Text input
│   ├── Send button
│   └── Optional quick actions
└── Footer note
```

## 9.2. Header

```text
Name: CB Assistant
Subtitle: Hỗ trợ order, brief, task và nội dung media
```

## 9.3. Suggested prompts theo role

### Client

```text
Tôi muốn gửi yêu cầu thiết kế mới
Kiểm tra trạng thái order của tôi
Tôi cần bổ sung brief gì?
Tôi muốn đánh giá sản phẩm đã nhận
```

### Account

```text
Đơn nào đang chờ xác nhận brief?
Tóm tắt brief order này
Viết câu hỏi yêu cầu bổ sung brief
Đơn nào chờ bàn giao?
```

### Design/Editor

```text
Tôi có task nào mới?
Task nào sắp đến hạn?
Tóm tắt brief task này
Tạo visual prompt cho task này
```

### Admin/Manager

```text
Task nào đang trễ hạn?
Ai đang có workload cao?
Order nào chưa phân công?
Tóm tắt tình hình hôm nay
```

---

# 10. Conversation Context

Chatbot cần biết context hiện tại nếu user đang ở một trang cụ thể.

## User đang ở Order Detail

```text
current_page = order_detail
order_id = MEDIA-2026-0001
```

Gợi ý:

```text
Tóm tắt order này
Brief này còn thiếu gì?
Viết tin nhắn hỏi requester bổ sung thông tin
```

## User đang ở Task Detail

```text
current_page = task_detail
task_id = TASK-0001
```

Gợi ý:

```text
Tóm tắt brief task này
Deadline task này khi nào?
Tạo visual prompt cho task này
```

## User đang ở Reports

```text
current_page = reports
active_filters = {...}
```

Gợi ý:

```text
Tóm tắt báo cáo hiện tại
Task trễ nhiều nhất thuộc PIC nào?
```

---

# 11. Intent Categories

Chatbot backend nên phân loại intent:

```text
process_help
order_status_query
task_status_query
brief_summary
missing_info_check
content_generation
visual_prompt_generation
report_summary
navigation_help
permission_denied
fallback
```

## Example mapping

| User asks | Intent |
|---|---|
| Đơn MEDIA-2026-0001 đến đâu rồi? | order_status_query |
| Tôi muốn gửi order mới | process_help |
| Brief này thiếu gì? | missing_info_check |
| Viết caption cho chương trình này | content_generation |
| Task nào trễ hạn? | report_summary |
| Mở Production Board giúp tôi | navigation_help |

---

# 12. Data Access by Intent

## process_help

Nguồn dữ liệu:

```text
Static knowledge base
Settings
SLA rules
Workflow status definitions
```

## order_status_query

Nguồn dữ liệu:

```text
Orders
Delivery
Tasks summary
```

Permission:

```text
Must check order visibility.
```

## task_status_query

Nguồn dữ liệu:

```text
Tasks
Orders
Users
```

Permission:

```text
Must check task visibility.
```

## brief_summary / missing_info_check

Nguồn dữ liệu:

```text
Orders brief fields
Files metadata
Comments if allowed
```

Permission:

```text
Must check order visibility.
```

## content_generation

Nguồn dữ liệu:

```text
User input
AI Tools prompt templates
Brand preset
```

Permission:

```text
Must check AI Tools access.
```

## report_summary

Nguồn dữ liệu:

```text
Reports APIs
Dashboard APIs
```

Permission:

```text
Admin/Manager/Account only, depending on scope.
```

---

# 13. Public vs Internal Response Rules

## Client response

Client chỉ thấy:

```text
Public status
Submitted date
Requested deadline
Preview/final link nếu đã public
Feedback/rating action
```

Client không thấy:

```text
Internal deadline
Internal note
Production PIC workload
Internal comments
Account checklist
Activity log nội bộ
```

## Internal user response

Admin/Account/Design/Editor thấy theo quyền:

```text
Internal status nếu được phép
P.I.C nếu được phép
Internal deadline nếu được phép
Task progress
Relevant comments
```

---

# 14. Response Format Standards

Chatbot nên trả lời ngắn, rõ và có CTA.

## Order status response format

```text
Order MEDIA-2026-0001 hiện đang ở trạng thái: Đang thực hiện.

Thông tin chính:
- Project: Summer Campaign
- P.I.C: Duy
- Progress: 50%
- Deadline nội bộ: 14/03/2026 17:00

Hành động tiếp theo:
- P.I.C cần cập nhật preview trước deadline.
[Open Order] [Open Task]
```

## Client public response format

```text
Yêu cầu MEDIA-2026-0001 của bạn hiện đang ở trạng thái: Đang xử lý.

Team Media đã tiếp nhận brief và đang triển khai.
Khi có bản preview/final, hệ thống sẽ thông báo cho bạn.
[Theo dõi đơn]
```

## Missing brief response format

```text
Brief hiện còn thiếu 3 thông tin:

1. Kích thước standee
2. CTA chính
3. Link hình ảnh sản phẩm

Gợi ý tin nhắn gửi requester:
"Anh/chị vui lòng bổ sung kích thước standee, CTA chính và link hình ảnh sản phẩm để team Media triển khai đúng brief."
```

---

# 15. Actions từ Chatbot

Chatbot có thể gợi ý action, nhưng action quan trọng cần confirmation.

## Safe actions

```text
Open Order
Open Task
Open Order Form
Copy generated text
Open Reports
Open Delivery Log
```

## Actions cần confirmation

```text
Create order draft
Save generated output to order note
Send message/request more info
Create task draft
```

## Actions không nên cho chatbot tự làm trong MVP

```text
Cancel order
Close order
Send final
Change deadline
Change PIC
Delete user
Change permission
```

---

# 16. Knowledge Base

Chatbot cần được cấp knowledge base nội bộ.

## Nội dung KB

```text
System overview
Order Form guide
Database Orders guide
Production Board guide
Delivery Log guide
Reports guide
User roles and permissions
Status definitions
SLA/deadline policy
File upload policy
Brand preset
FAQ
```

## KB format

```text
Markdown files
Database documents
Vector store nếu dùng RAG
Static JSON
```

## Suggested KB files

```text
kb_system_overview.md
kb_order_form.md
kb_database_orders.md
kb_production_board.md
kb_delivery_log.md
kb_reports.md
kb_roles_permissions.md
kb_sla_deadline.md
kb_brand_preset.md
kb_faq.md
```

---

# 17. API Requirements

## Chat send message

```http
POST /api/chatbot/message
```

Request:

```json
{
  "message": "Đơn MEDIA-2026-0001 đang ở trạng thái nào?",
  "context": {
    "current_page": "order_detail",
    "order_id": "MEDIA-2026-0001"
  }
}
```

Response:

```json
{
  "success": true,
  "intent": "order_status_query",
  "response": "Order MEDIA-2026-0001 hiện đang ở trạng thái Đang thực hiện...",
  "actions": [
    {
      "label": "Open Order",
      "url": "/orders/MEDIA-2026-0001"
    }
  ]
}
```

## Get suggested prompts

```http
GET /api/chatbot/suggested-prompts
```

Query:

```text
role
current_page
order_id
task_id
```

## Chat history

```http
GET /api/chatbot/history
```

## Save chat feedback

```http
POST /api/chatbot/feedback
```

Request:

```json
{
  "message_id": "MSG-0001",
  "feedback": "good",
  "comment": "Trả lời đúng trạng thái."
}
```

## Clear chat

```http
DELETE /api/chatbot/history
```

---

# 18. Database Tables

## ChatSessions

| Field | Type | Required |
|---|---|---:|
| session_id | string | Yes |
| user_id | string | Yes |
| started_at | datetime | Yes |
| ended_at | datetime | No |
| context_json | json | No |

## ChatMessages

| Field | Type | Required |
|---|---|---:|
| message_id | string | Yes |
| session_id | string | Yes |
| user_id | string | Yes |
| role | enum | Yes |
| content | text | Yes |
| intent | string | No |
| context_json | json | No |
| actions_json | json | No |
| created_at | datetime | Yes |

## ChatFeedback

| Field | Type | Required |
|---|---|---:|
| feedback_id | string | Yes |
| message_id | string | Yes |
| user_id | string | Yes |
| feedback | string | Yes |
| comment | text | No |
| created_at | datetime | Yes |

## ChatbotKnowledgeBase

| Field | Type | Required |
|---|---|---:|
| kb_id | string | Yes |
| title | string | Yes |
| category | string | Yes |
| content | text | Yes |
| visibility | enum | Yes |
| updated_at | datetime | Yes |

---

# 19. Integration với các module

## Order Form

```text
Chatbot hướng dẫn gửi form
Chatbot giải thích field
Chatbot tạo draft brief nếu được bật
```

## Database Orders

```text
Tra cứu order status
Tóm tắt brief
Kiểm tra missing info
Gợi ý câu hỏi bổ sung brief
```

## Production Board

```text
Tra cứu task status
Tóm tắt task
Gợi ý visual prompt
Nhắc deadline
```

## Delivery Log

```text
Tra cứu delivery status
Hướng dẫn rating
Gợi ý phản hồi client
```

## Reports

```text
Tóm tắt tình hình workload
Liệt kê task trễ hạn
Tóm tắt hiệu suất theo P.I.C
```

## AI Tools

```text
Chatbot gọi AI Tools API để tạo caption, ads copy, prompt, outline.
```

## User Management

```text
Chatbot dùng role/permission/data scope để kiểm soát dữ liệu trả về.
```

## Settings

```text
Chatbot lấy SLA, status definition, brand preset, enabled tools từ Settings.
```

---

# 20. Permission & Security

## Backend must enforce

```text
Role
Permission group
Data scope
Record ownership
AI Tools access
Chatbot enabled/disabled
```

## Không được làm

```text
Không trả internal note cho Client
Không trả order/task ngoài quyền user
Không expose API key/model secret
Không tự động thực hiện action nguy hiểm
Không tự bịa thông tin order nếu không có dữ liệu
```

## Nếu không tìm thấy dữ liệu

```text
Tôi chưa tìm thấy order/task này hoặc bạn không có quyền truy cập. Vui lòng kiểm tra lại mã hoặc liên hệ Account/Admin.
```

---

# 21. Notification / Escalation

Chatbot có thể gợi ý escalation:

```text
Liên hệ Account phụ trách
Mở ticket hỗ trợ
Gửi yêu cầu bổ sung brief
Mở Order Detail
Mở Delivery Log
```

Không tự gửi escalation trong MVP nếu chưa có confirmation.

---

# 22. Frontend Component Structure

```text
ChatbotWidget
├── ChatbotButton
├── ChatbotWindow
│   ├── ChatbotHeader
│   ├── SuggestedPrompts
│   ├── MessageThread
│   │   ├── UserMessage
│   │   └── BotMessage
│   ├── MessageActions
│   ├── ChatInput
│   └── ChatFooter
│
├── ChatbotPage
│   ├── ChatHistorySidebar
│   ├── MainChatPanel
│   └── ContextPanel
│
├── FeedbackButtons
└── ActionButtons
```

---

# 23. UI States

## Loading

```text
Bot đang trả lời...
Đang kiểm tra trạng thái order...
Đang tạo nội dung...
```

## Empty

```text
Bạn cần hỗ trợ gì trong CB Creative Flow?
```

## Error

```text
Chatbot tạm thời không phản hồi.
Không thể truy cập dữ liệu order/task.
Bạn không có quyền xem thông tin này.
```

## Success

```text
Đã tạo nội dung.
Đã tìm thấy order.
Đã copy câu trả lời.
```

---

# 24. Acceptance Criteria

## Functional

```text
User có thể mở chatbot từ floating button hoặc page riêng.
Chatbot hiển thị suggested prompts theo role/page.
Chatbot trả lời được câu hỏi quy trình.
Chatbot tra cứu được order/task theo quyền.
Chatbot không trả dữ liệu ngoài quyền user.
Chatbot tóm tắt brief/order/task.
Chatbot gọi AI Tools để tạo caption/ads/prompt nếu user có quyền.
Chatbot có action button mở Order/Task/Delivery/Reports.
Chatbot lưu chat history và feedback.
```

## Security

```text
Backend enforce permission.
Client không thấy internal note/deadline nếu không public.
Không expose API key.
Không thực hiện action nguy hiểm nếu chưa confirmation hoặc chưa có quyền.
```

## UX

```text
Chat UI rõ ràng, nhanh, có suggested prompts.
Response ngắn, có bullet/action.
Có loading/error state.
Có feedback good/bad.
Có CTA mở đúng module.
```

---

# 25. Suggested Initial Build Scope

## MVP

```text
Floating chatbot button
Basic chat window
Suggested prompts by role
Process FAQ
Order status query by Order ID
Task status query by Task ID
Brief summary from Order Detail
Generate caption via AI Tools
Permission check
Chat history basic
```

## Phase 2

```text
Inline assistant in Order Detail/Task Detail
Missing brief checker
Report summary
Save generated output to order
Escalation workflow
Feedback buttons
```

## Phase 3

```text
RAG knowledge base
Voice input
Scheduled daily summary
Proactive alerts
AI workflow recommendations
```

---

# 26. Prompt cho Dev/Claude

```text
Build the Chatbot Module for "CB Creative Flow - Media Hub by CB Centres".

Purpose:
The chatbot supports process guidance, order/task status lookup, brief assistance and basic content/creative generation.

Main users:
Client, Account, Admin, Design, Editor, Manager/Leader.

Required features:
- Floating chatbot button and dedicated chatbot page
- Suggested prompts based on user role and current page
- Process FAQ answers
- Order status lookup by Order ID
- Task status lookup by Task ID
- Brief summary and missing info support
- Content generation via AI Tools API
- Action buttons to open Order, Task, Delivery Log or Reports
- Chat history
- Feedback good/bad

Security:
Backend must check role, permission group, data scope and record ownership.
Client can only view own order public status.
Do not expose internal notes, internal deadline or PIC workload to Client.
Do not expose API keys.
Do not execute dangerous actions automatically.

Use CB brand:
Red #BA110F
Blue #191970
Font Montserrat
Clean professional SaaS chat UI.
```
