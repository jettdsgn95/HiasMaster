# CB Creative Flow — New Order Email Notification Implementation Brief

> **Mục đích:** tài liệu bàn giao bắt buộc để Dev/Claude triển khai chức năng gửi email thông báo khi có **đơn mới từ Client** trong CB Media Hub theo đúng kiến trúc hiện tại, có chế độ TEST trước khi bật LIVE, chống gửi trùng và không fail âm thầm.
>
> **Repo:** `jettdsgn95/HiasMaster`
>
> **Project path:** `Portal_Hub/CB_Creative_Flow/`
>
> **Ngày chốt brief:** 2026-08-11
>
> **Scope P0:** chỉ email cho sự kiện **Client tạo Order mới**. Không mở rộng email sang status/PIC/deadline/preview/final/rating ở đợt này.

---

## 0. QUY TẮC BẮT BUỘC CHO DEV / CLAUDE

Trước khi sửa bất kỳ file nào, **BẮT BUỘC** thực hiện đúng thứ tự:

1. Đọc `CLAUDE.md`.
2. Đọc `README.md`.
3. Đọc `_hot.md`.
4. Đọc `STATUS.md`.
5. Đọc code thật của:
   - `assets/order-form.js`
   - `supabase/add-notify-roles-rpc.sql`
   - `supabase/functions/notify-email/index.ts`
   - `.env.example`
6. Kiểm tra schema/migration `orders` và mọi enum/CHECK có liên quan trước khi viết SQL.
7. Không đoán tên cột, role, status, payload webhook, route deep-link hoặc quyền RLS.
8. Không thay đổi flow in-app notification đang hoạt động nếu không cần thiết.
9. Mọi mutation quan trọng phải: **ghi/claim thành công → verify → mới gửi email/toast success**.
10. Không được báo “DONE” nếu chưa chạy đủ test matrix ở cuối tài liệu.

**Luật cứng:** nếu thực tế code/schema khác tài liệu này, dừng và ghi rõ khác biệt; ưu tiên source code/schema hiện tại, sau đó cập nhật brief/docs cho khớp. Không tự suy đoán rồi tiếp tục.

---

# 1. TÌNH TRẠNG HIỆN TẠI — ĐÃ XÁC NHẬN TỪ REPO

## 1.1. Flow tạo Order hiện tại

Flow Client tạo yêu cầu hiện đang là:

```text
Client submit request
    ↓
assets/order-form.js
    ↓
MH.store.orders.create(row)
    ↓
Supabase INSERT public.orders
    ↓
Song song 2 kênh thông báo
```

### Kênh A — In-app notification

`order-form.js` đang gọi RPC `notify_roles` để báo:

```text
admin
account
lead_media
```

RPC `notify_roles` là `SECURITY DEFINER`, lookup `public.users` trong DB và chỉ gửi tới user có:

```text
status = 'active'
```

**Kết luận:** luồng chuông notification in-app đã có kiến trúc đúng. Không thay nó bằng email và không quay lại lookup `users` trực tiếp từ phiên Client.

---

## 1.2. Email Edge Function đã tồn tại

File hiện có:

```text
supabase/functions/notify-email/index.ts
```

Function hiện hỗ trợ 2 event:

1. `INSERT orders` → email “Order mới từ client”.
2. `UPDATE orders` khi `satisfaction_score` chuyển `NULL → value` → email rating.

Function hiện đã loại trừ order nội bộ bằng các điều kiện:

```text
client_visible === false
order_kind === 'internal_media_request'
order_kind === 'internal_ads_media_request'
```

Ads Order client-visible được nhận diện riêng và deep-link tới Content Team.

---

## 1.3. Kiến trúc email hiện tại

Thiết kế đang có trong repo:

```text
public.orders INSERT/UPDATE
        ↓
Supabase Database Webhook
        ↓
Edge Function notify-email
        ↓
Resend API
        ↓
Email recipient
```

Đây là kiến trúc cần **GIỮ NGUYÊN**.

**Không được chuyển việc gửi email sang frontend `order-form.js`** vì:

- API key sẽ có nguy cơ lộ ở client.
- browser/tab đóng có thể làm email fail.
- khó retry.
- frontend không phải source of truth cho việc Order đã thực sự được ghi vào DB.

---

## 1.4. Các thiếu sót hiện tại cần xử lý

### P0-1 — Chưa có TEST MODE an toàn

Code hiện dùng trực tiếp:

```text
NOTIFY_EMAIL_TO
```

Chưa có cơ chế khóa cứng “test chỉ được gửi về email test”.

**Rủi ro:** trong UAT có thể gửi nhầm tới mailbox production.

### P0-2 — Chưa có idempotency / chống gửi trùng

Nếu webhook retry hoặc cùng payload được gọi nhiều lần, function hiện có khả năng gửi email lặp.

### P0-3 — Provider error vẫn có thể trả HTTP 200

Logic hiện tại trả JSON `ok:false` nhưng status HTTP vẫn có thể là `200` khi Resend lỗi.

**Rủi ro:** webhook hiểu request hoàn thành, không retry; lỗi bị “nuốt”.

### P0-4 — Scope đang rộng hơn yêu cầu hiện tại

Function có cả rating email. Đợt này chỉ yêu cầu **Order mới**.

Không cần xóa code rating; phải gate bằng event config và mặc định P0 chỉ bật `new_order`.

### P0-5 — Chưa có log gửi email chuẩn để audit

Chưa có nguồn dữ liệu đáng tin để trả lời:

- event nào đã gửi?
- gửi cho ai?
- provider message id là gì?
- gửi lúc nào?
- lỗi gì?
- đã retry bao nhiêu lần?

---

# 2. MỤC TIÊU ĐẦU RA — DEFINITION OF DONE

Chỉ được coi task hoàn tất khi đạt **TOÀN BỘ** các điều kiện sau:

1. Client tạo Order mới thành công trong DB.
2. In-app notification cho `admin/account/lead_media` không regression.
3. Database Webhook gọi `notify-email` sau khi Order thực sự được INSERT.
4. `NOTIFY_EMAIL_MODE=test` → email **chỉ** gửi tới `NOTIFY_EMAIL_TEST_TO`.
5. Trong TEST mode, giá trị `NOTIFY_EMAIL_TO` tuyệt đối không được dùng làm recipient.
6. `NOTIFY_EMAIL_MODE=live` → mới được dùng `NOTIFY_EMAIL_TO`.
7. Internal order không gửi email.
8. Client Ads Order vẫn gửi email và deep-link đúng Ads workspace.
9. Cùng một event bị webhook retry nhiều lần → recipient chỉ nhận tối đa **01 email thành công**.
10. Email provider lỗi → function trả HTTP lỗi phù hợp để hệ thống có thể retry; không false success.
11. Retry sau lỗi provider có thể gửi lại thành công.
12. Có DB log/audit cho trạng thái `processing/sent/failed`.
13. HTML escape mọi dữ liệu lấy từ Order.
14. CTA mở đúng Order tương ứng.
15. Template hiển thị ổn trên Gmail desktop/mobile ở mức email HTML cơ bản.
16. Secrets không xuất hiện trong frontend, Git history hoặc file `.env` commit.
17. `_hot.md` + `STATUS.md` được cập nhật sau khi hoàn tất.
18. `README.md` được cập nhật nếu thay đổi migration/file map/setup email.
19. Không còn file test/harness tạm sau verify.
20. Test matrix §11 = PASS hết, `fails=0`.

---

# 3. PHẠM VI P0 — KHÔNG ĐƯỢC SCOPE CREEP

## Làm trong task này

- Email khi **Client tạo Order mới**.
- Client Ads Order mới.
- TEST/LIVE mode.
- Event enable/disable.
- Email template.
- Deep-link.
- Idempotency.
- Email delivery log.
- Error/retry behavior.
- Webhook security secret.
- Documentation + verification.

## Không làm trong task này

Không tự mở rộng email sang:

```text
order status changed
PIC assigned
Content task assigned
Lead review
Deadline proposed/accepted/rejected
Preview
Feedback
Final delivery
Rating
Brand Safety
Internal Media Request
Strategy Board
```

Rating logic cũ có thể giữ trong function nhưng phải **disabled mặc định** qua config ở P0.

---

# 4. KIẾN TRÚC ĐÍCH

```text
CLIENT
  ↓ submit
order-form.js
  ↓
orders.create()
  ↓
public.orders INSERT  ← SOURCE OF TRUTH
  ↓
  ├── RPC notify_roles → in-app bell (GIỮ NGUYÊN)
  │
  └── Database Webhook: orders INSERT
          ↓
     notify-email Edge Function
          ↓
     Validate secret + payload + event scope
          ↓
     Resolve TEST/LIVE recipients
          ↓
     Build event_key
          ↓
     Atomic claim email log
          ↓
       ┌──────────── already sent/processing ────────────┐
       │                                                  ↓
       │                                                SKIP 200
       ↓
     Resend API
       ↓
   success? ── yes → mark SENT → 200
       │
       no
       ↓
   mark FAILED → 5xx → webhook/provider can retry
```

---

# 5. FILES DỰ KIẾN PHẢI THAY ĐỔI

## Bắt buộc

```text
Portal_Hub/CB_Creative_Flow/
├─ supabase/functions/notify-email/index.ts
├─ supabase/add-email-notification-log.sql         ← NEW
├─ .env.example
├─ _hot.md
├─ STATUS.md
└─ README.md                                       ← nếu migration/setup map đổi
```

## Không sửa nếu không có bằng chứng cần sửa

```text
assets/order-form.js
supabase/add-notify-roles-rpc.sql
assets/app.js
assets/data-store.js
```

`order-form.js` chỉ được sửa nếu audit chứng minh producer hiện tại có regression liên quan trực tiếp. Không nhét Resend/email logic vào frontend.

---

# 6. ENV / SECRETS — THIẾT KẾ BẮT BUỘC

Edge Function phải đọc các biến sau:

```text
RESEND_API_KEY
NOTIFY_EMAIL_ENABLED
NOTIFY_EMAIL_MODE
NOTIFY_EMAIL_EVENTS
NOTIFY_EMAIL_TEST_TO
NOTIFY_EMAIL_TO
NOTIFY_EMAIL_FROM
NOTIFY_EMAIL_SECRET
APP_BASE_URL
```

## Giá trị đề xuất cho UAT

```text
NOTIFY_EMAIL_ENABLED=true
NOTIFY_EMAIL_MODE=test
NOTIFY_EMAIL_EVENTS=new_order
NOTIFY_EMAIL_TEST_TO=<EMAIL_TEST_DO_ANH_CHI_DINH>
NOTIFY_EMAIL_TO=<MAILBOX_PRODUCTION_CHUA_DUNG_TRONG_TEST>
NOTIFY_EMAIL_FROM=CB Media Hub <onboarding@resend.dev>
APP_BASE_URL=https://<domain-app>
```

## Luật resolve recipient

Pseudo-code bắt buộc:

```js
if (!enabled) return SKIP;

if (mode === 'test') {
  recipients = parse(NOTIFY_EMAIL_TEST_TO);
  // TUYỆT ĐỐI không merge NOTIFY_EMAIL_TO
}

if (mode === 'live') {
  recipients = parse(NOTIFY_EMAIL_TO);
}

if (mode không phải test/live) {
  fail configuration;
}
```

### Fail closed

- `mode=test` nhưng thiếu `NOTIFY_EMAIL_TEST_TO` → **không gửi** và báo config error rõ.
- `mode=live` nhưng thiếu `NOTIFY_EMAIL_TO` → **không gửi** và báo config error rõ.
- thiếu `RESEND_API_KEY` → không giả success.
- thiếu `APP_BASE_URL` → coi là config error trong P0 vì CTA deep-link là output bắt buộc.

### Subject TEST

Trong test mode, subject phải có prefix rõ:

```text
[TEST][CB Media Hub] Đơn mới — MEDIA-...
```

Live:

```text
[CB Media Hub] Đơn mới — MEDIA-...
```

---

# 7. EVENT FILTERING — SOURCE OF TRUTH

Tạo enum/logic nội bộ rõ ràng, tối thiểu:

```text
new_order
rating
```

Parse:

```text
NOTIFY_EMAIL_EVENTS=new_order
```

P0 mặc định chỉ `new_order`.

## Điều kiện `new_order`

Chỉ match khi:

```text
payload.table === 'orders'
payload.type === 'INSERT'
payload.record tồn tại
isInternalOrder(record) === false
```

## Internal Order phải skip

Giữ tối thiểu các rule hiện tại:

```text
record.client_visible === false
record.order_kind === 'internal_media_request'
record.order_kind === 'internal_ads_media_request'
```

Nếu repo có thêm marker internal mới, Dev phải audit source/schema và bổ sung theo source of truth hiện tại.

## Rating

Code có thể giữ nhưng:

```text
if events không chứa 'rating' → UPDATE rating phải skip 200
```

Không tạo webhook UPDATE mới chỉ để phục vụ P0.

---

# 8. IDEMPOTENCY + EMAIL LOG — BẮT BUỘC

## 8.1. Migration mới

Tạo:

```text
supabase/add-email-notification-log.sql
```

Migration phải **idempotent**.

Schema đề xuất:

```sql
public.email_notification_log
- id uuid primary key default gen_random_uuid()
- event_key text not null
- event_type text not null
- entity_id text
- recipient text not null
- status text not null check (status in ('processing','sent','failed'))
- attempt_count integer not null default 0
- provider_message_id text
- last_error text
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- sent_at timestamptz

unique(event_key, recipient)
```

Bật RLS; frontend không cần đọc bảng này. Service role/Edge Function vận hành server-side.

## 8.2. Event key

Cho Order mới:

```text
new_order:<order_id>
```

Ví dụ:

```text
new_order:MEDIA-2026-1234
```

Không dùng timestamp random trong event key vì sẽ phá idempotency.

## 8.3. Atomic claim

Không được implement kiểu:

```text
SELECT không thấy row
→ SEND EMAIL
→ INSERT log
```

vì 2 webhook chạy đồng thời có thể cùng gửi.

Phải có cơ chế claim atomic ở DB. Phương án khuyến nghị:

```text
claim_email_notification(event_key, recipient, event_type, entity_id)
```

Hàm phải đảm bảo:

- Row chưa tồn tại → tạo `processing`, attempt=1, return `true`.
- Row `sent` → return `false`.
- Row `processing` còn mới → return `false`.
- Row `processing` bị stale quá ngưỡng hợp lý → cho retry claim.
- Row `failed` → cho retry, tăng attempt_count.

Sau send:

```text
success → mark sent + provider_message_id + sent_at
failure → mark failed + last_error
```

**Không để trạng thái `processing` vĩnh viễn khi provider throw.**

## 8.4. Multi-recipient

Normalize recipient:

- split comma.
- trim.
- lowercase để dedupe logic.
- bỏ empty.
- unique.

Mỗi recipient có claim/log riêng để audit chính xác.

---

# 9. EMAIL TEMPLATE — OUTPUT CHÍNH

Template phải theo hướng system notification gọn, tương tự reference Gmail đã cung cấp:

- Card trắng.
- Header Navy `#191970`.
- Text rõ hierarchy.
- CTA nổi bật.
- Không dùng CSS phức tạp phụ thuộc browser.
- Ưu tiên `<table>` + inline CSS để tương thích email client.
- Max width khoảng 560–600px.
- Dữ liệu động phải HTML escape.

## 9.1. Subject

Order thường:

```text
[CB Media Hub] Đơn mới — {ORDER_ID} | {PROJECT_NAME}
```

TEST:

```text
[TEST][CB Media Hub] Đơn mới — {ORDER_ID} | {PROJECT_NAME}
```

Ads:

```text
[CB Media Hub] Yêu cầu chạy Ads mới — {ORDER_ID} | {PROJECT_NAME}
```

## 9.2. Header

```text
CB Centres — Creative Flow
```

## 9.3. Intro

```text
Có một yêu cầu mới vừa được gửi lên CB Media Hub.
```

Ads có thể dùng:

```text
Có một yêu cầu chạy Ads mới vừa được gửi lên CB Media Hub.
```

## 9.4. Field bắt buộc

```text
Mã đơn
Dự án
Người yêu cầu
Email người yêu cầu
Đơn vị / Chi nhánh
Loại yêu cầu
Mức ưu tiên (nếu record có field tương ứng)
Deadline mong muốn
```

Nếu field không tồn tại trong schema hiện tại, **không tự bịa tên cột**. Audit record/schema rồi chỉ render field thật.

## 9.5. Brief preview

Có thể thêm preview brief nhưng phải clamp ở server, ví dụ 160 ký tự.

Không đổ toàn bộ brief dài vào email.

## 9.6. CTA

Order thường:

```text
Xem đơn trên Media Hub →
```

Deep-link:

```text
{APP_BASE_URL}/database-orders.html?id={ORDER_ID}
```

Ads Order:

```text
{APP_BASE_URL}/content-team.html?tab=ads-orders&id={ORDER_ID}
```

## 9.7. Footer

```text
Email tự động từ CB Media Hub · CB Centres. Vui lòng không trả lời email này.
```

---

# 10. HTTP / ERROR BEHAVIOR — KHÔNG FAIL ÂM THẦM

## 10.1. HTTP 200 chỉ dùng cho

- gửi thành công.
- event bị skip hợp lệ.
- duplicate đã `sent`.
- duplicate đang `processing` hợp lệ.
- email feature disabled chủ động.

## 10.2. HTTP 4xx dùng cho

- request method sai.
- secret sai → `401`.
- invalid JSON → `400`.
- config/payload bắt buộc sai có thể dùng `400/422` tùy convention đã chốt.

## 10.3. HTTP 5xx dùng cho

- Resend/network error sau khi đã mark log `failed`.
- DB claim/log lỗi làm không thể đảm bảo idempotency.
- lỗi server ngoài dự kiến.

**Không trả 200 với `{ok:false}` cho provider failure trong flow cần retry.**

Response JSON nên có diagnostic không chứa secret:

```json
{
  "ok": false,
  "event": "new_order",
  "entity_id": "MEDIA-...",
  "error": "provider_error"
}
```

Không trả API key, secret header hoặc stack chứa credential.

---

# 11. TEST MATRIX BẮT BUỘC

Dev/Claude phải ghi lại kết quả từng case.

| ID | Test | Kỳ vọng |
|---|---|---|
| T01 | `MODE=test`, valid Client Order INSERT | đúng 1 email tới `TEST_TO` |
| T02 | gửi cùng payload T01 3 lần | tổng cộng vẫn chỉ 1 email thành công |
| T03 | `client_visible=false` | 0 email |
| T04 | `internal_media_request` | 0 email |
| T05 | `internal_ads_media_request` | 0 email |
| T06 | client Ads Order | 1 email, subject Ads, CTA đúng Content Team |
| T07 | `MODE=test` nhưng `NOTIFY_EMAIL_TO` có production mail | production mail nhận 0 |
| T08 | `MODE=live` | dùng `NOTIFY_EMAIL_TO`, không dùng TEST_TO |
| T09 | `ENABLED=false` | skip, 0 email |
| T10 | `EVENTS=new_order`, payload rating UPDATE | skip, 0 email |
| T11 | secret header sai | HTTP 401, 0 email |
| T12 | malformed JSON | HTTP 400 |
| T13 | Resend/provider fail | log `failed`, HTTP 5xx |
| T14 | retry sau T13 khi provider bình thường | gửi thành công đúng 1 lần, log `sent` |
| T15 | project/requester chứa `<script>` hoặc HTML | email hiển thị text an toàn, không inject HTML |
| T16 | recipient list có duplicate/space | recipient được normalize + dedupe |
| T17 | APP_BASE_URL có trailing slash | CTA không sinh `//database-orders...` |
| T18 | thiếu TEST_TO khi mode=test | fail closed, không fallback production |
| T19 | thiếu LIVE TO khi mode=live | fail closed |
| T20 | end-to-end tạo Order thật từ form | DB row + bell + webhook + email test + CTA cùng Order |

### Regression smoke bắt buộc

Ít nhất kiểm:

```text
request.html / order-form submit
client-dashboard.html
database-orders.html
content-team.html (Ads deep-link)
notification bell/in-app order_new
```

Nếu sửa JS frontend/HTML có inline script → tuân thủ `CLAUDE.md`: smoke-load headless + `window.__ERRS=[]` và assert `errs=[]`.

---

# 12. UAT PROCEDURE — TEST TRƯỚC KHI LIVE

## Phase A — Deploy code nhưng chưa gửi production

Set:

```text
NOTIFY_EMAIL_ENABLED=true
NOTIFY_EMAIL_MODE=test
NOTIFY_EMAIL_EVENTS=new_order
NOTIFY_EMAIL_TEST_TO=<email anh chỉ định>
```

`NOTIFY_EMAIL_TO` có thể đã set nhưng TEST MODE tuyệt đối không đọc nó.

## Phase B — Manual Edge Function payload

Gửi payload mẫu:

```json
{
  "type": "INSERT",
  "table": "orders",
  "record": {
    "id": "MEDIA-TEST-0001",
    "project_name": "TEST EMAIL — Back to School",
    "requester_name": "Test User",
    "requester_email": "test@cbcentres.com",
    "department": "Marketing",
    "request_type": "design",
    "requested_deadline": "2026-08-20",
    "client_visible": true
  }
}
```

Header phải có:

```text
x-notify-secret: <NOTIFY_EMAIL_SECRET>
```

Kiểm:

```text
HTTP success
DB log sent
recipient = test email
subject có [TEST]
CTA đúng domain
```

Sau đó gửi lại payload 2–3 lần để test duplicate.

## Phase C — End-to-end

1. Login Client test.
2. Tạo một Order thật.
3. Xác nhận DB có Order.
4. Xác nhận bell của staff có `order_new`.
5. Xác nhận webhook execution.
6. Xác nhận Edge Function log.
7. Xác nhận email test nhận đúng 1 mail.
8. Click CTA.
9. Xác nhận mở đúng Order vừa tạo.

## Phase D — Chỉ sau khi Anh approve mới LIVE

Đổi:

```text
NOTIFY_EMAIL_MODE=live
NOTIFY_EMAIL_TO=<mail production đã chốt>
```

Không hardcode production email trong source.

---

# 13. DATABASE WEBHOOK SETUP

P0 ưu tiên webhook:

```text
Table: public.orders
Event: INSERT
Target: Edge Function notify-email
```

Header:

```text
x-notify-secret: <same value as NOTIFY_EMAIL_SECRET>
```

Function có thể deploy `--no-verify-jwt` vì webhook DB không phải user JWT flow, nhưng endpoint phải tự verify `x-notify-secret` như code hiện tại.

Nếu hệ thống đang có webhook `INSERT + UPDATE` từ setup cũ, không bắt buộc xóa UPDATE ngay; function phải gate `NOTIFY_EMAIL_EVENTS` nên rating UPDATE vẫn skip khi P0 chỉ bật `new_order`.

---

# 14. SECURITY REQUIREMENTS

1. Không expose `RESEND_API_KEY` ra frontend/config.js.
2. Không commit secrets.
3. `NOTIFY_EMAIL_SECRET` phải là random secret đủ dài.
4. So sánh secret trước khi xử lý payload/send.
5. HTML escape toàn bộ dynamic values.
6. Deep-link entity id phải `encodeURIComponent` tương đương.
7. Log không ghi API key / webhook secret.
8. Email log table không cần policy cho client/staff thông thường.
9. Nếu tạo RPC claim/mark, grant chỉ đúng role server cần thiết; audit `PUBLIC/anon/authenticated` theo luật security hiện tại của project.
10. Không mở RLS `users` để phục vụ email.

---

# 15. DOCUMENTATION / HANDOFF SAU KHI CODE

Sau khi verify PASS:

## `_hot.md`

Ghi ngắn nhưng đủ:

- EMAIL NEW ORDER P0 đã hoàn tất.
- TEST/LIVE mode.
- idempotency architecture.
- migration name.
- webhook event.
- secrets.
- bẫy/fix quan trọng.
- test thực tế đã chạy.

## `STATUS.md`

Ghi:

- module/file thay đổi.
- DONE/PENDING rõ.
- migration đã/ chưa apply.
- Edge Function đã/ chưa deploy.
- webhook đã/ chưa tạo.
- manual test đã/ chưa PASS.
- end-to-end đã/ chưa PASS.

## `README.md`

Cập nhật nếu:

- có migration mới.
- file map thay đổi.
- setup email thay đổi.
- environment variable list thay đổi.

**Không được ghi “production ready” nếu mới chỉ code xong nhưng chưa test Edge Function thật + webhook thật.**

---

# 16. NHỮNG ĐIỀU DEV/CLAUDE TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM

```text
❌ Gửi Resend trực tiếp từ order-form.js
❌ Hardcode email test hoặc email production vào source
❌ TEST mode vẫn CC/BCC production
❌ Xóa hoặc thay notify_roles chỉ vì đang làm email
❌ Dùng frontend users lookup để quyết định recipient email
❌ Return HTTP 200 khi provider send fail và kỳ vọng retry
❌ Gửi email internal_media_request
❌ Mở thêm email event ngoài new_order trong P0
❌ Bỏ qua duplicate/idempotency test
❌ Viết migration không idempotent
❌ Đoán tên cột priority/branch/brief rồi code
❌ Ghi DONE khi chưa E2E
❌ Để file harness/test tạm trong repo
```

---

# 17. REPORT FORMAT DEV/CLAUDE PHẢI TRẢ SAU KHI THỰC HIỆN

Không trả lời chung chung “đã xong”. Phải trả theo format:

```markdown
## 1. Files changed
- ...

## 2. Architecture implemented
- ...

## 3. Migration
- file:
- applied: YES/NO
- verify query/result:

## 4. Edge Function
- deployed: YES/NO
- secrets configured: YES/NO/PARTIAL
- webhook configured: YES/NO

## 5. Test results
- T01 PASS/FAIL — evidence
- T02 PASS/FAIL — evidence
...
- T20 PASS/FAIL — evidence

## 6. Regression
- page/flow — PASS/FAIL

## 7. Remaining manual action
- ...

## 8. Docs updated
- _hot.md: YES/NO
- STATUS.md: YES/NO
- README.md: YES/NO/N/A

## 9. Final state
READY FOR TEST / READY FOR LIVE / BLOCKED
```

Nếu có bất kỳ mục bắt buộc nào chưa verify → final state không được là `READY FOR LIVE`.

---

# 18. PROMPT GIAO DEV / CLAUDE — COPY NGUYÊN KHỐI

```text
Bạn đang làm trong repo jettdsgn95/HiasMaster, project:
Portal_Hub/CB_Creative_Flow.

NHIỆM VỤ:
Triển khai P0 Email Notification khi CLIENT tạo ORDER MỚI, theo đúng brief:
Portal_Hub/Brief_Wflow/CB_Creative_Flow_New_Order_Email_Notification_Implementation_Brief.md

YÊU CẦU BẮT BUỘC:
1. Trước khi code, đọc theo thứ tự:
   - Portal_Hub/CB_Creative_Flow/CLAUDE.md
   - Portal_Hub/CB_Creative_Flow/README.md
   - Portal_Hub/CB_Creative_Flow/_hot.md
   - Portal_Hub/CB_Creative_Flow/STATUS.md
   - brief email nói trên.
2. Sau đó audit code/schema thật, tối thiểu:
   - assets/order-form.js
   - supabase/add-notify-roles-rpc.sql
   - supabase/functions/notify-email/index.ts
   - .env.example
   - schema/migrations public.orders liên quan.
3. KHÔNG ĐOÁN tên cột, enum, role, RLS, deep-link hoặc webhook payload.
4. Giữ nguyên kiến trúc:
   orders INSERT → Database Webhook → Edge Function notify-email → Resend.
   Không gửi email từ frontend.
5. Giữ nguyên in-app notification notify_roles; không regression admin/account/lead_media bell.
6. Scope P0 CHỈ new_order. Rating logic cũ nếu giữ thì phải gate và disabled khi NOTIFY_EMAIL_EVENTS=new_order.
7. Bắt buộc implement TEST/LIVE mode fail-closed:
   - test → chỉ NOTIFY_EMAIL_TEST_TO
   - live → chỉ NOTIFY_EMAIL_TO
   - tuyệt đối không fallback từ TEST sang production recipient.
8. Bắt buộc implement idempotency + audit log bằng migration idempotent, để retry cùng event không gửi email trùng.
9. Bắt buộc provider failure không được false-success HTTP 200; mark failed + trả lỗi phù hợp để retry.
10. Internal order phải skip; Ads client-visible phải gửi và deep-link đúng Content Team.
11. Template email phải theo brief: card system notification, navy #191970, field gọn, CTA, inline CSS/table, HTML escape dữ liệu động.
12. Không hardcode secret/email recipient trong source.
13. Chạy TOÀN BỘ test matrix T01–T20 trong brief. Duplicate test, provider fail/retry và end-to-end là bắt buộc.
14. Verify regression các flow được brief liệt kê; nếu sửa HTML inline script phải smoke-load headless theo CLAUDE.md và assert __ERRS=[] + handler thực sự chạy.
15. Xóa toàn bộ file test/harness tạm.
16. Cập nhật _hot.md + STATUS.md; cập nhật README.md nếu file map/migration/setup/env thay đổi.
17. Không được ghi DONE/READY FOR LIVE nếu chưa có bằng chứng test thật.

CÁCH LÀM:
- Audit trước, viết plan ngắn dựa trên code thật.
- Thực hiện từng phase.
- Sau mỗi phần quan trọng verify ngay, không dồn test cuối.
- Nếu phát hiện brief khác source-of-truth hiện tại, DỪNG tại điểm xung đột, ghi rõ bằng chứng và phương án sửa; không tự đoán.

ĐẦU RA CUỐI CÙNG PHẢI THEO FORMAT §17 CỦA BRIEF:
Files changed / Architecture / Migration / Edge Function / T01–T20 / Regression / Manual action / Docs updated / Final state.

Mục tiêu cuối của đợt này là:
NOTIFY_EMAIL_MODE=test → anh chỉ định một email test → Client tạo Order mới → DB ghi thành công → bell nội bộ vẫn hoạt động → webhook gọi Edge Function → đúng 1 email test được gửi → CTA mở đúng Order → retry không gửi trùng. Chỉ sau khi anh duyệt mới chuyển MODE=live.
```

---

# 19. CHECKLIST CHỐT CHO NGƯỜI REVIEW

Trước khi approve merge/deploy:

- [ ] Dev đã đọc `CLAUDE.md` + 3 file state mới nhất.
- [ ] Không sửa email vào frontend.
- [ ] TEST mode không thể chạm production recipient.
- [ ] Migration idempotent.
- [ ] Atomic claim chống duplicate.
- [ ] Provider fail trả non-2xx.
- [ ] Internal order skip.
- [ ] Ads routing đúng.
- [ ] HTML escape.
- [ ] Secret guard 401.
- [ ] T01–T20 PASS.
- [ ] E2E Order thật PASS.
- [ ] `_hot.md` cập nhật.
- [ ] `STATUS.md` cập nhật.
- [ ] README cập nhật nếu cần.
- [ ] Không còn harness/file temp.
- [ ] Chưa đổi LIVE trước khi người phụ trách approve.

---

**Kết luận:** task này không phải xây email notification từ số 0. Repo đã có đúng nền tảng `orders webhook → notify-email Edge Function → Resend`. Công việc P0 là **hardening và operationalize**: khóa TEST/LIVE, giới hạn scope `new_order`, chống duplicate, log/audit, lỗi phải retry được, chuẩn hóa template và verify end-to-end trước khi bật production.
