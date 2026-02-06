const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export default  function googleAuth() {
  const url = `${apiBaseUrl}/auth/google`;

  window.open(
    url,
    'google',
    'width=500,height=600,top=100,left=100,resizable=no,scrollbars=yes'
  );
}
