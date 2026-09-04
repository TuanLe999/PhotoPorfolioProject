/**
 * Vùng dựng trang của admin: hiển thị bằng đúng component render của trang thật,
 * phủ thêm chrome chỉnh sửa (chọn, kéo đổi vị trí, kéo cạnh đổi độ rộng, thả ảnh,
 * nháy đúp sửa chữ tại chỗ).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Block, DeviceName, Section, SiteConfig } from '../../types';
import { SectionView } from '../render/SectionView';
import { BlockView } from '../render/BlockView';
import { editor, useEditor } from '../../lib/editorStore';
import {
  addBlock,
  assignImage,
  duplicateBlock,
  moveBlock,
  removeBlock,
  toggleSection,
  MIME_BLOCK,
  MIME_MEDIA,
} from '../../lib/blockActions';
import { applyTheme } from '../../lib/theme';




interface DropHint {
  blockId: string | null;
  sectionId: string;
  where: 'before' | 'after' | 'into' | 'append';
}

export interface CanvasProps {
  device: DeviceName;
  onCropRequest: (block: Block) => void;
  onUploadFiles: (files: File[], target: { sectionId: string; blockId?: string; mode: 'assign' | 'append' }) => void;
  replayToken: number;
}

export function Canvas({ device, onCropRequest, onUploadFiles, replayToken }: CanvasProps) {
  const { config, selection } = useEditor();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [resizing, setResizing] = useState<{ blockId: string; span: number } | null>(null);

  // tone màu của khách chỉ áp dụng bên trong canvas, không đụng tới giao diện admin
  useEffect(() => {
    if (config) applyTheme(config.theme, canvasRef.current);
  }, [config]);

  // cho hiệu ứng chạy một lượt để admin thấy ngay kết quả
  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>('[data-anim]');
    nodes.forEach((node) => node.classList.remove('is-in'));
    void root.offsetHeight; // ép reflow để transition chạy lại từ đầu
    const raf = requestAnimationFrame(() => nodes.forEach((node) => node.classList.add('is-in')));
    return () => cancelAnimationFrame(raf);
  }, [config, replayToken]);

  useInlineTextEditing(canvasRef, config);

  const startResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, block: Block, section: Section) => {
      e.preventDefault();
      e.stopPropagation();
      const blockNode = (e.currentTarget as HTMLElement).closest('.pf-block') as HTMLElement | null;
      const wrap = blockNode?.closest('.pf-blocks') as HTMLElement | null;
      if (!wrap) return;

      const cols = Math.min(Math.max(section.columns || 12, 1), 12);
      const gap = section.gap ?? 16;
      const colWidth = (wrap.clientWidth - gap * (cols - 1)) / cols;
      const startX = e.clientX;
      const startSpan = block.colSpan;
      let span = startSpan;

      const move = (ev: PointerEvent) => {
        const delta = Math.round((ev.clientX - startX) / (colWidth + gap));
        const next = Math.min(Math.max(startSpan + delta, 1), cols);
        if (next === span) return;
        span = next;
        setResizing({ blockId: block.id, span });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setResizing(null);
        if (span !== startSpan) {
          editor.mutate('resize', (draft) => {
            const target = editor.findBlock(draft, block.id);
            if (target) target.colSpan = span;
          });
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [],
  );

  if (!config) return null;

  return (
    <div className="adm-canvas-scroll" id="canvasScroll">
      <div className="adm-canvas" ref={canvasRef} data-device={device}>
        {!config.sections.length && (
          <div className="adm-empty" style={{ padding: '80px 20px' }}>
            Chưa có khu vực nào. Bấm ＋ ở cột “Bố cục” để thêm.
          </div>
        )}

        {config.sections.map((section) => (
          <SectionView
            key={section.id}
            section={section}
            editable
            className={
              (!section.visible ? 'is-hidden-section' : '') +
              (dropHint?.sectionId === section.id && dropHint.where === 'append' ? ' is-target-section' : '')
            }
            toolbar={<SectionToolbar section={section} />}
            footer={
              <AddZone
                section={section}
                over={dropHint?.sectionId === section.id && dropHint.where === 'append'}
                onDragOver={(e) => handleDragOver(e, section.id, null, 'append', setDropHint)}
                onDragLeave={() => setDropHint(null)}
                onDrop={(e) => handleDrop(e, section.id, null, 'append', setDropHint, onUploadFiles)}
              />
            }
            renderBlock={(block) => {
              const isSelected = selection.blockId === block.id;
              const shown =
                resizing?.blockId === block.id ? { ...block, colSpan: resizing.span } : block;
              const hint = dropHint?.blockId === block.id ? dropHint.where : null;

              return (
                <BlockView
                  key={block.id}
                  block={shown}
                  editable
                  selected={isSelected}
                  extraClass={
                    hint === 'before'
                      ? 'is-drop-before'
                      : hint === 'after'
                        ? 'is-drop-after'
                        : hint === 'into'
                          ? 'is-drop-into'
                          : undefined
                  }
                  handlers={{
                    onClick: (e) => {
                      e.stopPropagation();
                      editor.select(section.id, block.id);
                    },
                    onDragOver: (e) => handleDragOver(e, section.id, block.id, dropTargetFor(e, block), setDropHint),
                    onDragLeave: () => setDropHint(null),
                    onDrop: (e) => handleDrop(e, section.id, block.id, dropTargetFor(e, block), setDropHint, onUploadFiles),
                  }}
                  overlay={
                    <>
                      <BlockChrome block={block} section={section} onCropRequest={onCropRequest} span={shown.colSpan} />
                      <div className="adm-resize" onPointerDown={(e) => startResize(e, block, section)} />
                    </>
                  }
                />
              );
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Thả ảnh vào giữa một khối ảnh thì gán ảnh cho khối đó, thả ở mép thì chèn trước/sau. */
function dropTargetFor(e: ReactDragEvent, block: Block): DropHint['where'] {
  const kind = payloadKind(e);
  if (kind !== 'block' && block.type === 'image') return 'into';
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}

function payloadKind(e: ReactDragEvent): 'block' | 'media' | 'files' | null {
  const types = Array.from(e.dataTransfer.types);
  if (types.includes(MIME_BLOCK)) return 'block';
  if (types.includes(MIME_MEDIA)) return 'media';
  if (types.includes('Files')) return 'files';
  return null;
}

function handleDragOver(
  e: ReactDragEvent,
  sectionId: string,
  blockId: string | null,
  where: DropHint['where'],
  setHint: (hint: DropHint | null) => void,
) {
  const kind = payloadKind(e);
  if (!kind) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = kind === 'block' ? 'move' : 'copy';
  setHint({ sectionId, blockId, where });
}

function handleDrop(
  e: ReactDragEvent,
  sectionId: string,
  blockId: string | null,
  where: DropHint['where'],
  setHint: (hint: DropHint | null) => void,
  onUploadFiles: CanvasProps['onUploadFiles'],
) {
  const kind = payloadKind(e);
  if (!kind) return;
  e.preventDefault();
  e.stopPropagation();
  setHint(null);

  // 1) kéo file ảnh trực tiếp từ máy
  if (kind === 'files') {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    onUploadFiles(files, {
      sectionId,
      blockId: blockId ?? undefined,
      mode: where === 'into' && blockId ? 'assign' : 'append',
    });
    return;
  }

  // 2) kéo ảnh từ thư viện
  if (kind === 'media') {
    const url = e.dataTransfer.getData(MIME_MEDIA);
    if (!url) return;
    if (where === 'into' && blockId) assignImage(blockId, url);
    else addBlock(sectionId, 'image', { src: url });
    return;
  }

  // 3) kéo khối để đổi vị trí
  const dragId = e.dataTransfer.getData(MIME_BLOCK);
  if (!dragId || dragId === blockId) return;
  moveBlock(dragId, sectionId, blockId, where === 'before' ? 'before' : where === 'after' ? 'after' : 'append');
}

function SectionToolbar({ section }: { section: Section }) {
  return (
    <div className="adm-section-tools" onClick={() => editor.select(section.id, null)}>
      <b>{section.name || 'Khu vực'}</b>
      <span>
        · {section.layout} · {section.blocks.length} khối
      </span>
      <div className="spacer" />
      <button
        className="adm-icon-btn"
        title="Ẩn/hiện khu vực"
        onClick={(e) => {
          e.stopPropagation();
          toggleSection(section.id);
        }}
      >
        {section.visible ? '👁' : '🚫'}
      </button>
    </div>
  );
}

function AddZone({
  section,
  over,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  section: Section;
  over: boolean;
  onDragOver: (e: ReactDragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: ReactDragEvent) => void;
}) {
  return (
    <div
      className={'adm-addzone' + (over ? ' is-over' : '')}
      onClick={() => addBlock(section.id, 'image')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      ＋ Thêm khối ảnh — hoặc kéo ảnh từ thư viện thả vào đây
    </div>
  );
}

function BlockChrome({
  block,
  section,
  span,
  onCropRequest,
}: {
  block: Block;
  section: Section;
  span: number;
  onCropRequest: (block: Block) => void;
}) {
  return (
    <div className="adm-chrome">
      <button
        className="adm-chrome__grip"
        title="Kéo để đổi vị trí"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(MIME_BLOCK, block.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        ⠿
      </button>
      <span className="adm-chrome__span">{span}/12</span>
      {block.type === 'image' && block.src && (
        <button
          title="Cắt ảnh"
          onClick={(e) => {
            e.stopPropagation();
            onCropRequest(block);
          }}
        >
          ✂
        </button>
      )}
      <button
        title="Nhân bản"
        onClick={(e) => {
          e.stopPropagation();
          duplicateBlock(section.id, block.id);
        }}
      >
        ⧉
      </button>
      <button
        title="Xoá khối"
        onClick={(e) => {
          e.stopPropagation();
          removeBlock(section.id, block.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}

/** Nháy đúp vào chữ trên canvas để sửa tại chỗ. */
function useInlineTextEditing(canvasRef: React.RefObject<HTMLDivElement | null>, config: SiteConfig | null) {
  useEffect(() => {
    const root = canvasRef.current;
    if (!root || !config) return;

    const onDblClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        '.pf-text__title, .pf-text__body, .pf-quote__body, .pf-quote__by, .pf-caption',
      );
      if (!target) return;
      const blockNode = target.closest<HTMLElement>('.pf-block');
      const blockId = blockNode?.dataset.blockId;
      if (!blockId) return;

      const field: 'title' | 'body' | 'caption' = target.classList.contains('pf-text__title')
        ? 'title'
        : target.classList.contains('pf-quote__by')
          ? 'title'
          : target.classList.contains('pf-caption')
            ? 'caption'
            : 'body';

      target.contentEditable = 'true';
      target.style.outline = '2px solid var(--ui-brand)';
      target.style.outlineOffset = '2px';
      target.focus();
      document.getSelection()?.selectAllChildren(target);

      const commit = () => {
        const text = target.textContent?.trim() ?? '';
        target.contentEditable = 'false';
        target.style.outline = '';
        editor.mutate('inline-text', (draft) => {
          const block = editor.findBlock(draft, blockId);
          if (block) block[field] = text;
        });
      };

      target.addEventListener('blur', commit, { once: true });
      target.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          target.blur();
        }
        if (ev.key === 'Enter' && !ev.shiftKey && field !== 'body') {
          ev.preventDefault();
          target.blur();
        }
      });
    };

    root.addEventListener('dblclick', onDblClick);
    return () => root.removeEventListener('dblclick', onDblClick);
  }, [canvasRef, config]);
}

