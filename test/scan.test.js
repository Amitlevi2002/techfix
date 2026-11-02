import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, isPrivateAddress, metaContent, normalizeUrl } from '../lib/scan-core.js';

test('normalizeUrl adds https and rejects what is not a public web address', () => {
  assert.equal(normalizeUrl('example.co.il').href, 'https://example.co.il/');
  assert.equal(normalizeUrl('http://example.com/a?b=1').href, 'http://example.com/a?b=1');
  for (const bad of ['', 'localhost', 'intranet', 'ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)',
    'https://user:pw@example.com', 'https://example.com:8080', 'x'.repeat(3000)]) {
    assert.equal(normalizeUrl(bad), null, bad.slice(0, 40));
  }
});

test('isPrivateAddress blocks internal, loopback and cloud-metadata addresses', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.1.2.3', 'not-an-ip']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
});

test('isPrivateAddress lets ordinary public addresses through', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

const page = (html, { headers = {}, ...extra } = {}) => ({
  finalUrl: 'https://shop.example/', status: 200, ms: 400, bytes: html.length,
  headers: new Headers(headers), html, ...extra,
});
const byId = (r) => Object.fromEntries(r.checks.map((c) => [c.id, c]));

test('a well-built page passes the basic checks', () => {
  const html = `<html><head><title>Bakery in Haifa · Fresh bread daily</title>
    <meta name="viewport" content="width=device-width">
    <meta name="description" content="Family bakery in Haifa baking sourdough, challah and pastries every morning since 1998.">
    </head><body><h1>Bakery</h1><img src="a.jpg" alt="bread"></body></html>`;
  const r = byId(analyze(page(html, { headers: { 'strict-transport-security': 'max-age=1', 'x-frame-options': 'DENY' } })));
  for (const id of ['https', 'status', 'speed', 'mobile', 'title', 'description', 'h1', 'alt', 'hsts', 'frame']) {
    assert.equal(r[id].ok, true, id);
  }
});

test('reads meta tags written with single quotes or no quotes', () => {
  assert.equal(metaContent('<meta name=viewport content="width=device-width">', 'viewport'), 'width=device-width');
  assert.equal(metaContent("<meta content='Fresh bread' name='description'>", 'description'), 'Fresh bread');
  assert.equal(metaContent('<meta name=description content=Short>', 'description'), 'Short');
  assert.equal(metaContent('<meta name="robots" content="index">', 'description'), null);
});

test('flags the common problems on a neglected page', () => {
  const html = '<html><body><h1>a</h1><h1>b</h1><img src="x.png"><img src="y.png"></body></html>';
  const result = analyze(page(html, { finalUrl: 'http://old.example/', ms: 4200 }));
  const r = byId(result);
  assert.equal(r.https.ok, false);
  assert.equal(r.speed.ok, false);
  assert.equal(r.speed.warn, false);
  assert.equal(r.mobile.ok, false);
  assert.equal(r.title.ok, false);
  assert.equal(r.h1.ok, false);
  assert.match(r.alt.detail, /2 מתוך 2/);
  assert.ok(result.score < 40, `score ${result.score}`);
});
