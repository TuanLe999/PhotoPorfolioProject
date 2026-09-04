/**
 * Xem trước như khách: nạp route /preview trong iframe rồi gửi config qua postMessage.
 * Dùng iframe (thay vì render trực tiếp) để media query và position:fixed hoạt động
 * đúng theo bề rộng thiết bị đang chọn.
 */

import { useEffect, useRef, useState } from 'react';
import type { DeviceName, SiteConfig } from '../../types';

export function PreviewOverlay({
  config,
  onSave,
  onClose,
  saving,
}: {
  config: SiteConfig;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceName>('desktop');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if ((e.data as { type?: string })?.type === 'pf:preview-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage({ type: 'pf:render', config }, window.location.origin);
  }, [ready, config]);

  return (
    <div className="adm-preview">
      <div className="adm-preview__bar">
        <strong style={{ fontSize: 13, fontWeight: 500 }}>Xem trước</strong>
        <div className="seg">
          {(['desktop', 'tablet', 'mobile'] as DeviceName[]).map((name) => (
            <button key={name} className={device === name ? 'is-on' : undefined} onClick={() => setDevice(name)}>
              {name === 'desktop' ? 'Desktop' : name === 'tablet' ? 'Tablet' : 'Mobile'}
            </button>
          ))}
        </div>
        <span className="adm-hint">Bản xem trước dùng đúng engine của trang thật — chưa lưu nên khách chưa thấy.</span>
        <div className="spacer" />
        <button className="ui-btn ui-btn--primary" onClick={onSave} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu & áp dụng'}
        </button>
        <button className="ui-btn" onClick={onClose}>
          Đóng ✕
        </button>
      </div>
      <div className="adm-preview__stage">
        <iframe
          ref={frameRef}
          className="adm-preview__frame"
          data-device={device}
          src="/preview"
          title="Xem trước portfolio"
        />
      </div>
    </div>
  );
}
