/**
 * Render một khối nội dung. Dùng chung cho trang portfolio thật và canvas của admin,
 * nên preview trong admin luôn khớp với thứ khách nhìn thấy.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { Block } from '../../types';
import { assetUrl } from '../../api/client';
import { clamp } from '../../lib/factory';

export interface BlockViewProps {
  block: Block;
  /** Chế độ chỉnh sửa: không mở lightbox, không bọc thẻ <a>. */
  editable?: boolean;
  /** Chrome chỉnh sửa (tay cầm kéo, nút cắt/xoá…) do canvas của admin truyền vào. */
  overlay?: ReactNode;
  selected?: boolean;
  /** Class phụ (gợi ý vị trí thả…) và sự kiện gắn thẳng lên .pf-block —
   *  không bọc thêm thẻ, vì CSS lưới dùng selector con trực tiếp. */
  extraClass?: string;
  handlers?: HTMLAttributes<HTMLDivElement>;
  onImageClick?: (block: Block) => void;
}

type Vars = CSSProperties & Record<string, string | number>;

export function BlockView({
  block,
  editable = false,
  overlay,
  selected,
  extraClass,
  handlers,
  onImageClick,
}: BlockViewProps) {
  const style: Vars = {
    '--span': clamp(block.colSpan, 1, 12),
  };
  if (block.radius != null) style['--block-radius'] = `${block.radius}px`;
  if (editable) style.position = 'relative';

  return (
    <div
      {...handlers}
      className={'pf-block' + (selected ? ' is-selected' : '') + (extraClass ? ' ' + extraClass : '')}
      data-block-id={block.id}
      data-hover={block.type === 'image' ? block.hover : 'none'}
      data-anim={block.animation || 'fade-up'}
      data-parallax={block.parallax || undefined}
      style={{ ...style, '--d': `${block.delay ?? 0}ms`, '--t': `${block.duration ?? 800}ms` } as Vars}
    >
      {renderInner(block, editable, onImageClick)}
      {overlay}
    </div>
  );
}

function renderInner(block: Block, editable: boolean, onImageClick?: (block: Block) => void) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />;
    case 'quote':
      return <QuoteBlock block={block} />;
    case 'spacer':
      return <SpacerBlock block={block} />;
    case 'video':
      return <VideoBlock block={block} />;
    default:
      return <ImageBlock block={block} editable={editable} onImageClick={onImageClick} />;
  }
}

function ImageBlock({
  block,
  editable,
  onImageClick,
}: {
  block: Block;
  editable: boolean;
  onImageClick?: (block: Block) => void;
}) {
  const ratio = Number(block.aspectRatio) || 0;
  const frameStyle: Vars = {
    '--fit': block.fit || 'cover',
    '--focus': `${block.focusX ?? 50}% ${block.focusY ?? 50}%`,
  };
  if (ratio > 0) frameStyle['--ratio'] = ratio;

  const crop = block.crop;
  const cropped = !!crop && (crop.w < 100 || crop.h < 100 || crop.x > 0 || crop.y > 0);
  if (cropped && crop) {
    const w = Math.max(crop.w, 1);
    const h = Math.max(crop.h, 1);
    frameStyle['--crop-w'] = `${(100 / w) * 100}%`;
    frameStyle['--crop-h'] = `${(100 / h) * 100}%`;
    frameStyle['--crop-x'] = `${-(crop.x / w) * 100}%`;
    frameStyle['--crop-y'] = `${-(crop.y / h) * 100}%`;
  }

  const captionStyle = block.captionStyle || 'below';
  const hasCaption = !!block.caption && captionStyle !== 'none';
  const clickable = !editable && !!block.src;

  const frame = (
    <div
      className={
        'pf-frame' + (cropped ? ' pf-frame--cropped' : '') + (block.src ? '' : ' pf-frame--empty')
      }
      data-ratio={ratio > 0 ? '1' : undefined}
      data-placeholder={block.src ? undefined : 'chưa gán ảnh'}
      style={frameStyle}
      onClick={clickable ? () => onImageClick?.(block) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onImageClick?.(block);
              }
            }
          : undefined
      }
    >
      {block.src && (
        <img src={assetUrl(block.src)} alt={block.alt || block.caption || ''} loading="lazy" decoding="async" draggable={false} />
      )}
      {clickable && <span className="pf-zoom-hint">⤢</span>}
      {hasCaption && captionStyle !== 'below' && (
        <figcaption className={`pf-caption pf-caption--${captionStyle}`}>{block.caption}</figcaption>
      )}
    </div>
  );

  const figure = (
    <figure className="pf-figure">
      {frame}
      {hasCaption && captionStyle === 'below' && <figcaption className="pf-caption">{block.caption}</figcaption>}
    </figure>
  );

  if (block.link && !editable) {
    return (
      <a href={block.link} target={block.link.startsWith('http') ? '_blank' : '_self'} rel="noopener">
        {figure}
      </a>
    );
  }
  return figure;
}

function TextBlock({ block }: { block: Block }) {
  const style: Vars = {
    '--title-size': `${block.titleSize ?? 32}px`,
    '--body-size': `${block.bodySize ?? 16}px`,
  };
  if (block.color) style.color = block.color;

  const className =
    'pf-text' + (block.align === 'center' ? ' pf-text--center' : block.align === 'right' ? ' pf-text--right' : '');

  return (
    <div className={className} style={style}>
      {block.title && <h3 className="pf-text__title">{block.title}</h3>}
      {block.body && <p className="pf-text__body">{block.body}</p>}
      {!block.title && !block.body && <p className="pf-text__body">Nhập nội dung cho khối chữ…</p>}
    </div>
  );
}

function QuoteBlock({ block }: { block: Block }) {
  const style: Vars = { '--title-size': `${block.titleSize ?? 30}px` };
  if (block.color) style.color = block.color;
  return (
    <blockquote className="pf-quote" style={style}>
      <p className="pf-quote__body">{block.body || 'Trích dẫn của khách hàng…'}</p>
      {block.title && <div className="pf-quote__by">{block.title}</div>}
    </blockquote>
  );
}

function SpacerBlock({ block }: { block: Block }) {
  const style: Vars = { '--spacer-h': `${Math.round((block.aspectRatio || 1) * 60)}px` };
  return <div className={'pf-spacer' + (block.captionStyle === 'overlay' ? ' pf-spacer--rule' : '')} style={style} />;
}

function VideoBlock({ block }: { block: Block }) {
  const ratio = Number(block.aspectRatio) || 1.777;
  const style: Vars = { '--ratio': ratio };
  const url = block.src ?? '';
  const embed = toEmbedUrl(url);

  return (
    <div className="pf-video" data-ratio="1" style={style}>
      {embed ? (
        <iframe
          src={embed}
          title={block.caption || 'video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : url ? (
        <video src={assetUrl(url)} controls playsInline />
      ) : (
        <div className="pf-frame--empty" data-placeholder="chưa có video" />
      )}
    </div>
  );
}

function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
