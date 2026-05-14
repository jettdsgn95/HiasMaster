# CB Creative Flow - Media Hub by CB Centres
# User Management Module — Detailed Specification for Dev

**Module:** User Management  
**Purpose:** Cập nhật vào website portal để Admin quản lý tài khoản, role, tag, permission, trạng thái người dùng và phạm vi dữ liệu được phép truy cập.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, Font Montserrat, clean SaaS dashboard.  
**Output chính:** Quản lý user và phân quyền cho toàn bộ hệ thống CB Creative Flow.

---

# 1. Mục đích

**User Management Module** là module quản trị tài khoản và phân quyền của portal **CB Creative Flow - Media Hub by CB Centres**.

Module này dùng để:

```text
Tạo tài khoản người dùng
Cập nhật thông tin người dùng
Gán role
Gán tag chuyên môn
Gán chi nhánh/bộ phận
Gán permission group
Bật/tắt tài khoản
Giới hạn phạm vi dữ liệu user được xem
Quản lý quyền theo module
Kiểm soát ai được xem, tạo, sửa, duyệt, bàn giao, báo cáo và cấu hình hệ thống
```

---

# 2. Người dùng chính

```text
Admin
Manager/Leader nếu được cấp quyền xem team
```

## 2.1. Admin

Admin có quyền:

```text
Xem toàn bộ user
Tạo user
Sửa user
Khóa/mở khóa user
Gán role/tag
Gán permission group
Gán data scope
Quản lý department/branch
Reset password hoặc gửi invite
Xem activity log thay đổi quyền
```

## 2.2. Manager/Leader

Manager/Leader có thể được cấp quyền:

```text
Xem danh sách user thuộc team
Xem workload/assigned summary của team
Không được chỉnh role/permission nếu không được Admin cấp quyền
```

## 2.3. Account / Design / Editor / Client

Các role này mặc định **không được quản lý user**.

---

# 3. Vị trí trong hệ thống

## Menu

```text
Admin
└── User Management
```

## Route đề xuất

```text
/admin/users
/admin/users/:user_id
/admin/permission-groups
/admin/departments
```

---

# 4. Role System

## 4.1. Role chính

| Role | Mô tả |
|---|---|
| Admin | Quyền cao nhất, quản trị toàn bộ hệ thống |
| Manager/Leader | Xem dashboard/report team, theo dõi vận hành |
| Account | Tiếp nhận brief, xác nhận order, điều phối, bàn giao |
| Staff | Nhân sự production như Design/Editor/Photo/Video |
| Client | Người gửi order và theo dõi order của mình |

## 4.2. Tag chuyên môn

Tag dùng để phân loại vị trí chuyên môn.

```text
Design
Editor
Account
Photo
Video
Shooting
Hybrid
Manager
Client
Branch
Academic
Sales
Marketing
Other
```

## 4.3. Role vs Tag

`role` xác định cấp quyền tổng.  
`tag` xác định chuyên môn/công việc.

Ví dụ:

| User | Role | Tag |
|---|---|---|
| Admin hệ thống | Admin | Manager |
| Hậu | Account | Account |
| Duy | Staff | Design |
| Vinh | Staff | Editor |
| Chi nhánh Mekong | Client | Branch |
| Academic HO | Client | Academic |

---

# 5. Permission Group

## 5.1. Permission group đề xuất

| Permission Group | Mục đích |
|---|---|
| Full Access | Admin toàn quyền |
| Manager View | Xem dashboard/report toàn team, không cấu hình hệ thống |
| Order Management | Account quản lý order và brief |
| Production Only | Design/Editor xử lý task được giao |
| Delivery Only | Account phụ trách bàn giao |
| Report Viewer | Chỉ xem dashboard/report |
| Client Order Only | Client tạo và theo dõi order của mình |
| AI Tools Access | Được dùng AI Tools |
| Custom | Quyền tùy chỉnh theo từng user |

## 5.2. Permission matrix theo module

| Module | Admin | Manager | Account | Design/Editor | Client |
|---|---:|---:|---:|---:|---:|
| Master Dashboard | Full | Team View | Assigned View | My Tasks Summary | No |
| Order Form | Full | View | Create/Edit | Create if allowed | Create |
| Database Orders | Full | Team View | Assigned/Edit | No | Own Public View |
| Production Board | Full | Team View | Assigned View/Edit | My Tasks Edit | No |
| Delivery Log | Full | Team View | Assigned/Edit | No | Own Delivery Public |
| Reports | Full | Team View | Assigned View | My Performance if allowed | No |
| AI Tools | Full | Yes | Yes | Yes | Optional |
| Chatbot | Full | Yes | Yes | Yes | Yes |
| User Management | Full | View Team optional | No | No | No |
| Settings | Full | No | No | No | No |

---

# 6. Data Scope

## 6.1. Data scope options

| Scope | Ý nghĩa |
|---|---|
| All Data | Xem toàn bộ dữ liệu |
| Team Data | Xem dữ liệu của team/phòng ban được gán |
| Department Data | Xem dữ liệu thuộc department/branch |
| Assigned Data | Xem order/task được gán cho mình |
| Own Created Data | Xem order do mình tạo |
| Client Own Data | Client chỉ xem order của mình |
| Custom Scope | Cấu hình riêng |

## 6.2. Data scope rules

```text
Admin → All Data
Manager/Leader → Team Data hoặc All Data nếu được cấp quyền
Account → Assigned Data hoặc Department Data
Design/Editor → Assigned Data
Client → Client Own Data
```

---

# 7. Main User Management Page

## 7.1. Layout tổng

```text
User Management Page
├── Header Area
│   ├── Page title
│   ├── Subtitle
│   ├── Search
│   ├── Add User button
│   └── Export button
│
├── User Summary Cards
│   ├── Total Users
│   ├── Active Users
│   ├── Admins
│   ├── Accounts
│   ├── Production Staff
│   ├── Clients
│   └── Inactive Users
│
├── Filter Bar
│   ├── Role
│   ├── Tag
│   ├── Department
│   ├── Permission Group
│   └── Status
│
├── User Table
└── User Detail / Create / Edit Modal
```

## 7.2. Header content

```text
Page title: User Management
Subtitle: Quản lý tài khoản, vai trò, tag, phạm vi dữ liệu và quyền truy cập
Search placeholder: Tìm theo tên, email, chi nhánh, role...
CTA: + Add User
CTA: Export
```

---

# 8. User Summary Cards

| Card | Ý nghĩa | Click behavior |
|---|---|---|
| Total Users | Tổng số tài khoản | Reset filter |
| Active Users | Tài khoản đang hoạt động | Filter status = Active |
| Admins | Số tài khoản admin | Filter role = Admin |
| Accounts | Số Account | Filter tag = Account |
| Production Staff | Số Design/Editor/Photo/Video | Filter role = Staff |
| Clients | Số tài khoản Client | Filter role = Client |
| Inactive Users | Tài khoản đã khóa/tạm ngưng | Filter status = Inactive |

---

# 9. User Table

## 9.1. Columns

```text
Avatar
Full Name
Email
Phone
Role
Tag
Department/Branch
Permission Group
Data Scope
Last Login
Status
Actions
```

## 9.2. Table actions

```text
View Detail
Edit User
Change Role
Change Permission
Reset Password / Send Invite
Deactivate
Reactivate
Archive
```

## 9.3. Filters

```text
Search by name/email
Role
Tag
Department
Permission Group
Data Scope
Status
Created date
Last login
```

---

# 10. Create User Flow

## 10.1. Flow

```text
Admin click + Add User
→ Open Create User Modal/Page
→ Fill user info
→ Select role
→ Select tag
→ Select department
→ Select permission group
→ Select data scope
→ Review permissions
→ Create user
→ Send invite email nếu được chọn
→ Create ActivityLog
```

## 10.2. Required fields

| Field | Type | Required | Data key |
|---|---|---:|---|
| Full Name | Text | Yes | full_name |
| Email | Email | Yes | email |
| Phone | Text | No | phone |
| Role | Select | Yes | role |
| Tag | Select | Yes | tag |
| Department/Branch | Select | Yes | department_id |
| Permission Group | Select | Yes | permission_group_id |
| Data Scope | Select | Yes | data_scope |
| Status | Select | Yes | status |
| Send Invite Email | Checkbox | No | send_invite |

## 10.3. Default status

```text
status = Pending Invite
```

Sau khi user đăng nhập lần đầu:

```text
status = Active
```

---

# 11. Edit User Flow

## 11.1. Flow

```text
Admin mở user detail
→ Click Edit
→ Cập nhật thông tin
→ Nếu đổi role/permission thì show confirmation
→ Save
→ Create ActivityLog
→ Apply permission immediately
```

## 11.2. Field có thể sửa

```text
Full Name
Phone
Role
Tag
Department
Permission Group
Data Scope
Allowed Departments
Allowed Teams
Status
```

## 11.3. Field hạn chế sửa

```text
Email đăng nhập
User ID
Created At
```

Nếu cần đổi email:

```text
Require Admin confirmation
Check duplicate email
Re-send invite/verification
```

---

# 12. User Detail Page / Drawer

## Layout

```text
User Detail
├── User Profile Summary
├── Role & Permission
├── Data Scope
├── Module Access
├── Assigned Orders/Tasks Summary
├── Recent Activity
└── Security/Login Info
```

## User Profile Summary

```text
Avatar
Full Name
Email
Phone
Role
Tag
Department
Status
Created At
Last Login
```

## Role & Permission

```text
Role
Tag
Permission Group
Data Scope
Allowed Departments
Allowed Teams
Custom Permission Overrides
```

## Assigned Work Summary

Nếu user là Account:

```text
Assigned Orders
Orders Waiting Brief Check
Orders In Delivery
Average Rating
```

Nếu user là Design/Editor:

```text
Assigned Tasks
Open Tasks
Overdue Tasks
Completed Tasks
Average Progress
```

Nếu user là Client:

```text
Created Orders
Open Orders
Completed Orders
Average Rating Given
```

---

# 13. User Status System

| Status | Ý nghĩa |
|---|---|
| Pending Invite | Đã tạo user nhưng chưa kích hoạt |
| Active | Đang hoạt động |
| Inactive | Tạm ngưng |
| Suspended | Khóa do vi phạm/bảo mật |
| Archived | Lưu trữ, không còn dùng |

## Status behavior

```text
Pending Invite:
- Không đăng nhập được nếu chưa accept invite.
- Có thể resend invite.

Active:
- Đăng nhập và sử dụng theo quyền.

Inactive:
- Không đăng nhập được.
- Không hiển thị trong dropdown assign mặc định.
- Dữ liệu cũ vẫn giữ.

Suspended:
- Không đăng nhập được.
- Cần Admin mở khóa.
- Ghi log lý do khóa.

Archived:
- Không đăng nhập.
- Không xóa dữ liệu lịch sử.
- Chỉ Admin xem được.
```

---

# 14. Permission Details

## 14.1. Permission categories

```text
dashboard
orders
order_form
production
delivery
reports
ai_tools
chatbot
users
settings
files
comments
activity_log
```

## 14.2. Permission actions

```text
view
create
edit
delete
assign
approve
deliver
export
configure
use_ai
comment
upload
download
```

## 14.3. Permission object example

```json
{
  "orders": {
    "view": true,
    "create": true,
    "edit": true,
    "delete": false,
    "assign": true,
    "export": true
  },
  "production": {
    "view": true,
    "edit": true,
    "approve": true,
    "upload": true
  },
  "delivery": {
    "view": true,
    "deliver": true,
    "edit": true
  },
  "reports": {
    "view": true,
    "export": false
  },
  "users": {
    "view": false,
    "create": false,
    "edit": false
  }
}
```

---

# 15. Default Permission Templates

## Admin — Full Access

```text
Can view/create/edit/delete all records
Can manage users
Can manage settings
Can view/export all reports
Can assign PIC
Can close/reopen orders
Can use all AI tools
```

## Manager View

```text
Can view dashboard and reports
Can view all team orders/tasks
Can comment
Cannot edit system settings
Cannot manage users unless granted
Cannot delete records
```

## Account — Order Management

```text
Can create orders
Can view assigned orders
Can check brief
Can request more info
Can confirm brief
Can assign PIC if allowed
Can set internal deadline if allowed
Can update delivery status
Can send preview/final
Can close assigned orders
```

## Design/Editor — Production Only

```text
Can view assigned tasks
Can update task status
Can upload preview/final
Can comment
Can view task files
Cannot view all orders
Cannot assign PIC
Cannot send final to client
Cannot close order
```

## Client — Client Order Only

```text
Can create order
Can view own orders
Can comment/feedback on own orders
Can download final link
Can rate satisfaction
Cannot view internal note
Cannot view internal deadline
Cannot view PIC workload
Cannot view dashboard/report
```

---

# 16. Assignment Rules

## P.I.C dropdown rule

Khi Account/Admin gán P.I.C:

```text
Chỉ hiển thị user:
status = Active
role = Staff hoặc Account nếu task account-related
tag phù hợp với task_type
```

Ví dụ:

```text
Task type = Design/POSM
→ Show users tag = Design hoặc Hybrid

Task type = Video Editing
→ Show users tag = Editor hoặc Hybrid

Task type = Shooting/Photo
→ Show users tag = Photo/Video/Shooting/Hybrid
```

## Inactive user handling

Nếu task đang được gán cho user bị Inactive:

```text
Task vẫn giữ lịch sử assigned_to
Hiển thị warning: P.I.C hiện không hoạt động
Admin/Account cần reassign task
```

---

# 17. Department / Branch Management

## Department fields

```text
department_id
department_name
department_type
parent_department_id
status
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

## User may belong to multiple departments

```text
primary_department
allowed_departments[]
```

Ví dụ:

```text
primary_department = Marketing HO
allowed_departments = [CB Mekong, CB Hưng Phú, CB Cần Thơ]
```

---

# 18. Client Account Logic

## Client types

```text
Branch Client
Department Client
Partner Client
Individual Client
```

## Client fields

```text
client_type
organization_name
branch_name
contact_person
contact_email
contact_phone
allowed_order_types
```

## Client visibility

Client chỉ được thấy:

```text
Order ID
Project/Campaign/Event
Submitted Date
Requested Deadline
Public Status
Preview Link nếu có
Final Link nếu đã bàn giao
Feedback/Rating
```

Client không thấy:

```text
Internal Deadline
Internal Note
Production PIC workload
Account internal comment
Activity log nội bộ
Dashboard nội bộ
```

---

# 19. Security Requirements

## Authentication options

```text
Email/password
Google Workspace SSO
Magic link
Invite-based account activation
```

Khuyến nghị:

```text
Google Workspace SSO + invite-based fallback
```

## Authorization

Backend phải enforce permission.

```text
Every API must check:
- user role
- permission group
- data scope
- record ownership
```

## Password / Invite nếu dùng email/password

```text
Password minimum 8 chars
Require reset password on first login
Invite token expires after 7 days
Allow resend invite
```

---

# 20. Activity Log

## Log fields

```text
log_id
target_user_id
actor_user_id
action_type
old_value
new_value
comment
created_at
```

## Action types

```text
user_created
user_updated
role_changed
permission_changed
data_scope_changed
user_deactivated
user_reactivated
invite_sent
invite_resent
password_reset_sent
```

---

# 21. Database Tables

## Users table

| Field | Type | Required | Note |
|---|---|---:|---|
| user_id | string | Yes | Primary key |
| full_name | string | Yes | Họ tên |
| email | string | Yes | Unique |
| phone | string | No | SĐT |
| avatar_url | string | No | Avatar |
| role | enum | Yes | Admin/Manager/Account/Staff/Client |
| tag | enum | Yes | Design/Editor/Account/Client... |
| department_id | string | Yes | Primary department |
| permission_group_id | string | Yes | FK |
| data_scope | enum | Yes | All/Team/Department/Assigned/Own/Custom |
| status | enum | Yes | Pending/Active/Inactive/Suspended/Archived |
| last_login_at | datetime | No | Lần đăng nhập cuối |
| created_at | datetime | Yes | Ngày tạo |
| updated_at | datetime | Yes | Ngày cập nhật |
| created_by | string | No | Admin tạo |

## PermissionGroups table

| Field | Type | Required | Note |
|---|---|---:|---|
| permission_group_id | string | Yes | Primary key |
| name | string | Yes | Full Access, Production Only... |
| description | text | No | Mô tả |
| permissions_json | json | Yes | Permission object |
| is_system_default | boolean | Yes | Có phải mặc định không |
| created_at | datetime | Yes | Ngày tạo |
| updated_at | datetime | Yes | Ngày cập nhật |

## UserAllowedDepartments table

| Field | Type | Required |
|---|---|---:|
| id | string | Yes |
| user_id | string | Yes |
| department_id | string | Yes |
| created_at | datetime | Yes |

## Departments table

| Field | Type | Required |
|---|---|---:|
| department_id | string | Yes |
| department_name | string | Yes |
| department_type | enum | Yes |
| parent_department_id | string | No |
| status | enum | Yes |
| created_at | datetime | Yes |

---

# 22. API Requirements

## List users

```http
GET /api/users
```

Query params:

```text
search
role
tag
department_id
permission_group_id
status
page
limit
sort
```

## Get user detail

```http
GET /api/users/{user_id}
```

## Create user

```http
POST /api/users
```

Request body:

```json
{
  "full_name": "Nguyễn Văn A",
  "email": "a@cbcentres.com",
  "phone": "0900000000",
  "role": "Staff",
  "tag": "Design",
  "department_id": "DEPT-MEDIA-HO",
  "permission_group_id": "PERM-PRODUCTION-ONLY",
  "data_scope": "Assigned Data",
  "allowed_departments": [],
  "send_invite": true
}
```

## Update user

```http
PUT /api/users/{user_id}
```

## Change user status

```http
PATCH /api/users/{user_id}/status
```

## Resend invite

```http
POST /api/users/{user_id}/resend-invite
```

## Reset password

```http
POST /api/users/{user_id}/reset-password
```

## Permission groups

```http
GET /api/permission-groups
POST /api/permission-groups
PUT /api/permission-groups/{permission_group_id}
DELETE /api/permission-groups/{permission_group_id}
```

## Departments

```http
GET /api/departments
POST /api/departments
PUT /api/departments/{department_id}
```

---

# 23. Frontend Component Structure

```text
UserManagementPage
├── UserManagementHeader
│   ├── SearchInput
│   ├── AddUserButton
│   └── ExportButton
│
├── UserSummaryCards
│   └── UserSummaryCard
│
├── UserFilterBar
│   ├── RoleFilter
│   ├── TagFilter
│   ├── DepartmentFilter
│   ├── PermissionGroupFilter
│   └── StatusFilter
│
├── UserTable
│   ├── UserTableRow
│   └── UserActionsMenu
│
├── UserCreateModal
├── UserEditModal
├── UserDetailDrawer
└── PermissionGroupManager
```

---

# 24. UI States

```text
Loading users...
Loading permission groups...
Saving user...
Sending invite...
```

```text
Chưa có user nào phù hợp với bộ lọc.
Chưa có tài khoản Client nào.
Chưa có permission group tùy chỉnh.
```

```text
Không thể tải danh sách user.
Không thể tạo user. Email có thể đã tồn tại.
Không thể cập nhật quyền. Vui lòng thử lại.
```

```text
Đã tạo user thành công.
Đã cập nhật quyền thành công.
Đã gửi lại email mời.
Đã khóa tài khoản.
```

---

# 25. Validation Rules

```text
full_name required
email required
email must be valid
email must be unique
role required
tag required
department_id required
permission_group_id required
data_scope required
status required
```

```text
If role = Admin → permission_group should be Full Access
If role = Staff → data_scope should not be All Data by default
If role = Client → permission_group should be Client Order Only
If permission_group = Custom → permissions_json required
```

```text
If user has open tasks:
→ show warning
→ require reassign or confirmation

If user is only Admin:
→ block deactivate
```

---

# 26. Acceptance Criteria

## Functional

```text
Admin có thể xem danh sách user.
Admin có thể tìm kiếm và filter user.
Admin có thể tạo user mới.
Hệ thống kiểm tra email unique.
Admin có thể gán role, tag, permission group, department, data scope.
Admin có thể sửa user.
Admin có thể khóa/mở khóa user.
User inactive không đăng nhập được.
User inactive không xuất hiện trong dropdown assign mặc định.
Permission áp dụng đúng trong các module khác.
Mọi thay đổi quan trọng được ghi Activity Log.
```

## Security

```text
Backend enforce permission.
Client không truy cập được dữ liệu nội bộ.
Design/Editor không xem được task không được giao.
Account không xem được toàn hệ thống nếu không có quyền.
Không thể deactivate admin duy nhất.
Không thể tạo trùng email.
```

## UX

```text
Giao diện đúng brand CB.
Có loading/empty/error/success state.
User table dễ lọc, dễ tìm.
Create/Edit user flow rõ ràng.
Có confirmation khi đổi role/permission/status.
```

---

# 27. Suggested Initial Build Scope

## MVP

```text
User list
Search/filter
Create user
Edit user
Role/tag/department
Permission group basic
Status Active/Inactive
Data scope basic
Activity log basic
```

## Phase 2

```text
Invite email
Reset password
Permission group manager
Allowed departments
User detail drawer
Assigned work summary
Advanced audit log
```

## Phase 3

```text
Google Workspace SSO
Custom permission builder
Team hierarchy
Bulk import users
Bulk update permission
Security monitoring
```

---

# 28. Prompt cho Dev/Claude

```text
Build the User Management Module for "CB Creative Flow - Media Hub by CB Centres".

The module must allow Admin to manage users, roles, tags, departments, permission groups, data scopes and account statuses.

Required features:
- User list with search and filters
- User summary cards
- Create user modal/page
- Edit user modal/page
- User detail drawer
- Role and tag assignment
- Permission group assignment
- Data scope assignment
- Active/Inactive/Pending/Suspended status
- Activity log for permission and status changes
- Prevent duplicate email
- Prevent deactivating the only Admin
- Inactive users must not appear in assign dropdown by default

Roles:
Admin, Manager/Leader, Account, Staff, Client

Tags:
Design, Editor, Account, Photo, Video, Shooting, Hybrid, Manager, Client, Branch, Academic, Sales, Marketing, Other

Permission groups:
Full Access, Manager View, Order Management, Production Only, Delivery Only, Report Viewer, Client Order Only, AI Tools Access, Custom

Data scopes:
All Data, Team Data, Department Data, Assigned Data, Own Created Data, Client Own Data, Custom Scope

Use brand:
Red #BA110F
Blue #191970
Font Montserrat
Clean professional SaaS UI

Backend must enforce permission and data scope, not only frontend.
```
