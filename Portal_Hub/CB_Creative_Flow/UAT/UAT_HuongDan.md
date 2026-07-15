# UAT CB Creative Flow — Hướng dẫn test cho nhân sự

> Đợt test nội bộ trước khi dùng thật. Mỗi người login **Gmail công ty @cbcentres.com**, làm theo kịch bản trong Google Sheet (import từ `UAT_TestPlan.csv`) và ghi kết quả.

---

## 0. PRE-FLIGHT — Admin làm TRƯỚC khi mời team vào (checklist cho anh Jett)

Chạy trên Supabase Dashboard → SQL Editor, theo thứ tự:

1. **Xác nhận migration pending đã chạy** (thiếu là flow tương ứng chết im lặng):
   - `add-notify-roles-rpc.sql` — noti client→staff (thiếu → staff KHÔNG nhận noti khi client gửi order/rating)
   - `add-content-self-initiative.sql` — content tự đề xuất task (case 47)
   - `add-content-review-sla.sql` — SLA Lead duyệt (case 22–23)
   - `enable-realtime.sql` — noti realtime (case 76)
   - `add-google-sso-cbcentres.sql` — bảng `user_role_map` + trigger (bắt buộc cho SSO)
   - Kiểm nhanh:
     ```sql
     SELECT proname FROM pg_proc WHERE proname IN ('notify_roles','append_lead_content_order_note','handle_new_auth_user');
     SELECT to_regclass('public.user_role_map'), to_regclass('public.content_tasks'), to_regclass('public.brand_checks'), to_regclass('public.lead_tasks');
     ```
     Kết quả nào NULL/thiếu → chạy file SQL tương ứng.
2. **Google SSO sẵn sàng**: Supabase Auth → Providers → Google đã bật; OAuth Client trên Google Cloud (app Internal, domain cbcentres.com) đã cấu hình.
3. **Seed roster**: mở `supabase/seed-user-role-map.sql` → điền email công ty thật + role + TÊN (tên phải khớp tuyệt đối tên dùng gán PIC) → Run.
4. **RESET DATA**: chạy `supabase/clear-demo.sql` (bản v2) → query verify cuối file phải ra **0** hết (trừ `users_kept`).
5. Edge Functions (optional, chỉ cần nếu test case tương ứng):
   - `brand-check-analyze` deployed + secret API key → nhóm F5. Chưa deploy → kết quả fallback "chờ duyệt tay", vẫn test được luồng hậu kiểm.
   - `notify-email` deployed + Database Webhook bảng `orders` → case 17, 37 phần email. Chưa deploy → bỏ qua 2 case email.
6. Mở app bằng `admin@cb.vn` → xác nhận mọi trang empty-state sạch, chuông noti trống, console không lỗi.

---

## 1. Nhân sự — trước khi test (làm 1 lần)

1. **Xóa site data của browser cho domain app** (quan trọng — dọn localStorage demo cũ):
   - Chrome: F12 → tab **Application** → **Storage** → **Clear site data**. Hoặc dùng cửa sổ ẩn danh/profile mới.
   - Lý do: máy từng mở bản demo còn sót `mh-user`, `mh-extra-tasks`, `mh-content-seed-v1`, `mh-brand-checks`, draft cũ… gây hiển thị data ma.
2. Mở **[link app — anh Jett điền URL Railway]** → **Đăng nhập** → nút **"Đăng nhập với Gmail công ty"** → chọn email @cbcentres.com.
3. Kiểm tra vào đúng trang theo vai trò của mình (case 1–8). Sai role/tên → báo anh Jett ngay (sửa `user_role_map` + sync).

## 2. Cách điền Google Sheet

- Anh Jett import `UAT_TestPlan.csv` vào 1 Google Sheet chung (File → Import → Upload), share cho cả team.
- Mỗi case: làm đúng cột **Bước thực hiện**, so với **Kết quả mong đợi**, điền:
  - **Kết quả**: `Pass` / `Fail` / `Blocked` (không làm được vì bị chặn bởi lỗi khác — ghi rõ chặn bởi case nào)
  - **Mức độ lỗi** (chỉ khi Fail):
    - `Critical` — mất data, không login được, flow chính đứt (không gửi được order, không push được production)
    - `Major` — chức năng sai/thiếu noti nhưng có đường vòng
    - `Minor` — UI lệch, chữ sai, không chặn công việc
  - **Ghi chú + link ảnh**: mô tả ngắn *làm gì → thấy gì → mong đợi gì* + **chụp màn hình** (upload Drive, dán link). Lỗi không có ảnh/bước tái hiện = rất khó fix.
  - **Người test + Ngày**: để anh Jett hỏi lại khi cần.
- Case cần 2 vai (VD client gửi → account nhận): phối hợp 2 người hoặc dùng 2 browser/profile.

## 3. Kế hoạch test đề xuất (3 vòng)

| Vòng | Thời gian | Nội dung |
|---|---|---|
| **1 — Smoke** | Ngày 1 | Cả team login (F0), mỗi người đi hết menu theo role mình, bấm thử mọi trang. Mục tiêu: không ai bị chặn login/vỡ trang. |
| **2 — Kịch bản** | Ngày 2–4 | Chạy F1→F6 theo Sheet, **phân vai đúng role thật** (Account thật đóng Account, Content thật đóng Content…), 1 người đóng client (dùng `client@cb.vn`). Chạy F1 trọn vẹn ít nhất 2 lần: 1 order design + 1 order Quay/Chụp. |
| **3 — Free test** | Ngày 5 | Test phá: nhập liệu lạ/dài/emoji, double-click nút, mở 2 tab cùng lúc, back/forward, mobile, dark mode, để idle 30 phút rồi thao tác tiếp. Ghi bug ngoài kịch bản vào cuối Sheet (thêm dòng, Nhóm = `Free`). |

**Triage cuối mỗi ngày**: anh Jett lọc cột Kết quả = Fail, sắp theo mức độ → gom Critical/Major đưa agent fix theo batch → hôm sau re-test các case Fail trước khi test tiếp.

## 4. Phân vai gợi ý (tối thiểu 6 người)

| Người | Role test | Phụ trách nhóm case |
|---|---|---|
| 1 | admin | F0, F6 Cross (72–78), điều phối triage |
| 2 | account | F1 (13–38) phía Account |
| 3 | lead_content + content (2 email) | F1 wording, F2, F3 |
| 4 | design/editor | F1 production (26–35), F6 (65–66) |
| 5 | lead_media + system_supervisor | F4, F6 (69–70) |
| 6 | client (`client@cb.vn`) | F1/F2 phía client, F5 (62), F6 (71) |

Ít người hơn → 1 người ôm nhiều role, dùng nhiều browser profile.

## 5. Quy tắc chung

- **Đây là môi trường test** — data sẽ được xóa lại sau đợt UAT, cứ mạnh dạn tạo/hủy.
- Đặt tên order/task test có tiền tố dễ lọc: `[UAT] ...`.
- Gặp lỗi lạ → F12 → tab Console → chụp cả lỗi đỏ kèm vào report.
- Không sửa dòng của người khác trong Sheet.
