import { useEffect } from "react";

const APP_ORIGIN = import.meta.env.VITE_API_ORIGIN;

const AuthFail = () => {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const reason = params.get("reason") || "UNKNOWN";

        if (window.opener) {
            window.opener.postMessage(
                { type: "SOCIAL_LOGIN_FAIL", reason },
                APP_ORIGIN
            );
            window.close();
        }
    }, []);

    return <div>로그인 실패 처리중...</div>;
};

export default AuthFail;