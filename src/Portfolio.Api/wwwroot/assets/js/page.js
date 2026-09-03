/* ==========================================================================
   page.js — dựng vỏ trang portfolio (nav/hero/about/services/contact) từ config.
   Được dùng bởi cả site.js (trang thật) và preview.js (khung xem trước),
   nên preview luôn khớp 100% với trang thật.
   ========================================================================== */

import { applyTheme, renderSections } from './renderer.js';
import { createReveal, createParallax, createCursorGlow, createLightbox, splitLines } from './motion.js';

const $ = (id) => document.getElementById(id);

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Vẽ toàn bộ trang từ cấu hình. Gọi lại được nhiều lần (preview cập nhật liên tục). */
export function paintPage(cfg) {
  applyTheme(cfg.theme);
  document.documentElement.dataset.glow = cfg.theme?.cursorGlow === 'off' ? 'off' : 'on';

  paintMeta(cfg.site);
  paintNav(cfg);
  paintHero(cfg.site);
  paintAbout(cfg.site);
  paintServices(cfg.site.services || []);
  paintContact(cfg.site);
  renderSections($('work'), (cfg.sections || []).filter(s => s.visible !== false));
}

function paintMeta(site) {
  document.title = `${site.title} — ${site.tagline}`;
  document.querySelector('meta[name=description]')?.setAttribute('content', site.tagline || '');
  const mark = $('bootMark');
  if (mark) mark.textContent = site.logoText || site.title;
  $('logo').innerHTML = `${escapeHtml(site.logoText || site.title)}<span>.</span>`;
  $('footerNote').textContent = site.footerNote || site.title;

  const words = [site.tagline, 'Chân dung', 'Phóng sự cưới', 'Lookbook', site.address].filter(Boolean);
  // nhân đôi để vòng lặp translateX(-50%) liền mạch
  $('marquee').innerHTML = [...words, ...words].map(w => `<span>${escapeHtml(w)}</span>`).join('');
}

function paintNav(cfg) {
  const links = (cfg.sections || [])
    .filter(s => s.visible !== false)
    .map(s => ({ href: '#sec-' + s.id, label: s.name }));
  links.push({ href: '#about', label: 'Về tôi' }, { href: '#services', label: 'Dịch vụ' }, { href: '#contact', label: 'Liên hệ' });
  $('navLinks').innerHTML = links
    .map(l => `<a class="nav__link" href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`).join('');
}

function paintHero(site) {
  $('heroEyebrow').textContent = site.tagline || '';
  $('heroSub').textContent = site.heroSub || '';

  const title = $('heroTitle');
  title.textContent = site.heroHeadline || site.title;
  splitLines(title, 70);
  requestAnimationFrame(() => title.querySelectorAll('.split-line').forEach(l => l.classList.add('is-in')));

  $('heroActions').innerHTML = `
    <a class="btn" href="${escapeHtml(site.heroCtaLink || '#work')}">${escapeHtml(site.heroCtaText || 'Xem portfolio')}</a>
    <a class="btn btn--ghost" href="#contact">Nhận báo giá</a>`;

  const bg = $('heroBg');
  bg.replaceChildren();
  if (site.heroImage) {
    bg.classList.remove('hero__bg--fallback');
    const img = document.createElement('img');
    img.src = site.heroImage;
    img.alt = '';
    img.fetchPriority = 'high';
    bg.append(img);
  } else {
    bg.classList.add('hero__bg--fallback');
  }
}

function paintAbout(site) {
  $('aboutBody').textContent = site.about || '';
  $('aboutStats').innerHTML = `
    <div class="about__stat"><b data-count="8">0</b><span>Năm kinh nghiệm</span></div>
    <div class="about__stat"><b data-count="240">0</b><span>Buổi chụp</span></div>
    <div class="about__stat"><b data-count="35">0</b><span>Đám cưới / năm</span></div>`;

  const photo = $('aboutPhoto');
  photo.replaceChildren();
  if (site.aboutImage) {
    const img = document.createElement('img');
    img.src = site.aboutImage;
    img.alt = 'Ảnh nhiếp ảnh gia';
    img.loading = 'lazy';
    photo.append(img);
  }
}

function paintServices(services) {
  $('servicesGrid').innerHTML = services.map((s, i) => `
    <article class="service ${s.featured ? 'service--featured' : ''}" data-anim="fade-up" style="--d:${i * 110}ms">
      ${s.featured ? '<span class="service__tag">Phổ biến</span>' : ''}
      <h3 class="service__name">${escapeHtml(s.name)}</h3>
      <div class="service__price">${escapeHtml(s.price)}</div>
      <p class="service__desc">${escapeHtml(s.description || '')}</p>
      <ul class="service__list">${(s.includes || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    </article>`).join('');
}

function paintContact(site) {
  const mail = $('contactMail');
  mail.textContent = site.email || '';
  mail.href = 'mailto:' + (site.email || '');

  $('contactMeta').innerHTML = [site.phone, site.address]
    .filter(Boolean).map(x => `<span>${escapeHtml(x)}</span>`).join('');

  const socials = [['Instagram', site.instagram], ['Facebook', site.facebook], ['Behance', site.behance]]
    .filter(([, url]) => url);
  $('footerSocial').innerHTML = socials
    .map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`).join('');
}

/** Bật các hiệu ứng chạy theo cuộn. Trả về API để refresh sau khi vẽ lại. */
export function startMotion(cfg) {
  const reveal = createReveal(document);
  const parallax = createParallax(document);
  const lightbox = createLightbox(document);
  if (cfg?.theme?.cursorGlow !== 'off') createCursorGlow();

  initScrollChrome();
  initNavToggle();
  animateStats();

  const refresh = () => { reveal.refresh(); parallax.refresh(); lightbox.refresh(); animateStats(); };
  window.addEventListener('load', refresh);
  return { refresh };
}

function initScrollChrome() {
  const nav = $('nav');
  const progressBar = $('progress');
  let queued = false;

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const y = window.scrollY;
      nav.classList.toggle('is-stuck', y > 40);
      const max = document.body.scrollHeight - window.innerHeight;
      if (progressBar) progressBar.style.width = max > 0 ? (y / max) * 100 + '%' : '0';

      const links = Array.from(document.querySelectorAll('.nav__link'));
      let active = null;
      for (const link of links) {
        const target = document.querySelector(link.getAttribute('href'));
        if (target && target.getBoundingClientRect().top <= window.innerHeight * 0.35) active = link;
      }
      links.forEach(l => l.classList.toggle('is-active', l === active));
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initNavToggle() {
  const nav = $('nav');
  const burger = $('burger');
  if (!burger) return;
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $('navLinks').addEventListener('click', (e) => {
    if (e.target.closest('a')) nav.classList.remove('is-open');
  });
}

/** Số liệu đếm lên khi khối "Về tôi" vào tầm nhìn. */
function animateStats() {
  const nodes = document.querySelectorAll('[data-count]:not([data-counted])');
  if (!nodes.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      entry.target.dataset.counted = '1';
      const target = Number(entry.target.dataset.count);
      const started = performance.now();
      const step = (now) => {
        const t = Math.min((now - started) / 1400, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        entry.target.textContent = Math.round(target * eased) + (t === 1 ? '+' : '');
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.6 });
  nodes.forEach(n => io.observe(n));
}
