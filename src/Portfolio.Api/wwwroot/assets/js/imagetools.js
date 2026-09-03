/* ==========================================================================
   imagetools.js — hai công cụ ảnh của trang admin:
   1) Cắt ảnh (crop): không phá ảnh gốc (lưu vùng %) hoặc xuất thành file mới.
   2) Ghép ảnh (collage): xếp 2–4 ảnh thành một ảnh mới rồi lưu vào thư viện.
   ========================================================================== */

import { h, openModal, closeModal, toast, field, row } from './ui.js';
import { api } from './api.js';

// ================================================================ CROP

const RATIOS = [
  { id: 0, label: 'Tự do' },
  { id: 1, label: '1:1' },
  { id: 0.8, label: '4:5' },
  { id: 0.6667, label: '2:3' },
  { id: 1.5, label: '3:2' },
  { id: 1.7778, label: '16:9' },
  { id: 2.4, label: '2.4:1' }
];

let cropState = null;

/**
 * Mở modal cắt ảnh.
 * onApply(cropRect, ratio) — áp dụng vùng cắt lên block (không đổi file).
 * onExport(mediaItem)      — đã xuất ảnh mới, trả về item trong thư viện.
 */
export function openCropModal(block, { onApply, onExport }) {
  const area = document.getElementById('cropArea');
  const readout = document.getElementById('cropReadout');
  area.replaceChildren();

  const img = h('img', { class: 'adm-crop__img', src: block.src, alt: '' });
  const stage = h('div', { class: 'adm-crop__stage' }, img);
  const box = h('div', { class: 'adm-crop__box' });
  const boxImg = h('img', { src: block.src, alt: '' });
  box.append(boxImg);
  ['nw', 'ne', 'sw', 'se'].forEach(pos =>
    box.append(h('div', { class: 'adm-crop__h', dataset: { h: pos } })));
  stage.append(box);
  area.append(stage);

  cropState = {
    rect: block.crop ? { ...block.crop } : { x: 0, y: 0, w: 100, h: 100 },
    ratio: 0,
    block,
    onApply,
    onExport
  };

  const paint = () => {
    const { x, y, w, h: bh } = cropState.rect;
    box.style.left = x + '%';
    box.style.top = y + '%';
    box.style.width = w + '%';
    box.style.height = bh + '%';
    // ảnh trong khung sáng hơn phần bị cắt -> nhìn rõ vùng giữ lại
    boxImg.style.width = (100 / w) * 100 + '%';
    boxImg.style.height = (100 / bh) * 100 + '%';
    boxImg.style.left = -(x / w) * 100 + '%';
    boxImg.style.top = -(y / bh) * 100 + '%';
    readout.textContent = `${Math.round(w)}% × ${Math.round(bh)}%`;
  };

  const ratioHost = document.getElementById('cropRatios');
  ratioHost.replaceChildren(...RATIOS.map(r =>
    h('button', {
      class: 'adm-preset',
      onclick: () => {
        cropState.ratio = Number(r.id);
        if (cropState.ratio > 0) applyRatio(stage, cropState);
        paint();
      }
    }, r.label)));

  document.getElementById('cropReset').onclick = () => {
    cropState.rect = { x: 0, y: 0, w: 100, h: 100 };
    paint();
  };

  document.getElementById('cropApply').onclick = () => {
    onApply?.({ ...cropState.rect });
    closeModal('cropModal');
  };

  document.getElementById('cropExport').onclick = async () => {
    const btn = document.getElementById('cropExport');
    btn.disabled = true;
    btn.textContent = 'Đang xuất…';
    try {
      const dataUrl = await renderCrop(block.src, cropState.rect);
      const item = await api.uploadDataUrl(dataUrl, 'cropped');
      onExport?.(item);
      closeModal('cropModal');
      toast('Đã lưu ảnh cắt vào thư viện.', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Xuất ảnh mới';
    }
  };

  wireCropDrag(stage, box, cropState, paint);
  img.addEventListener('load', paint, { once: true });
  paint();
  openModal('cropModal');
}

function applyRatio(stage, state) {
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // giữ chiều rộng, tính lại chiều cao theo tỉ lệ mong muốn (đơn vị %)
  const pxW = (state.rect.w / 100) * rect.width;
  const pxH = pxW / state.ratio;
  let h = (pxH / rect.height) * 100;
  if (state.rect.y + h > 100) {
    h = 100 - state.rect.y;
    const w = ((h / 100) * rect.height * state.ratio / rect.width) * 100;
    state.rect.w = Math.min(w, 100 - state.rect.x);
  }
  state.rect.h = h;
}

function wireCropDrag(stage, box, state, paint) {
  const MIN = 5; // % nhỏ nhất của khung cắt

  box.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.adm-crop__h');
    const insideBox = e.target === box || box.querySelector('img') === e.target;
    if (!handle && !insideBox) return;
    e.preventDefault();

    const stageRect = stage.getBoundingClientRect();
    const corner = handle?.dataset.h || null;
    const origin = { px: e.clientX, py: e.clientY };
    const start = { ...state.rect };

    const move = (ev) => {
      const dx = ((ev.clientX - origin.px) / stageRect.width) * 100;
      const dy = ((ev.clientY - origin.py) / stageRect.height) * 100;

      if (!corner) {
        // di chuyển cả khung, không cho tràn ra ngoài ảnh
        state.rect = {
          ...start,
          x: clamp(start.x + dx, 0, 100 - start.w),
          y: clamp(start.y + dy, 0, 100 - start.h)
        };
      } else {
        let { x, y, w, h } = start;
        if (corner.includes('w')) { const nx = clamp(start.x + dx, 0, start.x + start.w - MIN); w = start.w + (start.x - nx); x = nx; }
        if (corner.includes('e')) { w = clamp(start.w + dx, MIN, 100 - start.x); }
        if (corner.includes('n')) { const ny = clamp(start.y + dy, 0, start.y + start.h - MIN); h = start.h + (start.y - ny); y = ny; }
        if (corner.includes('s')) { h = clamp(start.h + dy, MIN, 100 - start.y); }

        if (state.ratio > 0) {
          // khoá tỉ lệ: chiều cao suy ra từ chiều rộng theo pixel thật của stage
          const pxW = (w / 100) * stageRect.width;
          h = clamp(((pxW / state.ratio) / stageRect.height) * 100, MIN, 100 - y);
        }
        state.rect = { x, y, w, h };
      }
      paint();
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Vẽ vùng cắt ra canvas ở độ phân giải gốc và trả về dataURL. */
export async function renderCrop(src, rect, mime = 'image/jpeg', quality = 0.92) {
  const img = await loadImage(src);
  const sx = (rect.x / 100) * img.naturalWidth;
  const sy = (rect.y / 100) * img.naturalHeight;
  const sw = (rect.w / 100) * img.naturalWidth;
  const sh = (rect.h / 100) * img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, quality);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh: ' + src));
    img.src = src;
  });
}

// ================================================================ COLLAGE

const COLLAGE_LAYOUTS = [
  { id: 'row', label: 'Hàng ngang' },
  { id: 'col', label: 'Cột dọc' },
  { id: 'grid', label: 'Lưới 2×2' },
  { id: 'left-big', label: '1 lớn + cột nhỏ' }
];

/** Mở modal ghép ảnh với danh sách url đã chọn. onSaved(mediaItem). */
export function openCollageModal(urls, { onSaved }) {
  if (urls.length < 2) {
    toast('Chọn ít nhất 2 ảnh (Ctrl + bấm) rồi bấm ⊞.', 'err');
    return;
  }

  const canvas = document.getElementById('collageCanvas');
  const controls = document.getElementById('collageControls');
  const opts = { layout: urls.length >= 4 ? 'grid' : 'row', gap: 12, bg: '#0b0b0f', width: 2000, radius: 0 };
  const images = urls.slice(0, 4);

  const redraw = () => drawCollage(canvas, images, opts).catch(err => toast(err.message, 'err'));

  controls.replaceChildren(
    field({
      type: 'select', label: 'Kiểu ghép', value: opts.layout, options: COLLAGE_LAYOUTS,
      onInput: (v) => { opts.layout = v; redraw(); }
    }),
    row(
      field({ type: 'range', label: 'Khoảng cách', value: opts.gap, min: 0, max: 80, unit: 'px', onInput: (v) => { opts.gap = v; redraw(); } }),
      field({ type: 'range', label: 'Bo góc', value: opts.radius, min: 0, max: 80, unit: 'px', onInput: (v) => { opts.radius = v; redraw(); } })
    ),
    field({ type: 'color', label: 'Màu nền', value: opts.bg, onInput: (v) => { opts.bg = v; redraw(); } }),
    field({
      type: 'select', label: 'Chiều rộng ảnh xuất', value: String(opts.width),
      options: [{ id: '1200', label: '1200px' }, { id: '2000', label: '2000px' }, { id: '3000', label: '3000px' }],
      onInput: (v) => { opts.width = Number(v); redraw(); }
    }),
    h('p', { class: 'adm-hint' }, `Đang ghép ${images.length} ảnh. Ảnh kết quả sẽ nằm trong thư viện, kéo thả dùng như ảnh thường.`)
  );

  document.getElementById('collageHint').textContent = 'Ảnh ghép được lưu thành file JPG mới, ảnh gốc không thay đổi.';
  document.getElementById('collageSave').onclick = async () => {
    const btn = document.getElementById('collageSave');
    btn.disabled = true;
    btn.textContent = 'Đang lưu…';
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const item = await api.uploadDataUrl(dataUrl, 'collage');
      onSaved?.(item);
      closeModal('collageModal');
      toast('Đã lưu ảnh ghép.', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lưu vào thư viện';
    }
  };

  openModal('collageModal');
  redraw();
}

async function drawCollage(canvas, urls, opts) {
  const imgs = await Promise.all(urls.map(loadImage));
  const W = opts.width;
  const g = Math.round(opts.gap * (W / 1600));
  const r = Math.round(opts.radius * (W / 1600));

  // khung chứa cho từng kiểu ghép, đơn vị tỉ lệ 0..1 của khung tổng
  let cells;
  let H;
  switch (opts.layout) {
    case 'col':
      H = Math.round(W * 1.25);
      cells = imgs.map((_, i) => ({ x: 0, y: i / imgs.length, w: 1, h: 1 / imgs.length }));
      break;
    case 'grid': {
      H = W;
      const cols = 2;
      const rows = Math.ceil(imgs.length / cols);
      cells = imgs.map((_, i) => ({
        x: (i % cols) / cols, y: Math.floor(i / cols) / rows, w: 1 / cols, h: 1 / rows
      }));
      break;
    }
    case 'left-big': {
      H = Math.round(W * 0.66);
      const rest = Math.max(imgs.length - 1, 1);
      cells = [{ x: 0, y: 0, w: 0.62, h: 1 }].concat(
        imgs.slice(1).map((_, i) => ({ x: 0.62, y: i / rest, w: 0.38, h: 1 / rest })));
      break;
    }
    default:
      H = Math.round(W * 0.62);
      cells = imgs.map((_, i) => ({ x: i / imgs.length, y: 0, w: 1 / imgs.length, h: 1 }));
  }

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, W, H);

  imgs.forEach((img, i) => {
    const cell = cells[i];
    if (!cell) return;
    const x = Math.round(cell.x * W + (cell.x > 0 ? g / 2 : 0));
    const y = Math.round(cell.y * H + (cell.y > 0 ? g / 2 : 0));
    const w = Math.round(cell.w * W - (cell.x > 0 ? g / 2 : 0) - (cell.x + cell.w < 1 ? g / 2 : 0));
    const h = Math.round(cell.h * H - (cell.y > 0 ? g / 2 : 0) - (cell.y + cell.h < 1 ? g / 2 : 0));

    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    drawCover(ctx, img, x, y, w, h);
    ctx.restore();
  });
}

/** Vẽ ảnh theo kiểu object-fit: cover vào ô cho trước. */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
