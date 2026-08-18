const TOSS_BANK_NAMES: Record<string, string> = {
  "우리은행": "우리",
  "우리": "우리",
  "KB국민은행": "국민",
  "국민은행": "국민",
  "국민": "국민",
  "신한은행": "신한",
  "신한": "신한",
  "NH농협은행": "농협",
  "농협은행": "농협",
  "농협": "농협",
  "하나은행": "하나",
  "하나": "하나",
  "카카오뱅크": "카카오뱅크",
  "토스뱅크": "토스뱅크",
};

const BANK_ALIASES = Object.keys(TOSS_BANK_NAMES).sort((a, b) => b.length - a.length);

export function getTossBankName(bankName: string): string | undefined {
  return TOSS_BANK_NAMES[bankName.trim()];
}

export function normalizeAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/\D/g, "");
}

export function normalizeTransferAmount(amount: string | number): string {
  return String(amount).replace(/\D/g, "");
}

export function parseBankAccount(value: string): { bankName: string; accountNumber: string } | null {
  const bankName = BANK_ALIASES.find((alias) => value.includes(alias));
  if (!bankName) return null;

  const accountNumber = normalizeAccountNumber(value.replace(bankName, ""));
  return accountNumber ? { bankName, accountNumber } : null;
}

export function createTossTransferLink(
  bankName: string,
  accountNumber: string,
  amount: string | number,
): string | null {
  const tossBankName = getTossBankName(bankName);
  const normalizedAccountNumber = normalizeAccountNumber(accountNumber);
  const normalizedAmount = normalizeTransferAmount(amount);
  if (!tossBankName || !normalizedAccountNumber || !normalizedAmount) return null;

  const params = new URLSearchParams({
    bank: tossBankName,
    accountNo: normalizedAccountNumber,
    amount: normalizedAmount,
  });
  return `supertoss://send?${params.toString()}`;
}

export function isSmartphoneBrowser(userAgent = navigator.userAgent): boolean {
  return /iPhone|iPod/i.test(userAgent) || (/Android/i.test(userAgent) && /Mobile/i.test(userAgent));
}
