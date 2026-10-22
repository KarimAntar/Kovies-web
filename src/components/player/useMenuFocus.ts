import { useLayoutEffect, useRef } from 'react';
import { menuKeyIndex } from '../../lib/menuInteraction';

export function useMenuFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = () => Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    (root.querySelector<HTMLButtonElement>('[aria-checked="true"]') || buttons()[0] || root).focus();
    const contain = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) (buttons()[0] || root).focus();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); closeRef.current(); return;
      }
      const items = buttons();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Tab'
        ? (index + (event.shiftKey ? -1 : 1) + items.length) % items.length
        : menuKeyIndex(event.key, index, items.length);
      if (next !== null && items.length) { event.preventDefault(); event.stopPropagation(); items[next].focus(); }
    };
    const outsidePointer = (event: PointerEvent) => {
      if (root.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      // These listeners outlive the closing menu. Its pointerup and compatibility
      // click still belong to dismissal, even after React unmounts this effect.
      let released = false;
      const consume = (next: Event) => { next.preventDefault(); next.stopPropagation(); };
      const move = (next: PointerEvent) => { if (!released) consume(next); };
      const up = (next: PointerEvent) => {
        consume(next);
        if (next.pointerId === event.pointerId) released = true;
      };
      const down = (next: PointerEvent) => {
        if (released) finish();
        else consume(next);
      };
      const finish = () => {
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('pointerup', up, true);
        document.removeEventListener('pointercancel', cancel, true);
        document.removeEventListener('click', click, true);
        document.removeEventListener('pointerdown', down, true);
        window.removeEventListener('blur', finish);
      };
      const click = (next: MouseEvent) => {
        // Keyboard/assistive activation is independent of the pointer gesture.
        if (next.detail !== 0) consume(next);
        finish();
      };
      const cancel = (next: PointerEvent) => { consume(next); finish(); };
      document.addEventListener('pointermove', move, true);
      document.addEventListener('pointerup', up, true);
      document.addEventListener('pointercancel', cancel, true);
      document.addEventListener('click', click, true);
      // A drag need not generate click; release the guard on the next gesture.
      document.addEventListener('pointerdown', down, true);
      window.addEventListener('blur', finish);
      closeRef.current();
    };
    const outside = (event: MouseEvent) => {
      if (!root.contains(event.target as Node)) {
        // Consume the dismissing click so it cannot seek, toggle playback, or reopen the menu.
        event.preventDefault(); event.stopPropagation(); closeRef.current();
      }
    };
    document.addEventListener('focusin', contain);
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('pointerdown', outsidePointer, true);
    document.addEventListener('click', outside, true);
    return () => {
      document.removeEventListener('focusin', contain);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('pointerdown', outsidePointer, true);
      document.removeEventListener('click', outside, true);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return ref;
}
