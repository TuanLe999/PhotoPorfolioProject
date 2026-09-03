/* ==========================================================================
   site.js — bootstrap trang portfolio thật: lấy config từ API rồi vẽ trang.
   ========================================================================== */

import { paintPage, startMotion } from './page.js';

document.documentElement.classList.remove('no-js');

const boot = document.getElementById('boot');
const bar = document.getElementById('bootBar');
let fake = 0;
const tick = setInterval(() => {
  fake = Math.min(fake + Math.random() * 18, 88);
  bar.style.width = fake + '%';
}, 160);

init().catch(err => {
  console.error(err);
  finishBoot();
  document.getElementById('heroTitle').textContent = 'Không tải được nội dung';
  document.getElementById('heroSub').textContent = 'Kiểm tra lại server rồi tải lại trang.';
});

async function init() {
  const res = await fetch('/api/site', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('GET /api/site → ' + res.status);
  const cfg = await res.json();

  paintPage(cfg);
  await waitForHero();
  finishBoot();
  startMotion(cfg).refresh();
}

function finishBoot() {
  clearInterval(tick);
  bar.style.width = '100%';
  boot.classList.add('is-done');
  setTimeout(() => boot.remove(), 800);
}

/** Chờ ảnh hero (tối đa 2.5s) để không thấy khoảng trống lúc màn loader tan. */
function waitForHero() {
  const img = document.querySelector('#heroBg img');
  if (!img || img.complete) return Promise.resolve();
  return new Promise(resolve => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 2500);
  });
}
