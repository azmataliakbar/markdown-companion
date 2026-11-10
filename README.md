# Markdown Companion

A Markdown editor with a live preview, a one-click cheat sheet and a `.md` download. Plain HTML, CSS and JavaScript. No dependencies, no build step, no API keys.

## Run it

Double-click `index.html`.

## What it does

- **Live preview:** headings (H1 to H3), bold, italic, inline code, fenced code blocks, bullet and numbered lists, blockquotes, links and paragraphs. The preview updates about 50 ms after you pause typing.
- **Safe by design:** everything you type is HTML-escaped before formatting, so typed HTML appears as text. Links accept only `http`, `https` and `mailto`.
- **Toolbar:** H1, Bold, Italic, Code, Link and List insert Markdown at the cursor, or wrap the selected text.
- **Keyboard shortcuts:** Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link).
- **Quick cheat-sheet:** tap any item to insert it at the cursor.
- **Download .md:** saves the text as a Markdown file. The file is named after the first heading, or `notes.md`.
- **Saved in this browser:** your text is saved under the namespace `mc_vault_v1_`. If browser storage is blocked, the app still works for the current visit.
- **Counters:** words and characters, which turn gold near the size limit and red at it.

## Layout

- **Phones (below 1024px):** three tabs at the bottom: **Quick Cheat-Sheet**, **Editor Canvas** and **Live View Doc**.
- **Wide laptops (1024px and up):** three columns: the cheat sheet on the left, the editor in the centre, the live view on the right.

## Tests

```bash
node --test tests/parser.test.js
```

The 17 tests cover: escaping typed HTML, several bold spans on one line, nested bold and italic, code spans protected from formatting, headings only at the start of a line, lists, code blocks, blockquotes, safe and unsafe links, paragraphs, file names, counters, the debounce timing, and the storage namespace.

## Structure

```
index.html            page: cheat sheet, editor with toolbar, live view, tabs, footer
css/app.css           dark neon theme, glowing counters, code boxes, layouts, footer
js/config.js          debounce times, size limit, cheat-sheet items, sample text
js/parser.js          pure logic: escaping, block and inline parsing, debounce, vault
js/app.js             controller: editor, toolbar, preview, save, download, tabs
tests/parser.test.js  Node tests for the parser and helpers
```

## Notes

- The parser handles one line of inline formatting at a time. Markers that cross a line break are shown as typed.
- Tables are not included yet.
