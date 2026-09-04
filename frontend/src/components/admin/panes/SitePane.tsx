/** Tab "Trang": thương hiệu, hero, giới thiệu, liên hệ, gói dịch vụ. */

import { useState } from 'react';
import type { SiteMeta } from '../../../types';
import { editor, useEditor } from '../../../lib/editorStore';
import { assetUrl } from '../../../api/client';
import { uid } from '../../../lib/factory';
import { CheckField, GroupTitle, Row, TextArea, TextField } from '../Field';

export function SitePane() {
  const { config, media } = useEditor();
  if (!config) return null;
  const site = config.site;

  const set = <K extends keyof SiteMeta>(key: K) => (value: SiteMeta[K]) =>
    editor.mutate('site-' + String(key), (draft) => {
      draft.site[key] = value;
    });

  return (
    <>
      <div className="adm-group">
        <GroupTitle>Thương hiệu</GroupTitle>
        <TextField label="Tên studio" value={site.title} onChange={set('title')} />
        <TextField label="Chữ logo" value={site.logoText} onChange={set('logoText')} />
        <TextField label="Tagline" value={site.tagline} onChange={set('tagline')} />

        <GroupTitle>Màn hình đầu (hero)</GroupTitle>
        <TextArea label="Tiêu đề lớn" rows={2} value={site.heroHeadline} onChange={set('heroHeadline')} />
        <TextArea label="Mô tả" rows={2} value={site.heroSub} onChange={set('heroSub')} />
        <MediaPicker
          label="Ảnh nền hero"
          value={site.heroImage}
          options={media.map((m) => ({ url: m.url, name: m.fileName }))}
          onPick={(url) => set('heroImage')(url)}
        />
        <Row>
          <TextField label="Chữ trên nút" value={site.heroCtaText} onChange={set('heroCtaText')} />
          <TextField label="Nút dẫn tới" value={site.heroCtaLink} onChange={set('heroCtaLink')} />
        </Row>

        <GroupTitle>Về tôi</GroupTitle>
        <TextArea label="Giới thiệu" rows={5} value={site.about} onChange={set('about')} />
        <MediaPicker
          label="Ảnh chân dung"
          value={site.aboutImage}
          options={media.map((m) => ({ url: m.url, name: m.fileName }))}
          onPick={(url) => set('aboutImage')(url)}
        />

        <GroupTitle>Liên hệ</GroupTitle>
        <TextField label="Email" value={site.email} onChange={set('email')} />
        <TextField label="Điện thoại" value={site.phone} onChange={set('phone')} />
        <TextField label="Địa chỉ" value={site.address} onChange={set('address')} />
        <TextField label="Instagram (URL)" value={site.instagram} onChange={set('instagram')} />
        <TextField label="Facebook (URL)" value={site.facebook} onChange={set('facebook')} />
        <TextField label="Behance (URL)" value={site.behance} onChange={set('behance')} />
        <TextField label="Dòng chân trang" value={site.footerNote} onChange={set('footerNote')} />
      </div>

      <div className="adm-group">
        <GroupTitle
          action={
            <button
              className="ui-btn ui-btn--icon"
              title="Thêm gói"
              onClick={() =>
                editor.mutate('add-svc', (draft) => {
                  draft.site.services.push({
                    id: uid(),
                    name: 'Gói mới',
                    price: '0đ',
                    description: '',
                    includes: [],
                    featured: false,
                  });
                })
              }
            >
              ＋
            </button>
          }
        >
          Gói dịch vụ
        </GroupTitle>

        <div className="adm-list">
          {site.services.map((service, index) => (
            <ServiceRow key={service.id} index={index} />
          ))}
        </div>
      </div>
    </>
  );
}

function ServiceRow({ index }: { index: number }) {
  const { config } = useEditor();
  const [open, setOpen] = useState(false);
  const service = config?.site.services[index];
  if (!service) return null;

  const set = <K extends keyof typeof service>(key: K) => (value: (typeof service)[K]) =>
    editor.mutate('svc-' + String(key), (draft) => {
      const target = draft.site.services[index];
      if (target) target[key] = value;
    });

  return (
    <div className="adm-item" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div className="adm-item__body" style={{ cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
          <div className="adm-item__name">{service.name || '(chưa đặt tên)'}</div>
          <div className="adm-item__meta">{service.price || '—'}</div>
        </div>
        <button
          className="adm-icon-btn adm-icon-btn--danger"
          title="Xoá gói"
          onClick={() =>
            editor.mutate('remove-svc', (draft) => {
              draft.site.services.splice(index, 1);
            })
          }
        >
          ✕
        </button>
      </div>

      {open && (
        <div style={{ padding: '10px 2px 2px' }}>
          <TextField label="Tên gói" value={service.name} onChange={set('name')} />
          <TextField label="Giá" value={service.price} onChange={set('price')} />
          <TextArea label="Mô tả" rows={2} value={service.description} onChange={set('description')} />
          <TextArea
            label="Bao gồm (mỗi dòng một mục)"
            rows={4}
            value={service.includes.join('\n')}
            onChange={(v) => set('includes')(v.split('\n').map((s) => s.trim()).filter(Boolean))}
          />
          <CheckField label="Đánh dấu “Phổ biến”" checked={service.featured} onChange={set('featured')} />
        </div>
      )}
    </div>
  );
}

function MediaPicker({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string | null;
  options: { url: string; name: string }[];
  onPick: (url: string | null) => void;
}) {
  return (
    <div className="f">
      <div className="f__label">
        <span>{label}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            width: 46,
            height: 34,
            flex: 'none',
            borderRadius: 6,
            border: '1px solid var(--ui-line)',
            background: value ? `#0f1217 center/cover url(${assetUrl(value)})` : '#0f1217',
          }}
        />
        <select className="sel" value={value ?? ''} onChange={(e) => onPick(e.target.value || null)}>
          <option value="">— không dùng —</option>
          {options.map((option) => (
            <option value={option.url} key={option.url}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
