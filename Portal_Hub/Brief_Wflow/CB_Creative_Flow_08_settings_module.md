# CB Creative Flow - Media Hub by CB Centres
# Settings Module — Detailed Specification for Dev

**Module:** Settings  
**Purpose:** Cập nhật vào website portal để Admin cấu hình toàn bộ tham số vận hành của hệ thống: workflow, SLA, status, notification, brand, AI, integrations và security.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, Font Montserrat, clean SaaS dashboard.  
**Output chính:** Một module cấu hình tập trung giúp portal vận hành linh hoạt mà không cần sửa code khi thay đổi quy trình.

---

# 1. Mục đích

**Settings Module** là khu vực dành cho Admin cấu hình các tham số vận hành của portal **CB Creative Flow - Media Hub by CB Centres**.

Module này dùng để:

```text
Cấu hình workflow status
Cấu hình progress mapping
Cấu hình SLA/deadline
Cấu hình notification
Cấu hình brand UI
Cấu hình AI Tools
Cấu hình Chatbot
Cấu hình Google Drive/File Upload
Cấu hình department/branch master data
Cấu hình public client tracking
Cấu hình security/authentication
Cấu hình export/report
```

Mục tiêu là giúp hệ thống có thể thay đổi quy trình mà không cần Dev chỉnh code liên tục.

---

# 2. Người dùng chính

```text
Admin
Super Admin nếu có
```

## Admin

Admin có quyền:

```text
Xem toàn bộ settings
Cập nhật workflow
Cập nhật SLA
Cập nhật notification
Cập nhật brand settings
Cập nhật AI settings
Cập nhật integration settings
Cập nhật security settings
```

## Các role khác

Mặc định không được truy cập Settings.

---

# 3. Vị trí trong hệ thống

## Menu

```text
Admin
└── Settings
```

## Route đề xuất

```text
/settings
/settings/workflow
/settings/sla
/settings/notifications
/settings/brand
/settings/ai
/settings/integrations
/settings/security
/settings/reports
```

---

# 4. Layout tổng thể

```text
Settings Page
├── Settings Sidebar
│   ├── General Settings
│   ├── Workflow Settings
│   ├── SLA & Deadline Settings
│   ├── Notification Settings
│   ├── Brand Settings
│   ├── AI Tools Settings
│   ├── Chatbot Settings
│   ├── File & Drive Settings
│   ├── Department/Branch Settings
│   ├── Client Portal Settings
│   ├── Report/Export Settings
│   └── Security Settings
│
└── Settings Content
    ├── Setting Section Header
    ├── Setting Form
    ├── Preview/Testing Area
    ├── Save Button
    └── Activity Log
```

---

# 5. General Settings

## Mục đích

Cấu hình thông tin chung của portal.

## Fields

| Field | Type | Note |
|---|---|---|
| System Name | Text | CB Creative Flow |
| System Subtitle | Text | Media Hub by CB Centres |
| Default Language | Select | Vietnamese / English |
| Default Timezone | Select | Asia/Ho_Chi_Minh |
| Default Date Format | Select | DD/MM/YYYY |
| Default Time Format | Select | 24h |
| Support Email | Email | Email hỗ trợ |
| Support Phone | Text | SĐT hỗ trợ |
| Maintenance Mode | Toggle | Bật/tắt bảo trì |

## Default values

```text
System Name = CB Creative Flow
System Subtitle = Media Hub by CB Centres
Timezone = Asia/Ho_Chi_Minh
Date Format = DD/MM/YYYY
Time Format = 24h
```

---

# 6. Workflow Settings

## 6.1. Mục đích

Cấu hình danh sách status và transition giữa các module.

```text
Database Orders
Production Board
Delivery Log
```

---

## 6.2. Account Status Settings

Status mặc định:

```text
Chờ xác nhận
Đang kiểm tra brief
Cần bổ sung thông tin
Đã xác nhận brief
Từ chối/Hủy đơn
```

Fields cấu hình mỗi status:

| Field | Type |
|---|---|
| Status name | Text |
| Status key | Text |
| Color | Color picker |
| Description | Textarea |
| Is active | Toggle |
| Sort order | Number |
| Public status mapping | Select/Text |
| Allowed next statuses | Multi-select |

## Account Status transition mặc định

```text
Chờ xác nhận → Đang kiểm tra brief
Đang kiểm tra brief → Cần bổ sung thông tin
Cần bổ sung thông tin → Đang kiểm tra brief
Đang kiểm tra brief → Đã xác nhận brief
Any → Từ chối/Hủy đơn nếu có quyền
```

---

## 6.3. Production Status Settings

Status mặc định:

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

Fields cấu hình:

| Field | Type |
|---|---|
| Status name | Text |
| Progress value | Number |
| Color | Color picker |
| Allowed roles to set | Multi-select |
| Allowed next statuses | Multi-select |
| Is visible to client | Toggle |
| Public status mapping | Select/Text |

## Progress mapping mặc định

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

---

## 6.4. Delivery Status Settings

Status mặc định:

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

Fields cấu hình:

```text
Status name
Status key
Color
Description
Allowed roles to set
Allowed next statuses
Public status mapping
Require checklist before status
Require final link before status
Auto close eligible
```

---

# 7. SLA & Deadline Settings

## 7.1. Mục đích

Cấu hình thời gian xử lý tiêu chuẩn và cảnh báo deadline.

## 7.2. SLA by request type

| Request Type | Default SLA | Note |
|---|---|---|
| Design/POSM | 1–7 ngày làm việc | Tùy độ phức tạp |
| Digital Design | 1–3 ngày làm việc | Social/banner |
| Video Editing | 3–10 ngày làm việc | Tùy footage |
| Quay | Xác nhận lịch riêng | Cần lịch quay |
| Chụp ảnh | Xác nhận lịch riêng | Cần địa điểm |
| Ads/Post Basic | 0.5–2 ngày làm việc | Copy/caption |
| Slide/Proposal | 2–7 ngày làm việc | Tùy số slide |

## 7.3. Deadline warning settings

Fields:

```text
Due Soon threshold
Overdue threshold
Task not accepted threshold
No status update threshold
Client feedback waiting threshold
Auto close after final sent
```

Default values:

```text
Due Soon threshold = 48 giờ
Task not accepted threshold = 4 giờ
No status update threshold = 2 ngày
Client feedback waiting threshold = 3 ngày
Auto close after final sent = 3 ngày nếu không phản hồi
```

## 7.4. Working days settings

```text
Working days: Monday–Saturday
Working hours: 08:00–17:30
Exclude holidays: manual list
Allow weekend task: toggle
```

---

# 8. Notification Settings

## 8.1. Notification channels

```text
In-app notification
Email notification
Google Chat/Slack webhook nếu có
Zalo integration nếu có phase sau
```

## 8.2. Notification events

| Event | Default recipients |
|---|---|
| New order created | Admin, Account |
| Brief needs more info | Requester, Account |
| Brief confirmed | Requester, Account, Admin |
| PIC assigned | P.I.C, Account |
| Task not accepted after threshold | P.I.C, Account, Admin |
| Task due soon | P.I.C, Account |
| Task overdue | P.I.C, Account, Admin |
| Task waiting internal review | Account |
| Ready for delivery | Account |
| Preview sent | Client/Requester |
| Client feedback received | Account, P.I.C |
| Final sent | Client/Requester |
| Rating submitted | Account, Admin |
| Order completed | Requester, Account, Admin |

## 8.3. Config fields per event

```text
Event name
Enabled
Channels
Recipients by role
Recipient override
Template subject
Template body
Trigger timing
Repeat reminder
Stop condition
```

---

# 9. Brand Settings

## 9.1. Mục đích

Cấu hình brand UI của portal.

## Fields

```text
Logo
Favicon
Primary Color
Secondary Color
Accent Color
Background Color
Font Family
Button Style
Card Radius
System display name
Login page background
```

## Default values

```text
Primary Color = #BA110F
Secondary Color = #191970
Background = #F6F7FB
Font = Montserrat
Card radius = 20px
```

## Preview area

Admin nên thấy preview:

```text
Button
Badge
Card
Sidebar
Table header
Progress bar
```

---

# 10. AI Tools Settings

## 10.1. Mục đích

Cấu hình AI/API cho các tiện ích tạo nội dung.

## AI tools list

```text
Post Generator
Ads Copy Generator
Caption Builder
Brief Optimizer
Visual Prompt Generator
Slide Outline Generator
Campaign Idea Generator
Hashtag/CTA Generator
```

## Fields

```text
AI provider
API key
Default model
Temperature
Max tokens
Enable/disable từng tool
Allowed roles
Prompt template
Brand preset
Usage limit per user/day
Log AI output
```

## Brand preset mặc định

```text
Brand: CB Centres
Tone: professional, clean, modern, education brand
Primary color: #BA110F
Secondary color: #191970
Audience: Vietnamese students, parents, teachers, partners
Language: Vietnamese
```

---

# 11. Chatbot Settings

## Mục đích

Cấu hình chatbot hỗ trợ quy trình và tra cứu order.

## Fields

```text
Enable chatbot
Allowed roles
Knowledge base source
Can query order status
Can create draft response
Can generate copy
Can access internal notes
Escalation contact
Default greeting
Fallback message
```

## Security rule

```text
Chatbot phải kiểm tra permission trước khi trả lời thông tin order/task.
Client chỉ được hỏi về order của chính mình.
```

## Default greeting

```text
Xin chào! Tôi là trợ lý CB Creative Flow. Bạn cần hỗ trợ gửi brief, kiểm tra trạng thái order hay tạo nội dung media cơ bản?
```

---

# 12. File & Drive Settings

## Mục đích

Cấu hình upload file và Google Drive link.

## Fields

```text
Max file size
Allowed file types
Default storage provider
Google Drive root folder
Auto create folder per order
Folder naming convention
Require Drive permission check
Allow external links
```

## Default allowed file types

```text
DOC
DOCX
PDF
PPT
PPTX
XLS
XLSX
JPG
JPEG
PNG
SVG
AI
PSD
EPS
MP4
MOV
ZIP
RAR
```

## Folder naming convention

```text
{order_id}_{project_name}_{requester}
```

Example:

```text
MEDIA-2026-0001_Summer-Campaign_CB-Mekong
```

---

# 13. Department / Branch Settings

## Mục đích

Quản lý danh sách chi nhánh/bộ phận dùng trong Order Form, User Management và Reports.

## Fields

```text
Department ID
Department Name
Department Type
Parent Department
Default Account PIC
Status
```

## Department types

```text
HO
Branch
Academic
Sales
Marketing
Partner
Other
```

## Features

```text
Add department
Edit department
Deactivate department
Assign default Account
Import department list
Export department list
```

---

# 14. Client Portal Settings

## Mục đích

Cấu hình dữ liệu public mà Client/Requester được nhìn thấy.

## Public status mapping

| Internal Status | Public Status |
|---|---|
| Chờ xác nhận | Đã nhận yêu cầu |
| Đang kiểm tra brief | Đang kiểm tra thông tin |
| Cần bổ sung thông tin | Cần bổ sung brief |
| Đã xác nhận brief | Đã tiếp nhận |
| Đã phân công | Đang xử lý |
| Đang thực hiện | Đang sản xuất |
| Chờ duyệt nội bộ | Đang kiểm tra nội bộ |
| Chờ client phản hồi | Chờ phản hồi của bạn |
| Sẵn sàng bàn giao | Sắp bàn giao |
| Đã bàn giao | Đã bàn giao |
| Hoàn thành | Hoàn thành |
| Hủy | Đã hủy |

## Client visible fields

```text
Order ID
Project/Campaign/Event
Submitted Date
Requested Deadline
Public Status
Preview Link
Final Link
Feedback form
Rating form
```

## Client hidden fields

```text
Internal Deadline
Internal Note
Production PIC workload
Account internal comment
Activity log nội bộ
Admin settings
Reports nội bộ
```

---

# 15. Report / Export Settings

## Mục đích

Cấu hình export và report mặc định.

## Fields

```text
Default report period
Enable PDF export
Enable Excel export
Include raw data in export
Company logo in export
Report footer text
Scheduled report email
Default recipients
```

## Export sheets mặc định

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

# 16. Security Settings

## Authentication options

```text
Email/password
Google Workspace SSO
Magic link
Invite-based activation
```

Khuyến nghị:

```text
Google Workspace SSO + invite-based fallback
```

## Fields

```text
Enable SSO
Allowed email domains
Password minimum length
Require password reset on first login
Invite token expiry
Session timeout
Two-factor authentication
Login attempt limit
Audit log retention
```

## Default values

```text
Allowed domain = cbcentres.com
Password minimum length = 8
Invite token expiry = 7 days
Session timeout = 8 hours
Login attempt limit = 5
Audit log retention = 365 days
```

---

# 17. Settings Activity Log

Mọi thay đổi settings cần ghi log.

## Log fields

```text
log_id
setting_category
setting_key
old_value
new_value
changed_by
changed_at
comment
```

## Action types

```text
setting_updated
workflow_status_created
workflow_status_updated
sla_updated
notification_template_updated
brand_updated
ai_setting_updated
security_setting_updated
department_created
department_updated
```

---

# 18. API Requirements

## Get all settings

```http
GET /api/settings
```

## Get settings by category

```http
GET /api/settings/{category}
```

Categories:

```text
general
workflow
sla
notifications
brand
ai
chatbot
files
departments
client_portal
reports
security
```

## Update settings

```http
PUT /api/settings/{category}
```

## Update workflow status

```http
PUT /api/settings/workflow/status
```

## Update SLA

```http
PUT /api/settings/sla
```

## Test notification

```http
POST /api/settings/notifications/test
```

## Test AI connection

```http
POST /api/settings/ai/test
```

## Test Drive connection

```http
POST /api/settings/files/test-drive
```

## Get settings activity log

```http
GET /api/settings/activity-log
```

---

# 19. Database Tables

## Settings table

| Field | Type | Required | Note |
|---|---|---:|---|
| setting_id | string | Yes | Primary key |
| category | string | Yes | general/workflow/sla... |
| key | string | Yes | setting key |
| value_json | json | Yes | value |
| is_active | boolean | Yes | active |
| updated_by | string | No | user_id |
| updated_at | datetime | Yes | timestamp |

## WorkflowStatuses table

| Field | Type | Required |
|---|---|---:|
| status_id | string | Yes |
| module | string | Yes |
| status_name | string | Yes |
| status_key | string | Yes |
| color | string | No |
| progress_value | number | No |
| sort_order | number | Yes |
| allowed_roles | json | No |
| allowed_next_statuses | json | No |
| public_mapping | string | No |
| is_active | boolean | Yes |

## NotificationTemplates table

| Field | Type | Required |
|---|---|---:|
| template_id | string | Yes |
| event_key | string | Yes |
| enabled | boolean | Yes |
| channels | json | Yes |
| recipients | json | Yes |
| subject | string | No |
| body | text | Yes |
| repeat_rule | json | No |
| stop_condition | json | No |

---

# 20. Frontend Component Structure

```text
SettingsPage
├── SettingsSidebar
├── SettingsHeader
├── GeneralSettingsPanel
├── WorkflowSettingsPanel
│   ├── AccountStatusSettings
│   ├── ProductionStatusSettings
│   └── DeliveryStatusSettings
├── SLASettingsPanel
├── NotificationSettingsPanel
├── BrandSettingsPanel
├── AIToolsSettingsPanel
├── ChatbotSettingsPanel
├── FileDriveSettingsPanel
├── DepartmentSettingsPanel
├── ClientPortalSettingsPanel
├── ReportExportSettingsPanel
├── SecuritySettingsPanel
└── SettingsActivityLog
```

---

# 21. UI States

## Loading

```text
Loading settings...
Saving settings...
Testing connection...
```

## Empty

```text
Chưa có cấu hình tùy chỉnh.
Chưa có template notification.
Chưa có department nào.
```

## Error

```text
Không thể tải cấu hình.
Không thể lưu cấu hình.
API key không hợp lệ.
Không thể kết nối Google Drive.
```

## Success

```text
Đã lưu cấu hình.
Kết nối thành công.
Đã cập nhật workflow status.
Đã gửi notification test.
```

---

# 22. Validation Rules

## General

```text
System name required
Timezone required
Date format required
```

## Workflow

```text
status_name required
status_key unique per module
progress_value must be 0–100
allowed_next_statuses must exist
cannot delete status currently used by orders/tasks/delivery
```

## SLA

```text
SLA value must be positive
Due soon threshold must be less than overdue threshold
Auto close days must be >= 1
```

## Brand

```text
Primary color must be valid HEX
Secondary color must be valid HEX
Logo file must be valid image
```

## AI

```text
API key required if AI enabled
Model required if AI enabled
Usage limit must be positive
```

## Security

```text
Password minimum length >= 8
Invite token expiry >= 1 day
Session timeout >= 30 minutes
```

---

# 23. Acceptance Criteria

## Functional

```text
Admin có thể xem và chỉnh Settings.
Settings chia theo category rõ ràng.
Workflow status có thể cấu hình.
Progress mapping có thể cấu hình.
SLA/deadline warning có thể cấu hình.
Notification templates có thể cấu hình.
Brand color/logo/font có thể cấu hình.
AI Tools có thể bật/tắt và cấu hình API.
Chatbot có thể bật/tắt và cấu hình quyền.
File upload/Drive settings có thể cấu hình.
Department/Branch list có thể quản lý.
Client public mapping có thể cấu hình.
Report/export settings có thể cấu hình.
Security settings có thể cấu hình.
Mọi thay đổi Settings đều ghi Activity Log.
```

## Security

```text
Chỉ Admin được truy cập Settings.
Backend enforce quyền configure.
Không trả API key plaintext ra frontend sau khi lưu.
Mọi thay đổi security/settings quan trọng cần log.
Không cho xóa status đang được dữ liệu sử dụng.
```

## UX

```text
Giao diện chia sidebar category rõ ràng.
Có save/cancel rõ ràng.
Có preview cho Brand Settings.
Có test connection cho AI/Drive/Notification.
Có loading/empty/error/success state.
```

---

# 24. Suggested Initial Build Scope

## MVP

```text
General Settings
Workflow Settings basic
Progress mapping
SLA Settings
Notification Settings basic
Brand Settings
Department Settings
Settings Activity Log basic
```

## Phase 2

```text
AI Tools Settings
Chatbot Settings
File & Drive Settings
Client Portal Settings
Report Export Settings
Security Settings
Test connection
```

## Phase 3

```text
Advanced workflow builder
Custom automation rules
Scheduled reports
Advanced SSO
Audit dashboard
Feature flags
```

---

# 25. Prompt cho Dev/Claude

```text
Build the Settings Module for "CB Creative Flow - Media Hub by CB Centres".

Purpose:
Settings Module allows Admin to configure the portal without code changes.

Required categories:
- General Settings
- Workflow Settings
- SLA & Deadline Settings
- Notification Settings
- Brand Settings
- AI Tools Settings
- Chatbot Settings
- File & Drive Settings
- Department/Branch Settings
- Client Portal Settings
- Report/Export Settings
- Security Settings

Workflow Settings must include:
- Account Status
- Production Status
- Delivery Status
- Progress mapping
- Allowed transitions
- Public status mapping

Default brand:
Red #BA110F
Blue #191970
Font Montserrat

Default timezone:
Asia/Ho_Chi_Minh

Settings must include:
- Save/cancel
- Test notification
- Test AI connection
- Test Drive connection
- Activity log for all changes

Security:
Only Admin can access Settings.
Backend must enforce configure permission.
API keys must not be returned in plaintext after saving.
Cannot delete workflow status already used by data.

Use clean professional SaaS UI.
```
