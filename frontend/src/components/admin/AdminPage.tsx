/** Trang quản trị: đăng nhập → tải config → sidebar/canvas/inspector → preview → lưu. */

import { useCallback, useEffect, useState } from 'react';
import type { Block, DeviceName, MediaItem, SiteConfig } from '../../types';
import { api, ApiError } from '../../api/client';
import { clearDraft, editor, loadDraft, useEditor } from '../../lib/editorStore';
import { Canvas } from './Canvas';
import { addBlock, assignImage, removeBlock } from '../../lib/blockActions';
import { Inspector } from './Inspector';
import { ContentPane } from './panes/ContentPane';
import { MediaPane } from './panes/MediaPane';
import { ThemePane } from './panes/ThemePane';
import { SitePane } from './panes/SitePane';
import { HistoryPane } from './panes/HistoryPane';
import { CropModal } from './CropModal';
import { CollageModal } from './CollageModal';
import { PreviewOverlay } from './PreviewOverlay';
import { LoginGate } from './LoginGate';
import { toast, Toasts } from './Toasts';
import '../../styles/admin.css';

type TabId = 'content' | 'media' | 'theme' | 'site' | 'history';

const TABS: { id: TabId; label: string }[] = [
  { id: 'content', label: 'Bố cục' },
  { id: 'media', label: 'Ảnh' },
  { id: 'theme', label: 'Tone màu' },
  { id: 'site', label: 'Trang' },
  { id: 'history', label: 'Lịch sử' },
];

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [defaultPassword, setDefaultPassword] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setAuthed(me.authenticated);
        setDefaultPassword(me.usingDefaultPassword);
      })
      .catch((err: ApiError) => {
        setAuthed(false);
        toast(err.message, 'err', 8000);
      });
  }, []);

  if (authed === null) {
    return (
      <div className="adm-login">
        <div className="adm-login__box">Đang kiểm tra phiên đăng nhập…</div>
        <Toasts />
      </div>
    );
  }

  if (!authed) {
    return (
      <>
        <LoginGate
          usingDefaultPassword={defaultPassword}
          onLoggedIn={(usingDefault) => {
            setDefaultPassword(usingDefault);
            setAuthed(true);
          }}
        />
        <Toasts />
      </>
    );
  }

  return <AdminShell usingDefaultPassword={defaultPassword} />;
}

function AdminShell({ usingDefaultPassword }: { usingDefaultPassword: boolean }) {
  const { config, dirty, canUndo, canRedo } = useEditor();
  const [tab, setTab] = useState<TabId>('content');
  const [device, setDevice] = useState<DeviceName>('desktop');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cropBlock, setCropBlock] = useState<Block | null>(null);
  const [collageOpen, setCollageOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  const [historyToken, setHistoryToken] = useState(0);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{ at: number; config: SiteConfig } | null>(null);

  // nạp config + thư viện ảnh; nếu có bản nháp khác server thì mời khôi phục
  // bằng banner (không dùng confirm() vì nó khoá cứng cả trang lúc mới vào)
  useEffect(() => {
    let alive = true;
    Promise.all([api.getSite(), api.getMedia().catch(() => ({ items: [] as MediaItem[] }))])
      .then(([site, media]) => {
        if (!alive) return;
        editor.init(site, media.items);

        const draft = loadDraft();
        const usable =
          draft &&
          draft.config.revision === site.revision &&
          JSON.stringify(draft.config) !== JSON.stringify(site);
        if (usable) setPendingDraft(draft);
        else clearDraft();

        if (usingDefaultPassword) {
          toast('Bạn đang dùng mật khẩu mặc định admin123 — hãy đổi Admin__Password trên server.', 'err', 8000);
        }
      })
      .catch((err: Error) => alive && setLoadError(err.message));
    return () => {
      alive = false;
    };
  }, [usingDefaultPassword]);

  const save = useCallback(async () => {
    const current = editor.state.config;
    if (!current) return;
    setSaving(true);
    try {
      const saved = await api.saveSite(current);
      editor.markSaved(saved);
      setHistoryToken((n) => n + 1);
      toast('Đã áp dụng lên trang portfolio.', 'ok');
    } catch (err) {
      toast('Lưu thất bại: ' + (err as Error).message, 'err', 6000);
    } finally {
      setSaving(false);
    }
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    setProgress(0);
    try {
      const result = await api.upload(files, setProgress);
      if (result.saved.length) {
        editor.setMedia([...result.saved, ...editor.state.media]);
        toast(`Đã tải lên ${result.saved.length} ảnh.`, 'ok');
      }
      if (result.skipped.length) toast('Bỏ qua: ' + result.skipped.join(', '), 'err', 6000);
      return result.saved;
    } catch (err) {
      toast((err as Error).message, 'err', 6000);
      return [];
    } finally {
      setTimeout(() => setProgress(null), 400);
    }
  }, []);

  const uploadToCanvas = useCallback(
    async (files: File[], target: { sectionId: string; blockId?: string; mode: 'assign' | 'append' }) => {
      const saved = await uploadFiles(files);
      if (!saved.length) return;
      if (target.mode === 'assign' && target.blockId) {
        assignImage(target.blockId, saved[0].url);
        saved.slice(1).forEach((item) => addBlock(target.sectionId, 'image', { src: item.url }));
      } else {
        saved.forEach((item) => addBlock(target.sectionId, 'image', { src: item.url }));
      }
    },
    [uploadFiles],
  );

  // phím tắt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      } else if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPreviewOpen(true);
      } else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        editor.undo();
      } else if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !typing) {
        e.preventDefault();
        editor.redo();
      } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        const { sectionId, blockId } = editor.state.selection;
        if (sectionId && blockId) {
          e.preventDefault();
          removeBlock(sectionId, blockId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // cảnh báo khi rời trang lúc còn thay đổi chưa lưu
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!editor.state.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  if (loadError) {
    return (
      <div className="adm-login">
        <div className="adm-login__box">
          <h1>Không tải được dữ liệu</h1>
          <p>{loadError}</p>
          <button className="ui-btn ui-btn--primary ui-btn--block" onClick={() => location.reload()}>
            Thử lại
          </button>
        </div>
        <Toasts />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="adm-login">
        <div className="adm-login__box">Đang tải nội dung…</div>
        <Toasts />
      </div>
    );
  }

  return (
    <>
      {pendingDraft && (
        <div className="adm-draftbar">
          <span>
            Có bản nháp chưa lưu lúc <b>{new Date(pendingDraft.at).toLocaleString('vi-VN')}</b>.
          </span>
          <div className="spacer" />
          <button
            className="ui-btn ui-btn--sm"
            onClick={() => {
              clearDraft();
              setPendingDraft(null);
            }}
          >
            Bỏ bản nháp
          </button>
          <button
            className="ui-btn ui-btn--primary ui-btn--sm"
            onClick={() => {
              editor.init(pendingDraft.config, editor.state.media, true);
              setPendingDraft(null);
            }}
          >
            Khôi phục
          </button>
        </div>
      )}

      <div className="adm-shell">
        <header className="adm-top">
          <div className="adm-top__brand">
            <span className="adm-top__dot" /> Portfolio Studio
          </div>
          <span className={'adm-badge ' + (dirty ? 'adm-badge--dirty' : 'adm-badge--saved')}>
            {dirty ? '● Chưa lưu' : `Đã lưu · bản ${config.revision}`}
          </span>
          <div className="adm-top__spacer" />
          <button className="ui-btn ui-btn--icon" title="Hoàn tác (Ctrl+Z)" disabled={!canUndo} onClick={() => editor.undo()}>
            ↶
          </button>
          <button className="ui-btn ui-btn--icon" title="Làm lại (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => editor.redo()}>
            ↷
          </button>
          <button className="ui-btn" onClick={() => setPreviewOpen(true)} title="Xem trước (Ctrl+P)">
            Xem trước
          </button>
          <a className="ui-btn ui-btn--ghost" href="/" target="_blank" rel="noopener">
            Mở trang thật ↗
          </a>
          <button className="ui-btn ui-btn--primary" onClick={() => void save()} disabled={saving} title="Lưu (Ctrl+S)">
            {saving ? 'Đang lưu…' : 'Lưu & áp dụng'}
          </button>
          <button
            className="ui-btn ui-btn--ghost"
            title="Đăng xuất"
            onClick={async () => {
              if (editor.state.dirty && !window.confirm('Còn thay đổi chưa lưu. Vẫn đăng xuất?')) return;
              await api.logout();
              location.reload();
            }}
          >
            ⎋
          </button>
        </header>

        <aside className="adm-side">
          <div className="adm-tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.id}
                role="tab"
                className={'adm-tab' + (tab === item.id ? ' is-active' : '')}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="adm-panes">
            <div className="adm-pane is-active">
              {tab === 'content' && <ContentPane />}
              {tab === 'media' && (
                <MediaPane
                  picked={picked}
                  setPicked={setPicked}
                  progress={progress}
                  uploadFiles={uploadFiles}
                  onCollage={() => {
                    if (picked.length < 2) {
                      toast('Chọn ít nhất 2 ảnh (Ctrl + bấm) rồi bấm ⊞.', 'err');
                      return;
                    }
                    setCollageOpen(true);
                  }}
                />
              )}
              {tab === 'theme' && <ThemePane />}
              {tab === 'site' && <SitePane />}
              {tab === 'history' && <HistoryPane reloadToken={historyToken} />}
            </div>
          </div>
        </aside>

        <div className="adm-canvas-wrap">
          <div className="adm-canvas-bar">
            <div className="seg">
              {(['desktop', 'tablet', 'mobile'] as DeviceName[]).map((name) => (
                <button key={name} className={device === name ? 'is-on' : undefined} onClick={() => setDevice(name)}>
                  {name === 'desktop' ? 'Desktop' : name === 'tablet' ? 'Tablet' : 'Mobile'}
                </button>
              ))}
            </div>
            <span className="adm-hint">
              Bấm vào khối để chỉnh · kéo tay cầm ⠿ để đổi vị trí · kéo cạnh phải để đổi độ rộng
            </span>
            <div className="adm-canvas-bar__spacer" />
            <button className="ui-btn ui-btn--icon" title="Chạy lại animation" onClick={() => setReplayToken((n) => n + 1)}>
              ▷
            </button>
            <button className="ui-btn ui-btn--icon" title="Bảng thuộc tính" onClick={() => setInspectorOpen((v) => !v)}>
              ☰
            </button>
          </div>

          <Canvas
            device={device}
            replayToken={replayToken}
            onCropRequest={setCropBlock}
            onUploadFiles={(files, target) => void uploadToCanvas(files, target)}
          />
        </div>

        <Inspector
          open={inspectorOpen}
          onCropRequest={setCropBlock}
          onPickFromLibrary={() => setTab('media')}
          onReplay={() => setReplayToken((n) => n + 1)}
        />
      </div>

      {previewOpen && (
        <PreviewOverlay
          config={config}
          saving={saving}
          onSave={() => void save()}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {cropBlock && (
        <CropModal
          block={cropBlock}
          onClose={() => setCropBlock(null)}
          onApply={(rect) =>
            editor.mutate('crop', (draft) => {
              const target = editor.findBlock(draft, cropBlock.id);
              if (target) target.crop = rect;
            })
          }
          onExport={(item) => {
            editor.setMedia([item, ...editor.state.media]);
            editor.mutate('crop-export', (draft) => {
              const target = editor.findBlock(draft, cropBlock.id);
              if (target) {
                target.src = item.url;
                target.crop = null;
              }
            });
          }}
        />
      )}

      {collageOpen && (
        <CollageModal
          urls={picked}
          onClose={() => setCollageOpen(false)}
          onSaved={(item) => {
            editor.setMedia([item, ...editor.state.media]);
            setPicked([]);
          }}
        />
      )}

      <Toasts />
    </>
  );
}
