import { useEffect, useState } from "react";
import { sanitizeRichHtml } from "../../utils/sanitizeHtml";
import "./WoonsePolicyPage.css";

type PolicyType = "terms" | "privacy";
type PolicyDocument = { label: string; effectiveDate: string; content: string; format: "html" | "text" };
const API_BASE = "https://0ynohfoee9.execute-api.ap-southeast-2.amazonaws.com/dev/api";

export default function WoonsePolicyPage({ type }: { type: PolicyType }) {
  const title = type === "terms" ? "이용약관" : "개인정보 처리방침";
  const [policy, setPolicy] = useState<PolicyDocument | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `우리운세 ${title}`;
    const icons = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~=icon]"));
    const previousIcons = icons.map(icon => icon.href);
    icons.forEach(icon => { icon.href = "/wooriwoonse/assets/app-icon.png"; });
    const controller = new AbortController();
    fetch(`${API_BASE}/public/policies/${type}`, { signal: controller.signal })
      .then(async response => {
        if (response.status === 404) throw new Error("게시된 문서가 없습니다.");
        if (!response.ok) throw new Error("문서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        return response.json() as Promise<PolicyDocument>;
      })
      .then(setPolicy)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "문서를 불러오지 못했습니다.");
      });
    return () => { controller.abort(); document.title = previousTitle; icons.forEach((icon, index) => { icon.href = previousIcons[index]; }); };
  }, [title, type]);
  return <main className="woonse-policy-page"><div className="woonse-policy-content">
    <h1>{title}</h1>
    {error && <p className="woonse-policy-status" role="alert">{error}</p>}
    {!policy && !error && <p className="woonse-policy-status">문서를 불러오는 중입니다.</p>}
    {policy && <>
      <p className="woonse-policy-effective">{policy.label} · {policy.effectiveDate} 시행</p>
      {policy.format === "html"
        ? <article dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(policy.content) }} />
        : <article className="woonse-policy-plain">{policy.content}</article>}
    </>}
  </div></main>;
}
