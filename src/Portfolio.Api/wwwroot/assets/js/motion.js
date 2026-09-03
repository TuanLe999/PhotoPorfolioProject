/* ==========================================================================
   motion.js — hiệu ứng chạy khi cuộn: reveal, parallax, con trỏ phát sáng,
   lightbox. Dùng IntersectionObserver + rAF nên không tốn CPU khi đứng yên.
   ========================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Theo dõi mọi [data-anim] trong `root` và bật class .is-in khi lọt viewport.
 * Trả về đối tượng có refresh() để gọi lại sau khi DOM được dựng lại.
 */
export function createReveal(root = document, { scrollRoot = null, once = true } = {}) {
  if (reduceMotion) {
    return {
      refresh() {
        root.querySelectorAll('[data-anim], .split-line').forEach(n => n.classList.add('is-in'));
      }
    };
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        if (once) observer.unobserve(entry.target);
      } else if (!once) {
        entry.target.classList.remove('is-in');
      }
    }
  }, { root: scrollRoot, rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  const api = {
    refresh() {
      observer.disconnect();
      root.querySelectorAll('[data-anim]:not(.is-in), .split-line:not(.is-in)')
        .forEach(node => observer.observe(node));
    },
    destroy() { observer.disconnect(); }
  };
  api.refresh();
  return api;
}

/** Dịch nhẹ các phần tử [data-parallax] theo tiến trình cuộn. */
export function createParallax(root = document, scrollRoot = null) {
  if (reduceMotion) return { refresh() {} };

  let nodes = [];
  let ticking = false;

  const viewport = () => (scrollRoot ? scrollRoot.getBoundingClientRect() : { top: 0, height: window.innerHeight });

  function update() {
    ticking = false;
    const vp = viewport();
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - vp.top;
      const progress = (center - vp.height / 2) / vp.height; // -1..1
      const strength = Number(node.dataset.parallax) || 0;
      node.style.translate = `0 ${(progress * strength * -70).toFixed(2)}px`;
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  const target = scrollRoot || window;
  target.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  return {
    refresh() {
      nodes = Array.from(root.querySelectorAll('[data-parallax]'));
      update();
    },
    destroy() { target.removeEventListener('scroll', onScroll); }
  };
}

/** Quầng sáng đi theo con trỏ (tắt trên thiết bị cảm ứng). */
export function createCursorGlow() {
  if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return { destroy() {} };

  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.append(glow);

  let x = window.innerWidth / 2, y = window.innerHeight / 2, cx = x, cy = y, raf = 0;

  const onMove = (e) => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(loop); };
  function loop() {
    raf = 0;
    cx += (x - cx) * 0.12;
    cy += (y - cy) * 0.12;
    glow.style.translate = `${cx}px ${cy}px`;
    if (Math.abs(x - cx) > 0.4 || Math.abs(y - cy) > 0.4) raf = requestAnimationFrame(loop);
  }
  window.addEventListener('pointermove', onMove, { passive: true });

  return {
    destroy() {
      window.removeEventListener('pointermove', onMove);
      glow.remove();
    }
  };
}

/** Lightbox xem ảnh lớn, điều hướng bằng chuột và bàn phím. */
export function createLightbox(root = document) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.hidden = true;
  overlay.innerHTML = `
    <button class="lightbox__close" aria-label="Đóng">✕</button>
    <button class="lightbox__nav lightbox__nav--prev" aria-label="Ảnh trước">‹</button>
    <button class="lightbox__nav lightbox__nav--next" aria-label="Ảnh sau">›</button>
    <figure class="lightbox__stage"><img alt=""><figcaption></figcaption></figure>
    <div class="lightbox__counter"></div>`;
  document.body.append(overlay);

  const img = overlay.querySelector('img');
  const caption = overlay.querySelector('figcaption');
  const counter = overlay.querySelector('.lightbox__counter');
  let items = [];
  let current = 0;
  let lastFocus = null;

  function collect() {
    items = Array.from(root.querySelectorAll('[data-lightbox]'));
  }

  function show(i) {
    current = (i + items.length) % items.length;
    const node = items[current];
    img.src = node.dataset.lightbox;
    const text = node.querySelector('.pf-caption')?.textContent
      || node.querySelector('img')?.alt || '';
    caption.textContent = text;
    caption.hidden = !text;
    counter.textContent = `${current + 1} / ${items.length}`;
    img.classList.remove('is-in');
    requestAnimationFrame(() => img.classList.add('is-in'));
  }

  function open(i) {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    show(i);
    overlay.querySelector('.lightbox__close').focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; img.src = ''; }, 300);
    lastFocus?.focus?.();
  }

  root.addEventListener('click', (e) => {
    const frame = e.target.closest?.('[data-lightbox]');
    if (!frame) return;
    e.preventDefault();
    collect();
    open(items.indexOf(frame));
  });

  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.lightbox__nav--next')) return show(current + 1);
    if (e.target.closest('.lightbox__nav--prev')) return show(current - 1);
    if (e.target.closest('.lightbox__close') || e.target === overlay) return close();
  });

  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'ArrowLeft') show(current - 1);
  });

  return { open, close, refresh: collect };
}

/** Tách tiêu đề thành từng dòng để chạy hiệu ứng chữ dâng lên. */
export function splitLines(node, stagger = 90) {
  const text = node.textContent.trim();
  const words = text.split(/\s+/);
  node.replaceChildren();
  // mỗi từ là một .split-line -> trình duyệt tự wrap, hiệu ứng vẫn theo dòng chữ
  words.forEach((word, i) => {
    const line = document.createElement('span');
    line.className = 'split-line';
    line.style.setProperty('--d', i * stagger + 'ms');
    const inner = document.createElement('span');
    inner.textContent = word;
    line.append(inner);
    node.append(line, document.createTextNode(' '));
  });
  return node;
}
