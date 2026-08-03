// =====================================================================
// CB Media Hub — helper dùng chung cho các Edge Function admin-*
//
// ⚠ verify_jwt = FALSE cho các function này, KHÔNG phải để mở cửa:
//    preflight OPTIONS của browser không mang Authorization header, bật
//    verify_jwt sẽ khiến gateway trả 401 trước khi tới code ⇒ CORS fail.
//    Bù lại, requireAdmin() dưới đây tự xác thực NGHIÊM NGẶT:
//    có Authorization → getUser() thật → profile role='admin' + status='active'.
// =====================================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export type Fail =
  | 'validation_error' | 'not_admin' | 'duplicate_email'
  | 'auth_create_failed' | 'profile_insert_failed' | 'not_found' | 'server_error';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}
export function fail(code: Fail, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ ok: false, code, message, ...extra }, status);
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Xác minh caller là admin ĐANG ACTIVE. Trả profile của caller, hoặc Response lỗi. */
export async function requireAdmin(req: Request, svc: SupabaseClient) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: fail('not_admin', 'Thiếu Authorization header.', 401) };
  }
  // Client scoped theo token của caller → getUser() xác thực chữ ký token thật.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: au, error: auErr } = await userClient.auth.getUser();
  if (auErr || !au?.user) {
    return { error: fail('not_admin', 'Phiên đăng nhập không hợp lệ.', 401) };
  }
  // Đọc profile bằng service client: không phụ thuộc RLS, và đọc được cả status.
  const { data: me, error: meErr } = await svc
    .from('users').select('id, email, name, role, status').eq('id', au.user.id).maybeSingle();
  if (meErr) return { error: fail('server_error', meErr.message, 500) };
  if (!me) return { error: fail('not_admin', 'Tài khoản chưa được cấp quyền trong hệ thống.', 403) };
  if (me.role !== 'admin' || me.status !== 'active') {
    return { error: fail('not_admin', 'Chỉ Admin đang hoạt động mới được thao tác User Management.', 403) };
  }
  return { caller: me };
}

export const ROLES = ['admin', 'system_supervisor', 'account', 'lead_media',
  'design', 'editor', 'lead_content', 'content', 'client'];
export const STATUSES = ['active', 'pending', 'inactive', 'suspended', 'archived'];
export const PERMISSION_GROUPS = ['full', 'manager_view', 'order_mgmt', 'production_only',
  'delivery_only', 'report_viewer', 'client_only', 'ai_tools', 'custom'];
export const DATA_SCOPES = ['all', 'team', 'department', 'assigned', 'own', 'client_own', 'custom'];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Giống hệt initials() ở frontend: lấy 2 chữ cái cuối của các từ. */
export function deriveInitials(name: string): string {
  return (name || '').split(' ').map((s) => s[0]).filter(Boolean)
    .slice(-2).join('').toUpperCase() || '?';
}

/** Ghi 1 dòng vào users.activity (jsonb array), giữ tối đa 200 dòng gần nhất. */
export function appendActivity(
  current: unknown, entry: { actor: string; action: string; desc: string }
) {
  const arr = Array.isArray(current) ? current.slice() : [];
  arr.push({ time: new Date().toISOString().slice(0, 16).replace('T', ' '), ...entry });
  return arr.slice(-200);
}
