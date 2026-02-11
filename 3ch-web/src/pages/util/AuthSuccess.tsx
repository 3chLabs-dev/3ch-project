import { useEffect } from "react";

const AuthSuccess = () => {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const signup = params.get("signup"); // "1"
        const ticket = params.get("ticket");
        const token = params.get("token");

        // 신규 소셜가입 이름 입력 필요
        if (signup === "1" && ticket) {
            if (window.opener) {
                window.opener.postMessage(
                    { type: "SOCIAL_NEED_NAME", ticket },
                    window.location.origin
                );
                window.close();
                return;
            }
            // 팝업이 아니면 그냥 이동
            window.location.replace(`/social-signup?ticket=${encodeURIComponent(ticket)}`);
            return;
        }
        if (!token) {
            if (window.opener) window.opener.postMessage({ type: "SOCIAL_LOGIN_FAIL", reason: "NO_TOKEN" }, window.location.origin);
            window.close();
            return;
        }

        localStorage.setItem("token", token);

        if (window.opener) {
            window.opener.postMessage({ type: "SOCIAL_LOGIN_SUCCESS", token }, window.location.origin);
            window.close();
            return;
        }

        window.location.replace("/");
    }, []);

    return <div>로그인 성공 처리중...</div>;
};

export default AuthSuccess;
