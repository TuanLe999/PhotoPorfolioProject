/**
 * Route chỉ dùng trong iframe xem trước của admin: nhận config qua postMessage
 * (không gọi API, không lưu gì) rồi dựng trang y hệt trang thật.
 */

import { useEffect, useState } from 'react';
import type { SiteConfig } from '../types';
import { PortfolioPage } from '../components/portfolio/PortfolioPage';

export function PreviewRoute() {
  const [config, setConfig] = useState<SiteConfig | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // chỉ nhận lệnh từ chính origin này (trang admin)
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; config?: SiteConfig };
      if (data?.type === 'pf:render' && data.config) setConfig(data.config);
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'pf:preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!config) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: '#888', fontSize: 13 }}>
        Đang nhận nội dung xem trước…
      </div>
    );
  }
  return <PortfolioPage config={config} />;
}
