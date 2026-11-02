// Motion and the two tools on the page. The HTML is complete without this file; it only adds behaviour.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- header clock ---------- */
const clock = $('#clock');
const tickClock = () => { clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
tickClock();
setInterval(tickClock, 20000);

/* ---------- headline decodes itself, letter by letter ---------- */
// Random glyphs settle into the real text from the start of the line, like a terminal resolving.
function decode(el, delay) {
  const target = el.textContent;
  const glyphs = 'אבגדהוזחטיכלמנסעפצקרשת#%&@$*/<>01';
  let frame = 0;
  const total = target.length * 3 + 10;
  el.textContent = target.replace(/\S/g, () => glyphs[(Math.random() * glyphs.length) | 0]);
  setTimeout(function step() {
    const settled = Math.floor((frame / total) * target.length * 1.15);
    el.textContent = [...target].map((ch, i) => (ch === ' ' || i < settled ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join('');
    if (++frame <= total) requestAnimationFrame(() => setTimeout(step, 28));
    else el.textContent = target;
  }, delay);
}
if (!calm) document.querySelectorAll('[data-decode]').forEach((el, i) => decode(el, 150 + i * 380));

/* ---------- custom cursor ---------- */
const cur = $('.cur');
if (cur && matchMedia('(pointer: fine)').matches && !calm) {
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; cur.classList.add('live'); });
  (function follow() {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    cur.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(follow);
  })();
  document.addEventListener('pointerover', (e) => cur.classList.toggle('big', !!e.target.closest('a, button, .svc li, input, select, textarea')));
} else if (cur) cur.remove();

/* ---------- marquee speeds up with scrolling ---------- */
const track = $('.track');
if (track && !calm) {
  let last = scrollY, boost = 0;
  const anim = () => track.getAnimations()[0];
  addEventListener('scroll', () => { boost = Math.min(8, boost + Math.abs(scrollY - last) / 40); last = scrollY; }, { passive: true });
  (function ease() {
    boost *= 0.92;
    const a = anim();
    if (a) a.playbackRate = 1 + boost;
    requestAnimationFrame(ease);
  })();
}

/* ---------- footer barcode (Code-39-ish stripes from the brand name) ---------- */
(function barcode() {
  const svg = $('#barcode');
  if (!svg) return;
  let x = 0, bars = '';
  for (const ch of 'TECHFIX-AMIT-LEVI-2026') {
    const code = ch.charCodeAt(0);
    for (let b = 0; b < 7; b++) {
      const w = ((code >> b) & 1) + 1;
      if (b % 2 === 0) bars += `<rect x="${x}" y="0" width="${w * 0.9}" height="40"/>`;
      x += w;
    }
    x += 1.5;
  }
  svg.setAttribute('viewBox', `0 0 ${x} 40`);
  svg.innerHTML = bars;
})();

/* ---------- the remote session in the hero ---------- */
// A short scripted session: a print job is stuck, the cursor finds it, restarts the print service, and reports.
// When it's done the "fixed" stamp slams onto the ticket. The HTML already shows the fixed state.
(function session() {
  const screen = $('.screen');
  if (!screen || calm) return;

  const el = (id) => document.getElementById(id);
  const cursor = el('cursor'), toast = el('toast'), menu = el('menu'), progress = el('progress'), chat = el('chat'), timer = el('timer');
  const stamp = el('stamp'), status = el('st'), hero = $('.hero');
  const jobs = [el('job1-status'), el('job2-status'), el('job3-status')];

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 }).observe(screen);

  let seconds = 0, clockId;
  const tick = () => { seconds += 3; timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };

  function moveTo(target, dx = 0.35, dy = 0.5) {
    const s = screen.getBoundingClientRect(), r = target.getBoundingClientRect();
    cursor.style.setProperty('--x', `${r.left - s.left + r.width * dx}px`);
    cursor.style.setProperty('--y', `${r.top - s.top + r.height * dy}px`);
    return sleep(950);
  }
  async function click() {
    cursor.classList.add('click');
    await sleep(140);
    cursor.classList.remove('click');
  }
  const setChip = (chip, cls, text) => { chip.className = `chip ${cls}`; chip.textContent = text; };
  const setToast = (cls, text) => { toast.className = `toast ${cls}`; toast.textContent = text; };

  function reset() {
    seconds = 0;
    tick();
    setChip(jobs[0], 'bad', 'שגיאה');
    setChip(jobs[1], 'wait', 'ממתין');
    setChip(jobs[2], 'wait', 'ממתין');
    setToast('bad', 'המדפסת לא מגיבה');
    menu.hidden = true;
    progress.hidden = true;
    progress.classList.remove('run');
    chat.classList.add('out');
    stamp.classList.remove('on', 'slam');
    status.textContent = 'בטיפול';
    status.classList.remove('done');
    el('job1').classList.remove('hl');
    el('menu-item').classList.remove('hl');
    const s = screen.getBoundingClientRect();
    cursor.style.setProperty('--x', `${s.width * 0.2}px`);
    cursor.style.setProperty('--y', `${s.height * 0.85}px`);
  }

  async function play() {
    reset();
    clockId = setInterval(tick, 300);
    await sleep(1600);
    await moveTo(el('job1'), 0.3);
    el('job1').classList.add('hl');
    await click();
    menu.hidden = false;
    await sleep(500);
    await moveTo(el('menu-item'), 0.5);
    el('menu-item').classList.add('hl');
    await click();
    await sleep(200);
    menu.hidden = true;
    setToast('bad out', toast.textContent);
    progress.hidden = false;
    requestAnimationFrame(() => progress.classList.add('run'));
    await sleep(1500);
    progress.hidden = true;
    el('job1').classList.remove('hl');
    for (const chip of jobs) {
      setChip(chip, 'ok', 'הודפס');
      await sleep(320);
    }
    setToast('ok', 'המדפסת עובדת');
    clearInterval(clockId);
    await moveTo(toast, 1.15, -0.6);
    // the payoff: stamp the ticket
    stamp.classList.add('on', 'slam');
    hero.classList.remove('shake');
    void hero.offsetWidth;
    hero.classList.add('shake');
    status.textContent = 'תוקן';
    status.classList.add('done');
    await sleep(500);
    chat.classList.remove('out');
    await sleep(6000);
  }

  cursor.style.left = cursor.style.top = '0';
  moveTo(toast, 1.15, -0.6);
  (async function loop() {
    await sleep(2400); // let the headline finish decoding first
    for (;;) {
      if (visible && !document.hidden) await play();
      else await sleep(600);
    }
  })();
})();

/* ---------- site checker: results print like a diagnostic log ---------- */
const scanForm = $('#scan');
const out = $('#scan-out');

scanForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = scanForm.url.value.trim();
  if (!url) return scanForm.url.focus();
  const btn = scanForm.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'סורק…';
  out.innerHTML = `<p>&gt; מתחבר ל-<span dir="ltr">${esc(url)}</span></p><div class="bar"><i></i></div>`;
  try {
    const r = await fetch('/api/scan?url=' + encodeURIComponent(url));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'האבחון נכשל, נסה שוב.');
    render(data);
  } catch (err) {
    out.innerHTML = `<p class="scan-err">&gt; ${esc(err.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'הרץ אבחון';
  }
});

function render({ url, score, checks }) {
  const mark = (c) => (c.ok ? ['ok', '✓'] : c.warn ? ['warn', '!'] : ['bad', '✕']);
  const problems = checks.filter((c) => !c.ok).length;
  out.innerHTML = `
    <div class="score"><b id="score-n">0</b><span>/100 · <span dir="ltr">${esc(url)}</span></span></div>
    <ul class="results">${checks.map((c, i) => {
      const [cls, sym] = mark(c);
      return `<li style="animation-delay:${i * 110}ms"><span class="mark ${cls}" aria-label="${cls === 'ok' ? 'תקין' : cls === 'warn' ? 'כדאי לשפר' : 'בעיה'}">${sym}</span><div><b>${esc(c.title)}</b><p>${esc(c.detail)}</p></div></li>`;
    }).join('')}</ul>
    ${problems ? `<p class="scan-note">${problems} דברים לשפר. <a href="#contact">רוצה שאסתכל איתך?</a></p>` : ''}`;
  // count the score up
  const n = $('#score-n');
  if (calm) { n.textContent = score; return; }
  const t0 = performance.now();
  (function count(t) {
    const k = Math.min(1, (t - t0) / 900);
    n.textContent = Math.round(score * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(count);
  })(t0);
}

/* ---------- contact form ---------- */
const form = $('#contact-form');
const msg = $('#form-msg');

function show(text, isError) {
  msg.hidden = false;
  msg.textContent = text;
  msg.classList.toggle('err', !!isError);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  if (form._gotcha.value) return; // bots fill the hidden field
  const data = Object.fromEntries(new FormData(form));
  delete data._gotcha;

  const endpoint = form.dataset.endpoint;
  if (!endpoint) {
    // No form service configured: hand the message to the visitor's own mail app.
    const body = `שם: ${data.name}\nטלפון: ${data.phone}\nנושא: ${data.topic}\nמתי לחזור: ${data.when}\n\n${data.message || ''}`;
    location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent('פנייה מהאתר: ' + data.topic)}&body=${encodeURIComponent(body)}`;
    show('נפתחה הודעת מייל מוכנה. נשאר רק לשלוח אותה.');
    return;
  }

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error();
    form.reset();
    show('הכרטיס נפתח. אחזור אליך תוך 24 שעות.');
  } catch {
    show('השליחה נכשלה. אפשר לנסות שוב או לכתוב לי למייל.', true);
  } finally {
    btn.disabled = false;
  }
});
