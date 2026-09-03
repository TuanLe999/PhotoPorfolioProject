/* ==========================================================================
   renderer.js — engine dựng DOM từ cấu hình site.
   Cùng một hàm được trang portfolio và khung preview của admin gọi, nên
   những gì admin thấy khi preview chính là những gì khách sẽ thấy.
   ========================================================================== */

export const ANIMATIONS = [
  { id: 'none', label: 'Không hiệu ứng' },
  { id: 'fade', label: 'Mờ dần' },
  { id: 'fade-up', label: 'Trôi lên' },
  { id: 'fade-down', label: 'Trôi xuống' },
  { id: 'fade-left', label: 'Trôi từ phải' },
  { id: 'fade-right', label: 'Trôi từ trái' },
  { id: 'zoom-in', label: 'Phóng vào' },
  { id: 'zoom-out', label: 'Thu nhỏ' },
  { id: 'blur-in', label: 'Rõ dần (blur)' },
  { id: 'clip-up', label: 'Màn mở lên' },
  { id: 'clip-down', label: 'Màn mở xuống' },
  { id: 'wipe-left', label: 'Quét sang trái' },
  { id: 'wipe-right', label: 'Quét sang phải' },
  { id: 'rotate-in', label: 'Nghiêng vào' },
  { id: 'flip-in', label: 'Lật 3D' },
  { id: 'skew-in', label: 'Xô lệch' },
  { id: 'drop-in', label: 'Rơi xuống' },
  { id: 'ken-burns', label: 'Ken Burns (ảnh trôi)' }
];

export const HOVERS = [
  { id: 'none', label: 'Không' },
  { id: 'zoom', label: 'Phóng ảnh' },
  { id: 'lift', label: 'Nhấc lên + bóng' },
  { id: 'tilt', label: 'Nghiêng 3D' },
  { id: 'reveal', label: 'Đen trắng → màu' }
];

export const LAYOUTS = [
  { id: 'grid', label: 'Lưới 12 cột' },
  { id: 'masonry', label: 'Masonry (so le)' },
  { id: 'justified', label: 'Justified (cân hàng)' },
  { id: 'carousel', label: 'Trượt ngang' }
];

export const BLOCK_TYPES = [
  { id: 'image', label: 'Ảnh' },
  { id: 'text', label: 'Chữ' },
  { id: 'quote', label: 'Trích dẫn' },
  { id: 'video', label: 'Video' },
  { id: 'spacer', label: 'Khoảng trống' }
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/** Ghi cấu hình theme vào CSS variable trên phần tử gốc (mặc định là :root). */
export function applyTheme(theme, root = document.documentElement) {
  if (!theme) return;
  const map = {
    '--c-primary': theme.primary,
    '--c-accent': theme.accent,
    '--c-bg': theme.background,
    '--c-surface': theme.surface,
    '--c-text': theme.text,
    '--c-muted': theme.muted,
    '--font-heading': theme.headingFont,
    '--font-body': theme.bodyFont,
    '--radius': (theme.radius ?? 14) + 'px',
    '--grain-opacity': theme.grain ?? 0.05,
    '--anim-scale': theme.animationSpeed ?? 1
  };
  for (const [key, value] of Object.entries(map)) {
    if (value !== undefined && value !== null && value !== '') root.style.setProperty(key, value);
  }
  root.dataset.themeMode = theme.mode || 'dark';
}

/** Dựng một block. `editable` = true thì thêm data-* để admin bắt sự kiện chọn/kéo. */
export function renderBlock(block, { editable = false, index = 0 } = {}) {
  const wrap = el('div', 'pf-block');
  wrap.dataset.blockId = block.id;
  wrap.dataset.hover = block.type === 'image' ? (block.hover || 'none') : 'none';
  wrap.style.setProperty('--span', clamp(block.colSpan ?? 4, 1, 12));
  if (block.radius != null) wrap.style.setProperty('--block-radius', block.radius + 'px');

  wrap.dataset.anim = block.animation || 'fade-up';
  wrap.style.setProperty('--d', (block.delay ?? 0) + 'ms');
  wrap.style.setProperty('--t', (block.duration ?? 800) + 'ms');
  if (block.parallax) wrap.dataset.parallax = block.parallax;
  if (editable) wrap.dataset.index = index;

  let inner;
  switch (block.type) {
    case 'text':   inner = renderText(block); break;
    case 'quote':  inner = renderQuote(block); break;
    case 'spacer': inner = renderSpacer(block); break;
    case 'video':  inner = renderVideo(block); break;
    default:       inner = renderImage(block, editable);
  }
  wrap.append(inner);
  return wrap;
}

function renderImage(block, editable) {
  const figure = el('figure', 'pf-figure');
  const frame = el('div', 'pf-frame');

  const ratio = Number(block.aspectRatio) || 0;
  if (ratio > 0) {
    frame.dataset.ratio = '1';
    frame.style.setProperty('--ratio', ratio);
  }
  frame.style.setProperty('--fit', block.fit || 'cover');
  frame.style.setProperty('--focus', `${block.focusX ?? 50}% ${block.focusY ?? 50}%`);

  if (block.src) {
    const img = el('img');
    img.src = block.src;
    img.alt = block.alt || block.caption || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.draggable = false;

    const crop = block.crop;
    if (crop && (crop.w < 100 || crop.h < 100 || crop.x > 0 || crop.y > 0)) {
      const w = Math.max(crop.w, 1), h = Math.max(crop.h, 1);
      frame.classList.add('pf-frame--cropped');
      frame.style.setProperty('--crop-w', (100 / w) * 100 + '%');
      frame.style.setProperty('--crop-h', (100 / h) * 100 + '%');
      frame.style.setProperty('--crop-x', -(crop.x / w) * 100 + '%');
      frame.style.setProperty('--crop-y', -(crop.y / h) * 100 + '%');
    }
    frame.append(img);

    if (!editable) {
      frame.append(el('span', 'pf-zoom-hint', '⤢'));
      frame.dataset.lightbox = block.src;
    }
  } else {
    frame.classList.add('pf-frame--empty');
    frame.dataset.placeholder = 'chưa gán ảnh';
  }

  const style = block.captionStyle || 'below';
  if (block.caption && style !== 'none') {
    const cap = el('figcaption', 'pf-caption', block.caption);
    if (style === 'below') {
      figure.append(frame, cap);
    } else {
      cap.classList.add(style === 'overlay' ? 'pf-caption--overlay' : 'pf-caption--hover');
      frame.append(cap);
      figure.append(frame);
    }
  } else {
    figure.append(frame);
  }

  if (block.link && !editable) {
    const a = el('a');
    a.href = block.link;
    a.target = block.link.startsWith('http') ? '_blank' : '_self';
    a.rel = 'noopener';
    a.append(figure);
    return a;
  }
  return figure;
}

function renderText(block) {
  const box = el('div', 'pf-text');
  if (block.align === 'center') box.classList.add('pf-text--center');
  if (block.align === 'right') box.classList.add('pf-text--right');
  if (block.color) box.style.color = block.color;
  box.style.setProperty('--title-size', (block.titleSize ?? 32) + 'px');
  box.style.setProperty('--body-size', (block.bodySize ?? 16) + 'px');

  if (block.title) box.append(el('h3', 'pf-text__title', block.title));
  if (block.body) box.append(el('p', 'pf-text__body', block.body));
  if (!block.title && !block.body) box.append(el('p', 'pf-text__body', 'Nhập nội dung cho khối chữ…'));
  return box;
}

function renderQuote(block) {
  const box = el('blockquote', 'pf-quote');
  box.style.setProperty('--title-size', (block.titleSize ?? 30) + 'px');
  if (block.color) box.style.color = block.color;
  box.append(el('p', 'pf-quote__body', block.body || 'Trích dẫn của khách hàng…'));
  if (block.title) box.append(el('div', 'pf-quote__by', block.title));
  return box;
}

function renderSpacer(block) {
  const box = el('div', 'pf-spacer');
  box.style.setProperty('--spacer-h', Math.round((block.aspectRatio || 1) * 60) + 'px');
  if (block.captionStyle === 'overlay') box.classList.add('pf-spacer--rule');
  return box;
}

function renderVideo(block) {
  const box = el('div', 'pf-video');
  const ratio = Number(block.aspectRatio) || 1.777;
  box.dataset.ratio = '1';
  box.style.setProperty('--ratio', ratio);

  const url = block.src || '';
  const embed = toEmbedUrl(url);
  if (embed) {
    const frame = el('iframe');
    frame.src = embed;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    frame.title = block.caption || 'video';
    box.append(frame);
  } else if (url) {
    const video = el('video');
    video.src = url;
    video.controls = true;
    video.playsInline = true;
    box.append(video);
  } else {
    box.append(el('div', 'pf-frame--empty'));
  }
  return box;
}

function toEmbedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/** Dựng một section (kể cả phần đầu đề). */
export function renderSection(section, opts = {}) {
  const wrapper = el('section', 'pf-section');
  wrapper.id = 'sec-' + section.id;
  wrapper.dataset.sectionId = section.id;
  if (section.background && section.background !== 'transparent') {
    wrapper.classList.add('pf-section--' + section.background);
  }
  if (!section.visible && !opts.showHidden) wrapper.hidden = true;

  const inner = el('div', 'pf-section__inner');

  if (section.heading || section.subheading || section.name) {
    const head = el('div', 'pf-section__head');
    head.dataset.anim = 'fade-up';
    if (section.heading) {
      head.append(el('div', 'pf-section__eyebrow', section.name || ''));
      head.append(el('h2', 'pf-section__title', section.heading));
    } else if (section.name) {
      head.append(el('h2', 'pf-section__title', section.name));
    }
    if (section.subheading) head.append(el('p', 'pf-section__sub', section.subheading));
    inner.append(head);
  }

  const blocks = el('div', 'pf-blocks pf-blocks--' + (section.layout || 'grid'));
  blocks.dataset.blocksFor = section.id;
  blocks.style.setProperty('--cols', clamp(section.columns ?? 12, 1, 12));
  blocks.style.setProperty('--gap', (section.gap ?? 16) + 'px');
  (section.blocks || []).forEach((block, i) => blocks.append(renderBlock(block, { ...opts, index: i })));

  inner.append(blocks);
  wrapper.append(inner);
  return wrapper;
}

/** Vẽ toàn bộ danh sách section vào container (xoá nội dung cũ). */
export function renderSections(container, sections, opts = {}) {
  container.replaceChildren();
  (sections || []).forEach(section => container.append(renderSection(section, opts)));
  return container;
}

export const clamp = (n, min, max) => Math.min(Math.max(Number(n) || 0, min), max);
