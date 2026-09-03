/* ==========================================================================
   canvas.js — vùng dựng trang của admin.
   Dùng chính renderer.js của trang thật, rồi phủ thêm "chrome" chỉnh sửa:
   chọn khối, kéo thả đổi vị trí, kéo cạnh đổi độ rộng, thả ảnh từ thư viện,
   sửa chữ trực tiếp trên khối.
   ========================================================================== */

import { applyTheme, renderSection } from './renderer.js';
import { store, newBlock } from './state.js';
import { h, toast } from './ui.js';

export const MIME_MEDIA = 'application/x-pf-media';
export const MIME_BLOCK = 'application/x-pf-block';

let canvasEl = null;
let suspended = false;
let onEditImage = null;   // callback mở modal cắt ảnh

export function initCanvas({ onCropRequest }) {
  canvasEl = document.getElementById('canvas');
  onEditImage = onCropRequest;

  canvasEl.addEventListener('click', handleClick);
  canvasEl.addEventListener('dblclick', handleDblClick);
  canvasEl.addEventListener('pointerdown', handlePointerDown);
  canvasEl.addEventListener('dragstart', handleDragStart);
  canvasEl.addEventListener('dragover', handleDragOver);
  canvasEl.addEventListener('dragleave', handleDragLeave);
  canvasEl.addEventListener('drop', handleDrop);
  canvasEl.addEventListener('dragend', clearDropHints);

  document.getElementById('deviceSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-device]');
    if (!btn) return;
    canvasEl.dataset.device = btn.dataset.device;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === btn));
  });

  document.getElementById('replayBtn').addEventListener('click', replayAnimations);
}

/** Vẽ lại toàn bộ canvas từ store. */
export function renderCanvas() {
  if (suspended || !canvasEl) return;
  const cfg = store.config;
  applyTheme(cfg.theme, canvasEl);
  canvasEl.style.setProperty('--anim-scale', cfg.theme.animationSpeed ?? 1);

  const scroller = document.getElementById('canvasScroll');
  const keepScroll = scroller.scrollTop;

  canvasEl.replaceChildren();
  if (!cfg.sections.length) {
    canvasEl.append(h('div', { class: 'adm-empty', style: 'padding:80px 20px' },
      'Chưa có khu vực nào. Bấm ＋ ở cột “Bố cục” để thêm.'));
    return;
  }

  for (const section of cfg.sections) {
    const node = renderSection(section, { editable: true, showHidden: true });
    node.prepend(buildSectionTools(section));
    node.querySelector('.pf-section__inner').append(buildAddZone(section));
    if (!section.visible) node.style.opacity = '.45';

    node.querySelectorAll('.pf-block').forEach(block => decorateBlock(block, section));
    canvasEl.append(node);
  }

  highlightSelection();
  scroller.scrollTop = keepScroll;

  // cho hiệu ứng chạy một lượt để admin thấy ngay
  requestAnimationFrame(() => {
    canvasEl.querySelectorAll('[data-anim]').forEach(n => n.classList.add('is-in'));
  });
}

function buildSectionTools(section) {
  const strip = h('div', { class: 'adm-section-tools', dataset: { sectionTools: section.id } },
    h('b', {}, section.name || 'Khu vực'),
    h('span', {}, `· ${section.layout} · ${section.blocks.length} khối`),
    h('div', { class: 'spacer' }),
    h('button', {
      class: 'adm-icon-btn', title: 'Ẩn/hiện khu vực',
      onclick: (e) => { e.stopPropagation(); toggleSection(section.id); }
    }, section.visible ? '👁' : '🚫'),
    h('button', {
      class: 'adm-icon-btn', title: 'Chọn khu vực này',
      onclick: (e) => { e.stopPropagation(); store.select(section.id, null); }
    }, '⌖')
  );
  strip.addEventListener('click', () => store.select(section.id, null));
  return strip;
}

function buildAddZone(section) {
  const zone = h('div', {
    class: 'adm-addzone',
    dataset: { addzone: section.id },
    onclick: () => addBlockTo(section.id, 'image')
  }, '＋ Thêm khối ảnh — hoặc kéo ảnh từ thư viện thả vào đây');
  return zone;
}

/** Thêm chrome chỉnh sửa cho một block đã render. */
function decorateBlock(node, section) {
  const id = node.dataset.blockId;
  const block = section.blocks.find(b => b.id === id);
  if (!block) return;

  const chrome = h('div', { class: 'adm-chrome' },
    h('button', { class: 'adm-chrome__grip', title: 'Kéo để đổi vị trí' }, '⠿'),
    h('span', { class: 'adm-chrome__span' }, block.colSpan + '/12'),
    block.type === 'image' && block.src
      ? h('button', { title: 'Cắt ảnh', onclick: (e) => { e.stopPropagation(); onEditImage?.(block, section); } }, '✂')
      : null,
    h('button', { title: 'Nhân bản', onclick: (e) => { e.stopPropagation(); duplicateBlock(section.id, id); } }, '⧉'),
    h('button', { title: 'Xoá khối', onclick: (e) => { e.stopPropagation(); removeBlock(section.id, id); } }, '✕')
  );

  node.style.position = 'relative';
  node.append(chrome, h('div', { class: 'adm-resize', dataset: { resize: id } }));
  node.draggable = false;
}

function highlightSelection() {
  const { blockId, sectionId } = store.selection;
  canvasEl.querySelectorAll('.pf-block').forEach(n =>
    n.classList.toggle('is-selected', n.dataset.blockId === blockId));
  canvasEl.querySelectorAll('.pf-section').forEach(n =>
    n.classList.toggle('is-target-section', !blockId && n.dataset.sectionId === sectionId));
}

// ---------------------------------------------------------------- tương tác

function handleClick(e) {
  if (e.target.closest('.adm-chrome') || e.target.closest('.adm-addzone') || e.target.closest('.adm-section-tools')) return;
  const blockNode = e.target.closest('.pf-block');
  const sectionNode = e.target.closest('.pf-section');
  if (blockNode) {
    e.preventDefault();
    store.select(sectionNode?.dataset.sectionId || null, blockNode.dataset.blockId);
  } else if (sectionNode) {
    store.select(sectionNode.dataset.sectionId, null);
  }
}

/** Sửa chữ trực tiếp: nháy đúp vào tiêu đề/nội dung của khối chữ. */
function handleDblClick(e) {
  const target = e.target.closest('.pf-text__title, .pf-text__body, .pf-quote__body, .pf-quote__by, .pf-caption');
  if (!target) return;
  const blockNode = target.closest('.pf-block');
  if (!blockNode) return;

  const field = target.classList.contains('pf-text__title') || target.classList.contains('pf-quote__by')
    ? 'title'
    : target.classList.contains('pf-caption') ? 'caption' : 'body';

  target.contentEditable = 'true';
  target.style.outline = '2px solid var(--ui-brand)';
  target.style.outlineOffset = '2px';
  target.focus();
  document.getSelection()?.selectAllChildren(target);
  suspended = true;

  const commit = () => {
    target.contentEditable = 'false';
    target.style.outline = '';
    suspended = false;
    const text = target.textContent.trim();
    const id = blockNode.dataset.blockId;
    store.mutate('inline-text', () => {
      const { block } = store.block(id);
      if (block) block[field] = text;
    });
  };
  target.addEventListener('blur', commit, { once: true });
  target.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); target.blur(); }
    if (ev.key === 'Enter' && !ev.shiftKey && field !== 'body') { ev.preventDefault(); target.blur(); }
  });
}

/** Kéo cạnh phải để đổi độ rộng (snap theo cột). */
function handlePointerDown(e) {
  const handle = e.target.closest('.adm-resize');
  if (!handle) return;
  e.preventDefault();

  const blockNode = handle.closest('.pf-block');
  const blocksWrap = blockNode.closest('.pf-blocks');
  const sectionNode = blockNode.closest('.pf-section');
  const section = store.section(sectionNode.dataset.sectionId);
  const id = blockNode.dataset.blockId;
  const block = section?.blocks.find(b => b.id === id);
  if (!block) return;

  const cols = Math.max(1, Math.min(section.columns || 12, 12));
  const gap = section.gap ?? 16;
  const colWidth = (blocksWrap.clientWidth - gap * (cols - 1)) / cols;
  const startX = e.clientX;
  const startSpan = block.colSpan;
  let span = startSpan;

  suspended = true;
  canvasEl.classList.add('is-resizing');
  const label = blockNode.querySelector('.adm-chrome__span');

  const move = (ev) => {
    const delta = Math.round((ev.clientX - startX) / (colWidth + gap));
    const next = Math.max(1, Math.min(startSpan + delta, cols));
    if (next === span) return;
    span = next;
    blockNode.style.setProperty('--span', span);
    if (label) label.textContent = span + '/' + cols;
  };

  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    canvasEl.classList.remove('is-resizing');
    suspended = false;
    if (span !== startSpan) {
      store.mutate('resize', () => {
        const { block: b } = store.block(id);
        if (b) b.colSpan = span;
      });
    }
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// ---------------------------------------------------------------- drag & drop

function handleDragStart(e) {
  const grip = e.target.closest('.adm-chrome__grip');
  const blockNode = e.target.closest('.pf-block');
  if (!grip || !blockNode) { e.preventDefault(); return; }

  e.dataTransfer.setData(MIME_BLOCK, blockNode.dataset.blockId);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setDragImage(blockNode, 30, 20);
  blockNode.classList.add('is-dragging');
}

// grip cần draggable=true; gán khi chuột nhấn xuống để không cản click
document.addEventListener('pointerdown', (e) => {
  const grip = e.target.closest('.adm-chrome__grip');
  if (grip) grip.closest('.pf-block').draggable = true;
}, true);
document.addEventListener('pointerup', () => {
  document.querySelectorAll('.pf-block[draggable="true"]').forEach(n => { n.draggable = false; });
}, true);

function payloadKind(dt) {
  if (dt.types.includes(MIME_BLOCK)) return 'block';
  if (dt.types.includes(MIME_MEDIA)) return 'media';
  if (dt.types.includes('Files')) return 'files';
  return null;
}

function handleDragOver(e) {
  const kind = payloadKind(e.dataTransfer);
  if (!kind) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = kind === 'block' ? 'move' : 'copy';
  clearDropHints();

  const zone = e.target.closest('.adm-addzone');
  if (zone) { zone.classList.add('is-over'); return; }

  const blockNode = e.target.closest('.pf-block');
  if (!blockNode) {
    e.target.closest('.pf-section')?.classList.add('is-target-section');
    return;
  }

  // thả ảnh vào giữa khối ảnh -> gán ảnh cho khối đó
  if (kind !== 'block' && blockNode.querySelector('.pf-frame')) {
    blockNode.classList.add('is-drop-into');
    return;
  }
  const rect = blockNode.getBoundingClientRect();
  blockNode.classList.add(e.clientX < rect.left + rect.width / 2 ? 'is-drop-before' : 'is-drop-after');
}

function handleDragLeave(e) {
  if (!e.relatedTarget || !canvasEl.contains(e.relatedTarget)) clearDropHints();
}

export function clearDropHints() {
  canvasEl?.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-into, .is-dragging, .adm-addzone.is-over, .pf-section.is-target-section')
    .forEach(n => n.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-into', 'is-dragging', 'is-over', 'is-target-section'));
  highlightSelection();
}

async function handleDrop(e) {
  const kind = payloadKind(e.dataTransfer);
  if (!kind) return;
  e.preventDefault();

  const zone = e.target.closest('.adm-addzone');
  const blockNode = e.target.closest('.pf-block');
  const sectionNode = e.target.closest('.pf-section');
  const sectionId = sectionNode?.dataset.sectionId;
  clearDropHints();
  if (!sectionId) return;

  // 1) kéo file ảnh trực tiếp từ máy vào canvas
  if (kind === 'files') {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    document.dispatchEvent(new CustomEvent('pf:upload-files', {
      detail: { files, target: { sectionId, blockId: blockNode?.dataset.blockId, mode: blockNode && !zone ? 'assign' : 'append' } }
    }));
    return;
  }

  // 2) kéo ảnh từ thư viện
  if (kind === 'media') {
    const url = e.dataTransfer.getData(MIME_MEDIA);
    if (!url) return;
    if (blockNode && !zone && blockNode.querySelector('.pf-frame')) {
      assignImage(blockNode.dataset.blockId, url);
    } else {
      addBlockTo(sectionId, 'image', { src: url });
    }
    return;
  }

  // 3) kéo khối để đổi vị trí
  const dragId = e.dataTransfer.getData(MIME_BLOCK);
  if (!dragId) return;

  if (zone || !blockNode) {
    moveBlock(dragId, sectionId, null, 'append');
  } else if (blockNode.dataset.blockId !== dragId) {
    const rect = blockNode.getBoundingClientRect();
    const where = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    moveBlock(dragId, sectionId, blockNode.dataset.blockId, where);
  }
}

// ---------------------------------------------------------------- thao tác dữ liệu

export function addBlockTo(sectionId, type = 'image', patch = {}) {
  const block = newBlock(type, patch);
  store.mutate('add-block', (cfg) => {
    const section = cfg.sections.find(s => s.id === sectionId) || cfg.sections[0];
    if (!section) return;
    section.blocks.push(block);
  });
  store.select(sectionId, block.id);
  return block;
}

export function assignImage(blockId, url) {
  store.mutate('assign-image', () => {
    const { block } = store.block(blockId);
    if (!block) return;
    if (block.type !== 'image') block.type = 'image';
    block.src = url;
    block.crop = null;
  });
}

export function duplicateBlock(sectionId, blockId) {
  store.mutate('duplicate-block', (cfg) => {
    const section = cfg.sections.find(s => s.id === sectionId);
    const index = section?.blocks.findIndex(b => b.id === blockId);
    if (index == null || index < 0) return;
    const copy = structuredClone(section.blocks[index]);
    copy.id = Math.random().toString(36).slice(2, 10);
    section.blocks.splice(index + 1, 0, copy);
  });
}

export function removeBlock(sectionId, blockId) {
  store.mutate('remove-block', (cfg) => {
    const section = cfg.sections.find(s => s.id === sectionId);
    if (!section) return;
    section.blocks = section.blocks.filter(b => b.id !== blockId);
  });
  if (store.selection.blockId === blockId) store.select(sectionId, null);
  toast('Đã xoá khối — Ctrl+Z để hoàn tác.');
}

export function moveBlock(blockId, toSectionId, anchorId, where) {
  store.mutate('move-block', (cfg) => {
    let moved = null;
    for (const section of cfg.sections) {
      const index = section.blocks.findIndex(b => b.id === blockId);
      if (index >= 0) { moved = section.blocks.splice(index, 1)[0]; break; }
    }
    if (!moved) return;

    const target = cfg.sections.find(s => s.id === toSectionId);
    if (!target) return;
    if (!anchorId || where === 'append') { target.blocks.push(moved); return; }

    const anchor = target.blocks.findIndex(b => b.id === anchorId);
    target.blocks.splice(anchor < 0 ? target.blocks.length : anchor + (where === 'after' ? 1 : 0), 0, moved);
  });
}

export function toggleSection(sectionId) {
  store.mutate('toggle-section', (cfg) => {
    const section = cfg.sections.find(s => s.id === sectionId);
    if (section) section.visible = !section.visible;
  });
}

/** Cho hiệu ứng chạy lại từ đầu để kiểm tra cảm giác chuyển động. */
export function replayAnimations() {
  const nodes = canvasEl.querySelectorAll('[data-anim]');
  nodes.forEach(n => n.classList.remove('is-in'));
  void canvasEl.offsetHeight; // ép reflow để transition chạy lại
  requestAnimationFrame(() => nodes.forEach(n => n.classList.add('is-in')));
}

/** Cuộn canvas tới một khối và làm nổi bật. */
export function scrollToBlock(blockId) {
  const node = canvasEl?.querySelector(`.pf-block[data-block-id="${blockId}"]`);
  node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
