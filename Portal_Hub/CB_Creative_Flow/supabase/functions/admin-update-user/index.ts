// =====================================================================
// CB Media Hub — Edge Function: admin-update-user
//
// Gộp 4 hành động quản trị vào 1 function (cùng 1 lớp kiểm quyền admin):
//   action = 'update'         → sửa đầy đủ field quản trị
//          | 'set_status'     → active / pending / inactive / suspended / archived
//          | 'resend_invite'  → gửi lại email mời (Auth thật)
//          | 'reset_password' → gửi link đặt lại mật khẩu (Auth thật)
//
// Khoá quan trọng (goal: user inactive KHÔNG thao tác được):
//   status != 'active' ⇒ ban Auth user (ban_duration) ⇒ token hiện tại vô hiệu,
//   không login lại được. Reactivate ⇒ unban ('none').
//   Đây là tầng Auth; tầng app (supabase-client.js) tự logout thêm 1 lớp nữa.
// =====================================================================
import {
  CORS, json, fail, serviceClient, requireAdmin, appendActivity, deriveInitials,
  ROLES, STATUSES, PERMISSION_GROUPS, DATA_SCOPES
} from '../_shared/admin.ts';

const ACTIVE = 'active';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('validation_error', 'Chỉ hỗ trợ POST.', 405);

  const svc = serviceClient();
  const gate = await requireAdmin(req, svc);
  if (gate.error) return gate.error;
  const caller = gate.caller!;

  let body: Record<string, any>;
  try { body = await req.json(); }
  catch { return fail('validation_error', 'Body không phải JSON hợp lệ.'); }

  const action = String(body.action || 'update');
  const userId = String(body.id || '').trim();
  if (!userId) return fail('validation_error', 'Thiếu id user.');

  const { data: target, error: tErr } = await svc
    .from('users').select('*').eq('id', userId).maybeSingle();
  if (tErr) return fail('server_error', tErr.message, 500);
  if (!target) return fail('not_found', 'Không tìm thấy user: ' + userId, 404);

  /* =================== resend_invite / reset_password =================== */
  if (action === 'resend_invite' || action === 'reset_password') {
    const isInvite = action === 'resend_invite';
    const redirectTo = String(body.redirectTo || '') || undefined;
    let errMsg: string | null = null;

    if (isInvite) {
      const { error } = await svc.auth.admin.inviteUserByEmail(target.email, { redirectTo });
      errMsg = error?.message || null;
    } else {
      // resetPasswordForEmail gửi mail thật qua SMTP đã cấu hình của project.
      const { error } = await svc.auth.resetPasswordForEmail(target.email, { redirectTo });
      errMsg = error?.message || null;
    }
    if (errMsg) {
      return fail('auth_create_failed',
        (isInvite ? 'Không gửi lại được invite: ' : 'Không gửi được link reset: ') + errMsg, 502);
    }

    const { data: upd } = await svc.from('users').update({
      activity: appendActivity(target.activity, {
        actor: caller.name || caller.email,
        action: isInvite ? 'invite_resent' : 'password_reset_sent',
        desc: isInvite ? 'Gửi lại email mời' : 'Gửi link đặt lại mật khẩu'
      }),
      updated_at: new Date().toISOString()
    }).eq('id', userId).select().maybeSingle();

    return json({ ok: true, user: upd || target });
  }

  /* =========================== set_status ============================== */
  if (action === 'set_status') {
    const status = String(body.status || '').trim();
    if (!STATUSES.includes(status)) return fail('validation_error', 'Status không hợp lệ: ' + status);

    // Không cho khoá Admin active cuối cùng (kiểm ở DB, không tin UI).
    if (target.role === 'admin' && target.status === ACTIVE && status !== ACTIVE) {
      const { count } = await svc.from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin').eq('status', ACTIVE).neq('id', userId);
      if (!count) {
        return fail('validation_error',
          'Đây là Admin duy nhất đang active. Cần tạo Admin khác trước khi khoá.', 409);
      }
    }

    const banned = await applyAuthBan(svc, userId, status);
    if (banned) return banned;

    const { data: upd, error } = await svc.from('users').update({
      status,
      activity: appendActivity(target.activity, {
        actor: caller.name || caller.email,
        action: status === ACTIVE ? 'user_activated' : 'user_deactivated',
        desc: `Status: ${target.status} → ${status}`
      }),
      updated_at: new Date().toISOString()
    }).eq('id', userId).select().maybeSingle();
    if (error || !upd) return fail('profile_insert_failed', error?.message || 'Update thất bại', 502);

    return json({ ok: true, user: upd });
  }

  /* ============================= update ================================ */
  if (action !== 'update') return fail('validation_error', 'Action không hợp lệ: ' + action);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changes: string[] = [];
  const put = (key: string, val: unknown, label?: string) => {
    if (val === undefined) return;
    if (target[key] === val) return;
    patch[key] = val;
    changes.push(`${label || key}: ${target[key] ?? '—'} → ${val ?? '—'}`);
  };

  if (body.name !== undefined) {
    const nm = String(body.name).trim();
    if (!nm) return fail('validation_error', 'Tên không được rỗng.');
    put('name', nm);
    patch.initials = deriveInitials(nm);
  }
  if (body.role !== undefined) {
    const r = String(body.role);
    if (!ROLES.includes(r)) return fail('validation_error', 'Role không hợp lệ: ' + r);
    put('role', r);
  }
  if (body.permission_group !== undefined) {
    const p = body.permission_group ? String(body.permission_group) : null;
    if (p && !PERMISSION_GROUPS.includes(p)) return fail('validation_error', 'Permission group không hợp lệ.');
    put('permission_group', p);
  }
  if (body.data_scope !== undefined) {
    const d = body.data_scope ? String(body.data_scope) : null;
    if (d && !DATA_SCOPES.includes(d)) return fail('validation_error', 'Data scope không hợp lệ.');
    put('data_scope', d);
  }
  if (body.phone !== undefined) put('phone', String(body.phone).trim() || null);
  if (body.department !== undefined) put('department', String(body.department).trim() || null);
  if (body.title !== undefined) put('title', String(body.title).trim() || null);
  if (body.tag !== undefined) put('tag', body.tag ? String(body.tag) : null);
  if (Array.isArray(body.allowed_departments)) {
    patch.allowed_departments = body.allowed_departments;
  }

  // Status đi kèm update: cùng ràng buộc admin-cuối + ban/unban như set_status.
  if (body.status !== undefined) {
    const st = String(body.status);
    if (!STATUSES.includes(st)) return fail('validation_error', 'Status không hợp lệ: ' + st);
    if (st !== target.status) {
      if (target.role === 'admin' && target.status === ACTIVE && st !== ACTIVE) {
        const { count } = await svc.from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin').eq('status', ACTIVE).neq('id', userId);
        if (!count) {
          return fail('validation_error',
            'Đây là Admin duy nhất đang active. Cần tạo Admin khác trước khi khoá.', 409);
        }
      }
      const banned = await applyAuthBan(svc, userId, st);
      if (banned) return banned;
      put('status', st);
    }
  }

  if (changes.length) {
    patch.activity = appendActivity(target.activity, {
      actor: caller.name || caller.email, action: 'user_updated', desc: changes.join(' · ')
    });
  }

  const { data: upd, error } = await svc
    .from('users').update(patch).eq('id', userId).select().maybeSingle();
  if (error || !upd) return fail('profile_insert_failed', error?.message || 'Update thất bại', 502);

  return json({ ok: true, user: upd, changes });
});

/** status != active ⇒ ban Auth user (token vô hiệu). active ⇒ unban. */
async function applyAuthBan(svc: any, userId: string, status: string): Promise<Response | null> {
  const { error } = await svc.auth.admin.updateUserById(userId, {
    ban_duration: status === ACTIVE ? 'none' : '876000h' // ~100 năm = khoá vô thời hạn
  });
  if (error) {
    return fail('auth_create_failed',
      'Không cập nhật được trạng thái đăng nhập ở Supabase Auth: ' + error.message, 502);
  }
  return null;
}
