const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export default function naverAuth() {
    const url = new URL(`${apiBaseUrl}/auth/naver`);
    url.searchParams.set("returnTo", window.location.origin);

    window.open(
        url.toString(),
        "naver",
        "width=500,height=600,top=100,left=100,resizable=no,scrollbars=yes"
    );
}
