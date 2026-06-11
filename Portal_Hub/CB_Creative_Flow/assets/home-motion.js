/* =====================================================================
   CB Media Hub — Homepage motion (GSAP + ScrollTrigger)
   - Additive & an toàn: nếu GSAP không load (mất mạng) HOẶC prefers-reduced-motion
     → trang vẫn hiển thị đầy đủ, không animate.
   - KHÔNG đụng hero entrance: .fade-up (CSS) giữ nguyên để tránh chạy 2 lần.
   - Chỉ thêm: count-up số liệu, scroll-reveal các section, parallax hero,
     thanh tiến trình cuộn, header đổ bóng khi cuộn, hover thẻ, magnetic CTA.
   ===================================================================== */
(function () {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return; // fallback: nội dung vẫn opacity:1
  gsap.registerPlugin(ScrollTrigger);

  // Đếm số giữ phần đuôi (h / % / +) và số thập phân
  function countUp(el, play) {
    var raw = el.dataset.final || el.textContent.trim();
    el.dataset.final = raw;
    var m = raw.match(/^([\d.]+)(.*)$/);
    if (!m) return;
    var end = parseFloat(m[1]);
    var suffix = m[2];
    var dec = (m[1].split('.')[1] || '').length;
    if (!play) { el.textContent = raw; return; }
    var o = { v: 0 };
    gsap.to(o, {
      v: end, duration: 1.5, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 95%' },
      onUpdate: function () { el.textContent = o.v.toFixed(dec) + suffix; }
    });
  }

  gsap.matchMedia().add({
    full: '(prefers-reduced-motion: no-preference)',
    reduce: '(prefers-reduced-motion: reduce)'
  }, function (ctx) {
    var full = ctx.conditions.full;

    // Count-up chạy ở cả 2 chế độ (reduce → hiện luôn giá trị cuối)
    document.querySelectorAll('[data-countup]').forEach(function (el) { countUp(el, full); });

    if (!full) {
      var barR = document.querySelector('#gsap-progress');
      if (barR) gsap.set(barR, { scaleX: 0 });
      return; // reduce: dừng ở đây, không animate
    }

    // 1) Scroll-reveal các section
    gsap.from('.quick-card', {
      y: 40, opacity: 0, duration: .6, stagger: .1,
      scrollTrigger: { trigger: '.quick-grid', start: 'top 80%' }
    });
    gsap.from('.wf-step', {
      y: 36, opacity: 0, duration: .55, stagger: .12,
      scrollTrigger: { trigger: '.workflow', start: 'top 82%' }
    });
    gsap.from('.lookup-card', {
      y: 40, opacity: 0, duration: .7,
      scrollTrigger: { trigger: '.lookup-card', start: 'top 85%' }
    });
    gsap.from('.faq-item', {
      y: 24, opacity: 0, duration: .5, stagger: .12,
      scrollTrigger: { trigger: '.faq-list', start: 'top 85%' }
    });
    gsap.from('.support-strip', {
      y: 40, opacity: 0, scale: .98, duration: .7,
      scrollTrigger: { trigger: '.support-strip', start: 'top 85%' }
    });

    // 2) Hover micro-interaction cho 4 thẻ tác vụ
    document.querySelectorAll('.quick-card').forEach(function (card) {
      var icon = card.querySelector('.quick-icon');
      card.addEventListener('mouseenter', function () {
        gsap.to(card, { y: -8, duration: .3, ease: 'power2.out', overwrite: true });
        if (icon) gsap.to(icon, { scale: 1.12, rotate: -4, duration: .35, ease: 'back.out(2)' });
      });
      card.addEventListener('mouseleave', function () {
        gsap.to(card, { y: 0, duration: .4, ease: 'power3.out', overwrite: true });
        if (icon) gsap.to(icon, { scale: 1, rotate: 0, duration: .35, ease: 'power2.out' });
      });
    });

    // 3) Parallax lớp trang trí hero
    gsap.to('.hero-bg', {
      yPercent: 18, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .4 }
    });
    gsap.to('.hero-graphic-wrap', {
      yPercent: -8, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 }
    });

    // 4) Thanh tiến trình cuộn
    var bar = document.querySelector('#gsap-progress');
    if (bar) gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: .3 }
    });

    // 5) Header đổ bóng khi rời đỉnh trang
    var header = document.querySelector('.site-header');
    if (header) ScrollTrigger.create({
      start: 'top -8',
      onUpdate: function (self) { header.classList.toggle('is-scrolled', self.scroll() > 8); }
    });

    // 6) Magnetic CTA — nút "Gửi yêu cầu ngay" hút nhẹ theo con trỏ
    var magnet = document.querySelector('.btn-hero');
    if (magnet) {
      magnet.addEventListener('mousemove', function (e) {
        var r = magnet.getBoundingClientRect();
        gsap.to(magnet, {
          x: (e.clientX - r.left - r.width / 2) * .3,
          y: (e.clientY - r.top - r.height / 2) * .4,
          duration: .4, ease: 'power3.out'
        });
      });
      magnet.addEventListener('mouseleave', function () {
        gsap.to(magnet, { x: 0, y: 0, duration: .5, ease: 'elastic.out(1,.4)' });
      });
    }
  });
})();
