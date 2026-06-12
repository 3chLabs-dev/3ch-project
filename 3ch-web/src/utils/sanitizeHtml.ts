import DOMPurify from "dompurify";

function escapeHtml(value: string) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

export function sanitizeRichHtml(value: string): string {
  if (!value) return "";

  const source = value.trimStart().startsWith("<")
    ? value
    : `<p>${escapeHtml(value.trim()).replace(/\n/g, "<br>")}</p>`;

  const sanitized = DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
  });

  const documentRoot = new DOMParser().parseFromString(sanitized, "text/html");
  documentRoot.querySelectorAll("a").forEach((link) => {
    link.setAttribute("rel", "noopener noreferrer");
    if (link.getAttribute("target") !== "_blank") {
      link.removeAttribute("target");
    }
  });

  return documentRoot.body.innerHTML;
}
