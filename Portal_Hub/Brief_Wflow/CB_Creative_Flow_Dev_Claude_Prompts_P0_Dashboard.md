# CB Creative Flow — Dev/Claude Prompts for P0 Fixes

> Repo: `https://github.com/jettdsgn95/HiasMaster.git`  
> Project path chính: `Portal_Hub/CB_Creative_Flow/`  
> Ngày tạo brief: 15/07/2026  
> Mục tiêu: Gửi Dev/Claude fix các lỗi nghiệp vụ P0 sau khi rà soát README / `_hot.md` / `STATUS.md` và code hiện tại.

---

# PROMPT 1 — FIX P0: Deadline Flow Client ↔ Account ↔ Production

## Vai trò của bạn

Bạn là Senior Frontend + Supabase Engineer đang bảo trì website **CB Creative Flow — Media Hub by CB Centres**.

Hãy đọc kỹ repo:

```text
https://github.com/jettdsgn95/HiasMaster.git
```

Các file cần ưu tiên kiểm tra:

```text
Portal_Hub/CB_Creative_Flow/README.md
Portal_Hub/CB_Creative_Flow/_hot.md
Portal_Hub/CB_Creative_Flow/STATUS.md
Portal_Hub/CB_Creative_Flow/supabase/schema.sql
Portal_Hub/CB_Creative_Flow/assets/order-form.js
Portal_Hub/CB_Creative_Flow/assets/database-orders.js
Portal_Hub/CB_Creative_Flow/assets/client-dashboard.js
Portal_Hub/CB_Creative_Flow/assets/data-store.js
Portal_Hub/CB_Creative_Flow/assets/production-board.js
Portal_Hub/CB_Creative_Flow/dashboard.html
Portal_Hub/CB_Creative_Flow/task-dashboard.html
Portal_Hub/CB_Creative_Flow/client-dashboard.html
Portal_Hub/CB_Creative_Flow/database-orders.html
```

## Bối cảnh lỗi nghiệp vụ

Hiện tại hệ thống có 2 loại deadline:

```text
requested_deadline = deadline Client mong muốn khi gửi Order
internal_deadline  = deadline nội bộ Account/Lead giao cho PIC Production
```

Nhưng thực tế vận hành cần 3 lớp deadline:

| Field | Ý nghĩa | Ai thấy |
|---|---|---|
| `requested_deadline` | Deadline Client mong muốn ban đầu | Client + Account |
| `agreed_deadline` | Deadline đã được Account deal / thống nhất lại với Client | Client + Account + Production |
| `internal_deadline` | Deadline nội bộ giao cho PIC, thường sớm hơn agreed deadline | Account + Lead + PIC |

Hiện tại Account chỉ chỉnh được `internal_deadline`, không có flow đề xuất deadline mới cho Client xác nhận. Client cũng không nhận notification khi Account điều chỉnh deadline nội bộ.

## Mục tiêu P0

Implement flow:

```text
Client gửi requested_deadline
→ Account kiểm tra tính khả thi
→ Nếu deadline Client không phù hợp, Account đề xuất agreed_deadline mới + lý do
→ Client nhận notification
→ Client mở Client Portal / Order detail
→ Client bấm Đồng ý deadline mới hoặc Cần trao đổi lại
→ Nếu đồng ý: agreed_deadline trở thành deadline chính thức
→ Account / Lead Media nhận notification
→ Dashboard / Calendar / Client Portal dùng effective_deadline = agreed_deadline || requested_deadline
→ Production vẫn dùng internal_deadline để giao PIC
```

## Yêu cầu quan trọng

Không được ghi đè `requested_deadline`. Field này là deadline gốc Client đã nhập và cần giữ lại để audit.

Không được dùng `internal_deadline` để hiển thị cho Client. `internal_deadline` là deadline nội bộ.

Không phá flow hiện tại:

```text
Order Form
Database Orders
Client Dashboard
Production Board
Task Dashboard
Master Dashboard
Notification
Supabase RLS / CHECK constraints
```

---

## 1. Database / Supabase migration cần thêm

Tạo migration mới, ví dụ:

```text
Portal_Hub/CB_Creative_Flow/supabase/add-agreed-deadline-flow.sql
```

Thêm các field vào bảng `orders`:

```sql
alter table public.orders
  add column if not exists agreed_deadline timestamptz,
  add column if not exists deadline_proposal_status text default 'none',
  add column if not exists deadline_proposal_reason text,
  add column if not exists deadline_proposed_by text,
  add column if not exists deadline_proposed_by_id uuid,
  add column if not exists deadline_proposed_at timestamptz,
  add column if not exists deadline_responded_at timestamptz,
  add column if not exists deadline_response_by uuid,
  add column if not exists deadline_response_note text,
  add column if not exists deadline_history jsonb default '[]'::jsonb;
```

Thêm CHECK constraint an toàn:

```sql
alter table public.orders
  drop constraint if exists orders_deadline_proposal_status_check;

alter table public.orders
  add constraint orders_deadline_proposal_status_check
  check (
    deadline_proposal_status in (
      'none',
      'proposed',
      'accepted',
      'rejected'
    )
  );
```

Nếu bảng `notifications.type` có CHECK constraint, bổ sung các type mới:

```text
deadline_proposed
deadline_accepted
deadline_rejected
deadline_updated
```

Nếu cần, tạo migration riêng:

```text
Portal_Hub/CB_Creative_Flow/supabase/add-deadline-notification-types.sql
```

Yêu cầu migration phải idempotent, chạy nhiều lần không lỗi.

---

## 2. Effective deadline helper

Tạo helper dùng chung hoặc local helper trong các page liên quan:

```js
function effectiveDeadline(order) {
  return order && (order.agreed_deadline || order.requested_deadline || null);
}
```

Format hiển thị:

```js
function deadlineLabel(order) {
  if (!order) return '—';
  if (order.agreed_deadline) return fmtDate(order.agreed_deadline) + ' · Đã thống nhất';
  if (order.requested_deadline) return fmtDate(order.requested_deadline) + ' · Client đề xuất';
  return '—';
}
```

Áp dụng ở:

```text
client-dashboard.js
database-orders.js
dashboard.html
task-dashboard.html nếu có liên quan drilldown/deadline display
reports.html nếu có deadline summary
calendar.js nếu dùng order deadline
```

## 3. Account UI trong Database Orders / Order Drawer

Trong `assets/database-orders.js`, trong Order Drawer, thêm block mới gần phần điều phối nội bộ hoặc deadline:

Tên block đề xuất:

```text
Deadline thương lượng với Client
```

Hiển thị:

```text
Deadline Client mong muốn: [requested_deadline]
Deadline đã thống nhất: [agreed_deadline hoặc —]
Trạng thái đề xuất: none / proposed / accepted / rejected
```

Form cho Account/Admin/Lead Media:

```text
Deadline đề xuất mới: [datetime-local]
Lý do điều chỉnh: [textarea]
[ Gửi Client xác nhận deadline mới ]
```

Chỉ cho phép role sau thao tác:

```text
admin
account
lead_media
```

Không cho `system_supervisor`, `lead_content`, `content`, `design`, `editor`, `client`.

Validation:

```text
- Không được gửi nếu thiếu deadline đề xuất.
- Không được gửi nếu thiếu lý do điều chỉnh.
- Deadline đề xuất nên >= hôm nay.
- Nếu đã accepted, muốn đổi tiếp thì vẫn cho phép tạo proposal mới nhưng phải push history cũ vào deadline_history.
- Nếu order đã completed / cancelled / rejected thì disable.
```

Khi Account bấm “Gửi Client xác nhận deadline mới”:

Update order:

```js
{
  agreed_deadline: proposedDeadlineIso,
  deadline_proposal_status: 'proposed',
  deadline_proposal_reason: reason,
  deadline_proposed_by: currentUser.name || currentUser.email,
  deadline_proposed_by_id: currentUser.id || null,
  deadline_proposed_at: nowIso,
  deadline_responded_at: null,
  deadline_response_by: null,
  deadline_response_note: null,
  last_updated: nowIso
}
```

Ghi thêm vào `deadline_history`:

```json
{
  "type": "proposed",
  "from": "<requested_deadline or previous agreed_deadline>",
  "to": "<new proposed deadline>",
  "reason": "<reason>",
  "by": "<account name/email>",
  "at": "<ISO timestamp>"
}
```

Bắn notification cho Client:

```js
notifyClient(order, {
  type: 'deadline_proposed',
  title: 'Account đề xuất điều chỉnh deadline',
  message: `${order.order_id} · ${order.project_name || ''} — Deadline đề xuất mới: ${fmtDateTime(proposedDeadlineIso)}. Lý do: ${reason}`,
  link: 'client-dashboard.html?id=' + order.order_id
});
```

Nếu type `deadline_proposed` chưa được CHECK cho phép thì migration phải fix trước.

## 4. Client Portal UI

Trong `assets/client-dashboard.js`, khi map order Supabase → client shape, map thêm:

```js
requested_deadline: o.requested_deadline || '',
agreed_deadline: o.agreed_deadline || '',
deadline_proposal_status: o.deadline_proposal_status || 'none',
deadline_proposal_reason: o.deadline_proposal_reason || '',
deadline_proposed_at: o.deadline_proposed_at || '',
deadline_response_note: o.deadline_response_note || ''
```

Deadline hiển thị chính cho Client phải là:

```js
deadline: fmtDate(o.agreed_deadline || o.requested_deadline)
```

Trong Order detail của Client, nếu:

```js
deadline_proposal_status === 'proposed'
```

thì hiển thị panel:

```text
Marketing đề xuất điều chỉnh deadline

Deadline ban đầu: [requested_deadline]
Deadline đề xuất mới: [agreed_deadline]
Lý do: [deadline_proposal_reason]

[ Đồng ý deadline mới ] [ Cần trao đổi lại ]
```

### Nút “Đồng ý deadline mới”

Update order:

```js
{
  deadline_proposal_status: 'accepted',
  deadline_responded_at: nowIso,
  deadline_response_by: currentUser.id,
  deadline_response_note: null,
  last_updated: nowIso
}
```

Append `deadline_history`:

```json
{
  "type": "accepted",
  "deadline": "<agreed_deadline>",
  "by": "<client name/email>",
  "at": "<ISO timestamp>"
}
```

Notify Account / Lead Media / Admin:

```text
deadline_accepted
```

Message:

```text
Client đã đồng ý deadline mới cho ORDER_ID — deadline chính thức: DD/MM/YYYY HH:mm
```

### Nút “Cần trao đổi lại”

Mở textarea bắt buộc:

```text
Lý do / mong muốn của Client
```

Update:

```js
{
  deadline_proposal_status: 'rejected',
  deadline_responded_at: nowIso,
  deadline_response_by: currentUser.id,
  deadline_response_note: note,
  last_updated: nowIso
}
```

Append `deadline_history`:

```json
{
  "type": "rejected",
  "deadline": "<agreed_deadline>",
  "note": "<client note>",
  "by": "<client name/email>",
  "at": "<ISO timestamp>"
}
```

Notify Account / Lead Media / Admin:

```text
deadline_rejected
```

Message:

```text
Client chưa đồng ý deadline mới cho ORDER_ID — cần Account trao đổi lại.
```

## 5. Notification requirements

Client nhận notification khi Account đề xuất deadline mới.

Account / Lead Media / Admin nhận notification khi Client accepted hoặc rejected.

Nếu đã có RPC `notify_roles`, ưu tiên dùng RPC để notify roles nội bộ:

```js
notifyRolesRpc(['admin', 'account', 'lead_media'], {
  type: 'deadline_accepted' | 'deadline_rejected',
  title,
  message,
  link,
  related_entity_type: 'orders',
  related_entity_id: order.order_id
});
```

Nếu chưa có helper ở page Client, tạo helper tương thích với existing `notifyRolesRpc`.

Không block UI nếu notification fail, nhưng phải `console.warn`.

## 6. Dashboard / Calendar / Reports deadline display

Tất cả nơi hiển thị deadline cho Client/Account nên dùng:

```js
effective_deadline = agreed_deadline || requested_deadline
```

Riêng Production Board / Task Tracker vẫn dùng:

```js
internal_deadline
```

Nếu tạo task từ order, task vẫn lấy `internal_deadline`.

Khi Account push Production, validation vẫn yêu cầu `internal_deadline`.

Nên thêm cảnh báo nếu:

```js
internal_deadline > effective_deadline
```

Message:

```text
Internal Deadline đang trễ hơn deadline đã thống nhất với Client. Vui lòng điều chỉnh.
```

Không cần block cứng nếu chưa chắc nghiệp vụ, nhưng ít nhất cảnh báo rõ.

## 7. Acceptance Criteria

Sau khi fix, test các case:

### Case 1 — Client gửi order với deadline thường

```text
Client submit order
→ requested_deadline được lưu
→ Client Dashboard hiển thị deadline Client đề xuất
→ Account Drawer thấy requested_deadline
```

### Case 2 — Account đề xuất deadline mới

```text
Account mở order
→ nhập agreed_deadline mới + lý do
→ bấm gửi Client xác nhận
→ order.deadline_proposal_status = proposed
→ Client nhận notification deadline_proposed
→ Client Dashboard hiển thị panel xác nhận deadline
```

### Case 3 — Client đồng ý

```text
Client bấm Đồng ý deadline mới
→ deadline_proposal_status = accepted
→ agreed_deadline là deadline chính thức
→ Account/Lead/Admin nhận notification deadline_accepted
→ Client Dashboard hiển thị deadline đã thống nhất
→ Database Orders hiển thị deadline đã thống nhất
```

### Case 4 — Client không đồng ý

```text
Client bấm Cần trao đổi lại
→ nhập lý do
→ deadline_proposal_status = rejected
→ Account/Lead/Admin nhận notification deadline_rejected
→ Account Drawer hiển thị phản hồi của Client
```

### Case 5 — Production

```text
Account vẫn phải nhập internal_deadline để push Production
→ Task được tạo với internal_deadline
→ Client không thấy internal_deadline
```

### Case 6 — Audit

```text
deadline_history có đủ event proposed / accepted / rejected
Không mất requested_deadline gốc
```

## 8. Definition of Done

- Có migration SQL idempotent.
- Không còn dùng `internal_deadline` để hiển thị deadline cho Client.
- Có UI đề xuất deadline mới cho Account.
- Có UI Client xác nhận / phản hồi deadline mới.
- Có notification 2 chiều.
- Có effective deadline helper.
- Không phá flow Preview / Final / Rating.
- Không phá Content Wording gate.
- Không phá Ads Order / Internal Media Request.
- Update README / STATUS / _hot nếu cần để ghi rõ flow deadline mới.

---

# PROMPT 2 — FIX Dashboard Workload: Remove hardcoded PIC list, use real users + real tasks

## Vai trò của bạn

Bạn là Senior Frontend Engineer phụ trách dashboard vận hành CB Creative Flow.

Hãy fix riêng phần Dashboard workload theo yêu cầu:

```text
Dashboard workload
→ không dùng danh sách PIC hardcode
→ lấy từ users thật + tasks thật
→ filter PIC tự build theo dữ liệu hiện có
```

Repo:

```text
https://github.com/jettdsgn95/HiasMaster.git
```

Project path:

```text
Portal_Hub/CB_Creative_Flow/
```

Các file cần kiểm tra/sửa:

```text
Portal_Hub/CB_Creative_Flow/dashboard.html
Portal_Hub/CB_Creative_Flow/task-dashboard.html
Portal_Hub/CB_Creative_Flow/reports.html
Portal_Hub/CB_Creative_Flow/production-board.html
Portal_Hub/CB_Creative_Flow/assets/database-orders.js
Portal_Hub/CB_Creative_Flow/assets/production-board.js
Portal_Hub/CB_Creative_Flow/assets/data-store.js
Portal_Hub/CB_Creative_Flow/assets/styles.css
```

## Bối cảnh lỗi hiện tại

Trong `dashboard.html`, phần Team Workload đang render sẵn các row hardcode:

```text
Duy
Vinh
Hậu
Linh Chi
Đức Anh
Mai Phương
```

JS chỉ update các row `[data-pic]` có sẵn, nên nếu User Management thêm nhân sự thật như:

```text
Quyên
Du
Hòa
Vinh
Đăng
Bảo
Duy
Thanh
Trang
Tú
Hậu
```

thì Dashboard Workload vẫn không hiện đúng.

Trong `task-dashboard.html`, phần Workload by team member cũng đang có bar-row hardcode tương tự.

Yêu cầu: bỏ toàn bộ PIC hardcode ở Dashboard workload và Task Dashboard workload.

## Mục tiêu

Sau khi fix:

```text
- Workload by PIC phải lấy từ tasks thật.
- Danh sách PIC phải build động từ users thật + tasks thật.
- Nếu user active nhưng chưa có task, vẫn nên hiện 0 task nếu role thuộc nhóm production/account liên quan.
- Nếu task assigned_to có tên không còn trong users, vẫn phải hiện row đó để không mất dữ liệu.
- Filter PIC phải tự build theo dữ liệu hiện có.
- Không còn phụ thuộc vào list hardcode Duy/Vinh/Hậu/Linh Chi/Đức Anh/Mai Phương.
```

## Nguồn dữ liệu

Dùng các store hiện có:

```js
window.MH.store.users.list()
window.MH.store.tasks.list()
```

Load song song:

```js
const [users, tasks] = await Promise.all([
  window.MH.store.users.list(),
  window.MH.store.tasks.list()
]);
```

Nếu `users.list()` fail thì fallback vẫn render từ `tasks.assigned_to`.

Nếu `tasks.list()` fail thì hiển thị empty state, không crash page.

## Role được tính workload

Tạo constant:

```js
const WORKLOAD_ROLES = [
  'design',
  'editor',
  'account',
  'lead_media',
  'admin'
];
```

Tùy business nếu muốn chỉ tính production thì dùng:

```js
const PRODUCTION_ROLES = [
  'design',
  'editor'
];
```

Nhưng với dashboard tổng, nên tính cả `account`, `lead_media`, `admin` nếu task có assigned_to.

## Helper đề xuất

Tạo helper dùng được trong `dashboard.html` và `task-dashboard.html`:

```js
function normalizeName(s) {
  return String(s || '').trim();
}

function initialsOf(name) {
  const parts = normalizeName(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleLabel(role) {
  const map = {
    admin: 'Admin',
    account: 'Account',
    lead_media: 'Lead Media',
    design: 'Design',
    editor: 'Editor',
    content: 'Content',
    lead_content: 'Lead Content',
    system_supervisor: 'Giám sát',
    client: 'Client'
  };
  return map[role] || role || '—';
}

function isActiveUser(u) {
  return u && u.name && u.status !== 'inactive';
}

function isOpenTask(t) {
  return t && !['completed', 'delivered', 'cancelled', 'paused'].includes(t.status);
}

function buildPicDirectory(users, tasks) {
  const map = new Map();

  (users || [])
    .filter(isActiveUser)
    .filter((u) => WORKLOAD_ROLES.includes(u.role))
    .forEach((u) => {
      const name = normalizeName(u.name);
      if (!name) return;
      map.set(name, {
        name,
        role: u.role,
        email: u.email || '',
        source: 'users'
      });
    });

  (tasks || []).forEach((t) => {
    const name = normalizeName(t.assigned_to);
    if (!name) return;
    if (!map.has(name)) {
      map.set(name, {
        name,
        role: '',
        email: '',
        source: 'tasks'
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
```

## Workload aggregation

Không chỉ count tổng. Cần tách:

```text
progress
review
overdue
done
open
```

Helper:

```js
function aggregateWorkload(tasks) {
  const data = {};

  (tasks || []).forEach((t) => {
    const name = normalizeName(t.assigned_to) || '— Chưa gán —';
    if (!data[name]) {
      data[name] = {
        progress: 0,
        review: 0,
        overdue: 0,
        done: 0,
        open: 0,
        total: 0
      };
    }

    data[name].total++;

    const completed = dbIsCompleted ? dbIsCompleted(t.status) : ['completed', 'delivered'].includes(t.status);
    const overdue = dbIsOverdue ? dbIsOverdue(t.internal_deadline, completed) : false;

    if (completed) {
      data[name].done++;
    } else if (overdue) {
      data[name].overdue++;
      data[name].open++;
    } else if (t.status === 'review') {
      data[name].review++;
      data[name].open++;
    } else if (isOpenTask(t)) {
      data[name].progress++;
      data[name].open++;
    }
  });

  return data;
}
```

## Render dynamic workload rows — Master Dashboard

Trong `dashboard.html`, thay block HTML hardcode:

```html
<div class="workload-list" id="module5-workload-list">
  ...
</div>
```

Bằng empty mount:

```html
<div class="workload-list" id="module5-workload-list">
  <div class="alert-empty" style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:var(--text-sm)">
    Đang tải workload từ dữ liệu thật...
  </div>
</div>
```

Trong JS, sau khi load:

```js
const [orders, tasks, users] = await Promise.all([
  window.MH.store.orders.list(),
  window.MH.store.tasks.list(),
  window.MH.store.users.list().catch(() => [])
]);
```

Sau đó:

```js
renderDynamicWorkload(users, tasks);
```

Function:

```js
function renderDynamicWorkload(users, tasks) {
  const mount = document.getElementById('module5-workload-list');
  if (!mount) return;

  const MAX_PER_PIC = 8;
  const directory = buildPicDirectory(users, tasks);
  const workload = aggregateWorkload(tasks);

  const rows = directory.map((pic) => {
    const d = workload[pic.name] || { progress:0, review:0, overdue:0, done:0, open:0, total:0 };
    return { ...pic, ...d };
  });

  rows.sort((a, b) => {
    if (b.open !== a.open) return b.open - a.open;
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    return a.name.localeCompare(b.name, 'vi');
  });

  if (!rows.length) {
    mount.innerHTML = `
      <div class="alert-empty" style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:var(--text-sm)">
        Chưa có PIC hoặc task nào để hiển thị.
      </div>`;
    return;
  }

  const w = (n) => Math.min(100, n / MAX_PER_PIC * 100) + '%';

  mount.innerHTML = rows.map((r) => `
    <div class="workload-row" data-pic="${escapeHtml(r.name)}">
      <span class="wname">
        <span class="ava">${escapeHtml(initialsOf(r.name))}</span>
        ${escapeHtml(r.name)}
        <small class="text-xs muted"> · ${escapeHtml(roleLabel(r.role))}</small>
      </span>
      <div class="workload-bar">
        <span class="wb--progress" style="width:${w(r.progress)}"></span>
        <span class="wb--review" style="width:${w(r.review)}"></span>
        <span class="wb--overdue" style="width:${w(r.overdue)}"></span>
        <span class="wb--done" style="width:${w(r.done)}"></span>
      </div>
      <span class="wcount"><b>${r.open}</b> /max ${MAX_PER_PIC}</span>
    </div>
  `).join('');

  const overloaded = rows.filter((r) => r.open > MAX_PER_PIC);
  const pressureBadge = document.getElementById('workload-pressure-badge');
  if (pressureBadge) {
    pressureBadge.className = `badge ${overloaded.length ? 'badge-danger' : 'badge-success'}`;
    pressureBadge.innerHTML = `<span class="dot"></span> ${overloaded.length ? overloaded.length + ' PIC quá tải' : 'Trong ngưỡng'}`;
  }
}
```

Nhớ dùng escape HTML. Nếu file chưa có helper `escapeHtml`, tạo local helper:

```js
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}
```

## Render dynamic workload rows — Task Dashboard

Trong `task-dashboard.html`, thay block hardcode:

```html
<div class="bar-list" ...>
  <div class="bar-row" data-pic="Duy">...</div>
  ...
</div>
```

Bằng mount:

```html
<div class="bar-list" id="task-workload-list" style="display:flex; flex-direction:column; gap:var(--space-2); margin-top:var(--space-3)">
  <div class="alert-empty" style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:var(--text-sm)">
    Đang tải workload theo PIC...
  </div>
</div>
```

Trong JS load task dashboard, load thêm users:

```js
const [tasks, users] = await Promise.all([
  window.MH.store.tasks.list(),
  window.MH.store.users.list().catch(() => [])
]);
```

Render:

```js
renderTaskDashboardWorkload(users, tasks);
```

Function:

```js
function renderTaskDashboardWorkload(users, tasks) {
  const mount = document.getElementById('task-workload-list');
  if (!mount) return;

  const MAX_PER_PIC = 8;
  const directory = buildPicDirectory(users, tasks);
  const workload = aggregateWorkload(tasks);

  const rows = directory.map((pic) => {
    const d = workload[pic.name] || { open:0, overdue:0 };
    return { ...pic, ...d };
  }).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'vi'));

  if (!rows.length) {
    mount.innerHTML = `<div class="alert-empty" style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:var(--text-sm)">Chưa có task hoặc PIC.</div>`;
    return;
  }

  mount.innerHTML = rows.map((r) => {
    const pct = Math.min(100, r.open / MAX_PER_PIC * 100);
    const critical = r.open > MAX_PER_PIC || r.overdue > 0;
    return `
      <div class="bar-row" data-pic="${escapeHtml(r.name)}">
        <span style="width:180px"><b>${escapeHtml(r.name)}</b> · ${escapeHtml(roleLabel(r.role))}</span>
        <div class="bar" style="flex:1; height:10px; background:var(--surface-2); border-radius:var(--radius-pill); overflow:hidden">
          <i style="display:block; height:100%; width:${pct}%; background:${critical ? 'var(--red-600)' : 'var(--grad-brand)'}; border-radius:var(--radius-pill)"></i>
        </div>
        <b style="width:80px; text-align:right">${r.open} / ${MAX_PER_PIC}</b>
      </div>`;
  }).join('');
}
```

## Dynamic PIC filter

Tìm tất cả filter PIC đang hardcode ở:

```text
dashboard.html
task-dashboard.html
reports.html
production-board.html
database-orders.html
```

Yêu cầu:

```text
- Không hardcode option PIC.
- Build option từ users thật + tasks.assigned_to thực tế.
- Nếu Supabase off hoặc users fail, fallback từ tasks.assigned_to.
```

Helper:

```js
function renderPicFilter(selectEl, users, tasks, selectedValue) {
  if (!selectEl) return;

  const directory = buildPicDirectory(users, tasks);
  const assignedNames = Array.from(new Set((tasks || []).map((t) => normalizeName(t.assigned_to)).filter(Boolean)));

  assignedNames.forEach((name) => {
    if (!directory.some((u) => u.name === name)) {
      directory.push({ name, role: '', email: '', source: 'tasks' });
    }
  });

  directory.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  selectEl.innerHTML =
    `<option value="">Tất cả PIC</option>` +
    directory.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${p.role ? ' · ' + escapeHtml(roleLabel(p.role)) : ''}</option>`).join('');

  if (selectedValue) selectEl.value = selectedValue;
}
```

Áp dụng cho các `<select>` filter PIC hiện có. Nếu filter chưa có id rõ ràng, thêm id:

```html
<select id="filter-pic" class="select">...</select>
```

## Important constraints

Không thay đổi tên role hiện có.

Không đổi schema task nếu không cần.

Không làm vỡ RLS / Supabase store.

Không xóa fallback localStorage/demo nếu hệ thống đang cần fallback.

Không thay đổi logic status/task hiện có ngoài phần workload/filter.

Không dùng màu inline quá nhiều nếu có class CSS sẵn. Nếu đang có inline style trong file thì có thể giữ consistent.

## Acceptance Criteria

### Case 1 — User mới có role design/editor

```text
Admin thêm user mới trong User Management
→ user status active
→ Dashboard Workload hiện user đó với 0/max 8 nếu chưa có task
```

### Case 2 — Task assigned_to user mới

```text
Task assigned_to = "Quyên"
→ Dashboard Workload hiển thị Quyên
→ Task Dashboard Workload hiển thị Quyên
→ Filter PIC có option Quyên
```

### Case 3 — Task assigned_to người không còn trong users

```text
Task assigned_to = "Nhân sự cũ"
→ Dashboard vẫn hiển thị row Nhân sự cũ để không mất dữ liệu
→ source có thể coi là tasks
```

### Case 4 — Không còn PIC hardcode

Search toàn repo không còn các block workload hardcode kiểu:

```text
data-pic="Duy"
data-pic="Vinh"
data-pic="Linh Chi"
data-pic="Hậu"
data-pic="Đức Anh"
data-pic="Mai Phương"
```

trong phần Dashboard workload / Task Dashboard workload.

Lưu ý: nếu các tên này xuất hiện trong seed/demo data ở nơi khác thì không cần xóa, nhưng không được dùng để render workload cố định.

### Case 5 — Filter PIC

```text
Filter PIC tự build từ users + tasks
Không bị thiếu user mới
Không bị dư option rỗng
Không crash nếu users.list() fail
```

### Case 6 — Realtime

Khi task đổi assigned_to hoặc status:

```text
Dashboard reload/realtime update
Workload count đổi đúng
Pressure badge đổi đúng
```

## Definition of Done

- Master Dashboard workload dynamic.
- Task Dashboard workload dynamic.
- PIC filter dynamic.
- Không còn hardcoded PIC list trong workload UI.
- Không phá existing KPI cards.
- Không phá drilldown KPI.
- Không phá export CSV.
- Update `_hot.md` / `STATUS.md` ghi rõ đã fix hardcoded PIC workload/filter.
