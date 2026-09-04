/** Các hiệu ứng chạy theo cuộn: reveal, parallax, quầng sáng theo con trỏ. */

import { useEffect, type RefObject } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Bật class .is-in cho mọi [data-anim] bên trong `rootRef` khi chúng lọt vào viewport.
 * `deps` đổi (ví dụ config vừa render lại) thì quét lại toàn bộ.
 */
export function useReveal(rootRef: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-anim]'));
    if (prefersReducedMotion()) {
      targets.forEach((node) => node.classList.add('is-in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    targets.forEach((node) => {
      if (!node.classList.contains('is-in')) observer.observe(node);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Dịch nhẹ các phần tử [data-parallax] theo tiến trình cuộn. */
export function useParallax(rootRef: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]'));
    if (!nodes.length) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        const progress = (rect.top + rect.height / 2 - vh / 2) / vh; // -1..1
        const strength = Number(node.dataset.parallax) || 0;
        node.style.translate = `0 ${(progress * strength * -70).toFixed(2)}px`;
      }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Quầng sáng đi theo con trỏ (bỏ qua trên thiết bị cảm ứng). */
export function useCursorGlow(enabled: boolean) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.append(glow);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let raf = 0;

    const loop = () => {
      raf = 0;
      cx += (x - cx) * 0.12;
      cy += (y - cy) * 0.12;
      glow.style.translate = `${cx}px ${cy}px`;
      if (Math.abs(x - cx) > 0.4 || Math.abs(y - cy) > 0.4) raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      glow.remove();
    };
  }, [enabled]);
}

/** Nav dính + thanh tiến trình cuộn + đánh dấu mục đang xem. */
export function useScrollChrome(
  navRef: RefObject<HTMLElement | null>,
  progressRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      navRef.current?.classList.toggle('is-stuck', y > 40);

      const max = document.body.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.width = max > 0 ? `${(y / max) * 100}%` : '0';

      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav__link'));
      let active: HTMLAnchorElement | null = null;
      for (const link of links) {
        const id = link.getAttribute('href') ?? '';
        const target = id.startsWith('#') ? document.querySelector(id) : null;
        if (target && target.getBoundingClientRect().top <= window.innerHeight * 0.35) active = link;
      }
      links.forEach((link) => link.classList.toggle('is-active', link === active));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Đếm số liệu tăng dần khi khối "Về tôi" vào tầm nhìn. */
export function useCountUp(rootRef: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-count]'));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const node = entry.target as HTMLElement;
          const target = Number(node.dataset.count);
          const started = performance.now();
          const step = (now: number) => {
            const t = Math.min((now - started) / 1400, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            node.textContent = Math.round(target * eased) + (t === 1 ? '+' : '');
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.6 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
