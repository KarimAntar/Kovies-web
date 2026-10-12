const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const FALLBACK_POSTER = '/kovies-symbol.png';
export const FALLBACK_BACKDROP = '/kovies-logo.png';

/**
 * Normalise an image reference that may be a full URL (API "poster" fields) or
 * a raw TMDB path (API "poster_path" fields, history/watchlist records).
 */
export function imageUrl(
  value: string | null | undefined,
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${TMDB_IMAGE_BASE}/${size}${value}`;
  return null;
}

export function firstImage(
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'original',
  ...values: Array<string | null | undefined>
): string | null {
  for (const v of values) {
    const url = imageUrl(v, size);
    if (url) return url;
  }
  return null;
}
