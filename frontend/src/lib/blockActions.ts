/**
 * Các thao tác sửa cấu trúc nội dung (thêm/xoá/di chuyển khối, gán ảnh…).
 * Tách khỏi component để file Canvas chỉ export component (Fast Refresh hoạt động đúng).
 */

import type { Block } from '../types';
import { editor } from './editorStore';
import { newBlock, uid } from './factory';
import { toast } from '../components/admin/Toasts';

/** Kiểu dữ liệu dùng trong drag & drop giữa thư viện ảnh và canvas. */
export const MIME_MEDIA = 'application/x-pf-media';
export const MIME_BLOCK = 'application/x-pf-block';

export function addBlock(sectionId: string, type: Block['type'] = 'image', patch: Partial<Block> = {}) {
  const block = newBlock(type, patch);
  editor.mutate('add-block', (draft) => {
    const section = draft.sections.find((s) => s.id === sectionId) ?? draft.sections[0];
    section?.blocks.push(block);
  });
  editor.select(sectionId, block.id);
  return block;
}

export function assignImage(blockId: string, url: string) {
  editor.mutate('assign-image', (draft) => {
    const block = editor.findBlock(draft, blockId);
    if (!block) return;
    block.type = 'image';
    block.src = url;
    block.crop = null;
  });
}

export function duplicateBlock(sectionId: string, blockId: string) {
  editor.mutate('duplicate-block', (draft) => {
    const section = draft.sections.find((s) => s.id === sectionId);
    const index = section?.blocks.findIndex((b) => b.id === blockId) ?? -1;
    if (!section || index < 0) return;
    const copy = structuredClone(section.blocks[index]);
    copy.id = uid();
    section.blocks.splice(index + 1, 0, copy);
  });
}

export function removeBlock(sectionId: string, blockId: string) {
  editor.mutate('remove-block', (draft) => {
    const section = draft.sections.find((s) => s.id === sectionId);
    if (section) section.blocks = section.blocks.filter((b) => b.id !== blockId);
  });
  if (editor.state.selection.blockId === blockId) editor.select(sectionId, null);
  toast('Đã xoá khối — Ctrl+Z để hoàn tác.');
}

export function moveBlock(blockId: string, toSectionId: string, anchorId: string | null, where: 'before' | 'after' | 'append') {
  editor.mutate('move-block', (draft) => {
    let moved: Block | null = null;
    for (const section of draft.sections) {
      const index = section.blocks.findIndex((b) => b.id === blockId);
      if (index >= 0) {
        moved = section.blocks.splice(index, 1)[0];
        break;
      }
    }
    if (!moved) return;

    const target = draft.sections.find((s) => s.id === toSectionId);
    if (!target) return;
    if (!anchorId || where === 'append') {
      target.blocks.push(moved);
      return;
    }
    const anchor = target.blocks.findIndex((b) => b.id === anchorId);
    target.blocks.splice(anchor < 0 ? target.blocks.length : anchor + (where === 'after' ? 1 : 0), 0, moved);
  });
}

export function toggleSection(sectionId: string) {
  editor.mutate('toggle-section', (draft) => {
    const section = draft.sections.find((s) => s.id === sectionId);
    if (section) section.visible = !section.visible;
  });
}
