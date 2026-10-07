export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return null;
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
}

export function loginUrl(): string {
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const authPage = /^\/(login|signup|social-signup|password)(\/|$)/.test(window.location.pathname);
  const returnTo = authPage ? sessionStorage.getItem("login-return-to") || "/" : path;
  return `/login?redirect=${encodeURIComponent(safeReturnPath(returnTo) || "/")}`;
}

// Keep the working page mounted: selected Files, dialogs and unsaved inputs stay intact.
export function openUsagePurchase(path = "/mypage/pricing#token-packages"): void {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("returnTo", `${window.location.pathname}${window.location.search}${window.location.hash}`);
  url.searchParams.set("resume", "1");
  const purchaseWindow = window.open(url.toString(), "_blank");
  if (!purchaseWindow) {
    window.alert("입력 내용을 유지하려면 충전 창이 필요합니다. 팝업을 허용한 후 다시 눌러 주세요.");
  }
}

export function paymentReturnParams(): string {
  const current = new URLSearchParams(window.location.search);
  const returnTo = safeReturnPath(current.get("returnTo"));
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  if (returnTo && current.get("resume") === "1") params.set("resume", "1");
  return params.toString();
}

export function completePaymentReturn(): string | null {
  const params = new URLSearchParams(window.location.search);
  const returnTo = safeReturnPath(params.get("returnTo"));
  if (!returnTo) return null;
  // Same-origin receivers refresh balances only; this never replays payment or creation requests.
  try {
    localStorage.setItem("usage-purchase-completed", crypto.randomUUID());
  } catch { /* Focus also triggers a balance refresh when storage is unavailable. */ }
  try {
    if (params.get("resume") === "1" && window.opener && !window.opener.closed) {
      window.opener.focus();
      window.close();
      return null;
    }
  } catch {
    // Payment confirmation has succeeded even if the browser detached the opener.
  }
  return returnTo;
}
