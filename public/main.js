// Site checker and contact form. The page is complete without this file; it only adds behavior.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

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
