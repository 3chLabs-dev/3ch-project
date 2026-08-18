const KAKAO_PAY_BANK_CODES: Record<string, string> = {
  "우리은행": "020",
  "우리": "020",
  "KB국민은행": "004",
  "국민은행": "004",
  "국민": "004",
  "신한은행": "088",
  "신한": "088",
  "NH농협은행": "011",
  "농협은행": "011",
  "농협": "011",
  "하나은행": "081",
  "하나": "081",
  "카카오뱅크": "090",
  "토스뱅크": "092",
};

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

const BANK_ALIASES = Object.keys(KAKAO_PAY_BANK_CODES).sort((a, b) => b.length - a.length);

export function getKakaoPayBankCode(bankName: string): string | undefined {
  return KAKAO_PAY_BANK_CODES[bankName.trim()];
}

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

export function createKakaoPayTransferLink(
  bankName: string,
  accountNumber: string,
  amount: string | number,
): string | null {
  const bankCode = getKakaoPayBankCode(bankName);
  const normalizedAccountNumber = normalizeAccountNumber(accountNumber);
  const normalizedAmount = normalizeTransferAmount(amount);
  if (!bankCode || !normalizedAccountNumber || !normalizedAmount) return null;

  const params = new URLSearchParams({
    bank_code: bankCode,
    bank_account_number: normalizedAccountNumber,
    amount: normalizedAmount,
  });
  return `kakaopay://money/to/bank?${params.toString()}`;
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
