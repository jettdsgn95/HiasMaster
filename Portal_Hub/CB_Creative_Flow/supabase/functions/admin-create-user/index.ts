// =====================================================================
// CB Media Hub — Edge Function: admin-create-user
//
// Frontend User Management → function này → Auth Admin + public.users.
// service_role key CHỈ tồn tại ở đây (Deno.env), KHÔNG BAO GIỜ ở frontend.
//
// Bất biến:
//   · Auth user và profile luôn đi cùng nhau. Tạo Auth xong mà upsert profile
//     lỗi ⇒ XOÁ Auth user vừa tạo (rollback) rồi báo lỗi. Không để nửa vời.
//   · public.users.id LUÔN = auth.users.id (FK ON DELETE CASCADE).
//   · Không tạo user không thể đăng nhập: sendInvite=false vẫn trả action_link
//     để admin gửi tay cho user đặt mật khẩu.
// =====================================================================
import {
  CORS, json, fail, serviceClient, requireAdmin, appendActivity, deriveInitials,
  ROLES, STATUSES, PERMISSION_GROUPS, DATA_SCOPES, EMAIL_RE
} from '../_shared/admin.ts';

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

  /* ---------- 1) Validate ---------- */
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const role = String(body.role || '').trim();
  const department = String(body.department || '').trim();
  const phone = String(body.phone || '').trim();
  const tag = body.tag ? String(body.tag).trim() : null;
  const permissionGroup = body.permission_group ? String(body.permission_group).trim() : null;
  const dataScope = body.data_scope ? String(body.data_scope).trim() : null;
  const sendInvite = body.sendInvite !== false;
  const allowedDepartments = Array.isArray(body.allowed_departments) ? body.allowed_departments : [];
  // Có gửi invite ⇒ user chưa đặt mật khẩu ⇒ ép 'pending', không cho ghi 'active' giả.
  const status = sendInvite ? 'pending' : String(body.status || 'active').trim();

  const errs: string[] = [];
  if (!name) errs.push('Thiếu họ tên.');
  if (!EMAIL_RE.test(email)) errs.push('Email không hợp lệ.');
  if (!ROLES.includes(role)) errs.push('Role không hợp lệ: ' + role);
  if (!STATUSES.includes(status)) errs.push('Status không hợp lệ: ' + status);
  if (!department) errs.push('Thiếu phòng ban / chi nhánh.');
  if (permissionGroup && !PERMISSION_GROUPS.includes(permissionGroup)) errs.push('Permission group không hợp lệ.');
  if (dataScope && !DATA_SCOPES.includes(dataScope)) errs.push('Data scope không hợp lệ.');
  if (errs.length) return fail('validation_error', errs.join(' '), 400);

  /* ---------- 2) Chặn trùng email (cả profile lẫn Auth) ---------- */
  const { data: dupProfile } = await svc.from('users').select('id, email').ilike('email', email).maybeSingle();
  if (dupProfile) return fail('duplicate_email', 'Email đã tồn tại trong hệ thống: ' + email, 409);

  // Auth có thể có user "mồ côi" (không profile) từ lần chạy lỗi trước → vẫn phải chặn.
  const { data: authList } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const dupAuth = authList?.users?.find((u) => (u.email || '').toLowerCase() === email);
  if (dupAuth) {
    return fail('duplicate_email',
      'Email đã tồn tại trong Supabase Auth (chưa có profile). Cần xoá Auth user cũ hoặc dùng email khác: ' + email, 409);
  }

  /* ---------- 3) Tạo Auth user ---------- */
  const meta = { name, role, department, invited_by: caller.email };
  let authUserId: string | null = null;
  let actionLink: string | null = null;

  if (sendInvite) {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
      data: meta,
      redirectTo: String(body.redirectTo || '') || undefined
    });
    if (error || !data?.user) {
      return fail('auth_create_failed', 'Không gửi được lời mời: ' + (error?.message || 'unknown'), 502);
    }
    authUserId = data.user.id;
  } else {
    // Không gửi invite: tạo user đã xác thực email + mật khẩu ngẫu nhiên (không ai biết),
    // rồi sinh recovery link để admin gửi tay ⇒ user vẫn đặt được mật khẩu và đăng nhập.
    const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 8) + 'Aa1!';
    const { data, error } = await svc.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true, user_metadata: meta
    });
    if (error || !data?.user) {
      return fail('auth_create_failed', 'Không tạo được tài khoản Auth: ' + (error?.message || 'unknown'), 502);
    }
    authUserId = data.user.id;
    const { data: linkData } = await svc.auth.admin.generateLink({ type: 'recovery', email });
    actionLink = linkData?.properties?.action_link || null;
  }

  /* ---------- 4) Upsert profile (id = auth user id) ---------- */
  const profile = {
    id: authUserId,
    email,
    name,
    initials: deriveInitials(name),
    role,
    phone: phone || null,
    department: department || null,
    status,
    tag,
    permission_group: permissionGroup,
    data_scope: dataScope,
    allowed_departments: allowedDepartments,
    created_by: caller.id,
    activity: appendActivity([], {
      actor: caller.name || caller.email,
      action: 'user_created',
      desc: `Tạo user role ${role}${sendInvite ? ' · đã gửi invite' : ' · không gửi invite'}`
    }),
    updated_at: new Date().toISOString()
  };

  const { data: created, error: insErr } = await svc
    .from('users').upsert(profile, { onConflict: 'id' }).select().maybeSingle();

  /* ---------- 5) Rollback nếu profile lỗi ---------- */
  if (insErr || !created) {
    const { error: delErr } = await svc.auth.admin.deleteUser(authUserId!);
    return fail('profile_insert_failed',
      'Tạo Auth user xong nhưng ghi profile thất bại: ' + (insErr?.message || 'không có dòng trả về') +
      (delErr
        ? ` — ROLLBACK THẤT BẠI, cần xoá tay Auth user ${authUserId}: ${delErr.message}`
        : ' — đã rollback (xoá Auth user vừa tạo).'),
      502, { rollback: delErr ? 'failed' : 'ok', auth_user_id: authUserId });
  }

  return json({ ok: true, user: created, action_link: actionLink, invited: sendInvite }, 201);
});
