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
  assert.equal(M.render('#### Too deep').startsWith('<p>'), true);
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
