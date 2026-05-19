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
      // Mirror Supabase session sang `mh-user` cho compat với code hiện tại
      client.auth.onAuthStateChange(function (event, session) {
        try {
          if (session && session.user) {
            // Lấy public.users row để có role/name/initials/avatar
            client.from('users').select('*').eq('id', session.user.id).maybeSingle()
              .then(function (res) {
                var u = res && res.data ? res.data : null;
                var mhUser = {
                  id: session.user.id,
                  email: session.user.email,
                  role: (u && u.role) || (session.user.user_metadata && session.user.user_metadata.role) || 'client',
                  name: (u && u.name) || (session.user.user_metadata && session.user.user_metadata.name) || session.user.email,
                  initials: (u && u.initials) || '',
                  title: (u && u.title) || '',
                  avatar: (u && u.avatar_url) || '',
                  phone: (u && u.phone) || '',
                  department: (u && u.department) || '',
                  bio: (u && u.bio) || ''
                };
                localStorage.setItem('mh-user', JSON.stringify(mhUser));
              })
              .catch(function () { /* swallow */ });
          } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem('mh-user');
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
