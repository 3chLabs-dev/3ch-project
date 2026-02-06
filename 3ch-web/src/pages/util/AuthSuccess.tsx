import { useEffect } from "react";

const APP_ORIGIN = import.meta.env.VITE_API_ORIGIN;

const AuthSuccess = () => {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (window.opener) {
            if (token) {
                // ✅ 성공
                localStorage.setItem("accessToken", token);

                window.opener.postMessage(
                    { type: "SOCIAL_LOGIN_SUCCESS" },
                    APP_ORIGIN
                );
            } else {
                // ❌ 실패
                window.opener.postMessage(
                    {
                        type: "SOCIAL_LOGIN_FAIL",
                        reason: "NO_TOKEN",
                    },
                    APP_ORIGIN
                );
            }

            window.close();
        }
    }, []);

    return <div>로그인 처리중...</div>;
};

export default AuthSuccess;