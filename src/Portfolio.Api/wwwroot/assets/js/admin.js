/* ==========================================================================
   admin.js — điều phối toàn bộ trang quản trị:
   đăng nhập → tải config → sidebar/inspector/canvas → preview → lưu.
   ========================================================================== */

import { api } from './api.js';
import { store, newSection, newBlock, uid } from './state.js';
import { ANIMATIONS, HOVERS, LAYOUTS, BLOCK_TYPES } from './renderer.js';
import { h, field, row, toast, wireModals, confirmAction } from './ui.js';
import {
  initCanvas, renderCanvas, addBlockTo, assignImage,
  toggleSection, scrollToBlock, MIME_MEDIA
} from './canvas.js';
import { openCropModal, openCollageModal } from './imagetools.js';

const $ = (id) => document.getElementById(id);

const PALETTES = [
  { name: 'Vàng đồng', primary: '#e8c37a', accent: '#7ac8e8', background: '#0b0b0f', surface: '#14141b', text: '#f4f2ee', muted: '#9a97a3', mode: 'dark' },
  { name: 'Hồng khói', primary: '#e3a9a1', accent: '#c8b4e8', background: '#100c0e', surface: '#1a1417', text: '#f7f0ee', muted: '#a3959a', mode: 'dark' },
  { name: 'Xanh đêm', primary: '#7fd1c1', accent: '#9db4ff', background: '#080d12', surface: '#101820', text: '#eef4f6', muted: '#8fa0aa', mode: 'dark' },
  { name: 'Giấy ngà', primary: '#8a6f4e', accent: '#3f6f6b', background: '#f6f2ea', surface: '#efe8dc', text: '#241f1a', muted: '#6d6459', mode: 'light' },
  { name: 'Trắng gallery', primary: '#1b1b1b', accent: '#b8763f', background: '#ffffff', surface: '#f3f3f1', text: '#141414', muted: '#6f6f6f', mode: 'light' },
  { name: 'Điện ảnh', primary: '#d8532f', accent: '#e8c37a', background: '#0d0a08', surface: '#171210', text: '#f2ebe4', muted: '#9c8f85', mode: 'dark' }
];

const FONTS = [
  { id: "'Cormorant Garamond', Georgia, serif", label: 'Cormorant (serif thanh)' },
  { id: "'Playfair Display', Georgia, serif", label: 'Playfair Display' },
  { id: "'DM Serif Display', Georgia, serif", label: 'DM Serif Display' },
  { id: "'Space Grotesk', system-ui, sans-serif", label: 'Space Grotesk' },
  { id: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { id: 'Georgia, serif', label: 'Georgia' },
  { id: 'system-ui, sans-serif', label: 'Hệ thống' }
];

const TEMPLATES = [
  { name: 'Ảnh lớn + 2 ảnh nhỏ', build: () => [nb(8, 1.5), nb(4, 0.75), nb(4, 0.75, { animation: 'fade-left' })] },
  { name: 'Lưới 3 cột đều', build: () => [nb(4), nb(4, 1, { delay: 100 }), nb(4, 1, { delay: 200 })] },
  { name: 'Ảnh + khối chữ', build: () => [nb(7, 1.4), newBlock('text', { colSpan: 5, animation: 'fade-left' })] },
  { name: 'Bộ 6 ảnh so le', build: () => [nb(4, 1.3), nb(4, 0.8), nb(4, 1.3), nb(4, 0.8), nb(4, 1.3), nb(4, 0.8)] },
  { name: 'Trích dẫn giữa trang', build: () => [newBlock('quote', { colSpan: 12, align: 'center', animation: 'blur-in' })] },
  { name: 'Băng ảnh trượt ngang', build: () => [nb(4, 1.2), nb(4, 1.2), nb(4, 1.2), nb(4, 1.2)] }
];

const nb = (colSpan, aspectRatio = 1, patch = {}) => newBlock('image', { colSpan, aspectRatio, ...patch });

let mediaItems = [];
let pickedMedia = new Set();
let previewReady = false;

boot();

// ================================================================ boot

async function boot() {
  wireModals();

  try {
    const me = await api.me();
    if (!me.authenticated) return showLogin(me.usingDefaultPassword);
    await startApp(me.usingDefaultPassword);
  } catch (err) {
    showLogin(false);
    toast('Không kết nối được server: ' + err.message, 'err', 6000);
  }
}

function showLogin(defaultPass) {
  $('login').hidden = false;
  $('loginPass').focus();
  if (defaultPass) $('loginErr').textContent = 'Gợi ý: mật khẩu mặc định là admin123 (nên đổi trong appsettings.json).';

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra…';
    try {
      const res = await api.login($('loginPass').value);
      $('login').hidden = true;
      await startApp(res.usingDefaultPassword);
    } catch (err) {
      $('loginErr').textContent = err.message;
      $('loginPass').select();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  });
}

async function startApp(defaultPass) {
  $('shell').hidden = false;

  const [config, media] = await Promise.all([api.getSite(), api.getMedia().catch(() => ({ items: [] }))]);
  mediaItems = media.items || [];

  const draft = store.loadDraft();
  if (draft && draft.config && draft.config.revision === config.revision && isDifferent(draft.config, config)) {
    const when = new Date(draft.at).toLocaleString('vi-VN');
    if (confirmAction(`Có bản nháp chưa lưu lúc ${when}. Dùng lại bản nháp đó?`)) {
      store.init(draft.config);
      store.dirty = true;
    } else {
      store.clearDraft();
      store.init(config);
    }
  } else {
    store.clearDraft();
    store.init(config);
  }

  initCanvas({ onCropRequest: openCrop });
  wireTabs();
  wireTopBar();
  wireMediaPane();
  wireDataPane();
  wirePreview();
  wireShortcuts();

  store.subscribe(onStoreChange);
  renderAll();

  if (defaultPass) {
    toast('Bạn đang dùng mật khẩu mặc định admin123 — hãy đổi Admin:Password trong appsettings.json.', 'err', 8000);
  }
}

const isDifferent = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

/**
 * Điều phối vẽ lại sau mỗi thay đổi.
 * Khi người dùng đang kéo slider / gõ vào input, KHÔNG dựng lại panel chứa nó
 * (nếu không sẽ mất focus giữa lúc kéo) — chỉ cập nhật canvas.
 */
function onStoreChange(reason) {
  if (reason === 'select') {
    renderSectionList();
    renderSectionSettings();
    renderInspector();
    renderCanvas();
    return;
  }

  if (reason === 'init' || reason === 'saved' || reason === 'undo' || reason === 'redo') {
    renderAll();
    if (!$('preview').hidden) pushPreview();
    return;
  }

  renderCanvas();
  renderStatus();
  renderSectionList();              // danh sách không chứa input -> dựng lại luôn được
  if (!isEditingControl()) {
    renderSectionSettings();
    renderThemePane();
    renderSitePane();
    renderInspector();
  }
  if (!$('preview').hidden) pushPreview();
}

/** True khi đang gõ/kéo một control trong sidebar hoặc inspector. */
function isEditingControl() {
  if (window.__pfInteracting) return true;
  const el = document.activeElement;
  if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return false;
  return !!el.closest('#inspector, .adm-panes');
}

function renderAll() {
  renderCanvas();
  renderSectionList();
  renderSectionSettings();
  renderAddBlockRow();
  renderTemplates();
  renderThemePane();
  renderSitePane();
  renderInspector();
  renderStatus();
}

// ================================================================ top bar

function wireTopBar() {
  $('saveBtn').addEventListener('click', save);
  $('undoBtn').addEventListener('click', () => store.undo());
  $('redoBtn').addEventListener('click', () => store.redo());
  $('logoutBtn').addEventListener('click', async () => {
    if (store.dirty && !confirmAction('Còn thay đổi chưa lưu. Vẫn đăng xuất?')) return;
    await api.logout();
    location.reload();
  });
  $('inspectorToggle').addEventListener('click', () => $('inspector').classList.toggle('is-open'));

  window.addEventListener('beforeunload', (e) => {
    if (!store.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

function renderStatus() {
  const badge = $('statusBadge');
  badge.className = 'adm-badge ' + (store.dirty ? 'adm-badge--dirty' : 'adm-badge--saved');
  badge.textContent = store.dirty
    ? '● Chưa lưu'
    : `Đã lưu · bản ${store.config.revision}`;

  $('undoBtn').disabled = !store.canUndo();
  $('redoBtn').disabled = !store.canRedo();
}

async function save() {
  const btn = $('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Đang lưu…';
  try {
    const saved = await api.saveSite(store.config);
    store.markSaved(saved);
    renderAll();
    toast('Đã áp dụng lên trang portfolio.', 'ok');
    loadHistory();
  } catch (err) {
    toast('Lưu thất bại: ' + err.message, 'err', 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lưu & áp dụng';
  }
}

function wireShortcuts() {
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (ctrl && e.key.toLowerCase() === 'p') { e.preventDefault(); togglePreview(true); return; }
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { if (typing) return; e.preventDefault(); store.undo(); return; }
    if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      if (typing) return;
      e.preventDefault();
      store.redo();
      return;
    }
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && store.selection.blockId) {
      e.preventDefault();
      const { sectionId, blockId } = store.selection;
      store.mutate('remove-block', (cfg) => {
        const section = cfg.sections.find(s => s.id === sectionId);
        if (section) section.blocks = section.blocks.filter(b => b.id !== blockId);
      });
      store.select(sectionId, null);
    }
  });
}

// ================================================================ tabs

function wireTabs() {
  $('shell').querySelector('.adm-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.adm-tab');
    if (!tab) return;
    document.querySelectorAll('.adm-tab').forEach(t => t.classList.toggle('is-active', t === tab));
    document.querySelectorAll('.adm-pane').forEach(p =>
      p.classList.toggle('is-active', p.dataset.pane === tab.dataset.tab));
    if (tab.dataset.tab === 'history') loadHistory();
  });
}

// ================================================================ danh sách khu vực

function renderSectionList() {
  const host = $('sectionList');
  host.replaceChildren();

  store.config.sections.forEach((section, index) => {
    const item = h('div', {
      class: 'adm-item'
        + (store.selection.sectionId === section.id ? ' is-active' : '')
        + (section.visible ? '' : ' is-hidden'),
      dataset: { sectionId: section.id, index },
      onclick: () => {
        store.select(section.id, null);
        document.getElementById('sec-' + section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
      h('span', { class: 'adm-item__grip', title: 'Kéo để đổi thứ tự' }, '⠿'),
      h('div', { class: 'adm-item__body' },
        h('div', { class: 'adm-item__name' }, section.name || '(không tên)'),
        h('div', { class: 'adm-item__meta' }, `${section.blocks.length} khối · ${section.layout}`)),
      h('div', { class: 'adm-item__actions' },
        h('button', {
          class: 'adm-icon-btn', title: 'Ẩn/hiện',
          onclick: (e) => { e.stopPropagation(); toggleSection(section.id); }
        }, section.visible ? '👁' : '🚫'),
        h('button', {
          class: 'adm-icon-btn', title: 'Nhân bản',
          onclick: (e) => { e.stopPropagation(); duplicateSection(section.id); }
        }, '⧉'),
        h('button', {
          class: 'adm-icon-btn adm-icon-btn--danger', title: 'Xoá khu vực',
          onclick: (e) => { e.stopPropagation(); removeSection(section.id); }
        }, '✕'))
    );

    // kéo thả đổi thứ tự khu vực
    item.draggable = true;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-pf-section', section.id);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('is-dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('is-dragging'));
    item.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('application/x-pf-section')) return;
      e.preventDefault();
      item.classList.add('is-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('is-over'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('is-over');
      const dragged = e.dataTransfer.getData('application/x-pf-section');
      if (dragged && dragged !== section.id) reorderSection(dragged, index);
    });

    host.append(item);
  });

  if (!store.config.sections.length) {
    host.append(h('div', { class: 'adm-empty' }, 'Chưa có khu vực nào.'));
  }

  $('addSection').onclick = () => {
    const section = newSection({ name: 'Khu vực ' + (store.config.sections.length + 1) });
    store.mutate('add-section', (cfg) => cfg.sections.push(section));
    store.select(section.id, null);
  };
}

function duplicateSection(id) {
  store.mutate('duplicate-section', (cfg) => {
    const index = cfg.sections.findIndex(s => s.id === id);
    if (index < 0) return;
    const copy = structuredClone(cfg.sections[index]);
    copy.id = uid();
    copy.name = copy.name + ' (bản sao)';
    copy.blocks.forEach(b => { b.id = uid(); });
    cfg.sections.splice(index + 1, 0, copy);
  });
}

function removeSection(id) {
  const section = store.section(id);
  if (!confirmAction(`Xoá khu vực “${section?.name}” cùng ${section?.blocks.length} khối?`)) return;
  store.mutate('remove-section', (cfg) => { cfg.sections = cfg.sections.filter(s => s.id !== id); });
  if (store.selection.sectionId === id) store.select(null, null);
}

function reorderSection(dragId, targetIndex) {
  store.mutate('reorder-section', (cfg) => {
    const from = cfg.sections.findIndex(s => s.id === dragId);
    if (from < 0) return;
    const [moved] = cfg.sections.splice(from, 1);
    cfg.sections.splice(targetIndex, 0, moved);
  });
}

// ================================================================ cài đặt khu vực

function renderSectionSettings() {
  const host = $('sectionSettings');
  host.replaceChildren();
  const section = store.selectedSection();
  if (!section) {
    host.append(h('p', { class: 'adm-hint' }, 'Chọn một khu vực để đổi tiêu đề, kiểu bố cục, khoảng cách…'));
    return;
  }

  const set = (key) => (value) => store.mutate('section-' + key, () => {
    const target = store.section(section.id);
    if (target) target[key] = value;
  });

  host.append(
    h('div', { class: 'adm-group__title' }, 'Khu vực: ' + (section.name || '')),
    field({ label: 'Tên (hiện trên menu)', value: section.name, onInput: set('name') }),
    field({ label: 'Tiêu đề lớn', value: section.heading || '', onInput: set('heading') }),
    field({ type: 'textarea', rows: 2, label: 'Mô tả ngắn', value: section.subheading || '', onInput: set('subheading') }),
    field({ type: 'select', label: 'Kiểu bố cục', value: section.layout, options: LAYOUTS, onInput: set('layout') }),
    row(
      field({ type: 'range', label: 'Số cột', value: section.columns, min: 1, max: 12, onInput: set('columns') }),
      field({ type: 'range', label: 'Khoảng cách', value: section.gap, min: 0, max: 60, unit: 'px', onInput: set('gap') })
    ),
    field({
      type: 'seg', label: 'Nền khu vực', value: section.background,
      options: [{ id: 'transparent', label: 'Trong' }, { id: 'surface', label: 'Đậm' }, { id: 'accent', label: 'Loang màu' }],
      onInput: set('background')
    }),
    field({ type: 'checkbox', checkboxLabel: 'Hiện khu vực này trên trang', value: section.visible, onInput: set('visible') })
  );
}

function renderAddBlockRow() {
  const host = $('addBlockRow');
  host.replaceChildren(...BLOCK_TYPES.map(type =>
    h('button', {
      class: 'adm-preset',
      onclick: () => {
        const sectionId = store.selection.sectionId || store.config.sections[0]?.id;
        if (!sectionId) return toast('Thêm một khu vực trước đã.', 'err');
        addBlockTo(sectionId, type.id);
      }
    }, '＋ ' + type.label)));
}

function renderTemplates() {
  const host = $('templateList');
  host.replaceChildren(...TEMPLATES.map(tpl =>
    h('div', {
      class: 'adm-item',
      onclick: () => {
        const sectionId = store.selection.sectionId || store.config.sections[0]?.id;
        if (!sectionId) return toast('Thêm một khu vực trước đã.', 'err');
        const blocks = tpl.build();
        store.mutate('apply-template', (cfg) => {
          const section = cfg.sections.find(s => s.id === sectionId);
          if (section) section.blocks.push(...blocks);
        });
        toast(`Đã thêm mẫu “${tpl.name}”.`, 'ok');
      }
    },
      h('div', { class: 'adm-item__body' },
        h('div', { class: 'adm-item__name' }, tpl.name),
        h('div', { class: 'adm-item__meta' }, 'thêm vào khu vực đang chọn')),
      h('span', { class: 'adm-item__grip' }, '＋'))));
}

// ================================================================ thư viện ảnh

function wireMediaPane() {
  const dropzone = $('dropzone');
  const input = $('fileInput');

  dropzone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files.length) uploadFiles(Array.from(input.files));
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach(type =>
    dropzone.addEventListener(type, (e) => { e.preventDefault(); dropzone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(type =>
    dropzone.addEventListener(type, () => dropzone.classList.remove('is-over')));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadFiles(files);
  });

  // kéo file từ máy thả trực tiếp vào canvas
  document.addEventListener('pf:upload-files', async (e) => {
    const { files, target } = e.detail;
    const saved = await uploadFiles(files);
    if (!saved?.length) return;
    if (target.mode === 'assign' && target.blockId) {
      assignImage(target.blockId, saved[0].url);
      saved.slice(1).forEach(item => addBlockTo(target.sectionId, 'image', { src: item.url }));
    } else {
      saved.forEach(item => addBlockTo(target.sectionId, 'image', { src: item.url }));
    }
  });

  $('collageBtn').addEventListener('click', () => {
    openCollageModal(Array.from(pickedMedia), {
      onSaved: (item) => {
        mediaItems.unshift(item);
        pickedMedia.clear();
        renderMediaGrid();
      }
    });
  });

  renderMediaGrid();
}

async function uploadFiles(files) {
  const progress = $('uploadProgress');
  const bar = progress.querySelector('i');
  progress.classList.add('is-on');
  bar.style.width = '0%';

  try {
    const res = await api.upload(files, (p) => { bar.style.width = Math.round(p * 100) + '%'; });
    const saved = res.saved || [];
    mediaItems = saved.concat(mediaItems);
    renderMediaGrid();
    if (saved.length) toast(`Đã tải lên ${saved.length} ảnh.`, 'ok');
    if (res.skipped?.length) toast('Bỏ qua: ' + res.skipped.join(', '), 'err', 6000);
    return saved;
  } catch (err) {
    toast(err.message, 'err', 6000);
    return [];
  } finally {
    setTimeout(() => progress.classList.remove('is-on'), 500);
  }
}

function renderMediaGrid() {
  const grid = $('mediaGrid');
  $('mediaCount').textContent = mediaItems.length;
  grid.replaceChildren();

  if (!mediaItems.length) {
    grid.append(h('div', { class: 'adm-empty', style: 'grid-column:1/-1' }, 'Chưa có ảnh nào.'));
    return;
  }

  for (const item of mediaItems) {
    const thumb = h('div', {
      class: 'adm-thumb' + (pickedMedia.has(item.url) ? ' is-picked' : ''),
      title: `${item.fileName}\n${item.width}×${item.height} · ${Math.round(item.size / 1024)}KB`,
      dataset: { url: item.url }
    },
      h('img', { src: item.url, alt: '', loading: 'lazy' }),
      h('button', {
        class: 'adm-thumb__x', title: 'Xoá khỏi thư viện',
        onclick: async (e) => {
          e.stopPropagation();
          if (!confirmAction('Xoá ảnh này khỏi thư viện? Các khối đang dùng ảnh sẽ mất hình.')) return;
          try {
            await api.deleteMedia(item.id);
            mediaItems = mediaItems.filter(m => m.id !== item.id);
            pickedMedia.delete(item.url);
            renderMediaGrid();
          } catch (err) { toast(err.message, 'err'); }
        }
      }, '✕'),
      pickedMedia.has(item.url) ? h('span', { class: 'adm-thumb__pick' }, 'đã chọn') : null
    );

    thumb.draggable = true;
    thumb.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData(MIME_MEDIA, item.url);
      e.dataTransfer.effectAllowed = 'copy';
    });

    thumb.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        pickedMedia.has(item.url) ? pickedMedia.delete(item.url) : pickedMedia.add(item.url);
        renderMediaGrid();
        return;
      }
      // bấm thường: gán vào khối đang chọn, nếu không có thì thêm khối mới
      const { blockId, sectionId } = store.selection;
      if (blockId) {
        assignImage(blockId, item.url);
        scrollToBlock(blockId);
      } else if (sectionId) {
        addBlockTo(sectionId, 'image', { src: item.url });
      } else {
        toast('Chọn một khối hoặc khu vực trước, hoặc kéo ảnh thả vào canvas.', 'err');
      }
    });

    grid.append(thumb);
  }
}

// ================================================================ tone màu

function renderThemePane() {
  const host = $('themeFields');
  host.replaceChildren();
  const theme = store.config.theme;

  const set = (key) => (value) => store.mutate('theme-' + key, (cfg) => { cfg.theme[key] = value; });

  $('palettePresets').replaceChildren(...PALETTES.map(p =>
    h('button', {
      class: 'adm-preset',
      onclick: () => store.mutate('palette', (cfg) => {
        Object.assign(cfg.theme, {
          primary: p.primary, accent: p.accent, background: p.background,
          surface: p.surface, text: p.text, muted: p.muted, mode: p.mode
        });
      })
    },
      h('i', {},
        h('span', { style: `background:${p.primary}` }),
        h('span', { style: `background:${p.accent}` }),
        h('span', { style: `background:${p.background};box-shadow:inset 0 0 0 1px #fff3` })),
      p.name)));

  host.append(
    h('div', { class: 'adm-group__title' }, 'Màu'),
    field({ type: 'color', label: 'Màu nhấn chính', value: theme.primary, onInput: set('primary') }),
    field({ type: 'color', label: 'Màu phụ', value: theme.accent, onInput: set('accent') }),
    field({ type: 'color', label: 'Nền trang', value: theme.background, onInput: set('background') }),
    field({ type: 'color', label: 'Nền khối', value: theme.surface, onInput: set('surface') }),
    field({ type: 'color', label: 'Chữ', value: theme.text, onInput: set('text') }),
    field({ type: 'color', label: 'Chữ mờ', value: theme.muted, onInput: set('muted') }),

    h('div', { class: 'adm-group__title', style: 'margin-top:20px' }, 'Kiểu chữ & hình khối'),
    field({ type: 'select', label: 'Font tiêu đề', value: theme.headingFont, options: FONTS, onInput: set('headingFont') }),
    field({ type: 'select', label: 'Font nội dung', value: theme.bodyFont, options: FONTS, onInput: set('bodyFont') }),
    field({ type: 'range', label: 'Bo góc', value: theme.radius, min: 0, max: 40, unit: 'px', onInput: set('radius') }),

    h('div', { class: 'adm-group__title', style: 'margin-top:20px' }, 'Không khí & chuyển động'),
    field({ type: 'range', label: 'Hạt phim (grain)', value: Math.round((theme.grain ?? 0) * 100), min: 0, max: 40, unit: '%', onInput: (v) => set('grain')(v / 100) }),
    field({ type: 'range', label: 'Tốc độ animation', value: theme.animationSpeed, min: 0.2, max: 2.5, step: 0.1, unit: '×', onInput: set('animationSpeed') }),
    field({
      type: 'seg', label: 'Quầng sáng theo con trỏ', value: theme.cursorGlow,
      options: [{ id: 'on', label: 'Bật' }, { id: 'off', label: 'Tắt' }], onInput: set('cursorGlow')
    }),
    field({
      type: 'seg', label: 'Chế độ', value: theme.mode,
      options: [{ id: 'dark', label: 'Tối' }, { id: 'light', label: 'Sáng' }], onInput: set('mode')
    })
  );
}

// ================================================================ thông tin trang

function renderSitePane() {
  const host = $('siteFields');
  host.replaceChildren();
  const site = store.config.site;
  const set = (key) => (value) => store.mutate('site-' + key, (cfg) => { cfg.site[key] = value; });

  host.append(
    h('div', { class: 'adm-group__title' }, 'Thương hiệu'),
    field({ label: 'Tên studio', value: site.title, onInput: set('title') }),
    field({ label: 'Chữ logo', value: site.logoText, onInput: set('logoText') }),
    field({ label: 'Tagline', value: site.tagline, onInput: set('tagline') }),

    h('div', { class: 'adm-group__title', style: 'margin-top:20px' }, 'Màn hình đầu (hero)'),
    field({ type: 'textarea', rows: 2, label: 'Tiêu đề lớn', value: site.heroHeadline, onInput: set('heroHeadline') }),
    field({ type: 'textarea', rows: 2, label: 'Mô tả', value: site.heroSub, onInput: set('heroSub') }),
    mediaPicker('Ảnh nền hero', site.heroImage, set('heroImage')),
    row(
      field({ label: 'Chữ trên nút', value: site.heroCtaText, onInput: set('heroCtaText') }),
      field({ label: 'Nút dẫn tới', value: site.heroCtaLink, onInput: set('heroCtaLink') })
    ),

    h('div', { class: 'adm-group__title', style: 'margin-top:20px' }, 'Về tôi'),
    field({ type: 'textarea', rows: 5, label: 'Giới thiệu', value: site.about, onInput: set('about') }),
    mediaPicker('Ảnh chân dung', site.aboutImage, set('aboutImage')),

    h('div', { class: 'adm-group__title', style: 'margin-top:20px' }, 'Liên hệ'),
    field({ label: 'Email', value: site.email, onInput: set('email') }),
    field({ label: 'Điện thoại', value: site.phone, onInput: set('phone') }),
    field({ label: 'Địa chỉ', value: site.address, onInput: set('address') }),
    field({ label: 'Instagram (URL)', value: site.instagram, onInput: set('instagram') }),
    field({ label: 'Facebook (URL)', value: site.facebook, onInput: set('facebook') }),
    field({ label: 'Behance (URL)', value: site.behance, onInput: set('behance') }),
    field({ label: 'Dòng chân trang', value: site.footerNote, onInput: set('footerNote') })
  );

  renderServices();
}

/** Ô chọn ảnh từ thư viện (dùng cho hero/about). */
function mediaPicker(label, value, onPick) {
  const preview = h('div', {
    style: 'width:46px;height:34px;border-radius:6px;border:1px solid var(--ui-line);background:#0f1217;'
      + 'background-size:cover;background-position:center;flex:none'
      + (value ? `;background-image:url(${JSON.stringify(value)})` : '')
  });

  const select = h('select', { class: 'sel' },
    h('option', { value: '' }, '— không dùng —'),
    ...mediaItems.map(m => {
      const opt = h('option', { value: m.url }, m.fileName);
      if (m.url === value) opt.selected = true;
      return opt;
    }));
  select.addEventListener('change', () => {
    onPick(select.value || null);
    preview.style.backgroundImage = select.value ? `url(${JSON.stringify(select.value)})` : '';
  });

  return h('div', { class: 'f' },
    h('div', { class: 'f__label' }, label),
    h('div', { style: 'display:flex;gap:8px;align-items:center' }, preview, select));
}

function renderServices() {
  const host = $('serviceList');
  host.replaceChildren();
  const services = store.config.site.services || [];

  services.forEach((svc, index) => {
    const open = h('div', { style: 'display:none;padding:10px 2px 2px' });
    const setField = (key) => (value) => store.mutate('svc-' + key, (cfg) => {
      const target = cfg.site.services[index];
      if (target) target[key] = value;
    });

    open.append(
      field({ label: 'Tên gói', value: svc.name, onInput: setField('name') }),
      field({ label: 'Giá', value: svc.price, onInput: setField('price') }),
      field({ type: 'textarea', rows: 2, label: 'Mô tả', value: svc.description, onInput: setField('description') }),
      field({
        type: 'textarea', rows: 4, label: 'Bao gồm (mỗi dòng một mục)',
        value: (svc.includes || []).join('\n'),
        onInput: (v) => setField('includes')(v.split('\n').map(s => s.trim()).filter(Boolean))
      }),
      field({ type: 'checkbox', checkboxLabel: 'Đánh dấu “Phổ biến”', value: svc.featured, onInput: setField('featured') })
    );

    const item = h('div', { class: 'adm-item', style: 'flex-direction:column;align-items:stretch;cursor:default' },
      h('div', { style: 'display:flex;align-items:center;gap:9px' },
        h('div', { class: 'adm-item__body', style: 'cursor:pointer', onclick: () => { open.style.display = open.style.display === 'none' ? 'block' : 'none'; } },
          h('div', { class: 'adm-item__name' }, svc.name || '(chưa đặt tên)'),
          h('div', { class: 'adm-item__meta' }, svc.price || '—')),
        h('button', {
          class: 'adm-icon-btn adm-icon-btn--danger', title: 'Xoá gói',
          onclick: () => store.mutate('remove-svc', (cfg) => { cfg.site.services.splice(index, 1); })
        }, '✕')),
      open);

    host.append(item);
  });

  $('addService').onclick = () => store.mutate('add-svc', (cfg) => {
    cfg.site.services.push({ id: uid(), name: 'Gói mới', price: '0đ', description: '', includes: [], featured: false });
  });
}

// ================================================================ inspector

function renderInspector() {
  const host = $('inspector');
  const keepScroll = host.scrollTop;
  host.replaceChildren();
  // giữ vị trí cuộn để bảng thuộc tính không "nhảy" mỗi lần dựng lại
  requestAnimationFrame(() => { host.scrollTop = keepScroll; });

  const block = store.selectedBlock();
  const section = store.selectedSection();

  if (!block) {
    host.append(
      h('div', { class: 'adm-inspector__head' },
        h('div', {},
          h('div', { class: 'adm-inspector__title' }, section ? 'Khu vực đang chọn' : 'Chưa chọn gì'),
          h('div', { class: 'adm-inspector__type' }, section ? section.name : 'Bấm vào một khối trên canvas'))),
      h('p', { class: 'adm-hint' },
        section
          ? 'Thuộc tính khu vực nằm ở cột trái (tab “Bố cục”). Bấm vào một khối để chỉnh ảnh, chữ và hiệu ứng.'
          : 'Kéo ảnh từ tab “Ảnh” vào canvas, hoặc bấm ＋ để thêm khối.')
    );
    return;
  }

  const set = (key) => (value) => store.mutate('block-' + key, () => {
    const { block: target } = store.block(block.id);
    if (target) target[key] = value;
  });

  host.append(
    h('div', { class: 'adm-inspector__head' },
      h('div', {},
        h('div', { class: 'adm-inspector__title' }, 'Khối ' + (BLOCK_TYPES.find(t => t.id === block.type)?.label || block.type)),
        h('div', { class: 'adm-inspector__type' }, `#${block.id} · ${block.colSpan}/12 cột`)),
      h('button', { class: 'ui-btn ui-btn--icon', title: 'Cuộn tới khối', onclick: () => scrollToBlock(block.id) }, '⌖')),

    field({
      type: 'select', label: 'Loại khối', value: block.type, options: BLOCK_TYPES,
      // đổi loại khối -> bộ thuộc tính khác hẳn, phải dựng lại inspector
      onInput: (v) => { set('type')(v); renderInspector(); }
    }),
    field({ type: 'range', label: 'Độ rộng (cột)', value: block.colSpan, min: 1, max: 12, onInput: set('colSpan') })
  );

  if (block.type === 'image' || block.type === 'video') host.append(...mediaFields(block, set));
  if (block.type === 'text' || block.type === 'quote') host.append(...textFields(block, set));
  if (block.type === 'spacer') {
    host.append(field({
      type: 'range', label: 'Chiều cao', value: Math.round((block.aspectRatio || 1) * 60), min: 20, max: 240, unit: 'px',
      onInput: (v) => set('aspectRatio')(v / 60)
    }));
  }

  host.append(...animationFields(block, set));
}

function mediaFields(block, set) {
  const fields = [];

  if (block.type === 'image') {
    fields.push(
      h('div', { class: 'adm-group__title', style: 'margin-top:18px' }, 'Ảnh'),
      h('div', { style: 'display:flex;gap:8px;margin-bottom:10px' },
        h('button', {
          class: 'ui-btn', style: 'flex:1',
          onclick: () => {
            document.querySelector('.adm-tab[data-tab="media"]').click();
            toast('Bấm vào một ảnh trong thư viện để gán vào khối này.');
          }
        }, 'Chọn từ thư viện'),
        block.src
          ? h('button', { class: 'ui-btn', onclick: () => openCrop(block) }, '✂ Cắt')
          : null),
      field({ label: 'Đường dẫn ảnh', value: block.src || '', placeholder: '/media/....jpg', onInput: set('src') }),
      field({ label: 'Alt (mô tả cho SEO)', value: block.alt || '', onInput: set('alt') }),
      row(
        field({
          type: 'select', label: 'Tỉ lệ khung', value: String(block.aspectRatio),
          options: [
            { id: '0', label: 'Theo ảnh gốc' }, { id: '1', label: '1:1 vuông' }, { id: '0.8', label: '4:5 dọc' },
            { id: '0.6667', label: '2:3 dọc' }, { id: '1.5', label: '3:2 ngang' }, { id: '1.7778', label: '16:9' }, { id: '2.4', label: '2.4:1 phim' }
          ],
          onInput: (v) => set('aspectRatio')(Number(v))
        }),
        field({
          type: 'seg', label: 'Cách lấp khung', value: block.fit,
          options: [{ id: 'cover', label: 'Cover' }, { id: 'contain', label: 'Contain' }], onInput: set('fit')
        })
      )
    );

    if (block.src) {
      fields.push(focusPicker(block, set));
      if (block.crop) {
        fields.push(h('div', { class: 'f' },
          h('div', { class: 'f__label' }, 'Vùng cắt đang áp dụng',
            h('b', {}, `${Math.round(block.crop.w)}%×${Math.round(block.crop.h)}%`)),
          h('button', { class: 'ui-btn ui-btn--block', onclick: () => set('crop')(null) }, 'Bỏ cắt, dùng lại ảnh đầy đủ')));
      }
    }

    fields.push(
      field({ type: 'range', label: 'Bo góc riêng', value: block.radius ?? store.config.theme.radius, min: 0, max: 80, unit: 'px', onInput: set('radius') }),
      field({ label: 'Chú thích', value: block.caption || '', onInput: set('caption') }),
      field({
        type: 'seg', label: 'Kiểu chú thích', value: block.captionStyle,
        options: [{ id: 'below', label: 'Dưới' }, { id: 'overlay', label: 'Trên ảnh' }, { id: 'hover', label: 'Khi hover' }, { id: 'none', label: 'Ẩn' }],
        onInput: set('captionStyle')
      }),
      field({ label: 'Link khi bấm (tuỳ chọn)', value: block.link || '', onInput: set('link') })
    );
  } else {
    fields.push(
      h('div', { class: 'adm-group__title', style: 'margin-top:18px' }, 'Video'),
      field({ label: 'URL YouTube / Vimeo / mp4', value: block.src || '', onInput: set('src') }),
      field({
        type: 'select', label: 'Tỉ lệ', value: String(block.aspectRatio),
        options: [{ id: '1.7778', label: '16:9' }, { id: '1', label: '1:1' }, { id: '0.5625', label: '9:16 dọc' }],
        onInput: (v) => set('aspectRatio')(Number(v))
      })
    );
  }

  return fields;
}

/** Chọn điểm trọng tâm ảnh bằng cách bấm lên ảnh thu nhỏ. */
function focusPicker(block, set) {
  const dot = h('div', { class: 'adm-focus__dot', style: `left:${block.focusX}%;top:${block.focusY}%` });
  const area = h('div', { class: 'adm-focus' }, h('img', { src: block.src, alt: '' }), dot);

  const pick = (e) => {
    if (!area.isConnected) return;
    const rect = area.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    dot.style.left = x + '%';
    dot.style.top = y + '%';
    store.mutate('focus', () => {
      const { block: target } = store.block(block.id);
      if (target) { target.focusX = Math.min(Math.max(x, 0), 100); target.focusY = Math.min(Math.max(y, 0), 100); }
    });
  };
  area.addEventListener('pointerdown', (e) => {
    window.__pfInteracting = true;   // giữ inspector khỏi bị dựng lại giữa lúc kéo
    pick(e);
    const move = (ev) => pick(ev);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.__pfInteracting = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  return h('div', { class: 'f' },
    h('div', { class: 'f__label' }, 'Trọng tâm ảnh (khi bị cắt bởi khung)'),
    area,
    h('div', { class: 'adm-hint', style: 'margin-top:5px' }, 'Bấm/kéo lên ảnh để chọn phần luôn được giữ trong khung.'));
}

function textFields(block, set) {
  return [
    h('div', { class: 'adm-group__title', style: 'margin-top:18px' }, 'Nội dung'),
    h('p', { class: 'adm-hint', style: 'margin-top:-4px' }, 'Mẹo: nháy đúp trực tiếp lên chữ trong canvas để sửa nhanh.'),
    field({ label: block.type === 'quote' ? 'Tên người nói' : 'Tiêu đề', value: block.title || '', onInput: set('title') }),
    field({ type: 'textarea', rows: 5, label: block.type === 'quote' ? 'Câu trích' : 'Nội dung', value: block.body || '', onInput: set('body') }),
    row(
      field({ type: 'range', label: 'Cỡ tiêu đề', value: block.titleSize, min: 12, max: 96, unit: 'px', onInput: set('titleSize') }),
      field({ type: 'range', label: 'Cỡ nội dung', value: block.bodySize, min: 11, max: 32, unit: 'px', onInput: set('bodySize') })
    ),
    field({
      type: 'seg', label: 'Canh lề', value: block.align,
      options: [{ id: 'left', label: 'Trái' }, { id: 'center', label: 'Giữa' }, { id: 'right', label: 'Phải' }],
      onInput: set('align')
    }),
    field({ type: 'color', label: 'Màu chữ riêng (để trống = theo tone)', value: block.color || store.config.theme.text, onInput: set('color') })
  ];
}

function animationFields(block, set) {
  const grid = h('div', { class: 'adm-anim-grid' },
    ...ANIMATIONS.map(anim =>
      h('button', {
        class: 'adm-anim' + (block.animation === anim.id ? ' is-on' : ''),
        onclick: () => set('animation')(anim.id)
      }, anim.label)));

  return [
    h('div', { class: 'adm-group__title', style: 'margin-top:20px' }, 'Hiệu ứng khi cuộn tới'),
    grid,
    h('div', { style: 'height:10px' }),
    row(
      field({ type: 'range', label: 'Trễ', value: block.delay, min: 0, max: 1500, step: 50, unit: 'ms', onInput: set('delay') }),
      field({ type: 'range', label: 'Thời lượng', value: block.duration, min: 200, max: 2500, step: 50, unit: 'ms', onInput: set('duration') })
    ),
    field({ type: 'select', label: 'Hiệu ứng khi trỏ vào', value: block.hover, options: HOVERS, onInput: set('hover') }),
    field({
      type: 'range', label: 'Parallax khi cuộn', value: block.parallax, min: -1, max: 1, step: 0.1,
      onInput: set('parallax'),
      hint: 'Số dương: khối trôi chậm hơn trang. Số âm: trôi nhanh hơn.'
    }),
    h('button', { class: 'ui-btn ui-btn--block', onclick: () => $('replayBtn').click() }, '▷ Chạy lại hiệu ứng trên canvas')
  ];
}

function openCrop(block) {
  openCropModal(block, {
    onApply: (rect) => store.mutate('crop', () => {
      const { block: target } = store.block(block.id);
      if (target) target.crop = rect;
    }),
    onExport: (item) => {
      mediaItems.unshift(item);
      renderMediaGrid();
      store.mutate('crop-export', () => {
        const { block: target } = store.block(block.id);
        if (target) { target.src = item.url; target.crop = null; }
      });
    }
  });
}

// ================================================================ preview

function wirePreview() {
  $('previewBtn').addEventListener('click', () => togglePreview(true));
  $('previewClose').addEventListener('click', () => togglePreview(false));
  $('previewSave').addEventListener('click', save);

  $('previewSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-device]');
    if (!btn) return;
    $('previewFrame').dataset.device = btn.dataset.device;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === btn));
  });

  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'pf:preview-ready') { previewReady = true; pushPreview(); }
  });
}

function togglePreview(open) {
  const panel = $('preview');
  panel.hidden = !open;
  if (open) {
    const frame = $('previewFrame');
    if (!previewReady) frame.src = '/preview.html';
    else pushPreview();
  }
}

function pushPreview() {
  const frame = $('previewFrame');
  frame.contentWindow?.postMessage({ type: 'pf:render', config: store.config }, location.origin);
}

// ================================================================ lịch sử & dữ liệu

async function loadHistory() {
  const host = $('historyList');
  host.replaceChildren(h('div', { class: 'adm-empty' }, 'Đang tải…'));
  try {
    const items = await api.history();
    host.replaceChildren();
    if (!items.length) {
      host.append(h('div', { class: 'adm-empty' }, 'Chưa có bản lưu nào.'));
      return;
    }
    for (const item of items) {
      host.append(h('div', { class: 'adm-item' },
        h('div', { class: 'adm-item__body' },
          h('div', { class: 'adm-item__name' }, new Date(item.savedAt).toLocaleString('vi-VN')),
          h('div', { class: 'adm-item__meta' }, Math.round(item.size / 1024) + ' KB')),
        h('button', {
          class: 'ui-btn ui-btn--sm',
          onclick: async () => {
            if (!confirmAction('Phục hồi bản lưu này? Bản hiện tại sẽ được giữ trong lịch sử.')) return;
            try {
              const restored = await api.restore(item.file);
              store.init(restored);
              renderAll();
              toast('Đã phục hồi.', 'ok');
              loadHistory();
            } catch (err) { toast(err.message, 'err'); }
          }
        }, 'Phục hồi')));
    }
  } catch (err) {
    host.replaceChildren(h('div', { class: 'adm-empty' }, err.message));
  }
}

function wireDataPane() {
  $('reloadHistory').addEventListener('click', loadHistory);

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'site.json' });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $('importBtn').addEventListener('click', () => $('importInput').click());
  $('importInput').addEventListener('change', async () => {
    const file = $('importInput').files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.sections || !parsed.theme) throw new Error('File không đúng định dạng site.json.');
      if (!confirmAction('Thay toàn bộ nội dung hiện tại bằng file này? (chưa lưu lên server)')) return;
      store.init(parsed);
      store.dirty = true;
      renderAll();
      toast('Đã nhập. Bấm “Lưu & áp dụng” để đưa lên trang thật.', 'ok');
    } catch (err) {
      toast(err.message, 'err', 6000);
    } finally {
      $('importInput').value = '';
    }
  });
}
