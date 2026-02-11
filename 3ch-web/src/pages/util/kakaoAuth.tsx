const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export default function kakaoAuth() {
    const url = `${apiBaseUrl}/api/auth/kakao`;

    window.open(
        url,
        'kakao',
        'width=500,height=600,top=100,left=100,resizable=no,scrollbars=yes'
    );
}