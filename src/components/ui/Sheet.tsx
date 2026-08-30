import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconBtn } from './index';
import { useDismiss } from '@/lib/hooks';
import { useI18n } from '@/i18n';

/**
 * A detail surface that adapts to the screen: a right-hand inspector on a
 * wide display, where it sits beside the chain rather than covering it, and a
 * bottom sheet on a phone, where reaching the top of the screen is awkward.
 * Both are the same component, because the content is identical — only the
 * gesture the user expects differs.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useDismiss<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="sheet-scrim">
      <div className="sheet" ref={ref} role="dialog" aria-modal="true">
        <div className="sheet-grab only-mobile" aria-hidden="true" />
        <div className="sheet-head">
          <div className="stack" style={{ gap: 3, minWidth: 0 }}>
            <div className="h-section">{title}</div>
            {subtitle && <div className="t-xs muted-3">{subtitle}</div>}
          </div>
          <IconBtn icon="close" onClick={onClose} title={t('g.close')} />
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
