import { useEffect } from 'react';

/**
 * Traps keyboard focus inside a container element while active.
 * Restores focus to the previously-focused element on deactivation.
 * Used by modal dialogs and drawer panels (WCAG 2.1 AA — 2.1.2 No Keyboard Trap).
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(
  active: boolean,
  ref: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;
    const trigger = document.activeElement as HTMLElement | null;

    const getItems = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        el => !el.closest('[aria-hidden="true"]'),
      );

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = getItems();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last  = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
    };
  }, [active, ref]);
}
