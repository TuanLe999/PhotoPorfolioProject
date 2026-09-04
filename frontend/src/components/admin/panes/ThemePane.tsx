/** Tab "Tone màu": bộ màu sẵn + tuỳ chỉnh màu, font, bo góc, chuyển động. */

import type { ThemeConfig } from '../../../types';
import { editor, useEditor } from '../../../lib/editorStore';
import { FONTS, PALETTES } from '../../../lib/catalog';
import { ColorField, GroupTitle, RangeField, SegField, SelectField } from '../Field';

export function ThemePane() {
  const { config } = useEditor();
  if (!config) return null;
  const theme = config.theme;

  const set = <K extends keyof ThemeConfig>(key: K) => (value: ThemeConfig[K]) =>
    editor.mutate('theme-' + String(key), (draft) => {
      draft.theme[key] = value;
    });

  return (
    <>
      <div className="adm-group">
        <GroupTitle>Bộ màu có sẵn</GroupTitle>
        <div className="adm-preset-row">
          {PALETTES.map((palette) => (
            <button
              key={palette.name}
              className="adm-preset"
              onClick={() =>
                editor.mutate('palette', (draft) => {
                  Object.assign(draft.theme, {
                    primary: palette.primary,
                    accent: palette.accent,
                    background: palette.background,
                    surface: palette.surface,
                    text: palette.text,
                    muted: palette.muted,
                    mode: palette.mode,
                  });
                })
              }
            >
              <i>
                <span style={{ background: palette.primary }} />
                <span style={{ background: palette.accent }} />
                <span style={{ background: palette.background, boxShadow: 'inset 0 0 0 1px #fff3' }} />
              </i>
              {palette.name}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-group">
        <GroupTitle>Màu</GroupTitle>
        <ColorField label="Màu nhấn chính" value={theme.primary} onChange={set('primary')} />
        <ColorField label="Màu phụ" value={theme.accent} onChange={set('accent')} />
        <ColorField label="Nền trang" value={theme.background} onChange={set('background')} />
        <ColorField label="Nền khối" value={theme.surface} onChange={set('surface')} />
        <ColorField label="Chữ" value={theme.text} onChange={set('text')} />
        <ColorField label="Chữ mờ" value={theme.muted} onChange={set('muted')} />

        <GroupTitle>Kiểu chữ &amp; hình khối</GroupTitle>
        <SelectField label="Font tiêu đề" value={theme.headingFont} options={FONTS} onChange={set('headingFont')} />
        <SelectField label="Font nội dung" value={theme.bodyFont} options={FONTS} onChange={set('bodyFont')} />
        <RangeField label="Bo góc" value={theme.radius} min={0} max={40} unit="px" onChange={set('radius')} />

        <GroupTitle>Không khí &amp; chuyển động</GroupTitle>
        <RangeField
          label="Hạt phim (grain)"
          value={Math.round((theme.grain ?? 0) * 100)}
          min={0}
          max={40}
          unit="%"
          onChange={(v) => set('grain')(v / 100)}
        />
        <RangeField
          label="Tốc độ animation"
          value={theme.animationSpeed}
          min={0.2}
          max={2.5}
          step={0.1}
          unit="×"
          onChange={set('animationSpeed')}
        />
        <SegField
          label="Quầng sáng theo con trỏ"
          value={theme.cursorGlow}
          options={[
            { id: 'on', label: 'Bật' },
            { id: 'off', label: 'Tắt' },
          ]}
          onChange={set('cursorGlow')}
        />
        <SegField
          label="Chế độ"
          value={theme.mode}
          options={[
            { id: 'dark', label: 'Tối' },
            { id: 'light', label: 'Sáng' },
          ]}
          onChange={set('mode')}
        />
      </div>
    </>
  );
}
