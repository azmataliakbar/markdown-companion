'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/parser.js');

test('escapes typed HTML, so it is shown as text and never executed', () => {
  const html = M.render('<script>alert(1)</script> and <img src=x onerror=alert(2)>');
  assert.ok(!/<script/i.test(html) && !/<img/i.test(html), html);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('several bold spans on one line each become their own strong element', () => {
  assert.equal(M.inline('**a** and **b**'), '<strong>a</strong> and <strong>b</strong>');
});

test('bold and italic nest and close correctly', () => {
  assert.equal(M.inline('**bold *and italic* here**'), '<strong>bold <em>and italic</em> here</strong>');
  assert.equal(M.inline('*one* and *two*'), '<em>one</em> and <em>two</em>');
});

test('an unclosed marker stays as typed text', () => {
  assert.equal(M.inline('**open only'), '**open only');
  assert.equal(M.inline('a * star'), 'a * star');
});

test('inline code is shown literally: its markers are not formatted', () => {
  assert.equal(M.inline('`**not bold**`'), '<code>**not bold**</code>');
  // A bold marker inside code must not close bold that opened before it.
  assert.equal(M.inline('**a `b**` c'), '**a <code>b**</code> c');
});

test('underscores inside words are left alone', () => {
  assert.equal(M.inline('my_snake_case_name'), 'my_snake_case_name');
  assert.equal(M.inline('_emphasis_'), '<em>emphasis</em>');
});

test('headings H1-H3 are recognised only at the start of a line', () => {
  assert.equal(M.render('# Title'), '<h1>Title</h1>');
  assert.equal(M.render('## Sub'), '<h2>Sub</h2>');
  assert.equal(M.render('### Small'), '<h3>Small</h3>');
  assert.equal(M.render('#### Four'), '<h4>Four</h4>');
  assert.equal(M.render('###### Six'), '<h6>Six</h6>');
  assert.equal(M.render('####### Seven').startsWith('<p>'), true, 'seven hashes is not a heading');
  assert.equal(M.render('issue # 5').startsWith('<p>'), true, 'a hash mid-line is not a heading');
  assert.equal(M.render('#nospace').startsWith('<p>'), true);
});

test('bullet and numbered lists', () => {
  assert.equal(M.render('- one\n- two'), '<ul><li>one</li><li>two</li></ul>');
  assert.equal(M.render('* star\n+ plus'), '<ul><li>star</li><li>plus</li></ul>');
  assert.equal(M.render('1. first\n2. second'), '<ol><li>first</li><li>second</li></ol>');
});

test('fenced code blocks keep their text literal and are not formatted', () => {
  const html = M.render('```js\nconst x = "**no**" < 2;\n```');
  assert.ok(html.startsWith('<pre class="code"><code data-lang="js">'), html);
  assert.ok(html.includes('&lt; 2;'));
  assert.ok(!html.includes('<strong>'));
});

test('an unclosed fence runs to the end of the text', () => {
  assert.ok(M.render('```\nline one\nline two').includes('line two'));
});

test('blockquotes join consecutive lines', () => {
  assert.equal(M.render('> quote one\n> quote two'), '<blockquote>quote one<br>quote two</blockquote>');
});

test('links: safe URLs become links, unsafe ones stay as text', () => {
  const ok = M.inline('[site](https://example.com/a?b=1)');
  assert.ok(ok.startsWith('<a href="https://example.com/a?b=1"'), ok);
  assert.ok(ok.includes('rel="noopener noreferrer"'));
  assert.equal(M.inline('[bad](javascript:alert(1))').includes('<a '), false);
  assert.equal(M.inline('[bad](javascript:alert(1))'), '[bad](javascript:alert(1))');
  assert.equal(M.inline('[x](https://a.com/"onmouseover="z)').includes('onmouseover="z'), false);
});

test('paragraphs keep line breaks and stop at blank lines', () => {
  assert.equal(M.render('one\ntwo\n\nthree'), '<p>one<br>two</p>\n<p>three</p>');
});

test('the file name comes from the first heading, or falls back to notes', () => {
  assert.equal(M.fileNameFor('# My Trip Plan!\nbody'), 'my-trip-plan.md');
  assert.equal(M.fileNameFor('just text'), 'notes.md');
  assert.equal(M.fileNameFor('# **Bold** title'), 'bold-title.md');
});

test('stats count characters, words and lines', () => {
  assert.deepEqual(M.stats('hello world\nbye'), { chars: 15, words: 3, lines: 2 });
  assert.deepEqual(M.stats(''), { chars: 0, words: 0, lines: 0 });
});

test('the debounce waits for a pause and runs once with the latest value', () => {
  const calls = [];
  let pending = null;
  const timers = {
    setTimeout: (fn, ms) => { pending = { fn, ms }; return 1; },
    clearTimeout: () => { pending = null; }
  };
  const d = M.createDebounce((v) => calls.push(v), 50, timers);
  d('a'); d('ab'); d('abc');
  assert.equal(calls.length, 0, 'nothing runs while typing');
  assert.equal(pending.ms, 50, 'trailing edge at 50 ms');
  pending.fn();
  assert.deepEqual(calls, ['abc'], 'one call with the latest value');
});

test('the vault uses the mc_vault_v1_ namespace and survives blocked storage', () => {
  const store = {};
  const st = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const v = M.createVault({ storage: st });
  v.write('doc', { text: '# Hi' });
  const keys = Object.keys(store);
  assert.ok(keys.length > 0 && keys.every((k) => k.startsWith('mc_vault_v1_')), keys.join(', '));
  assert.deepEqual(v.read('doc', null), { text: '# Hi' });

  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const v2 = M.createVault({ storage: broken });
  assert.equal(v2.write('doc', 'x'), false);
  assert.equal(v2.read('doc', 'fallback'), 'x', 'falls back to memory for this visit');
});

// ---------- Images ----------

test('images: web and small raster data URIs become img elements with escaped alt text', () => {
  const h = M.inline('![A "cat" & <dog>](https://example.com/cat.png "Title")');
  assert.ok(h.startsWith('<img src="https://example.com/cat.png"'), h);
  assert.ok(h.includes('alt="A &quot;cat&quot; &amp; &lt;dog&gt;"'), h);
  assert.ok(h.includes('title="Title"'));
  assert.ok(h.includes('loading="lazy"') && h.includes('referrerpolicy="no-referrer"'));
  const d = M.inline('![pic](data:image/png;base64,iVBORw0KGgo=)');
  assert.ok(d.startsWith('<img src="data:image/png;base64,iVBORw0KGgo="'), d);
});

test('images: SVG, scripts and other schemes are never rendered as images', () => {
  const svg = M.inline('![x](data:image/svg+xml;base64,PHN2Zz4=)');
  assert.equal(svg.includes('<img'), false, svg);
  assert.equal(M.inline('![x](javascript:alert(1))').includes('<img'), false);
  assert.equal(M.inline('![x](data:text/html;base64,PGI+)').includes('<img'), false);
  assert.equal(M.isSafeImageUrl('data:image/svg+xml;base64,AAAA'), false);
  assert.equal(M.isSafeImageUrl('https://example.com/a.webp'), true);
});

test('images: an unsafe image is shown as its typed text, not as markup', () => {
  assert.equal(M.inline('![x](javascript:alert(1))'), '![x](javascript:alert(1))');
});

// ---------- Horizontal rules, headings, emphasis ----------

test('horizontal rules: three or more dashes, stars or underscores on their own line', () => {
  assert.equal(M.render('---'), '<hr>');
  assert.equal(M.render('* * *'), '<hr>');
  assert.equal(M.render('___'), '<hr>');
  assert.equal(M.render('--'), '<p>--</p>', 'two dashes are text');
});

test('strikethrough and bold-italic', () => {
  assert.equal(M.inline('~~gone~~ and kept'), '<del>gone</del> and kept');
  assert.equal(M.inline('***both***'), '<strong><em>both</em></strong>');
  assert.equal(M.inline('~~unclosed'), '~~unclosed');
});

test('escapes: a backslash shows the next symbol literally', () => {
  const bs = String.fromCharCode(92);
  assert.equal(M.inline(bs + "*not italic" + bs + "*"), "*not italic*");
  assert.equal(M.inline(bs + "`not code" + bs + "`"), "`not code`");
  assert.equal(M.inline("a " + bs + " b"), "a " + bs + " b", "a backslash before a space is just a backslash");
});

test('autolinks: angle-bracket web links become links', () => {
  const h = M.inline('<https://example.com/x>');
  assert.ok(h.startsWith('<a href="https://example.com/x"'), h);
  assert.equal(M.inline('<script>').includes('<a '), false);
});

// ---------- Lists ----------

test('nested lists follow indentation', () => {
  const html = M.render('- one\n  - one a\n  - one b\n- two');
  assert.equal(html, '<ul><li>one<ul><li>one a</li><li>one b</li></ul></li><li>two</li></ul>');
});

test('task lists show a disabled checkbox, checked or not', () => {
  const html = M.render('- [ ] todo\n- [x] done');
  assert.ok(html.includes('<li class="task"><input type="checkbox" disabled> todo</li>'), html);
  assert.ok(html.includes('<input type="checkbox" disabled checked> done'), html);
});

test('a change between bullets and numbers starts a new list', () => {
  assert.equal(M.render('- a\n1. b'), '<ul><li>a</li></ul>' + String.fromCharCode(10) + '<ol><li>b</li></ol>');
});

// ---------- Tables ----------

test('tables: header, body rows and alignment from the delimiter row', () => {
  const html = M.render('| Name | Qty | Price |\n| :--- | :---: | ---: |\n| Tea | 2 | 50 |\n| Milk | 1 | 120 |');
  assert.ok(html.startsWith('<div class="table-wrap"><table><thead><tr>'), html);
  assert.ok(html.includes('<th class="al-left">Name</th>'));
  assert.ok(html.includes('<th class="al-center">Qty</th>'));
  assert.ok(html.includes('<th class="al-right">Price</th>'));
  assert.ok(html.includes('<td class="al-left">Tea</td>'));
  assert.ok(html.includes('<td class="al-right">120</td>'));
});

test('tables: short rows are padded and cell text is escaped', () => {
  const html = M.render('a | b\n--|--\n<b>x</b>');
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(html.includes('<td class="al-left"></td>'), 'missing cell is empty');
});

test('tables: an escaped pipe stays inside its cell', () => {
  const bs = String.fromCharCode(92);
  const html = M.render('a | b' + String.fromCharCode(10) + '--|--' + String.fromCharCode(10) + 'x ' + bs + '| y | z');
  assert.ok(html.includes('x | y'), html);
});

test('tables: a line with a pipe but no delimiter row is just text', () => {
  assert.ok(M.render('a | b').startsWith('<p>'));
});

// ---------- Robustness ----------

test('the parser handles very deep nesting without crashing', () => {
  const deep = Array.from({ length: 40 }, (_, k) => ' '.repeat(k * 2) + '- item ' + k).join('\n');
  assert.ok(M.render(deep).includes('item 39'));
});

test('very long single lines finish quickly', () => {
  const line = 'a *b* '.repeat(3000) + '**';
  const t0 = Date.now();
  M.render(line);
  assert.ok(Date.now() - t0 < 2000);
});
