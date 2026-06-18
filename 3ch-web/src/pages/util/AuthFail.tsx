import { useEffect, useRef } from "react";

const SOCIAL_AUTH_RESULT_KEY = "socialAuthResult";

const AuthFail = () => {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason") || "UNKNOWN";
    const payload = { type: "SOCIAL_LOGIN_FAIL", reason };

    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
    } else {
      try {
        localStorage.setItem(
          SOCIAL_AUTH_RESULT_KEY,
          JSON.stringify({ payload, issuedAt: Date.now() }),
        );
      } catch {
        // Storage fallback is best-effort only.
      }
    }

    window.close();
  }, []);

  return <div>로그인 실패 처리 중입니다...</div>;
};

export default AuthFail;
