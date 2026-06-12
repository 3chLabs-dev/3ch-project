const sanitizeHtml = require("sanitize-html");

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  "img",
  "h1",
  "h2",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

function sanitizeRichHtml(value) {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["style"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "style"],
      td: ["colspan", "rowspan", "style"],
      th: ["colspan", "rowspan", "style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb(a)?\([\d\s,.%]+\)$/i],
        "text-align": [/^(left|right|center|justify)$/],
      },
      img: {
        width: [/^\d+(px|%)$/],
        height: [/^\d+(px|%)$|^auto$/],
        "max-width": [/^\d+(px|%)$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}

module.exports = { sanitizeRichHtml };
