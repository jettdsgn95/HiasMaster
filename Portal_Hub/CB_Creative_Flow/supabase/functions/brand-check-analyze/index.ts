// =====================================================================
// CB AI Brand Safety Checker — Edge Function `brand-check-analyze`
//
// Nhiệm vụ: nhận storage path ảnh + metadata → tải ảnh (service role) →
// gọi AI Vision (Anthropic mặc định; OpenAI/Gemini qua env) → parse JSON →
// chạy override rule engine server-side → trả kết quả cuối cho frontend.
//
// API key CHỈ nằm ở đây (Supabase secrets) — không bao giờ lộ ra frontend.
//
// Deploy:
//   supabase functions deploy brand-check-analyze
//   supabase secrets set BRAND_CHECK_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-...
//   # tùy chọn: BRAND_CHECK_MODEL (mặc định claude-opus-4-8)
//   # đổi provider: BRAND_CHECK_PROVIDER=openai + OPENAI_API_KEY (+ BRAND_CHECK_MODEL=gpt-4o...)
//   #               BRAND_CHECK_PROVIDER=gemini + GEMINI_API_KEY (+ BRAND_CHECK_MODEL=gemini-2.0-flash...)
//
// Request body (JSON, gọi qua supabase.functions.invoke — JWT user tự đính kèm):
//   { storage_path: string, mime_type: string, metadata: {...form fields...} }
// Response: JSON theo schema mục 15 planning doc + override đã áp.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- System prompt (mục 16 planning doc) ----------
const SYSTEM_PROMPT = `You are the AI Brand Safety Reviewer for CB Centres, an English education system in Vietnam.

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

Write "summary", "findings", "recommendation", "detected_issues", "required_actions" in Vietnamese.
Return only valid JSON. Do not include markdown. Do not include explanations outside JSON.`;

// ---------- JSON schema (mục 15 planning doc) — ép output hợp lệ ----------
const CRITERION_SCHEMA = {
  type: "object",
  properties: {
    code: {
      type: "string",
      enum: ["logo_identity", "brand_color", "text_quality", "ai_artifacts", "education_suitability", "communication_risk"],
    },
    name: { type: "string" },
    status: { type: "string", enum: ["pass", "warning", "fail"] },
    score: { type: "integer" },
    max_score: { type: "integer" },
    findings: { type: "string" },
    recommendation: { type: "string" },
  },
  required: ["code", "name", "status", "score", "max_score", "findings", "recommendation"],
  additionalProperties: false,
};

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    overall_score: { type: "integer" },
    status: { type: "string", enum: ["PASS", "NEEDS_REVISION", "FAIL", "REQUIRES_MEDIA_REVIEW"] },
    risk_group_recommendation: {
      type: "string",
      enum: ["group_1_internal", "group_2_self_check", "group_3_media_review"],
    },
    requires_media_review: { type: "boolean" },
    summary: { type: "string" },
    criteria: { type: "array", items: CRITERION_SCHEMA },
    detected_issues: { type: "array", items: { type: "string" } },
    required_actions: { type: "array", items: { type: "string" } },
    override_rules_triggered: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: [
    "overall_score", "status", "risk_group_recommendation", "requires_media_review",
    "summary", "criteria", "detected_issues", "required_actions",
    "override_rules_triggered", "confidence",
  ],
  additionalProperties: false,
};

// ---------- User prompt kèm metadata (mục 17 planning doc) ----------
function buildUserPrompt(m: Record<string, unknown>): string {
  return `Please review this image for CB Centres AI Brand Safety.

Usage metadata:
- Title: ${m.title ?? ""}
- Unit/Branch: ${m.unit_name ?? ""} / ${m.branch_name ?? ""}
- Usage purpose: ${m.usage_purpose ?? ""}
- Usage channel: ${m.usage_channel ?? ""}
- Usage group selected by user: ${m.usage_group ?? ""}
- Planned publish date: ${m.planned_publish_date ?? ""}
- Has CB logo: ${!!m.has_logo}
- Has mascot Cici: ${!!m.has_mascot}
- Has CB uniform: ${!!m.has_uniform}
- Has CB facility/classroom/signage: ${!!m.has_cb_facility}
- Is admission/ads/promotion/campaign: ${!!m.is_admission_or_ads}
- Involves partner/school/external organization: ${!!m.involves_partner}
- Contains tuition/certificate/exam/quality commitment or sensitive information: ${!!m.contains_sensitive_info}

Evaluate the image according to the CB Centres brand safety criteria. Be conservative for public-facing content. Return only valid JSON.`;
}

// ---------- Override rule engine (mục 18 planning doc) — chạy server-side ----------
// Frontend cũng có bản mirror trong brand-check.js (demo mode); nguồn chuẩn là đây.
function applyOverrideRules(aiResult: any, metadata: Record<string, unknown>) {
  const overrides: string[] = [];

  if (metadata.usage_group === "group_3_media_review") {
    overrides.push("Nội dung thuộc Nhóm 3 - bắt buộc Media duyệt");
  }
  if (metadata.has_mascot && metadata.usage_channel !== "internal_classroom") {
    overrides.push("Có mascot Cici trong nội dung công khai");
  }
  if (metadata.is_admission_or_ads) {
    overrides.push("Nội dung tuyển sinh/quảng cáo/ưu đãi/chiến dịch");
  }
  if (metadata.involves_partner) {
    overrides.push("Nội dung liên quan đối tác/trường học/đơn vị bên ngoài");
  }
  if (metadata.contains_sensitive_info) {
    overrides.push("Nội dung có thông tin nhạy cảm/học phí/chứng chỉ/cam kết");
  }
  const logoCriterion = (aiResult.criteria || []).find((c: any) => c.code === "logo_identity");
  if (logoCriterion && logoCriterion.status === "fail") {
    overrides.push("Logo/nhận diện CB không đạt");
  }

  if (overrides.length > 0) {
    return {
      ...aiResult,
      status: "REQUIRES_MEDIA_REVIEW",
      requires_media_review: true,
      override_rules_triggered: [
        ...(aiResult.override_rules_triggered || []),
        ...overrides,
      ],
    };
  }
  return aiResult;
}

// ---------- base64 encode ảnh (chunk tránh tràn call stack với ảnh lớn) ----------
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ---------- Provider: Anthropic (mặc định) ----------
async function callAnthropic(imageB64: string, mimeType: string, userPrompt: string): Promise<any> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY chưa cấu hình (supabase secrets set ...)");
  const model = Deno.env.get("BRAND_CHECK_MODEL") || "claude-opus-4-8";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Structured outputs — ép response đúng RESULT_SCHEMA, không cần regex vá JSON.
      output_config: { format: { type: "json_schema", schema: RESULT_SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: imageB64 } },
          { type: "text", text: userPrompt },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("AI từ chối phân tích ảnh này (refusal)");
  const text = (data.content || []).find((b: any) => b.type === "text")?.text;
  if (!text) throw new Error("Anthropic không trả text block");
  return JSON.parse(text);
}

// ---------- Provider: OpenAI (đổi bằng BRAND_CHECK_PROVIDER=openai) ----------
async function callOpenAI(imageB64: string, mimeType: string, userPrompt: string): Promise<any> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY chưa cấu hình");
  const model = Deno.env.get("BRAND_CHECK_MODEL") || "gpt-4o";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageB64}` } },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "null");
}

// ---------- Provider: Gemini (đổi bằng BRAND_CHECK_PROVIDER=gemini) ----------
async function callGemini(imageB64: string, mimeType: string, userPrompt: string): Promise<any> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa cấu hình");
  const model = Deno.env.get("BRAND_CHECK_MODEL") || "gemini-2.0-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageB64 } },
            { text: userPrompt },
          ],
        }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "null");
}

// ---------- Sanity check kết quả AI (schema đã ép nhưng vẫn guard tối thiểu) ----------
function validateResult(r: any): void {
  if (!r || typeof r !== "object") throw new Error("AI trả JSON rỗng/không hợp lệ");
  if (typeof r.overall_score !== "number" || !Array.isArray(r.criteria)) {
    throw new Error("JSON thiếu overall_score/criteria");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { storage_path, mime_type, metadata } = await req.json();
    if (!storage_path || !mime_type) {
      return new Response(JSON.stringify({ error: "Thiếu storage_path/mime_type" }), {
        status: 400, headers: { ...CORS, "content-type": "application/json" },
      });
    }

    // Service role: tải ảnh từ bucket private (client không cần gửi lại ảnh).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: file, error: dlError } = await admin.storage
      .from("brand-check-images")
      .download(storage_path);
    if (dlError || !file) throw new Error(`Không tải được ảnh: ${dlError?.message || "unknown"}`);

    const imageB64 = toBase64(await file.arrayBuffer());
    const userPrompt = buildUserPrompt(metadata || {});

    const provider = (Deno.env.get("BRAND_CHECK_PROVIDER") || "anthropic").toLowerCase();
    let aiResult: any;
    if (provider === "openai") aiResult = await callOpenAI(imageB64, mime_type, userPrompt);
    else if (provider === "gemini") aiResult = await callGemini(imageB64, mime_type, userPrompt);
    else aiResult = await callAnthropic(imageB64, mime_type, userPrompt);

    validateResult(aiResult);

    // Rule engine server-side — không tin 100% kết luận AI.
    const finalResult = applyOverrideRules(aiResult, metadata || {});
    finalResult._provider = provider;

    return new Response(JSON.stringify(finalResult), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    // Frontend nhận lỗi → lưu record với ai_status NEEDS_MANUAL_REVIEW (fallback).
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
