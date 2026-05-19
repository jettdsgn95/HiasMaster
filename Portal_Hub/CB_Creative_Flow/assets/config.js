/* =====================================================================
   CB Media Hub — Runtime Config
   Static site không có process.env, nên config phải hardcode hoặc set runtime.

   Cách dùng:
   1. Fill SENTRY_DSN sau khi tạo project trên sentry.io (Settings → Client Keys).
   2. DSN public-safe — Sentry thiết kế để client expose. Đừng để JWT/API key ở đây.
   3. ENV phân biệt 'production' (Railway) vs 'staging' vs 'local' để tag errors.
   4. RELEASE bump khi deploy version mới — Sentry group errors theo release.

   File này LOAD TRƯỚC `app.js` trên mọi page (xem các <script> tag trong HTML).
   ===================================================================== */
window.MH_CONFIG = {
  // Sentry error tracking — leave empty to disable.
  SENTRY_DSN: '',
  SENTRY_ENV: (function () {
    var host = (typeof location !== 'undefined' && location.hostname) || '';
    if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return 'local';
    if (host.includes('railway.app') || host.includes('up.railway.app')) return 'production';
    return 'production';
  })(),
  SENTRY_RELEASE: 'cb-creative-flow@1.0.0',

  // Supabase (Phase 1) — fill sau khi tạo project tại supabase.com.
  // SUPABASE_URL: dạng https://lmfdicjjyrmbleyqemul.supabase.co/rest/v1/ (Project Settings → API).
  // SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZmRpY2pqeXJtYmxleXFlbXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjcyOTAsImV4cCI6MjA5NDc0MzI5MH0.p4s-KigKCAMRdB34q5aLp1cERbjNEG6xt_mpx_ngnB4 (PUBLIC-SAFE — frontend dùng key này;
  // backend service-role key KHÔNG được đặt ở đây).
  // Để trống = data-store.js auto fallback localStorage (giữ static demo flow).
  SUPABASE_URL: 'https://lmfdicjjyrmbleyqemul.supabase.co/',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZmRpY2pqeXJtYmxleXFlbXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjcyOTAsImV4cCI6MjA5NDc0MzI5MH0.p4s-KigKCAMRdB34q5aLp1cERbjNEG6xt_mpx_ngnB4',

  // App metadata
  APP_NAME: 'CB Media Hub',
  APP_VERSION: '1.0.0',

  // Feature flags (frontend-side; backend cũng cần đồng bộ khi nối DB)
  FEATURES: {
    AI_VOICE: true,
    AI_TOOLS: true,
    CHATBOT: true,
    SUPABASE_DB: true   // Enable khi đã fill URL + KEY ở trên + verify migration OK
  }
};
