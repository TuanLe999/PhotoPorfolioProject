/** Danh mục lựa chọn dùng chung cho inspector và trang render. */

import type { Block, BlockType, HoverEffect, LayoutType, ThemeConfig } from '../types';
import { newBlock } from './factory';

export interface Option<T extends string | number = string> {
  id: T;
  label: string;
}

export const ANIMATIONS: Option[] = [
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
  { id: 'ken-burns', label: 'Ken Burns (ảnh trôi)' },
];

export const HOVERS: Option<HoverEffect>[] = [
  { id: 'none', label: 'Không' },
  { id: 'zoom', label: 'Phóng ảnh' },
  { id: 'lift', label: 'Nhấc lên + bóng' },
  { id: 'tilt', label: 'Nghiêng 3D' },
  { id: 'reveal', label: 'Đen trắng → màu' },
];

export const LAYOUTS: Option<LayoutType>[] = [
  { id: 'grid', label: 'Lưới 12 cột' },
  { id: 'masonry', label: 'Masonry (so le)' },
  { id: 'justified', label: 'Justified (cân hàng)' },
  { id: 'carousel', label: 'Trượt ngang' },
];

export const BLOCK_TYPES: Option<BlockType>[] = [
  { id: 'image', label: 'Ảnh' },
  { id: 'text', label: 'Chữ' },
  { id: 'quote', label: 'Trích dẫn' },
  { id: 'video', label: 'Video' },
  { id: 'spacer', label: 'Khoảng trống' },
];

export const ASPECT_RATIOS: Option<string>[] = [
  { id: '0', label: 'Theo ảnh gốc' },
  { id: '1', label: '1:1 vuông' },
  { id: '0.8', label: '4:5 dọc' },
  { id: '0.6667', label: '2:3 dọc' },
  { id: '1.5', label: '3:2 ngang' },
  { id: '1.7778', label: '16:9' },
  { id: '2.4', label: '2.4:1 phim' },
];

export const CROP_RATIOS: Option<number>[] = [
  { id: 0, label: 'Tự do' },
  { id: 1, label: '1:1' },
  { id: 0.8, label: '4:5' },
  { id: 0.6667, label: '2:3' },
  { id: 1.5, label: '3:2' },
  { id: 1.7778, label: '16:9' },
  { id: 2.4, label: '2.4:1' },
];

export type Palette = Pick<ThemeConfig, 'primary' | 'accent' | 'background' | 'surface' | 'text' | 'muted' | 'mode'> & {
  name: string;
};

export const PALETTES: Palette[] = [
  { name: 'Vàng đồng', primary: '#e8c37a', accent: '#7ac8e8', background: '#0b0b0f', surface: '#14141b', text: '#f4f2ee', muted: '#9a97a3', mode: 'dark' },
  { name: 'Hồng khói', primary: '#e3a9a1', accent: '#c8b4e8', background: '#100c0e', surface: '#1a1417', text: '#f7f0ee', muted: '#a3959a', mode: 'dark' },
  { name: 'Xanh đêm', primary: '#7fd1c1', accent: '#9db4ff', background: '#080d12', surface: '#101820', text: '#eef4f6', muted: '#8fa0aa', mode: 'dark' },
  { name: 'Giấy ngà', primary: '#8a6f4e', accent: '#3f6f6b', background: '#f6f2ea', surface: '#efe8dc', text: '#241f1a', muted: '#6d6459', mode: 'light' },
  { name: 'Trắng gallery', primary: '#1b1b1b', accent: '#b8763f', background: '#ffffff', surface: '#f3f3f1', text: '#141414', muted: '#6f6f6f', mode: 'light' },
  { name: 'Điện ảnh', primary: '#d8532f', accent: '#e8c37a', background: '#0d0a08', surface: '#171210', text: '#f2ebe4', muted: '#9c8f85', mode: 'dark' },
];

export const FONTS: Option[] = [
  { id: "'Cormorant Garamond', Georgia, serif", label: 'Cormorant (serif thanh)' },
  { id: "'Playfair Display', Georgia, serif", label: 'Playfair Display' },
  { id: "'DM Serif Display', Georgia, serif", label: 'DM Serif Display' },
  { id: "'Space Grotesk', system-ui, sans-serif", label: 'Space Grotesk' },
  { id: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { id: 'Georgia, serif', label: 'Georgia' },
  { id: 'system-ui, sans-serif', label: 'Hệ thống' },
];

const img = (colSpan: number, aspectRatio = 1, patch: Partial<Block> = {}) =>
  newBlock('image', { colSpan, aspectRatio, ...patch });

export interface Template {
  name: string;
  build: () => Block[];
}

export const TEMPLATES: Template[] = [
  { name: 'Ảnh lớn + 2 ảnh nhỏ', build: () => [img(8, 1.5), img(4, 0.75), img(4, 0.75, { animation: 'fade-left' })] },
  { name: 'Lưới 3 cột đều', build: () => [img(4), img(4, 1, { delay: 100 }), img(4, 1, { delay: 200 })] },
  { name: 'Ảnh + khối chữ', build: () => [img(7, 1.4), newBlock('text', { colSpan: 5, animation: 'fade-left' })] },
  { name: 'Bộ 6 ảnh so le', build: () => [img(4, 1.3), img(4, 0.8), img(4, 1.3), img(4, 0.8), img(4, 1.3), img(4, 0.8)] },
  { name: 'Trích dẫn giữa trang', build: () => [newBlock('quote', { colSpan: 12, align: 'center', animation: 'blur-in' })] },
  { name: 'Băng ảnh trượt ngang', build: () => [img(4, 1.2), img(4, 1.2), img(4, 1.2), img(4, 1.2)] },
];

export const COLLAGE_LAYOUTS: Option[] = [
  { id: 'row', label: 'Hàng ngang' },
  { id: 'col', label: 'Cột dọc' },
  { id: 'grid', label: 'Lưới 2×2' },
  { id: 'left-big', label: '1 lớn + cột nhỏ' },
];
