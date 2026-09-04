/** Trang portfolio công khai: lấy config từ API rồi dựng trang. */

import { useEffect, useState } from 'react';
import type { SiteConfig } from '../types';
import { api } from '../api/client';
import { PortfolioPage } from '../components/portfolio/PortfolioPage';
import { BootScreen } from '../components/portfolio/BootScreen';

export function PortfolioRoute() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getSite()
      .then((data) => alive && setConfig(data))
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="hero hero__bg--fallback" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <h1 className="hero__title" style={{ fontSize: 'clamp(28px, 5vw, 56px)' }}>
            Không tải được nội dung
          </h1>
          <p className="hero__sub">{error}</p>
        </div>
      </div>
    );
  }

  if (!config) return <BootScreen />;

  return (
    <>
      <PortfolioPage config={config} />
      <a className="admin-link" href="/admin">
        Trang quản trị
      </a>
    </>
  );
}
