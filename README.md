# Markdown Companion

A Markdown editor with a live preview, a one-click cheat sheet, pictures, tables and a `.md` download. Plain HTML, CSS and JavaScript. No dependencies, no build step, no API keys.

## Run it

Double-click `index.html`.

## What it does

- **Live preview:** updates about 50 ms after you pause typing.
- **Safe by design:** everything you type is HTML-escaped before formatting, so typed HTML appears as text.
- **Toolbar:** H1, Bold, Italic, Code, Link, List, Image and Table insert Markdown at the cursor, or wrap the selected text.
- **Keyboard shortcuts:** Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link).
- **Quick cheat-sheet:** tap any of the 16 items to insert it at the cursor.
- **Download .md:** saves the text as a Markdown file, named after the first heading, or `notes.md`.
- **Saved in this browser:** your text is saved under the namespace `mc_vault_v1_`. If browser storage is blocked, the app still works for the current visit.
- **Counters:** words and characters, which turn gold near the size limit and red at it.

## Markdown supported

- **Headings:** H1 to H6 (`#` to `######`), at the start of a line.
- **Text:** bold `**x**`, italic `*x*`, bold and italic `***x***`, strikethrough `~~x~~`, inline code, and escapes such as `\*`.
- **Links and pictures:** `[text](https://…)`, autolinks `<https://…>`, and pictures `![alt](https://…)`. Pictures can also be uploaded from your device: they are shrunk in the browser to fit the storage limit.
- **Lists:** bullets, numbers, nested lists (indent by two or four spaces) and task lists `- [ ]` / `- [x]`.
- **Tables:** pipe tables with left, centre and right alignment.
- **Other:** blockquotes, horizontal rules `---`, fenced code blocks with a language label.

Links accept only `http`, `https` and `mailto`. Pictures accept only `http`, `https` and small PNG, JPEG, GIF or WebP data. SVG is never allowed.

## Layout

- **Phones (below 1024px):** three tabs at the bottom: **Quick Cheat-Sheet**, **Editor Canvas** and **Live View Doc**.
- **Wide laptops (1024px and up):** three columns: the cheat sheet on the left, the editor in the centre, the live view on the right.

## Tests

```bash
node --test tests/parser.test.js
```

The 33 tests cover: escaping typed HTML, several bold spans on one line, nested bold and italic, code spans protected from formatting, headings H1 to H6 at the start of a line, lists (nested and task), code blocks, blockquotes, horizontal rules, tables (alignment, padding, escaped pipes), pictures (safe sources only, SVG and scripts blocked), safe and unsafe links, escapes, file names, counters, the debounce timing, the storage namespace, and very long input.

## Structure

```
index.html            page: cheat sheet, editor with toolbar, live view, tabs, footer
css/app.css           dark neon theme, pictures, tables, code boxes, layouts, footer
js/config.js          debounce times, size limits, cheat-sheet items, sample text
js/parser.js          pure logic: escaping, block and inline parsing, debounce, vault
js/app.js             controller: editor, toolbar, pictures, preview, save, download, tabs
tests/parser.test.js  Node tests for the parser and helpers
```

## Notes

- Inline formatting works within a single line. Markers that cross a line break are shown as typed.
- Pictures uploaded from your device are stored inside your text, so they travel with the `.md` download. Each picture is limited to about 180,000 characters once encoded, and the whole document to 1,500,000 characters.
- The downloaded file uses standard Markdown, so most Markdown viewers will show your pictures and tables.
