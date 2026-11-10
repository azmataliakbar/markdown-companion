/* Markdown companion engine: pure logic, no DOM, no dependencies. Works in the browser (window.MCParser) and in Node.

   Safety first: every character of user text is HTML-escaped before any formatting is added, so typed
   HTML is shown as text. Links accept only http, https and mailto. Images accept only http, https and
   small raster data URIs (PNG, JPEG, GIF, WebP). SVG is never allowed, because it can run scripts.

   Block pass (line by line): fenced code, horizontal rules, headings H1-H6, lists (nested by indentation,
   with task items), tables (pipe syntax with alignment), blockquotes, paragraphs.
   Inline pass (left to right): escapes, code spans (their contents are never formatted), images, links,
   autolinks, bold-italic, bold, italic, strikethrough. Each marker closes on the same line.

   Also: a debounce (trailing edge), a namespaced vault for localStorage, and text helpers. */
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
  var SAFE_IMAGE_URL = /^(https?:\/\/[^\s<>"']+|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)$/i;
  var WORD = /[A-Za-z0-9_]/;
  var ESCAPABLE = /[\\`*_{}\[\]()#+\-.!~|<>]/;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------- Inline pass ----------

  // Finds a closing delimiter on the same line, skipping code spans so markers inside `code` never close formatting.
  function findClose(text, delim, from) {
    var k = from;
    while (k < text.length) {
      var c = text[k];
      if (c === "\n") return -1;
      if (c === "\\") { k += 2; continue; }
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

  // Underscores open emphasis only at the start of a word, so snake_case stays as typed.
  function underscoreOpens(text, i) {
    return i === 0 || !WORD.test(text[i - 1]);
  }

  function imageTag(alt, src, title) {
    var t = title ? ' title="' + escapeHtml(title) + '"' : "";
    return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '"' + t +
      ' loading="lazy" referrerpolicy="no-referrer">';
  }

  function inline(text, depth) {
    depth = depth || 0;
    if (depth > 8) return escapeHtml(text);
    var out = "";
    var i = 0;
    var n = text.length;

    while (i < n) {
      var c = text[i];

      // Escapes: \* shows a literal asterisk.
      if (c === "\\" && i + 1 < n && ESCAPABLE.test(text[i + 1])) {
        out += escapeHtml(text[i + 1]);
        i += 2;
        continue;
      }

      // Inline code: contents are escaped and never formatted.
      if (c === "`") {
        var j = text.indexOf("`", i + 1);
        if (j > i + 1 && text.slice(i + 1, j).indexOf("\n") < 0) {
          out += "<code>" + escapeHtml(text.slice(i + 1, j)) + "</code>";
          i = j + 1;
          continue;
        }
      }

      // Image: ![alt](src "optional title"). Only safe sources become images.
      if (c === "!" && text[i + 1] === "[") {
        var im = /^!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"([^"\n]*)")?\)/.exec(text.slice(i));
        if (im && SAFE_IMAGE_URL.test(im[2])) {
          out += imageTag(im[1], im[2], im[3]);
          i += im[0].length;
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

      // Autolink: <https://example.com>
      if (c === "<") {
        var al = /^<((?:https?:\/\/|mailto:)[^\s<>"']+)>/i.exec(text.slice(i));
        if (al) {
          out += '<a href="' + escapeHtml(al[1]) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(al[1]) + "</a>";
          i += al[0].length;
          continue;
        }
      }

      // Bold and italic together: ***text***
      if (text.substr(i, 3) === "***") {
        var tj = findClose(text, "***", i + 3);
        if (tj > i + 3) {
          out += "<strong><em>" + inline(text.slice(i + 3, tj), depth + 1) + "</em></strong>";
          i = tj + 3;
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

      // Strikethrough: ~~text~~
      if (c === "~" && text[i + 1] === "~") {
        var sj = findClose(text, "~~", i + 2);
        if (sj > i + 2) {
          out += "<del>" + inline(text.slice(i + 2, sj), depth + 1) + "</del>";
          i = sj + 2;
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
  var HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/;
  var RULE = /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/;
  var LIST_ITEM = /^([ \t]*)([-*+]|\d{1,3}[.)])[ \t]+(.*)$/;
  var TASK = /^\[([ xX])\][ \t]+(.*)$/;
  var QUOTE = /^>[ \t]?(.*)$/;
  var TABLE_DELIM = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

  function isBlank(line) {
    return /^[ \t]*$/.test(line);
  }

  function indentOf(ws) {
    var w = 0;
    for (var k = 0; k < ws.length; k++) w += ws[k] === "\t" ? 4 : 1;
    return w;
  }

  // Splits a table row into cells. Escaped pipes (\|) stay inside their cell.
  function splitRow(line) {
    var s = line.trim();
    if (s[0] === "|") s = s.slice(1);
    if (s[s.length - 1] === "|" && s[s.length - 2] !== "\\") s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/).map(function (c) { return c.trim().replace(/\\\|/g, "|"); });
  }

  // A table starts with a header row that contains a pipe, followed by a delimiter row with the same number of cells.
  function isTableStart(lines, i) {
    if (i + 1 >= lines.length) return false;
    if (lines[i].indexOf("|") < 0 || !TABLE_DELIM.test(lines[i + 1])) return false;
    return splitRow(lines[i]).length === splitRow(lines[i + 1]).length;
  }

  function isBlockStart(lines, i) {
    var line = lines[i];
    return FENCE_OPEN.test(line) || RULE.test(line) || HEADING.test(line) ||
      LIST_ITEM.test(line) || QUOTE.test(line) || isTableStart(lines, i);
  }

  // A list, nested by indentation. Returns the block and the index after it.
  function listBlock(lines, i) {
    var first = LIST_ITEM.exec(lines[i]);
    var base = indentOf(first[1]);
    var ordered = /\d/.test(first[2]);
    var items = [];

    while (i < lines.length) {
      var m = LIST_ITEM.exec(lines[i]);
      if (!m) break;
      var ind = indentOf(m[1]);
      if (items.length === 0) base = ind;
      if (ind < base) break;
      if (ind > base) {
        // Indented under the previous item: a nested list.
        var sub = listBlock(lines, i);
        if (items.length) items[items.length - 1].children.push(sub.block);
        i = sub.i;
        continue;
      }
      if (/\d/.test(m[2]) !== ordered) break; // a change of list type starts a new list
      var text = m[3];
      var task = TASK.exec(text);
      items.push({
        text: task ? task[2] : text,
        task: !!task,
        checked: task ? /[xX]/.test(task[1]) : false,
        children: []
      });
      i++;
    }
    return { block: { type: "list", ordered: ordered, items: items }, i: i };
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

      if (RULE.test(line)) {
        blocks.push({ type: "hr" });
        i++;
        continue;
      }

      if ((m = HEADING.exec(line))) {
        blocks.push({ type: "h", level: m[1].length, text: m[2] });
        i++;
        continue;
      }

      if (isTableStart(lines, i)) {
        var head = splitRow(lines[i]);
        var delim = splitRow(lines[i + 1]);
        var align = delim.map(function (d) {
          var l = d[0] === ":", r = d[d.length - 1] === ":";
          return l && r ? "center" : r ? "right" : l ? "left" : "";
        });
        var rows = [];
        i += 2;
        while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines, i)) {
          var cells = splitRow(lines[i]);
          while (cells.length < head.length) cells.push("");
          rows.push(cells.slice(0, head.length));
          i++;
        }
        blocks.push({ type: "table", head: head, align: align, rows: rows });
        continue;
      }

      if (LIST_ITEM.test(line)) {
        var lb = listBlock(lines, i);
        blocks.push(lb.block);
        i = lb.i;
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
      while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !isBlockStart(lines, i))) {
        para.push(lines[i]);
        i++;
      }
      blocks.push({ type: "p", lines: para });
    }
    return blocks;
  }

  function renderList(b) {
    var tag = b.ordered ? "ol" : "ul";
    return "<" + tag + ">" + b.items.map(function (it) {
      var cls = it.task ? ' class="task"' : "";
      var box = it.task
        ? '<input type="checkbox" disabled' + (it.checked ? " checked" : "") + "> "
        : "";
      return "<li" + cls + ">" + box + inline(it.text) +
        it.children.map(renderList).join("") + "</li>";
    }).join("") + "</" + tag + ">";
  }

  function renderBlock(b) {
    if (b.type === "h") {
      return "<h" + b.level + ">" + inline(b.text) + "</h" + b.level + ">";
    }
    if (b.type === "hr") {
      return "<hr>";
    }
    if (b.type === "p") {
      return "<p>" + b.lines.map(function (l) { return inline(l); }).join("<br>") + "</p>";
    }
    if (b.type === "list") {
      return renderList(b);
    }
    if (b.type === "table") {
      var th = b.head.map(function (c, k) {
        return '<th class="al-' + (b.align[k] || "left") + '">' + inline(c) + "</th>";
      }).join("");
      var body = b.rows.map(function (r) {
        return "<tr>" + r.map(function (c, k) {
          return '<td class="al-' + (b.align[k] || "left") + '">' + inline(c) + "</td>";
        }).join("") + "</tr>";
      }).join("");
      return '<div class="table-wrap"><table><thead><tr>' + th + "</tr></thead><tbody>" + body +
        "</tbody></table></div>";
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
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
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
    var t = timers || { setTimeout: function (f, m) { return setTimeout(f, m); }, clearTimeout: function (h) { clearTimeout(h); } };
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
    isSafeImageUrl: function (u) { return SAFE_IMAGE_URL.test(String(u)); },
    createDebounce: createDebounce,
    createVault: createVault
  };
});
