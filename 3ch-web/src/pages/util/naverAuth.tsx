const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export default function naverAuth() {
    const url = `${apiBaseUrl}/api/auth/naver`;

    window.open(
        url,
        "naver",
        "width=500,height=600,top=100,left=100,resizable=no,scrollbars=yes"
    );
}