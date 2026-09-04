/** Tab "Lịch sử": phục hồi bản lưu cũ, xuất/nhập site.json. */

import { useEffect, useRef, useState } from 'react';
import type { HistoryEntry, SiteConfig } from '../../../types';
import { api } from '../../../api/client';
import { editor, useEditor } from '../../../lib/editorStore';
import { GroupTitle } from '../Field';
import { toast } from '../Toasts';

export function HistoryPane({ reloadToken }: { reloadToken: number }) {
  const { config } = useEditor();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(null);
    api
      .history()
      .then((data) => alive && setItems(data))
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  const restore = async (entry: HistoryEntry) => {
    if (!window.confirm('Phục hồi bản lưu này? Bản hiện tại sẽ được giữ trong lịch sử.')) return;
    try {
      const restored = await api.restore(entry.file);
      editor.init(restored);
      toast('Đã phục hồi.', 'ok');
      setItems(await api.history());
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  const exportJson = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site.json';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as SiteConfig;
      if (!parsed.sections || !parsed.theme) throw new Error('File không đúng định dạng site.json.');
      if (!window.confirm('Thay toàn bộ nội dung hiện tại bằng file này? (chưa lưu lên server)')) return;
      editor.init(parsed, editor.state.media, true);
      toast('Đã nhập. Bấm “Lưu & áp dụng” để đưa lên trang thật.', 'ok');
    } catch (err) {
      toast((err as Error).message, 'err', 6000);
    }
  };

  return (
    <>
      <div className="adm-group">
        <GroupTitle>Bản lưu trước</GroupTitle>
        <p className="adm-hint">Mỗi lần bấm “Lưu &amp; áp dụng”, bản cũ được giữ lại (30 bản gần nhất).</p>
        <div className="adm-list">
          {items === null && !error && <div className="adm-empty">Đang tải…</div>}
          {error && <div className="adm-empty">{error}</div>}
          {items?.length === 0 && <div className="adm-empty">Chưa có bản lưu nào.</div>}
          {items?.map((entry) => (
            <div className="adm-item" key={entry.file}>
              <div className="adm-item__body">
                <div className="adm-item__name">{new Date(entry.savedAt).toLocaleString('vi-VN')}</div>
                <div className="adm-item__meta">{Math.round(entry.size / 1024)} KB</div>
              </div>
              <button className="ui-btn ui-btn--sm" onClick={() => void restore(entry)}>
                Phục hồi
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-group">
        <GroupTitle>Dữ liệu</GroupTitle>
        <button className="ui-btn ui-btn--block" onClick={exportJson}>
          Xuất site.json
        </button>
        <div style={{ height: 8 }} />
        <button className="ui-btn ui-btn--block" onClick={() => importRef.current?.click()}>
          Nhập từ file JSON
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importJson(file);
            e.target.value = '';
          }}
        />
      </div>
    </>
  );
}
