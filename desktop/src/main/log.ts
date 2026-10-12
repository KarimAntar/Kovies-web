// Minimal logger. Debug output only when KOVIES_DEBUG=1.
// Never pass secrets (API key, header values) to these functions.

const debugEnabled = process.env.KOVIES_DEBUG === '1';

export const log = {
  debug: (...args: unknown[]): void => {
    if (debugEnabled) console.debug('[kovies]', ...args);
  },
  info: (...args: unknown[]): void => console.info('[kovies]', ...args),
  warn: (...args: unknown[]): void => console.warn('[kovies]', ...args),
  error: (...args: unknown[]): void => console.error('[kovies]', ...args),
};
