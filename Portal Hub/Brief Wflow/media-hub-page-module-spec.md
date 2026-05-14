# Media Hub — Detailed Spec by Page / Module

## 1) Mục tiêu tài liệu
Tài liệu này mô tả cấu trúc website Media Hub theo **page/module** để Dev có thể hiểu rõ:

- website gồm những page nào
- mỗi page giải quyết nhu cầu gì
- user flow giữa các page ra sao
- mỗi page cần section nào
- logic dữ liệu, trạng thái và hành vi cơ bản
- thứ tự ưu tiên khi build MVP

Tài liệu này phù hợp để dùng làm:
- brief cho Dev web
- handoff cho UI/UX Designer
- nền tảng tách task FE / BE
- checklist build MVP

---

# 2) Sitemap tổng thể

## 2.1. Cấu trúc page/module đề xuất
1. Trang chủ / Homepage
2. Gửi yêu cầu / Request Page
3. Tra cứu tiến độ / Tracking Page
4. Chi tiết đơn hàng / Order Detail Page
5. Sản phẩm bàn giao / Deliveries Page
6. Chi tiết sản phẩm / Delivery Detail Page
7. Gửi phản hồi / Feedback Page hoặc Feedback Modal
8. Hướng dẫn / Help Center Page
9. Đăng nhập / Login Page
10. Tài khoản / Account Dashboard
11. Trang lỗi / Empty / Not Found / Permission States

## 2.2. Cấu trúc route gợi ý
```txt
/
 /request
 /tracking
 /tracking/[orderCode]
 /deliveries
 /deliveries/[deliveryId]
 /feedback
 /help
 /login
 /account
```

Nếu muốn MVP gọn hơn:
- `/`
- `/request`
- `/tracking`
- `/deliveries`
- `/help`
- `/login`

Các màn hình detail có thể mở bằng modal hoặc page riêng.

---

# 3) User roles

## 3.1. Guest / Client chưa đăng nhập
Có thể:
- vào homepage
- đọc hướng dẫn
- nhập mã order để tra cứu nhanh nếu được cấp quyền public lookup
- xem login page

Không nên:
- xem toàn bộ lịch sử đơn hàng
- xem toàn bộ file giao
- gửi phản hồi sâu nếu chưa xác thực

## 3.2. Client đã đăng nhập
Có thể:
- gửi yêu cầu mới
- xem danh sách order của mình
- xem tiến độ
- xem sản phẩm bàn giao
- tải file
- gửi phản hồi

## 3.3. Staff / Account / Internal team
Có thể:
- xem order được phân quyền
- cập nhật trạng thái
- upload file
- trả lời feedback

## 3.4. Admin
Có thể:
- toàn quyền quản trị
- cấu hình form
- cấu hình user
- cấu hình workflow
- xem báo cáo

Tài liệu này tập trung trước vào **client-facing pages**.

---

# 4) Global modules áp dụng cho nhiều page

## 4.1. Header
Chức năng:
- brand
- menu
- CTA gửi yêu cầu
- đăng nhập / tài khoản

## 4.2. Footer
Chức năng:
- copyright
- brand summary
- link phụ trợ nếu cần

## 4.3. Toast / Alert system
Dùng cho:
- gửi yêu cầu thành công
- upload thành công
- phản hồi thành công
- lỗi mạng / lỗi hệ thống

## 4.4. Status badge system
Áp dụng cho:
- order status
- delivery status
- feedback status

## 4.5. Empty state system
Áp dụng cho:
- chưa có order
- chưa có file bàn giao
- không có kết quả tra cứu
- chưa có phản hồi

---

# 5) PAGE 01 — Homepage

## 5.1. Mục tiêu page
Homepage là trang entry point của toàn website.  
Mục tiêu:

- giải thích Media Hub là gì
- cho user biết 4 tác vụ chính
- dẫn user tới đúng page nhanh nhất
- tạo niềm tin về hệ thống vận hành chuyên nghiệp

## 5.2. Đối tượng sử dụng
- client mới
- client cũ
- user chưa login
- user cần điều hướng nhanh

## 5.3. Các section của Homepage
1. Header
2. Hero
3. Quick Actions
4. Workflow
5. Tracking Quick Lookup
6. Deliveries Preview
7. FAQ / Guide Preview
8. Support
9. Footer

## 5.4. CTA chính
- Gửi yêu cầu ngay
- Tra cứu tiến độ
- Xem sản phẩm
- Đăng nhập

## 5.5. Dữ liệu cần hiển thị
- stats tóm tắt
- mock preview hoặc dữ liệu thật từ order mới
- preview sản phẩm gần đây
- FAQ ngắn

## 5.6. Logic
- nếu chưa login: CTA đưa tới request / tracking / login
- nếu đã login: CTA có thể đưa thẳng tới dashboard cá nhân

## 5.7. Acceptance criteria
- user hiểu giá trị website trong vài giây
- điều hướng rõ
- CTA nổi bật
- responsive tốt

---

# 6) PAGE 02 — Request Page / Gửi yêu cầu

## 6.1. Mục tiêu page
Đây là page quan trọng nhất về mặt nghiệp vụ.  
Mục tiêu:
- cho client tạo order mới
- thu thập đầy đủ thông tin để team xử lý
- giảm hỏi đi hỏi lại sau khi tiếp nhận

## 6.2. User story
- Tôi muốn gửi yêu cầu thiết kế/video
- Tôi muốn chọn loại dịch vụ rõ ràng
- Tôi muốn mô tả deadline và nhu cầu
- Tôi muốn đính kèm file tham chiếu
- Tôi muốn nhận mã order sau khi gửi

## 6.3. Cấu trúc layout
1. Header
2. Page title + intro
3. Form nhiều section
4. Upload area
5. Submit area
6. Success state
7. Footer

## 6.4. Cấu trúc form chi tiết

### Section A — Thông tin người gửi
- Tên khách hàng / đơn vị
- Người liên hệ
- Email
- Số điện thoại

### Section B — Thông tin yêu cầu
- Loại dịch vụ
  - Thiết kế
  - Video
  - Chụp ảnh
  - Social content
  - Motion / animation
  - Khác
- Tên dự án / campaign
- Mục tiêu sử dụng
- Mô tả chi tiết

### Section C — Timeline
- Deadline mong muốn
- Mức độ ưu tiên
  - Bình thường
  - Gấp
  - Rất gấp

### Section D — Tài nguyên đính kèm
- Upload file
- Link drive
- Nội dung text
- Brand guideline / logo / ref

### Section E — Xác nhận
- checkbox xác nhận thông tin
- nút submit

## 6.5. Validation rules gợi ý
Bắt buộc:
- người liên hệ
- email hoặc số điện thoại
- loại dịch vụ
- tên dự án
- mô tả
- deadline

## 6.6. Success state sau submit
Hiển thị:
- thông báo gửi thành công
- mã order
- trạng thái ban đầu: Đã tiếp nhận
- CTA:
  - Tra cứu tiến độ
  - Quay về trang chủ
  - Gửi thêm yêu cầu mới

## 6.7. Dữ liệu backend tối thiểu
```json
{
  "requestId": "CB-2026-001",
  "clientName": "",
  "contactName": "",
  "email": "",
  "phone": "",
  "serviceType": "",
  "projectName": "",
  "objective": "",
  "description": "",
  "priority": "",
  "deadline": "",
  "attachments": [],
  "driveLink": "",
  "status": "received",
  "createdAt": ""
}
```

## 6.8. Trạng thái page
- idle
- filling
- uploading
- submitting
- success
- error

## 6.9. Acceptance criteria
- form dễ hiểu
- validation rõ
- upload ổn định
- submit thành công trả ra mã order

---

# 7) PAGE 03 — Tracking Page / Tra cứu tiến độ

## 7.1. Mục tiêu page
Cho phép user nhập mã order hoặc dùng tài khoản để xem tiến độ xử lý.

## 7.2. User story
- Tôi muốn nhập mã order để xem trạng thái
- Tôi muốn biết deadline, cập nhật gần nhất và next step
- Tôi không muốn phải hỏi qua chat/email

## 7.3. Cấu trúc layout
1. Header
2. Page title
3. Input search area
4. Search result state
5. Related action buttons
6. Footer

## 7.4. Thành phần chi tiết

### Search box
- input mã đơn
- nút tra cứu
- helper text ví dụ mã đơn

### Result summary
- tên dự án
- mã order
- loại dịch vụ
- trạng thái
- deadline
- người phụ trách

### Result detail
- progress %
- timeline step
- last update
- expected next action
- CTA:
  - xem chi tiết đơn
  - xem sản phẩm
  - gửi phản hồi

## 7.5. Trạng thái cần hỗ trợ
- chưa nhập gì
- đang loading
- tìm thấy
- không tìm thấy
- không đủ quyền
- lỗi hệ thống

## 7.6. Acceptance criteria
- tra cứu nhanh, ít bước
- kết quả rõ
- state đầy đủ

---

# 8) PAGE 04 — Order Detail Page / Chi tiết đơn hàng

## 8.1. Mục tiêu page
Cung cấp toàn bộ thông tin chi tiết của một order cụ thể.

## 8.2. Khi nào cần page này
- sau khi tra cứu xong
- từ dashboard user
- từ email / link direct đến đơn hàng

## 8.3. Nội dung cần có
### Block 1 — Thông tin cơ bản
- mã order
- tên dự án
- loại dịch vụ
- ngày tạo
- deadline
- ưu tiên
- người phụ trách

### Block 2 — Trạng thái hiện tại
- badge trạng thái
- progress bar
- mô tả bước hiện tại

### Block 3 — Mô tả yêu cầu gốc
- brief đã gửi
- tài liệu đính kèm
- mục tiêu sử dụng

### Block 4 — Timeline xử lý
- Đã tiếp nhận
- Đã xác nhận
- Đang xử lý
- Gửi preview
- Chờ phản hồi
- Hoàn tất

### Block 5 — Tệp liên quan
- file preview
- file final
- tài liệu cũ
- lịch sử version nếu có

### Block 6 — Actions
- Gửi phản hồi
- Tải file
- Tạo order tương tự

## 8.4. Acceptance criteria
- user hiểu toàn cảnh order trong một màn hình
- timeline rõ
- file và action liên quan dễ dùng

---

# 9) PAGE 05 — Deliveries Page / Sản phẩm bàn giao

## 9.1. Mục tiêu page
Cho phép user xem toàn bộ danh sách sản phẩm đã hoặc đang được bàn giao.

## 9.2. User story
- Tôi muốn xem tất cả sản phẩm đã gửi cho tôi
- Tôi muốn lọc theo trạng thái hoặc dự án
- Tôi muốn biết file nào là final

## 9.3. Cấu trúc layout
1. Header
2. Page title
3. Filter bar
4. Deliveries grid/list
5. Empty state
6. Footer

## 9.4. Filter gợi ý
- theo dự án
- theo loại asset
- theo thời gian
- theo trạng thái
- theo keyword

## 9.5. View modes
- grid card
- list table

## 9.6. Cấu trúc card/list item
- thumbnail
- project name
- asset type
- version / status
- updatedAt
- CTA:
  - xem
  - tải
  - phản hồi

## 9.7. Acceptance criteria
- lọc rõ
- scan nhanh
- trạng thái file rõ

---

# 10) PAGE 06 — Delivery Detail Page / Chi tiết sản phẩm

## 10.1. Mục tiêu page
Hiển thị thông tin đầy đủ của một sản phẩm bàn giao cụ thể.

## 10.2. Nội dung chính
- tên sản phẩm
- thuộc order nào
- loại asset
- version
- trạng thái
- preview lớn
- mô tả / ghi chú bàn giao
- ngày cập nhật
- download button
- feedback button

## 10.3. Tính năng mở rộng
- compare version
- download multiple files
- xem lịch sử revision

## 10.4. Acceptance criteria
- preview rõ
- tải file dễ
- feedback dễ truy cập

---

# 11) PAGE 07 — Feedback Page / Modal

## 11.1. Mục tiêu page
Cho client phản hồi về sản phẩm hoặc yêu cầu chỉnh sửa.

## 11.2. User story
- Tôi muốn ghi chú chỉnh sửa
- Tôi muốn xác nhận duyệt final
- Tôi muốn phản hồi đúng với file đang xem

## 11.3. Cấu trúc form
- order / file reference
- loại phản hồi
  - yêu cầu chỉnh sửa
  - duyệt final
  - hỏi thêm thông tin
- nội dung phản hồi
- upload file bổ sung nếu có
- submit

## 11.4. Trạng thái
- draft
- submitting
- success
- error

## 11.5. Acceptance criteria
- phản hồi gắn đúng context
- submit nhanh
- confirm rõ sau gửi

---

# 12) PAGE 08 — Help / Hướng dẫn

## 12.1. Mục tiêu page
Là nơi tổng hợp toàn bộ nội dung hỗ trợ sử dụng.

## 12.2. Nội dung đề xuất
- FAQ
- hướng dẫn gửi order
- hướng dẫn tra cứu
- hướng dẫn nhận file
- SLA / nguyên tắc xử lý gợi ý
- thông tin liên hệ

## 12.3. Cấu trúc
- hero nhỏ
- nhóm câu hỏi
- accordion
- contact support

## 12.4. Acceptance criteria
- dễ scan
- nội dung ngắn gọn
- giảm được câu hỏi lặp lại

---

# 13) PAGE 09 — Login Page

## 13.1. Mục tiêu page
Xác thực user để truy cập dữ liệu riêng.

## 13.2. Thành phần
- logo / title
- email
- password
- login button
- forgot password
- support note nếu cần

## 13.3. State
- idle
- loading
- invalid credentials
- success

## 13.4. Acceptance criteria
- đơn giản
- rõ ràng
- hỗ trợ lỗi đăng nhập rõ

---

# 14) PAGE 10 — Account Dashboard

## 14.1. Mục tiêu page
Là trang cá nhân sau login để client xem nhanh toàn bộ hoạt động của mình.

## 14.2. Nội dung
- greeting / account info
- summary stats
- recent orders
- pending feedback
- latest deliveries
- quick actions

## 14.3. CTA
- tạo yêu cầu mới
- xem toàn bộ order
- xem toàn bộ sản phẩm

## 14.4. Acceptance criteria
- user có overview nhanh
- điều hướng dễ
- hỗ trợ workflow hàng ngày

---

# 15) Shared data model gợi ý

## 15.1. Order
```json
{
  "id": "uuid",
  "code": "CB-2026-028",
  "projectName": "Summer Campaign 2026",
  "serviceType": "video",
  "clientId": "client_001",
  "status": "in_progress",
  "progress": 68,
  "priority": "high",
  "deadline": "2026-03-30",
  "assignee": "Account Team",
  "createdAt": "2026-03-21T08:00:00Z",
  "updatedAt": "2026-03-27T16:20:00Z"
}
```

## 15.2. Delivery
```json
{
  "id": "delivery_001",
  "orderCode": "CB-2026-028",
  "projectName": "Video Recap Event Launch",
  "assetType": "video",
  "status": "preview",
  "version": "v1",
  "previewUrl": "",
  "downloadUrl": "",
  "updatedAt": "2026-03-27T16:20:00Z"
}
```

## 15.3. Feedback
```json
{
  "id": "feedback_001",
  "orderCode": "CB-2026-028",
  "deliveryId": "delivery_001",
  "type": "revision_request",
  "message": "",
  "attachments": [],
  "createdBy": "client_001",
  "createdAt": ""
}
```

---

# 16) Workflow between pages

## 16.1. Flow A — Client mới
Homepage  
→ Request Page  
→ Submit success  
→ Tracking Page  
→ Order Detail  
→ Deliveries  
→ Feedback

## 16.2. Flow B — Client quay lại kiểm tra
Homepage  
→ Tracking Page  
→ Order Detail  
→ Delivery Detail

## 16.3. Flow C — Client đã đăng nhập
Login  
→ Account Dashboard  
→ Recent Orders / Deliveries  
→ Detail / Feedback

---

# 17) MVP priority đề xuất

## P1 — Bắt buộc
- Homepage
- Request Page
- Tracking Page
- Deliveries Page
- Login
- Shared header/footer
- trạng thái success/error cơ bản

## P2 — Nên có
- Order Detail Page
- Delivery Detail Page
- Feedback form
- Help page
- Account Dashboard

## P3 — Mở rộng
- version history
- notification center
- saved drafts
- advanced filters
- search toàn hệ thống
- report/dashboard nâng cao

---

# 18) Kỹ thuật FE gợi ý

## 18.1. Component groups
- layout components
- form components
- status components
- card/list components
- feedback components
- auth components

## 18.2. State cần quản lý
- auth state
- form state
- search state
- order state
- delivery state
- feedback state

## 18.3. API groups
- auth APIs
- order APIs
- delivery APIs
- feedback APIs
- upload APIs

---

# 19) Checklist handoff cho Dev

## FE
- route map
- responsive rules
- component library
- validation rules
- empty/error/loading states
- accessibility basics

## BE
- order create/read
- tracking lookup
- deliveries list/read
- feedback create
- auth
- file upload/download

## QA
- form validation
- status mapping
- responsive test
- permission test
- file access test
- toast / error handling

---

# 20) Kết luận
Spec theo page/module này giúp Dev hiểu website không chỉ là một landing page, mà là một **client service portal** có 3 trục chức năng chính:

1. **Tạo yêu cầu**
2. **Theo dõi tiến độ**
3. **Nhận sản phẩm & phản hồi**

Nếu build đúng theo cấu trúc này, Media Hub sẽ đủ rõ để client dùng dễ, đồng thời đủ chuẩn để mở rộng thành hệ thống vận hành thật trong các phase tiếp theo.
