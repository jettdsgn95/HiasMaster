# CB Creative Flow - Media Hub by CB Centres
# 02. Order Form Module — Detailed Specification for Dev

**Module:** Order Form  
**Purpose:** Cập nhật vào website portal để Client/Chi nhánh/Bộ phận/Account có thể gửi yêu cầu thiết kế, video, quay, chụp, post/ads cơ bản vào hệ thống.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, clean SaaS dashboard.  
**Output chính:** Tạo `Order ID` và ghi dữ liệu vào `Database Orders`.

---

# 1. Vai trò của Order Form Module

**Order Form Module** là điểm đầu vào chính của toàn bộ portal **CB Creative Flow - Media Hub by CB Centres**.

Module này dùng để:

1. Tiếp nhận yêu cầu thiết kế, video, quay, chụp, post/ads cơ bản.
2. Chuẩn hóa brief đầu vào để Account/Media dễ xử lý.
3. Thu thập đầy đủ thông tin requester, mục tiêu, hạng mục, nội dung, tài nguyên, deadline.
4. Tạo `Order ID` tự động.
5. Đưa dữ liệu vào `Database Orders`.
6. Kích hoạt thông báo cho Account/Admin.
7. Làm cơ sở để Account kiểm tra brief và chuyển tiếp sang Production Board.

---

# 2. Người dùng chính

| Role | Mục đích sử dụng |
|---|---|
| Client | Gửi order, theo dõi order của mình |
| Chi nhánh/Bộ phận | Gửi yêu cầu thiết kế/media nội bộ |
| Account | Tạo order thay client/chi nhánh khi cần |
| Admin | Tạo hoặc kiểm tra order |
| Design/Editor | Có thể tạo request nội bộ nếu được cấp quyền |

---

# 3. Quyền truy cập Order Form

| Role | Quyền |
|---|---|
| Admin | Tạo order, xem tất cả order |
| Account | Tạo order, tạo thay client, xem order phụ trách |
| Design/Editor | Tạo order nếu được cấp quyền |
| Client | Tạo order và xem order của chính mình |

## Visibility rule

```text
Client chỉ thấy form và danh sách order của chính mình.
Account có thể chọn requester/client khi tạo order thay.
Admin có thể chọn bất kỳ requester, branch, account hoặc PIC.
Design/Editor mặc định chỉ tạo request nội bộ nếu được bật quyền.
```

---

# 4. Route đề xuất

```text
/order-form
/orders/new
/orders/create
```

Nếu dùng nested route:

```text
/app/orders/new
```

---

# 5. Layout tổng thể của Order Form

## 5.1. Cấu trúc page

```text
Order Form Page
├── Header Area
│   ├── Page title
│   ├── Subtitle
│   ├── Form guide
│   └── Save Draft / Submit button
│
├── Stepper / Section Navigation
│   ├── 01. Người gửi
│   ├── 02. Brief
│   ├── 03. Hạng mục
│   ├── 04. Tài nguyên
│   ├── 05. Deadline
│   └── 06. Xác nhận
│
├── Form Body
│   ├── Section A — Requester Information
│   ├── Section B — Project/Brief Information
│   ├── Section C — Request Type & Deliverables
│   ├── Section D — Content & Creative Direction
│   ├── Section E — Assets & File Upload
│   ├── Section F — Deadline & Priority
│   └── Section G — Responsibility Confirmation
│
└── Submit Area
    ├── Save Draft
    ├── Preview Brief
    └── Submit Request
```

## 5.2. UI suggestion

- Form dạng card trắng trên background xám nhạt.
- Chia section rõ ràng, có số thứ tự.
- Field bắt buộc có dấu `*`.
- Có progress stepper để user biết đang nhập tới đâu.
- Có sticky submit bar ở cuối hoặc bên phải.
- Có sidebar hướng dẫn brief tốt.
- Có autosave draft nếu user đã đăng nhập.

---

# 6. Header Area

## 6.1. Nội dung

| Thành phần | Nội dung |
|---|---|
| Page title | Phiếu yêu cầu Thiết kế & Media |
| Subtitle | Gửi yêu cầu thiết kế, video, quay, chụp và nội dung media cho team CB Centres |
| Guide text | Vui lòng cung cấp đủ brief, tài nguyên, deadline và xác nhận nội dung trước khi gửi |
| Action | Save Draft / Submit Request |

## 6.2. Copy đề xuất

```text
PHIẾU YÊU CẦU THIẾT KẾ & MEDIA

Vui lòng cung cấp đầy đủ thông tin, mô tả rõ mục tiêu sử dụng và đính kèm tài liệu liên quan để team Media phối hợp triển khai hiệu quả, đúng tiến độ và đúng chuẩn thương hiệu CB.
```

---

# 7. Section A — Requester Information

## 7.1. Mục đích

Thu thập thông tin người gửi để Account có thể liên hệ, xác định chi nhánh/bộ phận và phân quyền tracking.

## 7.2. Fields

| Field | Type | Required | Data key | Note |
|---|---|---:|---|---|
| Họ và tên | Text input | Yes | `requester_name` | Auto-fill từ user profile nếu đã đăng nhập |
| Email | Email input | Yes | `requester_email` | Auto-fill từ tài khoản |
| Chi nhánh/Bộ phận | Select/Search | Yes | `department` | Nên lấy từ master data |
| Thông tin liên hệ | Text input | Yes | `requester_contact` | SĐT hoặc email phụ |
| Vai trò người gửi | Select | No | `requester_role_note` | Chi nhánh, HO, Academic, Sales, Partner... |

## 7.3. Department master data

Dev nên tạo bảng hoặc config cho department/branch:

```text
HO Marketing
Academic
Sales
CB Mekong
CB Hưng Phú
CB Cần Thơ
CB Tiên Thủy
Khác
```

## 7.4. Logic

```text
Nếu user là Client:
→ requester_name/email/department auto-fill
→ không cho sửa email nếu dùng login email.

Nếu user là Account tạo thay:
→ hiển thị field "Tạo order thay cho"
→ Account chọn requester/client/branch.
```

---

# 8. Section B — Project / Brief Information

## 8.1. Mục đích

Xác định order này phục vụ chương trình/campaign nào, mục tiêu sử dụng là gì và đối tượng truyền thông là ai.

## 8.2. Fields

| Field | Type | Required | Data key | Note |
|---|---|---:|---|---|
| Tên dự án/Chương trình/Sự kiện | Text input | Yes | `project_name` | Ví dụ: Summer Campaign 2026 |
| Mục đích thiết kế/Dự án/Chương trình | Long textarea | Yes | `project_purpose` | Quảng cáo, POSM, tuyển sinh, event, website... |
| Đối tượng mục tiêu | Multi-select/Checkbox | Yes | `target_audience` | Có thể chọn nhiều |
| Kênh sử dụng | Multi-select | Yes | `usage_channels` | Facebook, Website, Zalo, LCD, In ấn... |
| Ngày sử dụng thực tế | Date picker | No | `actual_use_date` | Ngày sự kiện/chạy chương trình |
| Mã/Tên campaign | Text input | No | `campaign_code` | Nếu có |

## 8.3. Target audience options

```text
Học viên CB
Phụ huynh
Học viên ngoài CB
Giáo viên/Nhân sự nội bộ
Trường học/Đơn vị liên kết
Đối tác
Khác
```

## 8.4. Usage channel options

```text
Facebook
Zalo OA
Website
Landing Page
TikTok/Reels
LCD/TV nội bộ
In ấn
Sự kiện
Trường học/Chi nhánh
Email
Khác
```

## 8.5. Validation

```text
project_name không được rỗng
project_purpose tối thiểu 20 ký tự
target_audience phải chọn ít nhất 1 option
usage_channels phải chọn ít nhất 1 option
```

---

# 9. Section C — Request Type & Deliverables

## 9.1. Mục đích

Xác định loại yêu cầu chính và hạng mục cần sản xuất. Đây là phần quan trọng để hệ thống biết có cần tạo 1 task hay nhiều task con.

## 9.2. Main request type

| Field | Type | Required | Data key |
|---|---|---:|---|
| Loại yêu cầu | Select | Yes | `request_type` |

Options:

```text
Thiết kế/POSM
Digital Design
Video Editing
Quay
Chụp ảnh
Motion Graphic
Ads/Post Basic
Slide/Proposal
Khác
```

## 9.3. Deliverables for Design/POSM

Hiện khi chọn `Thiết kế/POSM` hoặc `Digital Design`.

```text
Backdrop
Standee
Tờ rơi
Banner
Brochure
Poster
Social Post
Cover Facebook
Avatar/Frame
LCD/TV Screen
Website Banner
Zalo OA Banner
Email Template
Slide/Proposal
Voucher/Coupon
Certificate/Thư mời/Thư cảm ơn
Name card/Tag/Event card
Booth/Event layout
Other
```

## 9.4. Deliverables for Video Editing

Hiện khi chọn `Video Editing` hoặc `Motion Graphic`.

```text
Recap Video
Reel/TikTok 9:16
TVC/Commercial
Video Ads
Motion Graphic
Subtitle Video
Cutdown Video
Intro/Outro
Other
```

## 9.5. Deliverables for Quay

Hiện khi chọn `Quay`.

```text
Quay sự kiện
Quay lớp học
Quay testimonial
Quay cơ sở
Quay sản phẩm/dịch vụ
Quay phỏng vấn
Other
```

## 9.6. Deliverables for Chụp ảnh

Hiện khi chọn `Chụp ảnh`.

```text
Chụp sự kiện
Chụp lớp học
Chụp chân dung
Chụp cơ sở
Chụp sản phẩm
Chụp hoạt động ngoại khóa
Other
```

## 9.7. Deliverables for Ads/Post Basic

Hiện khi chọn `Ads/Post Basic`.

```text
Facebook Post
Facebook Ads Copy
Zalo OA Post
Google Ads Copy
TikTok Caption
Headline/CTA
Content Angle
Other
```

## 9.8. Multi-deliverable logic

Nếu user chọn nhiều hạng mục, hệ thống cần tạo order tổng và cho phép tách task con sau khi Account xác nhận.

Ví dụ:

```text
Order: Summer Campaign 2026
Deliverables selected: Backdrop, Standee, Social Post

System:
→ Create 1 order in Orders
→ Account can generate 3 tasks in Production Board
```

## 9.9. Fields bổ sung theo deliverable

| Field | Type | Required | Data key |
|---|---|---:|---|
| Kích thước/Tỉ lệ | Text + preset | Yes | `size_ratio` |
| Số lượng phiên bản | Number | No | `version_quantity` |
| Format file mong muốn | Multi-select | No | `output_format` |

### Size/ratio presets

```text
1:1 — Social Post
4:5 — Facebook/Instagram Feed
9:16 — Story/Reels/TikTok
16:9 — Slide/LCD/Video
A4
A5
Standee 80x180cm
Backdrop 4x3m
Banner ngang
Khác — nhập kích thước
```

### Output format options

```text
JPG
PNG
PDF
AI
PSD
MP4
MOV
PPTX
Google Drive link
Other
```

---

# 10. Section D — Content & Creative Direction

## 10.1. Mục đích

Thu thập nội dung và định hướng hình ảnh để team Media có đủ brief triển khai.

## 10.2. Fields

| Field | Type | Required | Data key | Note |
|---|---|---:|---|---|
| Nội dung cần thể hiện | Long textarea | Yes | `content_brief` | Text chính, thông tin bắt buộc |
| Headline chính | Text input | No | `main_headline` | Nếu có |
| CTA mong muốn | Text input | No | `cta` | Ví dụ: Đăng ký ngay |
| Thông tin bắt buộc | Long textarea | No | `mandatory_info` | Hotline, website, địa điểm... |
| Phong cách/Định hướng thiết kế | Long textarea | Yes | `creative_direction` | Style, màu sắc, mood, link ref |
| Link tham khảo | URL input | No | `reference_link` | Link mẫu |
| Yêu cầu wording lại nội dung | Radio | Yes | `wording_required` | Có/Không |
| Ghi chú nội dung | Long textarea | No | `content_note` | Lưu ý thêm |

## 10.3. Nội dung cần nhắc user nhập

```text
Headline chính
Thông tin phụ
Thời gian
Địa điểm
Ưu đãi
CTA
Hotline
Website
Logo/đơn vị đồng hành
Nội dung bắt buộc phải xuất hiện
```

## 10.4. Wording options

```text
Có — Cần hỗ trợ chỉnh wording/câu chữ
Không — Sử dụng đúng nội dung đã cung cấp
```

## 10.5. Validation

```text
content_brief hoặc file_brief_url phải có ít nhất một.
Nếu wording_required = Không, hệ thống hiển thị cảnh báo:
"Team Media sẽ sử dụng đúng nội dung đã cung cấp. Vui lòng kiểm tra kỹ chính tả và thông tin trước khi gửi."
```

---

# 11. Section E — Assets & File Upload

## 11.1. Mục đích

Thu thập file brief, logo, hình ảnh, guideline, source cũ, link Drive và tài nguyên liên quan.

## 11.2. Text guide

```text
Anh/Chị vui lòng cung cấp toàn bộ tài nguyên yêu cầu sử dụng trong thiết kế.

Ví dụ: logo, hình ảnh sản phẩm, brand guideline, thiết kế tham khảo hoặc tài liệu liên quan.

Đối với các chương trình khuyến mãi sử dụng quà của CTKM cũ, vui lòng ghi rõ vào phần Ghi chú: quà đó nằm trong CTKM nào, thời gian chạy, hoặc đính kèm hình ảnh quà nếu có.

Nếu tài nguyên có dung lượng lớn, vui lòng gửi link Google Drive vào phần bên dưới.
```

## 11.3. Fields

| Field | Type | Required | Data key |
|---|---|---:|---|
| Upload file nội dung chi tiết | File upload | No | `brief_files` |
| Upload tài nguyên | File upload | No | `asset_files` |
| Link Google Drive tài nguyên | URL input | No | `source_link` |
| Link folder Drive làm việc | URL input | No | `working_drive_link` |
| Ghi chú tài nguyên | Long textarea | No | `asset_note` |

## 11.4. Allowed file types

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

## 11.5. File size recommendation

```text
Single file upload: max 100MB
Nếu lớn hơn: yêu cầu dùng Google Drive link
```

## 11.6. Validation

```text
Nếu request_type = Video Editing và không có footage/link Drive:
→ Show warning: "Video editing cần footage hoặc link Drive để team xử lý."

Nếu request_type = Quay/Chụp:
→ Không bắt buộc upload file nhưng cần địa điểm/thời gian ở section conditional.
```

---

# 12. Section F — Deadline & Priority

## 12.1. Mục đích

Xác định deadline mong muốn, mức độ ưu tiên và ngày sử dụng thực tế.

## 12.2. SLA guide text

```text
Thời gian hoàn thành dự kiến dao động từ 1–7 ngày làm việc kể từ khi brief được xác nhận đầy đủ.

Deadline thực tế phụ thuộc vào mức độ phức tạp, số lượng hạng mục, chất lượng brief và tính chất công việc.

Đối với video, dự án có quay/chụp, dựng phim hoặc cần kịch bản chi tiết, team Media sẽ trao đổi và xác nhận deadline riêng trong quá trình tiếp nhận.
```

## 12.3. Fields

| Field | Type | Required | Data key |
|---|---|---:|---|
| Mức độ ưu tiên | Radio/Select | Yes | `priority` |
| Deadline mong muốn | Date picker | Yes | `requested_deadline` |
| Giờ mong muốn hoàn thành | Time picker | No | `requested_deadline_time` |
| Deadline có cố định không? | Radio | Yes | `is_fixed_deadline` |
| Ngày sử dụng thực tế | Date picker | No | `actual_use_date` |
| Lý do gấp | Textarea | Conditional | `urgent_reason` |

## 12.4. Priority options

```text
Bình thường
Gấp
Rất gấp
```

## 12.5. Fixed deadline options

```text
Có — bắt buộc hoàn thành trước thời điểm này
Không — có thể trao đổi lại với team Media
```

## 12.6. Priority logic

```text
Nếu priority = Rất gấp:
→ urgent_reason required
→ Show warning: "Yêu cầu rất gấp cần Account/Admin xác nhận khả năng thực hiện."

Nếu requested_deadline < now + minimum_sla:
→ Show warning nhưng vẫn cho submit
→ Account/Admin sẽ xác nhận lại deadline sau.
```

## 12.7. Minimum SLA config

Dev nên để trong Settings:

```text
Design/POSM: 1–7 ngày làm việc
Digital Design: 1–3 ngày làm việc
Video Editing: 3–10 ngày làm việc tùy footage
Quay/Chụp: cần xác nhận lịch riêng
Ads/Post Basic: 0.5–2 ngày làm việc
Slide/Proposal: 2–7 ngày làm việc
```

---

# 13. Section G — Responsibility Confirmation

## 13.1. Mục đích

Xác nhận requester đã kiểm tra nội dung trước khi gửi. Đây là cơ sở trách nhiệm nội dung.

## 13.2. Copy đề xuất

```text
Bộ phận/Chi nhánh/Cá nhân gửi yêu cầu có trách nhiệm kiểm tra và đảm bảo toàn bộ nội dung cung cấp là đúng, đủ và đã được xác nhận trước khi gửi brief.

Sau khi sản phẩm đã được bàn giao theo đúng nội dung được cung cấp và đã qua bước duyệt, Team Media_MKT sẽ không chịu trách nhiệm đối với các sai sót phát sinh từ nội dung brief ban đầu hoặc nội dung chưa được kiểm tra kỹ bởi đơn vị yêu cầu.
```

## 13.3. Required checkbox

| Field | Type | Required | Data key |
|---|---|---:|---|
| Xác nhận trách nhiệm nội dung | Checkbox | Yes | `content_responsibility_confirmed` |

Checkbox text:

```text
Tôi xác nhận đã kiểm tra nội dung brief, thông tin chương trình, thời gian, địa điểm, ưu đãi, chính tả và các nội dung bắt buộc trước khi gửi yêu cầu.
```

## 13.4. Optional checkbox

```text
Tôi hiểu rằng deadline chính thức sẽ được Account/Media xác nhận sau khi kiểm tra brief.
```

Data key:

```text
deadline_policy_confirmed
```

---

# 14. Conditional Sub-Forms

## 14.1. Nếu chọn Video Editing

Hiển thị thêm:

| Field | Type | Required | Data key |
|---|---|---:|---|
| Loại video | Select | Yes | `video_type` |
| Tỉ lệ video | Select | Yes | `video_ratio` |
| Thời lượng mong muốn | Text/Number | Yes | `video_duration` |
| Kênh đăng tải | Multi-select | Yes | `video_channels` |
| Có footage sẵn chưa? | Radio | Yes | `has_footage` |
| Có kịch bản chưa? | Radio | No | `has_script` |
| Yêu cầu subtitle? | Radio | No | `subtitle_required` |
| Yêu cầu voice/nhạc? | Textarea | No | `audio_requirement` |
| Link footage Drive | URL | Conditional | `footage_link` |

## 14.2. Nếu chọn Quay

Hiển thị thêm:

| Field | Type | Required | Data key |
|---|---|---:|---|
| Ngày quay mong muốn | Date | Yes | `shooting_date` |
| Thời gian quay | Time/Text | Yes | `shooting_time` |
| Địa điểm quay | Text | Yes | `shooting_location` |
| Nội dung cần quay | Textarea | Yes | `shooting_content` |
| Số lượng người tham gia | Text/Number | No | `participant_count` |
| Người liên hệ onsite | Text | Yes | `onsite_contact` |
| SĐT onsite | Text | Yes | `onsite_phone` |
| Có cần setup backdrop/ánh sáng? | Radio | No | `setup_required` |

## 14.3. Nếu chọn Chụp ảnh

Hiển thị thêm:

| Field | Type | Required | Data key |
|---|---|---:|---|
| Ngày chụp mong muốn | Date | Yes | `photo_date` |
| Thời gian chụp | Time/Text | Yes | `photo_time` |
| Địa điểm chụp | Text | Yes | `photo_location` |
| Loại ảnh cần chụp | Select/Multi-select | Yes | `photo_type` |
| Số lượng ảnh mong muốn | Text/Number | No | `photo_quantity` |
| Style ảnh tham khảo | Textarea/URL | No | `photo_style_ref` |
| Người liên hệ onsite | Text | Yes | `onsite_contact` |

## 14.4. Nếu chọn Ads/Post Basic

Hiển thị thêm:

| Field | Type | Required | Data key |
|---|---|---:|---|
| Mục tiêu nội dung | Select | Yes | `ads_objective` |
| Kênh sử dụng | Multi-select | Yes | `ads_channels` |
| Đối tượng mục tiêu | Textarea | Yes | `ads_audience_detail` |
| Thông điệp chính | Textarea | Yes | `ads_key_message` |
| Ưu đãi nếu có | Textarea | No | `promotion_info` |
| CTA mong muốn | Text | No | `ads_cta` |
| Yêu cầu tạo caption/headline? | Checkbox | No | `copy_items_required` |
| Yêu cầu tạo visual prompt? | Radio | No | `visual_prompt_required` |

---

# 15. Form State

## 15.1. Draft state

Form nên hỗ trợ lưu nháp.

```text
Draft
Submitted
Cancelled
```

## 15.2. Autosave

Nếu user đã đăng nhập:

```text
Autosave sau mỗi 30 giây
Autosave khi chuyển section
Autosave khi user rời trang
```

## 15.3. Draft fields

```text
draft_id
user_id
form_data_json
last_saved_at
status
```

## 15.4. Draft UX

```text
Đã lưu nháp lúc 10:25
Tiếp tục bản nháp gần nhất?
Xóa bản nháp
Submit bản nháp
```

---

# 16. Submit Flow

## 16.1. Flow chi tiết

```text
User nhập form
→ Click Submit Request
→ Frontend validate required fields
→ Nếu lỗi: scroll đến field lỗi đầu tiên
→ Nếu hợp lệ: show Preview Brief modal
→ User xác nhận Submit
→ API tạo Order ID
→ Save vào Orders
→ Save Files vào Files table
→ Save Activity Log: order_created
→ Send notification cho Account/Admin
→ Show Success screen
```

## 16.2. Success screen

Sau khi submit, hiển thị:

```text
Yêu cầu của bạn đã được gửi thành công.

Order ID: MEDIA-2026-0001
Trạng thái hiện tại: Chờ xác nhận brief

Team Media/Account sẽ kiểm tra brief và phản hồi nếu cần bổ sung thông tin.
```

CTA:

```text
Xem trạng thái đơn
Tạo yêu cầu mới
Về Dashboard
```

## 16.3. Initial order status

```text
account_status = Chờ xác nhận
production_status = Chưa phân công
delivery_status = Chưa sẵn sàng bàn giao
progress = 5
```

---

# 17. Preview Brief Modal

## 17.1. Mục đích

Trước khi submit, user xem lại toàn bộ thông tin đã nhập.

## 17.2. Nội dung preview

```text
Thông tin người gửi
Project/Campaign/Event
Loại yêu cầu
Hạng mục
Kích thước
Đối tượng mục tiêu
Kênh sử dụng
Nội dung cần thể hiện
Định hướng thiết kế
Tài nguyên/link Drive
Priority
Deadline
Xác nhận trách nhiệm nội dung
```

## 17.3. Action

```text
Quay lại chỉnh sửa
Submit Request
```

---

# 18. Validation Rules

## 18.1. Required validation

```text
requester_name required
requester_email required and valid email
department required
requester_contact required
project_name required
project_purpose required min 20 chars
target_audience min 1
usage_channels min 1
request_type required
deliverable_type min 1
size_ratio required for design/video/digital
content_brief or file_brief required
creative_direction required for design/digital
priority required
requested_deadline required
is_fixed_deadline required
content_responsibility_confirmed must be true
```

## 18.2. Conditional validation

```text
If priority = Rất gấp → urgent_reason required
If request_type = Video Editing → has_footage or footage_link required
If request_type = Quay → shooting_date, shooting_time, shooting_location, onsite_contact required
If request_type = Chụp ảnh → photo_date, photo_time, photo_location, onsite_contact required
If is_fixed_deadline = Có and requested_deadline < minimum SLA → show warning and require confirmation
```

## 18.3. URL validation

```text
source_link must be valid URL if provided
reference_link must be valid URL if provided
footage_link must be valid URL if provided
```

---

# 19. Data Mapping to Database Orders

| Order Form field | Orders field |
|---|---|
| Họ và tên | requester_name |
| Email | requester_email |
| Chi nhánh/Bộ phận | department |
| Thông tin liên hệ | requester_contact |
| Tên dự án/chương trình | project_name |
| Mục đích thiết kế | project_purpose |
| Đối tượng mục tiêu | target_audience |
| Kênh sử dụng | usage_channels |
| Loại yêu cầu | request_type |
| Hạng mục | deliverable_type |
| Kích thước/Tỉ lệ | size_ratio |
| Nội dung cần thể hiện | content_brief |
| Headline chính | main_headline |
| CTA | cta |
| Thông tin bắt buộc | mandatory_info |
| Định hướng thiết kế | creative_direction |
| Link tham khảo | reference_link |
| Wording | wording_required |
| Upload file nội dung | file_brief_url / Files |
| Upload tài nguyên | asset_files / Files |
| Link Drive tài nguyên | source_link |
| Mức độ ưu tiên | priority |
| Deadline mong muốn | requested_deadline |
| Giờ mong muốn | requested_deadline_time |
| Deadline cố định | is_fixed_deadline |
| Ngày sử dụng thực tế | actual_use_date |
| Lý do gấp | urgent_reason |
| Xác nhận trách nhiệm | content_responsibility_confirmed |

---

# 20. API Requirements

## 20.1. Create order API

```http
POST /api/orders
```

Request body example:

```json
{
  "requester_name": "Nguyễn Văn A",
  "requester_email": "a@cbcentres.com",
  "department": "CB Mekong",
  "requester_contact": "0900000000",
  "project_name": "Summer Campaign 2026",
  "project_purpose": "Thiết kế POSM cho chương trình tuyển sinh hè",
  "target_audience": ["Phụ huynh", "Học viên ngoài CB"],
  "usage_channels": ["Facebook", "In ấn", "Sự kiện"],
  "request_type": "Thiết kế/POSM",
  "deliverable_type": ["Backdrop", "Standee", "Social Post"],
  "size_ratio": "Backdrop 4x3m, Standee 80x180cm, Post 1:1",
  "content_brief": "Nội dung chương trình...",
  "creative_direction": "Sạch, hiện đại, đúng brand CB",
  "wording_required": true,
  "source_link": "https://drive.google.com/...",
  "priority": "Gấp",
  "requested_deadline": "2026-03-14",
  "requested_deadline_time": "17:00",
  "is_fixed_deadline": true,
  "actual_use_date": "2026-03-16",
  "content_responsibility_confirmed": true
}
```

Response example:

```json
{
  "success": true,
  "order_id": "MEDIA-2026-0001",
  "account_status": "Chờ xác nhận",
  "production_status": "Chưa phân công",
  "delivery_status": "Chưa sẵn sàng bàn giao",
  "progress": 5,
  "created_at": "2026-03-10T10:30:00+07:00"
}
```

## 20.2. Save draft API

```http
POST /api/order-drafts
PUT /api/order-drafts/{draft_id}
GET /api/order-drafts/latest
DELETE /api/order-drafts/{draft_id}
```

## 20.3. Upload files API

```http
POST /api/files/upload
```

Suggested response:

```json
{
  "file_id": "FILE-0001",
  "file_name": "brief.docx",
  "file_url": "https://...",
  "file_type": "Brief",
  "uploaded_at": "2026-03-10T10:30:00+07:00"
}
```

## 20.4. Master data APIs

```http
GET /api/master-data/departments
GET /api/master-data/request-types
GET /api/master-data/deliverables
GET /api/master-data/usage-channels
GET /api/settings/sla
```

---

# 21. Database Tables Impact

## 21.1. Orders table

Order Form tạo record mới trong `Orders`.

Minimum fields created at submit:

```text
order_id
created_at
updated_at
requester_id
requester_name
requester_email
requester_contact
department
project_name
project_purpose
target_audience
usage_channels
request_type
deliverable_type
size_ratio
content_brief
creative_direction
source_link
priority
requested_deadline
actual_use_date
wording_required
account_status
production_status
delivery_status
progress
content_responsibility_confirmed
```

## 21.2. Files table

Mỗi file upload tạo record trong `Files`.

```text
file_id
order_id
file_type
file_name
file_url
file_size
mime_type
uploaded_by
uploaded_at
```

## 21.3. ActivityLog table

Khi submit tạo log:

```text
action_type = order_created
order_id = new order id
user_id = current user
created_at = now
comment = "Order created from Order Form"
```

Nếu lưu nháp:

```text
action_type = draft_saved
```

---

# 22. Notification Requirements

## 22.1. Sau khi submit

Gửi notification cho:

```text
Admin
Account mặc định
Account theo department nếu có routing rule
```

Nội dung:

```text
Có order mới cần xác nhận brief.
Order ID: MEDIA-2026-0001
Project: Summer Campaign 2026
Requester: Nguyễn Văn A
Deadline mong muốn: 14/03/2026
Priority: Gấp
```

## 22.2. Gửi email/in-app cho requester

```text
Yêu cầu của bạn đã được ghi nhận.

Order ID: MEDIA-2026-0001
Trạng thái: Chờ xác nhận brief

Team Media sẽ kiểm tra và phản hồi nếu cần bổ sung thông tin.
```

---

# 23. Frontend Component Structure

```text
OrderFormPage
├── OrderFormHeader
├── OrderFormStepper
├── RequesterInfoSection
├── ProjectBriefSection
├── RequestTypeSection
├── ContentCreativeSection
├── AssetsUploadSection
├── DeadlinePrioritySection
├── ResponsibilityConfirmationSection
├── ConditionalSubForm
│   ├── VideoEditingFields
│   ├── ShootingFields
│   ├── PhotoFields
│   └── AdsPostFields
├── FormSidebarGuide
├── PreviewBriefModal
├── SubmitSuccessModal
└── StickySubmitBar
```

---

# 24. UI States

## 24.1. Loading state

```text
Loading master data...
Uploading files...
Submitting request...
Saving draft...
```

## 24.2. Empty state

```text
Chưa có bản nháp nào.
Chưa upload file nào.
```

## 24.3. Error state

```text
Không thể gửi yêu cầu. Vui lòng kiểm tra lại thông tin hoặc thử lại.
Không thể upload file. Vui lòng dùng link Google Drive nếu file quá lớn.
```

## 24.4. Success state

```text
Gửi yêu cầu thành công.
Order ID: MEDIA-2026-0001
```

---

# 25. UX Notes

1. Form không nên quá dài trên một màn hình; nên chia section/step.
2. Có thể dùng accordion hoặc stepper.
3. Field nào bắt buộc phải có dấu `*`.
4. Cần có tooltip cho các field khó hiểu: deadline, wording, source link.
5. Có warning khi deadline quá gấp.
6. Có preview brief trước khi submit.
7. Có save draft để tránh mất dữ liệu.
8. File nặng nên ưu tiên Google Drive link.
9. Sau khi submit, user cần thấy Order ID rõ ràng.
10. Account/Admin phải nhận notification ngay khi có order mới.

---

# 26. Acceptance Criteria

## 26.1. Functional

- User có quyền có thể mở Order Form.
- User điền form và submit thành công.
- Hệ thống validate field bắt buộc.
- Hệ thống tạo `Order ID` đúng format.
- Dữ liệu được lưu vào `Orders`.
- File upload được lưu vào `Files`.
- Activity log được tạo.
- Notification được gửi cho Account/Admin.
- Requester nhận màn hình/email xác nhận.
- Account thấy order mới trong Database Orders với `account_status = Chờ xác nhận`.
- Order chưa tự động vào Production Board nếu chưa được Account xác nhận brief.

## 26.2. Role-based

- Client chỉ tạo order cho chính mình.
- Account có thể tạo order thay client nếu được cấp quyền.
- Admin có thể tạo order cho bất kỳ department/client.
- Client không thấy internal field như `internal_deadline`, `account_note`, `production_pic`.

## 26.3. UX

- Form responsive desktop/tablet/mobile.
- Có section rõ ràng.
- Có loading, error, success state.
- Có warning cho deadline gấp.
- Có preview trước khi submit.
- Có save draft.

---

# 27. Suggested Initial Build Scope

## MVP

```text
Order Form page
Required fields
Conditional request type fields cơ bản
Submit validation
Order ID auto
Save to Orders
Upload/link file
Success screen
Notification placeholder
```

## Phase 2

```text
Save draft/autosave
Preview Brief modal
Advanced conditional fields
Department routing rule
Email notification
File upload progress
Google Drive integration
```

## Phase 3

```text
AI Brief Optimizer embedded
Auto detect missing brief fields
Suggested SLA
Auto split deliverables into tasks
Client order history
```

---

# 28. Prompt for Dev/Claude

```text
Build the Order Form Module for "CB Creative Flow - Media Hub by CB Centres".

The module must allow Client/Account/Admin to create a new media/design request.

The form must include:
- Requester information
- Project/brief information
- Request type and deliverables
- Content and creative direction
- Assets/file upload/link Drive
- Deadline and priority
- Responsibility confirmation
- Conditional sub-forms for Video Editing, Shooting, Photo and Ads/Post Basic

After submit:
- Validate required fields
- Create Order ID in format MEDIA-YYYY-0001
- Save data to Orders table
- Save uploaded files to Files table
- Create ActivityLog record
- Notify Account/Admin
- Show success screen with Order ID
- Initial statuses:
  account_status = Chờ xác nhận
  production_status = Chưa phân công
  delivery_status = Chưa sẵn sàng bàn giao
  progress = 5

Use brand colors:
- Red #BA110F
- Blue #191970
- Font Montserrat
- Clean professional SaaS form UI.

Do not push the order to Production Board until Account confirms brief, assigns PIC and sets internal deadline.
```
