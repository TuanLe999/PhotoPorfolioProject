import { useEffect, useState } from 'react';

/** Màn chờ trong lúc gọi API — thanh tiến trình giả để trang không "trống trơn". */
export function BootScreen() {
  const [width, setWidth] = useState(8);

  useEffect(() => {
    const timer = setInterval(() => setWidth((w) => Math.min(w + Math.random() * 18, 88)), 160);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="boot">
      <div className="boot__mark">···</div>
      <div className="boot__bar" style={{ width: `${width}%` }} />
    </div>
  );
}
