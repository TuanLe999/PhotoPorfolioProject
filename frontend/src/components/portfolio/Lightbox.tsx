import { useCallback, useEffect, useState } from 'react';
import { assetUrl } from '../../api/client';

export interface LightboxItem {
  src: string;
  caption?: string;
}

export function Lightbox({
  items,
  index,
  onClose,
}: {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index ?? 0);
  const [shown, setShown] = useState(false);

  const step = useCallback(
    (delta: number) => setCurrent((c) => (c + delta + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    if (index == null) return;
    setCurrent(index);
    const raf = requestAnimationFrame(() => setShown(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      setShown(false);
      document.body.style.overflow = '';
    };
  }, [index]);

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose, step]);

  if (index == null || !items.length) return null;
  const item = items[current];

  return (
    <div
      className={'lightbox' + (shown ? ' is-open' : '')}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className="lightbox__close" aria-label="Đóng" onClick={onClose}>
        ✕
      </button>
      {items.length > 1 && (
        <>
          <button className="lightbox__nav lightbox__nav--prev" aria-label="Ảnh trước" onClick={() => step(-1)}>
            ‹
          </button>
          <button className="lightbox__nav lightbox__nav--next" aria-label="Ảnh sau" onClick={() => step(1)}>
            ›
          </button>
        </>
      )}
      <figure className="lightbox__stage">
        <img key={item.src} className="is-in" src={assetUrl(item.src)} alt={item.caption ?? ''} />
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>
      <div className="lightbox__counter">
        {current + 1} / {items.length}
      </div>
    </div>
  );
}
