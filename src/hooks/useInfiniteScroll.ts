import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions {
  /** Called when the sentinel comes within the preload margin of the viewport. */
  onLoadMore: () => void;
  /** False once the last page has been loaded (or loading is paused after an error). */
  hasMore: boolean;
  /** True while a page request is in flight. */
  isLoading: boolean;
}

/**
 * Returns a callback ref for a sentinel element placed below a grid. When the
 * sentinel enters the viewport (plus a 800px preload margin) `onLoadMore` fires.
 *
 * The observer is rebuilt whenever `isLoading` flips back to false, so a
 * sentinel that is still visible after a page lands triggers the next page.
 */
export function useInfiniteScroll({ onLoadMore, hasMore, isLoading }: UseInfiniteScrollOptions) {
  const [node, setNode] = useState<Element | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  useEffect(() => {
    if (!node || !hasMore || isLoading) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current();
      },
      { rootMargin: '800px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, hasMore, isLoading]);

  return useCallback((el: Element | null) => setNode(el), []);
}
