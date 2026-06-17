const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export default function kakaoAuth() {
    const url = new URL(`${apiBaseUrl}/auth/kakao`);
    url.searchParams.set("returnTo", window.location.origin);

    window.open(
        url.toString(),
        'kakao',
        'width=500,height=600,top=100,left=100,resizable=no,scrollbars=yes'
    );
}
