// Blog body rendering and sanitising (docs/BLOG_SPEC.md §5, §8), slugs, reading time and the
// image-size reader used by the blog media upload. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { parseDoc, renderDoc, sanitizeBlogHtml, safeHref, readingMinutes, countWords, type PMNode } from '../server/blog/render.ts';
import { slugify, isValidSlug, cleanTags } from '../server/blog/posts.ts';
import { readImageSize } from '../server/imageSize.ts';
import { detectImageType, decodeImageUpload } from '../server/uploads.ts';

const IMG = '/media/blog/11111111-2222-4333-8444-555555555555.webp';
const SMALL = '22222222-3333-4444-8555-666666666666.webp';

const doc = (...content: PMNode[]): PMNode => ({ type: 'doc', content });
const p = (...content: PMNode[]): PMNode => ({ type: 'paragraph', content });
const t = (text: string, marks?: PMNode['marks']): PMNode => ({ type: 'text', text, marks });
const render = (d: PMNode) => renderDoc(d).html;

// Strings an attacker could put in a post: none may survive as markup that runs code.
const ATTACKS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<img src="/media/blog/11111111-2222-4333-8444-555555555555.webp" onerror="alert(1)">',
  '<svg onload=alert(1)><circle/></svg>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="&#x6A;avascript&#x3A;alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="//evil.example/x">x</a>',
  '<iframe src="https://evil.example"></iframe>',
  '<object data="x.swf"></object><embed src="x.swf">',
  '<p style="background:url(javascript:alert(1))" onclick="alert(1)">x</p>',
  '<style>body{display:none}</style>',
  '<form action="https://evil.example"><input name=a></form>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<base href="https://evil.example/">',
  '<meta http-equiv="refresh" content="0;url=https://evil.example">',
  '<div class="tx-blog-table" onmouseover="alert(1)">x</div>',
  '<img src="https://evil.example/x.png">',
  '<img src="data:image/png;base64,iVBORw0KGgo=">',
  `<img src="${IMG}" srcset="https://evil.example/x.png 800w">`,
  '<!--<img src=x onerror=alert(1)>-->',
];

function assertSafe(html: string, label: string) {
  assert.doesNotMatch(html, /<script|<iframe|<object|<embed|<svg|<math|<style|<form|<input|<base|<meta|<noscript/i, label);
  // A handler would sit outside quoted values; escaped text inside a value is harmless.
  assert.doesNotMatch(html.replace(/"[^"]*"/g, '""'), /\son\w+\s*=/i, `${label}: event handler`);
  assert.doesNotMatch(html, /javascript:|vbscript:|data:/i, `${label}: script URL`);
  assert.doesNotMatch(html, /style=/i, `${label}: inline style`);
  assert.doesNotMatch(html, /evil\.example/i, `${label}: foreign URL`);
}

test('sanitiser: attack strings lose scripts, handlers and script URLs', () => {
  for (const attack of ATTACKS) assertSafe(sanitizeBlogHtml(attack), attack);
  // Text inside a refused link survives as text.
  assert.equal(sanitizeBlogHtml('<a href="javascript:alert(1)">read</a>'), 'read');
  // An image from the library stays, without the handler.
  assert.equal(sanitizeBlogHtml(`<img src="${IMG}" alt="Bike" onerror="x">`), `<img src="${IMG}" alt="Bike" />`);
});

test('sanitiser: only the editor classes survive; links get rel', () => {
  assert.equal(sanitizeBlogHtml('<aside class="tx-callout tx-callout--tip evil">c</aside>'), '<aside class="tx-callout tx-callout--tip">c</aside>');
  assert.equal(sanitizeBlogHtml('<a href="/services" target="_top">s</a>'), '<a href="/services" rel="noopener">s</a>');
  assert.equal(
    sanitizeBlogHtml('<a href="https://example.com/" rel="author">e</a>'),
    '<a href="https://example.com/" rel="noopener noreferrer" target="_blank">e</a>'
  );
});

test('render: the same attacks inside editor JSON come out as text or not at all', () => {
  for (const attack of ATTACKS) {
    const html = render(doc(p(t(attack))));
    assertSafe(html.replace(/&lt;[^]*?&gt;/g, ''), `text: ${attack}`); // escaped markup is harmless text
    assert.doesNotMatch(html, /<(script|img|svg|iframe)/i, `text: ${attack}`);
  }
  const hrefs = ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', '//evil.example', 'vbscript:x', 'https://ex ample.com'];
  for (const href of hrefs) {
    const html = render(doc(p(t('click', [{ type: 'link', attrs: { href } }]))));
    assert.equal(html, '<p>click</p>', href);
  }
  // Attribute injection through attrs.
  const img = render(doc({ type: 'image', attrs: { src: IMG, alt: '" onerror="alert(1)', caption: '<b>x</b>' } }));
  assertSafe(img, 'image attrs');
  assert.match(img, /alt="&quot; onerror=&quot;alert\(1\)"/);
  assert.match(img, /<figcaption>&lt;b&gt;x&lt;\/b&gt;<\/figcaption>/);
  const callout = render(doc({ type: 'callout', attrs: { tone: 'x" onclick="alert(1)' }, content: [p(t('n'))] }));
  assert.equal(callout, '<aside class="tx-callout tx-callout--info"><p>n</p></aside>');
  // Images from outside the blog library are dropped.
  for (const src of ['https://evil.example/x.png', 'data:image/png;base64,AAAA', '/media/x.png', `${IMG}?x=1`, '/media/blog/../proofs/a.png']) {
    assert.equal(render(doc({ type: 'image', attrs: { src, alt: 'a' } })), '', src);
  }
});

test('render: editor blocks map to the allowed HTML', () => {
  const html = renderDoc(doc(
    { type: 'heading', attrs: { level: 1 }, content: [t('Title')] },
    { type: 'heading', attrs: { level: 6 }, content: [t('Deep')] },
    p(t('Bold', [{ type: 'bold' }]), t(' and '), t('italic', [{ type: 'italic' }]), { type: 'hardBreak' }, t('site', [{ type: 'link', attrs: { href: '/track' } }])),
    p(t('ext', [{ type: 'link', attrs: { href: 'https://example.com/a?b=1&c=2', nofollow: true } }])),
    p(t('own', [{ type: 'link', attrs: { href: 'https://www.tanexsarl.com/services' } }])),
    { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('one'))] }] },
    { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('three'))] }] },
    { type: 'blockquote', content: [p(t('quote'))] },
    { type: 'horizontalRule' },
    { type: 'image', attrs: { src: IMG, alt: 'Rider in Buea', caption: 'Caption' } },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('H'))] }, { type: 'tableCell', attrs: { colspan: 2 }, content: [p(t('C'))] }] }] },
    { type: 'callout', attrs: { tone: 'warning' }, content: [p(t('Careful'))] },
    { type: 'mystery', content: [p(t('kept'))] },
    p()
  ), (file) => (file === IMG.slice('/media/blog/'.length) ? { width: 1600, height: 900, smallFileName: SMALL, smallWidth: 800 } : null)).html;
  assert.match(html, /^<h2>Title<\/h2><h4>Deep<\/h4>/);
  assert.match(html, /<p><strong>Bold<\/strong> and <em>italic<\/em><br \/><a href="\/track" rel="noopener">site<\/a><\/p>/);
  assert.match(html, /<a href="https:\/\/example.com\/a\?b=1&amp;c=2" rel="noopener noreferrer nofollow ugc" target="_blank">ext<\/a>/);
  assert.match(html, /<a href="https:\/\/www.tanexsarl.com\/services" rel="noopener">own<\/a>/);
  assert.match(html, /<ul><li><p>one<\/p><\/li><\/ul><ol start="3"><li><p>three<\/p><\/li><\/ol>/);
  assert.match(html, /<blockquote><p>quote<\/p><\/blockquote><hr \/>/);
  assert.match(html, new RegExp(`<figure class="tx-blog-figure"><img src="${IMG}" alt="Rider in Buea" width="1600" height="900" srcset="/media/blog/${SMALL} 800w, ${IMG} 1600w" sizes="\\(max-width: 760px\\) 100vw, 760px" loading="lazy" decoding="async" /><figcaption>Caption</figcaption></figure>`));
  assert.match(html, /<div class="tx-blog-table"><table><tbody><tr><th><p>H<\/p><\/th><td colspan="2"><p>C<\/p><\/td><\/tr><\/tbody><\/table><\/div>/);
  assert.match(html, /<aside class="tx-callout tx-callout--warning"><p>Careful<\/p><\/aside><p>kept<\/p>$/);
});

test('render: reading time is words ÷ 200, at least 1; images without alt are counted', () => {
  assert.equal(readingMinutes(0), 1);
  assert.equal(readingMinutes(199), 1);
  assert.equal(readingMinutes(400), 2);
  assert.equal(readingMinutes(1000), 5);
  assert.equal(countWords("Livraison à Buea, aujourd'hui — 500 FCFA"), 6);
  const long = renderDoc(doc(p(t(Array.from({ length: 600 }, () => 'word').join(' ')))));
  assert.equal(long.words, 600);
  assert.equal(long.readingMinutes, 3);
  const noAlt = renderDoc(doc({ type: 'image', attrs: { src: IMG } }));
  assert.equal(noAlt.imagesMissingAlt, 1);
  assert.deepEqual(noAlt.mediaFiles, [IMG.slice('/media/blog/'.length)]);
});

test('parseDoc: refuses non-documents, deep nesting and oversize content', () => {
  assert.equal(parseDoc(doc(p(t('ok')))).ok, true);
  assert.equal(parseDoc(JSON.stringify(doc(p(t('ok'))))).ok, true);
  for (const bad of [null, 'nope', '{"type":"paragraph"}', { type: 'doc', content: 'x' }, { type: 'doc', content: [{ type: 1 }] }, { type: 'doc', content: [{ type: 'text', text: 5 }] }]) {
    assert.equal(parseDoc(bad).ok, false, JSON.stringify(bad));
  }
  let deep: PMNode = t('x');
  for (let i = 0; i < 60; i++) deep = { type: 'blockquote', content: [deep] };
  assert.equal(parseDoc(doc(deep)).ok, false);
  assert.equal(parseDoc(doc(p(t('x'.repeat(1_100_000))))).ok, false);
});

test('links: safeHref allows http(s), mailto, tel, site paths and anchors only', () => {
  assert.equal(safeHref('https://example.com'), 'https://example.com/');
  assert.equal(safeHref('mailto:info@tanexsarl.com'), 'mailto:info@tanexsarl.com');
  assert.equal(safeHref('tel:+237651059345'), 'tel:+237651059345');
  assert.equal(safeHref('/fr/suivi'), '/fr/suivi');
  assert.equal(safeHref('#rates'), '#rates');
  for (const bad of ['javascript:x', '//evil.example', 'ftp://x', 'data:x', '/a b', '/a\\b', '#a"b', '', 42]) {
    assert.equal(safeHref(bad), null, String(bad));
  }
});

test('slugs: lower-case ascii with hyphens; accents folded', () => {
  assert.equal(slugify('Expédier un colis à Douala !'), 'expedier-un-colis-a-douala');
  assert.equal(slugify("  L'été   2026 -- Buea  "), 'lete-2026-buea');
  assert.equal(slugify('!!!'), '');
  assert.ok(slugify('x'.repeat(200)).length <= 80);
  assert.equal(isValidSlug('bike-delivery-in-buea'), true);
  for (const bad of ['Bike', 'a--b', '-a', 'a-', 'a b', 'é', '', 'x'.repeat(81)]) assert.equal(isValidSlug(bad), false, bad);
  assert.deepEqual(cleanTags('Buea, buea , , Douala,' + 'x'.repeat(60)), ['Buea', 'Douala', 'x'.repeat(40)]);
});

test('image size: read from PNG, JPEG, WebP (lossy, lossless, extended) and AVIF headers', async () => {
  const base = sharp({ create: { width: 321, height: 123, channels: 3, background: '#7a4a2a' } });
  const cases: [Buffer, 'png' | 'jpeg' | 'webp' | 'avif'][] = [
    [await base.clone().png().toBuffer(), 'png'],
    [await base.clone().jpeg({ progressive: true }).toBuffer(), 'jpeg'],
    [await base.clone().webp({ quality: 70 }).toBuffer(), 'webp'],
    [await base.clone().webp({ lossless: true }).toBuffer(), 'webp'],
    [await base.clone().ensureAlpha(0.5).webp({ quality: 70 }).toBuffer(), 'webp'],
    [await base.clone().avif({ quality: 50 }).toBuffer(), 'avif'],
  ];
  for (const [buf, type] of cases) {
    assert.equal(detectImageType(buf), type);
    assert.deepEqual(readImageSize(buf, type), { width: 321, height: 123 }, type);
  }
  // Truncated or fake headers give null rather than a wrong size.
  assert.equal(readImageSize(cases[0][0].subarray(0, 20), 'png'), null);
  assert.equal(readImageSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), 'jpeg'), null);
  // AVIF is only accepted where a caller allows it (blog), not for package photos.
  const avif = cases[5][0].toString('base64');
  assert.equal(decodeImageUpload(avif).ok, false);
  assert.equal(decodeImageUpload(avif, 3 * 1024 * 1024, ['avif']).ok, true);
});
