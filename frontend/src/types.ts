/** Các kiểu dữ liệu khớp với model của Portfolio.Api (JSON camelCase). */

export type BlockType = 'image' | 'text' | 'quote' | 'video' | 'spacer';
export type LayoutType = 'grid' | 'masonry' | 'justified' | 'carousel';
export type CaptionStyle = 'below' | 'overlay' | 'hover' | 'none';
export type HoverEffect = 'none' | 'zoom' | 'lift' | 'tilt' | 'reveal';
export type SectionBackground = 'transparent' | 'surface' | 'accent';
export type Align = 'left' | 'center' | 'right';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Block {
  id: string;
  type: BlockType;

  colSpan: number;
  aspectRatio: number;
  fit: 'cover' | 'contain';
  focusX: number;
  focusY: number;
  radius: number | null;

  src: string | null;
  alt: string;
  crop: CropRect | null;

  title: string | null;
  body: string | null;
  align: Align;
  titleSize: number;
  bodySize: number;
  color: string | null;
  caption: string;
  captionStyle: CaptionStyle;

  animation: string;
  delay: number;
  duration: number;
  hover: HoverEffect;
  parallax: number;
  link: string | null;
}

export interface Section {
  id: string;
  name: string;
  heading: string | null;
  subheading: string | null;
  layout: LayoutType;
  columns: number;
  gap: number;
  background: SectionBackground;
  visible: boolean;
  blocks: Block[];
}

export interface ThemeConfig {
  mode: 'dark' | 'light';
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
  grain: number;
  cursorGlow: 'on' | 'off';
  animationSpeed: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: string;
  description: string;
  includes: string[];
  featured: boolean;
}

export interface SiteMeta {
  title: string;
  tagline: string;
  logoText: string;
  heroHeadline: string;
  heroSub: string;
  heroImage: string | null;
  heroCtaText: string;
  heroCtaLink: string;
  about: string;
  aboutImage: string | null;
  email: string;
  phone: string;
  address: string;
  instagram: string;
  facebook: string;
  behance: string;
  services: ServiceItem[];
  footerNote: string;
}

export interface SiteConfig {
  theme: ThemeConfig;
  site: SiteMeta;
  sections: Section[];
  updatedAt: string;
  revision: number;
}

export interface MediaItem {
  id: string;
  fileName: string;
  url: string;
  thumbUrl: string | null;
  size: number;
  width: number;
  height: number;
  contentType: string;
  uploadedAt: string;
  tags: string[];
}

export interface HistoryEntry {
  file: string;
  savedAt: string;
  size: number;
}

export type DeviceName = 'desktop' | 'tablet' | 'mobile';
