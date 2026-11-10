/* Configuration for Markdown Cheat-Sheet Companion. Exposes window.MC.config.
   {cursor} marks where the caret lands after a snippet is inserted. */
(function () {
  "use strict";
  window.MC = window.MC || {};
  window.MC.config = {
    previewDebounceMs: 50,   // preview updates 50 ms after typing pauses
    saveDebounceMs: 300,     // text is saved 300 ms after typing pauses
    maxChars: 100000,        // a sensible upper limit for one document

    // The cheat-sheet: each entry is shown in the sidebar and inserted on click.
    cheatSheet: [
      { key: "h1", title: "Heading 1", syntax: "# Heading", snippet: "# {cursor}Heading" },
      { key: "h2", title: "Heading 2", syntax: "## Heading", snippet: "## {cursor}Heading" },
      { key: "h3", title: "Heading 3", syntax: "### Heading", snippet: "### {cursor}Heading" },
      { key: "bold", title: "Bold", syntax: "**bold**", snippet: "**{cursor}bold text**" },
      { key: "italic", title: "Italic", syntax: "*italic*", snippet: "*{cursor}italic text*" },
      { key: "code", title: "Inline code", syntax: "`code`", snippet: "`{cursor}code`" },
      { key: "block", title: "Code block", syntax: "```js ... ```", snippet: "```js\n{cursor}\n```" },
      { key: "link", title: "Link", syntax: "[text](https://…)", snippet: "[{cursor}link text](https://example.com)" },
      { key: "bullets", title: "Bullet list", syntax: "- item", snippet: "- {cursor}item" },
      { key: "numbered", title: "Numbered list", syntax: "1. item", snippet: "1. {cursor}item" },
      { key: "quote", title: "Quote", syntax: "> quote", snippet: "> {cursor}quote" }
    ],

    // The text shown the first time the app opens.
    sampleDoc:
      "# Welcome to the Markdown Companion\n\n" +
      "Type on the left, and the **live view** updates as you type. Use *italic* text, `inline code`, or a link like [this one](https://commonmark.org).\n\n" +
      "## Try it\n\n" +
      "- Use the toolbar above the editor to add formatting.\n" +
      "- Press **Ctrl+B** for bold, **Ctrl+I** for italic and **Ctrl+K** for a link.\n" +
      "1. Download your text with the Download .md button.\n\n" +
      "> Your text is saved in this browser only.\n\n" +
      "```js\nconst greeting = \"Hello, Markdown\";\n```\n"
  };
})();
