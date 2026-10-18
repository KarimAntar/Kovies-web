// Session-level request hooks: API key injection, per-host stream headers and
// CORS allowance for the app:// origin on hosts we explicitly trust.
import type { OnBeforeSendHeadersListenerDetails, OnHeadersReceivedListenerDetails, Session } from 'electron';
import { API_HOST, APP_ORIGIN } from '../shared/channels';
import { log } from './log';
import type { StreamHeaderStore } from './streamHeaders';

// Replaced at build time by scripts/build.mjs (from env KOVIES_API_KEY).
// Present only in the main-process bundle. Never log it.
declare const __KOVIES_API_KEY__: string;
const API_KEY: string = typeof __KOVIES_API_KEY__ === 'string' ? __KOVIES_API_KEY__ : '';

export const hasApiKey = (): boolean => API_KEY.length > 0;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isApiUrl(u: URL): boolean {
  return u.protocol === 'https:' && u.hostname === API_HOST && u.port === '';
}

/** Sets a header, removing any existing entry that differs only in case. */
function setHeader(headers: Record<string, string | string[]>, name: string, value: string | string[]): void {
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) delete headers[k];
  }
  headers[name] = value;
}

/** Public read-only APIs the renderer calls directly whose CORS policy excludes app://kovies. */
const PUBLIC_GET_HOSTS = new Set(['api.introdb.app']);

const STREAM_RESOURCE_TYPES = new Set(['media', 'xhr', 'fetch']);

export function installNetworkHooks(ses: Session, streams: StreamHeaderStore): void {
  ses.webRequest.onBeforeSendHeaders(
    { urls: ['https://*/*'] },
    (details: OnBeforeSendHeadersListenerDetails, callback) => {
      const u = parse(details.url);
      if (!u || u.protocol !== 'https:') return callback({});
      const requestHeaders = { ...details.requestHeaders } as Record<string, string | string[]>;

      // Ensure X-API-Key and stream headers do not leak across redirects to untrusted hosts
      if (isApiUrl(u)) {
        if (API_KEY) setHeader(requestHeaders, 'X-API-Key', API_KEY);
      } else {
        setHeader(requestHeaders, 'X-API-Key', '');
        delete (requestHeaders as Record<string, unknown>)['X-API-Key'];
      }

      const extra = streams.get(u.hostname);
      if (extra) {
        for (const [name, value] of Object.entries(extra)) {
          if (typeof value === 'string') setHeader(requestHeaders, name, value);
        }
      } else {
        // Strip custom stream headers on redirect to unregistered hosts
        delete (requestHeaders as Record<string, unknown>)['Referer'];
        delete (requestHeaders as Record<string, unknown>)['Origin'];
        if (streams.size > 0 && STREAM_RESOURCE_TYPES.has(details.resourceType)) {
          log.debug('stream header host mismatch (not registered):', u.hostname);
        }
      }

      return callback({ requestHeaders: requestHeaders as Record<string, string> });
    },
  );

  // The renderer's origin is app://kovies, which the API and stream hosts do
  // not list in Access-Control-Allow-Origin. Allow it only for the API host
  // and explicitly registered stream hosts.
  ses.webRequest.onHeadersReceived({ urls: ['https://*/*'] }, (details: OnHeadersReceivedListenerDetails, callback) => {
    const u = parse(details.url);
    const isApi = u !== null && isApiUrl(u);
    const isStream = u !== null && u.protocol === 'https:' && streams.get(u.hostname) !== undefined;
    const isPublicGet = u !== null && u.protocol === 'https:' && u.port === '' && PUBLIC_GET_HOSTS.has(u.hostname);
    if (!isApi && !isStream && !isPublicGet) return callback({});

    const responseHeaders = { ...(details.responseHeaders ?? {}) };
    setHeader(responseHeaders, 'Access-Control-Allow-Origin', [APP_ORIGIN]);
    if (isApi) {
      setHeader(responseHeaders, 'Access-Control-Allow-Headers', ['Content-Type, Authorization, X-API-Key']);
      setHeader(responseHeaders, 'Access-Control-Allow-Methods', ['GET, POST, PUT, DELETE, OPTIONS']);
    } else if (isPublicGet && !isStream) {
      setHeader(responseHeaders, 'Access-Control-Allow-Methods', ['GET, OPTIONS']);
    } else if (isStream) {
      setHeader(responseHeaders, 'Access-Control-Allow-Headers', ['*']);
      setHeader(responseHeaders, 'Access-Control-Allow-Methods', ['GET, HEAD, OPTIONS']);
    }
    const varyKey = Object.keys(responseHeaders).find((k) => k.toLowerCase() === 'vary');
    if (!varyKey) responseHeaders.Vary = ['Origin'];

    const isPreflight = details.method === 'OPTIONS';
    return callback({
      responseHeaders,
      ...(isPreflight && details.statusCode >= 400 ? { statusLine: 'HTTP/1.1 204 No Content' } : {}),
    });
  });
}
