/** Bảng thuộc tính của khối đang chọn. */

import { useRef } from 'react';
import type { Block } from '../../types';
import { editor, useEditor } from '../../lib/editorStore';
import { assetUrl } from '../../api/client';
import { ANIMATIONS, ASPECT_RATIOS, BLOCK_TYPES, HOVERS } from '../../lib/catalog';
import { CheckField, ColorField, GroupTitle, RangeField, Row, SegField, SelectField, TextArea, TextField } from './Field';
import { toast } from './Toasts';

export function Inspector({
  open,
  onCropRequest,
  onPickFromLibrary,
  onReplay,
}: {
  open: boolean;
  onCropRequest: (block: Block) => void;
  onPickFromLibrary: () => void;
  onReplay: () => void;
}) {
  const { config, selection } = useEditor();
  const block = editor.block(selection.blockId);
  const section = editor.section(selection.sectionId);

  if (!config) return <aside className="adm-inspector" />;

  if (!block) {
    return (
      <aside className={"adm-inspector" + (open ? " is-open" : "")}>
        <div className="adm-inspector__head">
          <div>
            <div className="adm-inspector__title">{section ? 'Khu vực đang chọn' : 'Chưa chọn gì'}</div>
            <div className="adm-inspector__type">{section ? section.name : 'Bấm vào một khối trên canvas'}</div>
          </div>
        </div>
        <p className="adm-hint">
          {section
            ? 'Thuộc tính khu vực nằm ở cột trái (tab “Bố cục”). Bấm vào một khối để chỉnh ảnh, chữ và hiệu ứng.'
            : 'Kéo ảnh từ tab “Ảnh” vào canvas, hoặc bấm ＋ để thêm khối.'}
        </p>
      </aside>
    );
  }

  const set = <K extends keyof Block>(key: K) => (value: Block[K]) =>
    editor.mutate('block-' + String(key), (draft) => {
      const target = editor.findBlock(draft, block.id);
      if (target) target[key] = value;
    });

  return (
    <aside className={"adm-inspector" + (open ? " is-open" : "")}>
      <div className="adm-inspector__head">
        <div>
          <div className="adm-inspector__title">
            Khối {BLOCK_TYPES.find((t) => t.id === block.type)?.label ?? block.type}
          </div>
          <div className="adm-inspector__type">
            #{block.id} · {block.colSpan}/12 cột
          </div>
        </div>
        <button
          className="ui-btn ui-btn--icon"
          title="Cuộn tới khối"
          onClick={() =>
            document
              .querySelector(`.adm-canvas .pf-block[data-block-id="${block.id}"]`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        >
          ⌖
        </button>
      </div>

      <SelectField
        label="Loại khối"
        value={block.type}
        options={BLOCK_TYPES}
        onChange={(v) => set('type')(v as Block['type'])}
      />
      <RangeField label="Độ rộng (cột)" value={block.colSpan} min={1} max={12} onChange={set('colSpan')} />

      {block.type === 'image' && (
        <ImageFields block={block} set={set} onCropRequest={onCropRequest} onPickFromLibrary={onPickFromLibrary} />
      )}

      {block.type === 'video' && (
        <>
          <GroupTitle>Video</GroupTitle>
          <TextField label="URL YouTube / Vimeo / mp4" value={block.src ?? ''} onChange={(v) => set('src')(v)} />
          <SelectField
            label="Tỉ lệ"
            value={String(block.aspectRatio)}
            options={[
              { id: '1.7778', label: '16:9' },
              { id: '1', label: '1:1' },
              { id: '0.5625', label: '9:16 dọc' },
            ]}
            onChange={(v) => set('aspectRatio')(Number(v))}
          />
        </>
      )}

      {(block.type === 'text' || block.type === 'quote') && <TextFields block={block} set={set} />}

      {block.type === 'spacer' && (
        <RangeField
          label="Chiều cao"
          value={Math.round((block.aspectRatio || 1) * 60)}
          min={20}
          max={240}
          unit="px"
          onChange={(v) => set('aspectRatio')(v / 60)}
        />
      )}

      <GroupTitle>Hiệu ứng khi cuộn tới</GroupTitle>
      <div className="adm-anim-grid">
        {ANIMATIONS.map((anim) => (
          <button
            key={anim.id}
            className={'adm-anim' + (block.animation === anim.id ? ' is-on' : '')}
            onClick={() => set('animation')(anim.id)}
          >
            {anim.label}
          </button>
        ))}
      </div>
      <div style={{ height: 10 }} />
      <Row>
        <RangeField label="Trễ" value={block.delay} min={0} max={1500} step={50} unit="ms" onChange={set('delay')} />
        <RangeField
          label="Thời lượng"
          value={block.duration}
          min={200}
          max={2500}
          step={50}
          unit="ms"
          onChange={set('duration')}
        />
      </Row>
      <SelectField
        label="Hiệu ứng khi trỏ vào"
        value={block.hover}
        options={HOVERS}
        onChange={(v) => set('hover')(v as Block['hover'])}
      />
      <RangeField
        label="Parallax khi cuộn"
        value={block.parallax}
        min={-1}
        max={1}
        step={0.1}
        onChange={set('parallax')}
        hint="Số dương: khối trôi chậm hơn trang. Số âm: trôi nhanh hơn."
      />
      <button className="ui-btn ui-btn--block" onClick={onReplay}>
        ▷ Chạy lại hiệu ứng trên canvas
      </button>
    </aside>
  );
}

type Setter = <K extends keyof Block>(key: K) => (value: Block[K]) => void;

function ImageFields({
  block,
  set,
  onCropRequest,
  onPickFromLibrary,
}: {
  block: Block;
  set: Setter;
  onCropRequest: (block: Block) => void;
  onPickFromLibrary: () => void;
}) {
  return (
    <>
      <GroupTitle>Ảnh</GroupTitle>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          className="ui-btn"
          style={{ flex: 1 }}
          onClick={() => {
            onPickFromLibrary();
            toast('Bấm vào một ảnh trong thư viện để gán vào khối này.');
          }}
        >
          Chọn từ thư viện
        </button>
        {block.src && (
          <button className="ui-btn" onClick={() => onCropRequest(block)}>
            ✂ Cắt
          </button>
        )}
      </div>

      <TextField label="Đường dẫn ảnh" value={block.src ?? ''} placeholder="/media/....jpg" onChange={(v) => set('src')(v || null)} />
      <TextField label="Alt (mô tả cho SEO)" value={block.alt} onChange={set('alt')} />

      <Row>
        <SelectField
          label="Tỉ lệ khung"
          value={String(block.aspectRatio)}
          options={ASPECT_RATIOS}
          onChange={(v) => set('aspectRatio')(Number(v))}
        />
        <SegField
          label="Cách lấp khung"
          value={block.fit}
          options={[
            { id: 'cover', label: 'Cover' },
            { id: 'contain', label: 'Contain' },
          ]}
          onChange={(v) => set('fit')(v)}
        />
      </Row>

      {block.src && <FocusPicker block={block} />}

      {block.crop && (
        <div className="f">
          <div className="f__label">
            <span>Vùng cắt đang áp dụng</span>
            <b>
              {Math.round(block.crop.w)}%×{Math.round(block.crop.h)}%
            </b>
          </div>
          <button className="ui-btn ui-btn--block" onClick={() => set('crop')(null)}>
            Bỏ cắt, dùng lại ảnh đầy đủ
          </button>
        </div>
      )}

      <RangeField
        label="Bo góc riêng"
        value={block.radius ?? editor.state.config?.theme.radius ?? 14}
        min={0}
        max={80}
        unit="px"
        onChange={(v) => set('radius')(v)}
      />
      <TextField label="Chú thích" value={block.caption} onChange={set('caption')} />
      <SegField
        label="Kiểu chú thích"
        value={block.captionStyle}
        options={[
          { id: 'below', label: 'Dưới' },
          { id: 'overlay', label: 'Trên ảnh' },
          { id: 'hover', label: 'Khi hover' },
          { id: 'none', label: 'Ẩn' },
        ]}
        onChange={(v) => set('captionStyle')(v)}
      />
      <TextField label="Link khi bấm (tuỳ chọn)" value={block.link ?? ''} onChange={(v) => set('link')(v || null)} />
    </>
  );
}

/** Chọn điểm trọng tâm ảnh bằng cách bấm/kéo lên ảnh thu nhỏ. */
function FocusPicker({ block }: { block: Block }) {
  const areaRef = useRef<HTMLDivElement>(null);

  const pick = (clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const x = Math.min(Math.max(Math.round(((clientX - rect.left) / rect.width) * 100), 0), 100);
    const y = Math.min(Math.max(Math.round(((clientY - rect.top) / rect.height) * 100), 0), 100);
    editor.mutate('focus', (draft) => {
      const target = editor.findBlock(draft, block.id);
      if (target) {
        target.focusX = x;
        target.focusY = y;
      }
    });
  };

  return (
    <div className="f">
      <div className="f__label">
        <span>Trọng tâm ảnh (khi bị cắt bởi khung)</span>
      </div>
      <div
        className="adm-focus"
        ref={areaRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pick(e.clientX, e.clientY);
        }}
      >
        <img src={assetUrl(block.src)} alt="" />
        <div className="adm-focus__dot" style={{ left: `${block.focusX}%`, top: `${block.focusY}%` }} />
      </div>
      <div className="adm-hint" style={{ marginTop: 5 }}>
        Bấm/kéo lên ảnh để chọn phần luôn được giữ trong khung.
      </div>
    </div>
  );
}

function TextFields({ block, set }: { block: Block; set: Setter }) {
  const isQuote = block.type === 'quote';
  return (
    <>
      <GroupTitle>Nội dung</GroupTitle>
      <p className="adm-hint" style={{ marginTop: -4 }}>
        Mẹo: nháy đúp trực tiếp lên chữ trong canvas để sửa nhanh.
      </p>
      <TextField
        label={isQuote ? 'Tên người nói' : 'Tiêu đề'}
        value={block.title ?? ''}
        onChange={(v) => set('title')(v)}
      />
      <TextArea
        label={isQuote ? 'Câu trích' : 'Nội dung'}
        rows={5}
        value={block.body ?? ''}
        onChange={(v) => set('body')(v)}
      />
      <Row>
        <RangeField label="Cỡ tiêu đề" value={block.titleSize} min={12} max={96} unit="px" onChange={set('titleSize')} />
        <RangeField label="Cỡ nội dung" value={block.bodySize} min={11} max={32} unit="px" onChange={set('bodySize')} />
      </Row>
      <SegField
        label="Canh lề"
        value={block.align}
        options={[
          { id: 'left', label: 'Trái' },
          { id: 'center', label: 'Giữa' },
          { id: 'right', label: 'Phải' },
        ]}
        onChange={(v) => set('align')(v)}
      />
      <ColorField
        label="Màu chữ riêng"
        value={block.color ?? editor.state.config?.theme.text ?? '#ffffff'}
        onChange={(v) => set('color')(v)}
      />
      <CheckField
        label="Dùng màu theo tone chung"
        checked={block.color == null}
        onChange={(checked) => set('color')(checked ? null : (editor.state.config?.theme.text ?? '#ffffff'))}
      />
    </>
  );
}
