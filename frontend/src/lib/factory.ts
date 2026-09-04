import type { Block, BlockType, Section } from '../types';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(type: BlockType = 'image', patch: Partial<Block> = {}): Block {
  const base: Block = {
    id: uid(),
    type,
    colSpan: type === 'text' || type === 'quote' ? 6 : 4,
    aspectRatio: type === 'video' ? 1.777 : 1,
    fit: 'cover',
    focusX: 50,
    focusY: 50,
    radius: null,
    src: null,
    alt: '',
    crop: null,
    title: type === 'text' ? 'Tiêu đề mới' : type === 'quote' ? 'Tên khách hàng' : null,
    body:
      type === 'text'
        ? 'Nội dung mô tả cho khối chữ này.'
        : type === 'quote'
          ? 'Ảnh của bạn làm mình rơi nước mắt.'
          : null,
    align: 'left',
    titleSize: 32,
    bodySize: 16,
    color: null,
    caption: '',
    captionStyle: 'below',
    animation: 'fade-up',
    delay: 0,
    duration: 800,
    hover: 'zoom',
    parallax: 0,
    link: null,
  };
  return { ...base, ...patch };
}

export function newSection(patch: Partial<Section> = {}): Section {
  return {
    id: uid(),
    name: 'Bộ ảnh mới',
    heading: 'Tiêu đề bộ ảnh',
    subheading: '',
    layout: 'grid',
    columns: 12,
    gap: 16,
    background: 'transparent',
    visible: true,
    blocks: [],
    ...patch,
  };
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
