// Pure parts of the site checker: URL rules, private-address detection and the checks themselves.
// Kept free of network code so they can be tested directly.
import { isIP } from 'node:net';

export function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s || s.length > 2048) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  // a bare word like "localhost" or "intranet" has no public meaning
  if (!isIP(u.hostname.replace(/^\[|\]$/g, '')) && !u.hostname.includes('.')) return null;
  return u;
}

const v4 = (ip) => ip.split('.').map(Number);

/** True for addresses a public website can never live on: loopback, private ranges, link-local, cloud metadata, etc. */
export function isPrivateAddress(ip) {
  const fam = isIP(ip);
  if (fam === 4) {
    const [a, b] = v4(ip);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||   // carrier-grade NAT
      (a === 169 && b === 254) ||             // link-local, incl. 169.254.169.254 metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19));  // benchmarking
  }
  if (fam === 6) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return s === '::' || s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s);
  }
  return true; // not an IP at all: refuse rather than guess
}

const tag = (html, re) => (html.match(re) || [])[1]?.trim() ?? '';

// Attribute values may be double-quoted, single-quoted or bare (name=viewport); all three are valid HTML.
const ATTR = String.raw`(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`;
const attr = (m) => (m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : null);

/** The content of <meta name="..."> as a string, '' if it has none, null if the tag is missing. */
export function metaContent(html, name) {
  for (const t of html.match(/<meta\b[^>]*>/gi) || []) {
    if (attr(t.match(new RegExp(String.raw`\bname\s*=\s*` + ATTR, 'i')))?.toLowerCase() === name) {
      return attr(t.match(new RegExp(String.raw`\bcontent\s*=\s*` + ATTR, 'i'))) ?? '';
    }
  }
  return null;
}

/**
 * Turns one fetched page into a list of findings, worded for a non-technical owner.
 * page: { finalUrl, status, ms, bytes, headers: Headers-like with .get(), html }
 */
export function analyze(page) {
  const h = (k) => page.headers.get(k) || '';
  const html = page.html || '';
  const https = page.finalUrl.startsWith('https://');
  const title = tag(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = metaContent(html, 'description') ?? '';
  const viewport = metaContent(html, 'viewport') !== null;
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((t) => !/\balt\s*=/i.test(t)).length;
  const kb = Math.round(page.bytes / 1024);

  const checks = [
    { id: 'https', ok: https, title: 'חיבור מאובטח (HTTPS)',
      detail: https ? 'האתר נטען בחיבור מוצפן.' : 'האתר נטען בלי הצפנה. דפדפנים מסמנים אותו כ"לא מאובטח" וגוגל מוריד אותו בדירוג.' },
    { id: 'status', ok: page.status >= 200 && page.status < 300, title: 'האתר עונה',
      detail: page.status < 300 ? `קוד תשובה ${page.status}.` : `השרת החזיר קוד ${page.status}. מבקרים כנראה רואים שגיאה.` },
    { id: 'speed', ok: page.ms < 1500, warn: page.ms >= 1500 && page.ms < 3500, title: 'זמן תגובה של השרת',
      detail: `${(page.ms / 1000).toFixed(2)} שניות עד שהעמוד הגיע.${page.ms >= 1500 ? ' מעל שנייה וחצי מבקרים כבר מתחילים לעזוב.' : ''}` },
    { id: 'size', ok: kb < 600, warn: kb >= 600 && kb < 1500, title: 'משקל העמוד',
      detail: `${kb} KB של HTML.${kb >= 600 ? ' כבד יחסית, וזה מורגש בטלפון עם קליטה חלשה.' : ''}` },
    { id: 'mobile', ok: viewport, title: 'מותאם לנייד',
      detail: viewport ? 'מוגדר viewport, כך שהעמוד מתאים את עצמו למסך.' : 'אין הגדרת viewport. בטלפון האתר כנראה מוצג מוקטן ולא קריא.' },
    { id: 'title', ok: title.length >= 10 && title.length <= 65, warn: !!title, title: 'כותרת לגוגל',
      detail: title ? `"${title.slice(0, 80)}"${title.length > 65 ? ' (ארוכה מדי, גוגל יחתוך אותה)' : title.length < 10 ? ' (קצרה מדי)' : ''}` : 'אין כותרת לעמוד. זה הדבר הראשון שגוגל מציג.' },
    { id: 'description', ok: description.length >= 50 && description.length <= 170, warn: !!description, title: 'תיאור בתוצאות החיפוש',
      detail: description ? `${description.length} תווים.${description.length > 170 ? ' ארוך מדי.' : description.length < 50 ? ' קצר מדי.' : ''}` : 'אין תיאור. גוגל ימציא אחד מתוך הטקסט בעמוד.' },
    { id: 'h1', ok: h1 === 1, warn: h1 > 1, title: 'כותרת ראשית אחת',
      detail: h1 === 1 ? 'יש כותרת H1 אחת, כמו שצריך.' : h1 === 0 ? 'אין כותרת H1.' : `יש ${h1} כותרות H1, צריך אחת.` },
    { id: 'alt', ok: noAlt === 0, warn: noAlt > 0 && noAlt <= 3, title: 'תיאור לתמונות',
      detail: imgs.length === 0 ? 'אין תמונות בקוד העמוד.' : noAlt === 0 ? `לכל ${imgs.length} התמונות יש טקסט חלופי.` : `${noAlt} מתוך ${imgs.length} תמונות בלי טקסט חלופי (נגישות וגוגל תמונות).` },
    { id: 'hsts', ok: !!h('strict-transport-security'), warn: https, title: 'הגנת HSTS',
      detail: h('strict-transport-security') ? 'הדפדפן מחויב לחזור תמיד בחיבור מוצפן.' : 'חסרה כותרת Strict-Transport-Security.' },
    { id: 'frame', ok: !!h('x-frame-options') || /frame-ancestors/i.test(h('content-security-policy')), warn: true, title: 'הגנה מהטמעה באתר זר',
      detail: h('x-frame-options') || /frame-ancestors/i.test(h('content-security-policy')) ? 'האתר לא יכול להיטען בתוך מסגרת של אתר אחר.' : 'אפשר להטמיע את האתר בתוך אתר אחר (סיכון clickjacking).' },
  ];

  const score = Math.round((checks.reduce((s, c) => s + (c.ok ? 1 : c.warn ? 0.5 : 0), 0) / checks.length) * 100);
  return { url: page.finalUrl, score, checks };
}
