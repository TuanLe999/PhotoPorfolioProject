/**
 * Cắt ảnh: kéo khung / 4 góc, khoá tỉ lệ, lưới 1/3.
 * "Áp dụng" chỉ lưu vùng cắt (%) — không đụng file gốc.
 * "Xuất ảnh mới" vẽ lại ở độ phân giải gốc và tạo file mới trong thư viện.
 */

import { useRef, useState } from 'react';
import type { Block, CropRect, MediaItem } from '../../types';
import { api, assetUrl } from '../../api/client';
import { CROP_RATIOS } from '../../lib/catalog';
import { renderCrop } from '../../lib/imageTools';
import { Modal } from './Modal';
import { toast } from './Toasts';

const MIN = 5; // % nhỏ nhất của khung cắt
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function CropModal({
  block,
  onApply,
  onExport,
  onClose,
}: {
  block: Block;
  onApply: (rect: CropRect) => void;
  onExport: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<CropRect>(block.crop ?? { x: 0, y: 0, w: 100, h: 100 });
  const [ratio, setRatio] = useState(0);
  const [exporting, setExporting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const src = assetUrl(block.src);

  const startDrag = (e: React.PointerEvent, corner: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage || !stage.width) return;

    const origin = { px: e.clientX, py: e.clientY };
    const start = { ...rect };

    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - origin.px) / stage.width) * 100;
      const dy = ((ev.clientY - origin.py) / stage.height) * 100;

      if (!corner) {
        setRect({
          ...start,
          x: clamp(start.x + dx, 0, 100 - start.w),
          y: clamp(start.y + dy, 0, 100 - start.h),
        });
        return;
      }

      let { x, y, w, h } = start;
      if (corner.includes('w')) {
        const nx = clamp(start.x + dx, 0, start.x + start.w - MIN);
        w = start.w + (start.x - nx);
        x = nx;
      }
      if (corner.includes('e')) w = clamp(start.w + dx, MIN, 100 - start.x);
      if (corner.includes('n')) {
        const ny = clamp(start.y + dy, 0, start.y + start.h - MIN);
        h = start.h + (start.y - ny);
        y = ny;
      }
      if (corner.includes('s')) h = clamp(start.h + dy, MIN, 100 - start.y);

      if (ratio > 0) {
        // khoá tỉ lệ: suy chiều cao từ chiều rộng theo pixel thật của stage
        const pxW = (w / 100) * stage.width;
        h = clamp(((pxW / ratio) / stage.height) * 100, MIN, 100 - y);
      }
      setRect({ x, y, w, h });
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const applyRatio = (value: number) => {
    setRatio(value);
    const stage = stageRef.current?.getBoundingClientRect();
    if (value <= 0 || !stage?.width) return;
    const pxW = (rect.w / 100) * stage.width;
    let h = ((pxW / value) / stage.height) * 100;
    let w = rect.w;
    if (rect.y + h > 100) {
      h = 100 - rect.y;
      w = Math.min(((h / 100) * stage.height * value / stage.width) * 100, 100 - rect.x);
    }
    setRect({ ...rect, w, h });
  };

  const exportImage = async () => {
    setExporting(true);
    try {
      const dataUrl = await renderCrop(src, rect);
      const item = await api.uploadDataUrl(dataUrl, 'cropped');
      onExport(item);
      toast('Đã lưu ảnh cắt vào thư viện.', 'ok');
      onClose();
    } catch (err) {
      toast((err as Error).message, 'err', 6000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title="Cắt ảnh"
      onClose={onClose}
      footer={
        <>
          <span className="adm-hint">
            “Áp dụng” chỉ đổi vùng hiển thị (không phá ảnh gốc). “Xuất ảnh mới” tạo file mới trong thư viện.
          </span>
          <div className="spacer" />
          <button className="ui-btn" onClick={() => void exportImage()} disabled={exporting}>
            {exporting ? 'Đang xuất…' : 'Xuất ảnh mới'}
          </button>
          <button
            className="ui-btn ui-btn--primary"
            onClick={() => {
              onApply(rect);
              onClose();
            }}
          >
            Áp dụng
          </button>
        </>
      }
    >
      <div className="adm-side-by">
        <div className="adm-crop">
          <div className="adm-crop__stage" ref={stageRef}>
            <img className="adm-crop__img" src={src} alt="" draggable={false} />
            <div
              className="adm-crop__box"
              style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
              onPointerDown={(e) => startDrag(e, null)}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width: `${(100 / Math.max(rect.w, 1)) * 100}%`,
                  height: `${(100 / Math.max(rect.h, 1)) * 100}%`,
                  left: `${-(rect.x / Math.max(rect.w, 1)) * 100}%`,
                  top: `${-(rect.y / Math.max(rect.h, 1)) * 100}%`,
                }}
              />
              {['nw', 'ne', 'sw', 'se'].map((corner) => (
                <div key={corner} className="adm-crop__h" data-h={corner} onPointerDown={(e) => startDrag(e, corner)} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="f">
            <div className="f__label">
              <span>Tỉ lệ khung</span>
            </div>
            <div className="adm-preset-row">
              {CROP_RATIOS.map((option) => (
                <button
                  key={option.label}
                  className="adm-preset"
                  style={ratio === option.id ? { borderColor: 'var(--ui-brand)', color: 'var(--ui-text)' } : undefined}
                  onClick={() => applyRatio(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="f">
            <div className="f__label">
              <span>Vùng cắt</span>
              <b>
                {Math.round(rect.w)}% × {Math.round(rect.h)}%
              </b>
            </div>
            <p className="adm-hint">Kéo khung để di chuyển, kéo 4 góc để đổi kích thước.</p>
          </div>
          <button className="ui-btn ui-btn--block" onClick={() => setRect({ x: 0, y: 0, w: 100, h: 100 })}>
            Đặt lại toàn ảnh
          </button>
        </div>
      </div>
    </Modal>
  );
}
