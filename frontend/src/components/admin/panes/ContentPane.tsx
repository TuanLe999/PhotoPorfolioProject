/** Tab "Bố cục": danh sách khu vực, cài đặt khu vực, thêm khối, mẫu dựng sẵn. */

import { useState } from 'react';
import type { Section } from '../../../types';
import { editor, useEditor } from '../../../lib/editorStore';
import { newSection, uid } from '../../../lib/factory';
import { BLOCK_TYPES, LAYOUTS, TEMPLATES } from '../../../lib/catalog';
import { CheckField, GroupTitle, RangeField, Row, SegField, SelectField, TextArea, TextField } from '../Field';
import { addBlock, toggleSection } from '../../../lib/blockActions';
import { toast } from '../Toasts';

export function ContentPane() {
  const { config, selection } = useEditor();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  if (!config) return null;

  const section = editor.section(selection.sectionId);

  const addSection = () => {
    const created = newSection({ name: 'Khu vực ' + (config.sections.length + 1) });
    editor.mutate('add-section', (draft) => void draft.sections.push(created));
    editor.select(created.id, null);
  };

  const reorder = (draggedId: string, targetIndex: number) =>
    editor.mutate('reorder-section', (draft) => {
      const from = draft.sections.findIndex((s) => s.id === draggedId);
      if (from < 0) return;
      const [moved] = draft.sections.splice(from, 1);
      draft.sections.splice(targetIndex, 0, moved);
    });

  return (
    <>
      <div className="adm-group">
        <GroupTitle
          action={
            <button className="ui-btn ui-btn--icon" title="Thêm khu vực" onClick={addSection}>
              ＋
            </button>
          }
        >
          Các khu vực
        </GroupTitle>

        <div className="adm-list">
          {config.sections.map((item, index) => (
            <div
              key={item.id}
              className={
                'adm-item' +
                (selection.sectionId === item.id ? ' is-active' : '') +
                (item.visible ? '' : ' is-hidden') +
                (dragId === item.id ? ' is-dragging' : '') +
                (overId === item.id ? ' is-over' : '')
              }
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
                setDragId(item.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(item.id);
              }}
              onDragLeave={() => setOverId((id) => (id === item.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                setOverId(null);
                if (dragId && dragId !== item.id) reorder(dragId, index);
                setDragId(null);
              }}
              onClick={() => {
                editor.select(item.id, null);
                document.getElementById('sec-' + item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <span className="adm-item__grip" title="Kéo để đổi thứ tự">
                ⠿
              </span>
              <div className="adm-item__body">
                <div className="adm-item__name">{item.name || '(không tên)'}</div>
                <div className="adm-item__meta">
                  {item.blocks.length} khối · {item.layout}
                </div>
              </div>
              <div className="adm-item__actions">
                <button
                  className="adm-icon-btn"
                  title="Ẩn/hiện"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection(item.id);
                  }}
                >
                  {item.visible ? '👁' : '🚫'}
                </button>
                <button
                  className="adm-icon-btn"
                  title="Nhân bản"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateSection(item.id);
                  }}
                >
                  ⧉
                </button>
                <button
                  className="adm-icon-btn adm-icon-btn--danger"
                  title="Xoá khu vực"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSection(item);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {!config.sections.length && <div className="adm-empty">Chưa có khu vực nào.</div>}
        </div>
      </div>

      <div className="adm-group">{section ? <SectionSettings section={section} /> : <p className="adm-hint">Chọn một khu vực để đổi tiêu đề, kiểu bố cục, khoảng cách…</p>}</div>

      <div className="adm-group">
        <GroupTitle>Thêm khối vào khu vực đang chọn</GroupTitle>
        <div className="adm-preset-row">
          {BLOCK_TYPES.map((type) => (
            <button
              key={type.id}
              className="adm-preset"
              onClick={() => {
                const sectionId = selection.sectionId ?? config.sections[0]?.id;
                if (!sectionId) return toast('Thêm một khu vực trước đã.', 'err');
                addBlock(sectionId, type.id);
              }}
            >
              ＋ {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-group">
        <GroupTitle>Mẫu bố cục nhanh</GroupTitle>
        <div className="adm-list">
          {TEMPLATES.map((template) => (
            <div
              key={template.name}
              className="adm-item"
              onClick={() => {
                const sectionId = selection.sectionId ?? config.sections[0]?.id;
                if (!sectionId) return toast('Thêm một khu vực trước đã.', 'err');
                const blocks = template.build();
                editor.mutate('apply-template', (draft) => {
                  draft.sections.find((s) => s.id === sectionId)?.blocks.push(...blocks);
                });
                toast(`Đã thêm mẫu “${template.name}”.`, 'ok');
              }}
            >
              <div className="adm-item__body">
                <div className="adm-item__name">{template.name}</div>
                <div className="adm-item__meta">thêm vào khu vực đang chọn</div>
              </div>
              <span className="adm-item__grip">＋</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SectionSettings({ section }: { section: Section }) {
  const set = <K extends keyof Section>(key: K) => (value: Section[K]) =>
    editor.mutate('section-' + String(key), (draft) => {
      const target = draft.sections.find((s) => s.id === section.id);
      if (target) target[key] = value;
    });

  return (
    <>
      <GroupTitle>Khu vực: {section.name}</GroupTitle>
      <TextField label="Tên (hiện trên menu)" value={section.name} onChange={set('name')} />
      <TextField label="Tiêu đề lớn" value={section.heading ?? ''} onChange={(v) => set('heading')(v)} />
      <TextArea label="Mô tả ngắn" rows={2} value={section.subheading ?? ''} onChange={(v) => set('subheading')(v)} />
      <SelectField
        label="Kiểu bố cục"
        value={section.layout}
        options={LAYOUTS}
        onChange={(v) => set('layout')(v as Section['layout'])}
      />
      <Row>
        <RangeField label="Số cột" value={section.columns} min={1} max={12} onChange={set('columns')} />
        <RangeField label="Khoảng cách" value={section.gap} min={0} max={60} unit="px" onChange={set('gap')} />
      </Row>
      <SegField
        label="Nền khu vực"
        value={section.background}
        options={[
          { id: 'transparent', label: 'Trong' },
          { id: 'surface', label: 'Đậm' },
          { id: 'accent', label: 'Loang màu' },
        ]}
        onChange={(v) => set('background')(v)}
      />
      <CheckField label="Hiện khu vực này trên trang" checked={section.visible} onChange={set('visible')} />
    </>
  );
}

function duplicateSection(id: string) {
  editor.mutate('duplicate-section', (draft) => {
    const index = draft.sections.findIndex((s) => s.id === id);
    if (index < 0) return;
    const copy = structuredClone(draft.sections[index]);
    copy.id = uid();
    copy.name += ' (bản sao)';
    copy.blocks.forEach((block) => {
      block.id = uid();
    });
    draft.sections.splice(index + 1, 0, copy);
  });
}

function removeSection(section: Section) {
  if (!window.confirm(`Xoá khu vực “${section.name}” cùng ${section.blocks.length} khối?`)) return;
  editor.mutate('remove-section', (draft) => {
    draft.sections = draft.sections.filter((s) => s.id !== section.id);
  });
  if (editor.state.selection.sectionId === section.id) editor.select(null, null);
}
