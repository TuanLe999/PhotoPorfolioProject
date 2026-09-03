/* ==========================================================================
   preview.js — chạy trong iframe của trang admin.
   Nhận config qua postMessage (không lưu server) rồi vẽ y như trang thật.
   ========================================================================== */

import { paintPage, startMotion } from './page.js';

document.documentElement.classList.remove('no-js');

let motion = null;

window.addEventListener('message', (event) => {
  // chỉ nhận lệnh từ chính origin này (trang admin)
  if (event.origin !== window.location.origin) return;
  const msg = event.data;
  if (!msg || msg.type !== 'pf:render' || !msg.config) return;

  paintPage(msg.config);
  if (!motion) motion = startMotion(msg.config);
  else motion.refresh();

  if (msg.scrollTo) {
    const target = document.getElementById('sec-' + msg.scrollTo);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// báo cho admin biết iframe đã sẵn sàng nhận config
window.parent?.postMessage({ type: 'pf:preview-ready' }, window.location.origin);
