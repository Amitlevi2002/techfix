// GET /api/scan?url=example.co.il -> a short health report for a public website.
// The server fetches a URL someone typed, so every hop (including redirects) is checked against
// private and internal addresses first; otherwise this endpoint could be used to reach internal services (SSRF).
import { lookup } from 'node:dns/promises';
import { analyze, isPrivateAddress, normalizeUrl } from '../lib/scan-core.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 8000;

async function assertPublic(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addrs.length) throw Object.assign(new Error('לא מצאתי את הכתובת הזאת. אולי יש בה טעות?'), { code: 400 });
  if (addrs.some((a) => isPrivateAddress(a.address))) throw Object.assign(new Error('אפשר לבדוק רק אתרים ציבוריים.'), { code: 400 });
}

async function readCapped(res) {
  const reader = res.body?.getReader();
  if (!reader) return { text: '', bytes: 0 };
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > MAX_BYTES) { await reader.cancel(); break; }
    chunks.push(value);
  }
  return { text: new TextDecoder().decode(Buffer.concat(chunks)), bytes };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  let url = normalizeUrl(req.query?.url);
  if (!url) return res.status(400).json({ error: 'הכתובת לא נראית כמו אתר. נסה למשל example.co.il' });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const started = Date.now();
    let r;
    for (let hop = 0; ; hop++) {
      await assertPublic(url);
      r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'TechFix-SiteCheck/1.0 (+https://techfix-puce.vercel.app)' } });
      const loc = r.headers.get('location');
      if (r.status < 300 || r.status >= 400 || !loc) break;
      if (hop >= MAX_REDIRECTS) return res.status(400).json({ error: 'האתר מפנה יותר מדי פעמים.' });
      url = normalizeUrl(new URL(loc, url).href);
      if (!url) return res.status(400).json({ error: 'האתר מפנה לכתובת לא תקינה.' });
    }
    const ms = Date.now() - started;
    const { text, bytes } = await readCapped(r);
    return res.status(200).json(analyze({ finalUrl: url.href, status: r.status, ms, bytes, headers: r.headers, html: text }));
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'האתר לא ענה תוך 8 שניות.' });
    return res.status(e.code || 502).json({ error: e.code ? e.message : 'לא הצלחתי להתחבר לאתר.' });
  } finally {
    clearTimeout(timer);
  }
}
