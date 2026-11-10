/* Markdown companion engine: pure logic, no DOM, no dependencies. Works in the browser (window.MCParser) and in Node.

   Safety first: every character of user text is HTML-escaped before any formatting is added, so typed
   HTML is shown as text. Links accept only http, https and mailto.

   Two passes:
   1. Block pass, line by line: fenced code, headings (H1-H3, at the start of a line only), bullet and
      numbered lists, blockquotes, paragraphs.
   2. Inline pass, left to right: code spans first (their contents are never formatted), then links,
      bold, italic. Each marker pair is closed on the same line, so "**a** and **b**" gives two spans.

   Also: a debounce (trailing edge), a namespaced vault for localStorage, and small text helpers. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.MCParser = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SAFE_URL = /^(https?:\/\/|mailto:)[^\s<>"']+$/i;
  var WORD = /[A-Za-z0-9_]/;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------- Inline pass ----------

  // Finds the closing delimiter on the same line, skipping over code spans so markers inside `code` never close bold or italics.
  function findClose(text, delim, from) {
    var k = from;
    while (k < text.length) {
      var c = text[k];
      if (c === "\n") return -1;
      if (c === "`") {
        var j = text.indexOf("`", k + 1);
        if (j < 0) return -1;
        k = j + 1;
        continue;
      }
      if (text.substr(k, delim.length) === delim) return k;
      k++;
    }
    return -1;
  }

  // Can an underscore open italics here? Not inside a word, so snake_case stays as typed.
  function underscoreOpens(text, i) {
    return i === 0 || !WORD.test(text[i - 1]);
  }

  function inline(text, depth) {
    depth = depth || 0;
    if (depth > 8) return escapeHtml(text);
    var out = "";
    var i = 0;
    var n = text.length;

    while (i < n) {
      var c = text[i];

      // Inline code: contents are escaped and never formatted.
      if (c === "`") {
        var j = text.indexOf("`", i + 1);
        if (j > i + 1 && text.slice(i + 1, j).indexOf("\n") < 0) {
          out += "<code>" + escapeHtml(text.slice(i + 1, j)) + "</code>";
          i = j + 1;
          continue;
        }
      }

      // Link: [label](url). Only safe URLs become links.
      if (c === "[") {
        var m = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
        if (m && SAFE_URL.test(m[2])) {
          out += '<a href="' + escapeHtml(m[2]) + '" target="_blank" rel="noopener noreferrer">' +
            inline(m[1], depth + 1) + "</a>";
          i += m[0].length;
          continue;
        }
      }

      // Bold: **text** or __text__
      if ((c === "*" || c === "_") && text[i + 1] === c) {
        var bd = c + c;
        var bj = findClose(text, bd, i + 2);
        if (bj > i + 2) {
          out += "<strong>" + inline(text.slice(i + 2, bj), depth + 1) + "</strong>";
          i = bj + 2;
          continue;
        }
      }

      // Italic: *text* or _text_
      if (c === "*" || (c === "_" && underscoreOpens(text, i))) {
        var ij = findClose(text, c, i + 1);
        var closesOk = c === "*" || ij < 0 || !WORD.test(text[ij + 1] || "");
        if (ij > i + 1 && text[ij - 1] !== " " && closesOk) {
          out += "<em>" + inline(text.slice(i + 1, ij), depth + 1) + "</em>";
          i = ij + 1;
          continue;
        }
      }

      out += escapeHtml(c);
      i++;
    }
    return out;
  }

  // ---------- Block pass ----------

  var FENCE_OPEN = /^```[ \t]*([A-Za-z0-9_+.#-]*)[ \t]*$/;
  var FENCE_CLOSE = /^```[ \t]*$/;
  var HEADING = /^(#{1,3})[ \t]+(.*?)[ \t]*$/;
  var BULLET = /^[ \t]{0,3}[-*+][ \t]+(.*)$/;
  var NUMBERED = /^[ \t]{0,3}\d{1,3}[.)][ \t]+(.*)$/;
  var QUOTE = /^>[ \t]?(.*)$/;

  function isBlank(line) {
    return /^[ \t]*$/.test(line);
  }

  function isBlockStart(line) {
    return FENCE_OPEN.test(line) || HEADING.test(line) || BULLET.test(line) ||
      NUMBERED.test(line) || QUOTE.test(line);
  }

  function parseBlocks(src) {
    var lines = String(src == null ? "" : src).replace(/\r\n?/g, "\n").split("\n");
    var blocks = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      var m;

      var fence = FENCE_OPEN.exec(line);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++; // skip the closing fence (or go past the end if unclosed)
        blocks.push({ type: "code", lang: fence[1] || "", text: code.join("\n") });
        continue;
      }

      if (isBlank(line)) {
        i++;
        continue;
      }

      if ((m = HEADING.exec(line))) {
        blocks.push({ type: "h", level: m[1].length, text: m[2] });
        i++;
        continue;
      }

      if (BULLET.test(line) || NUMBERED.test(line)) {
        var ordered = !BULLET.test(line);
        var items = [];
        while (i < lines.length) {
          var b = BULLET.exec(lines[i]);
          var o = NUMBERED.exec(lines[i]);
          if (ordered && o) items.push(o[1]);
          else if (!ordered && b) items.push(b[1]);
          else break;
          i++;
        }
        blocks.push({ type: "list", ordered: ordered, items: items });
        continue;
      }

      if (QUOTE.test(line)) {
        var qlines = [];
        while (i < lines.length && QUOTE.test(lines[i])) {
          qlines.push(QUOTE.exec(lines[i])[1]);
          i++;
        }
        blocks.push({ type: "quote", lines: qlines });
        continue;
      }

      // Paragraph: consecutive lines until a blank line or another block starts.
      var para = [];
      while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !isBlockStart(lines[i]))) {
        para.push(lines[i]);
        i++;
      }
      blocks.push({ type: "p", lines: para });
    }
    return blocks;
  }

  function renderBlock(b) {
    if (b.type === "h") {
      return "<h" + b.level + ">" + inline(b.text) + "</h" + b.level + ">";
    }
    if (b.type === "p") {
      return "<p>" + b.lines.map(function (l) { return inline(l); }).join("<br>") + "</p>";
    }
    if (b.type === "list") {
      var tag = b.ordered ? "ol" : "ul";
      return "<" + tag + ">" + b.items.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</" + tag + ">";
    }
    if (b.type === "quote") {
      return "<blockquote>" + b.lines.map(function (l) { return inline(l); }).join("<br>") + "</blockquote>";
    }
    if (b.type === "code") {
      var lang = b.lang ? ' data-lang="' + escapeHtml(b.lang) + '"' : "";
      return "<pre class=\"code\"><code" + lang + ">" + escapeHtml(b.text) + "</code></pre>";
    }
    return "";
  }

  // Full render: Markdown text in, safe HTML out.
  function render(src) {
    return parseBlocks(src).map(renderBlock).join("\n");
  }

  // ---------- Helpers ----------

  // Plain text of a line: strips the most common markup, for file names and titles.
  function plain(text) {
    return String(text)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
  }

  // The name for the download: the first heading, slugified, or "notes".
  function fileNameFor(src) {
    var h = parseBlocks(src).filter(function (b) { return b.type === "h"; })[0];
    var base = h ? plain(h.text) : "";
    var slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
    return (slug || "notes") + ".md";
  }

  function stats(text) {
    var t = String(text == null ? "" : text);
    var trimmed = t.trim();
    return {
      chars: t.length,
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      lines: t ? t.split("\n").length : 0
    };
  }

  // Trailing-edge debounce. The timers argument is injectable so tests can run without waiting.
  function createDebounce(fn, ms, timers) {
    var t = timers || { setTimeout: setTimeout, clearTimeout: clearTimeout };
    var handle = 0;
    var lastArgs = [];

    function run() {
      handle = 0;
      fn.apply(null, lastArgs);
    }

    function call() {
      lastArgs = Array.prototype.slice.call(arguments);
      if (handle) t.clearTimeout(handle);
      handle = t.setTimeout(run, ms);
    }

    call.flush = function () {
      if (handle) {
        t.clearTimeout(handle);
        run();
      }
    };
    call.cancel = function () {
      if (handle) t.clearTimeout(handle);
      handle = 0;
    };
    return call;
  }

  // Namespaced key-value store over localStorage, with an in-memory fallback if storage is blocked.
  function createVault(opts) {
    var storage = opts && opts.storage;
    var prefix = (opts && opts.prefix) || "mc_vault_v1_";
    var mem = {};

    function read(key, fallback) {
      if (!storage) return key in mem ? mem[key] : fallback;
      try {
        var raw = storage.getItem(prefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return key in mem ? mem[key] : fallback;
      }
    }

    function write(key, value) {
      mem[key] = value;
      if (!storage) return true;
      try {
        storage.setItem(prefix + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    }

    return { read: read, write: write, prefix: prefix };
  }

  return {
    escapeHtml: escapeHtml,
    inline: inline,
    parseBlocks: parseBlocks,
    render: render,
    plain: plain,
    fileNameFor: fileNameFor,
    stats: stats,
    createDebounce: createDebounce,
    createVault: createVault
  };
});
