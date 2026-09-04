/**
 * Store của trang admin: nguồn sự thật duy nhất cho config đang chỉnh, thư viện ảnh,
 * lựa chọn hiện tại và lịch sử undo/redo. Dùng useSyncExternalStore nên component nào
 * đọc state đó mới render lại.
 */

import { useSyncExternalStore } from 'react';
import type { MediaItem, SiteConfig } from '../types';

const DRAFT_KEY = 'pf_admin_draft_v2';
const HISTORY_LIMIT = 80;
const MERGE_WINDOW_MS = 600;

export interface Selection {
  sectionId: string | null;
  blockId: string | null;
}

export interface EditorState {
  config: SiteConfig | null;
  media: MediaItem[];
  selection: Selection;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const emptyState: EditorState = {
  config: null,
  media: [],
  selection: { sectionId: null, blockId: null },
  dirty: false,
  canUndo: false,
  canRedo: false,
};

let state: EditorState = emptyState;
let undoStack: SiteConfig[] = [];
let redoStack: SiteConfig[] = [];
let lastLabel: string | null = null;
let lastStamp = 0;

const listeners = new Set<() => void>();

function setState(patch: Partial<EditorState>) {
  state = { ...state, ...patch, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useEditor(): EditorState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const editor = {
  get state() {
    return state;
  },

  init(config: SiteConfig, media: MediaItem[] = state.media, dirty = false) {
    undoStack = [];
    redoStack = [];
    lastLabel = null;
    setState({ config, media, dirty, selection: { sectionId: null, blockId: null } });
  },

  setMedia(media: MediaItem[]) {
    setState({ media });
  },

  /**
   * Thay đổi có thể hoàn tác. Cùng `label` trong 600ms sẽ gộp thành một bước undo
   * (ví dụ kéo slider liên tục), tránh phải Ctrl+Z hàng chục lần.
   */
  mutate(label: string, recipe: (draft: SiteConfig) => void) {
    if (!state.config) return;

    const now = Date.now();
    const merge = label === lastLabel && now - lastStamp < MERGE_WINDOW_MS;
    if (!merge) {
      undoStack.push(state.config);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack = [];
    }
    lastLabel = label;
    lastStamp = now;

    const next = structuredClone(state.config);
    recipe(next);
    setState({ config: next, dirty: true });
    saveDraft(next);
  },

  undo() {
    const previous = undoStack.pop();
    if (!previous || !state.config) return;
    redoStack.push(state.config);
    lastLabel = null;
    setState({ config: previous, dirty: true });
    saveDraft(previous);
  },

  redo() {
    const next = redoStack.pop();
    if (!next || !state.config) return;
    undoStack.push(state.config);
    lastLabel = null;
    setState({ config: next, dirty: true });
    saveDraft(next);
  },

  markSaved(saved: SiteConfig) {
    clearDraft();
    setState({ config: saved, dirty: false });
  },

  select(sectionId: string | null, blockId: string | null = null) {
    setState({ selection: { sectionId, blockId } });
  },

  section(id: string | null) {
    if (!id) return null;
    return state.config?.sections.find((s) => s.id === id) ?? null;
  },

  block(id: string | null) {
    if (!id) return null;
    for (const section of state.config?.sections ?? []) {
      const found = section.blocks.find((b) => b.id === id);
      if (found) return found;
    }
    return null;
  },

  /** Tìm block trong một bản draft đang được mutate. */
  findBlock(draft: SiteConfig, id: string) {
    for (const section of draft.sections) {
      const found = section.blocks.find((b) => b.id === id);
      if (found) return found;
    }
    return null;
  },
};

// ---------------------------------------------------------------- bản nháp

interface Draft {
  at: number;
  config: SiteConfig;
}

function saveDraft(config: SiteConfig) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), config } satisfies Draft));
  } catch {
    // hết quota -> bỏ qua, dữ liệu thật vẫn nằm trên server
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // bỏ qua
  }
}
