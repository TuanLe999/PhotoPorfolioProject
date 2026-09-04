/**
 * Toàn bộ trang portfolio, dựng từ một SiteConfig.
 * Trang thật (/) và khung xem trước trong admin (/preview) đều dùng component này.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Block, SiteConfig } from '../../types';
import { SectionView } from '../render/SectionView';
import { Lightbox, type LightboxItem } from './Lightbox';
import { assetUrl } from '../../api/client';
import { applyTheme } from '../../lib/theme';
import { useCountUp, useCursorGlow, useParallax, useReveal, useScrollChrome } from '../../hooks/useMotion';

type Vars = CSSProperties & Record<string, string | number>;

export function PortfolioPage({ config }: { config: SiteConfig }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const visibleSections = useMemo(() => config.sections.filter((s) => s.visible !== false), [config.sections]);

  const lightboxItems = useMemo<LightboxItem[]>(
    () =>
      visibleSections
        .flatMap((section) => section.blocks)
        .filter((block) => block.type === 'image' && block.src)
        .map((block) => ({ src: block.src as string, caption: block.caption || block.alt })),
    [visibleSections],
  );

  useEffect(() => {
    applyTheme(config.theme);
    document.documentElement.dataset.glow = config.theme.cursorGlow === 'off' ? 'off' : 'on';
  }, [config.theme]);

  useEffect(() => {
    document.title = `${config.site.title} — ${config.site.tagline}`;
  }, [config.site.title, config.site.tagline]);

  useReveal(rootRef, [config]);
  useParallax(rootRef, [config]);
  useCountUp(rootRef, [config]);
  useScrollChrome(navRef, progressRef, [config]);
  useCursorGlow(config.theme.cursorGlow !== 'off');

  const openLightbox = (block: Block) => {
    const index = lightboxItems.findIndex((item) => item.src === block.src);
    if (index >= 0) setLightbox(index);
  };

  const navLinks = [
    ...visibleSections.map((section) => ({ href: '#sec-' + section.id, label: section.name })),
    { href: '#about', label: 'Về tôi' },
    { href: '#services', label: 'Dịch vụ' },
    { href: '#contact', label: 'Liên hệ' },
  ];

  const marqueeWords = [config.site.tagline, 'Chân dung', 'Phóng sự cưới', 'Lookbook', config.site.address].filter(Boolean);

  return (
    <div ref={rootRef}>
      <div className="progress" ref={progressRef} />
      <div className="grain" />

      <header className={'nav' + (menuOpen ? ' is-open' : '')} ref={navRef}>
        <a className="nav__logo" href="#top">
          {config.site.logoText || config.site.title}
          <span>.</span>
        </a>
        <nav className="nav__links" aria-label="Điều hướng chính" onClick={() => setMenuOpen(false)}>
          {navLinks.map((link) => (
            <a className="nav__link" href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <button
          className="nav__burger"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <i />
          <i />
          <i />
        </button>
      </header>

      <main id="top">
        <Hero config={config} />

        <div className="marquee" aria-hidden="true">
          <div className="marquee__track">
            {[...marqueeWords, ...marqueeWords].map((word, i) => (
              <span key={i}>{word}</span>
            ))}
          </div>
        </div>

        <div id="work">
          {visibleSections.map((section) => (
            <SectionView key={section.id} section={section} onImageClick={openLightbox} />
          ))}
        </div>

        <section className="about" id="about">
          <div className="about__text" data-anim="fade-right">
            <h2>Về tôi</h2>
            <p>{config.site.about}</p>
            <div className="about__stats">
              <div className="about__stat">
                <b data-count="8">0</b>
                <span>Năm kinh nghiệm</span>
              </div>
              <div className="about__stat">
                <b data-count="240">0</b>
                <span>Buổi chụp</span>
              </div>
              <div className="about__stat">
                <b data-count="35">0</b>
                <span>Đám cưới / năm</span>
              </div>
            </div>
          </div>
          <div className="about__photo" data-anim="fade-left">
            {config.site.aboutImage && (
              <img src={assetUrl(config.site.aboutImage)} alt="Ảnh nhiếp ảnh gia" loading="lazy" />
            )}
          </div>
        </section>

        <section className="services" id="services">
          <div className="services__inner">
            <div className="pf-section__head" data-anim="fade-up">
              <div className="pf-section__eyebrow">Dịch vụ</div>
              <h2 className="pf-section__title">Gói chụp &amp; báo giá</h2>
              <p className="pf-section__sub">Mỗi gói đều có thể điều chỉnh theo concept của bạn.</p>
            </div>
            <div className="services__grid">
              {config.site.services.map((service, i) => (
                <article
                  className={'service' + (service.featured ? ' service--featured' : '')}
                  data-anim="fade-up"
                  style={{ '--d': `${i * 110}ms` } as Vars}
                  key={service.id}
                >
                  {service.featured && <span className="service__tag">Phổ biến</span>}
                  <h3 className="service__name">{service.name}</h3>
                  <div className="service__price">{service.price}</div>
                  <p className="service__desc">{service.description}</p>
                  <ul className="service__list">
                    {service.includes.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="contact" id="contact">
          <h2 data-anim="fade-up">Kể cho tôi về buổi chụp của bạn</h2>
          <p data-anim="fade-up" style={{ '--d': '120ms' } as Vars}>
            Gửi cho tôi ngày, địa điểm và cảm hứng bạn muốn — tôi sẽ trả lời trong 24 giờ.
          </p>
          <a className="contact__mail" data-anim="fade-up" style={{ '--d': '220ms' } as Vars} href={'mailto:' + config.site.email}>
            {config.site.email}
          </a>
          <div className="contact__meta" data-anim="fade-up" style={{ '--d': '320ms' } as Vars}>
            {[config.site.phone, config.site.address].filter(Boolean).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>{config.site.footerNote || config.site.title}</span>
        <div className="footer__social">
          {(
            [
              ['Instagram', config.site.instagram],
              ['Facebook', config.site.facebook],
              ['Behance', config.site.behance],
            ] as const
          )
            .filter(([, url]) => !!url)
            .map(([label, url]) => (
              <a href={url} target="_blank" rel="noopener" key={label}>
                {label}
              </a>
            ))}
        </div>
      </footer>

      <Lightbox items={lightboxItems} index={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function Hero({ config }: { config: SiteConfig }) {
  const words = (config.site.heroHeadline || config.site.title).trim().split(/\s+/);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [config.site.heroHeadline]);

  return (
    <section className="hero" id="hero">
      <div className={'hero__bg' + (config.site.heroImage ? '' : ' hero__bg--fallback')}>
        {config.site.heroImage && <img src={assetUrl(config.site.heroImage)} alt="" fetchPriority="high" />}
      </div>
      <div className="hero__inner">
        <p className="hero__eyebrow" data-anim="fade-up">
          {config.site.tagline}
        </p>
        <h1 className="hero__title">
          {/* mỗi từ nằm trong khung overflow:hidden để chữ dâng lên; dấu cách phải ở ngoài khung */}
          {words.map((word, i) => (
            <Fragment key={`${word}-${i}`}>
              <span className={'split-line' + (shown ? ' is-in' : '')} style={{ '--d': `${i * 70}ms` } as Vars}>
                <span>{word}</span>
              </span>
              {i < words.length - 1 ? ' ' : ''}
            </Fragment>
          ))}
        </h1>
        <p className="hero__sub" data-anim="fade-up" style={{ '--d': '420ms' } as Vars}>
          {config.site.heroSub}
        </p>
        <div className="hero__actions" data-anim="fade-up" style={{ '--d': '560ms' } as Vars}>
          <a className="btn" href={config.site.heroCtaLink || '#work'}>
            {config.site.heroCtaText || 'Xem portfolio'}
          </a>
          <a className="btn btn--ghost" href="#contact">
            Nhận báo giá
          </a>
        </div>
      </div>
      <div className="hero__scroll">
        <i /> Cuộn xuống
      </div>
    </section>
  );
}
