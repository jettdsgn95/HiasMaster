/* =====================================================================
   CB Media Hub — Shared application logic
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Theme (light / dark / system) ---------- */
  const THEME_KEY = 'mh-theme';
  const root = document.documentElement;

  function getStoredTheme() { return localStorage.getItem(THEME_KEY); }
  function systemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    const btns = document.querySelectorAll('[data-theme-toggle]');
    btns.forEach((b) => {
      b.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      const sun = b.querySelector('.icon-sun');
      const moon = b.querySelector('.icon-moon');
      if (sun && moon) {
        sun.style.display = theme === 'dark' ? 'block' : 'none';
        moon.style.display = theme === 'dark' ? 'none' : 'block';
      }
    });
  }

  const initial = getStoredTheme() || systemTheme();
  applyTheme(initial);

  // React to system change only when user hasn't picked
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getStoredTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  /* ---------- Mobile nav toggle ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-menu-toggle]');
    if (!t) return;
    const nav = document.getElementById('site-nav');
    if (!nav) return;
    const open = nav.classList.toggle('is-open');
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ---------- Active nav link ---------- */
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href === path || (path === '' && href === 'index.html')) a.classList.add('is-active');
  });

  /* ---------- Toast ---------- */
  function ensureToastWrap() {
    let w = document.querySelector('.toast-wrap');
    if (!w) {
      w = document.createElement('div');
      w.className = 'toast-wrap';
      w.setAttribute('aria-live', 'polite');
      w.setAttribute('aria-atomic', 'false');
      document.body.appendChild(w);
    }
    return w;
  }
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };
  function toast(opts) {
    const { type = 'info', title = '', message = '', duration = 4000 } = (typeof opts === 'string' ? { message: opts } : opts) || {};
    const wrap = ensureToastWrap();
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `
      <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
      <div class="grow">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-msg">${message}</div>
      </div>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 240ms, transform 240ms';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 250);
    }, duration);
  }
  window.MH = window.MH || {};
  window.MH.toast = toast;

  /* ---------- Copy helpers ---------- */
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-copy]');
    if (!t) return;
    const text = t.getAttribute('data-copy');
    try {
      await navigator.clipboard.writeText(text);
      toast({ type: 'success', title: 'Đã sao chép', message: text });
    } catch {
      toast({ type: 'error', message: 'Không thể sao chép. Vui lòng thử lại.' });
    }
  });

  /* ---------- Smooth section nav (for help / request side-nav) ---------- */
  document.querySelectorAll('[data-scroll-spy]').forEach((nav) => {
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const targets = links.map((l) => document.querySelector(l.getAttribute('href'))).filter(Boolean);
    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + entry.target.id));
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
  });

  /* ---------- Year ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
})();
