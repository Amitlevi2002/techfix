/*
 * Site kit: accessibility menu, Hebrew/English switch, legal links and a privacy notice.
 * Each site sets window.SITE_KIT = { base: 'he' | 'en', dict: { source: translation }, name } before loading this file.
 * Translation works on what is on screen: text and labels are looked up with their numbers masked,
 * so "3 שעות פנויות" and "5 שעות פנויות" share one entry ("# שעות פנויות").
 */
(() => {
  const CFG = window.SITE_KIT || { base: 'he', dict: {} };
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* this visit only */ } },
  };
  const other = CFG.base === 'he' ? 'en' : 'he';
  const lang = store.get('site_lang') === other ? other : CFG.base;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'he' ? 'rtl' : 'ltr';
  const next = lang === 'he' ? 'en' : 'he';
  const T = (he, en) => (lang === 'he' ? he : en);

  /* ---------- translation ---------- */
  const NUM = /[₪$€]?(?:(?<![\u0590-\u05ff])-)?\d(?:[\d,.:/]*\d)?(?:\s?[₪%])?/g;
  const dict = new Map();
  for (const [k, v] of Object.entries(CFG.dict || {})) dict.set(k.trim(), v);
  // sentences glued together from parts fall back to their known phrases, longest first
  const HE = /[\u0590-\u05ff]/;
  const SRC = CFG.base === 'he' ? HE : /[A-Za-z]{2}/;
  const phrases = [...dict.keys()].filter((k) => !k.includes('#') && SRC.test(k)).sort((a, b) => b.length - a.length);
  const isLetter = (c) => c !== undefined && (CFG.base === 'he' ? /[\u05d0-\u05ea]/ : /[A-Za-z]/).test(c);
  function byPhrases(core) {
    let out = core;
    for (const k of phrases) {
      if (!SRC.test(out)) break;
      let at = out.indexOf(k);
      while (at !== -1) {
        if (!isLetter(out[at - 1]) && !isLetter(out[at + k.length])) out = out.slice(0, at) + dict.get(k) + out.slice(at + k.length);
        at = out.indexOf(k, at + 1);
      }
    }
    return out;
  }
  const seen = new Map();
  function translate(text) {
    const core = text.trim();
    if (!core) return text;
    if (seen.has(core)) return text.replace(core, seen.get(core));
    let out = dict.get(core);
    if (out === undefined) {
      const nums = core.match(NUM);
      const tpl = nums && dict.get(core.replace(NUM, '#'));
      if (tpl !== undefined && tpl !== null) {
        let i = 0;
        out = tpl.replace(/#/g, () => nums[i++] ?? '');
      } else out = SRC.test(core) ? byPhrases(core) : core;
    }
    if (seen.size < 5000) seen.set(core, out);
    return text.replace(core, out);
  }
  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  const skip = (el) => el && el.closest && el.closest('script,style,textarea,[data-no-translate]');
  function walk(node) {
    if (node.nodeType === 3) {
      if (!skip(node.parentElement)) {
        const t = translate(node.data);
        if (t !== node.data) node.data = t;
      }
      return;
    }
    if (node.nodeType !== 1 || skip(node)) return;
    for (const a of ATTRS) {
      const v = node.getAttribute(a);
      if (v) {
        const t = translate(v);
        if (t !== v) node.setAttribute(a, t);
      }
    }
    for (const c of node.childNodes) walk(c);
  }
  if (lang !== CFG.base) {
    const run = () => {
      walk(document.body);
      document.title = translate(document.title);
      new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === 'characterData') walk(m.target);
          else if (m.type === 'attributes') walk(m.target);
          else m.addedNodes.forEach(walk);
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run();
  }

  /* ---------- accessibility settings ---------- */
  const OPTS = [
    ['contrast', T('ניגודיות גבוהה', 'High contrast')],
    ['links', T('הדגשת קישורים', 'Highlight links')],
    ['readable', T('גופן קריא', 'Readable font')],
    ['calm', T('עצירת אנימציות', 'Stop animations')],
    ['gray', T('גווני אפור', 'Grayscale')],
  ];
  const saved = (() => { try { return JSON.parse(store.get('site_a11y')) || {}; } catch (e) { return {}; } })();
  function apply() {
    for (const [k] of OPTS) root.classList.toggle('kit-' + k, !!saved[k]);
    root.style.fontSize = saved.size ? 100 + saved.size * 12.5 + '%' : '';
    store.set('site_a11y', JSON.stringify(saved));
  }
  apply();

  const css = `
  .kit-skip{position:fixed;z-index:100000;inset-inline-start:8px;top:-60px;background:#111;color:#fff;padding:10px 14px;font:600 15px system-ui,sans-serif;text-decoration:none}
  .kit-skip:focus{top:8px}
  :focus-visible{outline:3px solid #1565c0!important;outline-offset:2px!important;box-shadow:0 0 0 2px #fff}
  .kit-btn{position:fixed;z-index:99990;right:0;bottom:128px;width:44px;height:44px;border:0;background:#0b57d0;color:#fff;display:grid;place-items:center;cursor:pointer;border-radius:8px 0 0 8px;padding:0}
  .kit-btn svg{width:26px;height:26px;fill:currentColor}
  .kit-panel{position:fixed;z-index:99991;right:0;bottom:8px;width:min(290px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;background:#fff;color:#111;border:1px solid #999;box-shadow:0 12px 40px rgba(0,0,0,.35);font:400 16px/1.4 system-ui,"Segoe UI",Arial,sans-serif;padding:14px;direction:inherit;text-align:start}
  .kit-panel h2{margin:0 0 10px;font-size:18px;font-weight:700;color:#111}
  .kit-panel button,.kit-panel a{font:inherit;color:#111}
  .kit-row{display:flex;gap:6px;margin-bottom:8px}
  .kit-panel button.kit-o{display:block;width:100%;min-height:44px;margin-bottom:6px;background:#f1f1f1;border:1px solid #777;text-align:start;padding:8px 10px;cursor:pointer}
  .kit-row button.kit-o{margin:0}
  .kit-panel button.kit-o[aria-pressed=true]{background:#0b57d0;color:#fff;border-color:#0b57d0}
  .kit-panel .kit-links{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:15px}
  .kit-panel .kit-links a{text-decoration:underline;padding:4px 0}
  .kit-lang{position:fixed;z-index:99990;right:0;bottom:80px;width:44px;height:44px;border:0;background:#111;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer;border-radius:8px 0 0 8px;padding:0}
  .kit-note{position:fixed;z-index:99989;inset-inline:8px;bottom:8px;max-width:560px;margin-inline:auto;background:#111;color:#fff;padding:12px 14px;display:flex;gap:12px;align-items:center;font:400 14px/1.45 system-ui,"Segoe UI",Arial,sans-serif;text-align:start}
  .kit-note a{color:#fff;text-decoration:underline}
  .kit-note button{flex:none;min-height:40px;padding:0 14px;background:#fff;color:#111;border:0;font:700 14px system-ui,sans-serif;cursor:pointer}
  .kit-foot{padding:18px 16px 96px;text-align:center;font:400 14px/1.8 system-ui,"Segoe UI",Arial,sans-serif;color:#333;background:#fff;direction:inherit}
  .kit-foot a{color:#111;text-decoration:underline;margin:0 8px;white-space:nowrap}
  html.kit-gray body>*{filter:grayscale(1)}
  html.kit-links a{text-decoration:underline!important;outline:2px solid #b00020!important;outline-offset:1px}
  html.kit-readable,html.kit-readable *:not(svg):not(path){font-family:Arial,"Arial Hebrew",sans-serif!important;letter-spacing:normal!important}
  html.kit-calm *,html.kit-calm *::before,html.kit-calm *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  html.kit-contrast body,html.kit-contrast body *:not(svg):not(path):not(img):not(canvas):not(.kit-btn):not(.kit-lang):not(.kit-panel):not(.kit-panel *){background-color:#000!important;background-image:none!important;color:#fff!important;border-color:#fff!important;text-shadow:none!important;box-shadow:none!important}
  html.kit-contrast a{color:#ffeb3b!important}
  html.kit-contrast svg{color:#fff}`;

  function ui() {
    if (CFG.legalPage) {
      const h = document.querySelector(`.doc[data-l=${lang}] h1`);
      if (h) document.title = h.textContent;
    }
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    const main = document.querySelector('main,[role=main],#root,#app');
    if (main) {
      if (!main.id) main.id = 'kit-main';
      main.setAttribute('tabindex', '-1');
      const sk = document.createElement('a');
      sk.className = 'kit-skip';
      sk.href = '#' + main.id;
      sk.textContent = T('דלג לתוכן', 'Skip to content');
      sk.setAttribute('data-no-translate', '');
      document.body.prepend(sk);
    }

    const box = document.createElement('div');
    box.setAttribute('data-no-translate', '');
    const links = `<a href="/accessibility.html">${T('הצהרת נגישות', 'Accessibility statement')}</a><a href="/privacy.html">${T('מדיניות פרטיות', 'Privacy policy')}</a><a href="/terms.html">${T('תנאי שימוש', 'Terms of use')}</a>`;
    box.innerHTML = `<button type="button" class="kit-btn" aria-expanded="false" aria-controls="kit-panel" aria-label="${T('תפריט נגישות', 'Accessibility menu')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm9 5.5-6 1.2V13l2 8h-2l-2.2-7h-1.6L9 21H7l2-8V8.7L3 7.5l.4-1.9c2.8.7 5.7 1.1 8.6 1.1s5.8-.4 8.6-1.1l.4 1.9Z"/></svg></button>
      <button type="button" class="kit-lang" lang="${next}" aria-label="${next === 'en' ? 'Switch to English' : 'החלפה לעברית'}">${next === 'en' ? 'EN' : 'עב'}</button>
      <div class="kit-panel" id="kit-panel" role="dialog" aria-label="${T('תפריט נגישות', 'Accessibility menu')}" hidden>
        <h2>${T('נגישות', 'Accessibility')}</h2>
        <div class="kit-row"><button type="button" class="kit-o" data-size="1">${T('הגדלת טקסט', 'Larger text')}</button><button type="button" class="kit-o" data-size="-1">${T('הקטנת טקסט', 'Smaller text')}</button></div>
        ${OPTS.map(([k, l]) => `<button type="button" class="kit-o" data-opt="${k}" aria-pressed="${!!saved[k]}">${l}</button>`).join('')}
        <button type="button" class="kit-o" data-reset>${T('איפוס', 'Reset')}</button>
        <button type="button" class="kit-o" data-close>${T('סגירה', 'Close')}</button>
        <div class="kit-links">${links}</div>
      </div>`;
    document.body.appendChild(box);
    const btn = box.querySelector('.kit-btn'), panel = box.querySelector('.kit-panel');
    const toggle = (open) => {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      (open ? panel.querySelector('button') : btn).focus();
    };
    btn.onclick = () => toggle(panel.hidden);
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggle(false);
    });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.size) saved.size = Math.max(-1, Math.min(4, (saved.size || 0) + +b.dataset.size));
      if (b.dataset.opt) {
        saved[b.dataset.opt] = !saved[b.dataset.opt];
        b.setAttribute('aria-pressed', String(saved[b.dataset.opt]));
      }
      if ('reset' in b.dataset) {
        for (const k of Object.keys(saved)) delete saved[k];
        panel.querySelectorAll('[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      }
      if ('close' in b.dataset) return toggle(false);
      apply();
    });
    box.querySelector('.kit-lang').onclick = () => {
      store.set('site_lang', next);
      location.reload();
    };

    // legal links at the bottom of every page, and a one-time privacy notice
    if (!CFG.legalPage) {
      const foot = document.createElement('footer');
      foot.className = 'kit-foot';
      foot.setAttribute('data-no-translate', '');
      foot.innerHTML = links;
      document.body.appendChild(foot);
      if (!store.get('site_notice')) {
        const n = document.createElement('div');
        n.className = 'kit-note';
        n.setAttribute('role', 'status');
        n.setAttribute('data-no-translate', '');
        n.innerHTML = `<span>${CFG.note ? CFG.note[lang] : T('האתר שומר העדפות ונתוני דמו בדפדפן שלך, ולא משתמש בעוגיות פרסום או מעקב.', 'This site keeps preferences and demo data in your browser. It uses no advertising or tracking cookies.')} <a href="/privacy.html">${T('פרטים', 'Details')}</a></span><button type="button">${T('הבנתי', 'Got it')}</button>`;
        n.querySelector('button').onclick = () => {
          store.set('site_notice', '1');
          n.remove();
        };
        document.body.appendChild(n);
      }
    }
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ui) : ui();
})();
