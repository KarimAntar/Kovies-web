import type { VercelRequest, VercelResponse } from '@vercel/node';

// Disable automatic parsing so the 64 KiB cap is enforced while reading.
export const config = { api: { bodyParser: false } };
const UPSTREAM = 'https://kovies.kerix.tech/api/';
const BODY_LIMIT = 64 * 1024;
const SINGLE_PATHS = new Set(['home', 'trending', 'search', 'health']);
const PREFIXES = ['catalog/', 'movies/', 'tv/', 'sources/', 'subtitles/', 'ratings/', 'auth/', 'user/'];

class RequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function parseTarget(req: VercelRequest): { path: string; search: string } {
  let path = '';
  let search = '';

  const rawUrl = req.url || '';
  const qIndex = rawUrl.indexOf('?');
  const pathname = qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl;
  const urlSearch = qIndex >= 0 ? rawUrl.slice(qIndex) : '';

  // 1. Direct path from raw URL if it contains /api/k/...
  const prefix = '/api/k/';
  const idx = pathname.indexOf(prefix);
  if (idx >= 0) {
    const candidate = pathname.slice(idx + prefix.length);
    // Ignore Vercel internal rewritten wildcard filenames like [...path]
    if (candidate && !candidate.startsWith('[...')) {
      path = candidate;
      search = urlSearch;
    }
  }

  // 2. Fallback to Vercel query.path (from file name [...path].ts)
  if (!path && req.query && req.query.path) {
    const rawPath = req.query.path;
    path = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath);

    // Build search string from remaining query parameters
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue;
      if (Array.isArray(v)) {
        for (const item of v) q.append(k, item);
      } else if (v !== undefined) {
        q.append(k, String(v));
      }
    }
    const s = q.toString();
    search = s ? `?${s}` : '';
  }

  // If path is still empty and url had query string
  if (!search && urlSearch) {
    search = urlSearch;
  }

  // Clean trailing slashes
  path = path.replace(/^\/+|\/+$/g, '');

  if (!path || !/^[A-Za-z0-9_./-]+$/.test(path) || path.split('/').some((s) => !s || s === '.' || s === '..')) {
    throw new RequestError(400, 'Invalid API path');
  }

  if (!SINGLE_PATHS.has(path) && !PREFIXES.some((p) => path.startsWith(p))) {
    throw new RequestError(400, 'Invalid API path');
  }

  return { path, search };
}

async function jsonBody(req: VercelRequest): Promise<string> {
  if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] ?? ''))) {
    throw new RequestError(415, 'Content-Type must be application/json');
  }
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > BODY_LIMIT) throw new RequestError(413, 'Request body too large');
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > BODY_LIMIT) throw new RequestError(413, 'Request body too large');
    chunks.push(bytes);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
  } catch {
    throw new RequestError(400, 'Invalid JSON body');
  }
  return body;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<unknown> {
  // Never cache user data, JWTs, or signed source URLs at a shared edge cache.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const key = process.env.KOVIES_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server misconfigured' });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { path, search } = parseTarget(req);
    const method = req.method ?? 'GET';
    if (
      !['GET', 'POST', 'PUT', 'DELETE'].includes(method) ||
      (['POST', 'PUT'].includes(method) && !path.startsWith('auth/') && !path.startsWith('user/'))
    ) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = method === 'POST' || method === 'PUT' ? await jsonBody(req) : undefined;
    const headers: Record<string, string> = { 'X-API-Key': key };
    if (typeof req.headers.authorization === 'string') headers.Authorization = req.headers.authorization;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), path.startsWith('sources/') ? 80_000 : 15_000);
    const upstream = await fetch(`${UPSTREAM}${path}${search}`, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: controller.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return res.status(502).json({ error: 'Upstream redirect refused' });
    }
    // Only explicitly approved response headers are copied; Set-Cookie is never forwarded.
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (upstream.status === 204) return res.status(204).end();
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    return res.status(upstream.status).send(responseBody);
  } catch (err) {
    if (err instanceof RequestError) return res.status(err.status).json({ error: err.message });
    // Do not expose upstream URLs, tokens, headers or internal fetch errors.
    return res.status(502).json({ error: 'Upstream unavailable or timed out' });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
