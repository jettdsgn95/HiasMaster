// =====================================================================
// CB Media Hub — Edge Function `notify-email`
//
// Nhiệm vụ: gửi EMAIL về mail công ty cho ĐÚNG 2 sự kiện (theo yêu cầu):
//   1. ORDER MỚI từ client       — INSERT vào `orders` (order client-visible,
//                                   gồm cả Ads Order; LOẠI order nội bộ
//                                   internal_media_request / internal_ads_media_request).
//   2. CLIENT HOÀN THÀNH RATING  — UPDATE `orders` khi satisfaction_score
//                                   chuyển NULL → có giá trị.
// Mọi sự kiện khác bị bỏ qua (function tự lọc — webhook có thể bắn mọi UPDATE).
//
// Kích hoạt qua Supabase Database Webhooks (Dashboard → Database → Webhooks):
//   Webhook 1: table `orders`, events INSERT + UPDATE,
//              type "Supabase Edge Functions" → chọn function `notify-email`.
//   (payload chuẩn webhook: { type, table, record, old_record })
//
// Email provider: Resend (https://resend.com — free 100 email/ngày, chỉ cần API key).
// Deploy:
//   supabase functions deploy notify-email --no-verify-jwt
//     (--no-verify-jwt: webhook nội bộ gọi không kèm JWT user; bảo vệ bằng
//      NOTIFY_EMAIL_SECRET — set cùng giá trị vào header webhook `x-notify-secret`)
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set NOTIFY_EMAIL_TO=marketing@cbcentres.com
//   supabase secrets set NOTIFY_EMAIL_FROM="CB Media Hub <onboarding@resend.dev>"
//     (production: verify domain cbcentres.com trong Resend rồi đổi from về
//      dạng no-reply@cbcentres.com; onboarding@resend.dev chỉ để test)
//   supabase secrets set NOTIFY_EMAIL_SECRET=<chuỗi ngẫu nhiên dài>
//   supabase secrets set APP_BASE_URL=https://<domain-railway>   (cho link trong mail)
// =====================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OrderRow = Record<string, unknown> & {
  id?: string;
  project_name?: string;
  requester_name?: string;
  requester_email?: string;
  department?: string;
  request_type?: string;
  requested_deadline?: string;
  order_kind?: string | null;
  client_visible?: boolean | null;
  satisfaction_score?: number | null;
  client_feedback?: string | null;
};

type WebhookPayload = {
  type?: string; // INSERT | UPDATE | DELETE
  table?: string;
  record?: OrderRow | null;
  old_record?: OrderRow | null;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

// Order nội bộ (From Content / From Ads) KHÔNG phải "order mới từ client" → không gửi mail.
function isInternalOrder(o: OrderRow): boolean {
  if (o.client_visible === false) return true;
  const kind = String(o.order_kind || "");
  return kind === "internal_media_request" || kind === "internal_ads_media_request";
}

function mailNewOrder(o: OrderRow, baseUrl: string) {
  const isAds = String(o.order_kind || "") === "ads_order";
  const link = baseUrl
    ? (isAds
      ? `${baseUrl}/content-team.html?tab=ads-orders&id=${encodeURIComponent(String(o.id || ""))}`
      : `${baseUrl}/database-orders.html?id=${encodeURIComponent(String(o.id || ""))}`)
    : "";
  const subject = `[CB Media Hub] ${isAds ? "Yêu cầu chạy Ads mới" : "Order mới"}: ${o.id || ""} — ${o.project_name || "Untitled"}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
      <h2 style="color:#191970;margin:0 0 12px">${isAds ? "📣 Yêu cầu chạy Ads mới từ client" : "📥 Order mới từ client"}</h2>
      <table cellpadding="0" cellspacing="0" style="font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Mã order</td><td><strong>${esc(o.id)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Dự án</td><td>${esc(o.project_name || "Untitled")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Người gửi</td><td>${esc(o.requester_name || "")} · ${esc(o.requester_email || "")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Đơn vị</td><td>${esc(o.department || "")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Loại</td><td>${esc(o.request_type || "")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Deadline</td><td>${esc(o.requested_deadline || "—")}</td></tr>
      </table>
      ${link ? `<p style="margin:16px 0"><a href="${esc(link)}" style="background:#191970;color:#fff;padding:10px 18px;border-radius:9999px;text-decoration:none">Mở trong CB Media Hub →</a></p>` : ""}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">Email tự động từ CB Media Hub — không trả lời email này.</p>
    </div>`;
  return { subject, html };
}

function mailRating(o: OrderRow, baseUrl: string) {
  const score = Number(o.satisfaction_score || 0);
  const stars = "★".repeat(Math.max(0, Math.min(5, score))) + "☆".repeat(Math.max(0, 5 - score));
  const link = baseUrl ? `${baseUrl}/database-orders.html?id=${encodeURIComponent(String(o.id || ""))}` : "";
  const subject = `[CB Media Hub] Client đã đánh giá ${score}★ — ${o.id || ""}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
      <h2 style="color:#191970;margin:0 0 12px">⭐ Client đã hoàn thành đánh giá</h2>
      <table cellpadding="0" cellspacing="0" style="font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Mã order</td><td><strong>${esc(o.id)}</strong> · ${esc(o.project_name || "")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Điểm</td><td><strong style="color:#f59e0b">${stars}</strong> (${score}/5)</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Nhận xét</td><td>${esc(o.client_feedback || "—")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Client</td><td>${esc(o.requester_name || "")} · ${esc(o.requester_email || "")}</td></tr>
      </table>
      ${link ? `<p style="margin:16px 0"><a href="${esc(link)}" style="background:#191970;color:#fff;padding:10px 18px;border-radius:9999px;text-decoration:none">Mở order →</a></p>` : ""}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">Email tự động từ CB Media Hub — không trả lời email này.</p>
    </div>`;
  return { subject, html };
}

async function sendResend(subject: string, html: string): Promise<Response> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("NOTIFY_EMAIL_TO");
  const from = Deno.env.get("NOTIFY_EMAIL_FROM") || "CB Media Hub <onboarding@resend.dev>";
  if (!apiKey || !to) {
    return json({ ok: false, skipped: "RESEND_API_KEY / NOTIFY_EMAIL_TO chưa set trong secrets" }, 200);
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      // Hỗ trợ nhiều người nhận: NOTIFY_EMAIL_TO="a@cb.vn,b@cb.vn"
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      subject,
      html,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("[notify-email] Resend error:", res.status, body);
    return json({ ok: false, provider_status: res.status, provider_body: body }, 200);
  }
  return json({ ok: true }, 200);
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Bảo vệ endpoint (function deploy --no-verify-jwt): so khớp secret header từ webhook.
  const expected = Deno.env.get("NOTIFY_EMAIL_SECRET");
  if (expected && req.headers.get("x-notify-secret") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  if (payload.table !== "orders" || !payload.record) return json({ ok: true, skipped: "not orders" });
  const rec = payload.record;
  const baseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/+$/, "");

  // ---- Case 1: order MỚI từ client (INSERT, không phải order nội bộ) ----
  if (payload.type === "INSERT") {
    if (isInternalOrder(rec)) return json({ ok: true, skipped: "internal order" });
    const { subject, html } = mailNewOrder(rec, baseUrl);
    return await sendResend(subject, html);
  }

  // ---- Case 2: client hoàn thành rating (UPDATE: satisfaction_score NULL → có) ----
  if (payload.type === "UPDATE") {
    const before = payload.old_record?.satisfaction_score ?? null;
    const after = rec.satisfaction_score ?? null;
    if (before == null && after != null) {
      const { subject, html } = mailRating(rec, baseUrl);
      return await sendResend(subject, html);
    }
    return json({ ok: true, skipped: "update not a new rating" });
  }

  return json({ ok: true, skipped: "event ignored" });
});
