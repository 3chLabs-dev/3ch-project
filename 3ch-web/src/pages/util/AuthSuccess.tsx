import { useEffect } from "react";

const AuthSuccess = () => {
    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get("token");
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
