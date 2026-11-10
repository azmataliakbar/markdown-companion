/* Markdown Companion controller: the editor, the toolbar and cheat-sheet insertion at the cursor,
   the debounced live preview, saving to this browser, the .md download, and the layout.
   The parser lives in parser.js. Runs on load. */
(function () {
  "use strict";
  var P = window.MCParser;
  var cfg = window.MC.config;
  var doc = document.documentElement;

  function $(id) { return document.getElementById(id); }
  function editor() { return $("editor-text"); }

  // ---------- Storage (this browser only, namespace mc_vault_v1_) ----------
  function usableStorage() {
    try {
      var s = window.localStorage;
      var probe = "__mc_probe__";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return s;
    } catch (e) {
      return null; // blocked: the app still works for this visit
    }
  }
  var vault = P.createVault({ storage: usableStorage(), prefix: "mc_vault_v1_" });

  // ---------- Render and save, debounced ----------
  var lastRendered = null;

  function renderNow() {
    var text = editor().value;
    if (text === lastRendered) return;
    lastRendered = text;
    var html = P.render(text);
    $("preview").innerHTML = html || '<p class="empty">Your preview appears here as you type.</p>';
    $("preview-note").textContent = "Live";
  }

  function saveNow() {
    var ok = vault.write("doc", { text: editor().value, savedAt: Date.now() });
    var when = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setSaveState(ok ? "Saved in this browser at " + when : "Saved for this visit only (browser storage is unavailable)");
  }

  var renderLater = P.createDebounce(renderNow, cfg.previewDebounceMs);
  var saveLater = P.createDebounce(saveNow, cfg.saveDebounceMs);

  function setSaveState(text) {
    $("save-state").textContent = text;
  }

  function updateCounters() {
    var st = P.stats(editor().value);
    $("count-words").textContent = st.words + (st.words === 1 ? " word" : " words");
    $("count-chars").textContent = st.chars.toLocaleString() + " chars";
    var max = cfg.maxChars;
    var cls = st.chars >= max ? "is-full" : st.chars >= max * 0.8 ? "is-warn" : "";
    $("count-chars").className = "counter" + (cls ? " " + cls : "");
  }

  // Every edit goes through here: counters now, preview and save after a short pause.
  function onEdited() {
    updateCounters();
    setSaveState("Saving…");
    renderLater();
    saveLater();
  }

  // ---------- Inserting Markdown at the cursor ----------
  function focusEditor() {
    editor().focus();
  }

  // Wraps the selected text, or inserts a placeholder that is selected so the user can type over it.
  function wrapSelection(before, after, placeholder) {
    var t = editor();
    var s = t.selectionStart;
    var e = t.selectionEnd;
    var sel = t.value.slice(s, e) || placeholder;
    focusEditor();
    t.setRangeText(before + sel + after, s, e, "select");
    t.setSelectionRange(s + before.length, s + before.length + sel.length);
    onEdited();
  }

  // Adds a prefix at the start of the current line (headings, lists).
  function linePrefix(prefix) {
    var t = editor();
    var s = t.selectionStart;
    var lineStart = t.value.slice(0, s).lastIndexOf("\n") + 1;
    focusEditor();
    t.setRangeText(prefix, lineStart, lineStart, "end");
    t.setSelectionRange(s + prefix.length, s + prefix.length);
    onEdited();
  }

  // Inserts a cheat-sheet snippet. {cursor} marks where the caret should land.
  function insertSnippet(snippet) {
    var t = editor();
    var s = t.selectionStart;
    var e = t.selectionEnd;
    var blockish = /^(#|-|1\.|>|```)/.test(snippet);
    var lead = "";
    if (blockish && s > 0 && t.value.charAt(s - 1) !== "\n") lead = "\n"; // blocks start on their own line
    var idx = snippet.indexOf("{cursor}");
    var text = snippet.replace("{cursor}", "");
    focusEditor();
    t.setRangeText(lead + text, s, e, "end");
    var caret = s + lead.length + (idx < 0 ? text.length : idx);
    t.setSelectionRange(caret, caret);
    onEdited();
  }

  var TOOLS = {
    h1: function () { linePrefix("# "); },
    bold: function () { wrapSelection("**", "**", "bold text"); },
    italic: function () { wrapSelection("*", "*", "italic text"); },
    code: function () {
      var t = editor();
      var multi = t.value.slice(t.selectionStart, t.selectionEnd).indexOf("\n") >= 0;
      if (multi) wrapSelection("```\n", "\n```", "code");
      else wrapSelection("`", "`", "code");
    },
    link: function () { wrapSelection("[", "](https://example.com)", "link text"); },
    list: function () { linePrefix("- "); }
  };

  document.querySelectorAll(".tool").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var fn = TOOLS[btn.getAttribute("data-tool")];
      if (fn) fn();
    });
  });

  // Keyboard shortcuts in the editor.
  editor().addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = e.key.toLowerCase();
    var map = { b: "bold", i: "italic", k: "link" };
    if (map[k]) {
      e.preventDefault();
      TOOLS[map[k]]();
    }
  });

  // ---------- Cheat-sheet sidebar ----------
  function renderCheatSheet() {
    var list = $("cheat-list");
    list.innerHTML = "";
    cfg.cheatSheet.forEach(function (item) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-key", item.key);
      btn.setAttribute("aria-label", "Insert " + item.title);
      var title = document.createElement("span");
      title.className = "title";
      title.textContent = item.title;
      var code = document.createElement("code");
      code.textContent = item.syntax;
      btn.appendChild(title);
      btn.appendChild(code);
      btn.addEventListener("click", function () { insertSnippet(item.snippet); });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  // ---------- Download ----------
  $("export-btn").addEventListener("click", function () {
    var text = editor().value;
    var name = P.fileNameFor(text);
    var blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setSaveState("Downloaded " + name);
  });

  // ---------- New document ----------
  $("new-doc").addEventListener("click", function () {
    var text = editor().value;
    if (text.trim() && !window.confirm("Start a new document? The current text will be replaced.")) return;
    editor().value = "";
    lastRendered = null;
    renderNow();
    updateCounters();
    saveLater.flush();
    onEdited();
    focusEditor();
  });

  editor().addEventListener("input", onEdited);

  // Make sure the latest text is saved if the page is hidden or closed.
  function flushAll() {
    renderLater.flush();
    saveLater.flush();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) flushAll();
  });
  window.addEventListener("pagehide", flushAll);

  // ---------- Tabs (phones) and the three-column workbench (laptops) ----------
  var state = { section: "editor" };
  var mqDesktop = window.matchMedia("(min-width: 1024px)");

  function applyLayout() {
    doc.dataset.layout = mqDesktop.matches ? "desktop" : "mobile";
  }

  function applySection() {
    document.querySelectorAll("[data-section]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-section") === state.section);
    });
    document.querySelectorAll(".tabbar [data-target]").forEach(function (btn) {
      var on = btn.getAttribute("data-target") === state.section;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", String(on));
    });
  }

  document.querySelectorAll(".tabbar [data-target]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.section = btn.getAttribute("data-target");
      applySection();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  mqDesktop.addEventListener("change", applyLayout);

  // ---------- Start ----------
  var saved = vault.read("doc", null);
  var text = saved && typeof saved.text === "string" ? saved.text : cfg.sampleDoc;
  if (text.length > cfg.maxChars) text = text.slice(0, cfg.maxChars);
  editor().value = text;

  renderCheatSheet();
  renderNow();
  updateCounters();
  setSaveState(saved ? "Restored your last text" : "Sample text loaded. Your edits are saved here.");
  applyLayout();
  applySection();
})();
