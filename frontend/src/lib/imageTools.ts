/** Xử lý ảnh phía client: cắt ảnh và ghép ảnh bằng canvas. */

import type { CropRect } from '../types';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh: ' + src));
    img.src = src;
  });
}

/** Vẽ vùng cắt ra canvas ở độ phân giải gốc rồi trả về dataURL. */
export async function renderCrop(src: string, rect: CropRect, mime = 'image/jpeg', quality = 0.92) {
  const img = await loadImage(src);
  const sx = (rect.x / 100) * img.naturalWidth;
  const sy = (rect.y / 100) * img.naturalHeight;
  const sw = (rect.w / 100) * img.naturalWidth;
  const sh = (rect.h / 100) * img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas 2D.');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, quality);
}

export interface CollageOptions {
  layout: string;
  gap: number;
  radius: number;
  bg: string;
  width: number;
}

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ghép 2–4 ảnh vào một canvas theo kiểu bố cục đã chọn. */
export async function drawCollage(canvas: HTMLCanvasElement, urls: string[], opts: CollageOptions) {
  const imgs = await Promise.all(urls.map(loadImage));
  const W = opts.width;
  const gap = Math.round(opts.gap * (W / 1600));
  const radius = Math.round(opts.radius * (W / 1600));

  let cells: Cell[];
  let H: number;

  switch (opts.layout) {
    case 'col':
      H = Math.round(W * 1.25);
      cells = imgs.map((_, i) => ({ x: 0, y: i / imgs.length, w: 1, h: 1 / imgs.length }));
      break;
    case 'grid': {
      H = W;
      const cols = 2;
      const rows = Math.ceil(imgs.length / cols);
      cells = imgs.map((_, i) => ({ x: (i % cols) / cols, y: Math.floor(i / cols) / rows, w: 1 / cols, h: 1 / rows }));
      break;
    }
    case 'left-big': {
      H = Math.round(W * 0.66);
      const rest = Math.max(imgs.length - 1, 1);
      cells = [{ x: 0, y: 0, w: 0.62, h: 1 } as Cell].concat(
        imgs.slice(1).map((_, i) => ({ x: 0.62, y: i / rest, w: 0.38, h: 1 / rest })),
      );
      break;
    }
    default:
      H = Math.round(W * 0.62);
      cells = imgs.map((_, i) => ({ x: i / imgs.length, y: 0, w: 1 / imgs.length, h: 1 }));
  }

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas 2D.');
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, W, H);

  imgs.forEach((img, i) => {
    const cell = cells[i];
    if (!cell) return;
    const x = Math.round(cell.x * W + (cell.x > 0 ? gap / 2 : 0));
    const y = Math.round(cell.y * H + (cell.y > 0 ? gap / 2 : 0));
    const w = Math.round(cell.w * W - (cell.x > 0 ? gap / 2 : 0) - (cell.x + cell.w < 1 ? gap / 2 : 0));
    const h = Math.round(cell.h * H - (cell.y > 0 ? gap / 2 : 0) - (cell.y + cell.h < 1 ? gap / 2 : 0));

    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    drawCover(ctx, img, x, y, w, h);
    ctx.restore();
  });
}

/** Vẽ ảnh theo kiểu object-fit: cover vào ô cho trước. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
