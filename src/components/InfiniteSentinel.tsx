import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

interface InfiniteSentinelProps {
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  onLoadMore: () => void;
}

/** Placed under a grid: loads the next page as it nears the viewport. */
export function InfiniteSentinel({ hasMore, loading, error, onLoadMore }: InfiniteSentinelProps) {
  // Pause auto-loading after a failure so a dead endpoint is not hammered; Retry resumes it.
  const sentinelRef = useInfiniteScroll({ onLoadMore, hasMore: hasMore && !error, isLoading: loading });

  return (
    <div className="mt-10 flex min-h-10 flex-col items-center justify-center gap-2 text-sm text-gray-400" aria-live="polite">
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      {loading && <Loader2 className="w-5 h-5 text-primary animate-spin" aria-label="Loading more" />}
      {error && !loading && (
        <p className="text-amber-400">
          Couldn’t load more.{' '}
          <button onClick={onLoadMore} className="font-semibold text-white underline underline-offset-2 hover:text-primary-hover transition-colors">
            Retry
          </button>
        </p>
      )}
      {!hasMore && !loading && !error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-gray-500">
          You’ve reached the end
        </motion.p>
      )}
    </div>
  );
}
