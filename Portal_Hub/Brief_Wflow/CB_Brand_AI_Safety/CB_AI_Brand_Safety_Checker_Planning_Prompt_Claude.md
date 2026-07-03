# CB AI Brand Safety Checker
## Planning triển khai + Prompt gửi Claude/Dev code

**Dự án:** App kiểm duyệt hình ảnh AI theo tiêu chí thương hiệu CB Centres  
**Đơn vị sử dụng chính:** Phòng Marketing/Media CB Centres  
**Mục tiêu:** Kiểm soát việc sử dụng hình ảnh AI trong hệ thống, giảm tải phê duyệt thủ công cho Media, hỗ trợ chi nhánh/phòng ban tự kiểm tra theo checklist thương hiệu và lưu dữ liệu đối chứng.

---

## 1. Bối cảnh & vấn đề cần giải quyết

Hiện tại các phòng ban, chi nhánh và giáo viên trong hệ thống đang sử dụng AI để tạo hình ảnh với số lượng lớn. Việc này giúp tăng tốc sáng tạo nhưng đang phát sinh nhiều lỗi ảnh hưởng đến thương hiệu CB Centres:

- Logo CB Centres sai, méo, mất chi tiết hoặc bị AI biến thành text.
- Dùng sai màu thương hiệu, sai tone thiết kế, sai tinh thần nhận diện.
- Ảnh truyền thông không có logo CB hoặc đặt logo sai cách.
- Hình ảnh AI có lỗi tay, mặt, chữ, đồng phục, bối cảnh, bảng hiệu.
- Hình ảnh dễ gây hiểu nhầm là ảnh thật của lớp học, giáo viên, học viên hoặc sự kiện CB.
- Số lượng hình ảnh quá lớn nên nếu tất cả đều chuyển về Media duyệt sẽ gây quá tải.

Vì vậy cần xây một công cụ kiểm duyệt ban đầu để phân tầng rủi ro, trả kết quả Đạt/Không đạt/Cần chỉnh sửa/Bắt buộc gửi Media duyệt, đồng thời lưu lại toàn bộ dữ liệu để hậu kiểm.

---

## 2. Mục tiêu sản phẩm

App cần đạt 5 mục tiêu:

1. **Kiểm tra nhanh hình ảnh AI** theo checklist thương hiệu cơ bản của CB Centres.
2. **Phân loại rủi ro** theo nhóm nội dung: nội bộ, chi nhánh tự kiểm, bắt buộc Media duyệt.
3. **Trả kết quả rõ ràng**: Đạt / Cần chỉnh sửa / Không đạt / Bắt buộc gửi Media duyệt.
4. **Lưu log đối chứng**: ảnh gốc, người upload, đơn vị, mục đích sử dụng, kết quả AI, điểm số, ghi chú, trạng thái duyệt.
5. **Tạo dashboard hậu kiểm** cho Media: số lượt kiểm tra, lỗi thường gặp, đơn vị vi phạm nhiều, tỷ lệ Đạt/Không đạt.

---

## 3. Định hướng triển khai tổng thể

### 3.1. MVP nên làm trước

MVP tập trung vào chức năng cốt lõi:

- Upload 1 ảnh.
- Nhập thông tin sử dụng.
- AI phân tích ảnh theo tiêu chí thương hiệu.
- App trả kết quả đánh giá.
- Lưu dữ liệu vào database.
- Có màn hình lịch sử kiểm duyệt.
- Có dashboard đơn giản cho Media.

### 3.2. Không nên làm quá phức tạp ở giai đoạn đầu

Không cần làm ngay:

- Training AI model riêng.
- Tự nhận diện logo bằng computer vision custom.
- Tự sửa ảnh.
- Tự thay logo đúng.
- Workflow phê duyệt nhiều cấp quá chi tiết.
- Tích hợp toàn bộ với website hiện tại ngay từ đầu.

Lý do: mục tiêu hiện tại là kiểm soát rủi ro và giảm tải cho Media, không phải thay thế hoàn toàn quy trình duyệt thiết kế.

### 3.3. Nguyên tắc vận hành

App là **lớp kiểm tra ban đầu**, không thay thế hoàn toàn quyền phê duyệt của Media.

Các nội dung thuộc nhóm rủi ro cao vẫn phải gửi Media duyệt, kể cả khi AI đánh giá tương đối tốt.

---

## 4. Phân nhóm nội dung kiểm duyệt

App cần yêu cầu người dùng chọn mục đích sử dụng trước khi upload hoặc trước khi submit đánh giá.

### Nhóm 1 — Nội bộ, không cần Media duyệt

Ví dụ:

- Hình minh họa bài học trong lớp.
- Worksheet, slide giảng dạy nội bộ.
- Trò chơi lớp học.
- Moodboard, phác thảo ý tưởng.
- Không đăng công khai.
- Không dùng logo, mascot, đồng phục, bảng hiệu CB nổi bật.

Kết quả app có thể trả:

- Đạt sử dụng nội bộ.
- Cần chỉnh sửa trước khi dùng.
- Không phù hợp môi trường giáo dục.

### Nhóm 2 — Chi nhánh/phòng ban tự kiểm theo checklist

Ví dụ:

- Bài đăng fanpage chi nhánh quy mô nhỏ.
- Hình minh họa hoạt động lớp học.
- Thông báo nội bộ hoặc thông báo lớp học.
- Nội dung đơn giản, không phải chiến dịch lớn.
- Sử dụng template chuẩn do Media cung cấp.

Kết quả app có thể trả:

- Đạt điều kiện tự đăng.
- Cần chỉnh sửa trước khi đăng.
- Không đạt, không được đăng.
- Bắt buộc gửi Media duyệt nếu phát hiện rủi ro cao.

### Nhóm 3 — Bắt buộc Media duyệt

Ví dụ:

- Tuyển sinh, quảng cáo, ưu đãi, khuyến mãi.
- Poster, banner, backdrop, standee, thư mời, giấy chứng nhận, voucher.
- Chiến dịch cấp hệ thống.
- Website, landing page, fanpage chính, Zalo OA, TikTok, YouTube hệ thống.
- Mascot Cici, logo CB nổi bật, đồng phục, bảng hiệu, cơ sở vật chất.
- Nội dung liên quan đến đối tác, trường học, báo chí, cơ quan bên ngoài.
- Nội dung có yếu tố học phí, cam kết chất lượng, chương trình đào tạo, chứng chỉ, thi cử.

Kết quả app luôn cần có trạng thái:

- Bắt buộc gửi Media duyệt.

AI vẫn đánh giá lỗi để Media biết cần sửa gì, nhưng app không được cho phép tự đăng đối với nhóm này.

---

## 5. User roles

### 5.1. Admin / Media Admin

Quyền:

- Xem tất cả lượt kiểm duyệt.
- Xem dashboard toàn hệ thống.
- Cập nhật tiêu chí kiểm duyệt.
- Cập nhật danh sách lỗi thường gặp.
- Đổi trạng thái review thủ công: Approved / Revision Required / Rejected.
- Xuất dữ liệu CSV.

### 5.2. Branch Reviewer / Department Reviewer

Quyền:

- Upload ảnh.
- Xem kết quả ảnh của đơn vị mình.
- Ghi chú lý do sử dụng.
- Xác nhận tự kiểm đối với Nhóm 1 và Nhóm 2.
- Không được approve nội dung Nhóm 3.

### 5.3. Staff / Teacher

Quyền:

- Upload ảnh để kiểm tra.
- Xem kết quả của ảnh mình upload.
- Tải report/checklist.
- Không có quyền duyệt cuối.

---

## 6. User flow đề xuất

### Flow 1 — Kiểm tra ảnh mới

1. Người dùng đăng nhập.
2. Chọn `Kiểm tra hình ảnh AI`.
3. Upload ảnh.
4. Nhập thông tin:
   - Tên nội dung.
   - Chi nhánh/phòng ban.
   - Người phụ trách.
   - Mục đích sử dụng.
   - Kênh sử dụng.
   - Ngày dự kiến đăng/in/dùng.
   - Có dùng logo CB không?
   - Có dùng mascot Cici không?
   - Có dùng đồng phục/bảng hiệu/cơ sở CB không?
   - Có phải tuyển sinh/quảng cáo/ưu đãi/chiến dịch không?
5. Bấm `Kiểm tra thương hiệu`.
6. App gửi ảnh + metadata sang AI Vision API.
7. AI trả JSON đánh giá.
8. App tính điểm tổng + trạng thái cuối.
9. Hiển thị kết quả:
   - Tổng điểm.
   - Kết luận.
   - Các lỗi phát hiện.
   - Tiêu chí đạt/chưa đạt.
   - Gợi ý chỉnh sửa.
   - Có cần gửi Media duyệt không.
10. App lưu toàn bộ dữ liệu vào database.

### Flow 2 — Media hậu kiểm

1. Media vào Dashboard.
2. Lọc theo ngày, chi nhánh, phòng ban, trạng thái, nhóm rủi ro.
3. Xem danh sách ảnh đã kiểm.
4. Mở chi tiết từng ảnh.
5. Nếu cần, Media cập nhật manual review:
   - Approved.
   - Revision Required.
   - Rejected.
6. Ghi chú lỗi.
7. Dữ liệu được lưu để đối chứng.

### Flow 3 — Chi nhánh tự kiểm

1. Branch Reviewer mở lịch sử của đơn vị.
2. Xem ảnh thuộc Nhóm 1/2.
3. Nếu kết quả Đạt, có thể tự xác nhận đã kiểm tra.
4. Nếu kết quả Cần chỉnh sửa hoặc Không đạt, phải chỉnh ảnh và upload lại.
5. Nếu app báo Bắt buộc gửi Media duyệt, chi nhánh không được tự đăng.

---

## 7. Tiêu chí AI Brand Safety cần kiểm tra

App cần kiểm theo các nhóm tiêu chí dưới đây.

### C1. Logo CB Centres

AI cần đánh giá:

- Có logo CB Centres không?
- Logo có đúng dạng không hay bị biến dạng?
- Logo có bị AI chuyển thành text sai không?
- Logo có bị méo, mờ, sai chữ, sai tỷ lệ không?
- Logo có đặt ở vị trí hợp lý không?
- Logo có bị lẫn với text hoặc element khác không?

Kết quả:

- `pass`: logo đúng hoặc không bắt buộc có logo.
- `warning`: logo nhỏ/mờ/vị trí chưa tốt.
- `fail`: logo sai, méo, biến dạng, text sai, hoặc thiếu logo trong nội dung cần logo.

### C2. Màu sắc thương hiệu

Brand color tham chiếu:

- CB Red: `#BA110F`.
- CB Navy/Blue: `#191970`, chỉ dùng khi phù hợp brand guideline.
- White: `#FFFFFF`.
- Có thể dùng warm light gray, dark charcoal gray, gold accent tùy thiết kế.

AI cần đánh giá:

- Ảnh có lệch màu thương hiệu không?
- Màu chính có quá xa tinh thần CB Centres không?
- Có sử dụng màu gây cảm giác không phù hợp giáo dục không?
- Có dùng màu làm logo/nhận diện sai không?

### C3. Text trong ảnh

AI cần đánh giá:

- Có text sai chính tả không?
- Có text vô nghĩa, méo, sai ký tự do AI tạo không?
- Có text làm sai tên thương hiệu CB Centres không?
- Có thông tin nhạy cảm như học phí, cam kết, ưu đãi, tuyển sinh không?
- Text có rõ ràng và đọc được không?

### C4. Nhân vật, học viên, giáo viên

AI cần đánh giá:

- Nhân vật có lỗi tay, mặt, mắt, tỷ lệ cơ thể không?
- Trang phục có phù hợp môi trường giáo dục không?
- Nếu là học viên/giáo viên CB, đồng phục có đúng tinh thần không?
- Hình ảnh có quá giả, kỳ dị, gây mất thiện cảm không?
- Có gây hiểu nhầm là ảnh thật của học viên/giáo viên CB không?

### C5. Mascot Cici / nhân vật thương hiệu

AI cần đánh giá:

- Có mascot Cici không?
- Mascot có bị biến dạng, sai phong cách, sai màu, sai tinh thần thương hiệu không?
- Có dùng mascot trong nội dung rủi ro cao không?
- Nếu có mascot, cần flag để Media duyệt trong đa số trường hợp công khai.

### C6. Bối cảnh giáo dục / chi nhánh / lớp học

AI cần đánh giá:

- Bối cảnh có phù hợp trung tâm tiếng Anh không?
- Có bảng hiệu, cơ sở vật chất, lớp học, học viên theo hướng dễ hiểu nhầm là ảnh thật không?
- Có chi tiết sai văn hóa, sai môi trường giáo dục Việt Nam không?
- Có nội dung nhạy cảm, phản cảm, bạo lực, chính trị, tôn giáo, y tế, giới tính không phù hợp không?

### C7. Rủi ro truyền thông

AI cần đánh giá:

- Ảnh có phù hợp để đăng công khai không?
- Có rủi ro ảnh hưởng uy tín thương hiệu không?
- Có yếu tố dễ bị phụ huynh/học viên hiểu nhầm không?
- Có yếu tố cần Media duyệt không?

---

## 8. Logic chấm điểm đề xuất

Mỗi ảnh được chấm trên thang 100 điểm.

| Nhóm tiêu chí | Điểm tối đa |
|---|---:|
| Logo & nhận diện CB | 25 |
| Màu sắc & style thương hiệu | 15 |
| Text & thông tin hiển thị | 15 |
| Lỗi AI về hình ảnh/nhân vật | 15 |
| Phù hợp môi trường giáo dục | 15 |
| Rủi ro truyền thông/pháp lý | 15 |
| **Tổng** | **100** |

### Kết luận theo điểm

| Điểm | Kết luận mặc định |
|---:|---|
| 85–100 | Đạt |
| 70–84 | Cần chỉnh sửa |
| 50–69 | Không đạt |
| Dưới 50 | Không đạt nghiêm trọng |

### Rule override bắt buộc

Dù điểm cao, app vẫn phải trả `Bắt buộc gửi Media duyệt` nếu:

- Nội dung thuộc Nhóm 3.
- Có logo CB sai, méo, biến dạng.
- Có mascot Cici trong nội dung công khai.
- Có tuyển sinh/quảng cáo/ưu đãi/khuyến mãi.
- Có đối tác/trường học/cơ quan bên ngoài.
- Có học phí, chứng chỉ, cam kết chất lượng.
- Có hình ảnh mô phỏng học viên/giáo viên/lớp học CB dễ gây hiểu nhầm là ảnh thật.
- Có lỗi nhạy cảm hoặc không phù hợp môi trường giáo dục.

---

## 9. Status cần có trong app

### AI result status

- `PASS`: Đạt.
- `NEEDS_REVISION`: Cần chỉnh sửa.
- `FAIL`: Không đạt.
- `REQUIRES_MEDIA_REVIEW`: Bắt buộc gửi Media duyệt.

### Manual review status

- `PENDING`: Chưa hậu kiểm.
- `APPROVED`: Media/Reviewer đã duyệt.
- `REVISION_REQUIRED`: Yêu cầu chỉnh sửa.
- `REJECTED`: Từ chối sử dụng.
- `ARCHIVED`: Lưu trữ.

---

## 10. Data model đề xuất

Có thể dùng Supabase PostgreSQL.

### Table: `users`

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role text not null check (role in ('admin', 'media_admin', 'branch_reviewer', 'staff', 'teacher')),
  unit_name text,
  branch_name text,
  created_at timestamptz default now()
);
```

### Table: `brand_checks`

```sql
create table brand_checks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  uploader_id uuid references users(id),
  unit_name text,
  branch_name text,
  usage_purpose text,
  usage_channel text,
  usage_group text check (usage_group in ('group_1_internal', 'group_2_self_check', 'group_3_media_review')),
  planned_publish_date date,

  has_logo boolean default false,
  has_mascot boolean default false,
  has_uniform boolean default false,
  has_cb_facility boolean default false,
  is_admission_or_ads boolean default false,
  involves_partner boolean default false,
  contains_sensitive_info boolean default false,

  image_url text not null,
  image_storage_path text,
  image_file_name text,
  image_file_size integer,
  image_mime_type text,

  ai_score integer,
  ai_status text check (ai_status in ('PASS', 'NEEDS_REVISION', 'FAIL', 'REQUIRES_MEDIA_REVIEW')),
  ai_summary text,
  ai_result_json jsonb,

  manual_status text default 'PENDING' check (manual_status in ('PENDING', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED', 'ARCHIVED')),
  manual_reviewer_id uuid references users(id),
  manual_note text,
  reviewed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Table: `brand_check_criteria`

```sql
create table brand_check_criteria (
  id uuid primary key default gen_random_uuid(),
  brand_check_id uuid references brand_checks(id) on delete cascade,
  criterion_code text not null,
  criterion_name text not null,
  status text check (status in ('pass', 'warning', 'fail')),
  score integer,
  max_score integer,
  findings text,
  recommendation text,
  created_at timestamptz default now()
);
```

### Table: `audit_logs`

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
```

---

## 11. Storage đề xuất

Dùng Supabase Storage bucket:

- `brand-check-images`.

Path đề xuất:

```txt
brand-check-images/{year}/{month}/{branch_or_unit}/{brand_check_id}/{original_filename}
```

Lưu ý:

- Không public toàn bộ bucket nếu dữ liệu nội bộ.
- Dùng signed URL khi hiển thị ảnh.
- Giới hạn file upload: JPG, PNG, WEBP.
- Dung lượng đề xuất: tối đa 10MB/ảnh cho MVP.

---

## 12. UI screens cần code

### 12.1. Upload Check Page

Route:

```txt
/brand-check/new
```

Thành phần:

- Header: `AI Brand Safety Checker`.
- Upload box drag & drop.
- Preview ảnh.
- Form metadata.
- Checklist quick flags.
- Button: `Kiểm tra thương hiệu`.
- Loading state: `Đang phân tích hình ảnh...`.

### 12.2. Result Detail Page

Route:

```txt
/brand-check/:id
```

Hiển thị:

- Ảnh preview.
- Status badge.
- Tổng điểm.
- Kết luận ngắn.
- Bảng tiêu chí.
- Lỗi phát hiện.
- Gợi ý chỉnh sửa.
- Rule override nếu có.
- Manual review panel cho Media.

### 12.3. History Page

Route:

```txt
/brand-check/history
```

Hiển thị:

- Table danh sách lượt kiểm.
- Filter theo chi nhánh/phòng ban.
- Filter theo status.
- Filter theo nhóm nội dung.
- Search theo title/uploader.
- Click mở detail.

### 12.4. Dashboard Page

Route:

```txt
/brand-check/dashboard
```

Cards:

- Tổng lượt kiểm.
- Tỷ lệ Đạt.
- Tỷ lệ Cần chỉnh sửa.
- Tỷ lệ Không đạt.
- Số nội dung bắt buộc Media duyệt.
- Top lỗi thường gặp.
- Top chi nhánh/phòng ban có nhiều lỗi.

Charts:

- Status distribution.
- Checks by unit.
- Criteria failure frequency.
- Trend theo thời gian.

### 12.5. Settings Page

Route:

```txt
/brand-check/settings
```

Cho Admin chỉnh:

- Điểm tối đa từng tiêu chí.
- Rule override.
- Brand colors.
- Checklist text.
- Danh mục usage purpose/channel.

---

## 13. Frontend component đề xuất

```txt
src/
  modules/
    brand-check/
      pages/
        BrandCheckNewPage.tsx
        BrandCheckDetailPage.tsx
        BrandCheckHistoryPage.tsx
        BrandCheckDashboardPage.tsx
        BrandCheckSettingsPage.tsx
      components/
        ImageUploadDropzone.tsx
        BrandCheckForm.tsx
        BrandCheckResultCard.tsx
        CriteriaScoreTable.tsx
        StatusBadge.tsx
        ManualReviewPanel.tsx
        RiskGroupBadge.tsx
        DashboardSummaryCards.tsx
        FailureFrequencyChart.tsx
      services/
        brandCheckApi.ts
        aiReviewApi.ts
      types/
        brandCheck.types.ts
      utils/
        scoreRules.ts
        statusRules.ts
        formatters.ts
```

---

## 14. Backend/API đề xuất

Tùy stack hiện tại, có thể làm theo 1 trong 2 hướng.

### Option A — Nếu dùng React/Vite riêng + Supabase + serverless API

- Frontend: Vite + React + TypeScript + Tailwind.
- Database: Supabase PostgreSQL.
- Storage: Supabase Storage.
- AI Vision: OpenAI/Gemini/Claude Vision API thông qua serverless function.
- Deploy: Railway/Vercel/Netlify tùy hệ thống hiện tại.

API routes:

```txt
POST /api/brand-checks
GET /api/brand-checks
GET /api/brand-checks/:id
PATCH /api/brand-checks/:id/manual-review
POST /api/brand-checks/:id/analyze
GET /api/brand-checks/dashboard
```

### Option B — Nếu build trong website hiện tại

- Tạo module riêng `brand-check`.
- Dùng auth/role hiện tại.
- Tích hợp menu cho Media/Admin/Branch Reviewer.
- Dùng database hiện tại nếu đã có Supabase.
- Giữ module độc lập để sau này mở rộng.

---

## 15. AI output JSON schema

AI bắt buộc trả JSON đúng format sau:

```json
{
  "overall_score": 82,
  "status": "NEEDS_REVISION",
  "risk_group_recommendation": "group_2_self_check",
  "requires_media_review": false,
  "summary": "Hình ảnh cơ bản phù hợp nhưng cần kiểm tra lại vị trí logo và text trong ảnh.",
  "criteria": [
    {
      "code": "logo_identity",
      "name": "Logo & nhận diện CB Centres",
      "status": "warning",
      "score": 18,
      "max_score": 25,
      "findings": "Có logo nhưng kích thước nhỏ và chưa rõ chi tiết.",
      "recommendation": "Thay bằng file logo chuẩn, tăng độ rõ và đặt ở vùng an toàn."
    },
    {
      "code": "brand_color",
      "name": "Màu sắc thương hiệu",
      "status": "pass",
      "score": 14,
      "max_score": 15,
      "findings": "Màu đỏ gần với tinh thần thương hiệu.",
      "recommendation": "Giữ màu chính, tránh thêm màu lệch brand."
    }
  ],
  "detected_issues": [
    "Logo hơi nhỏ và chưa đủ rõ",
    "Một số text phụ khó đọc"
  ],
  "required_actions": [
    "Thay logo bằng file chuẩn",
    "Kiểm tra lại text trước khi đăng"
  ],
  "override_rules_triggered": [],
  "confidence": "medium"
}
```

---

## 16. AI System Prompt kiểm duyệt ảnh

Dùng prompt này trong API server, không để lộ trực tiếp ở frontend.

```txt
You are the AI Brand Safety Reviewer for CB Centres, an English education system in Vietnam.

Your task is to review an uploaded image and evaluate whether it is safe and appropriate to use under CB Centres brand guidelines.

Brand context:
- Brand name: CB Centres.
- Primary color: CB Red #BA110F.
- Secondary color: CB Navy/Blue #191970 when appropriate.
- Common supporting colors: white, warm light gray, dark charcoal gray, subtle gold accent.
- Brand style: professional, clean, premium education brand, trustworthy, family-friendly, suitable for students, parents, teachers, and school partners.
- Logo must never be AI-generated, distorted, misspelled, converted into random text, stretched, blurred, or recolored incorrectly.
- AI-generated images must not misrepresent fake students, fake teachers, fake facilities, fake events, or fake partnerships as real CB Centres activities.
- Mascot Cici and CB uniforms are sensitive brand assets and should be flagged when used publicly.

You must inspect:
1. Logo presence and correctness.
2. Brand colors and visual style.
3. Text readability, spelling, brand name accuracy, and AI-generated gibberish.
4. AI artifacts in faces, hands, body, clothing, signs, classroom objects, and background.
5. Suitability for an education environment.
6. Risk of misleading viewers into believing an AI image is a real CB Centres event, student, teacher, branch, classroom, or partner activity.
7. Whether the image should require Media team approval.

Important decision rules:
- If the image contains a distorted or incorrect CB logo, mark as FAIL or REQUIRES_MEDIA_REVIEW.
- If the image uses CB logo, mascot Cici, CB uniform, CB branch/facility, recruitment/admission, promotion, partner/school, certificate, tuition fee, test/exam/certificate claim, or campaign-level message, set requires_media_review = true.
- If the image contains sensitive, inappropriate, unsafe, or non-education-friendly content, mark as FAIL.
- If text is unreadable, misspelled, or looks like AI gibberish, flag it clearly.
- If you are unsure, be conservative and recommend Media review.

Return only valid JSON. Do not include markdown. Do not include explanations outside JSON.

Use this JSON schema:
{
  "overall_score": number,
  "status": "PASS" | "NEEDS_REVISION" | "FAIL" | "REQUIRES_MEDIA_REVIEW",
  "risk_group_recommendation": "group_1_internal" | "group_2_self_check" | "group_3_media_review",
  "requires_media_review": boolean,
  "summary": string,
  "criteria": [
    {
      "code": "logo_identity" | "brand_color" | "text_quality" | "ai_artifacts" | "education_suitability" | "communication_risk",
      "name": string,
      "status": "pass" | "warning" | "fail",
      "score": number,
      "max_score": number,
      "findings": string,
      "recommendation": string
    }
  ],
  "detected_issues": string[],
  "required_actions": string[],
  "override_rules_triggered": string[],
  "confidence": "low" | "medium" | "high"
}
```

---

## 17. User prompt gửi kèm ảnh cho AI Vision

Khi gọi AI, backend nên gửi metadata của người dùng kèm ảnh:

```txt
Please review this image for CB Centres AI Brand Safety.

Usage metadata:
- Title: {{title}}
- Unit/Branch: {{unit_name}} / {{branch_name}}
- Usage purpose: {{usage_purpose}}
- Usage channel: {{usage_channel}}
- Usage group selected by user: {{usage_group}}
- Planned publish date: {{planned_publish_date}}
- Has CB logo: {{has_logo}}
- Has mascot Cici: {{has_mascot}}
- Has CB uniform: {{has_uniform}}
- Has CB facility/classroom/signage: {{has_cb_facility}}
- Is admission/ads/promotion/campaign: {{is_admission_or_ads}}
- Involves partner/school/external organization: {{involves_partner}}
- Contains tuition/certificate/exam/quality commitment or sensitive information: {{contains_sensitive_info}}

Evaluate the image according to the CB Centres brand safety criteria. Be conservative for public-facing content. Return only valid JSON.
```

---

## 18. App rule engine sau khi nhận AI JSON

Không chỉ dùng kết luận của AI. Backend cần chạy thêm rule engine dựa trên metadata.

Pseudo logic:

```ts
function applyOverrideRules(aiResult, metadata) {
  const overrides = [];

  if (metadata.usage_group === 'group_3_media_review') {
    overrides.push('Nội dung thuộc Nhóm 3 - bắt buộc Media duyệt');
  }

  if (metadata.has_mascot && metadata.usage_channel !== 'internal_classroom') {
    overrides.push('Có mascot Cici trong nội dung công khai');
  }

  if (metadata.is_admission_or_ads) {
    overrides.push('Nội dung tuyển sinh/quảng cáo/ưu đãi/chiến dịch');
  }

  if (metadata.involves_partner) {
    overrides.push('Nội dung liên quan đối tác/trường học/đơn vị bên ngoài');
  }

  if (metadata.contains_sensitive_info) {
    overrides.push('Nội dung có thông tin nhạy cảm/học phí/chứng chỉ/cam kết');
  }

  const logoCriterion = aiResult.criteria.find(c => c.code === 'logo_identity');
  if (logoCriterion?.status === 'fail') {
    overrides.push('Logo/nhận diện CB không đạt');
  }

  if (overrides.length > 0) {
    return {
      ...aiResult,
      status: 'REQUIRES_MEDIA_REVIEW',
      requires_media_review: true,
      override_rules_triggered: [
        ...(aiResult.override_rules_triggered || []),
        ...overrides
      ]
    };
  }

  return aiResult;
}
```

---

## 19. Visual/UI direction

Thiết kế nên theo style nội bộ CB Creative Flow:

- Clean, corporate, dễ dùng.
- Background trắng/light gray.
- Accent CB Red `#BA110F`.
- Font: Montserrat hoặc Inter.
- Không quá nhiều hiệu ứng.
- Dashboard rõ ràng, ưu tiên thao tác nhanh.
- Badge trạng thái dễ nhận biết.

Status badge:

- PASS: xanh lá.
- NEEDS_REVISION: vàng/cam.
- FAIL: đỏ.
- REQUIRES_MEDIA_REVIEW: tím hoặc đỏ đậm.

---

## 20. Acceptance criteria cho MVP

MVP được xem là đạt khi:

1. Người dùng upload được ảnh JPG/PNG/WEBP.
2. App lưu ảnh vào storage.
3. App gửi ảnh sang AI Vision API để phân tích.
4. App nhận JSON hợp lệ từ AI.
5. App chạy override rule engine.
6. App hiển thị điểm số, kết luận, lỗi, gợi ý chỉnh sửa.
7. App lưu kết quả vào database.
8. Người dùng xem lại lịch sử kiểm duyệt.
9. Media xem được dashboard tổng quan.
10. Media cập nhật được trạng thái review thủ công.
11. Có filter theo chi nhánh, trạng thái, nhóm nội dung, ngày.
12. Có export CSV dữ liệu kiểm duyệt.

---

## 21. Prompt tổng gửi Claude/Dev code

Copy toàn bộ prompt dưới đây gửi Claude/Dev:

```txt
Bạn là senior full-stack developer. Hãy code một module/app tên “CB AI Brand Safety Checker” để kiểm duyệt hình ảnh AI theo tiêu chí thương hiệu CB Centres.

Bối cảnh:
CB Centres là hệ thống giáo dục tiếng Anh tại Việt Nam. Hiện tại các phòng ban, chi nhánh và giáo viên đang sử dụng AI tạo ảnh tràn lan, gây lỗi thương hiệu như sai logo, logo bị AI biến thành text, sai màu thương hiệu, ảnh không có logo, lỗi tay/mặt/text, hình ảnh dễ gây hiểu nhầm là hoạt động thật của CB Centres. Phòng Media cần một app để kiểm tra ban đầu, phân tầng rủi ro, trả kết quả Đạt/Không đạt/Cần chỉnh sửa/Bắt buộc gửi Media duyệt và lưu dữ liệu đối chứng.

Tech stack đề xuất:
- Frontend: Vite + React + TypeScript + Tailwind CSS.
- Backend/API: serverless API hoặc Node/Express tùy cấu trúc project hiện tại.
- Database: Supabase PostgreSQL.
- Storage: Supabase Storage.
- AI Vision: tạo abstraction service để gọi OpenAI/Gemini/Claude Vision API qua environment variables. Không hard-code API key.

Yêu cầu chức năng MVP:
1. Trang upload ảnh kiểm duyệt.
2. Form metadata gồm:
   - title
   - unit_name
   - branch_name
   - usage_purpose
   - usage_channel
   - usage_group: group_1_internal, group_2_self_check, group_3_media_review
   - planned_publish_date
   - has_logo
   - has_mascot
   - has_uniform
   - has_cb_facility
   - is_admission_or_ads
   - involves_partner
   - contains_sensitive_info
3. Upload ảnh JPG/PNG/WEBP, tối đa 10MB.
4. Lưu ảnh vào Supabase Storage bucket `brand-check-images`.
5. Gửi ảnh + metadata sang AI Vision API để phân tích theo checklist thương hiệu CB Centres.
6. AI phải trả JSON theo schema:
{
  "overall_score": number,
  "status": "PASS" | "NEEDS_REVISION" | "FAIL" | "REQUIRES_MEDIA_REVIEW",
  "risk_group_recommendation": "group_1_internal" | "group_2_self_check" | "group_3_media_review",
  "requires_media_review": boolean,
  "summary": string,
  "criteria": [
    {
      "code": "logo_identity" | "brand_color" | "text_quality" | "ai_artifacts" | "education_suitability" | "communication_risk",
      "name": string,
      "status": "pass" | "warning" | "fail",
      "score": number,
      "max_score": number,
      "findings": string,
      "recommendation": string
    }
  ],
  "detected_issues": string[],
  "required_actions": string[],
  "override_rules_triggered": string[],
  "confidence": "low" | "medium" | "high"
}
7. Backend phải chạy override rule engine sau khi nhận AI result:
   - Nếu usage_group = group_3_media_review => status = REQUIRES_MEDIA_REVIEW.
   - Nếu has_mascot = true và không phải nội bộ => REQUIRES_MEDIA_REVIEW.
   - Nếu is_admission_or_ads = true => REQUIRES_MEDIA_REVIEW.
   - Nếu involves_partner = true => REQUIRES_MEDIA_REVIEW.
   - Nếu contains_sensitive_info = true => REQUIRES_MEDIA_REVIEW.
   - Nếu tiêu chí logo_identity fail => REQUIRES_MEDIA_REVIEW.
8. Lưu record vào bảng `brand_checks`.
9. Lưu từng tiêu chí vào bảng `brand_check_criteria`.
10. Trang kết quả chi tiết hiển thị:
   - ảnh preview
   - điểm tổng
   - status badge
   - summary
   - bảng tiêu chí
   - lỗi phát hiện
   - hành động cần làm
   - rule override triggered
   - manual review panel cho Media/Admin
11. Trang lịch sử kiểm duyệt:
   - table danh sách
   - filter theo status, usage_group, branch_name, unit_name, date range
   - search theo title/uploader
12. Dashboard Media:
   - tổng lượt kiểm
   - tỷ lệ PASS/NEEDS_REVISION/FAIL/REQUIRES_MEDIA_REVIEW
   - số ảnh theo chi nhánh/phòng ban
   - top lỗi thường gặp theo criteria fail/warning
   - trend theo ngày/tháng
13. Manual review:
   - Media/Admin có thể update manual_status: PENDING, APPROVED, REVISION_REQUIRED, REJECTED, ARCHIVED
   - manual_note
   - reviewed_at
14. Export CSV từ history/dashboard.
15. UI clean, corporate, dùng CB Red #BA110F làm accent, font Inter hoặc Montserrat.

Database schema cần tạo:
- users
- brand_checks
- brand_check_criteria
- audit_logs

Hãy tạo code theo cấu trúc rõ ràng:
src/modules/brand-check/pages
src/modules/brand-check/components
src/modules/brand-check/services
src/modules/brand-check/types
src/modules/brand-check/utils

Yêu cầu kỹ thuật:
- TypeScript strict types.
- Không hard-code secret/API key.
- Có env example.
- Có error handling khi AI trả JSON lỗi.
- Có loading states.
- Có empty states.
- Có validation upload file.
- Có fallback nếu AI lỗi: lưu trạng thái NEEDS_MANUAL_REVIEW hoặc REQUIRES_MEDIA_REVIEW.
- Có comment rõ các phần cần thay API provider.

AI System Prompt cần dùng trong backend:
[Paste phần “AI System Prompt kiểm duyệt ảnh” từ tài liệu planning]

Hãy trả về:
1. Cấu trúc folder.
2. SQL migration cho Supabase.
3. Các component chính.
4. Service gọi AI Vision.
5. Rule engine.
6. UI pages.
7. Hướng dẫn chạy local.
```

---

## 22. Gợi ý triển khai theo phase

### Phase 1 — MVP kiểm tra ảnh đơn

- Upload ảnh.
- AI đánh giá.
- Rule engine.
- Lưu log.
- Result detail.
- History cơ bản.

### Phase 2 — Dashboard & hậu kiểm

- Dashboard tổng quan.
- Filter nâng cao.
- Manual review.
- Export CSV.
- Top lỗi thường gặp.

### Phase 3 — Tích hợp hệ thống CB Creative Flow

- Gắn vào menu hệ thống hiện tại.
- Đồng bộ user/role.
- Gắn với order/task nếu cần.
- Cho phép gửi trực tiếp request về Media nếu app báo `REQUIRES_MEDIA_REVIEW`.

### Phase 4 — Nâng cấp thông minh

- Upload nhiều ảnh cùng lúc.
- So sánh trước/sau chỉnh sửa.
- Gợi ý prompt chỉnh sửa ảnh.
- Thư viện lỗi mẫu.
- Tự tạo báo cáo tuân thủ theo tháng/quý.

---

## 23. Lưu ý quan trọng khi triển khai

1. App không thay thế quyền duyệt cuối của Media đối với nội dung rủi ro cao.
2. AI có thể sai, nên kết quả cần có confidence và lưu log.
3. Không đưa brand asset gốc lên các AI tool không kiểm soát nếu chưa được phép.
4. Với nội dung công khai, nếu không chắc chắn, luôn chuyển về Media duyệt.
5. Cần đào tạo chi nhánh/phòng ban cách đọc kết quả app để tránh hiểu nhầm “AI báo Đạt là được đăng mọi trường hợp”.

---

## 24. Output mong muốn sau khi dev hoàn thành

Dev cần bàn giao:

- Source code app/module.
- SQL migration.
- ENV example.
- README hướng dẫn cài đặt.
- Danh sách API routes.
- Hướng dẫn kết nối AI Vision provider.
- Video/screenshot demo flow upload → check → result → history → dashboard.
- Tài khoản demo Admin/Reviewer/Staff nếu có auth riêng.
