import { useEffect, useState, type ReactNode } from 'react';

export function Modal({
  title,
  children,
  footer,
  wide,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className={'adm-modal' + (wide ? ' adm-modal--wide' : '') + (shown ? ' is-open' : '')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="adm-modal__box">
        <div className="adm-modal__head">
          <h3>{title}</h3>
          <div className="spacer" />
          <button className="ui-btn ui-btn--ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="adm-modal__body">{children}</div>
        {footer && <div className="adm-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
