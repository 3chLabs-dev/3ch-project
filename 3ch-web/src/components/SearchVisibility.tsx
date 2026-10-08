import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const INDEXABLE_PATHS = new Set([
  "/",
  "/demo/league",
  "/demo/club",
  "/demo/draw",
  "/mypage/guide",
  "/mypage/faq",
  "/mypage/terms",
  "/mypage/privacy",
]);

function setNoIndex() {
  let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.appendChild(robots);
  }
  robots.content = "noindex,nofollow";
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.getElementById("woorileague-structured-data")?.remove();
}

export function NoIndex() {
  useEffect(() => setNoIndex(), []);
  return null;
}

export default function SearchVisibility() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    if (!INDEXABLE_PATHS.has(path) && !/^\/mypage\/guide\/\d+$/.test(path)) setNoIndex();
  }, [pathname]);

  return null;
}
