/* assets/notif-icons.js — SINGLE SOURCE OF TRUTH cho icon thông báo.
   Dùng chung bởi app.js (header bell dropdown, internal + client) và
   client-dashboard.js (panel tab "Thông báo" của Client Portal).
   Sửa icon/màu Ở ĐÂY là mọi surface (bell, panel, toast) tự đồng bộ — hết rủi ro lệch.
   Load TRƯỚC app.js trên mọi page. Outline SVG style Lucide đồng bộ sidebar:
   stroke-width 2, currentColor, rounded; class màu (is-accent/is-danger) do từng
   surface tự style (app.js dùng var(--brand-600), client dùng var(--primary)). */
(function () {
  window.MH = window.MH || {};
  if (window.MH.notifIcons) return; // idempotent — chỉ định nghĩa 1 lần

  // Key = Supabase notification.type (order_new, order_confirmed, delivery_preview, …)
  var PATHS = {
    order_new:            '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    order_status_changed: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    order_confirmed:      '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    order_needinfo:       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    order_cancelled:      '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    task_assigned:        '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    task_status_changed:  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    task_comment:         '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    delivery_preview:     '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    client_feedback_received: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
    delivery_final:       '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    rating_received:      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    system:               '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
  };

  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  window.MH.notifIcons = {
    PATHS: PATHS,
    // → { svg, cls } : cls = '' | 'is-accent' (navy) | 'is-danger' (red)
    get: function (type) {
      var inner = PATHS[type] || PATHS.system;
      var cls = '';
      if (type === 'order_new' || type === 'task_assigned' || type === 'client_feedback_received') cls = 'is-accent';
      else if (type === 'order_cancelled' || type === 'order_needinfo') cls = 'is-danger';
      return { svg: svg(inner), cls: cls };
    },
    // Bỏ emoji/ký hiệu dẫn đầu trong title cũ (📥 🎯 🚀 ✅ ⚠ ❌ 👀 📦 🔎 …)
    stripEmoji: function (s) {
      return String(s == null ? '' : s).replace(/^[\p{Extended_Pictographic}☀-➿⬀-⯿️‍\s]+/u, '').trim();
    }
  };
})();
