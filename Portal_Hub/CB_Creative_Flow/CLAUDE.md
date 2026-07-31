# CLAUDE.md — RULES khi làm việc trên CB Creative Flow

> File luật bắt buộc cho mọi agent/dev sửa project này. Đặt tên `CLAUDE.md` vì
> Claude Code tự nạp file này khi làm việc trong thư mục — đổi tên khác thì
> không được đọc tự động.
>
> Luật gốc (2026-07-31): **KHÔNG ĐOÁN. Kiểm tra tới khi chắc chắn đúng rồi mới làm.**

---

## 0. Luật số 1 — Không đoán

Mọi thứ dưới đây đều là **kiểm tra trước, viết code sau**:

```text
- Tên bảng / tên cột / tên constraint / giá trị enum trong CHECK
- Tên hàm, tên biến, chữ ký API (store.x.update vs upsert…)
- Tên id DOM, tên class CSS
- Ai gọi hàm này, hàm này chạy trong luồng load nào
- Role nào đọc/ghi được (RLS), quyền frontend có khớp RLS không
```

Cách kiểm: `Grep` file schema/migration gốc + `Read` đúng đoạn code. **Không suy
từ tên "nghe hợp lý"**.

Bằng chứng vì sao có luật này (2026-07-31, cùng 1 buổi):

| Đoán | Thực tế | Hậu quả |
|---|---|---|
| `content_task_comments.task_id` | `content_task_id` | SQL lỗi `42703`, **rollback cả file migration** |
| `content_tasks.priority` có `critical` | CHECK chỉ `low/normal/high/urgent` | insert subtask sẽ fail CHECK khi order ưu tiên "Rất gấp" |

Nếu không kiểm tra được (không có quyền, không chạy được): **nói rõ là chưa
verify được** + nêu cách user tự kiểm. Không viết "đã xong" cho phần chưa chứng minh.

---

## 1. Quy trình bắt buộc mỗi task

```text
1. Đọc README.md + _hot.md + STATUS.md (phần "Last updated" chứa state mới nhất).
2. Grep/Read code + schema liên quan → xác nhận mọi tên/giá trị sẽ dùng.
3. Sửa code.
4. Verify (mục 2) — lặp tới khi sạch lỗi.
5. Dọn file tạm.
6. Cập nhật _hot.md + STATUS.md (+ README nếu đổi file map / role / migration).
```

---

## 2. Verify — công cụ có sẵn trên máy này

**KHÔNG có Node, KHÔNG có Python thật** (chỉ có stub WindowsApps). Có **Chrome** +
**PowerShell**. Cách verify đã dùng được:

**2.1 Syntax check JS** — harness fetch file rồi `new Function(src)` (compile-only):

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --allow-file-access-from-files --virtual-time-budget=5000 --dump-dom "file:///<harness>.html"
```

**2.2 Test chạy thật (thay cho CDP)** — copy trang thật ra `_<ten>-test.html` trong
cùng thư mục (để path asset tương đối còn đúng), rồi **chèn trước `assets/config.js`**:

```html
<script>
  localStorage.setItem('mh-user', JSON.stringify({id:'u', name:'T', role:'lead_media'}));
  localStorage.setItem('mh-submitted-orders', JSON.stringify([ /* seed */ ]));
  window.__ERRS=[]; window.addEventListener('error',e=>window.__ERRS.push(e.message));
</script>
<script src="assets/config.js"></script>
<script>window.MH_CONFIG.FEATURES.SUPABASE_DB=false; window.MH_CONFIG.SUPABASE_URL='';</script>
```

rồi chèn 1 `<script>` cuối trang, sau ~2.5s dump kết quả vào `<pre id="TESTREPORT">`
và đọc bằng `--dump-dom`. **Luôn assert `__ERRS` rỗng.**

**2.3 Truth-table cho logic thuần** (routing, gate, filter): load `app.js` rồi
assert bảng case → in `PASS/FAIL` + `fails=N`. Rẻ và bắt được lỗi thật.

**2.4 Giới hạn đã biết**: `database-orders.js` đặt `window.MH_MOCK_ORDERS = ORDERS`
(mảng rỗng) nên **không seed data vào trang đó qua localStorage được** khi Supabase
off → verify logic của nó bằng truth-table (2.3), không cố drive DOM.

**2.5 Dọn dẹp**: xoá mọi file `_*-test.html` / `_smoke-*.html` sau khi verify.
Thư mục chỉ được còn đúng **5 file `_*.html` gốc** (`_gsap-demo`, `_index-gsap-demo`,
`_notif-preview`, `_preview-revision`, `_review-preview`).

---

## 3. Luật SQL / migration

```text
- Đọc migration gốc định nghĩa bảng TRƯỚC khi viết policy/column mới.
- Mọi giá trị ghi vào cột có CHECK phải đối chiếu đúng danh sách enum trong CHECK.
- Migration phải idempotent (ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS…).
- Supabase SQL Editor chạy CẢ FILE trong 1 transaction → lỗi ở dòng cuối
  ROLLBACK toàn bộ. Đừng giả định "phần trên đã chạy rồi".
- Bảng có thể chưa migrate ở DB người dùng → bọc `to_regclass(...) IS NOT NULL`.
- Thêm cột mới cho `orders`/`content_tasks` → thêm tên cột vào allowlist
  `optionalMissingColumn` trong `assets/data-store.js` (loop-strip PGRST204).
- Thêm bảng data mới → NHỚ thêm vào mảng `tables` của `supabase/clear-demo.sql`.
```

---

## 4. Luật RLS / quyền

```text
- Frontend guard KHÔNG thay được RLS: kiểm role nào thực sự có SELECT/UPDATE
  trong file rls.sql + các add-*.sql trước khi viết đường ghi.
- Role KHÔNG có UPDATE trên bảng đích → ĐỌC XUÔI (đọc trạng thái từ bảng bên kia),
  đừng ghi ngược: RLS khớp 0 dòng KHÔNG throw, nó trả null → fail IM LẶNG.
- Mọi mutation quan trọng: GHI DB TRƯỚC → verify row trả về → RỒI MỚI notify/toast
  success. (Bài học "noti ma": noti bắn mà đơn không đổi trạng thái.)
- Producer notification chạy trong phiên client/role hẹp → dùng RPC
  `notify_roles` (SECURITY DEFINER), không lookup `users` trực tiếp.
```

---

## 5. Luật frontend

```text
- Thêm nguồn dữ liệu mới vào một view → phải gọi renderer đó trong ĐÚNG luồng load
  của nguồn đó. (Bug thật: tab "Tất cả" hiện 0/0 vì loadContentData không gọi
  renderList, trong khi badge tab đếm đủ.)
- Logic dùng ở ≥2 trang → đặt vào `assets/app.js` (`window.MH.*`) làm nguồn sự thật
  duy nhất; KHÔNG copy 3 bản (nguồn sinh lệch luồng).
- Icon = inline SVG kiểu Lucide (`currentColor`). KHÔNG emoji trang trí. Ngoại lệ:
  `⚠` cảnh báo trễ hạn + emoji trong title notification.
- Zero-build: vanilla ES, không framework/bundler. Mở file .html là chạy.
- Đổi UI/flow → rà cross-role + mọi surface dùng chung (dashboard, calendar, filter,
  notification, CSV) rồi sửa hoặc cảnh báo, đừng để user tự phát hiện từng mảnh.
- Nhãn hiển thị phải phân biệt được team khi 2 hệ dùng chung 1 từ
  (vd "Task nội bộ **Content**" vs "task **Media**") — chuông + calendar là surface chung.
```

**Role mới muốn thấy 1 mục UI → phải rà ĐỦ 4 lớp** (thiếu 1 lớp là không hiện,
đã vấp 2026-07-31 với Calendar của `lead_media`):

```text
1. Danh sách role trong hàm inject JS (vd injectCalendarNav → mảng `internal`)
2. Attribute `data-show-roles` gắn lên phần tử
3. CSS reveal CHUNG: body[data-user-role="X"] [data-show-roles*="X"]
4. CSS reveal RIÊNG theo component (vd `.cal-chip`, `.kpi`, `.qa-btn`, `.dash-card`)
   → block riêng thường đứng SAU và CÙNG specificity nên THẮNG reveal chung.
5. Kèm theo: cờ phân quyền trong JS của trang đó (vd calendar.js IS_FULL) — thiếu
   thì vào được trang nhưng mất event/nút/link (fail âm thầm, không có lỗi console).
```

---

## 6. Docs / handoff

```text
- Sau mỗi task: cập nhật _hot.md (architecture/convention/quirk) + STATUS.md
  (module/file/progress). README khi đổi file map, role, danh sách migration.
- Ghi rõ trong docs: đã verify cái gì bằng cách nào, và cái gì CHƯA verify được.
- Ghi lại "bẫy" đã vấp (schema, RLS, thứ tự render) — đó là phần giá trị nhất
  cho người tiếp quản.
```
