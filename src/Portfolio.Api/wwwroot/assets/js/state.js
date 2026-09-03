/* ==========================================================================
   state.js — nguồn sự thật duy nhất của trang admin.
   Mọi thay đổi đi qua store.mutate() -> tự đẩy vào undo stack, đánh dấu "chưa
   lưu", lưu bản nháp vào localStorage và thông báo cho các view.
   ========================================================================== */

const DRAFT_KEY = 'pf_admin_draft_v1';
const LIMIT = 80;

const clone = (value) => structuredClone(value);
export const uid = () => Math.random().toString(36).slice(2, 10);

export const store = {
  config: null,
  media: [],
  selection: { sectionId: null, blockId: null },
  dirty: false,

  _undo: [],
  _redo: [],
  _listeners: new Set(),
  _lastLabel: null,
  _lastStamp: 0,

  init(config) {
    this.config = config;
    this._undo = [];
    this._redo = [];
    this.dirty = false;
    this.emit('init');
  },

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },

  emit(reason) {
    for (const fn of this._listeners) fn(reason, this);
  },

  /**
   * Thực hiện một thay đổi có thể undo.
   * `label` giống nhau trong vòng 600ms sẽ được gộp (ví dụ kéo slider liên tục).
   */
  mutate(label, fn) {
    const now = Date.now();
    const merge = label && label === this._lastLabel && now - this._lastStamp < 600;
    if (!merge) {
      this._undo.push(clone(this.config));
      if (this._undo.length > LIMIT) this._undo.shift();
      this._redo.length = 0;
    }
    this._lastLabel = label;
    this._lastStamp = now;

    fn(this.config);
    this.dirty = true;
    this.saveDraft();
    this.emit('mutate:' + label);
  },

  canUndo() { return this._undo.length > 0; },
  canRedo() { return this._redo.length > 0; },

  undo() {
    if (!this._undo.length) return false;
    this._redo.push(clone(this.config));
    this.config = this._undo.pop();
    this.dirty = true;
    this._lastLabel = null;
    this.saveDraft();
    this.emit('undo');
    return true;
  },

  redo() {
    if (!this._redo.length) return false;
    this._undo.push(clone(this.config));
    this.config = this._redo.pop();
    this.dirty = true;
    this._lastLabel = null;
    this.saveDraft();
    this.emit('redo');
    return true;
  },

  markSaved(saved) {
    if (saved) this.config = saved;
    this.dirty = false;
    this.clearDraft();
    this.emit('saved');
  },

  select(sectionId, blockId = null) {
    this.selection = { sectionId, blockId };
    this.emit('select');
  },

  // ---------------------------------------------------------------- truy vấn

  section(id) { return this.config?.sections.find(s => s.id === id) || null; },

  block(id) {
    for (const section of this.config?.sections || []) {
      const found = section.blocks.find(b => b.id === id);
      if (found) return { block: found, section };
    }
    return { block: null, section: null };
  },

  selectedBlock() { return this.block(this.selection.blockId).block; },
  selectedSection() { return this.section(this.selection.sectionId); },

  // ---------------------------------------------------------------- bản nháp

  saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), config: this.config }));
    } catch { /* hết quota -> bỏ qua, dữ liệu thật vẫn nằm ở server */ }
  },

  loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ }
  }
};

// ---------------------------------------------------------------- factory

export function newBlock(type = 'image', patch = {}) {
  const base = {
    id: uid(),
    type,
    colSpan: type === 'text' || type === 'quote' ? 6 : 4,
    aspectRatio: type === 'video' ? 1.777 : 1,
    fit: 'cover',
    focusX: 50,
    focusY: 50,
    radius: null,
    src: null,
    alt: '',
    crop: null,
    title: type === 'text' ? 'Tiêu đề mới' : (type === 'quote' ? 'Tên khách hàng' : null),
    body: type === 'text' ? 'Nội dung mô tả cho khối chữ này.' :
          (type === 'quote' ? 'Ảnh của bạn làm mình rơi nước mắt.' : null),
    align: 'left',
    titleSize: 32,
    bodySize: 16,
    color: null,
    caption: '',
    captionStyle: 'below',
    animation: 'fade-up',
    delay: 0,
    duration: 800,
    hover: 'zoom',
    parallax: 0,
    link: null
  };
  return { ...base, ...patch };
}

export function newSection(patch = {}) {
  return {
    id: uid(),
    name: 'Bộ ảnh mới',
    heading: 'Tiêu đề bộ ảnh',
    subheading: '',
    layout: 'grid',
    columns: 12,
    gap: 16,
    background: 'transparent',
    visible: true,
    blocks: [],
    ...patch
  };
}
