export function clampPopup(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number): { left: number; top: number } {
  return { left: Math.max(8, Math.min(x, viewportWidth - width - 8)), top: Math.max(8, Math.min(y, viewportHeight - height - 8)) };
}

export function menuKeyIndex(key: string, index: number, count: number): number | null {
  if (!count) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowUp') return (index - 1 + count) % count;
  return null;
}
