import type { CSSProperties, ReactNode } from 'react';
import type { Block, Section } from '../../types';
import { BlockView } from './BlockView';
import { clamp } from '../../lib/factory';

type Vars = CSSProperties & Record<string, string | number>;

export interface SectionViewProps {
  section: Section;
  editable?: boolean;
  /** Thanh công cụ hiện phía trên section trong canvas admin. */
  toolbar?: ReactNode;
  /** Vùng "thêm khối" cuối section trong canvas admin. */
  footer?: ReactNode;
  /** Cho phép canvas bọc thêm chrome quanh từng khối. */
  renderBlock?: (block: Block, index: number) => ReactNode;
  onImageClick?: (block: Block) => void;
  className?: string;
}

export function SectionView({
  section,
  editable = false,
  toolbar,
  footer,
  renderBlock,
  onImageClick,
  className,
}: SectionViewProps) {
  const blocksStyle: Vars = {
    '--cols': clamp(section.columns ?? 12, 1, 12),
    '--gap': `${section.gap ?? 16}px`,
  };

  const classes = [
    'pf-section',
    section.background && section.background !== 'transparent' ? `pf-section--${section.background}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section id={'sec-' + section.id} data-section-id={section.id} className={classes}>
      {toolbar}
      <div className="pf-section__inner">
        {(section.heading || section.name) && (
          <div className="pf-section__head" data-anim="fade-up">
            {section.heading ? (
              <>
                {section.name && <div className="pf-section__eyebrow">{section.name}</div>}
                <h2 className="pf-section__title">{section.heading}</h2>
              </>
            ) : (
              <h2 className="pf-section__title">{section.name}</h2>
            )}
            {section.subheading && <p className="pf-section__sub">{section.subheading}</p>}
          </div>
        )}

        <div className={`pf-blocks pf-blocks--${section.layout || 'grid'}`} data-blocks-for={section.id} style={blocksStyle}>
          {/* renderBlock phải trả về .pf-block trực tiếp: CSS lưới dùng selector con trực tiếp */}
          {section.blocks.map((block, index) =>
            renderBlock ? (
              renderBlock(block, index)
            ) : (
              <BlockView key={block.id} block={block} editable={editable} onImageClick={onImageClick} />
            ),
          )}
        </div>

        {footer}
      </div>
    </section>
  );
}
