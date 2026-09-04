import type { ThemeConfig } from '../types';

/** Ghi cấu hình tone màu vào CSS variable (mặc định lên :root). */
export function applyTheme(theme: ThemeConfig | undefined, root: HTMLElement | null = document.documentElement) {
  if (!theme || !root) return;

  const vars: Record<string, string | number | undefined> = {
    '--c-primary': theme.primary,
    '--c-accent': theme.accent,
    '--c-bg': theme.background,
    '--c-surface': theme.surface,
    '--c-text': theme.text,
    '--c-muted': theme.muted,
    '--font-heading': theme.headingFont,
    '--font-body': theme.bodyFont,
    '--radius': `${theme.radius ?? 14}px`,
    '--grain-opacity': theme.grain ?? 0.05,
    '--anim-scale': theme.animationSpeed ?? 1,
  };

  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined && value !== null && value !== '') root.style.setProperty(key, String(value));
  }
  root.dataset.themeMode = theme.mode ?? 'dark';
}
