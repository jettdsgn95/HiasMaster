/* ============================================================
   i18n.js — Lightweight language toggle (VN ⇄ EN)
   ============================================================
   Phase 1 (UI only):
   - Persists choice in localStorage['mh-lang'] ('vi' | 'en').
   - Sets <html lang="...">.
   - Wires .lang-pill click → toggle + label update + reload page.
   - Translates a small set of common header/nav/button strings via
     data-i18n="key" attribute. Full page-content translation is
     deferred — most copy stays Vietnamese-first as-is.
   ============================================================ */
(function () {
  const LS_KEY = 'mh-lang';
  const DEFAULT_LANG = 'vi';

  /* Tiny dictionary for the most-visible chrome (header bar, profile menu,
     common buttons). Add keys as needed via data-i18n="key" attribute. */
  const DICT = {
    vi: {
      'menu.profile': 'Hồ sơ cá nhân',
      'menu.settings': 'Cài đặt',
      'menu.logout': 'Đăng xuất',
      'aria.notifications': 'Thông báo',
      'aria.theme': 'Chuyển chế độ sáng/tối',
      'aria.lang': 'Chuyển ngôn ngữ',
    },
    en: {
      'menu.profile': 'My profile',
      'menu.settings': 'Settings',
      'menu.logout': 'Log out',
      'aria.notifications': 'Notifications',
      'aria.theme': 'Toggle light/dark mode',
      'aria.lang': 'Switch language',
    }
  };

  function getLang() {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_LANG; } catch (e) { return DEFAULT_LANG; }
  }
  function setLang(lang) {
    if (lang !== 'vi' && lang !== 'en') lang = DEFAULT_LANG;
    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    document.documentElement.setAttribute('lang', lang === 'vi' ? 'vi' : 'en');
  }
  function t(key) {
    const lang = getLang();
    return (DICT[lang] && DICT[lang][key]) || (DICT.vi[key] || key);
  }
  function applyTranslations(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const val = t(key);
      if (val) {
        // Preserve nested <svg> if any — only replace text node
        const svg = el.querySelector('svg');
        if (svg) {
          // Replace text after svg
          let textNode = null;
          el.childNodes.forEach((n) => { if (n.nodeType === 3 && n.textContent.trim()) textNode = n; });
          if (textNode) textNode.textContent = ' ' + val;
          else el.appendChild(document.createTextNode(' ' + val));
        } else {
          el.textContent = val;
        }
      }
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      const val = t(key);
      if (val) el.setAttribute('aria-label', val);
    });
  }
  function updatePillLabel(pill) {
    if (!pill) return;
    pill.textContent = getLang() === 'vi' ? 'VN' : 'EN';
  }
  function initPill() {
    const pill = document.getElementById('lang-toggle');
    if (!pill) return;
    updatePillLabel(pill);
    pill.addEventListener('click', () => {
      const next = getLang() === 'vi' ? 'en' : 'vi';
      setLang(next);
      updatePillLabel(pill);
      applyTranslations(document);
    });
  }

  // Apply chosen lang to <html> as soon as possible
  setLang(getLang());

  // Expose
  window.MH = window.MH || {};
  window.MH.i18n = { getLang, setLang, t, apply: applyTranslations };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initPill(); applyTranslations(document); });
  } else {
    initPill();
    applyTranslations(document);
  }
})();
