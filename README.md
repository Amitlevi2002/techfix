# TechFix

The site for my freelance work: remote tech support, home and small-office networks, backups, and websites. It's in Hebrew, and it includes a working **website checker** that anyone can try.

The page is designed as a repair ticket: safety yellow, a condensed Hebrew display face, a ticket number and a barcode. In the hero, a scripted remote session finds a stuck print job and fixes it, and a "fixed" stamp lands on the screen. Sections reveal with native CSS scroll-driven animations, and all motion stops for visitors who prefer reduced motion.

**Live:** https://techfix-puce.vercel.app

![TechFix home page](docs/desktop.png)

## The website checker

Type a domain and the server fetches the page and reports, in plain Hebrew, on what a small-business owner would care about: HTTPS, whether the site answers, server response time, page weight, mobile viewport, the title and description Google shows, a single H1, image alt text, HSTS, and protection against being framed by another site.

The interesting part is that **the server fetches a URL that a stranger typed.** Without care, that is a Server-Side Request Forgery hole: someone could ask it to fetch `http://169.254.169.254/` (cloud metadata), `localhost`, or an address on the internal network. `api/scan.js` guards against this:

- only `http`/`https`, ports 80/443, no `user:password@`, and no bare hostnames like `localhost` (`normalizeUrl`)
- the hostname is resolved first, and the request is refused if **any** address is loopback, private (10/8, 172.16/12, 192.168/16), link-local, carrier-grade NAT, multicast, or the IPv6 equivalents, including IPv4-mapped IPv6 (`isPrivateAddress`)
- redirects are followed by hand (at most 4), and **every hop is checked again**, so a public page can't redirect the scanner inward
- an 8-second timeout and a 2 MB cap on the response body

A known gap: the address is checked during the DNS lookup, and `fetch` then resolves the name again, so a hostile DNS server could still answer differently the second time (DNS rebinding). Closing that would mean connecting to the already-checked IP directly. For a free checker that only returns a summary and never the page's contents, I decided the risk was acceptable, but it's the first thing I'd change before using this code anywhere sensitive.

## Accessibility, languages and legal pages

Every page has an accessibility menu (text size, high contrast, highlighted links, readable font, stopped animations, grayscale), a skip link and full keyboard use, built toward Israeli Standard 5568 (WCAG 2.0 AA). The screens were checked with axe. A button switches between Hebrew and English, including the page direction, and there are privacy, terms and accessibility statement pages (`public/site-kit.js`, `public/site-i18n.js`).

## The page

Plain HTML, CSS and a small script. All the content is in the HTML, so the page works with JavaScript off and search engines read all of it. The script only adds the checker and the contact form.

The contact form posts to Formspree when an endpoint is set in `data-endpoint`. Without one, it opens the visitor's mail app with the message already filled in, so it never fails silently.

The site sends security headers (`HSTS`, `X-Frame-Options`, `nosniff`), configured in `vercel.json`. It passes its own checker.

## Layout

```
public/          index.html, styles.css, main.js
api/scan.js      the serverless endpoint: SSRF guard, redirects, timeout
lib/scan-core.js pure functions: URL rules, private-IP check, the checks themselves
test/            node:test, no dependencies
```

```bash
npm test
npx vercel dev
```
