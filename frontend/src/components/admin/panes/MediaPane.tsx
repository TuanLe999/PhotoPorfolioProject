/** Tab "Ảnh": upload, thư viện, chọn nhiều ảnh để ghép, kéo thả sang canvas. */

import { useRef, useState } from 'react';
import type { MediaItem } from '../../../types';
import { api, assetUrl } from '../../../api/client';
import { editor, useEditor } from '../../../lib/editorStore';
import { GroupTitle } from '../Field';
import { addBlock, assignImage, MIME_MEDIA } from '../../../lib/blockActions';
import { toast } from '../Toasts';

export function MediaPane({
  picked,
  setPicked,
  onCollage,
  uploadFiles,
  progress,
}: {
  picked: string[];
  setPicked: (update: (urls: string[]) => string[]) => void;
  onCollage: () => void;
  uploadFiles: (files: File[]) => Promise<MediaItem[]>;
  progress: number | null;
}) {
  const { media, selection } = useEditor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const removeItem = async (item: MediaItem) => {
    if (!window.confirm('Xoá ảnh này khỏi thư viện? Các khối đang dùng ảnh sẽ mất hình.')) return;
    try {
      await api.deleteMedia(item.id);
      editor.setMedia(editor.state.media.filter((m) => m.id !== item.id));
      setPicked((current) => current.filter((url) => url !== item.url));
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  const onThumbClick = (item: MediaItem, multi: boolean) => {
    if (multi) {
      setPicked((current) => (current.includes(item.url) ? current.filter((url) => url !== item.url) : [...current, item.url]));
      return;
    }
    if (selection.blockId) {
      assignImage(selection.blockId, item.url);
      document
        .querySelector(`.adm-canvas .pf-block[data-block-id="${selection.blockId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (selection.sectionId) {
      addBlock(selection.sectionId, 'image', { src: item.url });
    } else {
      toast('Chọn một khối hoặc khu vực trước, hoặc kéo ảnh thả vào canvas.', 'err');
    }
  };

  return (
    <>
      <div className="adm-group">
        <div
          className={'adm-drop' + (over ? ' is-over' : '')}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
            if (files.length) void uploadFiles(files);
          }}
        >
          <b>Kéo ảnh vào đây</b>
          <small>hoặc bấm để chọn — JPG, PNG, WebP, AVIF, GIF (≤25MB)</small>
        </div>
        <div className={'adm-progress' + (progress != null ? ' is-on' : '')}>
          <i style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void uploadFiles(files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="adm-group">
        <GroupTitle
          action={
            <button className="ui-btn ui-btn--icon" title="Ghép ảnh đã chọn" onClick={onCollage}>
              ⊞
            </button>
          }
        >
          Thư viện ({media.length})
        </GroupTitle>
        <p className="adm-hint">
          Kéo ảnh từ đây thả vào khối trên canvas. Giữ <span className="adm-kbd">Ctrl</span> + bấm để chọn nhiều ảnh rồi ghép.
        </p>

        <div className="adm-media">
          {!media.length && (
            <div className="adm-empty" style={{ gridColumn: '1/-1' }}>
              Chưa có ảnh nào.
            </div>
          )}
          {media.map((item) => (
            <div
              key={item.id}
              className={'adm-thumb' + (picked.includes(item.url) ? ' is-picked' : '')}
              title={`${item.fileName}\n${item.width}×${item.height} · ${Math.round(item.size / 1024)}KB`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(MIME_MEDIA, item.url);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={(e) => onThumbClick(item, e.ctrlKey || e.metaKey)}
            >
              <img src={assetUrl(item.url)} alt="" loading="lazy" />
              <button
                className="adm-thumb__x"
                title="Xoá khỏi thư viện"
                onClick={(e) => {
                  e.stopPropagation();
                  void removeItem(item);
                }}
              >
                ✕
              </button>
              {picked.includes(item.url) && <span className="adm-thumb__pick">đã chọn</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
