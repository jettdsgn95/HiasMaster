# P0 Fix Prompt — Deadline thống nhất Client ↔ Account + Notification

> Dự án: `jettdsgn95/HiasMaster`  
> Root app: `Portal_Hub/CB_Creative_Flow`  
> Ngày tạo: 2026-07-15  
> Mục tiêu: Fix P0 về deadline trong CB Creative Flow / Media Hub.

---

## 1. Bối cảnh lỗi hiện tại

Hiện hệ thống đang có 2 lớp deadline:

| Field | Ý nghĩa hiện tại |
|---|---|
| `requested_deadline` | Deadline Client chọn khi gửi Order |
| `internal_deadline` | Deadline Account/Lead giao nội bộ cho Production/PIC |

Vấn đề nghiệp vụ: khi Client set deadline trong Order nhưng Account deal lại được một deadline phù hợp hơn, hệ thống **chưa có field/flow riêng để lưu deadline đã thống nhất với Client**. Account chỉ đang chỉnh được `internal_deadline`, nên:

- Client vẫn thấy deadline cũ từ `requested_deadline`.
- Account không có nút “đề xuất deadline mới”.
- Client không có nút “đồng ý / cần trao đổi lại”.
- Không có notification riêng cho việc thay đổi deadline.
- Dashboard/Calendar chưa có `effective_deadline = agreed_deadline || requested_deadline`.

---

## 2. Mục tiêu P0 cần fix

Triển khai 3 lớp deadline rõ ràng:

| Field | Mục đích | Ai thấy |
|---|---|---|
| `requested_deadline` | Deadline Client mong muốn ban đầu | Client + Account |
| `agreed_deadline` | Deadline đã thống nhất sau khi Account deal và Client xác nhận | Client + Account + Lead |
| `internal_deadline` | Deadline nội bộ giao cho PIC, thường sớm hơn agreed deadline | Account + Lead + PIC |

Nguyên tắc:

```text
requested_deadline = không sửa đè, giữ lịch sử mong muốn ban đầu của Client
agreed_deadline = deadline chính thức với Client sau khi thống nhất
internal_deadline = deadline vận hành nội bộ Production
effective_deadline = agreed_deadline || requested_deadline
```

---

## 3. Database migration cần thêm

Tạo migration mới:

```text
Portal_Hub/CB_Creative_Flow/supabase/add-agreed-deadline-flow.sql
```

Đề xuất columns cho bảng `orders`:

```sql
alter table public.orders
  add column if not exists agreed_deadline date,
  add column if not exists deadline_proposal_status text
    check (deadline_proposal_status is null or deadline_proposal_status in ('none','proposed','accepted','rejected'))
    default 'none',
  add column if not exists deadline_proposal_reason text,
  add column if not exists deadline_proposed_by text,
  add column if not exists deadline_proposed_by_id uuid,
  add column if not exists deadline_proposed_at timestamptz,
  add column if not exists deadline_responded_at timestamptz,
  add column if not exists deadline_response_note text,
  add column if not exists deadline_history jsonb default '[]'::jsonb;
```

Nếu bảng `notifications.type` đang có CHECK constraint thì bổ sung các type:

```text
deadline_proposed
deadline_accepted
deadline_rejected
```

Yêu cầu migration phải idempotent, chạy lại không lỗi.

---

## 4. Account UI cần thêm trong `database-orders.js`

Trong Order Drawer, thêm block dưới phần điều phối/deadline:

```text
Deadline Client mong muốn: DD/MM/YYYY
Deadline đã thống nhất: DD/MM/YYYY hoặc —
Trạng thái đề xuất: none/proposed/accepted/rejected

[Deadline đề xuất mới]
[Lý do điều chỉnh deadline]
[ Gửi Client xác nhận deadline mới ]
```

### Quy tắc hiển thị

- Account/Admin/Lead Media được đề xuất deadline mới.
- `system_supervisor` và `lead_content` chỉ xem, không sửa.
- Không cho đề xuất nếu Order đã cancelled/completed/final delivered/rated.
- Không sửa đè `requested_deadline`.
- Khi gửi đề xuất:
  - update `agreed_deadline = proposed date` tạm hoặc chỉ lưu proposed date vào `agreed_deadline` với status `proposed`.
  - set `deadline_proposal_status = 'proposed'`
  - set `deadline_proposal_reason`
  - set `deadline_proposed_by`, `deadline_proposed_by_id`, `deadline_proposed_at`
  - append vào `deadline_history`.

### Notification cho Client

Dùng helper `notifyClient(order, payload)` hiện có trong `database-orders.js`:

```js
notifyClient(order, {
  type: 'deadline_proposed',
  title: 'Marketing đề xuất điều chỉnh deadline',
  message: `${order.order_id} · ${order.project_name || ''} — Deadline đề xuất mới: ${fmtDate(proposedDate)}. Lý do: ${reason}`,
  link: 'client-dashboard.html?id=' + order.order_id
});
```

---

## 5. Client UI cần thêm trong `client-dashboard.js`

Trong Client Portal / Order detail drawer:

Nếu `deadline_proposal_status === 'proposed'`:

```text
Marketing đề xuất điều chỉnh deadline

Deadline ban đầu: DD/MM/YYYY
Deadline đề xuất: DD/MM/YYYY
Lý do: ...
[ Đồng ý deadline mới ] [ Cần trao đổi lại ]
```

### Khi Client bấm “Đồng ý deadline mới”

Update order:

```js
{
  deadline_proposal_status: 'accepted',
  deadline_responded_at: nowIso,
  deadline_response_note: null,
  agreed_deadline: proposedDate,
  last_updated: nowIso
}
```

Notify nội bộ bằng RPC `notify_roles`:

```js
notifyRolesRpc(['admin','account','lead_media'], {
  type: 'deadline_accepted',
  title: 'Client đã đồng ý deadline mới',
  message: `${orderId} · Client đồng ý deadline ${fmtDate(agreedDeadline)}`,
  link: 'database-orders.html?id=' + orderId,
  related_entity_type: 'orders',
  related_entity_id: orderId
});
```

### Khi Client bấm “Cần trao đổi lại”

Mở textarea bắt buộc nhập lý do, sau đó update:

```js
{
  deadline_proposal_status: 'rejected',
  deadline_responded_at: nowIso,
  deadline_response_note: note,
  last_updated: nowIso
}
```

Notify nội bộ:

```js
notifyRolesRpc(['admin','account','lead_media'], {
  type: 'deadline_rejected',
  title: 'Client cần trao đổi lại deadline',
  message: `${orderId} · ${note}`,
  link: 'database-orders.html?id=' + orderId,
  related_entity_type: 'orders',
  related_entity_id: orderId
});
```

---

## 6. Deadline hiển thị và tính toán

Tạo helper dùng chung ở các page cần deadline:

```js
function effectiveDeadline(order) {
  return order && (order.agreed_deadline || order.requested_deadline || null);
}
```

Áp dụng ở:

- `client-dashboard.js`: Client Portal hiển thị deadline chính thức.
- `database-orders.js`: table + drawer + overdue count.
- `order-dashboard.html` inline script nếu có.
- `dashboard.html` inline script nếu đang dùng order deadline.
- `calendar.js`: Order Deadline event phải dùng `effective_deadline`.
- `reports.js`: report deadline/overdue dùng `effective_deadline`.

Không thay đổi `internal_deadline` của task.

---

## 7. Production rule

Khi Account push sang Production:

- Task vẫn dùng `internal_deadline`.
- Nếu `agreed_deadline` đã accepted, Account nên tự set `internal_deadline <= agreed_deadline`.
- Nếu `internal_deadline > agreed_deadline`, hiển thị warning nhưng không nhất thiết block trong P0.

---

## 8. Acceptance Criteria

### Case 1 — Client gửi order bình thường

1. Client gửi Order với `requested_deadline = 20/07/2026`.
2. Account thấy deadline ban đầu trong Order Drawer.
3. Client Portal thấy deadline 20/07/2026.

### Case 2 — Account đề xuất deadline mới

1. Account nhập proposed deadline 23/07/2026 + lý do.
2. Account bấm “Gửi Client xác nhận deadline mới”.
3. DB update:
   - `deadline_proposal_status = 'proposed'`
   - `agreed_deadline = '2026-07-23'`
   - `deadline_proposal_reason` có nội dung
   - `deadline_proposed_at` có timestamp
4. Client nhận notification `deadline_proposed`.
5. Client Portal hiển thị panel xác nhận deadline.

### Case 3 — Client đồng ý

1. Client bấm “Đồng ý deadline mới”.
2. DB update `deadline_proposal_status = 'accepted'`.
3. Account/Admin/Lead Media nhận notification `deadline_accepted`.
4. Client Portal hiển thị deadline chính thức = 23/07/2026.
5. Dashboard/Calendar dùng 23/07/2026 làm effective deadline.

### Case 4 — Client không đồng ý

1. Client bấm “Cần trao đổi lại”.
2. Client bắt buộc nhập ghi chú.
3. DB update `deadline_proposal_status = 'rejected'`.
4. Account/Admin/Lead Media nhận notification `deadline_rejected`.
5. Order Drawer hiển thị ghi chú phản hồi deadline của Client.

### Case 5 — Không phá deadline nội bộ

1. Account vẫn set `internal_deadline`.
2. Push Production vẫn tạo task với `internal_deadline`.
3. Client không thấy `internal_deadline`.

---

## 9. Prompt gửi Claude/Dev

```text
Bạn là senior full-stack engineer đang làm repo jettdsgn95/HiasMaster, app nằm tại Portal_Hub/CB_Creative_Flow.

Hãy implement P0 deadline flow theo file planning này.

Yêu cầu bắt buộc:
1. Không sửa đè requested_deadline. Đây là deadline Client mong muốn ban đầu.
2. Thêm agreed_deadline và deadline_proposal_* để lưu deadline đã thống nhất.
3. Thêm migration idempotent: supabase/add-agreed-deadline-flow.sql.
4. Account/Admin/Lead Media có UI trong database-orders.js để đề xuất deadline mới + lý do.
5. Client có UI trong client-dashboard.js để Đồng ý / Cần trao đổi lại.
6. Có notification hai chiều:
   - Account đề xuất → Client nhận deadline_proposed.
   - Client đồng ý → admin/account/lead_media nhận deadline_accepted.
   - Client từ chối/cần trao đổi → admin/account/lead_media nhận deadline_rejected.
7. Các dashboard/calendar/report dùng effective_deadline = agreed_deadline || requested_deadline cho deadline công khai.
8. Production/task vẫn dùng internal_deadline, không lộ internal_deadline cho Client.
9. Không phá các flow hiện có: Content Wording, Preview/Final, Feedback rounds, Ads Orders, Internal Media Requests.
10. Cập nhật README/_hot/STATUS sau khi làm xong.

Sau khi code, hãy tự test 5 case trong Acceptance Criteria và ghi lại kết quả test vào STATUS.md.
```

---

## 10. Ghi chú triển khai

- Ưu tiên làm nhỏ, chắc, không refactor lớn.
- Nếu `notifications.type` CHECK constraint đang chặn type mới, migration phải update constraint.
- Nếu một số page đang dùng inline JS trong HTML, tránh rewrite toàn bộ file; chỉ patch đúng helper deadline và render liên quan.
- Giữ backward compatibility: order cũ không có `agreed_deadline` vẫn hiển thị `requested_deadline`.
