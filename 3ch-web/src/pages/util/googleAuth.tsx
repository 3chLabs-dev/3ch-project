// const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// const googleRedirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
// /**
//  * Google 로그인/회원가입 공통 함수
//  */
// export function GoogleAuth() {
//   const redirectUri = `${googleRedirectUri}/auth/google/callback`;
//   const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
//     `client_id=${encodeURIComponent(googleClientId)}` +
//     `&redirect_uri=${encodeURIComponent(redirectUri)}` +
//     `&response_type=code` +
//     `&scope=${encodeURIComponent('openid email profile')}` +
//     `&access_type=offline` +
//     `&prompt=consent`;

//   window.open(
//     googleAuthUrl,
//     `google`,
//     'width=500,height=600,top=100,left=100,resizable=no,scrollbars=yes'
//   );
// }

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export function GoogleAuth() {
  const url = `${apiBaseUrl}/auth/google`;

  window.open(
    url,
    'google',
    'width=500,height=600,top=100,left=100,resizable=no,scrollbars=yes'
  );
}
