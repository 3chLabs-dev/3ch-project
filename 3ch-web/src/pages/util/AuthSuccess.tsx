import { useEffect, useRef } from "react";

const SOCIAL_AUTH_RESULT_KEY = "socialAuthResult";

type SocialAuthPayload =
  | { type: "SOCIAL_NEED_NAME"; ticket: string }
  | { type: "SOCIAL_LOGIN_SUCCESS"; token: string }
  | { type: "SOCIAL_LOGIN_FAIL"; reason: string };

const AuthSuccess = () => {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const queryParams = new URLSearchParams(window.location.search);
    const params = hashParams.size > 0 ? hashParams : queryParams;
    window.history.replaceState(null, "", window.location.pathname);

    const signup = params.get("signup");
    const ticket = params.get("ticket");
    const token = params.get("token");

    const finish = (payload: SocialAuthPayload) => {
      if (window.opener) {
        window.opener.postMessage(payload, window.location.origin);
      } else {
        try {
          localStorage.setItem(
            SOCIAL_AUTH_RESULT_KEY,
            JSON.stringify({ payload, issuedAt: Date.now() }),
          );
        } catch {
          // Storage can fail in restricted browser modes.
        }
      }

      window.close();
    };

    if (signup === "1" && ticket) {
      finish({ type: "SOCIAL_NEED_NAME", ticket });
      return;
    }

    if (!token) {
      finish({ type: "SOCIAL_LOGIN_FAIL", reason: "NO_TOKEN" });
      return;
    }

    localStorage.setItem("token", token);
    finish({ type: "SOCIAL_LOGIN_SUCCESS", token });
  }, []);

  return <div>로그인 처리 중입니다...</div>;
};

export default AuthSuccess;
