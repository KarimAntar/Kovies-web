// Per-host request headers for stream providers (Referer / Origin / User-Agent).
//
// LIMITATION: headers are applied by EXACT hostname only. If a provider serves
// the manifest from one host and segments/keys from another, the renderer must
// call registerStreamHeaders() for each host (e.g. once with the manifest URL
// and once with a segment URL). Until then, requests to the unregistered host
// go out without the extra headers and playback may fail. Such requests are
// logged at debug level (KOVIES_DEBUG=1) as "host mismatch".

const ALLOWED = {
  referer: 'Referer',
  origin: 'Origin',
  'user-agent': 'User-Agent',
} as const;

type AllowedKey = keyof typeof ALLOWED;
export type StreamHeaders = Readonly<Partial<Record<(typeof ALLOWED)[AllowedKey], string>>>;

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_VALUE_LEN = 512;
const MAX_URL_LEN = 4096;
const MAX_HOSTS = 64;

interface Entry {
  readonly headers: StreamHeaders;
  readonly expiresAt: number;
}

export class StreamHeaderError extends Error {}

function parseHttpsUrl(value: string, what: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StreamHeaderError(`${what} is not a valid URL`);
  }
  if (url.protocol !== 'https:') throw new StreamHeaderError(`${what} must use https`);
  if (!url.hostname) throw new StreamHeaderError(`${what} has no host`);
  if (url.username || url.password) throw new StreamHeaderError(`${what} must not contain user credentials`);
  return url;
}

/** Validates renderer input. Throws StreamHeaderError on any violation. */
export function validateRegistration(
  streamUrl: unknown,
  headers: unknown,
): { host: string; headers: StreamHeaders } {
  if (typeof streamUrl !== 'string' || streamUrl.length === 0 || streamUrl.length > MAX_URL_LEN) {
    throw new StreamHeaderError('streamUrl must be a non-empty string');
  }
  const host = parseHttpsUrl(streamUrl, 'streamUrl').hostname.toLowerCase();

  if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
    throw new StreamHeaderError('headers must be a plain object');
  }
  const proto = Object.getPrototypeOf(headers);
  if (proto !== Object.prototype && proto !== null) {
    throw new StreamHeaderError('headers must be a plain object');
  }

  const out: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(headers)) {
    const key = rawKey.toLowerCase();
    if (!Object.hasOwn(ALLOWED, key)) throw new StreamHeaderError(`header not allowed: ${rawKey}`);
    if (typeof value !== 'string') throw new StreamHeaderError(`header ${rawKey} must be a string`);
    if (value.length === 0 || value.length > MAX_VALUE_LEN) {
      throw new StreamHeaderError(`header ${rawKey} must be 1-${MAX_VALUE_LEN} chars`);
    }
    if (/[\r\n\0]/.test(value)) throw new StreamHeaderError(`header ${rawKey} contains control characters`);

    const canonical = ALLOWED[key as AllowedKey];
    if (key === 'referer') {
      const refUrl = parseHttpsUrl(value, 'Referer');
      refUrl.hash = ''; // RFC 9110 §10.2: Referer must not include fragment
      out[canonical] = refUrl.toString();
    } else if (key === 'origin') {
      out[canonical] = parseHttpsUrl(value, 'Origin').origin;
    } else {
      out[canonical] = value;
    }
  }
  return { host, headers: Object.freeze(out) };
}

export class StreamHeaderStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  register(host: string, headers: StreamHeaders): void {
    this.entries.delete(host); // re-insert to refresh insertion order
    this.entries.set(host, { headers, expiresAt: this.now() + TTL_MS });
    while (this.entries.size > MAX_HOSTS) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** Headers for an exact hostname, or undefined when absent/expired. */
  get(hostname: string): StreamHeaders | undefined {
    const key = hostname.toLowerCase();
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.headers;
  }

  get size(): number {
    return this.entries.size;
  }
}
