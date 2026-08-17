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

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function getYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
      else if (["shorts", "embed", "live"].includes(pathParts[0] ?? "")) videoId = pathParts[1] ?? "";
    }

    return YOUTUBE_VIDEO_ID.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

/** 이용방법 본문에 단독으로 입력된 YouTube URL을 안전한 반응형 플레이어로 변환합니다. */
export function sanitizeGuideHtml(value: string): string {
  const sanitized = sanitizeRichHtml(value);
  const documentRoot = new DOMParser().parseFromString(sanitized, "text/html");

  documentRoot.body.querySelectorAll("p").forEach((paragraph) => {
    const candidate = paragraph.textContent?.trim() ?? "";
    const videoId = getYouTubeVideoId(candidate);
    if (!videoId) return;

    const wrapper = documentRoot.createElement("div");
    wrapper.className = "youtube-player";

    const iframe = documentRoot.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
    iframe.title = "YouTube video player";
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");

    wrapper.appendChild(iframe);
    paragraph.replaceWith(wrapper);
  });

  return documentRoot.body.innerHTML;
}
