/* =====================================================================
   CB Media Hub — Supabase client loader (no bundler)
   - Load @supabase/supabase-js v2 từ esm.sh CDN qua dynamic import
   - Expose window.MH.supabase + window.MH.supabaseReady (Promise)
   - Skip nếu config trống → giữ static demo flow
   ===================================================================== */
(function () {
  'use strict';

  window.MH = window.MH || {};
  var cfg = window.MH_CONFIG || {};
  var URL = cfg.SUPABASE_URL || '';
  var KEY = cfg.SUPABASE_ANON_KEY || '';

  // Không cấu hình → expose stub để data-store.js auto fallback localStorage
  if (!URL || !KEY) {
    window.MH.supabase = null;
    window.MH.supabaseReady = Promise.resolve(null);
    window.MH.supabaseEnabled = false;
    return;
  }

  window.MH.supabaseEnabled = true;
  window.MH.supabaseReady = (async function () {
    try {
      // ESM bundle từ esm.sh — không cần npm install hay bundler
      var mod = await import('https://esm.sh/@supabase/supabase-js@2.45.4?bundle');
      var client = mod.createClient(URL, KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'mh-sb-auth'
        },
        global: {
          headers: { 'x-application-name': 'cb-media-hub' }
        }
      });
      window.MH.supabase = client;

      function readMhUser() {
        try { return JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { return null; }
      }

      // Mirror Supabase session sang `mh-user` cho compat với code hiện tại.
      //
      // QUAN TRỌNG (fix "tự đăng xuất" / bị đá về login — 2026-07-10):
      // Handler này chạy MỖI auth event (SIGNED_IN / INITIAL_SESSION /
      // TOKEN_REFRESHED / USER_UPDATED / SIGNED_OUT). Trước đây nó:
      //   (a) ghi đè mh-user vô điều kiện — nếu query users row transient-fail
      //       (mạng/RLS) thì res.data=null → fallback role='client' (SSO user
      //       không có user_metadata.role) → admin/account bị HẠ role → guard
      //       trang đá về login = cảm giác "tự đăng xuất".
      //   (b) xóa mh-user ngay khi có SIGNED_OUT — nhưng token-refresh churn /
      //       nhiều tab cũng phát SIGNED_OUT tạm thời → mất session oan.
      // Giờ: chỉ ghi khi LẤY ĐƯỢC users row (hoặc lần đầu chưa có mh-user),
      // luôn MERGE với mh-user cũ để không bao giờ regress role/name; và khi
      // SIGNED_OUT còn double-check getSession() trước khi xóa.
      client.auth.onAuthStateChange(function (event, session) {
        try {
          if (session && session.user) {
            client.from('users').select('*').eq('id', session.user.id).maybeSingle()
              .then(function (res) {
                var prev = readMhUser() || {};
                var samePrev = prev && prev.id === session.user.id ? prev : {};
                var u = res && res.data ? res.data : null;
                var meta = session.user.user_metadata || {};

                // ── Guard tài khoản bị khoá (2026-08-03) ────────────────
                // Admin deactivate/suspend/archive user ⇒ profile.status đổi,
                // nhưng token cũ vẫn còn hiệu lực tới khi hết hạn. Ở đây phát
                // hiện ngay lần auth event kế tiếp và ĐÁ RA.
                // CHỈ chạy khi ĐỌC ĐƯỢC row thật (u) — query lỗi/mạng chập trả
                // null thì tuyệt đối không logout (bài học "tự đăng xuất" 2026-07-10).
                if (u && u.status && u.status !== 'active') {
                  localStorage.removeItem('mh-user');
                  try { sessionStorage.setItem('mh-locked-reason', u.status); } catch (e) {}
                  client.auth.signOut().finally(function () {
                    var onLogin = /login\.html$/i.test(location.pathname) || location.pathname === '/login';
                    if (!onLogin) location.replace('login.html?locked=' + encodeURIComponent(u.status));
                  });
                  return;
                }

                // Không có users row + đã có mh-user hợp lệ của CHÍNH user này
                // → GIỮ NGUYÊN, tuyệt đối không hạ role về 'client'.
                if (!u && samePrev.role) return;

                var mhUser = {
                  id: session.user.id,
                  email: session.user.email || samePrev.email || '',
                  role: (u && u.role) || samePrev.role || meta.role || 'client',
                  name: (u && u.name) || samePrev.name || meta.name || session.user.email,
                  initials: (u && u.initials) || samePrev.initials || '',
                  title: (u && u.title) || samePrev.title || '',
                  avatar: (u && u.avatar_url) || samePrev.avatar || '',
                  phone: (u && u.phone) || samePrev.phone || '',
                  department: (u && u.department) || samePrev.department || '',
                  bio: (u && u.bio) || samePrev.bio || ''
                };
                localStorage.setItem('mh-user', JSON.stringify(mhUser));
              })
              .catch(function () { /* transient — giữ mh-user cũ, không đụng */ });
          } else if (event === 'SIGNED_OUT') {
            // Double-check: token-refresh churn có thể phát SIGNED_OUT tạm thời
            // dù session vẫn còn → chỉ xóa khi THỰC SỰ hết session.
            client.auth.getSession()
              .then(function (r) {
                if (!(r && r.data && r.data.session)) localStorage.removeItem('mh-user');
              })
              .catch(function () { localStorage.removeItem('mh-user'); });
          }
        } catch (e) { /* swallow */ }
      });
      return client;
    } catch (err) {
      console.warn('[MH] Supabase load failed, falling back to localStorage:', err);
      window.MH.supabase = null;
      window.MH.supabaseEnabled = false;
      return null;
    }
  })();
})();
