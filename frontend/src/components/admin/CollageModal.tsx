/** Ghép 2–4 ảnh thành một ảnh mới rồi lưu vào thư viện. */

import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../../types';
import { api, assetUrl } from '../../api/client';
import { COLLAGE_LAYOUTS } from '../../lib/catalog';
import { drawCollage, type CollageOptions } from '../../lib/imageTools';
import { ColorField, RangeField, Row, SelectField } from './Field';
import { Modal } from './Modal';
import { toast } from './Toasts';

export function CollageModal({
  urls,
  onSaved,
  onClose,
}: {
  urls: string[];
  onSaved: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState(false);
  const [opts, setOpts] = useState<CollageOptions>({
    layout: urls.length >= 4 ? 'grid' : 'row',
    gap: 12,
    radius: 0,
    bg: '#0b0b0f',
    width: 2000,
  });

  const images = urls.slice(0, 4);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCollage(canvas, images.map(assetUrl), opts).catch((err: Error) => toast(err.message, 'err'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, urls.join('|')]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const item = await api.uploadDataUrl(canvas.toDataURL('image/jpeg', 0.92), 'collage');
      onSaved(item);
      toast('Đã lưu ảnh ghép.', 'ok');
      onClose();
    } catch (err) {
      toast((err as Error).message, 'err', 6000);
    } finally {
      setSaving(false);
    }
  };

  const patch = (change: Partial<CollageOptions>) => setOpts((current) => ({ ...current, ...change }));

  return (
    <Modal
      title="Ghép ảnh"
      wide
      onClose={onClose}
      footer={
        <>
          <span className="adm-hint">Ảnh ghép được lưu thành file JPG mới, ảnh gốc không thay đổi.</span>
          <div className="spacer" />
          <button className="ui-btn ui-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu vào thư viện'}
          </button>
        </>
      }
    >
      <div className="adm-side-by">
        <div className="adm-collage-preview">
          <canvas ref={canvasRef} />
        </div>
        <div>
          <SelectField
            label="Kiểu ghép"
            value={opts.layout}
            options={COLLAGE_LAYOUTS}
            onChange={(v) => patch({ layout: v })}
          />
          <Row>
            <RangeField label="Khoảng cách" value={opts.gap} min={0} max={80} unit="px" onChange={(v) => patch({ gap: v })} />
            <RangeField label="Bo góc" value={opts.radius} min={0} max={80} unit="px" onChange={(v) => patch({ radius: v })} />
          </Row>
          <ColorField label="Màu nền" value={opts.bg} onChange={(v) => patch({ bg: v })} />
          <SelectField
            label="Chiều rộng ảnh xuất"
            value={String(opts.width)}
            options={[
              { id: '1200', label: '1200px' },
              { id: '2000', label: '2000px' },
              { id: '3000', label: '3000px' },
            ]}
            onChange={(v) => patch({ width: Number(v) })}
          />
          <p className="adm-hint">
            Đang ghép {images.length} ảnh. Ảnh kết quả nằm trong thư viện, kéo thả dùng như ảnh thường.
          </p>
        </div>
      </div>
    </Modal>
  );
}
