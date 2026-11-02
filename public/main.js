// Site checker and contact form. The page is complete without this file; it only adds behavior.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------- the remote session in the hero ---------- */
// A short scripted session: a print job is stuck, the cursor finds it, restarts the print service, and reports.
// The HTML already shows the fixed state, so with reduced motion (or no JS) nothing needs to happen.
(function session() {
  const screen = document.querySelector('.screen');
  if (!screen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const el = (id) => document.getElementById(id);
  const cursor = el('cursor'), toast = el('toast'), menu = el('menu'), progress = el('progress'), chat = el('chat'), timer = el('timer');
  const jobs = [el('job1-status'), el('job2-status'), el('job3-status')];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 }).observe(screen);

  // seconds shown on the session clock; it runs fast so the whole fix "takes" under two minutes
  let seconds = 0, clock;
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
  const status = (chip, cls, text) => { chip.className = `chip ${cls}`; chip.textContent = text; };
  const setToast = (cls, text) => { toast.className = `toast ${cls}`; toast.textContent = text; };

  function reset() {
    seconds = 0;
    tick();
    status(jobs[0], 'bad', 'שגיאה');
    status(jobs[1], 'wait', 'ממתין');
    status(jobs[2], 'wait', 'ממתין');
    setToast('bad', 'המדפסת לא מגיבה');
    menu.hidden = true;
    progress.hidden = true;
    progress.classList.remove('run');
    chat.classList.add('out');
    el('job1').classList.remove('hl');
    el('menu-item').classList.remove('hl');
    const s = screen.getBoundingClientRect();
    cursor.style.setProperty('--x', `${s.width * 0.2}px`);
    cursor.style.setProperty('--y', `${s.height * 0.85}px`);
  }

  async function play() {
    reset();
    clock = setInterval(tick, 300);
    await sleep(1400);
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
      status(chip, 'ok', 'הודפס');
      await sleep(380);
    }
    setToast('ok', 'המדפסת עובדת');
    clearInterval(clock);
    await moveTo(toast, 1.15, -0.6); // rest beside the toast, not on it
    chat.classList.remove('out');
    await sleep(5200);
  }

  moveTo(toast, 1.15, -0.6); // where the static (already fixed) scene leaves the cursor

  (async function loop() {
    for (;;) {
      if (visible && !document.hidden) await play();
      else await sleep(600);
    }
  })();
})();

/* ---------- site checker ---------- */
const scanForm = $('#scan');
const out = $('#scan-out');

scanForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = scanForm.url.value.trim();
  if (!url) return scanForm.url.focus();
  const btn = scanForm.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'בודק…';
  out.innerHTML = '';
  try {
    const r = await fetch('/api/scan?url=' + encodeURIComponent(url));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'הבדיקה נכשלה, נסה שוב.');
    render(data);
  } catch (err) {
    out.innerHTML = `<p class="scan-err">${esc(err.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'בדוק עכשיו';
  }
});

function render({ url, score, checks }) {
  const mark = (c) => (c.ok ? ['ok', '✓'] : c.warn ? ['warn', '!'] : ['bad', '✕']);
  const problems = checks.filter((c) => !c.ok).length;
  out.innerHTML = `
    <div class="score"><b>${score}</b><span>מתוך 100 · <span dir="ltr">${esc(url)}</span></span></div>
    <ul class="results">${checks.map((c) => {
      const [cls, sym] = mark(c);
      return `<li><span class="mark ${cls}" aria-label="${cls === 'ok' ? 'תקין' : cls === 'warn' ? 'כדאי לשפר' : 'בעיה'}">${sym}</span><div><b>${esc(c.title)}</b><p>${esc(c.detail)}</p></div></li>`;
    }).join('')}</ul>
    ${problems ? `<p class="scan-note">יש פה ${problems} דברים שאפשר לשפר. <a class="link" href="#contact">רוצה שאסתכל איתך?</a></p>` : ''}`;
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
    show('הבקשה נשלחה. אחזור אליך תוך 24 שעות.');
  } catch {
    show('השליחה נכשלה. אפשר לנסות שוב או לכתוב לי למייל.', true);
  } finally {
    btn.disabled = false;
  }
});
