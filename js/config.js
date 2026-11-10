/* Configuration for Markdown Cheat-Sheet Companion. Exposes window.MC.config.
   {cursor} marks where the caret lands after a snippet is inserted.
   block: true means the snippet starts on its own line. */
(function () {
  "use strict";
  window.MC = window.MC || {};
  window.MC.config = {
    previewDebounceMs: 50,    // preview updates 50 ms after typing pauses
    saveDebounceMs: 300,      // text is saved 300 ms after typing pauses
    maxChars: 1500000,        // upper limit for one document (text plus any pictures, saved in this browser)
    maxImageChars: 180000,    // a picture, once encoded, must fit in this many characters
    maxUploadBytes: 8000000,  // the largest picture file the app will read
    imageMaxSide: 800,        // uploaded pictures are shrunk so their longest side is at most this many pixels

    // The cheat-sheet: each entry is shown in the sidebar and inserted on click.
    cheatSheet: [
      { key: "h1", title: "Heading 1", syntax: "# Heading", snippet: "# {cursor}Heading", block: true },
      { key: "h2", title: "Heading 2", syntax: "## Heading", snippet: "## {cursor}Heading", block: true },
      { key: "h3", title: "Heading 3", syntax: "### Heading", snippet: "### {cursor}Heading", block: true },
      { key: "bold", title: "Bold", syntax: "**bold**", snippet: "**{cursor}bold text**" },
      { key: "italic", title: "Italic", syntax: "*italic*", snippet: "*{cursor}italic text*" },
      { key: "strike", title: "Strikethrough", syntax: "~~text~~", snippet: "~~{cursor}struck text~~" },
      { key: "code", title: "Inline code", syntax: "`code`", snippet: "`{cursor}code`" },
      { key: "block", title: "Code block", syntax: "```js ... ```", snippet: "```js\n{cursor}\n```", block: true },
      { key: "link", title: "Link", syntax: "[text](https://…)", snippet: "[{cursor}link text](https://example.com)" },
      { key: "image", title: "Image", syntax: "![alt](https://…)", snippet: "![{cursor}alt text](https://example.com/picture.png)" },
      { key: "bullets", title: "Bullet list", syntax: "- item", snippet: "- {cursor}item", block: true },
      { key: "numbered", title: "Numbered list", syntax: "1. item", snippet: "1. {cursor}item", block: true },
      { key: "tasks", title: "Task list", syntax: "- [ ] task", snippet: "- [ ] {cursor}task", block: true },
      { key: "nested", title: "Nested list", syntax: "  - sub item", snippet: "- {cursor}item\n  - sub item", block: true },
      { key: "quote", title: "Quote", syntax: "> quote", snippet: "> {cursor}quote", block: true },
      { key: "rule", title: "Horizontal rule", syntax: "---", snippet: "{cursor}\n---\n", block: true },
      { key: "table", title: "Table", syntax: "| a | b |", snippet: "| {cursor}Column 1 | Column 2 |\n| --- | :---: |\n| Cell | Cell |", block: true }
    ],

    // The text shown the first time the app opens.
    sampleDoc:
      "# Welcome to the Markdown Companion\n\n" +
      "Type on the left, and the **live view** updates as you type. Use *italic* text, ~~strike~~, `inline code`, or a link like [this one](https://commonmark.org).\n\n" +
      "## Try it\n\n" +
      "- Use the toolbar above the editor to add formatting.\n" +
      "  - Nested items work too.\n" +
      "- [x] Tables and images are supported.\n" +
      "- [ ] Upload a picture with the Image button.\n\n" +
      "| Tool | Shortcut |\n| --- | :---: |\n| Bold | Ctrl+B |\n| Italic | Ctrl+I |\n| Link | Ctrl+K |\n\n" +
      "---\n\n" +
      "> Your text is saved in this browser only.\n\n" +
      "```js\nconst greeting = \"Hello, Markdown\";\n```\n"
  };
})();
