/* Markdown Companion controller: the editor, the toolbar and cheat-sheet insertion at the cursor,
   picture uploads (shrunk in the browser), the debounced live preview, saving to this browser,
   the .md download, and the layout. The parser lives in parser.js. Runs on load. */
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
    setSaveState(ok ? "Saved in this browser at " + when : "Saved for this visit only (browser storage is full or unavailable)");
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

  // Inserts text at the cursor. block: true starts it on its own line. {cursor} marks where the caret lands.
  function insertText(snippet, block) {
    var t = editor();
    var s = t.selectionStart;
    var e = t.selectionEnd;
    var lead = "";
    if (block && s > 0 && t.value.charAt(s - 1) !== "\n") lead = "\n";
    var idx = snippet.indexOf("{cursor}");
    var text = snippet.replace("{cursor}", "");
    focusEditor();
    t.setRangeText(lead + text, s, e, "end");
    var caret = s + lead.length + (idx < 0 ? text.length : idx);
    t.setSelectionRange(caret, caret);
    onEdited();
  }

  // ---------- Pictures: pick a file, shrink it in the browser, insert it as a data URI ----------
  var PICTURE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

  var picker = document.createElement("input");
  picker.type = "file";
  picker.accept = PICTURE_TYPES.join(",");
  picker.hidden = true;
  document.body.appendChild(picker);

  // Calls back with (errorMessage) or (null, dataUri). The result always fits cfg.maxImageChars.
  function shrinkPicture(file, done) {
    if (PICTURE_TYPES.indexOf(file.type) < 0) {
      done("Choose a PNG, JPEG, GIF or WebP picture.");
      return;
    }
    if (file.size > cfg.maxUploadBytes) {
      done("That picture is too big. Choose one under " + Math.round(cfg.maxUploadBytes / 1000000) + " MB.");
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onerror = function () {
      URL.revokeObjectURL(url);
      done("That file could not be read as a picture.");
    };
    img.onload = function () {
      URL.revokeObjectURL(url);
      var side = Math.max(img.width, img.height) || 1;
      var scale = Math.min(1, cfg.imageMaxSide / side);
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      var data = "";

      // PNG keeps transparency when it fits. Otherwise a JPEG on white, with lower quality until it fits.
      if (file.type === "image/png") {
        ctx.drawImage(img, 0, 0, w, h);
        data = canvas.toDataURL("image/png");
      }
      if (file.type !== "image/png" || data.length > cfg.maxImageChars) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var quality = 0.9;
        data = canvas.toDataURL("image/jpeg", quality);
        while (data.length > cfg.maxImageChars && quality > 0.35) {
          quality -= 0.1;
          data = canvas.toDataURL("image/jpeg", quality);
        }
      }
      if (data.length > cfg.maxImageChars) {
        done("That picture is still too large after shrinking. Try a smaller picture.");
        return;
      }
      done(null, data);
    };
    img.src = url;
  }

  // Alt text from the file name, with the characters that would break the Markdown removed.
  function altFromName(name) {
    var base = String(name || "picture");
    var dot = base.lastIndexOf(".");
    if (dot > 0) base = base.slice(0, dot);
    var clean = base.split("[").join("").split("]").join("").split("(").join("").split(")").join("").trim();
    return clean || "picture";
  }

  picker.addEventListener("change", function () {
    var file = picker.files && picker.files[0];
    picker.value = "";
    if (!file) return;
    setSaveState("Shrinking picture…");
    shrinkPicture(file, function (err, data) {
      if (err) {
        setSaveState(err);
        return;
      }
      insertText("![" + altFromName(file.name) + "](" + data + ")", false);
      setSaveState("Picture added. It is saved with your text.");
    });
  });

  // A picture that fails to load (for example a web address that is down) shows its alt text instead.
  $("preview").addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") return;
    var note = document.createElement("span");
    note.className = "img-fallback";
    note.textContent = "[picture: " + (img.getAttribute("alt") || "no description") + "]";
    img.replaceWith(note);
  }, true);

  // ---------- Toolbar and shortcuts ----------
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
    image: function () { picker.click(); },
    table: function () {
      var item = cfg.cheatSheet.filter(function (x) { return x.key === "table"; })[0];
      if (item) insertText(item.snippet, true);
    },
    list: function () { linePrefix("- "); }
  };

  document.querySelectorAll(".tool").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var fn = TOOLS[btn.getAttribute("data-tool")];
      if (fn) fn();
    });
  });

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
      btn.addEventListener("click", function () {
        if (item.key === "image") picker.click();
        else insertText(item.snippet, !!item.block);
      });
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
